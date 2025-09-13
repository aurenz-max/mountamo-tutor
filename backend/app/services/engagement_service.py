# backend/app/services/engagement_service.py
"""
Engagement & Progression System Service
Implements the Student Engagement & Progression System as outlined in the PRD
Optimized for async operations and minimal blocking
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import logging
import asyncio

from ..models.user_profiles import ActivityLog, ActivityResponse

logger = logging.getLogger(__name__)


class EngagementService:
    """
    Service for managing student engagement through XP, levels, and streaks
    Implements the gamified progression system as per PRD
    """
    
    def __init__(self):
        # XP Configuration from PRD
        self.xp_config = {
            "problem_submitted_incorrect": 10,
            "problem_submitted_correct": 25,
            "problem_set_generated": 5,
            "composable_problem_generated": 15,
            "composable_problem_submitted": 30,
            "practice_tutor_session_minute": 1,
            "practice_tutor_session_max": 20,
            "daily_plan_activity_completed": 50,
            "daily_plan_completed_bonus": 150,
            "content_package_section_completed": 20,
            "content_package_completed_bonus": 200,
            "content_package_primitive_completed": 5,  # Base XP for interactive primitives
            "daily_streak_base": 10,
            "daily_streak_max_bonus": 50,
        }
        
        # Pre-calculate level thresholds for performance
        self._level_thresholds = self._precalculate_level_thresholds()
    
    async def process_activity(
        self,
        user_id: str,
        student_id: int,
        activity_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ActivityResponse:
        """
        Process activity and return complete engagement transaction data synchronously
        Updates profile in background for performance
        """
        try:
            metadata = metadata or {}
            
            # Get current profile for accurate calculations
            from ..services.user_profiles import user_profiles_service
            user_profile = await user_profiles_service.get_user_profile(user_id)
            
            if not user_profile:
                logger.error(f"User profile not found: {user_id}")
                return ActivityResponse(
                    activity_id=f"error_{datetime.utcnow().timestamp()}",
                    xp_earned=0,
                    points_earned=0,
                    total_xp=0,
                    level_up=False,
                    badges_earned=[]
                )
            
            # Calculate complete engagement transaction
            base_xp = self._calculate_base_xp(activity_type, metadata)
            is_first_today = self._is_first_activity_today(user_profile)
            streak_bonus = self._calculate_streak_bonus(user_profile.current_streak + 1) if is_first_today else 0
            total_xp_earned = base_xp + streak_bonus
            
            new_total_xp = user_profile.total_xp + total_xp_earned
            new_level = self._get_level_from_xp(new_total_xp)
            level_up = new_level > user_profile.current_level
            new_streak = self._calculate_new_streak(user_profile, is_first_today)
            
            # Fire-and-forget profile update to avoid blocking the response
            asyncio.create_task(
                self._update_user_profile_async(user_id, student_id, activity_type, base_xp, metadata, 
                                              new_total_xp, new_level, new_streak, total_xp_earned)
            )
            
            # Return complete engagement transaction data for frontend animations
            return ActivityResponse(
                activity_id=f"activity_{datetime.utcnow().timestamp()}",
                xp_earned=total_xp_earned,
                points_earned=total_xp_earned,  # Backward compatibility
                total_xp=new_total_xp,
                level_up=level_up,
                new_level=new_level,
                previous_level=user_profile.current_level,
                streak_bonus_xp=streak_bonus,
                base_xp=base_xp,
                current_streak=new_streak,
                previous_streak=user_profile.current_streak,
                badges_earned=[]
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to process engagement activity: {str(e)}")
            # Return minimal response on error
            return ActivityResponse(
                activity_id=f"error_{datetime.utcnow().timestamp()}",
                xp_earned=0,
                points_earned=0,
                total_xp=0,
                level_up=False,
                badges_earned=[]
            )
    
    async def _update_user_profile_async(
        self,
        user_id: str,
        student_id: int,
        activity_type: str,
        base_xp: int,
        metadata: Dict[str, Any],
        new_total_xp: int = None,
        new_level: int = None,
        new_streak: int = None,
        total_xp_earned: int = None
    ):
        """Background task to update user profile with pre-calculated values"""
        try:
            from ..services.user_profiles import user_profiles_service
            
            # Use pre-calculated values if provided (from synchronous calculation)
            if new_total_xp is not None and new_level is not None and new_streak is not None:
                # Use pre-calculated values for efficiency
                xp_for_next = self._calculate_xp_for_next_level(new_level, new_total_xp)
                streak_bonus = total_xp_earned - base_xp if total_xp_earned else 0
                
                # Get current profile for reference
                user_profile = await user_profiles_service.get_user_profile(user_id)
                if not user_profile:
                    logger.error(f"User profile not found: {user_id}")
                    return
            else:
                # Fallback: calculate values if not provided
                user_profile = await user_profiles_service.get_user_profile(user_id)
                if not user_profile:
                    logger.error(f"User profile not found: {user_id}")
                    return
                
                is_first_today = self._is_first_activity_today(user_profile)
                streak_bonus = self._calculate_streak_bonus(user_profile.current_streak + 1) if is_first_today else 0
                total_xp_earned = base_xp + streak_bonus
                
                new_total_xp = user_profile.total_xp + total_xp_earned
                new_level = self._get_level_from_xp(new_total_xp)
                xp_for_next = self._calculate_xp_for_next_level(new_level, new_total_xp)
                new_streak = self._calculate_new_streak(user_profile, is_first_today)
            
            # Create activity log
            activity_log = ActivityLog(
                activity_type=activity_type,
                activity_name=metadata.get('activity_name', activity_type.replace('_', ' ').title()),
                xp_earned=total_xp_earned,
                points_earned=total_xp_earned,
                metadata={
                    **metadata,
                    'base_xp': base_xp,
                    'streak_bonus_xp': streak_bonus,
                    'level_before': user_profile.current_level,
                    'level_after': new_level
                }
            )
            
            # Update profile (single batch update)
            profile_updates = {
                'total_xp': new_total_xp,
                'current_level': new_level,
                'xp_for_next_level': xp_for_next,
                'current_streak': new_streak,
                'longest_streak': max(user_profile.longest_streak, new_streak),
                'last_activity_date': datetime.utcnow(),
                'last_activity': datetime.utcnow()
            }
            
            # Execute both operations concurrently
            await asyncio.gather(
                user_profiles_service.add_activity_log_entry(user_id, student_id, activity_log),
                user_profiles_service.update_user_profile(user_id, profile_updates)
            )
            
            logger.info(
                f"📈 Profile updated: {user_id} - {activity_type} "
                f"(+{total_xp_earned} XP, Level {new_level}, Streak {new_streak})"
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to update user profile async: {str(e)}")
    
    def _calculate_base_xp(self, activity_type: str, metadata: Dict[str, Any]) -> int:
        """Fast, non-blocking XP calculation"""
        if activity_type == "problem_submitted":
            is_correct = metadata.get('is_correct', False)
            return self.xp_config["problem_submitted_correct"] if is_correct else self.xp_config["problem_submitted_incorrect"]
        
        if activity_type == "problem_set_generated":
            return self.xp_config["problem_set_generated"]
        
        if activity_type == "composable_problem_generated":
            return self.xp_config["composable_problem_generated"]
        
        if activity_type == "composable_problem_submitted":
            return self.xp_config["composable_problem_submitted"]
        
        if activity_type == "practice_tutor_session":
            minutes = metadata.get('duration_minutes', 0)
            return min(minutes * self.xp_config["practice_tutor_session_minute"], 
                      self.xp_config["practice_tutor_session_max"])
        
        if activity_type == "daily_plan_activity_completed":
            return self.xp_config["daily_plan_activity_completed"]
        
        if activity_type == "daily_plan_completed":
            return self.xp_config["daily_plan_completed_bonus"]
        
        if activity_type == "content_package_section_completed":
            return self.xp_config["content_package_section_completed"]
        
        if activity_type == "content_package_completed":
            return self.xp_config["content_package_completed_bonus"]
        
        if activity_type == "content_package_primitive_completed":
            # Base XP for completing an interactive primitive
            base_xp = self.xp_config["content_package_primitive_completed"]
            # Bonus XP for high performance (80% or higher score)
            score = metadata.get('score', 0)
            if score and score >= 0.8:
                base_xp *= 2  # Double XP for excellent performance
            return base_xp
        
        return 5  # Default minimum XP
    
    def _precalculate_level_thresholds(self, max_level: int = 100) -> Dict[int, int]:
        """Pre-calculate XP thresholds for levels to avoid repeated calculations"""
        thresholds = {}
        total_xp = 0
        
        for level in range(1, max_level + 1):
            thresholds[level] = total_xp
            total_xp += int(100 * (level ** 1.5))
        
        return thresholds
    
    def _get_level_from_xp(self, total_xp: int) -> int:
        """Fast level lookup using pre-calculated thresholds"""
        level = 1
        for lvl, threshold in self._level_thresholds.items():
            if total_xp >= threshold:
                level = lvl
            else:
                break
        return level
    
    def _calculate_xp_for_next_level(self, current_level: int, total_xp: int) -> int:
        """Calculate XP needed for next level using pre-calculated thresholds"""
        if current_level in self._level_thresholds:
            current_threshold = self._level_thresholds[current_level]
            next_level_total_needed = int(100 * (current_level ** 1.5)) + current_threshold
            return next_level_total_needed - total_xp
        return 100  # Fallback
    
    def _calculate_streak_bonus(self, streak_day: int) -> int:
        """Fast streak bonus calculation"""
        if streak_day <= 1:
            return 0
        bonus = (streak_day - 1) * self.xp_config["daily_streak_base"]
        return min(bonus, self.xp_config["daily_streak_max_bonus"])
    
    def _is_first_activity_today(self, user_profile) -> bool:
        """Quick check for first activity today"""
        today = datetime.utcnow().date()
        
        last_date = None
        if hasattr(user_profile, 'last_activity_date') and user_profile.last_activity_date:
            last_date = user_profile.last_activity_date.date()
        elif hasattr(user_profile, 'last_activity') and user_profile.last_activity:
            last_date = user_profile.last_activity.date()
        
        return last_date != today
    
    def _calculate_new_streak(self, user_profile, is_first_activity_today: bool) -> int:
        """Fast streak calculation"""
        if not is_first_activity_today:
            return user_profile.current_streak
        
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        last_date = None
        if hasattr(user_profile, 'last_activity_date') and user_profile.last_activity_date:
            last_date = user_profile.last_activity_date.date()
        elif hasattr(user_profile, 'last_activity') and user_profile.last_activity:
            last_date = user_profile.last_activity.date()
        
        if last_date == yesterday:
            return user_profile.current_streak + 1
        else:
            return 1


# ============================================================================
# SERVICE INSTANCE
# ============================================================================

engagement_service = EngagementService()