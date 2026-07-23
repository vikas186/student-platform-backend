-- Fix catalog country pollution and Swiss schools mis-tagged as United Kingdom.
-- Safe: program-as-country rows are inactive duplicates with no courses.

-- 1) Swiss institutions incorrectly stored as United Kingdom
UPDATE universities
SET country = 'Switzerland',
    updated_at = NOW()
WHERE country = 'United Kingdom'
  AND (
    name ILIKE '%Switzerland%'
    OR name ILIKE '%Swiss %'
    OR name ILIKE '%Swiss Hotel%'
    OR name ILIKE '%Zurich%'
    OR name ILIKE '%Lucerne%'
    OR name ILIKE '%Lugano%'
    OR name ILIKE '%BHMS%'
    OR name ILIKE '%Bouveret%'
    OR name ILIKE '%Kloten%'
    OR name ILIKE '%Caux%'
    OR name ILIKE '%Leysin%'
  );

-- 2) Delete scrape artifacts: Canterbury Christ Church (and any other) rows
-- where `country` is actually a programme title.
DELETE FROM universities
WHERE (
    country ~* '^(BA |BSc |BEng |BBA |MA |MSc |MBA |LLM |LL\.?B|PGCE|MMus|PhD|MPhil|Foundation)'
    OR country ILIKE '%(Hons)%'
    OR country ILIKE '%with Foundation%'
    OR country ~* '^(Bachelor|Master|Diploma|Certificate)\b'
  )
  AND NOT EXISTS (SELECT 1 FROM courses c WHERE c.university_id = universities.id)
  AND NOT EXISTS (SELECT 1 FROM commissions c WHERE c.university_id = universities.id)
  AND NOT EXISTS (SELECT 1 FROM deadlines d WHERE d.university_id = universities.id)
  AND NOT EXISTS (SELECT 1 FROM knowledge_base k WHERE k.university_id = universities.id)
  AND NOT EXISTS (SELECT 1 FROM university_profiles p WHERE p.university_id = universities.id);
