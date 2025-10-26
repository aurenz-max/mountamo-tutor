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
    Primitive, SubskillPrimitiveAssociation,
    CurriculumTree, UnitNode, SkillNode, SubskillNode,
    FlattenedCurriculumRow
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
        """Create a new subject using DML INSERT for consistency"""
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

        table_id = settings.get_table_id(settings.TABLE_SUBJECTS)

        # Build DML INSERT query
        fields = ", ".join(subject_data.keys())
        value_placeholders = ", ".join([f"@{key}" for key in subject_data.keys()])

        insert_query = f"""
        INSERT INTO `{table_id}` ({fields})
        VALUES ({value_placeholders})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'is_active': 'BOOL', 'is_draft': 'BOOL'}
        for key, value in subject_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(insert_query, parameters)
        return Subject(**subject_data)

    async def update_subject(self, subject_id: str, updates: SubjectUpdate, version_id: str) -> Optional[Subject]:
        """Update a subject using atomic DML MERGE"""
        current = await self.get_subject(subject_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)

        # Convert current model to dict and ensure datetime fields are ISO strings
        current_dict = current.dict(exclude_unset=True)
        if isinstance(current_dict.get("created_at"), datetime):
            current_dict["created_at"] = current_dict["created_at"].isoformat()
        if isinstance(current_dict.get("updated_at"), datetime):
            current_dict["updated_at"] = current_dict["updated_at"].isoformat()

        # Merge with current data to get final state
        subject_data = {
            **current_dict,
            **update_data,
            "subject_id": subject_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_SUBJECTS)

        # Build MERGE statement for atomic upsert
        update_set_clauses = ", ".join([f"T.{key} = @{key}" for key in subject_data.keys()])
        insert_fields = ", ".join(subject_data.keys())
        insert_values = ", ".join([f"@{key}" for key in subject_data.keys()])

        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @subject_id AS subject_id_key) AS S
        ON T.subject_id = S.subject_id_key
        WHEN MATCHED THEN
          UPDATE SET {update_set_clauses}
        WHEN NOT MATCHED THEN
          INSERT ({insert_fields}) VALUES ({insert_values})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'is_active': 'BOOL', 'is_draft': 'BOOL'}
        for key, value in subject_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(merge_query, parameters)
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
        """Create a new unit using DML INSERT for consistency"""
        now = datetime.utcnow()

        unit_data = {
            **unit.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_UNITS)

        # Build DML INSERT query
        fields = ", ".join(unit_data.keys())
        value_placeholders = ", ".join([f"@{key}" for key in unit_data.keys()])

        insert_query = f"""
        INSERT INTO `{table_id}` ({fields})
        VALUES ({value_placeholders})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'unit_order': 'INT64', 'is_draft': 'BOOL'}
        for key, value in unit_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(insert_query, parameters)
        return Unit(**unit_data)

    async def update_unit(self, unit_id: str, updates: UnitUpdate, version_id: str) -> Optional[Unit]:
        """Update a unit using atomic DML MERGE"""
        current = await self.get_unit(unit_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)

        # Convert current model to dict and ensure datetime fields are ISO strings
        current_dict = current.dict(exclude_unset=True)
        if isinstance(current_dict.get("created_at"), datetime):
            current_dict["created_at"] = current_dict["created_at"].isoformat()
        if isinstance(current_dict.get("updated_at"), datetime):
            current_dict["updated_at"] = current_dict["updated_at"].isoformat()

        # Merge with current data to get final state
        unit_data = {
            **current_dict,
            **update_data,
            "unit_id": unit_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_UNITS)

        # Build MERGE statement for atomic upsert
        update_set_clauses = ", ".join([f"T.{key} = @{key}" for key in unit_data.keys()])
        insert_fields = ", ".join(unit_data.keys())
        insert_values = ", ".join([f"@{key}" for key in unit_data.keys()])

        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @unit_id AS unit_id_key) AS S
        ON T.unit_id = S.unit_id_key
        WHEN MATCHED THEN
          UPDATE SET {update_set_clauses}
        WHEN NOT MATCHED THEN
          INSERT ({insert_fields}) VALUES ({insert_values})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'unit_order': 'INT64', 'is_draft': 'BOOL'}
        for key, value in unit_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(merge_query, parameters)
        return Unit(**unit_data)

    async def delete_unit(self, unit_id: str) -> bool:
        """Delete a unit by removing all rows with this ID"""
        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_UNITS)}`
        WHERE unit_id = @unit_id
        """

        parameters = [bigquery.ScalarQueryParameter("unit_id", "STRING", unit_id)]

        try:
            await db.execute_query(query, parameters)
            logger.info(f"✅ Deleted unit {unit_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete unit {unit_id}: {e}")
            return False

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
        """Create a new skill using DML INSERT for consistency"""
        now = datetime.utcnow()

        skill_data = {
            **skill.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_SKILLS)

        # Build DML INSERT query
        fields = ", ".join(skill_data.keys())
        value_placeholders = ", ".join([f"@{key}" for key in skill_data.keys()])

        insert_query = f"""
        INSERT INTO `{table_id}` ({fields})
        VALUES ({value_placeholders})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'skill_order': 'INT64', 'is_draft': 'BOOL'}
        for key, value in skill_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(insert_query, parameters)
        return Skill(**skill_data)

    async def update_skill(self, skill_id: str, updates: SkillUpdate, version_id: str) -> Optional[Skill]:
        """Update a skill using atomic DML MERGE"""
        current = await self.get_skill(skill_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)

        # Convert current model to dict and ensure datetime fields are ISO strings
        current_dict = current.dict(exclude_unset=True)
        if isinstance(current_dict.get("created_at"), datetime):
            current_dict["created_at"] = current_dict["created_at"].isoformat()
        if isinstance(current_dict.get("updated_at"), datetime):
            current_dict["updated_at"] = current_dict["updated_at"].isoformat()

        # Merge with current data to get final state
        skill_data = {
            **current_dict,
            **update_data,
            "skill_id": skill_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_SKILLS)

        # Build MERGE statement for atomic upsert
        update_set_clauses = ", ".join([f"T.{key} = @{key}" for key in skill_data.keys()])
        insert_fields = ", ".join(skill_data.keys())
        insert_values = ", ".join([f"@{key}" for key in skill_data.keys()])

        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @skill_id AS skill_id_key) AS S
        ON T.skill_id = S.skill_id_key
        WHEN MATCHED THEN
          UPDATE SET {update_set_clauses}
        WHEN NOT MATCHED THEN
          INSERT ({insert_fields}) VALUES ({insert_values})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'skill_order': 'INT64', 'is_draft': 'BOOL'}
        for key, value in skill_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(merge_query, parameters)
        return Skill(**skill_data)

    async def delete_skill(self, skill_id: str) -> bool:
        """Delete a skill by removing all rows with this ID"""
        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_SKILLS)}`
        WHERE skill_id = @skill_id
        """

        parameters = [bigquery.ScalarQueryParameter("skill_id", "STRING", skill_id)]

        try:
            await db.execute_query(query, parameters)
            logger.info(f"✅ Deleted skill {skill_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete skill {skill_id}: {e}")
            return False

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
        """Create a new subskill using DML INSERT for consistency"""
        now = datetime.utcnow()

        subskill_data = {
            **subskill.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_SUBSKILLS)

        # Build DML INSERT query
        fields = ", ".join(subskill_data.keys())
        value_placeholders = ", ".join([f"@{key}" for key in subskill_data.keys()])

        insert_query = f"""
        INSERT INTO `{table_id}` ({fields})
        VALUES ({value_placeholders})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {
            'subskill_order': 'INT64',
            'difficulty_start': 'FLOAT64',
            'difficulty_end': 'FLOAT64',
            'target_difficulty': 'FLOAT64',
            'is_draft': 'BOOL'
        }
        for key, value in subskill_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(insert_query, parameters)
        return Subskill(**subskill_data)

    async def update_subskill(self, subskill_id: str, updates: SubskillUpdate, version_id: str) -> Optional[Subskill]:
        """Update a subskill using atomic DML MERGE"""
        current = await self.get_subskill(subskill_id)
        if not current:
            return None

        now = datetime.utcnow()
        update_data = updates.dict(exclude_unset=True)

        # Convert current model to dict and ensure datetime fields are ISO strings
        current_dict = current.dict(exclude_unset=True)
        if isinstance(current_dict.get("created_at"), datetime):
            current_dict["created_at"] = current_dict["created_at"].isoformat()
        if isinstance(current_dict.get("updated_at"), datetime):
            current_dict["updated_at"] = current_dict["updated_at"].isoformat()

        # Merge with current data to get final state
        subskill_data = {
            **current_dict,
            **update_data,
            "subskill_id": subskill_id,
            "version_id": version_id,
            "is_draft": True,
            "updated_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_SUBSKILLS)

        # Build MERGE statement for atomic upsert
        update_set_clauses = ", ".join([f"T.{key} = @{key}" for key in subskill_data.keys()])
        insert_fields = ", ".join(subskill_data.keys())
        insert_values = ", ".join([f"@{key}" for key in subskill_data.keys()])

        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @subskill_id AS subskill_id_key) AS S
        ON T.subskill_id = S.subskill_id_key
        WHEN MATCHED THEN
          UPDATE SET {update_set_clauses}
        WHEN NOT MATCHED THEN
          INSERT ({insert_fields}) VALUES ({insert_values})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {
            'subskill_order': 'INT64',
            'difficulty_start': 'FLOAT64',
            'difficulty_end': 'FLOAT64',
            'target_difficulty': 'FLOAT64',
            'is_draft': 'BOOL'
        }
        for key, value in subskill_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(merge_query, parameters)
        return Subskill(**subskill_data)

    async def delete_subskill(self, subskill_id: str) -> bool:
        """Delete a subskill by removing all rows with this ID"""
        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}`
        WHERE subskill_id = @subskill_id
        """

        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]

        try:
            await db.execute_query(query, parameters)
            logger.info(f"✅ Deleted subskill {subskill_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete subskill {subskill_id}: {e}")
            return False

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

    # ==================== FLATTENED VIEW ====================

    async def get_flattened_curriculum_view(
        self,
        subject_id: str,
        version_id: Optional[str] = None
    ) -> List[FlattenedCurriculumRow]:
        """
        Get flattened curriculum view matching BigQuery analytics view structure.
        Returns published curriculum only (is_draft=false).
        If version_id is None, gets the active version.
        """
        # Get subject and version info
        subject = await self.get_subject(subject_id, version_id)
        if not subject:
            return []

        # Determine which version to query
        target_version_id = version_id or subject.version_id

        # Get version number for metadata
        version_query = f"""
        SELECT version_number
        FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
        WHERE version_id = @version_id
        LIMIT 1
        """
        version_params = [bigquery.ScalarQueryParameter("version_id", "STRING", target_version_id)]
        version_results = await db.execute_query(version_query, version_params)
        version_number = version_results[0]["version_number"] if version_results else 1

        # Build flattened query matching the analytics view structure
        # This mirrors the CREATE VIEW query from backend/scripts/create_curriculum_views.sql
        query = f"""
        SELECT
            s.subject_name as subject,
            s.grade_level as grade,
            s.subject_id,
            u.unit_id,
            u.unit_title,
            u.unit_order,
            sk.skill_id,
            sk.skill_description,
            sk.skill_order,
            sub.subskill_id,
            sub.subskill_description,
            sub.subskill_order,
            sub.difficulty_start,
            sub.difficulty_end,
            sub.target_difficulty,
            s.version_id
        FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}` s
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u
            ON s.subject_id = u.subject_id AND s.version_id = u.version_id
        JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` sk
            ON u.unit_id = sk.unit_id AND u.version_id = sk.version_id
        JOIN `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` sub
            ON sk.skill_id = sub.skill_id AND sk.version_id = sub.version_id
        WHERE s.subject_id = @subject_id
            AND s.version_id = @version_id
            AND s.is_active = true
            AND s.is_draft = false
            AND u.is_draft = false
            AND sk.is_draft = false
            AND sub.is_draft = false
        ORDER BY u.unit_order, sk.skill_order, sub.subskill_order
        """

        parameters = [
            bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", target_version_id)
        ]

        logger.info(f"📊 Querying flattened curriculum view for subject {subject_id}, version {target_version_id}")
        results = await db.execute_query(query, parameters)
        logger.info(f"📦 Found {len(results)} flattened curriculum rows")

        # Build flattened rows with version metadata
        flattened_rows = []
        for row in results:
            flattened_rows.append(FlattenedCurriculumRow(
                subject=row["subject"],
                grade=row.get("grade"),
                subject_id=row["subject_id"],
                unit_id=row["unit_id"],
                unit_title=row["unit_title"],
                unit_order=row.get("unit_order"),
                skill_id=row["skill_id"],
                skill_description=row["skill_description"],
                skill_order=row.get("skill_order"),
                subskill_id=row["subskill_id"],
                subskill_description=row["subskill_description"],
                subskill_order=row.get("subskill_order"),
                difficulty_start=row.get("difficulty_start"),
                difficulty_end=row.get("difficulty_end"),
                target_difficulty=row.get("target_difficulty"),
                version_id=row["version_id"],
                version_number=version_number
            ))

        return flattened_rows

    # ==================== PRIMITIVE OPERATIONS ====================

    async def get_all_primitives(self) -> List[Dict[str, Any]]:
        """Get all primitives from the library"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_PRIMITIVES)}`
        ORDER BY category, primitive_name
        """

        logger.info("📊 Querying all primitives")
        results = await db.execute_query(query)
        logger.info(f"📦 Found {len(results)} primitives")

        return results

    async def get_primitives_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get primitives filtered by category"""
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_PRIMITIVES)}`
        WHERE category = @category
        ORDER BY primitive_name
        """

        parameters = [
            bigquery.ScalarQueryParameter("category", "STRING", category)
        ]

        logger.info(f"📊 Querying primitives for category: {category}")
        results = await db.execute_query(query, parameters)
        logger.info(f"📦 Found {len(results)} primitives in category {category}")

        return results

    async def get_subskill_primitives(self, subskill_id: str, version_id: str) -> List[Dict[str, Any]]:
        """Get all primitives associated with a subskill"""
        query = f"""
        SELECT p.*
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILL_PRIMITIVES)}` sp
        JOIN `{settings.get_table_id(settings.TABLE_PRIMITIVES)}` p
            ON sp.primitive_id = p.primitive_id
        WHERE sp.subskill_id = @subskill_id
            AND sp.version_id = @version_id
            AND sp.is_draft = false
        ORDER BY p.category, p.primitive_name
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
        ]

        logger.info(f"📊 Querying primitives for subskill {subskill_id}, version {version_id}")
        results = await db.execute_query(query, parameters)
        logger.info(f"📦 Found {len(results)} primitives for subskill")

        return results

    async def update_subskill_primitives(
        self,
        subskill_id: str,
        primitive_ids: List[str],
        version_id: str
    ) -> bool:
        """
        Update the primitives associated with a subskill.
        Creates draft records in the junction table.
        """
        try:
            now = datetime.utcnow()

            # Step 1: Delete existing draft associations for this subskill
            delete_query = f"""
            DELETE FROM `{settings.get_table_id(settings.TABLE_SUBSKILL_PRIMITIVES)}`
            WHERE subskill_id = @subskill_id
                AND version_id = @version_id
                AND is_draft = true
            """

            delete_params = [
                bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
                bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
            ]

            logger.info(f"🗑️ Deleting existing draft primitive associations for subskill {subskill_id}")
            await db.execute_query(delete_query, delete_params)

            # Step 2: Insert new draft associations
            if primitive_ids:
                rows_to_insert = []
                for primitive_id in primitive_ids:
                    rows_to_insert.append({
                        "subskill_id": subskill_id,
                        "primitive_id": primitive_id,
                        "version_id": version_id,
                        "is_draft": True,
                        "created_at": now.isoformat()
                    })

                logger.info(f"💾 Inserting {len(rows_to_insert)} draft primitive associations")
                success = await db.insert_rows(settings.TABLE_SUBSKILL_PRIMITIVES, rows_to_insert)

                if not success:
                    logger.error("❌ Failed to insert primitive associations")
                    return False

                logger.info(f"✅ Successfully updated primitives for subskill {subskill_id}")
            else:
                logger.info(f"✅ Removed all primitives from subskill {subskill_id}")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to update subskill primitives: {e}")
            raise


# Global instance
curriculum_manager = CurriculumManager()
