# H4: mode additions, one primitive per session

Read `README.md` in this folder first. Use `/add-eval-modes`, then `/eval-test` on the new mode. Take ONE row per
session, top first. Each row is a task the primitive's world can already hold but no mode asks for.

| # | Primitive | New task | Credit when | Subskills (`n`) | Start reading at |
|---|---|---|---|---|---|
| 1 | `phoneme-explorer` | **Sounds in order.** Hears a CVC word, pushes one counter per sound, then says each sound as its counter lights (or, if isolated sounds cannot be judged, taps the picture-free tile for each sound from a small tray, in order) | one token per phoneme, in order | 12, 49 | `primitives/visual-primitives/literacy/phonemeExplorerDomain.ts:343-355` (`segment` scores only the count; the counters are an unscored lever) |
| 2 | `phoneme-explorer` | **Onset and rime.** Blend: hears "/k/ … at", says the word. Segment: hears "cat", places the first-sound token and the rest-of-word token | spoken word matches; two tokens in order | 6, 7 | `service/wordSpace/phonemeSpaces.ts:200-218` (K blend is three single phonemes only) |
| 3 | `picture-vocabulary` | **New word from the picture.** Hears a sentence with one word the child is unlikely to know, sees the scene, taps which of three pictures the word means | first tap is the meaning | 125, 126, 129 | `service/literacy/gemini-picture-vocabulary.ts` (`sentence_frame` is a cloze on known words) |
| 4 | `picture-vocabulary` | **Riddle.** Hears two or three clues, taps the picture | first tap is the answer; no clue names it | 130 | same file; the September riddle repair is in `../../build-status.md` |
| 5 | `cvc-speller` | **Long or short.** Hears a word (cap / cape), says or taps whether the vowel is long or short | choice matches the word | 48 | `service/wordSpace/scope.ts:132-135` (CVC/CVCe pairs are already admitted); nearest mode is `word_sort` |
| 6 | `interactive-book` | **Label and contents.** Taps the label for a named part of a diagram; on a contents page, taps the entry for a named topic | tapped target is the named one | 183, 185 | `primitives/visual-primitives/literacy/InteractiveBook.tsx:67` (five feature kinds), `service/literacy/gemini-interactive-book.ts:214,235` |
| 7 | `word-flip` | **Match one to many.** Hears a word ("mice"), taps the picture pair it belongs to; or matches a one-picture to its many-picture | pair is one word in two forms | 84, 88 | `service/wordSpace/wordFlipSpaces.ts:38-75` |
| 8 | `spatial-scene` | **Sort by relation.** Sorts small scene cards into two position bins (above / below) | each card in its bin | 102 | `service/math/gemini-spatial-scene.ts` (`identify`), contract `spatial-scene.md` (the preposition window is a per-lesson axis) |

## Notes per row

- **Rows 1 and 2** touch the one thing the primitive's card forbids today: "never a bare sound"
  (`phonemeExplorer.card.ts:41`). Judging an isolated spoken sound is unproven. Build the token-placement answer,
  which code can check, and do not add a spoken isolated-sound answer. Words and phonemes come from
  `phonemeSpaces.ts`.
- **Row 3:** the unfamiliar word must not be a library word the grade already knows, and the three pictures must
  all fit the sentence grammatically so only the scene decides. Ask the model for the sentence only; code picks
  the word and the pictures.
- **Row 4:** code picks the answer picture and the wrong pictures; the model writes clues; code rejects a clue that
  contains the answer word.
- **Row 5:** the pairs come from the word space. Do not let the model choose words.
- **Row 6:** the page is generated; add the two kinds to the same tap-target mechanism. A K child cannot read the
  contents entries, so each entry carries a picture and the tutor names the topic.
- **Row 8:** check the contract before touching the preposition window. Subskill 104 (describe a scene the child
  made) is not in this row.

## Out of scope

Anything in H1, H2 or H3. Any new primitive. Any change to an existing mode's items or scoring.

## Check before you call it done

- The new mode has a beta prior and its place in the primitive's ladder is stated (which existing mode it sits
  between and why).
- Easy, medium and hard differ in structure, not in a number.
- One generation per tier at the subskill's text, payload read.
- `/review-live-wiring <id>` is clean for the primitive.
