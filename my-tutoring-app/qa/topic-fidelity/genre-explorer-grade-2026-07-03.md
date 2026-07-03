# Topic Fidelity (--grade): genre-explorer — 2026-07-03

Ladder intended: 1 / 2 / 3 / 4 / 5 / 6 (gradeNotes rungs; grade governs reading level = vocabulary complexity + passage length, genre sophistication, feature count). Eval mode probed: `classify_genre`. Topic: "why leaves change color".

| Probe | grade | gradeLevel field | genres | feature counts | word counts | verdict |
|-------|-------|------------------|--------|----------------|-------------|---------|
| discrimination | 2 | 2 | Informational / Folktale | 5,5 | 57,63 | tracks (after fix) |
| discrimination | 3 | 3 | Informational / Poetry  | 5,5 | 63,52 | (before-fix baseline) |
| discrimination | 5 | 5 | informational / myth    | 6,6 | 64,74 | tracks (after fix) |
| no-regression  | (band=elementary, no grade) | 3 | Informational / Poetry | 5,5 | 53,65 | band default (unchanged) |

**Before fix:** every probe — grade 2, grade 3, grade 5, and no-grade — returned `gradeLevel: "3"`. The prompt always emitted `GRADE: 3` regardless of input; word-count drift (47→78) was LLM sampling noise, not a controlled grade signal. The `gradeNotes` ladder (lines 129-136) and the grade-shape defaults were effectively pinned to the '3' rung.

**After fix:** grade 2 → field "2", grade 5 → field "5" (introduces `myth` genre, 6 features, higher-tier vocabulary e.g. "carotenoids", "Scientists"); no-grade band control still returns "3" (sensible MID_RUNG fallback) — no regression. No answer leak introduced (features remain neutral true/false checklist questions; intent-focus text absent).

**Verdict:** FIDELITY BUG → fixed at single tier (grade arrives structured via `ctx.grade`; no resolver needed).
**Mechanism:** legacy parse-and-fallback — read `ctx.gradeContext` (PROSE sentence) then matched it against `['1'..'6']` at line 127, which never hit, pinning `gradeLevelKey` to the '3' fallback for every objective.
**Change:** `gemini-genre-explorer.ts` — replaced the prose match with the `ctx.grade` consumption pattern (LADDER 1-6; above-ceiling numeric → '6'; K → '1' since no K rung; band fallback kindergarten/preschool → '1' else '3'); removed the dead `const gradeLevel = ctx.gradeContext` read. Schema and eval-mode axis unchanged. | tsc: deferred to orchestrator consolidated run.
