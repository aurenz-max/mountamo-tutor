# context-clues-detective — support levers, 2026-10-09

`/add-support-tiers` on the W1 binding (`qa/tutor-reports/context-clues-detective-w1-2026-10-09.md`). Not committed.

## Failure inventory
Every mode runs the same three steps per word, so the inventory is per step. No real-learner evidence exists for this primitive (no demonstrations, no misconception reports, no prior eval reports).

| Step | Failure | Miss | Class |
|---|---|---|---|
| find | taps a sentence that tells nothing about the word | `no_clue` | documented (catalog commonStruggles), synthetic (sweep) |
| find | taps only the highlighted sentence when the clue is elsewhere | `target_sentence_only` | inferred |
| find | taps a clue together with sentences that are not | `extra_sentence` | inferred (was a pass before W1) |
| classify | synonym and antonym swapped | `similar_opposite` | documented |
| classify | a spelled-out meaning called a synonym, or the reverse | `definition_synonym` | inferred (the generator's own examples blur them) |
| classify | inference for a stated clue / a stated type for an inference clue | `said_inference`, `stated_for_inference` | documented ("cannot tell which clue type") |
| classify | any other type | `other_type` | documented |
| define | picks a meaning without using the clue | `other_meaning` | documented ("guesses the meaning without using the clue") |

## Lever table (all help, carrier shown, every mode)

| Step | Lever | Answers | Leak rule (code) | Tier start |
|---|---|---|---|---|
| find | `sentence_list`: one numbered sentence per line, the word's own tagged "has the word" | no_clue, extra_sentence, target_sentence_only | every sentence drawn alike; no clue marked | easy, medium (`showClueHints`) |
| find | `cross_out`: greys sentences an earlier check found hold no clue | no_clue, target_sentence_only | only taps of a `no_clue`/`target_sentence_only` check, never a clue sentence (`ruledOutBy`, `crossOutLeaks`); offered once there is one | none |
| classify | `type_descriptions`: the five fixed one-line descriptions | all five classify misses | same text on every word; no type named for this word | easy (`showClueTypeDescriptions`) |
| classify | `signal_words`: underlines "means", "or", "unlike", "such as"... in the green clue sentences | similar_opposite, definition_synonym, said_inference, other_type | signal words only, never a type name; offered only when a clue sentence has one | none |
| define | `strategy`: how to read the type already credited | other_meaning | never a meaning | easy (`strategyHint`) |
| define | `try_in_place`: the word's sentence with the learner's own pick in its place | other_meaning | only the learner's pick fills it; nothing marks a right one; offered only when the sentence holds the word as written | none |

**No simplify lever (decision, every mode).** An easier ask on the same word (a shorter passage, fewer types, fewer meanings) hands back its answer when the full item returns; in a pinned mode every word has the same clue type, so an easier type item shows the classify answer; the session has no spare word to practise on. A generated spare word would allow a find/define simplify (generator work, filed below).

## Built
- `contextCluesLevers.ts` (declarations, `answers`, leak rules, facts); component lever state keyed by step, `pullLever` on `workspace.current`, a scene fact (`onScreen`) per pulled lever, a refusal for a pull that changes nothing.
- **Tier fix (both paths):** `showClueHints` used to outline the real clue sentences at easy and medium, which drew the find step's answer. It now starts `sentence_list`; the generator's prompt line says no clue is ever marked. `STRATEGY_HINT_BY_TYPE` now comes from the levers module (one copy).
- Catalog `teachingWorkspace.levers: true`.

## Gates
- `typecheck:lumina` 0.
- `contextCluesLevers.test.ts` 15, `ContextCluesDetective.levers.workspace.test.tsx` 3, `ContextCluesDetective.workspace.test.tsx` 9; with misses, activityContract, lessonWorkspacePlan, sourceControlBytes, pip literacy surfaces: 8 files, 317 passed.
- Sweep + workspace contract `-t context-clues`: 21 passed. 4 payloads, 36 items, 0 findings J1-J13, 36/36 misses named; lever inventory: every miss of every mode answered (J9, J12), no `unanswered` list needed; J10 clean 100, J11 recover 67.

## Tutor replay (4 payloads x 5 samples)
- r3 (`qa/tutor-reports/replay/context-clues-detective-2026-10-09-r3.json`): 1/20 `no_key_before_try` on stuck (example item): after pulling `sentence_list` the tutor said "sentence 2 is marked because it contains the word... look at the line with our mystery word", which on an example item is the clue. Guidance now forbids pointing to any sentence or line on the find step, also after a lever.
- r4 (`-r4.json`): 0 misses on every check, `no_change_before_receipt` 0/20. Read by hand: lever replies describe the list/greying after the receipt and ask which sentence tells about the word; stuck replies pull `cross_out` or `sentence_list` themselves. On example items "look at what the passage tells us around our mystery word" still narrows to the answer (W1 finding 2).

## Failures with no lever / open
1. Example items put the only clue in the word's own sentence (3/3 payload words), so any help that mentions the word's sentence points at the answer. `/eval-fix` on the generator.
2. Classify now exists only in a session that mixes clue types (synonym_antonym), so its levers apply there only; single-type modes have find and define levers.
3. A generated spare word per lesson would make a find/define simplify possible (`/add-support-tiers` follow-up, generator schema).
4. J13 pulls help levers on the first item only (a find step); classify and define levers are covered by the mounted test, not the sweep.
5. Needs a browser check on the list layout, the greyed sentences, the underlines and the try-it panel (JSDOM only).
