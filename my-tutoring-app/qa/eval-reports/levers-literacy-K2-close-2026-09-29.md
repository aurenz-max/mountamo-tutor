# Literacy K-2: measured, then closed (handoff 24 steps 1-2)

Date: 2026-09-29 · Executor: `/add-support-tiers` · Handoffs: [24](../live-runtime-handoffs/24-literacy-measure-and-finish.md) (this), [22](../live-runtime-handoffs/22-literacy-levers.md) (rulings and leak rules) · Gate: vitest + dry journey + tutor replay; no Live.

## Result

Every K-2 literacy mode now either publishes levers on its saved payload or has no lever by a recorded decision. All 93 literacy modes have a saved payload (48 were new today).

| Gate | Result |
|---|---|
| Dry journey (J1-J9), every saved payload | 309/309 |
| Literacy vitest | 119 files, 2134 tests |
| `typecheck:lumina` | 0 |
| Full tsc | 770 (baseline 773) |
| Tutor replay, 6 primitives × every mode × 5 samples | see below |

## Step 1: measure

48 new payloads from `save_payload.py` (one Flash generation per mode). On them, 25 modes already showed levers and 20 showed none; the other 3 were Grade 3-6 (retried later). Of the 20:

| Why none | Modes | Now |
|---|---|---|
| **Gap found only by measuring:** phoneme-explorer medial asked all five short vowels, and ending asked final n/p/t/g, so the CVC pool had no model or practice word left | medial (ending lost its simplify the same way) | fixed: long-vowel pool (rain, mail, feet, seal, boat, soap) |
| Levers exist but only where the tier withdrew the aid; a no-tier payload shows every aid | story-ribbon ×4, word-sorter ×2, you-and-me describe_action | hard-tier payloads added; all show levers |
| Not built | cvc-speller ×2 spoken, letter-sound-link ×2 spoken, letter-spotter name_it, picture-vocabulary ×4, phonics-blender ×4 | built (below) |
| By decision | story-bridge say_alike, say_different, main_idea_compare; read-aloud-studio expression; decodable-reader read_along | unchanged |
| Grades 2-6 | sentence-analyzer, word-builder, genre-explorer, text-structure-analyzer | later |

Journey rows that cannot drive their mode (baseline, `/add-live-tutor-tools`): SW-L1 rhyme-studio production and collection (spoken answer, no code-owned key); SW-L2 read-aloud-studio expression (any phrase plan is accepted).

## Step 2: what was built

Every new help lever on a spoken mode is a model on material outside the session. The relation or sound is the answer on these modes, so help never acts on the item's own words (handoff 22 "model pair outside the item").

| Primitive · modes | Lever (kind, carrier) | Answers | Leak rule in code |
|---|---|---|---|
| cvc-speller fill_vowel, word_sort | `middle_model` (help, both): another picture word in three boxes, middle lit | whole_word, first_sound, last_sound, letter_name | `middleModelLeak`: no session word or picture; middle sound none the session asks (long-vowel word when all five are asked) |
| letter-sound-link see_hear, keyword_match | `letter_model` (help, both): another letter of the same sound kind; its picture too on keyword_match | see_hear: letter_name, keyword_word, added_vowel · keyword_match: all three | `letterModelLeak`: no session letter, keyword or picture |
| letter-spotter name_it | `first_letter_model` (help, both): another picture word, printed, first letter lit | said_the_word, later_letter, letter_not_in_word | `firstLetterModelLeak`: first letter no session target, word in no session sentence |
| picture-vocabulary opposite, association, gradable_scale, sentence_frame | `opposite_model`, `goes_with_model`, `scale_model`, `frame_model` (help, both) | new named misses: said_base_word, not_opposite, no_link, given_rung, off_scale, does_not_fit | `modelLeak`: no word, base, scale or frame word of the session |
| phonics-blender cvc, cvce_blend, digraph, advanced | `blend_slide`, `sound_dots` (hard's joined row only, ruling 09-28), `tracking_arrow` (all help, shown); `name_sound_model` (help, both); `short_word` (simplify) | all six misses | visual levers voice nothing; model letter in no session word; practice word never a session word or its ending (at for cat) |

No lever, by decision: cvc-speller `other_vowel` and letter-sound-link `other_sound` (only the item's own vowel or keyword separates the sounds, and R3 keeps those hidden before credit). No simplify on the new spoken-mode levers: another item of the same mode asks the same thing, not less.

**Also found and fixed.**
- `levers: true` was missing on cvc-speller, letter-sound-link and letter-spotter, so their tutors never received the lever doctrine. It is now set on all three. letter-sound-link's guidance was trimmed from 2212 to under 2000 characters with every rule kept.
- `contentSpokenMisses.test.ts` and two letter-sound-link tests pinned "no levers or misses on the spoken modes"; they were updated to the new behaviour. One of them now shows the trigger ladder: "I don't know" before a try pulls `letter_model` as help.

**Filed.** WS-2 (`EVAL_TRACKER.md`, `/eval-fix`): the saved K ternary sort gives word cards the same emoji as their group (pup 🐶 under Dogs 🐶), so at easy the sort is picture matching, and at hard `group_pictures` is rightly withheld on that item. The sweep baselines J9 on `word-sorter.ternary_sort` until the generator rejects a word emoji equal to a bucket emoji.

## Tutor replay (text, gemini-3.8-flash, 5 samples per moment)

Reports: `qa/tutor-reports/replay/<id>-k2close-2026-09-29.json`.

| Primitive | Flags | Read by hand |
|---|---|---|
| cvc-speller, picture-vocabulary, phonics-blender, phoneme-explorer | 0 | clean |
| letter-sound-link | hear_see miss 2/15 `no_key_before_try` | false positive already filed (the tutor repeats the question's own sound "/sss/") |
| letter-spotter | find_it lever 2/15 | false positive: the named letter is find_it's stimulus, not its key |

- **name_it (letter-spotter), measured against the 09-28 replay without the lever:** the tutor said the item's first sound at "stuck" in 4 of 5 samples on 09-28, in 1 of 5 on today's first run, and in 0 of 5 on the re-run. With the model on offer, the tutor pulls it itself on the first miss (5 of 5) and describes the model after the visible receipt.
- **Not flagged by the checks, found by reading:** on letter-sound-link see_hear "stuck", the tutor does not pull `letter_model` (0 of 5). It hints "the sound a hissing snake makes", which is the answer said as an image. The 09-28 letter-spotter replay shows the same hint, so it predates these levers. In a session the observer's ladder pulls the lever on "I'm stuck". Queued for guidance wording (`/add-live-tutor-tools`), together with a replay check for sound imagery (handoff 20 Part C).

## Size

About 590 production lines (one new module, `phonicsBlenderLevers.ts`, 124 lines; the rest in 12 existing literacy files and the catalog). About 410 test lines. This report and the queue and contract edits are on top of that.

## Next

- **Step 3 (Live pairs)** needs one user ruling first: story-bridge's three spoken comparisons have no misses and no levers. Either they get spoken misses (handoff 20 Part B), or they are ruled out of L4's class gate. Every other K-2 class has every mode levered.
- WS-2 generator fix (`/eval-fix`).
- The see_hear imagery hint (`/add-live-tutor-tools`).
- Grades 2-6: sentence-analyzer, word-builder, genre-explorer, text-structure-analyzer (all measured; all none).

HUMAN-CHECKS #179.
