# Contract: picture-vocabulary

- **Derived:** 2026-09-29 · evidence window: DI port (items 16, 25) + workspace rollout C2 + w1 payloads + `PictureVocabulary.workspace.test.tsx` + git
- **Component:** `primitives/visual-primitives/literacy/PictureVocabulary.tsx` (workspace only) + `pictureVocabularyScript.ts` (build gates, `clueLeak`) + `pictureVocabularyWorkspace.ts` + `pictureVocabularyLevers.ts` · **Generator:** `service/literacy/gemini-picture-vocabulary.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`picture-vocabulary`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the picture-vocabulary slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 receptive vocabulary: receptive_match (tap) | catalog evalModes | `literacy.ts` picture-vocabulary entry | live |
| K-1 expressive vocabulary: naming, opposite, association, gradable_scale, sentence_frame (spoken) | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `pictureVocabularyWorkspace.ts`; w1 payloads | 2026-09-29 |

## Requirements

### R1 — receptive_match is the only tap mode; its cards carry no words before credit · OBSERVED
- **Probe:** `npm test -- PictureVocabulary.workspace`.

### R2 — Spoken modes print no option list; the answer word appears only after credit · OBSERVED
- **Probe:** `npm test -- PictureVocabulary.workspace`.

### R3 — Noun cards record their kind; the target carries a spoken clue · OBSERVED (09-29)
- **Property:** the noun pool schema requires `category` (what the thing itself is: a cup is a dish) and `clue` (what it does or where it is found). Code keeps a noun whose category or clue is invalid and drops only that field. `clueLeak` rejects a clue that says the word, a form of it, or its sounds, letters or rhymes, both at generation and at item build.
- **Probe:** `node scripts/picture-vocabulary-levers-probe.mjs --run` (09-29: 30/30 clues, 0 leaks); `npm test -- pictureVocabularyLevers`.

### R4 — In-item levers · OBSERVED
- **Property:** receptive_match wrong taps are named `same_category` / `other_category` (`other_picture` when a payload records no kinds). `function_cue` (help, both; receptive_match and naming) shows the clue card and the tutor says it. `two_cards_far` (simplify; receptive_match) opens an ungraded item on a foil-only session word with one card of another kind, never a session answer or a card of the current item (`practiceLeak`). Opposite, association, gradable_scale and sentence_frame have no misses and no lever yet.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- pictureVocabularyLevers PictureVocabulary.levers`.

### R5 — No first-sound, letter or rhyme hint before a try · OBSERVED (09-29)
- **Property:** catalog guidance bans it; a hint about what the thing does or where it is found is allowed.
- **Probe:** tutor replay `qa/tutor-reports/replay/picture-vocabulary-2026-09-29.json` (0 sound hints in 40 miss and stuck samples).
