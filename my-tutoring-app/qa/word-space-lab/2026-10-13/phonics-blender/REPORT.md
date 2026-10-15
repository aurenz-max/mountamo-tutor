# phonics-blender on the word library (2026-10-13)

With `config.difficulty` set (no remediation focus), `cvc`, `cvce_blend`, `digraph` and `advanced` take their
words from `service/wordSpace/phonicsSpaces.ts`, inside the objective's letter scope (`scope.ts`, WS-0). The
library's letter-to-sound alignment is the tile list. No model call on that path. Probe: `scripts/word-space-lab/probe.sh`;
raw output `before.txt`, `after.txt`, `after-advanced.txt`.

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| cvc | needs a space | the same 5 words (cat dog sun bus pig) at every tier, both runs |
| cvce_blend | needs a space | cake bike bone cute at every tier; cute pictured as 🐰 |
| digraph | needs a space | ship chop thin fish path at every tier |
| advanced | needs a space | boy coin cow cloud house at every tier; an r-controlled objective could draw diphthongs |
| build_blend | measured, left alone | code-built letter build, judged by the shared word judge |

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| cvc (K, mixed vowels) | win, men, nut, nod, map | lid, pot, rug, jam, vet | tug, pat, pig, bed, dog |
| cvc (K, short e) | hen, yes, men, set, leg | wet, fed, web, leg, set | pet, jet, bed, pen, ten |
| cvc (K, Letter Group 2) | mad, him, ran, sad, nap | can, men, hip, rap, sit | dad, pen, did, net, sit |
| cvce | lake, hole, mine, fine, home | flame, smile, joke, rule, fade | snake, flute, bride, rope, rude |
| blend (named bl, cl, fl, st, sp) | stuck, block, clock, spin, flag | stack, flip, click, spun, clam | clip, split, stand, blend, spell |
| digraph | chat, that, hush, when, wish | such, then, whip, smash, shelf | chimp, which, slash, length, shrimp |
| advanced, r-controlled | for, far, curb, dirt, barn | fork, harp, stir, fern, surf | clerk, mark, burst, thirst |
| advanced, diphthong | toy, cow, town, sour, soil | gown, soy, shout, point, spoil | clown, hound, brow, point |

Features: stops vs sounds you can stretch, sound count, initial vs final cluster, e/i vowels, the silent-e
vowel order (a_e, i_e before u_e, e_e), soft c/g, th's two sounds, ar/or before the /er/ spellings, ow/ou
ambiguity. Tests: `phonicsSpaces.test.ts` (every word passes `isBlendWordUsable`, tiles re-derive from the
alignment, tiers ordered), `scope.test.ts` (WS-0).

## Decisions to review

- **Words without a reviewed picture are allowed.** The emoji is the reward after the word is credited, so
  a reading item does not need one. Letter Group 1 has 2 pictured CVC words; requiring pictures would send
  every group-1 lesson to the model. Words without one get no reward picture.
- **Digraph mode is short-vowel only** (no chase, white): a silent-e tile has no sound, so the tutor's
  sound walk would drop.
- **Narrow scopes tier by overlapping windows.** A letter group with 8 CVC words gives easy the 5 easiest, hard
  the 5 hardest, medium the middle 5.
- Function words (that, then, which, for) are decodable and stay.

## Owed

- Browser check: Language Arts tester → phonics-blender → "Difficulty (word space)" → each tier, every mode.
- No Live run: payload shape and script unchanged.
