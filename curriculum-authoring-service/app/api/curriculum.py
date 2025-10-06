"""
Curriculum CRUD API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from app.core.security import get_current_user, require_designer
from app.services.curriculum_manager import curriculum_manager
from app.services.version_control import version_control
from app.models.curriculum import (
    Subject, SubjectCreate, SubjectUpdate,
    Unit, UnitCreate, UnitUpdate,
    Skill, SkillCreate,
    Subskill, SubskillCreate,
    CurriculumTree
)

router = APIRouter()


# ==================== SUBJECT ENDPOINTS ====================

@router.get("/subjects", response_model=List[Subject])
async def list_subjects(
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all subjects"""
    return await curriculum_manager.get_all_subjects(include_drafts)


@router.get("/subjects/{subject_id}", response_model=Subject)
async def get_subject(
    subject_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific subject"""
    subject = await curriculum_manager.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("/subjects/{subject_id}/tree", response_model=CurriculumTree)
async def get_curriculum_tree(
    subject_id: str,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get complete hierarchical curriculum tree for a subject"""
    tree = await curriculum_manager.get_curriculum_tree(subject_id, include_drafts)
    if not tree:
        raise HTTPException(status_code=404, detail="Subject not found")
    return tree


@router.post("/subjects", response_model=Subject)
async def create_subject(
    subject: SubjectCreate,
    current_user: dict = Depends(require_designer)
):
    """Create a new subject (requires designer role)"""
    # Create draft version
    version = await version_control.create_version(
        {"subject_id": subject.subject_id, "description": "Initial version"},
        current_user["user_id"]
    )

    return await curriculum_manager.create_subject(
        subject,
        current_user["user_id"],
        version.version_id
    )


@router.put("/subjects/{subject_id}", response_model=Subject)
async def update_subject(
    subject_id: str,
    updates: SubjectUpdate,
    current_user: dict = Depends(require_designer)
):
    """Update a subject"""
    # Get or create draft version
    active_version = await version_control.get_active_version(subject_id)

    if not active_version:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Create new draft version
    draft_version = await version_control.create_version(
        {"subject_id": subject_id, "description": "Draft update"},
        current_user["user_id"]
    )

    updated = await curriculum_manager.update_subject(
        subject_id,
        updates,
        draft_version.version_id
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Subject not found")

    return updated


# ==================== UNIT ENDPOINTS ====================

@router.get("/subjects/{subject_id}/units", response_model=List[Unit])
async def list_units(
    subject_id: str,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all units for a subject"""
    return await curriculum_manager.get_units_by_subject(subject_id, include_drafts)


@router.get("/units/{unit_id}", response_model=Unit)
async def get_unit(
    unit_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific unit"""
    unit = await curriculum_manager.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.post("/units", response_model=Unit)
async def create_unit(
    unit: UnitCreate,
    current_user: dict = Depends(require_designer)
):
    """Create a new unit"""
    # Get subject to determine version
    subject = await curriculum_manager.get_subject(unit.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Create draft version if needed
    draft_version = await version_control.create_version(
        {"subject_id": unit.subject_id, "description": "Add unit"},
        current_user["user_id"]
    )

    return await curriculum_manager.create_unit(unit, draft_version.version_id)


@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(
    unit_id: str,
    updates: UnitUpdate,
    current_user: dict = Depends(require_designer)
):
    """Update a unit"""
    unit = await curriculum_manager.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Create draft version
    # (In reality, would need to get subject_id from unit)
    draft_version = await version_control.create_version(
        {"subject_id": "placeholder", "description": "Update unit"},
        current_user["user_id"]
    )

    updated = await curriculum_manager.update_unit(
        unit_id,
        updates,
        draft_version.version_id
    )

    return updated


@router.delete("/units/{unit_id}")
async def delete_unit(
    unit_id: str,
    current_user: dict = Depends(require_designer)
):
    """Delete a unit"""
    success = await curriculum_manager.delete_unit(unit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"message": "Unit deleted successfully"}


# ==================== SKILL ENDPOINTS ====================

@router.get("/units/{unit_id}/skills", response_model=List[Skill])
async def list_skills(
    unit_id: str,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all skills for a unit"""
    return await curriculum_manager.get_skills_by_unit(unit_id, include_drafts)


@router.post("/skills", response_model=Skill)
async def create_skill(
    skill: SkillCreate,
    current_user: dict = Depends(require_designer)
):
    """Create a new skill"""
    # Would need to get subject_id from unit_id
    draft_version = await version_control.create_version(
        {"subject_id": "placeholder", "description": "Add skill"},
        current_user["user_id"]
    )

    return await curriculum_manager.create_skill(skill, draft_version.version_id)


# ==================== SUBSKILL ENDPOINTS ====================

@router.get("/skills/{skill_id}/subskills", response_model=List[Subskill])
async def list_subskills(
    skill_id: str,
    include_drafts: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List all subskills for a skill"""
    return await curriculum_manager.get_subskills_by_skill(skill_id, include_drafts)


@router.post("/subskills", response_model=Subskill)
async def create_subskill(
    subskill: SubskillCreate,
    current_user: dict = Depends(require_designer)
):
    """Create a new subskill"""
    draft_version = await version_control.create_version(
        {"subject_id": "placeholder", "description": "Add subskill"},
        current_user["user_id"]
    )

    return await curriculum_manager.create_subskill(subskill, draft_version.version_id)
