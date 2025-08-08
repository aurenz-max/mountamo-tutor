# backend/app/services/content_generation_service.py

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from ..db.cosmos_db import CosmosDBService
from ..generators.master_context import MasterContextGenerator
from ..generators.reading_content import ReadingContentGenerator  
from ..generators.practice_problems import PracticeProblemsGenerator
from ..generators.content import ContentGenerationRequest, DifficultyLevel

logger = logging.getLogger(__name__)

class ContentGenerationService:
    """Service to orchestrate content package generation from subskill information"""
    
    def __init__(self):
        self.cosmos_db = CosmosDBService()
        
        # Initialize generators
        self.master_context_generator = MasterContextGenerator(cosmos_service=self.cosmos_db)
        self.reading_generator = ReadingContentGenerator(cosmos_service=self.cosmos_db)
        self.practice_generator = PracticeProblemsGenerator(cosmos_service=self.cosmos_db)
    
    async def generate_package_from_subskill(
        self, 
        subskill_id: str,
        subskill_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a complete content package for a subskill"""
        
        logger.info(f"🎯 Starting package generation for subskill: {subskill_id}")
        
        try:
            # Generate package ID
            package_id = f"pkg_{int(datetime.now().timestamp())}"
            
            # Create content generation request from subskill context
            request = self._build_generation_request(subskill_context)
            
            # Step 1: Generate master context (foundation)
            logger.info("📋 Generating master context...")
            master_context = await self.master_context_generator.generate_master_context(request)
            
            # Step 2: Generate reading content
            logger.info("📖 Generating reading content...")
            reading_component = await self.reading_generator.generate_reading_content(
                request, master_context, package_id
            )
            
            # Step 3: Generate practice problems
            logger.info("🧩 Generating practice problems...")
            # Create minimal visual component for practice generator (it expects one)
            minimal_visual_comp = type('obj', (object,), {
                'content': {
                    'interactive_elements': ['Interactive demonstration'],
                    'concepts_demonstrated': master_context.core_concepts
                }
            })()
            
            practice_component = await self.practice_generator.generate_practice_problems(
                request, master_context, reading_component, minimal_visual_comp, package_id
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