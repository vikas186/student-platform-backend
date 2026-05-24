-- Rich profile fields from admin portals / API catalogs (Chinese label-value forms, etc.)

ALTER TABLE scraped_universities
  ADD COLUMN IF NOT EXISTS province VARCHAR(128),
  ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_scraped_universities_profile_data ON scraped_universities USING gin (profile_data);
