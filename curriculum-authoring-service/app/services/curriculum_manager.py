"""
Core curriculum management service
Handles CRUD operations for subjects, units, skills, and subskills
"""

import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.models.curriculum import (
    Subject, SubjectCreate, SubjectUpdate,
    Unit, UnitCreate, UnitUpdate,
    Skill, SkillCreate, SkillUpdate,
    Subskill, SubskillCreate, SubskillUpdate,
    CurriculumTree, UnitNode, SkillNode, SubskillNode
)

logger = logging.getLogger(__name__)


class CurriculumManager:
    """Manages curriculum entities and hierarchical structure"""

    # ==================== SUBJECT OPERATIONS ====================

    async def get_all_subjects(self, include_drafts: bool = False) -> List[Subject]:
        """Get all subjects"""
        where_clause = "WHERE is_active = true" if not include_drafts else ""

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        {where_clause}
        ORDER BY subject_name
        """

        results = await db.execute_query(query)
        return [Subject(**row) for row in results]

    async def get_subject(self, subject_id: str, version_id: Optional[str] = None) -> Optional[Subject]:
        """Get a specific subject"""
        where_conditions = ["subject_id = @subject_id"]

        if version_id:
            where_conditions.append("version_id = @version_id")
        else:
            where_conditions.append("is_active = true")

        where_clause = " AND ".join(where_conditions)

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        WHERE {where_clause}
        LIMIT 1
        """

        parameters = [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)
        ]
        if version_id:
            parameters.append(bigquery.ScalarQueryParameter("version_id", "STRING", version_id))

        results = await db.execute_query(query, parameters)
        return Subject(**results[0]) if results else None

    async def create_subject(self, subject: SubjectCreate, user_id: str, version_id: str) -> Subject:
        """Create a new subject"""
        now = datetime.utcnow()

        subject_data = {
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "description": subject.description,
            "grade_level": subject.grade_level,
            "version_id": version_id,
            "is_active": False,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "created_by": user_id
        }

        await db.insert_rows(settings.TABLE_SUBJECTS, [subject_data])
        return Subject(**subject_data)

    async def update_subject(self, subject_id: str, updates: SubjectUpdate, version_id: str) -> Optional[Subject]:
        """Update a subject (creates draft version)"""
        current = await self.get_subject(subject_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)
        update_data.update({
            "subject_id": subject_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        })

        # Merge with current data
        subject_data = {**current.dict(), **update_data}

        await db.insert_rows(settings.TABLE_SUBJECTS, [subject_data])
        return Subject(**subject_data)

    # ==================== UNIT OPERATIONS ====================

    async def get_units_by_subject(self, subject_id: str, include_drafts: bool = False) -> List[Unit]:
        """Get all units for a subject"""
        where_conditions = ["subject_id = @subject_id"]

        if not include_drafts:
            where_conditions.append("is_draft = false")

        where_clause = " AND ".join(where_conditions)

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
        WHERE {where_clause}
        ORDER BY unit_order, unit_id
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)
        return [Unit(**row) for row in results]

    async def get_unit(self, unit_id: str) -> Optional[Unit]:
        """Get a specific unit"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
        WHERE unit_id = @unit_id
        LIMIT 1
        """

        parameters = [bigquery.ScalarQueryParameter("unit_id", "STRING", unit_id)]
        results = await db.execute_query(query, parameters)
        return Unit(**results[0]) if results else None

    async def create_unit(self, unit: UnitCreate, version_id: str) -> Unit:
        """Create a new unit"""
        now = datetime.utcnow()

        unit_data = {
            **unit.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        await db.insert_rows(settings.TABLE_UNITS, [unit_data])
        return Unit(**unit_data)

    async def update_unit(self, unit_id: str, updates: UnitUpdate, version_id: str) -> Optional[Unit]:
        """Update a unit"""
        current = await self.get_unit(unit_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)
        update_data.update({
            "unit_id": unit_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        })

        unit_data = {**current.dict(), **update_data}
        await db.insert_rows(settings.TABLE_UNITS, [unit_data])
        return Unit(**unit_data)

    async def delete_unit(self, unit_id: str) -> bool:
        """Delete a unit (soft delete by marking as draft deleted)"""
        # Implementation would mark as deleted in draft state
        # For now, we'll skip actual deletion logic
        logger.warning(f"Delete unit {unit_id} - Not implemented (draft deletion)")
        return True

    # ==================== SKILL OPERATIONS ====================

    async def get_skills_by_unit(self, unit_id: str, include_drafts: bool = False) -> List[Skill]:
        """Get all skills for a unit"""
        where_conditions = ["unit_id = @unit_id"]

        if not include_drafts:
            where_conditions.append("is_draft = false")

        where_clause = " AND ".join(where_conditions)

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SKILLS)}`
        WHERE {where_clause}
        ORDER BY skill_order, skill_id
        """

        parameters = [bigquery.ScalarQueryParameter("unit_id", "STRING", unit_id)]
        results = await db.execute_query(query, parameters)
        return [Skill(**row) for row in results]

    async def create_skill(self, skill: SkillCreate, version_id: str) -> Skill:
        """Create a new skill"""
        now = datetime.utcnow()

        skill_data = {
            **skill.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        await db.insert_rows(settings.TABLE_SKILLS, [skill_data])
        return Skill(**skill_data)

    # ==================== SUBSKILL OPERATIONS ====================

    async def get_subskills_by_skill(self, skill_id: str, include_drafts: bool = False) -> List[Subskill]:
        """Get all subskills for a skill"""
        where_conditions = ["skill_id = @skill_id"]

        if not include_drafts:
            where_conditions.append("is_draft = false")

        where_clause = " AND ".join(where_conditions)

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}`
        WHERE {where_clause}
        ORDER BY subskill_order, subskill_id
        """

        parameters = [bigquery.ScalarQueryParameter("skill_id", "STRING", skill_id)]
        results = await db.execute_query(query, parameters)
        return [Subskill(**row) for row in results]

    async def create_subskill(self, subskill: SubskillCreate, version_id: str) -> Subskill:
        """Create a new subskill"""
        now = datetime.utcnow()

        subskill_data = {
            **subskill.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        await db.insert_rows(settings.TABLE_SUBSKILLS, [subskill_data])
        return Subskill(**subskill_data)

    # ==================== HIERARCHICAL TREE ====================

    async def get_curriculum_tree(self, subject_id: str, include_drafts: bool = False) -> Optional[CurriculumTree]:
        """Build complete hierarchical curriculum tree for a subject"""
        subject = await self.get_subject(subject_id)
        if not subject:
            return None

        units = await self.get_units_by_subject(subject_id, include_drafts)
        tree_units = []

        for unit in units:
            skills = await self.get_skills_by_unit(unit.unit_id, include_drafts)
            tree_skills = []

            for skill in skills:
                subskills = await self.get_subskills_by_skill(skill.skill_id, include_drafts)
                tree_subskills = [
                    SubskillNode(
                        id=s.subskill_id,
                        description=s.subskill_description,
                        order=s.subskill_order,
                        difficulty_range={
                            "start": s.difficulty_start,
                            "end": s.difficulty_end,
                            "target": s.target_difficulty
                        },
                        is_draft=s.is_draft
                    )
                    for s in subskills
                ]

                tree_skills.append(
                    SkillNode(
                        id=skill.skill_id,
                        description=skill.skill_description,
                        order=skill.skill_order,
                        is_draft=skill.is_draft,
                        subskills=tree_subskills
                    )
                )

            tree_units.append(
                UnitNode(
                    id=unit.unit_id,
                    title=unit.unit_title,
                    order=unit.unit_order,
                    description=unit.description,
                    is_draft=unit.is_draft,
                    skills=tree_skills
                )
            )

        return CurriculumTree(
            subject_id=subject.subject_id,
            subject_name=subject.subject_name,
            grade_level=subject.grade_level,
            version_id=subject.version_id,
            units=tree_units
        )


# Global instance
curriculum_manager = CurriculumManager()
