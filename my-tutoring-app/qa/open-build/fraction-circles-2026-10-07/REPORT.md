# fraction-circles `build_equal` — open build, 2026-10-07

**Task:** "Make a fraction equal to a/b your own way." The circle starts whole. The learner picks an equal cut
(buttons for the band's denominators: K-2 2/3/4, 3-5 up to 12), can cut any one piece in half with the knife, shades
pieces, and presses "I'm done!". Any equal fraction passes (1/2 = 2/4 = 3/6 …). Differs from `equivalent`, where the
number of slices is given. β 4.6 (`equivalent` + 0.1), scaffolding 4, `answers: ['build']`.

## Judge (code, at "I'm done!") — `equalBuildMiss`, in order
1. `unequal_pieces`: pieces not all the same size, or a count the circle does not support.
2. `same_pieces`: cut into b pieces with a shaded — the target itself. **Ruling owed:** this fails by design, so
   the mode cannot be passed with the `build` skill alone; the instruction states it ("not 4"). Allowing it is one
   line in `equalBuildMiss`.
3. `shaded_the_rest`: the unshaded part is the target amount.
4. `cut_cannot_make`: no shading of this cut can equal a/b (3/4 in sixths).
5. `one_off` / `off_by_more`.

Halving every piece is the equivalence strategy; halving only some is the miss. Halving stops at twelfths.

## Surface and live layer
- One svg with its own background, so `svgPicture` is what the learner sees.
- Scene facts: `printedTarget`, `piecesCut`, `piecesShaded` as numbers (`workHistory`: `piecesShaded 0 → 7 → 6`),
  `pieceSizes`, `learnerWork`, `constraints`. No verdict before the commit.
- `useBuildWatcher`, `numbers: 'never'`; off while checking and after a pass.
- "I'm done!" through `commitCheck`, no stillness. Try again keeps the circle and verdict; a new item or simplify
  item starts whole.
- Guidance: one sentence — never name a number of pieces or how many to shade, never say whether it is equal before
  "I'm done!".

## Levers (bare at every tier)
- `running_count` (help, one_off): "6 pieces, 4 shaded" under the circle; never the target, never "equal".
- `show_reference` (help, shaded_the_rest, cut_cannot_make, off_by_more, unequal_pieces): the target as a second circle.
- `smaller_target` (simplify, same_pieces, cut_cannot_make, off_by_more, unequal_pieces): an ungraded easier target
  with fewer pieces, halves first, never an equal value. None for halves.

## Shared-layer change
The watcher's `NUMBER_WORD` filter had no fraction words ("Half the circle is pink!" would pass). Added half,
quarters, thirds through twelfths, fraction, whole, equal, same, and one prompt line. Applies to every
`numbers: 'never'` build, including counting-board `build_n`.

## Generator
Code picks every target from a shuffled list of band fractions that have another equal cut, distinct per session.
When the model chose, all three probe runs started 1/2, 1/3, 3/4 and ignored "halves and fourths" in K-2, so the
choice was taken from it. Contract R2 (a topic naming a fraction family narrows targets) therefore does not hold for
this mode (R14). The mixed path leaves this mode out, so mixed sessions keep their five types (R4).

## Gates (worktree)
- vitest: 13 new (7 + 4 + 2); 65 fraction-circles, catalog, oracle and counting-board files pass; live-activity 35
  files, 2243 tests.
- Journey sweep: 5/5 wrong commits named their miss; both journeys succeed; every miss answered by a lever.
- `typecheck:lumina` 0; full tsc 770 before and after.
- Generator (pinned 3-5, pinned K-2, intent 3-5, mixed 3-5): only `build_equal` when pinned; oracle 0 violations;
  every target has another passing cut and its own cut gives `same_pieces`.
- Watcher: real scene rasterized in headless Chromium through production `watchBuild`: 8/8 kept, no number,
  fraction word, verdict or advice. Run data in this folder.

## Open
- No hands-on browser check (layout, phone width, the knife).
- Watcher lines are bland and near-identical; one "nicely" on a right build is close to a verdict.
- No Live run; rides the next fraction-circles class gate.
- Size: about 290 production lines, 256 new test lines, an 82-line probe.
