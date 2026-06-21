-- DigiLocker OAuth connections for student document verification
-- Run: psql $DATABASE_URL -f migrations/015_digilocker_connections.sql

CREATE TABLE IF NOT EXISTS digilocker_connections (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  digilocker_name TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digilocker_connections_connected_at ON digilocker_connections(connected_at);
