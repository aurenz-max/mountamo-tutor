-- ============================================================================
-- Curriculum Fix Verification Script
-- ============================================================================
-- Run this script after executing fix_language_arts_versions.sql to verify
-- that all fixes were applied correctly.
-- ============================================================================

-- ============================================================================
-- TEST 1: Verify Version Consistency
-- ============================================================================
SELECT '=== TEST 1: Version Consistency ===' as test_section;

-- Check that all Language Arts entities use the same version_id
SELECT
  'Units' as entity_type,
  version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
WHERE subject_id = 'LANGUAGE_ARTS'
GROUP BY version_id

UNION ALL

SELECT
  'Skills' as entity_type,
  sk.version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'LANGUAGE_ARTS'
GROUP BY sk.version_id

UNION ALL

SELECT
  'Subskills' as entity_type,
  sub.version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON sub.skill_id = sk.skill_id
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'LANGUAGE_ARTS'
GROUP BY sub.version_id

UNION ALL

SELECT
  'Prerequisites' as entity_type,
  p.version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
WHERE p.version_id = '1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32'  -- Language Arts version
GROUP BY p.version_id

ORDER BY entity_type;

-- Expected: All should show only version_id = 1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32

-- ============================================================================
-- TEST 2: Verify curriculum_versions Entry
-- ============================================================================
SELECT '=== TEST 2: Curriculum Versions Entry ===' as test_section;

SELECT
  subject_id,
  version_id,
  version_number,
  description,
  is_active,
  created_at,
  activated_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
WHERE subject_id = 'LANGUAGE_ARTS';

-- Expected: Should show version 2, is_active = true

-- ============================================================================
-- TEST 3: Verify analytics.curriculum View
-- ============================================================================
SELECT '=== TEST 3: Curriculum View Content ===' as test_section;

SELECT
  subject,
  COUNT(DISTINCT unit_id) as units,
  COUNT(DISTINCT skill_id) as skills,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum`
WHERE subject = 'Language Arts'
GROUP BY subject;

-- Expected: Should show 10 units, 36 skills, 264 subskills (7 old + 3 new units)

-- ============================================================================
-- TEST 4: Verify All 10 Units Are Visible
-- ============================================================================
SELECT '=== TEST 4: All Units Visible ===' as test_section;

SELECT
  unit_id,
  unit_title,
  COUNT(DISTINCT skill_id) as skills,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum`
WHERE subject = 'Language Arts'
GROUP BY unit_id, unit_title
ORDER BY unit_id;

-- Expected: Should show all 10 units (LA001-LA007 + the 3 new ones)

-- ============================================================================
-- TEST 5: Verify learning_paths Table
-- ============================================================================
SELECT '=== TEST 5: Learning Paths Content ===' as test_section;

-- Check if Language Arts prerequisites are in learning_paths
SELECT
  'Language Arts' as subject,
  COUNT(*) as total_prerequisite_relationships,
  COUNT(CASE WHEN is_base_node THEN 1 END) as base_nodes
FROM `mountamo-tutor-h7wnta.analytics.learning_paths`
WHERE prerequisite_skill_id LIKE 'LANGUAGE_ARTS%'
   OR unlocks_skill_id LIKE 'LANGUAGE_ARTS%';

-- Expected: Should show > 0 relationships

-- ============================================================================
-- TEST 6: Verify Mathematics Curriculum (Unchanged)
-- ============================================================================
SELECT '=== TEST 6: Mathematics Curriculum (Control Group) ===' as test_section;

SELECT
  subject,
  COUNT(DISTINCT unit_id) as units,
  COUNT(DISTINCT skill_id) as skills,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum`
WHERE subject = 'Mathematics'
GROUP BY subject;

-- Expected: Should match previous counts (this verifies we didn't break existing data)

-- ============================================================================
-- TEST 7: Check for Version_id Orphans
-- ============================================================================
SELECT '=== TEST 7: Check for Orphaned Version IDs ===' as test_section;

-- Find any prerequisites that reference entities that don't exist
-- Using LEFT JOIN approach to avoid correlated subquery issues
WITH all_entities AS (
  -- Get all valid skill IDs
  SELECT skill_id as entity_id, 'skill' as entity_type
  FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
  UNION ALL
  -- Get all valid subskill IDs
  SELECT subskill_id as entity_id, 'subskill' as entity_type
  FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
)
SELECT
  'Orphaned Prerequisites' as issue_type,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
LEFT JOIN all_entities e
  ON p.prerequisite_entity_id = e.entity_id
  AND p.prerequisite_entity_type = e.entity_type
WHERE e.entity_id IS NULL;

-- Expected: 0 (no orphans)

-- ============================================================================
-- TEST 8: Verify All Active Versions
-- ============================================================================
SELECT '=== TEST 8: All Active Versions ===' as test_section;

SELECT
  subject_id,
  version_number,
  description,
  is_active,
  activated_at
FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
WHERE is_active = true
ORDER BY subject_id;

-- Expected: Should show MATHEMATICS (version 4) and LANGUAGE_ARTS (version 2)

-- ============================================================================
-- TEST 9: Verify Subject-Level Consistency
-- ============================================================================
SELECT '=== TEST 9: Subject-Level Version Consistency ===' as test_section;

-- Check that subject's version_id matches its active version in curriculum_versions
SELECT
  s.subject_id,
  s.version_id as subject_version_id,
  v.version_id as active_version_id,
  CASE
    WHEN s.version_id = v.version_id THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as status
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_versions` v
  ON s.subject_id = v.subject_id AND v.is_active = true
WHERE s.is_active = true AND s.is_draft = false;

-- Expected: All should show 'MATCH ✓'

-- ============================================================================
-- TEST 10: Verify No Dangling Old Version Data
-- ============================================================================
SELECT '=== TEST 10: No Dangling Old Version Data ===' as test_section;

-- Check if old version_id (1fd72ad8-347e-45d5-9b4c-3d1c01f3d211) still exists in any tables
SELECT
  'Units' as table_name,
  COUNT(*) as old_version_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
WHERE version_id = '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211'

UNION ALL

SELECT
  'Skills' as table_name,
  COUNT(*) as old_version_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
WHERE version_id = '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211'

UNION ALL

SELECT
  'Subskills' as table_name,
  COUNT(*) as old_version_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
WHERE version_id = '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211'

UNION ALL

SELECT
  'Prerequisites' as table_name,
  COUNT(*) as old_version_count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites`
WHERE version_id = '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211';

-- Expected: All should show 0 (old version data migrated)

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT '=== SUMMARY ===' as test_section;

SELECT
  'Total Subjects' as metric,
  CAST(COUNT(DISTINCT subject) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.curriculum`

UNION ALL

SELECT
  'Total Units' as metric,
  CAST(COUNT(DISTINCT unit_id) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.curriculum`

UNION ALL

SELECT
  'Total Skills' as metric,
  CAST(COUNT(DISTINCT skill_id) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.curriculum`

UNION ALL

SELECT
  'Total Subskills' as metric,
  CAST(COUNT(DISTINCT subskill_id) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.curriculum`

UNION ALL

SELECT
  'Total Learning Path Relationships' as metric,
  CAST(COUNT(*) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.learning_paths`

UNION ALL

SELECT
  'Active Versions' as metric,
  CAST(COUNT(*) AS STRING) as value
FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
WHERE is_active = true;

-- ============================================================================
-- All tests completed!
-- Review results above to ensure all fixes were applied correctly.
-- ============================================================================
