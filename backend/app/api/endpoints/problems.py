from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

# Import dependencies
from ...dependencies import get_problem_service, get_competency_service, get_problem_recommender, get_analytics_extension, get_review_service, get_anthropic_service
from ...services.problems import ProblemService
from ...services.anthropic import AnthropicService
from ...services.competency import CompetencyService, AnalyticsExtension
from ...services.recommender import ProblemRecommender
from ...services.review import ReviewService
import re
from pathlib import Path
from datetime import datetime, timedelta
import logging  # Add explicit logging import

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Set to DEBUG for more details


router = APIRouter()

class ProblemRequest(BaseModel):
    student_id: int
    subject: str
    unit_id: Optional[str] = None
    skill_id: Optional[str] = None
    subskill_id: Optional[str] = None
    difficulty: Optional[float] = None

class ProblemResponse(BaseModel):
    problem_type: str
    problem: str
    answer: str
    success_criteria: List[str]
    teaching_note: str
    metadata: Dict[str, Any]  # Contains competency/recommendation data

class ProblemSubmission(BaseModel):
    subject: str
    problem: Dict[str, Any]  # Complete problem object
    solution_image: str  # Base64 encoded image
    skill_id: str
    subskill_id: Optional[str] = None
    student_answer: Optional[str] = ""
    canvas_used: bool = True
    student_id: int

class ReviewAnalyticsRequest(BaseModel):
    student_id: int
    subject: str
    days: Optional[int] = 30
    skill_id: Optional[str] = None

@router.post("/generate")
async def generate_problem(
    request: ProblemRequest,
    problem_service: ProblemService = Depends(get_problem_service)
) -> ProblemResponse:
    """Generate a new problem based on curriculum parameters"""
    try:
        logger.info(f"Received problem generation request: {request}")
        
        # Validate subject at minimum
        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")
            
        context = {
            "unit": request.unit_id,
            "skill": request.skill_id,
            "subskill": request.subskill_id
        }
        
        logger.info(f"Processing with context: {context}")
        
        # Let the recommender handle missing parameters
        problem = await problem_service.get_problem(
            student_id=request.student_id,
            subject=request.subject,
            context=context
        )
        
        if not problem:
            logger.error("No problem generated")
            raise HTTPException(
                status_code=404, 
                detail="Failed to generate problem. Check server logs for details."
            )
            
        logger.info(f"Generated problem: {problem}")
        return ProblemResponse(**problem)
        
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error in generate_problem endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    
@router.post("/submit")
async def submit_problem(
    submission: ProblemSubmission,
    review_service: ReviewService = Depends(get_review_service),  # Changed from problem_service
    competency_service: CompetencyService = Depends(get_competency_service)
) -> Dict[str, Any]:
    """Submit a problem solution for review and update competency"""
    try:
        # Ensure we have valid base64 data
        if not submission.solution_image:
            raise HTTPException(status_code=400, detail="No image data provided")

        # Clean the base64 string if needed
        image_data = submission.solution_image
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
            
        # Validate base64 format
        if not re.match(r'^[A-Za-z0-9+/=]+$', image_data):
            raise HTTPException(status_code=400, detail="Invalid image data format")

        # Get problem review from the review service instead of problem service
        review = await review_service.review_problem(
            student_id=submission.student_id,
            subject=submission.subject,
            problem=submission.problem,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=submission.student_answer or "",
            canvas_used=submission.canvas_used
        )
        
        if "error" in review:
            raise HTTPException(status_code=500, detail=review["error"])
        
        # Update student's competency based on review
        competency_update = await competency_service.update_competency_from_problem(
            student_id=submission.student_id,
            subject=submission.subject,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            evaluation=review
        )
        
        # Return combined response
        return {
            "review": review,
            "competency": competency_update
        }
            
    except Exception as e:
        logger.error(f"Error in submit_problem: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/student/{student_id}/recommended-problems")
async def get_recommended_problems(
    student_id: int,
    subject: Optional[str] = None,
    count: int = Query(3, ge=1, le=10, description="Number of problems to generate"),
    analytics_service: AnalyticsExtension = Depends(get_analytics_extension),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """
    Get personalized recommended problems for a student based on their analytics.
    Returns multiple problems in a single call based on the top recommendations.
    """
    try:
        logger.info(f"Getting {count} recommended problems for student {student_id}")
        
        # Step 1: Get recommendations from analytics service
        recommendations = await analytics_service.get_recommendations(
            student_id, subject, limit=count
        )
        
        if not recommendations or len(recommendations) == 0:
            logger.error("No recommendations found for this student")
            raise HTTPException(
                status_code=404,
                detail="No recommendations found for this student"
            )
            
        logger.info(f"Got {len(recommendations)} recommendations")
            
        # Step 2: Generate multiple problems in a single call
        problems = await problem_service.get_multiple_problems(
            student_id=student_id,
            subject=subject,
            recommendations=recommendations
        )
        
        if not problems:
            logger.error("Failed to generate recommended problems")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate recommended problems"
            )
            
        logger.info(f"Generated {len(problems)} problems successfully")
        return problems
        
    except HTTPException as e:
        raise
    except Exception as e:
        logger.error(f"Error in get_recommended_problems endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/skill-problems/{student_id}")
async def get_skill_problems(
    student_id: int,
    subject: str,
    skill_id: str,
    subskill_id: str,
    count: int = Query(5, ge=3, le=8, description="Number of problems to generate"),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """
    Get multiple problems for a specific skill and subskill.
    Returns varied problems with different concept groups for the same skill/subskill.
    """
    try:
        logger.info(f"Getting {count} problems for student {student_id}, skill {skill_id}, subskill {subskill_id}")
        
        # Get the problems from the service
        problems = await problem_service.get_skill_problems(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            count=count
        )
        
        logger.info(f"Retrieved {len(problems) if problems else 0} problems from service")
        
        if not problems or len(problems) == 0:
            logger.error(f"No problems generated for skill {skill_id}, subskill {subskill_id}")
            raise HTTPException(
                status_code=404,
                detail="Failed to generate problems for the specified skill/subskill"
            )
        
        # Log problem details to verify data structure
        for i, problem in enumerate(problems):
            logger.debug(f"Problem {i+1} type: {problem.get('problem_type', 'unknown')}")
            logger.debug(f"Problem {i+1} keys: {problem.keys()}")
        
        logger.info(f"Successfully returning {len(problems)} problems")
        return problems
        
    except HTTPException as e:
        logger.error(f"HTTP Exception in get_skill_problems: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Error in get_skill_problems endpoint: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
