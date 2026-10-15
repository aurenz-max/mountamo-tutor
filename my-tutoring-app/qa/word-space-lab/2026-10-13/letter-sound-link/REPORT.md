# letter-sound-link on a letter space (2026-10-13)

With a support tier (no remediation focus), all three modes take their letters from
`service/wordSpace/letterSpaces.ts`. No model call. Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| see_hear | needs a space | the group's letters in the same order at every tier |
| hear_see | needs a space | same targets, same wrong letters (d/t, m/n, e/i) at every tier |
| keyword_match | needs a space (letters only) | same targets; keywords stay the fixed per-letter anchors |

## After (K)

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| see_hear, group 1 | p, t, s, n | n, t, a, s | n, a, i, s |
| see_hear, group 3 | b, l, f, p, o | f, g, l, o, s | l, g, o, u, a |
| hear_see, group 2 | m vs t, d vs k, k vs r, p vs n | d vs t, r vs c, m vs h | m vs n, e vs a, c vs i, h vs t |
| keyword_match, group 3 | b: bat vs run, f: fish vs egg | b: bat vs pig, g: goat vs kite | u: up vs octopus, l: leaf vs run |

Difficulty: the letter-name effect (b d t p, whose names start with their sound, are learned first; vowels
and h w y c g, whose names do not help, last) plus how near the wrong letter is. Two thirds of each draw use
the group's new letters (groups 2-4).

## Decisions to review

- **Keywords stay the fixed anchors** (s → sun). The handoff suggested library keyword pictures; the
  component re-derives the anchor per letter by design, so a varying keyword is a different task.
- Group 1 tiers with 4 letters per session (it has six letters).
- The private letter-group table in `gemini-letter-sound-link.ts` now reads `letterGroups.ts` (WS-0).

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
