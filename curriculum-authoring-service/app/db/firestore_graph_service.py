"""
Google Firestore service for curriculum graph caching
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
    """Firestore service for curriculum graph storage and caching"""

    def __init__(self):
        """Initialize Firestore client and collections"""
        self.client: Optional[firestore.Client] = None
        self.curriculum_graphs = None

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

            # Collection references for graph caching
            self.curriculum_graphs = self.client.collection('curriculum_graphs')
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


# Global instance
firestore_graph_service = CurriculumFirestore()
