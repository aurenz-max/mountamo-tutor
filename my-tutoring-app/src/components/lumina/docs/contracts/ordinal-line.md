# Contract: ordinal-line

- **Derived:** 2026-09-28, PARTIAL: written by `/add-support-tiers` (handoff 21 M2) for the lever requirement only. A full `/primitive-contract ordinal-line` derivation (consumers, the spoken modes' requirements) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/OrdinalLine.tsx` · **Items:** `ordinalLineScript.ts` (`itemsFromChallenge` gates) · **Workspace:** `ordinalLineWorkspace.ts` · **Catalog:** `service/manifest/catalog/math.ts` (`ordinal-line`)

## Requirements

### R1 — build_sequence levers place no picture · OBSERVED (2026-09-28)
- **Property:** build_sequence publishes `front_flag` (a flag over place 1, the front end the task names), `place_dots` (1..n dots under the places; places only) and `three_places` (simplify, only on a line of more than three: three new characters, not the item's, from three clues spoken second, third, first, built through `itemsFromChallenge`, ungraded, then the full item). The clues are never printed as a lever: every clue names an absolute place, so printed clues would lay out the line. Scene facts name no picture. Every build miss is answered (J9). The spoken modes publish no levers yet.
- **Demanded by:** handoff 21 M2.
- **Evidence:** `ordinalLineLevers.test.ts` 9, `OrdinalLine.levers.workspace.test.tsx` 2, sweep J1-J9 on all five payloads, replay build_sequence 1 x 5 clean.
- **Probe:** those two test files; `journeySweep -t ordinal-line`.

## Known answer-stating surfaces (not levers)

The ordinal labels under the character line (`showPositionLabels`) are the answer on identify and stay a post-affirmation reveal. The build slots' labels are the page, not the key, and stay on the support tier (withdrawn at hard).

## Changelog

- 2026-09-28 — created with R1 (`/add-support-tiers`, handoff 21 M2).
