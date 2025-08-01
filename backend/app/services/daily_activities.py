# backend/app/services/daily_activities.py
# Enhanced version with curriculum metadata

import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class CurriculumMetadata(BaseModel):
    subject: str
    unit: Dict[str, str]  # {id, title, description}
    skill: Dict[str, str]  # {id, description}
    subskill: Dict[str, str]  # {id, description}

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
    curriculum_metadata: Optional[CurriculumMetadata] = None

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

class CurriculumParser:
    """Parse activity IDs and create curriculum metadata"""
    
    # Subject mappings
    SUBJECT_MAPPING = {
        'COUNT': 'Mathematics',
        'SS': 'Social Studies', 
        'SCI': 'Science',
        'ART': 'Arts',
        'LA': 'Language Arts',
        'MATH': 'Mathematics',
        'ELA': 'English Language Arts'
    }
    
    # Unit descriptions
    UNIT_DESCRIPTIONS = {
        'COUNT001': 'Counting and Cardinality',
        'SS001': 'Classroom Routines and Social Skills',
        'SCI001': 'Scientific Observation and Classification',
        'ART001': 'Art Materials and Creative Expression',
        'LA001': 'Print Concepts and Book Handling',
        'MATH001': 'Number Sense Foundations',
        'ELA001': 'Phonological Awareness'
    }
    
    # Skill descriptions by unit and skill number
    SKILL_DESCRIPTIONS = {
        ('COUNT001', '01'): 'Number Recognition and Counting 0-10',
        ('COUNT001', '02'): 'Number Writing and Formation',
        ('SS001', '01'): 'Basic Classroom Procedures and Independence',
        ('SS001', '02'): 'Social Interaction and Communication',
        ('SCI001', '01'): 'Observation and Description Skills',
        ('SCI001', '02'): 'Classification and Sorting',
        ('ART001', '01'): 'Material Exploration and Tool Use',
        ('ART001', '02'): 'Creative Expression Techniques',
        ('LA001', '01'): 'Print Awareness and Book Orientation',
        ('LA001', '02'): 'Letter Recognition and Sound Awareness'
    }
    
    @classmethod
    def parse_activity_id(cls, activity_id: str) -> Optional[Dict]:
        """
        Parse activity ID to extract curriculum metadata
        Expected formats:
        - rec-COUNT001-01-A
        - rec-[SUBJECT][UNIT]-[SKILL]-[SUBSKILL]
        """
        try:
            # Remove 'rec-' prefix if present
            clean_id = activity_id.replace('rec-', '') if activity_id.startswith('rec-') else activity_id
            
            # Split into parts
            parts = clean_id.split('-')
            if len(parts) < 3:
                logger.warning(f"Activity ID {activity_id} doesn't match expected format")
                return None
            
            subject_unit = parts[0]  # e.g., COUNT001
            skill_num = parts[1]     # e.g., 01
            subskill_code = parts[2] # e.g., A
            
            # Extract subject code and unit number using regex
            match = re.match(r'([A-Z]+)(\d+)', subject_unit)
            if not match:
                logger.warning(f"Cannot parse subject/unit from {subject_unit}")
                return None
            
            subject_code = match.group(1)  # e.g., COUNT
            unit_num = match.group(2)      # e.g., 001
            
            # Get descriptions
            subject_name = cls.SUBJECT_MAPPING.get(subject_code, subject_code)
            unit_description = cls.UNIT_DESCRIPTIONS.get(subject_unit, f"Unit {unit_num}")
            skill_description = cls.SKILL_DESCRIPTIONS.get((subject_unit, skill_num), f"Skill {skill_num}")
            
            return {
                'subject': subject_name,
                'unit': {
                    'id': subject_unit,
                    'title': unit_description,
                    'description': unit_description
                },
                'skill': {
                    'id': skill_num,
                    'description': skill_description
                },
                'subskill': {
                    'id': subskill_code,
                    'description': 'Learning Activity'  # Will be overridden by actual title
                }
            }
            
        except Exception as e:
            logger.warning(f"Failed to parse activity ID {activity_id}: {e}")
            return None
    
    @classmethod
    def enhance_activity_with_curriculum_data(cls, activity_dict: Dict, title: str = None) -> Dict:
        """Add curriculum metadata to activity dictionary"""
        
        curriculum_data = cls.parse_activity_id(activity_dict.get('id', ''))
        
        if curriculum_data:
            # Clean up the title for subskill description
            clean_title = title or activity_dict.get('title', '')
            if clean_title.startswith('Learn: '):
                clean_title = clean_title[7:]  # Remove "Learn: " prefix
            elif clean_title.startswith('Practice: '):
                clean_title = clean_title[10:]  # Remove "Practice: " prefix
            elif clean_title.startswith('Review: '):
                clean_title = clean_title[8:]  # Remove "Review: " prefix
            
            # Update subskill description with actual learning objective
            curriculum_data['subskill']['description'] = clean_title
            
            # Add curriculum metadata
            activity_dict['curriculum_metadata'] = curriculum_data
            
            # Also enhance the metadata for backward compatibility
            if 'metadata' not in activity_dict:
                activity_dict['metadata'] = {}
            
            activity_dict['metadata'].update({
                'subject': curriculum_data['subject'],
                'unit_description': curriculum_data['unit']['description'],
                'skill_description': curriculum_data['skill']['description']
            })
        
        return activity_dict

class DailyActivitiesService:
    """Enhanced service with curriculum metadata support"""
    
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
            recommendations = await self.analytics_service.get_recommendations(
                student_id=student_id,
                limit=5
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
        """Convert BigQuery recommendations into daily activities with curriculum metadata"""
        
        activities = []
        
        for i, rec in enumerate(recommendations):
            # Extract data from recommendation
            subskill_desc = rec.get('subskill_description', 'Practice Session')
            subject = rec.get('subject', 'Mathematics')
            priority = rec.get('priority', 'medium')
            mastery = rec.get('mastery', 0.0)
            skill_id = rec.get('skill_id', '')
            subskill_id = rec.get('subskill_id', f'skill_{i}')
            
            # Determine activity type and get config
            activity_type = self._determine_activity_type(rec)
            config = self._get_activity_config(activity_type, subskill_desc)
            
            # Calculate points and assign time slot
            points = self._calculate_points(priority, mastery)
            time_slot = ['morning', 'midday', 'afternoon', 'evening'][i % 4]
            
            # Create base activity dictionary
            activity_dict = {
                'id': f"rec-{subskill_id}",
                'type': activity_type,
                'title': config['title'],
                'description': config['description'],
                'category': config['category'],
                'estimated_time': config['time'],
                'points': points,
                'priority': priority,
                'time_slot': time_slot,
                'action': config['action'],
                'endpoint': config['endpoint'],
                'icon_type': config['icon'],
                'metadata': {
                    'from_recommendations': True,
                    'recommendation_id': subskill_id,
                    'subject': subject,
                    'skill_id': skill_id,
                    'mastery_level': mastery,
                    'priority_level': rec.get('priority_level'),
                    'readiness_status': rec.get('readiness_status', 'Ready')
                }
            }
            
            # Enhance with curriculum metadata
            enhanced_dict = CurriculumParser.enhance_activity_with_curriculum_data(
                activity_dict, 
                config['title']
            )
            
            # Create DailyActivity from enhanced dictionary
            activity = DailyActivity(**enhanced_dict)
            activities.append(activity)
        
        return activities
    
    def _create_fallback_activities(self) -> List[DailyActivity]:
        """Create basic activities with curriculum metadata when no recommendations available"""
        
        fallback_configs = [
            {
                'id': 'rec-COUNT001-01-A',
                'title': 'Learn: Count and recognize numbers 0-10, including matching spoken words to written numerals',
                'subject': 'Mathematics'
            },
            {
                'id': 'rec-SS001-01-A', 
                'title': 'Learn: Follow basic 3-step classroom routines independently (entering, storing belongings, starting assigned task)',
                'subject': 'Social Studies'
            },
            {
                'id': 'rec-SCI001-02-A',
                'title': 'Learn: Sort and classify objects by basic observable properties (color, shape, size, texture)',
                'subject': 'Science'
            },
            {
                'id': 'rec-ART001-01-A',
                'title': 'Learn: Explore a variety of art materials and tools',
                'subject': 'Arts'
            },
            {
                'id': 'rec-LA001-01-A',
                'title': 'Learn: Demonstrate proper book handling skills (orientation, covers, page turning)',
                'subject': 'Language Arts'
            }
        ]
        
        activities = []
        time_slots = ['morning', 'midday', 'afternoon', 'evening']
        
        for i, config in enumerate(fallback_configs):
            activity_dict = {
                'id': config['id'],
                'type': 'practice',
                'title': config['title'],
                'description': f"Essential skill building in {config['subject'].lower()}",
                'category': config['subject'],
                'estimated_time': '12 min',
                'points': 23,
                'priority': 'medium',
                'time_slot': time_slots[i % len(time_slots)],
                'action': 'Start Learning',
                'endpoint': '/practice',
                'icon_type': 'zap',
                'metadata': {
                    'fallback': True,
                    'subject': config['subject'],
                    'from_recommendations': True  # These are AI-generated fallbacks
                }
            }
            
            # Enhance with curriculum metadata
            enhanced_dict = CurriculumParser.enhance_activity_with_curriculum_data(
                activity_dict,
                config['title']
            )
            
            activity = DailyActivity(**enhanced_dict)
            activities.append(activity)
        
        return activities
    
    def _determine_activity_type(self, recommendation: Dict) -> str:
        """Determine best activity type based on recommendation data"""
        mastery = recommendation.get('mastery', 0.0)
        priority = recommendation.get('priority', 'medium')
        
        if mastery < 0.3:
            return 'tutoring'
        elif priority == 'high':
            return 'practice'
        elif mastery > 0.7:
            return 'review'
        else:
            return 'practice'
    
    def _get_activity_config(self, activity_type: str, subskill_desc: str) -> Dict[str, str]:
        """Get configuration for activity type"""
        configs = {
            "practice": {
                "title": f"Practice: {subskill_desc}",
                "description": f"Targeted practice for {subskill_desc.lower()}",
                "category": "Practice Problems",
                "time": "12 min",
                "action": "Start Practice",
                "endpoint": "/practice",
                "icon": "zap"
            },
            "tutoring": {
                "title": f"Learn: {subskill_desc}",
                "description": f"Interactive learning session on {subskill_desc.lower()}",
                "category": "AI Tutoring",
                "time": "12 min",
                "action": "Start Session",
                "endpoint": "/tutoring",
                "icon": "headphones"
            },
            "review": {
                "title": f"Review: {subskill_desc}",
                "description": f"Reinforce {subskill_desc.lower()} concepts",
                "category": "Review Session",
                "time": "12 min",
                "action": "Review",
                "endpoint": "/practice",
                "icon": "brain"
            }
        }
        
        return configs.get(activity_type, configs["practice"])
    
    def _calculate_points(self, priority: str, mastery: float) -> int:
        """Calculate points for activity"""
        return 23  # Standard points for now