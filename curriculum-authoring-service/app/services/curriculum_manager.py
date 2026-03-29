"""
Core curriculum management service
Handles CRUD operations for subjects, units, skills, and subskills

Reads: Firestore-native via firestore_reader (curriculum_drafts → curriculum_published fallback)
Writes: DraftCurriculumService (hierarchical docs in curriculum_drafts)
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.db.draft_curriculum_service import draft_curriculum
from app.db.firestore_curriculum_reader import firestore_reader
from app.models.curriculum import (
    Subject, SubjectCreate, SubjectUpdate,
    Unit, UnitCreate, UnitUpdate,
    Skill, SkillCreate, SkillUpdate,
    Subskill, SubskillCreate, SubskillUpdate,
    Primitive, SubskillPrimitiveAssociation,
    CurriculumTree, UnitNode, SkillNode, SubskillNode,
    FlattenedCurriculumRow
)

logger = logging.getLogger(__name__)


class CurriculumManager:
    """Manages curriculum entities and hierarchical structure.

    Reads from the hierarchical draft/published docs via firestore_reader.
    Writes to the hierarchical draft doc via DraftCurriculumService.
    """

    # ==================== Context resolution ====================

    async def _resolve_subject_context(self, subject_id: str) -> Optional[Dict[str, str]]:
        """Resolve grade for a subject_id by searching drafts/published."""
        subject = await firestore_reader.get_subject(subject_id)
        if not subject:
            return None
        return {"grade": subject.get("grade", ""), "subject_id": subject_id}

    async def _resolve_from_unit(self, unit_id: str) -> Optional[Dict[str, str]]:
        """Resolve grade + subject_id from a unit_id."""
        unit = await firestore_reader.get_unit(unit_id)
        if not unit:
            return None
        return await self._resolve_subject_context(unit.get("subject_id", ""))

    async def _resolve_from_skill(self, skill_id: str) -> Optional[Dict[str, str]]:
        """Resolve grade + subject_id from a skill_id."""
        skill = await firestore_reader.get_skill(skill_id)
        if not skill:
            return None
        return await self._resolve_from_unit(skill.get("unit_id", ""))

    async def _resolve_from_subskill(self, subskill_id: str) -> Optional[Dict[str, str]]:
        """Resolve grade + subject_id from a subskill_id."""
        subskill = await firestore_reader.get_subskill(subskill_id)
        if not subskill:
            return None
        return await self._resolve_from_skill(subskill.get("skill_id", ""))

    # ==================== SUBJECT OPERATIONS ====================

    async def get_all_subjects(self, include_drafts: bool = False) -> List[Subject]:
        """Get all subjects."""
        rows = await firestore_reader.get_all_subjects(include_drafts=include_drafts)
        return [Subject(**self._normalise_subject(r)) for r in rows]

    @staticmethod
    def _normalise_subject(data: Dict[str, Any]) -> Dict[str, Any]:
        d = dict(data)
        if "grade_level" in d and "grade" not in d:
            d["grade"] = d.pop("grade_level")
        for ts_field in ("created_at", "updated_at"):
            if not d.get(ts_field):
                d[ts_field] = datetime.now(timezone.utc)
        return d

    async def get_subject(self, subject_id: str, version_id: Optional[str] = None, include_drafts: bool = False) -> Optional[Subject]:
        """Get a specific subject."""
        row = await firestore_reader.get_subject(subject_id, version_id=version_id, include_drafts=include_drafts)
        return Subject(**self._normalise_subject(row)) if row else None

    async def create_subject(self, subject: SubjectCreate, user_id: str, version_id: str) -> Subject:
        """Create a new subject by initializing a draft doc."""
        doc = await draft_curriculum.ensure_subject(
            subject_id=subject.subject_id,
            subject_name=subject.subject_name,
            grade=subject.grade,
            version_id=version_id,
            created_by=user_id,
        )

        return Subject(
            subject_id=subject.subject_id,
            subject_name=subject.subject_name,
            description=subject.description,
            grade=subject.grade,
            version_id=version_id,
            is_active=True,
            is_draft=True,
            created_at=doc.get("created_at", datetime.utcnow().isoformat()),
            updated_at=doc.get("updated_at", datetime.utcnow().isoformat()),
            created_by=user_id,
        )

    async def update_subject(self, subject_id: str, updates: SubjectUpdate, version_id: str) -> Optional[Subject]:
        """Update a subject in the draft doc."""
        ctx = await self._resolve_subject_context(subject_id)
        if not ctx:
            return None

        doc = await draft_curriculum.get_draft(ctx["grade"], subject_id)
        if not doc:
            return None

        update_data = updates.dict(exclude_unset=True)
        for k, v in update_data.items():
            doc[k] = v
        doc["version_id"] = version_id
        doc["updated_at"] = datetime.utcnow().isoformat()

        await draft_curriculum.save_draft(ctx["grade"], subject_id, doc)

        return Subject(
            subject_id=subject_id,
            subject_name=doc.get("subject_name", ""),
            description=doc.get("description"),
            grade=doc.get("grade", ctx["grade"]),
            version_id=version_id,
            is_active=True,
            is_draft=True,
            created_at=doc.get("created_at", ""),
            updated_at=doc.get("updated_at", ""),
            created_by=doc.get("created_by"),
        )

    # ==================== UNIT OPERATIONS ====================

    async def get_units_by_subject(self, subject_id: str, include_drafts: bool = False) -> List[Unit]:
        rows = await firestore_reader.get_units_by_subject(subject_id, include_drafts=include_drafts)
        return [Unit(**row) for row in rows]

    async def get_unit(self, unit_id: str) -> Optional[Unit]:
        row = await firestore_reader.get_unit(unit_id)
        return Unit(**row) if row else None

    async def create_unit(self, unit: UnitCreate, version_id: str) -> Unit:
        """Add a unit to the subject's draft doc."""
        ctx = await self._resolve_subject_context(unit.subject_id)
        if not ctx:
            raise ValueError(f"Subject {unit.subject_id} not found")

        result = await draft_curriculum.add_unit(ctx["grade"], unit.subject_id, {
            "unit_id": unit.unit_id,
            "unit_title": unit.unit_title,
            "unit_order": unit.unit_order,
            "description": unit.description,
        })

        now = datetime.utcnow().isoformat()
        return Unit(
            unit_id=unit.unit_id,
            subject_id=unit.subject_id,
            unit_title=unit.unit_title,
            unit_order=unit.unit_order,
            description=unit.description,
            version_id=version_id,
            is_draft=True,
            created_at=now,
            updated_at=now,
        )

    async def update_unit(self, unit_id: str, updates: UnitUpdate, version_id: str) -> Optional[Unit]:
        ctx = await self._resolve_from_unit(unit_id)
        if not ctx:
            return None

        result = await draft_curriculum.update_unit(
            ctx["grade"], ctx["subject_id"], unit_id,
            updates.dict(exclude_unset=True),
        )
        if not result:
            return None

        # Re-read to get full data
        row = await firestore_reader.get_unit(unit_id)
        return Unit(**row) if row else None

    async def delete_unit(self, unit_id: str) -> bool:
        ctx = await self._resolve_from_unit(unit_id)
        if not ctx:
            return False
        return await draft_curriculum.delete_unit(ctx["grade"], ctx["subject_id"], unit_id)

    # ==================== SKILL OPERATIONS ====================

    async def get_skills_by_unit(self, unit_id: str, include_drafts: bool = False) -> List[Skill]:
        rows = await firestore_reader.get_skills_by_unit(unit_id, include_drafts=include_drafts)
        return [Skill(**row) for row in rows]

    async def get_skill(self, skill_id: str) -> Optional[Skill]:
        row = await firestore_reader.get_skill(skill_id)
        return Skill(**row) if row else None

    async def create_skill(self, skill: SkillCreate, version_id: str) -> Skill:
        """Add a skill to a unit in the draft doc."""
        ctx = await self._resolve_from_unit(skill.unit_id)
        if not ctx:
            raise ValueError(f"Unit {skill.unit_id} not found")

        await draft_curriculum.add_skill(ctx["grade"], ctx["subject_id"], skill.unit_id, {
            "skill_id": skill.skill_id,
            "skill_description": skill.skill_description,
            "skill_order": skill.skill_order,
        })

        now = datetime.utcnow().isoformat()
        return Skill(
            skill_id=skill.skill_id,
            unit_id=skill.unit_id,
            skill_description=skill.skill_description,
            skill_order=skill.skill_order,
            version_id=version_id,
            is_draft=True,
            created_at=now,
            updated_at=now,
        )

    async def update_skill(self, skill_id: str, updates: SkillUpdate, version_id: str) -> Optional[Skill]:
        ctx = await self._resolve_from_skill(skill_id)
        if not ctx:
            return None

        result = await draft_curriculum.update_skill(
            ctx["grade"], ctx["subject_id"], skill_id,
            updates.dict(exclude_unset=True),
        )
        if not result:
            return None

        row = await firestore_reader.get_skill(skill_id)
        return Skill(**row) if row else None

    async def delete_skill(self, skill_id: str) -> bool:
        ctx = await self._resolve_from_skill(skill_id)
        if not ctx:
            return False
        return await draft_curriculum.delete_skill(ctx["grade"], ctx["subject_id"], skill_id)

    # ==================== SUBSKILL OPERATIONS ====================

    async def get_subskills_by_skill(self, skill_id: str, include_drafts: bool = False) -> List[Subskill]:
        rows = await firestore_reader.get_subskills_by_skill(skill_id, include_drafts=include_drafts)
        return [Subskill(**row) for row in rows]

    async def get_subskill(self, subskill_id: str) -> Optional[Subskill]:
        row = await firestore_reader.get_subskill(subskill_id)
        return Subskill(**row) if row else None

    async def create_subskill(self, subskill: SubskillCreate, version_id: str) -> Subskill:
        """Add a subskill to a skill in the draft doc."""
        ctx = await self._resolve_from_skill(subskill.skill_id)
        if not ctx:
            raise ValueError(f"Skill {subskill.skill_id} not found")

        await draft_curriculum.add_subskill(ctx["grade"], ctx["subject_id"], subskill.skill_id, {
            "subskill_id": subskill.subskill_id,
            "subskill_description": subskill.subskill_description,
            "subskill_order": subskill.subskill_order,
            "difficulty_start": subskill.difficulty_start,
            "difficulty_end": subskill.difficulty_end,
            "target_difficulty": subskill.target_difficulty,
        })

        now = datetime.utcnow().isoformat()
        return Subskill(
            subskill_id=subskill.subskill_id,
            skill_id=subskill.skill_id,
            subskill_description=subskill.subskill_description,
            subskill_order=subskill.subskill_order,
            difficulty_start=subskill.difficulty_start,
            difficulty_end=subskill.difficulty_end,
            target_difficulty=subskill.target_difficulty,
            version_id=version_id,
            is_draft=True,
            created_at=now,
            updated_at=now,
        )

    async def update_subskill(self, subskill_id: str, updates: SubskillUpdate, version_id: str) -> Optional[Subskill]:
        ctx = await self._resolve_from_subskill(subskill_id)
        if not ctx:
            return None

        result = await draft_curriculum.update_subskill(
            ctx["grade"], ctx["subject_id"], subskill_id,
            updates.dict(exclude_unset=True),
        )
        if not result:
            return None

        row = await firestore_reader.get_subskill(subskill_id)
        return Subskill(**row) if row else None

    async def delete_subskill(self, subskill_id: str) -> bool:
        ctx = await self._resolve_from_subskill(subskill_id)
        if not ctx:
            return False
        return await draft_curriculum.delete_subskill(ctx["grade"], ctx["subject_id"], subskill_id)

    # ==================== HIERARCHICAL TREE ====================

    async def get_curriculum_tree(self, subject_id: str, include_drafts: bool = False) -> Optional[CurriculumTree]:
        """Get the curriculum tree (single doc read, no joins)."""
        tree_data = await firestore_reader.get_curriculum_tree(subject_id, include_drafts=include_drafts)
        if not tree_data:
            return None

        tree_units = []
        for u in tree_data["units"]:
            skill_nodes = []
            for sk in u.get("skills", []):
                subskill_nodes = [SubskillNode(**ss) for ss in sk.get("subskills", [])]
                skill_nodes.append(SkillNode(
                    id=sk["id"], description=sk["description"],
                    order=sk.get("order"), is_draft=sk.get("is_draft", False),
                    subskills=subskill_nodes,
                ))
            tree_units.append(UnitNode(
                id=u["id"], title=u["title"],
                order=u.get("order"), description=u.get("description"),
                is_draft=u.get("is_draft", False), skills=skill_nodes,
            ))

        return CurriculumTree(
            subject_id=tree_data["subject_id"],
            subject_name=tree_data["subject_name"],
            grade=tree_data["grade"],
            version_id=tree_data["version_id"],
            units=tree_units,
        )

    # ==================== FLATTENED VIEW ====================

    async def get_flattened_curriculum_view(
        self, subject_id: str, version_id: Optional[str] = None
    ) -> List[FlattenedCurriculumRow]:
        rows = await firestore_reader.get_flattened_view(subject_id, version_id=version_id)
        return [FlattenedCurriculumRow(**row) for row in rows]

    # ==================== PRIMITIVE OPERATIONS ====================

    async def get_all_primitives(self) -> List[Dict[str, Any]]:
        return await firestore_reader.get_all_primitives()

    async def get_primitives_by_category(self, category: str) -> List[Dict[str, Any]]:
        return await firestore_reader.get_primitives_by_category(category)

    async def get_subskill_primitives(self, subskill_id: str, version_id: str) -> List[Dict[str, Any]]:
        return await firestore_reader.get_subskill_primitives(subskill_id, version_id)

    async def update_subskill_primitives(self, subskill_id: str, primitive_ids: List[str], version_id: str) -> bool:
        from app.db.firestore_curriculum_service import firestore_curriculum_sync
        try:
            await firestore_curriculum_sync.sync_subskill_primitives(subskill_id, primitive_ids, version_id)
            return True
        except Exception as e:
            logger.error(f"Failed to update subskill primitives: {e}")
            raise

    # ==================== DEPLOYMENT TO FIRESTORE ====================

    async def deploy_curriculum_to_firestore(
        self, subject_id: str, version_id: Optional[str] = None, deployed_by: str = "system"
    ) -> Dict[str, Any]:
        """Publish the draft doc to curriculum_published."""
        ctx = await self._resolve_subject_context(subject_id)
        if not ctx:
            raise ValueError(f"Subject {subject_id} not found")

        published = await draft_curriculum.publish(ctx["grade"], subject_id, deployed_by=deployed_by)

        return {
            "success": True,
            "subject_id": subject_id,
            "version_id": published.get("version_id", ""),
            "version_number": published.get("version_number", 1),
            "deployed_at": published.get("deployed_at", ""),
            "stats": published.get("stats", {}),
        }


# Global instance
curriculum_manager = CurriculumManager()
