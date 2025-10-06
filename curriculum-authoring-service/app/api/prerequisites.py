"""
Prerequisite and learning path graph API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.core.security import get_current_user, require_designer
from app.services.prerequisite_manager import prerequisite_manager
from app.services.version_control import version_control
from app.models.prerequisites import (
    Prerequisite, PrerequisiteCreate,
    EntityPrerequisites, PrerequisiteGraph,
    EntityType
)

router = APIRouter()


@router.get("/prerequisites/{entity_id}", response_model=EntityPrerequisites)
async def get_entity_prerequisites(
    entity_id: str,
    entity_type: EntityType,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all prerequisites and unlocks for an entity"""
    return await prerequisite_manager.get_entity_prerequisites(
        entity_id,
        entity_type,
        include_drafts
    )


@router.get("/subjects/{subject_id}/graph", response_model=PrerequisiteGraph)
async def get_subject_graph(
    subject_id: str,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get complete prerequisite graph for a subject"""
    return await prerequisite_manager.get_subject_graph(subject_id, include_drafts)


@router.get("/subjects/{subject_id}/base-skills")
async def get_base_skills(
    subject_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get base skills (entry points with no prerequisites) for a subject"""
    base_skills = await prerequisite_manager.get_base_skills(subject_id)
    return {"subject_id": subject_id, "base_skills": base_skills}


@router.post("/prerequisites", response_model=Prerequisite)
async def create_prerequisite(
    prerequisite: PrerequisiteCreate,
    current_user: dict = Depends(require_designer)
):
    """Create a new prerequisite relationship"""

    # Validate prerequisite (check for circular dependencies)
    is_valid, error_message = await prerequisite_manager.validate_prerequisite(prerequisite)

    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    # Create draft version (would need subject_id)
    draft_version = await version_control.create_version(
        {"subject_id": "placeholder", "description": "Add prerequisite"},
        current_user["user_id"]
    )

    return await prerequisite_manager.create_prerequisite(
        prerequisite,
        draft_version.version_id
    )


@router.delete("/prerequisites/{prerequisite_id}")
async def delete_prerequisite(
    prerequisite_id: str,
    current_user: dict = Depends(require_designer)
):
    """Delete a prerequisite relationship"""
    success = await prerequisite_manager.delete_prerequisite(prerequisite_id)

    if not success:
        raise HTTPException(status_code=404, detail="Prerequisite not found")

    return {"message": "Prerequisite deleted successfully"}


@router.post("/prerequisites/validate")
async def validate_prerequisite(
    prerequisite: PrerequisiteCreate,
    current_user: dict = Depends(get_current_user)
):
    """Validate a prerequisite without creating it (checks for circular dependencies)"""
    is_valid, error_message = await prerequisite_manager.validate_prerequisite(prerequisite)

    return {
        "valid": is_valid,
        "error": error_message
    }
