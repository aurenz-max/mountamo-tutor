# backend/app/core/generators/reading_content.py
import json
import logging
from typing import Dict, Any
from google.genai.types import GenerateContentConfig

from .base_generator import BaseContentGenerator
from .content import ContentGenerationRequest, MasterContext, ContentComponent, ComponentType
from .content_schemas import READING_CONTENT_SCHEMA

logger = logging.getLogger(__name__)


class ReadingContentGenerator(BaseContentGenerator):
    """Generator for structured reading content"""
    
    async def generate_reading_content(
        self, request: ContentGenerationRequest, master_context: MasterContext, package_id: str
    ) -> ContentComponent:
        """Generate structured reading content - UPDATED WITH GRADE"""
        
        terminology_str = self._format_terminology_string(master_context.key_terminology)
        grade_info = self._extract_grade_info(request)
        
        prompt = f"""
        Create comprehensive reading content for {grade_info} students learning {request.subskill}.

        Target Audience: {grade_info} students
        Subject: {request.subject}
        
        Use this EXACT master context:
        Core Concepts: {', '.join(master_context.core_concepts)}
        
        Key Terminology (use these exact definitions):
        {terminology_str}
        
        Learning Objectives: {', '.join(master_context.learning_objectives)}
        
        Real-world Applications: {', '.join(master_context.real_world_applications)}

        Create educational reading content that:
        1. Uses language appropriate for {grade_info} reading level
        2. Uses ONLY the terminology defined above with age-appropriate explanations
        3. Explains ALL core concepts systematically using examples {grade_info} students understand
        4. Addresses ALL learning objectives
        5. Includes real-world applications relevant to {grade_info} students
        6. Is appropriate for {master_context.difficulty_level} level within {grade_info}
        7. Has clear section headings and logical flow
        8. Uses sentence structure and vocabulary suitable for {grade_info}
        9. **ENHANCED INTERACTIVITY**: Strategically incorporate interactive primitives to boost engagement

        ## Available Interactive Primitives (use strategically throughout sections):

        ### Basic Primitives:
        - **alerts**: Important callouts (info/warning/success/tip style) for key points
        - **expandables**: Optional deeper information that students can explore
        - **quizzes**: Quick knowledge check questions with answers and explanations
        - **definitions**: Inline clickable definitions for key terms
        - **checklists**: Progress tracking items for student completion
        - **tables**: Structured data presentation with headers and rows
        - **keyvalues**: Key facts and statistics in key-value format

        ### NEW Enhanced Primitives (PRIORITIZE THESE for engagement):
        - **interactive_timelines**: Clickable chronological events with descriptions - perfect for sequences, historical events, or step-by-step processes
        - **carousels**: Step-by-step instruction guides with navigation - great for showing sequential processes, procedures, or multi-step explanations (TEXT-BASED, no images needed)
        - **flip_cards**: Interactive flashcard-style learning - excellent for vocabulary, Q&A, or concept reinforcement
        - **categorization_activities**: Drag-and-drop sorting exercises - perfect for teaching classifications, groupings, or relationships
        - **fill_in_the_blanks**: Interactive sentences with missing words - ideal for testing comprehension and key terminology
        - **scenario_questions**: Real-world application questions with explanations - excellent for connecting theory to practice
        - **tabbed_content**: Tabbed interface for comparing and contrasting 2-4 related concepts side-by-side
        - **matching_activities**: Interactive matching games to connect concepts, terms, definitions, or examples
        - **sequencing_activities**: Activities where students must arrange items in the correct chronological or logical order
        - **accordions**: Accordion-style list for FAQs or question-and-answer breakdowns

        ## Strategic Primitive Usage Guidelines:
        1. **Interactive Timelines**: Use for any sequential information (historical events, processes, cause-and-effect chains)
        2. **Carousels**: Create step-by-step instructions or procedures using text descriptions only (use caption for step title, description/alt_text for detailed instructions)
        3. **Flip Cards**: Create for vocabulary terms, key facts, or question-answer pairs
        4. **Categorization**: Design activities that help students organize and classify information
        5. **Fill-in-the-Blanks**: Test key terminology within meaningful context sentences
        6. **Scenario Questions**: Connect abstract concepts to real-world situations students can relate to
        7. **Tabbed Content**: Use to compare/contrast 2-4 related concepts, historical figures, or scientific theories side-by-side
        8. **Matching Activity**: Create to test associations between key terms and definitions, historical figures and their achievements, or causes and effects
        9. **Sequencing Activity**: Use to test a student's understanding of any multi-step process, from solving a math problem to the events leading up to a historical moment
        10. **Accordion/FAQ**: Structure complex information as a series of questions and answers to anticipate and resolve common student misunderstandings

        ## Content Requirements:
        - Target: 800-1200 words of educational content
        - Include 2-4 interactive primitives per section (mix basic and enhanced)
        - Ensure primitives support learning objectives, don't just decorate
        - Make activities age-appropriate and curriculum-aligned
        - Use real imagery URLs when possible for image-based primitives
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=READING_CONTENT_SCHEMA,
                    temperature=0.4,
                    max_output_tokens=25000
                )
            )
            
            content_data = self._safe_json_loads(response.text, "Reading content generation")
            
            return ContentComponent(
                package_id=package_id,
                component_type=ComponentType.READING,
                content=content_data,
                metadata={
                    "word_count": content_data.get('word_count', 0),
                    "reading_level": content_data.get('reading_level', grade_info),
                    "grade_level": grade_info,
                    "section_count": len(content_data.get('sections', []))
                }
            )
            
        except Exception as e:
            self._handle_generation_error("Reading content generation", e)

    async def revise_reading_content(
        self,
        original_content: Dict[str, Any],
        feedback: str,
        master_context: MasterContext
    ) -> Dict[str, Any]:
        """Revise reading content based on feedback"""
        
        # Use same terminology for coherence
        terminology_str = self._format_terminology_string(master_context.key_terminology)
        
        prompt = f"""
        Revise this educational reading content based on the feedback provided.

        ORIGINAL CONTENT: {json.dumps(original_content, indent=2)}

        FEEDBACK TO ADDRESS: {feedback}

        REQUIREMENTS (maintain coherence):
        - Keep the same key terminology: {terminology_str}
        - Address the same learning objectives: {', '.join(master_context.learning_objectives)}
        - Maintain {master_context.difficulty_level} difficulty level
        - Keep the same overall structure and format
        
        Apply the feedback while maintaining all existing terminology and concepts.
        Return the revised content in the EXACT same JSON format as the original.
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    temperature=0.4,
                    max_output_tokens=25000
                )
            )
            
            revised_content = self._safe_json_loads(response.text, "Reading content revision")
            logger.info("Reading content revised successfully")
            return revised_content
            
        except Exception as e:
            self._handle_generation_error("Reading content revision", e)