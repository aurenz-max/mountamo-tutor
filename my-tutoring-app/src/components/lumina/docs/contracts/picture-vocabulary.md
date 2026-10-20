# Contract: picture-vocabulary

- **Derived:** 2026-09-29 · evidence window: DI port (items 16, 25) + workspace rollout C2 + w1 payloads + `PictureVocabulary.workspace.test.tsx` + git
- **Component:** `primitives/visual-primitives/literacy/PictureVocabulary.tsx` (workspace only, boss: `pictureVocabulary.card.ts` + `pictureVocabulary.boss.ts`) + `pictureVocabularyDomain.ts` (build gates, `clueLeak`, ask, key, scene) + `pictureVocabularyLevers.ts` (lever set) · **Generator:** `service/literacy/gemini-picture-vocabulary.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`picture-vocabulary`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the picture-vocabulary slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 receptive vocabulary: receptive_match (tap) | catalog evalModes | `literacy.ts` picture-vocabulary entry | live |
| K-1 expressive vocabulary: naming, opposite, association, gradable_scale, sentence_frame (spoken) | catalog evalModes | same | live |
| Shared teaching workspace + live journey | live + code | `pictureVocabulary.boss.ts` (`bossAdapter`, `bossJourney`); w1 payloads | 2026-10-20 |

## Requirements

### R1 — receptive_match is the only tap mode; its cards carry no words before credit · OBSERVED
- **Probe:** `npm test -- PictureVocabulary.workspace`.

### R2 — Spoken modes print no option list; the answer word appears only after credit · OBSERVED
- **Probe:** `npm test -- PictureVocabulary.workspace`.

### R3 — Noun cards record their kind; the target carries a spoken clue · OBSERVED (09-29)
- **Property:** the noun pool schema requires `category` (what the thing itself is: a cup is a dish) and `clue` (what it does or where it is found). Code keeps a noun whose category or clue is invalid and drops only that field. `clueLeak` rejects a clue that says the word, a form of it, or its sounds, letters or rhymes, both at generation and at item build.
- **Probe:** `node scripts/picture-vocabulary-levers-probe.mjs --run` (09-29: 30/30 clues, 0 leaks); `npm test -- pictureVocabularyLevers`.

### R4 — In-item levers · OBSERVED
- **Property:** receptive_match wrong taps are named `same_category` / `other_category` (`other_picture` when a payload records no kinds). `function_cue` (`clue`, both; receptive_match and naming) shows the clue card and the tutor says it; the lever set refuses a clue that names the word. `two_cards_far` (`easier`; receptive_match) opens an ungraded item on a foil-only session word with one card of another kind, never a session answer or a card of the current item (`practiceLeak`). The relation modes' levers are R6. Re-based 10-20: one lever set (`PICTURE_VOCAB_LEVERS`) declares them; the scene fact is `onScreen` (was `levers_on_screen`).
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- pictureVocabularyLevers PictureVocabulary.levers`.

### R6 — Relation modes: a worked model on other words · OBSERVED (09-29, handoff 24)
- **Property:** opposite, association, gradable_scale and sentence_frame each declare one help lever (`opposite_model`, `goes_with_model`, `scale_model`, `frame_model`): a code-owned model whose words are no word, base word, scale word or frame word of the session (`modelLeak`), shown as pictures and said by the tutor. Their spoken misses are named (`said_base_word`, `not_opposite`, `no_link`, `given_rung`, `off_scale`, `does_not_fit`) and each is answered.
- **Probe:** `npm test -- pictureVocabularyLevers PictureVocabulary.levers contentSpokenMisses`.

### R5 — No first-sound, letter or rhyme hint before a try · OBSERVED (09-29)
- **Property:** each word item's scene `constraints` (`pictureVocabScene`) ban it before a try; a hint about what the thing does or where it is found is allowed. Re-based 10-20: the catalog guidance prose that carried it is gone (boss doctrine), so the rule moved onto the item's scene.
- **Probe:** tutor replay `qa/tutor-reports/replay/picture-vocabulary-2026-09-29.json` (0 sound hints in 40 miss and stuck samples).

### R7 — `pair_build` is a fork: a tap build, code-judged · OBSERVED (10-08)
- **Property:** `pair_build` (open build: two wordless pictures into a pair tray, "I'm done!", several pairs pass) is its own challenge type on the shared pair surface. It is the stated exception to R1 (a second tap mode): its cards carry no words, and names are spoken only on request or through `say_names`, so R1's no-words rule still holds. Judged in code from `PAIR_PICTURES`; every board carries an alike (opposites) or same-kind (goes together) decoy; no CLASH pair and no adjacent right pair on a board. Levers `say_names` (`legend`), `model_pair` (`model`), `small_board` (`easier`), in the same lever set as the other modes and passed to the shared surface through its `boss` prop. The pair scene's `constraints` say never to name a right pair before a try. The six other modes are unchanged.
- **Demanded by:** OB-8L (`qa/open-build/ROADMAP.md`).
- **Evidence:** `qa/open-build/picture-vocabulary-2026-10-08/REPORT.md`.
- **Probe:** `npm test -- PicturePair.workspace`.

## Changelog
- 2026-10-20 — **Boss migration** (wave 2). Card + boss on `spokenBoss`: five `SPOKEN` modes keyed by a `SpokenKey` (association: a rule with the generated partner as one example, carrying the bench guards), receptive_match `TAP_ONE` and pair_build `build` keyless through `show`. The scripted DI cues (`[PV_*]`), the DI port and its association-bench drive plan, the catalog `tutoring` block and guidance prose, the hand Pip wiring and the hand-built levers are deleted. R1-R3, R6 hold unchanged; R4, R5, R7 re-based (see each). `RhymePairSurface` now requires `boss` (both hosts are bosses).
- 2026-10-13 — **R-WS noun word space** (`/add-word-space`). Before (`qa/word-space-lab/2026-10-13/picture-vocabulary/before.txt`): apple, cat, sun, tree, shoe, ball at every tier; receptive_match wrong pictures always from other categories; lamp pictured as 💡. After: receptive easy bacon among cloud, chick, castle → hard taco among broccoli, honey, onion; naming easy dress, worm, ear → hard potato, microphone, bucket.

- 2026-09-29 — R6 added (handoff 24): the four relation modes get named misses and one model lever each. R2 holds: no option list, no answer word before credit. `npm test` 64/64 on the primitive.
- 2026-10-08 — R7 added (OB-8L): `pair_build` forks as a second tap mode with no words on its cards; R1-R6 unchanged (`PicturePair.workspace` + `RhymePair.workspace` 16/16).
