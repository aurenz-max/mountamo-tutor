# practice-problem — support levers, 2026-10-09

Same task on every mode (a handwritten derivation; modes are step-count bands), so one lever set covers all three.

## Failure inventory

| Failure | Class | Observable miss |
|---|---|---|
| Cannot start (empty canvas after a while) | documented (catalog commonStruggles) | `unfinished`, `nothing_read` |
| A move that does not preserve equality (off-track line) | documented (commonStruggles; per-step `misconceptions` in every payload) | `step_error` |
| Skipped steps / answer with no work shown | documented (commonStruggles) | `answer_without_work` |
| Wrong final answer with no line flagged | inferred | `wrong_answer` |
| Writing the checker cannot read | inferred | `nothing_read` |

No observed-real or observed-synthetic evidence: no human sitting, and the dry sweep cannot drive this family.

## Lever table

| Lever | Kind | Answers | Carrier | Leak rule (code) |
|---|---|---|---|---|
| `mark_lines` | help | step_error | shown (ring + "check this line" on the learner's own line) | exists only after a check flagged a line; shows the learner's text, never the judge's note |
| `step_titles` | help | unfinished, answer_without_work, wrong_answer, step_error | shown (titles in the step slots) | not offered if any title shows a step result or the answer (`scaffoldLeaks`) |
| `start_here` | help | unfinished, wrong_answer | shown (first step's title + why) | same |
| `strategy` | help | wrong_answer, unfinished, step_error | shown (one-line approach) | same |

Unanswered: `nothing_read` (no scaffold makes writing readable; the guidance asks for larger writing, one step per
line). No simplify lever: a simpler derivation cannot be built by code (prose problem with a generated worked
solution), and the first step alone is the learner's own item cut below the mode's step band. Ruling owed if a
simplify is wanted (it would need a generation call or a code-built equation family).

Starting positions: the support tier's existing flags (`easy` all three on, `medium` titles + strategy, `hard` none;
no tier = all on). A starting scaffold shows as pulled and is not recorded as help.

## Built

`practiceProblemLevers.ts` (declarations, `answerPhrases`/`scaffoldLeaks`, `startingLevers`, `supportWith`,
`markedFact`); `PracticeProblem.tsx` lever state (pulls, flagged lines, reset on a fresh item, kept on Try again),
`pullLever`, scene fact `markedLines`, rail marks; catalog `levers: true`, `unanswered`; guidance sentence for a marked
line.

## Gates

- `practiceProblemLevers.test.ts` 23/23 (leak rule cases; no offered scaffold leaks on any saved payload; `nextLever`
  per miss; every miss answered or unanswered on every mode, on every payload at the hard tier).
- `PracticeProblem.levers.workspace.test.tsx` 6/6 (hard tier: three levers off; default: all pulled; each pull
  changes the screen and the scene fact in one commit; repeat and absent pulls refused with nothing changed; the next
  attempt records `assisted` and the levers; `mark_lines` marks only the learner's line, survives Try again).
- `PracticeProblem.workspace.test.tsx` 8/8; `typecheck:lumina` 0; sourceControlBytes passes. Full tsc 819 on the shared tree (baseline 770); none in `components/lumina` (typecheck:lumina 0), and this slice touched no file outside it, so the rise is from other work in the tree (`src/app/practice/*` errors are pre-existing, not this primitive).
- Sweep (journeySweep + workspaceContract + misses + lessonWorkspacePlan + activityContract): 3268 passed. For this
  id: J1 baselined on all three payloads; J9/J12/J13 cannot run (nothing is driven). Lever inventory:
  `declaresLevers: true`, status `levers` on all three modes.
- Replay: `start` moments only, 0/15 flags; `stuck` and `lever` moments cannot be recorded (row undriven).

Generator key check added after the gate (`practiceProblemKey.test.ts` 8/8); levers and workspace tests re-run
green on the re-saved payloads (2488 passed with workspaceContract; sweep J1 only).

## Failures with no lever

`nothing_read` (all modes), by decision above.
