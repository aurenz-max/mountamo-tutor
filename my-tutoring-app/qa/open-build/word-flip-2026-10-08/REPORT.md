# word-flip — `build_inflect` open build (OB-8L), 2026-10-08

Built in an agent worktree from 1f2e7854, merged into the main tree (two keep-both conflicts: the eval-test
`buildArray` map and the journey baseline) and committed as the 3-way merge of the agent's changes onto HEAD, so no
peer edit rides along. Contract R5 added (the build is a fork; R1-R4 unchanged).

## Is any existing mode already this task? No

The six spoken modes show a picture frame and the learner says one changed word. `build_inflect` starts with an
empty row; the learner makes a word from cards and many words pass.

## Design

- **Task.** Tap a base-word card (a picture prints its meaning) and an ending card (s, es, ies, ed) into a row, then
  "I'm done!". Code writes five asks: "Make a word that means more than one." · "...tells it already happened." (×2) ·
  "...more than one. Use a word that ends in y." · "...ends in x or ch." (×2) · "...what someone did yesterday."
  Every second item asks for a second, different word (not at the easy tier). Ending cards print no meaning:
  choosing which ending does which job is the skill.
- **Spelling change.** The learner chooses it, the board writes it: picking `ies` for a consonant + y word replaces
  the y (shown struck through). baby + s or baby + es is `missed_y_change`. Doubled consonants are out of scope (the
  past-tense bases are add-only -ed verbs, as in `past_ed`).
- **Judge.** Code first: row shape, the ending does the ask's job, the ending fits the base (es after s/x/z/ch/sh, ies
  after consonant + y, s otherwise), the base the ask names, a word already made; ed after consonant + y or final e is
  refused in code ("babyed", "treeed") because the model passed "babyed". Then `judgeWordBuild` (real word + fits the
  ask), unchanged.
- **Misses:** code `base_only`, `ending_only`, `parts_out_of_order`, `double_ending`, `wrong_ending_kind`, `other_base`,
  `wrong_ending`, `missed_y_change`, `same_word`; judge `not_a_word`, `wrong_meaning`. No miss names a passing word.
- **Levers** (bare): `word_frame` (help: empty "word + ending" boxes, naming the kind of word when the ask does),
  `ending_chart` (help: one solved word per ending on words not on the board), `fewer_endings` (simplify, ungraded:
  2 fitting words, 1 other, 2 endings). `same_word` is unanswered (the made word stays on screen).
- **Scene facts:** `partsPlaced`, `endingsPlaced` (tested: `endingsPlaced 0 → 2 → 1`).
- **Generator.** flash-lite offers topic words for the four rules from the typed pool, validated by
  `deriveWordFlipAnswer`; code picks two bases per rule, fills gaps from seeds, adds endings and writes every ask.
  Model failure → seeds only. A blend with a spoken mode leaves the build out.
- **Surface reuse, no copy.** `affixBuild.ts`: optional `replaces` on a part, item fields carried through, an
  `AffixBuildRules` interface with word-builder's as the default. `WordBuildAffix.tsx` takes optional `primitiveId`,
  `rules`, `metrics`. word-builder's build test passes 11/11 unchanged.
- Catalog β 3.6 (past_ed + 0.1), `answers: ['build']`, misses, `unanswered: ['same_word']`, a guidance sentence (never
  say a fitting word or which ending); backend prior; new oracle `word-flip` (none existed); eval-test maps
  `build_inflect` to `buildItems`.

Size: ~520 production lines (domain 268), 245 test lines, oracle 120, 3 probe scripts.

## Gates

| Gate | Result |
|---|---|
| `WordFlip.buildInflect.workspace.test.tsx` | 11/11 |
| vitest (worktree): literacy, WordBuilder.buildAffix, oracles, build-layer | 167 files, 3,291/3,291 |
| vitest (worktree): live-activity | 36 files, 2,447 pass, 0 fail |
| `typecheck:lumina` / full tsc | 0 / 770 = baseline |
| journey sweep | J1 by design (model judge), like the sibling builds; every miss except `same_word` has a lever |
| real generator + oracle | 5 runs (pinned G1, G2, G2 easy, intent G2, blend): 20 build items, 0 violations, 0 adapter rejections; the blend stayed spoken |
| labelled set, real judge, 2 runs (51 scored) | judge alone 49/51 (false accepts "puppys", "babyed"); flash alone 51/51; code then judge 51/51 (20 decided in code) |

Artifacts here: `generator-run.json`, `pinned-*.json`, `intent-g2.json`, `blend-g1.json`, `journey-sweep.json`,
`labelled-inflect.json`, `calibration-inflect-r*.json`, `effective-inflect-r*.json`, `gates.json`, runners
`calibrate-inflect.mjs`, `effective-inflect.mjs`. Probe artifacts predate two small code edits (the ed-after-y/e rule,
a shorter constraints fact); neither changes generation, and the saved payload still passes adapter, oracle and tests.

## Not verified

- No browser drive (tap feel, the struck y, the 12-card grid at phone width, a picture read as a card's meaning).
- No Live run or replay; rides the literacy class Live gate.

## Rulings owed

1. **Action words with a plural ending, thing words with ed.** Code lets them through; the judge passes most (jumps,
   washes, boxed, dressed) but rejects some (helps), so a child could hear contradictory verdicts. Keep the judge's
   reading, or have code require a thing word for "more than one" and an action word for "already happened"?
2. The learner chooses y→ies and the card writes it; doubled consonants out of scope. Should the learner edit the y?
3. β 3.6 is a prior; picking from a visible board may be easier than the spoken -es and y modes.
4. Aimed at grades 1-2, but the family's workspace still lists Kindergarten; no floor added (R11).
5. The "ends in y" ask narrows the choice to two bases. Acceptable to force the spelling-change item?
