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
from app.models.foundations import MasterContext
from app.models.content import ReadingContentPackage, ReadingSection

logger = logging.getLogger(__name__)


# Define the reading content schema for Gemini
def get_reading_content_schema() -> Schema:
    """Get the schema for reading content generation"""
    return Schema(
        type="object",
        properties={
            "title": Schema(type="string", description="Title for the reading content"),
            "sections": Schema(
                type="array",
                items=Schema(
                    type="object",
                    properties={
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
                        ),
                        # Interactive primitives (simplified version)
                        "alerts": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["alert"]),
                                    "style": Schema(type="string", enum=["info", "warning", "success", "tip"]),
                                    "title": Schema(type="string"),
                                    "content": Schema(type="string")
                                },
                                required=["type", "style", "title", "content"]
                            ),
                            description="Alert/callout boxes"
                        ),
                        "quizzes": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["quiz"]),
                                    "question": Schema(type="string"),
                                    "answer": Schema(type="string"),
                                    "explanation": Schema(type="string")
                                },
                                required=["type", "question", "answer"]
                            ),
                            description="Quick knowledge check questions"
                        ),
                        "definitions": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["definition"]),
                                    "term": Schema(type="string"),
                                    "definition": Schema(type="string")
                                },
                                required=["type", "term", "definition"]
                            ),
                            description="Inline term definitions"
                        ),
                    },
                    required=["heading", "content", "key_terms_used", "concepts_covered"]
                ),
                description="Array of content sections"
            )
        },
        required=["title", "sections"]
    )


class ReadingContentGenerator:
    """Generator for structured reading content"""

    def __init__(self):
        self.client = None
        self._initialize_gemini()

    def _initialize_gemini(self):
        """Initialize Gemini client"""
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Gemini client initialized for ReadingContentGenerator")

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
        master_context: MasterContext
    ) -> ReadingContentPackage:
        """
        Generate structured reading content for a subskill.

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
        logger.info(f"📖 Generating reading content for {subskill_id}")

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
        9. Include interactive primitives (alerts, quizzes, definitions) to enhance engagement

        Target: 800-1200 words of educational content appropriate for {grade_level}.

        For each section, include:
        - 1-2 alerts for important information (optional)
        - 1-2 quiz questions to check understanding (optional)
        - Definitions for key terms introduced (optional)
        """

        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
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
                # Collect all interactive primitives
                interactive_primitives = []

                if 'alerts' in section_data:
                    interactive_primitives.extend(section_data['alerts'])

                if 'quizzes' in section_data:
                    interactive_primitives.extend(section_data['quizzes'])

                if 'definitions' in section_data:
                    interactive_primitives.extend(section_data['definitions'])

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
        4. Include interactive primitives (alerts, quizzes, definitions) as appropriate

        Generate the improved section content.
        """

        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=Schema(
                        type="object",
                        properties={
                            "content": Schema(type="string"),
                            "alerts": Schema(type="array", items=Schema(type="object")),
                            "quizzes": Schema(type="array", items=Schema(type="object")),
                            "definitions": Schema(type="array", items=Schema(type="object")),
                        },
                        required=["content"]
                    ),
                    temperature=0.4,
                    max_output_tokens=10000
                )
            )

            section_data = json.loads(response.text)

            # Update section with new content
            interactive_primitives = []
            if 'alerts' in section_data:
                interactive_primitives.extend(section_data['alerts'])
            if 'quizzes' in section_data:
                interactive_primitives.extend(section_data['quizzes'])
            if 'definitions' in section_data:
                interactive_primitives.extend(section_data['definitions'])

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
