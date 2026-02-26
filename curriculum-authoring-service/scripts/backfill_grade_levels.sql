-- Backfill grade_level for existing curriculum subjects
-- All current subjects are Kindergarten level
--
-- Run these statements in the BigQuery console.
-- Replace PROJECT_ID with your actual GCP project ID (e.g., mountamo-tutor-h7wnta).

-- 1. Update curriculum_subjects in the authoring dataset
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
SET grade_level = 'Kindergarten',
    updated_at = CURRENT_TIMESTAMP()
WHERE grade_level IS NULL;

-- 2. Update the analytics curriculum table (if it exists)
UPDATE `mountamo-tutor-h7wnta.analytics.curriculum`
SET grade = 'Kindergarten'
WHERE grade IS NULL;
