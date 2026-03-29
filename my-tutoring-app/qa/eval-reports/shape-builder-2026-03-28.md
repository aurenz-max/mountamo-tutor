# Eval Report: shape-builder — 2026-03-28

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build | PASS | — |
| measure | FAIL | 1 (SHB-3) |
| classify | PASS | Fixed: SHB-1 |
| compose | PASS | — |
| find_symmetry | PASS | Fixed: SHB-2 (3/3 stochastic) |
| coordinate_shape | PASS | — |

## Issues

### SHB-3: measure — No actual question/answer mechanism
- **Severity:** HIGH
- **What's broken:** Measure challenges ask questions like "How many different side lengths do you find?" but the component has no answer input. The student toggles the Ruler button, measurements appear, and clicking "Check Answer" auto-passes if all tool buttons were toggled (`propsFound >= propsNeeded` at line 840). No comprehension is assessed — clicking a button is the entire "evaluation."
- **Data:** `handleCheckAnswer` measure path (ShapeBuilder.tsx:832-866) only checks tool toggle count, not student understanding
- **Fix in:** COMPONENT + GENERATOR — Component needs an answer input (numeric input or MC options) after tools are toggled. Generator should produce a `correctAnswer` field for measure challenges. Generator already produces question text; component just ignores it.

## Fixed Issues

### SHB-1: classify — Category names not recognized by component

- **Fix:** Schema enum + prompt change. Added `enum: ["Triangles", "Quadrilaterals", "Pentagons & More"]` to both `classificationCategories` items and `correctCategory` field. Updated classify promptDoc to specify exact category names and vertex-count mapping. Post-process safety net now forces canonical categories and derives correctCategory from vertex count.
- **Result:** Gemini produces matching category names by schema constraint. Mismatch structurally impossible.

### SHB-2: find_symmetry — Lines of symmetry fall between grid dots

- **Fix:** Prompt change (SP-8 pattern). Updated find_symmetry promptDoc with explicit constraint: "ALL vertices must use EVEN x and y coordinates" with good/bad examples. Updated REQUIREMENTS section.
- **Result:** 3/3 stochastic runs produce shapes with integer-coordinate centers. All symmetry lines drawable on grid.
