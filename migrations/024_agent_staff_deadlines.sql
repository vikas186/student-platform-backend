-- Per-staff deadline visibility (primary agent toggles).
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS can_view_deadlines BOOLEAN NOT NULL DEFAULT TRUE;
