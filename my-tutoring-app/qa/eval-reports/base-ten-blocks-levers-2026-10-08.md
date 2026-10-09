# base-ten-blocks levers: J12 per-item gaps (mixed, operate), 2026-10-09

Executor: `/add-support-tiers`, class sweep (lever-table confirmation waived by the user, 2026-10-08). Closes the two
base-ten rows of `qa/support-levers/QUEUE-item-gaps-2026-10-09.md`.

## Failure inventory

| Mode / item | Miss (check) | Evidence class |
|---|---|---|
| operate, subtract_with_blocks-2 (73 − 28, one borrow) | `one_ten_off`: a lost borrow, typed 55 | observed-synthetic (journey wrong input); documented (catalog struggle "not regrouping") |
| mixed, read_blocks-1 (click mat, keypad, 215) | `one_ten_off`: tens read wrong, typed 225 | observed-synthetic |
| mixed, regroup-2 (click mat, 321) | `no_trade`: Check My Trade with no trade | observed-synthetic; documented (the row's own comment) |

No real-learner evidence for any of the three.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Before |
|---|---|---|---|---|---|---|
| operate | lost carry or borrow on a one-trade item, or before modelling (`ten_bracket` is absent, `single_regroup` has no floor below one) | `trade_mark`: a ⇄ mark on each column the operation trades in | help | shown | column positions only; no digit, count or result | none (only `column_counts`) |
| mixed read_blocks (click) | a big block read at the wrong worth (`one_ten_off`, `digits_swapped`) | `ten_model`: a ten-stick next to ten cubes (and a flat next to ten sticks), beside the mat | help | shown | outside the mat, no number; the mat still prints no count (R5) | none |
| mixed read_blocks (click) | loses count (`one_short`, `one_over`, far off) | `plainer_read`: read a mat of `plainerNumber` first, ungraded | simplify | shown | never the number or its reversal; same places | none |
| mixed regroup (click) | `no_trade`, `value_changed` | `ten_model` | help | shown | as above; never points at a trade button | none |
| mixed regroup (click) | — | no simplify: one trade is already the smallest trade | — | — | — | — |

Per-item check: `trade_mark` exists on every operate item with a regroup (every generated operate item has at least one,
R9). `ten_model` exists on every click read and trade item. `plainer_read` is built for 980+ of the numbers 10-999.

## Built

- `baseTenLevers.ts`: `trade_mark`, `tradeColumns`; click-mat read/regroup levers; `practiceItem` (one builder for all
  four simplify levers) and `practiceFromId`; the fact for `trade_mark`.
- `BaseTenBlocks.tsx`: trade mark badge in the column header; `TenModel` under the column mat for read/regroup; the
  simplify branch of `pullLever` now calls `practiceItem`.
- `liveJourneySpec.ts` (base-ten row): a `~plainer|simpler|smaller` item is rebuilt from its parent with `practiceFromId`.
- Catalog comment on `unanswered` updated (lists unchanged: they cover the spoken mat's homogeneous payloads).
- Contract R25; J12 baseline entries for `base-ten-blocks.mixed` and `.operate` removed.

## Tests

- `baseTenLevers.test.ts` + `BaseTenBlocks.levers.workspace.test.tsx`: 52/52. The workspace cases: trade_mark pull
  changes the screen and fact in one commit, a repeat pull is blocked with screen/levers/attempts unchanged, the next
  answer records the lever; mixed read `ten_model`; mixed read `plainer_read` practice (own id, ungraded, full item
  back and credited with the lever); mixed regroup `ten_model` then a credited trade.
- All base-ten suites: 10 files, 185/185. `journeySweep -t base-ten`: 7/7 with the J12 entries gone.
- `npm run typecheck:lumina`: 0.

## Left without a lever

- Click-mat regroup has no simplify lever (one trade is the floor).
- operate `digits_swapped` stays in `unanswered` (unchanged).
- Should work in the browser; the ⇄ mark and the model under the mat need a visual check on a real lesson.
