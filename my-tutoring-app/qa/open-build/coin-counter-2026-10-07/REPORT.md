# coin-counter `show-amount` — open build, 2026-10-07

## What was built
A new eval mode and challenge type, `show-amount` (β 3.6, which is make-amount + 0.1, scaffolding mode 2): "Show 37¢ for a sticker, any way you like." It sits beside `make-amount` and `fewest-coins`, which are unchanged (contract R12).
- **Interaction:** the tray starts empty. The learner taps coin bins to put coins on the tray, taps a coin on the tray to take it off, then presses "I'm done!". Any coin mix that adds up to the amount passes. The check is make-amount's `coinMiss` (sum of cents), so there is no new judging code.
- **Surface:** one svg (`CoinBuildTray`) holds the tray and the learner's coins, laid out in the order put in, one per cell, so none overlaps. Coin value labels (the tier aid) and value tags (a lever) are `data-aid`. No target and no running total are on screen; the instruction states the amount.
- **Commit:** "I'm done!" runs the existing check, which commits through the workspace's `commitCheck`. There is no `armStillness`. Try again keeps the tray and the verdict's words; a new item or the simplify lever opens an empty tray. The verdict names no amount and no direction.
- **Tutor facts:** the scene publishes `centsMade` and per-coin counts as numbers, so `workHistory` records a self-correction (tested: `centsMade 0 → 17 → 16`). The target is never published beside them. The guidance gains one sentence: never say how much is on the tray or how much more is needed.
- **Live line:** `useBuildWatcher` with `numbers: 'never'`, on only while the tray has coins and the build is open.
- **Levers**, none pulled at the start at any tier:
  - `running_total` (help): one coin short or over.
  - `value_tags` (help): counted coins, short, over.
  - `smaller_amount` (simplify): half the amount on an empty tray, ungraded, then the full item returns.
- **Generator:** code picks 4 distinct amounts within the band ceiling (K 20, G1 50, G2+ 99), lowered by a stated bound such as "up to 30". It never picks a single coin's value. The bins are the band's coin pool up to that ceiling, and code writes the instruction. Flash-lite only names the thing being bought; a name with a digit or coin word is dropped, and a fixed list covers a failed call.
- **Registry:** catalog mode (`answers: ['build']`), misses, `levers: true`, backend prior, oracle type (amount reachable from the bins, instruction states it), live validator, journey driver row, saved sweep payload.

About 420 production lines and 250 test lines.

## Gates (in the worktree)
- New vitest: 6/6 (workspace: build, misses, Try again, work history, levers, simplify, catalog) and 5/5 (generator).
- Existing coin-counter suites plus the new ones: 6 files, 76/76.
- live-activity suite: 35 files, 2243 passed, 371 skipped (replay-only).
- Journey sweep on `show-amount`: 4 items, 0 findings, recover and clean records submitted, every miss answered by a lever.
- `typecheck:lumina`: 0. Full tsc: 770, same as the baseline.
- Real generator: 3 runs × 4 items, all in scope, oracle 0 violations.
- Real watcher: 6/6 lines kept, none with a number.

## Not verified
- Browser drive in the Math tester: tray-coin tap hit area, phone-width layout, watcher line, levers.
- Live tutor wording on the new guidance (`LEVER_DOCTRINE` now applies to every coin-counter mode). This rides the next class Live gate.

## Ruled out / notes
- Reusing `make-amount` was ruled out: it shows the target in large type above a running total, its bins are a generator-chosen subset, and Try again empties the coins.
- Unpinned (mixed) sessions now include `show-amount` items; pinned consumers are unaffected.
- Contract gaps G7 (make-change can pay with a coin that does not exist) and G8 (fewest-coins checked as make-amount) are untouched.
