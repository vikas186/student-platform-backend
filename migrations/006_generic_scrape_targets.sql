-- Generic scrape targets: any website URL, not only IDP/AECC presets

ALTER TABLE scrape_jobs DROP CONSTRAINT IF EXISTS scrape_jobs_source_check;
ALTER TABLE scrape_jobs ALTER COLUMN source TYPE VARCHAR(128);

ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS target_url VARCHAR(2048);
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS target_name VARCHAR(256);
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS seed_urls JSONB NOT NULL DEFAULT '[]';

UPDATE scrape_jobs SET target_url = 'https://www.idp.com/india/'
  WHERE source = 'IDP' AND (target_url IS NULL OR target_url = '');
UPDATE scrape_jobs SET target_url = 'https://www.aeccglobal.com/in'
  WHERE source = 'AECC' AND (target_url IS NULL OR target_url = '');

UPDATE scrape_jobs SET target_url = 'https://unknown.invalid'
  WHERE target_url IS NULL OR target_url = '';

ALTER TABLE scrape_jobs ALTER COLUMN target_url SET NOT NULL;

ALTER TABLE raw_scrape_batches ALTER COLUMN source TYPE VARCHAR(128);
ALTER TABLE scraped_courses ALTER COLUMN source TYPE VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_target_url ON scrape_jobs(target_url);
