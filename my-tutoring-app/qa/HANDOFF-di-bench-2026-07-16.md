# Direct Instruction Bench handoff — 2026-07-16

This is a development-only proof of concept. It tests whether one Gemini Live
audio session can be controlled turn by turn by a separate JSON state reducer.
It is not a Lumina primitive and does not use the production spoken-word judge.

## The framework

The POC has four ownership layers:

| Layer | Owner | Responsibility |
|---|---|---|
| Transport | `LuminaAIContext` + `AudioCaptureService` | One Live audio/transcription session and a generic ordered `structured_state_update` channel. No DI semantics. |
| Reduction | `backend/app/services/di_turn_reducer.py` | Convert recent input/output transcripts into a constrained DI report. All transcript aliases and Flash-Lite prompt assumptions live here. |
| Protocol and authority | `diBenchModel.ts` | Parse the `di-bench` structured channel, reject stale/misaligned reports, and allow only an aligned `match` to advance. |
| Pedagogy and view | `diScript.ts` + `DirectInstructionBench.tsx` | Define items and exact I-do/we-do/you-do lines, send controller cues, render state, and export diagnostics. |

The websocket endpoint schedules the reducer beside the Live loop, but does not
contain the DI schema or grading policy. Shared Lumina receives opaque structured
events; a future bench can use another channel without adding another field to
`LuminaAIContext`.

## Turn contract

1. The bench sends one exact script cue to Live.
2. Live speaks and supplies output transcription.
3. The learner responds through the same open Live session; Live supplies input
   transcription and says only “Thank you.”
4. Flash-Lite reduces the completed transcript turn to a `di-bench` JSON report.
5. The frontend accepts a report only when its sequence is fresh and
   `attempted_item_id` equals the currently active item.
6. `match` advances; `retry`, `unclear`, and malformed outcomes remain on the
   same item. Tutor transcript mentions never advance state.

## Authoritativeness

The JSON report is authoritative for orchestration, not ground truth about the
learner's acoustic production. Its evidence is Live transcription. For isolated
sounds, ASR can lexicalize `/s/` as “shh”; the reducer therefore uses item-scoped
aliases and marks ambiguous aliases low-confidence. This is an explicit POC
limitation. A production phoneme assessment would require a separate audio-aware
judge and should be evaluated as a distinct architecture.

## Files intentionally in scope

- `src/components/lumina/components/di-bench/DirectInstructionBench.tsx`
- `src/components/lumina/components/di-bench/diScript.ts`
- `src/components/lumina/components/di-bench/diBenchModel.ts`
- `src/contexts/LuminaAIContext.tsx` — generic transport only
- `src/lib/AudioCaptureService.ts` — Live audio frames and level only
- `backend/app/api/endpoints/lumina_tutor.py` — scheduling/transport adapter only
- `backend/app/services/di_turn_reducer.py` — DI-specific backend policy

The Next `/api/lumina` route, Azure blend judge, Gemini clip judge,
`spokenWordJudge`, `useVoiceAnswer`, and `useVoiceCapture` are outside this POC.
They remain the existing production spoken-word path.

## Run and decision gate

Prepare Live audio, start a run, answer each prompt, and copy the run JSON. A
useful result must show:

- every learner attempt produces one fresh structured report;
- only an aligned JSON `match` advances;
- retries remain on the same item;
- Live follows the exact controller script and does not self-advance;
- reducer latency is acceptable for the lesson rhythm;
- the exported transcript makes low-confidence alias matches visible.

Do not promote this to a primitive until transcript-only sound grading is either
accepted as a product limitation or replaced by a separately validated
audio-aware authority.

---

## 2026-07-18 update — live-judged architecture + open-mic barge-in

**The reducer sections above are historical.** The Flash-Lite reducer layer was
deleted 2026-07-16 after run 1 of the live-judged rewrite PASSED
(`qa/eval-reports/di-bench-live-judged-2026-07-16.md`). Current architecture:
the Live tutor judges each attempt in-band from the audio it heard and reports
through sentinel openers in its own speech — "Yes," affirms, "My turn."
corrects. `diBenchModel.ts` classifies the sentinel and alone decides
progression (advance / retry / move-on after 2 corrections / stay on
off-script). Gemini's automatic VAD is disabled (`manual_activity`); a local
amplitude detector is the turn authority via activityStart/activityEnd (runs
3–4 tuned: threshold 0.025, hysteresis hold 0.6, 500ms silence close). The
ASR alias match survives only as a passive judge-agreement meter.

**This slice (2026-07-18): open mic, no force-mutes** (user ruling — memory
`feedback_spoken-mic-decoupled-from-tutor`, extended to the turn authority):

- **Echo gate removed.** The local VAD no longer refuses to open a turn while
  tutor audio plays; speaking over the tutor is native barge-in.
- **Barge-in wired end-to-end.** The backend now forwards Gemini's
  `server_content.interrupted` as `ai_interrupted` (`lumina_tutor.py`);
  `LuminaAIContext` flushes buffered playback on it, so the tutor audibly
  stops when the learner talks over her.
- **Cue pacing is re-entrant.** A queued cue fires only into silence — tutor
  quiet, learner not mid-utterance, no attempt awaiting judgment — and blocked
  cues re-fire on the audio-fall / voice-close / verdict edges. A cue
  pre-empted by an early answer is overwritten by the verdict's own next cue;
  after an off-script verdict the held cue re-elicits the current item.
- **Echo telemetry.** Mic turns opened during tutor audio are flagged
  (`duringTutorAudio`) and counted in the summary (`turnsOverTutorAudio`) —
  the speaker-run readout for AEC echo leakage.
- Verified: tsc 0 new errors, diBenchModel vitest 12/12, backend py_compile.
  **Not yet exercised live** — that is HUMAN-CHECKS #30 (rewritten for this
  architecture; run it on SPEAKERS, not a headset).

**Decision gate after the speaker run:** if `turnsOverTutorAudio` beyond the
deliberate interruptions is near zero and corrections aren't wasted on phantom
turns, the open-mic contract holds and extraction begins, in this order:
(1) capture hook (`useLiveVoiceTurns`: amplitude turn authority + a calibration
beat that samples the ambient floor AND the echo residual while the tutor
speaks), (2) judged-loop engine (generalize `diBenchModel` + cue pacing with
parameterized sentinels — scripted call-response activities, not open tutoring),
(3) DI primitive as first consumer (generator-backed items per
ADDING_PRIMITIVES; bench retained as the modality's measurement harness).
If leakage is high: calibration-above-echo-residual first, then the
WebRTC-loopback AEC workaround (play tutor audio via an RTCPeerConnection
remote stream so browser AEC is guaranteed to reference it).
