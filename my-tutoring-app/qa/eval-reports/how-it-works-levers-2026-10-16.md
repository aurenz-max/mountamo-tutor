# how-it-works levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/how-it-works-w1-2026-10-16.md`). Code: `howItWorksLevers.ts`.
Every lever starts released; `config.difficulty` changes the items (choices, card count), not the levers.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for this id). The old catalog
`commonStruggles` documented three: sequence challenges ("what has to happen before this?"), wrong predictions ("re-read
the step before"), steps read too fast. The rest are inferred from the tasks. The misses are what the code check observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| guided, sequence (identify) | confuses the step with the one before or after (inferred) | `neighbour_step` |
| guided, sequence (identify) | does not tie the description to its step at all (documented: reads too fast) | `far_step` |
| sequence | swaps two neighbouring steps (documented) | `adjacent_swap`, `two_swapped` |
| sequence | puts one step in the wrong place, or the order backwards (documented) | `one_moved`, `reversed`, `mixed_order` |
| predict | picks a step that comes later, not next (documented) | `skipped_ahead` |
| predict | picks a step that already happened (inferred) | `went_back` |
| predict (explain) | gives a neighbouring step's reason (inferred) | `neighbour_step`, `far_step` |

## Lever table

| Item | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| identify, no step list (sequence mode) | `step_numbers` | help | each choice shows its step number | numbers only, no choice marked |
| identify, predict, explain (3+ choices) | `two_choices` | help | crosses out choices until two are left: the key and the foil farthest from it | never one left; the key is never crossed (`crossedOut`) |
| predict (readers) | `last_step` | help | the last shown step's description under the list, the next step's title words blanked | `leverLeaks`: never the key title |
| explain | `show_step` | help | the asked step's description under the question; withheld when it repeats over half the key purpose's words | `purposeOverlap` ≤ 0.5 |
| sequence (readers, every card has a purpose) | `show_why` | help | under each card, what that step makes possible | no position word or number |
| identify, predict, explain | `easier_item` | simplify | another step's question of the same kind with two choices, ungraded | key differs; the full item's key is not a choice |
| sequence | `fewer_cards` | simplify | the first three cards by name (two when there are three), ungraded | smaller card set; never shrinks twice |

Guided identify has no `step_numbers` (its step list is already on screen). Practice items carry no levers.

## Measured
- Workspace test: `two_choices`, `step_numbers`, `last_step`, `show_step` and `show_why` each change the screen and the
  scene fact in one commit, and the next attempt records them (`assisted`, `levers`); `easier_item` and `fewer_cards` open
  `<id>~simpler` and the full item comes back. A crossed-out choice stays closed on Try again.
- Pure rules over 4-, 5- and 6-step processes at every tier, and a 3-picture process: every miss an item can show is in
  its mode list and answered by a lever on that item, a help lever first wherever the item has one; no lever line names
  the key; the easier item stays in its kind and never shrinks twice.
- Sweep J9, J12, J13, J15: 0 findings on the three payloads.
- Replay r1-r4: lever and stuck replies describe each change by what the scene says it shows; the leading questions found
  in r1-r3 were guidance fixes (W1 report), none a lever's text.

## Failures without a lever
- A pre-reader's picture order has only `fewer_cards` (simplify): no help lever passes the leak rule there, since
  `show_why` needs written purposes and naming a first picture is part of the answer. With three pictures the easier
  order is two cards.
