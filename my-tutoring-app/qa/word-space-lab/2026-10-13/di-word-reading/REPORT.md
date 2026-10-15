# di-word-reading on the word space (2026-10-14)

`/add-word-space`. Files: `service/wordSpace/diWordReadingSpaces.ts` (+ test, 36 cases), `service/direct-instruction/gemini-di-word-reading.ts`
(gate + per-mode draw), `service/registry/generators/diGenerators.ts` (passes `grade`, `remediationFocus`), `diWordReadingDomain.ts`
(`wordSpace` stamp type), contract R9. Probe: `run-probe.sh`, `before.txt`, `after.txt` (2 runs per tier, 5 topics).

## Before

The generator chose from a 38-word hand menu (30 CVC, 8 sight); the tier only moved where the levers start.

- Every mode gave the same words at every tier. Short a: cat map mat pan in 5 of 6 runs. Review: `and the red pig` in 6 of 6.
- "Letter-Sound Group 1: s, a, t, i, p, n" served mat, cat, hat (m, c, h not taught).
- "Read simple CVC words and sight words" served `and the see go` in 6 of 6: no CVC word, because "sight" in the text
  switched the whole session to the sight list.
- "and" was a sight word, so the tutor was told it is irregular and must not be sounded out.

## After

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| cvc_reading, short a (K) | man map rap ran | jam rat had sad | mad bag tap pan |
| cvc_reading, s a t i p n (K) | tan sit sat sip | nap sip sit tan | tap pat pan sit |
| read_word (K) | can hen **the** win | not **yellow** bun sad | pat **where** gum ten |
| sight_word (G1) | is blue two the | put they come do | they walk were as / could there were of |
| word_reading_review (K) | can run **soon** men | cop mug **like** rat | dad cut bat **come** |

(bold = sight word). Every run reads "code space"; no model call is made when every mode fills.

**Features.** CVC: phonics-blender's CVC beta (stops, a stop at the start, e/i vowels, familiarity) plus two print features: the word
reads as another backwards (pot/top, tip/pit, +0.3) and b or d (+0.2). Sight: Dolch level (pre-primer 0, primer 0.3, first 0.6),
pairs the grade cannot decode, a known look-alike or reversal (was/saw, the/they, +0.3), a second syllable (+0.4), b or d, familiarity.

**Sight words** are the Dolch lists (public domain), kept only when the grade's taught pairs cannot decode them: K 59 words, grade 1
39 words. 17 classic irregular words (said, you, they, of, were...) are not in the lexicon; they are listed in `ABSENT_IRREGULAR`
rather than added to it. "and" is read with its citation pairs, since CMU gives it the unstressed /ən/.

## Verification

- `diWordReadingSpaces.test.ts`: every item of 6 spaces passes `wordReadingChallengeValid` and builds; keys re-derive (CVC letters
  = alignment, short vowel; sight items carry no graphemes or picture); easy < medium < hard; 30 seeds x 3 tiers x 5 session shapes x
  4 scopes: no word repeats, nothing dropped, every item has a `model_word` card. The di-word-reading, direct-instruction and
  wordSpace suites: 474 pass.
- `typecheck:lumina`: 4 errors, all in `service/itemSpace/skipFractionDivision.test.ts` (untracked, another session's work; not
  touched here). Full tsc: no errors in touched files.
- Not done: a browser check in the DI tester per tier (the tester already sends `difficulty`). No Live run: the payload shape and
  the tutor's frame are unchanged.

## For the user to rule on

1. **Group 1 easy and medium overlap** (8 words: tan sit sat sip vs nap sip sit tan). Word reading has no wrong options to make an
   item harder, so a narrow scope can only shift the window. Accept, or make easy at group 1 start with stretched first sounds only?
2. **K sight words include silent-e and vowel-team words** (make, see, play, ride) because K has not taught those pairs. A program
   that teaches them as decodable at K would want them out.
3. **Mixed modes hold one sight word in four.** The old default was the same ratio; say if review should hold more.

## Verdicts (0b)

| Mode | Verdict |
|---|---|
| cvc_reading | needs a space: tiers equal, scope leaked. Built. |
| read_word | needs a space: tiers equal, mixed objective lost its CVC words. Built. |
| sight_word | needs a space: tiers equal, 8-word list. Built (Dolch, grade-decodability filter). |
| word_reading_review | needs a space: one fixed set. Built (cumulative across vowels). |
