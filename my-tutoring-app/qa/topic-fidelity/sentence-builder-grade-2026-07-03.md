# Topic-Fidelity (--grade): sentence-builder

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/literacy/gemini-sentence-builder.ts`
Modality: `/topic-fidelity --grade`
Verdict: **FIDELITY_BUG_FIXED**

## Mechanism

parse-and-fallback. The generator read the grade from `ctx.gradeContext` (a prose
sentence) into `const gradeLevel`, then matched it against `['1'..'6']`:

```ts
const gradeLevel = ctx.gradeContext;              // prose, e.g. "This is for early elementary…"
const gradeLevelKey = ['1'..'6'].includes(gradeLevel) ? gradeLevel : '2';  // NEVER hits → always '2'
```

The match never hit the prose string, so `gradeLevelKey` was pinned to the hardcoded
fallback `'2'` for every objective. `ctx.grade` (the ONLY reliable grade parser output,
`'K'|'1'..'12'`) was never read. Grade ladder = **1-6** (the `gradeContext` guideline
rungs the generator defines). No K rung exists in the ladder.

## Fix (mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts)

- Removed the dead `const gradeLevel = ctx.gradeContext` read.
- Resolve `gradeLevelKey` from `ctx.grade` against `LADDER = ['1'..'6']`; kindergarten
  (`'K'` or band `kindergarten`/`preschool`) maps to the lowest rung `'1'`; numeric grade
  above the ceiling clamps to `'6'`; band-only fallback preserves the prior `'2'` default.
- Schema and eval-mode/sentence-type axis UNCHANGED — grade governs realization (reading
  level, vocabulary, tile count), never the cognitive KIND of the eval mode.

## Probe table (evalMode=`simple`, topic="a community helper who keeps us safe")

| probe   | grade | echoed gradeLevel | tiles/challenge | avg tile-word len | targetMeaning wordcounts | longest words                              | verdict |
|---------|-------|-------------------|-----------------|-------------------|--------------------------|--------------------------------------------|---------|
| BEFORE G1 | 1   | **2**             | [4,5,5]         | 5.00              | [6,5,6]                  | firefighter, protects, officer             | constant |
| BEFORE G3 | 3   | **2**             | [4,5,5]         | 5.29              | [6,5,6]                  | firefighter, protects, crossing            | constant |
| BEFORE G5 | 5   | **2**             | [4,5,5]         | 5.35              | [6,5,6]                  | firefighter, protects, healthy             | constant |
| BEFORE no-grade | – | **2**         | [4,4,4]         | 5.38              | [6,4,6]                  | firefighter, protects, crossing            | control |
| AFTER  G1 | 1   | **1**             | [4,4,4]         | 5.38              | [6,5,5]                  | firefighter, protects, children            | tracks |
| AFTER  G3 | 3   | **3**             | [4,5,4]         | 5.24              | [6,5,6]                  | firefighter, protects, bravely, doctor     | tracks |
| AFTER  G5 | 5   | **5**             | [4,5,5]         | **6.11**          | **[6,6,7]**              | **neighborhood, community**, firefighter   | tracks |
| AFTER no-grade | – | **2**          | [4,4,4]         | 4.83              | [6,6,6]                  | firefighter, protects, hospital            | control unchanged |

## Result

- Echoed `gradeLevel` now tracks the objective grade `1 → 3 → 5` (was constant `2`).
- Structural signals scale with grade: G5 carries richer vocabulary (avg tile-word length
  6.11 vs 5.38 at G1; multi-syllable "neighborhood"/"community"), longer target meanings
  ([6,6,7] vs [6,5,5]) and more tiles.
- No-grade band control unchanged — still resolves to `2`, so no regression on free-form lessons.
- Eval-mode pin honored: `sentenceType` stays `simple` at every grade (grade governs
  realization, not the cognitive kind).
- No answer leak introduced: fix touches only grade resolution; schema, tiles, and
  `validArrangements` (the checked answer) are untouched.
