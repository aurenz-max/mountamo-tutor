# backend/app/api/endpoints/packages.py
# API endpoints for live discovery thread generation

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import logging
from ...core.middleware import get_user_context
from ...db.cosmos_db import CosmosDBService
from ...services.discovery_thread_service import DiscoveryThreadService

logger = logging.getLogger(__name__)

router = APIRouter()
cosmos_db = CosmosDBService()

# Initialize discovery thread service
discovery_service = DiscoveryThreadService()

# Request models
class GenerateThreadsRequest(BaseModel):
    heading: str
    content: str

class GenerateVisualRequest(BaseModel):
    heading: str
    content: str

class GenerateBulkThreadsRequest(BaseModel):
    sections: List[Dict[str, str]]  # List of {heading, content} objects

class GenerateWalkthroughThreadsRequest(BaseModel):
    heading: str
    content: str
    visual_type: Optional[str] = "interactive_demonstration"

@router.post("/section/discovery-threads")
async def generate_discovery_threads_for_section(
    request: GenerateThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
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

@router.post("/section/generate-visual")
async def generate_visual_for_section(
    request: GenerateVisualRequest,
    user_context: dict = Depends(get_user_context)
):
    """
    Generate an interactive visual demonstration for a single section using AI
    
    Args:
        request: Section heading and content
        
    Returns:
        HTML content for interactive visual demonstration
    """
    try:
        logger.info(f"🎨 User {user_context['email']} generating visual for section: {request.heading[:50]}...")
        
        # Generate visual content using discovery service
        html_content = await discovery_service.generate_visual_content(
            request.heading,
            request.content
        )
        
        logger.info(f"✅ Generated visual content for section: {request.heading[:50]}")
        
        return {
            "status": "success",
            "heading": request.heading,
            "html_content": html_content
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating visual for section: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating visual demonstration: {str(e)}")

@router.post("/section/walkthrough-threads")
async def generate_walkthrough_threads_for_section(
    request: GenerateWalkthroughThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
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

@router.post("/bulk/discovery-threads")
async def generate_bulk_discovery_threads(
    request: GenerateBulkThreadsRequest,
    user_context: dict = Depends(get_user_context)
):
    """
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

# Health check for the discovery threads service
@router.get("/health")
async def discovery_threads_health_check():
    """Health check for live discovery threads service"""
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