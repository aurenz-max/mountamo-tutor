# word-flip on the word library (2026-10-13)

With a support tier on a single rule (no remediation focus), the 5 bases come from
`service/wordSpace/wordFlipSpaces.ts`; the answer is the generator's own rule. No model call. Raw output
`before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| plural_s, plural_es, plural_y | needs a space | the model's handful varied by run, never by tier |
| irregulars, past_ed, past_irregular | tiered over their seed tables | closed tables; the tier changed nothing |
| build_inflect | measured, left alone | code-built board |

## After (G1)

| Rule | Easy | Medium | Hard |
|---|---|---|---|
| plural_s | tag, tongue, fan, car, whale | star, ant, laptop, monkey, gift | camera, dove, ambulance, parrot, sponge |
| plural_es | dish, watch, peach, bench, church | sandwich, wrench, bus, dress, toothbrush | cockroach, box, compass, octopus, mailbox |
| plural_y | cherry, fly, candy, puppy, bunny | city, lady, candy | trophy, butterfly, factory, ferry, battery |
| irregulars | foot, woman, goose, tooth, man | child, mouse, woman | ox, person, mouse, child |
| past_ed | wash, look, help, walk, cook | kick, jump | play, paint, open, clean |
| past_irregular | give, run, come, sit, get | sleep, eat, take, see | do, go, say, have |

## Found on the way

- Library nouns are not all pluralizable: moose → "mooses", goggles → "goggleses", tennis, plus. Bases are
  object categories only, not plural in form, not zero plurals.

## Owed

- Browser check per tier. No Live run (payload shape unchanged).
