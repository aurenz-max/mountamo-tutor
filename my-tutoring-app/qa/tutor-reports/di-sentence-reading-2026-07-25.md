# Tutor Test: di-sentence-reading — 2026-07-25 (L2 scaffold)

Birth-cert follow-up **#2 struck**. The pack reached L2 on its birth day, hours
after L1.

## What L2 actually added

This pack is the family's exception: it already shipped a catalog `tutoring:`
block **at birth**, because di-letter-sounds' L2 slice had built the family
lesson-mode wiring that resolves both connect paths from the catalog — so
putting it there cost nothing and made lesson mode work day one. L2 therefore
added exactly what birth deliberately left out:

| Added | Why it could not ship at birth |
|---|---|
| `contextKeys: [challengeType, text, wordCount, sentences]` | nothing populated RUNTIME STATE yet |
| `{{challengeType}}` in `taskDescription` | **an unfilled `{{key}}` renders SILENTLY** — the placeholder could not ship before its key existed |
| 5 `commonStruggles` | needed the bench sitting + two live runs to describe *observed* behaviour |
| generator `sentences` flat summary | populates RUNTIME STATE from the first auth-time prompt |
| component `updateContext` effect | keeps RUNTIME STATE truthful as sentences advance |

The **bench-proven `aiDirectives` are untouched, byte for byte**, as are the cue
lines and judging contract in `diSentenceReadingScript.ts`. Sentinel discipline
was re-checked on all the new copy: no struggle response or scaffolding line
begins with "Yes" or "My turn", so the engine's sentence-scoped verdict scan can
never see a phantom opener.

## contextKeys — the sibling difference worth recording

di-math-facts deliberately keeps its ANSWER (`answerWord` / `solvedDisplay`) out
of RUNTIME STATE: the tutor already receives it inside the `[DI_ITEM]` judging
contract, and RUNTIME STATE is echoed far more loosely than a scripted line.

**That reasoning does not transfer here, and the difference is not an oversight.**
The printed sentence is simultaneously the stimulus and the target — the tutor
must have it to model it, and the child is already looking at it. There is no
answer side to withhold, so every key is legitimately shareable.

## Results

### Tier 1 (static) — PASS, 0 HIGH

2 WARNs, both the **identical pair di-letter-sounds and di-math-facts carry**.
They are the DI family's SHAPE, not defects:

| Finding | Why it is structural |
|---|---|
| `data-bag-unparsed` | DI connects through `ctx.connect` + `updateContext`, not a `useLuminaAI` bag the static auditor can parse |
| `no-sendtext-moments` | DI pedagogy rides `[DI_ITEM]` / `[DI_MOVE_ON]` / `[DI_COMPLETE]` through the judged-loop engine, so the tutor **structurally cannot go silent** — the condition this check exists to catch is unreachable here |

`contextKeys` and `templateVars` were both read correctly by the auditor
(`challengeType` / `text` / `wordCount` / `sentences`; template var `challengeType`).

### Tier 2 (probe, real generated content) — PASS on 3 modes

`decodable_sentence`, `sight_phrase_sentence`, and `read_sentence` @ G1.
**`probe.findings: []` on every run**, and all four keys resolve with real,
mode-correct values:

```
RUNTIME STATE:
  challengeType: decodable_sentence
  text:          The red hen ran.
  wordCount:     4
  sentences:     The red hen ran. | The pig can dig. | The dog is hot. | Sam has a red cup.

RUNTIME STATE:
  challengeType: sight_phrase_sentence
  text:          Here it is.
  wordCount:     3
  sentences:     Here it is. | We can go up. | My ball is red. | You and I can go.
```

Note the `sentences` summary tracks the pinned MODE's pool — the L1 ladder and
the L2 context are consistent with each other, which is the thing that would
break first if the two layers had drifted.

**The 5 `(not set)` strings in the response are confined to
`staticPromptPreview`** — the Tier-1 rendering, which by construction has no
generated content to fill keys with. Verified by walking every string field in
the payload: zero occurrences anywhere in the probe section.

## Gates

- `npm run typecheck:lumina` — **0 errors**
- `npm test` — **936/936**

## Tier 3 (live behaviour) — rides HUMAN-CHECKS #54

No new human gate was created. The new struggle copy is exercised by the same
mic sitting that #54 already asks for — and specifically by its residual (b),
the deliberately-wrong read, since three of the five struggles only fire on a
miss. Two of them encode findings this pack already paid for:

- *"Pauses in the middle of a sentence"* — the tutor-side companion to the
  `silenceCloseMs: 1100` engine fix (bench finding 2).
- *"Leaves out a small word"* — the omission class the standing-gate sitting
  proved detectable 2/2, and the reason the pack exists.

The named risk in adding `commonStruggles` is that they loosen a scripted tutor
into chattiness. di-math-facts' L2 run cleared exactly this (the tutor held its
lines across 5 items with 4 struggles added); this pack has 5, so it is worth a
glance on the next sitting rather than an assumption.
