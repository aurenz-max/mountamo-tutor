# Eval Report: function-sketch — 2026-06-18

## Results

| Eval Mode         | Status        | Issues |
|-------------------|---------------|--------|
| identify-features | PASS (slow)   | 2 (latency, schema) |
| classify-shape    | PASS          | 1 (schema) |
| sketch-match      | PASS          | 1 (schema) |
| compare-functions | PASS          | 1 (schema) |

Modes are pedagogically correct — answers are derived component-side from the
curve/features, not trusted from the LLM, and no answer leaks into title or
instruction. The findings are **not correctness breaks**; they are a
**generation-latency** problem (HIGH, identify-features) and a **schema-complexity**
problem (MEDIUM, all modes) that share one root cause: Gemini is hand-supplying
both the curve AND its features, and the two disagree.

## Issues

### identify-features — retry loop inflates wall-clock latency
- **Severity:** HIGH (perf / engagement; no math break)
- **What's slow:** The mode fans out **5 parallel** sub-calls
  ([gemini-function-sketch.ts:906](../../src/components/lumina/service/math/gemini-function-sketch.ts#L906)),
  which alone would be ~1 Gemini call of wall-clock. But each instance can fire a
  **second sequential retry** when semantic validation drops it below 2 valid
  features ([:640-646](../../src/components/lumina/service/math/gemini-function-sketch.ts#L640-L646)),
  and `Promise.allSettled` gates on the **slowest** instance
  ([:962](../../src/components/lumina/service/math/gemini-function-sketch.ts#L962)).
  So whenever any instance retries — which is often — the whole batch pays ~2×
  the latency of a single call.
- **Data (observed this run):**
  ```
  [FunctionSketch] Dropping minimum — not near actual minimum: "Low Tide" at x=4.71
  [FunctionSketch] Rejecting invalid feature 2: type=minimum, x=7.89, y=1
  ```
  - Line 1 = `validateFeatureSemantics`
    ([:475](../../src/components/lumina/service/math/gemini-function-sketch.ts#L475)):
    rejects a `minimum` whose x doesn't align with a local min in the 20 **sampled**
    y-values. Sinusoidal extrema (e.g. 3π/2 ≈ 4.71) rarely land on a sample point,
    so the nearest sampled local-min can fall outside the 10%-of-xRange tolerance
    ([:499](../../src/components/lumina/service/math/gemini-function-sketch.ts#L499)).
  - Line 2 = `extractFeatures`
    ([:451](../../src/components/lumina/service/math/gemini-function-sketch.ts#L451)):
    `x=7.89, y=1` rejected (out-of-window / type mismatch).
- **Root cause:** Gemini hand-emits 20 `curveY` values **and** the feature
  coordinates independently, so the curve it "draws" doesn't faithfully match its
  own claimed extrema. The validator correctly rejects the mismatch → retry → 2×
  latency. This is the exact failure mode the **"LLM picks window, code builds
  structure"** principle exists to prevent: for deterministic-arithmetic graphs the
  LLM should not be drawing the curve by hand.

### all modes — oversized flat schema (20 curveY fields × N curves)
- **Severity:** MEDIUM (maintainability / malformed-JSON risk)
- **What's wrong:** Every mode's response schema flattens the curve into 20
  individual `curveYn` NUMBER fields, and `compare-functions` doubles that to 40
  (`curveAYn` + `curveBYn`,
  [:386-435](../../src/components/lumina/service/math/gemini-function-sketch.ts#L386-L435)).
  Plus flat per-feature fields (`featureNType/X/Y/Label`). This is well past the
  CLAUDE.md "simplify schemas, 3-4 types" guidance and forces the LLM to produce
  ~30-60 correlated numbers that must all be self-consistent — the source of the
  curve↔feature disagreement above. It also makes the schema brittle and hard to
  evolve.
- **Why it matters:** The 20-point hand-drawn curve buys nothing the function spec
  can't — code can sample any density it wants from the actual function. The flat
  field explosion is pure cost: more tokens, more chances for one bad number,
  harder JSON for the model to keep coherent.

## Recommended fix — service-side curve construction

Build a small **function-spec service** (shape of the existing number-pool /
scope-context services) so the LLM emits only the *function*, and code builds the
geometry:

1. **LLM emits a compact spec**, not a curve: family (`quadratic | cubic |
   sinusoidal | exponential | …`) + a few coefficients/transform params +
   axis window + labels/context. ~6-8 fields instead of ~30-60.
2. **Code evaluates** the function over the window to produce the curve at any
   sample density, and **derives** the true roots / extrema / intercepts
   analytically (or by fine-grained sampling). Features are computed, never
   trusted from the LLM.
3. **Validator + retry path becomes dead code** — curve and features can no longer
   disagree by construction, so the 2× latency on identify-features disappears and
   the per-mode token cost drops sharply.

This is the same "LLM picks window, code builds structure" refactor proven on
number-tracer / number-sequencer, applied to 2-D graphs. It resolves BOTH findings
(latency + schema complexity) at the source rather than tuning tolerances.

### Interim mitigation (if the refactor is deferred)
- Snap a feature's x to the nearest sampled extremum within tolerance instead of
  rejecting outright, and/or widen the extremum tolerance
  ([:499](../../src/components/lumina/service/math/gemini-function-sketch.ts#L499))
  so genuine sinusoidal/cubic extrema between sample points survive. Cuts most
  retries without the full rewrite — but leaves the brittle schema in place.
