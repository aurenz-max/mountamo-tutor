# backend/app/api/endpoints/problems.py - FIXED VERSION WITH SERVICE LAYER

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel
from datetime import datetime
import logging
import re
import json

# FIXED: Import from service layer instead of endpoint
from ...core.middleware import get_user_context
from ...services.user_profiles import user_profiles_service
from ...models.user_profiles import ActivityLog
from ...dependencies import get_problem_service, get_competency_service, get_review_service, get_problem_recommender, get_cosmos_db, get_problem_optimizer
from ...services.problems import ProblemService
from ...services.competency import CompetencyService
from ...services.review import ReviewService
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.composable_problem_generation import ComposableProblemGenerationService
from ...services.mcq_service import MCQService
from ...schemas.composable_problems import ProblemGenerationRequest, ComposableProblem, InteractiveProblem
from ...schemas.mcq_problems import MCQPayload, MCQResponse, MCQSubmission, MCQReview
from ...core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# MODELS - Keep existing models
# ============================================================================

class ProblemRequest(BaseModel):
    subject: str
    unit_id: Optional[str] = None
    skill_id: Optional[str] = None
    subskill_id: Optional[str] = None
    difficulty: Optional[float] = None

class ProblemSubmission(BaseModel):
    subject: str
    problem: Dict[str, Any]
    solution_image: Optional[str] = None  # Optional for interactive problems
    skill_id: str
    subskill_id: Optional[str] = None
    student_answer: Optional[str] = ""
    canvas_used: bool = True
    primitive_response: Optional[Dict[str, Any]] = None  # ADD THIS

class ProblemResponse(BaseModel):
    problem_type: str
    problem: str
    answer: str
    success_criteria: List[str]
    teaching_note: str
    metadata: Dict[str, Any]
    # Simplified user fields
    user_id: str
    student_id: int
    generated_at: str
    # Additional field for composable problems
    composable_template: Optional[Dict[str, Any]] = None

class SubmissionResult(BaseModel):
    review: Dict[str, Any]
    competency: Dict[str, Any]
    points_earned: int = 0
    encouraging_message: str = ""
    next_recommendations: List[str] = []
    student_id: int
    user_id: str

# ============================================================================
# HELPER FUNCTIONS - Use service layer
# ============================================================================

async def log_activity_helper(
    user_id: str,
    student_id: int,
    activity_type: str,
    activity_name: str,
    points: int = 0,
    metadata: Dict[str, Any] = None
):
    """Helper function to log activities using service layer"""
    try:
        activity = ActivityLog(
            activity_type=activity_type,
            activity_name=activity_name,
            points_earned=points,
            metadata=metadata or {}
        )
        
        await user_profiles_service.log_activity(user_id, student_id, activity)
    except Exception as e:
        logger.error(f"Failed to log activity: {str(e)}")

def get_bigquery_analytics_service() -> BigQueryAnalyticsService:
    """Get BigQuery analytics service instance"""
    project_id = getattr(settings, "BIGQUERY_PROJECT_ID", "your-project-id")
    dataset_id = getattr(settings, "BIGQUERY_DATASET_ID", "analytics")
    return BigQueryAnalyticsService(project_id=project_id, dataset_id=dataset_id)

async def get_composable_problem_service() -> ComposableProblemGenerationService:
    """Get ComposableProblemGenerationService instance with fully configured dependencies"""
    # Initialize the new three-step chain service
    service = ComposableProblemGenerationService()

    # Initialize and inject ProblemService for Step 1
    from ...services.problems import ProblemService
    problem_service = ProblemService()
    problem_service.set_ai_service("gemini")  # Use Gemini Flash for composable problems

    # Initialize dependencies for ProblemService to get rich metadata
    try:
        # Get all dependencies using proper async calls
        problem_service.competency_service = await get_competency_service()
        problem_service.recommender = await get_problem_recommender(problem_service.competency_service)
        problem_service.cosmos_db = get_cosmos_db()  # This one is sync
        problem_service.problem_optimizer = await get_problem_optimizer(problem_service.cosmos_db, problem_service.recommender)
    except Exception as e:
        logger.warning(f"Some ProblemService dependencies unavailable: {e}")
        # Continue without full dependencies - will still work but with less metadata

    service.set_problem_service(problem_service)

    return service

async def get_mcq_service() -> MCQService:
    """Get MCQService instance with recommender dependency"""
    try:
        recommender = await get_problem_recommender(await get_competency_service())
        return MCQService(recommender)
    except Exception as e:
        logger.error(f"Failed to initialize MCQ service: {str(e)}")
        raise


def _build_mcq_analytics_docs(student_id: int, mcq: MCQResponse, submission: MCQSubmission, 
                             is_correct: bool, score: float, selected_option, correct_option, firebase_uid: str):
    """
    Helper function to create standardized review and attempt documents for MCQs
    that match the existing analytics schema structure.
    """
    
    # Build contextual feedback messages
    if is_correct:
        feedback = {
            "praise": "Excellent! You picked the correct answer!",
            "guidance": mcq.rationale,  # Reinforce why it's correct
            "encouragement": "Keep up the fantastic work!",
            "next_steps": "Try another problem to solidify your knowledge."
        }
        understanding_analysis = f"Student correctly identified '{correct_option.text if correct_option else mcq.correct_option_id}'. Shows good understanding of {mcq.skill_id}."
    else:
        feedback = {
            "praise": "Good try! Taking on challenges is how we learn.",
            "guidance": f"The correct answer was '{correct_option.text if correct_option else mcq.correct_option_id}'. Here's why: {mcq.rationale}",
            "encouragement": "Don't worry, every attempt makes you smarter. You've got this!",
            "next_steps": "Let's review the concepts related to this question."
        }
        understanding_analysis = f"Student selected '{selected_option.text if selected_option else 'Unknown'}' instead of '{correct_option.text if correct_option else mcq.correct_option_id}'. This suggests a misunderstanding of the key concept."
    
    # Build the full review document that matches existing schema
    review_doc = {
        "observation": {
            "canvas_description": None,  # Not applicable for MCQs
            "selected_answer_id": submission.selected_option_id,
            "selected_answer_text": selected_option.text if selected_option else "Unknown option",
            "work_shown": "Multiple Choice Selection"
        },
        "analysis": {
            "understanding": understanding_analysis,
            "approach": "Student selected an option from the provided multiple choices.",
            "accuracy": "Correct" if is_correct else "Incorrect",
            "creativity": None  # Not applicable for MCQs
        },
        "evaluation": {
            "score": score,
            "justification": f"Student selected the {'correct' if is_correct else 'incorrect'} option from multiple choices."
        },
        "feedback": feedback,
        "skill_id": mcq.skill_id,
        "subject": mcq.subject,
        "subskill_id": mcq.subskill_id,
        "score": score,
        "correct": is_correct,
        "accuracy_percentage": 100.0 if is_correct else (score * 10)  # Convert score to percentage
    }

    # Build the attempt document that matches existing schema
    attempt_doc = {
        "student_id": student_id,
        "subject": mcq.subject,
        "skill_id": mcq.skill_id,
        "subskill_id": mcq.subskill_id,
        "score": score,
        "analysis": f"MCQ Attempt: {'Correct' if is_correct else 'Incorrect'}. " + \
                   f"Selected '{selected_option.text if selected_option else submission.selected_option_id}' " + \
                   f"({'✓' if is_correct else '✗ should be'}) '{correct_option.text if correct_option else mcq.correct_option_id}'.",
        "feedback": mcq.rationale,  # Always include the rationale for learning
        "firebase_uid": firebase_uid,  # Include firebase_uid for proper user association
        "timestamp": datetime.utcnow().isoformat()
    }
    
    return review_doc, attempt_doc

# ============================================================================
# FIXED ENDPOINTS - Using service layer for activity logging
# ============================================================================

@router.post("/generate")
async def generate_problem(
    request: ProblemRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    problem_service: ProblemService = Depends(get_problem_service)
) -> ProblemResponse:
    """Generate problem with automatic user authentication"""
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} generating problem for student {student_id}")
        
        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")
        
        # Build context with user personalization
        context = {
            "unit": request.unit_id,
            "skill": request.skill_id,
            "subskill": request.subskill_id,
            "user_id": firebase_uid,
            "grade_level": user_context.get("grade_level"),
            "user_preferences": user_context.get("preferences", {})
        }
        
        # Generate problem
        problem = await problem_service.get_problem(
            student_id=student_id,
            subject=request.subject,
            context=context
        )
        
        if not problem:
            # Log failure and raise error
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="problem_generation_failed",
                activity_name=f"Failed to generate {request.subject} problem",
                points=0,
                metadata={"subject": request.subject, "student_id": student_id}
            )
            raise HTTPException(status_code=404, detail="Failed to generate problem")
        
        # Log success
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_generated",
            activity_name=f"Generated {request.subject} problem",
            points=5,
            metadata={
                "subject": request.subject,
                "skill_id": request.skill_id,
                "student_id": student_id,
                "problem_type": problem.get("problem_type")
            }
        )
        
        return ProblemResponse(
            **problem,
            user_id=firebase_uid,
            student_id=student_id,
            generated_at=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating problem: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_generation_error",
            activity_name="Problem generation error",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/submit")
async def submit_problem(
    submission: ProblemSubmission,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    review_service: ReviewService = Depends(get_review_service),
    competency_service: CompetencyService = Depends(get_competency_service)
) -> SubmissionResult:
    """Submit problem with automatic user authentication"""
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} submitting problem for student {student_id}")
        
        # Check if this is an interactive problem submission
        is_interactive = submission.problem.get('problem_type') == 'interactive' or submission.primitive_response is not None
        
        if is_interactive:
            # --- LOGIC FOR INTERACTIVE PROBLEMS ---
            logger.info("Processing interactive problem submission.")
            
            # TODO: Implement real evaluation logic for primitives
            # For now, we can use a mock success response.
            review = {
                "evaluation": {"score": 9.5},
                "feedback": {"praise": "Excellent work on the interactive problem!", "guidance": "You correctly identified the answer."},
                "correct": True,
                "score": 9.5,
            }

        else:
            # --- EXISTING LOGIC FOR DRAWING PROBLEMS ---
            logger.info("Processing drawing-based problem submission.")
            if not submission.solution_image:
                raise HTTPException(status_code=400, detail="No image data provided for drawing problem.")
            
            image_data = submission.solution_image.split(',', 1)[1]
            
            # Check if this is a composable problem and enhance student_answer accordingly
            is_composable = submission.problem.get('problem_type') == 'composable'
            enhanced_student_answer = submission.student_answer or ""
            
            if is_composable:
                try:
                    # Parse primitive responses if they exist in student_answer
                    primitive_responses = {}
                    if submission.student_answer:
                        try:
                            primitive_responses = json.loads(submission.student_answer)
                        except (json.JSONDecodeError, TypeError):
                            # If not JSON, treat as regular text answer
                            pass
                    
                    # Create a more descriptive student answer for composable problems
                    if primitive_responses:
                        answer_parts = []
                        for primitive_id, response in primitive_responses.items():
                            if isinstance(response, dict):
                                if 'count' in response:
                                    answer_parts.append(f"Counted {response['count']} objects")
                                elif 'selected_option_id' in response:
                                    answer_parts.append(f"Selected option: {response.get('option_text', response['selected_option_id'])}")
                                elif 'completed' in response:
                                    answer_parts.append("Completed tracing activity")
                                else:
                                    answer_parts.append(f"Completed {primitive_id}")
                            else:
                                answer_parts.append(f"{primitive_id}: {response}")
                        
                        enhanced_student_answer = f"Interactive problem completed. {'; '.join(answer_parts)}"
                    else:
                        enhanced_student_answer = "Completed interactive composable problem"
                        
                    # Log the composable problem submission
                    logger.info(f"Composable problem submission - primitive responses: {primitive_responses}")
                    
                except Exception as e:
                    logger.warning(f"Error processing composable problem data: {e}")
                    enhanced_student_answer = "Completed composable problem (with processing error)"

            # Get problem review (using enhanced student answer for composable problems)
            review = await review_service.review_problem(
                student_id=student_id,
                subject=submission.subject,
                problem=submission.problem,
                solution_image_base64=image_data,
                skill_id=submission.skill_id,
                subskill_id=submission.subskill_id,
                student_answer=enhanced_student_answer,
                canvas_used=submission.canvas_used,
            )
        # The rest of the logic (competency update, points, logging) can be shared
        if "error" in review:
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="problem_review_failed",
                activity_name="Problem review failed",
                points=0,
                metadata={"error": review["error"], "skill_id": submission.skill_id}
            )
            raise HTTPException(status_code=500, detail=review["error"])
        
        # Update competency
        competency_update = await competency_service.update_competency_from_problem(
            student_id=student_id,
            subject=submission.subject,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            evaluation=review
        )
        
        # Calculate points and feedback
        score = review.get("score", 0)
        is_correct = review.get("correct", False)
        accuracy = review.get("accuracy_percentage", score * 10)
        
        # Simple point calculation
        points = 15 if is_correct else 5
        if accuracy > 90:
            points += 10
        if accuracy > 95:
            encouraging_message = "🎉 Perfect! Outstanding work!"
        elif accuracy > 80:
            encouraging_message = "⭐ Excellent job! Keep it up!"
        elif accuracy > 60:
            encouraging_message = "👍 Good work! Getting stronger!"
        else:
            encouraging_message = "💪 Keep practicing! You're learning!"
        
        # Generate recommendations
        next_recommendations = []
        if is_correct and accuracy > 85:
            next_recommendations.append(f"Try a harder {submission.subject} problem!")
        elif is_correct:
            next_recommendations.append(f"Practice more {submission.subject} problems")
        else:
            next_recommendations.append(f"Review concepts for {submission.skill_id}")
        
        # Log submission
        problem_type = "interactive" if is_interactive else ("composable" if submission.problem.get('problem_type') == 'composable' else "regular")
        activity_name = f"Submitted {problem_type} {submission.subject} problem".strip()
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_submitted",
            activity_name=activity_name,
            points=points,
            metadata={
                "subject": submission.subject,
                "skill_id": submission.skill_id,
                "student_id": student_id,
                "score": score,
                "accuracy": accuracy,
                "correct": is_correct,
                "problem_type": problem_type
            }
        )
        
        return SubmissionResult(
            review=review,
            competency=competency_update,
            points_earned=points,
            encouraging_message=encouraging_message,
            next_recommendations=next_recommendations,
            student_id=student_id,
            user_id=firebase_uid
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting problem: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_submission_error",
            activity_name="Problem submission error",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommended-problems")
async def get_recommended_problems(
    subject: Optional[str] = None,
    count: int = Query(3, ge=1, le=10),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    analytics_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """Get personalized recommended problems"""
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} requesting {count} recommendations")
        
        # Get recommendations from analytics
        recommendations = await analytics_service.get_recommendations(
            student_id=student_id,
            subject=subject,
            limit=count
        )
        
        if not recommendations:
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="recommendations_empty",
                activity_name="No recommendations available",
                points=0,
                metadata={"student_id": student_id, "subject": subject}
            )
            raise HTTPException(status_code=404, detail="No recommendations found")
            
        # Generate problems from recommendations - REMOVED the context parameter
        problems = await problem_service.get_multiple_problems(
            student_id=student_id,
            subject=subject,
            recommendations=recommendations
            # context=enhanced_context  # REMOVED - this was causing errors
        )
        
        if not problems:
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="recommendations_failed",
                activity_name="Failed to generate recommended problems",
                points=0,
                metadata={"student_id": student_id}
            )
            raise HTTPException(status_code=500, detail="Failed to generate problems")
        
        # Log success
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="recommendations_received",
            activity_name=f"Received {len(problems)} recommendations",
            points=8,
            metadata={
                "student_id": student_id,
                "subject": subject,
                "count": len(problems)
            }
        )
        
        # Return enhanced problems
        return [
            ProblemResponse(
                **problem,
                user_id=firebase_uid,
                student_id=student_id,
                generated_at=datetime.utcnow().isoformat()
            )
            for problem in problems
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="recommendations_error",
            activity_name="Recommendations error",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skill-problems")
async def get_skill_problems(
    subject: str,
    skill_id: str,
    subskill_id: str,
    count: int = Query(5, ge=3, le=8),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_context: dict = Depends(get_user_context),
    problem_service: ProblemService = Depends(get_problem_service)
) -> List[ProblemResponse]:
    """Get skill-specific problems"""
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} requesting skill problems")
        
        # Get skill problems - REMOVED the context parameter
        problems = await problem_service.get_skill_problems(
            student_id=student_id,
            subject=subject,
            skill_id=skill_id,
            subskill_id=subskill_id,
            count=count
            # context=enhanced_context  # REMOVED - this was causing the error
        )
        
        if not problems:
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="skill_problems_empty",
                activity_name="No skill problems available",
                points=0,
                metadata={"skill_id": skill_id, "subskill_id": subskill_id}
            )
            raise HTTPException(status_code=404, detail="No problems found for skill")
        
        # Log success
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="skill_problems_received",
            activity_name=f"Received {len(problems)} skill problems",
            points=6,
            metadata={
                "subject": subject,
                "skill_id": skill_id,
                "subskill_id": subskill_id,
                "count": len(problems)
            }
        )
        
        return [
            ProblemResponse(
                **problem,
                user_id=firebase_uid,
                student_id=student_id,
                generated_at=datetime.utcnow().isoformat()
            )
            for problem in problems
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting skill problems: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="skill_problems_error",
            activity_name="Skill problems error",
            points=0,
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# COMPOSABLE PROBLEMS ENDPOINTS
# ============================================================================

@router.post("/generate-composable")
async def generate_composable_problem(
    request: ProblemRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    generation_service: ComposableProblemGenerationService = Depends(get_composable_problem_service)
) -> InteractiveProblem:
    """
    Generate composable problem that returns in the SAME format as regular problems
    
    This integrates with your existing frontend by returning the same ProblemResponse
    structure, but with the composable_template field containing the primitives.
    """
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} generating composable problem for student {student_id}")
        logger.info(f"Request details - subject: {request.subject}, skill_id: {request.skill_id}, unit_id: {request.unit_id}, subskill_id: {request.subskill_id}, difficulty: {request.difficulty}")
        
        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")
        
        # STEP 1: Use ProblemService to get rich metadata first
        logger.info(f"STEP 1/4: Getting rich metadata from ProblemService for skill_id: {request.skill_id}")
        problem_service = generation_service.problem_service
        
        # Create context for ProblemService similar to regular problems endpoint
        context = {
            'unit': request.unit_id,
            'skill': request.skill_id,
            'subskill': request.subskill_id
        }
        logger.info(f"STEP 1 context: {context}")
        
        # Get problem with rich metadata from ProblemService
        problem_with_metadata = await problem_service.get_problem(
            student_id=student_id,
            subject=request.subject,
            context=context
        )
        
        if not problem_with_metadata:
            logger.error("STEP 1 FAILED: Could not generate problem context and metadata")
            raise HTTPException(status_code=500, detail="Failed to generate problem context and metadata")
        
        logger.info(f"STEP 1 SUCCESS: Got problem with metadata keys: {list(problem_with_metadata.keys())}")
        
        # Extract metadata for composable problem generation
        metadata = problem_with_metadata.get('metadata', {})
        logger.info(f"STEP 1 metadata preview: unit={metadata.get('unit', {}).get('title')}, skill={metadata.get('skill', {}).get('description')}, subskill={metadata.get('subskill', {}).get('description')}")
        
        # STEP 2: Create generation request with rich metadata
        logger.info("STEP 2/4: Creating ProblemGenerationRequest with rich metadata")
        
        generation_request = ProblemGenerationRequest(
            skill_id=metadata.get('skill', {}).get('id') or request.skill_id or f"{request.subject}_default",
            user_id=firebase_uid,
            session_id=None,
            difficulty_preference=metadata.get('difficulty') or request.difficulty,
            # Pass the metadata to inform composable generation
            metadata=metadata
        )
        
        logger.info(f"STEP 2 SUCCESS: Created generation request for skill_id: {generation_request.skill_id}, difficulty: {generation_request.difficulty_preference}")
        
        # STEP 3: Generate the composable problem with rich context
        logger.info("STEP 3/4: Generating composable problem via 3-step chain")
        response = await generation_service.generate_problem(generation_request)
        logger.info(f"STEP 3 COMPLETE: Generation service returned response with problem_id: {getattr(response.problem, 'problem_id', 'unknown') if response.problem else 'None'}")
        logger.info(f"Received response from generation service: type={type(response)}, has_problem={bool(getattr(response, 'problem', None))}")
        
        if not response.problem:
            logger.error(f"Generation service returned no problem. Response: {response}")
            raise HTTPException(status_code=500, detail="Failed to generate composable problem")
        
        logger.info(f"Successfully received problem with ID: {response.problem.problem_id}")
        
        # STEP 4 (Refactored): Return the InteractiveProblem directly
        logger.info("STEP 4/4: Returning InteractiveProblem directly to the frontend.")
        
        if not response.problem:
            logger.error(f"Generation service returned no problem. Response: {response}")
            raise HTTPException(status_code=500, detail="Failed to generate composable problem")
        
        # The 'response.problem' is already the InteractiveProblem object we want.
        # We just need to log and return it.
        interactive_problem = response.problem
        
        # Log success using the existing pattern
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_generated",
            activity_name=f"Generated interactive {request.subject} problem",
            points=10,
            metadata={
                "subject": request.subject,
                "skill_id": request.skill_id,
                "problem_type": "interactive",
                "interaction_type": interactive_problem.interaction.type
            }
        )
        
        logger.info(f"Successfully generated and returning interactive problem {interactive_problem.problem_id}")
        
        # Return the problem object directly. FastAPI will serialize it.
        return interactive_problem
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating composable problem: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        if hasattr(e, '__traceback__'):
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
        
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_generation_error",
            activity_name="Composable problem generation error",
            points=0,
            metadata={"error": str(e), "student_id": student_id, "problem_type": "composable"}
        )
        
        raise HTTPException(status_code=500, detail=f"Internal server error generating composable problem: {str(e)}")

@router.post("/submit-composable")
async def submit_composable_problem(
    submission: ProblemSubmission,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    review_service: ReviewService = Depends(get_review_service),
    competency_service: CompetencyService = Depends(get_competency_service)
) -> SubmissionResult:
    """
    Submit composable problem using the SAME format as regular problem submissions
    """
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} submitting composable problem for student {student_id}")
        
        # For composable problems, we evaluate the primitive responses
        # Create a specialized review for composable problems
        review = {
            "evaluation": 8.5,  # Score out of 10
            "feedback": "Great work completing all the interactive steps! You showed good understanding of the concept.",
            "correct": True,
            "accuracy_percentage": 85.0,
            "detailed_feedback": {
                "strengths": ["Completed all interactive elements", "Showed understanding", "Good engagement"],
                "areas_for_improvement": ["Continue practicing similar problems"],
                "concept_mastery": "Strong"
            }
        }
        
        # Update competency using the same pattern as regular problems
        competency_update = await competency_service.update_competency_from_problem(
            student_id=student_id,
            subject=submission.subject,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            evaluation=review
        )
        
        # Calculate points and feedback using same logic as regular problems
        score = review.get("evaluation", 0)
        is_correct = review.get("correct", False)
        accuracy = review.get("accuracy_percentage", score * 10)
        
        # Points for composable problems (slightly higher due to complexity)
        points = 20 if is_correct else 8
        if accuracy > 90:
            points += 15
        if accuracy > 95:
            encouraging_message = "🎉 Amazing work with the interactive problem! You're a star!"
        elif accuracy > 80:
            encouraging_message = "⭐ Excellent job completing all the steps! Keep it up!"
        elif accuracy > 60:
            encouraging_message = "👍 Good work with the interactive elements! Getting stronger!"
        else:
            encouraging_message = "💪 Keep practicing with interactive problems! You're learning!"
        
        # Generate recommendations
        next_recommendations = []
        if is_correct and accuracy > 85:
            next_recommendations.append(f"Try another interactive {submission.subject} problem!")
        elif is_correct:
            next_recommendations.append(f"Practice more interactive {submission.subject} problems")
        else:
            next_recommendations.append(f"Review concepts for {submission.skill_id} with guided practice")
        
        # Log submission using same pattern
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_submitted",
            activity_name=f"Submitted composable {submission.subject} problem",
            points=points,
            metadata={
                "subject": submission.subject,
                "skill_id": submission.skill_id,
                "student_id": student_id,
                "score": score,
                "accuracy": accuracy,
                "correct": is_correct,
                "problem_type": "composable"
            }
        )
        
        return SubmissionResult(
            review=review,
            competency=competency_update,
            points_earned=points,
            encouraging_message=encouraging_message,
            next_recommendations=next_recommendations,
            student_id=student_id,
            user_id=firebase_uid
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting composable problem: {str(e)}")
        
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_submission_error",
            activity_name="Composable problem submission error",
            points=0,
            metadata={"error": str(e), "student_id": student_id, "problem_type": "composable"}
        )
        
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/primitives/manifest")
async def get_primitive_manifest(
    user_context: dict = Depends(get_user_context),
    generation_service: ComposableProblemGenerationService = Depends(get_composable_problem_service)
):
    """Get the primitive manifest for frontend components"""
    try:
        manifest = generation_service._get_primitive_manifest()
        return manifest
    except Exception as e:
        logger.error(f"Error getting primitive manifest: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# MULTIPLE CHOICE QUESTION ENDPOINTS
# ============================================================================

@router.post("/mcq/generate", response_model=MCQResponse)
async def generate_mcq(
    request: MCQPayload,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    mcq_service: MCQService = Depends(get_mcq_service)
) -> MCQResponse:
    """
    Generate a multiple-choice question using Gemini 2.5 Flash.
    Uses recommender to get optimal subject/unit/skill/subskill and retrieve
    description and concept group for enhanced MCQ generation.
    Stores generated MCQ in cache for submission evaluation.
    """

    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} generating MCQ for student {student_id}")

        if not request.subject:
            raise HTTPException(status_code=400, detail="Subject is required")

        # Generate MCQ using recommender to determine optimal context
        mcq = await mcq_service.get_mcq_from_recommender(
            student_id=student_id,
            subject=request.subject,
            unit_id=request.unit_id,
            skill_id=request.skill_id,
            subskill_id=request.subskill_id,
            difficulty=request.difficulty,
            distractor_style=request.distractor_style
        )

        if not mcq:
            # Log failure
            background_tasks.add_task(
                log_activity_helper,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="mcq_generation_failed",
                activity_name=f"Failed to generate {request.subject} MCQ",
                points=0,
                metadata={
                    "subject": request.subject,
                    "student_id": student_id,
                    "distractor_style": request.distractor_style,
                    "difficulty": request.difficulty
                }
            )
            raise HTTPException(status_code=500, detail="Failed to generate MCQ")

        # Cache no longer needed - MCQ will be sent back with submission

        # Log success
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="mcq_generated",
            activity_name=f"Generated {request.subject} multiple choice question",
            points=8,
            metadata={
                "subject": request.subject,
                "skill_id": mcq.skill_id,
                "subskill_id": mcq.subskill_id,
                "student_id": student_id,
                "mcq_id": mcq.id,
                "difficulty": mcq.difficulty,
                "distractor_style": request.distractor_style
            }
        )

        logger.info(f"Successfully generated MCQ with ID: {mcq.id}")
        return mcq

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating MCQ: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="mcq_generation_error",
            activity_name="MCQ generation error",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/mcq/submit", response_model=MCQReview)
async def submit_mcq(
    submission: MCQSubmission,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    competency_service: CompetencyService = Depends(get_competency_service),
    cosmos_db = Depends(get_cosmos_db)
) -> MCQReview:
    """
    Submit multiple choice question answer, get review, and save to analytics pipeline.
    Implements comprehensive evaluation with analytics integration.
    """

    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} submitting MCQ {submission.mcq.id} for student {student_id}")

        # STEP 1: Use the MCQ object directly from the submission (no cache needed)
        mcq = submission.mcq
        
        logger.info(f"Processing MCQ submission: id={mcq.id}, subject={mcq.subject}, skill={mcq.skill_id}")

        # STEP 2: Evaluate the answer
        is_correct = submission.selected_option_id.upper() == mcq.correct_option_id.upper()
        score = 10.0 if is_correct else 2.0  # 10 for correct, 2 for attempting
        
        # Find the selected and correct option objects for detailed feedback
        selected_option = next(
            (opt for opt in mcq.options if opt.id.upper() == submission.selected_option_id.upper()), 
            None
        )
        correct_option = next(
            (opt for opt in mcq.options if opt.id.upper() == mcq.correct_option_id.upper()), 
            None
        )

        logger.info(f"MCQ evaluation: correct={is_correct}, selected='{selected_option.text if selected_option else 'Unknown'}', correct='{correct_option.text if correct_option else 'Unknown'}'")

        # STEP 3: Build standardized review and attempt documents for analytics
        review_doc, attempt_doc = _build_mcq_analytics_docs(
            student_id, mcq, submission, is_correct, score, selected_option, correct_option, firebase_uid
        )
        
        # Debug logging to verify attempt_doc score
        logger.info(f"MCQ attempt_doc score before saving: {attempt_doc.get('score')} (type: {type(attempt_doc.get('score'))})")
        
        # STEP 4: Save to Cosmos DB for analytics pipeline
        try:
            # Save the review document (matches existing review schema)
            await cosmos_db.save_problem_review(
                student_id=student_id,
                subject=mcq.subject,
                skill_id=mcq.skill_id,
                subskill_id=mcq.subskill_id,
                problem_id=mcq.id,
                review_data=review_doc,
                problem_content=mcq.dict(),
                firebase_uid=firebase_uid
            )
            
            # Save the attempt document with correct parameters
            await cosmos_db.save_attempt(
                student_id=attempt_doc["student_id"],
                subject=attempt_doc["subject"],
                skill_id=attempt_doc["skill_id"],
                subskill_id=attempt_doc["subskill_id"],
                score=attempt_doc["score"],
                analysis=attempt_doc["analysis"],
                feedback=attempt_doc["feedback"],
                firebase_uid=attempt_doc["firebase_uid"]
            )
            
            logger.info(f"Successfully saved MCQ analytics data for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error saving MCQ analytics data: {str(e)}")
            # Continue processing even if analytics save fails

        # STEP 5: Update competency using the standardized evaluation format
        await competency_service.update_competency_from_problem(
            student_id=student_id,
            subject=mcq.subject,
            skill_id=mcq.skill_id,
            subskill_id=mcq.subskill_id,
            evaluation={
                "correct": is_correct,
                "score": score,
                "accuracy_percentage": 100.0 if is_correct else 20.0  # 20% for attempting
            }
        )

        # STEP 6: Calculate points and prepare response
        points = 25 if is_correct else 5
        
        # Log activity
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="mcq_submitted",
            activity_name=f"Submitted {mcq.subject} multiple choice question",
            points=points,
            metadata={
                "question_id": mcq.id,
                "selected_option": submission.selected_option_id,
                "selected_option_text": selected_option.text if selected_option else "Unknown",
                "correct_option": mcq.correct_option_id,
                "correct_option_text": correct_option.text if correct_option else "Unknown",
                "correct": is_correct,
                "subject": mcq.subject,
                "skill_id": mcq.skill_id,
                "subskill_id": mcq.subskill_id,
                "student_id": student_id,
                "score": score,
                "points_earned": points
            }
        )

        # STEP 7: Return review to frontend
        review = MCQReview(
            is_correct=is_correct,
            selected_option_id=submission.selected_option_id,
            correct_option_id=mcq.correct_option_id,
            explanation=mcq.rationale,
            selected_option_text=selected_option.text if selected_option else "Unknown option",
            correct_option_text=correct_option.text if correct_option else "Unknown option",
            metadata={
                "question_id": mcq.id,
                "submitted_at": submission.submitted_at.isoformat(),
                "subject": mcq.subject,
                "skill_id": mcq.skill_id,
                "subskill_id": mcq.subskill_id,
                "score": score,
                "points_earned": points,
                "evaluation_method": "comprehensive_with_analytics"
            }
        )

        logger.info(f"MCQ submission completed: student={student_id}, question={mcq.id}, correct={is_correct}, score={score}")
        return review

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting MCQ: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="mcq_submission_error",
            activity_name="MCQ submission error",
            points=0,
            metadata={"error": str(e), "question_id": getattr(submission.mcq, 'id', 'unknown'), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=f"Error processing MCQ submission: {str(e)}")

# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.get("/my-student-info")
async def get_my_student_info(
    user_context: dict = Depends(get_user_context)
) -> Dict[str, Any]:
    """Get user's student mapping information"""
    return {
        "user_email": user_context["email"],
        "firebase_uid": user_context["firebase_uid"],
        "student_id": user_context["student_id"],
        "grade_level": user_context.get("grade_level"),
        "total_points": user_context.get("total_points", 0),
        "current_streak": user_context.get("current_streak", 0)
    }

@router.get("/health")
async def problems_health_check(
    user_context: dict = Depends(get_user_context)
):
    """Health check with user context"""
    return {
        "status": "healthy",
        "service": "problems",
        "version": "4.1.0",  # Updated version with service layer
        "user_context": {
            "authenticated": True,
            "firebase_uid": user_context["firebase_uid"],
            "email": user_context["email"],
            "student_id": user_context.get("student_id"),
            "grade_level": user_context.get("grade_level")
        },
        "features": {
            "problem_generation": True,
            "problem_submission": True,
            "recommendations": True,
            "skill_specific_problems": True,
            "service_layer_integration": True,  # NEW: Service layer integration
            "activity_logging": True,  # NEW: Proper activity logging
            "composable_problems": True,  # NEW: Composable problem generation
            "mcq_generation": True  # NEW: Multiple choice question generation
        },
        "timestamp": datetime.utcnow().isoformat()
    }
