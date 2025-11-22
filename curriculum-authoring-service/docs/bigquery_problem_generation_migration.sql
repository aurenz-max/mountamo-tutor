-- BigQuery Migration Scripts for Production-Grade Problem Generation
-- Execute these in order in BigQuery console

-- ============================================================================
-- 1. ALTER curriculum_problems TABLE - Add new columns for enhanced problem data
-- ============================================================================

-- Add visual_data column to store generated visual content
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS visual_data JSON OPTIONS(description='Generated visual content including scenes, objects, and interactions');

-- Add live_interaction_config column for AI coach configuration
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS live_interaction_config JSON OPTIONS(description='AI coach configuration with prompts, targets, and feedback');

-- Add generation_metadata column to track generation context
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS generation_metadata JSON OPTIONS(description='Metadata about problem generation including models used, primitives sampled, and phase IDs');

-- Add rationale column for pedagogical reasoning
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS rationale STRING OPTIONS(description='Detailed explanation of why this problem tests the target skill');

-- Add teaching_note column for educator guidance
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS teaching_note STRING OPTIONS(description='Guidance for educators on how to support students with this problem');

-- Add success_criteria column for learning expectations
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
ADD COLUMN IF NOT EXISTS success_criteria STRING OPTIONS(description='Clear criteria describing what successful completion looks like');


-- ============================================================================
-- 2. CREATE problem_generation_phases TABLE - Track each generation phase
-- ============================================================================

CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.problem_generation_phases` (
  -- Primary identification
  phase_id STRING NOT NULL OPTIONS(description='Unique identifier for this phase execution'),
  problem_id STRING OPTIONS(description='ID of the generated problem (may be null for type_selection phase)'),
  subskill_id STRING NOT NULL OPTIONS(description='Subskill for which problems are being generated'),

  -- Phase details
  phase_type STRING NOT NULL OPTIONS(description='Type of generation phase: type_selection, generation, visual_generation'),
  phase_number INT64 NOT NULL OPTIONS(description='Order of phase execution: 1, 2, or 3'),
  problem_type STRING OPTIONS(description='Problem type being generated (null for type_selection phase)'),

  -- Prompt tracking
  prompt_template_id STRING OPTIONS(description='ID of the prompt template used'),
  prompt_version INT64 OPTIONS(description='Version number of the prompt template'),
  rendered_prompt STRING OPTIONS(description='Full rendered prompt sent to LLM with all variables substituted'),

  -- LLM details
  model_used STRING NOT NULL OPTIONS(description='Gemini model used: gemini-flash-latest, gemini-flash-lite-latest, etc.'),
  temperature FLOAT64 OPTIONS(description='Temperature parameter used for generation'),

  -- Response data
  response_raw JSON OPTIONS(description='Raw LLM response before parsing'),
  response_parsed JSON OPTIONS(description='Parsed and validated response data'),

  -- Context and metadata
  context_primitives JSON OPTIONS(description='Sampled context primitives (objects, characters, scenarios, locations)'),
  learning_objectives JSON OPTIONS(description='Learning objectives and misconceptions addressed'),
  metadata JSON OPTIONS(description='Additional metadata (execution time, retry count, etc.)'),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description='When this phase was executed'),

  -- Performance tracking
  tokens_used INT64 OPTIONS(description='Total tokens used in this phase'),
  execution_time_ms INT64 OPTIONS(description='Time taken to execute this phase in milliseconds'),
  success BOOL DEFAULT TRUE OPTIONS(description='Whether this phase completed successfully')
)
OPTIONS(
  description='Tracks each phase of problem generation for analysis and iteration'
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_phases_subskill
ON `mountamo-tutor-h7wnta.analytics.problem_generation_phases`(subskill_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phases_problem
ON `mountamo-tutor-h7wnta.analytics.problem_generation_phases`(problem_id);

CREATE INDEX IF NOT EXISTS idx_phases_template
ON `mountamo-tutor-h7wnta.analytics.problem_generation_phases`(prompt_template_id, prompt_version);


-- ============================================================================
-- 3. CREATE prompt_performance_metrics TABLE - Track prompt effectiveness
-- ============================================================================

CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics` (
  -- Primary identification
  metric_id STRING NOT NULL OPTIONS(description='Unique identifier for this metric record'),
  prompt_template_id STRING NOT NULL OPTIONS(description='ID of the prompt template being evaluated'),
  prompt_version INT64 NOT NULL OPTIONS(description='Version of the prompt template'),

  -- Context
  subskill_id STRING OPTIONS(description='Subskill context for this evaluation'),
  problem_type STRING OPTIONS(description='Problem type generated with this prompt'),
  phase_type STRING OPTIONS(description='Generation phase: type_selection, generation, visual_generation'),

  -- Evaluation data
  evaluation_score FLOAT64 OPTIONS(description='Overall quality score (0.0-1.0 or 0-100 depending on evaluator)'),
  evaluator_type STRING NOT NULL OPTIONS(description='Source of evaluation: educator, llm, student_performance, automated'),
  evaluator_id STRING OPTIONS(description='ID of the specific evaluator (user_id, model_name, etc.)'),

  -- Feedback
  feedback_summary STRING OPTIONS(description='Summarized feedback on prompt effectiveness'),
  feedback_details JSON OPTIONS(description='Detailed structured feedback with specific issues and suggestions'),

  -- Metrics
  problems_generated INT64 OPTIONS(description='Number of problems generated with this prompt version'),
  problems_evaluated INT64 OPTIONS(description='Number of problems from this prompt that have been evaluated'),
  avg_problem_quality FLOAT64 OPTIONS(description='Average quality score across evaluated problems'),

  -- Student performance metrics (when available)
  avg_student_success_rate FLOAT64 OPTIONS(description='Average success rate of students on problems from this prompt'),
  avg_time_to_solve_seconds INT64 OPTIONS(description='Average time students take to solve problems from this prompt'),

  -- Improvement tracking
  comparison_to_previous_version FLOAT64 OPTIONS(description='Improvement score compared to previous version (positive = better)'),
  suggested_improvements JSON OPTIONS(description='Structured suggestions for next iteration'),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS(description='When this metric was recorded'),
  evaluation_period_start TIMESTAMP OPTIONS(description='Start of evaluation period for student performance metrics'),
  evaluation_period_end TIMESTAMP OPTIONS(description='End of evaluation period for student performance metrics')
)
OPTIONS(
  description='Tracks performance and effectiveness of prompt templates for iterative improvement'
);

-- Create indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_metrics_template
ON `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`(prompt_template_id, prompt_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_subskill
ON `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`(subskill_id, phase_type);

CREATE INDEX IF NOT EXISTS idx_metrics_evaluator
ON `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`(evaluator_type, created_at DESC);


-- ============================================================================
-- 4. ALTER prompt_templates TABLE - Add phase_type for organization
-- ============================================================================

-- Add phase_type to categorize templates by generation phase
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_templates`
ADD COLUMN IF NOT EXISTS phase_type STRING OPTIONS(description='Generation phase this template is for: type_selection, generation, visual_generation');

-- Add model_recommendation for template optimization
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_templates`
ADD COLUMN IF NOT EXISTS model_recommendation STRING OPTIONS(description='Recommended Gemini model for this template: gemini-flash-latest or gemini-flash-lite-latest');

-- Add complexity_level for model selection logic
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_templates`
ADD COLUMN IF NOT EXISTS complexity_level STRING OPTIONS(description='Template complexity: simple, medium, complex - determines model selection');


-- ============================================================================
-- 5. CREATE VIEWS for analysis and monitoring
-- ============================================================================

-- View: Recent problem generation with all phases
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_recent_problem_generation` AS
SELECT
  p.problem_id,
  p.subskill_id,
  p.problem_type,
  p.difficulty,
  p.created_at,

  -- Type selection phase
  (SELECT phase_id FROM `mountamo-tutor-h7wnta.analytics.problem_generation_phases`
   WHERE subskill_id = p.subskill_id AND phase_type = 'type_selection'
   ORDER BY created_at DESC LIMIT 1) as type_selection_phase_id,

  -- Generation phase
  (SELECT phase_id FROM `mountamo-tutor-h7wnta.analytics.problem_generation_phases`
   WHERE problem_id = p.problem_id AND phase_type = 'generation' LIMIT 1) as generation_phase_id,

  -- Visual generation phase
  (SELECT phase_id FROM `mountamo-tutor-h7wnta.analytics.problem_generation_phases`
   WHERE problem_id = p.problem_id AND phase_type = 'visual_generation' LIMIT 1) as visual_phase_id,

  -- Has visuals
  CASE WHEN p.visual_data IS NOT NULL THEN TRUE ELSE FALSE END as has_visuals,

  -- Has AI coach
  CASE WHEN p.live_interaction_config IS NOT NULL THEN TRUE ELSE FALSE END as has_ai_coach

FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems` p
WHERE p.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY p.created_at DESC;


-- View: Prompt performance summary
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_prompt_performance_summary` AS
SELECT
  pt.template_name,
  pt.template_type,
  pt.version,
  pt.is_active,

  COUNT(DISTINCT pm.metric_id) as evaluation_count,
  AVG(pm.evaluation_score) as avg_score,
  AVG(pm.avg_problem_quality) as avg_problem_quality,
  AVG(pm.avg_student_success_rate) as avg_student_success,

  COUNT(DISTINCT pgp.phase_id) as times_used,
  AVG(pgp.execution_time_ms) as avg_execution_time_ms,

  pt.updated_at as last_template_update

FROM `mountamo-tutor-h7wnta.analytics.prompt_templates` pt
LEFT JOIN `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics` pm
  ON pt.template_id = pm.prompt_template_id AND pt.version = pm.prompt_version
LEFT JOIN `mountamo-tutor-h7wnta.analytics.problem_generation_phases` pgp
  ON pt.template_id = pgp.prompt_template_id AND pt.version = pgp.prompt_version

GROUP BY
  pt.template_name, pt.template_type, pt.version, pt.is_active, pt.updated_at
ORDER BY pt.template_name, pt.version DESC;


-- ============================================================================
-- 6. SAMPLE DATA QUERIES - Use these to verify migration
-- ============================================================================

-- Check new columns in curriculum_problems
-- SELECT problem_id, problem_type,
--        visual_data IS NOT NULL as has_visual_data,
--        live_interaction_config IS NOT NULL as has_ai_coach,
--        generation_metadata IS NOT NULL as has_metadata
-- FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems`
-- LIMIT 10;

-- Check problem_generation_phases structure
-- SELECT * FROM `mountamo-tutor-h7wnta.analytics.problem_generation_phases`
-- ORDER BY created_at DESC
-- LIMIT 5;

-- Check prompt_performance_metrics structure
-- SELECT * FROM `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
-- ORDER BY created_at DESC
-- LIMIT 5;


-- ============================================================================
-- NOTES FOR EXECUTION
-- ============================================================================

-- Project: mountamo-tutor-h7wnta
-- Dataset: analytics

-- 1. Execute sections 1-4 in order
-- 2. Section 5 (views) can be executed after tables are created
-- 3. Verify with section 6 sample queries
-- 4. The ALTER TABLE commands are safe to run multiple times (IF NOT EXISTS)
-- 5. Backup your curriculum_problems table before running migrations

-- Migration checklist:
-- [ ] Backed up curriculum_problems table
-- [ ] Executed ALTER TABLE commands (section 1)
-- [ ] Created problem_generation_phases table (section 2)
-- [ ] Created prompt_performance_metrics table (section 3)
-- [ ] Updated prompt_templates table (section 4)
-- [ ] Created analysis views (section 5)
-- [ ] Verified with sample queries (section 6)
