"""
Master Context Generator - Creates foundational learning context
"""

import logging
from google.genai.types import GenerateContentConfig

from .base_generator import BaseContentGenerator
from .content_schemas import MASTER_CONTEXT_SCHEMA
from app.models.foundations import MasterContext

logger = logging.getLogger(__name__)


class MasterContextGenerator(BaseContentGenerator):
    """Generator for master context that provides foundation for all content"""

    async def generate_master_context(self, subskill_data: dict) -> MasterContext:
        """
        Generate foundational context for a subskill

        Args:
            subskill_data: Dictionary containing:
                - subject: Subject name
                - grade_level: Grade level
                - unit: Unit title
                - skill: Skill description
                - subskill: Subskill description
                - difficulty_level: Optional difficulty level
                - prerequisites: Optional list of prerequisites

        Returns:
            MasterContext instance with generated foundational content
        """

        grade_info = self._extract_grade_info(subskill_data)
        subject = subskill_data.get('subject', 'General')
        unit = subskill_data.get('unit', '')
        skill = subskill_data.get('skill', '')
        subskill = subskill_data.get('subskill', '')
        difficulty = subskill_data.get('difficulty_level', 'intermediate')
        prerequisites = subskill_data.get('prerequisites', [])

        prerequisites_str = ', '.join(prerequisites) if prerequisites else 'None'

        prompt = f"""
        Create a comprehensive educational foundation for teaching this topic:

        Subject: {subject}
        Grade Level: {grade_info}
        Unit: {unit}
        Skill: {skill}
        Subskill: {subskill}
        Difficulty: {difficulty}
        Prerequisites: {prerequisites_str}

        Requirements for {grade_info} students:
        - 4-6 core concepts appropriate for {grade_info} cognitive development
        - 5-8 key terms with definitions suitable for {grade_info} vocabulary level
        - 4-6 specific, measurable learning objectives aligned with {grade_info} standards
        - 3-5 real-world applications that {grade_info} students can relate to
        - Language complexity and examples appropriate for {grade_info}

        This will be the foundation for generating reading content, visual demos, and practice problems.
        Ensure all content is age-appropriate, engaging, and educationally sound for {grade_info} learners.
        """

        try:
            logger.info(f"🎯 Generating master context for {subject} subskill: {subskill}")

            response = await self.client.aio.models.generate_content(
                model='gemini-flash-lite-latest',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=MASTER_CONTEXT_SCHEMA,
                    temperature=0.3,
                    max_output_tokens=25000
                )
            )

            context_data = self._safe_json_loads(response.text, "Master context generation")

            # Convert array of term-definition objects back to dictionary
            key_terminology_dict = {}
            if 'key_terminology' in context_data:
                for term_obj in context_data['key_terminology']:
                    if 'term' in term_obj and 'definition' in term_obj:
                        key_terminology_dict[term_obj['term']] = term_obj['definition']

            master_context = MasterContext(
                core_concepts=context_data['core_concepts'],
                key_terminology=key_terminology_dict,
                learning_objectives=context_data['learning_objectives'],
                difficulty_level=context_data.get('difficulty_level', difficulty),
                grade_level=context_data.get('grade_level', grade_info),
                prerequisites=context_data.get('prerequisites', prerequisites),
                real_world_applications=context_data['real_world_applications']
            )

            logger.info(f"✅ Successfully generated master context with {len(master_context.core_concepts)} concepts")
            return master_context

        except Exception as e:
            self._handle_generation_error("Master context generation", e)
