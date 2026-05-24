-- Multi-entity scrape: universities, fees, scholarships, rejected pages

CREATE TABLE IF NOT EXISTS scrape_universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID,
  source VARCHAR(128) NOT NULL,
  university_name VARCHAR(512) NOT NULL,
  country VARCHAR(128),
  city VARCHAR(256),
  ranking VARCHAR(128),
  overview TEXT,
  website_url VARCHAR(2048),
  source_url VARCHAR(2048),
  faculties JSONB DEFAULT '[]',
  departments JSONB DEFAULT '[]',
  popular_courses JSONB DEFAULT '[]',
  quality_score INTEGER NOT NULL DEFAULT 0,
  cleaning_status VARCHAR(32),
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES scrape_universities(id) ON DELETE SET NULL,
  record_status VARCHAR(32) NOT NULL DEFAULT 'cleaned',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID,
  source VARCHAR(128) NOT NULL,
  country VARCHAR(128),
  study_level VARCHAR(128),
  tuition_fee VARCHAR(256),
  living_cost VARCHAR(256),
  accommodation_cost VARCHAR(256),
  currency VARCHAR(16),
  description TEXT,
  source_url VARCHAR(2048),
  quality_score INTEGER NOT NULL DEFAULT 0,
  cleaning_status VARCHAR(32),
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES scrape_fees(id) ON DELETE SET NULL,
  record_status VARCHAR(32) NOT NULL DEFAULT 'cleaned',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID,
  source VARCHAR(128) NOT NULL,
  scholarship_name VARCHAR(512) NOT NULL,
  university_name VARCHAR(512),
  country VARCHAR(128),
  amount VARCHAR(256),
  eligibility TEXT,
  deadline VARCHAR(128),
  description TEXT,
  source_url VARCHAR(2048),
  quality_score INTEGER NOT NULL DEFAULT 0,
  cleaning_status VARCHAR(32),
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES scrape_scholarships(id) ON DELETE SET NULL,
  record_status VARCHAR(32) NOT NULL DEFAULT 'cleaned',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_rejected_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  raw_batch_id UUID,
  source VARCHAR(128) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  page_title VARCHAR(512),
  classification VARCHAR(32) NOT NULL DEFAULT 'reject',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE raw_scrape_batches ADD COLUMN IF NOT EXISTS raw_universities JSONB NOT NULL DEFAULT '[]';
ALTER TABLE raw_scrape_batches ADD COLUMN IF NOT EXISTS raw_fees JSONB NOT NULL DEFAULT '[]';
ALTER TABLE raw_scrape_batches ADD COLUMN IF NOT EXISTS raw_scholarships JSONB NOT NULL DEFAULT '[]';
ALTER TABLE raw_scrape_batches ADD COLUMN IF NOT EXISTS rejected_pages JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_scrape_universities_job ON scrape_universities(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_universities_source ON scrape_universities(source);
CREATE INDEX IF NOT EXISTS idx_scrape_fees_job ON scrape_fees(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_scholarships_job ON scrape_scholarships(job_id);
CREATE INDEX IF NOT EXISTS idx_scrape_rejected_pages_job ON scrape_rejected_pages(job_id);
