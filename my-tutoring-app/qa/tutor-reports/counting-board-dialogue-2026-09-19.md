# Counting Board dialogue observer trial - 2026-09-19

> The subsequent human browser session stalled. See the [browser handoff follow-up](counting-board-browser-handoff-2026-09-19.md). The passing journeys below used simulated playback and did not establish browser acceptance.

The development live host now uses the existing TypeSafe/JEV client to observe natural
feedback and invoke checked retry/advance. Gemini sees no retry/advance action tickets.
The assignment and actual learner selections accompany the conversation; tutor marks
are separate from learner work. The board checker, not praise, owns correctness.

## Final evidence

- Real JEV replay: **15/15** cases matched expected progression/abstention. Includes the
  user transcript, false praise/correction, readiness and explanation questions, silence,
  no answer, natural retry invitations and closing praise. See
  [replay](counting-board-dialogue-probe-disjoint-2026-09-19.json).
- Real Gemini audio + real JEV + mounted React board: **3/3 mechanical journeys completed**
  wrong spoken count, retry, corrected count, next item and final completion without
  tutor retry/advance calls. Learner speech used configured Azure synthetic PCM and actual
  Gemini transcription. No expected transcript/verdict was injected. See
  [audio journeys](counting-board-dialogue-audio-disjoint-2026-09-19.json).
- Actual DOM selections and handovers: **1/1 journey completed** through the same observer,
  including wrong selection, retry and two checked advances. See
  [selection journey](counting-board-dialogue-selection-2026-09-19.json).
- Observer HTTP latency in those four journeys: median **383 ms**, range **186?471 ms**.
- **Speech quality is not a clean pass:** one of the three spoken-count journeys emitted
  internal-looking notes in provider output transcription. All four progressed, but only
  three had clean transcripts under the added audit. See
  [separate progression/speech audit](counting-board-dialogue-audit-2026-09-19.json).
  The shared journey checker now catches these notes. No transcript filtering masks them.
- Deterministic checks: **137 frontend tests across 16 files**, **86 backend tests**, and
  Lumina typecheck at zero errors. The checks include actual mounted-board observer
  progression/visibility/finalization, selected objects versus tutor demonstrations,
  learner correction during pending JEV, explicit recovery after service failure,
  stale scope, interruption, audio drain, malformed outputs and contradictory verdicts.

## Limits and failed trials retained

Initial combined interpretation/verification questions over-abstained. Domain correctness
now stays deterministic and spoken verdict/transition confidence is independent. An early
live batch completed only 1/3 journeys; a harness race also submitted the second answer
before the new-task introduction. Final trials wait for that introduction. Earlier raw
reports remain in this directory; final results do not erase their failures.

The final shared rubric makes retry/advance/continued discussion mutually exclusive without
Counting Board phrase rules. Thresholds remain 0.9; this small replay set is not probability
calibration or evidence of learning effectiveness. New paraphrases may still abstain. The
learner has explicit retry/next controls as recovery. There are no mastery writes.

Browser paint and playback drain were simulated in the mounted live driver; actual hardware
microphone, real playback timing and human interaction are still to be tried. Verbal help
still uses the `begin_help` bookkeeping action. Demonstration/presentation tools remain.
This is a working progression experiment, not a claim that all tutor actions are tool-free.

## Try it

Open http://localhost:3000/lumina/live-activity, refresh, start a fresh Counting Board lesson
in Count all or Give me this many mode. Try a wrong response, then correct it; after the
tutor acknowledges success the next item should appear. Ask for explanation/readiness to
check that the observer waits. The timeline records verdict, transition and applied/abstained
status. Try again / Next challenge remain available for explicit learner control.

The normal backend on port 8000 runs with `--reload --reload-dir app`; it picks up the shared
transport changes. The private port-8001 verification server was not the user session.
