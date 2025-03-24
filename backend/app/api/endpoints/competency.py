# backend/app/api/endpoints/competency.py

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel
from datetime import datetime, timedelta
import logging

# Import dependencies
from ...dependencies import get_competency_service, get_problem_recommender
from ...services.competency import CompetencyService
from ...services.recommender import ProblemRecommender


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

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

@router.get("/student/{student_id}/problem-reviews")
async def get_student_problem_reviews(
    student_id: int,
    subject: Optional[str] = None,
    skill_id: Optional[str] = None, 
    subskill_id: Optional[str] = None,
    limit: int = 100,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get detailed problem reviews with structured feedback components for a student."""
    try:
        reviews = await competency_service.get_detailed_problem_reviews(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            limit=limit
        )
        
        # Group reviews by subject and skill for easier frontend processing
        grouped_reviews = {}
        for review in reviews:
            subject_key = review["subject"]
            skill_key = review["skill_id"]
            
            if subject_key not in grouped_reviews:
                grouped_reviews[subject_key] = {}
                
            if skill_key not in grouped_reviews[subject_key]:
                grouped_reviews[subject_key][skill_key] = []
                
            grouped_reviews[subject_key][skill_key].append(review)
        
        return {
            "student_id": student_id,
            "total_reviews": len(reviews),
            "grouped_reviews": grouped_reviews,
            "reviews": reviews  # Include flat list for easier iteration if needed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
