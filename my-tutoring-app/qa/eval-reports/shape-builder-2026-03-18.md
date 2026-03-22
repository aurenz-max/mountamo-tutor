# Eval Report: shape-builder — 2026-03-18

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| classify  | FAIL   | 1      |

## Issues

### classify — Category names not recognized by component

- **Severity:** CRITICAL
- **What's broken:** The generator produces free-text category names (e.g., "Four-Sided Shapes", "Shapes with 4 Sides", "Other Shapes") but the component's `handleClassify` only recognizes a hardcoded set of exact keys (`triangles`, `quadrilaterals`, `pentagons`, `hexagons`, `polygons`) and property keywords (`right angle`, `parallel`, `equal`). Any category name outside these patterns falls to an unreliable shape-name fallback, causing correct student answers to be marked wrong.
- **Data:** `classificationCategories = ["Shapes with 3 Sides", "Shapes with 4 Sides", "Shapes with 5 or More Sides"]` — none match sideCountMap keys
- **Fix in:** GENERATOR (constrain classificationCategories enum) and/or COMPONENT (parse side-count from natural language)
