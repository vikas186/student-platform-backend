-- Email verification for student (OTP) and agent (link) signups.
-- Grandfather existing accounts so they can keep signing in.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512),
  otp VARCHAR(6),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('link', 'otp')),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx
  ON email_verification_tokens (user_id);

CREATE INDEX IF NOT EXISTS email_verification_tokens_token_idx
  ON email_verification_tokens (token)
  WHERE token IS NOT NULL AND used = FALSE;

CREATE INDEX IF NOT EXISTS email_verification_tokens_otp_idx
  ON email_verification_tokens (user_id, otp)
  WHERE otp IS NOT NULL AND used = FALSE;
