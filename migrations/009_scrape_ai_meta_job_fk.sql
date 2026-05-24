-- Allow scrape job deletion without FK violations on AI enrichment metadata

ALTER TABLE scrape_ai_meta DROP CONSTRAINT IF EXISTS scrape_ai_meta_job_id_fkey;

ALTER TABLE scrape_ai_meta
  ADD CONSTRAINT scrape_ai_meta_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES scrape_jobs(id) ON DELETE SET NULL;
