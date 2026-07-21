-- Extend applications.status enum for visa + commission pipeline.
-- Run: psql $DATABASE_URL -f migrations/021_application_status_visa_pipeline.sql
-- Also applied automatically via sequelize.sync({ alter: true }) on many environments.

DO $$
BEGIN
  ALTER TYPE "enum_applications_status" ADD VALUE IF NOT EXISTS 'visa_applied';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "enum_applications_status" ADD VALUE IF NOT EXISTS 'visa_rejected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "enum_applications_status" ADD VALUE IF NOT EXISTS 'withdrawn';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "enum_applications_status" ADD VALUE IF NOT EXISTS 'agent_invoice_received';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "enum_applications_status" ADD VALUE IF NOT EXISTS 'commission_paid';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
