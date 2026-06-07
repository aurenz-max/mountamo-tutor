# Middle School Mathematics Visual Primitives — Phase 3 (Grades 6-8)
## Product Requirements Document — Lumina Platform

**Status:** Draft
**Author:** Portfolio review (`/lumina-portfolio prd math`)
**Created:** 2026-05-28
**Scope:** CCSS Grades 6-8 — fill the deliberate middle-school gap left by Phase 1 (spec-only for 6-8) and Phase 2 (K-5 focused).

> **Implementation Status:**
>
> | # | Primitive | Wave | CCSS | Status |
> |---|-----------|------|------|--------|
> | 1 | `polygon-area-builder` | 1 — Geometry | 6.G.A.1 | ✅ Shipped |
> | 2 | `circle-explorer` | 1 — Geometry | 7.G.B.4 | ✅ Shipped |
> | 3 | `angle-workshop` | 1 — Geometry | 7.G.B.5, 8.G.A.5 | ✅ Shipped |
> | 4 | `transformation-lab` | 1 — Geometry | 8.G.A.1-4 | ✅ Shipped |
> | 5 | `pythagorean-explorer` | 1 — Geometry | 8.G.B.6-8 | ❌ Not Started |
> | 6 | `solid-volume-lab` | 1 — Geometry | 6.G.A.2, 7.G.B.6, 8.G.C.9 | ❌ Not Started |
> | 7 | `box-plot` | 2 — Stats/Prob | 6.SP.B.4-5 | ❌ Not Started |
> | 8 | `probability-spinner` | 2 — Stats/Prob | 7.SP.C.5-7 | ❌ Not Started |
> | 9 | `sample-space-builder` | 2 — Stats/Prob | 7.SP.C.8 | ❌ Not Started |
> | 10 | `scatter-plot-lab` | 2 — Stats/Prob | 8.SP.A.1-3 | ❌ Not Started |
> | 11 | `integer-chips` | 3 — Number/Expr | 7.NS.A.1-3 | ❌ Not Started |
> | 12 | `inequality-line` | 3 — Number/Expr | 6.EE.B.8, 7.EE.B.4 | ❌ Not Started |
> | 13 | `exponent-lab` | 3 — Number/Expr | 6.EE.A.1, 8.EE.A.1-4 | ❌ Not Started |
> | 14 | `expression-tiles` | 3 — Number/Expr | 6.EE.A.2-4, 7.EE.A.1 | ❌ Not Started |
>
> **Track 2 (existing-primitive work):** calibrate `slope-triangle` + `histogram`; grade-band-extend `number-line`, `balance-scale`, `function-machine`, `area-model`, `dot-plot` into 6-8.

---

## Overview

Phase 1 established the math primitive catalog as a K-12+ technical spec. Phase 2 rebuilt and densified **K-5** to Lumina-native standard. Both **deliberately deferred grades 6-8**: Phase 1 lists middle-school primitives (Expression Tree, Circle Diagram, Box-Whisker, Tree Diagram, Spinner, Transformation Toolkit) as specs with no components, no schemas, and no eval modes; Phase 2's Current State Audit explicitly tags the few existing 6-8 primitives as "Beyond K-5 scope" and never touches them.

The result today: **proportional reasoning is the only middle-school domain that is genuinely shipped and solid.** Algebra/function readiness is partially covered by primitives that lean into high school. Three CCSS 6-8 reporting domains — **Geometry**, **Statistics & Probability**, and large parts of **The Number System / Expressions & Equations** — have essentially no native middle-school primitive.

Phase 3 closes that gap with **14 new primitives across 3 waves**, plus **Track 2** work to calibrate and grade-band-extend existing primitives into 6-8. Waves are ordered by white-space size: Geometry (largest hole) → Statistics & Probability → Number System / Expressions fills.

This PRD follows the Lumina-native format (wonder-driven purpose, grade-by-grade progression, four-phase interaction model, Gemini JSON schema, AI tutoring scaffold, evaluation metrics) and adds an **IRT eval-mode table** per primitive so each can be wired with `/add-eval-modes` and calibrated in the backend registry.

---

## Design Principles (Middle-School Specific)

These extend the Phase 2 principles. They reflect validated platform patterns — break them at the cost of re-learning lessons already paid for.

1. **Manipulate the Math Object, Not a Slider.** Middle-school geometry is the platform's biggest test of the *direct-manipulation* and *living-simulation* patterns. The student drags the triangle's vertex, unrolls the circle's circumference, rotates the pre-image, snaps the square onto the hypotenuse. Sliders set parameters; they never replace touching the object itself. Geometry and probability primitives should be **canvas-based simulations with real consequences**, not labeled SVG diagrams with buttons.

2. **Reasoning Over Recall.** By grade 6, the pedagogy shifts from "what is the answer" to "why does the formula work." `polygon-area-builder` must let students *derive* ½·b·h by cutting and rearranging; `pythagorean-explorer` must show the squares-on-the-sides equality before asking for a missing side. Never reveal the formula as a default label — make the student build toward it.

3. **One Relationship Per Session (Mastery Over Demo).** A single-eval-mode session is the IRT signal. Each session walks the student through **3-6 problem instances of the same mode** (the multi-challenge pattern already used by `ratio-table`, `dot-plot`, `tape-diagram`), not one demo problem. Cross-mode mixing is the adaptive engine's job, not the primitive's.

4. **Eval Modes Are Pure Difficulty Tiers.** Each eval mode is one `challengeType` at one IRT beta, betas monotonically increasing within a primitive. No hand-tuned urgency or priority multipliers — the IRT model is the selection mechanism. Backend calibration in `problem_type_registry.py` is the source of truth for betas; catalog betas must match.

5. **Gemini-Native, Schema-Simple.** Every primitive generates from a single-shot Gemini JSON-mode call. Keep schemas to **3-4 types max**; deeply nested 6+ type schemas produce malformed JSON. Per-challenge numeric data (datasets, coordinates, angle measures) is selected by a **local pool/generator service** per eval mode — the manifest supplies only session-level wrapper metadata, never specific answers.

6. **Reuse the Multi-Phase Hooks.** Use `useChallengeProgress` / `usePhaseResults` / `useMultiPhaseEvaluation` (in `components/lumina/hooks/`) for challenge tracking and phase grouping — they eliminate ~50% of boilerplate. Supply a custom `getScore` only where averaging differs (e.g., accuracy-based geometry estimates).

7. **No Pre-Baked Curriculum Mapping.** These primitives are added to the live catalog with rich `description` + `constraints`. The manifest resolves which primitive/eval-mode teaches a subskill at runtime. Never write `primitive_affinity` or `eval_mode_hint` into curriculum data.

---

## Current State Audit — CCSS 6-8 Coverage Map

Legend: ✅ shipped & solid · 🟡 exists but high-school-leaning / display-only / uncalibrated · ❌ no primitive.

| CCSS 6-8 Cluster | Standard(s) | Existing Primitive(s) | Coverage | Phase 3 Action |
|---|---|---|---|---|
| Ratios & Proportional Relationships | 6.RP, 7.RP | `ratio-table`, `double-number-line`, `percent-bar`, `tape-diagram` | ✅ | None — done |
| The Number System — factors/multiples | 6.NS.B.4 | `factor-tree` (GCF/LCM) | ✅ | None |
| The Number System — fraction division | 6.NS.A.1 | `fraction-bar` (add/subtract only) | 🟡 | Extend (Track 2, optional) |
| The Number System — integers & rationals | 6.NS.C, 7.NS.A | `number-line` (negatives), `coordinate-graph` (quadrants) | 🟡 | **`integer-chips`** + extend `number-line` |
| Expressions & Equations — exponents | 6.EE.A.1, 8.EE.A.1-4 | — | ❌ | **`exponent-lab`** |
| Expressions & Equations — expressions | 6.EE.A.2-4, 7.EE.A.1 | `equation-builder` (K-2), `area-model` (algebraic mode reserved/unused) | ❌ | **`expression-tiles`** + activate `area-model` algebraic mode |
| Expressions & Equations — equations | 6.EE.B.5-7, 7.EE.B.4a | `balance-scale` (→ two-step), `equation-builder` | 🟡 | Extend `balance-scale` (Track 2) |
| Expressions & Equations — inequalities | 6.EE.B.8, 7.EE.B.4b | — | ❌ | **`inequality-line`** |
| Expressions & Equations — slope & linear | 8.EE.B.5-6, 8.EE.C.7-8 | `slope-triangle`, `coordinate-graph`, `systems-equations-visualizer` | 🟡 (uncalibrated) | Calibrate (Track 2) |
| Functions | 8.F.A, 8.F.B | `function-machine`, `function-sketch`, `parameter-explorer` | 🟡 | Extend `function-machine` (f(x), tables) |
| **Geometry — area of 2D figures** | 6.G.A.1 | `shape-builder` (measure mode, partial) | ❌ | **`polygon-area-builder`** |
| **Geometry — volume & surface area** | 6.G.A.2, 7.G.B.6, 8.G.C.9 | `net-folder` (surface area, 3-5) | ❌ | **`solid-volume-lab`** |
| **Geometry — circles** | 7.G.B.4 | — | ❌ | **`circle-explorer`** |
| **Geometry — angle relationships** | 7.G.B.5, 8.G.A.5 | `shape-builder` (single-shape angles) | ❌ | **`angle-workshop`** |
| **Geometry — transformations & similarity** | 8.G.A.1-4 | — | ❌ | **`transformation-lab`** |
| **Geometry — Pythagorean theorem** | 8.G.B.6-8 | — | ❌ | **`pythagorean-explorer`** |
| **Statistics — distributions & center/spread** | 6.SP.A, 6.SP.B.4-5 | `dot-plot` (compute_stats), `histogram` | 🟡 (no box plot, no MAD) | **`box-plot`** + extend `dot-plot` |
| **Probability — models & simulation** | 7.SP.C.5-7 | — | ❌ | **`probability-spinner`** |
| **Probability — compound events** | 7.SP.C.8 | — | ❌ | **`sample-space-builder`** |
| **Statistics — bivariate / scatter** | 8.SP.A.1-3 | — | ❌ | **`scatter-plot-lab`** |
| Statistics — two-way tables | 8.SP.A.4 | `two-way-table` | ✅ | None |

**Two immediate quick wins (Track 2):** `slope-triangle` and `histogram` have catalog eval modes but are **absent from `problem_type_registry.py`** — they cannot participate in adaptive selection until calibrated. ~1 file each.

---

# TRACK 1: New Primitives

---

## WAVE 1 — Geometry (6-8.G)

The single largest white space. Every primitive here is a **living, directly-manipulated** geometric object on canvas.

### 1. `polygon-area-builder` — Cut It, Move It, Find the Area

> **✅ Shipped 2026-05-28** (`/primitive polygon-area-builder`). Canvas component with drag-to-decompose (slide the cut triangle to rebuild a parallelogram as a rectangle); Fork A pool service (5 eval modes: `decompose` β1.5 → `find_area_triangle_parallelogram` β2.5 → `find_area_trapezoid` β3.5 → `composite_area` β4.5 → `coordinate_polygon` β5.5). QA eval-test PASS ([report](../../../../qa/eval-reports/polygon-area-builder-2026-05-28.md)). Files: `PolygonAreaBuilder.tsx`, `gemini-polygon-area-builder.ts`, plus catalog / registry / metrics / tester / backend `problem_type_registry.py`.

**Purpose:** A child knows a rectangle's area is base × height. The leap is realizing *every* polygon's area comes from that one idea. This primitive lets students cut a triangle, parallelogram, or trapezoid and rearrange the pieces into a rectangle they already understand — deriving ½·b·h and the trapezoid formula by their own hands rather than memorizing them.

**Grade Band:** 6-7 · **CCSS:** 6.G.A.1 (area of triangles, special quadrilaterals, and polygons by composing/decomposing), extends to coordinate-plane polygons.

**Cognitive Operation:** Decomposition, conservation of area, formula derivation, composing/decomposing shapes.

**Why it's new:** `shape-builder` constructs/classifies shapes and measures one figure; it does not teach area via decomposition. `area-model` is multiplication/partial-products, not geometric area of non-rectangular figures.

**Interaction Model:**
- Phase 1 (Decompose): Drag a cut line across a parallelogram; watch the triangle slide over to form a rectangle. "Same area — now what's base × height?"
- Phase 2 (Find Area): Given a labeled triangle/parallelogram/trapezoid, compute the area; intermediate rectangle scaffold available.
- Phase 3 (Composite): Find the area of an L-shape or arrow by splitting into rectangles + triangles.
- Phase 4 (Coordinate): Polygon plotted on a grid; find area by decomposition or bounding-box subtraction.

**Multimodal Features:**
- **Visual:** Canvas polygon with draggable cut lines and animated piece-rearrangement; live area read-out only after the student commits an answer.
- **AI Tutoring:** Tutor sees the cut the student made and the figure type. Coaches conservation ("You moved the corner — did the amount of space change?") and formula bridges ("A triangle is half of which rectangle?").
- **Image Generation:** Real-world composite-area contexts (a garden plot, a flag, a roof gable).
- **Interactive:** Drag cut lines, drag pieces, snap-to-grid for coordinate mode.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `decompose` | Rearrange one figure into a rectangle; identify base/height | 1.5 |
| `find_area_triangle_parallelogram` | Compute area of triangle / parallelogram from labels | 2.5 |
| `find_area_trapezoid` | Trapezoid area; average-of-bases reasoning | 3.5 |
| `composite_area` | Decompose an irregular polygon into known pieces | 4.5 |
| `coordinate_polygon` | Area of a polygon from vertex coordinates | 5.5 |

**Gemini Generation Notes:** Generator selects 3-6 figures per session per eval mode from a local pool (integer side lengths 2-20; trapezoids with whole-number bases). Manifest supplies instanceCount + targetEvalMode only. Always include `narration` per challenge.

---

### 2. `circle-explorer` — Unroll the Circle

> **✅ Shipped 2026-06-06** (`/primitive circle-explorer`). Canvas component with unroll-the-circumference and slice-into-wedges animations; Fork A pool service (5 eval modes: `discover_pi` β2.0 → `circumference` β3.0 → `area` β4.0 → `reverse` β5.0 → `composite` β5.5). `discover_pi` gates the answer on unrolling first; `reverse` never labels the radius (the answer). tsc clean (baseline 1441); QA eval-test PASS G1–G5 across all modes ([report](../../../../qa/eval-reports/circle-explorer-2026-06-06.md)). Files: `CircleExplorer.tsx`, `gemini-circle-explorer.ts`, plus catalog / registry / metrics / tester / backend `problem_type_registry.py`.

**Purpose:** π is the most famous number students never *see*. This primitive makes it physical: unroll a circle's circumference into a straight segment and discover it's always a little more than 3 diameters long, no matter the circle. From there, circumference and area stop being formulas to memorize and become relationships students have watched happen.

**Grade Band:** 7 · **CCSS:** 7.G.B.4 (know and use the formulas for area and circumference; informal derivation of the relationship between them).

**Cognitive Operation:** Ratio reasoning (C/d = π), formula derivation, area-as-radius² scaling.

**Why it's new:** No circle primitive exists in any catalog. `shape-builder` does not handle circles or π.

**Interaction Model:**
- Phase 1 (Discover π): Unroll the circumference; measure it against the diameter; "How many diameters fit? Always ~3.14."
- Phase 2 (Circumference): Given radius or diameter, find C; choose whether to use 2πr or πd.
- Phase 3 (Area): Slice the circle into wedges, rearrange into a near-parallelogram of base πr, height r → A = πr².
- Phase 4 (Apply / Reverse): Given C or A, find the radius; semicircle and composite contexts.

**Multimodal Features:**
- **Visual:** Canvas circle with an unrolling-circumference animation and a wedge-rearrangement animation; radius/diameter handle is draggable.
- **AI Tutoring:** Tutor sees radius and which measure (C/A) is the goal. Reinforces ratio language and unit awareness (units vs square units).
- **Interactive:** Drag radius handle, trigger unroll/slice animations, enter answers.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `discover_pi` | Estimate C/d across circles; recognize the constant | 2.0 |
| `circumference` | Find C from r or d | 3.0 |
| `area` | Find A from r (or d) | 4.0 |
| `reverse` | Find r given C or A | 5.0 |
| `composite` | Semicircles / circle-in-square composite figures | 5.5 |

**Gemini Generation Notes:** Local pool picks radii (whole + simple decimals). Specify whether to use π ≈ 3.14 or leave answers in terms of π per challenge. Keep to 3-4 schema types.

---

### 3. `angle-workshop` — Measure, Relate, Solve

> **✅ Shipped 2026-06-06** (`/primitive angle-workshop`). Canvas component with a draggable protractor overlay, highlighted angle pairs, and a transversal picture; Fork A pool service (5 eval modes: `measure` β1.5 → `classify_pairs` β2.5 → `solve_unknown` β3.5 → `solve_algebraic` β4.5 → `transversal` β5.5) — all per-challenge data built in code (`selectAngleWorkshopChallenges`), Gemini emits wrapper metadata only. Answer-leak gated: `measure` labels only `?°`, `classify_pairs` shows only α/β symbols, unknowns shown as `x°`. tsc clean (baseline 1441); QA eval-test PASS G1–G5 across all 5 modes (a `solve_algebraic` supplementary monoculture from an always-firing fallback was found and fixed during QA — `b2Max` cap scaled by relationship target) ([report](../../../../qa/eval-reports/angle-workshop-2026-06-06.md)). Sound wired. Files: `AngleWorkshop.tsx`, `gemini-angle-workshop.ts`, plus catalog / registry / metrics / tester / backend `problem_type_registry.py`.

**Purpose:** Angles are where geometry becomes algebra. A student who sees that two angles on a line *must* sum to 180° can write and solve an equation for the unknown. This primitive starts with a real protractor and builds to angle relationships — complementary, supplementary, vertical, adjacent — and the parallel-lines-with-a-transversal picture that powers grade 8.

**Grade Band:** 7-8 · **CCSS:** 7.G.B.5 (angle relationships, write/solve equations for unknown angles), 8.G.A.5 (angle sums, exterior angles, parallel lines cut by a transversal).

**Cognitive Operation:** Angle measurement, relationship classification, equation setup for unknown angles.

**Why it's new:** `shape-builder`'s measure mode reads one figure's angles; it does not teach angle *relationships* or solving for unknowns across a configuration.

**Interaction Model:**
- Phase 1 (Measure): Place/read a virtual protractor on a given angle.
- Phase 2 (Classify): Identify complementary / supplementary / vertical / adjacent pairs.
- Phase 3 (Solve): Write and solve for an unknown angle using a relationship (e.g., (2x+10) + x = 90).
- Phase 4 (Transversal): Parallel lines cut by a transversal — identify and solve corresponding/alternate/co-interior angles; triangle angle sum and exterior-angle problems.

**Multimodal Features:**
- **Visual:** Canvas rays with a draggable protractor overlay; highlighted angle pairs; live degree read-out in measure mode only.
- **AI Tutoring:** Tutor sees the configuration and relationship type. Coaches relationship reasoning ("These share a vertex and form a straight line — what must they add to?") without revealing the missing measure.
- **Interactive:** Drag rays, rotate protractor, snap transversal, enter equations/values.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `measure` | Read an angle with the protractor | 1.5 |
| `classify_pairs` | Identify complementary/supplementary/vertical/adjacent | 2.5 |
| `solve_unknown` | Solve for one unknown angle from a relationship | 3.5 |
| `solve_algebraic` | Unknown is an expression (2x+10); set up and solve | 4.5 |
| `transversal` | Parallel-lines/transversal and triangle-angle-sum problems | 5.5 |

**Gemini Generation Notes:** Pool selects angle measures (integer degrees) and relationship type per eval mode. For algebraic modes, generate solvable linear setups with integer solutions.

---

### 4. `transformation-lab` — Slide, Flip, Turn, Scale

> **✅ Shipped 2026-06-07** (`/primitive transformation-lab`). Canvas coordinate-grid component with three interaction surfaces — drag-vertices-to-image (apply translation/reflection, rotation, dilation), multiple-choice naming (identify), and a transform-palette compose surface that maps the working image onto a ghost target. Fork A pool service (5 eval modes: `apply_translation_reflection` β2.5 → `apply_rotation` β3.5 → `identify_transformation` β4.0 → `compose_sequence` β5.0 → `dilation_similarity` β5.5) — all per-challenge geometry built in code (`selectTransformationLabChallenges` / `selectMixedTransformationLabChallenges`), Gemini emits wrapper metadata only. Answer-leak gated: drag/dilation modes never draw the target image; identify shows the image but never the transform name. SP-21 mixed "Auto" path interleaves all five tiers easy→hard. tsc clean (baseline 1441). QA: offline G1–G5 verification PASS against an independent oracle (image == label-derived transform; identify distractors all false; compose targets palette-reachable; 0 failures across ~40k generated challenges) — live eval-test pending dev server ([report](../../../../qa/eval-reports/transformation-lab-2026-06-07.md)). Sound wired. Files: `TransformationLab.tsx`, `gemini-transformation-lab.ts`, plus catalog / registry / metrics / tester / backend `problem_type_registry.py`.

**Purpose:** Congruence and similarity are abstract until a student physically slides, flips, turns, and scales a shape and *sees* what stays the same. This primitive is the coordinate-plane playground for the four rigid/non-rigid motions, building the grade-8 intuition that transformations are the definition of congruent (rigid) and similar (with dilation).

**Grade Band:** 8 · **CCSS:** 8.G.A.1-4 (properties of rotations/reflections/translations; congruence via sequences of motions; dilations and similarity; coordinate effects).

**Cognitive Operation:** Spatial transformation, coordinate mapping, congruence vs similarity reasoning.

**Why it's new:** No transformation primitive exists. `coordinate-graph` plots points/lines; it does not transform figures.

**Interaction Model:**
- Phase 1 (Apply): Given a pre-image and an instruction ("reflect over the y-axis"), produce the image by dragging vertices to the correct spots.
- Phase 2 (Identify): Given pre-image and image, name the single transformation and its parameters.
- Phase 3 (Compose): Achieve a target with a *sequence* of transformations; argue congruence.
- Phase 4 (Dilate / Similarity): Apply a scale factor about a center; compare side ratios; conclude similar (not congruent).

**Multimodal Features:**
- **Visual:** Canvas coordinate grid; pre-image (solid) and ghost target; animated motion preview; vertex coordinate read-outs.
- **AI Tutoring:** Tutor sees the requested transformation and the student's current image. Coaches the rule ("A reflection over the y-axis sends (x, y) to…?") and the congruence/similarity distinction.
- **Interactive:** Drag vertices, pick transformation type + parameters, set center/scale for dilations.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `apply_translation_reflection` | Produce image for a translation or reflection | 2.5 |
| `apply_rotation` | Rotate about origin by 90/180/270° | 3.5 |
| `identify_transformation` | Name the transformation + parameters from pre/image | 4.0 |
| `compose_sequence` | Reach a target via 2+ transformations | 5.0 |
| `dilation_similarity` | Apply scale factor; reason about similarity | 5.5 |

**Gemini Generation Notes:** Pool selects pre-image vertices on integer grid points and transformation parameters. Keep figures to 3-4 vertices for clean canvas math and simple schemas.

---

### 5. `pythagorean-explorer` — The Squares on the Sides

**Purpose:** a² + b² = c² is meaningless as symbols and unforgettable as a picture: the two small squares built on the legs hold exactly as much area as the big square on the hypotenuse. This primitive shows that equality first, then turns it into a tool for finding missing sides and distances.

**Grade Band:** 8 · **CCSS:** 8.G.B.6 (explain a proof), 8.G.B.7 (find unknown side lengths), 8.G.B.8 (distance between two points on the coordinate plane).

**Cognitive Operation:** Area-equality reasoning, square roots, applying the theorem in context.

**Why it's new:** No Pythagorean primitive exists.

**Interaction Model:**
- Phase 1 (See the Proof): Drag the squares-on-the-sides; watch the leg-square areas tile into the hypotenuse square. "a² + b² fills c²."
- Phase 2 (Find Hypotenuse): Given legs, find c.
- Phase 3 (Find a Leg): Given hypotenuse + one leg, find the other.
- Phase 4 (Distance / Apply): Distance between two coordinate points; real-world right-triangle contexts (ladder, ramp, diagonal).

**Multimodal Features:**
- **Visual:** Canvas right triangle with attached squares whose areas animate into one another; draggable leg lengths.
- **AI Tutoring:** Tutor sees the known/unknown sides. Reinforces which side is the hypotenuse and the square-then-square-root sequence; flags the classic "added before squaring" error.
- **Interactive:** Drag legs, trigger area-tiling animation, enter side lengths (exact roots or decimals per mode).

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `area_proof` | Confirm a² + b² = c² via the area tiling | 2.5 |
| `find_hypotenuse` | Given legs, find c | 3.5 |
| `find_leg` | Given c + one leg, find the other | 4.5 |
| `distance` | Distance between two coordinate points | 5.0 |
| `apply` | Real-world right-triangle word problems | 5.5 |

**Gemini Generation Notes:** Pool favors Pythagorean triples for early modes, irrational results (leave in √ form or round) for later modes. Generate distinct contexts per challenge.

---

### 6. `solid-volume-lab` — Fill the Solid

**Purpose:** Volume is "how many unit cubes fit inside." This primitive lets students fill prisms (including fractional-edge prisms), then extends the same fill-it idea to cylinders, cones, and spheres — connecting the cone-is-a-third-of-the-cylinder and sphere relationships they otherwise just memorize.

**Grade Band:** 6-8 · **CCSS:** 6.G.A.2 (volume of right rectangular prisms with fractional edge lengths), 7.G.B.6 (volume/surface area of prisms), 8.G.C.9 (volume of cylinders, cones, spheres).

**Cognitive Operation:** Volume as packing unit cubes, formula application, comparing solids.

**Why it's new:** `net-folder` covers surface area via nets (3-5); no primitive covers volume, fractional-edge prisms, or curved solids.

**Interaction Model:**
- Phase 1 (Pack): Fill a rectangular prism with unit cubes; count to discover V = l·w·h.
- Phase 2 (Fractional Edges): Prisms with ½/⅓-unit edges; V via fractional multiplication (6.G.A.2).
- Phase 3 (Cylinders): Stack circular layers → V = πr²h.
- Phase 4 (Cones & Spheres): Pour a cone into a cylinder (⅓ relationship); sphere volume; compare solids.

**Multimodal Features:**
- **Visual:** 3D-ish canvas solid with a fill animation (cubes for prisms, layers/pour for curved solids); draggable dimensions.
- **AI Tutoring:** Tutor sees solid type and dimensions. Coaches "area of the base × height" as the unifying idea; flags volume-vs-surface-area confusion.
- **Interactive:** Drag dimensions, trigger fill/pour animations, enter volume (in terms of π where appropriate).

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `pack_prism` | Count unit cubes; find prism volume | 2.0 |
| `fractional_prism` | Prism volume with fractional edge lengths | 3.5 |
| `cylinder` | Volume of a cylinder | 4.0 |
| `cone_sphere` | Volume of cones and spheres | 5.0 |
| `compare_solids` | Compare/relate volumes (cone↔cylinder, etc.) | 5.5 |

**Gemini Generation Notes:** Pool selects dimensions; later modes allow answers in terms of π. Note: this overlaps surface area with `net-folder` — keep `solid-volume-lab` strictly on volume to avoid duplication.

---

## WAVE 2 — Statistics & Probability (6-8.SP)

### 7. `box-plot` — Five Numbers Tell the Story

**Purpose:** A box plot compresses a whole dataset into five numbers and one picture. Students build the five-number summary, see the median and IQR as resistant measures of center and spread, and compare two distributions side by side — the comparison-of-distributions reasoning at the heart of 6.SP.

**Grade Band:** 6-7 · **CCSS:** 6.SP.B.4 (display data via box plots), 6.SP.B.5 (summarize: center, spread/IQR, shape).

**Cognitive Operation:** Ordering, quartile/median finding, IQR & range, distribution comparison.

**Why it's new:** `dot-plot` and `histogram` display distributions but neither builds a five-number summary or box plot. MAD/mean-absolute-deviation is also currently uncovered (see Track 2 `dot-plot` extension).

**Interaction Model:**
- Phase 1 (Order & Median): Order a dataset; find the median.
- Phase 2 (Five-Number Summary): Find min, Q1, median, Q3, max.
- Phase 3 (Build the Box): Drag the box/whisker handles to match the summary; read IQR and range.
- Phase 4 (Compare): Two box plots — compare center, spread, and overlap; answer inference questions.

**Multimodal Features:**
- **Visual:** Number-line canvas with draggable five-number handles forming the box; the underlying dot strip can toggle on to connect raw data to the box.
- **AI Tutoring:** Tutor sees the dataset and the student's handle positions. Coaches median-of-halves for quartiles; flags "spread = range only" oversimplification (introduces IQR).
- **Interactive:** Drag handles, toggle raw-data strip, enter summary values.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `find_median` | Order data, find median | 1.5 |
| `five_number_summary` | Find all five summary values | 2.5 |
| `build_box` | Construct the box plot from a dataset | 3.5 |
| `interpret_spread` | Read/compare IQR and range | 4.5 |
| `compare_distributions` | Compare two box plots; draw inferences | 5.5 |

**Gemini Generation Notes:** Local pool generates datasets (n = 7-15) with clean quartiles for early modes. Manifest supplies instanceCount + targetEvalMode only.

---

### 8. `probability-spinner` — Theory Meets Trials

**Purpose:** Probability lives in the gap between what *should* happen and what *did*. This primitive lets students place an event on the 0-1 likelihood scale, compute theoretical probability, then run many trials and watch experimental results converge toward theory — the law of large numbers, felt rather than told.

**Grade Band:** 7 · **CCSS:** 7.SP.C.5 (probability as a 0-1 likelihood), 7.SP.C.6 (approximate probability via long-run frequency), 7.SP.C.7 (develop and compare probability models).

**Cognitive Operation:** Likelihood scale, theoretical probability as a ratio, experimental vs theoretical comparison.

**Why it's new:** No probability primitive exists in any catalog.

**Interaction Model:**
- Phase 1 (Likelihood): Place an event ("spinner lands red") on the impossible→certain scale.
- Phase 2 (Theoretical): Compute P(event) as favorable/total from a spinner/bag/die.
- Phase 3 (Experimental): Run N trials; tally outcomes; compute experimental probability.
- Phase 4 (Compare / Model): Compare experimental to theoretical as N grows; judge whether a model is fair.

**Multimodal Features:**
- **Visual:** Canvas spinner (configurable sectors) or marble bag; animated spins with a live tally chart that updates per trial.
- **AI Tutoring:** Tutor sees the model and tally. Coaches the favorable/total ratio and convergence ("With 10 spins it's bumpy; with 200 it settles near the true value — why?").
- **Interactive:** Configure sectors, spin once / spin ×N, read the tally.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `likelihood_scale` | Place an event on the 0-1 scale | 1.5 |
| `theoretical` | Compute P(event) from a model | 2.5 |
| `experimental` | Compute experimental probability from trials | 3.5 |
| `compare_models` | Compare experimental vs theoretical; convergence | 4.5 |
| `fairness` | Decide whether a model/spinner is fair | 5.5 |

**Gemini Generation Notes:** Pool selects sector counts/colors or bag compositions. Trial counts are component-driven; the generator sets only the model and prompts. Keep the random-trial logic in the component (deterministic seed for replay).

---

### 9. `sample-space-builder` — Count Every Outcome

**Purpose:** Compound probability is impossible until you can list every outcome. This primitive builds organized lists and tree diagrams for two- and three-stage events, then counts favorable outcomes — turning "how many ways" into a structured, visible process.

**Grade Band:** 7 · **CCSS:** 7.SP.C.8 (compound events: sample spaces via organized lists, tables, tree diagrams; probability of compound events).

**Cognitive Operation:** Enumerating outcomes, the counting principle, compound probability.

**Why it's new:** No tree-diagram/sample-space primitive exists. Distinct from `two-way-table` (which reads an existing joint table rather than constructing the sample space).

**Interaction Model:**
- Phase 1 (List): Build the organized list/table for a two-stage event (e.g., coin × die).
- Phase 2 (Tree): Construct a tree diagram; count total outcomes via the counting principle.
- Phase 3 (Favorable): Highlight outcomes matching an event; count favorable.
- Phase 4 (Compound P): Compute P(compound event), including with/without replacement.

**Multimodal Features:**
- **Visual:** Canvas tree that grows branch-by-branch as stages are added; outcome leaves highlight when they match the target event.
- **AI Tutoring:** Tutor sees stages and the target event. Coaches the multiplication counting principle and the replacement distinction.
- **Interactive:** Add stages/branches, tag favorable leaves, enter counts/probabilities.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `build_list` | Organized list/table for a two-stage event | 2.5 |
| `build_tree` | Tree diagram; total outcome count | 3.5 |
| `count_favorable` | Identify and count favorable outcomes | 4.5 |
| `compound_probability` | P(compound event) | 5.5 |

**Gemini Generation Notes:** Pool selects 2-3 stage scenarios (coins, dice, spinners, draws). Cap stages at 3 to keep the tree and schema manageable.

---

### 10. `scatter-plot-lab` — Find the Trend

**Purpose:** Bivariate data is where statistics meets algebra. Students plot paired data, judge the association (direction, form, strength, outliers), informally fit a trend line, and interpret its slope and intercept in context — the on-ramp from data to linear modeling.

**Grade Band:** 8 · **CCSS:** 8.SP.A.1 (construct/interpret scatter plots; clustering, outliers, association), 8.SP.A.2 (informal line of best fit), 8.SP.A.3 (interpret slope and intercept).

**Cognitive Operation:** Bivariate plotting, association judgment, informal linear fit, slope/intercept interpretation.

**Why it's new:** No scatter-plot primitive exists. `coordinate-graph` plots single points/lines, not bivariate datasets with trend reasoning.

**Interaction Model:**
- Phase 1 (Plot & Describe): Plot a dataset; describe association (positive/negative/none; linear/nonlinear).
- Phase 2 (Outliers/Clusters): Identify outliers and clusters.
- Phase 3 (Fit Line): Drag a trend line to fit the cloud; minimize visual residuals.
- Phase 4 (Interpret): Use the fitted line to interpret slope/intercept and make predictions in context.

**Multimodal Features:**
- **Visual:** Canvas scatter with a draggable trend line; optional residual segments shown after fitting.
- **AI Tutoring:** Tutor sees the dataset and the student's line. Coaches association vocabulary and the meaning of slope/intercept *in the context's units* (memory: tie numbers to real quantities).
- **Interactive:** Plot/adjust points (in build mode), drag/rotate trend line, enter slope/intercept and predictions.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `describe_association` | Direction + form of association | 2.0 |
| `identify_outliers` | Spot outliers/clusters | 3.0 |
| `fit_line` | Drag a reasonable line of best fit | 4.0 |
| `interpret_slope_intercept` | Interpret slope/intercept in context | 5.0 |
| `predict` | Predict from the fitted line | 5.5 |

**Gemini Generation Notes:** Pool generates contextual bivariate datasets (e.g., study time vs score) with a known underlying trend. `fit_line` scores by closeness to the least-squares line within tolerance (custom `getScore`).

---

## WAVE 3 — Number System & Expressions Fills

### 11. `integer-chips` — Zero Pairs and Signed Numbers

**Purpose:** Negative numbers break arithmetic intuition: why does subtracting a negative add? Two-color counters (chips) make signed operations concrete — a red and a yellow cancel to zero, so you can always add zero pairs to "borrow" what you need. This is the manipulative bridge to fluent rational-number arithmetic.

**Grade Band:** 7 (intro 6) · **CCSS:** 7.NS.A.1 (add/subtract integers, zero pairs, additive inverse), 7.NS.A.2 (multiply/divide integers, sign rules), 7.NS.A.3 (solve real-world rational problems).

**Cognitive Operation:** Additive inverse, zero pairs, sign rules for ×/÷.

**Why it's new:** `number-line` shows movement/negatives but offers no chip model for signed *operations*; no integer-operations primitive exists.

**Interaction Model:**
- Phase 1 (Zero Pairs): Build a value with chips; remove zero pairs to simplify.
- Phase 2 (Add/Subtract): Model a + b and a − b, including adding zero pairs to subtract.
- Phase 3 (Multiply): Model repeated groups (and removal) to derive sign rules.
- Phase 4 (Apply): Real-world signed contexts (temperature, elevation, balance).

**Multimodal Features:**
- **Visual:** Canvas mat with red/yellow chips; zero pairs glow and annihilate on tap.
- **AI Tutoring:** Tutor sees chip counts and operation. Coaches zero-pair reasoning and the subtract-a-negative move; flags rote sign-rule guessing.
- **Interactive:** Drag/flip chips, form/remove zero pairs, enter results.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `zero_pairs` | Simplify a chip set by removing zero pairs | 1.5 |
| `add_integers` | Model and compute a + b | 2.5 |
| `subtract_integers` | Model a − b (incl. subtracting negatives) | 3.5 |
| `multiply_divide` | Derive/apply sign rules for ×/÷ | 4.5 |
| `apply_rational` | Real-world signed-number problems | 5.5 |

**Gemini Generation Notes:** Pool selects operand pairs by magnitude per mode (small for chip modeling). Manifest supplies instanceCount + targetEvalMode.

---

### 12. `inequality-line` — More Than One Answer

**Purpose:** An equation has an answer; an inequality has a *range* of answers. This primitive makes that shift visible: solve a one- or two-step inequality, then graph the solution set on a number line with the right open/closed endpoint and direction — including the flip when you multiply or divide by a negative.

**Grade Band:** 6-7 · **CCSS:** 6.EE.B.8 (write/graph inequalities of the form x > c), 7.EE.B.4b (solve and graph two-step inequalities; interpret in context).

**Cognitive Operation:** Inequality solving, solution-set representation, the negative-coefficient flip.

**Why it's new:** No inequality primitive exists. `number-line` plots points/values, not solution sets with open/closed endpoints and rays.

**Interaction Model:**
- Phase 1 (Represent): Graph a given inequality (x > 3) — endpoint type + direction.
- Phase 2 (Solve One-Step): Solve x ± a, then graph.
- Phase 3 (Solve Two-Step): Solve ax + b ⋛ c, then graph.
- Phase 4 (Flip & Context): Negative-coefficient flip; interpret a contextual inequality.

**Multimodal Features:**
- **Visual:** Number-line canvas with a draggable endpoint (toggle open/closed) and a shaded ray.
- **AI Tutoring:** Tutor sees the inequality and the student's graph. Coaches endpoint meaning (≤ closed vs < open) and the flip rule with a concrete check.
- **Interactive:** Drag/toggle endpoint, set ray direction, enter the solved boundary.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `graph_given` | Graph a given inequality | 1.5 |
| `solve_one_step` | Solve and graph a one-step inequality | 2.5 |
| `solve_two_step` | Solve and graph a two-step inequality | 3.5 |
| `negative_flip` | Cases requiring the inequality flip | 4.5 |
| `context` | Translate and solve a contextual inequality | 5.5 |

**Gemini Generation Notes:** Pool generates integer-solution inequalities; ensure `negative_flip` mode always involves a negative coefficient.

---

### 13. `exponent-lab` — Powers and Scientific Notation

**Purpose:** Exponents are repeated multiplication, and scientific notation is how we tame numbers too big or too small to write. This primitive builds from whole-number powers and powers of ten to the exponent laws and scientific-notation arithmetic used across science.

**Grade Band:** 6 & 8 · **CCSS:** 6.EE.A.1 (whole-number exponents), 8.EE.A.1 (integer-exponent properties), 8.EE.A.3 (powers of ten / magnitude), 8.EE.A.4 (operate with scientific notation).

**Cognitive Operation:** Repeated multiplication, exponent laws, magnitude/place-value scaling, scientific-notation conversion & arithmetic.

**Why it's new:** No exponent or scientific-notation primitive exists.

**Interaction Model:**
- Phase 1 (Expand): Expand and evaluate aⁿ; connect to repeated multiplication.
- Phase 2 (Laws): Apply product/quotient/power laws with a visual expansion check.
- Phase 3 (Powers of Ten): Convert between standard form and scientific notation; compare magnitudes.
- Phase 4 (Operate): Multiply/divide in scientific notation; add/subtract by matching exponents.

**Multimodal Features:**
- **Visual:** Expanded-form reveal (aⁿ → a·a·…·a) and a place-value slider that shifts the decimal as the power of ten changes.
- **AI Tutoring:** Tutor sees base/exponent and target. Coaches "add exponents because you're stacking the multiplications"; flags the classic 3² = 6 error.
- **Interactive:** Build expansions, drag the decimal/exponent, enter results.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `evaluate_power` | Expand and evaluate aⁿ | 1.5 |
| `exponent_laws` | Apply product/quotient/power rules | 3.0 |
| `to_scientific` | Convert standard ↔ scientific notation | 3.5 |
| `compare_magnitude` | Compare magnitudes via powers of ten | 4.0 |
| `operate_scientific` | ×/÷ (and ± ) in scientific notation | 5.0 |

**Gemini Generation Notes:** Pool selects bases/exponents and magnitudes per mode. Keep results integer or clean-decimal where possible; 3-4 schema types.

---

### 14. `expression-tiles` — Build and Simplify Expressions

**Purpose:** Algebra tiles make abstract symbols tangible: an x-tile is a length you can't measure, a unit tile is 1. Students model expressions, combine like terms (group the same-size tiles), and apply the distributive property (build a rectangle of tiles) — seeing equivalence rather than trusting a rule.

**Grade Band:** 6-7 · **CCSS:** 6.EE.A.2 (write/read/evaluate expressions with variables), 6.EE.A.3 (generate equivalent expressions; distributive property), 6.EE.A.4 (identify equivalent expressions), 7.EE.A.1 (add/subtract/factor/expand linear expressions).

**Cognitive Operation:** Variable representation, combining like terms, distributive property, evaluating expressions.

**Why it's new:** `equation-builder` is K-2 (equal-sign meaning); `area-model` has an algebraic mode that is *reserved but unused*. This primitive owns MS expression manipulation. (Track 2 may instead activate `area-model`'s algebraic mode for distributive/FOIL — see note.)

**Interaction Model:**
- Phase 1 (Write/Evaluate): Translate words ↔ expression; evaluate at a given value.
- Phase 2 (Combine Like Terms): Group same-size tiles to simplify (3x + 2 + 2x → 5x + 2).
- Phase 3 (Distribute): Build a(b + c) as a tile rectangle; read the expanded form.
- Phase 4 (Equivalence/Factor): Decide if two expressions are equivalent; factor a common term.

**Multimodal Features:**
- **Visual:** Canvas tile mat with x-tiles and unit tiles (and negatives in a second color); like terms snap into groups.
- **AI Tutoring:** Tutor sees the tile layout and target. Coaches "you can only combine tiles of the same size" and the area meaning of the distributive property.
- **Interactive:** Drag tiles, group like terms, build distributive rectangles, enter simplified forms.

**Eval Modes:**

| Eval Mode | Description | Beta |
|-----------|-------------|------|
| `write_evaluate` | Translate and evaluate an expression | 1.5 |
| `combine_like_terms` | Simplify by combining like terms | 2.5 |
| `distribute` | Expand a(b + c) | 3.5 |
| `equivalence` | Identify equivalent expressions | 4.0 |
| `factor` | Factor out a common term | 4.5 |

**Gemini Generation Notes:** Pool selects coefficients/constants (small integers; include negatives in later modes). Keep tile counts within a renderable cap.

---

# TRACK 2: Existing-Primitive Work

Lower-effort, high-leverage work that unblocks middle-school coverage without new components.

| # | Task | Primitive | CCSS unblocked | Effort | Skill |
|---|------|-----------|----------------|--------|-------|
| T1 | **Calibrate** — add beta priors to backend registry | `slope-triangle` | 8.EE.B.6 | SMALL (1 file) | manual / `/add-eval-modes` |
| T2 | **Calibrate** — add beta priors to backend registry | `histogram` | 6.SP, 7.SP | SMALL (1 file) | manual / `/add-eval-modes` |
| T3 | Add an integer/rational MS mode (negatives & rationals, operations-as-movement at 6-7 difficulty) | `number-line` | 6.NS.C, 7.NS.A | MEDIUM | `/add-eval-modes` |
| T4 | Extend ladder past two-step into variables-on-both-sides | `balance-scale` | 7.EE.B.4, 8.EE.C.7 | MEDIUM | `/add-eval-modes` |
| T5 | Add f(x) notation + linear-function-from-table modes | `function-machine` | 8.F.A, 8.F.B | MEDIUM | `/add-eval-modes` |
| T6 | Activate the **reserved algebraic mode** (distributive/FOIL via area model) | `area-model` | 7.EE.A.1 | MEDIUM | `/add-eval-modes` |
| T7 | Add mean + MAD (mean absolute deviation) measures-of-center mode | `dot-plot` | 6.SP.B.5 | SMALL | `/add-eval-modes` |

**Note on T6 vs `expression-tiles` (#14):** these overlap on the distributive property. Decide at build time — either ship `expression-tiles` as the full MS expression primitive and skip T6, or activate `area-model`'s algebraic mode for distribute/expand and narrow `expression-tiles` to combine-like-terms/factor. Do not ship both covering the same distributive eval mode.

---

## Technical Requirements

- **Catalog:** New entries appended to `service/manifest/catalog/math.ts` with full `description`, `constraints`, `tutoring` scaffold, and `evalModes[]` (betas matching the backend registry).
- **Generators:** One `gemini-<id>.ts` per primitive under the math service folder; registered in `service/registry/generators/`. Per-challenge numeric data comes from a local pool service, not the manifest.
- **Backend calibration:** Every evaluable eval mode added to `backend/app/services/calibration/problem_type_registry.py` with monotonic beta priors. (Includes fixing the existing `slope-triangle`/`histogram` omissions.)
- **Components:** Canvas-based where geometry/probability physics matters (`polygon-area-builder`, `circle-explorer`, `transformation-lab`, `pythagorean-explorer`, `solid-volume-lab`, `probability-spinner`, `sample-space-builder`, `scatter-plot-lab`, `integer-chips`, `expression-tiles`). shadcn/ui + Lumina glass theming for surrounding chrome.
- **Hooks:** `useChallengeProgress` / `usePhaseResults` / `useMultiPhaseEvaluation` for all multi-challenge sessions.
- **Schema discipline:** 3-4 types max per Gemini schema; flatten before adding nesting.
- **Tester:** Each visual primitive added to the math tester harness.
- **Type safety:** `npx tsc --noEmit` clean after each primitive.

### Per-Primitive File Inventory (pattern)

For each new primitive `<id>`:
1. `primitives/visual-primitives/math/<Component>.tsx` — component
2. `service/<math>/gemini-<id>.ts` — generator
3. `service/registry/generators/` — generator registration
4. `service/manifest/catalog/math.ts` — catalog entry (+ eval modes)
5. `primitives/visual-primitives/index.tsx` (or registry) — component registration
6. `types` — eval-mode + data-contract types
7. `backend/.../problem_type_registry.py` — beta priors

---

## Implementation Priority

| Sprint | Focus | Primitives | Rationale |
|--------|-------|-----------|-----------|
| 0 | Quick wins | T1, T2 (calibrate `slope-triangle`, `histogram`) | Already built; just uncalibrated. Hours, not days. |
| 1 | Geometry core | `angle-workshop`, `polygon-area-builder`, `pythagorean-explorer` | Highest-frequency 7-8 geometry; clean canvas interactions; biggest standards coverage per primitive. |
| 2 | Geometry depth | `circle-explorer`, `transformation-lab`, `solid-volume-lab` | Completes 6-8.G. |
| 3 | Statistics & Probability | `box-plot`, `probability-spinner`, `sample-space-builder`, `scatter-plot-lab` | Closes the entire 6-8.SP domain. |
| 4 | Number System / Expressions | `integer-chips`, `inequality-line`, `exponent-lab`, `expression-tiles` | Fills 7.NS / 6-8.EE; plus Track 2 extensions T3-T7. |

### Dependencies
```
Sprint 0 (calibrate) ──→ unblocks adaptive selection for slope-triangle/histogram immediately
Sprint 1 (geometry core) ──→ Sprint 2 (geometry depth)   [shared canvas geometry utilities]
Sprint 3 (stats/prob) can run in parallel with Sprint 1-2 (no shared deps)
Sprint 4 (number/expr) + Track 2 extensions can run in parallel; resolve T6↔#14 overlap before building
```

---

## Appendix: Grade Coverage After Phase 3

| Grade | New Phase 3 Primitives |
|-------|------------------------|
| 6 | `polygon-area-builder`, `solid-volume-lab` (prisms), `box-plot`, `inequality-line`, `exponent-lab` (powers), `expression-tiles` |
| 7 | `circle-explorer`, `angle-workshop`, `solid-volume-lab` (prisms/SA), `probability-spinner`, `sample-space-builder`, `integer-chips`, `inequality-line`, `expression-tiles` |
| 8 | `angle-workshop` (transversal), `transformation-lab`, `pythagorean-explorer`, `solid-volume-lab` (curved solids), `scatter-plot-lab`, `exponent-lab` (scientific notation) |

**CCSS 6-8 reporting domains after Phase 3:** Ratios & Proportional Relationships ✅ · The Number System ✅ · Expressions & Equations ✅ · Functions ✅ · Geometry ✅ (from ❌) · Statistics & Probability ✅ (from 🟡).

---

## Handoff

- Build a primitive: `/primitive <id>` (start with Sprint 1).
- Self-contained scope for a fresh chat: `/lumina-portfolio scope <id>`.
- Wire eval modes / calibrate: `/add-eval-modes <id>`.
- Verify: `/eval-test <id>`.
- After building a wave, re-audit: `/lumina-portfolio audit math`.
