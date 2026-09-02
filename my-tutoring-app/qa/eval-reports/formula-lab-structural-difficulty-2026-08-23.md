# Formula Lab — Structural Difficulty — 2026-08-23

## Verdict

**PASS, with formula shape intentionally guidance-only.** All 15 live mode/tier probes returned five correctly typed challenges with the requested support tier. Code enforces only `predict-magnitude` response subtlety inside the formula's existing variable ranges. It never replaces a curriculum-valid formula merely to satisfy a tier target.

## Final design

- `resolveProblemShape(mode, tier)` is the single source of truth for formula-shape guidance and the code-owned `predict-magnitude` relative-change bands.
- The tier prompt merges structural guidance with the existing support guidance.
- Formula variable/operator targets are advisory and observable. A mismatch is logged while the generated canonical relationship is preserved.
- `predict-magnitude` selects from the already evaluated, in-range candidate pool:
  - easy: relative output change `>= 0.45`
  - medium: `0.20–0.45`
  - hard: `0.05–0.20`
- When a discrete grid has no candidate in the requested band, selection saturates to the nearest available candidate. It does not expand slider ranges or inflate values.
- The no-tier path retains the original candidate-selection order and emits no tier metadata.

## Topic-fidelity correction

An intermediate implementation rejected formula-shape mismatches and substituted tier-specific local formulas. That was removed because it could replace the assigned learning relationship to make the difficulty ladder look cleaner.

Focused live probes confirmed the corrected behavior:

- easy kinetic energy preserved `0.5 * m * v^2` despite exceeding the easy shape guidance;
- hard Newton's second law preserved the honest two-input `F / m` relationship despite not reaching the three-input hard guidance;
- no-tier kinetic energy preserved `0.5 * m * v ^ 2` and emitted zero `supportTier` fields.

## Live tier sweep

Endpoint: `/api/lumina/eval-test?componentId=formula-lab&evalMode=<mode>&difficulty=<tier>&gradeLevel=grade%208&topic=formula%20relationships`

- 5 modes × 3 tiers: **15/15 PASS**.
- Every response: 5/5 challenges matched the pinned eval mode and 5/5 carried the requested tier.
- Formula-shape guidance remained advisory: sampled hard sessions legitimately retained two-input formulas.
- Sample `predict-magnitude` relative-change results:
  - easy: `0.625–8.518`
  - medium: `0.333–0.429` (inside target band)
  - hard: `0.300–0.902` (honest saturation; the chosen nonlinear formula/grid had no `0.05–0.20` candidate for every rotated variable)

## Verification

- Structural/support tests: **11/11 passed**.
- Offline structural selector stress: **5,000 randomized pools**, exact-band or nearest-saturation invariant held.
- Lumina typecheck: **0 errors**.
- Project-local `tsc --noEmit`: baseline **802 errors**, final **802 errors**; **0 Formula Lab errors**.
