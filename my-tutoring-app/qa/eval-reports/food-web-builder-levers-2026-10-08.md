# food-web-builder levers: complete_web (2026-10-08)

Class sweep, batch 1 (with counting-board, molecule-constructor, polygon-area-builder, habitat-diorama). `build_chain` already had levers; this slice gives the whole-web mode, `complete_web`, its own.

## Failure inventory (complete_web)

The miss function already existed (`foodWebMiss`, catalog `misses.complete_web`), so no new miss was needed.

| Miss (observed on screen) | Evidence class |
|---|---|
| `backwards_arrows`: an arrow is a real relation turned round (eater to food) | observed-synthetic (the journey's wrong input turns the first relation round) + documented (catalog: "arrow from prey to predator") |
| `wrong_arrows`: an arrow between two living things that do not feed each other | documented (the legacy check scores "incorrect connections") |
| `missing_arrows`: some feeding relations not drawn | documented (the legacy check scores "missing connections") |

No real-learner evidence exists, and there are no demonstrations, tutor reports or remediation modules for this primitive. There is no `docs/contracts/food-web-builder.md`. Build_chain's levers, tests and journey row were left as they were.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Answers |
|---|---|---|---|---|---|---|
| complete_web | backwards_arrows | `arrow_words`: "eaten by" along every drawn arrow and in the learner's arrow list | help | shown | The words are the same on every arrow, right or wrong, so they mark none. No arrow is turned round. | backwards_arrows |
| complete_web | wrong_arrows | `food_tags`: under each level label, what the living thing eats in plain words | help | shown | Says what one living thing eats. It names no pair and draws no arrow. | wrong_arrows |
| complete_web | missing_arrows | `arrow_counts`: on each living thing, how many feeding arrows join it in the whole web | help | shown | Counted only from the web's relations (`webArrowCounts` takes no arrows), so it never changes when an arrow is drawn and cannot be used to test arrows one at a time. It names no partner and no direction. | missing_arrows |
| complete_web | missing / wrong_arrows | `smaller_web`: the same task with the top consumer level left out (or, failing that, the decomposers), on an empty web | simplify | shown | The same mode with at least 2 relations and fewer than the source, so it is never the learner's own item. It is ungraded, and the whole web comes back empty. | missing_arrows, wrong_arrows |

No mode is left without a lever. Every `complete_web` miss is answered (J9), so the catalog `unanswered` map is unchanged. Starting positions: none. The item starts bare, the same as build_chain, and no tier code was added.

## Built

- `foodWebLevers.ts`: `webLevers`, `smallerWeb`, `webPart` and `webArrowCounts`, plus the `complete_web` facts in `leverFacts`. `foodWebLevers` now sends complete_web to `webLevers`.
- `FoodWebBuilder.tsx`: complete_web publishes its levers and `pullLever`/`endPractice`, which were build-only before. It renders the words, tags and counts. The practice web shows only its living things and is checked against its own relations. It adds a "Practice · a smaller web" header and shows no disruption panel on a practice item. `FoodWebChallenge` complete_web gained an optional `only`.
- `foodWebWorkspace.ts`: `smallerWebAsk`; `workspaceAssignment` and `foodWebHarnessInputs` use `only`.
- `liveJourneySpec.ts` (row only): rebuilds `web~smaller` from the whole web with `smallerWeb`.
- Catalog (biology.ts): one comment line changed. The misses were already listed.

## Tests

- New `FoodWebBuilder.levers.workspace.test.tsx` (13 tests). Unit tests cover the builder (fixed cases plus 300 random webs: same mode, in the web, at least 2 relations, fewer than the source, every shown living thing has a relation), the counts, the `nextLever` table, lever text naming no living thing, and J9 coverage. Mounted tests cover four behaviours:
  - A pull changes the screen and the scene fact in one commit, and the next attempt records the lever.
  - A refused pull changes nothing.
  - The counts stay the same when a right arrow is drawn.
  - The simplify pull opens `web~smaller` on 3 living things, ungraded. The whole web comes back empty and is credited with `levers: [smaller_web]`.
- Existing `FoodWebBuilder.workspace.test.tsx`: one assertion updated, because complete_web is no longer lever-free.
- Run: FoodWebBuilder*, `pip/ScienceWorkspaces.surface.test.tsx`, `lessonWorkspacePlan.test.ts` and `service/qa`. Result: 47 files, 925 passed, 6 skipped, 0 failed.
- `npm run typecheck:lumina`: 0 errors in these files. The 9 errors it reports are all in the sibling `habitatDioramaLevers*.ts`.
- Not run (per the batch plan): the journey sweep, the tutor replay and Live.
