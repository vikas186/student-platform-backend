import { Op } from 'sequelize';
import { db } from '../../../config/database';
import { schedulingConfig } from './scheduling.config';
import { queryFreeBusy } from './google-calendar.service';
import type {
  AvailabilityDateWindowInput,
  AvailabilitySlot,
  AvailabilityWindowInput,
} from './scheduling.types';
import {
  formatDateInZone,
  getDayOfWeekInZone,
  localTimeInZoneToUtc,
  nextCalendarDateInZone,
} from './timezone.util';
import {
  findOverlappingDayOfWeek,
  formatAvailabilityTime,
  isValidAvailabilityWindow,
} from './availability-time.util';
import AppError from '../../../utils/errorHandler';

const parseTimeParts = (time: string): { h: number; m: number } => {
  const [h, m] = time.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && aEnd > bStart;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeAvailabilityDate = (value: string): string => {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) {
    throw new AppError(`Invalid date "${value}" — use YYYY-MM-DD`, 400);
  }
  return trimmed;
};

const appendSlotsForCalendarDate = (
  currentDate: string,
  w: { startTime: string; endTime: string },
  tz: string,
  from: Date,
  to: Date,
  now: Date,
  slotMs: number,
  candidates: AvailabilitySlot[],
) => {
  const startParts = parseTimeParts(w.startTime);
  const endParts = parseTimeParts(w.endTime);
  const windowStart = localTimeInZoneToUtc(
    currentDate,
    `${String(startParts.h).padStart(2, '0')}:${String(startParts.m).padStart(2, '0')}`,
    tz,
  );
  const windowEnd = localTimeInZoneToUtc(
    currentDate,
    `${String(endParts.h).padStart(2, '0')}:${String(endParts.m).padStart(2, '0')}`,
    tz,
  );

  let slotStart = new Date(windowStart);
  while (slotStart.getTime() + slotMs <= windowEnd.getTime()) {
    const slotEnd = new Date(slotStart.getTime() + slotMs);
    if (slotStart >= from && slotEnd <= to && slotStart > now) {
      candidates.push({
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
        timezone: tz,
        durationMinutes: schedulingConfig().slotMinutes,
        method: 'Google Meet',
      });
    }
    slotStart = new Date(slotStart.getTime() + slotMs);
  }
};

export const getAvailabilityForAdmin = async (adminUserId: string) => {
  const rows = await db.CounsellorAvailability.findAll({
    where: { adminUserId },
    order: [['dayOfWeek', 'ASC']],
  });
  return rows.map(r => {
    const p = r.get({ plain: true }) as {
      dayOfWeek: number;
      startTime: unknown;
      endTime: unknown;
      timezone: string;
    };
    return {
      dayOfWeek: p.dayOfWeek,
      startTime: formatAvailabilityTime(p.startTime),
      endTime: formatAvailabilityTime(p.endTime),
      timezone: p.timezone,
    };
  });
};

export const getAvailabilityDatesForAdmin = async (adminUserId: string) => {
  const rows = await db.CounsellorAvailabilityDate.findAll({
    where: { adminUserId },
    order: [['availabilityDate', 'ASC']],
  });
  return rows.map(r => {
    const p = r.get({ plain: true }) as {
      availabilityDate: string;
      startTime: unknown;
      endTime: unknown;
      timezone: string;
    };
    return {
      date: String(p.availabilityDate).slice(0, 10),
      startTime: formatAvailabilityTime(p.startTime),
      endTime: formatAvailabilityTime(p.endTime),
      timezone: p.timezone,
    };
  });
};

export const getAvailabilityBundleForAdmin = async (adminUserId: string) => {
  const [windows, dates] = await Promise.all([
    getAvailabilityForAdmin(adminUserId),
    getAvailabilityDatesForAdmin(adminUserId),
  ]);
  const timezone =
    windows[0]?.timezone || dates[0]?.timezone || schedulingConfig().timezone;
  return {
    timezone,
    windows: windows.map(({ dayOfWeek, startTime, endTime }) => ({
      dayOfWeek,
      startTime,
      endTime,
    })),
    dates: dates.map(({ date, startTime, endTime }) => ({
      date,
      startTime,
      endTime,
    })),
  };
};

export const setAvailabilityForAdmin = async (
  adminUserId: string,
  windows: AvailabilityWindowInput[],
  timezone?: string,
  dates: AvailabilityDateWindowInput[] = [],
) => {
  const tz = timezone || schedulingConfig().timezone;
  const normalizedWindows = windows.map(w => ({
    dayOfWeek: w.dayOfWeek,
    startTime: formatAvailabilityTime(w.startTime),
    endTime: formatAvailabilityTime(w.endTime),
  }));
  const normalizedDates = dates.map(d => ({
    date: normalizeAvailabilityDate(d.date),
    startTime: formatAvailabilityTime(d.startTime),
    endTime: formatAvailabilityTime(d.endTime),
  }));

  if (normalizedWindows.length === 0 && normalizedDates.length === 0) {
    throw new AppError('Enable at least one weekday or add a specific date with a time window.', 400);
  }

  for (const w of normalizedWindows) {
    if (!isValidAvailabilityWindow(w.startTime, w.endTime)) {
      throw new AppError(
        `End time must be after start time for day ${w.dayOfWeek} (${w.startTime} – ${w.endTime})`,
        400,
      );
    }
  }

  const overlappingDay = findOverlappingDayOfWeek(normalizedWindows);
  if (overlappingDay != null) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    throw new AppError(
      `Overlapping time slots on ${dayNames[overlappingDay] ?? `day ${overlappingDay}`}. Remove or adjust intervals so they do not overlap.`,
      400,
    );
  }

  for (const d of normalizedDates) {
    if (!isValidAvailabilityWindow(d.startTime, d.endTime)) {
      throw new AppError(
        `End time must be after start time for ${d.date} (${d.startTime} – ${d.endTime})`,
        400,
      );
    }
  }

  const seenDates = new Set<string>();
  for (const d of normalizedDates) {
    if (seenDates.has(d.date)) {
      throw new AppError(`Duplicate availability for ${d.date}`, 400);
    }
    seenDates.add(d.date);
  }

  await db.sequelize.transaction(async t => {
    await db.CounsellorAvailability.destroy({ where: { adminUserId }, transaction: t });
    for (const w of normalizedWindows) {
      await db.CounsellorAvailability.create(
        {
          adminUserId,
          dayOfWeek: w.dayOfWeek,
          startTime: w.startTime,
          endTime: w.endTime,
          timezone: tz,
        },
        { transaction: t },
      );
    }

    await db.CounsellorAvailabilityDate.destroy({ where: { adminUserId }, transaction: t });
    for (const d of normalizedDates) {
      await db.CounsellorAvailabilityDate.create(
        {
          adminUserId,
          availabilityDate: d.date,
          startTime: d.startTime,
          endTime: d.endTime,
          timezone: tz,
        },
        { transaction: t },
      );
    }
  });
  return getAvailabilityBundleForAdmin(adminUserId);
};

export const generateAvailableSlots = async (
  adminUserId: string,
  from: Date,
  to: Date,
): Promise<AvailabilitySlot[]> => {
  const [windows, dateWindows] = await Promise.all([
    getAvailabilityForAdmin(adminUserId),
    getAvailabilityDatesForAdmin(adminUserId),
  ]);
  if (!windows.length && !dateWindows.length) {
    return [];
  }

  const slotMs = schedulingConfig().slotMinutes * 60_000;
  const candidates: AvailabilitySlot[] = [];
  const tz =
    windows[0]?.timezone || dateWindows[0]?.timezone || schedulingConfig().timezone;
  const now = new Date();
  const dateOverrideByDay = new Map(
    dateWindows.map(d => [d.date, { startTime: d.startTime, endTime: d.endTime }]),
  );

  let currentDate = formatDateInZone(from, tz);
  const endDate = formatDateInZone(to, tz);

  while (currentDate <= endDate) {
    const dateOverride = dateOverrideByDay.get(currentDate);
    if (dateOverride) {
      appendSlotsForCalendarDate(
        currentDate,
        dateOverride,
        tz,
        from,
        to,
        now,
        slotMs,
        candidates,
      );
    } else {
      const dow = getDayOfWeekInZone(currentDate, tz);
      const dayWindows = windows.filter(w => w.dayOfWeek === dow);
      for (const w of dayWindows) {
        appendSlotsForCalendarDate(currentDate, w, tz, from, to, now, slotMs, candidates);
      }
    }

    currentDate = nextCalendarDateInZone(currentDate, tz);
  }

  const seenStarts = new Set<string>();
  const uniqueCandidates = candidates.filter(slot => {
    if (seenStarts.has(slot.startsAt)) return false;
    seenStarts.add(slot.startsAt);
    return true;
  });

  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);
  const [googleBusy, dbAppointments] = await Promise.all([
    queryFreeBusy(adminUserId, rangeStart, rangeEnd).catch(() => [] as { start: Date; end: Date }[]),
    db.Appointment.findAll({
      where: {
        hostAdminUserId: adminUserId,
        status: 'scheduled',
        startsAt: { [Op.lt]: rangeEnd },
        endsAt: { [Op.gt]: rangeStart },
      },
      attributes: ['startsAt', 'endsAt'],
    }),
  ]);

  const busyBlocks = [
    ...googleBusy,
    ...dbAppointments.map(a => ({
      start: a.startsAt as Date,
      end: a.endsAt as Date,
    })),
  ];

  const unavailability = await db.CounsellorUnavailability.findAll({
    where: {
      adminUserId,
      startsAt: { [Op.lt]: rangeEnd },
      endsAt: { [Op.gt]: rangeStart },
    },
    attributes: ['startsAt', 'endsAt'],
  });
  for (const u of unavailability) {
    busyBlocks.push({
      start: u.startsAt as Date,
      end: u.endsAt as Date,
    });
  }

  return uniqueCandidates.filter(slot => {
    const s = new Date(slot.startsAt);
    const e = new Date(slot.endsAt);
    return !busyBlocks.some(b => overlaps(s, e, b.start, b.end));
  });
};

export const listUnavailabilityForAdmin = async (adminUserId: string) => {
  const rows = await db.CounsellorUnavailability.findAll({
    where: { adminUserId },
    order: [['startsAt', 'ASC']],
  });
  return rows.map(r => {
    const p = r.get({ plain: true }) as {
      id: number;
      startsAt: Date;
      endsAt: Date;
      reason: string | null;
    };
    return {
      id: p.id,
      startsAt: new Date(p.startsAt).toISOString(),
      endsAt: new Date(p.endsAt).toISOString(),
      reason: p.reason,
    };
  });
};

export const createUnavailabilityForAdmin = async (
  adminUserId: string,
  input: { startsAt: string; endsAt: string; reason?: string | null },
) => {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new AppError('Invalid unavailability start/end', 400);
  }
  if (endsAt <= startsAt) {
    throw new AppError('Unavailability end must be after start', 400);
  }
  const row = await db.CounsellorUnavailability.create({
    adminUserId,
    startsAt,
    endsAt,
    reason: input.reason?.trim() || null,
  });
  const p = row.get({ plain: true }) as {
    id: number;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  };
  return {
    id: p.id,
    startsAt: new Date(p.startsAt).toISOString(),
    endsAt: new Date(p.endsAt).toISOString(),
    reason: p.reason,
  };
};

export const deleteUnavailabilityForAdmin = async (adminUserId: string, id: number) => {
  const n = await db.CounsellorUnavailability.destroy({ where: { id, adminUserId } });
  if (!n) throw new AppError('Unavailability block not found', 404);
};

/** Admins who have connected Google Calendar (for multi-counsellor scheduling). */
export const listCounsellorCalendars = async () => {
  const connections = await db.GoogleCalendarConnection.findAll({
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
  });
  const out: Array<{
    adminUserId: string;
    name: string;
    email: string;
    googleEmail: string | null;
    hasAvailability: boolean;
  }> = [];
  for (const c of connections) {
    const plain = c.get({ plain: true }) as {
      userId?: string;
      googleEmail?: string | null;
      user?: { id: string; name?: string; email?: string; role?: string };
    };
    const adminUserId = plain.userId || plain.user?.id;
    if (!adminUserId) continue;
    if (plain.user?.role && plain.user.role !== 'admin') continue;
    const [weekly, dates] = await Promise.all([
      db.CounsellorAvailability.count({ where: { adminUserId } }),
      db.CounsellorAvailabilityDate.count({ where: { adminUserId } }),
    ]);
    out.push({
      adminUserId,
      name: plain.user?.name?.trim() || 'Counsellor',
      email: plain.user?.email?.trim() || '',
      googleEmail: plain.googleEmail?.trim() || null,
      hasAvailability: weekly + dates > 0,
    });
  }
  return out;
};
