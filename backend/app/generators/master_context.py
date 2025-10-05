# backend/app/core/generators/master_context.py
import json
import logging
from google.genai.types import GenerateContentConfig

from .base_generator import BaseContentGenerator
from .content import ContentGenerationRequest, MasterContext
from .content_schemas import MASTER_CONTEXT_SCHEMA

logger = logging.getLogger(__name__)


class MasterContextGenerator(BaseContentGenerator):
    """Generator for master context that provides foundation for all content"""

    def __init__(self, cosmos_service=None, blob_service=None):
        super().__init__(cosmos_service=cosmos_service, blob_service=blob_service)
        self.cosmos_db = cosmos_service  # Assign from base class parameter

    async def generate_master_context(self, request: ContentGenerationRequest) -> MasterContext:
        """Generate foundational context for all content - UPDATED WITH GRADE and CACHING"""

        # Try to get from cache first
        if self.cosmos_db and request.subskill_id:
            cached_context = await self.cosmos_db.get_cached_master_context(
                subject=request.subject,
                subskill_id=request.subskill_id
            )
            if cached_context:
                logger.info(f"✅ Using cached master context for {request.subject}:{request.subskill_id}")
                # Reconstruct MasterContext from cached data
                return MasterContext(
                    core_concepts=cached_context.get('core_concepts', []),
                    key_terminology=cached_context.get('key_terminology', {}),
                    learning_objectives=cached_context.get('learning_objectives', []),
                    difficulty_level=cached_context.get('difficulty_level', request.difficulty_level),
                    prerequisites=cached_context.get('prerequisites', request.prerequisites or []),
                    real_world_applications=cached_context.get('real_world_applications', [])
                )

        # Cache miss - generate new master context
        logger.info(f"🔄 Cache miss - generating new master context for {request.subject}:{request.subskill_id}")

        # Get grade information if available from request
        grade_info = self._extract_grade_info(request)

        prompt = f"""
        Create a comprehensive educational foundation for teaching this topic:

        Subject: {request.subject}
        Grade Level: {grade_info}
        Unit: {request.unit}
        Skill: {request.skill}
        Subskill: {request.subskill}
        Difficulty: {request.difficulty_level}
        Prerequisites: {', '.join(request.prerequisites) if request.prerequisites else 'None'}

        Requirements for {grade_info} students:
        - 4-6 core concepts appropriate for {grade_info} cognitive development
        - 5-8 key terms with definitions suitable for {grade_info} vocabulary level
        - 4-6 specific, measurable learning objectives aligned with {grade_info} standards
        - 3-5 real-world applications that {grade_info} students can relate to
        - Language complexity and examples appropriate for {grade_info}

        This will be the foundation for generating reading content, visual demos, audio dialogue, and practice problems.
        """
        
        try:
            response = await self.client.aio.models.generate_content(
                model='gemini-flash-latest',
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
                key_terminology=key_terminology_dict,  # Convert back to dict
                learning_objectives=context_data['learning_objectives'],
                difficulty_level=context_data.get('difficulty_level', request.difficulty_level),
                prerequisites=context_data.get('prerequisites', request.prerequisites),
                real_world_applications=context_data['real_world_applications']
            )

            # Cache the newly generated master context
            if self.cosmos_db and request.subskill_id:
                try:
                    # Convert MasterContext back to dict for storage
                    master_context_data = {
                        'core_concepts': master_context.core_concepts,
                        'key_terminology': master_context.key_terminology,
                        'learning_objectives': master_context.learning_objectives,
                        'difficulty_level': master_context.difficulty_level,
                        'prerequisites': master_context.prerequisites,
                        'real_world_applications': master_context.real_world_applications
                    }

                    await self.cosmos_db.save_cached_master_context(
                        subject=request.subject,
                        grade_level=request.grade or "Kindergarten",
                        unit_id=request.unit_id or "",
                        skill_id=request.skill_id or "",
                        subskill_id=request.subskill_id,
                        master_context_data=master_context_data
                    )
                    logger.info(f"Successfully cached new master context for {request.subject}:{request.subskill_id}")
                except Exception as cache_error:
                    logger.error(f"Failed to cache master context: {cache_error}")
                    # Don't fail the request if caching fails - just log it

            return master_context
            
        except Exception as e:
            self._handle_generation_error("Master context generation", e)