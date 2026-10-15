# spelling-pattern-explorer on the word library (2026-10-14)

When a lesson has a support tier, grade K-2 and no remediation focus, code picks one pattern the objective
allows. It then takes the tier's four dictation words and up to six easier pattern words from
`service/wordSpace/spellingPatternSpaces.ts`, and writes the rule from a template for that pattern. No model call.
A pattern the library cannot fill takes the model path, unchanged. That covers er and ur (4 and 11 words), mb,
gn and a one-onset family such as -ig. Raw output: `before.txt`, `after.txt` (`run-probe.sh`, 2 runs per tier).

## Verdicts (step 0b)

| Mode | Verdict | Why |
|---|---|---|
| short_vowel | needs a space | cat man pig bug hat (mop/hop/top) at every tier; mixed vowels under a "CVC" highlight that marks no letters, so `spellingMiss` could only say "misspelled" |
| long_vowel | needs a space | CVCe was a_e only, with cake first in every run; "baker" was a dictation word; rain appeared twice in one list; vowel-team lists mixed five spellings |
| r_controlled | needs a space | bird (ir) in an ar/or/er set; a rule with Tamil text ("changes தங்க sound") |
| silent_letter | needs a space (kn, wr) | words converged on knee knot write wrist. When the objective names mb or gn, the model path stays (the library has no lamb, comb or thumb) |
| morphological | not a fit | suffix and Latin-root spelling, grades 3-6; the library is K-2 one-syllable words |
| pattern_build | measured, left alone | code-built letter build, judged by the word judge |

## After

| Mode (grade) | Easy | Medium | Hard |
|---|---|---|---|
| short_vowel (1) | o: not, on, off, fog | e: end, shell, mess, stem | i: bring, stink, shrimp, quick |
| long_vowel CVCe (1) | o_e: bone, home, hole, poke | o_e: froze, rope, pole, rode | o_e: choke, stone, drove, globe |
| long_vowel teams (2) | oa: goat, soap, foam, loaf | oa: oak, foam, coach, load | ai: claim, faith, strain, waist |
| r_controlled (2) | ar: far, hard, cart, arm | or: sort, porch, born, pork | or: storm, port, torch, thorn |
| silent_letter kn/wr (2) | knew, knee, wrong, wrap | knot, knock, wreck, write | kneel, knit, wreck, wrench |

Before, every tier gave the same words in every mode. Mean dictation beta in a test over 30 draws rises
easy < medium < hard for 12 patterns.

Difficulty features: number of sounds, a blend at either end, more letters than sounds outside the pattern
(ck, sh, tch), a /k/ spelled c or k, short e/i, and the word's known-by grade. The r of ar/or counts as part of
the vowel, never as a cluster. Grade 1 stops at five sounds.

## Decisions for the user

1. **kn and wr form one session.** The library has about 8 kn and 7 wr words, too few to fill 10 slots for
   either alone. Dictation takes two words from each.
2. **er and ur are never drawn** (too few words, and *her* is not in the library). An objective that names
   only er therefore takes the model path.
3. **jeez is removed from the library.** It was added to `review-overrides.json` as `teachable: false`,
   and the lexicon was rebuilt; only that word changed. The overrides file is regenerated from the review
   page, so the same rejection also needs to go into the page's `review` store, or a regeneration drops it.
4. **The rule text is a code template for each pattern**, for example "When r comes right after the vowel ___, the two
   letters make the ___ sound." The child's own rule is still accepted at more than 10 characters, as before.

## Owed

- No contract exists: run `/primitive-contract spelling-pattern-explorer`.
- Browser check per tier in the Language Arts tester (now in `DIFFICULTY_PRIMITIVES`). No Live run: the
  payload shape and the script are unchanged.
