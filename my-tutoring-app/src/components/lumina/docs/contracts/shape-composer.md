# Contract: shape-composer

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C11) for the workspace requirement only. A full `/primitive-contract shape-composer` derivation (consumers per K.G.6 / 1.G.2 skill, tiers, the generator's code-owned templates and recipes) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/ShapeComposer.tsx` · **Workspace:** `shapeComposerWorkspace.ts` · **Open build:** `shapeComposerBuild.ts` · **Adapter:** `components/live-activity/adapters/shapeComposerLive.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`shape-composer`)

## Requirements

### R1 — every mode binds the shared teaching workspace with no key reaching the tutor · OBSERVED (2026-10-09)
- **Property:** all five modes (compose-match, compose-picture, decompose, how-many-ways, free-create) are gesture items checked by the activity's own check (`shapeComposerMatches`; free-create's open build by `judgeShapeBuild`); each wrong check names a `ShapeComposerMiss` from the catalog list. Scene facts name the target, the palette, the recipe and whether guides are drawn, never a piece's spot, the parts of a decompose shape (`compositeDescription`, `expectedComponents`) or the number of pieces. Decompose offers its parts plus shapes that are not parts, alphabetically, and no button turns green when enough are tapped. A miss shows the miss words, never the generated hint (hints can name the answer). Try again keeps the pieces on the board (the learner fixes their build) and clears decompose taps and the typed number. The scripted path keeps its own Next; its evaluation now submits on completion (before, the submit sat behind a "See Results" button the summary hid).
- **Demanded by:** qa/workspace-rollout/ROLLOUT.md C11; OB-9M open build (`qa/open-build/shape-composer-2026-10-08/REPORT.md`).
- **Evidence:** `ShapeComposer.workspace.test.tsx` 10 (drag modes by pointer events); sweep J1-J8 on 5 payloads, 0 new findings (compose-match, compose-picture, free-create baselined J1: no drag input); replay 5 x 5 (`qa/tutor-reports/replay/shape-composer-2026-10-09-r3.json`).
- **Probe:** `ShapeComposer.workspace.test.tsx`; `journeySweep -t shape-composer`.

### R2 — every mode's levers change the picture, never the answer · OBSERVED (2026-10-09)
- **Property:** `shapeComposerLevers.ts` declares levers on every mode, and every catalog miss is answered by a lever on every generated item shape and every saved payload item, seams shown or not; only free-create's `too_few_shapes` (older payloads with no list) is `unanswered`. Help levers draw on the learner's own work or on a model outside the item: empty_space, in_place (compose-match), empty_spots (compose-picture), split_lines where the session hides them and parts_model (decompose), pieces_model (how-many-ways), list_match and join_marks (free-create). No lever text or scene fact carries a digit; the decompose model never uses or names a part shape of the item; the how-many model is never the item's shape or its number of pieces. Simplify (fewer_pieces, smaller_picture, two_parts, smaller_build, smaller_recipe) stays in the mode, is offered only when the item is bigger than two, gets its own `~simpler` id, never repeats the learner's target, picture, big shape or list (`simplerLeaks`), and is ungraded; the full item comes back blank. A pull that changes nothing is refused (already pulled; in_place, list_match, join_marks on an empty board).
- **Demanded by:** /add-support-tiers, C11 lever pass; OB-9M open-build report (levers owed).
- **Evidence:** `shapeComposerLevers.test.ts` 25, `ShapeComposer.levers.workspace.test.tsx` 6; sweep J1-J13 on 5 payloads, 0 new findings; replay 5 x 5 (`qa/eval-reports/shape-composer-levers-2026-10-09.md`).
- **Probe:** `shapeComposerLevers.test.ts`; `ShapeComposer.levers.workspace.test.tsx`; `journeySweep -t shape-composer`.

## Changelog

- 2026-10-09 — created with R1 (W1 plain-shape binding).
- 2026-10-09 — R2 (levers, every mode).
