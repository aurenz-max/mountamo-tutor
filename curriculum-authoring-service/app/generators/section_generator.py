"""
Tier 2: Section Generator
Generates individual reading sections focused on specific learning objectives.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from google import genai
from google.genai.types import GenerateContentConfig

from app.models.content import ReadingSection
from app.models.section_types import SectionType
from app.prompts.section_templates import get_section_prompt
from app.schemas.interactive_primitives import get_all_primitive_schemas

logger = logging.getLogger(__name__)


class SectionGenerator:
    """Generates focused reading sections that explicitly teach specific learning objectives"""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    async def generate_section(
        self,
        section_number: int,
        section_type: SectionType,
        primary_objective: str,
        teaching_strategy: str,
        key_concepts: List[str],
        key_terminology: Dict[str, str],
        recommended_primitives: Dict[str, List[str]],
        selected_primitive_schemas: List[str],
        grade_level: str,
        subskill_description: str,
        subject: Optional[str] = None,
        unit: Optional[str] = None,
        skill: Optional[str] = None,
        prior_sections_context: Optional[str] = None,
        related_concepts: Optional[List[str]] = None,
        future_topics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate a single reading section using section-type-specific prompts.

        Args:
            section_number: Order of this section (1-6)
            section_type: Meta section type (e.g., intuitive_explanation, worked_examples)
            primary_objective: The specific learning objective this section teaches
            teaching_strategy: How to teach (e.g., "explicit instruction", "guided practice")
            key_concepts: Core concepts to cover from master context
            key_terminology: Key terms with definitions
            recommended_primitives: Specific examples to use (characters, objects, scenarios)
            selected_primitive_schemas: List of primitive schema types to include
            grade_level: Target grade level
            subskill_description: Description of the subskill
            subject: Subject area (optional)
            unit: Unit within subject (optional)
            skill: Skill within unit (optional)
            prior_sections_context: Optional summary of what was taught in prior sections
            related_concepts: Related concepts at same level (optional)
            future_topics: Future topics this builds toward (optional)

        Returns:
            Dictionary with section data (heading, content, primitives, etc.)
        """
        logger.info(f"📝 Generating section {section_number} ({section_type.value}) for objective: {primary_objective}")

        # Use section-type-specific prompt
        prompt = get_section_prompt(
            section_type=section_type,
            primary_objective=primary_objective,
            key_concepts=key_concepts,
            key_terminology=key_terminology,
            grade_level=grade_level,
            subject=subject,
            unit=unit,
            skill=skill,
            subskill_description=subskill_description,
            context_primitives=recommended_primitives,
            prior_sections_summary=prior_sections_context,
            related_concepts=related_concepts,
            future_topics=future_topics
        )

        # Get schema with ONLY selected primitive types
        schema = self._get_section_schema(selected_primitive_schemas)

        response = await self.client.aio.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=schema,
                temperature=0.4,
            )
        )

        # Parse response
        section_data = json.loads(response.text)
        logger.info(f"✅ Section {section_number} generated: {section_data['heading']}")

        return section_data

    def _format_primitives(self, primitives: Dict[str, List[str]]) -> str:
        """Format recommended primitives for the prompt"""
        lines = []
        for key, values in primitives.items():
            if values:
                formatted_key = key.replace('_', ' ').title()
                lines.append(f"  • {formatted_key}: {', '.join(values)}")
        return '\n'.join(lines) if lines else "  (Use general examples appropriate for the skill)"

    def _format_terminology(self, terminology: Dict[str, str]) -> str:
        """Format terminology dictionary"""
        return '\n'.join(f"  • {term}: {defn}" for term, defn in terminology.items())

    def _get_section_schema(self, selected_primitive_types: List[str]) -> dict:
        """
        Get JSON schema for section generation with ONLY selected primitive types.

        Args:
            selected_primitive_types: List of primitive schema names to include
                (e.g., ['quizzes', 'definitions', 'flip_cards'])

        Returns:
            JSON schema dictionary with filtered primitives
        """
        # Get all interactive primitive schemas from shared module
        all_primitive_schemas = get_all_primitive_schemas()

        # Build section properties
        section_properties = {
            "heading": {
                "type": "string",
                "description": "Clear, engaging section heading"
            },
            "content": {
                "type": "string",
                "description": "Main section content following section type guidelines"
            },
            "key_terms_used": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Key terms from terminology used in this section"
            },
            "concepts_covered": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Core concepts covered in this section"
            }
        }

        # Add ONLY the selected primitive schemas
        if selected_primitive_types:
            for primitive_type in selected_primitive_types:
                # Convert from kebab-case to snake_case for schema lookup
                schema_key = primitive_type.replace('-', '_')
                if schema_key in all_primitive_schemas:
                    section_properties[schema_key] = all_primitive_schemas[schema_key]
                else:
                    logger.warning(f"Primitive type '{primitive_type}' not found in available schemas")

        logger.info(f"Schema includes {len(selected_primitive_types)} selected primitive types")

        return {
            "type": "object",
            "properties": section_properties,
            "required": ["heading", "content", "key_terms_used", "concepts_covered"]
        }
