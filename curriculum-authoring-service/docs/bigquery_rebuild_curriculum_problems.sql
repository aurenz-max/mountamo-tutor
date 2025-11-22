-- ============================================================================
-- REBUILD curriculum_problems TABLE WITH COMPLETE SCHEMA
-- ============================================================================
-- This script creates a new table with all required columns and migrates data
-- Project: mountamo-tutor-h7wnta
-- Dataset: analytics
-- ============================================================================

-- Step 1: Create new table with complete schema
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.curriculum_problems_new` (
  -- Primary identification
  problem_id STRING NOT NULL OPTIONS(description='Unique identifier for this problem'),
  subskill_id STRING NOT NULL OPTIONS(description='Subskill this problem tests'),
  version_id STRING NOT NULL OPTIONS(description='Version of the curriculum'),

  -- Problem structure
  problem_type STRING NOT NULL OPTIONS(description='Type of problem: multiple_choice, true_false, etc.'),
  problem_json JSON NOT NULL OPTIONS(description='Complete problem data structure'),
  difficulty STRING OPTIONS(description='Difficulty level: easy, medium, hard'),

  -- New enhanced fields for production-grade problems
  visual_data JSON OPTIONS(description='Generated visual content including scenes, objects, and interactions'),
  live_interaction_config JSON OPTIONS(description='AI coach configuration with prompts, targets, and feedback'),
  generation_metadata JSON OPTIONS(description='Metadata about problem generation including models used, primitives sampled, and phase IDs'),
  rationale STRING OPTIONS(description='Detailed explanation of why this problem tests the target skill'),
  teaching_note STRING OPTIONS(description='Guidance for educators on how to support students with this problem'),
  success_criteria STRING OPTIONS(description='Clear criteria describing what successful completion looks like'),

  -- Generation tracking
  generation_prompt STRING OPTIONS(description='Full prompt used to generate this problem'),
  generation_model STRING OPTIONS(description='Model used for generation: gemini-2.0-flash-exp, etc.'),
  generation_temperature FLOAT64 OPTIONS(description='Temperature parameter used for generation'),
  generation_timestamp TIMESTAMP OPTIONS(description='When this problem was generated'),
  generation_duration_ms INT64 OPTIONS(description='Time taken to generate this problem in milliseconds'),

  -- Status flags
  is_draft BOOL DEFAULT TRUE OPTIONS(description='Whether this is a draft or finalized'),
  is_active BOOL DEFAULT FALSE OPTIONS(description='Whether this problem is active for student use'),

  -- Metadata and audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description='When this record was created'),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP() OPTIONS(description='When this record was last updated'),
  last_edited_by STRING OPTIONS(description='User ID of last editor'),
  edit_history JSON OPTIONS(description='Array of edit history entries')
)
OPTIONS(
  description='Practice problems with complete generation metadata and visual support'
);

-- Step 2: Copy existing data from old table to new table
INSERT INTO `mountamo-tutor-h7wnta.analytics.curriculum_problems_new` (
  problem_id,
  subskill_id,
  version_id,
  problem_type,
  problem_json,
  difficulty,
  visual_data,
  live_interaction_config,
  generation_metadata,
  rationale,
  teaching_note,
  success_criteria,
  generation_prompt,
  generation_model,
  generation_temperature,
  generation_timestamp,
  generation_duration_ms,
  is_draft,
  is_active,
  created_at,
  updated_at,
  last_edited_by,
  edit_history
)
SELECT
  problem_id,
  subskill_id,
  version_id,
  problem_type,
  problem_json,
  difficulty,
  NULL as visual_data,  -- Will be populated by new generation system
  NULL as live_interaction_config,  -- Will be populated by new generation system
  NULL as generation_metadata,  -- Will be populated by new generation system
  NULL as rationale,  -- Will be populated by new generation system
  NULL as teaching_note,  -- Will be populated by new generation system
  NULL as success_criteria,  -- Will be populated by new generation system
  generation_prompt,
  generation_model,
  generation_temperature,
  generation_timestamp,
  generation_duration_ms,
  is_draft,
  is_active,
  created_at,
  updated_at,
  last_edited_by,
  edit_history
FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems`;

-- Step 3: Verify data migration
-- Uncomment to check row counts match
-- SELECT 'Old table count' as source, COUNT(*) as row_count
-- FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems`
-- UNION ALL
-- SELECT 'New table count' as source, COUNT(*) as row_count
-- FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems_new`;

-- Step 4: Drop old table (CAREFUL - THIS IS DESTRUCTIVE!)
-- Uncomment when you're ready to complete the migration
-- DROP TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`;

-- Step 5: Rename new table to original name
-- Uncomment when you're ready to complete the migration
-- ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems_new`
-- RENAME TO curriculum_problems;


-- ============================================================================
-- ALTERNATIVE: If you want to keep both tables temporarily for safety
-- ============================================================================
-- You can query from curriculum_problems_new directly in your code by updating
-- the table name in settings.py or config, then drop the old table later.


-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================
-- [ ] Step 1: Run CREATE TABLE statement (creates curriculum_problems_new)
-- [ ] Step 2: Run INSERT statement (copies existing data)
-- [ ] Step 3: Uncomment and run verification query (check row counts)
-- [ ] Step 4: Update your application config to use curriculum_problems_new
-- [ ] Step 5: Test the application with new table
-- [ ] Step 6: Once confirmed working, uncomment DROP TABLE
-- [ ] Step 7: Uncomment ALTER TABLE...RENAME to restore original name
-- [ ] Step 8: Update application config back to curriculum_problems


-- ============================================================================
-- ROLLBACK PLAN (if something goes wrong)
-- ============================================================================
-- If you need to rollback before dropping the old table:
-- 1. Just drop curriculum_problems_new:
--    DROP TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems_new`;
-- 2. Your original table remains untouched
--
-- If you already dropped the old table but need to rollback:
-- 1. Use BigQuery time travel to restore (7 days retention):
--    CREATE TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems` AS
--    SELECT * FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems`
--    FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
