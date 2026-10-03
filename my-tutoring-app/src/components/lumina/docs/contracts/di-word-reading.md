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
- **Property:** the generator stamps `supportTier` per challenge only when `config.difficulty` is a tier; absent = easy (model card on screen). A starting position is not a pull.

### R8 — Every named miss is answered, per mode · OBSERVED
- **Property:** cvc_reading never lists `similar_word`; sight_word never lists a position miss.
- **Probe:** `diWordReadingLevers.test.ts`; `journeySweep.test.tsx` J9.

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 8 requirements, 0 conflicts.
