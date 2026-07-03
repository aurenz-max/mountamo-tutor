# topic-fidelity --grade — fact-file (CORE text, risk group A)

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/core/gemini-fact-file.ts`
Eval mode probed: `recall_medium` · Topic: "the water cycle"

## Verdict: FIDELITY_BUG_FIXED

Shape (A) — BAND-MAP KEYED BY PROSE. The generator did
`const gradeLevel = ctx.gradeContext` (a prose SENTENCE) then
`getGradeLevelContext(gradeLevel)`, whose map is keyed by band LABELS
(`'Kindergarten'|'Elementary'|…`). The prose sentence never matched a key,
so the lookup fell through to `contexts['Elementary']` for **every** objective.
A K lesson and a grade-9 lesson both received identical "elementary" audience
framing — grade was a dead input.

## Fix (established two-part pattern, no restructure)
1. Resolve the audience BAND from `ctx.grade` first (`gradeToBand`), prose
   fallback second (`inferGradeLevelFromContext`, ported from fast-fact). The
   real band KEY is now fed to `getGradeLevelContext` — kills the always-
   Elementary collapse.
2. Inject the EXACT numeric grade into the prompt (`gradeLine`) so grades
   differ WITHIN a band (grade-2 ≠ grade-5). Schema, challenge-type enum and
   eval-mode axis untouched — grade governs realization only.

## Probe table (recall_medium, "the water cycle")

| probe | grade | avgWordLen | avgSentLen | long9+word% | signal |
|-------|-------|-----------|-----------|-------------|--------|
| cross-band | K | 4.24 | 14.2 | 2.7% | "invisible gas", simplest vocab |
| within-elem | 2 | 4.11 | 12.5 | 2.3% | shortest sentences, plainest words |
| within-elem | 4 | 4.80 | 15.7 | 7.8% | "Evaporation…water vapor" introduced |
| within-elem | 5 | 5.01 | 15.9 | 8.3% | richer definitions, longer body |
| cross-band | 9 | 5.26 | 16.8 | 14.5% | "Solar radiation…hydrological cycle" |
| no-grade control | — | 4.74 | 14.7 | 6.0% | sensible elementary default, unchanged |

Before the fix all six probes drew from the identical `contexts['Elementary']`
audience string and were statistically indistinguishable. After: avgWordLen and
long-word density scale monotonically across bands **and** within elementary
(2 < 4 < 5). No-grade control sits in the elementary band range (no regression).
No answer leak — self-check `correctIndex` stays out of the passage/description text.
