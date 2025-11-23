-- ============================================================================
-- UPDATE prompt_performance_metrics TABLE FOR FEEDBACK LOOP
-- ============================================================================
-- This adds new fields populated by the FeedbackAggregatorService
-- to support the automated feedback loop and prompt improvement workflow
-- ============================================================================

-- Add new fields for feedback aggregation
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS metrics_id STRING OPTIONS(description='Unique identifier for this metrics snapshot');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS template_id STRING OPTIONS(description='Template ID (matches prompt_template_id for clarity)');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS snapshot_timestamp TIMESTAMP OPTIONS(description='When this metrics snapshot was generated');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS total_evaluations INT64 OPTIONS(description='Total number of evaluations analyzed');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_overall_score FLOAT64 OPTIONS(description='Average overall evaluation score (0-10)');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS approval_rate FLOAT64 OPTIONS(description='Percentage of problems approved (0-1)');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_pedagogical_score FLOAT64 OPTIONS(description='Average pedagogical approach score');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_alignment_score FLOAT64 OPTIONS(description='Average alignment score');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_clarity_score FLOAT64 OPTIONS(description='Average clarity score');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_correctness_score FLOAT64 OPTIONS(description='Average correctness score');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS avg_bias_score FLOAT64 OPTIONS(description='Average bias score');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS total_generations INT64 OPTIONS(description='Total problems generated with this template');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS total_approvals INT64 OPTIONS(description='Total problems approved');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS total_revisions INT64 OPTIONS(description='Total problems needing revision');

ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS total_rejections INT64 OPTIONS(description='Total problems rejected');

-- Performance flags - NEW for alerting
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS performance_flags JSON OPTIONS(description='Array of performance flags (LOW_APPROVAL_RATE, WEAK_PEDAGOGICAL_APPROACH_SCORE, etc.)');

-- Dimension analysis - NEW for detailed breakdown
ALTER TABLE `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`
ADD COLUMN IF NOT EXISTS dimension_analysis JSON OPTIONS(description='Detailed analysis of each evaluation dimension with min/max/avg/severity');

-- ============================================================================
-- CREATE INDEX FOR NEW FIELDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_performance_metrics_snapshot
ON `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`(template_id, snapshot_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_approval
ON `mountamo-tutor-h7wnta.analytics.prompt_performance_metrics`(template_id, approval_rate DESC);


-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Check that new columns exist
SELECT
  column_name,
  data_type,
  description
FROM `mountamo-tutor-h7wnta.analytics.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'prompt_performance_metrics'
  AND column_name IN (
    'metrics_id',
    'performance_flags',
    'dimension_analysis',
    'approval_rate',
    'avg_overall_score'
  )
ORDER BY column_name;
