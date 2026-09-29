# Literacy levers: phonics taps, then spoken sound work, then reading

Date: 2026-09-27 · Executor: `/add-support-tiers` (per primitive), `/primitive-contract` (first, per primitive), `/add-live-tutor-tools` (rhyme-studio directives only) · Runs beside: [21](21-lever-rollout.md) (trigger ladder + math, in progress) · Draft designs: [`qa/support-levers/inventory-2026-09-27/levers-literacy.json`](../support-levers/inventory-2026-09-27/levers-literacy.json), browsable in `plan.html` (Literacy tab)

## Why this exists

No literacy primitive has a lever. When a K-2 reader gets a phonics or phonemic-awareness item wrong, the tutor's only move is `begin_help`, which changes nothing on screen. This handoff gives the foundational literacy primitives help and simplify levers, class by class, with the same gate as math. Handoff 21 owns the shared parts: the trigger ladder in `runtime/` and J9. This handoff edits only literacy primitive files and the literacy catalog.

## User rulings, do not reopen

All of handoff 21's rulings apply unchanged. These are the ones that matter most here:

1. **A primitive is done when its vitest gate passes.** After a class passes, 1-2 Live runs cover the whole class. Never run Live per primitive.
2. **Triggers are code** (handoff 21 S2):
   - A second wrong answer auto-pulls help.
   - "I'm stuck" before any attempt gets help only.
   - A wrong answer with help pulled gets simplify.
   - Removing a choice is assisted work, never unaided credit.
   - A single-try item gets one assisted try after a pull.
3. **Levers are designed from why learners fail, not scripted** (09-26). The tutor says each lever in its own words.
4. **Read-aloud is `aiDirectives`**, and a pre-reader's lever needs a shown or voiced carrier (S6). A lever that only adds print does not count at K.

## The literacy leak rules (the reason this is its own handoff)

The draft found the same four leak patterns across literacy. Every lever's leak test checks the one that applies:

| Rule | Why | Examples |
|---|---|---|
| **Model pair outside the item.** Help on a recognition or production item acts on words from a family or sound that no item in the session uses | Any emphasis on the item's own words answers it: stretching a rime answers recognition, and chanting syllables gives the count | rhyme-studio `contrast_model` (sock/rock beside sock/sun), phoneme-explorer `position_model`, syllable-clapper `clap_model`, sound-swap `swap_model` |
| **Count only what the learner did.** A counter counts the learner's pushes, claps or tokens, never the target | Pre-drawn Elkonin boxes give the segment count; a clap counter that stops at the target gives the syllable count | `push_tokens`, `clap_counter`, cvc `sound_tokens` |
| **No audio of unread print.** On a cold read, levers are visual only | The voice would read the word the learner is being asked to decode | word-workout, decodable-reader, read-aloud-studio, interactive-book `read-focus-word`: `sound_dots`, `tracking_underline`, `chunk_divider`, `changed_letter` |
| **Never show the answer word in print before credit** | Readers would read it | sound-swap: the new word's letters stay off screen; letter-spotter: the reference uses the other case, never the same form |

These rules also separate a simplify lever from a mode change (R2). Production never becomes a choice. A spoken answer never becomes a tap.

## Before you start (S0)

1. **File ownership.** Another session holds `runtime/**`, `backend/`, and the math catalog and math primitives. The handoff 21 session is working on `runtime/` S2 and math. This handoff touches only `primitives/visual-primitives/literacy/**` (or wherever each literacy primitive lives), `service/manifest/catalog/literacy.ts`, and the literacy generators. If a lever seems to need a `runtime/` change, stop and queue it to handoff 21. Don't edit `runtime/`.
2. **Contracts first (B1).** Only `phonics-blender` and `letter-workshop` have contract docs. Run `/primitive-contract <id>` before touching each primitive.
3. **Triggers before 21 S2 lands.** Levers can be built and fully tested before S2 lands. The mounted test drives `pull_lever` directly, and today's "I'm stuck" observer already pulls them. Automatic pulls on a second wrong answer begin when S2 lands, with no further literacy work.
4. `/ship` anything uncommitted in the literacy files first.

## L1: phonics taps (gesture, misses named, ready now)

Work on the gesture modes only. The spoken modes of these primitives join L2 or L3.

| Primitive · mode | Misses (built) | Draft levers | Notes |
|---|---|---|---|
| ✅ `cvc-speller` spell_word (09-28, [report](../eval-reports/cvc-speller-levers-2026-09-28.md)) | `cvcMiss`: which box is wrong, `letters_out_of_order` | help `sound_tokens` (the learner pushes one token per sound they say), `vowel_keyword_strip`; simplify `small_bank_word` | The catalog forbids sounding out the item word, so help acts on keyword letters and the learner's own tokens |
| ✅ `letter-sound-link` hear_see (09-28, [report](../eval-reports/letter-sound-link-levers-2026-09-28.md)) | `letterSoundMiss`: `other_short_vowel`, `voicing_partner`, `other_letter` | help `keyword_under_both` (answers the vowel miss), `voice_feel_model` (answers the voicing miss); simplify `far_letter_pair` | `showKeywordAnchor` and `showSharedSoundHint` exist as generation flags; make them pullable |
| ✅ `letter-spotter` find_it, match_it (09-28, [report](../eval-reports/letter-spotter-levers-2026-09-28.md)) | `letterSpotterMiss`: `mirror_form`, `same_shape_family`, `other_letter` | help `other_case_reference`, `row_scan`, `mirror_model`; simplify `small_far_grid`, `two_far_choices` | Shape descriptions are banned in voice, so help is visual. The reference must never be the same form as the target |
| ✅ `word-workout` picture_match (09-28, [report](../eval-reports/word-workout-levers-2026-09-28.md)) | `wordWorkoutMiss`: `same_start`, `same_end`, `same_vowel`, `other_word` | help `sound_dots`; simplify `two_far_pictures` | No audio of the printed word |
| ✅ `interactive-book` find-feature (09-28, [class report](../eval-reports/levers-literacy-L1-2026-09-28.md)) | `interactiveBookMiss`: `tapped_title` ... `tapped_page_number` | help `model_page` (a page outside the book with its parts outlined); simplify `two_part_page` | Never outline the item page's own parts |

**L1 closed 09-28 on the free gates** ([class report](../eval-reports/levers-literacy-L1-2026-09-28.md), HUMAN-CHECKS #172). **Live gate passed 09-29** (handoff 26, [report](../tutor-reports/h26-live-gates-2026-09-29.md)): cvc-speller spell_word, 2nd-wrong auto-pull, marks on screen before the tutor's words. Run 1 (letter-spotter) found `row_scan` undrawn until Try again (LB-16, fixed).

## L2: spoken sound work (phonemic awareness)

`rhyme-studio` goes first. It is handoff 18's C1 and the pilot for spoken levers and model pairs.

✅ **rhyme-studio** done 09-28 ([report](../eval-reports/rhyme-studio-levers-2026-09-28.md)): directives removed, `rhymeModels.ts` shared pool, levers on all four modes (`hear_pair_again` dropped: the word card already repeats the question).

1. **Fix rhyme-studio's stale directives first** (`/add-live-tutor-tools`). The catalog `aiDirectives` still order bracketed `[RS_ITEM]` turns for a retired runner (`literacy.ts:1672`). Removing them is the fix; confirm first that workspace sessions receive them.
2. **Build the model pair once.** Extend `pickModelRhymePair` (5 pairs today) with emoji and an onset foil, and exclude every family used in the session. phoneme-explorer, sound-swap, syllable-clapper and poetry-lab reuse it.
3. rhyme-studio levers (draft):
   - recognition: `contrast_model`, `hear_pair_again` (even prosody, no stretch); simplify `far_pair`
   - identification: `contrast_model`, `name_choices` (restores `namesChoices`); simplify `far_foil_item`, which is a new target, because swapping the foil on the same item repeats it (R3)
   - production and collection: `onset_swap_model`, `onset_strip` (picture cards of single sounds that the learner combines with the rime); simplify `dense_family_item`
4. Then `phoneme-explorer` (`push_tokens` for segment; `showBlendCue`, `showOperationDetail` and `showExampleWord` become pullable), `sound-swap`, `syllable-clapper` (the catalog's stretched-but-joined rung is help; chanted parts are an answer), and `word-flip` (a before/after card pair modelling the rule on a different word).

**L2 closed 09-28 on the free gates** ([class report](../eval-reports/levers-literacy-L2-2026-09-28.md), HUMAN-CHECKS #173): ✅ rhyme-studio · ✅ phoneme-explorer · ✅ sound-swap · ✅ syllable-clapper · ✅ word-flip. Changes from the draft: `hear_pair_again` and `clap_counter` dropped, `start_picture` not built (see the report). **Live gate passed 09-29** (handoff 26, [report](../tutor-reports/h26-live-gates-2026-09-29.md)): rhyme-studio identification `--audio`, the tutor pulled `contrast_model` after "I'm stuck".

**Misses:** every spoken mode here names `proposed:*` ids that don't exist yet. They need `spoken_miss` (handoff 20 Part B, blocked on `runtime/`). Until it lands, a wrong answer judged by the tutor or JEV feeds the trigger ladder without a miss, and `nextLever` goes help-first. Put the proposed ids in each lever's `answers` now, so miss-driven choice works once spoken misses land, and add them to the J9 unanswered list until then.

## L3: decoding and reading

Build **one shared print-support overlay** in the Lumina kit, used by every cold-read primitive: `sound_dots` under graphemes, a `tracking_underline`, a `chunk_divider`, and a `changed_letter` highlight. It is visual only and plays no audio. Primitives:

- ✅ `word-workout`'s spoken modes (09-28)
- ✅ `decodable-reader` (plus `story_region` on comprehension, only after a miss) (09-28)
- ✅ `read-aloud-studio` (09-28)
- ✅ `interactive-book` read-focus-word (09-28)
- `phonics-blender`, bound but not inventoried: inventory and lever table DRAFTED 09-28 in the class report; **user OK 09-28 to build**, and `sound_dots` MAY re-segment the hard tier's joined row into separate sounds.

Simplify levers use a shorter line, a CVC word in place of the focus word, or two choices where there were three. Each simplify item is built in code from a decodable pool and never contains the item's own words (R3).

**L3 closed 09-28 on the free gates for four of five primitives** ([class report](../eval-reports/levers-literacy-L3-2026-09-28.md), HUMAN-CHECKS #174).
- The overlay is `ui/LuminaPrintSupport.tsx`; the pool is `literacy/decodablePracticeLines.ts`.
- Changes from the draft:
  - "Two choices where there were three" is not built: on the same question it repeats the item (R3).
  - read-along `picture_panels` is not built.
  - word-workout's `chunk_divider` waits for a first try.
  - `levers: true` is now set on word-workout and interactive-book, which fixes their L1 modes too.
- **Live gate passed 09-29** (handoff 26, [report](../tutor-reports/h26-live-gates-2026-09-29.md)): word-workout sentence_reading `--audio`, observer `tracking_underline` on screen before it was described.

## L4: K-1 vocabulary and story

Most of these levers already exist as generation flags and only need to become pullable, so they are the cheapest in literacy:

- `story-ribbon`: sequence labels, flow arrows, self-check, connection frame.
- `word-sorter`: `showBucketEmojis`, `showFiledWords`.
- `you-and-me`: `showSpeakerHighlight`, `showActorMarker`.
- `story-bridge`: gesture misses are already named. Help re-reads only the anchor material; action icons on the candidates would turn comprehension into picture matching.
- `oral-sentence-studio`: meaning pictures for the target words.
- `picture-vocabulary`: first, **record a relation between each foil and the target** (category or sound). Today the foils are random, so a wrong tap cannot name a miss. Cues that name a category or function are safe; a first-sound cue gives away part of the answer.

**L4 part 1 closed 09-28 on the free gates** ([report](../eval-reports/levers-literacy-L4-2026-09-28.md)): ✅ you-and-me · ✅ story-ribbon · ✅ word-sorter (help levers only; offered where the tier withdrew the aid). Changes from the draft: story-ribbon self-check ticks not built (needs the transcript in the component, a `runtime/` change); the easy order self-check is an open finding (contract R5); no simplify on any of the three. ✅ story-bridge 09-29: one help lever per tap mode from story one's material; spoken modes no lever by decision. ✅ picture-vocabulary 09-29: generator records each card's kind and a leak-checked clue; receptive_match misses named; `function_cue` + `two_cards_far`. ✅ oral-sentence-studio 09-29: generated meaning pictures, spoken misses from the judging contract, `sentence_strip` + `word_pictures`. **L4 closed 09-29 on the free gates** ([report](../eval-reports/levers-literacy-L4-2026-09-28.md), HUMAN-CHECKS #176). Not Live-ready: story-bridge's spoken modes and four picture-vocabulary modes have no misses or levers yet.

**K-2 closed 09-29 (handoff 24 step 2):** every K-2 mode measured and levered or ruled out ([report](../eval-reports/levers-literacy-K2-close-2026-09-29.md)); phonics-blender built. L1's three primitives now set `levers: true`.

## Later (not this handoff)

- **Grades 2-6, bound:** sentence-analyzer, word-builder, genre-explorer, text-structure-analyzer. These use the same method with spotlight help and fewer or farther choices.
- **Unbound:** story-talk, letter-workshop, spatial-path, story-map, sentence-builder, spelling-pattern-explorer, context-clues-detective, poetry-lab, story-planner, reading-repair-studio. Each gets levers after its W1 binding (`qa/workspace-rollout/ROLLOUT.md`).
- **Writing and open tasks (P3):** no levers.

## The gate

**Per primitive, vitest only:**

| Test | What it proves |
|---|---|
| Miss table | Gesture modes: extend the existing `it.each`. Spoken modes: the proposed ids are listed in the catalog as unanswered for J9 |
| Leak | Each lever follows its literacy leak rule above on saved payloads. For simplify: the answer is recomputed, the item uses none of the learner's item's words (R3), and it is not a different modality (R2) |
| Carrier | For the K band, every lever is `shown` or `both`, or it is `voiced` and its scene fact is safe to say aloud (states no answer) |
| `nextLever` + J9 | Every miss is answered or listed as unanswered |
| Mounted pull | The DOM changes, the next attempt carries the lever, simplify is ungraded and returns to the full item, and only the unaided answer is credited |
| Gates | `typecheck:lumina` 0; full tsc at or below baseline |

**Per class, Live (paid):** after every primitive in the class passes, run one primitive twice. Every L1-L3 primitive already has a `liveJourneySpec.ts` row.

```
run_live_runtime.py --primitive <id> --mode <mode> --lever --lesson-entry --runs 1
run_live_runtime.py --primitive <id> --mode <mode> --lever --lesson-entry --audio --runs 1
```

For L2 and L3 the audio run is the one that matters, because the answer is spoken. These runs check only that a lever is pulled without prompting and that the screen changes before the tutor describes it. They do not check whether a particular lever is right; vitest owns that. Budget: `LIVE_TESTING.md`.

## Closing each slice

- Update the primitive's contract, the brief's audit table (`docs/SUPPORT_LEVERS_BRIEF.md`), `WORKSTREAMS.md` Phase 3, and this file's class table.
- At the end of each class, write `qa/eval-reports/levers-literacy-<class>-<date>.md` with the vitest counts, the two Live transcripts summarized, and the raw JSON kept.
- File one HUMAN-CHECKS row per class for a browser sitting, **with sound on** for L2.
- Stop and report to the user at the end of each class.
