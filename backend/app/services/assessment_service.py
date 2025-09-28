import asyncio
import logging
import random
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from .bigquery_analytics import BigQueryAnalyticsService
from .problems import ProblemService
from .curriculum_service import CurriculumService
from .submission_service import SubmissionService
from .engagement_service import engagement_service
from .ai_assessment_service import AIAssessmentService
from ..db.cosmos_db import CosmosDBService
from ..schemas.problem_submission import ProblemSubmission
from ..schemas.assessment_problems import (
    AssessmentProblemType,
    AssessmentMultipleChoice,
    AssessmentTrueFalse,
    AssessmentFillInBlanks,
    AssessmentMatchingActivity,
    AssessmentSequencingActivity,
    AssessmentCategorizationActivity,
    AssessmentScenarioQuestion,
    AssessmentShortAnswer,
    AssessmentMCQOption,
    AssessmentBlankItem,
    AssessmentMatchingItem,
    AssessmentMatchingMapping,
    AssessmentCategorizationItem,
    DifficultyLevel
)
from ..schemas.assessment_review import (
    AssessmentProblemReview,
    AssessmentReviewDocument,
    AssessmentReviewObservation,
    AssessmentReviewAnalysis,
    AssessmentReviewEvaluation,
    AssessmentReviewFeedback,
    AssessmentSubmissionRequest
)

logger = logging.getLogger(__name__)


@dataclass
class ProcessedReview:
    """A clean, standardized representation of a single problem's result."""
    problem_id: str
    subskill_id: str
    is_correct: bool
    score: int
    student_answer_text: str
    correct_answer_text: str
    full_review_payload: Dict[str, Any] # The rich payload from SubmissionService
    problem_content: Dict[str, Any]     # The original problem definition

    # Essential metadata for downstream builders
    skill_id: str
    skill_description: str
    subskill_description: str
    unit_id: str
    unit_title: str
    subject: str
    category: str  # Pre-assigned category (weak_spots, recent_practice, etc.)


class AssessmentService:
    """
    Service for generating personalized subject-based practice assessments.

    Leverages BigQueryAnalyticsService for student profiling and ProblemService
    for generating rich, varied assessment problems.
    """

    def __init__(
        self,
        bigquery_service: BigQueryAnalyticsService,
        problem_service: ProblemService,
        curriculum_service: CurriculumService,
        submission_service: SubmissionService,
        cosmos_service: CosmosDBService = None
    ):
        self.bigquery = bigquery_service
        self.problems = problem_service
        self.curriculum = curriculum_service
        self.submission_service = submission_service
        self.cosmos = cosmos_service or CosmosDBService()
        self.ai_assessment = AIAssessmentService()

        # Assessment configuration
        self.skill_selection_weights = {
            "weak_spots": 0.40,        # Struggling skills (mastery < 60%, attempts > 2)
            "recent_practice": 0.30,   # Recently practiced skills (last 7-14 days)
            "foundational_review": 0.20, # Previously mastered skills for retention
            "new_frontiers": 0.10      # Skills ready to try but not yet attempted
        }

        # Thresholds for skill categorization
        self.weak_spot_mastery_threshold = 0.6
        self.weak_spot_attempt_threshold = 2
        self.mastered_threshold = 0.8
        self.recent_days_threshold = 14

    async def create_assessment_blueprint(
        self,
        student_id: int,
        subject: str,
        question_count: int = 15
    ) -> Dict[str, Any]:
        """
        Generate a personalized blueprint for assessment questions based on the student's learning profile.

        Args:
            student_id: The student's ID
            subject: Subject to assess (e.g., "Kindergarten Math")
            question_count: Number of questions to include in the assessment

        Returns:
            Dict containing the blueprint with categorized subskills and metadata
        """
        try:
            logger.info(f"Creating assessment blueprint for student {student_id}, subject: {subject}")

            # 1. Fetch comprehensive student metrics from BigQuery
            metrics_data = await self.bigquery.get_hierarchical_metrics(
                student_id=student_id,
                subject=subject
            )

            if not metrics_data or not metrics_data.get('hierarchical_data'):
                logger.warning(f"No metrics data found for student {student_id} in subject {subject}")
                return await self._handle_cold_start(student_id, subject, question_count)

            # 2. Extract all subskills from hierarchical data for the requested subject
            all_subskills = self._extract_subskills_from_metrics(metrics_data, subject)

            if not all_subskills:
                logger.warning(f"No subskills found for student {student_id} in subject {subject}")
                return await self._handle_cold_start(student_id, subject, question_count)

            # 3. Categorize subskills based on learning patterns
            categories = self._categorize_subskills(all_subskills)

            # 4. Calculate target counts for each category
            target_counts = self._calculate_target_counts(question_count)

            # 5. Select subskills for assessment
            selected_subskills = self._select_subskills_by_category(categories, target_counts)

            # 6. Build assessment blueprint
            blueprint = {
                "student_id": student_id,
                "subject": subject,
                "question_count": question_count,
                "selected_subskills": selected_subskills,
                "category_breakdown": {
                    "weak_spots": len([s for s in selected_subskills if s.get("category") == "weak_spots"]),
                    "recent_practice": len([s for s in selected_subskills if s.get("category") == "recent_practice"]),
                    "foundational_review": len([s for s in selected_subskills if s.get("category") == "foundational_review"]),
                    "new_frontiers": len([s for s in selected_subskills if s.get("category") == "new_frontiers"])
                },
                "total_available_subskills": len(all_subskills),
                "generated_at": datetime.utcnow().isoformat()
            }

            logger.info(f"Assessment blueprint created with {len(selected_subskills)} subskills")
            return blueprint

        except Exception as e:
            logger.error(f"Error creating assessment blueprint: {e}")
            raise

    def _extract_subskills_from_metrics(self, metrics_data: Dict, subject: str = None) -> List[Dict]:
        """Extract all subskills from the hierarchical metrics structure, optionally filtered by subject."""
        all_subskills = []

        for unit in metrics_data.get('hierarchical_data', []):
            # Skip units that don't match the requested subject
            if subject and unit.get('subject') and unit.get('subject') != subject:
                continue

            for skill in unit.get('skills', []):
                for subskill in skill.get('subskills', []):
                    # Enrich subskill data with parent context
                    subskill_data = {
                        **subskill,
                        "unit_id": unit.get('unit_id'),
                        "unit_title": unit.get('unit_title'),
                        "skill_id": skill.get('skill_id'),
                        "skill_description": skill.get('skill_description'),
                        "subject": subject or unit.get('subject')  # Use provided subject or fall back to unit subject
                    }
                    all_subskills.append(subskill_data)

        return all_subskills

    def _categorize_subskills(self, subskills: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorize subskills based on learning patterns and performance."""
        categories = {
            "weak_spots": [],
            "recent_practice": [],
            "foundational_review": [],
            "new_frontiers": []
        }

        current_time = datetime.utcnow()
        recent_threshold = current_time - timedelta(days=self.recent_days_threshold)

        for subskill in subskills:
            mastery = subskill.get('mastery', 0)
            attempt_count = subskill.get('attempt_count', 0)
            priority_level = subskill.get('priority_level', '')
            readiness_status = subskill.get('readiness_status', '')
            is_attempted = subskill.get('is_attempted', False)
            last_activity = subskill.get('last_activity_date')

            # Parse last activity date if available
            is_recent = False
            if last_activity:
                try:
                    last_activity_dt = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
                    is_recent = last_activity_dt >= recent_threshold
                except (ValueError, AttributeError):
                    is_recent = False

            # Categorization logic based on PRD specifications
            if (mastery < self.weak_spot_mastery_threshold and
                attempt_count > self.weak_spot_attempt_threshold):
                # Weak spots: Low mastery with multiple attempts
                subskill['category'] = 'weak_spots'
                categories['weak_spots'].append(subskill)

            elif (is_recent and mastery < 1.0 and is_attempted):
                # Recent practice: Recently attempted, not yet fully mastered
                subskill['category'] = 'recent_practice'
                categories['recent_practice'].append(subskill)

            elif (mastery >= self.mastered_threshold and is_attempted):
                # Foundational review: Previously mastered skills for retention
                subskill['category'] = 'foundational_review'
                categories['foundational_review'].append(subskill)

            elif (readiness_status == 'Ready' and not is_attempted):
                # New frontiers: Ready to try but not yet attempted
                subskill['category'] = 'new_frontiers'
                categories['new_frontiers'].append(subskill)

        return categories

    def _calculate_target_counts(self, total_questions: int) -> Dict[str, int]:
        """Calculate target number of questions for each category."""
        target_counts = {}
        remaining_questions = total_questions

        # Calculate based on weights, ensuring we don't exceed total
        for category, weight in self.skill_selection_weights.items():
            if category == "new_frontiers":  # Handle remainder for last category
                target_counts[category] = remaining_questions
            else:
                count = int(total_questions * weight)
                target_counts[category] = count
                remaining_questions -= count

        return target_counts

    def _select_subskills_by_category(
        self,
        categories: Dict[str, List[Dict]],
        target_counts: Dict[str, int]
    ) -> List[Dict]:
        """Select subskills from each category up to target counts."""
        selected_subskills = []
        total_requested = sum(target_counts.values())

        for category, target_count in target_counts.items():
            available_subskills = categories.get(category, [])

            if not available_subskills:
                logger.info(f"No subskills available in category: {category}")
                continue

            # Randomly sample from available subskills
            actual_count = min(target_count, len(available_subskills))
            if actual_count > 0:
                selected = random.sample(available_subskills, actual_count)
                selected_subskills.extend(selected)
                logger.info(f"Selected {actual_count} subskills from {category}")

        # If we don't have enough subskills, pad by duplicating existing ones
        # This ensures we can generate the requested number of problems
        if len(selected_subskills) < total_requested:
            shortage = total_requested - len(selected_subskills)
            logger.info(f"Padding {shortage} subskills to reach target of {total_requested}")

            # Duplicate randomly selected subskills to make up the difference
            if selected_subskills:
                padding = random.choices(selected_subskills, k=shortage)
                selected_subskills.extend(padding)

        # Shuffle the final list to mix categories
        random.shuffle(selected_subskills)

        return selected_subskills

    async def _handle_cold_start(
        self,
        student_id: int,
        subject: str,
        question_count: int
    ) -> Dict[str, Any]:
        """Handle assessment creation for students with no learning history."""
        logger.info(f"Handling cold start for student {student_id} in subject {subject}")

        try:
            # Get foundational skills from curriculum
            curriculum_data = await self.curriculum.get_curriculum(subject)

            if not curriculum_data:
                raise ValueError(f"No curriculum data available for subject: {subject}")

            # Select foundational subskills (first units/skills)
            foundational_subskills = self._select_foundational_subskills(
                curriculum_data, question_count
            )

            return {
                "student_id": student_id,
                "subject": subject,
                "question_count": question_count,
                "selected_subskills": foundational_subskills,
                "category_breakdown": {
                    "foundational_cold_start": len(foundational_subskills)
                },
                "is_cold_start": True,
                "generated_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error in cold start handling: {e}")
            raise

    def _select_foundational_subskills(
        self,
        curriculum_data: List[Dict],
        count: int
    ) -> List[Dict]:
        """Select foundational subskills from curriculum for cold start scenarios."""
        foundational_subskills = []

        # curriculum_data is a list of units from CurriculumService.get_curriculum()
        # Extract subskills from early units (first 2 units)
        for unit in curriculum_data[:2]:  # First 2 units
            for skill in unit.get('skills', []):
                for subskill in skill.get('subskills', []):
                    subskill_data = {
                        "subskill_id": subskill.get('id'),
                        "subskill_description": subskill.get('description'),
                        "skill_id": skill.get('id'),
                        "skill_description": skill.get('description'),
                        "unit_id": unit.get('id'),
                        "unit_title": unit.get('title'),
                        "category": "foundational_cold_start"
                    }
                    foundational_subskills.append(subskill_data)

                    if len(foundational_subskills) >= count:
                        break
                if len(foundational_subskills) >= count:
                    break
            if len(foundational_subskills) >= count:
                break

        return foundational_subskills[:count]

    async def generate_assessment_problems(
        self,
        student_id: int,
        subject: str,
        question_count: int = 15
    ) -> Dict[str, Any]:
        """
        Generate a complete personalized assessment with problems.

        Args:
            student_id: The student's ID
            subject: Subject to assess
            question_count: Number of questions to include

        Returns:
            Dict containing the assessment blueprint and generated problems
        """
        try:
            logger.info(f"Generating assessment for student {student_id}, subject: {subject}")

            # 1. Create assessment blueprint
            blueprint = await self.create_assessment_blueprint(
                student_id, subject, question_count
            )

            # 2. Convert blueprint to problem recommendations format
            recommendations = self._convert_blueprint_to_recommendations(
                blueprint['selected_subskills']
            )

            if not recommendations:
                raise ValueError("No recommendations could be generated from blueprint")

            # 3. Get context primitives for variety (using first recommendation)
            context_primitives = None
            if recommendations:
                context_primitives = await self.problems.get_or_generate_context_primitives(subject, recommendations[0])
                if context_primitives:
                    objects_count = len(context_primitives.get('concrete_objects', []))
                    scenarios_count = len(context_primitives.get('scenarios', []))
                    logger.info(f"🚀 [ASSESSMENT_VARIETY] Using context primitives for assessment generation: {objects_count} objects, {scenarios_count} scenarios")
                else:
                    logger.info(f"⚠️ [ASSESSMENT_FALLBACK] No context primitives available - using default generation")

            # 4. Generate problems using ProblemService with context primitives
            problems = await self.problems.generate_problem(
                subject=subject,
                recommendations=recommendations,
                count=question_count,
                context_primitives=context_primitives
            )

            # 5. Parse the JSON response from ProblemService
            if isinstance(problems, str):
                import json
                try:
                    problems_data = json.loads(problems)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse problems JSON: {e}")
                    raise ValueError("Invalid problems JSON response")
            else:
                problems_data = problems

            # 6. Enrich problems with assessment metadata
            enriched_problems = self._enrich_problems_with_metadata(
                problems_data, blueprint['selected_subskills'], subject
            )

            # 7. Build final assessment response - convert structured problems to dict for serialization
            problems_dict = [problem.dict() for problem in enriched_problems]

            assessment = {
                "assessment_id": f"assess_{student_id}_{subject}_{int(datetime.utcnow().timestamp())}",
                "student_id": student_id,
                "subject": subject,
                "blueprint": blueprint,
                "problems": problems_dict,
                "total_questions": len(enriched_problems),
                "estimated_duration_minutes": len(enriched_problems) * 2,  # ~2 min per question
                "generated_at": datetime.utcnow().isoformat()
            }

            logger.info(f"Assessment generated successfully with {len(enriched_problems)} problems")
            return assessment

        except Exception as e:
            logger.error(f"Error generating assessment problems: {e}")
            raise

    def _convert_blueprint_to_recommendations(self, selected_subskills: List[Dict]) -> List[Dict]:
        """Convert blueprint subskills to ProblemService recommendations format."""
        recommendations = []

        for subskill in selected_subskills:
            recommendation = {
                "unit": {
                    "id": subskill.get('unit_id'),
                    "title": subskill.get('unit_title')
                },
                "skill": {
                    "id": subskill.get('skill_id'),
                    "description": subskill.get('skill_description')
                },
                "subskill": {
                    "id": subskill.get('subskill_id'),
                    "description": subskill.get('subskill_description')
                },
                "assessment_category": subskill.get('category'),  # Track which category this is from
                # Legacy flat structure for backward compatibility
                "subskill_id": subskill.get('subskill_id'),
                "subskill_description": subskill.get('subskill_description'),
                "skill_id": subskill.get('skill_id'),
                "skill_description": subskill.get('skill_description'),
                "unit_id": subskill.get('unit_id'),
                "unit_title": subskill.get('unit_title')
            }
            recommendations.append(recommendation)

        return recommendations

    def _enrich_problems_with_metadata(
        self,
        problems_data: Dict,
        selected_subskills: List[Dict],
        subject: str
    ) -> List[AssessmentProblemType]:
        """
        Convert generated problems to structured AssessmentProblemType objects
        """
        enriched_problems = []

        # Handle different problem types from the rich schema
        problem_types = ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity',
                        'sequencing_activity', 'categorization_activity', 'scenario_question', 'short_answer']

        subskill_index = 0
        for problem_type in problem_types:
            problems_of_type = problems_data.get(problem_type, [])

            for problem in problems_of_type:
                if subskill_index < len(selected_subskills):
                    subskill = selected_subskills[subskill_index]

                    # Create the appropriate assessment problem type
                    try:
                        if problem_type == "multiple_choice":
                            assessment_problem = AssessmentMultipleChoice(
                                id=problem.get('id', f"mcq_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                question=problem.get('question', ''),
                                options=[
                                    AssessmentMCQOption(id=opt['id'], text=opt['text'])
                                    for opt in problem.get('options', [])
                                ],
                                correct_option_id=problem.get('correct_option_id', 'A'),
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "true_false":
                            assessment_problem = AssessmentTrueFalse(
                                id=problem.get('id', f"tf_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                statement=problem.get('statement', ''),
                                correct=problem.get('correct', True),
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "fill_in_blanks":
                            assessment_problem = AssessmentFillInBlanks(
                                id=problem.get('id', f"fib_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                text_with_blanks=problem.get('text_with_blanks', ''),
                                blanks=[
                                    AssessmentBlankItem(
                                        id=blank.get('id', str(i)),
                                        correct_answers=blank.get('correct_answers', []),
                                        case_sensitive=blank.get('case_sensitive', False)
                                    )
                                    for i, blank in enumerate(problem.get('blanks', []))
                                ],
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "matching_activity":
                            assessment_problem = AssessmentMatchingActivity(
                                id=problem.get('id', f"match_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                prompt=problem.get('prompt', ''),
                                left_items=[
                                    AssessmentMatchingItem(id=item.get('id', str(i)), text=item.get('text', ''))
                                    for i, item in enumerate(problem.get('left_items', []))
                                ],
                                right_items=[
                                    AssessmentMatchingItem(id=item.get('id', str(i)), text=item.get('text', ''))
                                    for i, item in enumerate(problem.get('right_items', []))
                                ],
                                mappings=[
                                    AssessmentMatchingMapping(
                                        left_id=mapping.get('left_id', ''),
                                        right_ids=mapping.get('right_ids', [])
                                    )
                                    for mapping in problem.get('mappings', [])
                                ],
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "sequencing_activity":
                            assessment_problem = AssessmentSequencingActivity(
                                id=problem.get('id', f"seq_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                instruction=problem.get('instruction', ''),
                                items=problem.get('items', []),
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "categorization_activity":
                            assessment_problem = AssessmentCategorizationActivity(
                                id=problem.get('id', f"cat_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                instruction=problem.get('instruction', ''),
                                categories=problem.get('categories', []),
                                categorization_items=[
                                    AssessmentCategorizationItem(
                                        item_text=item.get('item_text', ''),
                                        correct_category=item.get('correct_category', '')
                                    )
                                    for item in problem.get('categorization_items', [])
                                ],
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "scenario_question":
                            assessment_problem = AssessmentScenarioQuestion(
                                id=problem.get('id', f"scenario_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                scenario=problem.get('scenario', ''),
                                scenario_question=problem.get('scenario_question', ''),
                                scenario_answer=problem.get('scenario_answer', ''),
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        elif problem_type == "short_answer":
                            assessment_problem = AssessmentShortAnswer(
                                id=problem.get('id', f"short_{subskill_index + 1}"),
                                difficulty=DifficultyLevel(problem.get('difficulty', 'medium')),
                                grade_level=problem.get('grade_level', 'K'),
                                question=problem.get('question', ''),
                                rationale=problem.get('rationale', ''),
                                teaching_note=problem.get('teaching_note', ''),
                                success_criteria=problem.get('success_criteria', []),
                                skill_id=subskill.get('skill_id', 'default_skill'),
                                subskill_id=subskill.get('subskill_id', 'default_subskill'),
                                subject=subject
                            )
                        else:
                            # Skip unknown problem types
                            continue

                        enriched_problems.append(assessment_problem)
                        subskill_index += 1

                    except Exception as e:
                        logger.error(f"Failed to create assessment problem of type {problem_type}: {e}")
                        continue

        logger.info(f"Enriched {len(enriched_problems)} problems with structured schemas")
        return enriched_problems

    # ============================================================================
    # COSMOS DB STORAGE METHODS
    # ============================================================================

    async def store_assessment(
        self,
        assessment_data: Dict[str, Any],
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Store assessment data in Cosmos DB"""
        try:
            await self.cosmos.store_assessment(assessment_data, firebase_uid)
            logger.info(f"Successfully stored assessment {assessment_data.get('assessment_id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to store assessment: {e}")
            return False

    async def get_assessment(
        self,
        assessment_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve assessment by ID"""
        try:
            assessment = await self.cosmos.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                logger.warning(f"Assessment {assessment_id} not found or expired")
                return None
            return assessment
        except Exception as e:
            logger.error(f"Failed to retrieve assessment: {e}")
            return None

    async def update_assessment_status(
        self,
        assessment_id: str,
        student_id: int,
        status: str,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Update assessment status"""
        try:
            success = await self.cosmos.update_assessment_status(
                assessment_id, student_id, status, firebase_uid
            )
            if success:
                logger.info(f"Updated assessment {assessment_id} status to {status}")
            return success
        except Exception as e:
            logger.error(f"Failed to update assessment status: {e}")
            return False

    async def store_assessment_submission(
        self,
        assessment_id: str,
        student_id: int,
        answers: Dict[str, Any],
        score_data: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Store assessment submission and scoring results"""
        try:
            success = await self.cosmos.store_assessment_submission(
                assessment_id, student_id, answers, score_data, time_taken_minutes, firebase_uid
            )
            if success:
                logger.info(f"Stored submission for assessment {assessment_id}")
            return success
        except Exception as e:
            logger.error(f"Failed to store assessment submission: {e}")
            return False

    # ============================================================================
    # NEW REFACTORED SCORING METHODS (Mise en Place Architecture)
    # ============================================================================

    async def _process_single_problem(self, problem: Dict, student_answer: Any, blueprint: Dict[str, Any]) -> ProcessedReview:
        """
        Handles the processing of a single problem and extracts all necessary metadata.
        Uses SubmissionService (which includes universal validator) for clean evaluation.
        """
        # Extract basic problem identifiers
        problem_id = str(problem.get("id") or problem.get("problem_id"))

        # Extract metadata from problem first, but look up from blueprint if missing
        skill_id = problem.get("skill_id", "unknown")
        subskill_id = problem.get("subskill_id", "unknown")

        # Initialize metadata variables
        skill_description = problem.get("skill_description", "Unknown Skill")
        subskill_description = problem.get("subskill_description", "Unknown Subskill")
        unit_id = problem.get("unit_id", "unknown")
        unit_title = problem.get("unit_title", "Unknown Unit")
        subject = problem.get("subject", blueprint.get("subject", "Unknown Subject"))
        category = "foundational_review"  # Default fallback

        # Look up complete metadata from blueprint if not in problem
        selected_subskills = blueprint.get("selected_subskills", [])
        for subskill in selected_subskills:
            # Match by subskill_id or skill_id
            if (subskill.get("subskill_id") == subskill_id or
                subskill.get("skill_id") == skill_id):
                # Fill in missing metadata from blueprint
                if skill_description == "Unknown Skill":
                    skill_description = subskill.get("skill_description", skill_description)
                if subskill_description == "Unknown Subskill":
                    subskill_description = subskill.get("subskill_description", subskill_description)
                if unit_id == "unknown":
                    unit_id = subskill.get("unit_id", unit_id)
                if unit_title == "Unknown Unit":
                    unit_title = subskill.get("unit_title", unit_title)
                if subject in ["Unknown Subject", "unknown", None]:
                    subject = subskill.get("subject", subject)
                category = subskill.get("category", "foundational_review")
                break

        logger.info(f"[ASSESSMENT_SERVICE] Processing problem {problem_id}")
        logger.info(f"[ASSESSMENT_SERVICE] Metadata - Skill: {skill_id} ({skill_description})")
        logger.info(f"[ASSESSMENT_SERVICE] Metadata - Subskill: {subskill_id} ({subskill_description})")
        logger.info(f"[ASSESSMENT_SERVICE] Metadata - Unit: {unit_id} ({unit_title})")
        logger.info(f"[ASSESSMENT_SERVICE] Metadata - Subject: {subject}")
        logger.debug(f"[ASSESSMENT_SERVICE] Student answer provided: {student_answer is not None}")

        is_correct = False
        score = 0
        student_answer_text = "Not Answered"
        correct_answer_text = self._extract_correct_answer_text(problem)
        full_review_payload = {}

        if student_answer is not None:
            # Process answered question through SubmissionService
            try:
                logger.info(f"[ASSESSMENT_SERVICE] Calling SubmissionService for problem {problem_id}")

                # Handle different answer formats for submission service
                processed_student_answer = ""
                primitive_response = None

                if isinstance(student_answer, dict):
                    # Interactive problem answer (MCQ, etc.)
                    primitive_response = student_answer
                    processed_student_answer = ""
                    logger.debug(f"[ASSESSMENT_SERVICE] Problem {problem_id}: Using primitive_response format")
                elif isinstance(student_answer, str):
                    processed_student_answer = student_answer
                    logger.debug(f"[ASSESSMENT_SERVICE] Problem {problem_id}: Using text answer format")
                else:
                    processed_student_answer = str(student_answer)
                    logger.debug(f"[ASSESSMENT_SERVICE] Problem {problem_id}: Converting answer to string")

                # Create submission payload
                submission_payload = ProblemSubmission(
                    subject=subject,
                    problem=problem,
                    student_answer=processed_student_answer,
                    primitive_response=primitive_response,
                    solution_image=None,
                    canvas_used=False,
                    skill_id=skill_id,
                    subskill_id=subskill_id,
                )

                # Mock user context for service
                user_context = {"firebase_uid": "", "student_id": 0, "email": ""}

                # Process through SubmissionService (handles universal validation)
                submission_result = await self.submission_service.handle_submission(
                    submission_payload, user_context
                )

                # Extract results from SubmissionService response
                review_data = submission_result.review
                is_correct = review_data.get("correct", False) or review_data.get("score", 0) >= 7
                score = review_data.get("score", 0)

                logger.info(f"[ASSESSMENT_SERVICE] Problem {problem_id}: SubmissionService returned score={score}, correct={is_correct}")

                # Extract student answer text for display
                if isinstance(student_answer, dict):
                    student_answer_text = (
                        review_data.get("observation", {}).get("selected_answer_text") or
                        review_data.get("selected_option_text", "Answer Submitted")
                    )
                else:
                    student_answer_text = str(student_answer)

                # Get correct answer from review data if available
                correct_answer_text = review_data.get("correct_answer_text", self._extract_correct_answer_text(problem))

                logger.debug(f"[ASSESSMENT_SERVICE] Problem {problem_id}: Student answer='{student_answer_text}'")
                logger.debug(f"[ASSESSMENT_SERVICE] Problem {problem_id}: Correct answer='{correct_answer_text}'")

                # Convert review to dict format for full_review_payload
                if hasattr(review_data, 'dict'):
                    full_review_payload = review_data.dict()
                elif isinstance(review_data, dict):
                    full_review_payload = review_data
                else:
                    full_review_payload = {"raw_review": review_data}

            except Exception as e:
                logger.error(f"[ASSESSMENT_SERVICE] Error processing answer for problem {problem_id}: {e}")
                is_correct = False
                score = 0
                student_answer_text = "Submission Error"
                correct_answer_text = "Error"
                full_review_payload = {"error": str(e), "score": 0, "correct": False}

        else:
            # Handle unanswered question
            logger.info(f"[ASSESSMENT_SERVICE] Problem {problem_id}: No answer provided")
            is_correct = False
            score = 0
            student_answer_text = "Not Answered"
            correct_answer_text = self._extract_correct_answer_text(problem)

            # Create minimal review for unanswered question
            full_review_payload = {
                "observation": {"selected_answer": "Not answered", "work_shown": "No response provided"},
                "analysis": {"understanding": "No response to assess", "accuracy": "Unanswered"},
                "evaluation": {"score": 0, "justification": "Question not answered"},
                "feedback": {"guidance": "Please attempt all questions", "encouragement": "Try your best!"},
                "score": 0,
                "correct": False
            }

        logger.info(f"[ASSESSMENT_SERVICE] Problem {problem_id} processing complete: score={score}, correct={is_correct}")

        return ProcessedReview(
            problem_id=problem_id,
            subskill_id=subskill_id,
            is_correct=is_correct,
            score=score,
            student_answer_text=student_answer_text,
            correct_answer_text=correct_answer_text,
            full_review_payload=full_review_payload,
            problem_content=problem,
            # Essential metadata for downstream builders
            skill_id=skill_id,
            skill_description=skill_description,
            subskill_description=subskill_description,
            unit_id=unit_id,
            unit_title=unit_title,
            subject=subject,
            category=category
        )

    def _build_summary(self, processed_reviews: List[ProcessedReview]) -> Dict[str, Any]:
        """Calculates and returns the top-level summary stats with detailed analytics."""
        logger.info(f"[ASSESSMENT_SERVICE] Building enhanced summary from {len(processed_reviews)} processed reviews")

        if not processed_reviews:
            return {
                "correct_count": 0,
                "total_questions": 0,
                "score_percentage": 0.0,
                "performance_by_problem_type": {},
                "performance_by_category": {},
                "detailed_metrics": {}
            }

        # Basic totals
        correct_count = sum(1 for review in processed_reviews if review.is_correct)
        total_questions = len(processed_reviews)
        score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0.0

        # Performance by problem type
        problem_type_stats = {}
        for review in processed_reviews:
            problem_type = review.problem_content.get("problem_type", "unknown")
            if problem_type not in problem_type_stats:
                problem_type_stats[problem_type] = {"correct": 0, "total": 0}

            problem_type_stats[problem_type]["total"] += 1
            if review.is_correct:
                problem_type_stats[problem_type]["correct"] += 1

        # Add percentages to problem type stats
        performance_by_problem_type = {}
        for ptype, stats in problem_type_stats.items():
            percentage = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0.0
            performance_by_problem_type[ptype] = {
                **stats,
                "percentage": round(percentage, 1)
            }

        # Performance by pre-assigned skill category (weak_spots, recent_practice, etc.)
        # Categories are now available directly from each ProcessedReview
        category_stats = {}

        # Aggregate by category using the category from each ProcessedReview
        for review in processed_reviews:
            category = review.category

            if category not in category_stats:
                category_stats[category] = {"correct": 0, "total": 0, "skills": set()}

            category_stats[category]["total"] += 1
            if review.is_correct:
                category_stats[category]["correct"] += 1
            category_stats[category]["skills"].add(review.skill_id)

        # Convert to final format with percentages
        performance_by_category = {}
        for category, stats in category_stats.items():
            percentage = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0.0
            performance_by_category[category] = {
                "correct": stats["correct"],
                "total": stats["total"],
                "percentage": round(percentage, 1),
                "unique_skills": len(stats["skills"])
            }

        # Additional detailed metrics
        unique_skills = set(review.skill_id for review in processed_reviews)
        skill_performance = {}
        for skill_id in unique_skills:
            skill_reviews = [r for r in processed_reviews if r.skill_id == skill_id]
            correct = sum(1 for r in skill_reviews if r.is_correct)
            total = len(skill_reviews)
            skill_performance[skill_id] = {"correct": correct, "total": total, "percentage": (correct/total*100) if total > 0 else 0}

        detailed_metrics = {
            "average_score_per_skill": round(sum(sp["percentage"] for sp in skill_performance.values()) / len(skill_performance), 1) if skill_performance else 0.0,
            "skills_mastered": len([s for s in skill_performance.values() if s["percentage"] >= 80.0]),
            "skills_struggling": len([s for s in skill_performance.values() if s["percentage"] < 50.0]),
            "total_skills_assessed": len(unique_skills),
            "problem_type_distribution": {ptype: stats["total"] for ptype, stats in problem_type_stats.items()},
            "category_distribution": {category: stats["total"] for category, stats in category_stats.items()}
        }

        summary_data = {
            "correct_count": correct_count,
            "total_questions": total_questions,
            "score_percentage": round(score_percentage, 1),
            "performance_by_problem_type": performance_by_problem_type,
            "performance_by_category": performance_by_category,
            "detailed_metrics": detailed_metrics
        }

        logger.info(f"[ASSESSMENT_SERVICE] Enhanced summary calculated:")
        logger.info(f"[ASSESSMENT_SERVICE] - Overall: {correct_count}/{total_questions} ({score_percentage:.1f}%)")
        logger.info(f"[ASSESSMENT_SERVICE] - Problem types: {list(performance_by_problem_type.keys())}")
        logger.info(f"[ASSESSMENT_SERVICE] - Categories: {list(performance_by_category.keys())}")
        logger.info(f"[ASSESSMENT_SERVICE] - Skills mastered: {detailed_metrics['skills_mastered']}/{detailed_metrics['total_skills_assessed']}")

        return summary_data

    def _build_skill_analysis(self, processed_reviews: List[ProcessedReview]) -> List[Dict]:
        """
        Aggregates performance by subskill_id and formats the skill_analysis array.
        This function is now simple and completely decoupled.
        """
        logger.info(f"[ASSESSMENT_SERVICE] Building skill analysis from {len(processed_reviews)} processed reviews")

        if not processed_reviews:
            return []

        # Aggregate performance by skill - categories are now available directly from ProcessedReview
        skill_performance = {}
        for review in processed_reviews:
            skill_id = review.skill_id

            if skill_id not in skill_performance:
                skill_performance[skill_id] = {
                    "skill_id": skill_id,
                    "correct_count": 0,
                    "total_questions": 0,
                    "skill_name": review.skill_description or skill_id,
                    "category": review.category,  # Use the category from ProcessedReview
                    "unit_id": review.unit_id,
                    "unit_title": review.unit_title
                }

            skill_performance[skill_id]["total_questions"] += 1
            if review.is_correct:
                skill_performance[skill_id]["correct_count"] += 1

        # Convert to final skill_analysis format with percentages
        skill_analysis_list = []
        for skill_id, performance in skill_performance.items():
            percentage = (performance["correct_count"] / performance["total_questions"] * 100) if performance["total_questions"] > 0 else 0.0

            skill_analysis_entry = {
                "skill_id": skill_id,
                "skill_name": performance["skill_name"],
                "category": performance["category"],  # Keep the original assigned category
                "total_questions": performance["total_questions"],
                "correct_count": performance["correct_count"],
                "percentage": round(percentage, 1),
                "unit_id": performance["unit_id"],
                "unit_title": performance["unit_title"]
            }

            skill_analysis_list.append(skill_analysis_entry)

        # Sort by category priority and then by performance
        category_priority = {
            "weak_spots": 1,
            "recent_practice": 2,
            "foundational_review": 3,
            "new_frontiers": 4
        }

        skill_analysis_list.sort(key=lambda x: (
            category_priority.get(x["category"], 5),
            -x["percentage"]  # Higher percentage first within category
        ))

        logger.info(f"[ASSESSMENT_SERVICE] Skill analysis completed:")
        category_counts = {}
        for entry in skill_analysis_list:
            category = entry["category"]
            category_counts[category] = category_counts.get(category, 0) + 1

        for category, count in category_counts.items():
            logger.info(f"[ASSESSMENT_SERVICE] - {category}: {count} skills")

        return skill_analysis_list

    def _build_problem_reviews(self, processed_reviews: List[ProcessedReview]) -> List[Dict]:
        """Formats the final, lean problem_reviews array for the UI."""
        logger.info(f"[ASSESSMENT_SERVICE] Building problem reviews from {len(processed_reviews)} processed reviews")

        problem_reviews = []
        for review in processed_reviews:
            problem_review = {
                "problem_id": review.problem_id,
                "is_correct": review.is_correct,
                "score": review.score,
                "student_answer_text": review.student_answer_text,
                "correct_answer_text": review.correct_answer_text,
                "skill_id": review.skill_id,
                "skill_name": review.skill_description,
                "subskill_id": review.subskill_id,
                "subskill_name": review.subskill_description,
                "unit_id": review.unit_id,
                "unit_title": review.unit_title,
                "problem_type": review.problem_content.get("problem_type", "unknown")
            }
            problem_reviews.append(problem_review)

        logger.info(f"[ASSESSMENT_SERVICE] Problem reviews completed: {len(problem_reviews)} entries")
        return problem_reviews

    def _extract_correct_answer_text(self, problem: Dict) -> str:
        """Extract the correct answer text from a problem for display purposes."""
        problem_id = problem.get("id", "unknown")
        problem_type = problem.get("problem_type", "")

        logger.debug(f"[ASSESSMENT_SERVICE] Extracting correct answer for problem {problem_id}, type: {problem_type}")

        if problem_type == "multiple_choice" and problem.get("options"):
            correct_option_id = problem.get("correct_option_id", "")
            options = problem.get("options", [])
            logger.debug(f"[ASSESSMENT_SERVICE] MCQ problem {problem_id}: correct_option_id={correct_option_id}, options_count={len(options)}")

            correct_option = next((opt for opt in options if opt.get("id") == correct_option_id), None)
            if correct_option:
                answer_text = correct_option.get("text", correct_option_id)
                logger.debug(f"[ASSESSMENT_SERVICE] MCQ problem {problem_id}: found correct answer='{answer_text}'")
                return answer_text
            else:
                logger.warning(f"[ASSESSMENT_SERVICE] MCQ problem {problem_id}: correct option {correct_option_id} not found in options")
                return "Unknown"

        elif problem_type == "true_false":
            correct_value = problem.get("correct")
            answer_text = "True" if correct_value else "False"
            logger.debug(f"[ASSESSMENT_SERVICE] True/False problem {problem_id}: correct={correct_value}, answer='{answer_text}'")
            return answer_text

        elif problem_type == "fill_in_blanks":
            blanks = problem.get("blanks", [])
            logger.debug(f"[ASSESSMENT_SERVICE] Fill-in-blanks problem {problem_id}: blanks_count={len(blanks)}")

            if blanks:
                correct_answers = blanks[0].get("correct_answers", [])
                answer_text = ", ".join(correct_answers) if correct_answers else "Fill in blanks"
                logger.debug(f"[ASSESSMENT_SERVICE] Fill-in-blanks problem {problem_id}: first_blank_answers={correct_answers}")
                return answer_text

        elif problem_type == "scenario_question":
            answer_text = problem.get("scenario_answer", "See scenario answer")
            logger.debug(f"[ASSESSMENT_SERVICE] Scenario problem {problem_id}: answer='{answer_text[:50]}...'")
            return answer_text

        else:
            answer_text = problem.get("answer", problem.get("rationale", "See solution"))
            logger.debug(f"[ASSESSMENT_SERVICE] Generic problem {problem_id} (type={problem_type}): answer='{answer_text[:50]}...'")
            return answer_text

    # ============================================================================
    # COSMOS DB STORAGE METHODS
    # ============================================================================

    async def score_assessment(
        self,
        assessment_id: str,
        student_id: int,
        answers: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Orchestrates the scoring of an assessment using the new Mise en Place architecture."""

        try:
            # 1. SETUP: Fetch the assessment definition
            assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                raise ValueError(f"Assessment {assessment_id} not found for student {student_id}")

            problems = assessment.get("problems", [])
            if not problems:
                raise ValueError("Assessment contains no problems to score.")

            # 2. PREP WORK (Transformation): Create the "Mise en Place"
            # This loop's ONLY job is to convert raw submissions into our clean intermediate format.
            processed_reviews: List[ProcessedReview] = []
            blueprint = assessment.get("blueprint", {})
            for problem in problems:
                student_answer = answers.get(str(problem.get("id") or problem.get("problem_id")))
                review = await self._process_single_problem(problem, student_answer, blueprint)
                processed_reviews.append(review)

            # 3. ASSEMBLY (Building): Delegate to specialized, independent functions.
            summary_data = self._build_summary(processed_reviews)

            skill_analysis_data = self._build_skill_analysis(processed_reviews)

            problem_reviews_data = self._build_problem_reviews(processed_reviews)

            ai_insights_data = await self.ai_assessment.generate_enhanced_assessment_summary(
                blueprint=assessment.get("blueprint", {}),
                submission_result=summary_data,
                review_items_data=[pr.full_review_payload for pr in processed_reviews]
            )

            # Add comprehensive logging for assessment insights generation
            logger.info(f"🔍 ASSESSMENT_INSIGHTS: Generated insights for assessment {assessment_id}")
            logger.info(f"🔍 ASSESSMENT_INSIGHTS: Subject: {assessment.get('subject')}")
            if ai_insights_data and ai_insights_data.get('skill_insights'):
                for insight in ai_insights_data['skill_insights']:
                    next_step = insight.get('next_step', {})
                    link = next_step.get('link', '')
                    logger.info(f"🔍 ASSESSMENT_INSIGHTS: Skill {insight.get('skill_id')} -> Next step link: {link}")
                    logger.info(f"🔍 ASSESSMENT_INSIGHTS: Assessment focus: {insight.get('assessment_focus_tag')}")
                    logger.info(f"🔍 ASSESSMENT_INSIGHTS: Performance: {insight.get('performance_label')}")
            else:
                logger.warning(f"🔍 ASSESSMENT_INSIGHTS: No skill insights generated for assessment {assessment_id}")

            # 4. FINAL ASSEMBLY: Combine the built parts into the final results object.
            final_results = {
                "summary": summary_data,
                "problem_reviews": problem_reviews_data,
                "ai_insights": ai_insights_data
            }

            # 5. PERSISTENCE: Update the assessment document in Cosmos DB.
            await self.cosmos.update_assessment_with_results(
                assessment_id,
                student_id,
                final_results,
                answers,
                time_taken_minutes,
                firebase_uid
            )

            # 6. ASSESSMENT FEEDBACK: No longer needed - daily plan will query assessment documents directly

            # 7. RETURN: Return a user-friendly summary.
            return {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment.get("subject"),
                **summary_data,
                "time_taken_minutes": time_taken_minutes,
                "submitted_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to score assessment {assessment_id}: {e}")
            raise

    async def get_assessment_summary(
        self,
        assessment_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get summary statistics for a completed assessment.
        Simplified - just fetch and return results object for completed assessments.
        """
        try:
            logger.info(f"[ASSESSMENT_SERVICE] Fetching assessment summary for {assessment_id}")

            # Get the assessment from Cosmos DB - use get_assessment_for_results to ignore expiration
            assessment = await self.cosmos.get_assessment_for_results(assessment_id, student_id, firebase_uid)
            if not assessment:
                raise ValueError(f"Assessment {assessment_id} not found for student {student_id}")

            # Check assessment status
            status = assessment.get("status")
            if status != "completed":
                raise ValueError(f"Assessment {assessment_id} is not completed yet (status: {status})")

            # For new structure: return the results object if it exists
            results = assessment.get("results")
            if results:
                logger.info(f"[ASSESSMENT_SERVICE] Returning new results structure for assessment {assessment_id}")
                # Include basic assessment metadata with results
                return {
                    "assessment_id": assessment_id,
                    "student_id": student_id,
                    "subject": assessment.get("subject"),
                    "status": status,
                    "completed_at": assessment.get("completed_at"),
                    "time_taken_minutes": assessment.get("time_taken_minutes"),
                    **results  # Spread the results object (summary, skill_analysis, problem_reviews, ai_insights)
                }

            # Fallback for old structure: check for legacy score_data
            score_data = assessment.get("score_data")
            if not score_data:
                raise ValueError(f"Assessment {assessment_id} has no results or score data available")

            logger.warning(f"[ASSESSMENT_SERVICE] Using legacy score_data structure for assessment {assessment_id}")

            # Return legacy format for backward compatibility
            return {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment.get("subject"),
                "status": status,
                "completed_at": assessment.get("completed_at"),
                "time_taken_minutes": assessment.get("time_taken_minutes"),
                "total_questions": score_data.get("total_questions", 0),
                "correct_count": score_data.get("correct_count", 0),
                "score_percentage": score_data.get("score_percentage", 0),
                "skill_breakdown": score_data.get("skill_breakdown", []),
                "problem_reviews": score_data.get("problem_reviews", []),
                "ai_summary": assessment.get("ai_summary", ""),
                "performance_quote": assessment.get("performance_quote", ""),
                "skill_analysis": assessment.get("skill_analysis", [])
            }

        except Exception as e:
            logger.error(f"[ASSESSMENT_SERVICE] Failed to get assessment summary for {assessment_id}: {e}")
            raise

    async def get_assessment_history(
        self,
        student_id: int,
        firebase_uid: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Get a paginated list of completed assessments for a student.

        Args:
            student_id: The student's ID
            firebase_uid: User's Firebase UID for access validation
            page: Page number for pagination (1-based)
            limit: Number of assessments per page

        Returns:
            Dict containing the list of completed assessments and pagination info
        """
        try:
            logger.info(f"[ASSESSMENT_SERVICE] Fetching assessment history for student {student_id}")

            # Get completed assessments from Cosmos DB
            assessments = await self.cosmos.get_completed_assessments(
                student_id=student_id,
                firebase_uid=firebase_uid,
                page=page,
                limit=limit
            )

            # Transform assessments to history format
            history_items = []
            for assessment in assessments:
                # Extract summary data from results or legacy score_data
                results = assessment.get("results", {})
                summary = results.get("summary", {})

                # Fallback to legacy format if new format not available
                if not summary:
                    score_data = assessment.get("score_data", {})
                    total_questions = score_data.get("total_questions", assessment.get("total_questions", 0))
                    correct_count = score_data.get("correct_count", 0)
                    score_percentage = score_data.get("score_percentage", 0.0)
                else:
                    total_questions = summary.get("total_questions", 0)
                    correct_count = summary.get("correct_count", 0)
                    score_percentage = summary.get("score_percentage", 0.0)

                history_item = {
                    "assessment_id": assessment.get("assessment_id"),
                    "subject": assessment.get("subject"),
                    "completed_at": assessment.get("completed_at"),
                    "total_questions": total_questions,
                    "correct_count": correct_count,
                    "score_percentage": score_percentage
                }
                history_items.append(history_item)

            # Get total count for pagination
            total_count = await self.cosmos.get_completed_assessments_count(
                student_id=student_id,
                firebase_uid=firebase_uid
            )

            return {
                "assessments": history_items,
                "total_count": total_count,
                "page": page,
                "limit": limit
            }

        except Exception as e:
            logger.error(f"[ASSESSMENT_SERVICE] Failed to get assessment history for student {student_id}: {e}")
            raise

    def _extract_problem_content_for_review(self, problem: Dict[str, Any]) -> Dict[str, Any]:
        """Extract question, correct answer, and other relevant content from problem for review data"""

        # Initialize content with common fields
        content = {
            "difficulty": problem.get("difficulty", "medium"),
            "metadata": problem.get("assessment_metadata", {})
        }

        # Extract content based on problem type - check direct problem properties
        problem_type = problem.get("problem_type", "")

        if problem_type == "true_false" or problem.get("statement") is not None:
            # True/False problem
            content.update({
                "statement": problem.get("statement", ""),
                "correct": problem.get("correct"),
                "question": problem.get("statement", ""),  # Also set as question for AI processing
                "prompt": "Decide whether the statement is True or False.",
                "rationale": problem.get("rationale", ""),
                "allow_explain_why": False,
                "trickiness": "none"
            })
        elif problem_type == "multiple_choice" or problem.get("question"):
            # Multiple choice or other question-based problems
            content.update({
                "question": problem.get("question", ""),
                "options": problem.get("options", []),
                "correct_option_id": problem.get("correct_option_id", ""),
                "rationale": problem.get("rationale", "")
            })
        elif problem_type == "fill_in_blanks" or problem.get("text_with_blanks"):
            # Fill in the blank
            content.update({
                "text_with_blanks": problem.get("text_with_blanks", ""),
                "question": problem.get("text_with_blanks", ""),  # Also set as question for AI processing
                "blanks": problem.get("blanks", []),
                "rationale": problem.get("rationale", "")
            })
        elif problem_type == "matching_activity" or problem.get("prompt"):
            # Matching or other activity-based problems
            content.update({
                "prompt": problem.get("prompt", ""),
                "question": problem.get("prompt", ""),  # Also set as question for AI processing
                "left_items": problem.get("left_items", []),
                "right_items": problem.get("right_items", []),
                "mappings": problem.get("mappings", []),
                "rationale": problem.get("rationale", "")
            })
        elif problem_type == "scenario_question":
            # Scenario question
            content.update({
                "scenario": problem.get("scenario", ""),
                "scenario_question": problem.get("scenario_question", ""),
                "question": problem.get("scenario_question", ""),  # Also set as question for AI processing
                "scenario_answer": problem.get("scenario_answer", ""),
                "rationale": problem.get("rationale", "")
            })
        else:
            # Fallback for unknown problem types
            content.update({
                "question": problem.get("problem", "Question not available"),
                "answer": problem.get("answer", ""),
                "rationale": problem.get("rationale", "")
            })

        return content

    async def _store_ai_summary_in_assessment(
        self,
        assessment_id: str,
        student_id: int,
        ai_summary_fields: Dict[str, Any],
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Store AI summary data directly in the assessment document structure (no duplication)"""
        try:
            # Get the current assessment document
            assessment = await self.cosmos.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                logger.error(f"Assessment {assessment_id} not found for storing AI summary")
                return False

            # Add AI summary to top level of assessment document (clean structure)
            assessment.update(ai_summary_fields)
            assessment["ai_summary_generated_at"] = datetime.utcnow().isoformat()

            # Update the assessment document in Cosmos DB
            self.cosmos.assessments.upsert_item(body=assessment)

            logger.info(f"Successfully stored AI summary in assessment document {assessment_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to store AI summary in assessment {assessment_id}: {e}")
            return False

    async def _create_assessment_review(
        self,
        problem_data: Dict[str, Any],
        student_answer: Any,
        student_id: int,
        firebase_uid: str
    ) -> AssessmentProblemReview:
        """Create structured assessment review for a single problem"""

        problem_type = problem_data.get("problem_type", "unknown")
        is_correct = False
        selected_answer_text = "Not answered"

        if student_answer is not None:
            # Evaluate based on problem type
            if problem_type == "multiple_choice":
                correct_option_id = problem_data.get("correct_option_id")

                # Extract selected option ID from student answer
                if isinstance(student_answer, dict) and "selected_option_id" in student_answer:
                    selected_option_id = student_answer["selected_option_id"]
                else:
                    selected_option_id = str(student_answer)

                is_correct = selected_option_id == correct_option_id

                # Find the selected option text
                options = problem_data.get("options", [])
                selected_option = next((opt for opt in options if opt.get("id") == selected_option_id), None)
                selected_answer_text = selected_option.get("text", selected_option_id) if selected_option else selected_option_id

            elif problem_type == "true_false":
                correct_answer = problem_data.get("correct")

                # Extract selected answer from student answer
                if isinstance(student_answer, dict) and "selected_answer" in student_answer:
                    selected_boolean = student_answer["selected_answer"]
                else:
                    selected_boolean = bool(student_answer)

                is_correct = selected_boolean == correct_answer
                selected_answer_text = "True" if selected_boolean else "False"

            elif problem_type == "fill_in_blanks":
                # Simple check - could be enhanced
                blanks = problem_data.get("blanks", [])
                if isinstance(student_answer, dict):
                    correct_count = 0
                    for blank in blanks:
                        blank_id = blank.get("id")
                        correct_answers = blank.get("correct_answers", [])
                        student_blank_answer = student_answer.get(blank_id, "")
                        if student_blank_answer.lower() in [ans.lower() for ans in correct_answers]:
                            correct_count += 1
                    is_correct = correct_count == len(blanks)
                    selected_answer_text = str(student_answer)
                else:
                    selected_answer_text = str(student_answer)

            elif problem_type == "categorization_activity":
                # Check categorization answers
                categorization_items = problem_data.get("categorization_items", [])
                if isinstance(student_answer, dict) and "student_categorization" in student_answer:
                    student_categorization = student_answer["student_categorization"]
                    correct_count = 0
                    total_items = len(categorization_items)

                    for item in categorization_items:
                        item_text = item.get("item_text")
                        correct_category = item.get("correct_category")
                        student_category = student_categorization.get(item_text)

                        if student_category == correct_category:
                            correct_count += 1

                    is_correct = correct_count == total_items
                    selected_answer_text = str(student_categorization)
                else:
                    selected_answer_text = str(student_answer)

            else:
                # For other problem types, basic handling
                selected_answer_text = str(student_answer)
                # Could add more sophisticated evaluation logic here

        score = 10 if is_correct else 3
        accuracy_percentage = 100 if is_correct else 30

        # Create structured review matching submission service format
        review_data = {
            "observation": {
                "canvas_description": "No canvas work for this categorization question" if problem_type == "categorization_activity"
                                    else "No canvas work for this assessment question",
                "selected_answer": selected_answer_text if student_answer is not None else "{}",
                "work_shown": "Student categorized items into provided categories" if problem_type == "categorization_activity"
                            else ("Assessment response provided" if student_answer is not None else "No response provided")
            },
            "analysis": {
                "understanding": "Good understanding demonstrated" if is_correct else "Student needs additional practice with this concept.",
                "approach": "Student selected an answer" if student_answer is not None else "No approach shown",
                "accuracy": "Correct answer" if is_correct else "Incorrect answer",
                "creativity": "Standard categorization response" if problem_type == "categorization_activity"
                            else "Standard assessment response"
            },
            "evaluation": {
                "score": score,
                "justification": f"Student correctly categorized {selected_answer_text.count('correct') if 'correct' in str(selected_answer_text) else 0} out of {len(problem_data.get('categorization_items', []))} items"
                               if problem_type == "categorization_activity" and not is_correct
                               else f"{'Correct' if is_correct else 'Incorrect'} answer for assessment question"
            },
            "feedback": {
                "praise": "Good work!" if is_correct else "Good effort on this question!",
                "guidance": problem_data.get("teaching_note", problem_data.get("rationale", "Review the concept")) if not is_correct else "Well done!",
                "encouragement": "Keep practicing!" if not is_correct else "Excellent!",
                "next_steps": "Continue to next question" if is_correct else "Review this topic"
            },
            "skill_id": problem_data.get("skill_id", "unknown"),
            "subject": problem_data.get("subject", "unknown"),
            "subskill_id": problem_data.get("subskill_id", "unknown"),
            "score": score,
            "correct": is_correct,
            "accuracy_percentage": accuracy_percentage,
            "selected_answer_text": selected_answer_text if student_answer is not None else "Not answered"
        }

        # Return structured review that matches both assessment format and submission service metadata
        review = AssessmentProblemReview(
            observation=AssessmentReviewObservation(
                canvas_description=review_data["observation"]["canvas_description"],
                selected_answer=review_data["observation"]["selected_answer"],
                work_shown=review_data["observation"]["work_shown"]
            ),
            analysis=AssessmentReviewAnalysis(
                understanding=review_data["analysis"]["understanding"],
                approach=review_data["analysis"]["approach"],
                accuracy=review_data["analysis"]["accuracy"],
                creativity=review_data["analysis"]["creativity"]
            ),
            evaluation=AssessmentReviewEvaluation(
                score=score,
                justification=review_data["evaluation"]["justification"]
            ),
            feedback=AssessmentReviewFeedback(
                praise=review_data["feedback"]["praise"],
                guidance=review_data["feedback"]["guidance"],
                encouragement=review_data["feedback"]["encouragement"],
                next_steps=review_data["feedback"]["next_steps"]
            ),
            skill_id=review_data["skill_id"],
            subject=review_data["subject"],
            subskill_id=review_data["subskill_id"],
            score=score,
            correct=is_correct,
            accuracy_percentage=accuracy_percentage
        )

        return review

    def _convert_submission_review_to_assessment_review(
        self,
        submission_review: Dict[str, Any],
        problem_data: Dict[str, Any],
        student_id: int
    ) -> AssessmentProblemReview:
        """Convert submission service review to structured assessment review format"""

        # Extract data from submission review with fallbacks
        observation_data = submission_review.get("observation", {})
        analysis_data = submission_review.get("analysis", {})
        evaluation_data = submission_review.get("evaluation", {})
        feedback_data = submission_review.get("feedback", {})

        score = evaluation_data.get("score", submission_review.get("score", 0))
        is_correct = submission_review.get("correct", score >= 7)

        return AssessmentProblemReview(
            observation=AssessmentReviewObservation(
                canvas_description=observation_data.get("canvas_description", "No canvas work"),
                selected_answer=observation_data.get("selected_answer", "Not provided"),
                work_shown=observation_data.get("work_shown", "Assessment response")
            ),
            analysis=AssessmentReviewAnalysis(
                understanding=analysis_data.get("understanding", "Understanding assessed"),
                approach=analysis_data.get("approach", "Standard assessment approach"),
                accuracy=analysis_data.get("accuracy", "Correct" if is_correct else "Incorrect"),
                creativity=analysis_data.get("creativity", "Standard response")
            ),
            evaluation=AssessmentReviewEvaluation(
                score=score,
                justification=evaluation_data.get("justification", f"Score: {score}/10")
            ),
            feedback=AssessmentReviewFeedback(
                praise=feedback_data.get("praise", "Good effort!"),
                guidance=feedback_data.get("guidance", "Keep practicing"),
                encouragement=feedback_data.get("encouragement", "You're doing well!"),
                next_steps=feedback_data.get("next_steps", "Continue learning")
            ),
            skill_id=problem_data.get("skill_id", "unknown"),
            subject=problem_data.get("subject", "unknown"),
            subskill_id=problem_data.get("subskill_id", "unknown"),
            score=score,
            correct=is_correct,
            accuracy_percentage=100 if is_correct else 30
        )

