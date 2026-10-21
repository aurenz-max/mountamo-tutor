# Contract: coordinate-graph

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C19) for the workspace and lever requirements only. A full `/primitive-contract coordinate-graph` derivation (consumers per skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CoordinateGraph.tsx` · **Workspace:** `coordinateGraphWorkspace.ts` · **Levers:** `coordinateGraphLevers.ts` · **Generator:** `service/math/gemini-coordinate-graph.ts` · **Oracle:** `service/qa/oracles/coordinate-graph.ts` · **Boss:** `coordinateGraph.card.ts` + `coordinateGraph.boss.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`coordinate-graph`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check: plot_point by the grid crossing tapped (`plotCorrect`), the other three by the choice tapped (`choiceCorrect`, the item's `correctOptionIndex`). The boss (`validateCoordinateGraphData`) refuses an item unless exactly one of four distinct choices has the key's value and it is the indexed one, every point is an integer on the grid, and a line is not vertical. Each wrong tap names a `CoordinateMiss` from the catalog list. Scene facts name only what the plane labels; never the highlighted pair, the slope or the intercept. A slope or intercept choice is described by its place ("chose the second choice"), since its number often holds the key's digits. The answer is never shown after a wrong tap; the hint, Continue and the primitive's own Try again are not shown, and nothing auto-advances.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C19.
- **Evidence:** `CoordinateGraph.workspace.test.tsx` 10; sweep J1-J13 on 4 payloads, 0 findings, 20/20 misses named; replay 4 x 5, 0 misses (`qa/tutor-reports/coordinate-graph-w1-2026-10-09.md`).
- **Probe:** `CoordinateGraph.workspace.test.tsx`; `journeySweep -t coordinate-graph`.

### R2 — the intercept item never prints its answer · OBSERVED (2026-10-09)
- **Property:** the equation label is drawn as `maskedEquation` ("y = 2x + ?"), never the generated `y = mx + b`. The generator replaces an instruction that states the answer (a read_point pair, a stated slope or "horizontal" on a flat line, an intercept item's equation or "(0, b)") with the plain ask, and replaces a repeated or second key-valued choice with a computed distractor.
- **Probe:** `CoordinateGraph.workspace.test.tsx` ("draws its equation with the intercept masked").

### R3 — plotting is a pointer tap on the plane in its own viewBox · OBSERVED (2026-10-09)
- **Property:** the plane (`data-pip-object="plane"`) places a point on pointer up at the nearest grid crossing, read through the SVG's screen matrix (`viewBoxPoint`, `nearestCrossing`); the journey row drives it with a one-point `draw` stroke.

### R4 — every mode's levers change the plane, never the answer · OBSERVED (2026-10-09)
- **Property:** `coordinateGraphLevers.ts` declares levers on every mode, and every miss the check can name is answered by a lever on every item. Help: axis_guide, every_line (where a line goes unnumbered; never on intercept, whose key is a lone number), drop_lines, model_point (plot, read); rise_run_triangle, unit_steps (where the tier withheld them), slope_frame (slope); crossing_marker (where withheld), intercept_frame (intercept); model_line (slope, intercept). Leak rules in code: no lever's `when`/`does` has a digit; a model's caption holds no number with the key's value and never the key's pair; a model point shares no magnitude with the key. Simplify (`simpler_item`, every mode, where the item is not already that simple) opens a smaller point, a small reduced slope of the same sign, or a slope-one line crossing near its marked points, with its own `~simpler` id, ask, points and answer, the learner's key never among its choices (`practiceLeaks`), ungraded; the full item comes back blank. Starting positions are the existing tier flags: a lever that re-draws a tier-withheld aid is offered only where the tier withheld it.
- **Evidence:** `coordinateGraphLevers.test.ts` 26, `CoordinateGraph.levers.workspace.test.tsx` 4; sweep J9/J12/J13 0 findings (`qa/eval-reports/coordinate-graph-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding, C19); R4 levers.
- 2026-10-20 — moved onto a boss (wave 3): card + bespoke `defineBoss` (plot_point is a placement, `manipulate`; the three choice modes `TAP_ONE`; per-mode affordances state each), levers as a lever set (axis_guide legend; every_line, drop_lines, rise_run_triangle, unit_steps, crossing_marker marks; slope_frame, intercept_frame clue; model_point, model_line model with tier `support`; simpler_item easier), workspace-only export; the scripted path (show-answer after two misses, Continue, hint card, tier reveal clauses), adapter, catalog guidance and tutoring block deleted. R1 now reads: the answer is never shown after a wrong tap on any path. R2-R4 unchanged.
