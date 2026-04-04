# Eval Report: shape-strength-tester — 2026-04-03

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| (free-form, no eval modes) | FAIL | 2 |

## Issues

### SS-1 — Canvas click offset: beams placed away from mouse cursor
- **Severity:** CRITICAL
- **What's broken:** `convertScreenToSVGCoords` uses manual `rect.width/rect.height` scaling which doesn't account for SVG `preserveAspectRatio` padding. When the container is wider than the viewBox aspect ratio, the SVG content is centered but `getBoundingClientRect()` returns the full element size — so click coordinates map incorrectly (shifted right).
- **Data:** `canvasWidth=600, viewBox height=500, scaleX = 600/rect.width` (wrong when aspect-ratio padding exists)
- **Fix in:** COMPONENT — replace manual math with `svg.createSVGPoint()` + `getScreenCTM().inverse()` which handles aspect ratio natively.

### SS-2 — Collapsed structure passes: tower falls but "survived" = true
- **Severity:** CRITICAL
- **What's broken:** `stopSimulation` sets `survived = failedBeams.length === 0` — only checking if beams snapped past their `maxStretch`. A structure can topple/collapse entirely (all particles fall to ground) without any individual beam breaking, so `survived` is `true`. In the screenshot: structure is flat on the ground (height 99px vs target 280px, 1 triangle vs target 5) but Status = PASSED.
- **Data:** `survived = failedBeams.length === 0` (line 406), no height/collapse check
- **Fix in:** COMPONENT — add collapse detection: compare current physics height to original height; if `heightRetained < 0.5`, mark as failed. Also enforce challenge goals (targetTriangles, targetHeight) as pass/fail criteria.
