# di-spoken-practice: failure inventory and lever table (2026-10-03)

**DRAFT — awaiting user confirmation.** `/add-support-tiers` Phases 1-2, DI family 4 of 10. Nothing is built.
Rulings carried over (2026-10-02): DI gets in-item levers; DI's correction is a parallel-item model (a different
item, solved, beside the child's; "My turn" on the model, then back to the child's item). The child answers out
loud; no lever turns the answer into a tap or a choice.

This pack is content-generic: the generator writes each item's stimulus, ask and key per objective. Code knows the
structure of only two modes (count_and_say: an emoji and a count; compare_choice: two things and a closed word
menu). That decides most of the table: a lever needs a structure code can build and leak-check.

## explain_concept: in scope

`concept_statement` was **benched and passed** on 2026-09-07 (0/32 false affirmations, paraphrase 8/8;
repo-root `qa/di-bench/run-2026-09-07-concept-statement.md`, memory `project_di-spoken-practice-explain-concept`). "Benched"
there means the judge bench was run on it, not that the mode was shelved. The mode is shipped and reachable by the
manifest, so it is in scope. It is in the DI class gate's mode count.

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` and `qa/misconception` have no di-spoken-practice entries.
Synthetic = the `spoken_miss` ids from `spokenPracticeSpokenMisses` (`diSpokenPracticeWorkspace.ts`), named 4/4
on both saved payloads in the 09-29 sweep, plus the explain bench probes (read-back, negated keyword, bare name).
Documented = catalog `commonStruggles` (three patterns), the generated `signatureError` per item, and the refusals
written into `spokenPracticeKey` for explain_concept. There is no `docs/contracts/di-spoken-practice.md` yet.
Saved payloads exist for **count_and_say and compare_choice only**; read_aloud, say_answer and explain_concept
have none.

**Miss lists:** the catalog has them for count_and_say and compare_choice only (di.ts:895). read_aloud,
say_answer and explain_concept have **none** (the catalog comment: no distractor recorded; judged on meaning).
Proposed ids are below; adding them is build work.

| Mode (β) | Failure | Class |
|---|---|---|
| count_and_say (1.5) | skips a number while counting aloud (`skipped_a_number`) | synthetic |
| count_and_say | off by one or more (`one_short`, `one_over`, `short_by_more`, `over_by_more`) | synthetic |
| compare_choice (2.0) | says the other menu word (`other_menu_word`) | synthetic |
| compare_choice | says "same" when the pair differs (`said_same`) | synthetic |
| compare_choice | names a picture instead of a menu word (`said_thing_name`) | synthetic + documented ("says the stimulus back") |
| compare_choice | judges by the pictures, which are drawn the same size (both emoji at one size; the answer is world knowledge) | inferred |
| read_aloud (2.5) | reads a different word or numeral (proposed `misread`) | inferred + documented (`signatureError` when the generator writes one) |
| read_aloud | says the sounds and does not blend them, or says letter names (proposed `sounds_not_blended`, `letter_names`) | inferred |
| read_aloud | drops or swaps a word on a 2-3 word item (proposed `word_dropped`) | inferred |
| say_answer (3.0) | the item's generated wrong-answer-that-sounds-right (proposed `signature_error`) | documented (per item, when `signatureError` is non-empty) |
| say_answer | says the stimulus back (proposed `said_stimulus`) | documented (`commonStruggles`) |
| say_answer | another wrong answer | inferred; no observable pattern beyond "not the key" |
| explain_concept (4.0) | reads the instance back (proposed `read_back`) | synthetic (bench probe) + documented (the key's refusal) |
| explain_concept | names what is shown, or a bare number (proposed `named_only`, `bare_number`) | synthetic + documented |
| explain_concept | the anchor words inside the opposite idea (proposed `opposite_idea`) | synthetic (negated-keyword probes) |
| all | stays silent; answers a different question | documented; no lever (the tutor waits or re-asks) |

Content: the two saved payloads are clean (J sweep 09-29). Explain fresh-draw yield is ~60% (memory), a supply
issue, not broken content.

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| count_and_say | skipped_a_number, one_short, one_over, short_by_more, over_by_more | `model_count`: a small card with a DIFFERENT picture in a different count, each picture ringed in order as the tutor touches it; the tutor says the total: "My turn: five hearts" | help | both | Model emoji is not the item's; model count is not within 1 of the item's count and not the count of a session item still to come; the tutor says only the total, never a counting walk that passes the item's count; no numeral drawn | no | picker + leak check, model card |
| count_and_say | skipped_a_number, one_short, one_over | `touch_marks`: each picture in the child's group can be tapped; a tapped picture gets a ring. No numbers, no order | help | shown | Marks only what the child taps; never a numeral or an order; the scene fact gives no count of rings | no (pictures are plain spans) | new capability: tappable pictures |
| count_and_say | short_by_more, over_by_more | `five_rows`: the same pictures laid out in rows of five | help | shown | Same pictures, none added or removed, no numeral; only when the count is above five | no (flex-wrap) | render |
| count_and_say | skipped_a_number, off-by | `smaller_group`: an ungraded group of the same picture, about half as many (at least 2); then the full group | simplify | both | Practice count is not the item's count and, where one is free, not another session item's count; only when the count is 4 or more | no | runtime builder (code writes the ask: "Count the X out loud. How many X are there?") |
| compare_choice | other_menu_word, said_same, said_thing_name | `word_model`: a code-owned model pair for the menu's dimension (a long and a short bar for longer/shorter, a tall and a short tower for taller/shorter, a tipped balance for heavier/lighter, a big and a small circle for bigger/smaller, a group of five and of two dots for more/fewer). The tutor says one sentence per menu word on the model: "My turn: this bar is longer. This bar is shorter." | help | both | Fixed per menu, the same for every item, so it carries nothing about which thing on the item wins; it says every menu word once, in a fixed order; it never names or points at the item's things; refused for a menu with no model in the table | no | model table per dimension + card render |
| compare_choice | other_menu_word, said_same | `far_pair`: an ungraded pair from a code-owned table of far-apart pairs for the menu's dimension (an ant and a bus for longer/shorter), with the OTHER answer word; then the full item | simplify | both | Neither thing is one of the item's or another session item's things; the practice answer is not the item's answer (a practice "longer" would be repeated on a "longer" item); the code-written ask names both things and reads the whole menu (`findChoiceMenuDefects` passes); not offered when the item's answer is "same" | no | pair table per dimension + runtime builder |
| read_aloud | misread, sounds_not_blended, letter_names, word_dropped | `model_read`: a card with a DIFFERENT printed word (or numeral) read aloud: "My turn: this says sun" | help | both | Model word is not the item's word, shares no rime with it and differs from it in at least two letters (no "hat" beside "cat"); a model numeral is not the item's and shares no digit with it; not a word of any session item | no | picker from a code pool (`decodablePracticeLines.ts` words; numerals by code) + leak check |
| read_aloud | sounds_not_blended, letter_names, misread | `sound_dots`: a dot under each grapheme of the child's printed word (the read-aloud-studio lever) | help | shown | Dots only; no sound, no letter name, no audio of the word | no | render (grapheme split for words; one dot per digit for numerals) |
| read_aloud | word_dropped | `word_underline`: one underline under each printed word, left to right | help | shown | Underlines only; only on items of 2 or more words | no | render (the shared kit overlay) |
| read_aloud | misread, sounds_not_blended | `short_word`: an ungraded shorter decodable word (or a one-digit numeral) from the code pool; then the full item | simplify | both | Not the item's word, no shared word with the session, and the same leak rule as `model_read`; refused when the item is already one CVC word or one digit | no (pool exists in literacy) | runtime builder |
| say_answer | signature_error, said_stimulus | `model_answer`: a card with a DIFFERENT item of the same skill, solved, taken from the generator's spare items (see build notes). The tutor says "My turn" on it, then asks the child's item | help | both (a picture stimulus is shown; text and spoken stimuli are voiced) | Model's answer and alternates are not the item's answer or alternates, and not any session item's answer; the model's stimulus is not any session item's stimulus; the item's answer appears nowhere in the model's stimulus, ask or answer; checked in code at generation and again at mount | no; needs a spare item the generator does not make today | generator change (ask count + 1, keep a gated spare) + leak check + card |
| explain_concept | read_back, named_only, bare_number, opposite_idea | `model_explain`: a card with a DIFFERENT instance and its concept said in one sentence ("My turn: red, blue, red, blue. It goes red then blue, again and again."), from the generator's spare survivors | help | both | The model's `conceptStatement` and anchors must differ from the item's: no shared anchor, and the statements must not match after normalising. **When every item in the session has the same concept (the equal-sign objective), no model passes and the lever is not offered.** Model instance is not any session item's instance | no; the spare survivors exist (explain asks count + 2) but are dropped | keep spares + leak check + card |

### Rejected and no-lever rows

- **compare_choice in-item help** (the item's two pictures redrawn to scale, a ruler under them, the bigger one
  glowing). The relation is the answer, and each one shows it. compare_choice gets only `word_model` (outside the
  item) and `far_pair`.
- **compare_choice model with one word** ("My turn: the rope is longer"). Saying only the item's answer word
  hands it over; saying only the other word repeats a common wrong answer and sounds like agreement after the
  child said it (the dice replay found this). `word_model` says every menu word, fixed, on its own pair.
- **count_and_say model counted aloud.** A walk to a model count above the item's count says the item's number.
  The model says only its total; its rings show the touching.
- **say_answer in-item help: no lever.** The pack knows nothing about the structure of a say_answer item (a
  printed fact, a picture to name, a spoken question); any help would be written by an LLM per item and checked by
  an LLM. The model is the only lever. Arithmetic say_answer items belong in di-math-facts, which has levers.
- **say_answer simplify: no lever.** No code builder can make a simpler item of unknown content, and the ruling
  forbids an LLM at runtime. (A generation-time easier sibling is possible; see open questions.)
- **explain_concept in-item help: no lever.** The meaning is the answer; any mark on the instance (a bracket
  round the repeating unit, the equal sign glowing) points at it.
- **explain_concept simplify: no lever.** Same reason as say_answer; a simpler instance of a concept is LLM
  content.
- **explain_concept model for a single-concept session: no lever** (stated in the row). Every instance of "the
  equal sign means both sides are the same" has the same answer.
- **Silence, a different question:** no lever; the tutor waits or re-asks.

### Miss lists to add (build work)

| Mode | Proposed ids | Source of the pattern |
|---|---|---|
| read_aloud | `misread` (a different word or numeral), `sounds_not_blended`, `letter_names`, `word_dropped` (2-3 word items) | the printed text; `signatureError` when present feeds `misread` |
| say_answer | `signature_error` (only when `signatureError` is non-empty), `said_stimulus` | the generated `signatureError`; `stimulusText` |
| explain_concept | `read_back`, `named_only`, `bare_number`, `opposite_idea` | the refusals already in `spokenPracticeKey` |

Each goes into `spokenPracticeSpokenMisses` and the catalog `missLists` in the same change. explain_concept's
misses must not change judging: the bench gate (0 false affirmations) is re-run only if the key text changes.

## Phase 6: starting positions

**There is no tier today.** `gemini-di-spoken-practice.ts` never reads `config.difficulty`, and items carry no
`supportTier`. Under the dice rule (no tier = easy) every item would start with its model on screen, so a hard
lesson would never be cold. The slice stamps `supportTier` per item from `config.difficulty` (the
`normalizeSupportTier` harness), touching nothing else in generation.

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy, or no tier | the mode's model lever (`model_count`, `word_model`, `model_read`, `model_answer`, `model_explain`) where one passes the leak rule |
| medium | none |
| hard | none |

The catalog guidance gets the di-math-facts sentences ("Never model this item; your model is the model lever, a
different item solved beside it. The support fact says where levers start.") and `levers: true`.

## Build notes

- **Shared stage:** nothing new. The levers object must be built in a `useMemo` over the session `items` (the
  "not a session item" rules need them), not as a module constant.
- **Main cost: the generator spares.** `model_answer` and `model_explain` need a different item of the same
  objective, which only the generator can write. Ask count + 1 on say_answer (count + 2 already on explain), run
  the same gates, and ship the surplus as a session-level `models` field on `DiSpokenPracticeData`, never as
  items. Code then picks, per item, the first spare that passes the leak rule. This is a generation-time LLM
  call, not a runtime one.
- **Code-owned tables:** `word_model` and `far_pair` need a small table per comparison dimension (the menu's
  words → a model drawing and 4-6 far pairs with emoji). A menu outside the table gets neither lever; say so in
  the lever's refusal.
- **Missing payloads:** make `w1-payloads/di-spoken-practice.read_aloud.json`, `.say_answer.json` and
  `.explain_concept.json` (one Flash generation each; explain needs a per-instance concept such as a repeating
  pattern, plus one equal-sign payload to test the refusal).
- **Pre-readers:** count_and_say and compare_choice are K; their models are pictures with the words voiced.
  read_aloud is a reading task, so its printed model is the task itself and the voice carries it.
- **Class gate:** no Live run for this family; the DI class Live pair waits until all DI modes have levers.

## Open questions for the user

1. **compare_choice model:** say every menu word on a fixed model pair (proposed), or no model at all for this mode?
2. **Generation-time easier sibling** for say_answer and explain_concept simplify: the generator writes one
   easier item per session, code leak-checks it, and the runtime swaps it in with no LLM call. Allowed, or do
   these two modes stay without simplify?
