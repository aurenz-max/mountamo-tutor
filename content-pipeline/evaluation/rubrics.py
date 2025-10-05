"""
Pydantic models for structured evaluation data.

Defines the schema for evaluation results across all three tiers:
- Tier 1: Structural validation results
- Tier 2: Heuristic quality metrics
- Tier 3: LLM-as-judge evaluations
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ============================================================================
# TIER 1: STRUCTURAL VALIDATION
# ============================================================================

class StructuralResult(BaseModel):
    """Results from structural/schema validation"""
    passed: bool = Field(description="Whether the problem passes structural validation")
    issues: List[str] = Field(default_factory=list, description="List of structural issues found")
    required_fields_present: bool = Field(description="All required fields are present")
    valid_enums: bool = Field(description="All enum values are valid")
    valid_types: bool = Field(description="All field types are correct")
    visual_intent_valid: Optional[bool] = Field(None, description="Visual intent structure is valid (if applicable)")


# ============================================================================
# TIER 2: HEURISTIC VALIDATION
# ============================================================================

class VisualCoherence(BaseModel):
    """Visual coherence and UI rendering checks"""
    passes_constraints: bool = Field(description="Passes all visual coherence constraints")
    max_char_count: int = Field(description="Maximum character count across all fields")
    longest_word_length: int = Field(description="Length of the longest word")
    max_line_breaks: int = Field(description="Maximum line breaks in any field")
    has_overflow_risk: bool = Field(description="Risk of UI overflow/text truncation")
    has_forbidden_content: bool = Field(description="Contains HTML tags or special characters")
    issues: List[str] = Field(default_factory=list, description="Visual coherence issues")

    # Field-specific metrics
    question_char_count: Optional[int] = Field(None, description="Character count of question/statement")
    options_max_char: Optional[int] = Field(None, description="Max character count across options")
    teaching_note_char_count: Optional[int] = Field(None, description="Character count of teaching note")


class HeuristicReport(BaseModel):
    """Comprehensive heuristic quality metrics"""
    # Readability
    readability_score: float = Field(description="Flesch-Kincaid grade level")
    readability_appropriate: bool = Field(description="Readability matches target grade level")

    # Content Quality
    has_placeholders: bool = Field(description="Contains placeholder text like [INSERT], TODO")
    total_char_count: int = Field(description="Total character count of problem")
    word_count: int = Field(description="Total word count")

    # Visual Coherence
    visual_coherence: VisualCoherence = Field(description="Visual coherence metrics")

    # Overall Pass/Fail
    passed: bool = Field(description="Passes all heuristic checks")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")
    failures: List[str] = Field(default_factory=list, description="Fatal failures")


# ============================================================================
# TIER 3: LLM-AS-JUDGE
# ============================================================================

class GeminiJudgment(BaseModel):
    """Gemini-powered pedagogical evaluation"""
    # Chain-of-thought reasoning
    reasoning: str = Field(description="Step-by-step critical analysis from the model")

    # Pedagogical Approach (NEW - evaluates if problem format is effective for the skill)
    pedagogical_approach_score: int = Field(ge=1, le=10, description="Score for effectiveness of the chosen problem format (1-10)")
    pedagogical_approach_justification: str = Field(description="Critique of the problem format's suitability for this skill")

    # Pedagogical Alignment (evaluates if content matches the subskill)
    alignment_score: int = Field(ge=1, le=10, description="Alignment score with the specific subskill (1-10)")
    alignment_justification: str = Field(description="Justification for alignment score")

    # Clarity
    clarity_score: int = Field(ge=1, le=10, description="Clarity and age-appropriateness score (1-10)")
    clarity_justification: str = Field(description="Justification for clarity score")

    # Correctness
    correctness_score: int = Field(ge=1, le=10, description="Correctness of answer and rationale (1-10)")
    correctness_justification: str = Field(description="Justification for correctness score")

    # Visual Quality (optional)
    visual_score: Optional[int] = Field(None, ge=1, le=10, description="Visual quality score (1-10) if applicable")
    visual_justification: Optional[str] = Field(None, description="Justification for visual score")

    # Bias Detection
    bias_score: int = Field(ge=1, le=10, description="Bias/inclusivity score (10 = unbiased)")
    bias_justification: str = Field(description="Justification for bias score")

    # Overall Assessment
    overall_quality: Literal["excellent", "good", "needs_revision", "unacceptable"] = Field(
        description="Overall quality assessment"
    )
    recommended_action: Literal["approve", "approve_with_suggestions", "revise", "reject"] = Field(
        description="Recommended action"
    )
    improvement_suggestions: List[str] = Field(
        default_factory=list,
        description="Specific suggestions for improvement"
    )

    # Model metadata
    model_used: str = Field(description="Gemini model used for evaluation")
    evaluation_timestamp: str = Field(description="ISO timestamp of evaluation")


# ============================================================================
# AGGREGATED EVALUATION REPORT
# ============================================================================

class EvaluationReport(BaseModel):
    """Complete evaluation report combining all three tiers"""
    # Problem identification
    problem_id: str = Field(description="Unique problem identifier")
    problem_type: str = Field(description="Type of problem (multiple_choice, true_false, etc.)")

    # Curriculum context
    subject: str = Field(description="Subject area")
    skill_id: Optional[str] = Field(None, description="Skill identifier")
    subskill_id: Optional[str] = Field(None, description="Subskill identifier")
    grade_level: str = Field(description="Target grade level")

    # Generation metadata
    generation_successful: bool = Field(description="Problem generated successfully")
    generation_time_ms: Optional[float] = Field(None, description="Time to generate problem in milliseconds")

    # Tier 1: Structural
    structural_validation: StructuralResult = Field(description="Structural validation results")

    # Tier 2: Heuristics
    heuristics: HeuristicReport = Field(description="Heuristic quality metrics")

    # Tier 3: LLM Judge
    llm_judgment: Optional[GeminiJudgment] = Field(None, description="LLM evaluation (if applicable)")

    # Final Recommendation
    final_recommendation: Literal["approve", "revise", "reject"] = Field(
        description="Final recommendation based on all tiers"
    )
    overall_score: Optional[float] = Field(None, description="Composite score (0-10)")

    # Raw data
    raw_problem_json: Optional[str] = Field(None, description="Raw problem JSON for debugging")

    def calculate_overall_score(self) -> float:
        """Calculate composite score from all tiers with emphasis on pedagogical approach"""
        if not self.llm_judgment:
            return 0.0

        # New Weighting: Approach 40%, Alignment 20%, Correctness 20%, Clarity 10%, Bias 10%
        score = (
            self.llm_judgment.pedagogical_approach_score * 0.4 +
            self.llm_judgment.alignment_score * 0.2 +
            self.llm_judgment.correctness_score * 0.2 +
            self.llm_judgment.clarity_score * 0.1 +
            self.llm_judgment.bias_score * 0.1
        )

        # Penalize if structural or heuristic failures
        if not self.structural_validation.passed:
            score *= 0.5
        if not self.heuristics.passed:
            score *= 0.7

        return round(score, 2)

    def determine_final_recommendation(self) -> Literal["approve", "revise", "reject"]:
        """Determine final recommendation based on all tiers"""
        # Reject if structural validation fails
        if not self.structural_validation.passed:
            return "reject"

        # Reject if critical heuristic failures
        if self.heuristics.visual_coherence.has_overflow_risk and not self.heuristics.passed:
            return "reject"

        # If we have LLM judgment, use it
        if self.llm_judgment:
            if self.llm_judgment.recommended_action == "reject":
                return "reject"
            elif self.llm_judgment.recommended_action == "revise":
                return "revise"
            elif self.llm_judgment.recommended_action in ["approve", "approve_with_suggestions"]:
                # Only approve if heuristics also pass
                return "approve" if self.heuristics.passed else "revise"

        # Default to revise if uncertain
        return "revise"
