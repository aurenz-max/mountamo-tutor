"""
Problems API endpoints - Practice problem generation and management
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel

from app.services.problem_generator_service import problem_generator_service
from app.services.problem_evaluation_service import problem_evaluation_service
from app.models.problems import (
    ProblemInDB,
    ProblemUpdate,
    ProblemEvaluationResult
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class GenerateProblemsRequest(BaseModel):
    """Request to generate problems"""
    version_id: str
    count: int = 5
    problem_types: Optional[List[str]] = None
    temperature: float = 0.7
    auto_evaluate: bool = True
    custom_prompt: Optional[str] = None


class RegenerateProblemRequest(BaseModel):
    """Request to regenerate a single problem"""
    modified_prompt: Optional[str] = None
    temperature: Optional[float] = None


class ProblemsResponse(BaseModel):
    """Response for problem operations"""
    success: bool
    data: Optional[List[ProblemInDB]] = None
    message: str


class ProblemResponse(BaseModel):
    """Response for single problem operations"""
    success: bool
    data: Optional[ProblemInDB] = None
    message: str


class DeleteResponse(BaseModel):
    """Response for delete operations"""
    success: bool
    message: str


# ==================== PROBLEM GENERATION ENDPOINTS ====================

@router.post("/subskills/{subskill_id}/problems/generate", response_model=ProblemsResponse)
async def generate_problems(
    subskill_id: str,
    request: GenerateProblemsRequest,
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Generate practice problems for a subskill.

    This endpoint:
    - Generates 5-10 problems using Gemini AI
    - Stores complete generation metadata for replicability
    - Optionally triggers automatic evaluation
    - Returns all generated problems

    Problem types supported:
    - multiple_choice
    - true_false
    - fill_in_blanks
    - short_answer

    Example request:
    ```json
    {
        "version_id": "v1",
        "count": 5,
        "problem_types": ["multiple_choice", "true_false"],
        "temperature": 0.7,
        "auto_evaluate": true
    }
    ```
    """
    logger.info(f"📝 POST generate {request.count} problems for subskill {subskill_id}")

    try:
        problems = await problem_generator_service.generate_problems(
            subskill_id=subskill_id,
            version_id=request.version_id,
            count=request.count,
            problem_types=request.problem_types,
            temperature=request.temperature,
            auto_evaluate=request.auto_evaluate,
            user_id=user_id,
            custom_prompt=request.custom_prompt
        )

        return ProblemsResponse(
            success=True,
            data=problems,
            message=f"Generated {len(problems)} problems successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating problems: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate problems: {str(e)}")


@router.get("/subskills/{subskill_id}/problems", response_model=ProblemsResponse)
async def list_problems(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    active_only: bool = Query(False, description="Only return active problems")
):
    """
    Get all problems for a subskill.

    Returns:
    - All problems (draft and published)
    - Generation metadata for each problem
    - Edit history if available

    Use `active_only=true` to get only published problems.
    """
    logger.info(f"📋 GET problems for subskill {subskill_id}, version {version_id}")

    try:
        problems = await problem_generator_service.list_problems_for_subskill(
            subskill_id=subskill_id,
            version_id=version_id,
            active_only=active_only
        )

        return ProblemsResponse(
            success=True,
            data=problems,
            message=f"Found {len(problems)} problems"
        )

    except Exception as e:
        logger.error(f"Error listing problems: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list problems: {str(e)}")


@router.get("/problems/{problem_id}", response_model=ProblemResponse)
async def get_problem(problem_id: str):
    """
    Get a specific problem by ID.

    Returns:
    - Complete problem data
    - Generation metadata
    - Edit history
    """
    logger.info(f"🔍 GET problem {problem_id}")

    try:
        problem = await problem_generator_service.get_problem(problem_id)

        if not problem:
            raise HTTPException(status_code=404, detail=f"Problem {problem_id} not found")

        return ProblemResponse(
            success=True,
            data=problem,
            message="Problem retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get problem: {str(e)}")


# ==================== PROBLEM MODIFICATION ENDPOINTS ====================

@router.put("/problems/{problem_id}", response_model=ProblemResponse)
async def update_problem(
    problem_id: str,
    updates: ProblemUpdate,
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Update a problem with manual edits.

    This endpoint:
    - Updates problem JSON content
    - Tracks edit history
    - Can change draft/active status

    Example request:
    ```json
    {
        "problem_json": {
            "question_text": "Updated question...",
            "options": ["A", "B", "C", "D"],
            "correct_answer_index": 1,
            "explanation": "Updated explanation...",
            "difficulty": "medium"
        },
        "is_draft": false,
        "is_active": true
    }
    ```
    """
    logger.info(f"✏️ PUT update problem {problem_id}")

    try:
        problem = await problem_generator_service.update_problem(
            problem_id=problem_id,
            updates=updates,
            user_id=user_id
        )

        return ProblemResponse(
            success=True,
            data=problem,
            message="Problem updated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update problem: {str(e)}")


@router.post("/problems/{problem_id}/regenerate", response_model=ProblemResponse)
async def regenerate_problem(
    problem_id: str,
    request: RegenerateProblemRequest = RegenerateProblemRequest(),
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Regenerate a single problem.

    This endpoint:
    - Uses the original generation prompt (or a modified one)
    - Generates a new problem using Gemini
    - Replaces the existing problem
    - Preserves problem ID

    Use cases:
    - Problem quality is low, try again
    - Iterate on prompt to improve quality
    - Generate variation with different temperature

    Example request:
    ```json
    {
        "modified_prompt": "Generate a more challenging problem about...",
        "temperature": 0.8
    }
    ```
    """
    logger.info(f"🔄 POST regenerate problem {problem_id}")

    try:
        problem = await problem_generator_service.regenerate_problem(
            problem_id=problem_id,
            modified_prompt=request.modified_prompt,
            temperature=request.temperature,
            user_id=user_id
        )

        return ProblemResponse(
            success=True,
            data=problem,
            message="Problem regenerated successfully"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error regenerating problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate problem: {str(e)}")


@router.delete("/problems/{problem_id}", response_model=DeleteResponse)
async def delete_problem(problem_id: str):
    """
    Delete a problem.

    This permanently removes the problem from BigQuery.
    Use with caution - this cannot be undone.

    Consider marking as inactive instead (PUT with is_active=false).
    """
    logger.info(f"🗑️ DELETE problem {problem_id}")

    try:
        await problem_generator_service.delete_problem(problem_id)

        return DeleteResponse(
            success=True,
            message=f"Problem {problem_id} deleted successfully"
        )

    except Exception as e:
        logger.error(f"Error deleting problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete problem: {str(e)}")


# ==================== BATCH OPERATIONS ====================

@router.post("/subskills/{subskill_id}/problems/batch-regenerate", response_model=ProblemsResponse)
async def batch_regenerate_rejected(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    user_id: Optional[str] = Query(None, description="User ID for audit tracking")
):
    """
    Regenerate all rejected problems for a subskill.

    This endpoint:
    - Finds all problems with evaluation status 'reject'
    - Regenerates each one
    - Returns the regenerated problems

    Useful for bulk improvement after evaluation.
    """
    logger.info(f"🔄 POST batch regenerate rejected problems for {subskill_id}")

    try:
        # Get all problems
        all_problems = await problem_generator_service.list_problems_for_subskill(
            subskill_id=subskill_id,
            version_id=version_id
        )

        # TODO: Filter by evaluation status (requires evaluation service integration)
        # For now, just return message
        # In Phase 2, this will:
        # 1. Query evaluations table
        # 2. Filter problems with final_recommendation='reject'
        # 3. Regenerate each one

        return ProblemsResponse(
            success=True,
            data=[],
            message="Batch regeneration will be available after evaluation service is complete"
        )

    except Exception as e:
        logger.error(f"Error batch regenerating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to batch regenerate: {str(e)}")


# ==================== EVALUATION ENDPOINTS ====================

class EvaluationResponse(BaseModel):
    """Response for single evaluation operations"""
    success: bool
    data: Optional[ProblemEvaluationResult] = None
    message: str


class EvaluationsResponse(BaseModel):
    """Response for batch evaluation operations"""
    success: bool
    data: Optional[List[ProblemEvaluationResult]] = None
    message: str
    count: int = 0


@router.post("/problems/{problem_id}/evaluation/evaluate", response_model=EvaluationResponse)
async def evaluate_problem(
    problem_id: str,
    skip_llm: bool = Query(False, description="Skip Tier 3 LLM evaluation (for testing)")
):
    """
    Evaluate a problem using the 3-tier evaluation system.

    This endpoint:
    - Runs Tier 1 (Structural Validation)
    - Runs Tier 2 (Heuristic Validation)
    - Runs Tier 3 (LLM Judge) unless skip_llm=true
    - Calculates final recommendation (approve/revise/reject)
    - Stores complete evaluation in BigQuery
    - Returns evaluation results

    The evaluation uses short-circuit logic:
    - If Tier 1 fails → immediate reject
    - If Tier 2 has critical failures → immediate reject
    - Otherwise, proceeds to Tier 3

    Example:
    ```
    POST /api/problems/{problem_id}/evaluation/evaluate
    ```

    Returns:
    - Structural validation results
    - Heuristic metrics (readability, visual coherence)
    - LLM judgment (5 dimension scores + suggestions)
    - Final recommendation and overall score
    """
    logger.info(f"🔍 POST evaluate problem {problem_id}")

    try:
        evaluation = await problem_evaluation_service.evaluate_problem(
            problem_id=problem_id,
            skip_llm=skip_llm
        )

        return EvaluationResponse(
            success=True,
            data=evaluation,
            message=f"Evaluation complete: {evaluation.final_recommendation}"
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error evaluating problem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate problem: {str(e)}")


@router.get("/problems/{problem_id}/evaluation", response_model=EvaluationResponse)
async def get_problem_evaluation(problem_id: str):
    """
    Get the latest evaluation for a problem.

    Returns the most recent evaluation result from BigQuery.
    Returns 404 if no evaluation exists for this problem.

    Example:
    ```
    GET /api/problems/{problem_id}/evaluation
    ```

    Returns:
    - Latest evaluation results
    - All tier results (structural, heuristic, LLM)
    - Final recommendation and score
    """
    logger.info(f"📥 GET evaluation for problem {problem_id}")

    try:
        evaluation = await problem_evaluation_service.get_evaluation(problem_id)

        if not evaluation:
            raise HTTPException(
                status_code=404,
                detail=f"No evaluation found for problem {problem_id}"
            )

        return EvaluationResponse(
            success=True,
            data=evaluation,
            message="Evaluation retrieved successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evaluation: {str(e)}")


@router.post("/subskills/{subskill_id}/problems/batch-evaluate", response_model=EvaluationsResponse)
async def batch_evaluate_problems(
    subskill_id: str,
    version_id: str = Query(..., description="Version ID for the curriculum"),
    skip_llm: bool = Query(False, description="Skip Tier 3 LLM evaluation (for faster testing)")
):
    """
    Evaluate all problems for a subskill.

    This endpoint:
    - Fetches all problems for the subskill
    - Runs 3-tier evaluation on each problem
    - Stores all evaluation results
    - Returns list of evaluations

    Useful for:
    - Initial quality assessment after generation
    - Re-evaluation after prompt changes
    - Bulk quality reports

    Example:
    ```
    POST /api/subskills/{subskill_id}/problems/batch-evaluate?version_id=v1
    ```

    Returns:
    - List of all evaluation results
    - Count of problems evaluated
    - Summary message
    """
    logger.info(f"🔍 POST batch evaluate problems for {subskill_id}")

    try:
        evaluations = await problem_evaluation_service.batch_evaluate(
            subskill_id=subskill_id,
            version_id=version_id,
            skip_llm=skip_llm
        )

        # Count results by recommendation
        approve_count = sum(1 for e in evaluations if e.final_recommendation == "approve")
        revise_count = sum(1 for e in evaluations if e.final_recommendation == "revise")
        reject_count = sum(1 for e in evaluations if e.final_recommendation == "reject")

        message = f"Evaluated {len(evaluations)} problems: {approve_count} approve, {revise_count} revise, {reject_count} reject"

        return EvaluationsResponse(
            success=True,
            data=evaluations,
            message=message,
            count=len(evaluations)
        )

    except Exception as e:
        logger.error(f"Error batch evaluating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to batch evaluate: {str(e)}")
