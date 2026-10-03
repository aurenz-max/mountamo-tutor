# DI levers: plan for the remaining 8 families (2026-10-03)

WORKSTREAMS 3.1d. Done: di-math-facts (5 modes), di-dice-roll (3). Remaining: 8 families, 29 modes.
Each family has a DRAFT Phase 1-2 table in this folder (`<id>-lever-table-2026-10-03.md`). This file is the
summary, the build order, and the rulings the build needs. Once the rulings below are answered, the tables
count as confirmed and the build runs family by family with no further stops.

## Levers per mode

`model_*` is the parallel-item model (help, a different item solved beside the child's; ruling 10-02).

| Family | Mode | Help | Simplify | No lever (reason) |
|---|---|---|---|---|
| di-shapes | name_shape, shape_review | `model_shape` | `plain_drawing` (different shape, upright, plain) | no help on the child's own shape: naming is recognition |
| | find_real_object | `model_object` | none | simpler = bare outline = name_shape |
| | count_sides, count_corners | `model_count`, `start_mark`, `touch_marks` (new tappable sides/corners) | `fewer_sides` | no simplify on a triangle |
| di-letter-sounds | letter_sound, letter_sound_review | `model_sound`, `sound_arrow`, `keyword_picture` (R4) | none | short-vowel items (R5) |
| | first_sound_in_word | `model_sound` (picture word), `first_box` | none (already at mode floor) | |
| di-word-reading | cvc_reading | `model_word`, `blend_slide`, `sound_dots`, `tracking_arrow` | `short_word` (VC word, R7) | |
| | read_word, word_reading_review | per item: decodable as cvc_reading; sight items `model_word` only | decodable items: `short_word` | |
| | sight_word | `model_word` | none | "does not know the word" (R6) |
| di-sentence-reading | decodable_sentence, read_sentence, sentence_review | `model_sentence`, `tracking_underline`, `sound_dots` (CVC words) | `short_line` | |
| | sight_phrase_sentence | `model_sentence`, `tracking_underline` | `short_sight_line` (R8) | misread irregular word: dots would teach sounding it out |
| di-spoken-practice | count_and_say | `model_count`, `touch_marks`, `five_rows` | `smaller_group` | |
| | compare_choice | `word_model` (R1) | `far_pair` | no help on the item's own pair |
| | read_aloud | `model_read`, `sound_dots`, `word_underline` | `short_word` | |
| | say_answer | `model_answer` | R3 | |
| | explain_concept | `model_explain` (none when every item is the same concept) | R3 | |
| di-worked-procedure | subtract_no_regroup | `model_problem`, `top_blocks`, `take_away_cubes` | none (each step is one single-digit fact) | |
| | subtract_regroup | `model_problem`, `top_blocks` (R9), `take_away_cubes` | `fewer_columns` (after `no_decrement`, 3-digit only) | upside_down_column, said_no_regroup: a regroup practice step gives away "regroup" |
| di-deduction | conclude, deny | `model_case` (R1, R3), `answer_frame`, `shared_term` | none (mode floor / reason is the mode) | |
| | cannot_tell | `model_case`, `answer_frame` | `counterexample_card` | lighting the shared property pushes the "yes" error |
| di-word-problem-setup | find_big_number | `model_story` (R1), `story_links`, `count_dots` | `within_ten` (solve step only) | placing step: an easier story gives away the box card |
| | build_family | as above + `read_along` | `within_ten` | add/subtract choice on the item |
| | classify_and_build | `model_story` ×3, levers above | `within_ten` | classify step |

## Rulings needed (one answer each; recommendation first)

| # | Question | Recommendation |
|---|---|---|
| R1 | A model whose answer can be predicted from the child's answer (dice compare: always the opposite relation; deduction: always the child's verdict; one word-problem story read backwards; compare_choice) | Show one model per possible answer (every relation, or every verdict, or every kind), so the model card never points to one answer. Apply it to the built dice compare model too |
| R2 | Existing guidance, tier text and scene facts still model the CHILD's item (shapes easy/medium, letter-sounds, word-reading `soundOut`, sentence "Listen"/"Together" and correction re-read, worked-procedure easy column phrase) | Remove all of it in one class slice before the family builds (10-02 ruling; close at class) |
| R3 | Simplify/model content that code cannot build (say_answer, explain_concept, deduction rules) | The generator writes spare items at generation time, and code swaps them in at runtime with no LLM call. A hand-written bank in code would be off-topic |
| R4 | The letter-sounds keyword picture is drawn at every tier, so the child can answer from the picture | Make it a lever that starts on screen only at easy |
| R5 | Short-vowel letter items ask "say the word apple" and credit "apple" | Send to `/eval-fix`. The item tests nothing |
| R6 | A sight word the child does not know | No lever. A delayed re-ask is a different mechanism; queue it separately if wanted |
| R7 | Is a VC practice word ("at") still cvc_reading? | Yes: it is still decode and blend, one sound fewer |
| R8 | sight_phrase_sentence practice line cannot share no word with the whole session | Scope the no-shared-word rule to the current item for this mode |
| R9 | `top_blocks` on a regroup decide step: does it show the decision? | Allow it. The blocks show how many ones there are and do not say "regroup". This is the concrete model DI uses |
| R10 | Sentence pack `reader: 'none'` once the tutor stops reading the sentence first | Change it to `emerging` in the R2 slice (it is an affordance fact) |

## Build order

0. **Prep, one slice:** `/eval-fix` the deduction cannot_tell false item ("All birds have feathers" + pillow) and the short-vowel items (R5). Then the R2 class slice. Then generate the missing payloads (one Flash generation each): shapes shape_review, find_real_object, count_corners; sentence decodable_sentence, sentence_review, sight_phrase_sentence; spoken-practice read_aloud, say_answer, explain_concept; word-problem classify_and_build; worked-procedure 3-digit subtract_regroup; letter-sounds clipped-stop; regenerated deduction cannot_tell.
1. di-shapes (M): tappable sides and corners.
2. di-letter-sounds (S-M): split the shared miss list per mode, move the letter table out of the generator.
3. di-word-reading (M): add a tier harness (none exists), reuse the phonics-blender print renders.
4. di-sentence-reading (M): move `SENTENCE_MENU` out of the generator; add a per-word dots option to `LuminaPrintSupport`.
5. di-worked-procedure (M): `declare` on the shared stage needs the step's last miss.
6. di-deduction (M): spare generated rules (R3).
7. di-spoken-practice (L): spare items, two pair tables, tier stamp, miss lists for 3 modes.
8. di-word-problem-setup (L): not on `DiTeachingStage`; lever and practice state built into the component.
9. **Class Live gate:** `--mode mixed` over all 37 DI modes (ruling 09-28), the fewest runs that answer it.

Each family runs the same steps: Phase 3 contract, build, unit + mounted tests, `typecheck:lumina` = 0, J1-J8 dry
journey, text replay (`--samples 5`), a report in `qa/eval-reports/<id>-levers-<date>.md`, then the 3.1d row and the
table header change from DRAFT to BUILT. No Live run before step 9.
