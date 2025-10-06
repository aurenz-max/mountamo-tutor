"""
Prerequisite and learning path graph management service
"""

import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.models.prerequisites import (
    Prerequisite, PrerequisiteCreate,
    EntityPrerequisites, PrerequisiteGraph,
    EntityType
)

logger = logging.getLogger(__name__)


class PrerequisiteManager:
    """Manages prerequisite relationships and learning path graphs"""

    async def create_prerequisite(
        self,
        prerequisite: PrerequisiteCreate,
        version_id: str
    ) -> Prerequisite:
        """Create a new prerequisite relationship"""
        now = datetime.utcnow()
        prerequisite_id = str(uuid.uuid4())

        prerequisite_data = {
            "prerequisite_id": prerequisite_id,
            **prerequisite.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat()
        }

        await db.insert_rows(settings.TABLE_PREREQUISITES, [prerequisite_data])
        return Prerequisite(**prerequisite_data)

    async def delete_prerequisite(self, prerequisite_id: str) -> bool:
        """Delete a prerequisite relationship"""
        # In a real implementation, this would mark as deleted in draft state
        logger.warning(f"Delete prerequisite {prerequisite_id} - Not fully implemented")
        return True

    async def get_entity_prerequisites(
        self,
        entity_id: str,
        entity_type: EntityType,
        include_drafts: bool = False
    ) -> EntityPrerequisites:
        """Get all prerequisites and unlocks for an entity"""

        # Get prerequisites (what this entity requires)
        prerequisites_query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        WHERE unlocks_entity_id = @entity_id
          AND unlocks_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}
        """

        # Get unlocks (what this entity unlocks)
        unlocks_query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        WHERE prerequisite_entity_id = @entity_id
          AND prerequisite_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}
        """

        parameters = [
            bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id),
            bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
        ]

        prerequisites_results = await db.execute_query(prerequisites_query, parameters)
        unlocks_results = await db.execute_query(unlocks_query, parameters)

        return EntityPrerequisites(
            entity_id=entity_id,
            entity_type=entity_type,
            prerequisites=[Prerequisite(**row) for row in prerequisites_results],
            unlocks=[Prerequisite(**row) for row in unlocks_results]
        )

    async def get_subject_graph(
        self,
        subject_id: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """Build complete prerequisite graph for a subject"""

        # Get all entities for this subject (skills and subskills)
        skills_query = f"""
        SELECT s.skill_id, s.skill_description
        FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` s
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
          {'' if include_drafts else 'AND s.is_draft = false'}
        """

        subskills_query = f"""
        SELECT ss.subskill_id, ss.subskill_description
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` ss
        JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` s ON ss.skill_id = s.skill_id
        JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
        WHERE u.subject_id = @subject_id
          {'' if include_drafts else 'AND ss.is_draft = false'}
        """

        # Get all prerequisites for this subject
        prerequisites_query = f"""
        SELECT p.*
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}` p
        WHERE p.version_id IN (
          SELECT DISTINCT version_id
          FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
          WHERE subject_id = @subject_id
        )
        {'' if include_drafts else 'AND p.is_draft = false'}
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]

        skills = await db.execute_query(skills_query, parameters)
        subskills = await db.execute_query(subskills_query, parameters)
        prerequisites = await db.execute_query(prerequisites_query, parameters)

        # Build nodes
        nodes = []
        for skill in skills:
            nodes.append({
                "id": skill["skill_id"],
                "type": "skill",
                "label": skill["skill_description"]
            })

        for subskill in subskills:
            nodes.append({
                "id": subskill["subskill_id"],
                "type": "subskill",
                "label": subskill["subskill_description"]
            })

        # Build edges
        edges = []
        for prereq in prerequisites:
            edges.append({
                "source": prereq["prerequisite_entity_id"],
                "target": prereq["unlocks_entity_id"],
                "threshold": prereq.get("min_proficiency_threshold", 0.8)
            })

        return PrerequisiteGraph(nodes=nodes, edges=edges)

    async def validate_prerequisite(
        self,
        prerequisite: PrerequisiteCreate
    ) -> tuple[bool, Optional[str]]:
        """Validate that a prerequisite doesn't create a circular dependency"""

        # Check if creating this prerequisite would create a cycle
        # Simple check: see if target already has path to source

        visited = set()

        async def has_path(from_id: str, to_id: str) -> bool:
            """Check if there's a path from from_id to to_id"""
            if from_id == to_id:
                return True

            if from_id in visited:
                return False

            visited.add(from_id)

            # Get all entities that from_id unlocks
            query = f"""
            SELECT unlocks_entity_id
            FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
            WHERE prerequisite_entity_id = @from_id
            """

            parameters = [bigquery.ScalarQueryParameter("from_id", "STRING", from_id)]
            results = await db.execute_query(query, parameters)

            for row in results:
                if await has_path(row["unlocks_entity_id"], to_id):
                    return True

            return False

        # Check if unlocks_entity already has path to prerequisite_entity (would create cycle)
        if await has_path(prerequisite.unlocks_entity_id, prerequisite.prerequisite_entity_id):
            return False, "Creating this prerequisite would create a circular dependency"

        return True, None

    async def get_base_skills(self, subject_id: str) -> List[Dict[str, Any]]:
        """Get base skills/subskills (those with no prerequisites) for a subject"""

        query = f"""
        WITH subject_entities AS (
          SELECT s.skill_id as entity_id, 'skill' as entity_type
          FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` s
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id AND s.is_draft = false

          UNION ALL

          SELECT ss.subskill_id as entity_id, 'subskill' as entity_type
          FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` ss
          JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` s ON ss.skill_id = s.skill_id
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id AND ss.is_draft = false
        ),
        entities_with_prereqs AS (
          SELECT DISTINCT unlocks_entity_id as entity_id
          FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
          WHERE is_draft = false
        )

        SELECT se.*
        FROM subject_entities se
        LEFT JOIN entities_with_prereqs ewp ON se.entity_id = ewp.entity_id
        WHERE ewp.entity_id IS NULL
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        results = await db.execute_query(query, parameters)

        return [dict(row) for row in results]


# Global instance
prerequisite_manager = PrerequisiteManager()
