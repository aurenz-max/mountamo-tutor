# practice-problem — W1 workspace binding (C17), 2026-10-09

Plain shape, every catalog mode: `derive_easy`, `derive_medium`, `derive_hard` (step-count bands of one task).

## What checks the answer

The primitive's own judge, unchanged: the whiteboard is transcribed (`transcribeWork`), and Done sends the lines to
`compareWork`, which compares them with the generated worked solution. On the workspace path the verdict is the
checked gesture: `commitCheck(describePracticeWork(lines), verdict === 'correct', practiceMiss(lines, verdict))`.
`partial` is not credited. No key reaches the tutor: the task is the problem text, the scene facts are the problem,
the step slots (titled only when titles are on screen), the start-here hint and strategy when shown, the learner's
transcribed lines and the live reviewer's step count.

Misses (`practiceMiss`, code over the verdict): `nothing_read`, `unfinished`, `answer_without_work`, `step_error`,
`wrong_answer`.

Workspace-path behaviour: a not-correct verdict shows one status line ("not right yet" / "part of your work
matches") and keeps the worked solution, the judge's summary and its notes hidden; the canvas locks until Try again,
which keeps the learner's lines. A correct verdict shows the reveal. Scripted path unchanged (one attempt, reveal,
one submission); the judge-error retry button now actually re-sends (it returned early before).

## Files

`practiceProblemWorkspace.ts` (new), `PracticeProblem.tsx` (surface + `withWorkspaceController`),
`adapters/practiceProblemLive.ts` (new), `activityContract.ts`, catalog `math.ts` (`teachingWorkspace`),
`liveJourneySpec.ts`, `lessonWorkspacePlan.test.ts`, `journey-sweep-baseline.json` (3 J1 rows),
`PracticeProblem.workspace.test.tsx` (new), 3 payloads `w1-payloads/practice-problem.*.json`,
`docs/contracts/practice-problem.md` (new).

## Gates

- `typecheck:lumina` 0. Full tsc: see the levers report (run after both phases).
- `PracticeProblem.workspace.test.tsx` 8/8 (every mode binds with no key in the packet; hard tier shows no titles;
  wrong verdict → `step_error`, nothing of the worked solution on screen or in the packet, Done locked, Try again keeps
  the work, right verdict completes, one submission with both attempts; no submission without a provider).
- `pip/MathWorkspaces.surface.test.tsx` passes unchanged.
- workspaceContract + misses + lessonWorkspacePlan + activityContract + journeySweep: 3268 passed, 0 failed.
- Sweep for this id: J1 only (baselined, below), nothing else.

## Undriven

All three modes. Each is handwriting read by a vision transcription and a model judge; the dry sweep has no canvas
image and no judge, so the row throws with the mode's name (J1 baselined, as number-tracer's judged modes). The mounted
tests drive the binding with both routes stubbed.

## Replay

Moments recorded: `start` only (the row cannot drive a miss). Keys added by hand from the payloads' worked solutions.
3 payloads x 5 samples, twice (before and after the guidance edit for `mark_lines`): 0/15 on every check
(`replay/practice-problem-2026-10-09.json`, `-r2.json`). Read by hand: openings invite the learner to write the first
step; none names a step result; one hard-payload opening points at "the first step slot" with a hint about setting up
the equation (titles were on screen: the payloads carry no tier). Stuck/lever wording is unmeasured.

## Open findings

1. FIXED (same day): answer keys disagreed with their own steps on all three first payloads (medium keyed `m = 27`,
   steps give 28; hard `3300h = 105000 -> h = 300`, really 350/11; easy keyed `x = rac{21}{3}` in a simplest-form
   problem). Generator code check `checkPracticeKey` (`service/math/practiceProblemKey.ts`, 8 tests): inconsistent
   steps are regenerated (3 tries), a wrong or unreduced key is replaced by the last step's result. Payloads re-saved,
   3/3 consistent (x = 7, s = 59, m = 55). New: the re-saved derive_hard has 3 steps (band 4-6) and medium/hard are the
   same `125n + 4500 = N` template (`/eval-fix`, step band and variety).
2. Step titles carry the move's numbers ("Add seven to both sides", "dividing both sides by 3300"). The leak rule
   passes them (they never state a result), but at the easy and medium tiers they lay out the whole method. By design
   of the tier; noted, not changed.
3. The live reviewer marks lines on-track / off-track before Done (existing feature, kept). It is a pre-check signal
   the tutor can also read off the screen; ruling question whether it should stay on the workspace path.
4. Harness: a stand-in for `transcribeWork`/`compareWork` in the sweep would make this family drivable (J2-J13, a
   replay `stuck` moment). Not built here (shared harness change).
5. Browser check needed on the workspace path: the "checked" status line, the locked canvas and Try again keeping the
   strokes (jsdom only so far).
