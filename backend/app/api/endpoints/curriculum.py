from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Dict, Any, List, Optional

# Import dependencies - you'll need to update this based on your dependency injection
from app.dependencies import get_competency_service, get_curriculum_service
from app.services.competency import CompetencyService
from app.services.curriculum_service import CurriculumService

router = APIRouter()

@router.get("/subjects")
async def get_available_subjects(
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """List all available subjects from cloud storage"""
    try:
        subjects = await curriculum_service.get_available_subjects()
        return {"subjects": subjects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/curriculum/{subject}")
async def get_subject_curriculum(
    subject: str,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
) -> Dict[str, Any]:
    """Get complete curriculum structure for a subject from cloud storage"""
    try:
        curriculum = await curriculum_service.get_curriculum(subject)
        if not curriculum:
            raise HTTPException(status_code=404, detail=f"Curriculum not found for subject: {subject}")
            
        return {
            "subject": subject,
            "curriculum": curriculum
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subskills/{subject}")
async def get_subskills(
    subject: str,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Get all available problem types (subskills) from cloud storage"""
    try:
        types = await curriculum_service.get_subskill_types(subject)
        if not types:
            raise HTTPException(status_code=404, detail=f"No subskills found for subject: {subject}")
        return {"subject": subject, "problem_types": types}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/objectives/{subject}/{subskill_id}")
async def get_detailed_objectives(
    subject: str, 
    subskill_id: str,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
) -> Dict[str, Any]:
    """Get detailed learning objectives for a subskill from cloud storage"""
    try:
        objectives = await curriculum_service.get_detailed_objectives(subject, subskill_id)
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error loading objectives: {str(e)}"
        )

# Additional cloud-specific endpoints

@router.get("/health")
async def curriculum_health_check(
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Check curriculum service health"""
    return await curriculum_service.health_check()

@router.get("/files")
async def list_curriculum_files(
    subject: Optional[str] = None,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """List all curriculum files in cloud storage"""
    result = await curriculum_service.list_curriculum_files()
    
    # Filter by subject if specified
    if subject and result["success"]:
        filtered_files = [
            f for f in result["files"] 
            if f.get("subject", "").lower() == subject.lower()
        ]
        result["files"] = filtered_files
        result["total_count"] = len(filtered_files)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.post("/upload/{subject}")
async def upload_curriculum_file(
    subject: str,
    file_type: str = "syllabus",  # or "detailed_objectives"
    file: UploadFile = File(...),
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Upload curriculum CSV file to cloud storage"""
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
        if file_type not in ["syllabus", "detailed_objectives"]:
            raise HTTPException(status_code=400, detail="file_type must be 'syllabus' or 'detailed_objectives'")
        
        # Read file content
        content = await file.read()
        
        # Upload to cloud storage
        result = await curriculum_service.upload_curriculum_csv(
            subject=subject,
            csv_content=content,
            file_type=file_type
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "message": f"Successfully uploaded {file_type} for {subject}",
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview/{subject}")
async def preview_curriculum_data(
    subject: str,
    file_type: str = "syllabus",
    limit: int = 10,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Preview curriculum data from cloud storage"""
    try:
        df = await curriculum_service.download_curriculum_csv(subject, file_type)
        if df is None:
            raise HTTPException(status_code=404, detail=f"No {file_type} data found for {subject}")
        
        # Return preview with basic statistics
        preview_data = df.head(limit).to_dict(orient='records')
        
        return {
            "subject": subject,
            "file_type": file_type,
            "total_rows": len(df),
            "columns": list(df.columns),
            "preview": preview_data,
            "preview_limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refresh-cache")
async def refresh_curriculum_cache(
    subject: Optional[str] = None,
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Manually refresh curriculum cache"""
    result = await curriculum_service.refresh_curriculum_cache(subject)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result

@router.get("/stats")
async def get_curriculum_stats(
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
):
    """Get curriculum statistics"""
    result = await curriculum_service.get_curriculum_stats()
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result["stats"]