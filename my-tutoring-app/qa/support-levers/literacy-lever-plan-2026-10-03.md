# Literacy levers: plan for the remaining families (2026-10-03)

**Status 2026-10-03: CONFIRMED. Rulings R1-R9 answered by the user's 10-03 goal ("rulings R1-R9 as answered"):
each takes its recommendation below.** The four tables count as confirmed; steps 0-5 run family by family with no
further stops.

**Progress:** step 0 DONE 10-04 (EVAL_TRACKER LL-0310; WB-5 queued to `/add-live-tutor-tools`; the tutor-test probe
route now passes `--grade` and `--difficulty` on workspace families, which it silently dropped: every earlier
saved payload of these families is at the band's default grade). R8 is checked per family as each is built
(`g26LeverStarts.test.ts`).

WORKSTREAMS 3.1b. K-2 literacy closed 09-29 (`qa/eval-reports/levers-literacy-K2-close-2026-09-29.md`). Measured
today (journey sweep `leverInventory` on the working tree, 342 tests green), the literacy families on the
workspace with modes still `none`:

| Family | Grades | Modes without levers | Misses per mode |
|---|---|---|---|
| sentence-analyzer | 2-8 | 4 of 4 | 2-3 |
| word-builder | 3-8 | 4 of 4 | 3 |
| genre-explorer | 1-6 | 3 of 3 | 6 (7 of 18 impossible in their mode) |
| text-structure-analyzer | 2-6 | 4 of 4 | 4 |

None declares `levers: true` yet. **15 modes.** Each has a DRAFT Phase 1-2 table in this folder
(`<id>-lever-table-2026-10-03.md`).

Not in this plan:
- **No lever, by decision (09-29), unchanged:** decodable-reader read_along, read-aloud-studio expression.
- **story-bridge** say_alike, say_different, main_idea_compare: the open ruling R9 below. It blocks L4's class Live
  gate, not this build.
- **12 literacy primitives with no tutor workspace** (rollout rows C13, C21, C22 in `qa/workspace-rollout/ROLLOUT.md`):
  levers need a workspace first. Part B below.
- **4 open-ended writing primitives** (opinion-builder, paragraph-architect, revision-workshop, story-talk): rollout
  row OPEN, no bounded answer and no code check. Out of scope.

## Levers per mode

| Family | Mode | Help | Simplify | No lever (reason) |
|---|---|---|---|---|
| word-builder | simple_affix, compound_affix, greek_latin, multi_morpheme | `part_slots` (empty boxes labelled by part type only), `model_word` (a different word of the same shape, solved, no part from any session word) | `small_board_word` (ungraded practice word, one foil per slot; on a 3-part greek_latin item the practice word has 2 parts) | marking the word's parts, linking clue words to cards, dimming foils on the child's word |
| sentence-analyzer | identify_pos | `model_sentence` (a different sentence, every word labelled), `wall_examples` | `short_sentence` | in-item marks: the word's relation is the answer |
| | identify_role | `two_row_model` (part of speech over job), `wall_examples` | `short_sentence` (subject-verb-object) | same |
| | label_all | as identify_pos | `short_sentence` (one ask, then the walk resumes) | a shorter walk changes the session, not the item |
| | parse_structure | side: `split_model`; kind: `wall_examples` | `short_subject` (refused at 2 words or fewer), `plain_kind` | boundary marks, end-mark spotlight |
| genre-explorer | identify_basic | `text_model`, `sentence_rows`, `read_again` (grades 1-2), `read_glosses` | none: the 2-item menu is the mode | a genre model: both genres are on the menu, so any model answers by elimination |
| | classify_genre | as identify_basic + `kind_pair_model` (R4) | `two_far_kinds` (practice text, two far kinds off the session menu) | yes/no step is already smallest |
| | compare_genres | `two_checks`, `pair_model`, `read_again`, `read_glosses`, `kind_pair_model` | `two_far_kinds` | "which text" step: one text = the yes/no step |
| text-structure-analyzer | all four (three steps on one passage) | `focus_sentence`, `link_model`, `structure_model`, `say_choices` (hard), `anchor_idea`, `source_sentence` | `short_link_sentence`, `structure_practice` (R5); chronological and compare_contrast also `two_part_practice` | grade 2 name-structure: 2-option menu, any model answers by elimination. cause_effect and problem_solution: a 2-part chart has no smaller placement item |

New misses (catalog), so every miss has a lever and J9 holds with an empty unanswered list:
word-builder `parts_not_joined`, `other_part_only`, `swapped_part`, `meaning_word` (and drop `part_missing` from
simple_affix: a 2-part word cannot produce it); sentence-analyzer `describing_word`, `named_the_side`;
genre-explorer `said_broad_kind` plus per-mode miss lists in place of the shared six; text-structure-analyzer
`not_in_sentence`, `said_topic`, `said_signal_word`.

## Rulings needed (one answer each; recommendation first)

| # | Question | Recommendation |
|---|---|---|
| R1 | Models and practice items on two-label sets (subject/predicate, adjective/adverb, fiction/nonfiction): excluding the item's answer from the model points to the other label | Pick answer-blind, and where a model card shows labels, show every label of the set (the DI R1 principle: the model never points to one answer) |
| R2 | Hand-written pools in code (genre-explorer `genreModels.ts` example texts; sentence-analyzer hand-labelled sentences) where DI R3 chose generated spares | Allow hand-written here. The content is the genre or the grammar, not the lesson topic, and a hand-checked key is the point: the saved sentence-analyzer payload has two wrong keys (D1, D2). Leak-check against the session at mount |
| R3 | Word-builder guidance tells the tutor to walk each part's meaning in order after an attempt; each meaning is printed beside one card, so the walk spells the word | Remove the walk; the levers replace it. Trim the guidance to fit the cap (1926 of 2000 with `levers: true`) |
| R4 | genre-explorer `kind_pair_model` prints genre names on a model card, which the component's notes forbid | Allow it when both model genres are off the session menu (code check), so they answer no item |
| R5 | text-structure-analyzer `structure_practice` uses a passage of a different structure, which is another mode's content | Allow it. The practice is ungraded, and a same-structure practice has the item's answer |
| R6 | text-structure-analyzer passages contain their own label words ("The problem is", "In contrast"), so naming the structure is word matching (D1) | Keep the phrases in code's signal-word list; ban them from passages by a generator rule plus a build gate that rejects the passage. Do it in step 0 |
| R7 | sentence-analyzer: narrow the label wall (handoff 22 "fewer or farther choices") | Do not build it. Narrowing is chosen with the answer in hand and turns producing a label into a pick among three |
| R8 | `supportTier` does nothing on the workspace path (sentence-analyzer D5, genre-explorer tier finding): generation tiers never reach the learner | Close at class in step 0: one check over the four families that `config.difficulty` sets the lever starting positions (Phase 6), not per family |
| R9 | story-bridge spoken comparisons (carried from handoff 24 step 3) | Rule them out of L4's class gate with their `unanswered` reasons, and run the L4 Live pair. Open comparisons have no bounded miss to answer |

## Build order

0. **Prep, one slice:**
   - `/eval-fix` the content defects, one class pass:
     - word-builder: the "teacher" clue contains "help" (and "helper" can be built), the "biosphere" clue says "Earth" (the printed meaning of foil `geo`), and the payload grade is below the Grade 3 floor.
     - sentence-analyzer D1-D4: "down" keyed Preposition, "night" keyed Object of Preposition with no preposition, "determiner" refused on "Three", every sentence from one template.
     - genre-explorer F1-F3: a 1-feature identify_basic session, texts repeated across modes, a feature not checkable from the text.
     - text-structure-analyzer D1-D3 (D1 per R6): D2 Before/Middle/After ambiguity, D3 a cause-effect link with two defensible parts.
   - Then R8 as a class check.
   - Then generate the missing payloads, one Flash generation each:
     - word-builder: greek_latin with a 3-part word.
     - genre-explorer: grade 1-2 and hard tier.
     - text-structure-analyzer: a description passage, plus easy and hard tiers.
   - Route the word-builder catalog's retired `[WB_ITEM]` runner directives to `/add-live-tutor-tools` (queue only).
1. **word-builder (M)**, about 300 production lines.
2. **sentence-analyzer (M)**: a new hand-labelled sentence pool (R2).
3. **genre-explorer (M)**: `genreModels.ts` (R2) and the per-mode miss lists. Guidance 1834 of 2000 plus about 45 for two reworded sentences.
4. **text-structure-analyzer (L)**, 450-600 lines. Guidance is at 1998 of 2000 with `levers: true`, so trim it first.
5. **Class Live gate ready:** save `<id>.mixed.json` for all four, drive them clean, and run text replay over the four mixed payloads × 5. Do not run it: the paid run is the user's to start or approve.

Each family runs the same steps:

1. Phase 3 contract (`/primitive-contract`).
2. Build.
3. Unit and mounted tests.
4. `typecheck:lumina` = 0, and the full tsc count is no higher than the baseline.
5. Run the live-activity suite. All four are near the guidance offer cap, and a socket closed by the cap shows only there.
6. J1-J11 dry journey.
7. Text replay (`--samples 5`).
8. Write a report in `qa/eval-reports/<id>-levers-<date>.md`.
9. Mark the family's row in WORKSTREAMS 3.1b and change the table header from DRAFT to BUILT.
10. Commit.

No Live run before step 5.

## Part B (later, separate goal): the 12 literacy primitives with no workspace

C13 K-2: letter-workshop, spelling-pattern-explorer, story-map, sentence-builder, story-planner (the last two are
on hold in Pip for `/curriculum-fit`; check first). C21 G2-5: character-web, context-clues-detective,
evidence-finder, figurative-language-finder. C22 G2-5: reading-repair-studio, poetry-lab, spatial-path.

Order: W1 binding per rollout row (`/add-live-tutor-tools`, plain recipe), with catalog misses per mode. Then
re-measure with the sweep. Then draft a lever table per family the same way as this plan, take rulings, and build.
Several of these already have generation-time tiers from support-tiers batches 1-3. Those set the starting
positions; they are not runtime levers.
