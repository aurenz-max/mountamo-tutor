# Contract: compare-objects

- **Derived:** 2026-09-28, PARTIAL: written by `/add-support-tiers` (handoff 21 M2) for the lever requirement only. A full `/primitive-contract compare-objects` derivation (consumers, the spoken modes' requirements) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/CompareObjects.tsx` · **Items:** `compareObjectsScript.ts` (`itemFromChallenge` gates) · **Workspace:** `compareObjectsWorkspace.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`compare-objects`)

## Requirements

### R1 — order_three levers state no place in the order · OBSERVED (2026-09-28)
- **Property:** order_three publishes `order_steps` (wordless bars in the asked direction; never an object), `touch_slots` (dots filled per touch), `measure_grid` (uniform lines behind a length, height or capacity drawing; never on weight) and `far_three` (simplify). The easier order is built through the same `itemFromChallenge` gates, has its own id, uses no name of the item's, spreads its sizes at least 25 apart, is never drawn in either answer order, is ungraded, and returns to the full item. Scene facts name no object. Every order miss is answered (J9). The spoken modes (identify_attribute, compare_two, non_standard) publish no levers yet.
- **Demanded by:** handoff 21 M2.
- **Evidence:** `compareObjectsLevers.test.ts` 16, `CompareObjects.levers.workspace.test.tsx` 2, sweep J1-J9 on `compare-objects.order_three`, replay 1 x 5 clean.
- **Probe:** those two test files; `journeySweep -t compare-objects.order_three`.

## Known answer-stating flags (not levers)

`showUnitNumbers` (non_standard) numbers the unit boxes; the last box is the spoken answer. It stays a post-affirmation reveal and must not become a help lever (handoff 21).

## Changelog

- 2026-09-28 — created with R1 (`/add-support-tiers`, handoff 21 M2).
