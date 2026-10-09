# balance-scale levers (2026-10-08 class sweep)

`/add-support-tiers` on all six modes: equality, equality_hard, one_step, one_step_hard, two_step_intro, two_step.
Production: `balanceScaleLevers.ts` (~250 lines), `BalanceLeverViews.tsx` (~50), wiring in `BalanceScaleEquality.tsx` and `BalanceScaleWorkshop.tsx` (~50 each), one line in the journey row. Tests: about 300 lines.

## Failure inventory

Evidence: no real-learner data and no demonstration logs. The misses are documented: catalog `teachingWorkspace.misses` and `balanceSpokenMisses`, which the `spoken_miss` observer names. Hands steps record no miss, because an incomplete move counts as exploration. The two_step explanation has no miss.

| Mode | Spoken step | Misses |
|---|---|---|
| equality, equality_hard | total / sum / resum, infer | one_short, one_over, short_by_more, over_by_more |
| one_step | added, relate | said_whole, said_given_part, added_both + off-by |
| one_step_hard | each, infer | said_remaining, said_parcels (said_whole is listed but cannot occur because known = 0) + off-by |
| two_step_intro, two_step | remaining | said_whole, said_change, said_one_parcel + off-by |
| | each, infer | said_remaining, said_parcels, said_whole + off-by |

## Lever table

| Mode / step | Lever | Kind | Carrier | Answers | Leak rule (in code) |
|---|---|---|---|---|---|
| sum steps (equality total, equality_hard sum/resum, one_step added) | `unit_cells`: the same weights again as unit squares in one row, with a gap after every fifth square | help | shown | one_short, one_over | no count printed; the scene fact has no number |
| equality / equality_hard infer | `balance_model`: a small level model scale with weight k on each side | help | both | one_short, one_over | k is never the item's answer or any session answer (`modelWeight`) |
| one_step added, relate | `part_whole_bar`: a bar labelled with the whole, split into the known part and an unlabelled `?` part | help | shown | said_whole, said_given_part, added_both (+ one off on relate) | the unknown part has no label |
| one_step_hard, two_step each/infer | `one_group`: group 1 and its parcel are ringed and the other groups faded | help | shown | said_remaining, said_parcels, said_whole, one off | no count printed |
| two_step remaining | `on_scale_only`: the set-aside areas faded, with one outline round all the parcels | help | shown | said_whole, said_change, said_one_parcel, one off | no count printed |
| sum steps (equality/equality_hard) | `two_blocks`: the same question on a load of two weights below the total | simplify | shown | far off | a practice answer is never a session answer; offered only on a load of 3+ blocks |
| infer (equality/equality_hard) | `one_block`: a scale balanced by one numbered weight | simplify | shown | far off | same; offered only on a load of 2+ blocks |
| one_step | `smaller_load`: the same known weight with one block to add | simplify | shown | far off | same; one parcel kept |
| share modes | `fewer_parcels`: two parcels and a smaller share | simplify | shown | far off | same; at least 2 parcels, and two_step keeps a known weight |

Per-item coverage: on an item that is already the plainest shape (no simpler build), the step's help lever also answers the far-off misses. A unit test checks that every miss on every spoken item has a lever on that item: 300 random workshop items plus every equality target from 1 to 20.

## Built

- Lever state and the practice step live in each surface. The `pullLever` commit is synchronous. A retry on the practice step keeps it, and `endPractice` restores the session board.
- Practice ids are `<item>~simpler`. The journey row answers them as spoken steps (`spokenExpected`), since their key is published.
- No catalog `unanswered` entries were needed. There were no rows in `QUEUE-item-gaps-2026-10-09.md` and no J12 baseline key.

## Tests

- `balanceScaleLevers.test.ts`: 18 pass. Covers the miss to lever tables, per-item coverage, leak rules for facts, `does` texts and the model weight, and the simplify builders (mode, floor, simpler shape, no session answer, not the source item, hands steps done on the practice board).
- `BalanceScale.levers.workspace.test.tsx`: 5 pass. Covers a pull changing the screen and scene fact in one commit, the attempt recording the lever, a refused pull changing nothing, and two_blocks and fewer_parcels practice that returns the full item blank and credits it as assisted. part_whole_bar and on_scale_only are also covered.
- The 8 existing balance test files pass (92 tests). The sweep filtered to `-t balance-scale` passes 6/6. `typecheck:lumina` has 0 errors in these files. The one remaining error is in hundredsChartLevers.test.ts, which another agent owns.

## Left without levers

- Hands steps (build, compose, recompose, complete, separate, share) record no miss, because an incomplete move counts as exploration. They already have the capped-turn model (`modelStage`).
- The two_step `explain` step is a free explanation and has no miss.
- Not done: Phase 6 starting positions from `config.difficulty`, and the `docs/contracts/balance-scale.md` contract, which does not exist yet.

## Batch gate 2026-10-09

`fewer_parcels` was refused on every item of all three saved share payloads: the shares {3, 2, 4} were all session answers or doubled to one. Widened the shares to {3, 2, 4, 5, 6}, keeping the load smaller than the item's (2 x share < parcels x target; share < target when the item already has two parcels). Journey sweep: `fewer_parcels` now offered on one_step_hard and two_step; two_step_intro (targets 2-5) still has no smaller load free and runs help-only, which answers the far-off misses. 0 findings, 0 unanswered.
