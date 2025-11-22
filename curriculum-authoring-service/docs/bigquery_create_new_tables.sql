-- ============================================================================
-- CREATE NEW TABLES FOR THREE-PHASE PROBLEM GENERATION
-- ============================================================================
-- Project: mountamo-tutor-h7wnta
-- Dataset: analytics
-- ============================================================================

-- ============================================================================
-- 1. CREATE problem_generation_phases TABLE
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
-- 2. CREATE prompt_performance_metrics TABLE
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
-- 3. UPDATE prompt_templates TABLE (if exists)
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
-- 4. CREATE ANALYSIS VIEWS
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
-- VERIFICATION QUERIES
-- ============================================================================

-- Check problem_generation_phases was created
SELECT 'problem_generation_phases created' as status, COUNT(*) as row_count
FROM `mountamo-tutor-h7wnta.analytics.problem_generation_phases`;

-- Check prompt_performance_metrics was created
SELECT 'prompt_performance_metrics created' as status, COUNT(*) as row_count
FROM `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`;


-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================
-- [ ] Create problem_generation_phases table (section 1)
-- [ ] Create prompt_performance_metrics table (section 2)
-- [ ] Update prompt_templates table if it exists (section 3)
-- [ ] Create analysis views (section 4)
-- [ ] Run verification queries to confirm tables exist
