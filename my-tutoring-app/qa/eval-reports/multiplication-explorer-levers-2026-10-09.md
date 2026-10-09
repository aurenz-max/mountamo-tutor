# multiplication-explorer levers, 2026-10-09

Run in the same pass as the W1 binding (`qa/tutor-reports/multiplication-explorer-w1-2026-10-09.md`).

## Failure inventory

Evidence classes: **documented** = catalog `commonStruggles`; **synthetic** = the journey's scripted wrong answers;
**inferred** = from the task. No real-learner evidence (no demonstrations log, misconception or remediation file for
this primitive; the 2026-03/06/07 eval reports cover content desyncs only).

| Mode | Failure (miss) | Class |
|---|---|---|
| product modes | adds the factors (`added_factors`) | synthetic (journey wrong), documented ("confusing groups and items per group") |
| product modes | one group too few or many (`one_group_short` / `_over`), off by one, other | inferred |
| distributive | gives one partial product (`one_part_only`) | documented ("struggling with distributive property") |
| fluency | cannot recall, nothing to count | documented by the mode (recall without a model) |
| missing_factor | types the product back (`gave_product`) | synthetic, documented ("missing factor confusion") |
| missing_factor | the shown factor, product minus factor, one off, other | inferred |

## Lever table (built)

| Mode | Lever | Kind | Carrier | Leak rule (code) | Answers |
|---|---|---|---|---|---|
| build, connect, commutative, distributive, fluency | `skip_strip`: one box per group with its size; running totals under every box but the last (`?`) | help | shown | prints the group size and totals up to (a-1)·b only | every product miss |
| fluency | `show_model`: the fact's array, rows × columns, no total | help | shown | prints the two factors only | every fluency miss |
| distributive | `break_apart`: the split with both partial products, sum `?` | help | shown | prints factors, split and partial products; not offered while the learner's own break-apart is open | `one_part_only`, `added_factors`, `off_by_one`, `other_product` |
| missing_factor | `skip_line`: jumps of the shown factor from 0, two past the product; only 0 and the product labelled | help | shown | prints 0, the shown factor, the product | every missing-factor miss |
| all | `smaller_fact`: one factor about halved (the hidden one on missing factor), same mode and slot | simplify | shown | never the item, its turnaround, product or answer; no square on missing factor; ungraded | the "other" misses and the big-fact misses |

No miss is left unanswered: every catalog miss is answered by a help lever on every item (2 × 2 and a hidden factor of 2
have no smaller fact; their help lever still answers every miss). Starting positions from `config.difficulty` were not
built: the generator's tier already sets the readouts and panels, and no lever starts pulled.

## Built

`multiplicationExplorerLevers.ts` (declarations, `leverNumbers`, `smallerFact`, `practiceLeaks`, `leverFacts`); component
lever state keyed by item, `pullLever`/`endPractice`, a scene `onScreen` fact per pulled lever, `SkipStrip` and `SkipLine`
renders; practice items count toward no tally; catalog `levers: true` and a lever sentence in guidance; the journey row
rebuilds `~smaller` items.

## Gates

- `typecheck:lumina` 0; full `tsc` 770 (= baseline, none in these files).
- `multiplicationExplorerLevers.test.ts` + `MultiplicationExplorer.levers.workspace.test.tsx` + `MultiplicationExplorer.workspace.test.tsx`: 37/37.
- Journey sweep J1-J13 on the six payloads: 6/6, 0 findings. `workspaceContract`, `misses.test.ts`, `activityContract`: green.
- Tutor replay (6 payloads x 6 moments x 5 samples): r4 1/30 distributive `stuck` "Try adding those two parts" after
  `break_apart`; guidance gained "after a lever: say where to look and ask a question; do not tell the learner to add or
  count"; r5 **0 misses** (`qa/tutor-reports/replay/multiplication-explorer-2026-10-09-r5.json`). The tutor pulls a lever
  on "I'm stuck" in 30/30 samples and describes it after the receipt. Imperative "add that last 4" still appears in a few
  lever replies the check does not flag; worth reading on the weekly Live sample.

## Failures with no lever

None by miss. Not covered: a learner who does not know what "groups of" means (a prerequisite, a lesson-level finding).
