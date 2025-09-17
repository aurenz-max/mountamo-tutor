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
from ..db.cosmos_db import CosmosDBService
from ..schemas.problem_submission import ProblemSubmission

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

            # 2. Extract all subskills from hierarchical data
            all_subskills = self._extract_subskills_from_metrics(metrics_data)

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

    def _extract_subskills_from_metrics(self, metrics_data: Dict) -> List[Dict]:
        """Extract all subskills from the hierarchical metrics structure."""
        all_subskills = []

        for unit in metrics_data.get('hierarchical_data', []):
            for skill in unit.get('skills', []):
                for subskill in skill.get('subskills', []):
                    # Enrich subskill data with parent context
                    subskill_data = {
                        **subskill,
                        "unit_id": unit.get('unit_id'),
                        "unit_title": unit.get('unit_title'),
                        "skill_id": skill.get('skill_id'),
                        "skill_description": skill.get('skill_description')
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
                count=len(recommendations)
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
                problems_data, blueprint['selected_subskills']
            )

            # 6. Build final assessment response
            assessment = {
                "assessment_id": f"assess_{student_id}_{subject}_{int(datetime.utcnow().timestamp())}",
                "student_id": student_id,
                "subject": subject,
                "blueprint": blueprint,
                "problems": enriched_problems,
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
        selected_subskills: List[Dict]
    ) -> List[Dict]:
        """Enrich generated problems with assessment-specific metadata."""
        if not isinstance(problems_data, dict):
            logger.warning("Problems data is not a dict, using as-is")
            return problems_data

        enriched_problems = []

        # Handle different problem types from the rich schema
        problem_types = ['multiple_choice', 'true_false', 'fill_in_blanks', 'matching_activity', 'open_ended']

        subskill_index = 0
        for problem_type in problem_types:
            problems_of_type = problems_data.get(problem_type, [])

            for problem in problems_of_type:
                if subskill_index < len(selected_subskills):
                    subskill = selected_subskills[subskill_index]

                    # Add assessment-specific metadata
                    problem['assessment_metadata'] = {
                        "subskill_id": subskill.get('subskill_id'),
                        "category": subskill.get('category'),
                        "skill_description": subskill.get('skill_description'),
                        "unit_title": subskill.get('unit_title')
                    }

                    subskill_index += 1

                enriched_problems.append(problem)

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

    async def score_assessment(
        self,
        assessment_id: str,
        student_id: int,
        answers: Dict[str, Any],
        time_taken_minutes: Optional[int] = None,
        firebase_uid: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Scores an assessment by processing each answer through the SubmissionService,
        aggregates results, calculates skill breakdowns, and awards XP.
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

            user_context = {"firebase_uid": firebase_uid, "student_id": student_id, "email": ""} # Mock context for service

            # Process each problem submission concurrently
            submission_tasks = []
            for problem in problems:
                problem_id = problem.get("id") or problem.get("problem_id")
                student_answer_raw = answers.get(str(problem_id))  # Ensure problem_id is string for lookup

                # Handle different answer formats
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
                    student_answer = str(student_answer_raw) if student_answer_raw is not None else ""

                # Construct a ProblemSubmission object for the service
                submission_payload = ProblemSubmission(
                    subject=assessment.get("subject", "general"),
                    problem=problem,
                    student_answer=student_answer,
                    primitive_response=primitive_response,  # Add primitive_response for interactive problems
                    solution_image=None,  # Not applicable for most assessment questions
                    canvas_used=False,
                    skill_id=problem.get("assessment_metadata", {}).get("skill_id") or problem.get("skill_id", "default_skill"),
                    subskill_id=problem.get("assessment_metadata", {}).get("subskill_id") or problem.get("subskill_id", "default_subskill"),
                )
                submission_tasks.append(
                    self.submission_service.handle_submission(submission_payload, user_context)
                )

            submission_results = await asyncio.gather(*submission_tasks, return_exceptions=True)

            # Aggregate results
            for i, result in enumerate(submission_results):
                problem = problems[i]
                skill_desc = problem.get("assessment_metadata", {}).get("skill_description") or problem.get("skill_description", "General")

                if isinstance(result, Exception):
                    logger.error(f"Error processing problem {problem.get('id')}: {result}")
                    continue

                if skill_desc not in skill_results:
                    skill_results[skill_desc] = {"correct": 0, "total": 0, "skill_name": skill_desc}

                skill_results[skill_desc]["total"] += 1

                # Check if the answer was correct from the review
                if result.review.get("correct") or result.review.get("score", 0) >= 7:
                    correct_count += 1
                    skill_results[skill_desc]["correct"] += 1

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
                "submitted_at": datetime.utcnow().isoformat()
            }

            # Store submission and update assessment status in Cosmos DB
            await self.cosmos.store_assessment_submission(
                assessment_id, student_id, answers, score_data, time_taken_minutes, firebase_uid
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

            # Return the same format as the submission result
            return {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "subject": assessment.get("subject"),
                "total_questions": score_data.get("total_questions", 0),
                "correct_count": score_data.get("correct_count", 0),
                "score_percentage": score_data.get("score_percentage", 0),
                "time_taken_minutes": time_taken_minutes,
                "skill_breakdown": score_data.get("skill_breakdown", []),
                "submitted_at": score_data.get("submitted_at")
            }

        except Exception as e:
            logger.error(f"Failed to get assessment summary for {assessment_id}: {e}")
            raise