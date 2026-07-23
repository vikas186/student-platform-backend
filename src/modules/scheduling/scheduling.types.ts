import type { AppointmentStatus, AppointmentType } from '../../../models/Appointment.model';

export type SchedulingNextStep =
  | 'book_counselling'
  | 'await_counselling'
  | 'book_mock_interview'
  | 'await_mock_interview'
  | 'complete';

export type AppointmentSummary = {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  meetLink: string | null;
  meetJoinUrl: string | null;
  notes: string | null;
  counsellorName?: string | null;
  counsellorEmail?: string | null;
  counsellor?: string | null;
  title?: string | null;
  durationMinutes?: number;
  hostAdminUserId?: string | null;
};

export type SchedulingFlowResponse = {
  counsellingCompleted: boolean;
  counsellingAppointment: AppointmentSummary | null;
  mockInterviewEligible: boolean;
  mockInterviewAppointment: AppointmentSummary | null;
  nextStep: SchedulingNextStep;
  googleCalendarConnected: boolean;
};

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  counsellorName?: string;
  counsellorEmail?: string;
  counsellor?: string;
  title?: string;
  method?: string;
  durationMinutes?: number;
};

export type AvailabilityWindowInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type AvailabilityDateWindowInput = {
  date: string;
  startTime: string;
  endTime: string;
};
