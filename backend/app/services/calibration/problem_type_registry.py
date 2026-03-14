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

from typing import Dict, Optional, Tuple


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
        "plot":      PriorConfig(1.5, "Concrete: place value on number line"),
        "jump":      PriorConfig(2.5, "Pictorial: show operation as movement"),
        "order":     PriorConfig(3.5, "Pictorial: sequence multiple values"),
        "between":   PriorConfig(5.0, "Transitional: estimate between marks"),
    },
    "counting-board": {
        "count":     PriorConfig(1.0, "Count objects on board"),
        "group":     PriorConfig(2.0, "Group objects by attribute"),
        "compare":   PriorConfig(2.5, "Compare groups"),
        "subitize":  PriorConfig(2.0, "Quick-count small groups"),
        "count_on":  PriorConfig(2.5, "Count on from a given number"),
    },
    "pattern-builder": {
        "extend":         PriorConfig(1.5, "Concrete: continue a given pattern"),
        "identify_core":  PriorConfig(2.5, "Pictorial: find the repeating unit"),
        "translate":      PriorConfig(3.5, "Pictorial: transform representation"),
        "create":         PriorConfig(5.0, "Transitional: generate pattern from rule"),
        "find_rule":      PriorConfig(6.5, "Symbolic: discover underlying rule"),
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
    "balance-scale": {
        "equality":  PriorConfig(1.5, "Concrete: understand balance = equal"),
        "one_step":  PriorConfig(3.5, "Pictorial: solve single-operation equation"),
        "two_step":  PriorConfig(6.5, "Symbolic: solve multi-step equation"),
    },
    "base-ten-blocks": {
        "build_number":  PriorConfig(1.5, "Concrete: build number from blocks"),
        "read_blocks":   PriorConfig(2.5, "Pictorial: identify number from blocks"),
        "regroup":       PriorConfig(3.5, "Strategy: trade between place values"),
        "operate":       PriorConfig(5.0, "Operations: add/subtract with blocks"),
    },
    "fraction-circles": {
        "identify":   PriorConfig(1.5, "Concrete: name the fraction shown"),
        "build":      PriorConfig(2.5, "Pictorial: shade slices to match fraction"),
        "compare":    PriorConfig(3.5, "Pictorial: compare two fractions visually"),
        "equivalent": PriorConfig(5.0, "Transitional: find equivalent fractions"),
    },
    "fraction-bar":               {"default": PriorConfig(4.0, "Fraction bar model")},
    "area-model":                 {"default": PriorConfig(5.0, "Area model multiplication")},
    "comparison-builder": {
        "compare_groups":    PriorConfig(1.5, "Concrete: visual group comparison"),
        "one_more_less":     PriorConfig(2.5, "Pictorial: adjacent number reasoning"),
        "compare_numbers":   PriorConfig(3.5, "Pictorial: symbolic comparison (>, <, =)"),
        "order":             PriorConfig(5.0, "Transitional: order multiple values"),
    },
    "place-value-chart":          {"default": PriorConfig(2.5, "Place value decomposition")},
    "skip-counting-runner": {
        "count_along":              PriorConfig(1.5, "Concrete: follow skip-count sequence"),
        "predict":                  PriorConfig(2.5, "Pictorial: anticipate next value"),
        "fill_missing":             PriorConfig(3.5, "Pictorial: complete missing terms"),
        "find_skip_value":          PriorConfig(5.0, "Transitional: discover skip interval"),
        "connect_multiplication":   PriorConfig(6.5, "Symbolic: link to multiplication facts"),
    },
    "number-sequencer": {
        "count_from":    PriorConfig(1.5, "Concrete: continue counting from value"),
        "before_after":  PriorConfig(2.5, "Pictorial: identify adjacent numbers"),
        "order_cards":   PriorConfig(3.5, "Pictorial: sequence a set of numbers"),
        "fill_missing":  PriorConfig(5.0, "Transitional: complete pattern gaps"),
        "decade_fill":   PriorConfig(6.5, "Symbolic: cross decade boundaries"),
    },
    "number-bond": {
        "decompose":       PriorConfig(1.5, "Concrete: break whole into parts"),
        "missing_part":    PriorConfig(2.5, "Pictorial: find unknown part"),
        "fact_family":     PriorConfig(3.5, "Pictorial: generate related facts"),
        "build_equation":  PriorConfig(5.0, "Transitional: write symbolic equation"),
    },
    "addition-subtraction-scene": {
        "act_out":          PriorConfig(1.5, "Concrete: manipulate objects in scene"),
        "build_equation":   PriorConfig(2.5, "Pictorial: represent scene as equation"),
        "solve_story":      PriorConfig(3.5, "Pictorial: solve a word problem"),
        "create_story":     PriorConfig(5.0, "Transitional: write story for equation"),
    },
    "multiplication-explorer": {
        "build":           PriorConfig(1.5, "Concrete: construct groups/arrays"),
        "connect":         PriorConfig(2.5, "Pictorial: link representations"),
        "commutative":     PriorConfig(3.5, "Pictorial: apply commutative property"),
        "distributive":    PriorConfig(5.0, "Transitional: break apart with distribution"),
        "missing_factor":  PriorConfig(6.5, "Symbolic: solve for unknown factor"),
        "fluency":         PriorConfig(8.0, "Symbolic: rapid fact recall"),
    },
    "sorting-station": {
        "sort_one":         PriorConfig(1.5, "Concrete: sort by single visible attribute"),
        "sort_attribute":   PriorConfig(2.5, "Pictorial: sort by named property"),
        "count_compare":    PriorConfig(3.5, "Pictorial: count and compare sorted groups"),
        "odd_one_out":      PriorConfig(4.0, "Pictorial: identify the exception"),
        "two_attributes":   PriorConfig(5.0, "Transitional: multi-criterion classification"),
        "tally_record":     PriorConfig(5.5, "Transitional: sort and record tally counts"),
    },
    "shape-sorter": {
        "identify":  PriorConfig(1.5, "Concrete: name 2D shapes by recognition"),
        "count":     PriorConfig(2.5, "Pictorial: count sides and corners"),
        "sort":      PriorConfig(3.5, "Pictorial: classify by geometric property"),
    },
    "shape-builder": {
        "build":              PriorConfig(1.5, "Concrete: construct given shape"),
        "measure":            PriorConfig(2.5, "Pictorial: find side lengths/angles"),
        "classify":           PriorConfig(3.5, "Pictorial: identify shape properties"),
        "compose":            PriorConfig(5.0, "Transitional: combine shapes"),
        "find_symmetry":      PriorConfig(6.5, "Symbolic: analyze symmetry lines"),
        "coordinate_shape":   PriorConfig(8.0, "Symbolic: build shapes on coordinate plane"),
    },
    "shape-tracer": {
        "trace":                    PriorConfig(1.5, "Concrete: follow dotted shape outline"),
        "connect_dots":             PriorConfig(2.5, "Pictorial: guided vertex construction"),
        "complete":                 PriorConfig(3.5, "Pictorial: finish partial shape"),
        "draw_from_description":    PriorConfig(5.0, "Transitional: construct from verbal cues"),
    },
    "math-fact-fluency": {
        "visual_fact":     PriorConfig(1.5, "Concrete: picture-based fact recognition"),
        "match":           PriorConfig(2.5, "Pictorial: connect visual to equation"),
        "equation_solve":  PriorConfig(3.5, "Pictorial: solve bare equation (MC)"),
        "missing_number":  PriorConfig(5.0, "Transitional: find unknown operand"),
        "speed_round":     PriorConfig(6.5, "Symbolic: timed rapid recall"),
    },
    "strategy-picker":            {"default": PriorConfig(5.0, "Choose solution strategy")},
    "bar-model":                  {"default": PriorConfig(3.0, "Bar model comparison")},
    "ordinal-line": {
        "identify":           PriorConfig(1.5, "Concrete: name ordinal position"),
        "match":              PriorConfig(2.5, "Pictorial: connect ordinal to symbol"),
        "relative_position":  PriorConfig(3.5, "Pictorial: before/after reasoning"),
        "sequence_story":     PriorConfig(5.0, "Transitional: ordinals in story context"),
        "build_sequence":     PriorConfig(6.5, "Symbolic: construct ordering from scratch"),
    },
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
    "letter-spotter": {
        "name_it":   PriorConfig(1.5, "Recognition: name the letter shown"),
        "find_it":   PriorConfig(2.5, "Guided: find target letter in grid"),
        "match_it":  PriorConfig(3.5, "Application: match uppercase to lowercase"),
    },
    "letter-sound-link": {
        "see_hear":       PriorConfig(1.5, "Recognition: see letter, pick its sound"),
        "hear_see":       PriorConfig(2.5, "Guided: hear sound, identify the letter"),
        "keyword_match":  PriorConfig(3.5, "Application: match letter to keyword"),
    },
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


def get_primitive_beta_range(primitive_type: str) -> Tuple[float, float]:
    """Get the (min_beta, max_beta) for a primitive type across all eval modes.

    Returns the range of prior betas for all registered modes of this primitive.
    For single-mode primitives, min == max.
    Falls back to (DEFAULT_PRIOR_BETA, DEFAULT_PRIOR_BETA) for unregistered types.
    """
    modes = PROBLEM_TYPE_REGISTRY.get(primitive_type)
    if not modes:
        return (DEFAULT_PRIOR_BETA, DEFAULT_PRIOR_BETA)
    betas = [config.prior_beta for config in modes.values()]
    return (min(betas), max(betas))


def get_item_key(primitive_type: str, eval_mode: str) -> str:
    """Generate the Firestore document ID for an item calibration doc.

    Example: get_item_key('ten-frame', 'subitize') → 'ten-frame_subitize'
    """
    return f"{primitive_type}_{eval_mode}"
