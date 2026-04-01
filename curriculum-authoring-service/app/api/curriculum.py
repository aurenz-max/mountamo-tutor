"""
Curriculum CRUD API endpoints

Write endpoints (POST/PUT/DELETE) require both ``grade`` and ``subject_id``
query parameters so the caller always explicitly chooses where to write.
This avoids silent misrouting (e.g. MATHEMATICS vs MATHEMATICS_G1) and
maps directly to the Firestore path ``curriculum_drafts/{grade}/subjects/{subject_id}``.

Read endpoints accept an optional ``subject_id`` for O(1) lookups but
fall back to scanning when omitted.
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

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
from app.models.grades import GRADE_CODES, GRADE_LABELS, validate_grade

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== Shared validation helper ====================

async def _require_grade_subject(
    grade: str,
    subject_id: str,
) -> dict:
    """Validate grade + subject_id pair, raising 400/404 with clear messages."""
    try:
        return await curriculum_manager.validate_grade_subject(grade, subject_id)
    except ValueError as e:
        # ValueError from validate_grade (bad code) → 400
        # ValueError from validate_grade_subject (mismatch/not found) → 400
        raise HTTPException(status_code=400, detail=str(e))


# ==================== GRADE ENDPOINTS ====================

@router.get("/grades")
async def list_grades():
    """List all valid grade codes with display labels"""
    return {
        "grades": [
            {"code": code, "label": GRADE_LABELS[code]}
            for code in GRADE_CODES
        ]
    }


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
    # Validate grade
    try:
        validate_grade(subject.grade)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    unit: UnitCreate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
):
    """Create a new unit.

    Requires ``grade`` to validate against the subject's grade.
    ``subject_id`` comes from the UnitCreate body.
    """
    await _require_grade_subject(grade, unit.subject_id)

    version_id = await version_control.get_or_create_active_version(
        unit.subject_id,
        "local-dev-user"
    )

    return await curriculum_manager.create_unit(unit, version_id)


@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(
    unit_id: str,
    updates: UnitUpdate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Update a unit"""
    await _require_grade_subject(grade, subject_id)

    draft_version = await version_control.create_version(
        VersionCreate(subject_id=subject_id, description="Update unit"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_unit(
        unit_id,
        updates,
        draft_version.version_id,
        subject_id=subject_id,
    )

    if not updated:
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found in subject '{subject_id}'")

    return updated


@router.delete("/units/{unit_id}")
async def delete_unit(
    unit_id: str,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Delete a unit"""
    await _require_grade_subject(grade, subject_id)

    success = await curriculum_manager.delete_unit(unit_id, subject_id=subject_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found in subject '{subject_id}'")
    return {"message": "Unit deleted successfully"}


# ==================== SKILL ENDPOINTS ====================

@router.get("/units/{unit_id}/skills", response_model=List[Skill])
async def list_skills(
    unit_id: str,
    include_drafts: bool = False,
    subject_id: Optional[str] = Query(None, description="Subject ID (optional, for O(1) lookup)")
):
    """List all skills for a unit"""
    return await curriculum_manager.get_skills_by_unit(unit_id, include_drafts, subject_id=subject_id)


@router.post("/skills", response_model=Skill)
async def create_skill(
    skill: SkillCreate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Create a new skill"""
    logger.info(f"Creating skill: {skill.skill_id} for unit {skill.unit_id}")
    await _require_grade_subject(grade, subject_id)

    version_id = await version_control.get_or_create_active_version(
        subject_id,
        "local-dev-user"
    )

    result = await curriculum_manager.create_skill(skill, version_id, subject_id=subject_id)
    logger.info(f"Skill created: {result.skill_id}")
    return result


@router.get("/skills/{skill_id}", response_model=Skill)
async def get_skill(
    skill_id: str
):
    """Get a specific skill"""
    skill = await curriculum_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.put("/skills/{skill_id}", response_model=Skill)
async def update_skill(
    skill_id: str,
    updates: SkillUpdate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Update a skill"""
    logger.info(f"Updating skill: {skill_id}")
    await _require_grade_subject(grade, subject_id)

    draft_version = await version_control.create_version(
        VersionCreate(subject_id=subject_id, description="Update skill"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_skill(
        skill_id,
        updates,
        draft_version.version_id,
        subject_id=subject_id,
    )

    if not updated:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found in subject '{subject_id}'")

    logger.info(f"Skill updated: {skill_id}")
    return updated


@router.delete("/skills/{skill_id}")
async def delete_skill(
    skill_id: str,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Delete a skill"""
    logger.info(f"Deleting skill: {skill_id}")
    await _require_grade_subject(grade, subject_id)

    success = await curriculum_manager.delete_skill(skill_id, subject_id=subject_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_id}' not found in subject '{subject_id}'")

    logger.info(f"Skill deleted: {skill_id}")
    return {"message": "Skill deleted successfully"}


# ==================== SUBSKILL ENDPOINTS ====================

@router.get("/skills/{skill_id}/subskills", response_model=List[Subskill])
async def list_subskills(
    skill_id: str,
    include_drafts: bool = False,
    subject_id: Optional[str] = Query(None, description="Subject ID (optional, for O(1) lookup)")
):
    """List all subskills for a skill"""
    return await curriculum_manager.get_subskills_by_skill(skill_id, include_drafts, subject_id=subject_id)


@router.post("/subskills", response_model=Subskill)
async def create_subskill(
    subskill: SubskillCreate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Create a new subskill"""
    logger.info(f"Creating subskill: {subskill.subskill_id} for skill {subskill.skill_id}")
    await _require_grade_subject(grade, subject_id)

    version_id = await version_control.get_or_create_active_version(
        subject_id,
        "local-dev-user"
    )

    result = await curriculum_manager.create_subskill(subskill, version_id, subject_id=subject_id)
    logger.info(f"Subskill created: {result.subskill_id}")
    return result


@router.get("/subskills/{subskill_id}", response_model=Subskill)
async def get_subskill(
    subskill_id: str
):
    """Get a specific subskill"""
    subskill = await curriculum_manager.get_subskill(subskill_id)
    if not subskill:
        raise HTTPException(status_code=404, detail="Subskill not found")
    return subskill


@router.put("/subskills/{subskill_id}", response_model=Subskill)
async def update_subskill(
    subskill_id: str,
    updates: SubskillUpdate,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Update a subskill"""
    logger.info(f"Updating subskill: {subskill_id}")
    ctx = await _require_grade_subject(grade, subject_id)

    draft_version = await version_control.create_version(
        VersionCreate(subject_id=subject_id, description="Update subskill"),
        "local-dev-user"
    )

    updated = await curriculum_manager.update_subskill(
        subskill_id,
        updates,
        draft_version.version_id,
        subject_id=subject_id
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Subskill '{subskill_id}' not found in subject '{subject_id}' (grade {grade})"
        )

    logger.info(f"Subskill updated: {subskill_id}")
    return updated


@router.delete("/subskills/{subskill_id}")
async def delete_subskill(
    subskill_id: str,
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Delete a subskill"""
    logger.info(f"Deleting subskill: {subskill_id}")
    await _require_grade_subject(grade, subject_id)

    success = await curriculum_manager.delete_subskill(subskill_id, subject_id=subject_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Subskill '{subskill_id}' not found in subject '{subject_id}' (grade {grade})"
        )

    logger.info(f"Subskill deleted: {subskill_id}")
    return {"message": "Subskill deleted successfully"}


# ==================== PRIMITIVE ENDPOINTS ====================

@router.post("/subjects/{subject_id}/repair-duplicate-units")
async def repair_duplicate_units(subject_id: str):
    """Merge duplicate unit entries in a subject's curriculum array.

    When the same unit_id appears more than once (e.g. from cross-grade import
    collisions), their skills arrays are merged into the first occurrence and
    all subsequent duplicates are removed.  Safe to call multiple times.
    """
    from app.db.draft_curriculum_service import draft_curriculum as _dc

    ctx = await curriculum_manager._resolve_subject_context(subject_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Subject not found")

    doc = await _dc.get_draft(ctx["grade"], subject_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Merge duplicates: keep first occurrence, fold subsequent skills into it
    merged: dict = {}          # unit_id → merged unit entry
    order: list = []           # preserves first-seen order

    for u in doc.get("curriculum", []):
        uid = u["unit_id"]
        if uid not in merged:
            merged[uid] = dict(u)  # copy, not alias
            order.append(uid)
        else:
            # Merge skills from the duplicate into the existing entry
            existing_skill_ids = {sk["skill_id"] for sk in merged[uid].get("skills", [])}
            for sk in u.get("skills", []):
                if sk["skill_id"] not in existing_skill_ids:
                    merged[uid].setdefault("skills", []).append(sk)
                    existing_skill_ids.add(sk["skill_id"])

    original_count = len(doc["curriculum"])
    doc["curriculum"] = [merged[uid] for uid in order]
    removed = original_count - len(doc["curriculum"])

    if removed == 0:
        return {"message": "No duplicates found", "subject_id": subject_id}

    from datetime import datetime
    doc["updated_at"] = datetime.utcnow().isoformat()
    await _dc.save_draft(ctx["grade"], subject_id, doc)

    logger.info(f"Repaired {subject_id}: merged {removed} duplicate unit entries")
    return {
        "message": f"Merged {removed} duplicate unit entries",
        "subject_id": subject_id,
        "units_after": len(doc["curriculum"]),
    }


@router.get("/primitives")
async def get_all_primitives():
    """Get all visual primitives from the library"""
    primitives = await curriculum_manager.get_all_primitives()
    return primitives


@router.get("/primitives/categories/{category}")
async def get_primitives_by_category(category: str):
    """Get primitives filtered by category"""
    valid_categories = ["foundational", "math", "science", "language-arts", "abcs"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )

    return await curriculum_manager.get_primitives_by_category(category)


@router.get("/subskills/{subskill_id}/primitives")
async def get_subskill_primitives(
    subskill_id: str,
    subject_id: str = Query(..., description="Subject ID to locate the draft doc")
):
    """Get primitive IDs assigned to a subskill (reads from hierarchical draft doc)."""
    primitive_ids = await curriculum_manager.get_subskill_primitives(
        subskill_id,
        subject_id,
    )
    return primitive_ids


@router.put("/subskills/{subskill_id}/primitives")
async def update_subskill_primitives(
    subskill_id: str,
    primitive_ids: List[str],
    grade: str = Query(..., description="Grade code (e.g. K, 1, 2)"),
    subject_id: str = Query(..., description="Subject ID (e.g. MATHEMATICS_G1)"),
):
    """Update the primitives associated with a subskill.

    Writes primitive_ids directly into the hierarchical draft doc so the
    tree, publish, and flattened views all reflect the assignment.
    """
    logger.info(f"Updating primitives for subskill: {subskill_id}")
    await _require_grade_subject(grade, subject_id)

    success = await curriculum_manager.update_subskill_primitives(
        subskill_id,
        primitive_ids,
        subject_id,
    )

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Subskill '{subskill_id}' not found in subject '{subject_id}' (grade {grade})"
        )

    logger.info(f"Primitives updated for subskill: {subskill_id}")
    return {"message": "Primitives updated successfully", "primitive_count": len(primitive_ids)}
