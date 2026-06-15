# Eval Report: coordinate-graph — 2026-06-14

Focus: **difficulty** (support-tier sweep, Step 2c). All four eval modes swept at
baseline / easy / medium / hard.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| plot_point     | PASS | — |
| read_point     | PASS | — |
| find_slope     | PASS | — |
| find_intercept | PASS | — |

> **Blocker found & fixed this run (CRITICAL):** the generator was pinned to
> `gemini-2.0-flash-lite`, which Google has retired (`404 NOT_FOUND … no longer
> available`). It was the **only** math generator still on that model — every
> sibling uses `gemini-flash-lite-latest`. Every mode returned 0 challenges until
> fixed. Swapped line 489 to `gemini-flash-lite-latest`; sweep then ran clean.

## Difficulty Sweep — Support Tiers

The generator implements support tiers correctly (`config.difficulty` →
`normalizeSupportTier` → `resolveSupportStructure` per-challenge, gated on the tier
not on `pinnedType`, so blends get difficulty too).

### 1. Scaffold withdrawal (code-set, deterministic) — VERIFIED FLIPS

| Mode | easy | medium | hard |
|------|------|--------|------|
| plot_point | hover ✓, axis ✓ | hover ✗, axis ✓ | hover ✗, axis ✗ |
| read_point | drop-lines ✓, axis ✓ | drop-lines ✗, axis ✓ | drop-lines ✗, axis ✗ |
| find_slope | guides ✓, rr-labels ✓, pt-labels ✓ | guides ✓, rr-labels ✗, pt-labels ✓ | all ✗ |
| find_intercept | eq-label ✓, marker ✓ | eq-label ✗, marker ✓ | eq-label ✗, marker ✗ |

All flags flipped exactly as `resolveSupportStructure` declares.

### 2. Structural problem lever (prompt-shaped) — VERIFIED MOVES

- **find_slope** slope cleanliness climbs: easy = integers (2, −1, 3, 0); medium
  = + unit fractions (1/2, −1/3); hard = non-unit fractions needing reduction
  (2/3, −2/3, 3/2, −4/3).
- **find_intercept** extrapolation distance climbs: easy = a defining point sits
  ON the y-axis (read directly); medium = both points off-axis (extend the line);
  hard = far points + fractional slopes (extrapolate). All intercepts stayed
  integer and in-grid.
- plot_point / read_point are perception modes — scaffold-withdrawal only, no
  structural lever (correct by design).

### 3. Magnitude invariance — HELD

Grid range is fixed by `getGridRange(grade, type)`; the tier never touches it.
All coordinates stayed within the mode's grid band at every tier. Difficulty is
structural, not bigger numbers. ✓

### 4. No answer leak at any tier — CONFIRMED

The `equationLabel` (which states the intercept) is withdrawn at medium/hard.
read_point's correct option always matched the displayed point. plot_point's
answer only shows after 2 fails (standard reveal).

### 5. Null-tier no-op — CONFIRMED

Baseline (no `&difficulty=`) leaves all scaffold flags `undefined`, `supportTier`
undefined, and the component defaults every aid ON via `!== false` (drop-lines
default OFF). Pre-tier behavior unchanged.

## Issues

### dead model — generator pinned to retired gemini-2.0-flash-lite
- **Severity:** CRITICAL
- **What's broken:** `gemini-2.0-flash-lite` is no longer served (404); every mode
  produced 0 challenges. Sole generator still on this model.
- **Data:** `model: "gemini-2.0-flash-lite"` → `"gemini-flash-lite-latest"` (line 489)
- **Fix in:** GENERATOR — **RESOLVED this run.**
