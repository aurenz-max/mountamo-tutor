# Counting Board and Shape Sorter in ordinary lessons

Date: 2026-09-19. Owner: LA-14 S2.

## User direction and resulting behavior

The user clarified that completing the assignment through the tutor counts as a
normal primitive completion. There is no separate practice-only completion or
mastery-eligibility gate in this implementation. The two wired modes submit through
`usePrimitiveEvaluation` and the existing `EvaluationProvider`, just as their prior
controllers did. Kindergarten navigation continues to read `submittedResults`.

Scope: Counting Board `count` (`count_all` challenges) and Shape Sorter `identify`
with plain shape geometry, each with one explicit manifest objective and exact
`config.targetEvalMode`. Invalid payloads, ambiguous objectives, mixed modes and
unverified sibling modes keep their existing path. No content is regenerated.

## Implementation

- `LessonScreen` mounts `LessonWorkspaceProvider`. The same `OrderedSection` serves
  Kindergarten and scroll lessons, passes exact instance/objective/plan/mode identity,
  and selects the existing tutor/JEV controller for eligible surfaces.
- One focused surface registers on the runtime. Inactive work stays mounted without
  consuming speech, accepting learner input or acknowledging another surface's paint.
  Kindergarten keeps those workspaces mounted when navigating backward. Switching or
  reconnecting clears pending speech and invalidates prior commands and observations.
- Completed surfaces preserve their summary and evaluation latch on return. Completion
  still waits for tutor audio settlement and the observer's visible transition.
- `LuminaAIContext` honors explicit null tutoring at connect and switch, suppressing
  old catalog scripts. Reconnect uses the current primitive and runtime snapshot.
- Ordinary lessons authenticate with `runtime_lesson`, without the activity-generation
  sandbox. The generic `observe_runtime` tool starts a continuing state stream;
  subsequent updates are SILENT so audio-only teaching receives changed scene facts.
  No backend primitive names, teaching plans or per-domain scripts were added.
- The observer API is shared at `/api/lumina/observe-dialogue`. The old development
  address remains a compatibility wrapper for saved bench probes.
- Real audio exposed `begin_help` rejecting an empty optional target list. Empty lists
  now mean no targets for help/presentation; nonempty targets are still refused.

## Student data mapping

`TeachingSession` attempts -> `teachingEvaluation` -> primitive-specific metrics and
`usePrimitiveEvaluation.submitResult` -> `EvaluationProvider` -> the existing
`submitEvaluationToBackend` -> backend submission service. No second writer was added.
The existing backend handles the shared attempt/review identity, competency, IRT,
mastery lifecycle, rollups and subsequent observation capture.

The existing correction-based 100/67/33 score is retained. A completed assignment
submits success even if the tutor helped. `studentWork` includes all recorded teaching
attempts, tutor feedback, response source, assistance and exposure, plus the existing
`learningResponses` and challenge results. Diagnosis evidence preserves the measured
first-response share and wrong-response observations. Help and ungraded exchanges
are not invented attempts. Absence of recorded assistance is labeled honestly rather
than asserted to be independence; it does not block submission. Per-objective skill
and subskill IDs override lesson-wide fallback IDs for these migrated surfaces.

## Verification

- Real KindergartenStage, OrderedSection, both primitives, runtime, observer and
  EvaluationProvider: both activity orders complete, submit once each, unlock existing
  Next/Finish controls and remain submitted after back navigation.
- Real scroll rendering preserves unfinished demonstration/work, isolates inactive
  speech, rejects old commands and cancels interrupted feedback.
- Reconnect retains the assignment, clears unfinished speech, rejects old tickets,
  and accepts a new answer. Wrong then corrected with recorded help submits success,
  score 67 and firstResponseScore 0 through the ordinary evaluation hook.
- Backend submission/diagnosis network boundaries are replaced in these tests;
  no test writes actual student records. The production submission hook/provider
  are real. The connected model driver likewise isolates evaluation writes.
- Focused frontend verification: 191 tests across 26 files passed. Lumina typecheck: 0 errors.
- Backend runtime, activity contract/tools and lesson-plan verification: 42 tests plus
  7 subtests passed; edited Python modules compile.

The generic connected harness now supports `--lesson-entry` to exercise the ordinary
runtime authentication and observation stream against actual provider audio and JEV.
It uses the existing mounted-component driver, not the full lesson layout. Therefore
these connected journeys complement, rather than replace, the real renderer tests.
Actual browser/microphone acceptance remains HUMAN-CHECKS #167.


## Connected evidence and remaining findings

- [Shape Sorter final audio journeys](shape-sorter-lesson-protocol-after-help-fix-2026-09-19.json):
  **3/3 passed** after the empty optional targets fix. Each exercised help, visible
  demonstration, wrong response, correction, transfer item and completion through
  ordinary lesson authentication. One opening repeats its welcome; these passes
  establish the runtime journey, not perfect conversational polish.
- [Counting Board audio journeys](counting-board-lesson-protocol-audio-2026-09-19.json):
  **2/3 passed**. The third stalled after "Fantastic job counting all the blocks
  correctly!": JEV returned `none` with confidence 0.95 and did not advance. This is
  an unresolved observer interpretation failure, not a completion-credit restriction.
- [Shape observer baseline replay](shape-sorter-lesson-jev-baseline-2026-09-19.json):
  **42/42 passed** against the unchanged production observer prompt.
- [Expanded observer diagnostic](shape-sorter-lesson-jev-2026-09-19.json): **42/45**;
  all three added `final_after_substep` cases abstained when an affirmation followed
  a corners subquestion. This file tested a prompt candidate that was subsequently
  reverted; it is diagnostic evidence, not validation of the final production prompt.
  The optional `--final-after-substep` probe remains for the LA-13 observer follow-up.

Earlier attempts remain available: [initial protocol run](shape-sorter-lesson-protocol-2026-09-19.json)
was interrupted by backend reload or unavailable synthetic speech; the
[first audio run](shape-sorter-lesson-protocol-audio-2026-09-19.json) passed 1/3 and
exposed the empty-target bug and an observer abstention after a subquestion. Earlier
output also includes tutor meta narration. No failed attempts were replaced or
counted as passes, and no JEV threshold was lowered to force completion.

S2's two primitive modes are wired. Human check #167 and these LA-13 conversation/
observer findings remain open; this report does not authorize deleting the remaining
legacy controllers in S3.
