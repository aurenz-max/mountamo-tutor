# Eval Report: addition-subtraction-scene — 2026-06-13

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| build_equation (build-equation) | PASS (generator + tester) | 0 (AST-1 fixed) |

Generator + component were always correct. The MathPrimitivesTester render harness was
discarding generated data for this primitive; **fixed 2026-06-13** — the
`addition-subtraction-scene` case now spreads the live `data` prop like every other
primitive, so generated content (including the support tier) renders.

## Issues

### ✅ RESOLVED 2026-06-13 — build_equation — Tester renders hardcoded mixed fixture, ignores generated data
- **Fix:** Replaced the hardcoded `testData` block in `MathPrimitivesTester.tsx:723-738` with a spread of the live `data` prop (cast to `AdditionSubtractionSceneData`) plus the standard `instanceId`/`skillId`/`subskillId`/`objectiveId` injection — mirroring every other primitive case. `onEvaluationSubmit` is intentionally omitted: the component drives `usePrimitiveEvaluation`, which submits to the evaluation context itself, so passing the callback would double-record (same convention as `ordinal-line`/`fraction-circles`/`practice-problem`). `tsc --noEmit` clean (1441 errors, below the 1444 baseline).
- **Severity:** CRITICAL
- **What's broken:** The `addition-subtraction-scene` case in `PrimitiveRenderer` builds a hardcoded `testData` (4 challenges: act-out, build-equation, solve-story, create-story) and passes that to the component, ignoring the `data` prop (the real Gemini output). Every other primitive case spreads `data`. Result: selecting any single eval mode (e.g. build_equation) and generating still renders the static 4-type mixed set. The user's screenshot ("5 birds…fly away", challenge 3 of 4) is the static `as-3` solve-story row, not generated content.
- **Evidence:** Console log shows generation is correct — `Final: 4 challenge(s) → [build-equation ×4]`, `tilePalette=exact`. The generated data simply never reaches the component.
- **Data:** `MathPrimitivesTester.tsx:723-738` returns `<AdditionSubtractionScene data={testData} />` instead of `data={{...(data as AdditionSubtractionSceneData), instanceId, ...}}`
- **Fix in:** COMPONENT (tester harness — `MathPrimitivesTester.tsx`, NOT the generator or the primitive)

### build_equation — Phase tab bar always shows all 4 phases (minor, by design)
- **Severity:** (informational, not flagged CRITICAL/HIGH)
- **What's broken:** `phaseTabs` in `AdditionSubtractionScene.tsx:644-650` always maps all 4 entries of `PHASE_TYPE_CONFIG`, so even a correct single-mode session shows 4 tabs with one highlighted. This is intentional phase-progress chrome but reinforces the "mixed mode" impression. No action required unless product wants single-mode sessions to collapse the tab bar.
