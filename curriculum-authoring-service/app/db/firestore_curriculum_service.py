"""
Firestore write service for curriculum graph entities.

Manages writes to hierarchical graph subcollections:
  curriculum_graphs/{grade}/subjects/{subject_id}/edges/{edge_id}
  curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/{suggestion_id}

Also provides the shared Firestore client used by other services.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from google.cloud import firestore
from google.oauth2 import service_account
import os

from app.core.config import settings

logger = logging.getLogger(__name__)


class FirestoreCurriculumSync:
    """Manages Firestore client and graph subcollection writes."""

    def __init__(self):
        self.client: Optional[firestore.Client] = None
        self._collections: Dict[str, Any] = {}

    def initialize(self):
        """Initialize Firestore connection."""
        try:
            logger.info(f"Connecting to Firestore for project: {settings.FIREBASE_PROJECT_ID}")

            if hasattr(settings, 'FIREBASE_CREDENTIALS_PATH') and settings.FIREBASE_CREDENTIALS_PATH:
                credentials_path = settings.FIREBASE_CREDENTIALS_PATH
                if not os.path.isabs(credentials_path):
                    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                    credentials_path = os.path.join(project_root, credentials_path)

                if os.path.exists(credentials_path):
                    credentials = service_account.Credentials.from_service_account_file(credentials_path)
                    self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID, credentials=credentials)
                else:
                    logger.warning(f"Firebase credentials not found: {credentials_path}, using default")
                    self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID)
            else:
                self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID)

            # Collection references for legacy flat reads (versions, primitives)
            self._collections = {
                "versions": self.client.collection("curriculum_versions"),
                "primitives": self.client.collection("curriculum_primitives"),
                "prerequisites": self.client.collection("curriculum_prerequisites"),
                "subskill_primitives": self.client.collection("curriculum_subskill_primitives"),
            }

            logger.info("Firestore client initialized")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            raise

    def _prepare(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively convert unsupported types for Firestore."""
        prepared = {}
        for key, value in data.items():
            if value is None:
                prepared[key] = None
            elif isinstance(value, (str, int, float, bool)):
                prepared[key] = value
            elif isinstance(value, dict):
                prepared[key] = self._prepare(value)
            elif isinstance(value, list):
                prepared[key] = [
                    self._prepare(item) if isinstance(item, dict) else item
                    for item in value
                ]
            elif isinstance(value, datetime):
                prepared[key] = value.isoformat()
            else:
                prepared[key] = str(value)
        return prepared

    # ========================================================================
    # GRAPH COLLECTION HELPERS
    # ========================================================================

    def _graph_ref(self, grade: str, subject_id: str):
        """Get the curriculum_graphs subject document reference."""
        return (
            self.client.collection("curriculum_graphs")
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )

    def _edges_collection(self, grade: str, subject_id: str):
        """Get edges subcollection: curriculum_graphs/{grade}/subjects/{subject_id}/edges/."""
        return self._graph_ref(grade, subject_id).collection("edges")

    def _suggestions_collection(self, grade: str, subject_id: str):
        """Get suggestions subcollection: curriculum_graphs/{grade}/subjects/{subject_id}/suggestions/."""
        return self._graph_ref(grade, subject_id).collection("suggestions")

    async def _resolve_grade(self, subject_id: str) -> Optional[str]:
        """Resolve grade for a subject by checking draft/published docs."""
        for collection_name in ("curriculum_drafts", "curriculum_published"):
            for grade_doc in self.client.collection(collection_name).stream():
                doc = grade_doc.reference.collection("subjects").document(subject_id).get()
                if doc.exists:
                    return grade_doc.id
        return None

    # ========================================================================
    # EDGE SYNC (hierarchical: curriculum_graphs/{grade}/subjects/{subject_id}/edges/)
    # ========================================================================

    async def sync_edge(self, edge_data: Dict[str, Any], grade: Optional[str] = None) -> None:
        """Sync an edge to the hierarchical graph subcollection."""
        try:
            doc_id = edge_data["edge_id"]
            subject_id = edge_data["subject_id"]
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                logger.error(f"Cannot resolve grade for {subject_id} — edge {doc_id} not synced")
                return

            # Ensure the graph subject doc exists (shell)
            graph_ref = self._graph_ref(grade, subject_id)
            graph_doc = graph_ref.get()
            if not graph_doc.exists:
                graph_ref.set({"subject_id": subject_id, "grade": grade, "created_at": datetime.utcnow().isoformat()})

            data = self._prepare(edge_data)
            self._edges_collection(grade, subject_id).document(doc_id).set(data)
            logger.info(f"Synced edge {doc_id} to curriculum_graphs/{grade}/subjects/{subject_id}/edges/")
        except Exception as e:
            logger.error(f"Firestore sync failed for edge: {e}")

    async def delete_edge(self, edge_id: str, subject_id: Optional[str] = None, grade: Optional[str] = None) -> None:
        """Delete an edge from the hierarchical graph subcollection."""
        try:
            if subject_id and grade:
                self._edges_collection(grade, subject_id).document(edge_id).delete()
                logger.info(f"Deleted edge {edge_id} from curriculum_graphs/{grade}/subjects/{subject_id}/edges/")
                return

            # Find the edge by scanning graph subjects
            for grade_doc in self.client.collection("curriculum_graphs").stream():
                for subject_doc in grade_doc.reference.collection("subjects").stream():
                    doc = subject_doc.reference.collection("edges").document(edge_id).get()
                    if doc.exists:
                        doc.reference.delete()
                        logger.info(f"Deleted edge {edge_id} from curriculum_graphs/{grade_doc.id}/subjects/{subject_doc.id}/edges/")
                        return
            logger.warning(f"Edge {edge_id} not found in any graph subcollection")
        except Exception as e:
            logger.error(f"Firestore delete failed for edge {edge_id}: {e}")

    async def delete_edge_by_pair(self, pair_id: str, subject_id: Optional[str] = None, grade: Optional[str] = None) -> None:
        """Delete all edges sharing a pair_id (parallel edge pairs)."""
        try:
            if subject_id and grade:
                docs = self._edges_collection(grade, subject_id).where("pair_id", "==", pair_id).stream()
                for doc in docs:
                    doc.reference.delete()
                logger.info(f"Deleted edges with pair_id {pair_id}")
                return

            # Scan all graph subjects
            for grade_doc in self.client.collection("curriculum_graphs").stream():
                for subject_doc in grade_doc.reference.collection("subjects").stream():
                    docs = subject_doc.reference.collection("edges").where("pair_id", "==", pair_id).stream()
                    for doc in docs:
                        doc.reference.delete()
            logger.info(f"Deleted edges with pair_id {pair_id}")
        except Exception as e:
            logger.error(f"Firestore delete failed for pair {pair_id}: {e}")

    # ========================================================================
    # SUGGESTION SYNC (hierarchical)
    # ========================================================================

    async def sync_suggestion(self, subject_id: str, suggestion_data: Dict[str, Any], grade: Optional[str] = None) -> None:
        """Write a suggestion to the graph subcollection."""
        try:
            doc_id = suggestion_data.get("suggestion_id", "")
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                logger.error(f"Cannot resolve grade for {subject_id} — suggestion not synced")
                return

            data = self._prepare(suggestion_data)
            self._suggestions_collection(grade, subject_id).document(doc_id).set(data)
        except Exception as e:
            logger.error(f"Firestore sync failed for suggestion: {e}")

    async def update_suggestion(self, subject_id: str, suggestion_id: str, updates: Dict[str, Any], grade: Optional[str] = None) -> None:
        """Update a suggestion in the graph subcollection."""
        try:
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                return
            self._suggestions_collection(grade, subject_id).document(suggestion_id).update(updates)
        except Exception as e:
            logger.error(f"Firestore update failed for suggestion {suggestion_id}: {e}")

    async def delete_all_suggestions(self, subject_id: str, grade: Optional[str] = None) -> int:
        """Delete all suggestions for a subject. Returns count deleted."""
        try:
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                return 0
            coll = self._suggestions_collection(grade, subject_id)
            count = 0
            for doc in coll.stream():
                doc.reference.delete()
                count += 1
            return count
        except Exception as e:
            logger.error(f"Failed to clear suggestions for {subject_id}: {e}")
            return 0

    async def batch_update_suggestions(self, subject_id: str, updates: List[tuple], grade: Optional[str] = None) -> None:
        """Batch update suggestions. updates is list of (suggestion_id, update_dict)."""
        try:
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                return
            coll = self._suggestions_collection(grade, subject_id)
            batch = self.client.batch()
            batch_count = 0
            for suggestion_id, update_dict in updates:
                batch.update(coll.document(suggestion_id), update_dict)
                batch_count += 1
                if batch_count >= 450:
                    batch.commit()
                    batch = self.client.batch()
                    batch_count = 0
            if batch_count > 0:
                batch.commit()
        except Exception as e:
            logger.error(f"Batch suggestion update failed for {subject_id}: {e}")

    # ========================================================================
    # PUBLISH EDGE SYNC (batch update edges in graph subcollection)
    # ========================================================================

    async def publish_edges(self, subject_id: str, new_version_id: str, grade: Optional[str] = None) -> int:
        """Publish all draft edges for a subject (set is_draft=False, update version_id)."""
        try:
            if not grade:
                grade = await self._resolve_grade(subject_id)
            if not grade:
                return 0

            coll = self._edges_collection(grade, subject_id)
            draft_edges = list(coll.where("is_draft", "==", True).stream())

            if not draft_edges:
                return 0

            batch = self.client.batch()
            count = 0
            for doc in draft_edges:
                batch.update(doc.reference, {"is_draft": False, "version_id": new_version_id})
                count += 1
                if count % 450 == 0:
                    batch.commit()
                    batch = self.client.batch()
            if count % 450 != 0:
                batch.commit()

            logger.info(f"Published {count} edges for {subject_id}")
            return count
        except Exception as e:
            logger.error(f"Failed to publish edges for {subject_id}: {e}")
            return 0


# Global instance
firestore_curriculum_sync = FirestoreCurriculumSync()
