---
name: add-word-space
description: >-
  Give a K-2 literacy primitive a word space: code lists every item a mode allows from the shared word
  library (words with phonemes, letter-to-sound pairs, pictures and reviewed ratings), computes each item's
  difficulty from its structure, picks items at the requested `config.difficulty` (easy/medium/hard, from a
  lesson or Pulse), and computes the answer and the wrong options, so no model chooses a word. Use when a
  literacy primitive's tiers give the same words, its words converge (cat, dog, sun), a letter scope like
  "s a t i p n" leaks other sounds, or its answer keys are trusted from the model. Covers growing the
  library, adding a mode's space, and wiring a generator. For words inside model-written prose (a book's focus
  words, a passage) it builds no space: the tier becomes a structural ladder the prompt follows and code counts.
  Not for math strands (/add-item-space), help/simplify levers (/add-support-tiers), or a new task identity
  (/add-eval-modes).
---

> **Paid Gemini runs are the user's (USER RULING 2026-10-17).** Wherever this skill says to run a Live journey (`run_*.py`) or `tutor_replay.py`, do not run it: a hook blocks it. Finish the free checks, then give the user the exact command, its request count, and the question it answers. See `backend/tests/tutor_live/LIVE_TESTING.md`.

# Add a Word Space

## The outcome

A literacy primitive asked for easy, medium or hard gets items a K-1 teacher would recognize as easier or
harder, different across sessions, correct by construction, inside the lesson's scope, and stamped with a
predicted beta that first-try results can later correct. The model chooses no word, no answer and no wrong
option on this path.

**Why this exists.**
- Lab, 2026-10-13 (`my-tutoring-app/qa/word-space-lab/2026-10-13/FINDINGS.md`): a code-only library served
  58 of 99 published K+G1 foundational subskills. Every pick passed an independent re-check, and 56 of 58
  separated easy < medium < hard.
- Pilot, phoneme-explorer, all 6 modes (`.../phoneme-explorer/REPORT.md`). Before, easy, medium and hard
  gave the same items in every mode, and cat/dog/sun/pig/pen appeared in every mode. Segment answered
  "three" 12 of 12 times. Isolate shipped "/S/ → Bus". After, every mode's tiers change the item.

## Invariant principles

**1. Scope is taught letter-sound pairs, never letters.** "s a t i p n" admits *sat, pin, snap*. It does not
admit *is* (s says /z/), *pain* (ai) or *pass* (ss), although every letter is taught. A word is in a
reading/spelling scope only when every grapheme/phoneme pair (GPC) in it is known. Oral tasks (rhyme,
sounds, syllables) have no letter scope; their scope is the grade's familiar, picturable words.

**2. Difficulty is a property of the item, computed by code.** It is a sum of structural features (a linear
logistic model), not a word in a prompt. Features that hold across K-1 literacy:
- *Position:* first sound < last sound < middle sound.
- *Sound type:* sounds you can stretch (m, s, f, l, n) are easier than stops (b, t, k, p).
- *Size:* 2 sounds < 3 < 4. A single consonant < a cluster (frog, nest).
- *Near confusion:* a wrong option that differs by one feature (b/p, m/n, e/i, o/u) or shares the onset or
  rime with the answer.
- *Spelling vs sound:* a word whose letters outnumber its sounds (duck, ship) tempts letter counting.
- *Familiarity:* the word's reviewed known-by grade.
Magnitude (word length alone, rarity alone) is not difficulty.

**3. The task does not change with difficulty.** Every item in a mode's space asks the mode's thing. A harder
item is the same task with more demand. A different task belongs to another eval mode.

**4. Narrow scopes are correct; tiers are relative.** K short e has about 20 words; Letter Group 1 has 15.
`tierPick` ranks a space by beta and gives each tier its third. Inside a narrow scope, difficulty must come
from the task's structure (nearer wrong options, sound position), because the word barely changes it.

**5. Code computes the answer and the wrong options, from the phonemes.** A rhyme is a shared rime
(`rimeOf`), not a shared spelling. A first sound is `phones[0]`, not the first letter (cat and kite
share /k/). Wrong options come from the task's known mistakes: matching the first sound instead of the rime,
one-feature sound swaps, e/i and o/u vowels.

**6. Every word on screen has a picture that shows it, or the item does not use that word.** Pre-readers reach
words through pictures. The library's `emoji` is null unless a rater judged that a five-year-old shown only
that emoji would say the word (mat 🧘 and take 🤲 were rejected).

**7. Build-time facts, never lesson-time judgment.** Which words exist, their grade, kid-safety, teachability
(no sis, mum, yup), picture fit and category are rated once, reviewed by a person, and checked in. Nothing
is rated while a child waits.

**8. Measure before trusting.** A space is done when its tiers separate on the probe, every item passes the
primitive's own build gates, and its answer keys re-derive from the phonemes in a test.

**9. Code picks the word only when the item IS the word.** Spelling, blending, sorting, rhyming: the word is the
task, so code picks it. A word inside prose the model writes (an interactive-book focus word, a decodable
passage) has to fit that prose, and the sentence around it already sets how hard it is to read. Fixing those
words in code and asking the model to write around them was built, probed (18/18 kept) and reverted by user
ruling 2026-10-14. There, two moves remain: code may CHECK the model's words against the scope and retry, and
the tier becomes a structural ladder (principle 10).

**10. Prose difficulty is structure the prompt asks for and code counts.** decodable-reader
(`decodableReaderLadder.ts`) maps grade x tier to words per sentence, sentences per story, decoding load and
syntax. One table feeds the prompt, the retry gate and the script's askable-line check, so they cannot
disagree. No tier keeps the old behaviour byte for byte. Gemini writes near the bottom of a wide window
(grade 3 hard: 9-10 of 9-15); ask for an average if the top matters.

**11. The pattern is the pair, not the letters.** A pattern word spells the pattern's own GPC (ai/EY, never the
ai of "said"). A long vowel before r is not the long sound (ear, deer). The r of ar/or belongs to the vowel: it
is neither an extra sound nor a cluster when scoring. A word family is onset + the rime's graphemes with the
pattern's vowel (cat, that, flat, back; not "what").

**12. Never swap the asked-for pattern.** A pattern the objective names that the library cannot fill (mb, gn, er)
takes the model path, logged. Never substitute a neighbour. Thin patterns that teach one rule may join (kn + wr,
about 8 and 7 words), with the draw split so each part is tiered and present in every session.

**13. One-pattern sessions tier the scored items.** When a session is one pattern (spelling-pattern-explorer),
the tier picks the scored items (dictation); the examples to look at come from the easiest of the rest. A
pattern needs slots + 2 words to tier at all. Shuffle the candidate patterns and try each in turn: a single
`mulberry32` draw on the first output is biased (one pattern won 15 of 20 seeds).

## The library (`my-tutoring-app/src/components/lumina/service/wordSpace/`)

| File | What it holds |
|---|---|
| `lexicon.json` | 4,656 words: phonemes `p`, GPCs `g`, sound shape `s`, syllables `y`, emoji `e`, known-by `k` (K/G1/G2), category `c`, reviewed `v`. Built, never hand-edited. |
| `lexicon.ts` | `WORDS`, `lexWord`, `knownByForGrade`, `onsetOf`, `rimeOf`, `CONTINUANTS`, `NEAR_SOUND`, `NEAR_VOWEL`, `SHORT_VOWEL_OF`, `soundLabel` (the format phonemeVoice speaks), `soundSaid` (stretched or "buh" form). |
| `pick.ts` | `WordSpaceItem` {beta, structure, words, shown, produces, key, payload}; `tierPick(items, tier, n, rand, used, heard)`; `mulberry32`; `WordSpaceStamp`. |
| `phonemeSpaces.ts` | The reference: six modes' builders and `phonemeSpace(mode, grade)`. |
| `scope.ts` | WS-0: `scopeFromObjective(texts)` (letter groups, SATPIN, short vowels, blends, digraphs, silent e, word family), `decodableWords`, `isInflected`, heteronyms. |
| `pick.ts` (more) | `tierPickFocus` (2/3 from a letter group's new letters), `tierPickSplit` (a draw that must hold both kinds: rhyme/no, two vowels). Narrow spaces tier by overlapping windows; a band that runs dry fills from its nearest neighbours. |
| `nonsense.json` | CVC strings that are no word, name or homophone (CMU + hunspell; `build-nonsense.mjs`). The lexicon alone cannot say "zed" is real. |
| per primitive | `phonicsSpaces`, `cvcSpellerSpaces`, `soundSwapSpaces`, `rhymeSpaces`, `syllableSpaces`, `letterSpaces` (letters, key words), `wordWorkoutSpaces`, `categorySpaces` (nouns, sorts), `wordFlipSpaces`, `spellingPatternSpaces` (one pattern a session: short vowel, family, silent e, vowel team, r-controlled, kn/wr). The prose ladder lives beside its primitive: `literacy/decodableReaderLadder.ts`. |
| `NOTICE` | Source licenses. Keep it accurate when a source is added. |

**Session rules `tierPick` enforces** (all learned on the pilot):
- `words`: targets, answers and examples never repeat in one session. Wrong menu cards may repeat.
- `shown` + `produces`: an item that makes the child produce a word (blend, manipulate) skips any word an
  earlier item showed or said. The script's leak gate would otherwise drop it.
- `key`: the asked sound (or vowel) does not repeat within one mode's picks until every key is used.
- Ties in beta break at random, so tied items cross tier boundaries differently each session.

**Growing the library** (`my-tutoring-app/scripts/word-space-lab/`): `fetch-sources.mjs`, `rate-words.mjs`,
`rate-teachable.mjs`, then `build-lexicon.mjs`. A person's corrections come from the review page
(https://claude.ai/artifact/HXUusXVu2zBxzBz2oSkawY, collection `review`) into `review-overrides.json`, which
wins over the ratings. Read the review with `ArtifactData list` (`out_dir` to files) and regenerate the
overrides file. The frequency list (CC-BY-SA-4.0) is a build-time filter only: never write its ranks into the
lexicon. `lab.mjs` re-runs the 99-subskill check in about 2 s.

A word you find mid-build that must go (jeez, 10-14) goes into `review-overrides.json` (`teachable: false`),
then `build-lexicon.mjs`. Diff the old and new `lexicon.json` and confirm only that word changed. The overrides
file is regenerated from the review page, so say in the report that the same rejection needs the review store.

## Procedure

### 0. Read before touching
- `phonemeSpaces.ts` and its test (the reference), `pick.ts`, the pilot REPORT.
- The primitive's contract (`docs/contracts/<id>.md`); run `/primitive-contract --check` before editing its
  generator. Find its component-side build gates (the phoneme-explorer equivalent is `itemFromChallenge` /
  `itemsFromChallenges` in `phonemeExplorerScript.ts`). Your test will run every space item through them.

### 0b. Measure every mode first
A primitive means every eval mode. Add a printer for its challenge shape to
`scripts/difficulty-lab/tier-probe.mjs`, copy `qa/word-space-lab/2026-10-13/phoneme-explorer/run-probe.sh` with
one curriculum-worded topic per mode, and save `before.txt` (2 runs per tier). Read the payloads. Give each mode
a verdict: needs a space (tiers equal, words converge, wrong answer keys), measured and left alone (its tiers
already change the item, or it is code-built like letter-workshop), a ladder (prose: principle 10), or not a fit
(open answer judged elsewhere), with the reason.
- First check the tier reaches the generator at all. interactive-book read `raw.wordDifficulty` and
  decodable-reader read nothing: their tiers were ignored, not weak.
- The probe passes `objectiveGrade`; a lesson's manifest stamps it. Read the generator's log for the grade it
  used: a missing grade falls back to the band default (a grade 3 lesson once ran as grade 1).
- A one-object payload (one pattern or one passage per session) prints as one row: extend the `one` check
  in `tier-probe.mjs`.

### 1. Define each mode's item
Write what one item is: what is shown, what is said, what the child answers. Then list the item's parameters
(target word, answer, wrong options, position), its structure key (the item without its words), its features
and their weights, and its scope (grade words; for reading tasks, the known GPCs). Note what the payload must
look like: the generator's existing challenge shape, field for field, so the component needs no change.

### 2. Write the builders
Put them in `service/wordSpace/<primitive>Spaces.ts`, one function per mode returning
`WordSpaceItem<payload>[]` for a grade, cached per mode and grade. Rules from the pilot:
- Start from `pool(grade)`: one syllable, pictured, aligned, known by the grade. Narrow from there; never widen.
- Wrong options are picked deterministically per target (`take(list, key)`), so the same target always gets
  the same item (an IRT item must not change between draws).
- Rotate the answer's position (`placeAnswer`).
- Check every rule the model path relied on: a menu answer that rhymes with the target is fine only when the
  wrong cards share that ending too; a vowel letter must say the sound the walk says (ball, wash are not
  short-o CVC); r-controlled words make sound counts ambiguous.
- Docblock: what the mode measured before, the features and their research basis.

### 3. Wire the generator
Follow `generatePhonemeExplorer`:
- Gate: `ctx.supportTier` set, grade inside the space's range, and no `ctx.remediationFocus`. The remediation
  path asks the model to encode one diagnosed confusion; leave it, or port it in a separate slice.
- Use one `used` set and one `heard` set per session, and draw modes in plan order.
- If a mode's picks fall short of its slots, that mode takes the model path. Never mix within a mode.
- Run the generator's own validator on space items. Extend lookups that assumed a hand bank (the pilot:
  `endingSoundForWord` falls back to `lexWord`).
- Stamp `wordSpace` {space, structure, beta} on each challenge and add it to the challenge type. Confirm the
  tutor context does not spread it.
- Log one line per mode: structures and betas, or "only n of m, model path".
- Let the tester send `difficulty` for the primitive (the `takesDifficulty` list in
  `LanguageArtsPrimitivesTester.tsx`).

### 4. Verify
- A test next to the builders:
  - every item of every mode at every grade passes the primitive's build gates;
  - its answer key re-derives from `phones` (first sound, last sound, vowel, count, one-sound change, shared rime);
  - every tier yields n distinct items with easy < medium < hard mean beta;
  - a mixed session loses no item to the session leak gate;
  - each rule from step 2 has a regression case.
- The primitive's existing suites, `typecheck:lumina` 0, and full tsc with no new errors in touched files.
- Touching shared parsing (`scope.ts`, `letterGroups.ts`) or shared scoring: run the full `src/components/lumina`
  suite. Teaching `lettersNamedIn` to read "s a t i p n" changed a di-letter-sounds stress test's input from a
  loose mention to a named set. A red test in a file another session is editing (uncommitted, not yours) is
  reported, not fixed.
- `after.txt` with the same probe. Every mode should read "code space". Read every item: would a K teacher
  call easy easier than hard, and is each picture the word?
- A browser check in the tester per tier. If you cannot drive it, say so: "should work, needs a browser check".
- No Live run: the payload shape and the script are unchanged (LIVE_TESTING.md). The exception is a spoken
  utterance longer than its benched ceiling (`sentence_read_aloud` is benched at 3-8 words). That needs a Live
  sitting, which the user runs: `run_live_runtime.py --difficulty <tier> --grade <g>`. Ask them to plant a
  deliberate one-word misread in a long line.
- Reading a Live result: the tutor's verdict moves the lesson; the transcript re-grade scores it. When they
  disagree the item is `uncertain` and left out of the score (user ruling 10-14, `scoreSession`). Either side can
  be the one that erred, so neither a "trust the tutor" nor a "trust the transcript" fix is wanted.

### 5. Record
- Contract: a requirement for the word-space path, and a changelog line with the before/after numbers.
  Narrow any requirement the change breaks (phoneme-explorer R4 "the tier never changes the content" now
  holds on the model path only).
- The primitive's REPORT under `qa/word-space-lab/<date>/<primitive>/` and its WORKSTREAMS Phase 8 row.

### 6. Final report (in the reply)
End with a per-mode table of real items from `after.txt` (Mode | Easy | Medium | Hard), one line on what the
tiers gave before, the decisions the user should rule on (scope changes such as segment counting 2-4 at K), and
every mode's verdict from 0b.

## Gotchas
- **Library traps found in the 10-14 sweep:** CMU gives function words their unstressed vowel (to = /tə/, so
  to → tub); `category` has no part of speech (cold 🥶 is "weather", jog 🏃 is "sport"), so noun tasks keep object
  categories and drop action pictures; inflected forms (cats, letting, gaming) and heteronyms (dove, bow) need
  `isInflected` and the heteronym list; two words can share one picture (cot and bed 🛏️), so check distinct
  pictures inside an item; a library plural is no proof of countability ("butters" is a verb).
- **Python heredocs mangle backslashes** (`\n` becomes a newline, `\1` a control byte, `\u{…}` a parse error)
  in TS sources. Use the Edit tool for any line with a backslash, then grep for `join('$` and control bytes.
- **CRLF files:** many generators use Windows line endings; a Node string-replace script silently misses.
  Use the Edit tool for those files.
- **phonemeVoice formats:** consonant labels are ASCII ("k", "sh"); short vowels are the bare letter (the script
  stretches it to "aaa"); other vowels are IPA ("eɪ" → "ay"). Never emit "c", "q" or "x" as a sound.
- **CMU merges** /ɑ/ and /ɔ/ in some words (dog, ball both AO). Treat AA and AO as short o in sounds, but
  require the vowel letter to match before you call a word short-vowel CVC.
- **The hand tables in generators** (MEDIAL_WORD_BANK, ENDING_SOUND_CONTRASTS, K_RHYME_FAMILIES,
  LETTER_KEYWORDS, CVC_FAMILIES) stay for the model path. Do not delete them in the same slice.
- **Letter keywords** (a picture whose word starts with a letter's sound) have no K-pictured word for short i, y
  and x in the library. Keep `LETTER_KEYWORDS` for those letters.
- **Syllable splits** exist only for compound words (cow + boy); non-compound splits need hyphenation patterns.
- **Word relations** (opposites, synonyms, scales, goes-with) have no public source. They need a curated table
  first; the library's category field covers sorting and odd-one-out only.
- **Thin in the library:** er (4 words; "her" is missing), ur (11), u_e (5), mb/gn (none), -ig (5). Grade 1 spells
  up to five sounds; "strength" and "splash" wait for grade 2. Letter Group 1 at K holds 8 picturable CVC words.
- **ng is its own pair:** ring is ng/NG and sink is n/NG. A scope without them silently drops king, sing, wrong.
- **Rule text from a template must not name a word the child spells.** Key words in a rule come from outside the
  space (apple, elephant, insect: two syllables, never drawn).
- **vitest swallows `console.log`.** To read a space while designing it, write to a file from a throwaway test
  and delete the test after.
- **Bash heredocs also turn `\n` into a newline in `.mjs` probe printers.** Run `node --check` on the probe after
  editing it.
