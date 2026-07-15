# Eval Report: shape-tracer — 2026-07-14

Targeted re-test of the `trace` mode against a reported defect: *"'Trace the square' challenges ship with the wrong path — the tracePath should be code-derived, not LLM-emitted."* **Confirmed, and more severe than reported: the LLM-emitted path routinely deadlocks the challenge.**

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace | **FAIL** | 1 (SHT-1, CRITICAL) |
| connect-dots | not re-run | at-risk (shares the LLM-emitted-geometry channel) |
| complete | not re-run | — |
| draw-from-description | not re-run | — |

> Only `trace` was exercised this run. The 2026-06-20 structural sweep marked all 4 modes PASS, but it asserted **shape identity + scaffold flags + structural levers** on the *tiered reconstruction* path — it never asserted `tracePath.length === (canonical vertex count for targetShape)`, so this slipped through.

## Issues

### trace — LLM-emitted tracePath appends a duplicate closing vertex → unsolvable
- **Severity:** CRITICAL
- **What's broken:** `generateTrace` ([gemini-shape-tracer.ts:636-648](../../src/components/lumina/service/math/gemini-shape-tracer.ts#L636-L648)) trusts `data.vertices` from Gemini with the only guard being `vertices.length < 3 → fallback`. Gemini routinely "closes the loop" by repeating the first vertex, so an N-vertex shape ships **N+1** points with `path[N] === path[0]` (coincident). `targetShape`/`instruction` still say "square" (4), but the path has 5 points.
- **Why it's not just cosmetic (the deadlock):**
  - The component sets `totalSides = tracePath.length` ([ShapeTracer.tsx:259](../../src/components/lumina/primitives/visual-primitives/math/ShapeTracer.tsx#L259)) → a square is treated as a **5-sided** shape, and the tutor is told the student "traced a square with 5 sides" ([ShapeTracer.tsx:405-406](../../src/components/lumina/primitives/visual-primitives/math/ShapeTracer.tsx#L405-L406)).
  - Vertex dots render in array order ([ShapeTracer.tsx:736-787](../../src/components/lumina/primitives/visual-primitives/math/ShapeTracer.tsx#L736)), so the duplicate dot (idx N) paints **on top of** dot 0 at the identical pixel. Taps are order-gated: `if (vertexIndex !== tappedIndices.length) reject` ([ShapeTracer.tsx:370](../../src/components/lumina/primitives/visual-primitives/math/ShapeTracer.tsx#L370)). Every click on the start vertex hits the top-painted duplicate (idx N) → `N !== 0` → rejected. The student **cannot register the ordered taps**, and completion requires `newTapped.length === path.length` ([ShapeTracer.tsx:382](../../src/components/lumina/primitives/visual-primitives/math/ShapeTracer.tsx#L382)). The trace can never complete.
- **Frequency (runtime, live API):** stochastic but majority. Observed across topics/shapes:
  - `triangle` → pathLen **4** (exp 3), last dot = first dot
  - `square` → pathLen **5** (exp 4), last dot = first dot
  - `rectangle` → pathLen **5** (exp 4) — and **4** (clean) on other draws
  - `hexagon` → pathLen **7** (exp 6) — and **6** (clean) on another draw
  - `pentagon` → **5** (clean) in samples
  - Roughly 60–80% of sampled trace challenges carried the extra vertex.
- **Data:** `targetShape="square"`, `tracePath=[{150,100},{350,100},{350,300},{150,300},{150,100}]` (5 pts; pt[4]===pt[0]).
- **Root cause = the reported feedback, confirmed:** the answer-bearing geometry (`tracePath`) is LLM-emitted and unvalidated against the named shape. The generator already owns the canonical vertices (`SHAPE_VERTICES` / `getVertices`, [gemini-shape-tracer.ts:785-796](../../src/components/lumina/service/math/gemini-shape-tracer.ts#L785-L796)) and already **code-derives** them in the axis-2 `reconstructTrace` path — the base (untiered) path just doesn't use them. The `length < 3` guard cannot catch a closing-duplicate (length ≥ 3) or a wrong vertex count.
- **Tier path is also exposed:** `applyStructuralShape` reconstructs from `getVertices` **only when `ch.targetShape !== target`** (honor-don't-churn, [gemini-shape-tracer.ts:880](../../src/components/lumina/service/math/gemini-shape-tracer.ts#L880)). When the LLM's shape already equals the tier's ladder target (e.g. easy G1 → triangle, and the plan picked triangle), reconstruction is skipped and the duplicate survives even at that tier.
- **Fix in:** GENERATOR — validate/derive the trace path against the target shape's canonical vertex count (DERIVE, not validate): if `data.vertices` doesn't match the expected vertex count for `shape` (accounting for a coincident closing dup), rebuild from `getVertices(shape)`. Same treatment should extend to `connect-dots` dots and the honor-don't-churn skip. (Verification note: the data defect is runtime-reproduced via the live eval-test API; the deadlock is established by code inspection of the coincident-dot z-order + order-gated tap logic — a browser click-through would make it 100%, but the failure is structural.)
