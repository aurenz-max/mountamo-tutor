# Counting Board browser handoff follow-up

The previous 4/4 result covered model/runtime journeys with simulated playback. It
did not establish that the actual browser handoff worked. The user's subsequent
session stalled again; those earlier results must not be treated as browser acceptance.

## Session evidence

`backend/logs/lumina-sessions/2026-09-19-170910-lumina-tutor-04c99bf927da.jsonl`:

- Provider recognized `1 2 3 4 5` and finalized it.
- Tutor said “Fantastic job counting all five blocks correctly!” and ended its turn
  at 17:09:44.168 UTC. No dialogue-observation result was recorded.
- Microphone activity started at 17:09:45.475, 1.307 seconds later, and remained open
  until 17:10:18.323. This signal alone does not prove a new meaningful learner turn.
- Three equivalent activity requests repeatedly cancelled generation before mounting.

Replaying the exact learner/tutor words with reconstructed five-block assignment
metadata produced `advance`, confidence 0.95, in 430 ms. This establishes that the
phrase can classify correctly; it does not reconstruct the missing browser timing.
See [exchange replay](counting-board-user-exchange-replay-2026-09-19.json).

## Confirmed code defect and fix

Raw microphone activity called `DialogueObserver.learnerStart`, which erased buffered
tutor speech and cancelled pending JEV. If it arrived during playback drain, JEV was
never called; if it arrived during classification, the result was discarded. Both
paths could silently leave a checked-correct board on the same item.

The host no longer treats raw VAD as semantic input. Recognized learner words and
provider-confirmed interruption still invalidate pending decisions. Playback now
notifies the runtime directly from the audio-source drain callback rather than relying
on a React `isAudioPlaying` effect. Observer waiting, start, skip and cancellation are
recorded alongside final results; backend logs include compact runtime state changes.
Equivalent pending generation requests keep the original job and mount receipt.

This cancellation race is consistent with the real session, but the old logs did not
capture browser drain/request timestamps, so they cannot prove which cancellation
branch occurred. The added telemetry removes that diagnostic blind spot.

## Verification

`LiveActivitySandbox.observer.test.tsx` mounts the real host, board, runtime, observer
and playback hook under React StrictMode. Only network and audio hardware are replaced.
It exercises real source `onended` callbacks, duplicate provider turn-end messages,
microphone activity during audio drain and during delayed JEV, plus actual new words
and interruption. Both noise cases advance to seven visible objects; both genuine
cancellation cases retain the current board and report cancellation.

A test-only Vite transform reinstating the old host microphone-start handler made
both noise cases fail: one never called JEV, the other stayed on c1. The transform
was removed; it never changed the running Next.js application.

- 124 focused frontend tests pass (15 files; 122 plus two cancellation regressions).
- 87 backend tests pass, including generation-request deduplication.
- Lumina typecheck: zero errors.
- No accessible browser was available through computer-use tools. Actual human
  microphone/playback acceptance remains unverified; do not label this browser-tested.
