# ratio-table — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/ratio-table-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval-report files for ratio-table). Documented = the catalog's `commonStruggles` ("only scaling one value", "adding instead of multiplying", "cannot find unit rate", "confusing multiplier with unit rate"); synthetic = the journey's scripted wrong answers.

| Mode | Failure (miss) | Class |
|---|---|---|
| missing_value | adds the known row's change (`added_difference`) | documented, synthetic |
| missing_value | copies the base cell (`unscaled`) or the other scaled cell (`copied_known`) | documented ("only scaling one value") |
| missing_value | types the unit rate or the multiplier (`unit_rate`, `multiplier`) | documented ("confusing multiplier with unit rate") |
| find_multiplier | scaled minus base (`difference`) | documented, synthetic |
| find_multiplier | types a scaled value or the unit rate (`scaled_value`, `unit_rate`) | documented / inferred |
| find_multiplier | base ÷ scaled (`inverse`) | inferred |
| unit_rate | first ÷ second (`inverse_rate`) | documented ("cannot find unit rate"), synthetic |
| unit_rate | second minus first, or one of the two numbers typed (`difference`, `typed_quantity`) | inferred |
| build_ratio | slider one whole step off (`one_step_off`) | synthetic |
| all | near, too high, too low | inferred |

## Lever table (built, `ratioTableLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| missing, find, build | bar_chart (only where the session hides it) | help | the adding / copying misses, too_high/low | hidden cell's bar labelled "?" |
| missing | unit_rate_banner (only where hidden) | help | added_difference, unscaled, near/too | never when the rate equals the answer |
| missing, find, build | times_arrows | help | added_difference, unscaled, copied_known, multiplier, unit_rate / difference, scaled_value, unit_rate / one_step_off, near, too | find: "× ?"; missing: the header's multiplier or "× ?"; build: the slider's current value |
| find | division_frame | help | inverse, unit_rate, difference, near, too | "scaled ÷ base = ?" on a row whose numbers are not the answer |
| unit_rate | equal_groups (whole first quantity 2-12) | help | every unit_rate miss | boxes hold "?", caption has no digit |
| all | model_ratio | help | every miss of the mode | a worked pair outside the item; none of its numbers is the answer |
| all | simpler_problem | simplify | the mode's misses | same mode, base 2 or 3, whole answer; own id and ask, different base and answer (`practiceLeaks`) |

No lever text, `does`, or scene fact carries a digit (`leverTextLeaks`). Starting positions are the existing tier's banner and bar chart (`gemini-ratio-table.ts`); no new tier code, and a starting position is not a pull.

## Gates
- `typecheck:lumina` 0. Full `tsc` 770 (baseline 770).
- `ratioTableLevers.test.ts` 19/19 (leak rules per mode over 18 bases x 9 multipliers, simplify builder, miss -> lever table), `RatioTable.levers.workspace.test.tsx` 4/4, `RatioTable.workspace.test.tsx` 11/11.
- `misses`, `activityContract`, `lessonWorkspacePlan`, oracle, Pip surface: 8 files, 312 passed. `workspaceContract -t ratio-table` 17/17.
- Sweep `ratio-table`: 4 payloads, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode.
- Replay (`replay/ratio-table-2026-10-09-r2.json`, 4 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: on "I'm stuck" the tutor pulls times_arrows, division_frame or equal_groups itself and describes the arrows / frame / boxes after the receipt; none names the answer. 2/5 build_ratio stuck samples pulled simpler_problem and times_arrows in one turn.

## Failures with no lever
None.

## Open
- Browser check on the lever pictures (JSDOM only).
- missing_value's arrows repeat the header's multiplier, so with the arrows on, the item is one multiplication. Same mode-design question as the W1 report's finding 2.
