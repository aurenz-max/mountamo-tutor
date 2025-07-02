# backend/app/services/daily_activities.py

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import random

# Import your existing services
from ..services.bigquery_analytics import BigQueryAnalyticsService
from ..services.learning_paths import LearningPathsService
from ..db.cosmos_db import CosmosDBService
from ..core.config import settings

logger = logging.getLogger(__name__)

# Pydantic models for daily activities
class DailyActivity(BaseModel):
    id: str
    type: str  # 'practice', 'tutoring', 'pathway', 'visual', 'review'
    title: str
    description: str
    category: str
    estimated_time: str
    points: int
    priority: str  # 'high', 'medium', 'low'
    time_slot: str  # 'morning', 'midday', 'afternoon', 'evening'
    action: str
    endpoint: str
    icon_type: str
    is_completed: bool = False
    metadata: Dict[str, Any] = {}

class DailyProgress(BaseModel):
    completed_activities: int
    total_activities: int
    points_earned_today: int
    daily_goal: int
    current_streak: int
    progress_percentage: float

class DailyGoals(BaseModel):
    daily_points_target: int
    activities_target: int
    streak_goal: int
    focus_areas: List[str]

class DailyPlan(BaseModel):
    student_id: int
    date: str
    activities: List[DailyActivity]
    progress: DailyProgress
    goals: DailyGoals
    personalization_factors: Dict[str, Any]

class DailyActivitiesService:
    """Service to orchestrate daily learning activities across all learning modes"""
    
    def __init__(
        self,
        analytics_service: Optional[BigQueryAnalyticsService] = None,
        learning_paths_service: Optional[LearningPathsService] = None,
        cosmos_db_service: Optional[CosmosDBService] = None
    ):
        self.analytics_service = analytics_service
        self.learning_paths_service = learning_paths_service
        self.cosmos_db = cosmos_db_service or CosmosDBService()
        
    async def generate_daily_plan(self, student_id: int, date: Optional[str] = None) -> DailyPlan:
        """Generate a comprehensive daily learning plan for a student"""
        
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        logger.info(f"Generating daily plan for student {student_id} on {date}")
        
        try:
            # Gather data from all services in parallel
            tasks = [
                self._get_student_analytics_data(student_id),
                self._get_learning_path_data(student_id),
                self._get_content_packages_data(student_id),
                self._get_daily_progress(student_id, date),
                self._get_student_preferences(student_id)
            ]
            
            analytics_data, learning_paths_data, content_data, progress, preferences = await asyncio.gather(
                *tasks, return_exceptions=True
            )
            
            # Handle exceptions gracefully
            analytics_data = analytics_data if not isinstance(analytics_data, Exception) else {}
            learning_paths_data = learning_paths_data if not isinstance(learning_paths_data, Exception) else {}
            content_data = content_data if not isinstance(content_data, Exception) else []
            progress = progress if not isinstance(progress, Exception) else self._create_default_progress()
            preferences = preferences if not isinstance(preferences, Exception) else {}
            
            # Calculate personalization factors
            personalization_factors = self._calculate_personalization_factors(
                analytics_data, learning_paths_data, preferences
            )
            
            # Generate activities based on gathered data
            activities = await self._generate_activities(
                student_id, analytics_data, learning_paths_data, 
                content_data, personalization_factors
            )
            
            # Calculate daily goals
            goals = self._calculate_daily_goals(analytics_data, preferences)
            
            return DailyPlan(
                student_id=student_id,
                date=date,
                activities=activities,
                progress=progress,
                goals=goals,
                personalization_factors=personalization_factors
            )
            
        except Exception as e:
            logger.error(f"Error generating daily plan for student {student_id}: {str(e)}")
            # Return fallback plan
            return await self._create_fallback_plan(student_id, date)
    
    async def _get_student_analytics_data(self, student_id: int) -> Dict[str, Any]:
        """Get student analytics data"""
        try:
            if not self.analytics_service:
                return {}
                
            # Get metrics and recommendations
            metrics_task = self.analytics_service.get_hierarchical_metrics(student_id)
            recommendations_task = self.analytics_service.get_recommendations(student_id, limit=10)
            
            metrics, recommendations = await asyncio.gather(
                metrics_task, recommendations_task, return_exceptions=True
            )
            
            return {
                "metrics": metrics if not isinstance(metrics, Exception) else {},
                "recommendations": recommendations if not isinstance(recommendations, Exception) else []
            }
        except Exception as e:
            logger.warning(f"Could not get analytics data for student {student_id}: {str(e)}")
            return {}
    
    async def _get_learning_path_data(self, student_id: int) -> Dict[str, Any]:
        """Get learning path recommendations"""
        try:
            if not self.learning_paths_service:
                return {}
                
            recommendations = await self.learning_paths_service.get_next_recommendations(student_id)
            return {"recommendations": recommendations}
        except Exception as e:
            logger.warning(f"Could not get learning path data for student {student_id}: {str(e)}")
            return {}
    
    async def _get_content_packages_data(self, student_id: int) -> List[Dict[str, Any]]:
        """Get available content packages"""
        try:
            # Get content packages from Cosmos DB
            packages = await self.cosmos_db.get_content_packages(
                status="approved", 
                limit=20
            )
            return packages or []
        except Exception as e:
            logger.warning(f"Could not get content packages for student {student_id}: {str(e)}")
            return []
    
    async def _get_daily_progress(self, student_id: int, date: str) -> DailyProgress:
        """Get student's progress for the current day"""
        try:
            # This would typically query your activity logs for today
            # For now, return mock data that matches your existing profile structure
            return DailyProgress(
                completed_activities=0,
                total_activities=5,
                points_earned_today=0,
                daily_goal=85,
                current_streak=5,
                progress_percentage=0.0
            )
        except Exception as e:
            logger.warning(f"Could not get daily progress for student {student_id}: {str(e)}")
            return self._create_default_progress()
    
    async def _get_student_preferences(self, student_id: int) -> Dict[str, Any]:
        """Get student learning preferences"""
        try:
            # This could come from user profiles or be learned from behavior
            return {
                "preferred_difficulty": "medium",
                "learning_style": "visual",
                "optimal_session_length": 15,
                "peak_learning_times": ["morning", "afternoon"]
            }
        except Exception as e:
            logger.warning(f"Could not get preferences for student {student_id}: {str(e)}")
            return {}
    
    def _calculate_personalization_factors(
        self, 
        analytics_data: Dict, 
        learning_paths_data: Dict, 
        preferences: Dict
    ) -> Dict[str, Any]:
        """Calculate factors that influence activity selection using BigQuery analytics"""
        
        factors = {
            "skill_gaps": [],
            "strength_areas": [],
            "recommended_difficulty": "medium",
            "learning_style": preferences.get("learning_style", "mixed"),
            "engagement_level": "medium",
            "focus_areas": [],
            "ready_skills": [],
            "priority_subskills": []
        }
        
        # Extract skill gaps from BigQuery recommendations
        recommendations = analytics_data.get("recommendations", [])
        if recommendations:
            # High priority recommendations indicate skill gaps
            high_priority = [r for r in recommendations if r.get("priority") == "high"]
            factors["skill_gaps"] = [r.get("subskill_description", "") for r in high_priority[:3]]
            factors["focus_areas"] = [r.get("unit_title", "") for r in high_priority[:2]]
            factors["priority_subskills"] = [r.get("subskill_id", "") for r in high_priority[:5]]
            
            # Medium priority items are good for building confidence
            medium_priority = [r for r in recommendations if r.get("priority") == "medium"]
            if medium_priority:
                factors["ready_skills"] = [r.get("skill_id", "") for r in medium_priority[:3]]
        
        # Extract strengths from BigQuery hierarchical metrics
        metrics = analytics_data.get("metrics", {})
        hierarchical_data = metrics.get("hierarchical_data", [])
        if hierarchical_data:
            # Units with high proficiency are strengths
            strong_units = [
                unit for unit in hierarchical_data 
                if unit.get("proficiency", 0) > 0.8 and unit.get("attempt_count", 0) > 5
            ]
            factors["strength_areas"] = [unit.get("unit_title", "") for unit in strong_units[:2]]
            
            # Calculate recommended difficulty based on overall performance
            overall_proficiency = metrics.get("summary", {}).get("proficiency", 0.5)
            if overall_proficiency > 0.8:
                factors["recommended_difficulty"] = "hard"
            elif overall_proficiency < 0.4:
                factors["recommended_difficulty"] = "easy"
            else:
                factors["recommended_difficulty"] = "medium"
        
        return factors
    
    async def _generate_activities(
        self,
        student_id: int,
        analytics_data: Dict,
        learning_paths_data: Dict,
        content_data: List,
        personalization_factors: Dict
    ) -> List[DailyActivity]:
        """Generate the daily activity list"""
        
        activities = []
        
        # 1. Morning Warm-up (Practice Problems)
        activities.append(self._create_practice_activity(analytics_data, personalization_factors))
        
        # 2. AI Tutor Session (Content Package)
        if content_data:
            package_activity = self._create_tutoring_activity(content_data, personalization_factors)
            if package_activity:
                activities.append(package_activity)
        
        # 3. Learning Path Progression
        learning_path_activity = self._create_learning_path_activity(
            learning_paths_data, personalization_factors
        )
        if learning_path_activity:
            activities.append(learning_path_activity)
        
        # 4. Visual/Interactive Content
        activities.append(self._create_visual_activity(personalization_factors))
        
        # 5. Review Session
        activities.append(self._create_review_activity(analytics_data, personalization_factors))
        
        return activities
    
    def _create_practice_activity(self, analytics_data: Dict, factors: Dict) -> DailyActivity:
        """Create practice problems activity using BigQuery analytics insights"""
        
        # Use priority subskills from analytics for targeted practice
        priority_subskills = factors.get("priority_subskills", [])
        skill_gaps = factors.get("skill_gaps", [])
        
        if priority_subskills:
            focus_area = skill_gaps[0] if skill_gaps else "high-priority concepts"
            subskill_focus = priority_subskills[0]
        else:
            focus_area = "basic math concepts"
            subskill_focus = None
        
        # Determine difficulty based on analytics
        recommended_difficulty = factors.get("recommended_difficulty", "medium")
        
        # Calculate points based on difficulty and student level
        base_points = 15
        if recommended_difficulty == "hard":
            base_points = 20
        elif recommended_difficulty == "easy":
            base_points = 12
        
        return DailyActivity(
            id="morning-warm-up",
            type="practice",
            title="Morning Math Warm-up",
            description=f"Start with 5 targeted problems focusing on {focus_area}",
            category="Practice Problems",
            estimated_time="5 min",
            points=base_points,
            priority="high",
            time_slot="morning",
            action="Start Practice",
            endpoint="/practice",
            icon_type="zap",
            metadata={
                "focus_area": focus_area,
                "target_subskill": subskill_focus,
                "problem_count": 5,
                "difficulty": recommended_difficulty,
                "analytics_driven": True,
                "priority_subskills": priority_subskills[:3]  # Top 3 for routing
            }
        )
    
    def _create_tutoring_activity(self, content_data: List, factors: Dict) -> Optional[DailyActivity]:
        """Create AI tutoring session activity"""
        
        if not content_data:
            return None
        
        # Select best package based on focus areas
        focus_areas = factors.get("focus_areas", [])
        selected_package = self._select_optimal_package(content_data, focus_areas)
        
        if not selected_package:
            selected_package = content_data[0]  # Fallback to first package
        
        package_title = selected_package.get("content", {}).get("reading", {}).get("title", "Interactive Lesson")
        package_id = selected_package.get("id", "unknown")
        
        return DailyActivity(
            id="package-lesson",
            type="tutoring",
            title=f"Interactive {package_title}",
            description="Learn with voice interaction and personalized guidance",
            category="AI Tutor Session",
            estimated_time="15 min",
            points=25,
            priority="high",
            time_slot="morning",
            action="Start Lesson",
            endpoint=f"/education/{package_id}/learn",
            icon_type="headphones",
            metadata={
                "package_id": package_id,
                "package_title": package_title,
                "subject": selected_package.get("subject", "mathematics")
            }
        )
    
    def _create_learning_path_activity(self, learning_paths_data: Dict, factors: Dict) -> Optional[DailyActivity]:
        """Create learning path progression activity"""
        
        recommendations = learning_paths_data.get("recommendations", [])
        focus_areas = factors.get("focus_areas", ["your learning path"])
        focus_text = focus_areas[0] if focus_areas else "your personalized curriculum"
        
        return DailyActivity(
            id="learning-path",
            type="pathway",
            title="Follow Your Learning Path",
            description=f"Continue your personalized journey through {focus_text}",
            category="Learning Path",
            estimated_time="10 min",
            points=20,
            priority="medium",
            time_slot="midday",
            action="Continue Path",
            endpoint="/learning-paths",
            icon_type="target",
            metadata={
                "recommendations": recommendations[:3],  # Top 3 recommendations
                "focus_area": focus_text
            }
        )
    
    def _create_visual_activity(self, factors: Dict) -> DailyActivity:
        """Create visual/interactive learning activity"""
        
        learning_style = factors.get("learning_style", "mixed")
        activity_type = "visual exploration" if learning_style == "visual" else "interactive content"
        
        return DailyActivity(
            id="visual-exploration",
            type="visual",
            title="Interactive Learning Explorer",
            description=f"Discover concepts through {activity_type} and hands-on activities",
            category="Visual Learning",
            estimated_time="8 min",
            points=15,
            priority="medium",
            time_slot="afternoon",
            action="Explore",
            endpoint="/library",
            icon_type="eye",
            metadata={
                "filter": "visual",
                "learning_style": learning_style,
                "content_type": "interactive"
            }
        )
    
    def _create_review_activity(self, analytics_data: Dict, factors: Dict) -> DailyActivity:
        """Create spaced repetition review activity"""
        
        strength_areas = factors.get("strength_areas", [])
        review_focus = strength_areas[0] if strength_areas else "previous concepts"
        
        return DailyActivity(
            id="review-session",
            type="review",
            title="Smart Review Session",
            description=f"Reinforce {review_focus} with spaced repetition",
            category="Adaptive Review",
            estimated_time="7 min",
            points=12,
            priority="low",
            time_slot="evening",
            action="Review",
            endpoint="/practice",
            icon_type="brain",
            metadata={
                "mode": "review",
                "review_focus": review_focus,
                "algorithm": "spaced_repetition"
            }
        )
    
    def _select_optimal_package(self, packages: List, focus_areas: List[str]) -> Optional[Dict]:
        """Select the best content package based on focus areas"""
        
        if not packages:
            return None
        
        # Simple scoring based on title/subject matching focus areas
        scored_packages = []
        for package in packages:
            score = 0
            title = package.get("content", {}).get("reading", {}).get("title", "").lower()
            subject = package.get("subject", "").lower()
            skill = package.get("skill", "").lower()
            
            for focus_area in focus_areas:
                focus_lower = focus_area.lower()
                if focus_lower in title:
                    score += 3
                elif focus_lower in subject:
                    score += 2
                elif focus_lower in skill:
                    score += 1
            
            scored_packages.append((score, package))
        
        # Sort by score and return highest scoring package
        scored_packages.sort(key=lambda x: x[0], reverse=True)
        return scored_packages[0][1] if scored_packages else packages[0]
    
    def _calculate_daily_goals(self, analytics_data: Dict, preferences: Dict) -> DailyGoals:
        """Calculate personalized daily goals"""
        
        # Base goals that can be customized based on student performance
        base_points = 85
        base_activities = 5
        
        # Adjust based on recent performance if available
        metrics = analytics_data.get("metrics", {})
        summary = metrics.get("summary", {})
        
        # If student is performing well, slightly increase targets
        proficiency = summary.get("proficiency", 0.5)
        if proficiency > 0.8:
            base_points = int(base_points * 1.2)
        elif proficiency < 0.4:
            base_points = int(base_points * 0.8)
        
        focus_areas = []
        recommendations = analytics_data.get("recommendations", [])
        if recommendations:
            focus_areas = [r.get("unit_title", "") for r in recommendations[:2]]
        
        return DailyGoals(
            daily_points_target=base_points,
            activities_target=base_activities,
            streak_goal=7,  # Weekly streak goal
            focus_areas=focus_areas
        )
    
    def _create_default_progress(self) -> DailyProgress:
        """Create default progress when data is unavailable"""
        return DailyProgress(
            completed_activities=0,
            total_activities=5,
            points_earned_today=0,
            daily_goal=85,
            current_streak=0,
            progress_percentage=0.0
        )
    
    async def _create_fallback_plan(self, student_id: int, date: str) -> DailyPlan:
        """Create a basic fallback plan when services are unavailable"""
        
        logger.warning(f"Creating fallback plan for student {student_id}")
        
        # Basic activities that don't require external services
        fallback_activities = [
            DailyActivity(
                id="basic-practice",
                type="practice",
                title="Math Practice Session",
                description="Work on fundamental math skills",
                category="Practice Problems",
                estimated_time="10 min",
                points=20,
                priority="high",
                time_slot="morning",
                action="Start Practice",
                endpoint="/practice",
                icon_type="zap"
            ),
            DailyActivity(
                id="self-study",
                type="visual",
                title="Explore Learning Library",
                description="Browse interactive educational content",
                category="Self-Study",
                estimated_time="15 min",
                points=15,
                priority="medium",
                time_slot="afternoon",
                action="Browse",
                endpoint="/library",
                icon_type="book"
            )
        ]
        
        return DailyPlan(
            student_id=student_id,
            date=date,
            activities=fallback_activities,
            progress=self._create_default_progress(),
            goals=DailyGoals(
                daily_points_target=85,
                activities_target=2,
                streak_goal=7,
                focus_areas=["Basic Skills"]
            ),
            personalization_factors={"mode": "fallback"}
        )
    
    async def mark_activity_completed(
        self, 
        student_id: int, 
        activity_id: str, 
        completion_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Mark an activity as completed and log the event"""
        
        try:
            # Here you would typically:
            # 1. Update activity completion status in database
            # 2. Award points to student
            # 3. Log activity completion event
            # 4. Update daily progress
            # 5. Check for achievements/streaks
            
            logger.info(f"Activity {activity_id} completed by student {student_id}")
            
            return {
                "success": True,
                "activity_id": activity_id,
                "points_awarded": completion_data.get("points", 0) if completion_data else 0,
                "new_total_points": 0,  # Would calculate from user profile
                "achievements": []  # Would check for new achievements
            }
            
        except Exception as e:
            logger.error(f"Error marking activity completed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def refresh_daily_plan(self, student_id: int, date: Optional[str] = None) -> DailyPlan:
        """Refresh/regenerate the daily plan (useful after activity completion)"""
        return await self.generate_daily_plan(student_id, date)
    
    async def get_activity_suggestions(self, student_id: int, context: str = "general") -> List[DailyActivity]:
        """Get additional activity suggestions based on context"""
        
        # This could provide bonus activities or alternative suggestions
        # based on student engagement or completion patterns
        
        suggestions = []
        
        if context == "bonus":
            suggestions.append(DailyActivity(
                id="bonus-challenge",
                type="practice",
                title="Bonus Challenge",
                description="Extra credit problems for high achievers",
                category="Challenge Mode",
                estimated_time="10 min",
                points=30,
                priority="low",
                time_slot="evening",
                action="Take Challenge",
                endpoint="/practice",
                icon_type="star",
                metadata={"difficulty": "hard", "bonus": True}
            ))
        
        return suggestions
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for the daily activities service"""
        
        health_status = {
            "status": "healthy",
            "service": "daily_activities",
            "dependencies": {
                "analytics_service": "unknown",
                "learning_paths_service": "unknown", 
                "cosmos_db": "unknown"
            },
            "features": {
                "activity_generation": True,
                "personalization": True,
                "multi_service_integration": True,
                "fallback_mode": True
            }
        }
        
        # Test dependencies
        try:
            if self.analytics_service:
                # Quick test of analytics service
                await self.analytics_service.health_check()
                health_status["dependencies"]["analytics_service"] = "healthy"
        except Exception:
            health_status["dependencies"]["analytics_service"] = "unhealthy"
        
        try:
            if self.learning_paths_service:
                await self.learning_paths_service.health_check()
                health_status["dependencies"]["learning_paths_service"] = "healthy"
        except Exception:
            health_status["dependencies"]["learning_paths_service"] = "unhealthy"
        
        try:
            # Test Cosmos DB connection
            await self.cosmos_db.get_content_packages(limit=1)
            health_status["dependencies"]["cosmos_db"] = "healthy"
        except Exception:
            health_status["dependencies"]["cosmos_db"] = "unhealthy"
        
        # Determine overall health
        unhealthy_deps = [k for k, v in health_status["dependencies"].items() if v == "unhealthy"]
        if len(unhealthy_deps) >= 2:
            health_status["status"] = "degraded"
        elif len(unhealthy_deps) >= 3:
            health_status["status"] = "unhealthy"
        
        return health_status