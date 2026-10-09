# lever-lab `build_balance` + `build_lift`: open builds (unbound), 2026-10-08

I built both modes. They pass vitest, `typecheck:lumina` and one real generator run, and 10 real watcher lines came back with no leaks. **They have not run in a browser yet.** The drive script is written but needs the dev server on :3000, which I was not allowed to start.

Lever Lab had **no evaluation and no eval modes** before this. The sandbox (drag loads, move the fulcrum, press the beam) never submitted anything, although the catalog said `supportsEvaluation: true`. This adds two code-judged open builds next to it, and payloads with no `challenges` still get the sandbox unchanged.

This is a real build, not the old activity on a new surface: the learner picks which kids and where (or where the fulcrum and helper go) on an empty side, many builds pass, and the "different way" item refuses the arrangement that passed before.

## What changed

**What a child does**

| Mode | β | Ask (written by code) | What passes | Misses |
|---|---|---|---|---|
| `build_balance` (K-5) | 2.5 | "Make the seesaw balance. A kid sits on the left. Seat kids on the right so the seesaw stays level when the blocks come away." Item 2: "Balance it a different way…" | Right-side weight × seat equals the left (\|L−R\|<0.1). One kid per seat, at most 4. Every target has at least 4 seatings that pass (vitest checks this) | `right_down`, `left_down`, `same_way` |
| `build_lift` (3-5) | 3.2 | "Build a lever that lifts the rock. The rock weighs 6 and the helper weighs 2. Put the fulcrum under the bar, then put the helper on the bar." Item 2: "…with the fulcrum in a different place." | Helper across the fulcrum from the rock, and helper × distance ≥ rock × distance. The helper is always lighter than the rock (that is the effort cap). Every pair has at least 2 fulcrum spots that work | `same_side`, `too_weak`, `same_way` |

- **Scene:** one `<svg>`. Wooden blocks hold the bar still while the child builds, so the seesaw never tips while they work. At "I'm done!" the blocks come away and the bar swings or stays level, following the judge. Try again keeps the build; Start over clears it.
- **Aids:** the empty-seat targets and the seat and mark numbers are `data-aid`. No running total or target is ever shown. The balance ask names no number; the lift ask states the two weights because they are the givens.
- **Tap targets:** the whole column above a seat is tappable, so it stays finger-sized on a phone.
- **Session:** a build, the same target "a different way", then a new target (3 items). If both modes are asked for, it is 4 items, a pair of each.
- **Scoring:** 100 on the first try, 67 after one miss, 33 after more. It submits once, with `firstResponseScore` and the misses as evidence.
- **Domain (`leverLabBuild.ts`):** the sandbox's inline `calculateTorques` is lifted out as `torquesAbout` / `isBalanced`, and the sandbox now uses it with the same results. The judges, miss words, target pools, the solution counter (`balanceSeatings`) and `liftFulcrums` live here too.
- **Watcher:** `useBuildWatcher` with `numbers: 'never'` and `made` facts as words ("a big kid at the far end", "fulcrum: close to the rock"). It may never say level / balance / tip / heavy / light / lift / strong / weak / enough / right / wrong.
- **Generator:** `resolveEvalModes`; code writes every weight, seat, rock and ask, and flash-lite writes only the title. With no pin and no intent to resolve, it returns the old sandbox exactly as before. `LeverLabData` is now imported from the component instead of being declared twice.
- **Registry:**
  - Catalog: `evalModes` added, and `answers` now includes `build`.
  - Backend `PROBLEM_TYPE_REGISTRY` (`lever-lab`): `build_balance` 2.5 and `build_lift` 3.2 added; `default` stays 3.5.
  - `LeverLabMetrics` rewritten for the builds; the old fields were never used.
  - Engineering tester: a "Lever task" selector and `onEvaluationSubmit` added.
- **Not bound** to the teaching workspace (as specified), so there is no catalog `misses` entry and no levers.

Size: about 610 production lines (component 368, domain 244) plus about 70 lines of edits elsewhere. Tests are 204 lines, plus a 98-line probe and a 197-line drive script.

## Gates

| Gate | Result |
|---|---|
| `leverLabBuild.test.ts` (9) + `LeverLab.build.test.tsx` (3) | 12/12. Covers one over, one under, a pass, a second different pass, and repeats refused for both modes. The flow test: over, then the miss, Try again keeps the build, fix, pass; a repeated seating gets `same_way`, Start over clears; lift `too_weak` then pass; one submit (score 67, firstResponseScore 0); results panel. Also: aids marked `data-aid`, no total on screen, an old payload gets the sandbox. |
| vitest: engineering folder | 23 files, 168/168 |
| vitest: lumina service, config, evaluation, build-layer | 212 files pass. 1 suite fails: `learningAdaptation.live-contract.test.ts` cannot find `artifacts/learning-applicability/report.json`, a file the worktree does not have; it has nothing to do with this change. |
| `typecheck:lumina` | 0 errors (the `liveJourneySpec.ts:2313` peer error does not exist in this worktree) |
| Full tsc | 770 errors, none in touched files |
| Backend registry | Loads with the venv python; `lever-lab` has `build_balance`, `build_lift`, `default` |
| Real generator (`scripts/lever-lab-build-probe.mjs --run`) | 4/4 clean after one rerun. The first run flagged the title "The Heavy Rock Garden" because the check banned "heavy"; I narrowed the check, since the rock's weight is already stated in the ask. K pinned → 3 balance items; Grade 4 pinned → 3 lift items; Grade 3 with intent only ("balance a seesaw…") → routed to `build_balance`; Grade 2 with a broad lesson → sandbox. On every generated item the judge passed a reference build and missed a one-over or one-past build. Output: `qa/open-build/lever-lab-overnight/generation.json` |
| Watcher (real flash-lite on the real scene svg, rendered in headless Chromium) | 10 looks on 5 builds: 6 lines kept, 4 dropped by `keepWatchLine`, 0 leaks. Example: "Ooh, the triangle fulcrum is tucked under the bar near the rock!" Output: `qa/open-build/lever-lab-overnight/watcher/` |
| Live-activity suite / journey sweep | Not needed: the primitive is not bound |
| Headless browser drive | Written, **not run** (no dev server allowed) |

## Not done / open

- **Browser drive owed** (command below). It checks the tilt animation, tap targets at 358 px, real clicks on the svg `<g>` kids, and the watcher during play.
- **No levers and no tutor.** This is a legacy primitive with no `teachingWorkspace`, so a child who keeps missing has no help step. Pre-readers get the visible tilt but not the miss words read aloud. Next steps: `/add-live-tutor-tools` to bind it (publish the seated weight × seat as numeric facts), then `/add-support-tiers`.
- **Rulings owed:**
  1. Unpinned lessons with a broad intent still get the unjudged sandbox (it is not an eval mode). Should mixed or unpinned lessons get the builds instead, as gear-train does?
  2. `build_lift` passes when helper turn equals rock turn (≥, as specified). Physically that only holds the rock level. Should it be strictly greater?
  3. A pinned `build_lift` at K-2 is allowed, with smaller pairs (no grade floor).
- **Line endings:** `buildLayer.ts` and `gemini-build-watch.ts` are byte copies of the main tree (LF); git warns they become CRLF. I did not change their content.

## Worktree setup notes

- I fast-forwarded the worktree from `2fbdbd1f` to `af7df5b8` (the main tree's HEAD) before building.
- Copied from the main tree: `buildLayer.ts`, `gemini-build-watch.ts`, `problem_type_registry.py`. `LeverLab.tsx` and `gemini-lever-lab.ts` only differed in line endings, so I left them.
- The main tree's catalog `engineering.ts` (and its `types.ts` and Engineering tester) import uncommitted tower and gear files that are not in this worktree, so the catalog would not load. I put those three back to HEAD and applied only my changes, so `merge_wt.py` should merge them cleanly into the main versions. Run `typecheck:lumina` after the merge as usual.
- The node_modules junction is created and removed; the shared install is intact.

## WORKTREE PATH
`C:\Users\xbox3\claude web tutor\.claude\worktrees\wf_71c68109-4ab-5`

## Changed files (all under the worktree)
Modified:
- `backend/app/services/calibration/problem_type_registry.py` (main copy + `lever-lab` modes)
- `my-tutoring-app/src/components/lumina/components/EngineeringPrimitivesTester.tsx`
- `my-tutoring-app/src/components/lumina/evaluation/types.ts`
- `my-tutoring-app/src/components/lumina/primitives/build-layer/buildLayer.ts` (main copy, unchanged by me)
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering/LeverLab.tsx`
- `my-tutoring-app/src/components/lumina/service/build-layer/gemini-build-watch.ts` (main copy, unchanged by me)
- `my-tutoring-app/src/components/lumina/service/engineering/gemini-lever-lab.ts`
- `my-tutoring-app/src/components/lumina/service/manifest/catalog/engineering.ts`

New:
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering/LeverBuild.tsx`
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering/leverLabBuild.ts`
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering/leverLabBuild.test.ts`
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering/LeverLab.build.test.tsx`
- `my-tutoring-app/scripts/lever-lab-build-probe.mjs`
- `my-tutoring-app/qa/open-build/lever-lab-overnight/drive.mjs`
- `my-tutoring-app/qa/open-build/lever-lab-overnight/generation.json`
- `my-tutoring-app/qa/open-build/lever-lab-overnight/watcher/` (`watcher-lines.json` + 5 PNGs)

## Drive command
After merging into the main tree, with `next dev` on :3000. playwright-core@1.52.0 is installed in this session's scratchpad:
```
cd "C:/Users/xbox3/AppData/Local/Temp/claude/c--Users-xbox3-claude-web-tutor/ae51ee33-d08b-40c0-9c12-41c53b1fb418/scratchpad/pw" && cp "C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/lever-lab-overnight/drive.mjs" ./lever-drive.mjs && node lever-drive.mjs
```
It writes `drive.json` and `shots/` to `C:/Users/xbox3/claude web tutor/my-tutoring-app/qa/open-build/lever-lab-overnight/`. Any folder with playwright-core installed works in place of `pw`.

## Browser drive (coordinator, after merge into the main tree, 2026-10-09)
**25/28** after drive-script fixes (press Try again before Start over after a miss). Fails: watcher kept 2 of 5 looks (the filter drops lines rather than show a bad one); a seat tap target is 26x40 px at phone width (below 28x44); the svg `rx/r undefined` console errors seen on every tester page (pre-existing, not this build).
