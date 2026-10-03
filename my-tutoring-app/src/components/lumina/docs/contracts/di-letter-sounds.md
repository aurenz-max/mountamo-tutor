# Contract: di-letter-sounds

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-07-20 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiLetterSoundsTeaching.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diLetterSoundsDomain.ts`, `diLetterSoundsLevers.ts`, `diLetterSoundsMenu.ts` · **Generator:** `service/direct-instruction/gemini-di-letter-sounds.ts` · **Catalog:** `service/manifest/catalog/di.ts` (`id: 'di-letter-sounds'`)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K letter-sound correspondence: letter_sound, letter_sound_review | catalog + QA | payloads `w1-payloads/di-letter-sounds.letter_sound.json`, `-stops.json`, `.letter_sound_review.json` | 2026-10-03 |
| K onset isolation: first_sound_in_word | catalog | payload `.first_sound_in_word.json` | 2026-10-03 |
| Live tutor + JEV on the shared workspace | tutor reports | `qa/tutor-reports/di-letter-sounds-*` | 2026-10-03 |
| Lesson bench (`service/qa/lessonBench/journey/extract.ts`) | code | `journey.test.ts` | 2026-10-03 |
| Support levers (DI family 4) | `/add-support-tiers` | `qa/support-levers/di-letter-sounds-lever-table-2026-10-03.md`, replay `qa/tutor-reports/replay/di-letter-sounds-*-2026-10-03.json` | 2026-10-03 |

## Requirements

### R1 — A letter's sound, never its name · OBSERVED
- **Property:** the letter name is a miss (`letter_name`); a stop accepts its clipped release with a small "uh", its keyword, or a word starting with it; a short vowel accepts the same (ruling R5, 2026-10-03: the ask no longer contains the keyword).
- **Probe:** `DiLetterSounds.teaching.test.tsx`; `diReadingSpokenMisses.test.ts`.

### R2 — An onset item never shows the lone grapheme · OBSERVED
- **Probe:** `DiLetterSounds.teaching.test.tsx` ("draws the WORD and never the lone grapheme").

### R3 — Nothing models the child's own sound · OBSERVED (ruling 2026-10-02, R2 2026-10-03)
- **Property:** no guidance, tier text or fact models the item's sound or its keyword route. `model_sound` shows a DIFFERENT letter of the same kind (held, clipped or vowel; held only on onset), never the item's sound, its confusable or voicing partner, a letter of its keyword, or a letter or picture still to come.
- **Probe:** `diLetterSoundsLevers.test.ts`. On a 20-letter review 2 items (the first m and a) have no model; that is pinned.

### R4 — The keyword picture is a lever on a letter item · OBSERVED (ruling R4)
- **Property:** on letter_sound and review the picture is drawn only at easy (starting position) or when `keyword_picture` is pulled (recorded as help); its demonstrate target exists only while drawn. On an onset item it is always drawn.
- **Probe:** `DiLetterSounds.levers.workspace.test.tsx`.

### R5 — Help says no sound · OBSERVED
- **Property:** `sound_arrow` (held letters only) draws a ball and an arrow, no text; `first_box` draws empty boxes, one per sound of the word from a code table, the first lit.
- **Probe:** `DiLetterSounds.levers.workspace.test.tsx`.

### R6 — No simplify · OBSERVED
- **Property:** another letter asks the same thing, not less; every onset item is at the mode floor.

### R7 — Every named miss is answered, per mode · OBSERVED
- **Property:** `last_sound` is listed and answered on first_sound_in_word only.
- **Probe:** `diLetterSoundsLevers.test.ts`; `journeySweep.test.tsx` J9.

## Conflicts

None open.

## Catalog projection

- **description / constraints / guidance:** faithful as of 2026-10-03 (clipped stops in constraints; model on a different letter; `levers: true`).

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 7 requirements, 0 conflicts.
