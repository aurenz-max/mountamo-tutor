# regrouping-workbench — support levers, 2026-10-09

`/add-support-tiers` on the W1 binding (`qa/tutor-reports/regrouping-workbench-w1-2026-10-09.md`).

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for this primitive).

| Mode | Failure (miss id) | Class |
|---|---|---|
| add_regroup | carry left out (`no_carry`) | documented (catalog commonStruggles), observed-synthetic (journey wrong input) |
| subtract_regroup | smaller digit from larger (`smaller_from_larger`) | documented, observed-synthetic |
| subtract_regroup | ten given, next place not reduced (`forgot_to_reduce`) | inferred |
| all | other operation (`wrong_operation`) | inferred |
| all | digits in the wrong boxes (`misplaced_digits`), box left empty (`left_blank`) | inferred |
| all | one column's fact wrong (`column_slip`), anything else (`other_answer`) | observed-synthetic (no-regroup wrong input) |

## Lever table
| Mode | Lever | Kind | Carrier | Answers | Leak rule |
|---|---|---|---|---|---|
| all | `column_colors`: written columns and answer boxes in their block colour, place names over them | help | shown | left_blank, misplaced_digits, column_slip, other_answer | no digit added |
| all | `operation_model`: picture outside the item, dots put together / crossed out | help | both | wrong_operation | no digit, none of the item's numbers |
| regroup modes | `regroup_marks`: the tier's red count + only-needed Carry/Borrow button | help | shown | no_carry / smaller_from_larger, forgot_to_reduce | offered only where the session hides it; refused when no column needs a trade |
| regroup modes | `trade_model`: ten cubes → one rod (or back), captioned in words | help | both | same | no digit |
| all | `smaller_problem`: fewer trades, then one column fewer, then a one-digit bottom number | simplify | shown | trade misses, column_slip, other_answer | no operand or result of the item; same mode; strictly smaller; seeded per item |

Every catalog miss is answered by a help lever on every item (unit-tested over ~1000 problems per mode). The smallest problem
of a mode (27 + 5, 43 − 8) has no simplify. Starting positions: the generator's existing tiers (easy's marks = `regroup_marks`
already on); no generator change.

## Built
`regroupingWorkbenchLevers.ts` (declarations, `smallerProblem`, `simplerLeaks`, `leverFacts`, `leverTextLeaks`); component lever
state keyed by item, `pullLever`/`endPractice`, pictures, practice problem; catalog `levers: true`; journey row rebuilds the
practice problem.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `regroupingWorkbenchLevers.test.ts` 18/18; `RegroupingWorkbench.levers.workspace.test.tsx` 4/4; `RegroupingWorkbench.workspace.test.tsx` 10/10.
- Sweep J1-J13 + contract + misses + pip + oracle: 7 files, 2941 passed; regrouping-workbench 4 payloads, 0 findings.
- Replay (`replay/regrouping-workbench-2026-10-09-r3.json`, 4 x 5): 0 misses on all checks incl. `lever` and
  `no_change_before_receipt`. Stuck replies pull `column_colors` (no-regroup), `trade_model` (regroup) or `smaller_problem`;
  lever replies describe the picture and ask about the ones column; none states the result.

## Failures with no lever
None.
