# Math Primitive Catalog — PRD

**Status:** Phase 1 executed · 2026-04-25
**Owner:** Aurenz Max
**Scope:** The set of rendering primitives the annotated-example planner (and future math surfaces) draws from. Not per-topic content PRDs — this defines the **vocabulary**, not the **vocabulary's usage**.

---

## TL;DR

The math primitive catalog now has **5 entries** (`algebra`, `table`, `diagram`, `graph-sketch`, `case-split`) after Phase 1 consolidation removed `substitution` and `verification` — both were narrow special cases of `algebra`. The remaining gap: `graph-sketch` is too narrow to render common cases like area-between-curves. We were on a trajectory toward "one primitive per problem shape," which doesn't scale — math has thousands of shapes.

This PRD commits to a different trajectory: **a small number of broad, expressive primitives that compose**. Target end-state is **~8 primitives covering K-undergrad math**, anchored on the existence proof that `algebra` already covers ~80% of symbolic math because it's a general "from→to with operation labels" abstraction, not a per-equation-type renderer.

We adopt a **decision framework** that defaults to extending existing primitives over building new ones, and we define **build sequencing** that prioritizes growing `graph-sketch` into a real 2D canvas before any new primitive lands.

---

## Why This PRD Exists

### The trigger

The annotated-example pipeline now correctly identifies pedagogical needs the catalog can't satisfy:

- The planner asks for a graph showing `y = x²` and `y = 2x` with the bounded region shaded. `graph-sketch` only stores **one** function expression and the renderer doesn't actually draw curves — it prints KaTeX and lists labeled points.
- The planner asks for `F(2) - F(0)` rendered as bound substitution into an antiderivative. `substitution` models "fill N variables in one template" — close but not the same shape, so the LLM produces a degraded render.

The temptation is to add `area-between-curves` and `definite-evaluation` primitives. We have already done this kind of thing several times in other domains (see `science-primitives-prd.md`, `engineering-primitives-prd.md`). It scales linearly with problem types, which is to say: it doesn't scale.

### The strategic frame

Per `CLAUDE.md`: **the primitives ARE the product**. The question "how many primitives do we need to teach all of math" is not rhetorical — it's the most important architectural question on the platform. The wrong answer ("one per shape, build forever") creates a maintenance treadmill that strangles every other workstream. The right answer ("a few broad ones that compose") is what makes Lumina viable at the catalog density the adaptive engine needs.

---

## Principle: Broad Expressive Primitives Beat Narrow Shape Primitives

### Existence proof: `algebra`

`AlgebraStepContent` is just `transitions: KaTeXTransition[]` plus a final `result`. That schema covers:
- Equation solving (subtract, divide, take roots)
- Simplification and factoring
- Power-rule integration / antiderivative chains
- Derivative-by-rules
- FTC bound evaluation (`(2)² - (2)³/3 - ((0)² - (0)³/3) → 4 - 8/3 → 4/3`)
- Modular arithmetic
- Vector and matrix algebra
- Series summation steps

**Why it works:** the abstraction is "math moves forward by labeled symbolic steps." That description is true for almost all symbolic work. The renderer doesn't need to know whether the operation is "subtract 3" or "apply chain rule" — both are just `from → to + operation label`. The variation lives in the data, not the code.

### Where the catalog has drifted narrow

- **`substitution`** ~~is one-or-two algebra transitions where the operation is "substitute." Its renderer (template + variable pills + result) is marginally distinct from algebra's chain. On FTC it produces a worse render than algebra would.~~ **Removed in Phase 1.** Algebra's transition chain absorbs the use case (substitution becomes a transition with operation label "substitute u = …").
- **`verification`** ~~is algebra where the final step ends with `LHS = RHS ✓`. Same critique.~~ **Removed in Phase 1.** Verification is now expressed as a final algebra transition where the `to` shows `LHS = RHS ✓`. The solver still produces verification moves in prose (see [solver.ts](../service/annotated-example/solver.ts)) — the planner just routes them to `algebra`.
- **`graph-sketch`** is too narrow in the OPPOSITE direction: single expression, no shading, no parametric, no vectors. It can't represent "plot two curves and shade between them" — the most common visual move in calculus.

### The right shape for visual primitives

The visual analog of `algebra`'s "from→to with operation labels" is **a 2D canvas with multiple drawable elements**: curves, points, vectors, shaded regions, labeled features. One expressive canvas primitive replaces graph-sketch + a future area-between-curves + a future vector-field + a future parametric-plot + a future polar-plot. The variation lives in the data (which curves, which shading, which features), not in N specialized renderers.

---

## Current State Audit

| Primitive | Status | Verdict |
|---|---|---|
| `algebra` | Healthy. Workhorse. Now also absorbs substitution and verification use cases. | **Keep as-is.** Covers most symbolic math. |
| ~~`substitution`~~ | **REMOVED 2026-04-25.** Was a narrow special case of algebra. | Replaced by an algebra transition with operation label "substitute …". |
| ~~`verification`~~ | **REMOVED 2026-04-25.** Was a narrow special case of algebra. | Replaced by an algebra transition whose final `to` shows `LHS = RHS ✓`. |
| `table` | Healthy when the content is parallel computation. | **Keep as-is.** Sign analysis, comparison rows, truth tables. |
| `diagram` | Image generation + labels. | **Keep as-is** for now; a real geometric construction primitive is a future bet. |
| `graph-sketch` | Too narrow. Single curve, no shading. Renderer is essentially a captioned legend. | **Grow into `canvas-2d`** (see below). The big near-term unlock. |
| `case-split` | Healthy when content branches on a condition. | **Keep as-is.** Piecewise, sign analysis, induction base/step. |

Net effect: the catalog shrunk from 7 → 5. Next: `graph-sketch` grows into `canvas-2d`.

---

## Target Catalog

The end-state for K-undergrad math. **Eight primitives.** Each entry below covers schema sketch, coverage, and status.

### 1. `algebra` — symbolic from→to chain
**Status:** Have it. Extend `whenToUse` to claim FTC bound evaluation and verification.

**Schema (current, sufficient):**
```ts
{ transitions: KaTeXTransition[]; result: string }
```

**Coverage:**
- All equation/inequality solving
- Polynomial manipulation (factor, expand, complete the square)
- Calculus rules: derivative, indefinite integration, FTC bound evaluation, integration by parts/substitution as labeled steps
- Linear algebra: row reduction, determinant expansion, matrix multiplication
- Discrete: modular arithmetic, recurrences
- Verification (final transition shows the check)

**Pedagogical role:** Makes the *moves* of math visible. Operation labels teach the "why" of each step.

---

### 2. `canvas-2d` — anything plottable on a 2D plane
**Status:** New (grown from `graph-sketch`). **The next real build.**

**Schema sketch:**
```ts
{
  domain: [number, number];
  range: [number, number];
  curves: Array<{
    expression: string;        // KaTeX function or parametric description
    kind: 'function' | 'parametric' | 'polar' | 'implicit';
    color?: string;            // semantic label, not raw hex
    style?: 'solid' | 'dashed';
  }>;
  shadedRegions?: Array<{
    upper: string;             // expression for top boundary
    lower: string;             // expression for bottom boundary
    from: number;              // x-range start
    to: number;                // x-range end
    label?: string;            // e.g. "A = 4/3"
  }>;
  points?: Array<{ x: number; y: number; label: string; emphasis?: boolean }>;
  vectors?: Array<{ from: [number, number]; to: [number, number]; label?: string }>;
  features?: Array<{
    kind: 'asymptote' | 'intercept' | 'maximum' | 'minimum' | 'inflection' | 'tangent' | 'normal';
    label: string;
    value: string | { x: number; y: number };
  }>;
  caption?: string;
}
```

**Coverage:**
- Single function plotting (today's graph-sketch)
- Area between curves (calc 1)
- Riemann rectangles overlay (calc 1)
- Vector fields (calc 3, physics)
- Parametric curves (precalc, calc 2)
- Polar plots (precalc, calc 2)
- Tangent lines, secant approximations
- Inequality regions (algebra 2)
- Conic sections (precalc)

**Renderer requirements:**
- Real curve drawing (not just text). SVG path or canvas via a math library — `function-plot`, `mafs`, or hand-rolled.
- Shading between two curves over an x-interval.
- Labeled points and vectors with collision-aware label placement.
- Pan/zoom optional, not required for v1.

**Pedagogical role:** Makes the *geometry* of math visible. The single biggest gap in the current annotated-example output is "I can't see what the problem is asking about."

---

### 3. `canvas-3d` — surfaces, vectors in space, parametric 3D
**Status:** New, future. Not in the immediate roadmap.

**Schema sketch (rough):**
```ts
{
  domain: { x: [number, number]; y: [number, number]; z: [number, number] };
  surfaces?: Array<{ expression: string; opacity?: number }>;
  curves?: Array<{ parametric: { x: string; y: string; z: string }; tRange: [number, number] }>;
  vectors?: Array<{ from: [number, number, number]; to: [number, number, number]; label?: string }>;
  points?: Array<{ x: number; y: number; z: number; label: string }>;
}
```

**Coverage:** Multivariable calculus, vector calculus, 3D geometry, physics with spatial setups.

**Renderer:** Three.js or similar. Significant build. Defer until math-1/calc-3 content density justifies it.

---

### 4. `table` — structured comparison or parallel computation
**Status:** Have it. Keep.

**Coverage:**
- Sign analysis across intervals
- Truth tables
- Side-by-side method comparison
- Test point evaluation (when there are 3+ points; for 2 points, prose is fine)
- Function value tables (precalc)

**Pedagogical role:** Makes parallel/comparative reasoning visible. Don't use for two test points — that's just prose.

---

### 5. `diagram` — labeled geometric/physics figure
**Status:** Have it. Keep for now. Geometric construction (labeled-elements-with-relationships) is a longer-term consideration.

**Coverage:**
- Geometry setups (triangles, circles, polygons with labeled sides/angles)
- Physics free-body diagrams
- Probability tree diagrams (could also be its own primitive, see open questions)

**Pedagogical role:** Visual context for problems that aren't function-plots.

**Watch-out:** Generated images are slower and less editable than SVG. Long-term, a structured `geometry-2d` primitive may eat half of `diagram`'s use cases.

---

### 6. `case-split` — branching by condition
**Status:** Have it. Keep.

**Coverage:**
- Piecewise function evaluation
- Absolute value / sign analysis (`|x| > a → x > a OR x < -a`)
- Induction (base case || inductive step)
- Proof by cases

**Pedagogical role:** Makes the branching structure of an argument visible.

---

### 7. `distribution` — probability and statistics visualization
**Status:** New. Required for any real probability/stats coverage.

**Schema sketch:**
```ts
{
  kind: 'discrete' | 'continuous';
  // Discrete: bar chart of P(X = x)
  outcomes?: Array<{ value: number | string; probability: number; label?: string }>;
  // Continuous: PDF curve with optional shading
  pdfExpression?: string;       // KaTeX
  domain?: [number, number];
  shadedInterval?: { from: number; to: number; label?: string };  // for P(a ≤ X ≤ b)
  // Sample points, observed data
  samples?: number[];
  // Summary statistics
  stats?: { mean?: number; median?: number; std?: number };
  caption?: string;
}
```

**Coverage:**
- PMF / PDF visualization
- CDF curves
- Sampling histograms
- Confidence interval visualization
- Hypothesis test rejection regions
- Bayes-net node visualization (overlap with diagram)

**Pedagogical role:** Probability is the math area where "look at the picture" beats "read the formula" most decisively. Not having this primitive caps how well we can teach AP Stats / Exam P content.

---

### 8. `process-trace` — algorithm, proof, or multi-line procedure
**Status:** Possibly subsumed by `algebra`. Open question — see below.

**Possible schema:**
```ts
{
  steps: Array<{
    line: string;                    // KaTeX expression OR plain text
    justification?: string;          // "by IH" / "by transitivity"
    isAssumption?: boolean;
    isConclusion?: boolean;
  }>;
}
```

**Coverage that algebra might miss:**
- Two-column geometric proofs (statement | reason)
- Algorithm pseudocode walkthroughs
- Discrete math proofs that don't reduce to KaTeX equation chains

**Open question:** Can we cover proof-by-cases via `case-split` and proof-by-equation-chain via `algebra`, leaving `process-trace` unnecessary? Need to spec a few representative proofs to decide.

---

## Coverage Matrix — Math Domain × Primitive

Quick sanity check that the 8-primitive catalog actually covers K-undergrad math.

| Domain | Primary primitives |
|---|---|
| K-2 number sense | algebra (counting steps), table (number bonds) |
| Elementary arithmetic | algebra, table |
| Pre-algebra | algebra, canvas-2d (number line as canvas), case-split |
| Algebra 1 | algebra, canvas-2d, case-split |
| Geometry | diagram, canvas-2d, algebra |
| Algebra 2 | algebra, canvas-2d, case-split, table |
| Pre-calc | algebra, canvas-2d (parametric, polar, conics), table |
| Calc 1 | algebra, canvas-2d (curves + shaded regions for areas), table |
| Calc 2 | algebra, canvas-2d (parametric/polar), table |
| Calc 3 (multivariable) | algebra, canvas-3d, canvas-2d (level curves) |
| Linear algebra | algebra, table (matrices), canvas-2d (vector geometry) |
| Discrete math | algebra, case-split, table, process-trace? |
| Probability / stats | distribution, algebra, table |
| Differential equations | algebra, canvas-2d (slope fields), canvas-3d (phase space) |

No domain comes up empty. No domain demands a primitive outside the eight. This is the validation that 8 is enough.

---

## Decision Framework — When to Add a New Primitive

The cost of a new primitive is **not uniform**. Splitting it out clarifies the decision:

| Component | Real cost |
|---|---|
| Schema (`StepContent` union case) | ~30 lines, ~10 min |
| Planner registry entry + `whenToUse` | 1 line + one paragraph |
| Generator | Variable, but **bounded by a contract**. A 1-shot Gemini call is ~120 lines. An internal orchestrator with parallel Gemini calls + deterministic checkers is ~400. Both fit behind `(ctx) => Promise<GeneratedStep>` — invisible to every other stage. |
| Renderer (pixel work, animation, layout) | **Real cost.** |
| Eval modes + IRT calibration + eval-test + tutoring scaffold wiring | **The expensive part.** This is what makes a primitive ship-ready vs. compiles. |

So "extend vs. build" is **not** primarily a cost question — generator complexity can grow internally without leaking, and over time some sub-stages of a generator won't even be LLM calls (deterministic math evaluators, registered step checkers, planner-injected scaffolding). The decision is pedagogical: **is the student doing something genuinely new here?**

Work through this checklist:

1. **Does the student do something genuinely new — a new gesture, a new direct-manipulation surface, a new way to be evaluated?** A new shape on the same canvas, a new operation label in the same from→to chain, a new branching condition in the same case-split — that's content for an existing primitive. A new physical interaction (drag-to-shade vs. click-to-label vs. scrub-along-axis) is a new primitive. The renderer + eval modes are where the cost lives; everything else is noise next to that.

2. **Is the new pedagogical experience meaningfully different from existing primitives?** If the renderer would look "kind of like a chart but with X" or "like algebra but with Y" — the answer is usually no. Extend instead.

3. **Does at least one existing or near-future content area need this in 5+ subskills?** One-off needs don't justify a new primitive. Specialized primitives that only fire on three problems waste catalog space and confuse the planner.

4. **Is there a smaller, more general abstraction that would cover the new case AND adjacent ones?** This is the "broad over narrow" check. If you're tempted to build `area-between-curves`, ask: what about `volume-of-revolution`, `arc-length`, `surface-area`? They're all "shaded region under integration with a label" — that's the same primitive (`canvas-2d` with a shaded region and a caption that names the area).

5. **Have you tried the existing primitive and confirmed it's actually inadequate?** Run the failure mode in the planner's debug card; verify the existing primitive's renderer can't be coaxed to handle it. Sometimes the "gap" is a prompt or generator issue (one Gemini call straining), not a primitive issue. The fix may be to upgrade the generator into an internal orchestrator (parallel calls + deterministic post-processing) rather than to add a new primitive.

If 4 of 5 checks favor "new primitive," consider it. If fewer, extend or upgrade the generator.

---

## Build Sequencing

### Phase 1 — Consolidate (low cost, immediate clarity) — ✅ DONE 2026-04-25
1. ~~Update `algebra`'s `whenToUse` to claim FTC bound evaluation.~~ *(still pending — small follow-up; planner already routes correctly via fallback)*
2. ✅ Deleted `substitution` and `verification` — generators, renderers, types, and registry entries all removed. Solver prose still produces verification moves; the planner now routes them to `algebra`.
3. *(still pending)* Update `ADDING_PRIMITIVES.md` to reference this PRD's decision framework.

### Phase 2 — Grow `graph-sketch` → `canvas-2d` (the big one)
1. New schema (multi-curve, shaded regions, points, vectors, features).
2. New renderer with a real plotting library (mafs, function-plot, or custom SVG).
3. Migrate the existing `graph-sketch` registry entry to `canvas-2d` — same name OR rename, depending on call sites.
4. Update planner's `whenToUse` to claim the broader coverage (area between curves, parametric, polar).
5. Validate with: area-between-curves, Riemann rectangles, vector field, parametric heart curve, polar rose, tangent line problem.

### Phase 3 — `distribution` (probability/stats unlock)
1. Required for any serious AP Stats, Exam P, or actuarial coverage. See `project_advanced-probability-pivot.md` in memory.
2. Schema first, then renderer with discrete bar chart + continuous PDF + optional shaded interval.

### Phase 4 — Decide on `process-trace`
1. Spec 3-5 representative proofs/algorithms.
2. Try to render each with `algebra` + `case-split`. If one or more is fundamentally awkward, build `process-trace`. If all work, don't.

### Phase 5 — `canvas-3d` (longest tail)
1. Defer until calc-3 / vector calculus / multivariable content density justifies the build cost.
2. Three.js or react-three-fiber. Significant — schedule when nothing more pressing.

---

## Non-Goals

- **One primitive per problem type.** Explicitly rejected by this PRD.
- **A "diagram-of-everything" canvas with arbitrary SVG/code execution.** Rejected — too unbounded; pedagogical quality drops without a tight schema. The expressive primitives we DO build will be schema-bounded.
- **Replacing per-domain primitives** (chemistry, physics, biology). This PRD is math only. Other domains have their own catalogs and their own consolidation discussions to have.
- **Backward compatibility shims.** `substitution` and `verification` were deleted outright on 2026-04-25 — no deprecated-but-still-here primitives in the registry.

---

## Open Questions

1. ~~**Substitution renderer.** Does the variable-pill animation teach something algebra's transition chain can't?~~ **Resolved 2026-04-25: deleted.**

2. **`canvas-2d` library choice.** mafs (React, declarative, math-aware) vs. function-plot (D3-based, mature) vs. hand-rolled SVG. Trade off bundle size, customization, and rendering quality. Probably worth a 2-hour spike before committing.

3. **`process-trace` vs. extended `algebra`.** Can a transition include a `justification` field instead of just an `operation` label, blurring the line between "step in a derivation" and "line in a proof"? If yes, no new primitive needed.

4. **`diagram` future.** Generated images are slow, expensive, and brittle. A structured `geometry-2d` primitive (labeled vertices/edges/angles + auto-layout) would replace 60% of diagram's use cases with better quality. Worth scoping after `canvas-2d` ships, since they share rendering infrastructure.

5. **Planner-driven seed schemas.** Today the planner produces free-text `seedNotes`. If we structure seeds (e.g. `canvas2dSeed: { curves: [...] }`), the planner does more of the extraction work and per-type generators become thinner. Trade-off: schema bloat in the planner output. Defer until `canvas-2d` is built and we see whether free-text seeds suffice.

---

## Success Criteria

The catalog is working when:

1. The annotated-example pipeline can render any K-undergrad math problem the solver produces, with no "oh, the primitive can't show that" gaps.
2. Adding a new content domain (e.g. linear algebra) requires writing curriculum, not building primitives.
3. The planner's primitive choices match the pedagogical goal in 90%+ of cases (measurable via the planner debug card).
4. New primitive proposals get caught by the decision framework (point 1 of "Decision Framework") more often than they get built.
5. Total math primitive count stays at or under 10 through the end of 2026.
