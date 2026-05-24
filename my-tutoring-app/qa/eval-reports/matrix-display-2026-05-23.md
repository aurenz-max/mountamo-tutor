# Eval Report: matrix-display — 2026-05-23

## Results

| Eval Mode             | Status | Issues |
|-----------------------|--------|--------|
| transpose             | PASS   | —      |
| add_subtract          | PASS   | — (was FAIL — MD-1 fixed) |
| multiply              | PASS   | —      |
| determinant_inverse   | PASS   | — (was FAIL — MD-2 fixed) |

All four eval modes now produce challenges of every advertised challenge type. Bundled modes (`add_subtract`, `determinant_inverse`) interleave the bundle across the session via a per-session shuffled round-robin in `selectMatrixChallenges`.

## Notes

- **Math correctness:** verified by hand for all 9 originally generated challenges (3 transpose, 3 add, 3 multiply, 3 determinant). Every `expectedMatrix` / `expectedScalar` was already correct.
- **Component code paths:** `MatrixDisplay.tsx` already handled all 6 challenge types (`transpose`, `add`, `subtract`, `multiply`, `determinant`, `inverse`) through a shared scalar-vs-matrix input switch and per-type `StepsReveal` branches. No component changes needed.

## Fixed Issues

### MD-1 / MD-2 — Bundled modes only surfaced first type (FIXED 2026-05-23)

- **Pattern:** SP-18 (Bundled multi-type eval modes only ever surface the first allowed type)
- **Root cause:** `generateMatrix` at the old `gemini-matrix.ts:553-554` hardcoded `evalConstraint.allowedTypes[0]` once at the top of the function and reused that single type for every challenge in the session.
- **Fix:** GENERATOR — widened `selectMatrixChallenges` to accept either a single `MatrixChallengeType` or an array, and added a per-session shuffled round-robin so each `idx` picks `sessionOrder[idx % sessionOrder.length]`. The call site now passes `evalConstraint.allowedTypes` (the full array) instead of `allowedTypes[0]`. Single-type modes are unchanged — they pass a one-element array and round-robin is a no-op.
- **Verification (3 stochastic runs each):**
  - `add_subtract`: every run produces `[add, subtract, add]` (both types surfaced every session)
  - `determinant_inverse`: runs produce `[determinant, inverse, determinant]`, `[inverse, determinant, inverse]`, `[determinant, inverse, determinant]` — order varies session-to-session, both types always present
  - `transpose`, `multiply` (single-type): unchanged, still pass
