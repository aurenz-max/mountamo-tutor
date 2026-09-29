# Literacy levers, class L2 (spoken sound work) — 2026-09-28

Handoff 22 L2. All five phonemic-awareness primitives now have help and simplify levers on every mode. Every
answer stays spoken: no lever turns a spoken answer into a choice or a tap. Help acts on code-owned model words
the session never uses, or moves what is already on screen without adding the answer; simplify opens an
ungraded practice item of the same mode on words and sounds the session never uses. rhyme-studio, the pilot,
has its own report: [rhyme-studio-levers-2026-09-28.md](rhyme-studio-levers-2026-09-28.md).

## Primitives

| Primitive | Help | Simplify |
|---|---|---|
| rhyme-studio | `contrast_model` (recognition, identification), `name_choices` (hard tier only), `onset_swap_model`, `onset_strip` (production, collection) | `far_pair`, `far_foil_item`, `dense_family_item` |
| phoneme-explorer | `position_model` (isolate, ending, medial), `name_cards`, `example_word` (tier-withdrawn only), `slide_tiles` (blend), `push_tokens` (segment), `mark_position`, `operation_detail` (manipulate) | `two_cards_far`, `short_blend`, `two_sound_word`, `first_sound_change` |
| sound-swap | `swap_model`, `mark_target_sound` | `easier_operation_item` |
| syllable-clapper | `part_beats` (blend), `clap_model`, `stretched_joined` (count; voiced, tier-withdrawn echo only), `delete_model` (delete) | `two_part_blend`, `fewer_parts_word`, `drop_first_part` |
| word-flip | `rule_model_cards` (regular), `irregular_model` (irregular) | `familiar_noun`, `common_irregular` |

Shared pool: `rhymeModels.ts` (model rhyme sets with an onset foil, the K word menu moved from the generator,
five practice-only families). phoneme-explorer's CVC pool and word-flip's practice draw on it or on the
primitive's existing model pairs. Each primitive got a contract doc (none existed).

## Design changes from the draft

- **rhyme-studio `hear_pair_again` dropped.** It changes nothing on screen, and tapping the word card already asks the tutor to repeat the question.
- **syllable-clapper `clap_counter` dropped.** The 2026-08-16 port removed the on-screen clap button and tally because the tally did the counting, which is the act the primitive trains (catalog comment). `clap_model` answers `count_one_over` instead.
- **sound-swap `start_picture` not built.** Starting words carry only a prose caption, no picture, so there is nothing to show a pre-reader.
- **Tier aids made pullable only where the tier withdrew them:** phoneme-explorer `example_word`, `operation_detail`, `name_cards`; rhyme-studio `name_choices`; sound-swap `mark_target_sound` on substitution. Where the tier already shows the aid, the lever is not offered.
- **rhyme-studio's stale `aiDirectives` removed.** Bound sessions send `tutoring: null`, so no workspace tutor received them.

## Misses

Every mode here is judged from speech, and spoken misses are not emitted yet (handoff 20 Part B). Each mode's
proposed ids are declared in the catalog, carried in the levers' `answers`, and listed as unanswered for J9.
Until they land, `nextLever` goes help-first.

## Gates

| Gate | Result |
|---|---|
| New lever tests (pure + mounted), 10 files | 89 pass. Pure: leak rules (model and practice words never a session word, sound or ending), practice keeps the mode, carriers, catalog misses. Mounted: a pull changes the DOM and scene in one commit, the item's own words stay untouched or blank, practice is ungraded and judged from speech, the full item returns, the credit carries `assisted` + `levers`. |
| Literacy + live-activity + pip suites | 4058 pass, 1 fail: `TesterLeverBench.test.tsx` (number-line summary, 84% expected), in files owned by the handoff 21 session's uncommitted work; nothing here touches them |
| Dry journey (`journeySweep`) | passes on every saved payload |
| `typecheck:lumina` | 0 |
| Full tsc | 773 (L1 baseline 775); none in files touched here |

**Tutor replay** (text model, 5 samples per moment, `qa/tutor-reports/replay/<id>-2026-09-28.json`):

| Primitive · payload | Pulled a lever itself at "stuck" | Flags |
|---|---|---|
| rhyme-studio recognition, identification | 10/10 (`contrast_model`; also 10/10 at "miss") | recognition 0. identification 19, all the tutor reading the two choices at K, which `namingChoices` allows (checker) |
| phoneme-explorer isolate, blend | 10/10 | 0 |
| sound-swap addition | 5/5 (`swap_model`; also 5/5 at "miss") | 0 |
| syllable-clapper blend, count | 10/10 | 2: "one dot for each clap" on a one-part item, read as the count (checker) |
| word-flip plural_s | 5/5 (`rule_model_cards`; also 5/5 at "miss") | 0 |

In every sample the tutor described the model words that were actually on screen (bee/tree, in/pin,
napkin, hat/hats) and never stretched, split or chanted the item's own word before a try.

**One replay finding, fixed by reordering.** On sound-swap's first run the tutor pulled `swap_model` while
the dry journey had recorded `mark_target_sound`; the replay answered with a packet that had no model, and the
tutor invented one ("in + /w/ = win", "an + /m/ = man", the second rhyming with a session answer). In a real
session the receipt carries the model, so this is a replay gap (queued, handoff 20 Part C). `swap_model` is
now the first help lever, so the ladder's default matches the tutor's choice, and the rerun shows the real
model in 15/15 samples.

Production and collection (rhyme-studio) and ending, medial, segment, manipulate (phoneme-explorer), deletion
and substitution (sound-swap), delete (syllable-clapper) and the other word-flip rules have no saved payload,
so they are covered by vitest only.

## Size

About 940 lines of new lever modules and 500 lines of component and catalog edits, 870 lines of tests, 4 new
contract docs (about 270 lines) plus the rhyme-studio contract.

## Live pair: not run

Same state as L1: the handoff asks for 2 paid runs per class, `LIVE_TESTING.md` (09-27 ruling) says a lever-set
gate needs none. The L1 ruling is still owed; if it is "run them", the audio run for L2 is
`run_live_runtime.py --primitive rhyme-studio --mode recognition --lever --lesson-entry --audio --runs 1`.

## Queued (`SUPPORT_LEVERS_BRIEF.md`)

- `tutor_replay.py` answers an unrecorded lever pull with the old packet (handoff 20 Part C).
- `replay_checks` false positives: choices read aloud at K (rhyme-studio), "one dot for each clap" (syllable-clapper).
- rhyme-studio production/collection levers have no payload to replay.
- L1's five primitives never set catalog `levers: true` (no `LEVER_DOCTRINE` in their guidance); two would exceed the 2000-char cap with it.
