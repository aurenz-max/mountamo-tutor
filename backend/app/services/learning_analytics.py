# app/services/learning_analytics.py

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import math
import json
import logging
from pydantic import BaseModel

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class LearningPattern(BaseModel):
    pattern_type: str  # e.g., "time_of_day", "session_length", "error_type"
    description: str
    confidence: float  # 0-1 scale
    supporting_data: Dict[str, Any]

class SkillGap(BaseModel):
    skill_id: str
    skill_name: str
    gap_level: float  # 0-1 scale, higher means bigger gap
    prerequisite_for: List[str]  # List of skill IDs this is a prerequisite for
    recommended_resources: List[Dict[str, str]]

class LearningInsight(BaseModel):
    insight_type: str  # e.g., "strength", "challenge", "pattern", "recommendation"
    title: str
    description: str
    supporting_data: Dict[str, Any]
    priority: int  # 1-10 scale, higher means more important
    actionable: bool
    action_items: List[str]

class StudentProfile(BaseModel):
    student_id: int
    timestamp: datetime
    subjects: Dict[str, Any]
    patterns: List[LearningPattern]
    skill_gaps: List[SkillGap]
    insights: List[LearningInsight]
    recent_progress: Dict[str, Any]
    recommended_focus: List[Dict[str, Any]]

class LearningAnalyticsService:
    """Service for generating deep learning insights from competency and problem data"""
    
    def __init__(self, competency_service, problem_service, learning_paths_service, analytics_extension):
        logger.info("Initializing LearningAnalyticsService")
        self.competency_service = competency_service
        self.problem_service = problem_service
        self.learning_paths_service = learning_paths_service
        self.analytics_extension = analytics_extension
        logger.info("Using provided analytics_extension")
        
        self.progress_report_generator = ProgressReportGenerator(self)
        logger.info("LearningAnalyticsService initialization complete")
    
    async def get_student_profile(self, student_id: int) -> StudentProfile:
        """Get comprehensive student profile with learning patterns and insights"""
        logger.info(f"Getting student profile for student_id: {student_id}")
        try:
            # Get available subjects for student
            logger.debug(f"Fetching student overview for student_id: {student_id}")
            overview = await self.competency_service.get_student_overview(student_id)
            subjects = overview.get("subjects", {})
            logger.debug(f"Found {len(subjects)} subjects for student")
            
            # Initialize profile 
            profile = StudentProfile(
                student_id=student_id,
                timestamp=datetime.now(),
                subjects={},
                patterns=[],
                skill_gaps=[],
                insights=[],
                recent_progress={},
                recommended_focus=[]
            )
            
            # Process each subject
            for subject_name, subject_data in subjects.items():
                logger.debug(f"Analyzing subject: {subject_name}")
                profile.subjects[subject_name] = await self._analyze_subject(
                    student_id, subject_name, subject_data
                )
            
            # Analyze learning patterns across subjects
            logger.debug("Identifying learning patterns")
            profile.patterns = await self._identify_learning_patterns(student_id, subjects)
            
            # Identify skill gaps
            logger.debug("Identifying skill gaps")
            profile.skill_gaps = await self._identify_skill_gaps(student_id, subjects)
            
            # Generate insights
            logger.debug("Generating insights")
            profile.insights = await self._generate_insights(student_id, profile)
            
            # Get recent progress
            logger.debug("Getting recent progress")
            profile.recent_progress = await self._get_recent_progress(student_id)
            
            # Get recommended focus areas
            logger.debug("Getting recommended focus areas")
            profile.recommended_focus = await self._get_recommended_focus(student_id, profile)
            
            logger.info(f"Completed student profile for student_id: {student_id}")
            return profile
            
        except Exception as e:
            logger.error(f"Error getting student profile: {str(e)}", exc_info=True)
            # Return a minimal profile on error
            return StudentProfile(
                student_id=student_id,
                timestamp=datetime.now(),
                subjects={},
                patterns=[],
                skill_gaps=[],
                insights=[
                    LearningInsight(
                        insight_type="error",
                        title="Error generating profile",
                        description=f"An error occurred: {str(e)}",
                        supporting_data={},
                        priority=10,
                        actionable=False,
                        action_items=[]
                    )
                ],
                recent_progress={"trend": "neutral", "description": "Unable to analyze recent progress"},
                recommended_focus=[]
            )
    
    async def _analyze_subject(
        self, student_id: int, subject_name: str, subject_data: Dict
    ) -> Dict[str, Any]:
        """Analyze student performance in a specific subject"""
        logger.debug(f"Analyzing subject {subject_name} for student {student_id}")
        try:
            # Get curriculum structure
            logger.debug(f"Getting curriculum for {subject_name}")
            curriculum = await self.competency_service.get_curriculum(subject_name)
            
            # Get detailed analytics - using analytics_extension directly
            logger.debug(f"Getting detailed analytics for {subject_name}")
            analytics = await self.analytics_extension.get_detailed_analytics(
                student_id, subject_name
            )
            
            # Get daily progress - using analytics_extension directly
            logger.debug(f"Getting daily progress for student {student_id}")
            daily_progress = await self.analytics_extension.get_daily_progress(
                student_id, 30  # Last 30 days
            )
            
            # Calculate subject mastery
            logger.debug(f"Getting subject competency for {subject_name}")
            subject_competency = await self.competency_service.get_subject_competency(
                student_id, subject_name
            )
            
            # Organize skills by mastery level
            mastered_skills = []
            developing_skills = []
            struggling_skills = []
            
            # Threshold values for categorization
            mastery_threshold = 0.8  # 80% for mastery
            struggling_threshold = 0.6  # Below 60% is struggling
            
            # Get all skills for this subject - using analytics_extension directly
            logger.debug(f"Getting skill competencies for {subject_name}")
            skill_competencies = await self.analytics_extension.get_skill_competencies(
                student_id, subject_name
            )
            
            # Categorize skills
            logger.debug(f"Categorizing {len(skill_competencies)} skills")
            for skill in skill_competencies:
                score = skill.get("score", 0) / 10  # Convert from percentage to 0-1 scale
                if score >= mastery_threshold:
                    mastered_skills.append(skill)
                elif score < struggling_threshold:
                    struggling_skills.append(skill)
                else:
                    developing_skills.append(skill)
            
            # Calculate learning pace 
            logger.debug("Calculating learning pace")
            pace = self._calculate_learning_pace(daily_progress, subject_name)
            
            # Get learning path recommendations
            logger.debug("Getting learning path recommendations")
            path_recs = await self._get_learning_path_recommendations(student_id, subject_name)
            
            logger.debug(f"Completed subject analysis for {subject_name}")
            return {
                "name": subject_name,
                "mastery": subject_competency.get("current_score", 0) / 10,  # Convert to 0-1 scale
                "credibility": subject_competency.get("credibility", 0),
                "total_attempts": subject_competency.get("total_attempts", 0),
                "mastered_skills": mastered_skills,
                "developing_skills": developing_skills,
                "struggling_skills": struggling_skills,
                "learning_pace": pace,
                "analytics": analytics,
                "path_recommendations": path_recs
            }
        except Exception as e:
            logger.error(f"Error analyzing subject {subject_name}: {str(e)}", exc_info=True)
            # Return minimal data on error
            return {
                "name": subject_name,
                "mastery": 0,
                "credibility": 0,
                "total_attempts": 0,
                "mastered_skills": [],
                "developing_skills": [],
                "struggling_skills": [],
                "learning_pace": {
                    "pace": "unknown",
                    "value": 0,
                    "description": f"Error analyzing subject: {str(e)}"
                },
                "analytics": {},
                "path_recommendations": []
            }
    
    def _calculate_learning_pace(
        self, daily_progress: List[Dict[str, Any]], subject: str
    ) -> Dict[str, Any]:
        """Calculate student's learning pace compared to expected pace"""
        logger.debug(f"Calculating learning pace for {subject}")
        try:
            # This would normally incorporate more data about expected pace
            # For now, we'll use a simplified version
            
            if not daily_progress:
                return {
                    "pace": "unknown",
                    "value": 0,
                    "description": "Insufficient data to determine pace"
                }
            
            # Count days with activity
            active_days = sum(1 for day in daily_progress if day.get("problems", 0) > 0)
            
            # Get average problems per active day
            if active_days > 0:
                avg_problems = sum(day.get("problems", 0) for day in daily_progress) / active_days
            else:
                avg_problems = 0
            
            # Simplified pace determination
            if avg_problems >= 10:
                pace = "fast"
                value = 3
                description = "Learning at a fast pace"
            elif avg_problems >= 5:
                pace = "moderate"
                value = 2
                description = "Learning at a steady pace"
            elif avg_problems > 0:
                pace = "slow"
                value = 1
                description = "Learning at a slower pace"
            else:
                pace = "inactive"
                value = 0
                description = "Currently inactive"
            
            logger.debug(f"Pace calculated as: {pace}")
            return {
                "pace": pace,
                "value": value,
                "description": description,
                "avg_problems_per_active_day": avg_problems,
                "active_days": active_days,
                "total_days": len(daily_progress)
            }
        except Exception as e:
            logger.error(f"Error calculating learning pace: {str(e)}", exc_info=True)
            return {
                "pace": "unknown",
                "value": 0,
                "description": f"Error determining pace: {str(e)}"
            }
    
    async def _get_learning_path_recommendations(
        self, student_id: int, subject: str
    ) -> List[Dict[str, Any]]:
        """Get recommended next steps for learning path"""
        logger.debug(f"Getting learning path recommendations for {subject}")
        try:
            # Get current skills in progress
            path_data = await self.learning_paths_service.get_learning_paths()
            
            # Find skills with highest mastery - using analytics_extension directly
            skill_competencies = await self.analytics_extension.get_skill_competencies(
                student_id, subject
            )
            
            # Sort by score (descending)
            skill_competencies.sort(key=lambda x: x.get("score", 0), reverse=True)
            
            # Find most advanced mastered skill
            mastered_skills = [s for s in skill_competencies if s.get("score", 0) >= 80]  # 80% mastery
            logger.debug(f"Found {len(mastered_skills)} mastered skills")
            
            if not mastered_skills:
                # No mastered skills, recommend starting point
                return [{
                    "skill_id": "COUNT001-01",  # Root skill
                    "rationale": "Starting with foundational skills"
                }]
            
            recommendations = []
            for skill in mastered_skills[:3]:  # Take top 3 mastered skills
                skill_id = skill.get("skill", "")
                
                # Get next skills in learning path
                next_skills = path_data.get(skill_id, [])
                
                if next_skills:
                    # Check competency for these skills
                    for next_skill in next_skills:
                        recommendations.append({
                            "current_skill": skill_id,
                            "skill_id": next_skill,
                            "rationale": f"Next step after mastering {skill_id}"
                        })
            
            logger.debug(f"Generated {len(recommendations)} recommendations")
            return recommendations[:3]  # Limit to top 3 recommendations
        except Exception as e:
            logger.error(f"Error getting learning path recommendations: {str(e)}", exc_info=True)
            return []
    
    async def _identify_learning_patterns(
        self, student_id: int, subjects: Dict[str, Any]
    ) -> List[LearningPattern]:
        """Identify patterns in student learning behavior"""
        logger.debug(f"Identifying learning patterns for student {student_id}")
        try:
            patterns = []
            
            # Get daily progress data - using analytics_extension directly
            daily_progress = await self.analytics_extension.get_daily_progress(
                student_id, 30  # Last 30 days
            )
            
            # Analyze time of day patterns
            time_pattern = self._analyze_time_patterns(daily_progress)
            if time_pattern:
                patterns.append(time_pattern)
            
            # Analyze session length patterns
            session_pattern = self._analyze_session_patterns(daily_progress)
            if session_pattern:
                patterns.append(session_pattern)
            
            logger.debug(f"Identified {len(patterns)} learning patterns")
            return patterns
        except Exception as e:
            logger.error(f"Error identifying learning patterns: {str(e)}", exc_info=True)
            return []
    
    def _analyze_time_patterns(self, daily_progress: List[Dict[str, Any]]) -> Optional[LearningPattern]:
        """Analyze when student tends to be most active and effective"""
        logger.debug("Analyzing time patterns")
        try:
            # This would normally use timestamp data to identify time patterns
            # For now, we'll return a placeholder
            
            if not daily_progress:
                return None
            
            return LearningPattern(
                pattern_type="time_of_day",
                description="Student is most active in the afternoons",
                confidence=0.7,
                supporting_data={
                    "morning_activity": 0.2,
                    "afternoon_activity": 0.6,
                    "evening_activity": 0.2
                }
            )
        except Exception as e:
            logger.error(f"Error analyzing time patterns: {str(e)}", exc_info=True)
            return None
    
    def _analyze_session_patterns(self, daily_progress: List[Dict[str, Any]]) -> Optional[LearningPattern]:
        """Analyze student's session length and frequency patterns"""
        logger.debug("Analyzing session patterns")
        try:
            # This would normally use detailed session data
            # For now, we'll return a placeholder
            
            if not daily_progress:
                return None
            
            return LearningPattern(
                pattern_type="session_length",
                description="Student typically has shorter, frequent sessions",
                confidence=0.6,
                supporting_data={
                    "avg_session_length": 15,  # minutes
                    "sessions_per_week": 4,
                    "completion_rate": 0.8
                }
            )
        except Exception as e:
            logger.error(f"Error analyzing session patterns: {str(e)}", exc_info=True)
            return None
    
    async def _identify_skill_gaps(
        self, student_id: int, subjects: Dict[str, Any]
    ) -> List[SkillGap]:
        """Identify skill gaps based on learning path and current competencies"""
        logger.debug(f"Identifying skill gaps for student {student_id}")
        try:
            gaps = []
            
            # Get learning paths
            path_data = await self.learning_paths_service.get_learning_paths()
            
            # Process each subject
            for subject_name in subjects:
                # Get skill competencies for this subject - using analytics_extension directly
                skill_competencies = await self.analytics_extension.get_skill_competencies(
                    student_id, subject_name
                )
                
                # Create a map of skill_id to score
                skill_scores = {s.get("skill", ""): s.get("score", 0) / 10 for s in skill_competencies}
                
                # Find skills with prerequisites not mastered
                for skill_id, score in skill_scores.items():
                    # Skip if skill already mastered
                    if score >= 0.8:  # 80% mastery
                        continue
                    
                    # Get prerequisites for this skill
                    prerequisites = await self.learning_paths_service.get_skill_prerequisites(skill_id)
                    
                    for prereq in prerequisites:
                        prereq_score = skill_scores.get(prereq, 0)
                        
                        # If prerequisite not mastered and current skill score low
                        if prereq_score < 0.8 and score < 0.6:
                            # This is a significant gap
                            gaps.append(SkillGap(
                                skill_id=prereq,
                                skill_name=f"Skill {prereq}",  # Would use actual name from metadata
                                gap_level=0.8 - prereq_score,  # Gap size
                                prerequisite_for=[skill_id],
                                recommended_resources=[]  # Would include actual resources
                            ))
            
            # Sort by gap level (descending)
            gaps.sort(key=lambda x: x.gap_level, reverse=True)
            
            logger.debug(f"Identified {len(gaps)} skill gaps")
            return gaps[:5]  # Limit to top 5 gaps
        except Exception as e:
            logger.error(f"Error identifying skill gaps: {str(e)}", exc_info=True)
            return []
    
    async def _generate_insights(
        self, student_id: int, profile: StudentProfile
    ) -> List[LearningInsight]:
        """Generate actionable insights from the student profile data"""
        logger.debug(f"Generating insights for student {student_id}")
        try:
            insights = []
            
            # Generate subject-specific insights
            for subject_name, subject_data in profile.subjects.items():
                # Insight about struggling skills
                if subject_data.get("struggling_skills"):
                    struggling = subject_data["struggling_skills"][0]  # First struggling skill
                    insights.append(LearningInsight(
                        insight_type="challenge",
                        title=f"Focus needed on {struggling.get('skill', '')}",
                        description=f"This skill is significantly below mastery level at {struggling.get('score', 0)}%",
                        supporting_data={"skill_data": struggling},
                        priority=8,
                        actionable=True,
                        action_items=[
                            "Practice additional problems in this skill area",
                            "Review foundational concepts",
                            "Schedule a targeted session with a tutor"
                        ]
                    ))
                
                # Insight about learning pace
                pace_data = subject_data.get("learning_pace", {})
                if pace_data.get("pace") == "slow":
                    insights.append(LearningInsight(
                        insight_type="pattern",
                        title="Learning pace could be increased",
                        description="Current pace is slower than recommended for optimal progress",
                        supporting_data=pace_data,
                        priority=6,
                        actionable=True,
                        action_items=[
                            "Schedule regular, shorter practice sessions",
                            "Set specific goals for each week",
                            "Try to increase practice frequency"
                        ]
                    ))
                
                # Insight about mastered skills
                if subject_data.get("mastered_skills"):
                    mastered = subject_data["mastered_skills"][0]  # First mastered skill
                    insights.append(LearningInsight(
                        insight_type="strength",
                        title=f"Strong performance in {mastered.get('skill', '')}",
                        description="This skill has been mastered and can be built upon",
                        supporting_data={"skill_data": mastered},
                        priority=4,
                        actionable=True,
                        action_items=[
                            "Move on to more advanced topics that build on this skill",
                            "Use this strength to help with more challenging areas"
                        ]
                    ))
            
            # Generate insights from skill gaps
            for gap in profile.skill_gaps[:2]:  # Top 2 gaps
                insights.append(LearningInsight(
                    insight_type="gap",
                    title=f"Knowledge gap in {gap.skill_name}",
                    description=f"This gap may be limiting progress in dependent skills",
                    supporting_data={"gap_data": json.loads(gap.json())},
                    priority=9,
                    actionable=True,
                    action_items=[
                        f"Focus on mastering {gap.skill_name}",
                        "Review related foundational concepts",
                        "Practice with targeted problems"
                    ]
                ))
            
            # Generate insights from learning patterns
            for pattern in profile.patterns:
                if pattern.pattern_type == "time_of_day":
                    insights.append(LearningInsight(
                        insight_type="pattern",
                        title="Optimal learning time identified",
                        description=pattern.description,
                        supporting_data=pattern.supporting_data,
                        priority=5,
                        actionable=True,
                        action_items=[
                            "Schedule more practice sessions during optimal times",
                            "Adjust study schedule to align with natural patterns"
                        ]
                    ))
            
            # Sort insights by priority (descending)
            insights.sort(key=lambda x: x.priority, reverse=True)
            
            logger.debug(f"Generated {len(insights)} insights")
            return insights
        except Exception as e:
            logger.error(f"Error generating insights: {str(e)}", exc_info=True)
            return [
                LearningInsight(
                    insight_type="error",
                    title="Error generating insights",
                    description=f"An error occurred: {str(e)}",
                    supporting_data={},
                    priority=10,
                    actionable=False,
                    action_items=[]
                )
            ]
    
    async def _get_recent_progress(self, student_id: int) -> Dict[str, Any]:
        """Get summary of recent progress across all subjects"""
        logger.debug(f"Getting recent progress for student {student_id}")
        try:
            # Get daily progress data - using analytics_extension directly
            daily_progress = await self.analytics_extension.get_daily_progress(
                student_id, 14  # Last 14 days
            )
            
            if not daily_progress:
                return {
                    "trend": "neutral",
                    "description": "No recent activity detected",
                    "data": {}
                }
            
            # Calculate trend
            recent_days = daily_progress[:7]  # Last 7 days
            previous_days = daily_progress[7:14]  # Previous 7 days
            
            recent_competency = sum(day.get("competency", 0) for day in recent_days) / max(len(recent_days), 1)
            previous_competency = sum(day.get("competency", 0) for day in previous_days) / max(len(previous_days), 1)
            
            # Calculate change
            change = recent_competency - previous_competency
            
            if change >= 5:  # 5% improvement
                trend = "improving"
                description = "Showing significant improvement recently"
            elif change <= -5:  # 5% decline
                trend = "declining"
                description = "Shows a decline in performance recently"
            else:
                trend = "stable"
                description = "Maintaining consistent performance"
            
            logger.debug(f"Recent progress trend: {trend}")
            return {
                "trend": trend,
                "description": description,
                "data": {
                    "recent_competency": recent_competency,
                    "previous_competency": previous_competency,
                    "change": change,
                    "recent_days_active": sum(1 for day in recent_days if day.get("problems", 0) > 0),
                    "recent_problems_completed": sum(day.get("problems", 0) for day in recent_days)
                }
            }
        except Exception as e:
            logger.error(f"Error getting recent progress: {str(e)}", exc_info=True)
            return {
                "trend": "neutral",
                "description": f"Error analyzing progress: {str(e)}",
                "data": {}
            }
    
    async def _get_recommended_focus(
        self, student_id: int, profile: StudentProfile
    ) -> List[Dict[str, Any]]:
        """Generate recommended focus areas based on profile analysis"""
        logger.debug(f"Getting recommended focus areas for student {student_id}")
        try:
            focus_areas = []
            
            # First, check for any significant skill gaps
            if profile.skill_gaps:
                for gap in profile.skill_gaps[:2]:  # Top 2 gaps
                    focus_areas.append({
                        "type": "skill_gap",
                        "title": f"Address knowledge gap in {gap.skill_name}",
                        "description": "This foundational skill needs to be strengthened",
                        "priority": "high",
                        "subject": next((s for s in profile.subjects.keys()), ""),  # First subject as fallback
                        "skill_id": gap.skill_id
                    })
            
            # Next, look at struggling skills in each subject
            for subject_name, subject_data in profile.subjects.items():
                if subject_data.get("struggling_skills"):
                    skill = subject_data["struggling_skills"][0]  # First struggling skill
                    focus_areas.append({
                        "type": "struggling_skill",
                        "title": f"Strengthen {skill.get('skill', '')}",
                        "description": "Performance in this skill area needs improvement",
                        "priority": "medium",
                        "subject": subject_name,
                        "skill_id": skill.get("skill", "")
                    })
            
            # Add recommendations from learning path
            for subject_name, subject_data in profile.subjects.items():
                if subject_data.get("path_recommendations"):
                    rec = subject_data["path_recommendations"][0]  # First recommendation
                    focus_areas.append({
                        "type": "advancement",
                        "title": f"Progress to {rec.get('skill_id', '')}",
                        "description": "Ready to advance to this next skill in the learning path",
                        "priority": "medium",
                        "subject": subject_name,
                        "skill_id": rec.get("skill_id", "")
                    })
            
            logger.debug(f"Generated {len(focus_areas)} focus areas")
            return focus_areas[:3]  # Limit to top 3 focus areas
        except Exception as e:
            logger.error(f"Error getting recommended focus areas: {str(e)}", exc_info=True)
            return []



class ProgressReportGenerator:
    """Generates formatted progress reports from learning analytics data"""
    
    def __init__(self, analytics_service):
        self.analytics_service = analytics_service
    
    async def generate_student_report(
            self, student_id: int, format_type: str = "markdown"
        ) -> Dict[str, Any]:
            """Generate a comprehensive student progress report"""
            logger.info(f"Generating student report for student_id {student_id}, format: {format_type}")
            try:
                # Get student profile data
                logger.debug("Getting student profile data")
                profile = await self.analytics_service.get_student_profile(student_id)
                
                # Create report data
                logger.debug("Creating report data structure")
                
                # Convert StudentProfile to dictionary
                if not isinstance(profile, dict):
                    profile_dict = json.loads(profile.json())
                else:
                    profile_dict = profile
                    
                report_data = {
                    "student_id": student_id,
                    "timestamp": datetime.now().isoformat(),
                    "profile": profile_dict,
                    "summary": self._generate_summary(profile),
                    "strength_areas": self._extract_strengths(profile),
                    "focus_areas": self._extract_focus_areas(profile),
                    "recent_progress": profile_dict.get("recent_progress", {}),
                    "insights": [json.loads(insight.json()) if hasattr(insight, 'json') else insight 
                                for insight in profile_dict.get("insights", [])]
                }
                
                # Format the report
                logger.debug(f"Formatting report as {format_type}")
                if format_type == "markdown":
                    report_data["formatted_report"] = self._format_markdown_report(profile_dict, report_data)
                elif format_type == "html":
                    report_data["formatted_report"] = self._format_html_report(profile_dict, report_data)
                else:
                    report_data["formatted_report"] = self._format_text_report(profile_dict, report_data)
                
                # Format the tutor brief
                logger.debug("Creating tutor brief")
                report_data["tutor_brief"] = self._format_tutor_brief(profile, report_data)
                
                logger.info(f"Completed student report for student_id {student_id}")
                return report_data
            except Exception as e:
                logger.error(f"Error generating student report: {str(e)}", exc_info=True)
                # Return minimal report on error
                return {
                    "student_id": student_id,
                    "timestamp": datetime.now().isoformat(),
                    "profile": {},
                    "summary": {
                        "status": "Error",
                        "overall_mastery": 0,
                        "subject_count": 0,
                        "total_mastered_skills": 0,
                        "total_developing_skills": 0,
                        "total_struggling_skills": 0,
                        "top_insights": [f"Error generating report: {str(e)}"]
                    },
                    "strength_areas": [],
                    "focus_areas": [],
                    "recent_progress": {"trend": "neutral", "description": "Error analyzing progress"},
                    "insights": [],
                    "formatted_report": f"# Error Generating Report\n\nAn error occurred: {str(e)}",
                    "tutor_brief": {
                        "overall_status": "Error",
                        "overall_mastery": 0,
                        "recent_trend": "neutral",
                        "strengths": [],
                        "areas_of_focus": [],
                        "recommendations": [],
                        "insights": []
                    }
                }
    
    def _generate_summary(self, profile: StudentProfile) -> Dict[str, Any]:
        """Generate an executive summary of the student profile"""
        # Calculate overall mastery across subjects
        subject_count = len(profile.subjects)
        if subject_count > 0:
            avg_mastery = sum(s.get("mastery", 0) for s in profile.subjects.values()) / subject_count
        else:
            avg_mastery = 0
        
        # Count mastered, developing, and struggling skills
        total_mastered = sum(len(s.get("mastered_skills", [])) for s in profile.subjects.values())
        total_developing = sum(len(s.get("developing_skills", [])) for s in profile.subjects.values())
        total_struggling = sum(len(s.get("struggling_skills", [])) for s in profile.subjects.values())
        
        # Determine overall status
        if avg_mastery >= 0.8:
            status = "Excellent Progress"
        elif avg_mastery >= 0.6:
            status = "Good Progress"
        elif avg_mastery >= 0.4:
            status = "Making Progress"
        else:
            status = "Needs Focus"
        
        return {
            "status": status,
            "overall_mastery": avg_mastery,
            "subject_count": subject_count,
            "total_mastered_skills": total_mastered,
            "total_developing_skills": total_developing,
            "total_struggling_skills": total_struggling,
            "top_insights": [insight.title for insight in profile.insights[:3]]
        }
    
    def _extract_strengths(self, profile: StudentProfile) -> List[Dict[str, Any]]:
        """Extract areas of strength from the profile"""
        strengths = []
        
        # Get top mastered skills from each subject
        for subject_name, subject_data in profile.subjects.items():
            for skill in subject_data.get("mastered_skills", [])[:2]:  # Top 2 skills per subject
                strengths.append({
                    "subject": subject_name,
                    "skill": skill.get("skill", ""),
                    "score": skill.get("score", 0),
                    "type": "mastered_skill"
                })
        
        # Get strength insights
        for insight in profile.insights:
            if insight.insight_type == "strength":
                strengths.append({
                    "subject": next((s for s in profile.subjects.keys()), ""),  # First subject as fallback
                    "title": insight.title,
                    "description": insight.description,
                    "type": "insight"
                })
        
        # Limit to top 5 strengths
        return strengths[:5]
    
    def _extract_focus_areas(self, profile: StudentProfile) -> List[Dict[str, Any]]:
        """Extract recommended focus areas from the profile"""
        return profile.recommended_focus
    
    def _format_markdown_report(
            self, profile, report_data: Dict[str, Any]
        ) -> str:
            """Format the report as Markdown"""
            logger.debug("Formatting report as Markdown")
            try:
                # Handle both StudentProfile objects and dictionaries
                if isinstance(profile, dict):
                    # It's already a dict (from json.loads())
                    profile_dict = profile
                else:
                    # It's a StudentProfile object
                    profile_dict = json.loads(profile.json())
                
                # This would include a more elaborate template with sections and formatting
                md = f"# Learning Progress Report\n\n"
                md += f"**Generated:** {datetime.now().strftime('%Y-%m-%d')}\n\n"
                
                # Summary section
                summary = report_data["summary"]
                md += f"## Summary\n\n"
                md += f"**Overall Status:** {summary['status']}\n\n"
                md += f"Overall mastery: **{summary['overall_mastery']*100:.1f}%**  \n"
                md += f"Subjects: {summary['subject_count']}  \n"
                md += f"Mastered skills: {summary['total_mastered_skills']}  \n"
                md += f"Developing skills: {summary['total_developing_skills']}  \n"
                md += f"Struggling skills: {summary['total_struggling_skills']}  \n\n"
                
                # Recent progress
                recent = report_data.get("recent_progress", {})
                md += f"## Recent Progress: {recent.get('trend', 'neutral').title()}\n\n"
                md += f"{recent.get('description', '')}\n\n"
                
                # Subjects section
                md += f"## Subject Progress\n\n"
                for subject_name, subject_data in profile_dict.get("subjects", {}).items():
                    md += f"### {subject_name}\n\n"
                    md += f"Mastery: **{subject_data.get('mastery', 0)*100:.1f}%**  \n"
                    md += f"Credibility: {subject_data.get('credibility', 0)*100:.1f}%  \n\n"
                    
                    # Struggling skills
                    if subject_data.get("struggling_skills"):
                        md += "**Skills Needing Focus:**\n"
                        for skill in subject_data["struggling_skills"][:3]:
                            md += f"* {skill.get('skill', '')}: {skill.get('score', 0)}%\n"
                        md += "\n"
                    
                    # Mastered skills
                    if subject_data.get("mastered_skills"):
                        md += "**Mastered Skills:**\n"
                        for skill in subject_data["mastered_skills"][:3]:
                            md += f"* {skill.get('skill', '')}: {skill.get('score', 0)}%\n"
                        md += "\n"
                
                # Focus areas
                md += f"## Recommended Focus Areas\n\n"
                for i, focus in enumerate(report_data.get("focus_areas", [])):
                    md += f"### {i+1}. {focus['title']}\n\n"
                    md += f"{focus['description']}\n\n"
                    md += f"**Priority:** {focus['priority']}\n"
                    md += f"**Subject:** {focus['subject']}\n\n"
                    
                # Learning insights
                md += f"## Key Insights\n\n"
                for insight in report_data.get("insights", [])[:5]:  # Top 5 insights
                    md += f"### {insight['title']}\n\n"
                    md += f"{insight['description']}\n\n"
                    if insight.get('actionable', False):
                        md += "**Recommended Actions:**\n"
                        for action in insight.get('action_items', []):
                            md += f"* {action}\n"
                        md += "\n"
                
                logger.debug("Markdown report formatted successfully")
                return md
            except Exception as e:
                logger.error(f"Error formatting markdown report: {str(e)}", exc_info=True)
                return f"# Error Generating Report\n\nAn error occurred: {str(e)}"
    
    def _format_html_report(
            self, profile, report_data: Dict[str, Any]
        ) -> str:
            """Format the report as HTML"""
            logger.debug("Formatting report as HTML")
            try:
                # This would be a more elaborate HTML template
                # For now, just a simple conversion from markdown
                md = self._format_markdown_report(profile, report_data)
                
                # Very basic markdown to HTML (would use a proper converter in production)
                html = "<html><body>\n"
                
                for line in md.split('\n'):
                    if line.startswith('# '):
                        html += f"<h1>{line[2:]}</h1>\n"
                    elif line.startswith('## '):
                        html += f"<h2>{line[3:]}</h2>\n"
                    elif line.startswith('### '):
                        html += f"<h3>{line[4:]}</h3>\n"
                    elif line.startswith('* '):
                        html += f"<ul><li>{line[2:]}</li></ul>\n"
                    elif line.startswith('**') and line.endswith('**'):
                        html += f"<p><strong>{line[2:-2]}</strong></p>\n"
                    elif line.strip() == '':
                        html += "<br/>\n"
                    else:
                        html += f"<p>{line}</p>\n"
                
                html += "</body></html>"
                logger.debug("HTML report formatted successfully")
                return html
            except Exception as e:
                logger.error(f"Error formatting HTML report: {str(e)}", exc_info=True)
                return f"<html><body><h1>Error Generating Report</h1><p>An error occurred: {str(e)}</p></body></html>"
    
    def _format_text_report(
            self, profile, report_data: Dict[str, Any]
        ) -> str:
            """Format the report as plain text"""
            logger.debug("Formatting report as plain text")
            try:
                # Convert markdown to plain text
                md = self._format_markdown_report(profile, report_data)
                
                # Replace markdown headers
                text = md.replace('# ', '').replace('## ', '').replace('### ', '')
                
                # Replace markdown formatting
                text = text.replace('**', '')
                
                logger.debug("Text report formatted successfully")
                return text
            except Exception as e:
                logger.error(f"Error formatting text report: {str(e)}", exc_info=True)
                return f"Error Generating Report\n\nAn error occurred: {str(e)}"
    
    def _format_tutor_brief(
        self, profile: StudentProfile, report_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format a brief summary for the AI tutor"""
        # This is the critical part for your AI tutor integration
        # Create a structured data format that your AI tutor can easily consume
        
        tutor_brief = {
            "overall_status": report_data["summary"]["status"],
            "overall_mastery": report_data["summary"]["overall_mastery"],
            "recent_trend": profile.recent_progress.get("trend", "neutral"),
            "strengths": [],
            "areas_of_focus": [],
            "recommendations": [],
            "insights": []
        }
        
        # Add top strengths
        for strength in report_data["strength_areas"][:3]:
            if "skill" in strength:
                tutor_brief["strengths"].append({
                    "type": "skill",
                    "subject": strength["subject"],
                    "skill_name": strength["skill"],
                    "mastery_level": strength["score"] / 100
                })
            else:
                tutor_brief["strengths"].append({
                    "type": "insight",
                    "description": strength["description"]
                })
        
        # Add focus areas
        for focus in report_data["focus_areas"]:
            tutor_brief["areas_of_focus"].append({
                "title": focus["title"],
                "description": focus["description"],
                "subject": focus["subject"],
                "skill_id": focus.get("skill_id", ""),
                "priority": focus["priority"]
            })
        
        # Add actionable insights 
        for insight in profile.insights:
            if insight.actionable:
                tutor_brief["insights"].append({
                    "title": insight.title,
                    "description": insight.description,
                    "actions": insight.action_items
                })
        
        # Add skill gap recommendations
        for gap in profile.skill_gaps[:2]:
            tutor_brief["recommendations"].append({
                "type": "address_gap",
                "skill_name": gap.skill_name,
                "description": f"Address gap in {gap.skill_name} which is a prerequisite for {', '.join(gap.prerequisite_for)}",
                "importance": "high"
            })
        
        return tutor_brief