import { google } from 'googleapis';
import { db } from '../../../config/database';
import { getAuthenticatedClient } from './google-oauth.service';
import type { AppointmentType } from '../../../models/Appointment.model';
import { BRAND_NAME } from '../../../config/brand';

const calendarApi = async (adminUserId: string) => {
  const auth = await getAuthenticatedClient(adminUserId);
  const conn = await db.GoogleCalendarConnection.findByPk(adminUserId);
  const calendarId = conn?.calendarId || 'primary';
  return { calendar: google.calendar({ version: 'v3', auth }), calendarId };
};

export const queryFreeBusy = async (
  adminUserId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<{ start: Date; end: Date }[]> => {
  const { calendar, calendarId } = await calendarApi(adminUserId);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });
  const busy = res.data.calendars?.[calendarId]?.busy ?? [];
  return busy
    .filter(b => b.start && b.end)
    .map(b => ({ start: new Date(b.start!), end: new Date(b.end!) }));
};

export type CreateCalendarEventInput = {
  adminUserId: string;
  studentName: string;
  studentEmail: string;
  adminEmail: string;
  type: AppointmentType;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
};

export const createCalendarEvent = async (
  input: CreateCalendarEventInput,
): Promise<{ eventId: string; meetLink: string | null }> => {
  const { calendar, calendarId } = await calendarApi(input.adminUserId);
  const title =
    input.type === 'counselling'
      ? `${BRAND_NAME} Counselling — ${input.studentName}`
      : `${BRAND_NAME} Mock Interview — ${input.studentName}`;

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: title,
      description: `Scheduled via ${BRAND_NAME} platform (${input.type.replace('_', ' ')}).`,
      start: { dateTime: input.startsAt.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.endsAt.toISOString(), timeZone: input.timezone },
      attendees: [{ email: input.studentEmail }, { email: input.adminEmail }],
      conferenceData: {
        createRequest: {
          requestId: `uniwizer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const eventId = res.data.id;
  if (!eventId) {
    throw new Error('Google Calendar did not return an event id');
  }

  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
    null;

  return { eventId, meetLink };
};

export const updateCalendarEventTimes = async (
  adminUserId: string,
  eventId: string,
  startsAt: Date,
  endsAt: Date,
  timezone: string,
): Promise<{ meetLink: string | null }> => {
  const { calendar, calendarId } = await calendarApi(adminUserId);
  const res = await calendar.events.patch({
    calendarId,
    eventId,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      start: { dateTime: startsAt.toISOString(), timeZone: timezone },
      end: { dateTime: endsAt.toISOString(), timeZone: timezone },
    },
  });
  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
    null;
  return { meetLink };
};

export const deleteCalendarEvent = async (adminUserId: string, eventId: string): Promise<void> => {
  const { calendar, calendarId } = await calendarApi(adminUserId);
  await calendar.events.delete({ calendarId, eventId, sendUpdates: 'all' });
};
