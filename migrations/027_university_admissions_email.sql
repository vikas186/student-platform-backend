-- Admissions team inbox for forwarding approved applications (with documents) by email.
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS admissions_email VARCHAR(320) NULL;
