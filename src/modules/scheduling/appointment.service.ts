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
  sendAppointmentRescheduledEmail,
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

const assertValidBookingEmail = (email: string) => {
  const norm = String(email).trim().toLowerCase();
  const domain = norm.split('@')[1] ?? '';
  if (!domain || !domain.includes('.')) {
    throw new AppError('Please use a valid email address on your profile before booking.', 400);
  }
  const blocked = ['localhost', 'example.com', 'example.org', 'test', 'invalid'];
  if (blocked.includes(domain) || domain.endsWith('.local') || domain.endsWith('.test')) {
    throw new AppError('Please use a valid email address on your profile before booking.', 400);
  }
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
  hostAdminUserId: row.hostAdminUserId ?? null,
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
  const hostDetails = await getHostAdminDetails(hostAdminUserId);
  const hostEmail = hostDetails.counsellorEmail || hostAdmin.email;

  assertValidBookingEmail(student.email);

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
        to: hostEmail,
        name: hostDetails.counsellorName || hostAdmin.name,
        sessionLabel: `${label} with ${student.name}`,
        whenLabel: when,
        meetLink,
      }),
    'appointment confirmation (host)',
  );

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
  const hostDetails = hostAdmin ? await getHostAdminDetails(row.hostAdminUserId) : undefined;
  const hostEmail = hostDetails?.counsellorEmail || hostAdmin?.email;
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
  if (hostEmail) {
    dispatchEmail(
      () =>
        sendAppointmentCancelledEmail({
          to: hostEmail,
          name: hostDetails?.counsellorName || hostAdmin?.name || 'Counsellor',
          sessionLabel: `${label} with ${student?.name ?? 'student'}`,
          whenLabel: when,
        }),
      'appointment cancelled (host)',
    );
  }

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

  const previousWhen = formatAppointmentWhen(row.startsAt, row.timezone);
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

  const student = await db.User.findByPk(row.studentUserId);
  const hostAdmin = await db.User.findByPk(row.hostAdminUserId);
  const hostDetails = await getHostAdminDetails(row.hostAdminUserId);
  const hostEmail = hostDetails?.counsellorEmail || hostAdmin?.email;
  const label = row.type === 'counselling' ? 'Counselling' : 'Mock interview';
  const newWhen = formatAppointmentWhen(startsAt, row.timezone);

  await notifyUser(
    userId,
    `${label} rescheduled to ${newWhen}.${row.meetLink ? ` Join: ${row.meetLink}` : ''}`,
    'scheduling_rescheduled',
  );
  if (hostAdmin?.id) {
    await notifyUser(
      hostAdmin.id,
      `${label} with ${student?.name || 'student'} rescheduled to ${newWhen}.`,
      'scheduling_rescheduled',
    );
  }

  if (student?.email) {
    dispatchEmail(
      () =>
        sendAppointmentRescheduledEmail({
          to: student.email,
          name: student.name,
          sessionLabel: label,
          previousWhenLabel: previousWhen,
          newWhenLabel: newWhen,
          meetLink: row.meetLink,
        }),
      'appointment rescheduled (student)',
    );
  }
  if (hostEmail) {
    dispatchEmail(
      () =>
        sendAppointmentRescheduledEmail({
          to: hostEmail,
          name: hostDetails?.counsellorName || hostAdmin?.name || 'Counsellor',
          sessionLabel: `${label} with ${student?.name || 'student'}`,
          previousWhenLabel: previousWhen,
          newWhenLabel: newWhen,
          meetLink: row.meetLink,
        }),
      'appointment rescheduled (host)',
    );
  }

  return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
};

export const listAdminAppointments = async (
  viewerUserId: string,
  query: {
    status?: AppointmentStatus;
    type?: AppointmentType;
    from?: Date;
    to?: Date;
  },
) => {
  const { resolveAdminContext } = await import('../../../utils/adminContext');
  const ctx = await resolveAdminContext(viewerUserId);

  const where: Record<string, unknown> = {};
  if (!ctx.isPrimaryAdmin) {
    where.hostAdminUserId = viewerUserId;
  }
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
    include: [
      { model: db.User, as: 'studentUser', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'hostAdmin', attributes: ['id', 'name', 'email'] },
    ],
    order: [['startsAt', 'DESC']],
    limit: 100,
  });

  return rows.map(r => {
    const plain = r.get({ plain: true }) as AppointmentRow & {
      studentUser?: { id: string; name: string; email: string };
      hostAdmin?: { id: string; name: string; email: string };
      studentProfileId: number;
    };
    const hostDetails = {
      counsellorName: plain.hostAdmin?.name || '',
      counsellorEmail: plain.hostAdmin?.email || '',
      counsellorTitle: 'Counsellor',
    };
    return {
      ...toSummary(plain, hostDetails),
      studentProfileId: plain.studentProfileId,
      student: plain.studentUser ?? null,
      studentName: plain.studentUser?.name ?? null,
      studentId: plain.studentUser?.id ?? null,
      hostAdmin: plain.hostAdmin ?? null,
    };
  });
};

export const patchAdminAppointmentStatus = async (
  viewerUserId: string,
  appointmentId: string,
  status: AppointmentStatus,
) => {
  const { resolveAdminContext } = await import('../../../utils/adminContext');
  const ctx = await resolveAdminContext(viewerUserId);

  const row = await db.Appointment.findByPk(appointmentId);
  if (!row) throw new AppError('Appointment not found', 404);
  if (!ctx.isPrimaryAdmin && row.hostAdminUserId !== viewerUserId) {
    throw new AppError('You can only update appointments allocated to you', 403);
  }

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

/**
 * Primary admin allocates a booked session to a sub-admin (or another counsellor).
 * Moves the Google Calendar event onto the assignee's calendar (blocking that slot)
 * and scopes the student's applications to that counsellor.
 */
export const allocateAppointmentToAdmin = async (
  actorUserId: string,
  appointmentId: string,
  assigneeAdminUserId: string,
) => {
  const { assertPrimaryAdmin } = await import('../../../utils/adminContext');
  await assertPrimaryAdmin(actorUserId);

  const row = await db.Appointment.findByPk(appointmentId);
  if (!row) throw new AppError('Appointment not found', 404);
  if (row.status !== 'scheduled') {
    throw new AppError('Only scheduled appointments can be allocated', 400);
  }

  const assignee = await db.User.findByPk(assigneeAdminUserId);
  if (!assignee || assignee.role !== 'admin' || !assignee.status) {
    throw new AppError('Assignee must be an active admin account', 400);
  }

  const previousHostId = row.hostAdminUserId;
  if (previousHostId === assigneeAdminUserId) {
    const hostDetails = await getHostAdminDetails(previousHostId);
    return toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails);
  }

  const googleConnected = await isAnyGoogleCalendarConnected();
  const assigneeConn = await db.GoogleCalendarConnection.findByPk(assigneeAdminUserId);
  if (!assigneeConn) {
    throw new AppError(
      'Assignee must connect Google Calendar before receiving allocated sessions',
      400,
    );
  }

  const conflict = await db.Appointment.findOne({
    where: {
      hostAdminUserId: assigneeAdminUserId,
      status: 'scheduled',
      id: { [Op.ne]: appointmentId },
      startsAt: { [Op.lt]: row.endsAt },
      endsAt: { [Op.gt]: row.startsAt },
    },
  });
  if (conflict) {
    throw new AppError('Assignee already has a session overlapping this time', 409);
  }

  // Skip weekly-availability window check — primary allocation may place onto any free calendar slot.
  // Google free/busy still blocks if the assignee's calendar is busy.
  try {
    const { queryFreeBusy } = await import('./google-calendar.service');
    const busy = await queryFreeBusy(assigneeAdminUserId, row.startsAt, row.endsAt);
    const overlaps = busy.some(b => b.start < row.endsAt && b.end > row.startsAt);
    if (overlaps) {
      throw new AppError('Assignee Google Calendar is busy at this time', 409);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn(
      '[scheduling] freebusy check skipped:',
      err instanceof Error ? err.message : err,
    );
  }

  const student = await db.User.findByPk(row.studentUserId);
  if (!student) throw new AppError('Student not found', 404);

  if (row.googleEventId) {
    try {
      await deleteCalendarEvent(previousHostId, row.googleEventId);
    } catch (err) {
      console.warn(
        '[scheduling] failed to remove event from previous host:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  let eventId: string | null = row.googleEventId;
  let meetLink: string | null = row.meetLink;
  try {
    const created = await createCalendarEvent({
      adminUserId: assigneeAdminUserId,
      studentName: student.name,
      studentEmail: student.email,
      adminEmail: assignee.email,
      type: row.type,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      timezone: row.timezone,
    });
    eventId = created.eventId;
    meetLink = created.meetLink;
  } catch (err) {
    if (googleConnected) {
      throw new AppError(
        `Could not create calendar event on assignee calendar: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }
  }

  row.hostAdminUserId = assigneeAdminUserId;
  row.googleEventId = eventId;
  row.meetLink = meetLink;
  await row.save();

  const profile = await db.StudentProfile.findByPk(row.studentProfileId);
  if (profile) {
    profile.assignedCounsellorUserId = assigneeAdminUserId;
    await profile.save();
  }

  const label = row.type === 'counselling' ? 'Counselling' : 'Mock interview';
  const when = formatAppointmentWhen(row.startsAt, row.timezone);
  await notifyUser(
    assigneeAdminUserId,
    `${label} allocated to you with ${student.name} for ${when}.`,
    'scheduling_allocated',
  );
  if (previousHostId !== actorUserId) {
    await notifyUser(
      previousHostId,
      `${label} with ${student.name} (${when}) was reallocated to another counsellor.`,
      'scheduling_reallocated',
    );
  }

  dispatchEmail(
    () =>
      sendAppointmentConfirmationEmail({
        to: assignee.email,
        name: assignee.name,
        sessionLabel: `${label} with ${student.name} (allocated to you)`,
        whenLabel: when,
        meetLink,
      }),
    'appointment allocated (assignee)',
  );

  const hostDetails = await getHostAdminDetails(assigneeAdminUserId);
  return {
    ...toSummary(row.get({ plain: true }) as AppointmentRow, hostDetails),
    studentName: student.name,
    studentId: student.id,
    hostAdmin: { id: assignee.id, name: assignee.name, email: assignee.email },
  };
};
