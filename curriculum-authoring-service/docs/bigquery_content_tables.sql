-- BigQuery Table Schemas for Reading Content and Visual Snippets
-- Run these CREATE TABLE statements in your BigQuery dataset

-- =================================================================
-- READING CONTENT TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.subskill_reading_content` (
  -- Identifiers
  subskill_id STRING NOT NULL,
  version_id STRING NOT NULL,
  section_id STRING NOT NULL,
  section_order INT64 NOT NULL,

  -- Content
  title STRING NOT NULL,
  heading STRING NOT NULL,
  content_text STRING NOT NULL,
  key_terms ARRAY<STRING>,
  concepts_covered ARRAY<STRING>,

  -- Interactive primitives (stored as JSON array)
  interactive_primitives JSON,

  -- Visual snippet reference
  has_visual_snippet BOOL DEFAULT FALSE,

  -- Status and metadata
  generation_status STRING DEFAULT 'generated',  -- 'pending', 'generated', 'edited'
  is_draft BOOL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_edited_by STRING
)
PARTITION BY DATE(created_at)
CLUSTER BY subskill_id, version_id;

-- Add description to table
ALTER TABLE `mountamo-tutor-h7wnta.analytics.subskill_reading_content`
SET OPTIONS (
  description = 'Reading content sections for subskills with interactive primitives'
);

-- =================================================================
-- VISUAL SNIPPETS TABLE
-- =================================================================
CREATE TABLE IF NOT EXISTS `mountamo-tutor-h7wnta.analytics.visual_snippets` (
  -- Identifiers
  snippet_id STRING NOT NULL,
  subskill_id STRING NOT NULL,
  section_id STRING NOT NULL,

  -- Content
  html_content STRING NOT NULL,  -- Complete HTML file with embedded CSS/JS
  generation_prompt STRING,      -- Prompt used to generate this visual

  -- Metadata
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_edited_by STRING
)
PARTITION BY DATE(created_at)
CLUSTER BY subskill_id, section_id;

-- Add description to table
ALTER TABLE `mountamo-tutor-h7wnta.analytics.visual_snippets`
SET OPTIONS (
  description = 'Interactive HTML visual snippets for reading content sections'
);

-- =================================================================
-- INDEXES / VIEWS (Optional for better query performance)
-- =================================================================

-- View to join reading content with visual snippets
CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.reading_content_with_visuals` AS
SELECT
  rc.*,
  vs.snippet_id,
  vs.html_content,
  vs.generation_prompt as visual_prompt
FROM `mountamo-tutor-h7wnta.analytics.subskill_reading_content` rc
LEFT JOIN `mountamo-tutor-h7wnta.analytics.visual_snippets` vs
  ON rc.subskill_id = vs.subskill_id
  AND rc.section_id = vs.section_id;

-- =================================================================
-- SAMPLE QUERIES
-- =================================================================

-- Get all reading content for a subskill
-- SELECT * FROM `curriculum_authoring.subskill_reading_content`
-- WHERE subskill_id = 'math-k-counting-1to10'
-- AND version_id = 'v1'
-- ORDER BY section_order ASC;

-- Get visual snippet for a section
-- SELECT * FROM `curriculum_authoring.visual_snippets`
-- WHERE subskill_id = 'math-k-counting-1to10'
-- AND section_id = 'math-k-counting-1to10_section_1'
-- ORDER BY created_at DESC
-- LIMIT 1;

-- Get complete reading package with visuals
-- SELECT * FROM `curriculum_authoring.reading_content_with_visuals`
-- WHERE subskill_id = 'math-k-counting-1to10'
-- AND version_id = 'v1'
-- ORDER BY section_order ASC;
