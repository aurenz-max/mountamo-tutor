# cvc-speller on the word library (2026-10-13)

With `config.difficulty` set (no remediation focus), fill-vowel, spell-word and word-sort take their words from
`service/wordSpace/cvcSpellerSpaces.ts`: CVC words spelled with the cumulative letter group's letters, on the
named vowel or word family, no repeated rime. No model call. Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| fill_vowel | needs a space | cat bed pig mop bug (or one swap) at every tier |
| spell_word | needs a space | cat bed/hen pig dog bus at every tier; only the letter bank changed |
| word_sort | needs a space | cat cup map rug bag bus; the tier named a contrast vowel only in the prompt |
| make_word | measured, left alone | code-built letter build, shared word judge |

## After (K, group 3)

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| fill_vowel | rat, hug, log, not, sad | ran, bug, hip, dot, pop | pup, hen, him, dig, set |
| spell_word | hot, map, rug, sat, hog | can, dot, rug, fin, sad | cut, cat, bed, dig, cop |
| word_sort | a/i: sip, rap, mad, lid, fat | e/u: bed, let, cub, leg, pup | e/i: him, did, ten, pet, bed |
| spell_word, Short 'o' | fog, lot, hop, nod | top, log, lot, nod | hot, cop, nod, dog |

## Findings fixed on the way

- "Encode CVC words with Short 'o'" was read as no vowel focus on both paths: the quote defeated the regex.
- A one-vowel scope at K has 4 rimes for o (-ot -op -og -od). With the no-repeated-rime rule, a session drops
  to 4 words there.

## Decisions to review

- **fill_vowel inside one vowel barely tiers** (short u: β 0.5 → 0.68). The answer is spoken and open, so
  there are no wrong options to make nearer; only the word's frame changes. A mixed-vowel lesson tiers well.
- word_sort's tier now picks the vowel pair in code (it used to be a prompt line).

## Owed

- Browser check in the tester per tier. No Live run (payload shape and script unchanged).
