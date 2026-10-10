# Contract: context-clues-detective

- **Derived:** 2026-10-09, PARTIAL: written by the W1 workspace binding (ROLLOUT C21) for the workspace requirements only. A full `/primitive-contract context-clues-detective` derivation (consumers per vocabulary skill, grade bands) is still owed.
- **Component:** `src/components/lumina/primitives/visual-primitives/literacy/ContextCluesDetective.tsx` · **Workspace:** `contextCluesWorkspace.ts` · **Generator:** `service/literacy/gemini-context-clues-detective.ts` · **Adapter:** `components/live-activity/adapters/contextCluesDetectiveLive.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`context-clues-detective`)

## Requirements

### R1 — every mode binds the shared teaching workspace, checked steps per word, no key reaching the tutor early · OBSERVED (2026-10-09)
- **Property:** each generated word is `<word id>:find` and `:define`, with `:classify` between them only when the session mixes clue types (`cluePhases`). When every word shares one type (every definition, example and inference session, and an all-synonym or all-antonym one) the classify step would have one possible answer, the mode name the tutor receives, so it is not built and its misses are not in those modes' lists. All steps are all gesture items checked by the activity's own check (`findCorrect`, `classifyCorrect`, `defineCorrect`). Each wrong check names a `ContextClueMiss` from the catalog list. Scene facts carry the numbered passage, the step, the learner's work and the on-screen menus; the clue sentences appear only after the find step is credited, the clue type only after the classify step, and the meaning never. On the workspace path a wrong meaning shows neither the meaning nor the dictionary (Try again reopens the step); the dictionary appears once the meaning is credited. Next Word / Finish are not shown; the scripted cues send nothing.
- **Evidence:** `ContextCluesDetective.workspace.test.tsx`; sweep J1-J8 on 4 payloads (`qa/tutor-reports/context-clues-detective-w1-2026-10-09.md`).

### R2 — the find step is a real search · OBSERVED (2026-10-09)
- **Property:** every sentence is tappable, the word's own sentence included. A find passes when a tapped sentence is a clue to find (a clue sentence other than the word's own, or the word's own when the clue sits only inside it) and every other tapped sentence is a clue or the word's own sentence. Tapping every sentence fails (`extra_sentence`); the highlighted sentence alone fails when the clue is elsewhere (`target_sentence_only`). Both paths.
- **Why:** before 2026-10-09 the word's own sentence could not be tapped, and every example-mode payload put its only clue there, so the find step could never pass; and any tapped clue passed, so tapping every sentence passed.
- **Probe:** `ContextCluesDetective.workspace.test.tsx` "the find check".

### R3 — the scripted path is unchanged apart from R2 · OBSERVED (2026-10-09)
- **Property:** without a runtime the steps advance on their own after a correct check, a wrong meaning shows the meaning and the dictionary and closes the word, and Finish submits `scriptedScore` (30/30/40 with a type step; find 3/7, define 4/7 without).
- **Probe:** `ContextCluesDetective.workspace.test.tsx` "the scripted path"; `pip/LiteracyWorkspaces.surface.test.tsx`.

### R4 — every step's levers change the screen, never mark the clue, the type or the meaning · OBSERVED (2026-10-09)
- **Property:** `contextCluesLevers.ts`, all help, on every mode. find: `sentence_list` (one numbered sentence per line, the word's own tagged "has the word"; nothing marks a clue), `cross_out` (greys only sentences an earlier `no_clue` / `target_sentence_only` check tapped; never a clue sentence, `crossOutLeaks`). classify: `type_descriptions` (the five fixed descriptions), `signal_words` (underlines signal words inside the already-green clue sentences; offered only when one is there; never a type name). define: `strategy` (the reading strategy of the type already credited), `try_in_place` (the word's sentence with the learner's own pick in its place; offered only when the sentence holds the word as written). No simplify lever: an easier ask on the same word hands back its answer, and a pinned mode's words all share one type. Every catalog miss is answered by a lever on its step.
- **Evidence:** `contextCluesLevers.test.ts`, `ContextCluesDetective.levers.workspace.test.tsx`; sweep J9/J12/J13 0 findings (`qa/eval-reports/context-clues-detective-levers-2026-10-09.md`).

### R5 — the support tier sets lever starting positions, and no tier draws the clue · OBSERVED (2026-10-09)
- **Property:** `showClueHints` (easy, medium) now starts the find step with `sentence_list` on; it used to outline the clue sentences, which drew the find step's answer (both paths). `showClueTypeDescriptions` (easy) and `strategyHint` (easy) are the starting positions of `type_descriptions` and `strategy`. A starting position reads as pulled and is never recorded as help.
- **Probe:** `ContextCluesDetective.levers.workspace.test.tsx` (tier-shown list, no lever on the attempt).

## Changelog

- 2026-10-09 — created with R1-R3 (W1 plain-shape binding, C21).
- 2026-10-09 — R4, R5: levers on every step of every mode (`/add-support-tiers`); the find-step clue outline removed.
- 2026-10-09 — R1: classify built only when the session mixes clue types (orchestrator ruling); single-type modes' miss lists lose the type misses. Scripted path score over the steps built (`scriptedScore`): 30/30/40 with a type step, find 3/7 and define 4/7 without; a step never asked earns nothing.
