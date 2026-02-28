# backend/app/api/endpoints/weekly_planner.py
"""
Weekly Planner API Endpoints — Algorithmic Firestore-Native Engine

Replaces the LLM-based weekly planner with a deterministic pacing engine
that reads live state from Firestore (PRD Section 4).

Plans are computed on-demand — no stored plans, no CosmosDB, no BigQuery.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime
import logging

from ...core.middleware import get_user_context
from ...services.planning_service import PlanningService
from ...dependencies import get_planning_service
from ...models.planning import WeeklyPlanResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# WEEKLY PLAN (computed on-demand from live Firestore state)
# ============================================================================

@router.get("/{student_id}", response_model=WeeklyPlanResponse)
async def get_weekly_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """
    Get the weekly pacing snapshot for a student.

    Returns per-subject stats: closed, in-review, not-started skill counts;
    behind/ahead indicators; weekly new-skill targets; and review reserve.

    This is computed live from Firestore — not cached or stored.
    """
    try:
        logger.info(f"GET /weekly-planner/{student_id}")
        plan = await service.get_weekly_plan(student_id)
        return plan

    except Exception as e:
        logger.error(f"Error computing weekly plan for student {student_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute weekly plan: {str(e)}",
        )


# ============================================================================
# SCHOOL YEAR CONFIG (admin)
# ============================================================================

@router.get("/admin/school-year-config")
async def get_school_year_config(
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """Get the current school year configuration from Firestore."""
    try:
        config = await service.firestore.get_school_year_config()
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No school year config found. Run seed script.",
            )
        return config
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting school year config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def weekly_planner_health():
    """Health check for the algorithmic weekly planner."""
    return {
        "status": "healthy",
        "service": "weekly_planner",
        "engine": "algorithmic_firestore_native",
        "features": {
            "weekly_pacing": True,
            "completion_factor_model": True,
            "review_scheduling": True,
            "knowledge_graph_integration": True,
            "llm_planning": False,
            "bigquery_dependency": False,
            "cosmos_db_dependency": False,
        },
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }
