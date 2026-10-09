# knowledge-check levers: recall count gap (J12), 2026-10-09

Scope: `/add-support-tiers` on knowledge-check `recall`, queue row J12 `knowledge-check.recall` p0-mct (`one_less`, levers here: none).

## Failure inventory

| Mode | Failure | Class | Evidence |
|---|---|---|---|
| recall (any mode, choice kinds) | touches a number one less / one more / another number when counting a printed run of pictures ("What is the number of stars: ⭐⭐⭐⭐⭐?", choices 4/5/6) | observed-synthetic | journey sweep J12 on `w1-payloads/knowledge-check.recall.json` p0-mct; `knowledgeCheckMiss` names `one_less` |

Why p0-mct had no lever: `cue_picture` is withheld when the key is a number, and `drop_far_choice` must leave two untried choices (R11, user ruling 09-27), so a 3-choice menu loses it after the first wrong answer. No real-learner evidence exists for this item.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Existed? | Cost |
|---|---|---|---|---|---|---|---|
| all (choice / choice_tap) | `one_less`, `one_more`, `other_number` on a count of a printed run | `spread_pictures`: the question's own pictures drawn again apart, one per box; touching a box marks it counted | help | shown | Only on a number key; only runs of one repeated picture, at most 20, keycaps excluded; boxes carry no numbers; the fact names the picture and layout, never how many; marks are never published | no | ~35 lines module, ~25 lines render |

The learner still does the count; the lever only makes each picture a separate thing to touch (tracking). It is not offered on a question with no repeated picture.

## Built

- `primitives/knowledgeCheckLevers.ts`: `SPREAD_LEVER`, `pictureRuns`, `spreadLeak`, the lever declaration (answers the three count misses), its `levers_on_screen` fact.
- `primitives/KnowledgeCheck.tsx`: renders the spread row under the question when pulled (`data-lever="spread-pictures"`, `data-spread-box`), per-item mark state kept out of the scene.
- Catalog comment (`assessment.ts`), contract R10 + changelog, queue row closed, J12 baseline entry for `knowledge-check.recall` removed.

## Tests

- `knowledgeCheckLevers.test.ts`: `nextLever` rows for the 3-choice count after a wrong answer; `pictureRuns` table; `spreadLeak` table (5 cases); fact has no digit or number word; offered on the saved payload's p0-mct after a wrong touch; saved-payload no-key check now pulls all three levers.
- `KnowledgeCheck.levers.workspace.test.tsx` (new case, saved p0-mct): wrong touch records `one_less`; refused `drop_far_choice` leaves screen, levers and attempts unchanged; the spread pull shows 5 boxes and the fact in one commit with no digits; a box marks without changing the fact; retry keeps the boxes; the correct touch is credited `assisted` with `levers: ['spread_pictures']`.
- Run: the two files above plus `KnowledgeCheck.workspace.test.tsx`, `KnowledgeCheck.on-screen.test.tsx`, `knowledgeCheckWorkspace.test.ts`: 5 files, 87/87 pass. `npm run typecheck:lumina`: 0.
- Not run (batch step): journey sweep, tutor replay. No Live run.

## Still without a lever

- A 3-choice number menu with no printed picture run (e.g. "What is 2 + 3?" with 4/5/6) has no lever after the first wrong answer: no cue (number key), no drop (R11), nothing to spread. No saved payload has this shape today; recorded here, not added to `unanswered` (that list is per mode and would hide the lever on items that have it).
- No simplify lever was added: a simpler count would be a different item, and the existing simplify (drop) is fenced by R11.
