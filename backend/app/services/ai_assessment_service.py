"""
AI Assessment Service for Enhanced Assessment Feedback

This service generates AI-powered summaries and insights for completed assessments,
following the Enhanced Assessment Feedback PRD requirements and existing structured JSON patterns.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from google.genai.types import Schema, GenerateContentConfig

from .ai_service_factory import AIServiceFactory
from ..schemas.assessment_review import (
    AssessmentReviewDocument,
    AssessmentProblemReview,
    AssessmentFocusTag,
    PerformanceLabel,
    NextStepAction,
    EnhancedSkillAnalysis,
    SubskillDetail
)

logger = logging.getLogger(__name__)

# Optimized Assessment Summary Schema - LLM generates insights, backend computes data
ASSESSMENT_AI_INSIGHTS_SCHEMA = Schema(
    type="object",
    properties={
        # LLM-driven narrative content
        "ai_summary": Schema(
            type="string",
            description="AI-generated holistic summary of student performance (2-3 sentences)"
        ),
        "performance_quote": Schema(
            type="string",
            description="Dynamic, encouraging one-sentence summary of overall performance"
        ),

        # LLM-driven skill insights (minimal, focused on subskill_id for data joining)
        "skill_insights": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "subskill_id": Schema(type="string", description="Subskill identifier for joining with data"),
                    "insight_text": Schema(
                        type="string",
                        description="Actionable insight about performance in this skill, referencing the assessment focus"
                    ),
                    "next_step_text": Schema(
                        type="string",
                        description="Recommended next step action text"
                    )
                },
                required=["subskill_id", "insight_text", "next_step_text"]
            ),
            description="AI insights for each skill, joined by subskill_id"
        ),

        # LLM-driven pattern recognition
        "common_misconceptions": Schema(
            type="array",
            items=Schema(
                type="string",
                description="Common misconception or pattern identified across incorrect answers"
            ),
            description="Patterns of misunderstanding identified across incorrect responses"
        ),

        # LLM-driven problem analysis (minimal, focused on problem_id for joining)
        "problem_insights": Schema(
            type="array",
            items=Schema(
                type="object",
                properties={
                    "problem_id": Schema(type="string", description="Problem identifier for joining"),
                    "analysis": Schema(
                        type="object",
                        properties={
                            "understanding": Schema(type="string", description="Analysis of student's understanding"),
                            "approach": Schema(type="string", description="Student's problem-solving approach")
                        },
                        required=["understanding", "approach"]
                    ),
                    "feedback": Schema(
                        type="object",
                        properties={
                            "praise": Schema(type="string", description="Positive feedback"),
                            "guidance": Schema(type="string", description="Guidance for improvement"),
                            "encouragement": Schema(type="string", description="Encouraging message")
                        },
                        required=["praise", "guidance", "encouragement"]
                    )
                },
                required=["problem_id", "analysis", "feedback"]
            ),
            description="AI analysis for problems, joined by problem_id"
        )
    },
    required=["ai_summary", "performance_quote", "skill_insights", "common_misconceptions", "problem_insights"]
)


class AIAssessmentService:
    """Service for generating AI-powered assessment feedback and summaries"""

    def __init__(self):
        self.ai_service = AIServiceFactory.get_service("gemini")

    async def generate_enhanced_assessment_summary(
        self,
        blueprint: Dict[str, Any],
        submission_result: Dict[str, Any],
        review_items_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate comprehensive AI-powered assessment summary following PRD requirements.

        This method generates AI insights and merges them with computed data fields for optimal efficiency.

        Args:
            blueprint: The original assessment blueprint with category breakdown and selected subskills
            submission_result: The final assessment results including score and skill breakdown
            review_items_data: List of detailed review data from problem_review documents

        Returns:
            Enhanced assessment summary with AI insights merged with computed data
        """
        logger.info(f"AI ASSESSMENT DEBUG - Input data:")
        logger.info(f"  review_items_data length: {len(review_items_data)}")
        for i, item in enumerate(review_items_data):
            logger.info(f"  item {i}: problem_id={item.get('problem_id', 'unknown')}, problem_type={item.get('problem_content', {}).get('problem_type', 'unknown')}")

        try:
            # Extract key information
            subject = blueprint.get('subject', 'Unknown Subject')
            category_breakdown = blueprint.get('category_breakdown', {})
            selected_subskills = blueprint.get('selected_subskills', [])

            score_percentage = submission_result.get('score_percentage', 0)
            correct_count = submission_result.get('correct_count', 0)
            total_questions = submission_result.get('total_questions', 0)
            skill_breakdown = submission_result.get('skill_breakdown', [])

            # Build comprehensive context for AI
            context = self._build_assessment_context(
                subject, category_breakdown, selected_subskills,
                score_percentage, correct_count, total_questions, skill_breakdown, review_items_data
            )

            prompt = f"""
You are an expert kindergarten tutor analyzing a completed assessment. Generate AI insights for student performance with a focus on HOLISTIC patterns and individual learning needs.

ASSESSMENT CONTEXT:
{context}

GENERATE COMPREHENSIVE INSIGHTS:

1. **ai_summary**: A friendly, encouraging 2-3 sentence narrative summary that addresses:
   - Overall performance patterns (including completion behavior if relevant)
   - How they performed on their learning goals (weak spots, new frontiers, etc.)
   - Key strengths and areas for growth
   - If problems were skipped, acknowledge this thoughtfully without judgment

2. **performance_quote**: One encouraging sentence that reflects their actual engagement and effort

3. **skill_insights**: For each subskill tested, provide:
   - subskill_id: Use the EXACT subskill identifier from "SUBSKILLS TESTED" section above (e.g., "SS002-01-B", NOT generic names)
   - insight_text: Actionable insight referencing assessment focus AND engagement patterns
   - next_step_text: Recommended action that considers both performance and confidence

4. **common_misconceptions**: Identify patterns across the assessment including:
   - Conceptual misunderstandings from incorrect answers
   - Engagement patterns (e.g., "Student appears to lose confidence on harder problems")
   - Limit to 2-3 key patterns that inform instruction

5. **problem_insights**: For each problem, provide analysis and feedback:
   - problem_id: Use the EXACT problem identifier from "DETAILED PROBLEM REVIEWS" section above
   - analysis: Understanding and approach (acknowledge if not attempted)
   - feedback: Appropriate praise, guidance, and encouragement for the response given

HOLISTIC ANALYSIS PRIORITIES:
- Notice and comment on overall engagement patterns (completion rate, confidence)
- If student skipped multiple problems, address this constructively
- Reference assessment categories (weak spots, new frontiers) meaningfully
- Focus on building confidence and learning motivation
- Use kindergarten-appropriate, encouraging language
- Provide actionable next steps that consider both skill gaps and engagement
"""

            # Generate AI insights using optimized schema
            response = await self.ai_service.client.aio.models.generate_content(
                model='gemini-2.5-flash-preview-05-20',
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    response_schema=ASSESSMENT_AI_INSIGHTS_SCHEMA,
                    temperature=0.7,
                    max_output_tokens=10000  # Increased to prevent JSON truncation
                )
            )

            ai_insights = self._safe_json_loads(response.text, "AI assessment insights")

            # Merge AI insights with computed data to create final summary
            enhanced_summary = self._merge_insights_with_data(
                ai_insights, blueprint, submission_result, review_items_data
            )

            logger.info(f"Generated enhanced assessment summary with {len(enhanced_summary.get('skill_insights', []))} skills and {len(enhanced_summary.get('review_items', []))} review items")
            return enhanced_summary

        except Exception as e:
            logger.error(f"Error generating enhanced assessment summary: {e}")
            # Generate fallback AI insights and merge with data
            fallback_insights = self._generate_fallback_ai_insights(submission_result, review_items_data)
            return self._merge_insights_with_data(
                fallback_insights, blueprint, submission_result, review_items_data
            )

    def _build_assessment_context(
        self,
        subject: str,
        category_breakdown: Dict[str, int],
        selected_subskills: List[Dict],
        score_percentage: float,
        correct_count: int,
        total_questions: int,
        skill_breakdown: List[Dict],
        review_items_data: List[Dict]
    ) -> str:
        """Build comprehensive context for AI prompt with holistic analysis"""

        context_parts = [
            f"Subject: {subject}",
            f"Overall Score: {correct_count}/{total_questions} ({score_percentage:.1f}%)"
        ]

        # HOLISTIC ASSESSMENT ANALYSIS
        if review_items_data:
            total_problems = len(review_items_data)
            answered_problems = len([r for r in review_items_data if self._is_problem_answered(r)])
            skipped_problems = total_problems - answered_problems
            correct_answers = len([r for r in review_items_data if self._extract_correctness(r)])
            incorrect_answers = answered_problems - correct_answers

            context_parts.append("\nHOLISTIC ASSESSMENT SUMMARY:")
            context_parts.append(f"Total Problems: {total_problems}")
            context_parts.append(f"Problems Answered: {answered_problems}")
            context_parts.append(f"Problems Skipped: {skipped_problems}")
            context_parts.append(f"Correct Answers: {correct_answers}")
            context_parts.append(f"Incorrect Answers: {incorrect_answers}")

            if skipped_problems > 0:
                context_parts.append(f"\n⚠️ ENGAGEMENT PATTERN: Student left {skipped_problems} questions unanswered")
                if skipped_problems > total_problems * 0.3:  # More than 30% skipped
                    context_parts.append("This suggests possible time pressure, confidence issues, or difficulty level mismatch")

        # Add assessment focus areas
        if category_breakdown:
            focus_areas = []
            for category, count in category_breakdown.items():
                if count > 0:
                    category_name = category.replace('_', ' ').title()
                    focus_areas.append(f"{count} {category_name}")

            if focus_areas:
                context_parts.append(f"\nAssessment Focus: {', '.join(focus_areas)}")

        # Add skill performance
        if skill_breakdown:
            context_parts.append("\nSKILL PERFORMANCE:")
            for skill in skill_breakdown:
                skill_name = skill.get('skill_name', 'Unknown')
                correct = skill.get('correct_answers', 0)
                total = skill.get('total_questions', 0)
                percentage = skill.get('percentage', 0)
                context_parts.append(f"- {skill_name}: {correct}/{total} ({percentage}%)")

        # Add subskills tested with their categories for narrative context
        # CRITICAL FIX: Extract actual subskill IDs from review_items_data to ensure AI gets the right IDs
        actual_subskills_tested = set()
        subskill_id_to_category = {}

        if review_items_data:
            for review_item in review_items_data:
                actual_subskill_id = review_item.get('subskill_id')
                if actual_subskill_id and actual_subskill_id != 'unknown':
                    actual_subskills_tested.add(actual_subskill_id)

                    # Try to find the category from blueprint data
                    matching_blueprint_subskill = None
                    for subskill in selected_subskills:
                        if (subskill.get('subskill_id') == actual_subskill_id or
                            subskill.get('skill_id') == actual_subskill_id):
                            matching_blueprint_subskill = subskill
                            break

                    if matching_blueprint_subskill:
                        subskill_id_to_category[actual_subskill_id] = matching_blueprint_subskill.get('category', 'general')
                    else:
                        subskill_id_to_category[actual_subskill_id] = 'general'

        if actual_subskills_tested:
            context_parts.append("\nSUBSKILLS TESTED (with actual IDs for AI insights):")
            for actual_subskill_id in sorted(actual_subskills_tested):
                # Find description from blueprint or use the ID
                description = actual_subskill_id  # fallback
                category = subskill_id_to_category.get(actual_subskill_id, 'general')

                # Try to find description from blueprint
                for subskill in selected_subskills:
                    if (subskill.get('subskill_id') == actual_subskill_id or
                        subskill.get('skill_id') == actual_subskill_id):
                        description = subskill.get('subskill_description') or subskill.get('skill_description', actual_subskill_id)
                        break

                context_parts.append(f"- {actual_subskill_id}: {description} (Category: {category})")

            # Group by category for narrative understanding
            category_skills = {}
            for subskill_id in actual_subskills_tested:
                category = subskill_id_to_category.get(subskill_id, 'general')
                if category not in category_skills:
                    category_skills[category] = []
                category_skills[category].append(subskill_id)

            if category_skills:
                context_parts.append("\nSKILLS BY ASSESSMENT FOCUS:")
                for category, skill_ids in category_skills.items():
                    category_name = category.replace('_', ' ').title()
                    context_parts.append(f"- {category_name}: {', '.join(skill_ids[:3])}")  # First 3 skill IDs per category
        elif selected_subskills:
            # Fallback to blueprint data if review items don't have subskill IDs
            context_parts.append("\nSUBSKILLS TESTED (from blueprint - FALLBACK):")
            for subskill in selected_subskills:
                subskill_id = subskill.get('subskill_id', 'unknown')
                desc = subskill.get('subskill_description') or subskill.get('skill_description', '')
                category = subskill.get('category', 'general')
                if desc:
                    context_parts.append(f"- {subskill_id}: {desc} (Category: {category})")
                    actual_subskills_tested.add(subskill_id)
                    subskill_id_to_category[subskill_id] = category

        # Add detailed problem analysis - now with structured data support
        if review_items_data:
            context_parts.append("\nDETAILED PROBLEM REVIEWS:")
            for i, review_item in enumerate(review_items_data):
                # Handle both structured AssessmentReviewDocument and legacy dict formats
                problem_content = self._extract_problem_content(review_item)
                question = self._extract_question_text(problem_content)
                is_correct = self._extract_correctness(review_item)
                score = self._extract_score(review_item)
                student_answer = self._extract_student_answer(review_item)
                correct_answer = self._extract_correct_answer(problem_content)

                status = "✓" if is_correct else "✗"
                answer_status = "(No Answer)" if student_answer in ["Not answered", "No answer", "Not Answered"] else ""

                context_parts.append(f"Problem {i+1} {status} (Score: {score}) {answer_status}:")
                context_parts.append(f"  Question: {question}")
                context_parts.append(f"  Student Answer: {student_answer}")
                context_parts.append(f"  Correct Answer: {correct_answer}")
                context_parts.append("")  # Add spacing

        return '\n'.join(context_parts)

    def _merge_insights_with_data(
        self,
        ai_insights: Dict[str, Any],
        blueprint: Dict[str, Any],
        submission_result: Dict[str, Any],
        review_items_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Merge AI-generated insights with computed data fields to create final assessment summary.
        This separates thought-driven tasks (AI) from data-driven tasks (backend computation).
        """
        category_breakdown = blueprint.get('category_breakdown', {})
        skill_breakdown = submission_result.get('skill_breakdown', [])

        # Get subject for practice links
        subject = blueprint.get('subject', 'mathematics')

        # Start with AI insights
        enhanced_summary = {
            "ai_summary": ai_insights.get("ai_summary", ""),
            "performance_quote": ai_insights.get("performance_quote", ""),
            "common_misconceptions": ai_insights.get("common_misconceptions", []),
            "skill_insights": []
        }

        # Build skill_insights by merging AI insights with computed data
        skill_insights_map = {
            insight.get("subskill_id"): insight
            for insight in ai_insights.get("skill_insights", [])
        }

        logger.info(f"AI ASSESSMENT DEBUG - skill_insights_map: {skill_insights_map}")

        # Create mapping from skill_description to subskill_id from blueprint
        selected_subskills = blueprint.get('selected_subskills', [])
        skill_to_subskill_map = {}
        for subskill in selected_subskills:
            skill_desc = subskill.get('skill_description')
            subskill_id = subskill.get('subskill_id')
            if skill_desc and subskill_id:
                skill_to_subskill_map[skill_desc] = subskill_id

        logger.info(f"AI ASSESSMENT DEBUG - skill_to_subskill_map: {skill_to_subskill_map}")
        logger.info(f"AI ASSESSMENT DEBUG - skill_breakdown length: {len(skill_breakdown)}")
        logger.info(f"AI ASSESSMENT DEBUG - skill_breakdown: {skill_breakdown}")

        if not skill_breakdown:
            logger.warning(f"AI ASSESSMENT DEBUG - No skill breakdown data found! submission_result keys: {list(submission_result.keys())}")
            logger.warning(f"AI ASSESSMENT DEBUG - submission_result: {submission_result}")

        # CRITICAL FIX: Aggregate by skill_id, not subskill_id
        # Group subskills by their parent skill_id
        skills_tested = {}

        for review_item in review_items_data:
            subskill_id = review_item.get('subskill_id')
            if not subskill_id or subskill_id == 'unknown':
                continue

            # Find the parent skill_id for this subskill
            parent_skill_id = None
            subskill_info = None
            for subskill in selected_subskills:
                if subskill.get('subskill_id') == subskill_id:
                    parent_skill_id = subskill.get('skill_id', subskill_id)
                    subskill_info = subskill
                    break

            if not parent_skill_id:
                continue

            # Initialize skill entry if not exists
            if parent_skill_id not in skills_tested:
                skills_tested[parent_skill_id] = {
                    'skill_id': parent_skill_id,
                    'skill_description': subskill_info.get('skill_description', 'Unknown Skill'),
                    'unit_id': subskill_info.get('unit_id', 'unknown'),
                    'unit_title': subskill_info.get('unit_title', 'Unknown Unit'),
                    'category': subskill_info.get('category', 'general'),
                    'total_questions': 0,
                    'correct_count': 0,
                    'subskills': {}
                }

            # Track subskill details within parent skill
            if subskill_id not in skills_tested[parent_skill_id]['subskills']:
                skills_tested[parent_skill_id]['subskills'][subskill_id] = SubskillDetail(
                    subskill_id=subskill_id,
                    subskill_description=subskill_info.get('subskill_description', 'Unknown Subskill'),
                    questions=0,
                    correct=0
                )

            # Aggregate performance
            skills_tested[parent_skill_id]['total_questions'] += 1
            skills_tested[parent_skill_id]['subskills'][subskill_id].questions += 1

            if self._extract_correctness(review_item):
                skills_tested[parent_skill_id]['correct_count'] += 1
                skills_tested[parent_skill_id]['subskills'][subskill_id].correct += 1

        logger.info(f"AI ASSESSMENT DEBUG - Skills tested (aggregated): {list(skills_tested.keys())}")

        # Process each skill (not subskill) for analysis
        for skill_id, skill_data in skills_tested.items():
            logger.info(f"AI ASSESSMENT DEBUG - Processing skill: {skill_id}")

            # Get AI insights if available (check both skill and subskill insights)
            ai_insight = skill_insights_map.get(skill_id, {})

            # If no skill-level insight, try to get from first subskill
            if not ai_insight and skill_data['subskills']:
                first_subskill_id = next(iter(skill_data['subskills'].keys()))
                ai_insight = skill_insights_map.get(first_subskill_id, {})

            # Calculate aggregated performance
            total_questions = skill_data['total_questions']
            correct_count = skill_data['correct_count']
            percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0

            # Map to enhanced schema types
            category = skill_data['category']
            focus_tag = self._map_category_to_focus_tag(category)
            performance_label = self._compute_performance_label(percentage)

            logger.info(f"AI ASSESSMENT DEBUG - Skill {skill_id}: {correct_count}/{total_questions} ({percentage}%)")

            # Generate contextual insight and next step using AI insight + fallback logic
            ai_insight_text = ai_insight.get("insight_text", "")
            ai_next_step_text = ai_insight.get("next_step_text", "")

            contextual_insight = self._generate_contextual_insight(focus_tag, performance_label, ai_insight_text)

            # For next step, recommend the subskill that needs the most work
            worst_performing_subskill = min(
                skill_data['subskills'].values(),
                key=lambda s: (s.correct / s.questions) if s.questions > 0 else 0
            )
            target_subskill_id = worst_performing_subskill.subskill_id

            next_step_action = self._generate_next_step_action(focus_tag, performance_label, target_subskill_id, subject, ai_next_step_text)

            # Create enhanced skill analysis with subskill details
            skill_analysis = EnhancedSkillAnalysis(
                skill_id=skill_id,
                skill_name=skill_data['skill_description'],
                total_questions=total_questions,
                correct_count=correct_count,
                assessment_focus_tag=focus_tag,
                performance_label=performance_label,
                insight_text=contextual_insight,
                next_step=next_step_action,
                percentage=int(percentage),
                category=category,
                unit_id=skill_data['unit_id'],
                unit_title=skill_data['unit_title'],
                subskills=list(skill_data['subskills'].values())  # Include all subskills tested
            )

            # Convert to dict for JSON serialization
            enhanced_summary["skill_insights"].append(skill_analysis.dict())

        return enhanced_summary

    def _find_subskill_id_for_skill(self, skill_name: str, review_items_data: List[Dict[str, Any]]) -> str:
        """Find the subskill_id associated with a skill name from review data."""
        for review_data in review_items_data:
            # Handle structured AssessmentReviewDocument format - check direct subskill_id field first
            if 'subskill_id' in review_data:
                subskill_id = review_data.get('subskill_id', '')
                if subskill_id:
                    return subskill_id

            # Check problem_content for skill matching
            problem_content = review_data.get('problem_content', {})

            # Try multiple skill field names from the new schema
            skill_description = (
                problem_content.get('skill_description') or
                problem_content.get('assessment_metadata', {}).get('skill_description') or
                problem_content.get('metadata', {}).get('skill_description') or
                ''
            )

            if skill_description == skill_name:
                return (
                    review_data.get('subskill_id') or
                    problem_content.get('subskill_id') or
                    problem_content.get('assessment_metadata', {}).get('subskill_id') or
                    ''
                )

        # If no match found, return the first available subskill_id as fallback
        for review_data in review_items_data:
            subskill_id = (
                review_data.get('subskill_id') or
                review_data.get('problem_content', {}).get('subskill_id') or
                ''
            )
            if subskill_id:
                return subskill_id

        return ''

    def _determine_assessment_focus(self, skill_name: str, category_breakdown: Dict[str, int], blueprint: Dict[str, Any]) -> AssessmentFocusTag:
        """Determine assessment focus category for a skill based on blueprint data."""
        selected_subskills = blueprint.get('selected_subskills', [])
        for subskill in selected_subskills:
            if (subskill.get('skill_description') == skill_name or
                subskill.get('subskill_description') == skill_name):
                category = subskill.get('category', 'general')
                return self._map_category_to_focus_tag(category)
        return AssessmentFocusTag.GENERAL

    def _compute_performance_label(self, percentage: float) -> PerformanceLabel:
        """Compute performance label based on percentage score."""
        if percentage == 100:
            return PerformanceLabel.MASTERED
        elif percentage >= 75:
            return PerformanceLabel.PROFICIENT
        elif percentage >= 50:
            return PerformanceLabel.DEVELOPING
        else:
            return PerformanceLabel.NEEDS_REVIEW

    def _map_category_to_focus_tag(self, category: str) -> AssessmentFocusTag:
        """Map internal category to visual focus tag."""
        category_mapping = {
            'weak_spots': AssessmentFocusTag.WEAK_SPOT,
            'recent_practice': AssessmentFocusTag.RECENT_PRACTICE,
            'foundational_review': AssessmentFocusTag.FOUNDATIONAL_REVIEW,
            'new_frontiers': AssessmentFocusTag.NEW_FRONTIER,
            'foundational_cold_start': AssessmentFocusTag.GENERAL
        }
        return category_mapping.get(category, AssessmentFocusTag.GENERAL)

    def _generate_contextual_insight(self, focus_tag: AssessmentFocusTag, performance_label: PerformanceLabel, ai_insight: str = "") -> str:
        """Generate context-aware insight based on assessment focus and performance combination."""

        # Use AI insight if available, otherwise fall back to rule-based system
        if ai_insight and ai_insight.strip():
            return ai_insight

        # Rule-based insight matrix for 16 possible combinations
        insight_matrix = {
            # Weak Spots
            (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.MASTERED):
                "Amazing! This was a tricky topic for you, but you've mastered it. Your hard work is paying off!",
            (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.PROFICIENT):
                "Great progress! You're doing much better with this challenging topic. Just a little more practice to master it completely.",
            (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.DEVELOPING):
                "You're making progress on this challenging topic! Keep practicing the fundamentals to build stronger understanding.",
            (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.NEEDS_REVIEW):
                "This topic has been tricky for you. Let's break it down step by step and work on the basics together.",

            # Recent Practice
            (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.MASTERED):
                "Excellent! Your recent practice has really paid off - you've mastered this skill completely.",
            (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.PROFICIENT):
                "Great job! Your recent practice is working well. You have a solid grasp with just minor details to polish.",
            (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.DEVELOPING):
                "You're so close! Your recent practice shows you understand the basics. Let's iron out the last few details.",
            (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.NEEDS_REVIEW):
                "Your recent practice is a good start, but this concept needs more time to stick. Let's review the key points.",

            # Foundational Review
            (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.MASTERED):
                "Perfect! You've maintained your mastery of this important foundational skill. Well done!",
            (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.PROFICIENT):
                "Good retention! You mostly remember this foundational skill, with just a few areas to touch up.",
            (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.DEVELOPING):
                "This foundational skill has gotten a bit rusty. A quick review will help bring it back to full strength.",
            (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.NEEDS_REVIEW):
                "It looks like this foundational skill needs refreshing. Let's review the basics to rebuild this important foundation.",

            # New Frontier
            (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.MASTERED):
                "Wow! You've mastered this brand new concept on your first try. You're really ready for new challenges!",
            (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.PROFICIENT):
                "Impressive! You picked up this new concept quickly and did very well for your first time trying it.",
            (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.DEVELOPING):
                "Good first attempt! You're getting the hang of this new concept. It takes time to master something completely new.",
            (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.NEEDS_REVIEW):
                "This is a brand new topic, so it's perfectly normal to be learning the ropes. Taking the first step is what counts!"
        }

        return insight_matrix.get((focus_tag, performance_label),
                                "You're making progress on this topic. Keep practicing to improve your understanding!")

    def _generate_next_step_action(self, focus_tag: AssessmentFocusTag, performance_label: PerformanceLabel, subskill_id: str, subject: str, ai_next_step: str = "") -> NextStepAction:
        """Generate appropriate next step action based on context."""

        # Use AI-generated next step if available
        if ai_next_step and ai_next_step.strip():
            action_text = ai_next_step
        else:
            # Rule-based next step matrix
            action_matrix = {
                # Weak Spots
                (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.MASTERED): ("Challenge Yourself", "challenge"),
                (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.PROFICIENT): ("Practice More Problems", "practice"),
                (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.DEVELOPING): ("Review Key Concepts", "review"),
                (AssessmentFocusTag.WEAK_SPOT, PerformanceLabel.NEEDS_REVIEW): ("Learn the Basics", "learn"),

                # Recent Practice
                (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.MASTERED): ("Try Advanced Problems", "challenge"),
                (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.PROFICIENT): ("Practice More Problems", "practice"),
                (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.DEVELOPING): ("Practice More Problems", "practice"),
                (AssessmentFocusTag.RECENT_PRACTICE, PerformanceLabel.NEEDS_REVIEW): ("Review Recent Lessons", "review"),

                # Foundational Review
                (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.MASTERED): ("Move to Advanced Topics", "challenge"),
                (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.PROFICIENT): ("Quick Practice Session", "practice"),
                (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.DEVELOPING): ("Refresh this Skill", "review"),
                (AssessmentFocusTag.FOUNDATIONAL_REVIEW, PerformanceLabel.NEEDS_REVIEW): ("Refresh this Skill", "review"),

                # New Frontier
                (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.MASTERED): ("Explore Related Topics", "challenge"),
                (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.PROFICIENT): ("Practice New Skill", "practice"),
                (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.DEVELOPING): ("Practice New Skill", "practice"),
                (AssessmentFocusTag.NEW_FRONTIER, PerformanceLabel.NEEDS_REVIEW): ("Learn the Basics", "learn")
            }

            action_text, action_type = action_matrix.get((focus_tag, performance_label), ("Continue Learning", "learn"))

        # Generate appropriate link
        link = f"/practice/{subskill_id}?subject={subject.lower().replace(' ', '-')}"

        return NextStepAction(
            text=action_text,
            link=link,
            action_type=action_type if not ai_next_step else "learn"
        )

    def _extract_correct_answer(self, problem_content: Dict[str, Any]) -> str:
        """Extract the correct answer from problem content."""
        if 'correct' in problem_content:
            return "True" if problem_content['correct'] else "False"
        elif problem_content.get('correct_option_id') and problem_content.get('options'):
            correct_option_id = problem_content.get('correct_option_id')
            options = problem_content.get('options', [])
            correct_option = next((opt for opt in options if opt.get('id') == correct_option_id), None)
            return correct_option.get('text', 'Answer not available') if correct_option else 'Answer not available'
        elif problem_content.get('blanks'):
            blanks = problem_content.get('blanks', [])
            correct_answers = [blank.get('correct_answers', [blank.get('answer', '')]) for blank in blanks]
            # Flatten list of lists and filter empty values
            all_answers = [ans for sublist in correct_answers for ans in (sublist if isinstance(sublist, list) else [sublist]) if ans]
            return ', '.join(all_answers) if all_answers else 'Answer not available'
        elif problem_content.get('categorization_items'):
            # Handle categorization problems
            categorization_items = problem_content.get('categorization_items', [])
            correct_categorizations = {}
            for item in categorization_items:
                item_text = item.get('item_text')
                correct_category = item.get('correct_category')
                if item_text and correct_category:
                    correct_categorizations[item_text] = correct_category
            return str(correct_categorizations) if correct_categorizations else 'Answer not available'
        else:
            return "Answer not available"

    def _is_problem_answered(self, review_item: Dict[str, Any]) -> bool:
        """Check if a problem was answered by the student"""
        student_answer = self._extract_student_answer(review_item)
        return student_answer not in ["Not answered", "No answer", "Not Answered", "", None]

    def _extract_problem_content(self, review_item: Dict[str, Any]) -> Dict[str, Any]:
        """Extract problem content from either structured or legacy review format"""
        if isinstance(review_item, dict):
            return review_item.get('problem_content', {})
        return {}

    def _extract_question_text(self, problem_content: Dict[str, Any]) -> str:
        """Extract question text from problem content"""
        # Check for different question field types based on problem type
        problem_type = problem_content.get('problem_type', '')

        if problem_type == 'fill_in_blanks':
            return problem_content.get('text_with_blanks', 'Question not available')
        elif problem_type == 'true_false':
            return problem_content.get('statement', 'Question not available')
        elif problem_type == 'multiple_choice':
            return problem_content.get('question', 'Question not available')
        elif problem_type == 'matching_activity':
            return problem_content.get('prompt', 'Question not available')
        elif problem_type == 'categorization_activity':
            return problem_content.get('instruction', 'Question not available')
        elif problem_type == 'scenario_question':
            return problem_content.get('scenario_question', 'Question not available')
        else:
            # Fallback to checking all possible fields
            return (
                problem_content.get('question') or
                problem_content.get('statement') or
                problem_content.get('prompt') or
                problem_content.get('instruction') or
                problem_content.get('text_with_blanks') or
                problem_content.get('scenario_question') or
                'Question not available'
            )

    def _extract_correctness(self, review_item: Dict[str, Any]) -> bool:
        """Extract correctness from review item"""
        # Try structured format first
        if 'correct' in review_item:
            return review_item.get('correct', False)
        # Try legacy format
        return review_item.get('is_correct', False)

    def _extract_score(self, review_item: Dict[str, Any]) -> int:
        """Extract score from review item"""
        return review_item.get('score', 0)

    def _extract_student_answer(self, review_item: Dict[str, Any]) -> str:
        """Extract student answer from review item - handles both structured and legacy formats"""
        logger.info(f"    _extract_student_answer DEBUG for problem {review_item.get('problem_id', 'unknown')}:")
        logger.info(f"      checking your_answer_text: {review_item.get('your_answer_text', 'not found')}")
        logger.info(f"      checking selected_answer_text: {review_item.get('selected_answer_text', 'not found')}")

        # Try direct answer fields first (for categorization and other structured problems)
        if 'your_answer_text' in review_item:
            answer = review_item.get('your_answer_text', 'No answer')
            if answer and answer != 'No answer':
                logger.info(f"      returning your_answer_text: {answer}")
                return answer

        if 'selected_answer_text' in review_item:
            answer = review_item.get('selected_answer_text', 'No answer')
            if answer and answer != 'No answer':
                logger.info(f"      returning selected_answer_text: {answer}")
                return answer

        # Try structured observation format
        if 'observation' in review_item:
            observation = review_item['observation']
            logger.info(f"      checking observation: {observation}")
            if isinstance(observation, dict):
                answer = observation.get('selected_answer', 'No answer')
                if answer and answer != 'No answer':
                    logger.info(f"      returning observation.selected_answer: {answer}")
                    return answer

        # Try legacy format
        student_answer = review_item.get('student_answer', 'No answer')
        logger.info(f"      checking student_answer: {student_answer}")
        if student_answer and student_answer != 'No answer':
            logger.info(f"      returning student_answer: {student_answer}")
            return student_answer

        logger.info(f"      returning default: No answer")
        return 'No answer'

    def _safe_json_loads(self, response_text: str, operation: str) -> Dict[str, Any]:
        """Safely parse JSON response with error handling"""
        try:
            import json
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {operation}: {e}")
            logger.error(f"Response text: {response_text[:500]}...")
            raise ValueError(f"Invalid JSON response from AI service during {operation}")

    def _generate_fallback_ai_insights(
        self,
        submission_result: Dict[str, Any],
        review_items_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate fallback AI insights if AI generation fails"""
        score_percentage = submission_result.get('score_percentage', 0)
        skill_breakdown = submission_result.get('skill_breakdown', [])

        return {
            "ai_summary": self._generate_fallback_ai_summary(submission_result, review_items_data),
            "performance_quote": self._generate_performance_quote(score_percentage),
            "skill_insights": self._generate_fallback_skill_insights(skill_breakdown, review_items_data),
            "common_misconceptions": self._generate_basic_misconceptions(review_items_data),
            "problem_insights": self._generate_fallback_problem_insights(review_items_data)
        }

    def _generate_fallback_skill_insights(
        self,
        skill_breakdown: List[Dict[str, Any]],
        review_items_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate fallback skill insights using performance-based logic"""
        insights = []
        for skill in skill_breakdown:
            skill_name = skill.get('skill_name', 'Unknown Skill')
            percentage = skill.get('percentage', 0)
            subskill_id = self._find_subskill_id_for_skill(skill_name, review_items_data)

            # Generate performance-based insights (no context-aware logic in fallback)
            if percentage == 100:
                insight_text = "You've mastered this skill. You consistently applied the concepts correctly."
                next_step_text = "Practice a related skill"
            elif percentage >= 75:
                insight_text = "You are proficient in this skill. You have a good handle on the main concepts but made a small slip."
                next_step_text = "Review incorrect answers"
            elif percentage >= 50:
                insight_text = "You are developing this skill. You understand some of the concepts but are missing some key ideas."
                next_step_text = "Review incorrect answers"
            else:
                insight_text = "This skill needs review. Let's go back to the fundamentals to build a stronger foundation."
                next_step_text = "Re-learn this concept"

            insights.append({
                "subskill_id": subskill_id or f"skill_{skill_name.lower().replace(' ', '_')}",
                "insight_text": insight_text,
                "next_step_text": next_step_text
            })
        return insights

    def _generate_fallback_problem_insights(self, review_items_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate fallback problem insights"""
        insights = []
        for review_data in review_items_data:
            problem_id = review_data.get('problem_id', 'unknown')
            is_correct = review_data.get('is_correct', False)

            if is_correct:
                analysis = {
                    "understanding": "Good understanding demonstrated on this problem.",
                    "approach": "Student used an effective approach to solve this problem."
                }
                feedback = {
                    "praise": "Excellent work on this question!",
                    "guidance": "You showed strong understanding of the concepts.",
                    "encouragement": "Keep up the great work!"
                }
            else:
                analysis = {
                    "understanding": "Student needs additional practice with this concept.",
                    "approach": "Student attempted to answer but may need to review the approach."
                }
                feedback = {
                    "praise": "Good effort on this question!",
                    "guidance": "Let's review the key concepts and try again.",
                    "encouragement": "Keep practicing to improve your understanding!"
                }

            insights.append({
                "problem_id": problem_id,
                "analysis": analysis,
                "feedback": feedback
            })
        return insights


    def _generate_fallback_ai_summary(self, submission_result: Dict[str, Any], review_items_data: List[Dict[str, Any]]) -> str:
        """Generate basic AI summary if AI service fails"""
        score_percentage = submission_result.get('score_percentage', 0)
        correct_count = submission_result.get('correct_count', 0)
        total_questions = submission_result.get('total_questions', 0)

        if score_percentage >= 90:
            return f"Outstanding work! You got {correct_count} out of {total_questions} questions correct, showing excellent understanding of these concepts. Keep up the great work!"
        elif score_percentage >= 75:
            return f"Great job! You correctly answered {correct_count} out of {total_questions} questions, demonstrating solid understanding with just a few areas to review."
        elif score_percentage >= 50:
            return f"Good effort! You got {correct_count} out of {total_questions} questions right, building a foundation in these concepts. Let's review the areas where you can improve."
        else:
            return f"You've taken an important first step! You got {correct_count} out of {total_questions} questions correct, giving us valuable information about where to focus your learning next."

    def _generate_performance_quote(self, score_percentage: float) -> str:
        """Generate performance quote based on score"""
        if score_percentage >= 90:
            return "Outstanding work! You have a strong command of these concepts."
        elif score_percentage >= 75:
            return "Great job! You have a solid understanding, and with a little more practice, you can master this material."
        elif score_percentage >= 50:
            return "A good start! You're building a foundation. Let's review a few areas to strengthen your understanding."
        else:
            return "You've taken an important first step. This is a great opportunity to identify where we can focus and build up your skills."

    def _generate_basic_misconceptions(self, review_items_data: List[Dict[str, Any]]) -> List[str]:
        """Generate basic misconceptions analysis from review data with holistic patterns"""
        misconceptions = []

        # Analyze engagement and performance patterns
        total_problems = len(review_items_data)
        answered_problems = len([r for r in review_items_data if self._is_problem_answered(r)])
        unanswered_count = total_problems - answered_problems
        incorrect_count = len([r for r in review_items_data if not self._extract_correctness(r) and self._is_problem_answered(r)])

        # Holistic engagement analysis
        if unanswered_count > total_problems * 0.5:  # More than 50% unanswered
            misconceptions.append("Student may have felt overwhelmed or uncertain about many concepts, leading to low completion rate")
        elif unanswered_count > total_problems * 0.3:  # More than 30% unanswered
            misconceptions.append("Student shows selective engagement, possibly avoiding challenging problems")
        elif unanswered_count > 2:
            misconceptions.append("Student may need more time or confidence to attempt all problems")

        # Performance pattern analysis
        if answered_problems > 0:
            error_rate = incorrect_count / answered_problems
            if error_rate > 0.7:  # More than 70% of attempted problems incorrect
                misconceptions.append("Student needs foundational review of core concepts before advancing")
            elif error_rate > 0.5:  # More than 50% incorrect
                misconceptions.append("Student understands some concepts but needs targeted practice on fundamentals")

        # If very few problems attempted but high accuracy
        if answered_problems < total_problems * 0.5 and answered_problems > 0:
            correct_rate = (answered_problems - incorrect_count) / answered_problems
            if correct_rate > 0.8:
                misconceptions.append("Student appears capable but may lack confidence to attempt all problems")

        return misconceptions[:3]  # Limit to 3 misconceptions