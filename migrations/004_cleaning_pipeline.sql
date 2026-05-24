-- Cleaning pipeline: raw scrape storage + quality fields

CREATE TABLE IF NOT EXISTS raw_scraped_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES university_sources(id) ON DELETE CASCADE,
  raw_batch_id UUID NOT NULL,
  website_url TEXT NOT NULL,
  site_type VARCHAR(64) NOT NULL DEFAULT 'university',
  raw_payload JSONB NOT NULL DEFAULT '{}',
  raw_pages JSONB NOT NULL DEFAULT '[]',
  raw_programs JSONB NOT NULL DEFAULT '[]',
  raw_scholarships JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'pending_cleaning',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_scraped_data_source_batch ON raw_scraped_data(source_id, raw_batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_scraped_data_status ON raw_scraped_data(status);

-- university_sources: add cleaning statuses (Sequelize sync may also alter ENUM)
ALTER TABLE university_sources
  DROP CONSTRAINT IF EXISTS university_sources_status_check;

-- scraped_universities: quality / cleaning metadata
ALTER TABLE scraped_universities
  ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaning_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES scraped_universities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cleaning_notes TEXT,
  ADD COLUMN IF NOT EXISTS source_confidence VARCHAR(64),
  ADD COLUMN IF NOT EXISTS raw_batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_scraped_universities_cleaning_status ON scraped_universities(cleaning_status);
CREATE INDEX IF NOT EXISTS idx_scraped_universities_quality ON scraped_universities(quality_score);
CREATE INDEX IF NOT EXISTS idx_scraped_universities_is_duplicate ON scraped_universities(is_duplicate);

-- university_programs: normalized fields + quality
ALTER TABLE university_programs
  ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intake VARCHAR(256),
  ADD COLUMN IF NOT EXISTS campus VARCHAR(256),
  ADD COLUMN IF NOT EXISTS study_mode VARCHAR(128),
  ADD COLUMN IF NOT EXISTS normalized_tuition JSONB,
  ADD COLUMN IF NOT EXISTS normalized_duration JSONB,
  ADD COLUMN IF NOT EXISTS normalized_intakes JSONB,
  ADD COLUMN IF NOT EXISTS normalized_requirements JSONB,
  ADD COLUMN IF NOT EXISTS source_confidence VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cleaning_notes TEXT;
