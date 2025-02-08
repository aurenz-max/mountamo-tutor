# app/api/endpoints/learning_paths.py

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from pathlib import Path
import json
from ...services.learning_paths import LearningPathsService
from ...services.competency import CompetencyService

router = APIRouter()

# Initialize services
DATA_DIR = Path(__file__).parent.parent.parent / "data"
competency_service = CompetencyService()
learning_paths_service = LearningPathsService(data_dir=str(DATA_DIR), competency_service=competency_service)

# No longer need PathNode and PathEdge models

class DecisionTreeData(BaseModel): # New model for decision tree
    learning_path_decision_tree: Dict[str, List[str]]

class NextRecommendationRequest(BaseModel):
    student_id: int
    subject: str
    current_skill_id: Optional[str] = None
    current_subskill_id: Optional[str] = None




@router.get("/learning-paths", response_model=DecisionTreeData)
async def get_learning_paths():
    """Get complete learning paths decision tree"""
    try:
        paths_data = await learning_paths_service.get_learning_paths()
        print(f"Returning decision tree data: {paths_data}")
        return {"learning_path_decision_tree": paths_data}
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Decision tree data file not found: {str(e)}"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in decision tree data file: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected error in get_learning_paths: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get learning paths from decision tree: {str(e)}"
        )
    


@router.get("/student/{student_id}/subject/{subject}/recommendations", response_model=Dict[str, Any])
async def get_next_recommendations(
    student_id: int,
    subject: str,
    current_skill_id: Optional[str] = None,
    current_subskill_id: Optional[str] = None
) -> Dict[str, Any]:
    """Get recommended next skills based on current progress"""
    try:
        recommendations = await learning_paths_service.get_next_recommendations(
            student_id=student_id,
            subject=subject,
            current_skill_id=current_skill_id,
            current_subskill_id=current_subskill_id
        )
        return recommendations
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting next recommendations: {str(e)}"
        )

    

@router.get("/prerequisites/{skill_id}")
async def get_skill_prerequisites(skill_id: str) -> Dict[str, Any]:
    """Get prerequisites for a specific skill"""
    try:
        prerequisites = await learning_paths_service.get_skill_prerequisites(skill_id)
        return {
            "skill_id": skill_id,
            "prerequisites": prerequisites
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting skill prerequisites: {str(e)}"
        )