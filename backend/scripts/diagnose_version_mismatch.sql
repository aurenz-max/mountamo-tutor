-- Diagnostic queries to identify version_id mismatches in curriculum hierarchy

-- 1. Check what version_ids exist for mathematics subject
SELECT
  'subjects' as table_name,
  subject_id,
  subject_name,
  version_id,
  is_active,
  is_draft
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
WHERE subject_name = 'Mathematics'
ORDER BY version_id;

-- 2. Check version_ids in units for mathematics
SELECT
  'units' as table_name,
  u.unit_id,
  u.unit_title,
  u.version_id,
  u.subject_id,
  s.subject_name,
  u.is_draft
FROM `mountamo-tutor-h7wnta.analytics.curriculum_units` u
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
  ON u.subject_id = s.subject_id
WHERE s.subject_name = 'Mathematics' OR u.subject_id IN (
  SELECT subject_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
  WHERE subject_name = 'Mathematics'
)
ORDER BY u.version_id, u.unit_order;

-- 3. Check version_ids in skills for mathematics units
SELECT
  'skills' as table_name,
  sk.skill_id,
  sk.skill_description,
  sk.version_id,
  sk.unit_id,
  u.unit_title,
  sk.is_draft
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id IN (
  SELECT subject_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
  WHERE subject_name = 'Mathematics'
)
ORDER BY sk.version_id;

-- 4. Check version_ids in subskills for mathematics skills
SELECT
  'subskills' as table_name,
  sub.subskill_id,
  sub.subskill_description,
  sub.version_id,
  sub.skill_id,
  sk.skill_description,
  sub.is_draft
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON sub.skill_id = sk.skill_id
WHERE sk.unit_id IN (
  SELECT unit_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
  WHERE subject_id IN (
    SELECT subject_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
    WHERE subject_name = 'Mathematics'
  )
)
ORDER BY sub.version_id;

-- 5. Count records at each level by version_id for mathematics
SELECT
  s.version_id,
  COUNT(DISTINCT s.subject_id) as subject_count,
  COUNT(DISTINCT u.unit_id) as unit_count,
  COUNT(DISTINCT sk.skill_id) as skill_count,
  COUNT(DISTINCT sub.subskill_id) as subskill_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON s.subject_id = u.subject_id AND s.version_id = u.version_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON u.unit_id = sk.unit_id AND u.version_id = sk.version_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
  ON sk.skill_id = sub.skill_id AND sk.version_id = sub.version_id
WHERE s.subject_name = 'Mathematics'
  AND s.is_active = true
  AND s.is_draft = false
GROUP BY s.version_id
ORDER BY s.version_id;

-- 6. Show the version_id mismatch details
SELECT
  'Version Mismatch Analysis' as query_name,
  s.subject_name,
  s.version_id as subject_version,
  u.version_id as unit_version,
  sk.version_id as skill_version,
  sub.version_id as subskill_version,
  u.unit_title,
  sk.skill_description,
  sub.subskill_description
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON s.subject_id = u.subject_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON u.unit_id = sk.unit_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
  ON sk.skill_id = sub.skill_id
WHERE s.subject_name = 'Mathematics'
  AND s.is_active = true
  AND s.is_draft = false
  AND (
    s.version_id != u.version_id OR
    u.version_id != sk.version_id OR
    sk.version_id != sub.version_id
  )
LIMIT 100;
