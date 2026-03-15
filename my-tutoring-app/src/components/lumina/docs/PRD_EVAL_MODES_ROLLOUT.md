# PRD: Eval Modes Rollout — Math Primitives

**Status:** Active
**Last Updated:** 2026-03-14
**Skill:** `/add-eval-modes`
**Reference:** `lumina_difficulty_calibration_prd.md` (scaffolding mode taxonomy, IRT β priors)

---

## Overview

Each eval mode isolates a single cognitive task inside a primitive so the IRT engine can estimate a per-mode ability parameter (β). The `/add-eval-modes` skill handles the mechanical work: catalog definition, generator `CHALLENGE_TYPE_DOCS` + constraint wiring, and generator registry `...item.config` spread.

This PRD tracks **all 41 math primitives**, defines their target eval modes with β priors, and prioritizes the rollout.

### Scaffolding Mode → β Reference

| Scaffold | Description | Prior β |
|----------|-------------|---------|
| 1 | Concrete manipulative, full guidance | 1.5 |
| 2 | Pictorial representation, prompts | 2.5 |
| 3 | Pictorial, reduced prompts | 3.5 |
| 4 | Transitional (mixed symbolic/pictorial) | 5.0 |
| 5 | Symbolic, single operation | 6.5 |
| 6 | Symbolic, multi-step / cross-concept | 8.0 |

Within-mode adjustments of ±0.5–1.0 are allowed for number range, operation complexity, distractors, and time pressure.

---

## Status Legend

- **DONE** — Eval modes defined in catalog + wired in generator + registry spread confirmed
- **READY** — Has challenge type enum; can run `/add-eval-modes` directly
- **NEEDS TYPES** — No challenge type enum in schema; must add types before eval modes
- **SKIP** — Display-only primitive; eval modes not applicable

### Conversion Patterns (for NEEDS TYPES primitives)

- **Pattern A (ADAPT)** — Has existing enum that can serve as challenge types (~20 min)
- **Pattern B (PHASE-CONVERT)** — Phase-based flow → type-driven challenges (~30-40 min)
- **Pattern C (SINGLE-VIZ)** — Single visualization → add challenge type enum (~45-60 min)

---

## Tier A: DONE (3 primitives)

These are the reference implementations. No action needed.

### 1. TenFrame
- **File:** `gemini-ten-frame.ts`
- **Challenge types:** `build`, `subitize`, `make_ten`, `add`, `subtract`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `build` | 1.5 | 1 | `['build']` | Place counters on frame with guidance |
| `subitize` | 2.5 | 2 | `['subitize']` | Flash recognition of quantity |
| `make_ten` | 3.5 | 3 | `['make_ten']` | Find complement to 10 |
| `operate` | 5.0 | 4 | `['add', 'subtract']` | Addition/subtraction with frames |

### 2. CountingBoard
- **File:** `gemini-counting-board.ts`
- **Challenge types:** `count_all`, `subitize`, `count_on`, `group_count`, `compare`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `count` | 1.0 | 1 | `['count_all']` | Count all objects |
| `subitize` | 2.0 | 2 | `['subitize']` | Instant quantity recognition |
| `group` | 2.0 | 2 | `['group_count']` | Count by groups |
| `count_on` | 2.5 | 3 | `['count_on']` | Continue counting from a given number |
| `compare` | 2.5 | 3 | `['compare']` | Compare two quantities |

### 3. BaseTenBlocks
- **File:** `gemini-base-ten-blocks.ts`
- **Challenge types:** `build_number`, `read_blocks`, `regroup`, `add_with_blocks`, `subtract_with_blocks`

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `build_number` | 1.5 | 1 | `['build_number']` | Represent number with blocks |
| `read_blocks` | 2.5 | 2 | `['read_blocks']` | Identify value from block display |
| `regroup` | 3.5 | 3 | `['regroup']` | Exchange between place values |
| `operate` | 5.0 | 4 | `['add_with_blocks', 'subtract_with_blocks']` | Operations using blocks |

---

## Tier B: READY — Core K-2 Foundations (9 primitives)

High-priority primitives with existing challenge type enums. Run `/add-eval-modes` directly.

### 4. NumberLine
- **File:** `gemini-number-line.ts`
- **Challenge types:** `plot_point`, `show_jump`, `order_values`, `find_between`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `plot` | 1.5 | 1 | `['plot_point']` | Place value on number line |
| `jump` | 2.5 | 2 | `['show_jump']` | Show operation as movement |
| `order` | 3.5 | 3 | `['order_values']` | Sequence multiple values |
| `between` | 5.0 | 4 | `['find_between']` | Estimate/find values between marks |

### 5. FractionCircles
- **File:** `gemini-fraction-circles.ts`
- **Challenge types:** `identify`, `build`, `compare`, `equivalent`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name the fraction shown |
| `build` | 2.5 | 2 | `['build']` | Construct a given fraction |
| `compare` | 3.5 | 3 | `['compare']` | Compare two fractions |
| `equivalent` | 5.0 | 4 | `['equivalent']` | Find equivalent fractions |

### 6. PatternBuilder
- **File:** `gemini-pattern-builder.ts`
- **Challenge types:** `extend`, `identify_core`, `create`, `translate`, `find_rule`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `extend` | 1.5 | 1 | `['extend']` | Continue a given pattern |
| `identify_core` | 2.5 | 2 | `['identify_core']` | Find the repeating unit |
| `translate` | 3.5 | 3 | `['translate']` | Transform pattern representation |
| `create` | 5.0 | 4 | `['create']` | Generate pattern from a rule |
| `find_rule` | 6.5 | 5 | `['find_rule']` | Discover underlying rule |

### 7. NumberBond
- **File:** `gemini-number-bond.ts`
- **Challenge types:** `decompose`, `missing-part`, `fact-family`, `build-equation`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `decompose` | 1.5 | 1 | `['decompose']` | Break whole into parts |
| `missing_part` | 2.5 | 2 | `['missing-part']` | Find unknown part |
| `fact_family` | 3.5 | 3 | `['fact-family']` | Generate related facts |
| `build_equation` | 5.0 | 4 | `['build-equation']` | Write symbolic equation |

### 8. ComparisonBuilder
- **File:** `gemini-comparison-builder.ts`
- **Challenge types:** `compare-groups`, `compare-numbers`, `order`, `one-more-one-less`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `compare_groups` | 1.5 | 1 | `['compare-groups']` | Visual group comparison |
| `one_more_less` | 2.5 | 2 | `['one-more-one-less']` | Adjacent number reasoning |
| `compare_numbers` | 3.5 | 3 | `['compare-numbers']` | Symbolic comparison (>, <, =) |
| `order` | 5.0 | 4 | `['order']` | Order multiple values |

### 9. AdditionSubtractionScene
- **File:** `gemini-addition-subtraction-scene.ts`
- **Challenge types:** `act-out`, `build-equation`, `solve-story`, `create-story`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `act_out` | 1.5 | 1 | `['act-out']` | Manipulate objects in scene |
| `build_equation` | 2.5 | 2 | `['build-equation']` | Represent scene as equation |
| `solve_story` | 3.5 | 3 | `['solve-story']` | Solve a word problem |
| `create_story` | 5.0 | 4 | `['create-story']` | Write story for given equation |

### 10. OrdinalLine
- **File:** `gemini-ordinal-line.ts`
- **Challenge types:** `identify`, `match`, `relative-position`, `sequence-story`, `build-sequence`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name ordinal position |
| `match` | 2.5 | 2 | `['match']` | Connect ordinal to position |
| `relative_position` | 3.5 | 3 | `['relative-position']` | Compare positions (before/after) |
| `sequence_story` | 5.0 | 4 | `['sequence-story']` | Apply ordinals in context |
| `build_sequence` | 6.5 | 5 | `['build-sequence']` | Construct ordering from scratch |

### 11. ShapeSorter
- **File:** `gemini-shape-sorter.ts`
- **Challenge types:** `identify`, `count`, `sort`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name 2D shapes |
| `count` | 2.5 | 2 | `['count']` | Count shapes by type |
| `sort` | 3.5 | 3 | `['sort']` | Classify by geometric property |

### 12. BalanceScale
- **File:** `gemini-balance-scale.ts`
- **Challenge types:** `equality`, `one_step`, `two_step`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `equality` | 1.5 | 1 | `['equality']` | Understand balance = equal |
| `one_step` | 3.5 | 3 | `['one_step']` | Solve single-operation equation |
| `two_step` | 6.5 | 5 | `['two_step']` | Solve multi-step equation |

---

## Tier C: READY — Grades 2-5 Core (10 primitives)

Important primitives for elementary progression. All have challenge type enums.

### 13. MathFactFluency
- **File:** `gemini-math-fact-fluency.ts`
- **Challenge types:** `visual-fact`, `equation-solve`, `missing-number`, `match`, `speed-round`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `visual_fact` | 1.5 | 1 | `['visual-fact']` | Picture-based fact recognition |
| `match` | 2.5 | 2 | `['match']` | Connect fact pairs |
| `equation_solve` | 3.5 | 3 | `['equation-solve']` | Solve given equation |
| `missing_number` | 5.0 | 4 | `['missing-number']` | Find unknown in equation |
| `speed_round` | 6.5 | 5 | `['speed-round']` | Timed fluency assessment |

### 14. MultiplicationExplorer
- **File:** `gemini-multiplication-explorer.ts`
- **Challenge types:** `build`, `connect`, `commutative`, `distributive`, `missing_factor`, `fluency`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `build` | 1.5 | 1 | `['build']` | Construct groups/arrays |
| `connect` | 2.5 | 2 | `['connect']` | Link representations |
| `commutative` | 3.5 | 3 | `['commutative']` | Apply commutative property |
| `distributive` | 5.0 | 4 | `['distributive']` | Break apart with distribution |
| `missing_factor` | 6.5 | 5 | `['missing_factor']` | Solve for unknown factor |
| `fluency` | 8.0 | 6 | `['fluency']` | Rapid fact recall |

### 15. NumberSequencer
- **File:** `gemini-number-sequencer.ts`
- **Challenge types:** `fill-missing`, `before-after`, `order-cards`, `count-from`, `decade-fill`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `count_from` | 1.5 | 1 | `['count-from']` | Continue counting from value |
| `before_after` | 2.5 | 2 | `['before-after']` | Identify adjacent numbers |
| `order_cards` | 3.5 | 3 | `['order-cards']` | Sequence a set of numbers |
| `fill_missing` | 5.0 | 4 | `['fill-missing']` | Complete pattern gaps |
| `decade_fill` | 6.5 | 5 | `['decade-fill']` | Cross decade boundaries |

### 16. SkipCountingRunner
- **File:** `gemini-skip-counting-runner.ts`
- **Challenge types:** `count_along`, `predict`, `fill_missing`, `find_skip_value`, `connect_multiplication`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `count_along` | 1.5 | 1 | `['count_along']` | Follow skip-count sequence |
| `predict` | 2.5 | 2 | `['predict']` | Anticipate next value |
| `fill_missing` | 3.5 | 3 | `['fill_missing']` | Complete missing terms |
| `find_skip_value` | 5.0 | 4 | `['find_skip_value']` | Discover the skip interval |
| `connect_multiplication` | 6.5 | 5 | `['connect_multiplication']` | Link to multiplication facts |

### 17. ShapeBuilder
- **File:** `gemini-shape-builder.ts`
- **Challenge types:** `build`, `measure`, `classify`, `compose`, `find_symmetry`, `coordinate_shape`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `build` | 1.5 | 1 | `['build']` | Construct given shape |
| `measure` | 2.5 | 2 | `['measure']` | Find side lengths / angles |
| `classify` | 3.5 | 3 | `['classify']` | Identify shape properties |
| `compose` | 5.0 | 4 | `['compose']` | Combine shapes |
| `find_symmetry` | 6.5 | 5 | `['find_symmetry']` | Analyze symmetry lines |
| `coordinate_shape` | 8.0 | 6 | `['coordinate_shape']` | Build shapes on coordinate plane |

### 18. ShapeTracer
- **File:** `gemini-shape-tracer.ts`
- **Challenge types:** `trace`, `complete`, `draw-from-description`, `connect-dots`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `trace` | 1.5 | 1 | `['trace']` | Follow shape outline |
| `connect_dots` | 2.5 | 2 | `['connect-dots']` | Guided vertex construction |
| `complete` | 3.5 | 3 | `['complete']` | Finish partial shape |
| `draw_from_description` | 5.0 | 4 | `['draw-from-description']` | Construct from verbal cues |

### 19. SortingStation
- **File:** `gemini-sorting-station.ts`
- **Challenge types:** `sort-by-one`, `sort-by-attribute`, `count-and-compare`, `two-attributes`, `odd-one-out`, `tally-record`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `sort_one` | 1.5 | 1 | `['sort-by-one']` | Sort by single criterion |
| `sort_attribute` | 2.5 | 2 | `['sort-by-attribute']` | Sort by named property |
| `count_compare` | 3.5 | 3 | `['count-and-compare']` | Quantify and compare groups |
| `odd_one_out` | 4.0 | 3 | `['odd-one-out']` | Identify exception |
| `two_attributes` | 5.0 | 4 | `['two-attributes']` | Multi-criterion classification |
| `tally_record` | 5.5 | 4 | `['tally-record']` | Record data with tallies |

### 20. 3DShapeExplorer
- **File:** `gemini-3d-shape-explorer.ts`
- **Challenge types:** `identify-3d`, `2d-vs-3d`, `match-to-real-world`, `faces-and-properties`, `shape-riddle`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify_3d` | 1.5 | 1 | `['identify-3d']` | Name 3D shapes |
| `match_real_world` | 2.5 | 2 | `['match-to-real-world']` | Connect to real objects |
| `2d_vs_3d` | 3.5 | 3 | `['2d-vs-3d']` | Compare 2D and 3D |
| `faces_properties` | 5.0 | 4 | `['faces-and-properties']` | Analyze faces/edges/vertices |
| `shape_riddle` | 6.5 | 5 | `['shape-riddle']` | Deductive identification |

### 21. StrategyPicker
- **File:** `gemini-strategy-picker.ts`
- **Challenge types:** `guided-strategy`, `try-another`, `compare`, `choose-your-strategy`, `match-strategy`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `guided` | 1.5 | 1 | `['guided-strategy']` | Follow a given strategy |
| `match` | 2.5 | 2 | `['match-strategy']` | Identify correct strategy |
| `try_another` | 3.5 | 3 | `['try-another']` | Apply alternative approach |
| `compare` | 5.0 | 4 | `['compare']` | Evaluate multiple strategies |
| `choose` | 6.5 | 5 | `['choose-your-strategy']` | Autonomous strategy selection |

### 22. RatioTable
- **File:** `gemini-ratio-table.ts`
- **Challenge types:** `missing-value`, `find-multiplier`, `build-ratio`, `unit-rate`
- **Status:** DONE

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `build_ratio` | 2.5 | 2 | `['build-ratio']` | Construct ratio from context |
| `missing_value` | 3.5 | 3 | `['missing-value']` | Find unknown in table |
| `find_multiplier` | 5.0 | 4 | `['find-multiplier']` | Discover scale factor |
| `unit_rate` | 6.5 | 5 | `['unit-rate']` | Reduce to unit rate |

---

## Tier D: Schema Work Required (19 primitives)

These primitives need schema and/or component changes before eval modes can be added. A full audit (2026-03-14) classified each into one of three conversion patterns and one skip recommendation.

### Conversion Patterns

Every Tier D primitive follows one of these patterns. Understanding which pattern applies determines the implementation approach and effort estimate.

#### Pattern A: ADAPT — Has existing enum that can serve as challenge types

The generator already has an enum field (e.g., `operationType`, `problemType`) that encodes meaningful pedagogical variation. The field may need renaming or the component may need to branch on it, but no new cognitive task design is needed.

**Steps:**
1. Rename/alias existing enum as challenge type in schema
2. Add `CHALLENGE_TYPE_DOCS` mapping existing values
3. Add `evalModes` to catalog, mapping enum values to β priors
4. Wire `resolveEvalModeConstraint()` + `constrainChallengeTypeEnum()` in generator
5. Verify component renders correctly per type (usually already does)

**Estimated effort:** ~20 min per primitive

**Primitives using this pattern:** RegroupingWorkbench (has `type: 'carry' | 'borrow'` + `challenges[]`), Matrix (has `operationType` enum), PercentBar (has `problemType` context enum)

#### Pattern B: PHASE-CONVERT — Phase-based flow → type-driven challenges

The generator produces a fixed multi-phase structure (e.g., 3 phases: identify → apply → build). Phases are implicit in the data layout, not driven by a type enum. Converting means replacing the fixed phase sequence with a challenge type that selects which phase(s) to present.

**Steps:**
1. Add `challengeType` enum to schema mapping to existing phases
2. Generator: when eval mode active, produce only the relevant phase's data
3. Generator: when no eval mode, produce all phases (backward compat)
4. Component: may need conditional rendering per challenge type, or may already work if phases are independently renderable
5. Add `CHALLENGE_TYPE_DOCS` + catalog `evalModes`

**Estimated effort:** ~30-40 min per primitive (component changes are the variable)

**Primitives using this pattern:** PlaceValueChart (3-phase), FractionBar (3-phase), TapeDiagram (3-phase with 4 parts), DoubleNumberLine (implicit 3-phase in targetPoints)

#### Pattern C: SINGLE-VIZ — Single visualization → add challenge type enum

The generator produces one static visualization with configuration parameters. There are no phases, no challenge array, and no type differentiation. Adding eval modes requires designing distinct challenge types from scratch and restructuring the schema to support a `challenges[]` array or a root-level `challengeType` enum.

**Steps:**
1. Design 3-4 challenge types representing a pedagogical progression
2. Add `challengeType` enum + restructure schema (may need `challenges[]` array)
3. Update generator prompt to produce type-specific content
4. Update component to branch rendering/interaction per challenge type
5. Add `CHALLENGE_TYPE_DOCS` + catalog `evalModes`
6. Add scoring/metrics per challenge type

**Estimated effort:** ~45-60 min per primitive (schema design + component refactor)

**Primitives using this pattern:** AreaModel, ArrayGrid, FunctionMachine, MeasurementTools, FactorTree, CoordinateGraph, SlopeTriangle, SystemsEquations, DotPlot, Histogram, TwoWayTable

#### SKIP — Display-only, no eval modes needed

The primitive is purely visual with no interactive challenge or scorable task. Adding eval modes would require inventing interaction from scratch, which is a new primitive, not an eval mode addition.

**Primitives:** BarModel (display-only — renders bars from values, no interactive challenge)

---

### Audit Results & Per-Primitive Implementation Guide

Each entry below includes the audit findings and proposed eval modes.

#### 23. PlaceValueChart — Pattern B (PHASE-CONVERT)
- **File:** `gemini-place-value.ts`
- **Current schema:** Single object with `targetNumber`, `highlightedDigitPlace`, `placeNameChoices[]`, `digitValueChoices[]`, `showExpandedForm`, `showMultipliers`
- **Current structure:** 3-phase flow (Phase 1: Identify the Place via MC → Phase 2: Find the Value via MC → Phase 3: Build the Number interactively)
- **Existing differentiation:** None — phases are hardcoded in data layout
- **Conversion:** Add `challengeType: 'identify' | 'build' | 'compare' | 'expanded_form'` to schema. When eval mode active, generator produces only the matching phase's data. `compare` and `expanded_form` are new task types requiring component additions.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Read digit value from chart |
| `build` | 2.5 | 2 | `['build']` | Place digits to form number |
| `compare` | 3.5 | 3 | `['compare']` | Compare numbers using place value |
| `expanded_form` | 5.0 | 4 | `['expanded_form']` | Write expanded notation |

#### 24. FractionBar — Pattern B (PHASE-CONVERT)
- **File:** `gemini-fraction-bar.ts`
- **Current schema:** Single object with `numerator`, `denominator`, `numeratorChoices[]`, `denominatorChoices[]`, `showDecimal`
- **Current structure:** 3-phase flow (Phase 1: Identify Numerator via MC → Phase 2: Identify Denominator via MC → Phase 3: Build the Fraction interactively)
- **Existing differentiation:** None
- **Conversion:** Add `challengeType: 'identify' | 'build' | 'compare' | 'add_subtract'`. Current phases map to `identify` + `build`. `compare` and `add_subtract` are new task types.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name fraction shown on bar |
| `build` | 2.5 | 2 | `['build']` | Shade bar to show fraction |
| `compare` | 3.5 | 3 | `['compare']` | Compare fractions on bars |
| `add_subtract` | 5.0 | 4 | `['add_subtract']` | Operations with fraction bars |

#### 25. PercentBar — Pattern A (ADAPT)
- **File:** `gemini-percent-bar.ts`
- **Current schema:** Nested structure with `exploreQuestion`, `practiceQuestions[]`, `mainQuestion`. Each has `context.problemType: 'addition' | 'subtraction' | 'direct' | 'comparison'`
- **Current structure:** 3-phase flow (Explore → Practice → Apply)
- **Existing differentiation:** `problemType` enum in context objects distinguishes problem categories
- **Conversion:** Map `problemType` values to eval mode challenge types. May need to restructure from phase-based to type-based, but the differentiation axis already exists.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify_percent` | 2.5 | 2 | `['direct']` | Read percentage from bar |
| `find_part` | 3.5 | 3 | `['subtraction']` | Calculate part given whole + % |
| `find_whole` | 5.0 | 4 | `['addition']` | Calculate whole given part + % |
| `convert` | 6.5 | 5 | `['comparison']` | Convert between %, fraction, decimal |

#### 26. RegroupingWorkbench — Pattern A (ADAPT)
- **File:** `gemini-regrouping-workbench.ts`
- **Current schema:** Has `challenges[]` array with `type: 'carry' | 'borrow'`, plus `requiresRegrouping: boolean` and `regroupCount: number`
- **Current structure:** Progressive challenges array (3-5 items)
- **Existing differentiation:** `type` field + `requiresRegrouping` flag = 4 distinct difficulty combinations
- **Conversion:** Expand `type` enum to 4 values: `add_no_regroup`, `add_regroup`, `subtract_no_regroup`, `subtract_regroup`. The `requiresRegrouping` boolean becomes implicit in the type.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `add_no_regroup` | 1.5 | 1 | `['add_no_regroup']` | Add without carrying |
| `subtract_no_regroup` | 2.5 | 2 | `['subtract_no_regroup']` | Subtract without borrowing |
| `add_regroup` | 3.5 | 3 | `['add_regroup']` | Add with carrying |
| `subtract_regroup` | 5.0 | 4 | `['subtract_regroup']` | Subtract with borrowing |

#### 27. AreaModel — Pattern C (SINGLE-VIZ)
- **File:** `gemini-area-model.ts`
- **Current schema:** Single object with `factor1Parts[]`, `factor2Parts[]`, `algebraicMode: boolean`, `highlightCell`, `labels`, `showAnimation`
- **Current structure:** Single visualization — one area model grid
- **Existing differentiation:** `algebraicMode` boolean only
- **Conversion:** Add `challengeType` enum. Design progression from building the model → computing area → using for multiplication → factoring.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `build_model` | 1.5 | 1 | `['build_model']` | Construct area model from factors |
| `find_area` | 2.5 | 2 | `['find_area']` | Calculate partial products and total |
| `multiply` | 3.5 | 3 | `['multiply']` | Multi-digit multiplication via model |
| `factor` | 5.0 | 4 | `['factor']` | Reverse: find factors from area |

#### 28. ArrayGrid — Pattern C (SINGLE-VIZ)
- **File:** `gemini-array-grid.ts`
- **Current schema:** Single object with `targetRows`, `targetColumns`, `iconType: 'dot' | 'square' | 'star'`, `showLabels`, `maxRows`, `maxColumns`
- **Current structure:** Single task — build array with specific dimensions
- **Existing differentiation:** `iconType` is visual variety only
- **Conversion:** Add `challengeType` enum for progression from building → counting → connecting to multiplication.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `build_array` | 1.5 | 1 | `['build_array']` | Build array with given dimensions |
| `count_array` | 2.5 | 2 | `['count_array']` | Count total from displayed array |
| `multiply_array` | 3.5 | 3 | `['multiply_array']` | Write multiplication sentence |

#### 29. BarModel — SKIP
- **File:** `gemini-bar-model.ts`
- **Current schema:** Simple structure with `title`, `description`, `values[]` (each has `label`, `value`, optional `color`)
- **Current structure:** Display-only — renders proportional bars from values
- **Existing differentiation:** None
- **Recommendation:** **Skip eval modes.** This is a visualization primitive, not an interactive challenge. No scorable task exists. If word problem solving is needed, use TapeDiagram instead.

#### 30. TapeDiagram — Pattern B (PHASE-CONVERT)
- **File:** `gemini-tape-diagram.ts`
- **Current schema:** Fixed 4-part structure with `knownPart1Value/Label`, `knownPart2Value/Label`, `unknown1Value/Label`, `unknown2Value/Label`
- **Current structure:** 3-phase flow (Phase 1: find total from known parts → Phase 2: find unknown given one known → Phase 3: find both unknowns)
- **Existing differentiation:** `isUnknown` boolean flags on segments for progressive revelation
- **Conversion:** Add `challengeType: 'represent' | 'solve_part_whole' | 'solve_comparison' | 'multi_step'`. Phase structure maps to first two types; `solve_comparison` and `multi_step` require new layout variants.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `represent` | 1.5 | 1 | `['represent']` | Build tape diagram from word problem |
| `solve_part_whole` | 2.5 | 2 | `['solve_part_whole']` | Solve part-whole with diagram |
| `solve_comparison` | 3.5 | 3 | `['solve_comparison']` | Solve comparison problem |
| `multi_step` | 5.0 | 4 | `['multi_step']` | Multi-step word problem |

#### 31. FunctionMachine — Pattern C (SINGLE-VIZ)
- **File:** `gemini-function-machine.ts`
- **Current schema:** Single object with `rule`, `showRule: boolean`, `inputQueue[]`, `ruleComplexity: 'oneStep' | 'twoStep' | 'expression'`, optional `chainedMachines[]`
- **Current structure:** Single visualization — one function machine with input/output queue
- **Existing differentiation:** `ruleComplexity` is config metadata, not a challenge type. `showRule` toggles visibility but isn't an enum.
- **Conversion:** Add `challengeType` enum. Design progression from observing → predicting → discovering → creating rules.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `observe` | 1.5 | 1 | `['observe']` | Watch input → output with rule visible |
| `predict` | 2.5 | 2 | `['predict']` | Predict output for new input |
| `discover_rule` | 5.0 | 4 | `['discover_rule']` | Identify the function rule |
| `create_rule` | 6.5 | 5 | `['create_rule']` | Write rule for given I/O pairs |

#### 32. MeasurementTools — Pattern C (SINGLE-VIZ)
- **File:** `gemini-measurement-tools.ts`
- **Current schema:** Single object with `shapes[]` array (each shape has `type: 'rectangle' | 'square'` and `widthInches`)
- **Current structure:** Single visualization — 3-5 shapes measured on one ruler
- **Existing differentiation:** Shape `type` is visual variety, not challenge type
- **Conversion:** Add `challengeType` enum for progression from estimation → direct measurement → conversion → comparison.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `estimate` | 1.5 | 1 | `['estimate']` | Estimate measurement before measuring |
| `measure` | 2.5 | 2 | `['measure']` | Measure with ruler/tool |
| `convert` | 5.0 | 4 | `['convert']` | Convert between units |
| `compare` | 3.5 | 3 | `['compare']` | Compare measurements of objects |

#### 33. FactorTree — Pattern C (SINGLE-VIZ)
- **File:** `gemini-factor-tree.ts`
- **Current schema:** Single object with `rootValue`, `highlightPrimes: boolean`, `showExponentForm: boolean`, `guidedMode: boolean`
- **Current structure:** Single visualization — one composite number to factor interactively
- **Existing differentiation:** `guidedMode` flag only
- **Conversion:** Add `challengeType` enum for progression from finding factors → prime factorization → GCF → LCM.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `find_factors` | 2.5 | 2 | `['find_factors']` | Find all factor pairs |
| `prime_factorize` | 3.5 | 3 | `['prime_factorize']` | Build complete factor tree |
| `gcf` | 5.0 | 4 | `['gcf']` | Find GCF via factor trees |
| `lcm` | 6.5 | 5 | `['lcm']` | Find LCM via prime factorization |

#### 34. CoordinateGraph — Pattern C (SINGLE-VIZ)
- **File:** `gemini-coordinate-graph.ts`
- **Current schema:** Single object with `plotMode: 'points' | 'freehand' | 'equation'`, `equations[]`, `points[]`, `lines[]`, `regions[]`
- **Current structure:** Single visualization — one graph with static equations/points/lines
- **Existing differentiation:** `plotMode` is interaction style, not challenge type
- **Conversion:** Add `challengeType` enum for progression from reading → plotting → line drawing → equation identification.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `read_point` | 2.5 | 2 | `['read_point']` | Read coordinates from graph |
| `plot_point` | 3.5 | 3 | `['plot_point']` | Plot given coordinates |
| `draw_line` | 5.0 | 4 | `['draw_line']` | Draw line from equation or points |
| `identify_equation` | 6.5 | 5 | `['identify_equation']` | Write equation from graph |

#### 35. SlopeTriangle — Pattern C (SINGLE-VIZ)
- **File:** `gemini-slope-triangle.ts`
- **Current schema:** Single object with `attachedLine` (equation), `triangles[]` (configuration for each triangle)
- **Current structure:** Single visualization — one line with 1-3 pre-positioned slope triangles
- **Existing differentiation:** Triangles are size/position variants of same task
- **Conversion:** Add `challengeType` enum for progression from identifying → measuring → calculating slope.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify_slope` | 3.5 | 3 | `['identify_slope']` | Identify rise and run from triangle |
| `calculate` | 5.0 | 4 | `['calculate']` | Calculate slope as ratio |
| `draw_triangle` | 6.5 | 5 | `['draw_triangle']` | Construct triangle on given line |

#### 36. SystemsEquations — Pattern C (SINGLE-VIZ)
- **File:** `gemini-systems-equations.ts`
- **Current schema:** Single object with `equations[]`, `solutionMethod: 'graphing' | 'substitution' | 'elimination'`, `systemType: 'one-solution' | 'no-solution' | 'infinite-solutions'`, `algebraicSteps[]`
- **Current structure:** Single visualization — one system with graph + algebraic steps
- **Existing differentiation:** `solutionMethod` is config, `systemType` is classification metadata
- **Conversion:** Use `solutionMethod` as challenge type axis. Each method represents increasing procedural complexity.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `graph` | 3.5 | 3 | `['graph']` | Solve by graphing intersection |
| `substitution` | 5.0 | 4 | `['substitution']` | Solve algebraically via substitution |
| `elimination` | 6.5 | 5 | `['elimination']` | Solve via elimination method |

#### 37. Matrix — Pattern A (ADAPT)
- **File:** `gemini-matrix.ts`
- **Current schema:** Single object with `values[][]`, optional `secondMatrix`, `operationType: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply'`
- **Current structure:** Single visualization — one matrix (or pair) with operation visualization
- **Existing differentiation:** `operationType` enum already encodes meaningful difficulty progression
- **Conversion:** Group `operationType` values into eval modes by cognitive complexity. Minimal schema changes needed.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `transpose` | 2.5 | 2 | `['transpose']` | Reflect across diagonal |
| `add_subtract` | 3.5 | 3 | `['add', 'subtract']` | Element-wise operations |
| `multiply` | 5.0 | 4 | `['multiply']` | Matrix multiplication |
| `determinant_inverse` | 6.5 | 5 | `['determinant', 'inverse']` | Advanced operations |

#### 38. DotPlot — Pattern C (SINGLE-VIZ)
- **File:** `gemini-dot-plot.ts`
- **Current schema:** Single object with `dataPoints[]`, optional `secondaryDataPoints[]`, `stackStyle: 'dots' | 'x' | 'icons'`, `showStatistics: boolean`, `editable: boolean`
- **Current structure:** Single visualization — one dot plot with optional comparison dataset
- **Existing differentiation:** `stackStyle` is visual, `showStatistics` is feature toggle
- **Conversion:** Add `challengeType` enum for progression from reading → statistical analysis → comparison.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `read_data` | 1.5 | 1 | `['read_data']` | Read frequencies from plot |
| `analyze` | 3.5 | 3 | `['analyze']` | Calculate mean/median/mode |
| `compare_sets` | 5.0 | 4 | `['compare_sets']` | Compare two datasets |

#### 39. Histogram — Pattern C (SINGLE-VIZ)
- **File:** `gemini-histogram.ts`
- **Current schema:** Single object with `data[]`, `binWidth`, `binStart`, `showFrequency: boolean`, `showCurve: boolean`, `editable: boolean`
- **Current structure:** Single visualization — one histogram with optional curve overlay
- **Existing differentiation:** Feature toggles only
- **Conversion:** Add `challengeType` enum for progression from reading → shape description → distribution analysis.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `read_data` | 1.5 | 1 | `['read_data']` | Read bin frequencies |
| `describe_shape` | 3.5 | 3 | `['describe_shape']` | Describe distribution shape |
| `analyze` | 5.0 | 4 | `['analyze']` | Analyze outliers, tail behavior |

#### 40. DoubleNumberLine — Pattern B (PHASE-CONVERT)
- **File:** `gemini-double-number-line.ts`
- **Current schema:** Single object with `givenPoints[]`, `targetPoints[]`, `unitRateInput`, `unitRateOutput`
- **Current structure:** Already 3-phase (Phase 1: unit rate discovery → Phase 2: practice scaling → Phase 3: apply to remaining points). Phases implicit via `targetPoints` labels.
- **Existing differentiation:** Implicit phase progression via point ordering — closest to eval-ready in this tier
- **Conversion:** Add explicit `challengeType` enum formalizing existing phases. Minimal refactoring.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `equivalent_ratios` | 2.5 | 2 | `['equivalent_ratios']` | Find equivalent ratios on lines |
| `find_missing` | 3.5 | 3 | `['find_missing']` | Find missing value given ratio |
| `unit_rate` | 5.0 | 4 | `['unit_rate']` | Reduce to unit rate |

#### 41. TwoWayTable — Pattern C (SINGLE-VIZ)
- **File:** `gemini-two-way-table.ts`
- **Current schema:** Single object with `frequencies[][]`, `rowCategories[]`, `columnCategories[]`, `displayMode: 'table' | 'venn' | 'both'`, `showTotals: boolean`, `showProbabilities: boolean`
- **Current structure:** Single visualization — one table with optional Venn diagram view
- **Existing differentiation:** `displayMode` and feature toggles only
- **Conversion:** Add `challengeType` enum for progression from reading → joint probability → conditional probability.

| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `read_data` | 2.5 | 2 | `['read_data']` | Read individual cells and totals |
| `fill_missing` | 3.5 | 3 | `['fill_missing']` | Complete missing table entries |
| `calculate_probability` | 5.0 | 4 | `['calculate_probability']` | Calculate joint/conditional probability |

---

## Rollout Plan

### Waves 1 & 2 — DONE

All 19 READY primitives (Tier B + C) have been completed with eval modes.

### Wave 3 — Schema Work Required (18 primitives + 1 SKIP)

Prioritized by conversion pattern (quick wins first), then by student impact.

#### Wave 3a — ADAPT Pattern (est. 20 min each)

Primitives with existing enum fields that can serve as challenge types. Lowest risk.

| Order | Primitive | Pattern | Modes | Current Enum | Why First |
|-------|-----------|---------|-------|--------------|-----------|
| 23 | RegroupingWorkbench | A | 4 | `type: carry/borrow` + `requiresRegrouping` | Core K-2 arithmetic, has `challenges[]` already |
| 24 | Matrix | A | 4 | `operationType` enum (6 values) | Direct enum → eval mode mapping |
| 25 | PercentBar | A | 4 | `problemType` context enum | Has type differentiation in context objects |

#### Wave 3b — PHASE-CONVERT Pattern (est. 30-40 min each)

Phase-based primitives that need type enum to replace fixed phase sequence. Medium effort.

| Order | Primitive | Pattern | Modes | Current Phases | Why |
|-------|-----------|---------|-------|---------------|-----|
| 26 | DoubleNumberLine | B | 3 | 3-phase (implicit in targetPoints) | Closest to ready — phases already exist |
| 27 | PlaceValueChart | B | 4 | 3-phase (identify → value → build) | Core K-2, high curriculum coverage |
| 28 | FractionBar | B | 4 | 3-phase (numerator → denominator → build) | Complements FractionCircles |
| 29 | TapeDiagram | B | 4 | 3-phase (4 parts, progressive reveal) | Word problem representation |

#### Wave 3c — SINGLE-VIZ Pattern, High Priority (est. 45-60 min each)

Single-visualization primitives with high student impact. Require new challenge type design.

| Order | Primitive | Pattern | Modes | Why |
|-------|-----------|---------|-------|-----|
| 30 | FunctionMachine | C | 4 | Core algebra readiness, `ruleComplexity` provides structure |
| 31 | AreaModel | C | 4 | Multiplication visualization, grades 3-5 |
| 32 | ArrayGrid | C | 3 | Multiplication foundation, simpler schema |
| 33 | MeasurementTools | C | 4 | Practical math, grades 1-4 |

#### Wave 3d — SINGLE-VIZ Pattern, Medium/Lower Priority (est. 45-60 min each)

Upper-grade and specialized primitives. Lower urgency.

| Order | Primitive | Pattern | Modes | Why |
|-------|-----------|---------|-------|-----|
| 34 | FactorTree | C | 4 | Narrower curriculum use (grades 4-6) |
| 35 | CoordinateGraph | C | 4 | Upper grades (5+) |
| 36 | DotPlot | C | 3 | Data/stats strand |
| 37 | Histogram | C | 3 | Data/stats strand |
| 38 | SlopeTriangle | C | 3 | Algebra (grade 7+) |
| 39 | SystemsEquations | C | 3 | Algebra 2 (grade 8+) |
| 40 | TwoWayTable | C | 3 | Data/stats (grade 6+) |

#### SKIP

| Primitive | Reason |
|-----------|--------|
| BarModel | Display-only visualization with no interactive challenge or scorable task. Use TapeDiagram for word problem eval modes instead. |

---

## Progress Tracker

| # | Primitive | Status | Pattern | Modes | Wave | Completed |
|---|-----------|--------|---------|-------|------|-----------|
| 1 | TenFrame | DONE | — | 4 | — | Yes |
| 2 | CountingBoard | DONE | — | 5 | — | Yes |
| 3 | BaseTenBlocks | DONE | — | 4 | — | Yes |
| 4 | NumberLine | DONE | — | 4 | 1 | Yes |
| 5 | FractionCircles | DONE | — | 4 | 1 | Yes |
| 6 | NumberBond | DONE | — | 4 | 1 | Yes |
| 7 | PatternBuilder | DONE | — | 5 | 1 | Yes |
| 8 | ComparisonBuilder | DONE | — | 4 | 1 | Yes |
| 9 | AdditionSubtractionScene | DONE | — | 4 | 1 | Yes |
| 10 | BalanceScale | DONE | — | 3 | 1 | Yes |
| 11 | OrdinalLine | DONE | — | 5 | 1 | Yes |
| 12 | ShapeSorter | DONE | — | 3 | 1 | Yes |
| 13 | MathFactFluency | DONE | — | 5 | 2 | Yes |
| 14 | MultiplicationExplorer | DONE | — | 6 | 2 | Yes |
| 15 | SkipCountingRunner | DONE | — | 5 | 2 | Yes |
| 16 | NumberSequencer | DONE | — | 5 | 2 | Yes |
| 17 | ShapeBuilder | DONE | — | 6 | 2 | Yes |
| 18 | ShapeTracer | DONE | — | 4 | 2 | Yes |
| 19 | SortingStation | DONE | — | 6 | 2 | Yes |
| 20 | 3DShapeExplorer | DONE | — | 5 | 2 | Yes |
| 21 | StrategyPicker | DONE | — | 5 | 2 | Yes |
| 22 | RatioTable | DONE | — | 4 | 2 | Yes |
| 23 | RegroupingWorkbench | DONE | A | 4 | 3a | Yes |
| 24 | Matrix | DONE | A | 4 | 3a | Yes |
| 25 | PercentBar | DONE | A | 4 | 3a | Yes |
| 26 | DoubleNumberLine | DONE | B | 3 | 3b | Yes |
| 27 | PlaceValueChart | DONE | B | 4 | 3b | Yes |
| 28 | FractionBar | DONE | B | 4 | 3b | Yes |
| 29 | TapeDiagram | DONE | B | 4 | 3b | Yes |
| 30 | FunctionMachine | DONE | C | 4 | 3c | Yes |
| 31 | AreaModel | DONE | C | 4 | 3c | Yes |
| 32 | ArrayGrid | DONE | C | 3 | 3c | Yes |
| 33 | MeasurementTools | DONE | C | 4 | 3c | Yes |
| 34 | FactorTree | NEEDS TYPES | C | 4 | 3d | |
| 35 | CoordinateGraph | NEEDS TYPES | C | 4 | 3d | |
| 36 | DotPlot | NEEDS TYPES | C | 3 | 3d | |
| 37 | Histogram | NEEDS TYPES | C | 3 | 3d | |
| 38 | SlopeTriangle | NEEDS TYPES | C | 3 | 3d | |
| 39 | SystemsEquations | NEEDS TYPES | C | 3 | 3d | |
| 40 | TwoWayTable | NEEDS TYPES | C | 3 | 3d | |
| 41 | BarModel | SKIP | — | 0 | — | N/A |

---

## Totals

| Category | Count | Eval Modes | Est. Time |
|----------|-------|------------|-----------|
| DONE (Waves 1-2) | 22 | 100 | — |
| Wave 3a (ADAPT) | 3 | 12 | ~1 hr |
| Wave 3b (PHASE-CONVERT) | 4 | 15 | ~2-3 hrs |
| Wave 3c (SINGLE-VIZ, high priority) | 4 | 15 | ~3-4 hrs |
| Wave 3d (SINGLE-VIZ, lower priority) | 7 | 23 | ~5-7 hrs |
| SKIP | 1 | 0 | — |
| **Total** | **41** | **165** | — |

---

## Usage

To apply eval modes to a READY primitive:

```
/add-eval-modes [primitive-name]
```

The skill reads this PRD for the mode definitions, then updates:
1. Catalog entry (`catalog/math.ts`) — adds `evalModes` array
2. Generator (`gemini-[name].ts`) — adds `CHALLENGE_TYPE_DOCS` + constraint wiring
3. Generator registry (`mathGenerators.ts`) — ensures `...item.config` spread

For Wave 3 primitives, the workflow depends on the conversion pattern:

### Pattern A (ADAPT) workflow
1. Identify existing enum field in schema
2. Map enum values to eval mode challenge types
3. Run `/add-eval-modes` — the skill handles catalog + generator wiring
4. Verify component renders correctly per type

### Pattern B (PHASE-CONVERT) workflow
1. Add `challengeType` enum to schema
2. Update generator to produce only the matching phase's data when eval mode active
3. Update component to conditionally render per challenge type
4. Run `/add-eval-modes` for catalog + generator wiring
5. Test both eval-mode and no-eval-mode paths

### Pattern C (SINGLE-VIZ) workflow
1. Design challenge types (use this PRD's proposed types as starting point)
2. Add `challengeType` enum + restructure schema (may need `challenges[]` array)
3. Update generator prompt for type-specific content generation
4. Update component to branch rendering/interaction per challenge type
5. Run `/add-eval-modes` for catalog + generator wiring
6. Test all modes + backward compatibility
