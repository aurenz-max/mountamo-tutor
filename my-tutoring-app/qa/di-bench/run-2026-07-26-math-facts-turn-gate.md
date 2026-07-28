# DI sitting 2026-07-26 — di-math-facts, the turn gate ate the answers

**Surface:** `di-math-facts` pack (standalone tester), `fact_review`, 5 items, kindergarten.
**Outcome:** hard decoherence, twice. Root cause found, fixed, **not yet re-driven live.**

## What the learner experienced

Two sittings, same shape. The tutor models a fact, the child answers **correctly**, the
tutor affirms — and the surface never advances. The tutor then goes silent (its contract
says *"After you affirm, wait silently for the application's next instruction"*), the
client sits in `judging` / "Listening…", and nothing recovers. Prompted with "continue",
the model **authored the application's own next message** and spoke it aloud, bracket
label and all:

```
[CONTEXT UPDATE] The student's current state has changed:
  challengeType: fact_review
  display: 4 + 1
  ...
[DI_ITEM] Speak exactly: "Listen: four plus one is five. ..."
```

It could do that because every context update ships the full `facts` list, and the
`[DI_ITEM]` template had been repeated verbatim four times. The ban on speaking bracket
labels is in the system instruction (`catalog/di.ts`) and lost anyway at ~15 turns' depth.

## Root cause: `minVoiceMs` silently meant "three capture frames"

`AudioCaptureService` runs `createScriptProcessor(4096)` — one `micLevel` update every
**85.3 ms** at 48 kHz. `voiceTurnMachine` samples once per update, and `durationMs`
spanned *first above-bar frame → last*, which drops the closing frame's dwell:

| frames of speech | real audio | measured | vs. `minVoiceMs: 120` |
|---|---|---|---|
| 1 (noise blip) | 85 ms | **0 ms** | rejected ✓ |
| 2 ("five", "four") | 171 ms | **85 ms** | **rejected ✗** |
| 3 ("Continue") | 256 ms | 170 ms | accepted |

Every duration in the run was 81, 89, 169, 170 or 173 ms — two frames or three, nothing
else representable. So a one-word answer was rejected as a sub-minimum blip **while its
`activityEnd` had already gone to Gemini**: the judge heard it, transcribed it, affirmed
it, and the client refused to own the turn. The verdict landed as `unanchored-verdict`,
which every pack dropped through `default: return`.

Peak does not separate the two populations — a rejected turn (0.0452) was louder than two
accepted ones. Only the frame count ever differed.

### Why the bench never caught it

`run-2026-07-24-math-facts-probe.json` has identical config (`minVoiceMs: 120`,
`silenceThreshold: 0.025`) and **three** mic turns: **179, 172, 170 ms** — three frames
each, ~50 ms of margin, out of 10 items loaded. `unanchoredVerdicts: 0` in that summary is
three coin flips landing the same way, not a working gate. The sentence-reading probe
(850–3670 ms turns) could never hit it: reading a sentence is 10–43 frames.

**Exposure is the single-word response class** — di-math-facts, di-letter-sounds,
di-word-reading. Only di-sentence-reading was structurally safe.

## Evidence (run log, 108 events)

```
unanchored 2 · phantoms 2 · belowMinVoiceCloses 2 · offScript 2 · moveOns 0 · cuesStalled 0
```

Both drops identical:

```
11935  learner  voice-close   89ms  peak 0.0452  belowMinVoice: true     → no attempt
12156  learner  phantom-transcript "five"                                 → Gemini heard it
12682  judge    unanchored-verdict affirmed                               → dropped
```

Second finding: at seq 55 the client recorded **affirmed / score 100 against `0 + 5`** on a
transcript of `"four"` — the child answering the *model's* fabricated `2 + 2`. Two correct
answers discarded and one item marked mastered from an answer to a different problem.

## Fixes landed

1. **Frame period is plumbed, not guessed.** `AudioCaptureService.getFramePeriodMs()` →
   `LuminaAIContext.micFramePeriodMs` → `VoiceTurnConfig.framePeriodMs`. The close event
   gains `voicedMs` (`durationMs` + one frame) and `belowMinVoice` reads it.
   **`minVoiceMs: 120` is unchanged** — it now measures what it always claimed. A caller
   that supplies no period gets `voicedMs === durationMs`, i.e. the old behaviour.
2. **Retro-anchor.** A verdict arriving with no attempt is rebuilt from the learner's
   unanchored trace (a sub-minimum blip and/or a phantom transcript) inside
   `retroAnchorWindowMs: 4000` and emitted as a normal verdict with `retroAnchored: true`.
   A sentinel with *no* trace behind it is still `unanchored-verdict` — spontaneous tutor
   speech is never laundered into a judgment.
3. **Observability** (same day, earlier): `onVoiceTurnClose` now fires for `belowMinVoice`
   closes — the field was unreachable before, which is why this took two sittings to see —
   and a cue ledger (`onCue`, `cuesStalled`) separates "verdict never arrived" from "cue
   never sent".

Engine-level, so all four packs are covered without pack edits.

**Gates:** 1011 tests / 94 files pass; `typecheck:lumina` 0 errors.

## Open

- ~~**Not runtime-verified.** Needs one live sitting: expect `unanchored 0`,
  `retro-anchored 0`, `voiced ~170ms` on one-word answers, and a `move-on` flag where the
  correction cap is due.~~ **VERIFIED 2026-07-26 (same-day user mic run):** all four numbers
  hit exactly — unanchored 0 / retroAnchored 0 / voiced 165–254ms on one-word answers
  (durations 80–169ms = the very population the broken gate rejected) / `move-on` flagged at
  the cap, first `[DI_MOVE_ON]` ever fired live, run coherent to recap. See
  `run-2026-07-26-math-facts-turn-gate-verify.md` (+ run JSON).
- **Watchdog** — after each drop nothing recovered for 30 s until the user intervened.
  The verdict tick only runs while an attempt is open; there is no timeout on
  "item cued, nothing happened".
- **`facts` in RUNTIME STATE** — hands the model the whole remaining item list, which is
  what made the `[DI_ITEM]` fabrication possible.
