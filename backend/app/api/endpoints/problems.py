# backend/app/api/endpoints/problems.py - FIXED VERSION WITH SERVICE LAYER

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel
from datetime import datetime
import logging
import re
import json
import base64

# FIXED: Import from service layer instead of endpoint
from ...core.middleware import get_user_context
from ...services.user_profiles import user_profiles_service
from ...services.engagement_service import engagement_service
from ...core.decorators import log_engagement_activity
from ...models.user_profiles import ActivityLog
from ...dependencies import get_problem_service, get_competency_service, get_review_service, get_problem_recommender, get_cosmos_db, get_problem_optimizer
from ...services.problems import ProblemService
from ...services.competency import CompetencyService
from ...services.review import ReviewService
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.composable_problem_generation import ComposableProblemGenerationService
from ...schemas.composable_problems import ProblemGenerationRequest, ComposableProblem, InteractiveProblem
from ...schemas.problem_submission import ProblemSubmission, SubmissionResult, BatchSubmissionRequest, BatchSubmissionResponse
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
    count: int = 1  # Add count, default to 1 for backward compatibility

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

# ============================================================================
# ENGAGEMENT METADATA EXTRACTORS
# ============================================================================

def _extract_submission_metadata(kwargs: dict, result) -> dict:
    """Extracts metadata for a 'problem_submitted' activity."""
    submission = kwargs.get('submission')
    problem_type = submission.problem.get('problem_type', 'generic')
    score = result.review.get('score', 0) if hasattr(result, 'review') else 0

    return {
        "activity_name": f"Submitted {problem_type} problem",
        "problem_id": submission.problem.get('id'),
        "score": score,
        "is_correct": score >= 8
    }

def _extract_batch_submission_metadata(kwargs: dict, result) -> dict:
    """Extracts metadata for a 'batch_problems_submitted' activity."""
    batch_request = kwargs.get('batch_request')
    total_problems = len(batch_request.submissions) if batch_request else 0

    # Calculate aggregate metrics from batch results
    correct_count = 0
    total_score = 0

    if hasattr(result, 'submission_results'):
        for submission_result in result.submission_results:
            if hasattr(submission_result, 'review'):
                score = submission_result.review.get('score', 0)
                total_score += score
                if score >= 8:
                    correct_count += 1

    activity_name = "Submitted assessment batch"
    if batch_request and batch_request.assessment_context:
        subject = batch_request.assessment_context.subject
        activity_name = f"Submitted {subject} assessment"

    return {
        "activity_name": activity_name,
        "total_problems": total_problems,
        "correct_count": correct_count,
        "average_score": total_score / total_problems if total_problems > 0 else 0,
        "assessment_id": batch_request.assessment_context.assessment_id if batch_request and batch_request.assessment_context else None,
        "subject": batch_request.assessment_context.subject if batch_request and batch_request.assessment_context else "general"
    }

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



# ============================================================================
# FIXED ENDPOINTS - Using service layer for activity logging
# ============================================================================

@router.post("/generate")
async def generate_problem(
    request: ProblemRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    problem_service: ProblemService = Depends(get_problem_service)
) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Generate a set of one or more problems for a practice session.
    Accepts a 'count' parameter in the request body.
    Returns a single problem dict if count=1, or a list of problem dicts if count>1.
    """
    
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]
    
    try:
        logger.info(f"User {user_context['email']} generating {request.count} problems for student {student_id}")
        
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
        
        if request.count == 1:
            # Single problem generation (backward compatibility)
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
            
            # Log success with engagement service
            background_tasks.add_task(
                engagement_service.process_activity,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="problem_set_generated",
                metadata={
                    "activity_name": f"Generated {request.subject} problem",
                    "subject": request.subject,
                    "skill_id": request.skill_id,
                    "problem_type": problem.get("problem_type"),
                    "generated_count": 1
                }
            )
            
            # Return single problem for backward compatibility
            final_response = {
                **problem,
                'user_id': firebase_uid,
            }
            
            return final_response
        
        else:
            # Multiple problems generation
            problems_data = await problem_service.get_problems(
                student_id=student_id,
                subject=request.subject,
                count=request.count,
                unit_id=context.get('unit'),
                skill_id=context.get('skill'),
                subskill_id=context.get('subskill')
            )
            
            if not problems_data:
                # Log failure and raise error
                background_tasks.add_task(
                    log_activity_helper,
                    user_id=firebase_uid,
                    student_id=student_id,
                    activity_type="problem_generation_failed",
                    activity_name=f"Failed to generate {request.count} {request.subject} problems",
                    points=0,
                    metadata={"subject": request.subject, "requested_count": request.count, "student_id": student_id}
                )
                raise HTTPException(status_code=404, detail=f"Failed to generate {request.count} problems")
            
            # Log success with engagement service
            background_tasks.add_task(
                engagement_service.process_activity,
                user_id=firebase_uid,
                student_id=student_id,
                activity_type="problem_set_generated",
                metadata={
                    "activity_name": f"Generated {len(problems_data)} {request.subject} problems",
                    "subject": request.subject,
                    "skill_id": request.skill_id,
                    "requested_count": request.count,
                    "generated_count": len(problems_data)
                }
            )
            
            # Add user_id to each problem in the list before returning
            final_response = [
                {**problem, 'user_id': firebase_uid}
                for problem in problems_data
            ]
            
            logger.info(f"Successfully generated and returning {len(final_response)} problems.")
            return final_response
        
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
@log_engagement_activity(
    activity_type="problem_submitted",
    metadata_extractor=_extract_submission_metadata
)
async def submit_problem(
    submission: ProblemSubmission,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    review_service: ReviewService = Depends(get_review_service),
    competency_service: CompetencyService = Depends(get_competency_service),
    cosmos_db = Depends(get_cosmos_db)
) -> SubmissionResult:
    """
    Universal problem submission endpoint. Engagement XP is handled automatically.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    # Debug logging for raw submission data
    logger.info(f"RAW SUBMISSION DEBUG for student {student_id}:")
    logger.info(f"  submission.subject: {submission.subject}")
    logger.info(f"  submission.skill_id: {submission.skill_id}")
    logger.info(f"  submission.subskill_id: {submission.subskill_id}")
    logger.info(f"  submission.student_answer: '{submission.student_answer}'")
    logger.info(f"  submission.primitive_response: {submission.primitive_response}")
    logger.info(f"  submission.canvas_used: {submission.canvas_used}")
    logger.info(f"  submission.solution_image length: {len(submission.solution_image) if submission.solution_image else 0}")

    try:
        # Initialize submission service
        from ...services.submission_service import SubmissionService
        submission_service = SubmissionService(review_service, competency_service, cosmos_db)

        # The endpoint is now ONLY responsible for the submission logic
        result = await submission_service.handle_submission(submission, user_context)
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error in problem submission: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in problem submission: {str(e)}")
        background_tasks.add_task(
            log_activity_helper, 
            user_id=firebase_uid, 
            student_id=student_id,
            activity_type="problem_submission_error", 
            activity_name="Problem submission failed",
            points=0, 
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/submit-batch")
@log_engagement_activity(
    activity_type="batch_problems_submitted",
    metadata_extractor=_extract_batch_submission_metadata
)
async def submit_problem_batch(
    batch_request: BatchSubmissionRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    review_service: ReviewService = Depends(get_review_service),
    competency_service: CompetencyService = Depends(get_competency_service),
    cosmos_db = Depends(get_cosmos_db)
) -> BatchSubmissionResponse:
    """
    Batch problem submission endpoint. Processes multiple problems using the same logic
    as individual problem submissions. Engagement XP is handled automatically by decorator.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        # Initialize submission service
        from ...services.submission_service import SubmissionService
        submission_service = SubmissionService(review_service, competency_service, cosmos_db)

        # Generate batch ID
        import uuid
        batch_id = f"batch_{int(datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:8]}"

        # Process each submission
        submission_results = []
        failed_submissions = []

        logger.info(f"Processing batch of {len(batch_request.submissions)} submissions for student {student_id}")

        for i, submission in enumerate(batch_request.submissions):
            try:
                # Debug logging for batch submission data
                logger.info(f"BATCH SUBMISSION DEBUG [{i+1}/{len(batch_request.submissions)}] for student {student_id}:")
                logger.info(f"  submission.subject: {submission.subject}")
                logger.info(f"  submission.skill_id: {submission.skill_id}")
                logger.info(f"  submission.subskill_id: {submission.subskill_id}")
                logger.info(f"  submission.student_answer: '{submission.student_answer}'")
                logger.info(f"  submission.primitive_response: {submission.primitive_response}")
                logger.info(f"  submission.canvas_used: {submission.canvas_used}")
                logger.info(f"  submission.solution_image length: {len(submission.solution_image) if submission.solution_image else 0}")
                logger.info(f"  problem_id: {submission.problem.get('id', 'unknown')}")
                logger.info(f"  problem_type: {submission.problem.get('problem_type', 'unknown')}")

                result = await submission_service.handle_submission(submission, user_context)
                submission_results.append(result)
                logger.info(f"Successfully processed submission {i+1}/{len(batch_request.submissions)}")
            except Exception as e:
                logger.error(f"Error processing submission {i+1}: {str(e)}")
                failed_submissions.append({
                    "submission_index": i,
                    "problem_id": submission.problem.get("id", f"problem_{i}"),
                    "error": str(e)
                })

        if not submission_results and failed_submissions:
            raise HTTPException(
                status_code=400,
                detail=f"All submissions failed. Failed count: {len(failed_submissions)}"
            )

        # Create response
        response = BatchSubmissionResponse(
            batch_id=batch_id,
            assessment_id=batch_request.assessment_context.assessment_id if batch_request.assessment_context else None,
            total_problems=len(batch_request.submissions),
            submission_results=submission_results,
            batch_submitted_at=datetime.utcnow().isoformat()
        )

        # Store batch submission if assessment context provided
        if batch_request.assessment_context:
            await _store_batch_submission(
                batch_request.assessment_context,
                response,
                user_context,
                cosmos_db
            )

        if failed_submissions:
            logger.warning(f"Batch processed with {len(failed_submissions)} failures: {failed_submissions}")

        logger.info(f"Batch submission completed: {len(submission_results)} successful, {len(failed_submissions)} failed")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch problem submission: {str(e)}")
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="batch_submission_error",
            activity_name="Batch submission failed",
            points=0,
            metadata={"error": str(e), "student_id": student_id}
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def _store_batch_submission(
    assessment_context: dict,
    batch_response: BatchSubmissionResponse,
    user_context: dict,
    cosmos_db
) -> None:
    """Store batch submission results in assessment document"""
    try:
        # Get the assessment service to store batch results
        from ...services.assessment_service import AssessmentService
        from ...services.bigquery_analytics import BigQueryAnalyticsService
        from ...services.problems import ProblemService
        from ...services.curriculum_service import CurriculumService
        from ...services.submission_service import SubmissionService

        # Initialize services (simplified for batch storage)
        bigquery_service = get_bigquery_analytics_service()
        problem_service = await get_problem_service()
        curriculum_service = CurriculumService(bigquery_service)
        submission_service = SubmissionService(None, None, cosmos_db)

        assessment_service = AssessmentService(
            bigquery_service,
            problem_service,
            curriculum_service,
            submission_service,
            cosmos_db
        )

        # Store batch submission data in assessment
        await assessment_service.store_batch_submission(
            assessment_context.assessment_id,
            assessment_context.student_id,
            batch_response,
            user_context.get("firebase_uid")
        )

        logger.info(f"Stored batch submission for assessment {assessment_context.assessment_id}")

    except Exception as e:
        logger.error(f"Failed to store batch submission: {str(e)}")
        # Don't raise - submission should continue even if storage fails


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
        
        # Log success with engagement service
        background_tasks.add_task(
            engagement_service.process_activity,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="composable_problem_generated",
            metadata={
                "activity_name": f"Generated interactive {request.subject} problem",
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
            "universal_problem_generation": True,  # NEW: Universal problem generation system
            "composable_problems": True  # NEW: Composable interactive problems
        },
        "timestamp": datetime.utcnow().isoformat()
    }
