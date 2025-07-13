# backend/app/api/endpoints/daily_activities.py
# Separate endpoint for daily activities (not briefing)

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import logging
from datetime import datetime

from ...core.config import settings
from ...services.daily_activities import DailyActivitiesService, DailyPlan
from ...services.bigquery_analytics import BigQueryAnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter()

def get_daily_activities_service() -> DailyActivitiesService:
    """Get configured daily activities service with BigQuery integration"""
    analytics_service = BigQueryAnalyticsService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )
    
    return DailyActivitiesService(analytics_service=analytics_service)

@router.get("/daily-plan/{student_id}", response_model=DailyPlan)
async def get_daily_plan(
    student_id: int, 
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format")
):
    """
    Get daily plan for a student
    - Tries BigQuery recommendations first
    - Falls back to standard activities if needed
    """
    try:
        logger.info(f"Getting daily plan for student {student_id}")
        
        service = get_daily_activities_service()
        daily_plan = await service.generate_daily_plan(student_id, date)
        
        logger.info(f"Generated plan with {len(daily_plan.activities)} activities using {daily_plan.personalization_source}")
        return daily_plan
        
    except Exception as e:
        logger.error(f"Error generating daily plan for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate daily plan: {str(e)}")

@router.get("/daily-plan/{student_id}/activities")
async def get_daily_activities(student_id: int, date: Optional[str] = Query(None)):
    """Get just the activities list (simpler response)"""
    try:
        service = get_daily_activities_service()
        daily_plan = await service.generate_daily_plan(student_id, date)
        
        return {
            "student_id": student_id,
            "date": daily_plan.date,
            "activities": [activity.dict() for activity in daily_plan.activities],
            "total_activities": len(daily_plan.activities),
            "total_points": daily_plan.total_points,
            "personalization_source": daily_plan.personalization_source
        }
        
    except Exception as e:
        logger.error(f"Error getting activities for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-plan/{student_id}/refresh")
async def refresh_daily_plan(student_id: int):
    """Force refresh/regenerate the daily plan"""
    try:
        logger.info(f"Refreshing daily plan for student {student_id}")
        
        service = get_daily_activities_service()
        daily_plan = await service.generate_daily_plan(student_id)
        
        return {
            "success": True,
            "message": "Daily plan refreshed successfully",
            "plan": daily_plan.dict()
        }
        
    except Exception as e:
        logger.error(f"Error refreshing daily plan for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-plan/{student_id}/activities/{activity_id}/complete")
async def mark_activity_completed(
    student_id: int, 
    activity_id: str,
    points_earned: Optional[int] = Query(None)
):
    """Mark an activity as completed"""
    try:
        # This would integrate with your user progress tracking
        logger.info(f"Activity {activity_id} completed by student {student_id}")
        
        # You'd implement the actual completion logic here
        # service.mark_activity_completed(student_id, activity_id, points_earned)
        
        return {
            "success": True,
            "activity_id": activity_id,
            "student_id": student_id,
            "points_earned": points_earned or 15,
            "message": "Activity marked as completed"
        }
        
    except Exception as e:
        logger.error(f"Error completing activity {activity_id} for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-activities/health")
async def daily_activities_health():
    """Health check for daily activities service"""
    try:
        service = get_daily_activities_service()
        
        # Test the service
        test_plan = await service.generate_daily_plan(1)  # Test with student ID 1
        
        return {
            "status": "healthy",
            "service": "daily_activities",
            "features": {
                "bigquery_integration": service.analytics_service is not None,
                "activity_generation": True,
                "fallback_support": True
            },
            "test_results": {
                "generated_activities": len(test_plan.activities),
                "personalization_source": test_plan.personalization_source
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
