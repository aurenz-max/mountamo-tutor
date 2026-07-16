# HANDOFF — Direct Instruction Bench (2026-07-16)

Charter + run protocol for the **Direct Instruction (bench-first)** workstream
(WORKSTREAMS.md stream 3). Code-complete this slice; the next action is a human
browser run (HUMAN-CHECKS #30).

## Why this exists

User direction 2026-07-16: before going all-in on a DI primitive, validate
"I do, we do, you do" **from the tutor's perspective** — the Azure detector
layered ON TOP of the Gemini Live tutor, tightly enough that the judge verdict
provably conditions the tutor's next utterance. Today's coupling is loose:
verdicts reach the tutor as hand-built `[SPOKEN_BLEND_MISS]`-style strings fired
as independent side-effects, and ReadAloudStudio detects "model finished" with a
2s transcript-idleness timer.

## What was built

**`di-bench` dev panel** (home card 🎯) — Voice Studio-style bench:

- `src/components/lumina/components/di-bench/DirectInstructionBench.tsx` — beat
  engine + instrumentation UI.
- `src/components/lumina/components/di-bench/diScript.ts` — item pool
  (m/s/a/f continuous sounds + sam/mat words), script lines, DI persona,
  fidelity scorer.
- `src/contexts/LuminaAIContext.tsx` — new optional
  `PrimitiveContext.tutoring` override: a caller can install a custom tutoring
  scaffold (here: the DI script-executor persona) without a catalog entry.
  Primitives are unaffected (`?? componentDef?.tutoring` fallback).
- Registered in `DevPanelRouter` (`'di-bench'`) + `IdleScreen` card.

**The loop per item:**

1. **I do** — `[DI_MODEL]` cue → tutor speaks "This sound is mmm. Listen: …".
2. **We do** — `[DI_GUIDE]` "Say it with me: mmm." (+ optional unscored echo
   capture window).
3. **You do** — `[DI_TEST]` "Your turn. What sound?" → mic opens **only after
   the tutor's audio graph drains** (`isAudioPlaying` true→false edge) →
   `useVoiceAnswer` (Azure dual-signal → flash-latest ladder) judges.
4. **Verify / correct** — `match` → verify line; `no-match` → correction line +
   retest (max 2); `unclear`/silence → neutral re-ask, never a correction.
   Failed items re-enter the queue 3 positions later (delayed retest).

**Two modes** (the core experiment):
- **Scripted** — engine authors every line; tutor is a voice actor. Measures
  timing + verbatim compliance (fidelity % + extra-token count per beat).
- **Informed** — the judge verdict is injected as `[JUDGE_VERDICT] …` and the
  tutor authors its own verify/correction line per the DI directives. Measures
  whether the tutor "gets it".

**Instrumentation per beat:** cue→first-audio ms, audio duration, script
fidelity (token coverage + extras), heard text, ladder outcome, judge engine +
latency + escalation, student response ms. Copy-run-JSON exports everything.

## How to run

1. `cd backend && uvicorn app.main:app --reload` and
   `cd my-tutoring-app && npm run dev`. `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`
   must be in `my-tutoring-app/.env.local` (existing spoken-judge setup).
2. Lumina home → **DI Bench** (🎯). Tap the mic orb once (permission gesture).
3. **Start run** (defaults: scripted mode, open mic, m/s/a + sam enabled).
4. Play the student: correct answers, deliberate wrong answers (say "sss" for
   m), and silence — all three correction paths should fire.
5. Repeat in **Informed** mode.
6. **Copy run JSON** → save as `qa/di-bench/run-2026-07-16.md` (fenced block).

## Decision gates (the go/no-go for the DI primitive)

| Gate | Question | Signal in the run |
|---|---|---|
| G1 Phoneme judgeability | Do isolated continuous sounds (mmm/sss/aaa) produce reliable `match`/`no-match`? | test-beat outcomes + judge engine column; try judge-ref variants in the item editor if Azure whiffs. This is the LetterSpotter-class question — sounds, not letter names. |
| G2 Script fidelity | Does the Live tutor speak scripted lines verbatim? | fidelity ≥90% with ~0 extras across model/guide/test/verify beats; watch for greeting-freelancing. |
| G3 Loop latency | Is cue→audio + judge fast enough for DI's 10–20s response rhythm? | mean cue→audio (aim <2s) + judge ms (Azure ~400ms, escalation ~2s). |
| G4 Informed-mode compliance | Given a [JUDGE_VERDICT], does the tutor produce a DI-legal next line (confirm ≤3 words / re-model + re-test; never "no"/"wrong")? | informed-mode transcripts, human-judged. |

**GO (G1–G3 pass):** PRD the DI Lesson composite (block-sequencer skeleton per
the Deep Dive pattern, deterministic due-item queue 80/20, item-grain
latency + expanding-interval state feeding evidence up as normal attempts —
NOT a parallel selection heuristic vs IRT) as a Lesson Builder fill mode.
**G1 fails after reference-text iteration:** start the DI strand map at
whole-word reading (already benched via PhonicsBlender) and park sound-symbol
until a dedicated phoneme bench matures. **G4 fails, G1–G3 pass:** ship
scripted mode only — the engine authors all lines; still a full DI loop.

## Known caveats

- The backend still queues its standard greeting on connect; the bench waits
  for audio to drain before beat 1. If the greeting rambles, that's persona
  data too (log it, don't fight it).
- `stopRun` flushes waiters; mid-run GoAway/resume is untested on the bench —
  if a resume fires mid-beat, expect one distorted row, not a hang.
- We-do echo capture opens AFTER the guide line (echo, not true choral) —
  simultaneous choral capture vs AEC is a later bench question.
- 3 pre-existing `LuminaAIContext` tsc errors (AudioCaptureService typings) are
  baseline, not this slice.
