# spelling-pattern-explorer — workspace binding + `pattern_build` open build (OB-8L), 2026-10-08

Built in an agent worktree from 1f2e7854. Merged into the main tree, where `letterBuild.ts` and
`LetterBuildSurface.tsx` conflicted with syllable-clapper's `syllables` kind (committed first, 2a436ea2); resolved
keep-both: `startRow`, `rowReady`, `describeLetterBuild` and `letterMissWords` handle `syllables`, then `pattern`, then
the old kinds. Committed through a separate git index so the peer session's staged changes stay out.

## Step 1: binding (W1, all six modes, per R12)

- `SpellingPatternExplorer.tsx` picks at mount: a `task: 'letter_build'` payload goes to `withWorkspaceOnly` + the
  shared `LetterBuildSurface`; everything else to `withWorkspaceController(SpellingPatternExplorerSurface, ...)`. The
  scripted flow outside a live runtime is unchanged.
- Classic modes (short_vowel, long_vowel, r_controlled, silent_letter, morphological) on the workspace: observe and
  write-the-rule stay an ungraded opening (`readyForResponse: false`); then each dictation word is one gesture item
  ("Listen to the word "X" and type how it is spelled"): the tutor says it, the learner types, "Check spelling"
  commits through `progress.commitCheck`. The spelling is checked in code and never published as a key. Try again
  keeps the text; a new word opens empty; the evaluation submits when every word is done.
- Scene facts: `phase`, the pattern words while on screen, `patternShown` only while the panel shows (so at hard tier
  the tutor is not told the pattern), `typed`, numeric `lettersTyped`. Classic misses `pattern_missing`,
  `other_letters`, `misspelled`.
- `spellingPatternExplorerWorkspace.ts`, adapter `spellingPatternExplorerLive.ts` (validates both shapes), rows in
  `activityContract.ts`, `lessonWorkspacePlan.test.ts`, `liveJourneySpec.ts`; catalog `teachingWorkspace` grades 1-6,
  `levers: true`. Shared harness change: the dry sweep's and `primitive-runtime-driver.mjs`'s `write` also reach a
  `<textarea>` (backward compatible).

## Step 2: `pattern_build`

- **Task.** An empty row of 4-6 boxes and a letter bank: "Make a real word with the long a sound spelled ai." 17
  spellings (ai, ay, a_e, ee, ea, i_e, igh, oa, o_e, ar, or, er, ir, ur, kn, wr, mb). Many words pass; every second
  item asks for a different word (not at the easy tier). "I'm done!" commits; no `armStillness`.
- **Surface reuse (additive).** `letterBuild.ts`: kind `'pattern'`, `item.pattern`, four miss ids, one-line branches;
  new `rowReady` (pattern: letters packed from the left, 2+) and a `describeLetterBuild` that drops trailing empty
  boxes. `LetterBuildSurface.tsx`: 5 lines (readiness via `rowReady`, the made word in miss words, narrower boxes past
  3). Pattern logic lives in `spellingPatternBuild.ts`.
- **Judge.** Code first: the spelling in a valid place (ai not at the end, a_e as consonant + final e, kn/wr at the
  start, mb at the end), else `other_spelling` ("play" for ai), `wrong_place` ("rian"), `no_pattern`; then
  `not_the_sound`, `same_word`, `pick_another`. Then `judgeWordBuild` with `only: 'real_word'`.
- **"Said" for long a.** Code decides `not_the_sound` before any judge call: position rules (ai/ea/ee/oa before r;
  ar after w/qu; eigh; wor+...) plus a short per-pattern exception list (said, again, have, come, bread, great...) and
  words the rules would wrongly refuse (were, height). Known gap: an unlisted exception passes on its letters.
- **Levers** (bare): `pattern_card` (help: the spelling in place plus its sound), `model_word` (help: a word from
  another sound's pattern), `small_bank` (simplify, ungraded: letters of two example words only). `same_word`,
  `pick_another` unanswered.
- **Code owns asks and banks.** `makePatternItem` picks 3-5 seed words sharing letters, adds the same sound's other
  spellings (so `other_spelling` is possible) and one foil; seed words printed in the ask are excluded.
  `patternsNamed` reads the objective (named spellings, then sounds, then families; else grade sets). No model call.
- Catalog β 2.6 (long_vowel + 0.1), entry `answers: ['type','build']` with classic modes overriding to `['type']`;
  backend prior; new oracle `spelling-pattern-explorer`.

Size: ~320 lines of pattern rules and seeds, ~100 classic domain, adapter 37, oracle 81, ~60 in shared files;
component rewritten whole. Tests 273 lines, probe 142.

## Gates

| Gate | Result |
|---|---|
| `SpellingPatternExplorer.workspace.test.tsx` | 18/18 |
| vitest (worktree): live-activity, catalog, oracles, literacy, pip, service/literacy | 287 files, 6,510 pass, 0 fail |
| `typecheck:lumina` / full tsc | 0 / 770 = baseline (worktree); re-gated on a clean checkout of the commit |
| journey sweep (408 payloads) | passes vs baseline; long_vowel 4 items and r_controlled 5 items, 0 findings, all misses named; `pattern_build` J1 by design |
| real generator + oracle | 7 lessons (5 pattern_build G1-G3 incl. easy, long_vowel, r_controlled): 0 violations after fixing an ask that printed a passing word and a missed "ar, or, ir and ur" list (oracle now checks the first) |
| labelled set, real judge | 80 cases: code verdicts 36/36; real words 34/34; made-up words rejected 9/10 (false pass "knat", Jev 0.71) |

Artifacts here: `generations.json`, `judge-labelled.json`, `journey-sweep.json`. Probe:
`scripts/spelling-pattern-explorer-probe.mjs --run --payloads --judge` with `LUMINA_ENV_FILE`.

## Not verified

- No browser drive (tap feel, 6 boxes at phone width, the hint on the workspace path, the review screen).
- No Live run or replay; rides the literacy class Live gate. No build watcher (as with the sibling letter builds).
- `same_word` is per item; a word from an earlier item can be made again.
- silent_letter, short_vowel, morphological have no saved payload (hand-built `it.each` only);
  `scripts/lib/lesson-planner-requirements.mjs` has no line for the new mode.

## Rulings owed

1. Sound check by code rules + exception list, or a third judge question ("do these letters make that sound
   here?") in the shared judge (session 17's files)?
2. "knat" passes the real-word judge — queued as WBJ-1 for the judge's calibration.
3. β 2.6 unrated; may be low for silent-letter and r-controlled asks (closed modes 4.0, 3.5).
4. One named spelling ("long a spelled ai") fills from its siblings (ai, then ay/a_e) rather than four ai asks. Keep?
5. `levers: true` covers all six modes; only pattern_build has levers (same as array-grid, molecule-constructor).
6. The classic opening still requires a written rule before spelling. Keep, or let the tutor discuss it aloud?
7. Catalog text promises "TTS pronunciation and slow syllable mode" the primitive never had — queued as SPE-1.
