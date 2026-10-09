# OB-7L literacy round 2: report (2026-10-08, session 17)

Scope: R12 (bind the older modes) plus build work on the four primitives this stream owns. The other Build stream
(session 52, OB-8L) took picture-vocabulary, word-flip, spelling-pattern-explorer and syllable-clapper.

## What reaches the student

All six primitives now run on the teaching workspace only, every mode. Their scripted UIs and catalog `tutoring`
blocks are gone.

| Primitive | Modes bound | New build mode | How it is checked |
|---|---|---|---|
| paragraph-architect | informational, narrative, opinion + paragraph_build | (OB-3L) | One typed sentence per step: code checks length, blanks and repeats, then the writing judge checks that the sentence does its step's job |
| sentence-builder | simple, compound, complex, compound_complex + sentence_build | (OB-3L) | Tile order: a listed order passes in code, compared by tile text; an unlisted order goes to the sentence judge |
| opinion-builder | oreo, cer + **build_opinion** | cards for either side, ordered into OREO (β 3.1) | Cards in code (role and side). OREO/CER sentences: the writing judge |
| revision-workshop | add_details, word_choice, combine_sentences, transitions, reorganize, concision | none: typed revisions are already open production | Code: unchanged, too short, not combined, not shorter. Then the writing judge (context = the draft). Reorganize is checked in code |
| figurative-language-finder | sound_devices, comparison, advanced, idiom + **build_figurative** | write your own simile/metaphor/... (β 3.5) | Find (tap a sentence, name the kind): a tagged figure passes in code; another kind in a tagged sentence is `wrong_type`; an untagged sentence goes to the judge. Meaning and make: the writing judge |
| story-planner | story_structure, character_setting, conflict_resolution, theme_craft | none: grade 2+ cards are already open production | K-1: one picture per card (a creative pick), then arc order in code. Grade 2+: each card is judged against the story idea |

Answers never shown:
- revision `idealRevision`;
- a figure before it is found;
- the story arc order (the board is a derangement).

## Judge change: `strict` naming asks

On figurative naming asks, Jev passed three wrong answers near the threshold:
- a simile named as a metaphor (fits 0.50);
- a sentence with no simile (0.53);
- plain waves offered as alliteration (0.58).

A request can now set `strict: true`. A Jev pass below fits 0.7 then also needs flash-latest to agree
(`confirmNearPass`). It is used only by the figurative find and make asks, so the existing callers' calibration is
unchanged.

| Run | Result |
|---|---|
| Jev, without `strict` | 18/21 |
| flash-latest | 21/21 |
| with `strict` | 21/21 |

The 21 labelled cases are in `qa/open-build/figurative-2026-10-08/judge-calibration*.json`.

## Evidence

- **Workspace tests** (stubbed judge):
  - `RevisionWorkshop.workspace.test.tsx`
  - `FigurativeLanguageFinder.workspace.test.tsx`
  - `StoryPlanner.workspace.test.tsx`
  - `OpinionBuild.workspace.test.tsx`
  - `OlderModes.workspace.test.tsx`
- **Story-planner contract:** the story-planner test carries the reader-fit PRE contract over from the retired component (no typing, one question per screen, emoji with caption, no printed story idea, numbered slots, derangement).
- **Journey sweep:** drives every code-checked step end to end. These are driven:
  - the reorganize order;
  - the figurative find steps;
  - the K-1 plan and arc;
  - the opinion cards;
  - the tile orders.

  Judged steps are listed in the baseline "by design".
- **Headless Chromium** (Language Arts tester, real judge):
  - **revision:** an unchanged sentence misses without a judge call; an off-task line is `wrong_job`; a real detail passes; reorganize misses reversed and passes in order.
  - **opinion:** mixed sides miss; the other side passes; an off-question OREO opinion is judged wrong.
  - **figurative:** wrong kind (code), right kind (marked), plain sentence as simile (judge no); make: plain sentence misses, simile passes.
  - **story:** K-1 shows no printed idea and no textarea; picks pass; reversed arc misses; in order passes. Grade 3: an off-card line misses; a character card passes.
  - Screenshots and logs are in each primitive's `drive/` folder.
- **Gates:**
  - `typecheck:lumina` 0.
  - Full tsc 771: the 770 baseline plus the existing `.next/types` eval-test route error.
  - Lumina vitest: all pass, apart from the known TY-F1 flaky test when it fires.

## Ratio

- **New production code:** about 1,625 lines (rules, surfaces, hosts, adapters, one generator).
- **Retired:** 1,845 lines of the three replaced components.
- **Tests:** about 412 new lines.

## Residuals (queued, not fixed here)

- **Live class gate, not run.** These modes have not been through a paid Live drive. Per the 09-28 ruling, run it once with `--mode mixed` per class, after the user's go-ahead.
- **Idiom meanings.** The figurative generator writes the word-for-word reading as `literalMeaning` for idioms, so the workspace uses no key for idiom meanings. Fixing the generator field is optional.
- **WBJ-1 ("knat" passes real_word).** Taken by this stream; not started.
- **Deferred build modes.** revision-workshop and story-planner got no separate build mode, because their typed modes are already open production. A tile-based `build_combine` for grade 2 typists is possible if a non-typing grade 2 path is wanted.
