# DI Bench run — 2026-07-21 (extraction step 2 runtime gate: judged-loop engine)

Fourth live run; first on the full engine stack (`useJudgedSpeechLoop` +
`judgedLoopModel` + `useLiveVoiceTurns`). User verdict: "I think this worked
even better." **Gate (HUMAN-CHECKS #33): PASS.**

## Headline: the DI-1 failure recurred — and the engine absorbed it

n39–n41: the learner's retry answer for sound-s produced a local voice turn
(0.9s, peak 0.134) whose **input transcription never arrived** — the exact
transcript-loss that desynced the 2026-07-19 probe run into model
self-advance and wrong-item credit. This time the attempt existed from the
voice-turn close (DI-1 voice anchoring), so "Yes, sss." **bound to it and
advanced normally**: no desync, no unanchored verdict, and the judge event
correctly carries no aliasMatch (transcript-less attempts are excluded from
agreement stats). The summary shows it as micEvents 6 vs learnerEvents 5 —
one unheard-but-judged attempt. The failure mode is now a non-event.

## Gate items

- (a) **Normal loop unchanged** — 4/4 items; cue → answer → sentinel →
  advance/retry; verify lines played out whole. Mean response 2,048ms,
  voice→heard 1,703ms.
- (c) **Off-script at quiet worked** — n76 "Salem?" drew a non-sentinel tutor
  reply ("sam. Your turn. What word?" — the model re-modeled without the
  "My turn" opener, a mild script deviation); the engine waited for
  sentence + quiet and logged off-script → stay at n81 (~2.4s after the
  audio fell). Next attempt "Seam" was affirmed from audio → complete.
- (f) **0 unanchored verdicts.**
- Barge-in/echo still clean: 3 over-tutor turns, all real speech (peaks
  0.088–0.272); floors ambient 0.0026 / echo 0.0009 — AEC fully suppressing
  echo on this device this run.
- (b) early-answer-with-late-sentinel, (d) resync re-cue, (e) no-verdict
  timeout were **not triggered** this run — their failure preconditions never
  arose (which is itself the right outcome). All three are unit-covered
  (judgedLoopModel 13/13); they stay as watch-items for future runs rather
  than gate blockers.

## Notes for the DI primitive (step 3)

- The judge remains permissive per design: "Seam" (ASR) was affirmed from
  audio — alias disagreement logged (3/4 agreement this run). Mastery-side
  strictness stays an aggregate concern (2PL gates), not per-turn.
- The tutor's correction line occasionally drops the "My turn:" opener on
  RE-corrections (n77). Off-script handling absorbs it, but the primitive's
  tutoring block may want a directive reminder that EVERY correction begins
  "My turn:".

## Disposition

Engine runtime-verified → commit (engine + bench pilot + this report).
Next = extraction step 3: birth the DI primitive as the engine's first real
consumer (generator-backed items, `/primitive` L0, curriculum fit).
