"""
Knowledge graph edge API endpoints.

Provides CRUD for typed curriculum edges (prerequisite, builds_on,
reinforces, parallel, applies). Backward-compatible with the legacy
/prerequisites endpoints via the shared graph cache.
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from app.services.edge_manager import edge_manager
from app.services.version_control import version_control
from app.services.graph_cache_manager import graph_cache_manager
from app.models.edges import (
    CurriculumEdge, CurriculumEdgeCreate, EntityEdges,
    CurriculumGraph, EntityType,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/edges", response_model=CurriculumEdge)
async def create_edge(
    edge: CurriculumEdgeCreate,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS)"),
):
    """Create a new knowledge graph edge."""
    # Validate
    is_valid, error = await edge_manager.validate_edge(edge, grade=grade, subject_id=subject_id)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Get active version
    version_id = await version_control.get_or_create_active_version(
        subject_id, "local-dev-user"
    )

    result = await edge_manager.create_edge(edge, version_id, subject_id, grade=grade)

    # Invalidate draft graph cache
    try:
        await graph_cache_manager.invalidate_cache(subject_id, "draft")
    except Exception as e:
        logger.warning(f"Cache invalidation failed (non-blocking): {e}")

    return result


@router.delete("/edges/{edge_id}")
async def delete_edge(
    edge_id: str,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS)"),
):
    """Delete an edge (and its paired reverse if parallel)."""
    success = await edge_manager.delete_edge(edge_id, grade=grade, subject_id=subject_id)
    if not success:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"message": "Edge deleted successfully"}


@router.get("/edges/{entity_id}", response_model=EntityEdges)
async def get_entity_edges(
    entity_id: str,
    entity_type: EntityType,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS)"),
    include_drafts: bool = False,
):
    """Get all edges (incoming and outgoing) for an entity."""
    return await edge_manager.get_entity_edges(
        entity_id, entity_type, grade=grade, subject_id=subject_id, include_drafts=include_drafts
    )


@router.post("/edges/validate")
async def validate_edge(
    edge: CurriculumEdgeCreate,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS)"),
):
    """Validate an edge without creating it (cycle check on prerequisite subgraph)."""
    is_valid, error = await edge_manager.validate_edge(edge, grade=grade, subject_id=subject_id)
    return {"valid": is_valid, "error": error}


@router.get("/subjects/{subject_id}/knowledge-graph", response_model=CurriculumGraph)
async def get_subject_knowledge_graph(
    subject_id: str,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
    include_drafts: bool = False,
):
    """Get the full knowledge graph for a subject (all edge types)."""
    return await edge_manager.get_subject_graph(subject_id, include_drafts, grade=grade)


@router.get("/subjects/{subject_id}/base-skills")
async def get_base_skills(
    subject_id: str,
    grade: str = Query(..., description="Grade level (e.g. Kindergarten, 1, 2)"),
):
    """Get entry-point entities (no prerequisite edges targeting them)."""
    base_skills = await edge_manager.get_base_skills(subject_id, grade=grade)
    return {"subject_id": subject_id, "base_skills": base_skills}


