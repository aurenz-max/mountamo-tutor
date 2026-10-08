# equation-builder `make-n` — open build, 2026-10-07

## The mode
`make-n` asks "Make a number sentence that equals N". The learner taps number and sign tiles from an unlimited bank
into a row shown as `[row] = N`, then presses "I'm done!". Any well-formed sentence that makes N passes (4 + 6,
12 - 2, 5 + 5, 2 + 3 + 5). Every second item asks for two different ways; the second may not reuse the first's
numbers in another order. β 1.1 (build-simple + 0.1, the offset build_n has over give_me_n).

## Judge (code)
The row is read as number (sign number)+, left to right, integer arithmetic, no `eval`. Misses: `bare_number` (one
number tile alone, including N), `unfinished_sentence` (`4 +`, `4 6`), `one_short`, `one_over`, `short_by_more`,
`over_by_more`, `same_way` (the second way repeats the first). On a two-way item the first accepted way shows on
screen but is not committed; only the final way, or a miss, is committed, so the tutor gets one verdict per item.

## Commit
"I'm done!" through `progress.commitCheck`; no `armStillness`. Try again keeps the row and the verdict text. A new
item, the practice item and the return from practice open an empty row (keyed by item id, same render).

## Scene
`kind`, `total`, `tileBank`, `row` (text), `tilesPlaced` and `numbersPlaced` (numbers), and on two-way items
`waysAsked`, `waysMade`, `madeBefore`. Never the row's value. `workHistory` records revisions such as
`tilesPlaced 3 → 2 → 3`.

## Levers (none pulled at start, every tier)
- `number_dots` (help): dots under each number tile; answers the four wrong-amount misses.
- `sentence_frame` (help): empty number/sign/number boxes; answers `bare_number`, `unfinished_sentence`.
- `smaller_total` (simplify): ungraded practice at about N/2, one way, `+` only, bank 1..N/2.
- `same_way` has no lever by decision: the first way stays on screen above the row.

## Generator
Code owns the total, the bank and the instruction; the model writes only title and description. Totals distinct,
3 up to a ceiling (a bound named in topic/intent, else the band's maxNumber), clamped 4..20; a named "make N" total
comes first. Bank 1..ceiling with `+`, plus `-` above K. No second way at the easy tier.

## Watcher: skipped
`useBuildWatcher` describes an SVG picture. This build is a row of digits and signs; with `numbers: 'never'` a line
could only describe the row's shape, and showing digits to a vision model invites it to compute the sum. The tutor
reads the row as text from the scene instead.

## Gates (worktree)
- `typecheck:lumina` 0; full tsc 770 = baseline.
- `EquationBuilder.workspace.test.tsx` 16/16; `equationBuilderLevers.test.ts` 5/5; equation-builder, oracle and
  pip tests together 99 files, 1088 tests pass.
- live-activity suite 35 files, 2243 passed, 371 skipped; the `equation-builder.make-n` dry journey passed.
- Backend registry imports; `make-n` = 1.1.
- Real generation (flash-lite, 3 lessons pinned to make-n): 0 oracle violations; adapter accepted every lesson.
  G1 "Ways to make 10": totals 10, 8, 7, 3. K "within 5": 4, 5, 3, 4, bank 1..5 `+` only. G2 "within 20" easy:
  8, 20, 3, 15. On every item a reference sentence passes, the bare total gives `bare_number`, the scene carries no
  value. Output: `generations.json`.

About 480 production lines, 166 test lines, a 60-line probe (`scripts/equation-builder-make-n-probe.mjs`).

## Not verified / open
- Browser: the 20-tile G2 bank wrapping at phone width, the dots grid under two-digit tiles, "= N" beside a full
  7-tile row. Driven in jsdom through the real runtime only.
- "Ways to make 10" lessons start at 10 then move to other totals; a single-total lesson with ways differing across
  items needs memory across items (not built).
- A named "make 10" caps the bank at 10, so 12 − 2 is unavailable even when the intent mentions subtraction.
- No Live run; the verdict wording rides the next class Live gate.
- Guidance is 2313 characters (under GUIDANCE_MAX 4000).
- N + 0 cannot be built (bank starts at 1), deliberately.
