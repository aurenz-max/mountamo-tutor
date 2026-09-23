# Number bond on the teaching workspace: W1, second primitive (2026-09-22/23)

Handoff 15, step 2 (second half): the recipe from the ten-frame pilot, after the shared-runner and
catalog-adapter refactor, applied unchanged. Executor `/add-live-tutor-tools`.

## The rollout number

| | Ten-frame (pilot) | Number bond |
|---|---|---|
| New domain module | 70 lines | 75 lines (`numberBondWorkspace.ts`) |
| Component diff | +174 / −68 | +84 / −30 |
| Adapter | ~50 hand-written | +10 / −29 (validate + initialState only) |
| Catalog | — | 7 lines (`teachingWorkspace`) |
| Journey row | new | 25 lines |
| Code to clean typecheck | one session | ~5 minutes |
| Drives to green | four defects | two fixes (below) |

Number bond is the most complex runner family so far: items expand into build/say and model/equation
phases, and three gesture commits carried their verdict inside cue text. Every verdict already had a code
judge (`validSplit`, `tenAndOnesFaultOf`, the action match, `familyEquationFaultOf`,
`bondEquationFaultOf`), so each commit became `commitGesture(run, { response, correct, cue })`. Each item's
task is the pack's own ask, taken from the quoted line of its cue; the spoken "say" phases read their
question and answer from the split the child built.

## What the drives found

1. **A zero-count scene fact under a credited spoken answer (fixed, both primitives).** Two `missing_part`
   audio runs stalled: the tutor clearly credited the answer ("Three is the missing part…") and the
   observer scored `correct` at 0.86 and 0.87, under its 0.9 gate. The scene said `countersInLeftPart: 0,
   countersInRightPart: 0`, because on a missing-part turn the counters are unused support. That is the
   LA-13 `counted: 0` finding. Counter counts are now published only where the board is what the item
   asks about. After: 2/2 PASS, credited turns at 0.97 and 1.0. Ten-frame had the same exposure on spoken
   add/subtract (`countersOnFrame: 0` beside "seven"); same rule applied, and `operate` (never driven
   before) PASS.
2. **Harness (generic):** `choose` also matches a button's `aria-label`; the journey context carries the
   workspace's published `expectedAnswer`, so a spoken workspace item is answered from what the tutor is
   told (`spokenExpected`), not re-derived per primitive.

Also: an incomplete split is exploration and never commits, so the harness's wrong split is a complete one
with no full ten (`ten_and_ones`) or a repeated pair (`decompose`, later pairs only).

## Verification

- typecheck:lumina 0, tsc 770, full suite 7142 passed (combined tree with the compare-objects session).
- Connected, `--lesson-entry --progression-only`:
  - `ten_and_ones` text PASS: wrong split → retry → right split → spoken ones, two teen numbers.
  - `missing_part --audio`: FAIL, FAIL (finding 1), then PASS, PASS.
  - ten-frame `operate --audio` (Grade 1) PASS after the same fix.
- Raw: `number-bond-w1-ten-and-ones-2026-09-22.json`, `number-bond-w1-missing-part-audio-2026-09-2{2,2-b,3-c,3-d}.json`,
  `ten-frame-w1-operate-audio-2026-09-23.json`.
- Four tests that used number-bond as "the runner family" now use ordinal-line.

## Not covered

- The model and equation phases (`related_fact`, `fact_family`, `build_equation`) and `decompose` are
  exercised by the component's own tests, not a connected drive; the journey row throws on those hands
  phases at W1.
- No JEV or learner-intent probe cases (W2). Browser/microphone: HUMAN-CHECKS #167.

## For the rollout

The count-fact rule is a doctrine for every adopter's `workspaceScene`: never publish a count that is not
the asked quantity beside a spoken answer. Added to `/add-live-tutor-tools`.
