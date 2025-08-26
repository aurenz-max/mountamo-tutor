# backend/app/db/firestore_service.py

from google.cloud import firestore
from google.cloud.firestore import Client
from google.oauth2 import service_account
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Union
import logging
import uuid
import os
from ..core.config import settings

logger = logging.getLogger(__name__)

class FirestoreService:
    """
    Firestore service for real-time analytics migration.
    Handles student attempts, reviews, and competencies with real-time capabilities.
    """
    
    def __init__(self, project_id: Optional[str] = None):
        """Initialize Firestore client"""
        try:
            self.project_id = project_id or settings.FIREBASE_PROJECT_ID
            
            # Initialize Firestore client with Firebase Admin credentials
            # Use explicit credentials instead of overriding global environment
            if hasattr(settings, 'FIREBASE_ADMIN_CREDENTIALS_PATH'):
                firebase_creds_path = settings.firebase_admin_credentials_full_path
                
                # Load credentials explicitly for Firestore only
                if os.path.exists(firebase_creds_path):
                    credentials = service_account.Credentials.from_service_account_file(firebase_creds_path)
                    self.client = firestore.Client(project=self.project_id, credentials=credentials)
                else:
                    logger.warning(f"Firebase credentials file not found: {firebase_creds_path}")
                    self.client = firestore.Client(project=self.project_id)
            else:
                self.client = firestore.Client(project=self.project_id)
            
            # Collection references for analytics data
            self.attempts_collection = self.client.collection('student_attempts')
            self.reviews_collection = self.client.collection('student_reviews')
            self.competencies_collection = self.client.collection('student_competencies')
            
            logger.info(f"Firestore service initialized for project: {self.project_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Firestore service: {str(e)}")
            raise

    def _add_migration_metadata(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add migration tracking metadata to documents"""
        data_copy = data.copy()
        data_copy.update({
            'source_system': 'cosmos_migration',
            'migration_timestamp': datetime.now(timezone.utc).isoformat(),
            'firestore_created_at': datetime.now(timezone.utc).isoformat()
        })
        return data_copy

    def _prepare_firestore_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare data for Firestore by handling unsupported types"""
        prepared_data = {}
        
        for key, value in data.items():
            if value is None:
                prepared_data[key] = None
            elif isinstance(value, (str, int, float, bool)):
                prepared_data[key] = value
            elif isinstance(value, dict):
                prepared_data[key] = self._prepare_firestore_data(value)
            elif isinstance(value, list):
                prepared_data[key] = [
                    self._prepare_firestore_data(item) if isinstance(item, dict) else item 
                    for item in value
                ]
            elif isinstance(value, datetime):
                prepared_data[key] = value.isoformat()
            else:
                # Convert other types to string
                prepared_data[key] = str(value)
        
        return prepared_data

    # ============================================================================
    # ATTEMPTS METHODS
    # ============================================================================

    async def save_attempt(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        analysis: str,
        feedback: str,
        firebase_uid: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Save student attempt to Firestore"""
        try:
            attempt_id = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()
            
            attempt_data = {
                "id": attempt_id,
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "score": float(score),
                "analysis": analysis,
                "feedback": feedback,
                "timestamp": timestamp,
                "firebase_uid": firebase_uid,
                "created_at": timestamp
            }
            
            # Add any additional data
            if additional_data:
                attempt_data.update(additional_data)
            
            # Add migration metadata
            attempt_data = self._add_migration_metadata(attempt_data)
            
            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(attempt_data)
            
            # Save to Firestore
            doc_ref = self.attempts_collection.document(attempt_id)
            doc_ref.set(firestore_data)
            
            logger.info(f"Saved attempt {attempt_id} to Firestore for student {student_id}")
            return firestore_data
            
        except Exception as e:
            logger.error(f"Error saving attempt to Firestore: {str(e)}")
            raise

    async def get_student_attempts(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get student attempts from Firestore"""
        try:
            query = self.attempts_collection.where('student_id', '==', student_id)
            
            if subject:
                query = query.where('subject', '==', subject)
            if skill_id:
                query = query.where('skill_id', '==', skill_id)
            if subskill_id:
                query = query.where('subskill_id', '==', subskill_id)
            
            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
            
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]
            
            logger.info(f"Retrieved {len(results)} attempts for student {student_id}")
            return results
            
        except Exception as e:
            logger.error(f"Error getting student attempts from Firestore: {str(e)}")
            return []

    # ============================================================================
    # REVIEWS METHODS
    # ============================================================================

    async def save_problem_review(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        problem_id: str,
        review_data: Dict[str, Any],
        problem_content: Dict[str, Any] = None,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save problem review to Firestore"""
        try:
            review_id = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()
            
            review_item = {
                "id": review_id,
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "problem_id": problem_id,
                "timestamp": timestamp,
                "problem_content": problem_content,
                "full_review": review_data,
                "observation": review_data.get("observation", {}),
                "analysis": review_data.get("analysis", {}),
                "evaluation": review_data.get("evaluation", {}),
                "feedback": review_data.get("feedback", {}),
                "score": float(review_data.get("evaluation", {}).get("score", 0)) 
                    if isinstance(review_data.get("evaluation"), dict) 
                    else float(review_data.get("evaluation", 0)),
                "firebase_uid": firebase_uid,
                "created_at": timestamp
            }
            
            # Add migration metadata
            review_item = self._add_migration_metadata(review_item)
            
            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(review_item)
            
            # Save to Firestore
            doc_ref = self.reviews_collection.document(review_id)
            doc_ref.set(firestore_data)
            
            logger.info(f"Saved review {review_id} to Firestore for student {student_id}")
            return firestore_data
            
        except Exception as e:
            logger.error(f"Error saving review to Firestore: {str(e)}")
            raise

    async def get_problem_reviews(
        self,
        student_id: int,
        subject: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get problem reviews from Firestore"""
        try:
            query = self.reviews_collection.where('student_id', '==', student_id)
            
            if subject:
                query = query.where('subject', '==', subject)
            if skill_id:
                query = query.where('skill_id', '==', skill_id)
            if subskill_id:
                query = query.where('subskill_id', '==', subskill_id)
            
            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
            
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]
            
            logger.info(f"Retrieved {len(results)} reviews for student {student_id}")
            return results
            
        except Exception as e:
            logger.error(f"Error getting reviews from Firestore: {str(e)}")
            return []

    # ============================================================================
    # COMPETENCIES METHODS
    # ============================================================================

    async def update_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str,
        score: float,
        credibility: float,
        total_attempts: int,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update competency in Firestore"""
        try:
            # Use consistent ID based on student, subject, skill, and subskill
            competency_id = f"{student_id}_{subject}_{skill_id}_{subskill_id}"
            timestamp = datetime.now(timezone.utc).isoformat()
            
            competency_data = {
                "id": competency_id,
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": float(score),
                "credibility": float(credibility),
                "total_attempts": int(total_attempts),
                "last_updated": timestamp,
                "firebase_uid": firebase_uid
            }
            
            # Check if document exists to preserve created_at
            doc_ref = self.competencies_collection.document(competency_id)
            existing_doc = doc_ref.get()
            
            if existing_doc.exists:
                # Preserve created_at from existing document
                existing_data = existing_doc.to_dict()
                competency_data["created_at"] = existing_data.get("created_at", timestamp)
            else:
                competency_data["created_at"] = timestamp
            
            # Add migration metadata
            competency_data = self._add_migration_metadata(competency_data)
            
            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(competency_data)
            
            # Save to Firestore
            doc_ref.set(firestore_data)
            
            logger.info(f"Updated competency {competency_id} in Firestore")
            return firestore_data
            
        except Exception as e:
            logger.error(f"Error updating competency in Firestore: {str(e)}")
            raise

    async def get_competency(
        self,
        student_id: int,
        subject: str,
        skill_id: str,
        subskill_id: str
    ) -> Dict[str, Any]:
        """Get competency from Firestore"""
        try:
            competency_id = f"{student_id}_{subject}_{skill_id}_{subskill_id}"
            doc_ref = self.competencies_collection.document(competency_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            else:
                # Return default competency structure
                return {
                    "student_id": student_id,
                    "subject": subject,
                    "skill_id": skill_id,
                    "subskill_id": subskill_id,
                    "current_score": 0,
                    "credibility": 0,
                    "total_attempts": 0,
                    "last_updated": None
                }
                
        except Exception as e:
            logger.error(f"Error getting competency from Firestore: {str(e)}")
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": 0,
                "credibility": 0,
                "total_attempts": 0,
                "last_updated": None
            }

    async def get_subject_competencies(
        self,
        student_id: int,
        subject: str
    ) -> List[Dict[str, Any]]:
        """Get all competencies for a specific subject from Firestore"""
        try:
            query = self.competencies_collection.where('student_id', '==', student_id).where('subject', '==', subject)
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]
            
            logger.info(f"Retrieved {len(results)} competencies for student {student_id}, subject {subject}")
            return results
            
        except Exception as e:
            logger.error(f"Error getting subject competencies from Firestore: {str(e)}")
            return []

    # ============================================================================
    # BATCH OPERATIONS FOR MIGRATION
    # ============================================================================

    async def batch_write_attempts(self, attempts: List[Dict[str, Any]]) -> bool:
        """Batch write attempts to Firestore for migration"""
        try:
            batch = self.client.batch()
            
            for attempt in attempts:
                # Add migration metadata
                attempt_data = self._add_migration_metadata(attempt)
                firestore_data = self._prepare_firestore_data(attempt_data)
                
                doc_ref = self.attempts_collection.document(attempt['id'])
                batch.set(doc_ref, firestore_data)
            
            batch.commit()
            logger.info(f"Batch wrote {len(attempts)} attempts to Firestore")
            return True
            
        except Exception as e:
            logger.error(f"Error in batch write attempts: {str(e)}")
            return False

    async def batch_write_reviews(self, reviews: List[Dict[str, Any]]) -> bool:
        """Batch write reviews to Firestore for migration"""
        try:
            batch = self.client.batch()
            
            for review in reviews:
                # Add migration metadata
                review_data = self._add_migration_metadata(review)
                firestore_data = self._prepare_firestore_data(review_data)
                
                doc_ref = self.reviews_collection.document(review['id'])
                batch.set(doc_ref, firestore_data)
            
            batch.commit()
            logger.info(f"Batch wrote {len(reviews)} reviews to Firestore")
            return True
            
        except Exception as e:
            logger.error(f"Error in batch write reviews: {str(e)}")
            return False

    async def batch_write_competencies(self, competencies: List[Dict[str, Any]]) -> bool:
        """Batch write competencies to Firestore for migration"""
        try:
            batch = self.client.batch()
            
            for competency in competencies:
                # Add migration metadata
                competency_data = self._add_migration_metadata(competency)
                firestore_data = self._prepare_firestore_data(competency_data)
                
                doc_ref = self.competencies_collection.document(competency['id'])
                batch.set(doc_ref, firestore_data)
            
            batch.commit()
            logger.info(f"Batch wrote {len(competencies)} competencies to Firestore")
            return True
            
        except Exception as e:
            logger.error(f"Error in batch write competencies: {str(e)}")
            return False

    # ============================================================================
    # MONITORING AND VALIDATION
    # ============================================================================

    async def validate_data_consistency(
        self, 
        cosmos_data: Dict[str, Any], 
        firestore_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate data consistency between CosmosDB and Firestore"""
        validation_result = {
            "consistent": True,
            "differences": [],
            "missing_fields": [],
            "validation_timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Check for missing fields in Firestore
        for key in cosmos_data.keys():
            if key not in firestore_data and key not in ['_rid', '_self', '_etag', '_attachments', '_ts']:
                validation_result["missing_fields"].append(key)
                validation_result["consistent"] = False
        
        # Check for value differences (excluding system fields)
        system_fields = ['_rid', '_self', '_etag', '_attachments', '_ts', 'migration_timestamp', 'firestore_created_at', 'source_system']
        
        for key, cosmos_value in cosmos_data.items():
            if key in system_fields:
                continue
                
            if key in firestore_data:
                firestore_value = firestore_data[key]
                if cosmos_value != firestore_value:
                    validation_result["differences"].append({
                        "field": key,
                        "cosmos_value": cosmos_value,
                        "firestore_value": firestore_value
                    })
                    validation_result["consistent"] = False
        
        return validation_result

    async def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about Firestore collections"""
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attempts_count": 0,
            "reviews_count": 0,
            "competencies_count": 0
        }
        
        try:
            # Note: These operations can be expensive for large collections
            # In production, consider using Firestore aggregation queries
            attempts_docs = self.attempts_collection.limit(1).stream()
            stats["attempts_count"] = len(list(attempts_docs))
            
            reviews_docs = self.reviews_collection.limit(1).stream()
            stats["reviews_count"] = len(list(reviews_docs))
            
            competencies_docs = self.competencies_collection.limit(1).stream()
            stats["competencies_count"] = len(list(competencies_docs))
            
        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            stats["error"] = str(e)
        
        return stats