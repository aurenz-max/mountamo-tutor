# measure-lab — W1 workspace binding (plain shape), 2026-10-09

**Modes bound:** balance_predict, capacity_predict, pour_count, order_capacity (all catalog modes). Gesture only.

**Checked by code (the activity's own check):** the guess against `expectedChoice` after the test settles (900 ms),
the tapped count against `expectedCount`, the tapped order against `expectedOrder`. Committed through
`progress.commitCheck(describeMeasureWork, correct, measureMiss)`.

**Misses:** balance `picked_lighter`; capacity `tall_means_more`, `picked_less`; pour_count `one_short`, `one_over`,
`too_few`, `too_many`; order `most_to_least`, `two_swapped`, `out_of_order`.

**Scene:** objects/containers by name and shape; `scale` and `afterPouring` only once the test has run (it is drawn);
pour_count publishes `level` (empty / partly filled / full), never the cups poured.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors |
| `MeasureLab.workspace.test.tsx` + `MeasureLab.surface.test.tsx` | 14/14 |
| `activityContract.test.ts`, `lessonWorkspacePlan.test.ts`, `misses.test.ts` | pass |
| `workspaceContract.test.tsx` (measure-lab rows) | pass (the one failure is timeline-builder `place-historical`, a sibling) |
| journey sweep, 4 payloads | 0 findings; misses 17/17 named; J10 clean 100, J11 recover 67 |

## Tutor replay (5 samples x 4 modes, gemini-3.8-flash)

Run 1: 0 check misses, but read by hand, after a wrong guess the tutor said the result for the learner ("the side
with the book went down", "the pot took 7 scoops and the mug took 5") on 8/10 balance and capacity miss replies.
Guidance changed to "ask the learner which side went down or which took more cups ... do not say it for them".
Run 2: 0 check misses; 10/10 of those miss replies ask ("Which side went down?"). Saved:
`qa/tutor-reports/replay/measure-lab-2026-10-09.json`.

**Undriven modes:** none.

## Open findings

- Contract G1: the generator draws container shape by index, so a "big bowl" renders tall and narrow. → `/eval-fix`.
- Scripted path: a wrong guess on balance/capacity was a dead end (no control after the test); a Try again was added
  there. Needs a browser check on that scripted flow.
