# Advanced Probability & Actuarial Mathematics — Visual Primitives
## Product Requirements Document — Lumina Platform

### Vision

Lumina's elementary math primitives teach through touch — dragging counters onto ten frames, snapping fraction bars. **This PRD extends that philosophy to the hardest probability content in existence**: actuarial exam material (SOA Exam P / CAS Exam 1), graduate probability, and mathematical statistics. The insight is the same — when you *see* a Poisson process arriving in real time, or *drag* a prior into a posterior, or *watch* the CLT converge as you add samples, the abstraction becomes physical intuition.

This is not a cosmetic upgrade. The current platform has **zero primitives** above introductory data analysis. A student preparing for Exam P has no interactive tools for:
- Visualizing how distribution parameters shape PDFs/CDFs
- Building combinatorial arguments visually before computing
- Running Monte Carlo experiments to develop distributional intuition
- Seeing Bayesian updating as a dynamic process
- Understanding loss models, survival functions, or risk measures

**This PRD delivers 14 primitives across 6 domains that cover the full Exam P syllabus and extend into Exam STAM / FAM territory.** Each primitive is a simulation, not a worksheet — students manipulate the mathematics directly.

### Target Audience

| Audience | Use Case |
|----------|----------|
| **Exam P / Exam 1 candidates** | Interactive practice with every distribution and technique on the syllabus |
| **Undergraduate probability** (Math 361-level) | Visual companion to Sheldon Ross, Blitzstein, or Bertsekas & Tsitsiklis |
| **Graduate mathematical statistics** | MGF derivations, sufficiency, MLE visualizations |
| **Actuarial science programs** | Loss models, credibility, survival — Exam STAM/FAM prep |
| **Self-learners** | Anyone who wants to *see* probability instead of just computing it |

### Design Principles

1. **Simulate, Don't Illustrate.** Every primitive runs a live stochastic process. The student doesn't look at a picture of a Poisson process — they watch arrivals happen in real time, adjust λ, and see the interarrival times form an exponential. The simulation IS the lesson.

2. **Parameters Are Physical.** Distribution parameters must feel like physical controls with real consequences. Dragging α in a Gamma distribution should visibly reshape the density. Sliding λ in a Poisson should change arrival intensity in real time. The student builds intuition for what parameters *do*, not just what they *are*.

3. **Compute Through Interaction.** Exam P requires computation — but the path to computation is through understanding. Every primitive has a "challenge mode" where students must predict outcomes, compute probabilities, or derive values before the simulation reveals the answer. Wrong answers trigger targeted scaffolding, not just "try again."

4. **Connect Distributions.** Probability is a web — Exponential is a special case of Gamma, Poisson counts come from exponential interarrivals, Normal approximates Binomial. Primitives must make these connections explicit through visual morphing, parameter linking, and cross-references.

5. **Actuarial Context.** Problems aren't abstract. They're about insurance claims, mortality, equipment failure, portfolio risk. The AI tutor frames every concept in actuarial language alongside mathematical notation.

6. **Gemini-Native Generation.** All challenge content is generated via Gemini JSON mode. Exam-style problems, parameter sets, and scenario contexts are AI-generated with difficulty calibration.

7. **No Answer Leakage.** At this level, students are sophisticated enough to reverse-engineer answers from UI state. Default parameter values, axis labels, shading, and visual hints must NEVER reveal the answer to a challenge. The primitive must be solvable only through mathematical reasoning.

---

## Domain Map

| Domain | Primitives | Exam Coverage |
|--------|-----------|---------------|
| **1. Distribution Lab** | `distribution-explorer`, `joint-distribution-lab` | Exam P §1-3: Univariate & multivariate distributions |
| **2. Combinatorics & Counting** | `combinatorics-sandbox`, `inclusion-exclusion-visualizer` | Exam P §0: Counting techniques |
| **3. Stochastic Processes** | `poisson-process-simulator`, `markov-chain-lab` | Exam P §4, STAM: Poisson processes, Markov chains |
| **4. Inference & Estimation** | `bayesian-updater`, `mle-explorer`, `clt-demonstrator` | Exam P §5, graduate stats: Bayesian, MLE, CLT |
| **5. Actuarial Models** | `loss-model-lab`, `survival-explorer`, `credibility-lab` | Exam STAM/FAM: Loss distributions, survival, credibility |
| **6. Risk & Decision** | `risk-measure-calculator`, `monte-carlo-engine` | Exam STAM/FAM, ERM: VaR, TVaR, simulation |

---

## DOMAIN 1: Distribution Lab

---

### 1. `distribution-explorer` — The Master Distribution Workbench

**Purpose:** The single most important primitive in this PRD. An interactive workbench where students manipulate any probability distribution — discrete or continuous — by dragging parameters and watching the PDF, CDF, MGF, survival function, and hazard rate respond in real time. This is where students build the physical intuition that "α controls shape, β controls scale" or "as n→∞ and p→0 with np=λ, Binomial→Poisson."

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Parameter-shape relationships, distribution identification, moment computation, distribution relationships, limiting behavior

**Distributions Supported:**

| Family | Distributions | Key Parameters |
|--------|--------------|----------------|
| **Discrete** | Bernoulli, Binomial, Poisson, Geometric, Negative Binomial, Hypergeometric, Discrete Uniform | n, p, λ, r, N, K |
| **Continuous** | Uniform, Exponential, Gamma, Beta, Normal, Lognormal, Weibull, Pareto, Chi-squared, Student-t, F | α, β, μ, σ, k, θ, λ |
| **Derived** | Mixture distributions (2-component), Convolutions, Order statistics | Weights, component params |

**Multimodal Features:**
- **Visual:** Split-panel layout. Left panel: interactive PDF/PMF plot with parameter sliders. Right panel: switchable CDF, survival function S(x), hazard rate h(x), or MGF M(t). Shaded probability regions with drag handles (shade P(a < X < b) by dragging a and b). Moment annotations: μ, σ², skewness, kurtosis displayed and updating live. Overlay mode: stack up to 3 distributions for visual comparison. Morphing animation when transitioning between related distributions (e.g., Binomial → Poisson as n↑, p↓).
- **AI Tutoring:** AI sees current distribution, parameter values, selected region, and computed probability. Builds distributional intuition: "Notice how increasing α makes the Gamma distribution more symmetric — it's approaching a Normal. Can you see why? Each α adds another exponential waiting time." Catches misconceptions: "You're confusing the rate λ and the mean 1/λ — in this parameterization, larger λ means shorter waits." Exam coaching: "On Exam P, they'll give you the mean and variance and expect you to identify the distribution. What two moments pin down a Gamma?"
- **Interactive:** Parameter sliders with real-time plot updates. Click-drag shading for probability regions. Distribution selector dropdown with search. Overlay toggle. Function switcher (PDF/CDF/SF/hazard/MGF). "Show moments" toggle. "Show formula" toggle (LaTeX rendering). Distribution relationship explorer: visual arrows showing limiting/special-case connections.

**Interaction Model:**
- Phase 1 (Explore): Free exploration — pick distributions, drag parameters, see shapes change. Build vocabulary: "What happens to the Normal when σ doubles?"
- Phase 2 (Identify): Given a plot shape and partial information (mean, variance, or support), identify the distribution family and parameters. "This density is right-skewed with support [0,∞) and mean 5. Which distribution?"
- Phase 3 (Compute): Given a distribution and parameters, compute specific probabilities, moments, or percentiles. Verify against the visualization. "X ~ Gamma(3, 2). Find P(X > 8)."
- Phase 4 (Connect): Demonstrate distribution relationships. "Start with Binomial(100, 0.03). Now switch to Poisson. What λ matches? Overlay them — how close are they?"

**Schema:**
```json
{
  "primitiveType": "distribution-explorer",
  "distribution": {
    "family": "string (e.g., 'gamma', 'poisson', 'normal')",
    "parameters": {
      "param1": { "name": "string", "value": "number", "min": "number", "max": "number", "step": "number" },
      "param2": { "name": "string", "value": "number", "min": "number", "max": "number", "step": "number" }
    },
    "support": { "lower": "number | '-inf'", "upper": "number | 'inf'" }
  },
  "display": {
    "functions": ["pdf", "cdf", "survival", "hazard", "mgf"],
    "activeFunction": "string",
    "showMoments": "boolean",
    "showFormula": "boolean",
    "shadedRegion": { "lower": "number | null", "upper": "number | null" }
  },
  "overlays": [
    { "family": "string", "parameters": "object", "color": "string", "label": "string" }
  ],
  "challenges": [
    {
      "id": "string",
      "type": "string (identify | compute | compare | derive)",
      "instruction": "string",
      "hints": ["string"],
      "solution": {
        "distribution": "string | null",
        "parameters": "object | null",
        "value": "number | null",
        "tolerance": "number"
      },
      "narration": "string"
    }
  ],
  "examContext": "string | null (e.g., 'Exam P Problem 12: An insurance company...')"
}
```

**Eval Modes:**
| Mode | β | Description | Challenge Types |
|------|---|-------------|-----------------|
| `explore` | 1.0 | Free parameter manipulation with guided prompts | guided_exploration |
| `identify` | 3.0 | Identify distribution from shape/moments/support | distribution_identification |
| `compute_basic` | 4.5 | Single-distribution probability calculations | probability_computation |
| `compute_advanced` | 6.5 | Conditional probability, truncated distributions, mixtures | conditional_probability, mixture_computation |
| `relationships` | 7.0 | Prove/demonstrate distribution relationships via parameter limits | limiting_distribution, special_case |
| `exam_practice` | 8.5 | Full Exam P-style problems with no scaffolding | exam_problem |

**Evaluation Metrics:**
- `distributionIdentifications` (correct / total)
- `computationAccuracy` (within tolerance / total)
- `averageComputeTime` (ms per challenge)
- `relationshipsExplored` (distribution pairs morphed)
- `parameterExplorationDepth` (unique parameter configurations tried)
- `hintUsage` (hints requested / available)

---

### 2. `joint-distribution-lab` — Multivariate Probability Workbench

**Purpose:** Exam P devotes ~15% of questions to joint distributions — joint PDFs, marginal distributions, conditional distributions, independence, covariance, and transformations. This primitive renders joint distributions as interactive 3D surface plots and 2D heatmaps where students can slice, marginalize, condition, and compute visually.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Joint density visualization, marginalization, conditioning, independence testing, covariance/correlation, transformations of random variables

**Multimodal Features:**
- **Visual:** Primary view: 2D heatmap of joint density f(x,y) with color intensity. 3D toggle: rotatable surface plot. Marginal distribution panels: f_X(x) displayed above, f_Y(y) displayed to the right, computed by integrating (with visible integration animation). Conditional slicing: drag a horizontal or vertical line to see f(X|Y=y) or f(Y|X=x) as a highlighted 1D density. Independence overlay: show f_X(x)·f_Y(y) alongside f(x,y) — when they match, the variables are independent. Covariance/correlation readout with visual rectangle showing the "covariance rectangle."
- **AI Tutoring:** "You sliced at Y=2 and got this conditional density. Notice it's not the same shape as the marginal — that tells you X and Y are dependent. Can you find a value of y where the conditional DOES match the marginal?" Coaches through integration: "To marginalize, you're integrating out y. Think of it as collapsing this 2D surface down to one dimension — every vertical strip becomes a single height."
- **Interactive:** Drag slicing lines for conditional distributions. Toggle marginal panels. Click regions to shade and compute P(X∈A, Y∈B). Toggle independence overlay. Parameter controls for parametric joint distributions. "Transform" mode: apply g(X,Y) and see the resulting distribution.

**Interaction Model:**
- Phase 1 (Visualize): Explore joint distributions. See how the 2D density relates to marginals.
- Phase 2 (Marginalize): Given a joint distribution, compute marginals by visually integrating.
- Phase 3 (Condition): Compute conditional distributions and expected values.
- Phase 4 (Analyze): Determine independence, compute covariance/correlation, apply transformations.

**Schema:**
```json
{
  "primitiveType": "joint-distribution-lab",
  "joint": {
    "type": "string (parametric | tabular | piecewise)",
    "family": "string | null (bivariate_normal, dirichlet, etc.)",
    "parameters": "object",
    "region": {
      "x": { "min": "number", "max": "number" },
      "y": { "min": "number", "max": "number" }
    },
    "piecewiseRegions": [
      { "density": "string (LaTeX expression)", "bounds": "string (region description)" }
    ]
  },
  "display": {
    "mode": "string (heatmap | surface3d)",
    "showMarginals": "boolean",
    "conditionalSlice": { "variable": "string | null", "value": "number | null" },
    "shadedRegion": "object | null",
    "showIndependenceOverlay": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (marginalize | condition | independence | covariance | transform | compute)",
      "instruction": "string",
      "solution": { "value": "number | null", "expression": "string | null", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_joint` | 2.0 | Guided exploration of joint density visualization |
| `marginals` | 4.0 | Compute marginal distributions from joint |
| `conditionals` | 5.5 | Compute conditional distributions and expectations |
| `independence` | 6.0 | Determine and prove independence/dependence |
| `transformations` | 7.5 | Apply variable transformations, find resulting distributions |
| `exam_joint` | 8.5 | Full exam-style joint distribution problems |

---

## DOMAIN 2: Combinatorics & Counting

---

### 3. `combinatorics-sandbox` — Visual Counting Workbench

**Purpose:** Combinatorics is the gateway to probability — and where most students first hit a wall. The core difficulty is translating a word problem into the right counting model: is this a permutation or combination? With or without replacement? Ordered or unordered? This primitive makes counting *physical* by letting students literally arrange, select, and partition objects while the formula updates in real time.

**Grade Band:** Pre-calc — Actuarial

**Cognitive Operation:** Permutations, combinations, multinomial coefficients, stars-and-bars, inclusion-exclusion, derangements, circular arrangements

**Multimodal Features:**
- **Visual:** Object pool (colored balls, cards, people — context-dependent). Selection area with "slots" for ordered arrangements or an "unordered bin" for combinations. Real-time count display: as the student builds arrangements, the total possible count updates. Formula panel showing which counting formula applies and why. Branching tree visualization: expand the first few levels of the decision tree to see how the multiplication principle works. Partition visualization for multinomial coefficients.
- **AI Tutoring:** "You picked 3 cards from 52 — but does the order matter here? In poker, {A♠, K♥, Q♦} and {Q♦, K♥, A♠} are the same hand. So this is C(52,3), not P(52,3)." Coaches the framework: "Ask yourself three questions: Does order matter? Is there replacement? Are the objects distinguishable?" Walks through the multiplication principle visually: "For the first slot, you have 5 choices. For each of those, 4 remain for the second slot..."
- **Interactive:** Drag objects into ordered slots or unordered bins. Toggle "order matters" to see arrangements collapse into combinations (visual grouping animation). Toggle "replacement" to see the pool replenish after each draw. Expand/collapse decision tree. Partition objects into groups by dragging dividers.

**Interaction Model:**
- Phase 1 (Arrange): Build small arrangements by hand. See that P(4,2) = 12 by actually making all 12 arrangements.
- Phase 2 (Count): Given a scenario, determine the counting model and compute. "How many ways to choose a committee of 3 from 10 people?"
- Phase 3 (Advanced): Multinomial coefficients, circular permutations, derangements, stars-and-bars problems.
- Phase 4 (Probability): Use counting to compute probabilities. "What's the probability of a full house?"

**Schema:**
```json
{
  "primitiveType": "combinatorics-sandbox",
  "objects": {
    "pool": [
      { "id": "string", "label": "string", "category": "string", "color": "string" }
    ],
    "poolSize": "number",
    "distinguishable": "boolean"
  },
  "countingModel": {
    "ordered": "boolean",
    "withReplacement": "boolean",
    "selectionSize": "number",
    "partitions": "number[] | null (for multinomial: group sizes)"
  },
  "display": {
    "showFormula": "boolean",
    "showDecisionTree": "boolean",
    "showTotal": "boolean",
    "treeDepth": "number (levels to expand, max 4)"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (count | model_selection | probability | proof)",
      "scenario": "string (word problem context)",
      "instruction": "string",
      "solution": { "model": "string", "count": "number", "probability": "number | null" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `build_arrangements` | 1.5 | Physically build all arrangements for small sets |
| `model_selection` | 3.5 | Identify the correct counting model for a scenario |
| `compute` | 5.0 | Compute counts using formulas |
| `advanced_counting` | 6.5 | Multinomial, circular, derangements, stars-and-bars |
| `counting_probability` | 7.5 | Use counting to compute probabilities |
| `exam_combinatorics` | 8.5 | Full exam-style problems |

---

### 4. `inclusion-exclusion-visualizer` — Set Operations & Overcounting

**Purpose:** Inclusion-exclusion is one of the most powerful and frequently tested techniques in probability. Students struggle because they can't see the overcounting — they add P(A) + P(B) and don't viscerally understand why the intersection gets counted twice. This primitive makes it visible with interactive Venn/Euler diagrams where regions light up as terms are added and subtracted.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Set union/intersection, inclusion-exclusion formula, overcounting visualization, probability of unions

**Multimodal Features:**
- **Visual:** Interactive Venn diagram (2, 3, or 4 sets). Each region has a count or probability label. As the student builds the inclusion-exclusion formula term by term, regions light up (green for added, red for subtracted). Running total shows the current count. Overcounting visualization: when |A| + |B| is computed, the intersection region pulses to show it's been counted twice. Extends to 3-4 sets with all 2^n - 1 regions visible.
- **AI Tutoring:** "You've added all three circle sizes — but look at the diagram. The center region where all three overlap? It got added three times (once per circle), then subtracted three times (once per pair). It's at zero! You need to add it back once." Steps through the formula construction: "|A∪B∪C| = |A|+|B|+|C| - |A∩B| - |A∩C| - |B∩C| + |A∩B∩C|. Watch each term light up."
- **Interactive:** Drag to resize sets. Click regions to see their count/probability. Build the I-E formula term by term — each term added/subtracted highlights the corresponding regions. "Verify" button checks if the formula equals the union.

**Schema:**
```json
{
  "primitiveType": "inclusion-exclusion-visualizer",
  "sets": [
    { "label": "string", "size": "number", "description": "string" }
  ],
  "intersections": [
    { "sets": ["string"], "size": "number" }
  ],
  "challenges": [
    {
      "id": "string",
      "type": "string (build_formula | compute_union | probability | derangement)",
      "scenario": "string",
      "instruction": "string",
      "solution": { "value": "number", "formula": "string" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `two_sets` | 2.5 | Two-set inclusion-exclusion |
| `three_sets` | 4.5 | Three-set inclusion-exclusion |
| `probability_unions` | 6.0 | P(A∪B∪C) with dependent events |
| `exam_ie` | 8.0 | Exam-style inclusion-exclusion problems |

---

## DOMAIN 3: Stochastic Processes

---

### 5. `poisson-process-simulator` — Arrivals, Waiting, and Counting

**Purpose:** The Poisson process is the workhorse of actuarial modeling — insurance claims arrive as a Poisson process, interarrival times are exponential, and the number of claims in an interval is Poisson-distributed. This primitive runs a *live* Poisson process where students watch events arrive on a timeline, see the interarrival times accumulate, and discover the connections between Poisson, Exponential, and Gamma distributions empirically.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Poisson process properties, interarrival time analysis, superposition/thinning, non-homogeneous Poisson processes

**Multimodal Features:**
- **Visual:** Horizontal timeline with events appearing as dots at random times. Speed control (1x to 100x). Arrival counter N(t) incrementing in real time. Interarrival time histogram building as events arrive — students watch it converge to Exponential(λ). Count histogram: N(t) for fixed intervals, converging to Poisson(λt). Split view: show two independent processes and their superposition. Intensity function λ(t) overlay for non-homogeneous processes.
- **AI Tutoring:** "The arrivals look random, but there's deep structure. See how the interarrival histogram is forming an exponential shape? That's the memoryless property — no matter when the last arrival was, the expected wait for the next one is always 1/λ." Connects to insurance: "If claims arrive at rate λ=3 per day, what's the probability of 0 claims in an 8-hour shift? That's P(N(1/3) = 0) = e^(-1)."
- **Interactive:** Adjust λ with a slider (real-time intensity change). Start/stop/reset simulation. Toggle histograms (interarrival, count). Split/merge processes (superposition). Thin a process (each arrival independently kept with probability p). Overlay theoretical distributions on empirical histograms.

**Interaction Model:**
- Phase 1 (Observe): Watch a Poisson process. See arrivals accumulate. Get intuition for "random but regular."
- Phase 2 (Discover): Manipulate λ, observe how interarrival times and counts change. Discover Exponential and Poisson connections.
- Phase 3 (Compute): Given λ and a time window, predict counts and probabilities before the simulation reveals them.
- Phase 4 (Advanced): Superposition, thinning, non-homogeneous processes, waiting time to k-th arrival (Gamma connection).

**Schema:**
```json
{
  "primitiveType": "poisson-process-simulator",
  "process": {
    "type": "string (homogeneous | non_homogeneous | compound)",
    "lambda": "number (for homogeneous)",
    "lambdaFunction": "string | null (for non-homogeneous, e.g., '2 + sin(t)')",
    "jumpDistribution": "object | null (for compound Poisson)"
  },
  "simulation": {
    "timeHorizon": "number",
    "speed": "number (1-100)",
    "showInterarrivalHistogram": "boolean",
    "showCountHistogram": "boolean",
    "showTheoreticalOverlay": "boolean"
  },
  "processes": [
    { "id": "string", "lambda": "number", "color": "string", "label": "string" }
  ],
  "operations": {
    "superposition": "boolean",
    "thinningProbability": "number | null"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (predict_count | interarrival | superposition | thinning | compound)",
      "instruction": "string",
      "solution": { "value": "number", "distribution": "string | null", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `observe` | 1.5 | Guided observation and parameter exploration |
| `basic_computation` | 3.5 | P(N(t)=k) and E[N(t)] calculations |
| `interarrival` | 5.0 | Exponential interarrival time problems |
| `superposition_thinning` | 6.5 | Merging and splitting Poisson processes |
| `compound_poisson` | 7.5 | Compound Poisson (aggregate claims) |
| `exam_poisson` | 9.0 | Full exam-style Poisson process problems |

---

### 6. `markov-chain-lab` — State Transitions & Long-Run Behavior

**Purpose:** Markov chains model everything from no-claims discount systems to credit rating migrations to disability insurance states. This primitive renders state-transition diagrams as interactive directed graphs where students set transition probabilities, run the chain, and discover stationary distributions, absorption probabilities, and expected hitting times.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Transition matrices, Chapman-Kolmogorov equations, stationary distributions, absorption, expected hitting times, classification of states

**Multimodal Features:**
- **Visual:** Directed graph with states as circles, edges as arrows with probability labels. Edge thickness proportional to probability. Current state highlighted. History trail showing the last N states visited. Transition matrix displayed alongside the graph. Stationary distribution bar chart building over time. State classification labels (transient, recurrent, absorbing). Heat map of n-step transition probabilities P^n.
- **AI Tutoring:** "The chain has been running for 1000 steps. Look at the fraction of time spent in each state — it's converging to [0.4, 0.35, 0.25]. That's the stationary distribution π. Can you verify by solving πP = π?" Insurance context: "In a no-claims discount system, state 0 is full premium. Each claim-free year moves you one state up (discount). A claim sends you back to state 0. What's the long-run average discount?"
- **Interactive:** Drag states to position the graph. Click edges to edit transition probabilities (with auto-normalization). Step-by-step execution (one transition at a time) or continuous run. Toggle stationary distribution visualization. Matrix view with power computation (P², P³, ... P^n). Add/remove states and edges.

**Schema:**
```json
{
  "primitiveType": "markov-chain-lab",
  "chain": {
    "states": [
      { "id": "string", "label": "string", "type": "string (transient | recurrent | absorbing)" }
    ],
    "transitions": [
      { "from": "string", "to": "string", "probability": "number" }
    ],
    "initialState": "string",
    "initialDistribution": "number[] | null"
  },
  "display": {
    "showMatrix": "boolean",
    "showStationaryDistribution": "boolean",
    "showStateClassification": "boolean",
    "historyLength": "number",
    "matrixPower": "number"
  },
  "context": "string | null (e.g., 'No-claims discount system with 4 levels')",
  "challenges": [
    {
      "id": "string",
      "type": "string (stationary | absorption | hitting_time | classify | n_step)",
      "instruction": "string",
      "solution": { "value": "number | number[]", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_chain` | 2.0 | Build and run simple chains, observe behavior |
| `n_step` | 4.0 | Compute n-step transition probabilities |
| `stationary` | 5.5 | Find stationary distributions |
| `absorption` | 6.5 | Absorption probabilities and expected times |
| `classify_states` | 7.0 | Classify states, identify communicating classes |
| `exam_markov` | 8.5 | Full exam-style Markov chain problems |

---

## DOMAIN 4: Inference & Estimation

---

### 7. `bayesian-updater` — Prior to Posterior, Visually

**Purpose:** Bayesian reasoning is notoriously counterintuitive — even experienced students struggle with "how does the prior get overwhelmed by data?" This primitive makes it visceral: students set a prior distribution, observe data points arriving one by one, and watch the posterior reshape in real time. Each data point visibly "pulls" the distribution toward the truth.

**Grade Band:** Undergraduate — Graduate

**Cognitive Operation:** Prior specification, likelihood construction, posterior computation, conjugate families, credible intervals, prior sensitivity

**Multimodal Features:**
- **Visual:** Three overlapping curves: prior (blue, fading), likelihood (orange), posterior (green, bold). As data arrives, prior fades and posterior shifts/narrows. Conjugate pair labels (Beta-Binomial, Gamma-Poisson, Normal-Normal). Credible interval shading on posterior. "Prior sensitivity" mode: overlay posteriors from different priors — watch them converge as data accumulates. Data panel showing observations as they arrive.
- **AI Tutoring:** "You started with a Beta(1,1) prior — that's uniform, saying 'I have no idea what p is.' After seeing 7 heads in 10 flips, your posterior is Beta(8, 4). The mode shifted from 0.5 to 0.67. What happens if you started with a strong prior of Beta(50,50)? Would 10 flips change your mind?" Actuarial context: "An insurer has a prior belief about claim frequency. As claims come in, the posterior updates. This is literally how credibility theory works."
- **Interactive:** Select prior family. Drag prior parameters (hyperparameters). Click "observe" to generate data points from the true distribution (hidden or revealed). Watch posterior update sequentially. Toggle prior sensitivity mode. Adjust confidence level for credible intervals.

**Schema:**
```json
{
  "primitiveType": "bayesian-updater",
  "model": {
    "conjugateFamily": "string (beta_binomial | gamma_poisson | normal_normal | gamma_exponential)",
    "prior": { "family": "string", "parameters": "object" },
    "trueParameter": "number (hidden from student in challenge mode)",
    "likelihood": { "family": "string", "parameters": "object" }
  },
  "data": {
    "observations": "number[]",
    "batchSize": "number (observations per update step)"
  },
  "display": {
    "showPrior": "boolean",
    "showLikelihood": "boolean",
    "showPosterior": "boolean",
    "showCredibleInterval": "boolean",
    "credibleLevel": "number (e.g., 0.95)",
    "priorSensitivity": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (predict_posterior | credible_interval | prior_sensitivity | conjugate_identify)",
      "instruction": "string",
      "solution": { "parameters": "object | null", "interval": "[number, number] | null", "value": "number | null" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_bayes` | 2.0 | Guided exploration of prior→posterior updating |
| `conjugate_pairs` | 4.0 | Identify and use conjugate prior families |
| `compute_posterior` | 5.5 | Compute posterior parameters from prior + data |
| `credible_intervals` | 6.5 | Construct and interpret credible intervals |
| `prior_sensitivity` | 7.5 | Analyze how prior choice affects inference |
| `exam_bayes` | 8.5 | Full exam-style Bayesian problems |

---

### 8. `mle-explorer` — Maximum Likelihood, Geometrically

**Purpose:** MLE is the backbone of parametric estimation and appears throughout actuarial exams. Students typically learn it as "take the derivative, set to zero" — but MLE has a beautiful geometric interpretation: the likelihood surface is a landscape, and the MLE is its peak. This primitive renders that landscape and lets students explore it.

**Grade Band:** Undergraduate — Graduate

**Cognitive Operation:** Likelihood construction, log-likelihood, score function, Fisher information, confidence intervals, sufficiency

**Multimodal Features:**
- **Visual:** Left panel: data points plotted (histogram or scatter). Right panel: log-likelihood surface as a function of parameter(s). For one parameter: a curve with a clear peak at the MLE. For two parameters: a 3D surface or contour plot with the peak marked. Score function (derivative) crossing zero at the MLE. Observed Fisher information determining the curvature at the peak (steeper = more precise). Confidence interval overlay: ℓ(θ) - ℓ(θ̂) = -1.92 cutoff for 95% CI.
- **AI Tutoring:** "The log-likelihood curve is steepest near θ = 3.2 — that's your MLE. Notice how narrow the peak is? That means the Fisher information is large, so your estimate is precise. If you had fewer data points, the peak would be wider." Connects to sufficiency: "All 50 data points contribute to the likelihood, but the MLE depends only on the sample mean. That's sufficiency — the mean captures everything the data says about θ."
- **Interactive:** Generate random samples from a chosen distribution. Watch the likelihood surface form as data arrives. Drag a cursor along the likelihood to find the MLE manually. Toggle score function, Fisher information, confidence interval. Change sample size to see precision change.

**Schema:**
```json
{
  "primitiveType": "mle-explorer",
  "model": {
    "family": "string",
    "trueParameters": "object",
    "parameterSpace": {
      "param1": { "name": "string", "min": "number", "max": "number" },
      "param2": { "name": "string", "min": "number", "max": "number" }
    }
  },
  "data": {
    "sampleSize": "number",
    "observations": "number[]"
  },
  "display": {
    "showLogLikelihood": "boolean",
    "showScoreFunction": "boolean",
    "showFisherInformation": "boolean",
    "showConfidenceInterval": "boolean",
    "confidenceLevel": "number"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (find_mle | confidence_interval | compare_estimators | sufficiency)",
      "instruction": "string",
      "solution": { "value": "number | object", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_likelihood` | 2.0 | Visualize likelihood surfaces |
| `find_mle` | 4.0 | Locate MLEs graphically and analytically |
| `fisher_information` | 6.0 | Compute Fisher information, interpret precision |
| `confidence_intervals` | 7.0 | Construct likelihood-based confidence intervals |
| `exam_mle` | 8.5 | Full exam-style estimation problems |

---

### 9. `clt-demonstrator` — The Central Limit Theorem in Action

**Purpose:** The CLT is the most important theorem in probability — and the most misunderstood. Students memorize "sample means are approximately normal" without understanding *when* it works, *how fast* it converges, or *why* it fails for heavy-tailed distributions. This primitive lets students sample from ANY distribution and watch the sampling distribution of the mean converge (or not) to Normal.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Sampling distributions, Normal approximation, convergence rate, moment conditions, Berry-Esseen bounds

**Multimodal Features:**
- **Visual:** Top panel: population distribution (any shape — the weirder the better). Middle panel: one sample of size n, with mean marked. Bottom panel: histogram of sample means across many replications, with Normal overlay. Animation: samples are drawn rapidly, means computed and added to the histogram. Convergence metric: Kolmogorov-Smirnov distance from Normal displayed and decreasing. Sample size slider from n=1 to n=1000.
- **AI Tutoring:** "You're sampling from an Exponential — heavily right-skewed. At n=5 the sampling distribution is still skewed. But watch what happens at n=30... it's nearly symmetric! By n=100, it's indistinguishable from Normal. That's the CLT." Counterexample: "Now try the Cauchy distribution. No matter how large n gets, the sampling distribution never becomes Normal. Why? Because the Cauchy has no finite mean — the CLT requires finite variance."
- **Interactive:** Choose any population distribution (or draw a custom one). Set sample size n with slider. Run simulation (1, 10, 100, 1000 replications). Toggle Normal overlay. Compare convergence rates across distributions. Draw a custom distribution for ultimate exploration.

**Schema:**
```json
{
  "primitiveType": "clt-demonstrator",
  "population": {
    "family": "string (or 'custom')",
    "parameters": "object",
    "customPMF": "number[] | null"
  },
  "sampling": {
    "sampleSize": "number",
    "replications": "number",
    "speed": "number (1-1000)"
  },
  "display": {
    "showPopulation": "boolean",
    "showCurrentSample": "boolean",
    "showSamplingDistribution": "boolean",
    "showNormalOverlay": "boolean",
    "showKSDistance": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (predict_shape | compute_parameters | find_n | counterexample)",
      "instruction": "string",
      "solution": { "value": "number | string", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_clt` | 1.5 | Watch the CLT converge for various distributions |
| `predict` | 3.5 | Predict mean and variance of sampling distribution |
| `approximation` | 5.5 | Use Normal approximation to compute probabilities |
| `convergence_rate` | 7.0 | Determine minimum n for adequate approximation |
| `exam_clt` | 8.0 | Exam-style Normal approximation problems |

---

## DOMAIN 5: Actuarial Models

---

### 10. `loss-model-lab` — Frequency × Severity = Aggregate Loss

**Purpose:** The fundamental equation of actuarial science: aggregate loss S = X₁ + X₂ + ... + X_N where N is claim frequency (Poisson, Negative Binomial) and Xᵢ are claim severities (Exponential, Gamma, Pareto, Lognormal). This primitive lets students build loss models from components, apply modifications (deductibles, limits, coinsurance), and see how aggregate loss distributions emerge.

**Grade Band:** Actuarial (Exam STAM/FAM)

**Cognitive Operation:** Frequency-severity decomposition, loss modifications, aggregate loss distribution, stop-loss reinsurance, compound distributions

**Multimodal Features:**
- **Visual:** Three-panel layout. Panel 1: Frequency distribution N ~ Poisson(λ) or NegBin(r,p) with PMF bar chart. Panel 2: Severity distribution X ~ Pareto(α,θ) or Lognormal(μ,σ) with PDF curve. Panel 3: Aggregate loss S distribution, built by simulation — histogram fills in as the Monte Carlo runs. Loss modification pipeline: visual flowchart showing claim → deductible → limit → coinsurance → net loss. Each modification visually transforms the severity distribution (truncation, censoring, scaling).
- **AI Tutoring:** "You set a deductible of $500. Watch what happens to the severity distribution — everything below $500 disappears, and the remaining claims are shifted down. The expected severity drops, but so does the claim count (small claims eliminated). These are per-loss and per-payment — which one did you mean?" Connects to reinsurance: "The insurer keeps the first $100K of aggregate loss. Everything above that is the reinsurer's problem. That's a stop-loss. What's the expected cost to the reinsurer?"
- **Interactive:** Select frequency and severity distributions independently. Apply modifications (deductible, limit, coinsurance) with sliders. Run Monte Carlo to build aggregate distribution. Toggle modification pipeline visualization. Compare modified vs. unmodified distributions. Set stop-loss thresholds.

**Schema:**
```json
{
  "primitiveType": "loss-model-lab",
  "frequency": {
    "family": "string (poisson | negative_binomial | binomial)",
    "parameters": "object"
  },
  "severity": {
    "family": "string (exponential | gamma | pareto | lognormal | weibull)",
    "parameters": "object"
  },
  "modifications": {
    "deductible": { "type": "string (ordinary | franchise)", "amount": "number | null" },
    "limit": "number | null",
    "coinsurance": "number | null (0-1)"
  },
  "reinsurance": {
    "type": "string | null (stop_loss | excess_of_loss | quota_share)",
    "retention": "number | null",
    "limit": "number | null"
  },
  "simulation": {
    "runs": "number",
    "showPipeline": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (expected_loss | modified_severity | aggregate | reinsurance | var)",
      "instruction": "string",
      "solution": { "value": "number", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_loss` | 2.0 | Build frequency-severity models, observe aggregate |
| `expected_values` | 4.0 | E[S], Var(S) from frequency and severity moments |
| `modifications` | 5.5 | Apply deductibles, limits, coinsurance |
| `aggregate` | 7.0 | Aggregate loss distribution properties |
| `reinsurance` | 8.0 | Stop-loss, excess-of-loss pricing |
| `exam_loss` | 9.5 | Full STAM/FAM exam-style loss model problems |

---

### 11. `survival-explorer` — Life Tables, Hazard Functions, and Mortality

**Purpose:** Survival analysis underpins life insurance, pension mathematics, and reliability engineering. This primitive visualizes the core trio — survival function S(x), hazard rate μ(x), and cumulative hazard Λ(x) — and connects them to life table functions (lₓ, qₓ, eₓ) and actuarial present values.

**Grade Band:** Actuarial (Exam STAM/FAM/LTAM)

**Cognitive Operation:** Survival functions, hazard rates, life table construction, mortality laws (Gompertz, Makeham, De Moivre), select and ultimate mortality, actuarial present values

**Multimodal Features:**
- **Visual:** Primary: S(x) survival curve with shaded area = life expectancy ė_x. Secondary panels: hazard rate μ(x), density f(x) = S(x)·μ(x). Life table strip: lₓ, dₓ, qₓ, pₓ as interactive columns. Mortality law selector: De Moivre (linear), Gompertz (exponential), Makeham (Gompertz + constant), Weibull. Parameter controls reshape all curves simultaneously. Actuarial functions: ₐₓ, Aₓ, ²Aₓ overlaid when interest rate is set.
- **AI Tutoring:** "The hazard rate μ(x) is increasing — that's Gompertz mortality. Each year, the force of mortality grows exponentially. At age 30, μ(30) ≈ 0.001. By age 80, μ(80) ≈ 0.05. That 50x increase is why life insurance premiums rise with age." Connects S(x) to probabilities: "S(x) = P(T > x). The probability of surviving from age 30 to 65 is S(65)/S(30) — that's ₃₅p₃₀."
- **Interactive:** Select mortality law. Adjust parameters. Toggle between continuous and discrete (life table) views. Set interest rate for actuarial present values. Compare two mortality models side-by-side. Drag age markers to compute conditional survival probabilities.

**Schema:**
```json
{
  "primitiveType": "survival-explorer",
  "mortalityModel": {
    "law": "string (de_moivre | gompertz | makeham | weibull | custom_table)",
    "parameters": "object",
    "lifeTable": "object[] | null (for custom_table: [{x, lx, qx}])"
  },
  "display": {
    "functions": ["survival", "hazard", "density", "cumulative_hazard"],
    "activeFunction": "string",
    "showLifeTable": "boolean",
    "showActuarialValues": "boolean",
    "interestRate": "number | null"
  },
  "ageRange": { "min": "number", "max": "number" },
  "challenges": [
    {
      "id": "string",
      "type": "string (survival_prob | life_expectancy | hazard | actuarial_pv | mortality_law)",
      "instruction": "string",
      "solution": { "value": "number", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_survival` | 2.0 | Explore mortality laws and survival curves |
| `life_table` | 4.0 | Compute life table values from survival function |
| `conditional_survival` | 5.5 | ₙpₓ, ₙqₓ, ₙ|ₘqₓ calculations |
| `hazard_rate` | 6.5 | Hazard rate analysis and mortality law identification |
| `actuarial_pv` | 8.0 | Compute insurance and annuity present values |
| `exam_survival` | 9.0 | Full exam-style survival/mortality problems |

---

### 12. `credibility-lab` — Balancing Experience and Prior

**Purpose:** Credibility theory is the actuarial application of Bayesian ideas: how much weight should an insurer give to its own claims experience vs. the industry average? This primitive visualizes the credibility-weighted estimate as a tug-of-war between individual experience and the collective, with the credibility factor Z determining the balance.

**Grade Band:** Actuarial (Exam STAM/FAM)

**Cognitive Operation:** Limited fluctuation credibility, Bühlmann credibility, Bühlmann-Straub, empirical Bayes estimation

**Multimodal Features:**
- **Visual:** Tug-of-war visualization: individual experience (left) pulling against collective mean (right). Z slider determines balance point (credibility-weighted estimate). Data panel: individual loss history across years. Prior panel: industry parameters. Bühlmann components: μ (process mean), v (expected process variance), a (variance of hypothetical means). As more years of data accumulate, Z grows and the estimate shifts toward individual experience.
- **AI Tutoring:** "With only 2 years of data, Z = 0.15 — you're barely trusting the individual experience. But watch what happens with 20 years of data. Z = 0.72! The individual's track record now dominates. That's credibility — it's just formalized 'wait and see.'" Connects to Bayesian: "Bühlmann credibility IS Bayesian estimation under a specific model. Z = n/(n + k) where k = v/a. It's the same as the posterior mean weight in a Normal-Normal model."
- **Interactive:** Set individual data (claim counts/amounts per year). Set collective parameters. Toggle between limited fluctuation and Bühlmann. Add/remove years of experience. Watch Z and the credibility estimate update. Compare credibility estimate to MLE and collective mean.

**Schema:**
```json
{
  "primitiveType": "credibility-lab",
  "method": "string (limited_fluctuation | buhlmann | buhlmann_straub)",
  "individual": {
    "data": "number[] (annual observations)",
    "exposures": "number[] | null (for Bühlmann-Straub)"
  },
  "collective": {
    "mean": "number",
    "variance": "number"
  },
  "buhlmannComponents": {
    "mu": "number | null",
    "v": "number | null",
    "a": "number | null"
  },
  "display": {
    "showTugOfWar": "boolean",
    "showZProgression": "boolean",
    "showBuhlmannDecomposition": "boolean"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (compute_z | credibility_estimate | buhlmann_components | compare_methods)",
      "instruction": "string",
      "solution": { "value": "number", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_credibility` | 2.5 | Interactive tug-of-war with experience vs. collective |
| `limited_fluctuation` | 4.5 | Full credibility standards, partial credibility |
| `buhlmann` | 6.5 | Bühlmann credibility factor and premium computation |
| `buhlmann_straub` | 7.5 | Bühlmann-Straub with unequal exposures |
| `exam_credibility` | 9.0 | Full exam-style credibility problems |

---

## DOMAIN 6: Risk & Decision

---

### 13. `risk-measure-calculator` — VaR, TVaR, and the Tail

**Purpose:** Modern risk management lives in the tail of distributions. VaR (Value at Risk) answers "what's the worst that could happen at the 99th percentile?" TVaR (Tail VaR / CVaR / Expected Shortfall) answers "given that we're in the worst 1%, how bad is it on average?" This primitive makes tail risk visceral — students see exactly which part of the distribution they're measuring and why TVaR > VaR always.

**Grade Band:** Actuarial (Exam STAM/FAM, ERM)

**Cognitive Operation:** Quantile functions, tail expectations, risk measure properties (coherence), comparing distributions by tail risk

**Multimodal Features:**
- **Visual:** PDF with VaR marked as a vertical line at the α-quantile. TVaR shaded region: the area beyond VaR, with the TVaR value marked as the centroid of that region. Interactive α slider (0.90 to 0.999). Side-by-side comparison: two distributions with same VaR but different TVaR (demonstrating TVaR's sensitivity to tail shape). Coherence property demonstrations: subadditivity failure for VaR, always satisfied for TVaR.
- **AI Tutoring:** "VaR at 95% says 'there's only a 5% chance of losing more than $2.3M.' But TVaR says 'when you DO lose more than $2.3M, the average loss is $4.1M.' Which number should the board care about?" Demonstrates subadditivity: "Here are two risks. VaR says diversifying INCREASES risk — that's VaR's fatal flaw. TVaR always rewards diversification."
- **Interactive:** Choose loss distribution. Set confidence level α. Toggle VaR/TVaR markers. Compare two distributions. Demonstrate coherence properties. Compute risk capital = TVaR - E[X].

**Schema:**
```json
{
  "primitiveType": "risk-measure-calculator",
  "distribution": {
    "family": "string",
    "parameters": "object"
  },
  "riskMeasures": {
    "confidenceLevel": "number (0.90-0.999)",
    "showVaR": "boolean",
    "showTVaR": "boolean",
    "showExpectedShortfall": "boolean"
  },
  "comparison": {
    "enabled": "boolean",
    "distribution2": { "family": "string", "parameters": "object" }
  },
  "coherence": {
    "showSubadditivity": "boolean",
    "portfolioWeights": "[number, number] | null"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (compute_var | compute_tvar | compare | coherence | capital)",
      "instruction": "string",
      "solution": { "value": "number", "tolerance": "number" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `explore_risk` | 2.0 | Visualize tail risk across distributions |
| `compute_var` | 4.5 | VaR computation for standard distributions |
| `compute_tvar` | 6.0 | TVaR / Expected Shortfall computation |
| `coherence` | 7.5 | Demonstrate coherence properties, subadditivity |
| `exam_risk` | 9.0 | Full exam-style risk measure problems |

---

### 14. `monte-carlo-engine` — Simulation as Proof

**Purpose:** When analytical solutions fail — mixture distributions, complex dependencies, exotic payoffs — simulation takes over. This primitive is a general-purpose Monte Carlo engine where students build simulations from distributional building blocks, run thousands of trials, and watch empirical distributions converge to theoretical values. It's both a learning tool and a computational Swiss army knife.

**Grade Band:** Undergraduate — Actuarial

**Cognitive Operation:** Random variate generation, convergence, variance reduction, simulation design, empirical distribution analysis

**Multimodal Features:**
- **Visual:** Simulation builder: drag-and-drop flowchart (generate X ~ Exp(3), generate Y ~ Poisson(X), compute Z = max(X,Y)). Results panel: histogram of simulated values building in real time. Convergence tracker: running mean with confidence band narrowing as n grows. Q-Q plot: empirical quantiles vs. theoretical (if known). Multiple panels for multi-step simulations.
- **AI Tutoring:** "Your simulation estimates E[max(X,Y)] = 4.23 ± 0.15 after 10,000 runs. Let's check: can you derive the exact answer? If not, how many more runs would cut the standard error in half?" Teaches variance reduction: "You're estimating a rare event — P(S > 1M) where S is aggregate claims. With naive simulation, you'd need millions of runs. Importance sampling can get the same precision in 1000."
- **Interactive:** Drag distribution blocks to build simulation pipeline. Set random seeds for reproducibility. Control simulation speed and count. Toggle convergence tracker, histogram, Q-Q plot. Compare simulated vs. analytical results. Save and modify simulation designs.

**Schema:**
```json
{
  "primitiveType": "monte-carlo-engine",
  "pipeline": [
    {
      "id": "string",
      "type": "string (generate | transform | aggregate | filter)",
      "distribution": "object | null",
      "expression": "string | null",
      "label": "string"
    }
  ],
  "output": {
    "variable": "string (which pipeline step to display)",
    "statistic": "string (mean | variance | quantile | probability)"
  },
  "simulation": {
    "runs": "number",
    "seed": "number | null",
    "showConvergence": "boolean",
    "showHistogram": "boolean",
    "showQQPlot": "boolean"
  },
  "theoretical": {
    "knownDistribution": "object | null",
    "knownValue": "number | null"
  },
  "challenges": [
    {
      "id": "string",
      "type": "string (estimate | design | convergence | variance_reduction)",
      "instruction": "string",
      "solution": { "value": "number", "tolerance": "number", "design": "string | null" },
      "narration": "string"
    }
  ]
}
```

**Eval Modes:**
| Mode | β | Description |
|------|---|-------------|
| `run_simulation` | 1.5 | Run pre-built simulations, interpret results |
| `build_simulation` | 4.0 | Design simulation pipelines for given problems |
| `convergence` | 5.5 | Analyze convergence, determine required sample size |
| `variance_reduction` | 7.5 | Apply importance sampling, antithetic variables |
| `exam_simulation` | 8.5 | Exam-style simulation design and interpretation |

---

## Exam P Syllabus Coverage Matrix

| Exam P Topic | Weight | Primary Primitive | Supporting Primitives |
|-------------|--------|-------------------|----------------------|
| General probability | 10-17% | `inclusion-exclusion-visualizer` | `combinatorics-sandbox`, `monte-carlo-engine` |
| Univariate distributions | 18-25% | `distribution-explorer` | `clt-demonstrator`, `poisson-process-simulator` |
| Multivariate distributions | 18-25% | `joint-distribution-lab` | `distribution-explorer` |
| Combinatorics | Foundational | `combinatorics-sandbox` | `monte-carlo-engine` |
| Conditional probability & Bayes | 10-17% | `bayesian-updater` | `joint-distribution-lab` |
| Transformations & moments | 10-17% | `distribution-explorer` (MGF mode) | `mle-explorer`, `joint-distribution-lab` |
| Risk measures | 5-10% | `risk-measure-calculator` | `loss-model-lab`, `distribution-explorer` |

**Estimated coverage: 95%+ of Exam P syllabus topics, with interactive simulation for every major concept.**

---

## Implementation Priority

### Wave 1 — Foundation (highest impact, exam-critical)
1. **`distribution-explorer`** — The keystone. Every other primitive references distributions.
2. **`combinatorics-sandbox`** — Gateway to all probability computation.
3. **`monte-carlo-engine`** — Universal backup: anything you can't solve analytically, simulate.

### Wave 2 — Core Exam P
4. **`joint-distribution-lab`** — 20%+ of Exam P.
5. **`bayesian-updater`** — Critical for conditional probability section.
6. **`clt-demonstrator`** — Normal approximation is everywhere.
7. **`inclusion-exclusion-visualizer`** — High-frequency exam topic.

### Wave 3 — Stochastic Processes
8. **`poisson-process-simulator`** — Bridge from Exam P to STAM.
9. **`markov-chain-lab`** — Foundation for multi-state models.

### Wave 4 — Actuarial Applications
10. **`loss-model-lab`** — Core STAM/FAM content.
11. **`survival-explorer`** — Life contingencies foundation.
12. **`risk-measure-calculator`** — Modern risk management.
13. **`credibility-lab`** — Actuarial-specific Bayesian application.
14. **`mle-explorer`** — Estimation theory.

---

## Cross-Primitive Connections

These primitives form a web, not a list. The AI tutor should actively bridge between them:

```
combinatorics-sandbox ──→ inclusion-exclusion-visualizer
         │                          │
         ▼                          ▼
distribution-explorer ←──── bayesian-updater
    │        │                      │
    │        ▼                      ▼
    │   joint-distribution-lab  credibility-lab
    │        │
    ▼        ▼
poisson-process-simulator ──→ loss-model-lab
         │                       │
         ▼                       ▼
   markov-chain-lab     survival-explorer
                                 │
                                 ▼
                      risk-measure-calculator
                                 │
                                 ▼
                        monte-carlo-engine
                    (universal computation layer)
```

**Key bridges the AI tutor must make explicit:**
- Poisson process → Exponential interarrivals → Gamma waiting times → Distribution Explorer
- Bayesian Updater → Credibility Lab ("credibility IS Bayesian estimation")
- Loss Model → Monte Carlo ("when the compound distribution has no closed form, simulate")
- Distribution Explorer → CLT Demonstrator ("sum enough of anything and you get Normal")
- Joint Distribution Lab → Bayesian Updater ("conditioning IS slicing the joint density")

---

## PRD Paradigm: Scaling Beyond This Document

This PRD covers probability/actuarial mathematics. But the same paradigm scales to ANY advanced domain:

### The Lumina PRD Template for Advanced Content

1. **Domain Map**: What are the 4-6 conceptual clusters? Each becomes a section.
2. **Primitive per Concept**: One interactive simulation per major concept. Not a static visual — a running stochastic/dynamic system the student manipulates.
3. **Exam/Certification Alignment**: Map every primitive to a specific exam topic with % coverage. The coverage matrix is the accountability mechanism.
4. **6-Level Eval Mode Ladder**: Every primitive gets `explore` (β≈2) → domain-specific progression → `exam_practice` (β≈8-9). The ladder IS the difficulty curve.
5. **Cross-Primitive Web**: Draw the connection graph. The AI tutor uses this to bridge concepts.
6. **Wave Prioritization**: Ship the keystone primitive first (the one everything else references), then expand outward.

### Domains Ready for This Treatment

| Domain | Keystone Primitive | Exam/Cert Target |
|--------|-------------------|------------------|
| **Linear Algebra** | `matrix-lab` (eigenvalues, SVD, transformations) | Graduate qualifying exams |
| **Real Analysis** | `epsilon-delta-explorer` (limits, continuity, convergence) | Analysis quals |
| **Differential Equations** | `phase-portrait-lab` (vector fields, stability, bifurcations) | Engineering math |
| **Discrete Math / Graph Theory** | `graph-algorithm-lab` (BFS/DFS, shortest path, coloring) | CS interviews, competitions |
| **Financial Mathematics** | `derivatives-pricing-lab` (Black-Scholes, binomial trees) | Exam FM/IFM |
| **Machine Learning** | `gradient-descent-explorer` (loss surfaces, optimization) | ML interviews |
| **Organic Chemistry** | `reaction-mechanism-lab` (electron pushing, stereochemistry) | MCAT, ACS exams |
| **Quantum Mechanics** | `wavefunction-explorer` (Schrödinger, probability amplitudes) | Physics GRE |

Each domain follows the same template: domain map → primitive per concept → exam alignment → eval ladder → cross-primitive web → wave prioritization.

**The insight**: Lumina's primitives aren't just "interactive widgets." They're **simulation-first learning environments** where the student manipulates the actual mathematical/physical system. This paradigm scales to any domain where understanding comes from interaction, not passive reading.
