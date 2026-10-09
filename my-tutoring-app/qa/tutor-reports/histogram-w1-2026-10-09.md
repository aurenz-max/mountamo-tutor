# histogram — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C19. `withWorkspaceController`: the scripted path is kept (retry until correct, timed auto-advance, hint). Not committed.

## Modes and what code checks
All four catalog modes are gesture items. The activity's own check (`histogramCorrect`, `histogramWorkspace.ts`) is the judge; no `expectedAnswer`, no key in the scene facts. A Check with no chip, no bar or no number only prompts and commits nothing.

| Mode | Learner input | Misses (`histogramMiss`) |
|---|---|---|
| identify_shape | tap a shape chip, Check | skew_reversed, missed_skew, called_skewed, peak_count, flat_vs_peaked |
| find_modal_bin | tap a bar (`bar-<i>`, now `role=button` with an aria-label), Check | neighbor_bar, runner_up, shorter_bar |
| read_frequency | type into "Your answer", Check (exact) | bin_edge, neighbor_bar, total_count, off_by_one, too_high, too_low |
| estimate_center | type, Check (within the item's tolerance, one bar width) | off_axis, tallest_bar, axis_middle, too_high, too_low |

## Fixed on both paths
- **read_frequency could not be read exactly.** Y ticks were `round(1.1 × max × i / 5)` placed at unrounded heights, so a bar of 9 sat under a line labelled 10. The axis is now labelled on whole counts (`frequencyAxis`).
- **Bar start values were printed under the bar's middle**, misplacing every bin edge. They now sit at the left edge.
- Shape chips moved from raw shadcn `Button` to `LuminaChoiceChip`.
- **Workspace only:** hint, Need a Hint and the scripted Try Again hidden; the 1.1 s auto-advance timer does not run; the legacy `useLuminaAI` is disabled and its `sendText` muted.

## Gates
- `typecheck:lumina` 0 (my files; sibling two-way-table had mid-edit errors during the run, gone at the end). Full `tsc` 770 (baseline 770).
- `Histogram.workspace.test.tsx` 11/11; `pip/MathWorkspaces.surface`, `oracles.test.ts`, `activityContract`, `lessonWorkspacePlan`, `misses.test.ts`, `sourceControlBytes` pass.
- Sweep `-t histogram` (with workspaceContract and misses): 22 tests pass. 4 payloads, 20 items, 0 findings J1-J13.

## Tutor replay (4 payloads x 5 samples)
- `replay/histogram-2026-10-09.json`: 0 misses on every check. Read by hand: on the bimodal identify item the tutor ignored the miss (`peak_count`) and coached skew ("which direction does the tail point?") on all miss and stuck replies: it is not told the bar heights and guessed a skew.
- Fix: guidance now says what each identify miss id contrasts and to teach that contrast, never a guessed shape.
- `replay/histogram-2026-10-09-r2.json`: 0 misses; the miss and stuck replies now ask "how many peaks do you see?". No reply names the shape, the tallest bar, a count or the center.

## Undriven modes
None.

## Open findings
1. FIXED (orchestrator follow-up): values on the axis maximum were in no bar. `computeBins` (histogramWorkspace.ts) is now the one bin function for the component and the generator (the oracle keeps a replica), and its last bar holds its right edge: a score of 100 is in [90, 100]. Prompts and labels write the last bin as `[a, b]`.
2. FIXED: identify_shape's key was the generator's intended shape. `classifyShape` reads the drawn bars (two separated peaks; flat; moment skewness beyond ±0.5; one peak with |skew| ≤ 0.25) or returns null when the graph is not clearly one shape. The generator redraws until the bars read as the intended shape, else keys the last clear draw by what it reads as, else drops the item; uniform data is now dealt evenly into the bins. Oracle check (e) flags a key the bars do not read as. 4 fresh identify sessions: 5/5 items kept, oracle clean.
3. Needs a browser check on tapping bars and the chips (JSDOM only).
4. The scripted `tutoring` block stays until the scripted fallback is retired.
