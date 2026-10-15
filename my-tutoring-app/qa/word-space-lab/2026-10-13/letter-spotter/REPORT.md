# letter-spotter on the word library (2026-10-13)

With a support tier on name_it (no remediation focus), code picks each item's letter and key word
(`keyWordSpace` in `service/wordSpace/letterSpaces.ts`); the model writes only the sentence around the word.
Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| name_it | needs a key-word space | s/sun, a/ant, t/top at every tier |
| find_it | measured, left alone | code rebuilds the one-target grid; the tier sets look-alike distractors and the reference letter |
| match_it | measured, left alone | code-built options; the tier sets count and look-alikes |

## After (name_it, K)

| Group | Easy | Medium | Hard |
|---|---|---|---|
| 1 | t towel, p pudding, n neck, s salt | t train, s sunrise, n night, p plus | s scoop, a apple, n newborn, p present |
| 3 | b bacon, f fog, l line, g goat | b bedroom, l lid, f farm, g game | g grill, f folder, l lava, c coach |

Key words: familiar nouns starting with the letter and its basic sound. Letters: the letter-name effect
(b d t p first; vowels, g, c last), two thirds from the group's new letters.

## Found on the way

- Vowel letters first drew function words (am, in, an) and verbs, and the fallback frame then printed
  "I can see the ask". Key words are nouns now.

## Decisions to review

- A model call stays on this path for the sentence, as you allowed.
- The private group tables in letter-spotter and letter-sound-link now read `letterGroups.ts` (WS-0).

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
