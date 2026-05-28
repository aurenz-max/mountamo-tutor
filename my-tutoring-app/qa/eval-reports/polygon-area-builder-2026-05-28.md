# Eval Report: polygon-area-builder — 2026-05-28

Fork A (pool service). Wrapper from Gemini; 3-6 figures per session built deterministically in local code.

## Results

| Eval Mode | Status | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|--------|------------|----|----|----|----|----|---------|
| decompose | pass | 4 | OK | N/A | OK | OK | OK | PASS |
| find_area_triangle_parallelogram | pass | 4 | OK | N/A | OK | OK | OK | PASS |
| find_area_trapezoid | pass | 4 | OK | N/A | OK | OK | OK | PASS |
| composite_area | pass | 4 | OK | N/A | OK | OK | OK | PASS |
| coordinate_polygon | pass | 4 | OK | N/A | OK | OK | OK | PASS |

## G1–G5 Sync Check: ALL PASS

- **G1 (required fields):** decompose → base/height/skew (skew<base verified); triangle → base/height/apexX; parallelogram → base/height/skew; trapezoid → base/base2/height/topOffset; composite → parts[]{x,y,w,h}; coordinate → vertices[]{x,y}. All present.
- **G2 (flat-field reconstruction):** N/A — pool service emits no flat indexed fields; all per-challenge data is built locally as proper objects/arrays.
- **G3 (semantic differentiation):** each eval mode maps to one distinct challengeType producing a visibly distinct figure type. find_area_triangle_parallelogram correctly mixes triangle + parallelogram with ≥1 of each.
- **G4 (answer derivability):** all 20 sampled areas recompute exactly from the visible geometry. Examples: triangle 6×9/2=27; parallelogram 10×6=60; trapezoid (16+8)×8/2=96; composite 10×4+8×2=56; coordinate triangle (3,0)(9,0)(3,3) shoelace=9; coordinate rect 6×5=30.
- **G5 (fallback quality):** only defensive `?? 0` defaults exist; the pool always populates the fields, and `recomputeArea()` post-validation re-derives every `expectedArea` and self-corrects on drift. No answer-leaking fallback fires in normal operation.

## Answer-leak audit (component)
- Area read-out is never shown before commit; only dimension/coordinate labels (the inputs) are visible.
- decompose reveals base/height labels only AFTER the student forms the rectangle.
- composite labels each piece's width/height (the decomposition work), not the total.
- coordinate labels vertices (inputs), not the area.

Generator: `service/math/gemini-polygon-area-builder.ts` · Component: `primitives/visual-primitives/math/PolygonAreaBuilder.tsx`
