"""
Prompt Suggestion Service - Generates LLM-powered prompt improvement suggestions

Responsibilities:
- Take aggregated feedback and current prompt
- Use Gemini to generate specific prompt modifications
- Provide side-by-side diff view of changes
- Support interactive refinement workflow
"""

import logging
import json
from typing import Dict, Any, List, Optional
from difflib import unified_diff

from app.core.config import settings
from app.services.feedback_aggregator_service import feedback_aggregator_service
from app.services.prompt_manager_service import prompt_manager_service

logger = logging.getLogger(__name__)


class PromptSuggestionService:
    """Generates LLM-powered suggestions for prompt improvements"""

    def __init__(self):
        """Initialize prompt suggestion service"""
        self._gemini_model = None
        logger.info("✅ PromptSuggestionService initialized")

    @property
    def gemini_model(self):
        """Lazy initialization of Gemini model"""
        if self._gemini_model is None:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
            logger.info("✅ Gemini model initialized for prompt suggestions")
        return self._gemini_model

    async def suggest_prompt_improvements(
        self,
        template_id: str,
        focus_areas: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate specific prompt improvement suggestions based on feedback.

        Args:
            template_id: Template to generate suggestions for
            focus_areas: Optional list of specific areas to focus on
                        (e.g., ["pedagogical_approach", "clarity"])

        Returns:
            Structured suggestions with original/improved prompts and rationale

        Raises:
            ValueError: If template not found or no feedback available
        """
        logger.info(f"💡 Generating prompt improvements for template: {template_id}")

        # 1. Get template
        template = await prompt_manager_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        # 2. Get aggregated feedback (will generate if not exists)
        try:
            feedback_report = await feedback_aggregator_service.aggregate_template_feedback(
                template_id,
                min_evaluations=1  # Allow even single evaluation for testing
            )
        except ValueError as e:
            raise ValueError(f"Cannot generate suggestions: {str(e)}")

        # 3. Build improvement prompt for Gemini
        improvement_prompt = self._build_improvement_prompt(
            template,
            feedback_report,
            focus_areas
        )

        # 4. Generate improved prompt with Gemini
        improved_prompt_data = await self._generate_improved_prompt(
            improvement_prompt,
            template.template_text
        )

        # 5. Generate diff
        diff = self._generate_diff(
            template.template_text,
            improved_prompt_data["improved_prompt"]
        )

        # 6. Build response
        result = {
            "template_id": template_id,
            "template_name": template.template_name,
            "template_version": template.version,
            "original_prompt": template.template_text,
            "improved_prompt": improved_prompt_data["improved_prompt"],
            "diff": diff,
            "rationale": improved_prompt_data["rationale"],
            "key_changes": improved_prompt_data["key_changes"],
            "expected_improvements": improved_prompt_data["expected_improvements"],
            "feedback_addressed": improved_prompt_data["feedback_addressed"],
            "performance_context": {
                "current_approval_rate": feedback_report["performance_metrics"]["approval_rate"],
                "current_avg_score": feedback_report["performance_metrics"]["avg_evaluation_score"],
                "total_evaluations": feedback_report["total_evaluations"],
                "performance_flags": feedback_report["performance_flags"]
            }
        }

        logger.info(f"✅ Generated prompt improvements for {template_id}")

        return result

    def _build_improvement_prompt(
        self,
        template: Any,
        feedback_report: Dict[str, Any],
        focus_areas: Optional[List[str]] = None
    ) -> str:
        """
        Build the prompt for Gemini to generate improvements.

        Args:
            template: Current template
            feedback_report: Aggregated feedback report
            focus_areas: Optional focus areas

        Returns:
            Formatted prompt for Gemini
        """
        focus_instruction = ""
        if focus_areas:
            focus_instruction = f"\nFOCUS PARTICULARLY ON: {', '.join(focus_areas)}"

        prompt = f"""You are an expert prompt engineer specializing in educational content generation.

Your task is to improve this prompt template based on feedback from evaluations of the problems it generated.

CURRENT PROMPT TEMPLATE:
```
{template.template_text}
```

PERFORMANCE DATA:
- Approval Rate: {feedback_report['performance_metrics']['approval_rate']:.1%}
- Average Score: {feedback_report['performance_metrics']['avg_evaluation_score']}/10
- Total Evaluations: {feedback_report['total_evaluations']}

PERFORMANCE FLAGS:
{json.dumps(feedback_report['performance_flags'], indent=2)}

FEEDBACK THEMES:
{json.dumps(feedback_report['feedback_themes'], indent=2)}

DIMENSION ANALYSIS:
{json.dumps(feedback_report['dimension_analysis'], indent=2)}

SUGGESTED IMPROVEMENTS:
{json.dumps(feedback_report['improvement_suggestions'], indent=2)}
{focus_instruction}

TASK:
Create an improved version of the prompt that addresses the identified issues while maintaining the same structure and variables.

REQUIREMENTS:
1. Keep all existing template variables ({{variable_name}}) intact
2. Maintain the overall structure and purpose
3. Add specific instructions to address the weak dimensions
4. Incorporate feedback themes into the prompt language
5. Be concrete and specific in your additions
6. Ensure the improved prompt will generate more consistent, high-quality problems

Output a JSON object with this structure:
{{
    "improved_prompt": "The complete improved prompt text",
    "rationale": "2-3 sentence explanation of the key improvements made",
    "key_changes": [
        "Specific change 1",
        "Specific change 2",
        "Specific change 3"
    ],
    "expected_improvements": {{
        "approval_rate_target": <expected new approval rate as decimal>,
        "score_improvements": {{
            "pedagogical_approach_score": <expected improvement>,
            "alignment_score": <expected improvement>,
            "clarity_score": <expected improvement>,
            "correctness_score": <expected improvement>,
            "bias_score": <expected improvement>
        }}
    }},
    "feedback_addressed": [
        "Theme or issue addressed 1",
        "Theme or issue addressed 2"
    ]
}}

Only return valid JSON, no markdown formatting."""

        return prompt

    async def _generate_improved_prompt(
        self,
        improvement_prompt: str,
        original_prompt: str
    ) -> Dict[str, Any]:
        """
        Use Gemini to generate improved prompt.

        Args:
            improvement_prompt: Prompt for Gemini
            original_prompt: Original prompt text

        Returns:
            Improved prompt data

        Raises:
            RuntimeError: If Gemini generation fails
        """
        try:
            response = self.gemini_model.generate_content(
                improvement_prompt,
                generation_config={
                    "temperature": 0.5,  # Slightly higher for creativity
                    "response_mime_type": "application/json"
                }
            )

            improved_data = json.loads(response.text)

            # Validate that improved prompt exists
            if "improved_prompt" not in improved_data:
                raise ValueError("Generated response missing 'improved_prompt' field")

            logger.info(f"✅ Generated improved prompt ({len(improved_data['improved_prompt'])} chars)")

            return improved_data

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse Gemini response: {str(e)}")
            raise RuntimeError("Gemini returned invalid JSON")
        except Exception as e:
            logger.error(f"❌ Gemini prompt improvement failed: {str(e)}")
            raise RuntimeError(f"Failed to generate improved prompt: {str(e)}")

    def _generate_diff(
        self,
        original: str,
        improved: str
    ) -> Dict[str, Any]:
        """
        Generate a diff between original and improved prompts.

        Args:
            original: Original prompt text
            improved: Improved prompt text

        Returns:
            Diff data with line-by-line changes
        """
        original_lines = original.splitlines(keepends=True)
        improved_lines = improved.splitlines(keepends=True)

        # Generate unified diff
        diff_lines = list(unified_diff(
            original_lines,
            improved_lines,
            fromfile='Current Prompt',
            tofile='Improved Prompt',
            lineterm=''
        ))

        # Parse diff into structured format
        changes = []
        current_hunk = None

        for line in diff_lines[2:]:  # Skip file headers
            if line.startswith('@@'):
                if current_hunk:
                    changes.append(current_hunk)
                current_hunk = {
                    "header": line,
                    "removals": [],
                    "additions": [],
                    "context": []
                }
            elif current_hunk:
                if line.startswith('-'):
                    current_hunk["removals"].append(line[1:])
                elif line.startswith('+'):
                    current_hunk["additions"].append(line[1:])
                elif line.startswith(' '):
                    current_hunk["context"].append(line[1:])

        if current_hunk:
            changes.append(current_hunk)

        # Calculate statistics
        total_additions = sum(len(h["additions"]) for h in changes)
        total_removals = sum(len(h["removals"]) for h in changes)

        return {
            "unified_diff": "".join(diff_lines),
            "changes": changes,
            "stats": {
                "total_additions": total_additions,
                "total_removals": total_removals,
                "total_hunks": len(changes)
            },
            "has_changes": total_additions > 0 or total_removals > 0
        }

    async def compare_template_versions(
        self,
        template_id_a: str,
        template_id_b: str
    ) -> Dict[str, Any]:
        """
        Compare performance between two template versions.

        Args:
            template_id_a: First template ID
            template_id_b: Second template ID

        Returns:
            Comparison data with performance metrics and recommendations

        Raises:
            ValueError: If templates not found
        """
        logger.info(f"📊 Comparing templates: {template_id_a} vs {template_id_b}")

        # Get both templates
        template_a = await prompt_manager_service.get_template(template_id_a)
        template_b = await prompt_manager_service.get_template(template_id_b)

        if not template_a or not template_b:
            raise ValueError("One or both templates not found")

        # Get performance metrics for both
        metrics_a = await prompt_manager_service.calculate_performance_metrics(template_id_a)
        metrics_b = await prompt_manager_service.calculate_performance_metrics(template_id_b)

        # Calculate improvements
        improvement_analysis = {
            "approval_rate_change": (
                (metrics_b.approval_rate - metrics_a.approval_rate)
                if metrics_a.approval_rate and metrics_b.approval_rate
                else None
            ),
            "score_change": (
                (metrics_b.avg_evaluation_score - metrics_a.avg_evaluation_score)
                if metrics_a.avg_evaluation_score and metrics_b.avg_evaluation_score
                else None
            ),
            "dimension_changes": {}
        }

        # Compare each dimension
        dimensions = [
            'avg_pedagogical_score',
            'avg_alignment_score',
            'avg_clarity_score',
            'avg_correctness_score',
            'avg_bias_score'
        ]

        for dim in dimensions:
            score_a = getattr(metrics_a, dim, None)
            score_b = getattr(metrics_b, dim, None)
            if score_a is not None and score_b is not None:
                improvement_analysis["dimension_changes"][dim] = {
                    "before": score_a,
                    "after": score_b,
                    "change": score_b - score_a,
                    "percent_change": ((score_b - score_a) / score_a * 100) if score_a > 0 else 0
                }

        # Generate recommendation
        recommendation = self._generate_version_recommendation(
            template_a,
            template_b,
            metrics_a,
            metrics_b,
            improvement_analysis
        )

        # Generate diff
        diff = self._generate_diff(template_a.template_text, template_b.template_text)

        return {
            "template_a": {
                "id": template_id_a,
                "name": template_a.template_name,
                "version": template_a.version,
                "metrics": metrics_a.dict()
            },
            "template_b": {
                "id": template_id_b,
                "name": template_b.template_name,
                "version": template_b.version,
                "metrics": metrics_b.dict()
            },
            "improvement_analysis": improvement_analysis,
            "diff": diff,
            "recommendation": recommendation
        }

    def _generate_version_recommendation(
        self,
        template_a: Any,
        template_b: Any,
        metrics_a: Any,
        metrics_b: Any,
        improvement_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate recommendation on which version to use.

        Args:
            template_a: First template
            template_b: Second template
            metrics_a: Metrics for first template
            metrics_b: Metrics for second template
            improvement_analysis: Analysis of improvements

        Returns:
            Recommendation data
        """
        # Determine winner based on multiple factors
        approval_winner = None
        if improvement_analysis["approval_rate_change"]:
            approval_winner = "b" if improvement_analysis["approval_rate_change"] > 0 else "a"

        score_winner = None
        if improvement_analysis["score_change"]:
            score_winner = "b" if improvement_analysis["score_change"] > 0 else "a"

        # Count dimension improvements
        dim_improvements_b = sum(
            1 for change in improvement_analysis["dimension_changes"].values()
            if change["change"] > 0
        )

        dim_improvements_a = sum(
            1 for change in improvement_analysis["dimension_changes"].values()
            if change["change"] < 0
        )

        # Generate recommendation
        if approval_winner == "b" and score_winner == "b":
            decision = "activate_b"
            confidence = "high"
            rationale = f"Version {template_b.version} shows improvements in both approval rate and overall score"
        elif approval_winner == "a" and score_winner == "a":
            decision = "keep_a"
            confidence = "high"
            rationale = f"Version {template_a.version} performs better across key metrics"
        elif dim_improvements_b > dim_improvements_a:
            decision = "activate_b"
            confidence = "medium"
            rationale = f"Version {template_b.version} shows improvements in {dim_improvements_b} dimensions"
        else:
            decision = "needs_more_data"
            confidence = "low"
            rationale = "Performance is mixed; collect more evaluations for statistical significance"

        return {
            "decision": decision,
            "confidence": confidence,
            "rationale": rationale,
            "approval_winner": approval_winner,
            "score_winner": score_winner,
            "dimension_improvements": {
                "version_a": dim_improvements_a,
                "version_b": dim_improvements_b
            }
        }


# Singleton instance
prompt_suggestion_service = PromptSuggestionService()
