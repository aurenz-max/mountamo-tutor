# DI Bench — Live-Judged Architecture, First Browser Run (2026-07-16)

**Run:** 2026-07-17T00:29:44Z (local evening 2026-07-16) · human at the mic · 4 items (m, s, a-keyword, sam)
**Architecture under test:** `live-judged-two-branch-sentinel-with-frontend-progression-authority` — Gemini Live judges each attempt in-band from the raw audio it heard; affirmations begin "Yes", corrections begin "My turn"; the bench parses the sentinel (only while an attempt is pending) and alone decides progression. Backend reducer (flash-lite JSON judge) deleted the same day; the transcript alias match now runs as a passive cross-check only.

## Verdict: PASS — architecture validated on first run

| Metric | Value | Read |
|---|---|---|
| Learner attempts / verdicts | 5 / 5 | every attempt judged |
| Affirmed / corrected / off-script | 4 / 1 / **0** | she never left the two-branch contract |
| Judge-vs-alias agreement | **5/5** | includes one true rejection |
| Verdict latency after learner transcript | **~5 ms** | vs 800 ms+ with the deleted backend reducer |
| Mean response clock (tutor-quiet → learner transcript) | 3548 ms | includes human think time |
| Run length | 67 s, 4 items | correction→retry included |

## Key evidence

- **Honest rejection (the affirmation-bias test):** attempt 1 answered "moon" to *What sound?* → Live replied "My turn: mmm, as in moon. Your turn. What sound?" (`corrected`, aliasMatch=false, judge and cross-check agree). Retry "Mmm." → "Yes, mmm." → advance. Full Model→Test→Correct→Retest→Verify loop exercised end to end.
- **Zero dead air:** the verdict is the tutor's own next utterance, so judgment costs no silence. Learner transcript at 16343 ms; "My turn:" chunk at 16348 ms.
- **Sentinel parsing held** across chunked output transcription (69 tutor chunks); mid-script "Listen:" occurrences (model lines) caused no false corrections — the "My turn" sentinel choice and pending-attempt gating both did their jobs.

## Bug found in this run (fixed same day)

Duplicate event `n` (17/17, 25/25, …): `pushEvent` read `eventNRef.current` inside the `setEvents` updater; React batches same-tick pushes (tutor chunk + judge verdict), so both stamped the post-increment value. Fixed by capturing `n` before the updater. Also fixes duplicate React keys in the event table.

## Not yet exercised / next measurements

- **Corrections cap → move-on path** (`MAX_CORRECTIONS_PER_ITEM = 2`) — never reached; needs a run with repeated deliberate misses on one item.
- **Affirmation bias at n>1:** one honest rejection is a single sample. Bench a run of deliberate wrong/marginal answers (esp. /sh/ for the *s* item, where the transcript alias would falsely accept) — the alias-disagreement meter is the instrument.
- **Kid-echo during model/guide phase** — no echo events this run (adult tester); expect `off-script` log noise with a real 5-year-old, harmless by design.
- Raw run JSON retained in clipboard-export form by the tester; summary above captures all judged turns.

## Run 2 (2026-07-17T04:31Z) — PASS, latency decomposed

4 attempts, 4 affirmed, 0 corrections, 0 off-script, 4/4 alias agreement (cumulative 9/9). Duplicate-`n` fix confirmed (sequential numbering). Mean response 3104 ms.

**Tester-reported symptom:** first response "took ~13s, felt like audio wasn't coming through." Decomposition from timestamps: opening transcript chunks all arrive by 4.8 s but tutor *audio* plays real-time until ~10.4 s (transcript races ahead of speech); then 2.59 s from audio-fall to learner transcript (think-time + speech + Gemini VAD end-of-speech close + turn commit). Nothing dropped in-log — but the learner /mmm/ transcribed as weak-form "Mhm.", consistent with a low-energy nasal barely triggering VAD. **Suspected (uninstrumented): quiet first attempts may be silently lost when VAD never fires — no input transcript, no log entry.**

Levers identified — **all three applied 2026-07-17**, informed by Reflection's Interactive Coach write-up (client-side amplitude VAD as the article's core lesson):
1. **Gemini VAD tuning** — generic `audio_input` field on the connect payload (frontend `PrimitiveContext` → backend clamps → `realtime_input_config.automatic_activity_detection`). Bench requests `start_sensitivity: high`, `silence_duration_ms: 800`. Any surface can use it; nothing DI-specific in the backend.
2. **Local amplitude VAD telemetry** in the bench — article-style threshold detector on the mic-orb RMS frames (default ≥0.04, editable in UI with live RMS readout; 500 ms close, 120 ms min voice; gated while tutor audio plays to kill speaker echo). Emits `Mic · local` events; summary shows `local voice N (M unheard)` when local detections exceed Gemini-committed transcripts — the silent-loss detector — plus per-attempt `voice→heard` commit lag and its mean.
3. **Script trim** — model line now says the sound once ("Listen: mmm." not "Listen: mmm. mmm."), cutting tutor talk-time per item.

Escalation path if runs still show unheard attempts: disable Gemini automatic VAD and send explicit activityStart/activityEnd driven by the local detector (API supports it; not wired).

Next run watches: `unheard` count (silent-loss theory), mean `voice→heard` lag vs run 2's inferred ~2.6 s, whether HIGH sensitivity causes false turn-commits from breathing/room noise (if so, raise `silence_duration_ms` back toward 1200 or drop start sensitivity).

## Run 3 (2026-07-17T11:48Z) — Gemini auto-VAD FAILED both directions; manual activity signals shipped

Config under test: `start_sensitivity: high`, `silence_duration_ms: 800`, local VAD telemetry live (threshold lowered to 0.005 by tester). Tester report: "feels a little off."

**Finding 1 — Gemini VAD gates on speech-likeness, not energy (definitive).** Item /m/: five local utterances (peaks 0.055–**0.171**) → ONE Gemini commit, 14.5 s after the prompt. The ignored 0.171-peak hum was LOUDER than the instantly-committed "Apple" (0.146). No sensitivity setting can fix this: sustained phonemes don't classify as speech to Gemini's detector. Closes the tuning question.

**Finding 2 — HIGH sensitivity created phantom turns.** Two learner commits with NO local voice event: "hide" (62 ms after run start, stale audio) and "ठीक है।" (during tutor audio tail) — the second triggered an **unearned correction** on /s/ before the tester answered. Junk in both directions.

**Finding 3 — judge right when transcripts went multilingual.** ASR wrote hums as "음" (Korean) and "ssshh"; Live affirmed both from audio. Both alias "disagreements" were ASR failures, not judge failures. (Open question logged: was "ssshh" a genuine /s/ or the deliberate /sh/ probe? Tester to confirm — affects judge-quality ledger.)

**Fix shipped same day — manual activity signals (Option C):**
- `audio_input.manual_activity: true` → backend disables Gemini automatic VAD entirely (`AutomaticActivityDetection(disabled=True)`).
- New `activity_start`/`activity_end` client messages, routed through the audio queue (ordered with frames) → `send_realtime_input(activity_start/end)`. Context exposes `sendActivityStart/End`.
- Bench local VAD promoted from telemetry to **turn authority**: RMS ≥ threshold opens the bracket, 500 ms under it closes the bracket (which is what makes Gemini commit). Gated while tutor audio plays — echo cannot open a turn.
- **Phantom-commit guard**: any transcript with no backing local voice is logged `IGNORED (no-local-voice)` and never judged. Kills both run-3 phantoms retroactively.

Expected next-run deltas: unheard → 0 (a hum above threshold IS a turn), voice→heard lag ≈ 500 ms close + commit (vs 2.3 s mean), no unearned corrections. Watch: threshold calibration (tester's 0.005 may open turns on breath — default 0.04; RMS readout is the calibration tool) and onset clipping (~100 ms of audio before the bracket opens is dropped; irrelevant for sustained sounds, watch on "Sam").

## Run 4 (2026-07-17T12:22Z) — manual VAD VALIDATED

4/4 affirmed, 0 corrections, 0 off-script, **0 unheard, 0 phantoms**, 4/4 alias agreement. voice→heard 940 ms mean (was 2307), response clock 2500 ms mean (was 6370 — now mostly human think-time), 50 s total for 4 items. Tester: "this was much better!"

**Artifact found:** first /mmm/ logged `commitLag 31ms` with no mic event — the hum sat AT the 0.04 threshold and flapped micro-brackets (each under the 120 ms log floor); Gemini committed off one. Benign this run, but bracket spam is what a quiet child would generate constantly. **Fixed same day: hysteresis** — bracket opens at the threshold, holds down to 60% of it.

**Voice-stack ruling now settled for DI:** Live judges from audio (sentinel branches) + client amplitude VAD brackets turns (manual_activity) + phantom-commit guard. Remaining judge-trust items: deliberate /sh/-for-/s/ probe (both "Shh."/"ssshh" affirms so far are unconfirmed — tester must knowingly produce /sh/), move-on cap path, kid voices. Next architectural slice: pure `diEngine.ts`.

**Pacing fix (same day, after run-4 tester feedback "affirmation gets stepped on / feels rushed"):** the bench was sending the next item cue at sentinel-classification time — i.e. while the tutor was still speaking "Yes, mmm." (run 4: verify at 14.29s, next model line at 15.07s). New text mid-utterance truncates/crowds the affirmation, and the affirmation is the learner's payoff. Fix: verdict cues (advance/move-on/complete) are now QUEUED and released on the tutor-audio falling edge + 400 ms beat (`VERIFY_BEAT_MS`), with a 5 s failsafe if the verify audio never registers. Corrections need no queue (she re-asks in the same breath). Needs a browser run to confirm the felt pacing. Known residual: the display card still flips to the next letter at verdict time, during the spoken verify — display-flip-on-cue is a diEngine-level refinement.

## Context

Same-day refactor: deleted `backend/app/services/di_turn_reducer.py` + DI hooks in `lumina_tutor.py` (backend is a DI-agnostic transport again; only surviving backend diff is enabling input/output transcription). Reverted `structured_state_update` channel from `LuminaAIContext`. 12/12 vitest on `diBenchModel.test.ts`; `typecheck:lumina` 0 errors. Next architectural slice per discussion: extract pure `diEngine.ts` (phase machine, correction procedure, review scheduling, mastery records).
