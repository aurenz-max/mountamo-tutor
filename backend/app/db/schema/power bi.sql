WITH 
-- First get all curriculum items to establish the full hierarchy
all_curriculum_items AS (
    SELECT DISTINCT
        subject,
        skill_id,
        subskill_id
    FROM
        curriculum
),

-- Calculate average scores for each student and subskill_id (only for attempted items)
student_subskill_scores AS (
    SELECT 
        student_id,
        subskill_id,
        AVG(score / 10) AS avg_score
    FROM 
        attempts
    GROUP BY 
        student_id, 
        subskill_id
),

-- Calculate subskill proficiency (including non-attempted subskills as 0)
subskill_proficiency AS (
    SELECT
        s.student_id,
        c.subject,
        c.skill_id,
        c.subskill_id,
        COALESCE(sss.avg_score, 0) AS proficiency
    FROM
        students s
    CROSS JOIN
        all_curriculum_items c
    LEFT JOIN
        student_subskill_scores sss ON s.student_id = sss.student_id AND c.subskill_id = sss.subskill_id
),

-- Calculate skill proficiency (average of all subskills including non-attempted)
skill_proficiency AS (
    SELECT
        student_id,
        subject,
        skill_id,
        AVG(proficiency) AS proficiency
    FROM
        subskill_proficiency
    GROUP BY
        student_id,
        subject,
        skill_id
),

-- Find subskills that are ready based on previous subskill in the learning path
-- A student is ready for a subskill if they have 60% proficiency in the prerequisite subskill
ready_subskills AS (
    -- Base case: First subskills in each sequence (those without prerequisite subskills)
    -- are always ready
    SELECT DISTINCT
        s.student_id,
        c.subskill_id
    FROM
        students s
    CROSS JOIN
        curriculum c
    LEFT JOIN
        subskill_learning_paths slp ON c.subskill_id = slp.next_subskill_id
    WHERE
        slp.current_subskill_id IS NULL
    
    UNION
    
    -- Add subskills where the student has 60% proficiency in the prerequisite
    SELECT DISTINCT
        sp.student_id,
        slp.next_subskill_id AS subskill_id
    FROM
        subskill_proficiency sp
    JOIN
        subskill_learning_paths slp ON sp.subskill_id = slp.current_subskill_id
    WHERE
        sp.proficiency >= 0.6  -- Must have 60% proficiency in prerequisite subskill
        AND slp.next_subskill_id IS NOT NULL -- Only if there is a next subskill
),

-- Determine which skills are unlocked (60% proficiency in any of its subskills)
unlocked_skills AS (
    SELECT DISTINCT
        sp.student_id,
        sp.skill_id
    FROM
        subskill_proficiency sp
    WHERE
        sp.proficiency >= 0.6  -- 60% proficiency in any subskill unlocks the skill
),

-- Add a new CTE for priority labeling
item_priority AS (
    SELECT
        student_id,
        subskill_id,
        proficiency,
        CASE
            WHEN proficiency >= 0.8 THEN 'Mastered'                     -- Clear mastery (>=80%)
            WHEN proficiency BETWEEN 0.4 AND 0.799 THEN 'High Priority' -- Working on it (40-79%)
            WHEN proficiency < 0.4 AND proficiency > 0 THEN 'Medium Priority' -- Started but low proficiency
            WHEN proficiency = 0 THEN 'Not Started'                     -- No attempts yet
            ELSE 'Not Assessed'
        END AS priority_level,
        CASE 
            WHEN proficiency BETWEEN 0.4 AND 0.799 THEN 1  -- Highest priority (partially mastered)
            WHEN proficiency < 0.4 AND proficiency > 0 THEN 2  -- Medium priority (just started)
            WHEN proficiency = 0 THEN 3                     -- Low priority (not started)
            WHEN proficiency >= 0.8 THEN 4                 -- Already mastered
            ELSE 5                                        -- Not assessed
        END AS priority_order
    FROM
        subskill_proficiency
),

-- Combined query with readiness and priority information
combined_data AS (
    -- Start with all problem attempts
    SELECT 
        -- Problem attempt data
        a.student_id,
        s.name AS student_name,
        c.grade AS student_grade,
        a.subject,
        a.skill_id,
        a.subskill_id,
        a.score / 10 as score,
        a.timestamp AS attempt_timestamp,
        
        -- Curriculum data
        c.grade AS curriculum_grade,
        c.unit_id,
        c.unit_title,
        c.skill_description,
        c.subskill_description,
        c.difficulty_start,
        c.difficulty_end,
        c.target_difficulty,
        'Has Attempts' AS coverage_status,
        
        -- Simplified readiness indicator that combines skill and subskill readiness
        CASE 
            WHEN rs.subskill_id IS NOT NULL AND us.skill_id IS NOT NULL THEN 'Ready'
            WHEN rs.subskill_id IS NOT NULL THEN 'Ready for Subskill'
            WHEN us.skill_id IS NOT NULL THEN 'Ready for Skill'
            ELSE 'Not Ready'
        END AS readiness_status,
        
        -- Add priority label
        ip.priority_level,
        ip.priority_order,
        
        -- Label for next recommended item
        CASE
            WHEN rs.subskill_id IS NOT NULL AND ip.priority_level IN ('High Priority', 'Medium Priority') 
            THEN 'Recommended Next'
            ELSE NULL
        END AS recommended_next,
        
        -- Include proficiency data
        COALESCE(sp.proficiency, 0) AS subskill_proficiency,
        COALESCE(skp.proficiency, 0) AS skill_proficiency,
        
        -- Include next subskill in learning path
        slp.next_subskill_id AS next_subskill
    FROM 
        attempts a
    JOIN 
        students s ON a.student_id = s.student_id
    LEFT JOIN 
        curriculum c ON a.subskill_id = c.subskill_id
    LEFT JOIN
        ready_subskills rs ON a.student_id = rs.student_id AND a.subskill_id = rs.subskill_id
    LEFT JOIN 
        unlocked_skills us ON a.student_id = us.student_id AND a.skill_id = us.skill_id
    LEFT JOIN
        subskill_proficiency sp ON a.student_id = sp.student_id AND a.subskill_id = sp.subskill_id
    LEFT JOIN
        skill_proficiency skp ON a.student_id = skp.student_id AND a.skill_id = skp.skill_id
    LEFT JOIN
        subskill_learning_paths slp ON a.subskill_id = slp.current_subskill_id
    LEFT JOIN
        item_priority ip ON a.student_id = ip.student_id AND a.subskill_id = ip.subskill_id
        
    UNION ALL
    
    -- Add curriculum items without attempts
    SELECT 
        s.student_id,
        s.name AS student_name,
        c.grade AS student_grade,
        c.subject,
        c.skill_id,
        c.subskill_id,
        NULL AS score,
        NULL AS attempt_timestamp,
        
        c.grade AS curriculum_grade,
        c.unit_id,
        c.unit_title,
        c.skill_description,
        c.subskill_description,
        c.difficulty_start,
        c.difficulty_end,
        c.target_difficulty,
        'No Attempts' AS coverage_status,
        
        -- Simplified readiness indicator that combines skill and subskill readiness
        CASE 
            WHEN rs.subskill_id IS NOT NULL AND us.skill_id IS NOT NULL THEN 'Ready'
            WHEN rs.subskill_id IS NOT NULL THEN 'Ready for Subskill'
            WHEN us.skill_id IS NOT NULL THEN 'Ready for Skill'
            ELSE 'Not Ready'
        END AS readiness_status,
        
        -- Add priority label
        ip.priority_level,
        ip.priority_order,
        
        -- Label for next recommended item
        CASE
            WHEN rs.subskill_id IS NOT NULL AND ip.priority_level IN ('High Priority', 'Medium Priority') 
            THEN 'Recommended Next'
            ELSE NULL
        END AS recommended_next,
        
        -- Include proficiency data
        COALESCE(sp.proficiency, 0) AS subskill_proficiency,
        COALESCE(skp.proficiency, 0) AS skill_proficiency,
        
        -- Include next subskill in learning path
        slp.next_subskill_id AS next_subskill
    FROM 
        curriculum c
    CROSS JOIN
        students s
    LEFT JOIN
        ready_subskills rs ON s.student_id = rs.student_id AND c.subskill_id = rs.subskill_id
    LEFT JOIN 
        unlocked_skills us ON s.student_id = us.student_id AND c.skill_id = us.skill_id
    LEFT JOIN
        subskill_proficiency sp ON s.student_id = sp.student_id AND c.subskill_id = sp.subskill_id
    LEFT JOIN
        skill_proficiency skp ON s.student_id = skp.student_id AND c.skill_id = skp.skill_id
    LEFT JOIN
        subskill_learning_paths slp ON c.subskill_id = slp.current_subskill_id
    LEFT JOIN
        item_priority ip ON s.student_id = ip.student_id AND c.subskill_id = ip.subskill_id
    WHERE 
        NOT EXISTS (
            SELECT 1 
            FROM attempts a 
            WHERE a.subskill_id = c.subskill_id
            AND a.student_id = s.student_id
        )
)
-- Final query with all relevant information
SELECT * FROM combined_data
ORDER BY
    student_id NULLS LAST,
    subject,
    recommended_next DESC, -- Put recommended items first
    priority_order,        -- Then sort by priority
    skill_id,
    subskill_id,
    attempt_timestamp