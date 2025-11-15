-- Assessment Analytics Sample Queries
-- Demonstrating the power of the assessment analytics schema

-- ============================================================================
-- 1. ASSESSMENT TRENDS OVER TIME
-- ============================================================================

-- 1.1 Score trends by subject and category over the past 12 weeks
SELECT
  DATE_TRUNC(completed_at, WEEK) as week,
  subject,
  category,
  AVG(percentage) as avg_score,
  COUNT(*) as assessment_count,
  COUNT(DISTINCT student_id) as unique_students
FROM `analytics.assessment_skill_insights`
WHERE completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 WEEK)
  AND completed_at IS NOT NULL
GROUP BY week, subject, category
ORDER BY week DESC, subject, category;


-- 1.2 Assessment completion rates by student over time
SELECT
  student_id,
  subject,
  DATE_TRUNC(completed_at, MONTH) as month,
  COUNT(DISTINCT assessment_id) as assessments_completed,
  AVG(score_percentage) as avg_score,
  AVG(time_taken_minutes) as avg_duration_minutes,
  -- Compare to estimated duration
  AVG(time_taken_minutes) / NULLIF(AVG(estimated_duration_minutes), 0) as duration_ratio
FROM `analytics.assessments`
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
GROUP BY student_id, subject, month
ORDER BY student_id, subject, month DESC;


-- ============================================================================
-- 2. MISCONCEPTION ANALYSIS
-- ============================================================================

-- 2.1 Most common misconceptions by subskill
SELECT
  subskill_id,
  subskill_name,
  misconception,
  COUNT(*) as occurrence_count,
  -- Success rate for this misconception
  COUNTIF(is_correct) / COUNT(*) as success_rate_with_misconception,
  -- Average score when this misconception appears
  AVG(score) as avg_score_with_misconception,
  -- Number of unique students affected
  COUNT(DISTINCT student_id) as students_affected
FROM `analytics.assessment_problem_reviews`
WHERE misconception IS NOT NULL
  AND misconception != ''
  AND assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY subskill_id, subskill_name, misconception
HAVING occurrence_count >= 3  -- Only show misconceptions that appear multiple times
ORDER BY occurrence_count DESC, success_rate_with_misconception ASC
LIMIT 50;


-- 2.2 Student-specific misconception patterns
SELECT
  student_id,
  subject,
  misconception,
  COUNT(*) as times_encountered,
  COUNTIF(is_correct) / COUNT(*) as correction_rate,
  MIN(assessment_completed_at) as first_seen,
  MAX(assessment_completed_at) as last_seen,
  DATE_DIFF(MAX(assessment_completed_at), MIN(assessment_completed_at), DAY) as days_between_first_last,
  -- Check if misconception is improving over time
  CASE
    WHEN COUNTIF(is_correct AND assessment_completed_at > DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)) /
         NULLIF(COUNTIF(assessment_completed_at > DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)), 0) >
         COUNTIF(is_correct) / COUNT(*)
    THEN 'Improving'
    ELSE 'Persistent'
  END as trend
FROM `analytics.assessment_problem_reviews`
WHERE misconception IS NOT NULL
GROUP BY student_id, subject, misconception
HAVING times_encountered >= 2
ORDER BY student_id, times_encountered DESC;


-- ============================================================================
-- 3. STUDENT PROGRESS TRACKING
-- ============================================================================

-- 3.1 Track improvement in weak spots over time
WITH assessment_sequence AS (
  SELECT
    student_id,
    subject,
    assessment_id,
    category,
    percentage,
    assessment_completed_at,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, subject, category
      ORDER BY assessment_completed_at
    ) as attempt_number
  FROM `analytics.assessment_skill_insights`
  WHERE category = 'weak_spots'
    AND assessment_completed_at IS NOT NULL
)
SELECT
  student_id,
  subject,
  category,
  COUNT(*) as total_assessments,
  -- Early performance (first 3 attempts)
  AVG(CASE WHEN attempt_number <= 3 THEN percentage END) as early_avg_score,
  -- Later performance (after 3 attempts)
  AVG(CASE WHEN attempt_number > 3 THEN percentage END) as later_avg_score,
  -- Improvement calculation
  AVG(CASE WHEN attempt_number > 3 THEN percentage END) -
  AVG(CASE WHEN attempt_number <= 3 THEN percentage END) as improvement,
  -- Latest performance
  MAX(CASE WHEN attempt_number = (SELECT MAX(an) FROM assessment_sequence WHERE student_id = a.student_id AND subject = a.subject)
      THEN percentage END) as most_recent_score
FROM assessment_sequence a
GROUP BY student_id, subject, category
HAVING COUNT(*) >= 4  -- Need at least 4 assessments to see improvement
ORDER BY improvement DESC;


-- 3.2 Subskill mastery progression across assessments
SELECT
  student_id,
  subject,
  subskill_id,
  subskill_description,
  -- Initial mastery level
  MIN(mastery) as initial_mastery,
  -- Current mastery level
  MAX(mastery) as current_mastery,
  -- Improvement
  MAX(mastery) - MIN(mastery) as mastery_improvement,
  -- Number of times assessed
  COUNT(*) as times_assessed,
  -- Average category (to see if it moved from weak spot to mastered)
  ARRAY_AGG(DISTINCT category ORDER BY assessment_completed_at) as category_progression,
  -- Time span
  DATE_DIFF(
    MAX(assessment_completed_at),
    MIN(assessment_completed_at),
    DAY
  ) as days_of_practice
FROM `analytics.assessment_subskill_attempts`
WHERE assessment_completed_at IS NOT NULL
GROUP BY student_id, subject, subskill_id, subskill_description
HAVING times_assessed >= 2
ORDER BY student_id, mastery_improvement DESC;


-- ============================================================================
-- 4. PERFORMANCE DISTRIBUTION ANALYSIS
-- ============================================================================

-- 4.1 Score distribution across subskills (identify difficulty spikes)
SELECT
  subskill_id,
  subskill_name,
  subject,
  COUNT(*) as total_attempts,
  -- Quartile analysis
  APPROX_QUANTILES(score, 100)[OFFSET(25)] as p25_score,
  APPROX_QUANTILES(score, 100)[OFFSET(50)] as median_score,
  APPROX_QUANTILES(score, 100)[OFFSET(75)] as p75_score,
  -- Average and std dev
  AVG(score) as avg_score,
  STDDEV(score) as stddev_score,
  -- Success rate
  COUNTIF(is_correct) / COUNT(*) as success_rate,
  -- Categorize difficulty
  CASE
    WHEN AVG(score) < 5 THEN 'Very Difficult'
    WHEN AVG(score) < 7 THEN 'Difficult'
    WHEN AVG(score) < 8.5 THEN 'Moderate'
    ELSE 'Easy'
  END as difficulty_category
FROM `analytics.assessment_problem_reviews`
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY subskill_id, subskill_name, subject
HAVING total_attempts >= 10  -- Minimum sample size
ORDER BY avg_score ASC, stddev_score DESC;


-- 4.2 Performance by problem type
SELECT
  subject,
  problem_type,
  COUNT(*) as total_problems,
  COUNTIF(is_correct) / COUNT(*) as success_rate,
  AVG(score) as avg_score,
  COUNT(DISTINCT student_id) as students_attempted,
  -- Compare to subject average
  AVG(score) - (
    SELECT AVG(score)
    FROM `analytics.assessment_problem_reviews`
    WHERE subject = apr.subject
  ) as score_vs_subject_avg
FROM `analytics.assessment_problem_reviews` apr
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY subject, problem_type
ORDER BY subject, success_rate ASC;


-- ============================================================================
-- 5. AI INSIGHTS SUMMARY ANALYSIS
-- ============================================================================

-- 5.1 Most common AI-identified patterns across students
SELECT
  subject,
  performance_label,
  category,
  COUNT(*) as occurrences,
  COUNT(DISTINCT student_id) as unique_students,
  -- Sample insights for this pattern
  ARRAY_AGG(DISTINCT insight_text LIMIT 3) as sample_insights,
  -- Most common next steps
  ARRAY_AGG(DISTINCT next_step.action_type IGNORE NULLS LIMIT 5) as recommended_actions
FROM `analytics.assessment_skill_insights`
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY subject, performance_label, category
ORDER BY occurrences DESC;


-- 5.2 Assessment focus effectiveness
-- Compare performance on skills that were assessment focus vs. not
SELECT
  subject,
  assessment_focus_tag,
  COUNT(DISTINCT student_id) as students,
  AVG(percentage) as avg_score,
  COUNTIF(performance_label = 'Mastered') / COUNT(*) as mastery_rate,
  -- Average improvement from category baseline
  AVG(percentage) - AVG(
    CASE category
      WHEN 'weak_spots' THEN 40  -- Expected baseline for weak spots
      WHEN 'foundational_review' THEN 60
      WHEN 'new_frontiers' THEN 30
      ELSE 50
    END
  ) as performance_vs_expected
FROM `analytics.assessment_skill_insights`
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
GROUP BY subject, assessment_focus_tag
ORDER BY subject, performance_vs_expected DESC;


-- ============================================================================
-- 6. COHORT COMPARISON & BENCHMARKING
-- ============================================================================

-- 6.1 Student performance relative to cohort
WITH cohort_stats AS (
  SELECT
    subject,
    AVG(score_percentage) as cohort_avg_score,
    STDDEV(score_percentage) as cohort_stddev,
    APPROX_QUANTILES(score_percentage, 100)[OFFSET(50)] as cohort_median
  FROM `analytics.assessments`
  WHERE status = 'completed'
    AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY subject
)
SELECT
  a.student_id,
  a.subject,
  COUNT(*) as assessments_taken,
  AVG(a.score_percentage) as student_avg_score,
  cs.cohort_avg_score,
  cs.cohort_median,
  -- Performance relative to cohort
  AVG(a.score_percentage) - cs.cohort_avg_score as score_vs_cohort_avg,
  -- Z-score (standard deviations from mean)
  (AVG(a.score_percentage) - cs.cohort_avg_score) / NULLIF(cs.cohort_stddev, 0) as z_score,
  -- Percentile ranking
  CASE
    WHEN AVG(a.score_percentage) > cs.cohort_avg_score + cs.cohort_stddev THEN 'Top 16%'
    WHEN AVG(a.score_percentage) > cs.cohort_avg_score THEN 'Above Average'
    WHEN AVG(a.score_percentage) > cs.cohort_avg_score - cs.cohort_stddev THEN 'Below Average'
    ELSE 'Bottom 16%'
  END as performance_band
FROM `analytics.assessments` a
JOIN cohort_stats cs ON a.subject = cs.subject
WHERE a.status = 'completed'
  AND a.completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY a.student_id, a.subject, cs.cohort_avg_score, cs.cohort_stddev, cs.cohort_median
ORDER BY a.student_id, a.subject;


-- ============================================================================
-- 7. CATEGORY PERFORMANCE PATTERNS
-- ============================================================================

-- 7.1 Category performance evolution (are weak spots becoming mastered?)
SELECT
  student_id,
  subject,
  category,
  -- Count assessments by category
  COUNT(*) as assessments_in_category,
  -- Average performance trend
  AVG(percentage) as avg_performance,
  -- How many moved to "Mastered" performance label
  COUNTIF(performance_label = 'Mastered') as mastered_count,
  COUNTIF(performance_label = 'Proficient') as proficient_count,
  COUNTIF(performance_label = 'Developing') as developing_count,
  COUNTIF(performance_label = 'Needs Review') as needs_review_count,
  -- Effectiveness score (how well are they mastering this category)
  COUNTIF(performance_label IN ('Mastered', 'Proficient')) / COUNT(*) as effectiveness_rate,
  -- Time span
  DATE_DIFF(MAX(assessment_completed_at), MIN(assessment_completed_at), DAY) as days_working_on_category
FROM `analytics.assessment_skill_insights`
WHERE assessment_completed_at IS NOT NULL
GROUP BY student_id, subject, category
HAVING assessments_in_category >= 2
ORDER BY student_id, subject, effectiveness_rate DESC;


-- 7.2 Category balance analysis (are assessments balanced across categories?)
SELECT
  student_id,
  subject,
  -- Count by category
  COUNTIF(category = 'weak_spots') as weak_spots_assessments,
  COUNTIF(category = 'recent_practice') as recent_practice_assessments,
  COUNTIF(category = 'foundational_review') as foundational_review_assessments,
  COUNTIF(category = 'new_frontiers') as new_frontiers_assessments,
  -- Calculate balance (ideal is roughly equal across categories)
  STDDEV(
    CASE category
      WHEN 'weak_spots' THEN COUNTIF(category = 'weak_spots')
      WHEN 'recent_practice' THEN COUNTIF(category = 'recent_practice')
      WHEN 'foundational_review' THEN COUNTIF(category = 'foundational_review')
      WHEN 'new_frontiers' THEN COUNTIF(category = 'new_frontiers')
    END
  ) as category_imbalance_score,
  -- Overall assessment count
  COUNT(*) as total_assessments,
  -- Latest assessment date
  MAX(assessment_completed_at) as most_recent_assessment
FROM `analytics.assessment_skill_insights`
WHERE assessment_completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
GROUP BY student_id, subject
HAVING total_assessments >= 5
ORDER BY student_id, subject;


-- ============================================================================
-- 8. ACTIONABLE INSIGHTS & RECOMMENDATIONS
-- ============================================================================

-- 8.1 Students needing intervention (struggling students)
WITH student_performance AS (
  SELECT
    student_id,
    subject,
    COUNT(*) as total_assessments,
    AVG(score_percentage) as avg_score,
    -- Recent performance (last 3 assessments)
    AVG(CASE WHEN rn <= 3 THEN score_percentage END) as recent_avg_score,
    -- Performance on weak spots specifically
    AVG(CASE WHEN EXISTS(
      SELECT 1 FROM `analytics.assessment_skill_insights` asi
      WHERE asi.assessment_id = a.assessment_id
      AND asi.category = 'weak_spots'
    ) THEN score_percentage END) as weak_spots_score
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY student_id, subject ORDER BY completed_at DESC) as rn
    FROM `analytics.assessments`
    WHERE status = 'completed'
      AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
  ) a
  GROUP BY student_id, subject
)
SELECT
  student_id,
  subject,
  total_assessments,
  ROUND(avg_score, 1) as avg_score_pct,
  ROUND(recent_avg_score, 1) as recent_avg_score_pct,
  ROUND(weak_spots_score, 1) as weak_spots_score_pct,
  -- Risk level
  CASE
    WHEN avg_score < 50 AND recent_avg_score < avg_score THEN 'High Risk - Declining'
    WHEN avg_score < 60 THEN 'High Risk - Low Performance'
    WHEN recent_avg_score < 65 THEN 'Medium Risk - Recent Struggles'
    WHEN weak_spots_score < 55 THEN 'Medium Risk - Weak Spots Challenge'
    ELSE 'Low Risk'
  END as risk_level,
  -- Recommended action
  CASE
    WHEN avg_score < 50 THEN 'Immediate 1-on-1 intervention needed'
    WHEN avg_score < 60 THEN 'Schedule tutoring session, focus on fundamentals'
    WHEN recent_avg_score < 65 THEN 'Review recent assessments, identify new struggles'
    WHEN weak_spots_score < 55 THEN 'Provide additional practice on weak spots'
    ELSE 'Continue monitoring'
  END as recommended_action
FROM student_performance
WHERE total_assessments >= 3
  AND (avg_score < 70 OR recent_avg_score < 70 OR weak_spots_score < 60)
ORDER BY
  CASE risk_level
    WHEN 'High Risk - Declining' THEN 1
    WHEN 'High Risk - Low Performance' THEN 2
    WHEN 'Medium Risk - Recent Struggles' THEN 3
    WHEN 'Medium Risk - Weak Spots Challenge' THEN 4
    ELSE 5
  END,
  avg_score ASC;


-- 8.2 High-performing students ready for challenge
SELECT
  a.student_id,
  a.subject,
  COUNT(DISTINCT a.assessment_id) as assessments_completed,
  AVG(a.score_percentage) as avg_score,
  -- Mastery in weak spots (shows they've overcome challenges)
  COUNTIF(EXISTS(
    SELECT 1 FROM `analytics.assessment_skill_insights` asi
    WHERE asi.assessment_id = a.assessment_id
    AND asi.category = 'weak_spots'
    AND asi.performance_label = 'Mastered'
  )) as weak_spots_mastered,
  -- New frontiers performance (shows readiness for challenge)
  AVG(CASE WHEN EXISTS(
    SELECT 1 FROM `analytics.assessment_skill_insights` asi
    WHERE asi.assessment_id = a.assessment_id
    AND asi.category = 'new_frontiers'
  ) THEN a.score_percentage END) as new_frontiers_score,
  -- Consistency (low variance = consistent high performance)
  STDDEV(a.score_percentage) as score_consistency,
  -- Recommendation
  'Ready for advanced/accelerated content' as recommendation
FROM `analytics.assessments` a
WHERE a.status = 'completed'
  AND a.completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
GROUP BY a.student_id, a.subject
HAVING assessments_completed >= 4
  AND avg_score >= 85
  AND new_frontiers_score >= 75
  AND score_consistency < 10  -- Consistently high
ORDER BY avg_score DESC, new_frontiers_score DESC;


-- ============================================================================
-- 9. TIME-BASED ANALYSIS
-- ============================================================================

-- 9.1 Optimal assessment timing (when do students perform best?)
SELECT
  EXTRACT(DAYOFWEEK FROM completed_at) as day_of_week,
  EXTRACT(HOUR FROM completed_at) as hour_of_day,
  COUNT(*) as assessments_taken,
  AVG(score_percentage) as avg_score,
  AVG(time_taken_minutes) as avg_duration,
  -- Performance categorization
  CASE
    WHEN AVG(score_percentage) >= 80 THEN 'High Performance Window'
    WHEN AVG(score_percentage) >= 70 THEN 'Good Performance Window'
    ELSE 'Lower Performance Window'
  END as performance_window
FROM `analytics.assessments`
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND completed_at IS NOT NULL
GROUP BY day_of_week, hour_of_day
HAVING assessments_taken >= 10  -- Minimum sample size
ORDER BY avg_score DESC;


-- 9.2 Assessment velocity (time between assessments)
WITH assessment_gaps AS (
  SELECT
    student_id,
    subject,
    assessment_id,
    completed_at,
    LAG(completed_at) OVER (PARTITION BY student_id, subject ORDER BY completed_at) as previous_completed_at,
    DATE_DIFF(
      completed_at,
      LAG(completed_at) OVER (PARTITION BY student_id, subject ORDER BY completed_at),
      DAY
    ) as days_since_last_assessment,
    score_percentage
  FROM `analytics.assessments`
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
)
SELECT
  student_id,
  subject,
  COUNT(*) as total_assessments,
  AVG(days_since_last_assessment) as avg_days_between_assessments,
  -- Correlation between gap and performance
  CORR(days_since_last_assessment, score_percentage) as gap_performance_correlation,
  -- Identify optimal cadence
  CASE
    WHEN AVG(days_since_last_assessment) <= 7 THEN 'High Frequency (Weekly or more)'
    WHEN AVG(days_since_last_assessment) <= 14 THEN 'Moderate Frequency (Bi-weekly)'
    WHEN AVG(days_since_last_assessment) <= 30 THEN 'Low Frequency (Monthly)'
    ELSE 'Very Low Frequency (Less than monthly)'
  END as assessment_cadence,
  AVG(score_percentage) as avg_score
FROM assessment_gaps
WHERE days_since_last_assessment IS NOT NULL
GROUP BY student_id, subject
HAVING total_assessments >= 3
ORDER BY student_id, subject;


-- ============================================================================
-- 10. DASHBOARD SUMMARY QUERIES
-- ============================================================================

-- 10.1 Student assessment overview (for student dashboard)
SELECT
  a.student_id,
  a.subject,
  -- Overall metrics
  COUNT(DISTINCT a.assessment_id) as total_assessments,
  AVG(a.score_percentage) as overall_avg_score,
  MAX(a.score_percentage) as best_score,
  MIN(a.score_percentage) as lowest_score,
  -- Recent performance (last 7 days)
  AVG(CASE WHEN a.completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      THEN a.score_percentage END) as last_week_avg_score,
  -- Category breakdown
  SUM(a.weak_spots_count) as total_weak_spots_addressed,
  SUM(a.new_frontiers_count) as total_new_frontiers_explored,
  -- AI insights
  STRING_AGG(DISTINCT ai_summary, ' | ' ORDER BY a.completed_at DESC LIMIT 3) as recent_ai_summaries,
  -- Latest assessment
  MAX(a.completed_at) as last_assessment_date
FROM `analytics.assessments` a
WHERE a.status = 'completed'
  AND a.completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY a.student_id, a.subject
ORDER BY a.student_id, a.subject;


-- 10.2 Teacher dashboard - class overview
SELECT
  subject,
  -- Participation metrics
  COUNT(DISTINCT student_id) as active_students,
  COUNT(DISTINCT assessment_id) as total_assessments,
  AVG(score_percentage) as class_avg_score,
  -- Performance distribution
  COUNTIF(score_percentage >= 90) / COUNT(*) as pct_excellent,
  COUNTIF(score_percentage >= 80 AND score_percentage < 90) / COUNT(*) as pct_good,
  COUNTIF(score_percentage >= 70 AND score_percentage < 80) / COUNT(*) as pct_satisfactory,
  COUNTIF(score_percentage < 70) / COUNT(*) as pct_needs_improvement,
  -- Common challenges
  (
    SELECT ARRAY_AGG(DISTINCT common_misconception LIMIT 5)
    FROM (
      SELECT UNNEST(common_misconceptions) as common_misconception
      FROM `analytics.assessments`
      WHERE subject = a.subject
        AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    )
    WHERE common_misconception IS NOT NULL
  ) as top_misconceptions,
  -- Time range
  MIN(completed_at) as earliest_assessment,
  MAX(completed_at) as latest_assessment
FROM `analytics.assessments` a
WHERE status = 'completed'
  AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY subject
ORDER BY class_avg_score ASC;  -- Show subjects needing most attention first
