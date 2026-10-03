# Contract: di-sentence-reading

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-07-25 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiSentenceReadingTeaching.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diSentenceReadingDomain.ts`, `diSentenceReadingLevers.ts`, `diSentenceReadingMenu.ts` · **Kit:** `ui/LuminaPrintSupport.tsx` (`dotWord`) · **Generator:** `service/direct-instruction/gemini-di-sentence-reading.ts` · **Catalog:** `service/manifest/catalog/di.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 connected-text accuracy: decodable_sentence, read_sentence, sentence_review, sight_phrase_sentence | catalog + QA | payloads `w1-payloads/di-sentence-reading.*.json` (four modes + `read_sentence-hard`) | 2026-10-03 |
| Live tutor + JEV; verdict probe (`--sentences`) | tutor reports | `qa/tutor-reports/di-sentence-reading-jev-*` | 2026-10-03 |
| `LuminaPrintSupport` consumers (decodable-reader, read-aloud-studio, word-workout) | kit | `dotWord` defaults to every word | 2026-10-03 |
| Support levers (DI family 6) | `/add-support-tiers` | `qa/support-levers/di-sentence-reading-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — The printed sentence is the answer; nothing reads it first · OBSERVED (R2 2026-10-03)
- **Property:** no "Listen" / "Together" on the child's sentence and no correction re-read; the tutor may say it back only after credit. Affordance `reader: 'emerging'` (R10).
- **Probe:** catalog guidance; `DiSentenceReading.teaching.test.tsx`.

### R2 — The model is a different sentence sharing no word · OBSERVED
- **Property:** `model_sentence` comes from the mode's pool (decodable menu sentences and all-CVC practice lines; sight-heavy menu sentences; any for read and review), shares no word with the item, is no session sentence.
- **Probe:** `diSentenceReadingLevers.test.ts` (every menu sentence × mode).

### R3 — Help draws marks that read nothing · OBSERVED
- **Property:** `tracking_underline` marks every word the same; `sound_dots` dots only CVC words and never an irregular one; sight_phrase_sentence gets no dots.
- **Probe:** `DiSentenceReading.levers.workspace.test.tsx`.

### R4 — Simplify keeps the mode and the floor · OBSERVED
- **Property:** `short_line` (3-word practice line sharing no word with the session; all-CVC on decodable_sentence); `short_sight_line` (shorter sight-heavy sentence sharing no word with the item, R8). Both refused on a 3-word item; ungraded; the full sentence returns.

### R5 — A starting position is not a pull · OBSERVED

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 5 requirements, 0 conflicts.
