# Contract: slope-triangle

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C20) for the workspace and lever requirements only. A full `/primitive-contract slope-triangle` derivation (consumers per skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/SlopeTriangle.tsx` · **Workspace:** `slopeTriangleWorkspace.ts` · **Levers:** `slopeTriangleLevers.ts` · **Generator:** `service/math/gemini-slope-triangle.ts` · **Oracle:** `service/qa/oracles/slope-triangle.ts` · **Adapter:** `components/live-activity/adapters/slopeTriangleLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`slope-triangle`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all three modes are gesture items checked by the activity's own check: identify_slope by the rise and run typed (`identifyCorrect`), calculate by the slope typed, compared by value so any equal fraction counts (`calculateCorrect`), draw_triangle by the triangle built (`drawCorrect`: the left corner is on the line by construction, and the whole-step rise over the run is the line's slope, so any fitting run counts; no target run or rise is shown anywhere before a check). Each wrong check names a `SlopeTriangleMiss` from the catalog list. Scene facts name only what the card prints (a build's current run and rise, leg labels where the tier shows them); never the rise, run or slope otherwise. On the workspace path Next, the hint and the scripted tutor messages are off, and the inputs, triangle and Check are closed while a checked answer waits for Try again. The adapter refuses an item whose stored key is not the drawn triangle, whose rise is not a whole number of grid steps, whose line is flat, whose run is not a whole number from 1 to 8, or a read item that prints its own legs.
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C20.
- **Evidence:** `SlopeTriangle.workspace.test.tsx` 8; sweep J1-J13 on 3 payloads, 0 findings, 15/15 misses named; replay 3 x 5, 0 misses (`qa/tutor-reports/slope-triangle-w1-2026-10-09.md`).
- **Probe:** `SlopeTriangle.workspace.test.tsx`; `journeySweep -t slope-triangle`.

### R2 — the line label never gives the slope where the item asks for it · OBSERVED (2026-10-09)
- **Property:** identify_slope and calculate draw the label as `y = ?x + b` (`lineLabel`); the generated label (`y = -0.67x + 2`) printed calculate's answer and, with the counted run, identify's rise. draw_triangle shows the full label. No placeholder or format example shows a slope value.
- **Probe:** `SlopeTriangle.workspace.test.tsx` ("the line label masks the slope").

### R3 — every rise is a whole number of grid steps · OBSERVED (2026-10-09)
- **Property:** the generator keeps only pairs whose rise is an integer for the run drawn (a 3/2 line with run 5 drew `Δy = 7.5`).
- **Probe:** oracle rule (e) and the adapter reject a half-step rise (`SlopeTriangle.workspace.test.tsx`, adapter case).

### R4 — the triangle can be built without dragging · OBSERVED (2026-10-09)
- **Property:** draw_triangle has Move left, Move right, Shorter run, Longer run, Lower rise and Higher rise buttons beside the three corner drags; a run of 1 to 8 inside the grid, the rise in whole steps from a flat start; the journey row drives them.

### R5 — every mode's levers change the card, never the answer · OBSERVED (2026-10-09)
- **Property:** `slopeTriangleLevers.ts` declares levers on every mode, and every miss the check can name is answered by a help lever on every item. Help: count_ticks (where the tier withheld the ticks), leg_names, sign_frame (identify); leg_labels (where withheld), formula_frame (calculate); build_frame (draw: the fit rule in words, never a target); model_triangle (every mode). Leak rules in code: no lever's `when`/`does` has a digit; a model's caption holds no number the size of the item's rise, run, slope or the slope turned over, and its slope is not the item's. Simplify (`simpler_item`, every mode, where the item is not already that simple): a smaller triangle with ticks (identify), a small labelled triangle needing no reducing (calculate), a line with a whole-number slope (draw), on another line with the same sign of slope, with its own `~simpler` id, ask and answer, never the item's legs, slope or target (`practiceLeaks`), ungraded; the full item comes back blank. Starting positions are the existing tier flags.
- **Evidence:** `slopeTriangleLevers.test.ts` 14, `SlopeTriangle.levers.workspace.test.tsx` 4; sweep J9/J12/J13 0 findings (`qa/eval-reports/slope-triangle-levers-2026-10-09.md`).

## Changelog

- 2026-10-09 — created with R1-R5 (W1 plain-shape binding, C20; levers). Same day: draw_triangle credits any triangle that fits the line, with no target on screen; half-step rises rejected by the adapter and the oracle.
