# backend/app/generators/context_primitives.py
import logging
from google.genai.types import GenerateContentConfig

from .base_generator import BaseContentGenerator
from .content import ContentGenerationRequest, MasterContext
from .content_schemas import CONTEXT_PRIMITIVES_SCHEMA

logger = logging.getLogger(__name__)


class ContextPrimitivesGenerator(BaseContentGenerator):
    """Generator for context primitives that provide variety for problem generation"""

    async def generate_context_primitives(self, request: ContentGenerationRequest, master_context: MasterContext) -> dict:
        """Generate context primitives based on skill and master context"""

        grade_info = self._extract_grade_info(request)

        # Build subject-specific requirements
        subject_requirements = self._get_subject_requirements(request.subject, request.subskill)

        # Format master context information for the prompt
        core_concepts_str = ', '.join(master_context.core_concepts)
        terminology_str = ', '.join(master_context.key_terminology.keys()) if master_context.key_terminology else 'None'
        applications_str = ', '.join(master_context.real_world_applications) if master_context.real_world_applications else 'None'

        prompt = f"""Generate comprehensive context primitives for creating diverse educational problems:

Subject: {request.subject}
Grade Level: {grade_info}
Unit: {request.unit}
Skill: {request.skill}
Subskill: {request.subskill}

MASTER CONTEXT FOUNDATION:
Core Concepts: {core_concepts_str}
Key Terminology: {terminology_str}
Real World Applications: {applications_str}

{subject_requirements}

Generate varied, age-appropriate context elements that will create problem diversity:

REQUIREMENTS:
- 15-20 concrete objects relevant to the subskill and grade level
- 8-12 living things (animals, plants, people) appropriate for {grade_info}
- 6-10 familiar locations/settings where this skill applies
- 5-8 tools/materials used in educational contexts
- 5-8 diverse characters with names, ages, and roles
- 8-12 realistic scenarios where this skill applies in daily life
- 3-5 comparison pairs with specific examples for each attribute
- 3-5 categories with 4-6 items each for sorting activities
- 2-4 sequences appropriate for the learning objective
- 8-12 action words relevant to the skill
- 4-6 attributes with multiple values each

CRITICAL REQUIREMENTS:
- All elements must be appropriate for {grade_info} cognitive development
- Content must be culturally diverse and inclusive
- Use familiar concepts that most students know
- Ensure educational appropriateness for school settings
- Connect directly to the core concepts: {core_concepts_str}
- Support the real-world applications: {applications_str}

SUBJECT-SPECIFIC FOCUS:
{subject_requirements}

Generate rich, varied primitives that will enable hundreds of unique problem combinations while maintaining educational value and age-appropriateness.
"""

        try:
            logger.info(f"Generating context primitives for {request.subject} subskill: {request.subskill}")

            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=CONTEXT_PRIMITIVES_SCHEMA,
                    temperature=0.7,  # Higher temperature for more variety
                    max_output_tokens=15000
                )
            )

            result = self._safe_json_loads(response.text, "Context primitives generation")
            logger.info(f"Successfully generated context primitives with {len(result.get('concrete_objects', []))} objects, {len(result.get('scenarios', []))} scenarios")

            return result

        except Exception as e:
            logger.error(f"Context primitives generation failed for {request.subskill}: {str(e)}")
            self._handle_generation_error("Context primitives generation", e)

    def _get_subject_requirements(self, subject: str, subskill: str) -> str:
        """Generate subject-specific requirements for context generation"""
        requirements = {
            "math": f"""
            MATH-SPECIFIC REQUIREMENTS for '{subskill}':
            - Focus on quantifiable, countable objects that can be manipulated
            - Include measurement contexts and tools (rulers, scales, containers)
            - Provide objects that can be grouped, compared, sorted, or counted
            - Include everyday math scenarios (shopping, cooking, playing games)
            - Use number-friendly contexts (toys, snacks, school supplies)
            - Ensure objects can be used for basic operations and comparisons
            - Include spatial concepts (shapes, positions, sizes) when relevant
            """,
            "science": f"""
            SCIENCE-SPECIFIC REQUIREMENTS for '{subskill}':
            - Include natural phenomena and observable processes
            - Focus on age-appropriate scientific concepts and vocabulary
            - Provide hands-on, experiential contexts children can observe
            - Include outdoor and indoor exploration settings
            - Use scientific tools appropriate for the grade level
            - Connect to everyday science experiences (weather, plants, animals)
            - Include simple cause-and-effect relationships
            """,
            "language_arts": f"""
            LANGUAGE ARTS-SPECIFIC REQUIREMENTS for '{subskill}':
            - Include rich vocabulary contexts and word relationships
            - Provide story-telling and communication scenarios
            - Focus on reading, writing, speaking, listening contexts
            - Include library, classroom, home reading scenarios
            - Use characters and situations that support language development
            - Include books, writing materials, and communication tools
            - Connect to familiar story structures and narrative elements
            """,
            "social_studies": f"""
            SOCIAL STUDIES-SPECIFIC REQUIREMENTS for '{subskill}':
            - Include community and cultural contexts
            - Provide historical and geographical elements appropriate for grade
            - Focus on family, school, community scenarios
            - Include diverse cultural perspectives and traditions
            - Use community helpers, locations, and civic concepts
            - Connect to social relationships and community interactions
            - Include maps, community buildings, and cultural artifacts
            """
        }

        return requirements.get(subject.lower(), f"""
        GENERAL REQUIREMENTS for {subject} '{subskill}':
        - Provide relevant educational contexts appropriate for the subject
        - Ensure all content connects to the specific subskill being taught
        - Use age-appropriate vocabulary and concepts for {subject}
        - Include tools, materials, and settings relevant to {subject} learning
        """)