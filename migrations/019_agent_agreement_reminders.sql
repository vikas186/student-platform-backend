-- Track partnership agreement upload reminder emails (up to 4 per agent profile).
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS agreement_reminder_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_reminder_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_reminder_3_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_reminder_4_sent_at TIMESTAMPTZ;
