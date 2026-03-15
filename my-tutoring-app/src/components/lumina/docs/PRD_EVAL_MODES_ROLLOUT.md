# PRD: Eval Modes Rollout — Math Primitives

**Status:** Draft
**Last Updated:** 2026-03-09
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
- **REVIEW** — Special case; may need architectural discussion

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

## Tier D: NEEDS TYPES — Require Challenge Type Enum First (16 primitives)

These primitives currently generate a single visualization or use phase-based flow without a `type` enum in their schema. Before eval modes can be added, each needs:
1. Challenge type enum added to its Gemini schema
2. `CHALLENGE_TYPE_DOCS` record created
3. Component updated to handle different types

This is a **larger lift** — estimate ~30-45 min per primitive (vs ~10 min for READY primitives).

### Proposed Challenge Types

| # | Primitive | File | Proposed Types | Notes |
|---|-----------|------|----------------|-------|
| 23 | **PlaceValueChart** | `gemini-place-value.ts` | `identify`, `build`, `compare`, `expanded_form` | Currently 3-phase; convert to typed challenges |
| 24 | **FractionBar** | `gemini-fraction-bar.ts` | `identify`, `build`, `compare`, `add_subtract` | Currently 3-phase flow |
| 25 | **PercentBar** | `gemini-percent-bar.ts` | `identify_percent`, `find_part`, `find_whole`, `convert` | Currently 3-phase flow |
| 26 | **RegroupingWorkbench** | `gemini-regrouping-workbench.ts` | `add_no_regroup`, `add_regroup`, `subtract_no_regroup`, `subtract_regroup` | Has validation types but no schema enum |
| 27 | **AreaModel** | `gemini-area-model.ts` | `build_model`, `find_area`, `multiply`, `factor` | Single visualization |
| 28 | **ArrayGrid** | `gemini-array-grid.ts` | `build_array`, `count_array`, `multiply_array` | Single task |
| 29 | **BarModel** | `gemini-bar-model.ts` | `represent`, `solve_addition`, `solve_comparison`, `multi_step` | Single visualization |
| 30 | **TapeDiagram** | `gemini-tape-diagram.ts` | `represent`, `solve_part_whole`, `solve_comparison`, `multi_step` | 3-phase problem |
| 31 | **FunctionMachine** | `gemini-function-machine.ts` | `observe`, `predict`, `discover_rule`, `create_rule` | Phase-based, high priority |
| 32 | **MeasurementTools** | `gemini-measurement-tools.ts` | `estimate`, `measure`, `convert`, `compare` | Single measurement task |
| 33 | **FactorTree** | `gemini-factor-tree.ts` | `find_factors`, `prime_factorize`, `gcf`, `lcm` | Single visualization |
| 34 | **CoordinateGraph** | `gemini-coordinate-graph.ts` | `plot_point`, `read_point`, `draw_line`, `identify_equation` | Annotation types exist, not challenge types |
| 35 | **SlopeTriangle** | `gemini-slope-triangle.ts` | `identify_slope`, `calculate`, `draw_triangle` | Visualization-only |
| 36 | **SystemsEquations** | `gemini-systems-equations.ts` | `graph`, `substitution`, `elimination` | Visualization-only |
| 37 | **Matrix** | `gemini-matrix.ts` | Has operation types: `add`, `subtract`, `multiply`, `determinant`, `inverse`, `transpose` | Already has types as operations — can adapt |
| 38 | **DotPlot** | `gemini-dot-plot.ts` | `read_data`, `create_plot`, `compare_sets`, `analyze` | Data visualization |
| 39 | **Histogram** | `gemini-histogram.ts` | `read_data`, `create_histogram`, `compare`, `analyze` | Data visualization |
| 40 | **DoubleNumberLine** | `gemini-double-number-line.ts` | `equivalent_ratios`, `find_missing`, `unit_rate` | Visualization |
| 41 | **TwoWayTable** | `gemini-two-way-table.ts` | `read_data`, `fill_missing`, `calculate_probability` | Exploration mode |

### Proposed β Assignments for Tier D (when types are added)

**PlaceValueChart:**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Read digit value from chart |
| `build` | 2.5 | 2 | `['build']` | Place digits to form number |
| `compare` | 3.5 | 3 | `['compare']` | Compare numbers using place value |
| `expanded_form` | 5.0 | 4 | `['expanded_form']` | Write expanded notation |

**FractionBar:**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify` | 1.5 | 1 | `['identify']` | Name fraction shown on bar |
| `build` | 2.5 | 2 | `['build']` | Shade bar to show fraction |
| `compare` | 3.5 | 3 | `['compare']` | Compare fractions on bars |
| `add_subtract` | 5.0 | 4 | `['add_subtract']` | Operations with fraction bars |

**PercentBar:**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `identify_percent` | 2.5 | 2 | `['identify_percent']` | Read percentage from bar |
| `find_part` | 3.5 | 3 | `['find_part']` | Calculate part given whole + % |
| `find_whole` | 5.0 | 4 | `['find_whole']` | Calculate whole given part + % |
| `convert` | 6.5 | 5 | `['convert']` | Convert between %, fraction, decimal |

**RegroupingWorkbench:**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `add_no_regroup` | 1.5 | 1 | `['add_no_regroup']` | Add without carrying |
| `add_regroup` | 3.5 | 3 | `['add_regroup']` | Add with carrying |
| `subtract_no_regroup` | 2.5 | 2 | `['subtract_no_regroup']` | Subtract without borrowing |
| `subtract_regroup` | 5.0 | 4 | `['subtract_regroup']` | Subtract with borrowing |

**FunctionMachine:**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `observe` | 1.5 | 1 | `['observe']` | Watch input → output |
| `predict` | 2.5 | 2 | `['predict']` | Predict output for new input |
| `discover_rule` | 5.0 | 4 | `['discover_rule']` | Identify the function rule |
| `create_rule` | 6.5 | 5 | `['create_rule']` | Write rule for given I/O pairs |

**Matrix (adapt existing operation types):**
| Mode | β | Scaffold | Types | Description |
|------|---|----------|-------|-------------|
| `transpose` | 2.5 | 2 | `['transpose']` | Reflect across diagonal |
| `add_subtract` | 3.5 | 3 | `['add', 'subtract']` | Element-wise operations |
| `multiply` | 5.0 | 4 | `['multiply']` | Matrix multiplication |
| `determinant_inverse` | 6.5 | 5 | `['determinant', 'inverse']` | Advanced operations |

---

## Rollout Plan

### Wave 1 — Quick Wins (est. 10 min each with `/add-eval-modes`)

Run the skill on each. No schema changes needed.

| Order | Primitive | Modes | Why First |
|-------|-----------|-------|-----------|
| 1 | NumberLine | 4 | Highest-use K-5 primitive after TenFrame |
| 2 | FractionCircles | 4 | Core fractions, high curriculum coverage |
| 3 | NumberBond | 4 | Foundational part-whole reasoning |
| 4 | PatternBuilder | 5 | Already has `supportsEvaluation` |
| 5 | ComparisonBuilder | 4 | Core K-1 comparison |
| 6 | AdditionSubtractionScene | 4 | Primary operations primitive |
| 7 | BalanceScale | 3 | Equations foundation |
| 8 | OrdinalLine | 5 | Sequence reasoning |
| 9 | ShapeSorter | 3 | Geometry foundation |

### Wave 2 — Grade 2-5 Expansion

| Order | Primitive | Modes | Why |
|-------|-----------|-------|-----|
| 10 | MathFactFluency | 5 | Fluency assessment critical for IRT |
| 11 | MultiplicationExplorer | 6 | Full scaffolding spectrum |
| 12 | SkipCountingRunner | 5 | Multiplication readiness |
| 13 | NumberSequencer | 5 | Number sense progression |
| 14 | ShapeBuilder | 6 | Full geometry spectrum |
| 15 | ShapeTracer | 4 | Motor + spatial skills |
| 16 | SortingStation | 6 | Data & classification |
| 17 | 3DShapeExplorer | 5 | 3D geometry |
| 18 | StrategyPicker | 5 | Metacognitive assessment |
| 19 | RatioTable | 4 | Proportional reasoning |

### Wave 3 — Schema Work Required

Requires adding challenge type enums before eval modes. Prioritize by student impact.

| Priority | Primitive | Est. Effort | Why |
|----------|-----------|-------------|-----|
| High | FunctionMachine | 30 min | Phase-based → type-based conversion |
| High | PlaceValueChart | 30 min | Core K-2, 3-phase → typed |
| High | RegroupingWorkbench | 30 min | Core arithmetic |
| High | FractionBar | 30 min | Complements FractionCircles |
| Medium | BarModel | 30 min | Word problem representation |
| Medium | TapeDiagram | 30 min | Similar to BarModel |
| Medium | AreaModel | 30 min | Multiplication visual |
| Medium | MeasurementTools | 30 min | Practical math |
| Medium | PercentBar | 30 min | Upper elementary |
| Medium | ArrayGrid | 20 min | Simpler schema |
| Lower | FactorTree | 30 min | Narrower curriculum use |
| Lower | Matrix | 20 min | Already has operation types (adapt) |
| Lower | CoordinateGraph | 30 min | Upper grades |
| Lower | SlopeTriangle | 20 min | Algebra |
| Lower | SystemsEquations | 20 min | Algebra 2 |
| Lower | DotPlot | 30 min | Data/stats |
| Lower | Histogram | 30 min | Data/stats |
| Lower | DoubleNumberLine | 20 min | Ratios |
| Lower | TwoWayTable | 20 min | Data/stats |

---

## Progress Tracker

| # | Primitive | Status | Modes | Wave | Completed |
|---|-----------|--------|-------|------|-----------|
| 1 | TenFrame | DONE | 4 | — | Yes |
| 2 | CountingBoard | DONE | 5 | — | Yes |
| 3 | BaseTenBlocks | DONE | 4 | — | Yes |
| 4 | NumberLine | DONE | 4 | 1 | Yes |
| 5 | FractionCircles | DONE | 4 | 1 | Yes |
| 6 | NumberBond | DONE | 4 | 1 | Yes |
| 7 | PatternBuilder | DONE | 5 | 1 | Yes |
| 8 | ComparisonBuilder | DONE | 4 | 1 | Yes |
| 9 | AdditionSubtractionScene | DONE | 4 | 1 | Yes |
| 10 | BalanceScale | DONE | 3 | 1 | Yes |
| 11 | OrdinalLine | DONE | 5 | 1 | Yes |
| 12 | ShapeSorter | DONE | 3 | 1 | Yes |
| 13 | MathFactFluency | DONE | 5 | 2 | Yes |
| 14 | MultiplicationExplorer | DONE | 6 | 2 | Yes |
| 15 | SkipCountingRunner | DONE | 5 | 2 | Yes |
| 16 | NumberSequencer | DONE | 5 | 2 | Yes |
| 17 | ShapeBuilder | DONE | 6 | 2 | Yes |
| 18 | ShapeTracer | DONE | 4 | 2 | Yes |
| 19 | SortingStation | DONE | 6 | 2 | Yes |
| 20 | 3DShapeExplorer | DONE | 5 | 2 | Yes |
| 21 | StrategyPicker | DONE | 5 | 2 | Yes |
| 22 | RatioTable | DONE | 4 | 2 | Yes |
| 23 | PlaceValueChart | NEEDS TYPES | 4 | 3 | |
| 24 | FractionBar | NEEDS TYPES | 4 | 3 | |
| 25 | PercentBar | NEEDS TYPES | 4 | 3 | |
| 26 | RegroupingWorkbench | NEEDS TYPES | 4 | 3 | |
| 27 | AreaModel | NEEDS TYPES | 4 | 3 | |
| 28 | ArrayGrid | NEEDS TYPES | 3 | 3 | |
| 29 | BarModel | NEEDS TYPES | 4 | 3 | |
| 30 | TapeDiagram | NEEDS TYPES | 4 | 3 | |
| 31 | FunctionMachine | NEEDS TYPES | 4 | 3 | |
| 32 | MeasurementTools | NEEDS TYPES | 4 | 3 | |
| 33 | FactorTree | NEEDS TYPES | 4 | 3 | |
| 34 | CoordinateGraph | NEEDS TYPES | 4 | 3 | |
| 35 | SlopeTriangle | NEEDS TYPES | 3 | 3 | |
| 36 | SystemsEquations | NEEDS TYPES | 3 | 3 | |
| 37 | Matrix | NEEDS TYPES | 4 | 3 | |
| 38 | DotPlot | NEEDS TYPES | 4 | 3 | |
| 39 | Histogram | NEEDS TYPES | 4 | 3 | |
| 40 | DoubleNumberLine | NEEDS TYPES | 3 | 3 | |
| 41 | TwoWayTable | NEEDS TYPES | 3 | 3 | |

---

## Totals

| Category | Count | Eval Modes | Est. Time |
|----------|-------|------------|-----------|
| DONE | 3 | 13 | — |
| Wave 1 (READY, K-2) | 9 | 36 | ~90 min |
| Wave 2 (READY, 2-5) | 10 | 51 | ~100 min |
| Wave 3 (NEEDS TYPES) | 19 | 70 | ~10-12 hrs |
| **Total** | **41** | **170** | — |

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

For NEEDS TYPES primitives, first add the challenge type enum to the schema manually, then run the skill.
