# picture-vocabulary on the word library (2026-10-13)

With a support tier (no remediation focus), receptive_match and naming take 5 pictured nouns from
`service/wordSpace/categorySpaces.ts`; one small model call writes the help-lever clues (kept only when the
existing `clueLeak` gate passes). Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| receptive_match | needs a space | apple, cat, sun, tree at every tier; wrong pictures always from other categories |
| naming | needs a space | pencil, ball, tree, shoe, apple at every tier; lamp pictured as 💡 |
| association | not a fit yet (WS-R) | needs a curated goes-with table; no public source |
| opposite | not a fit yet (WS-R) | needs a curated opposites table |
| gradable_scale | not a fit yet (WS-R) | needs curated scales |
| sentence_frame | not a fit | prose: the model band |
| pair_build | measured, left alone | code-built boards |

## After (K)

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| receptive_match | bacon among cloud, chick, castle; football among bucket, glove, penguin | bear among frog, hole, clock; sock among glove, hand, peach | goggles among scarf, ribbon, tie; taco among broccoli, honey, onion; shower among basket, bench, pan |
| naming | dress, taxi, jam, worm, ear | ribbon, juice, kite, drum, pot | potato, bubbles, microphone, bucket |

## Decisions to review

- **WS-R is still owed** for association, opposite and gradable_scale: a reviewed relation table (seed:
  `PAIR_PICTURES`, the validated pools). Those modes stay on the model path.
- **Pictures to review** on the review page: pickle 🫝, jam 🍓, lime 🍋‍🟩 (new emoji, may not render).
- Action pictures (🏃 🤸 🏊) are left out of the noun pool: a child names the action, not the word.

## Owed

- Browser check per tier. No Live run (payload shape unchanged; clues still pass the same gate).
