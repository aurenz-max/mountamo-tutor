# Counting Board: record the tutor's spoken verdict

## Follow-up: whole-assignment grounding (18:49 user session)

The user's next session exposed partial-step praise being recorded as final success:
eight bears in the first row of an 18-bear board became a checked correct answer.
The checked state then stopped accepting new spoken answers, leaving the final
18-answer exchange attached to the stale eight-response record.

The observer now receives the original assignment, expected final answer from the
primitive's item, and preceding tutor turn. Its verdict applies to the whole assignment.
Intermediate row/group praise and affirmed totals that conflict with the expected
answer remain ungraded. A final total consistent with the task can be recorded and
advanced normally. The inspector displays the assignment and expected final answer.
The original transcript-parser gate remains removed.

Verification after this correction: **244 tests / 26 files passed**, zero Lumina
TypeScript errors, and **51/51 real JEV cases passed** across three repetitions.
The new host regression drives first-row eight, second-row eight, final eighteen,
then the next challenge through completion and checks sound/attempt ownership.
The model probe also covers bare praise after a subquestion, a falsely affirmed total,
and final success followed by an explanation question.
[Current model evidence](counting-board-whole-answer-final-2026-09-19.json).
An ambiguous recount invitation is allowed to remain ungraded or be recorded as retry;
neither disposition awards success. The audio evidence below predates this correction.

## Original tutor-first change

The user reported `fünf` and `ocho` being rejected by the source-answer parser even
though the live tutor affirmed five and eight. That parser prevented the dialogue
observer from running. Speech now opens a pending learner turn; JEV observes the
tutor's completed feedback against the current assignment and workspace. The
browser records the verdict and its accepted transition atomically. Gesture answers
retain their activity checker.

The separate `interpret-response` route, source-span interpreter, Counting Board
English-number parser, and their obsolete tests/probe are removed. There is one
semantic observation call per completed exchange. The live tutor does not call
record-answer, retry, or advance tools. The inspector distinguishes learner context,
the exact JEV model input, option probabilities, raw model confidence, and the
runtime disposition.

## Verification

- **243 tests / 26 files passed** across live activity, Counting Board, and the
  dialogue decision service. The actual host tests exercise multilingual/noisy
  transcripts, even a contradictory transcript paired with affirmative tutor
  feedback, playback settlement, cancellation, and completion. They assert two
  success chimes, the completion chime, and the actual PhaseSummaryPanel. JEV and
  audio hardware are mocked in those host tests.
- **33/33 real JEV replays passed**, three repeats each of German, Spanish, noisy
  transcript, contradictory transcript, explicit/indirect retry, help, examples,
  encouragement, correct-with-open-question, and no learner turn.
  [Inputs and model results](counting-board-tutor-verdict-probability-2026-09-19.json).
- **3/3 real audio journeys passed**: synthetic learner PCM through Gemini Live,
  actual provider transcripts, real JEV, mounted Counting Board and shared runtime.
  All three reached two visible advances and settled completion; no tutor
  retry/advance calls and zero legacy mastery submissions. Two runs recorded the
  tutor's incorrect verdict; one left ambiguous guidance ungraded before accepting
  the next answer. [Complete traces](counting-board-tutor-primary-audio-probability-2026-09-19.json).
- Lumina's scoped TypeScript gate passed with zero errors. The full repository
  typecheck still reports its existing non-Lumina backlog.
- Relevant backend runtime/session suites: 76 passed.

## Additional defect found in the live run

For “That's it, there are five blocks in total!”, JEV returned a 0.91 probability
for correct and a separate 0.87 confidence score. Requiring both to exceed 0.9
discarded clear feedback. Decisions now use selected-option probability >= 0.9
and the existing winning-margin check; raw confidence remains diagnostic. The
captured values are a deterministic regression test. This is an operational
threshold, not a calibrated accuracy claim.

Earlier failed audio traces remain alongside the final evidence. They include a
development-server reload (WebSocket 1012), an obsolete driver assumption that all
wrong-answer guidance must produce a grade, and the duplicated confidence gate.
The driver now requires no success credit for the wrong answer, allows guidance
to remain ungraded, then still requires accepted correction and both advances.

## Limits

These are session-local practice judgments, not persisted mastery evidence. JEV
now checks tutor feedback against the full assignment's expected answer, but this
semantic classification is not independent grading of the learner's original audio. A finalized learner
turn is still required for attribution. The real-audio harness simulates browser
paint/playback hardware; human browser, microphone, and speaker acceptance remain
unverified. Assistance bookkeeping still depends on `begin_help`.

The implementation and invariants are documented in
[Teaching Workspace](../../src/components/lumina/docs/TEACHING_WORKSPACE.md).
