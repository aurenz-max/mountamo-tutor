# backend/app/services/curriculum_service.py

import logging
import pandas as pd
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from io import BytesIO

from app.db.blob_storage import BlobStorageService
from app.core.config import settings

logger = logging.getLogger(__name__)

class CurriculumService:
    """Service for managing curriculum data using Azure Blob Storage"""
    
    def __init__(self, blob_service: BlobStorageService):
        self.blob_service = blob_service
        
        # In-memory cache to avoid repeated blob downloads
        self._curriculum_cache = {}
        self._objectives_cache = {}
        self._cache_timestamps = {}
        
    async def initialize(self) -> bool:
        """Initialize the curriculum service"""
        try:
            # Ensure blob service is initialized
            if not self.blob_service._initialized:
                await self.blob_service.initialize()
            
            logger.info("CurriculumService initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize CurriculumService: {str(e)}")
            return False
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[cache_key]
        current_time = datetime.now(timezone.utc)
        cache_ttl_seconds = getattr(settings, 'CURRICULUM_CACHE_TTL_MINUTES', 60) * 60
        return (current_time - cache_time).total_seconds() < cache_ttl_seconds
    
    def _get_curriculum_blob_name(self, subject: str, file_type: str) -> str:
        """Generate blob name for curriculum files"""
        return f"curriculum/{subject.lower()}/{file_type}.csv"
    
    async def upload_curriculum_csv(self, subject: str, csv_content: bytes, file_type: str = "syllabus") -> Dict[str, Any]:
        """Upload curriculum CSV to blob storage"""
        try:
            # Validate CSV structure first
            df = pd.read_csv(BytesIO(csv_content))
            
            # Validate required columns based on file type
            if file_type == "syllabus":
                required_columns = [
                    'Subject', 'UnitID', 'UnitTitle', 'SkillID', 
                    'SkillDescription', 'SubskillID', 'SubskillDescription',
                    'DifficultyStart', 'DifficultyEnd', 'TargetDifficulty'
                ]
            elif file_type == "detailed_objectives":
                required_columns = [
                    'Subject', 'SubskillID', 'SubskillDescription', 
                    'ConceptGroup', 'DetailedObjective'
                ]
            else:
                raise ValueError(f"Unknown file type: {file_type}")
            
            missing_columns = set(required_columns) - set(df.columns)
            if missing_columns:
                return {
                    "success": False,
                    "error": f"Missing required columns: {missing_columns}",
                    "blob_name": None
                }
            
            # Get the curriculum container name
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            
            # Use blob storage client directly for curriculum container
            container_client = self.blob_service.blob_service_client.get_container_client(
                curriculum_container
            )
            
            blob_name = self._get_curriculum_blob_name(subject, file_type)
            blob_client = container_client.get_blob_client(blob_name)
            
            # Upload with metadata
            from azure.storage.blob import ContentSettings
            blob_client.upload_blob(
                data=csv_content,
                overwrite=True,
                content_settings=ContentSettings(
                    content_type='text/csv',
                    cache_control=getattr(settings, 'BLOB_STORAGE_CACHE_CONTROL', 'max-age=3600')
                ),
                metadata={
                    'subject': subject,
                    'file_type': file_type,
                    'upload_timestamp': datetime.now(timezone.utc).isoformat(),
                    'row_count': str(len(df)),
                    'version': '1.0'
                }
            )
            
            # Invalidate cache for this subject
            self._invalidate_cache(subject)
            
            logger.info(f"Uploaded {file_type} curriculum for {subject}: {blob_name}")
            
            return {
                "success": True,
                "blob_name": blob_name,
                "blob_url": blob_client.url,
                "row_count": len(df),
                "subject": subject,
                "file_type": file_type
            }
            
        except Exception as e:
            logger.error(f"Failed to upload curriculum CSV: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "blob_name": None
            }
    
    async def download_curriculum_csv(self, subject: str, file_type: str = "syllabus") -> Optional[pd.DataFrame]:
        """Download and parse curriculum CSV from blob storage"""
        try:
            blob_name = self._get_curriculum_blob_name(subject, file_type)
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            
            container_client = self.blob_service.blob_service_client.get_container_client(
                curriculum_container
            )
            blob_client = container_client.get_blob_client(blob_name)
            
            # Download blob content
            blob_data = blob_client.download_blob().readall()
            
            # Parse CSV
            df = pd.read_csv(BytesIO(blob_data))
            
            logger.info(f"Downloaded {file_type} curriculum for {subject}: {len(df)} rows")
            return df
            
        except Exception as e:
            logger.warning(f"Failed to download curriculum CSV {blob_name}: {str(e)}")
            return None
    
    async def get_curriculum(self, subject: str) -> List[Dict]:
        """Get curriculum data with in-memory caching"""
        cache_key = f"curriculum_{subject.lower()}"
        
        # Check cache first
        if cache_key in self._curriculum_cache and self._is_cache_valid(cache_key):
            logger.debug(f"Using cached curriculum data for {subject}")
            return self._curriculum_cache[cache_key]
        
        try:
            # Download and process curriculum
            syllabus_df = await self.download_curriculum_csv(subject, "syllabus")
            if syllabus_df is None:
                logger.warning(f"No syllabus data found for {subject}")
                return []
            
            # Structure the curriculum data
            structured_curriculum = self._structure_curriculum_data(syllabus_df)
            
            # Cache the result
            self._curriculum_cache[cache_key] = structured_curriculum
            self._cache_timestamps[cache_key] = datetime.now(timezone.utc)
            
            logger.info(f"Loaded and cached curriculum for {subject}: {len(structured_curriculum)} units")
            return structured_curriculum
            
        except Exception as e:
            logger.error(f"Failed to get curriculum for {subject}: {str(e)}")
            return []
    
    def _structure_curriculum_data(self, df: pd.DataFrame) -> List[Dict]:
        """Convert flat CSV data to hierarchical structure"""
        structured = []
        current_unit = None
        current_skill = None
        
        for _, row in df.sort_values(["UnitID", "SkillID", "SubskillID"]).iterrows():
            # Add unit
            if not current_unit or current_unit["id"] != row["UnitID"]:
                current_unit = {
                    "id": row["UnitID"],
                    "title": row["UnitTitle"],
                    "skills": []
                }
                structured.append(current_unit)
            
            # Add skill
            if not current_skill or current_skill["id"] != row["SkillID"]:
                current_skill = {
                    "id": row["SkillID"],
                    "description": row["SkillDescription"],
                    "subskills": []
                }
                current_unit["skills"].append(current_skill)
            
            # Add subskill
            current_skill["subskills"].append({
                "id": row["SubskillID"],
                "description": row["SubskillDescription"],
                "difficulty_range": {
                    "start": row["DifficultyStart"],
                    "end": row["DifficultyEnd"],
                    "target": row["TargetDifficulty"]
                }
            })
        
        return structured
    
    async def get_detailed_objectives(self, subject: str, subskill_id: str) -> Dict[str, Any]:
        """Get detailed objectives for a specific subskill"""
        cache_key = f"objectives_{subject.lower()}"
        
        # Check cache first
        if cache_key not in self._objectives_cache or not self._is_cache_valid(cache_key):
            # Load objectives from blob
            try:
                objectives_df = await self.download_curriculum_csv(subject, "detailed_objectives")
                if objectives_df is None:
                    logger.warning(f"No detailed objectives found for {subject}")
                    return self._get_default_objective()
                
                # Process objectives into dictionary
                objectives_dict = {}
                for _, row in objectives_df.iterrows():
                    subskill = row["SubskillID"]
                    if subskill not in objectives_dict:
                        objectives_dict[subskill] = []
                    
                    objectives_dict[subskill].append({
                        'ConceptGroup': row['ConceptGroup'],
                        'DetailedObjective': row['DetailedObjective'],
                        'SubskillDescription': row['SubskillDescription']
                    })
                
                # Cache the results
                self._objectives_cache[cache_key] = objectives_dict
                self._cache_timestamps[cache_key] = datetime.now(timezone.utc)
                
            except Exception as e:
                logger.error(f"Failed to load objectives for {subject}: {str(e)}")
                return self._get_default_objective()
        
        # Get objectives for the specific subskill
        objectives_dict = self._objectives_cache.get(cache_key, {})
        
        if subskill_id in objectives_dict:
            return random.choice(objectives_dict[subskill_id])
        
        logger.warning(f"No objectives found for {subject}/{subskill_id}")
        return self._get_default_objective()
    
    async def get_all_objectives(self, subject: str, subskill_id: str) -> List[Dict]:
        """Get ALL detailed objectives for a subskill"""
        cache_key = f"objectives_{subject.lower()}"
        
        # Ensure objectives are loaded
        if cache_key not in self._objectives_cache or not self._is_cache_valid(cache_key):
            await self.get_detailed_objectives(subject, subskill_id)  # This will load and cache
        
        objectives_dict = self._objectives_cache.get(cache_key, {})
        return objectives_dict.get(subskill_id, [])
    
    def _get_default_objective(self) -> Dict[str, str]:
        """Return default objective when none found"""
        return {
            'ConceptGroup': 'General',
            'DetailedObjective': 'Develop core skills',
            'SubskillDescription': 'General skill development'
        }
    
    async def get_available_subjects(self) -> List[str]:
        """Get list of all available subjects from blob storage"""
        try:
            files_result = await self.list_curriculum_files()
            if not files_result["success"]:
                return []
            
            # Extract unique subjects from curriculum files
            subjects = set()
            for file_info in files_result["files"]:
                subject = file_info.get("subject", "").title()
                if subject and subject != "unknown":
                    subjects.add(subject)
            
            return sorted(list(subjects))
            
        except Exception as e:
            logger.error(f"Error getting available subjects: {str(e)}")
            return []
    
    async def get_subskill_types(self, subject: str) -> List[str]:
        """Get list of all problem types (subskills) available"""
        try:
            curriculum = await self.get_curriculum(subject)
            return [
                subskill["id"]
                for unit in curriculum
                for skill in unit["skills"]
                for subskill in skill["subskills"]
            ]
        except Exception as e:
            logger.error(f"Error getting subskill types: {str(e)}")
            return []
    
    def _invalidate_cache(self, subject: str):
        """Invalidate cache for a specific subject"""
        cache_keys_to_remove = [
            f"curriculum_{subject.lower()}",
            f"objectives_{subject.lower()}"
        ]
        
        for key in cache_keys_to_remove:
            if key in self._curriculum_cache:
                del self._curriculum_cache[key]
            if key in self._objectives_cache:
                del self._objectives_cache[key]
            if key in self._cache_timestamps:
                del self._cache_timestamps[key]
        
        logger.info(f"Invalidated cache for {subject}")
    
    async def list_curriculum_files(self) -> Dict[str, Any]:
        """List all curriculum files in blob storage"""
        try:
            curriculum_container = getattr(settings, 'CURRICULUM_CONTAINER_NAME', 'curriculum-data')
            container_client = self.blob_service.blob_service_client.get_container_client(
                curriculum_container
            )
            
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
                        "row_count": properties.metadata.get("row_count", "unknown"),
                        "url": blob_client.url
                    })
                except Exception as e:
                    logger.warning(f"Could not get properties for {blob.name}: {e}")
            
            return {
                "success": True,
                "files": files,
                "total_count": len(files)
            }
            
        except Exception as e:
            logger.error(f"Failed to list curriculum files: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files": []
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check curriculum service health"""
        try:
            # Check blob storage connection
            blob_health = await self.blob_service.health_check()
            
            # Check if we can list curriculum files
            files_result = await self.list_curriculum_files()
            
            return {
                "status": "healthy" if blob_health["status"] == "healthy" and files_result["success"] else "unhealthy",
                "blob_storage": blob_health,
                "curriculum_files_accessible": files_result["success"],
                "curriculum_file_count": files_result.get("total_count", 0),
                "cache_size": {
                    "curriculum_items": len(self._curriculum_cache),
                    "objectives_items": len(self._objectives_cache)
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    # Additional utility methods for curriculum management
    
    async def refresh_curriculum_cache(self, subject: str = None) -> Dict[str, Any]:
        """Manually refresh curriculum cache for a subject or all subjects"""
        try:
            if subject:
                # Refresh cache for specific subject
                self._invalidate_cache(subject)
                curriculum = await self.get_curriculum(subject)
                objectives = await self.get_detailed_objectives(subject, "dummy")  # This loads the objectives cache
                
                return {
                    "success": True,
                    "subject": subject,
                    "curriculum_units": len(curriculum),
                    "message": f"Cache refreshed for {subject}"
                }
            else:
                # Refresh cache for all subjects
                subjects = await self.get_available_subjects()
                results = []
                
                for subj in subjects:
                    self._invalidate_cache(subj)
                    curriculum = await self.get_curriculum(subj)
                    results.append({
                        "subject": subj,
                        "curriculum_units": len(curriculum)
                    })
                
                return {
                    "success": True,
                    "subjects_refreshed": len(subjects),
                    "results": results,
                    "message": "Cache refreshed for all subjects"
                }
                
        except Exception as e:
            logger.error(f"Failed to refresh curriculum cache: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_curriculum_stats(self) -> Dict[str, Any]:
        """Get statistics about the curriculum data"""
        try:
            subjects = await self.get_available_subjects()
            stats = {
                "total_subjects": len(subjects),
                "subjects": []
            }
            
            for subject in subjects:
                curriculum = await self.get_curriculum(subject)
                subskills = await self.get_subskill_types(subject)
                
                subject_stats = {
                    "subject": subject,
                    "units": len(curriculum),
                    "total_skills": sum(len(unit["skills"]) for unit in curriculum),
                    "total_subskills": len(subskills)
                }
                
                stats["subjects"].append(subject_stats)
            
            return {
                "success": True,
                "stats": stats
            }
            
        except Exception as e:
            logger.error(f"Failed to get curriculum stats: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }