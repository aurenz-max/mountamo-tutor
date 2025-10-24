-- Fix: Update curriculum_subjects to use the correct active version_id for MATHEMATICS
-- This fixes the mismatch between curriculum_versions and curriculum_subjects

-- Current state:
--   curriculum_versions.version_id (active): 208bf195-c257-4112-908f-2e51efe7eba9
--   curriculum_subjects.version_id (incorrect): 9251cfe5-1f23-4f9e-af1c-323620057d4f
--   curriculum_prerequisites.version_id: 208bf195-c257-4112-908f-2e51efe7eba9

UPDATE `mountamo-tutor-h7wnta.analytics.curriculum_subjects`
SET version_id = '208bf195-c257-4112-908f-2e51efe7eba9'
WHERE subject_id = 'MATHEMATICS';
