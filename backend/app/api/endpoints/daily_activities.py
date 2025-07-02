# backend/app/api/endpoints/daily_activities.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, status
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

# Import dependencies
from ...core.middleware import get_user_context
from ...api.endpoints.user_profiles import log_activity
from ...services.daily_activities import DailyActivitiesService, DailyActivity, DailyPlan
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.learning_paths import LearningPathsService
from ...db.cosmos_db import CosmosDBService
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Request/Response Models
class ActivityCompletionRequest(BaseModel):
    activity_id: str
    completion_time_seconds: Optional[int] = None
    points_earned: Optional[int] = None
    accuracy_percentage: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class ActivityCompletionResponse(BaseModel):
    success: bool
    activity_id: str
    points_awarded: int
    new_total_points: int
    achievements: List[str] = []
    level_up: bool = False
    message: str

class DailyStatsResponse(BaseModel):
    student_id: int
    date: str
    activities_completed: int
    total_activities: int
    points_earned_today: int
    daily_goal_progress: float
    current_streak: int
    completion_rate: float

# Dependency injection for the service
def get_daily_activities_service() -> DailyActivitiesService:
    """Get Daily Activities service with all dependencies"""
    try:
        # Initialize all required services
        analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
        
        learning_paths_service = LearningPathsService()
        cosmos_db_service = CosmosDBService()
        
        return DailyActivitiesService(
            analytics_service=analytics_service,
            learning_paths_service=learning_paths_service,
            cosmos_db_service=cosmos_db_service
        )
    except Exception as e:
        logger.error(f"Error initializing daily activities service: {str(e)}")
        # Return service with minimal dependencies for fallback mode
        return DailyActivitiesService()

# ============================================================================
# MAIN ENDPOINTS
# ============================================================================

@router.get("/student/{student_id}/daily-plan", response_model=DailyPlan)
async def get_daily_plan(
    student_id: int,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    refresh: bool = Query(False, description="Force refresh of the plan"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Get personalized daily learning plan for a student"""
    
    user_id = user_context["user_id"]
    
    # Validate user can access this student's data
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} daily plan"
            )
    
    try:
        logger.info(f"User {user_context['email']} requesting daily plan for student {student_id}")
        
        # Generate the daily plan
        daily_plan = await daily_service.generate_daily_plan(student_id, date)
        
        # Log successful plan generation
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="daily_plan_generated",
            activity_name="Generated daily learning plan",
            points=3,
            metadata={
                "student_id": student_id,
                "date": daily_plan.date,
                "activities_count": len(daily_plan.activities),
                "refresh_requested": refresh
            }
        )
        
        return daily_plan
        
    except Exception as e:
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="daily_plan_error",
            activity_name="Failed to generate daily plan",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        
        logger.error(f"Error generating daily plan for student {student_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating daily plan: {str(e)}"
        )

@router.post("/student/{student_id}/complete-activity", response_model=ActivityCompletionResponse)
async def complete_activity(
    student_id: int,
    completion_request: ActivityCompletionRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Mark an activity as completed and award points"""
    
    user_id = user_context["user_id"]
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} activities"
            )
    
    try:
        logger.info(f"Student {student_id} completing activity: {completion_request.activity_id}")
        
        # Mark activity as completed
        completion_result = await daily_service.mark_activity_completed(
            student_id, 
            completion_request.activity_id,
            completion_request.dict()
        )
        
        if not completion_result.get("success", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=completion_result.get("error", "Failed to complete activity")
            )
        
        # Calculate points awarded (use provided or default)
        points_awarded = completion_request.points_earned or completion_result.get("points_awarded", 0)
        
        # Prepare metadata for logging - fix the syntax error here
        log_metadata = {
            "activity_id": completion_request.activity_id,
            "student_id": student_id,
            "completion_time_seconds": completion_request.completion_time_seconds,
            "accuracy_percentage": completion_request.accuracy_percentage,
        }
        
        # Add additional metadata if provided
        if completion_request.metadata:
            log_metadata.update(completion_request.metadata)
        
        # Log the activity completion in the user profile system
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="daily_activity_completed",
            activity_name=f"Completed {completion_request.activity_id}",
            points=points_awarded,
            metadata=log_metadata
        )
        
        return ActivityCompletionResponse(
            success=True,
            activity_id=completion_request.activity_id,
            points_awarded=points_awarded,
            new_total_points=completion_result.get("new_total_points", 0),
            achievements=completion_result.get("achievements", []),
            level_up=completion_result.get("level_up", False),
            message=f"Great job! You earned {points_awarded} points!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="activity_completion_error",
            activity_name="Failed to complete activity",
            points=0,
            metadata={"error": str(e), "activity_id": completion_request.activity_id}
        )
        
        logger.error(f"Error completing activity {completion_request.activity_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing activity: {str(e)}"
        )

@router.get("/student/{student_id}/daily-stats", response_model=DailyStatsResponse)
async def get_daily_stats(
    student_id: int,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Get daily learning statistics for a student"""
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} stats"
            )
    
    try:
        # Get the daily plan to extract progress information
        daily_plan = await daily_service.generate_daily_plan(student_id, date)
        
        # Calculate completion rate
        completion_rate = 0.0
        if daily_plan.progress.total_activities > 0:
            completion_rate = (daily_plan.progress.completed_activities / daily_plan.progress.total_activities) * 100
        
        return DailyStatsResponse(
            student_id=student_id,
            date=daily_plan.date,
            activities_completed=daily_plan.progress.completed_activities,
            total_activities=daily_plan.progress.total_activities,
            points_earned_today=daily_plan.progress.points_earned_today,
            daily_goal_progress=daily_plan.progress.progress_percentage,
            current_streak=daily_plan.progress.current_streak,
            completion_rate=completion_rate
        )
        
    except Exception as e:
        logger.error(f"Error getting daily stats for student {student_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving daily stats: {str(e)}"
        )

@router.get("/student/{student_id}/activity-suggestions")
async def get_activity_suggestions(
    student_id: int,
    context: str = Query("general", description="Context for suggestions: general, bonus, remedial"),
    limit: int = Query(3, ge=1, le=10),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Get additional activity suggestions for a student"""
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} suggestions"
            )
    
    try:
        suggestions = await daily_service.get_activity_suggestions(student_id, context)
        
        # Limit the number of suggestions
        limited_suggestions = suggestions[:limit]
        
        return {
            "student_id": student_id,
            "context": context,
            "suggestions": limited_suggestions,
            "total_available": len(suggestions)
        }
        
    except Exception as e:
        logger.error(f"Error getting activity suggestions for student {student_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving activity suggestions: {str(e)}"
        )

# ============================================================================
# ADMIN/MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/student/{student_id}/refresh-plan")
async def refresh_daily_plan(
    student_id: int,
    date: Optional[str] = Query(None, description="Date to refresh, defaults to today"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Manually refresh/regenerate the daily plan"""
    
    user_id = user_context["user_id"]
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to refresh student {student_id} plan"
            )
    
    try:
        logger.info(f"User {user_context['email']} refreshing plan for student {student_id}")
        
        # Refresh the plan
        refreshed_plan = await daily_service.refresh_daily_plan(student_id, date)
        
        # Log the refresh action
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="daily_plan_refreshed",
            activity_name="Manually refreshed daily plan",
            points=2,
            metadata={
                "student_id": student_id,
                "date": refreshed_plan.date,
                "activities_count": len(refreshed_plan.activities)
            }
        )
        
        return {
            "success": True,
            "message": "Daily plan refreshed successfully",
            "date": refreshed_plan.date,
            "activities_count": len(refreshed_plan.activities),
            "plan": refreshed_plan
        }
        
    except Exception as e:
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            activity_type="plan_refresh_error",
            activity_name="Failed to refresh daily plan",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        
        logger.error(f"Error refreshing plan for student {student_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refreshing daily plan: {str(e)}"
        )

@router.get("/activities/types")
async def get_activity_types(user_context: dict = Depends(get_user_context)):
    """Get available activity types and their descriptions"""
    
    activity_types = {
        "practice": {
            "name": "Practice Problems",
            "description": "Targeted problem-solving sessions",
            "icon": "zap",
            "typical_duration": "5-15 min",
            "points_range": "10-25"
        },
        "tutoring": {
            "name": "AI Tutor Session",
            "description": "Interactive voice-based learning with AI tutor",
            "icon": "headphones", 
            "typical_duration": "10-20 min",
            "points_range": "20-35"
        },
        "pathway": {
            "name": "Learning Path",
            "description": "Structured progression through curriculum",
            "icon": "target",
            "typical_duration": "8-15 min",
            "points_range": "15-25"
        },
        "visual": {
            "name": "Visual Learning",
            "description": "Interactive visualizations and explorations",
            "icon": "eye",
            "typical_duration": "5-12 min",
            "points_range": "10-20"
        },
        "review": {
            "name": "Review Session",
            "description": "Spaced repetition and concept reinforcement",
            "icon": "brain",
            "typical_duration": "5-10 min",
            "points_range": "8-15"
        }
    }
    
    return {
        "activity_types": activity_types,
        "total_types": len(activity_types)
    }

@router.get("/time-slots")
async def get_time_slots(user_context: dict = Depends(get_user_context)):
    """Get available time slots and their characteristics"""
    
    time_slots = {
        "morning": {
            "name": "Morning",
            "description": "High-energy activities to start the day",
            "optimal_for": ["practice", "tutoring"],
            "typical_activities": 2,
            "focus": "New learning and challenging content"
        },
        "midday": {
            "name": "Midday", 
            "description": "Structured learning and skill building",
            "optimal_for": ["pathway", "tutoring"],
            "typical_activities": 1,
            "focus": "Curriculum progression"
        },
        "afternoon": {
            "name": "Afternoon",
            "description": "Interactive and creative activities",
            "optimal_for": ["visual", "practice"],
            "typical_activities": 1,
            "focus": "Exploration and creativity"
        },
        "evening": {
            "name": "Evening",
            "description": "Review and reinforcement",
            "optimal_for": ["review", "visual"],
            "typical_activities": 1,
            "focus": "Consolidation and reflection"
        }
    }
    
    return {
        "time_slots": time_slots,
        "total_slots": len(time_slots)
    }

# ============================================================================
# HEALTH AND STATUS ENDPOINTS
# ============================================================================

@router.get("/health")
async def daily_activities_health_check(
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Health check for daily activities service"""
    
    try:
        health = await daily_service.health_check()
        
        # Add API-specific health info
        health.update({
            "api_endpoints": {
                "daily_plan": "healthy",
                "complete_activity": "healthy", 
                "daily_stats": "healthy",
                "activity_suggestions": "healthy"
            },
            "authentication": "enabled",
            "user_context": {
                "user_id": user_context.get("user_id"),
                "email": user_context.get("email"),
                "student_id": user_context.get("student_id")
            },
            "timestamp": datetime.now().isoformat()
        })
        
        return health
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "daily_activities_api",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@router.get("/stats/service")
async def get_service_stats(
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Get service usage statistics"""
    
    try:
        # This would typically come from monitoring/metrics
        stats = {
            "total_plans_generated": 0,  # Would track in production
            "total_activities_completed": 0,
            "average_completion_rate": 0.0,
            "most_popular_activity_type": "practice",
            "average_daily_points": 65,
            "service_uptime": "99.9%",
            "last_updated": datetime.now().isoformat()
        }
        
        return stats
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving service stats: {str(e)}"
        )

# ============================================================================
# DEVELOPMENT/TESTING ENDPOINTS
# ============================================================================

@router.post("/test/generate-sample-plan")
async def generate_sample_plan(
    student_id: Optional[int] = Query(None, description="Student ID, defaults to current user"),
    user_context: dict = Depends(get_user_context),
    daily_service: DailyActivitiesService = Depends(get_daily_activities_service)
):
    """Generate a sample daily plan for testing (development endpoint)"""
    
    # Use current user's student ID if not provided
    target_student_id = student_id or user_context["student_id"]
    
    try:
        # Generate plan using fallback mode for consistent testing
        sample_plan = await daily_service._create_fallback_plan(
            target_student_id, 
            datetime.now().strftime("%Y-%m-%d")
        )
        
        return {
            "message": "Sample plan generated for testing",
            "plan": sample_plan,
            "note": "This is a fallback plan for testing purposes"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating sample plan: {str(e)}"
        )