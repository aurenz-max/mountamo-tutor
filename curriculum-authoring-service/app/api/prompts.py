"""
Prompts API endpoints - Prompt template management and versioning
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.services.prompt_manager_service import prompt_manager_service
from app.models.problems import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateInDB,
    PerformanceMetrics
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== RESPONSE MODELS ====================

class PromptTemplateResponse(BaseModel):
    """Response for single prompt template operations"""
    success: bool
    data: Optional[PromptTemplateInDB] = None
    message: str


class PromptTemplatesResponse(BaseModel):
    """Response for multiple prompt templates"""
    success: bool
    data: Optional[List[PromptTemplateInDB]] = None
    message: str


class PerformanceMetricsResponse(BaseModel):
    """Response for performance metrics"""
    success: bool
    data: Optional[PerformanceMetrics] = None
    message: str


# ==================== TEMPLATE CRUD ENDPOINTS ====================

@router.post("/prompts", response_model=PromptTemplateResponse)
async def create_template(
    template: PromptTemplateCreate,
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Create a new prompt template.

    This endpoint:
    - Auto-increments version if template name already exists
    - Creates version 1 if it's a new template
    - Optionally sets as active version
    - Returns the created template

    Template types:
    - problem_generation: Generate practice problems
    - content_generation: Generate reading content
    - problem_evaluation: Evaluate problem quality
    - content_evaluation: Evaluate content quality

    Example request:
    ```json
    {
        "template_name": "kindergarten_alphabet_problems",
        "template_type": "problem_generation",
        "template_text": "Generate {count} problems for {subskill_description}...",
        "template_variables": ["count", "subskill_description", "grade_level"],
        "is_active": true,
        "change_notes": "Improved clarity of instructions"
    }
    ```
    """
    logger.info(f"📝 POST create prompt template: {template.template_name}")

    try:
        created = await prompt_manager_service.create_template(
            template_data=template,
            user_id=user_id
        )

        return PromptTemplateResponse(
            success=True,
            data=created,
            message=f"Created template {template.template_name} version {created.version}"
        )

    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create template: {str(e)}")


@router.get("/prompts", response_model=PromptTemplatesResponse)
async def list_templates(
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    template_name: Optional[str] = Query(None, description="Filter by template name"),
    active_only: bool = Query(False, description="Only return active versions")
):
    """
    List all prompt templates with optional filtering.

    Returns:
    - All templates (all versions) by default
    - Filter by type: problem_generation, content_generation, problem_evaluation, content_evaluation
    - Filter by name to see all versions of a specific template
    - Use active_only=true to get only currently active templates

    Examples:
    - GET /prompts - All templates, all versions
    - GET /prompts?template_type=problem_generation - All problem generation templates
    - GET /prompts?template_name=default_problem_generation - All versions of default template
    - GET /prompts?active_only=true - Only active versions
    """
    logger.info(f"📋 GET prompts (type={template_type}, name={template_name}, active={active_only})")

    try:
        templates = await prompt_manager_service.list_templates(
            template_type=template_type,
            template_name=template_name,
            active_only=active_only
        )

        return PromptTemplatesResponse(
            success=True,
            data=templates,
            message=f"Found {len(templates)} templates"
        )

    except Exception as e:
        logger.error(f"Error listing templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


@router.get("/prompts/{template_id}", response_model=PromptTemplateResponse)
async def get_template(template_id: str):
    """
    Get a specific prompt template by ID.

    Returns:
    - Complete template data
    - Version information
    - Performance metrics if available
    """
    logger.info(f"🔍 GET prompt template {template_id}")

    try:
        template = await prompt_manager_service.get_template(template_id)

        if not template:
            raise HTTPException(status_code=404, detail=f"Template {template_id} not found")

        return PromptTemplateResponse(
            success=True,
            data=template,
            message="Template retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get template: {str(e)}")


@router.put("/prompts/{template_id}", response_model=PromptTemplateResponse)
async def update_template(
    template_id: str,
    updates: PromptTemplateUpdate,
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Update an existing prompt template.

    Note: This modifies the existing version.
    To create a new version, use POST /prompts instead.

    Example request:
    ```json
    {
        "template_text": "Updated prompt text...",
        "change_notes": "Fixed typo in instructions"
    }
    ```
    """
    logger.info(f"✏️ PUT update prompt template {template_id}")

    try:
        updated = await prompt_manager_service.update_template(
            template_id=template_id,
            updates=updates,
            user_id=user_id
        )

        return PromptTemplateResponse(
            success=True,
            data=updated,
            message="Template updated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update template: {str(e)}")


# ==================== VERSION MANAGEMENT ====================

@router.post("/prompts/{template_id}/activate", response_model=PromptTemplateResponse)
async def activate_template(template_id: str):
    """
    Activate a specific template version.

    This endpoint:
    - Sets the specified template as active
    - Automatically deactivates all other versions of the same template
    - Only one version can be active per template name+type

    Use case:
    - Switch between template versions
    - Roll back to a previous version
    - A/B test different prompts
    """
    logger.info(f"🔄 POST activate prompt template {template_id}")

    try:
        activated = await prompt_manager_service.activate_version(template_id)

        return PromptTemplateResponse(
            success=True,
            data=activated,
            message=f"Activated template version {activated.version}"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error activating template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to activate template: {str(e)}")


@router.get("/prompts/active/{template_name}/{template_type}", response_model=PromptTemplateResponse)
async def get_active_template(template_name: str, template_type: str):
    """
    Get the currently active version of a template.

    Parameters:
    - template_name: e.g., "default_problem_generation"
    - template_type: problem_generation, content_generation, problem_evaluation, content_evaluation

    Returns:
    - The active template version
    - 404 if no active version exists
    """
    logger.info(f"🔍 GET active template: {template_name} ({template_type})")

    try:
        template = await prompt_manager_service.get_active_template(
            template_name=template_name,
            template_type=template_type
        )

        if not template:
            raise HTTPException(
                status_code=404,
                detail=f"No active template found for {template_name} ({template_type})"
            )

        return PromptTemplateResponse(
            success=True,
            data=template,
            message="Active template retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get active template: {str(e)}")


# ==================== PERFORMANCE METRICS ====================

@router.get("/prompts/{template_id}/performance", response_model=PerformanceMetricsResponse)
async def get_template_performance(template_id: str):
    """
    Calculate performance metrics for a template.

    This endpoint:
    - Analyzes all problems/content generated with this template
    - Calculates average evaluation scores
    - Computes approval/revision/rejection rates
    - Returns aggregated metrics

    Metrics include:
    - Average evaluation score (0-10)
    - Approval rate (% of content approved)
    - Average scores per dimension (pedagogical, alignment, clarity, correctness, bias)
    - Total generations, approvals, revisions, rejections

    Note: Requires evaluation data to be available.
    """
    logger.info(f"📊 GET performance metrics for template {template_id}")

    try:
        metrics = await prompt_manager_service.calculate_performance_metrics(template_id)

        return PerformanceMetricsResponse(
            success=True,
            data=metrics,
            message="Performance metrics calculated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate metrics: {str(e)}")


# ==================== UTILITY ENDPOINTS ====================

@router.get("/prompts/types", response_model=dict)
async def get_template_types():
    """
    Get available template types and their descriptions.

    Returns:
    - List of valid template types
    - Description of each type
    - Example use cases
    """
    return {
        "success": True,
        "data": {
            "problem_generation": {
                "description": "Templates for generating practice problems",
                "variables": ["subskill_description", "grade_level", "subject", "count", "problem_types"],
                "example": "Generate kindergarten alphabet recognition problems"
            },
            "content_generation": {
                "description": "Templates for generating reading content",
                "variables": ["subskill_description", "grade_level", "subject", "section_type"],
                "example": "Generate engaging introduction for phonics lesson"
            },
            "problem_evaluation": {
                "description": "Templates for LLM judge problem evaluation",
                "variables": ["problem", "grade_level", "learning_objectives"],
                "example": "Evaluate this multiple choice problem for pedagogical quality"
            },
            "content_evaluation": {
                "description": "Templates for LLM judge content evaluation",
                "variables": ["content", "grade_level", "learning_objectives"],
                "example": "Evaluate this reading passage for engagement and accuracy"
            }
        },
        "message": "Template types retrieved successfully"
    }
