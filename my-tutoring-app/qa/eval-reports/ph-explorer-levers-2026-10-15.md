# ph-explorer: support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/ph-explorer-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence: no demonstrations, misconception, remediation or eval-report files for ph-explorer.
Documented = the catalog's commonStruggles (acids and bases confused, scale direction, indicator colours, neutralization);
synthetic = the journey's scripted wrong taps; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| test | acid called base or base called acid (`acid_base_swapped`) | documented, synthetic |
| test | an acid or base called neutral (`said_neutral`); neutral called acid or base (`missed_neutral`) | inferred |
| indicator | a range on the other side of the purple middle (`other_side`) | documented, synthetic |
| indicator | the range next to the key (`next_band`), or further along (`far_band`) | inferred |
| neutralize | equal amounts chosen when the strengths differ (`equal_amounts`) | documented (struggle 3), inferred |
| neutralize | too little base (`too_little`), too much (`too_much`) | synthetic, inferred |

## Lever table (built, `phExplorerLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| test | litmus_key | help | every miss | the same three-row card on every item; it marks no row |
| indicator | color_chart | help | every miss | the six cabbage swatches with their ranges; it marks no band |
| neutralize | step_count | help | every miss | each liquid's steps from 7 and "each step is ten times as strong"; `stepsLeak` refuses any amount, "same", "equal", "more", "less" |
| neutralize | ph_meter | help | every miss | the pH number of the learner's last mix; refused before a mix |
| indicator, neutralize | fewer_choices | simplify | every miss | a different item of the same mode with three choices (indicator: another lesson substance in another band; neutralize: another equal-strength pair), own id `<id>~fewer`, ungraded; the full item comes back |

Starting position: no tier code; every item starts with every lever released (the generator reads no
`config.difficulty`).

## Gates
- `typecheck:lumina` 0 in ph-explorer files; full `tsc` 772 (baseline 770 + 2 from parallel sessions).
- `PhExplorer.workspace.test.tsx`: the miss rules, `nextLever` gives a help lever first for every catalog miss of every
  mode, each lever changes the screen and the scene fact in one commit and rides the next attempt, the meter is refused
  before a mix and keeps the last mix across Try again, the step lines pass `stepsLeak`, the simpler item is the same
  mode with three choices, never the learner's item, and never shrinks twice.
- Sweep lever inventory: every catalog miss answered on every mode, 0 gaps (J9, J12, J13 pass).
- Replay r2: every stuck reply pulls the mode's help lever itself and describes it after the call.

## Failures with no lever
- test has no simplify lever: there are already only three choices, and litmus gives the same colours for a strong and
  a weak acid, so no simpler test item exists in this mode.
