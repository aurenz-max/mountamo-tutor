# topic-fidelity --grade — vocabulary-explorer (2026-07-03)

**Generator:** `my-tutoring-app/src/components/lumina/service/core/gemini-vocabulary-explorer.ts`
**Eval mode:** `identify`  **Topic:** "the water cycle"
**Verdict:** FIDELITY_BUG_FIXED (shape A — band-map keyed by prose → always-'Elementary')

## Bug

`generateVocabularyExplorer` did `const gradeLevel = ctx.gradeContext` (a PROSE sentence) then
`getGradeLevelContext(gradeLevel)`, whose map is keyed `'Kindergarten'|'Elementary'|'Middle School'|'High School'`.
The prose never matched a key, so the `|| contexts['Elementary']` fallback fired for EVERY objective.
K, 2, 4, 5, and 9 all received identical elementary content. `ctx.grade` was never read.

## Fix (established two-part pattern; schema / eval-mode axis untouched)

1. `gradeToBand(ctx.grade)` maps `'K'|'1'..'12'` → a real band KEY, with `inferGradeLevelFromContext(ctx.gradeContext)`
   (fast-fact's parser) as the prose fallback. `bandKey` is fed to `getGradeLevelContext` — fixes the gross always-Elementary bug.
2. `gradeLine` surfaces the EXACT numeric grade into the prompt so grade-2 ≠ grade-4 within the Elementary band.

## Probe table (avgDef = mean words per definition)

| probe | grade | avgDef (before → after) | term words (after) | signal |
|-------|-------|-------------------------|--------------------|--------|
| cross-band | K | 17.0 → 14.4 | evaporation, condensation, precipitation, collection, **vapor** | simplified; dropped "transpiration"; "invisible gas that floats" |
| within-band | 2 | 17.4 → 16.4 | …, **cycle** | "turning into gas when it gets warm" |
| within-band | 4 | 15.6 → 19.0 | …, **transpiration** | "an invisible gas, which then rises into the air" |
| within-band | 5 | 18.0 → 17.4 | …, transpiration | "due to heat from the sun" |
| cross-band | 9 | 15.0 → 17.8 | **evapotranspiration, sublimation, aquifer, condensation, percolation** | genuine HS vocabulary |
| no-grade control | — | (band only) | elementary set | unchanged, no regression |

## Evidence

- BEFORE: grade-9 term set was `evaporation…transpiration` — byte-for-byte the same elementary words as K. Zero discrimination across the whole K→9 span.
- AFTER: grade-9 term set is `evapotranspiration, sublimation, aquifer, percolation` (high-school band); K drops "transpiration" and uses "invisible gas that floats into the air". Cross-band now tracks; within-Elementary K(14.4) < 2(16.4) < 5(17.4) < 4(19.0) differ.
- No-grade control still returns elementary-band content — no regression.
- No answer leak: challenge questions reference term IDs, options are real; grade change touches realization (reading level / vocab / length) only, not the eval-mode/challenge-type axis.
