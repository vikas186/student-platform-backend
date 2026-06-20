-- Appointment email reminder tracking (24h + 1h before session)
-- Run: psql $DATABASE_URL -f migrations/010_appointment_email_reminders.sql

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ;
