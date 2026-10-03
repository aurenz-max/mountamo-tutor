# di-sentence-reading levers: DI family 6 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 4. Table and failure inventory: `qa/support-levers/di-sentence-reading-lever-table-2026-10-03.md`. No real-learner evidence: the misses are synthetic (`word_skip`, `word_swap`, the 07-25 bench omissions) or documented.

## What was built

| Mode | Help | Simplify |
|---|---|---|
| decodable_sentence, read_sentence, sentence_review | `model_sentence`, `tracking_underline`, `sound_dots` (CVC words only) | `short_line` |
| sight_phrase_sentence | `model_sentence`, `tracking_underline` | `short_sight_line` (R8, item-scoped) |

- **Model pool:** almost every decodable menu sentence has "the" or "a", so a long item had no model sharing no word with it. Decodable modes also draw on the shared all-CVC practice lines ("Sam can hop."); `short_line` then avoids the model's line.
- **Kit:** `LuminaPrintSupport` gains `dotWord` (default: every word, so decodable-reader, read-aloud-studio and word-workout are unchanged).
- **Pure menu:** `SENTENCE_MENU` moved to `diSentenceReadingMenu.ts`.
- **Support fact** replaces the tier; catalog `levers: true`, guidance trimmed under the 2000-character cap; the verdict probe replays the starting-lever facts.
- **New payload:** `di-sentence-reading.read_sentence-hard.json` (saved sentences at tier hard).

**Size:** 135 lines of lever module and about 90 of component, domain, kit and catalog change, against 220 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diSentenceReadingLevers.test.ts`, 19) | every menu sentence in every mode it can appear in has a model sharing no word; saved items; CVC word rule; dots refused where nothing can be sounded out; both simplify builders; mode floor; starting positions; miss → lever; both misses answered on every payload |
| Mounted (`DiSentenceReading.levers.workspace.test.tsx`, 4) | underline (6 segments) and dots under CVC words only, print unchanged; easy model shares no word; short line ungraded then the full sentence credited; refused pulls change nothing |
| Dry journey J1-J9 | 5/5 payloads (three modes new since step 0) |
| typecheck | lumina 0 |
| Text replay (Flash, 5 payloads × 5) | 0 flags. "My turn: Look at me!" then the child's card; after a miss the tutor pulls the underline or the dots |

## Not covered

- **`word_added` / `word_order` have no miss id.** `lineReadingMisses` is shared with decodable-reader and read-aloud-studio, so adding them is a class change for `/add-live-tutor-tools`; until then the underline answers an added word by `when` text only.
- Not browser-checked (HUMAN-CHECKS #183, sentence row). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 7, di-worked-procedure (plan step 5).
