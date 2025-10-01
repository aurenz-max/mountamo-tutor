# backend/app/api/endpoints/weekly_planner.py
"""
Weekly Planner API Endpoints
Provides endpoints for generating, retrieving, and managing weekly learning plans
Phase 1: Shadow mode testing and manual generation
"""

from fastapi import APIRouter, HTTPException, Query, Path, Depends, status
from typing import Optional
from datetime import datetime, timedelta
import logging

from ...core.config import settings
from ...core.middleware import get_user_context
from ...services.weekly_planner import WeeklyPlannerService
from ...models.weekly_plan import (
    WeeklyPlan, WeeklyPlanGenerationRequest,
    WeeklyPlanSummary, DayPlanSummary
)
from ...db.cosmos_db import CosmosDBService

logger = logging.getLogger(__name__)
router = APIRouter()


def get_weekly_planner_service() -> WeeklyPlannerService:
    """Get configured weekly planner service"""
    cosmos_db_service = CosmosDBService()

    return WeeklyPlannerService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics'),
        cosmos_db_service=cosmos_db_service
    )


# ============================================================================
# WEEKLY PLAN GENERATION (Shadow Mode / Manual Testing)
# ============================================================================

@router.post("/generate/{student_id}")
async def generate_weekly_plan(
    student_id: int,
    week_start_date: Optional[str] = Query(None, description="Week start date (Monday, YYYY-MM-DD)"),
    target_activities: int = Query(20, ge=15, le=30, description="Target number of activities"),
    force_regenerate: bool = Query(False, description="Force regeneration if plan exists"),
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Generate a weekly learning plan for a student

    **Shadow Mode:** This endpoint is for testing and manual generation.
    Daily plans do NOT yet pull from weekly plans automatically.
    """
    try:
        logger.info(f"📅 API: Generating weekly plan for student {student_id}")

        # Validate week_start_date format if provided
        if week_start_date:
            try:
                week_date = datetime.strptime(week_start_date, '%Y-%m-%d')
                if week_date.weekday() != 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="week_start_date must be a Monday"
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="week_start_date must be in YYYY-MM-DD format"
                )

        # Generate the weekly plan
        weekly_plan = await service.generate_weekly_plan(
            student_id=student_id,
            week_start_date=week_start_date,
            target_activities=target_activities,
            force_regenerate=force_regenerate
        )

        logger.info(f"✅ API: Weekly plan generated successfully for student {student_id}")

        return {
            "success": True,
            "message": "Weekly plan generated successfully",
            "plan_summary": {
                "student_id": weekly_plan.student_id,
                "week_start_date": weekly_plan.week_start_date,
                "weekly_theme": weekly_plan.weekly_theme,
                "total_activities": weekly_plan.total_activities,
                "objectives": weekly_plan.weekly_objectives
            },
            "plan": weekly_plan.dict()
        }

    except ValueError as e:
        logger.error(f"❌ API: Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ API: Error generating weekly plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate weekly plan: {str(e)}"
        )


# ============================================================================
# WEEKLY PLAN RETRIEVAL
# ============================================================================

@router.get("/{student_id}/current", response_model=WeeklyPlan)
async def get_current_weekly_plan(
    student_id: int,
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Get the current week's learning plan for a student
    Automatically calculates the current week's Monday and generates plan if none exists
    """
    try:
        logger.info(f"📅 API: Fetching current weekly plan for student {student_id}")

        # Get current week's Monday
        today = datetime.utcnow()
        monday = today - timedelta(days=today.weekday())
        week_start_date = monday.strftime('%Y-%m-%d')

        # Retrieve from Cosmos DB
        cosmos_db = service.cosmos_db_service
        plan_dict = await cosmos_db.get_weekly_plan(student_id, week_start_date)

        if not plan_dict:
            logger.info(f"📅 API: No plan found for student {student_id}, week {week_start_date}. Auto-generating...")

            # Auto-generate the weekly plan
            weekly_plan = await service.generate_weekly_plan(
                student_id=student_id,
                week_start_date=week_start_date,
                target_activities=20,
                force_regenerate=False
            )

            logger.info(f"✅ API: Auto-generated weekly plan for student {student_id}")
            return weekly_plan

        weekly_plan = WeeklyPlan(**plan_dict)
        logger.info(f"✅ API: Retrieved current weekly plan for student {student_id}")

        return weekly_plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error retrieving weekly plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve weekly plan: {str(e)}"
        )


@router.get("/{student_id}/week/{week_start_date}", response_model=WeeklyPlan)
async def get_weekly_plan_by_date(
    student_id: int,
    week_start_date: str,
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Get a specific week's learning plan for a student
    """
    try:
        # Validate date format
        try:
            week_date = datetime.strptime(week_start_date, '%Y-%m-%d')
            if week_date.weekday() != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="week_start_date must be a Monday"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="week_start_date must be in YYYY-MM-DD format"
            )

        logger.info(f"📅 API: Fetching weekly plan for student {student_id}, week {week_start_date}")

        # Retrieve from Cosmos DB
        cosmos_db = service.cosmos_db_service
        plan_dict = await cosmos_db.get_weekly_plan(student_id, week_start_date)

        if not plan_dict:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No weekly plan found for student {student_id}, week {week_start_date}"
            )

        weekly_plan = WeeklyPlan(**plan_dict)
        logger.info(f"✅ API: Retrieved weekly plan for student {student_id}")

        return weekly_plan

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error retrieving weekly plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve weekly plan: {str(e)}"
        )


@router.get("/{student_id}/status")
async def get_weekly_plan_status(
    student_id: int,
    week_start_date: Optional[str] = Query(None, description="Week start date. If None, uses current week."),
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Get status summary of a weekly plan (progress, completion, etc.)
    """
    try:
        # Use current week if not specified
        if not week_start_date:
            today = datetime.utcnow()
            monday = today - timedelta(days=today.weekday())
            week_start_date = monday.strftime('%Y-%m-%d')

        logger.info(f"📅 API: Fetching status for student {student_id}, week {week_start_date}")

        status_data = await service.get_weekly_plan_status(student_id, week_start_date)

        if not status_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No weekly plan found for student {student_id}, week {week_start_date}"
            )

        return status_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error getting plan status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get plan status: {str(e)}"
        )


@router.get("/{student_id}/day/{day_index}")
async def get_activities_for_day(
    student_id: int,
    day_index: int = Path(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)"),
    week_start_date: Optional[str] = Query(None, description="Week start date. If None, uses current week."),
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Get all activities planned for a specific day of the week
    """
    try:
        # Use current week if not specified
        if not week_start_date:
            today = datetime.utcnow()
            monday = today - timedelta(days=today.weekday())
            week_start_date = monday.strftime('%Y-%m-%d')

        logger.info(f"📅 API: Fetching day {day_index} activities for student {student_id}")

        # Retrieve plan
        cosmos_db = service.cosmos_db_service
        plan_dict = await cosmos_db.get_weekly_plan(student_id, week_start_date)

        if not plan_dict:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No weekly plan found for student {student_id}, week {week_start_date}"
            )

        weekly_plan = WeeklyPlan(**plan_dict)

        # Get activities for the specified day
        day_activities = weekly_plan.get_activities_for_day(day_index)

        # Calculate day date
        day_date = datetime.strptime(week_start_date, '%Y-%m-%d') + timedelta(days=day_index)
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        return {
            "student_id": student_id,
            "week_start_date": week_start_date,
            "day": {
                "index": day_index,
                "name": day_names[day_index],
                "date": day_date.strftime('%Y-%m-%d')
            },
            "total_activities": len(day_activities),
            "activities": [act.dict() for act in day_activities]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error getting day activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get day activities: {str(e)}"
        )


# ============================================================================
# ACTIVITY STATUS UPDATES
# ============================================================================

@router.post("/{student_id}/activity/{activity_uid}/complete")
async def mark_activity_complete_in_weekly_plan(
    student_id: int,
    activity_uid: str,
    week_start_date: Optional[str] = Query(None, description="Week start date. If None, uses current week."),
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Mark an activity as completed in the weekly plan
    """
    try:
        # Use current week if not specified
        if not week_start_date:
            today = datetime.utcnow()
            monday = today - timedelta(days=today.weekday())
            week_start_date = monday.strftime('%Y-%m-%d')

        logger.info(f"✅ API: Marking activity {activity_uid} as complete for student {student_id}")

        # Update status in Cosmos DB
        cosmos_db = service.cosmos_db_service
        success = await cosmos_db.update_activity_status_in_weekly_plan(
            student_id=student_id,
            week_start_date=week_start_date,
            activity_uid=activity_uid,
            new_status="completed"
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity {activity_uid} not found in weekly plan"
            )

        return {
            "success": True,
            "message": f"Activity {activity_uid} marked as completed",
            "activity_uid": activity_uid,
            "student_id": student_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error marking activity complete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark activity complete: {str(e)}"
        )


# ============================================================================
# PLAN MANAGEMENT
# ============================================================================

@router.delete("/{student_id}/week/{week_start_date}")
async def delete_weekly_plan(
    student_id: int,
    week_start_date: str,
    user_context: dict = Depends(get_user_context),
    service: WeeklyPlannerService = Depends(get_weekly_planner_service)
):
    """
    Delete a weekly plan (useful for regeneration testing)
    """
    try:
        logger.info(f"🗑️ API: Deleting weekly plan for student {student_id}, week {week_start_date}")

        cosmos_db = service.cosmos_db_service
        success = await cosmos_db.delete_weekly_plan(student_id, week_start_date)

        if success:
            return {
                "success": True,
                "message": f"Weekly plan deleted for student {student_id}, week {week_start_date}"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weekly plan not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ API: Error deleting weekly plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete weekly plan: {str(e)}"
        )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def weekly_planner_health():
    """Health check for weekly planner service"""
    try:
        service = get_weekly_planner_service()

        return {
            "status": "healthy",
            "service": "weekly_planner",
            "mode": "shadow",  # Phase 1: Shadow mode
            "features": {
                "weekly_plan_generation": True,
                "llm_planning": True,
                "bigquery_integration": True,
                "cosmos_db_persistence": True,
                "daily_plan_integration": False,  # Phase 2
                "parent_portal_integration": False  # Phase 3
            },
            "models": {
                "llm": "gemini-2.5-flash",
                "bigquery_dataset": service.dataset_id
            },
            "version": "1.0.0-shadow",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
