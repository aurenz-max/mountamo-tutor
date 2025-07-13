# backend/app/api/endpoints/user_profiles.py - CLEAN VERSION WITH SERVICE LAYER
"""
User Profiles API Endpoints
Clean, focused endpoints that delegate business logic to the service layer
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import logging

# Import service and models
from ...services.user_profiles import user_profiles_service
from ...models.user_profiles import (
    UserProfile, UserProfileUpdate, OnboardingData, ActivityLog,
    ActivityResponse, UserStats, DashboardResponse,
    OnboardingStatusResponse, OnboardingCompletionResponse,
    OnboardingPreferencesResponse, ActivityHistoryResponse,
    HealthCheckResponse
)

# Import authentication and middleware
from ...core.middleware import get_user_context

router = APIRouter()
logger = logging.getLogger(__name__)


# ============================================================================
# PROFILE ENDPOINTS
# ============================================================================

@router.get("/profile", response_model=UserProfile)
async def get_current_user_profile(user_context: dict = Depends(get_user_context)):
    """Get current user's profile"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        # Try to get existing profile
        profile = await user_profiles_service.get_user_profile(firebase_uid)
        
        if profile:
            # Update last login time
            await user_profiles_service.update_user_profile(firebase_uid, {
                'last_login': datetime.utcnow()
            })
            return profile
        else:
            # Create new profile if it doesn't exist
            profile = await user_profiles_service.create_user_profile(
                uid=firebase_uid,
                student_id=student_id,
                email=user_context['email'],
                display_name=user_context.get('display_name')
            )
            return profile
        
    except Exception as e:
        logger.error(f"❌ Failed to get user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")


@router.put("/profile", response_model=UserProfile)
async def update_current_user_profile(
    profile_updates: UserProfileUpdate,
    user_context: dict = Depends(get_user_context)
):
    """Update user profile with onboarding support"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        updates = {}
        
        # Handle basic profile updates
        if profile_updates.display_name is not None:
            updates['display_name'] = profile_updates.display_name
        
        if profile_updates.grade_level is not None:
            updates['grade_level'] = profile_updates.grade_level
        
        if profile_updates.preferences is not None:
            updates['preferences'] = profile_updates.preferences
            
            # Check if this is an onboarding completion
            if 'onboarding' in profile_updates.preferences:
                onboarding_data = profile_updates.preferences['onboarding']
                
                try:
                    # Validate onboarding data
                    validated_onboarding = OnboardingData(**onboarding_data)
                    
                    # Use service to complete onboarding (handles validation, points, badges)
                    await user_profiles_service.complete_onboarding(
                        firebase_uid, student_id, validated_onboarding
                    )
                    
                    logger.info(f"🎉 Onboarding completed via profile update: {firebase_uid}")
                    
                except Exception as validation_error:
                    logger.error(f"❌ Invalid onboarding data: {str(validation_error)}")
                    raise HTTPException(status_code=400, detail=f"Invalid onboarding data: {str(validation_error)}")
        
        # Apply updates if any
        if updates:
            await user_profiles_service.update_user_profile(firebase_uid, updates)
        
        # Return updated profile
        updated_profile = await user_profiles_service.get_user_profile(firebase_uid)
        return updated_profile
        
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"❌ Failed to update user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user profile")


@router.delete("/profile")
async def delete_user_profile(user_context: dict = Depends(get_user_context)):
    """Delete user profile and all associated data (GDPR compliance)"""
    try:
        firebase_uid = user_context['firebase_uid']
        
        success = await user_profiles_service.delete_user_profile(firebase_uid)
        
        if success:
            logger.info(f"🗑️ User profile and data deleted: {user_context['email']}")
            return {"message": "Profile and all associated data deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="User profile not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete user profile")


# ============================================================================
# ONBOARDING ENDPOINTS
# ============================================================================

@router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(user_context: dict = Depends(get_user_context)):
    """Check if user has completed onboarding"""
    try:
        firebase_uid = user_context['firebase_uid']
        status = await user_profiles_service.get_onboarding_status(firebase_uid)
        return OnboardingStatusResponse(**status)
        
    except Exception as e:
        logger.error(f"❌ Failed to get onboarding status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get onboarding status")


@router.post("/onboarding/complete", response_model=OnboardingCompletionResponse)
async def complete_onboarding(
    onboarding_data: OnboardingData,
    user_context: dict = Depends(get_user_context)
):
    """Complete user onboarding with validated data"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        result = await user_profiles_service.complete_onboarding(
            firebase_uid, student_id, onboarding_data
        )
        
        logger.info(f"🎉 Onboarding completed successfully: {firebase_uid}")
        return OnboardingCompletionResponse(**result)
        
    except Exception as e:
        logger.error(f"❌ Failed to complete onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete onboarding")


@router.get("/preferences/onboarding", response_model=OnboardingPreferencesResponse)
async def get_onboarding_preferences(user_context: dict = Depends(get_user_context)):
    """Get user's onboarding preferences for display/editing"""
    try:
        firebase_uid = user_context['firebase_uid']
        preferences = await user_profiles_service.get_onboarding_preferences(firebase_uid)
        return OnboardingPreferencesResponse(**preferences)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get onboarding preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get onboarding preferences")


# ============================================================================
# ACTIVITY ENDPOINTS
# ============================================================================

@router.post("/activity/log", response_model=ActivityResponse)
async def log_activity_endpoint(
    activity: ActivityLog,
    user_context: dict = Depends(get_user_context)
):
    """Log user activity"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        response = await user_profiles_service.log_activity(firebase_uid, student_id, activity)
        return response
        
    except Exception as e:
        logger.error(f"❌ Failed to log activity: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log activity")


@router.get("/activity/history", response_model=ActivityHistoryResponse)
async def get_activity_history(
    limit: int = 20,
    user_context: dict = Depends(get_user_context)
):
    """Get user activity history"""
    try:
        firebase_uid = user_context['firebase_uid']
        activities = await user_profiles_service.get_user_activities(firebase_uid, limit)
        
        return ActivityHistoryResponse(
            activities=activities,
            count=len(activities)
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to get activity history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get activity history")


# ============================================================================
# STATISTICS AND DASHBOARD ENDPOINTS
# ============================================================================

@router.get("/stats", response_model=UserStats)
async def get_user_statistics(user_context: dict = Depends(get_user_context)):
    """Get comprehensive user statistics"""
    try:
        firebase_uid = user_context['firebase_uid']
        stats = await user_profiles_service.calculate_user_stats(firebase_uid)
        return stats
        
    except Exception as e:
        logger.error(f"❌ Failed to get user statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user statistics")


@router.get("/dashboard", response_model=DashboardResponse)
async def get_user_dashboard(user_context: dict = Depends(get_user_context)):
    """Get user dashboard with stats and recent activities"""
    try:
        firebase_uid = user_context['firebase_uid']
        dashboard = await user_profiles_service.get_user_dashboard(firebase_uid)
        return dashboard
        
    except Exception as e:
        logger.error(f"❌ Failed to get dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard")


# ============================================================================
# HEALTH AND UTILITY ENDPOINTS
# ============================================================================

@router.get("/health", response_model=HealthCheckResponse)
async def profiles_health_check():
    """Health check for user profiles service"""
    try:
        # Test basic service connectivity
        # This could be enhanced to test specific service methods
        return HealthCheckResponse(
            status="healthy",
            service="user_profiles",
            cosmos_db_connected=True,
            containers=["user_profiles", "user_activities"],
            auth_method="firebase_with_cosmos_storage",
            onboarding_support="enabled",
            features=[
                "user_profiles",
                "activity_logging", 
                "points_and_badges",
                "onboarding_completion",
                "personalized_recommendations",
                "service_layer_architecture"
            ]
        )
    except Exception as e:
        return HealthCheckResponse(
            status="unhealthy",
            service="user_profiles",
            cosmos_db_connected=False,
            containers=[],
            auth_method="firebase_with_cosmos_storage",
            onboarding_support="enabled",
            features=[],
            error=str(e)
        )


# ============================================================================
# DEVELOPMENT/TESTING ENDPOINTS
# ============================================================================

@router.post("/test/create-sample-data")
async def create_sample_data(user_context: dict = Depends(get_user_context)):
    """Create sample activity data for testing"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        sample_activities = [
            ActivityLog(
                activity_type="lesson", 
                activity_id="math_101", 
                activity_name="Introduction to Algebra",
                duration_seconds=300,
                difficulty_level="easy",
                accuracy_percentage=85.0
            ),
            ActivityLog(
                activity_type="problem", 
                activity_id="algebra_1", 
                activity_name="Solve for X",
                duration_seconds=120,
                difficulty_level="medium",
                accuracy_percentage=92.0
            ),
            ActivityLog(
                activity_type="quiz", 
                activity_id="geometry_basics", 
                activity_name="Basic Geometry Quiz",
                duration_seconds=600,
                difficulty_level="hard",
                accuracy_percentage=100.0
            ),
            ActivityLog(
                activity_type="login"
            )
        ]
        
        responses = []
        for activity in sample_activities:
            response = await user_profiles_service.log_activity(firebase_uid, student_id, activity)
            responses.append({
                "activity_type": activity.activity_type,
                "points_earned": response.points_earned,
                "activity_id": response.activity_id
            })
        
        return {
            "message": "Sample data created successfully",
            "activities_created": len(responses),
            "activities": responses
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create sample data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create sample data")


@router.post("/test/create-sample-onboarding")
async def create_sample_onboarding(user_context: dict = Depends(get_user_context)):
    """Create sample onboarding data for testing"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        # Create sample onboarding data
        sample_onboarding = OnboardingData(
            selectedSubjects=["mathematics", "science", "language-arts"],
            selectedPackages=["pkg_1748382674", "pkg_1749299572", "pkg_1748378718"],
            learningGoals=["improve-grades", "homework-help", "have-fun"],
            preferredLearningStyle=["visual", "hands-on"],
            onboardingCompleted=True,
            completedAt=datetime.utcnow().isoformat()
        )
        
        # Complete onboarding using service
        result = await user_profiles_service.complete_onboarding(
            firebase_uid, student_id, sample_onboarding
        )
        
        return {
            "message": "Sample onboarding data created successfully",
            "onboarding_data": sample_onboarding.dict(),
            "completion_result": result
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to create sample onboarding: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create sample onboarding")