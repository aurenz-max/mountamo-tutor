from fastapi import APIRouter, HTTPException
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any
from ...services.competency import CompetencyService

router = APIRouter()
competency_service = CompetencyService()



@router.get("/subjects")
async def get_available_subjects():
    """List all available subjects"""
    return list(competency_service.syllabus_cache.keys())
    

@router.get("/curriculum/{subject}")
async def get_subject_curriculum(subject: str) -> Dict[str, Any]:
    """Get complete curriculum structure for a subject"""
    try:
        curriculum = competency_service.get_curriculum(subject)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Subject not found")
            
        return {
            "subject": subject,
            "curriculum": curriculum  # Just return the structured curriculum
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/problem-types/{subject}")
async def get_problem_types(subject: str):
    """Get all available problem types (subskills)"""
    types = competency_service.get_subskill_types(subject)
    if not types:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"subject": subject, "problem_types": types}

# @router.get("/objectives/{subject}/{subskill_id}")
# async def get_detailed_objectives(subject: str, subskill_id: str):
#     """Get detailed objectives for a specific subskill in a subject"""
#     try:
#         if subject not in OBJECTIVES_FILES:
#             raise HTTPException(
#                 status_code=404, 
#                 detail=f"Detailed objectives not available for {subject}"
#             )
            
#         objectives_path = DATA_DIR / OBJECTIVES_FILES[subject]
#         if not objectives_path.exists():
#             raise HTTPException(
#                 status_code=404, 
#                 detail=f"Objectives file for {subject} not found"
#             )
            
#         df = pd.read_csv(objectives_path)
#         objectives = df[df["SubskillID"] == subskill_id].to_dict(orient="records")
        
#         if not objectives:
#             raise HTTPException(
#                 status_code=404, 
#                 detail=f"No objectives found for subskill {subskill_id}"
#             )
            
#         return objectives
        
#     except Exception as e:
#         raise HTTPException(
#             status_code=500, 
#             detail=f"Error loading objectives: {str(e)}"
#         )