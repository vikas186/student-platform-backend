-- Didit KYC verification sessions
-- Run: psql $DATABASE_URL -f migrations/011_didit_verification_sessions.sql

CREATE TABLE IF NOT EXISTS verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  didit_session_id TEXT NOT NULL,
  didit_verification_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_url TEXT,
  document_type TEXT,
  verification_data JSONB,
  processed_webhook_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_id ON verification_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_sessions_didit_session_id ON verification_sessions(didit_session_id);
