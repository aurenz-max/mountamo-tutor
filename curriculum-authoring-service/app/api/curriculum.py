"""
Curriculum CRUD API endpoints
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional

from app.core.security import get_current_user, require_designer
from app.services.curriculum_manager import curriculum_manager
from app.services.version_control import version_control
from app.models.curriculum import (
    Subject, SubjectCreate, SubjectUpdate,
    Unit, UnitCreate, UnitUpdate,
    Skill, SkillCreate, SkillUpdate,
    Subskill, SubskillCreate, SubskillUpdate,
    CurriculumTree
)
from app.models.versioning import VersionCreate

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== SUBJECT ENDPOINTS ====================

@router.get("/subjects", response_model=List[Subject])
async def list_subjects(
    include_drafts: bool = False
):
    """List all subjects"""
    return await curriculum_manager.get_all_subjects(include_drafts)


@router.get("/subjects/{subject_id}", response_model=Subject)
async def get_subject(
    subject_id: str
):
    """Get a specific subject"""
    subject = await curriculum_manager.get_subject(subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("/subjects/{subject_id}/tree", response_model=CurriculumTree)
async def get_curriculum_tree(
    subject_id: str,
    include_drafts: bool = False
):
    """Get complete hierarchical curriculum tree for a subject"""
    tree = await curriculum_manager.get_curriculum_tree(subject_id, include_drafts)
    if not tree:
        raise HTTPException(status_code=404, detail="Subject not found")
    return tree


@router.post("/subjects", response_model=Subject)
async def create_subject(
    subject: SubjectCreate
):
    """Create a new subject"""
    # Get or create active version (this will create version 1 if it doesn't exist)
    version_id = await version_control.get_or_create_active_version(
        subject.subject_id,
        "local-dev-user"
    )

    return await curriculum_manager.create_subject(
        subject,
        "local-dev-user",
        version_id
    )


@router.put("/subjects/{subject_id}", response_model=Subject)
async def update_subject(
    subject_id: str,
    updates: SubjectUpdate
):
    """Update a subject"""
    # Get or create draft version
    active_version = await version_control.get_active_version(subject_id)

    if not active_version:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Create new draft version
    draft_version = await version_control.create_version(
        VersionCreate(subject_id=subject_id, description="Draft update"),
        "local-dev-user"
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
    include_drafts: bool = False
):
    """List all units for a subject"""
    return await curriculum_manager.get_units_by_subject(subject_id, include_drafts)


@router.get("/units/{unit_id}", response_model=Unit)
async def get_unit(
    unit_id: str
):
    """Get a specific unit"""
    unit = await curriculum_manager.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.post("/units", response_model=Unit)
async def create_unit(
    unit: UnitCreate
):
    """Create a new unit"""
    # Get subject to determine version
    subject = await curriculum_manager.get_subject(unit.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get or create active version (reuse existing version instead of creating new one)
    version_id = await version_control.get_or_create_active_version(
        unit.subject_id,
        "local-dev-user"
    )

    return await curriculum_manager.create_unit(unit, version_id)


@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(
    unit_id: str,
    updates: UnitUpdate
):
    """Update a unit"""
    unit = await curriculum_manager.get_unit(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Create draft version
    # (In reality, would need to get subject_id from unit)
    draft_version = await version_control.create_version(
        VersionCreate(subject_id=unit.subject_id, description="Update unit"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_unit(
        unit_id,
        updates,
        draft_version.version_id
    )

    return updated


@router.delete("/units/{unit_id}")
async def delete_unit(
    unit_id: str
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
    include_drafts: bool = False
):
    """List all skills for a unit"""
    return await curriculum_manager.get_skills_by_unit(unit_id, include_drafts)


@router.post("/skills", response_model=Skill)
async def create_skill(
    skill: SkillCreate
):
    """Create a new skill"""
    logger.info(f"📝 Creating skill: {skill.skill_id} for unit {skill.unit_id}")

    # Get unit to determine subject_id
    unit = await curriculum_manager.get_unit(skill.unit_id)
    if not unit:
        logger.error(f"❌ Unit not found: {skill.unit_id}")
        raise HTTPException(status_code=404, detail="Unit not found")

    # Get or create active version (reuse existing version instead of creating new one)
    version_id = await version_control.get_or_create_active_version(
        unit.subject_id,
        "local-dev-user"
    )

    result = await curriculum_manager.create_skill(skill, version_id)
    logger.info(f"✅ Skill created: {result.skill_id}")
    return result


@router.get("/skills/{skill_id}", response_model=Skill)
async def get_skill(
    skill_id: str
):
    """Get a specific skill"""
    logger.info(f"🔍 Getting skill: {skill_id}")

    skill = await curriculum_manager.get_skill(skill_id)
    if not skill:
        logger.error(f"❌ Skill not found: {skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    logger.info(f"✅ Skill found: {skill_id}")
    return skill


@router.put("/skills/{skill_id}", response_model=Skill)
async def update_skill(
    skill_id: str,
    updates: SkillUpdate
):
    """Update a skill"""
    logger.info(f"📝 Updating skill: {skill_id}")
    logger.info(f"   Updates: {updates.dict(exclude_unset=True)}")

    # Get skill to determine unit and subject
    skill = await curriculum_manager.get_skill(skill_id)
    if not skill:
        logger.error(f"❌ Skill not found: {skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    # Get unit to determine subject_id
    unit = await curriculum_manager.get_unit(skill.unit_id)
    if not unit:
        logger.error(f"❌ Unit not found for skill: {skill.unit_id}")
        raise HTTPException(status_code=404, detail="Unit not found")

    # Create draft version
    draft_version = await version_control.create_version(
        VersionCreate(subject_id=unit.subject_id, description="Update skill"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_skill(
        skill_id,
        updates,
        draft_version.version_id
    )

    if not updated:
        logger.error(f"❌ Failed to update skill: {skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    logger.info(f"✅ Skill updated: {skill_id}")
    return updated


@router.delete("/skills/{skill_id}")
async def delete_skill(
    skill_id: str
):
    """Delete a skill"""
    logger.info(f"🗑️  Deleting skill: {skill_id}")

    success = await curriculum_manager.delete_skill(skill_id)
    if not success:
        logger.error(f"❌ Skill not found: {skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    logger.info(f"✅ Skill deleted: {skill_id}")
    return {"message": "Skill deleted successfully"}


# ==================== SUBSKILL ENDPOINTS ====================

@router.get("/skills/{skill_id}/subskills", response_model=List[Subskill])
async def list_subskills(
    skill_id: str,
    include_drafts: bool = False
):
    """List all subskills for a skill"""
    return await curriculum_manager.get_subskills_by_skill(skill_id, include_drafts)


@router.post("/subskills", response_model=Subskill)
async def create_subskill(
    subskill: SubskillCreate
):
    """Create a new subskill"""
    logger.info(f"📝 Creating subskill: {subskill.subskill_id} for skill {subskill.skill_id}")

    # Get skill and unit to determine subject_id
    skill = await curriculum_manager.get_skill(subskill.skill_id)
    if not skill:
        logger.error(f"❌ Skill not found: {subskill.skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    unit = await curriculum_manager.get_unit(skill.unit_id)
    if not unit:
        logger.error(f"❌ Unit not found: {skill.unit_id}")
        raise HTTPException(status_code=404, detail="Unit not found")

    # Get or create active version (reuse existing version instead of creating new one)
    version_id = await version_control.get_or_create_active_version(
        unit.subject_id,
        "local-dev-user"
    )

    result = await curriculum_manager.create_subskill(subskill, version_id)
    logger.info(f"✅ Subskill created: {result.subskill_id}")
    return result


@router.get("/subskills/{subskill_id}", response_model=Subskill)
async def get_subskill(
    subskill_id: str
):
    """Get a specific subskill"""
    logger.info(f"🔍 Getting subskill: {subskill_id}")

    subskill = await curriculum_manager.get_subskill(subskill_id)
    if not subskill:
        logger.error(f"❌ Subskill not found: {subskill_id}")
        raise HTTPException(status_code=404, detail="Subskill not found")

    logger.info(f"✅ Subskill found: {subskill_id}")
    return subskill


@router.put("/subskills/{subskill_id}", response_model=Subskill)
async def update_subskill(
    subskill_id: str,
    updates: SubskillUpdate
):
    """Update a subskill"""
    logger.info(f"📝 Updating subskill: {subskill_id}")
    logger.info(f"   Updates: {updates.dict(exclude_unset=True)}")

    # Get subskill to determine skill and subject
    subskill = await curriculum_manager.get_subskill(subskill_id)
    if not subskill:
        logger.error(f"❌ Subskill not found: {subskill_id}")
        raise HTTPException(status_code=404, detail="Subskill not found")

    # Get skill and unit to determine subject_id
    skill = await curriculum_manager.get_skill(subskill.skill_id)
    if not skill:
        logger.error(f"❌ Skill not found: {subskill.skill_id}")
        raise HTTPException(status_code=404, detail="Skill not found")

    unit = await curriculum_manager.get_unit(skill.unit_id)
    if not unit:
        logger.error(f"❌ Unit not found: {skill.unit_id}")
        raise HTTPException(status_code=404, detail="Unit not found")

    # Create draft version
    draft_version = await version_control.create_version(
        VersionCreate(subject_id=unit.subject_id, description="Update subskill"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_subskill(
        subskill_id,
        updates,
        draft_version.version_id
    )

    if not updated:
        logger.error(f"❌ Failed to update subskill: {subskill_id}")
        raise HTTPException(status_code=404, detail="Subskill not found")

    logger.info(f"✅ Subskill updated: {subskill_id}")
    return updated


@router.delete("/subskills/{subskill_id}")
async def delete_subskill(
    subskill_id: str
):
    """Delete a subskill"""
    logger.info(f"🗑️  Deleting subskill: {subskill_id}")

    success = await curriculum_manager.delete_subskill(subskill_id)
    if not success:
        logger.error(f"❌ Subskill not found: {subskill_id}")
        raise HTTPException(status_code=404, detail="Subskill not found")

    logger.info(f"✅ Subskill deleted: {subskill_id}")
    return {"message": "Subskill deleted successfully"}


# ==================== PRIMITIVE ENDPOINTS ====================

@router.get("/primitives")
async def get_all_primitives():
    """Get all visual primitives from the library"""
    logger.info("📊 Fetching all primitives")

    primitives = await curriculum_manager.get_all_primitives()
    logger.info(f"✅ Retrieved {len(primitives)} primitives")

    return primitives


@router.get("/primitives/categories/{category}")
async def get_primitives_by_category(category: str):
    """Get primitives filtered by category"""
    logger.info(f"📊 Fetching primitives for category: {category}")

    valid_categories = ["foundational", "math", "science", "language-arts", "abcs"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )

    primitives = await curriculum_manager.get_primitives_by_category(category)
    logger.info(f"✅ Retrieved {len(primitives)} primitives for category {category}")

    return primitives


@router.get("/subskills/{subskill_id}/primitives")
async def get_subskill_primitives(
    subskill_id: str,
    subject_id: str = Query(..., description="Subject ID for version lookup")
):
    """Get all primitives associated with a subskill"""
    logger.info(f"📊 Fetching primitives for subskill: {subskill_id}")

    # Use a simple draft version ID based on subject
    # This matches the pattern used in update_subskill_primitives
    version_id = f"{subject_id}-draft"

    primitives = await curriculum_manager.get_subskill_primitives(
        subskill_id,
        version_id
    )

    logger.info(f"✅ Retrieved {len(primitives)} primitives for subskill {subskill_id}")
    return primitives


@router.put("/subskills/{subskill_id}/primitives")
async def update_subskill_primitives(
    subskill_id: str,
    primitive_ids: List[str],
    subject_id: str = Query(..., description="Subject ID for version lookup")
):
    """Update the primitives associated with a subskill"""
    logger.info(f"📝 Updating primitives for subskill: {subskill_id}")
    logger.info(f"   New primitive IDs: {primitive_ids}")

    # Use a simple draft version ID
    version_id = f"{subject_id}-draft"

    # Update primitive associations
    success = await curriculum_manager.update_subskill_primitives(
        subskill_id,
        primitive_ids,
        version_id
    )

    if not success:
        logger.error(f"❌ Failed to update primitives for subskill: {subskill_id}")
        raise HTTPException(status_code=500, detail="Failed to update primitives")

    logger.info(f"✅ Primitives updated for subskill: {subskill_id}")
    return {"message": "Primitives updated successfully", "primitive_count": len(primitive_ids)}
