# Structural-Difficulty Eval-Test — polygon-area-builder (2026-06-20)

Step-2c support-tier difficulty sweep. Live dev server, `/api/lumina/eval-test`.
Archetype: builder-constructor. 4 instances/mode. Brief: 2 of 5 modes carry clean
code-enforced levers (composite_area piece-count, coordinate_polygon vertex-count);
trapezoid topOffset asymmetry is code-enforced but weaker; decompose = honest skip
(none); find_area_triangle_parallelogram = prompt/selection-shaped re-weight.

## Results

| Mode | Lever (code) | Baseline | Easy | Hard | Scaffold flip | Magnitude | Verdict |
|------|------|----------|------|------|---------------|-----------|---------|
| coordinate_polygon | vertex-count: rect 4v → L-shape 6v | mixed 3v/4v, scaffolds null, area 4-35 | all 4v (rectangle), guides=T, area 8-18 | all 6v (L-hexagon), guides=F, area 21-30 | guides T→F ✓ | in-band (≤35) ✓ | PASS |
| composite_area | piece-count: 2 → 3 → 2 | 2 pieces, scaffolds null, area 34-53 | 2 pieces, guides=T region=T, area 38-60 | 2 pieces, guides=F region=F, area 24-44 | guides T→F, region T→F ✓ | in-band ✓ | PASS |
| find_area_trapezoid | topOffset: isosceles → scalene | (n/a) | all centered (isosceles), guides=T grid=T, area 18-72 | off-center (scalene), guides=F grid=F, area 20-55 | guides+grid T→F ✓ | in-band ✓ | PASS |

### composite_area medium (full ladder)
- medium: **3 pieces**, guides=T region=F, area 27-35. Confirms the piece-count lever
  moves easy(2)→medium(3); hard pins back to 2 **by design** (the brief CAP — the union-
  outline render is 2-rect only, so the hard-tier structural step is guide-withdrawal,
  owned by the scaffolding axis, not piece-count). So easy-vs-hard piece-count is
  saturated-honest; the lever genuinely fires at the easy→medium rung.

### coordinate_polygon lever (exact, code-enforced)
- easy: 4 of 4 rectangles (4 vertices, area = w·h, zero decomposition).
- hard: 4 of 4 L-shaped hexagons (6 vertices, multi-piece / shoelace).
- Vertex count moves 4 → 6 exactly; cleanest lever on this primitive.

### find_area_trapezoid lever (exact, code-enforced)
- easy isosceles: topOffset = extra/2 (centered) on every figure
  (extra=2,off=1 / extra=6,off=3 / extra=8,off=4 ×2) ✓.
- hard scalene: off-center, ≠ centered where extra≥2
  (extra=3,off=1 / extra=8,off=2 / extra=8,off=1) ✓; extra=1 falls back to right
  (topOffset=0) — documented floor behavior, still a valid trapezoid (b1≠b2).

## Assertions (easy vs hard)

1. **Scaffold withdrawal (code-set):** PASS all 3 modes. `showDecompositionGuides`
   T→F everywhere; `showGridOverlay` T→F (trapezoid); `showRegionAreaLabel` T→F
   (composite). Matches `resolveSupportStructure` exactly. `supportTier` echoed onto
   each challenge.
2. **Structural lever moves:** PASS. coordinate 4v→6v and trapezoid isosceles→scalene
   move exactly easy→hard. composite 2→3→2 = saturated-honest at the easy/hard pair
   (fires at easy→medium; hard saturation is the documented CAP, not a defect).
3. **Magnitude invariance:** PASS. No tier inflates past the band. coordinate
   easy 8-18 / hard 21-30 (baseline 4-35); composite easy 38-60 / med 27-35 /
   hard 24-44 (baseline 34-53); trapezoid easy 18-72 / hard 20-55. Number bands
   (base/height/coords) unchanged across tiers — "harder" is more steps, not bigger.
4. **No answer leak:** PASS. expectedArea is never rendered; the easy region-area
   sub-label (composite) shows only ONE region's worked area, never the asked total.
   Checker reads expectedArea independent of any withdrawn scaffold.
5. **Null-tier no-op:** PASS. Baseline (no &difficulty) returns the legacy default —
   all scaffold flags null/None and the legacy figure mix (coordinate rotates 3v/4v,
   composite 2-piece). Not already-hard.

## Issues

None. No CRITICAL or HIGH findings. The capability is correctly wired on the three
code-enforced modes; decompose and find_area_triangle_parallelogram were not swept
(brief marks them none / prompt-shaped — out of scope for code-enforced assertion).
