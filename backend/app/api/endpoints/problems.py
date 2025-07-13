# backend/app/api/endpoints/problems.py - FIXED VERSION WITH SERVICE LAYER

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import re

# FIXED: Import from service layer instead of endpoint
from ...core.middleware import get_user_context
from ...services.user_profiles import user_profiles_service
from ...models.user_profiles import ActivityLog
from ...dependencies import get_problem_service, get_competency_service, get_review_service
from ...services.problems import ProblemService
from ...services.competency import CompetencyService
from ...services.review import ReviewService
from ...services.bigquery_analytics import BigQueryAnalyticsService
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
    solution_image: str
    skill_id: str
    subskill_id: Optional[str] = None
    student_answer: Optional[str] = ""
    canvas_used: bool = True

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
        # Validate image data
        if not submission.solution_image:
            raise HTTPException(status_code=400, detail="No image data provided")

        image_data = submission.solution_image
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
            
        if not re.match(r'^[A-Za-z0-9+/=]+$', image_data):
            raise HTTPException(status_code=400, detail="Invalid image data format")

        logger.info(f"User {user_context['email']} submitting problem for student {student_id}")

        # Get problem review
        review = await review_service.review_problem(
            student_id=student_id,
            subject=submission.subject,
            problem=submission.problem,
            solution_image_base64=image_data,
            skill_id=submission.skill_id,
            subskill_id=submission.subskill_id,
            student_answer=submission.student_answer or "",
            canvas_used=submission.canvas_used,
        )
        
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
        background_tasks.add_task(
            log_activity_helper,
            user_id=firebase_uid,
            student_id=student_id,
            activity_type="problem_submitted",
            activity_name=f"Submitted {submission.subject} problem",
            points=points,
            metadata={
                "subject": submission.subject,
                "skill_id": submission.skill_id,
                "student_id": student_id,
                "score": score,
                "accuracy": accuracy,
                "correct": is_correct
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
            "activity_logging": True  # NEW: Proper activity logging
        },
        "timestamp": datetime.utcnow().isoformat()
    }