from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List, Any

# Import dependencies
from ...dependencies import get_competency_service
from ...services.competency import CompetencyService

router = APIRouter()

@router.get("/subjects")
async def get_available_subjects(
    competency_service: CompetencyService = Depends(get_competency_service)
):
    """List all available subjects"""
    return list(competency_service.syllabus_cache.keys())
    
@router.get("/curriculum/{subject}")
async def get_subject_curriculum(
    subject: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get complete curriculum structure for a subject"""
    try:
        curriculum = await competency_service.get_curriculum(subject)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Subject not found")
            
        return {
            "subject": subject,
            "curriculum": curriculum  # Just return the structured curriculum
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subskills/{subject}")
async def get_subskills(
    subject: str,
    competency_service: CompetencyService = Depends(get_competency_service)
):
    """Get all available problem types (subskills)"""
    types = await competency_service.get_subskill_types(subject)
    if not types:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"subject": subject, "problem_types": types}

@router.get("/objectives/{subject}/{subskill_id}")
async def get_detailed_objectives(
    subject: str, 
    subskill_id: str,
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Get detailed learning objectives for a subskill"""
    try:
        objectives = await competency_service.get_detailed_objectives(subject, subskill_id)
        if not objectives:
            raise HTTPException(
                status_code=404, 
                detail=f"No objectives found for subskill {subskill_id}"
            )
        
        return {
            "subject": subject,
            "subskill_id": subskill_id,
            "objectives": objectives
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error loading objectives: {str(e)}"
        )