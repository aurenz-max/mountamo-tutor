# percent-bar — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/percent-bar-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for percent-bar). Documented = the catalog's `commonStruggles`; synthetic = the journey's scripted wrong steps.

| Mode | Failure (miss) | Class |
|---|---|---|
| all place steps | sets the bar to the value, not the percent (`placed_value`) | documented ("confusing part and whole") |
| all place steps | lands near, too high, too low (`near_miss`, `too_high`, `too_low`) | documented (non-benchmark percents), synthetic |
| identify_percent | places the rest of the whole (`complement`) | inferred |
| find_part, convert | places the discount, not what is still paid (`placed_discount`) | documented, synthetic |
| find_whole | places only the added rate (`rate_not_total`) | documented, synthetic |
| find_whole | places the whole, or takes the rate off (`whole_only`, `took_off_rate`) | inferred |
| convert | picks the bigger % off (`bigger_discount`), or the other option (`other_price`) | documented / inferred |

## Lever table (built)

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| all | value_bar (not offered when the session draws it) | help | placed_value | shown | labelled only "0" and "the whole" |
| all | tenths | help | near_miss, too_high, too_low, placed_value | shown | ten unlabelled marks |
| all | fill_names | help | complement / placed_discount / rate_not_total | shown | words only |
| find_part, convert | discount_model | help | placed_discount | both | picture outside the item, no digit |
| find_whole | added_model | help | rate_not_total, whole_only, took_off_rate | both | picture outside the item, no digit |
| convert | compare_model | help | bigger_discount, other_price | both | picture outside the item, no digit |
| identify, find_part, find_whole | simpler_problem | simplify | the mode's misses | shown | same mode and steps, own id and scenario, no step percent within ±2 of the item's |

Simplify builds: identify → 50% of the same whole; find_part → 25% off the same price; find_whole → a 10% (or 20%) rate on the same whole, both steps kept. Offered only when the item's percent is not already on a guide line or a whole ten. **convert has no simplify:** a simpler compare either drops a step or gives both goods one price, which removes the trap the mode exists for. Its misses are all answered by help levers.

Bar levers are refused on the compare step ("the bar is not on screen"). Starting positions stay the existing tier's aids (labels, guide lines, value bar, calculation panel); no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `percentBarLevers.test.ts` 21/21, `PercentBar.levers.workspace.test.tsx` 4/4, `PercentBar.workspace.test.tsx` 9/9.
- Sweep with `workspaceContract`, `misses`, `activityContract`, `lessonWorkspacePlan`: 10 files, 3143 passed. `percent-bar`: 4 payloads, 0 findings J1-J13; lever inventory: every miss answered on every mode.
- Replay (`replay/percent-bar-2026-10-09-r2.json`, 4 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: lever replies describe the change in the lever's words ("the part", "taken off / still paid", ten equal parts) and ask the learner to move the bar; none names a step's percent.

## Failures with no lever
None.

## Open
- Browser check on the lever pictures and the tenth marks (JSDOM only).
