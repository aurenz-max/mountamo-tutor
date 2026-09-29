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

## Spoken slice — DONE 09-29 (handoff 23 step 2)

Every spoken miss below is what the primitive's spoken-miss function names (handoff 20 Part B), so the evidence is
synthetic; catalog `commonStruggles` documents the compare-objects ones. No real-learner evidence.

### compare-objects (contract R2)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| compare_two | `word_model` | help | other_object | a model pair fixed per comparison word; never read from the item |
| compare_two | `far_pair` | simplify | other_object | two plain objects 55 apart, no name of the item's; only when the item's sizes are within 25 |
| identify_attribute | `menu_pictures` | help | other_attribute | one picture per spoken choice, in ask order, none marked |
| identify_attribute | `fewer_choices` | simplify (on the item) | other_attribute | greys one wrong choice; never the answer; menus of three or more |
| non_standard | `tap_boxes` | help | one_short, one_over | fills only the boxes the learner taps; no numeral |
| non_standard | `five_marks` | help | short_by_more, over_by_more | a line after every fifth box; no numeral; more than five boxes |
| non_standard | `shorter_measure` | simplify | short_by_more, over_by_more | same unit, at most half the boxes (2+), not the item's count, no session count where one is free |

`showUnitNumbers` stays a post-answer reveal (it numbers the boxes up to the answer).

### number-sequencer (contract R12)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| count_from | `step_arrow` | help | said_start, wrong_direction, skipped_one | on the printed car beside the glowing one; the step, never the landing |
| before_after | `step_arrow` | help | said_shown, wrong_side, skipped_one | same |
| fill_missing, decade_fill | `step_arrow` | help | said_neighbor, counted_by_one, one_short, one_over | same |
| all four above | `car_marks` | help | teen_ty_swap, decade_word (+ short_by_more, over_by_more on the gap modes) | sticks and dots on printed cars only; trains of 100 or less |
| all four above | `smaller_numbers` | simplify | as `car_marks` | the train shifted down by tens (step, ones digits, decade crossing kept), one gap, an answer none of the item's numbers |
| spot_error | `model_train` | help | said_repair, said_neighbor | a model train sharing no number with the item, its wrong number circled |

Correction to the draft: a number path (the `showNumberLine` tier) is not a lever: it prints the answer in order beside the train.

### ordinal-line (contract R2)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| identify | `front_flag` | help | wrong_end | marks the front end, never a picture |
| identify | `tap_marks` | help | next_to_place | rings what the learner taps; no order, no number |
| identify (Grade 1, answer is a place word) | `word_model` | help | cardinal_for_ordinal | three model circles with 1st 2nd 3rd, the same for every item |
| identify | `shorter_line` | simplify | wrong_end, next_to_place | four new characters, another place than the item |
| relative_position | `front_flag` | help | wrong_side | as above |
| relative_position | `side_model` | help | said_anchor, wrong_side | three model circles fixed per question word |
| relative_position | `shorter_line` | simplify | said_anchor, wrong_side | three new characters, anchor second, same question word |
| match | `place_model` | help | cardinal_for_ordinal, next_to_place | circles up to the place the card prints; no words |
| sequence_story | `word_model` | help | cardinal_for_ordinal | as above |
| sequence_story | `short_story` | simplify | next_to_place, cardinal_for_ordinal | four new characters told front to back, another middle place |

Not a lever: `place_dots` on identify (dots under the line count the answer, like the hidden place labels). New
payload `ordinal-line.identify-g1.json` (Flash, no Live): the saved identify payload is K, whose answers are names,
so `cardinal_for_ordinal` never appeared on it.
