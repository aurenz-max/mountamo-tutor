"""
Assessment feedback schemas for storing recent assessment insights in Cosmos DB.
These schemas support the intelligent daily plan system that synthesizes velocity
metrics with assessment feedback to create personalized learning recommendations.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from .assessment_review import AssessmentFocusTag, PerformanceLabel, NextStepAction


class AssessmentSkillInsight(BaseModel):
    """Individual skill insight from an assessment"""
    skill_id: str = Field(..., description="Skill identifier")
    skill_name: str = Field(..., description="Human-readable skill name")
    assessment_focus_tag: AssessmentFocusTag = Field(..., description="Focus category for this skill")
    performance_label: PerformanceLabel = Field(..., description="Performance level classification")
    insight_text: str = Field(..., description="Context-aware insight text")
    next_step: NextStepAction = Field(..., description="Recommended next action")

    # Additional context for daily plan generation
    total_questions: Optional[int] = Field(None, description="Number of questions for this skill")
    correct_count: Optional[int] = Field(None, description="Number of correct answers")
    percentage: Optional[float] = Field(None, description="Performance percentage")

    # Hierarchical metadata
    unit_id: Optional[str] = Field(None, description="Unit identifier")
    unit_title: Optional[str] = Field(None, description="Unit title")
    subskills: Optional[List[Dict[str, Any]]] = Field(None, description="Subskill details")


class AssessmentFeedbackDocument(BaseModel):
    """
    Document schema for storing assessment feedback in Cosmos DB.
    This provides the "Secondary Driver (Assessment Feedback)" data source
    for the intelligent daily plan generation system.

    TTL: 30 days to ensure assessment insights remain available for subjects
    that may not be assessed frequently.
    """

    # Document identification
    id: str = Field(..., description="Document ID format: student_{student_id}_{subject}_assessment_feedback")
    student_id: int = Field(..., description="Student identifier")
    assessment_id: str = Field(..., description="Source assessment identifier")

    # Temporal metadata
    completed_at: str = Field(..., description="ISO timestamp when assessment was completed")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat(), description="When this feedback was created")

    # Subject context - critical for subject-specific daily plan synthesis
    subject: str = Field(..., description="Subject of the assessment (Mathematics, Language Arts, etc.)")

    # Assessment insights - the core data for daily plan generation
    insights: List[AssessmentSkillInsight] = Field(..., description="Skill-level insights from the assessment")

    # Assessment summary metadata
    total_questions: int = Field(..., description="Total questions in the assessment")
    correct_count: int = Field(..., description="Total correct answers")
    score_percentage: float = Field(..., description="Overall score percentage")

    # Daily plan synthesis metadata
    priority_skills: List[str] = Field(default_factory=list, description="Skill IDs that need immediate attention")
    weak_spot_skills: List[str] = Field(default_factory=list, description="Skills marked as WEAK_SPOT")
    developing_skills: List[str] = Field(default_factory=list, description="Skills marked as DEVELOPING")

    # Cosmos DB metadata
    ttl: int = Field(default=2592000, description="TTL in seconds (30 days)")  # 30 days * 24 hours * 60 minutes * 60 seconds

    # Optional Cosmos DB system fields
    _rid: Optional[str] = None
    _self: Optional[str] = None
    _etag: Optional[str] = None
    _attachments: Optional[str] = None
    _ts: Optional[int] = None


class AssessmentFeedbackSummary(BaseModel):
    """
    Simplified summary of assessment feedback for daily plan generation.
    Used when the full document structure is not needed.
    """
    student_id: int
    subject: str
    completed_at: str
    assessment_id: str

    # Key insights for daily plan prioritization
    weak_spot_skills: List[AssessmentSkillInsight] = Field(default_factory=list)
    developing_skills: List[AssessmentSkillInsight] = Field(default_factory=list)
    mastered_skills: List[AssessmentSkillInsight] = Field(default_factory=list)

    # Overall assessment context
    score_percentage: float
    days_since_completion: int


class SubjectAssessmentFeedbackMap(BaseModel):
    """
    Collection of assessment feedback organized by subject.
    This is the primary data structure passed to the AI recommendation service
    for daily plan synthesis.
    """
    student_id: int
    feedback_by_subject: Dict[str, AssessmentFeedbackSummary] = Field(default_factory=dict)
    subjects_with_recent_assessments: List[str] = Field(default_factory=list)
    subjects_without_assessments: List[str] = Field(default_factory=list)

    def has_feedback_for_subject(self, subject: str) -> bool:
        """Check if assessment feedback exists for a specific subject"""
        return subject in self.feedback_by_subject

    def get_priority_skills_for_subject(self, subject: str) -> List[str]:
        """Get priority skill IDs for a subject (WEAK_SPOT + DEVELOPING)"""
        if not self.has_feedback_for_subject(subject):
            return []

        feedback = self.feedback_by_subject[subject]
        priority_skills = []

        # Add weak spot skills (highest priority)
        for skill in feedback.weak_spot_skills:
            priority_skills.append(skill.skill_id)

        # Add developing skills (medium priority)
        for skill in feedback.developing_skills:
            priority_skills.append(skill.skill_id)

        return priority_skills


# Factory functions for creating assessment feedback documents

def create_assessment_feedback_id(student_id: int, subject: str) -> str:
    """
    Create standardized document ID for assessment feedback.
    Format: student_{student_id}_{subject}_assessment_feedback
    """
    # Normalize subject name for consistent IDs
    normalized_subject = subject.lower().replace(" ", "_").replace("-", "_")
    return f"student_{student_id}_{normalized_subject}_assessment_feedback"


def extract_insights_from_assessment_summary(
    assessment_summary: Dict[str, Any]
) -> List[AssessmentSkillInsight]:
    """
    Extract skill insights from EnhancedAssessmentSummaryResponse for storage.
    Converts the assessment summary skill analysis into our feedback schema.
    """
    insights = []

    # Extract from skill_analysis if available (new structure)
    skill_analysis = assessment_summary.get("skill_analysis", [])
    for skill_item in skill_analysis:
        insight = AssessmentSkillInsight(
            skill_id=skill_item.get("skill_id", ""),
            skill_name=skill_item.get("skill_name", ""),
            assessment_focus_tag=skill_item.get("assessment_focus_tag", AssessmentFocusTag.GENERAL),
            performance_label=skill_item.get("performance_label", PerformanceLabel.DEVELOPING),
            insight_text=skill_item.get("insight_text", ""),
            next_step=skill_item.get("next_step", {
                "text": "Continue practicing",
                "link": "/practice",
                "action_type": "practice"
            }),
            total_questions=skill_item.get("total_questions"),
            correct_count=skill_item.get("correct_count"),
            percentage=skill_item.get("percentage"),
            unit_id=skill_item.get("unit_id"),
            unit_title=skill_item.get("unit_title"),
            subskills=skill_item.get("subskills")
        )
        insights.append(insight)

    # Fallback to legacy skill_breakdown if needed
    if not insights:
        skill_breakdown = assessment_summary.get("skill_breakdown", [])
        for skill_item in skill_breakdown:
            insight = AssessmentSkillInsight(
                skill_id=skill_item.get("skill_id", ""),
                skill_name=skill_item.get("skill_name", ""),
                assessment_focus_tag=AssessmentFocusTag.GENERAL,
                performance_label=PerformanceLabel.DEVELOPING,
                insight_text=f"Performance on {skill_item.get('skill_name', 'this skill')}",
                next_step={
                    "text": "Continue practicing",
                    "link": "/practice",
                    "action_type": "practice"
                },
                total_questions=skill_item.get("total_questions"),
                correct_count=skill_item.get("correct_count"),
                percentage=skill_item.get("percentage")
            )
            insights.append(insight)

    return insights


def create_assessment_feedback_document(
    student_id: int,
    assessment_id: str,
    subject: str,
    assessment_summary: Dict[str, Any]
) -> AssessmentFeedbackDocument:
    """
    Create a complete assessment feedback document from assessment summary results.
    This is the main factory function used by the assessment service.
    """

    # Extract insights
    insights = extract_insights_from_assessment_summary(assessment_summary)

    # Categorize skills by performance for quick lookup
    weak_spot_skills = []
    developing_skills = []

    for insight in insights:
        if insight.assessment_focus_tag == AssessmentFocusTag.WEAK_SPOT:
            weak_spot_skills.append(insight.skill_id)
        elif insight.performance_label == PerformanceLabel.NEEDS_REVIEW:
            weak_spot_skills.append(insight.skill_id)
        elif insight.performance_label == PerformanceLabel.DEVELOPING:
            developing_skills.append(insight.skill_id)

    # Create priority skills list (weak spots first, then developing)
    priority_skills = weak_spot_skills + developing_skills

    # Build the document
    document = AssessmentFeedbackDocument(
        id=create_assessment_feedback_id(student_id, subject),
        student_id=student_id,
        assessment_id=assessment_id,
        completed_at=assessment_summary.get("submitted_at", datetime.utcnow().isoformat()),
        subject=subject,
        insights=insights,
        total_questions=assessment_summary.get("total_questions", 0),
        correct_count=assessment_summary.get("correct_count", 0),
        score_percentage=assessment_summary.get("score_percentage", 0.0),
        priority_skills=priority_skills,
        weak_spot_skills=weak_spot_skills,
        developing_skills=developing_skills
    )

    return document