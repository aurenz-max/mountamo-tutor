# Contract: di-spoken-practice

- **Derived:** 2026-10-03 (static: QA reports, tests, git history; no live census) · evidence window: 2026-08-20 → 2026-10-03
- **Component:** `primitives/visual-primitives/direct-instruction/DiSpokenPractice.tsx` (stage: `DiTeachingStage.tsx`) · **Domain:** `diSpokenPracticeScript.ts`, `diSpokenPracticeWorkspace.ts`, `diSpokenPracticeLevers.ts` · **Generator:** `service/direct-instruction/gemini-di-spoken-practice.ts` · **Catalog:** `service/manifest/catalog/di.ts`
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-3 spoken practice over five acts: count_and_say, compare_choice, read_aloud, say_answer, explain_concept | catalog + QA | payloads `w1-payloads/di-spoken-practice.*.json` (all five modes since 2026-10-03) | 2026-10-03 |
| explain_concept judge bench | QA | `qa/di-bench/run-2026-09-07-concept-statement.md` (0/32 false affirms) | 2026-10-03 |
| K grammar frames: article_choice, pronoun_choice, verb_form, verb_tense (LA K audit GR8, GR9, GR15, GR16; 20 subskills) | catalog evalModes + code-built items (`spokenGrammarFrames.ts`, `wordSpace/grammarSpaces.ts`) | `spokenGrammarFrames.test.ts` (every frame x tier) | 2026-11-10 |
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

### R7 — A grammar frame's key, wrong forms and picture come from code · OBSERVED
- **Property:** article/pronoun/verb-form/tense items are built from the word library with no model-written content: a/an keyed on the first SOUND (letter and sound must agree, so "hour" is never generated), a pronoun picture shows one clear person or group from a reviewed table, plural and past forms from word-flip's oracle. Every item has a library picture; the answer is never printed. The ask says the two choices at the easy tier, and on every tier for agreement and tense (the verb can be named only through its forms). Every session holds both sides of the contrast. Model card: one solved sentence per menu word (R2's rule), pictures only.
- **Probe:** `spokenGrammarFrames.test.ts`.

### R6 — Tier sets where levers start; guidance under the 2000-character cap · OBSERVED
- **Probe:** `activityContract.test.ts`.

## Conflicts

None open.

## Changelog

- 2026-11-10: four grammar-frame modes (H1): article_choice (a/an, a/the), pronoun_choice (he/she, he/she/they, his/her/their, subject vs object), verb_form (present agreement, is/are/am + -ing), verb_tense (-ed past, irregular past, will). Code-built (R7); one flash-lite call picks which frames of the mode the objective names. Levers `form_model` and `two_choices`; misses `other_form`, `said_noun`. Existing modes, the is/are say_answer path and the card's shared words are unchanged; `findAnswerLeaks` exempts a grammar ask only when its whole menu is spoken (`findFrameMenuDefects`), and the key carries `menu` for any item with spoken choices.

- 2026-11-04: explain_concept robustness. The planner names ONE session idea for how-it-works/why-it-happens objectives too (not only a symbol) and states the true idea when the objective's premise is wrong; concept sentence cap 12 -> 16 words (new `concept_length` defect); the item retry is told why the last draft lost items; a planned idea is not re-judged per item; mechanism scenes show the effect, never the cause. Math, pattern and choice shapes unchanged (bench 4/4 each, `qa/di-bench/harness-bench-2026-11-04/`). An empty session now fails the fit gate.
- 2026-10-18 (later): the catalog `tutoring` block is deleted (bound sessions send `tutoring: null`; the live-activity route no longer echoes it). Four `special` sentences moved to the shared doctrine (`JUDGED_BY.tutor`: what the key names; the reading-is-the-answer rule; the screen rule; `LEVER_TYPE_DOCTRINE.model`), one was the meaning key's own text; this changes the guidance (one replay sample owed).
- 2026-10-18: moved onto the boss framework — `diSpokenPractice.card.ts` (facts, catalog) + `diSpokenPractice.boss.ts` (`spokenBoss`); key via shared `spokenKeyText`, leak gate via `spokenKeyLeaks`, generator key fields via `spokenKeyProperties`; levers as one `SPOKEN_LEVERS` set. Tutor input byte-identical (R1-R6 unchanged; lever ids, order, words and facts kept).
- 2026-10-17: explain_concept also serves why-questions about everyday scenes (social studies reasons, choose-and-give-the-reason); math instance shapes unchanged (explain probe 9/9). DSP-SS1.
- 2026-10-03: derived (initial, static) with the DI lever slice. 6 requirements, 0 conflicts.
