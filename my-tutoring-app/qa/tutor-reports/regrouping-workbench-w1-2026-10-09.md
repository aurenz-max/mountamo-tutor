# regrouping-workbench — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C12. `withWorkspaceController`: the scripted path is kept (Check, Next Problem).

## Modes and what code checks
All four modes are gesture items: one digit typed per place box ("Ones digit", "Tens digit", ...), then Check Answer.
The activity's own check (`regroupingMatches`) is the judge; no `expectedAnswer`, no result in the scene facts. Carry/Borrow
trades are the learner's tool and are never checked.

| Mode | Misses (`regroupMiss`) |
|---|---|
| add_no_regroup | left_blank, wrong_operation, misplaced_digits, column_slip, other_answer |
| subtract_no_regroup | same |
| add_regroup | + no_carry |
| subtract_regroup | + smaller_from_larger, forgot_to_reduce |

## Fixed on both paths
- **The blocks showed the answer.** Since `dbfd66c8` the blocks were set to the result's digits, so 27 + 45 showed 2 ones and
  7 tens before the learner did anything, and Carry never had ten ones to trade. They start again as the problem's blocks.
- A wrong check printed "the correct answer is N"; now it does not. The generated hint (can carry a column sum) is scripted-only.
- A borrow with an empty next column (305 − 78) now says to break the next column first instead of doing nothing.
- The scripted completion could submit more than once (effect re-ran before the hook's flag landed); guarded.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `RegroupingWorkbench.workspace.test.tsx` 10/10; pip `MathWorkspaces.surface.test.tsx`, oracle test green.
- `workspaceContract`, `journeySweep`, `misses.test.ts`, `lessonWorkspacePlan`, `activityContract`: 2877 passed in the run.
- Sweep: 4 payloads, 13 items, 0 findings (J1-J12), 13/13 checked misses named.

## Tutor replay (4 payloads x 5 samples)
First run (`replay/regrouping-workbench-2026-10-09.json`): `no_key_before_try` 5/20 miss, 3/20 stuck, all on add_regroup, all
false positives: the per-digit key "7" (tens of 72) is also the ones digit of 27, read in "7 plus 5". Fixed in the harness,
opt-in: `LiveJourney.replayKeys` gives the whole answer for a row that types it in parts; J3/J13 still check every digit.
Re-run (`-r2`): 0 misses on every check. Replies ask about one column at a time and name the Carry/Borrow button; none
states the result. Guidance unchanged.

## Undriven modes
None. The row never trades (optional, unchecked).

## Open findings
1. **Generator** (`/add-number-pool-service`): payload operands are the prompt's own examples (27 + 45, 38 + 24, 23 + 14, 31 + 42, 52 − 17).
2. **Ruling owed:** after the learner's trades the block counts equal the answer digits (blocks-to-algorithm by design);
   the hard tier could withdraw the count numerals.
3. Needs a browser check of the restored block start and the Carry/Borrow flow (JSDOM only).
4. Saved payloads have no support tier (all regroup marks on); the hard-tier start is covered only by hand-built tests.
