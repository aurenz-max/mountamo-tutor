# decodable-reader levers: read_along (2026-10-08)

Class sweep, batch with states-of-matter, read-aloud-studio, spelling-pattern-explorer, story-bridge. The decode modes
already had levers (handoff 22 L3). This slice covers `read_along` (K shared reading: the tutor reads the story, the
learner says one word from it).

## Failure inventory (read_along)

| Miss | What is observed | Evidence class |
|---|---|---|
| `lifted_word` | says a different story word that does not answer the question (`cat` asked, `rat` said) | observed-synthetic (`decodableSpokenMisses`, journey plainWrong); documented (`storyContentWords` docblock) |
| `retell` | says a whole story sentence or more without the answer | observed-synthetic (`decodableSpokenMisses`) |
| cannot hold a 3+ sentence story and find the answer in it | the cause behind both misses above | inferred |

Empty classes: no real-learner sittings, no misconception or remediation module for this primitive, and no
`docs/contracts/decodable-reader.md`.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Existed? |
|---|---|---|---|---|---|---|
| read_along | lifted_word, retell | `story_region`: the answer's sentence and its neighbour, set apart; the tutor reads those two aloud once | help (only after a wrong answer) | both | exactly two whole story sentences, nothing marked; `does` forbids stressing, repeating or pointing at a word and naming which word answers | decode modes only; read_along was excluded |
| read_along | lifted_word, retell | `short_story`: an ungraded two-sentence practice story from a code pool, with its own one-word question | simplify | both | shares no content word with the session story, its questions or answers (`shortStoryLeak`); the `does` text forbids linking it to the lesson question | no |

Mode floor: the practice item is still read-along (tutor reads, learner says one word stated in the story). A choice
menu on the same question was rejected: it repeats the item (R3) and turns production into identification.

Per item: on the saved read_along payload (3 sentences, 3 spoken questions) every spoken question carries both levers
and both answer its emitted misses (unit test). Gaps: on a 1-sentence story neither lever exists; a 2-sentence story has no
`short_story`. A question whose answer word is not in the story has no region. Those items' misses have no lever. J12
does not check spoken items, so this is recorded here, not in the catalog.

## Built

- `decodableReaderLevers.ts`: `storyRegion` now applies to read-along. The read-along region lever has carrier `both`
  and answers both misses. Added `PRACTICE_STORIES` (8), `shortStory`, `shortStoryLeak`, and `simplerFor` (shared by
  the component and the journey row).
- `DecodableReader.tsx`: the simplify pull goes through `simplerFor`, levers get the session items, and the practice
  scene fact is set by kind.
- Catalog `decodable-reader.teachingWorkspace.unanswered.read_along` is now `[]`. `levers: true` was already set.
- `liveJourneySpec.ts` decodable row: rebuilds a `~simpler` item from its parent with `simplerFor`. The existing
  `short_line` practice item was not rebuilt before this either.

## Tests

- `decodableReaderLevers.test.ts`: 12 pass. Covers region leak on both payloads, both levers on every read-along
  spoken question, the `nextLever` table (lifted_word → story_region, then retell → short_story), the region `does`
  fence, practice story shape/evidence/no-leak, no practice story on decode / 2-sentence / fully clashing stories,
  and every pool story reachable.
- `DecodableReader.levers.workspace.test.tsx`: 5 pass. The 2 new read-along tests cover these cases. A refused region
  pull changes nothing (levers, attempts, screen). After a miss, one commit shows the two sentences plus the
  `levers_on_screen` fact, and the next attempt records `story_region`. `short_story` opens `q-1~simpler`: a practice
  story with no lesson word, ungraded (`practice: true`). After it the full question comes back blank and is
  credited with the lever recorded.
- Existing tests also pass: `DecodableReader.workspace.test.tsx`, `DecodableReader.di-script.test.ts`, and
  `lessonWorkspacePlan.test.ts` (96 across the decodable files).
- `npm run typecheck:lumina`: 0.
- Not run (batch step): journey sweep and tutor replay.

## Left without levers

- Decode modes: as before (`other_choice`, `retell`, and the catalog's `unanswered` lists for them were not changed).
- Read-along `answer_choice` fallback items emit no miss, so they have no lever.
