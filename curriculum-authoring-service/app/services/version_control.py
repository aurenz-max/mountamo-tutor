"""
Version control and publishing service
Manages draft/publish workflow and version history

Reads: Firestore-native via firestore_reader (curriculum_versions flat collection)
Writes: Version docs to curriculum_versions, publish via draft_curriculum_service
"""

import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.config import settings
from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.db.firestore_curriculum_reader import firestore_reader
from app.models.versioning import (
    Version, VersionCreate,
    DraftSummary, DraftChange,
    PublishRequest, PublishResponse
)

logger = logging.getLogger(__name__)


class VersionControl:
    """Manages curriculum versioning and publishing"""

    async def create_version(
        self,
        version_create: VersionCreate,
        user_id: str
    ) -> Version:
        """Create a new version record."""
        version_id = str(uuid.uuid4())
        now = datetime.utcnow()

        max_version = await firestore_reader.get_max_version_number(version_create.subject_id)

        version_data = {
            "version_id": version_id,
            "subject_id": version_create.subject_id,
            "version_number": max_version + 1,
            "description": version_create.description or settings.DEFAULT_VERSION_DESCRIPTION,
            "is_active": False,
            "created_at": now.isoformat(),
            "activated_at": None,
            "created_by": user_id,
            "change_summary": version_create.change_summary,
        }

        # Write to curriculum_versions collection
        firestore_curriculum_sync.client.collection("curriculum_versions").document(version_id).set(version_data)

        return Version(**version_data)

    async def get_active_version(self, subject_id: str, grade: Optional[str] = None) -> Optional[Version]:
        """Get the currently active version for a subject."""
        row = await firestore_reader.get_active_version(subject_id)
        return Version(**row) if row else None

    async def get_or_create_active_version(self, subject_id: str, user_id: str) -> str:
        """Get active version_id for a subject, or create one if none exists."""
        active_version = await self.get_active_version(subject_id)

        if active_version:
            return active_version.version_id

        # No active version exists — create version 1
        version_id = str(uuid.uuid4())
        now = datetime.utcnow()

        version_data = {
            "version_id": version_id,
            "subject_id": subject_id,
            "version_number": 1,
            "description": f"Initial {subject_id} curriculum",
            "is_active": True,
            "created_at": now.isoformat(),
            "activated_at": now.isoformat(),
            "created_by": user_id,
            "change_summary": "Initial version",
        }

        firestore_curriculum_sync.client.collection("curriculum_versions").document(version_id).set(version_data)
        logger.info(f"Created initial active version for {subject_id}: {version_id}")

        return version_id

    async def get_version_history(self, subject_id: str, grade: Optional[str] = None) -> List[Version]:
        """Get all versions for a subject."""
        rows = await firestore_reader.get_versions(subject_id)
        return [Version(**row) for row in rows]

    async def get_draft_changes(self, subject_id: str, grade: Optional[str] = None) -> DraftSummary:
        """Get summary of all draft changes for a subject."""
        changes = []
        validation_errors = []

        active_version = await self.get_active_version(subject_id)
        active_version_id = active_version.version_id if active_version else None

        draft_entities = await firestore_reader.get_draft_entities(subject_id)

        entity_type_map = {
            "subjects": "subject",
            "units": "unit",
            "skills": "skill",
            "subskills": "subskill",
            "prerequisites": "prerequisite",
            "edges": "edge",
        }

        for collection_key, entity_type in entity_type_map.items():
            drafts = draft_entities.get(collection_key, [])

            for draft in drafts:
                entity_id = (
                    draft.get("subject_id") or draft.get("unit_id")
                    or draft.get("skill_id") or draft.get("subskill_id")
                    or draft.get("prerequisite_id") or draft.get("edge_id")
                )
                change_type = "updated" if active_version_id else "created"

                changes.append(DraftChange(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    change_type=change_type,
                    new_value=dict(draft),
                ))

        can_publish = len(validation_errors) == 0

        return DraftSummary(
            subject_id=subject_id,
            total_changes=len(changes),
            changes=changes,
            can_publish=can_publish,
            validation_errors=validation_errors,
        )

    async def publish(
        self,
        publish_request: PublishRequest,
        user_id: str
    ) -> PublishResponse:
        """Publish all draft changes for a subject.

        Creates a new version record and publishes edges.
        The actual draft→published copy is handled by curriculum_manager.deploy_curriculum_to_firestore().
        """
        now = datetime.utcnow()

        # Validate
        draft_summary = await self.get_draft_changes(publish_request.subject_id)
        if not draft_summary.can_publish:
            raise ValueError(f"Cannot publish: {draft_summary.validation_errors}")

        # Get current active version and create new one
        active_ver = await firestore_reader.get_active_version(publish_request.subject_id)
        old_version_id = active_ver["version_id"] if active_ver else None

        version_id = str(uuid.uuid4())
        max_version = await firestore_reader.get_max_version_number(publish_request.subject_id)

        new_version = Version(
            version_id=version_id,
            subject_id=publish_request.subject_id,
            version_number=max_version + 1,
            description=publish_request.version_description or settings.DEFAULT_VERSION_DESCRIPTION,
            is_active=True,
            created_at=now.isoformat(),
            activated_at=now.isoformat(),
            created_by=user_id,
            change_summary=publish_request.change_summary or f"{draft_summary.total_changes} changes",
        )

        # Write new version, deactivate old
        versions_coll = firestore_curriculum_sync.client.collection("curriculum_versions")
        versions_coll.document(version_id).set(new_version.dict())
        if old_version_id:
            versions_coll.document(old_version_id).update({"is_active": False})

        # Publish edges in graph subcollection
        await firestore_curriculum_sync.publish_edges(
            publish_request.subject_id, new_version.version_id
        )

        logger.info(f"Published version {new_version.version_number} for {publish_request.subject_id}")

        return PublishResponse(
            success=True,
            version_id=new_version.version_id,
            version_number=new_version.version_number,
            changes_published=draft_summary.total_changes,
            activated_at=now,
            message=f"Successfully published version {new_version.version_number}",
        )

    async def rollback_to_version(
        self,
        grade: str,
        subject_id: str,
        version_id: str,
        user_id: str
    ) -> PublishResponse:
        """Rollback to a previous version."""
        now = datetime.utcnow()

        ver_doc = await firestore_reader.get_version(version_id)
        if not ver_doc or ver_doc.get("subject_id") != subject_id:
            raise ValueError(f"Version {version_id} not found for subject {subject_id}")

        target_version = Version(**ver_doc)

        # Switch active flags in curriculum_versions
        versions_coll = firestore_curriculum_sync.client.collection("curriculum_versions")
        versions = versions_coll.where("subject_id", "==", subject_id).stream()
        batch = firestore_curriculum_sync.client.batch()
        for doc in versions:
            if doc.id == version_id:
                batch.update(doc.reference, {"is_active": True, "activated_at": now.isoformat()})
            elif doc.to_dict().get("is_active"):
                batch.update(doc.reference, {"is_active": False})
        batch.commit()

        logger.info(f"Rolled back to version {target_version.version_number} for {subject_id}")

        return PublishResponse(
            success=True,
            version_id=version_id,
            version_number=target_version.version_number,
            changes_published=0,
            activated_at=now,
            message=f"Successfully rolled back to version {target_version.version_number}",
        )


# Global instance
version_control = VersionControl()
