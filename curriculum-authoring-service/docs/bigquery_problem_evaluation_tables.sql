-- BigQuery Table Schemas for Problem Generation and Evaluation System
-- Run these CREATE TABLE statements in your BigQuery dataset

-- =================================================================
-- PROBLEMS TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.curriculum_problems` (
  -- Identifiers
  problem_id STRING NOT NULL,
  subskill_id STRING NOT NULL,
  version_id STRING NOT NULL,

  -- Problem Content
  problem_type STRING NOT NULL,  -- 'multiple_choice', 'true_false', 'fill_in_blanks', etc.
  problem_json JSON NOT NULL,    -- Complete problem structure

  -- Generation Metadata (for replicability)
  generation_prompt STRING,          -- Full prompt sent to LLM
  generation_model STRING,           -- e.g., "gemini-2.5-flash"
  generation_temperature FLOAT64,    -- e.g., 0.7
  generation_timestamp TIMESTAMP,
  generation_duration_ms INT64,      -- Time taken to generate

  -- Status and workflow
  is_draft BOOL DEFAULT TRUE,
  is_active BOOL DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_edited_by STRING,
  edit_history JSON  -- Track manual edits: [{timestamp, user, changes}]
)
PARTITION BY DATE(created_at)
CLUSTER BY subskill_id, version_id, problem_type;

-- Add description
ALTER TABLE `mountamo-tutor-h7wnta.analytics.curriculum_problems`
SET OPTIONS (
  description = 'Practice problems for subskills with full generation metadata for replicability'
);

-- =================================================================
-- PROBLEM EVALUATIONS TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.problem_evaluations` (
  -- Identifiers
  evaluation_id STRING NOT NULL,
  problem_id STRING NOT NULL,
  evaluation_timestamp TIMESTAMP NOT NULL,

  -- Tier 1: Structural Validation
  tier1_passed BOOL,
  tier1_issues JSON,  -- Array of issue descriptions
  required_fields_present BOOL,
  valid_enums BOOL,
  valid_types BOOL,
  visual_intent_valid BOOL,

  -- Tier 2: Heuristics
  tier2_passed BOOL,
  readability_score FLOAT64,
  readability_appropriate BOOL,
  has_placeholders BOOL,
  total_char_count INT64,
  word_count INT64,

  -- Visual Coherence
  visual_coherence_passed BOOL,
  max_char_count INT64,
  longest_word_length INT64,
  max_line_breaks INT64,
  has_overflow_risk BOOL,
  has_forbidden_content BOOL,
  tier2_issues JSON,  -- Array of warnings and failures

  -- Tier 3: LLM Judge
  pedagogical_approach_score INT64,     -- 1-10
  pedagogical_approach_justification STRING,
  alignment_score INT64,                -- 1-10
  alignment_justification STRING,
  clarity_score INT64,                  -- 1-10
  clarity_justification STRING,
  correctness_score INT64,              -- 1-10
  correctness_justification STRING,
  bias_score INT64,                     -- 1-10
  bias_justification STRING,

  llm_reasoning STRING,                 -- Overall reasoning
  llm_overall_quality STRING,           -- 'excellent', 'good', 'needs_revision', 'unacceptable'
  llm_recommended_action STRING,        -- 'approve', 'approve_with_suggestions', 'revise', 'reject'
  llm_suggestions JSON,                 -- Array of improvement suggestions

  -- LLM Evaluation Metadata (for replicability)
  evaluation_prompt STRING,             -- Full prompt sent to LLM judge
  evaluation_model STRING,              -- e.g., "gemini-flash"
  evaluation_temperature FLOAT64,       -- e.g., 0.3

  -- Final Results
  final_recommendation STRING,          -- 'approve', 'revise', 'reject'
  overall_score FLOAT64,                -- Composite score 0-10

  -- Complete Report
  evaluation_report_json JSON           -- Full EvaluationReport object
)
PARTITION BY DATE(evaluation_timestamp)
CLUSTER BY problem_id, final_recommendation;

-- Add description
ALTER TABLE `mountamo-tutor-h7wnta.analytics.problem_evaluations`
SET OPTIONS (
  description = 'Three-tier evaluation results for practice problems with LLM judge metadata'
);

-- =================================================================
-- CONTENT EVALUATIONS TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.content_evaluations` (
  -- Identifiers
  evaluation_id STRING NOT NULL,
  subskill_id STRING NOT NULL,
  version_id STRING NOT NULL,
  evaluation_timestamp TIMESTAMP NOT NULL,

  -- Package-level identifiers
  content_package_id STRING,  -- Reference to reading content package

  -- Tier 1: Readability Validation
  tier1_passed BOOL,
  avg_readability_score FLOAT64,       -- Average Flesch-Kincaid across sections
  grade_level_appropriate BOOL,
  readability_issues JSON,             -- Array of issues per section

  -- Section-level readability
  section_readability_scores JSON,     -- [{section_id, score, appropriate}]

  -- Tier 2: Content Quality Heuristics
  tier2_passed BOOL,
  section_word_counts JSON,            -- [{section_id, section_type, word_count, compliant}]
  primitive_count INT64,               -- Total interactive primitives
  visual_snippet_count INT64,          -- Total visual snippets
  min_primitives_met BOOL,             -- At least 2-3 primitives?
  tier2_issues JSON,                   -- Array of warnings and failures

  -- Tier 3: LLM Pedagogical Assessment
  coverage_score INT64,                -- 1-10: Do sections cover all objectives?
  coverage_justification STRING,
  engagement_score INT64,              -- 1-10: Age-appropriate examples?
  engagement_justification STRING,
  coherence_score INT64,               -- 1-10: Logical flow between sections?
  coherence_justification STRING,
  accuracy_score INT64,                -- 1-10: Factually correct?
  accuracy_justification STRING,
  inclusivity_score INT64,             -- 1-10: Diverse, bias-free examples?
  inclusivity_justification STRING,

  llm_reasoning STRING,                -- Overall reasoning
  llm_overall_quality STRING,          -- 'excellent', 'good', 'needs_revision', 'unacceptable'
  llm_recommended_action STRING,       -- 'approve', 'approve_with_suggestions', 'revise', 'reject'
  llm_suggestions JSON,                -- Array of improvement suggestions

  -- LLM Evaluation Metadata (for replicability)
  evaluation_prompt STRING,            -- Full prompt sent to LLM judge
  evaluation_model STRING,             -- e.g., "gemini-2.5-flash"
  evaluation_temperature FLOAT64,      -- e.g., 0.3

  -- Final Results
  final_recommendation STRING,         -- 'approve', 'revise', 'reject'
  overall_score FLOAT64,               -- Composite score 0-10

  -- Complete Report
  evaluation_report_json JSON          -- Full evaluation report
)
PARTITION BY DATE(evaluation_timestamp)
CLUSTER BY subskill_id, version_id, final_recommendation;

-- Add description
ALTER TABLE `mountamo-tutor-h7wnta.analytics.content_evaluations`
SET OPTIONS (
  description = 'Pedagogical evaluation results for reading content packages with LLM judge metadata'
);

-- =================================================================
-- PROMPT TEMPLATES TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.prompt_templates` (
  -- Identifiers
  template_id STRING NOT NULL,
  template_name STRING NOT NULL,      -- e.g., "problem_generation_v3"
  template_type STRING NOT NULL,      -- 'problem_generation', 'content_generation', 'problem_evaluation', 'content_evaluation'

  -- Template Content
  template_text STRING NOT NULL,      -- The actual prompt template with placeholders
  template_variables JSON,            -- List of required variables: ["subskill_id", "grade_level"]

  -- Version Control
  version INT64 NOT NULL,
  is_active BOOL DEFAULT FALSE,       -- Only one active version per template_name

  -- Performance Metrics
  usage_count INT64 DEFAULT 0,
  avg_evaluation_score FLOAT64,      -- Average overall_score from evaluations
  approval_rate FLOAT64,              -- % of content approved using this prompt
  performance_metrics JSON,           -- Detailed metrics per dimension

  -- Metadata
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_by STRING,
  change_notes STRING                 -- Why this version was created
)
PARTITION BY DATE(created_at)
CLUSTER BY template_name, template_type, is_active;

-- Add description
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_templates`
SET OPTIONS (
  description = 'Versioned prompt templates for content and evaluation with performance tracking'
);

-- =================================================================
-- INDEXES / VIEWS (For better query performance)
-- =================================================================

-- View: Problems with their latest evaluation
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.problems_with_latest_evaluation` AS
SELECT
  p.*,
  e.evaluation_id,
  e.evaluation_timestamp,
  e.tier1_passed,
  e.tier2_passed,
  e.pedagogical_approach_score,
  e.alignment_score,
  e.clarity_score,
  e.correctness_score,
  e.bias_score,
  e.final_recommendation,
  e.overall_score
FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems` p
LEFT JOIN LATERAL (
  SELECT *
  FROM `mountamo-tutor-h7wnta.analytics.problem_evaluations` e
  WHERE e.problem_id = p.problem_id
  ORDER BY e.evaluation_timestamp DESC
  LIMIT 1
) e;

-- View: Content packages with their latest evaluation
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.content_with_latest_evaluation` AS
SELECT
  c.subskill_id,
  c.version_id,
  COUNT(DISTINCT c.section_id) as section_count,
  SUM(CASE WHEN c.has_visual_snippet THEN 1 ELSE 0 END) as visual_count,
  e.evaluation_id,
  e.evaluation_timestamp,
  e.tier1_passed,
  e.tier2_passed,
  e.coverage_score,
  e.engagement_score,
  e.coherence_score,
  e.accuracy_score,
  e.inclusivity_score,
  e.final_recommendation,
  e.overall_score
FROM `mountamo-tutor-h7wnta.analytics.subskill_reading_content` c
LEFT JOIN LATERAL (
  SELECT *
  FROM `mountamo-tutor-h7wnta.analytics.content_evaluations` e
  WHERE e.subskill_id = c.subskill_id AND e.version_id = c.version_id
  ORDER BY e.evaluation_timestamp DESC
  LIMIT 1
) e
GROUP BY c.subskill_id, c.version_id, e.evaluation_id, e.evaluation_timestamp,
         e.tier1_passed, e.tier2_passed, e.coverage_score, e.engagement_score,
         e.coherence_score, e.accuracy_score, e.inclusivity_score,
         e.final_recommendation, e.overall_score;

-- View: Prompt performance summary
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.prompt_performance_summary` AS
SELECT
  pt.template_name,
  pt.template_type,
  pt.version,
  pt.is_active,
  pt.usage_count,
  pt.avg_evaluation_score,
  pt.approval_rate,
  pt.created_at,
  pt.created_by,
  pt.change_notes
FROM `mountamo-tutor-h7wnta.analytics.prompt_templates` pt
ORDER BY pt.template_name, pt.version DESC;

-- View: Content quality dashboard (all content by subskill with status)
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.content_quality_dashboard` AS
SELECT
  s.subskill_id,
  s.skill_id,
  s.description as subskill_description,
  s.version_id,

  -- Reading content stats
  COALESCE(rc.section_count, 0) as reading_sections,
  COALESCE(rc.visual_count, 0) as visual_snippets,
  rc.coverage_score as reading_coverage_score,
  rc.overall_score as reading_overall_score,
  rc.final_recommendation as reading_recommendation,

  -- Problem stats
  COALESCE(prob.problem_count, 0) as problem_count,
  COALESCE(prob.approved_count, 0) as problems_approved,
  COALESCE(prob.avg_problem_score, 0) as avg_problem_score,

  -- Overall status
  CASE
    WHEN rc.final_recommendation = 'approve' AND prob.approved_count >= 5 THEN 'ready_to_publish'
    WHEN rc.final_recommendation = 'revise' OR prob.approved_count < 5 THEN 'needs_work'
    WHEN rc.final_recommendation IS NULL OR prob.problem_count = 0 THEN 'incomplete'
    ELSE 'in_progress'
  END as overall_status

FROM `mountamo-tutor-h7wnta.analytics.curriculum_subskills` s

-- Join with content evaluation
LEFT JOIN `mountamo-tutor-h7wnta.analytics.content_with_latest_evaluation` rc
  ON s.subskill_id = rc.subskill_id AND s.version_id = rc.version_id

-- Join with problem stats
LEFT JOIN (
  SELECT
    p.subskill_id,
    p.version_id,
    COUNT(*) as problem_count,
    SUM(CASE WHEN e.final_recommendation = 'approve' THEN 1 ELSE 0 END) as approved_count,
    AVG(e.overall_score) as avg_problem_score
  FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems` p
  LEFT JOIN `mountamo-tutor-h7wnta.analytics.problems_with_latest_evaluation` e
    ON p.problem_id = e.problem_id
  GROUP BY p.subskill_id, p.version_id
) prob
  ON s.subskill_id = prob.subskill_id AND s.version_id = prob.version_id;

-- =================================================================
-- SAMPLE QUERIES
-- =================================================================

-- Get all problems for a subskill with evaluation status
-- SELECT * FROM `mountamo-tutor-h7wnta.analytics.problems_with_latest_evaluation`
-- WHERE subskill_id = 'LA006-03-A'
-- AND version_id = 'v1'
-- ORDER BY overall_score DESC;

-- Get problems that need revision
-- SELECT problem_id, problem_type, final_recommendation, overall_score, llm_suggestions
-- FROM `mountamo-tutor-h7wnta.analytics.problems_with_latest_evaluation`
-- WHERE final_recommendation = 'revise'
-- ORDER BY overall_score ASC;

-- Get content quality summary for all subskills
-- SELECT * FROM `mountamo-tutor-h7wnta.analytics.content_quality_dashboard`
-- WHERE overall_status = 'ready_to_publish'
-- ORDER BY subskill_id;

-- Compare prompt template performance
-- SELECT * FROM `mountamo-tutor-h7wnta.analytics.prompt_performance_summary`
-- WHERE template_type = 'problem_generation'
-- ORDER BY avg_evaluation_score DESC;

-- Get generation and evaluation prompts for a problem (debugging)
-- SELECT
--   p.problem_id,
--   p.generation_prompt,
--   p.generation_model,
--   e.evaluation_prompt,
--   e.evaluation_model,
--   e.final_recommendation,
--   e.llm_suggestions
-- FROM `mountamo-tutor-h7wnta.analytics.curriculum_problems` p
-- JOIN `mountamo-tutor-h7wnta.analytics.problem_evaluations` e
--   ON p.problem_id = e.problem_id
-- WHERE p.problem_id = 'abc123'
-- ORDER BY e.evaluation_timestamp DESC
-- LIMIT 1;
