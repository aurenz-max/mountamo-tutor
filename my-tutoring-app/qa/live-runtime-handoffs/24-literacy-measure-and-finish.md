# Literacy: measure the unmeasured modes, then finish L1-L4

Date: 2026-09-29 · Executor: `/add-support-tiers` (per primitive), `/primitive-contract` (first) · Follows: [22](22-literacy-levers.md) (rulings, leak rules and gates apply unchanged) · Evidence: `qa/support-levers/reinventory-2026-09-29.md`, `sweep-inventory-2026-09-29.json`

## Why this exists

L1-L4 each closed on the modes that had saved payloads. The 09-29 sweep shows 48 of 93 literacy modes have **no saved payload**, so the sweep never drove them: whether they have levers is unknown, not absent. Several built levers (word-workout, phoneme-explorer, word-flip) may already cover them. Measure before building, then close every mode so each literacy class can reach its Live pair under the 09-28 readiness ruling.

## Rulings

Handoff 22's apply. Plus: Live only when every mode of every primitive in the class has misses and levers (09-28); phonics-blender levers approved, and `sound_dots` may re-segment the hard tier's joined row (09-28).

## Before you start

1. `/ship` anything uncommitted first.
2. **Files:** literacy primitives, `catalog/literacy.ts`, literacy generators, `w1-payloads/` literacy files. Math (handoff 23) and knowledge-check (handoff 25) run beside it. No `runtime/` edits; queue them to handoff 20/21.

## Step 1: measure (Flash only, no Live)

Generate one saved payload per unmeasured mode into `runtime/testing/w1-payloads/`, as handoff 21 S1b did for math, then re-run `JOURNEY_SWEEP_OUT=<file> npm test -- .../journeySweep.test.tsx` and record which now show `levers` and which `none`.

| Primitive | Unmeasured modes |
|---|---|
| word-workout | word_chains, read_inflected, read_compound, choose_in_context, sentence_reading |
| word-flip | plural_es, past_ed, plural_y, irregulars, past_irregular |
| story-bridge | match_setting, venn_place, sequence_two, say_different, main_idea_compare |
| phoneme-explorer | ending, medial, segment, manipulate |
| picture-vocabulary | association, opposite, sentence_frame, gradable_scale |
| story-ribbon | tell_present_account, tell_future_account, story_to_experience |
| decodable-reader | sequence, inference, main_idea |
| phonics-blender | cvce_blend, digraph, advanced |
| rhyme-studio · sound-swap | production, collection · deletion, substitution |
| one each | syllable-clapper delete_compound, oral-sentence-studio guided_writing_rehearsal, cvc-speller word_sort, read-aloud-studio expression, word-sorter match_pairs |
| Grades 2-6 (later classes) | sentence-analyzer 2, word-builder 2, genre-explorer 1, text-structure-analyzer 2 |

A payload that fails J1-J8 is a finding for the journey row (`/add-live-tutor-tools`), not a reason to skip the mode.

## Step 2: close the K-2 gaps

After step 1, build levers for every K-2 mode that is `none`. Known `none` today: letter-sound-link see_hear, keyword_match; letter-spotter name_it; cvc-speller fill_vowel; you-and-me describe_action; story-ribbon tell_connected_account; story-bridge say_alike; decodable-reader read_along; word-sorter ternary_sort; phonics-blender cvc (then its other modes, table drafted 09-28). A mode where no lever is right gets an explicit `unanswered` entry with the reason, as counting-board `recount_moved` did.

## Step 3: Live pairs

For each class that now has every mode levered: two runs, `--lever --lesson-entry` text and one `--audio` (the audio one matters for L2/L3), on a saved payload. Stop at two.

## Later

Grades 2-6 bound primitives (sentence-analyzer, word-builder, genre-explorer, text-structure-analyzer) after K-2 closes.

## Closing each slice

Contract, class report, handoff 22's class line, the brief's audit table, `WORKSTREAMS.md` row 3.1b. One HUMAN-CHECKS row per class, sound on for spoken classes.
