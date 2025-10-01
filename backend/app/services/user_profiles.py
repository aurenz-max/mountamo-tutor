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
    UserStats, DashboardResponse, StudentMisconception
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
                # Keep the original document for potential migration
                original_doc = results[0]
                # Work with a copy for datetime conversions
                user_data = results[0].copy()

                # Convert ISO strings back to datetime objects
                datetime_fields = ['created_at', 'last_login', 'last_activity', 'onboarding_completed_at']
                for field in datetime_fields:
                    if isinstance(user_data.get(field), str) and user_data.get(field):
                        user_data[field] = datetime.fromisoformat(user_data[field])

                # Parse misconceptions from raw dict to StudentMisconception objects
                raw_misconceptions = user_data.get('misconceptions', [])
                parsed_misconceptions = []
                if raw_misconceptions:
                    for raw_misc in raw_misconceptions:
                        try:
                            # Convert last_detected_at string to datetime if needed
                            if isinstance(raw_misc.get('last_detected_at'), str):
                                raw_misc['last_detected_at'] = datetime.fromisoformat(raw_misc['last_detected_at'])

                            # Convert resolved_at string to datetime if exists
                            if 'resolved_at' in raw_misc and isinstance(raw_misc.get('resolved_at'), str):
                                raw_misc['resolved_at'] = datetime.fromisoformat(raw_misc['resolved_at'])

                            parsed_misconceptions.append(StudentMisconception(**raw_misc))
                        except Exception as e:
                            logger.warning(f"⚠️ [USER_PROFILES] Failed to parse misconception: {str(e)}")
                            continue
                
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
                    'onboarding_completed_at': user_data.get('onboarding_completed_at'),
                    # Misconception tracking (new) - use parsed StudentMisconception objects
                    'misconceptions': parsed_misconceptions
                }

                # Migration: If misconceptions field doesn't exist in Cosmos DB, add it
                if 'misconceptions' not in original_doc:
                    logger.info(f"🔄 [USER_PROFILES] Migrating profile for {uid} - adding misconceptions field")
                    try:
                        # Use the original document (which has ISO strings, not datetime objects)
                        original_doc['misconceptions'] = []
                        user_profiles_container.replace_item(item=original_doc['id'], body=original_doc)
                        logger.info(f"✅ [USER_PROFILES] Migration successful - misconceptions field added to Cosmos DB")
                    except Exception as e:
                        logger.warning(f"⚠️ [USER_PROFILES] Failed to migrate profile: {str(e)}")
                        import traceback
                        logger.warning(f"⚠️ [USER_PROFILES] Traceback: {traceback.format_exc()}")
                
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
    # MISCONCEPTION MANAGEMENT
    # ============================================================================

    async def add_or_update_misconception(
        self,
        uid: str,
        subskill_id: str,
        misconception_text: str,
        assessment_id: str
    ) -> bool:
        """
        Add or update a misconception in the user's profile.

        This method is called by the AssessmentService after scoring to persist
        AI-identified misconceptions for targeted remediation.

        Args:
            uid: User's Firebase UID
            subskill_id: The subskill this misconception relates to
            misconception_text: AI-generated description of the misconception
            assessment_id: Assessment ID that identified this misconception

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )

            query = "SELECT * FROM c WHERE c.firebase_uid = @uid AND c.type = 'user_profile'"
            params = [{"name": "@uid", "value": uid}]
            items = list(user_profiles_container.query_items(query=query, parameters=params, partition_key=uid))

            if not items:
                logger.warning(f"⚠️ User profile not found for UID {uid} when adding misconception")
                return False

            doc = items[0]

            # Ensure misconceptions field exists and is a list
            if 'misconceptions' not in doc or not isinstance(doc['misconceptions'], list):
                doc['misconceptions'] = []

            # Check if misconception for this subskill already exists
            existing_misconception = next(
                (m for m in doc['misconceptions'] if m.get('subskill_id') == subskill_id),
                None
            )

            if existing_misconception:
                # Update existing misconception
                logger.info(f"🔄 Updating existing misconception for user {uid}, subskill {subskill_id}")
                existing_misconception['misconception_text'] = misconception_text
                existing_misconception['source_assessment_id'] = assessment_id
                existing_misconception['last_detected_at'] = datetime.utcnow().isoformat()
                existing_misconception['status'] = 'active'  # Mark as active again
            else:
                # Add new misconception
                logger.info(f"➕ Adding new misconception for user {uid}, subskill {subskill_id}")
                new_misconception = {
                    "subskill_id": subskill_id,
                    "misconception_text": misconception_text,
                    "source_assessment_id": assessment_id,
                    "last_detected_at": datetime.utcnow().isoformat(),
                    "status": "active"
                }
                doc['misconceptions'].append(new_misconception)

            # Persist changes
            doc['updated_at'] = datetime.utcnow().isoformat()
            user_profiles_container.replace_item(item=doc['id'], body=doc)

            logger.info(f"✅ Misconception stored successfully for user {uid}, subskill {subskill_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to add or update misconception for UID {uid}: {str(e)}")
            return False

    async def get_active_misconception_for_subskill(
        self,
        uid: str,
        subskill_id: str
    ) -> Optional[StudentMisconception]:
        """
        Retrieve the active misconception for a given subskill.

        This method is called by AssessmentService when building practice recommendations
        to enable targeted remediation.

        Args:
            uid: User's Firebase UID
            subskill_id: The subskill to check for misconceptions

        Returns:
            StudentMisconception if found, None otherwise
        """
        try:
            logger.info(f"🔵 [USER_PROFILES] get_active_misconception_for_subskill() called")
            logger.info(f"🔵 [USER_PROFILES] Parameters: uid={uid[:8]}..., subskill_id={subskill_id}")

            profile = await self.get_user_profile(uid)

            if not profile:
                logger.warning(f"⚠️ [USER_PROFILES] No profile found for uid {uid[:8]}...")
                return None

            if not profile.misconceptions:
                logger.info(f"📝 [USER_PROFILES] Profile found but no misconceptions list exists")
                return None

            logger.info(f"📊 [USER_PROFILES] Profile has {len(profile.misconceptions)} total misconceptions")
            logger.info(f"🔍 [USER_PROFILES] Misconceptions type: {type(profile.misconceptions)}")
            logger.info(f"🔍 [USER_PROFILES] Misconceptions content: {profile.misconceptions}")

            # Find active misconception for this subskill
            for idx, misconception in enumerate(profile.misconceptions):
                logger.info(f"🔍 [USER_PROFILES] Checking misconception #{idx+1} (type: {type(misconception)})")
                logger.info(f"🔍 [USER_PROFILES] Misconception data: subskill_id={getattr(misconception, 'subskill_id', 'N/A')}, status={getattr(misconception, 'status', 'N/A')}")

                if misconception.subskill_id == subskill_id:
                    logger.info(f"🎯 [USER_PROFILES] Found matching subskill_id: {subskill_id}")

                    if misconception.status == 'active':
                        logger.info(f"✅ [USER_PROFILES] ACTIVE misconception found!")
                        logger.info(f"📝 [USER_PROFILES] Misconception text: {misconception.misconception_text[:100]}...")
                        logger.info(f"🕐 [USER_PROFILES] Last detected: {misconception.last_detected_at}")
                        return misconception
                    else:
                        logger.info(f"⏭️ [USER_PROFILES] Misconception exists but status is '{misconception.status}' (not active)")

            logger.info(f"❌ [USER_PROFILES] No active misconception found for subskill {subskill_id}")
            return None

        except Exception as e:
            logger.error(f"❌ [USER_PROFILES] Exception in get_active_misconception_for_subskill: {str(e)}")
            import traceback
            logger.error(f"❌ [USER_PROFILES] Traceback: {traceback.format_exc()}")
            return None

    async def resolve_misconception(
        self,
        uid: str,
        subskill_id: str
    ) -> bool:
        """
        Mark a misconception as resolved based on improved performance.

        This method can be called when a student demonstrates mastery of a previously
        misunderstood concept (future feature for Phase 5).

        Args:
            uid: User's Firebase UID
            subskill_id: The subskill misconception to resolve

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"🟠 [USER_PROFILES] ========== RESOLVE_MISCONCEPTION START ==========")
            logger.info(f"🟠 [USER_PROFILES] Parameters: uid={uid[:8]}..., subskill_id={subskill_id}")

            user_profiles_container = self.cosmos_db.database.create_container_if_not_exists(
                id="user_profiles",
                partition_key=PartitionKey(path="/firebase_uid")
            )

            logger.info(f"🔍 [USER_PROFILES] Querying Cosmos DB for user profile")
            query = "SELECT * FROM c WHERE c.firebase_uid = @uid AND c.type = 'user_profile'"
            params = [{"name": "@uid", "value": uid}]
            items = list(user_profiles_container.query_items(query=query, parameters=params, partition_key=uid))

            if not items:
                logger.error(f"❌ [USER_PROFILES] User profile not found for UID {uid[:8]}...")
                return False

            doc = items[0]
            logger.info(f"✅ [USER_PROFILES] User profile document found")

            if 'misconceptions' not in doc or not isinstance(doc['misconceptions'], list):
                logger.error(f"❌ [USER_PROFILES] No misconceptions field in profile or not a list")
                return False

            logger.info(f"📊 [USER_PROFILES] Profile has {len(doc['misconceptions'])} misconceptions")

            # Find and resolve the misconception
            found = False
            for idx, misconception in enumerate(doc['misconceptions']):
                logger.info(f"🔍 [USER_PROFILES] Checking misconception #{idx+1}: subskill_id={misconception.get('subskill_id')}, status={misconception.get('status')}")

                if misconception.get('subskill_id') == subskill_id:
                    logger.info(f"🎯 [USER_PROFILES] Found matching subskill_id: {subskill_id}")

                    if misconception.get('status') == 'active':
                        logger.info(f"🔄 [USER_PROFILES] Updating misconception status from 'active' to 'resolved'")
                        misconception['status'] = 'resolved'
                        misconception['resolved_at'] = datetime.utcnow().isoformat()
                        found = True
                        logger.info(f"✅ [USER_PROFILES] Misconception marked as resolved!")
                        logger.info(f"🕐 [USER_PROFILES] Resolved at: {misconception['resolved_at']}")
                        break
                    else:
                        logger.warning(f"⚠️ [USER_PROFILES] Misconception found but status is '{misconception.get('status')}' (not 'active')")

            if found:
                logger.info(f"💾 [USER_PROFILES] Saving updated profile to Cosmos DB")
                doc['updated_at'] = datetime.utcnow().isoformat()
                user_profiles_container.replace_item(item=doc['id'], body=doc)
                logger.info(f"🎉 [USER_PROFILES] ✅ Successfully resolved and saved misconception for subskill {subskill_id}")
                logger.info(f"🟠 [USER_PROFILES] ========== RESOLVE_MISCONCEPTION SUCCESS ==========")
                return True
            else:
                logger.error(f"❌ [USER_PROFILES] No active misconception found to resolve for subskill {subskill_id}")
                logger.info(f"🟠 [USER_PROFILES] ========== RESOLVE_MISCONCEPTION FAILED ==========")
                return False

        except Exception as e:
            logger.error(f"❌ [USER_PROFILES] Exception in resolve_misconception: {str(e)}")
            import traceback
            logger.error(f"❌ [USER_PROFILES] Traceback: {traceback.format_exc()}")
            logger.info(f"🟠 [USER_PROFILES] ========== RESOLVE_MISCONCEPTION ERROR ==========")
            return False

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