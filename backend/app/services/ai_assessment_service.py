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
from ..schemas.assessment_review import AssessmentReviewDocument, AssessmentProblemReview

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
   - subskill_id: Use the actual subskill identifier from the context
   - insight_text: Actionable insight referencing assessment focus AND engagement patterns
   - next_step_text: Recommended action that considers both performance and confidence

4. **common_misconceptions**: Identify patterns across the assessment including:
   - Conceptual misunderstandings from incorrect answers
   - Engagement patterns (e.g., "Student appears to lose confidence on harder problems")
   - Limit to 2-3 key patterns that inform instruction

5. **problem_insights**: For each problem, provide analysis and feedback:
   - problem_id: Use the actual problem identifier
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
                    max_output_tokens=6000  # Reduced since we're generating less redundant content
                )
            )

            ai_insights = self._safe_json_loads(response.text, "AI assessment insights")

            # Merge AI insights with computed data to create final summary
            enhanced_summary = self._merge_insights_with_data(
                ai_insights, blueprint, submission_result, review_items_data
            )

            logger.info(f"Generated enhanced assessment summary with {len(enhanced_summary.get('skill_analysis', []))} skills and {len(enhanced_summary.get('review_items', []))} review items")
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
        if selected_subskills:
            category_skills = {}
            for subskill in selected_subskills:
                desc = subskill.get('subskill_description') or subskill.get('skill_description', '')
                category = subskill.get('category', 'general')
                if desc and category:
                    if category not in category_skills:
                        category_skills[category] = []
                    category_skills[category].append(desc)

            if category_skills:
                context_parts.append("\nSKILLS BY ASSESSMENT FOCUS:")
                for category, skills in category_skills.items():
                    category_name = category.replace('_', ' ').title()
                    context_parts.append(f"- {category_name}: {'; '.join(skills[:2])}")  # First 2 skills per category

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

        # Start with AI insights
        enhanced_summary = {
            "ai_summary": ai_insights.get("ai_summary", ""),
            "performance_quote": ai_insights.get("performance_quote", ""),
            "common_misconceptions": ai_insights.get("common_misconceptions", []),
            "skill_analysis": [],
            "review_items": []
        }

        # Build skill_analysis by merging AI insights with computed data
        skill_insights_map = {
            insight.get("subskill_id"): insight
            for insight in ai_insights.get("skill_insights", [])
        }

        # Create mapping from skill_description to subskill_id from blueprint
        selected_subskills = blueprint.get('selected_subskills', [])
        skill_to_subskill_map = {}
        for subskill in selected_subskills:
            skill_desc = subskill.get('skill_description')
            subskill_id = subskill.get('subskill_id')
            if skill_desc and subskill_id:
                skill_to_subskill_map[skill_desc] = subskill_id

        for skill_data in skill_breakdown:
            skill_name = skill_data.get('skill_name')
            total_questions = skill_data.get('total_questions', 0)
            correct_count = skill_data.get('correct_answers', 0)
            percentage = skill_data.get('percentage', 0)

            # Get subskill_id from blueprint mapping
            subskill_id = skill_to_subskill_map.get(skill_name)

            # Get AI insights for this skill
            ai_insight = skill_insights_map.get(subskill_id, {})

            # Determine assessment focus from blueprint
            assessment_focus = self._determine_assessment_focus(skill_name, category_breakdown, blueprint)

            # Compute performance label based on percentage
            performance_label = self._compute_performance_label(percentage)

            # Build complete skill analysis
            skill_analysis = {
                "skill_id": skill_name,
                "skill_name": skill_name,
                "total_questions": total_questions,
                "correct_count": correct_count,
                "assessment_focus": assessment_focus,
                "performance_label": performance_label,
                "insight_text": ai_insight.get("insight_text"),
                "next_step": {
                    "text": ai_insight.get("next_step_text"),
                    "link": f"/practice/{subskill_id}"
                }
            }
            enhanced_summary["skill_analysis"].append(skill_analysis)

        # Build review_items by merging AI insights with computed data
        problem_insights_map = {
            insight.get("problem_id"): insight
            for insight in ai_insights.get("problem_insights", [])
        }

        logger.info(f"AI ASSESSMENT DEBUG - Processing {len(review_items_data)} review items for review_items generation")

        for i, review_data in enumerate(review_items_data):
            problem_id = review_data.get('problem_id', 'unknown')
            problem_content = review_data.get('problem_content', {})

            logger.info(f"AI ASSESSMENT DEBUG - Review item {i+1}/{len(review_items_data)}:")
            logger.info(f"  problem_id: {problem_id}")
            logger.info(f"  problem_content keys: {list(problem_content.keys())}")
            logger.info(f"  problem_type: {problem_content.get('problem_type', 'unknown')}")
            logger.info(f"  review_data keys: {list(review_data.keys())}")
            logger.info(f"  review_data.correct: {review_data.get('correct', 'not found')}")
            logger.info(f"  review_data.score: {review_data.get('score', 'not found')}")
            logger.info(f"  review_data.your_answer_text: {review_data.get('your_answer_text', 'not found')}")
            logger.info(f"  review_data.selected_answer_text: {review_data.get('selected_answer_text', 'not found')}")

            # Get AI insights for this problem
            ai_insight = problem_insights_map.get(problem_id, {})

            # Extract computed data fields using proper extraction method
            question_text = self._extract_question_text(problem_content)
            logger.info(f"  extracted question_text: {question_text}")

            # Extract student answer using the structured extraction method
            your_answer = self._extract_student_answer(review_data)
            logger.info(f"  extracted your_answer: {your_answer}")
            if your_answer in ["No answer", "Not answered", "Not Answered"]:
                your_answer = "No answer recorded"

            correct_answer = self._extract_correct_answer(problem_content)
            logger.info(f"  extracted correct_answer: {correct_answer}")

            review_item = {
                "problem_id": problem_id,
                "question_text": question_text,
                "your_answer_text": your_answer,
                "correct_answer_text": correct_answer,
                "analysis": ai_insight.get("analysis", {
                    "understanding": "Student needs additional practice with this concept.",
                    "approach": "Student attempted to answer the question."
                }),
                "feedback": ai_insight.get("feedback", {
                    "praise": "Good effort on this question!",
                    "guidance": problem_content.get('rationale', 'Review the key concepts for this topic.'),
                    "encouragement": "Keep practicing to improve your understanding!"
                }),
                "related_skill_id": review_data.get('subskill_id', review_data.get('skill_id', 'unknown_skill')),
                "subskill_id": review_data.get('subskill_id', 'unknown'),
                "subject": problem_content.get('subject') or review_data.get('subject', 'Unknown'),
                "lesson_link": f"/practice/{review_data.get('subskill_id', 'unknown')}"
            }
            logger.info(f"  final review_item: {review_item}")
            enhanced_summary["review_items"].append(review_item)

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

    def _determine_assessment_focus(self, skill_name: str, category_breakdown: Dict[str, int], blueprint: Dict[str, Any]) -> str:
        """Determine assessment focus category for a skill based on blueprint data."""
        selected_subskills = blueprint.get('selected_subskills', [])
        for subskill in selected_subskills:
            if (subskill.get('skill_description') == skill_name or
                subskill.get('subskill_description') == skill_name):
                category = subskill.get('category', 'general')
                return {
                    'weak_spots': 'Weak Spot',
                    'recent_practice': 'Recent Practice',
                    'foundational_review': 'Foundational Review',
                    'new_frontiers': 'New Frontier'
                }.get(category, 'General')
        return 'General'

    def _compute_performance_label(self, percentage: float) -> str:
        """Compute performance label based on percentage score."""
        if percentage == 100:
            return "Mastered"
        elif percentage >= 75:
            return "Proficient"
        elif percentage >= 50:
            return "Developing"
        else:
            return "Needs Review"

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
        """Generate fallback skill insights"""
        insights = []
        for skill in skill_breakdown:
            skill_name = skill.get('skill_name', 'Unknown Skill')
            percentage = skill.get('percentage', 0)
            subskill_id = self._find_subskill_id_for_skill(skill_name, review_items_data)

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


    def _generate_fallback_ai_summary(self, submission_result: Dict[str, Any]) -> str:
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