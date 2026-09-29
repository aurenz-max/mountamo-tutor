# Contract: compare-objects

- **Derived:** 2026-09-28, PARTIAL: written by `/add-support-tiers` (handoff 21 M2) for the lever requirement only. A full `/primitive-contract compare-objects` derivation (consumers, the spoken modes' requirements) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx` · **Items:** `compareObjectsScript.ts` (`itemFromChallenge` gates) · **Workspace:** `compareObjectsWorkspace.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`compare-objects`)

## Requirements

### R1 — order_three levers state no place in the order · OBSERVED (2026-09-28)
- **Property:** order_three publishes `order_steps` (wordless bars in the asked direction; never an object), `touch_slots` (dots filled per touch), `measure_grid` (uniform lines behind a length, height or capacity drawing; never on weight) and `far_three` (simplify). The easier order is built through the same `itemFromChallenge` gates, has its own id, uses no name of the item's, spreads its sizes at least 25 apart, is never drawn in either answer order, is ungraded, and returns to the full item. Scene facts name no object. Every order miss is answered (J9).
- **Demanded by:** handoff 21 M2.
- **Evidence:** `compareObjectsLevers.test.ts` 16, `CompareObjects.levers.workspace.test.tsx` 2, sweep J1-J9 on `compare-objects.order_three`, replay 1 x 5 clean.
- **Probe:** those two test files; `journeySweep -t compare-objects.order_three`.

### R2 — spoken-mode levers name no object, count or answer · OBSERVED (2026-09-29)
- **Property:** compare_two publishes `word_model` (a model pair of plain shapes fixed per comparison word, the one the word names glowing; never read from the item) and `far_pair` (simplify, only when the pair's sizes are within 25: two plain objects 55 apart, no name of the item's, same attribute and word, built through `itemFromChallenge`). identify_attribute publishes `menu_pictures` (one picture per spoken choice, in ask order, none marked) and `fewer_choices` (on a menu of three or more, one wrong choice greyed out on the item; never the answer; assisted work, handoff 21 ruling 3). non_standard publishes `tap_boxes` (the unit boxes can be tapped and fill; no numeral), `five_marks` (a thicker line after every fifth box, only on more than five) and `shorter_measure` (simplify: the same unit, at most half the boxes and two or more, a count no session item has where one is free). Practice items are ungraded and return to the full item. Scene facts name no object and carry no digit. Every spoken miss is answered (J9).
- **Demanded by:** handoff 23 step 2.
- **Evidence:** `compareObjectsSpokenLevers.test.ts` 13, `CompareObjects.levers.workspace.test.tsx` +4, sweep J1-J9 (J9 mutation-checked).
- **Probe:** those two test files; `journeySweep -t compare-objects`.

## Known answer-stating flags (not levers)

`showUnitNumbers` (non_standard) numbers the unit boxes; the last box is the spoken answer. It stays a post-affirmation reveal and must not become a help lever (handoff 21).

## Changelog

- 2026-09-28 — created with R1 (`/add-support-tiers`, handoff 21 M2).
- 2026-09-29 — R2, the spoken modes' levers (`/add-support-tiers`, handoff 23 step 2).
