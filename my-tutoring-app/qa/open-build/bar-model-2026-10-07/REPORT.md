# bar-model `make_graph` — open build, 2026-10-07

The learner fills an empty picture graph to fit an ask: "Make a graph where apples have the most", "…the fewest",
"…apples and pears have the same number", "…there are two more apples than pears". Code checks the bars at
"I'm done!" against the rule; any graph that fits passes. There is no answer key.

**Primitive choice:** bar-model's catalog entry is the single home for bar and picture graphs and already has the K
one-to-one picture rows and the workspace. dot-plot, coordinate-graph and graph-board do not fit a category graph.
No `docs/contracts/bar-model.md` exists; the mode is a fork with its own branches and no existing mode changed.

## What was built
- **Check** (`barModelBuild.ts`): the rule (`most | fewest | same | more_than`, named rows, `by`), the ask written by
  code, the miss, the verdict words. The verdict describes the learner's own graph, never what to change.
- **Misses**, in precedence: most/fewest `reversed`, `tied`, `other_row`; same `left_empty`, `not_same`; N more
  `reversed`, then `one_short` / `one_over` / `short_by_more` / `over_by_more`.
- **Surface** (`GraphBuildScene.tsx`): one `<svg>`. Tap a column to add a picture, tap a picture to take one out,
  10 per column, no numbers printed. Lever drawings are `data-aid`. Columns are Pip `row-<i>` targets.
- **Watcher:** `useBuildWatcher`, `numbers: 'never'`; off while checking and after a pass.
- **Numeric facts:** each bar as a number (`apples: 3`); `workHistory` tested `apples 0 → 4 → 3`.
- **Commit:** "I'm done!" through `commitCheck`, no `armStillness`. Try again keeps the graph and the verdict.
- **Levers**, all off at start: `level_line` (help, dashed line at the compared bar's top), `bar_counts` (help, the
  learner's own count above each bar), `two_bars` (simplify, ungraded two-bar practice, then the full graph empty).
  Together they answer every miss; catalog `levers: true`.
- **Generator:** flash-lite picks themes that fit the topic (11 code-owned category sets) and writes the title. Code
  owns categories, rule, named rows and ask, spreading ask kinds across a session. K: most, fewest, same; G1+ adds N
  more. The first run picked off-topic third themes; tightening the theme ask fixed it.
- **Wiring:** catalog mode β 1.9 (`build_one_to_one` + 0.1), `answers: ['build']`, backend `PROBLEM_TYPE_REGISTRY`,
  live adapter validation, oracle, metrics type, journey-sweep payload and driver inputs.

About 240 new production lines and 290 changed across 9 files; about 200 test lines.

## Gates (worktree)
| Gate | Result |
|---|---|
| `barModelBuild.test.ts` | 24/24 |
| `BarModel.makeGraph.workspace.test.tsx` (real runtime) | 3/3 |
| Existing bar-model tests (workspace, pure, pip, oracle) | green; fixture list gained the mode |
| live-activity suite | 35 files green |
| Journey sweep on the new payload | 4 items, 4/4 misses named, J9 satisfied; recover journey passes |
| `typecheck:lumina` / full tsc | 0 / 770 = baseline |
| Real generator, K and G1 | validation ok, oracle 0 violations; fitting graphs pass, a tie fails |
| Chromium hit test | taps land on the right targets; lever drawings on screen, absent from the watcher picture (`scene-*.png`) |

## Not verified / open
- Not tried in the running app; needs a browser check in the tester.
- Watcher lines not recorded (needs the running app). The "don't compare column heights" rule travels only in
  `sceneNote`; `keepWatchLine` does not enforce it, so "the oranges tower over the rest" would get through. If
  recorded lines show this, add a shared `comparisons: 'never'` option to the build layer.
- One β for four ask kinds; N more (1.MD.C.4) is probably harder and may become its own mode after calibration.
- No Live run; the verdict and lever wording rides bar-model's next class Live gate.
