# app/services/learning_paths.py

from typing import List, Dict, Any, Optional
import json
from pathlib import Path
from datetime import datetime, timezone
from io import BytesIO
import logging

from ..core.config import settings
from .competency import CompetencyService

try:
    from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient, ContentSettings
    from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError
except ImportError:
    print("Warning: Azure Storage Blob library not installed")

logger = logging.getLogger(__name__)

class LearningPathsService:
    def __init__(self, competency_service: Optional[CompetencyService] = None):
        self.competency_service = competency_service or CompetencyService()
        
        # Cloud storage configuration
        self.azure_connection_string = getattr(settings, 'AZURE_STORAGE_CONNECTION_STRING', '')
        self.container_name = getattr(settings, 'LEARNING_PATHS_CONTAINER_NAME', 'learning-paths-data')
        
        # Initialize cloud storage clients
        self.blob_service_client = None
        self.container_client = None
        self._cache = {}  # Cache for decision tree data
        
        # Competency thresholds
        self.MASTERY_THRESHOLD = 0.8  # 80% competency
        self.CREDIBILITY_THRESHOLD = 0.6  # 60% credibility
        
        # Single file paths (no subject dependency)
        self.DECISION_TREE_BLOB_PATH = "learning_paths/decision_tree.json"
        self.METADATA_BLOB_PATH = "learning_paths/metadata.json"
        
        # Initialize blob storage
        self._initialize_blob_storage()

    def _initialize_blob_storage(self):
        """Initialize Azure Blob Storage connection"""
        logger.info(f"Initializing blob storage...")
        logger.info(f"Connection string configured: {'Yes' if self.azure_connection_string else 'No'}")
        logger.info(f"Container name: {self.container_name}")
        
        if not self.azure_connection_string:
            logger.warning("Azure Storage connection string not configured - learning paths will not work")
            return
            
        try:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                self.azure_connection_string
            )
            self.container_client = self.blob_service_client.get_container_client(
                container=self.container_name
            )
            logger.info(f"✅ Successfully initialized blob storage for container: {self.container_name}")
            
            # Test the connection
            try:
                container_props = self.container_client.get_container_properties()
                logger.info(f"✅ Container connection test successful")
            except Exception as test_e:
                logger.error(f"❌ Container connection test failed: {str(test_e)}")
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize blob storage: {str(e)}")
            logger.error(f"Check your AZURE_STORAGE_CONNECTION_STRING and container name")

    async def load_decision_tree_data(self) -> Dict[str, List[str]]:
        """Load decision tree data from cloud storage"""
        logger.info(f"Loading decision tree data")
        cache_key = "decision_tree"
        
        # Check cache first
        if cache_key in self._cache:
            logger.info(f"✅ Found cached decision tree data")
            return self._cache[cache_key]
        
        if not self.container_client:
            logger.error("❌ Container client not initialized - cannot load decision tree data")
            return {}
        
        try:
            blob_name = self.DECISION_TREE_BLOB_PATH
            logger.info(f"Attempting to load blob: {blob_name}")
            
            blob_client = self.container_client.get_blob_client(blob_name)
            
            # Download blob content
            logger.info(f"Downloading blob content...")
            blob_data = blob_client.download_blob().readall()
            data = json.loads(blob_data.decode('utf-8'))
            
            # Extract decision tree data
            decision_tree_data = data.get("learning_path_decision_tree", {})
            
            # Cache the data
            self._cache[cache_key] = decision_tree_data
            
            logger.info(f"✅ Successfully loaded decision tree with {len(decision_tree_data)} skills")
            return decision_tree_data
            
        except ResourceNotFoundError:
            logger.warning(f"⚠️  Learning paths not found at blob: {blob_name}")
            return {}
        except Exception as e:
            logger.error(f"❌ Error loading decision tree data: {str(e)}")
            logger.error(f"Blob path attempted: {blob_name}")
            raise

    async def get_next_recommendations(
        self,
        student_id: int,
        current_skill_id: Optional[str] = None,
        current_subskill_id: Optional[str] = None,
        subject: Optional[str] = None  # Keep for backward compatibility but ignore
    ) -> Dict[str, Any]:
        """Get recommended next skills based on current progress and learning paths"""
        try:
            decision_tree = await self.load_decision_tree_data()
            
            if not decision_tree:
                raise ValueError("No learning paths found")
            
            # If no current skill provided, start with the root skill
            if not current_skill_id:
                # Find the first skill (typically the root)
                root_skills = [skill for skill in decision_tree.keys() 
                             if not any(skill in next_skills for next_skills in decision_tree.values())]
                
                return {
                    "current_skill": None,
                    "recommended_skills": root_skills[:1] if root_skills else list(decision_tree.keys())[:1],
                    "rationale": "Starting with foundational skills"
                }

            # Get current skill competency
            # Use the subject if skill follows subject pattern (e.g., MATH001-01), otherwise use general
            skill_subject = self._extract_subject_from_skill_id(current_skill_id) if subject is None else subject
            
            current_competency = await self.competency_service.get_competency(
                student_id=student_id,
                subject=skill_subject or "General",
                skill_id=current_skill_id,
                subskill_id=current_subskill_id or ""
            )

            logger.info(f"Current competency for {current_skill_id}: {current_competency}")

            # Check if current skill is mastered
            is_mastered = (
                current_competency["current_score"] >= self.MASTERY_THRESHOLD and
                current_competency["credibility"] >= self.CREDIBILITY_THRESHOLD
            )

            if not is_mastered:
                return {
                    "current_skill": current_skill_id,
                    "recommended_skills": [current_skill_id],
                    "rationale": "Current skill needs more practice to achieve mastery",
                    "competency_data": current_competency
                }

            # Get possible next skills from decision tree
            next_skills = decision_tree.get(current_skill_id, [])
            
            if not next_skills:
                return {
                    "current_skill": current_skill_id,
                    "recommended_skills": [],
                    "rationale": "No further skills in current learning path",
                    "competency_data": current_competency
                }

            # Filter and rank next skills based on prerequisites and competencies
            ranked_skills = await self._rank_next_skills(
                student_id=student_id,
                next_skills=next_skills
            )

            return {
                "current_skill": current_skill_id,
                "recommended_skills": ranked_skills,
                "rationale": "Skills recommended based on current mastery and learning path",
                "competency_data": current_competency
            }

        except Exception as e:
            logger.error(f"Error getting next recommendations: {str(e)}")
            raise

    def _extract_subject_from_skill_id(self, skill_id: str) -> Optional[str]:
        """Extract subject from skill ID pattern like COUNT001-01 -> Mathematics"""
        if not skill_id:
            return None
            
        # Common skill prefix to subject mappings
        prefix_mappings = {
            'COUNT': 'Mathematics',
            'OPS': 'Mathematics', 
            'MEAS': 'Mathematics',
            'PTRN': 'Mathematics',
            'TIME': 'Mathematics',
            'SCI': 'Science',
            'SS': 'Social Studies',
            'LA': 'Language Arts',
            'ART': 'Art'
        }
        
        # Extract prefix before first number
        import re
        match = re.match(r'^([A-Z]+)', skill_id)
        if match:
            prefix = match.group(1)
            return prefix_mappings.get(prefix, "General")
        
        return "General"

    async def _rank_next_skills(
        self,
        student_id: int,
        next_skills: List[str]
    ) -> List[str]:
        """Rank next skills based on prerequisites and existing competencies"""
        try:
            skill_scores = []
            
            for skill_id in next_skills:
                # Extract subject for this skill
                subject = self._extract_subject_from_skill_id(skill_id)
                
                # Get competency for this skill
                competency = await self.competency_service.get_competency(
                    student_id=student_id,
                    subject=subject or "General",
                    skill_id=skill_id,
                    subskill_id=""  # Empty string for skill-level competency
                )
                
                # Calculate a score for this skill
                # Lower scores are better (we want skills with low existing competency)
                score = competency["current_score"] if competency["credibility"] > 0.2 else 0
                
                skill_scores.append((skill_id, score))
            
            # Sort skills by score (ascending)
            sorted_skills = sorted(skill_scores, key=lambda x: x[1])
            
            # Return just the skill IDs in ranked order
            return [skill[0] for skill in sorted_skills]
            
        except Exception as e:
            logger.error(f"Error ranking next skills: {str(e)}")
            raise

    async def get_skill_prerequisites(self, skill_id: str) -> List[str]:
        """Get list of prerequisite skills for a given skill"""
        try:
            decision_tree = await self.load_decision_tree_data()
            prerequisites = []
            
            # Find all skills that list the target skill as a next step
            for skill, next_skills in decision_tree.items():
                if skill_id in next_skills:
                    prerequisites.append(skill)
                    
            return prerequisites
            
        except Exception as e:
            logger.error(f"Error getting skill prerequisites: {str(e)}")
            raise

    async def get_learning_paths(self) -> Dict[str, List[str]]:
        """Get complete learning paths decision tree"""
        try:
            return await self.load_decision_tree_data()
        except Exception as e:
            logger.error(f"Error getting learning paths: {str(e)}")
            raise

    async def upload_learning_paths(
        self,
        learning_paths_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Upload learning paths data to cloud storage"""
        try:
            if not self.container_client:
                return {
                    "success": False,
                    "error": "Cloud storage not configured"
                }

            # Prepare the data structure
            data_to_upload = {
                "learning_path_decision_tree": learning_paths_data
            }
            
            # Upload decision tree
            blob_name = self.DECISION_TREE_BLOB_PATH
            blob_client = self.container_client.get_blob_client(blob_name)
            
            json_content = json.dumps(data_to_upload, indent=2)
            
            blob_client.upload_blob(
                data=json_content.encode('utf-8'),
                overwrite=True,
                content_settings=ContentSettings(
                    content_type='application/json',
                    cache_control='max-age=3600'
                ),
                metadata={
                    'file_type': 'learning_paths',
                    'upload_timestamp': datetime.now(timezone.utc).isoformat(),
                    'skill_count': str(len(learning_paths_data)),
                    'version': '1.0'
                }
            )
            
            # Upload metadata if provided
            if metadata:
                metadata_blob_name = self.METADATA_BLOB_PATH
                metadata_blob_client = self.container_client.get_blob_client(metadata_blob_name)
                
                metadata_json = json.dumps(metadata, indent=2)
                metadata_blob_client.upload_blob(
                    data=metadata_json.encode('utf-8'),
                    overwrite=True,
                    content_settings=ContentSettings(content_type='application/json')
                )
            
            # Clear cache
            self._cache.clear()
            
            logger.info(f"Successfully uploaded learning paths")
            
            return {
                "success": True,
                "blob_name": blob_name,
                "skill_count": len(learning_paths_data)
            }
            
        except Exception as e:
            logger.error(f"Failed to upload learning paths: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_learning_paths_metadata(self) -> Dict[str, Any]:
        """Get metadata for learning paths"""
        try:
            blob_name = self.METADATA_BLOB_PATH
            blob_client = self.container_client.get_blob_client(blob_name)
            
            try:
                blob_data = blob_client.download_blob().readall()
                metadata = json.loads(blob_data.decode('utf-8'))
                return metadata
            except ResourceNotFoundError:
                # Return default metadata if none exists
                return {
                    "description": "Universal learning paths decision tree",
                    "created_date": None,
                    "version": "1.0"
                }
                
        except Exception as e:
            logger.error(f"Error getting learning paths metadata: {str(e)}")
            return {}

    async def list_learning_paths_files(self) -> Dict[str, Any]:
        """List all learning paths files in cloud storage"""
        try:
            if not self.container_client:
                return {
                    "success": False,
                    "error": "Cloud storage not configured",
                    "files": []
                }

            files = []
            for blob in self.container_client.list_blobs(name_starts_with="learning_paths/"):
                try:
                    blob_client = self.container_client.get_blob_client(blob.name)
                    properties = blob_client.get_blob_properties()
                    
                    files.append({
                        "name": blob.name,
                        "size": blob.size,
                        "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
                        "file_type": properties.metadata.get("file_type", "unknown"),
                        "skill_count": properties.metadata.get("skill_count", "unknown"),
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
            logger.error(f"Failed to list learning paths files: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "files": []
            }

    async def get_skill_groups(self) -> Dict[str, Any]:
        """Get skill groups and their sequences (derived from decision tree)"""
        try:
            decision_tree = await self.load_decision_tree_data()
            
            if not decision_tree:
                return {}
            
            # Group skills by their prefixes (e.g., COUNT001, OPS001, etc.)
            skill_groups = {}
            
            for skill_id in decision_tree.keys():
                # Extract prefix (everything before the last dash)
                if '-' in skill_id:
                    prefix = skill_id.rsplit('-', 1)[0]
                else:
                    prefix = skill_id
                
                if prefix not in skill_groups:
                    skill_groups[prefix] = {
                        "name": prefix,
                        "skills": [],
                        "description": f"Skills in the {prefix} group"
                    }
                
                skill_groups[prefix]["skills"].append(skill_id)
            
            # Sort skills within each group
            for group in skill_groups.values():
                group["skills"].sort()
            
            return skill_groups
            
        except Exception as e:
            logger.error(f"Error getting skill groups: {str(e)}")
            return {}

    async def refresh_cache(self) -> Dict[str, Any]:
        """Refresh learning paths cache"""
        try:
            self._cache.clear()
            return {
                "success": True,
                "message": "Cache cleared"
            }
                
        except Exception as e:
            logger.error(f"Error refreshing cache: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def health_check(self) -> Dict[str, Any]:
        """Check learning paths service health"""
        try:
            health_status = {
                "status": "healthy",
                "cloud_storage_configured": bool(self.container_client),
                "cache_size": len(self._cache),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            # Test cloud storage connection if configured
            if self.container_client:
                try:
                    # Try to list blobs (limit to 1 for efficiency)
                    list(self.container_client.list_blobs(max_results=1))
                    health_status["cloud_storage_status"] = "connected"
                except Exception as e:
                    health_status["cloud_storage_status"] = f"error: {str(e)}"
                    health_status["status"] = "degraded"
            else:
                health_status["cloud_storage_status"] = "not_configured"
                health_status["status"] = "degraded"
            
            return health_status
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }