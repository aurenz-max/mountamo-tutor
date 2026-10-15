# Contract: di-word-reading

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-08-04 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiWordReadingTeaching.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diWordReadingDomain.ts`, `diWordReadingLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-word-reading.ts` · **Catalog:** `service/manifest/catalog/di.ts` (`id: 'di-word-reading'`)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 CVC decoding: cvc_reading, read_word, word_reading_review | catalog + QA | payloads `w1-payloads/di-word-reading.*.json` (and `.cvc_reading-hard.json`) | 2026-10-03 |
| K-1 sight words: sight_word | catalog | payload `.sight_word.json` | 2026-10-03 |
| Live tutor + JEV; verdict probe (`scripts/tutor-verdict-probe.mjs --words`) | tutor reports | `qa/tutor-reports/di-word-reading-*` | 2026-10-03 |
| Lesson bench (`service/qa/lessonBench/journey/extract.ts`) | code | `journey.test.ts` | 2026-10-03 |
| Support levers (DI family 5) | `/add-support-tiers` | `qa/support-levers/di-word-reading-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — The printed word is the only thing on the card before the read · OBSERVED
- **Property:** no picture of the item word, no audio; the reward picture appears only in the read-words trail after credit.
- **Probe:** `DiWordReading.teaching.test.tsx`.

### R2 — A decodable word's letters are its targets; a sight word has none · OBSERVED
- **Probe:** `DiWordReading.teaching.test.tsx` ("publishes the printed letters, and no blend…").

### R3 — Nothing reads or blends the child's own word · OBSERVED (ruling 2026-10-02, R2 2026-10-03)
- **Property:** no `soundOut` fact; guidance forbids reading, blending or sounding out the item before or after a miss. `model_word` shows a DIFFERENT word: never a session word, sharing no letter with the item, never the item reversed or a sight look-alike either way round.
- **Probe:** `diWordReadingLevers.test.ts`.

### R4 — Print help is silent · OBSERVED
- **Property:** `blend_slide`, `sound_dots`, `tracking_arrow` (decodable only) draw marks and no text; nothing plays.
- **Probe:** `DiWordReading.levers.workspace.test.tsx`.

### R5 — `short_word` is a two-letter word of the same mode (R7) · OBSERVED
- **Property:** never a session word nor the start or end of one; ungraded; the full word returns and only it is credited. Refused on a sight word.

### R6 — A sight word the child does not know gets no lever (R6) · OBSERVED
- **Property:** a sight item declares only `model_word`.

### R7 — Tier sets where the levers start · OBSERVED
- **Property:** the generator stamps `supportTier` per challenge only when `config.difficulty` is a tier; absent = easy (model card on screen). A starting position is not a pull. On the menu path the tier changes nothing else; on the word-space path (R9) it also picks the words.

### R8 — Every named miss is answered, per mode · OBSERVED
- **Property:** cvc_reading never lists `similar_word`; sight_word never lists a position miss.
- **Probe:** `diWordReadingLevers.test.ts`; `journeySweep.test.tsx` J9.

### R9 — With a tier, the words come from the word library (2026-10-14) · OBSERVED
- **Property:** with a support tier, grade K or 1 and no remediation focus, each mode's words are code-picked at the tier's third of predicted beta (`service/wordSpace/diWordReadingSpaces.ts`). CVC words are phonics-blender's CVC space inside the objective's letter scope (s a t i p n admits only those letter-sounds; a short-vowel lesson binds the vowel), one letter per sound. Sight words are Dolch words the grade's taught pairs cannot decode ("and" never; "see", "make" at K only). read_word and word_reading_review hold one sight word in four (at least one from 2 slots); review draws CVC words across vowels. No word repeats in a session, and every item keeps a `model_word` card (R3). Each challenge carries `wordSpace` {space, structure, beta}, never rendered or sent to the tutor. A mode whose space cannot fill its slots takes the menu path; when every mode fills, no model call is made.
- **Probe:** `npm test -- service/wordSpace/diWordReadingSpaces`; `qa/word-space-lab/2026-10-13/di-word-reading/run-probe.sh`.

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 8 requirements, 0 conflicts.
- 2026-10-14: R9 added (word space, `/add-word-space`). Before: all 4 modes gave the same words at every tier (review: and the red pig in 6/6 runs), "s a t i p n" served mat/cat/hat, a CVC-and-sight objective served 4 sight words, "and" was labelled irregular. After: all 4 modes code-picked, tiers separate (short a easy man/map/ran -> hard mad/bag/tap/pan; G1 sight easy is/blue/two -> hard were/of/could). R7 narrowed to the menu path.
