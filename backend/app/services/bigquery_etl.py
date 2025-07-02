# services/bigquery_etl.py

import asyncio
import logging
import json
import os
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
            
            # Determine sync strategy
            if incremental:
                last_sync_time = await self._get_last_sync_timestamp("attempts")
                logger.info(f"Incremental sync from {last_sync_time}")
            else:
                last_sync_time = None
                logger.info("Full sync of all attempts")
            
            # Fetch data from Cosmos DB
            attempts = await self._fetch_attempts_from_cosmos(cosmos_db, last_sync_time, limit)
            
            if not attempts:
                logger.info("No new attempts to sync")
                return {"success": True, "records_processed": 0, "message": "No new data"}
            
            logger.info(f"Fetched {len(attempts)} attempts from Cosmos DB")
            
            # Transform data for BigQuery
            transformed_attempts = self._transform_attempts_data(attempts)
            
            if not transformed_attempts:
                logger.warning("No valid attempts after transformation")
                return {"success": True, "records_processed": 0, "message": "No valid data after transformation"}
            
            # Ensure table exists
            await self._ensure_table_exists("attempts", self._get_attempts_schema())
            
            # Load to BigQuery
            table_id = f"{self.project_id}.{self.dataset_id}.attempts"
            total_loaded = await self._load_data_to_bigquery(transformed_attempts, table_id, "attempts")
            
            # Update sync timestamp
            await self._update_sync_timestamp("attempts")
            
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
            
            # Similar to attempts sync but for reviews
            if incremental:
                last_sync_time = await self._get_last_sync_timestamp("reviews")
            else:
                last_sync_time = None
            
            # Fetch reviews from Cosmos DB
            reviews = await self._fetch_reviews_from_cosmos(cosmos_db, last_sync_time, limit)
            
            if not reviews:
                logger.info("No new reviews to sync")
                return {"success": True, "records_processed": 0, "message": "No new data"}
            
            logger.info(f"Fetched {len(reviews)} reviews from Cosmos DB")
            
            # Transform data
            transformed_reviews = self._transform_reviews_data(reviews)
            
            if not transformed_reviews:
                logger.warning("No valid reviews after transformation")
                return {"success": True, "records_processed": 0, "message": "No valid data after transformation"}
            
            # Ensure table exists
            await self._ensure_table_exists("reviews", self._get_reviews_schema())
            
            # Load to BigQuery
            table_id = f"{self.project_id}.{self.dataset_id}.reviews"
            total_loaded = await self._load_data_to_bigquery(transformed_reviews, table_id, "reviews")
            
            await self._update_sync_timestamp("reviews")
            
            return {
                "success": True,
                "records_processed": total_loaded,
                "table": table_id
            }
            
        except Exception as e:
            logger.error(f"Error syncing reviews: {e}")
            return {"success": False, "error": str(e)}

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
                
                # Extract problem and feedback text
                problem_text = None
                answer_text = None
                if 'problem_content' in review and isinstance(review['problem_content'], dict):
                    problem_content = review['problem_content']
                    problem_text = problem_content.get('problem')
                    answer_text = problem_content.get('answer')
                
                feedback_praise = None
                feedback_guidance = None
                if 'full_review' in review and isinstance(review['full_review'], dict) and 'feedback' in review['full_review']:
                    feedback = review['full_review']['feedback']
                    if isinstance(feedback, dict):
                        feedback_praise = feedback.get('praise')
                        feedback_guidance = feedback.get('guidance')
                
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
                    'problem_text': problem_text,
                    'answer_text': answer_text,
                    'feedback_praise': feedback_praise,
                    'feedback_guidance': feedback_guidance,
                    'sync_timestamp': datetime.now().isoformat(),
                    'cosmos_ts': review.get('_ts', 0)
                }
                
                transformed.append(transformed_record)
                
            except Exception as e:
                logger.error(f"Error transforming review {review.get('id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Transformed {len(transformed)}/{len(reviews)} reviews successfully")
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
        """Load data to BigQuery in batches"""
        
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

    async def _ensure_table_exists(self, table_name: str, schema: List[bigquery.SchemaField]):
        """Ensure BigQuery table exists with proper schema"""
        
        table_id = f"{self.project_id}.{self.dataset_id}.{table_name}"
        
        try:
            # Try to get the table
            self.client.get_table(table_id)
            logger.info(f"Table {table_name} already exists")
        except NotFound:
            # Create the table
            table = bigquery.Table(table_id, schema=schema)
            table = self.client.create_table(table)
            logger.info(f"Created table {table_name}")
        except Exception as e:
            logger.error(f"Error ensuring table {table_name} exists: {e}")
            raise

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
            bigquery.SchemaField("problem_text", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("answer_text", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("feedback_praise", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("feedback_guidance", "STRING", mode="NULLABLE"),
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