"""
Problem-Type Registry — Static Prior Beta Assignments

Maps (primitive_type, eval_mode) → prior β for the 1PL IRT model.
Beta represents item difficulty on the same 0–10 scale as student θ.

Lower β = easier item. Higher β = harder item.
Prior assignments follow the PRD §5.3 mode-to-difficulty mapping:
  Mode 1 (concrete manipulatives, full guidance) → β ≈ 1.5
  Mode 2 (pictorial with prompts)               → β ≈ 2.5
  Mode 3 (pictorial, reduced prompts)            → β ≈ 3.5
  Mode 4 (transitional symbolic/pictorial)       → β ≈ 5.0
  Mode 5 (fully symbolic, single operation)      → β ≈ 6.5
  Mode 6 (symbolic, multi-step/cross-concept)    → β ≈ 8.0
"""

from typing import Dict, Optional


class PriorConfig:
    """Configuration for a single problem-type's prior difficulty."""

    def __init__(self, prior_beta: float, description: str = ""):
        self.prior_beta = prior_beta
        self.description = description


# =========================================================================
# Static Registry
# =========================================================================

PROBLEM_TYPE_REGISTRY: Dict[str, Dict[str, PriorConfig]] = {
    # -----------------------------------------------------------------
    # Multi-phase math primitives (per-mode β)
    # -----------------------------------------------------------------
    "ten-frame": {
        "build":     PriorConfig(1.5, "Concrete: place counters on frame"),
        "subitize":  PriorConfig(2.5, "Perceptual: flash count identification"),
        "make_ten":  PriorConfig(3.5, "Strategy: decompose to make 10"),
        "operate":   PriorConfig(5.0, "Symbolic: addition/subtraction with frame"),
    },
    "number-line": {
        "plot":      PriorConfig(2.0, "Plot values on number line"),
        "jump":      PriorConfig(3.5, "Show jumps for operations"),
        "compare":   PriorConfig(3.0, "Compare/order values"),
        "explore":   PriorConfig(1.5, "Free exploration of number line"),
    },
    "counting-board": {
        "count":     PriorConfig(1.0, "Count objects on board"),
        "group":     PriorConfig(2.0, "Group objects by attribute"),
        "compare":   PriorConfig(2.5, "Compare groups"),
        "subitize":  PriorConfig(2.0, "Quick-count small groups"),
        "count_on":  PriorConfig(2.5, "Count on from a given number"),
    },
    "pattern-builder": {
        "identify":  PriorConfig(2.5, "Identify the pattern rule"),
        "extend":    PriorConfig(3.0, "Extend an existing pattern"),
        "create":    PriorConfig(3.5, "Create a pattern from a rule"),
        "translate": PriorConfig(4.0, "Translate pattern to new medium"),
    },
    "function-machine": {
        "observe":   PriorConfig(2.5, "Observe input/output pairs"),
        "predict":   PriorConfig(3.0, "Predict output for given input"),
        "discover":  PriorConfig(3.5, "Discover the function rule"),
        "create":    PriorConfig(4.5, "Create a function machine"),
    },
    # -----------------------------------------------------------------
    # Single-mode math primitives (default β)
    # -----------------------------------------------------------------
    "balance-scale":              {"default": PriorConfig(3.0, "Balance equation exploration")},
    "base-ten-blocks":            {"default": PriorConfig(2.0, "Place value with blocks")},
    "fraction-circles":           {"default": PriorConfig(3.5, "Fraction visualization")},
    "fraction-bar":               {"default": PriorConfig(4.0, "Fraction bar model")},
    "area-model":                 {"default": PriorConfig(5.0, "Area model multiplication")},
    "comparison-builder":         {"default": PriorConfig(2.5, "Comparative visualization")},
    "place-value-chart":          {"default": PriorConfig(2.5, "Place value decomposition")},
    "skip-counting-runner":       {"default": PriorConfig(2.0, "Skip counting practice")},
    "number-bond":                {"default": PriorConfig(2.0, "Number bond decomposition")},
    "addition-subtraction-scene": {"default": PriorConfig(3.0, "Story-based add/subtract")},
    "multiplication-explorer":    {"default": PriorConfig(4.5, "Multiplication models")},
    "sorting-station":            {"default": PriorConfig(1.5, "Sort objects by attribute")},
    "shape-sorter":               {"default": PriorConfig(1.5, "Classify 2D/3D shapes")},
    "shape-builder":              {"default": PriorConfig(2.5, "Compose/decompose shapes")},
    "shape-tracer":               {"default": PriorConfig(1.0, "Trace and identify shapes")},
    "math-fact-fluency":          {"default": PriorConfig(4.0, "Timed fact recall")},
    "strategy-picker":            {"default": PriorConfig(5.0, "Choose solution strategy")},
    "bar-model":                  {"default": PriorConfig(3.0, "Bar model comparison")},
    # -----------------------------------------------------------------
    # Assessment primitives
    # -----------------------------------------------------------------
    "knowledge-check":            {"default": PriorConfig(3.0, "Multiple choice assessment")},
    "fill-in-blanks":             {"default": PriorConfig(3.5, "Fill in missing values")},
    "matching-activity":          {"default": PriorConfig(2.5, "Match pairs")},
    "sequencing-activity":        {"default": PriorConfig(3.0, "Order items correctly")},
    "true-false":                 {"default": PriorConfig(2.0, "True/false questions")},
    "categorization-activity":    {"default": PriorConfig(3.0, "Categorize items")},
    # -----------------------------------------------------------------
    # Literacy primitives
    # -----------------------------------------------------------------
    "phonics-blender":            {"default": PriorConfig(2.5, "Blend phonemes")},
    "rhyme-studio":               {"default": PriorConfig(2.0, "Identify rhymes")},
    "read-aloud-studio":          {"default": PriorConfig(3.0, "Read aloud fluency")},
    "spelling-pattern-explorer":  {"default": PriorConfig(3.5, "Spelling patterns")},
    "syllable-clapper":           {"default": PriorConfig(2.0, "Count syllables")},
    # -----------------------------------------------------------------
    # Engineering primitives
    # -----------------------------------------------------------------
    "tower-stacker":              {"default": PriorConfig(3.0, "Build stable tower")},
    "bridge-builder":             {"default": PriorConfig(4.0, "Build load-bearing bridge")},
    "lever-lab":                  {"default": PriorConfig(3.5, "Balance a lever")},
    "pulley-system":              {"default": PriorConfig(4.0, "Design pulley system")},
    "gear-train":                 {"default": PriorConfig(4.5, "Connect gears for target ratio")},
    "ramp-lab":                   {"default": PriorConfig(3.0, "Explore inclined planes")},
    # -----------------------------------------------------------------
    # Science primitives
    # -----------------------------------------------------------------
    "cell-builder":               {"default": PriorConfig(4.0, "Build cell model")},
    "food-web-builder":           {"default": PriorConfig(3.5, "Construct food web")},
    "dna-explorer":               {"default": PriorConfig(5.0, "DNA structure exploration")},
    "reaction-lab":               {"default": PriorConfig(4.0, "Chemical reaction simulation")},
    "rocket-builder":             {"default": PriorConfig(4.5, "Design and launch rocket")},
    "orbit-mechanics-lab":        {"default": PriorConfig(5.0, "Orbital mechanics simulation")},
}

# Default prior for unregistered primitive_type/eval_mode combinations
DEFAULT_PRIOR_BETA = 3.0


def get_prior_beta(primitive_type: str, eval_mode: str) -> float:
    """Look up the prior beta for a (primitive_type, eval_mode) pair.

    Fallback chain: exact mode → 'default' mode → global default (3.0).
    """
    modes = PROBLEM_TYPE_REGISTRY.get(primitive_type)
    if modes is None:
        return DEFAULT_PRIOR_BETA
    config = modes.get(eval_mode) or modes.get("default")
    if config is None:
        return DEFAULT_PRIOR_BETA
    return config.prior_beta


def get_item_key(primitive_type: str, eval_mode: str) -> str:
    """Generate the Firestore document ID for an item calibration doc.

    Example: get_item_key('ten-frame', 'subitize') → 'ten-frame_subitize'
    """
    return f"{primitive_type}_{eval_mode}"
