# DI Bench run — 2026-07-20 (extraction step 1 runtime gate: useLiveVoiceTurns parity + DI-2 live)

Third live run; first on the extracted capture stack (`voiceTurnMachine` +
`useLiveVoiceTurns`, bench as pilot consumer). User verdict: "it got the
interruptions right and didn't mess up the run." **Gate: PASS.**

## Summary vs the 2026-07-19 probe run

| Metric | Probe (inline VAD, single threshold) | This run (hook, DI-2 dual threshold) |
|---|---|---|
| Items completed | 4/4 (with desync detour) | 4/4 clean |
| unanchoredVerdicts | n/a (detector didn't exist; 1 occurred) | **0** |
| turnsOverTutorAudio | 4 (≥1 was echo, chopped a cue) | 4 — **all real speech** (peaks 0.062–0.183) |
| Echo-opened turns | 1 (peak 0.033) | **0** |
| mean response / commit lag | 2,986 / 1,882 ms | **1,706 / 1,192 ms** |
| Verdicts | 4✓ 2↻ 2? | 4✓ 1↻ 1? |

## What this run proves

- **Hook parity:** the extracted turn authority drove a full run with the same
  bracket discipline as the inline loop (9 mic turns, 6 committed attempts,
  every sentinel anchored).
- **DI-2 dual threshold works on real hardware:** measured floors ambient
  0.0008 / echo residual 0.0082 — the barge-in bar (0.05) has ~6× margin over
  echo on this device, and every over-tutor turn was genuine speech. No cue
  line was chopped by echo this run (the probe run's n8 failure shape is gone).
- **Floors telemetry works** and immediately paid for itself: 0.0008/0.0082
  is the first calibration datapoint for the future auto-calibration beat.
- **Barge-ins judged correctly:** n7 deliberate interruption mid-"Listen:" →
  corrected; n60 "apple" answered early over the cue → affirmed + advance;
  n71 "Sam" over the cue → benign off-script (see quirk) then affirmed.
- **Judge-over-transcript again:** n84 ASR wrote "CM" for a spoken "Sam";
  Live affirmed from audio (alias cross-check disagreed — correctly counted
  as the 1 aliasDisagree).

## Residual quirk (engine input, benign here): mid-cue attempt consumes a cue fragment as verdict

n72 "Sam" arrived while the tutor was mid-cue ("This word is sam. —"); the
next output fragment "is sam." was classified as the pending attempt's
verdict → off-script → stay. Recovery was natural (cue continued, student
answered again, affirmed, complete) but the judgment buffer consumed script
text, not a verdict sentence. Fold into DI-1's engine work: verdict
classification should only consume tutor output that begins a NEW tutor turn
after the attempt closed, not fragments of an in-flight cue the attempt
interrupted.

## Disposition

Extraction step 1 (capture layer) is runtime-verified → commit. Next =
step 2, the judged-loop engine (voice-anchored attempts DI-1, mid-cue verdict
scoping above, resync re-cue, DI-3 arming, parameterized sentinels).
