# app/api/endpoints/learning_paths.py

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json
import logging

from ...services.learning_paths import LearningPathsService
from ...services.competency import CompetencyService
from ...dependencies import get_competency_service, get_learning_paths_service

logger = logging.getLogger(__name__)

router = APIRouter()

class LearningPathUploadData(BaseModel):
    learning_paths_data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class NextRecommendationRequest(BaseModel):
    student_id: int
    current_skill_id: Optional[str] = None
    current_subskill_id: Optional[str] = None

@router.get("/learning-paths")
async def get_learning_paths(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get complete learning paths decision tree"""
    logger.info(f"📝 Getting learning paths")
    try:
        logger.info(f"Calling learning_paths_service.get_learning_paths()")
        decision_tree = await learning_paths_service.get_learning_paths()
        
        logger.info(f"Decision tree result: {len(decision_tree) if decision_tree else 0} skills")
        
        if not decision_tree:
            logger.warning(f"No learning paths found")
            raise HTTPException(
                status_code=404, 
                detail="Learning paths not found"
            )
        
        logger.info(f"✅ Successfully retrieved learning paths")
        
        return {
            "learning_path_decision_tree": decision_tree,
            "skill_count": len(decision_tree)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting learning paths: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metadata")
async def get_learning_paths_metadata(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get metadata for learning paths"""
    try:
        metadata = await learning_paths_service.get_learning_paths_metadata()
        
        return {
            "metadata": metadata
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prerequisites/{skill_id}")
async def get_skill_prerequisites(
    skill_id: str,
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get prerequisites for a specific skill"""
    try:
        prerequisites = await learning_paths_service.get_skill_prerequisites(skill_id)
        
        return {
            "skill_id": skill_id,
            "prerequisites": prerequisites
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skill-groups")
async def get_skill_groups(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get skill groups and their sequences"""
    try:
        skill_groups = await learning_paths_service.get_skill_groups()
        
        return {
            "skill_groups": skill_groups
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}/recommendations")
async def get_next_recommendations(
    student_id: int,
    current_skill_id: Optional[str] = None,
    current_subskill_id: Optional[str] = None,
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get recommended next skills based on current progress"""
    try:
        recommendations = await learning_paths_service.get_next_recommendations(
            student_id=student_id,
            current_skill_id=current_skill_id,
            current_subskill_id=current_subskill_id
        )
        
        return recommendations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-file")
async def upload_learning_paths_file(
    file: UploadFile = File(...),
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Upload learning paths JSON file"""
    try:
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Only JSON files are supported")
        
        # Read and parse file content
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        # Extract learning paths data - handle both formats
        if "learning_path_decision_tree" in data:
            learning_paths_data = data["learning_path_decision_tree"]
        else:
            learning_paths_data = data
        
        # Extract metadata if present
        metadata = data.get('metadata', None)
        
        result = await learning_paths_service.upload_learning_paths(
            learning_paths_data=learning_paths_data,
            metadata=metadata
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "message": "Successfully uploaded learning paths file",
            "filename": file.filename,
            "result": result
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files")
async def list_learning_paths_files(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """List all learning paths files in cloud storage"""
    try:
        result = await learning_paths_service.list_learning_paths_files()
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh-cache")
async def refresh_learning_paths_cache(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Refresh learning paths cache"""
    try:
        result = await learning_paths_service.refresh_cache()
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def learning_paths_health_check(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Check learning paths service health"""
    try:
        health = await learning_paths_service.health_check()
        
        if health["status"] not in ["healthy", "degraded"]:
            raise HTTPException(status_code=503, detail="Service unhealthy")
        
        return health
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
async def get_learning_paths_analytics(
    learning_paths_service: LearningPathsService = Depends(get_learning_paths_service)
):
    """Get analytics about learning paths structure"""
    try:
        # Get all data
        decision_tree = await learning_paths_service.get_learning_paths()
        skill_groups = await learning_paths_service.get_skill_groups()
        metadata = await learning_paths_service.get_learning_paths_metadata()
        
        if not decision_tree:
            raise HTTPException(
                status_code=404, 
                detail="Learning paths not found"
            )
        
        # Calculate analytics
        total_skills = len(decision_tree)
        
        # Count connections
        total_connections = 0
        skills_with_no_next = 0
        
        for skill_id, next_skills in decision_tree.items():
            total_connections += len(next_skills)
            if not next_skills:
                skills_with_no_next += 1
        
        # Count skills that don't appear as next skills (potential starting points)
        all_next_skills = set()
        for next_skills in decision_tree.values():
            all_next_skills.update(next_skills)
        
        starting_skills = [skill for skill in decision_tree.keys() 
                          if skill not in all_next_skills]
        
        # Skill group analytics
        skill_group_count = len(skill_groups)
        skills_in_groups = set()
        for group_data in skill_groups.values():
            skills_in_groups.update(group_data.get("skills", []))
        
        return {
            "metadata": metadata,
            "structure_analytics": {
                "total_skills": total_skills,
                "total_connections": total_connections,
                "average_connections_per_skill": round(total_connections / total_skills, 2) if total_skills > 0 else 0,
                "skills_with_no_next": skills_with_no_next,
                "terminal_skills_percentage": round((skills_with_no_next / total_skills) * 100, 1) if total_skills > 0 else 0,
                "starting_skills": starting_skills,
                "starting_skills_count": len(starting_skills)
            },
            "skill_group_analytics": {
                "total_groups": skill_group_count,
                "skills_in_groups": len(skills_in_groups),
                "skills_not_in_groups": total_skills - len(skills_in_groups),
                "group_coverage_percentage": round((len(skills_in_groups) / total_skills) * 100, 1) if total_skills > 0 else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))