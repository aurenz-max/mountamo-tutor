# transformation-lab — W1 workspace binding, 2026-10-09

Plain shape (P), batch C18. Not committed.

## Modes
All five catalog modes bind; none undriven.

| Mode | Answer | Checked by code |
|---|---|---|
| apply_translation_reflection | drag each pink corner, Check | corner set = expected image |
| apply_rotation | drag, Check | same |
| dilation_similarity | drag, Check | same |
| identify_transformation | tap one of four names, Check | option = `correctOption` |
| compose_sequence | flip/turn and slide buttons, Check | corner set = dashed target |

## Misses (`transformMiss`, catalog `misses`)
- translate/reflect: unmoved, opposite_shift, swapped_shift, one_axis_shift, wrong_axis, partly_placed, shape_changed, misplaced
- rotate: unmoved, wrong_direction, wrong_angle, reflected_instead, partly_placed, shape_changed, misplaced
- dilate: unmoved, added_factor, wrong_factor, one_axis_scaled, partly_placed, shape_changed, misplaced
- identify: wrong_axis, reflection_for_rotation, rotation_for_reflection, wrong_direction, wrong_angle
- compose: unmoved, orientation_off, position_off

## What changed
- `transformationLabWorkspace.ts`: geometry (moved out of the component), assignment, scene, check, describe, miss, journey inputs, replay keys.
- `TransformationLab.tsx`: `TransformationLabSurface` + `withWorkspaceController`; `commitCheck` on both paths; `learnerBlocked()` on drag, palette, Reset, options and Check; hint and Next hidden on the workspace path; legacy AI disabled and `sendText` muted there; scene in `useLayoutEffect`; submit only under an evaluation provider. The canvas drag now also takes mouse events when no pointer event came first (the journey driver strokes a canvas with mouse events), and an unmeasured canvas reads coordinates 1:1.
- Adapter `transformationLabLive.ts` (rejects items whose check cannot be read: corner counts, off-grid points, a missing right option, a compose target no palette move reaches); `activityContract.ts`; catalog `teachingWorkspace`; journey row; `lessonWorkspacePlan.test.ts` id list; 5 payloads.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- `TransformationLab.workspace.test.tsx` 11/11; `MathWorkspaces.surface.test.tsx` passes.
- Sweep + `workspaceContract` + `misses` + `lessonWorkspacePlan` + `activityContract`: all pass. transformation-lab: 5 payloads x 4 items, 0 findings J1-J13.

## Replay (text, 5 payloads x 5 samples)
- Run 1 (`replay/transformation-lab-2026-10-09.json`): 1 miss, a false key "0" (the lone digits of the credited response; the origin is a fixed corner of a dilation). Fixed with the row's `replayKeys` (image corners as printed).
- Run 2 (`-r2`): 0 misses. Read by hand: on identify, the stuck reply concluded "flipped across the vertical line" (1/5) and named the family in others. Guidance changed: never name the motion, its line or angle, or call it a flip, mirror or turn.
- Run 3 (`-r3`): 0 misses; identify misses ask what changed in one corner's coordinates; 1 of 5 stuck replies still says "what kind of motion flips across a line".

## Open
- Browser check owed on the drag (pointer path) and the canvas drawings; verified in JSDOM only.
- Ruling: with no tier set there is no rule card, and the tutor states the coordinate rule ("(x, y) to (-y, x)") when the learner is stuck (3/5 rotation samples). The guidance forbids it only where a tier hid the card. The old catalog scaffold states the same rule.
