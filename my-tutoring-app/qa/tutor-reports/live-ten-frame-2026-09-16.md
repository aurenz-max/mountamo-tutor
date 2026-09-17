# Full Ten Frame lesson in the Live Activity demo

The demo now opens as **Learn with Ten Frame**. One Start lesson click connects
Live and sends a hidden lesson-start intent after session-ready. Gemini requests
the real `ten-frame` primitive through the existing generator. Make Ten is the
default; build, subitize, decompose, teen composition/decomposition, and operate
are selectable. Grade choices match the primitive's K–2 contract.

## Ownership and startup

The actual TenFrame component and its existing judged DI runner are reused.
Its preparing and mounted tool responses are silent, preventing an improvised
tool-result introduction from competing with the scripted opening. A correlated
server `activity_ready` receipt enables the component's optional automatic start.
It waits for the active instance, connection and microphone, starts exactly once,
then follows the existing response/correction/progression/complete flow. Other
TenFrame consumers retain manual start by default. The generic number-line advance
tool cannot advance a Ten Frame lesson.

The sandbox still has no EvaluationProvider: no real student mastery or curriculum
records are written. Optional direct visuals and number-line tools remain under a
disclosure; direct-visual prompt buttons are also collapsed. A microphone status
message explains the remaining action if capture is not available.

## Verification

- **82 frontend tests passed** across sandbox orchestration, visual/number-line
  contracts, TenFrame automatic activation, its existing capture regressions and
  DI script contracts. The new component test uses the real runner and a mocked
  speech-loop boundary: it waits for focus/microphone, emits one opening cue, then
  queues the next real item after a verdict. The sandbox test verifies that mount
  alone cannot start DI; only the matching server handoff can.
- **15 backend tests passed**, including silent TenFrame handoff and rejection of
  number-line advance commands against it.
- Real generator produced **seven Make Ten items**, with no dropped challenges or
  DI pack-gate issues. Three real authenticated backend/Live sessions used this
  same generated fixture and all completed its seven items and closing cue.
  Every run began from the automatic lesson-start message, called the expected
  tool, waited for the DI handoff, corrected the deliberately wrong answer `ten`,
  accepted the correct complement, and continued through the remaining items.
  Opening, asks, correction and affirmations matched production DI strings after
  punctuation/case/numeric normalization. All transcripts were reviewed; no
  unprompted topic menus, bracket tags, or premature answers appeared.
- Raw evidence: `live-ten-frame-2026-09-16.json`. The fixture was generated once
  through `/api/lumina/live-activity?probe=1`, which returns the production DI plan
  for the same payload. The harness simulates browser receipts and sends text
  student answers; React interaction/progression is verified separately.
- `/lumina/live-activity` serves HTTP 200 with the new title and Start lesson UI.
- TypeScript has no diagnostics in changed files; 770 pre-existing diagnostics
  remain elsewhere in the repository.

The static tutor audit reports three warnings because it does not follow this
primitive's shared runner: dynamic state bag, no direct sendText calls, and tags
not emitted directly in the component. The real pack resolves `challengeType`
and `stimulus`, and live runs confirm the runner's production cue path. No HIGH
finding was confirmed. Initial live connection attempts encountered a backend
reload; the successful runs were made after it recovered.

## Human check still needed

Open a fresh session, press Start lesson, allow the microphone, and answer the
first problem without another Start click. Verify actual audio capture/playback,
that the screen follows spoken verdicts, and that a wrong answer produces a
correction before progressing. The automated text drives do not establish ASR,
child speech recognition, VAD, or browser playback quality. Kindergarten hands
mode and the other selectable lesson modes retain their existing DI behavior;
the new full live session drive covered Grade 1 Make Ten.
