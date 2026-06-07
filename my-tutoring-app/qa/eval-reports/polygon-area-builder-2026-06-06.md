# Eval Report: polygon-area-builder — 2026-06-06

Focused investigation: **"Auto (mixed)" produces a single challenge type, not a variety.** User report confirmed — **RESOLVED 2026-06-06** (see Fix Notes).

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| decompose | PASS | — |
| find_area_triangle_parallelogram | PASS | — |
| find_area_trapezoid | PASS | — |
| composite_area | PASS | — |
| coordinate_polygon | PASS | — |
| **Auto (mixed)** | **PASS** | — (PAB-1 fixed) |

Individual IRT-pinned modes all generate correctly (live sample: `find_area_triangle_parallelogram` → 4 challenges, valid type, 1 parallelogram + 3 triangles — intra-mode figure variety works). The previously-failing unconstrained "Auto" path now interleaves all five tiers (see Fix Notes).

## Issues

### Auto (mixed) — Session is single-tier by construction; "mixed" never happens

- **Severity:** HIGH
- **What's broken:** When no eval mode is selected ("Auto (mixed)" in the tester / no `targetEvalMode` from the manifest), the generator still produces a session where **all 3–6 figures are the same challenge type**. There is no code path that interleaves the five tiers. The "mixed" label is never satisfied.
- **Why (verified from code, not a single unlucky sample):**
  1. `selectedEvalMode === null` → tester sends **no** `targetEvalMode` ([MathPrimitivesTester.tsx:1354](../../src/components/lumina/components/MathPrimitivesTester.tsx#L1354)).
  2. `resolveEvalModeConstraint('polygon-area-builder', undefined, …)` → returns `null` (no constraint) because `resolveEvalMode` short-circuits on a falsy `targetEvalMode` ([evalMode/index.ts:55](../../src/components/lumina/service/evalMode/index.ts#L55)).
  3. Schema `challengeType` is a **single root-level STRING enum**, so Gemini picks **exactly one** tier ([gemini-polygon-area-builder.ts:383-393](../../src/components/lumina/service/math/gemini-polygon-area-builder.ts#L383-L393)).
  4. `selectPolygonAreaChallenges(challengeType)` takes **one** `PolygonAreaChallengeType` and builds **every** challenge from it ([gemini-polygon-area-builder.ts:268](../../src/components/lumina/service/math/gemini-polygon-area-builder.ts#L268)).
- **Data:** Live `find_area_triangle_parallelogram` run → `typesFound: ["find_area_triangle_parallelogram"]` (×4). Auto mode behaves identically once Gemini fixes on a tier.
- **Note — component is NOT the blocker:** `PolygonAreaBuilder` renders each challenge by its own `currentChallenge.figureType` (canvas, input mode, hints all switch per-challenge — [PolygonAreaBuilder.tsx:155, :267-268](../../src/components/lumina/primitives/visual-primitives/math/PolygonAreaBuilder.tsx#L155)). A mixed-type `challenges[]` array would render correctly today. The limitation is entirely in the generator's selection logic.
- **Fix in:** GENERATOR (selection logic) — **pending product decision** (see below).

## Fix Notes (applied 2026-06-06)

Product decision **DEC-PAB-1** resolved by user: Auto should **mix all five tiers**, scale difficulty **low→high**, and run **more than 4 problems**. Session length set to **8** (all 5 tiers once + 3 repeats of easier tiers).

**Generator-only fix** in `service/math/gemini-polygon-area-builder.ts` (SP-21 round-robin, same shape as SP-18):
- Added `TIER_ORDER` (decompose → triangle/parallelogram → trapezoid → composite → coordinate) + `TIER_RANK`, and `MIXED_INSTANCE_COUNT = 8`.
- Added `buildForType(type)` dispatch wrapping the existing per-type builders (variant tiers pick triangle/parallelogram or rectangle/right-triangle at random — no new figure code).
- Added `selectMixedPolygonAreaChallenges(count)`: round-robins a shuffled permutation of all five tiers (so every tier appears), dedups within session, then sorts by `(TIER_RANK, expectedArea)` → strict low→high difficulty ramp.
- In `generatePolygonAreaBuilder`, `evalConstraint === null` (the unconstrained Auto path) now calls the mixed builder; top-level `challengeType` is set to `decompose` (representative metadata only — the component renders per-challenge `currentChallenge.type`) and `gradeBand` to `'7'` (session reaches the G7 tier).
- IRT-pinned modes pass a non-null constraint → existing single-type path is **untouched**.

**Verified live (2026-06-06):**
- Auto path → 8 challenges, all 5 tiers present, ordered `decompose, decompose, find_area_triangle_parallelogram, find_area_trapezoid, find_area_trapezoid, composite_area, coordinate_polygon, coordinate_polygon`; areas scale within each tier; gradeBand `7`.
- All 5 IRT-pinned modes still PASS, single-type, count=4 — no regression.
- `tsc --noEmit`: zero errors in the touched files; global count 1441 (at baseline).

## Verification summary

- ✅ Individual generators: correct, varied, areas recompute exactly (carried from 2026-05-28 G1–G5 pass).
- ✅ User report confirmed: Auto = one type per session, **by architecture**, not chance.
- ✅ Root cause isolated to generator selection; component already supports mixed sessions.

Generator: `service/math/gemini-polygon-area-builder.ts` · Component: `primitives/visual-primitives/math/PolygonAreaBuilder.tsx`
