# Literacy levers, class L4 (K-1 vocabulary and story), part 1 — 2026-09-28

Handoff 22 L4, `/add-support-tiers`. The three primitives whose aids already rendered as tier flags now have
pullable help levers: you-and-me, story-ribbon and word-sorter. The other three (story-bridge,
picture-vocabulary, oral-sentence-studio) need new data before a lever can work and are not built.
Gate: vitest, the dry journey and a tutor replay; no Live runs.

## What was built

In each primitive, a lever is offered only where the tier withdrew the aid. The tier sets where the levers
start, so easy and untiered items offer none.

| Primitive | Help (all `shown`) | Answers | Unanswered by decision |
|---|---|---|---|
| you-and-me | `speaker_highlight` (lights the speaker's card), `actor_marker` (the object and "Did the action" on the doer's card) | `said_name`, `said_he_she` / `swapped_pronoun` | none |
| story-ribbon | `sequence_labels` and `flow_arrows` on the ribbon's SLOTS (retell); `connection_frame` (story_to_experience) | `events_missing` / `labels_listed` / `event_only`, `no_connection` | `out_of_order`: any order cue is the answer. `tense_drift`: a time model would be new capability |
| word-sorter | `group_pictures` (a picture on every mat, sorts); `filed_examples` (the learner's own credited words or pairs, once one exists) | `other_group`, `said_word_back` / `other_group` or `other_bank_word` | match_pairs `said_word_back` |

- **story-ribbon spoken misses are new.** `storyRibbonSpokenMisses` is on the assignment, and the catalog declares `misses` and `unanswered`. The other two already named their misses.
- **Catalog:** `levers: true` is set on all three. Guidance gained "beyond its levers you cannot change the screen." story-ribbon's hard reveal policy now says labels, arrows and frame "come back only as levers", so the tutor does not read the policy as forbidding a pull.
- **Contracts:** new `docs/contracts/you-and-me.md`, `story-ribbon.md` and `word-sorter.md` (none existed).
- **Saved payloads:** three were derived so the sweep and the replay reach the levers: `you-and-me.describe_independent_action` (hard), `story-ribbon.tell_past_account.hard`, and `word-sorter.binary_sort.hard` (grade 1). The existing saved payloads are untiered or K, so they show every aid and offer no lever.

**Changes from the table you confirmed:**
- **story-ribbon self-check ticks: not built.** Ticking the cards the learner has mentioned needs the transcript in the component, which is a `runtime/` change that this handoff may not make. The self-check that turns green on the story order is kept only as the easy tier's starting position and is never a lever. It is filed as an open finding (contract R5).
- **word-sorter `prototype_word` simplify: not built.** The group labels are generated, so there is no code pool of words to draw an easier one from. Using another session word would spend a later item.
- No primitive has a simplify lever, as proposed.

**Leak rules held in code:**

| Rule | Test |
|---|---|
| you-and-me: no lever text or fact names I/you/myself/yourself | `leverTextLeak`, unit and mounted |
| story-ribbon: marks belong to slots; after a card swap the labels stay First/Next/Last by place; no event or picture label in lever text | mounted swap test; unit test per mode |
| word-sorter: no pictures lever when a mat picture is the item's own picture; filed words are only credited ones, never the current word; nothing marked right | `groupPicturesLeak`; mounted |

## Gate results

- **New lever tests:** 6 files, all pass: `youAndMeLevers`, `YouAndMe.levers.workspace`, `storyRibbonLevers`, `StoryRibbon.levers.workspace`, `wordSorterLevers`, `WordSorter.levers.workspace`. Each mounted test checks:
  - the DOM and scene fact change in the pull's commit;
  - the credit carries `assisted` and `levers`;
  - a repeat pull is refused;
  - the levers reset on the next item.
- **Literacy + catalog + activityContract suites:** 2208/2208 pass.
- **Dry journey (L4 rows):** 8/8 pass, including J9 on the hard payloads. The full sweep run alone has one failure, `base-ten-blocks.read_blocks` J9 (`said_total`, `other_block_count`). That is a math primitive this slice does not touch, so it belongs to handoff 21.
- **Typecheck:** `typecheck:lumina` 0; full tsc 770, below the 773 baseline.
- **Tutor replay** (gemini-3.8-flash, 5 samples per moment, `qa/tutor-reports/replay/<id>-2026-09-28.json`):

| Payload | Pulled a lever itself at "stuck" | Flags |
|---|---|---|
| you-and-me describe_independent_action (hard) | 5/5 `actor_marker` | 0 |
| story-ribbon tell_past_account (hard) | 5/5 `sequence_labels` | 0 |
| word-sorter binary_sort (hard, gr 1) | 5/5 `group_pictures` | 0 |

The tutor described the change after the pull in every sample, for example: "The words First, Next, and Last are now under each spot on the ribbon."

- **Live:** none run. Handoff 20 Part D sets no Live run for a lever gate, and the class Live pair waits until every L4 mode has levers (user ruling 09-28).

**Code vs tests:**
- Production code: about 250 lines (three lever modules, the story-ribbon spoken misses, component wiring, catalog).
- Tests: about 390 lines.
- Contract docs: about 120 lines.

## Evidence classes

Every failure is **documented** (catalog `commonStruggles`, the existing spoken miss lists) or **inferred**. There is no observed-real or observed-synthetic evidence beyond the journey's scripted wrong answers.

## Part 2a: story-bridge (2026-09-29)

The stories are heard, not printed, so each lever uses story ONE's material or splits the question. No lever marks, pictures or re-reads a story-two candidate.

| Mode | Help lever | Carrier | Answers |
|---|---|---|---|
| match_character | `anchor_action`: the first friend's event picture on that friend's card only; the tutor re-reads that one sentence | both | `same_look`, `other_character` |
| match_setting | `setting_focus`: a place label under each story picture; the tutor re-reads the two opening sentences | both | `same_for_different`, `different_for_same` |
| venn_place | `two_questions`: two empty checks under the detail, one per friend; the tutor asks about each in turn | both | `both_for_one`, `one_for_both`, `other_side` |
| sequence_two | `anchor_timeline`: story one's three events in order, the asked one lit; story two stays mixed | shown | `earlier_event`, `later_event` |

- **No lever:** the spoken modes say_alike, say_different and main_idea_compare, by decision. They are open comparisons with no bounded miss, and their only material is the story text, which "Hear both stories again" already re-reads.
- **Leak rule `leverLeak`:** no lever text names the correct choice or quotes story two's sentence. A unit test builds a leaky anchor sentence and checks that the lever is withheld.

**Gates:**
- Lever tests 13/13.
- Literacy + catalog suites 2221/2221.
- Dry journey: story-bridge rows 2/2.
- `typecheck:lumina` 0; tsc 770.

**Replay** (`qa/tutor-reports/replay/story-bridge-2026-09-29.json`):
- On match_character the tutor pulled `anchor_action` itself at miss (5/5) and at stuck (5/5). It described the change only after the pull.
- Two flags came from the harness, not the lever:
  - Start, 5/10 `no_key_before_try`: the tutor reads story one aloud, and story one contains the answer friend's name ("Pig"). That is the checker scoring story text as a key (handoff 20 Part C).
  - say_alike at stuck (no lever; not flagged): the tutor retells both friends' actions side by side ("Cow shared an apple with Pig, and Ant shared an apple with Bee"), which nearly states the comparison. That is spoken-mode tutor wording, owned by `/add-live-tutor-tools`.

## Part 2b: picture-vocabulary (2026-09-29)

**Generation change first.**
- The noun pool schema now requires two more fields per noun:
  - `category`: what the thing itself is (a cup is a dish, not food).
  - `clue`: what it does or where it is found.
- Code checks both. An invalid category or clue drops only that field, and the noun stays usable.
- `clueLeak` rejects a clue that says the word, a form of it, or its sounds, letters or rhymes. The same check runs again at item build, so an older or hand-authored payload cannot pass a leaking clue to the tutor.

**Probe** (`scripts/picture-vocabulary-levers-probe.mjs`, receptive_match and naming on three topics, output in `qa/eval-reports/picture-vocabulary-levers-probe/`):
- Clues on 30/30 items, with 0 clue leaks. Every card has a kind.
- The first run labelled cup, bowl and plate as "food". The category instruction was tightened ("a cup is a dish"), and on the second run they came back as "dish".
- The practice item is available on 12/15 receptive items. On the rest, the session has no spare card of another kind.

| Mode | Misses | Help | Simplify |
|---|---|---|---|
| receptive_match | `same_category`, `other_category` (`other_picture` when a payload records no kinds) | `function_cue`: a clue card, said by the tutor | `two_cards_far`: an ungraded item on a foil-only session word with one card of another kind; never a session answer or a card of the current item |
| naming | `category_word`, `other_thing` (spoken) | `function_cue` | none |

- **No lever yet:** opposite, association, gradable_scale and sentence_frame. They name no misses.
- **Guidance:** the catalog now bans hints at the first sound, letters or rhymes. The old naming payload (no clue, so no lever) had the tutor say "it starts with the 'rrr' sound" at stuck. After the ban: 0 sound hints in 40 samples. The guidance was trimmed to stay under the 2000-character cap, and every rule was kept.

**Gates:**
- Lever tests 26/26.
- Literacy + catalog + generator suites: 2522 pass.
- Dry journey: picture-vocabulary rows 4/4. The two new payloads are real generations.
- activityContract 75/75.
- `typecheck:lumina` 0; tsc 770.

**Replay** (`qa/tutor-reports/replay/picture-vocabulary-2026-09-29.json`):
- On the generated payloads the tutor pulled `function_cue` itself at miss and at stuck in 20/20 samples. It said the clue after the card appeared.
- 0 flags.

## Part 2c: oral-sentence-studio (2026-09-29)

**Generation change first.**
- The schema requires `meaningEmoji0/1`: one meaning picture per target word.
- Validation is soft. A missing, doubled or scene-repeating picture drops the pictures, never the challenge. Fallback scenes carry none.

**Probe** (`scripts/oral-sentence-studio-levers-probe.mjs`, three modes on two topics):

| Picture fields | Pictures | Rejections | Fallbacks |
|---|---|---|---|
| Committed generator (A/B, 6 sessions) | — | 9 | 1 |
| Required, first run | 16/18 | not compared | 2 (the 2 items without pictures were fallbacks) |
| Required (A/B, 6 sessions) | — | 15 | 1 |
| Optional | 13/18 (Gemini omitted them) | — | — |
| Required, final probe | 18/18 | 6 | 0 |

Rejections look like noise across runs, and fallbacks stay at 0–1. The fields stay required, because optional fields cost 5 items their pictures.

**Misses (new, spoken)** — `oralSentenceSpokenMisses`, the judging contract's own categories: `words_listed`, `fragment`, `word_missing`, `word_misused`, `off_task`.

**Levers:**
- `sentence_strip` (help, both): empty "Who?" and "What happens?" boxes beside the word chips; nothing is filled in. Answers `fragment` and `words_listed`.
- `word_pictures` (help, both): a meaning picture under each word. Answers `word_missing` and `word_misused`. Withheld when a picture repeats a scene picture (`wordPicturesLeak`), because that would map the word onto the scene's content.
- `off_task` has no lever by decision: the fix is the task itself, which the tutor restates.
- No simplify: two words in one sentence is the mode.

**Gates:**
- Lever tests 26/26.
- Literacy + catalog + generator suites 2527 pass.
- Full journey sweep 245/245.
- activityContract 75/75.
- `typecheck:lumina` 0; tsc 770.

**Replay** (`qa/tutor-reports/replay/oral-sentence-studio-2026-09-29.json`):
- 0 flags.
- On the generated payloads the tutor pulled a lever itself at stuck (describe_scene 5/5, use_story_words 5/5) and at the describe_scene miss (5/5).
- Every described change matched a pull the tutor actually made.
- On the old story-words payload (strip only), the tutor gave word-meaning hints at stuck instead of pulling (0/5). The runtime's second-wrong rule still auto-pulls help.

## L4 status

All six L4 primitives now have levers on their answerable modes:
- you-and-me
- story-ribbon
- word-sorter
- story-bridge (tap modes)
- picture-vocabulary (receptive_match, naming)
- oral-sentence-studio

**Still without levers, by decision or pending spoken misses:**
- story-bridge's three spoken modes.
- picture-vocabulary's opposite, association, gradable_scale and sentence_frame.

Because of those modes, L4 is not ready for the class Live pair: the user ruling of 09-28 requires every mode to have misses and levers first.

HUMAN-CHECKS #176: a browser sitting on the three primitives at hard tier, with sound on (all answers are spoken).
