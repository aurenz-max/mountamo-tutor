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
    Firestore service for real-time analytics.

    Data lives under student-level subcollections:
        students/{student_id}/attempts/{attempt_id}
        students/{student_id}/reviews/{review_id}
        students/{student_id}/competencies/{subject}_{skill}_{subskill}

    Curriculum graphs remain a flat top-level collection (read-only).
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

            # Collection reference for curriculum graphs (read-only, flat)
            self.curriculum_graphs = self.client.collection('curriculum_graphs')

            logger.info(f"Firestore service initialized for project: {self.project_id}")

        except Exception as e:
            logger.error(f"Failed to initialize Firestore service: {str(e)}")
            raise

    # ============================================================================
    # SUBCOLLECTION HELPERS
    # ============================================================================

    def _student_doc(self, student_id: int):
        """Get reference to a student document: students/{student_id}"""
        return self.client.collection('students').document(str(student_id))

    def _attempts_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/attempts"""
        return self._student_doc(student_id).collection('attempts')

    def _reviews_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/reviews"""
        return self._student_doc(student_id).collection('reviews')

    def _competencies_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/competencies"""
        return self._student_doc(student_id).collection('competencies')

    def _learning_paths_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/learning_paths"""
        return self._student_doc(student_id).collection('learning_paths')

    async def _ensure_student_document(self, student_id: int, firebase_uid: Optional[str] = None):
        """Ensure the student document exists with minimal metadata (merge=True)"""
        try:
            doc_ref = self._student_doc(student_id)
            data = {
                "student_id": student_id,
                "last_activity": datetime.now(timezone.utc).isoformat(),
            }
            if firebase_uid:
                data["firebase_uid"] = firebase_uid
            doc_ref.set(data, merge=True)
        except Exception as e:
            logger.warning(f"Failed to ensure student document for {student_id}: {e}")

    # ============================================================================
    # DATA HELPERS
    # ============================================================================

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
        """Save student attempt to Firestore under students/{student_id}/attempts/"""
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

            # Ensure student doc exists, then save to subcollection
            await self._ensure_student_document(student_id, firebase_uid)
            doc_ref = self._attempts_subcollection(student_id).document(attempt_id)
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
        """Get student attempts from Firestore subcollection"""
        try:
            query = self._attempts_subcollection(student_id)

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
        """Save problem review to Firestore under students/{student_id}/reviews/"""
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

            # Ensure student doc exists, then save to subcollection
            await self._ensure_student_document(student_id, firebase_uid)
            doc_ref = self._reviews_subcollection(student_id).document(review_id)
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
        """Get problem reviews from Firestore subcollection"""
        try:
            query = self._reviews_subcollection(student_id)

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
        """Update competency in Firestore under students/{student_id}/competencies/"""
        try:
            # Subcollection doc ID omits student_id (already scoped by parent)
            competency_doc_id = f"{subject}_{skill_id}_{subskill_id}"
            # Keep full composite ID in the data for backward compatibility
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

            # Ensure student doc exists
            await self._ensure_student_document(student_id, firebase_uid)

            # Check if document exists to preserve created_at
            doc_ref = self._competencies_subcollection(student_id).document(competency_doc_id)
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
        """Get competency from Firestore subcollection"""
        try:
            competency_doc_id = f"{subject}_{skill_id}_{subskill_id}"
            doc_ref = self._competencies_subcollection(student_id).document(competency_doc_id)
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
        """Get all competencies for a specific subject from Firestore subcollection"""
        try:
            query = self._competencies_subcollection(student_id).where('subject', '==', subject)
            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} competencies for student {student_id}, subject {subject}")
            return results

        except Exception as e:
            logger.error(f"Error getting subject competencies from Firestore: {str(e)}")
            return []

    # ============================================================================
    # CURRICULUM GRAPH METHODS (READ-ONLY)
    # ============================================================================

    async def get_curriculum_graph(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get curriculum graph from Firestore

        Reads the cached graph written by curriculum authoring service.
        Returns graph structure with nodes and edges.

        Args:
            subject_id: Subject identifier (e.g., "MATHEMATICS", "LANGUAGE_ARTS")
            version_type: "published" or "draft" (default: "published")
            version_id: Specific version ID (optional, uses latest if not specified)

        Returns:
            {
                "id": str,
                "subject_id": str,
                "version_id": str,
                "version_type": str,
                "graph": {
                    "nodes": [...],
                    "edges": [...]
                },
                "metadata": {...},
                "generated_at": str,
                "last_accessed": str
            }
        """
        try:
            # If no version_id specified, get the latest for this type
            if not version_id:
                query = self.curriculum_graphs \
                    .where('subject_id', '==', subject_id) \
                    .where('version_type', '==', version_type) \
                    .order_by('generated_at', direction=firestore.Query.DESCENDING) \
                    .limit(1)

                docs = list(query.stream())

                if docs:
                    doc = docs[0]
                    doc_data = doc.to_dict()

                    # Update last accessed time
                    doc_data["last_accessed"] = datetime.now(timezone.utc).isoformat()
                    doc.reference.update({"last_accessed": doc_data["last_accessed"]})

                    logger.info(f"Retrieved curriculum graph for {subject_id} (type: {version_type})")
                    return doc_data
                else:
                    logger.info(f"No curriculum graph found for {subject_id} (type: {version_type})")
                    return None
            else:
                # Get specific version
                doc_id = f"{subject_id}_{version_id}_{version_type}"
                doc_ref = self.curriculum_graphs.document(doc_id)
                doc = doc_ref.get()

                if doc.exists:
                    doc_data = doc.to_dict()

                    # Update last accessed time
                    doc_data["last_accessed"] = datetime.now(timezone.utc).isoformat()
                    doc_ref.update({"last_accessed": doc_data["last_accessed"]})

                    logger.info(f"Retrieved curriculum graph for {subject_id} (version: {version_id})")
                    return doc_data
                else:
                    logger.info(f"Curriculum graph not found for {subject_id}")
                    return None

        except Exception as e:
            logger.error(f"Error retrieving curriculum graph: {str(e)}")
            # On error, return None to allow fallback logic
            return None

    async def get_graph_status(
        self,
        subject_id: str
    ) -> Dict[str, Any]:
        """
        Get status/metadata about cached graphs for a subject

        Returns information about what graph versions are cached.

        Args:
            subject_id: Subject identifier

        Returns:
            {
                "subject_id": str,
                "cached_versions": [...],
                "has_published": bool,
                "has_draft": bool,
                "total_cached": int
            }
        """
        try:
            query = self.curriculum_graphs.where('subject_id', '==', subject_id)
            docs = list(query.stream())

            cached_versions = []
            for doc in docs:
                doc_data = doc.to_dict()
                cached_versions.append({
                    "version_type": doc_data.get("version_type"),
                    "version_id": doc_data.get("version_id"),
                    "generated_at": doc_data.get("generated_at"),
                    "last_accessed": doc_data.get("last_accessed"),
                    "metadata": doc_data.get("metadata", {})
                })

            # Sort by generated_at descending
            cached_versions.sort(key=lambda x: x.get("generated_at", ""), reverse=True)

            status = {
                "subject_id": subject_id,
                "cached_versions": cached_versions,
                "has_published": any(v["version_type"] == "published" for v in cached_versions),
                "has_draft": any(v["version_type"] == "draft" for v in cached_versions),
                "total_cached": len(cached_versions)
            }

            return status

        except Exception as e:
            logger.error(f"Error getting curriculum graph status: {str(e)}")
            raise

    # ============================================================================
    # CURRICULUM PUBLISHED METHODS (READ-ONLY)
    # ============================================================================

    async def get_published_curriculum(
        self,
        subject_id: str,
        grade: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get published curriculum document for a subject.

        Reads from curriculum_published/{grade}/subjects/{subject_id}.
        If grade is provided, does a direct O(1) lookup.
        Otherwise searches across all grades.

        Returns:
            Full curriculum document with hierarchy, subskill_index, and stats,
            or None if not deployed yet.
        """
        try:
            if grade:
                # Direct O(1) lookup
                doc_ref = self.client.collection('curriculum_published').document(grade).collection('subjects').document(subject_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
                return None

            # Search across all grades
            for grade_doc in self.client.collection('curriculum_published').stream():
                doc_ref = grade_doc.reference.collection('subjects').document(subject_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting published curriculum for {subject_id}: {str(e)}")
            return None

    async def get_all_published_subjects(self, grade: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all subjects that have published curriculum in Firestore.

        If grade is provided, returns only subjects for that grade (O(1) subcollection read).
        Otherwise returns all subjects across all grades.

        Returns:
            List of dicts with subject_id, subject_name, and grade for each deployed subject.
        """
        try:
            subjects = []

            if grade:
                # O(1) grade-scoped lookup
                docs = self.client.collection('curriculum_published').document(grade).collection('subjects').stream()
                for doc in docs:
                    doc_data = doc.to_dict()
                    subjects.append({
                        "subject_id": doc.id,
                        "subject_name": doc_data.get("subject_name", doc.id),
                        "grade": doc_data.get("grade", grade),
                    })
            else:
                # All subjects across all grades
                for grade_doc in self.client.collection('curriculum_published').stream():
                    grade_id = grade_doc.id
                    grade_subjects = grade_doc.reference.collection('subjects').stream()
                    for doc in grade_subjects:
                        doc_data = doc.to_dict()
                        subjects.append({
                            "subject_id": doc.id,
                            "subject_name": doc_data.get("subject_name", doc.id),
                            "grade": doc_data.get("grade", grade_id),
                        })

            return subjects

        except Exception as e:
            logger.error(f"Error listing published subjects: {str(e)}")
            return []

    # ============================================================================
    # BATCH OPERATIONS FOR MIGRATION
    # ============================================================================

    async def batch_write_attempts(self, attempts: List[Dict[str, Any]]) -> bool:
        """Batch write attempts to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for attempt in attempts:
                student_id = attempt['student_id']
                student_ids_seen.add(student_id)

                attempt_data = self._add_migration_metadata(attempt)
                firestore_data = self._prepare_firestore_data(attempt_data)

                doc_ref = self._attempts_subcollection(student_id).document(attempt['id'])
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(attempts)} attempts to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write attempts: {str(e)}")
            return False

    async def batch_write_reviews(self, reviews: List[Dict[str, Any]]) -> bool:
        """Batch write reviews to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for review in reviews:
                student_id = review['student_id']
                student_ids_seen.add(student_id)

                review_data = self._add_migration_metadata(review)
                firestore_data = self._prepare_firestore_data(review_data)

                doc_ref = self._reviews_subcollection(student_id).document(review['id'])
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(reviews)} reviews to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write reviews: {str(e)}")
            return False

    async def batch_write_competencies(self, competencies: List[Dict[str, Any]]) -> bool:
        """Batch write competencies to Firestore subcollections"""
        try:
            batch = self.client.batch()
            student_ids_seen = set()

            for competency in competencies:
                student_id = competency['student_id']
                student_ids_seen.add(student_id)

                competency_data = self._add_migration_metadata(competency)
                firestore_data = self._prepare_firestore_data(competency_data)

                # Use subcollection doc ID without student_id prefix
                subject = competency.get('subject', '')
                skill_id = competency.get('skill_id', '')
                subskill_id = competency.get('subskill_id', '')
                doc_id = f"{subject}_{skill_id}_{subskill_id}"

                doc_ref = self._competencies_subcollection(student_id).document(doc_id)
                batch.set(doc_ref, firestore_data)

            # Ensure student docs exist
            for sid in student_ids_seen:
                student_ref = self._student_doc(sid)
                batch.set(student_ref, {
                    "student_id": sid,
                    "last_activity": datetime.now(timezone.utc).isoformat(),
                }, merge=True)

            batch.commit()
            logger.info(f"Batch wrote {len(competencies)} competencies to Firestore subcollections")
            return True

        except Exception as e:
            logger.error(f"Error in batch write competencies: {str(e)}")
            return False

    # ============================================================================
    # LEARNING PATHS METHODS (per-student unlock state)
    # ============================================================================

    async def save_learning_path(
        self,
        student_id: int,
        subject_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Save computed learning path (unlock state) for a student+subject.

        Stored at: students/{student_id}/learning_paths/{subject_id}
        """
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            path_data = {
                "subject_id": subject_id,
                "unlocked_entities": data.get("unlocked_entities", []),
                "entity_statuses": data.get("entity_statuses", {}),
                "last_computed": timestamp,
                "version_id": data.get("version_id"),
            }

            await self._ensure_student_document(student_id)
            doc_ref = self._learning_paths_subcollection(student_id).document(subject_id)
            doc_ref.set(path_data)

            logger.info(f"Saved learning path for student {student_id}, subject {subject_id}")
            return path_data

        except Exception as e:
            logger.error(f"Error saving learning path: {str(e)}")
            raise

    async def get_learning_path(
        self,
        student_id: int,
        subject_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached learning path (unlock state) for a student+subject.

        Returns None if not yet computed.
        """
        try:
            doc_ref = self._learning_paths_subcollection(student_id).document(subject_id)
            doc = doc_ref.get()

            if doc.exists:
                return doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting learning path: {str(e)}")
            return None

    async def get_student_proficiency_map(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Build a proficiency map from the competencies subcollection.

        Replaces BigQuery get_student_proficiency_map for real-time lookups.

        Returns:
            {
                "SUBSKILL-123": {
                    "proficiency": 0.85,
                    "attempt_count": 10,
                    "last_updated": "2026-02-27T..."
                }
            }
        """
        try:
            query = self._competencies_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)

            docs = query.stream()
            prof_map = {}

            for doc in docs:
                data = doc.to_dict()
                entity_id = data.get("subskill_id")
                if not entity_id:
                    continue

                # current_score is already normalized 0-10 from competency service
                # Convert to 0.0-1.0 scale for learning paths
                raw_score = float(data.get("current_score", 0))
                proficiency = raw_score / 10.0 if raw_score > 1.0 else raw_score

                prof_map[entity_id] = {
                    "proficiency": proficiency,
                    "attempt_count": int(data.get("total_attempts", 0)),
                    "last_updated": data.get("last_updated"),
                }

            logger.info(f"Built proficiency map with {len(prof_map)} entries for student {student_id}")
            return prof_map

        except Exception as e:
            logger.error(f"Error building proficiency map: {str(e)}")
            return {}

    # ============================================================================
    # SKILL STATUS METHODS (Review pipeline / Completion factor model)
    # ============================================================================

    def _skill_status_subcollection(self, student_id: int):
        """DEPRECATED: Use mastery_lifecycle methods instead. Will be removed."""
        return self._student_doc(student_id).collection('skill_status')

    async def get_skill_status(
        self,
        student_id: int,
        skill_id: str
    ) -> Optional[Dict[str, Any]]:
        """DEPRECATED: Use get_mastery_lifecycle() instead. Will be removed."""
        try:
            doc_ref = self._skill_status_subcollection(student_id).document(skill_id)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting skill status for {skill_id}: {e}")
            return None

    async def get_all_skill_statuses(
        self,
        student_id: int,
        subject: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """DEPRECATED: Use get_all_mastery_lifecycles() instead. Will be removed."""
        try:
            query = self._skill_status_subcollection(student_id)
            if subject:
                query = query.where('subject', '==', subject)
            if status:
                query = query.where('status', '==', status)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting skill statuses for student {student_id}: {e}")
            return []

    async def upsert_skill_status(
        self,
        student_id: int,
        skill_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """DEPRECATED: Use upsert_mastery_lifecycle() instead. Will be removed."""
        try:
            await self._ensure_student_document(student_id)
            doc_ref = self._skill_status_subcollection(student_id).document(skill_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted skill_status/{skill_id} for student {student_id}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting skill status: {e}")
            raise

    async def get_skills_with_review_due(
        self,
        student_id: int,
        before_date: str
    ) -> List[Dict[str, Any]]:
        """DEPRECATED: Use get_mastery_retests_due() instead. Will be removed."""
        try:
            query = (
                self._skill_status_subcollection(student_id)
                .where('status', '==', 'in_review')
                .where('next_review_date', '<=', before_date)
            )
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting skills with review due: {e}")
            return []

    # ============================================================================
    # MASTERY LIFECYCLE METHODS (4-gate mastery model — PRD Sections 3, 6.2)
    # ============================================================================

    def _mastery_lifecycle_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/mastery_lifecycle"""
        return self._student_doc(student_id).collection('mastery_lifecycle')

    async def get_mastery_lifecycle(
        self,
        student_id: int,
        subskill_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single subskill's mastery lifecycle document."""
        try:
            doc_ref = self._mastery_lifecycle_subcollection(student_id).document(subskill_id)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting mastery lifecycle for {subskill_id}: {e}")
            return None

    async def upsert_mastery_lifecycle(
        self,
        student_id: int,
        subskill_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update a subskill's mastery lifecycle document."""
        try:
            await self._ensure_student_document(student_id)
            doc_ref = self._mastery_lifecycle_subcollection(student_id).document(subskill_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted mastery_lifecycle/{subskill_id} for student {student_id}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting mastery lifecycle: {e}")
            raise

    async def get_mastery_retests_due(
        self,
        student_id: int,
        before_date: str
    ) -> List[Dict[str, Any]]:
        """Get subskills whose mastery retest is due (next_retest_eligible <= before_date).

        Firestore compound queries with range filters on multiple fields require
        composite indexes.  We filter on next_retest_eligible in-query (single
        range filter) and apply the gate filter client-side to avoid index issues.
        """
        try:
            query = (
                self._mastery_lifecycle_subcollection(student_id)
                .where('next_retest_eligible', '<=', before_date)
            )
            results = []
            for doc in query.stream():
                data = doc.to_dict()
                gate = data.get('current_gate', 0)
                if 1 <= gate < 4:
                    results.append(data)
            return results
        except Exception as e:
            logger.error(f"Error getting mastery retests due: {e}")
            return []

    async def get_all_mastery_lifecycles(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all mastery lifecycle docs for a student, optionally filtered by subject."""
        try:
            query = self._mastery_lifecycle_subcollection(student_id)
            if subject:
                query = query.where('subject', '==', subject)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting mastery lifecycles for student {student_id}: {e}")
            return []

    async def update_global_practice_pass_rate(
        self,
        student_id: int,
        passes: int,
        fails: int
    ) -> None:
        """Update the student-level global practice pass rate (PRD 6.4)."""
        try:
            await self._ensure_student_document(student_id)
            total = passes + fails
            pass_rate = passes / total if total > 0 else 0.0
            self._student_doc(student_id).set({
                "global_practice_passes": passes,
                "global_practice_fails": fails,
                "global_practice_pass_rate": round(pass_rate, 4),
            }, merge=True)
            logger.info(
                f"Updated global practice pass rate for student {student_id}: "
                f"{passes}/{total} = {pass_rate:.4f}"
            )
        except Exception as e:
            logger.error(f"Error updating global practice pass rate: {e}")
            raise

    async def get_global_practice_pass_rate(
        self,
        student_id: int
    ) -> Dict[str, Any]:
        """Get the student-level global practice pass rate (PRD 6.4)."""
        try:
            doc = self._student_doc(student_id).get()
            if not doc.exists:
                return {
                    "global_practice_passes": 0,
                    "global_practice_fails": 0,
                    "global_practice_pass_rate": 0.8,  # default prior
                }
            data = doc.to_dict()
            return {
                "global_practice_passes": data.get("global_practice_passes", 0),
                "global_practice_fails": data.get("global_practice_fails", 0),
                "global_practice_pass_rate": data.get("global_practice_pass_rate", 0.8),
            }
        except Exception as e:
            logger.error(f"Error getting global practice pass rate: {e}")
            return {
                "global_practice_passes": 0,
                "global_practice_fails": 0,
                "global_practice_pass_rate": 0.8,
            }

    # ============================================================================
    # STUDENT PLANNING FIELDS (capacity, development patterns, aggregate metrics)
    # ============================================================================

    async def get_student_planning_fields(
        self,
        student_id: int
    ) -> Dict[str, Any]:
        """Get planning-specific fields from the student document."""
        try:
            doc = self._student_doc(student_id).get()
            if not doc.exists:
                return {}
            data = doc.to_dict()
            return {
                "daily_session_capacity": data.get("daily_session_capacity", 25),
                "development_patterns": data.get("development_patterns", {}),
                "aggregate_metrics": data.get("aggregate_metrics", {}),
            }
        except Exception as e:
            logger.error(f"Error getting planning fields for student {student_id}: {e}")
            return {}

    async def update_student_planning_fields(
        self,
        student_id: int,
        data: Dict[str, Any]
    ) -> None:
        """Merge planning-specific fields onto the student document."""
        try:
            await self._ensure_student_document(student_id)
            firestore_data = self._prepare_firestore_data(data)
            self._student_doc(student_id).set(firestore_data, merge=True)
            logger.info(f"Updated planning fields for student {student_id}")
        except Exception as e:
            logger.error(f"Error updating planning fields for student {student_id}: {e}")
            raise

    # ============================================================================
    # SCHOOL YEAR CONFIG
    # ============================================================================

    async def get_school_year_config(self) -> Optional[Dict[str, Any]]:
        """Get school year configuration from config/schoolYear."""
        try:
            doc = self.client.collection('config').document('schoolYear').get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting school year config: {e}")
            return None

    async def set_school_year_config(self, data: Dict[str, Any]) -> None:
        """Set school year configuration at config/schoolYear."""
        try:
            firestore_data = self._prepare_firestore_data(data)
            self.client.collection('config').document('schoolYear').set(firestore_data)
            logger.info("School year config saved to Firestore")
        except Exception as e:
            logger.error(f"Error setting school year config: {e}")
            raise

    # ============================================================================
    # VELOCITY HISTORY (PRD Section 15.10)
    # ============================================================================

    async def get_velocity_history(
        self,
        student_id: int,
        limit: int = 9,
    ) -> List[Dict[str, Any]]:
        """
        Get recent weekly velocity snapshots for trend display.

        Reads from students/{studentId}/velocityHistory, ordered by weekOf
        descending, limited to the most recent `limit` entries.
        Returns oldest-first for sparkline rendering.
        """
        try:
            query = (
                self._student_doc(student_id)
                .collection("velocityHistory")
                .order_by("weekOf", direction="DESCENDING")
                .limit(limit)
            )
            docs = [doc.to_dict() for doc in query.stream()]
            docs.reverse()  # oldest first for trend display
            return docs
        except Exception as e:
            logger.error(f"Error getting velocity history for student {student_id}: {e}")
            return []

    async def save_velocity_snapshot(
        self,
        student_id: int,
        week_id: str,
        data: Dict[str, Any],
    ) -> None:
        """
        Write a weekly velocity snapshot.

        Stored at students/{studentId}/velocityHistory/{weekId}
        where weekId is the Monday date (YYYY-MM-DD).
        """
        try:
            await self._ensure_student_document(student_id)
            firestore_data = self._prepare_firestore_data(data)
            (
                self._student_doc(student_id)
                .collection("velocityHistory")
                .document(week_id)
                .set(firestore_data, merge=True)
            )
            logger.info(f"Saved velocity snapshot {week_id} for student {student_id}")
        except Exception as e:
            logger.error(f"Error saving velocity snapshot for student {student_id}: {e}")
            raise

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
        """Get statistics about Firestore collections using collection group queries"""
        stats = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attempts_count": 0,
            "reviews_count": 0,
            "competencies_count": 0
        }

        try:
            # Use collection group queries for subcollections
            attempts_docs = self.client.collection_group('attempts').limit(1).stream()
            stats["attempts_count"] = len(list(attempts_docs))

            reviews_docs = self.client.collection_group('reviews').limit(1).stream()
            stats["reviews_count"] = len(list(reviews_docs))

            competencies_docs = self.client.collection_group('competencies').limit(1).stream()
            stats["competencies_count"] = len(list(competencies_docs))

        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            stats["error"] = str(e)

        return stats
