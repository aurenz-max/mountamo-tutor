"""
Curriculum graph API endpoints - cached graph retrieval and management
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from app.services.graph_cache_manager import graph_cache_manager
from app.models.prerequisites import PrerequisiteGraph

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/graph/{subject_id}", response_model=PrerequisiteGraph)
async def get_curriculum_graph(
    subject_id: str,
    include_drafts: bool = Query(default=False, description="Include draft entities in graph"),
    force_refresh: bool = Query(default=False, description="Force regeneration of graph")
):
    """
    Get curriculum prerequisite graph for a subject

    Returns cached version if available, otherwise generates and caches.
    Use force_refresh=true to bypass cache and regenerate.

    **Performance:**
    - Cached: ~50ms
    - Fresh generation: ~2-5s (depending on curriculum size)
    """
    try:
        logger.info(f"📊 GET /graph/{subject_id} (drafts={include_drafts}, refresh={force_refresh})")

        graph = await graph_cache_manager.get_graph(
            subject_id=subject_id,
            include_drafts=include_drafts,
            force_refresh=force_refresh
        )

        return graph

    except Exception as e:
        logger.error(f"❌ Error getting graph: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve curriculum graph: {str(e)}"
        )


@router.post("/graph/{subject_id}/regenerate")
async def regenerate_curriculum_graph(
    subject_id: str,
    include_drafts: bool = Query(default=False, description="Include draft entities")
):
    """
    Force regeneration of curriculum graph

    Invalidates cache and rebuilds graph from BigQuery.
    Use this after making significant curriculum changes.
    """
    try:
        logger.info(f"🔄 POST /graph/{subject_id}/regenerate (drafts={include_drafts})")

        graph = await graph_cache_manager.regenerate_graph(
            subject_id=subject_id,
            include_drafts=include_drafts
        )

        return {
            "message": "Graph regenerated successfully",
            "subject_id": subject_id,
            "include_drafts": include_drafts,
            "node_count": len(graph.nodes),
            "edge_count": len(graph.edges)
        }

    except Exception as e:
        logger.error(f"❌ Error regenerating graph: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate graph: {str(e)}"
        )


@router.post("/graph/{subject_id}/regenerate-all")
async def regenerate_all_graph_versions(
    subject_id: str
):
    """
    Regenerate both draft and published graph versions

    Use this after publishing curriculum changes to ensure both
    draft and published caches are up to date.
    """
    try:
        logger.info(f"🔄 POST /graph/{subject_id}/regenerate-all")

        graphs = await graph_cache_manager.regenerate_all_versions(subject_id)

        return {
            "message": "All graph versions regenerated successfully",
            "subject_id": subject_id,
            "published": {
                "node_count": len(graphs["published"].nodes),
                "edge_count": len(graphs["published"].edges)
            },
            "draft": {
                "node_count": len(graphs["draft"].nodes),
                "edge_count": len(graphs["draft"].edges)
            }
        }

    except Exception as e:
        logger.error(f"❌ Error regenerating all graphs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate all graph versions: {str(e)}"
        )


@router.delete("/graph/{subject_id}/cache")
async def invalidate_graph_cache(
    subject_id: str,
    version_type: str = Query(
        default=None,
        description="Version type to invalidate: 'draft', 'published', or None for both"
    )
):
    """
    Invalidate cached graphs for a subject

    Removes cached graph documents from Firestore.
    Next request will trigger fresh generation.
    """
    try:
        logger.info(f"🗑️ DELETE /graph/{subject_id}/cache (version_type={version_type})")

        deleted_count = await graph_cache_manager.invalidate_cache(
            subject_id=subject_id,
            version_type=version_type
        )

        return {
            "message": f"Invalidated {deleted_count} cached graph(s)",
            "subject_id": subject_id,
            "version_type": version_type,
            "deleted_count": deleted_count
        }

    except Exception as e:
        logger.error(f"❌ Error invalidating cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to invalidate cache: {str(e)}"
        )


@router.get("/graph/{subject_id}/status")
async def get_graph_cache_status(
    subject_id: str
):
    """
    Get cache status information for a subject

    Returns information about:
    - Cached versions (draft/published)
    - Generation timestamps
    - Last access times
    - Metadata (node counts, edge counts)
    """
    try:
        logger.info(f"📊 GET /graph/{subject_id}/status")

        status = await graph_cache_manager.get_cache_status(subject_id)

        return status

    except Exception as e:
        logger.error(f"❌ Error getting cache status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache status: {str(e)}"
        )


@router.get("/graph/cache/list")
async def list_cached_subjects():
    """
    List all subjects that have cached graphs

    Useful for cache management and monitoring.
    """
    try:
        logger.info(f"📋 GET /graph/cache/list")

        subjects = await graph_cache_manager.list_all_cached_subjects()

        return {
            "cached_subjects": subjects,
            "count": len(subjects)
        }

    except Exception as e:
        logger.error(f"❌ Error listing cached subjects: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list cached subjects: {str(e)}"
        )


@router.get("/graph/cache/list-all")
async def list_all_cached_graphs():
    """
    List all cached graph documents with metadata

    Returns detailed information about all cached graphs including:
    - Document IDs
    - Subject IDs
    - Version types (draft/published)
    - Generation and access timestamps
    - Metadata (node counts, edge counts)
    """
    try:
        logger.info(f"📋 GET /graph/cache/list-all")

        graphs = await graph_cache_manager.list_all_cached_graphs()

        return {
            "cached_graphs": graphs,
            "count": len(graphs)
        }

    except Exception as e:
        logger.error(f"❌ Error listing all cached graphs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list all cached graphs: {str(e)}"
        )


@router.delete("/graph/cache/delete-all")
async def delete_all_cached_graphs():
    """
    Delete ALL cached graph documents (use with caution!)

    This is useful for cleaning up accumulated cache documents.
    After deletion, graphs will be regenerated on next request.
    """
    try:
        logger.info(f"🗑️ DELETE /graph/cache/delete-all")

        deleted_count = await graph_cache_manager.delete_all_cached_graphs()

        return {
            "message": f"Deleted all cached graphs",
            "deleted_count": deleted_count
        }

    except Exception as e:
        logger.error(f"❌ Error deleting all cached graphs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete all cached graphs: {str(e)}"
        )


@router.delete("/graph/cache/delete-by-ids")
async def delete_cached_graphs_by_ids(
    document_ids: list[str]
):
    """
    Delete specific cached graphs by their document IDs

    Request body should be a list of document IDs to delete.
    Example: ["SCIENCE_latest_20251025_114839_draft", "SCIENCE_latest_20251025_114842_draft"]
    """
    try:
        logger.info(f"🗑️ DELETE /graph/cache/delete-by-ids (count={len(document_ids)})")

        deleted_count = await graph_cache_manager.delete_cached_graphs_by_ids(document_ids)

        return {
            "message": f"Deleted {deleted_count} specific cached graphs",
            "deleted_count": deleted_count,
            "requested_ids": document_ids
        }

    except Exception as e:
        logger.error(f"❌ Error deleting cached graphs by IDs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete cached graphs by IDs: {str(e)}"
        )
