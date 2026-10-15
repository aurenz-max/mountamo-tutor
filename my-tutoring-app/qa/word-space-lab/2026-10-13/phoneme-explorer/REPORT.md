# phoneme-explorer on the word library (pilot, 2026-10-13)

With `config.difficulty` at K or grade 1 (no remediation focus), all six modes take their items from
`service/wordSpace/phonemeSpaces.ts`: code picks the words, the answer and the wrong cards at the tier.
No model call on that path. Probe: `run-probe.sh` (K, 2 runs per tier per mode); raw output `before.txt`, `after.txt`.

## Before (model path)

Easy, medium and hard gave the same items in every mode. cat, dog, sun, pig and pen appeared in every mode.
Segment answered "three" in 12 of 12 runs. Ending gave the same 5 items on every run. Isolate shipped
"/S/ → Bus" (wrong answer key).

## After (K)

From the current `after.txt` (1 run per tier, after the frequency rank was removed from the lexicon on 10-14).

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| isolate (first sound) | /f/ → **fun** · vet · sun · lip | /f/ → **fin** · van · bin · jet | /k/ → **can** · girl · man · nut (near sound /g/) |
| ending (last sound) | kick → **sock** · log · man · map | bun → **pan** · jam · bus · tag (a card shares the first two sounds) | pot → **nut** · red · pop · king (near ending /d/) |
| medial (middle vowel) | cup → **duck** · van · wet · kick | bug → **hug** · tag · leg · dig (same ending, vowel differs) | hen → **jet** · cap · log · fun; fun → **duck** · pop (o/u) |
| blend | p-a-n, s-o-k, r-u-n | k-i-s, m-u-g, v-e-t | p-i-g, n-e-t, l-e-g (stops, e/i) |
| segment (count) | egg 2, go 2, tub 3 | boat 3, bun 3, pup 3 | hand 4, brick 4, peach 3 |
| manipulate (first sound) | hog → fog, fan → pan | net → vet, lake → cake | van → fan, win → bin (one-feature change) |

Every space item passes the component's own gates (`itemFromChallenge`), its answer key re-derived from the
phonemes, and a mixed session loses no item to the leak gate (`phonemeSpaces.test.ts`, 31 tests).

## Decisions to review

- **Segment at K counts 2 to 4 sounds**, not only 3. The old K rule ("3-phoneme CVC only") made the answer
  always "three". The subskill says "segment a CVC word"; easy now includes 2-sound words (go, egg) and hard
  4-sound words (drum, nest).
- **Blend at K stays 3 sounds**, so its tiers differ only by sound type (stretchable vs stop, e/i vowels).
  The tier gap is small there by design; grade 1 adds 4-sound words.
- **Ending and medial no longer use the hand banks** on this path (9 ending sets, 60 medial words).
  The banks stay for the model path.

## Sources

Licenses and notices: `src/components/lumina/service/wordSpace/NOTICE`. The lexicon stores no frequency rank;
the OpenSubtitles list (CC-BY-SA-4.0) is a build-time pre-filter only.

## Owed

- A browser check: Language Arts tester → phoneme-explorer → "Difficulty (word space)" → each tier, every mode
  (the tester now sends the difficulty for this primitive). Not driven here.
- A Live check is not needed for this change by the testing policy (the payload shape is unchanged; what the
  tutor says comes from the same script).
