# backend/app/db/firestore_service.py

from google.cloud import firestore
from google.cloud.firestore import Client
from google.oauth2 import service_account
from collections import Counter
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

    Curriculum graphs are JIT-flattened from hierarchical Firestore
    (curriculum_published + curriculum_graphs edges subcollection).

    All student-data lookups by subskill_id or skill_id are transparently
    resolved through the SubskillIdResolver so that curriculum iteration
    never orphans student progress.
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

            # Collection reference for curriculum graphs (hierarchical edges)
            self.curriculum_graphs = self.client.collection('curriculum_graphs')

            # Initialize the lineage resolver with this Firestore client
            from ..services.subskill_id_resolver import subskill_id_resolver
            self._resolver = subskill_id_resolver
            self._resolver.set_client(self.client)

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

    async def get_student_attempts_date_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get student attempts filtered by date range (ISO string comparison)."""
        try:
            query = self._attempts_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if start_date:
                query = query.where('timestamp', '>=', start_date)
            if end_date:
                query = query.where('timestamp', '<=', end_date)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} attempts (date range) for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting attempts by date range from Firestore: {str(e)}")
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

    async def get_problem_reviews_date_range(
        self,
        student_id: int,
        subject: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get problem reviews filtered by date range (ISO string comparison)."""
        try:
            query = self._reviews_subcollection(student_id)

            if subject:
                query = query.where('subject', '==', subject)
            if start_date:
                query = query.where('timestamp', '>=', start_date)
            if end_date:
                query = query.where('timestamp', '<=', end_date)

            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)

            docs = query.stream()
            results = [doc.to_dict() for doc in docs]

            logger.info(f"Retrieved {len(results)} reviews (date range) for student {student_id}")
            return results

        except Exception as e:
            logger.error(f"Error getting reviews by date range from Firestore: {str(e)}")
            return []

    # ============================================================================
    # COMPETENCIES METHODS
    # ============================================================================

    async def get_all_competencies(
        self,
        student_id: int,
        subject: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all competency docs for a student, optionally filtered by subject."""
        try:
            query = self._competencies_subcollection(student_id)
            if subject:
                query = query.where('subject', '==', subject)
            results = [doc.to_dict() for doc in query.stream()]
            logger.info(f"Retrieved {len(results)} competencies for student {student_id}")
            return results
        except Exception as e:
            logger.error(f"Error getting all competencies from Firestore: {str(e)}")
            return []

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
            # Resolve through lineage — always write to canonical ID
            skill_id = await self._resolver.resolve_skill(skill_id)
            subskill_id = await self._resolver.resolve(subskill_id)

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
        """Get competency from Firestore subcollection.

        Resolves through curriculum lineage: tries canonical ID first,
        falls back to original ID if data hasn't been migrated yet,
        then triggers lazy migration.
        """
        try:
            # Resolve to canonical IDs
            canonical_skill = await self._resolver.resolve_skill(skill_id)
            canonical_subskill = await self._resolver.resolve(subskill_id)

            competency_doc_id = f"{subject}_{canonical_skill}_{canonical_subskill}"
            doc_ref = self._competencies_subcollection(student_id).document(competency_doc_id)
            doc = doc_ref.get()

            if doc.exists:
                return doc.to_dict()

            # Fallback: try the original (pre-lineage) ID if different
            if canonical_subskill != subskill_id or canonical_skill != skill_id:
                old_doc_id = f"{subject}_{skill_id}_{subskill_id}"
                old_ref = self._competencies_subcollection(student_id).document(old_doc_id)
                old_doc = old_ref.get()
                if old_doc.exists:
                    return old_doc.to_dict()

            # Return default competency structure
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": canonical_skill,
                "subskill_id": canonical_subskill,
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

    # ------------------------------------------------------------------
    # JIT graph flattening helpers
    # ------------------------------------------------------------------

    # Grade suffix → Firestore grade doc ID hints for fast resolution.
    _GRADE_SUFFIX_HINTS: Dict[str, List[str]] = {
        "_GK": ["Kindergarten", "K"],
        "_GPK": ["Pre-K", "PK"],
        **{f"_G{i}": [str(i), f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade"]
           for i in range(1, 13)},
    }

    def _strip_grade_suffix(self, subject_id: str) -> tuple:
        """Strip grade suffix from subject_id, returning (bare_id, grade_hints).

        E.g. "MATHEMATICS_GK" → ("MATHEMATICS", ["Kindergarten", "K"])
             "MATHEMATICS"    → ("MATHEMATICS", [])
        """
        for suffix, hints in self._GRADE_SUFFIX_HINTS.items():
            if subject_id.endswith(suffix):
                return subject_id[:-len(suffix)], hints
        return subject_id, []

    def _resolve_grade_for_subject(
        self, subject_id: str, collection_name: str = "curriculum_published",
        grade_hints: Optional[List[str]] = None,
    ) -> Optional[str]:
        """Find which grade document contains this subject.

        If grade_hints are provided (from a grade suffix), try those first
        for an O(1) lookup before falling back to a full scan.
        """
        # Fast path: try grade hints first
        for hint in (grade_hints or []):
            doc_ref = (
                self.client.collection(collection_name)
                .document(hint)
                .collection("subjects")
                .document(subject_id)
            )
            if doc_ref.get().exists:
                return hint

        # Slow path: scan all grade documents
        for grade_doc in self.client.collection(collection_name).stream():
            subj_ref = grade_doc.reference.collection("subjects").document(subject_id)
            if subj_ref.get().exists:
                return grade_doc.id
        return None

    def _read_nodes_from_curriculum(
        self, grade: str, subject_id: str, collection_name: str = "curriculum_published"
    ) -> List[Dict[str, Any]]:
        """Build flat node list from a hierarchical curriculum document."""
        doc_ref = (
            self.client.collection(collection_name)
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )
        doc = doc_ref.get()
        if not doc.exists:
            return []

        data = doc.to_dict()
        nodes: List[Dict[str, Any]] = []

        units = data.get("curriculum", data.get("units", []))
        for unit in units:
            unit_id = unit.get("unit_id", "")
            for skill in unit.get("skills", []):
                skill_id = skill.get("skill_id", "")
                nodes.append({
                    "id": skill_id,
                    "type": "skill",
                    "entity_type": "skill",
                    "label": skill.get("skill_description", skill_id),
                    "unit_id": unit_id,
                    "unit_title": unit.get("unit_title", ""),
                    "skill_order": skill.get("skill_order", 0),
                })

                for sub in skill.get("subskills", []):
                    sub_id = sub.get("subskill_id", "")
                    node: Dict[str, Any] = {
                        "id": sub_id,
                        "type": "subskill",
                        "entity_type": "subskill",
                        "label": sub.get("subskill_description", sub_id),
                        "skill_id": skill_id,
                        "unit_id": unit_id,
                        "subskill_order": sub.get("subskill_order", 0),
                    }
                    tp = sub.get("target_primitive")
                    if tp:
                        node["primitive_type"] = tp
                    eval_modes = sub.get("target_eval_modes")
                    if eval_modes:
                        node["eval_modes"] = eval_modes
                    nodes.append(node)

        return nodes

    def _read_edges_from_graph(
        self, grade: str, subject_id: str, published_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Read edges from curriculum_graphs/{grade}/subjects/{subject_id}/edges/."""
        edges_coll = (
            self.curriculum_graphs
            .document(grade)
            .collection("subjects")
            .document(subject_id)
            .collection("edges")
        )

        query = edges_coll.where("is_draft", "==", False) if published_only else edges_coll

        edges: List[Dict[str, Any]] = []
        for doc in query.stream():
            e = doc.to_dict()
            edges.append({
                "id": e.get("edge_id", ""),
                "source": e.get("source_entity_id", ""),
                "source_type": e.get("source_entity_type", ""),
                "target": e.get("target_entity_id", ""),
                "target_type": e.get("target_entity_type", ""),
                "threshold": e.get("min_proficiency_threshold", 0.8),
                "relationship": e.get("relationship", "prerequisite"),
                "strength": e.get("strength", 1.0),
                "is_prerequisite": e.get("is_prerequisite", True),
                "rationale": e.get("rationale"),
                "authored_by": e.get("authored_by", "human"),
                "confidence": e.get("confidence"),
                "version_id": e.get("version_id"),
            })

        return edges

    # ------------------------------------------------------------------
    # Public graph accessor — JIT flattens from hierarchical Firestore
    # ------------------------------------------------------------------

    async def get_curriculum_graph(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get curriculum graph by JIT-flattening from hierarchical Firestore.

        Reads nodes from curriculum_published (or curriculum_drafts) and edges
        from curriculum_graphs/{grade}/subjects/{subject_id}/edges/, then
        assembles the flat {nodes, edges} format that Pulse/LearningPaths expect.

        Callers (LearningPathsService) cache the result in-memory, so this
        only runs once per subject per backend process.

        Args:
            subject_id: Subject identifier (e.g., "MATHEMATICS", "LANGUAGE_ARTS")
            version_type: "published" or "draft" (default: "published")
            version_id: Ignored (kept for interface compatibility)

        Returns:
            {
                "id": str,
                "subject_id": str,
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
            collection_name = (
                "curriculum_published" if version_type == "published"
                else "curriculum_drafts"
            )

            # Strip grade suffix (e.g. MATHEMATICS_GK → MATHEMATICS)
            # and extract grade hints for fast resolution.
            bare_subject_id, grade_hints = self._strip_grade_suffix(subject_id)

            grade = self._resolve_grade_for_subject(
                bare_subject_id, collection_name, grade_hints
            )
            if not grade:
                logger.info(
                    f"No {collection_name} document found for {bare_subject_id}"
                )
                return None

            nodes = self._read_nodes_from_curriculum(grade, bare_subject_id, collection_name)
            published_only = version_type == "published"
            edges = self._read_edges_from_graph(grade, bare_subject_id, published_only)

            now = datetime.now(timezone.utc).isoformat()
            skill_count = sum(1 for n in nodes if n.get("type") == "skill")
            subskill_count = sum(1 for n in nodes if n.get("type") == "subskill")
            rel_counts = Counter(e.get("relationship", "prerequisite") for e in edges)

            result: Dict[str, Any] = {
                "id": f"{subject_id}_jit_{version_type}",
                "subject_id": subject_id,
                "grade": grade,
                "base_subject_id": bare_subject_id,
                "version_id": "latest",
                "version_type": version_type,
                "graph": {
                    "nodes": nodes,
                    "edges": edges,
                },
                "metadata": {
                    "entity_counts": {
                        "skills": skill_count,
                        "subskills": subskill_count,
                        "total": len(nodes),
                    },
                    "edge_count": len(edges),
                    "edge_counts": {
                        "total": len(edges),
                        "prerequisite": rel_counts.get("prerequisite", 0),
                        "builds_on": rel_counts.get("builds_on", 0),
                        "reinforces": rel_counts.get("reinforces", 0),
                        "parallel": rel_counts.get("parallel", 0),
                        "applies": rel_counts.get("applies", 0),
                    },
                },
                "generated_at": now,
                "last_accessed": now,
                "source": "jit_flatten",
            }

            logger.info(
                f"JIT-flattened graph for {bare_subject_id} (grade={grade}): "
                f"{len(nodes)} nodes, {len(edges)} edges"
            )
            return result

        except Exception as e:
            logger.error(f"Error JIT-flattening curriculum graph: {str(e)}")
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
        If grade is provided, does a direct O(1) lookup (tries both
        short-code and long-form keys, e.g. 'K' and 'Kindergarten').
        Otherwise searches across all grades.

        Returns:
            Full curriculum document with hierarchy, subskill_index, and stats,
            or None if not deployed yet.
        """
        # Grade alias map for Firestore doc key lookup
        _GRADE_ALIASES = {
            "K": "Kindergarten", "Kindergarten": "K",
            "PK": "Pre-K", "Pre-K": "PK",
            **{str(i): f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade"
               for i in range(1, 13)},
            **{f"{i}{'st' if i==1 else 'nd' if i==2 else 'rd' if i==3 else 'th'} Grade": str(i)
               for i in range(1, 13)},
        }

        try:
            if grade:
                # Try the grade key as-is first, then its alias
                for key in [grade, _GRADE_ALIASES.get(grade)]:
                    if not key:
                        continue
                    doc_ref = self.client.collection('curriculum_published').document(key).collection('subjects').document(subject_id)
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
        """Get a single subskill's mastery lifecycle document.

        Resolves through curriculum lineage: tries canonical ID first,
        falls back to original ID with lazy migration trigger.
        """
        try:
            canonical = await self._resolver.resolve(subskill_id)
            collection = self._mastery_lifecycle_subcollection(student_id)

            doc = collection.document(canonical).get()
            if doc.exists:
                return doc.to_dict()

            # Fallback: try original ID if different
            if canonical != subskill_id:
                old_doc = collection.document(subskill_id).get()
                if old_doc.exists:
                    return old_doc.to_dict()

            return None
        except Exception as e:
            logger.error(f"Error getting mastery lifecycle for {subskill_id}: {e}")
            return None

    async def get_mastery_lifecycles_batch(
        self,
        student_id: int,
        subskill_ids: List[str],
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """Batch-read multiple mastery lifecycle docs in a single Firestore call.

        Resolves all IDs through lineage. Returns results keyed by the
        ORIGINAL input IDs so callers don't need to know about resolution.
        """
        if not subskill_ids:
            return {}
        try:
            resolved = await self._resolver.resolve_batch(subskill_ids)
            collection = self._mastery_lifecycle_subcollection(student_id)

            # Build refs for canonical IDs
            canonical_ids = list(set(resolved.values()))
            doc_refs = [collection.document(cid) for cid in canonical_ids]
            docs = self.client.get_all(doc_refs)
            canonical_data: Dict[str, Optional[Dict[str, Any]]] = {}
            for doc in docs:
                canonical_data[doc.id] = doc.to_dict() if doc.exists else None

            # Map back to original input IDs
            result: Dict[str, Optional[Dict[str, Any]]] = {}
            for sid in subskill_ids:
                cid = resolved[sid]
                result[sid] = canonical_data.get(cid)

            # Fallback: for any None result where original != canonical, try original
            for sid in subskill_ids:
                if result[sid] is None and resolved[sid] != sid:
                    old_doc = collection.document(sid).get()
                    if old_doc.exists:
                        result[sid] = old_doc.to_dict()

            return result
        except Exception as e:
            logger.error(f"Error batch-reading mastery lifecycles: {e}")
            return {sid: None for sid in subskill_ids}

    async def upsert_mastery_lifecycle(
        self,
        student_id: int,
        subskill_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update a subskill's mastery lifecycle document.

        Always writes to the canonical (resolved) subskill_id.
        """
        try:
            canonical = await self._resolver.resolve(subskill_id)
            await self._ensure_student_document(student_id)

            # Update the subskill_id field in data to canonical
            if canonical != subskill_id:
                data = {**data, "subskill_id": canonical}

            doc_ref = self._mastery_lifecycle_subcollection(student_id).document(canonical)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted mastery_lifecycle/{canonical} for student {student_id}")
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

    async def batch_write_mastery_lifecycles(
        self,
        student_id: int,
        lifecycles: List[Dict[str, Any]],
    ) -> bool:
        """Batch write mastery lifecycle documents for a student.

        Used by diagnostic seeding to write many lifecycle docs at once.
        Chunks at 400 per batch (Firestore limit is 500).
        """
        try:
            await self._ensure_student_document(student_id)
            subcol = self._mastery_lifecycle_subcollection(student_id)

            for i in range(0, len(lifecycles), 400):
                chunk = lifecycles[i:i + 400]
                batch = self.client.batch()
                for lc in chunk:
                    subskill_id = lc.get("subskill_id", "")
                    if not subskill_id:
                        continue
                    doc_ref = subcol.document(subskill_id)
                    firestore_data = self._prepare_firestore_data(lc)
                    batch.set(doc_ref, firestore_data, merge=True)
                batch.commit()

            logger.info(
                f"Batch wrote {len(lifecycles)} mastery lifecycles "
                f"for student {student_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Error in batch write mastery lifecycles: {e}")
            return False

    # ============================================================================
    # ITEM CALIBRATION & STUDENT ABILITY (IRT Difficulty Calibration PRD §5–6)
    # ============================================================================

    def _item_calibration_collection(self):
        """Get reference to item_calibration/ (top-level, shared across students)."""
        return self.client.collection('item_calibration')

    def _ability_subcollection(self, student_id: int):
        """Get reference to students/{student_id}/ability"""
        return self._student_doc(student_id).collection('ability')

    async def get_item_calibration(
        self, item_key: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single item calibration document."""
        try:
            doc_ref = self._item_calibration_collection().document(item_key)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting item calibration for {item_key}: {e}")
            return None

    async def upsert_item_calibration(
        self, item_key: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update an item calibration document."""
        try:
            doc_ref = self._item_calibration_collection().document(item_key)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted item_calibration/{item_key}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting item calibration: {e}")
            raise

    async def get_all_item_calibrations(
        self, primitive_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all item calibration docs, optionally filtered by primitive_type."""
        try:
            query = self._item_calibration_collection()
            if primitive_type:
                query = query.where('primitive_type', '==', primitive_type)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting item calibrations: {e}")
            return []

    async def get_student_ability(
        self, student_id: int, skill_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a single student ability document. Resolves through lineage."""
        try:
            canonical = await self._resolver.resolve_skill(skill_id)
            doc_ref = self._ability_subcollection(student_id).document(canonical)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()

            # Fallback to original ID
            if canonical != skill_id:
                old_doc = self._ability_subcollection(student_id).document(skill_id).get()
                if old_doc.exists:
                    return old_doc.to_dict()

            return None
        except Exception as e:
            logger.error(f"Error getting student ability for {skill_id}: {e}")
            return None

    async def upsert_student_ability(
        self, student_id: int, skill_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create or update a student ability document."""
        try:
            await self._ensure_student_document(student_id)
            doc_ref = self._ability_subcollection(student_id).document(skill_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Upserted ability/{skill_id} for student {student_id}")
            return firestore_data
        except Exception as e:
            logger.error(f"Error upserting student ability: {e}")
            raise

    async def batch_write_student_abilities(
        self,
        student_id: int,
        abilities: List[Dict[str, Any]],
    ) -> bool:
        """Batch-write multiple student ability docs in a single Firestore commit."""
        if not abilities:
            return True
        try:
            await self._ensure_student_document(student_id)
            batch = self.client.batch()
            collection = self._ability_subcollection(student_id)
            for ab in abilities:
                skill_id = ab.get("skill_id", "")
                if not skill_id:
                    continue
                doc_ref = collection.document(skill_id)
                batch.set(doc_ref, self._prepare_firestore_data(ab), merge=True)
            batch.commit()
            logger.info(f"Batch-wrote {len(abilities)} ability docs for student {student_id}")
            return True
        except Exception as e:
            logger.error(f"Error in batch write student abilities: {e}")
            return False

    async def get_all_student_abilities(
        self, student_id: int
    ) -> List[Dict[str, Any]]:
        """Get all ability documents for a student."""
        try:
            return [
                doc.to_dict()
                for doc in self._ability_subcollection(student_id).stream()
            ]
        except Exception as e:
            logger.error(f"Error getting student abilities: {e}")
            return []

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
    # PULSE SESSION METHODS (Adaptive Learning Loop — Lumina Pulse PRD)
    # ============================================================================

    async def save_pulse_session(
        self,
        session_id: str,
        data: Dict[str, Any],
    ) -> None:
        """Save or update a Pulse session document."""
        try:
            doc_ref = self.client.collection('pulse_sessions').document(session_id)
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
            logger.info(f"Saved pulse session {session_id}")
        except Exception as e:
            logger.error(f"Error saving pulse session {session_id}: {e}")
            raise

    async def get_pulse_session(
        self,
        session_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a Pulse session by ID."""
        try:
            doc_ref = self.client.collection('pulse_sessions').document(session_id)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting pulse session {session_id}: {e}")
            return None

    async def get_student_pulse_sessions(
        self,
        student_id: int,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get all Pulse sessions for a student, optionally filtered by status."""
        try:
            query = (
                self.client.collection('pulse_sessions')
                .where('student_id', '==', student_id)
            )
            if status:
                query = query.where('status', '==', status)
            return [doc.to_dict() for doc in query.stream()]
        except Exception as e:
            logger.error(f"Error getting pulse sessions for student {student_id}: {e}")
            return []

    # ============================================================================
    # PULSE PRIMITIVE HISTORY (rolling window of recently-served primitives)
    # ============================================================================

    async def get_pulse_primitive_history(
        self,
        student_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get the primitive history doc for a student."""
        try:
            doc_ref = (
                self.client.collection('students')
                .document(str(student_id))
                .collection('pulse_state')
                .document('primitive_history')
            )
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.error(f"Error getting pulse primitive history for student {student_id}: {e}")
            return None

    async def save_pulse_primitive_history(
        self,
        student_id: int,
        data: Dict[str, Any],
    ) -> None:
        """Save/update the primitive history doc for a student."""
        try:
            doc_ref = (
                self.client.collection('students')
                .document(str(student_id))
                .collection('pulse_state')
                .document('primitive_history')
            )
            firestore_data = self._prepare_firestore_data(data)
            doc_ref.set(firestore_data, merge=True)
        except Exception as e:
            logger.error(f"Error saving pulse primitive history for student {student_id}: {e}")
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
