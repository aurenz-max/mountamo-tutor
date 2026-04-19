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

from ...config.discrimination_priors import (
    DEFAULT_DISCRIMINATION_PRIOR,
    get_discrimination_prior,
)


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
        "operate":   PriorConfig(4.5, "Symbolic: addition/subtraction with frame"),
    },
    "number-line": {
        "identify":  PriorConfig(0.5, "Concrete: identify numbers on labeled 0-10 line"),
        "plot":      PriorConfig(1.5, "Concrete: place value on number line"),
        "jump":      PriorConfig(2.5, "Pictorial: show operation as movement"),
        "order":     PriorConfig(3.5, "Pictorial: sequence multiple values"),
        "between":   PriorConfig(4.5, "Transitional: estimate between marks"),
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
        "create":         PriorConfig(4.5, "Transitional: generate pattern from rule"),
        "find_rule":      PriorConfig(5.5, "Symbolic: discover underlying rule"),
    },
    "function-machine": {
        "observe":       PriorConfig(2.5, "Pictorial: watch input/output with rule visible"),
        "predict":       PriorConfig(3.0, "Pictorial: predict output for new input"),
        "discover_rule": PriorConfig(3.5, "Strategy: identify hidden function rule"),
        "create_rule":   PriorConfig(4.5, "Transitional: write rule for given I/O pairs"),
    },
    "coordinate-graph": {
        "plot_point":     PriorConfig(-1.0, "Student clicks correct grid intersection for given coordinates"),
        "read_point":     PriorConfig(-0.5, "Student identifies coordinates of displayed point from MC options"),
        "find_slope":     PriorConfig(0.5, "Student identifies slope from rise/run triangle and MC options"),
        "find_intercept": PriorConfig(1.0, "Student identifies y-intercept of drawn line from MC options"),
    },
    # -----------------------------------------------------------------
    # Single-mode math primitives (default β)
    # -----------------------------------------------------------------
    "balance-scale": {
        "equality":       PriorConfig(1.5, "Concrete: understand balance = equal"),
        "equality_hard":  PriorConfig(2.5, "Pictorial: subtraction missing-addend, sums 10-20"),
        "one_step":       PriorConfig(3.5, "Pictorial: solve single-operation equation"),
        "one_step_hard":  PriorConfig(4.5, "Transitional: one-step with multiply/divide"),
        "two_step_intro": PriorConfig(5.5, "Transitional: simple two-step, small positive coefficients"),
        "two_step":       PriorConfig(6.5, "Symbolic: solve multi-step equation"),
    },
    "base-ten-blocks": {
        "build_number":  PriorConfig(1.5, "Concrete: build number from blocks"),
        "read_blocks":   PriorConfig(2.5, "Pictorial: identify number from blocks"),
        "regroup":       PriorConfig(3.5, "Strategy: trade between place values"),
        "operate":       PriorConfig(4.5, "Operations: add/subtract with blocks"),
    },
    "fraction-circles": {
        "identify":   PriorConfig(1.5, "Concrete: name the fraction shown"),
        "build":      PriorConfig(2.5, "Pictorial: shade slices to match fraction"),
        "compare":    PriorConfig(3.5, "Pictorial: compare two fractions visually"),
        "equivalent": PriorConfig(4.5, "Transitional: find equivalent fractions"),
    },
    "regrouping-workbench": {
        "add_no_regroup":      PriorConfig(1.5, "Concrete: addition without carrying"),
        "subtract_no_regroup": PriorConfig(2.5, "Pictorial: subtraction without borrowing"),
        "add_regroup":         PriorConfig(3.5, "Strategy: addition with carrying"),
        "subtract_regroup":    PriorConfig(4.5, "Transitional: subtraction with borrowing"),
    },
    "percent-bar": {
        "identify_percent": PriorConfig(2.5, "Pictorial: find percentage of a number"),
        "find_part":        PriorConfig(3.5, "Pictorial: discount/decrease problems"),
        "find_whole":       PriorConfig(4.5, "Transitional: tax/tip/markup problems"),
        "convert":          PriorConfig(5.5, "Symbolic: compare percentages across contexts"),
    },
    "fraction-bar": {
        "identify":     PriorConfig(1.5, "Concrete: identify unit fractions"),
        "build":        PriorConfig(2.5, "Pictorial: shade non-unit proper fractions"),
        "compare":      PriorConfig(3.5, "Pictorial: fractions with larger denominators"),
        "add_subtract": PriorConfig(4.5, "Transitional: fractions in operation context"),
    },
    "measurement-tools": {
        "measure":   PriorConfig(1.5, "Concrete: direct measurement with ruler"),
        "compare":   PriorConfig(2.5, "Pictorial: measure and compare objects"),
        "estimate":  PriorConfig(3.5, "Pictorial: measure with half-inch precision"),
        "convert":   PriorConfig(4.5, "Transitional: measure and convert between units"),
    },
    "length-lab": {
        "compare":        PriorConfig(1.5, "Direct visual comparison — which is longer/shorter"),
        "tile_and_count": PriorConfig(2.5, "Tile non-standard units and count"),
        "order":          PriorConfig(3.5, "Arrange 3 objects shortest to longest"),
        "indirect":       PriorConfig(4.5, "Transitive comparison via reference object"),
    },
    "compare-objects": {
        "identify_attribute": PriorConfig(1.0, "Identify measurable attributes of objects"),
        "compare_two":        PriorConfig(1.5, "Direct comparison of 2 objects on a named attribute"),
        "order_three":        PriorConfig(2.5, "Order 3 objects by a measurable attribute"),
        "non_standard":       PriorConfig(3.5, "Measure using non-standard units"),
    },
    "array-grid": {
        "build_array":    PriorConfig(1.5, "Concrete: build array with given dimensions"),
        "count_array":    PriorConfig(2.5, "Pictorial: count total objects in array"),
        "multiply_array": PriorConfig(3.5, "Pictorial: write multiplication from array"),
    },
    "area-model": {
        "build_model": PriorConfig(1.5, "Concrete: construct area model from factors"),
        "find_area":   PriorConfig(2.5, "Pictorial: calculate partial products and total"),
        "multiply":    PriorConfig(3.5, "Pictorial: multi-digit multiplication via model"),
        "factor":      PriorConfig(4.5, "Transitional: find factors from given area"),
    },
    "comparison-builder": {
        "compare_groups":    PriorConfig(1.5, "Concrete: visual group comparison"),
        "one_more_less":     PriorConfig(2.5, "Pictorial: adjacent number reasoning"),
        "compare_numbers":   PriorConfig(3.5, "Pictorial: symbolic comparison (>, <, =)"),
        "order":             PriorConfig(4.5, "Transitional: order multiple values"),
    },
    "place-value-chart": {
        "identify":      PriorConfig(1.5, "Concrete: identify place name and digit value"),
        "build":         PriorConfig(2.5, "Pictorial: construct number in chart"),
        "compare":       PriorConfig(3.5, "Pictorial: challenging multi-digit numbers"),
        "expanded_form": PriorConfig(4.5, "Transitional: expanded form with larger numbers"),
    },
    "skip-counting-runner": {
        "count_along":              PriorConfig(1.5, "Concrete: follow skip-count sequence"),
        "predict":                  PriorConfig(2.5, "Pictorial: anticipate next value"),
        "fill_missing":             PriorConfig(3.5, "Pictorial: complete missing terms"),
        "find_skip_value":          PriorConfig(4.5, "Transitional: discover skip interval"),
        "connect_multiplication":   PriorConfig(5.5, "Symbolic: link to multiplication facts"),
    },
    "number-sequencer": {
        "count_from":    PriorConfig(1.5, "Concrete: continue counting from value"),
        "before_after":  PriorConfig(2.5, "Pictorial: identify adjacent numbers"),
        "order_cards":   PriorConfig(3.5, "Pictorial: sequence a set of numbers"),
        "fill_missing":  PriorConfig(4.5, "Transitional: complete pattern gaps"),
        "decade_fill":   PriorConfig(5.5, "Symbolic: cross decade boundaries"),
    },
    "number-bond": {
        "decompose":       PriorConfig(1.5, "Concrete: break whole into parts"),
        "missing_part":    PriorConfig(2.5, "Pictorial: find unknown part"),
        "fact_family":     PriorConfig(3.5, "Pictorial: generate related facts"),
        "build_equation":  PriorConfig(4.5, "Transitional: write symbolic equation"),
    },
    "number-tracer": {
        "trace":     PriorConfig(1.0, "Concrete: follow dotted numeral path"),
        "copy":      PriorConfig(2.0, "Pictorial: write digit with model visible"),
        "write":     PriorConfig(3.0, "Pictorial: write digit from prompt only"),
        "sequence":  PriorConfig(4.0, "Transitional: write missing number in sequence"),
    },
    "addition-subtraction-scene": {
        "act_out":          PriorConfig(1.5, "Concrete: manipulate objects in scene"),
        "build_equation":   PriorConfig(2.5, "Pictorial: represent scene as equation"),
        "solve_story":      PriorConfig(3.5, "Pictorial: solve a word problem"),
        "create_story":     PriorConfig(4.5, "Transitional: write story for equation"),
    },
    "multiplication-explorer": {
        "build":           PriorConfig(1.5, "Concrete: construct groups/arrays"),
        "connect":         PriorConfig(2.5, "Pictorial: link representations"),
        "commutative":     PriorConfig(3.5, "Pictorial: apply commutative property"),
        "distributive":    PriorConfig(4.5, "Transitional: break apart with distribution"),
        "missing_factor":  PriorConfig(5.5, "Symbolic: solve for unknown factor"),
        "fluency":         PriorConfig(6.5, "Symbolic: rapid fact recall"),
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
        "compose":            PriorConfig(4.5, "Transitional: combine shapes"),
        "find_symmetry":      PriorConfig(5.5, "Symbolic: analyze symmetry lines"),
        "coordinate_shape":   PriorConfig(6.5, "Symbolic: build shapes on coordinate plane"),
    },
    "shape-tracer": {
        "trace":                    PriorConfig(1.5, "Concrete: follow dotted shape outline"),
        "connect_dots":             PriorConfig(2.5, "Pictorial: guided vertex construction"),
        "complete":                 PriorConfig(3.5, "Pictorial: finish partial shape"),
        "draw_from_description":    PriorConfig(4.5, "Transitional: construct from verbal cues"),
    },
    "math-fact-fluency": {
        "visual_fact":     PriorConfig(1.5, "Concrete: picture-based fact recognition"),
        "match":           PriorConfig(2.5, "Pictorial: connect visual to equation"),
        "equation_solve":  PriorConfig(3.5, "Pictorial: solve bare equation (MC)"),
        "missing_number":  PriorConfig(4.5, "Transitional: find unknown operand"),
        "speed_round":     PriorConfig(5.5, "Symbolic: timed rapid recall"),
    },
    "3d-shape-explorer": {
        "identify_3d":      PriorConfig(1.5, "Concrete: name 3D shapes from visual display"),
        "match_real_world":  PriorConfig(2.5, "Pictorial: connect shapes to real-world objects"),
        "2d_vs_3d":         PriorConfig(3.5, "Pictorial: compare and sort 2D vs 3D shapes"),
        "faces_properties":  PriorConfig(4.5, "Transitional: analyze faces/edges/vertices"),
        "shape_riddle":     PriorConfig(5.5, "Symbolic: deductive identification from clues"),
    },
    "strategy-picker": {
        "guided":       PriorConfig(1.5, "Concrete: follow a given strategy with scaffolding"),
        "match":        PriorConfig(2.5, "Pictorial: identify strategy from worked solution"),
        "try_another":  PriorConfig(3.5, "Pictorial: solve same problem a different way"),
        "compare":      PriorConfig(4.5, "Transitional: reflect on multiple strategies"),
        "choose":       PriorConfig(5.5, "Symbolic: autonomous strategy selection"),
    },
    "ratio-table": {
        "build_ratio":      PriorConfig(2.5, "Pictorial: construct equivalent ratio with slider"),
        "missing_value":    PriorConfig(3.5, "Pictorial: find hidden value in scaled ratio"),
        "find_multiplier":  PriorConfig(4.5, "Transitional: discover scale factor between ratios"),
        "unit_rate":        PriorConfig(5.5, "Symbolic: calculate and apply unit rate"),
    },
    "matrix-display": {
        "transpose":           PriorConfig(2.5, "Pictorial: swap rows and columns"),
        "add_subtract":        PriorConfig(3.5, "Pictorial: element-wise add/subtract"),
        "multiply":            PriorConfig(4.5, "Transitional: row-by-column multiplication"),
        "determinant_inverse": PriorConfig(5.5, "Symbolic: determinant and inverse"),
    },
    "double-number-line": {
        "equivalent_ratios": PriorConfig(2.5, "Pictorial: scale given unit rate to find pairs"),
        "find_missing":      PriorConfig(3.5, "Pictorial: find missing values in ratio"),
        "unit_rate":         PriorConfig(4.5, "Transitional: discover unit rate via division"),
    },
    "tape-diagram": {
        "represent":         PriorConfig(1.5, "Concrete: build diagram from word problem"),
        "solve_part_whole":  PriorConfig(2.5, "Pictorial: standard part-whole problems"),
        "solve_comparison":  PriorConfig(3.5, "Pictorial: comparison problems"),
        "multi_step":        PriorConfig(4.5, "Transitional: multi-step word problems"),
    },
    "factor-tree": {
        "guided_small":      PriorConfig(1.5, "Concrete: small composites (4-24) with factor pair hints"),
        "guided_medium":     PriorConfig(2.5, "Pictorial: medium composites (24-60) with hints"),
        "unguided":          PriorConfig(3.5, "Pictorial: medium composites (20-60) without hints"),
        "unguided_large":    PriorConfig(4.5, "Transitional: larger composites (40-80) without hints"),
        "assessment_intro":  PriorConfig(5.5, "Transitional: medium-large composites (40-80), no hints, no reset"),
        "assessment":        PriorConfig(6.5, "Symbolic: large composites (40-100), no hints, no reset"),
    },
    "bar-model":                  {"default": PriorConfig(3.0, "Bar model comparison")},
    "hundreds-chart": {
        "highlight_sequence": PriorConfig(1.5, "Highlight all cells in a skip-count pattern"),
        "complete_sequence":  PriorConfig(2.5, "Complete a partially highlighted skip-count sequence"),
        "identify_pattern":   PriorConfig(3.5, "Describe the visual pattern formed on the grid"),
        "find_skip_value":    PriorConfig(4.5, "Determine the skip interval from highlighted cells"),
    },
    "ordinal-line": {
        "identify":           PriorConfig(1.5, "Concrete: name ordinal position"),
        "match":              PriorConfig(2.5, "Pictorial: connect ordinal to symbol"),
        "relative_position":  PriorConfig(3.5, "Pictorial: before/after reasoning"),
        "sequence_story":     PriorConfig(4.5, "Transitional: ordinals in story context"),
        "build_sequence":     PriorConfig(5.5, "Symbolic: construct ordering from scratch"),
    },
    "coin-counter": {
        "identify":    PriorConfig(1.0, "Name coins by appearance"),
        "count-like":  PriorConfig(1.5, "Count sets of same coin type"),
        "count-mixed": PriorConfig(2.5, "Count mixed coin sets"),
        "compare":     PriorConfig(3.0, "Compare two coin groups"),
        "make-amount": PriorConfig(3.5, "Build a target amount with coins"),
        "make-change": PriorConfig(4.5, "Calculate change from a purchase"),
        "fewest-coins": PriorConfig(5.0, "Make amount using minimum coins"),
    },
    "time-sequencer": {
        "sequence-3":        PriorConfig(1.0, "Order 3 daily events"),
        "time-of-day":       PriorConfig(1.5, "Match events to morning/afternoon/night"),
        "sequence-5":        PriorConfig(2.0, "Order 5 daily events"),
        "before-after":      PriorConfig(2.5, "What happens before/after X?"),
        "duration-compare":  PriorConfig(3.0, "Which takes longer?"),
        "read-schedule":     PriorConfig(4.0, "Read a simple daily schedule with clock times"),
    },
    "analog-clock": {
        "read":      PriorConfig(1.5, "Read analog clock face and pick correct time"),
        "set_time":  PriorConfig(2.5, "Drag clock hands to show a given time"),
        "match":     PriorConfig(3.5, "Match analog face to digital display"),
        "elapsed":   PriorConfig(4.5, "Determine elapsed time using stopwatch"),
    },
    "spatial-scene": {
        "identify":          PriorConfig(1.0, "Identify position word from multiple choice"),
        "place":             PriorConfig(2.0, "Place object at described position on grid"),
        "describe":          PriorConfig(3.0, "Select position word for shown arrangement"),
        "follow_directions": PriorConfig(4.0, "Multi-step spatial placement"),
    },
    "shape-composer": {
        "free-create":     PriorConfig(-1.0, "Open-ended shape composition exploration"),
        "compose-match":   PriorConfig(-0.5, "Compose shapes to match a target silhouette"),
        "compose-picture": PriorConfig(0.0, "Arrange shapes to compose a target picture"),
        "decompose":       PriorConfig(0.5, "Identify component shapes of a composite"),
        "how-many-ways":   PriorConfig(1.0, "Determine minimum pieces needed for composition"),
    },
    "net-folder": {
        "count_faces_edges_vertices": PriorConfig(-0.8, "Count faces, edges, and vertices of a 3D solid"),
        "identify_solid":             PriorConfig(-0.3, "Identify the 3D solid from its appearance or net"),
        "match_faces":                PriorConfig(0.2, "Match highlighted net faces to corresponding solid faces"),
        "valid_net":                  PriorConfig(0.7, "Determine whether a given 2D net folds into a valid solid"),
        "surface_area":               PriorConfig(1.2, "Calculate surface area by summing face areas from the net"),
    },
    "equation-builder": {
        "build-simple":       PriorConfig(1.0, "Build a given equation from tiles"),
        "missing-result":     PriorConfig(1.5, "Find the result of an equation"),
        "true-false":         PriorConfig(2.0, "Determine if an equation is true or false"),
        "missing-operand":    PriorConfig(2.5, "Find a missing operand in an equation"),
        "balance-both-sides": PriorConfig(3.5, "Make both sides of = equal"),
        "rewrite":            PriorConfig(4.0, "Express an equation in a different form"),
    },
    "parameter-explorer": {
        "explore":                PriorConfig(1.0, "Free exploration with guided observations"),
        "predict-direction":      PriorConfig(2.0, "Predict output direction when parameter changes"),
        "identify-relationship":  PriorConfig(3.0, "Identify which parameter has strongest effect"),
        "predict-value":          PriorConfig(3.5, "Quantitative prediction of output value"),
    },
    "equation-workspace": {
        "guided-solve":        PriorConfig(1.5, "Operations highlighted as hints, student clicks in order"),
        "identify-operation":  PriorConfig(2.5, "Given partially-solved equation, identify the next valid step (MC)"),
        "solve":               PriorConfig(3.0, "Student picks operations freely, single-path validation"),
        "multi-step":          PriorConfig(4.0, "Longer equations requiring 4+ steps to solve"),
    },
    # -----------------------------------------------------------------
    # Assessment primitives
    # -----------------------------------------------------------------
    "knowledge-check": {
        "recall":   PriorConfig(1.5, "Bloom's recall: fact retrieval, obvious distractors"),
        "apply":    PriorConfig(3.0, "Bloom's apply: use knowledge to solve problems"),
        "analyze":  PriorConfig(4.5, "Bloom's analyze: multi-step reasoning, plausible distractors"),
        "evaluate": PriorConfig(6.0, "Bloom's evaluate: expert reasoning, strong distractors"),
    },
    "fill-in-blanks":             {"default": PriorConfig(3.5, "Fill in missing values")},
    "matching-activity":          {"default": PriorConfig(2.5, "Match pairs")},
    "sequencing-activity":        {"default": PriorConfig(3.0, "Order items correctly")},
    "true-false":                 {"default": PriorConfig(2.0, "True/false questions")},
    "categorization-activity":    {"default": PriorConfig(3.0, "Categorize items")},
    # -----------------------------------------------------------------
    # Literacy primitives
    # -----------------------------------------------------------------
    "sound-swap": {
        "addition":     PriorConfig(2.0, "Addition: add a phoneme to make a new word"),
        "deletion":     PriorConfig(3.0, "Deletion: remove a phoneme to reveal a new word"),
        "substitution": PriorConfig(4.0, "Substitution: swap a phoneme to change the word"),
    },
    "phonics-blender": {
        "cvc":          PriorConfig(1.5, "CVC: simple 3-phoneme blending"),
        "cvce_blend":   PriorConfig(2.5, "CVCE/blends: silent-e and consonant blends"),
        "digraph":      PriorConfig(3.5, "Digraphs: two letters, one sound (sh, ch, th)"),
        "advanced":     PriorConfig(5.0, "Advanced: r-controlled vowels and diphthongs"),
    },
    "rhyme-studio": {
        "recognition":    PriorConfig(1.5, "Recognition: do these words rhyme? (yes/no)"),
        "identification": PriorConfig(2.5, "Guided: pick the rhyming word from options"),
        "production":     PriorConfig(5.0, "Production: generate a rhyming word"),
    },
    "read-aloud-studio":          {"default": PriorConfig(3.0, "Read aloud fluency")},
    "context-clues-detective": {
        "definition":      PriorConfig(1.5, "Definition: meaning stated directly in text"),
        "synonym_antonym":  PriorConfig(2.5, "Synonym/Antonym: meaning from similar/opposite words"),
        "example":         PriorConfig(3.5, "Example: meaning from given examples"),
        "inference":       PriorConfig(5.5, "Inference: meaning from broader context"),
    },
    "sentence-analyzer": {
        "identify_pos":     PriorConfig(1.5, "Identify part of speech from multiple choice"),
        "identify_role":    PriorConfig(3.0, "Identify grammatical role from multiple choice"),
        "label_all":        PriorConfig(5.0, "Label all words with parts of speech"),
        "parse_structure":  PriorConfig(6.5, "Parse subject/predicate groups and classify sentence type"),
    },
    "sentence-builder": {
        "simple":           PriorConfig(1.5, "Simple: subject-verb-object sentence"),
        "compound":         PriorConfig(3.0, "Compound: two clauses with conjunction"),
        "complex":          PriorConfig(5.0, "Complex: subordinate clause construction"),
        "compound_complex": PriorConfig(7.0, "Compound-complex: multi-clause sentence"),
    },
    "figurative-language-finder": {
        "sound_devices": PriorConfig(2.0, "Sound devices: alliteration, onomatopoeia"),
        "comparison":    PriorConfig(3.0, "Comparison: simile and metaphor"),
        "advanced":      PriorConfig(4.5, "Advanced: personification, hyperbole, imagery"),
        "idiom":         PriorConfig(6.0, "Idiom: culturally specific expressions"),
    },
    "spelling-pattern-explorer": {
        "short_vowel":   PriorConfig(1.5, "Short vowel: CVC patterns"),
        "long_vowel":    PriorConfig(2.5, "Long vowel: CVCe, vowel teams"),
        "r_controlled":  PriorConfig(3.5, "R-controlled: ar, er, ir, or, ur"),
        "silent_letter": PriorConfig(4.0, "Silent letter: kn, wr, gn, mb"),
        "morphological": PriorConfig(5.0, "Morphological: suffix changes, Latin roots"),
    },
    "story-map": {
        "bme":            PriorConfig(1.5, "BME: beginning-middle-end (K-1)"),
        "story_mountain": PriorConfig(3.0, "Story mountain: 5-part arc (2-3)"),
        "plot_diagram":   PriorConfig(5.0, "Plot diagram: Freytag's pyramid (4-6)"),
        "heros_journey":  PriorConfig(6.5, "Hero's journey: complex structure (5-6)"),
    },
    "poetry-lab": {
        "analysis":    PriorConfig(3.5, "Analysis: identify poetic elements"),
        "composition": PriorConfig(6.0, "Composition: compose poem from template"),
    },
    "text-structure-analyzer": {
        "chronological_description": PriorConfig(2.0, "Chronological/description structure"),
        "cause_effect":              PriorConfig(2.5, "Cause-effect relationships"),
        "compare_contrast":          PriorConfig(3.0, "Compare-contrast analysis"),
        "problem_solution":          PriorConfig(3.5, "Problem-solution identification"),
    },
    "paragraph-architect": {
        "informational": PriorConfig(2.5, "Informational paragraph construction"),
        "narrative":     PriorConfig(3.5, "Narrative paragraph with elements"),
        "opinion":       PriorConfig(5.0, "Opinion paragraph with claim + support"),
    },
    "opinion-builder": {
        "oreo": PriorConfig(3.0, "OREO: Opinion-Reason-Example-Opinion (2-4)"),
        "cer":  PriorConfig(5.5, "CER: Claim-Evidence-Reasoning (5-6)"),
    },
    "revision-workshop": {
        "add_details":       PriorConfig(2.0, "Add sensory/specific details"),
        "word_choice":       PriorConfig(3.0, "Replace weak/vague words"),
        "combine_sentences": PriorConfig(3.5, "Combine choppy sentences"),
        "transitions":       PriorConfig(4.5, "Add/improve transition words"),
        "reorganize":        PriorConfig(5.5, "Reorder for logical flow"),
        "concision":         PriorConfig(6.5, "Eliminate wordiness"),
    },
    "syllable-clapper": {
        "easy":   PriorConfig(1.5, "Easy: high-frequency 1-2 syllable words, clear boundaries"),
        "medium": PriorConfig(2.5, "Medium: 2-3 syllable words, broader vocab, compound words"),
        "hard":   PriorConfig(3.5, "Hard: 3-4 syllable words, ambiguous boundaries"),
    },
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
    "phoneme-explorer": {
        "isolate":    PriorConfig(1.5, "Recognition: identify initial/final phoneme"),
        "blend":      PriorConfig(2.5, "Guided: combine phonemes into word"),
        "segment":    PriorConfig(3.5, "Application: break word into phonemes"),
        "manipulate": PriorConfig(5.0, "Production: add/delete/substitute phoneme"),
    },
    "word-workout": {
        "real_vs_nonsense": PriorConfig(1.5, "Recognition: real vs nonsense word"),
        "picture_match":    PriorConfig(2.5, "Guided: match decoded word to picture"),
        "word_chains":      PriorConfig(3.5, "Application: read one-letter-change chains"),
        "sentence_reading": PriorConfig(5.0, "Production: read word in sentence context"),
    },
    "word-sorter": {
        "binary_sort":  PriorConfig(1.5, "Sort word cards into 2 labeled buckets"),
        "ternary_sort": PriorConfig(2.5, "Sort word cards into 3 labeled buckets"),
        "match_pairs":  PriorConfig(3.5, "Match word pairs (singular→plural, antonyms, etc.)"),
    },
    "word-builder": {
        "simple_affix":    PriorConfig(1.5, "Simple: single prefix or suffix + common root"),
        "compound_affix":  PriorConfig(3.0, "Compound: prefix + root + suffix combinations"),
        "greek_latin":     PriorConfig(5.0, "Academic: Greek/Latin morpheme construction"),
        "multi_morpheme":  PriorConfig(7.0, "Advanced: complex multi-morpheme words"),
    },
    "decodable-reader":             {"default": PriorConfig(2.5, "Controlled-vocabulary reading with comprehension")},
    "cvc-speller": {
        "fill_vowel": PriorConfig(1.5, "Recognition: pick missing vowel in C_C frame"),
        "spell_word": PriorConfig(2.5, "Guided: spell full CVC word in Elkonin boxes"),
        "word_sort":  PriorConfig(3.5, "Application: sort words into vowel-sound buckets"),
    },
    "character-web": {
        "simple_traits":    PriorConfig(1.5, "Simple trait identification for 1-2 characters"),
        "trait_evidence":   PriorConfig(2.5, "Traits supported by text evidence quotes"),
        "default":          PriorConfig(3.5, "Character traits and relationship mapping"),
        "complex_analysis": PriorConfig(4.5, "Multi-layered character analysis with foils and themes"),
    },
    "genre-explorer":               {"default": PriorConfig(3.0, "Classify text excerpts by genre features")},
    "evidence-finder":              {"default": PriorConfig(3.5, "Find and highlight text evidence for claims")},
    "story-planner":                {"default": PriorConfig(3.0, "Pre-writing narrative planning with story arc")},
    "listen-and-respond":           {"default": PriorConfig(3.0, "Audio-only listening comprehension")},
    # -----------------------------------------------------------------
    # Engineering primitives
    # -----------------------------------------------------------------
    "tower-stacker":              {"default": PriorConfig(3.0, "Build stable tower")},
    "bridge-builder":             {"default": PriorConfig(4.0, "Build load-bearing bridge")},
    "lever-lab":                  {"default": PriorConfig(3.5, "Balance a lever")},
    "pulley-system":              {"default": PriorConfig(4.0, "Design pulley system")},
    "gear-train":                 {"default": PriorConfig(4.5, "Connect gears for target ratio")},
    "ramp-lab":                   {"default": PriorConfig(3.0, "Explore inclined planes")},
    "hydraulics-lab": {
        "predict": PriorConfig(-1.0, "Predict hydraulic outcomes before testing"),
        "observe": PriorConfig(0.0, "Watch fluid particles and explain pressure transmission"),
        "adjust":  PriorConfig(1.0, "Set piston sizes and forces to achieve specific outputs"),
    },
    "transport-challenge": {
        "single_constraint":  PriorConfig(-1.5, "One constraint, obvious best vehicle"),
        "multi_constraint":   PriorConfig(0.0, "Multiple constraints with trade-offs"),
        "full_optimization":  PriorConfig(1.5, "All constraints, no perfect answer"),
    },
    "propulsion-lab": {
        "predict":    PriorConfig(-1.0, "Predict propulsion outcomes before testing"),
        "observe":    PriorConfig(0.0, "Watch particles and explain Newton's Third Law"),
        "experiment": PriorConfig(1.0, "Design experiments comparing propulsion in different mediums"),
    },
    "construction-sequence-planner": {
        "sequence":         PriorConfig(-1.0, "Order 4-5 linear tasks with clear dependencies"),
        "dependency_chain": PriorConfig(0.0, "Order 5-6 tasks with branching/converging dependencies"),
        "parallel":         PriorConfig(1.0, "Find parallel paths to meet a deadline with 6-8 tasks"),
        "critical_path":    PriorConfig(2.0, "Identify critical path and optimize 8-10 task schedule"),
    },
    "wheel-axle-explorer":        {"default": PriorConfig(3.0, "Explore wheel-axle force multiplication")},
    "shape-strength-tester":      {"default": PriorConfig(3.5, "Test shape rigidity under load")},
    "foundation-builder":         {"default": PriorConfig(3.5, "Design foundations for soil/load")},
    "excavator-arm-simulator":    {"default": PriorConfig(3.5, "Control multi-jointed excavator arm")},
    "dump-truck-loader":          {"default": PriorConfig(2.5, "Load and haul material within capacity")},
    "blueprint-canvas":           {"default": PriorConfig(3.5, "Draw technical floor plans and elevations")},
    "flight-forces-explorer": {
        "predict": PriorConfig(-1.0, "Predict flight outcomes before testing"),
        "observe": PriorConfig(0.0, "Watch particles and explain forces"),
        "adjust":  PriorConfig(1.0, "Set controls to achieve specific flight states"),
    },
    "airfoil-lab":                {"default": PriorConfig(4.0, "Reshape airfoil and observe lift changes")},
    "vehicle-comparison-lab":     {"default": PriorConfig(3.0, "Compare vehicles using real data")},
    "propulsion-timeline":        {"default": PriorConfig(3.0, "Sequence transportation milestones")},
    "paper-airplane-designer":    {"default": PriorConfig(3.0, "Design, test, and iterate paper airplanes")},
    "engine-explorer":            {"default": PriorConfig(3.5, "Explore living engine particle simulation")},
    "vehicle-design-studio":      {"default": PriorConfig(4.0, "Design vehicle, test, analyze, iterate")},
    # -----------------------------------------------------------------
    # Biology primitives
    # -----------------------------------------------------------------
    "classification-sorter":      {"default": PriorConfig(2.5, "Sort organisms into categories")},
    "life-cycle-sequencer":       {"default": PriorConfig(3.0, "Sequence biological life stages")},
    "habitat-diorama":            {"default": PriorConfig(3.0, "Explore ecosystem relationships")},
    "bio-compare-contrast":       {"default": PriorConfig(3.5, "Compare biological entities")},
    "bio-process-animator":       {"default": PriorConfig(3.5, "Animate and comprehend biological process")},
    "microscope-viewer":          {"default": PriorConfig(4.0, "Label structures under microscope")},
    "adaptation-investigator":    {"default": PriorConfig(3.5, "Connect trait to function to environment")},
    "cell-builder":               {"default": PriorConfig(4.0, "Build cell model")},
    "inheritance-lab":            {"default": PriorConfig(5.0, "Punnett square and trait prediction")},
    "dna-explorer":               {"default": PriorConfig(5.0, "DNA structure exploration")},
    "protein-folder":             {"default": PriorConfig(5.5, "Protein folding and mutation effects")},
    "energy-cycle-engine":        {"default": PriorConfig(4.5, "Photosynthesis/respiration coupling")},
    "food-web-builder":           {"default": PriorConfig(3.5, "Construct food web")},
    "evolution-timeline":         {"default": PriorConfig(4.0, "Navigate deep-time evolutionary events")},
    # -----------------------------------------------------------------
    # Chemistry primitives
    # -----------------------------------------------------------------
    "molecule-viewer": {
        "explore":  PriorConfig(-1.0, "Click atoms and identify elements in the molecule"),
        "identify": PriorConfig(0.5, "Name bond types and molecular geometry"),
        "analyze":  PriorConfig(2.0, "Explain bonding patterns and predict molecular shape"),
    },
    "periodic-table": {
        "explore":  PriorConfig(-1.0, "Navigate the table and recall basic element facts"),
        "identify": PriorConfig(0.5, "Identify elements by properties or position"),
        "trend":    PriorConfig(2.0, "Predict properties from periodic trends"),
    },
    "matter-explorer": {
        "sort":     PriorConfig(-1.0, "Sort familiar objects into solid, liquid, gas bins"),
        "property": PriorConfig(0.5, "Identify properties that determine state of matter"),
        "mystery":  PriorConfig(2.0, "Classify tricky materials using property evidence"),
    },
    "reaction-lab": {
        "predict":  PriorConfig(-1.0, "Predict reaction outcomes before mixing"),
        "observe":  PriorConfig(0.5, "Identify signs of chemical vs physical change"),
        "explain":  PriorConfig(2.0, "Explain reactions using particle model and conservation of mass"),
    },
    "equation-balancer": {
        "simple":   PriorConfig(-0.5, "Balance simple 2-element equations with small coefficients"),
        "guided":   PriorConfig(1.0, "Balance multi-element equations with guided hints"),
        "complex":  PriorConfig(2.5, "Balance complex equations with 3+ elements independently"),
    },
    "energy-of-reactions": {
        "classify":    PriorConfig(-0.5, "Classify reactions as exothermic or endothermic from diagrams"),
        "diagram":     PriorConfig(1.0, "Read activation energy and deltaH from enthalpy diagrams"),
        "bond_energy": PriorConfig(2.5, "Calculate deltaH from bond energies"),
    },
    "states-of-matter": {
        "observe":  PriorConfig(-1.0, "Observe particle behavior and name the state of matter"),
        "predict":  PriorConfig(0.5, "Predict state changes from temperature adjustments"),
        "compare":  PriorConfig(2.0, "Compare phase change points across substances"),
    },
    "mixing-and-dissolving": {
        "dissolve": PriorConfig(-1.0, "Test which substances dissolve and which do not"),
        "classify": PriorConfig(0.5, "Classify as solution, suspension, or mixture"),
        "separate": PriorConfig(2.0, "Choose correct separation technique and explain why"),
    },
    "atom-builder": {
        "build":        PriorConfig(-1.0, "Build a named element from protons, neutrons, electrons"),
        "identify":     PriorConfig(0.5, "Identify element from particle counts and fill electron shells"),
        "ion_isotope":  PriorConfig(2.0, "Create specific ions and isotopes"),
    },
    "molecule-constructor": {
        "build":    PriorConfig(-0.5, "Build simple molecules from a name or formula"),
        "identify": PriorConfig(1.0, "Identify molecules and write formulas from structure"),
        "predict":  PriorConfig(2.5, "Predict properties and shape from molecular structure"),
    },
    "ph-explorer": {
        "test":        PriorConfig(-1.0, "Test substances and sort as acid, base, or neutral"),
        "indicator":   PriorConfig(0.5, "Match indicator colors to pH ranges"),
        "neutralize":  PriorConfig(2.0, "Predict and achieve target pH through neutralization"),
    },
    "safety-lab": {
        "hazard":    PriorConfig(-1.0, "Spot hazards in a lab scene"),
        "ppe":       PriorConfig(0.5, "Select correct PPE for given experiment"),
        "emergency": PriorConfig(2.0, "Sequence emergency procedures and match GHS symbols"),
    },
    # -----------------------------------------------------------------
    # Astronomy primitives
    # -----------------------------------------------------------------
    "rocket-builder":             {"default": PriorConfig(4.5, "Design and launch rocket")},
    "orbit-mechanics-lab":        {"default": PriorConfig(5.0, "Orbital mechanics simulation")},
    "light-shadow-lab": {
        "observe": PriorConfig(1.5, "Observe shadow changes by dragging sun"),
        "predict": PriorConfig(3.0, "Predict shadow direction and length"),
        "measure": PriorConfig(4.5, "Record and analyze shadow data"),
        "apply":   PriorConfig(6.0, "Reverse reasoning: determine time from shadow"),
    },
    "constellation-builder": {
        "guided_trace": PriorConfig(1.5, "Numbered dots — tap stars in order to trace constellation"),
        "free_connect": PriorConfig(3.0, "No numbers — identify and connect correct stars from field"),
        "identify":     PriorConfig(4.5, "Lines drawn — select correct constellation name"),
        "seasonal":     PriorConfig(6.0, "Identify constellations visible in a given season"),
    },
    "planetary-explorer": {
        "explore":  PriorConfig(1.5, "Basic recall after reading planet info"),
        "identify": PriorConfig(3.0, "Identify planets from descriptions"),
        "compare":  PriorConfig(4.5, "Compare properties across planets"),
        "apply":    PriorConfig(6.0, "Reasoning about why — apply knowledge"),
    },
    # -----------------------------------------------------------------
    # Physics primitives
    # -----------------------------------------------------------------
    "sound-wave-explorer": {
        "observe":  PriorConfig(1.5, "Tap objects, watch vibrations, answer MC about what produces sound"),
        "predict":  PriorConfig(3.0, "Adjust force/speed, predict pitch/volume change before hearing"),
        "classify": PriorConfig(4.5, "Compare objects/materials, rank by pitch or sort by sound travel"),
        "apply":    PriorConfig(6.0, "Reverse reasoning — hear a sound, identify the force/speed/medium"),
    },
    "push-pull-arena": {
        "observe":  PriorConfig(1.5, "Push/pull an object, answer MC about what happened"),
        "predict":  PriorConfig(3.0, "Predict movement given weight + push strength"),
        "compare":  PriorConfig(4.5, "Compare two objects/surfaces by effort needed"),
        "design":   PriorConfig(6.0, "Set up forces to achieve a goal"),
    },
    "race-track-lab": {
        "observe":    PriorConfig(1.5, "Watch race, answer who won or who was fastest"),
        "predict":    PriorConfig(3.0, "Set speeds, predict winner before race runs"),
        "measure":    PriorConfig(4.5, "Count grid squares traveled, compare distances in same time"),
        "calculate":  PriorConfig(6.0, "Given distance and time, compute speed"),
        "graph":      PriorConfig(7.5, "Generate position-time graph, identify velocity from slope"),
    },
    "gravity-drop-tower": {
        "observe":    PriorConfig(1.5, "Drop objects, answer what happened / direction"),
        "predict":    PriorConfig(3.0, "Predict which lands first with/without air resistance"),
        "compare":    PriorConfig(4.5, "Drop from different heights, rank landing order"),
        "measure":    PriorConfig(6.0, "Time the fall, measure height, discover fall time relationship"),
        "calculate":  PriorConfig(7.5, "Use h = ½gt² to predict fall time, compute impact velocity"),
    },
    # -----------------------------------------------------------------
    # Core / general-content primitives
    # -----------------------------------------------------------------
    "fact-file": {
        "explore":  PriorConfig(1.5, "Guided exploration with easy recall questions"),
        "recall":   PriorConfig(3.5, "Unguided recall, mix of easy and medium"),
        "apply":    PriorConfig(5.0, "Inference and synthesis across sections"),
    },
    "how-it-works": {
        "guided":   PriorConfig(1.5, "Guided walkthrough with identify questions"),
        "sequence": PriorConfig(3.5, "Sequence ordering and identify questions"),
        "predict":  PriorConfig(5.5, "Predict next step and explain reasoning"),
    },
    "timeline-explorer": {
        "explore":  PriorConfig(1.5, "Guided exploration with identify questions"),
        "order":    PriorConfig(3.5, "Chronological ordering and identify questions"),
        "connect":  PriorConfig(5.5, "Cause-effect matching and date placement"),
    },
    "vocabulary-explorer": {
        "explore":  PriorConfig(1.5, "Guided exploration with term matching"),
        "recall":   PriorConfig(3.5, "Unguided recall with matching and fill-in-blank"),
        "apply":    PriorConfig(5.5, "Contextual usage and fill-in-blank"),
    },
    # -----------------------------------------------------------------
    # Digital skills primitives
    # -----------------------------------------------------------------
    "digital-skills-sim": {
        "click":  PriorConfig(-1.5, "Click accuracy and speed practice"),
        "drag":   PriorConfig(-1.0, "Drag objects to target zones"),
        "type":   PriorConfig(-0.5, "Find and press the correct key"),
    },
    # -----------------------------------------------------------------
    # Calendar primitives
    # -----------------------------------------------------------------
    "calendar-explorer": {
        "identify": PriorConfig(-1.5, "Find specific dates on calendar"),
        "count":    PriorConfig(0.0, "Count specific days or days between dates"),
        "pattern":  PriorConfig(1.5, "Discover and apply calendar patterns"),
    },
    "timeline-builder": {
        "sequence-daily":    PriorConfig(-1.5, "Order events within a day"),
        "sequence-yearly":   PriorConfig(0.0, "Order events across months/seasons"),
        "place-historical":  PriorConfig(1.5, "Place events on decade/century timelines"),
    },
    # -----------------------------------------------------------------
    # Core / meta-primitives
    # -----------------------------------------------------------------
    "deep-dive": {
        "explore":  PriorConfig(-1.5, "Mostly display blocks with 1-2 easy MC questions"),
        "recall":   PriorConfig(-0.5, "More MC questions testing direct recall"),
        "apply":    PriorConfig(0.5, "Data tables + MC requiring cross-referencing"),
        "analyze":  PriorConfig(1.5, "Hard MC + synthesis questions across blocks"),
    },
    # -----------------------------------------------------------------
    # Function Sketch primitives (per-mode β)
    # -----------------------------------------------------------------
    "function-sketch": {
        "classify-shape":    PriorConfig(1.5, "Identify if a curve is linear, quadratic, exponential, or periodic"),
        "identify-features": PriorConfig(2.0, "Mark roots, extrema, intercepts, asymptotes on a given curve"),
        "compare-functions": PriorConfig(2.5, "Two curves shown — identify which matches a description"),
        "sketch-match":      PriorConfig(3.5, "Place control points to sketch a described function"),
    },
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


def get_item_discrimination(
    primitive_type: str, eval_mode: str
) -> Tuple[float, float]:
    """Look up (a, c) for a (primitive_type, eval_mode) pair.

    Returns (discrimination_a, guessing_c).
    """
    prior = get_discrimination_prior(primitive_type, eval_mode)
    return (prior.a, prior.c)
