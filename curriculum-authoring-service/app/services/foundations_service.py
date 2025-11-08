"""
Foundations Service - Manages AI-generated foundational content for subskills
"""

import logging
import json
from typing import Optional
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.models.foundations import (
    FoundationsData,
    MasterContext,
    ContextPrimitives,
    Character,
    ComparisonPair,
    Category,
    Attribute
)
from app.generators import (
    MasterContextGenerator,
    ContextPrimitivesGenerator
)
from app.services.curriculum_manager import curriculum_manager

logger = logging.getLogger(__name__)


class FoundationsService:
    """Manages AI-generated foundational content for subskills"""

    def __init__(self):
        self.master_context_generator = MasterContextGenerator()
        self.context_primitives_generator = ContextPrimitivesGenerator()

    async def generate_foundations(
        self,
        subskill_id: str,
        version_id: str
    ) -> FoundationsData:
        """
        Generate foundational components:
        1. Master Context
        2. Context Primitives

        Returns combined FoundationsData without saving to database.
        """
        logger.info(f"🎨 Generating foundations for subskill {subskill_id}, version {version_id}")

        # Step 1: Get subskill details from curriculum
        subskill = await curriculum_manager.get_subskill(subskill_id)
        if not subskill:
            raise ValueError(f"Subskill {subskill_id} not found")

        # Step 2: Build context for generators
        # We need to fetch parent entities to get full context
        skill = await curriculum_manager.get_skill(subskill.skill_id)
        unit = await curriculum_manager.get_unit(skill.unit_id) if skill else None
        subject = await curriculum_manager.get_subject(unit.subject_id) if unit else None

        if not (skill and unit and subject):
            raise ValueError(f"Could not resolve full curriculum hierarchy for subskill {subskill_id}")

        subskill_data = {
            'subject': subject.subject_name,
            'grade_level': subject.grade_level or 'Kindergarten',
            'unit': unit.unit_title,
            'skill': skill.skill_description,
            'subskill': subskill.subskill_description,
            'difficulty_level': 'intermediate',  # Can derive from target_difficulty
            'prerequisites': []  # Could fetch from prerequisites table if needed
        }

        # Step 3: Generate Master Context
        logger.info("📚 Generating master context...")
        master_context = await self.master_context_generator.generate_master_context(subskill_data)

        # Step 4: Generate Context Primitives
        logger.info("🎨 Generating context primitives...")
        context_primitives = await self.context_primitives_generator.generate_context_primitives(
            subskill_data,
            master_context
        )

        # Step 5: Build FoundationsData
        now = datetime.utcnow()
        foundations = FoundationsData(
            subskill_id=subskill_id,
            version_id=version_id,
            master_context=master_context,
            context_primitives=context_primitives,
            approved_visual_schemas=[],  # Removed visual schema recommendations
            generation_status='generated',
            is_draft=True,
            created_at=now,
            updated_at=now
        )

        logger.info(f"✅ Successfully generated foundations for {subskill_id}")
        return foundations

    async def get_foundations(
        self,
        subskill_id: str,
        version_id: str
    ) -> Optional[FoundationsData]:
        """
        Retrieve saved foundations for a subskill.
        Returns None if no foundations exist yet.
        """
        logger.info(f"🔍 Retrieving foundations for subskill {subskill_id}, version {version_id}")

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_SUBSKILL_FOUNDATIONS)}`
        WHERE subskill_id = @subskill_id
            AND version_id = @version_id
        LIMIT 1
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
        ]

        results = await db.execute_query(query, parameters)

        if not results:
            logger.info(f"ℹ️ No foundations found for {subskill_id}")
            return None

        row = results[0]

        # Parse JSON fields
        master_context_data = row.get('master_context')
        context_primitives_data = row.get('context_primitives')

        if not master_context_data or not context_primitives_data:
            logger.warning(f"⚠️ Incomplete foundation data for {subskill_id}")
            return None

        # Reconstruct models from JSON
        master_context = MasterContext(**master_context_data)

        # Reconstruct context primitives with nested models
        primitives_dict = context_primitives_data
        context_primitives = ContextPrimitives(
            concrete_objects=primitives_dict.get('concrete_objects', []),
            living_things=primitives_dict.get('living_things', []),
            locations=primitives_dict.get('locations', []),
            tools=primitives_dict.get('tools', []),
            characters=[Character(**c) for c in primitives_dict.get('characters', [])],
            scenarios=primitives_dict.get('scenarios', []),
            comparison_pairs=[ComparisonPair(**p) for p in primitives_dict.get('comparison_pairs', [])],
            categories=[Category(**cat) for cat in primitives_dict.get('categories', [])],
            sequences=primitives_dict.get('sequences', []),
            action_words=primitives_dict.get('action_words', []),
            attributes=[Attribute(**a) for a in primitives_dict.get('attributes', [])]
        )

        foundations = FoundationsData(
            subskill_id=row['subskill_id'],
            version_id=row['version_id'],
            master_context=master_context,
            context_primitives=context_primitives,
            approved_visual_schemas=row.get('approved_visual_schemas', []),
            generation_status=row['generation_status'],
            is_draft=row['is_draft'],
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            last_edited_by=row.get('last_edited_by')
        )

        logger.info(f"✅ Found foundations for {subskill_id}")
        return foundations

    async def save_foundations(
        self,
        subskill_id: str,
        version_id: str,
        master_context: MasterContext,
        context_primitives: ContextPrimitives,
        approved_visual_schemas: list,
        user_id: Optional[str] = None
    ) -> FoundationsData:
        """
        Save user-edited foundations to database.
        Marks generation_status as 'edited'.
        """
        logger.info(f"💾 Saving foundations for subskill {subskill_id}, version {version_id}")

        now = datetime.utcnow()

        # Convert models to JSON-serializable dicts
        master_context_json = master_context.dict()
        context_primitives_json = context_primitives.dict()

        # Build the data row
        foundations_data = {
            "subskill_id": subskill_id,
            "version_id": version_id,
            "master_context": json.dumps(master_context_json),
            "context_primitives": json.dumps(context_primitives_json),
            "approved_visual_schemas": approved_visual_schemas,
            "generation_status": "edited",
            "is_draft": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_edited_by": user_id or "system"
        }

        table_id = settings.get_table_id(settings.TABLE_SUBSKILL_FOUNDATIONS)

        # Use MERGE for upsert
        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @subskill_id AS subskill_id_key, @version_id AS version_id_key) AS S
        ON T.subskill_id = S.subskill_id_key AND T.version_id = S.version_id_key
        WHEN MATCHED THEN
          UPDATE SET
            T.master_context = @master_context,
            T.context_primitives = @context_primitives,
            T.approved_visual_schemas = @approved_visual_schemas,
            T.generation_status = @generation_status,
            T.is_draft = @is_draft,
            T.updated_at = @updated_at,
            T.last_edited_by = @last_edited_by
        WHEN NOT MATCHED THEN
          INSERT (subskill_id, version_id, master_context, context_primitives, approved_visual_schemas,
                  generation_status, is_draft, created_at, updated_at, last_edited_by)
          VALUES (@subskill_id, @version_id, @master_context, @context_primitives, @approved_visual_schemas,
                  @generation_status, @is_draft, @created_at, @updated_at, @last_edited_by)
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("master_context", "JSON", master_context_json),
            bigquery.ScalarQueryParameter("context_primitives", "JSON", context_primitives_json),
            bigquery.ArrayQueryParameter("approved_visual_schemas", "STRING", approved_visual_schemas),
            bigquery.ScalarQueryParameter("generation_status", "STRING", "edited"),
            bigquery.ScalarQueryParameter("is_draft", "BOOL", True),
            bigquery.ScalarQueryParameter("created_at", "STRING", now.isoformat()),
            bigquery.ScalarQueryParameter("updated_at", "STRING", now.isoformat()),
            bigquery.ScalarQueryParameter("last_edited_by", "STRING", user_id or "system")
        ]

        await db.execute_query(merge_query, parameters)

        # Return the saved data
        foundations = FoundationsData(
            subskill_id=subskill_id,
            version_id=version_id,
            master_context=master_context,
            context_primitives=context_primitives,
            approved_visual_schemas=approved_visual_schemas,
            generation_status="edited",
            is_draft=True,
            created_at=now,
            updated_at=now,
            last_edited_by=user_id
        )

        logger.info(f"✅ Successfully saved foundations for {subskill_id}")
        return foundations

    async def delete_foundations(
        self,
        subskill_id: str,
        version_id: str
    ) -> bool:
        """Delete foundations for a subskill"""
        logger.info(f"🗑️ Deleting foundations for subskill {subskill_id}, version {version_id}")

        query = f"""
        DELETE FROM `{settings.get_table_id(settings.TABLE_SUBSKILL_FOUNDATIONS)}`
        WHERE subskill_id = @subskill_id
            AND version_id = @version_id
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
        ]

        try:
            await db.execute_query(query, parameters)
            logger.info(f"✅ Deleted foundations for {subskill_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete foundations for {subskill_id}: {e}")
            return False


# Global instance
foundations_service = FoundationsService()
