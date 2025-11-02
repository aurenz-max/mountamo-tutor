# refactored_analytics.py
#
# DEPRECATED: This file uses PostgreSQL which has been replaced by BigQuery.
# PostgreSQL dependencies (asyncpg, psycopg2) have been removed from requirements.txt
# This code is kept for reference but will not function in production.
# See BigQueryAnalyticsService for the current analytics implementation.
#

import asyncpg  # DEPRECATED: PostgreSQL has been replaced by BigQuery
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any

from ..core.config import settings

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class AnalyticsExtension:
    def __init__(self):
        # Configure PostgreSQL connection settings
        self.ready_threshold = 0.6  # 60% proficiency threshold for readiness

    async def get_pg_connection(self):
        """Get a PostgreSQL connection"""
        try:
            return await asyncpg.connect(
                host=settings.PG_HOST,
                port=settings.PG_PORT,
                user=settings.PG_USER,
                password=settings.PG_PASSWORD,
                database=settings.PG_DATABASE
            )
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise

    async def get_hierarchical_metrics(self, student_id: int, subject: Optional[str] = None,
                                    start_date: Optional[datetime] = None,
                                    end_date: Optional[datetime] = None) -> Dict:
        """
        Calculate hierarchical metrics across all levels of the curriculum hierarchy for a specific time range,
        following the approach used in the direct SQL query with the attempts table.
        
        Args:
            student_id: The ID of the student
            subject: Optional subject filter
            start_date: Optional start date for filtering attempts
            end_date: Optional end date for filtering attempts
            
        Returns:
            Dictionary containing metrics at all levels with complete data
        """
        conn = await self.get_pg_connection()
        try:
            if start_date and start_date.tzinfo:
                start_date = start_date.replace(tzinfo=None)  # Remove timezone info
        
            if end_date and end_date.tzinfo:
                end_date = end_date.replace(tzinfo=None)  # Remove timezone info
            
            # Execute the query using the provided approach
            query = """
            WITH 
            -- First get all curriculum items to establish the full hierarchy
            all_curriculum_items AS (
                SELECT DISTINCT
                    subject,
                    unit_id,
                    unit_title,
                    skill_id,
                    skill_description,
                    subskill_id,
                    subskill_description,
                    grade
                FROM
                    curriculum
                WHERE
                    ($2::text IS NULL OR subject = $2)
            ),

            -- Calculate average scores for each student and subskill_id (only for attempted items)
            student_subskill_scores AS (
                SELECT 
                    student_id,
                    subskill_id,
                    AVG(score / 10) AS avg_score,
                    COUNT(*) AS attempt_count
                FROM 
                    attempts
                WHERE 
                    student_id = $1
                    AND ($3::timestamp IS NULL OR timestamp >= $3::timestamp)
                    AND ($4::timestamp IS NULL OR timestamp <= $4::timestamp)
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
                    COALESCE(sss.avg_score, 0) AS proficiency,
                    COALESCE(sss.attempt_count, 0) AS attempt_count
                FROM
                    (SELECT $1 AS student_id) s
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
                -- Base case: First subskills in each sequence (those that are base nodes)
                -- are always ready
                SELECT DISTINCT
                    $1 AS student_id,
                    c.subskill_id
                FROM
                    all_curriculum_items c
                JOIN (
                    -- Find base node skills
                    SELECT DISTINCT prerequisite_skill_id 
                    FROM learning_paths 
                    WHERE is_base_node = TRUE
                ) bn ON c.skill_id = bn.prerequisite_skill_id
                
                UNION ALL
                
                -- Original logic: First subskills in each sequence
                SELECT DISTINCT
                    $1 AS student_id,
                    c.subskill_id
                FROM
                    all_curriculum_items c
                LEFT JOIN
                    subskill_learning_paths slp ON c.subskill_id = slp.next_subskill_id
                WHERE
                    slp.current_subskill_id IS NULL
                
                UNION ALL
                
                -- Original logic: Subskills where student has 60% proficiency in prerequisite
                SELECT DISTINCT
                    sp.student_id,
                    slp.next_subskill_id AS subskill_id
                FROM
                    subskill_proficiency sp
                JOIN
                    subskill_learning_paths slp ON sp.subskill_id = slp.current_subskill_id
                WHERE
                    sp.proficiency >= 0.6
                    AND slp.next_subskill_id IS NOT NULL
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

            attempt_counts AS (
                SELECT
                    student_id,
                    subskill_id,
                    COUNT(*) AS num_attempts
                FROM
                    attempts
                WHERE
                    student_id = $1
                    AND ($3::timestamp IS NULL OR timestamp >= $3::timestamp)
                    AND ($4::timestamp IS NULL OR timestamp <= $4::timestamp)
                GROUP BY
                    student_id, subskill_id
            ),

            -- Get all attempts for the student with normalized scores
            all_attempts AS (
                SELECT
                    student_id,
                    subskill_id,
                    skill_id,
                    timestamp AS attempt_timestamp,
                    score / 10 as normalized_score  -- Normalizing to 0-1 scale
                FROM
                    attempts
                WHERE
                    student_id = $1
                    AND ($3::timestamp IS NULL OR timestamp >= $3::timestamp)
                    AND ($4::timestamp IS NULL OR timestamp <= $4::timestamp)
            ),

            -- Calculate average scores and blended scores with credibility
            subskill_scores AS (
                SELECT
                    a.student_id,
                    a.subskill_id,
                    AVG(a.normalized_score) AS avg_score,
                    COALESCE(ac.num_attempts, 0) AS attempt_count,
                    POWER(LEAST(COALESCE(ac.num_attempts, 0), 30) / 30.0, 0.5) AS credibility,
                    AVG(a.normalized_score) * POWER(LEAST(COALESCE(ac.num_attempts, 0), 30) / 30.0, 0.5) AS blended_score
                FROM
                    all_attempts a
                LEFT JOIN
                    attempt_counts ac ON a.student_id = ac.student_id AND a.subskill_id = ac.subskill_id
                GROUP BY
                    a.student_id, a.subskill_id, ac.num_attempts
            ),

            -- Add priority labeling based on blended scores
            item_priority AS (
                SELECT
                    student_id,
                    subskill_id,
                    avg_score,
                    attempt_count,
                    credibility,
                    blended_score,
                    CASE
                        WHEN blended_score >= 0.8 THEN 'Mastered'                     -- Clear mastery (>=80%)
                        WHEN blended_score BETWEEN 0.4 AND 0.799 THEN 'High Priority' -- Working on it (40-79%)
                        WHEN blended_score < 0.4 AND blended_score > 0 THEN 'Medium Priority' -- Started but low proficiency
                        WHEN blended_score = 0 THEN 'Not Started'                     -- No attempts yet
                        ELSE 'Not Assessed'
                    END AS priority_level,
                    CASE
                        WHEN blended_score BETWEEN 0.4 AND 0.799 THEN 1  -- Highest priority (partially mastered)
                        WHEN blended_score < 0.4 AND blended_score > 0 THEN 2  -- Medium priority (just started)
                        WHEN blended_score = 0 THEN 3                     -- Low priority (not started)
                        WHEN blended_score >= 0.8 THEN 4                 -- Already mastered
                        ELSE 5                                        -- Not assessed
                    END AS priority_order
                FROM
                    subskill_scores
            ),
            
            -- Combined query with readiness and priority information
            combined_data AS (
                -- Start with all problem attempts
                SELECT 
                    -- Problem attempt data
                    a.student_id,
                    c.subject,
                    c.skill_id,
                    c.subskill_id,
                    a.normalized_score as score,
                    a.attempt_timestamp,
                    
                    -- Curriculum data
                    c.grade AS curriculum_grade,
                    c.unit_id,
                    c.unit_title,
                    c.skill_description,
                    c.subskill_description,
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
                    sp.attempt_count,
                    
                    -- Include next subskill in learning path
                    slp.next_subskill_id AS next_subskill,
                    
                    -- Individual attempt indicator (for counting)
                    1 AS is_individual_attempt
                FROM 
                    all_attempts a
                JOIN 
                    all_curriculum_items c ON a.subskill_id = c.subskill_id
                LEFT JOIN
                    ready_subskills rs ON a.student_id = rs.student_id AND a.subskill_id = rs.subskill_id
                LEFT JOIN 
                    unlocked_skills us ON a.student_id = us.student_id AND c.skill_id = us.skill_id
                LEFT JOIN
                    subskill_proficiency sp ON a.student_id = sp.student_id AND a.subskill_id = sp.subskill_id
                LEFT JOIN
                    skill_proficiency skp ON a.student_id = skp.student_id AND c.skill_id = skp.skill_id
                LEFT JOIN
                    subskill_learning_paths slp ON a.subskill_id = slp.current_subskill_id
                LEFT JOIN
                    item_priority ip ON a.student_id = ip.student_id AND a.subskill_id = ip.subskill_id
                    
                UNION ALL
                
                -- Add curriculum items without attempts
                SELECT 
                    $1 AS student_id,
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
                    'No Attempts' AS coverage_status,
                    
                    -- Simplified readiness indicator that combines skill and subskill readiness
                    CASE 
                        WHEN rs.subskill_id IS NOT NULL AND us.skill_id IS NOT NULL THEN 'Ready'
                        WHEN rs.subskill_id IS NOT NULL THEN 'Ready for Subskill'
                        WHEN us.skill_id IS NOT NULL THEN 'Ready for Skill'
                        ELSE 'Not Ready'
                    END AS readiness_status,
                    
                    -- Add priority label
                    COALESCE(ip.priority_level, 'Not Started') AS priority_level,
                    COALESCE(ip.priority_order, 3) AS priority_order,
                    
                    -- Label for next recommended item
                    CASE
                        WHEN rs.subskill_id IS NOT NULL AND ip.priority_level IN ('High Priority', 'Medium Priority') 
                        THEN 'Recommended Next'
                        ELSE NULL
                    END AS recommended_next,
                    
                    -- Include proficiency data
                    COALESCE(sp.proficiency, 0) AS subskill_proficiency,
                    COALESCE(skp.proficiency, 0) AS skill_proficiency,
                    COALESCE(sp.attempt_count, 0) AS attempt_count,
                    
                    -- Include next subskill in learning path
                    slp.next_subskill_id AS next_subskill,
                    
                    -- Not an individual attempt
                    0 AS is_individual_attempt
                FROM 
                    all_curriculum_items c
                LEFT JOIN
                    ready_subskills rs ON $1 = rs.student_id AND c.subskill_id = rs.subskill_id
                LEFT JOIN 
                    unlocked_skills us ON $1 = us.student_id AND c.skill_id = us.skill_id
                LEFT JOIN
                    subskill_proficiency sp ON $1 = sp.student_id AND c.subskill_id = sp.subskill_id
                LEFT JOIN
                    skill_proficiency skp ON $1 = skp.student_id AND c.skill_id = skp.skill_id
                LEFT JOIN
                    subskill_learning_paths slp ON c.subskill_id = slp.current_subskill_id
                LEFT JOIN
                    item_priority ip ON $1 = ip.student_id AND c.subskill_id = ip.subskill_id
                WHERE 
                    NOT EXISTS (
                        SELECT 1 
                        FROM all_attempts a 
                        WHERE a.subskill_id = c.subskill_id
                        AND a.student_id = $1
                    )
            )
            
            -- Return all data
            SELECT
                *,
                (SELECT COUNT(*) FROM all_attempts WHERE student_id = $1) AS total_attempt_count,
                (SELECT COUNT(DISTINCT subskill_id) FROM all_attempts WHERE student_id = $1) AS attempted_subskills_count
            FROM
                combined_data
            ORDER BY
                subject,
                unit_id,
                skill_id,
                subskill_id,
                attempt_timestamp
            """
            
            result = await conn.fetch(query, student_id, subject, start_date, end_date)
                        
            logger.info(f"Retrieved {len(result)} rows from the database.")
                        
            # Check if we have any results
            if not result:
                logger.info("No results found, returning empty response.")
                return {
                    "summary": {
                        "mastery": 0,
                        "proficiency": 0,
                        "completion": 0,
                        "avg_score": 0,
                        "ready_items": 0,
                        "recommended_items": 0,
                        "total_items": 0,
                        "attempted_items": 0
                    },
                    "date_range": {
                        "start_date": start_date.isoformat() if start_date else None,
                        "end_date": end_date.isoformat() if end_date else None,
                    },
                    "hierarchical_data": []
                }
                        
            # Create date range dictionary
            date_range = {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
                        
            logger.info(f"Date range: {date_range}")
                        
            # Count total individual attempts
            first_row = dict(result[0])
            total_individual_attempts = first_row.get("total_attempt_count", 0)
            logger.info(f"Total individual attempts: {total_individual_attempts}")
                        
            # Count distinct subskills attempted
            attempted_subskills_count = first_row.get("attempted_subskills_count", 0) 
            logger.info(f"Distinct subskills attempted: {attempted_subskills_count}")
                        
            # First, collect all attempts by subskill
            subskill_attempts = {}
            for row in result:
                row_dict = dict(row)
                subskill_id = row_dict["subskill_id"]
                is_individual_attempt = bool(row_dict["is_individual_attempt"])
                attempt_timestamp = row_dict.get("attempt_timestamp")
                score = row_dict.get("score")
                
                if is_individual_attempt and score is not None:
                    if subskill_id not in subskill_attempts:
                        subskill_attempts[subskill_id] = []
                    
                    subskill_attempts[subskill_id].append({
                        "timestamp": attempt_timestamp,
                        "score": score
                    })

            # Log all attempts for each subskill
            logger.info("Individual attempts by subskill:")
            for subskill_id, attempts in subskill_attempts.items():
                logger.info(f"  {subskill_id}: {len(attempts)} attempts")
                for i, attempt in enumerate(attempts, 1):
                    logger.info(f"    Attempt {i}: timestamp={attempt['timestamp'].isoformat() if attempt['timestamp'] else 'None'}, score={attempt['score']}")
                        
            # Create hierarchical structure - first pass to organize data
            units = {}
                        
            # Debug dictionary to track raw scores by subskill
            raw_scores = {}
            attempt_counts = {}
                        
            # Group individual attempts by skill for tracking
            skill_attempts = {}
                        
            for row in result:
                row_dict = dict(row)
                
                unit_id = row_dict["unit_id"]
                unit_title = row_dict["unit_title"]
                skill_id = row_dict["skill_id"]
                skill_description = row_dict["skill_description"]
                subskill_id = row_dict["subskill_id"]
                subskill_description = row_dict["subskill_description"]
                
                is_individual_attempt = bool(row_dict["is_individual_attempt"])
                attempt_timestamp = row_dict.get("attempt_timestamp")
                score = row_dict.get("score")
                readiness_status = row_dict["readiness_status"]
                
                # Track at skill level if this is an individual attempt
                if is_individual_attempt and score is not None:
                    if skill_id not in skill_attempts:
                        skill_attempts[skill_id] = []
                    
                    skill_attempts[skill_id].append({
                        "timestamp": attempt_timestamp,
                        "score": score,
                        "subskill_id": subskill_id
                    })
                
                # Get proficiency for this subskill
                proficiency = float(row_dict["subskill_proficiency"]) if row_dict["subskill_proficiency"] is not None else 0
                
                # Initialize unit if it doesn't exist
                if unit_id not in units:
                    logger.info(f"Initializing unit {unit_id}: {unit_title}")
                    units[unit_id] = {
                        "unit_id": unit_id,
                        "unit_title": unit_title,
                        "skills": {},
                        "mastery": 0,
                        "proficiency": 0,
                        "completion": 0,
                        "avg_score": 0,
                        "attempted": 0,
                        "total": 0
                    }
                
                # Initialize skill if it doesn't exist in this unit
                if skill_id not in units[unit_id]["skills"]:
                    logger.info(f"Initializing skill {skill_id}: {skill_description}")
                    units[unit_id]["skills"][skill_id] = {
                        "skill_id": skill_id,
                        "skill_description": skill_description,
                        "subskills": {},  # Use dictionary to avoid duplicates
                        "mastery": 0,
                        "proficiency": 0,
                        "completion": 0,
                        "avg_score": 0,
                        "attempted": 0,
                        "total": 0
                    }
                
                # Only process each subskill once for structure building
                if subskill_id not in units[unit_id]["skills"][skill_id]["subskills"]:
                    # Check if this subskill has any attempts
                    is_attempted = subskill_id in subskill_attempts
                    attempt_count = len(subskill_attempts.get(subskill_id, []))
                    
                    # FIXED: Calculate actual average score from all attempts
                    if is_attempted and attempt_count > 0:
                        # Get all individual scores
                        individual_scores = [float(a["score"]) for a in subskill_attempts[subskill_id]]
                        # Calculate true average
                        avg_score = sum(individual_scores) / len(individual_scores)
                        logger.info(f"Calculating avg_score for {subskill_id}: sum={sum(individual_scores)}, count={len(individual_scores)}, result={avg_score}")
                    else:
                        avg_score = 0
                    
                    # Log raw data from database
                    logger.info(f"Raw data for {subskill_id}: attempted={is_attempted}, proficiency={proficiency}, avg_score={avg_score}, readiness={readiness_status}, attempts={attempt_count}")
                    
                    # Track raw scores for debugging
                    raw_scores[subskill_id] = {
                        "proficiency": proficiency,
                        "avg_score": avg_score,
                        "is_attempted": is_attempted,
                        "readiness_status": readiness_status
                    }
                    
                    attempt_counts[subskill_id] = attempt_count
                    
                    # Create subskill object with corrected average score
                    subskill = {
                        "subskill_id": subskill_id,
                        "subskill_description": subskill_description,
                        "mastery": proficiency,  # Keep proficiency value for mastery for calculation consistency
                        "avg_score": avg_score,  # Now uses the correctly calculated average
                        "proficiency": proficiency if readiness_status == "Ready" else 0,
                        "completion": 100 if is_attempted else 0,
                        "is_attempted": is_attempted,
                        "readiness_status": readiness_status,
                        "priority_level": row_dict["priority_level"],
                        "priority_order": row_dict["priority_order"],
                        "next_subskill": row_dict["next_subskill"],
                        "recommended_next": row_dict["recommended_next"],
                        "attempt_count": attempt_count,
                        "individual_attempts": subskill_attempts.get(subskill_id, [])
                    }
                    
                    units[unit_id]["skills"][skill_id]["subskills"][subskill_id] = subskill
                    
                    # Update unit and skill counts
                    units[unit_id]["total"] += 1
                    units[unit_id]["skills"][skill_id]["total"] += 1
                    
                    if is_attempted:
                        units[unit_id]["attempted"] += 1
                        units[unit_id]["skills"][skill_id]["attempted"] += 1
            
            # Log all attempts for each subskill
            logger.info("Individual attempts by subskill:")
            for subskill_id, attempts in subskill_attempts.items():
                logger.info(f"  {subskill_id}: {len(attempts)} attempts")
                for i, attempt in enumerate(attempts, 1):
                    logger.info(f"    Attempt {i}: timestamp={attempt['timestamp'].isoformat() if attempt['timestamp'] else 'None'}, score={attempt['score']}")
            
            logger.info(f"Organized data into {len(units)} units")
            
            # Second pass - convert subskills dictionaries to lists and calculate metrics
            all_attempted_subskills = []
            all_ready_attempted_subskills = []
            total_curriculum_items = 0
            total_attempted_items = 0
            
            # For avg_score calculation across the entire hierarchy
            all_individual_scores = []
            
            logger.info("Beginning metrics calculations...")
            
            for unit_id, unit in units.items():
                logger.info(f"Calculating metrics for unit {unit_id}")
                
                unit_attempted_subskills = []
                unit_ready_attempted_subskills = []
                unit_skills = []
                
                # For unit avg_score
                unit_individual_scores = []
                
                for skill_id, skill in unit["skills"].items():
                    logger.info(f"  Calculating metrics for skill {skill_id}")
                    
                    skill_attempted_subskills = []
                    skill_ready_attempted_subskills = []
                    
                    # For skill avg_score
                    skill_individual_scores = []
                    
                    # Collect all individual attempts for this skill
                    if skill_id in skill_attempts:
                        for attempt in skill_attempts[skill_id]:
                            skill_individual_scores.append(float(attempt["score"]))
                            unit_individual_scores.append(float(attempt["score"]))
                            all_individual_scores.append(float(attempt["score"]))
                    
                    # Convert subskills dictionary to list
                    subskills_list = list(skill["subskills"].values())
                    
                    # Process subskills for this skill
                    for subskill in subskills_list:
                        # Log subskill data
                        logger.info(f"    Subskill {subskill['subskill_id']}: mastery={subskill['mastery']}, avg_score={subskill['avg_score']}, attempted={subskill['is_attempted']}, ready={subskill['readiness_status']}")
                        
                        # Count totals
                        total_curriculum_items += 1
                        
                        if subskill["is_attempted"]:
                            total_attempted_items += 1
                            
                            # Add to appropriate lists for mastery calculation
                            skill_attempted_subskills.append(subskill)
                            unit_attempted_subskills.append(subskill)
                            all_attempted_subskills.append(subskill)
                            
                            # Add to appropriate lists for proficiency calculation if ready
                            if subskill["readiness_status"] == "Ready":
                                skill_ready_attempted_subskills.append(subskill)
                                unit_ready_attempted_subskills.append(subskill)
                                all_ready_attempted_subskills.append(subskill)
                    
                    # Calculate skill metrics
                    if skill_attempted_subskills:
                        skill_mastery_sum = sum(s["mastery"] for s in skill_attempted_subskills)
                        skill_mastery = skill_mastery_sum / skill["total"]
                        logger.info(f"    Skill {skill_id} mastery calculation: sum={skill_mastery_sum}, count={skill['total']}, result={skill_mastery}")
                    else:
                        skill_mastery = 0
                        logger.info(f"    Skill {skill_id} has no attempted subskills, mastery=0")
                    
                    if skill_ready_attempted_subskills:
                        skill_proficiency_sum = sum(s["proficiency"] for s in skill_ready_attempted_subskills)
                        skill_proficiency = skill_proficiency_sum / len(skill_ready_attempted_subskills)
                        logger.info(f"    Skill {skill_id} proficiency calculation: sum={skill_proficiency_sum}, count={len(skill_ready_attempted_subskills)}, result={skill_proficiency}")
                    else:
                        skill_proficiency = 0
                        logger.info(f"    Skill {skill_id} has no ready attempted subskills, proficiency=0")
                    
                    # Calculate skill avg_score (direct average of all attempts)
                    if skill_individual_scores:
                        skill_avg_score = sum(skill_individual_scores) / len(skill_individual_scores)
                        logger.info(f"    Skill {skill_id} avg_score calculation: sum={sum(skill_individual_scores)}, count={len(skill_individual_scores)}, result={skill_avg_score}")
                    else:
                        skill_avg_score = 0
                        logger.info(f"    Skill {skill_id} has no attempts, avg_score=0")
                    
                    skill_completion = (skill["attempted"] / skill["total"] * 100) if skill["total"] > 0 else 0
                    logger.info(f"    Skill {skill_id} completion: attempted={skill['attempted']}, total={skill['total']}, result={skill_completion}%")
                    
                    # Create the skill object for the output
                    skill_obj = {
                        "skill_id": skill_id,
                        "skill_description": skill["skill_description"],
                        "mastery": skill_mastery,
                        "proficiency": skill_proficiency,
                        "avg_score": skill_avg_score,  # Include avg_score
                        "completion": skill_completion,
                        "attempted_subskills": skill["attempted"],  # Rename for clarity
                        "total_subskills": skill["total"],          # Rename for clarity
                        "attempt_count": sum(s["attempt_count"] for s in skill["subskills"].values()),  # Add total attempts
                        "subskills": subskills_list
                    }
                    
                    unit_skills.append(skill_obj)
                
                # Calculate unit metrics
                if unit_attempted_subskills:
                    unit_mastery_sum = sum(s["mastery"] for s in unit_attempted_subskills)
                    unit_mastery = unit_mastery_sum / unit["total"]
                    logger.info(f"  Unit {unit_id} mastery calculation: sum={unit_mastery_sum}, count={unit['total']}, result={unit_mastery}")
                else:
                    unit_mastery = 0
                    logger.info(f"  Unit {unit_id} has no attempted subskills, mastery=0")
                
                if unit_ready_attempted_subskills:
                    unit_proficiency_sum = sum(s["proficiency"] for s in unit_ready_attempted_subskills)
                    unit_proficiency = unit_proficiency_sum / len(unit_ready_attempted_subskills)
                    logger.info(f"  Unit {unit_id} proficiency calculation: sum={unit_proficiency_sum}, count={len(unit_ready_attempted_subskills)}, result={unit_proficiency}")
                else:
                    unit_proficiency = 0
                    logger.info(f"  Unit {unit_id} has no ready attempted subskills, proficiency=0")
                
                # Calculate unit avg_score (direct average of all attempts)
                if unit_individual_scores:
                    unit_avg_score = sum(unit_individual_scores) / len(unit_individual_scores)
                    logger.info(f"  Unit {unit_id} avg_score calculation: sum={sum(unit_individual_scores)}, count={len(unit_individual_scores)}, result={unit_avg_score}")
                else:
                    unit_avg_score = 0
                    logger.info(f"  Unit {unit_id} has no attempts, avg_score=0")
                
                unit_completion = (unit["attempted"] / unit["total"] * 100) if unit["total"] > 0 else 0
                logger.info(f"  Unit {unit_id} completion: attempted={unit['attempted']}, total={unit['total']}, result={unit_completion}%")
                
                # Update unit with calculated metrics and skills list
                unit["mastery"] = unit_mastery
                unit["proficiency"] = unit_proficiency
                unit["avg_score"] = unit_avg_score  # Include avg_score
                unit["completion"] = unit_completion
                unit["attempted_skills"] = unit["attempted"]  # Rename
                unit["total_skills"] = unit["total"]         # Rename
                unit["attempt_count"] = sum(s["attempt_count"] for s in unit_skills)  # Add total attempts
                unit["skills"] = unit_skills
            
            # Calculate overall metrics
            logger.info("Calculating overall metrics...")
            
            if all_attempted_subskills:
                overall_mastery_sum = sum(s["mastery"] for s in all_attempted_subskills)
                overall_mastery = overall_mastery_sum / total_curriculum_items
                logger.info(f"Overall mastery calculation: sum={overall_mastery_sum}, count={total_curriculum_items}, result={overall_mastery}")
            else:
                overall_mastery = 0
                logger.info("No attempted subskills found, overall mastery=0")
            
            if all_ready_attempted_subskills:
                overall_proficiency_sum = sum(s["proficiency"] for s in all_ready_attempted_subskills)
                overall_proficiency = overall_proficiency_sum / len(all_ready_attempted_subskills)
                logger.info(f"Overall proficiency calculation: sum={overall_proficiency_sum}, count={len(all_ready_attempted_subskills)}, result={overall_proficiency}")
            else:
                overall_proficiency = 0
                logger.info("No ready attempted subskills found, overall proficiency=0")
            
            # Calculate overall avg_score (direct average of all attempts)
            if all_individual_scores:
                overall_avg_score = sum(all_individual_scores) / len(all_individual_scores)
                logger.info(f"Overall avg_score calculation: sum={sum(all_individual_scores)}, count={len(all_individual_scores)}, result={overall_avg_score}")
            else:
                overall_avg_score = 0
                logger.info("No attempts found, overall avg_score=0")
            
            overall_completion = (total_attempted_items / total_curriculum_items * 100) if total_curriculum_items > 0 else 0
            logger.info(f"Overall completion: attempted={total_attempted_items}, total={total_curriculum_items}, result={overall_completion}%")
            
            # Count ready items and recommended items
            ready_items = sum(1 for row in result if row["readiness_status"] == "Ready")
            recommended_items = sum(1 for row in result if row["recommended_next"] is not None)
            
            # Create summary
            summary = {
                "mastery": float(overall_mastery),
                "proficiency": float(overall_proficiency),
                "avg_score": float(overall_avg_score),
                "completion": float(overall_completion),
                "attempted_items": total_attempted_items,     # Rename for clarity
                "total_items": total_curriculum_items,        # Keep as is
                "attempt_count": total_individual_attempts,   # Consistently name the attempt count
                "ready_items": ready_items,
                "recommended_items": recommended_items
            }
            
            logger.info(f"Final summary: {summary}")
            
            # Convert units dictionary to list and sort
            hierarchical_data = list(units.values())
            hierarchical_data.sort(key=lambda x: x["unit_id"])
            
            logger.info(f"Returning {len(hierarchical_data)} units with hierarchical data")
            
            return {
                "summary": summary,
                "date_range": date_range,
                "hierarchical_data": hierarchical_data
            }
        except Exception as e:
            logger.error(f"Error calculating hierarchical metrics: {e}")
            logger.exception("Full exception details:")
            raise
        finally:
            await conn.close()
    
    async def get_timeseries_metrics(self, student_id: int, subject: Optional[str] = None,
                                interval: str = 'month', level: str = 'subject',
                                start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None,
                                unit_id: Optional[str] = None,
                                skill_id: Optional[str] = None,
                                include_hierarchy: bool = False) -> List[Dict]:
        """
        Get metrics over time for a student at the specified hierarchy level.
        """
        from datetime import timedelta  # Move this import to the top of your file

        logger.info(f"=== TIMESERIES FUNCTION STARTED ===")
        logger.info(f"Parameters: student_id={student_id}, subject={subject}, interval={interval}, level={level}")
        logger.info(f"Date range: start_date={start_date}, end_date={end_date}")
        logger.info(f"Filters: unit_id={unit_id}, skill_id={skill_id}, include_hierarchy={include_hierarchy}")
        
        conn = await self.get_pg_connection()
        try:
            logger.info("Successfully established database connection")
            
            # Convert dates to the correct format for PostgreSQL
            if start_date and start_date.tzinfo:
                start_date = start_date.replace(tzinfo=None)
                logger.info(f"Removed timezone from start_date: {start_date}")
        
            if end_date and end_date.tzinfo:
                end_date = end_date.replace(tzinfo=None)
                logger.info(f"Removed timezone from end_date: {end_date}")

            # Determine the date trunc function based on interval
            trunc_function = interval.lower()
            if trunc_function not in ('day', 'week', 'month', 'quarter', 'year'):
                logger.warning(f"Invalid interval '{interval}', defaulting to 'month'")
                trunc_function = 'month'
            
            logger.info(f"Using trunc_function: {trunc_function}")
            
            # First, check if there's any data at all for this student and subject
            test_query = """
            SELECT COUNT(*) as count, 
                MIN(timestamp) as min_date, 
                MAX(timestamp) as max_date
            FROM attempts 
            WHERE student_id = $1 
            AND ($2::text IS NULL OR subject = $2)
            """
            test_result = await conn.fetchrow(test_query, student_id, subject)
            attempt_count = test_result['count'] if test_result else 0
            min_date = test_result['min_date'] if test_result and 'min_date' in test_result else None
            max_date = test_result['max_date'] if test_result and 'max_date' in test_result else None
            
            logger.info(f"Initial data check: Found {attempt_count} total attempts")
            logger.info(f"Date range in database: {min_date} to {max_date}")
            
            # If start_date and end_date are provided, check if they overlap with data
            if start_date and max_date and start_date > max_date:
                logger.warning(f"start_date {start_date} is after the latest data date {max_date}")
            if end_date and min_date and end_date < min_date:
                logger.warning(f"end_date {end_date} is before the earliest data date {min_date}")
            
            # Check if there's any subject-specific data
            if subject:
                subject_query = """
                SELECT COUNT(*) as count 
                FROM attempts 
                WHERE student_id = $1 
                AND subject = $2
                """
                subject_count = await conn.fetchval(subject_query, student_id, subject)
                logger.info(f"Subject-specific check: Found {subject_count} attempts for subject '{subject}'")
                
                # Log some sample data if available
                if subject_count > 0:
                    sample_query = """
                    SELECT student_id, subject, timestamp, score
                    FROM attempts 
                    WHERE student_id = $1 
                    AND subject = $2
                    LIMIT 3
                    """
                    sample_data = await conn.fetch(sample_query, student_id, subject)
                    logger.info(f"Sample data for debugging: {[dict(row) for row in sample_data]}")
                else:
                    logger.warning(f"NO DATA FOUND FOR SUBJECT '{subject}'")
                    # Check if there's a case mismatch issue
                    case_query = """
                    SELECT DISTINCT subject
                    FROM attempts 
                    WHERE student_id = $1 
                    AND LOWER(subject) = LOWER($2)
                    """
                    case_results = await conn.fetch(case_query, student_id, subject)
                    if case_results:
                        logger.warning(f"Found similar subjects with different case: {[row['subject'] for row in case_results]}")
            
            # Query to get distinct time intervals
            intervals_query = """
            SELECT DISTINCT
                DATE_TRUNC($3, timestamp) AS interval_date
            FROM
                attempts
            WHERE
                student_id = $1
                AND ($2::text IS NULL OR subject = $2)
                AND ($4::timestamp IS NULL OR timestamp >= $4::timestamp)
                AND ($5::timestamp IS NULL OR timestamp <= $5::timestamp)
            ORDER BY
                interval_date
            """
            
            logger.info(f"Executing intervals query with parameters: [{student_id}, {subject}, {trunc_function}, {start_date}, {end_date}]")
            
            # Get all distinct time intervals
            intervals = await conn.fetch(intervals_query, student_id, subject, trunc_function, start_date, end_date)
            
            logger.info(f"Found {len(intervals)} time intervals:")
            for idx, interval_row in enumerate(intervals):
                logger.info(f"  Interval {idx+1}: {interval_row['interval_date']}")
            
            # If no intervals found, return empty list
            if not intervals:
                logger.warning("No intervals found with the provided filters - returning empty result")
                return []
                
            # For each interval, calculate metrics
            timeseries_intervals = []
            
            for interval_idx, interval_row in enumerate(intervals):
                interval_date = interval_row["interval_date"]
                interval_start = interval_date
                
                logger.info(f"Processing interval {interval_idx+1}/{len(intervals)}: {interval_date}")
                
                # Calculate the end of this interval
                if trunc_function == 'day':
                    interval_end = interval_date + timedelta(days=1)
                elif trunc_function == 'week':
                    interval_end = interval_date + timedelta(weeks=1)
                elif trunc_function == 'month':
                    # Get next month
                    if interval_date.month == 12:
                        interval_end = datetime(interval_date.year + 1, 1, 1)
                    else:
                        interval_end = datetime(interval_date.year, interval_date.month + 1, 1)
                elif trunc_function == 'quarter':
                    # Add 3 months
                    quarter_month = ((interval_date.month - 1) // 3) * 3 + 1
                    if quarter_month + 3 > 12:
                        interval_end = datetime(interval_date.year + 1, (quarter_month + 3) % 12 or 12, 1)
                    else:
                        interval_end = datetime(interval_date.year, quarter_month + 3, 1)
                else:  # year
                    interval_end = datetime(interval_date.year + 1, 1, 1)
                
                logger.info(f"Interval date range: {interval_start} to {interval_end}")
                
                # Check how many attempts fall into this interval for this student/subject
                count_query = """
                SELECT COUNT(*) 
                FROM attempts 
                WHERE student_id = $1
                AND ($2::text IS NULL OR subject = $2)
                AND timestamp >= $3
                AND timestamp < $4
                """
                interval_count = await conn.fetchval(count_query, student_id, subject, interval_start, interval_end)
                logger.info(f"Found {interval_count} attempts in this interval")
                
                if interval_count == 0:
                    logger.warning(f"No attempts found in interval {interval_start} to {interval_end} despite it being returned by the intervals query")
                
                # Get metrics for this interval by calling get_hierarchical_metrics
                logger.info(f"Calling get_hierarchical_metrics for this interval")
                interval_metrics = await self.get_hierarchical_metrics(
                    student_id, subject, interval_start, interval_end
                )
                
                logger.info(f"Retrieved hierarchical metrics with {len(interval_metrics.get('hierarchical_data', []))} units")
                logger.info(f"Summary metrics: {interval_metrics.get('summary', {})}")
                
                # Create interval data point
                interval_data = {
                    "interval_date": interval_date.isoformat(),
                    "summary": interval_metrics["summary"]
                }
                
                # Include hierarchical data if requested
                if include_hierarchy:
                    logger.info(f"Processing hierarchical data filter for level={level}, unit_id={unit_id}, skill_id={skill_id}")
                    filtered_data = []
                    original_units = len(interval_metrics["hierarchical_data"])
                    
                    # Filter hierarchical data based on level
                    if level == 'unit' and unit_id:
                        # Filter to just the requested unit
                        filtered_units = [u for u in interval_metrics["hierarchical_data"] if u["unit_id"] == unit_id]
                        filtered_data = filtered_units
                        logger.info(f"Filtered {original_units} units to {len(filtered_data)} units matching unit_id={unit_id}")
                    elif level == 'skill' and unit_id and skill_id:
                        # Filter to just the requested skill within the unit
                        for unit in interval_metrics["hierarchical_data"]:
                            if unit["unit_id"] == unit_id:
                                unit_skills = len(unit["skills"])
                                filtered_skills = [s for s in unit["skills"] if s["skill_id"] == skill_id]
                                logger.info(f"Unit {unit_id}: Filtered {unit_skills} skills to {len(filtered_skills)} skills matching skill_id={skill_id}")
                                if filtered_skills:
                                    filtered_data = [{
                                        "unit_id": unit["unit_id"],
                                        "unit_title": unit["unit_title"],
                                        "skills": filtered_skills
                                    }]
                                    break
                    elif level == 'subskill' and unit_id and skill_id:
                        # Filter to just the requested unit and skill (keeping all subskills)
                        for unit in interval_metrics["hierarchical_data"]:
                            if unit["unit_id"] == unit_id:
                                for skill in unit["skills"]:
                                    if skill["skill_id"] == skill_id:
                                        subskill_count = len(skill["subskills"])
                                        logger.info(f"Found skill {skill_id} with {subskill_count} subskills")
                                        filtered_data = [{
                                            "unit_id": unit["unit_id"],
                                            "unit_title": unit["unit_title"],
                                            "skills": [{
                                                "skill_id": skill["skill_id"],
                                                "skill_description": skill["skill_description"],
                                                "subskills": skill["subskills"]
                                            }]
                                        }]
                                        break
                    else:
                        # For subject level or when no filters provided, include all hierarchical data
                        filtered_data = interval_metrics["hierarchical_data"]
                        logger.info(f"Using all {len(filtered_data)} units for level={level}")
                    
                    interval_data["hierarchical_data"] = filtered_data
                    
                    if not filtered_data:
                        logger.warning(f"Hierarchical data filtering resulted in EMPTY data for level={level}, unit_id={unit_id}, skill_id={skill_id}")
                
                timeseries_intervals.append(interval_data)
                logger.info(f"Successfully processed interval {interval_idx+1}")
            
            logger.info(f"Returning {len(timeseries_intervals)} timeseries intervals")
            logger.info(f"=== TIMESERIES FUNCTION COMPLETED SUCCESSFULLY ===")
            return timeseries_intervals
            
        except Exception as e:
            logger.error(f"=== ERROR IN TIMESERIES FUNCTION ===")
            logger.error(f"Error calculating timeseries metrics: {e}")
            logger.exception("Full exception details:")
            raise
        finally:
            logger.info("Closing database connection")
            await conn.close()

    async def get_recommendations(self, student_id: int, subject: Optional[str] = None, limit: int = 5) -> List[Dict]:
        """
        Get recommended next steps for a student based on priority and readiness.
        """
        try:
            # First get the hierarchical metrics which contain readiness and priority info
            metrics = await self.get_hierarchical_metrics(student_id, subject)
            
            # Get base node information directly from database
            conn = await self.get_pg_connection()
            try:
                # Get base nodes for this subject
                base_node_query = """
                SELECT DISTINCT prerequisite_skill_id 
                FROM learning_paths 
                WHERE is_base_node = TRUE
                AND ($1::text IS NULL OR prerequisite_skill_id LIKE $1 || '%')
                """
                pattern = subject if subject else None
                base_nodes = await conn.fetch(base_node_query, pattern)
                base_node_skills = set(row['prerequisite_skill_id'] for row in base_nodes)
                
                logger.info(f"Found {len(base_node_skills)} base node skills for {subject}: {base_node_skills}")
            finally:
                await conn.close()
            
            # Extract all subskills from the hierarchical data
            all_subskills = []
            for unit in metrics["hierarchical_data"]:
                for skill in unit["skills"]:
                    for subskill in skill["subskills"]:
                        # Add unit and skill info to each subskill
                        subskill["unit_id"] = unit["unit_id"]
                        subskill["unit_title"] = unit["unit_title"]
                        subskill["skill_id"] = skill["skill_id"]
                        subskill["skill_description"] = skill["skill_description"]
                        subskill["is_base_node"] = skill["skill_id"] in base_node_skills
                        all_subskills.append(subskill)
            
            logger.info(f"Processing {len(all_subskills)} subskills for recommendations")
            
            # These will be our recommendations
            recommended_subskills = []
            
            # First, look for base node subskills that haven't been attempted yet
            base_nodes_not_attempted = [
                s for s in all_subskills
                if s.get("is_base_node") and not s["is_attempted"]
            ]
            
            if base_nodes_not_attempted:
                logger.info(f"Found {len(base_nodes_not_attempted)} base nodes that haven't been attempted")
                # Sort by skill_id (this is fairly arbitrary but provides consistency)
                base_nodes_not_attempted.sort(key=lambda x: x["skill_id"])
                recommended_subskills.extend(base_nodes_not_attempted[:limit])
            
            # Then add explicitly recommended items if we have room
            if len(recommended_subskills) < limit:
                explicitly_recommended = [
                    s for s in all_subskills
                    if s["recommended_next"] and
                    not any(r["subskill_id"] == s["subskill_id"] for r in recommended_subskills)
                ]
                logger.info(f"Found {len(explicitly_recommended)} explicitly recommended items")
                recommended_subskills.extend(explicitly_recommended[:limit - len(recommended_subskills)])
            
            # Then add ready items that are not mastered, ordered by priority
            if len(recommended_subskills) < limit:
                ready_not_mastered = [
                    s for s in all_subskills
                    if s["readiness_status"] == "Ready" and
                    s["priority_level"] != "Mastered" and
                    not any(r["subskill_id"] == s["subskill_id"] for r in recommended_subskills)
                ]
                logger.info(f"Found {len(ready_not_mastered)} ready items that are not mastered")
                ready_not_mastered.sort(key=lambda x: x["priority_order"])
                recommended_subskills.extend(ready_not_mastered[:limit - len(recommended_subskills)])
            
            # If we still don't have enough recommendations, add any subskills that are in the "Ready for Subskill" state
            if len(recommended_subskills) < limit:
                ready_for_subskill = [
                    s for s in all_subskills
                    if s["readiness_status"] == "Ready for Subskill" and
                    not any(r["subskill_id"] == s["subskill_id"] for r in recommended_subskills)
                ]
                logger.info(f"Found {len(ready_for_subskill)} items in 'Ready for Subskill' state")
                ready_for_subskill.sort(key=lambda x: x["subskill_id"])  # Consistent ordering
                recommended_subskills.extend(ready_for_subskill[:limit - len(recommended_subskills)])
            
            logger.info(f"Final recommendation count: {len(recommended_subskills)}")
            
            # Format the recommendations according to the API spec
            recommendations = []
            for item in recommended_subskills[:limit]:
                # Determine recommendation type and priority
                if item.get("is_base_node"):
                    rec_type = "base_node"
                    priority = "high"
                    message = f"Start with this foundational topic: {item['subskill_description']}"
                elif item["is_attempted"]:
                    rec_type = "performance_gap"
                    priority = "high" if item["priority_level"] == "High Priority" else "medium"
                    message = f"Focus on improving your performance on {item['subskill_description']}"
                else:
                    rec_type = "coverage_gap"
                    priority = "medium"
                    message = f"Start working on {item['subskill_description']}"
                
                recommendations.append({
                    "type": rec_type,
                    "priority": priority,
                    "unit_id": item["unit_id"],
                    "unit_title": item["unit_title"],
                    "skill_id": item["skill_id"],
                    "skill_description": item["skill_description"],
                    "subskill_id": item["subskill_id"],
                    "subskill_description": item["subskill_description"],
                    "proficiency": item["proficiency"],
                    "mastery": item["mastery"],
                    "avg_score": item["avg_score"],
                    "priority_level": item["priority_level"],
                    "priority_order": item["priority_order"],
                    "readiness_status": item["readiness_status"],
                    "is_ready": item["readiness_status"] in ["Ready", "Ready for Subskill"],
                    "completion": item["completion"],
                    "attempt_count": item["attempt_count"],
                    "is_attempted": item["is_attempted"],
                    "next_subskill": item["next_subskill"],
                    "message": message,
                    "is_base_node": item.get("is_base_node", False)
                })
            
            return recommendations
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            logger.exception("Full exception details:")
            raise