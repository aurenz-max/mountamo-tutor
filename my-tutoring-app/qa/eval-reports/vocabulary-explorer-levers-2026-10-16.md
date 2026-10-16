# vocabulary-explorer levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/vocabulary-explorer-w1-2026-10-16.md`). Code: `vocabularyExplorerLevers.ts`.
Every lever starts released; `config.difficulty` changes the items (pairs, the extra meaning, how many choices and how
close they are), not the levers.

## Failure inventory
There is no real-learner evidence (no demonstrations, misconception, remediation or eval files for this id). The old
catalog `commonStruggles` documented four: definitions skipped, similar terms confused, fill-in-the-blank, example
sentences not read. The rest are inferred from the tasks. The misses below are what the code check observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| match | confuses two similar words (documented) | `swapped_pair` |
| match | does not know most meanings (documented: definitions skipped) | `several_wrong` |
| match, hard | does not rule out the meaning that fits no word (inferred) | `extra_meaning` |
| fill_blank, context | picks a related word whose meaning differs (documented: similar terms) | `related_word` |
| fill_blank | picks a word that does not fit the sentence's grammar (documented: fill-in-the-blank) | `wrong_kind_of_word` |
| fill_blank, context | does not know the meaning, or misreads the clue (documented) | `other_word` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| match | `show_examples` | help | under each word, its example sentence from its card | withheld per word when the example repeats 4 words in a row of its meaning (`exampleLeaks`) |
| match | `fewer_pairs` | simplify | a smaller match (one pair fewer, at least two) of words NOT in the item, no extra meaning, ungraded, then the full item back | shares no word or meaning with the item (`simplerMatch`); null when too few other words |
| fill_blank | `tag_word_kinds` | help, choices of two kinds or more | each choice labeled noun, verb, adjective | the blank's kind is never shown; offered only where it changes something |
| fill_blank, context | `show_meanings` | help | under each choice, its meaning | every choice word blanked out of every meaning (`maskWords`) |
| fill_blank, context | `drop_choice` | simplify | greys out one untried wrong choice: another kind of word first, then an unrelated one | at least two untried choices remain |

Every miss an item can show is answered by a help lever first (tested over 12 built sessions per mode). Practice
matches have no levers and never shrink twice. A hard match built from 5 of 6 words has no `fewer_pairs` (one other
word left); its misses still have `show_examples`.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit (`[data-lever]`,
  `example<n>` / `meaning<n>` / `onScreen` facts) and the next attempt records it (`assisted`, `levers`); `drop_choice`
  greys out the right choice and disables it; `fewer_pairs` opens `match-2~simpler` and the full item comes back.
- Sweep J9, J12, J13: 0 findings on the three payloads.
- Replay: the lever and stuck replies name what each lever shows. r1 found the tutor saying what kind of word the blank
  needs once the choices were labeled (6/10 on the one verb item) and putting the clue into the right meaning's words;
  both fixed in guidance and lever text (r3 clean by reading).

## Failures without a lever
- The extra meaning (hard match) has no lever of its own: `show_examples` helps place the real pairs, which leaves the
  extra one. No code-safe way to mark it exists that does not answer the item.
- A sentence or situation that two choices fit is a content defect, not a learner failure; the generator's fit judge
  is the guard (unmeasured, see the W1 report).
