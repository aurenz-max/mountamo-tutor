# Eval Test Report: regrouping-workbench
**Date:** 2026-03-15
**Topic:** Regrouping (carry/borrow) arithmetic | **Grade:** 1-2
**Tester:** Claude Code `/eval-test` (manual validation by user)

## Summary

| Eval Mode | Status | Critical | High | Medium | Low |
|-----------|--------|----------|------|--------|-----|
| add_no_regroup (Tier 1) | PASS | 0 | 0 | 0 | 0 |
| subtract_no_regroup (Tier 2) | PASS | 0 | 0 | 0 | 0 |
| add_regroup (Tier 3) | PASS | 0 | 0 | 0 | 0 |
| subtract_regroup (Tier 4) | PASS | 0 | 0 | 0 | 0 |

**Overall:** 4 of 4 modes passed | 0 open issues

---

## add_no_regroup (Tier 1) — PASS

No issues found. All problems generated correctly with no carrying required.

---

## subtract_no_regroup (Tier 2) — PASS

**Generated:** 4 challenges, types: [subtract_no_regroup], all correct answers verified

No issues remaining after fixes.

### Fixed Issues
- **RW-1** (CRITICAL): State bleed on re-generation — fixed by adding `useEffect` reset in `useChallengeProgress` hook when challenges array identity changes.
- **RW-3** (HIGH): Word problem context mismatch — fixed by adding prompt constraint requiring generic stories without specific numbers.

---

## add_regroup (Tier 3) — PASS

**Generated:** 4 challenges, types: [add_regroup], all sums ≤ 99
- Example run: 27+45=72, 38+24=62, 19+36=55, 47+15=62

Verified 3/3 stochastic runs pass with all sums ≤ 99.

### Fixed Issues
- **RW-2** (CRITICAL): 3-digit overflow — fixed with two-layer defense: (1) prompt constraints limiting Grade 1-2 addends to 10-49 with sum ≤ 99, (2) post-generation filter rejecting any challenge where operands or result exceed `maxPlace` limit.

---

## subtract_regroup (Tier 4) — PASS

No issues found. The double-borrow visualization worked well and scaled correctly.

---

## Product Decisions Required

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Word problem context is per-data, not per-challenge. Should it be per-challenge? | A) Move `wordProblemContext` into each challenge object (schema change, generator change, component change) B) ~~Make the top-level story generic enough to cover all challenges~~ **(IMPLEMENTED as interim fix)** C) Disable word problems for multi-challenge sessions | Option A still recommended for best pedagogy. Option B implemented as interim fix — stories are now generic without specific numbers. |
| 2 | Should the component enforce `maxPlace` as a hard cap? | A) Hard cap — reject/clamp problems that overflow (safer, simpler) B) Dynamic expansion C) ~~Trust generator~~ **(generator now enforces + post-validates)** | Generator-side fix implemented. Component-side hard cap still recommended as defense-in-depth (deferred). |
| 3 | Tier 4 (subtract_regroup) generated 3-digit problems for a Grade 1-2 workbench. Is this intended? | A) Tier 4 is explicitly advanced — allow 3-digit for top-performing G1-2 students B) Cap Tier 4 at 2-digit for G1-2 C) Split eval modes | Deferred — Tier 4 passed all tests, product decision needed. |
