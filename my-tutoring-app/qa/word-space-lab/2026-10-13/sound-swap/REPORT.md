# sound-swap on the word library (2026-10-13)

With `config.difficulty` set (no remediation focus), addition, deletion and substitution take every pair from
`service/wordSpace/soundSwapSpaces.ts`, computed from two familiar words' phonemes. No model call. Raw output
`before.txt`, `after.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| addition | needs a space | at/an/it + a first sound at every tier, both runs |
| deletion | needs a space | medium returned no challenges (both runs); hard shipped stop → sop |
| substitution | needs a space | the tier moved the position, but cat, pig, sun, hop repeated |
| swap_build | measured, left alone | code-built letter build, shared word judge |

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| addition (K) | at → sat, egg → leg, an → man, ice → rice | in → bin, up → cup, me → mean, too → tooth | see → seat, cow → couch, she → sheep, why → wife |
| deletion (K) | hear → ear, nice → ice, van → an | howl → owl, shine → shy, zoom → zoo | mine → my, sheep → she, peach → pea |
| substitution (K) | cat → sat, rug → mug, win → chin | pear → bear, nap → map, lid → kid | line → lime, cup → cop, pet → pat, try → dry |
| addition (G1) | ink → think, zoo → zoom, up → pup | pot → spot, light → flight, tea → teach | fill → film, room → broom, low → glow |
| deletion (G1) | man → an, nose → no, told → old | stop → top, flip → lip, page → age | ranch → ran, film → fill, spit → pit, gasp → gas |
| substitution (G1) | fat → fan, cone → bone, king → ring | tuck → duck, heel → seal, van → fan | pine → pain, desk → disc, joke → choke |

## Found on the way

- CMU gives function words their unstressed vowel (to = /tə/, and = /ənd/), which built to → tub and
  end → and. Those four words are left out of sound-swap.

## Decisions to review

- **K hard additions are end sounds on open syllables** (see → seat, she → sheep). K excludes clusters.
- **Substitution reaches the middle vowel at K** on hard (cup → cop, pet → pat), as the model path did.

## Owed

- Browser check per tier. No Live run (payload shape and script unchanged).
