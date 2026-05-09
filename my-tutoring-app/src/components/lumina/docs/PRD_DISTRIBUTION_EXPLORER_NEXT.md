# Distribution Explorer — Wave 2 → Wave 4 PRD

## 0. Where we are (Wave 1, shipped 2026-05-06)

The MVP works end-to-end. A single-stage Gemini orchestrator picks a family + initial parameters + lesson framing + 2-4 phase challenges; the math engine in `lumina/lib/probability/` evaluates the chosen family client-side; the workbench renders PMF/PDF + CDF, live moments, and a sequentially-gated challenge strip. Visual fidelity is at production quality (screenshot 2026-05-06: Binomial(n=10, p=0.69) with µ=6.9, σ²=2.139, skew=−0.260, excess kurtosis=−0.132 rendering cleanly with KaTeX formula and PDF/CDF toggle).

**Shipped components:**
- Math engine: Binomial, Poisson, Exponential — pure TS, Lanczos lnGamma, accurate to floating-point precision for the parameter ranges the workbench exposes.
- Workbench: family selector, parameter sliders, moment readout, recharts-based PDF/PMF + CDF viewer, KaTeX formula panel, challenge strip with 4 challenge types (`guided_exploration`, `identify`, `compute`, `predict_shape`).
- Orchestrator: single Gemini-Flash-Lite call, flat schema with discriminator + per-type coercion (mirrors AnnotatedExample's inset-bag pattern).
- Tester: eval-mode picker, family pin, JSON inspector, manifest panel, lesson rendering — wired through IdleScreen.

**Eval modes implemented:** `explore` (β=1.0), `identify` (β=3.0), `compute_basic` (β=4.5), `compute_advanced` (β=6.5).

**Not yet implemented:** `relationships` (β=7.0), `exam_practice` (β=8.5), distribution morphing, overlays, shaded regions, function lenses beyond PDF/CDF, AI tutoring scaffold, IRT registration, catalog entry, multi-stage orchestrator, cross-primitive engine reuse.

This PRD sequences the work from MVP to production-ready Wave-1 keystone.

---

## 1. Strategic priorities

The MVP proves the architectural bet: **a single workbench + math engine can teach 30+ distributions if we add primitives, not new components.** Three forces drive Wave 2 → Wave 4:

1. **Pedagogy depth** — the MVP teaches *individual* distributions but not the *web* of relationships between them. Distribution morphing (Binomial → Poisson, Poisson + Exponential → Gamma) is what makes this primitive irreplaceable for Exam P prep. Without it, this is a polished worksheet.

2. **Reusable engine** — the next four primitives in the PRD (`clt-demonstrator`, `joint-distribution-lab`, `loss-model-lab`, `monte-carlo-engine`) all need PDF/PMF/CDF/sampling/moments for the same families. Every additional family we add to `lib/probability/` is a multiplier; every family we hardcode into one primitive is a tax we'll pay forever.

3. **Production integration** — the workbench is invisible to the curriculum + IRT system right now. Wave 4 wires it into the catalog, registers eval modes in `problem_type_registry.py`, adds a tutoring scaffold, and connects evaluation submissions. Without this, the primitive exists but the adaptive engine can't route students to it.

**Sequencing principle:** ship pedagogy depth (Wave 2) before sophistication (Wave 3) before integration (Wave 4). A workbench with 8 families and overlays will teach more than a workbench with 3 families and morphing animations. A workbench wired into IRT but missing core families won't get traction with students.

---

## 2. Wave 2 — Depth (target: 1 week)

Goal: take the MVP from "looks great" to "covers the 18%-25% univariate-distribution slice of Exam P."

### 2.1. Expand the family registry

Add to `lib/probability/families.ts`:

| Family | Kind | Parameters | Why it matters |
|--------|------|-----------|----------------|
| **Bernoulli** | discrete | p ∈ [0.01, 0.99] | Foundation for Binomial; teaches indicator random variables. |
| **Geometric** | discrete | p ∈ [0.01, 0.99] | First success in Bernoulli trials. Memoryless cousin of Exponential. |
| **Negative Binomial** | discrete | r ∈ [1, 20], p ∈ [0.01, 0.99] | Aggregate claim count when frequency is overdispersed. STAM staple. |
| **Discrete Uniform** | discrete | a ∈ ℤ, b ∈ ℤ, a < b | Baseline for fair-die / no-info problems. |
| **Hypergeometric** | discrete | N, K, n | Sampling without replacement. Tested in combinatorics-heavy problems. |
| **Continuous Uniform** | continuous | a ∈ ℝ, b ∈ ℝ, a < b | Baseline for inverse-CDF teaching. |
| **Normal** | continuous | µ ∈ ℝ, σ > 0 | The single most-tested distribution. CLT pivot. |
| **Gamma** | continuous | α > 0, β > 0 | Sums of exponentials. Bridges Poisson process to waiting times. |
| **Lognormal** | continuous | µ ∈ ℝ, σ > 0 | Severity distribution in actuarial loss models. |
| **Beta** | continuous | α > 0, β > 0 | Bayesian prior for Binomial p. Conjugate-pair gateway. |
| **Weibull** | continuous | k > 0, λ > 0 | Survival analysis; reliability engineering. |
| **Pareto** | continuous | α > 0, x_min > 0 | Heavy-tailed loss distribution. Tail-risk introduction. |
| **Chi-squared** | continuous | k ∈ ℕ | Inference / variance estimation. |
| **Student-t** | continuous | ν ∈ ℕ | Inference under unknown variance. |
| **F** | continuous | d₁, d₂ ∈ ℕ | Variance-ratio testing. |

**Critical engine work to support this:**

- **Numerical CDF for distributions without closed forms** (Gamma, Beta, Chi-sq, t, F). Need a regularized incomplete-gamma / incomplete-beta routine. Recommended: port `cephes`-style `gammp` / `betacf` (~80 LOC). Acceptable: lazy import of `simple-statistics` if it supports our families.
- **Sampling layer** (`lib/probability/sampling.ts`). Inverse-CDF for distributions with closed-form quantile (Uniform, Exponential, Cauchy); Marsaglia for Normal; Marsaglia-Tsang for Gamma; rejection for Beta. **This is the foundation for Wave 3 morphing and for `clt-demonstrator` / `monte-carlo-engine`.**
- **Quantile function** for each family. Needed for shaded-region UX in Wave 3 ("show me the 95th percentile") and for VaR computation in `risk-measure-calculator`.

**Done criterion:** every family in the table above can be selected from the workbench, sliders produce the right shape, moments are correct to ±0.001 vs. textbook values, and the engine has unit tests for the lnGamma, sampling, and CDF routines.

### 2.2. Overlay mode

The PRD calls for stacking up to 3 distributions. This is one of the most pedagogically powerful features — "overlay Binomial(100, 0.03) and Poisson(3); they're nearly identical" is the single best way to teach the Poisson approximation.

**Component changes:**
- `OverlayManager.tsx` (new) — list of `{family, parameters, color, label}` with add / remove / reorder.
- `DistributionPlot.tsx` — accept `overlays: EvaluatedDistribution[]` alongside the primary distribution. Render each as a translucent layer with its own color.
- `MomentReadout.tsx` — split into per-distribution columns when overlays are present.

**Orchestrator changes:**
- New eval mode: `relationships` (β=7.0). Authors challenges that require the student to overlay two distributions and observe the convergence (e.g., "Add a Poisson overlay with λ=3 to your Binomial(100, 0.03). Drag p toward zero — what happens?").
- Schema additions: `initialOverlays?: { family, parameters }[]` on the orchestrator output.

**Done criterion:** student can manually add overlays from the UI, and the `relationships` eval mode authors challenges that pre-seed an overlay configuration.

### 2.3. AI tutoring scaffold

The current workbench has no `useLuminaAI` integration — the Gemini Live tutor can't see what the student is doing. This is a major gap; the PRD called for:

> "AI sees current distribution, parameter values, selected region, and computed probability. Builds distributional intuition: 'Notice how increasing α makes the Gamma distribution more symmetric — it's approaching a Normal.'"

**Required hooks (use `/add-tutoring-scaffold` skill):**
- `useLuminaAI({ primitiveType: 'distribution-explorer', instanceId, primitiveData, gradeLevel })`
- `sendText` triggers at:
  - `[FAMILY_CHANGED]` — student switched family. Tutor narrates the shift.
  - `[PARAM_CHANGED_SIGNIFICANTLY]` — debounced 1s; tutor comments on shape change.
  - `[CHALLENGE_PRESENTED]` — when a new challenge mounts.
  - `[ANSWER_CORRECT]` / `[ANSWER_INCORRECT]` — with student's actual answer + correct value.
  - `[ALL_CHALLENGES_COMPLETE]` — celebration / synthesis.
- `aiPrimitiveData` shape: `{ family, parameters, moments, activeView, activeChallengeId }`

**Catalog entry** (in `service/manifest/catalog/math.ts` or new `catalog/probability.ts`):
- `tutoring.taskDescription`: "Student is exploring the {{family}} distribution with parameters {{parameters}}, currently working on a {{evalMode}} challenge."
- `tutoring.contextKeys`: `['family', 'parameters', 'moments', 'activeView']`
- `tutoring.scaffoldingLevels`: 3-level nudge → guidance → walkthrough.
- `tutoring.commonStruggles`: e.g., "student keeps switching families instead of tweaking params" → "Encourage them to commit to one family and explore parameter space."

**Done criterion:** student can hold a voice conversation with the Gemini Live tutor while manipulating the workbench, and the tutor's responses reflect the live state (verified by saying "I just changed lambda" and hearing the tutor acknowledge the new value).

---

## 3. Wave 3 — Sophistication (target: 1 week after Wave 2)

Goal: features that turn this from a great primitive into the *only* primitive that teaches probability this well.

### 3.1. Distribution morphing

The PRD's flagship visual: "Morphing animation when transitioning between related distributions (e.g., Binomial → Poisson as n↑, p↓)."

**Mechanics:**
- New control: "Morph to..." dropdown that lists distributions reachable from the current one (Binomial → Poisson; Poisson + interarrival → Exponential → Gamma; Gamma → Normal as α→∞; Binomial → Normal via CLT).
- Engine work: a `morph(fromFamily, fromParams, toFamily, t)` that interpolates parameter sets along a path that preserves the matching first 2 moments. For Binomial→Poisson, parameterize by t ∈ [0, 1] where (n, p) = (n₀ · (1+9t), p₀ / (1+9t)) so np stays roughly constant.
- Visual: 60fps animation across t ∈ [0, 1] with the chart redrawing on each frame. Recharts is fast enough for the families we have; if it isn't, drop to a custom SVG path renderer.

**New eval mode:** `morphing` (β=7.5). Challenges: "Start with Binomial(100, 0.03). Morph to Poisson — what's the matching λ? Now toggle the overlay to verify."

**Done criterion:** morphing animation runs smoothly, parameter values update live during the animation, and the final-state distribution exactly matches the requested family.

### 3.2. Shaded probability regions

The PRD: "Shaded probability regions with drag handles (shade P(a < X < b) by dragging a and b)."

**Component:** `ShadedRegionControl.tsx`
- Two draggable vertical handles on the chart.
- Live readout: `P(a ≤ X ≤ b) = 0.4271` (computed from the engine's CDF).
- Toggle between "two-tailed" (a, b set independently), "left-tail" (-∞, b), "right-tail" (a, ∞), and "central" (symmetric around mean).
- Snap-to-integer for discrete families.

**Engine extensions:**
- `cdf(x)` and `quantile(p)` for every family — enable analytical region probability and inverse lookup.
- Discrete: `pmfBetween(a, b)` = sum of pmf points in [a, b].

**New compute challenges:** when `compute_basic` or `compute_advanced` eval mode is active, the orchestrator MAY pre-position shaded handles to anchor the student visually before they enter their answer.

**Done criterion:** student can drag handles to any (a, b), the probability readout updates within 16ms (one frame), and the analytical answer matches a 1000-sample Monte Carlo estimate to within 0.5%.

### 3.3. Advanced function lenses

Currently: PDF/PMF and CDF. Add:

- **Survival function** `S(x) = 1 − F(x)`. One toggle switch from CDF; major value for actuarial work.
- **Hazard rate** `h(x) = f(x) / S(x)`. Critical for survival-explorer reuse and for understanding aging-vs-memoryless behavior.
- **Quantile function** `Q(p) = F⁻¹(p)`. Plot p on x-axis, x on y-axis. Teaches percentile lookup viscerally.
- **MGF** `M(t) = E[e^(tX)]`. For families with closed-form MGF (Bernoulli, Binomial, Poisson, Exponential, Gamma, Normal). Plotted over t ∈ [-1, 1] or family-appropriate range.

**UI:** function selector becomes a 6-button strip: PDF | CDF | SF | HZ | Q | MGF. Some lenses don't apply to all families (no MGF for Cauchy, no survival for distributions with negative support); disable buttons for inapplicable combinations.

**Done criterion:** every lens renders correctly for every family that supports it; disabled lenses are visibly greyed out with a tooltip explaining why.

---

## 4. Wave 4 — Production integration (target: 3-5 days after Wave 3)

Goal: the adaptive engine can route students to this primitive at the right difficulty.

### 4.1. Catalog registration

Add to `service/manifest/catalog/math.ts` (or split into `catalog/probability.ts`):

```typescript
{
  id: 'distribution-explorer',
  description: 'Master distribution workbench. Interactive PDF/PMF/CDF with parameter sliders, live moments, overlays, morphing, and shaded probability regions. ESSENTIAL for undergraduate probability and actuarial Exam P prep.',
  constraints: 'Best for grade 11 and up. Wave-1 covers 15+ distribution families.',
  evalModes: [
    { evalMode: 'explore',           label: 'Explore (Tier 1)',          beta: 1.0, scaffoldingMode: 1, challengeTypes: ['guided_exploration'] },
    { evalMode: 'identify',          label: 'Identify (Tier 2)',         beta: 3.0, scaffoldingMode: 2, challengeTypes: ['identify'] },
    { evalMode: 'compute_basic',     label: 'Compute Basic (Tier 3)',    beta: 4.5, scaffoldingMode: 3, challengeTypes: ['compute'] },
    { evalMode: 'compute_advanced',  label: 'Compute Advanced (Tier 4)', beta: 6.5, scaffoldingMode: 4, challengeTypes: ['compute', 'predict_shape'] },
    { evalMode: 'relationships',     label: 'Relationships (Tier 5)',    beta: 7.0, scaffoldingMode: 5, challengeTypes: ['compute', 'identify'] },
    { evalMode: 'morphing',          label: 'Morphing (Tier 5+)',        beta: 7.5, scaffoldingMode: 5, challengeTypes: ['compute', 'predict_shape'] },
    { evalMode: 'exam_practice',     label: 'Exam Practice (Tier 6)',    beta: 8.5, scaffoldingMode: 6, challengeTypes: ['compute'] },
  ],
  tutoring: { /* see Wave 2 §2.3 */ },
  supportsEvaluation: true,
}
```

### 4.2. Backend registration

Add to `backend/app/services/calibration/problem_type_registry.py`:

```python
"distribution-explorer": {
    "explore":           PriorConfig(1.0, "Free parameter manipulation"),
    "identify":          PriorConfig(3.0, "Identify distribution from shape/moments"),
    "compute_basic":     PriorConfig(4.5, "Single-distribution probability computation"),
    "compute_advanced":  PriorConfig(6.5, "Conditional / tail / mixture probabilities"),
    "relationships":     PriorConfig(7.0, "Distribution relationships via overlay"),
    "morphing":          PriorConfig(7.5, "Limiting behavior via morphing"),
    "exam_practice":     PriorConfig(8.5, "Full Exam-P-style problems"),
},
```

### 4.3. Evaluation submission

The MVP currently doesn't submit evaluation results. Wire `usePrimitiveEvaluation` into `DistributionExplorer.tsx`:

- On `[ALL_CHALLENGES_COMPLETE]`, call `submit({ score, metrics })` with:
  - `score`: percentage of correct commits (excluding `guided_exploration` which auto-completes).
  - `metrics: DistributionExplorerMetrics extends BasePrimitiveMetrics` (new metrics interface in `evaluation/types.ts`):
    - `distributionIdentifications` (correct / total identifies)
    - `computationAccuracy` (within tolerance / total computes)
    - `parameterExplorationDepth` (unique parameter configurations the student tried)
    - `relationshipsExplored` (count of distinct overlay/morph operations)
    - `hintUsage` (hints requested / available)

### 4.4. Cross-primitive engine reuse

The engine in `lib/probability/` should be the foundation for the next four primitives. Audit pass before building `clt-demonstrator`:
- Confirm `sampling.ts` exists and works for all 15 families.
- Confirm `cdf` and `quantile` are exposed on every `FamilyDefinition`.
- Confirm the engine has zero React or recharts dependencies (pure computation).
- Confirm it builds in Node (for backend simulation if we ever add server-side Monte Carlo).

**Done criterion:** when starting `clt-demonstrator`, the engine import is `import { FAMILIES, sampling } from '../../lib/probability'` and zero math gets reimplemented.

### 4.5. No-answer-leakage hardening

Current state has known leakage holes. Audit and fix:

1. **Chart panel header** shows "Binomial PMF" — leaks the family name during `identify` challenges. Fix: gate the header to a generic "Distribution" label until the challenge resolves.
2. **Formula panel** shows `P(X = k) = (n choose k) p^k ...` which is recognizable as Binomial. Same fix: hide the formula panel during identify.
3. **Moment readout** shows mean = np, variance = np(1-p) — for a savvy student this gives away the family. Hide the readout during identify, or replace with `μ = ?` placeholders.
4. **Family selector** correctly locks during identify, but its three buttons (Binomial, Poisson, Exponential) tell the student the answer space — not a leak per se, but limits how the orchestrator can phrase distractor-only identifies. Fix: optionally render the selector as a sealed panel during identify; the student commits via the challenge UI, then the family revealed.
5. **Initial parameter values** chosen by the orchestrator must NOT match the textbook teaching values for the family in question (e.g., if the answer is Poisson, don't initialize with λ=3 which is the canonical "Poisson example"). Add a prompt-level rule.

**Done criterion:** a tester pretending to be a sophisticated student cannot solve any `identify` challenge by reading off the workbench UI.

---

## 5. Cross-primitive coordination

The Distribution Explorer is the keystone of Wave 1 of the original advanced-probability PRD. As we build the next primitives, three engineering concerns matter:

| Primitive | Engine reuse | New engine work needed |
|-----------|-------------|----------------------|
| `clt-demonstrator` | sampling, moments | sample-mean distribution computation |
| `joint-distribution-lab` | bivariate Normal, Dirichlet | 2D density grid evaluation, marginalization integral |
| `monte-carlo-engine` | sampling for all families | composable transformation pipeline |
| `loss-model-lab` | severity = Pareto/Lognormal/Gamma; frequency = Poisson/NegBin | compound distribution Monte Carlo |
| `bayesian-updater` | conjugate pairs (Beta-Binomial, Gamma-Poisson, Normal-Normal) | posterior parameter computation |

**Engine governance:** every new primitive that needs a probability function MUST add it to `lib/probability/`, not implement locally. PR review checklist item: "Does this primitive contain any PDF / PMF / CDF / sampling code that could live in the shared engine?"

---

## 6. Risks and tradeoffs

### 6.1. Recharts performance ceiling

For overlays + morphing animation at 60fps with 200-sample continuous distributions and 30-sample discrete distributions, recharts may bottleneck on re-renders. Mitigation: profile early in Wave 2.2 (overlay mode); if frame budget is exceeded, swap chart layer for a custom SVG `<path>` renderer (~150 LOC, full control). This is not a Wave 2 blocker but it IS a Wave 3 blocker.

### 6.2. Numerical accuracy for tail probabilities

Wave 2's CDF routines (regularized incomplete gamma / beta) have well-known accuracy issues in tails (P > 0.9999 or P < 0.0001). For `compute_advanced` and `exam_practice` modes the student may compute answers in this regime. Mitigation: use log-space arithmetic, clamp results to [0, 1], and validate against scipy on 100 cases per family.

### 6.3. Orchestrator quality at high β

The single-stage Gemini-Flash-Lite orchestrator works well for explore / identify / compute_basic. For `exam_practice` (β=8.5) it may produce trivial problems instead of exam-grade challenges. Mitigation: in Wave 4, split the orchestrator into a multi-stage pipeline (scenario author → challenger) modeled after AnnotatedExample, and use Flash (not Flash-Lite) for the scenario stage. Don't preemptively split; wait for evidence of quality issues.

### 6.4. Identify-mode UX vs. exploration freedom

The strict no-leakage policy in §4.5 will make `identify` mode feel constrained — the student can't freely manipulate the workbench during the challenge. Tension: exploration is the primitive's superpower, but identify mode requires hiding. Resolution: separate the identify challenge into a **two-act** pattern (mirror AnnotatedExample's watch / try):
- Act 1 (Identify): minimal workbench — locked family, hidden moments, hidden formula. Student submits an answer.
- Act 2 (Explore): full workbench unlocked. Student now plays with what they just identified.

This is a Wave 3 design choice; flag for review when implementing.

---

## 7. Done criteria for Wave 1 → production-ready

A primitive is "production-ready" when:

1. ✅ MVP shipped (Wave 1).
2. ⬜ 15+ families in the engine (Wave 2.1).
3. ⬜ Overlay mode for relationship teaching (Wave 2.2).
4. ⬜ Tutoring scaffold wired (Wave 2.3).
5. ⬜ Distribution morphing (Wave 3.1).
6. ⬜ Shaded probability regions (Wave 3.2).
7. ⬜ All 6 function lenses (Wave 3.3).
8. ⬜ Catalog registration (Wave 4.1).
9. ⬜ Backend `problem_type_registry.py` registration (Wave 4.2).
10. ⬜ Evaluation submission with full metrics (Wave 4.3).
11. ⬜ Engine audit complete; reusable by next 4 primitives (Wave 4.4).
12. ⬜ No-answer-leakage hardening verified (Wave 4.5).
13. ⬜ Eval-test passes for all 7 eval modes (G1-G5 sync rules satisfied).
14. ⬜ One real student journey through the curriculum hits this primitive at the right difficulty (manual QA).

---

## 8. What we are NOT building (yet)

To stay focused, these are explicitly out of scope until they have a concrete pedagogical demand:

- **3D surface plots** for joint distributions — that belongs in `joint-distribution-lab`, not here.
- **Mixture distributions** (2-component normal, etc.) — defer to a `mixture-explorer` primitive.
- **Custom user-drawn distributions** — the original PRD mentioned this for `clt-demonstrator`; not relevant for the explorer.
- **Server-side Monte Carlo** — every chart and answer is computable client-side from the engine.
- **Distribution fitting / parameter estimation from data** — that's `mle-explorer`'s job.
- **Real-time multiplayer / leaderboards** — Lumina is a single-student adaptive system.

---

## 9. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-06 | Ship MVP with single-stage orchestrator instead of multi-stage. | Wave-1 quality is sufficient at β ≤ 6.5. Multi-stage adds complexity without proven gain. Revisit if `exam_practice` mode produces weak content. |
| 2026-05-06 | Math engine lives in `lumina/lib/probability/`, not `service/distribution-explorer/`. | Engine is the multiplier for the next 4 primitives. Co-locating it with one primitive would tax every reuse. |
| 2026-05-06 | Recharts for plotting, not custom SVG. | Speed of MVP delivery. Will revisit at Wave 3.1 if morphing animation can't hit 60fps. |
| 2026-05-06 | Wave 1 ships 3 families (Binomial, Poisson, Exponential), not 15. | Smallest set that demonstrates discrete + continuous + actuarial coverage. Adding more is purely additive in Wave 2. |
| 2026-05-06 | No tutoring scaffold in MVP. | `useLuminaAI` integration adds 2-3 days; better to ship visual + math first and validate the workbench shape before wiring AI. |
