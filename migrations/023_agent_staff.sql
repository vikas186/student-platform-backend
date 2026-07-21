-- Agent staff under an owner agency (share applications; hide finance flags).
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS parent_agent_profile_id INTEGER NULL
    REFERENCES agent_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS can_view_commission BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_deposits BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_parent
  ON agent_profiles (parent_agent_profile_id)
  WHERE parent_agent_profile_id IS NOT NULL;
