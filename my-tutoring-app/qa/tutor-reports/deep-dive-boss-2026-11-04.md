# deep-dive onto the boss framework — 2026-11-04

Trigger: user feedback. On the legacy `useLuminaAI` path the tutor asked a question of its own that no item owned;
the learner answered and nothing resolved it.

## What changed
- `deepDive.card.ts` + `deepDive.boss.ts` (spoken preset; all four modes SAY_OR_SHOW). Items = the graded blocks in
  lesson order. A choice whose options can all be said gets a key; sorts, orders, diagram labels, labs and
  unsayable choices are answered on screen only (`deepDiveWorkspace.ts`).
- `DeepDive.tsx` is workspace-only (`withWorkspaceOnly`). Sections show up to the current check; the runtime
  advances, the shell's Try again reopens. `useLuminaAI` and every scripted tag are gone.
- Eight blocks take `onAttempt`: every try commits, and the block never shows the key after 2-3 misses on the
  workspace. A spoken credit remounts the block showing its answer.
- Tap-to-explore cards still reach the tutor (`requestHear`) with "ask no question of your own". Graded blocks
  send nothing: their help message named the key.
- Scene fact `constraints`: the check on screen is the only question. Typed questions are listed as
  `learnerQuestions` (practice, never this item).
- Generator: a plan with no graded block gets one MC. Catalog: `bossEntry`, `spoken` answer channel, the dead
  `tutoring` block deleted (57 lines). Tester mounts through `TesterWorkspace` (offline / live toggle).

## Checks
- `typecheck:lumina` 0. `test:primitive deep-dive` passed (boss guards, Pip surface, dry journey on
  `deep-dive.recall.json`: spoken fill-in-blank, tapped MC, wrong → Try again → right → complete).
- 16 related files, 745 tests pass.
- Browser, tester offline: one check frame, later sections hidden; wrong tap closes the frame and shows Try again;
  Try again reopens; right tap → Next → next section shown, MC current.

## Not done
- Spoken questions to the follow-up planner (needs an asks-question learner-intent signal: shared observer).
- Levers: none yet; every miss is `unanswered` (`/add-support-tiers deep-dive`).
- No `DeepDive.workspace.test.tsx`; the sweep is the only mounted check.
- Sorts, orders, labels and labs are not driven by the harness (they throw by name).

## Paid, optional (user)
No sample is required (10-19 ruling: no shared-path change, no `words.special`). To hear the tutor's wording on both
items: `cd backend/tests/tutor_live && ../../venv/Scripts/python tutor_replay.py ../../../my-tutoring-app/qa/tutor-reports/replay/deep-dive-moments-2026-11-04.json --primitive deep-dive --samples 1`
(2 moments). Question it answers: does the tutor stay on the check and ask nothing of its own?
