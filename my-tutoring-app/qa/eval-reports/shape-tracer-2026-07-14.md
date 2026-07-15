# Eval Report: shape-tracer — 2026-07-14

Targeted re-test of the `trace` mode against a reported defect: *"'Trace the square' challenges ship with the wrong path — the tracePath should be code-derived, not LLM-emitted."* **Confirmed (deadlock, more severe than reported) — and now RESOLVED at the root: the LLM no longer emits any coordinates.**

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| trace | **PASS** | SHT-1 RESOLVED |
| connect_dots | **PASS** | — (was at-risk; same channel, now code-placed) |
| complete | **PASS** | — (same latent bug closed proactively) |
| draw_from_description | **PASS** | — (no rendered geometry) |

All four modes runtime-verified via the live eval-test API (real generator → real challenge data) plus a deterministic geometry probe. Every trace path / dot set / complete-split now carries **exactly the shape's canonical vertex count**, distinct and in-bounds, with no closing duplicate.

## Resolution (SHT-1)

**Root cause (confirmed):** the answer-bearing geometry (`tracePath`, `dots`, `segments`) was LLM-emitted and unvalidated. Gemini routinely "closed the loop" by repeating the first vertex, shipping an N-vertex shape as **N+1** coincident-dot points (`path[N]===path[0]`). Because vertex dots render in array order and taps are order-gated (`if (vertexIndex !== tappedIndices.length) reject`), the duplicate dot painted on top of dot 0 and intercepted every start tap → the ordered sequence could never complete (deadlock). The base generator's only guard was `length < 3`, which a coincident-close (length ≥ 3) passes. Runtime-reproduced across ~60–80% of trace challenges.

**Fix — code builds the structure; the LLM only picks a window.** Rather than catching bad vertices (validate), we removed coordinates from the LLM's job entirely (derive):

- New deterministic `placeShape(shape, knobs)` in [gemini-shape-tracer.ts](../../src/components/lumina/service/math/gemini-shape-tracer.ts) affine-transforms the artist-tuned canonical `SHAPE_VERTICES` (scale + rotate + translate) and **always returns exactly N distinct, ordered, in-bounds vertices** — a wrong count or a closing duplicate is now structurally impossible.
- Gemini now emits only cosmetic knobs — `size` (`small`/`medium`/`large`), `rotationDeg` (**code-clamped to ±20°** so a square never reads as a diamond at K/G1), and `position` — all sanitized by `resolveKnobs()`; garbage/missing knobs fall back to canonical defaults. It never emits coordinates.
- `shrinkToFit()` scales a rotated/large shape down about its centroid when its bbox would exceed the 500×400 canvas (a translation can't rescue a shape bigger than the canvas), then `fitWithinCanvas()` nudges it in-bounds. Both preserve the vertex count.
- Applied to **all three geometry-bearing modes**: `trace` (path), `connect_dots` (dots = vertices labeled 1..n, order = 0…n-1), `complete` (`buildCompleteFromVertices` splits the ring into ~half pre-drawn sides + remaining vertices). `draw_from_description` is untouched (properties only, no coordinates).
- Removed the `vertices` / `dots` + `correctOrder` / `segments` + `remainingVertices` fields from the three per-type schemas — the output is now tiny, which also reduces flash-lite truncation risk (SP-6 adjacent).
- **Defaults (medium / 0° / center) reproduce the canonical positions exactly**, so the axis-2 structural-tier work (`reconstructTrace`/`reconstructComplete`/`applyStructuralShape`, refactored to share `buildCompleteFromVertices`) does not regress. The honor-don't-churn skip is now safe by construction: the base challenge arrives with clean, code-placed geometry, so there is no dirty path left for the skip to preserve.

**Verification:**
- Deterministic geometry probe (all shapes × 9 knob combos incl. large/rotated/positioned/garbage): defaults reproduce canonical exactly; every result has the exact vertex count, no coincident vertices, all in-bounds. (Caught two real issues pre-commit — `large` overflow on pentagon/rhombus, and a NaN-rotation guard — both fixed via `shrinkToFit` + `Number.isFinite`.)
- Live eval-test, all 4 modes `pass`: trace path counts = canonical (3/4/4/5/6…); connect_dots dots = N with order 0…n-1; complete drawn+remaining half-split consistent; draw properties correct.
- `npm run typecheck:lumina` — 0 errors on the active surface.

## Note on the original 2026-06-20 sweep

The prior structural sweep marked all 4 modes PASS but asserted shape identity + scaffold flags + structural levers on the *tiered reconstruction* path — it never asserted `tracePath.length === (canonical vertex count)` on the *base* path, so the closing-duplicate slipped through. The geometry probe added here closes that assertion gap for future runs.
