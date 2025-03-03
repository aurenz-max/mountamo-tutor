# backend/app/api/endpoints/competency.py

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from pydantic import BaseModel

# Import dependencies
from ...dependencies import get_competency_service, get_analytics_extension
from ...services.competency import CompetencyService, AnalyticsExtension

router = APIRouter()

class CompetencyUpdate(BaseModel):
    student_id: int
    subject: str
    skill: str
    subskill: str
    session_evaluation: Dict[str, Any]

class CompetencyQuery(BaseModel):
    student_id: int
    subject: str
    skill: str
    subskill: str

@router.post("/update")
async def update_competency(
    request: CompetencyUpdate,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Update a student's competency based on session performance"""
    try:
        result = await competency_service.update_competency(
            student_id=request.student_id,
            subject=request.subject,
            skill=request.skill,
            subskill=request.subskill,
            session_evaluation=request.session_evaluation
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}")
async def get_student_overview(
    student_id: int,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get overview of all competencies for a student"""
    try:
        overview = await competency_service.get_student_overview(student_id)
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/student/{student_id}/subject/{subject}/skill/{skill_id}/subskill/{subskill_id}")
async def get_competency(
    student_id: int,
    subject: str,
    skill_id: str,
    subskill_id: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get specific competency level for a student at the subskill level (RESTful URL)"""
    try:
        competency = await competency_service.get_competency(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id
        )
        if competency is None: # Handle None case - no competency data found
            return {
                "student_id": student_id,
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "current_score": 0, # Or another default like 0.0
                "credibility": 0,
                "total_attempts": 0
            }
        return competency
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/student/{student_id}/subject/{subject}/skill/{skill_id}")  # New endpoint for skill-level competency
async def get_skill_competency_endpoint(
    student_id: int,
    subject: str,
    skill_id: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get competency level for a student at the skill level"""
    try:
        competency = await competency_service.get_competency(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=""  # Important: Pass empty string for subskill_id to get skill-level competency
        )
        return competency
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/subject/{subject}/skill/{skill_id}/subskill/{subskill_id}") # Existing endpoint for subskill-level competency
async def get_subskill_competency_endpoint( # Renamed to be more specific
    student_id: int,
    subject: str,
    skill_id: str,
    subskill_id: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get specific competency level for a student at the subskill level"""
    try:
        competency = await competency_service.get_competency(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id # Now correctly uses subskill_id
        )
        return competency
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/progress")
async def get_student_progress(
    student_id: int,
    days: int = 7,
    subject: str = "Mathematics",
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
) -> Dict[str, Any]:
    """Get comprehensive progress data for student analytics dashboard"""
    try:
        # Get daily progress data
        daily_progress = await analytics_service.get_daily_progress(student_id, days)
        
        # Get skill competencies
        skill_competencies = await analytics_service.get_skill_competencies(student_id, subject)
        
        # Get detailed analytics
        detailed_analytics = await analytics_service.get_detailed_analytics(student_id, subject)
        
        return {
            "dailyProgress": daily_progress,
            "skillCompetencies": skill_competencies,
            "detailedAnalytics": detailed_analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/daily")
async def get_daily_progress(
    student_id: int, 
    days: int = 7,
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
) -> List[Dict[str, Any]]:
    """Get daily progress metrics for specified time range"""
    try:
        return await analytics_service.get_daily_progress(student_id, days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/skills/{subject}")
async def get_skill_analysis(
    student_id: int, 
    subject: str,
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
) -> List[Dict[str, Any]]:
    """Get skill competency analysis for a subject"""
    try:
        return await analytics_service.get_skill_competencies(student_id, subject)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/detailed/{subject}")
async def get_detailed_analytics(
    student_id: int, 
    subject: str,
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension)
) -> Dict[str, Any]:
    """Get detailed analytics for a subject"""
    try:
        return await analytics_service.get_detailed_analytics(student_id, subject)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subjects")
async def get_available_subjects(
    competency_service: CompetencyService = Depends(get_competency_service)
):
    """List all available subjects with loaded curriculum"""
    return list(competency_service.syllabus_cache.keys())

@router.get("/curriculum/{subject}")
async def get_subject_curriculum(
    subject: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get complete curriculum structure for a subject"""
    curriculum = await competency_service.get_curriculum(subject)
    if not curriculum:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"subject": subject, "curriculum": curriculum}

@router.get("/objectives/{subject}/{subskill_id}")
async def get_detailed_objectives(
    subject: str, 
    subskill_id: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get detailed learning objectives for a subskill"""
    try:
        objectives = await competency_service.get_detailed_objectives(subject, subskill_id)
        return {
            "subject": subject,
            "subskill_id": subskill_id,
            "objectives": objectives
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/problem-types/{subject}")
async def get_subskill_types(
    subject: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get all available problem types (subskills) for a subject"""
    types = await competency_service.get_subskill_types(subject)
    if not types:
        raise HTTPException(status_code=404, detail="Subject not found or no subskills available")
    return {"subject": subject, "problem_types": types}