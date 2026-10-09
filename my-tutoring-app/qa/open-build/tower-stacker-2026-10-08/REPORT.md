# tower-stacker: workspace binding + three open builds (OB-4 pilot), 2026-10-08

The first OB-4 engineering builder. The old primitive was one open tower with a made-up "stability %" (centredness
minus a height penalty) and wind "passed" when that score beat `100 - windStrength`. It also showed a live Stability %
and the balance-point dot from the start, and a tips panel that said "build a wide base". So the answer was on screen
and the check was not physics. Both are gone.

## What a child does

Empty building area, green goal line, a tray (small block 1x1, block 2x1, big block 2x2, beam 4x1). Pick a piece,
optionally Turn it on end, tap a column: it falls until it rests on what is under it (needs half its width held). Tap a
piece with nothing on it to take it off. "I'm done!" tests the tower; a part that fell is drawn turned about the edge it
went over until the build changes. Three towers per session, code-written.

| Mode | β | Ask | Misses (in test order) |
|---|---|---|---|
| `build_tall` (K-2) | 2.5 | reach the line and stay standing | `tips_over`, `too_short` |
| `build_few` (2-4) | 3.0 | reach the line with no more than N pieces (N = ceil(H/4) + slack; a beam on end is 4 tall) | + `too_many_pieces` |
| `build_windproof` (2-5) | 3.5 | reach the line and stay up when the strong wind blows | + `blown_over` |

**Judge (code, `towerWorkspace.ts`).** Pieces are not glued. Above every level a piece starts at, pieces resting on
each other form a part; the part stands if its balance point (weight = area) lies over the span of what holds it up.
Wind is a pressure per unit height from the left; a part blows over when the wind's turning push about its downwind
edge beats its weight's pull back. Each windproof item's wind is the geometric mean of what a plain 2-wide block column
survives (must blow over) and what a wide-based reference survives (must stand); the shorter practice ask gets the
wind for its own height.

**Levers (bare at start).** `balance_point` (each part's balance point, a plumb line, the ends of its support; `data-aid`),
`piece_count` (build_few), `wind_gust` ("Try a gust": the same wind, ungraded), `shorter_tower` (simplify: line a third
lower). `too_short` is unanswered: the line is on screen.

**Tutor facts.** `piecesPlaced`, `towerHeight`, `bottomWidth` as numbers (work history), the tower in words, the tray.
No balance point, wind number or verdict. Catalog guidance: never say where a piece goes, or "wider bottom / weight lower
/ over the middle".

**Generator.** Code writes every item (`towerChallenges`); flash-lite writes only the title. Mixed (unpinned, broad
intent) holds every tier the band builds (K-1 tall×3; 2-3 tall, few, windproof; 4-5 few, windproof×2).

**Shared fix.** `useBuildWatcher` kept the previous line when a reply came back empty (filtered), so a line about an
older build stayed on screen. Now an empty reply clears it (`buildLayer.test.tsx` fails without the fix). Affects every
build mode.

Size: 1,131 production lines (the old component + generator were 1,307 lines, now 443), 302 test lines, 2 probe scripts.

## Gates

| Gate | Result |
|---|---|
| `TowerStacker.workspace.test.tsx` | 12/12 (every miss, Try again keeps the tower, work history `piecesPlaced 0 → 4 → 3 → 5`, levers, simplify practice, scripted path, physics, oracle on every band × mode, catalog) |
| vitest: live-activity, manifest, qa, pip, engineering, biology, math, build-layer | 347 files, 6,808 pass, 0 fail |
| `typecheck:lumina` | 0 |
| full tsc | 771 vs HEAD 770; the one extra is `.next/types/.../eval-test/route.ts` (stale `.next` + another session's uncommitted route edit), none in this slice's files |
| journey sweep | 3 payloads × 3 items, 0 findings, all misses named, J10/J11 records right |
| real generator + oracle (`scripts/tower-stacker-build-probe.mjs --run`) | 9 sessions (6 pinned K-5, 3 intent-routed): oracle 0, adapter ok; journey pass tower passes and wrong tower gets the named miss on all 27 items. Intent: "survive strong wind" → windproof; "fewest pieces" → tall+few blend; "what makes structures stable" → mixed |
| headless Chromium drive (`drive.mjs`, real tester, real generation, real watcher) | 20/20: blown column → verdict + fallen part drawn, Clear → flat beams pass; staircase tips → take off top first → straight passes; small blocks over the cap named → beams on end pass; 358 px column: scene 358 wide, no overflow, tray buttons 44 px, tap column 22×313 px |
| watcher | 6 builds, 5 lines kept, 0 leaks (`browser-drive.json`) |

Artifacts: `generator-run.json`, `journey-sweep.json`, `browser-drive.json`, screenshots `wind-*`, `tall-*`, `few-*`, `phone-358-column`.

## Not verified / owed

- No Live run; the tutor's words ride the engineering class Live gate.
- Phone width was checked by narrowing the primitive's column in the desktop tester (the tester shell itself is not
  responsive), not on a phone. A tap column is 22 px wide (full height); the piece under a finger is the tap target
  for removal, about 22-44 px.
- The watcher once called the green flag "the green arrows" (the wind arrows are blue). Harmless, not a leak.
- Console errors `<ellipse rx undefined>` / `<circle r undefined>` appear on the tester page; not from tower-stacker
  (its circles have literal radii). Unowned.
- No `docs/contracts/tower-stacker.md` existed; the old data shape (`availablePieces`, `targetHeight`, `enableWind`…)
  is replaced, so a manifest that supplied those hints now gets code-written towers (the catalog constraint says so).

## Rulings owed

1. Unpinned sessions mix tiers by band (K-1 tall only; 2-3 one of each; 4-5 few + windproof×2), the R4/R7 question.
2. Pieces are not glued: two side-by-side columns are two parts, each judged alone. A wide tower must be tied
   together (a beam across, or a brick bond). Realistic, but stricter than a child may expect.
3. A piece exactly half held, with its balance point on the edge, stands.
