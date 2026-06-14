import { Op } from 'sequelize';
import { db } from '../../../config/database';
import { schedulingConfig } from './scheduling.config';
import { queryFreeBusy } from './google-calendar.service';
import type { AvailabilitySlot, AvailabilityWindowInput } from './scheduling.types';
import {
  formatDateInZone,
  getDayOfWeekInZone,
  localTimeInZoneToUtc,
  nextCalendarDateInZone,
} from './timezone.util';
import {
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

export const getAvailabilityBundleForAdmin = async (adminUserId: string) => {
  const windows = await getAvailabilityForAdmin(adminUserId);
  const timezone = windows[0]?.timezone || schedulingConfig().timezone;
  return {
    timezone,
    windows: windows.map(({ dayOfWeek, startTime, endTime }) => ({
      dayOfWeek,
      startTime,
      endTime,
    })),
  };
};

export const setAvailabilityForAdmin = async (
  adminUserId: string,
  windows: AvailabilityWindowInput[],
  timezone?: string,
) => {
  const tz = timezone || schedulingConfig().timezone;

  for (const w of windows) {
    const startTime = formatAvailabilityTime(w.startTime);
    const endTime = formatAvailabilityTime(w.endTime);
    if (!isValidAvailabilityWindow(startTime, endTime)) {
      throw new AppError(
        `End time must be after start time for day ${w.dayOfWeek} (${startTime} – ${endTime})`,
        400,
      );
    }
  }

  await db.sequelize.transaction(async t => {
    await db.CounsellorAvailability.destroy({ where: { adminUserId }, transaction: t });
    for (const w of windows) {
      await db.CounsellorAvailability.create(
        {
          adminUserId,
          dayOfWeek: w.dayOfWeek,
          startTime: formatAvailabilityTime(w.startTime),
          endTime: formatAvailabilityTime(w.endTime),
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
  const windows = await getAvailabilityForAdmin(adminUserId);
  if (!windows.length) {
    return [];
  }

  const slotMs = schedulingConfig().slotMinutes * 60_000;
  const candidates: AvailabilitySlot[] = [];
  const tz = windows[0]?.timezone || schedulingConfig().timezone;
  const now = new Date();

  let currentDate = formatDateInZone(from, tz);
  const endDate = formatDateInZone(to, tz);

  while (currentDate <= endDate) {
    const dow = getDayOfWeekInZone(currentDate, tz);
    const dayWindows = windows.filter(w => w.dayOfWeek === dow);

    for (const w of dayWindows) {
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
    }

    currentDate = nextCalendarDateInZone(currentDate, tz);
  }

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

  return candidates.filter(slot => {
    const s = new Date(slot.startsAt);
    const e = new Date(slot.endsAt);
    return !busyBlocks.some(b => overlaps(s, e, b.start, b.end));
  });
};
