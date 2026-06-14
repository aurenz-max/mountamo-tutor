# Eval-Mode Pin Health — manifest miss-rate study (2026-06-13)

**Question:** Does the manifest reliably set a valid `config.targetEvalMode` for multi-mode
primitives, or does it omit/hallucinate often enough to justify giving all ~100 generators a
per-service recovery micro-call (`resolveEvalModes`)?

**Method:** 10 `manifestOnly` topic-traces (fast, ~5-10s each, no generators). The trace route
was instrumented to surface, per component, the curator's `targetEvalMode` and validate it
against the primitive's catalog `evalModes` (`targetEvalModeValid`: null = <2 modes / N/A,
true = multi-mode & validly pinned, false = multi-mode but absent/invalid = MISS).
Metric counts **multi-mode components only** (evalModeCount ≥ 2).

## Result

| Topic | Valid / multi-mode |
|---|---|
| Counting to 20 (K) | 5/6 — 1 MISS |
| Making ten (K) | 7/7 |
| Addition within 10 (G1) | 8/8 |
| Subtraction within 20 (G1) | 7/7 |
| Skip counting 2s/5s (G2) | 7/7 |
| Place value to 100 (G2) | 4/4 |
| Comparing two-digit (G1) | 5/5 |
| Multiplication equal groups (G3) | 5/5 |
| Fractions on number line (G3) | 5/5 |
| Short vowel CVC (K) | 7/7 |

**Totals: 60/61 valid = 98.4%. Miss rate 1.6% (1 component).**

Single miss: `deep-dive`, pin absent, on objective "Identify and name numbers 11–20".
deep-dive's modes are a Bloom/β ladder (explore→recall→apply→analyze, β −1.5→+0.5) — the
deterministic-index case, not a distinct-skill case.

## Implications

1. **The per-service recovery micro-call is a tail event, not a per-lesson cost.** It
   short-circuits whenever the manifest pins a valid mode (98.4%). The "8-12 micro-calls per
   lesson" premise is empirically false — it fires ~0× on a typical lesson.
2. **Do NOT migrate ~100 generators to `resolveEvalModes`.** It spreads recovery across 100
   services to handle ~1.6% of components, on the within-component *blend* path the manifest
   flow doesn't want (one component = one skill).
3. **Do build a centralized post-manifest repair pass (1 file).** Validate `targetEvalMode`
   against the catalog per component (componentId known → enum expressible in code); if
   absent/invalid, resolve deterministically by indexing the objective's β/grade into the mode
   ladder (covers ladder-type primitives like deep-dive, zero LLM), with a scoped micro-call
   fallback for distinct-skill primitives (which are already ~100% pinned, so it rarely fires).
   Generators stay unchanged and keep short-circuiting on the guaranteed-valid pin; legacy
   `resolveEvalModeConstraint` is then sufficient downstream and the dual-resolver split is moot.

## Caveat — validity ≠ optimality

This measures whether the pin is a *real* mode (98.4%), not whether it's the *best* mode. At
least one valid-but-questionable pick was seen (ten-frame `subitize` on a "number pairs to ten"
objective, arguably `make_ten`). A repair pass fixes absent/invalid pins only — not
valid-but-suboptimal ones. Pick *quality* is a separate axis (manifest-prompt tuning or the
deterministic β-index removing LLM discretion); needs a follow-up trace that scores optimality.

## Note

The trace route (`src/app/api/lumina/topic-trace/route.ts`) gained additive eval-mode
instrumentation in the `manifestOnly` `componentConfigs` (targetEvalMode / evalModeCount /
targetEvalModeValid). Useful permanently for pin-health checks; revert if undesired.
