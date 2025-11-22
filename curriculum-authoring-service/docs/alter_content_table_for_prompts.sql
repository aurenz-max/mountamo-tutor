-- Alter existing reading content table to add prompt tracking fields
-- Run this to enhance the subskill_reading_content table with generation metadata

-- =================================================================
-- ADD PROMPT TRACKING COLUMNS TO EXISTING TABLE
-- =================================================================

-- Add generation metadata columns
ALTER TABLE `mountamo-tutor-h7wnta.analytics.subskill_reading_content`
ADD COLUMN IF NOT EXISTS generation_prompt STRING,
ADD COLUMN IF NOT EXISTS generation_model STRING,
ADD COLUMN IF NOT EXISTS generation_temperature FLOAT64,
ADD COLUMN IF NOT EXISTS generation_duration_ms INT64,
ADD COLUMN IF NOT EXISTS section_type STRING,  -- INTRODUCTION_MOTIVATION, INTUITIVE_EXPLANATION, etc.
ADD COLUMN IF NOT EXISTS section_generation_metadata JSON;  -- Per-section prompt details

-- Add description to new columns
COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.generation_prompt IS
  'Full prompt sent to LLM for generating this section (for replicability)';

COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.generation_model IS
  'LLM model used for generation (e.g., gemini-2.5-flash)';

COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.generation_temperature IS
  'Temperature parameter used during generation';

COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.generation_duration_ms IS
  'Time taken to generate this section in milliseconds';

COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.section_type IS
  'Type of section: INTRODUCTION_MOTIVATION, INTUITIVE_EXPLANATION, FORMAL_DEFINITION, WORKED_EXAMPLES, COMMON_ERRORS, CONNECTIONS_EXTENSIONS';

COMMENT ON COLUMN `mountamo-tutor-h7wnta.analytics.subskill_reading_content`.section_generation_metadata IS
  'Additional generation metadata: {selected_primitives: [...], context_from_prior_sections: [...], word_count_target: {...}}';

-- =================================================================
-- OPTIONAL: CREATE TABLE FOR COMPLETE CONTENT PACKAGE METADATA
-- =================================================================

-- If you want package-level generation tracking (teaching plan), create this table:
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.content_package_metadata` (
  -- Identifiers
  package_id STRING NOT NULL,
  subskill_id STRING NOT NULL,
  version_id STRING NOT NULL,

  -- Teaching Plan (Tier 1 generation)
  teaching_plan_json JSON,              -- Complete teaching plan from Tier 1
  selected_section_types JSON,          -- Array of section types chosen by LLM
  teaching_plan_prompt STRING,          -- Prompt used for teaching plan
  teaching_plan_model STRING,
  teaching_plan_temperature FLOAT64,

  -- Package-level metadata
  total_sections INT64,
  total_word_count INT64,
  estimated_reading_time_minutes INT64,

  -- Generation timestamps
  package_created_at TIMESTAMP NOT NULL,
  package_completed_at TIMESTAMP,

  -- Status
  is_draft BOOL DEFAULT TRUE,
  is_active BOOL DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY subskill_id, version_id;

ALTER TABLE `mountamo-tutor-h7wnta.analytics.content_package_metadata`
SET OPTIONS (
  description = 'Package-level metadata for reading content including teaching plan generation details'
);

-- =================================================================
-- SAMPLE MIGRATION QUERY
-- =================================================================

-- If you have existing content and want to backfill with placeholder values:
-- UPDATE `mountamo-tutor-h7wnta.analytics.subskill_reading_content`
-- SET
--   generation_model = 'gemini-2.5-flash',  -- or whatever was used
--   generation_temperature = 0.7,
--   generation_prompt = 'LEGACY_CONTENT_NO_PROMPT_STORED'
-- WHERE generation_prompt IS NULL
--   AND created_at < TIMESTAMP('2025-01-01');  -- Before prompt tracking was added
