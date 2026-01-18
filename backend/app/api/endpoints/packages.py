# backend/app/api/endpoints/packages.py
# DEPRECATED: This entire module is deprecated and will be removed in a future version.
# API endpoints for live discovery thread generation and content package orchestration

from fastapi import APIRouter, HTTPException, Depends, Path, BackgroundTasks
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import logging
from ...core.middleware import get_user_context
from ...services.engagement_service import engagement_service
from ...core.decorators import log_engagement_activity
from ...db.cosmos_db import CosmosDBService
from ...services.discovery_thread_service import DiscoveryThreadService
from ...dependencies import get_curriculum_service, get_problem_service
from ...services.curriculum_service import CurriculumService
from ...services.problems import ProblemService

logger = logging.getLogger(__name__)

# DEPRECATED: This entire router is deprecated and will be removed in a future version.
router = APIRouter(deprecated=True)
cosmos_db = CosmosDBService()

# Initialize discovery thread service
discovery_service = DiscoveryThreadService()

# Initialize content generation service (lazy load to avoid circular imports)
content_generator = None

def get_content_generator(curriculum_service=None):
    """Lazy initialization of content generation service with curriculum service dependency"""
    global content_generator
    if content_generator is None:
        try:
            from ...services.content_generation_service import ContentGenerationService
            content_generator = ContentGenerationService(curriculum_service=curriculum_service)
        except ImportError as e:
            logger.warning(f"Content generation service not available: {e}")
    return content_generator

# ============================================================================
# ENGAGEMENT METADATA EXTRACTORS
# ============================================================================

def _extract_package_completion_metadata(kwargs: dict, result: dict) -> dict:
    """Extracts metadata for a 'content_package_completed' activity."""
    request = kwargs.get('request')
    package_id = kwargs.get('package_id')
    return {
        "activity_name": f"Completed content package: {package_id}",
        "package_id": package_id,
        "sections_completed": request.sections_completed,
        "total_time_minutes": request.total_time_minutes
    }

def _extract_section_completion_metadata(kwargs: dict, result: dict) -> dict:
    """Extracts metadata for a 'content_package_section_completed' activity."""
    request = kwargs.get('request')
    package_id = kwargs.get('package_id')
    return {
        "activity_name": f"Completed section: {request.section_title}",
        "package_id": package_id,
        "section_title": request.section_title,
        "time_spent_minutes": request.time_spent_minutes
    }

def _extract_primitive_completion_metadata(kwargs: dict, result: dict) -> dict:
    """Extracts metadata for a 'content_package_primitive_completed' activity."""
    request = kwargs.get('request')
    return {
        "activity_name": f"Completed {request.primitive_type} in {request.section_title}",
        "package_id": request.package_id,
        "section_title": request.section_title,
        "primitive_type": request.primitive_type,
        "primitive_index": request.primitive_index,
        "score": request.score
    }

# Request models
class GenerateThreadsRequest(BaseModel):
    heading: str
    content: str

class PrimitiveCompletionRequest(BaseModel):
    package_id: str
    section_title: str
    primitive_type: str  # e.g., "matching_activity", "quiz", "categorization"
    primitive_index: int
    score: Optional[float] = None  # e.g., 0.8 for 80% correct

class GenerateVisualRequest(BaseModel):
    heading: str
    content: str
    subskill_id: Optional[str] = None  # 🆕 For auto-saving to Cosmos DB

class GenerateBulkThreadsRequest(BaseModel):
    sections: List[Dict[str, str]]  # List of {heading, content} objects

class GenerateWalkthroughThreadsRequest(BaseModel):
    heading: str
    content: str
    visual_type: Optional[str] = "interactive_demonstration"

# DEPRECATED: Discovery thread generation is being deprecated.
# Will be removed in a future version.
@router.post("/section/discovery-threads", deprecated=True)
async def generate_discovery_threads_for_section(
    request: GenerateThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Generate discovery threads for a single section on-demand

    Args:
        request: Section heading and content

    Returns:
        Discovery threads for the section
    """
    try:
        logger.info(f"🎯 User {user_context['email']} generating discovery threads for section: {request.heading[:50]}...")
        
        # Generate discovery threads for this section
        thread_data = await discovery_service.generate_discovery_threads(
            request.heading,
            request.content
        )
        
        logger.info(f"✅ Generated {len(thread_data['discovery_threads'])} discovery threads")
        
        return {
            "status": "success",
            "heading": thread_data["heading"],
            "discovery_threads": thread_data["discovery_threads"],
            "thread_count": len(thread_data["discovery_threads"])
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating discovery threads for section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating discovery threads: {str(e)}")

# DEPRECATED: Visual generation is being deprecated.
# Will be removed in a future version.
@router.post("/section/generate-visual", deprecated=True)
async def generate_visual_for_section(
    request: GenerateVisualRequest,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Generate an interactive visual demonstration for a single section using AI
    Also automatically saves to Cosmos DB if subskill_id is provided in request

    Args:
        request: Section heading and content (optionally subskill_id)

    Returns:
        HTML content for interactive visual demonstration
    """
    try:
        logger.info(f"🎨 User {user_context['email']} requesting visual for section: {request.heading[:50]}...")
        logger.info(f"📋 Request data: heading='{request.heading}', content_length={len(request.content)}, subskill_id='{request.subskill_id}'")
        
        # 🚀 EFFICIENCY: Check if concept already exists BEFORE generating
        existing_concept = None
        if request.subskill_id and request.subskill_id.strip():
            logger.info(f"🔍 Checking for existing visual concept...")
            try:
                existing_concept = await cosmos_db.get_visualize_concept_by_section(
                    request.subskill_id, 
                    request.heading, 
                    firebase_uid=None  # System-wide
                )
                if existing_concept:
                    logger.info(f"✅ EXISTING CONCEPT FOUND - returning cached visual (ID: {existing_concept.get('id')})")
                    return {
                        "status": "success",
                        "heading": request.heading,
                        "html_content": existing_concept.get("html_content", ""),
                        "saved_to_db": True,
                        "visualization_id": existing_concept.get("id"),
                        "from_cache": True
                    }
                else:
                    logger.info(f"🔍 No existing concept found - proceeding with generation")
            except Exception as check_error:
                logger.warning(f"⚠️ Error checking existing concept: {str(check_error)} - proceeding with generation")
        
        # Generate new visual content only if not found
        logger.info(f"🎨 Generating new visual content for section: {request.heading[:50]}...")
        html_content = await discovery_service.generate_visual_content(
            request.heading,
            request.content
        )
        logger.info(f"✅ Generated visual content for section: {request.heading[:50]}")
        
        # Save the newly generated content
        saved_concept = None
        if request.subskill_id and request.subskill_id.strip():
            try:
                logger.info(f"💾 Saving newly generated concept for subskill: '{request.subskill_id}'")
                saved_concept = await cosmos_db.save_visualize_concept(
                    subskill_id=request.subskill_id,
                    section_heading=request.heading,
                    section_content=request.content,
                    html_content=html_content,
                    firebase_uid=None  # System-wide, not per user
                )
                logger.info(f"✅ SAVE SUCCESS: new concept saved with ID: {saved_concept['id']}")
                
            except Exception as save_error:
                logger.error(f"❌ SAVE FAILED for subskill '{request.subskill_id}': {str(save_error)}")
        
        return {
            "status": "success",
            "heading": request.heading,
            "html_content": html_content,
            "saved_to_db": saved_concept is not None,
            "visualization_id": saved_concept["id"] if saved_concept else None,
            "from_cache": False
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating visual for section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating visual demonstration: {str(e)}")


# DEPRECATED: Visualize concepts retrieval is being deprecated.
# Will be removed in a future version.
@router.get("/visualize-concepts/{subskill_id}", deprecated=True)
async def get_visualize_concepts_by_subskill(
    subskill_id: str = Path(..., description="Curriculum subskill ID"),
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Get all saved visualize concepts for a specific subskill

    Args:
        subskill_id: Curriculum subskill identifier

    Returns:
        List of saved visualize concepts for the subskill
    """
    try:
        logger.info(f"🔍 User {user_context['email']} retrieving visualize concepts for subskill: {subskill_id}")
        
        concepts = await cosmos_db.get_visualize_concepts_by_subskill(
            subskill_id=subskill_id,
            firebase_uid=user_context.get('uid')
        )
        
        logger.info(f"✅ Found {len(concepts)} visualize concepts for subskill {subskill_id}")
        
        return {
            "status": "success",
            "subskill_id": subskill_id,
            "concepts": concepts,
            "count": len(concepts)
        }
        
    except Exception as e:
        logger.error(f"❌ Error retrieving visualize concepts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving visualize concepts: {str(e)}")

# DEPRECATED: Visualize concept retrieval is being deprecated.
# Will be removed in a future version.
@router.get("/visualize-concepts/{subskill_id}/{section_heading}", deprecated=True)
async def get_visualize_concept_by_section(
    subskill_id: str = Path(..., description="Curriculum subskill ID"),
    section_heading: str = Path(..., description="Section heading"),
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Get a specific visualize concept by subskill_id and section_heading

    Args:
        subskill_id: Curriculum subskill identifier
        section_heading: Section heading

    Returns:
        Specific visualize concept or null if not found
    """
    try:
        logger.info(f"🔍 User {user_context['email']} retrieving visualize concept for subskill: {subskill_id}, section: {section_heading}")
        
        concept = await cosmos_db.get_visualize_concept_by_section(
            subskill_id=subskill_id,
            section_heading=section_heading,
            firebase_uid=user_context.get('uid')
        )
        
        if concept:
            logger.info(f"✅ Found visualize concept for subskill {subskill_id}, section: {section_heading}")
            return {
                "status": "success",
                "concept": concept
            }
        else:
            return {
                "status": "not_found",
                "subskill_id": subskill_id,
                "section_heading": section_heading,
                "concept": None
            }
        
    except Exception as e:
        logger.error(f"❌ Error retrieving visualize concept: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving visualize concept: {str(e)}")

# DEPRECATED: Walkthrough thread generation is being deprecated.
# Will be removed in a future version.
@router.post("/section/walkthrough-threads", deprecated=True)
async def generate_walkthrough_threads_for_section(
    request: GenerateWalkthroughThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Generate walkthrough threads specifically for visual demonstrations

    Args:
        request: Section heading, content, and visual type

    Returns:
        Walkthrough threads focused on guiding users through visual content
    """
    try:
        logger.info(f"🎯 User {user_context['email']} generating walkthrough threads for visual: {request.heading[:50]}...")
        
        # Generate walkthrough threads for this visual demonstration
        thread_data = await discovery_service.generate_walkthrough_threads(
            request.heading,
            request.content,
            request.visual_type
        )
        
        logger.info(f"✅ Generated {len(thread_data['walkthrough_threads'])} walkthrough threads")
        
        return {
            "status": "success",
            "heading": thread_data["heading"],
            "walkthrough_threads": thread_data["walkthrough_threads"],
            "visual_type": request.visual_type,
            "thread_count": len(thread_data["walkthrough_threads"])
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating walkthrough threads for section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating walkthrough threads: {str(e)}")

# DEPRECATED: Bulk discovery thread generation is being deprecated.
# Will be removed in a future version.
@router.post("/bulk/discovery-threads", deprecated=True)
async def generate_bulk_discovery_threads(
    request: GenerateBulkThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Generate discovery threads for multiple sections at once

    Args:
        request: List of sections with heading and content

    Returns:
        Discovery threads for all sections
    """
    try:
        logger.info(f"🎯 User {user_context['email']} generating discovery threads for {len(request.sections)} sections")
        
        results = []
        
        for i, section in enumerate(request.sections):
            if not section.get('heading') or not section.get('content'):
                logger.warning(f"Skipping section {i} - missing heading or content")
                results.append({
                    "section_index": i,
                    "status": "skipped",
                    "error": "Missing heading or content"
                })
                continue
            
            try:
                # Generate discovery threads for this section
                thread_data = await discovery_service.generate_discovery_threads(
                    section['heading'],
                    section['content']
                )
                
                results.append({
                    "section_index": i,
                    "status": "success",
                    "heading": thread_data["heading"],
                    "discovery_threads": thread_data["discovery_threads"]
                })
                
            except Exception as section_error:
                logger.error(f"Error processing section {i}: {str(section_error)}")
                results.append({
                    "section_index": i,
                    "status": "error",
                    "error": str(section_error)
                })
        
        successful_sections = sum(1 for r in results if r["status"] == "success")
        logger.info(f"✅ Successfully processed {successful_sections}/{len(request.sections)} sections")
        
        return {
            "status": "success",
            "total_sections": len(request.sections),
            "successful_sections": successful_sections,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"❌ Error in bulk discovery thread generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating bulk discovery threads: {str(e)}")

# ============================================================================
# DEPRECATED ENDPOINTS - Content package generation
# ============================================================================

# DEPRECATED: Content package generation is being deprecated.
# Will be removed in a future version.
@router.get("/content-package/for-subskill/{subskill_id}", deprecated=True)
async def get_content_package_for_subskill(
    subskill_id: str = Path(..., description="Curriculum subskill ID"),
    user_context: dict = Depends(get_user_context),
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Get or generate content package for a specific curriculum subskill

    Implements 3-tier cascade orchestration:
    1. TIER 1: Check BigQuery for authored content
    2. TIER 2: Check Cosmos DB for cached/manual packages
    3. TIER 3: Trigger dynamic AI generation

    Args:
        subskill_id: Curriculum subskill identifier (e.g., "rec-COUNT001-01-A")

    Returns:
        {"packageId": "pkg_uuid_for_the_session"}
    """

    logger.info(f"🎯 User {user_context['email']} requesting content for subskill: {subskill_id}")

    try:
        # Initialize content generator with curriculum service dependency
        generator = get_content_generator(curriculum_service)
        if not generator:
            raise HTTPException(
                status_code=503,
                detail="Content generation service unavailable"
            )

        # Use the new 3-tier cascade orchestrator
        package_id = await generator.get_or_create_package_for_subskill(
            subskill_id=subskill_id,
            user_id=user_context.get("uid")
        )

        logger.info(f"✅ Content package ready: {package_id}")

        return {"packageId": package_id}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"❌ Error processing subskill {subskill_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Content generation failed: {str(e)}"
        )

# ============================================================================
# LEGACY HELPER FUNCTIONS (Deprecated - moved to ContentGenerationService)
# Kept for backward compatibility with debug/test endpoints
# ============================================================================

async def find_existing_package_for_subskill(subskill_id: str) -> Optional[Dict[str, Any]]:
    """
    [DEPRECATED] Find existing content package mapped to subskill ID

    This function is deprecated. New code should use:
    ContentGenerationService.get_or_create_package_for_subskill()

    Kept only for backward compatibility with test/debug endpoints.
    """
    try:
        # Query for packages with matching subskill_id (removed ORDER BY to avoid index issues)
        query = """
        SELECT * FROM c 
        WHERE c.subskill_id = @subskill_id
        AND c.document_type = 'content_package'
        AND c.status = 'approved'
        """
        
        params = [{"name": "@subskill_id", "value": subskill_id}]
        
        results = list(cosmos_db.content_packages.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        if not results:
            return None
            
        # If multiple results, prefer manual over dynamic generation
        manual_packages = [r for r in results if r.get('generation_type') == 'manual']
        if manual_packages:
            return manual_packages[0]
        else:
            return results[0]
        
    except Exception as e:
        logger.error(f"Error finding existing package for {subskill_id}: {str(e)}")
        return None

async def get_subskill_context_from_curriculum(subskill_id: str, curriculum_service: CurriculumService) -> Dict[str, Any]:
    """Get subskill context from curriculum service with proper curriculum data"""
    try:
        logger.info(f"🔍 Looking up curriculum data for subskill: {subskill_id}")
        
        # First, let's check if the BigQuery service is initialized
        if not curriculum_service.bigquery_service:
            logger.error(f"❌ BigQuery service not initialized on curriculum service")
            return create_subskill_context_fallback(subskill_id)
            
        # Check what data we have in the curriculum table first
        logger.info(f"🔍 Querying BigQuery project: {curriculum_service.bigquery_service.project_id}, dataset: {curriculum_service.bigquery_service.dataset_id}")
        
        # Let's first check if we have any data in the curriculum table
        sample_query = f"""
        SELECT subskill_id, subject, subskill_description
        FROM `{curriculum_service.bigquery_service.project_id}.{curriculum_service.bigquery_service.dataset_id}.curriculum`
        LIMIT 5
        """
        
        sample_results = await curriculum_service.bigquery_service.execute_query(sample_query)
        logger.info(f"📊 Sample curriculum data: {sample_results}")
        
        # Now try to find the specific subskill
        query = f"""
        SELECT 
            subject,
            grade,
            unit_id,
            unit_title,
            skill_id,
            skill_description,
            subskill_id,
            subskill_description,
            difficulty_start,
            difficulty_end,
            target_difficulty
        FROM `{curriculum_service.bigquery_service.project_id}.{curriculum_service.bigquery_service.dataset_id}.curriculum`
        WHERE subskill_id = @subskill_id
        LIMIT 1
        """
        
        from google.cloud import bigquery
        parameters = [bigquery.ScalarQueryParameter("subskill_id", "STRING", subskill_id)]
        
        logger.info(f"🔍 Executing query for subskill_id: {subskill_id}")
        results = await curriculum_service.bigquery_service.execute_query(query, parameters)
        logger.info(f"📊 Query results: {results}")
        
        if results and len(results) > 0:
            curriculum_data = results[0]
            logger.info(f"✅ Found curriculum data for subskill {subskill_id}: {curriculum_data['subject']} - {curriculum_data['subskill_description']}")
            
            return {
                "subskill_id": subskill_id,
                "subject": curriculum_data['subject'],
                "grade_level": curriculum_data.get('grade', 'Elementary'),
                "unit": curriculum_data['unit_title'],
                "unit_id": curriculum_data['unit_id'],
                "skill": curriculum_data['skill_description'],
                "skill_id": curriculum_data['skill_id'],
                "description": curriculum_data['subskill_description'],
                "difficulty_range": {
                    "start": curriculum_data.get('difficulty_start', 3),
                    "end": curriculum_data.get('difficulty_end', 6),
                    "target": curriculum_data.get('target_difficulty', 5)
                },
                "prerequisites": []  # Could be enhanced to lookup prerequisites
            }
        else:
            logger.warning(f"⚠️ No curriculum data found for subskill {subskill_id}, using fallback")
            # Fall back to the old logic if not found
            return create_subskill_context_fallback(subskill_id)
            
    except Exception as e:
        logger.error(f"❌ Error getting curriculum data for {subskill_id}: {str(e)}", exc_info=True)
        # Fall back to the old logic if error occurs
        return create_subskill_context_fallback(subskill_id)

def create_subskill_context_fallback(subskill_id: str) -> Dict[str, Any]:
    """Create subskill context from ID (fallback when curriculum service fails)"""
    # Parse the subskill ID to extract components
    parts = subskill_id.split('-')
    if len(parts) >= 2:
        subject_code = parts[1] if len(parts) > 1 else "GEN"
        
        # Map common subject codes
        subject_map = {
            "COUNT": "Mathematics", 
            "READ": "Language Arts",
            "SCI": "Science",
            "SOC": "Social Studies"
        }
        
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
    else:
        # Very basic fallback
        return {
            "subskill_id": subskill_id,
            "subject": "General Studies",
            "unit": "Learning",
            "skill": "Core Skills",
            "description": f"Educational content for {subskill_id}",
            "difficulty_range": {"start": 3, "end": 6, "target": 5},
            "grade_level": "Elementary",
            "prerequisites": []
        }

# ============================================================================
# DEPRECATED ENDPOINTS - Testing and debug
# ============================================================================

# DEPRECATED: Debug endpoints are being deprecated.
# Will be removed in a future version.
@router.get("/debug/curriculum/{subskill_id}", deprecated=True)
async def debug_curriculum_lookup(
    subskill_id: str = Path(..., description="Subskill ID to look up"),
    curriculum_service: CurriculumService = Depends(get_curriculum_service),
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Debug endpoint to test curriculum service lookup
    """
    logger.info(f"🐛 User {user_context['email']} debugging curriculum lookup for: {subskill_id}")
    
    try:
        # Test the function directly
        context = await get_subskill_context_from_curriculum(subskill_id, curriculum_service)
        
        return {
            "status": "success",
            "subskill_id": subskill_id,
            "context_found": context,
            "bigquery_project": curriculum_service.bigquery_service.project_id,
            "bigquery_dataset": curriculum_service.bigquery_service.dataset_id,
            "service_initialized": curriculum_service.bigquery_service is not None
        }
        
    except Exception as e:
        logger.error(f"❌ Debug curriculum lookup failed: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "subskill_id": subskill_id,
            "error": str(e),
            "bigquery_project": getattr(curriculum_service.bigquery_service, 'project_id', 'Not available'),
            "bigquery_dataset": getattr(curriculum_service.bigquery_service, 'dataset_id', 'Not available'),
            "service_initialized": curriculum_service.bigquery_service is not None if hasattr(curriculum_service, 'bigquery_service') else False
        }

# DEPRECATED: Test package generation is being deprecated.
# Will be removed in a future version.
@router.post("/test-generate-package", deprecated=True)
async def test_generate_package(
    user_context: dict = Depends(get_user_context),
    curriculum_service: CurriculumService = Depends(get_curriculum_service),
    test_subskill_id: str = "test-MATH-001-A",
    subject: str = "Mathematics"
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Test endpoint for package generation - useful for debugging

    Args:
        test_subskill_id: Test subskill ID to generate content for
        subject: Subject for the test package

    Returns:
        Complete generated package with save status
    """
    
    logger.info(f"🧪 User {user_context['email']} testing package generation for: {test_subskill_id}")
    
    try:
        generator = get_content_generator()
        if not generator:
            raise HTTPException(
                status_code=503,
                detail="Content generation service unavailable"
            )
        
        # Get subskill context from curriculum service (or create test context if not found)
        try:
            test_context = await get_subskill_context_from_curriculum(test_subskill_id, curriculum_service)
            logger.info(f"🧪 Using curriculum data for test: {test_context['subject']} - {test_context['description']}")
        except Exception as e:
            logger.warning(f"⚠️ Could not get curriculum data for test, using manual context: {e}")
            test_context = {
                "subskill_id": test_subskill_id,
                "subject": subject,
                "unit": "Test Unit",
                "skill": "Test Skill",
                "description": f"Test learning objective for {test_subskill_id}",
                "difficulty_range": {"start": 3, "end": 6, "target": 5},
                "grade_level": "Elementary",
                "prerequisites": []
            }
        
        # Generate the package
        new_package = await generator.generate_package_from_subskill(
            test_subskill_id, test_context
        )
        
        # Verify it was saved by trying to retrieve it
        saved_package = await find_existing_package_for_subskill(test_subskill_id)
        
        return {
            "status": "success",
            "message": f"Test package generated and saved successfully",
            "package_id": new_package["id"],
            "subskill_id": test_subskill_id,
            "saved_to_cosmos": saved_package is not None,
            "package_structure": {
                "has_master_context": "master_context" in new_package,
                "has_reading": "reading" in new_package.get("content", {}),
                "has_practice": "practice" in new_package.get("content", {}),
                "reading_sections": len(new_package.get("content", {}).get("reading", {}).get("sections", [])),
                "practice_problems": len(new_package.get("content", {}).get("practice", {}).get("problems", []))
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Test package generation failed: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Test generation failed: {str(e)}",
            "package_id": None,
            "subskill_id": test_subskill_id,
            "saved_to_cosmos": False
        }

# DEPRECATED: Package verification is being deprecated.
# Will be removed in a future version.
@router.get("/verify-package/{package_id}", deprecated=True)
async def verify_package_in_cosmos(
    package_id: str = Path(..., description="Package ID to verify"),
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Verify if a package exists in CosmosDB and return its structure

    Args:
        package_id: The package ID to verify

    Returns:
        Package verification details
    """
    
    logger.info(f"🔍 User {user_context['email']} verifying package: {package_id}")
    
    try:
        # Query CosmosDB directly
        query = """
        SELECT * FROM c 
        WHERE c.id = @package_id 
        AND c.document_type = 'content_package'
        """
        
        params = [{"name": "@package_id", "value": package_id}]
        
        results = list(cosmos_db.content_packages.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        if results:
            package = results[0]
            return {
                "status": "found",
                "package_id": package_id,
                "exists_in_cosmos": True,
                "subskill_id": package.get("subskill_id"),
                "generation_type": package.get("generation_type"),
                "subject": package.get("subject"),
                "created_at": package.get("created_at"),
                "structure": {
                    "has_master_context": "master_context" in package,
                    "has_reading": "reading" in package.get("content", {}),
                    "has_practice": "practice" in package.get("content", {}),
                    "has_visual": "visual" in package.get("content", {}),
                    "has_audio": "audio" in package.get("content", {}),
                    "content_keys": list(package.get("content", {}).keys())
                }
            }
        else:
            return {
                "status": "not_found",
                "package_id": package_id,
                "exists_in_cosmos": False,
                "message": "Package not found in CosmosDB"
            }
            
    except Exception as e:
        logger.error(f"❌ Error verifying package {package_id}: {str(e)}")
        return {
            "status": "error",
            "package_id": package_id,
            "exists_in_cosmos": False,
            "error": str(e)
        }

# DEPRECATED: List generated packages is being deprecated.
# Will be removed in a future version.
@router.get("/list-generated-packages", deprecated=True)
async def list_generated_packages(
    user_context: dict = Depends(get_user_context),
    limit: int = 10
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    List recently generated packages for debugging

    Returns:
        List of dynamically generated packages
    """
    
    logger.info(f"📋 User {user_context['email']} listing generated packages")
    
    try:
        query = """
        SELECT c.id, c.subskill_id, c.generation_type, c.subject, c.created_at 
        FROM c 
        WHERE c.document_type = 'content_package'
        AND c.generation_type = 'dynamic'
        ORDER BY c.created_at DESC
        OFFSET 0 LIMIT @limit
        """
        
        params = [{"name": "@limit", "value": limit}]
        
        results = list(cosmos_db.content_packages.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return {
            "status": "success",
            "generated_packages": results,
            "count": len(results)
        }
        
    except Exception as e:
        logger.error(f"❌ Error listing generated packages: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "generated_packages": [],
            "count": 0
        }

# ============================================================================
# DEPRECATED ENDPOINTS - Health check
# ============================================================================

# DEPRECATED: Health check is being deprecated along with this module.
# Will be removed in a future version.
@router.get("/health", deprecated=True)
async def discovery_threads_health_check():
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Health check for live discovery threads service
    """
    try:
        # Test the discovery service with a simple example
        test_result = await discovery_service.generate_discovery_threads(
            "Test Section: Understanding Gravity", 
            "Gravity is a fundamental force that attracts objects with mass toward each other. On Earth, gravity pulls everything toward the planet's center, which is why objects fall down when dropped."
        )
        
        service_healthy = len(test_result.get('discovery_threads', [])) > 0
        
        return {
            "status": "healthy" if service_healthy else "degraded",
            "service": "live_discovery_threads",
            "model": "gemini-2.5-flash-lite",
            "discovery_service": "operational" if service_healthy else "limited",
            "features": {
                "live_thread_generation": service_healthy,
                "single_section_api": True,
                "bulk_generation_api": True,
                "tool_calling_json": True
            },
            "test_result": {
                "threads_generated": len(test_result.get('discovery_threads', [])),
                "sample_thread": test_result.get('discovery_threads', [''])[0] if test_result.get('discovery_threads') else None
            }
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "live_discovery_threads",
            "error": str(e)
        }

# ============================================================================
# DEPRECATED ENDPOINTS - Package completion and engagement
# ============================================================================

# DEPRECATED: These models are used by deprecated engagement endpoints.
# Will be removed in a future version.
class SectionCompletionRequest(BaseModel):
    section_title: str
    time_spent_minutes: Optional[int] = None

class PackageCompletionRequest(BaseModel):
    sections_completed: int
    total_time_minutes: Optional[int] = None

# DEPRECATED: Primitive completion is being deprecated.
# Will be removed in a future version.
# IMPORTANT: Primitive completion route must come BEFORE parameterized routes
# to avoid FastAPI matching "/primitives/complete" as "/{package_id}/complete"
@router.post("/primitives/complete", deprecated=True)
@log_engagement_activity(
    activity_type="content_package_primitive_completed",
    metadata_extractor=_extract_primitive_completion_metadata
)
async def complete_primitive(
    request: PrimitiveCompletionRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Mark a content package interactive primitive as completed. XP is handled automatically.
    """
    try:
        student_id = user_context["student_id"]
        logger.info(f"Primitive {request.primitive_type} completed in package {request.package_id} by student {student_id}")
        
        # Base XP for primitive completion - varies by type and score
        base_xp = 5  # Base amount for completing any primitive
        
        # Bonus for high performance
        if request.score and request.score >= 0.8:  # 80% or higher
            base_xp = 10
        
        return {
            "success": True,
            "package_id": request.package_id,
            "primitive_type": request.primitive_type,
            "message": f"{request.primitive_type} completed! XP earned!",
        }
        
    except Exception as e:
        logger.error(f"Error completing primitive: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# DEPRECATED: Section completion is being deprecated.
# Will be removed in a future version.
@router.post("/{package_id}/sections/complete", deprecated=True)
@log_engagement_activity(
    activity_type="content_package_section_completed",
    metadata_extractor=_extract_section_completion_metadata
)
async def complete_package_section(
    package_id: str,
    request: SectionCompletionRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Mark a content package section as completed. XP is handled automatically.
    """
    try:
        student_id = user_context["student_id"]
        logger.info(f"Section '{request.section_title}' completed in package {package_id} by student {student_id}")
        
        # The endpoint is now ONLY responsible for the section completion logic
        return {
            "success": True,
            "package_id": package_id,
            "section_title": request.section_title,
            "message": f"Section '{request.section_title}' completed successfully!",
        }
        
    except Exception as e:
        logger.error(f"Error completing section in package {package_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# DEPRECATED: Package completion is being deprecated.
# Will be removed in a future version.
@router.post("/{package_id}/complete", deprecated=True)
@log_engagement_activity(
    activity_type="content_package_completed",
    metadata_extractor=_extract_package_completion_metadata
)
async def complete_package(
    package_id: str,
    request: PackageCompletionRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context)
):
    """
    DEPRECATED: This endpoint is deprecated and will be removed in a future version.

    Mark an entire content package as completed. Bonus XP is handled automatically.
    """
    try:
        student_id = user_context["student_id"]
        logger.info(f"Package {package_id} completed by student {student_id}")
        
        # The endpoint's logic is now trivial.
        return {
            "success": True,
            "package_id": package_id,
            "message": f"Package completed! Bonus XP awarded for mastering all content!",
        }
        
    except Exception as e:
        logger.error(f"Error completing package {package_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))