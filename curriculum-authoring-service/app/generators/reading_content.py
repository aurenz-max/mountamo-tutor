"""
Reading Content Generator - Generates structured reading content with interactive primitives
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from google import genai
from google.genai.types import GenerateContentConfig, Schema

from app.core.config import settings
from app.models.foundations import MasterContext, ContextPrimitives
from app.models.content import ReadingContentPackage, ReadingSection
from app.generators.learning_plan import LearningPlanGenerator, TeachingPlan
from app.generators.section_generator import SectionGenerator
from app.generators.content_integrator import ContentIntegrator
from app.schemas.interactive_primitives import get_primitive_schemas_as_genai_schema

logger = logging.getLogger(__name__)


# Define the reading content schema for Gemini
def get_reading_content_schema() -> Schema:
    """Get the schema for reading content generation with all interactive primitive types"""
    # Get all primitive schemas from shared module
    primitive_schemas = get_primitive_schemas_as_genai_schema()

    # Build section properties
    section_properties = {
        "heading": Schema(type="string", description="Section heading"),
        "content": Schema(type="string", description="Section content text"),
        "key_terms_used": Schema(
            type="array",
            items=Schema(type="string"),
            description="Key terms used in this section"
        ),
        "concepts_covered": Schema(
            type="array",
            items=Schema(type="string"),
            description="Core concepts covered in this section"
        )
    }

    # Add all interactive primitive schemas (no duplication!)
    section_properties.update(primitive_schemas)

    return Schema(
        type="object",
        properties={
            "title": Schema(type="string", description="Title for the reading content"),
            "sections": Schema(
                type="array",
                items=Schema(
                    type="object",
                    properties=section_properties,
                    required=["heading", "content", "key_terms_used", "concepts_covered"]
                ),
                description="Array of content sections"
            )
        },
        required=["title", "sections"]
    )


class ReadingContentGenerator:
    """Generator for structured reading content using 3-tier architecture"""

    def __init__(self):
        self.client = None
        self._initialize_gemini()
        self._initialize_tier_generators()

    def _initialize_gemini(self):
        """Initialize Gemini client (for legacy single-call method)"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini client initialized for ReadingContentGenerator")

    def _initialize_tier_generators(self):
        """Initialize the 3-tier generators"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")

        self.learning_plan_generator = LearningPlanGenerator(api_key=settings.GEMINI_API_KEY)
        self.section_generator = SectionGenerator(api_key=settings.GEMINI_API_KEY)
        self.content_integrator = ContentIntegrator(api_key=settings.GEMINI_API_KEY)
        logger.info("3-tier content generation architecture initialized")

    def _format_terminology_string(self, key_terminology: Dict[str, str]) -> str:
        """Format terminology dictionary into readable string"""
        return "\n".join([f"- {term}: {defn}" for term, defn in key_terminology.items()])

    async def generate_reading_content(
        self,
        subskill_id: str,
        version_id: str,
        subskill_description: str,
        subject: str,
        grade_level: str,
        master_context: MasterContext,
        context_primitives: Optional[ContextPrimitives] = None
    ) -> ReadingContentPackage:
        """
        Generate structured reading content using 3-tier architecture.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            subskill_description: Description of the subskill
            subject: Subject area
            grade_level: Target grade level
            master_context: Master context with concepts, terminology, etc.
            context_primitives: Context primitives for concrete examples (optional)

        Returns:
            ReadingContentPackage with generated sections that explicitly teach learning objectives
        """
        logger.info(f"📖 Generating reading content for {subskill_id} using 3-tier architecture")

        # If no context primitives provided, use empty dict
        if context_primitives is None:
            logger.warning(f"No context primitives provided for {subskill_id}, using empty primitives")
            primitives_dict = {}
        else:
            # Convert ContextPrimitives to dict for generators
            primitives_dict = context_primitives.model_dump() if hasattr(context_primitives, 'model_dump') else context_primitives.dict()

        try:
            # ==================================================================
            # TIER 1: Generate Teaching Plan
            # ==================================================================
            logger.info("🎯 TIER 1: Generating teaching plan...")
            teaching_plan = await self.learning_plan_generator.generate_teaching_plan(
                learning_objectives=master_context.learning_objectives,
                core_concepts=master_context.core_concepts,
                key_terminology=master_context.key_terminology,
                context_primitives=primitives_dict,
                grade_level=grade_level,
                subskill_description=subskill_description
            )
            logger.info(f"✅ Teaching plan created with {len(teaching_plan.section_plans)} sections")

            # ==================================================================
            # TIER 2: Generate Sections Sequentially
            # ==================================================================
            logger.info("📝 TIER 2: Generating sections...")
            section_data_list = []
            prior_sections_summary = ""

            for section_plan in teaching_plan.section_plans:
                section_data = await self.section_generator.generate_section(
                    section_number=section_plan.section_number,
                    primary_objective=section_plan.primary_objective,
                    teaching_strategy=section_plan.teaching_strategy,
                    key_concepts=section_plan.key_concepts_to_cover,
                    key_terminology=master_context.key_terminology,
                    recommended_primitives=section_plan.recommended_primitives,
                    interactive_elements_focus=section_plan.interactive_elements_focus,
                    grade_level=grade_level,
                    subskill_description=subskill_description,
                    prior_sections_context=prior_sections_summary if prior_sections_summary else None
                )
                section_data_list.append(section_data)

                # Build context for next section
                prior_sections_summary += f"\nSection {section_plan.section_number}: {section_data['heading']} - taught {section_plan.primary_objective}"

            logger.info(f"✅ Generated {len(section_data_list)} focused sections")

            # ==================================================================
            # TIER 3: Integrate and Validate
            # ==================================================================
            logger.info("🔍 TIER 3: Integrating and validating...")
            integrated_content = await self.content_integrator.integrate_and_validate(
                subskill_id=subskill_id,
                version_id=version_id,
                subskill_description=subskill_description,
                learning_objectives=master_context.learning_objectives,
                section_data_list=section_data_list,
                overall_narrative=teaching_plan.overall_narrative_arc,
                grade_level=grade_level
            )
            logger.info(f"✅ Content validated and integrated: {integrated_content['title']}")

            # ==================================================================
            # Convert to ReadingContentPackage (Same Schema as Before)
            # ==================================================================
            now = datetime.utcnow()
            sections = []

            for idx, section_data in enumerate(integrated_content['sections']):
                # Collect all interactive primitives from all supported types
                interactive_primitives = []

                # List of all primitive type keys
                primitive_keys = [
                    'alerts', 'expandables', 'quizzes', 'definitions', 'checklists',
                    'tables', 'keyvalues', 'interactive_timelines', 'carousels',
                    'flip_cards', 'categorization_activities', 'fill_in_the_blanks',
                    'scenario_questions', 'tabbed_content', 'matching_activities',
                    'sequencing_activities', 'accordions'
                ]

                # Collect primitives from all types present in section
                for key in primitive_keys:
                    if key in section_data and section_data[key]:
                        interactive_primitives.extend(section_data[key])

                section = ReadingSection(
                    section_id=f"{subskill_id}_section_{idx+1}",
                    section_order=idx + 1,
                    heading=section_data['heading'],
                    content_text=section_data['content'],
                    key_terms=section_data.get('key_terms_used', []),
                    concepts_covered=section_data.get('concepts_covered', []),
                    interactive_primitives=interactive_primitives,
                    has_visual_snippet=False,
                    created_at=now,
                    updated_at=now
                )
                sections.append(section)

            package = ReadingContentPackage(
                subskill_id=subskill_id,
                version_id=version_id,
                title=integrated_content['title'],
                sections=sections,
                generation_status='generated',
                is_draft=True,
                created_at=now,
                updated_at=now
            )

            logger.info(f"✅ Successfully created reading content package for {subskill_id}")
            return package

        except Exception as e:
            error_msg = f"3-tier reading content generation failed: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    async def _generate_reading_content_legacy(
        self,
        subskill_id: str,
        version_id: str,
        subskill_description: str,
        subject: str,
        grade_level: str,
        master_context: MasterContext
    ) -> ReadingContentPackage:
        """
        LEGACY: Generate structured reading content in a single LLM call.
        Kept for fallback purposes only.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            subskill_description: Description of the subskill
            subject: Subject area
            grade_level: Target grade level
            master_context: Master context with concepts, terminology, etc.

        Returns:
            ReadingContentPackage with generated sections
        """
        logger.info(f"📖 [LEGACY] Generating reading content for {subskill_id}")

        terminology_str = self._format_terminology_string(master_context.key_terminology)

        prompt = f"""
        Create comprehensive reading content for {grade_level} students learning {subskill_description}.

        Target Audience: {grade_level} students
        Subject: {subject}

        Use this EXACT master context:
        Core Concepts: {', '.join(master_context.core_concepts)}

        Key Terminology (use these exact definitions):
        {terminology_str}

        Learning Objectives: {', '.join(master_context.learning_objectives)}

        Real-world Applications: {', '.join(master_context.real_world_applications)}

        Create educational reading content that:
        1. Uses language appropriate for {grade_level} reading level
        2. Uses ONLY the terminology defined above with age-appropriate explanations
        3. Explains ALL core concepts systematically using examples {grade_level} students understand
        4. Addresses ALL learning objectives
        5. Includes real-world applications relevant to {grade_level} students
        6. Is appropriate for {master_context.difficulty_level} level within {grade_level}
        7. Has clear section headings and logical flow
        8. Uses sentence structure and vocabulary suitable for {grade_level}
        9. Includes 2-4 interactive primitives per section, choosing the most pedagogically appropriate types

        Target: 800-1200 words of educational content appropriate for {grade_level}.

        INTERACTIVE PRIMITIVES - Use the most appropriate types for your content:

        **Core Engagement Primitives (use frequently):**
        - alerts: Highlight important concepts, warnings, tips, or success criteria (info/warning/success/tip styles)
        - definitions: Define key terms inline when first introduced
        - quizzes: Quick comprehension checks after explaining concepts (include explanation)

        **Information Organization Primitives:**
        - tables: Compare/contrast data, show organized information (headers + rows)
        - keyvalues: Display important facts, statistics, formulas (key-value pairs)
        - tabbed_content: Compare related topics side-by-side (use 2-4 tabs)
        - accordions: FAQs, common misconceptions, Q&A breakdowns
        - expandables: Optional deeper information, advanced topics, extensions

        **Interactive Learning Primitives:**
        - flip_cards: Vocabulary practice, term/definition pairs, quick recall
        - matching_activities: Connect terms to definitions or concepts
        - categorization_activities: Sort items into categories (provide correct answers)
        - fill_in_the_blanks: Contextual vocabulary practice (use '__' for blanks)
        - sequencing_activities: Order steps in a process, chronological events
        - scenario_questions: Apply knowledge to real-world situations (provide options if multiple choice)

        **Visual/Temporal Primitives:**
        - interactive_timelines: Historical events, process sequences, chronological order
        - carousels: Step-by-step visual examples, image sequences (use placeholder URLs like "https://placeholder.example/step1.jpg")
        - checklists: Step-by-step procedures, learning goals tracking

        **Selection Guidelines:**
        - Use alerts and definitions in EVERY section for key concepts and terms
        - Add 1-2 knowledge check primitives per section (quizzes, fill-in-the-blanks, or scenario questions)
        - Choose organization primitives (tables, keyvalues, tabs) for comparative or structured information
        - Use interactive activities (matching, categorization, sequencing) to reinforce learning
        - Add timelines for chronological content, carousels for visual step-by-step processes
        - Keep primitives relevant to the content - don't force them if they don't fit naturally
        """

        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-flash-latest',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=get_reading_content_schema(),
                    temperature=0.4,
                    max_output_tokens=25000
                )
            )

            content_data = json.loads(response.text)
            logger.info(f"✅ Generated {len(content_data['sections'])} sections")

            # Convert to ReadingContentPackage
            now = datetime.utcnow()
            sections = []

            for idx, section_data in enumerate(content_data['sections']):
                # Collect all interactive primitives from all supported types
                interactive_primitives = []

                # List of all primitive type keys
                primitive_keys = [
                    'alerts', 'expandables', 'quizzes', 'definitions', 'checklists',
                    'tables', 'keyvalues', 'interactive_timelines', 'carousels',
                    'flip_cards', 'categorization_activities', 'fill_in_the_blanks',
                    'scenario_questions', 'tabbed_content', 'matching_activities',
                    'sequencing_activities', 'accordions'
                ]

                # Collect primitives from all types present in section
                for key in primitive_keys:
                    if key in section_data and section_data[key]:
                        interactive_primitives.extend(section_data[key])

                section = ReadingSection(
                    section_id=f"{subskill_id}_section_{idx+1}",
                    section_order=idx + 1,
                    heading=section_data['heading'],
                    content_text=section_data['content'],
                    key_terms=section_data.get('key_terms_used', []),
                    concepts_covered=section_data.get('concepts_covered', []),
                    interactive_primitives=interactive_primitives,
                    has_visual_snippet=False,
                    created_at=now,
                    updated_at=now
                )
                sections.append(section)

            package = ReadingContentPackage(
                subskill_id=subskill_id,
                version_id=version_id,
                title=content_data['title'],
                sections=sections,
                generation_status='generated',
                is_draft=True,
                created_at=now,
                updated_at=now
            )

            logger.info(f"✅ Successfully created reading content package for {subskill_id}")
            return package

        except Exception as e:
            error_msg = f"Reading content generation failed: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    async def regenerate_section(
        self,
        section: ReadingSection,
        master_context: MasterContext,
        grade_level: str,
        custom_prompt: Optional[str] = None
    ) -> ReadingSection:
        """
        Regenerate a specific section of reading content.

        Args:
            section: Existing section to regenerate
            master_context: Master context for consistency
            grade_level: Target grade level
            custom_prompt: Optional custom instructions

        Returns:
            Updated ReadingSection
        """
        logger.info(f"🔄 Regenerating section: {section.heading}")

        terminology_str = self._format_terminology_string(master_context.key_terminology)

        prompt = f"""
        Regenerate this section of reading content for {grade_level} students.

        Original Section Heading: {section.heading}
        Original Content: {section.content_text}

        Key Terminology (maintain consistency):
        {terminology_str}

        Core Concepts to Cover: {', '.join(section.concepts_covered)}
        Key Terms to Use: {', '.join(section.key_terms)}

        {"Additional Instructions: " + custom_prompt if custom_prompt else ""}

        Requirements:
        1. Maintain the same heading and learning objectives
        2. Use ONLY the terminology defined above
        3. Appropriate for {grade_level} reading level
        4. Include 2-4 interactive primitives, choosing the most pedagogically appropriate types

        INTERACTIVE PRIMITIVES - Use the most appropriate types:
        - Core: alerts, definitions, quizzes (use frequently)
        - Organization: tables, keyvalues, tabbed_content, accordions, expandables
        - Interactive: flip_cards, matching_activities, categorization_activities, fill_in_the_blanks, sequencing_activities, scenario_questions
        - Visual/Temporal: interactive_timelines, carousels, checklists

        Generate the improved section content with appropriate interactive primitives.
        """

        try:
            # Create a simplified schema for section regeneration that includes all primitive types
            section_schema = Schema(
                type="object",
                properties={
                    "content": Schema(type="string", description="Section content text"),
                    "alerts": Schema(type="array", items=Schema(type="object")),
                    "expandables": Schema(type="array", items=Schema(type="object")),
                    "quizzes": Schema(type="array", items=Schema(type="object")),
                    "definitions": Schema(type="array", items=Schema(type="object")),
                    "checklists": Schema(type="array", items=Schema(type="object")),
                    "tables": Schema(type="array", items=Schema(type="object")),
                    "keyvalues": Schema(type="array", items=Schema(type="object")),
                    "interactive_timelines": Schema(type="array", items=Schema(type="object")),
                    "carousels": Schema(type="array", items=Schema(type="object")),
                    "flip_cards": Schema(type="array", items=Schema(type="object")),
                    "categorization_activities": Schema(type="array", items=Schema(type="object")),
                    "fill_in_the_blanks": Schema(type="array", items=Schema(type="object")),
                    "scenario_questions": Schema(type="array", items=Schema(type="object")),
                    "tabbed_content": Schema(type="array", items=Schema(type="object")),
                    "matching_activities": Schema(type="array", items=Schema(type="object")),
                    "sequencing_activities": Schema(type="array", items=Schema(type="object")),
                    "accordions": Schema(type="array", items=Schema(type="object"))
                },
                required=["content"]
            )

            response = await self.client.aio.models.generate_content(
                model='gemini-flash-latest',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=section_schema,
                    temperature=0.4,
                    max_output_tokens=10000
                )
            )

            section_data = json.loads(response.text)

            # Update section with new content - collect all primitive types
            interactive_primitives = []
            primitive_keys = [
                'alerts', 'expandables', 'quizzes', 'definitions', 'checklists',
                'tables', 'keyvalues', 'interactive_timelines', 'carousels',
                'flip_cards', 'categorization_activities', 'fill_in_the_blanks',
                'scenario_questions', 'tabbed_content', 'matching_activities',
                'sequencing_activities', 'accordions'
            ]

            for key in primitive_keys:
                if key in section_data and section_data[key]:
                    interactive_primitives.extend(section_data[key])

            updated_section = section.copy(update={
                'content_text': section_data['content'],
                'interactive_primitives': interactive_primitives,
                'updated_at': datetime.utcnow()
            })

            logger.info(f"✅ Successfully regenerated section: {section.heading}")
            return updated_section

        except Exception as e:
            error_msg = f"Section regeneration failed: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
