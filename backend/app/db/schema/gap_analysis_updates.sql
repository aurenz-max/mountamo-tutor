-- Add last_attempt_date to fact_mastery_metrics table
ALTER TABLE analytics.fact_mastery_metrics 
ADD COLUMN IF NOT EXISTS last_attempt_date TIMESTAMP;

-- Add gap_status to fact_mastery_metrics table
ALTER TABLE analytics.fact_mastery_metrics 
ADD COLUMN IF NOT EXISTS gap_status VARCHAR(20);

-- Create an index for the new columns
CREATE INDEX IF NOT EXISTS idx_fact_mastery_last_attempt 
ON analytics.fact_mastery_metrics(last_attempt_date);

CREATE INDEX IF NOT EXISTS idx_fact_mastery_gap_status 
ON analytics.fact_mastery_metrics(gap_status);

-- Create a function to update the gap_status column
CREATE OR REPLACE FUNCTION analytics.update_gap_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Set gap_status based on completion and score
    IF NEW.covered_items = 0 THEN
        NEW.gap_status := 'coverage_gap';
    ELSIF NEW.average_score < 40 AND NEW.credibility >= 0.3 THEN
        NEW.gap_status := 'performance_gap';
    ELSE
        NEW.gap_status := 'no_gap';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update gap_status
CREATE TRIGGER set_gap_status
BEFORE INSERT OR UPDATE ON analytics.fact_mastery_metrics
FOR EACH ROW
EXECUTE FUNCTION analytics.update_gap_status();

-- Create a view for curriculum gap analysis
CREATE OR REPLACE VIEW analytics.vw_curriculum_gaps AS
WITH curriculum_items AS (
    SELECT 
        s.subject_id,
        u.unit_id,
        sk.skill_id,
        ss.subskill_id
    FROM 
        analytics.dim_subject s
    JOIN 
        analytics.dim_unit u ON s.subject_id = u.subject_id
    JOIN 
        analytics.dim_skill sk ON u.unit_id = sk.unit_id
    JOIN 
        analytics.dim_subskill ss ON sk.skill_id = ss.skill_id
),
student_attempts AS (
    SELECT DISTINCT
        student_id, subject_id, unit_id, skill_id, subskill_id
    FROM 
        analytics.fact_attempts
),
performance_metrics AS (
    SELECT 
        m.student_id, m.subject_id, m.unit_id, m.skill_id, m.subskill_id,
        m.average_score,
        m.last_attempt_date
    FROM 
        analytics.fact_mastery_metrics m
    WHERE 
        m.hierarchy_level = 'subskill'
)
SELECT 
    ci.subject_id,
    ci.unit_id,
    ci.skill_id,
    ci.subskill_id,
    s.student_id,
    CASE 
        WHEN sa.student_id IS NULL THEN 'coverage_gap'
        WHEN pm.average_score < 40 AND pm.average_score > 0 THEN 'performance_gap'
        ELSE 'no_gap'
    END as gap_status,
    pm.average_score,
    pm.last_attempt_date,
    CASE
        WHEN pm.last_attempt_date IS NULL THEN 'never_attempted'
        WHEN pm.last_attempt_date < NOW() - INTERVAL '30 days' THEN 'stale'
        ELSE 'recent'
    END as recency_status
FROM 
    curriculum_items ci
CROSS JOIN 
    (SELECT DISTINCT student_id FROM analytics.dim_student) s
LEFT JOIN 
    student_attempts sa ON 
        ci.subject_id = sa.subject_id AND
        ci.unit_id = sa.unit_id AND
        ci.skill_id = sa.skill_id AND
        ci.subskill_id = sa.subskill_id AND
        s.student_id = sa.student_id
LEFT JOIN 
    performance_metrics pm ON 
        ci.subject_id = pm.subject_id AND
        ci.unit_id = pm.unit_id AND
        ci.skill_id = pm.skill_id AND
        ci.subskill_id = pm.subskill_id AND
        s.student_id = pm.student_id;

-- Create a view for gap analysis summary by student
CREATE OR REPLACE VIEW analytics.vw_student_gap_summary AS
SELECT
    student_id,
    subject_id,
    COUNT(*) as total_curriculum_items,
    SUM(CASE WHEN gap_status = 'coverage_gap' THEN 1 ELSE 0 END) as coverage_gaps,
    SUM(CASE WHEN gap_status = 'performance_gap' THEN 1 ELSE 0 END) as performance_gaps,
    SUM(CASE WHEN gap_status = 'no_gap' THEN 1 ELSE 0 END) as mastered_items,
    SUM(CASE WHEN recency_status = 'stale' THEN 1 ELSE 0 END) as stale_items,
    ROUND(SUM(CASE WHEN gap_status = 'coverage_gap' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as coverage_gap_percentage,
    ROUND(SUM(CASE WHEN gap_status = 'performance_gap' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as performance_gap_percentage,
    ROUND(SUM(CASE WHEN gap_status = 'no_gap' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as mastery_percentage
FROM
    analytics.vw_curriculum_gaps
GROUP BY
    student_id, subject_id;