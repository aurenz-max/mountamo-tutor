# Handoff: 8.1 item-space fixes (a, b, c, f, i, j, o) — 2026-10-16

Executor: `/eval-fix` (8.1a, c, f, i, o), `/add-number-pool-service` (8.1b), `/add-item-space` (8.1j).
Queue: `my-tutoring-app/qa/difficulty-demo/QUEUE.md` (authority over this file). Phase 8 in `WORKSTREAMS.md`.
Branch `ship/2026-08-10-judged-loop`. Other sessions work in the same tree (pulse backend, dioramas, the 8.1
decided forks): commit by path (`git commit -F <msg> -- <files>`), never `git add -A`.

Not in this handoff: 8.1d/e/g (decided forks, `HANDOFF-8.1-decided-forks-2026-10-16.md`), 8.1n (ruling owed).

## Order and what each item is

Run in this order; each is its own slice and its own commit. Before editing a primitive's component or generator,
read `src/components/lumina/docs/contracts/<id>.md` if it exists (contract-first, CLAUDE.md).

1. **8.1a tape-diagram `multi_step`.** The bar draws the intermediate and the answer as extra parts of one bar
   ("Total = 37" for 8 + 6 - 5). Fix the diagram so a two-step item reads as two steps, then wire the add-sub-20
   space's two-step items into the mode. Evidence: `qa/difficulty-demo/2026-10-13/REPORT.md`.
2. **8.1b numbers converge with tier levers working.** tape-diagram `represent` (4/6/5),
   `solve_part_whole` (12/8/15 cookies), comparison-builder `order`. Same primitive as 8.1a: do it right after.
   If a strand's space already exists, the fix is to let the space pick the numbers, not to add a pool.
3. **8.1c knowledge-check.** (a) Far options on symbol questions are non-math glyphs ("十", "हू"): restrict the
   distractor source to math symbols. (b) KC passes no scope to a space (a two-digit compare objective drew
   3 vs 14): add `scopeOf` to the compare spaces, copying the pattern 8.1m used.
4. **8.1f percent-bar.** `find_part` and `find_whole` each ask the other mode's question. Likely a swapped mapping
   in the generator or mode table; add a test that pins which unknown each mode asks for.
5. **8.1i length-lab `two_unit_compare`.** The answer is the small unit on every item, and lengths are 6/8/10 at
   every tier. Code should pick which unit is longer per item, and the tier should change the lengths' structure.
6. **8.1j `compare-numbers`** accepts three-digit objectives but its space is within 100. Extend the space to
   three digits (difficulty from structure: same hundreds, same tens), or reject the objective. Prefer extending.
7. **8.1o flaky tests.** `compareNumbers.test.ts` (tier gaps), `areaModelItemSpace.test.ts`,
   `gemini-di-shapes.test.ts` fail in the full vitest run and pass alone. Seed the sampled assertions or widen them
   to what the space guarantees. Do this last: 8.1j touches `compareNumbers`.

## Verification

- Each fix: the primitive's tests plus `/eval-test <id>` on the touched mode at easy/medium/hard, or the oracle if
  the primitive has one. Report the before/after numbers (e.g. the answer-unit share for 8.1i).
- Gates (verbatim in CLAUDE.md "Commands"): `npm run typecheck:lumina` = 0; full tsc not above baseline (770,
  re-measure once at start); `npm test` full suite once at the end, for 8.1o.
- Rendering changes (8.1a): say "needs a browser check" unless you drive it, and file a HUMAN-CHECKS row
  (re-grep the next free `### #N` right before filing).

## Close-out

Mark each row DONE in `qa/difficulty-demo/QUEUE.md` with its commit, in the same commit as the fix. Update the
phase 8 row of `WORKSTREAMS.md` when the batch ends. End with the Easy/Medium/Hard table per touched mode
(user preference, memory `feedback_item-space-report-and-all-modes`).
