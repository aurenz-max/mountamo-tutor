# backend/app/api/endpoints/user_profiles.py - FIXED VERSION
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import logging
from collections import defaultdict
import uuid
from azure.cosmos import PartitionKey  # FIXED: Import PartitionKey directly

# Import authentication and middleware dependencies
from .auth import verify_firebase_token
from ...core.middleware import get_user_context, require_auth, get_cosmos_db_service
from ...core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# UPDATED: Pydantic Models for User Profiles with String Grade Levels
class UserProfile(BaseModel):
    uid: str
    student_id: int
    email: str
    display_name: Optional[str] = None
    grade_level: Optional[str] = None  # FIXED: Changed from int to str
    email_verified: bool = False
    created_at: datetime
    last_login: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    total_points: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    badges: List[str] = []
    level: int = 1
    preferences: Dict[str, Any] = {}

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    grade_level: Optional[str] = None  # FIXED: Changed from int to str
    preferences: Optional[Dict[str, Any]] = None
    
    @validator('grade_level')
    def validate_grade_level(cls, v):
        """Validate grade level if provided"""
        if v is not None:
            valid_grades = [
                'K', '1st', '2nd', '3rd', '4th', '5th', 
                '6th', '7th', '8th', '9th', '10th', '11th', '12th'
            ]
            if v not in valid_grades:
                raise ValueError(f'Grade level must be one of: {", ".join(valid_grades)}')
        return v

class ActivityLog(BaseModel):
    activity_type: str  # "lesson", "problem", "quiz", "login", "competency_view", "curriculum_access"
    activity_id: Optional[str] = None
    activity_name: Optional[str] = None
    points_earned: int = 0
    duration_seconds: Optional[int] = None
    accuracy_percentage: Optional[float] = Field(None, ge=0, le=100)
    difficulty_level: Optional[str] = None  # "easy", "medium", "hard"
    success: bool = True
    metadata: Optional[Dict[str, Any]] = {}

class ActivityResponse(BaseModel):
    activity_id: str
    points_earned: int
    total_points: int
    level_up: bool = False
    badges_earned: List[str] = []

class UserStats(BaseModel):
    total_points: int
    current_streak: int
    longest_streak: int
    level: int
    today_points: int
    week_points: int
    month_points: int
    total_activities: int
    activities_by_type: Dict[str, int]
    average_accuracy: Optional[float] = None

class DashboardResponse(BaseModel):
    profile: UserProfile
    stats: UserStats
    recent_activities: List[Dict[str, Any]]
    badges: List[str]
    recommendations: List[Dict[str, str]]

# FIXED: User Profile Management with Cosmos DB - Updated function signature
async def create_user_profile(
    uid: str, 
    student_id: int,
    email: str, 
    display_name: str = None, 
    grade_level: str = None  # FIXED: Changed from int to str
) -> UserProfile:
    """Create user profile in Cosmos DB"""
    try:
        cosmos_db = get_cosmos_db_service()
        
        # Create user profile
        user_profile = UserProfile(
            uid=uid,
            student_id=student_id,
            email=email,
            display_name=display_name,
            grade_level=grade_level,  # Now accepts strings like "K", "5th", etc.
            email_verified=True,  # Assume verified since coming from Firebase auth
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow()
        )
        
        # Store user profile in Cosmos DB user_profiles container
        profile_data = user_profile.dict()
        profile_data['id'] = str(uuid.uuid4())
        profile_data['firebase_uid'] = uid
        profile_data['type'] = 'user_profile'
        profile_data['created_at'] = profile_data['created_at'].isoformat()
        profile_data['last_login'] = profile_data['last_login'].isoformat()
        
        # FIXED: Create user_profiles container with correct PartitionKey import
        user_profiles_container = cosmos_db.database.create_container_if_not_exists(
            id="user_profiles",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        user_profiles_container.create_item(body=profile_data)
        
        # Log registration activity
        await log_user_activity_internal(uid, student_id, ActivityLog(
            activity_type="registration",
            points_earned=10,
            metadata={"grade_level": grade_level}
        ))
        
        logger.info(f"👤 User profile created in Cosmos DB for: {email}")
        return user_profile
        
    except Exception as e:
        logger.error(f"❌ Failed to create user profile in Cosmos DB: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create user profile")

async def get_user_profile(uid: str) -> Optional[UserProfile]:
    """Get user profile from Cosmos DB"""
    try:
        cosmos_db = get_cosmos_db_service()
        
        # FIXED: Create user_profiles container with correct PartitionKey import
        user_profiles_container = cosmos_db.database.create_container_if_not_exists(
            id="user_profiles",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
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
            if isinstance(user_data.get('created_at'), str):
                user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
            if isinstance(user_data.get('last_login'), str) and user_data.get('last_login'):
                user_data['last_login'] = datetime.fromisoformat(user_data['last_login'])
            if isinstance(user_data.get('last_activity'), str) and user_data.get('last_activity'):
                user_data['last_activity'] = datetime.fromisoformat(user_data['last_activity'])
            
            # FIXED: Clean the data to only include UserProfile fields to avoid conflicts
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
                'total_points': user_data.get('total_points', 0),
                'current_streak': user_data.get('current_streak', 0),
                'longest_streak': user_data.get('longest_streak', 0),
                'badges': user_data.get('badges', []),
                'level': user_data.get('level', 1),
                'preferences': user_data.get('preferences', {})
            }
            
            return UserProfile(**profile_fields)
        else:
            return None
            
    except Exception as e:
        logger.error(f"❌ Failed to get user profile from Cosmos DB: {str(e)}")
        return None

async def update_user_profile(uid: str, updates: dict) -> bool:
    """Update user profile in Cosmos DB"""
    try:
        cosmos_db = get_cosmos_db_service()
        
        # Get existing profile first
        profile = await get_user_profile(uid)
        if not profile:
            return False
        
        # FIXED: Create user_profiles container with correct PartitionKey import
        user_profiles_container = cosmos_db.database.create_container_if_not_exists(
            id="user_profiles",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        # Get the document to update
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
            
            # Convert datetime objects to ISO strings if needed
            for key, value in updates.items():
                if isinstance(value, datetime):
                    updates[key] = value.isoformat()
            
            # Update the document
            doc.update(updates)
            user_profiles_container.replace_item(item=doc['id'], body=doc)
            
            logger.info(f"📝 User profile updated in Cosmos DB for UID: {uid}")
            return True
        
        return False
        
    except Exception as e:
        logger.error(f"❌ Failed to update user profile in Cosmos DB: {str(e)}")
        return False

# Activity Logging and Point Calculation (unchanged)
def calculate_points(activity: ActivityLog) -> int:
    """Calculate points based on activity type, difficulty, and performance"""
    base_points = {
        "registration": 10,
        "login": 5,
        "lesson": 10,
        "problem": 15,
        "quiz": 20,
        "competency_view": 2,
        "curriculum_access": 3,
        "learning_path_start": 15,
        "perfect_score": 25
    }
    
    points = base_points.get(activity.activity_type, 5)
    
    # Difficulty multiplier
    difficulty_multipliers = {"easy": 1.0, "medium": 1.5, "hard": 2.0}
    if activity.difficulty_level:
        points *= difficulty_multipliers.get(activity.difficulty_level, 1.0)
    
    # Accuracy bonus
    if activity.accuracy_percentage:
        if activity.accuracy_percentage >= 95:
            points *= 1.5  # Perfect/near-perfect bonus
        elif activity.accuracy_percentage >= 80:
            points *= 1.2  # Good performance bonus
    
    # Speed bonus (if completed quickly)
    if activity.duration_seconds and activity.activity_type in ["problem", "quiz"]:
        expected_time = {"problem": 300, "quiz": 600}  # 5 min, 10 min
        if activity.duration_seconds < expected_time.get(activity.activity_type, 300) * 0.7:
            points *= 1.3  # Speed bonus
    
    return int(points)

def calculate_level(total_points: int) -> int:
    """Calculate user level based on total points"""
    # Level progression: 100, 300, 600, 1000, 1500, etc.
    level = 1
    points_needed = 100
    
    while total_points >= points_needed:
        level += 1
        points_needed += level * 200
    
    return level

def check_new_badges(user_profile: UserProfile, activity: ActivityLog) -> List[str]:
    """Check if user earned new badges"""
    new_badges = []
    
    # Streak badges
    if user_profile.current_streak == 7 and "week_warrior" not in user_profile.badges:
        new_badges.append("week_warrior")
    elif user_profile.current_streak == 30 and "month_master" not in user_profile.badges:
        new_badges.append("month_master")
    
    # Point milestones
    if user_profile.total_points >= 1000 and "thousand_club" not in user_profile.badges:
        new_badges.append("thousand_club")
    elif user_profile.total_points >= 5000 and "five_k_hero" not in user_profile.badges:
        new_badges.append("five_k_hero")
    
    # Accuracy badges
    if activity.accuracy_percentage and activity.accuracy_percentage == 100:
        if "perfectionist" not in user_profile.badges:
            new_badges.append("perfectionist")
    
    # Activity type badges
    activity_badges = {
        "problem": "problem_solver",
        "quiz": "quiz_master",
        "lesson": "knowledge_seeker"
    }
    
    if activity.activity_type in activity_badges:
        badge_name = activity_badges[activity.activity_type]
        if badge_name not in user_profile.badges:
            new_badges.append(badge_name)
    
    return new_badges

async def log_user_activity_internal(user_id: str, student_id: int, activity: ActivityLog) -> ActivityResponse:
    """Internal activity logging with point calculation and badge checking"""
    try:
        cosmos_db = get_cosmos_db_service()
        
        # Calculate points
        points_earned = calculate_points(activity)
        activity.points_earned = points_earned
        
        # Get current user profile
        user_profile = await get_user_profile(user_id)
        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        # FIXED: Add activity to Cosmos DB activities container
        activities_container = cosmos_db.database.create_container_if_not_exists(
            id="user_activities",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        activity_data = activity.dict()
        activity_data['id'] = str(uuid.uuid4())
        activity_data['firebase_uid'] = user_id
        activity_data['student_id'] = student_id
        activity_data['timestamp'] = datetime.utcnow().isoformat()
        activity_data['created_at'] = datetime.utcnow().isoformat()
        activity_data['type'] = 'user_activity'
        
        activity_ref = activities_container.create_item(body=activity_data)
        
        # Update user profile
        new_total_points = user_profile.total_points + points_earned
        new_level = calculate_level(new_total_points)
        level_up = new_level > user_profile.level
        
        # Update streak logic
        today = datetime.utcnow().date()
        last_activity_date = user_profile.last_activity.date() if user_profile.last_activity else None
        
        if last_activity_date == today:
            # Same day, no streak change
            new_streak = user_profile.current_streak
        elif last_activity_date == today - timedelta(days=1):
            # Consecutive day, increment streak
            new_streak = user_profile.current_streak + 1
        else:
            # Streak broken
            new_streak = 1
        
        # Check for new badges - FIXED: Create profile with explicit field mapping
        updated_profile_data = {
            'uid': user_profile.uid,
            'student_id': user_profile.student_id,
            'email': user_profile.email,
            'display_name': user_profile.display_name,
            'grade_level': user_profile.grade_level,
            'email_verified': user_profile.email_verified,
            'created_at': user_profile.created_at,
            'last_login': user_profile.last_login,
            'last_activity': datetime.utcnow(),
            'total_points': new_total_points,
            'current_streak': new_streak,
            'longest_streak': max(user_profile.longest_streak, new_streak),
            'badges': user_profile.badges,
            'level': new_level,
            'preferences': user_profile.preferences
        }
        
        updated_profile = UserProfile(**updated_profile_data)
        
        new_badges = check_new_badges(updated_profile, activity)
        
        # Update user document
        update_data = {
            'total_points': new_total_points,
            'current_streak': new_streak,
            'longest_streak': max(user_profile.longest_streak, new_streak),
            'level': new_level,
            'last_activity': datetime.utcnow().isoformat()
        }
        
        if new_badges:
            update_data['badges'] = user_profile.badges + new_badges
        
        await update_user_profile(user_id, update_data)
        
        logger.info(f"📊 Activity logged for user {user_id}: {activity.activity_type} (+{points_earned} points)")
        
        return ActivityResponse(
            activity_id=activity_ref['id'],
            points_earned=points_earned,
            total_points=new_total_points,
            level_up=level_up,
            badges_earned=new_badges
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to log activity: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log activity")

async def get_user_activities(user_id: str, limit: int = 20) -> List[dict]:
    """Get user activities from Cosmos DB"""
    try:
        cosmos_db = get_cosmos_db_service()
        
        # FIXED: Create activities container with correct PartitionKey import
        activities_container = cosmos_db.database.create_container_if_not_exists(
            id="user_activities",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
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

async def calculate_user_stats(user_id: str) -> UserStats:
    """Calculate comprehensive user statistics"""
    try:
        # Get user profile
        user_profile = await get_user_profile(user_id)
        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        # Get activities for calculations
        activities = await get_user_activities(user_id, 100)  # Get more for calculations
        
        # Calculate time-based points
        now = datetime.utcnow()
        today = now.date()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
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
        
        # Calculate activities by type
        activities_by_type = defaultdict(int)
        total_accuracy = []
        
        for activity in activities:
            activity_type = activity.get('activity_type', 'unknown')
            activities_by_type[activity_type] += 1
            
            if activity.get('accuracy_percentage') is not None:
                total_accuracy.append(activity['accuracy_percentage'])
        
        average_accuracy = sum(total_accuracy) / len(total_accuracy) if total_accuracy else None
        
        return UserStats(
            total_points=user_profile.total_points,
            current_streak=user_profile.current_streak,
            longest_streak=user_profile.longest_streak,
            level=user_profile.level,
            today_points=today_points,
            week_points=week_points,
            month_points=month_points,
            total_activities=len(activities),
            activities_by_type=dict(activities_by_type),
            average_accuracy=average_accuracy
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to calculate user stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate statistics")

# ============================================================================
# ACTIVITY LOGGING UTILITY - Moved from middleware.py
# ============================================================================

async def log_activity(
    user_id: str,
    activity_type: str,
    activity_name: str = None,
    points: int = 0,
    metadata: dict = None
):
    """Simplified activity logging utility"""
    try:
        activity = ActivityLog(
            activity_type=activity_type,
            activity_name=activity_name or f"{activity_type} activity",
            points_earned=points,
            metadata=metadata or {}
        )
        
        # We need the student_id - get it from user context
        cosmos_db = get_cosmos_db_service()
        student_mapping = await cosmos_db.get_student_mapping(user_id)
        if not student_mapping:
            logger.error(f"No student mapping found for user {user_id}")
            return None
            
        return await log_user_activity_internal(user_id, student_mapping["student_id"], activity)
    except Exception as e:
        logger.error(f"Failed to log activity: {str(e)}")
        return None

# API Endpoints
@router.get("/profile", response_model=UserProfile)
async def get_current_user_profile(user_context: dict = Depends(get_user_context)):
    """Get current user's profile using new auth methodology"""
    try:
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        # Try to get profile from Cosmos DB
        profile = await get_user_profile(firebase_uid)
        
        if profile:
            # Update last login time
            await update_user_profile(firebase_uid, {
                'last_login': datetime.utcnow()
            })
            return profile
        else:
            # Create profile if it doesn't exist
            profile = await create_user_profile(
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
    """Update user profile"""
    try:
        firebase_uid = user_context['firebase_uid']
        updates = {}
        
        if profile_updates.display_name is not None:
            updates['display_name'] = profile_updates.display_name
        
        if profile_updates.grade_level is not None:
            updates['grade_level'] = profile_updates.grade_level
        
        if profile_updates.preferences is not None:
            updates['preferences'] = profile_updates.preferences
        
        if updates:
            await update_user_profile(firebase_uid, updates)
        
        # Return updated profile
        updated_profile = await get_user_profile(firebase_uid)
        return updated_profile
        
    except Exception as e:
        logger.error(f"❌ Failed to update user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user profile")

@router.post("/activity/log", response_model=ActivityResponse)
async def log_activity_endpoint(
    activity: ActivityLog,
    user_context: dict = Depends(get_user_context)
):
    """Log user activity"""
    return await log_user_activity_internal(
        user_context['firebase_uid'], 
        user_context['student_id'], 
        activity
    )

@router.get("/activity/history")
async def get_activity_history(
    limit: int = 20,
    user_context: dict = Depends(get_user_context)
):
    """Get user activity history"""
    try:
        activities = await get_user_activities(user_context['firebase_uid'], limit)
        
        return {
            "activities": activities,
            "count": len(activities)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get activity history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get activity history")

@router.get("/stats", response_model=UserStats)
async def get_user_statistics(user_context: dict = Depends(get_user_context)):
    """Get comprehensive user statistics"""
    return await calculate_user_stats(user_context['firebase_uid'])

@router.get("/dashboard", response_model=DashboardResponse)
async def get_user_dashboard(user_context: dict = Depends(get_user_context)):
    """Get user dashboard with stats and recent activities"""
    try:
        firebase_uid = user_context['firebase_uid']
        
        # Get user profile and stats
        profile = await get_user_profile(firebase_uid)
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        stats = await calculate_user_stats(firebase_uid)
        recent_activities = await get_user_activities(firebase_uid, 5)
        
        # Generate personalized recommendations
        recommendations = []
        if stats.current_streak == 0:
            recommendations.append({"type": "streak", "message": "Start your learning streak today!"})
        elif stats.current_streak < 7:
            recommendations.append({"type": "streak", "message": f"Keep going! {7 - stats.current_streak} more days to earn the Week Warrior badge!"})
        
        if profile.grade_level:
            recommendations.append({
                "type": "content", 
                "message": f"Try grade {profile.grade_level} math problems to match your level!"
            })
        
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

@router.delete("/profile")
async def delete_user_profile(user_context: dict = Depends(get_user_context)):
    """Delete user profile and all associated data (GDPR compliance)"""
    try:
        cosmos_db = get_cosmos_db_service()
        firebase_uid = user_context['firebase_uid']
        student_id = user_context['student_id']
        
        # FIXED: Delete user activities with correct PartitionKey import
        activities_container = cosmos_db.database.create_container_if_not_exists(
            id="user_activities",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        # Query and delete all activities for this user
        activities_query = """
        SELECT c.id FROM c 
        WHERE c.firebase_uid = @firebase_uid 
        AND c.type = 'user_activity'
        """
        activities_params = [{"name": "@firebase_uid", "value": firebase_uid}]
        
        for activity in activities_container.query_items(
            query=activities_query,
            parameters=activities_params,
            partition_key=firebase_uid
        ):
            activities_container.delete_item(item=activity['id'], partition_key=firebase_uid)
        
        # FIXED: Delete user profile with correct PartitionKey import
        user_profiles_container = cosmos_db.database.create_container_if_not_exists(
            id="user_profiles",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        profile_query = """
        SELECT c.id FROM c 
        WHERE c.firebase_uid = @firebase_uid 
        AND c.type = 'user_profile'
        """
        profile_params = [{"name": "@firebase_uid", "value": firebase_uid}]
        
        for profile in user_profiles_container.query_items(
            query=profile_query,
            parameters=profile_params,
            partition_key=firebase_uid
        ):
            user_profiles_container.delete_item(item=profile['id'], partition_key=firebase_uid)
        
        logger.info(f"🗑️ User profile and data deleted: {user_context['email']}")
        
        return {"message": "Profile and all associated data deleted successfully"}
        
    except Exception as e:
        logger.error(f"❌ Failed to delete user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete user profile")

@router.get("/health")
async def profiles_health_check():
    """Health check for user profiles service"""
    try:
        # Test Cosmos DB connection
        cosmos_db = get_cosmos_db_service()
        
        # FIXED: Test with correct PartitionKey import
        user_profiles_container = cosmos_db.database.create_container_if_not_exists(
            id="user_profiles",
            partition_key=PartitionKey(path="/firebase_uid")  # FIXED: Use imported PartitionKey
        )
        
        # Simple query to test connection
        test_query = "SELECT TOP 1 c.id FROM c WHERE c.type = 'user_profile'"
        list(user_profiles_container.query_items(
            query=test_query,
            enable_cross_partition_query=True
        ))
        
        return {
            "status": "healthy",
            "service": "user_profiles",
            "cosmos_db_connected": True,
            "containers": ["user_profiles", "user_activities"],
            "auth_method": "firebase_with_cosmos_storage",
            "grade_level_support": "string"  # Added to indicate string support
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "user_profiles",
            "error": str(e),
            "cosmos_db_connected": False,
            "auth_method": "firebase_with_cosmos_storage"
        }

# Development/Testing Endpoints
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
                points_earned=0,  # Will be calculated
                duration_seconds=300,
                difficulty_level="easy",
                accuracy_percentage=85.0
            ),
            ActivityLog(
                activity_type="problem", 
                activity_id="algebra_1", 
                activity_name="Solve for X",
                points_earned=0,
                duration_seconds=120,
                difficulty_level="medium",
                accuracy_percentage=92.0
            ),
            ActivityLog(
                activity_type="quiz", 
                activity_id="geometry_basics", 
                activity_name="Basic Geometry Quiz",
                points_earned=0,
                duration_seconds=600,
                difficulty_level="hard",
                accuracy_percentage=100.0
            ),
            ActivityLog(
                activity_type="login", 
                points_earned=0
            )
        ]
        
        responses = []
        for activity in sample_activities:
            response = await log_user_activity_internal(firebase_uid, student_id, activity)
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