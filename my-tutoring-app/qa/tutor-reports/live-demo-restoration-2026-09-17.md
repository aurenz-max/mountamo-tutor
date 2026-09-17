# Restore the working live activity demo — 2026-09-17

User review rejected the connected runtime fixture as barely usable. This was a
regression in the promoted experience, not evidence of an ASR failure. The existing
Ten Frame sandbox still existed and should have remained the learner entry point.

## Confirmed causal path

- The runtime/live route rendered LiveRuntimeConnectedLab with runtimeFixture's
  synthetic text problems, replacing the actual manipulative and lesson setup.
- The runtime sandbox prompt explicitly refused spoken-answer judging. The fixture
  only created checked evidence when the learner submitted its answer form. The
  user's spoken wrong answer therefore triggered a request to use the form.
- The previous three Live journeys supplied already-checked fixture answers. They
  proved transport, not the missing voice-judging experience. The earlier Keep
  recommendation is withdrawn in the original report without deleting its evidence.
- Conversation rendering treated every transcription delta as a separate paragraph.

## Repair

The old runtime/live URL redirects to /lumina/live-activity, which retains the
existing real Ten Frame generation, automatic lesson opening and judged voice path.
The offline infrastructure lab links there too. The diagnostic source remains for
tests, labeled as such, and is no longer exposed as the live lesson page.

The real host groups transcription deltas by stream ID for display. LuminaAIContext
adds optional presentation metadata but retains every original event and content
chunk. This matters because useJudgedSpeechLoop consumes the append-only array by
index. Separate model turns, interruptions and typed messages remain separate.

No individual primitive or judged-runner implementation was changed in this repair.
Roadmap, handoffs and HUMAN-CHECKS #167 now record the user rejection and real-host
gate. The next adapter session must resolve React commit acknowledgement:
NumberLineControls.advance schedules state; the runtime currently assumes its
handler has committed synchronously. An immediate getState read cannot certify it.

## Verification

- 86 tests passed across 14 focused suites: existing live-activity host/runtime,
  real Ten Frame automatic-start regression, judged runner, transcript projection
  and route redirection. Frozen chunks from the reported question render as one
  utterance without mutating the source feed.
- Lumina typecheck passed. Full TypeScript diagnostics had no matches for the
  touched provider, playback hook, transcript or live route; unrelated repository
  diagnostics still prevent a clean full-repository typecheck.
- Actual Next responses: existing host returns 200 and contains Learn with Ten Frame.
  The old URL uses Next's streaming redirect (200 with refresh/redirect metadata
  targeting /lumina/live-activity); it no longer renders the synthetic task.
- Browser inspection was attempted again; computer-use transport is closed.
  Actual microphone, ASR, playback and visual acceptance remain unverified.
- [Three real-model Ten Frame judge runs passed](ten-frame-live-di-plain-2026-09-17.md):
  Grade 1 make_ten, the same seven generated items, 22 turns per run. All 21 wrong
  answers were corrected and all 21 right answers affirmed; no journey-oracle
  findings. Every transcript was read. No request to press Check answer occurred.
  Inputs were text, not microphone audio. This verifies the existing script/judge
  through the real backend, not the complete sandbox lesson or ASR path. A minor
  existing script grammar issue remains: “There are one counter.” It is outside
  this repair and the judge oracle's assertions.

Reproduction from backend:

    .\venv\Scripts\python.exe tests/tutor_live/run_tutor_live.py --component ten-frame --di --runs 3 --eval-mode make_ten --grade "Grade 1" --topic "Make ten: say how many more counters are needed"

This repair restores the established entry and transcript presentation. It does
not complete shared-runtime adoption, help/return on real primitives, or G1–G3.
