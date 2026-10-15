# rhyme-studio on the word library (2026-10-13)

With a support tier (no remediation focus), recognition, identification, production and collection take every
item from `service/wordSpace/rhymeSpaces.ts`. Rhyme is computed from the phonemes and must agree with the
spelled ending the component highlights. No model call. Raw output `before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| recognition | needs a space | cat/hat, pig/dog, sun at every tier |
| identification | needs a space | the same targets at every tier; wrong cards pictured ⭐ |
| production | needs a space | cat, sun, bed, pig at every tier |
| collection | needs a space | cat, sun at every tier |
| pair_build | measured, left alone | code-built boards |

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| recognition (K) | fox/box yes, bell/shell yes, cap/leg no, red/boat no | win/fin yes, lock/fog no (vowel), dog/mug no (last sound) | brick/chick yes, dig/dog no (first sound), ship/soap no, dot/day no |
| identification (K, 2 pictures) | dig → pig vs wash; cup → pup vs dot | win → fin vs clean; jog → frog vs big | cat → hat vs kiss; boat → coat vs bird |
| identification (G1, 3) | fish → dish vs mug, nest | truck → duck vs train, hug | hook → book vs hand, truck; nut → hut vs night, brush |
| production (K) | bee, win, cat, lake, ship | fan, bell, pot, snake, pop | hen, sock, red, mug, phone |
| collection (K) | bee, fin | cat, map | net, snail |

## Decisions to review

- **Production still judges by rule.** The library can list every familiar rhyme of a target (the handoff's
  "better judge key"), but R3 and a recorded ruling keep any list out of the judge, and changing what the
  judge hears needs a Live run. Not wired; yours to rule on.
- **A rhyme must also share its spelled ending** on this path (bear/pear yes, bear/hair no), so the R5 gate
  and the on-screen rime highlight stay true.
- **Picture fit is the reviewed rating:** big 🐘, kick 🦵, old 👴 passed review. Worth a look on the review page.

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
