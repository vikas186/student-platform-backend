-- Optional structured admission requirements on curated courses
-- (IELTS / TOEFL / PTE / Duolingo / academic % / work experience).
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS admission_requirements JSONB NULL;
