# backend/app/services/daily_activities.py
# Clean, structured approach with BigQuery integration

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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
    metadata: Dict[str, Any] = {}

class DailyProgress(BaseModel):
    completed_activities: int
    total_activities: int
    points_earned_today: int
    daily_goal: int
    current_streak: int
    progress_percentage: float

class DailyPlan(BaseModel):
    student_id: int
    date: str
    activities: List[DailyActivity]
    progress: DailyProgress
    personalization_source: str  # 'bigquery_recommendations' or 'fallback'
    total_points: int

class DailyActivitiesService:
    """Clean service that gets BigQuery recommendations and creates activities"""
    
    def __init__(self, analytics_service=None):
        self.analytics_service = analytics_service
    
    async def generate_daily_plan(self, student_id: int, date: Optional[str] = None) -> DailyPlan:
        """Main method: Get recommendations → Create activities → Return plan"""
        
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        logger.info(f"Generating daily plan for student {student_id}")
        
        # Step 1: Try to get BigQuery recommendations
        recommendations = await self._get_recommendations(student_id)
        
        # Step 2: Create activities from recommendations (or fallback)
        if recommendations:
            activities = self._create_activities_from_recommendations(recommendations)
            personalization_source = 'bigquery_recommendations'
            logger.info(f"Created {len(activities)} activities from BigQuery recommendations")
        else:
            activities = self._create_fallback_activities()
            personalization_source = 'fallback'
            logger.info(f"Created {len(activities)} fallback activities")
        
        # Step 3: Calculate totals and progress
        total_points = sum(a.points for a in activities)
        progress = DailyProgress(
            completed_activities=0,
            total_activities=len(activities),
            points_earned_today=0,
            daily_goal=60,
            current_streak=1,  # Would get from user profile
            progress_percentage=0.0
        )
        
        return DailyPlan(
            student_id=student_id,
            date=date,
            activities=activities,
            progress=progress,
            personalization_source=personalization_source,
            total_points=total_points
        )
    
    async def _get_recommendations(self, student_id: int) -> Optional[List[Dict]]:
        """Get recommendations from BigQuery analytics service"""
        
        if not self.analytics_service:
            logger.warning("No analytics service configured")
            return None
        
        try:
            # Get recommendations from your BigQuery service
            recommendations = await self.analytics_service.get_recommendations(
                student_id=student_id,
                limit=5  # Get 5 recommendations to work with
            )
            
            if recommendations and len(recommendations) > 0:
                logger.info(f"Got {len(recommendations)} recommendations from BigQuery")
                return recommendations
            else:
                logger.info("No recommendations returned from BigQuery")
                return None
                
        except Exception as e:
            logger.error(f"Failed to get recommendations: {str(e)}")
            return None
    
    def _create_activities_from_recommendations(self, recommendations: List[Dict]) -> List[DailyActivity]:
        """Convert BigQuery recommendations into daily activities"""
        
        activities = []
        
        for i, rec in enumerate(recommendations):
            # Extract data from recommendation
            subskill_desc = rec.get('subskill_description', 'Practice Session')
            subject = rec.get('subject', 'Mathematics')
            priority = rec.get('priority', 'medium')
            mastery = rec.get('mastery', 0.0)
            skill_id = rec.get('skill_id', '')
            subskill_id = rec.get('subskill_id', f'skill_{i}')
            
            # Determine activity type based on recommendation data
            activity_type = self._determine_activity_type(rec)
            
            # Get configuration for this activity type
            config = self._get_activity_config(activity_type, subskill_desc)
            
            # Calculate points
            points = self._calculate_points(priority, mastery)
            
            # Assign time slot
            time_slot = ['morning', 'midday', 'afternoon', 'evening'][i % 4]
            
            activity = DailyActivity(
                id=f"rec-{subskill_id}",
                type=activity_type,
                title=config['title'],
                description=config['description'],
                category=config['category'],
                estimated_time=config['time'],
                points=points,
                priority=priority,
                time_slot=time_slot,
                action=config['action'],
                endpoint=config['endpoint'],
                icon_type=config['icon'],
                metadata={
                    'from_recommendations': True,
                    'recommendation_id': subskill_id,
                    'subject': subject,
                    'skill_id': skill_id,
                    'mastery_level': mastery,
                    'priority_level': rec.get('priority_level'),
                    'readiness_status': rec.get('readiness_status', 'Ready')
                }
            )
            
            activities.append(activity)
        
        return activities
    
    def _create_fallback_activities(self) -> List[DailyActivity]:
        """Create basic activities when no recommendations available"""
        
        return [
            DailyActivity(
                id="fallback-math-practice",
                type="practice",
                title="Math Practice Session",
                description="Essential math skill building",
                category="Practice Problems",
                estimated_time="10 min",
                points=15,
                priority="high",
                time_slot="morning",
                action="Start Practice",
                endpoint="/practice",
                icon_type="zap",
                metadata={'fallback': True, 'subject': 'mathematics'}
            ),
            DailyActivity(
                id="fallback-tutoring",
                type="tutoring",
                title="AI Tutor Session",
                description="Interactive learning with AI tutor",
                category="AI Tutoring",
                estimated_time="12 min",
                points=18,
                priority="medium",
                time_slot="midday",
                action="Start Session",
                endpoint="/tutoring",
                icon_type="headphones",
                metadata={'fallback': True}
            ),
            DailyActivity(
                id="fallback-pathway",
                type="pathway",
                title="Learning Path",
                description="Explore structured learning content",
                category="Learning Journey",
                estimated_time="10 min",
                points=15,
                priority="medium",
                time_slot="afternoon",
                action="Continue Path",
                endpoint="/learning-paths",
                icon_type="target",
                metadata={'fallback': True}
            ),
            DailyActivity(
                id="fallback-review",
                type="review",
                title="Quick Review",
                description="Reinforce recent learning",
                category="Review Session",
                estimated_time="8 min",
                points=12,
                priority="low",
                time_slot="evening",
                action="Review",
                endpoint="/practice",
                icon_type="brain",
                metadata={'fallback': True}
            )
        ]
    
    def _determine_activity_type(self, recommendation: Dict) -> str:
        """Determine best activity type based on recommendation data"""
        
        mastery = recommendation.get('mastery', 0.0)
        priority = recommendation.get('priority', 'medium')
        readiness = recommendation.get('readiness_status', 'Ready')
        
        # Simple logic for activity type
        if mastery < 0.3:
            return 'tutoring'  # Low mastery = need teaching
        elif priority == 'high':
            return 'practice'  # High priority = practice needed
        elif mastery > 0.7:
            return 'review'    # High mastery = review/reinforce
        elif readiness == 'Not Ready':
            return 'pathway'   # Not ready = need learning path
        else:
            return 'practice'  # Default to practice
    
    def _get_activity_config(self, activity_type: str, subskill_desc: str) -> Dict[str, str]:
        """Get configuration for activity type"""
        
        configs = {
            "practice": {
                "title": f"Practice: {subskill_desc}",
                "description": f"Targeted practice problems for {subskill_desc.lower()}",
                "category": "Practice Problems",
                "time": "10 min",
                "action": "Start Practice",
                "endpoint": "/practice",
                "icon": "zap"
            },
            "tutoring": {
                "title": f"Learn: {subskill_desc}",
                "description": f"AI tutoring session on {subskill_desc.lower()}",
                "category": "AI Tutoring",
                "time": "12 min",
                "action": "Start Session",
                "endpoint": "/tutoring",
                "icon": "headphones"
            },
            "pathway": {
                "title": f"Explore: {subskill_desc}",
                "description": f"Learning path for {subskill_desc.lower()}",
                "category": "Learning Path",
                "time": "10 min",
                "action": "Continue Path",
                "endpoint": "/learning-paths",
                "icon": "target"
            },
            "visual": {
                "title": f"Discover: {subskill_desc}",
                "description": f"Visual exploration of {subskill_desc.lower()}",
                "category": "Visual Learning",
                "time": "8 min",
                "action": "Explore",
                "endpoint": "/library",
                "icon": "eye"
            },
            "review": {
                "title": f"Review: {subskill_desc}",
                "description": f"Reinforce {subskill_desc.lower()} concepts",
                "category": "Review Session",
                "time": "8 min",
                "action": "Review",
                "endpoint": "/practice",
                "icon": "brain"
            }
        }
        
        return configs.get(activity_type, configs["practice"])
    
    def _calculate_points(self, priority: str, mastery: float) -> int:
        """Calculate points for activity"""
        
        base_points = 15
        
        # Adjust for priority
        if priority == 'high':
            base_points += 5
        elif priority == 'low':
            base_points -= 3
        
        # Adjust for difficulty (lower mastery = more points)
        if mastery < 0.3:
            base_points += 3
        elif mastery > 0.7:
            base_points -= 2
        
        return max(10, base_points)  # Minimum 10 points