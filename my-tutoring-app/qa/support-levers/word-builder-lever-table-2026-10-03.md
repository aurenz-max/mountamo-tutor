# word-builder: failure inventory and lever table (2026-10-03)

**DRAFT 2026-10-03**. `/add-support-tiers` Phases 1-2, literacy G2-6 family 2 of 4.
Rulings carried over: literacy leak rules (handoff 22): help on a production item acts on material outside the
session; never show the answer word in print before credit. Spoken answers stay spoken (R2): no lever turns the
word into a tap or a choice. Model levers fence the tutor in `does` (2026-10-03 memory: a model lever's `does`
forbids extending it to the item).

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` has no word-builder entries; `qa/misconception` has none;
there is no `service/**/*Remediation.ts` for it and no `docs/contracts/word-builder.md` (Phase 3 derives it).
Synthetic = the three `spoken_miss` ids from `wordBuilderSpokenMisses` (`wordBuilderWorkspace.ts`), named with 0
false positives on all four saved payloads in the 09-29 spoken-miss probe (`qa/tutor-reports/spoken-miss/wired-all-2026-09-29.log`
lines 905-922), plus the 08-16 Live DI runs (`qa/tutor-reports/word-builder-live-di-signature-*.md`), whose scripted
wrong answers were the first part said alone ("thermo", "micro", "atmo"). Documented = catalog `commonStruggles`
(five patterns) and the guidance's four "not yet it" cases. The `tutoring` block and `aiDirectives` describe the
retired DI runner (LA-14); the bound path gets `tutoring: null`, so they reach no tutor today (finding F5).

The catalog entry has ONE `teachingWorkspace` (literacy.ts:717-730); the second block that reads like one is the
retired `tutoring` frame. Every mode declares the same three misses (`sameMisses`, literacy.ts:728). All four modes
ask the same thing (the tutor says what a word means; the learner says the whole word, built from the printed board
of parts with meanings); they differ in part count and how bound the roots are.

| Mode (β) | Failure | Class |
|---|---|---|
| all | says only the root ("help" for unhelpful, "play" for playful) (`root_only`) | synthetic + documented |
| simple_affix (2.0), greek_latin (5.5) 2-part items | says only the other part ("tele", "thermo", "bio"): with Greek/Latin combining forms the generator types the first part `prefix`, so this is not `root_only` and **no miss names it** | synthetic (08-16 runs drove it as the signature wrong) |
| compound_affix (3.5), multi_morpheme (7.5), greek_latin 3-part | says a real word made from only some of the parts ("helpful" for unhelpful) (`part_missing`) | synthetic + documented |
| all | parts joined in another order ("fulplay", "scopetele") (`parts_out_of_order`) | synthetic + documented |
| all | says the parts one at a time and never joins them ("un... help... ful") | documented (commonStruggles 2, guidance "the parts never joined"); **no miss id** |
| all | builds a word with a board part that is not in the word: "helper" for teacher, "geosphere" for biosphere, "microscope" for telescope | inferred; the saved simple_affix and greek_latin payloads each carry one (F1, F2). **No miss id** |
| all | says a word that fits the clue but is not built from the board ("mean" for unkind, "argument" for disagreement): vocabulary recall instead of construction | inferred (the most likely real failure for a clue-to-word task); **no miss id** |
| all | stays silent after the clue | documented; no lever (the tutor waits; the model lever answers "does not know how to start") |
| all | mispronounces a long academic word that is otherwise right | documented risk in the pack docblock (longest `short_spoken_word` answers); a judging rule, not a failure |

Content is not broken on the four saved payloads (J1-J9 clean, 4/4 named per payload in today's sweep), so nothing
blocks measuring. Two clues invite a board-built wrong answer (F1, F2); they bias the evidence slightly but do not
corrupt it.

**`part_missing` is a dead entry on simple_affix.** `wordBuilderSpokenMisses` only emits it for 3+ parts, and every
simple_affix word has 2. J9 still asks for it to be answered. The table answers it anyway; the catalog list should
drop it for simple_affix in the build.

## Phase 2: lever table

All three levers apply to every mode. Mode differences are in the pools and the practice shape.

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all four | root_only, other_part_only, part_missing, parts_out_of_order, parts_not_joined, meaning_word | `part_slots`: under the clue, one empty box per part of the word, each labelled with its type (prefix / root / suffix), joined by "+" and an arrow to one blank word box. The board does not change | help | shown (G3-8 reads the labels; the tutor may say "three parts: a prefix, a root, a suffix") | `slotsLeak`: the frame carries only type labels, in order; equal-width boxes (no length cue); no part text, no meaning, no letter; no board card marked. The scene fact gives the count and types only | no (typed slots exist only in the post-credit reveal, `WordBuilder.tsx` reveal panel) | render: reuse the reveal's slot markup empty; scene fact. S |
| all four | parts_not_joined, root_only, other_part_only, part_missing, parts_out_of_order, meaning_word | `model_word`: a card beside the clue with a DIFFERENT word of the same shape (same part count and types), solved: its clue, its parts with meanings in the slot frame, then the joined word. The tutor says "My turn: able to be filled again. re, fill, able: refillable." Then back to the learner's clue | help | both | `modelLeak`: model word is no session word and neither contains nor sits inside one; no model part text equals a part of any session item (not only the current one); same tier pool as the mode (Greek/Latin model for greek_latin); off-board parts preferred, a board distractor only when no off-board model exists. `does` forbids saying which board card or which part of the learner's word matches a model part | no | pool module (about 10 words per tier and shape, each part ≥2 letters, parts concatenate exactly) + card render. M |
| simple_affix, compound_affix, multi_morpheme | swapped_part, meaning_word, root_only, other_part_only, part_missing | `small_board_word`: an ungraded practice item: a different word of the same tier and shape, on a practice board of its own parts plus ONE foil per slot type; then the full item returns | simplify | both (printed board, spoken clue and spoken answer, as the full item) | `practiceLeak`: practice word is no session word, no substring relation with one; no part shared with any session item; not the model word on screen; answer recomputed as the concatenation of its parts; clue does not contain the word; foils make no pool word in any slot order. Mode floor: same part count and types as the item | no (the board is the static `availableParts`) | builder from the same pool + `practice.board ?? availableParts` in render + practice assignment with its own misses. M |
| greek_latin | same as above | `small_board_word`; on a 3-part item the practice word is a 2-part Greek/Latin word (the mode allows 2-3 parts, so one part fewer stays in the mode) | simplify | both | as above; a 2-part practice only when the item has 3 parts | no | same builder, one shape rule |

### Proposed misses (build work)

Four failures with documented, synthetic or inferred evidence have no id, and the levers above answer them. Add them to
`SpokenWordBuilderMiss`, `wordBuilderSpokenMisses` and the catalog list in the same change:

| Id | Pattern (per item, code-built) | Examples | Modes |
|---|---|---|---|
| `parts_not_joined` | "The learner says the parts of X (un, help, ful) one at a time, with pauses, and never says the joined word." Must sit BEFORE `parts_out_of_order` in precedence | `un help ful` (parts joined by spaces) | all |
| `other_part_only` | "The learner's whole answer is the single word "tele": one part of X on its own, not its root." Emitted for every non-root part of 2+ letters | each non-root part | all (fires on 2-part items where `part_missing` cannot) |
| `swapped_part` | "The learner's answer uses a part from the board that is not in X, in place of one of X's parts (geo for bio)." | up to 2 code-built same-type substitutions from the board | all |
| `meaning_word` | "The learner says a word that fits the clue but is not built from the parts on the board." | none (pattern only; synonyms cannot be enumerated by code) | all |

`meaning_word` has no examples, so the spoken-miss probe can only check that it names nothing on the correct answer
and the existing non-answers. If its fit stays under the gate, list it as unanswered-by-decision for J9 rather than
drop the lever that answers it.

### Rejected and no-lever rows

- **Marking the item's parts on the board** (highlight, dim the rest, reorder the board around them). The parts in
  type order ARE the word: highlighting un, help, ful leaves nothing but saying them. Rejected for every mode.
- **Linking clue words to board cards** (underline "not" in the clue, draw a line to `un`; the tutor walking each
  part's meaning in order). The board prints one meaning per card, so each meaning picks out one card, and the walk
  in order names the parts in order. Rejected as a lever; the guidance currently allows the voiced form (R1).
- **Dimming distractors on the full item** (in-place choice removal). With one foil gone per slot, a 2-part word is
  close to a coin flip on the learner's own item, and it repeats the item (R3). The simplify lever reduces the board
  on a different word instead.
- **One part fewer on compound_affix and multi_morpheme** ("helpful" before "unhelpful"). The 2-part word is the
  item's own `part_missing` answer, and a 2-part item is simple_affix, a different mode. Rejected; only greek_latin
  allows one part fewer, on a different word.
- **The clue said again** (`Say the clue again`). It already exists as a button and repeats the question only; it
  changes nothing on screen. Not a lever.
- **A picture of the meaning.** G3-8 readers, abstract academic words (instruction, interruption): a picture would
  carry the clue, not the construction, and pictures for bound roots do not exist. Rejected.
- **Silence:** the model answers "does not know how to start". No other lever.

## Phase 6: starting positions

The generator has no tier harness (`gemini-word-builder.ts` takes only `intent` and `targetEvalMode`; `ctx.raw`
already spreads `difficulty` into its config). Add `normalizeSupportTier` and stamp `supportTier` on the data. The
mode is root-level (`complexityLevel`), so a session-level stamp is the per-challenge stamp.

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy | `part_slots` |
| medium, hard, or no tier | none |

`model_word` and `small_board_word` start released at every tier. A tier never changes the words, the part count or
the mode.

## Findings for /eval-fix and /add-live-tutor-tools (not fixed here)

| # | Finding | Executor |
|---|---|---|
| F1 | `word-builder.simple_affix`: the clue for "teacher" is "a person whose job is helping students learn". It contains the board root `help`, and "helper" (help + er, "one who") is buildable from the board and fits the clue. The observer rejects a defensible board-built answer the clue invites. Class check: a clue must not contain the text of a board root that is not in the item | `/eval-fix` |
| F2 | `word-builder.greek_latin`: the clue for "biosphere" says "on Earth"; "earth" is the printed meaning of the distractor `geo`, and "geosphere" is a real word built from the board. Same class as F1 on the meaning side (a clue word equal to a distractor's printed meaning). Advisory: it is fair morphology discrimination, but the check should at least report it | `/eval-fix` |
| F3 | `word-builder.greek_latin`: all four items are 2-part with the combining form typed `prefix`, so `part_missing` never fires and the first part said alone is unnamed. Mode doc allows 2-3 parts. Answered by `other_part_only`; save one payload with a 3-part Greek/Latin item before building | build (payload) |
| F4 | All four saved payloads carry `gradeLevel` = the generic "elementary students (grades 1-5)" context string, below this primitive's Grade 3 floor; the session opens on that grade. A `save_payload.py` default, not a generator defect | `/eval-fix` (payload script) |
| F5 | The catalog `tutoring` block and `aiDirectives` still order `[WB_ITEM]` bracketed turns and "the scripted correction line" for the retired runner (LA-14). Dead on the bound path (`tutoring: null`). Same shape as rhyme-studio's stale directives removed in handoff 22 L2 step 1 | `/add-live-tutor-tools` |
| F6 | Catalog `misses` lists `part_missing` for simple_affix, which `wordBuilderSpokenMisses` can never emit (2 parts). Drop it for that mode in the build | build (catalog) |

## Rulings needed

| # | Question | Recommendation |
|---|---|---|
| R1 | The guidance says "after an attempt you may take the meaning apart part by part", and the retired DI correction did exactly that ("One part means not. One part means to help. One part means full of."). On this board each meaning is printed beside one card, so the walk in order names the parts in order, which the catalog's own LAW calls the word. Keep it as a tutor move, or replace it with the levers? | **Replace it.** Rewrite the sentence to "after an attempt, pull a lever; never walk every part's meaning in order" and let `part_slots` and `model_word` carry the structure. If the user wants a voiced rung kept, allow at most ONE part's meaning, only after both help levers are pulled. The rewrite must fit the offer cap: guidance is 763 chars, and with `levers: true` the delivered string is 1926 of 2000, so trim "it is judged against the word you are given" (the doctrine already covers it) to make room |

## Build notes

- **New capability:** a lever module `wordBuilderLevers.ts` (pools per tier and shape, `slotsLeak`, `modelFor` /
  `modelLeak`, `smallBoardWordFor` / `practiceLeak`, `leversOnScreen`, `wordBuilderLevers`), lever and practice state
  in `WordBuilder.tsx` (it publishes only `wordBuilderScene` today: no `levers`, no `pullLever`), an empty slot frame,
  a model card and a practice board. Copy `phonicsBlenderLevers.ts` and `PhonicsBlender.tsx` (a spoken practice word
  on the shared `{ practice }` path) for the shape.
- **Reuse:** the reveal panel's slot markup for `part_slots` and the model card; `itemFromTarget` as the gate for
  pool and practice words (exact concatenation, sayability, sentinels), so a pool word passes the same checks as a
  generated one; `wordBuilderSpokenMisses` for the practice item's misses; the shared `nextLever` and trigger ladder on the
  plain workspace path (no `runtime/` change).
- **Catalog:** `levers: true`, the four new misses (F6 drop), the R1 guidance rewrite under 2000 chars delivered
  (`activityContract.test.ts:53` pins it).
- **Pools:** each tier needs words for every shape it generates (simple: prefix+root and root+suffix; compound and
  multi: prefix+root+suffix; greek_latin: 2- and 3-part). Session items use about 10 parts, so 8-10 pool words per
  shape leaves a disjoint model and a disjoint practice word; return a refusal string when none is left.
- **Payloads to generate before building:** one `word-builder.greek_latin` payload with at least one 3-part item
  (F3); one easy-tier payload per mode once the tier stamp exists, to check `part_slots` starts drawn and is not
  offered as a pull. The four existing no-tier payloads show every lever.
- **Tests:** miss table over the seven ids (precedence: `parts_not_joined` before `parts_out_of_order`); `nextLever`
  per miss; leak rules over every saved payload and over random pool draws (model and practice never share a part
  with a session item, never a session word, practice answer equals its concatenation); mounted pull: slot frame and
  scene fact in one commit, model card, practice board opens ungraded and the full item returns; spoken-miss probe on
  the new ids.
- **Size: M.** About 300 production lines (lever module with pools about 150, component about 110, misses about 30,
  catalog and generator about 20), about 250 test lines.
- **Gate:** vitest, dry journey J1-J9, tutor replay; no Live. word-builder joins the literacy G2-6 class Live pair
  only when all four G2-6 primitives have every mode levered.
