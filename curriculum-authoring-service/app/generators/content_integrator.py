"""
Tier 3: Content Integrator
Validates objective coverage, adds transitions, and assembles final reading content package.
"""

import json
import logging
from typing import List, Dict, Any
from datetime import datetime
import uuid

from google import genai
from google.genai.types import GenerateContentConfig

from app.models.content import ReadingContentPackage, ReadingSection
from app.models.section_types import SectionType, validate_section_word_count, get_section_spec
from app.schemas.interactive_primitives import get_all_primitive_schemas

logger = logging.getLogger(__name__)


class ContentIntegrator:
    """Validates and integrates sections into cohesive reading content"""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def integrate_and_validate(
        self,
        subskill_id: str,
        version_id: str,
        subskill_description: str,
        learning_objectives: List[str],
        section_data_list: List[Dict[str, Any]],
        overall_narrative: str,
        grade_level: str,
        section_types: List[SectionType] = None
    ) -> Dict[str, Any]:
        """
        Validate that all learning objectives are taught, section types meet quality criteria, and integrate sections.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            subskill_description: Description of the subskill
            learning_objectives: The objectives that must be taught
            section_data_list: List of generated section dictionaries
            overall_narrative: The planned narrative arc
            grade_level: Target grade level
            section_types: List of section types (optional, for validation)

        Returns:
            Dictionary with final content (title, sections with transitions)
        """
        logger.info(f"🔍 Validating objective coverage and section quality for {subskill_id}")

        # Validate section word counts against section type specifications
        if section_types:
            self._validate_section_quality(section_data_list, section_types)

        # Format sections for review
        sections_summary = self._format_sections_summary(section_data_list)
        objectives_str = '\n'.join(f"  {i+1}. {obj}" for i, obj in enumerate(learning_objectives))

        prompt = f"""You are reviewing reading content for {grade_level} students learning {subskill_description}.

LEARNING OBJECTIVES (all must be explicitly taught):
{objectives_str}

GENERATED SECTIONS:
{sections_summary}

YOUR TASKS:

1. **VALIDATE OBJECTIVE COVERAGE**:
   Review each section and verify that EVERY learning objective is explicitly taught.
   - Does the content provide clear instruction on how to perform the objective?
   - Are there concrete examples that demonstrate the objective?
   - Do students get opportunities to practice the objective?

2. **ADD SMOOTH TRANSITIONS**:
   Enhance the content text of each section to include:
   - Opening connection to prior section (except Section 1)
   - Closing preview of next section (except final section)
   Keep transitions brief (1-2 sentences at start/end)

3. **CREATE ENGAGING TITLE**:
   Generate a title that captures the essence of all learning objectives
   Format: "{subskill_description}: [Engaging Subtitle]"
   Make it exciting and age-appropriate for {grade_level}

4. **ENSURE NARRATIVE FLOW**:
   The sections should follow this arc: {overall_narrative}
   Adjust content slightly if needed to maintain this flow

VALIDATION CRITERIA:
✓ Every objective explicitly taught with clear instructions
✓ Concrete examples provided for each objective
✓ Practice opportunities included
✓ Smooth transitions between sections
✓ Appropriate {grade_level} language throughout
✓ Engaging, cohesive narrative

CRITICAL: If any objective is NOT adequately taught, add a brief note in the content to address it.

Return the complete content with:
- title: Engaging title for the reading content
- sections: All sections with transitions added (same structure, enhanced content_text)
- validation_notes: Brief notes on objective coverage (for logging, not shown to students)
"""

        schema = self._get_integration_schema()

        response = await self.client.aio.models.generate_content(
            model='gemini-flash-lite-latest',  # Use better model for validation
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=schema,
                temperature=0.3,  # Lower temperature for validation accuracy
            )
        )

        # Parse response
        integrated_data = json.loads(response.text)

        # Log validation results
        if 'validation_notes' in integrated_data:
            logger.info(f"📋 Validation notes: {integrated_data['validation_notes']}")

        # Check if any objectives were flagged as missing
        validation_text = integrated_data.get('validation_notes', '').lower()
        if 'not taught' in validation_text or 'missing' in validation_text or 'inadequate' in validation_text:
            logger.warning(f"⚠️ Potential objective coverage gaps: {integrated_data['validation_notes']}")
        else:
            logger.info(f"✅ All objectives validated as taught")

        return integrated_data

    def _format_sections_summary(self, sections: List[Dict[str, Any]]) -> str:
        """Format sections for validation prompt"""
        lines = []
        for i, section in enumerate(sections, 1):
            lines.append(f"\n=== Section {i}: {section.get('heading', 'Untitled')} ===")
            lines.append(f"Content: {section.get('content', '')[:200]}...")  # First 200 chars
            lines.append(f"Key Terms: {', '.join(section.get('key_terms_used', []))}")
            lines.append(f"Concepts: {', '.join(section.get('concepts_covered', []))}")

            # Count interactive elements
            interactive_count = sum(
                len(section.get(key, []))
                for key in ['alerts', 'definitions', 'quizzes', 'expandables', 'checklists',
                           'tables', 'keyvalues', 'fill_in_the_blanks', 'scenario_questions']
            )
            lines.append(f"Interactive Elements: {interactive_count}")

        return '\n'.join(lines)

    def _get_integration_schema(self) -> dict:
        """Get JSON schema for integration response"""
        # Get all interactive primitive schemas from shared module
        primitive_schemas = get_all_primitive_schemas()

        # Build section properties with proper schemas for all primitives
        section_properties = {
            "heading": {"type": "string"},
            "content": {
                "type": "string",
                "description": "Enhanced content with transitions added"
            },
            "key_terms_used": {
                "type": "array",
                "items": {"type": "string"}
            },
            "concepts_covered": {
                "type": "array",
                "items": {"type": "string"}
            }
        }

        # Add all primitive schemas (no longer empty objects!)
        section_properties.update(primitive_schemas)

        return {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Engaging title for the reading content"
                },
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": section_properties,
                        "required": ["heading", "content", "key_terms_used", "concepts_covered"]
                    },
                    "description": "All sections with transitions and enhancements"
                },
                "validation_notes": {
                    "type": "string",
                    "description": "Notes on objective coverage and any gaps identified"
                }
            },
            "required": ["title", "sections", "validation_notes"]
        }

    def _validate_section_quality(self, sections: List[Dict[str, Any]], section_types: List[SectionType]) -> None:
        """
        Validate that each section meets its section type quality criteria.

        Args:
            sections: List of generated section dictionaries
            section_types: List of section types corresponding to each section

        Logs warnings for sections that don't meet quality criteria.
        """
        logger.info("🔍 Validating section quality against type specifications...")

        for idx, (section, section_type) in enumerate(zip(sections, section_types), 1):
            section_content = section.get('content', '')
            word_count = len(section_content.split())

            # Validate word count
            is_valid, message = validate_section_word_count(section_type, word_count)
            if not is_valid:
                logger.warning(f"⚠️ Section {idx} ({section_type.value}): {message}")
            else:
                logger.info(f"✅ Section {idx} ({section_type.value}): {message}")

            # Get section spec for additional validation
            spec = get_section_spec(section_type)

            # Log recommended vs. actual primitive usage
            # This could be enhanced to validate that recommended primitives are present
            logger.info(f"📋 Section {idx} recommended primitives: {', '.join(spec.recommended_primitives)}")
