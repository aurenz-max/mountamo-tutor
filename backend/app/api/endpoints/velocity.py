# backend/app/api/endpoints/velocity.py
"""
Velocity API Endpoint — Pipeline-Adjusted Mastery Progress (PRD Section 15)

Provides the headline "Is this student on track?" metric with per-subject
decomposition and trend data.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
import logging

from ...core.middleware import get_user_context
from ...services.velocity_service import VelocityService
from ...dependencies import get_velocity_service
from ...models.velocity import VelocityResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{student_id}", response_model=VelocityResponse)
async def get_velocity(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: VelocityService = Depends(get_velocity_service),
):
    """
    Get the mastery velocity report for a student.

    Returns pipeline-adjusted velocity (earned mastery / adjusted expected
    mastery) with per-subject breakdowns, decomposition into three drivers
    (introduction, pass-through, closure), and 8-week trend data.

    Velocity of 100% = perfectly on pace.
    Velocity of 80%  = behind, mastered 80% of what was expected by now.
    Velocity of 150% = ahead, mastered 150% of what was expected by now.
    """
    try:
        logger.info(f"GET /velocity/{student_id}")
        return await service.get_velocity(student_id)

    except Exception as e:
        logger.error(f"Error computing velocity for student {student_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute velocity: {str(e)}",
        )


@router.get("/health")
async def velocity_health():
    """Health check for the velocity service."""
    return {
        "status": "healthy",
        "service": "velocity",
        "engine": "pipeline_adjusted_firestore_native",
        "features": {
            "earned_mastery": True,
            "pipeline_adjustment": True,
            "velocity_decomposition": True,
            "trend_history": True,
        },
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }
