# Eval Report: transport-challenge

**Date:** 2026-04-04
**Component:** `TransportChallenge.tsx`
**Generator:** `gemini-transport-challenge.ts`
**Eval Modes Tested:** single_constraint, multi_constraint, full_optimization

---

## QA Results

| Eval Mode          | API Status | Scenarios | G1  | G2  | G3  | G4  | G5  | Verdict |
|--------------------|-----------|-----------|-----|-----|-----|-----|-----|---------|
| single_constraint  | 200 OK    | 3         | PASS | PASS | PASS | PASS | PASS | PASS    |
| multi_constraint   | 200 OK    | 3         | PASS | PASS | PASS | PASS | PASS | PASS    |
| full_optimization  | 200 OK    | 3         | PASS | PASS | PASS | PASS | PASS | PASS    |

---

## G1 — Required Fields per Scenario

All 9 scenarios (3 per eval mode) contain every required field from the contract:
id, type, title, origin, destination, distanceKm (positive), peopleToTransport (positive),
constraints (>=1), vehicles (>=3 with all sub-fields), bestVehicleId, acceptableVehicleIds,
tradeOffQuestion, tradeOffOptions (exactly 4), tradeOffCorrectIndex (0-3), explanation.

**Result:** PASS -- no missing or empty fields.

## G2 — Flat-field Reconstruction Audit

The generator uses flat Gemini schema fields (vehicle0Name, constraint0Type, etc.) and
reconstructs them into proper arrays via `extractConstraints()`, `extractVehicles()`, and
`extractTradeOffOptions()`. All 9 scenarios have correctly populated arrays:
- Constraints: 1 (single), 2 (multi), 3 (full) per scenario
- Vehicles: 3 (single), 4 (multi), 4 (full) per scenario
- TradeOffOptions: 4 per scenario

0% empty-array rate.

**Result:** PASS

## G3 — Eval Mode Semantic Differentiation

| Property             | single_constraint | multi_constraint | full_optimization |
|----------------------|-------------------|------------------|-------------------|
| Constraints/scenario | 1                 | 2                | 3                 |
| Vehicles/scenario    | 3                 | 4                | 4                 |
| Trade-off complexity | Clear winner      | Multiple viable  | No perfect answer |

Eval modes are clearly differentiated in constraint count, vehicle count, and scenario complexity.

**Result:** PASS

## G4 — Answer Derivability

For all 9 scenarios:
- `bestVehicleId` references an existing vehicle in that scenario's `vehicles` array
- `acceptableVehicleIds` are all valid subsets of vehicle IDs
- `tradeOffCorrectIndex` is 0-3 and the corresponding `tradeOffOptions` entry exists

Note: `bestVehicleId` is server-recomputed using the same math as the component
(`recomputeBestVehicle()`), so Gemini hallucination of the "best" vehicle is not possible.

**Result:** PASS

## G5 — Fallback Quality Audit

Fallback expressions found in generator:
1. **Emoji fallback** (L131): `VALID_EMOJIS[i % length]` if Gemini returns invalid emoji -- cosmetic, safe
2. **Color fallback** (L138): `VALID_COLORS[i % length]` if Gemini returns invalid color -- cosmetic, safe
3. **Full scenario fallback** (L804): Hardcoded `FALLBACKS[type]` if zero scenarios pass validation -- not triggered in any run
4. **tradeOffCorrectIndex clamping** (L312): `Math.max(0, Math.min(3, ...))` -- safety net, not triggered

No fallback fired for >0% of scenarios in this run.

**Result:** PASS

---

## Notes

- The eval-test validation framework reports "No challenge array found" because it checks
  for keys named `challenges`, `words`, `instances`, etc. but this primitive uses `scenarios`.
  This is a validation framework limitation, not a generator bug. The API still returns
  status "pass" and all data is structurally correct.
- Generator architecture is strong: flat Gemini schema avoids nested-object hallucination,
  server-side recomputation of `bestVehicleId` and `acceptableVehicleIds` prevents answer
  desync, and per-type sub-generators with separate schemas ensure eval mode differentiation.

## Verdict

**ALL PASS** -- No fixes needed. Generator produces valid, differentiated, pedagogically
sound data across all three eval modes.
