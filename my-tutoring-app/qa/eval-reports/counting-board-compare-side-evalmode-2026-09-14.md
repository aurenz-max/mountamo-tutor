# counting-board CNB-2 + CNB-3 fix — 2026-09-14

`/eval-fix CNB-2 CNB-3`. Both findings came from code reading during `/add-misconception-loop counting-board`
([report](../misconception/counting-board-2026-09-14.md)); neither had been seen in a generated lesson.

## CNB-2 — compare's larger group was always drawn first (HIGH)

**Cause.** The child should find the group with more by looking at both groups, then say how many are in it.
`generateCountingBoard` set `groupSize` to the larger count and `count` to both groups' total. The component's
`generateGroupPositions(count, groupSize)` cut the board into groups of `groupSize`, so group 0 (the left one)
always held the larger count. "How many in the group with more?" was always answered by the left group, and a
wrong answer could not show whether the child read position or compared. Nothing recorded the drawn order, so the
oracle could not see it either.

**Change.**
- The generator owns the drawn order: `compareGroups` holds both group sizes in board order. The larger group's side
  is half each way per session, shuffled (2 or 3 of 5 larger-first; the odd board goes to either side).
- `CountingBoard.tsx` lays out `compareGroups` when present. One `layoutGroups` function now places the objects and
  the group rings; the rings had their own copy of the layout arithmetic. Boards without `compareGroups` still draw
  the larger group first, and group_count layouts are unchanged.
- `itemFromChallenge` drops a compare board whose drawn groups disagree with the key (wrong total, a tie, or a larger
  group that is not the answer). The evidence line now states the sides: "4 on the left and 7 on the right".
- Oracle: `compareGroups` must add up to `count` and its larger group must equal `groupSize`. Across 3+ compare boards,
  more than 70% of larger groups on one side is an `answer-leak`. A board without `compareGroups` counts as larger-first.
- A manifest `groupSize`/`arrangement` override no longer rewrites compare boards; `groupSize` is compare's answer key.

**Found while verifying, fixed in the same block.** The generator drew each compare board's sizes independently,
so 57.3% of five-board sessions repeated a comparison (20,000 simulated sessions of the old draw; the first seeded
test session showed 8 vs 4 twice). Code now hands out distinct pairs from the same 14 (larger 4–8, 2–4 fewer).

## CNB-3 — count and group sessions submitted the challenge type (MEDIUM)

**Cause.** `CountingBoardMetrics.evalMode` was `challenges[0].type`. For `count` and `group` sessions that is
`count_all` / `group_count`, which are not catalog or backend mode names. Backend `get_prior_beta` fell through to
the global default: `count_all` → β 3.0 (catalog `count` 1.0), `group_count` → β 3.0 (`group` 2.0), each under its own
item key. The client's `evalModeDescription` lookup also missed, so curriculum mapping lost its per-mode signal.

**Change.** `evalModeForKind` in `countingBoardScript.ts` maps a board type to its catalog mode; the component
submits it. A test checks the map against every catalog mode's `challengeTypes`. Mixed sessions still submit the first board's mode,
unchanged from before.

## Verification

| Case | Result |
|---|---|
| Tests with each fix removed | Always larger-first: the generator compare test fails. Submitting the type: the mounted submit test and the catalog-map test fail |
| Seeded generator (`gemini-counting-board.compare.test.ts`, model call mocked) | 40 sessions: oracle clean, 5/5 askable, 2–3 larger-first each, both session shapes occur; override and empty-answer fallback cases |
| Mounted component (`CountingBoard.capture.test.tsx`) | `[3, 7]` draws the 3 left of the 7 with rings over each group; legacy board identical to `[7, 3]`; count_all session submits `count`, group_count submits `group` |
| Old vs new group layout (scratch script over the component source) | 300/300 (count 1–30 × 10 group sizes) positions and rings identical; 14/14 compare pairs identical larger-first, separated and on the board smaller-first |
| Oracle unit tests | legacy fixture (all larger-first) fires `answer-leak`; all larger-second fires; 3 of 5 passes; drawn groups that disagree with the key fire `answer-key-desync` |
| Real flash-lite via the registry (`scripts/probe-counting-board-compare-side.mjs`, 8 draws, criteria fixed first) | compare 6/6 sessions (G1 easy/medium×2/hard, K×2): 30/30 boards drawn and askable, 15/30 larger-first, 2–3 per session, 5/5 distinct pairs each. count K 7/7 askable, oracle clean, maps to `count`. The probe's overall pass is 5/8: both K compare draws fail the oracle's scope check (CNB-4) and the group draw repeats boards (CNB-5). Neither failure is about side or mode name |
| Real app, headless Chrome on :3000 (Math tester, compare, Grade 1) | 3 generations: first board larger-right twice (`[1,5]`, `[4,6]`), larger-left once (`[8,4]`); groups separate on screen, rings centred on each group. Screenshots in `artifacts/eval-fix/counting-board-2026-09-14/` |
| Backend prior lookup | `count` 1.0, `group` 2.0 (was 3.0 / 3.0 under `count_all` / `group_count`) |
| Gates | `typecheck:lumina` 0; full tsc 771 vs 771 baseline (one line differs only in union member order, same diagnostic); counting-board suites 103/103; full vitest 6,304 passed, 1 failed, 10 skipped. The failure is `pip/MathPrimitivesTester.surface.test.tsx` hitting its 20 s limit during the parallel run; it mounts the real Counting Board and passes alone 3 of 3 (about 6.8 s) |

Artifacts: `artifacts/eval-fix/counting-board-2026-09-14/` (8 generation JSONs, `report.json`, 3 screenshots).

## New findings (filed, not fixed)

- **CNB-4** compare ignores the objective window: K "Compare groups up to 10" put totals of 11–14 on 4 of 10 boards
  (every group ≤ 8). Needs a ruling first: does the bound cap each group (what the child counts) or the total (what
  the oracle checks)? Then feed `scopeCeiling` into the pair pool and align the oracle. `/eval-fix`.
- **CNB-5** group_count repeats boards: Grade 1 draw had 4×2 and 5×3 each twice (random `numGroups` over the model's
  repeated group sizes). Code should hand out distinct (size, groups) pairs. `/eval-fix`.

## Limits

- Submission was checked at the component (`metrics.evalMode`) and at the backend lookup, not through an authenticated
  submit. Attempts already stored under `counting-board_count_all` / `_group_count` stay under those keys.
- The browser drive checked the first board of each generation; later boards were checked in the generation payloads.
- A compare move for the misconception loop is now possible but not built (`/add-misconception-loop`).

Lines: production about 150 (component layout refactor about 90 of it), tests about 150, probe 75.
