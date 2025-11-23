"""
Prompts API endpoints - Prompt template management and versioning
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.services.prompt_manager_service import prompt_manager_service
from app.services.feedback_aggregator_service import feedback_aggregator_service
from app.services.prompt_suggestion_service import prompt_suggestion_service
from app.jobs.aggregate_feedback_job import aggregate_feedback_job
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


# ==================== FEEDBACK AGGREGATION & IMPROVEMENT ENDPOINTS ====================

@router.get("/prompts/{template_id}/feedback-report", response_model=dict)
async def get_feedback_report(
    template_id: str,
    min_evaluations: int = Query(3, description="Minimum evaluations required")
):
    """
    Get aggregated feedback report for a prompt template.

    This endpoint:
    - Analyzes all evaluations for problems generated with this template
    - Uses Gemini to cluster improvement suggestions into themes
    - Identifies dimension weaknesses and performance flags
    - Returns structured feedback with actionable insights

    Returns:
    - Feedback themes with examples
    - Dimension analysis (which scores are weak)
    - Performance flags (LOW_APPROVAL_RATE, etc.)
    - Structured improvement suggestions
    - Performance metrics summary

    Use case:
    - View aggregated feedback after evaluating multiple problems
    - Understand common patterns in evaluation feedback
    - Identify which prompt aspects need improvement
    """
    logger.info(f"📊 GET feedback report for template {template_id}")

    try:
        feedback_report = await feedback_aggregator_service.aggregate_template_feedback(
            template_id,
            min_evaluations=min_evaluations
        )

        return {
            "success": True,
            "data": feedback_report,
            "message": f"Feedback report generated for {feedback_report['total_evaluations']} evaluations"
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating feedback report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate feedback report: {str(e)}")


@router.post("/prompts/{template_id}/suggest-improvements", response_model=dict)
async def suggest_prompt_improvements(
    template_id: str,
    focus_areas: Optional[List[str]] = Query(
        None,
        description="Specific areas to focus on (e.g., pedagogical_approach, clarity)"
    )
):
    """
    Generate LLM-powered prompt improvement suggestions.

    This endpoint:
    - Analyzes aggregated feedback for the template
    - Uses Gemini to generate an improved version of the prompt
    - Provides side-by-side diff of changes
    - Explains rationale for each change
    - Shows expected performance improvements

    Returns:
    - Original prompt text
    - Improved prompt text
    - Unified diff showing changes
    - Rationale for improvements
    - Expected impact on metrics
    - Current performance context

    Use case:
    - One-click prompt improvement suggestions
    - Understand what to change and why
    - Preview changes before creating new version
    - See expected performance gains
    """
    logger.info(f"💡 POST suggest improvements for template {template_id}")

    try:
        suggestions = await prompt_suggestion_service.suggest_prompt_improvements(
            template_id,
            focus_areas=focus_areas
        )

        return {
            "success": True,
            "data": suggestions,
            "message": "Prompt improvement suggestions generated"
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


@router.get("/prompts/{template_id_a}/compare/{template_id_b}", response_model=dict)
async def compare_template_versions(
    template_id_a: str,
    template_id_b: str
):
    """
    Compare performance between two template versions.

    This endpoint:
    - Fetches performance metrics for both templates
    - Calculates improvement/regression in each dimension
    - Generates recommendation on which version to use
    - Shows side-by-side diff

    Returns:
    - Metrics for both templates
    - Improvement analysis (which metrics improved)
    - Diff showing prompt changes
    - Recommendation on which version to activate

    Use case:
    - Compare new version against previous version
    - Validate that improvements worked
    - Decide whether to activate new version
    - A/B test results visualization
    """
    logger.info(f"📊 GET compare templates: {template_id_a} vs {template_id_b}")

    try:
        comparison = await prompt_suggestion_service.compare_template_versions(
            template_id_a,
            template_id_b
        )

        return {
            "success": True,
            "data": comparison,
            "message": "Template comparison complete"
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error comparing templates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to compare templates: {str(e)}")


@router.get("/prompts/performance-dashboard", response_model=dict)
async def get_performance_dashboard(
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    min_approval_rate: Optional[float] = Query(None, description="Filter by minimum approval rate"),
    only_active: bool = Query(False, description="Only show active versions")
):
    """
    Get performance dashboard data for all templates.

    This endpoint:
    - Lists all templates with their performance metrics
    - Flags underperforming templates (approval < 85%)
    - Shows key metrics at a glance
    - Enables filtering by type, approval rate, active status

    Returns:
    - List of templates with:
      - Basic template info (name, version, active status)
      - Performance metrics (approval rate, avg score)
      - Performance flags (if any issues)
      - Total evaluations
      - Last updated timestamp

    Use case:
    - Overview of all prompt performance
    - Identify templates that need attention
    - Track improvements over time
    - Filter to focus on specific areas
    """
    logger.info(f"📊 GET performance dashboard (type={template_type}, active={only_active})")

    try:
        # Get all templates
        templates = await prompt_manager_service.list_templates(
            template_type=template_type,
            active_only=only_active
        )

        # Build dashboard data
        dashboard_data = []

        for template in templates:
            # Get metrics
            try:
                metrics = await prompt_manager_service.calculate_performance_metrics(
                    template.template_id
                )

                # Check performance flags
                flags = []
                if metrics.approval_rate is not None:
                    if metrics.approval_rate < 0.5:
                        flags.append("LOW_APPROVAL_RATE")
                    elif metrics.approval_rate < 0.85:
                        flags.append("BELOW_TARGET_APPROVAL")

                if metrics.avg_evaluation_score is not None:
                    if metrics.avg_evaluation_score < 6.0:
                        flags.append("LOW_OVERALL_SCORE")
                    elif metrics.avg_evaluation_score < 7.5:
                        flags.append("BELOW_TARGET_SCORE")

                # Filter by min_approval_rate if specified
                if min_approval_rate is not None:
                    if metrics.approval_rate is None or metrics.approval_rate < min_approval_rate:
                        continue

                dashboard_data.append({
                    "template_id": template.template_id,
                    "template_name": template.template_name,
                    "template_type": template.template_type,
                    "version": template.version,
                    "is_active": template.is_active,
                    "metrics": metrics.dict(),
                    "performance_flags": flags if flags else ["PERFORMING_WELL"],
                    "created_at": template.created_at,
                    "updated_at": template.updated_at
                })

            except Exception as e:
                logger.warning(f"Could not get metrics for {template.template_id}: {str(e)}")
                # Include template with no metrics
                dashboard_data.append({
                    "template_id": template.template_id,
                    "template_name": template.template_name,
                    "template_type": template.template_type,
                    "version": template.version,
                    "is_active": template.is_active,
                    "metrics": None,
                    "performance_flags": ["NO_EVALUATION_DATA"],
                    "created_at": template.created_at,
                    "updated_at": template.updated_at
                })

        # Sort by approval rate (descending), with null values last
        dashboard_data.sort(
            key=lambda x: (
                x["metrics"]["approval_rate"] if x["metrics"] and x["metrics"]["approval_rate"] is not None else -1
            ),
            reverse=True
        )

        return {
            "success": True,
            "data": {
                "templates": dashboard_data,
                "total_count": len(dashboard_data),
                "filters_applied": {
                    "template_type": template_type,
                    "min_approval_rate": min_approval_rate,
                    "only_active": only_active
                }
            },
            "message": f"Found {len(dashboard_data)} templates"
        }

    except Exception as e:
        logger.error(f"Error generating dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard: {str(e)}")


# ==================== BACKGROUND JOB ENDPOINTS ====================

@router.post("/prompts/jobs/aggregate-feedback", response_model=dict)
async def trigger_feedback_aggregation(
    template_id: Optional[str] = Query(None, description="Specific template to process"),
    all_templates: bool = Query(False, description="Process all templates"),
    recent_only: bool = Query(False, description="Only process recently evaluated templates"),
    hours: int = Query(24, description="Hours to look back for recent evaluations"),
    min_evaluations: int = Query(3, description="Minimum evaluations required")
):
    """
    Trigger feedback aggregation job.

    This endpoint allows manual triggering of the feedback aggregation process.

    Options:
    - Single template: Provide template_id
    - All templates: Set all_templates=true
    - Recent evaluations: Set recent_only=true with hours lookback

    Returns:
    - Job execution summary
    - Number of templates processed
    - Success/skip/failure counts
    """
    logger.info("🔄 POST trigger feedback aggregation job")

    try:
        if template_id:
            # Process single template
            success = await aggregate_feedback_job.run_for_template(
                template_id,
                min_evaluations=min_evaluations
            )

            return {
                "success": True,
                "data": {
                    "template_id": template_id,
                    "processed": success
                },
                "message": f"Feedback aggregation {'complete' if success else 'skipped'} for {template_id}"
            }

        elif all_templates:
            # Process all templates
            results = await aggregate_feedback_job.run_for_all_templates(
                min_evaluations=min_evaluations
            )

            return {
                "success": True,
                "data": results,
                "message": f"Processed {results['successful']} templates"
            }

        elif recent_only:
            # Process recently evaluated templates
            results = await aggregate_feedback_job.run_for_recently_evaluated_templates(
                hours=hours,
                min_evaluations=min_evaluations
            )

            return {
                "success": True,
                "data": results,
                "message": f"Processed {results['successful']} templates with recent evaluations"
            }

        else:
            raise HTTPException(
                status_code=400,
                detail="Must specify template_id, all_templates=true, or recent_only=true"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running feedback aggregation job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to run job: {str(e)}")


# ==================== PRODUCTION APP ENDPOINTS ====================

@router.get("/production/prompts/best-performing", response_model=dict)
async def get_best_performing_prompt(
    subskill_id: Optional[str] = Query(None, description="Filter by subskill"),
    problem_type: Optional[str] = Query(None, description="Filter by problem type"),
    template_type: str = Query("problem_generation", description="Template type"),
    min_approval_rate: float = Query(0.85, description="Minimum approval rate"),
    min_evaluations: int = Query(5, description="Minimum evaluations required")
):
    """
    Get best-performing prompt for production use.

    This endpoint is used by the production app to select high-quality prompts.

    Logic:
    - Filters templates by type, subskill, problem type (if specified)
    - Only returns templates with approval_rate >= min_approval_rate
    - Only returns templates with >= min_evaluations
    - Returns random selection from qualifying templates (weighted by approval rate)

    Returns:
    - Selected template
    - Performance metrics
    - Rationale for selection

    Use case:
    - Production app queries for best prompt to use
    - Gets random variation from high-performers (for diversity)
    - Ensures quality threshold (85%+ approval)
    """
    logger.info(
        f"🎯 GET best performing prompt (type={template_type}, "
        f"subskill={subskill_id}, problem_type={problem_type})"
    )

    try:
        # Get all active templates of this type
        templates = await prompt_manager_service.list_templates(
            template_type=template_type,
            active_only=True
        )

        # Filter and score templates
        candidates = []

        for template in templates:
            try:
                metrics = await prompt_manager_service.calculate_performance_metrics(
                    template.template_id
                )

                # Check minimum criteria
                if (
                    metrics.total_generations >= min_evaluations
                    and metrics.approval_rate is not None
                    and metrics.approval_rate >= min_approval_rate
                ):
                    candidates.append({
                        "template": template,
                        "metrics": metrics,
                        "score": metrics.approval_rate  # Use approval rate as selection weight
                    })

            except Exception as e:
                logger.warning(f"Could not evaluate template {template.template_id}: {str(e)}")
                continue

        if not candidates:
            raise HTTPException(
                status_code=404,
                detail=f"No templates found meeting criteria (min_approval={min_approval_rate}, min_evals={min_evaluations})"
            )

        # Weighted random selection
        import random
        total_score = sum(c["score"] for c in candidates)
        rand_val = random.uniform(0, total_score)

        cumulative = 0
        selected = candidates[0]

        for candidate in candidates:
            cumulative += candidate["score"]
            if cumulative >= rand_val:
                selected = candidate
                break

        return {
            "success": True,
            "data": {
                "template": selected["template"].dict(),
                "metrics": selected["metrics"].dict(),
                "selection_pool_size": len(candidates),
                "rationale": f"Selected from {len(candidates)} qualifying templates (weighted by approval rate)"
            },
            "message": "Best-performing prompt retrieved"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting best prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get best prompt: {str(e)}")
