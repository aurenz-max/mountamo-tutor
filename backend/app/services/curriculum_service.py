# backend/app/services/curriculum_service.py - STREAMLINED BIGQUERY VERSION

import logging
import pandas as pd
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from io import BytesIO

from app.db.blob_storage import BlobStorageService
from app.services.bigquery_analytics import BigQueryAnalyticsService
from app.core.config import settings

logger = logging.getLogger(__name__)

class CurriculumService:
    """Streamlined curriculum service using BigQuery for data and blob storage for file management"""
    
    def __init__(self, bigquery_service: BigQueryAnalyticsService, blob_service: Optional[BlobStorageService] = None):
        self.bigquery_service = bigquery_service
        self.blob_service = blob_service
        
        # Simple cache with TTL
        self._cache = {}
        self._cache_timestamps = {}
        
    async def initialize(self) -> bool:
        """Initialize the curriculum service"""
        try:
            # Initialize BigQuery (required)
            if not await self.bigquery_service.initialize():
                raise Exception("BigQuery service initialization failed")
            
            # Initialize blob service (optional, for file management)
            if self.blob_service and not getattr(self.blob_service, '_initialized', False):
                await self.blob_service.initialize()
            
            logger.info("✅ CURRICULUM_SERVICE: Initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ CURRICULUM_SERVICE: Initialization failed: {str(e)}")
            raise
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[cache_key]
        current_time = datetime.now(timezone.utc)
        cache_ttl_seconds = getattr(settings, 'CURRICULUM_CACHE_TTL_MINUTES', 60) * 60
        return (current_time - cache_time).total_seconds() < cache_ttl_seconds
    
    async def get_available_subjects(self) -> List[str]:
        """Get list of all available subjects from BigQuery"""
        cache_key = "available_subjects"
        
        # Check cache
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        query = f"""
        SELECT DISTINCT subject
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subject IS NOT NULL AND subject != ''
        ORDER BY subject
        """
        
        results = await self.bigquery_service._run_query_async(query)
        subjects = [row['subject'] for row in results]
        
        # Cache the result
        self._cache[cache_key] = subjects
        self._cache_timestamps[cache_key] = datetime.now(timezone.utc)
        
        return subjects
    
    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get curriculum data from BigQuery"""
        cache_key = f"curriculum_{subject.lower()}"
        
        # Check cache
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            return self._cache[cache_key]
        
        query = f"""
        SELECT 
            subject,
            grade,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            difficulty_start,
            difficulty_end,
            target_difficulty
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subject = @subject
        ORDER BY unit_id, skill_id, subskill_id
        """
        
        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]
        
        results = await self.bigquery_service._run_query_async(query, parameters)
        structured_curriculum = self._structure_curriculum_data(results)
        
        # Cache the result
        self._cache[cache_key] = structured_curriculum
        self._cache_timestamps[cache_key] = datetime.now(timezone.utc)
        
        return structured_curriculum
    
    def _structure_curriculum_data(self, flat_data: List[Dict]) -> List[Dict]:
        """Convert BigQuery results to hierarchical curriculum structure"""
        structured = []
        current_unit = None
        current_skill = None
        
        for row in flat_data:
            # Add unit
            if not current_unit or current_unit["id"] != row["unit_id"]:
                current_unit = {
                    "id": row["unit_id"],
                    "title": row["unit_title"],
                    "grade": row.get("grade"),
                    "subject": row["subject"],
                    "skills": []
                }
                structured.append(current_unit)
            
            # Add skill
            if not current_skill or current_skill["id"] != row["skill_id"]:
                current_skill = {
                    "id": row["skill_id"],
                    "description": row["skill_description"],
                    "subskills": []
                }
                current_unit["skills"].append(current_skill)
            
            # Add subskill
            current_skill["subskills"].append({
                "id": row["subskill_id"],
                "description": row["subskill_description"],
                "difficulty_range": {
                    "start": row.get("difficulty_start"),
                    "end": row.get("difficulty_end"),
                    "target": row.get("target_difficulty")
                }
            })
        
        return structured
    
    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all subskills for a subject from BigQuery"""
        query = f"""
        SELECT DISTINCT subskill_id
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        WHERE subject = @subject
        ORDER BY subskill_id
        """
        
        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]
        
        results = await self.bigquery_service._run_query_async(query, parameters)
        return [row['subskill_id'] for row in results]
    
    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> Dict[str, Any]:
        """Get detailed objectives from BigQuery"""
        try:
            query = f"""
            SELECT 
                concept_group,
                detailed_objective,
                subskill_description
            FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.detailed_objectives`
            WHERE subskill_id = @subskill_id
            """
            
            from google.cloud import bigquery
            parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]
            
            results = await self.bigquery_service._run_query_async(query, parameters)
            
            if results:
                objective = random.choice(results)
                return {
                    'ConceptGroup': objective.get('concept_group', f'{subject} Skills'),
                    'DetailedObjective': objective.get('detailed_objective'),
                    'SubskillDescription': objective.get('subskill_description')
                }
            else:
                # Return default if no detailed objectives found
                return {
                    'ConceptGroup': f'{subject} Skills',
                    'DetailedObjective': f'Develop proficiency in {subskill_id}',
                    'SubskillDescription': f'Practice and master {subskill_id} concepts'
                }
                
        except Exception as e:
            logger.warning(f"Error getting detailed objectives, using default: {str(e)}")
            return {
                'ConceptGroup': f'{subject} Skills',
                'DetailedObjective': f'Develop proficiency in {subskill_id}',
                'SubskillDescription': f'Practice and master {subskill_id} concepts'
            }
    
    async def get_curriculum_stats(self, subject: Optional[str] = None) -> Dict[str, Any]:
        """Get curriculum statistics from BigQuery"""
        where_clause = "WHERE subject = @subject" if subject else ""
        
        query = f"""
        SELECT 
            subject,
            COUNT(DISTINCT unit_id) as total_units,
            COUNT(DISTINCT skill_id) as total_skills,
            COUNT(DISTINCT subskill_id) as total_subskills,
            AVG(target_difficulty) as avg_target_difficulty,
            MIN(difficulty_start) as min_difficulty,
            MAX(difficulty_end) as max_difficulty
        FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
        {where_clause}
        GROUP BY subject
        ORDER BY subject
        """
        
        parameters = []
        if subject:
            from google.cloud import bigquery
            parameters = [bigquery.ScalarQueryParameter("subject", "STRING", subject)]
        
        results = await self.bigquery_service._run_query_async(query, parameters)
        
        if subject and results:
            return results[0]
        else:
            return {"subjects": results}
    
    async def health_check(self) -> Dict[str, Any]:
        """Check curriculum service health"""
        try:
            # Test BigQuery connectivity
            bq_health = await self.bigquery_service.health_check()
            
            # Test curriculum table access
            test_query = f"""
            SELECT COUNT(*) as total_records
            FROM `{self.bigquery_service.project_id}.{self.bigquery_service.dataset_id}.curriculum`
            LIMIT 1
            """
            
            await self.bigquery_service._run_query_async(test_query)
            
            return {
                "status": "healthy",
                "mode": "bigquery",
                "bigquery_service": bq_health,
                "blob_storage_available": self.blob_service is not None,
                "cache_size": len(self._cache),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    # FILE MANAGEMENT METHODS (if blob storage is available)
    async def upload_curriculum_csv(self, subject: str, csv_content: bytes, file_type: str = "syllabus") -> Dict[str, Any]:
        """Upload curriculum CSV to blob storage"""
        if not self.blob_service:
            return {"success": False, "error": "Blob storage not available"}
        
        try:
            # Parse CSV to validate
            df = pd.read_csv(BytesIO(csv_content))
            
            blob_name = f"curriculum/{subject.lower()}/{file_type}.csv"
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            
            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)
            blob_client = container_client.get_blob_client(blob_name)
            
            # Upload with metadata
            blob_client.upload_blob(
                csv_content, 
                overwrite=True,
                metadata={
                    "subject": subject,
                    "file_type": file_type,
                    "row_count": str(len(df)),
                    "upload_timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            # Clear cache
            self.clear_cache()
            
            return {
                "success": True,
                "blob_name": blob_name,
                "row_count": len(df),
                "columns": list(df.columns)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def download_curriculum_csv(self, subject: str, file_type: str = "syllabus") -> Optional[pd.DataFrame]:
        """Download curriculum CSV from blob storage"""
        if not self.blob_service:
            return None
            
        try:
            blob_name = f"curriculum/{subject.lower()}/{file_type}.csv"
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            
            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)
            blob_client = container_client.get_blob_client(blob_name)
            
            blob_data = blob_client.download_blob().readall()
            return pd.read_csv(BytesIO(blob_data))
            
        except Exception as e:
            logger.warning(f"Failed to download curriculum CSV {blob_name}: {str(e)}")
            return None
    
    async def list_curriculum_files(self) -> Dict[str, Any]:
        """List curriculum files in blob storage"""
        if not self.blob_service:
            return {"success": False, "error": "Blob service not available", "files": []}
        
        try:
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            container_client = self.blob_service.blob_service_client.get_container_client(curriculum_container)
            
            files = []
            for blob in container_client.list_blobs(name_starts_with="curriculum/"):
                try:
                    blob_client = container_client.get_blob_client(blob.name)
                    properties = blob_client.get_blob_properties()
                    
                    files.append({
                        "name": blob.name,
                        "size": blob.size,
                        "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
                        "subject": properties.metadata.get("subject", "unknown"),
                        "file_type": properties.metadata.get("file_type", "unknown"),
                        "row_count": properties.metadata.get("row_count", "unknown")
                    })
                except Exception as e:
                    logger.warning(f"Could not get properties for {blob.name}: {e}")
            
            return {"success": True, "files": files, "total_count": len(files)}
            
        except Exception as e:
            return {"success": False, "error": str(e), "files": []}
    
    def clear_cache(self):
        """Clear all cached data"""
        self._cache.clear()
        self._cache_timestamps.clear()