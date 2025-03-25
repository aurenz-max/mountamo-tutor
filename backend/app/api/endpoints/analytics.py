# endpoints/analytics.py

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from ...dependencies import get_analytics_extension
from ...services.analytics import AnalyticsExtension

router = APIRouter()

# Request and Response Models
class DateRangeParams(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None



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
    attempted_subskills: int  # Renamed from 'attempted'
    total_subskills: int      # Renamed from 'total'
    attempt_count: int        # Added for consistency
    subskills: List[SubskillModel]

class UnitModel(BaseModel):
    unit_id: str
    unit_title: str
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempted_skills: int     # Renamed from 'attempted'
    total_skills: int         # Renamed from 'total'
    attempt_count: int        # Added for consistency
    skills: List[SkillModel]

class SummaryModel(BaseModel):
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempted_items: int      # Renamed from 'attempted_items'
    total_items: int
    attempt_count: int        # Renamed from 'raw_attempt_count' for consistency
    ready_items: int
    recommended_items: int

class MetricsResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    date_range: Dict = Field(default_factory=dict)
    summary: SummaryModel
    hierarchical_data: List[UnitModel]



class TimeseriesMetricsModel(BaseModel):
    mastery: float
    proficiency: float
    avg_score: float
    completion: float
    attempt_count: int
    attempted_items: int
    total_items: int
    ready_items: int

class TimeseriesDataPoint(BaseModel):
    interval_date: str
    metrics: TimeseriesMetricsModel
    subject: Optional[str] = None
    unit_id: Optional[str] = None
    unit_title: Optional[str] = None
    skill_id: Optional[str] = None
    skill_description: Optional[str] = None
    subskill_id: Optional[str] = None
    subskill_description: Optional[str] = None

class TimeseriesInterval(BaseModel):
    interval_date: str
    summary: SummaryModel  # Reuse the same summary model used in hierarchical metrics
    hierarchical_data: Optional[List] = None  # Optional hierarchy data if requested

class TimeseriesResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    date_range: Dict = Field(default_factory=dict)
    interval: str
    level: str
    intervals: List[TimeseriesInterval]



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

@router.get("/student/{student_id}/metrics", response_model=MetricsResponse)
async def get_student_metrics(
    student_id: int,
    subject: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
):
    """
    Get comprehensive hierarchical metrics for a student, optionally filtered by subject and date range.
    Includes mastery, completion and proficiency data at all levels of the curriculum hierarchy.
    """
    try:
        metrics = await analytics_service.get_hierarchical_metrics(
            student_id, subject, start_date, end_date
        )
        return {
            "student_id": student_id,
            "subject": subject,
            "date_range": metrics["date_range"],
            "summary": metrics["summary"],
            "hierarchical_data": metrics["hierarchical_data"]
        }
    except Exception as e:
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
    include_hierarchy: bool = Query(False, description="Include hierarchical data for each interval"),
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
):
    """
    Get metrics over time for a student at the specified hierarchy level.
    Returns metrics summarized by the specified time interval.
    Optionally includes hierarchical data for each time interval.
    """
    try:
        timeseries = await analytics_service.get_timeseries_metrics(
            student_id, subject, interval, level, start_date, end_date, 
            unit_id, skill_id, include_hierarchy
        )
        return {
            "student_id": student_id,
            "subject": subject,
            "date_range": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            },
            "interval": interval,
            "level": level,
            "intervals": timeseries
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error retrieving timeseries metrics: {str(e)}"
        )

@router.get("/student/{student_id}/recommendations", response_model=List[RecommendationResponse])
async def get_student_recommendations(
    student_id: int,
    subject: Optional[str] = None,
    limit: int = Query(5, ge=1, le=20),
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
):
    """
    Get recommended next steps for a student based on priority and readiness.
    """
    try:
        recommendations = await analytics_service.get_recommendations(
            student_id, subject, limit
        )
        return recommendations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error generating recommendations: {str(e)}"
        )
