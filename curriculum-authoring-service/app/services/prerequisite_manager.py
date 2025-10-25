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
        version_id: str,
        subject_id: str
    ) -> Prerequisite:
        """Create a new prerequisite relationship using DML INSERT for consistency"""
        now = datetime.utcnow()
        prerequisite_id = str(uuid.uuid4())

        prerequisite_data = {
            "prerequisite_id": prerequisite_id,
            "subject_id": subject_id,
            **prerequisite.dict(),
            "version_id": version_id,
            "is_draft": True,
            "created_at": now.isoformat()
        }

        table_id = settings.get_table_id(settings.TABLE_PREREQUISITES)

        # Build DML INSERT query
        fields = ", ".join(prerequisite_data.keys())
        value_placeholders = ", ".join([f"@{key}" for key in prerequisite_data.keys()])

        insert_query = f"""
        INSERT INTO `{table_id}` ({fields})
        VALUES ({value_placeholders})
        """

        # Create BigQuery parameters with appropriate types
        parameters = []
        type_map = {'min_proficiency_threshold': 'FLOAT64', 'is_draft': 'BOOL'}
        for key, value in prerequisite_data.items():
            bq_type = type_map.get(key, 'STRING')
            parameters.append(bigquery.ScalarQueryParameter(key, bq_type, value))

        await db.execute_query(insert_query, parameters)
        return Prerequisite(**prerequisite_data)

    async def delete_prerequisite(self, prerequisite_id: str) -> bool:
        """Delete a prerequisite relationship by removing all rows with this ID"""
        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        WHERE prerequisite_id = @prerequisite_id
        """

        parameters = [bigquery.ScalarQueryParameter("prerequisite_id", "STRING", prerequisite_id)]

        try:
            await db.execute_query(query, parameters)
            logger.info(f"✅ Deleted prerequisite {prerequisite_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete prerequisite {prerequisite_id}: {e}")
            return False

    async def get_entity_prerequisites(
        self,
        entity_id: str,
        entity_type: EntityType,
        include_drafts: bool = False
    ) -> EntityPrerequisites:
        """Get all prerequisites and unlocks for an entity using optimized single query"""

        # Single query to get both prerequisites and unlocks with a relationship type indicator
        combined_query = f"""
        SELECT *, 'prerequisite' as relationship_type
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        WHERE unlocks_entity_id = @entity_id
          AND unlocks_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}

        UNION ALL

        SELECT *, 'unlocks' as relationship_type
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}`
        WHERE prerequisite_entity_id = @entity_id
          AND prerequisite_entity_type = @entity_type
          {'' if include_drafts else 'AND is_draft = false'}
        """

        parameters = [
            bigquery.ScalarQueryParameter("entity_id", "STRING", entity_id),
            bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
        ]

        results = await db.execute_query(combined_query, parameters)

        # Separate results by relationship type
        prerequisites = []
        unlocks = []

        for row in results:
            relationship_type = row.pop('relationship_type')
            prereq = Prerequisite(**row)

            if relationship_type == 'prerequisite':
                prerequisites.append(prereq)
            else:
                unlocks.append(prereq)

        return EntityPrerequisites(
            entity_id=entity_id,
            entity_type=entity_type,
            prerequisites=prerequisites,
            unlocks=unlocks
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
        # Use curriculum_versions as the source of truth for active versions
        prerequisites_query = f"""
        SELECT p.*
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}` p
        WHERE p.version_id IN (
          SELECT DISTINCT version_id
          FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
          WHERE subject_id = @subject_id
          {'' if include_drafts else 'AND is_active = true'}
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
        logger.info(f"🔄 Starting cycle detection for prerequisite validation")
        logger.info(f"   Checking if path exists from {prerequisite.unlocks_entity_id} → {prerequisite.prerequisite_entity_id}")

        # Check if creating this prerequisite would create a cycle
        # Simple check: see if target already has path to source

        visited = set()
        path_count = 0

        async def has_path(from_id: str, to_id: str, depth: int = 0) -> bool:
            """Check if there's a path from from_id to to_id"""
            nonlocal path_count
            indent = "  " * depth

            logger.debug(f"{indent}🔍 Checking path: {from_id} → {to_id}")

            if from_id == to_id:
                logger.warning(f"{indent}🔴 CYCLE DETECTED: {from_id} == {to_id}")
                return True

            if from_id in visited:
                logger.debug(f"{indent}⏭️  Already visited {from_id}, skipping")
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

            path_count += len(results)
            logger.debug(f"{indent}📊 Found {len(results)} outgoing edges from {from_id}")

            for row in results:
                next_id = row["unlocks_entity_id"]
                logger.debug(f"{indent}➡️  Following edge: {from_id} → {next_id}")
                if await has_path(next_id, to_id, depth + 1):
                    return True

            return False

        # Check if unlocks_entity already has path to prerequisite_entity (would create cycle)
        has_cycle = await has_path(prerequisite.unlocks_entity_id, prerequisite.prerequisite_entity_id)

        if has_cycle:
            logger.warning(f"❌ Circular dependency detected! Visited {len(visited)} nodes, checked {path_count} paths")
            return False, "Creating this prerequisite would create a circular dependency"

        logger.info(f"✅ No circular dependency found. Visited {len(visited)} nodes, checked {path_count} paths")
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

    async def build_enriched_graph(
        self,
        subject_id: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """
        Build enriched prerequisite graph with full hierarchical metadata

        This enhanced version includes:
        - Complete hierarchical context (subject, unit, skill, subskill)
        - Ordering information for layout algorithms
        - Entity descriptions for tooltips
        - Metadata counts for analytics

        Used for graph caching and visualization.
        """
        logger.info(f"🔨 Building enriched graph for subject {subject_id} (include_drafts={include_drafts})")

        # Get subject info
        subject_query = f"""
        SELECT subject_name, description, grade_level
        FROM `{settings.get_table_id(settings.TABLE_SUBJECTS)}`
        WHERE subject_id = @subject_id
        LIMIT 1
        """
        subject_params = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]
        subject_results = await db.execute_query(subject_query, subject_params)
        subject_info = subject_results[0] if subject_results else {}

        # Get all entities with full hierarchical context
        enriched_query = f"""
        WITH subject_skills AS (
          SELECT
            s.skill_id,
            s.skill_description,
            s.skill_order,
            u.unit_id,
            u.unit_title,
            u.unit_order,
            u.subject_id,
            'skill' as entity_type,
            CAST(NULL AS STRING) as subskill_id,
            CAST(NULL AS STRING) as subskill_description,
            CAST(NULL AS INT64) as subskill_order,
            CAST(NULL AS FLOAT64) as difficulty_start,
            CAST(NULL AS FLOAT64) as difficulty_end,
            CAST(NULL AS FLOAT64) as target_difficulty,
            CAST(NULL AS STRING) as parent_skill_id,
            CAST(NULL AS STRING) as parent_skill_description
          FROM `{settings.get_table_id(settings.TABLE_SKILLS)}` s
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id
            {'' if include_drafts else 'AND s.is_draft = false AND u.is_draft = false'}
        ),
        subject_subskills AS (
          SELECT
            CAST(NULL AS STRING) as skill_id,
            CAST(NULL AS STRING) as skill_description,
            s.skill_order,
            u.unit_id,
            u.unit_title,
            u.unit_order,
            u.subject_id,
            'subskill' as entity_type,
            ss.subskill_id,
            ss.subskill_description,
            ss.subskill_order,
            ss.difficulty_start,
            ss.difficulty_end,
            ss.target_difficulty,
            s.skill_id as parent_skill_id,
            s.skill_description as parent_skill_description
          FROM `{settings.get_table_id(settings.TABLE_SUBSKILLS)}` ss
          JOIN `{settings.get_table_id(settings.TABLE_SKILLS)}` s ON ss.skill_id = s.skill_id
          JOIN `{settings.get_table_id(settings.TABLE_UNITS)}` u ON s.unit_id = u.unit_id
          WHERE u.subject_id = @subject_id
            {'' if include_drafts else 'AND ss.is_draft = false AND s.is_draft = false AND u.is_draft = false'}
        )
        SELECT * FROM subject_skills
        UNION ALL
        SELECT * FROM subject_subskills
        """

        # Get prerequisites
        # Use curriculum_versions as the source of truth for active versions
        prerequisites_query = f"""
        SELECT p.*
        FROM `{settings.get_table_id(settings.TABLE_PREREQUISITES)}` p
        WHERE p.version_id IN (
          SELECT DISTINCT version_id
          FROM `{settings.get_table_id(settings.TABLE_VERSIONS)}`
          WHERE subject_id = @subject_id
          {'' if include_drafts else 'AND is_active = true'}
        )
        {'' if include_drafts else 'AND p.is_draft = false'}
        """

        parameters = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]

        entities = await db.execute_query(enriched_query, parameters)
        prerequisites = await db.execute_query(prerequisites_query, parameters)

        logger.info(f"📊 Found {len(entities)} entities and {len(prerequisites)} prerequisites")

        # Build enriched nodes
        nodes = []
        for entity in entities:
            entity_type = entity["entity_type"]

            if entity_type == "skill":
                node = {
                    "id": entity["skill_id"],
                    "type": "skill",
                    "label": entity["skill_description"],
                    "subject_id": entity["subject_id"],
                    "unit_id": entity["unit_id"],
                    "unit_title": entity["unit_title"],
                    "unit_order": entity["unit_order"],
                    "skill_order": entity["skill_order"]
                }
            else:  # subskill
                node = {
                    "id": entity["subskill_id"],
                    "type": "subskill",
                    "label": entity["subskill_description"],
                    "subject_id": entity["subject_id"],
                    "unit_id": entity["unit_id"],
                    "unit_title": entity["unit_title"],
                    "unit_order": entity["unit_order"],
                    "skill_id": entity.get("parent_skill_id"),
                    "skill_description": entity.get("parent_skill_description"),
                    "skill_order": entity["skill_order"],
                    "subskill_order": entity["subskill_order"],
                    "difficulty_start": entity.get("difficulty_start"),
                    "difficulty_end": entity.get("difficulty_end"),
                    "target_difficulty": entity.get("target_difficulty")
                }

            nodes.append(node)

        # Build enriched edges
        edges = []
        for prereq in prerequisites:
            edge = {
                "id": prereq["prerequisite_id"],
                "source": prereq["prerequisite_entity_id"],
                "source_type": prereq["prerequisite_entity_type"],
                "target": prereq["unlocks_entity_id"],
                "target_type": prereq["unlocks_entity_type"],
                "threshold": prereq.get("min_proficiency_threshold", 0.8),
                "version_id": prereq["version_id"]
            }
            edges.append(edge)

        # Calculate metadata
        skill_count = sum(1 for n in nodes if n["type"] == "skill")
        subskill_count = sum(1 for n in nodes if n["type"] == "subskill")

        graph = PrerequisiteGraph(nodes=nodes, edges=edges)
        logger.info(f"✅ Built enriched graph: {skill_count} skills, {subskill_count} subskills, {len(edges)} edges")

        return graph


# Global instance
prerequisite_manager = PrerequisiteManager()
