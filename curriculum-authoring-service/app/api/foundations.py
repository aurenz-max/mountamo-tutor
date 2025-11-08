"""
Curriculum Foundations API endpoints - AI-generated foundational content management
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.foundations_service import foundations_service
from app.models.foundations import (
    FoundationsData,
    FoundationsGenerateRequest,
    FoundationsUpdateRequest,
    FoundationsResponse,
    FoundationsStatusResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== FOUNDATIONS ENDPOINTS ====================

@router.get("/subskills/{subskill_id}/foundations", response_model=FoundationsResponse)
async def get_subskill_foundations(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Get saved AI-generated foundations for a subskill.
    Returns 404 if no foundations exist yet.
    """
    logger.info(f"📖 GET foundations request for subskill {subskill_id}, version {version_id}")

    try:
        foundations = await foundations_service.get_foundations(subskill_id, version_id)

        if not foundations:
            raise HTTPException(
                status_code=404,
                detail=f"No foundations found for subskill {subskill_id}. Use the /generate endpoint to create them."
            )

        return FoundationsResponse(
            success=True,
            data=foundations,
            message="Foundations retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving foundations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve foundations: {str(e)}")


@router.post("/subskills/{subskill_id}/foundations/generate", response_model=FoundationsResponse)
async def generate_subskill_foundations(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Generate fresh AI foundations for a subskill.
    Does NOT save to database - returns fresh generation for review.

    Use this endpoint to:
    - Generate initial foundations for a new subskill
    - Regenerate foundations if educator wants to reset
    """
    logger.info(f"✨ GENERATE foundations request for subskill {subskill_id}, version {version_id}")

    try:
        foundations = await foundations_service.generate_foundations(subskill_id, version_id)

        return FoundationsResponse(
            success=True,
            data=foundations,
            message="Foundations generated successfully. Use the PUT endpoint to save them."
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating foundations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate foundations: {str(e)}")


@router.put("/subskills/{subskill_id}/foundations", response_model=FoundationsResponse)
async def save_subskill_foundations(
    subskill_id: str,
    version_id: str,
    request: FoundationsUpdateRequest
):
    """
    Save user-edited foundations for a subskill.
    Creates or updates the foundation record in the database.

    Marks the generation_status as 'edited' to indicate educator review.
    """
    logger.info(f"💾 PUT foundations request for subskill {subskill_id}, version {version_id}")

    try:
        foundations = await foundations_service.save_foundations(
            subskill_id=subskill_id,
            version_id=version_id,
            master_context=request.master_context,
            context_primitives=request.context_primitives,
            approved_visual_schemas=request.approved_visual_schemas if hasattr(request, 'approved_visual_schemas') else [],
            user_id="local-dev-user"  # TODO: Get from auth context
        )

        return FoundationsResponse(
            success=True,
            data=foundations,
            message="Foundations saved successfully"
        )

    except Exception as e:
        logger.error(f"Error saving foundations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save foundations: {str(e)}")


@router.delete("/subskills/{subskill_id}/foundations")
async def delete_subskill_foundations(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Delete foundations for a subskill.
    This will force regeneration on next access.
    """
    logger.info(f"🗑️ DELETE foundations request for subskill {subskill_id}, version {version_id}")

    try:
        success = await foundations_service.delete_foundations(subskill_id, version_id)

        if not success:
            raise HTTPException(status_code=404, detail="Foundations not found or could not be deleted")

        return {"success": True, "message": "Foundations deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting foundations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete foundations: {str(e)}")


@router.get("/subskills/{subskill_id}/foundations/status", response_model=FoundationsStatusResponse)
async def get_foundations_status(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum")
):
    """
    Check if foundations exist for a subskill without fetching full data.
    Useful for UI badges and status indicators.
    """
    logger.info(f"🔍 STATUS check for subskill {subskill_id}, version {version_id}")

    try:
        foundations = await foundations_service.get_foundations(subskill_id, version_id)

        if not foundations:
            return FoundationsStatusResponse(
                subskill_id=subskill_id,
                version_id=version_id,
                has_foundations=False
            )

        return FoundationsStatusResponse(
            subskill_id=subskill_id,
            version_id=version_id,
            has_foundations=True,
            generation_status=foundations.generation_status,
            last_updated=foundations.updated_at
        )

    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


# Visual schemas endpoint removed - visual content generation is now handled per-section
