import { Op } from 'sequelize';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import type { AppointmentStatus, AppointmentType } from '../../../models/Appointment.model';
import { markCounsellingCompleted } from './counselling.util';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventTimes,
} from './google-calendar.service';
import { isAnyGoogleCalendarConnected, resolveHostAdminUserId } from './google-oauth.service';
import { getHostAdminDetails, resolveHostAdminForSlots } from './host-admin.util';
import { schedulingConfig } from './scheduling.config';
import { generateAvailableSlots } from './slot.service';
import {
  dispatchEmail,
  formatAppointmentWhen,
  sendAppointmentCancelledEmail,
  sendAppointmentConfirmationEmail,
} from '../../../services/email.service';
import type {
  AppointmentSummary,
  AvailabilitySlot,
  SchedulingFlowResponse,
  SchedulingNextStep,
} from './scheduling.types';

type AppointmentRow = {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  meetLink: string | null;
  notes: string | null;
  studentProfileId?: number;
  studentUserId?: string;
  hostAdminUserId?: string;
  googleEventId?: string | null;
};

const toSummary = (
  row: AppointmentRow,
  host?: { counsellorName: string; counsellorEmail: string; counsellorTitle: string },
): AppointmentSummary => ({
  id: row.id,
  type: row.type,
  status: row.status,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  timezone: row.timezone,
  meetLink: row.meetLink,
  meetJoinUrl: row.meetLink,
  notes: row.notes,
  counsellorName: host?.counsellorName ?? null,
  counsellorEmail: host?.counsellorEmail ?? null,
  counsellor: host?.counsellorEmail ?? host?.counsellorName ?? null,
  title: host?.counsellorTitle ?? null,
  durationMinutes: schedulingConfig().slotMinutes,
});

const notifyUser = async (userId: string, message: string, type: string) => {
  await db.Notification.create({ userId, message, type });
};

const getStudentProfileOrThrow = async (userId: string) => {
  const profile = await db.StudentProfile.findOne({ where: { userId } });
  if (!profile) {
    throw new AppError('Student profile not found', 404);
  }
  return profile;
};

const assertSlotAvailable = async (adminUserId: string, startsAt: Date, endsAt: Date) => {
  const from = new Date(startsAt);
  from.setHours(0, 0, 0, 0);
  const to = new Date(endsAt);
  to.setHours(23, 59, 59, 999);
  const slots = await generateAvailableSlots(adminUserId, from, to);
  const match = slots.some(s => s.startsAt === startsAt.toISOString() && s.endsAt === endsAt.toISOString());
  if (!match) {
    throw new AppError('Selected time slot is no longer available', 409);
  }
};

const activeAppointment = async (studentProfileId: number, type: AppointmentType) =>
  db.Appointment.findOne({
    where: {
      studentProfileId,
      type,
      status: 'scheduled',
      startsAt: { [Op.gte]: new Date() },
    },
    order: [['startsAt', 'ASC']],
  });

export const getStudentSchedulingFlow = async (userId: string): Promise<SchedulingFlowResponse> => {
  const profile = await getStudentProfileOrThrow(userId);
  const counsellingCompleted = Boolean(profile.counsellingCompletedAt);
  const googleCalendarConnected = await isAnyGoogleCalendarConnected();

  const [counsellingRow, mockRow, completedMock] = await Promise.all([
    activeAppointment(profile.id, 'counselling'),
    activeAppointment(profile.id, 'mock_interview'),
    db.Appointment.findOne({
      where: { studentProfileId: profile.id, type: 'mock_interview', status: 'completed' },
      order: [['completedAt', 'DESC']],
    }),
  ]);

  const counsellingAppointment = counsellingRow
    ? toSummary(
        counsellingRow.get({ plain: true }) as AppointmentRow,
        await getHostAdminDetails(counsellingRow.hostAdminUserId),
      )
    : null;
  const mockInterviewAppointment = mockRow
    ? toSummary(mockRow.get({ plain: true }) as AppointmentRow, await getHostAdminDetails(mockRow.hostAdminUserId))
    : null;

  let nextStep: SchedulingNextStep = 'book_counselling';
  if (counsellingAppointment) {
    nextStep = 'await_counselling';
  } else if (counsellingCompleted && mockInterviewAppointment) {
    nextStep = 'await_mock_interview';
  } else if (counsellingCompleted) {
    nextStep = 'book_mock_interview';
  }

  if (counsellingCompleted && (completedMock || mockInterviewAppointment?.status === 'completed')) {
    nextStep = 'complete';
  }

  return {
    counsellingCompleted,
    counsellingAppointment,
    mockInterviewEligible: counsellingCompleted,
    mockInterviewAppointment,
    nextStep,
    googleCalendarConnected,
  };
};

export const listStudentAppointments = async (userId: string) => {
  const profile = await getStudentProfileOrThrow(userId);
  const rows = await db.Appointment.findAll({
    where: { studentProfileId: profile.id },
    order: [['startsAt', 'DESC']],
  });
  return Promise.all(
    rows.map(async r => {
      const plain = r.get({ plain: true }) as AppointmentRow;
      const host = await getHostAdminDetails(plain.hostAdminUserId!);
      return toSummary(plain, host);
    }),
  );
};

export const listAvailableSlotsForStudent = async (
  userId: string,
  type: AppointmentType,
  from: Date,
  to: Date,
): Promise<AvailabilitySlot[]> => {
  const profile = await getStudentProfileOrThrow(userId);

  if (type === 'mock_interview' && !profile.counsellingCompletedAt) {
    throw new AppError('Complete counselling before booking a mock interview', 403);
  }

  if (type === 'counselling' && (await activeAppointment(profile.id, 'counselling'))) {
    throw new AppError('You already have an upcoming counselling appointment', 409);
  }

  if (type === 'mock_interview' && (await activeAppointment(profile.id, 'mock_interview'))) {
    throw new AppError('You already have an upcoming mock interview appointment', 409);
  }

  const adminUserId = await resolveHostAdminForSlots();
  const slots = await generateAvailableSlots(adminUserId, from, to);
  const host = await getHostAdminDetails(adminUserId);
  const title =
    type === 'mock_interview' ? 'Interview coach' : host.counsellorTitle;

  return slots.map(slot => ({
    ...slot,
    counsellorName: host.counsellorName,
    counsellorEmail: host.counsellorEmail,
    counsellor: host.counsellorEmail || host.counsellorName,
    title,
  }));
};

export const bookAppointment = async (
  userId: string,
  input: { type: AppointmentType; startsAt: string; notes?: string | null },
) => {
  const profile = await getStudentProfileOrThrow(userId);
  const student = await db.User.findByPk(userId);
  if (!student) throw new AppError('User not found', 404);

  if (input.type === 'mock_interview' && !profile.counsellingCompletedAt) {
    throw new AppError('Complete counselling before booking a mock interview', 403);
  }

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new AppError('Invalid startsAt', 400);
  }

  const slotMs = schedulingConfig().slotMinutes * 60_000;
  const endsAt = new Date(startsAt.getTime() + slotMs);
  const timezone = schedulingConfig().timezone;
  const hostAdminUserId = await resolveHostAdminUserId();
  const hostAdmin = await db.User.findByPk(hostAdminUserId);
  if (!hostAdmin) throw new AppError('Host admin not found', 503);

  await assertSlotAvailable(hostAdminUserId, startsAt, endsAt);

  const existingAtSlot = await db.Appointment.findOne({
    where: {
      hostAdminUserId,
      status: 'scheduled',
      startsAt,
    },
  });
  if (existingAtSlot) {
    throw new AppError('Selected time slot is no longer available', 409);
  }

  if (input.type === 'counselling' && (await activeAppointment(profile.id, 'counselling'))) {
    throw new AppError('You already have an upcoming counselling appointment', 409);
  }
  if (input.type === 'mock_interview' && (await activeAppointment(profile.id, 'mock_interview'))) {
    throw new AppError('You already have an upcoming mock interview appointment', 409);
  }

  const { eventId, meetLink } = await createCalendarEvent({
    adminUserId: hostAdminUserId,
    studentName: student.name,
    studentEmail: student.email,
    adminEmail: hostAdmin.email,
    type: input.type,
    startsAt,
    endsAt,
    timezone,
  });

  const row = await db.Appointment.create({
    studentProfileId: profile.id,
    studentUserId: userId,
    hostAdminUserId,
    type: input.type,
    status: 'scheduled',
    startsAt,
    endsAt,
    timezone,
    googleEventId: eventId,
    meetLink,
    notes: input.notes?.trim() || null,
  });

  const label = input.type === 'counselling' ? 'Counselling' : 'Mock interview';
  const when = formatAppointmentWhen(startsAt, timezone);
  await notifyUser(
    userId,
    `${label} scheduled for ${when}.${meetLink ? ` Join: ${meetLink}` : ''}`,
    'scheduling_booked',
  );
  await notifyUser(
    hostAdminUserId,
    `${label} booked with ${student.name} for ${when}.`,
    'scheduling_booked',
  );

  dispatchEmail(
    () =>
      sendAppointmentConfirmationEmail({
        to: student.email,
        name: student.name,
        sessionLabel: label,
        whenLabel: when,
        meetLink,
      }),
    'appointment confirmation (student)',
  );
  dispatchEmail(
    () =>
      sendAppointmentConfirmationEmail({
        to: hostAdmin.email,
        name: hostAdmin.name,
        sessionLabel: `${label} with ${student.name}`,
        whenLabel: when,
        meetLink,
      }),
    'appointment confirmation (host)',
  );

  const hostDetails = await getHostAdminDetails(hostAdminUserId);
  return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
};

export const cancelAppointment = async (userId: string, appointmentId: string) => {
  const row = await db.Appointment.findByPk(appointmentId);
  if (!row || row.studentUserId !== userId) {
    throw new AppError('Appointment not found', 404);
  }
  if (row.status !== 'scheduled') {
    throw new AppError('Only scheduled appointments can be cancelled', 400);
  }

  const student = await db.User.findByPk(row.studentUserId);
  const hostAdmin = await db.User.findByPk(row.hostAdminUserId);
  const label = row.type === 'counselling' ? 'Counselling' : 'Mock interview';
  const when = formatAppointmentWhen(row.startsAt, row.timezone);

  if (row.googleEventId) {
    await deleteCalendarEvent(row.hostAdminUserId, row.googleEventId);
  }

  row.status = 'cancelled';
  row.cancelledAt = new Date();
  await row.save();

  await notifyUser(userId, 'Your appointment was cancelled.', 'scheduling_cancelled');

  if (student?.email) {
    dispatchEmail(
      () =>
        sendAppointmentCancelledEmail({
          to: student.email,
          name: student.name,
          sessionLabel: label,
          whenLabel: when,
        }),
      'appointment cancelled (student)',
    );
  }
  if (hostAdmin?.email) {
    dispatchEmail(
      () =>
        sendAppointmentCancelledEmail({
          to: hostAdmin.email,
          name: hostAdmin.name,
          sessionLabel: `${label} with ${student?.name ?? 'student'}`,
          whenLabel: when,
        }),
      'appointment cancelled (host)',
    );
  }

  const hostDetails = await getHostAdminDetails(row.hostAdminUserId);
  return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
};

export const rescheduleAppointment = async (
  userId: string,
  appointmentId: string,
  startsAtIso: string,
) => {
  const row = await db.Appointment.findByPk(appointmentId);
  if (!row || row.studentUserId !== userId) {
    throw new AppError('Appointment not found', 404);
  }
  if (row.status !== 'scheduled') {
    throw new AppError('Only scheduled appointments can be rescheduled', 400);
  }

  const startsAt = new Date(startsAtIso);
  const slotMs = schedulingConfig().slotMinutes * 60_000;
  const endsAt = new Date(startsAt.getTime() + slotMs);

  await assertSlotAvailable(row.hostAdminUserId, startsAt, endsAt);

  if (row.googleEventId) {
    const { meetLink } = await updateCalendarEventTimes(
      row.hostAdminUserId,
      row.googleEventId,
      startsAt,
      endsAt,
      row.timezone,
    );
    if (meetLink) row.meetLink = meetLink;
  }

  row.startsAt = startsAt;
  row.endsAt = endsAt;
  await row.save();

  await notifyUser(userId, `Appointment rescheduled to ${startsAt.toISOString()}.`, 'scheduling_rescheduled');
  const hostDetails = await getHostAdminDetails(row.hostAdminUserId);
  return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
};

export const listAdminAppointments = async (query: {
  status?: AppointmentStatus;
  type?: AppointmentType;
  from?: Date;
  to?: Date;
}) => {
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.from || query.to) {
    const startsAt: Record<symbol, Date> = {};
    if (query.from) startsAt[Op.gte] = query.from;
    if (query.to) startsAt[Op.lte] = query.to;
    where.startsAt = startsAt;
  }

  const rows = await db.Appointment.findAll({
    where,
    include: [{ model: db.User, as: 'studentUser', attributes: ['id', 'name', 'email'] }],
    order: [['startsAt', 'DESC']],
    limit: 100,
  });

  return rows.map(r => {
    const plain = r.get({ plain: true }) as AppointmentRow & {
      studentUser?: { id: string; name: string; email: string };
      studentProfileId: number;
    };
    return {
      ...toSummary(plain),
      studentProfileId: plain.studentProfileId,
      student: plain.studentUser ?? null,
    };
  });
};

export const patchAdminAppointmentStatus = async (
  appointmentId: string,
  status: AppointmentStatus,
) => {
  const row = await db.Appointment.findByPk(appointmentId);
  if (!row) throw new AppError('Appointment not found', 404);

  if (status === 'cancelled' && row.status === 'scheduled' && row.googleEventId) {
    await deleteCalendarEvent(row.hostAdminUserId, row.googleEventId);
    row.cancelledAt = new Date();
  }

  row.status = status;
  if (status === 'completed') {
    row.completedAt = new Date();
    if (row.type === 'counselling') {
      await markCounsellingCompleted(row.studentProfileId);
      await notifyUser(
        row.studentUserId,
        'Counselling complete — you can now see university names and book a mock interview.',
        'counselling_completed',
      );
    }
  }

  await row.save();
  const hostDetails = await getHostAdminDetails(row.hostAdminUserId);
  return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
};
