# systems-equations-visualizer — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/systems-equations-visualizer-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or earlier eval-report files for this primitive). Documented = the catalog's `commonStruggles` (reading the crossing wrong, forgetting to back-substitute, signs not lined up in elimination); synthetic = the journey's scripted wrong answers; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| graph | crossing misread: x and y swapped, a sign, one step off (`swapped`, `*_sign`, `off_by_one`) | documented, synthetic |
| graph, substitution | a line's y-axis crossing given (`intercept_point`) | inferred |
| all | a pair on one line only (`one_line_only`): one equation solved | documented (verify in both), inferred |
| substitution, elimination | x right, y wrong (`x_only`): the back-substitution | documented |
| elimination | sign lost adding or scaling (`x_sign`, `y_sign`, `both_signs`, `y_only`) | documented |
| all | anything else (`wrong_point`) | inferred |

## Lever table (built, `systemsEquationsLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| graph | axis_guide | help, both | swapped, signs, intercept_point | words only, no digit |
| graph (hard tier) | every_line | help, shown | off_by_one, x_only, y_only, wrong_point | axis numbers only |
| substitution | set_equal | help, both | intercept_point, y_only, wrong_point, x_sign, both_signs | the item's two right sides set equal; no solved value |
| elimination | line_up | help, both | signs, y_only, wrong_point | coefficient columns and which one cancels; no solved value, no digit in the note |
| all | check_both | help, shown | every miss | only the learner's own checked pair and works / does not work; refused before a check |
| all (where the tier did not open the steps) | method_steps | help, both | one_line_only, intercept_point, x_only, y_only, wrong_point | words, no digit |
| all | worked_example | help, both | every miss | a different system; its solution shares neither coordinate with the key; never the key's pair or the item's equations |
| all | simpler_item | simplify | every miss | slopes one and minus one (graph, substitution) or x + y and x - y (elimination), solution within 3, not the key or the key swapped; own id, ask and equations; same mode (`practiceLeaks`) |

The mode's own lever is listed first, so the observer's next lever after a sign or swap miss is axis_guide / set_equal / line_up, and after one_line_only or x_only it is check_both. Starting positions: the existing tier flags (steps open at easy, axis numbers withheld at hard); no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 771 (not this primitive's files).
- `systemsEquationsLevers.test.ts` 27/27 (leak rules, worked-example arithmetic and leaks, the simplify builder over every integer key in [-4, 4] (about 560 systems, 3 tier shapes), every miss answered on every item, miss -> lever table), `SystemsEquationsVisualizer.levers.workspace.test.tsx` 7/7, `SystemsEquationsVisualizer.workspace.test.tsx` 7/7; with workspaceContract, misses, lessonWorkspacePlan, activityContract, pip surface, oracles, sourceControlBytes: 3149/3149.
- Sweep `systems-equations`: 3 payloads, 12 items, 0 findings J1-J13; lever inventory: every catalog miss answered on every mode, `declaresLevers` true, 0 open.
- Replay (`replay/systems-equations-visualizer-2026-10-09-r2.json`, 3 x 5): 0 misses on every check, but read by hand: on substitution `swapped` the tutor said "what happens if you swap your x and y" (2/5 stuck, 1/5 miss), which hands over the answer. Guidance now forbids suggesting a swap, a sign flip or keeping one coordinate. `-r3.json`: 0 misses on every check; swap/flip suggestions 0/45; substitution replies send the learner back to setting the right sides equal.

## Failures with no lever
None. A system already of slopes one and minus one (or x + y, x - y) with a small solution has no simplify lever; its misses are answered by help levers.

## Open
- Browser check on the lever pictures (the worked-example inset, the line_up table, the check rows) and the canvas.
- On a miss the tutor sometimes describes check_both's result before seeing it (r2 elimination: "they work in one equation" when neither did, 1/5). The replay's `no_change_before_receipt` check covers only the stuck moment; a doctrine question for the shared layer, not this primitive.
- The payloads carry no tier, so the sweep never offers every_line; the unit and mounted tests cover it on hard-tier items.
