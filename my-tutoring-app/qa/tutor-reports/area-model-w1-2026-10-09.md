# area-model — W1 workspace binding (plain shape), 2026-10-09

**Modes bound:** build_model, find_area, multiply, perimeter, factor (all catalog modes). Typed gestures only.

**Checked by code (the activity's own check, `areaCheckCorrect`):** each cell against its column part × row part,
the sum against the product, the perimeter against 2 × (length + width), the parts by `partsFit` (any parts whose
products make every cell; before this the check took only the generator's split, so 40 + 10 by 15 + 3 for a
600/150/120/30 grid was marked wrong). A forward item has two steps: a right cell is kept and is not a commit (the
item's answer is the whole model); a wrong cell, the sum either way, the perimeter and the parts commit through
`progress.commitCheck(describeAreaCheck, correct, areaMiss)`. Try again clears only the wrong entry.

**Misses:** cell `added_not_multiplied`, `dropped_zeros`, `extra_zeros`, `one_group_off`, `wrong_product`; sum
`left_out_part`, `carry_slip`, `sum_off`; perimeter `gave_area`, `two_sides_only`, `three_sides`, `perimeter_off`;
parts `swapped`, `one_part_wrong`, `parts_wrong`.

**Scene:** the model (or sides, or the cell grid and total area, all printed), whether cells are labelled or the side
sum is written out, and `learnerWork` (right cells with their place, the last wrong entry until Try again). No
product, total, perimeter or part to find. The misconception loop's per-entry evidence is kept and submitted from
`onFinished`, each wrong entry now with its miss, and the session's first-response score.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors (one interim error was the skip-counting-runner sibling's journey row, since fixed) |
| `AreaModel.workspace.test.tsx` | 10/10 |
| `AreaModel.capture.test.tsx`, `pip/AreaModel.surface.test.tsx`, `areaModelEvidence.test.ts`, generator adaptation, remediation, observation server, oracle | 32/32 |
| `workspaceContract.test.tsx`, `misses.test.ts`, `activityContract.test.ts`, `lessonWorkspacePlan.test.ts` | pass (2388 tests) |
| journey sweep, 5 payloads (`-t area-model`) | 0 findings; misses 23/23 named |

## Tutor replay (5 samples × 5 modes, gemini-3.8-flash)

Run 1 (`replay/area-model-2026-10-09.json`): 5/100 `no_fix_before_try` misses. After a wrong cell the tutor gave
the fix by amount ("put on one zero from the 40 and one zero from the 30"); after two sides of a perimeter, "try
adding all four sides together". Guidance changed: after a wrong entry do not say what to change; ask a question
(how many tens each part has, how many sides a rectangle has). Run 2 (`-r2.json`): 0 check misses. Read by hand:
miss replies now ask ("How many tens are in 20?", "How many sides does a rectangle have?").

**Undriven modes:** none.

## Open findings

- Replay r2, factor `stuck`: 1 of 3 read samples tells the learner to swap the top and side numbers. That is the fix
  for `swapped` with no amount in it, so the check does not see it. Guidance already says not to say what to change;
  left for the class Live gate.
- Replay r2, build_model `stuck`: "7 times 2 tens gives 14 tens. What number is 14 tens?" does almost all of the cell.
  Not the key; a scaffold the learner still finishes.
- Scripted path keeps its own behaviour (Next Problem, attempt counters, the `[CELL_INCORRECT]` hints); needs a
  browser check on find_area and factor, the two modes whose controls changed (cells are now buttons; factor accepts
  any fitting parts).
