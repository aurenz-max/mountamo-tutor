# Eval Report: shape-sorter — 2026-03-17

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| `identify` | PASS | 0 |
| `count` | PASS | 0 |
| `sort` | PASS | 0 |

## Notes

### SS-1 (RESOLVED) — Server crash on identify mode
- **Root cause:** Generator imported `SHAPE_PROPERTIES` from `ShapeSorter.tsx` (a `'use client'` module). When the eval-test API route (server component) ran the generator, Next.js threw `"Cannot access circle.curved on the server"`.
- **Fix:** Duplicated `SHAPE_PROPERTIES` as a local constant in `gemini-shape-sorter.ts`, removing the client-module import.
- **Verification:** All 3 modes pass after fix. No regressions.
