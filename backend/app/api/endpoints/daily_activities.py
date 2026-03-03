# backend/app/api/endpoints/daily_activities.py
"""
Daily Activities API Endpoints — Algorithmic Firestore-Native Engine

Replaces the BigQuery/AI/CosmosDB daily planner with a deterministic
session router that reads live state from Firestore (PRD Section 5).

Plans are computed on-demand — no stored plans needed.
"""

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from typing import Optional
from datetime import datetime
import logging

from ...core.middleware import get_user_context
from ...services.planning_service import PlanningService
from ...dependencies import get_planning_service
from ...models.planning import DailyPlanResponse
from ...models.lesson_plan import DailySessionPlan

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# DAILY PLAN (computed on-demand from live Firestore state)
# ============================================================================

@router.get("/daily-plan/{student_id}", response_model=DailyPlanResponse)
async def get_daily_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """
    Get today's prioritised session queue for a student.

    Returns a list of review sessions and new skill sessions, ordered by
    priority.  Reviews come first (tight-loop recovery items at the top),
    followed by new skills allocated proportionally to weekly pacing targets.

    This is computed live from Firestore — not cached or stored.
    """
    try:
        logger.info(f"GET /daily-activities/daily-plan/{student_id}")
        plan = await service.get_daily_plan(student_id)
        return plan

    except Exception as e:
        logger.error(f"Error computing daily plan for student {student_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compute daily plan: {str(e)}",
        )


@router.get("/daily-plan/{student_id}/activities")
async def get_daily_activities(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """
    Get activities list from the daily plan.

    Returns the same data as the daily plan endpoint but in a flat
    activities-focused format for backward compatibility with the frontend.
    """
    try:
        plan = await service.get_daily_plan(student_id)

        return {
            "student_id": student_id,
            "date": plan.date,
            "activities": plan.sessions,
            "summary": {
                "total_sessions": len(plan.sessions),
                "review_slots": plan.review_slots,
                "new_slots": plan.new_slots,
                "capacity": plan.capacity,
            },
            "week_progress": {
                subj: prog.model_dump()
                for subj, prog in plan.week_progress.items()
            },
            "warnings": plan.warnings,
        }

    except Exception as e:
        logger.error(f"Error getting activities for student {student_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STRUCTURED SESSION PLAN — PRD Daily Learning Experience §3
# ============================================================================

@router.get("/daily-plan/{student_id}/session", response_model=DailySessionPlan)
async def get_daily_session_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: PlanningService = Depends(get_planning_service),
):
    """
    Get today's structured session plan as 4–5 lesson blocks.

    Unlike /daily-plan (flat skill list), this endpoint:
      - Fills a 75-minute time budget (configurable)
      - Groups related subskills into Bloom's-ordered lesson blocks
      - Returns an ordered sequence ready for the session runner

    PRD §3.3 — Queue assembly with review cap (50% of budget for reviews).
    PRD §3.4 — Session shape: interleaved subjects, front-loaded new content.
    """
    try:
        logger.info(f"GET /daily-activities/daily-plan/{student_id}/session")
        plan = await service.get_daily_session_plan(student_id)
        return plan
    except Exception as e:
        logger.error(f"Error building session plan for student {student_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to build session plan: {str(e)}",
        )


# ============================================================================
# ACTIVITY COMPLETION
#
# Session completions are now handled via the existing competency update flow:
#   POST /competency/update → CompetencyService → MasteryLifecycleEngine hook
#
# The endpoints below are kept for explicit plan-level completion tracking.
# ============================================================================

@router.post("/daily-plan/{student_id}/activities/{activity_id}/complete")
async def mark_activity_completed(
    student_id: int,
    activity_id: str,
    user_context: dict = Depends(get_user_context),
):
    """
    Mark a daily-plan activity as completed.

    The actual competency and review-engine updates happen through the
    existing POST /competency/update flow.  This endpoint is for frontend
    UI state tracking.
    """
    try:
        logger.info(f"Activity {activity_id} completed by student {student_id}")

        return {
            "success": True,
            "activity_id": activity_id,
            "student_id": student_id,
            "message": "Activity marked as completed.",
        }

    except Exception as e:
        logger.error(f"Error completing activity {activity_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-plan/{student_id}/complete")
async def complete_daily_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
):
    """Mark the entire daily plan as completed."""
    try:
        logger.info(f"Daily plan completed by student {student_id}")
        return {
            "success": True,
            "student_id": student_id,
            "message": "Daily plan completed!",
        }
    except Exception as e:
        logger.error(f"Error completing daily plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/daily-activities/health")
async def daily_activities_health():
    """Health check for the algorithmic daily activities service."""
    return {
        "status": "healthy",
        "service": "daily_activities",
        "engine": "algorithmic_firestore_native",
        "features": {
            "review_queue": True,
            "capacity_allocation": True,
            "knowledge_graph_selection": True,
            "completion_factor_model": True,
            "bigquery_dependency": False,
            "ai_recommendations": False,
            "cosmos_db_persistence": False,
        },
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
    }
