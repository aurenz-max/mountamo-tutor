"""
AI-assisted curriculum authoring API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel

from app.core.security import require_designer
from app.services.ai_assistant import ai_assistant

router = APIRouter()


class GenerateUnitRequest(BaseModel):
    """Request to generate a curriculum unit"""
    subject: str
    grade_level: str
    topic_prompt: str
    context: Optional[str] = None


class GenerateSkillRequest(BaseModel):
    """Request to generate a skill"""
    subject: str
    unit_title: str
    skill_prompt: str


class SuggestPrerequisitesRequest(BaseModel):
    """Request to suggest prerequisites"""
    subject: str
    entity_id: str
    entity_description: str
    available_prerequisites: List[dict]  # [{"id": "...", "description": "..."}]


class ImproveDescriptionRequest(BaseModel):
    """Request to improve a description"""
    original_description: str
    entity_type: str  # 'unit', 'skill', 'subskill'
    subject: str


@router.post("/ai/generate-unit")
async def generate_unit(
    request: GenerateUnitRequest
):
    """Generate a complete curriculum unit using AI"""
    try:
        result = await ai_assistant.generate_unit(
            subject=request.subject,
            grade_level=request.grade_level,
            topic_prompt=request.topic_prompt,
            context=request.context
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/ai/generate-skill")
async def generate_skill(
    request: GenerateSkillRequest
):
    """Generate a skill with subskills using AI"""
    try:
        result = await ai_assistant.generate_skill(
            subject=request.subject,
            unit_title=request.unit_title,
            skill_prompt=request.skill_prompt
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/ai/suggest-prerequisites")
async def suggest_prerequisites(
    request: SuggestPrerequisitesRequest
):
    """Get AI suggestions for prerequisite relationships"""
    try:
        suggestions = await ai_assistant.suggest_prerequisites(
            subject=request.subject,
            entity_id=request.entity_id,
            entity_description=request.entity_description,
            available_prerequisites=request.available_prerequisites
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")


@router.post("/ai/improve-description")
async def improve_description(
    request: ImproveDescriptionRequest
):
    """Improve a curriculum description using AI"""
    try:
        improved = await ai_assistant.improve_description(
            original_description=request.original_description,
            entity_type=request.entity_type,
            subject=request.subject
        )
        return {
            "original": request.original_description,
            "improved": improved
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI improvement failed: {str(e)}")
