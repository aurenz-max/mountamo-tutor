# DI Bench run — 2026-07-19 (open-mic slice, first live exercise)

Source: user-pasted backend log (`lumina_tutor`), user verdict "it did great."
Architecture: live-judged sentinels + manual local VAD, **echo gate removed**
(open mic, no force-mutes) + `ai_interrupted` barge-in plumbing — first run
after the 2026-07-18 slice.

## Result: clean 4/4 pass through the full script

| Item | Cue fidelity (output transcription) | Learner (input ASR) | Verdict |
|---|---|---|---|
| sound-m | exact script | "Mmm." | "Yes, mmm." — affirmed |
| sound-s | exact script | **"Shh."** | **"Yes, sss." — affirmed from audio** |
| sound-a (keyword) | exact script | "Apple" | "Yes. Apple starts with short a." — affirmed |
| word-sam | exact script | "Sam" | "Yes, sam." — affirmed |

- Script obedience: every [DI_ITEM] spoken verbatim; greeting brief; [DI_COMPLETE]
  cue sent and started ("That's the…" — client disconnected mid-line, benign).
- Manual VAD: 4 clean activity_start/activity_end bracket pairs, one per answer;
  **zero phantom turns** — no activity brackets that didn't correspond to a real
  learner answer, and no turns opened during tutor speech visible in the log.
- Sentinel discipline: no non-verdict line began with "Yes"/"My turn"; the bench's
  cue cadence (cue → answer → verdict → next cue) held for all four items with no
  cue stepping on a verify line.
- **The sound-s row is the architecture's thesis demonstrated live**: ASR
  lexicalized the sustained /s/ as "Shh." (alias-match territory at best), but the
  Live judge affirmed from the audio it actually heard. Transcript-only judging
  would have been wrong or unsure here.

## NOT exercised in this run (visible in the log)

- **Barge-in:** the backend's "Gemini generation interrupted by user activity
  (barge-in)" line never appears — no `ai_interrupted` was forwarded, so the
  learner never spoke over the tutor mid-line. The interruption path
  (activityStart during generation → tutor stops → playback flush) remains
  live-unverified.
- **Echo leakage on speakers:** zero turns opened over tutor audio is the ideal
  reading IF the run was on speakers with volume up; the log cannot distinguish
  speakers-with-good-AEC from a headset. `turnsOverTutorAudio` from the copied
  run JSON (or a deliberate probe) is the real readout.

Residual = one ~2-minute probe: speakers up, deliberately talk over the tutor
mid-line (she should stop within a beat and judge the attempt), and let her
speak uninterrupted once to read "over tutor audio: N". Tracked as the narrowed
HUMAN-CHECKS #30.

## Backend log oddity (non-blocking)

Session metrics report `Interactions: 797, Turns: 789, Voice: 784` for a
4-answer run — the counters increment per audio frame/message, not per
pedagogical turn. Cosmetic; worth fixing whenever the metrics block is next
touched.
