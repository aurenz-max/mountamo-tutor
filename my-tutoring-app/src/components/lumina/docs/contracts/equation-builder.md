# Contract: equation-builder

- **Derived:** 2026-09-29 (static, as the contract-first step of handoff 28 row 5, RP-4) · evidence window: catalog, generator,
  workspace, oracle, w1 payloads, tests to 2026-09-29. No census run.
- **Component:** `primitives/visual-primitives/math/EquationBuilder.tsx` + `equationBuilderWorkspace.ts` · **Generator:**
  `service/math/gemini-equation-builder.ts` · **Oracle:** `service/qa/oracles/equation-builder.ts` · **Catalog:**
  `service/manifest/catalog/math.ts` (`equation-builder`)
- **Status:** ACTIVE (no open conflicts)

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 equation understanding: build-simple, missing-result, true-false, missing-operand, balance-both-sides, rewrite | catalog evalModes | `math.ts` entry | live |
| Shared teaching workspace (one checked gesture per challenge) | code + sweep | `equationBuilderWorkspace.ts`, `EquationBuilder.workspace.test.tsx`, w1 payloads | 2026-09-29 |

## Requirements

### R1 — every key is computed by code, never taken from the model · OBSERVED
- **Property:** true-false `isTrue` is computed from `displayEquation`; build and rewrite targets are rejected unless true; every
  rewrite accepted form is true; missing-value and balance answers are solved in code. Equation strings are normalized to an
  ASCII `-` at ingest, so a Unicode minus or en dash cannot mis-key a statement or reject a true target.
- **Demanded by:** all modes (rule #1).
- **Evidence:** `validateTrueFalse` ("never trust Gemini"), `validateBuild`, `validateRewrite`; `gemini-equation-builder.minus.test.ts`.
- **Probe:** `npm test -- gemini-equation-builder.minus`; eval-test each mode, recompute every key.

### R2 — the palette holds every needed tile · OBSERVED
- **Property:** build/rewrite tiles are derived from the target/accepted forms (EB-2), then distractors are added by tier.
- **Demanded by:** build-simple, rewrite.
- **Evidence:** `validateBuild` / `validateRewrite` tile derivation; oracle.
- **Probe:** every target token is in `availableTiles`.

### R3 — the builder's check accepts every correct form and only those · OBSERVED
- **Property:** build accepts the target or the same tiles in another true order ("5 = 2 + 3"); rewrite accepts only its
  accepted forms; a row with `−` is judged by value like `-`.
- **Demanded by:** build-simple, rewrite.
- **Evidence:** `buildMatches`, `matchesAcceptedForm`; `equationBuilderWorkspace.test.ts`.
- **Probe:** `npm test -- equationBuilderWorkspace`.

### R4 — no key reaches the tutor · OBSERVED
- **Property:** every challenge is a gesture checked by the builder; the assignment publishes no expected answer.
- **Demanded by:** workspace consumer.
- **Evidence:** `equationBuilderAssignment`; `EquationBuilder.workspace.test.tsx`.
- **Probe:** `npm test -- EquationBuilder.workspace`.

## Conflicts

None.

## Changelog

- 2026-09-29 — derived (static, initial) for handoff 28 row 5. 4 requirements, 0 conflicts. Same day, RP-4: ingest normalizes
  the minus sign (R1) and the checker judges a `−` row by value (R3). `--check` **COMPATIBLE**: equation-builder vitest 36/36,
  eval-test all six modes at G1 (30 challenges, every key recomputes, no Unicode minus left), journey sweep green.
