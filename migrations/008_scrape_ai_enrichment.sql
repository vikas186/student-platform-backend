-- AI enrichment metadata + upsert unique keys

CREATE TABLE IF NOT EXISTS scrape_ai_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('course', 'university', 'scholarship')),
  entity_id UUID NOT NULL,
  job_id UUID REFERENCES scrape_jobs(id) ON DELETE SET NULL,
  source VARCHAR(128) NOT NULL,
  subject_tags JSONB NOT NULL DEFAULT '[]',
  career_tags JSONB NOT NULL DEFAULT '[]',
  ielts_required BOOLEAN,
  ielts_score VARCHAR(32),
  ai_summary TEXT,
  page_category VARCHAR(64),
  parser_output JSONB NOT NULL DEFAULT '{}',
  categorizer_output JSONB NOT NULL DEFAULT '{}',
  model VARCHAR(64),
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_ai_meta_entity ON scrape_ai_meta(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_scrape_ai_meta_job ON scrape_ai_meta(job_id);

ALTER TABLE scraped_courses ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE scraped_courses ADD COLUMN IF NOT EXISTS subject_tags JSONB NOT NULL DEFAULT '[]';
ALTER TABLE scraped_courses ADD COLUMN IF NOT EXISTS career_tags JSONB NOT NULL DEFAULT '[]';

ALTER TABLE scrape_universities ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE scrape_universities ADD COLUMN IF NOT EXISTS subject_tags JSONB NOT NULL DEFAULT '[]';
ALTER TABLE scrape_universities ADD COLUMN IF NOT EXISTS ranking_tags JSONB NOT NULL DEFAULT '[]';

ALTER TABLE scrape_scholarships ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE scrape_scholarships ADD COLUMN IF NOT EXISTS subject_tags JSONB NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_universities_upsert
  ON scrape_universities(source, university_name, COALESCE(country, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_scholarships_upsert
  ON scrape_scholarships(source, scholarship_name, COALESCE(university_name, ''), COALESCE(country, ''));
