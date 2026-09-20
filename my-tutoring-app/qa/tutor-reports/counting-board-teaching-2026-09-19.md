# Counting Board: tutor-owned teaching verification

**Superseded for audio acceptance by the [user-session follow-up](counting-board-audio-followup-2026-09-19.md).**
The text-only journeys below missed state delivery to voice turns and missing
provider transcript-final flags. Source-answer checking is now automatic; tool-based
progression still has observed omissions. Do not read these earlier passes as a
working microphone tutoring experience.

Date: 2026-09-19. Scope: the development live activity host, same Counting Board
renderer, existing Gemini Live connection and runtime transport.

The implemented change and invariants are in
[TEACHING_WORKSPACE.md](../../src/components/lumina/docs/TEACHING_WORKSPACE.md).
This is an executable architecture slice, not certification of a finished tutor.

## Deterministic checks

- Frontend: 23 files / 211 tests passed for Counting Board, the live activity host
  and runtime, and the TenFrame/NumberLine runtime regressions. A subsequent focused
  run after adding the completed-audio integration regression passed 33 tests
  across two files (one additional test; 212 unique tests across the combined scope).
- Backend: tutor-live plus session units passed 119 tests. After extracting and
  testing the empty-final-transcription packet boundary, session units passed 56
  tests (one additional test; 120 unique tests across the combined scope).
- `npm.cmd run typecheck:lumina`: zero errors. `git diff --check` for the changed
  tracked implementation files: clean.

Coverage includes repeated wrong handovers with no miss-cap advance, learner work
preserved during demonstration, strict command parameters/scope/deduplication,
checked-success progression, assisted retry and fresh-item state, all ten board
kinds, timed-stimulus readiness and replay, final receipt before completion, and
speech-tail settlement. Completed learner audio is assembled from provider chunks;
a numeric prefix that becomes a question cannot be graded. The same shared hook
also runs a nonnumeric color-selection test.

Commands from `my-tutoring-app`:

```powershell
npm.cmd test -- --run src/components/lumina/primitives/visual-primitives/math/CountingBoard src/components/lumina/components/live-activity src/components/lumina/primitives/visual-primitives/math/TenFrame.runtime.test.tsx src/components/lumina/primitives/visual-primitives/math/NumberLine.runtime.test.tsx
npm.cmd run typecheck:lumina
```

Backend scope: `python -m pytest tests/tutor_live tests/test_lumina_tutor_session_units.py -q -p no:cacheprovider`.

## Real-model journeys

The driver mounted the actual React board, teaching hook, runtime, surface and
transport in JSDOM. It used the real backend WebSocket and live model. Hardware,
authentication and persistence are harness seams; model decisions and actual DOM
demonstration marks are not mocked. Natural prompts include “Can you help me?” and
“Can you show me what you mean?”; they do not specify tool names.

| Mode | Result | Raw evidence |
|---|---|---|
| `give_me_n` | 3/3 interaction journeys passed; all 15 tool receipts visible | [handover runs](counting-board-teaching-give-2026-09-19.json) |
| `count` | 3/3 final interaction journeys passed; all 24 tool receipts visible; no detected script/stage-direction leakage | [counting runs](counting-board-teaching-count-final-2026-09-19.json) |

Each journey exercises help, visible demonstration without a submitted answer,
a wrong response, retry, assisted success, a fresh second item and completion.
Some model turns advance spontaneously after checked success; otherwise the harness
uses natural learner continuation prompts. This is not evidence of autonomous
lesson startup or of a child learning the concept.

Reproduce from `backend`, with a development backend serving the current code:

```powershell
python tests/tutor_live/run_live_runtime.py --primitive counting-board --mode give_me_n --backend ws://127.0.0.1:8001 --runs 3 --input ../my-tutoring-app/qa/tutor-reports/counting-board-runtime-give_me_n-payload-2026-09-19.json --output ../my-tutoring-app/qa/tutor-reports/counting-board-teaching-give-2026-09-19.json
python tests/tutor_live/run_live_runtime.py --primitive counting-board --mode count --backend ws://127.0.0.1:8001 --runs 3 --input ../my-tutoring-app/qa/tutor-reports/counting-board-runtime-count-payload-2026-09-19.json --output ../my-tutoring-app/qa/tutor-reports/counting-board-teaching-count-final-2026-09-19.json
```

## Failures retained and quality limits

- The [first journey](counting-board-teaching-first-2026-09-19.json) exposed a final
  `superseded` receipt: completion raced visibility. Completion now registers behind
  the runtime's visible-response boundary; deterministic and real-model reruns pass.
- An [earlier counting run](counting-board-teaching-count-2026-09-19.json), run 2,
  spoke a separator and “Wait for student response.” Its original mechanical PASS
  did not detect this quality failure. The leakage check now rejects it and generic
  live guidance says to stop and listen rather than read stage directions. The
  three final runs were clean on this check; this is not a guarantee across sessions.
- Teaching quality remains uneven. Several corrections simply propose counting
  again. Handover run 3's “finish picking the rest” can imply tutor marks count toward
  the learner's selection; they do not. Counting run 1 similarly hands over at the
  “next” block. These are semantic clarity issues despite correct runtime behavior.
- Objects currently have identities, labels, groups and selection state, not geometric
  coordinates. Spatial phrases such as “far left” are not verified by the journey.
  Richer scene grounding and learner-facing dialogue review are needed before claiming
  reliable spatial teaching.
- Live journeys use text/simulated utterances. The bridge now preserves the provider's
  finished flag and empty final chunk, with deterministic coverage; real microphone
  delivery, recognition and interruptions still require acceptance testing.
- No browser surface was available through computer-use. No screenshot/visual or
  human microphone acceptance is claimed. No live startup-generation journey,
  combined planned lesson, or real-model run of the other eight modes was performed.
- Assistance is local evidence, and verbal-help accounting depends on the tutor
  calling `begin_help`. There are no student-data writes or mastery claims.

The next proof should be a short observed learner session and one additional real
primitive using this shared contract. Adapter-count growth is not an acceptance test.
