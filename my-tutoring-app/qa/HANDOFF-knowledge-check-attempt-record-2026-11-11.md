# Handoff: what a knowledge-check attempt records

Date: 2026-11-11. Executor: `/review-live-wiring knowledge-check`, then `/eval-fix` for confirmed defects.
No Live sessions or tutor replays (user ruling 10-17). Everything below can be answered by code read,
vitest and a headless drive.

## Why this matters

We are testing "attempt notes": at submit, a small model reads the attempt's record and writes one
factual note (what the child was asked, what they gave), stored against unit, skill and subskill. A
later lesson asks which notes apply. The note is only as good as the record.

The record comes from the teaching workspace, not from each primitive. A primitive with a card and a
boss is wrapped by `withTeachingWorkspace`; at submit `usePrimitiveEvaluation` waits for the scored
session and merges `learningResponses` (asked, expected, observed, verdict, help), `teachingAttempts`
and `assistanceProvenance` into the student work.

- `src/components/lumina/evaluation/workspaceSubmission.ts` (`withWorkspaceEvidence`, `whenScored`, `flush`)
- `src/components/lumina/evaluation/hooks/usePrimitiveEvaluation.ts` (the `whenScored` call, about line 358)
- `src/components/lumina/components/live-activity/runtime/withTeachingWorkspace.tsx` (provider, flush on unmount)
- `src/components/lumina/components/live-activity/runtime/useWorkspaceRunner.ts` (`expect`, `scored`, about lines 206-212)

Knowledge-check is the largest single source of attempts: 16 of the 47 stored attempts for student
1004 since 2026-10-01. So its record decides a third of what the notes can say.

## What the stored data shows

Source: `students/1004/reviews` in Firestore, attempts since 2026-10-01 whose
`full_review.metadata.primitive_type` is `knowledge-check`. The child's work is at
`problem_content.student_work`; metrics at `full_review.metadata.metrics`.

1. **Two attempts have no per-item record and use the old per-problem shape.**

   | attempt_id | time (UTC) | metrics.type | student_work keys | score |
   |---|---|---|---|---|
   | `ca7b4f4f-f5e5-4ba6-924a-cbe07d81f464` | 2026-10-07 00:17 | `multiple-choice` | `studentWork` | 0 |
   | `cfdbcb11-9e7a-46f3-9e04-312226c334ad` | 2026-10-07 00:18 | `true-false` | `studentWork` | 10 |

   Those metric types are written by `primitives/problem-primitives/MultipleChoiceProblem.tsx` (line 99)
   and `TrueFalseProblem.tsx` (line 93). The 14 other attempts (2026-10-13 onward) have
   `metrics.type: 'knowledge-check-judged'` (`primitives/KnowledgeCheck.tsx`, line 213) and carry the record.

2. **Each judged attempt holds exactly one item** (`itemsTotal: 1`, one `learningResponses` row). The
   note model answered "nothing notable" for 14 of 16 knowledge-check attempts in the simulation: one
   item answered once is not a pattern.

3. **A first-try correct item scored 7.5.** Example: 2026-10-13 01:32, `multiple_choice`,
   `firstTryCount: 1`, `corrections: 0`, `accuracy: 100`, stored score 7.5. Two attempts on 2026-10-24
   with the same metrics scored 10. Eight of the 16 recent knowledge-check attempts sit at 7.5.

4. **`duration_ms` is not the time spent on the item.** One multiple-choice attempt reports
   `timeToFirstAnswer: 1197216` (20 minutes); judged attempts report about 1,519,776 ms each for two
   problems submitted two seconds apart.

5. **Subskill filing.** A question about picking the green excavator is filed under SCI005-02-d
   (estimating truck loads). This is the free-form lesson mapping, not knowledge-check itself; record
   what you see, do not fix it here.

## Questions to answer

1. Can a lesson today still submit a knowledge-check problem through the old per-problem components
   (`multiple-choice`, `true-false` metrics, no workspace record)? If yes, under what condition: a
   problem type without a judged path, no workspace runner in scope, a fallback when the tutor is not
   connected, the tester only? If no, name the commit that closed it so the two attempts above are
   explained as pre-fix.
2. For every knowledge-check problem type (multiple choice, true/false, matching, sequencing,
   categorization, fill in blanks, short answer, scenario, production), does a finished problem submit
   `learningResponses` with the question asked and the child's own answer? List any type that does not.
3. Why does a first-try correct judged item store 7.5? Find what sets the submitted score (the
   workspace session's accuracy replaces the primitive's; see `workspaceSubmission.ts` docblock) and
   say whether 7.5 is intended (for example an `on_screen` fallback or an uncertain item) or a defect.
4. Is one submission per problem intended ([N challenges = N problems] ruling), and if so, what ties the
   problems of one knowledge-check together in the stored attempt (instance id, lesson id)? The note
   step needs that key to read a knowledge-check as one activity.
5. What does `duration_ms` measure for a knowledge-check problem?

## How to check, free

- Read `primitives/KnowledgeCheck.tsx`, `knowledgeCheck.card.ts`, `knowledgeCheck.boss.ts`,
  `knowledgeCheckScript.ts` and `docs/contracts/knowledge-check.md` first.
- `cd "<abs>/my-tutoring-app" && npm run test:primitive -- knowledge-check`
- Mounted test: render knowledge-check under `LiveRuntimeSurface` with an evaluation provider, answer
  each problem type once wrong and once right, and assert the submitted `studentWork.learningResponses`.
  `primitives/visual-primitives/math/FractionBar.capture.test.tsx` shows the harness.
- Headless drive of one saved payload per type from
  `components/live-activity/runtime/testing/w1-payloads/knowledge-check.*.json`
  (recipe: memory `project_headless-chrome-drive-recipe`).
- To re-pull the stored attempts, run a read-only script with `backend/venv/Scripts/python` that
  streams `FirestoreService().client.collection('students').document('1004').collection('reviews')`.

## Done when

Each question has an answer with the file and line it rests on, any type that submits without the
record is listed with its cause, and confirmed defects are queued in `qa/EVAL_TRACKER.md` with
`/eval-fix` named. Report the answers; do not change the scoring rule without a user ruling.

## Related

- Memories: `project_kc-jev-review`, `project_kc-redesign-production-items`, `project_first-response-gate`,
  `feedback_n-challenges-n-problems`, `project_boss-card-path`.
- Simulation script: `my-tutoring-app/scripts/attempt-notes-sim.mjs` (reads a dump of real reviews,
  writes to no store).
