# array-grid — Oracle-Fix Report (2026-07-07)

**Source:** `/oracle-test` · **Severity:** HIGH — `scope` (content exceeds the objective).

## The bug

array-grid picks its (rows, columns) pairs in CODE (`selectDimensionPairs`). The
Tier-2 `resolveScopeRange` narrows the *dimension* bands (rows ≤ 6, columns ≤ 8),
but the objective "multiplication **to 20**" is a **product** ceiling — a 6×8
array has perfectly in-range dimensions yet a product of 48. Nothing bounded the
product, and `resolveScopeRange` doesn't even fire when the bound arrives via the
topic alone (no `objectiveText`/`intent`). Live on "Arrays and multiplication to
20": `5×8=40`, `4×8=32`, `5×7=35`. Oracle: 16 scope violations / run.

## The fix (GENERATOR — product ceiling)

`gemini-array-grid.ts`:
- Added `parseProductCeiling(scope)` — scans topic + objective + intent for the
  same `to|within|up to N` bound the oracle's `parseScopeCeiling` uses, so the
  generator and the content check agree. Returns undefined when no bound is stated
  → grade-band dimension ranges stand (no regression on unbounded topics).
- `selectDimensionPairs` now takes `productMax` and rejects any pair whose
  `rows × columns` exceeds it — in BOTH the distinct-pair loop and the
  duplicate-tolerant fallback (out-of-scope content is worse than a repeated card).

## Verification

| Mode | Before | After |
|------|--------|-------|
| multiply_array | FAIL — products to 48 on "to 20" | **PASS** — 0 violations / 35 challenges |
| count_array | (scope gap) | **PASS** — 0 / 35 |
| build_array | (scope gap) | **PASS** — 0 / 25 |

`typecheck:lumina` 0 errors · oracle unit suite 115/115. Unbounded topics keep the
grade-band ranges (productMax undefined → no filtering).
