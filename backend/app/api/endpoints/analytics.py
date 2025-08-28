# backend/app/api/endpoints/analytics.py - SIMPLIFIED VERSION

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import hashlib
import json
import logging

# Simplified imports
from ...core.middleware import get_user_context
from ...services.user_profiles import user_profiles_service  # FIXED: Import the service instance
from ...models.user_profiles import ActivityLog  # FIXED: Import ActivityLog model
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.bigquery_etl import BigQueryETLService
from ...services.ai_recommendations import AIRecommendationService
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================================
# SIMPLIFIED CACHE - Remove user-specific complexity
# ============================================================================

analytics_cache = {}

def get_cache_key(endpoint: str, **params) -> str:
    """Generate simple cache key from endpoint and parameters"""
    # Remove user_id from cache key - simpler caching strategy
    clean_params = {k: str(v) for k, v in params.items() if v is not None}
    param_str = json.dumps(clean_params, sort_keys=True)
    param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
    return f"{endpoint}:{param_hash}"

def get_from_cache(cache_key: str, ttl_minutes: int = 10):
    """Get from cache if not expired"""
    if cache_key in analytics_cache:
        cache_entry = analytics_cache[cache_key]
        if datetime.now() - cache_entry["timestamp"] < timedelta(minutes=ttl_minutes):
            return cache_entry["data"]
        else:
            del analytics_cache[cache_key]
    return None

def set_cache(cache_key: str, data):
    """Store in cache with timestamp"""
    analytics_cache[cache_key] = {
        "data": data,
        "timestamp": datetime.now()
    }

# ============================================================================
# RESPONSE MODELS - Keep existing models unchanged
# ============================================================================

class SubskillModel(BaseModel):
    subskill_id: str
    subskill_description: str
    mastery: float
    avg_score: float
    proficiency: float
    completion: float
    is_attempted: bool
    readiness_status: str
    priority_level: str
    priority_order: int
    next_subskill: Optional[str]
    recommended_next: Optional[str]
    attempt_count: int
    individual_attempts: List[Dict]

class SkillModel(BaseModel):
    skill_id: str
    skill_description: str
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempted_subskills: int
    total_subskills: int
    attempt_count: int
    subskills: List[SubskillModel]

class UnitModel(BaseModel):
    unit_id: str
    unit_title: str
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempted_skills: int
    total_skills: int
    attempt_count: int
    skills: List[SkillModel]

class SummaryModel(BaseModel):
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempted_items: int
    total_items: int
    attempt_count: int
    ready_items: int
    recommended_items: int

class MetricsResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    date_range: Dict = Field(default_factory=dict)
    summary: SummaryModel
    hierarchical_data: List[UnitModel]
    user_id: str
    cached: bool = False
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class TimeseriesResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    date_range: Dict = Field(default_factory=dict)
    interval: str
    level: str
    intervals: List[Dict]
    user_id: str
    cached: bool = False
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class RecommendationResponse(BaseModel):
    type: str
    priority: str
    unit_id: str
    unit_title: str
    skill_id: str
    skill_description: str
    subskill_id: str
    subskill_description: str
    proficiency: float
    mastery: float
    avg_score: float
    priority_level: str
    priority_order: int
    readiness_status: str
    is_ready: bool
    completion: float
    attempt_count: int
    is_attempted: bool
    next_subskill: Optional[str]
    message: str

class AIRecommendationResponse(BaseModel):
    subject: str
    skill_description: str
    subskill_description: str
    subskill_id: str
    priority: str
    priority_rank: int
    reason: str
    estimated_time: int
    difficulty_start: Optional[float]
    difficulty_end: Optional[float]
    target_difficulty: Optional[float]
    grade: Optional[str]
    unit_title: Optional[str]
    session_plan: Dict = Field(default_factory=dict)
    generated_at: str

# ============================================================================
# DEPENDENCY INJECTION - Simplified
# ============================================================================

def get_bigquery_analytics_service() -> BigQueryAnalyticsService:
    """Get BigQuery analytics service instance"""
    return BigQueryAnalyticsService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

def get_bigquery_etl_service() -> BigQueryETLService:
    """Get BigQuery ETL service instance"""
    return BigQueryETLService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

def get_ai_recommendation_service() -> AIRecommendationService:
    """Get AI recommendation service instance"""
    return AIRecommendationService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

# ============================================================================
# SIMPLIFIED ENDPOINTS - Consistent pattern
# ============================================================================

@router.get("/student/{student_id}/metrics", response_model=MetricsResponse)
async def get_student_metrics(
    student_id: int,
    subject: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service)
):
    """Get comprehensive hierarchical metrics for a student"""
    
    user_id = user_context["user_id"]
    
    # Validate user can access this student's data
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} analytics"
            )
    
    # Check cache first (15 minute TTL)
    cache_key = get_cache_key("metrics", student_id=student_id, 
                             subject=subject, start_date=start_date, end_date=end_date)
    
    cached_result = get_from_cache(cache_key, ttl_minutes=15)
    if cached_result:        
        cached_result["cached"] = True
        cached_result["user_id"] = user_id
        return MetricsResponse(**cached_result)
    
    try:
        logger.info(f"User {user_context['email']} generating metrics for student {student_id}")
        
        # Fetch from BigQuery
        metrics = await analytics_service.get_hierarchical_metrics(
            student_id, subject, start_date, end_date
        )
        
        result = MetricsResponse(
            student_id=student_id,
            subject=subject,
            date_range=metrics["date_range"],
            summary=metrics["summary"],
            hierarchical_data=metrics["hierarchical_data"],
            user_id=user_id,
            cached=False
        )
        
        # Cache the result
        set_cache(cache_key, result.dict())
                
        return result
        
    except Exception as e:
        # Log analytics errors        
        logger.error(f"Analytics error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error retrieving metrics: {str(e)}"
        )

@router.get("/student/{student_id}/metrics/timeseries", response_model=TimeseriesResponse)
async def get_student_metrics_timeseries(
    student_id: int,
    subject: Optional[str] = None,
    interval: str = Query("month", regex="^(day|week|month|quarter|year)$"),
    level: str = Query("subject", regex="^(subject|unit|skill|subskill)$"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    unit_id: Optional[str] = None,
    skill_id: Optional[str] = None,
    include_hierarchy: bool = Query(False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service)
):
    """Get metrics over time for a student"""
    
    user_id = user_context["user_id"]
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} analytics"
            )
    
    # Check cache (10 minute TTL)
    cache_key = get_cache_key("timeseries", student_id=student_id, subject=subject,
                             interval=interval, level=level, start_date=start_date, 
                             end_date=end_date, unit_id=unit_id, skill_id=skill_id,
                             include_hierarchy=include_hierarchy)
    
    cached_result = get_from_cache(cache_key, ttl_minutes=10)
    if cached_result:        
        cached_result["cached"] = True
        cached_result["user_id"] = user_id
        return TimeseriesResponse(**cached_result)
    
    try:
        logger.info(f"User {user_context['email']} generating timeseries for student {student_id}")
        
        # Fetch from BigQuery
        timeseries = await analytics_service.get_timeseries_metrics(
            student_id, subject, interval, level, start_date, end_date, 
            unit_id, skill_id, include_hierarchy
        )
        
        result = TimeseriesResponse(
            student_id=student_id,
            subject=subject,
            date_range={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            },
            interval=interval,
            level=level,
            intervals=timeseries,
            user_id=user_id,
            cached=False
        )
        
        # Cache the result
        set_cache(cache_key, result.dict())
        
        return result
        
    except Exception as e:        
        logger.error(f"Timeseries error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error retrieving timeseries: {str(e)}"
        )

@router.get("/student/{student_id}/recommendations", response_model=List[RecommendationResponse])
async def get_student_recommendations(
    student_id: int,
    subject: Optional[str] = None,
    limit: int = Query(5, ge=1, le=20),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service)
):
    """Get recommended next steps for a student"""
    
    user_id = user_context["user_id"]
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} analytics"
            )
    
    # Check cache (5 minute TTL for recommendations)
    cache_key = get_cache_key("recommendations", student_id=student_id, 
                             subject=subject, limit=limit)
    
    cached_result = get_from_cache(cache_key, ttl_minutes=5)
    if cached_result:        
        return cached_result
    
    try:
        logger.info(f"User {user_context['email']} generating recommendations for student {student_id}")
        
        # Fetch from BigQuery
        recommendations = await analytics_service.get_recommendations(
            student_id, subject, limit
        )
        
        # Cache the result
        set_cache(cache_key, recommendations)
        
        # Log success
        high_priority_count = len([r for r in recommendations if r.get('priority') == 'high'])
                
        return recommendations
        
    except Exception as e:        
        logger.error(f"Recommendations error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error generating recommendations: {str(e)}"
        )

@router.get("/student/{student_id}/ai-recommendations", response_model=List[AIRecommendationResponse])
async def get_ai_recommendations(
    student_id: int,
    target_count: Optional[int] = Query(None, ge=1, le=10, description="Target number of recommendations (AI will choose if not specified)"),
    session_type: str = Query("daily", regex="^(daily|intensive|catch_up|review|challenge)$", description="Type of learning session"),
    focus_subjects: Optional[str] = Query(None, description="Comma-separated subjects to focus on"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    ai_service: AIRecommendationService = Depends(get_ai_recommendation_service)
):
    """Get AI-powered personalized recommendations using velocity and mastery data"""
    
    user_id = user_context["user_id"]
    
    # Validate access
    if user_context["student_id"] != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {student_id} analytics"
            )
    
    # Parse focus subjects if provided
    focus_subjects_list = None
    if focus_subjects:
        focus_subjects_list = [s.strip() for s in focus_subjects.split(",")]
    
    # Check cache (3 minute TTL for AI recommendations - shorter due to dynamic nature)
    cache_key = get_cache_key(
        "ai_recommendations", 
        student_id=student_id, 
        target_count=target_count,
        session_type=session_type, 
        focus_subjects=focus_subjects
    )
    
    cached_result = get_from_cache(cache_key, ttl_minutes=3)
    if cached_result:        
        return cached_result
    
    try:
        logger.info(f"User {user_context['email']} generating AI recommendations for student {student_id}, session_type={session_type}")
        
        # Get AI recommendations
        recommendations = await ai_service.get_ai_recommendations(
            student_id=student_id,
            target_count=target_count,
            session_type=session_type,
            focus_subjects=focus_subjects_list
        )
        
        # Convert to response format
        ai_recommendations = [
            AIRecommendationResponse(**rec) for rec in recommendations
        ]
        
        # Cache the result
        set_cache(cache_key, ai_recommendations)
        
        # Log success details
        if ai_recommendations:
            session_plan = ai_recommendations[0].session_plan
            total_time = sum(rec.estimated_time for rec in ai_recommendations)
            logger.info(f"AI recommendations generated: {len(ai_recommendations)} subskills, ~{total_time} minutes, focus: {session_plan.get('session_focus', 'balanced')}")
        
        return ai_recommendations
        
    except Exception as e:        
        logger.error(f"AI recommendations error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error generating AI recommendations: {str(e)}"
        )

# ============================================================================
# ADMIN ENDPOINTS - Simplified
# ============================================================================

@router.post("/etl/sync")
async def trigger_etl_sync(
    sync_type: str = Query("incremental", regex="^(incremental|full)$"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    etl_service: BigQueryETLService = Depends(get_bigquery_etl_service)
):
    """Trigger ETL sync and clear cache when data changes"""
    
    user_id = user_context["user_id"]
    
    try:
        logger.info(f"User {user_context['email']} triggering {sync_type} ETL sync")
        
        if sync_type == "full":
            result = await etl_service.run_full_sync()
        else:
            # Run incremental sync
            results = {}
            results['attempts'] = await etl_service.sync_attempts_from_cosmos(incremental=True)
            results['reviews'] = await etl_service.sync_reviews_from_cosmos(incremental=True)
            
            total_records = sum(r.get('records_processed', 0) for r in results.values())
            success_count = sum(1 for r in results.values() if r.get('success', False))
            
            result = {
                'success': success_count == len(results),
                'total_records_processed': total_records,
                'results': results,
                'sync_type': 'incremental'
            }
        
        # Clear cache after successful sync
        if result.get('success', False):
            analytics_cache.clear()
                        
        return result
        
    except Exception as e:
        logger.error(f"ETL error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in ETL sync: {str(e)}"
        )

@router.post("/cache/clear")
async def clear_analytics_cache(
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context)
):
    """Clear all analytics cache - admin operation"""
    user_id = user_context["user_id"]
    
    try:
        cache_size_before = len(analytics_cache)
        analytics_cache.clear()
                
        return {
            "success": True, 
            "message": "Analytics cache cleared",
            "entries_cleared": cache_size_before
        }
    except Exception as e:
        logger.error(f"Cache clear error for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}"
        )

@router.get("/cache/stats")
async def get_cache_stats(user_context: dict = Depends(get_user_context)):
    """Get cache statistics"""
    try:
        total_entries = len(analytics_cache)
        cache_types = {}
        
        for key in analytics_cache.keys():
            cache_type = key.split(':')[0]
            cache_types[cache_type] = cache_types.get(cache_type, 0) + 1
        
        return {
            "total_entries": total_entries,
            "cache_types": cache_types,
            "sample_keys": [k for k in list(analytics_cache.keys())[:5]]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting cache stats: {str(e)}"
        )

@router.get("/health")
async def analytics_health_check(
    user_context: dict = Depends(get_user_context),
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service),
    etl_service: BigQueryETLService = Depends(get_bigquery_etl_service),
    ai_service: AIRecommendationService = Depends(get_ai_recommendation_service)
):
    """Health check with user context"""
    user_id = user_context["user_id"]
    
    try:
        # Check analytics service
        analytics_health = await analytics_service.health_check()
        
        # Check ETL status
        etl_status = await etl_service.get_sync_status()
        
        # Check AI service
        ai_health = await ai_service.health_check()
        
        # Overall health
        overall_healthy = (
            analytics_health.get('status') == 'healthy' and
            ai_health.get('status') == 'healthy' and
            all(table.get('exists', False) for table in etl_status.get('tables', {}).values())
        )
        
        return {
            "status": "healthy" if overall_healthy else "unhealthy",
            "analytics_service": analytics_health,
            "ai_recommendation_service": ai_health,
            "etl_status": etl_status,
            "cache_entries": len(analytics_cache),
            "user_context": {
                "user_id": user_id,
                "email": user_context.get("email"),
                "student_id": user_context.get("student_id")
            },
            "version": "5.0.0",  # Updated version with AI recommendations
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }