# PRD: New Kindergarten Primitives — Curriculum Gap Coverage

**Status:** Draft
**Last Updated:** 2026-03-09
**Priority:** High — these address K standards with zero current coverage
**Skill:** `/primitive` (to build), then `/add-eval-modes` (to wire IRT)

---

## Overview

Gap analysis of our 41 math primitives against Common Core K standards reveals three areas with no primitive coverage. These are high-frequency, daily-practice skills in every K classroom. Adding them closes the most impactful gaps in our K offering.

### Coverage Matrix (Before)

| K Domain | Standard | Current Primitive | Coverage |
|----------|----------|-------------------|----------|
| CC.1-2 | Count to 100, count forward | NumberSequencer, CountingBoard | Full |
| **CC.3** | **Write numbers 0-20** | **None** | **None** |
| CC.4-5 | One-to-one correspondence, count objects | CountingBoard, TenFrame | Full |
| CC.6-7 | Compare numbers/groups | ComparisonBuilder | Full |
| OA.1-5 | Add/subtract, decompose | AdditionSubtractionScene, NumberBond, TenFrame | Full |
| G.1-3 | Name shapes, 2D vs 3D | ShapeSorter, 3DShapeExplorer | Full |
| G.4-6 | Analyze, build, compose shapes | ShapeBuilder, ShapeTracer | Full |
| **G.pos** | **Positional language (above, below, beside)** | **None** | **None** |
| **MD.1-2** | **Describe & compare measurable attributes** | **MeasurementTools (too advanced)** | **Partial — scaffold 3+ only** |
| MD.3 | Classify and count | SortingStation | Full |

---

## Primitive 1: NumberTracer

### Rationale

CC.K.CC.3: "Write numbers from 0 to 20." This is the single most-practiced K math skill — daily handwriting practice in every curriculum (Eureka, Bridges, enVision). Students trace, copy, and eventually write numerals from memory. No current primitive addresses numeral formation.

### Concept

Canvas-based numeral writing primitive (sibling to ShapeTracer). Students trace dotted digit paths, copy digits from a model, or write from a prompt. Stroke accuracy is evaluated via path proximity — not pixel-perfect, but "did the student follow the general form?"

### Schema Design

```
challenges[]:
  type: 'trace' | 'copy' | 'write' | 'sequence'
  digit: 0-20 (the target numeral)
  instruction: string
  strokePaths: PathPoint[][] (dotted guide path, provided for trace/copy)
  showModel: boolean (visible reference digit)
  showArrows: boolean (stroke direction arrows)
```

### Eval Modes

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `trace` | 1.0 | 1 | `['trace']` | Follow dotted numeral path with direction arrows |
| `copy` | 2.0 | 2 | `['copy']` | Write digit with model visible nearby |
| `write` | 3.5 | 3 | `['write']` | Write digit from text/audio prompt only |
| `sequence` | 5.0 | 4 | `['sequence']` | Write a counting sequence (e.g., "3, 4, 5, __") |

### Key Design Decisions

- **Stroke validation:** Use path-proximity scoring (distance from ideal path), not exact match. K students have imprecise motor control — we need tolerance.
- **Digit range by grade band:** K uses 0-20; Grade 1 could extend to 120 (1.NBT.1). Design the schema to support both.
- **Multi-digit handling:** Numbers 10-20 require two strokes on a wider canvas. The `strokePaths` array handles this naturally (one sub-array per digit character).
- **Arrows vs no arrows:** `trace` mode shows directional arrows (where to start, stroke order). `copy` hides arrows but keeps the model. `write` removes all scaffolding.
- **Audio integration:** `write` mode could trigger TTS ("Write the number seven") for cross-modal practice. Optional — the instruction text is the fallback.

### Curriculum Mapping

| Standard | Eval Mode | Notes |
|----------|-----------|-------|
| CC.K.CC.3 | `trace`, `copy`, `write` | Core standard — write 0-20 |
| CC.K.CC.1 | `sequence` | "Count to 100" — writing reinforces oral counting |
| 1.NBT.1 | `write`, `sequence` | Extend to 120 for Grade 1 |

### Architecture Notes

- Reuse ShapeTracer's canvas infrastructure (`DrawingCanvas` component, touch/mouse event handling)
- Stroke paths for digits 0-9 are deterministic — can be hardcoded as constants rather than LLM-generated
- Gemini generates the *challenge selection* (which digits, what order, instructions, hints) — not the stroke paths themselves
- Scoring: compute average distance from student's stroke to nearest point on ideal path. Threshold for "correct" should be generous (~30px tolerance at canvas scale 500x400)

---

## Primitive 2: SpatialScene

### Rationale

K.G.1: "Describe objects in the environment using names of shapes, and describe the relative positions of these objects using terms such as *above, below, beside, in front of, behind, and next to*." No current primitive teaches positional/spatial vocabulary. ShapeSorter teaches shape *names*; this teaches shape *positions*.

### Concept

A scene with objects (animals, toys, furniture) arranged spatially. Students either identify positions ("Where is the cat?"), place objects ("Put the ball *above* the table"), or describe relationships. The scene is a simple 2D grid/canvas with named reference objects.

### Schema Design

```
challenges[]:
  type: 'identify' | 'place' | 'describe' | 'follow_directions'
  instruction: string
  sceneObjects: SceneObject[] (reference objects already placed)
  targetObject: SceneObject (object to reason about)
  correctPosition: 'above' | 'below' | 'beside' | 'left_of' | 'right_of' | 'between' | 'on' | 'under' | 'next_to' | 'in_front_of' | 'behind'
  options?: string[] (for identify — multiple choice of position words)
  hint: string
```

```
SceneObject:
  name: string (e.g., 'cat', 'table', 'ball')
  image: string (emoji or illustration key)
  position: { row: number, col: number } (grid position)
```

### Eval Modes

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify` | 1.0 | 1 | `['identify']` | Multiple-choice: "Where is the cat?" → above / below / beside |
| `place` | 2.5 | 2 | `['place']` | Drag object to described position: "Put the ball above the box" |
| `describe` | 3.5 | 3 | `['describe']` | Type/select the position word for a shown arrangement |
| `follow_directions` | 5.0 | 4 | `['follow_directions']` | Multi-step: "Put red ball above box AND blue ball beside tree" |

### Key Design Decisions

- **Grid-based, not free-form:** Use a 3x3 or 4x4 grid so positions are unambiguous. "Above" means the cell directly above. This avoids spatial ambiguity that would make evaluation unreliable.
- **Emoji-based visuals:** Use emoji for objects (cat, dog, ball, star, tree, house, car, flower) rather than illustrations. This keeps the primitive lightweight and avoids asset dependencies. The component renders emoji at large size inside grid cells.
- **Position vocabulary progression:** Start with `above`/`below` (vertical), add `beside`/`next_to` (horizontal), then `between` (requires two reference objects). The eval modes control this implicitly through challenge type constraints.
- **Multi-step in `follow_directions`:** These challenges have 2-3 placement instructions in sequence. The student must hold spatial instructions in working memory — a genuine cognitive step up.
- **Avoid left/right initially:** K standards say "above, below, beside" but NOT "left, right" (that's Grade 1 geometry). The `identify` and `place` modes should use "beside" / "next to" rather than "left of" / "right of" at K level. Grade 1 eval modes could add directional specificity.

### Curriculum Mapping

| Standard | Eval Mode | Notes |
|----------|-----------|-------|
| K.G.1 | `identify`, `place`, `describe` | Core standard — positional language |
| K.G.1 | `follow_directions` | Extended — multi-step spatial reasoning |
| 1.G.2 | All | Grade 1 extends with "left/right" |

### Architecture Notes

- Simple grid component — no complex canvas needed. CSS grid with drop zones.
- Drag-and-drop for `place` mode; multiple-choice buttons for `identify` mode; text selection for `describe` mode.
- Gemini generates scene layouts (which objects where) and instructions. The spatial relationship is derived in code (compare grid positions of target vs reference), similar to how ShapeSorter derives correctness.
- This is architecturally the simplest of the three new primitives.

---

## Primitive 3: CompareObjects

### Rationale

K.MD.1: "Describe measurable attributes of objects, such as length and weight." K.MD.2: "Directly compare two objects with a measurable attribute in common, to see which object has 'more of'/'less of' the attribute, and describe the difference."

MeasurementTools exists but starts at scaffold 3+ (rulers, standard units). K measurement is purely perceptual: "Which stick is longer?" "Which box is heavier?" No units, no tools — just direct visual comparison.

### Concept

Side-by-side object comparison. Students see two (or three) objects and compare a named attribute: length, height, weight, or capacity. Visual representations make the comparison clear but not trivial — objects are sized so students must look carefully (not all comparisons are obvious).

### Schema Design

```
challenges[]:
  type: 'identify_attribute' | 'compare_two' | 'order_three' | 'non_standard'
  instruction: string
  attribute: 'length' | 'height' | 'weight' | 'capacity'
  objects: CompareObject[] (2-3 objects)
  correctAnswer: string (object name, or ordered list)
  comparisonWord: 'longer' | 'shorter' | 'taller' | 'heavier' | 'lighter' | 'holds_more' | 'holds_less'
  hint: string
```

```
CompareObject:
  name: string (e.g., 'red pencil', 'blue ribbon')
  image: string (illustration key or SVG)
  visualSize: number (relative render size — controls how the object appears)
  actualValue: number (hidden true measurement for scoring)
```

### Eval Modes

| Eval Mode | β | Scaffold | Challenge Types | Description |
|-----------|---|----------|-----------------|-------------|
| `identify_attribute` | 1.0 | 1 | `['identify_attribute']` | "What can we measure about these?" → length / weight / height |
| `compare_two` | 1.5 | 1 | `['compare_two']` | "Which pencil is longer?" — direct comparison of 2 objects |
| `order_three` | 2.5 | 2 | `['order_three']` | Order 3 objects shortest → longest (or lightest → heaviest) |
| `non_standard` | 3.5 | 3 | `['non_standard']` | "How many paperclips long is the crayon?" — measure with units |

### Key Design Decisions

- **Visual representation matters most:** The objects must be rendered at sizes that clearly (but not trivially) show the comparison. Objects should differ by ~20-40% — enough to see, not enough to be instant. Gemini generates `visualSize` ratios; the component renders proportionally.
- **No standard units at K:** `identify_attribute` and `compare_two` never mention inches, centimeters, or grams. Vocabulary is "longer/shorter", "heavier/lighter", "taller/shorter", "holds more/holds less."
- **Non-standard measurement bridge:** `non_standard` mode bridges to Grade 1 (1.MD.2) by measuring with non-standard units (paperclips, blocks, hand-spans). This is the highest eval mode and is technically a Grade 1 standard, but many K curricula introduce it.
- **Weight is tricky:** Length/height can be shown visually with sized SVGs. Weight requires a different visual metaphor — show objects on a balance/seesaw that tilts toward the heavier one. Capacity uses container fill levels. The component needs attribute-specific rendering.
- **3 objects for ordering:** `order_three` mode adds the cognitive step of serial ordering. Students drag objects into order (shortest → longest). This is a natural bridge to ComparisonBuilder's `order` eval mode.

### Curriculum Mapping

| Standard | Eval Mode | Notes |
|----------|-----------|-------|
| K.MD.1 | `identify_attribute` | Describe measurable attributes |
| K.MD.2 | `compare_two` | Direct comparison, describe difference |
| K.MD.2 | `order_three` | Extended — seriation of 3 objects |
| 1.MD.2 | `non_standard` | Grade 1 bridge — non-standard units |

### Architecture Notes

- Object rendering via SVG for length/height (scaled rectangles, pencil shapes) and illustrated containers for capacity. Weight uses a simple seesaw/balance visual (lighter version of BalanceScale's tilt animation).
- Gemini generates object pairs with names, relative sizes, and the target attribute. Correctness is derived from `actualValue` comparison in code — no post-generation validation needed.
- Drag-and-drop for `order_three`; tap-to-select for `compare_two` and `identify_attribute`.

---

## Implementation Priority

| # | Primitive | Est. Effort | Impact | Rationale |
|---|-----------|-------------|--------|-----------|
| 1 | **NumberTracer** | Medium (reuse ShapeTracer canvas) | Highest | Daily-practice K skill, zero coverage, CC.3 |
| 2 | **SpatialScene** | Low (grid + drag-drop) | High | Zero coverage, distinct cognitive domain |
| 3 | **CompareObjects** | Medium (attribute-specific rendering) | High | Near-zero coverage, foundational for measurement strand |

### Dependency Notes

- **NumberTracer** can reuse `DrawingCanvas` from ShapeTracer, plus stroke-path constants for digits 0-9. The Gemini generator only picks *which* digits and in *what order* — far simpler than generating visual content.
- **SpatialScene** is architecturally the simplest — a CSS grid with emoji objects, drag-drop zones, and position comparison logic. No canvas, no complex rendering.
- **CompareObjects** needs the most new visual infrastructure — attribute-specific renderers for length (SVG bars), weight (seesaw tilt), height (stacked objects), and capacity (container fills). Consider building length-only first, then adding other attributes as eval modes.

---

## Eval Mode Summary

| Primitive | Modes | β Range | Scaffold Range | Standards |
|-----------|-------|---------|----------------|-----------|
| NumberTracer | 4 | 1.0 – 5.0 | 1 – 4 | CC.K.CC.3, 1.NBT.1 |
| SpatialScene | 4 | 1.0 – 5.0 | 1 – 4 | K.G.1, 1.G.2 |
| CompareObjects | 4 | 1.0 – 3.5 | 1 – 3 | K.MD.1-2, 1.MD.2 |
| **Total** | **12** | | | |

---

## Open Questions

1. **NumberTracer stroke validation:** What tolerance threshold feels right? Too strict and K students fail constantly; too loose and the eval mode has no discrimination power. Propose: start at 30px tolerance, tune based on pilot data.

2. **SpatialScene: 2D grid vs perspective?** A 3x3 grid is unambiguous but feels abstract. A perspective scene (table with objects on/under/beside it) feels more natural but makes "above" vs "on" ambiguous. Recommend: start with grid, consider perspective as a future enhancement.

3. **CompareObjects: weight rendering.** Should we reuse BalanceScale's tilt animation for weight comparisons, or build a simpler seesaw? The BalanceScale component is equation-focused; a seesaw is visually cleaner for direct comparison. Recommend: build a lightweight seesaw sub-component.

4. **Should NumberTracer support letter tracing for Literacy?** The infrastructure (stroke paths, canvas, proximity scoring) would transfer directly. If yes, name it `SymbolTracer` instead and parameterize for digits vs letters. Recommend: build for digits first under `NumberTracer`, refactor to `SymbolTracer` later if literacy needs it.
