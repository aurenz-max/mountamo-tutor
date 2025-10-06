"""
Publishing and version control API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.core.security import require_admin
from app.services.version_control import version_control
from app.models.versioning import (
    Version, DraftSummary,
    PublishRequest, PublishResponse
)

router = APIRouter()


@router.get("/subjects/{subject_id}/draft-changes", response_model=DraftSummary)
async def get_draft_changes(
    subject_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get summary of all draft changes for a subject"""
    return await version_control.get_draft_changes(subject_id)


@router.post("/subjects/{subject_id}/publish", response_model=PublishResponse)
async def publish_subject(
    subject_id: str,
    publish_request: PublishRequest,
    current_user: dict = Depends(require_admin)
):
    """Publish all draft changes for a subject (requires admin role)"""
    try:
        return await version_control.publish(
            publish_request,
            current_user["user_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/versions", response_model=List[Version])
async def get_version_history(
    subject_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get version history for a subject"""
    return await version_control.get_version_history(subject_id)


@router.get("/subjects/{subject_id}/active-version", response_model=Version)
async def get_active_version(
    subject_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get currently active version for a subject"""
    version = await version_control.get_active_version(subject_id)
    if not version:
        raise HTTPException(status_code=404, detail="No active version found")
    return version


@router.post("/subjects/{subject_id}/rollback/{version_id}", response_model=PublishResponse)
async def rollback_version(
    subject_id: str,
    version_id: str,
    current_user: dict = Depends(require_admin)
):
    """Rollback to a previous version (requires admin role)"""
    try:
        return await version_control.rollback_to_version(
            subject_id,
            version_id,
            current_user["user_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
