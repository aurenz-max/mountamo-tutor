# ratio-table — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C15. `withWorkspaceController`: the scripted path is kept (retry until correct, Next, hint ladder). Not committed.

## Modes and what code checks
All four catalog modes are gesture items. The activity's own check (`ratioCorrect`, `ratioTableWorkspace.ts`) is the judge, so there is no `expectedAnswer` and no key in the scene facts.

| Mode | Learner input | Check | Misses (`ratioMiss`) |
|---|---|---|---|
| build_ratio | multiplier slider (drag, arrow keys), Check | slider within 2x the item's tolerance of the multiplier | one_step_off, near_miss, too_high, too_low |
| missing_value | type the hidden cell, Check | within the item's tolerance (default 1%) | added_difference, unscaled, copied_known, unit_rate, multiplier, near_miss, too_high, too_low |
| find_multiplier | type the multiplier, Check | same | difference, scaled_value, unit_rate, inverse, near_miss, too_high, too_low |
| unit_rate | type the unit rate, Check | same | inverse_rate, difference, typed_quantity, near_miss, too_high, too_low |

A typed entry that is not a number is not a check (no commit).

## Fixed on both paths
- **build_ratio named its answer in the question.** The answer is the multiplier; flash-lite wrote "scale this recipe by a factor of 2.5" on 4/4 generated items (first payload today). The generator now builds the ask in code (`buildRatioAsk`): the base pair and one scaled value to reach ("...where Cookies is 48"), never the factor. The hint is rebuilt too.
- **missing_value with a hidden row whose base is 1** printed the answer in the header ("Scaled ×4" over a hidden 4). The header shows "×?" when the multiplier equals the answer.
- **The unit-rate banner** printed the answer on a find_multiplier item whose rate equals its multiplier (2 : 6 ×3). It is not drawn there.
- The slider starts at ×1, or ×2 when the item's multiplier is 1.
- **Workspace only:** the hint button, the "hint after 2 attempts" panel (the generated hint names the arithmetic) and Next are hidden. Input closes while a checked answer waits for Try again. A sr-only range input ("Multiplier") is the keyboard's control and the journey's; the answer box is labelled "Your answer".

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `RatioTable.workspace.test.tsx` 11/11; oracle `ratio-table.test.ts`, `pip/MathWorkspaces.surface`, `lessonWorkspacePlan`, `activityContract`, `misses`: pass.
- `workspaceContract -t ratio-table` 17/17. Sweep `ratio-table`: 4 payloads, 16 items, 0 findings (J1-J13), 16/16 misses named; J10 clean 100/100, J11 recover 67/0.

## Tutor replay (4 payloads x 5 samples, `replay/ratio-table-2026-10-09.json`)
0 misses on every check. Read by hand: after a miss the replies say ratios scale by multiplying, not adding, and ask what the base was multiplied by; "stuck" replies give the division to do (87.5 ÷ 25, 14 ÷ 4, 52 ÷ 4), never its result.

## Undriven modes
None.

## Open findings
1. Needs a browser check on the slider (Radix) and the typed input. Everything has run in JSDOM only.
2. missing_value shows the multiplier in the header, so once the tutor names the row the item is one multiplication ("What is 4 cups times 4?" in the replay). That is the mode as designed (beta 3.5); a harder variant that hides the header multiplier is an `/add-eval-modes` question, not done here.
3. The generated numbers are large for a Grade 6 default (125.5 x 2.4, 3.2 : 12.8). Scope belongs to `/topic-fidelity` or `/oracle-test`, not this binding.
4. The scripted tutoring block (`scaffoldingLevels`, `commonStruggles`) names `{{unitRate}}`; it only reaches the scripted path and goes when that fallback is retired.
