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
    """Get the schema for reading content generation with all interactive primitive types"""
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
                        # Interactive Primitives (all optional)
                        "alerts": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["alert"], description="Primitive type identifier"),
                                    "style": Schema(type="string", enum=["info", "warning", "success", "tip"], description="Alert visual style"),
                                    "title": Schema(type="string", description="Alert title/heading"),
                                    "content": Schema(type="string", description="Alert body content")
                                },
                                required=["type", "style", "title", "content"]
                            ),
                            description="Alert/callout boxes for important information"
                        ),
                        "expandables": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["expandable"], description="Primitive type identifier"),
                                    "title": Schema(type="string", description="Expandable section title"),
                                    "content": Schema(type="string", description="Hidden content revealed on expansion")
                                },
                                required=["type", "title", "content"]
                            ),
                            description="Expandable sections for optional deeper information"
                        ),
                        "quizzes": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["quiz"], description="Primitive type identifier"),
                                    "question": Schema(type="string", description="Quiz question text"),
                                    "answer": Schema(type="string", description="Correct answer"),
                                    "explanation": Schema(type="string", description="Optional explanation of the answer")
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
                                    "type": Schema(type="string", enum=["definition"], description="Primitive type identifier"),
                                    "term": Schema(type="string", description="Term to be defined"),
                                    "definition": Schema(type="string", description="Definition of the term")
                                },
                                required=["type", "term", "definition"]
                            ),
                            description="Inline term definitions for contextual learning"
                        ),
                        "checklists": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["checklist"], description="Primitive type identifier"),
                                    "text": Schema(type="string", description="Checklist item text"),
                                    "completed": Schema(type="boolean", default=False, description="Initial completion state")
                                },
                                required=["type", "text"]
                            ),
                            description="Progress tracking checklist items"
                        ),
                        "tables": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["table"], description="Primitive type identifier"),
                                    "headers": Schema(
                                        type="array",
                                        items=Schema(type="string"),
                                        description="Table column headers"
                                    ),
                                    "rows": Schema(
                                        type="array",
                                        items=Schema(
                                            type="array",
                                            items=Schema(type="string")
                                        ),
                                        description="Table row data (array of arrays)"
                                    )
                                },
                                required=["type", "headers", "rows"]
                            ),
                            description="Structured data tables"
                        ),
                        "keyvalues": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["keyvalue"], description="Primitive type identifier"),
                                    "key": Schema(type="string", description="Fact or statistic label"),
                                    "value": Schema(type="string", description="Corresponding value or data")
                                },
                                required=["type", "key", "value"]
                            ),
                            description="Key-value pairs for important facts and statistics"
                        ),
                        "interactive_timelines": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["interactive_timeline"], description="Primitive type identifier"),
                                    "title": Schema(type="string", description="Title of the timeline"),
                                    "events": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "date": Schema(type="string", description="Date or time point of the event"),
                                                "title": Schema(type="string", description="Title of the event"),
                                                "description": Schema(type="string", description="Detailed description of the event")
                                            },
                                            required=["date", "title", "description"]
                                        ),
                                        description="A list of events on the timeline"
                                    )
                                },
                                required=["type", "title", "events"]
                            ),
                            description="Interactive timelines to visualize sequences of events"
                        ),
                        "carousels": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["carousel"], description="Primitive type identifier"),
                                    "title": Schema(type="string", description="Optional title for the carousel"),
                                    "items": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "image_url": Schema(type="string", description="URL for the carousel image"),
                                                "alt_text": Schema(type="string", description="Accessibility text for the image"),
                                                "caption": Schema(type="string", description="A brief caption for the image"),
                                                "description": Schema(type="string", description="Optional detailed description")
                                            },
                                            required=["image_url", "alt_text"]
                                        )
                                    )
                                },
                                required=["type", "items"]
                            ),
                            description="Carousels or sliders for displaying a sequence of images or cards"
                        ),
                        "flip_cards": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["flip_card"], description="Primitive type identifier"),
                                    "front_content": Schema(type="string", description="Content for the front of the card"),
                                    "back_content": Schema(type="string", description="Content for the back of the card")
                                },
                                required=["type", "front_content", "back_content"]
                            ),
                            description="Interactive flip cards for self-assessment and vocabulary"
                        ),
                        "categorization_activities": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["categorization"], description="Primitive type identifier"),
                                    "instruction": Schema(type="string", description="Instruction for the activity"),
                                    "categories": Schema(
                                        type="array",
                                        items=Schema(type="string"),
                                        description="The categories to sort items into"
                                    ),
                                    "items": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "item_text": Schema(type="string", description="The text of the item to be categorized"),
                                                "correct_category": Schema(type="string", description="The correct category for this item")
                                            },
                                            required=["item_text", "correct_category"]
                                        ),
                                        description="The items that need to be sorted"
                                    )
                                },
                                required=["type", "instruction", "categories", "items"]
                            ),
                            description="Activities where users sort items into categories"
                        ),
                        "fill_in_the_blanks": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["fill_in_the_blank"], description="Primitive type identifier"),
                                    "sentence": Schema(type="string", description="The sentence with a blank, represented by '__'"),
                                    "correct_answer": Schema(type="string", description="The word that correctly fills the blank"),
                                    "hint": Schema(type="string", description="Optional hint for the student")
                                },
                                required=["type", "sentence", "correct_answer"]
                            ),
                            description="Fill-in-the-blank exercises to test knowledge in context"
                        ),
                        "scenario_questions": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["scenario_question"], description="Primitive type identifier"),
                                    "scenario": Schema(type="string", description="A real-world scenario or problem description"),
                                    "question": Schema(type="string", description="The question related to the scenario"),
                                    "answer_options": Schema(
                                        type="array",
                                        items=Schema(type="string"),
                                        description="A list of possible answers for multiple choice scenarios"
                                    ),
                                    "correct_answer": Schema(type="string", description="The correct answer"),
                                    "explanation": Schema(type="string", description="Explanation of why the answer is correct")
                                },
                                required=["type", "scenario", "question", "correct_answer"]
                            ),
                            description="Questions based on real-world scenarios to promote application of knowledge"
                        ),
                        "tabbed_content": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["tabbed_content"], description="Primitive type identifier"),
                                    "tabs": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "title": Schema(type="string", description="The title of the tab"),
                                                "content": Schema(type="string", description="The content within the tab")
                                            },
                                            required=["title", "content"]
                                        ),
                                        description="A list of tab objects, each with a title and content."
                                    )
                                },
                                required=["type", "tabs"]
                            ),
                            description="Tabbed interface for comparing and contrasting related topics."
                        ),
                        "matching_activities": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["matching_activity"], description="Primitive type identifier"),
                                    "instruction": Schema(type="string", description="Instruction for the activity, e.g., 'Match the term to its definition.'"),
                                    "pairs": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "prompt": Schema(type="string", description="The item in the first column (e.g., the term)"),
                                                "answer": Schema(type="string", description="The corresponding item in the second column (e.g., the definition)")
                                            },
                                            required=["prompt", "answer"]
                                        ),
                                        description="The list of correct pairs. The front-end will shuffle the answer column."
                                    )
                                },
                                required=["type", "instruction", "pairs"]
                            ),
                            description="Interactive matching games to connect concepts."
                        ),
                        "sequencing_activities": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["sequencing_activity"], description="Primitive type identifier"),
                                    "instruction": Schema(type="string", description="Instruction for the activity, e.g., 'Arrange the steps of photosynthesis in the correct order.'"),
                                    "items": Schema(
                                        type="array",
                                        items=Schema(type="string"),
                                        description="The list of items to be sequenced, provided in the correct order. The front-end will display them shuffled."
                                    )
                                },
                                required=["type", "instruction", "items"]
                            ),
                            description="Activities where students must arrange items in the correct order."
                        ),
                        "accordions": Schema(
                            type="array",
                            items=Schema(
                                type="object",
                                properties={
                                    "type": Schema(type="string", enum=["accordion"], description="Primitive type identifier"),
                                    "title": Schema(type="string", description="Optional title for the accordion group, e.g., 'Frequently Asked Questions'"),
                                    "items": Schema(
                                        type="array",
                                        items=Schema(
                                            type="object",
                                            properties={
                                                "question": Schema(type="string", description="The question or heading for the expandable item"),
                                                "answer": Schema(type="string", description="The content that is revealed")
                                            },
                                            required=["question", "answer"]
                                        ),
                                        description="A list of question/answer pairs."
                                    )
                                },
                                required=["type", "items"]
                            ),
                            description="An accordion-style list for FAQs or question-and-answer breakdowns."
                        )
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
                model='gemini-2.5-flash-preview-05-20',
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
