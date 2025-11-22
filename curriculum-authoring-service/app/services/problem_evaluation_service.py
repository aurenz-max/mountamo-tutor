"""
Problem Evaluation Service - Orchestrates 3-tier evaluation system

Responsibilities:
- Orchestrate Tier 1 (Structural), Tier 2 (Heuristics), and Tier 3 (LLM Judge)
- Fetch curriculum context for evaluation
- Store complete evaluation results in BigQuery with full metadata
- Support batch evaluation
- Implement short-circuit logic (stop on critical failures)
"""

import logging
import json
from uuid import uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.config import settings
from app.core.database import db
from app.models.problems import (
    ProblemEvaluationResult,
    StructuralValidationResult,
    HeuristicValidationResult,
    VisualCoherence,
    LLMJudgment,
    ProblemInDB
)
from app.evaluation.structural_validator import StructuralValidator
from app.evaluation.heuristics_validator import HeuristicValidator
from app.evaluation.llm_judge import GeminiJudge
from app.evaluation.rubrics import EvaluationReport
from app.services.curriculum_manager import curriculum_manager
from app.services.problem_generator_service import problem_generator_service

logger = logging.getLogger(__name__)


class ProblemEvaluationService:
    """Orchestrates 3-tier evaluation system for practice problems"""

    def __init__(self):
        """Initialize evaluation service with all validators"""
        self.structural_validator = StructuralValidator()
        self.heuristics_validator = HeuristicValidator()
        self._llm_judge = None  # Lazy initialization
        logger.info("✅ ProblemEvaluationService initialized with validators")

    @property
    def llm_judge(self) -> GeminiJudge:
        """Lazy initialization of Gemini judge"""
        if self._llm_judge is None:
            self._llm_judge = GeminiJudge()
        return self._llm_judge

    async def evaluate_problem(
        self,
        problem_id: str,
        skip_llm: bool = False
    ) -> ProblemEvaluationResult:
        """
        Evaluate a problem using the 3-tier system.

        Args:
            problem_id: Problem identifier
            skip_llm: Skip Tier 3 LLM evaluation (for testing or speed)

        Returns:
            ProblemEvaluationResult with complete evaluation data

        Raises:
            ValueError: If problem not found
            RuntimeError: If evaluation storage fails
        """
        logger.info(f"🔍 Evaluating problem {problem_id}")

        # 1. Fetch problem from BigQuery
        problem = await problem_generator_service.get_problem(problem_id)
        if not problem:
            raise ValueError(f"Problem {problem_id} not found")

        # 2. Fetch curriculum context
        curriculum_context = await self._fetch_curriculum_context(
            problem.subskill_id,
            problem.version_id
        )

        grade_level = curriculum_context.get("grade_level", "K")
        problem_json = problem.problem_json

        # Backward compatibility: Add problem_type to JSON if missing
        # (Old problems were stored without this field in the JSON)
        if "problem_type" not in problem_json and problem.problem_type:
            problem_json["problem_type"] = problem.problem_type
            logger.info(f"Added missing problem_type field: {problem.problem_type}")

        # 3. TIER 1: Structural Validation
        logger.info(f"🔍 Tier 1: Structural validation for {problem_id}")
        structural_result = self.structural_validator.validate(problem_json)

        # Convert to API model
        structural_validation = StructuralValidationResult(
            passed=structural_result.passed,
            issues=structural_result.issues,
            required_fields_present=structural_result.required_fields_present,
            valid_enums=structural_result.valid_enums,
            valid_types=structural_result.valid_types,
            visual_intent_valid=structural_result.visual_intent_valid
        )

        # Short-circuit if structural validation fails
        if not structural_result.passed:
            logger.warning(f"⚠️ Structural validation failed for {problem_id}")
            return await self._store_evaluation(
                problem=problem,
                structural_validation=structural_validation,
                heuristic_validation=None,
                llm_judgment=None,
                final_recommendation="reject",
                overall_score=0.0,
                curriculum_context=curriculum_context
            )

        # 4. TIER 2: Heuristic Validation
        logger.info(f"🔍 Tier 2: Heuristic validation for {problem_id}")
        heuristic_report = self.heuristics_validator.validate(problem_json, grade_level)

        # Convert to API model
        heuristic_validation = HeuristicValidationResult(
            passed=heuristic_report.passed,
            readability_score=heuristic_report.readability_score,
            readability_appropriate=heuristic_report.readability_appropriate,
            has_placeholders=heuristic_report.has_placeholders,
            total_char_count=heuristic_report.total_char_count,
            word_count=heuristic_report.word_count,
            visual_coherence=VisualCoherence(
                passes_constraints=heuristic_report.visual_coherence.passes_constraints,
                max_char_count=heuristic_report.visual_coherence.max_char_count,
                longest_word_length=heuristic_report.visual_coherence.longest_word_length,
                max_line_breaks=heuristic_report.visual_coherence.max_line_breaks,
                has_overflow_risk=heuristic_report.visual_coherence.has_overflow_risk,
                has_forbidden_content=heuristic_report.visual_coherence.has_forbidden_content,
                issues=heuristic_report.visual_coherence.issues
            ),
            warnings=heuristic_report.warnings,
            failures=heuristic_report.failures
        )

        # Short-circuit if critical heuristic failures (overflow risk)
        if heuristic_report.visual_coherence.has_overflow_risk and not heuristic_report.passed:
            logger.warning(f"⚠️ Critical heuristic failure (overflow risk) for {problem_id}")
            return await self._store_evaluation(
                problem=problem,
                structural_validation=structural_validation,
                heuristic_validation=heuristic_validation,
                llm_judgment=None,
                final_recommendation="reject",
                overall_score=0.0,
                curriculum_context=curriculum_context
            )

        # 5. TIER 3: LLM Judge (optional)
        llm_judgment = None
        if not skip_llm:
            try:
                logger.info(f"🔍 Tier 3: LLM evaluation for {problem_id}")
                gemini_judgment = await self.llm_judge.evaluate_problem(
                    problem_json,
                    curriculum_context
                )

                # Convert to API model
                llm_judgment = LLMJudgment(
                    reasoning=gemini_judgment.reasoning,
                    pedagogical_approach_score=gemini_judgment.pedagogical_approach_score,
                    pedagogical_approach_justification=gemini_judgment.pedagogical_approach_justification,
                    alignment_score=gemini_judgment.alignment_score,
                    alignment_justification=gemini_judgment.alignment_justification,
                    clarity_score=gemini_judgment.clarity_score,
                    clarity_justification=gemini_judgment.clarity_justification,
                    correctness_score=gemini_judgment.correctness_score,
                    correctness_justification=gemini_judgment.correctness_justification,
                    bias_score=gemini_judgment.bias_score,
                    bias_justification=gemini_judgment.bias_justification,
                    overall_quality=gemini_judgment.overall_quality,
                    recommended_action=gemini_judgment.recommended_action,
                    improvement_suggestions=gemini_judgment.improvement_suggestions,
                    evaluation_prompt=None,  # Will be set from gemini_judgment if available
                    evaluation_model=gemini_judgment.model_used,
                    evaluation_temperature=0.3,  # Default from GeminiJudge
                    evaluation_timestamp=gemini_judgment.evaluation_timestamp
                )

            except Exception as e:
                logger.error(f"❌ LLM evaluation failed for {problem_id}: {str(e)}")
                # Continue without LLM judgment - graceful degradation

        # 6. Calculate final recommendation and overall score
        evaluation_report = EvaluationReport(
            problem_id=problem_id,
            problem_type=problem.problem_type,
            subject=curriculum_context.get("subject", "unknown"),
            skill_id=curriculum_context.get("skill_id"),
            subskill_id=problem.subskill_id,
            grade_level=grade_level,
            generation_successful=True,
            generation_time_ms=problem.generation_duration_ms,
            structural_validation=structural_result,
            heuristics=heuristic_report,
            llm_judgment=gemini_judgment if llm_judgment else None,
            final_recommendation="revise",  # Will be calculated
            overall_score=None
        )

        final_recommendation = evaluation_report.determine_final_recommendation()
        overall_score = evaluation_report.calculate_overall_score() if llm_judgment else 0.0

        # 7. Store evaluation in BigQuery
        result = await self._store_evaluation(
            problem=problem,
            structural_validation=structural_validation,
            heuristic_validation=heuristic_validation,
            llm_judgment=llm_judgment,
            final_recommendation=final_recommendation,
            overall_score=overall_score,
            curriculum_context=curriculum_context
        )

        logger.info(f"✅ Evaluation complete for {problem_id}: {final_recommendation} (score: {overall_score})")
        return result

    async def batch_evaluate(
        self,
        subskill_id: str,
        version_id: str,
        skip_llm: bool = False
    ) -> List[ProblemEvaluationResult]:
        """
        Evaluate all problems for a subskill.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier
            skip_llm: Skip Tier 3 LLM evaluation

        Returns:
            List of evaluation results
        """
        logger.info(f"🔍 Batch evaluating problems for {subskill_id}")

        # Fetch all problems for subskill
        problems = await problem_generator_service.list_problems_for_subskill(
            subskill_id,
            version_id,
            active_only=False
        )

        if not problems:
            logger.warning(f"⚠️ No problems found for {subskill_id}")
            return []

        # Evaluate each problem
        results = []
        for problem in problems:
            try:
                result = await self.evaluate_problem(problem.problem_id, skip_llm)
                results.append(result)
            except Exception as e:
                logger.error(f"❌ Failed to evaluate {problem.problem_id}: {str(e)}")
                # Continue with other problems

        logger.info(f"✅ Batch evaluation complete: {len(results)}/{len(problems)} problems evaluated")
        return results

    async def get_evaluation(
        self,
        problem_id: str
    ) -> Optional[ProblemEvaluationResult]:
        """
        Get the latest evaluation for a problem.

        Args:
            problem_id: Problem identifier

        Returns:
            Latest evaluation result or None if no evaluation exists
        """
        query = f"""
            SELECT *
            FROM `{settings.get_table_id('problem_evaluations')}`
            WHERE problem_id = @problem_id
            ORDER BY evaluation_timestamp DESC
            LIMIT 1
        """

        # Note: BigQuery parameterized queries in google-cloud-bigquery use @param syntax
        # but the execute_query helper might not support parameters
        # Using string formatting as a workaround (problem_id is UUID, safe from injection)
        query = f"""
            SELECT *
            FROM `{settings.get_table_id('problem_evaluations')}`
            WHERE problem_id = '{problem_id}'
            ORDER BY evaluation_timestamp DESC
            LIMIT 1
        """

        try:
            rows = await db.execute_query(query)
            if not rows:
                return None

            return self._row_to_evaluation(rows[0])
        except Exception as e:
            logger.error(f"❌ Failed to fetch evaluation for {problem_id}: {str(e)}")
            return None

    async def _fetch_curriculum_context(
        self,
        subskill_id: str,
        version_id: str
    ) -> Dict[str, Any]:
        """
        Fetch curriculum context for LLM evaluation.

        Args:
            subskill_id: Subskill identifier
            version_id: Version identifier

        Returns:
            Context dict with subject, skill, subskill info
        """
        try:
            # Get subskill
            subskill = await curriculum_manager.get_subskill(subskill_id)
            if not subskill:
                logger.warning(f"⚠️ Subskill {subskill_id} not found")
                return {}

            # Get skill
            skill = await curriculum_manager.get_skill(subskill.skill_id)
            skill_description = skill.skill_description if skill else "Unknown skill"
            skill_id = skill.skill_id if skill else None

            # Get subject (from skill's unit)
            subject_name = "Unknown subject"
            grade_level = "K"
            if skill and skill.unit_id:
                unit = await curriculum_manager.get_unit(skill.unit_id)
                if unit and unit.subject_id:
                    subject = await curriculum_manager.get_subject(unit.subject_id)
                    if subject:
                        subject_name = subject.subject_name
                        grade_level = subject.grade_level or "K"

            return {
                "subskill_id": subskill_id,
                "subskill_description": subskill.subskill_description,
                "skill_id": skill_id,
                "skill_description": skill_description,
                "subject": subject_name,
                "grade_level": grade_level
            }
        except Exception as e:
            logger.error(f"❌ Failed to fetch curriculum context: {str(e)}")
            return {}

    async def _store_evaluation(
        self,
        problem: ProblemInDB,
        structural_validation: StructuralValidationResult,
        heuristic_validation: Optional[HeuristicValidationResult],
        llm_judgment: Optional[LLMJudgment],
        final_recommendation: str,
        overall_score: float,
        curriculum_context: Dict[str, Any]
    ) -> ProblemEvaluationResult:
        """
        Store evaluation result in BigQuery.

        Args:
            problem: Problem being evaluated
            structural_validation: Tier 1 results
            heuristic_validation: Tier 2 results (optional)
            llm_judgment: Tier 3 results (optional)
            final_recommendation: Final recommendation (approve/revise/reject)
            overall_score: Composite score (0-10)
            curriculum_context: Curriculum metadata

        Returns:
            ProblemEvaluationResult
        """
        evaluation_id = str(uuid4())
        now = datetime.utcnow()

        # Build evaluation report JSON
        evaluation_report = {
            "structural_validation": structural_validation.dict(),
            "heuristic_validation": heuristic_validation.dict() if heuristic_validation else None,
            "llm_judgment": llm_judgment.dict() if llm_judgment else None,
            "final_recommendation": final_recommendation,
            "overall_score": overall_score
        }

        # Prepare row for BigQuery
        row = {
            "evaluation_id": evaluation_id,
            "problem_id": problem.problem_id,
            "evaluation_timestamp": now.isoformat(),

            # Tier 1: Structural
            "tier1_passed": structural_validation.passed,
            "required_fields_present": structural_validation.required_fields_present,
            "valid_enums": structural_validation.valid_enums,
            "valid_types": structural_validation.valid_types,
            "visual_intent_valid": structural_validation.visual_intent_valid,
            "tier1_issues": json.dumps(structural_validation.issues),

            # Tier 2: Heuristics
            "tier2_passed": heuristic_validation.passed if heuristic_validation else False,
            "readability_score": heuristic_validation.readability_score if heuristic_validation else None,
            "readability_appropriate": heuristic_validation.readability_appropriate if heuristic_validation else False,
            "has_placeholders": heuristic_validation.has_placeholders if heuristic_validation else False,
            "total_char_count": heuristic_validation.total_char_count if heuristic_validation else 0,
            "word_count": heuristic_validation.word_count if heuristic_validation else 0,

            # Visual Coherence
            "visual_coherence_passed": heuristic_validation.visual_coherence.passes_constraints if heuristic_validation else False,
            "max_char_count": heuristic_validation.visual_coherence.max_char_count if heuristic_validation else 0,
            "longest_word_length": heuristic_validation.visual_coherence.longest_word_length if heuristic_validation else 0,
            "max_line_breaks": heuristic_validation.visual_coherence.max_line_breaks if heuristic_validation else 0,
            "has_overflow_risk": heuristic_validation.visual_coherence.has_overflow_risk if heuristic_validation else False,
            "has_forbidden_content": heuristic_validation.visual_coherence.has_forbidden_content if heuristic_validation else False,
            "tier2_issues": json.dumps(heuristic_validation.failures) if heuristic_validation else "[]",

            # Tier 3: LLM Judge
            "pedagogical_approach_score": llm_judgment.pedagogical_approach_score if llm_judgment else None,
            "pedagogical_approach_justification": llm_judgment.pedagogical_approach_justification if llm_judgment else None,
            "alignment_score": llm_judgment.alignment_score if llm_judgment else None,
            "alignment_justification": llm_judgment.alignment_justification if llm_judgment else None,
            "clarity_score": llm_judgment.clarity_score if llm_judgment else None,
            "clarity_justification": llm_judgment.clarity_justification if llm_judgment else None,
            "correctness_score": llm_judgment.correctness_score if llm_judgment else None,
            "correctness_justification": llm_judgment.correctness_justification if llm_judgment else None,
            "bias_score": llm_judgment.bias_score if llm_judgment else None,
            "bias_justification": llm_judgment.bias_justification if llm_judgment else None,
            "llm_reasoning": llm_judgment.reasoning if llm_judgment else None,
            "llm_overall_quality": llm_judgment.overall_quality if llm_judgment else None,
            "llm_recommended_action": llm_judgment.recommended_action if llm_judgment else None,
            "llm_suggestions": json.dumps(llm_judgment.improvement_suggestions) if llm_judgment else "[]",

            # LLM Metadata (for replicability)
            "evaluation_prompt": llm_judgment.evaluation_prompt if llm_judgment else None,
            "evaluation_model": llm_judgment.evaluation_model if llm_judgment else None,
            "evaluation_temperature": llm_judgment.evaluation_temperature if llm_judgment else None,

            # Final Results
            "final_recommendation": final_recommendation,
            "overall_score": overall_score,

            # Full report JSON
            "evaluation_report_json": json.dumps(evaluation_report)
        }

        # Insert into BigQuery
        success = await db.insert_rows("problem_evaluations", [row])
        if not success:
            raise RuntimeError(f"Failed to store evaluation for {problem.problem_id}")

        # Build result object
        return ProblemEvaluationResult(
            evaluation_id=evaluation_id,
            problem_id=problem.problem_id,
            evaluation_timestamp=now,
            tier1_passed=structural_validation.passed,
            tier1_issues=structural_validation.issues,
            tier2_passed=heuristic_validation.passed if heuristic_validation else False,
            readability_score=heuristic_validation.readability_score if heuristic_validation else None,
            visual_coherence_passed=heuristic_validation.visual_coherence.passes_constraints if heuristic_validation else False,
            tier2_issues=heuristic_validation.failures if heuristic_validation else [],
            pedagogical_approach_score=llm_judgment.pedagogical_approach_score if llm_judgment else None,
            alignment_score=llm_judgment.alignment_score if llm_judgment else None,
            clarity_score=llm_judgment.clarity_score if llm_judgment else None,
            correctness_score=llm_judgment.correctness_score if llm_judgment else None,
            bias_score=llm_judgment.bias_score if llm_judgment else None,
            llm_reasoning=llm_judgment.reasoning if llm_judgment else None,
            llm_suggestions=llm_judgment.improvement_suggestions if llm_judgment else None,
            final_recommendation=final_recommendation,
            overall_score=overall_score,
            structural_result=structural_validation,
            heuristic_result=heuristic_validation if heuristic_validation else HeuristicValidationResult(
                passed=False,
                total_char_count=0,
                word_count=0,
                visual_coherence=VisualCoherence(
                    passes_constraints=False,
                    max_char_count=0,
                    longest_word_length=0,
                    max_line_breaks=0,
                    has_overflow_risk=False,
                    has_forbidden_content=False,
                    issues=[]
                ),
                warnings=[],
                failures=[]
            ),
            llm_judgment=llm_judgment
        )

    def _row_to_evaluation(self, row: Dict[str, Any]) -> ProblemEvaluationResult:
        """Convert BigQuery row to ProblemEvaluationResult"""
        # Parse JSON fields
        tier1_issues = json.loads(row['tier1_issues']) if isinstance(row['tier1_issues'], str) else row.get('tier1_issues', [])
        tier2_issues = json.loads(row['tier2_issues']) if isinstance(row['tier2_issues'], str) else row.get('tier2_issues', [])
        llm_suggestions = json.loads(row['llm_suggestions']) if isinstance(row['llm_suggestions'], str) else row.get('llm_suggestions', [])

        # Build LLM judgment if available
        llm_judgment = None
        if row.get('pedagogical_approach_score'):
            # Convert evaluation_timestamp to string if it's a datetime object
            eval_timestamp = row.get('evaluation_timestamp', datetime.utcnow())
            if isinstance(eval_timestamp, datetime):
                eval_timestamp = eval_timestamp.isoformat()

            llm_judgment = LLMJudgment(
                reasoning=row.get('llm_reasoning', ''),
                pedagogical_approach_score=row['pedagogical_approach_score'],
                pedagogical_approach_justification=row.get('pedagogical_approach_justification', ''),
                alignment_score=row['alignment_score'],
                alignment_justification=row.get('alignment_justification', ''),
                clarity_score=row['clarity_score'],
                clarity_justification=row.get('clarity_justification', ''),
                correctness_score=row['correctness_score'],
                correctness_justification=row.get('correctness_justification', ''),
                bias_score=row['bias_score'],
                bias_justification=row.get('bias_justification', ''),
                overall_quality=row.get('llm_overall_quality', 'needs_revision'),
                recommended_action=row.get('llm_recommended_action', 'revise'),
                improvement_suggestions=llm_suggestions,
                evaluation_prompt=row.get('evaluation_prompt'),
                evaluation_model=row.get('evaluation_model', 'gemini-flash-latest'),
                evaluation_temperature=row.get('evaluation_temperature', 0.3),
                evaluation_timestamp=eval_timestamp
            )

        return ProblemEvaluationResult(
            evaluation_id=row['evaluation_id'],
            problem_id=row['problem_id'],
            evaluation_timestamp=row['evaluation_timestamp'],
            tier1_passed=row['tier1_passed'],
            tier1_issues=tier1_issues,
            tier2_passed=row['tier2_passed'],
            readability_score=row.get('readability_score'),
            visual_coherence_passed=row['visual_coherence_passed'],
            tier2_issues=tier2_issues,
            pedagogical_approach_score=row.get('pedagogical_approach_score'),
            alignment_score=row.get('alignment_score'),
            clarity_score=row.get('clarity_score'),
            correctness_score=row.get('correctness_score'),
            bias_score=row.get('bias_score'),
            llm_reasoning=row.get('llm_reasoning'),
            llm_suggestions=llm_suggestions,
            final_recommendation=row['final_recommendation'],
            overall_score=row['overall_score'],
            structural_result=StructuralValidationResult(
                passed=row['tier1_passed'],
                issues=tier1_issues,
                required_fields_present=row['required_fields_present'],
                valid_enums=row['valid_enums'],
                valid_types=row['valid_types'],
                visual_intent_valid=row.get('visual_intent_valid')
            ),
            heuristic_result=HeuristicValidationResult(
                passed=row['tier2_passed'],
                readability_score=row.get('readability_score'),
                readability_appropriate=row.get('readability_appropriate', False),
                has_placeholders=row.get('has_placeholders', False),
                total_char_count=row.get('total_char_count', 0),
                word_count=row.get('word_count', 0),
                visual_coherence=VisualCoherence(
                    passes_constraints=row['visual_coherence_passed'],
                    max_char_count=row.get('max_char_count', 0),
                    longest_word_length=row.get('longest_word_length', 0),
                    max_line_breaks=row.get('max_line_breaks', 0),
                    has_overflow_risk=row.get('has_overflow_risk', False),
                    has_forbidden_content=row.get('has_forbidden_content', False),
                    issues=[]
                ),
                warnings=[],  # Not stored in DB separately
                failures=tier2_issues
            ),
            llm_judgment=llm_judgment
        )


# Singleton instance
problem_evaluation_service = ProblemEvaluationService()
