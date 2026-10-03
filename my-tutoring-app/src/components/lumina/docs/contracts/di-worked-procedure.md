# Contract: di-worked-procedure

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-09-07 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiWorkedProcedure.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diWorkedProcedureScript.ts` (steps), `diWorkedProcedurePlan.ts`, `diWorkedProcedureWorkspace.ts`, `diWorkedProcedureLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-worked-procedure.ts` · **Catalog:** `service/manifest/catalog/di.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G2-4 multi-digit subtraction: subtract_no_regroup, subtract_regroup | catalog + QA | payloads `w1-payloads/di-worked-procedure.*.json` (incl. `subtract_regroup-3digit-hard`) | 2026-10-03 |
| Live tutor + JEV; verdict probe (`--procedure`) | tutor reports | `di-worked-procedure-live-di-signature-2026-09-07.md` | 2026-10-03 |
| Support levers (DI family 7) | `/add-support-tiers` | `qa/support-levers/di-worked-procedure-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — An item is one STEP; the page scribes only credited steps · OBSERVED
- **Probe:** `DiWorkedProcedure.workspace.test.tsx`.

### R2 — No ask states a column's digits · OBSERVED (R2 2026-10-03)
- **Property:** the easy column phrase is gone (it said the lent top, the `read_crossed_out` answer). The guidance forbids reading the ringed column's digits as a question on a decide step.
- **Probe:** `diWorkedProcedureScript.test.ts`; replay 2026-10-03 (5/20 decide replies framed the decision before the rule, 0 after).

### R3 — The model is a different problem with a fixed regroup pattern · OBSERVED
- **Property:** same width; pattern fixed per width and mode; no column shares the item's pair or flip; none of its own step answers is a step answer of the item; per column, differences more than one apart; never the item's final answer. Computed per problem (cached), so it does not change between steps.
- **Probe:** `diWorkedProcedureLevers.test.ts` (every askable 2-digit problem; a 3-digit sample; saved payloads).

### R4 — Help draws pieces and cubes, never a count · OBSERVED
- **Property:** `top_blocks` (decide steps; R9) draws each column's top as it reads now; `take_away_cubes` (subtract steps and no-regroup steps) crosses out the bottom number and labels nothing; refused on a regroup decide step.
- **Probe:** `DiWorkedProcedure.levers.workspace.test.tsx`.

### R5 — `fewer_columns` only after `no_decrement` on a 3-digit tens regroup · OBSERVED
- **Property:** the stage passes the step's last miss to `declare`/`simpler`; the practice step is a 2-digit ones regroup decide step, never the item's pair, its new numbers different; ungraded.
- **Probe:** unit + mounted tests.

### R6 — Only easy starts with the model (no tier is medium) · OBSERVED

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 6 requirements, 0 conflicts.
