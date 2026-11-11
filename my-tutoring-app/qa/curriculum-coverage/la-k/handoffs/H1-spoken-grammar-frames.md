# H1: spoken grammar frames on `di-spoken-practice`

Read `README.md` in this folder first.

## Goal

A kindergartner sees a picture, hears a sentence with one word missing, and says the missing word. Today
`di-spoken-practice` can do this for is/are only, with six fixed pairs and no picture. Extend it to the frames
below so 20 grammar subskills have a home.

| Frame | Example (picture → heard sentence → answer) | Subskills (`n` in `audit.json`) | Named miss |
|---|---|---|---|
| a / an | apple → "I see ___ apple." → an | 85, 86, 89, 67 | said "a" before a vowel sound |
| a / the | one cat, then the same cat again → "___ cat is sleeping." → the | 85, 91 | said "a" for the one already named |
| he / she / they | a girl running → "___ is running." → she | 93, 95, 96 | wrong person; said the noun again |
| his / her / their | a boy with a hat → "That is ___ hat." → his | 97 | said he/she |
| subject vs object | "Give the ball to ___." (picture: a girl) → her | 98 | said she |
| present agreement | one dog / two dogs → "The dogs ___." → run | 110, 111 | added or dropped the -s |
| is/are + -ing | already built; add the picture and widen the pool | 115 | |
| will | "Tomorrow the dog ___ run." → will | 114 | said the past form |
| today / yesterday | "Yesterday I ___." (picture: jumping) → jumped; run → ran | 112, 113, 116 | said the present form |

Three sorts on `word-sorter` have model-written keys because the word library lacks the facts: common vs proper
(66), action vs linking verb (109), location vs direction word (107). When the library gains those facts, wire
`word-sorter` to use them for these three sorts.

## Read first

- `src/components/lumina/docs/contracts/di-spoken-practice.md`
- `src/components/lumina/service/direct-instruction/spokenPracticePlan.ts` (lines 200-209 and 376-424: the is/are
  plan and `compare_choice`, which is the closed-menu shape to copy)
- `src/components/lumina/primitives/visual-primitives/direct-instruction/diSpokenPracticeModes.ts`
- `src/components/lumina/service/wordSpace/lexicon.ts`, `categorySpaces.ts`, `wordFlipSpaces.ts` (how a space
  lists items, rates difficulty and builds wrong options)
- `.claude/skills/add-eval-modes/SKILL.md`, `.claude/skills/add-word-space/SKILL.md`
- `../../work-items.json`, item `k-grammar-completion` (the September prescription for the same work)

## How to build it

1. Add the grammatical facts to the word library, in code: starts with a vowel sound, person kind for pronouns
   (girl, boy, group), plural form, past form (regular and the irregular seed list `word-flip` already has),
   proper noun, linking verb. Reuse what `wordFlipSpaces.ts` already knows; do not make a second irregular list.
2. Add one space per frame family that lists every (picture, sentence, answer, wrong options) the frame allows, and
   computes difficulty from structure: two choices before three, a regular form before an irregular one, the
   contrast shown in the picture before one carried only by the sentence.
3. Add the frames to the spoken-practice plan as code-built items. The tutor says the sentence and, at the easy
   tier, the two choices. The child says one word.
4. Add an eval mode per task identity, not per word: article choice, pronoun choice, verb form, tense. Register
   the beta priors as `/add-eval-modes` describes.
5. Every item has a picture from the library. An item with no rated picture is not generated.

## Out of scope

- Building sentences from cards, adding describing words, and/but, end marks: the main session builds those as a
  sentence track in `wonder-walk`.
- `you-and-me` (I/you). Leave it as it is.
- Any change to how the tutor judges speech.

## Check before you call it done

- A/an is keyed on the first sound, not the first letter ("an hour" must not be generated wrong; simplest is to
  leave such words out of the pool).
- The picture does not make the answer a guess between look-alikes: a pronoun picture shows one clear person or
  group.
- The answer word is never printed on screen before the child answers.
- One generation per new mode, at the text of subskills 86, 95, 111 and 112.
- The user owes one Live sample on the shared spoken path only if you changed it. If you only added plan items,
  say that no Live sample is needed.
