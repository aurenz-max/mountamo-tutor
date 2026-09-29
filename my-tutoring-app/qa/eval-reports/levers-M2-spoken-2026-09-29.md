# Math levers, class M2: the spoken modes (2026-09-29)

Handoff 23 step 2, `/add-support-tiers`, one primitive at a time. With this slice every eval mode of comparison-builder, compare-objects, number-sequencer and ordinal-line has its misses and levers, spoken modes included, so M2 is ready for its class Live pair (handoff 23 step 3). Tables: `qa/support-levers/m2-lever-tables-2026-09-28.md` (spoken slice section). No real-learner evidence: every failure is synthetic (the misses each primitive's spoken-miss function names) or documented (compare-objects `commonStruggles`).

## What was built

| Primitive · mode | Help | Simplify (ungraded, then the full item) | Unanswered |
|---|---|---|---|
| compare-objects compare_two | `word_model` | `far_pair` (close pairs only) | — |
| compare-objects identify_attribute | `menu_pictures` | `fewer_choices` (on the item, assisted) | — |
| compare-objects non_standard | `tap_boxes`, `five_marks` | `shorter_measure` | — |
| number-sequencer count_from, before_after, fill_missing, decade_fill | `step_arrow`, `car_marks` | `smaller_numbers` (trains past 10) | — |
| number-sequencer spot_error | `model_train` | — | — |
| ordinal-line identify | `front_flag`, `tap_marks`, `word_model` (Grade 1) | `shorter_line` | — |
| ordinal-line relative_position | `front_flag`, `side_model` | `shorter_line` | — |
| ordinal-line match | `place_model` | — | — |
| ordinal-line sequence_story | `word_model` | `short_story` | — |

New capability (S7): the non_standard unit boxes and the ordinal identify line can now be tapped when their lever is pulled; the tap only marks, it never answers. Production code: three lever modules (416 lines, about a third of it docblocks) and 165 lines of component wiring, against about 600 lines of new tests.

## Verification

| Gate | Result |
|---|---|
| Lever unit tests (miss → lever tables, leak rules on saved payloads, practice builders over many items, catalog answered/unanswered consistency) | compareObjectsSpokenLevers 13, numberSequencerSpokenLevers 15, ordinalLineSpokenLevers 15 |
| Mounted pulls (screen and scene in one commit, lever on the next attempt, practice ungraded and returns, only the full item credited) | CompareObjects +4, NumberSequencerSpoken 3, OrdinalLineSpoken 3 |
| Sweep J1-J9 | green; every M2 mode has every catalog miss answered. J9 mutation-checked on each primitive (dropping one `answers` id fails it) |
| Math + live-activity + manifest suites | 4245 pass; 1 failure (`BarModel.workspace` build_graph) passes alone, a load flake in a file this slice did not touch. Pins updated: every mode of the three now offers `pull_lever` |
| typecheck:lumina | 0 in this slice's files. The gate currently shows 5 errors in `DialogueObserver.test.ts` and `gemini-word-sorter.test.ts`, files another session is editing (uncommitted) |
| Full tsc | 776, of which those 5 are the other session's: 771 for this tree without them (baseline 773) |
| Text replay, Flash, 5 samples | compare-objects 4 payloads: 0 flags. number-sequencer 6: 6 flagged samples (miss 1/25, stuck 2/25, lever 3/25), all false positives (see below). ordinal-line 6: 2/20 at stuck, both **real**, fixed, then 0 flags at 10 samples. `qa/tutor-reports/replay/*-2026-09-29.json` (`ordinal-line-before-2026-09-29.json` is the first run) |

**The two real replay leaks (fixed in this slice).** On a Grade 1 identify item asking the tenth place, the tutor pointed at `word_model` and went on: "For number ten, we say tenth!". On relative_position the tutor counted the line aloud ("second is Turtle, third is Bear. Who is right before Bear?"), which names the answer. Both levers' `does` text now tells the tutor to say only the model's own three places, and to point at the model rather than name the line's pictures up to the marked one.

**The false positives.** All six number-sequencer flags are on before_after's first item, whose answer is 1: `no_key_before_try` reads "one less" and "one step back" as the key. Same class as the syllable-clapper "one dot for each clap" row. Filed for handoff 20 Part C.

## Also found

- **New payload** `ordinal-line.identify-g1.json` (Flash generation, no Live). The saved identify payload is Kindergarten, where the answer is a name, so `cardinal_for_ordinal` never appeared and J9 could not see it answered.
- **number-sequencer `showNumberLine`** (K easy/medium tier) prints every number from the train's lowest to its highest under the train, so the answer is printed in order next to its neighbours. It predates this slice and is a starting position, not a lever. Filed in the brief for a ruling (keep as the easy start, or withdraw on the spoken modes).
- compare_two's saved payload has only far-apart pairs, so `far_pair` never appears in the sweep; its builder is covered by the unit test over 100+ close pairs.

## Not measured

- The replay reaches each payload's first item only (SW-9). Later count_from slots, the spot_error model train and the story's `short_story` got no replay moment.
- Not browser-checked. HUMAN-CHECKS #180 is the M2 spoken sitting.

## Next

Handoff 23 step 3: the M2 class Live pair, the same two-run shape as M1, on a mixed M2 payload (none exists yet; create one for number-sequencer or comparison-builder). Paid; the user runs or approves it.
