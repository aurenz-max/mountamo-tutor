# PRD: Eval Mode Enrichment — Curriculum-Level Eval Mode Assignment

**Status:** Draft
**Date:** 2026-03-31
**Depends on:** `target_primitive` field (already wired — see curriculum service changes from 2026-03-31)

---

## Problem

Today, eval mode selection happens at **session time** via `select_best_mode()` in the Pulse engine. This function picks the eval mode that maximizes Fisher information at the student's current theta — an IRT assessment optimization.

But this is wrong for subskill-specific practice. If a subskill says "subitize flash counts on a ten-frame," the eval mode is `subitize` — that's the pedagogical goal. Sending a student `operate` because their theta is 5.0 means they never practice subitizing. The difficulty should come from generator parameters (flash speed, quantity), not from switching to a harder eval mode.

Additionally, the Gemini manifest generator (Pass 1) has no knowledge of available eval modes per primitive. It picks a primitive but can't tell the content generator *how* to use it. The `intent` field is free-text — Gemini might say "have the student subitize" but the downstream generator has no structured signal.

## Solution

Add `target_eval_mode` as a **curriculum-level field** on every subskill, resolved at authoring time from the subskill description against the `PROBLEM_TYPE_REGISTRY` enum. This field flows through the same path as `target_primitive`:

```
Authoring → curriculum_published → graph flatten → Pulse node → manifest input → generator
            target_primitive ✓      primitive_type ✓   primitive_affinity ✓
            target_eval_mode ✓      eval_mode ✓        eval_mode_hint ✓
```

---

## Data Model Changes

### 1. Subskill Schema

Add `target_eval_mode: Optional[str]` alongside `target_primitive` in:

| File | Model/Dict | Field |
|------|-----------|-------|
| `curriculum-authoring-service/app/models/curriculum.py` | `Subskill` | `target_eval_mode: Optional[str] = None` |
| `curriculum-authoring-service/app/db/draft_curriculum_service.py` | subskill entry dicts | `target_eval_mode` |
| `curriculum-authoring-service/app/db/draft_curriculum_service.py` | `_rebuild_subskill_index()` | copy `target_eval_mode` to index |
| `curriculum-authoring-service/app/db/draft_curriculum_service.py` | `add_unit_with_content()` | copy `target_eval_mode` to index |
| `curriculum-authoring-service/app/db/draft_curriculum_service.py` | `add_subskill()` | copy `target_eval_mode` to entry + index |
| `backend/app/schemas/curriculum.py` | `CurriculumSubskill` | `target_eval_mode: Optional[str] = None` |
| `backend/app/schemas/curriculum.py` | `CurriculumItem` | `target_eval_mode: Optional[str] = None` |

Follow the exact same pattern used for `target_primitive` (conditional inclusion, `if ss.get("target_eval_mode")`).

### 2. Graph Flattening

In `curriculum-authoring-service/app/services/graph_flattening.py`, `_read_nodes_from_published()`:

```python
# Already added for target_primitive:
if tp:
    node["primitive_type"] = tp

# Add:
eval_mode = sub.get("target_eval_mode")
if eval_mode:
    node["eval_mode"] = eval_mode
```

### 3. Backend CurriculumService

In `backend/app/services/curriculum_service.py`:
- `_structure_firestore_curriculum()` — include `target_eval_mode` on subskill entries
- `_structure_curriculum_data()` — same for BigQuery path
- `get_subskill_metadata()` BQ fallback — include in returned dict

### 4. Backend Pulse Engine

In `backend/app/services/pulse_engine.py`, when building `PulseItemSpec`:

```python
# Current:
prim_type = node.get("primitive_type", "ten-frame")
_, beta, eval_mode = self.select_best_mode(theta, prim_type)

# New:
prim_type = node.get("primitive_type", "ten-frame")
curriculum_eval_mode = node.get("eval_mode")  # from curriculum
if curriculum_eval_mode:
    # Curriculum specifies the eval mode — use it directly
    modes = PROBLEM_TYPE_REGISTRY.get(prim_type, {})
    config = modes.get(curriculum_eval_mode)
    if config:
        beta = config.prior_beta
        eval_mode = curriculum_eval_mode
        mode = beta_to_mode(beta)  # reverse lookup for target_mode
    else:
        # Fallback if registry doesn't have this mode
        mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
else:
    # No curriculum constraint — IRT selection (assessment use case)
    mode, beta, eval_mode = self.select_best_mode(theta, prim_type)
```

### 5. Pulse Types (Frontend)

In `my-tutoring-app/src/components/lumina/pulse/types.ts`, add to `PulseItemSpec`:

```typescript
eval_mode_hint?: string;  // curriculum-assigned eval mode (e.g. 'subitize', 'plot')
```

### 6. Manifest Input

In `my-tutoring-app/src/components/lumina/service/manifest/practice-manifest.ts`:

Add `eval_mode_hint?: string` to `PulseManifestItemInput`.

In the prompt builder, add to the per-item spec:

```typescript
const evalModeLine = item.eval_mode_hint
  ? `\n- EVAL MODE: "${item.eval_mode_hint}" (curriculum-assigned — use this mode for the primitive)`
  : '';
```

### 7. PulseActivityRenderer

Pass `eval_mode_hint` through alongside `primitive_affinity`:

```typescript
eval_mode_hint: spec.eval_mode_hint,
```

---

## Authoring-Time Resolution

### New Subskills (during `/curriculum-author`)

When Gemini generates subskills, the `prd_context` must include the valid eval modes for each target primitive. The Gemini schema should include `target_eval_mode` as an enum field constrained to the primitive's valid modes.

Example `prd_context` addition:
```
Subskill a: Subitize dot patterns on ten-frame
  target_primitive: ten-frame
  target_eval_mode: must be one of [build, subitize, make_ten, operate]
  → Pick the mode that matches "subitize dot patterns" → "subitize"
```

### Existing Subskills (backfill)

A migration script or `/curriculum-lumina-audit` enhancement must:

1. For each published subject, iterate all subskills
2. For each subskill with a `target_primitive` that exists in `PROBLEM_TYPE_REGISTRY`:
   - Read the subskill description
   - Read the available eval modes for that primitive
   - Use an LLM call to match the description to the best eval mode
   - OR use keyword matching as a fast first pass (e.g., description contains "subitize" → mode = "subitize")
3. Write `target_eval_mode` onto the subskill
4. Republish

### Validation

After backfill, verify:
- Every subskill with a `target_primitive` in the registry also has a `target_eval_mode`
- The `target_eval_mode` is a valid key in `PROBLEM_TYPE_REGISTRY[target_primitive]`
- Subskills without a registry entry (display-only primitives, AI tutor sessions) have `target_eval_mode: null`

---

## Republish Scope

All published subjects must be updated. Based on the Firestore screenshot and PRD, the current published subjects are:

| Grade | Subject | Subject ID | Subskills |
|-------|---------|------------|-----------|
| 1 | Language Arts | LANGUAGE_ARTS_G1 | ~150 |
| 1 | Mathematics | MATHEMATICS_G1 | ~115 |
| 1 | Science | SCIENCE_G1 | ~119 |
| 1 | Social Studies | SOCIAL_STUDIES_G1 | ~112 |

**Total: ~496 subskills to backfill.**

### Republish Sequence

For each subject:
1. Backfill `target_eval_mode` on draft subskills
2. Verify all assignments (spot-check or full audit)
3. Publish: `POST /api/publishing/subjects/{subject_id}/publish`
4. Deploy: `POST /api/publishing/subjects/{subject_id}/deploy`
   - This auto-flattens the graph, so Pulse gets updated nodes immediately
5. Verify the flattened graph nodes now have `eval_mode` field

---

## PROBLEM_TYPE_REGISTRY — Full Reference

This is the complete eval mode inventory. Every `target_eval_mode` must be a key from this registry for the corresponding `target_primitive`.

### Math Primitives (38 primitives, 160 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **ten-frame** | `build` (1.5), `subitize` (2.5), `make_ten` (3.5), `operate` (5.0) |
| **number-line** | `plot` (1.5), `jump` (2.5), `order` (3.5), `between` (5.0) |
| **counting-board** | `count` (1.0), `group` (2.0), `compare` (2.5), `subitize` (2.0), `count_on` (2.5) |
| **pattern-builder** | `extend` (1.5), `identify_core` (2.5), `translate` (3.5), `create` (5.0), `find_rule` (6.5) |
| **function-machine** | `observe` (2.5), `predict` (3.0), `discover_rule` (3.5), `create_rule` (4.5) |
| **balance-scale** | `equality` (1.5), `one_step` (3.5), `two_step` (6.5) |
| **base-ten-blocks** | `build_number` (1.5), `read_blocks` (2.5), `regroup` (3.5), `operate` (5.0) |
| **fraction-circles** | `identify` (1.5), `build` (2.5), `compare` (3.5), `equivalent` (5.0) |
| **regrouping-workbench** | `add_no_regroup` (1.5), `subtract_no_regroup` (2.5), `add_regroup` (3.5), `subtract_regroup` (5.0) |
| **percent-bar** | `identify_percent` (2.5), `find_part` (3.5), `find_whole` (5.0), `convert` (6.5) |
| **fraction-bar** | `identify` (1.5), `build` (2.5), `compare` (3.5), `add_subtract` (5.0) |
| **measurement-tools** | `measure` (1.5), `compare` (3.0), `convert` (5.0) |
| **length-lab** | `compare` (1.5), `tile_and_count` (2.5), `order` (3.5), `indirect` (5.0) |
| **array-grid** | `build_array` (1.5), `count_array` (2.5), `multiply_array` (3.5) |
| **area-model** | `build_model` (1.5), `find_area` (2.5), `multiply` (3.5), `factor` (5.0) |
| **comparison-builder** | `compare_groups` (1.5), `one_more_less` (2.5), `compare_numbers` (3.5), `order` (5.0) |
| **place-value-chart** | `identify` (1.5), `build` (2.5), `compare` (3.5), `expanded_form` (5.0) |
| **skip-counting-runner** | `count_along` (1.5), `predict` (2.5), `fill_missing` (3.5), `find_skip_value` (5.0), `connect_multiplication` (6.5) |
| **number-sequencer** | `count_from` (1.5), `before_after` (2.5), `order_cards` (3.5), `fill_missing` (5.0), `decade_fill` (6.5) |
| **number-bond** | `decompose` (1.5), `missing_part` (2.5), `fact_family` (3.5), `build_equation` (5.0) |
| **addition-subtraction-scene** | `act_out` (1.5), `build_equation` (2.5), `solve_story` (3.5), `create_story` (5.0) |
| **multiplication-explorer** | `build` (1.5), `connect` (2.5), `commutative` (3.5), `distributive` (5.0), `missing_factor` (6.5), `fluency` (8.0) |
| **sorting-station** | `sort_one` (1.5), `sort_attribute` (2.5), `count_compare` (3.5), `odd_one_out` (4.0), `two_attributes` (5.0), `tally_record` (5.5) |
| **shape-sorter** | `identify` (1.5), `count` (2.5), `sort` (3.5) |
| **shape-builder** | `build` (1.5), `measure` (2.5), `classify` (3.5), `compose` (5.0), `find_symmetry` (6.5), `coordinate_shape` (8.0) |
| **shape-tracer** | `trace` (1.5), `connect_dots` (2.5), `complete` (3.5), `draw_from_description` (5.0) |
| **math-fact-fluency** | `visual_fact` (1.5), `match` (2.5), `equation_solve` (3.5), `missing_number` (5.0), `speed_round` (6.5) |
| **3d-shape-explorer** | `identify_3d` (1.5), `match_real_world` (2.5), `2d_vs_3d` (3.5), `faces_properties` (5.0), `shape_riddle` (6.5) |
| **strategy-picker** | `guided` (1.5), `match` (2.5), `try_another` (3.5), `compare` (5.0), `choose` (6.5) |
| **ratio-table** | `build_ratio` (2.5), `missing_value` (3.5), `find_multiplier` (5.0), `unit_rate` (6.5) |
| **matrix-display** | `transpose` (2.5), `add_subtract` (3.5), `multiply` (5.0), `determinant_inverse` (6.5) |
| **double-number-line** | `equivalent_ratios` (2.5), `find_missing` (3.5), `unit_rate` (5.0) |
| **tape-diagram** | `represent` (1.5), `solve_part_whole` (2.5), `solve_comparison` (3.5), `multi_step` (5.0) |
| **factor-tree** | `guided_small` (1.5), `guided_medium` (2.5), `unguided` (3.5), `assessment` (6.5) |
| **bar-model** | `default` (3.0) |
| **hundreds-chart** | `highlight_sequence` (1.5), `complete_sequence` (2.5), `identify_pattern` (3.5), `find_skip_value` (5.0) |
| **ordinal-line** | `identify` (1.5), `match` (2.5), `relative_position` (3.5), `sequence_story` (5.0), `build_sequence` (6.5) |
| **analog-clock** | `read` (1.5), `set_time` (3.0), `match` (3.5), `elapsed` (5.0) |

### Assessment Primitives (6 primitives, 10 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **knowledge-check** | `recall` (1.5), `apply` (3.0), `analyze` (4.5), `evaluate` (6.0) |
| **fill-in-blanks** | `default` (3.5) |
| **matching-activity** | `default` (2.5) |
| **sequencing-activity** | `default` (3.0) |
| **true-false** | `default` (2.0) |
| **categorization-activity** | `default` (3.0) |

### Literacy Primitives (19 primitives, 72 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **sound-swap** | `addition` (2.0), `deletion` (3.0), `substitution` (4.0) |
| **phonics-blender** | `cvc` (1.5), `cvce_blend` (2.5), `digraph` (3.5), `advanced` (5.0) |
| **rhyme-studio** | `recognition` (1.5), `identification` (2.5), `production` (5.0) |
| **read-aloud-studio** | `default` (3.0) |
| **context-clues-detective** | `definition` (1.5), `synonym_antonym` (2.5), `example` (3.5), `inference` (5.5) |
| **sentence-builder** | `simple` (1.5), `compound` (3.0), `complex` (5.0), `compound_complex` (7.0) |
| **figurative-language-finder** | `sound_devices` (2.0), `comparison` (3.0), `advanced` (4.5), `idiom` (6.0) |
| **spelling-pattern-explorer** | `short_vowel` (1.5), `long_vowel` (2.5), `r_controlled` (3.5), `silent_letter` (4.0), `morphological` (5.0) |
| **story-map** | `bme` (1.5), `story_mountain` (3.0), `plot_diagram` (5.0), `heros_journey` (6.5) |
| **poetry-lab** | `analysis` (3.5), `composition` (6.0) |
| **text-structure-analyzer** | `chronological_description` (2.0), `cause_effect` (2.5), `compare_contrast` (3.0), `problem_solution` (3.5) |
| **paragraph-architect** | `informational` (2.5), `narrative` (3.5), `opinion` (5.0) |
| **opinion-builder** | `oreo` (3.0), `cer` (5.5) |
| **revision-workshop** | `add_details` (2.0), `word_choice` (3.0), `combine_sentences` (3.5), `transitions` (4.5), `reorganize` (5.5), `concision` (6.5) |
| **syllable-clapper** | `easy` (1.5), `medium` (2.5), `hard` (3.5) |
| **letter-spotter** | `name_it` (1.5), `find_it` (2.5), `match_it` (3.5) |
| **letter-sound-link** | `see_hear` (1.5), `hear_see` (2.5), `keyword_match` (3.5) |
| **phoneme-explorer** | `isolate` (1.5), `blend` (2.5), `segment` (3.5), `manipulate` (5.0) |
| **word-workout** | `real_vs_nonsense` (1.5), `picture_match` (2.5), `word_chains` (3.5), `sentence_reading` (5.0) |

### Engineering Primitives (6 primitives, 6 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **tower-stacker** | `default` (3.0) |
| **bridge-builder** | `default` (4.0) |
| **lever-lab** | `default` (3.5) |
| **pulley-system** | `default` (4.0) |
| **gear-train** | `default` (4.5) |
| **ramp-lab** | `default` (3.0) |

### Science / Astronomy / Physics Primitives (10 primitives, 16 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **cell-builder** | `default` (4.0) |
| **food-web-builder** | `default` (3.5) |
| **dna-explorer** | `default` (5.0) |
| **reaction-lab** | `default` (4.0) |
| **rocket-builder** | `default` (4.5) |
| **orbit-mechanics-lab** | `default` (5.0) |
| **light-shadow-lab** | `observe` (1.5), `predict` (3.0), `measure` (4.5), `apply` (6.0) |
| **constellation-builder** | `guided_trace` (1.5), `free_connect` (3.0), `identify` (4.5), `seasonal` (6.0) |
| **sound-wave-explorer** | `observe` (1.5), `predict` (3.0), `classify` (4.5), `apply` (6.0) |

### Core / Content Primitives (4 primitives, 12 eval modes)

| Primitive | Eval Modes (β) |
|-----------|---------------|
| **fact-file** | `explore` (1.5), `recall` (3.5), `apply` (5.0) |
| **how-it-works** | `guided` (1.5), `sequence` (3.5), `predict` (5.5) |
| **timeline-explorer** | `explore` (1.5), `order` (3.5), `connect` (5.5) |
| **vocabulary-explorer** | `explore` (1.5), `recall` (3.5), `apply` (5.5) |

---

## Catalog Primitives WITHOUT Registry Entries (need eval modes)

These primitives exist in the Lumina catalog but have NO entry in `PROBLEM_TYPE_REGISTRY`. If any are used as `target_primitive` in the curriculum, they need registry entries before `target_eval_mode` can be assigned.

### Math (7)
`coordinate-graph`, `slope-triangle`, `systems-equations-visualizer`, `dot-plot`, `histogram`, `two-way-table`, `number-tracer`

### Literacy (9)
`sentence-analyzer`, `word-builder`, `decodable-reader`, `character-web`, `genre-explorer`, `evidence-finder`, `story-planner`, `listen-and-respond`, `cvc-speller`

### Science (12 — all)
`molecule-viewer`, `periodic-table`, `matter-explorer`, `equation-balancer`, `energy-of-reactions`, `states-of-matter`, `mixing-and-dissolving`, `atom-builder`, `molecule-constructor`, `ph-explorer`, `safety-lab`

### Engineering (16)
`wheel-axle-explorer`, `shape-strength-tester`, `foundation-builder`, `excavator-arm-simulator`, `dump-truck-loader`, `construction-sequence-planner`, `blueprint-canvas`, `machine-profile`, `flight-forces-explorer`, `airfoil-lab`, `vehicle-comparison-lab`, `propulsion-lab`, `propulsion-timeline`, `paper-airplane-designer`, `engine-explorer`, `vehicle-design-studio`

> Note: `pulley-system-builder` in catalog ≠ `pulley-system` in registry — reconcile naming.

### Biology (17 — all)
`organism-card`, `species-profile`, `classification-sorter`, `life-cycle-sequencer`, `body-system-explorer`, `habitat-diorama`, `bio-compare-contrast`, `bio-process-animator`, `microscope-viewer`, `adaptation-investigator`, `inheritance-lab`, `protein-folder`, `energy-cycle-engine`, `evolution-timeline`

### Astronomy (4)
`scale-comparator`, `day-night-seasons`, `mission-planner`, `telescope-simulator`

### Physics (1)
`motion-diagram`

### Core (13)
`curator-brief`, `concept-card-grid`, `comparison-panel`, `generative-table`, `custom-visual`, `formula-card`, `feature-exhibit`, `annotated-example`, `nested-hierarchy`, `take-home-activity`, `graph-board`, `foundation-explorer`, `fast-fact`

### Media (4 — all)
`media-player`, `flashcard-deck`, `image-comparison`, `image-panel`

### Assessment (1)
`scale-spectrum`

---

## Implementation Order

### Phase 1: Schema + Plumbing (no data changes)

1. Add `target_eval_mode` to all schema/model files (mirrors `target_primitive` pattern)
2. Add to graph flattening (mirrors `primitive_type` pattern)
3. Add to backend CurriculumService structuring methods
4. Add to Pulse engine — prefer curriculum eval mode over IRT selection
5. Add to frontend types, manifest input, prompt builder
6. Add to `primitive-mappings` endpoint response

### Phase 2: Backfill Existing Curriculum

For each published subject (MATHEMATICS_G1, LANGUAGE_ARTS_G1, SCIENCE_G1, SOCIAL_STUDIES_G1):

1. Load all subskills from draft
2. For each subskill with `target_primitive` in `PROBLEM_TYPE_REGISTRY`:
   - Extract eval mode keywords from subskill description
   - Match against the primitive's eval mode names + descriptions
   - Use LLM call for ambiguous cases (batch — one call per subject, not per subskill)
3. Write `target_eval_mode` onto each subskill via `PUT /api/curriculum/subskills/{id}?subject_id={subject_id}`
4. Validate: every assigned `target_eval_mode` is a valid key in `PROBLEM_TYPE_REGISTRY[target_primitive]`
5. Publish + Deploy

### Phase 3: Authoring Integration

1. Update `/curriculum-author` skill to include eval mode enum in `prd_context`
2. Update `/curriculum-lumina-audit` to flag subskills missing `target_eval_mode`
3. Update Gemini authoring schema to include `target_eval_mode` as an enum field per primitive

### Phase 4: Registry Gap Fill (optional, future grades)

For catalog primitives without registry entries that are used in curriculum:
1. Define eval modes based on the primitive's `description` and `constraints`
2. Add to `PROBLEM_TYPE_REGISTRY`
3. Then backfill `target_eval_mode` for those subskills

---

## Acceptance Criteria

- [ ] Every subskill in `curriculum_published` with a `target_primitive` in the registry also has a valid `target_eval_mode`
- [ ] Pulse engine uses `target_eval_mode` from graph node when available, falls back to IRT `select_best_mode` only when absent
- [ ] Gemini manifest prompt includes `eval_mode_hint` for each item that has one
- [ ] `/curriculum-lumina-audit audit` reports `target_eval_mode` coverage alongside primitive coverage
- [ ] Republished subjects have `eval_mode` on flattened graph nodes
- [ ] New subskills authored via `/curriculum-author` include `target_eval_mode` in the generation schema

---

## What This Does NOT Change

- **IRT model** — Still used for scoring, theta updates, gate transitions. `select_best_mode` remains for assessment-mode sessions or subskills without curriculum eval mode assignment.
- **Generator behavior** — Generators already receive an eval mode; this just ensures it's curriculum-driven rather than IRT-driven for subskill practice.
- **Primitive components** — No component changes. The eval mode is consumed by generators and evaluators, not the visual component itself.
