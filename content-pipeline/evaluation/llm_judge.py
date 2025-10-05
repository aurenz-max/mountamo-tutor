"""
Tier 3: Gemini-as-Judge Evaluator

Uses Gemini AI to evaluate pedagogical quality, correctness, clarity, and bias.
Supports both real-time and batch evaluation modes.
"""

import logging
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from google import genai
from google.genai.types import GenerateContentConfig
from .rubrics import GeminiJudgment

logger = logging.getLogger(__name__)


class GeminiJudge:
    """LLM-as-judge using Gemini for pedagogical evaluation"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "flash"  # "flash" or "flash-lite"
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        self.model = model
        self.client = genai.Client(api_key=self.api_key)

        # Map friendly names to actual model IDs
        self.model_map = {
            "flash": "gemini-flash-latest",
            "flash-lite": "gemini-flash-lite-latest"
        }

        logger.info(f"Initialized GeminiJudge with model: {self.model}")

    def _build_evaluation_prompt(
        self,
        problem: Dict[str, Any],
        curriculum_context: Dict[str, Any]
    ) -> str:
        """
        Build the evaluation prompt for Gemini

        Args:
            problem: Problem to evaluate
            curriculum_context: Curriculum metadata (subject, skill, subskill, etc.)

        Returns:
            Formatted prompt string
        """
        problem_type = problem.get("problem_type", "unknown")
        subject = curriculum_context.get("subject", "unknown")
        skill_description = curriculum_context.get("skill_description", "")
        subskill_id = curriculum_context.get("subskill_id", "")
        subskill_description = curriculum_context.get("subskill_description", "")
        grade_level = problem.get("grade_level", curriculum_context.get("grade_level", "K"))

        prompt = f"""You are an expert curriculum developer and a master teacher for grade {grade_level}, tasked with evaluating educational content for deep pedagogical effectiveness.

PROBLEM CONTEXT:
- Subject: {subject}
- Target Skill: {skill_description}
- Target Subskill: {subskill_id} - "{subskill_description}"
- Grade Level: {grade_level}

PROBLEM JSON:
```json
{json.dumps(problem, indent=2)}
```

EVALUATION CRITERIA:
Your evaluation must be critical and discerning. Do not assign high scores lightly.

1. PEDAGOGICAL APPROACH & EFFECTIVENESS (NEW & MOST IMPORTANT)
   - Critically assess the chosen problem format (`{problem_type}`). Is this the most effective way to teach and assess this specific skill for a {grade_level} student?
   - For a foundational, often physical skill like this, how well does a text-based problem work? What are the limitations?
   - Consider alternative formats (e.g., interactive, image-based, hands-on activity description). Would another approach be significantly better?
   - Score reflects how well the *method* matches the *skill*. A perfectly executed but inappropriate problem format should receive a low score here.

2. PEDAGOGICAL ALIGNMENT (REVISED)
   - Assuming the chosen format is acceptable, does this problem *specifically* assess mastery of "{subskill_description}"?
   - Is the difficulty and cognitive load appropriate for a typical {grade_level} student?

3. CLARITY & AGE-APPROPRIATENESS
   - Is the language, vocabulary, and sentence structure simple and unambiguous for this age group?
   - Are instructions minimal and direct?

4. CORRECTNESS
   - Is the content factually accurate? Is the rationale sound and helpful?
   - Are distractors (if any) plausible but clearly incorrect?

5. BIAS & INCLUSIVITY
   - Does the problem use diverse, inclusive, and positive examples?
   - Does it avoid stereotypes and assumptions?

RESPONSE FORMAT:
Think step-by-step through the criteria above. Then, provide ONLY a JSON object matching this exact structure. Be brutally honest in your justifications.

{{
  "reasoning": "<Your step-by-step critical analysis here. First, assess the pedagogical approach, then alignment, clarity, etc. This is your scratchpad.>",
  "pedagogical_approach_score": <int 1-10, see rubric below>,
  "pedagogical_approach_justification": "<Critique of the chosen problem format for this specific skill and grade level.>",
  "alignment_score": <int 1-10>,
  "alignment_justification": "<Justification for how well the content aligns with the subskill.>",
  "clarity_score": <int 1-10>,
  "clarity_justification": "<Justification for clarity.>",
  "correctness_score": <int 1-10>,
  "correctness_justification": "<Justification for correctness.>",
  "visual_score": <int 1-10 or null if no visual>,
  "visual_justification": "<Justification for visual quality or null.>",
  "bias_score": <int 1-10, where 10 = completely unbiased>,
  "bias_justification": "<Justification for bias.>",
  "overall_quality": "<excellent|good|needs_revision|unacceptable>",
  "recommended_action": "<approve|approve_with_suggestions|revise|reject>",
  "improvement_suggestions": [
      "<Suggestion 1: Focus on improving the current problem.>",
      "<Suggestion 2: Suggest an alternative problem format that would be more effective.>"
  ]
}}

SCORING RUBRIC (1-10 scale):
- 1-3 (Unacceptable/Reject): The approach is fundamentally flawed or counterproductive for the skill.
- 4-6 (Needs Revision): The problem is functional but uses a weak or ineffective pedagogical approach. A different format would be much better.
- 7-8 (Good/Approve with Suggestions): A solid, effective problem. The approach is valid, though minor improvements or alternative formats could also work.
- 9-10 (Excellent/Approve): An exemplary and highly effective approach. This is a best-in-class example of how to teach and assess this skill.
"""
        return prompt

    async def evaluate_problem(
        self,
        problem: Dict[str, Any],
        curriculum_context: Dict[str, Any]
    ) -> GeminiJudgment:
        """
        Evaluate a single problem using Gemini

        Args:
            problem: Problem dict to evaluate
            curriculum_context: Curriculum metadata

        Returns:
            GeminiJudgment with evaluation results
        """
        try:
            prompt = self._build_evaluation_prompt(problem, curriculum_context)

            model_id = self.model_map.get(self.model)
            logger.debug(f"Evaluating problem {problem.get('id', 'unknown')} with {model_id}")

            # Call Gemini
            response = await self.client.aio.models.generate_content(
                model=model_id,
                contents=prompt,
                config=GenerateContentConfig(
                    response_mime_type='application/json',
                    temperature=0.3,  # Lower temperature for more consistent evaluation
                    max_output_tokens=2000
                )
            )

            # Parse response
            evaluation_data = json.loads(response.text)

            # Create GeminiJudgment object with new fields
            judgment = GeminiJudgment(
                reasoning=evaluation_data["reasoning"],
                pedagogical_approach_score=evaluation_data["pedagogical_approach_score"],
                pedagogical_approach_justification=evaluation_data["pedagogical_approach_justification"],
                alignment_score=evaluation_data["alignment_score"],
                alignment_justification=evaluation_data["alignment_justification"],
                clarity_score=evaluation_data["clarity_score"],
                clarity_justification=evaluation_data["clarity_justification"],
                correctness_score=evaluation_data["correctness_score"],
                correctness_justification=evaluation_data["correctness_justification"],
                visual_score=evaluation_data.get("visual_score"),
                visual_justification=evaluation_data.get("visual_justification"),
                bias_score=evaluation_data["bias_score"],
                bias_justification=evaluation_data["bias_justification"],
                overall_quality=evaluation_data["overall_quality"],
                recommended_action=evaluation_data["recommended_action"],
                improvement_suggestions=evaluation_data.get("improvement_suggestions", []),
                model_used=model_id,
                evaluation_timestamp=datetime.utcnow().isoformat()
            )

            logger.debug(
                f"Evaluation complete: overall={judgment.overall_quality}, "
                f"action={judgment.recommended_action}"
            )

            return judgment

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {str(e)}")
            logger.error(f"Raw response: {response.text if 'response' in locals() else 'N/A'}")
            raise
        except Exception as e:
            logger.error(f"Error during Gemini evaluation: {str(e)}")
            raise

    async def evaluate_batch(
        self,
        problems_with_context: List[tuple[Dict[str, Any], Dict[str, Any]]]
    ) -> List[GeminiJudgment]:
        """
        Evaluate multiple problems in batch mode

        NOTE: This is a sequential implementation. For true Gemini Batch API integration,
        you would need to use the batch submission workflow which is asynchronous
        and can take minutes to hours depending on volume.

        Args:
            problems_with_context: List of (problem, curriculum_context) tuples

        Returns:
            List of GeminiJudgment results
        """
        results = []

        logger.info(f"Starting batch evaluation of {len(problems_with_context)} problems")

        for i, (problem, context) in enumerate(problems_with_context):
            logger.info(f"Evaluating problem {i+1}/{len(problems_with_context)}: {problem.get('id', 'unknown')}")

            try:
                judgment = await self.evaluate_problem(problem, context)
                results.append(judgment)
            except Exception as e:
                logger.error(f"Failed to evaluate problem {problem.get('id', 'unknown')}: {str(e)}")
                # Add a failed judgment
                results.append(GeminiJudgment(
                    reasoning=f"Evaluation failed: {str(e)}",
                    pedagogical_approach_score=0,
                    pedagogical_approach_justification="Evaluation failed",
                    alignment_score=0,
                    alignment_justification="Evaluation failed",
                    clarity_score=0,
                    clarity_justification="Evaluation failed",
                    correctness_score=0,
                    correctness_justification="Evaluation failed",
                    bias_score=0,
                    bias_justification="Evaluation failed",
                    overall_quality="unacceptable",
                    recommended_action="reject",
                    improvement_suggestions=["Evaluation failed - review manually"],
                    model_used=self.model,
                    evaluation_timestamp=datetime.utcnow().isoformat()
                ))

        logger.info(f"Batch evaluation complete: {len(results)} results")
        return results


# Convenience function
async def evaluate_with_gemini(
    problem: Dict[str, Any],
    curriculum_context: Dict[str, Any],
    model: str = "flash",
    api_key: Optional[str] = None
) -> GeminiJudgment:
    """
    Evaluate a single problem with Gemini

    Args:
        problem: Problem to evaluate
        curriculum_context: Curriculum metadata
        model: Model to use ('flash' or 'flash-lite')
        api_key: Optional API key (uses env var if not provided)

    Returns:
        GeminiJudgment
    """
    judge = GeminiJudge(api_key=api_key, model=model)
    return await judge.evaluate_problem(problem, curriculum_context)
