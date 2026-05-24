# Eval Report: function-sketch — 2026-05-20

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| classify-shape | PASS | — |
| identify-features | PASS | — (FS-1 fixed 2026-05-21) |
| compare-functions | PASS | — |
| sketch-match | PASS | — |

## Notes (not flagged)

- **Sketch-match content variety:** All 4 generated challenges were linear functions (`y=2x+5`, `y=10x+20`, `y=3x+2`, `y=2x`) despite this being the Tier 4 (beta 3.5) mode. The schema permits richer functions; Gemini just picked the simplest. Falls under "difficulty tuning within a reasonable range" per the rubric — not gated. Worth a prompt nudge later.
- **Sketch-match "peak" misuse:** Same conceptual flaw as the identify-features issue (peak tagged on linear endpoint) but the component's scoring at FunctionSketch.tsx:370-389 ignores the `type` field, and the description is not shown to the student during sketching — so it does not surface in the UI.
- **Compare-functions answer skew:** 3/4 challenges have `correctCurve="A"` (the linear one). A student picking A every time would score 75% — above the 60% pass threshold. Borderline mode-bleed but not structurally broken.
- **Umbrella title staleness:** `head.title`/`head.context` from sub-result[0] is reused across all 4 challenges even when sub-generators pick unrelated topics (e.g., classify-shape title "The Basketball Toss" applied to a savings linear challenge). Known orchestrator-same-mode property; cosmetic.

## Fix Notes (2026-05-21)

- **FS-1 (identify-features fake-maximum on linear curves):** Resolved via PROMPT-CHANGE + POST-PROCESS-VALIDATE in [gemini-function-sketch.ts](../../src/components/lumina/service/math/gemini-function-sketch.ts).
  - Prompt now forbids linear/monotonic functions for this mode and lists REQUIRED function families (quadratic, sinusoidal, cubic-with-extrema, absolute-value, piecewise-with-bend). Includes explicit anti-pattern: "y-values immediately before AND after the feature's x must be smaller (max) / larger (min)".
  - New `validateFeatureSemantics()` detects strict monotonicity from `curveY0..curveY19`, locates real local extrema in the sampled series, and drops any `maximum`/`minimum` feature that doesn't match (either on a monotonic curve OR not within 10% x-range of an actual extremum).
  - Sub-generator retries once with a stronger turning-point hint if the first attempt's features fail validation.
  - Orchestrator switched from `Promise.all` to `Promise.allSettled` so one stochastic sub-call failure doesn't reject the whole batch.
  - Verified: 3/3 stochastic runs PASS; all 12 generated challenges use functions with genuine turning points; no regression in the other 3 modes.
