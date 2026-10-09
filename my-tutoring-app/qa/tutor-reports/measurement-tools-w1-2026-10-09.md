# measurement-tools — W1 workspace binding (plain shape), 2026-10-09

**Modes bound:** measure, compare, estimate, convert (all catalog modes). Gesture only.

**Items:** one per shape; compare adds `order-shapes` after the shapes (it was session state outside the progress hook,
now its own item on both paths).

**Checked by code (the activity's own check):** the typed or stepped length against `widthInches` (tolerance 0.5,
or 0.25 at half precision); convert's conversion against `widthInches × 2.54` (or ÷) within 10% (min 0.5); the
tapped order against width order. A right measurement on convert opens the conversion and commits nothing. Committed
through `progress.commitCheck(describeMeasurementWork, correct, measurementMiss)`.

**Misses:** reading `one_over`, `one_short`, `whole_not_half` (estimate), `too_long`, `too_short`; converting
`same_number`, `wrong_operation`, `too_small`, `too_large`; ordering `longest_first`, `two_swapped`, `out_of_order`.

**Scene:** shape name and type, ruler unit, mark spacing and label density, `placed`, `step`; on the convert step the
checked measurement and whether the 2.54 rule is shown. Never a width, converted length or order.

**Component changes beyond the swap:** "Put it on the ruler" button (the drag's tap twin; the harness cannot drag),
typed length boxes beside − / +, convert's 1.2 s delay removed, Try again keeps the shape on the ruler and a checked
measurement. Generator now shuffles the shapes: they were sorted, so compare's buttons listed the answer top to
bottom (contract R2). Hard-tier wrong-conversion card no longer states the rule it hides (R3).

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors |
| `MeasurementTools.workspace.test.tsx` | 9/9 |
| `MathWorkspaces.surface.test.tsx`, `activityContract.test.ts`, `lessonWorkspacePlan.test.ts`, `misses.test.ts`, `workspaceContract.test.tsx` | pass |
| journey sweep, 4 payloads | 0 findings; misses 17/17 named; J10 clean 100, J11 recover 67 |

At the W1 run the sweep's only failures were multiplication-explorer (3 payloads, a sibling mid-edit).

## Tutor replay (5 samples x 4 modes, gemini-3.8-flash)

- r1: `stuck` no_fix_before_try 9/20 ("put the rectangle back on the ruler"): Try again took the shape off the ruler,
  so the tutor's first move was to re-place it. Fixed in the component: Try again keeps the placement.
- r2: 0 check misses, but read by hand, estimate `stuck` named the interval ("past the 2, right on the half-inch
  line"): `rounded_up` plus the learner's 3 gives the key. Guidance gained "never turn a named miss into the length,
  never name a number the edge reaches, passes or lies between" (r3: 1/5 still did), then the directional estimate
  misses were merged into `whole_not_half`.
- r4: 0 check misses; estimate miss and stuck replies ask "which two whole numbers does the edge sit between?".
  Saved `qa/tutor-reports/replay/measurement-tools-2026-10-09-r4.json`.

**Undriven modes:** none.

## Open findings

- Contract G1: an exact-offset miss (`one_over` with the learner's answer) gives the key to the tutor; shared by every
  family with off-by-one misses. Needs a ruling on whether a miss's direction reaches the tutor.
- Scripted path (no runtime) was refactored onto the same items (compare's ordering is now an item; auto-advance,
  scoring and the summary kept). Should work — needs a browser check on the scripted compare and convert flows.
