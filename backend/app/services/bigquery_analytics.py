# services/bigquery_analytics.py

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

logger = logging.getLogger(__name__)

class BigQueryAnalyticsService:
    """Analytics service using BigQuery for serverless, scalable analytics"""
    
    def __init__(self, project_id: str, dataset_id: str = "analytics"):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self.client = bigquery.Client(project=project_id)
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.ready_threshold = 0.6
        
        # Cache for expensive queries (15 minutes)
        self._cache = {}
        self._cache_ttl = timedelta(minutes=15)
        
    async def initialize(self) -> bool:
        """Initialize BigQuery dataset and tables if they don't exist"""
        try:
            await self._ensure_dataset_exists()
            await self._ensure_tables_exist()
            await self._create_views()
            logger.info("BigQuery analytics service initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery analytics service: {e}")
            return False
    
    async def _run_query_async(self, query: str, parameters: List[bigquery.ScalarQueryParameter] = None) -> List[Dict]:
        """Run BigQuery query asynchronously"""
        loop = asyncio.get_event_loop()
        
        def _execute_query():
            job_config = bigquery.QueryJobConfig()
            if parameters:
                job_config.query_parameters = parameters
            
            # Add labels for cost tracking
            job_config.labels = {"service": "analytics", "component": "student_metrics"}
            
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            
            # Log query stats for cost monitoring
            logger.info(f"Query processed {query_job.total_bytes_processed} bytes")
            
            return [dict(row) for row in results]
        
        return await loop.run_in_executor(self.executor, _execute_query)
    
    def _get_cache_key(self, method: str, **kwargs) -> str:
        """Generate cache key for method and parameters"""
        # Sort kwargs for consistent keys
        sorted_params = sorted(kwargs.items())
        param_str = "_".join(f"{k}={v}" for k, v in sorted_params if v is not None)
        return f"{method}_{param_str}"
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached result is still valid"""
        if cache_key not in self._cache:
            return False
        
        cache_time, _ = self._cache[cache_key]
        return datetime.now() - cache_time < self._cache_ttl
    
    def _set_cache(self, cache_key: str, result: Any):
        """Cache result with timestamp"""
        self._cache[cache_key] = (datetime.now(), result)
    
    def _get_cache(self, cache_key: str) -> Any:
        """Get cached result"""
        if self._is_cache_valid(cache_key):
            _, result = self._cache[cache_key]
            return result
        return None

    async def get_hierarchical_metrics(
        self, 
        student_id: int, 
        subject: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get comprehensive hierarchical metrics for a student"""
        
        # Check cache first
        cache_key = self._get_cache_key(
            "hierarchical_metrics",
            student_id=student_id,
            subject=subject,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None
        )
        
        cached_result = self._get_cache(cache_key)
        if cached_result:
            logger.info(f"Returning cached hierarchical metrics for student {student_id}")
            return cached_result
        
        try:
            # Main hierarchical query
            query = f"""
            WITH student_attempts AS (
              SELECT 
                student_id,
                subject,
                skill_id,
                subskill_id,
                score,
                timestamp
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
                AND (@subject IS NULL OR subject = @subject)
                AND (@start_date IS NULL OR timestamp >= @start_date)
                AND (@end_date IS NULL OR timestamp <= @end_date)
            ),
            subskill_metrics AS (
              SELECT 
                sa.subskill_id,
                AVG(sa.score / 10.0) as avg_score,
                COUNT(*) as attempt_count,
                MIN(sa.timestamp) as first_attempt,
                MAX(sa.timestamp) as last_attempt,
                -- Credibility based on attempt count (max at 10 attempts)
                LEAST(COUNT(*) / 10.0, 1.0) as credibility,
                -- Mastery calculation (avg_score * credibility)
                AVG(sa.score / 10.0) * LEAST(COUNT(*) / 10.0, 1.0) as mastery
              FROM student_attempts sa
              GROUP BY sa.subskill_id
            ),
            ready_skills AS (
              -- Base node skills (always ready)
              SELECT DISTINCT prerequisite_skill_id as skill_id
              FROM `{self.project_id}.{self.dataset_id}.learning_paths`
              WHERE is_base_node = TRUE
              
              UNION DISTINCT
              
              -- Skills unlocked by prerequisites
              SELECT DISTINCT lp.unlocks_skill_id as skill_id
              FROM `{self.project_id}.{self.dataset_id}.learning_paths` lp
              JOIN subskill_metrics sm 
                ON REGEXP_EXTRACT(sm.subskill_id, r'^([A-Z0-9]+-[A-Z0-9]+)') = lp.prerequisite_skill_id
              WHERE sm.mastery >= @ready_threshold
            ),
            curriculum_with_metrics AS (
              SELECT 
                c.subject,
                c.unit_id,
                c.unit_title,
                c.skill_id,
                c.skill_description,
                c.subskill_id,
                c.subskill_description,
                c.difficulty_start,
                c.difficulty_end,
                c.target_difficulty,
                -- Metrics from attempts
                COALESCE(sm.avg_score, 0) as avg_score,
                COALESCE(sm.mastery, 0) as mastery,
                COALESCE(sm.attempt_count, 0) as attempt_count,
                COALESCE(sm.credibility, 0) as credibility,
                -- Readiness and status
                CASE 
                  WHEN rs.skill_id IS NOT NULL THEN 'Ready'
                  ELSE 'Not Ready'
                END as readiness_status,
                CASE 
                  WHEN sm.attempt_count > 0 THEN TRUE 
                  ELSE FALSE 
                END as is_attempted,
                -- Proficiency (for ready items only)
                CASE 
                  WHEN rs.skill_id IS NOT NULL THEN COALESCE(sm.avg_score, 0)
                  ELSE 0
                END as proficiency,
                -- Completion (binary: attempted or not)
                CASE 
                  WHEN sm.attempt_count > 0 THEN 100.0 
                  ELSE 0.0 
                END as completion,
                -- Priority calculation
                CASE 
                  WHEN sm.mastery >= 0.8 THEN 'Mastered'
                  WHEN sm.mastery BETWEEN 0.4 AND 0.799 THEN 'High Priority'
                  WHEN sm.mastery > 0 AND sm.mastery < 0.4 THEN 'Medium Priority'
                  WHEN sm.mastery = 0 THEN 'Not Started'
                  ELSE 'Not Assessed'
                END as priority_level,
                CASE 
                  WHEN sm.mastery BETWEEN 0.4 AND 0.799 THEN 1
                  WHEN sm.mastery > 0 AND sm.mastery < 0.4 THEN 2
                  WHEN sm.mastery = 0 THEN 3
                  WHEN sm.mastery >= 0.8 THEN 4
                  ELSE 5
                END as priority_order
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              LEFT JOIN subskill_metrics sm ON c.subskill_id = sm.subskill_id
              LEFT JOIN ready_skills rs ON c.skill_id = rs.skill_id
              WHERE (@subject IS NULL OR c.subject = @subject)
            )
            SELECT *
            FROM curriculum_with_metrics
            ORDER BY unit_id, skill_id, subskill_id
            """
            
            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("start_date", "TIMESTAMP", start_date),
                bigquery.ScalarQueryParameter("end_date", "TIMESTAMP", end_date),
                bigquery.ScalarQueryParameter("ready_threshold", "FLOAT64", self.ready_threshold)
            ]
            
            # Execute query
            results = await self._run_query_async(query, parameters)
            
            # Structure the hierarchical response
            structured_data = self._structure_hierarchical_data(results, student_id, subject, start_date, end_date)
            
            # Cache the result
            self._set_cache(cache_key, structured_data)
            
            return structured_data
            
        except Exception as e:
            logger.error(f"Error in get_hierarchical_metrics: {e}")
            raise

    async def get_timeseries_metrics(
        self,
        student_id: int,
        subject: Optional[str] = None,
        interval: str = 'month',
        level: str = 'subject',
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        unit_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        include_hierarchy: bool = False
    ) -> List[Dict]:
        """Get metrics over time for a student at the specified hierarchy level"""
        
        try:
            # Determine date truncation based on interval
            date_trunc_map = {
                'day': 'DATE(timestamp)',
                'week': 'DATE_TRUNC(DATE(timestamp), WEEK)',
                'month': 'DATE_TRUNC(DATE(timestamp), MONTH)', 
                'quarter': 'DATE_TRUNC(DATE(timestamp), QUARTER)',
                'year': 'DATE_TRUNC(DATE(timestamp), YEAR)'
            }
            
            date_trunc = date_trunc_map.get(interval, 'DATE_TRUNC(DATE(timestamp), MONTH)')
            
            # Simplified query without the complex ready_skills logic that was causing issues
            query = f"""
            WITH time_periods AS (
              SELECT DISTINCT
                {date_trunc} as interval_date
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
                AND (@subject IS NULL OR subject = @subject)
                AND (@start_date IS NULL OR timestamp >= @start_date)
                AND (@end_date IS NULL OR timestamp <= @end_date)
                AND (@unit_id IS NULL OR REGEXP_EXTRACT(subskill_id, r'^([^-]+)') LIKE CONCAT(@unit_id, '%'))
                AND (@skill_id IS NULL OR REGEXP_EXTRACT(subskill_id, r'^([^-]+)') = @skill_id)
              ORDER BY interval_date
            ),
            interval_metrics AS (
              SELECT 
                {date_trunc} as interval_date,
                AVG(score / 10.0) as avg_score,
                COUNT(*) as attempt_count,
                COUNT(DISTINCT subskill_id) as attempted_subskills,
                -- Calculate mastery with credibility
                AVG(score / 10.0) * LEAST(COUNT(*) / 10.0, 1.0) as mastery,
                -- Proficiency for ready items (simplified)
                AVG(score / 10.0) as proficiency,
                -- Completion percentage
                COUNT(DISTINCT subskill_id) as completion_numerator
              FROM `{self.project_id}.{self.dataset_id}.attempts`
              WHERE student_id = @student_id
                AND (@subject IS NULL OR subject = @subject)
                AND (@start_date IS NULL OR timestamp >= @start_date)
                AND (@end_date IS NULL OR timestamp <= @end_date)
                AND (@unit_id IS NULL OR REGEXP_EXTRACT(subskill_id, r'^([^-]+)') LIKE CONCAT(@unit_id, '%'))
                AND (@skill_id IS NULL OR REGEXP_EXTRACT(subskill_id, r'^([^-]+)') = @skill_id)
              GROUP BY interval_date
            ),
            total_items AS (
              SELECT COUNT(DISTINCT subskill_id) as total_count
              FROM `{self.project_id}.{self.dataset_id}.curriculum`
              WHERE (@subject IS NULL OR subject = @subject)
                AND (@unit_id IS NULL OR unit_id = @unit_id)
                AND (@skill_id IS NULL OR skill_id = @skill_id)
            ),
            -- Simplified recommended items - just count unattmepted subskills
            recommended_items_count AS (
              SELECT COUNT(DISTINCT c.subskill_id) as recommended_count
              FROM `{self.project_id}.{self.dataset_id}.curriculum` c
              LEFT JOIN (
                SELECT DISTINCT subskill_id
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE student_id = @student_id
                  AND (@subject IS NULL OR subject = @subject)
              ) attempted ON c.subskill_id = attempted.subskill_id
              WHERE attempted.subskill_id IS NULL  -- Not yet attempted
                AND (@subject IS NULL OR c.subject = @subject)
                AND (@unit_id IS NULL OR c.unit_id = @unit_id)
                AND (@skill_id IS NULL OR c.skill_id = @skill_id)
            )
            SELECT 
              tp.interval_date,
              COALESCE(im.avg_score, 0) as avg_score,
              COALESCE(im.attempt_count, 0) as attempt_count,
              COALESCE(im.attempted_subskills, 0) as attempted_items,
              COALESCE(im.mastery, 0) as mastery,
              COALESCE(im.proficiency, 0) as proficiency,
              COALESCE(im.completion_numerator, 0) as completion_numerator,
              ti.total_count,
              -- Calculate completion percentage
              CASE 
                WHEN ti.total_count > 0 THEN (COALESCE(im.completion_numerator, 0) / ti.total_count) * 100
                ELSE 0
              END as completion,
              0 as ready_items,  -- Simplified for now - can enhance later
              COALESCE(ric.recommended_count, 0) as recommended_items
            FROM time_periods tp
            LEFT JOIN interval_metrics im ON tp.interval_date = im.interval_date
            CROSS JOIN total_items ti
            CROSS JOIN recommended_items_count ric
            ORDER BY tp.interval_date
            """
            
            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("start_date", "TIMESTAMP", start_date),
                bigquery.ScalarQueryParameter("end_date", "TIMESTAMP", end_date),
                bigquery.ScalarQueryParameter("unit_id", "STRING", unit_id),
                bigquery.ScalarQueryParameter("skill_id", "STRING", skill_id)
            ]
            
            results = await self._run_query_async(query, parameters)
            
            # Format results for timeseries response
            intervals = []
            for row in results:
                interval_data = {
                    "interval_date": row["interval_date"].isoformat(),
                    "summary": {
                        "mastery": float(row["mastery"]),
                        "proficiency": float(row["proficiency"]),
                        "avg_score": float(row["avg_score"]),
                        "completion": float(row["completion"]),
                        "attempted_items": int(row["attempted_items"]),
                        "total_items": int(row["total_count"]),
                        "attempt_count": int(row["attempt_count"]),
                        "ready_items": int(row["ready_items"]),
                        "recommended_items": int(row["recommended_items"])
                    }
                }
                
                # Add hierarchical data if requested
                if include_hierarchy:
                    # For now, we'll skip this to keep it simple
                    # In a full implementation, you'd call get_hierarchical_metrics
                    # with the specific date range for this interval
                    interval_data["hierarchical_data"] = []
                
                intervals.append(interval_data)
            
            return intervals
            
        except Exception as e:
            logger.error(f"Error in get_timeseries_metrics: {e}")
            raise

    # Replace your existing get_recommendations method with this optimized version
    async def get_recommendations(
        self, 
        student_id: int, 
        subject: Optional[str] = None, 
        limit: int = 5
    ) -> List[Dict]:
        """Get learning recommendations based on readiness and performance - OPTIMIZED"""

        logger.info(f"Starting get_recommendations for student_id={student_id}, subject={subject}, limit={limit}")

        # Step 1: Check if the student has any activity
        activity_check_query = f"""
            SELECT 1 
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            WHERE student_id = @student_id
            LIMIT 1
        """
        activity_params = [bigquery.ScalarQueryParameter("student_id", "INT64", student_id)]
        activity_result = await self._run_query_async(activity_check_query, activity_params)
        
        has_activity = len(activity_result) > 0
        logger.info(f"Student {student_id} has_activity: {has_activity}")

        if not has_activity:
            # Step 2: Use fast pre-computed recommendations for new students
            logger.info(f"No activity found for student {student_id}. Using FAST initial recommendations from pre-computed table.")
            return await self._get_initial_recommendations_fast(subject, limit)

        # Step 3: If activity exists, proceed with the original logic for experienced students
        try:
            logger.info(f"Student {student_id} has activity. Proceeding with full recommendation logic.")
            
            # Log the subject filtering
            if subject:
                logger.info(f"Filtering recommendations for subject: {subject}")
            else:
                logger.info("No subject filter applied - getting recommendations across all subjects")

            query = f"""
            WITH student_metrics AS (
            SELECT 
                subskill_id,
                AVG(score / 10.0) as avg_score,
                COUNT(*) as attempt_count,
                AVG(score / 10.0) * LEAST(COUNT(*) / 10.0, 1.0) as mastery
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            WHERE student_id = @student_id
                AND (@subject IS NULL OR subject = @subject)
            GROUP BY subskill_id
            ),
            ready_skills AS (
            -- Base node skills
            SELECT DISTINCT prerequisite_skill_id as skill_id
            FROM `{self.project_id}.{self.dataset_id}.learning_paths`
            WHERE is_base_node = TRUE
            
            UNION DISTINCT
            
            -- Unlocked skills
            SELECT DISTINCT lp.unlocks_skill_id as skill_id
            FROM `{self.project_id}.{self.dataset_id}.learning_paths` lp
            JOIN student_metrics sm 
                ON REGEXP_EXTRACT(sm.subskill_id, r'^([A-Z0-9]+-[A-Z0-9]+)') = lp.prerequisite_skill_id
            WHERE sm.mastery >= @ready_threshold
            ),
            curriculum_filtered AS (
            SELECT *
            FROM `{self.project_id}.{self.dataset_id}.curriculum` c
            WHERE (@subject IS NULL OR c.subject = @subject)
            ),
            recommendations AS (
            SELECT 
                c.subject,
                c.unit_id,
                c.unit_title,
                c.skill_id,
                c.skill_description,
                c.subskill_id,
                c.subskill_description,
                COALESCE(sm.mastery, 0) as mastery,
                COALESCE(sm.avg_score, 0) as proficiency,
                COALESCE(sm.attempt_count, 0) as attempt_count,
                CASE WHEN rs.skill_id IS NOT NULL THEN TRUE ELSE FALSE END as is_ready,
                CASE WHEN sm.attempt_count > 0 THEN TRUE ELSE FALSE END as is_attempted,
                -- Priority calculation
                CASE 
                WHEN rs.skill_id IS NOT NULL AND sm.attempt_count = 0 THEN 1  -- Ready, not started
                WHEN rs.skill_id IS NOT NULL AND sm.mastery < 0.6 THEN 2     -- Ready, needs work
                WHEN rs.skill_id IS NULL AND sm.mastery > 0 THEN 3           -- Prerequisites needed
                WHEN rs.skill_id IS NULL AND sm.mastery = 0 THEN 4           -- Not ready, not started
                ELSE 5
                END as priority_order,
                CASE 
                WHEN rs.skill_id IS NOT NULL AND sm.attempt_count = 0 THEN 'coverage_gap'
                WHEN rs.skill_id IS NOT NULL AND sm.mastery < 0.6 THEN 'performance_gap'
                ELSE 'prerequisite_needed'
                END as rec_type,
                CASE 
                WHEN rs.skill_id IS NOT NULL AND sm.attempt_count = 0 THEN 'high'
                WHEN rs.skill_id IS NOT NULL AND sm.mastery < 0.6 THEN 'high'
                ELSE 'medium'
                END as priority,
                -- Priority level for compatibility
                CASE 
                WHEN sm.mastery >= 0.8 THEN 'Mastered'
                WHEN sm.mastery BETWEEN 0.4 AND 0.799 THEN 'High Priority'
                WHEN sm.mastery > 0 AND sm.mastery < 0.4 THEN 'Medium Priority'
                ELSE 'Not Started'
                END as priority_level
            FROM curriculum_filtered c
            LEFT JOIN student_metrics sm ON c.subskill_id = sm.subskill_id
            LEFT JOIN ready_skills rs ON c.skill_id = rs.skill_id
            WHERE (rs.skill_id IS NOT NULL OR sm.mastery > 0)  -- Only ready or attempted items
            )
            SELECT 
            subject,
            rec_type as type,
            priority,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            proficiency,
            mastery,
            proficiency as avg_score,  -- For compatibility
            priority_level,
            priority_order,
            CASE WHEN is_ready THEN 'Ready' ELSE 'Not Ready' END as readiness_status,
            is_ready,
            CASE WHEN is_attempted THEN 100.0 ELSE 0.0 END as completion,
            attempt_count,
            is_attempted,
            NULL as next_subskill,  -- Would need subskill learning paths
            CASE 
                WHEN rec_type = 'coverage_gap' THEN CONCAT('Start working on ', subskill_description)
                WHEN rec_type = 'performance_gap' THEN CONCAT('Continue practicing ', subskill_description)
                ELSE CONCAT('Work on prerequisites for ', subskill_description)
            END as message
            FROM recommendations
            WHERE priority_order <= 3
            ORDER BY priority_order, mastery ASC
            LIMIT @limit
            """
            
            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("ready_threshold", "FLOAT64", self.ready_threshold),
                bigquery.ScalarQueryParameter("limit", "INT64", limit)
            ]
            
            logger.info(f"Executing full recommendations query for student with activity...")
            results = await self._run_query_async(query, parameters)
            
            logger.info(f"Full recommendations query returned {len(results)} results")
            
            if results:
                subjects_in_results = list(set(r.get('subject') for r in results))
                logger.info(f"Subjects in results: {subjects_in_results}")
                
                for i, result in enumerate(results):
                    logger.info(f"Recommendation {i+1}: {result.get('type')} - {result.get('subject')} - {result.get('subskill_description')} (priority: {result.get('priority_order')})")
            else:
                logger.warning(f"No recommendations found for student {student_id} with subject filter '{subject}'")
                
            return results
            
        except Exception as e:
            logger.error(f"Error in get_recommendations for student {student_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise

    async def _get_initial_recommendations_fast(self, subject: Optional[str], limit: int) -> List[Dict]:
        """Get recommendations for new students using pre-computed table"""
        
        logger.info(f"Getting initial recommendations (FAST) for subject={subject}, limit={limit}")
        
        # Simple query against pre-computed table
        query = f"""
        SELECT 
        type,
        priority,
        subject,
        unit_id,
        unit_title,
        skill_id,
        skill_description,
        subskill_id,
        subskill_description,
        proficiency,
        mastery,
        avg_score,
        priority_level,
        priority_order,
        readiness_status,
        is_ready,
        completion,
        attempt_count,
        is_attempted,
        next_subskill,
        message
        FROM `{self.project_id}.{self.dataset_id}.starting_recommendations`
        WHERE (@subject IS NULL OR subject = @subject)
        ORDER BY priority_order
        LIMIT @limit
        """
        
        parameters = [
            bigquery.ScalarQueryParameter("subject", "STRING", subject),
            bigquery.ScalarQueryParameter("limit", "INT64", limit)
        ]
        
        try:
            logger.info("Executing fast starting recommendations query...")
            results = await self._run_query_async(query, parameters)
            logger.info(f"Fast initial recommendations returned {len(results)} results (minimal query cost)")
            
            if results:
                for i, result in enumerate(results):
                    logger.info(f"Fast recommendation {i+1}: {result.get('subject')} - {result.get('skill_id')} - {result.get('subskill_id')} - {result.get('subskill_description')}")
            
            return results
            
        except Exception as e:
            logger.warning(f"Fast recommendations failed ({str(e)}), falling back to computed method")
            # Fallback to the original method if table doesn't exist or query fails
            return await self._get_initial_recommendations(subject, limit)

    async def execute_query(self, query: str, parameters: List = None) -> List[Dict]:
        """
        Compatible execute_query method for existing endpoints
        Handles both old and new parameter formats
        """
        try:
            # Convert parameters to BigQuery format if needed
            bq_parameters = []
            if parameters:
                for param in parameters:
                    if isinstance(param, dict):
                        # Old format: {"name": "student_id", "type": "INT64", "value": 1001}
                        bq_param = bigquery.ScalarQueryParameter(
                            param["name"], 
                            param["type"], 
                            param["value"]
                        )
                    else:
                        # New format: already BigQuery parameters
                        bq_param = param
                    bq_parameters.append(bq_param)
            
            return await self._run_query_async(query, bq_parameters)
            
        except Exception as e:
            logger.error(f"Error executing query: {str(e)}")
            raise
      
    async def get_student_proficiency_map(
        self,
        student_id: int,
        subject_id: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get all student proficiencies in a single efficient query

        Returns map of entity_id -> proficiency data for quick lookup
        in the student state engine.

        Args:
            student_id: Student ID
            subject_id: Optional subject filter

        Returns:
            {
                "SUBSKILL-123": {
                    "proficiency": 0.85,
                    "attempt_count": 10,
                    "last_attempt_at": "2025-10-24T18:30:00Z"
                },
                "SUBSKILL-456": {
                    "proficiency": 0.60,
                    "attempt_count": 5,
                    "last_attempt_at": "2025-10-23T14:20:00Z"
                }
            }
        """

        # Check cache first (5 min TTL for student data)
        cache_key = self._get_cache_key(
            "student_proficiency_map",
            student_id=student_id,
            subject_id=subject_id
        )

        cached_result = self._get_cache(cache_key)
        if cached_result:
            logger.info(f"Returning cached proficiency map for student {student_id}")
            return cached_result

        try:
            # Single optimized query to get all proficiencies
            query = f"""
            SELECT
                subskill_id as entity_id,
                AVG(score / 10.0) as proficiency,
                COUNT(*) as attempt_count,
                MAX(timestamp) as last_attempt_at
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            WHERE student_id = @student_id
                AND (@subject_id IS NULL OR subject = @subject_id)
            GROUP BY subskill_id
            """

            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)
            ]

            results = await self._run_query_async(query, parameters)

            # Convert to map for O(1) lookup
            proficiency_map = {}

            for row in results:
                entity_id = row["entity_id"]
                proficiency_map[entity_id] = {
                    "proficiency": float(row["proficiency"]),
                    "attempt_count": int(row["attempt_count"]),
                    "last_attempt_at": row["last_attempt_at"].isoformat() if row["last_attempt_at"] else None
                }

            # Cache result (5 minute TTL)
            self._set_cache(cache_key, proficiency_map)

            logger.info(f"Retrieved proficiency map for student {student_id}: {len(proficiency_map)} entities")
            return proficiency_map

        except Exception as e:
            logger.error(f"Error getting student proficiency map: {e}")
            return {}

    async def get_content_packages_for_llm(self,
                                         student_id: Optional[int] = None,
                                         subject: Optional[str] = None,
                                         difficulty_levels: List[str] = None,
                                         limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get content packages specifically formatted for LLM consumption
        This method encapsulates the BigQuery logic and provides a clean API
        """
        
        # Default difficulty levels
        if difficulty_levels is None:
            difficulty_levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
        
        # Build cache key
        cache_key = self._get_cache_key(
            "content_packages_llm",
            student_id=student_id,
            subject=subject,
            difficulty_levels=",".join(sorted(difficulty_levels)),
            limit=limit
        )
        
        # Check cache
        cached_result = self._get_cache(cache_key)
        if cached_result:
            logger.info(f"Returning cached LLM content packages")
            return cached_result
        
        try:
            # Build WHERE conditions
            where_conditions = []
            parameters = []
            
            if difficulty_levels:
                placeholders = ",".join([f"@difficulty_{i}" for i in range(len(difficulty_levels))])
                where_conditions.append(f"difficulty_level IN ({placeholders})")
                for i, level in enumerate(difficulty_levels):
                    parameters.append(bigquery.ScalarQueryParameter(f"difficulty_{i}", "STRING", level))
            
            if subject:
                where_conditions.append("subject = @subject")
                parameters.append(bigquery.ScalarQueryParameter("subject", "STRING", subject))
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            query = f"""
            SELECT 
                package_id,
                subject,
                unit,
                skill,
                subskill,
                learning_path,
                difficulty_level,
                difficulty_numeric,
                reading_level,
                reading_grade_level,
                key_terminology,
                prerequisites,
                core_concepts,
                learning_objectives,
                real_world_applications,
                related_packages_same_level,
                progression_path_within_unit,
                progression_path_cross_unit,
                llm_context_block,
                llm_json_payload
            FROM `{self.project_id}.{self.dataset_id}.llm_learning_recommendations_v1`
            {where_clause}
            ORDER BY difficulty_numeric, reading_grade_level, subject, unit
            LIMIT @limit
            """
            
            parameters.append(bigquery.ScalarQueryParameter("limit", "INT64", limit))
            
            results = await self._run_query_async(query, parameters)
            
            # Process results into structured format
            packages = []
            for row in results:
                package = {
                    "package_id": row.get("package_id"),
                    "subject": row.get("subject"),
                    "unit": row.get("unit"),
                    "skill": row.get("skill"),
                    "subskill": row.get("subskill"),
                    "learning_path": row.get("learning_path"),
                    "difficulty_level": row.get("difficulty_level"),
                    "difficulty_numeric": row.get("difficulty_numeric"),
                    "reading_level": row.get("reading_level"),
                    "reading_grade_level": row.get("reading_grade_level"),
                    "key_terminology": self._safe_list_field(row.get("key_terminology")),
                    "prerequisites": self._safe_list_field(row.get("prerequisites")),
                    "core_concepts": self._safe_list_field(row.get("core_concepts")),
                    "learning_objectives": self._safe_list_field(row.get("learning_objectives")),
                    "real_world_applications": self._safe_list_field(row.get("real_world_applications")),
                    "related_packages_same_level": self._safe_list_field(row.get("related_packages_same_level")),
                    "progression_path_within_unit": self._safe_list_field(row.get("progression_path_within_unit")),
                    "progression_path_cross_unit": self._safe_list_field(row.get("progression_path_cross_unit")),
                    "llm_context_block": row.get("llm_context_block"),
                    "llm_json_payload": row.get("llm_json_payload")
                }
                packages.append(package)
            
            # Cache the result
            self._set_cache(cache_key, packages)
            
            logger.info(f"Retrieved {len(packages)} content packages for LLM")
            return packages
            
        except Exception as e:
            logger.error(f"Error getting content packages for LLM: {str(e)}")
            return []

    def _structure_hierarchical_data(self, flat_data: List[Dict], student_id: int, subject: Optional[str], start_date: Optional[datetime], end_date: Optional[datetime]) -> Dict:
        """Convert flat BigQuery results to hierarchical structure"""
        
        if not flat_data:
            return {
                "summary": {
                    "mastery": 0.0,
                    "proficiency": 0.0,
                    "avg_score": 0.0,
                    "completion": 0.0,
                    "attempted_items": 0,
                    "total_items": 0,
                    "attempt_count": 0,
                    "ready_items": 0,
                    "recommended_items": 0
                },
                "date_range": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                },
                "hierarchical_data": []
            }
        
        # Group by unit -> skill -> subskill
        units = {}
        
        # Summary calculations
        total_mastery = 0.0
        total_proficiency = 0.0
        total_avg_score = 0.0
        total_attempt_count = 0
        attempted_count = 0
        ready_count = 0
        recommended_count = 0
        total_count = len(flat_data)
        
        for row in flat_data:
            unit_id = row['unit_id']
            skill_id = row['skill_id']
            
            # Initialize unit
            if unit_id not in units:
                units[unit_id] = {
                    'unit_id': unit_id,
                    'unit_title': row['unit_title'],
                    'skills': {},
                    'mastery': 0.0,
                    'proficiency': 0.0,
                    'avg_score': 0.0,
                    'completion': 0.0,
                    'attempted_skills': 0,
                    'total_skills': 0,
                    'attempt_count': 0
                }
            
            # Initialize skill
            if skill_id not in units[unit_id]['skills']:
                units[unit_id]['skills'][skill_id] = {
                    'skill_id': skill_id,
                    'skill_description': row['skill_description'],
                    'subskills': [],
                    'mastery': 0.0,
                    'proficiency': 0.0,
                    'avg_score': 0.0,
                    'completion': 0.0,
                    'attempted_subskills': 0,
                    'total_subskills': 0,
                    'attempt_count': 0
                }
            
            # Add subskill
            subskill = {
                'subskill_id': row['subskill_id'],
                'subskill_description': row['subskill_description'],
                'mastery': float(row['mastery']),
                'avg_score': float(row['avg_score']),
                'proficiency': float(row['proficiency']),
                'completion': float(row['completion']),
                'is_attempted': bool(row['is_attempted']),
                'readiness_status': row['readiness_status'],
                'priority_level': row['priority_level'],
                'priority_order': int(row['priority_order']),
                'next_subskill': None,  # Would need subskill learning paths
                'recommended_next': None,  # Would calculate based on priority
                'attempt_count': int(row['attempt_count']),
                'individual_attempts': []  # Would need to fetch separately if needed
            }
            
            units[unit_id]['skills'][skill_id]['subskills'].append(subskill)
            
            # Update counts
            units[unit_id]['skills'][skill_id]['total_subskills'] += 1
            units[unit_id]['total_skills'] = len(units[unit_id]['skills'])
            
            if row['is_attempted']:
                units[unit_id]['skills'][skill_id]['attempted_subskills'] += 1
                attempted_count += 1
            
            if row['readiness_status'] == 'Ready':
                ready_count += 1
            
            # Accumulate for summary
            total_mastery += row['mastery']
            total_proficiency += row['proficiency']
            total_avg_score += row['avg_score']
            total_attempt_count += row['attempt_count']
        
        # Calculate skill and unit level metrics
        for unit in units.values():
            unit_mastery_sum = 0.0
            unit_proficiency_sum = 0.0
            unit_avg_score_sum = 0.0
            unit_attempt_count = 0
            unit_attempted_skills = 0
            
            skill_list = []
            for skill in unit['skills'].values():
                # Calculate skill metrics
                if skill['subskills']:
                    skill['mastery'] = sum(s['mastery'] for s in skill['subskills']) / len(skill['subskills'])
                    skill['proficiency'] = sum(s['proficiency'] for s in skill['subskills']) / len(skill['subskills'])
                    skill['avg_score'] = sum(s['avg_score'] for s in skill['subskills']) / len(skill['subskills'])
                    skill['completion'] = (skill['attempted_subskills'] / skill['total_subskills']) * 100 if skill['total_subskills'] > 0 else 0
                    skill['attempt_count'] = sum(s['attempt_count'] for s in skill['subskills'])
                
                # Accumulate for unit
                unit_mastery_sum += skill['mastery']
                unit_proficiency_sum += skill['proficiency']
                unit_avg_score_sum += skill['avg_score']
                unit_attempt_count += skill['attempt_count']
                
                if skill['attempted_subskills'] > 0:
                    unit_attempted_skills += 1
                
                skill_list.append(skill)
            
            # Calculate unit metrics
            total_skills = len(skill_list)
            if total_skills > 0:
                unit['mastery'] = unit_mastery_sum / total_skills
                unit['proficiency'] = unit_proficiency_sum / total_skills
                unit['avg_score'] = unit_avg_score_sum / total_skills
                unit['completion'] = (unit_attempted_skills / total_skills) * 100
                unit['attempt_count'] = unit_attempt_count
                unit['attempted_skills'] = unit_attempted_skills
                unit['total_skills'] = total_skills
            
            unit['skills'] = skill_list
        
        # Calculate overall summary
        summary = {
            "mastery": float(total_mastery / total_count) if total_count > 0 else 0.0,
            "proficiency": float(total_proficiency / total_count) if total_count > 0 else 0.0,
            "avg_score": float(total_avg_score / total_count) if total_count > 0 else 0.0,
            "completion": float((attempted_count / total_count) * 100) if total_count > 0 else 0.0,
            "attempted_items": attempted_count,
            "total_items": total_count,
            "attempt_count": total_attempt_count,
            "ready_items": ready_count,
            "recommended_items": recommended_count  # Would calculate based on priority
        }
        
        # Convert to list and sort
        hierarchical_data = list(units.values())
        hierarchical_data.sort(key=lambda x: x['unit_id'])
        
        return {
            "summary": summary,
            "date_range": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            },
            "hierarchical_data": hierarchical_data
        }

    async def _ensure_dataset_exists(self):
        """Ensure BigQuery dataset exists"""
        dataset_id = f"{self.project_id}.{self.dataset_id}"
        
        try:
            self.client.get_dataset(dataset_id)
            logger.info(f"Dataset {dataset_id} already exists")
        except NotFound:
            dataset = bigquery.Dataset(dataset_id)
            dataset.location = "US"  # or your preferred location
            dataset = self.client.create_dataset(dataset, timeout=30)
            logger.info(f"Created dataset {dataset_id}")

    async def _ensure_tables_exist(self):
        """Ensure required BigQuery tables exist"""
        
        # Define table schemas
        tables_schema = {
            "attempts": [
                bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("score", "FLOAT", mode="REQUIRED"),
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="NULLABLE"),
                bigquery.SchemaField("cosmos_id", "STRING", mode="NULLABLE"),
            ],
            "curriculum": [
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("grade", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("unit_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("unit_title", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_description", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_description", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("difficulty_start", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("difficulty_end", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("target_difficulty", "FLOAT", mode="NULLABLE"),
            ],
            "learning_paths": [
                bigquery.SchemaField("prerequisite_skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("unlocks_skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("min_score_threshold", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("is_base_node", "BOOLEAN", mode="NULLABLE"),
            ],
            "subskill_paths": [
                bigquery.SchemaField("current_subskill", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("next_subskill", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
                bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE"),
            ],
            "reviews": [
                bigquery.SchemaField("review_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
                bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("score", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("problem_text", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("answer_text", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("feedback_praise", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("feedback_guidance", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="NULLABLE"),
            ]
        }
        
        for table_name, schema in tables_schema.items():
            table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
            
            try:
                self.client.get_table(table_id)
                logger.info(f"Table {table_id} already exists")
            except NotFound:
                table = bigquery.Table(table_id, schema=schema)
                
                # Set partitioning for large tables
                if table_name in ["attempts", "reviews"]:
                    table.time_partitioning = bigquery.TimePartitioning(
                        type_=bigquery.TimePartitioningType.DAY,
                        field="timestamp"
                    )
                    # Set clustering for performance
                    if table_name == "attempts":
                        table.clustering_fields = ["student_id", "subject"]
                    elif table_name == "reviews":
                        table.clustering_fields = ["student_id", "subject"]
                
                table = self.client.create_table(table)
                logger.info(f"Created table {table_id}")

    async def _create_views(self):
        """Create useful views for analytics"""
        
        views = {
            "student_subskill_metrics": f"""
            CREATE OR REPLACE VIEW `{self.project_id}.{self.dataset_id}.student_subskill_metrics` AS
            SELECT 
              student_id,
              subject,
              subskill_id,
              AVG(score / 10.0) as proficiency,
              COUNT(*) as attempt_count,
              STDDEV(score / 10.0) as score_variance,
              MIN(timestamp) as first_attempt,
              MAX(timestamp) as last_attempt,
              -- Credibility calculation (max at 10 attempts)
              LEAST(COUNT(*) / 10.0, 1.0) as credibility,
              -- Mastery calculation (proficiency * credibility)
              AVG(score / 10.0) * LEAST(COUNT(*) / 10.0, 1.0) as mastery
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            GROUP BY student_id, subject, subskill_id
            """,
            
            "ready_subskills": f"""
            CREATE OR REPLACE VIEW `{self.project_id}.{self.dataset_id}.ready_subskills` AS
            WITH base_skills AS (
              -- Skills with no prerequisites (base nodes)
              SELECT DISTINCT prerequisite_skill_id as skill_id
              FROM `{self.project_id}.{self.dataset_id}.learning_paths`
              WHERE is_base_node = TRUE
            ),
            unlocked_skills AS (
              -- Skills unlocked by meeting prerequisites
              SELECT DISTINCT 
                lp.unlocks_skill_id as skill_id,
                ssm.student_id
              FROM `{self.project_id}.{self.dataset_id}.learning_paths` lp
              JOIN `{self.project_id}.{self.dataset_id}.student_subskill_metrics` ssm
                ON lp.prerequisite_skill_id = REGEXP_EXTRACT(ssm.subskill_id, r'^([A-Z0-9]+-[A-Z0-9]+)')
              WHERE ssm.proficiency >= 0.6  -- 60% threshold
            )
            SELECT student_id, skill_id, 'Ready' as readiness_status
            FROM unlocked_skills
            UNION ALL
            SELECT DISTINCT 
              ssm.student_id, 
              REGEXP_EXTRACT(ssm.subskill_id, r'^([A-Z0-9]+-[A-Z0-9]+)') as skill_id,
              'Ready' as readiness_status
            FROM `{self.project_id}.{self.dataset_id}.student_subskill_metrics` ssm
            JOIN base_skills bs ON REGEXP_EXTRACT(ssm.subskill_id, r'^([A-Z0-9]+-[A-Z0-9]+)') = bs.skill_id
            """,
            
            "daily_progress": f"""
            CREATE OR REPLACE VIEW `{self.project_id}.{self.dataset_id}.daily_progress` AS
            SELECT 
              student_id,
              subject,
              DATE(timestamp) as date,
              COUNT(*) as daily_attempts,
              COUNT(DISTINCT subskill_id) as subskills_practiced,
              AVG(score / 10.0) as daily_avg_score,
              MAX(score / 10.0) as daily_max_score
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            GROUP BY student_id, subject, DATE(timestamp)
            """
        }
        
        for view_name, view_sql in views.items():
            try:
                query_job = self.client.query(view_sql)
                query_job.result()  # Wait for completion
                logger.info(f"Created/updated view {view_name}")
            except Exception as e:
                logger.error(f"Failed to create view {view_name}: {e}")

    async def health_check(self) -> Dict[str, Any]:
        """Check BigQuery service health and connectivity"""
        try:
            # Test basic connectivity
            datasets = list(self.client.list_datasets(max_results=1))
            
            # Test query execution
            test_query = f"""
            SELECT COUNT(*) as total_attempts
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            LIMIT 1
            """
            
            job_config = bigquery.QueryJobConfig(dry_run=True)  # Don't actually run
            query_job = self.client.query(test_query, job_config=job_config)
            
            return {
                "status": "healthy",
                "project_id": self.project_id,
                "dataset_id": self.dataset_id,
                "query_validation": "passed",
                "cache_size": len(self._cache),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def get_velocity_metrics(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> List[Dict]:
        """Fetch velocity metrics from student_velocity_metrics table"""
        
        # Check cache first
        cache_key = self._get_cache_key(
            "velocity_metrics",
            student_id=student_id,
            subject=subject
        )
        
        cached_result = self._get_cache(cache_key)
        if cached_result:
            logger.info(f"Returning cached velocity metrics for student {student_id}")
            return cached_result
        
        try:
            query = f"""
            SELECT
                student_id,
                student_name,
                subject,
                actual_progress,
                expected_progress,
                total_subskills_in_subject,
                velocity_percentage,
                days_ahead_behind,
                velocity_status,
                last_updated,
                calculation_date
            FROM `{self.project_id}.{self.dataset_id}.student_velocity_metrics`
            WHERE student_id = @student_id
            AND (@subject IS NULL OR subject = @subject)
            ORDER BY 
                CASE 
                    WHEN velocity_status = 'Significantly Behind' THEN 1
                    WHEN velocity_status = 'Behind' THEN 2
                    WHEN velocity_status = 'Slightly Behind' THEN 3
                    WHEN velocity_status = 'On Track' THEN 4
                    WHEN velocity_status = 'Significantly Ahead' THEN 5
                    ELSE 6
                END, subject
            """
            
            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject)
            ]
            
            results = await self._run_query_async(query, parameters)
            
            # Cache the result with 15-minute TTL
            self._set_cache(cache_key, results)
            
            logger.info(f"Retrieved {len(results)} velocity metrics for student {student_id}")
            return results
            
        except Exception as e:
            logger.error(f"Error getting velocity metrics for student {student_id}: {e}")
            # Return empty list on error rather than raising to prevent dashboard failures
            return []

    async def get_query_costs(self, days: int = 7) -> Dict[str, Any]:
        """Get query cost information for monitoring"""
        try:
            # Query the INFORMATION_SCHEMA to get job statistics
            query = f"""
            SELECT 
              DATE(creation_time) as query_date,
              COUNT(*) as query_count,
              SUM(total_bytes_processed) / POW(10, 12) as total_tb_processed,
              SUM(total_bytes_processed) / POW(10, 12) * 5 as estimated_cost_usd
            FROM `{self.project_id}.region-us.INFORMATION_SCHEMA.JOBS_BY_PROJECT`
            WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
              AND job_type = 'QUERY'
              AND state = 'DONE'
              AND ARRAY_LENGTH(labels) > 0
              AND EXISTS(
                SELECT 1 FROM UNNEST(labels) as label 
                WHERE label.key = 'service' AND label.value = 'analytics'
              )
            GROUP BY DATE(creation_time)
            ORDER BY query_date DESC
            """
            
            parameters = [
                bigquery.ScalarQueryParameter("days", "INT64", days)
            ]
            
            results = await self._run_query_async(query, parameters)
            
            total_cost = sum(row.get('estimated_cost_usd', 0) for row in results)
            total_queries = sum(row.get('query_count', 0) for row in results)
            
            return {
                "daily_breakdown": results,
                "total_estimated_cost_usd": total_cost,
                "total_queries": total_queries,
                "period_days": days,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting query costs: {e}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def get_student_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> Optional[Dict]:
        """Get student competency data for a specific subskill"""

        try:
            query = f"""
            SELECT
                student_id,
                subskill_id,
                AVG(score) as current_score,
                COUNT(*) as attempt_count,
                -- Credibility based on attempt count (max at 10 attempts)
                LEAST(COUNT(*) / 10.0, 1.0) as credibility,
                -- Mastery calculation (avg_score * credibility)
                AVG(score / 10.0) * LEAST(COUNT(*) / 10.0, 1.0) as mastery,
                MIN(timestamp) as first_attempt,
                MAX(timestamp) as last_attempt
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            WHERE student_id = @student_id
                AND subject = @subject
                AND subskill_id = @subskill_id
            GROUP BY student_id, subskill_id
            """

            parameters = [
                bigquery.ScalarQueryParameter("student_id", "INT64", student_id),
                bigquery.ScalarQueryParameter("subject", "STRING", subject),
                bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)
            ]

            results = await self._run_query_async(query, parameters)

            if results and len(results) > 0:
                result = results[0]
                return {
                    'current_score': float(result['current_score']),
                    'credibility': float(result['credibility']),
                    'mastery': float(result['mastery']),
                    'attempt_count': int(result['attempt_count']),
                    'first_attempt': result['first_attempt'],
                    'last_attempt': result['last_attempt']
                }
            else:
                # Return None if no data found
                return None

        except Exception as e:
            logger.error(f"Error getting student competency for {subskill_id}: {e}")
            return None

    def clear_cache(self):
        """Clear the analytics cache"""
        self._cache.clear()
        logger.info("Analytics cache cleared")

    async def refresh_materialized_views(self):
        """Refresh materialized views if using them"""
        # Note: BigQuery doesn't have traditional materialized views
        # but we could implement scheduled queries or manual refresh logic here
        pass
