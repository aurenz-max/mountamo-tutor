# Open build — roadmap and queue (2026-10-07)

Next session: start at `../HANDOFF-open-build-wave3-2026-10-07.md` (state, verification debt, how to run a wave).

**Goal:** build is a modality, not a primitive. For every skill where a learner can MAKE an example and many makes
are correct, there is a build mode on the teaching workspace: empty scene, the learner makes it, the tutor teaches
from what they made (pause fact, `workHistory`), the primitive's code judges at "I'm done!". Spec and steps:
`.claude/skills/add-eval-modes/references/build-mode.md`. Executor: `/add-eval-modes`.

**Modality vs operation.** The catalog's per-mode `answers` (tap · spoken · build · manipulate · type) is the
modality axis: what the learner produces, served by one shared layer each. The eval mode stays the operation
(identify, compare, evaluate, make). The same skill can be asked in several modalities; build is the Constructive
rung (ICAP) and the one being spread now.

## Inventory (10-07)

- 63 catalog declarations say `answers: build`; most are TARGETED (fill our scaffold, one correct configuration).
- 8 are truly OPEN today: counting-board `build_n`, open-builder, ten-frame `decompose`, number-bond `decompose`,
  pattern-builder `create`, shape-composer `free-create`/`how-many-ways`, the engineering design builders
  (bridge, tower, gear, pulley, blueprint). Only the first two use the shared build layer.
- 13 families auto-check on 3 s of stillness (`armStillness`): Ten Frame, Number Bond, Place Value, Ordinal Line,
  Balance Scale, Compare Objects, Addition-Subtraction Scene, Cause-Effect Chain, Number Sequencer, Ramp Lab,
  Base Ten DI, DI Word Problem Setup. The shared pause fact (5 s) never fires there.
- Made quantity as a NUMERIC fact (needed for `workHistory`): counting-board, ten-frame, number-bond,
  addition-subtraction-scene, balance-scale. Text only: base-ten, fraction-circles, coin-counter, bar-model,
  equation-builder, open-builder, and the sequencers.

## Queue

| # | Item | Executor | State |
|---|---|---|---|
| OB-0 | Tags: `answers: build` where the child assembles pieces | `/add-affordances` | DONE 10-07: counting-board `build_n` (was tap), area-model `build_model`, train-yard `build_train`. Left as is, correctly: word-builder (spoken answers), poetry/paragraph/story/opinion (typed), place-value `build` (writes digits), constellation `free_connect` (targeted) |
| OB-1 | Wave 1, one build mode each, code-judged, on the workspace | `/add-eval-modes` | BUILT 10-07, uncommitted, merged and gated (typecheck:lumina 0; Lumina vitest 774 files green; tsc no new source errors): coin-counter `show-amount` β3.6, base-ten `build_two_ways` β2.0, fraction-circles `build_equal` β4.6, equation-builder `make-n` β1.1, bar-model `make_graph` β1.9. Reports `qa/open-build/<id>-2026-10-07/REPORT.md`. Owed: a browser drive per mode; class Live gates; rulings R3, R4 |
| OB-2 | Wave 2, legacy families bound to the workspace, then one build mode each | `/add-live-tutor-tools` then `/add-eval-modes` | BUILT 10-07, uncommitted, merged and gated with wave 1 (typecheck:lumina 0; Lumina vitest 780 files green, 3 load timeouts pass alone; full tsc 770 = baseline): array-grid `make_array` β1.6, fraction-bar `build_equal` β4.6, polygon-area-builder `build_area` β1.6, angle-workshop `make_angle` β1.6, shape-builder `make_shape` β1.6. All five now bound (W1). Shared build layer gained `neverSay`. Reports `qa/open-build/<id>-2026-10-07/REPORT.md`. Owed: browser drive per mode; class Live gates; rulings R5-R9 |
| OB-3L | Wave 3 literacy: the plan in **Literacy wave** below. L0 shared word judge, then the word-builder pilot, then the sweep L2-L7 | `/add-eval-modes` (L0 code-only; L6-L7 bind first with `/add-live-tutor-tools`) | planned 10-07 from the [LA G2 design review](../curriculum-design-review/la-g2-2026-10-07/index.html); nothing built |
| OB-3S | Wave 3 science: habitat-diorama "a habitat the frog survives in", food-web "a 4-link chain to a hawk", molecule "any molecule with a double bond" | `/add-eval-modes` | open |
| OB-4 | Engineering design builders onto the build layer ("I'm done!", watcher, workspace) | `/add-live-tutor-tools` | open |
| OB-5 | Text-only families publish their made quantity as a number (base-ten per place, coin cents, fraction shaded parts) so `workHistory` works | `/add-live-tutor-tools` | folds into OB-1 per family; the rest open |
| OB-6 | Modality as a first-class layer: `answers` per mode is the routing key; a coverage matrix (skill × modality) finds skills with no build | `/lumina-portfolio` | proposed |

## Rulings owed

| Ruling | Why it matters |
|---|---|
| R1: should 3 s stillness still auto-submit? A child who stops to think is checked; the pause fact and reflection never happen on 13 families | OB-1 build modes use "I'm done!" regardless; R1 decides the existing modes |
| R2: the build watcher's 👀 line on screen, or fed to the tutor as one voice | Shared-layer change (`useBuildWatcher`), so no wave waits on it |

| R3: fraction-circles `build_equal` fails a build that uses the target's own cut (asked for a fraction equal to 3/4, 4 pieces with 3 shaded is the target itself), so the mode cannot be passed with the plain `build` skill. Keep? | One line in `equalBuildMiss` |
| R4: wave-1 modes join MIXED (unpinned) sessions for coin-counter, equation-builder, bar-model, base-ten (fraction-circles left out). Keep? | Changes what unpinned lessons contain |

| R5: two-ways asks — a turned array (4×3 after 3×4) counts as different (array-grid); a shape with a hole is one shape (polygon) | One line each |
| R6: angle-workshop sends `openingDegrees` to the tutor with a "never say the degrees or the kind" rule, vs sending nothing; tolerances right ±3°, straight ≥ 177°, 5° minimum; a catalog sentence extends it to grades 4–6 | Tutor sees the work vs stays blind |
| R7: mixed (unpinned) sessions now include build modes for array-grid and polygon-area (a Grade 3 build beside Grade 6–7 formula tiers) | Same question as R4 |
| R8: shape-builder pinned `make_shape` makes no model call (code owns every ask) | Fine for code-owned asks? |
| R9: fraction-bar commits a wrong numerator/denominator step as a miss (Try again before the next step), vs only the final step committing (BalanceScale pattern) | Changes how step misses are recorded |
| ~~R10~~: ~~a real word missing from a code-owned list~~ | Withdrawn 10-07 (user): no list. Literacy builds are judged like open-builder, by a model (Jev, flash-latest fallback) reading the build against the ask |
| R11: word-builder build mode at grade 2. Contract R6 floors `simple_affix` to Grade 3 because the parts board is print. The build mode would be its own challenge type with a Grade 2 floor and decodable bases only | The pilot's scope (LA001-03-c is a grade 2 objective) |

## Gates per build mode

vitest (item builds, misses over/under, lever text) · `typecheck:lumina` 0 · domain tester drive pinned to the mode
(one over → miss → Try again keeps the build → fix → pass; 5+ watcher lines against the leak rules) · report under
`qa/open-build/<primitive>-<date>/`. No Live per mode: the class Live gate covers the tutor's words once a wave lands.


## Literacy wave (OB-3L), planned 2026-10-07

**How a literacy build is judged.** The same way open-builder is judged: no key, a model reads the build against
the ask. Open-builder sends a picture to `gemini-flash-latest` through the `judgeOpenBuild` route action and gets
back `{met, miss, noticed, nudge}`. Knowledge-check's review asks Jev (TypeSafe `systemOne`) typed questions and
lets code decide from probabilities with thresholds calibrated on a hand-labelled set (62/64). A literacy build is
text (a word, a sentence, an ordered set of cards), so the judge reads the text, not a picture:

1. **Code first, for what is structural and instant:** boxes filled, parts in prefix-root-suffix order, the row
   ends with ? when the ask is a question, the second way is not the first way again. These misses need no model.
2. **Then Jev on the build as the child made it:** state = the ask, the board, the build; typed questions such as
   `real_word` (noul), `fits_ask` (choice: yes / close / no) and `miss` (choice over the mode's miss enum, each
   with a rubric line). Code turns the probabilities into pass or a named miss. The thresholds come from a
   hand-labelled set of builds per mode (real words, non-words, real words with the wrong meaning).
3. **flash-latest as the fallback** when `typesafeConfigured()` is false, with the same output shape, the way
   open-builder's judge does it.

The verdict reaches the tutor as facts (`inspectorSaid` in open-builder); the tutor talks, the judge does not.
A literacy build is a row of tiles like equation-builder `make-n`, so the watcher is skipped and the scene publishes
counts (`partsPlaced`, `lettersPlaced`) for `workHistory`. No word list is built: "zap" passes because it is a word,
not because a list holds it.

**Open or not.** A build mode only where many builds are correct. "Spell cat" has one answer, and cvc-speller
`spell_word` already serves it. "Make a real word with short a" has dozens. Recognition modes (sort, identify,
name) get none.

| # | Item | Mode (draft name) | Judge | Grade | Covers | State |
|---|---|---|---|---|---|---|
| L0 | Shared literacy build judge: one route action (`judgeWordBuild`) with the mode's structural checks in code, then Jev typed questions over the build with code-owned thresholds, then flash-latest when TypeSafe is down. The open-builder judge and the knowledge-check review are the patterns. A labelled set per mode sets the thresholds before the mode ships | none | code + Jev | K-3 | every row below | open |
| L1 | **Pilot.** word-builder: "Make a word that means *do it again*" from a board of prefixes, roots and suffixes with their meanings. Every board word with that meaning passes (redo, replay, rewrite). Every second item asks for another word with the same affix. Misses `wrong_meaning` (happy+ly for "not happy"), `not_a_word` (un+jump), `root_only`, `affix_only`, `same_word`. A new challenge type (contract R1 "nothing is tapped" and R6 floor are the stated fork, R11) | `build_affix` | code + Jev | 2-3 | LA001-03-c (sweep lesson 3, brief 3) | open; first after L0 |
| L2 | cvc-speller: "Make a real word in the -at family" or "with the short a sound" from the letter bank in its boxes. The old OB-3 row put "-at words" on word-builder; it is phonics, so it belongs here. Misses `not_a_word`, `wrong_vowel`, `wrong_family`, `same_word` | `make_word` | code + Jev | K-1 | CVC spelling, word families | open |
| L3 | sound-swap: "Change one letter in *cat* to make a new real word" (bat, cot, cap). Letter tiles over the spoken mode | `swap_build` | code + Jev | 1-2 | phoneme substitution, word chains | open |
| L4 | phonics-blender: onset tiles (bl, st, cl, fr and single consonants) plus rime tiles (-ack, -op, -amp, -and) make a blend word; final-blend asks too. Needs PHB-1 first (split `cvce_blend`, eval-fix), because today the mode cannot serve a blend | `build_blend` | code + Jev | 1-2 | LA001-02-b (sweep lesson 9) | blocked on PHB-1 |
| L5 | rhyme-studio, pre-reader: a board of 6-8 pictures; drag two that rhyme together, then a different pair. Pictures, not print, so the watcher can run with `neverSay` = the picture words | `pair_build` | Jev (do the two picture words rhyme), code (two different pictures) | K | rhyme recognition by making a pair | open |
| L6 | paragraph-architect, legacy (bind first): sentence cards (a topic sentence, 4-5 details of which 1-2 are off topic, a closing sentence). Make a paragraph: topic first, at least two on-topic details, close last, no off-topic card. Many orders pass. It does not judge writing (that is brief 1), only organization | `build_paragraph` | code (card roles, positions), Jev (does each kept detail fit the topic) | 1-3 | LA002-02-b, partly LA002-02-a/c | open |
| L7 | sentence-builder, legacy (bind first): "Make any question about the dog" from word tiles. Code checks the tile-role pattern (question word or helping verb first, ends with ?); sense ("The ball eats the dog") needs a flash-lite check, so this one is code plus model | `build_type` | code + model | 1-3 | sentence types | open; last |

**Order and gates.** L0 then L1 alone, and L1 is driven in the running app before any sweep (pilot-then-sweep).
Then L2, L3 and L5 serially (each on a bound workspace already), L4 after PHB-1, and L6-L7 last because each needs
a binding first. Per mode: the build-mode reference steps 1-8 and the gates above. One class Live gate after the
wave, not per mode. Stop after L1 if the drive shows the tile row or the word judge is wrong for children.

**Not build modes, still owed from the same sweep** (tracker, `/eval-fix`): PHB-1, SYC-1, MP-SA1, RAS-1/2/3,
DR-G2-1, WW-T1. Brief 1 (judged topic and closing sentences) and brief 2 (listening main message and key details)
are new response modes, not builds.
