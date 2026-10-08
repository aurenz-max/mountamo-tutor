# array-grid — workspace binding + `make_array` open build, 2026-10-07

## Step 1: binding (W1, minimal, plain shape like coin-counter)
- `ArrayGrid.tsx` → `ArrayGridSurface` through `withWorkspaceController` (`useScriptedProgress` /
  `useWorkspaceProgressFor('array-grid')`). Every check goes through `progress.commitCheck` with a work description
  and a named miss. On the workspace: Next hidden, input closed while `canAttempt` is false, `useLuminaAI` off, cues
  silent, submission from `onFinished`.
- Each item resets in the update that opens it (fixes J7 "superseded" on every advance). Try again clears typed
  input on build, count and multiply. Scripted path unchanged. aria-labels added for the harness.
- Tutor facts: build — the rows and columns asked (on screen) and `rowsBuilt`/`columnsBuilt`; count and multiply —
  the array drawn ("3 rows of 4 stars"). The total is never published; guidance forbids saying it (and, on count and
  multiply, the row/column counts).
- Misses (`arrayMiss`): `added_sides`, `one_row_off`, `one_column_off`, `off_by_one`, `other_total`; multiply also
  `swapped_sides`, `wrong_side`. No contract doc exists.

## Step 2: `make_array` — "Make an array with 12 squares"
- One svg (`ArrayBuildGrid`), empty, `min(N,8)` × `min(N,12)`. Tap a cell to add a square, again to remove. No numbers.
- Check at "I'm done!": the squares fill one rectangle and rows × columns = N. No stillness.
- Misses: `ragged`, `one_line_short`, `one_line_over`, `too_few`, `too_many`, `same_as_first`; verdict names no
  number or direction. Try again keeps the squares and verdict; new item, practice and return open empty.
- Two-ways items (every second item except at the easy tier): the first right array is kept, drawn small, not
  committed; the second commits and must differ in rows and columns. A turned array (4×3 after 3×4) counts as
  different (ruling 1).
- Facts: `rowsMade`, `columnsMade`, `squaresMade` numeric, plus `way` / `firstArray`; `workHistory`
  `squaresMade 0 → 13 → 12` tested. Target never beside them.
- Watcher: `useBuildWatcher` numbers:'never' on the grid svg; off when empty, checking, after a pass.
- Levers bare: `row_counts` (help, `data-aid`; ragged, one line short/over), `square_count` (help; too few/many,
  one line short/over), `smaller_array` (simplify: largest non-prime ≤ N/2, ungraded). `same_as_first` unanswered
  (first array stays on screen).
- Generator: code picks distinct N (G2 {6, 8, 10, 12, 15, 16, 20}; G3+ {12, 16, 18, 20, 24}), honours a stated
  ceiling, writes the ask; model writes title/description (digits replaced). Enum, docs, strategy hint.
- Registry: β 1.6 (build_array + 0.1), `answers: ['build']`; backend prior; catalog `teachingWorkspace` (grades 2–4,
  guidance, `levers: true`, misses for four modes, `unanswered`); oracle branch; adapter; journey row; 4 payloads.

## Gates (worktree; merged and re-gated in main)
- `ArrayGrid.workspace.test.tsx` 12/12; oracle 10/10.
- live-activity + catalog + oracles + pip (133 files): 3395 passed; 3 timeouts under load pass 11/11 alone.
- Journey sweep 374/374 payloads; array-grid build 5, count 7, multiply 7, make 4 items; 0 findings; misses named.
- `typecheck:lumina` 0; full tsc 770 (counts compared; the sorted baseline list was overwritten in the shared scratchpad).
- Real generator (6 lessons): 0 oracle violations; every fitting array passes, one square short misses.
- Real watcher: 12/12 lines kept, none with a number (headless screenshots cropped lower rows; close to, not the
  same as, in-app `svgPicture`).

About 770 production lines, 325 test and harness lines.

## Not verified / rulings
- No browser drive (cell hit areas, 12-column width at phone size, watcher line, levers, first-array thumbnail).
- No Live, replay or learner-intent probe; the tutor gets no verdict on a first-way pass (`way: 'second'` only).
- `scripts/lib/lesson-planner-requirements.mjs` has no line for the mode.
- Rulings: (1) turned array counts as different; (2) `levers: true` adds `LEVER_DOCTRINE` to all four modes though
  only make_array has levers (coin-counter likewise); (3) unpinned sessions can now include make_array.
