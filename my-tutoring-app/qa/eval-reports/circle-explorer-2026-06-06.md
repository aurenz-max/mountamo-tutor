# QA Eval Report — `circle-explorer`

**Date:** 2026-06-06
**Tester:** Claude Code (eval-test QA)
**Dev server:** http://localhost:3000
**Architecture:** Fork A pool service — all per-challenge data built in code (`selectCircleExplorerChallenges`), Gemini emits wrapper metadata only.

## Results Table

```
QA Results — circle-explorer
| Eval Mode      | API      | #Ch | G1   | G2   | G3   | G4   | G5   | Verdict |
|----------------|----------|-----|------|------|------|------|------|---------|
| discover_pi    | 200 pass |  4  | PASS | PASS | PASS | PASS | PASS | PASS    |
| circumference  | 200 pass |  4  | PASS | PASS | PASS | PASS | PASS | PASS    |
| area           | 200 pass |  4  | PASS | PASS | PASS | PASS | PASS | PASS    |
| reverse        | 200 pass |  4  | PASS | PASS | PASS | PASS | PASS | PASS    |
| composite      | 200 pass |  4  | PASS | PASS | PASS | PASS | PASS | PASS    |
| Auto (mixed)   | 200 pass |  8  | PASS | PASS | PASS | PASS | PASS | PASS    |
```

> **Auto (mixed) added 2026-06-06.** Originally this row would have FAILED (SP-21): with no `targetEvalMode` the null constraint still let the root-level `challengeType` enum pick **one** tier, so `[CircleExplorer] … mixed difficulty` actually produced `discover_pi ×4`. Fixed — see "Auto (mixed) path — SP-21 fix" below.

## Per-mode challenge summary

### discover_pi (4 ch, ids ce-1..ce-4 unique)
| id | type | radius | given | answerKind | expected | tol |
|----|------|--------|-------|-----------|----------|-----|
| ce-1 | discover_pi | 3 | diameter | ratio | 3.14 | 0.15 |
| ce-2 | discover_pi | 4 | diameter | ratio | 3.14 | 0.15 |
| ce-3 | discover_pi | 5 | diameter | ratio | 3.14 | 0.15 |
| ce-4 | discover_pi | 9 | diameter | ratio | 3.14 | 0.15 |

### circumference (4 ch)
| id | radius | given | expected | recomputed | tol |
|----|--------|-------|----------|-----------|-----|
| ce-1 | 8 | radius | 50.24 | 50.24 | 1.005 |
| ce-2 | 9 | diameter | 56.52 | 56.52 | 1.130 |
| ce-3 | 9.5 | diameter | 59.66 | 59.66 | 1.193 |
| ce-4 | 15 | radius | 94.2 | 94.2 | 1.884 |
Variance: both `radius` and `diameter` present. ✓

### area (4 ch)
| id | radius | given | expected | recomputed | tol |
|----|--------|-------|----------|-----------|-----|
| ce-1 | 3 | radius | 28.26 | 28.26 | 0.565 |
| ce-2 | 8 | diameter | 200.96 | 200.96 | 4.019 |
| ce-3 | 10 | radius | 314 | 314 | 6.28 |
| ce-4 | 10 | diameter | 314 | 314 | 6.28 |
Variance: both `radius` and `diameter` present. ✓

### reverse (4 ch)
| id | radius | reverseGiven | givenValue | expected(=r) | givenValue check | tol |
|----|--------|--------------|-----------|--------------|------------------|-----|
| ce-1 | 5 | area | 78.5 | 5 | round1(3.14·r²)=78.5 ✓ | 0.2 |
| ce-2 | 5 | circumference | 31.4 | 5 | round1(2·3.14·r)=31.4 ✓ | 0.2 |
| ce-3 | 8 | circumference | 50.2 | 8 | 50.24→50.2 ✓ | 0.2 |
| ce-4 | 12 | circumference | 75.4 | 12 | 75.36→75.4 ✓ | 0.2 |
Variance: both `area` and `circumference` present. ✓ expectedAnswer === radius for all. ✓

### composite (4 ch)
| id | shape | radius | squareSide | expected | recomputed | tol |
|----|-------|--------|-----------|----------|-----------|-----|
| ce-1 | semicircle_perimeter | 2 | – | 10.28 | 10.28 | 0.5 |
| ce-2 | circle_in_square | 3 | 6 | 7.74 | 7.74 | 0.5 |
| ce-3 | semicircle_area | 4 | – | 25.12 | 25.12 | 0.5 |
| ce-4 | semicircle_area | 7 | – | 76.93 | 76.93 | 1.539 |
Variance: 3 of 3 shapes rotated; squareSide present for circle_in_square; radius = squareSide/2 (3 = 6/2). ✓

## G1–G5 Sync Check

**ALL PASS.** No CRITICAL or HIGH issues found. No generator or component changes required.

- **G1 Required fields** — Every challenge across all five modes carries the full contract field set (id, type, narration, instruction, hint, unitLabel, radius, given, usePiApprox, answerKind, expectedAnswer, tolerance) plus the correct mode-specific fields (reverseGiven/givenValue for reverse; compositeShape/squareSide for circle_in_square). No empty/missing fields.
- **G2 (count + unique ids)** — Each mode returns exactly 4 challenges (within 3–6) with unique sequential ids `ce-1`..`ce-4`.
- **G3 Mode differentiation** — Every challenge matches its declared mode `type`. All multi-variant modes pass variance: circumference & area both contain `radius` and `diameter`; reverse contains both `circumference` and `area`; composite rotates all 3 shapes. No monocultures.
- **G4 Answer derivability** — All 20 expectedAnswers recomputed with π=3.14 per contract formulas and matched stored values within 0.01. reverse expectedAnswer === radius confirmed, and givenValue matches round1(2·π·r) / round1(π·r²) for all reverse items.
- **G5 Fallback quality** — Reviewed `gemini-circle-explorer.ts`:
  - The post-Gemini `?? 'circumference'` default only fires if Gemini returns an invalid challengeType; in eval-test the eval constraint forces the mode, so the catalog-resolved `allowedTypes[0]` is used first. Default is a valid mode either way.
  - The dedup back-fill loop (lines 406–414) appends valid, fully-formed challenges built by the same `build*` functions; duplicates are only accepted when the structural variant space is exhausted (e.g. discover_pi with limited radii). All fallback challenges remain contract-valid.
  - `recomputeExpected` covers all five modes (and all three composite shapes) and runs over every challenge before return, correcting any drift — guards every mode. circumference recompute uses `2·π·r`, which equals `π·d` for given='diameter' (r=d/2), so it is consistent with the contract.

## Answer-leak check
- **reverse** — Component reverse-mode draw block (CircleExplorer.tsx ~L474–494) renders only the given `C =`/`A =` label and a dashed radius line cued as `r = ?`. The radius (the answer) is NOT labeled. **No leak.** ✓
- **discover_pi** — Canvas shows the circumference and diameter and a track that visually approximates "≈ 3.14 d"; the ratio 3.14 is the quantity the student is asked to compute (intended pedagogy), and the answer field is gated behind unrolling. Acceptable. ✓

## Auto (mixed) path — SP-21 fix (applied 2026-06-06)

Same root cause and fix shape as polygon-area-builder PAB-1. The unconstrained "Auto" path (`evalConstraint === null`) used `selectCircleExplorerChallenges(oneType)`, building the whole session from a single Gemini-picked tier — the "mixed difficulty" log line was never true.

**Generator-only fix** in `service/math/gemini-circle-explorer.ts`:
- `TIER_ORDER` (discover_pi → circumference → area → reverse → composite) + `TIER_RANK`, `MIXED_INSTANCE_COUNT = 8`.
- `buildForType(type)` dispatch over the existing per-type builders (variant tiers pick their structural variant at random — no new figure code).
- `selectMixedCircleExplorerChallenges(count)`: shuffled round-robin over all five tiers (every tier guaranteed), dedup within session, then sort by `(TIER_RANK, radius)` → strict low→high difficulty ramp.
- `generateCircleExplorer` routes the null-constraint path to the mixed builder; top-level `challengeType='discover_pi'` is representative metadata only (component renders per-challenge `currentChallenge.type`). `gradeBand` stays `'7'`.
- IRT-pinned modes pass a non-null constraint → existing single-type path untouched.

**Verified live (2026-06-06):** Auto → 8 challenges, all 5 tiers, ordered `discover_pi, discover_pi, circumference, area, area, reverse, reverse, composite/semicircle_area`; radius scales within each tier; every `expectedAnswer` recomputed via `recomputeExpected`. All 5 IRT-pinned modes still PASS single-type count=4 (no regression). `tsc --noEmit` clean (global 1441, baseline).

## Non-blocking observations (not G1–G5 failures, no fix applied)
- **Composite narration bleed:** `COMP_CTX` is a single shared context pool across all three composite shapes, so a circle-in-square figure can be narrated "A semicircular rug …" (ce-2) and a semicircle "A round table in a square room …" (ce-3). The figure/grading is correct; only the flavor sentence is mismatched. Cosmetic only — left unchanged to keep edits scoped to G1–G5. Future polish: shape-specific context pools.
