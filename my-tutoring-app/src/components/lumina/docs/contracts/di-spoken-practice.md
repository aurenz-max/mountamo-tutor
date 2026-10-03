# Contract: di-spoken-practice

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-08-20 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diSpokenPracticeScript.ts`, `diSpokenPracticeWorkspace.ts`, `diSpokenPracticeLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-spoken-practice.ts` · **Catalog:** `service/manifest/catalog/di.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-3 spoken practice over five acts: count_and_say, compare_choice, read_aloud, say_answer, explain_concept | catalog + QA | payloads `w1-payloads/di-spoken-practice.*.json` (all five modes since 2026-10-03) | 2026-10-03 |
| explain_concept judge bench | QA | `qa/di-bench/run-2026-09-07-concept-statement.md` (0/32 false affirms) | 2026-10-03 |
| Support levers (DI family 9) | `/add-support-tiers` | `qa/support-levers/di-spoken-practice-lever-table-2026-10-03.md` | 2026-10-03 |

## Requirements

### R1 — Nothing on screen names the answer · OBSERVED
- **Property:** a count has no numeral (also under `touch_marks` and `five_rows`); a pair is unlabeled; printed text to read is the answer.

### R2 — The model is a different item; a compare model shows every menu word (R1) · OBSERVED
- **Property:** count: a different picture, a count more than one away and no count still to come. Compare: one pair per menu word from a code table, no session thing. Read: a word sharing no letter (a numeral sharing no digit). say_answer / explain_concept: a generated spare (R3) with no session answer or stimulus, never saying the item's answer; explain also never the item's concept or anchor.
- **Probe:** `diSpokenPracticeLevers.test.ts`.

### R3 — Spares come from the generator, never the runtime · OBSERVED
- **Property:** say_answer asks count + 2 and explain count + 3; the item the model marks `easier` and the surplus ride on `spares`, leak-checked at generation and at mount. No LLM call at runtime.
- **Probe:** `gemini-di-spoken-practice.test.ts` (ask count); unit tests.

### R4 — Simplify keeps the mode · OBSERVED
- **Property:** `smaller_group` (4+), `far_pair` (other word; never for "same"; passes `findChoiceMenuDefects`), `short_word` (refused on one CVC word or one digit), `easier_item` (the easier spare). All ungraded.

### R5 — Every mode names its misses · OBSERVED
- **Property:** read_aloud, say_answer and explain_concept gained miss ids (advisory spoken_miss patterns; judging unchanged).

### R6 — Tier sets where levers start; guidance under the 2000-character cap · OBSERVED
- **Probe:** `activityContract.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-10-03: derived (initial, static) with the DI lever slice. 6 requirements, 0 conflicts.
