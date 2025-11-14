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
    """Get configured daily activities service with BigQuery, AI recommendations, Cosmos DB, and LearningPaths integration"""
    from ...db.cosmos_db import CosmosDBService
    from ...db.firestore_service import FirestoreService
    from ...services.learning_paths import LearningPathsService

    analytics_service = BigQueryAnalyticsService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

    ai_recommendation_service = AIRecommendationService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

    cosmos_db_service = CosmosDBService()

    # Initialize FirestoreService for curriculum graph access
    firestore_service = FirestoreService(
        project_id=settings.GCP_PROJECT_ID
    )

    # Initialize LearningPathsService for prerequisite-based skill unlocking
    learning_paths_service = LearningPathsService(
        analytics_service=analytics_service,
        firestore_service=firestore_service,
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

    return DailyActivitiesService(
        analytics_service=analytics_service,
        ai_recommendation_service=ai_recommendation_service,
        cosmos_db_service=cosmos_db_service,
        learning_paths_service=learning_paths_service
    )

@router.get("/daily-plan/{student_id}", response_model=DailyPlan)
async def get_daily_plan(
    student_id: int,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format")
):
    """
    Get persistent daily plan for a student
    - Retrieves from Cosmos DB if exists
    - Generates new plan if not found
    - Saves new plans to Cosmos DB for persistence
    """
    try:
        logger.info(f"Getting daily plan for student {student_id}")

        service = get_daily_activities_service()
        daily_plan = await service.get_or_generate_daily_plan(student_id, date, force_refresh=False)

        logger.info(f"Retrieved plan with {len(daily_plan.activities)} activities using {daily_plan.personalization_source}")
        return daily_plan

    except Exception as e:
        logger.error(f"Error getting daily plan for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get daily plan: {str(e)}")

@router.get("/daily-plan/{student_id}/activities")
async def get_daily_activities(student_id: int, date: Optional[str] = Query(None)):
    """Get activities list with enhanced transparency metadata from persistent daily plan"""
    try:
        service = get_daily_activities_service()
        daily_plan = await service.get_or_generate_daily_plan(student_id, date, force_refresh=False)
        
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
            "progress": daily_plan.progress.dict() if daily_plan.progress else None,  # ✅ ADDED: Include progress field
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

        # 🔍 DEBUG LOGGING: Log progress data being sent to frontend
        logger.info(f"📊 Sending daily plan response for student {student_id}:")
        logger.info(f"   - Activities: {len(enhanced_activities)}")
        logger.info(f"   - Progress: {response['progress']}")
        logger.info(f"   - Activity completion states: {[(a['id'], a.get('is_complete', False)) for a in enhanced_activities[:3]]}")

        return response
        
    except Exception as e:
        logger.error(f"Error getting activities for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/daily-plan/{student_id}/refresh")
async def refresh_daily_plan(student_id: int):
    """Force refresh/regenerate the daily plan (deletes existing and creates new)"""
    try:
        logger.info(f"Force refreshing daily plan for student {student_id}")

        service = get_daily_activities_service()
        daily_plan = await service.get_or_generate_daily_plan(student_id, force_refresh=True)

        return {
            "success": True,
            "message": "Daily plan refreshed and saved successfully",
            "plan": daily_plan.dict()
        }

    except Exception as e:
        logger.error(f"Error refreshing daily plan for student {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def hydrate_plan_completion(student_id: int, activity_id: str):
    """Background task to update the daily plan document in Cosmos DB AND the weekly plan if applicable."""
    try:
        from ...db.cosmos_db import CosmosDBService
        from datetime import datetime, timedelta

        cosmos_db = CosmosDBService()
        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        # Step 1: Update daily plan completion
        success = await cosmos_db.update_activity_completion(
            student_id=student_id,
            date=today_str,
            activity_id=activity_id,
            is_complete=True
        )

        if success:
            logger.info(f"✅ Hydrated plan completion: marked activity {activity_id} as complete for student {student_id}")
        else:
            logger.warning(f"⚠️ Could not find activity {activity_id} in daily plan for student {student_id} to hydrate")

        # Step 2: CRITICAL - Update weekly plan if this activity came from a weekly plan
        # Extract activity_uid from activity_id if it's from weekly plan
        if activity_id.startswith("weekly-"):
            activity_uid = activity_id.replace("weekly-", "")
            logger.info(f"📅 Activity came from weekly plan, updating weekly plan status for {activity_uid}")

            # Calculate current week's Monday
            today = datetime.utcnow()
            monday = today - timedelta(days=today.weekday())
            week_start_date = monday.strftime('%Y-%m-%d')

            # Update the weekly plan
            weekly_success = await cosmos_db.update_activity_status_in_weekly_plan(
                student_id=student_id,
                week_start_date=week_start_date,
                activity_uid=activity_uid,
                new_status="completed"
            )

            if weekly_success:
                logger.info(f"✅ Updated weekly plan: marked {activity_uid} as completed")
            else:
                logger.warning(f"⚠️ Could not find activity {activity_uid} in weekly plan")

    except Exception as e:
        logger.error(f"❌ Failed to hydrate plan completion for student {student_id}: {e}")

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
    """Mark an activity as completed. XP is handled automatically by decorator, persistence by background task."""
    try:
        logger.info(f"Activity {activity_id} completed by student {student_id}")

        # Add background task to hydrate the plan completion in Cosmos DB
        background_tasks.add_task(hydrate_plan_completion, student_id, activity_id)

        return {
            "success": True,
            "activity_id": activity_id,
            "student_id": student_id,
            "message": "Activity completion is being processed.",
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
    """Health check for daily activities service with persistence"""
    try:
        service = get_daily_activities_service()

        # Test the service with persistence
        test_plan = await service.get_or_generate_daily_plan(1)  # Test with student ID 1

        return {
            "status": "healthy",
            "service": "daily_activities",
            "features": {
                "bigquery_integration": service.analytics_service is not None,
                "ai_recommendations": service.ai_recommendation_service is not None,
                "cosmos_db_persistence": service.cosmos_db_service is not None,
                "activity_generation": True,
                "fallback_support": True,
                "persistent_daily_plans": True
            },
            "test_results": {
                "generated_activities": len(test_plan.activities),
                "personalization_source": test_plan.personalization_source,
                "plan_date": test_plan.date
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
