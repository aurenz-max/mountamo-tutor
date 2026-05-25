# Eval Report: skip-counting-runner — 2026-05-24

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| count_along | PASS | — |
| predict | PASS | — (fixed 2026-05-24) |
| fill_missing | PASS | — |
| find_skip_value | PASS | — |
| connect_multiplication | PASS | — |

Generator output was already well-formed for every mode; the predict-mode failure was a component runtime race.

## Notes

### SCR-1 — fixed 2026-05-24 (COMPONENT timer-lifecycle)

**Was:** Stale-closure race corrupted predict-mode state on fast advance between challenges. `setTimeout(performJump, 800)` in `checkPrediction` plus the nested `setTimeout(..., 400)` in `performJump` were untracked, so an early "Next Challenge" click left them pending. They then fired against the new challenge with closure-captured `nextExpectedPosition` from the previous challenge, writing the wrong `currentPosition` and appending a duplicate to `landingSpots`.

**Fix:** Added `jumpAnimationTimerRef` + `predictAdvanceTimerRef` to track both timer handles. `clearPendingJumpTimers()` clears both refs and resets `isAnimating` (so cancellation mid-animation doesn't leave the Jump button disabled). `advanceToNextChallenge` calls it before doing anything else; an unmount effect clears too. Same fix also defuses the related untracked-timer anti-pattern in `count_along` mode (was theoretically vulnerable; now safe).

**Files:** `primitives/visual-primitives/math/SkipCountingRunner.tsx` only.

**Verification:** All 5 eval modes still PASS via eval-test. Type check clean for the modified file. Visual race can no longer occur because the stale timers are guaranteed to be cancelled before the next challenge's state is set.
