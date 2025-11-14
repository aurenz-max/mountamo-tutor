"""
Content Service - Manages reading content and visual snippet generation and storage
"""

import logging
import json
from typing import Optional, List
from datetime import datetime
from google.cloud import bigquery

from app.core.config import settings
from app.core.database import db
from app.models.content import (
    ReadingContentPackage,
    ReadingSection,
    VisualSnippet,
    UpdateSectionRequest
)
from app.models.foundations import MasterContext, ContextPrimitives
from app.generators.reading_content import ReadingContentGenerator
from app.generators.visual_content import VisualContentGenerator
from app.services.curriculum_manager import curriculum_manager
from app.services.foundations_service import foundations_service

logger = logging.getLogger(__name__)


class ContentService:
    """Manages reading content and visual snippet generation and storage"""

    def __init__(self):
        self.reading_generator = ReadingContentGenerator()
        self.visual_generator = VisualContentGenerator()

    async def generate_reading_content(
        self,
        subskill_id: str,
        version_id: str,
        use_foundations: bool = True
    ) -> ReadingContentPackage:
        """
        Generate complete reading content for a subskill.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            use_foundations: Whether to use saved foundations for generation

        Returns:
            ReadingContentPackage with all sections
        """
        logger.info(f"📖 Generating reading content for {subskill_id}")

        # Get subskill details
        subskill = await curriculum_manager.get_subskill(subskill_id)
        if not subskill:
            raise ValueError(f"Subskill {subskill_id} not found")

        # Get parent entities
        skill = await curriculum_manager.get_skill(subskill.skill_id)
        unit = await curriculum_manager.get_unit(skill.unit_id) if skill else None
        subject = await curriculum_manager.get_subject(unit.subject_id) if unit else None

        if not (skill and unit and subject):
            raise ValueError(f"Could not resolve full curriculum hierarchy for subskill {subskill_id}")

        # Get or generate foundations
        if use_foundations:
            foundations = await foundations_service.get_foundations(subskill_id, version_id)
            if not foundations:
                logger.info("No foundations found, generating new ones...")
                foundations = await foundations_service.generate_foundations(subskill_id, version_id)
        else:
            # Generate fresh foundations without saving
            foundations = await foundations_service.generate_foundations(subskill_id, version_id)

        # Generate reading content with 3-tier architecture
        package = await self.reading_generator.generate_reading_content(
            subskill_id=subskill_id,
            version_id=version_id,
            subskill_description=subskill.subskill_description,
            subject=subject.subject_name,
            grade_level=subject.grade_level or "Kindergarten",
            master_context=foundations.master_context,
            context_primitives=foundations.context_primitives,  # Pass primitives for concrete examples
            unit=unit.unit_title if unit else None,
            skill=skill.skill_description if skill else None
        )

        # Save to BigQuery
        await self._save_reading_content_to_bigquery(package)

        logger.info(f"✅ Successfully generated and saved reading content for {subskill_id}")
        return package

    async def get_reading_content(
        self,
        subskill_id: str,
        version_id: str
    ) -> Optional[ReadingContentPackage]:
        """
        Retrieve reading content for a subskill from BigQuery.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier

        Returns:
            ReadingContentPackage if found, None otherwise
        """
        logger.info(f"🔍 Retrieving reading content for {subskill_id}")

        # Query sections from BigQuery
        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_READING_CONTENT)}`
        WHERE subskill_id = @subskill_id
            AND version_id = @version_id
        ORDER BY section_order ASC
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
        ]

        try:
            results = await db.execute_query(query, parameters)

            if not results:
                logger.info(f"No reading content found for {subskill_id}")
                return None

            # Reconstruct package from sections
            sections = []
            title = results[0].get('title', 'Reading Content')

            for row in results:
                section = ReadingSection(
                    section_id=row['section_id'],
                    section_order=row['section_order'],
                    heading=row['heading'],
                    content_text=row['content_text'],
                    key_terms=row.get('key_terms', []),
                    concepts_covered=row.get('concepts_covered', []),
                    interactive_primitives=row.get('interactive_primitives', []),
                    has_visual_snippet=row.get('has_visual_snippet', False),
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                )
                sections.append(section)

            package = ReadingContentPackage(
                subskill_id=subskill_id,
                version_id=version_id,
                title=title,
                sections=sections,
                generation_status=results[0].get('generation_status', 'generated'),
                is_draft=results[0].get('is_draft', True),
                created_at=results[0]['created_at'],
                updated_at=results[0]['updated_at'],
                last_edited_by=results[0].get('last_edited_by')
            )

            logger.info(f"✅ Found {len(sections)} sections for {subskill_id}")
            return package

        except Exception as e:
            logger.error(f"Error retrieving reading content: {str(e)}")
            raise

    async def regenerate_section(
        self,
        subskill_id: str,
        version_id: str,
        section_id: str,
        custom_prompt: Optional[str] = None
    ) -> ReadingSection:
        """
        Regenerate a specific section of reading content.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            section_id: Section to regenerate
            custom_prompt: Optional custom instructions

        Returns:
            Updated ReadingSection
        """
        logger.info(f"🔄 Regenerating section {section_id}")

        # Get existing package
        package = await self.get_reading_content(subskill_id, version_id)
        if not package:
            raise ValueError(f"No reading content found for {subskill_id}")

        # Find the section
        section = next((s for s in package.sections if s.section_id == section_id), None)
        if not section:
            raise ValueError(f"Section {section_id} not found")

        # Get foundations for context
        foundations = await foundations_service.get_foundations(subskill_id, version_id)
        if not foundations:
            raise ValueError(f"No foundations found for {subskill_id}")

        # Get grade level
        subskill = await curriculum_manager.get_subskill(subskill_id)
        skill = await curriculum_manager.get_skill(subskill.skill_id)
        unit = await curriculum_manager.get_unit(skill.unit_id)
        subject = await curriculum_manager.get_subject(unit.subject_id)

        # Regenerate the section
        updated_section = await self.reading_generator.regenerate_section(
            section=section,
            master_context=foundations.master_context,
            grade_level=subject.grade_level or "Kindergarten",
            custom_prompt=custom_prompt
        )

        # Update in BigQuery
        await self._update_section_in_bigquery(subskill_id, version_id, updated_section)

        logger.info(f"✅ Successfully regenerated section {section_id}")
        return updated_section

    async def update_section(
        self,
        subskill_id: str,
        version_id: str,
        section_id: str,
        updates: UpdateSectionRequest
    ) -> ReadingSection:
        """
        Update a section with manual edits.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            section_id: Section to update
            updates: Fields to update

        Returns:
            Updated ReadingSection
        """
        logger.info(f"✏️ Updating section {section_id}")

        # Get existing section
        package = await self.get_reading_content(subskill_id, version_id)
        if not package:
            raise ValueError(f"No reading content found for {subskill_id}")

        section = next((s for s in package.sections if s.section_id == section_id), None)
        if not section:
            raise ValueError(f"Section {section_id} not found")

        # Apply updates
        update_dict = updates.dict(exclude_unset=True)
        updated_section = section.copy(update={**update_dict, 'updated_at': datetime.utcnow()})

        # Save to BigQuery
        await self._update_section_in_bigquery(subskill_id, version_id, updated_section)

        logger.info(f"✅ Successfully updated section {section_id}")
        return updated_section

    async def delete_reading_content(
        self,
        subskill_id: str,
        version_id: str,
        cascade_delete_visuals: bool = True
    ) -> bool:
        """
        Delete all reading content for a subskill.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            cascade_delete_visuals: If True, also delete associated visual snippets

        Returns:
            True if successful, raises exception otherwise
        """
        logger.info(f"🗑️ Deleting reading content for {subskill_id}")

        try:
            # Delete reading content sections
            content_table_id = settings.get_table_id(settings.TABLE_READING_CONTENT)
            delete_content_query = f"""
            DELETE FROM `{content_table_id}`
            WHERE subskill_id = @subskill_id AND version_id = @version_id
            """

            delete_params = [
                bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
                bigquery.ScalarQueryParameter("version_id", "STRING", version_id)
            ]

            await db.execute_query(delete_content_query, delete_params)
            logger.info(f"✅ Deleted reading content sections for {subskill_id}")

            # Optionally cascade delete visual snippets
            if cascade_delete_visuals:
                visual_table_id = settings.get_table_id(settings.TABLE_VISUAL_SNIPPETS)
                delete_visuals_query = f"""
                DELETE FROM `{visual_table_id}`
                WHERE subskill_id = @subskill_id
                """

                visual_params = [
                    bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)
                ]

                await db.execute_query(delete_visuals_query, visual_params)
                logger.info(f"✅ Deleted associated visual snippets for {subskill_id}")

            logger.info(f"✅ Successfully deleted all reading content for {subskill_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Error deleting reading content: {str(e)}")
            raise

    async def generate_visual_snippet(
        self,
        subskill_id: str,
        section_id: str,
        section_heading: str,
        section_content: str,
        custom_prompt: Optional[str] = None
    ) -> VisualSnippet:
        """
        Generate an interactive HTML visual snippet for a section.

        Args:
            subskill_id: Subskill identifier
            section_id: Section identifier
            section_heading: Section heading
            section_content: Section content text
            custom_prompt: Optional custom instructions

        Returns:
            VisualSnippet with HTML content
        """
        logger.info(f"🎨 Generating visual snippet for section {section_id}")

        # Generate the visual snippet
        snippet = await self.visual_generator.generate_visual_snippet(
            subskill_id=subskill_id,
            section_id=section_id,
            section_heading=section_heading,
            section_content=section_content,
            custom_prompt=custom_prompt
        )

        # Save to BigQuery
        await self._save_visual_snippet_to_bigquery(snippet)

        # Update section to mark it has visual
        # (This will be done via a separate update_section call)

        logger.info(f"✅ Successfully generated visual snippet for section {section_id}")
        return snippet

    async def get_visual_snippet(
        self,
        subskill_id: str,
        section_id: str
    ) -> Optional[VisualSnippet]:
        """
        Retrieve a visual snippet from BigQuery.

        Args:
            subskill_id: Subskill identifier
            section_id: Section identifier

        Returns:
            VisualSnippet if found, None otherwise
        """
        logger.info(f"🔍 Retrieving visual snippet for section {section_id}")

        query = f"""
        SELECT *
        FROM `{settings.get_table_id(settings.TABLE_VISUAL_SNIPPETS)}`
        WHERE subskill_id = @subskill_id
            AND section_id = @section_id
        ORDER BY created_at DESC
        LIMIT 1
        """

        parameters = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("section_id", "STRING", section_id)
        ]

        try:
            results = await db.execute_query(query, parameters)

            if not results:
                logger.info(f"No visual snippet found for section {section_id}")
                return None

            row = results[0]
            snippet = VisualSnippet(
                snippet_id=row['snippet_id'],
                subskill_id=row['subskill_id'],
                section_id=row['section_id'],
                html_content=row['html_content'],
                generation_prompt=row.get('generation_prompt'),
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                last_edited_by=row.get('last_edited_by')
            )

            logger.info(f"✅ Found visual snippet for section {section_id}")
            return snippet

        except Exception as e:
            logger.error(f"Error retrieving visual snippet: {str(e)}")
            raise

    # Private helper methods for BigQuery operations

    async def _save_reading_content_to_bigquery(self, package: ReadingContentPackage):
        """Save reading content package to BigQuery"""
        logger.info(f"💾 Saving reading content to BigQuery for {package.subskill_id}")

        table_id = settings.get_table_id(settings.TABLE_READING_CONTENT)

        # Delete existing sections for this subskill/version
        delete_query = f"""
        DELETE FROM `{table_id}`
        WHERE subskill_id = @subskill_id AND version_id = @version_id
        """

        delete_params = [
            bigquery.ScalarQueryParameter("subskill_id", "STRING", package.subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", package.version_id)
        ]

        await db.execute_query(delete_query, delete_params)

        # Insert new sections
        for section in package.sections:
            insert_query = f"""
            INSERT INTO `{table_id}`
            (subskill_id, version_id, section_id, section_order, title, heading, content_text,
             key_terms, concepts_covered, interactive_primitives, has_visual_snippet,
             generation_status, is_draft, created_at, updated_at)
            VALUES
            (@subskill_id, @version_id, @section_id, @section_order, @title, @heading, @content_text,
             @key_terms, @concepts_covered, @interactive_primitives, @has_visual_snippet,
             @generation_status, @is_draft, @created_at, @updated_at)
            """

            insert_params = [
                bigquery.ScalarQueryParameter("subskill_id", "STRING", package.subskill_id),
                bigquery.ScalarQueryParameter("version_id", "STRING", package.version_id),
                bigquery.ScalarQueryParameter("section_id", "STRING", section.section_id),
                bigquery.ScalarQueryParameter("section_order", "INT64", section.section_order),
                bigquery.ScalarQueryParameter("title", "STRING", package.title),
                bigquery.ScalarQueryParameter("heading", "STRING", section.heading),
                bigquery.ScalarQueryParameter("content_text", "STRING", section.content_text),
                bigquery.ArrayQueryParameter("key_terms", "STRING", section.key_terms),
                bigquery.ArrayQueryParameter("concepts_covered", "STRING", section.concepts_covered),
                bigquery.ScalarQueryParameter("interactive_primitives", "JSON", section.interactive_primitives),
                bigquery.ScalarQueryParameter("has_visual_snippet", "BOOL", section.has_visual_snippet),
                bigquery.ScalarQueryParameter("generation_status", "STRING", package.generation_status),
                bigquery.ScalarQueryParameter("is_draft", "BOOL", package.is_draft),
                bigquery.ScalarQueryParameter("created_at", "TIMESTAMP", section.created_at),
                bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", section.updated_at)
            ]

            await db.execute_query(insert_query, insert_params)

        logger.info(f"✅ Saved {len(package.sections)} sections to BigQuery")

    async def _update_section_in_bigquery(self, subskill_id: str, version_id: str, section: ReadingSection):
        """Update a single section in BigQuery"""
        logger.info(f"💾 Updating section {section.section_id} in BigQuery")

        table_id = settings.get_table_id(settings.TABLE_READING_CONTENT)

        update_query = f"""
        UPDATE `{table_id}`
        SET
            heading = @heading,
            content_text = @content_text,
            key_terms = @key_terms,
            concepts_covered = @concepts_covered,
            interactive_primitives = @interactive_primitives,
            has_visual_snippet = @has_visual_snippet,
            updated_at = @updated_at
        WHERE subskill_id = @subskill_id
            AND version_id = @version_id
            AND section_id = @section_id
        """

        parameters = [
            bigquery.ScalarQueryParameter("heading", "STRING", section.heading),
            bigquery.ScalarQueryParameter("content_text", "STRING", section.content_text),
            bigquery.ArrayQueryParameter("key_terms", "STRING", section.key_terms),
            bigquery.ArrayQueryParameter("concepts_covered", "STRING", section.concepts_covered),
            bigquery.ScalarQueryParameter("interactive_primitives", "JSON", section.interactive_primitives),
            bigquery.ScalarQueryParameter("has_visual_snippet", "BOOL", section.has_visual_snippet),
            bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", section.updated_at),
            bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id),
            bigquery.ScalarQueryParameter("version_id", "STRING", version_id),
            bigquery.ScalarQueryParameter("section_id", "STRING", section.section_id)
        ]

        await db.execute_query(update_query, parameters)
        logger.info(f"✅ Updated section in BigQuery")

    async def _save_visual_snippet_to_bigquery(self, snippet: VisualSnippet):
        """Save visual snippet to BigQuery"""
        logger.info(f"💾 Saving visual snippet to BigQuery for section {snippet.section_id}")

        table_id = settings.get_table_id(settings.TABLE_VISUAL_SNIPPETS)

        # Use MERGE for upsert
        merge_query = f"""
        MERGE `{table_id}` AS T
        USING (SELECT @subskill_id AS subskill_id_key, @section_id AS section_id_key) AS S
        ON T.subskill_id = S.subskill_id_key AND T.section_id = S.section_id_key
        WHEN MATCHED THEN
          UPDATE SET
            T.html_content = @html_content,
            T.generation_prompt = @generation_prompt,
            T.updated_at = @updated_at
        WHEN NOT MATCHED THEN
          INSERT (snippet_id, subskill_id, section_id, html_content, generation_prompt, created_at, updated_at)
          VALUES (@snippet_id, @subskill_id, @section_id, @html_content, @generation_prompt, @created_at, @updated_at)
        """

        parameters = [
            bigquery.ScalarQueryParameter("snippet_id", "STRING", snippet.snippet_id),
            bigquery.ScalarQueryParameter("subskill_id", "STRING", snippet.subskill_id),
            bigquery.ScalarQueryParameter("section_id", "STRING", snippet.section_id),
            bigquery.ScalarQueryParameter("html_content", "STRING", snippet.html_content),
            bigquery.ScalarQueryParameter("generation_prompt", "STRING", snippet.generation_prompt or ""),
            bigquery.ScalarQueryParameter("created_at", "TIMESTAMP", snippet.created_at),
            bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", snippet.updated_at)
        ]

        await db.execute_query(merge_query, parameters)
        logger.info(f"✅ Saved visual snippet to BigQuery")


# Global instance
content_service = ContentService()
