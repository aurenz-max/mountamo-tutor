"""
Publishing and version control API endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from app.core.security import require_admin
from app.services.version_control import version_control
from app.services.graph_cache_manager import graph_cache_manager
from app.services.curriculum_manager import curriculum_manager
from app.models.versioning import (
    Version, DraftSummary,
    PublishRequest, PublishResponse
)
from app.models.curriculum import FlattenedCurriculumRow

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/subjects/{subject_id}/draft-changes", response_model=DraftSummary)
async def get_draft_changes(
    subject_id: str
):
    """Get summary of all draft changes for a subject"""
    return await version_control.get_draft_changes(subject_id)


@router.post("/subjects/{subject_id}/publish", response_model=PublishResponse)
async def publish_subject(
    subject_id: str,
    publish_request: PublishRequest
):
    """Publish all draft changes for a subject"""
    try:
        # Publish the curriculum changes
        result = await version_control.publish(
            publish_request,
            "local-dev-user"
        )

        # Regenerate both draft and published graph caches
        logger.info(f"🔄 Triggering graph regeneration after publish for {subject_id}")
        try:
            await graph_cache_manager.regenerate_all_versions(subject_id)
            logger.info(f"✅ Graph regeneration complete")
        except Exception as e:
            # Log error but don't fail the publish operation
            logger.error(f"⚠️ Graph regeneration failed (non-critical): {e}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/versions", response_model=List[Version])
async def get_version_history(
    subject_id: str
):
    """Get version history for a subject"""
    return await version_control.get_version_history(subject_id)


@router.get("/subjects/{subject_id}/active-version", response_model=Version)
async def get_active_version(
    subject_id: str
):
    """Get currently active version for a subject"""
    version = await version_control.get_active_version(subject_id)
    if not version:
        raise HTTPException(status_code=404, detail="No active version found")
    return version


@router.post("/subjects/{subject_id}/rollback/{version_id}", response_model=PublishResponse)
async def rollback_version(
    subject_id: str,
    version_id: str
):
    """Rollback to a previous version"""
    try:
        # Rollback to the specified version
        result = await version_control.rollback_to_version(
            subject_id,
            version_id,
            "local-dev-user"
        )

        # Regenerate graph caches after rollback
        logger.info(f"🔄 Triggering graph regeneration after rollback for {subject_id}")
        try:
            await graph_cache_manager.regenerate_all_versions(subject_id)
            logger.info(f"✅ Graph regeneration complete")
        except Exception as e:
            # Log error but don't fail the rollback operation
            logger.error(f"⚠️ Graph regeneration failed (non-critical): {e}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/flattened-view", response_model=List[FlattenedCurriculumRow])
async def get_flattened_curriculum_view(
    subject_id: str,
    version_id: Optional[str] = None
):
    """
    Get flattened curriculum view matching BigQuery analytics view structure.

    This endpoint returns the curriculum in a flattened format that matches
    the structure used by the analytics view in the tutoring application.

    - Returns only published content (is_draft=false, is_active=true)
    - If version_id is not provided, returns the active version
    - Each row represents one subskill with its complete hierarchy path
    - Ordered by unit_order, skill_order, subskill_order

    This view is useful for:
    - Validating published curriculum structure
    - Previewing what the tutoring app will consume
    - Exporting curriculum data for documentation
    - Comparing different published versions
    """
    try:
        rows = await curriculum_manager.get_flattened_curriculum_view(
            subject_id=subject_id,
            version_id=version_id
        )

        if not rows:
            logger.warning(f"No flattened curriculum data found for subject {subject_id}")

        return rows

    except Exception as e:
        logger.error(f"Error fetching flattened curriculum view: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch flattened view: {str(e)}")
