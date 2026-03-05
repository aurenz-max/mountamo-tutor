"""
Calibration Display API Endpoints (Difficulty Calibration PRD — Phase 2)

Read-only endpoints for querying student EL trajectories (with contextual
messaging) and item calibration convergence data (admin view).
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
import logging

from ...core.middleware import get_user_context
from ...dependencies import get_firestore_service, get_progress_display_service
from ...db.firestore_service import FirestoreService
from ...services.progress_display_service import ProgressDisplayService
from ...models.calibration_api import (
    ItemCalibrationListResponse,
    ItemCalibrationResponse,
    SkillAbilityResponse,
    StudentAbilitySummaryResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==========================================================================
# Health check (fixed route — must come before parameterized routes)
# ==========================================================================

@router.get("/health")
async def calibration_health():
    """Health check for the calibration display service."""
    return {"status": "ok", "service": "calibration-display"}


# ==========================================================================
# Item calibration endpoints (admin view — fixed routes)
# ==========================================================================

@router.get("/items", response_model=ItemCalibrationListResponse)
async def get_all_item_calibrations(
    primitive_type: Optional[str] = Query(
        None, description="Filter by primitive type (e.g. 'ten-frame')"
    ),
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """
    Get all item calibration documents. Supports filtering by primitive_type.
    Admin-facing endpoint for monitoring calibration convergence.
    """
    logger.info(
        f"GET /calibration/items — primitive_type={primitive_type}"
    )
    try:
        raw_docs = await firestore.get_all_item_calibrations(
            primitive_type=primitive_type,
        )
        items = []
        for doc in raw_docs:
            item_key = f"{doc.get('primitive_type', '')}_{doc.get('eval_mode', '')}"
            prior = doc.get("prior_beta", 3.0)
            calibrated = doc.get("calibrated_beta", prior)
            items.append(
                ItemCalibrationResponse(
                    item_key=item_key,
                    primitive_type=doc.get("primitive_type", ""),
                    eval_mode=doc.get("eval_mode", ""),
                    prior_beta=prior,
                    empirical_beta=doc.get("empirical_beta"),
                    calibrated_beta=calibrated,
                    total_observations=doc.get("total_observations", 0),
                    total_correct=doc.get("total_correct", 0),
                    credibility_z=doc.get("credibility_z", 0.0),
                    convergence_delta=round(abs(calibrated - prior), 3),
                    created_at=doc.get("created_at", ""),
                    updated_at=doc.get("updated_at", ""),
                )
            )

        return ItemCalibrationListResponse(
            items=items,
            count=len(items),
            queried_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.error(f"Error fetching item calibrations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/items/{item_key}", response_model=ItemCalibrationResponse)
async def get_item_calibration(
    item_key: str,
    user_context: dict = Depends(get_user_context),
    firestore: FirestoreService = Depends(get_firestore_service),
):
    """Get a single item calibration document by key (e.g. 'ten-frame_subitize')."""
    logger.info(f"GET /calibration/items/{item_key}")
    try:
        doc = await firestore.get_item_calibration(item_key)
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Item calibration '{item_key}' not found",
            )
        prior = doc.get("prior_beta", 3.0)
        calibrated = doc.get("calibrated_beta", prior)
        return ItemCalibrationResponse(
            item_key=item_key,
            primitive_type=doc.get("primitive_type", ""),
            eval_mode=doc.get("eval_mode", ""),
            prior_beta=prior,
            empirical_beta=doc.get("empirical_beta"),
            calibrated_beta=calibrated,
            total_observations=doc.get("total_observations", 0),
            total_correct=doc.get("total_correct", 0),
            credibility_z=doc.get("credibility_z", 0.0),
            convergence_delta=round(abs(calibrated - prior), 3),
            created_at=doc.get("created_at", ""),
            updated_at=doc.get("updated_at", ""),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching item calibration {item_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================================================
# Student ability endpoints (parameterized routes — MUST come after fixed)
# ==========================================================================

@router.get(
    "/{student_id}/abilities",
    response_model=StudentAbilitySummaryResponse,
)
async def get_all_abilities(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: ProgressDisplayService = Depends(get_progress_display_service),
):
    """
    Get all skill abilities for a student with contextual messages.
    Returns theta, earned_level, trajectory history, and contextual
    progress messages for each skill the student has ability data on.
    """
    logger.info(f"GET /calibration/{student_id}/abilities")
    try:
        return await service.get_student_abilities_with_messages(student_id)
    except Exception as e:
        logger.error(f"Error fetching abilities for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{student_id}/abilities/{skill_id}",
    response_model=SkillAbilityResponse,
)
async def get_skill_ability(
    student_id: int,
    skill_id: str,
    user_context: dict = Depends(get_user_context),
    service: ProgressDisplayService = Depends(get_progress_display_service),
):
    """Get single skill ability with trajectory and contextual message."""
    logger.info(f"GET /calibration/{student_id}/abilities/{skill_id}")
    try:
        result = await service.get_skill_ability_with_message(
            student_id, skill_id,
        )
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"No ability data for student {student_id} skill {skill_id}",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error fetching ability for student {student_id} "
            f"skill {skill_id}: {e}"
        )
        raise HTTPException(status_code=500, detail=str(e))
