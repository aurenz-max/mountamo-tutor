# Live model A/B — `gemini-3.8-live` vs `gemini-3.1-flash-live-preview` (production) — 2026-09-15

Question asked: does the new Live model have better continuity, and is there any measurable improvement?
Also: are async (NON_BLOCKING) tool calls usable for us. Everything below was exercised at runtime
against the real API. Sessions are nondeterministic; every number is a count over N runs.

SDK: `google-genai==1.16.1` (the pinned backend version) connected to `gemini-3.8-live` with our
exact production config (AUDIO, in/out transcription, context compression, session resumption)
without any change. `Behavior.NON_BLOCKING` and `FunctionResponse.scheduling` / `will_continue`
exist in this SDK version.

Lever added for this drive and kept: `LUMINA_LIVE_MODEL` (process env) overrides the model in
`backend/app/api/endpoints/lumina_tutor.py`. Default unchanged (`gemini-3.1-flash-live-preview`).
**RULING 2026-09-15 (user, after reading this report): "I wouldn't let a states-of-matter blocker prevent this… we move forward with this model." Default flipped to `gemini-3.8-live` in `lumina_tutor.py` the same session; the connect log line and the `gemini-connected` ledger event now carry `model=`. Rollback = one constant, or `LUMINA_LIVE_MODEL=gemini-3.1-flash-live-preview`. The empty-script gate (§3) becomes a watch item, not a gate. Acceptance drive on the new default through the user's :8000 backend: `states-of-matter` PASS, no findings, every beat spoke (the empty-script celebrate turn closed at 1.8s with transcript `...` — the watch-item behaviour, non-blocking). Report `states-of-matter-live-gemini-3.8-live-default-acceptance-2026-09-15.md`; ledger stamps `model: gemini-3.8-live`.**

## Verdict in one paragraph

3.8 is better at the two things we measured that matter for a child mid-lesson: it resumes a cut
utterance where it stopped instead of starting over, and it never tells the child the connection
dropped. It calls a declared tool when asked instead of inventing the tool's answer. Its turns are
shorter and end in fewer questions. Against that, it went silent on the last two beats of a
states-of-matter session in 2 of 3 runs (a stalled turn: one zero-width-space transcript chunk,
no audio, no turn end for two minutes), which 3.1 has never done across 3 dated reports plus today.
Over 6 runs the empty-script celebrate cue drew no real speech 4/6 (2 never-closing turns, 2 empty
turns); 3.1 is 0/10 on the same cue. It does not reproduce in isolation (0/10), so it depends on the
long production session. Recommendation: do not switch the default yet. Gate for a switch: an
empty-script cue added to the states-of-matter journey drawing speech 6/6 on 3.8 (or a backend guard
that never sends an empty scripted line), the DI judge bench already holds (§4: 0/56 false affirms, same as 3.1). The async-tool result is worth acting on regardless of
model: a SILENT function-response stream is a working silent context channel on BOTH models.

## 1. Continuity — forced mid-reply drop, real backend resume path

`lesson-resume-continuity` journey (`run_tutor_live.py`), one fault-drop per session
(`LUMINA_FAULT_DROP_EPISODES=1`, fresh backend per run), 3 runs per model. The switch cue arms
a 5s drop; the tutor is cut mid-sentence, the backend resumes with the handle and sends the
`[SESSION RESUMED]` steering text; the harness then asks "Wait, what were you just saying?".

| | gemini-3.8-live | gemini-3.1 (prod) |
|---|---|---|
| Harness verdict | PASS 3/3 (1 praise-inflation WARN) | PASS 3/3 |
| Re-greet / re-orient after resume | 0/3 | 0/3 |
| Told the child the connection dropped | **0/3** | **2/3** ("My connection dropped for a moment…", "My connection blinked out there for a second!") |
| Coherence answer paraphrases the cut thought | 3/3 | 3/3 |
| Words per turn | 15.7 – 22.7 | 31.3 – 32.3 |

The steering text says "never mention the disconnection". 3.1 breaks that rule in the coherence
beat 2/3; the harness forbid-list does not include "connection", so it passes anyway. Filed below.

Reports: `lesson-resume-continuity-live-lesson-gemini-{3.8-live,3.1-flash-live-preview}-run{1,2,3}-2026-09-15.md`.

**Multi-drop stress (accidental, kept because it is informative).** The first drive ran with
`LUMINA_FAULT_DROP_EPISODES=10`; the `[SESSION RESUMED]` text is itself cue-classified, so it
re-arms the drop and each session cascades. 3.8 sessions took 4/3/3 drops and still passed 3/3
with at most two repeated fragments. 3.1 took 9/1/0 drops: run 1 re-introduced the excavator
eight times in one beat, run 3 got no drop (vacuous). Reports:
`lesson-resume-continuity-live-lesson-gemini-{3.8-live,3.1-flash-live-preview}-2026-09-15.md`.

**Standalone resume (no backend), 3 runs each.** Cut the model ~2s into a slow count to twenty,
reconnect with the handle, send the production steering text.

| | 3.8 | 3.1 |
|---|---|---|
| Resumed the count where cut (±1 number) | **2/3** | **0/3** (restarted from "one" 3/3) |
| Re-greet anchors / tag spoken | 0/3 | 0/3 |
| Reconnect with handle | 0.51s | 0.32s |
| Cold connect | 0.39s | 0.27s |
| "What were you just saying?" summarised | 1/3 (2/3 re-performed the whole count) | 3/3 |

## 2. Async tool calls — NON_BLOCKING, WHEN_IDLE, SILENT, INTERRUPT

Standalone, 3 runs each. Script: scratchpad `live_smoke.py` (not committed).

**(a) Slow tool, delayed WHEN_IDLE response.** "Look up my sticker count; while you wait tell me a
joke; when it arrives tell me the number." Response sent 4s after the call with `scheduling=WHEN_IDLE`.

| | 3.8 | 3.1 |
|---|---|---|
| Called the tool | **3/3** (at ~0.6s) | **1/3** |
| Fabricated a sticker count without calling | 0/3 | **2/3** ("you have 5 stickers", "13!") |
| Kept talking while waiting | 0/3 (ended its turn, waited) | n/a |
| Spoke the result unprompted after the response | 3/3, 1.1s after | 1/3, 6.1s |

Neither model "talks over" a pending NON_BLOCKING call; 3.8 yields the turn and picks it up when
the response lands. That is the useful shape for us.

**(b) Streaming SILENT channel.** A NON_BLOCKING `watch_activity` tool called once at session
start (system-prompted). The client then pushes state as function responses with
`will_continue=True`: two `SILENT` updates (3 then 7 counters), then the child asks how many,
then a `WHEN_IDLE` event (frame filled), then an `INTERRUPT` event mid-count.

| | 3.8 | 3.1 |
|---|---|---|
| Called the tool at start | 3/3 | 3/3 |
| SILENT updates produced no speech | **3/3** | **3/3** |
| Knew the latest value (seven) when asked | 3/3 | 3/3 |
| WHEN_IDLE event → unprompted reaction | 3/3, 0.84s | 3/3, 0.67s |
| INTERRUPT event → `interrupted` flag seen | 2/3 | 1/3 |
| INTERRUPT reaction mentioned the event | 1/3 | 2/3 |

This is the finding to act on. CTX-1 (`1e613c0`) deleted `[CONTEXT UPDATE]` pushes because
`send_realtime_input(text)` has no silent mode; state now rides on the next message that asks for
a turn. A function-response stream IS a silent mode: state enters context, no turn opens, and
`WHEN_IDLE` gives an event the tutor voices only when the child is quiet. It works on the
production model today. Filed as a design item, not built.

## 3. Style and oracles — `states-of-matter` standalone journey, 3 runs each

| | 3.8 (batch A) | 3.8 (batch B) | 3.1 (prod, today) |
|---|---|---|---|
| Verdict | PASS with warnings | PASS (1 note) | PASS |
| No real speech on `correct_answer` | **2/3** (stalled turn, never closed) | **2/3** (empty ~1s turn, closed) | 0/3 |
| Silent on `all_complete` | 2/3 (same stalled sessions) | 0/3 | 0/3 |
| Quiet on the silent slider wiggle | 3/3 | 3/3 | 3/3 |
| Words/turn | 18.1 | 17.4 | 25.8 |
| Ends-with-? rate | 0.30 | 0.24 | 0.50 |
| Superlatives/turn | 0.03 | 0.10 | 0.13 |
| Answer-leak / guide-not-reveal | held | held | held |

**The stall, over 6 runs.** The cue is the harness's generic journey template,
`[ANSWER_CORRECT] Student answered "" for "". Celebrate: ""` (this content has no `targetAnswer` /
`narration`; the StatesOfMatter component sends no such cue itself). On 3.8 it drew no real speech in
**4/6** runs: batch A runs 2–3 sent one transcription chunk (U+200B) and then nothing, no audio, no
`turn_complete`, until the harness gave up at 60s and the client disconnected at 120s (the session's
`all_complete` beat died with it); batch B runs 2–3 returned a ~1s empty turn (49 KB audio, transcript
empty or U+FEFF) that DID close. 3.1: 0/3 today, 0/7 across the July 8, July 9 and Aug 7 reports. Isolated
reproduction (short session, same empty cue, tutor persona, 5 tries per model) did not reproduce: 0/5 and
0/5, and the well-formed cue was 0/5 and 0/5. Reading: the production prompt says scripted lines are the
only state changes the tutor narrates; given `Celebrate: ""` 3.1 improvises a celebration and 3.8 follows
the empty script literally, and in a long session that sometimes becomes a turn that never closes. Real
cues interpolate generator fields (`ReactionLab`: `Celebrate: "${currentChallenge.narration}"`) that can
also be empty, so the exposure is real but narrower than "the tutor goes silent at lesson end". The
never-closing turn is the part that matters for the floor gate (`wedged` watchdog).

Reports: `states-of-matter-live-gemini-3.8-live-2026-09-15.md`, `states-of-matter-live-gemini-3.8-live-b-2026-09-15.md`, `states-of-matter-live-gemini-3.1-flash-live-preview-2026-09-15.md`. Ledger: `backend/logs/lumina-sessions/2026-09-15-200257-lumina-tutor-8e4139052104.jsonl` (seq 90–92).

## 4. DI judge bench — `concept_statement` via `di-spoken-practice`

`--di-bench` on the four hand-authored fixture stimuli, 14 probes each, 3.8 today vs the 3.1
baseline of 2026-09-07. The gate is asymmetric: zero false affirmations in the REFUSE buckets.

| Stimulus | 3.8: agreed / missed valid / soft / no verdict | 3.1 (09-07) |
|---|---|---|
| ten-rod | 11 / 2 / 1 / 1 | 12 / 1 / 1 / 1 |
| equal-sign | 13 / 0 / 0 / 1 | 13 / 1 / 0 / 0 |
| repeating-pattern | 12 / 1 / 1 / 1 | 12 / 1 / 1 / 1 |
| growing-pattern | 12 / 1 / 1 / 1 | 12 / 1 / 1 / 1 |
| **False affirmations** | **0 / 56** | **0 / 56** |

The judge holds on 3.8: same zero false affirms, 48 agreed vs 49, one more missed-valid on
ten-rod, one fewer on equal-sign. Sentinel discipline ("Yes" / "My turn:") intact on every probe.
Reports: `di-spoken-practice-live-di-bench-bench-concept-*-2026-09-15.md` (the FAIL header on
those files is the generic oracles firing on bench transcripts plus the expected
`pack_gate_issues` label, same as on 09-07; the bench matrix section is the verdict).

## 5. Transcript artefact on BOTH models — owed an ear

In the standalone count test, 2/3 runs on EACH model ended the resumed turn with the output
transcription `Twenty-oneI'm just a language model and can't help with that.` Byte-identical
across models and runs. Two Gemini transcribers (the Live output transcription and
`gemini-flash-latest` over the saved WAV) both emit the phrase but place it after different
numbers, and the audio has continuous speech energy to the end, so it is not resolvable
without a human ear. WAVs: `qa/tutor-reports/audio/gemini-3.8-live-resumed-count-{refusal-tail,clean}-2026-09-15.wav`.
If it is spoken, it is a child-facing defect; if it is transcript-only, it can still reach the
DI sentinel scan and the misconception `observed` string (which is built from transcripts).

## 6. Queued (owning register `qa/di/BACKLOG.md`, see the 2026-09-15 rows)

1. ~~Decide the model switch~~ DECIDED: default flipped 2026-09-15 (user ruling). Watch item: empty-script cues (§3) — add the beat to the journey, or guard empty scripted lines in the backend.
2. Design item: silent state channel via a NON_BLOCKING tool stream (SILENT / WHEN_IDLE) — CTX-1 successor.
3. Harness: `LUMINA_FAULT_DROP_EPISODES>1` cascades because the resume steering text re-arms the drop; the resume-continuity forbid list lacks "connection"/"dropped"/"blinked".
4. Ear check: the refusal-phrase transcript tail (mic row).
