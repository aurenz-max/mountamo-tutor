# Next session: reliable tutor completion, then scoped script retirement

Date: 2026-09-19. Executor: `$add-live-tutor-tools`.
Ownership: LA-13 owns observer/experience repairs; LA-14 owns controller retirement.
This is an execution brief for those existing rows, not another backlog.

## User direction

**Just wire the primitives. A student completing the assignment through the tutor
counts normally, including with help.** Preserve the existing evaluation submission
and Next/Finish flow. Do not introduce a practice-only completion ledger, a separate
mastery-eligibility gate, or another assessment abstraction. Attempts, corrections,
assistance and response provenance already travel through the normal payload.

The destination remains the tutor/JEV workspace. The tutor teaches freely; the
primitive defines the assignment and legal scene actions; JEV observes the completed
exchange; the runtime commits scoped outcomes. Retire scripted control as its actual
entry points migrate. Preserve domain constraints and useful teaching content.

## Start from the implemented state

Read [S2 wiring and evidence](../tutor-reports/lesson-workspace-wiring-2026-09-19.md),
[the invariants](../../src/components/lumina/docs/TEACHING_WORKSPACE.md),
[retirement plan](07-sunset-scripted-tutoring.md), and [consumer census](07-census.md).
Preserve the uncommitted working tree; the completed slices are not necessarily commits.

- Counting Board `count` / `count_all` and Shape Sorter `identify` are wired in normal
  Kindergarten and scroll lessons. Eligibility currently requires an exact manifest
  mode, one objective, and a payload accepted by the adapter. Other modes retain
  their existing path. Do not assume the entire primitive catalog migrated.
- S0 census, S1 domain extraction and the two-mode S2 lesson wiring are implemented.
  Do not restart them. Shared-runner deletion has not happened.
- Mounted renderer tests cover both orders, Next/Back/Finish, single submission,
  objective attribution, interrupted feedback, inactive speech and reconnect.
  The recorded baseline is 191 frontend tests, 42 backend tests plus 7 subtests,
  and zero Lumina typecheck errors. Network submission boundaries were mocked.
- Final Shape Sorter real-audio journeys passed 3/3; Counting Board passed 2/3.
  These use real mounted components and the ordinary lesson protocol, not a full
  browser lesson. HUMAN-CHECKS #167 remains open for actual microphone/browser use.

## First slice: DONE 2026-09-19

[Repair and evidence](../tutor-reports/lesson-workspace-completion-repair-2026-09-19.md).
Both stalls were one mechanism: JEV choosing `correct` under the 0.9 threshold. Two
measured causes — a `correct` criterion that read as requiring the answer to be
restated, and Counting Board publishing `counted: 0` (objects marked, always zero for
a spoken answer) as a scene fact that contradicted the affirming tutor. Counting Board
54/54 and Shape Sorter 42/42 real JEV, 3/3 + 3/3 connected audio journeys. The shape
substep family still abstains by design; the open-assignment cue that covers it has one
live observation and is not certified. **Start from the following slice.**

The original brief for that slice follows, for the reasoning it records.

## Second slice: DONE 2026-09-19 — Number Train, five spoken modes

[Adoption and evidence](../tutor-reports/number-sequencer-teaching-2026-09-19.md).
Third adopter on the shared workspace, in the live host and in ordinary lessons.
Domain extracted (S1 shape), `teachingOwner: 'tutor'`, journey row on `workspace`
execution. Real JEV 42/42 new train cases with shapes 42/42 and counting board 54/54
unchanged; connected `--lesson-entry --audio` 3/3 on `before_after` and 3/3 on
`spot_error`. One shared `correct`-criterion sentence: a very short agreement that
names the expected answer credits the learner ("Yes, eight." scored 0.89 and stalled).

**The next slice is named there and is a SHARED gap, not a train one:** the ordinary
lesson shell has no learner-owned Try again / Next challenge, so a checked-wrong
manipulation locks the surface until an observer transition reopens it. That blocks
every gesture mode from lesson entry — number-sequencer `order_cards` is withheld on
it, and counting-board's gesture kinds have never been wired through a lesson for the
same reason. Give `LessonWorkspace`/`ManifestOrderRenderer` the controls
`LiveActivitySandbox` already has (`transport.learnerProgress`), then admit
`order_cards`; its binding, checker and tests are already in place.

## First slice (original brief): repair the observed completion stalls (LA-13)

Reproduce from the saved observations before changing prompts or lifecycle code.
Keep the two failure families distinct:

1. [Counting Board, run 3](../tutor-reports/counting-board-lesson-protocol-audio-2026-09-19.json):
   after wrong-then-corrected counting, the tutor says "Fantastic job counting all
   the blocks correctly!" JEV returns `none`, confidence 0.95; the assignment stays
   open and the journey times out. Replay the complete observation input and inspect
   verdict, feedback-completion and transition probabilities separately. That scalar
   confidence is not proof that JEV recognized a correct answer.
2. [Shape Sorter first audio batch](../tutor-reports/shape-sorter-lesson-protocol-audio-2026-09-19.json):
   final affirmation after an intermediate corners question can abstain. The optional
   `--final-after-substep` probe preserves a small semantic repro. Its saved
   [42/45 diagnostic](../tutor-reports/shape-sorter-lesson-jev-2026-09-19.json) ran a
   prompt candidate that was reverted. Reproduce against current code; it is not a
   current-prompt baseline. The unchanged-prompt [baseline passed 42/42](../tutor-reports/shape-sorter-lesson-jev-baseline-2026-09-19.json).

3. **The cross-domain reproduction (added 2026-09-20, di-word-reading).** This is now
   the clearest instance of family 1, and it removes the explanation letter sounds had
   offered. From [the sight-word batch](../tutor-reports/di-word-reading-workspace-sight_word-2-2026-09-20.json),
   with no fixture involved: the child reads `and` correctly, the prior tutor turn was
   "That sounds like a different word, let's try reading it together", the tutor says
   "You did it!" — and JEV returns `correct` at **0.86** (`none` 0.06, `incorrect` 0.08)
   with `advance` at 0.97. Under the 0.9 gate it is refused, the item stays open, the
   tutor's next turn is "..." and the run times out. `sight_word` is 0/3 for this reason
   alone. [The probe](../tutor-reports/di-word-reading-workspace-jev-shipped-2026-09-20.json)
   reproduces the same shape at 0.84 x3 (`wrong_then_corrected`).

   **Letter sounds attributed this to produced sound** — a tutor affirming a *sound* uses
   the same words as its own model of that sound. A printed word is a nameable token, so
   that explanation does not apply, and the abstention happens anyway. The shape that
   actually predicts it is **a bare affirmation naming no answer, after a turn in which
   the tutor corrected or modelled the target.** The control is in the same probe:
   `sight_no_restate` ("Perfect reading!") passes at 0.93-0.95 with no prior tutor turn.

   Two success-condition clauses were tried in the primitive's own layer and both
   reverted — one had no measurable effect, one lifted this case to the 0.90 boundary
   while dropping the plain affirmation case from 0.96 to 0.91. All three runs are kept
   beside [the report](../tutor-reports/di-word-reading-teaching-2026-09-20.md). The
   repair belongs in the shared criterion. Executor: `$add-live-tutor-tools`.

Also preserve the distinction from the earlier [browser cancellation defect](../tutor-reports/counting-board-browser-handoff-2026-09-19.md):
raw VAD cancelling observation was fixed. Do not assume every stall is the same bug
or restore raw microphone activity as semantic cancellation.

Find the responsible shared layer and make a bounded repair. Final affirmation can
complete an assignment without reciting its answer or a prescribed phrase. Praise
for a substep, an example supplied by the tutor, or a wrong final answer cannot.
Keep a final correct verdict separate from permission to advance when a question is
still open. Preserve speech's tutor-feedback authority and gesture's activity checker.
Do not add transcript regrading, primitive-specific phrase rules, forced corrections,
automatic miss-cap advances, or lower thresholds merely to pass a failing example.

Source map, relative to `my-tutoring-app/src/components/lumina/`:

| Layer | Files |
|---|---|
| Semantic observation | `service/typesafe/observeDialogue.ts` and its test; `components/live-activity/runtime/DialogueObserver.ts`, `dialogueContract.ts` and observer tests |
| Scoped progression/settlement | `components/live-activity/runtime/useTeachingWorkspace.ts`, `TeachingSession.ts`, `runtimeTransport.ts` and their tests |
| Actual lesson host | `components/live-activity/LessonWorkspace.tsx`, `lessonWorkspacePlan.ts`, `LessonWorkspace.test.tsx`; `components/ManifestOrderRenderer.tsx`, `KindergartenStage.tsx` |
| Normal submission | `components/live-activity/runtime/teachingEvaluation.ts`; `primitives/visual-primitives/math/CountingBoard.tsx`, `useCountingTutorController.ts`, `ShapeSorterTeaching.tsx` |

The observer route is `src/app/api/lumina/observe-dialogue/route.ts`. The old dev
route delegates to it. Ordinary websocket integration is in repository
`backend/app/api/endpoints/lumina_tutor.py` and `backend/app/services/live_runtime_tools.py`.
`runtime_lesson` plus `observe_runtime` already work; do not add a backend domain branch.

## Verify and retain the evidence

From `my-tutoring-app`, use unique output names rather than overwriting prior reports:

```powershell
node scripts/tutor-verdict-probe.mjs qa/tutor-reports/counting-board-follow-through-jev.json
node scripts/tutor-verdict-probe.mjs --shapes --final-after-substep qa/tutor-reports/shape-sorter-follow-through-jev.json
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/CountingBoard.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/ShapeSorter.runtime.test.tsx src/components/lumina/service/typesafe/observeDialogue.test.ts
npm.cmd run typecheck:lumina
```

Add the exact failed Counting Board observation to the semantic regression cases;
the current default probe does not contain that exact exchange. Retain the negative
cases for substeps, wrong praise, tutor examples, missing learner response and open
questions. Test stale/duplicate results, new words, interruption, playback drain and
single completion if the repair touches lifecycle code.

With frontend/backend running, from the repository root:

```powershell
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive counting-board --mode count --runs 3 --lesson-entry --audio --input my-tutoring-app/qa/tutor-reports/counting-board-runtime-count-payload-2026-09-19.json --output my-tutoring-app/qa/tutor-reports/counting-board-follow-through-audio.json
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive shape-sorter --mode identify --runs 3 --lesson-entry --audio --input my-tutoring-app/qa/tutor-reports/shape-sorter-runtime-identify-payload-2026-09-19.json --output my-tutoring-app/qa/tutor-reports/shape-sorter-follow-through-audio.json
```

Inspect each transcript, observer disposition and visible receipt. Help must execute
when requested; narration is not a scene change. `begin_help` with omitted targets
or `targets: []` already works; do not regress that fix. Retain failed runs and explain
retries. A disconnected service is an unrun gate, not a model pass. Reuse #167 for
human acceptance; do not close it from synthetic speech or mounted tests.

## Following slice: retire one replaced pilot path (LA-14 S3)

After the repair is verified, use the census to choose one mode and audit all its
callers: ordinary lessons, primitive helper/tester, bench and mixed-mode entry points.
Route remaining callers of that mode through the shared workspace before deleting
its old branch. Remove the obsolete scripted directives and assertions in that same
slice. Keep sibling-mode domain rules and working controllers until their replacement
is verified. Neither Shape Sorter `identify` nor Counting Board `count` proves the
other modes; do not delete the shared runner while other census rows still use it.

Deliver a report with exact supported entry points, before/after consumer references,
tests and connected results. Update LA-13 with the observer outcome, LA-14/census only
when migration state changes, and link the report here. Leave remaining experience
issues (including repeated openings/meta narration) explicit. No new persistence
design is needed for this slice; use `$student-data-loop` only if a necessary change
actually touches student-data semantics.
