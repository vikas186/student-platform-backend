-- Google Calendar scheduling: counselling + mock interview appointments
-- Run: psql $DATABASE_URL -f migrations/009_google_calendar_scheduling.sql

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email VARCHAR(255) NOT NULL,
  calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
  refresh_token_enc TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counsellor_availability (
  id SERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_counsellor_availability_admin ON counsellor_availability(admin_user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
    CREATE TYPE appointment_type AS ENUM ('counselling', 'mock_interview');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id INTEGER NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type appointment_type NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  google_event_id VARCHAR(255),
  meet_link TEXT,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_student_profile ON appointments(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_appointments_student_user ON appointments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_host_admin ON appointments(host_admin_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
