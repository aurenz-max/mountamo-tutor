# histogram — support levers, 2026-10-09

Built on the W1 binding (`qa/tutor-reports/histogram-w1-2026-10-09.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception or remediation files for histogram). Documented = the catalog's `commonStruggles` (bin edges misread, skew direction misread, histogram vs bar chart); synthetic = the journey's scripted wrong answers.

| Mode | Failure (miss) | Class |
|---|---|---|
| identify_shape | skew named by the peak's side (`skew_reversed`) | documented, synthetic |
| identify_shape | long tail missed or invented (`missed_skew`, `called_skewed`) | documented |
| identify_shape | one peak vs two, flat vs peaked (`peak_count`, `flat_vs_peaked`) | synthetic / inferred |
| find_modal_bin | neighbor, near twin, other bar (`neighbor_bar`, `runner_up`, `shorter_bar`) | synthetic / inferred |
| read_frequency | a bin edge typed (`bin_edge`) | documented, synthetic |
| read_frequency | neighbor's count, whole-graph count (`neighbor_bar`, `total_count`) | inferred |
| read_frequency | height misread (`off_by_one`, `too_high`, `too_low`) | inferred (made likely by the old y-axis, fixed in W1) |
| estimate_center | a count typed (`off_axis`), the peak (`tallest_bar`), the axis middle (`axis_middle`), too far | inferred, synthetic |

## Lever table (built)

| Mode | Lever | Kind | Answers | Carrier | Leak rule |
|---|---|---|---|---|---|
| identify | outline_tops | help | all five | shown | a line over the bar tops; names nothing |
| identify | tail_model | help | skew_reversed, missed_skew, called_skewed | both | model outside the item, a skew that is never the item's shape |
| identify | peak_model | help | peak_count, flat_vs_peaked | both | model outside the item, never the item's shape |
| modal | level_line | help | all three | shown | at the tapped bar's height only; refused with nothing tapped |
| read | isolate_bar | help | neighbor_bar, total_count | shown | fades the other bars |
| read, center | axis_names | help | bin_edge, total_count / off_axis | shown | axis captions, no digit |
| read | count_marks | help | off_by_one, too_high, too_low | shown | unnumbered lines across the outlined bar |
| center | count_labels (only where the session withdrew labels) | help | axis_middle, too_high, too_low | shown | counts only; the center is not written |
| center | balance_model | help | tallest_bar, axis_middle, too_high, too_low, off_axis | both | model outside the item, no number |
| all | simpler_graph | simplify | the mode's misses | shown | same mode, own `~simpler` id and ask, a clean graph on the item's axis whose answer is not the item's (`practiceLeaks`) |

Simplify builds: identify → a clean graph of another shape, three choices; modal → four bars, peak at another position; read → four short bars (at most 5), an asked bar whose count differs; center → five symmetric bars whose center is outside the item's tolerance. Starting positions: the generator's existing tiers (stats panel, count labels, hint) stay; no new tier code.

## Gates
- `typecheck:lumina` 0; full `tsc` 770 (baseline).
- `histogramLevers.test.ts`, `Histogram.levers.workspace.test.tsx`, `Histogram.workspace.test.tsx`: 38/38. With activityContract, lessonWorkspacePlan, misses, pip surface, oracles, sourceControlBytes: 9 files, 546 passed.
- Sweep `-t histogram` with workspaceContract and misses: 22 pass; 4 payloads, 20 items, 0 findings J1-J13; lever inventory: every miss answered on every mode, `declaresLevers: true`.
- Replay (`replay/histogram-2026-10-09-r3.json`, 4 x 5): 0 misses on every check, including `no_change_before_receipt`. Read by hand: stuck replies pull outline_tops / peak_model / level_line / axis_names / balance_model and describe the change in the lever's words; none names a shape, the tallest bar, a count or a center. One estimate sample pulled simpler_graph and balance_model in one turn.

## Failures with no lever
None.

## Open
- Browser check on the lever pictures (outline, level line, marks, model graphs); JSDOM only.
- The payloads carry the default tier, so `count_labels` was exercised only in the mounted test, not the sweep.
