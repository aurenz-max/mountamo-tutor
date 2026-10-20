# Contract: compare-objects

- **Derived:** 2026-09-28, PARTIAL: written by `/add-support-tiers` (handoff 21 M2) for the lever requirement only. A full `/primitive-contract compare-objects` derivation (consumers, the spoken modes' requirements) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx` · **Boss:** `compareObjects.card.ts` + `compareObjects.boss.ts` · **Items, key, scene:** `compareObjectsDomain.ts` (`itemFromChallenge` gates) · **Levers:** `compareObjectsLevers.ts` (one lever set) · **Catalog:** `service/manifest/catalog/math.ts` (`compare-objects`, `...bossEntry(compareObjectsCard)`)

## Requirements

### R1 — order_three levers state no place in the order · OBSERVED (2026-09-28; re-based 2026-10-20)
- **Property:** order_three publishes `order_steps` (marks: wordless bars in the asked direction; never an object), `touch_slots` (marks: dots filled per touch), `measure_grid` (marks: uniform lines behind a length, height or capacity drawing; never on weight) and `far_three` (easier). The easier order is built through the same `itemFromChallenge` gates, has its own id, uses no name of the item's, spreads its sizes at least 25 apart, is never drawn in either answer order, is ungraded, and returns to the full item. Scene facts name no object. Every order miss is answered (J9).
- **Demanded by:** handoff 21 M2.
- **Evidence:** `compareObjectsLevers.test.ts`, `CompareObjects.levers.workspace.test.tsx`, sweep J1-J9 on `compare-objects.order_three`, replay 1 x 5 clean (runner era).
- **Probe:** those two test files; `npm run test:primitive -- compare-objects`.

### R2 — spoken-mode levers name no object, count or answer · OBSERVED (2026-09-29; re-based 2026-10-20)
- **Property:** compare_two publishes `word_model` (model: a model pair of plain shapes fixed per comparison word, the one the word names glowing; never read from the item; when it comes is the lever set's `support` fact, by the item's tier, default medium) and `far_pair` (easier, only when the pair's sizes are within 25: two plain objects 55 apart, no name of the item's, same attribute and word, built through `itemFromChallenge`). identify_attribute publishes `menu_pictures` (legend: one picture per spoken choice, in ask order, none marked) and `fewer_choices` (custom, a help lever since 2026-10-20: on a menu of three or more, one wrong choice greyed out on the item; never the answer; assisted work, handoff 21 ruling 3). non_standard publishes `tap_boxes` (marks: the unit boxes can be tapped and fill; no numeral), `five_marks` (marks: a thicker line after every fifth box, only on more than five) and `shorter_measure` (easier: the same unit, at most half the boxes and two or more, a count no session item has where one is free). Practice items are ungraded and return to the full item. Scene facts name no object and carry no digit. Every spoken miss is answered (J9).
- **Demanded by:** handoff 23 step 2.
- **Evidence:** `compareObjectsLevers.test.ts`, `CompareObjects.levers.workspace.test.tsx`, sweep J1-J9 (J9 mutation-checked).
- **Probe:** those two test files; `npm run test:primitive -- compare-objects`.

### R3 — the spoken key carries the mode's accept and refuse rules · OBSERVED (2026-10-20)
- **Property:** the key (`compareKey`) is a `SpokenKey`: identify_attribute accepts the child form, its key word and the grown-up word, and names the other menu choices as not drawn; compare_two accepts any words naming only the winner and refuses the other object and a pointing word ("that one"); non_standard accepts counting aloud that ends on the count and refuses one too many (the starting edge counted). These rules were the runner's discrimination clauses and then the catalog guidance prose; they now travel with each item's key. order_three has no key: the board checks it (`compareOrderMiss`). No ask says an accepted answer outside its closed menu or the two names it must offer (`askGiven`; `askLeaks` on every saved payload).
- **Demanded by:** boss migration (wave 2), re-basing the runner-era DI contract.
- **Evidence:** `compareObjectsDomain.test.ts`, `CompareObjects.workspace.test.tsx`, `boss.test.ts` (ask-leak over the saved payloads).
- **Probe:** those test files.

## Known answer-stating flags (not levers)

`showUnitNumbers` (non_standard) numbers the unit boxes; the last box is the spoken answer. It stays a post-affirmation reveal (`runner.revealHeld`) and must not become a help lever (handoff 21).

## Changelog

- 2026-09-28 — created with R1 (`/add-support-tiers`, handoff 21 M2).
- 2026-09-29 — R2, the spoken modes' levers (`/add-support-tiers`, handoff 23 step 2).
- 2026-10-20 — re-based onto the boss (wave 2): the scripted runner, `compareObjectsScript.ts`, `compareObjectsWorkspace.ts` and the spoken-levers module are gone; the two lever modules are one lever set with stock types (`fewer_choices` is now a custom help lever, `word_model` a model with a tier rule); R3 added for the key that replaced the runner's judging contract.
