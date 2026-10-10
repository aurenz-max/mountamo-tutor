# spatial-path levers, 2026-10-09

One mode, `choose_route` (Kindergarten). Builds on the W1 binding (`qa/tutor-reports/spatial-path-w1-2026-10-09.md`).

## Failure inventory

| Failure | Evidence class | Observable as |
|---|---|---|
| Does not know the movement word | inferred (K vocabulary task) | any `went_*` |
| Takes the other vertical arc (over for under, under for over) | inferred | `went_over` / `went_under` |
| Picks the straight line or by where a route ends | inferred (contract R2 exists against it) | `went_through` |
| Cannot follow five overlapping dashed routes at the landmark | inferred | any `went_*` |

No real-learner evidence yet.

## Lever table

| Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|
| `word_picture` | help | both | all five | A ball going the asked way past a plain object (box, table, hoop, tree, plank over water), outside the map; its path is no route's `d` and it has no number (`wordModelLeaks`). `does` forbids saying which route is like it. |
| `watch_each` | help | shown | all five | A dot in each route's own colour walks every route in turn; all routes treated the same; no label. |
| `three_routes` | simplify | both | all five | Ungraded three-route map in another scene asking the confused-with word (over/under, through/around, across/through); never the item's asked word or route (`practiceLeaks`); asked route in the middle. Not offered on a 3-route item or a practice map. |

`nextLever` order for every miss: word_picture, watch_each, three_routes. No miss is unanswered.

## Built

`spatialPathLevers.ts`; lever state keyed by item, `pullLever` / `endPractice` and the `onScreen` scene fact in
`SpatialPath.tsx`; catalog `levers: true`; journey row rebuilds the practice map from its parent. Starting
positions from `config.difficulty`: not built (the generator has no tier harness).

## Gates

| Gate | Result |
|---|---|
| typecheck:lumina | 0 |
| full tsc | 770 (baseline 770) |
| spatialPathLevers.test.ts, SpatialPath.levers.workspace.test.tsx, SpatialPath.workspace.test.tsx, SpatialPath.test.tsx, gemini-spatial-path.test.ts | 34/34 |
| journeySweep + workspaceContract (spatial-path) | 7/7; sweep 0 findings (J1-J13), lever inventory: 5/5 misses answered |
| misses.test, sourceControlBytes, lessonWorkspacePlan | 146/146 |

## Tutor replay (`replay/spatial-path-2026-10-09-r3.json`, 5 samples)

Every check 0/5, including `no_change_before_receipt` on stuck. The lever replies name the picture ("a ball going
through a hoop") and send the learner back to the map without pointing at a route. No leak.

## Failures with no lever

None.
