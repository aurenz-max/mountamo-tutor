# Eval Report: equation-builder — 2026-05-24

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build     | FIXED  | 1 (component) |
| rewrite   | FIXED  | 1 (component, same root cause) |
| missing-value | PASS | — |
| true-false | PASS | — |
| balance   | PASS  | — |

## Issues

### build / rewrite — Tiles duplicated in workspace on pick

- **Severity:** CRITICAL
- **What's broken:** Clicking a tile in the pool placed it twice in the workspace while removing it only once from the pool. User-visible: workspace shows `1 + 4 = 5 5` when only one `5` was clicked. Makes the build/rewrite modes effectively unsolvable for the student.
- **Root cause:** `handlePickTile` called `setWorkspaceSlots(ws => [...ws, tile])` *inside* the `setPoolTiles(prev => ...)` updater. React Strict Mode (enabled by default in Next.js) double-invokes state updaters in development to detect impurities; the nested functional set ran twice and appended the tile twice. `handleRemoveSlot` had the mirror-image bug.
- **Data:** Generated `availableTiles: ["1","4","9","=","5","2","8","+"]` rendered fine — bug was 100% in the component.
- **Fix in:** COMPONENT — read the tile value out of state before calling either setter, then call `setPoolTiles` and `setWorkspaceSlots` independently. Applied in [EquationBuilder.tsx:446-460](../../src/components/lumina/primitives/visual-primitives/math/EquationBuilder.tsx#L446-L460).
