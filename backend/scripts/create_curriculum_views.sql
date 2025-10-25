-- backend/scripts/create_curriculum_views.sql
--
-- Creates read-only compatibility views and tables that allow existing services
-- to consume curriculum data from the new normalized curriculum tables without code changes.
--
-- This script creates:
-- 1. analytics.curriculum (VIEW) - Backward-compatible flat curriculum structure
-- 2. analytics.learning_paths (TABLE) - Skill-level prerequisite decision tree
-- 3. analytics.v_subskill_prerequisites (VIEW) - Granular prerequisite data for advanced features
--
-- Run this once to set up the views, then refresh via ETL script.
--
-- IMPORTANT: This script will DROP and recreate analytics.curriculum and analytics.learning_paths.
-- If you want to preserve the old data, manually backup these tables before running this script.

-- ============================================================================
-- 1. CURRICULUM COMPATIBILITY VIEW
-- ============================================================================
-- Replicates the old flat curriculum table structure by joining the new
-- normalized curriculum tables. Only shows published, active curriculum.

-- Create the view
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.curriculum` AS
SELECT
  s.subject_name as subject,
  s.grade_level as grade,
  u.unit_id,
  u.unit_title,
  u.unit_order,
  sk.skill_id,
  sk.skill_description,
  sk.skill_order,
  sub.subskill_id,
  sub.subskill_description,
  sub.subskill_order,
  sub.difficulty_start,
  sub.difficulty_end,
  sub.target_difficulty
FROM `mountamo-tutor-h7wnta.analytics.curriculum_subjects` s
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_units` u
  ON s.subject_id = u.subject_id AND s.version_id = u.version_id
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk
  ON u.unit_id = sk.unit_id AND u.version_id = sk.version_id
JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subskills` sub
  ON sk.skill_id = sub.skill_id AND sk.version_id = sub.version_id
WHERE s.is_active = true       -- Only active published curriculum
  AND s.is_draft = false       -- No drafts
  AND u.is_draft = false
  AND sk.is_draft = false
  AND sub.is_draft = false
ORDER BY u.unit_order, sk.skill_order, sub.subskill_order;


-- ============================================================================
-- 2. LEARNING PATHS COMPATIBILITY TABLE
-- ============================================================================
-- Derives prerequisite relationships from analytics.curriculum_prerequisites.
-- Includes both skill-level and subskill-level prerequisites.
-- This replicates the decision tree structure used by the learning_paths service.
-- Note: This is a TABLE (not a view) for performance - refresh via ETL.

CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.learning_paths` AS
WITH active_prerequisites AS (
  -- Get all active prerequisites
  SELECT
    prerequisite_entity_id,
    unlocks_entity_id,
    min_proficiency_threshold,
    version_id
  FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites`
  WHERE is_draft = false
    AND version_id IN (
      SELECT version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
      WHERE is_active = true
    )
),
entities_with_prerequisites AS (
  -- Find all entities that are unlocked by something (i.e., have prerequisites)
  SELECT DISTINCT unlocks_entity_id
  FROM active_prerequisites
)
SELECT DISTINCT
  p.prerequisite_entity_id as prerequisite_skill_id,
  p.unlocks_entity_id as unlocks_skill_id,
  p.min_proficiency_threshold as min_score_threshold,
  -- Mark base nodes (entities with no prerequisites - nothing unlocks them)
  CASE WHEN ep.unlocks_entity_id IS NULL THEN true ELSE false END as is_base_node,
  CURRENT_TIMESTAMP() as sync_timestamp
FROM active_prerequisites p
LEFT JOIN entities_with_prerequisites ep
  ON p.prerequisite_entity_id = ep.unlocks_entity_id;


-- ============================================================================
-- 3. SUBSKILL PREREQUISITES VIEW (NEW - for advanced recommendations)
-- ============================================================================
-- Provides granular prerequisite data at both skill and subskill level.
-- Used for advanced features like prerequisite-aware recommendations.

CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_subskill_prerequisites` AS
SELECT
  p.prerequisite_id,
  p.prerequisite_entity_id,
  p.prerequisite_entity_type,
  p.unlocks_entity_id,
  p.unlocks_entity_type,
  p.min_proficiency_threshold,
  -- Join to get readable names for prerequisites
  CASE
    WHEN p.prerequisite_entity_type = 'skill' THEN sk1.skill_description
    WHEN p.prerequisite_entity_type = 'subskill' THEN ss1.subskill_description
    ELSE NULL
  END as prerequisite_description,
  -- Join to get readable names for unlocked items
  CASE
    WHEN p.unlocks_entity_type = 'skill' THEN sk2.skill_description
    WHEN p.unlocks_entity_type = 'subskill' THEN ss2.subskill_description
    ELSE NULL
  END as unlocks_description
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk1
  ON p.prerequisite_entity_id = sk1.skill_id
  AND p.prerequisite_entity_type = 'skill'
  AND p.version_id = sk1.version_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subskills` ss1
  ON p.prerequisite_entity_id = ss1.subskill_id
  AND p.prerequisite_entity_type = 'subskill'
  AND p.version_id = ss1.version_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_skills` sk2
  ON p.unlocks_entity_id = sk2.skill_id
  AND p.unlocks_entity_type = 'skill'
  AND p.version_id = sk2.version_id
LEFT JOIN `mountamo-tutor-h7wnta.analytics.curriculum_subskills` ss2
  ON p.unlocks_entity_id = ss2.subskill_id
  AND p.unlocks_entity_type = 'subskill'
  AND p.version_id = ss2.version_id
WHERE p.is_draft = false
  AND p.version_id IN (
    SELECT version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
    WHERE is_active = true
  );


-- ============================================================================
-- VERIFICATION QUERIES (Run these to validate the views)
-- ============================================================================

-- Count subskills in curriculum view
SELECT COUNT(*) as total_subskills, COUNT(DISTINCT subject) as subjects
FROM `mountamo-tutor-h7wnta.analytics.curriculum`;

-- Count learning path relationships
SELECT
  COUNT(*) as total_relationships,
  COUNT(CASE WHEN is_base_node THEN 1 END) as base_skills
FROM `mountamo-tutor-h7wnta.analytics.learning_paths`;

-- Count prerequisites by type
SELECT
  prerequisite_entity_type,
  unlocks_entity_type,
  COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.v_subskill_prerequisites`
GROUP BY prerequisite_entity_type, unlocks_entity_type;
