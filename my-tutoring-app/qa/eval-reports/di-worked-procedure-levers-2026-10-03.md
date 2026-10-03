# di-worked-procedure levers: DI family 7 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 5. Table and failure inventory: `qa/support-levers/di-worked-procedure-lever-table-2026-10-03.md`. No real-learner evidence: the misses are synthetic (spoken-miss ids, the 09-07 signature bench) or documented.

## What was built

| Step | Help | Simplify |
|---|---|---|
| decide (both modes) | `model_problem`, `top_blocks` (R9 allows it on a regroup decision) | `fewer_columns` (3-digit tens regroup, after `no_decrement` only) |
| subtract (after a regroup); every no-regroup step | `model_problem`, `take_away_cubes` | none |

- **Shared stage:** `DiStageLevers.declare` and `simpler` receive the step's last miss (`lastMiss`, read from the session's attempts). Other packs ignore it.
- **Model:** a different subtraction of the same width, fully worked on a compact copy of the same columns render. Regroup pattern fixed per width and mode. The table's rule "no number the model says is a step answer of the item" had no solution for some problems (60 − 22 had no model at all), so it is narrowed to the model's own step answers; digits it reads off its page are not checked. Cached per problem.
- **Practice render:** a practice step draws only its own small problem.
- **Catalog:** `levers: true`; `read_crossed_out` dropped from the no-regroup miss list (no lend happens there).

**Size:** 160 lines of lever module and about 120 of component and catalog change, against 210 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diWorkedProcedureLevers.test.ts`, 13) | every askable 2-digit problem (over 1000) of both modes has a model with the fixed pattern; a 3-digit sample and the saved problems have one; the walk; lever set per step; `fewer_columns` only after `no_decrement`, never the item's pair or new numbers; starting positions; every catalog miss answered, every named miss listed |
| Mounted (`DiWorkedProcedure.levers.workspace.test.tsx`, 3) | `top_blocks` draws 2 cubes and 5 rods with no text; `take_away_cubes` 12 with 8 crossed out; easy model is a different problem; `fewer_columns` appears only after a named `no_decrement` and opens an ungraded 2-digit step |
| Dry journey J1-J9 | 3/3 payloads |
| typecheck | lumina 0 |
| Text replay (Flash, 3 payloads × 5) | 0 flags by the checks. Read by hand: 5 of 20 decide-step replies asked "Can you subtract eight from zero?", which states the decision. The guidance and the `top_blocks` text now forbid it: 0 of 30 after |

## Not covered

- No simplify on subtract steps or in subtract_no_regroup, by design.
- Not browser-checked (HUMAN-CHECKS #183, worked-procedure row). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 8, di-deduction (plan step 6).
