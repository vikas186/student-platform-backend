-- Align scrape_jobs status/trigger_type with Sequelize ENUM types.
-- Required when tables were created by 005 as VARCHAR and sync({ alter: true }) fails on default cast.

DO $$
BEGIN
  CREATE TYPE enum_scrape_jobs_status AS ENUM (
    'pending', 'running', 'scraping', 'pending_cleaning', 'cleaning', 'completed', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE enum_scrape_jobs_trigger_type AS ENUM ('manual', 'cron');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scrape_jobs'
      AND column_name = 'status'
      AND udt_name <> 'enum_scrape_jobs_status'
  ) THEN
    ALTER TABLE scrape_jobs ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE scrape_jobs
      ALTER COLUMN status TYPE enum_scrape_jobs_status
      USING status::text::enum_scrape_jobs_status;
    ALTER TABLE scrape_jobs ALTER COLUMN status SET DEFAULT 'pending'::enum_scrape_jobs_status;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scrape_jobs'
      AND column_name = 'trigger_type'
      AND udt_name <> 'enum_scrape_jobs_trigger_type'
  ) THEN
    ALTER TABLE scrape_jobs ALTER COLUMN trigger_type DROP DEFAULT;
    ALTER TABLE scrape_jobs
      ALTER COLUMN trigger_type TYPE enum_scrape_jobs_trigger_type
      USING trigger_type::text::enum_scrape_jobs_trigger_type;
    ALTER TABLE scrape_jobs ALTER COLUMN trigger_type SET DEFAULT 'manual'::enum_scrape_jobs_trigger_type;
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE enum_raw_scrape_batches_status AS ENUM (
    'pending_cleaning', 'cleaning', 'cleaned', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'raw_scrape_batches'
      AND column_name = 'status'
      AND udt_name <> 'enum_raw_scrape_batches_status'
  ) THEN
    ALTER TABLE raw_scrape_batches ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE raw_scrape_batches
      ALTER COLUMN status TYPE enum_raw_scrape_batches_status
      USING status::text::enum_raw_scrape_batches_status;
    ALTER TABLE raw_scrape_batches
      ALTER COLUMN status SET DEFAULT 'pending_cleaning'::enum_raw_scrape_batches_status;
  END IF;
END $$;
