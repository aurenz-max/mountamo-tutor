# word-workout on the word library (2026-10-13)

With a support tier on a single mode (no remediation focus), six of seven modes take their items from
`service/wordSpace/wordWorkoutSpaces.ts`. No model call. Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| real_vs_nonsense | needs a space | cat/zat, pig, dog, sun, bed at every tier; shipped "zed" (a real word) as nonsense |
| picture_match | needs a space | cat, sun, pen at every tier |
| word_chains | needs a space | cat-cot-pot-pit at every tier; "pag" inside a chain of real words |
| read_inflected | tiered over its table | cats, mixing, jumped at every tier (code table, model picked) |
| read_compound | tiered over its table | sunset, hotdog, catnap, bedbug at every tier |
| choose_in_context | tiered over its table | cat-cap, hen-pen at every tier |
| sentence_reading | not a fit | connected text: the model band |

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| real_vs_nonsense (G1) | hit/yez, fan/wem, run/pif | log/sog, rub/gub, met/cuv | sad/zad, hit/jit, fun/vun, sob/pob |
| real_vs_nonsense (K, short a) | lap/fap, sat/yat, map/vap | bad/vad, pat/zat, nap/wap | bag/pag, cat/yat, sat/zat |
| picture_match (K) | win vs net, nut; dog vs can, cap | bat vs bag, cat; dig vs pig, red | fin vs fan, win; bug vs bun, hug; dog vs dot, hog |
| word_chains (G1) | van>tan>ten>men, mud>mug>hug>hog | rat>ran>tan>ten | men>met>pet>pat, wig>big>bag>bat |
| read_inflected | hats, cats, dogs, cups | jumping, fixing, mixing | jumped, helped, rested, melted |
| choose_in_context | bag-bat, hen-pen, dog-log | hop-hot, bug-bun | pig-pin, run-rug, sit-sip |

## New build artifact

`service/wordSpace/nonsense.json`: 342 CVC strings that are no word, name or homophone in CMU or hunspell
(`scripts/word-space-lab/build-nonsense.mjs`; NOTICE item 5). The library alone holds only familiar words,
so it could not say that "zed" is real.

## Decisions to review

- **Vowel-only nonsense pairs (cat/cet) are not used**: the component's ear gate requires the pair to differ
  at the first letter. The vowel pair is the hardest real-vs-nonsense kind in the research; opening it means
  changing that gate (the judge would compare vowels by ear).
- **The code tables are small** (13 inflected, 6 compound, 10 context pairs), so their tiers mostly reorder
  a few entries. Growing them needs authored meaning lines per word.

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
