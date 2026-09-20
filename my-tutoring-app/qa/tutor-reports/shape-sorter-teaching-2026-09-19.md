# Tutor/JEV principles and the Shape Sorter naming pilot

The user selected Shape Sorter identification to prove reuse beyond Counting Board.
The implementation remains inside `/lumina/live-activity`, a development bench.
Normal student lessons and persisted mastery are outside this slice.

## Counting Board map and latest sitting

The current architecture is tutor-owned conversation, JEV whole-assignment
observation, and runtime-owned outcome commits. Earlier reports describing an
English-number parser, source-answer interpreter, scripted live corrections, or
tutor retry/advance tools are historical. The definitive map, ownership table,
TW-1–TW-11 principles, and adoption matrix are in
[TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md).

The latest user sitting at 19:02–19:05 UTC completed seven Counting Board items
(4, 6, 7, 8, 5, 9, 10). Seven accepted advances reached visible receipts; five
observations abstained; final runtime state was completed. Noisy transcripts
included `sex` for six, `A` for eight, and mixed-language row counting for ten.
This is consistent with the user's positive report, scoped to this sitting.
[Compact transcript/state evidence](counting-board-session-map-2026-09-19.json).
The provider also emitted `<!-- silence -->` after completion; logs alone do not
establish audible speech, and this is not a clean transcript-quality claim.

## Second binding

- `ShapeSorterTeaching.tsx` binds existing generated naming items to the shared
  `useTeachingWorkspace`. It does not create a new teaching planner or state machine.
- `shapeSorterDrawing.tsx` extracts the unchanged SVG geometry used by both controllers.
  The gold ring identifies the assignment. Purple dashed rings mark whole objects
  for tutor comparison without changing that assignment or submitting an answer.
- The scene publishes stable target ID, shape, rotation, color, sides, corners,
  alternate accepted names, and other visible shapes. Student-facing content does
  not print the shape name before a response. Side-count/color praise is not naming success.
- The live adapter opts out of the old catalog DI scaffold and advertises `identify`
  only, for K/G1. Count, sort, and real-object tasks remain available standalone;
  they are not advertised by this live pilot. Timed presentation, rotation, moving,
  sorting, side/corner highlighting, and detour artifacts are not implemented here.
- Supported tutor actions are `begin_help` and `demonstrate`/clear. Retry, advance,
  response attribution, sounds and final summary reuse the shared observer lifecycle.
  Practice attempts stay session-local, with no legacy evaluation submission.

## Shared defects exposed by adoption

1. The mounted journey did not pass the resolved session mode. It ran the old
   Shape Sorter controller even though the browser selected the new one. The generic
   mount protocol now requires `evalMode`; Python forwards the actual requested mode.
   The journey row derives names and wrong answers from the primitive's real item
   builder, including IDs expanded from a single challenge. No backend domain branch.
2. Finalizing speech changed action revisions even when only `pendingResponse`
   changed. Audio tool calls selected just before the final transcript consequently
   received stale refusals. Two mounted-host regression cases failed on the old code,
   one each for Counting Board and Shape Sorter. Runtime now publishes conversational
   context without invalidating unchanged tutor action scope. New words still cancel
   pending JEV, verdicts check exact response IDs, and scene/evidence/assistance changes
   still invalidate old tickets. Old commands are never retargeted.
3. The generic demonstration description assumed all learners selected objects.
   It now describes whole-object tutor marks without imposing a selection task on
   spoken naming. It explicitly withholds unregistered part highlighting.

## Verification

- **322 tests / 27 files passed:** live host/runtime/observer, Counting Board, both
  existing execution families (TenFrame/Number Line), and Shape Sorter legacy script/runtime.
  The actual-host naming case covers whole-task metadata, intermediate side praise,
  wrong answer/retry, multilingual correction, held success with an open question,
  diamond/rhombus alias, fixed target versus tutor marks, stale commands, no cue scripts,
  two success sounds and settled summary. New-word/interruption and VAD/playback cases
  run against both surfaces. Network decisions/audio hardware are mocked in these tests.
- **42/42 real JEV cases passed** (14 cases × 3 repetitions), through the shared
  server observer: multilingual/noisy speech, intermediate sides/color, comparison
  shape praise, wrong-name praise, open questions, help/example/no learner, and alias.
  [Raw requests, results and probabilities](shape-sorter-tutor-verdict-2026-09-19.json).
- `npm.cmd run typecheck:lumina`: zero errors.
- Shared observer-service unit tests: 11 passed; backend live runtime/activity/session
  suites: 87 passed (`venv/Scripts/python.exe -m pytest tests/tutor_live/test_live_runtime_tools.py tests/tutor_live/test_live_activity_tools.py tests/test_lumina_tutor_session_units.py -q --disable-warnings -p no:cacheprovider`, from `backend`).
- Connected model/audio results are recorded below; they do not substitute for a
  human microphone/visual sitting. Browser inventory exposed no controllable browser.

Commands (frontend cwd except Python):

```powershell
npm.cmd test -- --run src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/CountingBoard src/components/lumina/primitives/visual-primitives/math/ShapeSorter.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/__tests__/ShapeSorter.di-script.test.ts src/components/lumina/primitives/visual-primitives/math/TenFrame.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/NumberLine.runtime.test.tsx
npm.cmd run typecheck:lumina
node scripts/tutor-verdict-probe.mjs --shapes
backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive shape-sorter --mode identify --runs 3 --startup --audio --input my-tutoring-app/qa/tutor-reports/shape-sorter-runtime-identify-payload-2026-09-19.json --output <distinct-report-path>
```

Saved generation contains triangles/squares, yielding two naming items through the
existing cross-challenge deduplication gates. The journey uses the first two generated
challenges, with real geometry/item construction; it does not inject a successful verdict.

## Connected results and failed runs retained

**Final Shape Sorter: 3/3 full real-audio journeys passed.** Synthetic learner PCM
through Gemini Live, actual provider transcription, real JEV, real mounted component,
runtime, and rendering shell. Every run requested help and a demonstration, committed
visible tutor marks without a learner attempt, withheld success for the wrong name,
accepted the correction, opened a fresh shape, then reached settled completion.
Both advances had visible receipts; no tutor retry/advance calls and zero mastery writes.
All tutor transcripts, JEV dispositions, and action receipts were inspected.
[Final evidence](shape-sorter-workspace-audio-guidance-2026-09-19.json).
Paint and audio-playback hardware were simulated; learner audio/provider recognition
were real. This is an engineering smoke gate, not human microphone acceptance.

Earlier trials remain for diagnosis:

| Evidence | Actual outcome |
|---|---|
| [Initial audio](shape-sorter-workspace-audio-2026-09-19.json) | Speech synthesis unavailable under sandbox network access; also revealed the missing-mode harness path. |
| [Text trial](shape-sorter-workspace-text-2026-09-19.json) | Two backend reload/handshake failures; third failed to demonstrate. |
| [First connected audio](shape-sorter-workspace-audio-verified-2026-09-19.json) | Stale demonstration tickets before the scope fix; one mechanically completed run also had internal-looking provider transcription. The filename is not a pass claim. |
| [After scope fix](shape-sorter-workspace-audio-final-2026-09-19.json) | 2/3 full passes. One tutor claimed highlighting without executing it; failed as required. |
| [After demonstration guidance](shape-sorter-workspace-audio-guidance-2026-09-19.json) | 3/3 full passes. Guidance names the actual whole-shape action and requires its visible result before a claim. |
| [Counting Board full regression](counting-board-action-scope-audio-2026-09-19.json) | Failed the requested-demonstration gate: no visible demonstration. This is unresolved model/tool-choice reliability, not a stale command success. No global teaching-quality pass claimed. |
| [Counting Board progression regression](counting-board-action-scope-progression-2026-09-19.json) | 1/1 real-audio wrong-answer/correction/fresh-item/completion journey passed after the scope fix; two visible observer advances and zero mastery writes. This deliberately excludes the failed demonstration gate above. |

The final naming conversations sometimes used leading side/corner questions. Whether
those explanations build recognition and transfer requires a child sitting; no learning
effectiveness claim follows from fluent conversation or successful progression.

## Remaining scope

Human Shape Sorter browser/mic/teaching acceptance is open under
[HUMAN-CHECKS #167](../HUMAN-CHECKS.md). Try a wrong name, ask for help and a visible
comparison, answer a side-count subquestion, then name the shape. Confirm a purple
ring never changes the gold-ringed assignment, and a correct final name advances
after feedback while an explanation question keeps the same item.

Next bounded work: resolve any second-surface experience failures before another
adopter; then replace reliance on the tutor's `begin_help` bookkeeping with an explicit
observed-assistance contract. Until then `assisted: false` means no recorded assistance,
not proven independence. Preserve the separate planned-lesson order gate; do not infer
production integration, learning effectiveness, or open-ended rubric support from this pilot.
