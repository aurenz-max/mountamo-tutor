# di-sentence-reading: failure inventory and lever table (2026-10-03)

**BUILT 2026-10-03** (rulings R1-R10 as recommended): `qa/eval-reports/di-sentence-reading-levers-2026-10-03.md`.
Rulings carried over (2026-10-02): DI gets in-item levers; DI's correction is a parallel-item model (a
different item, solved, beside the learner's; never the learner's item, its answer, or one step from it);
DI is spoken-first, so no lever turns the read into a tap or a choice.

## What makes this pack different

The answer IS the stimulus: the printed sentence is on screen and the child reads it aloud. So any voice
on the item is the answer. Reading the child's sentence, or any word of it, before they read it hands the
read over and turns decoding into repetition. Help on the item can only be marks that read nothing. The
voice carries the model on a different sentence only.

**Finding: today's teaching text conflicts with the parallel-item ruling.** The same conflict
di-math-facts had with its easy/medium `support` facts:
- Catalog `teachingWorkspace.guidance`: "Modeling it once before the child reads — 'Listen: ...' — is
  legitimate teaching" (this is the bound path's guidance; the tutor reads it).
- The L3 tier design (`qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`): easy = "Listen: X"
  + "Together: X", medium = "Listen: X", hard = cold. The tier reaches the tutor as the raw `supportTier`
  scene fact; the guidance line above licenses the model.
- The domain and teaching docblocks repeat it ("the tutor legitimately MODELS it aloud at easy/medium").
- Scripted-path text, unused on the bound path (`tutoring: null`) but stale: aiDirective "EVERY correction
  re-reads the whole sentence", `scaffoldingLevels.level2` "Read the whole sentence, then ask for one
  retry", and the near-neighbour `commonStruggles` response.
The slice rewrites the guidance and docblocks in the same change. The affirmation may still restate the
sentence after credit (the read is done by then).

## Phase 1: failure inventory

Evidence: **no observed-real.** Observed-synthetic: the 2026-07-25 standing-gate bench sitting (two
deliberate one-word omissions, both corrected and the retries affirmed) and the 09-22/09-26 JEV probes
(`qa/tutor-reports/di-sentence-reading-jev-*.json`). Every live sitting since was all-correct, so the miss
path above the bench is unmeasured (HUMAN-CHECKS #50). Documented: catalog `commonStruggles` (five), the
`assignmentFor` success condition, and the generator's remediation moves (`drops_function_word`,
`near_neighbor_word`, `word_order_or_addition`, `gemini-di-sentence-reading.ts:350`). `logs/demonstrations`
has no entries for this id. No `docs/contracts/di-sentence-reading.md` (Phase 3 derives it).

Miss ids in code: `diSentenceSpokenMisses` → `lineReadingMisses` gives `word_skip` and `word_swap` for all
four modes, and the catalog declares them (`sameMisses`, `di.ts:730`). The pack does have a miss list; it
lacks ids for an added word and for words out of order.

Saved payloads: `w1-payloads/di-sentence-reading.read_sentence.json` only (no tier; 4 items, two of them 3
words). **decodable_sentence, sentence_review and sight_phrase_sentence have none.**

| Mode (β) | Failure | Class |
|---|---|---|
| all four | leaves a word out, usually a small one ("the", "a", "is") (`word_skip`) | synthetic (bench) + documented |
| all four | reads a word as a different real word, a near neighbour ("hen" for "pen") (`word_swap`) | synthetic + documented |
| all four | adds a word | documented (`assignmentFor`, remediation move); **no miss id** |
| all four | reads two words out of order | documented (remediation move); no miss id, lands as `word_swap` at best |
| decodable_sentence, read_sentence, sentence_review | sounds a CVC word out and never says it as one word | inferred (`sounds_no_word` exists at word level, not at line level) |
| sight_phrase_sentence | reads an irregular word as its look-alike ("saw" for "was", "then" for "the") | documented (`SIGHT_LOOKALIKES`); lands as `word_swap` |
| all four | pauses mid-sentence, so the read sounds finished | documented; no lever (a waiting problem, not a representation problem) |
| all four | self-corrects, or reads slowly word by word | documented; **not a failure**: no lever may fire on it |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all four | word_skip, word_swap (and word_added once named) | `model_sentence`: a small card beside the child's sentence with a DIFFERENT sentence of the same pool (decodable for decodable_sentence, sight-heavy for sight_phrase_sentence, any for read/review), printed. The tutor reads it as "My turn", one word at a time, then asks for the child's sentence | help | both (the voice carries it for a pre-reader; the card shows what was read) | Shares no word with the item (case and punctuation ignored), so the tutor reads no word of the child's sentence; is not a sentence of the session; prefers one sharing no word with any session sentence when one exists. `does` forbids reading the child's sentence or any word of it, and forbids "so yours says…" | no (the menu lives in the generator; the stage has one object) | menu to a pure module, picker + leak check, model card render |
| all four | word_skip (and word_added once named) | `tracking_underline`: an underline under each word with a left-to-right arrow (`LuminaPrintSupport`) | help | shown | Marks every word the same; never reads, numbers or singles out a word | no on this stage; the kit overlay exists (decodable-reader, read-aloud-studio, word-workout use it) | render through the kit |
| decodable_sentence, read_sentence, sentence_review | word_swap | `sound_dots`: a dot under each grapheme of each CVC word; no dots under irregular words | help | shown | Dots only; letters unchanged; nothing played or said; never a dot under an irregular word ("the", "see", "you"), since dots there teach sounding out a word that cannot be sounded out. Refused when the item has no CVC word ("Here it is.") | no; the kit dots every word of a line | kit prop (per-word dots filter) + render |
| decodable_sentence, read_sentence, sentence_review | word_skip, word_swap | `short_line`: an ungraded 3-word decodable line from the shared practice pool; the child reads it, then the full sentence returns. Refused on a 3-word item (the mode floor, `MIN_SENTENCE_WORDS`) | simplify | shown (the child reads it; the tutor does not read it first) | R3 as in literacy: shares no word with any session sentence (`practiceLineLeak`); never the item. For decodable_sentence, only pool lines whose content words are all CVC | builder exists at runtime (`decodablePracticeLines.practiceLine`, used by decodable-reader, read-aloud-studio, word-workout) | wiring + a decodable-only filter |
| sight_phrase_sentence | word_skip, word_swap | `short_sight_line`: an ungraded sight-heavy menu sentence one band shorter (3-4 words), keeping two or more irregular words. Refused on a 3-word item | simplify | shown | Shares no word with the item; is not a session sentence; keeps the mode floor (two or more irregular words, `sightHeavy`) | no | builder over the moved menu |

### Rejected and no-lever rows

- **The tutor reads the child's sentence first** (DISTAR "Listen" / "Together", and the correction re-read):
  it is the learner's own item read aloud, and the measured read becomes repetition. Replaced by
  `model_sentence` (see the finding above).
- **A picture beside the sentence before the read** (the item's emoji): the child guesses content words
  from the picture instead of decoding. The emoji is reward-only by contract.
- **Marking the word the child missed:** which word was skipped or swapped is the tutor's judgment from the
  audio, and `pull_lever` takes no argument, so code cannot draw it. If wanted, it is per-word `demonstrate`
  targets on the scene (a `/add-live-tutor-tools` change), not a lever.
- **One-word window** (all words masked but one, the child advances): answers the same misses as
  `tracking_underline` with a new interaction. Held back unless the underline measures short.
- **sight_phrase_sentence, `word_swap` on an irregular word:** no in-item help. Dots would teach sounding it
  out, and saying or picturing the word is the answer. `model_sentence` is its only help lever.
- **Pauses mid-sentence:** no lever; the tutor waits for the whole read.
- **Sounds a word out without blending (inferred):** no lever until a line-level miss id exists;
  `model_sentence` covers it by `when` text only.

## Phase 6: starting positions

Same as di-math-facts and di-dice-roll: easy (or no tier, which the domain already treats as easy) starts
with `model_sentence` on screen, not recorded as a pull; medium and hard start with none. This replaces the
L3 meaning of the tiers ("Listen + Together" / "Listen" / cold) with a parallel model at easy only. The L4
word-count bands (3-4 / 5-6 / 7-8) stay as they are.

## Build notes

- **Shared stage:** `DiTeachingStage` already has the `levers` prop and the practice item; nothing new
  there. The stimulus switches from plain text to `LuminaPrintSupport` when a lever is on (as
  `DecodableReader.tsx:451` does), and draws the model card.
- **Move the sentence menu.** `SENTENCE_MENU` and its pool flags (`decodable`, `sightHeavy`) live in
  `service/direct-instruction/gemini-di-sentence-reading.ts:218`. `model_sentence` and `short_sight_line`
  need them at runtime: move them to a pure module both import, generator behaviour unchanged. Unit test:
  every menu sentence, in each mode it can appear in, has a non-leaking model.
- **Kit change:** `LuminaPrintSupport` dots every word. Add a per-word dots filter (default: all words, so
  decodable-reader and read-aloud-studio are unchanged).
- **Practice pool fit:** several `PRACTICE_LINES` are not all-CVC ("Gus ran fast." has a blend; "Pam sips
  pop.", "Ken fixes vans.", "Val pets pups.", "Rob hugs Mom.", "Ted zips up." are inflected). The pack's
  constraints forbid blends, so decodable_sentence filters to all-CVC lines.
- **Missing miss ids:** `word_added` (and possibly `word_order`) in `lineReadingMisses`. That function is
  shared with decodable-reader and read-aloud-studio, so it is a class change: all three in one slice
  (`/add-live-tutor-tools` §5).
- **Missing payloads:** save decodable_sentence, sentence_review and sight_phrase_sentence (one Flash
  generation each, `save_payload.py`), so J9 and the replay cover every mode. The saved read_sentence
  payload has two 3-word items, on which both simplify levers are refused; that is correct, not a gap.
- **Catalog:** `levers: true`; rewrite the guidance's "Modeling it once ... is legitimate" line (under the
  2000-character cap); clean the stale scripted-path lines listed in the finding.
- **Affordance:** `reader: 'none'` was derived from the tutor modelling the sentence before the read. With
  that gone the child reads cold at every tier. The print is the objective, so the tag may still hold; it
  needs a decision (open question 3).

## Open questions for the user

1. Confirm the ruling removes "Listen" / "Together" on the child's own sentence at easy and medium, and the
   correction re-read, replacing them with `model_sentence`. This removes DISTAR's choral read from the pack.
2. sight_phrase_sentence simplify: the literacy R3 rule (practice shares no word with the whole session)
   cannot hold for sight sentences, which share "you", "can", "see" across items. Accept an item-scoped rule,
   or ship sight_phrase_sentence with no simplify lever.
3. Keep `reader: 'none'` once the tutor no longer reads the sentence first?
