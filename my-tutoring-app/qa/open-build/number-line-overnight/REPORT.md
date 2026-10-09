# number-line `build_hops`: open build (OB-9M follow-on), 2026-10-08 overnight

`build_hops` is a real build, so I built it. Many builds pass: to land on 12 in two hops, any two hop sizes that add to 12 are right (10+2, 9+3 … 6+6). The learner picks each hop size, which is the arithmetic: what goes with 5 to make 12. It does not repeat `jump`, where the hop size is given and the learner finds the landing. All the gates I could run passed. I could not run the headless drive, because it needs a dev server on :3000.

One design change from the proposed ask: the learner picks hop sizes from buttons instead of tapping landings on the line. With tap-to-land, any first tap followed by a tap on the target always passes, so the judge would check almost nothing.

The existing modes (`identify`, `plot`, `jump`, `order`, `between`) are unchanged. This is a new challenge type, the fork the contract-first rule asks for.

## What was built
- **Task:** "Start at 0 and land on 12 in two hops." The line opens with only a start dot.
  - The learner taps a hop button (1 to 10, 48 px each) and the line draws that hop from where the last one landed, labelled "+5".
  - Tapping a landing dot takes that hop off, and later hops move back. There are also "Take back a hop" and "Start over" buttons.
  - Landings are not labelled and the target is not marked: reading where the hops land is the learner's job.
- **Two ways per item:** a right first way is not committed. It is listed ("Your first way: hop 5, hop 7"), the line clears, and the learner lands there a different way.
- **Judge:** code, at "I'm done!" (`numberLineBuildHops.ts` `buildHopsMiss`).
  - The landing must equal the target. It reuses `jumpMiss` on the one jump the hops add up to, giving `one_short`, `one_past` or `off_by_more`.
  - The hop count must be the one asked (`other_hop_count`).
  - On the second way the hop sizes must differ, in any order (`same_way_again`).
- **Try again keeps the build.** The verdict text stays on screen through Try again. A new item, or the simplify lever's practice build, opens an empty line.
- **Scene facts are numbers:** `landedAt`, `hopsMade` and `hopsAsked`, plus `way` and `firstWay`, so `workHistory` can record a fix like `landedAt 0 → 13 → 12`.
- **Watcher:** `useBuildWatcher` with `numbers: 'never'` and a `made` line describing hops as short, middle-sized or long. It only runs when there are hops and the item is still open.
- **Levers,** none pulled at the start:
  - `numbered_hops` (help): numbers the spaces inside each of the learner's own hops. Marked `data-aid` so it stays out of the watcher's picture. Answers `one_short`, `one_past`, `off_by_more`.
  - `ways_model` (help): beside the line, two ways to land on a small number that is never the learner's. Answers `same_way_again`.
  - `simpler_jump` (simplify): an ungraded practice build to about half the distance, same hop count. Answers `off_by_more`.
  - `other_hop_count` has no lever and is listed as `unanswered` in the catalog.
- **Generator:** code owns every number and the instruction, with no model text.
  - `selectBuildHopsTasks` picks 3 distinct targets from 0, or from the line's first number for a Grade-1 window like 90-110.
  - Each target must be reachable at least two different ways (distance 4 or more; never 19 or 20 with two hops, which have only one way).
  - Targets stay inside the topic-resolved line, which is the only model call. The hard tier asks for three hops; the other tiers start with no aids.
- **Registry:**
  - Catalog mode `build_hops`, β 2.6 (jump 2.5 + 0.1), `answers: ['build']`, a misses list and one guidance sentence ("never say where the hops land, a hop size to use, or how far is left").
  - Backend prior 2.6.
  - The oracle knows the type: it re-derives that two hop sets exist, that the target is on the line, and that the instruction states the target.
  - The live adapter validates the new type, the journey row can drive it, and there is a saved payload `w1-payloads/number-line.build_hops.json` from a real generation.
- **Fix found by the watcher run:** after a right first way, the second way's hops were drawn green (the colour came from the "Yes!" feedback). Hops are now green only once the item is solved.
- **Unpinned sessions:** `build_hops` is not added to them (the no-eval-mode default list), the same open question as R4.

About 600 production lines and 290 test lines.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full tsc | 770, the baseline; no error in any touched file. The peer error at `liveJourneySpec.ts:2313` does not exist in this worktree. |
| `numberLineBuildHops.test.ts` | 15/15: one over, one under, further off, a pass, a different second pass, the same way reversed, fewer hops, a non-zero start, ways, generator asks (50 runs), the oracle, the easier build, lever text, feedback leaks |
| `NumberLine.buildHops.workspace.test.tsx` (real NumberLine, TeachingSession, LiveLessonRuntime) | 6/6: empty line → one past → miss → Try again keeps the build → take a landing off → pass first way → same way → `ways_model` → different way credited → advance; numbered hops kept out of the picture; simplify practice and return; three-hop count miss |
| live-activity + catalog + qa/oracles + number-line + build-layer suites | 101 files, 3550 passed |
| journey sweep, real payload `number-line.build_hops` | 3 items, 0 findings, 3/3 misses named; records: clean score 100, recover score 67 / first-response 0. The other number-line payload findings (between, order) are already in the baseline. |
| real generation (`scripts/number-line-build-hops-probe.mjs --run`) | 3/3 clean, twice: K "Addition within 10" on a 0-10 line [7, 9, 10]; G1 "Add within 20" [13, 9, 11]; G2 hard, three hops [11, 19, 14]. The judge, adapter and oracle all agree on every item. |
| watcher, real flash-lite on the component's own SVGs (6 states, rendered 760x240) | 6/6 lines kept and none says a number or a verdict. Every line is a variant of "Ooh, bright orange hops are leaping across the line!", so they tell the learner very little. |
| headless drive in the Math tester | written, not run (it needs :3000) |

## Not done / open
- **Browser drive:** `drive.mjs` is written and passes a syntax check, but has not run. It checks 24 things, including that tapping an SVG landing removes the hop in a real browser, the 360 px card fit, hop buttons at least 44 px, and the watcher leak rules.
- **Contract and roadmap:** the contract entry for `docs/contracts/number-line.md` (R15) and the ROADMAP row are not written, because subagents cannot write `.md`. Suggested R15: "build_hops is a separate challenge type; it draws only the start; landing is judged exact via `jumpMiss`; R1-R14 are untouched."
- **No Live run.** The tutor's wording on the verdict and the stopped-building fact will come with the next class Live gate.
- **Rulings owed:**
  - (a) 7+5 after 5+7 counts as the same way (stricter than R5's turned array).
  - (b) Unpinned sessions do not draw `build_hops` (same question as R4).
  - (c) `other_hop_count` has no lever.
- **Watcher lines are near-identical and say little.** That belongs to the shared build layer (`gemini-build-watch.ts`), not this mode.

## Worktree and files
WORKTREE PATH: `C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-4`. It was fast-forwarded to `ship/2026-08-10-judged-loop` af7df5b8, and the node_modules junction has been removed.

From the main tree I copied `buildLayer.ts`, `gemini-build-watch.ts` and `problem_type_registry.py`. For `catalog/math.ts` I kept HEAD plus only my own edits: the main-tree copy carries peer ten-frame/pattern-builder changes that fail `typecheck:lumina` without their primitive files. Merge it with `merge_wt.py`, which 3-way merges against HEAD.

Changed (paths under `my-tutoring-app/` unless noted):
- `backend/app/services/calibration/problem_type_registry.py` (repo root; also carries the main-tree copy)
- `src/components/lumina/primitives/build-layer/buildLayer.ts` (main-tree copy only)
- `src/components/lumina/service/build-layer/gemini-build-watch.ts` (main-tree copy only)
- `src/components/lumina/primitives/visual-primitives/math/NumberLine.tsx`
- `src/components/lumina/primitives/visual-primitives/math/numberLineEvidence.ts`
- `src/components/lumina/primitives/visual-primitives/math/numberLineWorkspace.ts`
- `src/components/lumina/service/math/gemini-number-line.ts`
- `src/components/lumina/service/manifest/catalog/math.ts`
- `src/components/lumina/service/qa/oracles/number-line.ts`
- `src/components/lumina/components/live-activity/adapters/numberLineLive.ts`
- `src/components/lumina/components/live-activity/liveJourneySpec.ts`

New (same root):
- `src/components/lumina/primitives/visual-primitives/math/numberLineBuildHops.ts`
- `src/components/lumina/primitives/visual-primitives/math/numberLineBuildHops.test.ts`
- `src/components/lumina/primitives/visual-primitives/math/NumberLine.buildHops.workspace.test.tsx`
- `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/number-line.build_hops.json`
- `scripts/number-line-build-hops-probe.mjs`
- `qa/open-build/number-line-overnight/drive.mjs`, `generation.json`, `watcher.json`, `journey-sweep.json`, `watch-pics/*.png`

Drive command (after merging into the main tree, with next dev on :3000, from a folder with playwright-core installed):
```
node "C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/number-line-overnight/drive.mjs"
```
It writes `drive.json` and `shots/` next to itself.

## Browser drive (coordinator, after merge into the main tree, 2026-10-09)
**20/20** after one drive-script fix (svg `<text>` has no `innerText` in Chromium; read `textContent`). Watcher 3/3 clean; hop buttons 48 px at 360.
