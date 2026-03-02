# backend/app/api/endpoints/skill_progress.py
"""
Skill Progress API — 3-layer prerequisite projection panel.

Computed live from Firestore — not cached or stored.
"""

from fastapi import APIRouter, HTTPException, Depends, status
import logging

from ...core.middleware import get_user_context
from ...services.planning_service import PlanningService
from ...dependencies import get_planning_service
from ...models.skill_progress import SkillProgressResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{student_id}", response_model=SkillProgressResponse)
async def get_skill_progress(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """
    Get the 3-layer skill progress panel for a student.

    Layer 1 "Crafting Now":  1-2 skills actively being built toward.
    Layer 2 "Almost Ready":  2-3 skills at 50%+ prerequisite readiness.
    Layer 3 "Progress Overview": Per-subject mastery bars.
    """
    try:
        logger.info(f"GET /skill-progress/{student_id}")
        return await service.get_skill_progress(student_id)

    except Exception as e:
        logger.error(f"Error computing skill progress for student {student_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute skill progress: {str(e)}",
        )
