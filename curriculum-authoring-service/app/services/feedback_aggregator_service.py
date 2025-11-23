"""
Feedback Aggregator Service - Analyzes evaluation feedback and generates improvement suggestions

Responsibilities:
- Aggregate improvement suggestions across multiple problems from same prompt
- Use Gemini to cluster/analyze common feedback themes
- Calculate performance flags and thresholds
- Store aggregated feedback in prompt_performance_metrics table
- Support background job triggering after evaluation batches
"""

import logging
import json
from uuid import uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime
from collections import Counter

from app.core.config import settings
from app.core.database import db
from app.services.prompt_manager_service import prompt_manager_service

logger = logging.getLogger(__name__)


class FeedbackAggregatorService:
    """Aggregates and analyzes feedback from problem evaluations"""

    def __init__(self):
        """Initialize feedback aggregator"""
        self._gemini_model = None
        logger.info("✅ FeedbackAggregatorService initialized")

    @property
    def gemini_model(self):
        """Lazy initialization of Gemini model for feedback analysis"""
        if self._gemini_model is None:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._gemini_model = genai.GenerativeModel('gemini-2.0-flash-exp')
            logger.info("✅ Gemini model initialized for feedback aggregation")
        return self._gemini_model

    async def aggregate_template_feedback(
        self,
        template_id: str,
        min_evaluations: int = 3
    ) -> Dict[str, Any]:
        """
        Aggregate feedback for a prompt template across all evaluated problems.

        Args:
            template_id: Prompt template ID to analyze
            min_evaluations: Minimum evaluations required for analysis (default: 3)

        Returns:
            Aggregated feedback report with common themes, performance flags, and suggestions

        Raises:
            ValueError: If template not found or insufficient evaluations
        """
        logger.info(f"📊 Aggregating feedback for template: {template_id}")

        # 1. Get template
        template = await prompt_manager_service.get_template(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")

        # 2. Calculate performance metrics
        metrics = await prompt_manager_service.calculate_performance_metrics(template_id)

        if metrics.total_generations < min_evaluations:
            raise ValueError(
                f"Insufficient evaluations: {metrics.total_generations} found, "
                f"{min_evaluations} required"
            )

        # 3. Fetch all evaluations for problems generated with this template
        evaluations = await self._fetch_template_evaluations(template)

        if not evaluations:
            raise ValueError(f"No evaluations found for template {template_id}")

        logger.info(f"Found {len(evaluations)} evaluations to analyze")

        # 4. Extract improvement suggestions
        all_suggestions = []
        for eval_data in evaluations:
            suggestions = eval_data.get('llm_suggestions', [])
            if isinstance(suggestions, str):
                try:
                    suggestions = json.loads(suggestions)
                except:
                    suggestions = []
            all_suggestions.extend(suggestions)

        # 5. Analyze dimension scores to identify weaknesses
        dimension_analysis = self._analyze_dimension_scores(evaluations)

        # 6. Use Gemini to cluster suggestions and identify themes
        feedback_themes = await self._cluster_suggestions_with_gemini(
            all_suggestions,
            dimension_analysis,
            template.template_text
        )

        # 7. Generate performance flags
        performance_flags = self._generate_performance_flags(metrics, dimension_analysis)

        # 8. Generate structured improvement suggestions
        improvement_suggestions = await self._generate_improvement_suggestions(
            feedback_themes,
            dimension_analysis,
            template.template_text,
            performance_flags
        )

        # 9. Build feedback report
        feedback_report = {
            "template_id": template_id,
            "template_name": template.template_name,
            "template_version": template.version,
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "total_evaluations": len(evaluations),
            "performance_metrics": metrics.dict(),
            "dimension_analysis": dimension_analysis,
            "feedback_themes": feedback_themes,
            "performance_flags": performance_flags,
            "improvement_suggestions": improvement_suggestions
        }

        # 10. Store in prompt_performance_metrics table
        await self._store_performance_metrics(template_id, feedback_report)

        logger.info(f"✅ Feedback aggregation complete for {template_id}")

        return feedback_report

    async def _fetch_template_evaluations(
        self,
        template: Any
    ) -> List[Dict[str, Any]]:
        """
        Fetch all evaluations for problems generated with this template.

        Args:
            template: Template to fetch evaluations for

        Returns:
            List of evaluation records
        """
        problems_table = settings.get_table_id("curriculum_problems")
        evals_table = settings.get_table_id("problem_evaluations")

        query = f"""
        SELECT
            e.*,
            p.problem_type,
            p.subskill_id
        FROM `{problems_table}` p
        JOIN `{evals_table}` e ON p.problem_id = e.problem_id
        WHERE p.generation_prompt = @template_text
          AND p.generation_timestamp >= @created_at
        ORDER BY e.evaluation_timestamp DESC
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("template_text", "STRING", template.template_text),
                bigquery.ScalarQueryParameter("created_at", "TIMESTAMP", template.created_at)
            ]
        )

        query_job = db.client.query(query, job_config=job_config)
        results = list(query_job.result())

        return [dict(row) for row in results]

    def _analyze_dimension_scores(
        self,
        evaluations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze dimension scores to identify weaknesses.

        Args:
            evaluations: List of evaluation records

        Returns:
            Analysis of dimension scores with averages and flags
        """
        dimensions = [
            'pedagogical_approach_score',
            'alignment_score',
            'clarity_score',
            'correctness_score',
            'bias_score'
        ]

        analysis = {}

        for dim in dimensions:
            scores = [
                eval_data.get(dim)
                for eval_data in evaluations
                if eval_data.get(dim) is not None
            ]

            if scores:
                avg_score = sum(scores) / len(scores)
                min_score = min(scores)
                max_score = max(scores)

                # Flag if average is below threshold
                is_weak = avg_score < 7.0  # Below 7/10 is concerning

                analysis[dim] = {
                    "average": round(avg_score, 2),
                    "min": min_score,
                    "max": max_score,
                    "count": len(scores),
                    "is_weak": is_weak,
                    "severity": self._calculate_severity(avg_score)
                }

        # Identify weakest dimension
        if analysis:
            weakest = min(analysis.items(), key=lambda x: x[1]["average"])
            analysis["weakest_dimension"] = weakest[0]
            analysis["weakest_score"] = weakest[1]["average"]

        return analysis

    def _calculate_severity(self, avg_score: float) -> str:
        """Calculate severity level based on average score"""
        if avg_score >= 8.5:
            return "excellent"
        elif avg_score >= 7.0:
            return "good"
        elif avg_score >= 5.0:
            return "needs_attention"
        else:
            return "critical"

    async def _cluster_suggestions_with_gemini(
        self,
        suggestions: List[str],
        dimension_analysis: Dict[str, Any],
        template_text: str
    ) -> Dict[str, Any]:
        """
        Use Gemini to analyze and cluster improvement suggestions.

        Args:
            suggestions: List of improvement suggestions from evaluations
            dimension_analysis: Analysis of dimension scores
            template_text: The prompt template text

        Returns:
            Clustered themes with counts and examples
        """
        if not suggestions:
            return {"themes": [], "summary": "No improvement suggestions found"}

        # Build prompt for Gemini
        analysis_prompt = f"""Analyze the following improvement suggestions from problem evaluations.
These suggestions come from evaluating problems generated with this prompt template:

PROMPT TEMPLATE:
{template_text[:500]}...

DIMENSION SCORES:
{json.dumps(dimension_analysis, indent=2)}

IMPROVEMENT SUGGESTIONS ({len(suggestions)} total):
{json.dumps(suggestions, indent=2)}

TASK:
1. Identify common themes in the suggestions
2. Group similar suggestions together
3. Count how many suggestions fall into each theme
4. Provide example suggestions for each theme
5. Determine the severity of each theme (critical, high, medium, low)

Output a JSON object with this structure:
{{
    "themes": [
        {{
            "theme_name": "Brief theme name",
            "description": "Detailed description of this pattern",
            "count": <number of suggestions in this theme>,
            "percentage": <percentage of total suggestions>,
            "severity": "critical|high|medium|low",
            "examples": ["example 1", "example 2", "example 3"]
        }}
    ],
    "summary": "1-2 sentence overall summary of feedback patterns",
    "primary_concern": "The most critical issue to address"
}}

Only return valid JSON, no markdown formatting."""

        try:
            response = self.gemini_model.generate_content(
                analysis_prompt,
                generation_config={
                    "temperature": 0.3,
                    "response_mime_type": "application/json"
                }
            )

            themes_data = json.loads(response.text)
            logger.info(f"✅ Identified {len(themes_data.get('themes', []))} feedback themes")
            return themes_data

        except Exception as e:
            logger.error(f"❌ Gemini clustering failed: {str(e)}")
            # Fallback: Simple keyword-based clustering
            return self._simple_keyword_clustering(suggestions)

    def _simple_keyword_clustering(self, suggestions: List[str]) -> Dict[str, Any]:
        """
        Fallback: Simple keyword-based clustering if Gemini fails.

        Args:
            suggestions: List of improvement suggestions

        Returns:
            Basic theme analysis
        """
        # Common keywords to look for
        keywords = {
            "abstract": ["abstract", "concrete", "tangible", "real-world"],
            "clarity": ["clear", "confusing", "ambiguous", "unclear"],
            "age-appropriate": ["age", "grade", "developmentally", "appropriate"],
            "bias": ["bias", "inclusive", "stereotype", "diverse"],
            "correctness": ["incorrect", "wrong", "error", "mistake"]
        }

        themes = []
        for theme_name, terms in keywords.items():
            matching = [
                s for s in suggestions
                if any(term.lower() in s.lower() for term in terms)
            ]
            if matching:
                themes.append({
                    "theme_name": theme_name,
                    "description": f"Suggestions related to {theme_name}",
                    "count": len(matching),
                    "percentage": round(len(matching) / len(suggestions) * 100, 1),
                    "severity": "high" if len(matching) > len(suggestions) * 0.3 else "medium",
                    "examples": matching[:3]
                })

        return {
            "themes": themes,
            "summary": f"Found {len(themes)} common themes across {len(suggestions)} suggestions",
            "primary_concern": themes[0]["theme_name"] if themes else "Unknown"
        }

    def _generate_performance_flags(
        self,
        metrics: Any,
        dimension_analysis: Dict[str, Any]
    ) -> List[str]:
        """
        Generate performance flags based on metrics and dimension analysis.

        Args:
            metrics: Performance metrics
            dimension_analysis: Dimension score analysis

        Returns:
            List of performance flags
        """
        flags = []

        # Check approval rate
        if metrics.approval_rate is not None:
            if metrics.approval_rate < 0.5:
                flags.append("LOW_APPROVAL_RATE")
            elif metrics.approval_rate < 0.7:
                flags.append("BELOW_TARGET_APPROVAL")

        # Check rejection rate
        if metrics.total_rejections > 0 and metrics.total_generations > 0:
            rejection_rate = metrics.total_rejections / metrics.total_generations
            if rejection_rate > 0.3:
                flags.append("HIGH_REJECTION_RATE")

        # Check dimension weaknesses
        for dim, analysis in dimension_analysis.items():
            if isinstance(analysis, dict) and analysis.get("is_weak"):
                severity = analysis.get("severity")
                if severity == "critical":
                    flags.append(f"CRITICAL_{dim.upper()}")
                elif severity == "needs_attention":
                    flags.append(f"WEAK_{dim.upper()}")

        # Check overall score
        if metrics.avg_evaluation_score is not None:
            if metrics.avg_evaluation_score < 6.0:
                flags.append("LOW_OVERALL_SCORE")
            elif metrics.avg_evaluation_score < 7.5:
                flags.append("BELOW_TARGET_SCORE")

        # Flag if no data
        if metrics.total_generations == 0:
            flags.append("NO_EVALUATION_DATA")

        return flags if flags else ["PERFORMING_WELL"]

    async def _generate_improvement_suggestions(
        self,
        feedback_themes: Dict[str, Any],
        dimension_analysis: Dict[str, Any],
        template_text: str,
        performance_flags: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Generate specific, actionable improvement suggestions for the prompt.

        Args:
            feedback_themes: Clustered feedback themes
            dimension_analysis: Dimension score analysis
            template_text: Current prompt text
            performance_flags: Performance flags

        Returns:
            List of structured improvement suggestions
        """
        # Build prompt for Gemini to generate improvements
        improvement_prompt = f"""Based on the feedback analysis, suggest specific improvements to this prompt template.

CURRENT PROMPT:
{template_text}

PERFORMANCE FLAGS:
{json.dumps(performance_flags, indent=2)}

FEEDBACK THEMES:
{json.dumps(feedback_themes, indent=2)}

DIMENSION ANALYSIS:
{json.dumps(dimension_analysis, indent=2)}

TASK:
Generate specific, actionable suggestions to improve this prompt. Each suggestion should:
1. Target a specific weakness identified in the feedback
2. Provide concrete wording or structural changes
3. Explain the expected improvement

Output a JSON array of suggestions with this structure:
[
    {{
        "suggestion_id": "unique_id",
        "priority": "critical|high|medium|low",
        "category": "pedagogical|alignment|clarity|correctness|bias",
        "title": "Brief title of the suggestion",
        "description": "Detailed explanation of what to change and why",
        "proposed_change": "Specific text to add/modify in the prompt",
        "expected_impact": "How this will improve the generated problems",
        "addresses_themes": ["theme1", "theme2"]
    }}
]

Provide 3-7 suggestions prioritized by impact. Only return valid JSON."""

        try:
            response = self.gemini_model.generate_content(
                improvement_prompt,
                generation_config={
                    "temperature": 0.4,
                    "response_mime_type": "application/json"
                }
            )

            suggestions = json.loads(response.text)
            logger.info(f"✅ Generated {len(suggestions)} improvement suggestions")
            return suggestions

        except Exception as e:
            logger.error(f"❌ Gemini suggestion generation failed: {str(e)}")
            # Fallback: Generate basic suggestions
            return self._generate_basic_suggestions(dimension_analysis, performance_flags)

    def _generate_basic_suggestions(
        self,
        dimension_analysis: Dict[str, Any],
        performance_flags: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Fallback: Generate basic suggestions if Gemini fails.

        Args:
            dimension_analysis: Dimension scores
            performance_flags: Performance flags

        Returns:
            Basic improvement suggestions
        """
        suggestions = []

        # Suggest improvements for weak dimensions
        for dim, analysis in dimension_analysis.items():
            if isinstance(analysis, dict) and analysis.get("is_weak"):
                dim_name = dim.replace("_score", "").replace("_", " ").title()
                suggestions.append({
                    "suggestion_id": f"improve_{dim}",
                    "priority": "high" if analysis.get("severity") == "critical" else "medium",
                    "category": dim.replace("_score", ""),
                    "title": f"Improve {dim_name}",
                    "description": f"Average {dim_name} score is {analysis['average']}/10. Consider revising prompt to better address this dimension.",
                    "proposed_change": f"Add explicit instructions to ensure {dim_name.lower()} in generated problems",
                    "expected_impact": f"Increase {dim_name} score to >7.0",
                    "addresses_themes": []
                })

        # Suggest approval rate improvements
        if "LOW_APPROVAL_RATE" in performance_flags:
            suggestions.append({
                "suggestion_id": "improve_approval",
                "priority": "critical",
                "category": "overall",
                "title": "Improve Overall Approval Rate",
                "description": "Current approval rate is below 50%. Prompt needs significant revision.",
                "proposed_change": "Review and strengthen prompt instructions across all dimensions",
                "expected_impact": "Increase approval rate to >70%",
                "addresses_themes": []
            })

        return suggestions

    async def _store_performance_metrics(
        self,
        template_id: str,
        feedback_report: Dict[str, Any]
    ) -> bool:
        """
        Store aggregated feedback in prompt_performance_metrics table.

        Args:
            template_id: Template ID
            feedback_report: Complete feedback report

        Returns:
            Success status
        """
        metrics_id = str(uuid4())
        now = datetime.utcnow()

        # Prepare row for BigQuery
        row = {
            "metrics_id": metrics_id,
            "template_id": template_id,
            "snapshot_timestamp": now.isoformat(),
            "total_evaluations": feedback_report["total_evaluations"],
            "avg_overall_score": feedback_report["performance_metrics"]["avg_evaluation_score"],
            "approval_rate": feedback_report["performance_metrics"]["approval_rate"],
            "avg_pedagogical_score": feedback_report["performance_metrics"]["avg_pedagogical_score"],
            "avg_alignment_score": feedback_report["performance_metrics"]["avg_alignment_score"],
            "avg_clarity_score": feedback_report["performance_metrics"]["avg_clarity_score"],
            "avg_correctness_score": feedback_report["performance_metrics"]["avg_correctness_score"],
            "avg_bias_score": feedback_report["performance_metrics"]["avg_bias_score"],
            "total_generations": feedback_report["performance_metrics"]["total_generations"],
            "total_approvals": feedback_report["performance_metrics"]["total_approvals"],
            "total_revisions": feedback_report["performance_metrics"]["total_revisions"],
            "total_rejections": feedback_report["performance_metrics"]["total_rejections"],

            # New feedback fields
            "feedback_summary": feedback_report["feedback_themes"].get("summary", ""),
            "feedback_details": json.dumps(feedback_report["feedback_themes"]),
            "suggested_improvements": json.dumps(feedback_report["improvement_suggestions"]),
            "performance_flags": json.dumps(feedback_report["performance_flags"]),
            "dimension_analysis": json.dumps(feedback_report["dimension_analysis"])
        }

        # Insert into BigQuery
        success = await db.insert_rows("prompt_performance_metrics", [row])

        if success:
            logger.info(f"✅ Stored performance metrics for template {template_id}")
        else:
            logger.error(f"❌ Failed to store performance metrics for template {template_id}")

        return success


# Singleton instance
feedback_aggregator_service = FeedbackAggregatorService()
