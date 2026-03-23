"""
Knowledge graph edge API endpoints.

Provides CRUD for typed curriculum edges (prerequisite, builds_on,
reinforces, parallel, applies). Backward-compatible with the legacy
/prerequisites endpoints via the shared graph cache.
"""

import logging
from fastapi import APIRouter, HTTPException
from typing import Optional

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
async def create_edge(edge: CurriculumEdgeCreate, subject_id: Optional[str] = None):
    """Create a new knowledge graph edge.

    If ``subject_id`` is not provided, it is resolved from the target entity
    via the curriculum hierarchy.
    """
    # Resolve subject_id
    resolved_subject = subject_id
    if not resolved_subject:
        resolved_subject = await _resolve_subject_id(
            edge.target_entity_id, edge.target_entity_type
        )
    if not resolved_subject:
        raise HTTPException(
            status_code=404,
            detail="Could not resolve subject_id from edge entities",
        )

    # Validate
    is_valid, error = await edge_manager.validate_edge(edge)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # Get active version
    version_id = await version_control.get_or_create_active_version(
        resolved_subject, "local-dev-user"
    )

    result = await edge_manager.create_edge(edge, version_id, resolved_subject)

    # Invalidate draft graph cache
    try:
        await graph_cache_manager.invalidate_cache(resolved_subject, "draft")
    except Exception as e:
        logger.warning(f"Cache invalidation failed (non-blocking): {e}")

    return result


@router.delete("/edges/{edge_id}")
async def delete_edge(edge_id: str):
    """Delete an edge (and its paired reverse if parallel)."""
    success = await edge_manager.delete_edge(edge_id)
    if not success:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"message": "Edge deleted successfully"}


@router.get("/edges/{entity_id}", response_model=EntityEdges)
async def get_entity_edges(
    entity_id: str,
    entity_type: EntityType,
    include_drafts: bool = False,
):
    """Get all edges (incoming and outgoing) for an entity."""
    return await edge_manager.get_entity_edges(entity_id, entity_type, include_drafts)


@router.post("/edges/validate")
async def validate_edge(edge: CurriculumEdgeCreate):
    """Validate an edge without creating it (cycle check on prerequisite subgraph)."""
    is_valid, error = await edge_manager.validate_edge(edge)
    return {"valid": is_valid, "error": error}


@router.get("/subjects/{subject_id}/knowledge-graph", response_model=CurriculumGraph)
async def get_subject_knowledge_graph(
    subject_id: str,
    include_drafts: bool = False,
):
    """Get the full knowledge graph for a subject (all edge types)."""
    return await edge_manager.get_subject_graph(subject_id, include_drafts)


@router.get("/subjects/{subject_id}/base-skills")
async def get_base_skills(subject_id: str):
    """Get entry-point entities (no prerequisite edges targeting them)."""
    base_skills = await edge_manager.get_base_skills(subject_id)
    return {"subject_id": subject_id, "base_skills": base_skills}


# ------------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------------ #

async def _resolve_subject_id(entity_id: str, entity_type: EntityType) -> Optional[str]:
    """Walk the curriculum hierarchy to find the subject_id for an entity."""
    from app.services.curriculum_manager import curriculum_manager

    if entity_type == "skill":
        skill = await curriculum_manager.get_skill(entity_id)
        if skill:
            unit = await curriculum_manager.get_unit(skill.unit_id)
            if unit:
                return unit.subject_id
    elif entity_type == "subskill":
        subskill = await curriculum_manager.get_subskill(entity_id)
        if subskill:
            skill = await curriculum_manager.get_skill(subskill.skill_id)
            if skill:
                unit = await curriculum_manager.get_unit(skill.unit_id)
                if unit:
                    return unit.subject_id
    return None
