# Topic-Fidelity (--grade) — context-clues-detective

**Date:** 2026-07-03
**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-context-clues-detective.ts`
**Modality:** grade discrimination
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead-field + broken numeric match)
**Ladder:** 2-6 (top rung 6, mid rung 4)

## The bug

Line 393 read the prose sentence `const gradeLevel = ctx.gradeContext`, then line 477 matched
it against numeric rungs:

```ts
const gradeLevelKey = ['2','3','4','5','6'].includes(gradeLevel) ? gradeLevel : '3';
```

`ctx.gradeContext` is a PROSE sentence (and `ctx.gradeLevel` is a BAND key), so the
`includes` test NEVER hits and `gradeLevelKey` was pinned to the `'3'` fallback for every
grade. The entire prompt — grade guidelines, passage length, vocabulary tier, challenge
count — was frozen at grade 3. The canonical `ctx.grade` was never consulted.

## The fix

Mirror of `gemini-poetry-lab.ts` / `gemini-decodable-reader.ts`: read `ctx.grade` (the ONLY
reliable numeric grade), clamp above-ceiling → '6' and below-floor (K/1) → '2', and fall back
to the band ('kindergarten'→'2', else mid rung '4') only when `ctx.grade` is missing. Removed
the dead `ctx.gradeContext` read. Schema and eval-mode/clue-type axis unchanged — grade
governs realization (reading level, passage length), never the cognitive KIND of the clue.

## Probe table (evalMode=definition, topic="a community helper")

| probe | grade | gradeLevel field | #challenges | sentences | target words (vocab tier) | verdict |
|-------|-------|------------------|-------------|-----------|---------------------------|---------|
| before | 2 | **3** | 3 | 4 | vigilant, benevolent, essential (grade-6 vocab) | CONSTANT |
| before | 4 | **3** | 3 | 4 | vigilant, vital, tranquil | CONSTANT |
| before | 6 | **3** | 3 | 4 | vigilant, treatment, invaluable | CONSTANT |
| after | 2 | **2** | 3 | **3** | expert, diligent, courageous (accessible) | TRACKS |
| after | 4 | **4** | 3 | **5** | diligent, public servant, vigilant | TRACKS |
| after | 6 | **6** | 3 | 4 | benevolent, meticulous, pragmatic (sophisticated) | TRACKS |
| after | none (band control) | 4 | 3 | 5 | duty, coordinate, diagnosis | mid-rung fallback, no regression |

## Evidence

- BEFORE: `gradeLevel` field constant "3", sentences constant 4, grade-6 vocab ("benevolent")
  served to grade 2. Same first target word "vigilant" across all grades — the prompt was
  byte-identical.
- AFTER: field echoes 2/4/6; sentence count scales 3→5; passage words scale ~32 (G2) → ~55
  (G4/G6); vocabulary tier clearly scales from accessible (G2) to sophisticated (G6).
- No-grade band control resolves to mid rung '4' (sensible default) — unchanged behavior.
- No answer leak introduced: fix touches only grade-rung selection; schema, `correctMeaning`,
  `meaningOptions`, and clue fields untouched.
