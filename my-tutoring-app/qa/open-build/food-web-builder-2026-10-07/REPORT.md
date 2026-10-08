# food-web-builder — workspace binding + `build_chain` open build (OB-3S), 2026-10-07

Built in an agent worktree from e8e0191d, merged into the main tree (merge base = the worktree's HEAD, since main had
moved to 8a20e3a8) and re-gated there. Conflicts in `liveJourneySpec.ts` imports and the `lessonWorkspacePlan.test.ts`
bound list resolved keep-both.

## Step 1: binding (W1, minimal)

- The primitive had no eval modes (one item: draw the whole web) and raw shadcn UI. `FoodWebBuilder.tsx` was
  rewritten as `FoodWebBuilderSurface` behind `withWorkspaceController`, frame on the Lumina kit.
- The original task is now eval mode `complete_web` (one item, old canvas, trophic labels, Check, disruption panel).
  Scripted path unchanged. On the workspace: every check through `progress.commitCheck` with a named miss
  (`backwards_arrows`, `wrong_arrows`, `missing_arrows`); Try again keeps the arrows; session submitted from
  `onFinished`. Tutor facts: ecosystem, organisms with on-screen trophic labels, `arrowsDrawn`, the learner's arrows;
  no feeding relation published.
- Adapter `foodWebBuilderLive.ts` (`validate` rejects a chain target the web cannot make), rows in
  `activityContract.ts`, `lessonWorkspacePlan.test.ts`, `liveJourneySpec.ts`; catalog `teachingWorkspace` grades 3-8,
  `levers: true`, `unanswered: { build_chain: ['wrong_end'] }`; `FoodWebBuilderMetrics` gains optional fields.

## Step 2: `build_chain` — "Make a food chain with 4 living things that ends at the Hawk"

- **Surface** (`FoodChainScene.tsx`, one svg). Tap a living thing in the list (sorted by name, no trophic labels) to
  put it in, again to take it out; tap one card then another to draw an arrow; drawing the reverse turns it round;
  tap an arrow to remove it. Cards are one colour in scattered slots, so neither colour nor position gives a level.
  Selection ring and lever text are `data-aid`. "I'm done!" commits; no `armStillness`.
- **Judge** (`foodChainMiss`, code): exactly one line through every placed organism, starting at a producer, ending
  at the named organism, of the stated length, every arrow a relation from the lesson's `correctConnections` cleaned
  by `feedingRelations` (nothing eats a producer, a decomposer feeds nobody). Real targets were reached by 1-6 chains.
- **Misses** (most specific first): `arrow_backwards`, `not_a_feeding_pair`, `broken_chain`, `wrong_end`,
  `no_producer`, `too_short`, `too_long`. Verdicts name no organism or direction.
- **Scene facts:** `livingThingsPlaced`, `arrowsDrawn`, `chainLength` (tested: `livingThingsPlaced 0 → 5 → 4`).
- **Levers** (bare): `arrow_words` ("eaten by" along each arrow), `food_tags` (what each eats), `chain_count` (the
  learner's longest line as a count, never the target), `shorter_chain` (simplify, ungraded, when one exists).
- **Watcher.** `numbers: 'never'`; `neverSay` eat/food/energy/chain/direction words and every organism not on the scene.
- **Generator.** flash-lite writes organisms and relations; a flash-latest truth review rates every candidate pair
  (common / sometimes / never), code adds common omissions and drops nevers; `pickChainTargets` picks 3 distinct
  (end, length) targets (G3-5 lengths 3-4, G6-8 4-5), retrying up to 3 times. Code writes the ask.
- Catalog `complete_web` β 3.5, `build_chain` β 3.6 `answers: ['build']`; backend priors (`default` 3.5 kept);
  oracle `food-web-builder` (own chain walk, key desync, ask naming a link, single-chain targets).

Size: ~1,250 production lines (component 664), 287 test lines, 100-line probe.

## Gates

| Gate | Result |
|---|---|
| `FoodWebBuilder.workspace.test.tsx` | 9/9 |
| vitest (worktree): live-activity, catalog, oracles, pip, biology, build-layer | 144 files, 3,648 pass, 0 fail |
| vitest (main tree after merge): biology, chemistry, oracles, build-layer, live-activity, manifest | 100 files, 3,541 pass, 0 fail |
| `typecheck:lumina` | 0 (main tree after merge) |
| full tsc | 770 = baseline, identical sorted error list (worktree) |
| journey sweep | `build_chain` 3 items + `complete_web` 1, 0 findings, all misses named; J9 passes |
| real generator + oracle | 5 `build_chain` (G3, G4, G5, G7, G8) + 1 `complete_web`: 0 violations, adapter ok; reversed / first-dropped / last-dropped chains give the right miss on every target. Truth review removed water lily → dragonfly nymph, red fox → hawk; added mouse → hawk, rabbit → hawk |
| real watcher | 24 lines over 12 builds: 24 kept, 0 leaks |

Artifacts here: `generator-run.json`, `journey-sweep.json`, `watcher-lines.json`. Probe:
`scripts/food-web-build-chain-probe.mjs`.

## Not verified

- No browser drive. At 360 px the svg scales to 0.56 and a card's tap area is ~72×26 px, below 44 px — likely a
  finding for the family's next slice. Arrow hit stroke, levers on screen, watcher line in the app unchecked.
- No Live run or replay; rides the family's class Live gate.
- Ecological completeness is not code-checkable: a true relation the generator misses marks a right chain wrong.
  The truth review reduces this; it needs an `/eval-test` read.
- `scripts/lib/lesson-planner-requirements.mjs` has no line for the mode.

## Rulings owed

1. A "link" = a living thing in the ask ("4 living things"); the roadmap said "4-link".
2. Watcher says "connecting nicely" on a backwards chain — approval without naming the error (R2).
3. Unpinned sessions stay `complete_web` (R4/R7).
4. `levers: true` reaches `complete_web`, which has no levers (array-grid ruling 2).
5. `build_chain` generation is flash-lite + a flash-latest truth review per attempt, up to 3 attempts.
