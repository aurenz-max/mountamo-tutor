# Math levers, class M1: the spoken modes (2026-09-29)

Handoff 21 M1, `/add-support-tiers`, one primitive at a time. With this slice every eval mode of counting-board, number-bond, base-ten-blocks and place-value-chart has its misses and levers, spoken modes included, so M1 is ready for its class Live pair (user ruling 09-28). Table: `qa/support-levers/m1-lever-tables-2026-09-28.md` (spoken slice section). No real-learner evidence: every failure is synthetic (the misses each primitive's spoken-miss function names) or documented (catalog struggles, the base-ten signature errors).

## What was built

| Primitive · mode | Help | Simplify (ungraded, then the full item) | Unanswered |
|---|---|---|---|
| counting-board count / count_on / take_away, add_more | `line_up` | `smaller_set` / `small_count_on` / `change_of_one` | — |
| counting-board subitize · group · compare | `five_groups` (K: a new look) · `tag_one_group` · `rows_apart` | — · `fewer_groups` · — | — |
| counting-board recount_moved | — | — | all four (holding the number is the task) |
| number-bond say turns (decompose, ten_and_ones, related_fact) | `ten_frame_part` | — | — |
| number-bond missing_part | `open_counters` now answers its misses | — | — |
| base-ten read_blocks | `block_worth`, `dim_others`, `group_fives` | `fewer_blocks` | two keypad-only ids |
| base-ten regroup | `trade_model`, `asked_column_glow` | `small_start` | two click-mat-only ids |
| place-value say_value | `model_value`, `block_picture` | — | — |
| place-value find_place | — | — | three (a place label names the answer by position) |

## The regroup journey fix, and a defect it found

- The journey row now drives a mixed payload's click-mat regroup: a trade and Check My Trade, or Check with no trade (`no_trade`). New payload `base-ten-blocks.mixed.json` (Grade 2: build, read, regroup, add) drives clean on J1-J9.
- **Defect, fixed:** the click mat applied a trade 400 ms after the tap (`setTimeout`), so Check pressed inside that window judged the untraded mat and marked a correct trade wrong. The trade now lands on the tap; only the pulse waits.

## Also found and fixed

- **The spoken-miss route was outside the app.** `my-tutoring-app/app/api/lumina/observe-spoken-miss/route.ts` (untracked, from the 1.4 session) sat in a root `app/` folder. That made Next use root `app/` as the app directory, so every `src/app` route 404'd on a fresh `next dev`, and the spoken-miss observer never had a route in the real app. It was moved to `src/app/api/lumina/observe-spoken-miss/route.ts`.
- **Payload coverage:** the saved read_blocks payloads are all round tens, so another block size never appears. New `base-ten-blocks.read_blocks-g3.json` (243, 352, ...). The place-value build payload never asks say_value: its dictations speak every value first. New `place-value-chart.build-g2.json`.

## Verification

| Gate | Result |
|---|---|
| Lever unit tests (miss → lever tables, leak rules, practice builders over many items, catalog answered/unanswered consistency) | baseTenSpokenLevers 23, countingBoardSpokenLevers 14, numberBondLevers +7, placeValueLevers +7 |
| Mounted pulls (screen and scene in one commit, lever on the next attempt, practice ungraded and returns, only the full item credited) | BaseTenBlocksDi 5, CountingBoard +4, NumberBond +2, PlaceValueChart +1 |
| Sweep J1-J9 | green (246). All M1 modes: every catalog miss answered or declared unanswered. Only baseline SW-4 (counting-board subitize) remains |
| Math + live-activity + manifest suites | 3863 pass after three pins were updated: base-ten's tool list (all modes now offer `pull_lever`, except an operate deck whose only lever starts pulled), and counting-board's "help changes nothing" (stuck-first now pulls `line_up`, per the ladder) |
| typecheck:lumina | 0 |
| Full tsc | 770 (baseline 773) |
| Text replay, Flash, 5 samples | base-ten 3 spoken payloads: 0 flags. counting-board 7: 2/30 (take_away: the tutor reads the easier board's own ask, the class handoff 21 S2 recorded). number-bond 4: 4 flags, all on the ten_and_ones build step (the recorder drives first items only, SW-9), 3 are checker matches on the ask or "one part". place-value 4: 2/5 **real**, filed as LB-12 (see below). `qa/tutor-reports/replay/*-2026-09-29.json` |

**LB-12 (open, `/add-live-tutor-tools`):** narrating `model_chart` on a dictated 330, the tutor states "a place with nothing in it gets a zero", which tells the learner the ones digit. It belongs to the build-item slice (R19). It surfaced now because the new build payload is the first with a zero in its dictation.

## Not measured

- The replay reaches only each payload's first item (SW-9). The spoken say turns of number-bond and place-value say_value got no replay moment. Their wording will be first seen in the class Live pair.
- Not browser-checked. A HUMAN-CHECKS row is owed for the M1 class sitting.
- The replay recorder (`journeySweep -t "tutor replay"`) throws on `comparison-builder.one_more_less` (`evaluationContext.submitEvaluation is not a function`). This is in the seams file, which carries another session's uncommitted edits. The M1 records were written.

## Next

M1 is Live-ready: `run_live_runtime.py --primitive <id> --mode mixed --lever --lesson-entry` with and without `--audio`, two runs for the class. On a primitive without a `mixed` payload, the saved mode payload stands in. This slice did not run it: it is the paid gate, and the user runs or approves it.
