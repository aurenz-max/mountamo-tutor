# M2 lever tables (compare and order, 2026-09-28)

Handoff 21 M2, `/add-support-tiers` Phases 1-2, tap modes. The draft in `inventory-2026-09-27/levers-math2.json` was
checked against each component and corrected where the component made it wrong; the user asked for these to be built
("build these", 09-28). No real-learner evidence exists for any of the four: evidence is each primitive's miss
function, the catalog's documented struggles and inference.

## comparison-builder — DONE 09-28 (contract R9)

Leak LEV-CB-1 fixed first (`/eval-fix`): easy drew every match line during the solve; also the Grade 1 count badges
and two text lines that allowed naming the side with more.

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| compare_groups | `model_match` (easy starts it) | help | reversed, said_equal, missed_equal | a model pair sharing no count with the item; never lines on the item |
| compare_groups | `tap_count` | help | reversed, said_equal, missed_equal | counts only objects the learner tapped; a tap never answers |
| compare_groups | `far_groups` | simplify | reversed, said_equal | both at most 6, 3+ apart, no count of the item's |
| compare_numbers | `quantity_marks` | help | reversed, said_equal, missed_equal | both drawn alike; no bigger mark, no symbol |
| compare_numbers | `far_numbers` | simplify | reversed, said_equal | 5+ apart, in band, no number of the item's |
| order | `slot_steps` | help | reversed | bar heights only; names no card |
| order | `quantity_marks` | help | two_swapped, other_order | amounts on the cards; no rank |
| order | `three_far` | simplify | two_swapped, other_order | three numbers 3+ apart, none of the item's (R3) |
| one_more_less | `learner_hops` | help | all six | 0 on the target; counts only up to the learner's own pick |
| one_more_less | `single_small` | simplify | wrong_way, short_by_more, over_by_more | one "one more" on a target of 5 or less; neither it nor its answer is the item's target or a neighbour |

Corrections to the draft: `match_pairs` (tap to draw lines on the item) would put a second tap meaning on the K
answer surface and its lines state the answer, so the matching is shown on a model instead. `number_path` duplicated
what the cells already print; `learner_hops` shows the learner's own step instead. `on_path` and `step_arrow` were
dropped: every miss is answered without them.

## compare-objects — order_three DONE 09-28 (contract R1, new partial contract doc)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| order_three | `order_steps` | help | reversed | wordless bars in the asked direction; never an object |
| order_three | `touch_slots` | help | not_all_placed | dots fill per touch; no order |
| order_three | `measure_grid` (not on weight) | help | two_swapped, other_order | uniform lines behind the drawing; singles out no object |
| order_three | `far_three` | simplify | two_swapped, other_order | three plain objects (blue, pink, green), sizes 25 apart, no name of the item's, never drawn in answer order; only when the item has two sizes within 25 |

Corrections: the draft's `baseline_align` already exists (length bars start at one edge, heights stand on one floor), so it is not a lever; `measure_grid` replaces it. Spoken modes (identify_attribute, compare_two, non_standard): later slice.

## number-sequencer — order_cards DONE 09-28 (contract R11)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| order_cards | `train_steps` | help | reversed | bars over the places grow left to right; never a card |
| order_cards | `card_marks` (cards ≤ 100) | help | two_swapped, other_order | amounts only; no rank |
| order_cards | `three_cards` | simplify | two_swapped, other_order | three cards 3+ apart, none of the item's, within 9 of its range and under the band ceiling, R9 layout |

Spoken modes (count_from, before_after, fill_missing, decade_fill, spot_error): later slice.

## ordinal-line — build_sequence DONE 09-28 (contract R1, new partial contract doc)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| build_sequence | `front_flag` | help | reversed | marks the front end the task names; never a picture |
| build_sequence | `place_dots` | help | place_left_empty, two_swapped, other_order | 1..n dots under the places; places only |
| build_sequence | `three_places` | simplify | two_swapped, other_order, place_left_empty | three new characters, three clues, never spoken front to back; only on a line of four |

Correction: the draft's `clue_cards` is not a lever. Every clue names an absolute place, so printing them lays out the line but one picture. Spoken modes (identify, match, relative_position, sequence_story): later slice.
