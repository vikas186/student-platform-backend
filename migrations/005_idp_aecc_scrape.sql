-- Replace legacy university scraping with IDP/AECC course scraping

DROP TABLE IF EXISTS university_programs CASCADE;
DROP TABLE IF EXISTS university_scholarships CASCADE;
DROP TABLE IF EXISTS scraped_universities CASCADE;
DROP TABLE IF EXISTS scraping_logs CASCADE;
DROP TABLE IF EXISTS raw_scraped_data CASCADE;
DROP TABLE IF EXISTS university_sources CASCADE;

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(8) NOT NULL CHECK (source IN ('IDP', 'AECC')),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
  stats JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_source ON scrape_jobs(source);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

CREATE TABLE IF NOT EXISTS raw_scrape_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID NOT NULL,
  source VARCHAR(8) NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  raw_courses JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'pending_cleaning',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_scrape_batches_job ON raw_scrape_batches(job_id, raw_batch_id);

CREATE TABLE IF NOT EXISTS scraped_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID,
  source VARCHAR(8) NOT NULL,
  university_name VARCHAR(512) NOT NULL,
  course_name VARCHAR(512) NOT NULL,
  country VARCHAR(128),
  city VARCHAR(256),
  study_level VARCHAR(128),
  duration VARCHAR(128),
  tuition_fee VARCHAR(256),
  intake VARCHAR(256),
  ielts_requirement TEXT,
  academic_requirement TEXT,
  application_fee VARCHAR(128),
  scholarship TEXT,
  course_url VARCHAR(2048),
  normalized_tuition JSONB,
  normalized_duration JSONB,
  normalized_intakes JSONB,
  normalized_requirements JSONB,
  quality_score INTEGER NOT NULL DEFAULT 0,
  cleaning_status VARCHAR(32),
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES scraped_courses(id) ON DELETE SET NULL,
  record_status VARCHAR(32) NOT NULL DEFAULT 'cleaned',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraped_courses_job ON scraped_courses(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_courses_source ON scraped_courses(source);
CREATE INDEX IF NOT EXISTS idx_scraped_courses_cleaning ON scraped_courses(cleaning_status);
CREATE INDEX IF NOT EXISTS idx_scraped_courses_course_url ON scraped_courses(course_url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraped_courses_source_url
  ON scraped_courses(source, course_url) WHERE course_url IS NOT NULL AND course_url <> '';
