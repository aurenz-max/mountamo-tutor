# light-shadow-lab — W1 workspace binding (plain shape), 2026-10-09

**Modes bound:** observe, predict, measure, apply (all catalog modes). Gesture only: one tapped choice and Check Answer.

**Checked by code:** `shadowCorrect` against the key recomputed from the item's sun (`keyShadow`, or the item's time on
apply). Committed through `progress.commitCheck(describeShadowWork, correct, shadowMiss)`.

**Misses:** observe/predict/measure `toward_sun`, `side_when_overhead`, `below_when_side`, `length_flipped`,
`length_off`, `both_wrong`; apply `mirror_time`, `wrong_height`, `other_time`.

**Fixed on the way (pedagogy, both paths):**
- The key was the only choice in its own format ("West (right), Long" beside LLM text "Morning", "Pointing North"): the
  choices are now built in code, four in the key's form, each a named error (`shadowOptions`).
- apply printed the answer time at the top of the scene and drew the sun: both hidden until answered.
- predict drew the shadow it asks to predict: hidden until the prediction is right.
- The easy tier's live readout printed "Shadow: long, W" while working; it now shows only after a right answer.
- The generator's hints stated the shadow ("sits right below the object"): a code hint (`shadowHint`) is drawn instead.
- Generator: grade read from `ctx.grade` (a "Grade 1" lesson resolved to grade 3 / sundial); instructions ask for both
  direction and length (they asked for one while the choices are both), observe names a time mark, predict/measure/apply
  never tell the learner to move the sun, apply never names the time.
- observe: a mark per time on the sun's path, the sun snaps onto one; it opens where its shadow points the other way.

## Gates

| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors |
| `LightShadowLab.workspace.test.tsx` | 9/9 |
| `ScienceWorkspaces.surface.test.tsx` (existing Pip test) | pass |
| `activityContract`, `lessonWorkspacePlan`, `misses.test`, `workspaceContract` | 2455/2455 |
| journey sweep, 4 payloads (16 items) | 0 findings; misses 16/16 named; J10 clean 100, J11 recover 67 |

Sibling failures seen in the full sweep: `letter-workshop.copy/.write` (first run), `classification-sorter.sort` (second).

## Tutor replay (5 samples x 4 modes, gemini-3.8-flash)

- r1: `no_protocol_leak` 10/20 at start: the tutor said "press Check Answer", copied from the scene facts. Read by hand,
  apply stuck replies led to "the morning" with only one morning time on screen.
- Fix: the scene and guidance no longer name the button; apply's wrong times cover the miss kinds (mirror time, same
  side other height, other) instead of three afternoon times.
- r2: 0 code misses. Read by hand: 3/25 stuck replies named one side ("Give one of the West choices a try!", "does that
  shadow point toward the West on the right?").
- Fix: guidance "never say or hint which way ... not as a choice to try, not as a yes-or-no question that names one".
- r3: 0 code misses; by hand, every stuck/miss reply names both sides or none ("left or right", "east or west").
  Saved: `qa/tutor-reports/replay/light-shadow-lab-2026-10-09{,-r2,-r3}.json`.

**Undriven modes:** none. The observe drag is not driven (the check does not read it); the row taps and checks.

## Open findings
- Contract G1: apply instructions state the shadow in words, so apply can be answered from the text alone; they also
  say "flagpole" when the drawn object is a person. → `/eval-fix`.
- Needs a browser check on observe: the drag, the snap onto a time mark, and the opening sun position.
