-- Track when the partnership agreement PDF was emailed to the agent (once per profile).
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS agreement_email_sent_at TIMESTAMPTZ;
