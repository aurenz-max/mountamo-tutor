# spelling-pattern-explorer levers (classic modes): 2026-10-08

Modes: short_vowel, long_vowel, r_controlled, silent_letter, morphological (one dictation word per item; the tutor says
the word, the learner types it, code checks it). `pattern_build` already had levers and is unchanged.

## Failure inventory

| Miss (`spellingMiss`) | What it is | Evidence class |
|---|---|---|
| `pattern_missing` | the pattern part of the word spelled wrong (brane for brain) | observed-synthetic (journey wrong answer swaps the pattern letters) |
| `other_letters` | pattern right, other letters wrong/missing/extra (bain) | inferred |
| `misspelled` | wrong, and the pattern names no letters to look for ("silent letter", "CVC", "drop-e") | observed-synthetic (silent_letter, morphological, short_vowel payloads land here) |

No real-learner evidence, no demonstrations, no remediation module, no contract doc for this primitive.

## Lever table

| Mode | Miss | Lever | Kind | Carrier | Leak rule |
|---|---|---|---|---|---|
| all 5 | pattern_missing, misspelled | `pattern_words`: the lesson's pattern words return above the input, pattern letters marked | help | shown | no dictation word of the lesson is shown (`patternWordsLeak`; morphological payload has "smiling" in both lists and it is dropped) |
| all 5 | other_letters, misspelled, pattern_missing | `letter_boxes`: one empty box per letter; the learner's typing fills them from the left | help | shown | a box holds only a letter the learner typed (`letterBoxes`) |
| all 5 | all three | `simpler_word`: ungraded dictation of a shorter pattern word with the same pattern (same letters, else same 2-letter edge: kn-, wr-, -mb), id `<item>~simpler` | simplify | both | never a dictation word (`practiceLeaks`) |

`does` texts fence the tutor: never spell the learner's word, say which pattern word it sounds like, or say which letter goes in a box.

Starting position: `supportTier: 'easy'` starts with `pattern_words` shown (not recorded as a pull).

## Per-item coverage (saved payloads)

Every word in all five payloads has a lever for every miss (both help levers are on every word). `simpler_word` is offered only where the lesson has a shorter pattern word:
- short_vowel (hat, pan, dig, mop): none. All pattern words are 3 letters, so CVC is already the plainest shape.
- long_vowel: brain, chain have one; sail, jail have none.
- r_controlled: sharp, north have one; park, horn, fork have none.
- silent_letter: all 5 have one (knock→knee/knot, wrist→wrap, thumb→comb, wrench→wrap, climb→comb).
- morphological: smiling has one; moving, hiding, waving, naming have none (all pattern words are 6 letters).

Nothing goes in `unanswered`: no classic miss is left without a lever on any item.

## Built

- `literacy/spellingPatternLevers.ts` (new, pure): declarations, leak rules, `practiceItem`, `practiceParent`, facts.
- `SpellingPatternExplorer.tsx`: lever state and practice word in the component; levers published only in the apply phase; `pullLever`/`endPractice`; pattern-word panel and letter boxes; a practice check is not merged as a result.
- `liveJourneySpec.ts` (spelling row only): rebuilds a `~simpler` item from its parent.
- Payloads generated (one generation each, no Live): `w1-payloads/spelling-pattern-explorer.{short_vowel,silent_letter,morphological}.json`.
- Catalog already had `levers: true` and the misses; no catalog edit.

## Tests

- `SpellingPatternExplorer.levers.workspace.test.tsx`: 25/25 (leak rules and builder over all 5 payloads, nextLever table, mounted pull/refusal/record, practice ungraded → full word back blank and credited, easy start not a pull).
- Existing: SpellingPatternExplorer workspace + support-tiers (component and generator) + LiteracyWorkspaces surface: 77/77; lessonWorkspacePlan 14/14; workspaceContract `-t spelling` 25/25.
- `npm run typecheck:lumina`: 0.
- Not run (batch step): journey sweep J1-J12, tutor replay.
