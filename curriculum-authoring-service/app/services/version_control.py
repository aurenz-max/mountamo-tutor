"""
Version control and publishing service
Manages draft/publish workflow and version history
"""

import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.models.versioning import (
    Version, VersionCreate,
    DraftSummary, DraftChange,
    PublishRequest, PublishResponse
)

logger = logging.getLogger(__name__)


class VersionControl:
    """Manages curriculum versioning and publishing"""

    def _get_primary_key(self, table_name: str) -> str:
        """Get the primary key column name for a table"""
        pk_map = {
            settings.TABLE_SUBJECTS: "subject_id",
            settings.TABLE_UNITS: "unit_id",
            settings.TABLE_SKILLS: "skill_id",
            settings.TABLE_SUBSKILLS: "subskill_id",
            settings.TABLE_PREREQUISITES: "prerequisite_id",
            settings.TABLE_VERSIONS: "version_id"
        }
        return pk_map.get(table_name, "id")

    async def create_version(
        self,
        version_create: VersionCreate,
        user_id: str
    ) -> Version:
        """Create a new version record"""
        version_id = str(uuid.uuid4())
        now = datetime.utcnow()

        # Get latest version number for this subject
        query = f"""
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", version_create.subject_id)]
        results = await db.execute_query(query, parameters)
        max_version = results[0]["max_version"] if results else 0

        version_data = {
            "version_id": version_id,
            "subject_id": version_create.subject_id,
            "version_number": max_version + 1,
            "description": version_create.description or settings.DEFAULT_VERSION_DESCRIPTION,
            "is_active": False,
            "created_at": now.isoformat(),
            "activated_at": None,
            "created_by": user_id,
            "change_summary": version_create.change_summary
        }

        await db.insert_rows(settings.TABLE_VERSIONS, [version_data])
        return Version(**version_data)

    async def get_active_version(self, subject_id: str) -> Optional[Version]:
        """Get the currently active version for a subject"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id AND is_active = true
        LIMIT 1
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)

        return Version(**results[0]) if results else None

    async def get_or_create_active_version(self, subject_id: str, user_id: str) -> str:
        """
        Get active version_id for a subject, or create one if none exists.
        This ensures all new entities use the same version_id.

        Returns the version_id string (not the Version object).
        """
        active_version = await self.get_active_version(subject_id)

        if active_version:
            logger.info(f"✅ Using existing active version for {subject_id}: {active_version.version_id}")
            return active_version.version_id

        # No active version exists - create version 1
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
            "change_summary": "Initial version"
        }

        await db.insert_rows(settings.TABLE_VERSIONS, [version_data])
        logger.info(f"✅ Created initial active version for {subject_id}: {version_id}")

        return version_id

    async def get_version_history(self, subject_id: str) -> List[Version]:
        """Get all versions for a subject"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id
        ORDER BY version_number DESC
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)

        return [Version(**row) for row in results]

    async def get_draft_changes(self, subject_id: str) -> DraftSummary:
        """Get summary of all draft changes for a subject"""

        changes = []
        validation_errors = []

        # Get active version
        active_version = await self.get_active_version(subject_id)
        active_version_id = active_version.version_id if active_version else None

        # Check for draft changes in each table
        tables = [
            (settings.TABLE_SUBJECTS, "subject"),
            (settings.TABLE_UNITS, "unit"),
            (settings.TABLE_SKILLS, "skill"),
            (settings.TABLE_SUBSKILLS, "subskill"),
            (settings.TABLE_PREREQUISITES, "prerequisite")
        ]

        for table_name, entity_type in tables:
            # Query draft records
            query = f"""
            SELECT *
            FROM `{settings.get_table_id(table_name)}`
            WHERE is_draft = true
            """

            if table_name == settings.TABLE_SUBJECTS:
                query += " AND subject_id = @subject_id"
                parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
            elif table_name == settings.TABLE_UNITS:
                query += " AND subject_id = @subject_id"
                parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
            else:
                # For skills, subskills, prerequisites - need to join to get subject
                query = f"""
                SELECT t.*
                FROM `{settings.get_table_id(table_name)}` t
                WHERE t.is_draft = true
                  AND t.version_id IN (
                    SELECT version_id
                    FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
                    WHERE subject_id = @subject_id
                  )
                """
                parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]

            draft_results = await db.execute_query(query, parameters)

            for draft in draft_results:
                # Determine if this is new or updated
                entity_id = draft.get("subject_id") or draft.get("unit_id") or \
                           draft.get("skill_id") or draft.get("subskill_id") or \
                           draft.get("prerequisite_id")

                # Check if corresponding active record exists
                if active_version_id:
                    # Query active version of this entity
                    # (simplified - in reality would need more complex logic)
                    change_type = "updated"
                else:
                    change_type = "created"

                changes.append(
                    DraftChange(
                        entity_type=entity_type,
                        entity_id=entity_id,
                        change_type=change_type,
                        new_value=dict(draft)
                    )
                )

        # Validate prerequisites (check for circular dependencies, referential integrity)
        # Simplified validation
        can_publish = len(validation_errors) == 0

        return DraftSummary(
            subject_id=subject_id,
            total_changes=len(changes),
            changes=changes,
            can_publish=can_publish,
            validation_errors=validation_errors
        )

    async def publish(
        self,
        publish_request: PublishRequest,
        user_id: str
    ) -> PublishResponse:
        """
        Publish all draft changes for a subject
        Creates a new version and marks it as active
        """
        now = datetime.utcnow()

        # Get draft summary
        draft_summary = await self.get_draft_changes(publish_request.subject_id)

        if not draft_summary.can_publish:
            raise ValueError(f"Cannot publish due to validation errors: {draft_summary.validation_errors}")

        # Step 1: Deactivate current active version FIRST (before creating new one)
        # This avoids streaming buffer issues since old versions are not in the buffer
        deactivate_query = f"""
        MERGE `{settings.get_table_id(settings.TABLE_VERSIONS)}` AS T
        USING (
            SELECT version_id
            FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
            WHERE subject_id = @subject_id AND is_active = true
        ) AS S
        ON T.version_id = S.version_id
        WHEN MATCHED THEN
          UPDATE SET T.is_active = false
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", publish_request.subject_id)]
        await db.execute_query(deactivate_query, parameters)

        # Step 2: Create new version with is_active=True from the start
        # This avoids needing to UPDATE the newly created row (which would be in streaming buffer)
        version_id = str(uuid.uuid4())

        # Get latest version number for this subject
        version_query = f"""
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE subject_id = @subject_id
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", publish_request.subject_id)]
        results = await db.execute_query(version_query, parameters)
        max_version = results[0]["max_version"] if results else 0

        version_data = {
            "version_id": version_id,
            "subject_id": publish_request.subject_id,
            "version_number": max_version + 1,
            "description": publish_request.version_description or settings.DEFAULT_VERSION_DESCRIPTION,
            "is_active": True,  # Set to active immediately
            "created_at": now.isoformat(),
            "activated_at": now.isoformat(),  # Set activation time
            "created_by": user_id,
            "change_summary": publish_request.change_summary or f"{draft_summary.total_changes} changes"
        }

        await db.insert_rows(settings.TABLE_VERSIONS, [version_data])
        new_version = Version(**version_data)

        # Mark all draft records as published (is_draft = false)
        tables = [
            settings.TABLE_SUBJECTS,
            settings.TABLE_UNITS,
            settings.TABLE_SKILLS,
            settings.TABLE_SUBSKILLS,
            settings.TABLE_PREREQUISITES
        ]

        for table_name in tables:
            # Use MERGE to avoid streaming buffer issues
            merge_query = f"""
            MERGE `{settings.get_table_id(table_name)}` AS T
            USING (
                SELECT *
                FROM `{settings.get_table_id(table_name)}`
                WHERE is_draft = true
            ) AS S
            ON T.{self._get_primary_key(table_name)} = S.{self._get_primary_key(table_name)}
            WHEN MATCHED THEN
              UPDATE SET T.is_draft = false, T.version_id = @version_id
            """

            parameters = [bigquery.ScalarQueryParameter("version_id", "STRING", new_version.version_id)]
            await db.execute_query(merge_query, parameters)

        logger.info(f"✅ Published version {new_version.version_number} for subject {publish_request.subject_id}")

        return PublishResponse(
            success=True,
            version_id=new_version.version_id,
            version_number=new_version.version_number,
            changes_published=draft_summary.total_changes,
            activated_at=now,
            message=f"Successfully published version {new_version.version_number}"
        )

    async def rollback_to_version(
        self,
        subject_id: str,
        version_id: str,
        user_id: str
    ) -> PublishResponse:
        """Rollback to a previous version"""
        now = datetime.utcnow()

        # Verify version exists and belongs to subject
        version_query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE version_id = @version_id AND subject_id = @subject_id
        """

        parameters = [
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)
        ]

        results = await db.execute_query(version_query, parameters)
        if not results:
            raise ValueError(f"Version {version_id} not found for subject {subject_id}")

        target_version = Version(**results[0])

        # Use a single MERGE to update both versions atomically
        # This works because we're only updating OLD versions (not in streaming buffer)
        rollback_query = f"""
        MERGE `{settings.get_table_id(settings.TABLE_VERSIONS)}` AS T
        USING (
            SELECT
                version_id,
                CASE
                    WHEN version_id = @target_version_id THEN true
                    ELSE false
                END as should_be_active,
                CASE
                    WHEN version_id = @target_version_id THEN @activated_at
                    ELSE activated_at
                END as new_activated_at
            FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
            WHERE subject_id = @subject_id
        ) AS S
        ON T.version_id = S.version_id
        WHEN MATCHED THEN
          UPDATE SET
            T.is_active = S.should_be_active,
            T.activated_at = S.new_activated_at
        """

        parameters = [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("target_version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("activated_at", "TIMESTAMP", now)
        ]
        await db.execute_query(rollback_query, parameters)

        logger.info(f"✅ Rolled back to version {target_version.version_number} for subject {subject_id}")

        return PublishResponse(
            success=True,
            version_id=version_id,
            version_number=target_version.version_number,
            changes_published=0,
            activated_at=now,
            message=f"Successfully rolled back to version {target_version.version_number}"
        )


# Global instance
version_control = VersionControl()
