-- ============================================================================
-- Fix Language Arts Version ID Mismatch
-- ============================================================================
-- This script migrates the 3 new Language Arts units from the incorrect
-- version_id (1fd72ad8-347e-45d5-9b4c-3d1c01f3d211) to the correct version_id
-- (1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32) to match the Language Arts subject.
--
-- Run this script once to fix the version mismatch.
-- ============================================================================

-- Set variables for readability
DECLARE old_version_id STRING DEFAULT '1fd72ad8-347e-45d5-9b4c-3d1c01f3d211';
DECLARE new_version_id STRING DEFAULT '1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32';

-- ============================================================================
-- STEP 1: Update Units
-- ============================================================================
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_units`
SET version_id = new_version_id,
    updated_at = CURRENT_TIMESTAMP()
WHERE version_id = old_version_id
  AND subject_id = 'LANGUAGE_ARTS';

-- ============================================================================
-- STEP 2: Update Skills
-- ============================================================================
-- Update skills that belong to units in the old version
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_skills`
SET version_id = new_version_id,
    updated_at = CURRENT_TIMESTAMP()
WHERE version_id = old_version_id
  AND unit_id IN (
    SELECT unit_id
    FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
    WHERE subject_id = 'LANGUAGE_ARTS'
  );

-- ============================================================================
-- STEP 3: Update Subskills
-- ============================================================================
-- Update subskills that belong to skills in the old version
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
SET version_id = new_version_id,
    updated_at = CURRENT_TIMESTAMP()
WHERE version_id = old_version_id
  AND skill_id IN (
    SELECT skill_id
    FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
    WHERE unit_id IN (
      SELECT unit_id
      FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
      WHERE subject_id = 'LANGUAGE_ARTS'
    )
  );

-- ============================================================================
-- STEP 4: Update Prerequisites
-- ============================================================================
-- Update prerequisites that reference Language Arts entities in the old version
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites`
SET version_id = new_version_id
WHERE version_id = old_version_id
  AND (
    -- Prerequisites where either the prerequisite or unlock is a Language Arts skill
    prerequisite_entity_id IN (
      SELECT skill_id
      FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
      WHERE unit_id IN (
        SELECT unit_id
        FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
        WHERE subject_id = 'LANGUAGE_ARTS'
      )
    )
    OR unlocks_entity_id IN (
      SELECT skill_id
      FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
      WHERE unit_id IN (
        SELECT unit_id
        FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
        WHERE subject_id = 'LANGUAGE_ARTS'
      )
    )
    -- Prerequisites where either the prerequisite or unlock is a Language Arts subskill
    OR prerequisite_entity_id IN (
      SELECT subskill_id
      FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
      WHERE skill_id IN (
        SELECT skill_id
        FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
        WHERE unit_id IN (
          SELECT unit_id
          FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
          WHERE subject_id = 'LANGUAGE_ARTS'
        )
      )
    )
    OR unlocks_entity_id IN (
      SELECT subskill_id
      FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills`
      WHERE skill_id IN (
        SELECT skill_id
        FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills`
        WHERE unit_id IN (
          SELECT unit_id
          FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
          WHERE subject_id = 'LANGUAGE_ARTS'
        )
      )
    )
  );

-- ============================================================================
-- STEP 5: Create curriculum_versions entry for Language Arts
-- ============================================================================
INSERT INTO `mountamo-tutor-h7wnta.analytics.curriculum_versions`
  (version_id, subject_id, version_number, description, is_active, created_at, activated_at, created_by, change_summary)
VALUES
  (
    '1e8f0b48-24bd-4d6b-9f60-33d0fc9d6b32',
    'LANGUAGE_ARTS',
    2,
    'Language Arts with New Intro Series',
    true,
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    'migration-script',
    'Consolidated 7 original units with 3 new intro units into unified version'
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all Language Arts units now have the same version_id
SELECT
  'Units version check' as check_name,
  version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_units`
WHERE subject_id = 'LANGUAGE_ARTS'
GROUP BY version_id;

-- Verify all Language Arts skills now have the same version_id
SELECT
  'Skills version check' as check_name,
  sk.version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'LANGUAGE_ARTS'
GROUP BY sk.version_id;

-- Verify all Language Arts subskills now have the same version_id
SELECT
  'Subskills version check' as check_name,
  sub.version_id,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON sub.skill_id = sk.skill_id
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON sk.unit_id = u.unit_id
WHERE u.subject_id = 'LANGUAGE_ARTS'
GROUP BY sub.version_id;

-- Verify curriculum_versions entry was created
SELECT
  'Version entry check' as check_name,
  subject_id,
  version_number,
  description,
  is_active
FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
WHERE subject_id = 'LANGUAGE_ARTS';

-- Final check: Count items in curriculum view
SELECT
  'Curriculum view check' as check_name,
  COUNT(DISTINCT unit_id) as units,
  COUNT(DISTINCT skill_id) as skills,
  COUNT(DISTINCT subskill_id) as subskills
FROM `mountamo-tutor-h7wnta.analytics.curriculum`
WHERE subject = 'Language Arts';
