from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Body
from typing import Dict, Optional, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
import logging
import uuid

# Import services and middleware following the same pattern as analytics.py
from ...core.middleware import get_user_context
from ...core.decorators import log_engagement_activity
from ...services.user_profiles import user_profiles_service
from ...services.engagement_service import engagement_service
from ...models.user_profiles import ActivityLog
from ...services.assessment_service import AssessmentService
from ...services.bigquery_analytics import BigQueryAnalyticsService
from ...services.problems import ProblemService
from ...services.curriculum_service import CurriculumService
from ...services.submission_service import SubmissionService
from ...services.review import ReviewService
from ...services.competency import CompetencyService
from ...db.cosmos_db import CosmosDBService
from ...core.config import settings
from ...schemas.problem_submission import ProblemSubmission, BatchSubmissionRequest, BatchSubmissionResponse
from ...schemas.assessment_review import EnhancedAssessmentSummaryResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreateAssessmentRequest(BaseModel):
    """Request model for creating a new assessment"""
    student_id: int = Field(..., description="ID of the student taking the assessment")
    question_count: int = Field(15, ge=5, le=25, description="Number of questions (5-25)")


class AssessmentBlueprintResponse(BaseModel):
    """Response model for assessment blueprint"""
    student_id: int
    subject: str
    question_count: int
    category_breakdown: Dict[str, int]
    total_available_subskills: int
    is_cold_start: Optional[bool] = False
    generated_at: str


class AssessmentResponse(BaseModel):
    """Complete assessment response with problems"""
    assessment_id: str
    student_id: int
    subject: str
    total_questions: int
    estimated_duration_minutes: int
    blueprint: Dict
    problems: list
    generated_at: str


class SubmitAssessmentRequest(BaseModel):
    """Request model for submitting assessment answers"""
    assessment_id: str = Field(..., description="ID of the assessment being submitted")
    answers: Dict[str, Any] = Field(..., description="Student answers mapped to problem IDs")
    time_taken_minutes: Optional[int] = Field(None, description="Time taken to complete assessment")

class BatchAssessmentSubmissionRequest(BaseModel):
    """Request model for batch assessment submission"""
    batch_request: BatchSubmissionRequest = Field(..., description="Batch submission data with assessment context")


class AssessmentSubmissionResponse(BaseModel):
    """Response model for assessment submission"""
    assessment_id: str
    student_id: int
    subject: str
    total_questions: int
    correct_count: int
    score_percentage: float
    time_taken_minutes: Optional[int]
    skill_breakdown: List[Dict[str, Any]]
    submitted_at: str
    engagement_transaction: Optional[Dict[str, Any]] = None


class AvailableSubjectsResponse(BaseModel):
    """Response model for available subjects"""
    available_subjects: list
    total_count: int
    assessment_supported: bool
    data_source: str
    message: Optional[str] = None


class AssessmentHistoryItem(BaseModel):
    """Model for individual assessment in history list"""
    assessment_id: str
    subject: str
    completed_at: str
    total_questions: int
    correct_count: int
    score_percentage: float


class AssessmentHistoryResponse(BaseModel):
    """Response model for assessment history"""
    assessments: List[AssessmentHistoryItem]
    total_count: int
    page: int
    limit: int


class SkillAnalysisItem(BaseModel):
    """Model for individual skill analysis in assessment summary"""
    skill_id: str
    skill_name: str
    total_questions: int
    correct_count: int
    assessment_focus: str
    performance_label: str
    insight_text: str
    next_step: Dict[str, str]


class ReviewItem(BaseModel):
    """Model for individual review item in assessment summary"""
    problem_id: str
    question_text: str
    your_answer_text: str
    correct_answer_text: str
    analysis: Dict[str, str]
    feedback: Dict[str, str]
    related_skill_id: str
    subskill_id: str
    subject: str
    lesson_link: str


# ============================================================================
# DEPENDENCY INJECTION - Following analytics.py pattern
# ============================================================================

def get_bigquery_analytics_service() -> BigQueryAnalyticsService:
    """Get BigQuery analytics service instance"""
    return BigQueryAnalyticsService(
        project_id=settings.GCP_PROJECT_ID,
        dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
    )

async def get_problem_service() -> ProblemService:
    """Get problem service instance with context primitives generators"""
    from ...dependencies import get_problem_service as get_main_problem_service
    from ...services.competency import CompetencyService
    from ...services.recommender import ProblemRecommender
    from ...db.cosmos_db import CosmosDBService
    from ...db.problem_optimizer import ProblemOptimizer

    # Use the main dependency injection function to get fully configured ProblemService
    cosmos_db = get_cosmos_service()
    competency_service = await get_competency_service()
    recommender = await get_problem_recommender(competency_service)
    problem_optimizer = await get_problem_optimizer(cosmos_db, recommender)

    # Get the fully configured ProblemService from main dependencies
    return await get_main_problem_service(recommender, cosmos_db, competency_service, problem_optimizer)

def get_cosmos_service() -> CosmosDBService:
    """Get Cosmos DB service instance"""
    return CosmosDBService()

async def get_curriculum_service(
    bigquery_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service)
) -> CurriculumService:
    """Get curriculum service instance with proper dependency injection"""
    from ...dependencies import get_curriculum_service as get_main_curriculum_service
    return await get_main_curriculum_service()

def get_review_service() -> ReviewService:
    """Get review service instance"""
    return ReviewService()

async def get_competency_service() -> CompetencyService:
    """Get competency service instance"""
    from ...dependencies import get_competency_service as get_main_competency_service
    return await get_main_competency_service()

async def get_problem_recommender(
    competency_service: CompetencyService = Depends(get_competency_service)
):
    """Get problem recommender instance"""
    from ...dependencies import get_problem_recommender as get_main_problem_recommender
    return await get_main_problem_recommender(competency_service)

async def get_problem_optimizer(
    cosmos_db: CosmosDBService = Depends(get_cosmos_service),
    recommender = Depends(get_problem_recommender)
):
    """Get problem optimizer instance"""
    from ...dependencies import get_problem_optimizer as get_main_problem_optimizer
    return await get_main_problem_optimizer(cosmos_db, recommender)

async def get_submission_service(
    review_service: ReviewService = Depends(get_review_service),
    competency_service: CompetencyService = Depends(get_competency_service),
    cosmos_service: CosmosDBService = Depends(get_cosmos_service)
) -> SubmissionService:
    """Get submission service instance with proper dependency injection"""
    return SubmissionService(
        review_service=review_service,
        competency_service=competency_service,
        cosmos_db=cosmos_service
    )

async def get_assessment_service(
    bigquery_service: BigQueryAnalyticsService = Depends(get_bigquery_analytics_service),
    problem_service: ProblemService = Depends(get_problem_service),
    curriculum_service: CurriculumService = Depends(get_curriculum_service),
    submission_service: SubmissionService = Depends(get_submission_service),
    cosmos_service: CosmosDBService = Depends(get_cosmos_service)
) -> AssessmentService:
    """Get assessment service instance with proper dependency injection"""
    return AssessmentService(
        bigquery_service=bigquery_service,
        problem_service=problem_service,
        curriculum_service=curriculum_service,
        submission_service=submission_service,
        cosmos_service=cosmos_service
    )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check for assessment service"""
    return {
        "status": "healthy",
        "service": "assessment_service",
        "version": "1.0.0",
        "features": {
            "assessment_generation": True,
            "skill_categorization": True,
            "personalized_selection": True,
            "bigquery_integration": True,
            "cold_start_handling": True,
            "dependency_injection": True
        },
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================================================
# METADATA EXTRACTORS FOR ENGAGEMENT DECORATORS
# ============================================================================

def extract_assessment_generation_metadata(kwargs, result):
    """Extract metadata for assessment generation engagement activity"""
    return {
        "subject": kwargs['subject'],
        "requested_count": kwargs['request'].question_count,
        "generated_count": len(result.problems) if hasattr(result, 'problems') else 0,
        "activity_name": f"Generated {kwargs['subject']} Assessment"
    }

def extract_assessment_submission_metadata(kwargs, result):
    """Extract metadata for assessment submission engagement activity"""
    # Handle both the new EnhancedAssessmentSummaryResponse and legacy responses
    if hasattr(result, 'dict'):
        result_data = result.dict()
    elif hasattr(result, '__dict__'):
        result_data = result.__dict__
    else:
        result_data = result

    correct_count = result_data.get('correct_count', 0)
    total_count = result_data.get('total_questions', 1)  # Avoid division by zero
    score_percentage = result_data.get('score_percentage', 0)

    return {
        "subject": kwargs['subject'],
        "correct_count": correct_count,
        "total_count": total_count,
        "score_percentage": score_percentage / 100.0,  # Convert percentage to decimal for XP calculation
        "time_taken_minutes": result_data.get('time_taken_minutes'),
        "skill_breakdown_count": len(result_data.get('skill_breakdown', [])),
        "activity_name": f"Completed {kwargs['subject']} Assessment"
    }


# ============================================================================
# ASSESSMENT GENERATION ENDPOINTS
# ============================================================================

@router.post("/{subject}/blueprint")
async def create_assessment_blueprint(
    subject: str,
    request: CreateAssessmentRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> AssessmentBlueprintResponse:
    """
    Generate an assessment blueprint for a student in a specific subject.

    This endpoint creates a personalized selection of subskills for assessment
    based on the student's learning history and performance patterns.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    # Validate access - user can only generate assessments for their own student
    if request.student_id != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {request.student_id} assessments"
            )

    try:
        logger.info(f"User {user_context['email']} creating assessment blueprint for student {request.student_id}, subject: {subject}")

        # Generate the assessment blueprint
        blueprint = await assessment_service.create_assessment_blueprint(
            student_id=request.student_id,
            subject=subject,
            question_count=request.question_count
        )

        if not blueprint:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not generate assessment blueprint"
            )

        # Log activity for tracking using the engagement service
        background_tasks.add_task(
            engagement_service.process_activity,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="assessment_blueprint_generated",
            metadata={
                "activity_name": f"Generated assessment blueprint for {subject}",
                "subject": subject,
                "question_count": request.question_count,
                "is_cold_start": blueprint.get("is_cold_start", False),
                "category_breakdown": blueprint.get("category_breakdown", {})
            }
        )

        return AssessmentBlueprintResponse(**blueprint)

    except ValueError as e:
        logger.error(f"Value error creating assessment blueprint: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating assessment blueprint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create assessment blueprint"
        )


@router.post("/{subject}")
@log_engagement_activity(
    activity_type="assessment_generated",
    metadata_extractor=extract_assessment_generation_metadata
)
async def create_assessment(
    subject: str,
    request: CreateAssessmentRequest,
    background_tasks: BackgroundTasks,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> AssessmentResponse:
    """
    Generate a complete personalized assessment for a student in a specific subject.

    This endpoint creates both the blueprint and generates the actual problems,
    returning a ready-to-use assessment.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    # Validate access - user can only generate assessments for their own student
    if request.student_id != student_id:
        if not getattr(settings, 'ALLOW_ANY_STUDENT_ANALYTICS', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to student {request.student_id} assessments"
            )

    try:
        logger.info(f"User {user_context['email']} creating full assessment for student {request.student_id}, subject: {subject}")

        # Generate the complete assessment with problems
        assessment = await assessment_service.generate_assessment_problems(
            student_id=request.student_id,
            subject=subject,
            question_count=request.question_count
        )

        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not generate assessment"
            )

        # Store the assessment in Cosmos DB
        stored = await assessment_service.store_assessment(
            assessment_data=assessment,
            firebase_uid=firebase_uid
        )

        if not stored:
            logger.warning(f"Failed to store assessment {assessment.get('assessment_id')} in Cosmos DB")

        # Engagement activity is now handled by the @log_engagement_activity decorator

        return AssessmentResponse(**assessment)

    except ValueError as e:
        logger.error(f"Value error creating assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create assessment"
        )


@router.post("/{subject}/submit")
@log_engagement_activity(
    activity_type="assessment_submitted",
    metadata_extractor=extract_assessment_submission_metadata
)
async def submit_assessment(
    subject: str,
    request: SubmitAssessmentRequest,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> EnhancedAssessmentSummaryResponse:
    """
    Submit student answers for an assessment, get the full scored summary,
    and persist the results. This is the correct endpoint for submitting assessments.
    Awards base XP + significant performance-based bonus.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} submitting assessment {request.assessment_id} for subject {subject}")

        # 1. Score the assessment. This handles everything:
        #    - Calls SubmissionService for each problem
        #    - Generates summary, skill analysis, problem reviews
        #    - Calls AI service for insights
        #    - Persists the complete results to the assessment document in CosmosDB
        await assessment_service.score_assessment(
            assessment_id=request.assessment_id,
            student_id=student_id,
            answers=request.answers,
            time_taken_minutes=request.time_taken_minutes,
            firebase_uid=firebase_uid
        )

        # 2. Fetch the newly generated summary to return to the client
        #    The data is now guaranteed to be in the database.
        summary_data = await assessment_service.get_assessment_summary(
            assessment_id=request.assessment_id,
            student_id=student_id,
            firebase_uid=firebase_uid
        )

        if not summary_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Scoring succeeded, but failed to retrieve the summary."
            )

        return EnhancedAssessmentSummaryResponse(**summary_data)

    except ValueError as e:
        logger.error(f"Value error submitting assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error submitting assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit assessment"
        )


# ============================================================================
# ASSESSMENT MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/assessment/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> AssessmentResponse:
    """
    Retrieve assessment data for taking the assessment.

    This endpoint allows students to retrieve a previously created assessment
    that is stored in Cosmos DB, enabling navigation to assessment URLs.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} retrieving assessment {assessment_id}")

        # Get the assessment from Cosmos DB
        assessment = await assessment_service.get_assessment(
            assessment_id=assessment_id,
            student_id=student_id,
            firebase_uid=firebase_uid
        )

        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found or expired"
            )

        # Check if assessment has expired
        if assessment.get("expires_at"):
            from datetime import datetime
            expires_at = datetime.fromisoformat(assessment["expires_at"])
            if datetime.utcnow() > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Assessment has expired"
                )

        # Update status to in_progress if it's still in created state
        if assessment.get("status") == "created":
            await assessment_service.update_assessment_status(
                assessment_id=assessment_id,
                student_id=student_id,
                status="in_progress",
                firebase_uid=firebase_uid
            )
            assessment["status"] = "in_progress"

        # Map Cosmos DB fields to response model fields
        response_data = {
            "assessment_id": assessment.get("assessment_id"),
            "student_id": assessment.get("student_id"),
            "subject": assessment.get("subject"),
            "total_questions": assessment.get("total_questions"),
            "estimated_duration_minutes": assessment.get("estimated_duration_minutes"),
            "blueprint": assessment.get("blueprint", {}),
            "problems": assessment.get("problems", []),
            "generated_at": assessment.get("created_at", assessment.get("generated_at", ""))
        }

        return AssessmentResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assessment"
        )


@router.get("/{assessment_id}/summary")
async def get_assessment_summary(
    assessment_id: str,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> EnhancedAssessmentSummaryResponse:
    """
    Get summary information for a completed assessment.

    This endpoint will be used to show assessment results and analytics
    after students complete their assessments.
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} getting assessment summary for {assessment_id}")

        summary = await assessment_service.get_assessment_summary(
            assessment_id=assessment_id,
            student_id=student_id,
            firebase_uid=firebase_uid
        )

        return EnhancedAssessmentSummaryResponse(**summary)

    except ValueError as e:
        logger.error(f"Value error getting assessment summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting assessment summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get assessment summary"
        )


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.get("/history")
async def get_assessment_history(
    page: int = 1,
    limit: int = 10,
    user_context: dict = Depends(get_user_context),
    assessment_service: AssessmentService = Depends(get_assessment_service)
) -> AssessmentHistoryResponse:
    """
    Get assessment history for the authenticated student.

    Returns a paginated list of completed assessments with their scores and metadata,
    sorted by completion date in descending order (most recent first).
    """
    firebase_uid = user_context["firebase_uid"]
    student_id = user_context["student_id"]

    try:
        logger.info(f"User {user_context['email']} getting assessment history for student {student_id}")

        # Validate pagination parameters
        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Page must be greater than 0"
            )
        if limit < 1 or limit > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit must be between 1 and 50"
            )

        # Get assessment history from service
        history_data = await assessment_service.get_assessment_history(
            student_id=student_id,
            firebase_uid=firebase_uid,
            page=page,
            limit=limit
        )

        return AssessmentHistoryResponse(**history_data)

    except ValueError as e:
        logger.error(f"Value error getting assessment history: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error getting assessment history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get assessment history"
        )


@router.get("/subjects")
async def get_available_subjects(
    user_context: dict = Depends(get_user_context),
    curriculum_service: CurriculumService = Depends(get_curriculum_service)
) -> AvailableSubjectsResponse:
    """
    Get list of subjects available for assessment.

    This endpoint returns subjects from the curriculum database that have
    enough data to generate meaningful assessments for students.
    """
    try:
        # Get subjects dynamically from the curriculum database
        subjects = await curriculum_service.get_available_subjects()

        if not subjects:
            logger.warning("No subjects found in curriculum database")
            # Fallback to empty list with appropriate message
            return AvailableSubjectsResponse(
                available_subjects=[],
                total_count=0,
                assessment_supported=False,
                data_source="curriculum_database",
                message="No subjects available in curriculum database"
            )

        return AvailableSubjectsResponse(
            available_subjects=subjects,
            total_count=len(subjects),
            assessment_supported=True,
            data_source="curriculum_database"
        )

    except Exception as e:
        logger.error(f"Error getting available subjects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available subjects from curriculum database"
        )


# ============================================================================
# BACKGROUND TASKS - Following problems.py pattern
# ============================================================================

async def log_activity_helper(
    user_id: str,
    student_id: int,
    activity_type: str,
    activity_name: str,
    points: int = 0,
    metadata: Dict = None
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


# ============================================================================
# ERROR HANDLERS - Note: Exception handlers are registered on the main app, not router
# ============================================================================

# Error handling is done within individual endpoints using try/catch blocks
# Global exception handlers would be registered on the main FastAPI app instance