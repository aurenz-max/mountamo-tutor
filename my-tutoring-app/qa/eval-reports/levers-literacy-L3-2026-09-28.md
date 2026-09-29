# Literacy levers, class L3: decoding and reading (2026-09-28)

Handoff 22 L3, `/add-support-tiers`. Four primitives got levers through one shared print overlay in the Lumina kit. phonics-blender got a draft inventory and lever table only; its levers wait for a user decision (below). Gate: vitest only, no Live runs.

## What was built

**Shared, in the kit:** `ui/LuminaPrintSupport.tsx` + `ui/printSupport.ts`. It draws a printed word or line with the marks a lever pulled:
- `sound_dots`: a dot under each grapheme, one dot per digraph.
- `tracking_underline`: one underline segment per word and a left-to-right arrow.
- `chunk_divider`: a bar inside one word.
- `changed_letter`: the one letter that changed, lit.

The overlay plays no audio, and the printed letters never change (tested). `graphemes`/`dotsLeak` moved here from `wordWorkoutLevers.ts`, which re-exports them for phoneme-explorer.

**Shared practice pool:** `literacy/decodablePracticeLines.ts`, 15 short decodable lines (a name, a short-vowel verb, a short-vowel word). `practiceLine` returns the first line that shares no word with what the session prints (R3). Every simplify item in L3 is built from this pool or from an existing code pool, never by the LLM.

| Primitive · mode | Help (all `shown`, nothing voiced) | Simplify (ungraded, returns to the full item) |
|---|---|---|
| word-workout real_vs_nonsense | `sound_dots` under both words | none (the draft had none) |
| word-workout word_chains | `changed_letter` (only where the tier hid it), `sound_dots` | `short_chain`: two new CVC words, first letter changes, no session word or rime |
| word-workout read_inflected / read_compound | `chunk_divider`, refused until a first wrong try (contract R12) | `easier_ending`: -ing/-ed → a pool -s word in the lesson's vowels; compound has none |
| word-workout sentence_reading | `tracking_underline` on the read; `question_word_icon` (who 👤 / what 📦 / where 📍) on the question | `three_word_sentence` from the pool |
| word-workout choose_in_context | `sound_dots` on the lit near word | none; `wrong_fit` has no lever by decision |
| decodable-reader decode modes | `tracking_underline`, `sound_dots` on the read line; `story_region` on a one-word answer, only after a wrong try: the answer's sentence and its neighbour, whole, nothing marked | `short_line` from the pool, no story word |
| read-aloud-studio accuracy, dialogue | `tracking_underline`, `sound_dots` | `short_line`; dialogue keeps the speaker |
| read-aloud-studio expression | `tracking_underline`, `sound_dots` on the first read and the reread; nothing on the phrase plan | none: a practice line would skip the plan and the model |
| interactive-book read-focus-word | `sound_dots` under the glowing word | `cvc_focus`: a pool sentence, its CVC word glowing after a lead of two or more words, no book word; only when the glowing word is not CVC |

**Catalog** (`literacy.ts`):
- `levers: true` is set on all four primitives, so `LEVER_DOCTRINE` now reaches their guidance. This also fixes it for word-workout picture_match and interactive-book find-feature (the L1 defect in the brief).
- Three guidances were cut to stay under the 2000-char cap: word-workout 2095 → ≤2000, interactive-book, and decodable-reader 2040 → ≤2000. Each cut keeps every rule; only the wording is shorter.
- Every spoken miss is declared and listed `unanswered` until spoken misses land (handoff 20 Part B).

**Not built, and why:**
- decodable-reader `two_choices`: fewer choices on the same question repeats the item (R3), and a new question would spend a later item.
- read-along `picture_panels`: needs pictures that do not exist.
- Phase 6 starting positions from `config.difficulty`: not done for any L3 lever, so every lever starts released.

## Leak rules held in code

| Rule | Test |
|---|---|
| No audio of unread print | Each mounted test asserts `seam.send` is unchanged by a pull, and each lever's `does` says nothing is said (word-workout L3 unit test). |
| Print unchanged | The overlay keeps each word's `textContent` (kit test; decodable-reader and read-aloud mounted tests). |
| R3: no item or session word in practice | `spokenPracticeLeak`, `shortLineLeak` (decodable, read-aloud), `bookWords` (interactive-book), and "every pool line: a session that prints it still gets another line". |
| R2: same act | Every practice item keeps its kind and mode. Expression has no practice line. |
| Question icon names the kind, never the word | Mounted: the question row does not contain the answer. |
| Story region: whole sentences only | `regionLeak`; mounted: two `<p>` sentences with no inner marks, and the pull is refused before a try. |
| Chunks only after a cold try | Mounted: `chunk_divider` refused before a wrong answer. |

## Gate results

- **Lever vitest:**
  - word-workout: 47 (lever unit tests plus mounted pulls, L1 and L3)
  - decodable-reader: 10
  - read-aloud-studio: 10
  - interactive-book: 6
  - kit overlay: 7
- **Suites:** literacy + catalog + live-activity: 3564 passed, 1 failed. The failure is `TesterLeverBench.test.tsx` (number-line). It is the handoff 21 session's untracked file and touches no literacy code.
- **Dry journey sweep (J1–J9):** 243 passed.
- **`activityContract` (2000-char guidance cap):** 75/75.
- **Typecheck:** `typecheck:lumina` 0; full tsc 773, equal to the baseline.
- **Live:** none run (handoff 20 Part D: no Live run for a lever-set gate). The per-class Live pair is still owed on the same unresolved ruling as L1 and L2.

**Code vs tests:**
- New production code: about 340 lines (kit overlay, practice pool, two new lever modules).
- Edits to existing modules: about 400 lines (the word-workout and interactive-book lever modules, four components, catalog).
- Tests: about 600 lines.

## Evidence classes

Every L3 failure is **documented** (catalog `commonStruggles`, judging contracts, harness `signatureWrong`) or **inferred**. There is no observed-real evidence, and no observed-synthetic evidence beyond the harness's scripted wrong answers. No spoken miss is emitted yet, so which lever comes next is help-first until handoff 20 Part B.

## phonics-blender: draft failure inventory and lever table (not built)

This table is new: the 09-27 literacy draft did not inventory phonics-blender. The skill requires a user confirmation before building (Phase 2), so these levers are not built.

phonics-blender today is purely verbal (contract C3). The learner sees the letters and says the whole word. Tapping a letter asks the tutor for its sound. The support tier sets the letter row's segmentation (`showBlendPreview` full / word / none). One mode family, four modes (cvc 1.5, cvce_blend, digraph, advanced); every answer is the word, spoken.

| Mode | Failure (class) | Proposed miss | Lever | Kind | Carrier | Leak rule | Exists today? | Cost |
|---|---|---|---|---|---|---|---|---|
| all | Says the separate sounds and never runs them together (documented: `commonStruggles`, judging contract) | `sounds_no_word` | `blend_slide`: the letter tiles slide together into one joined row. The tutor may model a continuous blend on a pictured model word outside the session | help | both | The item's letters only move, never voiced as a word; the model word is not a session word | Partial: segmentation is a generation flag (`showBlendPreview`), not pullable | S |
| all | Says a close, different word, cap for cat (documented) | `near_word` | `sound_dots` from the kit under each grapheme, left to right | help | shown | Visual only | No (the kit overlay now exists) | S |
| all | Names the letters, "see-ay-tee" (documented) | `letter_names` | `name_vs_sound_model`: one letter NOT in the word, with its name and its sound shown side by side; the tutor says both | help | both | The letter is outside the item | No | S |
| cvce_blend, digraph, advanced | Reads the vowel short, or splits a digraph (inferred) | `short_vowel`, `split_digraph` | `sound_dots` (a digraph gets one dot) plus a new mark: an arc from the silent e to its vowel | help | shown | Marks only | No: the arc is a new overlay mark | M |
| cvce_blend, digraph, advanced | Cannot yet blend a pattern word | (any) | `cvc_word`: a pool CVC word with the same vowel letter, not in the session | simplify | shown | R3 no session word; still read-the-letters-and-say (R2) | No | S |
| cvc | Cannot yet blend three sounds | (any) | `two_sound_word`: a VC word (at, up, in) from a code pool | simplify | shown | R3; R2 | No | S |
| all | Goes quiet after "what word?" (documented) | none | no lever: the catalog's move is to say it together once, which is the tutor's begin_help, not a screen change | — | — | — | — | — |

**Decision owed:** does the `hard` tier's joined row (`showBlendPreview: 'none'`, "do not split it into sounds for the learner") let `sound_dots` re-segment the word when pulled? The skill says a tier is only a starting position, so the proposal is yes. The phonics-blender contract (support-tier note) says the tier withdraws the segmentation on purpose.

## Queued

- phonics-blender levers: build the table above after a user OK (`/add-support-tiers`, handoff 22 L3).
- decodable-reader and read-aloud-studio have no contract doc (handoff B1 was not run for them): `/primitive-contract`.
- L3 starting positions from `config.difficulty` (Phase 6): `/add-support-tiers`.
- Remaining L1 `levers: true`: cvc-speller, letter-sound-link (2212 chars) and letter-spotter. `/add-live-tutor-tools` (trim, then set).
- `TesterLeverBench.test.tsx` "retried item on the session scale" fails in the working tree. It belongs to handoff 21.

HUMAN-CHECKS #174: a browser sitting on the four L3 primitives.
