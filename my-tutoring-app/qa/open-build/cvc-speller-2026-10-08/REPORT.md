# Letter build: cvc-speller `make_word` + sound-swap `swap_build`, 2026-10-08

OB-3L L2 and L3. One shared surface (`LetterBuildSurface.tsx`, rules in `letterBuild.ts`) serves both: three letter
boxes, a letter bank, "I'm done!". Many words pass.

| Mode | Ask | β |
|---|---|---|
| cvc-speller `make_word` | "Make a real word with the short a sound in the middle, like in apple." / "Make a real word that rhymes with dad." | 2.6 (spell_word + 0.1) |
| sound-swap `swap_build` | "Change one letter in pin to make a new real word." (boxes start as p i n) | 4.1 (substitution + 0.1) |

Every second item asks for a second word (not at the easy tier).

## Judge
Code checks everything the ask states, with no model call:
- `not_cvc`, `wrong_vowel`, `wrong_family`
- `same_as_given` (the given word back)
- `changed_more` (more than one letter changed)
- `same_word` (a word already made)
- `pick_another` (a short code list of real words a lesson should not credit)

The shared word judge then answers only "is it a real word?". `judgeWordBuild` gained `only: 'real_word'`, which asks
Jev one question and still gets flash's second opinion on a rejection.

## Asks are code-owned (no model call)
- **Seed list:** `letterBuildWords.ts`, 23 word families of common CVC words. It only WRITES asks; it never judges. Any
  real word the learner makes passes.
- **Ask gate:** an ask ships only when 3+ seed words in the lesson's letters answer it.
- **Given words:** only familiar ones (`GIVEN_WORDS`). The first draw asked K learners "rhymes with rut / nip / lit",
  so these are now restricted.
- **Swap variety:** given words differ from each other in 2+ letters. A drive drew bat, cat and can in one session
  before this rule.
- **Banks:** the letters the examples need, one other vowel (so a wrong vowel is possible) and two foil consonants, all
  inside the cvc-speller letter group.

## Levers (start bare)
- `pattern_card` (help): the part the ask fixes (`_ a _`, `_ a d`, or the given word with "change one"). Answers every
  shape miss.
- `model_word` (help): a solved example of the same kind on other letters. Answers `not_a_word`.
- `small_bank` (simplify): the same ask with only one example's letters, ungraded.
- `same_word` and `pick_another` are declared unanswered.

## Evidence
- **Real generations:**
  - cvc-speller: K group 3, G1 short-a, G2 (`gen-*.json`).
  - sound-swap: G1 (`../sound-swap-2026-10-08/gen-g1.json`).
  - Every ask had 3-6 answers in its bank.
- **vitest:** `LetterBuild.workspace.test.tsx` 10/10:
  - pure rules
  - 20 random sessions of each kind stay in the letter group with familiar given words
  - adapter acceptance and miss coverage
  - real-runtime drives of both hosts
- **Wide suite:** literacy + live-activity + catalog + service/literacy + pip: 251 files, 5776 tests pass, after
  fixing one sweep finding (the pattern lever now answers every shape miss).
- **typecheck:lumina:** 0.
- **Headless Chromium** (Language Arts tester, offline bench, real judge):
  - make_word:
    - "lat" for short o → wrong_vowel (code)
    - "coc" → not_a_word (judge)
    - "lot" → pass
    - rhymes with bed: "fed" kept, "fed" again → same_word, "red" → pass
  - swap_build:
    - "bac" and "bab" from bat → not_a_word (judge)
    - "bad" → pass
    - pin: "bin" kept, same again → same_word, "fin" → pass

About 300 lines of rules + seed list, 330 for the surface, about 80 changed in host files; 230 test lines.

## Not verified / open
- No Live run (rides the literacy class gate). No phone width check of the 14-letter bank.
- With a vowel focus every vowel ask has the same wording (massed practice); the learner may also repeat a word made
  on an earlier item.
- `pick_another` is a short list; the judge may still pass an unlisted unsuitable real word.
