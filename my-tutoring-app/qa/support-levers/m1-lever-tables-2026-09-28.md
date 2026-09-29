# M1 lever tables (approved by the user 2026-09-28)

Handoff 21 M1, `/add-support-tiers` Phases 1-2. Drafted by read-only agents against the code, spot-checked, then
approved as a whole ("counting-board first"). No real-learner evidence exists for any of the four: evidence is
synthetic runs, documented struggles (catalog `commonStruggles`, remediation, misconception reports) and what each
primitive's miss function observes. Each primitive still runs `/primitive-contract` first where it has no contract
doc, and its content defects below are fixed (`/eval-fix`) before its lever slice.

## counting-board — DONE 09-28 (contract R15)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| give_me_n | `running_count` | help | one_short, one_over, gave_all | counts only what was taken; never the ask |
| give_me_n | `count_tags` | help | short_by_more, over_by_more | the learner's own taken objects only |
| give_me_n, subitize_perceptual | `line_up` | help | give: by-more, gave_all; hands: one off | pile size unchanged; not when already a row or one object |
| give_me_n | `smaller_give` (⌈N/2⌉, floor 2) | simplify | by-more, gave_all | never the ask; < pile |
| subitize_perceptual | `two_hands` | help (assisted) | short_by_more, over_by_more | never removes the match; groups of 1 or 3 only |

Spoken kinds: no levers yet (help-first by `when` text is a later slice). recount_moved: none (holding the number is the task).

## number-bond — slice 1 DONE 09-28 (contract R22); slice 2, the equation steps, DONE 09-28 (R23)

No contract doc. The draft is in `levers-math2.json`, not math1.

- **decompose:** `made_ways` (help). The learner's own pairs as dot bonds, in the order made, never sorted. No simplify: any hint toward a new pair names the pair.
- **ten_and_ones:**
  - `ten_frame_part` (help): a 2×5 outline of each part's own counters; never fills a box, never "N more".
  - `smaller_teen` (simplify): practice at whole 11; refused when the whole is 12 or less.
- **related_fact:** `show_move` (help). The action button glows and the group that moves pulses.
- **missing_part** (spoken): `open_counters` (help, pulled by the tutor). The covered part stays covered.
- **Equation modes** (slice 2, approved and built 09-28): `equation_frame` (help: empty slots, no tile, no operator; answers unfinished_equation, other_numbers; easy starts with it drawn), `move_strip` (help: the committed move as dots, no numerals; answers false_equation, other_fact), `smaller_bond` (simplify: one build step on a bond with a whole of five or less, same move, never a session bond; answers false_equation, other_numbers). fact_family model steps reuse `show_move`. build_equation `other_move` is unanswered (swap is not offered). The drafted `worked_family` became `smaller_bond`: a practice step the learner builds, not a worked family to read.
- **Unanswered:** decompose and ten_and_ones `not_all_placed`, because a split commits only when the parts sum to the whole.
- **Fix first:**
  1. The `"_ + _ = _"` placeholder shows the operator (`NumberBond.tsx:1444`).
  2. The worked example can be another item's bond (`numberBondScript.ts:948-957`).
  3. No payloads for decompose, related_fact, fact_family or build_equation, and the journey row throws on the model and equation phases.
  4. The old spoken correction states the bond (`numberBondScript.ts:881`).

## base-ten-blocks — slice 1 (build_number) and slice 2 (operate) DONE 09-28; regroup and read_blocks (spoken mat) still to build

No contract doc. It has two surfaces: the click mat (build_number, operate, mixed) and the spoken mat (read_blocks, regroup).

- **build_number, operate:**
  - `column_counts` (help): the learner's own blocks only.
  - `ten_bracket` (help): only on the learner's own column holding 10 or more.
  - `blocks_total` (help): build_number only, never on operate.
  - `plainer_build` (simplify): same digit count, fewer interior zeros; never the item's digits or their reversal.
  - `single_regroup` (simplify, operate): one fewer carry or borrow, floor 1, new operands, M > S.
- **regroup:**
  - `trade_model` (help): a separate model mat with M ≠ the item's count; the model's result ≠ the prediction; never touches the learner's mat.
  - `asked_column_glow` (help).
- **read_blocks:** `block_worth` (help, voiced), set off by `when` text only.
- **Unanswered:**
  - regroup `no_trade` and `value_changed`: only a mixed click payload produces them.
  - read_blocks value misses: keypad only.
  - operate `digits_swapped`.
- **Fix first:**
  1. Generated hints state the answer ("24 has 2 tens and 4 ones"), shown after 2 tries.
  2. operate's easy and medium tiers show the Blocks Total, which is the answer.
  3. The not_traded_up feedback names the exact trade.
  4. operate has no payload.

## place-value-chart — slice 1 (dictated build items) DONE 09-28; say_value label still to build

No contract doc.

- **Dictated build items:**
  - `model_chart` (help): model ≠ target, not a session number, no shared column digit.
  - `column_worth` (help): the ×10ⁿ row.
  - `expanded_readback` (help): the learner's own digits.
  - `model_teen` (help).
  - `plain_number` (simplify): same digit count, no zero, no teen; offered only when the item has a zero or a teen.
- **say_value:** `glowing_place_label` (help).
- **find_place:** no lever. Any label gives the answer away by its position.
- **Unanswered:** identify `zero_left_empty`, because identify numbers carry no zero.
- **Fix first:**
  1. The readout fills empty columns with 0, so it reads "501" while the check marks the chart wrong.
  2. Three places say the chart checks only when full, but it commits after 4 s of stillness.
  3. `buildModelFor` caps at 3 digits and can share digits with the target.
  4. No compare or expanded_form payloads.

## Spoken slice — DONE 2026-09-29 (user: "continue" on the drafted table, with the model chart for say_value)

Every eval mode of the four primitives now has its misses and levers, spoken modes included. Contracts: base-ten R23,
counting-board R16, number-bond R24, place-value R20. Report: `qa/eval-reports/levers-M1-spoken-2026-09-29.md`.

| Primitive · mode | Help | Simplify | Unanswered (why) |
|---|---|---|---|
| counting-board count | `line_up` | `smaller_set` | — |
| counting-board count_on | `line_up` | `small_count_on` | — |
| counting-board take_away, add_more | `line_up` | `change_of_one` | — |
| counting-board subitize | `five_groups` (K: a new look) | — | — |
| counting-board group | `tag_one_group` | `fewer_groups` | — |
| counting-board compare | `rows_apart` | — | — |
| counting-board recount_moved | — | — | all (holding the number is the task) |
| number-bond say turns (decompose, ten_and_ones, related_fact) | `ten_frame_part` | — | — |
| number-bond missing_part | `open_counters` (now answers its misses) | — | — |
| base-ten read_blocks | `block_worth`, `dim_others`, `group_fives` | `fewer_blocks` | `one_ten_off`, `digits_swapped` (keypad of a mixed payload only) |
| base-ten regroup | `trade_model`, `asked_column_glow` | `small_start` | `no_trade`, `value_changed` (click mat of a mixed payload only) |
| place-value say_value | `model_value`, `block_picture` | — | — |
| place-value find_place | — | — | `said_value`, `next_place`, `other_place` (a label names the place by position) |

Changes from the draft: counting-board `touch_marks` and `pair_up` were not built (tap-to-count already marks taps, and
lines between groups would state which is bigger); `longer_look` became the K re-look inside `five_groups`;
place-value `glowing_place_label` became `model_value`; `block_picture` replaced a drafted enlarged digit.
