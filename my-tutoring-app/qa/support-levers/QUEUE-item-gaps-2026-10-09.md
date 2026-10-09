# Per-item lever gaps (J12), 2026-10-09

Found when the journey sweep began checking lever coverage per item (J12) instead of per mode (J9). Each row is a checked miss on a saved payload item with no lever on THAT item answering it. Executor: `/add-support-tiers` (lever on that item shape, or a per-item `unanswered` reason). Remove the payload's J12 baseline entry when its row closes.

| Payload | Item gaps | State |
|---|---|---|
| base-ten-blocks.mixed | read_blocks-1: no lever on this item answers "one_ten_off" (levers here: none); regroup-2: no lever on this item answers "no_trade" (levers here: none) | closed 2026-10-09: click-mat `ten_model` + `plainer_read` on read, `ten_model` on regroup (`qa/eval-reports/base-ten-blocks-levers-2026-10-08.md`) |
| base-ten-blocks.operate | subtract_with_blocks-2: no lever on this item answers "one_ten_off" (levers here: column_counts) | closed 2026-10-09: `trade_mark` on every operate item with a regroup (same report) |
| counting-board.subitize_perceptual | c1: no lever on this item answers "one_over" (levers here: two_hands); c4: no lever on this item answers "one_over" (levers here: two_hands) | closed 2026-10-09: `pair_up` lever (qa/eval-reports/counting-board-levers-2026-10-08.md); J12 baseline entry removed |
| habitat-diorama.connect | chal-3: no lever on this item answers "unconnected" (levers here: direction_model) | open |
| knowledge-check.recall | p0-mct: no lever on this item answers "one_less" (levers here: none) | closed 10-09: `spread_pictures` help lever (the question's pictures drawn apart, touch to mark; `qa/eval-reports/knowledge-check-levers-2026-10-08.md`) |
| letter-sound-link.hear_see | ch1: no lever on this item answers "other_letter" (levers here: none); ch2: no lever on this item answers "other_short_vowel" (levers here: none); ch3: no lever on this item answers "other_letter" (levers here: none); ch4: no lever on this item answers "other_letter" (levers here: none) | closed 2026-10-09: `pair_model` help on every hear-see item (two non-session letters with pictures, same sound kinds); baseline entry removed; `qa/eval-reports/letter-sound-link-levers-2026-10-08.md` |
| math-fact-fluency.match | c3: no lever on this item answers "one_short" (levers here: far_match) | closed 2026-10-08: count_marks now on fingers pictures (dots under the hands) |
| math-fact-fluency.visual_fact | c2: no lever on this item answers "other_operation" (levers here: smaller_fact) | closed 2026-10-08: two_parts + count_marks now on fingers pictures (dots under the hands) |
| number-line.identify | plot_point-3: no lever on this item answers "one_past" (levers here: none) | closed 2026-10-09: `last_try` ring on the learner's wrong point where count hops would start on the target (`qa/eval-reports/number-line-levers-2026-10-08.md` addendum); J12 baseline entry removed |
| number-line.jump | show_jump-2: no lever on this item answers "wrong_direction" (levers here: none) | closed 2026-10-09: `which_way` arrow on a first jump of 1 (same report); J12 baseline entry removed |
| pattern-builder.create | c1: no lever on this item answers "no_repeat" (levers here: none); c2: no lever on this item answers "no_repeat" (levers here: none); c3: no lever on this item answers "no_repeat" (levers here: none); c4: no lever on this item answers "no_repeat" (levers here: none); c5: no lever on this item answers "no_repeat" (levers here: none) | open |

Note: `pattern-builder.create` is the pre-OB-9M payload (no asked shape); the current generator always sets one. Regenerate the payload rather than add a lever.
