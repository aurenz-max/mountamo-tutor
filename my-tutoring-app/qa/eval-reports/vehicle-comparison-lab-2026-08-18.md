# Eval Report: vehicle-comparison-lab — 2026-08-18

## Results

| Eval Mode | Status | Notes |
|-----------|--------|-------|
| metric_leader | PASS | 3/3 pinned challenges; specific vehicle visuals present; answers derive from visible metrics |
| evidence_choice | PASS | 3/3 pinned challenges; vehicle-plus-evidence contract preserved |
| constraint_tradeoff | PASS | 3/3 pinned challenges; feasible-set winners recompute correctly |
| Auto (mixed) | PASS | Exactly one challenge from each of the three task identities |

## Resolved issues

### VC-1 — Specific land vehicles rendered as the same car

- Added a bounded `visualKind` data contract for airplane, helicopter, car, bus, train, truck, bicycle, motorcycle, ship, boat, submarine, spacecraft, construction, and generic visuals.
- The generator schema requires the field. Post-processing repairs recognizable names deterministically before trusting the bounded generated value; unfamiliar models use an honest category-labeled generic visual rather than a misleading sedan.
- `VehicleDiagram` now consumes the whole vehicle at every render site. Bicycle, bus, car, and train have distinct code-owned SVG identities.
- During the regression sweep, two generations returned fewer than the four vehicles the post-process requires. The vehicle array now has schema bounds `minItems: "4"` and `maxItems: "6"`; the subsequent four-mode sweep returned 4–5 vehicles in every mode without retry.

### VC-2 — Incorrect vehicle remained the route hero after correction

- Before submission, the mission route labels and displays `Your pick` from `missionVehicleId`.
- After submission, it switches to `Best fit` from `bestVehicleId`, matching the corrected answer cards and explanation while retaining the original choice in the recorded evaluation result.

## Verification

- Focused component behavior: `VehicleComparisonLab.reader-fit.test.tsx` passes 7/7. The added tests prove four distinct land-vehicle diagram identities and the wrong-pick → best-fit route correction.
- Real eval-test API sweep: all three explicit pins and `evalMode=mixed` pass. Explicit pins each contain 3/3 allowed challenge types; mixed contains `metric_leader`, `evidence_choice`, and `constraint_tradeoff` exactly once.
- G1: required vehicle/challenge fields are populated in all four runs; every vehicle has `visualKind`.
- G2: not applicable; this generator does not reconstruct flat indexed fields.
- G3: explicit modes remain distinct and mixed covers all three identities.
- G4: every `bestVehicleId` recomputes from the displayed metric values; trade-off challenges recompute after passenger/range filtering.
- G5: explicit modes required no silent challenge fallback. Mixed used the existing deliberate deterministic coverage synthesis, and every synthesized challenge passed G1/G4.
- Lumina typecheck has 2 pre-existing errors in `OrdinalLine.di-script.test.ts`, with 0 errors in the affected vehicle files. Full project-local `tsc --noEmit` remains at the broad existing baseline (805 error lines), with 0 in the affected component, generator, helper, tests, or engineering catalog.

## Preserved behavior

- Real API generation and all three eval-mode constraints remain intact.
- `metric_leader` still grades a vehicle without requiring a fabricated evidence choice.
- `evidence_choice` retains the two-part vehicle-plus-evidence interaction.
- `constraint_tradeoff` still filters by passenger and range minimums before deriving the priority winner.
- Optional generated vehicle imagery, category styling, evaluation telemetry, and tutor context are unchanged.
