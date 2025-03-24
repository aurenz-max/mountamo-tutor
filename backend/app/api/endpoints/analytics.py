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

class MetricsResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    date_range: Dict = Field(default_factory=dict)
    summary: Dict
    hierarchical_data: List[Dict]

class TimeseriesResponse(BaseModel):
    student_id: int
    subject: Optional[str] = None
    interval: str
    data: List[Dict]

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
    priority_level: str
    is_ready: bool
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
            "date_range": metrics["date_range"],  # Access at top level
            "summary": metrics["summary"],        # Access summary directly
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
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
):
    """
    Get metrics over time for a student at the specified hierarchy level.
    """
    try:
        timeseries = await analytics_service.get_timeseries_metrics(
            student_id, subject, interval, level, start_date, end_date, unit_id, skill_id
        )
        return {
            "student_id": student_id,
            "subject": subject,
            "level": level,
            "interval": interval,
            "data": timeseries
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
