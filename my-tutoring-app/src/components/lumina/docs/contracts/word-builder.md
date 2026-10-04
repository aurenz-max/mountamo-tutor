# Contract: word-builder

- **Derived:** 2026-10-04 (static: lever table, QA reports, tests, git history; no live census) · evidence window: 2026-08-16 → 2026-10-04
- **Component:** `primitives/WordBuilder.tsx` · **Domain:** `wordBuilderScript.ts`, `wordBuilderWorkspace.ts`, `wordBuilderLevers.ts` · **Generator:** `service/word-builder/gemini-word-builder.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (word-builder)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| G3-8 morphology: simple_affix, compound_affix, greek_latin, multi_morpheme | catalog + payloads | `w1-payloads/word-builder.*.json` (all four modes, a 3-part greek_latin, an easy tier) | 2026-10-04 |
| Live tutor + JEV (workspace path, `tutoring: null`) | dry journey, text replay | `qa/tutor-reports/replay/word-builder-2026-10-04.json` | 2026-10-04 |
| Support levers (literacy G2-6 family 1) | `/add-support-tiers` | `qa/support-levers/word-builder-lever-table-2026-10-03.md` | 2026-10-04 |

## Requirements

### R1 — The answer is the whole word, spoken; nothing on screen is tapped · OBSERVED
- **Probe:** `WordBuilder.workspace.test.tsx`; dry journey.

### R2 — The word, its assembly and its definition appear only after credit · OBSERVED
- **Property:** the reveal is gated on `revealHeld`; the clue never contains the word; a clue that names an off-item board root or its one-word meaning is dropped (`clueInvitesOtherPart`, 2026-10-04), and the generator keeps only targets the runner asks.
- **Probe:** `g26ContentGates.test.ts`; `workspaceContract.test.tsx` (the adapter refuses a payload with an unaskable target).

### R3 — No lever marks, links or dims a part of the learner's word · OBSERVED
- **Property:** the parts in order ARE the word. `part_slots` draws types only (`slotFrame`); the model and the practice word share no word and no part with any session item (`modelLeak`, `practiceLeak`); the tutor never walks the item's part meanings (guidance, R3 of the plan).
- **Probe:** `wordBuilderLevers.test.ts` (every saved payload, every item); `WordBuilder.levers.workspace.test.tsx`.

### R4 — `small_board_word` stays in the mode · OBSERVED
- **Property:** same tier pool and shape; a 3-part greek_latin item practises a 2-part Greek/Latin word (the mode allows 2-3); the practice board is its own parts plus one foil per type, and no foil makes a pool word. Ungraded; the full word returns.
- **Probe:** `wordBuilderLevers.test.ts`; mounted practice test.

### R5 — The tier only sets where the levers start · OBSERVED
- **Property:** easy draws `part_slots` (not offered, not recorded); medium, hard and no tier draw nothing. Words, parts and mode are the same at every tier.
- **Probe:** `g26LeverStarts.test.ts`; mounted easy test.

### R6 — The payload grade is a grade · OBSERVED
- **Property:** `gradeLevel` is "Grade N", the lesson grade raised to the level's floor (simple 3, compound 4, greek_latin 5, multi 6), never the grade-context prose.

## Conflicts

None open.

## Changelog

- 2026-10-04: derived (initial, static) with the lever slice. 6 requirements, 0 conflicts.
