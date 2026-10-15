# syllable-clapper on the word library (2026-10-13)

With a support tier (no remediation focus), count_parts, blend_syllables and delete_compound take every word
from `service/wordSpace/syllableSpaces.ts`. Code picks the word and its beat count (one vowel sound per beat,
from the phonemes) and splits compounds of one-beat words (cow-boy). The library has no hyphenation, so other
words' splits come from **one small model call per session** (`splitWithModel`), kept only when the split has
exactly the word's beat count, spells the word, has a vowel in every part, does not open a part on a doubled
consonant (um-bre-lla) and makes no beat of a silent e. Three spare words per task absorb a rejected split.
Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| count_parts | needs a space | tiers lengthened words, but the words never varied (cat dog apple; caterpillar watermelon alligator) |
| blend_syllables | needs a space | same words every run; splits like um-bre-lla, cat-er-pil-lar |
| delete_compound | needs a space | cupcake, bedroom, raincoat at every tier |
| build_parts | measured, left alone | code-built syllable build |

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| count_parts (K) | log 1, flash-light 2, star 1, pop-corn 2 | but-ter 2, u-ni-corn 3, goose 1, ham-bur-ger 3 | um-brel-la 3, ba-nan-a 3, el-e-phant 3, pen-cil 2 |
| count_parts (G1) | mail-box 2, bell 1, trac-tor 2, cap 1 | el-e-phant 3, note-book 2, cal-en-dar 3 | ra-di-o 3, wa-ter-me-lon 4, al-li-ga-tor 4, tel-e-vi-sion 4 |
| blend_syllables (K) | pop-corn, foot-ball, sun-set, chick-en | lady, mon-key, diz-zy, ze-bra | hos-pi-tal, straw-ber-ry, but-ter-fly, bi-cy-cle |
| delete_compound (K) | mailman − mail, toothbrush − tooth, outside − out | bathtub − tub, peanut − pea, blueberry − blue | cowboy − boy, waterfall − fall, classroom − room |

Count_parts draws from a beat ladder by tier (easy 1-2, medium 1-3 at K / 2-3 at G1, hard 2-3 at K / 3-4),
split evenly across counts, so the answer changes from word to word. Splits kept from the model: 95 of 96 in
the after-probe.

## Changes outside the space

- `COMPOUND_PART_WORDS` (the deletion gate's part list) gained 25 everyday words the library's compounds
  use (bath, tub, yard, hall, water, fall, week, end, side…). It only widens what both paths accept.
- `isInflected` now catches doubled and e-dropped forms (letting, gaming, jogging).
- Words whose beat count depends on the speaker beyond the hand deny-list: a long vowel before /er/
  (tired, flower, fire) is left out.

## Decisions to review

- **A model call remains on this path** (splits only), as you allowed. The count, the word and the compound
  splits are code-owned; a hyphenation source would remove the call.
- **count_parts and blend use pictured words only** (concrete words); delete_compound does not need pictures.
- **No contract exists** for syllable-clapper; `/primitive-contract syllable-clapper` is owed.

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
