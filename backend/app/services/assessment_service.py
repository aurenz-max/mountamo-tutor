import asyncio
import logging
import random
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

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
                        "subject": unit.get('subject')  # Include subject for verification
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

            # 3. Generate problems using ProblemService
            problems = await self.problems.generate_problem(
                subject=subject,
                recommendations=recommendations,
                count=question_count
            )

            # 4. Parse the JSON response from ProblemService
            if isinstance(problems, str):
                import json
                try:
                    problems_data = json.loads(problems)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse problems JSON: {e}")
                    raise ValueError("Invalid problems JSON response")
            else:
                problems_data = problems

            # 5. Enrich problems with assessment metadata
            enriched_problems = self._enrich_problems_with_metadata(
                problems_data, blueprint['selected_subskills'], subject
            )

            # 6. Build final assessment response - convert structured problems to dict for serialization
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
                "subskill_id": subskill.get('subskill_id'),
                "subskill_description": subskill.get('subskill_description'),
                "skill_id": subskill.get('skill_id'),
                "skill_description": subskill.get('skill_description'),
                "unit_id": subskill.get('unit_id'),
                "unit_title": subskill.get('unit_title'),
                "assessment_category": subskill.get('category')  # Track which category this is from
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

    async def store_batch_submission(
        self,
        assessment_id: str,
        student_id: int,
        batch_response,  # BatchSubmissionResponse
        firebase_uid: Optional[str] = None
    ) -> bool:
        """Store batch submission results in assessment document"""
        try:
            # Get the current assessment document
            assessment = await self.cosmos.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                logger.error(f"Assessment {assessment_id} not found for storing batch submission")
                return False

            # Convert batch response to dict for storage
            if hasattr(batch_response, 'dict'):
                batch_data = batch_response.dict()
            else:
                batch_data = batch_response

            # Add batch submission field to assessment document
            assessment["batch_submission"] = {
                "batch_id": batch_data.get("batch_id"),
                "submission_results": [
                    result.dict() if hasattr(result, 'dict') else result
                    for result in batch_data.get("submission_results", [])
                ],
                "total_problems": batch_data.get("total_problems", 0),
                "batch_submitted_at": batch_data.get("batch_submitted_at"),
                "engagement_summary": {
                    "total_xp_earned": 0,  # Will be filled by engagement decorator
                    "streak_bonus": 0,
                    "level_up": False
                }
            }

            # Compute score data to mark assessment as completed
            submission_results = batch_data.get("submission_results", [])
            total_score = 0
            correct_count = 0
            total_questions = len(submission_results)

            for result in submission_results:
                if hasattr(result, 'dict'):
                    result_data = result.dict()
                else:
                    result_data = result

                # Extract score from review data
                review = result_data.get("review", {})
                if isinstance(review.get("evaluation"), dict):
                    score = review["evaluation"].get("score", 0)
                elif isinstance(review.get("evaluation"), (int, float)):
                    score = review["evaluation"]
                else:
                    score = review.get("score", 0)

                total_score += score
                if score >= 7:  # Consider 7+ as correct
                    correct_count += 1

            # Add score data to mark as completed
            assessment["score_data"] = {
                "total_score": total_score,
                "max_possible_score": total_questions * 10,
                "correct_count": correct_count,
                "total_questions": total_questions,
                "percentage_score": (total_score / (total_questions * 10)) * 100 if total_questions > 0 else 0,
                "percentage_correct": (correct_count / total_questions) * 100 if total_questions > 0 else 0,
                "completed_at": batch_data.get("batch_submitted_at"),
                "completion_method": "batch_submission"
            }

            # Update the assessment document in Cosmos DB
            self.cosmos.assessments.upsert_item(body=assessment)

            logger.info(f"Successfully stored batch submission in assessment document {assessment_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to store batch submission in assessment {assessment_id}: {e}")
            return False

    async def score_assessment(
        self,
        assessment_id: str,
        student_id: int,
        answers: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Scores an assessment by processing each problem through the SubmissionService,
        aggregates results, calculates skill breakdowns, and awards XP.

        CRITICAL: This method processes ALL problems in the assessment, not just submitted answers.
        Unanswered questions are marked as incorrect to ensure accurate scoring.
        """
        try:
            assessment = await self.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                raise ValueError(f"Assessment {assessment_id} not found for student {student_id}")

            problems = assessment.get("problems", [])
            total_questions = len(problems)
            if total_questions == 0:
                raise ValueError("Assessment contains no problems to score.")

            correct_count = 0
            skill_results: Dict[str, Dict[str, Any]] = {}
            problem_reviews = []  # Store review data for each problem

            user_context = {"firebase_uid": firebase_uid, "student_id": student_id, "email": ""} # Mock context for service

            # Get blueprint for skill description lookup
            blueprint = assessment.get("blueprint", {})
            selected_subskills = blueprint.get("selected_subskills", [])

            # Create a mapping from skill_id to skill_description
            skill_id_to_description = {}
            for subskill in selected_subskills:
                skill_id = subskill.get("skill_id")
                skill_description = subskill.get("skill_description")
                if skill_id and skill_description:
                    skill_id_to_description[skill_id] = skill_description

            # === CORE FIX: Loop through ALL problems, not just submitted answers ===
            # This ensures every problem is accounted for in the final score
            for problem in problems:
                problem_id_str = str(problem.get("id") or problem.get("problem_id"))

                # Extract skill description from the problem, using blueprint lookup first
                skill_id = problem.get("skill_id", "")
                skill_desc = (
                    skill_id_to_description.get(skill_id) or  # Use blueprint lookup first
                    problem.get("skill_description") or
                    problem.get("assessment_metadata", {}).get("skill_description") or
                    problem.get("metadata", {}).get("skill_description") or
                    "General"
                )

                # Initialize skill in tracker if not present
                if skill_desc not in skill_results:
                    skill_results[skill_desc] = {"correct": 0, "total": 0, "skill_name": skill_desc}
                skill_results[skill_desc]["total"] += 1  # Increment total for this skill

                student_answer_raw = answers.get(problem_id_str)

                review_data = None
                is_correct = False
                display_student_answer = "Not Answered"

                if student_answer_raw is not None:
                    # --- This is an ANSWERED question ---
                    # Handle different answer formats for submission service
                    student_answer = None
                    primitive_response = None

                    if isinstance(student_answer_raw, dict):
                        # Interactive problem answer (MCQ, etc.) - use primitive_response
                        primitive_response = student_answer_raw
                        student_answer = ""  # Set to empty string for schema compliance
                    elif isinstance(student_answer_raw, str):
                        # Text-based answer - use student_answer
                        student_answer = student_answer_raw
                    else:
                        # Convert other types to string
                        student_answer = str(student_answer_raw)

                    # Construct a ProblemSubmission object for the service
                    submission_payload = ProblemSubmission(
                        subject=assessment.get("subject", "general"),
                        problem=problem,
                        student_answer=student_answer,
                        primitive_response=primitive_response,
                        solution_image=None,  # Not applicable for most assessment questions
                        canvas_used=False,
                        skill_id=problem.get("assessment_metadata", {}).get("skill_id") or problem.get("skill_id", "default_skill"),
                        subskill_id=problem.get("assessment_metadata", {}).get("subskill_id") or problem.get("subskill_id", "default_subskill"),
                    )

                    try:
                        submission_result = await self.submission_service.handle_submission(submission_payload, user_context)
                        review_data = submission_result.review
                        is_correct = review_data.get("correct") or review_data.get("score", 0) >= 7

                        # **CRITICAL FIX for "No answer recorded"**: Extract the actual answer text
                        if isinstance(student_answer_raw, dict):  # For MCQ
                            display_student_answer = review_data.get("observation", {}).get("selected_answer_text") or review_data.get("selected_option_text", "Answer Submitted")
                        else:
                            display_student_answer = str(student_answer_raw)

                    except Exception as e:
                        logger.error(f"Error processing submitted answer for problem {problem_id_str}: {e}")
                        is_correct = False  # Treat submission error as incorrect
                        review_data = {"error": str(e), "score": 0, "correct": False}
                        display_student_answer = "Submission Error"

                else:
                    # --- This is an UNANSWERED question ---
                    is_correct = False
                    display_student_answer = "Not Answered"
                    # Create structured review for unanswered questions
                    review_data = await self._create_assessment_review(
                        problem, None, student_id, firebase_uid
                    )

                # --- Aggregate results for EVERY problem ---
                if is_correct:
                    correct_count += 1
                    skill_results[skill_desc]["correct"] += 1

                # --- Create structured review document for EVERY problem ---
                # Extract the review if it's from submission service or use our assessment review
                if isinstance(review_data, dict) and 'observation' in review_data:
                    # This is already a structured review from submission service - convert it
                    structured_review = self._convert_submission_review_to_assessment_review(
                        review_data, problem, student_id
                    )
                elif hasattr(review_data, 'observation'):
                    # This is already an AssessmentProblemReview
                    structured_review = review_data
                else:
                    # Fallback for legacy review format
                    structured_review = await self._create_assessment_review(
                        problem, student_answer_raw, student_id, firebase_uid
                    )

                # Create review document matching JSON structure
                review_document = AssessmentReviewDocument(
                    id=f"{assessment_id}_{problem_id_str}_{int(datetime.utcnow().timestamp())}",
                    student_id=student_id,
                    subject=assessment.get("subject", "Unknown"),
                    skill_id=problem.get("skill_id", "unknown"),
                    subskill_id=problem.get("subskill_id", "unknown"),
                    problem_id=problem_id_str,
                    timestamp=datetime.utcnow().isoformat(),
                    problem_content=problem,
                    full_review=structured_review,
                    observation=structured_review.observation,
                    analysis=structured_review.analysis,
                    evaluation=structured_review.evaluation,
                    feedback=structured_review.feedback,
                    score=structured_review.score,
                    firebase_uid=firebase_uid or "",
                    created_at=datetime.utcnow().isoformat()
                )

                problem_reviews.append(review_document.dict())

            score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0

            # Format skill breakdown for response
            skill_breakdown_list = []
            for skill_name, data in skill_results.items():
                percentage = round((data["correct"] / data["total"] * 100) if data["total"] > 0 else 0)
                skill_breakdown_list.append({
                    "skill_name": skill_name,
                    "correct_answers": data["correct"],
                    "total_questions": data["total"],
                    "percentage": percentage,
                })

            # Create final score data payload
            score_data = {
                "correct_count": correct_count,
                "total_questions": total_questions,
                "score_percentage": score_percentage,
                "skill_breakdown": skill_breakdown_list,
                "problem_reviews": problem_reviews,  # Embed all review data
                "submitted_at": datetime.utcnow().isoformat()
            }

            # Generate AI summary using the assessment blueprint and results
            try:
                logger.info(f"Generating AI summary for assessment {assessment_id}")

                # Use all problem reviews for comprehensive feedback (both correct and incorrect)
                # The AI service will prioritize incorrect ones in the review_items section
                ai_summary_data = await self.ai_assessment.generate_enhanced_assessment_summary(
                    blueprint=assessment.get("blueprint", {}),
                    submission_result=score_data,
                    review_items_data=problem_reviews  # Pass all reviews for complete context
                )

                # Extract AI summary data - store only at top level to avoid duplication
                ai_summary_fields = {
                    "ai_summary": ai_summary_data.get("ai_summary", ""),
                    "performance_quote": ai_summary_data.get("performance_quote", ""),
                    "skill_analysis": ai_summary_data.get("skill_analysis", []),
                    "common_misconceptions": ai_summary_data.get("common_misconceptions", []),
                    "review_items": ai_summary_data.get("review_items", [])
                }

                logger.info(f"AI summary generated successfully for assessment {assessment_id}")

            except Exception as e:
                logger.error(f"Failed to generate AI summary for assessment {assessment_id}: {e}")
                # Continue without AI summary - assessment submission should not fail
                ai_summary_fields = {
                    "ai_summary": "",
                    "performance_quote": "",
                    "skill_analysis": [],
                    "common_misconceptions": [],
                    "review_items": []
                }

            # Store submission and update assessment status in Cosmos DB
            await self.cosmos.store_assessment_submission(
                assessment_id, student_id, answers, score_data, time_taken_minutes, firebase_uid
            )

            # Store AI summary data directly in the assessment document for easy access
            # Pass the extracted AI fields to avoid duplication
            await self._store_ai_summary_in_assessment(
                assessment_id, student_id, ai_summary_fields, firebase_uid
            )

            await self.update_assessment_status(assessment_id, student_id, "completed", firebase_uid)

            # Engagement processing is handled by the @log_engagement_activity decorator on the endpoint

            # Return the full submission result
            return {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment.get("subject"),
                "total_questions": total_questions,
                "correct_count": correct_count,
                "score_percentage": round(score_percentage, 2), # Round for display
                "time_taken_minutes": time_taken_minutes,
                "skill_breakdown": skill_breakdown_list,
                "submitted_at": score_data["submitted_at"]
            }

        except Exception as e:
            logger.error(f"Failed to score assessment {assessment_id}: {e}")
            # Re-raise to be caught by the endpoint handler
            raise

    async def get_assessment_summary(
        self,
        assessment_id: str,
        student_id: int,
        firebase_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get summary statistics for a completed assessment.
        Returns the submission results and scoring data.
        """
        try:
            # Get the assessment from Cosmos DB
            assessment = await self.cosmos.get_assessment(assessment_id, student_id, firebase_uid)
            if not assessment:
                raise ValueError(f"Assessment {assessment_id} not found for student {student_id}")

            # Check if assessment has score data (indicates completion)
            score_data = assessment.get("score_data")
            if not score_data:
                raise ValueError(f"Assessment {assessment_id} has not been completed yet")

            # Extract the submission results directly from assessment document
            answers = assessment.get("answers", {})
            time_taken_minutes = assessment.get("time_taken_minutes")

            # Return enhanced format with AI summary and review items
            # Prioritize top-level AI summary data (clean structure without duplication)
            return {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment.get("subject"),
                "total_questions": score_data.get("total_questions", 0),
                "correct_count": score_data.get("correct_count", 0),
                "score_percentage": score_data.get("score_percentage", 0),
                "time_taken_minutes": time_taken_minutes,
                "skill_breakdown": score_data.get("skill_breakdown", []),
                "submitted_at": score_data.get("submitted_at"),

                # Enhanced assessment feedback fields - prefer top-level data for clean structure
                "ai_summary": assessment.get("ai_summary", ""),
                "performance_quote": assessment.get("performance_quote", ""),
                "skill_analysis": assessment.get("skill_analysis", []),
                "common_misconceptions": assessment.get("common_misconceptions", []),
                "review_items": assessment.get("review_items", []),
                "problem_reviews": score_data.get("problem_reviews", []),  # Still include raw review data
                "ai_summary_generated_at": assessment.get("ai_summary_generated_at")
            }

        except Exception as e:
            logger.error(f"Failed to get assessment summary for {assessment_id}: {e}")
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

        # Create structured review
        review = AssessmentProblemReview(
            observation=AssessmentReviewObservation(
                canvas_description="No canvas work for this assessment question",
                selected_answer=selected_answer_text,
                work_shown="Assessment response provided" if student_answer is not None else "No response provided"
            ),
            analysis=AssessmentReviewAnalysis(
                understanding="Good understanding demonstrated" if is_correct else "Needs additional practice",
                approach="Student selected an answer" if student_answer is not None else "No approach shown",
                accuracy="Correct answer" if is_correct else "Incorrect answer",
                creativity="Standard assessment response"
            ),
            evaluation=AssessmentReviewEvaluation(
                score=score,
                justification=f"{'Correct' if is_correct else 'Incorrect'} answer for assessment question"
            ),
            feedback=AssessmentReviewFeedback(
                praise="Good work!" if is_correct else "Good effort!",
                guidance=problem_data.get("rationale", "Review the concept") if not is_correct else "Well done!",
                encouragement="Keep practicing!" if not is_correct else "Excellent!",
                next_steps="Continue to next question" if is_correct else "Review this topic"
            ),
            skill_id=problem_data.get("skill_id", "unknown"),
            subject=problem_data.get("subject", "unknown"),
            subskill_id=problem_data.get("subskill_id", "unknown"),
            score=score,
            correct=is_correct,
            accuracy_percentage=100 if is_correct else 30
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