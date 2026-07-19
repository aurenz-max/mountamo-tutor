# DI Bench run — 2026-07-19 (open-mic barge-in + echo probe, run JSON)

Second live run of the open-mic slice; this one deliberately exercised the two
paths the clean run (`run-2026-07-19-open-mic.md`) never triggered. Completed
4/4 items, but surfaced one real architectural bug and two tuning findings.
Summary: 8 learner turns, 4 affirmed / 2 corrected / 2 off-script,
`turnsOverTutorAudio` 4, alias agreement 5/6, mean response 2,986ms,
mean voice→heard 1,882ms.

## What the probe proved

- **Barge-in works end-to-end.** n21: a deliberate 2.7s talk-over (peak 0.219)
  opened a turn mid-cue, interrupted the tutor, was transcribed and judged
  (corrected → retry). n47: a /sss/ spoken over the tutor was heard and
  affirmed in-band from audio. The interruption + flush path is live-verified.
- **Echo leakage is small but nonzero.** Of 4 turns opened over tutor audio,
  ~3 were deliberate speech; **n8 was not** — a 260ms blip at peak 0.033
  (threshold 0.025) that interrupted the tutor and forced her to restart the
  cue line mid-sentence. AEC mostly holds; the residual sits just above the
  current threshold.
- **The phantom-commit guard held.** Sub-second blips (n8, n48, n50, n54)
  produced no judged attempts.

## Finding DI-1 (BUG, critical for the engine): verdict without pending attempt is silently dropped → state divergence

Sequence: n47 learner answers /sss/ over tutor audio → Gemini hears and
affirms ("Yes, sss.", n49) → **input transcription for the attempt never
arrives** → bench has no pending attempt → the sentinel is ignored → bench
stays on sound-s while the model believes s is done. Cascade: the model waits,
gets "Should we continue?" (n55), then **self-advances** — inventing and
speaking a [DI_ITEM] cue for sound-a including the bracketed metadata and the
judging contract read aloud (n56–n58, double script violation under desync).
The bench then judges the learner's "Apple" answers against sound-s and
finally **credits sound-s via "Yes, aaa." (n74)** — wrong-item credit.

Mechanism: the bench anchors attempts to *input-transcription arrival*, but
barge-in attempts can be judged by Live without a (timely) input transcript.
The local voice turn (n47) was the real attempt anchor and the bench already
had it. **Engine design rule: anchor attempts to local voice-turn close, not
transcript arrival; an in-window sentinel verdict with no transcript-backed
attempt must bind to the last unmatched local voice turn (or force a re-cue) —
never be silently dropped.** Off-script recovery should also resync: after N
consecutive off-script/unanchored verdicts, re-send the current item cue.

## Finding DI-2 (tuning, feeds the capture hook): barge-in needs a higher bar than silence-speech

The n8 echo blip (0.033) and real quiet answers (Sam = 259ms @ 0.084;
run-4 quiet /mmm/ ≈ 0.04) overlap in duration but separate cleanly in peak:
echo residual ~0.033, real speech ≥ 0.068 this run. A single threshold can't
serve both regimes — 0.025 opens on echo during tutor audio, but raising it
globally loses quiet productions in silence. **Design: dual threshold — the
turn-open threshold while tutor audio plays (barge-in) should be higher
(~2× the silence threshold; here ~0.05–0.06), matching human behavior: you
speak UP to interrupt.** Calibration beat should measure both floors (ambient
silence AND echo residual during tutor speech) and set both thresholds.

## Finding DI-3 (minor): pre-run stray attempt consumed the first cue line

n1: a stray "Good." transcript (voice from before the run started) became a
pending attempt; the tutor's own cue opener "This sound" was then classified
as its off-script verdict (n3, benign stay). Start-run should ignore attempts
until the first cue's model line has begun, or clear pending state on cue send.

**Detector added same day (user-confirmed the failure from their own run):**
the bench now logs an `unanchored: true` judge event + rose "unanchored: N"
summary count whenever a "Yes"/"My turn" sentinel arrives with no pending
attempt — the exact divergence moment, first-class instead of an absence.
In THIS run it would have fired at n49 ("Yes, sss."), 33 seconds before the
wrong-item credit became visible. Log-only; progression untouched (the fix
itself is the engine's voice-anchored attempt model).

## Disposition

Barge-in + echo probes are EXERCISED → HUMAN-CHECKS #30 struck. DI-1 and DI-3
are engine-design inputs (judged-loop engine slice); DI-2 is a capture-hook
design input (`useLiveVoiceTurns` calibration + dual threshold). None block
extraction — they shape it. Charter: `qa/HANDOFF-di-bench-2026-07-16.md`
§2026-07-18/19.
