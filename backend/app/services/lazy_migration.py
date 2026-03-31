"""
LazyMigrationService — on-access document migration for curriculum lineage.

When a student's data is found under an old (deprecated) subskill_id but not
under the canonical ID, the lazy migrator copies the doc to the canonical
location and cleans up the old one.  Runs as fire-and-forget async tasks
so reads are never blocked.

All operations use Firestore transactions for atomicity and are idempotent.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class LazyMigrationService:
    """Migrates individual student documents from old → canonical subskill_id."""

    async def migrate_mastery_lifecycle(
        self,
        firestore_svc,
        student_id: int,
        old_subskill_id: str,
        canonical_subskill_id: str,
    ) -> None:
        """Migrate a single mastery_lifecycle doc from old to canonical ID."""
        try:
            collection = firestore_svc._mastery_lifecycle_subcollection(student_id)
            old_ref = collection.document(old_subskill_id)
            new_ref = collection.document(canonical_subskill_id)

            # Check if new already exists (idempotent)
            new_doc = new_ref.get()
            if new_doc.exists:
                logger.debug(f"Mastery lifecycle {canonical_subskill_id} already exists — skipping migration")
                return

            old_doc = old_ref.get()
            if not old_doc.exists:
                return

            data = old_doc.to_dict()
            data["subskill_id"] = canonical_subskill_id
            data["_lineage_migrated_from"] = old_subskill_id
            data["_lineage_migrated_at"] = datetime.now(timezone.utc).isoformat()

            # Atomic: write new, delete old
            batch = firestore_svc.client.batch()
            batch.set(new_ref, data)
            batch.delete(old_ref)
            batch.commit()

            logger.info(
                f"[LINEAGE-MIGRATE] mastery_lifecycle: student={student_id} "
                f"{old_subskill_id} → {canonical_subskill_id}"
            )
        except Exception as e:
            logger.error(f"Lazy migration failed for mastery_lifecycle {old_subskill_id}: {e}")

    async def migrate_competency(
        self,
        firestore_svc,
        student_id: int,
        subject: str,
        old_skill_id: str,
        old_subskill_id: str,
        canonical_skill_id: str,
        canonical_subskill_id: str,
    ) -> None:
        """Migrate a single competency doc from old composite key to canonical."""
        try:
            collection = firestore_svc._competencies_subcollection(student_id)
            old_doc_id = f"{subject}_{old_skill_id}_{old_subskill_id}"
            new_doc_id = f"{subject}_{canonical_skill_id}_{canonical_subskill_id}"

            if old_doc_id == new_doc_id:
                return

            new_ref = collection.document(new_doc_id)
            old_ref = collection.document(old_doc_id)

            # Idempotent check
            if new_ref.get().exists:
                logger.debug(f"Competency {new_doc_id} already exists — skipping migration")
                return

            old_doc = old_ref.get()
            if not old_doc.exists:
                return

            data = old_doc.to_dict()
            data["skill_id"] = canonical_skill_id
            data["subskill_id"] = canonical_subskill_id
            data["id"] = f"{student_id}_{subject}_{canonical_skill_id}_{canonical_subskill_id}"
            data["_lineage_migrated_from"] = old_doc_id
            data["_lineage_migrated_at"] = datetime.now(timezone.utc).isoformat()

            batch = firestore_svc.client.batch()
            batch.set(new_ref, data)
            batch.delete(old_ref)
            batch.commit()

            logger.info(
                f"[LINEAGE-MIGRATE] competency: student={student_id} "
                f"{old_doc_id} → {new_doc_id}"
            )
        except Exception as e:
            logger.error(f"Lazy migration failed for competency {old_subskill_id}: {e}")

    async def migrate_ability(
        self,
        firestore_svc,
        student_id: int,
        old_skill_id: str,
        canonical_skill_id: str,
    ) -> None:
        """Migrate a single ability doc from old skill_id to canonical."""
        try:
            if old_skill_id == canonical_skill_id:
                return

            collection = firestore_svc._ability_subcollection(student_id)
            old_ref = collection.document(old_skill_id)
            new_ref = collection.document(canonical_skill_id)

            if new_ref.get().exists:
                return

            old_doc = old_ref.get()
            if not old_doc.exists:
                return

            data = old_doc.to_dict()
            data["skill_id"] = canonical_skill_id
            data["_lineage_migrated_from"] = old_skill_id
            data["_lineage_migrated_at"] = datetime.now(timezone.utc).isoformat()

            batch = firestore_svc.client.batch()
            batch.set(new_ref, data)
            batch.delete(old_ref)
            batch.commit()

            logger.info(
                f"[LINEAGE-MIGRATE] ability: student={student_id} "
                f"{old_skill_id} → {canonical_skill_id}"
            )
        except Exception as e:
            logger.error(f"Lazy migration failed for ability {old_skill_id}: {e}")


# Module-level singleton
lazy_migration_service = LazyMigrationService()
