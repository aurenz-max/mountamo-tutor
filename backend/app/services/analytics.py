# refactored_analytics.py

import asyncpg
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
                -- Base case: First subskills in each sequence (those without prerequisite subskills)
                -- are always ready
                SELECT DISTINCT
                    $1 AS student_id,
                    c.subskill_id
                FROM
                    all_curriculum_items c
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

            -- Get all attempts for the student to count individual attempts
            all_attempts AS (
                SELECT
                    student_id,
                    subskill_id,
                    skill_id,
                    timestamp AS attempt_timestamp,
                    score / 10 as score
                FROM
                    attempts
                WHERE
                    student_id = $1
                    AND ($3::timestamp IS NULL OR timestamp >= $3::timestamp)
                    AND ($4::timestamp IS NULL OR timestamp <= $4::timestamp)
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
                    a.score,
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
                        "attempted": skill["attempted"],
                        "total": skill["total"],
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
                "avg_score": float(overall_avg_score),  # Include avg_score
                "completion": float(overall_completion),
                "ready_items": ready_items,
                "recommended_items": recommended_items,
                "total_items": total_curriculum_items,
                "attempted_items": total_attempted_items,
                "raw_attempt_count": total_individual_attempts  # Include the raw attempt count
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
                                skill_id: Optional[str] = None) -> List[Dict]:
        """
        Get metrics over time for a student at the specified hierarchy level.
        
        Args:
            student_id: The ID of the student
            subject: Optional subject filter
            interval: Time interval for grouping ('day', 'week', 'month', 'quarter', 'year')
            level: Hierarchy level ('subject', 'unit', 'skill', 'subskill')
            start_date: Optional start date
            end_date: Optional end date
            unit_id: Optional unit filter (required for skill and subskill levels)
            skill_id: Optional skill filter (required for subskill level)
            
        Returns:
            List of dictionaries containing metrics for each time interval
        """
        conn = await self.get_pg_connection()
        try:
            # Convert dates to the correct format for PostgreSQL
            if start_date and start_date.tzinfo:
                start_date = start_date.replace(tzinfo=None)  # Remove timezone info
        
            if end_date and end_date.tzinfo:
                end_date = end_date.replace(tzinfo=None)  # Remove timezone info

            
            # Determine the date trunc function based on interval
            trunc_function = interval.lower()
            if trunc_function not in ('day', 'week', 'month', 'quarter', 'year'):
                trunc_function = 'month'  # Default to month
            
            # Build query based on the hierarchy level
            if level == 'subject':
                query = """
                WITH 
                -- Get all attempts in the date range grouped by time interval and subject
                attempts_by_interval AS (
                    SELECT
                        student_id,
                        DATE_TRUNC($3, timestamp) AS interval_date,
                        subject,
                        subskill_id,
                        AVG(score / 10) AS avg_score
                    FROM
                        problem_reviews
                    WHERE
                        student_id = $1
                        AND ($4::timestamp IS NULL OR timestamp >= $4::timestamp)
                        AND ($5::timestamp IS NULL OR timestamp <= $5::timestamp)
                        AND ($2::text IS NULL OR subject = $2)
                    GROUP BY
                        student_id, interval_date, subject, subskill_id
                ),
                
                -- Count attempts and unique subskills per interval and subject
                counts_by_interval AS (
                    SELECT
                        interval_date,
                        subject,
                        COUNT(DISTINCT subskill_id) AS unique_subskills,
                        COUNT(*) AS attempt_count
                    FROM
                        attempts_by_interval
                    GROUP BY
                        interval_date, subject
                ),
                
                -- Calculate mastery per interval and subject
                mastery_by_interval AS (
                    SELECT
                        interval_date,
                        subject,
                        AVG(avg_score) AS mastery_score
                    FROM
                        attempts_by_interval
                    GROUP BY
                        interval_date, subject
                ),
                
                -- Get ready subskills
                ready_subskills AS (
                    -- First subskills in learning paths are always ready
                    SELECT DISTINCT
                        $1 AS student_id,
                        c.subject,
                        c.subskill_id
                    FROM
                        curriculum c
                    LEFT JOIN
                        subskill_learning_paths slp ON c.subskill_id = slp.next_subskill_id
                    WHERE
                        slp.current_subskill_id IS NULL
                        AND ($2::text IS NULL OR c.subject = $2)
                    
                    UNION
                    
                    -- Subskills where prerequisites are met
                    SELECT DISTINCT
                        $1 AS student_id,
                        c.subject,
                        slp.next_subskill_id AS subskill_id
                    FROM
                        curriculum c
                    JOIN
                        subskill_learning_paths slp ON c.subskill_id = slp.current_subskill_id
                    JOIN (
                        SELECT 
                            subskill_id
                        FROM 
                            problem_reviews
                        WHERE 
                            student_id = $1
                        GROUP BY 
                            subskill_id
                        HAVING 
                            AVG(score / 10) >= 0.6
                    ) pr ON slp.current_subskill_id = pr.subskill_id
                    WHERE
                        ($2::text IS NULL OR c.subject = $2)
                        AND slp.next_subskill_id IS NOT NULL
                ),
                
                -- Calculate proficiency per interval and subject
                proficiency_by_interval AS (
                    SELECT
                        a.interval_date,
                        a.subject,
                        AVG(a.avg_score) AS proficiency_score
                    FROM
                        attempts_by_interval a
                    JOIN
                        ready_subskills rs ON a.student_id = rs.student_id 
                                        AND a.subskill_id = rs.subskill_id
                                        AND a.subject = rs.subject
                    GROUP BY
                        a.interval_date, a.subject
                ),
                
                -- Calculate curriculum counts per subject
                curriculum_counts AS (
                    SELECT
                        subject,
                        COUNT(DISTINCT subskill_id) AS total_curriculum_items
                    FROM
                        curriculum
                    WHERE
                        ($2::text IS NULL OR subject = $2)
                    GROUP BY
                        subject
                ),
                
                -- Calculate ready curriculum counts per subject
                ready_counts AS (
                    SELECT
                        rs.subject,
                        COUNT(DISTINCT rs.subskill_id) AS total_ready_items
                    FROM
                        ready_subskills rs
                    GROUP BY
                        rs.subject
                )
                
                -- Combine all metrics by interval and subject
                SELECT
                    i.interval_date,
                    i.subject,
                    cc.total_curriculum_items,
                    COALESCE(rc.total_ready_items, 0) AS total_ready_items,
                    i.unique_subskills,
                    i.attempt_count,
                    m.mastery_score,
                    p.proficiency_score,
                    i.unique_subskills::float / cc.total_curriculum_items * 100 AS completion_percentage
                FROM
                    counts_by_interval i
                JOIN
                    curriculum_counts cc ON i.subject = cc.subject
                LEFT JOIN
                    ready_counts rc ON i.subject = rc.subject
                LEFT JOIN
                    mastery_by_interval m ON i.interval_date = m.interval_date AND i.subject = m.subject
                LEFT JOIN
                    proficiency_by_interval p ON i.interval_date = p.interval_date AND i.subject = p.subject
                ORDER BY
                    i.subject, i.interval_date
                """
                
                params = [student_id, subject, trunc_function, start_date, end_date]
                
            elif level == 'unit':
                query = """
                WITH 
                -- Get all attempts in the date range grouped by time interval, subject, and unit
                attempts_by_interval AS (
                    SELECT
                        pr.student_id,
                        DATE_TRUNC($3, pr.timestamp) AS interval_date,
                        pr.subject,
                        c.unit_id,
                        pr.subskill_id,
                        AVG(pr.score / 10) AS avg_score
                    FROM
                        problem_reviews pr
                    JOIN
                        curriculum c ON pr.subskill_id = c.subskill_id
                    WHERE
                        pr.student_id = $1
                        AND ($4::timestamp IS NULL OR pr.timestamp >= $4::timestamp)
                        AND ($5::timestamp IS NULL OR pr.timestamp <= $5::timestamp)
                        AND ($2::text IS NULL OR pr.subject = $2)
                        AND ($6::text IS NULL OR c.unit_id = $6)
                    GROUP BY
                        pr.student_id, interval_date, pr.subject, c.unit_id, pr.subskill_id
                ),
                
                -- Count attempts and unique subskills per interval, subject, and unit
                counts_by_interval AS (
                    SELECT
                        interval_date,
                        subject,
                        unit_id,
                        COUNT(DISTINCT subskill_id) AS unique_subskills,
                        COUNT(*) AS attempt_count
                    FROM
                        attempts_by_interval
                    GROUP BY
                        interval_date, subject, unit_id
                ),
                
                -- Calculate mastery per interval, subject, and unit
                mastery_by_interval AS (
                    SELECT
                        interval_date,
                        subject,
                        unit_id,
                        AVG(avg_score) AS mastery_score
                    FROM
                        attempts_by_interval
                    GROUP BY
                        interval_date, subject, unit_id
                ),
                
                -- Get unit titles
                unit_titles AS (
                    SELECT DISTINCT
                        unit_id,
                        unit_title
                    FROM
                        curriculum
                ),
                
                -- Get ready subskills with unit info
                ready_subskills AS (
                    -- First subskills in learning paths are always ready
                    SELECT DISTINCT
                        $1 AS student_id,
                        c.subject,
                        c.unit_id,
                        c.subskill_id
                    FROM
                        curriculum c
                    LEFT JOIN
                        subskill_learning_paths slp ON c.subskill_id = slp.next_subskill_id
                    WHERE
                        slp.current_subskill_id IS NULL
                        AND ($2::text IS NULL OR c.subject = $2)
                        AND ($6::text IS NULL OR c.unit_id = $6)
                    
                    UNION
                    
                    -- Subskills where prerequisites are met
                    SELECT DISTINCT
                        $1 AS student_id,
                        c.subject,
                        c.unit_id,
                        slp.next_subskill_id AS subskill_id
                    FROM
                        curriculum c
                    JOIN
                        subskill_learning_paths slp ON c.subskill_id = slp.current_subskill_id
                    JOIN (
                        SELECT 
                            subskill_id
                        FROM 
                            problem_reviews
                        WHERE 
                            student_id = $1
                        GROUP BY 
                            subskill_id
                        HAVING 
                            AVG(score / 10) >= 0.6
                    ) pr ON slp.current_subskill_id = pr.subskill_id
                    WHERE
                        ($2::text IS NULL OR c.subject = $2)
                        AND ($6::text IS NULL OR c.unit_id = $6)
                        AND slp.next_subskill_id IS NOT NULL
                ),
                
                -- Calculate proficiency per interval, subject, and unit
                proficiency_by_interval AS (
                    SELECT
                        a.interval_date,
                        a.subject,
                        a.unit_id,
                        AVG(a.avg_score) AS proficiency_score
                    FROM
                        attempts_by_interval a
                    JOIN
                        ready_subskills rs ON a.student_id = rs.student_id 
                                        AND a.subskill_id = rs.subskill_id
                                        AND a.subject = rs.subject
                                        AND a.unit_id = rs.unit_id
                    GROUP BY
                        a.interval_date, a.subject, a.unit_id
                ),
                
                -- Calculate curriculum counts per subject and unit
                curriculum_counts AS (
                    SELECT
                        subject,
                        unit_id,
                        COUNT(DISTINCT subskill_id) AS total_curriculum_items
                    FROM
                        curriculum
                    WHERE
                        ($2::text IS NULL OR subject = $2)
                        AND ($6::text IS NULL OR unit_id = $6)
                    GROUP BY
                        subject, unit_id
                ),
                
                -- Calculate ready curriculum counts per subject and unit
                ready_counts AS (
                    SELECT
                        rs.subject,
                        rs.unit_id,
                        COUNT(DISTINCT rs.subskill_id) AS total_ready_items
                    FROM
                        ready_subskills rs
                    GROUP BY
                        rs.subject, rs.unit_id
                )
                
                -- Combine all metrics by interval, subject, and unit
                SELECT
                    i.interval_date,
                    i.subject,
                    i.unit_id,
                    ut.unit_title,
                    cc.total_curriculum_items,
                    COALESCE(rc.total_ready_items, 0) AS total_ready_items,
                    i.unique_subskills,
                    i.attempt_count,
                    m.mastery_score,
                    p.proficiency_score,
                    i.unique_subskills::float / cc.total_curriculum_items * 100 AS completion_percentage
                FROM
                    counts_by_interval i
                JOIN
                    curriculum_counts cc ON i.subject = cc.subject AND i.unit_id = cc.unit_id
                JOIN
                    unit_titles ut ON i.unit_id = ut.unit_id
                LEFT JOIN
                    ready_counts rc ON i.subject = rc.subject AND i.unit_id = rc.unit_id
                LEFT JOIN
                    mastery_by_interval m ON i.interval_date = m.interval_date 
                                        AND i.subject = m.subject 
                                        AND i.unit_id = m.unit_id
                LEFT JOIN
                    proficiency_by_interval p ON i.interval_date = p.interval_date 
                                            AND i.subject = p.subject 
                                            AND i.unit_id = p.unit_id
                ORDER BY
                    i.subject, i.unit_id, i.interval_date
                """
                
                params = [student_id, subject, trunc_function, start_date, end_date, unit_id]
                
            elif level == 'skill':
                # Similar to unit level but include skill_id in the groups
                query = """
                -- Skill level query with similar structure but including skill_id
                -- This would follow the same pattern as the unit query
                -- but with additional skill_id columns and join conditions
                """
                
                params = [student_id, subject, trunc_function, start_date, end_date, unit_id, skill_id]
                
            elif level == 'subskill':
                # Most granular level - includes all hierarchy IDs
                query = """
                -- Subskill level query with similar structure
                -- This would be the most detailed query showing metrics
                -- for each individual subskill over time
                """
                
                params = [student_id, subject, trunc_function, start_date, end_date, unit_id, skill_id]
            
            else:
                # Default to subject level if an invalid level is specified
                level = 'subject'
                # Use subject level query
                # [...]
            
            results = await conn.fetch(query, *params)
            
            # Convert to list of dictionaries
            timeseries = []
            for row in results:
                row_dict = dict(row)
                data_point = {
                    "interval_date": row_dict["interval_date"].isoformat(),
                    "metrics": {
                        "mastery": float(row_dict["mastery_score"] or 0),
                        "proficiency": float(row_dict["proficiency_score"] or 0),
                        "completion": float(row_dict["completion_percentage"] or 0),
                        "attempts": row_dict["attempt_count"],
                        "unique_subskills": row_dict["unique_subskills"],
                        "total_curriculum_items": row_dict["total_curriculum_items"],
                        "total_ready_items": row_dict["total_ready_items"]
                    }
                }
                
                # Add hierarchy information based on level
                if level != 'subject':
                    data_point["subject"] = row_dict["subject"]
                    
                if level in ('unit', 'skill', 'subskill'):
                    data_point["unit_id"] = row_dict["unit_id"]
                    data_point["unit_title"] = row_dict["unit_title"]
                    
                if level in ('skill', 'subskill'):
                    data_point["skill_id"] = row_dict["skill_id"]
                    data_point["skill_description"] = row_dict["skill_description"]
                    
                if level == 'subskill':
                    data_point["subskill_id"] = row_dict["subskill_id"]
                    data_point["subskill_description"] = row_dict["subskill_description"]
                
                timeseries.append(data_point)
            
            return timeseries
        except Exception as e:
            logger.error(f"Error calculating timeseries metrics: {e}")
            raise
        finally:
            await conn.close()

    async def get_recommendations(self, student_id: int, subject: Optional[str] = None, limit: int = 5) -> List[Dict]:
        """
        Get recommended next steps for a student based on priority and readiness.
        
        Args:
            student_id: The ID of the student
            subject: Optional subject filter
            limit: Maximum number of recommendations to return
            
        Returns:
            List of recommendation objects
        """
        try:
            # First get the hierarchical metrics which contain readiness and priority info
            metrics = await self.get_hierarchical_metrics(student_id, subject)
            
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
                        all_subskills.append(subskill)
            
            # Filter to find recommended subskills
            # Recommendations are either:
            # 1. Items explicitly flagged as recommended_next
            # 2. Items that are ready and not mastered, ordered by priority
            recommended_subskills = []
            
            # First add explicitly recommended items
            for subskill in all_subskills:
                if subskill["recommended_next"]:
                    recommended_subskills.append(subskill)
            
            # Then add ready items that are not mastered, ordered by priority
            if len(recommended_subskills) < limit:
                ready_not_mastered = [
                    s for s in all_subskills
                    if s["readiness_status"] == "Ready" and
                    s["priority_level"] != "Mastered" and
                    not any(r["subskill_id"] == s["subskill_id"] for r in recommended_subskills)
                ]
                
                # Sort by priority_order (lower number = higher priority)
                ready_not_mastered.sort(key=lambda x: x["priority_order"])
                
                # Add until we reach the limit
                recommended_subskills.extend(ready_not_mastered[:limit - len(recommended_subskills)])
            
            # Format the recommendations according to the API spec
            recommendations = []
            for item in recommended_subskills[:limit]:
                # Determine recommendation type
                rec_type = "performance_gap"
                if item["priority_level"] == "Not Started":
                    rec_type = "coverage_gap"
                elif item["readiness_status"] != "Ready":
                    rec_type = "future_item"
                
                # Determine priority
                priority = "medium"
                if item["priority_level"] == "High Priority":
                    priority = "high"
                elif item["priority_level"] == "Mastered":
                    priority = "low"
                
                # Create message based on type and priority
                message = ""
                if rec_type == "performance_gap":
                    message = f"Focus on improving your performance on {item['subskill_description']}"
                elif rec_type == "coverage_gap":
                    message = f"Start working on {item['subskill_description']}"
                else:
                    message = f"Prepare to work on {item['subskill_description']} next"
                
                recommendations.append({
                    "type": rec_type,
                    "priority": priority,
                    "unit_id": item["unit_id"],
                    "unit_title": item["unit_title"],
                    "skill_id": item["skill_id"],
                    "skill_description": item["skill_description"],
                    "subskill_id": item["subskill_id"],
                    "subskill_description": item["subskill_description"],
                    "proficiency": item["mastery"],
                    "priority_level": item["priority_level"],
                    "is_ready": item["readiness_status"] == "Ready",
                    "message": message
                })
            
            return recommendations
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            raise