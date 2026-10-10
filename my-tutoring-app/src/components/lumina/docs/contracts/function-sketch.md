# Contract: function-sketch

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C20) for the workspace requirements only. A full `/primitive-contract function-sketch` derivation (consumers per skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/FunctionSketch.tsx` · **Workspace:** `functionSketchWorkspace.ts` · **Generator:** `service/math/gemini-function-sketch.ts` · **Oracle:** `service/qa/oracles/function-sketch.ts` · **Adapter:** `components/live-activity/adapters/functionSketchLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`function-sketch`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all four modes are gesture items checked by the activity's own check (`checkWork`): classify-shape by the family chosen, compare-functions by the curve chosen, identify-features by the features found (every one; a tap off every feature is counted, not credited), sketch-match by the weighted key-feature match of the learner's spline (60 or more). Each wrong check names a `FunctionSketchMiss` from the catalog list. The scene names what the screen prints (choices, curve buttons, the expression or description, ring and name state) and never the family, the curve, a feature's place or a key feature. On the workspace path the answer is never shown after a wrong check (the scripted path still shows it, then moves on): no "correct type is", no "answer is Curve", no green reveal curve; Next is hidden and nothing advances on its own. Taps on the canvas register on pointer down. identify-features names its features on screen only where `showFeatureLabels` is true (the easy tier); with no tier it behaves as medium (unnamed rings), and the `feature_names` lever names kinds, never places.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C20.
- **Evidence:** `FunctionSketch.workspace.test.tsx` 8; sweep J1-J13 on 4 payloads, 0 findings, 19/19 misses named; replay 4 x 5, 0 misses after one guidance fix (`qa/tutor-reports/function-sketch-w1-2026-10-09.md`).
- **Probe:** `FunctionSketch.workspace.test.tsx`; `journeySweep -t function-sketch`.

### R2 — every generated item is answerable, and only by its key · OBSERVED (2026-10-09)
- **Property:** the adapter refuses, and the generator drops, an item its check cannot read: classify-shape choices that repeat or a key that contradicts the drawn curve (a straight line keyed as a curve, or a curve keyed linear); compare-functions with one label on both buttons; identify-features with fewer than two features on the plotted axes; sketch-match whose own curve, sketched point by point, would not pass (key features off the curve). The generator replaces a classify instruction that names the key, gives a classify session a plain context and a title that names no key's family, gives compare buttons plain letters where a label carries a formula or a function name, and puts the answer on A or B at random where the labels are only letters.
- **Probe:** `FunctionSketch.workspace.test.tsx` ("the adapter refuses ...").

### R3 — every mode's levers change the screen, never the answer · OBSERVED (2026-10-09)
- **Property:** `functionSketchLevers.ts` declares levers on every mode, and every miss the check can name is answered by a lever on every item. Help: family_gallery (classify: a parent shape per choice, under its own name, never the item's curve); turn_marks and equal_steps (classify, compare: dots at turns and x-crossings, a staircase of equal steps; both curves alike, no number); feature_guide, axis_glow, feature_names (where the tier hid names), model_features (identify; a different curve, refused where it would sit on an item feature); sketch_steps and flip_model (sketch; flip refused where the item is y = x² or y = -x²). Simplify (`simpler_item`, every mode) opens a code-built easier item of the same mode with its own `~simpler` id, never offering the item's key (`practiceLeaks`), ungraded; the full item comes back blank. No when/does text carries a digit.
- **Evidence:** `functionSketchLevers.test.ts` 36, `FunctionSketch.levers.workspace.test.tsx` 4; sweep J9/J12/J13 0 findings; replay 0 misses (`qa/eval-reports/function-sketch-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R2 (W1 plain-shape binding, C20); R3 levers.
