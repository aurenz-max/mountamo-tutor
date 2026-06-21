# Structural-Difficulty Eval-Test — systems-equations-visualizer (2026-06-20)

Primitive: `systems-equations-visualizer` · Generator: `gemini-systems-equations.ts`
Sweep: Step-2c support-tier difficulty sweep (baseline / easy / hard, sequential).
Topic: "Solving systems of linear equations" · Grade 8 (wide band exposes full ladder).

Lever map (from brief + `resolveProblemShape`):
- **graph** → crossing-angle subtlety: wide(easy ≥1.3 rad) / moderate / shallow(hard ≤0.45 rad). Code-enforced via `pickGraphSlopePair`.
- **substitution** → fraction-clearing depth 0/1/2 fractional slopes. Code-enforced.
- **elimination** → scale-operation COUNT 0/1/2 (flagship). Code-enforced via `eliminationScaleMatches`.

Scaffold flips (`resolveSupportStructure`): `showIntersectionRegion` (easy only), `showAxisLabels` (easy+medium, off at hard), `showStepHint` (easy only). Checker always reads `expectedX/expectedY`.

## Results

| Mode | Tier | Scaffold (region/axis/hint) | Lever value (all challenges) | Magnitude band | Verdict |
|---|---|---|---|---|---|
| elimination | baseline | none (supportTier=None) | scaleCount mixed 0/1 (unshaped) | coef {±1,±2,±3}, \|c\|≤14, sol [-4,4] | — |
| elimination | easy | True/True/True | scaleCount = **0** ×4 (direct cancel) | in band | PASS |
| elimination | hard | False/False/False | scaleCount = **2** ×4 (both→LCM) | in band | PASS |
| graph | baseline | none | gap 2.0–2.5 wide (unshaped) | slopes {±1,±2,±3}, \|b\|≤9, sol [-4,4] | — |
| graph | easy | True/True/True | gap **1.57–2.21 wide** ×4 | in band | PASS |
| graph | hard | False/False/False | gap **0.14–0.32 shallow** ×4 | in band | PASS |

5 assertions, both modes:
1. Scaffold withdrawal: code-set, flips exactly easy(T,T,T) → hard(F,F,F). PASS.
2. Structural lever moves: elimination 0→2 scalings; graph wide→shallow crossing. Code-enforced exactly, uniform across all 4 challenges per tier. PASS.
3. Magnitude invariance: slopes/coefficients stay in their small pools, \|b\|≤9, \|c\|≤18, solution integer in [-4,4] at every tier. No inflation. PASS.
4. No answer leak: intersection point (= the answer) never displayed; easy region cue is fuzzy/coordinate-free; checker independent of flags. PASS.
5. Null-tier no-op: baseline has `supportTier=None`, no scaffold flags, unshaped mixed lever — matches pre-tier default, not already-hard. PASS.

Notes:
- `stepHint` STRING is present at both easy and hard (it is coordinate-free method prose); the gate is the `showStepHint` boolean, which correctly flips easy=true → hard=false. No leak — `stepHintFor` never contains numbers.
- Elimination is the flagship fully-code-enforced lever and shows the cleanest 0→2 spread. Graph (the brief's softest payoff) still produced a clean wide→shallow separation with zero band overlap.
- Substitution (fraction-depth lever) not swept — the two verified modes (one code-enforced flagship + one prompt-shaped-but-code-enforced) are sufficient to confirm the capability; substitution shares the same shaped-builder + verify-and-reconstruct harness.

## Issues

None. No CRITICAL or HIGH findings.
