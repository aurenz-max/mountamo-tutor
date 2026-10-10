# context-clues-detective — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C21. `withWorkspaceController`: the scripted path is kept. Not committed.

## Modes and what code checks
Each generated word becomes three gesture items (`<word id>:find|classify|define`), so a 3-word lesson is 9 items. The activity's own check is the judge (`contextCluesWorkspace.ts`); no `expectedAnswer`, no key in the facts before its step is credited.

| Step | Learner input | Check | Misses (`clueMiss`) |
|---|---|---|---|
| find | tap sentences ("sentence N"), Check Clue | a clue to find is tapped, nothing tapped is a non-clue (the word's own sentence allowed) | target_sentence_only, extra_sentence, no_clue |
| classify | tap one of 5 types, Check Type | type = `clueType` | similar_opposite, definition_synonym, said_inference, stated_for_inference, other_type |
| define | tap an option (or type), Check Meaning | option = `correctMeaning` (typed: exact or `acceptableMeanings`) | other_meaning |

All four catalog modes (definition, synonym_antonym, example, inference) run the same three steps; the catalog lists per mode the classify misses its clue types can produce.

## Fixed on both paths
- **Example mode could never pass find.** The word's own sentence was not tappable, and all 3 example-mode payload words put their only clue there. Every sentence is tappable now.
- **Tapping every sentence passed find** (any tapped clue passed). The find now fails when a non-clue is tapped, and the highlighted sentence alone fails when the clue is elsewhere.
- **Workspace only:** a wrong meaning no longer prints "The meaning is: ..." nor the dictionary; Try again reopens the step. Next Word/Finish hidden; input closes while a checked answer waits.

## Gates
- `typecheck:lumina` 0.
- `ContextCluesDetective.workspace.test.tsx` 9/9; `pip/LiteracyWorkspaces.surface.test.tsx` green; misses, activityContract, lessonWorkspacePlan, sourceControlBytes: 278 passed.
- `workspaceContract -t context-clues` + sweep: 21 passed. Sweep: 4 payloads, 36 items, 0 findings (J1-J8), 36/36 misses named; J10 clean 100, J11 recover 67.

## Tutor replay (4 payloads x 5 samples; find step of the first word)
- r1 (`replay/context-clues-detective-2026-10-09.json`): `no_key_before_try` 5/20 on miss, 6/20 on stuck. Real: on example items the clue is inside the word's own sentence and the tutor said "read sentence 2" (the answer); the facts named the word's sentence number. Guidance now forbids naming, numbering or quoting a sentence on the find step; the word fact no longer gives a number.
- r2 (`-r2.json`): 0 misses on every check. Read by hand: miss replies say why the tapped sentence is not a clue and ask what the passage tells about the word; stuck replies point to "around where the word appears" (on example items that still narrows the search; see finding 2).

- r3, r4 (with levers): see the lever report. r4: 0 misses on every check.

## Undriven modes
None. Classify and define steps are driven by the sweep, but the replay records only the first item (a find step), so no replay covers the classify step, where the mode name is the answer.

## Open findings
1. ~~The mode name is the classify answer.~~ Resolved (orchestrator ruling): the classify step is built only when the session mixes clue types; definition, example and inference sessions are find then define (6 items for 3 words). Sweep after the change: definition/example/inference 6 items, synonym_antonym 9, 0 findings J1-J13, every miss named and answered.
2. **Example items are a find step with the clue in the word's own sentence** (3/3 payload words). Tapping the highlighted sentence is the answer; the step teaches little. `/eval-fix` on the generator (place example clues in a following sentence at medium/hard).
3. ~~The support tier's `showClueHints` outlined the real clue sentences at easy and medium.~~ Fixed in the lever slice: it now starts the `sentence_list` lever (`qa/eval-reports/context-clues-detective-levers-2026-10-09.md`).
4. Needs a browser check on the tappable sentences (now buttons) and the step flow (JSDOM only).
5. The scripted tutoring block stays (scripted fallback).
