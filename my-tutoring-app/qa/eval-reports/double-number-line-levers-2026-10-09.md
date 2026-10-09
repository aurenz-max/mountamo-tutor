# double-number-line — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/double-number-line-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for double-number-line). Documented = the catalog's `commonStruggles` (adding instead of multiplying, cannot find the unit rate, scaling errors); synthetic = the journey's scripted wrong answers.

| Mode | Failure (miss) | Class |
|---|---|---|
| all | adds the rate once to the top value (`added_rate`) | documented, synthetic |
| find_missing, unit_rate | carries the given pair's difference over (`added_difference`) | documented |
| all | types the top value (`gave_top`), or the rate unscaled (`stopped_at_rate`) | documented ("cannot find unit rate" / scaling) |
| find_missing, unit_rate | copies the given bottom value (`gave_given`) | synthetic (unit_rate item 1) |
| unit_rate item 1 | top ÷ bottom (`inverted_rate`), multiplies the pair (`multiplied_not_divided`), subtracts (`subtracted`) | documented ("cannot find unit rate"), inferred |
| all | one jump too many or few (`one_unit_off`), other (`too_high`, `too_low`) | inferred |

## Lever table (built)

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| find_missing, unit_rate | split_given | help | rate item: every miss; else gave_given, added_*, too_* | shown | the given stretch cut into equal parts, unlabelled marks |
| every ask at top ≥ 2 | unit_jumps | help | every miss but the rate-item ones | shown | equal unlabelled jumps from the start to the asked point on both lines |
| all | grow_model | help | added_rate, added_difference, subtracted | both | picture outside the item, no digit; `does` forbids working the item on it |
| equivalent (ask > 2), find_missing (2 × given fits), unit_rate later items | smaller_ask | simplify | the mode's non-rate misses | shown | same mode and lines, own id and prompt, different top, bottom value outside ±0.1 of the item's |

Simplify builds: equivalent → ask at top 2; find_missing → ask at twice the given top (a whole-number copy of the pair, no rate needed); unit_rate later items → find the rate itself (the mode's own first step). **unit_rate's find-the-rate item has no simplify:** any easier find-the-rate on the same lines has the same answer. Its misses are all answered by split_given.

On a find-the-rate item, unit_jumps is not offered (one jump from the start is the answer segment) and a pull of it is refused. Starting positions stay the existing tier's aids (guides, unit-rate dot, labels, given badges); no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `doubleNumberLineLevers.test.ts` 23/23, `DoubleNumberLine.levers.workspace.test.tsx` 4/4, `DoubleNumberLine.workspace.test.tsx` 8/8.
- Sweep with `workspaceContract`, `misses`, `activityContract`, `lessonWorkspacePlan`, oracle, Pip surface: 10 files, 3183 passed. `double-number-line`: 3 payloads, 0 findings J1-J13; lever inventory: every miss answered on every mode.
- Replay (`replay/double-number-line-2026-10-09-r2.json`, 3 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: the tutor pulls unit_jumps / split_given itself on "stuck" and describes the change in the lever's words ("split into two equal parts", "three jumps"); it asks for half of the pair's bottom value or three jumps of the stated rate, never the result.

## Failures with no lever
None.

## Open
- Browser check on the jump arcs, the split marks and the grow picture (JSDOM only).
