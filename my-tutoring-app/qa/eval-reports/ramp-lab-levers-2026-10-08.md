# ramp-lab levers — 2026-10-08 (`/add-support-tiers`, class sweep)

All five modes now publish levers; catalog `teachingWorkspace.levers: true`. No mode is left without a lever.

## Failure inventory

No real-learner evidence (no demonstrations log, no misconception run, no remediation module for ramp-lab).

| Mode | Failure (what the check sees) | Evidence class |
|---|---|---|
| compare_conditions | picks the setup that needs more push (`harder_setup`) | synthetic (journey wrong pick), documented (catalog struggles) |
| compare_conditions | `same_for_different`, `one_for_same` | catalog only: the UI has no "same" choice and every pool pair differs, so neither can occur today |
| find_threshold | push below the threshold (`load_did_not_move`), a push that moves but is not the least (`more_than_minimum`) | synthetic (journey, now driven), documented (hint text: "narrow the gap between a force that fails and one that works") |
| design_with_budget | too steep (`over_budget`), works but not steepest (`not_steepest`) | synthetic, documented (hint text) |
| plan_fair_test | `nothing_changed`, `other_condition`, `extra_condition` | synthetic (RampLab.workspace.test two-variable plan), documented (catalog: "The plan changes more than one condition") |
| explain_from_trials | reversed comparison, said the same, one trial only (new spoken misses) | documented (contract refusal list), synthetic (DI bench 2026-09-10 and the journey's reversed answer) |

## Lever table

| Mode | Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|---|
| compare | `both_ramps`: both setups drawn side by side, one scale, slope + surface texture + load | help | shown | all 3 | no force, arrow, mark or ranking word (`rampSketches`, fact test) |
| compare | `model_pair`: two measured model ramps differing in a condition the item does not touch | help | both | harder_setup, same_for_different | model condition is never one the item changes (`modelFor`); `does` forbids carrying it over |
| threshold, design | `test_log`: the learner's checked values, smallest first, with moved/stayed or climbs/too steep | help | shown | both misses | only tested values (`testLogLeaks`); refused before the first check |
| threshold | `lighter_load`: small wheel/box on a gentle smooth ramp, whole-newton steps | simplify | shown | both | different load, answer <= 8 N and not the parent's |
| design | `fewer_angles`: another load, six angles, unique steepest answer inside the range | simplify | shown | both | different load, answer not the parent's |
| plan | `same_or_changed`: each setting of B tagged "same as A" / "changed", live | help | shown | all 3 | every setting tagged alike; never names the condition |
| plan | `model_plan`: a fair plan for another condition | help | both | other, extra | never the item's condition |
| plan | `two_settings`: plan for another condition, two editable settings; a fair plan is its success | simplify | shown | all 3 | item's condition is never editable; different setup A |
| explain | `push_bars`: one bar per recorded trial, labelled with the changed setting | help | shown | all 3 | no ranking words; refused before both trials |
| explain | `model_explain`: worked explanation of two model trials on another condition | help | both | all 3 | never the item's condition; `does` fence |

No simplify on compare (every pair already changes one condition by a large step; a farther pair of the same condition shows the parent's direction, which is the answer) or explain (a simpler explanation drops the link to the changed condition, which is the mode). Help covers every miss on every item there. `supportTier` easy starts the first help lever of each mode pulled (not recorded).

## What was built

- `rampLabLevers.ts` (new): declarations, leak rules, three builders, facts, start positions, `practiceFromId`.
- `RampLab.tsx`: lever state, practice item, `pullLever`/`endPractice`, lever rendering, test log, step buttons (Less/More push, Gentler/Steeper) so a child (and the driver) can reach an exact 0.5 N step.
- `RampInvestigation.tsx`: `editable` settings, setting tags, push bars, rejected plans kept across a practice item.
- `rampLabWorkspace.ts`: `rampSpokenMisses` on the explain assignment. `rampChallenges.ts`: optional `editable`.
- Catalog: `levers: true`, explain misses. Journey row: drives threshold and design, rebuilds `~simpler` items. Baseline: `ramp-lab.plan_fair_test` J1 (no select input). Payloads saved for find_threshold, plan_fair_test, design_with_budget (one generation each).
- Contract `docs/contracts/ramp-lab.md`: lever section + changelog.

## Tests

- `rampLabLevers.test.ts` 24/24: leak rules per mode, builders over pool + saved payloads, `nextLever` table, per-item coverage of every catalog miss, spoken misses.
- `RampLab.levers.workspace.test.tsx` 7/7: per mode, a pull changes screen + fact in one commit, next attempt records the lever, refused pulls change nothing, practice items ungraded, full item back blank and credited; plan record keeps the pre-practice rejected plan and has no practice record.
- Existing: RampLab.workspace, rampLabWorkspace, rampChallenges, rampInvestigation, gemini-ramp-lab, ScienceWorkspaces.surface, catalog misses, lessonWorkspacePlan: 174/174.
- Journey sweep, ramp-lab payloads only (`-t ramp-lab`): 5/5 (compare, threshold, design, explain clean; plan baselined J1).
- `typecheck:lumina` 0. Full tsc 770 errors, none in these files.

Not run: tutor replay and Live (batch step). Needs a browser check on the new bars, sketches and step buttons' layout.

Ratio: about 540 production lines (levers module 331, RampLab ~150, RampInvestigation ~30, workspace/types ~30) against 433 lines of tests.
