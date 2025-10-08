"""
Prerequisite and learning path graph API endpoints
"""

import logging
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

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/prerequisites/{entity_id}", response_model=EntityPrerequisites)
async def get_entity_prerequisites(
    entity_id: str,
    entity_type: EntityType,
    include_drafts: bool = False
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
    include_drafts: bool = False
):
    """Get complete prerequisite graph for a subject"""
    return await prerequisite_manager.get_subject_graph(subject_id, include_drafts)


@router.get("/subjects/{subject_id}/base-skills")
async def get_base_skills(
    subject_id: str
):
    """Get base skills (entry points with no prerequisites) for a subject"""
    base_skills = await prerequisite_manager.get_base_skills(subject_id)
    return {"subject_id": subject_id, "base_skills": base_skills}


@router.post("/validate")
async def validate_prerequisite(
    prerequisite: PrerequisiteCreate
):
    """Validate a prerequisite without creating it (checks for circular dependencies)"""
    logger.info(f"🔍 Validating prerequisite:")
    logger.info(f"   Prerequisite: {prerequisite.prerequisite_entity_type} {prerequisite.prerequisite_entity_id}")
    logger.info(f"   Unlocks: {prerequisite.unlocks_entity_type} {prerequisite.unlocks_entity_id}")
    logger.info(f"   Threshold: {prerequisite.min_proficiency_threshold}")

    try:
        is_valid, error_message = await prerequisite_manager.validate_prerequisite(prerequisite)

        if is_valid:
            logger.info(f"✅ Validation passed")
        else:
            logger.warning(f"❌ Validation failed: {error_message}")

        return {
            "valid": is_valid,
            "error": error_message
        }
    except Exception as e:
        logger.error(f"💥 Validation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/prerequisites", response_model=Prerequisite)
async def create_prerequisite(
    prerequisite: PrerequisiteCreate
):
    """Create a new prerequisite relationship"""

    # Validate prerequisite (check for circular dependencies)
    is_valid, error_message = await prerequisite_manager.validate_prerequisite(prerequisite)

    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    # Get subject_id from target entity
    # For now, using a placeholder - in production, resolve from prerequisite target
    from app.models.versioning import VersionCreate
    draft_version = await version_control.create_version(
        VersionCreate(subject_id="placeholder", description="Add prerequisite"),
        "local-dev-user"
    )

    return await prerequisite_manager.create_prerequisite(
        prerequisite,
        draft_version.version_id
    )


@router.delete("/prerequisites/{prerequisite_id}")
async def delete_prerequisite(
    prerequisite_id: str
):
    """Delete a prerequisite relationship"""
    success = await prerequisite_manager.delete_prerequisite(prerequisite_id)

    if not success:
        raise HTTPException(status_code=404, detail="Prerequisite not found")

    return {"message": "Prerequisite deleted successfully"}
