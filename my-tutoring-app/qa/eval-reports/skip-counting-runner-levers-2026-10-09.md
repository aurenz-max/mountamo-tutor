# skip-counting-runner levers, 2026-10-09

/add-support-tiers, in the same pass as the C12 W1 binding. Not committed.

## Failure inventory
None of this comes from real learners. The misses are what `skipMiss` observes (synthetic: the sweep's wrong inputs and the unit tables). The catalog `commonStruggles` documents three struggles: losing the count rhythm, prediction errors, and not seeing the multiplication. No demonstrations, misconception or remediation files exist for this primitive.

| Mode | Misses (class) |
|---|---|
| count_along | skipped_a_landing (synthetic + documented rhythm), jumped_far (inferred) |
| predict | added_one, near_miss, off_count (synthetic + documented prediction errors); stayed_put, two_jumps, wrong_way (inferred) |
| fill_missing | near_miss (synthetic), not_a_gap, already_filled, off_count (inferred) |
| find_skip_value | one_over (synthetic), twice/half_the_step, typed_a_landing, one_short, short/over_by_more (inferred) |
| connect_multiplication | counted_start (synthetic), typed_product, typed_skip (documented: not seeing the multiplication), one_short, short/over_by_more (inferred) |

## Lever table (built)
| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| count_along | tick_numbers | help | both misses | The numbers of the count under their ticks. No landing is singled out. Starts shown unless the tier hides labels. |
| count_along, predict | count_trail | help | count misses / stayed_put, wrong_way, two_jumps | The learner's own landings ending "→ ?". Starts shown unless the tier hides the row. |
| predict | jump_sizes | help | added_one, two_jumps, near_miss, off_count, stayed_put | "+N" over jumps already made. Nothing is drawn past the character. |
| fill_missing | step_arcs | help | near_miss, off_count, not_a_gap | "+N" arcs between neighbours. Every gap keeps its "?". |
| fill_missing | ring_gaps | help | already_filled, not_a_gap | A ring on each open "?". No number is written. |
| find_skip_value | hop_dots | help | ±1, short/over, half/twice | Bare dots strictly inside the first three jumps (`dotsLeak`). |
| find_skip_value | model_count | help | twice, half, typed_a_landing | Another step on a side line. The step and its numbers are never the item's jump size (`modelLeaks`). |
| connect_multiplication | jump_marks | help | counted_start, one_short, short/over | Each jump is its own coloured arc. No numbers. |
| connect_multiplication | array_rows | help | typed_product, typed_skip, counted_start | One row of N squares per jump. Rows are not numbered, no caption. |
| every mode | simpler_count | simplify | every miss | Same mode, its own line and `~simpler` id. A plainer step (10, 5, 2; find 2, 5, 10), otherwise the same count made smaller. Never the item's answer, a gap of the item, or a later item's answer (`practiceLeaks`). None on an item that is already the plainest. |

Starting positions come from the existing tier, with no generator change. `showTrackLabels`, `showSequenceChips` and `showArray` set the starting state of the matching help, and easy also starts jump_sizes, step_arcs, hop_dots and jump_marks shown. A starting position is not a pull. Every catalog miss is answered on every item, so there is no `unanswered` entry.

## Built
- `skipCountingLevers.ts`: declarations, leak rules, facts, `practiceItem` with its own line, and `practiceParent`.
- `SkipCountingRunner.tsx`: lever and practice state keyed by item, `pullLever`/`endPractice`, the `onScreen` fact, and the lever pictures (`data-lever`).
- Catalog: `levers: true`. `liveJourneySpec.ts`: the row rebuilds a `~simpler` item from its parent.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770, the same as the baseline.
- `skipCountingLevers.test.ts` 54/54 (leak rules over 15 lines, builders, miss → lever table, the per-item payload check). `SkipCountingRunner.levers.workspace.test.tsx` 13/13.
- Sweep `-t skip-counting-runner`: J1-J13 0 findings on 5 payloads. The lever inventory shows every miss answered.
- Replay: see `qa/tutor-reports/skip-counting-runner-w1-2026-10-09.md`. stuck and lever: `no_change_before_receipt` 0/20, `no_key_before_try` 0/20. One `no_fix_before_try` (1/25) reads the pulled step_arcs "+5".

## Failures with no lever
None. One limit: count_along's simpler count shares numbers with the item (10, 20 in a count by 5s), because a plainer count of multiples always does. Its leak rule is a different step, not disjoint numbers.

## Open findings
1. The lever pictures need a browser check (JSDOM only). hop_dots on a line to 100 by 10s draws 27 dots in 600 px, so check that they stay readable.
