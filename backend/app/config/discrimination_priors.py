"""
Discrimination Priors Configuration — IRT 2PL/3PL Parameters

Maps (primitive_type, eval_mode) → (discrimination_a, guessing_c) for the
2PL/3PL probability model.  Validated in CalibrationSimulator.tsx.

Default `a` is assigned by interaction pattern:
  Direct manipulation (build, place, drag)     → a=1.8, c=0
  Constructed response (plot, fill-in, predict) → a=1.6, c=0
  Procedural sequencing (sort, order, regroup)  → a=1.4, c=0
  Pattern recognition / inference               → a=1.2, c=0
  Creative / open-ended                         → a=1.0, c=0
  Multiple choice (4 options)                   → a=1.2, c=0.25
  True / false                                  → a=1.0, c=0.50

See PRD_EVAL_MODES_ROLLOUT.md §Discrimination for full rationale.
"""

from typing import Dict, NamedTuple, Tuple


class DiscriminationPrior(NamedTuple):
    """IRT discrimination (a) and guessing floor (c) for a problem type."""
    a: float
    c: float


# =========================================================================
# Interaction-pattern defaults (used when no explicit override exists)
# =========================================================================

PATTERN_DIRECT_MANIPULATION = DiscriminationPrior(a=1.8, c=0.0)
PATTERN_CONSTRUCTED_RESPONSE = DiscriminationPrior(a=1.6, c=0.0)
PATTERN_PROCEDURAL_SEQUENCING = DiscriminationPrior(a=1.4, c=0.0)
PATTERN_PATTERN_RECOGNITION = DiscriminationPrior(a=1.2, c=0.0)
PATTERN_CREATIVE_OPEN_ENDED = DiscriminationPrior(a=1.0, c=0.0)
PATTERN_MULTIPLE_CHOICE = DiscriminationPrior(a=1.2, c=0.25)
PATTERN_TRUE_FALSE = DiscriminationPrior(a=1.0, c=0.50)

# Global default for unregistered items
DEFAULT_DISCRIMINATION_PRIOR = DiscriminationPrior(a=1.4, c=0.0)


# =========================================================================
# Per-(primitive_type, eval_mode) overrides
#
# Only entries that differ from the interaction-pattern default need to be
# listed here.  For everything else, _infer_from_pattern() assigns the
# default based on the eval-mode name.
# =========================================================================

DISCRIMINATION_REGISTRY: Dict[str, Dict[str, DiscriminationPrior]] = {
    # --- Multi-phase math primitives ---
    "ten-frame": {
        "build":     PATTERN_DIRECT_MANIPULATION,    # a=1.8
        "subitize":  PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
        "make_ten":  PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
        "operate":   PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
    },
    "number-line": {
        "plot":      PATTERN_DIRECT_MANIPULATION,     # a=1.8
        "jump":      PATTERN_PROCEDURAL_SEQUENCING,   # a=1.4
        "order":     PATTERN_PROCEDURAL_SEQUENCING,   # a=1.4
        "between":   PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
    },
    "counting-board": {
        "count":     PATTERN_DIRECT_MANIPULATION,     # a=1.8
        "group":     PATTERN_PROCEDURAL_SEQUENCING,   # a=1.4
        "compare":   PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
        "subitize":  PATTERN_DIRECT_MANIPULATION,     # a=1.8
        "count_on":  PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
    },
    "pattern-builder": {
        "extend":        PATTERN_DIRECT_MANIPULATION,     # a=1.8
        "identify_core": PATTERN_PATTERN_RECOGNITION,     # a=1.2
        "translate":     PATTERN_PATTERN_RECOGNITION,     # a=1.2
        "create":        PATTERN_CREATIVE_OPEN_ENDED,     # a=1.0
        "find_rule":     PATTERN_PATTERN_RECOGNITION,     # a=1.2
    },
    "function-machine": {
        "observe":       PATTERN_DIRECT_MANIPULATION,     # a=1.8
        "predict":       PATTERN_CONSTRUCTED_RESPONSE,    # a=1.6
        "discover_rule": PATTERN_PATTERN_RECOGNITION,     # a=1.2
        "create_rule":   PATTERN_CREATIVE_OPEN_ENDED,     # a=1.0
    },
    # --- Single-mode / multi-mode math primitives ---
    "balance-scale": {
        "equality":  PATTERN_DIRECT_MANIPULATION,
        "one_step":  PATTERN_CONSTRUCTED_RESPONSE,
        "two_step":  PATTERN_CONSTRUCTED_RESPONSE,
    },
    "base-ten-blocks": {
        "build_number":  PATTERN_DIRECT_MANIPULATION,
        "read_blocks":   PATTERN_CONSTRUCTED_RESPONSE,
        "regroup":       PATTERN_PROCEDURAL_SEQUENCING,
        "operate":       PATTERN_CONSTRUCTED_RESPONSE,
    },
    "fraction-circles": {
        "identify":   PATTERN_CONSTRUCTED_RESPONSE,
        "build":      PATTERN_DIRECT_MANIPULATION,
        "compare":    PATTERN_CONSTRUCTED_RESPONSE,
        "equivalent": PATTERN_PATTERN_RECOGNITION,
    },
    "regrouping-workbench": {
        "add_no_regroup":      PATTERN_PROCEDURAL_SEQUENCING,
        "subtract_no_regroup": PATTERN_PROCEDURAL_SEQUENCING,
        "add_regroup":         PATTERN_PROCEDURAL_SEQUENCING,
        "subtract_regroup":    PATTERN_PROCEDURAL_SEQUENCING,
    },
    "factor-tree": {
        "guided_small":  PATTERN_DIRECT_MANIPULATION,
        "guided_medium": PATTERN_DIRECT_MANIPULATION,
        "unguided":      PATTERN_CONSTRUCTED_RESPONSE,
        "assessment":    PATTERN_CONSTRUCTED_RESPONSE,
    },
    "sorting-station": {
        "sort_one":       PATTERN_PROCEDURAL_SEQUENCING,
        "sort_attribute": PATTERN_PROCEDURAL_SEQUENCING,
        "count_compare":  PATTERN_CONSTRUCTED_RESPONSE,
        "odd_one_out":    PATTERN_PATTERN_RECOGNITION,
        "two_attributes": PATTERN_PROCEDURAL_SEQUENCING,
        "tally_record":   PATTERN_PROCEDURAL_SEQUENCING,
    },
    "shape-builder": {
        "build":            PATTERN_DIRECT_MANIPULATION,
        "measure":          PATTERN_CONSTRUCTED_RESPONSE,
        "classify":         PATTERN_PATTERN_RECOGNITION,
        "compose":          PATTERN_DIRECT_MANIPULATION,
        "find_symmetry":    PATTERN_PATTERN_RECOGNITION,
        "coordinate_shape": PATTERN_CONSTRUCTED_RESPONSE,
    },
    "multiplication-explorer": {
        "build":          PATTERN_DIRECT_MANIPULATION,
        "connect":        PATTERN_PATTERN_RECOGNITION,
        "commutative":    PATTERN_PATTERN_RECOGNITION,
        "distributive":   PATTERN_CONSTRUCTED_RESPONSE,
        "missing_factor": PATTERN_CONSTRUCTED_RESPONSE,
        "fluency":        PATTERN_CONSTRUCTED_RESPONSE,
    },
    # --- Assessment primitives ---
    "knowledge-check": {
        "recall":   DiscriminationPrior(a=1.6, c=0.25),
        "apply":    DiscriminationPrior(a=1.4, c=0.25),
        "analyze":  DiscriminationPrior(a=1.6, c=0.20),
        "evaluate": DiscriminationPrior(a=1.8, c=0.15),
    },
    "true-false":              {"default": PATTERN_TRUE_FALSE},
    "fill-in-blanks":          {"default": PATTERN_CONSTRUCTED_RESPONSE},
    "matching-activity":       {"default": PATTERN_PROCEDURAL_SEQUENCING},
    "sequencing-activity":     {"default": PATTERN_PROCEDURAL_SEQUENCING},
    "categorization-activity": {"default": PATTERN_PROCEDURAL_SEQUENCING},
}


def get_discrimination_prior(
    primitive_type: str, eval_mode: str
) -> DiscriminationPrior:
    """
    Look up (a, c) for a (primitive_type, eval_mode) pair.

    Fallback chain:
      1. Exact (primitive_type, eval_mode) in registry
      2. (primitive_type, "default") in registry
      3. _infer_from_mode_name(eval_mode)
      4. DEFAULT_DISCRIMINATION_PRIOR
    """
    modes = DISCRIMINATION_REGISTRY.get(primitive_type)
    if modes:
        prior = modes.get(eval_mode) or modes.get("default")
        if prior:
            return prior

    return _infer_from_mode_name(eval_mode)


def _infer_from_mode_name(eval_mode: str) -> DiscriminationPrior:
    """Heuristic: infer discrimination from the eval mode name."""
    mode = eval_mode.lower()

    # Direct manipulation patterns
    if mode in ("build", "build_number", "build_array", "build_model",
                "count", "subitize", "trace", "place", "represent"):
        return PATTERN_DIRECT_MANIPULATION

    # Constructed response patterns
    if mode in ("plot", "predict", "solve", "equation_solve", "missing_number",
                "missing_part", "missing_value", "find_area", "multiply",
                "between", "compare", "measure", "identify", "find_missing",
                "unit_rate", "speed_round", "fluency", "assessment"):
        return PATTERN_CONSTRUCTED_RESPONSE

    # Procedural sequencing patterns
    if mode in ("jump", "order", "sort", "regroup", "sequence",
                "add_regroup", "subtract_regroup", "add_no_regroup",
                "subtract_no_regroup", "add_subtract", "fill_missing",
                "order_cards", "count_on", "group"):
        return PATTERN_PROCEDURAL_SEQUENCING

    # Pattern recognition / inference
    if mode in ("identify_core", "find_rule", "discover_rule", "translate",
                "connect", "commutative", "equivalent", "match",
                "match_real_world", "2d_vs_3d", "shape_riddle",
                "find_skip_value", "find_multiplier", "classify",
                "find_symmetry", "odd_one_out", "inference"):
        return PATTERN_PATTERN_RECOGNITION

    # Creative / open-ended
    if mode in ("create", "create_rule", "create_story", "create_pattern",
                "compose", "composition", "production"):
        return PATTERN_CREATIVE_OPEN_ENDED

    return DEFAULT_DISCRIMINATION_PRIOR
