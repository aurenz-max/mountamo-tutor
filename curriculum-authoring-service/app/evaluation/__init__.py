"""Content Evaluation Framework

This package provides a three-tier evaluation system for educational content:
- Tier 1: Structural Validation (schema compliance)
- Tier 2: Heuristic Validation (readability, visual coherence)
- Tier 3: LLM-as-Judge (pedagogical quality, correctness)
"""

from .rubrics import (
    StructuralResult,
    HeuristicReport,
    VisualCoherence,
    GeminiJudgment,
    EvaluationReport
)

__all__ = [
    "StructuralResult",
    "HeuristicReport",
    "VisualCoherence",
    "GeminiJudgment",
    "EvaluationReport"
]
