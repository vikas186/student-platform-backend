import { Request, Response } from 'express';
import constant from '../../../constant';
import AppError from '../../../utils/errorHandler';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import type { UserRole } from '../../../models/User.model';
import {
  bookAppointment,
  cancelAppointment,
  getStudentSchedulingFlow,
  listAdminAppointments,
  listAvailableSlotsForStudent,
  listStudentAppointments,
  patchAdminAppointmentStatus,
  rescheduleAppointment,
} from './appointment.service';
import {
  disconnectGoogleCalendar,
  getConnectionForAdmin,
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
} from './google-oauth.service';
import { getAvailabilityBundleForAdmin, setAvailabilityForAdmin } from './slot.service';
import { schedulingConfig } from './scheduling.config';
import type { AppointmentStatus, AppointmentType } from '../../../models/Appointment.model';

const adminUser = (req: Request) => {
  const u = req.user as { id?: string; role?: UserRole } | undefined;
  if (!u?.id || u.role !== 'admin') throw new AppError('Unauthorized', 401);
  return u.id;
};

const studentUser = (req: Request) => {
  const u = req.user as { id?: string; role?: UserRole } | undefined;
  if (!u?.id || u.role !== 'student') throw new AppError('Unauthorized', 401);
  return u.id;
};

export const getGoogleAuthUrlHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = adminUser(req);
  const url = getGoogleAuthUrl(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Google OAuth URL',
    data: { url },
  });
});

export const googleOAuthCallbackHandler = catchAsyncError(async (req: Request, res: Response) => {
  const q = req.query as { code?: string; state?: string; error?: string };
  const cfg = schedulingConfig();

  if (q.error) {
    res.redirect(`${cfg.adminUiRedirectError}&reason=${encodeURIComponent(q.error)}`);
    return;
  }

  if (!q.code || !q.state) {
    throw new AppError('Missing OAuth code or state', 400);
  }

  await handleGoogleOAuthCallback(q.code, q.state);
  res.redirect(cfg.adminUiRedirectSuccess);
});

export const getGoogleConnectionHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = adminUser(req);
  const data = await getConnectionForAdmin(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Google Calendar connection',
    data: data ?? { connected: false },
  });
});

export const deleteGoogleConnectionHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = adminUser(req);
  await disconnectGoogleCalendar(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Google Calendar disconnected',
  });
});

export const putAvailabilityHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = adminUser(req);
  const body = req.body as {
    timezone?: string;
    windows?: { dayOfWeek: number; startTime: string; endTime: string }[];
    dates?: { date: string; startTime: string; endTime: string }[];
  };
  const data = await setAvailabilityForAdmin(
    userId,
    body.windows ?? [],
    body.timezone,
    body.dates ?? [],
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Availability saved',
    data,
  });
});

export const getAvailabilityHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = adminUser(req);
  const data = await getAvailabilityBundleForAdmin(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Availability',
    data,
  });
});

export const listAdminAppointmentsHandler = catchAsyncError(async (req: Request, res: Response) => {
  adminUser(req);
  const q = req.query as { status?: AppointmentStatus; type?: AppointmentType; from?: string; to?: string };
  const data = await listAdminAppointments({
    status: q.status,
    type: q.type,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  });
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointments',
    data,
  });
});

export const patchAdminAppointmentStatusHandler = catchAsyncError(async (req: Request, res: Response) => {
  adminUser(req);
  const { appointmentId } = req.params as { appointmentId: string };
  const { status } = req.body as { status: AppointmentStatus };
  const data = await patchAdminAppointmentStatus(appointmentId, status);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointment updated',
    data,
  });
});

export const getStudentFlowHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const data = await getStudentSchedulingFlow(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Scheduling flow',
    data,
  });
});

export const listStudentSlotsHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const q = req.query as { type: AppointmentType; from: string; to: string };
  const data = await listAvailableSlotsForStudent(userId, q.type, new Date(q.from), new Date(q.to));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Available slots',
    data,
  });
});

export const bookStudentAppointmentHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const body = req.body as { type: AppointmentType; startsAt: string; notes?: string | null };
  const data = await bookAppointment(userId, body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointment booked',
    data,
  });
});

export const listStudentAppointmentsHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const data = await listStudentAppointments(userId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointments',
    data,
  });
});

export const cancelStudentAppointmentHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const { appointmentId } = req.params as { appointmentId: string };
  const data = await cancelAppointment(userId, appointmentId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointment cancelled',
    data,
  });
});

export const rescheduleStudentAppointmentHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUser(req);
  const { appointmentId } = req.params as { appointmentId: string };
  const { startsAt } = req.body as { startsAt: string };
  const data = await rescheduleAppointment(userId, appointmentId, startsAt);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Appointment rescheduled',
    data,
  });
});
