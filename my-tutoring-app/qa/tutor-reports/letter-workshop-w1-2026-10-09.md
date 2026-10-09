# letter-workshop — W1 workspace binding (C13), 2026-10-09

Plain shape (P), every catalog mode: `trace`, `copy`, `write`. Export `withWorkspaceController`; the scripted path is unchanged.

## What is checked by code
- The paper's own Check: `evaluateLetterTrace` (trace) / `evaluateLetterFormation` (copy, write), then on a failed copy/write the vision judge (`judgeLetterDrawing`). The verdict commits through `progress.commitCheck(describeWriting(...), passed, letterWorkshopMiss(...))`. No `expectedAnswer`.
- The judge is now asked only when the ink renders to an image (`renderLetterInkForJudge` non-empty); with no 2D canvas the geometric verdict stands with no wait (this is what made copy/write drivable in the dry sweep).
- Misses (`letterWorkshopMiss`, union `LetterWorkshopMiss`): judge reading first — `other_letter`, `reversed` (b/d, p/q), `wrong_case`; then geometry — `stroke_count`, `start_or_order`, `part_left_out`, `extra_ink`, `direction_or_shape`. Trace has the five geometry misses only.
- Write: the assignment's task names the letter and how its name is said; the scene fact says nothing on screen shows it; the paper opens with no cue. Component title, prompt, paper label and model stay target-free until a check, as before.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| `LetterWorkshop.workspace.test.tsx` + existing literacy LetterWorkshop tests | 5 files, 212/212 |
| `workspaceContract.test.tsx` -t letter-workshop | pass |
| `journeySweep.test.tsx` -t letter-workshop (J1–J13) | 3/3 payloads pass; J10/J11 baselined on copy and write (below) |
| `catalog/misses.test.ts` | pass |
| Literacy folder | 138/139 files; 1 unrelated timeout (`SyllableBuild.workspace.test.tsx`, 5.3 s under load) |

Payloads: `w1-payloads/letter-workshop.{trace,copy,write}.json` (lowercase a n p i / s p t i / t i p a).

## Tutor replay (text, 3 modes × 4 moments × 5 samples)
`qa/tutor-reports/replay/letter-workshop-2026-10-09.json`: 1 miss in 180 checks — `trace stuck` `no_fix_before_try` 1/15 ("Put your finger or pen on dot number 1"). The dots are drawn on screen on trace; this is pointing at the visible guide, not a fix. `replay_checks.said_fix` now reads a numbered dot as a name (pinned test); rescored 0/180. Read by hand: write opens with "Write the lowercase letter t…" (says the name, never a sound or shape); after a write miss the tutor sends the learner to the model that the check reveals, which is the contract. No guidance change.

## Undriven
None. The dry sweep draws on the SVG paper with pointer events (`draw` input gained `target`, journeySweep + `scripts/primitive-runtime-driver.mjs`).

## Open findings / rulings
- **Copy/write submit nothing (by contract).** Sessions with copy or write are `localOnly` (provisional formation scoring), so J10/J11 find no record; baselined in `journey-sweep-baseline.json` with the contract as owner. Whether a workspace lesson should record copy/write is a `/student-data-loop` user ruling.
- Needs a browser check on write: the tutor saying the letter name at item open, with no cue gate.
