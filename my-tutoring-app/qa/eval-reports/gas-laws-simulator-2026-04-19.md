# Eval Report: gas-laws-simulator — 2026-04-19

## Results
| Eval Mode | Status | Issues |
|-----------|--------|--------|
| observe   | PASS   | None (all 3 challenges physics-correct) |
| predict   | PASS   | None (all 3 challenges within tolerance of PV=nRT) |
| calculate | PASS (after fix) | Fixed G4 prompt issue — see below |

## QA Results — gas-laws-simulator
| Eval Mode | API | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-----------|-----|------------|----|----|----|----|----|---------|
| observe   | 200 | 3          | OK | OK | OK | OK | OK | PASS    |
| predict   | 200 | 3          | OK | OK | OK | OK | OK | PASS    |
| calculate | 200 | 3          | OK | OK | OK | OK (post-fix) | OK | PASS    |

## G1-G5 Sync Check

### G1 — Required Fields
All challenges across all 3 modes have every contract field present and valid: `id`, `type`, `instruction`, `hint`, `narration`, `askFor`, `change: { variable, newValue }`, `askedVariable`, `directionAnswer`, `targetAnswer`, `tolerance`. Observe sets targetAnswer=0, tolerance=0 as required; predict/calculate set directionAnswer=null. PASS.

### G2 — Flat-Field Reconstruction
Generator schema uses flat `changeVariable`/`changeNewValue` and rebuilds nested `change: { variable, newValue }` at line 739-742. Every returned challenge has a proper nested `change` object. No flat leakage. PASS.

### G3 — Eval Mode Semantic Differentiation
- observe → all 3 challenges are `observe` (direction-based, targetAnswer=0)
- predict → all 3 challenges are `predict` (numeric, tolerance>0)
- calculate → all 3 challenges are `calculate` (numeric, tolerance>0)

No cross-type leakage. PASS.

### G4 — Physics Correctness
Verified each challenge's target against PV=nRT with R=0.0821:

**Observe** (boyle, P=2, V=10, T=300, n=1, locked=T,n):
- ch1 V=5 → P=4.93 (increase) matches `increase` ✓
- ch2 V=20 → P=1.23 (decrease) matches `decrease` ✓
- ch3 P=4, asked=V → V=6.16 (decrease from 10) matches `decrease` ✓

**Predict** (boyle, P=2, V=5, T=300, n=0.4, locked=T,n; nRT=9.852):
- ch1 V=2 → P=4.93, target=5, tol=0.25, drift=0.074 ✓
- ch2 V=10 → P=0.985, target=1, tol=0.05, drift=0.015 ✓
- ch3 V=4 → P=2.46, target=2.5, tol=0.12, drift=0.037 ✓

**Calculate** (combined, P=2, V=5, T=300, n=0.4068, locked=n; nRT=10.02):
- ch1 V=8 → P=1.252, target=1.25, tol=0.06 ✓
- ch2 T=450 → P=3.006, target=3, tol=0.15 ✓
- ch3 V=2.5 → P=4.008, target=4, tol=0.2 ✓

### G5 — Fallback Quality
Reviewed all `??`, `||`, ternary defaults:
- `raw.title || 'Gas Laws Lab'`, `raw.description || '...'`, `raw.gradeBand || gradeBand` — fire only when Gemini omits. Not observed in practice.
- `narrationFinal` fallback — fires only when narration missing. Not observed.
- `tolerance <= 0 ? 5% target : toleranceRaw` — fires if Gemini returns 0 tolerance. Not observed.
- `fallbackFocus` — fires only on invalid focus. Not observed.

No silent fallback fires for >30% of challenges. PASS.

## Fix Applied
**Issue (calculate mode, G4-adjacent):** Initial calculate response contained instructions that described multi-variable changes (e.g. "volume expands to 8.0 L AND temperature rises to 400 K"), but the single-perturbation `change` field only carried one variable. `targetAnswer` was computed against the single perturbation, meaning a student solving per the written instruction would get a different answer than the target. Fix belonged in GENERATOR.

**Root cause:** The `calculate` prompt doc explicitly permitted "ALL of P, V, T can change between initial and final state," while the component's `applyChange` and the generator's `solveExpectedState` both implement single-perturbation semantics (one `change.variable`).

**Fix:** Tightened `CHALLENGE_TYPE_DOCS.calculate.promptDoc` and added a new SINGLE-PERTURBATION RULE (#7) in the main CHALLENGE REQUIREMENTS prompt, forcing Gemini to describe only one variable change per challenge and use initial values for all non-asked, non-changed variables in the computation.

**Post-fix verification:** Re-ran all 3 modes. Calculate now returns single-perturbation challenges with instructions that match the `change` field and targets that match PV=nRT. All three modes PASS G1-G5.
