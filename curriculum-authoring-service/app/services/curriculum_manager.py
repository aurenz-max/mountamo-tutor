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

        logger.info(f"📊 Querying subjects with include_drafts={include_drafts}")
        logger.info(f"🔍 Query: {query}")

        results = await db.execute_query(query)
        logger.info(f"📦 Found {len(results)} subjects")

        if results:
            logger.info(f"📋 Sample subject: {results[0]}")

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

    async def get_skill(self, skill_id: str) -> Optional[Skill]:
        """Get a specific skill"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SKILLS)}`
        WHERE skill_id = @skill_id
        LIMIT 1
        """

        parameters = [bigquery.ScalarQueryParameter("skill_id", "STRING", skill_id)]
        results = await db.execute_query(query, parameters)
        return Skill(**results[0]) if results else None

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

    async def update_skill(self, skill_id: str, updates: SkillUpdate, version_id: str) -> Optional[Skill]:
        """Update a skill"""
        current = await self.get_skill(skill_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)
        update_data.update({
            "skill_id": skill_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        })

        skill_data = {**current.dict(), **update_data}
        await db.insert_rows(settings.TABLE_SKILLS, [skill_data])
        return Skill(**skill_data)

    async def delete_skill(self, skill_id: str) -> bool:
        """Delete a skill (soft delete by marking as draft deleted)"""
        # Implementation would mark as deleted in draft state
        # For now, we'll skip actual deletion logic
        logger.warning(f"Delete skill {skill_id} - Not implemented (draft deletion)")
        return True

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

    async def get_subskill(self, subskill_id: str) -> Optional[Subskill]:
        """Get a specific subskill"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}`
        WHERE subskill_id = @subskill_id
        LIMIT 1
        """

        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]
        results = await db.execute_query(query, parameters)
        return Subskill(**results[0]) if results else None

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

    async def update_subskill(self, subskill_id: str, updates: SubskillUpdate, version_id: str) -> Optional[Subskill]:
        """Update a subskill"""
        current = await self.get_subskill(subskill_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)
        update_data.update({
            "subskill_id": subskill_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        })

        subskill_data = {**current.dict(), **update_data}
        await db.insert_rows(settings.TABLE_SUBSKILLS, [subskill_data])
        return Subskill(**subskill_data)

    async def delete_subskill(self, subskill_id: str) -> bool:
        """Delete a subskill (soft delete by marking as draft deleted)"""
        # Implementation would mark as deleted in draft state
        # For now, we'll skip actual deletion logic
        logger.warning(f"Delete subskill {subskill_id} - Not implemented (draft deletion)")
        return True

    # ==================== HIERARCHICAL TREE ====================

    async def get_curriculum_tree(self, subject_id: str, include_drafts: bool = False) -> Optional[CurriculumTree]:
        """Build complete hierarchical curriculum tree for a subject using optimized single query"""
        subject = await self.get_subject(subject_id)
        if not subject:
            return None

        # Build WHERE clause for drafts
        draft_filter = "" if include_drafts else "AND u.is_draft = false AND sk.is_draft = false AND sub.is_draft = false"

        # Single query with LEFT JOINs to fetch entire hierarchy at once
        query = f"""
        SELECT
            u.unit_id, u.unit_title, u.unit_order, u.description as unit_description, u.is_draft as unit_is_draft,
            sk.skill_id, sk.skill_description, sk.skill_order, sk.is_draft as skill_is_draft,
            sub.subskill_id, sub.subskill_description, sub.subskill_order,
            sub.difficulty_start, sub.difficulty_end, sub.target_difficulty, sub.is_draft as subskill_is_draft
        FROM `{settings.get_table_id(settings.TABLE_UNITS)}` u
        LEFT JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` sk
            ON u.unit_id = sk.unit_id
        LEFT JOIN `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` sub
            ON sk.skill_id = sub.skill_id
        WHERE u.subject_id = @subject_id
        {draft_filter}
        ORDER BY u.unit_order, u.unit_id, sk.skill_order, sk.skill_id, sub.subskill_order, sub.subskill_id
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)

        # Build tree from flat results using dictionaries for O(1) lookups
        units_dict = {}
        skills_dict = {}

        for row in results:
            unit_id = row.get("unit_id")
            skill_id = row.get("skill_id")
            subskill_id = row.get("subskill_id")

            # Create/get unit
            if unit_id and unit_id not in units_dict:
                units_dict[unit_id] = UnitNode(
                    id=unit_id,
                    title=row["unit_title"],
                    order=row.get("unit_order"),
                    description=row.get("unit_description"),
                    is_draft=row.get("unit_is_draft", False),
                    skills=[]
                )

            # Create/get skill
            if skill_id and skill_id not in skills_dict:
                skill_node = SkillNode(
                    id=skill_id,
                    description=row["skill_description"],
                    order=row.get("skill_order"),
                    is_draft=row.get("skill_is_draft", False),
                    subskills=[]
                )
                skills_dict[skill_id] = skill_node
                if unit_id:
                    units_dict[unit_id].skills.append(skill_node)

            # Add subskill
            if subskill_id and skill_id:
                subskill_node = SubskillNode(
                    id=subskill_id,
                    description=row["subskill_description"],
                    order=row.get("subskill_order"),
                    difficulty_range={
                        "start": row.get("difficulty_start"),
                        "end": row.get("difficulty_end"),
                        "target": row.get("target_difficulty")
                    },
                    is_draft=row.get("subskill_is_draft", False)
                )
                skills_dict[skill_id].subskills.append(subskill_node)

        # Convert dict to sorted list
        tree_units = sorted(units_dict.values(), key=lambda u: (u.order or 0, u.id))

        return CurriculumTree(
            subject_id=subject.subject_id,
            subject_name=subject.subject_name,
            grade_level=subject.grade_level,
            version_id=subject.version_id,
            units=tree_units
        )


# Global instance
curriculum_manager = CurriculumManager()
