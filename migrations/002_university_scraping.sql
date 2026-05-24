-- University auto-scraping tables (also created via Sequelize sync)
-- Run manually if you prefer SQL migrations over sync({ alter: true })

CREATE TABLE IF NOT EXISTS university_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name VARCHAR(512) NOT NULL,
  website_url VARCHAR(2048) NOT NULL UNIQUE,
  country VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_scraped_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scraped_universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES university_sources(id) ON DELETE CASCADE,
  name VARCHAR(512) NOT NULL,
  country VARCHAR(128),
  city VARCHAR(256),
  website_url VARCHAR(2048),
  email VARCHAR(320),
  phone VARCHAR(64),
  address TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES scraped_universities(id) ON DELETE CASCADE,
  name VARCHAR(512) NOT NULL,
  degree_level VARCHAR(128),
  duration VARCHAR(128),
  tuition_fee VARCHAR(256),
  requirements TEXT,
  deadline VARCHAR(128),
  source_url VARCHAR(2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS university_scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES scraped_universities(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  amount VARCHAR(256),
  eligibility TEXT,
  deadline VARCHAR(128),
  source_url VARCHAR(2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES university_sources(id) ON DELETE CASCADE,
  status VARCHAR(64) NOT NULL,
  message TEXT,
  error_stack TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_university_sources_status ON university_sources(status);
CREATE INDEX IF NOT EXISTS idx_scraped_universities_source_id ON scraped_universities(source_id);
CREATE INDEX IF NOT EXISTS idx_scraped_universities_status ON scraped_universities(status);
