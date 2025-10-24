"""
Publishing and version control API endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.core.security import require_admin
from app.services.version_control import version_control
from app.services.graph_cache_manager import graph_cache_manager
from app.models.versioning import (
    Version, DraftSummary,
    PublishRequest, PublishResponse
)

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
