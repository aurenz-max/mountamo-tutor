# backend/app/services/content_generation_service.py

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, TypedDict

import google.generativeai as genai

from ..db.cosmos_db import CosmosDBService
from ..generators.master_context import MasterContextGenerator
from ..generators.reading_content import ReadingContentGenerator
from ..generators.practice_problems import PracticeProblemsGenerator
from ..generators.context_primitives import ContextPrimitivesGenerator
from ..generators.content import ContentGenerationRequest, DifficultyLevel

logger = logging.getLogger(__name__)


class VisualMetadata(TypedDict):
    """Metadata for visual HTML snippets to guide tutoring"""
    walk_through: str
    focus_points: str
    generated_at: str
    model: str

class ContentGenerationService:
    """Service to orchestrate content package generation from subskill information"""

    def __init__(self, curriculum_service=None):
        self.cosmos_db = CosmosDBService()
        self.curriculum_service = curriculum_service  # Will be injected for BigQuery authored content

        # Initialize generators
        self.master_context_generator = MasterContextGenerator(cosmos_service=self.cosmos_db)
        self.context_primitives_generator = ContextPrimitivesGenerator(cosmos_service=self.cosmos_db)
        self.reading_generator = ReadingContentGenerator(cosmos_service=self.cosmos_db)
        self.practice_generator = PracticeProblemsGenerator(cosmos_service=self.cosmos_db)

        # Initialize Gemini Flash Lite for visual metadata generation
        self.flash_lite_model = genai.GenerativeModel("gemini-flash-lite-latest")
    
    async def generate_package_from_subskill(
        self,
        subskill_id: str,
        subskill_context: Dict[str, Any],
        bigquery_foundations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a complete content package for a subskill with 3-tier fallback

        Args:
            subskill_id: Curriculum subskill identifier
            subskill_context: Metadata about the subskill
            bigquery_foundations: Optional BigQuery foundations (master_context, context_primitives)
        """

        logger.info(f"🎯 Starting package generation for subskill: {subskill_id}")

        try:
            # Generate package ID
            package_id = f"pkg_{int(datetime.now().timestamp())}"

            # Create content generation request from subskill context
            request = self._build_generation_request(subskill_context)

            # Step 1: Generate/retrieve master context (with 3-tier fallback)
            logger.info("📋 Retrieving/generating master context...")
            master_context = await self.master_context_generator.generate_master_context(
                request,
                bigquery_foundations=bigquery_foundations
            )

            # Step 2: Generate/retrieve context primitives (with 3-tier fallback)
            logger.info("🎲 Retrieving/generating context primitives...")
            context_primitives = await self.context_primitives_generator.generate_context_primitives(
                request,
                master_context,
                bigquery_foundations=bigquery_foundations
            )

            # Step 3: Generate reading content
            logger.info("📖 Generating reading content...")
            reading_component = await self.reading_generator.generate_reading_content(
                request, master_context, package_id
            )

            # Step 4: Generate practice problems (using context primitives for variety)
            logger.info("🧩 Generating practice problems...")
            # Create minimal visual component for practice generator (it expects one)
            minimal_visual_comp = type('obj', (object,), {
                'content': {
                    'interactive_elements': ['Interactive demonstration'],
                    'concepts_demonstrated': master_context.core_concepts
                }
            })()

            practice_component = await self.practice_generator.generate_practice_problems(
                request, master_context, reading_component, minimal_visual_comp, package_id,
                context_primitives=context_primitives  # Pass primitives for problem variety
            )
            
            # Step 4: Assemble complete package
            logger.info("🔧 Assembling complete package...")
            complete_package = self._assemble_package(
                package_id, subskill_id, request, master_context, 
                reading_component, practice_component
            )
            
            # Step 5: Save to CosmosDB
            logger.info("💾 Saving package to database...")
            await self._save_package_to_cosmos(complete_package)
            
            logger.info(f"✅ Package generation completed: {package_id}")
            return complete_package
            
        except Exception as e:
            logger.error(f"❌ Package generation failed for {subskill_id}: {str(e)}")
            raise RuntimeError(f"Content generation failed: {str(e)}") from e
    
    def _build_generation_request(self, subskill_context: Dict[str, Any]) -> ContentGenerationRequest:
        """Build a generation request from subskill curriculum data"""
        
        return ContentGenerationRequest(
            subject=subskill_context.get('subject', 'General Studies'),
            grade=subskill_context.get('grade_level', 'Elementary'),
            unit=subskill_context.get('unit', 'Core Concepts'),
            skill=subskill_context.get('skill', 'Fundamental Skills'),
            subskill=subskill_context.get('subskill', subskill_context.get('description', 'Learning Objective')),
            difficulty_level=self._map_difficulty(subskill_context.get('difficulty_range', {})),
            prerequisites=subskill_context.get('prerequisites', []),
            # Pass the actual curriculum IDs from BigQuery
            unit_id=subskill_context.get('unit_id'),
            skill_id=subskill_context.get('skill_id'),
            subskill_id=subskill_context.get('subskill_id')
        )
    
    def _map_difficulty(self, difficulty_range: Dict[str, Any]) -> DifficultyLevel:
        """Map numeric difficulty range to descriptive level"""
        if not difficulty_range:
            return DifficultyLevel.INTERMEDIATE
            
        avg_difficulty = (difficulty_range.get('start', 5) + difficulty_range.get('end', 5)) / 2
        
        if avg_difficulty <= 3:
            return DifficultyLevel.BEGINNER
        elif avg_difficulty <= 6:
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.ADVANCED
    
    def _assemble_package(
        self, 
        package_id: str, 
        subskill_id: str,
        request,
        master_context, 
        reading_component, 
        practice_component
    ) -> Dict[str, Any]:
        """Assemble all components into a complete package structure"""
        
        return {
            "id": package_id,
            "subskill_id": subskill_id,  # NEW: Add subskill_id for direct lookup
            "generation_type": "dynamic",  # NEW: Mark as dynamically generated
            "subject": request.subject,
            "unit": request.unit,
            "skill": request.skill,
            "subskill": request.subskill,
            "master_context": {
                "core_concepts": master_context.core_concepts,
                "key_terminology": master_context.key_terminology,
                "learning_objectives": master_context.learning_objectives,
                "difficulty_level": master_context.difficulty_level,
                "prerequisites": master_context.prerequisites,
                "real_world_applications": master_context.real_world_applications
            },
            "content": {
                "reading": reading_component.content,
                "practice": practice_component.content
                # NOTE: Visual and audio components would be added here when available
            },
            "generation_metadata": {
                "generation_time_ms": None,  # Could track this
                "coherence_score": 0.9  # Default high score for generated content
            },
            "partition_key": f"{request.subject}-{request.unit}",
            "storage_metadata": {
                "updated_at": datetime.utcnow().isoformat(),
                "version": 1,
                "content_hash": str(uuid.uuid4())  # Simple hash substitute
            },
            "status": "approved",  # Auto-approve generated content
            "document_type": "content_package",  # Required for CosmosDB queries
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def _save_package_to_cosmos(self, package: Dict[str, Any]):
        """Save the complete package to CosmosDB"""
        try:
            # CosmosDB operations are synchronous, not async
            result = self.cosmos_db.content_packages.create_item(body=package)
            logger.info(f"📦 Package saved to CosmosDB: {package['id']} | Result: {result.get('id', 'Success')}")

        except Exception as e:
            logger.error(f"❌ Failed to save package to CosmosDB: {str(e)}")
            # Log the package data for debugging
            logger.error(f"Package data: {str(package)[:500]}...")
            raise

    # ============================================================================
    # NEW: 3-TIER CASCADE ORCHESTRATION (BigQuery → Cosmos → Dynamic)
    # ============================================================================

    async def get_or_create_package_for_subskill(
        self,
        subskill_id: str,
        user_id: Optional[str] = None
    ) -> str:
        """
        Main orchestrator for content package retrieval/generation

        Implements 3-tier cascade lookup:
        1. TIER 1 (BigQuery): Check for authored content, assemble hybrid package
        2. TIER 2 (Cosmos DB): Check for existing cached/manual packages
        3. TIER 3 (Dynamic): Generate new package using AI

        Args:
            subskill_id: Curriculum subskill identifier
            user_id: Optional user ID for tracking

        Returns:
            Package ID for frontend navigation
        """
        logger.info(f"🎯 Orchestrating package retrieval for subskill: {subskill_id}")

        # TIER 1: Check BigQuery for authored content
        if self.curriculum_service:
            try:
                logger.info("🔍 TIER 1: Checking BigQuery for authored content...")
                package_id = await self._try_bigquery_package(subskill_id)
                if package_id:
                    logger.info(f"✅ TIER 1 SUCCESS: Assembled package from BigQuery: {package_id}")
                    return package_id
                logger.info("ℹ️ TIER 1: No authored content found in BigQuery")
            except Exception as e:
                logger.error(f"❌ TIER 1 FAILED: BigQuery lookup error: {e} - Proceeding to Tier 2")

        # TIER 2: Check Cosmos DB for existing packages
        logger.info("🔍 TIER 2: Checking Cosmos DB for existing packages...")
        existing_package = await self._find_existing_cosmos_package(subskill_id)
        if existing_package:
            logger.info(f"✅ TIER 2 SUCCESS: Found existing package: {existing_package['id']}")
            return existing_package['id']
        logger.info("ℹ️ TIER 2: No existing package found in Cosmos DB")

        # TIER 3: Dynamic generation (fallback)
        logger.info("🚀 TIER 3: Triggering dynamic generation...")
        try:
            # Get subskill context AND check for BigQuery foundations (even if no complete package)
            subskill_context = await self._get_subskill_context(subskill_id)

            # Try to get foundations from BigQuery to pass to generators (for TIER 1 fallback within generators)
            bigquery_foundations = None
            if self.curriculum_service:
                try:
                    bigquery_foundations = await self.curriculum_service.get_subskill_foundations(subskill_id)
                    if bigquery_foundations:
                        logger.info(f"📚 Found BigQuery foundations for TIER 3 generation (will use in generators)")
                except Exception as e:
                    logger.warning(f"Could not fetch foundations from BigQuery: {e}")

            new_package = await self.generate_package_from_subskill(
                subskill_id,
                subskill_context,
                bigquery_foundations=bigquery_foundations
            )
            logger.info(f"✅ TIER 3 SUCCESS: Generated new package: {new_package['id']}")
            return new_package['id']
        except Exception as e:
            logger.error(f"❌ TIER 3 FAILED: Dynamic generation error: {e}")
            raise RuntimeError(f"All tiers failed for subskill {subskill_id}") from e

    async def _try_bigquery_package(self, subskill_id: str) -> Optional[str]:
        """
        TIER 1: Attempt to assemble package from BigQuery authored content

        Returns:
            Package ID if successful, None if no authored content exists
        """
        # Fetch all BigQuery authored content in parallel
        foundations_task = self.curriculum_service.get_subskill_foundations(subskill_id)
        reading_task = self.curriculum_service.get_reading_content_by_subskill(subskill_id)
        visuals_task = self.curriculum_service.get_visual_snippets_by_subskill(subskill_id)

        foundations, reading_content, visual_snippets = await asyncio.gather(
            foundations_task, reading_task, visuals_task
        )

        # Check if we have any authored content
        if not foundations and not reading_content:
            logger.info(f"No BigQuery authored content found for {subskill_id}")
            return None

        # Assemble hybrid package from BigQuery data
        logger.info(f"📦 Assembling hybrid package from BigQuery content...")
        package = await self._assemble_package_from_bigquery(
            subskill_id, foundations, reading_content, visual_snippets
        )

        # Cache to Cosmos DB for faster future retrieval
        await self._save_package_to_cosmos(package)

        return package['id']

    async def generate_visual_metadata(
        self,
        heading: str,
        content_text: str,
        visual_html: str
    ) -> Optional[VisualMetadata]:
        """
        Generate instructional metadata for visual HTML snippets using Gemini Flash Lite

        Args:
            heading: Section heading
            content_text: Section content text
            visual_html: Complete HTML visual snippet

        Returns:
            VisualMetadata with walk_through and focus_points, or None if generation fails
        """
        try:
            logger.info(f"🎨 Generating visual metadata for section: {heading[:50]}...")

            prompt = f"""You are an expert educational AI tutor analyzing an interactive visual learning element.

**Context:**
- Section Title: {heading}
- Learning Content: {content_text[:500]}...

**Visual HTML Snippet:**
```html
{visual_html[:3000]}...
```

Your task is to generate TWO types of guidance that will help a live AI tutor explain this visual to a student:

1. **"Walk me through this"** - A clear, step-by-step explanation of what the visual shows and how it demonstrates the concept. This should be student-facing language that the tutor can use to guide the learner through the visual. Keep it friendly, engaging, and age-appropriate.

2. **"What should I focus on?"** - Key elements, patterns, or interactive features that the student should pay attention to. Highlight what's most important for learning and understanding.

Requirements:
- Keep each response to 2-4 sentences
- Use simple, clear language appropriate for the grade level
- Be specific about what's in the visual (colors, shapes, interactions, etc.)
- Focus on learning value, not technical implementation
- Make it actionable and engaging

Return your response in this exact JSON format:
{{
    "walk_through": "Your walk-through explanation here...",
    "focus_points": "Your focus points here..."
}}"""

            # Generate metadata using Gemini Flash Lite
            response = await asyncio.to_thread(
                self.flash_lite_model.generate_content,
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    response_mime_type="application/json"
                )
            )

            # Parse JSON response
            import json
            result = json.loads(response.text)

            metadata: VisualMetadata = {
                "walk_through": result.get("walk_through", ""),
                "focus_points": result.get("focus_points", ""),
                "generated_at": datetime.utcnow().isoformat(),
                "model": "gemini-flash-lite-latest"
            }

            logger.info(f"✅ Visual metadata generated successfully")
            return metadata

        except Exception as e:
            logger.error(f"❌ Failed to generate visual metadata: {str(e)}", exc_info=True)
            return None

    async def _assemble_package_from_bigquery(
        self,
        subskill_id: str,
        foundations: Optional[Dict],
        reading_content: List[Dict],
        visual_snippets: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Assemble a complete package from BigQuery authored content

        Combines:
        - Master context from foundations table
        - Reading content sections with embedded visual snippets
        - Dynamically generated practice problems

        Args:
            subskill_id: Curriculum subskill identifier
            foundations: Master context and context primitives from BigQuery
            reading_content: List of reading sections from BigQuery
            visual_snippets: Dictionary mapping section_id to HTML content

        Returns:
            Complete package dictionary ready for Cosmos DB storage
        """
        logger.info(f"🔧 Assembling BigQuery package for {subskill_id}")

        # Generate synthetic package ID
        package_id = f"bq_{subskill_id}_active"

        # Get subskill metadata for subject/unit/skill info
        subskill_metadata = await self.curriculum_service.get_subskill_metadata(subskill_id)
        if not subskill_metadata:
            raise ValueError(f"No curriculum metadata found for subskill {subskill_id}")

        # Extract master context from foundations or use defaults
        master_context = foundations.get('master_context') if foundations else {}

        # If no master context, create a minimal one from metadata
        if not master_context:
            master_context = {
                "core_concepts": [],
                "key_terminology": {},
                "learning_objectives": [subskill_metadata.get('subskill_description', '')],
                "difficulty_level": "INTERMEDIATE",
                "prerequisites": [],
                "real_world_applications": []
            }

        # Transform BigQuery reading sections to package format
        reading_sections = []
        metadata_generation_tasks = []

        for section in reading_content:
            section_id = section.get('section_id', '')

            # Get interactive primitives and group by type for frontend
            primitives = section.get('interactive_primitives', [])
            grouped_primitives = self._group_primitives_by_type(primitives)

            # Build section with separated primitives
            section_data = {
                "id": section_id,
                "heading": section.get('heading', ''),
                "content": section.get('content_text', ''),
                "key_terms": section.get('key_terms', []),
                "concepts_covered": section.get('concepts_covered', []),
                **grouped_primitives  # Spread type-specific arrays (alerts, quizzes, etc.)
            }

            # Add visual snippet if available
            if section_id in visual_snippets:
                section_data['visual_html'] = visual_snippets[section_id]
                # Schedule metadata generation for this visual snippet
                metadata_generation_tasks.append(
                    (section_data, self.generate_visual_metadata(
                        heading=section.get('heading', ''),
                        content_text=section.get('content_text', ''),
                        visual_html=visual_snippets[section_id]
                    ))
                )

            reading_sections.append(section_data)

        # Generate visual metadata in parallel for all sections with visuals
        if metadata_generation_tasks:
            logger.info(f"🎨 Generating visual metadata for {len(metadata_generation_tasks)} sections...")
            for section_data, metadata_task in metadata_generation_tasks:
                try:
                    visual_metadata = await metadata_task
                    if visual_metadata:
                        section_data['visual_metadata'] = visual_metadata
                        logger.info(f"✅ Added visual metadata to section: {section_data['id']}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to generate metadata for section {section_data['id']}: {e}")

        # Calculate reading metadata
        total_word_count = sum(len(section.get('content', '').split()) for section in reading_sections)
        estimated_reading_minutes = max(1, round(total_word_count / 200))  # 200 words per minute, min 1 minute

        # Derive reading level from grade metadata
        grade = subskill_metadata.get('grade', 'Elementary')
        reading_level_map = {
            'Kindergarten': 'Early Elementary',
            'Grade 1': 'Early Elementary',
            'Grade 2': 'Early Elementary',
            'Grade 3': 'Elementary',
            'Grade 4': 'Elementary',
            'Grade 5': 'Upper Elementary',
            'Grade 6': 'Middle School',
            'Grade 7': 'Middle School',
            'Grade 8': 'Middle School',
            'Grade 9': 'High School',
            'Grade 10': 'High School',
            'Grade 11': 'High School',
            'Grade 12': 'High School',
        }
        reading_level = reading_level_map.get(grade, 'Elementary')

        # Build reading component
        reading_component_content = {
            "title": reading_content[0].get('title', subskill_metadata.get('subskill_description', '')) if reading_content else subskill_metadata.get('subskill_description', ''),
            "sections": reading_sections,
            "word_count": total_word_count,
            "reading_level": reading_level
        }

        # Generate practice problems dynamically (using existing generator)
        logger.info("🧩 Generating practice problems for BigQuery package...")
        try:
            # Build a minimal request for practice generation
            request = ContentGenerationRequest(
                subject=subskill_metadata.get('subject', 'General Studies'),
                grade=subskill_metadata.get('grade', 'Elementary'),
                unit=subskill_metadata.get('unit_title', 'Core Concepts'),
                skill=subskill_metadata.get('skill_description', 'Fundamental Skills'),
                subskill=subskill_metadata.get('subskill_description', ''),
                difficulty_level=self._map_difficulty(subskill_metadata.get('difficulty_range', {})),
                prerequisites=[],
                unit_id=subskill_metadata.get('unit_id'),
                skill_id=subskill_metadata.get('skill_id'),
                subskill_id=subskill_id
            )

            # Create minimal master context object for practice generator
            master_context_obj = type('obj', (object,), {
                'core_concepts': master_context.get('core_concepts', []),
                'key_terminology': master_context.get('key_terminology', {}),
                'learning_objectives': master_context.get('learning_objectives', []),
                'difficulty_level': master_context.get('difficulty_level', 'INTERMEDIATE'),
                'prerequisites': master_context.get('prerequisites', []),
                'real_world_applications': master_context.get('real_world_applications', [])
            })()

            # Create minimal reading component object
            reading_component_obj = type('obj', (object,), {
                'content': reading_component_content
            })()

            # Create minimal visual component
            minimal_visual_comp = type('obj', (object,), {
                'content': {
                    'interactive_elements': ['Interactive demonstration'],
                    'concepts_demonstrated': master_context.get('core_concepts', [])
                }
            })()

            practice_component = await self.practice_generator.generate_practice_problems(
                request, master_context_obj, reading_component_obj, minimal_visual_comp, package_id
            )

            practice_content = practice_component.content

        except Exception as e:
            logger.warning(f"⚠️ Practice generation failed, using empty practice: {e}")
            practice_content = {"problems": []}

        # Add practice metadata
        problem_count = len(practice_content.get('problems', []))
        estimated_practice_minutes = problem_count * 3  # Estimate 3 minutes per problem

        if 'problems' in practice_content:
            practice_content['problem_count'] = problem_count
            practice_content['estimated_time_minutes'] = estimated_practice_minutes

        # Calculate total engagement points available in this package
        # Reading sections: 20 XP each for completion
        reading_section_points = len(reading_sections) * 20

        # Interactive primitives: count all quizzes, categorization, etc. (10 XP each)
        total_primitives = 0
        for section in reading_sections:
            for key in ['quizzes', 'categorization_activities', 'fill_in_the_blanks',
                       'scenario_questions', 'matching_activities', 'sequencing_activities']:
                total_primitives += len(section.get(key, []))
        primitive_points = total_primitives * 10

        # Visual snippets: 10 XP each for viewing
        visual_snippet_count = sum(1 for section in reading_sections if 'visual_html' in section)
        visual_points = visual_snippet_count * 10

        # Practice problems: 20 XP each for completion
        practice_points = problem_count * 20

        # Package completion bonus
        completion_bonus = 50

        total_engagement_points = (reading_section_points + primitive_points +
                                  visual_points + practice_points + completion_bonus)

        # Assemble complete package
        complete_package = {
            "id": package_id,
            "subskill_id": subskill_id,
            "content_source": "bigquery",  # Track source
            "generation_type": "authored_hybrid",  # Authored + dynamic practice
            "subject": subskill_metadata.get('subject', 'General Studies'),
            "unit": subskill_metadata.get('unit_title', 'Core Concepts'),
            "skill": subskill_metadata.get('skill_description', 'Fundamental Skills'),
            "subskill": subskill_metadata.get('subskill_description', ''),
            "master_context": master_context,
            "content": {
                "reading": reading_component_content,
                "practice": practice_content
            },
            "generation_metadata": {
                "generation_time_ms": None,
                "coherence_score": 1.0,  # High score for authored content
                "bigquery_version_id": foundations.get('version_id', 'active') if foundations else 'active',
                "has_authored_foundations": foundations is not None,
                "has_authored_reading": len(reading_content) > 0,
                "has_visual_snippets": len(visual_snippets) > 0,
                "has_visual_metadata": any('visual_metadata' in section for section in reading_sections),
                "total_engagement_points": total_engagement_points,
                "estimated_total_minutes": estimated_reading_minutes + estimated_practice_minutes
            },
            "partition_key": f"{subskill_metadata.get('subject', 'General')}-{subskill_metadata.get('unit_title', 'Core')}",
            "storage_metadata": {
                "updated_at": datetime.utcnow().isoformat(),
                "version": 1,
                "content_hash": str(uuid.uuid4())
            },
            "status": "approved",
            "document_type": "content_package",
            "created_at": datetime.utcnow().isoformat()
        }

        logger.info(f"✅ BigQuery package assembled: {package_id}")
        return complete_package

    def _group_primitives_by_type(self, primitives: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Group interactive primitives by type for frontend rendering.

        Frontend expects separate arrays: alerts, quizzes, definitions, etc.
        BigQuery stores them in one unified array with 'type' field.

        Args:
            primitives: List of primitive objects from BigQuery

        Returns:
            Dictionary with type-specific arrays (e.g., {'alerts': [...], 'quizzes': [...]})
        """
        grouped = {}

        # Map primitive type to frontend key (plural form)
        type_key_map = {
            'alert': 'alerts',
            'expandable': 'expandables',
            'quiz': 'quizzes',
            'definition': 'definitions',
            'checklist': 'checklists',
            'table': 'tables',
            'keyvalue': 'keyvalues',
            'interactive_timeline': 'interactive_timelines',
            'carousel': 'carousels',
            'flip_card': 'flip_cards',
            'categorization': 'categorization_activities',
            'fill_in_the_blank': 'fill_in_the_blanks',
            'scenario_question': 'scenario_questions',
            'tabbed_content': 'tabbed_content',
            'matching_activity': 'matching_activities',
            'sequencing_activity': 'sequencing_activities',
            'accordion': 'accordions'
        }

        for primitive in primitives:
            prim_type = primitive.get('type', '')
            frontend_key = type_key_map.get(prim_type)

            if frontend_key:
                if frontend_key not in grouped:
                    grouped[frontend_key] = []
                grouped[frontend_key].append(primitive)
            else:
                logger.warning(f"Unknown primitive type: {prim_type}")

        return grouped

    async def _find_existing_cosmos_package(self, subskill_id: str) -> Optional[Dict[str, Any]]:
        """
        TIER 2: Find existing content package in Cosmos DB

        Returns:
            Package dictionary if found, None otherwise
        """
        try:
            query = """
            SELECT * FROM c
            WHERE c.subskill_id = @subskill_id
            AND c.document_type = 'content_package'
            AND c.status = 'approved'
            """

            params = [{"name": "@subskill_id", "value": subskill_id}]

            results = list(self.cosmos_db.content_packages.query_items(
                query=query,
                parameters=params,
                enable_cross_partition_query=True
            ))

            if not results:
                return None

            # Prefer manual packages over dynamic, then BigQuery over dynamic
            manual_packages = [r for r in results if r.get('generation_type') == 'manual']
            if manual_packages:
                return manual_packages[0]

            bigquery_packages = [r for r in results if r.get('content_source') == 'bigquery']
            if bigquery_packages:
                return bigquery_packages[0]

            return results[0]

        except Exception as e:
            logger.error(f"Error finding existing package for {subskill_id}: {str(e)}")
            return None

    async def _get_subskill_context(self, subskill_id: str) -> Dict[str, Any]:
        """
        Get subskill context for dynamic generation

        Returns:
            Subskill context dictionary
        """
        if self.curriculum_service:
            metadata = await self.curriculum_service.get_subskill_metadata(subskill_id)
            if metadata:
                return {
                    "subskill_id": subskill_id,
                    "subject": metadata.get('subject', 'General Studies'),
                    "grade_level": metadata.get('grade', 'Elementary'),
                    "unit": metadata.get('unit_title', 'Core Concepts'),
                    "unit_id": metadata.get('unit_id'),
                    "skill": metadata.get('skill_description', 'Fundamental Skills'),
                    "skill_id": metadata.get('skill_id'),
                    "description": metadata.get('subskill_description', ''),
                    "difficulty_range": {
                        "start": metadata.get('difficulty_start', 3),
                        "end": metadata.get('difficulty_end', 6),
                        "target": metadata.get('target_difficulty', 5)
                    },
                    "prerequisites": []
                }

        # Fallback if curriculum service not available
        return self._create_fallback_context(subskill_id)

    def _create_fallback_context(self, subskill_id: str) -> Dict[str, Any]:
        """Create fallback context when curriculum data unavailable"""
        parts = subskill_id.split('-')
        subject_map = {
            "COUNT": "Mathematics",
            "READ": "Language Arts",
            "SCI": "Science",
            "SOC": "Social Studies"
        }

        subject_code = parts[1] if len(parts) > 1 else "GEN"
        subject = subject_map.get(subject_code[:5], "General Studies")

        return {
            "subskill_id": subskill_id,
            "subject": subject,
            "unit": "Core Concepts",
            "skill": "Fundamental Skills",
            "description": f"Learning objective for {subskill_id}",
            "difficulty_range": {"start": 3, "end": 6, "target": 5},
            "grade_level": "Elementary",
            "prerequisites": []
        }