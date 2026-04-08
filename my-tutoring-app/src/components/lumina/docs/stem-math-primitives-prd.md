# STEM Math Primitives — Product Requirements Document

| Field   | Value        |
|---------|--------------|
| Version | 0.1          |
| Date    | April 2026   |
| Status  | **Draft** |

---

## 1. Problem Statement

Lumina has strong math primitives for K-8 (TenFrame, CountingBoard, NumberLine, EquationBuilder, FunctionMachine) and a strong expository primitive (DeepDive). But there's a gap between them: **no primitive can handle the math layer of STEM concepts.**

Take the double-slit experiment. DeepDive explains it beautifully — prose, diagrams, mini-sims. But when the student hits d·sin(θ) = nλ, there's nothing. EquationBuilder does tile-dragging for "3 + ? = 7". FunctionMachine explores single-variable rules like "2x + 1". CoordinateGraph plots points and draws lines. None of them can handle:

- Manipulating a multi-variable equation to isolate a variable
- Exploring how changing one parameter in a formula affects an output
- Sketching or matching a function shape like cos²(δ/2)

This gap blocks every STEM subject that has math: physics, chemistry, economics, engineering, actuarial science. The manifest can sequence DeepDive → math primitive, but there's no math primitive to sequence *to*.

### The Scaling Argument

You can't build a double-slit primitive, an Ohm's law primitive, a compound-interest primitive, a projectile-motion primitive. That doesn't scale. But the math *operations* inside all of them decompose into a small set:

| Operation | Examples |
|-----------|----------|
| Solve/rearrange an equation | d·sin(θ) = nλ → θ = arcsin(nλ/d); V = IR → R = V/I; A = P(1+r)^t → t = ... |
| Explore parameter relationships | Change λ, watch fringe spacing. Change R, watch current. Change r, watch growth. |
| Predict/match function shape | Intensity envelope cos². Exponential decay. Normal distribution. Supply/demand curves. |

Three domain-agnostic primitives cover the math layer for essentially any STEM topic. Gemini provides the domain context (what the variables mean, why the equation matters). The primitive provides the interaction (manipulate, explore, sketch).

---

## 2. The Three Primitives

### 2.1 Equation Workspace

**What it is:** Step-by-step algebraic manipulation. Given an equation and a target variable, the student applies operations (divide both sides, take arcsin, square both sides, etc.) to isolate the variable. Each step transforms the equation visibly.

**What it replaces:** Nothing — this capability doesn't exist. EquationBuilder handles K-2 tile construction. Equation Workspace handles algebra through calculus.

**Why it's not EquationBuilder:** EquationBuilder's core interaction is *constructing* equations from tiles. Equation Workspace's core interaction is *transforming* equations through operations. Different verbs, different UI, different cognitive demand. EquationBuilder teaches "what is an equation." Equation Workspace teaches "how to solve one."

**Core interaction loop:**
1. Student sees equation: `d · sin(θ) = n · λ`
2. Goal displayed: "Solve for θ"
3. Student selects an operation from a menu: "Divide both sides by d"
4. Equation transforms: `sin(θ) = nλ/d`
5. Student selects next operation: "Take arcsin of both sides"
6. Equation transforms: `θ = arcsin(nλ/d)` — solved!

**Key design decisions:**
- **Operation menu, not free-text.** Student picks from valid algebraic operations (divide by X, multiply by X, add X, subtract X, take √, take sin⁻¹, square, etc.). This keeps interaction tight and scorable without requiring a CAS.
- **Gemini generates the equation, target variable, and valid solution path.** The primitive doesn't need to know algebra — it validates against the pre-computed solution steps.
- **Multiple valid paths.** For `V = IR, solve for R`, you can divide by I first or rearrange differently. Gemini provides the canonical path; the primitive accepts any operation that produces a valid intermediate form. (Phase 1: single canonical path. Phase 2: multi-path validation.)
- **LaTeX rendering.** Equations render in proper math notation, not ASCII. Use KaTeX (already a common React library, lightweight).
- **Step history.** All previous steps visible, forming a vertical chain. Student can see their reasoning trail.

**Eval modes (4 tiers):**

| Eval Mode | Description | IRT Beta |
|-----------|-------------|----------|
| `guided-solve` | Operations highlighted as hints, student just clicks in order | 1.5 |
| `solve` | Student picks operations freely, single-path validation | 3.0 |
| `multi-step` | Longer equations requiring 4+ steps | 4.0 |
| `identify-operation` | Given a partially-solved equation, identify the next valid step (MC) | 2.5 |

**Data contract:**

```typescript
interface EquationWorkspaceData {
  title: string;
  /** The starting equation in LaTeX */
  equation: string;
  /** Variable to solve for */
  targetVariable: string;
  /** Context: what do these variables represent? */
  variableDefinitions: Array<{
    symbol: string;
    name: string;
    unit?: string;
  }>;
  /** Domain context — what is this equation about? */
  context: string;
  /** The solution steps (canonical path) */
  solutionSteps: Array<{
    operation: string;        // "Divide both sides by d"
    operationId: string;      // "divide_d" — for matching
    resultLatex: string;      // LaTeX of equation after this step
  }>;
  /** Available operations pool (superset of solution — includes distractors) */
  availableOperations: Array<{
    id: string;
    label: string;            // "Divide both sides by d"
    category: 'arithmetic' | 'algebraic' | 'trigonometric' | 'logarithmic' | 'radical';
  }>;
  /** Optional: known values to substitute at the end */
  knownValues?: Record<string, number>;
  challenges: EquationWorkspaceChallenge[];
}

interface EquationWorkspaceChallenge {
  type: 'guided-solve' | 'solve' | 'multi-step' | 'identify-operation';
  instruction: string;
  equation: string;           // LaTeX
  targetVariable: string;
  solutionSteps: Array<{
    operation: string;
    operationId: string;
    resultLatex: string;
  }>;
  availableOperations: Array<{
    id: string;
    label: string;
    category: string;
  }>;
  knownValues?: Record<string, number>;
}
```

**Metrics:**

```typescript
interface EquationWorkspaceMetrics {
  stepsCompleted: number;
  stepsRequired: number;
  incorrectOperations: number;
  hintsUsed: number;
  /** Did the student reach the solved form? */
  solved: boolean;
  /** Time in seconds */
  solveTime: number;
}
```

---

### 2.2 Parameter Explorer

**What it is:** A multi-variable formula with interactive controls. The student adjusts parameters via sliders and observes how the output changes. The primitive renders the relationship — as a live-updating number, a graph, or a simple visual pattern depending on the formula.

**What it replaces:** Partially overlaps with FunctionMachine's "observe" and "predict" phases, but FunctionMachine is single-variable with discrete input queues. Parameter Explorer is multi-variable with continuous sliders and richer output.

**Why it's not FunctionMachine:** FunctionMachine's metaphor is a black box — input goes in, output comes out, discover the rule. Parameter Explorer's metaphor is a control panel — you see the formula, you see all the variables, you explore *relationships* between them. FunctionMachine teaches "what is a function." Parameter Explorer teaches "how do variables relate in a real system."

**Core interaction loop:**
1. Student sees formula: `Δy = λL / d` with variable definitions
2. Three sliders: λ (wavelength), L (screen distance), d (slit spacing)
3. Output display: Δy value + a fringe pattern visualization
4. Student drags λ slider up → watches Δy increase, fringes spread apart
5. Prompt: "What happens to fringe spacing when you double the wavelength?"
6. Student answers prediction → sees confirmation

**Key design decisions:**
- **Formula always visible.** This isn't a discovery exercise — the student knows the relationship and explores its behavior. The formula is displayed with the currently-active variable highlighted as they drag.
- **Output modes.** Gemini specifies how the output renders:
  - `'value'` — just a number (e.g., "Δy = 3.2 cm")
  - `'graph'` — a simple line/curve that updates live as sliders move
  - `'pattern'` — a domain-specific visual (fringe pattern, circuit diagram state, growth curve) described by Gemini as a parameterized SVG or canvas instruction
- **Prediction checkpoints.** At key moments, the primitive locks sliders and asks "Before you move λ, predict: will Δy increase, decrease, or stay the same?" This makes it evaluable.
- **Hold-and-vary.** Student can lock variables (click to pin) so they only vary one at a time. This teaches experimental control / ceteris paribus.
- **Gemini generates everything domain-specific:** formula, variable names/ranges/units, output mode, prediction questions, "what to notice" observations.

**Eval modes (4 tiers):**

| Eval Mode | Description | IRT Beta |
|-----------|-------------|----------|
| `explore` | Free exploration with guided observations, no scoring | 1.0 |
| `predict-direction` | "Will Y increase or decrease when X increases?" (directional) | 2.0 |
| `predict-value` | "If λ doubles, what happens to Δy?" (quantitative reasoning) | 3.5 |
| `identify-relationship` | "Which variable has the strongest effect on the output?" | 3.0 |

**Data contract:**

```typescript
interface ParameterExplorerData {
  title: string;
  /** The formula in LaTeX */
  formula: string;
  /** What the formula computes */
  outputName: string;
  outputUnit?: string;
  /** Domain context */
  context: string;
  /** Variable definitions with slider ranges */
  parameters: Array<{
    symbol: string;
    name: string;
    unit?: string;
    min: number;
    max: number;
    step: number;
    default: number;
    /** Brief description of what this variable represents */
    description: string;
  }>;
  /** How to render the output */
  outputMode: 'value' | 'graph' | 'pattern';
  /** For 'graph' mode: what to plot on axes */
  graphConfig?: {
    xAxis: string;            // parameter symbol to use as x-axis
    xLabel: string;
    yLabel: string;
  };
  /** For 'pattern' mode: description for visual rendering */
  patternConfig?: {
    type: string;             // 'fringe', 'wave', 'decay', etc.
    description: string;      // Gemini describes what to draw
  };
  /** Guided observations — prompts shown during exploration */
  observations: Array<{
    trigger: string;          // "When λ > 500nm"
    prompt: string;           // "Notice how the fringes spread apart"
  }>;
  challenges: ParameterExplorerChallenge[];
}

interface ParameterExplorerChallenge {
  type: 'explore' | 'predict-direction' | 'predict-value' | 'identify-relationship';
  instruction: string;
  /** For predict challenges */
  prediction?: {
    /** Which parameter is being changed */
    varyParameter: string;
    /** What the parameter changes to */
    newValue?: number;
    /** "increase" | "decrease" | "stay-same" for directional */
    correctDirection?: 'increase' | 'decrease' | 'stay-same';
    /** For quantitative: the expected output value (with tolerance) */
    correctValue?: number;
    tolerance?: number;
    explanation: string;
  };
  /** For identify-relationship: which parameter has strongest effect */
  correctParameter?: string;
}
```

**Metrics:**

```typescript
interface ParameterExplorerMetrics {
  predictionsCorrect: number;
  predictionsTotal: number;
  parametersExplored: string[];
  observationsTriggered: number;
  /** Did the student lock variables to isolate effects? */
  usedHoldAndVary: boolean;
  explorationTime: number;
}
```

---

### 2.3 Function Sketch

**What it is:** Given a verbal/symbolic description of a function, the student either sketches the curve by placing control points, or identifies key features (roots, extrema, asymptotes, inflection points) on a given curve.

**What it replaces:** CoordinateGraph handles point plotting and line display. Function Sketch handles *qualitative function reasoning* — understanding shape, behavior, and features without necessarily computing exact values.

**Why it's not CoordinateGraph:** CoordinateGraph's interaction is "click to plot a specific point at (3, 5)." Function Sketch's interaction is "draw what you think cos²(x) looks like" or "where are the zeros of this polynomial?" CoordinateGraph teaches "how to read/plot coordinates." Function Sketch teaches "what does this function look like and why."

**Core interaction loop (sketch mode):**
1. Student sees: "Sketch the intensity distribution I(θ) = I₀ · cos²(πd·sin(θ)/λ)"
2. Empty axes with labeled ranges
3. Student places 5-8 control points by clicking on the graph
4. A smooth curve interpolates through the points
5. "Submit" → the real curve appears overlaid
6. Scoring based on key feature alignment (peaks in right places, zeros in right places, overall shape correct)

**Core interaction loop (identify mode):**
1. Student sees a rendered curve (e.g., exponential decay)
2. Prompted: "Mark the y-intercept", "Where does the function approach zero?", "Is this function increasing or decreasing?"
3. Student clicks on the graph or selects from options
4. Immediate feedback per feature identified

**Key design decisions:**
- **Control-point sketching, not freehand.** Freehand drawing is noisy and hard to evaluate. Control points + spline interpolation gives clean curves that are easy to score against key features.
- **Feature-based scoring, not point-by-point.** The student doesn't need to draw cos² perfectly. They need: correct number of peaks, peaks at approximately right positions, zeros between peaks, overall envelope shape. Gemini specifies which features matter.
- **Two modes serve different cognitive demands.** Sketch = "can you predict/recall the shape?" (harder, generative). Identify = "can you read and interpret the shape?" (easier, receptive). Both are important.
- **Domain-agnostic axes.** The primitive renders axes with whatever labels Gemini provides. "θ vs I(θ)" for optics. "time vs population" for biology. "price vs quantity" for economics.
- **Reference curve always revealed.** After submission in sketch mode, the actual curve is shown. This is the learning moment — seeing where your mental model diverges from reality.

**Eval modes (4 tiers):**

| Eval Mode | Description | IRT Beta |
|-----------|-------------|----------|
| `identify-features` | Mark roots, extrema, intercepts, asymptotes on a given curve | 2.0 |
| `classify-shape` | "Is this linear, quadratic, exponential, or periodic?" (MC) | 1.5 |
| `sketch-match` | Place control points to sketch a described function | 3.5 |
| `compare-functions` | Two curves shown — identify which matches a description | 2.5 |

**Data contract:**

```typescript
interface FunctionSketchData {
  title: string;
  /** Domain context */
  context: string;
  /** Axes configuration */
  axes: {
    xLabel: string;
    xMin: number;
    xMax: number;
    yLabel: string;
    yMin: number;
    yMax: number;
  };
  challenges: FunctionSketchChallenge[];
}

interface FunctionSketchChallenge {
  type: 'identify-features' | 'classify-shape' | 'sketch-match' | 'compare-functions';
  instruction: string;

  /** For identify-features: the reference curve + features to find */
  referenceCurve?: {
    /** Points defining the curve (dense enough for smooth rendering) */
    points: Array<{ x: number; y: number }>;
    /** LaTeX expression (displayed to student) */
    expression?: string;
  };
  features?: Array<{
    type: 'root' | 'maximum' | 'minimum' | 'y-intercept' | 'x-intercept'
        | 'asymptote' | 'inflection' | 'region-increasing' | 'region-decreasing';
    /** Expected location (for point features) */
    x?: number;
    y?: number;
    tolerance?: number;
    /** For asymptotes: the asymptote value */
    value?: number;
    orientation?: 'horizontal' | 'vertical';
    label: string;             // "the first zero crossing"
  }>;

  /** For classify-shape */
  classification?: {
    curve: Array<{ x: number; y: number }>;
    correctType: string;       // "exponential-decay", "quadratic", "sinusoidal", etc.
    options: string[];
    explanation: string;
  };

  /** For sketch-match */
  sketchTarget?: {
    /** The function the student should sketch */
    description: string;       // "Sketch I(θ) = I₀ · cos²(πd·sinθ/λ)"
    expression?: string;       // LaTeX
    /** Key features that determine scoring */
    keyFeatures: Array<{
      type: 'peak' | 'zero' | 'intercept' | 'trend' | 'symmetry' | 'envelope';
      description: string;     // "Central maximum at θ=0"
      /** Expected approximate location */
      x?: number;
      y?: number;
      tolerance?: number;
      weight: number;          // relative importance for scoring (0-1)
    }>;
    /** The actual curve (revealed after submission) */
    revealCurve: Array<{ x: number; y: number }>;
    /** Minimum control points the student must place */
    minPoints?: number;
  };

  /** For compare-functions */
  comparison?: {
    curveA: Array<{ x: number; y: number }>;
    curveB: Array<{ x: number; y: number }>;
    labelA?: string;
    labelB?: string;
    question: string;          // "Which curve represents exponential growth?"
    correctCurve: 'A' | 'B';
    explanation: string;
  };
}
```

**Metrics:**

```typescript
interface FunctionSketchMetrics {
  /** For identify: features correctly identified / total */
  featuresCorrect: number;
  featuresTotal: number;
  /** For sketch: weighted feature match score 0-100 */
  sketchAccuracy: number;
  /** For classify/compare: correct boolean */
  classificationCorrect: boolean;
  controlPointsPlaced: number;
  /** Time in seconds */
  completionTime: number;
}
```

---

## 3. How They Compose (The Double-Slit Example)

A manifest for "Double-Slit Experiment, Physics 11" might produce:

```
1. DeepDive (explore mode)
   - HeroImage: interference pattern photo
   - Prose: wave superposition explanation
   - MiniSim: toggle single-slit vs double-slit
   - KeyFacts: d, λ, L variable definitions
   - MultipleChoice: "Why do we see bright and dark bands?"

2. Parameter Explorer (explore mode)
   - Formula: Δy = λL/d
   - Sliders: λ (400-700nm), L (0.5-3m), d (0.1-1mm)
   - Output: fringe spacing value + pattern visual
   - Observation: "Notice: smaller slit spacing → wider fringes"

3. Equation Workspace (solve mode)
   - Equation: d·sin(θ) = nλ
   - Target: solve for θ
   - Operations: divide by d, take arcsin
   - Known values: d = 0.5mm, λ = 550nm, n = 1

4. Function Sketch (identify-features mode)
   - Curve: I(θ) = I₀ · cos²(πd·sinθ/λ)
   - Identify: central maximum, first minima, secondary maxima
   - Axes: θ vs intensity
```

Four primitives, each doing what it does best. The manifest sequences them. Each is independently IRT-calibrated. None of them know about double-slit experiments — Gemini fills in the domain context. The same three new primitives handle Ohm's law, compound interest, projectile motion, population dynamics, supply-demand equilibrium...

---

## 4. Implementation Notes

### 4.1 Build Order

**Parameter Explorer first.** Simplest interaction (sliders → output), highest immediate value (every STEM topic has parameter relationships), and the `'value'` output mode can ship without canvas/graph rendering. The `'graph'` and `'pattern'` modes can follow.

**Equation Workspace second.** Requires KaTeX integration for LaTeX rendering (new dependency). The operation-menu interaction is novel — no existing primitive does this, so it needs careful UX iteration.

**Function Sketch third.** Most complex interaction (control-point placement + spline interpolation + feature-based scoring). Benefits from CoordinateGraph's existing canvas rendering code.

### 4.2 LaTeX Rendering

Equation Workspace and Parameter Explorer both need LaTeX. Options:
- **KaTeX** (recommended): Fast, lightweight (~200KB), renders to HTML/MathML. Already standard in React math apps.
- **MathJax**: More complete but heavier (~500KB+). Overkill for our needs.

Add KaTeX as a project dependency. Create a shared `<MathDisplay>` component that wraps `katex.renderToString()` for use across both primitives.

### 4.3 Formula Evaluation

Parameter Explorer needs to evaluate formulas at runtime (slider values → output). Options:
- **math.js** `evaluate()`: Full expression parser, handles sin/cos/log/etc. Heavier dependency.
- **Custom parser** (like FunctionMachine's `evaluateRule`): Lighter but limited — FunctionMachine's version only handles basic arithmetic + exponents.
- **Recommendation:** Use `math.js` for Parameter Explorer. The formula complexity (trig, log, multi-variable) exceeds what a simple parser handles safely.

### 4.4 Spline Interpolation (Function Sketch)

For sketch mode, student-placed control points need smooth curve interpolation. Options:
- **Catmull-Rom spline**: Simple, passes through all control points, well-understood. Recommended.
- **Bezier curves**: More control but students would need to place control *handles*, adding UX complexity.

### 4.5 Shared Infrastructure

All three primitives benefit from:
- `<MathDisplay>` — KaTeX wrapper component
- `<InteractiveAxes>` — shared axes rendering with labels, gridlines, and click/drag handlers (useful for both Parameter Explorer graph mode and Function Sketch)
- These can live in `lumina/primitives/visual-primitives/shared/` and be imported by each primitive

### 4.6 Gemini Schema Complexity

Per CLAUDE.md: "When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON."

- **Equation Workspace**: 3 main types (challenge, operation, step). Safe.
- **Parameter Explorer**: 3 main types (parameter, challenge, observation). Safe.
- **Function Sketch**: 4 main types (challenge, feature, curve, comparison). Borderline — keep the union challenge type flat (use optional fields per mode, not nested discriminated unions in the Gemini schema). The TypeScript types above are richer than the Gemini schema needs to be.

---

## 5. What These Primitives Are NOT

- **Not CAS tools.** Equation Workspace doesn't solve equations — Gemini pre-computes the solution path. The primitive validates student operations against that path.
- **Not graphing calculators.** Parameter Explorer and Function Sketch render specific, Gemini-chosen functions. They don't accept arbitrary user-typed expressions.
- **Not simulations.** Parameter Explorer shows formula outputs, not physics simulations. The double-slit fringe pattern is computed from Δy = λL/d, not simulated from wave equations. Domain-specific simulations remain the job of specialist primitives (InclinedPlane, etc.) or DeepDive's MiniSim block.
- **Not replacements for K-8 primitives.** EquationBuilder still teaches what equations are. FunctionMachine still teaches what functions are. NumberLine still teaches number placement. These new primitives handle the next tier of mathematical reasoning.

---

## 6. Success Criteria

The double-slit manifest sequence (DeepDive → Parameter Explorer → Equation Workspace → Function Sketch) should:

1. Generate successfully from a single manifest call with topic "double-slit experiment" and grade "Physics 11"
2. Each primitive renders with proper LaTeX, functional sliders, and working interactions
3. Each primitive scores independently and reports IRT-compatible metrics
4. The same three primitives generate valid content for at least 5 other STEM topics (Ohm's law, compound interest, projectile motion, ideal gas law, supply-demand) without code changes
5. Total generation time < 10 seconds (parallel Gemini calls)
