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
        "observe":       PriorConfig(2.5, "Pictorial: watch input/output with rule visible"),
        "predict":       PriorConfig(3.0, "Pictorial: predict output for new input"),
        "discover_rule": PriorConfig(3.5, "Strategy: identify hidden function rule"),
        "create_rule":   PriorConfig(4.5, "Transitional: write rule for given I/O pairs"),
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
    "regrouping-workbench": {
        "add_no_regroup":      PriorConfig(1.5, "Concrete: addition without carrying"),
        "subtract_no_regroup": PriorConfig(2.5, "Pictorial: subtraction without borrowing"),
        "add_regroup":         PriorConfig(3.5, "Strategy: addition with carrying"),
        "subtract_regroup":    PriorConfig(5.0, "Transitional: subtraction with borrowing"),
    },
    "percent-bar": {
        "identify_percent": PriorConfig(2.5, "Pictorial: find percentage of a number"),
        "find_part":        PriorConfig(3.5, "Pictorial: discount/decrease problems"),
        "find_whole":       PriorConfig(5.0, "Transitional: tax/tip/markup problems"),
        "convert":          PriorConfig(6.5, "Symbolic: compare percentages across contexts"),
    },
    "fraction-bar": {
        "identify":     PriorConfig(1.5, "Concrete: identify unit fractions"),
        "build":        PriorConfig(2.5, "Pictorial: shade non-unit proper fractions"),
        "compare":      PriorConfig(3.5, "Pictorial: fractions with larger denominators"),
        "add_subtract": PriorConfig(5.0, "Transitional: fractions in operation context"),
    },
    "measurement-tools": {
        "measure":   PriorConfig(1.5, "Concrete: direct measurement with ruler"),
        "compare":   PriorConfig(3.0, "Pictorial: measure and compare objects"),
        "convert":   PriorConfig(5.0, "Transitional: measure and convert between units"),
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
        "factor":      PriorConfig(5.0, "Transitional: find factors from given area"),
    },
    "comparison-builder": {
        "compare_groups":    PriorConfig(1.5, "Concrete: visual group comparison"),
        "one_more_less":     PriorConfig(2.5, "Pictorial: adjacent number reasoning"),
        "compare_numbers":   PriorConfig(3.5, "Pictorial: symbolic comparison (>, <, =)"),
        "order":             PriorConfig(5.0, "Transitional: order multiple values"),
    },
    "place-value-chart": {
        "identify":      PriorConfig(1.5, "Concrete: identify place name and digit value"),
        "build":         PriorConfig(2.5, "Pictorial: construct number in chart"),
        "compare":       PriorConfig(3.5, "Pictorial: challenging multi-digit numbers"),
        "expanded_form": PriorConfig(5.0, "Transitional: expanded form with larger numbers"),
    },
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
    "3d-shape-explorer": {
        "identify_3d":      PriorConfig(1.5, "Concrete: name 3D shapes from visual display"),
        "match_real_world":  PriorConfig(2.5, "Pictorial: connect shapes to real-world objects"),
        "2d_vs_3d":         PriorConfig(3.5, "Pictorial: compare and sort 2D vs 3D shapes"),
        "faces_properties":  PriorConfig(5.0, "Transitional: analyze faces/edges/vertices"),
        "shape_riddle":     PriorConfig(6.5, "Symbolic: deductive identification from clues"),
    },
    "strategy-picker": {
        "guided":       PriorConfig(1.5, "Concrete: follow a given strategy with scaffolding"),
        "match":        PriorConfig(2.5, "Pictorial: identify strategy from worked solution"),
        "try_another":  PriorConfig(3.5, "Pictorial: solve same problem a different way"),
        "compare":      PriorConfig(5.0, "Transitional: reflect on multiple strategies"),
        "choose":       PriorConfig(6.5, "Symbolic: autonomous strategy selection"),
    },
    "ratio-table": {
        "build_ratio":      PriorConfig(2.5, "Pictorial: construct equivalent ratio with slider"),
        "missing_value":    PriorConfig(3.5, "Pictorial: find hidden value in scaled ratio"),
        "find_multiplier":  PriorConfig(5.0, "Transitional: discover scale factor between ratios"),
        "unit_rate":        PriorConfig(6.5, "Symbolic: calculate and apply unit rate"),
    },
    "matrix-display": {
        "transpose":           PriorConfig(2.5, "Pictorial: swap rows and columns"),
        "add_subtract":        PriorConfig(3.5, "Pictorial: element-wise add/subtract"),
        "multiply":            PriorConfig(5.0, "Transitional: row-by-column multiplication"),
        "determinant_inverse": PriorConfig(6.5, "Symbolic: determinant and inverse"),
    },
    "double-number-line": {
        "equivalent_ratios": PriorConfig(2.5, "Pictorial: scale given unit rate to find pairs"),
        "find_missing":      PriorConfig(3.5, "Pictorial: find missing values in ratio"),
        "unit_rate":         PriorConfig(5.0, "Transitional: discover unit rate via division"),
    },
    "tape-diagram": {
        "represent":         PriorConfig(1.5, "Concrete: build diagram from word problem"),
        "solve_part_whole":  PriorConfig(2.5, "Pictorial: standard part-whole problems"),
        "solve_comparison":  PriorConfig(3.5, "Pictorial: comparison problems"),
        "multi_step":        PriorConfig(5.0, "Transitional: multi-step word problems"),
    },
    "factor-tree": {
        "guided_small":      PriorConfig(1.5, "Concrete: small composites (4-24) with factor pair hints"),
        "guided_medium":     PriorConfig(2.5, "Pictorial: medium composites (24-60) with hints"),
        "unguided":          PriorConfig(3.5, "Pictorial: medium composites (20-60) without hints"),
        "assessment":        PriorConfig(6.5, "Symbolic: large composites (40-100), no hints, no reset"),
    },
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
