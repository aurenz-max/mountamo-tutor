# rocket-builder levers and eval-test, 2026-10-16

Built with the W1 binding (`../tutor-reports/rocket-builder-w1-2026-10-16.md`). Code: `rocketLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
No real-learner evidence: no demonstrations, misconception or remediation files exist for this id. The old catalog
block's `commonStruggles` (documented) named "only an engine or only a tank", "piles on heavy parts and cannot lift off"
and "launches without changing anything"; the rest is inferred from the tasks. The misses are what the check sees.

| Mode | Failure (class) | Miss |
|---|---|---|
| can_it_lift | thinks push equal to weight lifts off (inferred; the hard tier is built on it) | `said_equal_lifts` |
| can_it_lift | miscounts or compares wrongly (inferred) | `said_lifts`, `said_stays` |
| add_to_lift | forgets the new engine's own weight; picks the biggest push (documented: heavy parts) | `heavy_engine` |
| add_to_lift | adds fuel or cargo, which only adds weight (documented: "only a tank") | `added_no_push` |
| add_to_lift | picks an engine that does not push enough (inferred) | `too_weak` |
| on_budget | checks one rule only (inferred) | `over_budget`, `no_lift`, `fails_both` |
| reach_target | "more fuel is always better" (inferred; the hard tier is built on it) | `picked_no_lift` |
| reach_target | misjudges fuel, weight, engine or staging (inferred) | `picked_lower`, `picked_higher` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| all | `count_marks` | help | each part's own number beside its blocks, arrows (and coins) | never a total; push and weight never lined up |
| can_it_lift, add_to_lift, on_budget | `lift_card` | help | a card: a box with 5 push / 3 weight rises, 4 / 4 stays; the rule in one line | boxes, not this item's rockets |
| add_to_lift | `own_weight` | help | every option's weight blocks outlined, note "Every part adds its own weight too" | marks every option the same |
| reach_target | `fuel_card` | help | a card with the fuel / weight / staging rules | names no rocket |
| add_to_lift, on_budget, reach_target | `drop_one` | simplify, on the item | greys out the option easiest to rule out | at least two untried options remain |

Every miss an item can show is answered by a help lever first (tested over every tier, 5 seeds per mode). No practice
items: the simplify lever acts on the item (user ruling 09-27). can_it_lift has two choices, so no `drop_one`.

## Measured
- Workspace test: each lever changes the screen and the scene fact in one commit; the next attempt records it
  (`assisted`); `drop_one` greys a choice that then takes no tap.
- Sweep J1-J15 on the four payloads: 0 findings. Replay: lever replies describe each card by what it shows; r2/r3
  fixes in the W1 report.

## Eval-test (`/api/lumina/eval-test`, `&grade=` canonical, 4 items each)
Content checked by code with the live modules (adapter `validate`, `rocketItems`, keys, harness answers, every miss
answered by a help lever, no total or comparison in the ask, scene or lever facts, every fact under 500 characters);
rendering by the browser drive in the W1 report.

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| can_it_lift (K) | PASS: 1 engine, gap 3-4, keys yes/no/yes/no | PASS: gap 1-2, both keys | PASS: 2 engines, gap 0-1, one equal |
| add_to_lift (G2) | PASS: key + one foil (tank, heavy or weak engine) | PASS: key + tank + heavy or weak engine | PASS: biggest push is never the key |
| on_budget (G3) | PASS: 2 rockets, one rule broken | PASS: key, over budget, stays down | PASS: 4, one at budget+1, cheapest stays down |
| reach_target (G4) | PASS: 2 rockets, one difference, highest/lowest | PASS: 3-chain incl. staging | PASS: 4, most-fuel rocket never lifts |

Gemini overviews: no rule stated in 12/12; "Time to Build a Rocket!" (one title) says build where the task is to predict.

## Failures without a lever
None observed.

## Fixed strategies (coordinator follow-up, 10-16)
The first build let "pick the engine" win every easy add_to_lift item and "pick the biggest push" every medium one.
`buildAdd` now gives easy one foil from {fuel tank, heavy engine, weak engine} and medium a heavy or weak engine (about
half each) beside the tank; engine weights may go to 8 blocks. Test `add_to_lift: no fixed strategy wins every item at
any tier` (160 items per tier, each must win at most 75%; medium biggest-push at most 60%, hard 0%):

| Tier | always engine | biggest push | always first | lightest |
|---|---|---|---|---|
| easy (2 options) | 64% | 68% | 49% | 60% |
| medium (3) | 46% | 49% | 27% | 61% |
| hard (4) | 36% | 0% | 26% | 48% |

Payload `w1-payloads/rocket-builder.add_to_lift.json` regenerated at G2 medium; browser drive of easy and medium 25/25.
