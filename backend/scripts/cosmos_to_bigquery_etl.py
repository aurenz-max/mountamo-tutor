# backend/scripts/cosmos_to_bigquery_etl.py
# 
# Enhanced ETL script that automatically creates BigQuery analytics tables and views
# after loading data from Cosmos DB and other sources.

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

# Load environment
env_path = backend_dir / ".env"
load_dotenv(env_path)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_credentials():
    """Set up Google Cloud credentials with proper path resolution"""
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    if credentials_path:
        # Handle both relative and absolute paths
        if not os.path.isabs(credentials_path):
            # If relative, make it relative to backend directory
            full_credentials_path = backend_dir / credentials_path
        else:
            full_credentials_path = Path(credentials_path)
        
        print(f"Setting up credentials...")
        print(f"Credentials path from env: {credentials_path}")
        print(f"Full credentials path: {full_credentials_path}")
        print(f"Credentials file exists: {full_credentials_path.exists()}")
        
        # Set the absolute path for Google Cloud client
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(full_credentials_path)
        
        return full_credentials_path.exists()
    
    return False

class FullETLLoader:
    """Full ETL data loader for production use"""
    
    def __init__(self, batch_size: int = 1000):
        self.etl_service = None
        self.batch_size = batch_size
        self.results = {}
        self.start_time = None
        
    async def setup(self):
        """Setup the ETL environment"""
        print("🔧 Setting up ETL environment...")
        
        # Setup credentials
        if not setup_credentials():
            raise Exception("❌ Credentials setup failed - file not found")
        
        # Import and initialize services
        try:
            from app.services.bigquery_etl import BigQueryETLService
            self.etl_service = BigQueryETLService()
            print("✅ ETL service initialized")
            
            # Test connections first
            connection_results = await self.etl_service.test_connections()
            
            if not connection_results.get("bigquery", False):
                raise Exception("❌ BigQuery connection failed")
            
            if not connection_results.get("cosmos_db", False):
                raise Exception("❌ Cosmos DB connection failed")
            
            print("✅ All connections verified")
            
        except Exception as e:
            raise Exception(f"❌ Failed to initialize ETL service: {e}")
    
    async def ensure_tables_exist(self):
        """Ensure all required BigQuery tables exist"""
        print("\n🏗️  Ensuring BigQuery tables exist...")
        
        tables_to_create = [
            ("students", self.etl_service._get_students_schema()),
            ("attempts", self.etl_service._get_attempts_schema()),
            ("reviews", self.etl_service._get_reviews_schema()),
            ("curriculum", self.etl_service._get_curriculum_schema()),
            ("learning_paths", self.etl_service._get_learning_paths_schema())
        ]
        
        for table_name, schema in tables_to_create:
            try:
                await self.etl_service._ensure_table_exists(table_name, schema)
                print(f"✅ {table_name.title()} table ready")
            except Exception as e:
                print(f"❌ Failed to create {table_name} table: {e}")
                raise
    
    async def load_attempts_data(self, incremental: bool = False):
        """Load all attempts data from Cosmos DB to BigQuery"""
        print(f"\n📊 Loading attempts data {'(smart dedup)' if incremental else '(full replace)'}...")
        
        try:
            # For your limited dataset, always use full load with MERGE logic
            # This ensures no duplicates regardless of how many times you run it
            result = await self.etl_service.sync_attempts_from_cosmos(
                incremental=False,  # Always do full load, let MERGE handle duplicates
                limit=None
            )
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Attempts data loaded: {records_processed:,} records")
                self.results['attempts'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Attempts data load failed: {error_msg}")
                self.results['attempts'] = result
                
        except Exception as e:
            print(f"❌ Attempts data load failed: {e}")
            self.results['attempts'] = {'success': False, 'error': str(e)}

    async def clean_reload_contaminated_tables(self):
        """Force clean reload of contaminated tables by truncating them first"""
        print("🧹 Force cleaning contaminated tables for fresh reload...")
        
        try:
            # Truncate attempts table to remove all duplicates
            truncate_attempts = "DELETE FROM `mountamo-tutor-h7wnta.analytics.attempts` WHERE TRUE"
            await self.etl_service._execute_query(truncate_attempts)
            print("✅ Attempts table cleared")
            
            # Truncate reviews table to remove all duplicates
            truncate_reviews = "DELETE FROM `mountamo-tutor-h7wnta.analytics.reviews` WHERE TRUE"
            await self.etl_service._execute_query(truncate_reviews)
            print("✅ Reviews table cleared")
            
        except Exception as e:
            print(f"⚠️  Could not clear tables: {e}")
            # Continue anyway - the MERGE will still work
    
    async def load_reviews_data(self, incremental: bool = False):
        """Load all reviews data from Cosmos DB to BigQuery"""
        print(f"\n📝 Loading reviews data {'(smart dedup)' if incremental else '(full replace)'}...")
        
        try:
            # For your limited dataset, always use full load
            # Reviews don't have MERGE logic yet, but they can use cosmos_id for deduplication
            result = await self.etl_service.sync_reviews_from_cosmos(
                incremental=False,  # Always do full load
                limit=None
            )
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                print(f"✅ Reviews data loaded: {records_processed:,} records")
                self.results['reviews'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ Reviews data load failed: {error_msg}")
                self.results['reviews'] = result
                
        except Exception as e:
            print(f"❌ Reviews data load failed: {e}")
            self.results['reviews'] = {'success': False, 'error': str(e)}
    
    async def refresh_curriculum_views(self):
        """Refresh curriculum compatibility views from analytics.curriculum_* tables"""
        print(f"\n📚 Refreshing curriculum views from analytics.curriculum_* tables...")

        try:
            # Refresh the learning_paths table (materialized from prerequisites)
            refresh_learning_paths_sql = """
            CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.learning_paths` AS
            SELECT DISTINCT
              p.prerequisite_entity_id as prerequisite_skill_id,
              p.unlocks_entity_id as unlocks_skill_id,
              p.min_proficiency_threshold as min_score_threshold,
              NOT EXISTS(
                SELECT 1 FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p2
                WHERE p2.unlocks_entity_id = p.prerequisite_entity_id
                  AND p2.unlocks_entity_type = 'skill'
                  AND p2.is_draft = false
              ) as is_base_node,
              CURRENT_TIMESTAMP() as sync_timestamp
            FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
            WHERE p.prerequisite_entity_type = 'skill'
              AND p.unlocks_entity_type = 'skill'
              AND p.is_draft = false
              AND p.version_id IN (
                SELECT version_id FROM `mountamo-tutor-h7wnta.analytics.curriculum_versions`
                WHERE is_active = true
              )
            """

            await self.etl_service._execute_query(refresh_learning_paths_sql)
            print("✅ Learning paths table refreshed from analytics.curriculum_prerequisites")

            # Validate curriculum view (it's auto-refreshing, just check it exists)
            validation_query = """
            SELECT
              COUNT(*) as total_subskills,
              COUNT(DISTINCT subject) as total_subjects,
              COUNT(DISTINCT skill_id) as total_skills
            FROM `mountamo-tutor-h7wnta.analytics.curriculum`
            """
            result = await self.etl_service._execute_query(validation_query, return_results=True)

            if result:
                subskills = result[0].get('total_subskills', 0)
                subjects = result[0].get('total_subjects', 0)
                skills = result[0].get('total_skills', 0)
                print(f"✅ Curriculum view validated: {subskills:,} subskills, {skills:,} skills, {subjects} subjects")

                self.results['curriculum_views'] = {
                    'success': True,
                    'subskill_count': subskills,
                    'skill_count': skills,
                    'subject_count': subjects
                }
            else:
                print("⚠️  Could not validate curriculum view")
                self.results['curriculum_views'] = {'success': True, 'warning': 'Could not validate'}

        except Exception as e:
            print(f"❌ Failed to refresh curriculum views: {e}")
            self.results['curriculum_views'] = {'success': False, 'error': str(e)}

    async def load_curriculum_data(self):
        """DEPRECATED: Curriculum now comes from analytics.curriculum_* tables via refresh_curriculum_views()"""
        print(f"\n📚 Skipping legacy curriculum load - using analytics.curriculum_* tables instead")
        self.results['curriculum'] = {
            'skipped': True,
            'reason': 'Using analytics.curriculum_* tables (see refresh_curriculum_views)'
        }

    async def load_learning_paths_data(self):
        """DEPRECATED: Learning paths now derived from analytics.curriculum_prerequisites via refresh_curriculum_views()"""
        print(f"\n🛤️  Skipping legacy learning paths load - using analytics.curriculum_prerequisites instead")
        self.results['learning_paths'] = {
            'skipped': True,
            'reason': 'Using analytics.curriculum_prerequisites (see refresh_curriculum_views)'
        }
    
    async def load_user_profiles_data(self, incremental: bool = False):
        """Load user profiles data from Cosmos DB to create proper students table"""
        print(f"\n👤 Loading user profiles data {'(incremental)' if incremental else '(full load)'}...")
        
        try:
            # Check if ETL service has cosmos connection
            if not self.etl_service.cosmos_db:
                self.etl_service._initialize_cosmos_service()
            
            result = await self.etl_service.sync_user_profiles_from_cosmos(
                incremental=True,  # Always use incremental for user profiles to avoid duplicates
                limit=None  # Load all data
            )
            
            records_processed = result.get('records_processed', 0)
            success = result.get('success', False)
            
            if success:
                # Immediately deduplicate the students table after loading
                print("🔧 Deduplicating students table...")
                try:
                    dedup_query = """
                    CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.students` AS
                    SELECT 
                        student_id, name, email, grade, 
                        firebase_uid, total_points, current_streak, longest_streak, level, 
                        badges, selected_subjects, selected_packages, learning_goals, 
                        preferred_learning_style, email_verified, onboarding_completed, 
                        last_login, last_activity, onboarding_completed_at, created_at, 
                        updated_at, sync_timestamp
                    FROM (
                        SELECT 
                            *,
                            ROW_NUMBER() OVER (
                                PARTITION BY student_id 
                                ORDER BY sync_timestamp DESC, updated_at DESC
                            ) as row_num
                        FROM `mountamo-tutor-h7wnta.analytics.students`
                    )
                    WHERE row_num = 1
                    """
                    await self.etl_service._execute_query(dedup_query)
                    print("✅ Students table deduplicated successfully")
                except Exception as dedup_error:
                    print(f"⚠️  Could not deduplicate students table: {dedup_error}")
                
                print(f"✅ User profiles data loaded: {records_processed:,} records")
                self.results['user_profiles'] = result
            else:
                error_msg = result.get('error', 'Unknown error')
                print(f"❌ User profiles data load failed: {error_msg}")
                self.results['user_profiles'] = result
                
        except Exception as e:
            print(f"❌ User profiles data load failed: {e}")
            self.results['user_profiles'] = {'success': False, 'error': str(e)}
    
    async def validate_loaded_data(self):
        """Validate the loaded data"""
        print(f"\n🔍 Validating loaded data...")
        
        try:
            validation_results = await self.etl_service.validate_data_integrity()
            
            print("Data validation results:")
            for table, stats in validation_results.items():
                if table in ["validation_timestamp", "overall_status", "quality_issues"]:
                    continue
                
                if isinstance(stats, dict) and "error" not in stats:
                    record_count = stats.get('total_attempts' if 'attempts' in table else f'total_{table.split("_")[0]}_items', 0)
                    print(f"  📊 {table.title()}: {record_count:,} records")
                else:
                    print(f"  ⚠️  {table.title()}: {stats.get('error', 'No data')}")
            
            if validation_results.get("quality_issues"):
                print(f"\n⚠️  Quality Issues Found:")
                for issue in validation_results["quality_issues"]:
                    print(f"   - {issue}")
            else:
                print("✅ No data quality issues found")
            
            self.results['validation'] = validation_results
            
        except Exception as e:
            print(f"❌ Data validation failed: {e}")
            self.results['validation'] = {'success': False, 'error': str(e)}
    
    async def create_student_analytics_table(self):
        """Create the student analytics table using the complex SQL query"""
        print(f"\n🧠 Creating student analytics table...")
        
        try:
            # The refactored SQL query to fix one-to-many relationship issues
            student_analytics_sql = """
            CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.student_analytics` AS
            WITH 
            -- 1. Fix curriculum deduplication - only keep essential fields for joins
            curriculum_hierarchy AS (
                SELECT DISTINCT
                    subject,
                    skill_id,
                    subskill_id
                FROM `mountamo-tutor-h7wnta.analytics.curriculum`
                WHERE subject IS NOT NULL 
                AND skill_id IS NOT NULL 
                AND subskill_id IS NOT NULL
            ),

            -- 2. Get one canonical curriculum record per (subject, skill_id, subskill_id)
            curriculum_canonical AS (
                SELECT 
                    ch.subject,
                    ch.skill_id,
                    ch.subskill_id,
                    -- Use ANY_VALUE to pick one record per unique combination
                    ANY_VALUE(c.grade) as grade,
                    ANY_VALUE(c.unit_id) as unit_id,
                    ANY_VALUE(c.unit_title) as unit_title,
                    ANY_VALUE(c.skill_description) as skill_description,
                    ANY_VALUE(c.subskill_description) as subskill_description,
                    ANY_VALUE(c.difficulty_start) as difficulty_start,
                    ANY_VALUE(c.difficulty_end) as difficulty_end,
                    ANY_VALUE(c.target_difficulty) as target_difficulty
                FROM curriculum_hierarchy ch
                JOIN `mountamo-tutor-h7wnta.analytics.curriculum` c
                    ON ch.subject = c.subject 
                    AND ch.skill_id = c.skill_id 
                    AND ch.subskill_id = c.subskill_id
                GROUP BY ch.subject, ch.skill_id, ch.subskill_id
            ),

            -- 3. Student-subskill scores (already aggregated properly)
            student_subskill_scores AS (
                SELECT 
                    student_id,
                    subskill_id,
                    subject,
                    skill_id,
                    AVG(score / 10) AS avg_score,
                    COUNT(*) AS attempt_count,
                    MIN(timestamp) AS first_attempt,
                    MAX(timestamp) AS last_attempt
                FROM `mountamo-tutor-h7wnta.analytics.attempts`
                GROUP BY student_id, subskill_id, subject, skill_id
            ),

            -- 4. Only calculate proficiency for attempted items first
            attempted_subskill_proficiency AS (
                SELECT
                    sss.student_id,
                    cc.subject,
                    cc.skill_id,
                    cc.subskill_id,
                    sss.avg_score AS proficiency
                FROM student_subskill_scores sss
                JOIN curriculum_canonical cc 
                    ON sss.subskill_id = cc.subskill_id
                    AND sss.subject = cc.subject
                    AND sss.skill_id = cc.skill_id
            ),

            -- 5. Add non-attempted items only for students who have some activity
            all_student_subskill_proficiency AS (
                -- Attempted items
                SELECT * FROM attempted_subskill_proficiency
                
                UNION ALL
                
                -- Non-attempted items for active students only
                SELECT
                    s.student_id,
                    cc.subject,
                    cc.skill_id,
                    cc.subskill_id,
                    0.0 AS proficiency
                FROM `mountamo-tutor-h7wnta.analytics.students` s
                CROSS JOIN curriculum_canonical cc
                WHERE s.student_id IN (
                    SELECT DISTINCT student_id 
                    FROM attempted_subskill_proficiency
                )
                AND NOT EXISTS (
                    SELECT 1 FROM attempted_subskill_proficiency asp
                    WHERE asp.student_id = s.student_id
                    AND asp.subskill_id = cc.subskill_id
                    AND asp.subject = cc.subject
                    AND asp.skill_id = cc.skill_id
                )
            ),

            -- 6. Calculate skill proficiency from subskill proficiencies
            skill_proficiency AS (
                SELECT
                    student_id,
                    subject,
                    skill_id,
                    AVG(proficiency) AS proficiency
                FROM all_student_subskill_proficiency
                GROUP BY student_id, subject, skill_id
            ),

            -- 7. Simplified readiness calculation
            ready_subskills AS (
                -- First subskills (no prerequisites)
                SELECT DISTINCT
                    assp.student_id,
                    cc.subskill_id
                FROM all_student_subskill_proficiency assp
                JOIN curriculum_canonical cc 
                    ON assp.subskill_id = cc.subskill_id
                LEFT JOIN `mountamo-tutor-h7wnta.analytics.subskill_paths` slp 
                    ON cc.subskill_id = slp.next_subskill
                WHERE slp.current_subskill IS NULL
                
                UNION DISTINCT
                
                -- Prerequisites met (>= 60% proficiency)
                SELECT DISTINCT
                    assp.student_id,
                    slp.next_subskill AS subskill_id
                FROM all_student_subskill_proficiency assp
                JOIN `mountamo-tutor-h7wnta.analytics.subskill_paths` slp 
                    ON assp.subskill_id = slp.current_subskill
                WHERE assp.proficiency >= 0.6
                    AND slp.next_subskill IS NOT NULL
            ),

            -- 8. Main query - single source of truth
            final_analytics AS (
                SELECT 
                    assp.student_id,
                    s.name AS student_name,
                    CAST(s.grade AS STRING) AS student_grade,
                    assp.subject,
                    assp.skill_id,
                    assp.subskill_id,
                    
                    -- Attempt data (only for attempted items)
                    sss.avg_score AS score,
                    COALESCE(sss.attempt_count, 0) AS attempt_count,
                    sss.first_attempt,
                    sss.last_attempt,
                    
                    -- Curriculum data
                    cc.grade AS curriculum_grade,
                    cc.unit_id,
                    cc.unit_title,
                    cc.skill_description,
                    cc.subskill_description,
                    cc.difficulty_start,
                    cc.difficulty_end,
                    cc.target_difficulty,
                    
                    -- Coverage status
                    CASE WHEN sss.student_id IS NOT NULL THEN 'Has Attempts' 
                         ELSE 'No Attempts' END AS coverage_status,
                    
                    -- Readiness status
                    CASE WHEN rs.subskill_id IS NOT NULL THEN 'Ready'
                         ELSE 'Not Ready' END AS readiness_status,
                    
                    -- Priority level
                    CASE
                        WHEN assp.proficiency >= 0.8 THEN 'Mastered'
                        WHEN assp.proficiency BETWEEN 0.4 AND 0.799 THEN 'High Priority'
                        WHEN assp.proficiency < 0.4 AND assp.proficiency > 0 THEN 'Medium Priority'
                        WHEN assp.proficiency = 0 THEN 'Not Started'
                        ELSE 'Not Assessed'
                    END AS priority_level,
                    
                    -- Priority order
                    CASE 
                        WHEN assp.proficiency BETWEEN 0.4 AND 0.799 THEN 1
                        WHEN assp.proficiency < 0.4 AND assp.proficiency > 0 THEN 2
                        WHEN assp.proficiency = 0 THEN 3
                        WHEN assp.proficiency >= 0.8 THEN 4
                        ELSE 5
                    END AS priority_order,
                    
                    -- Recommendation
                    CASE
                        WHEN rs.subskill_id IS NOT NULL AND assp.proficiency BETWEEN 0.4 AND 0.799
                        THEN 'Recommended Next'
                        ELSE NULL
                    END AS recommended_next,
                    
                    -- Proficiency data
                    assp.proficiency AS subskill_proficiency,
                    skp.proficiency AS skill_proficiency,
                    
                    -- Next subskill in learning path
                    slp.next_subskill AS next_subskill,
                    
                    CURRENT_TIMESTAMP() AS sync_timestamp
                    
                FROM all_student_subskill_proficiency assp
                JOIN `mountamo-tutor-h7wnta.analytics.students` s 
                    ON assp.student_id = s.student_id
                JOIN curriculum_canonical cc 
                    ON assp.subskill_id = cc.subskill_id
                    AND assp.subject = cc.subject
                    AND assp.skill_id = cc.skill_id
                LEFT JOIN student_subskill_scores sss
                    ON assp.student_id = sss.student_id
                    AND assp.subskill_id = sss.subskill_id
                    AND assp.subject = sss.subject
                    AND assp.skill_id = sss.skill_id
                LEFT JOIN ready_subskills rs
                    ON assp.student_id = rs.student_id
                    AND assp.subskill_id = rs.subskill_id
                LEFT JOIN skill_proficiency skp
                    ON assp.student_id = skp.student_id
                    AND assp.skill_id = skp.skill_id
                    AND assp.subject = skp.subject
                LEFT JOIN `mountamo-tutor-h7wnta.analytics.subskill_paths` slp 
                    ON assp.subskill_id = slp.current_subskill
            )
            
            SELECT * FROM final_analytics
            ORDER BY student_id, subject, priority_order, skill_id, subskill_id
            """
            
            # Execute the query
            await self.etl_service._execute_query(student_analytics_sql)
            print("✅ Student analytics table created successfully")
            self.results['student_analytics_table'] = {'success': True}
            
        except Exception as e:
            print(f"❌ Failed to create student analytics table: {e}")
            self.results['student_analytics_table'] = {'success': False, 'error': str(e)}
    
    async def create_analytics_views(self):
        """Create the analytics views"""
        print(f"\n📊 Creating analytics views...")
        
        try:
            # Focus Areas View
            focus_areas_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_focus_areas` AS

            WITH deduplicated_student_analytics AS (
                SELECT 
                    student_id,
                    student_name,
                    subject,
                    priority_level,
                    unit_title,
                    skill_description,
                    subskill_description,
                    next_subskill,
                    readiness_status,
                    coverage_status,
                    subskill_proficiency,
                    score,
                    attempt_count,
                    sync_timestamp
                FROM (
                    SELECT 
                        *,
                        -- Use the most recent data for each student-subskill combination
                        ROW_NUMBER() OVER (
                            PARTITION BY student_id, subskill_id 
                            ORDER BY sync_timestamp DESC
                        ) as rn
                    FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
                    WHERE priority_level IS NOT NULL
                )
                WHERE rn = 1
            )

            -- Level 1: Subject totals
            SELECT 
                student_id,
                student_name,
                subject,
                CAST(NULL AS STRING) as priority_level,
                CAST(NULL AS STRING) as unit_title,
                CAST(NULL AS STRING) as skill_description,
                CAST(NULL AS STRING) as subskill_description,
                CAST(NULL AS STRING) as next_subskill,
                'subject' as hierarchy_level,
                1 as sort_order,
                
                -- Aggregated metrics
                SUM(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END) as attempts,
                AVG(CASE WHEN readiness_status = 'Ready' THEN subskill_proficiency ELSE NULL END) as proficiency_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END) as completion_rate_pct,
                AVG(subskill_proficiency) as mastery_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN score ELSE NULL END) as avg_score
            FROM deduplicated_student_analytics
            GROUP BY student_id, student_name, subject

            UNION ALL

            -- Level 2: Priority level groupings within each subject
            SELECT 
                student_id,
                student_name,
                subject,
                priority_level,
                CAST(NULL AS STRING) as unit_title,
                CAST(NULL AS STRING) as skill_description,
                CAST(NULL AS STRING) as subskill_description,
                CAST(NULL AS STRING) as next_subskill,
                'priority' as hierarchy_level,
                CASE 
                    WHEN priority_level = 'Mastered' THEN 2
                    WHEN priority_level = 'High Priority' THEN 3
                    WHEN priority_level = 'Medium Priority' THEN 4
                    WHEN priority_level = 'Not Started' THEN 5
                    ELSE 6
                END as sort_order,
                
                -- Aggregated metrics for this priority level
                SUM(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END) as attempts,
                AVG(CASE WHEN readiness_status = 'Ready' THEN subskill_proficiency ELSE NULL END) as proficiency_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END) as completion_rate_pct,
                AVG(subskill_proficiency) as mastery_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN score ELSE NULL END) as avg_score
            FROM deduplicated_student_analytics
            GROUP BY student_id, student_name, subject, priority_level

            UNION ALL

            -- Level 3: Units within priority levels
            SELECT 
                student_id,
                student_name,
                subject,
                priority_level,
                unit_title,
                CAST(NULL AS STRING) as skill_description,
                CAST(NULL AS STRING) as subskill_description,
                CAST(NULL AS STRING) as next_subskill,
                'unit' as hierarchy_level,
                CASE 
                    WHEN priority_level = 'Mastered' THEN 10
                    WHEN priority_level = 'High Priority' THEN 20
                    WHEN priority_level = 'Medium Priority' THEN 30
                    WHEN priority_level = 'Not Started' THEN 40
                    ELSE 50
                END + ROW_NUMBER() OVER (PARTITION BY student_id, subject, priority_level ORDER BY unit_title) as sort_order,
                
                -- Aggregated metrics for this unit within priority level
                SUM(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END) as attempts,
                AVG(CASE WHEN readiness_status = 'Ready' THEN subskill_proficiency ELSE NULL END) as proficiency_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END) as completion_rate_pct,
                AVG(subskill_proficiency) as mastery_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN score ELSE NULL END) as avg_score
            FROM deduplicated_student_analytics
            GROUP BY student_id, student_name, subject, priority_level, unit_title

            UNION ALL

            -- Level 4: Skills within units
            SELECT 
                student_id,
                student_name,
                subject,
                priority_level,
                unit_title,
                skill_description,
                CAST(NULL AS STRING) as subskill_description,
                CAST(NULL AS STRING) as next_subskill,
                'skill' as hierarchy_level,
                CASE 
                    WHEN priority_level = 'Mastered' THEN 100
                    WHEN priority_level = 'High Priority' THEN 200
                    WHEN priority_level = 'Medium Priority' THEN 300
                    WHEN priority_level = 'Not Started' THEN 400
                    ELSE 500
                END + ROW_NUMBER() OVER (PARTITION BY student_id, subject, priority_level, unit_title ORDER BY skill_description) as sort_order,
                
                -- Aggregated metrics for this skill within unit
                SUM(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END) as attempts,
                AVG(CASE WHEN readiness_status = 'Ready' THEN subskill_proficiency ELSE NULL END) as proficiency_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END) as completion_rate_pct,
                AVG(subskill_proficiency) as mastery_pct,
                AVG(CASE WHEN coverage_status = 'Has Attempts' THEN score ELSE NULL END) as avg_score
            FROM deduplicated_student_analytics
            GROUP BY student_id, student_name, subject, priority_level, unit_title, skill_description

            UNION ALL

            -- Level 5: Individual subskills (leaf level)
            SELECT 
                student_id,
                student_name,
                subject,
                priority_level,
                unit_title,
                skill_description,
                subskill_description,
                next_subskill,
                'subskill' as hierarchy_level,
                CASE 
                    WHEN priority_level = 'Mastered' THEN 1000
                    WHEN priority_level = 'High Priority' THEN 2000
                    WHEN priority_level = 'Medium Priority' THEN 3000
                    WHEN priority_level = 'Not Started' THEN 4000
                    ELSE 5000
                END + ROW_NUMBER() OVER (PARTITION BY student_id, subject, priority_level, unit_title, skill_description ORDER BY subskill_description) as sort_order,
                
                -- Individual subskill metrics
                CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END as attempts,
                CASE WHEN readiness_status = 'Ready' THEN subskill_proficiency ELSE NULL END as proficiency_pct,
                CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END as completion_rate_pct,
                subskill_proficiency as mastery_pct,
                CASE WHEN coverage_status = 'Has Attempts' THEN score ELSE NULL END as avg_score
            FROM deduplicated_student_analytics
            """
            
            # Next Subskill Recommendations View
            next_subskills_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_next_subskills` AS
            WITH deduplicated_analytics AS (
                SELECT 
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY student_id, subskill_id 
                        ORDER BY sync_timestamp DESC
                    ) as rn
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
            )

            SELECT 
                sa.student_id,
                sa.student_name,
                sa.subject,
                sa.unit_title,
                sa.skill_description,
                sa.subskill_description as current_subskill,
                sa.next_subskill,
                sa.subskill_proficiency as current_proficiency,
                
                -- Next subskill information
                next_sa.subskill_description as next_subskill_description,
                next_sa.readiness_status as next_readiness_status,
                next_sa.priority_level as next_priority_level,
                
                -- Recommendation logic
                CASE 
                    WHEN sa.subskill_proficiency >= 0.8 AND sa.next_subskill IS NOT NULL THEN 'Ready for Next'
                    WHEN sa.subskill_proficiency >= 0.6 AND sa.next_subskill IS NOT NULL THEN 'Almost Ready'
                    WHEN sa.next_subskill IS NOT NULL THEN 'Need More Practice'
                    ELSE 'No Next Subskill'
                END as recommendation_status,
                
                -- Priority for recommendations
                CASE 
                    WHEN sa.subskill_proficiency >= 0.8 AND sa.next_subskill IS NOT NULL THEN 1
                    WHEN sa.subskill_proficiency >= 0.6 AND sa.next_subskill IS NOT NULL THEN 2
                    WHEN sa.next_subskill IS NOT NULL THEN 3
                    ELSE 4
                END as recommendation_priority
            FROM deduplicated_analytics sa
            LEFT JOIN deduplicated_analytics next_sa
                ON sa.student_id = next_sa.student_id 
                AND sa.next_subskill = next_sa.subskill_id
                AND next_sa.rn = 1
            WHERE sa.rn = 1
                AND sa.priority_level = 'Mastered' 
                AND sa.next_subskill IS NOT NULL
            """
            
            # Execute both view creation queries
            await self.etl_service._execute_query(focus_areas_view_sql)
            print("✅ Focus areas view created successfully")
            
            await self.etl_service._execute_query(next_subskills_view_sql)
            print("✅ Next subskills recommendations view created successfully")
            
            self.results['analytics_views'] = {'success': True}
            
        except Exception as e:
            print(f"❌ Failed to create analytics views: {e}")
            self.results['analytics_views'] = {'success': False, 'error': str(e)}
    
    async def create_mastery_views(self):
        """Create the student mastery views hierarchy"""
        print(f"\n🎯 Creating student mastery views...")
        
        try:
            # 1. Base Subskill Mastery View
            subskill_mastery_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_subskill_mastery` AS
            SELECT 
                student_id,
                student_name,
                student_grade,
                subject,
                unit_id,
                unit_title,
                skill_id,
                skill_description,
                subskill_id,
                subskill_description,
                
                -- Mastery calculations (considers ALL items)
                subskill_proficiency as subskill_mastery_pct,
                
                -- Proficiency calculations (only considers "Ready" items)
                CASE 
                    WHEN readiness_status = 'Ready' THEN COALESCE(score, 0)
                    ELSE NULL 
                END as subskill_proficiency_pct,
                
                -- Readiness status
                readiness_status,
                
                -- Completion rate (whether they attempted this subskill)
                CASE WHEN coverage_status = 'Has Attempts' THEN 1.0 ELSE 0.0 END as completion_rate,
                
                -- Proficiency threshold (using your 60% threshold)
                CASE WHEN subskill_proficiency >= 0.6 THEN 1.0 ELSE 0.0 END as is_proficient,
                
                -- Attempt information
                CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE 0 END as total_attempts,
                
                -- Timestamps
                first_attempt,
                last_attempt,
                sync_timestamp as calculated_at
            FROM 
                `mountamo-tutor-h7wnta.analytics.student_analytics`
            WHERE 
                -- Only get one row per student-subskill combination
                (coverage_status = 'Has Attempts' AND score IS NOT NULL)
                OR (coverage_status = 'No Attempts')
            """
            
            # 2. Student Skill Mastery View
            skill_mastery_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_skill_mastery` AS
            SELECT 
                student_id,
                student_name,
                student_grade,
                subject,
                unit_id,
                unit_title,
                skill_id,
                skill_description,
                
                -- Skill mastery = average of all subskill masteries within this skill (ALL items)
                AVG(subskill_mastery_pct) as skill_mastery_pct,
                
                -- Skill proficiency = average of ready subskill proficiencies within this skill (READY items only)
                AVG(subskill_proficiency_pct) as skill_proficiency_pct,
                
                -- Completion rate = percentage of subskills attempted
                AVG(completion_rate) as completion_rate_pct,
                
                -- Proficiency threshold = percentage of subskills that are proficient
                AVG(is_proficient) as proficiency_threshold_pct,
                
                -- Aggregate counts
                COUNT(*) as total_subskills,
                COUNT(CASE WHEN readiness_status = 'Ready' THEN 1 END) as ready_subskills,
                SUM(total_attempts) as total_attempts,
                
                -- Timestamps
                MIN(first_attempt) as first_attempt,
                MAX(last_attempt) as last_attempt,
                MAX(calculated_at) as calculated_at
            FROM 
                `mountamo-tutor-h7wnta.analytics.v_student_subskill_mastery`
            GROUP BY 
                student_id, student_name, student_grade,
                subject, unit_id, unit_title, 
                skill_id, skill_description
            """
            
            # 3. Student Unit Mastery View
            unit_mastery_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_unit_mastery` AS
            SELECT 
                student_id,
                student_name,
                student_grade,
                subject,
                unit_id,
                unit_title,
                
                -- Unit mastery = average of all skill masteries within this unit (ALL items)
                AVG(skill_mastery_pct) as unit_mastery_pct,
                
                -- Unit proficiency = average of ready skill proficiencies within this unit (READY items only)
                AVG(skill_proficiency_pct) as unit_proficiency_pct,
                
                -- Completion rate = average completion rate across skills
                AVG(completion_rate_pct) as completion_rate_pct,
                
                -- Proficiency threshold = average proficiency across skills
                AVG(proficiency_threshold_pct) as proficiency_threshold_pct,
                
                -- Aggregate counts
                COUNT(*) as total_skills,
                SUM(total_subskills) as total_subskills,
                SUM(ready_subskills) as ready_subskills,
                SUM(total_attempts) as total_attempts,
                
                -- Timestamps
                MIN(first_attempt) as first_attempt,
                MAX(last_attempt) as last_attempt,
                MAX(calculated_at) as calculated_at
            FROM 
                `mountamo-tutor-h7wnta.analytics.v_student_skill_mastery`
            GROUP BY 
                student_id, student_name, student_grade,
                subject, unit_id, unit_title
            """
            
            # 4. Student Subject Mastery View
            subject_mastery_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_subject_mastery` AS
            SELECT 
                student_id,
                student_name,
                student_grade,
                subject,
                
                -- Subject mastery = average of all unit masteries within this subject (ALL items)
                AVG(unit_mastery_pct) as subject_mastery_pct,
                
                -- Subject proficiency = average of ready unit proficiencies within this subject (READY items only)
                AVG(unit_proficiency_pct) as subject_proficiency_pct,
                
                -- Completion rate = average completion rate across units
                AVG(completion_rate_pct) as completion_rate_pct,
                
                -- Proficiency threshold = average proficiency across units
                AVG(proficiency_threshold_pct) as proficiency_threshold_pct,
                
                -- Aggregate counts
                COUNT(*) as total_units,
                SUM(total_skills) as total_skills,
                SUM(total_subskills) as total_subskills,
                SUM(ready_subskills) as ready_subskills,
                SUM(total_attempts) as total_attempts,
                
                -- Timestamps
                MIN(first_attempt) as first_attempt,
                MAX(last_attempt) as last_attempt,
                MAX(calculated_at) as calculated_at
            FROM 
                `mountamo-tutor-h7wnta.analytics.v_student_unit_mastery`
            GROUP BY 
                student_id, student_name, student_grade, subject
            """
            
            # 5. Overall Student Mastery Summary View
            mastery_summary_view_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_student_mastery_summary` AS
            SELECT 
                student_id,
                student_name,
                student_grade,
                
                -- Overall mastery = average across all subjects (ALL items)
                AVG(subject_mastery_pct) as overall_mastery_pct,
                
                -- Overall proficiency = average across all subjects (READY items only)
                AVG(subject_proficiency_pct) as overall_proficiency_pct,
                
                -- Overall completion rate
                AVG(completion_rate_pct) as overall_completion_rate_pct,
                
                -- Overall proficiency threshold
                AVG(proficiency_threshold_pct) as overall_proficiency_threshold_pct,
                
                -- Aggregate counts
                COUNT(*) as total_subjects,
                SUM(total_units) as total_units,
                SUM(total_skills) as total_skills,
                SUM(total_subskills) as total_subskills,
                SUM(ready_subskills) as ready_subskills,
                SUM(total_attempts) as total_attempts,
                
                -- Timestamps
                MIN(first_attempt) as first_attempt,
                MAX(last_attempt) as last_attempt,
                MAX(calculated_at) as calculated_at
            FROM 
                `mountamo-tutor-h7wnta.analytics.v_student_subject_mastery`
            GROUP BY 
                student_id, student_name, student_grade
            """
            
            # Execute all mastery view creation queries in sequence
            mastery_views = [
                ("Subskill Mastery", subskill_mastery_view_sql),
                ("Skill Mastery", skill_mastery_view_sql),
                ("Unit Mastery", unit_mastery_view_sql),
                ("Subject Mastery", subject_mastery_view_sql),
                ("Overall Mastery Summary", mastery_summary_view_sql)
            ]
            
            for view_name, view_sql in mastery_views:
                await self.etl_service._execute_query(view_sql)
                print(f"✅ {view_name} view created successfully")
            
            self.results['mastery_views'] = {'success': True}
            
        except Exception as e:
            print(f"❌ Failed to create mastery views: {e}")
            self.results['mastery_views'] = {'success': False, 'error': str(e)}
    
    async def create_velocity_tables_and_calculations(self):
        """Create velocity tracking tables and calculate velocity metrics using real curriculum data"""
        print(f"\n🏃 Creating velocity tracking infrastructure...")
        
        try:
            # 1. Create velocity metrics table using actual curriculum data
            velocity_metrics_sql = """
            CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.student_velocity_metrics` AS
            WITH 
            -- Get actual curriculum totals per subject from your real data
            curriculum_totals AS (
                SELECT 
                    subject,
                    COUNT(DISTINCT subskill_id) as total_subskills_in_subject
                FROM `mountamo-tutor-h7wnta.analytics.curriculum`
                WHERE subject IS NOT NULL AND subject != ''
                GROUP BY subject
                HAVING COUNT(DISTINCT subskill_id) > 0
            ),
            
            -- Calculate current date for velocity calculations with dynamic school year
            current_date_info AS (
                SELECT 
                    CURRENT_DATE() as calculation_date,
                    -- Dynamic school year calculation: if before September, use next school year
                    -- If after June, use next school year. Otherwise use current school year.
                    CASE 
                        WHEN EXTRACT(MONTH FROM CURRENT_DATE()) >= 9 THEN 
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()), 9, 1)
                        WHEN EXTRACT(MONTH FROM CURRENT_DATE()) <= 6 THEN
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()) - 1, 9, 1)
                        ELSE -- July-August summer break
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()), 9, 1)
                    END as school_year_start,
                    CASE 
                        WHEN EXTRACT(MONTH FROM CURRENT_DATE()) >= 9 THEN 
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()) + 1, 6, 15)
                        WHEN EXTRACT(MONTH FROM CURRENT_DATE()) <= 6 THEN
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()), 6, 15)
                        ELSE -- July-August summer break
                            DATE(EXTRACT(YEAR FROM CURRENT_DATE()) + 1, 6, 15)
                    END as school_year_end
            ),
            
            -- Calculate expected progress per subject based on days elapsed and actual curriculum size
            expected_progress AS (
                SELECT 
                    ct.subject,
                    ct.total_subskills_in_subject,
                    cdi.calculation_date,
                    cdi.school_year_start,
                    cdi.school_year_end,
                    GREATEST(0, DATE_DIFF(cdi.calculation_date, cdi.school_year_start, DAY)) as days_elapsed,
                    DATE_DIFF(cdi.school_year_end, cdi.school_year_start, DAY) as total_school_days,
                    
                    -- Calculate expected subskills based on actual curriculum size and time elapsed
                    -- Expected progress = (days_elapsed / total_school_days) * total_subskills_in_subject
                    CASE 
                        WHEN DATE_DIFF(cdi.calculation_date, cdi.school_year_start, DAY) <= 0 THEN 0.0
                        WHEN DATE_DIFF(cdi.calculation_date, cdi.school_year_end, DAY) >= 0 THEN CAST(ct.total_subskills_in_subject AS FLOAT64)
                        ELSE (CAST(DATE_DIFF(cdi.calculation_date, cdi.school_year_start, DAY) AS FLOAT64) / 
                              CAST(DATE_DIFF(cdi.school_year_end, cdi.school_year_start, DAY) AS FLOAT64)) * 
                             CAST(ct.total_subskills_in_subject AS FLOAT64)
                    END as expected_subskills_completed
                FROM curriculum_totals ct
                CROSS JOIN current_date_info cdi
            ),
            
            -- Get all students with subjects they have data for (from attempts or all curriculum subjects)
            student_subjects AS (
                -- Students who have attempts - use their attempted subjects
                SELECT DISTINCT
                    sa.student_id,
                    s.name as student_name,
                    sa.subject as subject_preference
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics` sa
                JOIN `mountamo-tutor-h7wnta.analytics.students` s ON sa.student_id = s.student_id
                
                UNION DISTINCT
                
                -- Students who have selected subjects but no attempts yet - use their preferences  
                SELECT DISTINCT
                    s.student_id,
                    s.name as student_name,
                    subject_preference
                FROM `mountamo-tutor-h7wnta.analytics.students` s,
                UNNEST(s.selected_subjects) as subject_preference
                WHERE ARRAY_LENGTH(s.selected_subjects) > 0
                AND s.student_id NOT IN (
                    SELECT DISTINCT student_id 
                    FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
                )
            ),
            
            actual_progress AS (
                SELECT 
                    sa.student_id,
                    sa.student_name,
                    sa.subject,
                    COUNT(DISTINCT CASE WHEN sa.subskill_proficiency >= 0.6 THEN sa.subskill_id END) as completed_subskills,
                    COUNT(DISTINCT sa.subskill_id) as total_available_subskills,
                    AVG(sa.subskill_proficiency) as avg_proficiency,
                    MAX(sa.sync_timestamp) as last_updated
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics` sa
                JOIN student_subjects ss ON sa.student_id = ss.student_id 
                    AND (sa.subject = ss.subject_preference 
                         OR sa.subject = CASE 
                            WHEN ss.subject_preference = 'language-arts' THEN 'Language Arts'
                            WHEN ss.subject_preference = 'social-studies' THEN 'Social Studies'  
                            WHEN ss.subject_preference = 'mathematics' THEN 'Mathematics'
                            WHEN ss.subject_preference = 'science' THEN 'Science'
                            ELSE sa.subject
                         END)
                GROUP BY sa.student_id, sa.student_name, sa.subject
            ),
            
            -- Calculate velocity metrics
            velocity_calculations AS (
                SELECT 
                    ap.student_id,
                    ap.student_name,
                    ap.subject,
                    ap.completed_subskills as actual_progress,
                    ep.expected_subskills_completed as expected_progress,
                    ep.total_subskills_in_subject,
                    
                    -- Core velocity calculation: (Actual / Expected) × 100
                    CASE 
                        WHEN ep.expected_subskills_completed <= 0 THEN 100.0
                        ELSE (CAST(ap.completed_subskills AS FLOAT64) / ep.expected_subskills_completed) * 100.0
                    END as velocity_percentage,
                    
                    -- Days ahead/behind calculation
                    -- If ahead: positive days, if behind: negative days
                    CASE 
                        WHEN ep.expected_subskills_completed <= 0 THEN 0.0
                        ELSE ((CAST(ap.completed_subskills AS FLOAT64) - ep.expected_subskills_completed) / 
                              (CAST(ep.total_subskills_in_subject AS FLOAT64) / CAST(ep.total_school_days AS FLOAT64)))
                    END as days_ahead_behind,
                    
                    ap.total_available_subskills,
                    ap.avg_proficiency,
                    ep.days_elapsed,
                    ep.calculation_date,
                    ap.last_updated,
                    CURRENT_TIMESTAMP() as created_at
                FROM actual_progress ap
                JOIN expected_progress ep ON ap.subject = ep.subject
            )
            
            SELECT 
                student_id,
                student_name,
                subject,
                actual_progress,
                expected_progress,
                total_subskills_in_subject,
                velocity_percentage,
                days_ahead_behind,
                total_available_subskills,
                avg_proficiency,
                days_elapsed,
                
                -- Velocity status categorization (special handling for pre-school period)
                CASE 
                    WHEN days_elapsed <= 0 THEN 'Pre-School Year'  -- Before school starts
                    WHEN velocity_percentage >= 110 THEN 'Significantly Ahead'
                    WHEN velocity_percentage >= 100 THEN 'On Track'
                    WHEN velocity_percentage >= 90 THEN 'Slightly Behind'
                    WHEN velocity_percentage >= 75 THEN 'Behind'
                    ELSE 'Significantly Behind'
                END as velocity_status,
                
                -- Priority level for recommendations (lower velocity = higher priority)
                CASE 
                    WHEN days_elapsed <= 0 THEN 4  -- Low priority during summer
                    WHEN velocity_percentage < 75 THEN 1  -- High priority
                    WHEN velocity_percentage < 90 THEN 2  -- Medium priority
                    WHEN velocity_percentage < 100 THEN 3 -- Low priority
                    ELSE 4 -- Maintenance priority
                END as recommendation_priority,
                
                calculation_date,
                last_updated,
                created_at
            FROM velocity_calculations
            ORDER BY student_id, recommendation_priority, subject
            """
            
            await self.etl_service._execute_query(velocity_metrics_sql)
            print("✅ Velocity metrics table created successfully")
            
            # 2. Create cached available subskills table for fast recommendations
            available_subskills_sql = """
            CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.student_available_subskills` AS
            WITH
            -- Get student subject-level proficiency for difficulty balancing
            student_subject_proficiency AS (
                SELECT 
                    student_id,
                    subject,
                    AVG(subskill_mastery_pct) as avg_subject_proficiency
                FROM `mountamo-tutor-h7wnta.analytics.v_student_subskill_mastery`
                GROUP BY student_id, subject
            ),
            
            -- Find available (unlocked) subskills based on mastery view
            unlocked_subskills AS (
                SELECT DISTINCT
                    sm.student_id,
                    sm.subject,
                    sm.subskill_id,
                    sm.skill_id,
                    sm.unit_id,
                    sm.subskill_description,
                    sm.skill_description,
                    sa.difficulty_start,
                    sa.difficulty_end,
                    sm.readiness_status,
                    sa.priority_level,
                    sm.subskill_mastery_pct,
                    ssp.avg_subject_proficiency,
                    
                    -- A subskill is available if:
                    -- 1. It's ready (prerequisites met)
                    -- 2. Student hasn't mastered it yet (< 60% proficiency)
                    CASE 
                        WHEN sm.readiness_status = 'Ready' AND sm.subskill_mastery_pct < 0.6 THEN TRUE
                        ELSE FALSE
                    END as is_available,
                    
                    -- Calculate unlock score for prioritization within recommendations
                    CASE 
                        WHEN sa.priority_level = 'High Priority' THEN 100
                        WHEN sa.priority_level = 'Medium Priority' THEN 80
                        WHEN sa.priority_level = 'Not Started' THEN 60
                        ELSE 40
                    END + 
                    -- Bonus for difficulty balancing (slightly prefer easier when struggling)
                    CASE 
                        WHEN ssp.avg_subject_proficiency < 0.5 AND sa.difficulty_start <= 2 THEN 15
                        WHEN ssp.avg_subject_proficiency > 0.7 AND sa.difficulty_start >= 4 THEN 10
                        ELSE 0
                    END +
                    -- Bonus for unlocking other subskills (from subskill_paths table)
                    COALESCE(
                        (SELECT COUNT(*) * 5 
                         FROM `mountamo-tutor-h7wnta.analytics.subskill_paths` sp 
                         WHERE sp.current_subskill = sm.subskill_id), 
                        0
                    ) as unlock_score,
                    
                    CURRENT_TIMESTAMP() as cached_at,
                    TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) as expires_at
                FROM `mountamo-tutor-h7wnta.analytics.v_student_subskill_mastery` sm
                JOIN `mountamo-tutor-h7wnta.analytics.student_analytics` sa 
                    ON sm.student_id = sa.student_id AND sm.subskill_id = sa.subskill_id
                JOIN student_subject_proficiency ssp 
                    ON sm.student_id = ssp.student_id AND sm.subject = ssp.subject
                WHERE sm.readiness_status = 'Ready' AND sm.subskill_mastery_pct < 0.6
            )
            
            SELECT * FROM unlocked_subskills
            WHERE is_available = TRUE
            ORDER BY student_id, subject, unlock_score DESC
            """
            
            await self.etl_service._execute_query(available_subskills_sql)
            print("✅ Available subskills cache table created successfully")
            
            # 3. Create student learning profiles for personalized recommendations
            learning_profiles_sql = """
            CREATE OR REPLACE TABLE `mountamo-tutor-h7wnta.analytics.student_learning_profiles` AS
            WITH
            -- Identify struggling skills (low proficiency with multiple attempts)
            struggling_analysis AS (
                SELECT 
                    student_id,
                    subject,
                    ARRAY_AGG(DISTINCT skill_id) as struggling_skill_ids,
                    AVG(subskill_proficiency) as avg_proficiency_in_struggles
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
                WHERE coverage_status = 'Has Attempts' 
                    AND subskill_proficiency < 0.4  -- Struggling threshold
                    AND attempt_count >= 2  -- Has made multiple attempts
                GROUP BY student_id, subject
            ),
            
            -- Identify recently worked skills (last 7 days)
            recent_activity AS (
                SELECT 
                    student_id,
                    subject,
                    ARRAY_AGG(DISTINCT skill_id) as recent_skill_ids,
                    COUNT(DISTINCT skill_id) as recent_skills_count
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
                WHERE last_attempt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
                GROUP BY student_id, subject
            ),
            
            -- Calculate learning preferences based on performance patterns
            learning_preferences AS (
                SELECT 
                    student_id,
                    subject,
                    AVG(CASE WHEN difficulty_start <= 2 THEN subskill_proficiency ELSE NULL END) as easy_performance,
                    AVG(CASE WHEN difficulty_start >= 4 THEN subskill_proficiency ELSE NULL END) as hard_performance,
                    AVG(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE NULL END) as avg_attempts_needed,
                    COUNT(CASE WHEN subskill_proficiency >= 0.6 THEN 1 END) as mastered_count,
                    COUNT(*) as total_subskills,
                    
                    -- Determine learning preference profile
                    CASE 
                        WHEN AVG(CASE WHEN coverage_status = 'Has Attempts' THEN attempt_count ELSE NULL END) <= 1.5 THEN 'Quick Learner'
                        WHEN AVG(CASE WHEN difficulty_start <= 2 THEN subskill_proficiency ELSE NULL END) > 
                             AVG(CASE WHEN difficulty_start >= 4 THEN subskill_proficiency ELSE NULL END) + 0.2 
                        THEN 'Prefers Easier Content'
                        WHEN AVG(CASE WHEN difficulty_start >= 4 THEN subskill_proficiency ELSE NULL END) > 0.7
                        THEN 'Thrives on Challenge'
                        ELSE 'Steady Learner'
                    END as learning_preference,
                    
                    -- Overall proficiency level
                    CASE 
                        WHEN AVG(subskill_proficiency) >= 0.8 THEN 'Advanced'
                        WHEN AVG(subskill_proficiency) >= 0.6 THEN 'Proficient' 
                        WHEN AVG(subskill_proficiency) >= 0.4 THEN 'Developing'
                        ELSE 'Needs Support'
                    END as proficiency_level
                FROM `mountamo-tutor-h7wnta.analytics.student_analytics`
                GROUP BY student_id, subject
            )
            
            SELECT 
                lp.student_id,
                lp.subject,
                COALESCE(sa.struggling_skill_ids, []) as struggling_skills,
                COALESCE(ra.recent_skill_ids, []) as recent_skills,
                lp.learning_preference,
                lp.proficiency_level,
                lp.easy_performance,
                lp.hard_performance,
                lp.avg_attempts_needed,
                lp.mastered_count,
                lp.total_subskills,
                COALESCE(ra.recent_skills_count, 0) as recent_activity_level,
                COALESCE(sa.avg_proficiency_in_struggles, 0.0) as struggle_severity,
                CURRENT_TIMESTAMP() as last_updated,
                TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR) as expires_at
            FROM learning_preferences lp
            LEFT JOIN struggling_analysis sa USING (student_id, subject)
            LEFT JOIN recent_activity ra USING (student_id, subject)
            ORDER BY student_id, subject
            """
            
            await self.etl_service._execute_query(learning_profiles_sql)
            print("✅ Learning profiles table created successfully")
            
            self.results['velocity_infrastructure'] = {'success': True}
            
        except Exception as e:
            print(f"❌ Failed to create velocity infrastructure: {e}")
            self.results['velocity_infrastructure'] = {'success': False, 'error': str(e)}
    
    async def create_velocity_views(self):
        """Create velocity reporting views for dashboards and API consumption"""
        print(f"\n📈 Creating velocity reporting views...")
        
        try:
            # 1. Daily Recommendation View - implements the PM's recommendation algorithm
            daily_recommendations_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_daily_recommendations` AS
            WITH
            -- Get velocity priority order (lowest velocity = highest priority)
            student_velocity_priority AS (
                SELECT 
                    student_id,
                    student_name,
                    subject,
                    velocity_percentage,
                    recommendation_priority,
                    ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY recommendation_priority, velocity_percentage) as priority_rank
                FROM `mountamo-tutor-h7wnta.analytics.student_velocity_metrics`
            ),
            
            -- Allocate 4 daily subskills based on velocity priority (PM's algorithm)
            subject_allocation AS (
                SELECT 
                    student_id,
                    student_name,
                    MAX(CASE WHEN priority_rank = 1 THEN subject END) as highest_priority_subject,
                    MAX(CASE WHEN priority_rank = 2 THEN subject END) as second_priority_subject,
                    MAX(CASE WHEN priority_rank = 3 THEN subject END) as third_priority_subject,
                    
                    -- Allocation: Most behind gets 2, others get 1 each
                    MAX(CASE WHEN priority_rank = 1 THEN 2 ELSE 0 END) as allocation_1,
                    MAX(CASE WHEN priority_rank = 2 THEN 1 ELSE 0 END) as allocation_2,
                    MAX(CASE WHEN priority_rank = 3 THEN 1 ELSE 0 END) as allocation_3
                FROM student_velocity_priority
                GROUP BY student_id, student_name
            ),
            
            -- Get top available subskills per student per subject
            recommended_subskills AS (
                SELECT 
                    sas.student_id,
                    sa.student_name,
                    sas.subject,
                    sas.subskill_id,
                    sas.subskill_description,
                    sas.skill_description,
                    sas.unlock_score,
                    sas.difficulty_start,
                    sas.priority_level,
                    ROW_NUMBER() OVER (
                        PARTITION BY sas.student_id, sas.subject 
                        ORDER BY sas.unlock_score DESC, sas.difficulty_start ASC
                    ) as subskill_rank
                FROM `mountamo-tutor-h7wnta.analytics.student_available_subskills` sas
                JOIN subject_allocation sa ON sas.student_id = sa.student_id
                WHERE sas.expires_at > CURRENT_TIMESTAMP()  -- Only non-expired cache
            )
            
            -- Final recommendations with proper allocation
            SELECT 
                rs.student_id,
                rs.student_name,
                rs.subject,
                rs.subskill_id,
                rs.subskill_description,
                rs.skill_description,
                rs.difficulty_start,
                rs.priority_level,
                rs.unlock_score,
                
                -- Recommendation reason
                CASE 
                    WHEN sa.highest_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_1 THEN 'High Priority - Behind Schedule'
                    WHEN sa.second_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_2 THEN 'Medium Priority - Balancing Progress'
                    WHEN sa.third_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_3 THEN 'Maintenance - Staying Current'
                    ELSE 'Additional Option'
                END as recommendation_reason,
                
                -- Recommendation order (1-4 for daily target)
                CASE 
                    WHEN sa.highest_priority_subject = rs.subject AND rs.subskill_rank = 1 THEN 1
                    WHEN sa.highest_priority_subject = rs.subject AND rs.subskill_rank = 2 THEN 2
                    WHEN sa.second_priority_subject = rs.subject AND rs.subskill_rank = 1 THEN 3
                    WHEN sa.third_priority_subject = rs.subject AND rs.subskill_rank = 1 THEN 4
                    ELSE rs.subskill_rank + 4
                END as recommendation_order,
                
                CURRENT_TIMESTAMP() as generated_at
            FROM recommended_subskills rs
            JOIN subject_allocation sa ON rs.student_id = sa.student_id
            WHERE (
                (sa.highest_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_1) OR
                (sa.second_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_2) OR
                (sa.third_priority_subject = rs.subject AND rs.subskill_rank <= sa.allocation_3)
            )
            ORDER BY rs.student_id, recommendation_order
            """
            
            await self.etl_service._execute_query(daily_recommendations_sql)
            print("✅ Daily recommendations view created successfully")
            
            # 2. Velocity Dashboard View - for reporting and visualization
            velocity_dashboard_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_velocity_dashboard` AS
            WITH
            -- Add student profile context
            velocity_with_profiles AS (
                SELECT 
                    vm.*,
                    slp.learning_preference,
                    slp.proficiency_level,
                    slp.recent_activity_level,
                    slp.struggle_severity
                FROM `mountamo-tutor-h7wnta.analytics.student_velocity_metrics` vm
                LEFT JOIN `mountamo-tutor-h7wnta.analytics.student_learning_profiles` slp 
                    ON vm.student_id = slp.student_id AND vm.subject = slp.subject
                WHERE slp.expires_at > CURRENT_TIMESTAMP() OR slp.expires_at IS NULL
            ),
            
            -- Calculate class/cohort averages for comparison
            cohort_averages AS (
                SELECT 
                    subject,
                    AVG(velocity_percentage) as avg_velocity,
                    AVG(actual_progress) as avg_progress,
                    AVG(days_ahead_behind) as avg_days_deviation,
                    STDDEV(velocity_percentage) as velocity_stddev
                FROM `mountamo-tutor-h7wnta.analytics.student_velocity_metrics`
                GROUP BY subject
            )
            
            SELECT 
                vwp.*,
                ca.avg_velocity as cohort_avg_velocity,
                ca.avg_progress as cohort_avg_progress,
                ca.avg_days_deviation as cohort_avg_days_deviation,
                
                -- Performance relative to cohort
                CASE 
                    WHEN vwp.velocity_percentage > ca.avg_velocity + ca.velocity_stddev THEN 'Above Average'
                    WHEN vwp.velocity_percentage < ca.avg_velocity - ca.velocity_stddev THEN 'Below Average'
                    ELSE 'Average'
                END as cohort_performance,
                
                -- Risk level for intervention
                CASE 
                    WHEN vwp.velocity_percentage < 60 AND vwp.struggle_severity > 0.5 THEN 'High Risk'
                    WHEN vwp.velocity_percentage < 75 AND vwp.recent_activity_level = 0 THEN 'Medium Risk'
                    WHEN vwp.velocity_percentage < 90 THEN 'Low Risk'
                    ELSE 'On Track'
                END as intervention_risk
            FROM velocity_with_profiles vwp
            JOIN cohort_averages ca ON vwp.subject = ca.subject
            ORDER BY vwp.student_id, vwp.recommendation_priority, vwp.subject
            """
            
            await self.etl_service._execute_query(velocity_dashboard_sql)
            print("✅ Velocity dashboard view created successfully")
            
            # 3. Quick velocity summary for API endpoints
            velocity_summary_sql = """
            CREATE OR REPLACE VIEW `mountamo-tutor-h7wnta.analytics.v_velocity_summary` AS
            SELECT 
                student_id,
                student_name,
                
                -- Overall velocity across all subjects
                AVG(velocity_percentage) as overall_velocity,
                AVG(days_ahead_behind) as avg_days_ahead_behind,
                
                -- Subject breakdown
                STRING_AGG(
                    CONCAT(subject, ': ', ROUND(velocity_percentage, 1), '%'), 
                    ', ' ORDER BY recommendation_priority
                ) as subject_velocities,
                
                -- Status summary
                CASE 
                    WHEN AVG(velocity_percentage) >= 100 THEN 'On Track'
                    WHEN AVG(velocity_percentage) >= 85 THEN 'Slightly Behind'
                    WHEN AVG(velocity_percentage) >= 70 THEN 'Behind'
                    ELSE 'Significantly Behind'
                END as overall_status,
                
                -- Highest priority subject (most behind)
                STRING_AGG(
                    CASE WHEN recommendation_priority = 1 THEN subject END, 
                    '' ORDER BY recommendation_priority
                ) as priority_subject,
                
                MAX(calculation_date) as last_calculated
            FROM `mountamo-tutor-h7wnta.analytics.student_velocity_metrics`
            GROUP BY student_id, student_name
            ORDER BY student_id
            """
            
            await self.etl_service._execute_query(velocity_summary_sql)
            print("✅ Velocity summary view created successfully")
            
            self.results['velocity_views'] = {'success': True}
            
        except Exception as e:
            print(f"❌ Failed to create velocity views: {e}")
            self.results['velocity_views'] = {'success': False, 'error': str(e)}
    
    async def get_final_status(self):
        """Get final sync status"""
        print(f"\n📊 Getting final data status...")
        
        try:
            status_results = await self.etl_service.get_sync_status()
            
            print("Final data status:")
            for table, status in status_results.get("tables", {}).items():
                if status.get("exists"):
                    row_count = status.get('row_count', 0)
                    table_size = status.get('table_size_mb', 0)
                    print(f"  📊 {table.title()}: {row_count:,} rows, {table_size:.2f} MB")
                else:
                    print(f"  ❌ {table.title()}: {status.get('error', 'Unknown error')}")
            
            # Also check the new student_analytics table
            try:
                analytics_query = "SELECT COUNT(*) as total_rows FROM `mountamo-tutor-h7wnta.analytics.student_analytics`"
                analytics_result = await self.etl_service._execute_query(analytics_query, return_results=True)
                if analytics_result:
                    analytics_count = analytics_result[0]['total_rows']
                    print(f"  📊 Student Analytics: {analytics_count:,} rows")
            except Exception as e:
                print(f"  ⚠️  Could not get student analytics count: {e}")
            
            self.results['final_status'] = status_results
            
        except Exception as e:
            print(f"❌ Final status check failed: {e}")
            self.results['final_status'] = {'success': False, 'error': str(e)}
    
    def print_summary(self):
        """Print load summary"""
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        print("\n" + "="*80)
        print("🎯 ETL FULL DATA LOAD SUMMARY")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {duration}")
        print("-"*80)
        
        total_records = 0
        
        for component, result in self.results.items():
            if component in ['validation', 'final_status']:
                continue
                
            if isinstance(result, dict):
                records_processed = result.get('records_processed', 0)
                success = result.get('success', False)
                skipped = result.get('skipped', False)
                
                if skipped:
                    status = "⚠️  SKIPPED"
                    reason = result.get('reason', 'Unknown reason')
                    print(f"{status} {component.title()}: {reason}")
                elif success:
                    status = "✅ SUCCESS"
                    total_records += records_processed
                    print(f"{status} {component.title()}: {records_processed:,} records")
                else:
                    status = "❌ FAILED"
                    error = result.get('error', 'Unknown error')
                    print(f"{status} {component.title()}: {error}")
        
        print("-"*80)
        print(f"Total Records Loaded: {total_records:,}")
        
        # Check overall success
        successful_loads = sum(1 for result in self.results.values() 
                             if isinstance(result, dict) and 
                             (result.get('success', False) or result.get('skipped', False)))
        
        total_loads = len([r for r in self.results.values() 
                          if isinstance(r, dict) and 
                          r.get('success') is not None])
        
        if successful_loads == total_loads:
            print("🎉 Full data load completed successfully!")
        else:
            print(f"🟡 Partial success: {successful_loads}/{total_loads} components loaded")
        
        print("="*80)
    
    async def run_full_load(self, incremental: bool = False):
        """Run the complete full data load"""
        self.start_time = datetime.now()
        
        try:
            print("🚀 Starting Full ETL Data Load")
            print("="*80)
            print(f"Mode: {'Incremental' if incremental else 'Full Load'}")
            print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*80)
            
            # Setup
            await self.setup()
            
            # Ensure tables exist
            await self.ensure_tables_exist()
            
            # Force clean reload of contaminated tables
            await self.clean_reload_contaminated_tables()
            
            # Load all data sources
            await self.load_user_profiles_data(incremental=incremental)
            await self.load_attempts_data(incremental=incremental)
            await self.load_reviews_data(incremental=incremental)

            # Refresh curriculum views from analytics.curriculum_* tables
            # This replaces load_curriculum_data() and load_learning_paths_data()
            await self.refresh_curriculum_views()

            # Validate loaded data
            await self.validate_loaded_data()
            
            # Create student analytics table and views
            await self.create_student_analytics_table()
            await self.create_analytics_views()
            await self.create_mastery_views()
            
            # Create velocity tracking infrastructure
            await self.create_velocity_tables_and_calculations()
            await self.create_velocity_views()
            
            # Get final status
            await self.get_final_status()
            
            # Print summary
            self.print_summary()
            
        except Exception as e:
            print(f"\n❌ Full load failed: {e}")
            import traceback
            traceback.print_exc()


async def run_cosmos_preview():
    """Preview Cosmos DB data before loading"""
    print("🔍 Cosmos DB Data Preview")
    print("-" * 50)
    
    if not setup_credentials():
        print("❌ Credentials setup failed")
        return
    
    try:
        from app.db.cosmos_db import CosmosDBService
        
        cosmos_service = CosmosDBService()
        print("✅ Cosmos DB service initialized")
        
        # Count attempts
        attempts_count_query = "SELECT VALUE COUNT(1) FROM c"
        attempts_count = list(cosmos_service.attempts.query_items(
            query=attempts_count_query,
            enable_cross_partition_query=True
        ))[0]
        
        print(f"📊 Total attempts in Cosmos DB: {attempts_count:,}")
        
        # Count reviews
        try:
            reviews_count = list(cosmos_service.reviews.query_items(
                query=attempts_count_query,
                enable_cross_partition_query=True
            ))[0]
            print(f"📝 Total reviews in Cosmos DB: {reviews_count:,}")
        except Exception as e:
            print(f"⚠️  Could not count reviews: {e}")
        
        # Show sample data
        sample_query = "SELECT TOP 3 * FROM c"
        sample_attempts = list(cosmos_service.attempts.query_items(
            query=sample_query,
            enable_cross_partition_query=True
        ))
        
        if sample_attempts:
            print(f"\n📋 Sample attempt fields:")
            for field in sorted(sample_attempts[0].keys()):
                print(f"  - {field}")
        
    except Exception as e:
        print(f"❌ Cosmos preview failed: {e}")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Full ETL Data Load Script')
    parser.add_argument('--incremental', action='store_true', 
                       help='Run incremental load instead of full load')
    parser.add_argument('--preview', action='store_true', 
                       help='Preview Cosmos DB data before loading')
    parser.add_argument('--batch-size', type=int, default=1000,
                       help='Batch size for data processing (default: 1000)')
    
    args = parser.parse_args()
    
    if args.preview:
        asyncio.run(run_cosmos_preview())
    else:
        # Run full data load
        loader = FullETLLoader(batch_size=args.batch_size)
        asyncio.run(loader.run_full_load(incremental=args.incremental))


if __name__ == "__main__":
    main()