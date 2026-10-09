# two-way-table — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C19. `withWorkspaceController`: the scripted path is kept (retry until correct, hint, Next, Skip). Not committed.

## Modes and what code checks
All four catalog modes are gesture items: the learner types a probability and presses Check. The activity's own check (`twoWayCorrect`, `twoWayTableWorkspace.ts`) is the judge, within the item's tolerance (0.02), so there is no `expectedAnswer` and no key in the scene facts. A non-number is not a check (no commit).

| Mode | Misses (`twoWayMiss`) |
|---|---|
| joint_probability | row_denominator, column_denominator, marginal_instead, wrong_cell |
| marginal_distribution | one_cell, other_marginal |
| conditional_probability | joint_instead, reversed_condition, marginal_instead, wrong_cell |
| independence_test | observed_joint, one_factor, added_factors |
| every mode | typed_count, near_miss, too_high, too_low |

## Changed
- **Generator:** every challenge carries `target` (`{ row, col, given }`), the cell, row or column the question names. The miss check and the levers read it; `locateTarget` recovers it from the question and key for an older payload.
- **Both paths:** the placeholder was `0.25` and the help text said "e.g., 0.25", a possible answer (a joint cell of 20 out of 80). Now `0.00` and no example number.
- **Workspace only:** Show hint and the hint panel (the generated hint states the division and the hidden total), Next and Skip are hidden. Input closes while a checked answer waits for Try again. The answer box is labelled "Your answer". The scripted `sendText` is muted and `useLuminaAI` disabled (its context carried `correctAnswer`).
- Scene facts: kind, scenario, rows, columns, every cell, which totals are drawn (with their values) and which are hidden, the easy-tier reminder line when drawn, the learner's typing.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `TwoWayTable.workspace.test.tsx` 11/11. `workspaceContract`, `misses`, `lessonWorkspacePlan`, `activityContract`, `pip/MathWorkspaces.surface`, oracle `two-way-table`, `sourceControlBytes`: 7 files, 2829 tests pass.
- Sweep `-t two-way-table`: 4 payloads, 16 items, 0 findings (J1-J13), 16/16 misses named; J10 clean 100/100, J11 recover 67/0.

## Tutor replay (4 payloads x 5 samples, `replay/two-way-table-2026-10-09.json`)
0 misses on every check (start, miss, stuck, lever, credit). Read by hand: after a miss the replies say which group the probability is out of ("given Male, we only look at the males, not everyone"); on hidden-total items (marginal, conditional) no reply states a row or grand total, they ask the learner to add the row. Independence replies name the grand total (80), which that item draws. No guidance change was needed.

## Undriven modes
None.

## Open findings
1. **One item shape per lesson without a tier.** With no `config.difficulty` every payload is a 2 x 2 table; 2 x 3 and 3 x 3 appear only at medium/hard. The four payloads cover 2 x 2 only; 3 x 3 is covered by hand-built items in the tests. Whether the manifest should pass a tier is a `/eval-test` question.
2. Needs a browser check on the typed input and the lever pictures; everything ran in JSDOM.
3. The scripted tutoring block (`scaffoldingLevels`, `aiDirectives` naming "Next Table") reaches the scripted path only and goes when that fallback is retired.
