"""
Draft Curriculum Service — Hierarchical document CRUD for curriculum authoring.

Storage: curriculum_drafts/{grade}/subjects/{subject_id}

Same document shape as curriculum_published — a single hierarchical doc per
subject containing the full curriculum tree, subskill_index, and stats.

All authoring CRUD operates on this doc. Publish = copy draft → published.

Unit entries in the curriculum array may carry authoring metadata:
  - status: "pending" | "accepted" | "rejected" (absent = accepted for legacy data)
  - preview_id: UUID linking back to the generation request
  - lumina_coverage: coverage stats from generation
  - rejection_feedback: author's notes on why a preview was rejected

Stats, subskill_index, and publish only consider accepted units.
"""

import logging
from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.db.firestore_curriculum_service import firestore_curriculum_sync

logger = logging.getLogger(__name__)

# Re-export from canonical grades module
from app.models.grades import GRADE_LABELS, grades_match, normalise_grade

# Fields stored on unit entries for authoring lifecycle only
AUTHORING_METADATA_FIELDS = {
    "preview_id", "status", "authoring_created_at",
    "lumina_coverage", "rejection_feedback",
}

# Legacy top-level document fields that are vestigial / duplicate subskill data.
# primitives_config was a denormalized array that duplicated target_primitive /
# target_eval_modes with old field names (primitive_id / eval_modes).
LEGACY_DOC_FIELDS = {"primitives_config"}

# Legacy field names on subskill entries that duplicate the canonical
# target_primitive / target_eval_modes fields.
LEGACY_SUBSKILL_FIELDS = {"primitive_id", "eval_modes"}


def _is_accepted(unit: Dict[str, Any]) -> bool:
    """A unit is accepted if status == 'accepted' or status is absent (legacy)."""
    return unit.get("status", "accepted") == "accepted"


class DraftCurriculumService:
    """CRUD on hierarchical draft curriculum documents.

    Each subject lives at: curriculum_drafts/{grade}/subjects/{subject_id}
    with the same schema as curriculum_published docs.
    """

    COLLECTION = "curriculum_drafts"

    @property
    def _client(self):
        return firestore_curriculum_sync.client

    # ==================== Document-level helpers ====================

    def _ref(self, grade: str, subject_id: str):
        """Get doc reference for a draft subject.

        TODO: Normalise grade to long-form (e.g. "K" → "Kindergarten") before
        building the Firestore path.  The reader already does this via
        _grade_variants(), but writes use the raw string — so ``grade="K"``
        silently creates a *new* doc at ``curriculum_drafts/K/…`` instead of
        updating the existing ``curriculum_drafts/Kindergarten/…`` doc.
        Fix: call ``normalise_grade(grade)`` here (from app.models.grades).
        """
        return (
            self._client
            .collection(self.COLLECTION)
            .document(grade)
            .collection("subjects")
            .document(subject_id)
        )

    async def get_draft(self, grade: str, subject_id: str) -> Optional[Dict[str, Any]]:
        """Read the full draft document for a subject."""
        doc = self._ref(grade, subject_id).get()
        return doc.to_dict() if doc.exists else None

    async def save_draft(self, grade: str, subject_id: str, data: Dict[str, Any]) -> None:
        """Write the full draft document (upsert)."""
        # Ensure grade doc exists
        self._client.collection(self.COLLECTION).document(grade).set(
            {"grade": grade}, merge=True
        )
        self._ref(grade, subject_id).set(data)
        logger.info(f"Saved draft for {subject_id} (grade={grade})")

    async def delete_draft(self, grade: str, subject_id: str) -> None:
        """Delete a draft document."""
        self._ref(grade, subject_id).delete()
        logger.info(f"Deleted draft for {subject_id}")

    # ==================== List / Discovery ====================

    async def list_subjects(self, grade: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all draft subjects, optionally filtered by grade."""
        results = []

        if grade:
            docs = (
                self._client.collection(self.COLLECTION)
                .document(grade)
                .collection("subjects")
                .stream()
            )
            for doc in docs:
                d = doc.to_dict()
                results.append({
                    "subject_id": doc.id,
                    "subject_name": d.get("subject_name", ""),
                    "grade": d.get("grade", grade),
                    "version_id": d.get("version_id"),
                    "stats": d.get("stats", {}),
                })
        else:
            for grade_doc in self._client.collection(self.COLLECTION).stream():
                grade_id = grade_doc.id
                for doc in grade_doc.reference.collection("subjects").stream():
                    d = doc.to_dict()
                    results.append({
                        "subject_id": doc.id,
                        "subject_name": d.get("subject_name", ""),
                        "grade": d.get("grade", grade_id),
                        "version_id": d.get("version_id"),
                        "stats": d.get("stats", {}),
                    })

        return results

    # ==================== Subject CRUD ====================

    async def ensure_subject(
        self,
        subject_id: str,
        subject_name: str,
        grade: str,
        version_id: str,
        created_by: str = "system",
    ) -> Dict[str, Any]:
        """Get or create a draft subject document."""
        existing = await self.get_draft(grade, subject_id)
        if existing:
            return existing

        now = datetime.utcnow().isoformat()
        doc = {
            "subject_id": subject_id,
            "subject_name": subject_name,
            "grade": grade,
            "version_id": version_id,
            "version_number": 1,
            "created_at": now,
            "updated_at": now,
            "created_by": created_by,
            "curriculum": [],
            "subskill_index": {},
            "stats": {
                "total_units": 0,
                "total_skills": 0,
                "total_subskills": 0,
                "avg_target_difficulty": None,
                "min_difficulty": None,
                "max_difficulty": None,
            },
        }
        await self.save_draft(grade, subject_id, doc)
        return doc

    # ==================== Unit CRUD ====================

    async def add_unit(
        self, grade: str, subject_id: str, unit: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add a unit to the draft curriculum."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            raise ValueError(f"Draft not found: {subject_id}")

        # Build unit entry
        unit_entry = {
            "unit_id": unit["unit_id"],
            "unit_title": unit["unit_title"],
            "unit_order": unit.get("unit_order", len(doc["curriculum"])),
            "description": unit.get("description"),
            "skills": [],
        }

        doc["curriculum"].append(unit_entry)
        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)
        return unit_entry

    async def update_unit(
        self, grade: str, subject_id: str, unit_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a unit in the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc["curriculum"]:
            if u["unit_id"] == unit_id:
                for k, v in updates.items():
                    if k != "unit_id":
                        u[k] = v
                doc["updated_at"] = datetime.utcnow().isoformat()
                await self.save_draft(grade, subject_id, doc)
                return u
        return None

    async def delete_unit(
        self, grade: str, subject_id: str, unit_id: str
    ) -> bool:
        """Remove a unit (and all its skills/subskills) from the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return False

        original_len = len(doc["curriculum"])
        doc["curriculum"] = [u for u in doc["curriculum"] if u["unit_id"] != unit_id]

        if len(doc["curriculum"]) == original_len:
            return False

        self._rebuild_subskill_index(doc)
        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)
        return True

    # ==================== Skill CRUD ====================

    async def add_skill(
        self, grade: str, subject_id: str, unit_id: str, skill: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Add a skill to a unit in the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc["curriculum"]:
            if u["unit_id"] == unit_id:
                skill_entry = {
                    "skill_id": skill["skill_id"],
                    "skill_description": skill["skill_description"],
                    "skill_order": skill.get("skill_order", len(u["skills"])),
                    "subskills": skill.get("subskills", []),
                }
                u["skills"].append(skill_entry)
                self._recompute_stats(doc)
                doc["updated_at"] = datetime.utcnow().isoformat()
                await self.save_draft(grade, subject_id, doc)
                return skill_entry
        return None

    async def update_skill(
        self, grade: str, subject_id: str, skill_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a skill in the draft (searches all units)."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc["curriculum"]:
            for sk in u["skills"]:
                if sk["skill_id"] == skill_id:
                    for k, v in updates.items():
                        if k != "skill_id":
                            sk[k] = v
                    doc["updated_at"] = datetime.utcnow().isoformat()
                    await self.save_draft(grade, subject_id, doc)
                    return sk
        return None

    async def delete_skill(
        self, grade: str, subject_id: str, skill_id: str
    ) -> bool:
        """Remove a skill (and its subskills) from the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return False

        found = False
        for u in doc["curriculum"]:
            original_len = len(u["skills"])
            u["skills"] = [sk for sk in u["skills"] if sk["skill_id"] != skill_id]
            if len(u["skills"]) < original_len:
                found = True

        if not found:
            return False

        self._rebuild_subskill_index(doc)
        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)
        return True

    # ==================== Subskill CRUD ====================

    async def add_subskill(
        self, grade: str, subject_id: str, skill_id: str, subskill: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Add a subskill to a skill in the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc["curriculum"]:
            for sk in u["skills"]:
                if sk["skill_id"] == skill_id:
                    ss_entry = {
                        "subskill_id": subskill["subskill_id"],
                        "subskill_description": subskill["subskill_description"],
                        "subskill_order": subskill.get("subskill_order", len(sk["subskills"])),
                        "difficulty_start": subskill.get("difficulty_start"),
                        "difficulty_end": subskill.get("difficulty_end"),
                        "target_difficulty": subskill.get("target_difficulty"),
                    }
                    if subskill.get("target_primitive"):
                        ss_entry["target_primitive"] = subskill["target_primitive"]
                    if subskill.get("target_eval_modes"):
                        ss_entry["target_eval_modes"] = subskill["target_eval_modes"]
                    sk["subskills"].append(ss_entry)

                    # Update subskill_index (only if unit is accepted)
                    if _is_accepted(u):
                        idx_entry = {
                            "subject": doc.get("subject_name", ""),
                            "unit_id": u["unit_id"],
                            "unit_title": u["unit_title"],
                            "skill_id": sk["skill_id"],
                            "skill_description": sk["skill_description"],
                            "subskill_id": subskill["subskill_id"],
                            "subskill_description": subskill["subskill_description"],
                            "difficulty_start": subskill.get("difficulty_start"),
                            "difficulty_end": subskill.get("difficulty_end"),
                            "target_difficulty": subskill.get("target_difficulty"),
                            "grade": doc.get("grade", ""),
                        }
                        if subskill.get("target_primitive"):
                            idx_entry["target_primitive"] = subskill["target_primitive"]
                        if subskill.get("target_eval_modes"):
                            idx_entry["target_eval_modes"] = subskill["target_eval_modes"]
                        doc.setdefault("subskill_index", {})[subskill["subskill_id"]] = idx_entry

                    self._recompute_stats(doc)
                    doc["updated_at"] = datetime.utcnow().isoformat()
                    await self.save_draft(grade, subject_id, doc)
                    return ss_entry
        return None

    async def update_subskill(
        self, grade: str, subject_id: str, subskill_id: str, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a subskill in the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc["curriculum"]:
            for sk in u["skills"]:
                for ss in sk["subskills"]:
                    if ss["subskill_id"] == subskill_id:
                        for k, v in updates.items():
                            if k != "subskill_id":
                                ss[k] = v

                        # Update index too (add new fields, not just update existing)
                        if subskill_id in doc.get("subskill_index", {}):
                            for k, v in updates.items():
                                if k != "subskill_id":
                                    doc["subskill_index"][subskill_id][k] = v

                        self._recompute_stats(doc)
                        doc["updated_at"] = datetime.utcnow().isoformat()
                        await self.save_draft(grade, subject_id, doc)
                        return ss
        return None

    async def delete_subskill(
        self, grade: str, subject_id: str, subskill_id: str
    ) -> bool:
        """Remove a subskill from the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return False

        found = False
        for u in doc["curriculum"]:
            for sk in u["skills"]:
                original_len = len(sk["subskills"])
                sk["subskills"] = [
                    ss for ss in sk["subskills"]
                    if ss["subskill_id"] != subskill_id
                ]
                if len(sk["subskills"]) < original_len:
                    found = True

        if not found:
            return False

        # Remove from index
        doc.get("subskill_index", {}).pop(subskill_id, None)
        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)
        return True

    # ==================== Bulk Unit Add ====================

    async def add_unit_with_content(
        self,
        grade: str,
        subject_id: str,
        unit: Dict[str, Any],
        skills: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Add a complete unit (with skills and subskills) in a single write.

        The unit dict may include authoring metadata (preview_id, status,
        lumina_coverage, etc.) which is stored on the unit entry and stripped
        on publish.
        """
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            raise ValueError(f"Draft not found: {subject_id}")

        # Build the complete unit entry
        unit_entry = {
            "unit_id": unit["unit_id"],
            "unit_title": unit["unit_title"],
            "unit_order": unit.get("unit_order", len(doc["curriculum"])),
            "description": unit.get("description"),
            "skills": skills,
        }

        # Copy authoring metadata if present
        for field in AUTHORING_METADATA_FIELDS:
            if field in unit:
                unit_entry[field] = unit[field]

        doc["curriculum"].append(unit_entry)

        # Build subskill_index entries only for accepted units
        if _is_accepted(unit_entry):
            subject_name = doc.get("subject_name", "")
            doc_grade = doc.get("grade", grade)
            index = doc.setdefault("subskill_index", {})

            for sk in skills:
                for ss in sk.get("subskills", []):
                    idx_entry = {
                        "subject": subject_name,
                        "unit_id": unit["unit_id"],
                        "unit_title": unit["unit_title"],
                        "skill_id": sk["skill_id"],
                        "skill_description": sk["skill_description"],
                        "subskill_id": ss["subskill_id"],
                        "subskill_description": ss["subskill_description"],
                        "difficulty_start": ss.get("difficulty_start"),
                        "difficulty_end": ss.get("difficulty_end"),
                        "target_difficulty": ss.get("target_difficulty"),
                        "grade": doc_grade,
                    }
                    if ss.get("target_primitive"):
                        idx_entry["target_primitive"] = ss["target_primitive"]
                    if ss.get("target_eval_modes"):
                        idx_entry["target_eval_modes"] = ss["target_eval_modes"]
                    index[ss["subskill_id"]] = idx_entry

        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)

        logger.info(
            f"Added unit {unit['unit_id']} ({unit_entry.get('status', 'accepted')}) "
            f"with {len(skills)} skills to {subject_id} (1 write)"
        )
        return unit_entry

    # ==================== Authoring Lifecycle ====================

    async def get_unit_by_preview_id(
        self, grade: str, subject_id: str, preview_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Find a unit entry by its preview_id."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None
        for u in doc.get("curriculum", []):
            if u.get("preview_id") == preview_id:
                return u
        return None

    async def update_unit_status(
        self, grade: str, subject_id: str, preview_id: str,
        status: str, rejection_feedback: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update the authoring status of a unit identified by preview_id.

        When accepting: rebuilds subskill_index to include the newly accepted unit.
        When rejecting: removes unit's subskills from the index.
        """
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None

        for u in doc.get("curriculum", []):
            if u.get("preview_id") == preview_id:
                u["status"] = status
                if rejection_feedback is not None:
                    u["rejection_feedback"] = rejection_feedback

                # Rebuild index and stats since acceptance status changed
                self._rebuild_subskill_index(doc)
                self._recompute_stats(doc)
                doc["updated_at"] = datetime.utcnow().isoformat()
                await self.save_draft(grade, subject_id, doc)
                return u

        return None

    async def replace_unit_by_preview_id(
        self, grade: str, subject_id: str, old_preview_id: str,
        new_unit_entry: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Replace a unit entry (by preview_id) with a new one.

        Used by regenerate: marks old as rejected, inserts new as pending.
        """
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            raise ValueError(f"Draft not found: {subject_id}")

        # Mark old entry as rejected
        for u in doc.get("curriculum", []):
            if u.get("preview_id") == old_preview_id:
                u["status"] = "rejected"
                break

        # Append new entry
        doc["curriculum"].append(new_unit_entry)

        self._rebuild_subskill_index(doc)
        self._recompute_stats(doc)
        doc["updated_at"] = datetime.utcnow().isoformat()
        await self.save_draft(grade, subject_id, doc)
        return new_unit_entry

    async def list_units_with_status(
        self, grade: str, subject_id: str,
    ) -> List[Dict[str, Any]]:
        """Return all unit entries that have authoring metadata (preview_id)."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return []

        return [
            u for u in doc.get("curriculum", [])
            if "preview_id" in u
        ]

    # ==================== Lookups ====================

    async def find_unit(self, grade: str, subject_id: str, unit_id: str) -> Optional[Dict]:
        """Find a unit in the draft."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None
        for u in doc["curriculum"]:
            if u["unit_id"] == unit_id:
                return u
        return None

    async def find_skill(self, grade: str, subject_id: str, skill_id: str) -> Optional[Dict]:
        """Find a skill in the draft (returns skill + parent unit context)."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None
        for u in doc["curriculum"]:
            for sk in u["skills"]:
                if sk["skill_id"] == skill_id:
                    return {**sk, "_unit_id": u["unit_id"], "_unit_title": u["unit_title"]}
        return None

    async def find_subskill(self, grade: str, subject_id: str, subskill_id: str) -> Optional[Dict]:
        """Find a subskill via the index (O(1))."""
        doc = await self.get_draft(grade, subject_id)
        if not doc:
            return None
        return doc.get("subskill_index", {}).get(subskill_id)

    # ==================== Publish ====================

    async def publish(self, grade: str, subject_id: str, deployed_by: str = "system") -> Dict[str, Any]:
        """Copy draft to curriculum_published.

        Only accepted units are published. Authoring metadata is stripped.
        Pre-publish validation ensures every removed subskill_id has a
        lineage record in curriculum_lineage — blocks publish if missing.
        """
        from app.db.firestore_graph_service import firestore_graph_service
        from app.services.lineage_detector import detect_changes

        doc = await self.get_draft(grade, subject_id)
        if not doc:
            raise ValueError(f"No draft found for {subject_id} (grade={grade})")

        # Clean legacy fields from draft so they don't keep propagating
        self._strip_legacy_fields(doc)
        await self.save_draft(grade, subject_id, doc)

        published = deepcopy(doc)

        # Filter to accepted units only and strip authoring metadata
        published["curriculum"] = [
            self._strip_authoring_metadata(u)
            for u in published.get("curriculum", [])
            if _is_accepted(u)
        ]

        # Rebuild index and stats on the filtered copy
        self._rebuild_subskill_index(published)
        self._recompute_stats(published)

        # --- Lineage detection & pre-publish validation ---
        old_published = await self._get_current_published(grade, subject_id, firestore_graph_service)
        old_index = (old_published or {}).get("subskill_index", {})
        new_index = published.get("subskill_index", {})

        if old_index:
            # Auto-detect lineage changes and write records
            lineage_records = detect_changes(old_index, new_index, subject_id=subject_id, grade=grade)
            if lineage_records:
                await self._write_lineage_records(lineage_records, firestore_graph_service)

            # Validate: every removed subskill_id must have a lineage record
            missing = await self._validate_lineage_coverage(old_index, new_index, firestore_graph_service)
            if missing:
                raise ValueError(
                    f"Pre-publish blocked: {len(missing)} removed subskill_id(s) have no lineage record. "
                    f"Create lineage records for: {missing}. "
                    f"Use POST /api/lineage/ or /curriculum-lumina-audit lineage-check {subject_id}"
                )

        published["deployed_at"] = datetime.utcnow().isoformat()
        published["deployed_by"] = deployed_by

        await firestore_graph_service.deploy_curriculum(subject_id, published)

        logger.info(
            f"Published {subject_id}: "
            f"{published.get('stats', {}).get('total_units', 0)} units, "
            f"{published.get('stats', {}).get('total_skills', 0)} skills, "
            f"{published.get('stats', {}).get('total_subskills', 0)} subskills"
        )
        return published

    # ==================== Backfill ====================

    async def backfill_from_published(self, grade: Optional[str] = None) -> Dict[str, int]:
        """Seed curriculum_drafts from existing curriculum_published docs.

        Use this once to populate drafts for subjects that were published
        before the drafts collection existed.  Overwrites empty drafts
        (shell docs with no curriculum content).

        ``grade`` accepts either the short code ("K") or the Firestore
        document key ("Kindergarten") — both are matched.
        """
        from app.db.firestore_graph_service import firestore_graph_service
        from app.models.grades import GRADE_LABELS

        count = 0

        # Discover all published grade doc IDs, then filter if caller specified one
        all_grade_ids = [g.id for g in firestore_graph_service.curriculum_published.stream()]

        if grade:
            # Match by exact id, short code, or long-form label
            grades_to_scan = [
                gid for gid in all_grade_ids
                if grades_match(gid, grade)
            ]
            if not grades_to_scan:
                logger.warning(f"No published grade matching '{grade}'. Available: {all_grade_ids}")
        else:
            grades_to_scan = all_grade_ids

        for g in grades_to_scan:
            subjects_ref = (
                firestore_graph_service.curriculum_published
                .document(g)
                .collection("subjects")
            )
            for doc in subjects_ref.stream():
                subject_id = doc.id
                data = doc.to_dict()

                # Check if draft already exists AND has content
                existing = await self.get_draft(g, subject_id)
                if existing and existing.get("curriculum"):
                    logger.info(f"Draft already exists for {subject_id} (grade={g}), skipping")
                    continue

                action = "Overwrote empty draft" if existing else "Backfilled draft"
                await self.save_draft(g, subject_id, data)
                count += 1
                logger.info(f"{action} for {subject_id} (grade={g})")

        return {"backfilled": count}

    # ==================== Internal helpers ====================

    @staticmethod
    def _strip_legacy_fields(doc: Dict[str, Any]) -> None:
        """Remove vestigial top-level fields and legacy subskill field names.

        Canonical fields are ``target_primitive`` and ``target_eval_modes``
        on each subskill entry.  Legacy aliases (``primitive_id``,
        ``eval_modes``) and the denormalized ``primitives_config`` array are
        stripped so the published document has a single source of truth.
        """
        # Remove legacy top-level arrays
        for field in LEGACY_DOC_FIELDS:
            doc.pop(field, None)

        # Remove legacy field names from subskill entries
        for unit in doc.get("curriculum", []):
            for skill in unit.get("skills", []):
                for ss in skill.get("subskills", []):
                    for field in LEGACY_SUBSKILL_FIELDS:
                        ss.pop(field, None)

    @staticmethod
    def _strip_authoring_metadata(unit: Dict[str, Any]) -> Dict[str, Any]:
        """Remove authoring lifecycle fields from a unit entry."""
        return {k: v for k, v in unit.items() if k not in AUTHORING_METADATA_FIELDS}

    @staticmethod
    def _recompute_stats(doc: Dict[str, Any]) -> None:
        """Recompute stats from accepted units only."""
        curriculum = doc.get("curriculum", [])
        total_units = 0
        total_skills = 0
        total_subskills = 0
        difficulty_values = []
        target_diffs = []

        for u in curriculum:
            if not _is_accepted(u):
                continue
            total_units += 1
            skills = u.get("skills", [])
            total_skills += len(skills)
            for sk in skills:
                subskills = sk.get("subskills", [])
                total_subskills += len(subskills)
                for ss in subskills:
                    td = ss.get("target_difficulty")
                    if td is not None:
                        target_diffs.append(td)
                        difficulty_values.append(td)
                    ds = ss.get("difficulty_start")
                    if ds is not None:
                        difficulty_values.append(ds)
                    de = ss.get("difficulty_end")
                    if de is not None:
                        difficulty_values.append(de)

        doc["stats"] = {
            "total_units": total_units,
            "total_skills": total_skills,
            "total_subskills": total_subskills,
            "avg_target_difficulty": (
                round(sum(target_diffs) / len(target_diffs), 3) if target_diffs else None
            ),
            "min_difficulty": min(difficulty_values) if difficulty_values else None,
            "max_difficulty": max(difficulty_values) if difficulty_values else None,
        }

    @staticmethod
    def _rebuild_subskill_index(doc: Dict[str, Any]) -> None:
        """Rebuild the subskill_index from accepted units only."""
        index = {}
        subject_name = doc.get("subject_name", "")
        grade = doc.get("grade", "")

        for u in doc.get("curriculum", []):
            if not _is_accepted(u):
                continue
            for sk in u.get("skills", []):
                for ss in sk.get("subskills", []):
                    entry = {
                        "subject": subject_name,
                        "unit_id": u["unit_id"],
                        "unit_title": u["unit_title"],
                        "skill_id": sk["skill_id"],
                        "skill_description": sk["skill_description"],
                        "subskill_id": ss["subskill_id"],
                        "subskill_description": ss["subskill_description"],
                        "difficulty_start": ss.get("difficulty_start"),
                        "difficulty_end": ss.get("difficulty_end"),
                        "target_difficulty": ss.get("target_difficulty"),
                        "grade": grade,
                    }
                    if ss.get("target_primitive"):
                        entry["target_primitive"] = ss["target_primitive"]
                    if ss.get("target_eval_modes"):
                        entry["target_eval_modes"] = ss["target_eval_modes"]
                    index[ss["subskill_id"]] = entry

        doc["subskill_index"] = index

    # ==================== Lineage helpers ====================

    async def _get_current_published(self, grade: str, subject_id: str, graph_service) -> Optional[Dict]:
        """Read the currently published curriculum document."""
        try:
            doc_ref = graph_service.curriculum_published.document(grade).collection("subjects").document(subject_id)
            doc = doc_ref.get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.warning(f"Could not read published curriculum for {subject_id}: {e}")
            return None

    async def _write_lineage_records(self, records: list, graph_service) -> None:
        """Batch-write auto-detected lineage records to curriculum_lineage."""
        from app.db.firestore_curriculum_service import firestore_curriculum_sync
        from datetime import timezone

        client = firestore_curriculum_sync.client
        if not client:
            logger.warning("Firestore client not available — skipping lineage writes")
            return

        batch = client.batch()
        now = datetime.now(timezone.utc).isoformat()
        written = 0

        for record in records:
            old_id = record["old_id"]
            doc_ref = client.collection("curriculum_lineage").document(old_id)

            # Don't overwrite existing records (may have been manually created)
            existing = doc_ref.get()
            if existing.exists:
                logger.info(f"[LINEAGE] {old_id} — record already exists, skipping auto-detect")
                continue

            record["created_at"] = now
            record["created_by"] = "auto-publish"
            batch.set(doc_ref, record)
            written += 1
            logger.info(f"[LINEAGE] {old_id} → {record.get('canonical_ids', [])} ({record['operation']}) — auto-created")

        if written > 0:
            batch.commit()
            logger.info(f"[LINEAGE] Wrote {written} lineage records")

    async def _validate_lineage_coverage(self, old_index: dict, new_index: dict, graph_service) -> list:
        """Check that every removed subskill_id has a lineage record. Returns list of missing IDs."""
        from app.db.firestore_curriculum_service import firestore_curriculum_sync

        client = firestore_curriculum_sync.client
        if not client:
            return []  # Can't validate without Firestore

        removed = set(old_index.keys()) - set(new_index.keys())
        if not removed:
            return []

        missing = []
        for old_id in sorted(removed):
            doc = client.collection("curriculum_lineage").document(old_id).get()
            if not doc.exists:
                missing.append(old_id)

        if missing:
            logger.warning(f"[LINEAGE-MISSING] {len(missing)} removed IDs without lineage records: {missing}")

        return missing


# Global instance
draft_curriculum = DraftCurriculumService()
