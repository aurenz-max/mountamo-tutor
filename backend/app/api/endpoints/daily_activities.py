# backend/app/api/endpoints/daily_activities.py
# Separate endpoint for daily activities (not briefing)

from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from typing import Optional
import logging
from datetime import datetime

from ...core.config import settings
from ...core.middleware import get_user_context
from ...services.daily_activities import DailyActivitiesService, DailyPlan
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.ai_recommendations import AIRecommendationService
from ...services.engagement_service import engagement_service
from ...core.decorators import log_engagement_activity

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================================
# ENGAGEMENT METADATA EXTRACTORS
# ============================================================================

def _extract_activity_completion_metadata(kwargs: dict, result: dict) -> dict:
    """Extracts metadata for a 'daily_plan_activity_completed' activity."""
    activity_id = kwargs.get('activity_id')
    points_earned = kwargs.get('points_earned')
    return {
        "activity_name": f"Completed daily activity {activity_id}",
        "activity_id": activity_id,
        "legacy_points": points_earned
    }

def _extract_plan_completion_metadata(kwargs: dict, result: dict) -> dict:
    """Extracts metadata for a 'daily_plan_completed' activity."""
    return {
        "activity_name": "Completed entire daily plan",
        "completion_date": datetime.utcnow().isoformat()
    }

def get_daily_activities_service() -> DailyActivitiesService:
    """Get configured daily activities service with BigQuery and AI recommendations integration"""
    analytics_service = BigQueryAnalyticsService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )
    
    ai_recommendation_service = AIRecommendationService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )
    
    return DailyActivitiesService(
        analytics_service=analytics_service,
        ai_recommendation_service=ai_recommendation_service
    )

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
    """Get activities list with enhanced transparency metadata"""
    try:
        service = get_daily_activities_service()
        daily_plan = await service.generate_daily_plan(student_id, date)
        
        # Enhanced activity data with full transparency
        enhanced_activities = []
        ai_activities_count = 0
        bigquery_activities_count = 0
        fallback_activities_count = 0
        
        for activity in daily_plan.activities:
            activity_data = activity.dict()
            
            # Add transparency metadata
            if activity_data.get('metadata', {}).get('from_ai_recommendations'):
                ai_activities_count += 1
                activity_data['source_type'] = 'ai_recommendations'
                activity_data['source_details'] = {
                    'ai_reason': activity_data.get('metadata', {}).get('ai_reason', 'No reason provided'),
                    'priority_rank': activity_data.get('metadata', {}).get('priority_rank'),
                    'estimated_time_minutes': activity_data.get('metadata', {}).get('estimated_time_minutes')
                }
            elif activity_data.get('metadata', {}).get('fallback'):
                fallback_activities_count += 1
                activity_data['source_type'] = 'fallback'
                activity_data['source_details'] = {
                    'reason': 'No personalized recommendations available'
                }
            else:
                bigquery_activities_count += 1
                activity_data['source_type'] = 'bigquery_recommendations'
                activity_data['source_details'] = {
                    'readiness_status': activity_data.get('metadata', {}).get('readiness_status'),
                    'mastery_level': activity_data.get('metadata', {}).get('mastery_level')
                }
            
            # Add curriculum transparency if available
            if activity_data.get('curriculum_metadata'):
                curriculum = activity_data['curriculum_metadata']
                activity_data['curriculum_transparency'] = {
                    'subject': curriculum.get('subject'),
                    'unit': curriculum.get('unit', {}).get('title'),
                    'skill': curriculum.get('skill', {}).get('description'),
                    'subskill': curriculum.get('subskill', {}).get('description')
                }
            
            enhanced_activities.append(activity_data)
        
        # Enhanced response with full transparency
        response = {
            "student_id": student_id,
            "date": daily_plan.date,
            "activities": enhanced_activities,
            "summary": {
                "total_activities": len(daily_plan.activities),
                "total_points": daily_plan.total_points,
                "personalization_source": daily_plan.personalization_source,
                "source_breakdown": {
                    "ai_recommendations": ai_activities_count,
                    "bigquery_recommendations": bigquery_activities_count,
                    "fallback": fallback_activities_count
                }
            },
            "transparency": {
                "recommendation_engine": daily_plan.personalization_source,
                "generation_timestamp": datetime.now().isoformat(),
                "ai_enabled": service.ai_recommendation_service is not None,
                "bigquery_enabled": service.analytics_service is not None
            }
        }
        
        # Add session plan details if available from AI
        if hasattr(daily_plan, 'session_plan') and daily_plan.session_plan:
            response["transparency"]["session_plan"] = daily_plan.session_plan
        
        return response
        
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
@log_engagement_activity(
    activity_type="daily_plan_activity_completed",
    metadata_extractor=_extract_activity_completion_metadata
)
async def mark_activity_completed(
    student_id: int, 
    activity_id: str,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    points_earned: Optional[int] = Query(None)
):
    """Mark an activity as completed. XP is handled automatically."""
    try:
        logger.info(f"Activity {activity_id} completed by student {student_id}")
        
        # The endpoint is now ONLY responsible for the activity completion logic
        return {
            "success": True,
            "activity_id": activity_id,
            "student_id": student_id,
            "message": "Activity completed successfully",
        }
        
    except Exception as e:
        logger.error(f"Error completing activity {activity_id} for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-plan/{student_id}/complete")
@log_engagement_activity(
    activity_type="daily_plan_completed",
    metadata_extractor=_extract_plan_completion_metadata
)
async def complete_daily_plan(
    student_id: int,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context)
):
    """Mark the entire daily plan as completed. Bonus XP is handled automatically."""
    try:
        logger.info(f"Daily plan completed by student {student_id}")
        
        # The endpoint is now ONLY responsible for the plan completion logic
        return {
            "success": True,
            "student_id": student_id,
            "message": "Daily plan completed! Bonus XP awarded!",
        }
        
    except Exception as e:
        logger.error(f"Error completing daily plan for student {student_id}: {str(e)}")
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
