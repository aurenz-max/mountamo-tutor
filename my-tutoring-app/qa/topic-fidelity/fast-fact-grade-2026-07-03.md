# fast-fact — /topic-fidelity --grade

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/core/gemini-fast-fact.ts`
Eval mode probed: `recall` (fast-fact has no catalog evalModes; targetEvalMode is inert for this gen — validation skipped, generation identical). Topic: "the water cycle".

## Shape / diagnosis
Shape C (correct band fallback, dead numeric field). fast-fact already inferred the audience BAND from `ctx.gradeContext` prose via `inferGradeLevelFromContext` (NOT the always-Elementary bug A). But `ctx.grade` (canonical 'K'|'1'..'12') was never consumed, so grades WITHIN a band (grade 2 vs grade 5) collapsed to the identical "elementary students (grades 1-5)" audience string. Ladder granularity was BAND-only.

## Fix (two-part, established pattern)
1. Band label now resolves from `ctx.grade` first (`gradeToBand`), prose-inferred band as fallback — feeds a real map KEY to `getGradeLevelContext`.
2. Numeric-grade line injected into the prompt (`EXACT TARGET GRADE: grade N …`) so realization (reading level / vocab / sentence length / self-labeled gradeBand / targetResponseTime) tracks the exact grade within the band. Schema + challenge-type/eval-mode axis untouched.

## Probe table (before → after)

| probe | grade / band | BEFORE signals | AFTER signals | notes |
|---|---|---|---|---|
| control-no-grade | none / elementary | gradeBand 3-5, TRT 6, wordlen 4.58, long% 8.6 | gradeBand 3-5, TRT 6, wordlen 4.70, long% 9.0 | no-regression control — band-only path unchanged |
| K | K / kindergarten | gradeBand K-2, TRT 8, wordlen 4.33, long% 5.5 | gradeBand K-2, TRT 8, wordlen 4.25, long% 4.1 | cross-band low end, stable |
| G2 | 2 / elementary | gradeBand **3-5**, TRT **6**, title "Water Cycle Wonders", wordlen 4.57, long% 8.6 | gradeBand **K-2**, TRT **8**, title "Learning the Water Cycle", wordlen 4.43, long% 7.2 | **within-band now distinct from G5** |
| G5 | 5 / elementary | gradeBand **3-5**, TRT 6, title "Water Cycle Wonders", wordlen 4.33, long% 3.9 | gradeBand **3-5**, TRT 6, title "Mastering the Water Cycle", wordlen 4.61, long% 8.2 | |
| G9 | 9 / high-school | gradeBand 9-12, TRT 4, wordlen 5.41, long% 22.5 | gradeBand 9-12, TRT 4, wordlen 5.33, long% 20.5 | cross-band high end, stable |

BEFORE: G2 and G5 were indistinguishable (both self-labeled "3-5", same title, wordlen 4.57 vs 4.33 = noise). AFTER: G2 self-labels K-2 / TRT 8 / "Learning" framing; G5 self-labels 3-5 / TRT 6 / "Mastering" framing. Monotonic realization scaling K < G2 < G5 < G9 (avg word length 4.25 < 4.43 < 4.61 < 5.33; long-word% 4.1 < 7.2 < 8.2 < 20.5).

## Verdict
PARTIAL_IMPROVED — band tracking was already honored; numeric grade was a dead field, now surfaced so within-band grades differ. No answer leak (prompts pose the question; explanations reveal only after answer). No-grade control unchanged.
