"""
Firestore dual-write sync service for curriculum entities.

Every BigQuery write in the authoring service is followed by a Firestore sync
call from this module. Firestore failures are logged but never propagated —
BigQuery remains the source of truth.

Collections:
  curriculum_subjects/{subject_id}
  curriculum_units/{unit_id}
  curriculum_skills/{skill_id}
  curriculum_subskills/{subskill_id}
  curriculum_prerequisites/{prerequisite_id}
  curriculum_versions/{version_id}
  curriculum_primitives/{primitive_id}
  curriculum_subskill_primitives/{subskill_id}_{primitive_id}
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
    """Syncs curriculum entity writes to Firestore collections."""

    def __init__(self):
        self.client: Optional[firestore.Client] = None
        self._collections: Dict[str, Any] = {}

    def initialize(self):
        """Initialize Firestore connection and collection references."""
        try:
            logger.info(f"Connecting to Firestore curriculum sync for project: {settings.FIREBASE_PROJECT_ID}")

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

            # Collection references matching BQ table names
            self._collections = {
                "subjects": self.client.collection("curriculum_subjects"),
                "units": self.client.collection("curriculum_units"),
                "skills": self.client.collection("curriculum_skills"),
                "subskills": self.client.collection("curriculum_subskills"),
                "prerequisites": self.client.collection("curriculum_prerequisites"),
                "versions": self.client.collection("curriculum_versions"),
                "primitives": self.client.collection("curriculum_primitives"),
                "subskill_primitives": self.client.collection("curriculum_subskill_primitives"),
            }

            logger.info("Firestore curriculum sync initialized")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Firestore curriculum sync: {e}")
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
    # SUBJECT SYNC
    # ========================================================================

    async def sync_subject(self, subject_data: Dict[str, Any]) -> None:
        """Sync a subject document to Firestore."""
        try:
            doc_id = subject_data["subject_id"]
            data = self._prepare(subject_data)
            self._collections["subjects"].document(doc_id).set(data)
            logger.info(f"Synced subject {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for subject: {e}")

    async def delete_subject(self, subject_id: str) -> None:
        """Delete a subject document from Firestore."""
        try:
            self._collections["subjects"].document(subject_id).delete()
            logger.info(f"Deleted subject {subject_id} from Firestore")
        except Exception as e:
            logger.error(f"Firestore delete failed for subject {subject_id}: {e}")

    # ========================================================================
    # UNIT SYNC
    # ========================================================================

    async def sync_unit(self, unit_data: Dict[str, Any]) -> None:
        """Sync a unit document to Firestore."""
        try:
            doc_id = unit_data["unit_id"]
            data = self._prepare(unit_data)
            self._collections["units"].document(doc_id).set(data)
            logger.info(f"Synced unit {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for unit: {e}")

    async def delete_unit(self, unit_id: str) -> None:
        """Delete a unit document from Firestore."""
        try:
            self._collections["units"].document(unit_id).delete()
            logger.info(f"Deleted unit {unit_id} from Firestore")
        except Exception as e:
            logger.error(f"Firestore delete failed for unit {unit_id}: {e}")

    # ========================================================================
    # SKILL SYNC
    # ========================================================================

    async def sync_skill(self, skill_data: Dict[str, Any]) -> None:
        """Sync a skill document to Firestore."""
        try:
            doc_id = skill_data["skill_id"]
            data = self._prepare(skill_data)
            self._collections["skills"].document(doc_id).set(data)
            logger.info(f"Synced skill {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for skill: {e}")

    async def delete_skill(self, skill_id: str) -> None:
        """Delete a skill document from Firestore."""
        try:
            self._collections["skills"].document(skill_id).delete()
            logger.info(f"Deleted skill {skill_id} from Firestore")
        except Exception as e:
            logger.error(f"Firestore delete failed for skill {skill_id}: {e}")

    # ========================================================================
    # SUBSKILL SYNC
    # ========================================================================

    async def sync_subskill(self, subskill_data: Dict[str, Any]) -> None:
        """Sync a subskill document to Firestore."""
        try:
            doc_id = subskill_data["subskill_id"]
            data = self._prepare(subskill_data)
            self._collections["subskills"].document(doc_id).set(data)
            logger.info(f"Synced subskill {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for subskill: {e}")

    async def delete_subskill(self, subskill_id: str) -> None:
        """Delete a subskill document from Firestore."""
        try:
            self._collections["subskills"].document(subskill_id).delete()
            logger.info(f"Deleted subskill {subskill_id} from Firestore")
        except Exception as e:
            logger.error(f"Firestore delete failed for subskill {subskill_id}: {e}")

    # ========================================================================
    # PREREQUISITE SYNC
    # ========================================================================

    async def sync_prerequisite(self, prerequisite_data: Dict[str, Any]) -> None:
        """Sync a prerequisite document to Firestore."""
        try:
            doc_id = prerequisite_data["prerequisite_id"]
            data = self._prepare(prerequisite_data)
            self._collections["prerequisites"].document(doc_id).set(data)
            logger.info(f"Synced prerequisite {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for prerequisite: {e}")

    async def delete_prerequisite(self, prerequisite_id: str) -> None:
        """Delete a prerequisite document from Firestore."""
        try:
            self._collections["prerequisites"].document(prerequisite_id).delete()
            logger.info(f"Deleted prerequisite {prerequisite_id} from Firestore")
        except Exception as e:
            logger.error(f"Firestore delete failed for prerequisite {prerequisite_id}: {e}")

    # ========================================================================
    # VERSION SYNC
    # ========================================================================

    async def sync_version(self, version_data: Dict[str, Any]) -> None:
        """Sync a version document to Firestore."""
        try:
            doc_id = version_data["version_id"]
            data = self._prepare(version_data)
            self._collections["versions"].document(doc_id).set(data)
            logger.info(f"Synced version {doc_id} to Firestore")
        except Exception as e:
            logger.error(f"Firestore sync failed for version: {e}")

    # ========================================================================
    # SUBSKILL-PRIMITIVE SYNC
    # ========================================================================

    async def sync_subskill_primitives(
        self,
        subskill_id: str,
        primitive_ids: List[str],
        version_id: str
    ) -> None:
        """Sync subskill-primitive associations to Firestore.

        Deletes old draft associations for this subskill and writes new ones.
        """
        try:
            batch = self.client.batch()

            # Delete existing associations for this subskill
            existing = self._collections["subskill_primitives"] \
                .where("subskill_id", "==", subskill_id) \
                .where("version_id", "==", version_id) \
                .stream()

            for doc in existing:
                batch.delete(doc.reference)

            # Write new associations
            now = datetime.utcnow().isoformat()
            for primitive_id in primitive_ids:
                doc_id = f"{subskill_id}_{primitive_id}"
                data = {
                    "subskill_id": subskill_id,
                    "primitive_id": primitive_id,
                    "version_id": version_id,
                    "is_draft": True,
                    "created_at": now,
                }
                batch.set(self._collections["subskill_primitives"].document(doc_id), data)

            batch.commit()
            logger.info(f"Synced {len(primitive_ids)} primitive associations for subskill {subskill_id}")

        except Exception as e:
            logger.error(f"Firestore sync failed for subskill primitives: {e}")

    # ========================================================================
    # PUBLISH SYNC (batch update across all entity collections)
    # ========================================================================

    async def sync_publish(
        self,
        subject_id: str,
        new_version_id: str,
        old_version_id: Optional[str] = None,
    ) -> None:
        """Sync a publish operation to Firestore.

        Updates all entities for a subject: set is_draft=False and version_id
        to the new version. Also deactivates the old version and activates
        the new one.

        Traverses the hierarchy once: subject → units → skills → subskills,
        collecting both update operations and child IDs in a single pass.
        Firestore batches are limited to 500 operations, so we chunk if needed.
        """
        try:
            publish_update = {"is_draft": False, "version_id": new_version_id}
            operations: List[tuple] = []  # (doc_ref, updates_dict)

            # 1. Deactivate old version
            if old_version_id:
                operations.append((
                    self._collections["versions"].document(old_version_id),
                    {"is_active": False},
                ))

            # 2. Update subject docs
            for doc in self._collections["subjects"].where("subject_id", "==", subject_id).stream():
                operations.append((doc.reference, publish_update))

            # 3. Traverse units → collect unit_ids + update
            unit_ids = []
            for doc in self._collections["units"].where("subject_id", "==", subject_id).stream():
                unit_ids.append(doc.id)
                operations.append((doc.reference, publish_update))

            # 4. Traverse skills → collect skill_ids + update
            skill_ids = []
            for unit_id in unit_ids:
                for doc in self._collections["skills"].where("unit_id", "==", unit_id).stream():
                    skill_ids.append(doc.id)
                    operations.append((doc.reference, publish_update))

            # 5. Traverse subskills → collect subskill_ids + update
            subskill_ids = []
            for skill_id in skill_ids:
                for doc in self._collections["subskills"].where("skill_id", "==", skill_id).stream():
                    subskill_ids.append(doc.id)
                    operations.append((doc.reference, publish_update))

            # 6. Update prerequisite docs (have subject_id directly)
            for doc in self._collections["prerequisites"].where("subject_id", "==", subject_id).stream():
                operations.append((doc.reference, publish_update))

            # 7. Update subskill-primitive associations
            for subskill_id in subskill_ids:
                for doc in self._collections["subskill_primitives"].where("subskill_id", "==", subskill_id).stream():
                    operations.append((doc.reference, publish_update))

            # Commit in batches of 500 (Firestore limit)
            for i in range(0, len(operations), 500):
                chunk = operations[i:i + 500]
                batch = self.client.batch()
                for doc_ref, updates in chunk:
                    batch.update(doc_ref, updates)
                batch.commit()

            logger.info(
                f"Publish sync complete for {subject_id}: "
                f"{len(operations)} documents updated to version {new_version_id}"
            )

        except Exception as e:
            logger.error(f"Firestore publish sync failed for {subject_id}: {e}")

    async def sync_rollback(
        self,
        subject_id: str,
        target_version_id: str,
    ) -> None:
        """Sync a rollback operation to Firestore.

        Sets the target version as active, deactivates all others for this subject.
        """
        try:
            batch = self.client.batch()

            # Get all versions for this subject
            versions = self._collections["versions"] \
                .where("subject_id", "==", subject_id) \
                .stream()

            now = datetime.utcnow().isoformat()
            for doc in versions:
                doc_data = doc.to_dict()
                if doc.id == target_version_id:
                    batch.update(doc.reference, {
                        "is_active": True,
                        "activated_at": now,
                    })
                elif doc_data.get("is_active"):
                    batch.update(doc.reference, {"is_active": False})

            batch.commit()
            logger.info(f"Rollback sync complete for {subject_id} to version {target_version_id}")

        except Exception as e:
            logger.error(f"Firestore rollback sync failed for {subject_id}: {e}")


# Global instance
firestore_curriculum_sync = FirestoreCurriculumSync()
