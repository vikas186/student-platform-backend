-- Block counsellor booking slots (unavailability windows).
-- Run: psql $DATABASE_URL -f migrations/022_counsellor_unavailability.sql

CREATE TABLE IF NOT EXISTS counsellor_unavailability (
  id SERIAL PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_counsellor_unavailability_admin
  ON counsellor_unavailability(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_counsellor_unavailability_range
  ON counsellor_unavailability(starts_at, ends_at);
