# fraction-bar — workspace binding + `build_equal` open build, 2026-10-07

## Step 1: binding (W1, minimal)
- `FractionBar` goes through `withWorkspaceController('fraction-bar', …)`; the scripted path is unchanged.
- Three-step items (identify, build, compare, add_subtract) on the workspace: each step's Check judges; a wrong
  numerator, denominator or shading commits a named miss; Try again keeps the step reached and clears only its work;
  a right numerator/denominator moves on at once (no commit, no 1.5 s timer); the right shading completes the item.
  Next and Show Hint hidden, legacy `sendText` silenced, input gated, submission only under an evaluation provider.
- Misses: `chose_denominator`, `other_numerator`, `chose_numerator`, `other_denominator`, `shaded_all`,
  `shaded_the_rest`, `one_short`, `one_over`, `short_by_more`, `over_by_more`.
- Fixed (found by the sweep, J7): the per-item reset ran in an effect, so each advance rendered the new item once with
  the old step and the visibility wait ended "superseded". The reset now happens in the render that shows the item.
- No `docs/contracts/fraction-bar.md` exists.

## Step 2: `build_equal` — "Show a fraction equal to a/b on the bar, your way"
- Judging reuses `fractionEqualBuild.ts` unchanged (a bar part is a span, like a circle arc). Split K-2 2/3/4, 3-5 up
  to 12; one part can be cut in half; shade; "I'm done!".
- Miss order: `unequal_pieces`, `same_pieces` (pending R3, shared one line with fraction-circles), `shaded_the_rest`,
  `cut_cannot_make`, `one_off`, `off_by_more`.
- No stillness; Try again keeps the bar and verdict; `partsCut`, `partsShaded` numeric (`partsShaded 0 → 7 → 6`);
  no verdict, decimal or readout before commit; `useBuildWatcher` numbers:'never' over one svg.
- Levers bare: `running_count` (one_off), `show_reference` (target as a second bar), `smaller_target` (simplify,
  halves first); every miss answered.
- Generator: code picks targets (band fractions with another equal split, distinct) and writes the instruction;
  reached only by a pin (unpinned enum excludes it).
- Catalog β 4.6 (matches fraction-circles `build_equal`; fraction-bar has no equivalence mode), `answers: ['build']`,
  misses, backend prior.

## Gates (worktree; merged and re-gated in main)
- New vitest: 14 in 2 files (binding over 4 modes; build mode: item, gesture, 6 misses, Try again, workHistory,
  3 levers, simplify) + 2 oracle cases.
- Existing fraction-bar, fraction-circles and catalog: 13 files, 227 pass. live-activity: 35 files, 2265 pass.
- Journey sweep: 0 findings on 5 payloads; every checked miss named (identify 7/7, build 3/3, compare 3/3,
  add_subtract 3/3, build_equal 4/4); clean runs score 100, recoveries 67 with misses recorded.
- `typecheck:lumina` 0; full tsc 770 = baseline.
- Real generator + oracle: 7 runs (each mode pinned, build_equal at K-2, unpinned): 0 violations; every target has
  another passing split and its own split gives `same_pieces`.

About 780 production lines (260 in new files), 334 test lines, an 82-line probe.

## Not verified / rulings
- No browser drive (layout, phone width, the knife). No watcher lines recorded. No replay or Live.
- Payloads come from the probe script (same production generator), not `save_payload.py`.
- Existing capture test once hit the 5 s timeout under parallel load (2.6 s alone): pre-existing flake.
- R3 (shared with fraction-circles). New: wrong numerator/denominator steps commit as misses (Try again before the
  next step); the alternative is BalanceScale's pattern where only the final step commits.
- Merge notes: `livePlan.test.ts` now uses `concept-card-grid` as its "cannot run live" example;
  `lessonWorkspacePlan.test.ts` lists fraction-bar.
