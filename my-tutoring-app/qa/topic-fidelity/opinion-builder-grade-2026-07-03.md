# Topic-Fidelity (--grade) — opinion-builder — 2026-07-03

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-opinion-builder.ts`
**Modality:** `/topic-fidelity --grade`
**Verdict:** FIDELITY_BUG_FIXED
**Mechanism:** parse-and-fallback (dead-field read of `ctx.gradeContext`)
**Grade ladder:** 2-6 (rungs defined in `gradeNotes`: 2, 3, 4, 5, 6). TOP_RUNG=6, MID_RUNG=4, floor clamp=2.

## The bug

Line 70 read the PROSE sentence `const gradeLevel = ctx.gradeContext;`, then line 93 matched it
against `['2','3','4','5','6']`. Prose never matches, so `gradeLevelKey` was pinned to the `'3'`
fallback for every request. Everything downstream (`reasonCount`, `counterArgumentEnabled`,
`framework`/OREO-vs-CER, `gradeNotes`, prompt reading level) was constant regardless of `ctx.grade`.

## The fix (mirrors gemini-poetry-lab.ts / gemini-decodable-reader.ts)

Removed the dead `ctx.gradeContext` read. Resolve `gradeLevelKey` from `ctx.grade` (the only reliable
numeric grade): in-ladder → use it; `>6` → clamp to `'6'`; `K`/`<2` → clamp to floor `'2'` (opinion
writing starts at grade 2); band-only fallback → `'2'` for kindergarten/preschool else mid-rung `'4'`.
Schema and eval-mode/framework axis left unchanged — grade governs realization only.

## Probe table (evalMode=oreo, topic="why leaves change color")

| probe            | grade | gradeLevel | reasonCount | counterArg | linkingWords tier                         | verdict |
|------------------|-------|-----------|-------------|------------|-------------------------------------------|---------|
| BEFORE           | 2     | 3         | 3           | false      | mid (because, therefore, for instance)    | BUG     |
| BEFORE           | 4     | 3         | 3           | false      | mid (identical tier)                       | BUG     |
| BEFORE           | 6     | 3         | 3           | false      | mid (identical tier)                       | BUG     |
| AFTER            | 2     | 2         | 2           | false      | simple (and, too, so, plus, next)          | tracks  |
| AFTER            | 4     | 4         | 3           | false      | richer (Furthermore, Consequently, Since)  | tracks  |
| AFTER            | 6     | 6         | 3           | true       | academic (However, On the other hand)      | tracks  |
| AFTER (no grade) | —     | 4         | 3           | false      | mid-rung band fallback (unchanged, sane)   | control |

## Signal summary (before → after)

- **gradeLevel echo:** constant `3` → tracks `2 / 4 / 6`.
- **reasonCount:** constant `3` → `2 / 3 / 3` (grade 2 gets the simpler 2-reason scaffold).
- **counterArgumentEnabled:** constant `false` → `false / false / true` (counter-argument unlocks at grade 6).
- **linking-word vocabulary tier:** constant → scales from primary ("and/too/so") to academic ("However/On the other hand/Consequently").
- **prompt reading level:** constant → grade 2 single simple question; grade 6 two-sided debatable claim.

No answer leak introduced — prompts pose debatable questions and reveal no answer. Band-only control
unchanged (mid-rung `4`), confirming no regression for grade-less objectives.
