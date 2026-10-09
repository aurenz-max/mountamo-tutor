# percent-bar — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C15. `withWorkspaceController`: the scripted path is kept (retry until correct, Next, hint). Not committed.

## Modes and what code checks
All four catalog modes are gesture items. The activity's own step check (`stepCorrect`, `percentBarWorkspace.ts`) is the judge, so there is no `expectedAnswer` and no key in the scene facts. A challenge has 1-3 steps; a right step that is not the last opens the next step and commits nothing.

| Mode | Steps | Learner input | Misses (`percentMiss`) |
|---|---|---|---|
| identify_percent | 1 place | set the bar (tap, drag, arrow keys), Check | complement, placed_value, near_miss, too_high, too_low |
| find_part | 1 place | same | placed_discount, placed_value, near_miss, too_high, too_low |
| find_whole | 2 place (rate, total) | same | rate_not_total, whole_only, took_off_rate, placed_value, near_miss, too_high, too_low |
| convert | 2 place + 1 choice | bar twice, then tap an option, Check | placed_discount, placed_value, near_miss, too_high, too_low, bigger_discount, other_price |

## Fixed on both paths
- **identify_percent could not be answered.** Since 1c3e774d its question said "the stated percent" and no line on screen stated one; only the hint did. The generator's seven direct questions state the rate again.
- **The bar started at 50%,** which was the answer whenever a step's percent was 50. It starts at 0.
- **Workspace only:** the hint (it names the step's percent at easy/medium) and Next are hidden. A sr-only range input ("Percent on the bar") is the keyboard's control and the journey's.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `PercentBar.workspace.test.tsx` 9/9; oracle `percent-bar.test.ts` and `pip/MathWorkspaces.surface` pass.
- `workspaceContract` + `misses` + `lessonWorkspacePlan` + `activityContract` + sweep: pass. Sweep `percent-bar`: 4 payloads, 16 items, 0 findings (J1-J13), 16/16 misses named; J10 clean 100/100, J11 recover 67/0.

## Tutor replay (4 payloads x 5 samples, `replay/percent-bar-2026-10-09.json`)
0 misses on every check. Read by hand: replies after a miss ask what the scenario states and where it sits, or what is left of 100% after the discount; none names a step's percent. find_part "stuck" replies say "100 minus 25", the arithmetic, not its result.

## Undriven modes
None.

## Open findings
1. Needs a browser check on dragging the bar and the compare step. Everything has run in JSDOM only.
2. The scripted tutoring block (`tutoring.scaffoldingLevels.level2/3`) names `{{targetPercent}}`; it only reaches the scripted path, and goes when that fallback is retired.
