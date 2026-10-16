# transport-challenge levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/transport-challenge-w1-2026-10-16.md`). Code: `transportLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for this id). The old catalog
`commonStruggles` documented three failures: picking the fastest vehicle without checking the budget, picking the
cheapest per trip without counting trips, and ignoring the CO2 limit. The rest are inferred. The misses are what the
code check observes on the picked vehicle.

| Mode | Failure (class) | Miss |
|---|---|---|
| all | does not count the part-full last trip (inferred) | `forgot_round_up` |
| all | picks the cheapest per trip without counting trips (documented) | `cheapest_per_trip` |
| all | picks the biggest or fastest vehicle without checking its total (documented) | `fewest_trips` |
| multi | checks one limit and not the other (documented: CO2 ignored) | `one_limit_only` |
| single, multi | a total over the limit, no other pattern (inferred) | `over_limit` |
| full | picks a vehicle that breaks two or more limits (inferred) | `breaks_more` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code, `leverLeak`) |
|---|---|---|---|---|
| all | `show_trips` | help | each card draws the load as one block a trip, the last part full, and writes the trips ("6 trips: 5 full, the last one carrying 4 people") | no verdict word; no total of that vehicle |
| all | `times_setup` | help | each card writes, per limit, "6 trips × $25 a trip" | no product; no verdict word |
| all | `smaller_job` | simplify | the first two cards on a smaller load that fills every trip, same kinds of limits | ungraded; its answer is never this job's answer; never shrinks twice |

`show_trips` answers `forgot_round_up`, `cheapest_per_trip`, `over_limit`; `times_setup` answers `fewest_trips`,
`one_limit_only`, `breaks_more` (and the first two again). Every miss a job can show is answered by a help lever
first (tested over every mode, tier and load kind).

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit, and the next attempt
  records it (`assisted`, `levers`); `smaller_job` opens `<id>~simpler` with no levers and the full job comes back.
- Sweep J9, J12, J13, J15: 0 findings on the three payloads (J15 after wiring `onPracticeSolved`).
- Replay r3: stuck and lever replies describe what the cards now show and ask which vehicle the learner wants to work;
  none names a vehicle or a total.

## Failures without a lever
None observed. The smaller job uses the first two cards whatever the key, so its vehicles do not hint at the answer;
when one of them answers the full job, the other answers the smaller one.
