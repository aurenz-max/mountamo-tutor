# Contract: ordinal-line

- **Derived:** 2026-09-28, PARTIAL: written by `/add-support-tiers` (handoff 21 M2) for the lever requirement only. A full `/primitive-contract ordinal-line` derivation (consumers, the spoken modes' requirements) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/math/OrdinalLine.tsx` · **Boss:** `ordinalLine.card.ts` + `ordinalLine.boss.ts` · **Domain:** `ordinalLineDomain.ts` (`itemsFromChallenge` gates, ask, key, scene) · **Levers:** `ordinalLineLevers.ts` (one lever set) · **Catalog:** `service/manifest/catalog/math.ts` (`ordinal-line`, `...bossEntry(ordinalLineCard)`)

## Requirements

### R1 — build_sequence levers place no picture · OBSERVED (2026-09-28)
- **Property:** build_sequence publishes `front_flag` (a flag over place 1, the front end the task names), `place_dots` (1..n dots under the places; places only) and `three_places` (simplify, only on a line of more than three: three new characters, not the item's, from three clues spoken second, third, first, built through `itemsFromChallenge`, ungraded, then the full item). The clues are never printed as a lever: every clue names an absolute place, so printed clues would lay out the line. Scene facts name no picture. Every build miss is answered (J9).
- **Demanded by:** handoff 21 M2.
- **Evidence:** `ordinalLineLevers.test.ts`, `OrdinalLine.levers.workspace.test.tsx`, sweep J1-J9 on all five payloads, replay build_sequence 1 x 5 clean.
- **Probe:** those two test files; `npm run test:primitive -- ordinal-line`.

### R2 — spoken-mode levers name no character's place · OBSERVED (2026-09-29)
- **Property:** identify publishes `front_flag` (a flag at the front end), `tap_marks` (the learner's taps ring pictures on the line; no order, no number), `word_model` (only where the answer is a place word: three plain model circles with 1st, 2nd, 3rd, the same for every item, never on the line) and `shorter_line` (simplify: four new characters, another place than the item). relative_position publishes `front_flag`, `side_model` (three model circles fixed per question word: middle ringed, the one before or after it glowing) and `shorter_line` (three new characters, anchor second, the same question word). match publishes `place_model` (plain circles from a flagged front up to the place the card prints, the last ringed, no words). sequence_story publishes `word_model` and `short_story` (simplify: four new characters told front to back, asking another middle place). Practice items are built through `itemsFromChallenge`, ungraded, and return to the full item. Scene facts name no character and carry no digit. The place labels stay a post-affirmation reveal: `place_dots` is not offered on identify, where dots under the line would count the answer. Every spoken miss is answered (J9); identify's `cardinal_for_ordinal` is seen only on Grade 1 (payload `ordinal-line.identify-g1.json`).
- **Demanded by:** handoff 23 step 2.
- **Evidence:** `ordinalLineLevers.test.ts` (merged from `ordinalLineSpokenLevers.test.ts`), `OrdinalLine.levers.workspace.test.tsx` (merged from `OrdinalLineSpoken.levers.workspace.test.tsx`), sweep J1-J9 on six payloads.
- **Probe:** those two test files; `npm run test:primitive -- ordinal-line`.

### R3 — the ask never says its answer; the label is a post-credit reveal · OBSERVED (2026-10-20, re-based from the scripted pack)
- **Property:** runner-era requirements, re-based onto the workspace. Every spoken ask goes through the spoken preset's `askLeaks` (the story is the one `given` span: hearing it is the task). Each identify direction's ask names what the other wants. Every line-reading ask names the front. The ordinal labels under the line paint only while `runner.revealHeld`; the reward is the pairing (who, which place). The story and the build clues are never printed (scene `constraints`). A build commits on stillness, full or part-filled, and is checked in code (`lineMatches`/`lineMiss`); the tutor never receives the answer line. The scripted cues, corrections and catalog `tutoring` block that carried these rules on the runner are deleted.
- **Demanded by:** the DI port (qa/di/BACKLOG.md item 18 P4); boss migration wave 2.
- **Evidence:** `ordinalLineDomain.test.ts`, `OrdinalLine.workspace.test.tsx`, boss.test.ts (saved payloads through `askLeaks`).
- **Probe:** `npm run test:primitive -- ordinal-line`.

## Known answer-stating surfaces (not levers)

The ordinal labels under the character line (`showPositionLabels`) are the answer on identify and stay a post-affirmation reveal. The build slots' labels are the page, not the key, and stay on the support tier (withdrawn at hard).

## Changelog

- 2026-09-28 — created with R1 (`/add-support-tiers`, handoff 21 M2).
- 2026-09-29 — R2, the spoken modes' levers (`/add-support-tiers`, handoff 23 step 2).
- 2026-10-20 — boss migration: R1/R2 levers moved into one lever set (`side_model` is type `model`, so relative_position carries the support-tier rule; `word_model` is a `legend`; `place_model` is `custom`); R3 re-based the scripted pack's answer-leak and reveal rules onto the workspace.
