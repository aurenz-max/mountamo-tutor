# topic-fidelity --grade — how-it-works (CORE text, risk group A)

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/core/gemini-how-it-works.ts`
Eval mode: `identify` · Topic: "the water cycle" · Verdict: **FIDELITY_BUG_FIXED**

## Diagnosis (shape A — band-map keyed by prose)

`generateHowItWorks` did `const gradeLevel = ctx.gradeContext` (a full PROSE sentence) then
`getGradeLevelContext(gradeLevel)`, whose map keys are band labels ('Kindergarten' | 'Elementary' |
'Middle School' | 'High School'). The prose sentence never matched a key, so the lookup returned
`contexts['Elementary']` for EVERY objective — a K lesson and a grade-9 lesson both got the same
Elementary audience string. `ctx.grade` was never read; the numeric grade never reached the prompt.

## Fix (two-part, matches fast-fact reference)

1. `bandKey = (ctx.grade && gradeToBand(ctx.grade)) || inferGradeLevelFromContext(ctx.gradeContext)`
   — resolve a real map KEY from the canonical numeric grade first, prose band fallback second.
   Added `gradeToBand` (K→Kindergarten, ≤5→Elementary, ≤8→Middle School, else High School) and a
   prose `inferGradeLevelFromContext` mirroring fast-fact. Fed `bandKey` to `getGradeLevelContext`.
2. Injected `gradeLine` ("EXACT TARGET GRADE: N. Tune reading level, sentence length, and vocabulary
   precisely to grade N…") into the prompt so grades differ WITHIN a band.

Schema, challenge-type enum, and eval-mode axis untouched — grade governs realization only.

## Probe table (step-1 description as anchor; hard% = words ≥3 syllables)

| probe | grade | avg step-desc wc | hard-word % | title / vocab signal |
|-------|-------|------------------|-------------|----------------------|
| before | K | 34.8 | 5.0 | "invisible gas... water vapor" |
| before | 2 | 32.2 | 4.7 | "invisible gas called water vapor" |
| before | 5 | 30.5 | 4.1 | "invisible gas called water vapor" |
| before | 9 | 32.5 | 4.6 | "invisible gas called water vapor" — IDENTICAL to K |
| before | none | 33.2 | 3.0 | Elementary prose |
| after | K | 26.8 | 3.7 | "sun shines down and heats up the water" |
| after | 2 | 23.2 | 4.3 | short simple sentences |
| after | 5 | 32.5 | 13.1 | "atmosphere", "surrounding air" |
| after | 9 | 34.5 | 22.6 | "Solar radiation... kinetic energy to break the hydrogen bonds between water molecules"; title "The Global Hydrologic Cycle" |
| after | none | 33.5 | 6.0 | mid-Elementary, unchanged behavior |

Before: hard-word % flat at 4–5% across K→9 (no grade signal; K ≈ 9). After: monotonic 3.7 → 4.3 →
13.1 → 22.6 across K→2→5→9. Cross-band (K vs 9) and within-band (2 vs 5) both now track. No-grade
control stays in the Elementary band (no regression). No answer leak — identify questions reference
steps without exposing the correct option in titles/descriptions.
