# Math G2 design review 2026-10-27 — build queue

Briefs: `briefs/`. Order and defaults agreed with the user 2026-10-27: regrouping trade observed, not required; near
doubles ±1 only; clock keeps minute-hand drag, 12:15 p.m. in, midnight out; mixed facts in math-fact-fluency first,
same balance in di-math-facts.

| # | Brief | Executor | State |
|---|---|---|---|
| 1 | 3 regrouping-workbench model evidence (repair) | `/eval-fix` + `/primitive-contract --check` | **DONE 2026-10-27.** Separate addend blocks, Put together / Take away, `blocksModelled`, two-digit scope, mode filter on the no-tier path. Contract R1 re-based, R6 added. Verify: `verify/`, tests 259/259. Browser check at phone width owed |
| 2 | 1 tape-diagram two-step patterns | `/add-eval-modes` | **DONE 2026-10-27.** add-add pattern read from the lesson; new mode `two_step_compare` (β5.0) with the step-2 bar choice; attempts fixed and first try = no miss. Contract R5-R7. Verify: `verify/tape-diagram*.json`, `verify/td-compare-*.png` |
| 3 | 2 near-doubles family | `/add-eval-modes` | **DONE 2026-10-27.** Family + mode `near_doubles` (β4.3) on addition-fact-strategies; tier = order (primed pairs → alone); intro is the near-double picture. Contract R6. Tests 84/84 + boss/levers 470/470; probe 4 tiers; browser intro |
| 4 | 4 clock a.m./p.m. setting | `/add-eval-modes` | **DONE 2026-10-27.** Mode `set_time_ampm` (β3.0, code-only event table), parts scored apart, `day_halves` lever; time bar off on set modes, day/night strip removed. Contract R7-R8. Tests 945/945 (clock, boss, oracles); browser drive |
| 5 | 5 mixed facts within 20 | `/eval-fix` | **DONE 2026-10-27.** math-fact-fluency: mixed-set lessons get half of each operation shuffled (tier or not), Grade 2 defaults to within 20, Grade 2 badge, per-operation first-try metrics (R9). di-math-facts: named-fact ceiling widened to the largest named sum, blends shuffled. Not done: `visual_fact` / `match` still cannot carry mixed evidence (brief's own caveat) |
