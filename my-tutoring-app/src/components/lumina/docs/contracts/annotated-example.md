# Contract: annotated-example

- **Derived:** 2026-08-04 · evidence window: Grade-1 reader-fit census (2026-08-01), eval report (2026-04-24), service pipeline, catalog, and both orchestrator consumers
- **Component:** `primitives/AnnotatedExample.tsx` · **Generator:** `service/annotated-example/gemini-annotated-example.ts` · **Problem author:** `service/annotated-example/orchestrator.ts` · **Catalog:** `service/manifest/catalog/core.ts`
- **Status:** COMPATIBLE WITH A CONSTRAINT-PRESENCE FORK (reader-fit 14j)

This contract was derived before editing the 14j problem-authoring boundary. The
`primitive-contract` skill is unavailable in this session, so the contract-first
gate was performed directly from source and saved QA evidence.

## Consumers (blast radius)

| Consumer | Evidence | Required behavior |
|---|---|---|
| Manifest-routed `annotated-example` | `registry/generators/coreGenerators.ts` | A specific intent may pin the exact worked scenario; canonical objective grade is available as `ctx.grade`. |
| Grade-1 `MEAS001-07-c` coin census | `qa/topic-traces/g1-identical-coins-2026-08-01.md` | Preserve six nickels, 30 cents, and skip-counting/repeated-addition identity; generator-introduced multiplication is out of scope. |
| Grade-1 `NBT001-01-a` counting control | `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md` | Preserve the exact `108, 109, ?, 111` example. |
| Generic annotated examples | catalog + `qa/eval-reports/annotated-example-2026-04-24.md` | When no concrete scenario is supplied, the orchestrator may author a representative problem. |
| Upper-grade algebra/calculus | `qa/eval-reports/annotated-example-2026-04-24.md` | Multiplication, algebra, graphing, case splits, and calculus remain legal when the objective requires them. |
| `practice-problem` sibling | `service/math/gemini-practice-problem.ts` | Existing generic `context` steering and orchestrator output remain source-compatible unless structured constraints are deliberately supplied. |
| Advanced inset authoring | `service/annotated-example/inset-helpers.ts` | Inset selection and per-type payload authoring remain unchanged and coherent with the accepted problem statement. |

## Requirements

### R1 — Constraint-presence fork · REQUIRED

When manifest steering names concrete values, entities, units, or an exact
problem, those anchors are binding through problem authoring and hydration. When
it does not, legacy representative-problem variation remains available. Strict
binding must not globally freeze all examples to the broad topic string.

### R2 — Canonical grade policy · REQUIRED

Operation policy reads canonical objective grade (`ctx.grade`) only. It must not
infer Grade 1 from arbitrary `gradeContext` prose. For a Grade-1 intent that
explicitly requests skip counting or repeated addition, multiplication introduced
as a replacement task is rejected. An explicit multiplication objective remains
legal, including when a synthetic caller labels it Grade 1; Grade 1 alone is not a
universal multiplication-token ban.

### R3 — Bounded authoring recovery · REQUIRED

The authored `problemStatement` is validated before inset/solution hydration. A
rejected first plan gets at most one repair attempt carrying structured violation
codes. A second rejection falls back to the supplied exact intent/problem rather
than widening the scenario. Diagnostics may log grade, binding mode, attempt, and
violation codes, but not student identity or misconception prose.

### R4 — Pinned problem is the downstream source · OBSERVED + REQUIRED

The accepted authored statement is passed once as `pinnedProblem`. The solver must
echo it byte-faithfully and solve it; planner and step generators render the one
solver result rather than authoring a sibling problem. Final serialized data must
retain the accepted statement and operation identity.

### R5 — Exact controls · REQUIRED

The coin case retains six/nickels/30 cents and excludes dimes/200 cents/array or
multiplication replacement. The counting control retains 108, 109, and 111. These
are test fixtures for the generic contract machinery, not hard-coded production
sentences or denomination-specific branches.

### R6 — Generic and advanced controls · OBSERVED

Generic Grade-1 authoring without concrete constraints stays creative. Explicit
multiplication, upper-grade algebra, and calculus remain legal. Existing inset
selection and equation-setup behavior remain untouched.

### R7 — Final-payload oracle · REQUIRED

The oracle inspects the serialized problem, solver echo/body, and complete step
chain. It checks concrete scope anchors and detects a forbidden operation family
independently of the prompt. Seeded recorded-case mutations must prove the oracle
is non-vacuous.

## Edit zones

- **Owned by 14j:** structured authoring contract, pre-hydration validation,
  bounded repair/fallback, canonical-grade threading, pinned-operation guidance,
  final-payload scope/operation oracle.
- **Preserve:** UI, challenge interaction, inset type registry/renderers, solver
  code execution, planner topology, April AE-1–AE-4 redundant-step campaign.

## Compatibility decision

The requested behavior is **COMPATIBLE** when implemented as a
constraint-presence fork. Strict validation applies only to explicit structured
constraints; generic and sibling callers keep the legacy path. No primitive
variant or eval-mode split is required.

## Changelog

- 2026-08-04 — initial derivation for reader-fit 14j.
