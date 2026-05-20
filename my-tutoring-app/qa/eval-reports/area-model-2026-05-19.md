# Eval Report: area-model — 2026-05-19

## Results

| Eval Mode    | Status | Issues |
|--------------|--------|--------|
| build_model  | PASS   | —      |
| find_area    | PASS   | —      |
| perimeter    | PASS   | —      |
| multiply     | PASS   | —      |
| factor       | PASS   | —      |

## Notes

- API `status: pass` for all 5 modes — this is a render-layer issue, not a data-shape issue. `/eval-test` validates JSON structure; it can't detect CSS overflow.
- The earlier 2026-03-18 report on area-model only covered the description-hallucination fix (AM-1) and did not exercise multi-digit multiply rendering at viewport scale.

### Fixed — AM-2: multiply cell-size overflow (2026-05-19)

Cell-size formula in AreaModel.tsx replaced from unbounded linear (`Math.max(100, part * 8)` / `Math.max(80, part * 6)`) to bounded log-scaled helpers:

- `cellWidthForPart(part) = Math.max(100, Math.log10(Math.max(1, part)) * 80 + 60)`
- `cellHeightForPart(part) = Math.max(80, Math.log10(Math.max(1, part)) * 60 + 50)`

Both helpers defined at module scope, called from all 6 sizing sites (factor-mode top inputs, dimension top labels, factor-mode left inputs, dimension left labels, grid cell minHeight/minWidth). Log scaling preserves the pedagogical "300-cell visibly wider than 8-cell" cue while keeping multi-digit grids inside the `max-w-6xl` container:

| part | old width | new width |
|------|-----------|-----------|
| 8    | 100px     | 100px     |
| 40   | 320px     | 188px     |
| 100  | 800px     | 220px     |
| 300  | **2400px** | 258px     |
| 400  | **3200px** | 268px     |

Re-test after fix: multiply mode produced `[200,40,4]×[20,3]`, `[200,20,9]×[40,5]`, `[400,30,6]×[40,9]` — all fit within container. Other 4 modes unaffected (their parts < 50 still land on the 100/80 floor exactly as before).
