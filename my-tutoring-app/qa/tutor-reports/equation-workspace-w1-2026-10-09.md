# equation-workspace W1 binding (ROLLOUT C17), 2026-10-09

Plain shape (P). `withWorkspaceController('equation-workspace', EquationWorkspaceSurface, useScriptedProgress, useWorkspaceProgressFor(...))`.

## Modes and what code checks

| Mode | Learner action | Check (code) | Commit |
|---|---|---|---|
| guided-solve, solve, multi-step | tap operations from the menu | tapped id = next solution step's id | a wrong tap; the tap that leaves the variable alone. A right intermediate step is applied and not committed |
| identify-operation | choose one operation, press Check | chosen id = `correctOperationId` | on Check |

Misses (`equationMiss`, every mode): `later_step` (a step the path does later), `not_inverse` (the right step's opposite on the same number), `wrong_number` (same operation, another number), `other_operation`. Catalog `misses` = `EQUATION_MISSES_BY_MODE`.

Scene facts: equation, solveFor, the menu's labels, steps applied, current line, highlight/reminder/balance when shown, learner work. Never a line not reached, the solved value or which item is right. The scripted cues (`[ANSWER_INCORRECT] ... the correct next step is ...`) are muted and `useLuminaAI` is disabled on the workspace path; Next and the learner's Hint button are hidden there.

## Also fixed (both paths)

- **Menu position gave the answer.** The generator returned the solution's operations first: op0 was step 1 in 6 of 6 sampled items, so the first button was always right. The generator now shuffles the menu (checker reads ids).
- The per-challenge reset was keyed on the challenge object; now on its id.
- Scripted path: the last item's evaluation submitted from the Finish button; it now submits when every item is solved (the summary replaces the workspace at that moment).

## Gates

- `typecheck:lumina` 0 (a sibling's mid-edit `function-machine` journey row was the only error at one point; gone by the final run).
- `EquationWorkspace.workspace.test.tsx` 10/10 (after the combine fix); with `MathWorkspaces.surface`, `workspaceContract`, `misses.test.ts`, `activityContract`, `lessonWorkspacePlan`, oracles, `sourceControlBytes`: 10 files, 2931 tests passed.
- Sweep J1-J13 on 4 payloads (5 items each): 0 findings; misses 20/20 named; clean record score 100, recovery record 67.
- Tutor replay (`replay/equation-workspace-2026-10-09.json`), 4 payloads x 5 samples, gemini-3.8-flash: 0 misses on every check (start, miss, stuck, lever, credit).

Replies read: the tutor asks what undoes the attached term ("what operation undoes adding 15?") and points at the highlight in guided-solve, as guidance allows. On multi-step after the order lever, 2 of 5 stuck replies say "start by clearing the parentheses", which restates the lever panel on this item; recorded, not fixed.

## Undriven

None: every mode is driven through its real buttons (`choose` by label, `check`).

## Open findings

1. **Content clustering (generator).** Every payload item is `4x + b = c` or `3(2x + 4) + ... = ...`; the same equation appears twice in one lesson (solve: `4x + 15 = 47` twice; multi-step twice). Executor: `/add-number-pool-service` (the coefficients) or `/eval-fix`.
2. ~~Single-path check rejects a valid order (multi-step)~~ FIXED same day: the generator split "combine like terms" into two steps (variable terms, constants) in an order it picked, and a learner who combined in the other order was marked `later_step`. `mergeCommutingSteps` (domain) now merges adjacent combine steps into one "Combine like terms" step on both paths (component, generator output, adapter, journey row). Test: both generator orders credited with the same taps; undoing before tidying is still a miss. Sweep re-run: 0 findings, 20/20 named. Replay not re-run (only the multi-step menu label changed).
3. Catalog `description`/`constraints` still say grades 9-12+; the generator's G7-8 band is linear only. Not changed (the manifest reads it).
4. Needs a browser check on all four modes (jsdom only).
