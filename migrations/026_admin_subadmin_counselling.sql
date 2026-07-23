-- Primary vs sub-admin hierarchy + student counsellor assignment for scoped counselling/apps.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS parent_admin_user_id UUID NULL
    REFERENCES users(id) ON DELETE SET NULL;

UPDATE users
SET is_primary_admin = TRUE
WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_users_parent_admin
  ON users (parent_admin_user_id)
  WHERE parent_admin_user_id IS NOT NULL;

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS assigned_counsellor_user_id UUID NULL
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_profiles_assigned_counsellor
  ON student_profiles (assigned_counsellor_user_id)
  WHERE assigned_counsellor_user_id IS NOT NULL;
