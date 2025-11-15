# services/bigquery_etl.py

import asyncio
import logging
import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from google.cloud import bigquery
from google.cloud.exceptions import NotFound, Conflict
from google.api_core.exceptions import GoogleAPIError
import pandas as pd
from io import BytesIO

# Import your existing services
from app.db.cosmos_db import CosmosDBService
from app.services.curriculum_service import CurriculumService
from app.services.learning_paths import LearningPathsService
from app.core.config import settings

logger = logging.getLogger(__name__)

class BigQueryETLService:
    """Enhanced ETL service for syncing data from Cosmos DB and Blob Storage to BigQuery"""
    
    def __init__(self, project_id: Optional[str] = None, dataset_id: Optional[str] = None):
        # Use settings if not provided
        self.project_id = project_id or settings.GCP_PROJECT_ID
        self.dataset_id = dataset_id or settings.BIGQUERY_DATASET_ID
        
        # Setup credentials if needed
        self._setup_credentials()
        
        # Initialize BigQuery client
        try:
            self.client = bigquery.Client(project=self.project_id)
            logger.info(f"BigQuery client initialized for project: {self.project_id}")
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery client: {e}")
            raise
        
        # Initialize source services
        self.cosmos_db = None
        self.curriculum_service = None
        self.learning_paths_service = None
        
        # ETL configuration from settings
        self.batch_size = getattr(settings, 'ETL_BATCH_SIZE', 1000)
        self.max_retries = getattr(settings, 'ETL_MAX_RETRIES', 3)
        
        # Initialize dataset
        asyncio.create_task(self._ensure_dataset_exists()) if asyncio.get_event_loop().is_running() else None
    
    def _setup_credentials(self):
        """Setup Google Cloud credentials with proper path resolution"""
        credentials_path = settings.GOOGLE_APPLICATION_CREDENTIALS
        
        if credentials_path and not os.path.isabs(credentials_path):
            # If relative path, make it relative to the project root
            backend_dir = Path(__file__).parent.parent.parent  # Go up from services/ to project root
            full_credentials_path = backend_dir / credentials_path
            
            if full_credentials_path.exists():
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(full_credentials_path)
                logger.info(f"Set credentials path to: {full_credentials_path}")
            else:
                logger.warning(f"Credentials file not found at: {full_credentials_path}")
    
    async def _ensure_dataset_exists(self):
        """Ensure the BigQuery dataset exists"""
        try:
            dataset_ref = bigquery.DatasetReference(self.project_id, self.dataset_id)
            
            try:
                self.client.get_dataset(dataset_ref)
                logger.info(f"Dataset {self.dataset_id} already exists")
            except NotFound:
                # Create dataset
                dataset = bigquery.Dataset(dataset_ref)
                dataset.location = "US"  # or your preferred location
                dataset = self.client.create_dataset(dataset)
                logger.info(f"Created dataset {self.dataset_id}")
                
        except Exception as e:
            logger.error(f"Error ensuring dataset exists: {e}")
    
    def _initialize_cosmos_service(self):
        """Lazy initialization of Cosmos DB service"""
        if not self.cosmos_db:
            try:
                self.cosmos_db = CosmosDBService()
                logger.info("Cosmos DB service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Cosmos DB service: {e}")
                raise
        return self.cosmos_db
    
    def set_curriculum_service(self, curriculum_service: CurriculumService):
        """Inject curriculum service"""
        self.curriculum_service = curriculum_service
        logger.info("Curriculum service set")
    
    def set_learning_paths_service(self, learning_paths_service: LearningPathsService):
        """Inject learning paths service"""
        self.learning_paths_service = learning_paths_service
        logger.info("Learning paths service set")

    async def test_connections(self) -> Dict[str, Any]:
        """Test all connections before running ETL"""
        results = {
            "bigquery": False,
            "cosmos_db": False,
            "curriculum_service": False,
            "learning_paths_service": False,
            "errors": []
        }
        
        # Test BigQuery
        try:
            test_query = "SELECT 1 as test_value"
            job = self.client.query(test_query)
            list(job.result())  # Execute query
            results["bigquery"] = True
            logger.info("✅ BigQuery connection successful")
        except Exception as e:
            results["errors"].append(f"BigQuery error: {e}")
            logger.error(f"❌ BigQuery connection failed: {e}")
        
        # Test Cosmos DB
        try:
            cosmos_db = self._initialize_cosmos_service()
            # Test with a simple query
            test_query = "SELECT TOP 1 * FROM c"
            attempts_test = list(cosmos_db.attempts.query_items(
                query=test_query,
                enable_cross_partition_query=True
            ))
            results["cosmos_db"] = True
            logger.info(f"✅ Cosmos DB connection successful (found {len(attempts_test)} test records)")
        except Exception as e:
            results["errors"].append(f"Cosmos DB error: {e}")
            logger.error(f"❌ Cosmos DB connection failed: {e}")
        
        # Test curriculum service if available
        if self.curriculum_service:
            try:
                subjects = await self.curriculum_service.get_available_subjects()
                results["curriculum_service"] = True
                logger.info(f"✅ Curriculum service successful ({len(subjects)} subjects)")
            except Exception as e:
                results["errors"].append(f"Curriculum service error: {e}")
                logger.error(f"❌ Curriculum service failed: {e}")
        
        # Test learning paths service if available
        if self.learning_paths_service:
            try:
                paths = await self.learning_paths_service.get_learning_paths()
                results["learning_paths_service"] = True
                logger.info(f"✅ Learning paths service successful ({len(paths)} paths)")
            except Exception as e:
                results["errors"].append(f"Learning paths service error: {e}")
                logger.error(f"❌ Learning paths service failed: {e}")
        
        return results

    async def sync_attempts_from_cosmos(self, incremental: bool = True, limit: Optional[int] = None) -> Dict[str, Any]:
        """Sync attempts data from Cosmos DB to BigQuery"""
        
        try:
            logger.info("Starting attempts sync from Cosmos DB")
            
            # Initialize Cosmos DB service
            cosmos_db = self._initialize_cosmos_service()
            
            # Fetch all data from Cosmos DB (ignore incremental for limited datasets)
            attempts = await self._fetch_attempts_from_cosmos(cosmos_db, None, limit)
            
            if not attempts:
                logger.info("No attempts found in Cosmos DB")
                return {"success": True, "records_processed": 0, "message": "No data"}
            
            logger.info(f"Fetched {len(attempts)} attempts from Cosmos DB")
            
            # Transform data for BigQuery
            transformed_attempts = self._transform_attempts_data(attempts)
            
            if not transformed_attempts:
                logger.warning("No valid attempts after transformation")
                return {"success": True, "records_processed": 0, "message": "No valid data after transformation"}
            
            # Ensure table exists
            await self._ensure_table_exists("attempts", self._get_attempts_schema())
            
            # Load to BigQuery using MERGE to handle duplicates
            table_id = f"{self.project_id}.{self.dataset_id}.attempts"
            total_loaded = await self._load_data_to_bigquery(transformed_attempts, table_id, "attempts")
            
            logger.info(f"Successfully synced {total_loaded} attempts to BigQuery")
            
            return {
                "success": True,
                "records_processed": total_loaded,
                "table": table_id,
                "sync_type": "incremental" if incremental else "full"
            }
            
        except Exception as e:
            logger.error(f"Error syncing attempts: {e}")
            return {
                "success": False,
                "error": str(e),
                "records_processed": 0
            }

    async def sync_reviews_from_cosmos(self, incremental: bool = True, limit: Optional[int] = None) -> Dict[str, Any]:
        """Sync reviews data from Cosmos DB to BigQuery"""
        
        try:
            logger.info("Starting reviews sync from Cosmos DB")
            
            cosmos_db = self._initialize_cosmos_service()
            
            # Fetch all reviews from Cosmos DB
            reviews = await self._fetch_reviews_from_cosmos(cosmos_db, None, limit)
            
            if not reviews:
                logger.info("No reviews found in Cosmos DB")
                return {"success": True, "records_processed": 0, "message": "No data"}
            
            logger.info(f"Fetched {len(reviews)} reviews from Cosmos DB")
            
            # Transform data
            transformed_reviews = self._transform_reviews_data(reviews)
            
            if not transformed_reviews:
                logger.warning("No valid reviews after transformation")
                return {"success": True, "records_processed": 0, "message": "No valid data after transformation"}
            
            # Ensure table exists
            await self._ensure_table_exists("reviews", self._get_reviews_schema())
            
            # Load to BigQuery - reviews don't have MERGE logic yet, so use simple append
            table_id = f"{self.project_id}.{self.dataset_id}.reviews"
            total_loaded = await self._load_data_to_bigquery(transformed_reviews, table_id, "reviews")
            
            logger.info(f"Successfully synced {total_loaded} reviews to BigQuery")
            
            return {
                "success": True,
                "records_processed": total_loaded,
                "table": table_id
            }
            
        except Exception as e:
            logger.error(f"Error syncing reviews: {e}")
            return {"success": False, "error": str(e)}

    async def sync_user_profiles_from_cosmos(self, incremental: bool = True, limit: Optional[int] = None) -> Dict[str, Any]:
        """Sync user profiles data from Cosmos DB to BigQuery to create proper students table"""
        
        try:
            logger.info("Starting user profiles sync from Cosmos DB")
            
            # Initialize Cosmos DB connection
            if not self.cosmos_db:
                self._initialize_cosmos_service()
            
            # Determine since parameter for incremental sync
            since = None
            if incremental:
                # Get last sync timestamp from BigQuery
                try:
                    last_sync_query = f"""
                    SELECT MAX(sync_timestamp) as last_sync 
                    FROM `{self.project_id}.{self.dataset_id}.students`
                    WHERE sync_timestamp IS NOT NULL
                    """
                    result = list(self.client.query(last_sync_query))
                    if result and result[0]['last_sync']:
                        since = result[0]['last_sync']
                        logger.info(f"Incremental sync since: {since}")
                except Exception:
                    logger.info("No previous sync found, doing full sync")
            
            # Fetch user profiles data
            profiles = await self._fetch_user_profiles_from_cosmos(self.cosmos_db, since=since, limit=limit)
            
            if not profiles:
                logger.info("No user profiles to sync")
                return {"success": True, "records_processed": 0}
            
            # Transform data for BigQuery
            transformed_data = self._transform_user_profiles_data(profiles)
            
            # Load to BigQuery
            records_loaded = await self._load_data_to_bigquery(
                transformed_data, 
                f"{self.project_id}.{self.dataset_id}.students",
                "students"
            )
            
            logger.info(f"Successfully synced {records_loaded} user profiles")
            
            return {
                "success": True,
                "records_processed": records_loaded,
                "sync_type": "incremental" if incremental else "full"
            }
            
        except Exception as e:
            logger.error(f"Error syncing user profiles: {e}")
            return {"success": False, "error": str(e)}

    async def sync_assessments_from_cosmos(self, incremental: bool = True, limit: Optional[int] = None) -> Dict[str, Any]:
        """Sync assessment data from Cosmos DB to BigQuery"""

        try:
            logger.info("Starting assessments sync from Cosmos DB")

            # Initialize Cosmos DB service
            cosmos_db = self._initialize_cosmos_service()

            # Fetch assessments from Cosmos DB
            assessments = await self._fetch_assessments_from_cosmos(cosmos_db, None, limit)

            if not assessments:
                logger.info("No assessments found in Cosmos DB")
                return {"success": True, "records_processed": 0, "message": "No data"}

            logger.info(f"Fetched {len(assessments)} assessments from Cosmos DB")

            # Process each assessment table separately
            results = {}

            # 1. Main assessments table
            transformed_assessments = self._transform_assessment_data(assessments)
            if transformed_assessments:
                await self._ensure_table_exists("assessments", self._get_assessments_schema())
                table_id = f"{self.project_id}.{self.dataset_id}.assessments"
                loaded = await self._load_data_to_bigquery(transformed_assessments, table_id, "assessments")
                results["assessments"] = {"success": True, "records": loaded}
                logger.info(f"Loaded {loaded} assessments to BigQuery")
            else:
                results["assessments"] = {"success": True, "records": 0, "message": "No completed assessments"}

            # 2. Assessment subskill attempts
            subskill_attempts = self._extract_subskill_attempts(assessments)
            if subskill_attempts:
                await self._ensure_table_exists("assessment_subskill_attempts", self._get_assessment_subskill_attempts_schema())
                table_id = f"{self.project_id}.{self.dataset_id}.assessment_subskill_attempts"
                loaded = await self._load_data_to_bigquery(subskill_attempts, table_id, "assessment_subskill_attempts")
                results["subskill_attempts"] = {"success": True, "records": loaded}
                logger.info(f"Loaded {loaded} subskill attempts to BigQuery")
            else:
                results["subskill_attempts"] = {"success": True, "records": 0}

            # 3. Assessment problem reviews
            problem_reviews = self._extract_problem_reviews(assessments)
            if problem_reviews:
                await self._ensure_table_exists("assessment_problem_reviews", self._get_assessment_problem_reviews_schema())
                table_id = f"{self.project_id}.{self.dataset_id}.assessment_problem_reviews"
                loaded = await self._load_data_to_bigquery(problem_reviews, table_id, "assessment_problem_reviews")
                results["problem_reviews"] = {"success": True, "records": loaded}
                logger.info(f"Loaded {loaded} problem reviews to BigQuery")
            else:
                results["problem_reviews"] = {"success": True, "records": 0}

            # 4. Assessment skill insights
            skill_insights = self._extract_skill_insights(assessments)
            if skill_insights:
                await self._ensure_table_exists("assessment_skill_insights", self._get_assessment_skill_insights_schema())
                table_id = f"{self.project_id}.{self.dataset_id}.assessment_skill_insights"
                loaded = await self._load_data_to_bigquery(skill_insights, table_id, "assessment_skill_insights")
                results["skill_insights"] = {"success": True, "records": loaded}
                logger.info(f"Loaded {loaded} skill insights to BigQuery")
            else:
                results["skill_insights"] = {"success": True, "records": 0}

            # Calculate total records
            total_records = sum(r.get("records", 0) for r in results.values())

            logger.info(f"Successfully synced {total_records} total assessment records to BigQuery")

            return {
                "success": True,
                "records_processed": total_records,
                "sync_type": "incremental" if incremental else "full",
                "details": results
            }

        except Exception as e:
            logger.error(f"Error syncing assessments: {e}")
            return {
                "success": False,
                "error": str(e),
                "records_processed": 0
            }

    async def _fetch_assessments_from_cosmos(self, cosmos_db: CosmosDBService, since: Optional[datetime] = None, limit: Optional[int] = None) -> List[Dict]:
        """Fetch assessment data from Cosmos DB"""

        try:
            # Try to access assessments container
            if hasattr(cosmos_db, 'assessments'):
                assessments_container = cosmos_db.assessments
            else:
                # Fallback to manual container access
                database = cosmos_db.client.get_database_client(cosmos_db.database_id)
                assessments_container = database.get_container_client('assessments')

            if since:
                query = """
                SELECT * FROM c
                WHERE c.document_type = 'assessment'
                AND c._ts > @since_timestamp
                ORDER BY c._ts
                """
                parameters = [{"name": "@since_timestamp", "value": int(since.timestamp())}]
            else:
                query = """
                SELECT * FROM c
                WHERE c.document_type = 'assessment'
                ORDER BY c._ts
                """
                parameters = []

            # Add limit if specified
            if limit:
                query = query.replace("SELECT *", f"SELECT TOP {limit} *")

            assessments = []
            try:
                async for item in assessments_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    assessments.append(item)
            except Exception as query_error:
                # Fallback to synchronous iteration
                logger.warning(f"Async iteration failed, falling back to sync: {query_error}")
                for item in assessments_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    assessments.append(item)

            return assessments

        except Exception as e:
            logger.error(f"Error fetching assessments from Cosmos DB: {e}")
            raise

    async def sync_curriculum_from_blob(self, subject: Optional[str] = None) -> Dict[str, Any]:
        """Sync curriculum data from blob storage to BigQuery"""

        try:
            logger.info(f"Starting curriculum sync for subject: {subject or 'all'}")
            
            if not self.curriculum_service:
                raise ValueError("Curriculum service not configured")
            
            # Get available subjects
            if subject:
                subjects = [subject]
            else:
                subjects = await self.curriculum_service.get_available_subjects()
            
            total_loaded = 0
            
            # Ensure table exists
            await self._ensure_table_exists("curriculum", self._get_curriculum_schema())
            
            for subj in subjects:
                logger.info(f"Syncing curriculum for {subj}")
                
                # Download curriculum data from blob storage
                curriculum_df = await self.curriculum_service.download_curriculum_csv(subj, "syllabus")
                
                if curriculum_df is None or curriculum_df.empty:
                    logger.warning(f"No curriculum data found for {subj}")
                    continue
                
                # Transform to BigQuery format
                curriculum_records = self._transform_curriculum_data(curriculum_df, subj)
                
                if curriculum_records:
                    # Replace existing data for this subject (upsert)
                    await self._upsert_curriculum_data(curriculum_records, subj)
                    
                    total_loaded += len(curriculum_records)
                    logger.info(f"Loaded {len(curriculum_records)} curriculum items for {subj}")
            
            return {
                "success": True,
                "records_processed": total_loaded,
                "subjects": subjects
            }
            
        except Exception as e:
            logger.error(f"Error syncing curriculum: {e}")
            return {"success": False, "error": str(e)}

    async def sync_learning_paths_from_blob(self) -> Dict[str, Any]:
        """Sync learning paths data from blob storage to BigQuery"""
        
        try:
            logger.info("Starting learning paths sync")
            
            if not self.learning_paths_service:
                raise ValueError("Learning paths service not configured")
            
            # Get learning paths data
            learning_paths = await self.learning_paths_service.get_learning_paths()
            
            if not learning_paths:
                logger.warning("No learning paths data found")
                return {"success": True, "records_processed": 0, "message": "No data"}
            
            # Transform to BigQuery format
            paths_records = self._transform_learning_paths_data(learning_paths)
            
            if not paths_records:
                logger.warning("No valid learning paths after transformation")
                return {"success": True, "records_processed": 0, "message": "No valid data after transformation"}
            
            # Ensure table exists
            await self._ensure_table_exists("learning_paths", self._get_learning_paths_schema())
            
            # Replace all learning paths data
            table_id = f"{self.project_id}.{self.dataset_id}.learning_paths"
            
            # Delete existing data and reload
            delete_query = f"DELETE FROM `{table_id}` WHERE TRUE"
            delete_job = self.client.query(delete_query)
            delete_job.result()
            
            # Load new data
            total_loaded = await self._load_data_to_bigquery(paths_records, table_id, "learning_paths")
            
            logger.info(f"Loaded {total_loaded} learning paths")
            
            return {
                "success": True,
                "records_processed": total_loaded,
                "table": table_id
            }
            
        except Exception as e:
            logger.error(f"Error syncing learning paths: {e}")
            return {"success": False, "error": str(e)}

    async def run_full_sync(self, test_mode: bool = False) -> Dict[str, Any]:
        """Run complete ETL sync of all data sources"""
        
        logger.info(f"Starting full ETL sync (test_mode: {test_mode})")
        results = {}
        
        try:
            # Test connections first
            connection_test = await self.test_connections()
            results["connection_test"] = connection_test
            
            if not connection_test["bigquery"]:
                raise Exception("BigQuery connection failed - cannot proceed")
            
            if not connection_test["cosmos_db"]:
                raise Exception("Cosmos DB connection failed - cannot proceed")
            
            # In test mode, limit records
            limit = 10 if test_mode else None
            
            # Sync curriculum first (needed for validation)
            if self.curriculum_service:
                results["curriculum"] = await self.sync_curriculum_from_blob()
            else:
                results["curriculum"] = {"success": False, "error": "Curriculum service not available"}
            
            # Sync learning paths
            if self.learning_paths_service:
                results["learning_paths"] = await self.sync_learning_paths_from_blob()
            else:
                results["learning_paths"] = {"success": False, "error": "Learning paths service not available"}
            
            # Sync attempts (full)
            results["attempts"] = await self.sync_attempts_from_cosmos(incremental=False, limit=limit)
            
            # Sync reviews (full)
            results["reviews"] = await self.sync_reviews_from_cosmos(incremental=False, limit=limit)

            # Sync assessments (full)
            results["assessments"] = await self.sync_assessments_from_cosmos(incremental=False, limit=limit)

            # Calculate totals
            total_records = sum(
                result.get("records_processed", 0) 
                for result in results.values()
                if isinstance(result, dict)
            )
            
            success_count = sum(
                1 for result in results.values() 
                if isinstance(result, dict) and result.get("success", False)
            )
            
            logger.info(f"Full sync completed: {success_count}/{len(results)-1} successful, {total_records} total records")
            
            return {
                "success": success_count >= 2,  # At least attempts and reviews should succeed
                "total_records_processed": total_records,
                "results": results,
                "timestamp": datetime.now().isoformat(),
                "test_mode": test_mode
            }
            
        except Exception as e:
            logger.error(f"Error in full sync: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": results
            }

    async def _fetch_attempts_from_cosmos(self, cosmos_db: CosmosDBService, since: Optional[datetime] = None, limit: Optional[int] = None) -> List[Dict]:
        """Fetch attempts data from Cosmos DB"""
        
        try:
            if since:
                # Incremental query
                query = """
                SELECT * FROM c 
                WHERE c._ts > @since_timestamp
                ORDER BY c._ts
                """
                parameters = [{"name": "@since_timestamp", "value": int(since.timestamp())}]
            else:
                # Full query
                query = "SELECT * FROM c ORDER BY c._ts"
                parameters = []
            
            # Add limit if specified
            if limit:
                query = query.replace("SELECT *", f"SELECT TOP {limit} *")
            
            attempts = []
            try:
                async for item in cosmos_db.attempts.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    attempts.append(item)
            except Exception as query_error:
                # Fallback to synchronous iteration
                logger.warning(f"Async iteration failed, falling back to sync: {query_error}")
                for item in cosmos_db.attempts.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    attempts.append(item)
            
            return attempts
            
        except Exception as e:
            logger.error(f"Error fetching attempts from Cosmos DB: {e}")
            raise

    async def _fetch_reviews_from_cosmos(self, cosmos_db: CosmosDBService, since: Optional[datetime] = None, limit: Optional[int] = None) -> List[Dict]:
        """Fetch reviews data from Cosmos DB"""
        
        try:
            # Try to access reviews container
            if hasattr(cosmos_db, 'reviews'):
                reviews_container = cosmos_db.reviews
            else:
                # Fallback to manual container access
                database = cosmos_db.client.get_database_client(cosmos_db.database_id)
                reviews_container = database.get_container_client('reviews')
            
            if since:
                query = """
                SELECT * FROM c 
                WHERE c._ts > @since_timestamp
                ORDER BY c._ts
                """
                parameters = [{"name": "@since_timestamp", "value": int(since.timestamp())}]
            else:
                query = "SELECT * FROM c ORDER BY c._ts"
                parameters = []
            
            # Add limit if specified
            if limit:
                query = query.replace("SELECT *", f"SELECT TOP {limit} *")
            
            reviews = []
            try:
                async for item in reviews_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    reviews.append(item)
            except Exception as query_error:
                # Fallback to synchronous iteration
                logger.warning(f"Async iteration failed, falling back to sync: {query_error}")
                for item in reviews_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    reviews.append(item)
            
            return reviews
            
        except Exception as e:
            logger.error(f"Error fetching reviews from Cosmos DB: {e}")
            raise

    async def _fetch_user_profiles_from_cosmos(self, cosmos_db: CosmosDBService, since: Optional[datetime] = None, limit: Optional[int] = None) -> List[Dict]:
        """Fetch user profiles from Cosmos DB user_profiles container"""
        
        try:
            logger.info("Fetching user profiles from Cosmos DB")
            
            # Get the user_profiles container
            user_profiles_container = cosmos_db.database.get_container_client("user_profiles")
            
            # Build query
            query = "SELECT * FROM c WHERE c.type = 'user_profile'"
            parameters = []
            
            if since:
                query += " AND c.updated_at > @since"
                parameters.append({"name": "@since", "value": since.isoformat()})
            
            if limit:
                query += f" ORDER BY c.updated_at DESC OFFSET 0 LIMIT {limit}"
            else:
                query += " ORDER BY c.updated_at DESC"
            
            profiles = []
            
            try:
                # Try async iteration first
                items = user_profiles_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                )
                async for item in items:
                    profiles.append(item)
            except Exception as query_error:
                logger.warning(f"Async iteration failed, falling back to sync: {query_error}")
                for item in user_profiles_container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                ):
                    profiles.append(item)
            
            return profiles
            
        except Exception as e:
            logger.error(f"Error fetching user profiles from Cosmos DB: {e}")
            raise

    def _transform_attempts_data(self, attempts: List[Dict]) -> List[Dict]:
        """Transform attempts data for BigQuery"""
        
        transformed = []
        
        for attempt in attempts:
            try:
                # Validate required fields
                required_fields = ['student_id', 'subject', 'skill_id', 'subskill_id']
                if not all(k in attempt for k in required_fields):
                    logger.warning(f"Skipping attempt with missing fields: {attempt.get('id', 'unknown')}")
                    continue
                
                # Convert score to float
                score = attempt.get('score', 0)
                if isinstance(score, str):
                    try:
                        score = float(score)
                    except ValueError:
                        score = 0.0
                elif score is None:
                    score = 0.0
                
                # Parse timestamp
                timestamp_str = attempt.get('timestamp')
                if isinstance(timestamp_str, str):
                    try:
                        # Handle different timestamp formats
                        if timestamp_str.endswith('Z'):
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            timestamp = datetime.fromisoformat(timestamp_str)
                    except ValueError:
                        timestamp = datetime.now()
                elif timestamp_str is None:
                    timestamp = datetime.now()
                else:
                    timestamp = timestamp_str
                
                # Convert student_id to int safely
                try:
                    student_id = int(attempt['student_id'])
                except (ValueError, TypeError):
                    logger.warning(f"Invalid student_id in attempt: {attempt.get('id', 'unknown')}")
                    continue
                
                transformed_record = {
                    'student_id': student_id,
                    'subject': str(attempt['subject']),
                    'skill_id': str(attempt['skill_id']),
                    'subskill_id': str(attempt['subskill_id']),
                    'score': float(score),
                    'timestamp': timestamp.isoformat(),
                    'sync_timestamp': datetime.now().isoformat(),
                    'cosmos_id': attempt.get('id', ''),
                    'cosmos_ts': attempt.get('_ts', 0)
                }
                
                transformed.append(transformed_record)
                
            except Exception as e:
                logger.error(f"Error transforming attempt {attempt.get('id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Transformed {len(transformed)}/{len(attempts)} attempts successfully")
        return transformed

    def _transform_reviews_data(self, reviews: List[Dict]) -> List[Dict]:
        """Transform reviews data for BigQuery"""
        
        transformed = []
        
        for review in reviews:
            try:
                # Validate required fields
                required_fields = ['id', 'student_id', 'subject', 'skill_id', 'subskill_id']
                if not all(k in review for k in required_fields):
                    logger.warning(f"Skipping review with missing fields: {review.get('id', 'unknown')}")
                    continue
                
                # Extract nested data safely
                score = None
                if 'score' in review:
                    score = review['score']
                elif 'full_review' in review and isinstance(review['full_review'], dict) and 'evaluation' in review['full_review']:
                    score = review['full_review']['evaluation'].get('score')
                
                if score is not None:
                    try:
                        score = float(score)
                    except (ValueError, TypeError):
                        score = None
                
                # Extract problem identification and type from problem_content
                problem_id = None
                problem_type = None
                if 'problem_content' in review and isinstance(review['problem_content'], dict):
                    problem_content = review['problem_content']
                    problem_id = problem_content.get('id')
                    problem_type = problem_content.get('type')

                # Extract problem and answer text from full_review (standardized across all problem types)
                problem_text = None
                answer_text = None
                correct_answer = None
                if 'full_review' in review and isinstance(review['full_review'], dict):
                    full_review = review['full_review']
                    problem_text = full_review.get('question_text')
                    answer_text = full_review.get('your_answer_text')
                    correct_answer = full_review.get('correct_answer_text')

                # Extract all feedback fields from full_review
                feedback_praise = None
                feedback_guidance = None
                feedback_encouragement = None
                feedback_next_steps = None
                if 'full_review' in review and isinstance(review['full_review'], dict) and 'feedback' in review['full_review']:
                    feedback = review['full_review']['feedback']
                    if isinstance(feedback, dict):
                        feedback_praise = feedback.get('praise')
                        feedback_guidance = feedback.get('guidance')
                        feedback_encouragement = feedback.get('encouragement')
                        feedback_next_steps = feedback.get('next_steps')
                
                # Parse timestamp
                timestamp_str = review.get('timestamp')
                if isinstance(timestamp_str, str):
                    try:
                        if timestamp_str.endswith('Z'):
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            timestamp = datetime.fromisoformat(timestamp_str)
                    except ValueError:
                        timestamp = datetime.now()
                else:
                    timestamp = timestamp_str or datetime.now()
                
                # Convert student_id to int safely
                try:
                    student_id = int(review['student_id'])
                except (ValueError, TypeError):
                    logger.warning(f"Invalid student_id in review: {review.get('id', 'unknown')}")
                    continue
                
                transformed_record = {
                    'review_id': str(review['id']),
                    'student_id': student_id,
                    'subject': str(review['subject']),
                    'skill_id': str(review['skill_id']),
                    'subskill_id': str(review['subskill_id']),
                    'score': score,
                    'timestamp': timestamp.isoformat(),
                    # Problem identification and type
                    'problem_id': problem_id,
                    'problem_type': problem_type,
                    # Problem and answer text
                    'problem_text': problem_text,
                    'answer_text': answer_text,
                    'correct_answer': correct_answer,
                    # Feedback fields
                    'feedback_praise': feedback_praise,
                    'feedback_guidance': feedback_guidance,
                    'feedback_encouragement': feedback_encouragement,
                    'feedback_next_steps': feedback_next_steps,
                    # Sync metadata
                    'sync_timestamp': datetime.now().isoformat(),
                    'cosmos_ts': review.get('_ts', 0)
                }
                
                transformed.append(transformed_record)
                
            except Exception as e:
                logger.error(f"Error transforming review {review.get('id', 'unknown')}: {e}")
                continue

        # Log data quality metrics for the new fields
        if transformed:
            total_records = len(transformed)
            problem_type_count = sum(1 for r in transformed if r.get('problem_type'))
            problem_id_count = sum(1 for r in transformed if r.get('problem_id'))
            problem_text_count = sum(1 for r in transformed if r.get('problem_text'))
            answer_text_count = sum(1 for r in transformed if r.get('answer_text'))
            correct_answer_count = sum(1 for r in transformed if r.get('correct_answer'))
            encouragement_count = sum(1 for r in transformed if r.get('feedback_encouragement'))
            next_steps_count = sum(1 for r in transformed if r.get('feedback_next_steps'))

            logger.info(f"Transformed {total_records}/{len(reviews)} reviews successfully")
            logger.info(f"Data quality - problem_type: {problem_type_count}/{total_records} ({problem_type_count/total_records*100:.1f}%)")
            logger.info(f"Data quality - problem_text: {problem_text_count}/{total_records} ({problem_text_count/total_records*100:.1f}%)")
            logger.info(f"Data quality - answer_text: {answer_text_count}/{total_records} ({answer_text_count/total_records*100:.1f}%)")
            logger.info(f"Data quality - correct_answer: {correct_answer_count}/{total_records} ({correct_answer_count/total_records*100:.1f}%)")
        else:
            logger.warning("No reviews were transformed successfully")

        return transformed

    def _transform_user_profiles_data(self, profiles: List[Dict]) -> List[Dict]:
        """Transform user profiles data for BigQuery students table"""
        
        transformed = []
        
        for profile in profiles:
            try:
                # Validate required fields
                if not profile.get('student_id'):
                    logger.warning(f"Skipping profile with missing student_id: {profile.get('id', 'unknown')}")
                    continue
                
                # Extract preferences and onboarding data
                preferences = profile.get('preferences', {})
                onboarding = preferences.get('onboarding', {})
                
                # Parse timestamps
                created_at = profile.get('created_at')
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00')).isoformat()
                    except:
                        created_at = datetime.now().isoformat()
                else:
                    created_at = datetime.now().isoformat()
                
                updated_at = profile.get('updated_at')
                if isinstance(updated_at, str):
                    try:
                        updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).isoformat()
                    except:
                        updated_at = datetime.now().isoformat()
                else:
                    updated_at = datetime.now().isoformat()
                
                # Parse optional timestamps
                last_login = profile.get('last_login')
                if last_login and isinstance(last_login, str):
                    try:
                        last_login = datetime.fromisoformat(last_login.replace('Z', '+00:00')).isoformat()
                    except:
                        last_login = None
                
                last_activity = profile.get('last_activity')
                if last_activity and isinstance(last_activity, str):
                    try:
                        last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00')).isoformat()
                    except:
                        last_activity = None
                
                onboarding_completed_at = profile.get('onboarding_completed_at')
                if onboarding_completed_at and isinstance(onboarding_completed_at, str):
                    try:
                        onboarding_completed_at = datetime.fromisoformat(onboarding_completed_at.replace('Z', '+00:00')).isoformat()
                    except:
                        onboarding_completed_at = None
                
                # Transform the profile data - ensure ALL schema fields are present
                transformed_profile = {
                    # Basic student info - REQUIRED fields
                    'student_id': int(profile['student_id']),
                    'name': str(profile.get('display_name', '')),
                    'email': str(profile.get('email', '')),
                    'grade': str(profile.get('grade_level', '')),
                    'firebase_uid': str(profile.get('firebase_uid', profile.get('uid', ''))),
                    
                    # Engagement metrics - ensure integers
                    'total_points': int(profile.get('total_points', 0)),
                    'current_streak': int(profile.get('current_streak', 0)),
                    'longest_streak': int(profile.get('longest_streak', 0)),
                    'level': int(profile.get('level', 1)),
                    'badges': list(profile.get('badges', [])),
                    
                    # Learning preferences - ensure lists
                    'selected_subjects': list(onboarding.get('selectedSubjects', [])),
                    'selected_packages': list(onboarding.get('selectedPackages', [])),
                    'learning_goals': list(onboarding.get('learningGoals', [])),
                    'preferred_learning_style': list(onboarding.get('preferredLearningStyle', [])),
                    
                    # Status flags - ensure booleans
                    'email_verified': bool(profile.get('email_verified', False)),
                    'onboarding_completed': bool(profile.get('onboarding_completed', False)),
                    
                    # Timestamps - REQUIRED fields with proper ISO format
                    'last_login': last_login,
                    'last_activity': last_activity,
                    'onboarding_completed_at': onboarding_completed_at,
                    'created_at': created_at,
                    'updated_at': updated_at,
                    'sync_timestamp': datetime.now().isoformat()
                }
                
                # Debug log the first transformed record to help with troubleshooting
                if len(transformed) == 0:
                    logger.info(f"Sample transformed profile: {transformed_profile}")
                
                transformed.append(transformed_profile)
                
            except Exception as e:
                logger.error(f"Error transforming profile {profile.get('id', 'unknown')}: {e}")
                logger.error(f"Profile data: {profile}")
                continue
        
        logger.info(f"Transformed {len(transformed)}/{len(profiles)} profiles successfully")
        return transformed

    def _transform_curriculum_data(self, curriculum_df: pd.DataFrame, subject: str) -> List[Dict]:
        """Transform curriculum DataFrame to BigQuery format"""
        
        records = []
        
        for _, row in curriculum_df.iterrows():
            try:
                record = {
                    'subject': str(subject),  # Use the passed subject
                    'grade': str(row.get('Grade', '')),
                    'unit_id': str(row['UnitID']),
                    'unit_title': str(row['UnitTitle']),
                    'skill_id': str(row['SkillID']),
                    'skill_description': str(row['SkillDescription']),
                    'subskill_id': str(row['SubskillID']),
                    'subskill_description': str(row['SubskillDescription']),
                    'difficulty_start': float(row.get('DifficultyStart', 0)),
                    'difficulty_end': float(row.get('DifficultyEnd', 0)),
                    'target_difficulty': float(row.get('TargetDifficulty', 0)),
                    'sync_timestamp': datetime.now().isoformat()
                }
                
                records.append(record)
                
            except Exception as e:
                logger.error(f"Error transforming curriculum row: {e}")
                continue
        
        logger.info(f"Transformed {len(records)} curriculum records for {subject}")
        return records

    def _transform_learning_paths_data(self, learning_paths: Dict[str, List[str]]) -> List[Dict]:
        """Transform learning paths dict to BigQuery format"""
        
        records = []
        
        # Track which skills are mentioned as prerequisites vs unlocked
        all_prerequisite_skills = set(learning_paths.keys())
        all_unlocked_skills = set()
        
        for unlocked_list in learning_paths.values():
            all_unlocked_skills.update(unlocked_list)
        
        # Base nodes are prerequisites that are never unlocked by other skills
        base_node_skills = all_prerequisite_skills - all_unlocked_skills
        
        for prerequisite_skill, unlocked_skills in learning_paths.items():
            is_base_node = prerequisite_skill in base_node_skills
            
            for unlocked_skill in unlocked_skills:
                record = {
                    'prerequisite_skill_id': str(prerequisite_skill),
                    'unlocks_skill_id': str(unlocked_skill),
                    'min_score_threshold': 6.0,  # Default threshold
                    'is_base_node': is_base_node,
                    'sync_timestamp': datetime.now().isoformat()
                }
                
                records.append(record)
        
        logger.info(f"Transformed {len(records)} learning path records")
        return records

    async def _load_data_to_bigquery(self, data: List[Dict], table_id: str, table_name: str) -> int:
        """Load data to BigQuery with proper upsert logic to prevent duplicates"""
        
        # Use MERGE for all tables to handle duplicates properly
        # But if table is empty (after clean), use simple append for performance
        if table_name == "attempts":
            # Check if table is empty
            count_query = f"SELECT COUNT(*) as count FROM `{table_id}`"
            try:
                result = list(self.client.query(count_query))
                table_empty = result[0]['count'] == 0
                if table_empty:
                    logger.info("Attempts table is empty, using fast append instead of MERGE")
                else:
                    return await self._upsert_attempts_to_bigquery(data, table_id)
            except:
                return await self._upsert_attempts_to_bigquery(data, table_id)
        elif table_name == "reviews":
            # Check if table is empty
            count_query = f"SELECT COUNT(*) as count FROM `{table_id}`"
            try:
                result = list(self.client.query(count_query))
                table_empty = result[0]['count'] == 0
                if table_empty:
                    logger.info("Reviews table is empty, using fast append instead of MERGE")
                else:
                    return await self._upsert_reviews_to_bigquery(data, table_id)
            except:
                return await self._upsert_reviews_to_bigquery(data, table_id)
        
        # For other tables (curriculum, learning_paths), use regular append
        # These are typically full-refresh tables that don't accumulate duplicates
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION]
        )
        
        total_loaded = 0
        
        for i in range(0, len(data), self.batch_size):
            batch = data[i:i + self.batch_size]
            
            try:
                job = self.client.load_table_from_json(
                    batch, 
                    table_id,
                    job_config=job_config
                )
                
                job.result()  # Wait for completion
                total_loaded += len(batch)
                logger.info(f"Loaded {table_name} batch {i//self.batch_size + 1}, total: {total_loaded}")
                
            except Exception as batch_error:
                logger.error(f"Error loading {table_name} batch {i//self.batch_size + 1}: {batch_error}")
                # Continue with next batch rather than failing completely
                continue
        
        return total_loaded

    async def _upsert_attempts_to_bigquery(self, data: List[Dict], table_id: str) -> int:
        """Upsert attempts data to BigQuery to avoid duplicates based on cosmos_id"""
        
        if not data:
            return 0
        
        # First, load data to a temporary table
        temp_table_id = f"{table_id}_temp_{int(datetime.now().timestamp())}"
        
        try:
            # Create temporary table with same schema
            temp_table = bigquery.Table(temp_table_id)
            temp_table.schema = self._get_attempts_schema()
            temp_table = self.client.create_table(temp_table)
            logger.info(f"Created temporary table: {temp_table_id}")
            
            # Load data to temporary table
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_TRUNCATE"
                # No schema update options with WRITE_TRUNCATE
            )
            
            total_loaded = 0
            for i in range(0, len(data), self.batch_size):
                batch = data[i:i + self.batch_size]
                
                job = self.client.load_table_from_json(
                    batch, 
                    temp_table_id,
                    job_config=job_config
                )
                job.result()
                total_loaded += len(batch)
                job_config.write_disposition = "WRITE_APPEND"  # Append for subsequent batches
            
            logger.info(f"Loaded {total_loaded} records to temporary table")
            
            # Now MERGE from temp table to main table
            merge_query = f"""
            MERGE `{table_id}` AS target
            USING `{temp_table_id}` AS source
            ON target.cosmos_id = source.cosmos_id
            WHEN MATCHED AND source.sync_timestamp > target.sync_timestamp THEN
                UPDATE SET
                    student_id = source.student_id,
                    subject = source.subject,
                    skill_id = source.skill_id,
                    subskill_id = source.subskill_id,
                    score = source.score,
                    timestamp = source.timestamp,
                    sync_timestamp = source.sync_timestamp,
                    cosmos_ts = source.cosmos_ts
            WHEN NOT MATCHED THEN
                INSERT (student_id, subject, skill_id, subskill_id, score, timestamp, sync_timestamp, cosmos_id, cosmos_ts)
                VALUES (source.student_id, source.subject, source.skill_id, source.subskill_id, 
                       source.score, source.timestamp, source.sync_timestamp, source.cosmos_id, source.cosmos_ts)
            """
            
            # Execute merge
            merge_job = self.client.query(merge_query)
            merge_result = merge_job.result()
            
            logger.info(f"MERGE completed - {merge_result.num_dml_affected_rows} rows affected")
            
            return total_loaded
            
        finally:
            # Clean up temporary table
            try:
                self.client.delete_table(temp_table_id)
                logger.info(f"Deleted temporary table: {temp_table_id}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temporary table: {cleanup_error}")

    async def _upsert_reviews_to_bigquery(self, data: List[Dict], table_id: str) -> int:
        """Upsert reviews data to BigQuery to avoid duplicates based on cosmos_id"""
        
        if not data:
            return 0
        
        # First, load data to a temporary table
        temp_table_id = f"{table_id}_temp_{int(datetime.now().timestamp())}"
        
        try:
            # Create temporary table with same schema
            temp_table = bigquery.Table(temp_table_id)
            temp_table.schema = self._get_reviews_schema()
            temp_table = self.client.create_table(temp_table)
            logger.info(f"Created temporary table: {temp_table_id}")
            
            # Load data to temporary table
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_TRUNCATE"
            )
            
            total_loaded = 0
            for i in range(0, len(data), self.batch_size):
                batch = data[i:i + self.batch_size]
                
                job = self.client.load_table_from_json(
                    batch, 
                    temp_table_id,
                    job_config=job_config
                )
                job.result()
                total_loaded += len(batch)
                job_config.write_disposition = "WRITE_APPEND"  # Append for subsequent batches
            
            logger.info(f"Loaded {total_loaded} records to temporary table")
            
            # Now MERGE from temp table to main table - assuming reviews have cosmos_id like attempts
            merge_query = f"""
            MERGE `{table_id}` AS target
            USING `{temp_table_id}` AS source
            ON target.cosmos_id = source.cosmos_id
            WHEN MATCHED AND source.sync_timestamp > target.sync_timestamp THEN
                UPDATE SET
                    student_id = source.student_id,
                    subject = source.subject,
                    skill_id = source.skill_id,
                    subskill_id = source.subskill_id,
                    content = source.content,
                    timestamp = source.timestamp,
                    sync_timestamp = source.sync_timestamp,
                    cosmos_ts = source.cosmos_ts
            WHEN NOT MATCHED THEN
                INSERT (student_id, subject, skill_id, subskill_id, content, timestamp, sync_timestamp, cosmos_id, cosmos_ts)
                VALUES (source.student_id, source.subject, source.skill_id, source.subskill_id,
                       source.content, source.timestamp, source.sync_timestamp, source.cosmos_id, source.cosmos_ts)
            """
            
            # Execute merge
            merge_job = self.client.query(merge_query)
            merge_result = merge_job.result()
            
            logger.info(f"Reviews MERGE completed - {merge_result.num_dml_affected_rows} rows affected")
            
            return total_loaded
            
        finally:
            # Clean up temporary table
            try:
                self.client.delete_table(temp_table_id)
                logger.info(f"Deleted temporary table: {temp_table_id}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temporary table: {cleanup_error}")

    async def _ensure_table_exists(self, table_name: str, schema: List[bigquery.SchemaField]):
        """Ensure BigQuery table exists with proper schema"""
        
        table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
        
        try:
            # Try to get the table
            existing_table = self.client.get_table(table_id)

            # For tables that may have schema updates, check if schema needs updating
            if table_name in ["students", "reviews"]:
                existing_fields = {field.name for field in existing_table.schema}
                new_fields = {field.name for field in schema}

                # Check if new fields have been added
                missing_fields = new_fields - existing_fields

                if missing_fields:
                    logger.info(f"Table {table_name} missing new fields: {missing_fields}")
                    logger.info(f"Adding new columns to {table_name} table (preserving existing data)...")

                    # Get the new field definitions
                    new_field_schemas = [field for field in schema if field.name in missing_fields]

                    # Add new columns to existing table (preserves data)
                    existing_table.schema = list(existing_table.schema) + new_field_schemas
                    updated_table = self.client.update_table(existing_table, ["schema"])

                    logger.info(f"Successfully added {len(missing_fields)} new columns to {table_name} table")
                else:
                    logger.info(f"Table {table_name} already exists with compatible schema")
            else:
                logger.info(f"Table {table_name} already exists")
                
        except NotFound:
            # Create the table
            table = bigquery.Table(table_id, schema=schema)
            table = self.client.create_table(table)
            logger.info(f"Created table {table_name}")
        except Exception as e:
            logger.error(f"Error ensuring table {table_name} exists: {e}")
            raise

    async def _execute_query(self, query: str, return_results: bool = False) -> Optional[List[Dict]]:
        """Execute a BigQuery SQL query
        
        Args:
            query: SQL query to execute
            return_results: Whether to return query results (for SELECT queries)
            
        Returns:
            List of query results if return_results is True, otherwise None
        """
        try:
            logger.info(f"Executing BigQuery query: {query[:100]}...")
            
            # Execute the query
            job = self.client.query(query)
            
            # Wait for completion
            results = job.result()
            
            if return_results:
                # Convert results to list of dictionaries
                return [dict(row) for row in results]
            else:
                logger.info(f"Query executed successfully. Rows affected: {job.num_dml_affected_rows or 'N/A'}")
                return None
                
        except Exception as e:
            logger.error(f"Error executing BigQuery query: {e}")
            logger.error(f"Query was: {query}")
            raise

    async def create_students_table(self) -> Dict[str, Any]:
        """Create students table from unique student_ids in attempts"""
        
        try:
            logger.info("Creating students table from attempts data")
            
            # Ensure table exists
            await self._ensure_table_exists("students", self._get_students_schema())
            
            # Create/update students table from attempts
            students_query = f"""
            CREATE OR REPLACE TABLE `{self.project_id}.{self.dataset_id}.students` AS
            SELECT DISTINCT
                student_id,
                CAST(student_id AS STRING) as name,  -- You might want to update this with actual names
                CAST(NULL AS STRING) as grade,       -- You might want to update this with actual grades
                CURRENT_TIMESTAMP() as created_at,
                CURRENT_TIMESTAMP() as updated_at
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            WHERE student_id IS NOT NULL
            """
            
            job = self.client.query(students_query)
            job.result()
            
            # Get count of students created
            count_query = f"SELECT COUNT(*) as student_count FROM `{self.project_id}.{self.dataset_id}.students`"
            count_job = self.client.query(count_query)
            student_count = list(count_job.result())[0]['student_count']
            
            logger.info(f"Created students table with {student_count} students")
            
            return {
                "success": True,
                "records_processed": student_count,
                "table": f"{self.project_id}.{self.dataset_id}.students"
            }
            
        except Exception as e:
            logger.error(f"Error creating students table: {e}")
            return {"success": False, "error": str(e)}

    async def create_student_analytics_table(self) -> Dict[str, Any]:
        """Create the comprehensive student analytics table based on your SQL query"""
        
        try:
            logger.info("Creating student analytics table")
            
            # Ensure all required tables exist
            required_tables = ['students', 'attempts', 'curriculum', 'subskill_paths']
            for table in required_tables:
                try:
                    self.client.get_table(f"{self.project_id}.{self.dataset_id}.{table}")
                except NotFound:
                    logger.error(f"Required table {table} not found")
                    return {"success": False, "error": f"Table {table} not found"}
            
            # Ensure analytics table exists
            await self._ensure_table_exists("student_analytics", self._get_student_analytics_schema())
            
            # Create the analytics table using your complex query logic
            analytics_query = self._get_student_analytics_query()
            
            # Execute the query
            job = self.client.query(analytics_query)
            job.result()
            
            # Get count of records created
            count_query = f"SELECT COUNT(*) as record_count FROM `{self.project_id}.{self.dataset_id}.student_analytics`"
            count_job = self.client.query(count_query)
            record_count = list(count_job.result())[0]['record_count']
            
            logger.info(f"Created student analytics table with {record_count} records")
            
            return {
                "success": True,
                "records_processed": record_count,
                "table": f"{self.project_id}.{self.dataset_id}.student_analytics"
            }
            
        except Exception as e:
            logger.error(f"Error creating student analytics table: {e}")
            return {"success": False, "error": str(e)}

    def _get_student_analytics_query(self) -> str:
        """Get the BigQuery SQL for creating the student analytics table"""
        
        return f"""
        CREATE OR REPLACE TABLE `{self.project_id}.{self.dataset_id}.student_analytics` AS
        WITH 
        -- First get all curriculum items to establish the full hierarchy
        all_curriculum_items AS (
            SELECT DISTINCT
                subject,
                skill_id,
                subskill_id
            FROM
                `{self.project_id}.{self.dataset_id}.curriculum`
        ),

        -- Calculate average scores for each student and subskill_id (only for attempted items)
        student_subskill_scores AS (
            SELECT 
                student_id,
                subskill_id,
                AVG(score / 10) AS avg_score
            FROM 
                `{self.project_id}.{self.dataset_id}.attempts`
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
                `{self.project_id}.{self.dataset_id}.students` s
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
                `{self.project_id}.{self.dataset_id}.students` s
            CROSS JOIN
                `{self.project_id}.{self.dataset_id}.curriculum` c
            LEFT JOIN
                `{self.project_id}.{self.dataset_id}.subskill_paths` slp ON c.subskill_id = slp.next_subskill
            WHERE
                slp.current_subskill IS NULL
            
            UNION ALL
            
            -- Add subskills where the student has 60% proficiency in the prerequisite
            SELECT DISTINCT
                sp.student_id,
                slp.next_subskill AS subskill_id
            FROM
                subskill_proficiency sp
            JOIN
                `{self.project_id}.{self.dataset_id}.subskill_paths` slp ON sp.subskill_id = slp.current_subskill
            WHERE
                sp.proficiency >= 0.6  -- Must have 60% proficiency in prerequisite subskill
                AND slp.next_subskill IS NOT NULL -- Only if there is a next subskill
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
                CAST(s.grade AS STRING) AS student_grade,
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
                slp.next_subskill AS next_subskill,
                
                -- Add sync timestamp
                CURRENT_TIMESTAMP() AS sync_timestamp
            FROM 
                `{self.project_id}.{self.dataset_id}.attempts` a
            JOIN 
                `{self.project_id}.{self.dataset_id}.students` s ON a.student_id = s.student_id
            LEFT JOIN 
                `{self.project_id}.{self.dataset_id}.curriculum` c ON a.subskill_id = c.subskill_id
            LEFT JOIN
                ready_subskills rs ON a.student_id = rs.student_id AND a.subskill_id = rs.subskill_id
            LEFT JOIN 
                unlocked_skills us ON a.student_id = us.student_id AND a.skill_id = us.skill_id
            LEFT JOIN
                subskill_proficiency sp ON a.student_id = sp.student_id AND a.subskill_id = sp.subskill_id
            LEFT JOIN
                skill_proficiency skp ON a.student_id = skp.student_id AND a.skill_id = skp.skill_id
            LEFT JOIN
                `{self.project_id}.{self.dataset_id}.subskill_paths` slp ON a.subskill_id = slp.current_subskill
            LEFT JOIN
                item_priority ip ON a.student_id = ip.student_id AND a.subskill_id = ip.subskill_id
                
            UNION ALL
            
            -- Add curriculum items without attempts
            SELECT 
                s.student_id,
                s.name AS student_name,
                CAST(s.grade AS STRING) AS student_grade,
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
                slp.next_subskill AS next_subskill,
                
                -- Add sync timestamp
                CURRENT_TIMESTAMP() AS sync_timestamp
            FROM 
                `{self.project_id}.{self.dataset_id}.curriculum` c
            CROSS JOIN
                `{self.project_id}.{self.dataset_id}.students` s
            LEFT JOIN
                ready_subskills rs ON s.student_id = rs.student_id AND c.subskill_id = rs.subskill_id
            LEFT JOIN 
                unlocked_skills us ON s.student_id = us.student_id AND c.skill_id = us.skill_id
            LEFT JOIN
                subskill_proficiency sp ON s.student_id = sp.student_id AND c.subskill_id = sp.subskill_id
            LEFT JOIN
                skill_proficiency skp ON s.student_id = skp.student_id AND c.skill_id = skp.skill_id
            LEFT JOIN
                `{self.project_id}.{self.dataset_id}.subskill_paths` slp ON c.subskill_id = slp.current_subskill
            LEFT JOIN
                item_priority ip ON s.student_id = ip.student_id AND c.subskill_id = ip.subskill_id
            WHERE 
                NOT EXISTS (
                    SELECT 1 
                    FROM `{self.project_id}.{self.dataset_id}.attempts` a 
                    WHERE a.subskill_id = c.subskill_id
                    AND a.student_id = s.student_id
                )
        )
        -- Final query with all relevant information
        SELECT * FROM combined_data
        ORDER BY
            student_id,
            subject,
            recommended_next DESC, -- Put recommended items first
            priority_order,        -- Then sort by priority
            skill_id,
            subskill_id,
            attempt_timestamp
        """

    def _get_student_analytics_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for student analytics table"""
        return [
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("student_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("student_grade", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("score", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("attempt_timestamp", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("curriculum_grade", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_title", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("skill_description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("subskill_description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("difficulty_start", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("difficulty_end", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("target_difficulty", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("coverage_status", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("readiness_status", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("priority_level", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("priority_order", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("recommended_next", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("subskill_proficiency", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("skill_proficiency", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("next_subskill", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]

    def _get_attempts_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for attempts table"""
        return [
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("score", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),
        ]

    def _get_reviews_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for reviews table"""
        return [
            bigquery.SchemaField("review_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("score", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            # Problem identification and type
            bigquery.SchemaField("problem_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("problem_type", "STRING", mode="NULLABLE"),
            # Problem and answer text (from full_review for consistency)
            bigquery.SchemaField("problem_text", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("answer_text", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("correct_answer", "STRING", mode="NULLABLE"),
            # Feedback fields (expanded)
            bigquery.SchemaField("feedback_praise", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("feedback_guidance", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("feedback_encouragement", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("feedback_next_steps", "STRING", mode="NULLABLE"),
            # Sync metadata
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),
        ]

    def _get_curriculum_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for curriculum table"""
        return [
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
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]

    def _get_learning_paths_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for learning paths table"""
        return [
            bigquery.SchemaField("prerequisite_skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unlocks_skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("min_score_threshold", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("is_base_node", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]

    def _get_students_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for students table with full user profile data"""
        return [
            # Basic student info
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("email", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("grade", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("firebase_uid", "STRING", mode="NULLABLE"),

            # Engagement metrics
            bigquery.SchemaField("total_points", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("current_streak", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("longest_streak", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("level", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("badges", "STRING", mode="REPEATED"),

            # Learning preferences (arrays)
            bigquery.SchemaField("selected_subjects", "STRING", mode="REPEATED"),
            bigquery.SchemaField("selected_packages", "STRING", mode="REPEATED"),
            bigquery.SchemaField("learning_goals", "STRING", mode="REPEATED"),
            bigquery.SchemaField("preferred_learning_style", "STRING", mode="REPEATED"),

            # Status flags
            bigquery.SchemaField("email_verified", "BOOLEAN", mode="NULLABLE"),
            bigquery.SchemaField("onboarding_completed", "BOOLEAN", mode="NULLABLE"),

            # Timestamps
            bigquery.SchemaField("last_login", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("last_activity", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("onboarding_completed_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("updated_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
        ]

    def _get_assessments_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for assessments table"""
        return [
            # Primary Keys
            bigquery.SchemaField("assessment_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),

            # Core Metadata
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "STRING", mode="REQUIRED"),  # created, in_progress, completed
            bigquery.SchemaField("total_questions", "INTEGER", mode="NULLABLE"),

            # Timing
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("started_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("completed_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("expires_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("time_taken_minutes", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("estimated_duration_minutes", "INTEGER", mode="NULLABLE"),

            # High-Level Metrics (denormalized for performance)
            bigquery.SchemaField("score_percentage", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("correct_count", "INTEGER", mode="NULLABLE"),

            # Category Breakdown (denormalized)
            bigquery.SchemaField("weak_spots_count", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("recent_practice_count", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("foundational_review_count", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("new_frontiers_count", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("total_available_subskills", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("is_cold_start", "BOOLEAN", mode="NULLABLE"),

            # Performance by Problem Type (RECORD for structured data)
            bigquery.SchemaField("performance_by_type", "RECORD", mode="REPEATED", fields=[
                bigquery.SchemaField("problem_type", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("total", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("correct", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("percentage", "FLOAT", mode="NULLABLE"),
            ]),

            # Performance by Category (RECORD for structured data)
            bigquery.SchemaField("performance_by_category", "RECORD", mode="REPEATED", fields=[
                bigquery.SchemaField("category", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("total", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("correct", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("percentage", "FLOAT", mode="NULLABLE"),
                bigquery.SchemaField("unique_skills", "INTEGER", mode="NULLABLE"),
            ]),

            # Detailed Metrics (from summary.detailed_metrics)
            bigquery.SchemaField("average_score_per_skill", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("skills_mastered", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("skills_struggling", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("total_skills_assessed", "INTEGER", mode="NULLABLE"),

            # AI Insights Summary (top-level only)
            bigquery.SchemaField("ai_summary", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("performance_quote", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("common_misconceptions", "STRING", mode="REPEATED"),

            # Metadata
            bigquery.SchemaField("firebase_uid", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),

            # ETL Metadata
            bigquery.SchemaField("etl_loaded_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("etl_batch_id", "STRING", mode="NULLABLE"),
        ]

    def _get_assessment_subskill_attempts_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for assessment subskill attempts table"""
        return [
            # Primary Keys
            bigquery.SchemaField("assessment_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("subskill_id", "STRING", mode="REQUIRED"),

            # Hierarchy Context (denormalized for performance)
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("skill_description", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_title", "STRING", mode="NULLABLE"),

            # Subskill Details
            bigquery.SchemaField("subskill_description", "STRING", mode="NULLABLE"),

            # Assessment Context
            bigquery.SchemaField("category", "STRING", mode="NULLABLE"),  # weak_spots, recent_practice, etc.

            # Performance Metrics (from blueprint)
            bigquery.SchemaField("mastery", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("avg_score", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("proficiency", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("completion", "FLOAT", mode="NULLABLE"),
            bigquery.SchemaField("attempt_count", "INTEGER", mode="NULLABLE"),
            bigquery.SchemaField("is_attempted", "BOOLEAN", mode="NULLABLE"),
            bigquery.SchemaField("readiness_status", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("priority_level", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("priority_order", "INTEGER", mode="NULLABLE"),

            # Timing
            bigquery.SchemaField("assessment_created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("assessment_completed_at", "TIMESTAMP", mode="NULLABLE"),

            # Metadata
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),

            # ETL Metadata
            bigquery.SchemaField("etl_loaded_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("etl_batch_id", "STRING", mode="NULLABLE"),
        ]

    def _get_assessment_problem_reviews_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for assessment problem reviews table"""
        return [
            # Primary Keys
            bigquery.SchemaField("assessment_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("problem_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),

            # Hierarchy Context (denormalized)
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("skill_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("subskill_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("subskill_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_title", "STRING", mode="NULLABLE"),

            # Problem Details
            bigquery.SchemaField("problem_type", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("difficulty", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("grade_level", "STRING", mode="NULLABLE"),

            # Performance
            bigquery.SchemaField("is_correct", "BOOLEAN", mode="REQUIRED"),
            bigquery.SchemaField("score", "INTEGER", mode="NULLABLE"),  # 0-10 scale

            # Answers (for review)
            bigquery.SchemaField("student_answer_text", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("correct_answer_text", "STRING", mode="NULLABLE"),

            # Misconception Engine
            bigquery.SchemaField("misconception", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("misconception_addressed", "BOOLEAN", mode="NULLABLE"),

            # Timing
            bigquery.SchemaField("assessment_created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("assessment_completed_at", "TIMESTAMP", mode="NULLABLE"),

            # Metadata
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),

            # ETL Metadata
            bigquery.SchemaField("etl_loaded_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("etl_batch_id", "STRING", mode="NULLABLE"),
        ]

    def _get_assessment_skill_insights_schema(self) -> List[bigquery.SchemaField]:
        """Get BigQuery schema for assessment skill insights table"""
        return [
            # Primary Keys
            bigquery.SchemaField("assessment_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("student_id", "INTEGER", mode="REQUIRED"),

            # Hierarchy Context (denormalized)
            bigquery.SchemaField("subject", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("skill_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_id", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("unit_title", "STRING", mode="NULLABLE"),

            # Assessment Context
            bigquery.SchemaField("category", "STRING", mode="NULLABLE"),  # From blueprint

            # Performance Metrics
            bigquery.SchemaField("total_questions", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("correct_count", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("percentage", "FLOAT", mode="REQUIRED"),

            # AI-Enhanced Fields
            bigquery.SchemaField("assessment_focus_tag", "STRING", mode="NULLABLE"),  # "🎯 Weak Spot", etc.
            bigquery.SchemaField("performance_label", "STRING", mode="NULLABLE"),     # "Mastered", "Proficient", etc.
            bigquery.SchemaField("insight_text", "STRING", mode="NULLABLE"),          # Context-aware insight

            # Next Step Recommendation (RECORD for structured data)
            bigquery.SchemaField("next_step", "RECORD", mode="NULLABLE", fields=[
                bigquery.SchemaField("text", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("link", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("action_type", "STRING", mode="NULLABLE"),  # learn, practice, challenge, review
            ]),

            # Subskill Breakdown (ARRAY for drill-down)
            bigquery.SchemaField("subskills", "RECORD", mode="REPEATED", fields=[
                bigquery.SchemaField("subskill_id", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("subskill_description", "STRING", mode="NULLABLE"),
                bigquery.SchemaField("questions", "INTEGER", mode="NULLABLE"),
                bigquery.SchemaField("correct", "INTEGER", mode="NULLABLE"),
            ]),

            # Timing
            bigquery.SchemaField("assessment_created_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("assessment_completed_at", "TIMESTAMP", mode="NULLABLE"),

            # Metadata
            bigquery.SchemaField("sync_timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("cosmos_ts", "INTEGER", mode="NULLABLE"),

            # ETL Metadata
            bigquery.SchemaField("etl_loaded_at", "TIMESTAMP", mode="NULLABLE"),
            bigquery.SchemaField("etl_batch_id", "STRING", mode="NULLABLE"),
        ]

    def _transform_assessment_data(self, assessments: List[Dict]) -> List[Dict]:
        """Transform assessment data for BigQuery assessments table"""

        transformed = []

        for assessment in assessments:
            try:
                # Skip if not a completed assessment (we only want completed assessments with results)
                if assessment.get('status') != 'completed' or 'results' not in assessment:
                    continue

                # Extract results structure
                results = assessment.get('results', {})
                summary = results.get('summary', {})
                ai_insights = results.get('ai_insights', {})
                blueprint = assessment.get('blueprint', {})
                category_breakdown = blueprint.get('category_breakdown', {})

                # Parse timestamps
                created_at = self._parse_timestamp(assessment.get('created_at'))
                started_at = self._parse_timestamp(assessment.get('started_at'))
                completed_at = self._parse_timestamp(assessment.get('completed_at'))
                expires_at = self._parse_timestamp(assessment.get('expires_at'))

                # Transform performance_by_problem_type to list of dicts
                performance_by_type = []
                for prob_type, stats in summary.get('performance_by_problem_type', {}).items():
                    performance_by_type.append({
                        'problem_type': prob_type,
                        'total': stats.get('total'),
                        'correct': stats.get('correct'),
                        'percentage': stats.get('percentage')
                    })

                # Transform performance_by_category to list of dicts
                performance_by_category = []
                for category, stats in summary.get('performance_by_category', {}).items():
                    performance_by_category.append({
                        'category': category,
                        'total': stats.get('total'),
                        'correct': stats.get('correct'),
                        'percentage': stats.get('percentage'),
                        'unique_skills': stats.get('unique_skills')
                    })

                # Get detailed metrics
                detailed_metrics = summary.get('detailed_metrics', {})

                transformed_record = {
                    # Primary Keys
                    'assessment_id': assessment.get('assessment_id'),
                    'student_id': int(assessment.get('student_id')),

                    # Core Metadata
                    'subject': assessment.get('subject'),
                    'status': assessment.get('status'),
                    'total_questions': assessment.get('total_questions'),

                    # Timing
                    'created_at': created_at.isoformat() if created_at else None,
                    'started_at': started_at.isoformat() if started_at else None,
                    'completed_at': completed_at.isoformat() if completed_at else None,
                    'expires_at': expires_at.isoformat() if expires_at else None,
                    'time_taken_minutes': assessment.get('time_taken_minutes'),
                    'estimated_duration_minutes': assessment.get('estimated_duration_minutes'),

                    # High-Level Metrics
                    'score_percentage': summary.get('score_percentage'),
                    'correct_count': summary.get('correct_count'),

                    # Category Breakdown
                    'weak_spots_count': category_breakdown.get('weak_spots', 0),
                    'recent_practice_count': category_breakdown.get('recent_practice', 0),
                    'foundational_review_count': category_breakdown.get('foundational_review', 0),
                    'new_frontiers_count': category_breakdown.get('new_frontiers', 0),
                    'total_available_subskills': blueprint.get('total_available_subskills'),
                    'is_cold_start': blueprint.get('is_cold_start', False),

                    # Performance arrays
                    'performance_by_type': performance_by_type,
                    'performance_by_category': performance_by_category,

                    # Detailed Metrics
                    'average_score_per_skill': detailed_metrics.get('average_score_per_skill'),
                    'skills_mastered': detailed_metrics.get('skills_mastered'),
                    'skills_struggling': detailed_metrics.get('skills_struggling'),
                    'total_skills_assessed': detailed_metrics.get('total_skills_assessed'),

                    # AI Insights
                    'ai_summary': ai_insights.get('ai_summary'),
                    'performance_quote': ai_insights.get('performance_quote'),
                    'common_misconceptions': ai_insights.get('common_misconceptions', []),

                    # Metadata
                    'firebase_uid': assessment.get('firebase_uid'),
                    'sync_timestamp': datetime.now().isoformat(),
                    'cosmos_id': assessment.get('id'),
                    'cosmos_ts': assessment.get('_ts', 0),

                    # ETL Metadata
                    'etl_loaded_at': datetime.now().isoformat(),
                    'etl_batch_id': str(uuid.uuid4())
                }

                transformed.append(transformed_record)

            except Exception as e:
                logger.error(f"Error transforming assessment {assessment.get('assessment_id', 'unknown')}: {e}")
                continue

        logger.info(f"Transformed {len(transformed)}/{len(assessments)} assessments successfully")
        return transformed

    def _extract_subskill_attempts(self, assessments: List[Dict]) -> List[Dict]:
        """Extract and flatten blueprint subskills into separate records"""

        flattened = []

        for assessment in assessments:
            try:
                assessment_id = assessment.get('assessment_id')
                student_id = assessment.get('student_id')
                subject = assessment.get('subject')
                created_at = self._parse_timestamp(assessment.get('created_at'))
                completed_at = self._parse_timestamp(assessment.get('completed_at'))
                cosmos_ts = assessment.get('_ts', 0)

                # Get blueprint subskills
                blueprint = assessment.get('blueprint', {})
                selected_subskills = blueprint.get('selected_subskills', [])

                for subskill in selected_subskills:
                    record = {
                        # Primary Keys
                        'assessment_id': assessment_id,
                        'student_id': int(student_id),
                        'subskill_id': subskill.get('subskill_id'),

                        # Hierarchy Context
                        'subject': subject,
                        'skill_id': subskill.get('skill_id'),
                        'skill_description': subskill.get('skill_description'),
                        'unit_id': subskill.get('unit_id'),
                        'unit_title': subskill.get('unit_title'),

                        # Subskill Details
                        'subskill_description': subskill.get('subskill_description'),

                        # Assessment Context
                        'category': subskill.get('category'),

                        # Performance Metrics
                        'mastery': subskill.get('mastery'),
                        'avg_score': subskill.get('avg_score'),
                        'proficiency': subskill.get('proficiency'),
                        'completion': subskill.get('completion'),
                        'attempt_count': subskill.get('attempt_count'),
                        'is_attempted': subskill.get('is_attempted', False),
                        'readiness_status': subskill.get('readiness_status'),
                        'priority_level': subskill.get('priority_level'),
                        'priority_order': subskill.get('priority_order'),

                        # Timing
                        'assessment_created_at': created_at.isoformat() if created_at else None,
                        'assessment_completed_at': completed_at.isoformat() if completed_at else None,

                        # Metadata
                        'sync_timestamp': datetime.now().isoformat(),
                        'cosmos_ts': cosmos_ts,

                        # ETL Metadata
                        'etl_loaded_at': datetime.now().isoformat(),
                        'etl_batch_id': str(uuid.uuid4())
                    }

                    flattened.append(record)

            except Exception as e:
                logger.error(f"Error extracting subskills from assessment {assessment.get('assessment_id', 'unknown')}: {e}")
                continue

        logger.info(f"Extracted {len(flattened)} subskill attempts from {len(assessments)} assessments")
        return flattened

    def _extract_problem_reviews(self, assessments: List[Dict]) -> List[Dict]:
        """Extract and flatten problem reviews into separate records"""

        flattened = []

        for assessment in assessments:
            try:
                # Skip if no results
                if 'results' not in assessment:
                    continue

                assessment_id = assessment.get('assessment_id')
                student_id = assessment.get('student_id')
                subject = assessment.get('subject')
                created_at = self._parse_timestamp(assessment.get('created_at'))
                completed_at = self._parse_timestamp(assessment.get('completed_at'))
                cosmos_ts = assessment.get('_ts', 0)

                # Get problem reviews
                results = assessment.get('results', {})
                problem_reviews = results.get('problem_reviews', [])

                for review in problem_reviews:
                    record = {
                        # Primary Keys
                        'assessment_id': assessment_id,
                        'problem_id': review.get('problem_id'),
                        'student_id': int(student_id),

                        # Hierarchy Context
                        'subject': subject,
                        'skill_id': review.get('skill_id'),
                        'skill_name': review.get('skill_name'),
                        'subskill_id': review.get('subskill_id'),
                        'subskill_name': review.get('subskill_name'),
                        'unit_id': review.get('unit_id'),
                        'unit_title': review.get('unit_title'),

                        # Problem Details
                        'problem_type': review.get('problem_type'),
                        'difficulty': review.get('difficulty'),
                        'grade_level': review.get('grade_level'),

                        # Performance
                        'is_correct': review.get('is_correct', False),
                        'score': review.get('score'),

                        # Answers
                        'student_answer_text': review.get('student_answer_text'),
                        'correct_answer_text': review.get('correct_answer_text'),

                        # Misconception (if available)
                        'misconception': review.get('misconception'),
                        'misconception_addressed': review.get('misconception_addressed'),

                        # Timing
                        'assessment_created_at': created_at.isoformat() if created_at else None,
                        'assessment_completed_at': completed_at.isoformat() if completed_at else None,

                        # Metadata
                        'sync_timestamp': datetime.now().isoformat(),
                        'cosmos_ts': cosmos_ts,

                        # ETL Metadata
                        'etl_loaded_at': datetime.now().isoformat(),
                        'etl_batch_id': str(uuid.uuid4())
                    }

                    flattened.append(record)

            except Exception as e:
                logger.error(f"Error extracting problem reviews from assessment {assessment.get('assessment_id', 'unknown')}: {e}")
                continue

        logger.info(f"Extracted {len(flattened)} problem reviews from {len(assessments)} assessments")
        return flattened

    def _extract_skill_insights(self, assessments: List[Dict]) -> List[Dict]:
        """Extract and flatten skill insights into separate records"""

        flattened = []

        for assessment in assessments:
            try:
                # Skip if no results
                if 'results' not in assessment:
                    continue

                assessment_id = assessment.get('assessment_id')
                student_id = assessment.get('student_id')
                subject = assessment.get('subject')
                created_at = self._parse_timestamp(assessment.get('created_at'))
                completed_at = self._parse_timestamp(assessment.get('completed_at'))
                cosmos_ts = assessment.get('_ts', 0)

                # Get skill insights from AI insights
                results = assessment.get('results', {})
                ai_insights = results.get('ai_insights', {})
                skill_insights = ai_insights.get('skill_insights', [])

                for insight in skill_insights:
                    # Transform next_step to proper format
                    next_step = insight.get('next_step')
                    if next_step and isinstance(next_step, dict):
                        next_step_record = {
                            'text': next_step.get('text'),
                            'link': next_step.get('link'),
                            'action_type': next_step.get('action_type')
                        }
                    else:
                        next_step_record = None

                    # Transform subskills array
                    subskills = []
                    for subskill in insight.get('subskills', []):
                        subskills.append({
                            'subskill_id': subskill.get('subskill_id'),
                            'subskill_description': subskill.get('subskill_description'),
                            'questions': subskill.get('questions'),
                            'correct': subskill.get('correct')
                        })

                    record = {
                        # Primary Keys
                        'assessment_id': assessment_id,
                        'skill_id': insight.get('skill_id'),
                        'student_id': int(student_id),

                        # Hierarchy Context
                        'subject': subject,
                        'skill_name': insight.get('skill_name'),
                        'unit_id': insight.get('unit_id'),
                        'unit_title': insight.get('unit_title'),

                        # Assessment Context
                        'category': insight.get('category'),

                        # Performance Metrics
                        'total_questions': insight.get('total_questions'),
                        'correct_count': insight.get('correct_count'),
                        'percentage': insight.get('percentage'),

                        # AI-Enhanced Fields
                        'assessment_focus_tag': insight.get('assessment_focus_tag'),
                        'performance_label': insight.get('performance_label'),
                        'insight_text': insight.get('insight_text'),

                        # Next Step Recommendation
                        'next_step': next_step_record,

                        # Subskill Breakdown
                        'subskills': subskills,

                        # Timing
                        'assessment_created_at': created_at.isoformat() if created_at else None,
                        'assessment_completed_at': completed_at.isoformat() if completed_at else None,

                        # Metadata
                        'sync_timestamp': datetime.now().isoformat(),
                        'cosmos_ts': cosmos_ts,

                        # ETL Metadata
                        'etl_loaded_at': datetime.now().isoformat(),
                        'etl_batch_id': str(uuid.uuid4())
                    }

                    flattened.append(record)

            except Exception as e:
                logger.error(f"Error extracting skill insights from assessment {assessment.get('assessment_id', 'unknown')}: {e}")
                continue

        logger.info(f"Extracted {len(flattened)} skill insights from {len(assessments)} assessments")
        return flattened

    def _parse_timestamp(self, timestamp_str: Any) -> Optional[datetime]:
        """Parse timestamp string to datetime object"""
        if not timestamp_str:
            return None

        if isinstance(timestamp_str, datetime):
            return timestamp_str

        if isinstance(timestamp_str, str):
            try:
                # Handle different timestamp formats
                if timestamp_str.endswith('Z'):
                    return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                else:
                    return datetime.fromisoformat(timestamp_str)
            except ValueError:
                logger.warning(f"Could not parse timestamp: {timestamp_str}")
                return None

        return None

    async def _upsert_curriculum_data(self, curriculum_records: List[Dict], subject: str):
        """Upsert curriculum data for a specific subject"""
        
        table_id = f"{self.project_id}.{self.dataset_id}.curriculum"
        
        # Delete existing records for this subject
        delete_query = f"""
        DELETE FROM `{table_id}` 
        WHERE subject = @subject
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("subject", "STRING", subject)
            ]
        )
        
        delete_job = self.client.query(delete_query, job_config=job_config)
        delete_job.result()
        logger.info(f"Deleted existing curriculum data for subject: {subject}")
        
        # Insert new records
        if curriculum_records:
            total_loaded = await self._load_data_to_bigquery(curriculum_records, table_id, "curriculum")
            logger.info(f"Loaded {total_loaded} curriculum records for {subject}")

    async def _get_last_sync_timestamp(self, table_name: str) -> Optional[datetime]:
        """Get the last sync timestamp for incremental syncing"""
        
        try:
            # Query the sync_metadata table or use max timestamp from target table
            query = f"""
            SELECT MAX(sync_timestamp) as last_sync
            FROM `{self.project_id}.{self.dataset_id}.{table_name}`
            WHERE sync_timestamp IS NOT NULL
            """
            
            query_job = self.client.query(query)
            results = list(query_job.result())
            
            if results and results[0]['last_sync']:
                return results[0]['last_sync']
            
            # If no sync timestamp, look at data timestamps
            fallback_query = f"""
            SELECT MAX(timestamp) as last_data
            FROM `{self.project_id}.{self.dataset_id}.{table_name}`
            """
            
            fallback_job = self.client.query(fallback_query)
            fallback_results = list(fallback_job.result())
            
            if fallback_results and fallback_results[0]['last_data']:
                # Return 1 hour before last data to ensure we don't miss anything
                last_data = fallback_results[0]['last_data']
                return last_data - timedelta(hours=1)
            
            return None
            
        except Exception as e:
            logger.warning(f"Could not determine last sync timestamp for {table_name}: {e}")
            return None

    async def _update_sync_timestamp(self, table_name: str):
        """Update sync metadata (could be stored in a separate metadata table)"""
        
        # For now, we rely on the sync_timestamp column in each record
        # In a production system, you might want a dedicated metadata table
        logger.info(f"Sync completed for {table_name} at {datetime.now()}")

    async def validate_data_integrity(self) -> Dict[str, Any]:
        """Validate data integrity after ETL"""
        
        try:
            validation_results = {}
            
            # Check attempts data
            attempts_query = f"""
            SELECT 
              COUNT(*) as total_attempts,
              COUNT(DISTINCT student_id) as unique_students,
              COUNT(DISTINCT subskill_id) as unique_subskills,
              MIN(timestamp) as earliest_attempt,
              MAX(timestamp) as latest_attempt,
              AVG(score) as avg_score
            FROM `{self.project_id}.{self.dataset_id}.attempts`
            """
            
            try:
                attempts_job = self.client.query(attempts_query)
                attempts_stats = list(attempts_job.result())[0]
                validation_results['attempts'] = dict(attempts_stats)
            except NotFound:
                validation_results['attempts'] = {"error": "Table not found"}
            
            # Check reviews data
            reviews_query = f"""
            SELECT 
              COUNT(*) as total_reviews,
              COUNT(DISTINCT student_id) as unique_students,
              COUNT(DISTINCT subskill_id) as unique_subskills,
              COUNT(*) FILTER(WHERE score IS NOT NULL) as reviews_with_score,
              AVG(score) as avg_score
            FROM `{self.project_id}.{self.dataset_id}.reviews`
            """
            
            try:
                reviews_job = self.client.query(reviews_query)
                reviews_stats = list(reviews_job.result())[0]
                validation_results['reviews'] = dict(reviews_stats)
            except NotFound:
                validation_results['reviews'] = {"error": "Table not found"}
            
            # Check curriculum data
            curriculum_query = f"""
            SELECT 
              COUNT(*) as total_curriculum_items,
              COUNT(DISTINCT subject) as unique_subjects,
              COUNT(DISTINCT unit_id) as unique_units,
              COUNT(DISTINCT skill_id) as unique_skills,
              COUNT(DISTINCT subskill_id) as unique_subskills
            FROM `{self.project_id}.{self.dataset_id}.curriculum`
            """
            
            try:
                curriculum_job = self.client.query(curriculum_query)
                curriculum_stats = list(curriculum_job.result())[0]
                validation_results['curriculum'] = dict(curriculum_stats)
            except NotFound:
                validation_results['curriculum'] = {"error": "Table not found"}
            
            # Check learning paths
            paths_query = f"""
            SELECT 
              COUNT(*) as total_paths,
              COUNT(DISTINCT prerequisite_skill_id) as unique_prerequisites,
              COUNT(DISTINCT unlocks_skill_id) as unique_unlocks,
              COUNTIF(is_base_node = TRUE) as base_node_count
            FROM `{self.project_id}.{self.dataset_id}.learning_paths`
            """
            
            try:
                paths_job = self.client.query(paths_query)
                paths_stats = list(paths_job.result())[0]
                validation_results['learning_paths'] = dict(paths_stats)
            except NotFound:
                validation_results['learning_paths'] = {"error": "Table not found"}
            
            # Data quality checks
            quality_issues = []
            
            # Check for orphaned attempts (subskills not in curriculum)
            if 'attempts' in validation_results and 'curriculum' in validation_results:
                if validation_results['attempts'].get('total_attempts', 0) > 0 and validation_results['curriculum'].get('total_curriculum_items', 0) > 0:
                    orphan_query = f"""
                    SELECT COUNT(*) as orphaned_attempts
                    FROM `{self.project_id}.{self.dataset_id}.attempts` a
                    LEFT JOIN `{self.project_id}.{self.dataset_id}.curriculum` c
                      ON a.subskill_id = c.subskill_id
                    WHERE c.subskill_id IS NULL
                    """
                    
                    try:
                        orphan_job = self.client.query(orphan_query)
                        orphaned_count = list(orphan_job.result())[0]['orphaned_attempts']
                        
                        if orphaned_count > 0:
                            quality_issues.append(f"{orphaned_count} attempts reference subskills not in curriculum")
                    except Exception as e:
                        quality_issues.append(f"Could not check orphaned attempts: {e}")
            
            # Check for missing scores in attempts
            if 'attempts' in validation_results and validation_results['attempts'].get('total_attempts', 0) > 0:
                missing_scores_query = f"""
                SELECT COUNT(*) as missing_scores
                FROM `{self.project_id}.{self.dataset_id}.attempts`
                WHERE score IS NULL OR score < 0 OR score > 10
                """
                
                try:
                    missing_job = self.client.query(missing_scores_query)
                    missing_count = list(missing_job.result())[0]['missing_scores']
                    
                    if missing_count > 0:
                        quality_issues.append(f"{missing_count} attempts have invalid scores")
                except Exception as e:
                    quality_issues.append(f"Could not check invalid scores: {e}")
            
            validation_results['quality_issues'] = quality_issues
            validation_results['validation_timestamp'] = datetime.now().isoformat()
            validation_results['overall_status'] = 'healthy' if not quality_issues else 'issues_found'
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating data integrity: {e}")
            return {
                'overall_status': 'validation_failed',
                'error': str(e),
                'validation_timestamp': datetime.now().isoformat()
            }

    async def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status for all tables"""
        
        try:
            status = {}
            
            tables = ['attempts', 'curriculum', 'learning_paths', 'reviews']
            
            for table in tables:
                try:
                    # Get basic table info
                    table_ref = self.client.get_table(f"{self.project_id}.{self.dataset_id}.{table}")
                    
                    # Get row count and last update
                    stats_query = f"""
                    SELECT 
                      COUNT(*) as row_count,
                      MAX(sync_timestamp) as last_sync,
                      MAX(timestamp) as last_data_timestamp
                    FROM `{self.project_id}.{self.dataset_id}.{table}`
                    """
                    
                    stats_job = self.client.query(stats_query)
                    stats = list(stats_job.result())[0]
                    
                    status[table] = {
                        'exists': True,
                        'row_count': stats['row_count'],
                        'last_sync': stats['last_sync'].isoformat() if stats['last_sync'] else None,
                        'last_data_timestamp': stats['last_data_timestamp'].isoformat() if stats['last_data_timestamp'] else None,
                        'table_size_mb': round(table_ref.num_bytes / (1024 * 1024), 2),
                        'created': table_ref.created.isoformat(),
                        'modified': table_ref.modified.isoformat()
                    }
                    
                except NotFound:
                    status[table] = {
                        'exists': False,
                        'error': 'Table not found'
                    }
                except Exception as e:
                    status[table] = {
                        'exists': False,
                        'error': str(e)
                    }
            
            return {
                'tables': status,
                'check_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return {
                'error': str(e),
                'check_timestamp': datetime.now().isoformat()
            }

    async def cleanup_old_data(self, days_to_keep: int = 90) -> Dict[str, Any]:
        """Clean up old sync data to manage costs"""
        
        try:
            cleanup_results = {}
            
            # Remove duplicate attempts (keep latest by sync_timestamp)
            dedup_query = f"""
            CREATE OR REPLACE TABLE `{self.project_id}.{self.dataset_id}.attempts` AS
            SELECT * EXCEPT(row_num)
            FROM (
              SELECT 
                *,
                ROW_NUMBER() OVER (
                  PARTITION BY student_id, subskill_id, timestamp 
                  ORDER BY sync_timestamp DESC
                ) as row_num
              FROM `{self.project_id}.{self.dataset_id}.attempts`
            )
            WHERE row_num = 1
            """
            
            try:
                dedup_job = self.client.query(dedup_query)
                dedup_job.result()
                cleanup_results['attempts_deduplicated'] = True
            except Exception as e:
                cleanup_results['attempts_dedup_error'] = str(e)
            
            # Similar for reviews
            reviews_dedup_query = f"""
            CREATE OR REPLACE TABLE `{self.project_id}.{self.dataset_id}.reviews` AS
            SELECT * EXCEPT(row_num)
            FROM (
              SELECT 
                *,
                ROW_NUMBER() OVER (
                  PARTITION BY review_id 
                  ORDER BY sync_timestamp DESC
                ) as row_num
              FROM `{self.project_id}.{self.dataset_id}.reviews`
            )
            WHERE row_num = 1
            """
            
            try:
                reviews_dedup_job = self.client.query(reviews_dedup_query)
                reviews_dedup_job.result()
                cleanup_results['reviews_deduplicated'] = True
            except Exception as e:
                cleanup_results['reviews_dedup_error'] = str(e)
            
            logger.info(f"Cleanup completed: {cleanup_results}")
            
            return {
                'success': True,
                'cleanup_results': cleanup_results,
                'cleanup_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return {
                'success': False,
                'error': str(e),
                'cleanup_timestamp': datetime.now().isoformat()
            }


# Cloud Function entry point for scheduled ETL
async def scheduled_etl_handler(request):
    """Cloud Function handler for scheduled ETL runs"""
    
    try:
        # Get configuration from settings
        if not settings.GCP_PROJECT_ID:
            return {'error': 'GCP_PROJECT_ID not configured'}, 400
        
        # Initialize ETL service
        etl_service = BigQueryETLService()
        
        # Parse request to determine sync type
        request_json = request.get_json(silent=True) or {}
        sync_type = request_json.get('sync_type', 'incremental')
        test_mode = request_json.get('test_mode', False)
        
        if sync_type == 'full':
            result = await etl_service.run_full_sync(test_mode=test_mode)
        else:
            # Run incremental sync
            results = {}
            results['attempts'] = await etl_service.sync_attempts_from_cosmos(incremental=True)
            results['reviews'] = await etl_service.sync_reviews_from_cosmos(incremental=True)
            
            total_records = sum(r.get('records_processed', 0) for r in results.values())
            success_count = sum(1 for r in results.values() if r.get('success', False))
            
            result = {
                'success': success_count == len(results),
                'total_records_processed': total_records,
                'results': results,
                'sync_type': 'incremental'
            }
        
        return result
        
    except Exception as e:
        logger.error(f"Error in scheduled ETL: {e}")
        return {'error': str(e)}, 500


# Standalone test functions for development
async def test_etl_service():
    """Test function for development"""
    
    logger.info("🧪 Starting ETL Service Test")
    
    try:
        # Initialize service
        etl_service = BigQueryETLService()
        
        # Test connections
        connection_results = await etl_service.test_connections()
        logger.info(f"Connection test results: {connection_results}")
        
        if not connection_results['bigquery']:
            logger.error("BigQuery connection failed - aborting test")
            return
        
        if not connection_results['cosmos_db']:
            logger.error("Cosmos DB connection failed - aborting test")
            return
        
        # Run a small test sync
        logger.info("Running test sync with limited data...")
        test_results = await etl_service.run_full_sync(test_mode=True)
        
        logger.info(f"Test sync results: {test_results}")
        
        # Validate data
        validation_results = await etl_service.validate_data_integrity()
        logger.info(f"Validation results: {validation_results}")
        
        # Get sync status
        status_results = await etl_service.get_sync_status()
        logger.info(f"Sync status: {status_results}")
        
        logger.info("🎉 ETL Service test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ ETL Service test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Run test
    asyncio.run(test_etl_service())