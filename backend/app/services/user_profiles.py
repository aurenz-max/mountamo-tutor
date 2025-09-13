# backend/app/services/user_profiles.py
"""
User Profiles Service Layer
Handles all user profile business logic, data operations, and onboarding management
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
import logging
import uuid
from collections import defaultdict

from azure.cosmos import PartitionKey
from fastapi import HTTPException

from ..core.middleware import get_cosmos_db_service
from ..models.user_profiles import (
    UserProfile, OnboardingData, ActivityLog, ActivityResponse, 
    UserStats, DashboardResponse
)

logger = logging.getLogger(__name__)


class UserProfilesService:
    """Service layer for user profile operations"""
    
    def __init__(self):
        self.cosmos_db = get_cosmos_db_service()
    
    # ============================================================================
    # PROFILE MANAGEMENT
    # ============================================================================
    
    async def create_user_profile(
        self, 
        uid: str, 
        student_id: int,
        email: str, 
        display_name: str = None, 
        grade_level: str = None
    ) -> UserProfile:
        """Create a new user profile in Cosmos DB"""
        try:
            user_profile = UserProfile(
                uid=uid,
                student_id=student_id,
                email=email,
                display_name=display_name,
                grade_level=grade_level,
                email_verified=True,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow(),
                # XP System initialization
                total_xp=0,
                current_level=1,
                xp_for_next_level=100,
                current_streak=0,
                longest_streak=0,
                last_activity_date=None,
                onboarding_completed=False
            )
            
            # Store user profile in Cosmos DB
            profile_data = user_profile.dict()
            profile_data['id'] = str(uuid.uuid4())
            profile_data['firebase_uid'] = uid
            profile_data['type'] = 'user_profile'
            profile_data['created_at'] = profile_data['created_at'].isoformat()
            profile_data['last_login'] = profile_data['last_login'].isoformat()
            
            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            user_profiles_container.create_item(body=profile_data)
            
            # Log registration activity using EngagementService
            from ..services.engagement_service import engagement_service
            await engagement_service.process_activity(
                user_id=uid,
                student_id=student_id,
                activity_type="registration",
                metadata={
                    "activity_name": "User Registration",
                    "grade_level": grade_level
                }
            )
            
            logger.info(f"👤 User profile created: {email}")
            return user_profile
            
        except Exception as e:
            logger.error(f"❌ Failed to create user profile: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create user profile")
    
    async def get_user_profile(self, uid: str) -> Optional[UserProfile]:
        """Get user profile from Cosmos DB"""
        try:
            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            query = """
            SELECT * FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.type = 'user_profile'
            """
            
            params = [{"name": "@firebase_uid", "value": uid}]
            
            results = list(user_profiles_container.query_items(
                query=query,
                parameters=params,
                partition_key=uid
            ))
            
            if results:
                user_data = results[0]
                
                # Convert ISO strings back to datetime objects
                datetime_fields = ['created_at', 'last_login', 'last_activity', 'onboarding_completed_at']
                for field in datetime_fields:
                    if isinstance(user_data.get(field), str) and user_data.get(field):
                        user_data[field] = datetime.fromisoformat(user_data[field])
                
                # Clean data for UserProfile model
                profile_fields = {
                    'uid': user_data.get('uid'),
                    'student_id': user_data.get('student_id'),
                    'email': user_data.get('email'),
                    'display_name': user_data.get('display_name'),
                    'grade_level': user_data.get('grade_level'),
                    'email_verified': user_data.get('email_verified', False),
                    'created_at': user_data.get('created_at'),
                    'last_login': user_data.get('last_login'),
                    'last_activity': user_data.get('last_activity'),
                    # XP System fields (new)
                    'total_xp': user_data.get('total_xp', user_data.get('total_points', 0)),  # Fallback to legacy
                    'current_level': user_data.get('current_level', user_data.get('level', 1)),  # Fallback to legacy
                    'xp_for_next_level': user_data.get('xp_for_next_level', 100),
                    'current_streak': user_data.get('current_streak', 0),
                    'longest_streak': user_data.get('longest_streak', 0),
                    'last_activity_date': user_data.get('last_activity_date'),
                    'badges': user_data.get('badges', []),
                    'preferences': user_data.get('preferences', {}),
                    'onboarding_completed': user_data.get('onboarding_completed', False),
                    'onboarding_completed_at': user_data.get('onboarding_completed_at')
                }
                
                return UserProfile(**profile_fields)
            else:
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get user profile: {str(e)}")
            return None
    
    async def update_user_profile(self, uid: str, updates: dict) -> bool:
        """Update user profile in Cosmos DB"""
        try:
            profile = await self.get_user_profile(uid)
            if not profile:
                return False
            
            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            query = """
            SELECT * FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.type = 'user_profile'
            """
            
            params = [{"name": "@firebase_uid", "value": uid}]
            results = list(user_profiles_container.query_items(
                query=query,
                parameters=params,
                partition_key=uid
            ))
            
            if results:
                doc = results[0]
                
                # Add timestamp for updates
                updates['updated_at'] = datetime.utcnow().isoformat()
                
                # Convert datetime objects to ISO strings
                for key, value in updates.items():
                    if isinstance(value, datetime):
                        updates[key] = value.isoformat()
                
                doc.update(updates)
                user_profiles_container.replace_item(item=doc['id'], body=doc)
                
                logger.info(f"📝 User profile updated: {uid}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to update user profile: {str(e)}")
            return False
    
    async def delete_user_profile(self, uid: str) -> bool:
        """Delete user profile and all associated data (GDPR compliance)"""
        try:
            # Delete activities
            activities_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_activities",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            activities_query = """
            SELECT c.id FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.type = 'user_activity'
            """
            activities_params = [{"name": "@firebase_uid", "value": uid}]
            
            for activity in activities_container.query_items(
                query=activities_query,
                parameters=activities_params,
                partition_key=uid
            ):
                activities_container.delete_item(item=activity['id'], partition_key=uid)
            
            # Delete profile
            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            profile_query = """
            SELECT c.id FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.type = 'user_profile'
            """
            profile_params = [{"name": "@firebase_uid", "value": uid}]
            
            for profile in user_profiles_container.query_items(
                query=profile_query,
                parameters=profile_params,
                partition_key=uid
            ):
                user_profiles_container.delete_item(item=profile['id'], partition_key=uid)
            
            logger.info(f"🗑️ User data deleted: {uid}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete user profile: {str(e)}")
            return False
    
    # ============================================================================
    # ONBOARDING MANAGEMENT
    # ============================================================================
    
    async def complete_onboarding(
        self, 
        uid: str, 
        student_id: int, 
        onboarding_data: OnboardingData
    ) -> Dict[str, Any]:
        """Complete user onboarding with validation and rewards"""
        try:
            # Prepare preferences update
            preferences_update = {"onboarding": onboarding_data.dict()}
            
            # Update user profile
            updates = {
                'preferences': preferences_update,
                'onboarding_completed': True,
                'onboarding_completed_at': datetime.utcnow()
            }
            
            await self.update_user_profile(uid, updates)
            
            # Log onboarding completion activity using EngagementService
            from ..services.engagement_service import engagement_service
            activity_response = await engagement_service.process_activity(
                user_id=uid,
                student_id=student_id,
                activity_type="onboarding_completion",
                metadata={
                    "activity_name": "User Onboarding Completed",
                    "subjects_selected": len(onboarding_data.selectedSubjects),
                    "packages_selected": len(onboarding_data.selectedPackages),
                    "goals_selected": len(onboarding_data.learningGoals),
                    "learning_styles_selected": len(onboarding_data.preferredLearningStyle),
                    "completion_timestamp": onboarding_data.completedAt
                }
            )
            
            logger.info(f"🎉 Onboarding completed: {uid}")
            
            return {
                "message": "Onboarding completed successfully",
                "points_earned": activity_response.xp_earned,  # Updated to use XP
                "badges_earned": activity_response.badges_earned,
                "level_up": activity_response.level_up,
                "redirect_to": "/dashboard"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to complete onboarding: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to complete onboarding")
    
    async def get_onboarding_status(self, uid: str) -> Dict[str, Any]:
        """Get user's onboarding completion status"""
        try:
            profile = await self.get_user_profile(uid)
            
            if not profile:
                return {
                    "completed": False,
                    "redirect_to": "/onboarding"
                }
            
            return {
                "completed": profile.onboarding_completed,
                "completed_at": profile.onboarding_completed_at.isoformat() if profile.onboarding_completed_at else None,
                "redirect_to": "/dashboard" if profile.onboarding_completed else "/onboarding",
                "preferences": profile.preferences.get('onboarding') if profile.onboarding_completed else None
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get onboarding status: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get onboarding status")
    
    async def get_onboarding_preferences(self, uid: str) -> Dict[str, Any]:
        """Get user's onboarding preferences"""
        try:
            profile = await self.get_user_profile(uid)
            
            if not profile or not profile.onboarding_completed:
                raise HTTPException(status_code=404, detail="Onboarding not completed")
            
            onboarding_prefs = profile.preferences.get('onboarding')
            if not onboarding_prefs:
                raise HTTPException(status_code=404, detail="Onboarding preferences not found")
            
            return {
                "onboarding_data": onboarding_prefs,
                "completed_at": profile.onboarding_completed_at.isoformat() if profile.onboarding_completed_at else None
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to get onboarding preferences: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get onboarding preferences")
    
    # ============================================================================
    # ACTIVITY MANAGEMENT
    # ============================================================================
    
    async def add_activity_log_entry(self, user_id: str, student_id: int, activity: ActivityLog):
        """Writes a pre-constructed activity log to Cosmos DB."""
        try:
            activities_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_activities",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            activity_data = activity.dict()
            activity_data['id'] = str(uuid.uuid4())
            activity_data['firebase_uid'] = user_id
            activity_data['student_id'] = student_id
            activity_data['timestamp'] = datetime.utcnow().isoformat()
            activity_data['created_at'] = datetime.utcnow().isoformat()
            activity_data['type'] = 'user_activity'
            
            activities_container.create_item(body=activity_data)
            logger.info(f"📊 Activity logged: {user_id} - {activity.activity_type}")
        except Exception as e:
            logger.error(f"❌ Failed to write activity log entry: {str(e)}")
            # Don't re-raise, as this is often in a background task
    
    async def get_user_activities(self, user_id: str, limit: int = 20) -> List[dict]:
        """Get user activities from Cosmos DB"""
        try:
            activities_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_activities",
                partition_key=PartitionKey(path="/firebase_uid")
            )
            
            query = """
            SELECT * FROM c 
            WHERE c.firebase_uid = @firebase_uid 
            AND c.type = 'user_activity'
            ORDER BY c.timestamp DESC
            OFFSET 0 LIMIT @limit
            """
            
            params = [
                {"name": "@firebase_uid", "value": user_id},
                {"name": "@limit", "value": limit}
            ]
            
            activities = []
            for doc in activities_container.query_items(
                query=query,
                parameters=params,
                partition_key=user_id
            ):
                activities.append(doc)
            
            return activities
            
        except Exception as e:
            logger.error(f"❌ Failed to get activities: {str(e)}")
            return []
    
    # ============================================================================
    # STATISTICS AND DASHBOARD
    # ============================================================================
    
    async def calculate_user_stats(self, user_id: str) -> UserStats:
        """Calculate comprehensive user statistics"""
        try:
            user_profile = await self.get_user_profile(user_id)
            if not user_profile:
                raise HTTPException(status_code=404, detail="User profile not found")
            
            activities = await self.get_user_activities(user_id, 100)
            
            # Calculate time-based points
            now = datetime.utcnow()
            today = now.date()
            week_ago = now - timedelta(days=7)
            month_ago = now - timedelta(days=30)
            
            # Calculate time-based points (legacy)
            today_points = sum(
                act.get('points_earned', 0) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']).date() == today
            )
            
            week_points = sum(
                act.get('points_earned', 0) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']) >= week_ago
            )
            
            month_points = sum(
                act.get('points_earned', 0) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']) >= month_ago
            )
            
            # Calculate time-based XP (new)
            today_xp = sum(
                act.get('xp_earned', act.get('points_earned', 0)) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']).date() == today
            )
            
            week_xp = sum(
                act.get('xp_earned', act.get('points_earned', 0)) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']) >= week_ago
            )
            
            month_xp = sum(
                act.get('xp_earned', act.get('points_earned', 0)) for act in activities 
                if act.get('created_at') and datetime.fromisoformat(act['created_at']) >= month_ago
            )
            
            # Calculate activities by type and accuracy
            activities_by_type = defaultdict(int)
            total_accuracy = []
            
            for activity in activities:
                activity_type = activity.get('activity_type', 'unknown')
                activities_by_type[activity_type] += 1
                
                if activity.get('accuracy_percentage') is not None:
                    total_accuracy.append(activity['accuracy_percentage'])
            
            average_accuracy = sum(total_accuracy) / len(total_accuracy) if total_accuracy else None
            
            # Calculate XP for next level
            xp_for_next_level = getattr(user_profile, 'xp_for_next_level', 100)
            
            return UserStats(
                # Legacy fields for backward compatibility
                total_points=user_profile.total_xp,
                level=user_profile.current_level,
                today_points=today_points,
                week_points=week_points,
                month_points=month_points,
                # New XP fields as per PRD
                total_xp=user_profile.total_xp,
                current_level=user_profile.current_level,
                xp_for_next_level=xp_for_next_level,
                today_xp=today_xp,
                week_xp=week_xp,
                month_xp=month_xp,
                # Common fields
                current_streak=user_profile.current_streak,
                longest_streak=user_profile.longest_streak,
                total_activities=len(activities),
                activities_by_type=dict(activities_by_type),
                average_accuracy=average_accuracy
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate user stats: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to calculate statistics")
    
    async def get_user_dashboard(self, user_id: str) -> DashboardResponse:
        """Get complete user dashboard data"""
        try:
            profile = await self.get_user_profile(user_id)
            if not profile:
                raise HTTPException(status_code=404, detail="User profile not found")
            
            stats = await self.calculate_user_stats(user_id)
            recent_activities = await self.get_user_activities(user_id, 5)
            recommendations = self._generate_recommendations(profile, stats)
            
            return DashboardResponse(
                profile=profile,
                stats=stats,
                recent_activities=recent_activities,
                badges=profile.badges,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get dashboard: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get dashboard")
    
    # ============================================================================
    # PRIVATE HELPER METHODS
    # ============================================================================
    
    # Legacy calculation methods removed - now handled by EngagementService
    # This eliminates the conflicting XP/points logic that was causing issues
    
    # Badge checking and profile update methods moved to EngagementService
    # This consolidates all XP/progression logic in one place
    
    def _generate_recommendations(self, profile: UserProfile, stats: UserStats) -> List[Dict[str, str]]:
        """Generate personalized recommendations based on profile and stats"""
        recommendations = []
        
        # Onboarding-based recommendations
        if profile.onboarding_completed and profile.preferences.get('onboarding'):
            onboarding_data = profile.preferences['onboarding']
            
            selected_subjects = onboarding_data.get('selectedSubjects', [])
            learning_goals = onboarding_data.get('learningGoals', [])
            learning_styles = onboarding_data.get('preferredLearningStyle', [])
            
            if 'improve-grades' in learning_goals:
                recommendations.append({
                    "type": "goal", 
                    "message": f"Practice {', '.join(selected_subjects[:2])} to boost your grades!"
                })
            
            if 'visual' in learning_styles:
                recommendations.append({
                    "type": "style", 
                    "message": "Check out our visual learning modules with diagrams and videos!"
                })
            
            if 'hands-on' in learning_styles:
                recommendations.append({
                    "type": "style", 
                    "message": "Try interactive problem-solving activities!"
                })
        
        # General recommendations
        if stats.current_streak == 0:
            recommendations.append({"type": "streak", "message": "Start your learning streak today!"})
        elif stats.current_streak < 7:
            recommendations.append({
                "type": "streak", 
                "message": f"Keep going! {7 - stats.current_streak} more days to earn the Week Warrior badge!"
            })
        
        if profile.grade_level:
            recommendations.append({
                "type": "content", 
                "message": f"Try grade {profile.grade_level} activities to match your level!"
            })
        
        return recommendations


# ============================================================================
# SERVICE INSTANCE
# ============================================================================

user_profiles_service = UserProfilesService()