# H2: open-speech modes on `oral-sentence-studio` and `story-ribbon`

Read `README.md` in this folder first.

## Goal

Thirteen subskills ask the child to say something of their own: a question, a reason, a retelling, a story. Two
primitives already judge open speech against named misses. Add the modes below to them.

### `oral-sentence-studio`

| New mode | The child | Credit when | Named misses | Subskills (`n`) |
|---|---|---|---|---|
| ask a question | sees a scene with something hidden or unknown (a wrapped box, a closed door) and asks a question about it | it is a question and it is about the scene | a statement; a question about something else; one word | 55, 58, 62 |
| say why | hears a short choice or claim ("Fox says cats are better than dogs") and says whether they agree and why | a position and a reason that fits it | position only; reason only; "because I do" | 57, 176, 178, 161 |
| two voices | sees two characters in a scene and says one line for each | two lines that fit the scene, one per character | one line; narration instead of speech | 191 |

Subskill 190 (copy a character's voice) is not observable. Leave it at level 0 and say so.

### `story-ribbon`

| New mode | The child | Credit when | Named misses | Subskills (`n`) |
|---|---|---|---|---|
| listen then retell | hears a three- or four-event story read by the tutor with its pictures, then retells it | the events are covered in order, with first, next or last on at least two | events out of order; one event only; a list with no order words | 186 |
| tell your own | picks two or three picture cards (any pick is allowed) and tells a story or something that happened to them | a beginning, something that happens and an end, connected | a description of the cards; one event | 61, 187, 189 |

## Read first

- `src/components/lumina/docs/contracts/oral-sentence-studio.md` and `story-ribbon.md`
- `src/components/lumina/service/literacy/gemini-oral-sentence-studio.ts` (lines 57-62, 105-110: modes and misses)
- `src/components/lumina/primitives/visual-primitives/literacy/oralSentenceStudio.card.ts`
- `src/components/lumina/service/literacy/gemini-story-ribbon.ts` (lines 135, 687) and
  `primitives/visual-primitives/literacy/storyRibbonDomain.ts` (lines 145-200), `storyRibbon.card.ts`
- `.claude/skills/add-eval-modes/SKILL.md`; then `/review-live-wiring <id>` on each primitive when you finish

## Constraints

- Both primitives sit on the spoken boss with a card. Add the new modes on the same card and boss; do not add a
  second judging path.
- The judge's credit rule and misses are data on the mode, written as above. Do not add coaching rules per mode.
- Scenes use library pictures. `oral-sentence-studio` prints its two target words today; the new modes have no
  target words, so nothing is printed.
- "Say why" needs a claim a five-year-old can hold an opinion on. Give the generator a pool (ask for 5-8, ship 5)
  and reject claims that have a factually right answer.
- An open spoken answer has no code key. State in the catalog entry what the tutor judges, and keep these modes out
  of anything that needs a code-checked answer.

## Check before you call it done

- One generation per new mode at the text of subskills 55, 57, 186 and 187; read the scene and ask yourself what a
  child would say.
- The existing modes' payloads are unchanged (`test:primitive` for both ids).
- The user owes one Live sample per new response shape (a question, a reason, a retell). Give the exact command
  and the question each answers: does the tutor credit a real question and refuse a statement, and so on.
