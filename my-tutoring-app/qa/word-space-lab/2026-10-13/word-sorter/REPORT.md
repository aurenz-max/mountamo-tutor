# word-sorter on the word library (2026-10-13)

With a support tier (no remediation focus), concept-category sorts take their categories and words from
`service/wordSpace/categorySpaces.ts`; each sort passes the model path's own gates (`reconstructSortChallenge`).
Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| binary_sort (concept) | needs a space | Animals/Food with cat, dog, pig at every tier |
| ternary_sort (concept) | needs a space | Cats/Dogs/Birds with eagle 🥚 and "feline" |
| binary/ternary (grammar) | not a fit | noun/verb, singular/plural: no library field for part of speech |
| match_pairs | not a fit yet (WS-R) | needs a curated relation table |

## After (K)

| Sort | Easy | Medium | Hard |
|---|---|---|---|
| "animals and food" (named) | egg, snail, tiger, penguin / lime, onion | melon, pie, chick, deer | cow, sandwich, cat, taco |
| open binary | Body Parts / Home; Animals / Vehicles | Food / Places; Animals / Tools | Tools / Toys; Places / School |
| open ternary | Animals / Body Parts / Food | Body Parts / Places / Weather | Body Parts / Clothes / Places; Animals / Nature / Toys |

## Decisions to review

- **A named pair (animals / food) does not tier** beyond familiarity: the categories are fixed by the
  objective, so tiers vary the words only. A typicality rating per word would give it a difficulty.
- **Phonics sorts are not built**: their labels ("Short A", "Short E") share a word, which the label gate
  rejects. A label convention (keyword pictures as labels) would open them.
- **Category ratings to review** on the review page: cold 🥶 (weather, an adjective), pop 🍿 (food),
  wing 🪽 (animal), ice 🧊 (food), star ⭐ (nature), plus ➕ and letter ✉️ (school).

## Owed

- Browser check per tier. No Live run (payload shape unchanged).
