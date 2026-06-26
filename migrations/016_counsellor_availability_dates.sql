-- One-off counsellor availability on specific calendar dates (in addition to weekly windows)
-- Run: psql $DATABASE_URL -f migrations/016_counsellor_availability_dates.sql

CREATE TABLE IF NOT EXISTS counsellor_availability_dates (
  id SERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  availability_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, availability_date)
);

CREATE INDEX IF NOT EXISTS idx_counsellor_availability_dates_admin
  ON counsellor_availability_dates(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_counsellor_availability_dates_date
  ON counsellor_availability_dates(availability_date);
