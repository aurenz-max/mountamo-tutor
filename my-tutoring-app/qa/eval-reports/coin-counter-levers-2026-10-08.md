# coin-counter levers, all modes (2026-10-08)

`/add-support-tiers` on identify, count-like, count-mixed, compare, make-amount, make-change, fewest-coins (show-amount
already had levers from the 10-07 open build). Class sweep; the user waived the Phase 2 table stop.

## Failure inventory

Real-learner evidence: none (no demonstrations, tutor or misconception reports name coin-counter misses). Synthetic: the
journey's scripted wrongs (another silver coin, number of coins typed as the total, one coin too many, the group with
more coins, the price given as change). Documented: catalog commonStruggles (small coin is not small value; skip-counting
mixed values; change needs subtraction). Every miss below is what `coinMiss` already names.

| Mode | Misses (class) |
|---|---|
| identify | dime_nickel, dime_penny, silver_coins, other_coin (synthetic + documented) |
| count-like | counted_coins, one_coin_short/over, short, over (synthetic + documented) |
| count-mixed | the above + all_one_kind (synthetic + documented) |
| compare | more_coins, said_equal, missed_equal, reversed (synthetic + documented) |
| make-amount / fewest-coins | counted_coins, one_coin_short/over, short, over (synthetic) |
| make-change | gave_cost, gave_paid, added, short, over (synthetic + documented) |

## Lever table (built)

| Mode | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|
| identify | `size_row`: every option on one shelf, smallest first | help | shown | order reads only the options; no name/value drawn (`sizeOrder`) |
| identify | `two_coins`: ask for another coin between two far-apart coins | simplify | shown | never asks for or shows the asked coin (`twoCoinsLeaks`) |
| count, count-like/mixed, compare, make-amount, show-amount | `coin_values`: values back on the coins | help | shown | only when the tier hid them; never on a one-coin card (G4) |
| count (one kind) | `skip_strip`: strip counting by the coin's value | help | shown | ends ≥3 steps past the total, nothing marked (`stripLeaks`); off at K |
| count (mixed), compare | `sort_coins`: one row per kind | help | shown | by worth only when values are on screen (`sortedRows`) |
| count | `fewer_coins`: fewer coins of the same kinds | simplify | shown | not the item's set, total or half of it; mixed stays mixed (`fewerLeaks`) |
| compare | `plainer_groups`: one coin against 2-3 smaller ones (or 1 v 1) | simplify | shown | never the item's groups, always a winner (`plainerLeaks`) |
| make-amount, fewest-coins | `running_total` (tier-on counts as pulled), `value_tags` | help | shown | made amount only; target was already on screen |
| make-amount, fewest-coins | `smaller_amount`: about half, reachable from the offered coins | simplify | shown | fewest ask kept |
| make-change | `change_bar`: bar for paid, cost shaded, rest "?", unlabelled ticks every 5¢ | help | shown | only paid, cost and "?" are written (`changeBarLabels`) |
| make-change | `round_change`: same payment, change in whole tens | simplify | shown | never the item's cost or change (`roundLeaks`) |

## Built

- `coinCounterLevers.ts` extended: lever declarations for every mode, pure builders and leak rules, `practiceItem`,
  `practiceParent`, `leverFacts` (what is drawn, never the key).
- `CoinCounter.tsx`: levers published for every mode; sorted rows, skip strip, size shelf, change bar, make-amount value
  tags; practice items reset all work and the full item comes back blank; "Practice" marker.
- `liveJourneySpec.ts` coin-counter row: a `~smaller` item is rebuilt from its parent with `practiceItem`.
- Catalog comment, contract R13.

## Tests

- `coinCounterLevers.test.ts` 27/27: each leak rule, each builder over 200-400 random items, the miss → lever table, and
  J9 per item over every saved payload (every catalog miss answered by an open lever on every item).
- `CoinCounter.levers.workspace.test.tsx` 6/6 (mounted, real runtime): pull changes screen + fact in one commit; next
  attempt records the lever; refused pulls leave scene, levers, attempts and DOM unchanged; simplify opens an ungraded
  practice, full item back blank, credited after (count-mixed, identify, make-change).
- Existing coin-counter suites green (build, workspace, reader-fit, generator, oracle, Pip surface): 126/126 total.
- `typecheck:lumina` 0.

## Left without a lever

- **fewest-coins' own property.** It renders and checks as make-amount (contract G8): "used more coins than needed" is not
  observed, so there is no miss and no lever for it. Needs `/eval-fix` (stamp the mode, add `more_coins_than_needed`).
- **Per item:** a compare item of two coins with values shown has no lever (no sort, no easier item); none in the saved
  payloads (generator asks 2-3 coins per group). A count-mixed card of two coins (quarter + dime) has `sort_coins` only.
  A make-change item whose change is 10¢ has `change_bar` only.
- K count-like has no checked miss (the taps auto-judge); it gets `fewer_coins` only.
- Not run here (batch step): journey sweep, tutor replay. No Live run.
