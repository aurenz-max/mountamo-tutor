# di-dice-roll levers: DI family 2 (2026-10-03)

`/add-support-tiers`, after the di-math-facts pilot. Table and failure inventory: `qa/support-levers/di-dice-roll-lever-table-2026-10-03.md`. No real-learner evidence. Every failure is synthetic (the spoken-miss ids) or documented (catalog `commonStruggles`).

## What was built

| Mode | Help | Simplify |
|---|---|---|
| count_pips | `model_roll`, `touch_dots` | `fewer_dots` (4 dots or more) |
| compare_dice | `model_roll` only | `far_pair` (other relation; none for a tie) |
| sum_two_dice | `model_roll`, `touch_dots`, `both_bracket` | `smaller_dice` |

- **New capability:** tappable dots. A tapped dot gets a ring, with no number or order. The rolled dice now sit in a plain group, because the disabled roll button swallowed taps.
- **Shared stage fix:** `DiTeachingStage` remembers every rolled item, not only the last one. Before this, returning from an easier roll covered the child's full roll again, and their next answer was ignored until they re-rolled. The mounted test found it.
- **New payload:** `w1-payloads/di-dice-roll.sum_two_dice.json` (one Flash generation), so J9 and the replay cover sums.
- **Catalog:** `levers: true`; the guidance says to model a different roll, never this one.

**Size:** 177 lines of lever module plus ~120 lines of component and stage changes, against 229 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diDiceRollLevers.test.ts`, 34) | leak table; every one of the 78 askable rolls has a non-leaking model of its mode (never a tie for compare); builders valid, same mode, never the roll, its swap or its answer; miss → lever; every named miss answered; a comparison model's fact never says left, right or same |
| Mounted (`DiDiceRoll.levers.workspace.test.tsx`, 4) | rings with no number; easy start not a pull; far_pair is a covered, ungraded roll, then the full roll is credited still rolled; bracket has no text; a refused pull changes nothing |
| Suites | 89 files pass, except 2 journey rows for addition-fact-strategies (another session's in-progress primitive) |
| typecheck | lumina 0; full tsc 772 (baseline 773; the new error is outside this slice) |
| Text replay (Flash, 3 payloads × 5) | 0 flags. After a miss or "I'm stuck", the tutor pulls `touch_dots` on count and sum and `far_pair` on compare |

**Found and fixed in the slice:**
- **A model named a face of the child's dice** (6 + 3 beside a 3 + 4: "three dots"), which counts that die for the child. A model now shares no face with the child's dice.
- **A compare model's side echoed the child's wrong word.** The model must have the other relation, and that is often the child's wrong answer, so "My turn: the right die has more" sounded like agreement after the child said "right". The tutor now points at the starred die and never names its side. Replay: 1 of 2 model lines named the side before, 0 of 10 after.
- **The re-covered full roll** (stage fix above).

## Not covered

- **compare_dice has no in-item help by design.** Any of it shows the answer. On a tie, the model is the only lever.
- **At easy the model card is on screen before the roll,** but in replay the tutor asked for the roll first and did not voice the model on the opening turn (0 of 5). That is acceptable: the model is there to point to after a miss.
- Not browser-checked (HUMAN-CHECKS #183, dice rows). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 3. di-shapes (count_sides, count_corners, name_shape, shape_review) is the next numeric-plus-naming pack. The shared stage needs nothing new.
