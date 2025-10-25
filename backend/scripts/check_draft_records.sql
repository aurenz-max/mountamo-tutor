-- Diagnostic queries to check draft records for Mathematics

-- 1. Check all Mathematics subjects (draft and non-draft)
SELECT
  'SUBJECTS' as table_name,
  subject_id,
  subject_name,
  version_id,
  is_draft,
  is_active,
  created_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
WHERE subject_id = 'Mathematics' OR subject_name = 'Mathematics'
ORDER BY created_at DESC;

-- 2. Check all units for Mathematics (draft and non-draft)
SELECT
  'UNITS' as table_name,
  unit_id,
  unit_title,
  subject_id,
  version_id,
  is_draft,
  created_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
WHERE subject_id = 'Mathematics'
ORDER BY created_at DESC;

-- 3. Check all skills for Mathematics units
SELECT
  'SKILLS' as table_name,
  sk.skill_id,
  sk.skill_description,
  sk.unit_id,
  u.unit_title,
  sk.version_id,
  sk.is_draft,
  sk.created_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'Mathematics'
ORDER BY sk.created_at DESC;

-- 4. Check all subskills for Mathematics
SELECT
  'SUBSKILLS' as table_name,
  sub.subskill_id,
  sub.subskill_description,
  sub.skill_id,
  sk.skill_description,
  sub.version_id,
  sub.is_draft,
  sub.created_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON sub.skill_id = sk.skill_id
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'Mathematics'
ORDER BY sub.created_at DESC;

-- 5. Count draft vs non-draft records
SELECT
  'Summary' as analysis,
  COUNT(CASE WHEN is_draft = true THEN 1 END) as draft_count,
  COUNT(CASE WHEN is_draft = false THEN 1 END) as published_count,
  COUNT(*) as total
FROM (
  SELECT is_draft FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` WHERE subject_id = 'Mathematics'
  UNION ALL
  SELECT is_draft FROM `mountamo-tutor-h7wnta.analytics.curriculum_units` WHERE subject_id = 'Mathematics'
  UNION ALL
  SELECT sk.is_draft FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u ON sk.unit_id = u.unit_id
    WHERE u.subject_id = 'Mathematics'
  UNION ALL
  SELECT sub.is_draft FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk ON sub.skill_id = sk.skill_id
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u ON sk.unit_id = u.unit_id
    WHERE u.subject_id = 'Mathematics'
);

-- 6. Simulate the get_draft_changes query for skills
-- This is what the backend is running
SELECT sk.*
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
WHERE sk.is_draft = true
  AND sk.version_id IN (
    SELECT version_id
    FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
    WHERE subject_id = 'Mathematics'
  );

-- 7. Check if there are version_id mismatches
SELECT
  'Version Check' as analysis,
  COUNT(DISTINCT CASE WHEN table_name = 'subject' THEN version_id END) as subject_versions,
  COUNT(DISTINCT CASE WHEN table_name = 'unit' THEN version_id END) as unit_versions,
  COUNT(DISTINCT CASE WHEN table_name = 'skill' THEN version_id END) as skill_versions,
  COUNT(DISTINCT CASE WHEN table_name = 'subskill' THEN version_id END) as subskill_versions
FROM (
  SELECT 'subject' as table_name, version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` WHERE subject_id = 'Mathematics'
  UNION ALL
  SELECT 'unit' as table_name, version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_units` WHERE subject_id = 'Mathematics'
  UNION ALL
  SELECT 'skill' as table_name, sk.version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u ON sk.unit_id = u.unit_id
    WHERE u.subject_id = 'Mathematics'
  UNION ALL
  SELECT 'subskill' as table_name, sub.version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk ON sub.skill_id = sk.skill_id
    JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u ON sk.unit_id = u.unit_id
    WHERE u.subject_id = 'Mathematics'
);
