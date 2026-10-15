# Word-space lab: findings (2026-10-13)

Question: can a code-only word library serve the early K literacy subskills (letter groups like s a t i p n,
CVC decode/encode, phonological awareness, K vocabulary sorts) without the LLM choosing words?

Run: `node scripts/word-space-lab/lab.mjs` (2 s, no LLM). Inputs: 99 published K + G1 foundational and
vocabulary subskills (read-only Firestore export). Full per-subskill output: `REPORT.md`, `results.json`.

## Result

- 58 of 99 subskills served by the library. Every pick in all 58 passes an independent re-check
  (decodable under the scope, answer correct, distractors wrong, nonsense words not real, nothing banned),
  over 3 seeds × 3 tiers × 5 picks.
- 56 of 58 give easy < medium < hard by predicted β. The 2 exceptions are small hoppers (G1 cap/cape pairs: 13;
  compound-word syllable blending: 15), where the tiers cannot separate.
- 41 not served: grammar, print concepts, comprehension, connected text, and word relations (opposites,
  synonyms, scales, goes-with, multiple meanings). These are prose or relation tasks: LLM band or a curated table.
- Curriculum examples found in the computed hopper: K CVC short a/e/o/u 8/8, short i 8/11, G1 CVC 10/10,
  G1 silent-e 9/10, G1 sight words 10/10.

## How "s a t i p n" becomes words

1. Scope from the subskill text, in code: "Full Practice Set (Cumulative)" gives the known letters, the title
   gives the focus letters, and each letter maps to its taught sound (a = /æ/, s = /s/, c and k = /k/, ck when both).
2. Every library word carries its grapheme-to-phoneme alignment (CMU dictionary, aligned in code). A word is
   decodable when every pair is known. This is what the letter filter got wrong. For group 1 the letter filter
   admits 29 teachable K words and the pair filter rejects 9 of them, e.g. is (s = /z/), pain (ai), pass (ss), pans (s = /z/). For group 2 it rejects 287 of 387: the, and, he, see, here, time.
3. Group 1 leaves 15 words: an, at, in, it, nap, pan, pat, sat, sip, sit, sits, snap, spin, tan, tap.
   Two-thirds of each draw use a focus pair; focus and review words are tiered separately.

## What it took (in order of impact)

1. **Familiarity cannot come from frequency lists.** Subtitle frequency let in mob, jab, fax, val, liv.
   A one-time flash-lite rating of 6,505 words (grade known by, kid-safe, picture fits, category; ~100 calls)
   agrees with human age-of-acquisition norms on the 1,537-word overlap: median AoA 4.7 yrs for words rated K,
   6.4 for G1, 7.7 for G2, 9.8 for later; 1 of 797 K-rated words has AoA > 8.
   A second pass ("would a K-1 teacher list it") removes clipped and informal forms: sis, hon, mum, yup, gran, mic.
   These are build-time facts stored with the word, checked once by a person; nothing runs at lesson time.
2. **The emoji name is not the word sense.** mat 🧘, nerd 🤓, take 🤲. The rating's `pictureOk` removes them;
   693 words have a picture, about 470 fit at K.
3. **Hoppers are small, and that is correct.** K short e: 19 words. Group 1: 15. A small hopper still varies across
   seeds, but the word itself barely changes difficulty there (short e easy/medium β 0.40/0.44). In a narrow scope,
   difficulty has to come from the task's structure (nearer distractors, onset vs medial position, nonsense partner
   differing only in the vowel), the same rule as math `tierPick` for narrow scopes.

## Gaps this lab shows

- Letter keywords: no fitting K picture for i, y, x, and only 1-2 for o, u, v, z. These need the existing
  hand table (`LETTER_KEYWORDS`), not the library.
- Syllable blending has only compound words (cow + boy). Non-compound words (ba-by, but-ter-fly) need a
  syllable splitter (hyphenation patterns).
- The CMU dictionary cannot tell short o in dog from the vowel of ball (both /ɔ/), so a medial-o item can be
  a non-CVC vowel.
- Categories come from the rating and are noisy at the edges (bag as clothing, plus as school): they need
  the human spot-check.
- Opposites, synonyms, scales and goes-with relations have no public source: a curated relation table
  (picture-vocabulary already holds part of one).

## Not done

No primitive is wired. The lab proves the library and scope parser on curriculum text. It does not show
how a child performs on these items; β values are structural priors, to be refit from `first_try`.
