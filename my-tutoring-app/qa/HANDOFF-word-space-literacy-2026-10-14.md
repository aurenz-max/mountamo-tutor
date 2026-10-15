# Handoff: word spaces for the K-1 literacy primitives (2026-10-14)

**Executor:** `/add-word-space`, one primitive per session, serial (never a workflow sweep before each
primitive's own probe has been read). **Queue:** WORKSTREAMS Phase 8, rows 8.2e+ (add one row per primitive
as it starts). **Reference build:** phoneme-explorer, all 6 modes
(`qa/word-space-lab/2026-10-13/phoneme-explorer/REPORT.md`, `service/wordSpace/phonemeSpaces.ts`).

## Where things stand

- The word library is built and checked in: `service/wordSpace/lexicon.json`, with 4,656 words, phonemes,
  letter-to-sound pairs, reviewed ratings and pictures. Licenses are in `service/wordSpace/NOTICE`.
- The picker (`pick.ts`) enforces the session rules found on the pilot (no repeated target or answer, nothing
  produced that was already shown, no repeated asked sound).
- The 99-subskill lab (`scripts/word-space-lab/lab.mjs`) already has working prototypes of the spaces several
  primitives below need: decode/encode hoppers, real-vs-nonsense pairs, rhyme sets, syllables, sound swaps and
  concept sorts. Port from it rather than redesigning. It is plain JS over the same data.
- Uncommitted as of this handoff. `/ship` the pilot before starting the next primitive, so each primitive is
  its own reviewable slice.

## Before any reading/spelling primitive: WS-0, the letter-scope parser (prerequisite)

phoneme-explorer is oral, so it needed no letter scope. cvc-speller, phonics-blender, word-workout and
letter-sound-link do. Port `scripts/word-space-lab/scope.mjs` to `service/wordSpace/scope.ts`:

- `scopeFromObjective(texts)` returns {known GPCs, focus GPCs, allowed shapes, vowel focus, clusters, word
  family}. It reads the published wordings: "Full Practice Set (Cumulative): …", the "Letter Group N: …"
  title, "Short 'a'", "Mixed Short Vowels", "initial consonant blends (bl, cl, …)", "final blends including
  nd, nk, …", "silent e", "digraphs (sh, ch, th, wh)". It also needs "SATPIN"/"satpin" and letter lists
  separated by spaces, which `letterGroups.lettersNamedIn` misses today.
- `decodableWords(scope, {grade, needPicture})`: every GPC of the word is known. Focus words make up two
  thirds of each draw, tiered separately from review words (the lab's quota split).
- Make `letterGroups.ts` the one source of the group order and point it at this module. Retire the private
  copies in `gemini-letter-spotter.ts` and `gemini-letter-sound-link.ts`, which the file header already flags.
- **Tests:**
  - group 1 yields *sat, pin, snap* and never *is, pain, pass, cake*;
  - every group-2 word uses only known pairs;
  - the curriculum example lists are recalled. The lab got K short a/e/o/u 8/8, G1 CVC 10/10, and silent e
    9/10 (the miss was *cute*).

## Primitives, in recommended order

Each entry lists the modes (from the catalog), what the 2026-10-13 survey found, what the space should do, and
the traps. Every mode still gets its own measured verdict in step 0b. The notes below are a starting point,
not a verdict.

### 1. phonics-blender: `cvc`, `cvce_blend`, `digraph`, `advanced`, `build_blend`
- **Today:** Gemini picks the words and their sounds. Only `cvc` is checked (`isCvcSpelling`, 3 sounds), and
  if fewer than 3 words would survive, it keeps them all. Tiers change scaffolding only.
- **Space:** the library's GPC alignment *is* the tile list (c|a|t, sh|i|p, c|a_e|k). Each mode's scope is a
  shape: CVC, CVCe or CCVC/CVCC, digraph words, then r-controlled and diphthong words (G1-2). Features: stops,
  e/i vowels, clusters, digraph count, familiarity.
- **Traps:**
  - silent-e words need the split-digraph tile convention the component already draws;
  - `build_blend` is code-built and judged by the shared word judge, so measure it and probably leave it alone;
  - K uses `cvc` only (the census route).

### 2. cvc-speller: `fill_vowel`, `spell_word`, `word_sort`, `make_word`
- **Today:** Gemini picks the words inside letter groups (`cvcUsableLetters`). `spell_word` already has
  structural wrong letters by tier. `enforceCvcScopeAndVariety` never calls `isCvcSpelling`.
- **Space:** decodable CVC words under the WS-0 scope (letter group or vowel focus).
  - `fill_vowel`: the wrong vowels range from far (a/o) to near (e/i).
  - `word_sort`: pick two vowels, far or near.
  - `spell_word`: keep its letter levers, and take the words from the space.
- **Traps:**
  - word family ("-at: cat, hat") is a scope axis the curriculum names; read it in WS-0;
  - `make_word` is code-built, so it is probably left alone.

### 3. sound-swap: `addition`, `deletion`, `substitution`, `swap_build`
- **Today:** Gemini picks the word pairs. Both words must be in `COMMON_WORDS` (890), and the phonemes are
  trusted. The tier sets the position (beginning, end, middle), but that is only logged, never enforced.
- **Space:** port the lab's swap-add, swap-delete and swap-substitute, which compute pairs over the library's
  phonemes. Position becomes a real feature (first < last < middle; a sound in a cluster is hardest).
- **Traps:**
  - leave out plural and past-tense pairs (*hat → hats*): that is a morphology task, not a phoneme task;
  - the lab found that *app, whoa* and *hon* need the teachable filter, which the library now applies.

### 4. rhyme-studio: `recognition`, `identification`, `production`, `collection`, `pair_build`
- **Today:** at K, Gemini chooses from `K_RHYME_FAMILIES` (12 families, about 50 words). G1-2 pick freely.
  Rhyme is checked by spelling only (`holdsRhymeIntegrity`).
- **Space:** the lab's rhyme-recognize and rhyme-identify sets. A rhyme is a shared rime from the phonemes, so
  *bear/pear* and *eight/late* count, and *bow/cow* does not.
  - Difficulty: a wrong option that shares the first sound (cat/cap) is hardest, one that shares the vowel is
    next, and an unrelated one is easiest.
  - `production` gets its accepted-answer list in code: every familiar word with the same rime. This is a
    better judge key than the model's.
- **Traps:**
  - spelled rhymes that do not rhyme (*bow/cow*);
  - near-rhymes;
  - `pair_build` is code-built.

### 5. syllable-clapper: `count_parts`, `blend_syllables`, `delete_compound`, `build_parts`
- **Today:** Gemini picks the words and splits them into parts. There is a deny-list of about 60 words whose
  syllable count varies by accent. The band hint is never enforced.
- **Space:**
  - the count comes from CMU vowel phonemes;
  - leave out any word whose CMU pronunciations disagree on the count, which replaces the hand deny-list;
  - compounds come from library splits (cow + boy);
  - features: 1 < 2 compound < 2 plain < 3 < 4.
- **Trap:** non-compound splits (ba-by, but-ter-fly) need hyphenation patterns, and the library has none.
  Until they exist, `blend_syllables` is compounds only. The lab found only 15 K compound items, too few for
  three tiers.

### 6. letter-sound-link: `see_hear`, `hear_see`, `keyword_match`
- **Today:** the letters come from a private group table. The sounds and keywords come from code tables
  (`LETTER_SOUNDS`, `LETTER_KEYWORDS`). The tiers change scaffolding only.
- **Space:** the items are letters, so build a letter space next to the word spaces.
  - Difficulty: a letter whose name starts with its sound (b, d, t) is easy, one whose name ends with it
    (f, m, s) is medium, and one with no name cue (h, w, y), two sounds (c, g) or a short vowel is hard.
    Wrong letters that look alike (b/d) or sound alike (m/n, e/i) add difficulty.
  - The focus letters come from the WS-0 scope.
  - For `keyword_match`, the library supplies keyword pictures. Prefer a single-consonant start, one syllable
    and a K word.
- **Trap:** the library has no K picture word for short i, y or x (and only 1-2 for o, u, v and z), so keep
  `LETTER_KEYWORDS` for those letters.

### 7. word-workout: `real_vs_nonsense`, `picture_match`, `word_chains`, `read_inflected`, `read_compound`, `choose_in_context`, `sentence_reading`
- **Today:** Gemini writes the first four modes, and real-vs-nonsense is trusted. The three code-table modes
  come from `wordWorkoutEarlyDecoding.ts`.
- **Space:**
  - `real_vs_nonsense` uses the lab's pairs: far, one consonant different, or (hardest) only the vowel
    different. The nonsense word is checked to be no real word, name or homophone. The curriculum's own
    example "keg" is a real word.
  - `picture_match` uses decodable, pictured words.
  - `word_chains` is a path search over decodable words that differ by one letter.
  - The sentence modes are the model band: verdict "not a fit".

### 8. letter-spotter: `name_it`, `find_it`, `match_it`
- **Today:** the wrong options already become look-alikes by tier (b/d/p/q), and code rebuilds the grid. That
  is probably "measured and left alone" for `find_it` and `match_it`.
- **Space:** `name_it`'s key word comes from the library (it starts with the letter's sound and appears once
  in the sentence). The sentence stays model-written.

### 9. picture-vocabulary and word-sorter (after WS-R)
- **picture-vocabulary** (`receptive_match`, `naming`, `association`, `opposite`, `pair_build`,
  `sentence_frame`, `gradable_scale`):
  - `receptive_match` and `naming` can use library words with fitting pictures; a wrong card from a near
    category is harder.
  - `association`, `opposite` and `gradable_scale` need WS-R.
  - `sentence_frame` is the model band.
- **word-sorter** (`binary_sort`, `ternary_sort`, `match_pairs`):
  - category sorts use the library's `category`. Near categories (food/drink, toy/sport) are harder.
  - Phonics sorts (by vowel or first sound) use the phonemes.
  - `match_pairs` needs WS-R.
- **WS-R** (needs the user): a curated relation table of opposites, goes-with pairs and graded scales. No
  public source covers K. `PAIR_PICTURES` (40 entries) and picture-vocabulary's validated pools are the seed.
  Review it like the ratings (a review page), then check it in next to the lexicon.

### 10. word-flip (G1 inflection modes)
Bases come from the library, and the answers already come from code rules (`deriveWordFlipAnswer`).
Difficulty: regular -s < -es < y→ies < irregular. Lower priority: G1 only.

### Not a fit for a word space (verdicts to confirm, not rebuild)
- letter-workshop: already code-built by stroke complexity.
- decodable-reader, story-talk, story-bridge, story-ribbon, oral-sentence-studio and you-and-me: prose and
  stories, the model band. A later slice can constrain decodable-reader's words with `decodableWords`.
- interactive-book `read-focus-word`: its focus words could come from the decode hopper later.

## Rules that carry over from the pilot

- **Gate:** the word-space path runs only with `ctx.supportTier` set, inside the space's grade range, and
  without `ctx.remediationFocus`. Everything else keeps the model path, unchanged.
- **Session sets:** use one `used` set and one `heard` set per session. A mode that cannot fill its slots
  takes the model path; never mix the two paths within one mode.
- **Gates in tests:** every space item goes through the primitive's own build gates in a unit test, and every
  answer key is re-derived from `phones`.
- **Contract:** add a requirement for the space path, and narrow any "the tier never changes the content"
  requirement to the model path, with the before/after numbers in the changelog.
- **Tester:** add the primitive to `takesDifficulty` in `LanguageArtsPrimitivesTester.tsx`, so the tiers can
  be checked in the browser.
- **No Live run** unless the change alters what the tutor says. Changing words inside an unchanged payload
  shape does not.
- **Decisions for the user:** report any scope change that is a pedagogical call, such as segment counting
  2-4 at K, and stop for a ruling instead of shipping it silently.

## Library upkeep

- **More review:** the review page (https://claude.ai/artifact/HXUusXVu2zBxzBz2oSkawY) saves to its `review`
  collection. Read it with `ArtifactData list`, regenerate `scripts/word-space-lab/review-overrides.json`,
  then run `build-lexicon.mjs`. So far 99 words are reviewed and 39 changed, all moved to a later grade. The
  rater is generous on longer words, so review the "Needs a look" view first.
- **New words:** add them to the sources or ratings, never by hand-editing `lexicon.json`.
- **Licenses:** never write a share-alike source's data, such as frequency ranks, into the lexicon. Keep
  `NOTICE` current.
