"""
Google Firestore service for curriculum graph caching and curriculum deployment
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from google.cloud import firestore
from google.oauth2 import service_account
import os

from app.core.config import settings

logger = logging.getLogger(__name__)


class CurriculumFirestore:
    """Firestore service for curriculum graph storage, caching, and deployment"""

    def __init__(self):
        """Initialize Firestore client and collections"""
        self.client: Optional[firestore.Client] = None
        self.curriculum_graphs = None
        self.curriculum_published = None

    def initialize(self):
        """Initialize Firestore connection and create collection references"""
        try:
            logger.info(f"🔌 Connecting to Firestore for project: {settings.FIREBASE_PROJECT_ID}")

            # Initialize Firestore client with Firebase credentials
            if hasattr(settings, 'FIREBASE_CREDENTIALS_PATH') and settings.FIREBASE_CREDENTIALS_PATH:
                # Construct full path to credentials
                credentials_path = settings.FIREBASE_CREDENTIALS_PATH
                if not os.path.isabs(credentials_path):
                    # If relative path, make it absolute from project root
                    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                    credentials_path = os.path.join(project_root, credentials_path)

                if os.path.exists(credentials_path):
                    logger.info(f"📄 Using Firebase credentials from: {credentials_path}")
                    credentials = service_account.Credentials.from_service_account_file(credentials_path)
                    self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID, credentials=credentials)
                else:
                    logger.warning(f"⚠️ Firebase credentials file not found: {credentials_path}, using default credentials")
                    self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID)
            else:
                logger.info("📄 Using default Firebase credentials")
                self.client = firestore.Client(project=settings.FIREBASE_PROJECT_ID)

            # Collection references
            self.curriculum_graphs = self.client.collection('curriculum_graphs')
            self.curriculum_published = self.client.collection('curriculum_published')
            logger.info("✅ Firestore connected successfully")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize Firestore: {e}")
            raise

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
    # CURRICULUM GRAPH OPERATIONS
    # ============================================================================

    async def create_graph_document(
        self,
        subject_id: str,
        version_id: str,
        version_type: str,
        graph_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create or update a curriculum graph document"""
        try:
            doc_id = f"{subject_id}_{version_id}_{version_type}"

            document = {
                "id": doc_id,
                "subject_id": subject_id,
                "version_id": version_id,
                "version_type": version_type,  # "published" or "draft"
                "graph": graph_data,
                "metadata": metadata or {},
                "generated_at": datetime.utcnow().isoformat(),
                "last_accessed": datetime.utcnow().isoformat()
            }

            # Prepare for Firestore
            firestore_data = self._prepare_firestore_data(document)

            # Upsert (create or replace)
            doc_ref = self.curriculum_graphs.document(doc_id)
            doc_ref.set(firestore_data)

            logger.info(f"✅ Saved graph for {subject_id} (version: {version_id}, type: {version_type})")

            return firestore_data

        except Exception as e:
            logger.error(f"❌ Failed to save graph document: {e}")
            raise

    async def get_graph_document(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve a curriculum graph document"""
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
                    doc_data["last_accessed"] = datetime.utcnow().isoformat()
                    doc.reference.update({"last_accessed": doc_data["last_accessed"]})

                    logger.info(f"✅ Retrieved graph for {subject_id} (type: {version_type})")
                    return doc_data
                else:
                    logger.info(f"ℹ️ No graph found for {subject_id} (type: {version_type})")
                    return None
            else:
                # Get specific version
                doc_id = f"{subject_id}_{version_id}_{version_type}"
                doc_ref = self.curriculum_graphs.document(doc_id)
                doc = doc_ref.get()

                if doc.exists:
                    doc_data = doc.to_dict()

                    # Update last accessed time
                    doc_data["last_accessed"] = datetime.utcnow().isoformat()
                    doc_ref.update({"last_accessed": doc_data["last_accessed"]})

                    logger.info(f"✅ Retrieved graph for {subject_id} (version: {version_id})")
                    return doc_data
                else:
                    logger.info(f"ℹ️ Graph not found for {subject_id}")
                    return None

        except Exception as e:
            logger.error(f"❌ Failed to retrieve graph: {e}")
            # On error, return None to fall back to generating fresh
            return None

    async def delete_graph_documents(
        self,
        subject_id: str,
        version_type: Optional[str] = None
    ) -> int:
        """Delete graph documents for a subject (all or specific version type)"""
        try:
            # Build query for documents to delete
            query = self.curriculum_graphs.where('subject_id', '==', subject_id)

            if version_type:
                query = query.where('version_type', '==', version_type)

            docs = list(query.stream())

            # Delete each document
            deleted_count = 0
            batch = self.client.batch()

            for doc in docs:
                batch.delete(doc.reference)
                deleted_count += 1

            # Commit batch delete
            if deleted_count > 0:
                batch.commit()

            logger.info(f"✅ Deleted {deleted_count} graph document(s) for {subject_id}")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Failed to delete graph documents: {e}")
            raise

    async def get_graph_status(
        self,
        subject_id: str
    ) -> Dict[str, Any]:
        """Get cache status information for a subject"""
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
            logger.error(f"❌ Failed to get graph status: {e}")
            raise

    async def list_all_cached_subjects(self) -> List[str]:
        """List all subjects that have cached graphs"""
        try:
            # Get all documents from the collection
            docs = self.curriculum_graphs.stream()

            # Extract unique subject_ids
            subject_ids = set()
            for doc in docs:
                doc_data = doc.to_dict()
                if "subject_id" in doc_data:
                    subject_ids.add(doc_data["subject_id"])

            results = sorted(list(subject_ids))
            logger.info(f"✅ Found {len(results)} subjects with cached graphs")
            return results

        except Exception as e:
            logger.error(f"❌ Failed to list cached subjects: {e}")
            raise

    async def list_all_graph_documents(self) -> List[Dict[str, Any]]:
        """List all cached graph documents with metadata"""
        try:
            docs = self.curriculum_graphs.stream()

            graph_docs = []
            for doc in docs:
                doc_data = doc.to_dict()
                graph_docs.append({
                    "id": doc_data.get("id"),
                    "subject_id": doc_data.get("subject_id"),
                    "version_id": doc_data.get("version_id"),
                    "version_type": doc_data.get("version_type"),
                    "generated_at": doc_data.get("generated_at"),
                    "last_accessed": doc_data.get("last_accessed"),
                    "metadata": doc_data.get("metadata", {})
                })

            # Sort by generated_at descending
            graph_docs.sort(key=lambda x: x.get("generated_at", ""), reverse=True)

            logger.info(f"✅ Found {len(graph_docs)} cached graph documents")
            return graph_docs

        except Exception as e:
            logger.error(f"❌ Failed to list graph documents: {e}")
            raise

    async def delete_all_graph_documents(self) -> int:
        """Delete ALL cached graph documents (use with caution!)"""
        try:
            docs = list(self.curriculum_graphs.stream())

            deleted_count = 0
            batch = self.client.batch()

            for doc in docs:
                batch.delete(doc.reference)
                deleted_count += 1

            # Commit batch delete
            if deleted_count > 0:
                batch.commit()

            logger.info(f"✅ Deleted {deleted_count} graph document(s) from cache")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Failed to delete all graph documents: {e}")
            raise

    async def delete_graph_documents_by_ids(self, document_ids: List[str]) -> int:
        """Delete specific graph documents by their IDs"""
        try:
            deleted_count = 0
            batch = self.client.batch()

            for doc_id in document_ids:
                doc_ref = self.curriculum_graphs.document(doc_id)
                batch.delete(doc_ref)
                deleted_count += 1

            # Commit batch delete
            if deleted_count > 0:
                batch.commit()

            logger.info(f"✅ Deleted {deleted_count} specific graph document(s)")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Failed to delete specific graph documents: {e}")
            raise

    # ============================================================================
    # CURRICULUM DEPLOYMENT OPERATIONS
    # ============================================================================

    async def deploy_curriculum(
        self,
        subject_id: str,
        curriculum_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Deploy published curriculum to Firestore for backend consumption.

        Writes to curriculum_published/{grade}/subjects/{subject_id}.
        The grade subcollection allows O(1) grade-scoped lookups.
        """
        try:
            grade = curriculum_data.get("grade", "K")
            firestore_data = self._prepare_firestore_data(curriculum_data)

            # Ensure grade document exists with metadata
            grade_doc_ref = self.curriculum_published.document(grade)
            grade_doc_ref.set({"grade": grade}, merge=True)

            # Write subject under grade subcollection
            doc_ref = grade_doc_ref.collection("subjects").document(subject_id)
            doc_ref.set(firestore_data)

            logger.info(f"✅ Deployed curriculum for {subject_id} (grade={grade}) to Firestore (curriculum_published/{grade}/subjects/{subject_id})")
            return firestore_data

        except Exception as e:
            logger.error(f"❌ Failed to deploy curriculum for {subject_id}: {e}")
            raise

    async def get_deployment_status(
        self,
        subject_id: str,
        grade: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get deployment status for a subject.

        If grade is provided, does a direct O(1) lookup.
        Otherwise searches across all grades.
        """
        try:
            doc_data = None

            if grade:
                doc_ref = self.curriculum_published.document(grade).collection("subjects").document(subject_id)
                doc = doc_ref.get()
                if doc.exists:
                    doc_data = doc.to_dict()
            else:
                # Search across all grades
                for grade_doc in self.curriculum_published.stream():
                    doc_ref = grade_doc.reference.collection("subjects").document(subject_id)
                    doc = doc_ref.get()
                    if doc.exists:
                        doc_data = doc.to_dict()
                        break

            if doc_data:
                return {
                    "subject_id": subject_id,
                    "grade": doc_data.get("grade"),
                    "deployed": True,
                    "version_id": doc_data.get("version_id"),
                    "version_number": doc_data.get("version_number"),
                    "deployed_at": doc_data.get("deployed_at"),
                    "deployed_by": doc_data.get("deployed_by"),
                    "stats": doc_data.get("stats", {}),
                }
            else:
                return {
                    "subject_id": subject_id,
                    "deployed": False,
                }

        except Exception as e:
            logger.error(f"❌ Failed to get deployment status for {subject_id}: {e}")
            raise

    async def list_deployed_subjects(self, grade: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all subjects that have been deployed.

        If grade is provided, lists only subjects for that grade (O(1)).
        Otherwise lists all subjects across all grades.
        """
        try:
            deployed = []

            if grade:
                # O(1) grade-scoped lookup
                docs = self.curriculum_published.document(grade).collection("subjects").stream()
                for doc in docs:
                    doc_data = doc.to_dict()
                    deployed.append({
                        "subject_id": doc.id,
                        "subject_name": doc_data.get("subject_name"),
                        "grade": doc_data.get("grade", grade),
                        "version_number": doc_data.get("version_number"),
                        "deployed_at": doc_data.get("deployed_at"),
                        "stats": doc_data.get("stats", {}),
                    })
            else:
                # All subjects across all grades
                for grade_doc in self.curriculum_published.stream():
                    grade_id = grade_doc.id
                    subjects = grade_doc.reference.collection("subjects").stream()
                    for doc in subjects:
                        doc_data = doc.to_dict()
                        deployed.append({
                            "subject_id": doc.id,
                            "subject_name": doc_data.get("subject_name"),
                            "grade": doc_data.get("grade", grade_id),
                            "version_number": doc_data.get("version_number"),
                            "deployed_at": doc_data.get("deployed_at"),
                            "stats": doc_data.get("stats", {}),
                        })

            return deployed

        except Exception as e:
            logger.error(f"❌ Failed to list deployed subjects: {e}")
            raise


# Global instance
firestore_graph_service = CurriculumFirestore()
