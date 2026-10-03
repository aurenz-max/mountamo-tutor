# di-dice-roll: failure inventory and lever table (2026-10-03)

`/add-support-tiers` Phases 1-2, DI family 2 of 10. Confirmed by the user 2026-10-03 and BUILT: `qa/eval-reports/di-dice-roll-levers-2026-10-03.md`.
Rulings carried over (2026-10-02): DI gets in-item levers; DI's correction is a parallel-item model.

## Phase 1: failure inventory

Evidence: **no observed-real.** Synthetic = `diceSpokenMisses` ids. Documented = catalog `commonStruggles`
(five patterns). There is no contract doc yet (Phase 3 derives it). Saved payloads exist for count_pips and
compare_dice only; **sum_two_dice has none**, so the sweep and replay cannot see it until one is made.

| Mode (β) | Failure | Class |
|---|---|---|
| count_pips | skips a pip or counts one twice (`skipped_a_number`, off-by) | synthetic + documented |
| count_pips | guesses without counting | documented (no observable miss id; lands as off-by) |
| count_pips | recounts and never lands on one number | documented; no lever (the tutor waits for a final number) |
| compare_dice | names the die with fewer (`other_die`), says same (`said_same`) | synthetic + documented ("compares position, not quantity") |
| compare_dice | says a number, not left/right/same (`said_number`) | synthetic |
| compare_dice | on a tie, picks a side (`picked_a_side`) | synthetic |
| sum_two_dice | says one die's dots (`said_addend`) | synthetic + documented |
| sum_two_dice | lands near the total (off-by) | synthetic |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all three | every miss | `model_roll`: a small model card beside the dice with a DIFFERENT roll, solved (count: one die and its number; sum: two dice and their total; compare: two dice with a star on the one with more, or "=" for a tie). The tutor says it as "My turn", then asks about the child's roll | help | both | count/sum: not the item's faces or its swap, total not within one of the item's, the item's answer nowhere in it (faces, total, spoken words), not one step from the item. compare: a different pair whose relation is NOT the item's (a model with the same word would hand over "left") | no | picker + leak check, model card |
| count_pips, sum_two_dice | skipped_a_number, one_short, one_over | `touch_dots`: each dot on the child's dice can be tapped and gets a ring. Rings only, no numbers, no order | help | shown | Marks only what the child taps; never counts or numbers | no (dice are a disabled button after the roll) | new capability: tappable pips |
| sum_two_dice | said_addend | `both_bracket`: one bracket under both dice ("all the dots on both") | help | both | Draws no number and no combined group | no | render |
| count_pips | skipped_a_number, off-by | `fewer_dots`: a die with 1-3 dots, not the item's value; ungraded, then the full roll | simplify | both | Not the item's value | no | builder (new roll) |
| compare_dice | other_die, said_same | `far_pair`: a pair 3 or more apart with the OTHER relation (item left → practice right) | simplify | both | Not the item pair or its swap; never the item's relation (a practice answer of "left" would be repeated on the full item) | builder exists at generation only (tier gap 3/2/1) | runtime builder |
| sum_two_dice | said_addend, off-by | `smaller_dice`: the larger face + 1 | simplify | both | Not the item pair, its swap, or its total | no | runtime builder |

### Rejected and no-lever rows

- **In-item comparison help** (matching lines between dots, the extra dots glowing, dots lined up in rows):
  the relationship is the answer, so each one shows it. compare_dice gets only the model (outside the item)
  and `far_pair`.
- **A tie (`picked_a_side`) gets no simplify.** An easier tie would have the answer "same", and the child
  would repeat it on the full item. The model (a non-tie) is its only lever.
- **"Recounts and never lands":** no lever; it is a waiting problem, not a representation problem.

## Phase 6: starting positions

Same as di-math-facts: easy (or no tier, which the pack treats as easy) starts with `model_roll` on screen,
not recorded as a pull; medium and hard start with none. The generator's tier shapes (compare gap 3/2/1, the
count-on path) stay as they are.

## Build notes

- `DiTeachingStage` already has the levers prop. A practice item has its own id, so it starts covered and
  the child rolls again.
- `touch_dots` needs the rolled dice out of the roll `<button>` (a disabled button swallows taps): after the
  roll, render the dice in a plain container.
- Make `w1-payloads/di-dice-roll.sum_two_dice.json` (one Flash generation) so J9 and replay cover the mode.
