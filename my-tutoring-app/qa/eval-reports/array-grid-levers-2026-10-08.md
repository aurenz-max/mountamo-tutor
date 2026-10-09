# array-grid levers: build_array, count_array, multiply_array (2026-10-08)

`/add-support-tiers`, class sweep (user waived the Phase 2 confirm stop). make_array already had levers (open build, OB wave 1-2); this slice covers the three given-array modes.

## Failure inventory

| Mode | Failure (miss id) | Evidence class |
|---|---|---|
| build / count / multiply | adds the two sides (`added_sides`) | observed-synthetic (journey sweep's scripted wrong answer types rows + columns) |
| build / count / multiply | total one row or one column off (`one_row_off`, `one_column_off`), `off_by_one`, `other_total` | inferred (the check names them; no run has produced them) |
| multiply | rows and columns swapped (`swapped_sides`) | documented (catalog commonStruggles "Confusing rows and columns", "Swapping dimensions") |
| multiply | another number for a side (`wrong_side`) | inferred |

Real-learner evidence: none (no demonstrations, tutor reports or misconception runs name array-grid). No contract doc exists for array-grid. Build's check only fires once the rows and columns match, so every build miss is on the total.

## Lever table

| Mode | Failure | Lever | Kind | Carrier | Leak rule | Existed? |
|---|---|---|---|---|---|---|
| build / count / multiply | all misses | `row_strips`: each row outlined in its own coloured strip, two colours alternating | help | shown | draws no number; fact has no digit | no: one CSS grid, rows not grouped |
| build / count | one row / column / item off | `number_labels`: numbers every row and column (the session's own label render) | help | shown | offered only where the session hides labels (hard tier); never on multiply, whose sides are written answers | generation-time `showLabels` only |
| build / count / multiply | sides added, other total, swapped / wrong side | `smaller_array`: same mode, two rows of the same columns (or half the columns on a two-row array) | simplify | shown | never the same array, the turned array, the same total, or a one-row array (`smallerLeaks`) | no |

Coverage per item: `row_strips` exists on every item, so every miss has a lever on every item (unit-tested over all 35 arrays the component draws, both label states). The 2 × 2 item has no simplify (already the plainest array); on multiply and on the easy and medium tiers there is no `number_labels`. No mode needs `unanswered` entries.

Starting positions: unchanged. The existing tier (labels + strategy tip, session-level) is kept as the starting position; no lever starts pulled, so `row_strips` stays open on every tier.

## Built

- `arrayGridLevers.ts`: `row_strips`, `number_labels`, `smallerArray` extended to given arrays, `smallerLeaks`, `labelsOffered`, number-free `leverFacts`. Same `~smaller` suffix, so the journey row's existing parent rebuild covers the new practice items (no edit to `liveJourneySpec.ts`).
- `ArrayGrid.tsx`: levers published for every mode; strips render as a ring per row (no layout shift); labels = session labels OR the lever; strip/label pulls refused on build before an array exists.
- Catalog: comment only (misses were already declared; `levers: true` already set).

## Tests

- `arrayGridLevers.test.ts` (51): builder over every array, leak rules, miss → `nextLever` table, per-item J9.
- `ArrayGrid.levers.workspace.test.tsx` (4, mounted): pull changes screen + fact in one commit, next attempt records the lever, refused pull leaves scene/levers/attempts/HTML unchanged, simplify opens `a0~smaller` as practice and the full item returns blank and is credited after.
- Existing: `ArrayGrid.workspace.test.tsx`, `MathWorkspaces.surface.test.tsx`, oracle `array-grid.test.ts`, `lessonWorkspacePlan.test.ts`: all pass (67 + 52).
- `npm run typecheck:lumina`: 0.

Not run (batch verify step owns it): journey sweep, tutor replay. Needs a browser check on how the strips look on a 6 × 8 array.
