from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
from ...core.session_manager import SessionManager
from ...services.visual_content_service import VisualContentService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter()

# Dependency to get the visual content service
# Modify this based on your dependency injection setup
async def get_visual_service():
    # This could be a singleton or retrieved from your service container
    return VisualContentService()  # Adjust based on your initialization

class SceneRequest(BaseModel):
    """Model for creating a new visual scene."""
    session_id: str
    object_type: str
    count: int = 1
    layout: str = "random"
    additional_props: Optional[Dict[str, Any]] = None

class MultiObjectSceneRequest(BaseModel):
    """Model for creating a scene with multiple different objects."""
    session_id: str
    object_counts: Dict[str, int]
    layout: str = "grid"
    title: Optional[str] = None
    description: Optional[str] = None
    

@router.get("/categories")
async def get_image_categories(
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Get a list of available image categories.
    """
    # Get all available images
    all_images = await visual_service.get_available_images()
    
    # Extract unique categories
    categories = set()
    for image_info in all_images.values():
        category = image_info.get("category", "")
        if category:
            categories.add(category)
    
    return {
        "status": "success",
        "categories": sorted(list(categories))
    }

@router.get("/images")
async def get_images(
    category: Optional[str] = None,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Get available images, optionally filtered by category.
    """
    images = await visual_service.get_available_images(category=category)
    
    # Format the response to include just the necessary metadata
    # (without the actual image data to keep the response small)
    image_list = []
    for image_id, image_info in images.items():
        image_list.append({
            "id": image_id,
            "name": image_info.get("name", ""),
            "category": image_info.get("category", ""),
            "type": image_info.get("type", "")
        })
    
    return {
        "status": "success",
        "images": image_list
    }

@router.get("/image/{image_id}")
async def get_image(
    image_id: str,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Get a specific image by ID, including its data URI.
    """
    image_data = await visual_service.get_image_content(image_id)
    
    if not image_data:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return {
        "status": "success",
        "image": image_data
    }

@router.post("/scene/counting")
async def create_counting_scene(
    request: SceneRequest,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Create a counting scene with multiple instances of the same object type.
    """
    scene = await visual_service.create_counting_scene(
        session_id=request.session_id,
        object_type=request.object_type,
        count=request.count,
        layout=request.layout,
        additional_props=request.additional_props
    )
    
    if scene.get("status") == "error":
        raise HTTPException(status_code=400, detail=scene.get("message", "Failed to create scene"))
    
    return scene

@router.post("/scene/multi-object")
async def create_multi_object_scene(
    request: MultiObjectSceneRequest,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Create a scene with multiple different types of objects.
    """
    scene = await visual_service.create_multi_object_scene(
        session_id=request.session_id,
        object_counts=request.object_counts,
        layout=request.layout,
        title=request.title,
        description=request.description
    )
    
    return scene

@router.get("/session/{session_id}/scenes")
async def get_session_scenes(
    session_id: str,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Get all active scenes for a session.
    """
    scenes = visual_service.get_active_content(session_id)
    
    return {
        "status": "success",
        "scenes": scenes
    }

@router.delete("/scene/{session_id}/{scene_id}")
async def delete_scene(
    session_id: str,
    scene_id: str,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Delete a specific scene.
    """
    result = visual_service.clear_content(session_id, scene_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    return {
        "status": "success",
        "message": f"Scene {scene_id} deleted successfully"
    }

@router.get("/debug/image-catalog-direct/{session_id}")
async def debug_image_catalog_direct(
    session_id: str,
    visual_service: VisualContentService = Depends(get_visual_service)
):
    """
    Debug endpoint to directly get information about the available images and categories.
    Does not require session manager access.
    """
    try:
        logger.info(f"Running direct image catalog debug for images related to session {session_id}")
        
        # Get all available images
        all_images = await visual_service.get_available_images(force_refresh=True)
        
        # Extract categories
        categories = set()
        for image_info in all_images.values():
            category = image_info.get("category", "")
            if category:
                categories.add(category)
        
        # Count images per category
        category_counts = {}
        for category in categories:
            category_images = {k: v for k, v in all_images.items() if v.get("category", "").lower() == category.lower()}
            category_counts[category] = len(category_images)
        
        # Get sample objects per category
        object_samples = {}
        for category in categories:
            category_images = {k: v for k, v in all_images.items() if v.get("category", "").lower() == category.lower()}
            if category_images:
                # Get sample names for this category (first 5)
                samples = [v.get("name", "") for v in list(category_images.values())[:5]]
                object_samples[category] = samples
        
        # Build debug info
        debug_info = {
            "session_id": session_id,
            "total_images": len(all_images),
            "total_categories": len(categories),
            "categories": sorted(list(categories)),
            "counts_per_category": category_counts,
            "object_samples": object_samples,
            "timestamp": str(datetime.datetime.utcnow().isoformat())
        }
        
        logger.info(f"Direct image catalog debug completed successfully")
        return {
            "status": "success",
            "message": "Image catalog debug information retrieved directly",
            "data": debug_info
        }
    except Exception as e:
        logger.error(f"Error directly debugging image catalog: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error debugging image catalog: {str(e)}")