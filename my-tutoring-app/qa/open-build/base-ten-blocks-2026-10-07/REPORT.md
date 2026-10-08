# base-ten-blocks `build_two_ways` — open build, 2026-10-07

A separate mode (contract R24); no existing mode's component path, generator path or lever changed.

## What was built
- **Mat** (`BaseTenBuildScene.tsx`): one svg, empty at start. Tap a column (or +) to put in one block of that size,
  tap a block (or −) to take one out. Ones in rows of five, tens in rows of ten. No trade buttons, keypad, Check
  button or total; the mat prints no number.
- **First "I'm done!"** checks only the value: any blocks that make N pass (34 ones passes). A right first way is not
  a commit; it is kept, drawn small above the mat, and left on the mat to change.
- **Second "I'm done!"** commits: right when the value is N and the blocks per place differ from the first way.
- **Misses:** the existing value misses plus `same_as_first`. Feedback never states the learner's total.
- **Commit and retry:** no stillness check. Try again keeps the build and the first way; feedback stays on screen.
- **Scene facts:** `valueMade`, `hundredsOnMat`, `tensOnMat`, `onesOnMat` as numbers, plus `way` and `firstWay` in
  words. The tutor hears the check as "Second way: 2 tens and 14 ones (first way: 3 tens and 4 ones)".
- **Watcher:** `useBuildWatcher`, `numbers: 'never'`.
- **Levers**, bare at every tier: `column_counts` (help, every value miss; drawn `data-aid`), `ten_model` (help,
  `same_as_first`: a ten-stick beside the ones it is worth, a flat beside ten-sticks when N ≥ 100), `smaller_number`
  (simplify, far-off misses: about N/2, at least 10, never N or its reversal, ungraded; then the full item on an
  empty mat). No total lever.
- **Generator:** type in the schema enum, docs and fallback. Code picks every target (distinct, ≥ 10, in range) and
  writes every instruction and hint; support flags forced off. On a two-ways-only session a title or description
  with a digit is replaced (the first real run titled one "Build 17 in Two Ways").
- **Registry:** catalog β 2.0 (between build_number 1.5 and read_blocks 2.5), `answers: ['build']`, misses;
  guidance: "the right value without the fewest blocks is not yet a build" now applies only to build_number, plus
  one sentence for the new mode. Backend prior 2.0. Live adapter type list; oracle known types with N ≥ 10.
- **Journey:** saved payload from the real G1 generation and a driver branch.

About 445 production lines and 290 test lines.

## Gates (worktree)
| Gate | Result |
|---|---|
| `typecheck:lumina` / full tsc | 0 / 770, sorted error lists identical |
| `BaseTenBlocks.twoWays.workspace.test.tsx` | 7/7 (empty mat; non-standard first way; `same_as_first`; Try again keeps; different way completes; `one_ten_off`, `one_over`; `workHistory` `onesOnMat 0 → 5 → 4`; levers; `smaller_number` 34 → 17 then full item; svg taps; no stillness; the stopped-building note fires once) |
| `baseTenTwoWays.test.ts` | 11/11 |
| Base-ten suites, oracles, live-activity (92 files) | 3272 passed, 0 failed |
| Journey sweep on the new payload | 4 items, 4/4 misses named, 0 findings |
| Real generation (3 runs) | clean. G1 [20, 11, 19, 15]; G2 [943, 245, 74, 382]; G2 hard [345, 16, 271, 382] |
| Watcher (real `watchBuild`, 6 mats × 2) | 11/12 kept, 1 dropped by the shared filter; no kept line has a number, verdict or advice |

## Not verified / open
- No browser drive: build 34 two ways in the domain tester, pull each lever, read the watcher line.
- No Live run. When the first way passes the tutor gets no verdict, only `way: 'second'` in the facts; its wording
  there and on `same_as_first` rides the next class Live gate.
- Without a curator `numberRange`, Grade 2 draws 3-digit targets (943); a two-digit lesson needs its own range.
- On 4-digit mats a column holds at most 10 flats, so some second ways will not fit.
- `scripts/lib/lesson-planner-requirements.mjs` has no fact line for the mode.
- Whether `ten_model` (shows the swap without naming which block) is enough for `same_as_first` needs learner evidence.
