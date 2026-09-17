# TenFrame shared-runtime pilot — 2026-09-17

Implemented in the existing `/lumina/live-activity` lesson, as requested. The real
TenFrame, voice judge, automatic opening and conversation layout remain the learner
experience. The synthetic runtime fixture is still diagnostic only.

## What changed

- The shared judged runner opts into runtime ownership, cue holds, suspension,
  replay and completion after model turn-end plus audio-tail settlement.
- TenFrame publishes its actual item, phase, checked evidence and placed/flipped
  cells. It offers a text counting reminder, replay and an operation-appropriate
  prepared worked example with return. The judge continues to own progression.
- Help preserves the mounted frame, cancels pending attempts/timers and ignores
  abandoned verdicts. Return waits for both its visible receipt and settled speech
  before the runner re-asks the same task. Successful runner-owned tools use silent
  responses, avoiding a second competing tutor turn.
- The generic model tool copies one scoped action ticket; it no longer has to copy
  five correlated identity fields. Old tickets remain stale rather than retargeting.
- Planned TenFrame completion uses a short activity closing cue and reports one
  completion only after speech settles. Number-line has not been migrated here.

## Verification

Final [real-model report](ten-frame-runtime-live-2026-09-17.json): **3/3 passed**.
Each run used the first two items of one [real generated Grade 1 make-ten payload](ten-frame-runtime-payload-2026-09-17.json).
The Node driver mounted the actual TenFrame, judged runner, speech hook/reducer,
runtime, surface and transport in React/JSDOM. Actual Live model transcripts went
through the real verdict parser; no checked verdicts were injected.

Each journey: automatic opening → wrong answer “eleven” corrected without advance
→ visible counting reminder → visible six-plus-four example → same eight-counter
task restored and re-asked once → “two” affirmed → fresh seven-counter item → “three”
affirmed → closing → exactly one completion. All nine tool receipts were visible;
simulated-paint receipt waits were 34–64 ms. Runs took 72–75 seconds. Those are
harness timings, not microphone-to-help latency or browser paint measurements.
All final transcripts were reviewed: no Check-answer demand, leaked protocol tags,
duplicate return narration or invented hint animation.

Automated regression gate: **244 frontend tests across 25 files**, **33 backend
tests**, Lumina-scoped TypeScript check clean. Real-component tests cover pending
voice judgment, late verdict rejection, preserved frame DOM/work, mid-build timer
cancellation, return turn ending before paint, StrictMode, stop during closing,
planned completion and withholding help during a committed gesture judgment.

Both localhost frontend entry routes and the normal backend HTTP endpoint return
200. Live runs used an isolated backend on port 8011 to avoid a development reload
closing a test connection. The temporary backend is stopped after verification.

Earlier failures remain recorded: [service restart](ten-frame-runtime-service-restart-2026-09-17.json),
[before scoped tickets](ten-frame-runtime-before-tickets-2026-09-17.json), and
[before speech handoff fencing](ten-frame-runtime-before-speech-handoff-2026-09-17.json).
They exposed real scope-copying and return-timing defects, now covered by targeted
tests and the three final journeys.

## Limits and the next sitting

**Browser/microphone acceptance is pending.** Browser control returned `Transport
closed`. The drive simulates input voice boundaries, playback completion and paint;
it does not test acoustic recognition, audible interruption, touch feel or pixels.
It mounts the real primitive and shared engine; separate host tests substitute
widgets. No student learning records were written.

Open `/lumina/live-activity`, select **Make ten / Grade 1**, and start the lesson.
Give a wrong spoken answer, use **Help me start**, then **Show an example**, then
**Return to my task**. The original counters must return; answer correctly and
finish. Also try Pause microphone and End session during tutor speech.

Subitize help is withheld. A committed gesture retains ownership until its verdict;
only mid-build help is certified for that response style. Other modes and reconnect
during help need separate live checks. Both planned activity orders and number-line
adoption remain open under roadmap G1–G3 and HUMAN-CHECKS #167. This pilot does not
authorize broader primitive migration or claim independent mastery after teaching.

Decision: **keep the shared integration for this bounded TenFrame pilot; await the
user's microphone/experience verdict before expanding.**
