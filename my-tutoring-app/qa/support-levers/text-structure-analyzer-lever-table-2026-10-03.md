# text-structure-analyzer: failure inventory and lever table (2026-10-03)

**DRAFT 2026-10-03**. `/add-support-tiers` Phases 1-2, literacy G2-6 family 4 of 4.
Rulings carried over: the child answers out loud and no lever turns an answer into a tap (DI spoken-first);
"my turn" models a DIFFERENT item, never the learner's (10-02); the passage is never read aloud (catalog law);
help on a recognition item acts on material outside the item (handoff 22 "model pair outside the item"); a
simplify item never repeats the learner's item or its answer (R3) and never changes the response form (R2).

## How this primitive is shaped (it decides the table)

The four eval modes ARE the passage's structure type. Every mode runs the same three actions on one passage:
`find-signal` (up to 4 items: say the linking word in "sentence N"), `name-structure` (exactly 1 item: say the
structure from the printed menu) and `place-idea` (up to 4 items: the tutor reads an idea, the child says the
chart part). So the levers are per action, and the modes differ only in content: the number of chart parts
(2 on cause_effect and problem_solution, 3 on chronological Before/Middle/After and on compare_contrast with
Both), the menu size (2 at grade 2, 3 at grade 3, up to 4 of 5 at grades 4-6) and which structure a model may
use.

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` has no text-structure-analyzer entries; `qa/misconception`
has none; no `*Remediation.ts`. There is no `docs/contracts/text-structure-analyzer.md` (Phase 3 derives it).
Synthetic = the 2026-08-17 Live DI journeys (`qa/tutor-reports/text-structure-analyzer-live-di-*.md`: scripted
content-word, other-structure and said-back wrongs, all refused 2/2) and the `spoken_miss` ids from
`textStructureSpokenMisses` (`textStructureAnalyzerWorkspace.ts`), named on all four saved payloads in the 10-03
sweep. Documented = catalog `commonStruggles` (five patterns) and the script header. Saved payloads exist for all
four modes, but **none carries a `supportTier`**, so every one is the medium render (focus sentence on, menu
spoken), and **chronological_description has no description passage**.

Every mode has the same four misses in the catalog (`sameMisses<SpokenTextStructureMiss>`, literacy.ts:4560).

| Action (modes) | Failure | Class |
|---|---|---|
| find-signal (all) | says a word of the asked sentence that names a thing, action or quality ("river", "flooded") (`content_word`) | synthetic + documented (the signature error) |
| find-signal (all) | says a word that is not in the asked sentence: another sentence's linking word, or a linking word the passage does not use ("then" for "Next") | inferred; **no miss id** (lands as no match). At hard the sentence is not highlighted and the child must count to "sentence four" |
| find-signal (all) | says only part of a multi-word signal ("result" for "As a result") | documented as accepted wording; a judging rule, not a failure |
| name-structure (all) | names another printed structure, most often the near one: Problem and Solution for Cause and Effect (`other_structure`) | synthetic + documented |
| name-structure (all) | names the topic instead of a structure ("it's about floods") | inferred; **no miss id** |
| name-structure (all) | says a linking word instead of a structure ("because") | inferred; **no miss id** |
| name-structure (G4-6 hard) | cannot read the printed menu (the ask does not name it at hard above grade 2) | inferred (the `namesChoices` tier exists for this) |
| place-idea (all) | names the other part (`other_part`) | synthetic + documented |
| place-idea (all) | says the idea back (`said_idea_back`) | synthetic + documented |
| place-idea (chronological, compare_contrast) | picks a neighbouring part on a 3-part chart: Middle for Before, Both for one side | inferred, same miss id; **also a content defect on the saved chronological payload (D2)** |
| all | a structure or part name with a changed ending or inside a phrase ("cause", "it goes in Effect") | documented as CORRECT; a judging rule |
| all | silence, or asks to hear it again | documented; no lever (the re-ask channel exists; the tutor waits) |

**Fix what corrupts the evidence first.** Three of four saved payloads have a content defect that makes a
failure an artifact of the item (D1-D3 below). Queue them under `/eval-fix` before measuring levers on those
items. D1 also bears on the lever leak rules (no model passage may print its structure's label word).

### Content findings on the saved payloads (for `/eval-fix`, not fixed here)

| # | Mode | Defect | Effect |
|---|---|---|---|
| D1 | problem_solution, compare_contrast | The passage's signal phrases contain the answer label's distinguishing word: "The problem is", "One solution" (label Problem and Solution); "In contrast" (label Compare and Contrast). The 08-17 Live problem-solution passage had the same two phrases. `TRANSITION_WORDS` lists all three, so the generator is told they are good signals | `name-structure` is answerable by matching a printed word to a menu label; after find-signal credit the word is lit in the passage too. See ruling 2 |
| D2 | chronological_description | Mats Before / Middle / After over a five-step sequence. "Warm rain makes the dry ground very wet" (sentence 2, "Next") is keyed Before; the middle steps have no single defensible part. Sentence 3 opens "After that" and its idea is keyed **Middle** under a mat named **After** | A child who says Middle for step 2, or After for "After that", is refused for a reasonable answer |
| D3 | cause_effect | Causal chain: "Melting snow fills the riverbeds" is keyed Effect, but sentence 2 makes it the cause of the overflow, so it has two defensible parts. Sentence 4 ("People build tall walls of sandbags to protect their homes") is a problem-solution sentence inside a cause-effect passage | `other_part` on the chain link is an artifact; the passage blurs the near pair the hard menu exists to separate |
| D4 | compare_contrast | "However" (the hallmark contrast signal) is dropped because `countConnectives` counts the preposition "during" in the same sentence; "Both" is a generated signal word but not in `TRANSITION_WORDS`, so its sentence asks nothing. Two find-signal items survive. Ideas are subjectless fragments read aloud as "Listen: Arrive very fast during..." and one ("Sweep away cars and major structures") adds "major structures", which the passage does not say | Over-drop is by design; the fragment wording is minor. Low priority |
| D5 | all | No description passage; no easy or hard payload for any mode | J9 and the replay cannot see `focus_sentence` or `say_choices` as pullable (they are on at medium) or the easy anchor |

## Phase 2: lever table

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| all · find-signal | not_in_sentence (new) | `focus_sentence`: the asked sentence gets the sky ring in the passage (the easy/medium render) | help | shown | Rings one whole sentence, the asked one; never a word or a span inside it; scene fact "The asked sentence is highlighted" names no word. Refused when already on (easy, medium) | **generation only**: `showFocusSentence` (tier ≠ hard) drives the render; no runtime state | S: per-item pulled state ORed into `focusSentence`; scene fact already written |
| all · find-signal | content_word, not_in_sentence (new) | `link_model`: a card under the passage with a DIFFERENT short sentence, its linking word underlined and the two ideas it joins bracketed, solved. The tutor reads the model card aloud ("My turn: in 'The ice melted, so the path got wet', so joins the two ideas") and asks again about sentence N | help | both (printed card; the tutor may read the MODEL, never the passage) | Model linking word appears nowhere in the passage (word-bounded, every sentence) and shares no stem with any passage linking word (after / afterward); model sentence shares no word of 4+ letters with the passage; the model marks nothing in the passage; `does` forbids applying the model to sentence N | no | pool + picker + leak check (`textStructureModels.ts`), card render |
| all · find-signal | content_word | `short_link_sentence`: an ungraded practice card, a short code-built sentence (two clauses, 8 words or fewer, one linking word in the middle): "Read this sentence. Which word links the ideas?" Then the full item returns | simplify | both (printed; the child reads it, the tutor does not) | Practice linking word not in the passage and not the pulled `link_model`'s word; no passage word of 4+ letters; exactly one `TRANSITION_WORDS` connective (`countConnectives === 1`); never sentence N. Shape step: two clauses and at most three naming words to pass over | no | same pool; practice assignment + card render |
| all · name-structure | other_structure, said_topic (new), said_signal_word (new) | `structure_model`: a card with a DIFFERENT three-sentence passage, its linking words underlined and its structure named, solved: "My turn: first, then, at last tell the order, so this one is Time Order" | help | both | Model structure is not the answer. Prefer a structure off the menu and in the grade band; else a menu structure that is not the answer, only when the menu has 3 or more options (a 2-option menu answers by elimination). Model passage prints no ear-word of the answer's label (D1) and shares no word of 4+ letters with the session passage. Refused at grade 2 (see rejected rows) | no | pool (5 structures × 2 mini passages) + picker + leak check, card render |
| G4-6 hard · name-structure, place-idea | (no miss: "I can't read these" / silence) | `say_choices`: the ask is re-said with the printed menu or the part names spoken, the easy/medium form of the same ask | help | voiced | The spoken list is the printed list in screen order, all options, no gloss, no stress; the text is `choicesPhrase(item)`, which `askIsAnswerFree` already exempts. Refused when the ask already names the choices (easy, medium, grade 2) | **generation only**: `namesChoices` = band floor or tier ≠ hard | S: item copy with `namesChoices: true`, re-asked through the existing ask |
| all · place-idea | said_idea_back, other_part | `anchor_idea`: one spare idea of the same passage, never asked this session, appears filed on its correct mat marked "(example)" (the easy render) | help | both (printed on the mat; the tutor may read it) | The anchor idea is not a session item (truncated or extra); it does not come from the same passage sentence as the current item (the sentence locator below); refused when no spare idea exists or one is already placed. Never the current idea | **generation only**: `anchorIdeaId` at easy, rendered by `filedByRegion`; no runtime state | S-M: runtime anchor state; spare = `truncated` ideas (needs `itemsFromPayload` to return them); generator asks for 2 more ideas than `MAX_MAP_ITEMS` |
| all · place-idea | other_part | `source_sentence`: the passage sentence the idea came from gets the sky ring, so the child can reread it and its linking word | help | shown | Rings one whole sentence; never a word. Located by content-word overlap (unique best sentence with 2+ shared words, else refused). Refused when the sentence contains an ear-word of the answer's label and of no other label (compare_contrast: "flash floods" for the Flash Floods mat; a sentence naming both sides is allowed) | no | locator (pure) + ring render (reuse the focus ring) |
| chronological_description, compare_contrast · place-idea | other_part | `two_part_practice`: an ungraded practice item, a second spare idea of the same passage, asked with two parts: the middle part dropped (Before / After) or Both dropped (one side / the other). Then the full item returns | simplify | both (the tutor reads the idea, as on every place-idea ask) | Practice idea is not a session item and not the `anchor_idea`; its answer is not the dropped part; never the current idea or its source sentence. Refused on a 2-part chart (cause_effect, problem_solution: one part has no question) and when no second spare exists | no | builder over spare ideas; practice assignment + two-mat render |
| G3-6 · name-structure | other_structure | `structure_practice`: an ungraded practice card, a different three-sentence passage from the pool with a two-option menu (its structure and the farthest foil by `STRUCTURE_DISTANCE`): "How is this one put together?" Then the full item returns | simplify | both | Practice structure is not the answer and in the grade band; not `structure_model`'s passage; prints no label ear-word (D1); no session word of 4+ letters. Refused at grade 2. Needs ruling 1 | no | same pool; practice assignment + mini-passage card with menu |

### New misses (build work)

Add to `SpokenTextStructureMiss`, `textStructureSpokenMisses` and the catalog list in the same change:

- `not_in_sentence` (find-signal): "The learner's answer is a word that is not in sentence N: another sentence's
  word, or a linking word this sentence does not use." Code can see it (the word is absent from `stimulusText`).
  Examples: the passage's other linking words.
- `said_topic` (name-structure): "The learner names what the passage is about (its topic) and no structure."
  Examples: the title's naming words.
- `said_signal_word` (name-structure): "The learner says a linking word from the passage and no structure."
  Examples: the credited find-signal answers.

J9 after the build, every mode: content_word → `link_model`, `short_link_sentence`; not_in_sentence →
`focus_sentence`, `link_model`; other_structure → `structure_model`, `structure_practice`; said_topic,
said_signal_word → `structure_model`; other_part → `source_sentence`, `anchor_idea`, `two_part_practice` (3-part
charts); said_idea_back → `anchor_idea`. **Unanswered: none** at grades 3-6. At grade 2, other_structure,
said_topic and said_signal_word are unanswered by decision (below); the catalog `unanswered` list cannot vary by
grade, so the levers module returns them unanswered when the menu has two options and the test pins it.

### Rejected and no-lever rows

- **Bracketing the two ideas in the asked sentence** (find-signal help on the item). The unbracketed gap between
  the brackets is the linking word. Rejected; the brackets live only on `link_model`'s own sentence.
- **Dimming or striking the naming words of the asked sentence.** Answers by elimination. Rejected.
- **Pre-highlighting signal words** (the click era's easy tier). It printed the answers; the script header
  records the removal. Not reopened.
- **`signal_recap`** (gather the credited linking words above the menu). Credited words are already lit in the
  passage (`affirmedWordBySentence`), so it adds nothing on screen, and on D1 passages it lines up "The problem
  is" beside "Problem and Solution". Rejected.
- **Removing a menu option on the structure item** (runtime `maxStructureOptions`). Same question, fewer
  choices: it repeats the item (R3) on the run's only structure ask, and the menu floor of three is recorded in
  the script header (the 1-in-2 guess floor). Rejected as simplify; `structure_practice` is the simplify.
- **Name-structure at grade 2: no lever.** The menu has exactly the two in-band structures. Any in-band model or
  practice passage is the other option, which answers the item by elimination; an off-band model (cause and
  effect to a second grader) teaches a structure outside the grade. The ask already names both choices at the
  band floor.
- **A structure model of the same structure** (a short cause-and-effect passage beside a cause-and-effect item).
  Its answer is the item's answer; the child repeats it. Same for a shorter version of the session passage.
- **Part questions under the mats** ("Why did it happen?" under Cause). Text-only, and compare_contrast and
  description mats are topic names with no generic question. `anchor_idea` and `source_sentence` change the
  page instead.
- **The tutor modelling a session idea on its mat** ("my turn: the river rose goes under Cause"). Every idea
  shares one mat set, so it says the next item's answer (script header). `anchor_idea` uses an idea that is never
  asked.
- **Place-idea simplify on a 2-part chart: no lever.** One part has no question; another idea of the same chart
  is another item, not a smaller one.
- **The strategy lines as a lever** (`modelLine` / `guideLine`). Text the tutor says at easy/medium on the step's
  first ask; voicing them again changes nothing on screen.
- **Silence, "say it again":** the re-ask channel (`[TSA_HEAR]` / repeat) exists and adds no help by rule. No
  lever.

## Phase 6: starting positions

The generator stamps `supportTier`, `nameStrategy`, `maxStructureOptions` and `anchorIdeaId`
(`gemini-text-structure-analyzer.ts:698-727`); the script module derives `showFocusSentence` and `namesChoices`.
Keep all of it; the levers make three of these pullable.

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy | `focus_sentence`, `anchor_idea` (today's anchor), choices spoken; menu of 3 |
| medium, or no tier | `focus_sentence`, choices spoken; menu of 3 |
| hard | nothing; full menu (up to 4); choices printed only above grade 2 |

`link_model`, `structure_model` and `source_sentence` start released at every tier: they are pulls. The menu size
stays a generation-time answer-form setting, not a lever.

## Rulings needed

| # | Question | Recommendation |
|---|---|---|
| 1 | The eval mode IS the structure, so `structure_practice` (a practice passage of a different structure) uses another mode's content. Is that a mode crossing? | **Allow it.** The action is the task identity (name how a passage is built from a printed menu); the practice is ungraded and never touches the mode's β. A practice of the same structure has the item's answer (R3), so there is no other simplify for this action. di-shapes' `plain_drawing` (a different shape in practice) is the same move |
| 2 | D1: "The problem is", "One solution" and "In contrast" are in the code-owned `TRANSITION_WORDS` and are good find-signal answers, but they print the structure label's own word, so name-structure becomes word matching. Which side gives? | **Keep them countable, keep them out of the passage.** `/eval-fix`: the generator prompt bans signal phrases that contain a word of the answer's label ("to fix this", "solved by", "but", "whereas" instead), and a build gate drops the structure item when the passage contains an ear-word of the answer's label outside the menu. The words stay in `TRANSITION_WORDS` so the one-connective count still sees them. The pool's model passages follow the same rule |

## Build notes

- **New capability:** a code-owned pool module (`textStructureModels.ts`): about 20 short linking-word model
  sentences keyed by connective, 5 structures × 2 three-sentence mini passages (none printing its own label
  word), plus the leak checks and a sentence locator (idea → source sentence). A levers module
  (`textStructureAnalyzerLevers.ts`) with declarations, `answers`, per-lever leak functions and the three practice
  builders. Component: per-item pulled state, the model card, the practice card (sentence; mini passage with
  menu; idea with two mats), runtime anchor and ring state, `levers` + `pullLever` + `endPractice` on the
  workspace, a `levers_on_screen` scene fact.
- **Reuse:** the focus ring (`focusSentence`), the anchor render (`filedByRegion`), `namesChoices` and
  `choicesPhrase`, `countConnectives`, `earWords`, `STRUCTURE_LABEL`, `STRUCTURE_DISTANCE` (move it from the
  generator into the script module so the runtime builder can read it), the shared `nextLever`, practice and
  trigger ladder. No `runtime/` change.
- **Script change:** `itemsFromPayload` must return the ideas it truncated or held out (today it returns only a
  count), so `anchor_idea` and `two_part_practice` have spares. The generator asks for `MAX_MAP_ITEMS + 2` key
  ideas (the problem_solution payload has 4 ideas and 0 spares, so both levers would be refused on it).
- **Catalog:** `levers: true`, the three new misses, a grade-2 note. **Guidance offer cap:** guidance is 835
  characters; with `WORKSPACE_DOCTRINE` (948) and `LEVER_DOCTRINE` (213) the adapter guidance becomes 1998 of
  2000. The sentence the tutor needs ("You may read a model card aloud; it is not the passage") does not fit.
  Trim the guidance by about 120 characters first (the "Ask for 'the word that links the ideas'" sentence
  overlaps the cue text) and run the live-activity suite (`activityContract.test.ts`) in the same slice.
- **Size: L** (about 450-600 production lines: pool about 150, levers module about 180, component about 150,
  script and catalog about 50). A first cut at **M** ships the four help levers that reuse existing renders
  (`focus_sentence`, `say_choices`, `anchor_idea`, `source_sentence`) and the two models; the three practice
  builders follow.
- **Payloads to generate before building** (one Flash generation each, `save_payload.py`): a description
  passage for `chronological_description`; a hard-tier payload per mode (all 4) so `focus_sentence` and
  `say_choices` show as pullable; one easy-tier payload (any mode) for the anchor start; one grade-2 and one
  grade-3 payload (menus of 2 and 3) for the `structure_model` band rules. Regenerate the problem_solution,
  compare_contrast, chronological and cause_effect payloads after the D1-D3 `/eval-fix`.
- **Gate:** vitest (miss table incl. the three new ids, leak per lever on every payload, `nextLever` + J9,
  mounted pull with practice return), dry journey J1-J9, tutor replay `--samples 5`. No Live: the literacy G2-6
  class Live pair waits until all four G2-6 primitives have levers on every mode.
