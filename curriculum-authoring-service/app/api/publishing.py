"""
Publishing, version control, and graph flattening API endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.services.version_control import version_control
from app.services.curriculum_manager import curriculum_manager
from app.services.graph_flattening import graph_flattening_service
from app.db.firestore_curriculum_service import firestore_curriculum_sync
from app.models.versioning import (
    Version, DraftSummary,
    PublishRequest, PublishResponse
)
from app.models.curriculum import FlattenedCurriculumRow

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/subjects/{subject_id}/draft-changes", response_model=DraftSummary)
async def get_draft_changes(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)")
):
    """Get summary of all draft changes for a subject"""
    return await version_control.get_draft_changes(grade=grade, subject_id=subject_id)


@router.post("/subjects/{subject_id}/publish", response_model=PublishResponse)
async def publish_subject(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)"),
    publish_request: PublishRequest = None
):
    """Publish all draft changes for a subject.

    Single atomic operation:
      1. Copy draft → curriculum_published (lineage-validated, accepted units only)
      2. Publish graph edges (set is_draft=False)
      3. Update version record
      4. Rebuild flat graph cache for Pulse/LearningPaths

    subject_id from the URL path is authoritative.
    """
    if publish_request is None:
        publish_request = PublishRequest()
    publish_request.subject_id = subject_id

    try:
        # 1. Version bookkeeping + edge publishing
        result = await version_control.publish(publish_request, "local-dev-user", grade=grade)

        # 2. Deploy draft → curriculum_published (lineage-validated)
        await curriculum_manager.deploy_curriculum_to_firestore(
            grade=grade,
            subject_id=subject_id,
            deployed_by="auto-publish"
        )

        # 3. Rebuild flat graph cache (what Pulse/LearningPaths actually read)
        try:
            graph_flattening_service.rebuild_cache(subject_id, published_only=True)
            graph_flattening_service.rebuild_cache(subject_id, published_only=False)
        except Exception as e:
            logger.error(f"Graph cache rebuild failed (non-critical): {e}")

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/versions", response_model=List[Version])
async def get_version_history(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)")
):
    """Get version history for a subject"""
    return await version_control.get_version_history(grade=grade, subject_id=subject_id)


@router.get("/subjects/{subject_id}/active-version", response_model=Version)
async def get_active_version(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)")
):
    """Get currently active version for a subject"""
    version = await version_control.get_active_version(grade=grade, subject_id=subject_id)
    if not version:
        raise HTTPException(status_code=404, detail="No active version found")
    return version


@router.post("/subjects/{subject_id}/rollback/{version_id}", response_model=PublishResponse)
async def rollback_version(
    subject_id: str,
    version_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)")
):
    """Rollback to a previous version"""
    try:
        result = await version_control.rollback_to_version(
            grade, subject_id, version_id, "local-dev-user"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subjects/{subject_id}/flattened-view", response_model=List[FlattenedCurriculumRow])
async def get_flattened_curriculum_view(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)"),
    version_id: Optional[str] = None
):
    """Get flattened curriculum view — one row per subskill with full hierarchy path."""
    try:
        rows = await curriculum_manager.get_flattened_curriculum_view(
            grade=grade,
            subject_id=subject_id,
            version_id=version_id
        )
        return rows
    except Exception as e:
        logger.error(f"Error fetching flattened curriculum view: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch flattened view: {str(e)}")


# ==================== Graph Flattening / Cache Rebuild ====================


@router.post("/subjects/{subject_id}/flatten")
async def flatten_and_cache_graph(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)"),
    published_only: bool = True,
):
    """Rebuild the flat graph cache from the hierarchical Firestore graph.

    Automatically called after publish, but can be triggered manually.
    """
    try:
        result = graph_flattening_service.rebuild_cache(subject_id, published_only)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not resolve graph for {subject_id} — check that edges exist"
            )

        metadata = result.get("metadata", {})
        return {
            "success": True,
            "subject_id": subject_id,
            "cache_doc_id": result["id"],
            "nodes": metadata.get("entity_counts", {}),
            "edges": metadata.get("edge_counts", {}),
            "generated_at": result["generated_at"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rebuilding graph cache for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subjects/{subject_id}/flatten/preview")
async def preview_flattened_graph(
    subject_id: str,
    grade: str = Query(..., description="Grade (e.g. Kindergarten, 1)"),
    published_only: bool = True,
):
    """Preview the flattened graph without writing to cache."""
    try:
        result = graph_flattening_service.flatten_graph(subject_id, published_only)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Could not resolve graph for {subject_id}"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing flattened graph for {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
