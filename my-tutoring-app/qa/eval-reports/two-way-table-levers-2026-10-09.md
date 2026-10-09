# two-way-table — support levers, 2026-10-09

`twoWayTableLevers.ts`, built on the W1 binding of the same day. Catalog `teachingWorkspace.levers: true`.

## Failure inventory
No real-learner evidence (no demonstrations, misconception files or remediation module for this primitive). Classes: **documented** = catalog `commonStruggles` (joint vs marginal, conditional divided by everyone, independence misread, decimal vs percent); **synthetic** = the journey's signature wrong answers; **inferred** = from the task.

| Mode | Miss (what the number shows) | Class |
|---|---|---|
| joint | row_denominator / column_denominator (cell out of its own row or column) | documented |
| joint | marginal_instead (whole row or column out of everyone) | documented |
| joint | wrong_cell | inferred |
| marginal | one_cell (a cell not added up with its row) | documented, synthetic |
| marginal | other_marginal | inferred |
| conditional | joint_instead (out of everyone) | documented, synthetic |
| conditional | reversed_condition, marginal_instead, wrong_cell | documented / inferred |
| independence | observed_joint (the observed cell, not expected) | documented, synthetic |
| independence | one_factor, added_factors | documented |
| all | typed_count (a count typed as the answer), near_miss, too_high, too_low | inferred |

## Lever table

| Lever | Kind | Modes | Carrier | What changes | Leak rule (code) |
|---|---|---|---|---|---|
| outline_question | help | all | shown | rings the asked cell / whole row or column / given group with the asked cell marked / the row and the column | draws no number |
| sum_frame | help | where a needed total is hidden | shown | "Male row: 28 + 12 = ?" for each hidden total the question needs | never writes the sum |
| out_of_frame | help | all | both | the probability in words: group counted ÷ group it is out of | no digit outside category names |
| model_table | help | all | both | a worked 2 x 2 example (Size × Color, ten counts), same kind of question | answer outside the item's tolerance |
| simpler_table | simplify | all | shown | same mode on a 2 x 2 table of ten, item's first category names, ungraded | own id, ask, counts and answer; same mode |

Every miss a check can name on an item is answered by a lever on that item (unit test over 6 tables x 5 tiers x every target, J12 on payloads). No miss is unanswered. Starting positions: the existing tier harness (which totals are drawn, the easy reminder) stays the starting position; no lever starts pulled, since the tiers already set the totals and a pulled frame would be redundant at easy.

## Gates
- `twoWayTableLevers.test.ts` 17/17 (simplify builder over every shape, leak rules per mode, miss -> lever table, every signature named).
- `TwoWayTable.levers.workspace.test.tsx` 3/3 (pull commits screen and fact together, next attempt records the lever, repeat pull refused with nothing changed, practice ungraded and the full item credited after).
- Sweep `-t two-way-table`: J1-J13 0 findings. `typecheck:lumina` 0; `tsc` 770 (baseline).
- Replay 4 x 5: 0 misses including `stuck` `no_change_before_receipt` and `lever`. Replies point at the outline or the words under the table after the receipt and never state a hidden total.

## Failures with no lever
None.
