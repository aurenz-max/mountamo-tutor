# PRD: Math Primitives Multi-Phase Upgrade

**Status:** Nearly Complete (38/42 interactive primitives have PhaseSummaryPanel — 90%)
**Last Audit:** 2026-04-04

## Executive Summary

Lumina's math primitives suite contains **50 components** spanning K-8 mathematics. 38 of 42 interactive primitives now have `PhaseSummaryPanel` — a pedagogical pattern that decomposes a single math concept into sequential phases (identify, analyze, build) with per-phase scoring, AI tutoring at every transition, and a rich animated summary at completion. This PRD tracks the remaining 4 primitives that still need the upgrade, and documents the phase designs for all upgraded primitives.

### Why Multi-Phase Matters

Single-interaction primitives (click answer, see result) tell us **if** a student got something right but not **why** they got it right or wrong. Multi-phase primitives decompose a concept into its constituent skills, creating diagnostic checkpoints that:

1. **Reveal misconceptions early** — A student who can shade 3/5 of a bar but cannot identify that "3" is the numerator has a vocabulary gap, not a fraction understanding gap.
2. **Enable targeted AI tutoring** — Phase transitions give the AI tutor natural moments to teach, celebrate, or redirect.
3. **Produce richer evaluation data** — Per-phase scoring flows into the competency system, informing adaptive problem selection.
4. **Build confidence through momentum** — Completing Phase 1 gives students energy for Phase 2, creating a "flow state" progression.

---

## Current State Audit

### The Multi-Phase Pattern (Established Reference)

FractionBar and PlaceValueChart define the canonical multi-phase pattern:

```
Phase 1: IDENTIFY (Multiple Choice)  →  Check conceptual vocabulary
Phase 2: ANALYZE  (Multiple Choice)  →  Apply understanding to derive a value
Phase 3: BUILD    (Interactive)      →  Construct the answer hands-on
                                     →  PhaseSummaryPanel with per-phase scores
```

Each phase includes:
- Per-phase attempt tracking
- AI tutoring triggers: `[ACTIVITY_START]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[PHASE_TRANSITION]`, `[BUILD_CORRECT]`, `[BUILD_INCORRECT]`, `[ALL_COMPLETE]`, `[HINT_REQUESTED]`
- Score computation with attempt penalties
- PhaseResult data flowing to PhaseSummaryPanel

### All 50 Math Primitives — Current Phase Status

> **Audit 2026-04-04:** Suite grew from 30→50 primitives. 38/42 interactive primitives now have PhaseSummaryPanel (90%). 34 use standardized `useChallengeProgress`/`usePhaseResults` hooks; 4 use manual PhaseResult[] construction. Only 4 interactive primitives remain without PhaseSummaryPanel.

#### Fully Upgraded — PhaseSummaryPanel + Hooks + AI + Eval (34 primitives)

| # | Primitive | Grade | Interaction Model |
|---|-----------|-------|-------------------|
| 1 | AdditionSubtractionScene | K-2 | Multi-phase with hooks |
| 2 | AnalogClock | 1-3 | Multi-phase with hooks |
| 3 | BalanceScale | 3-8 | explore → identify → solve → verify |
| 4 | BaseTenBlocks | 1-4 | build → decompose → regroup → operate |
| 5 | CoinCounter | K-2 | Multi-phase with hooks |
| 6 | ComparisonBuilder | K-2 | Multi-phase with hooks |
| 7 | CountingBoard | K-1 | count → subitize → organize → countOn |
| 8 | FractionCircles | 2-5 | Multi-phase with hooks |
| 9 | FunctionMachine | 3-6 | observe → predict → discover → create |
| 10 | HundredsChart | 1-3 | Multi-phase with hooks |
| 11 | LengthLab | 1-3 | Multi-phase with hooks |
| 12 | MathFactFluency | 1-4 | Multi-phase with hooks |
| 13 | MeasurementTools | 1-5 | explore → estimate → precision → convert |
| 14 | NetFolder | 3-6 | Multi-phase with hooks (new) |
| 15 | NumberBond | K-2 | Multi-phase with hooks |
| 16 | NumberLine | 1-6 | explore → plot → operate → compare |
| 17 | NumberSequencer | K-2 | Multi-phase with hooks |
| 18 | NumberTracer | K-1 | Multi-phase with hooks |
| 19 | OrdinalLine | K-1 | Multi-phase with hooks |
| 20 | PatternBuilder | K-3 | copy → identify → create → translate |
| 21 | PercentBar | 5-7 | explore → practice → apply → complete |
| 22 | RatioTable | 5-7 | Multi-phase with hooks |
| 23 | RegroupingWorkbench | 1-4 | explore → regroup → solve → connect |
| 24 | ShapeBuilder | 2-5 | Multi-phase with hooks |
| 25 | ShapeComposer | 2-5 | Multi-phase with hooks (new) |
| 26 | ShapeSorter | K-2 | Multi-phase with hooks |
| 27 | ShapeTracer | K-2 | Multi-phase with hooks |
| 28 | SkipCountingRunner | 1-3 | watch → jump → predict → connect |
| 29 | SortingStation | K-2 | Multi-phase with hooks |
| 30 | SpatialScene | K-2 | Multi-phase with hooks (new) |
| 31 | StrategyPicker | 1-4 | Multi-phase with hooks |
| 32 | TenFrame | K-2 | build → subitize → makeTen → operate |
| 33 | ThreeDShapeExplorer | 2-5 | Multi-phase with hooks |
| 34 | TimeSequencer | 1-3 | Multi-phase with hooks |

#### PhaseSummaryPanel with Manual PhaseResult[] (4 primitives)

| # | Primitive | Grade | Notes |
|---|-----------|-------|-------|
| 35 | DoubleNumberLine | 5-7 | Manual PhaseResult[], no challenges array |
| 36 | FractionBar | 2-5 | Original reference implementation |
| 37 | PlaceValueChart | 2-5 | Original reference implementation |
| 38 | TapeDiagram | 3-6 | Manual PhaseResult[] per challenge mode |

#### Needs Upgrade — No PhaseSummaryPanel (4 primitives)

| # | Primitive | Grade | Has Eval | Has AI | Current Model |
|---|-----------|-------|----------|--------|---------------|
| 39 | AreaModel | 3-5 | Yes | No | Single interaction: fill cells |
| 40 | ArrayGrid | 2-4 | Yes | No | Single interaction: set grid |
| 41 | FactorTree | 4-6 | Yes | Yes | Single interaction: build tree |
| 42 | MultiplicationExplorer | 2-4 | Yes | Yes | Single interaction: multi-rep |

#### Out of Scope — Static Displays (8 primitives)

| # | Primitive | Grade | Notes |
|---|-----------|-------|-------|
| 43 | BarModel | 1-5 | Has AI tutoring, no eval |
| 44 | CoordinateGraph | 5-8 | Visualization only |
| 45 | DotPlot | 4-7 | Visualization only |
| 46 | Histogram | 5-8 | Visualization only |
| 47 | MatrixDisplay | 8+ | Visualization only |
| 48 | SlopeTriangle | 7-8 | Visualization only |
| 49 | SystemsEquationsVisualizer | 8 | Visualization only |
| 50 | TwoWayTable | 7-8 | Visualization only |

**Summary:** 38/42 interactive primitives have PhaseSummaryPanel (90%). **4 remaining** need upgrade: AreaModel, ArrayGrid, FactorTree, MultiplicationExplorer (all Tier 3 — multi-phase decomposition). 8 static displays remain out of scope.

---

## Tier System

### Tier 1: PhaseSummaryPanel Integration (8 primitives) — COMPLETE

All 8 primitives (BalanceScale, FunctionMachine, CountingBoard, MeasurementTools, DoubleNumberLine, PercentBar, TapeDiagram, RegroupingWorkbench) have PhaseSummaryPanel.

### Tier 2: Phase Progression Hardening (5 primitives) — COMPLETE

All 5 primitives (SkipCountingRunner, TenFrame, PatternBuilder, BaseTenBlocks, NumberLine) have been upgraded with standardized hooks and PhaseSummaryPanel.

### Tier 3: Multi-Phase Decomposition (7 primitives) — 3/7 COMPLETE, 4 REMAINING

Completed: FractionCircles, RatioTable, ShapeBuilder — all upgraded with multi-phase hooks.

**Remaining (4):** AreaModel, ArrayGrid, MultiplicationExplorer, FactorTree. These are single-interaction primitives that should be decomposed into natural learning phases (identify → analyze → build).

### Out of Scope: Static Displays (8 primitives)

BarModel, CoordinateGraph, SlopeTriangle, SystemsEquationsVisualizer, MatrixDisplay, DotPlot, Histogram, TwoWayTable. These serve as reference/illustration components, not interactive mastery tools. They remain as-is.

---

## Tier 1: PhaseSummaryPanel Integration (COMPLETE)

### 1.1 BalanceScale

**Current:** 4-mode system (explore, identify, solve, verify) with challenges and AI tutoring.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Explore the Scale | Interactive | Drag weights onto both sides, observe balance/imbalance | Correctly predicts which side is heavier (2/3 correct) |
| 2 | Identify the Unknown | MC | Given equation like `2x + 3 = 7`, identify what "x" represents | Selects correct interpretation on first or second attempt |
| 3 | Solve for x | Interactive | Perform inverse operations step-by-step to isolate x | Arrives at correct value within 3 attempts |
| 4 | Verify the Solution | MC + Interactive | Substitute value back and confirm balance | Confirms balance after substitution |

**PhaseSummaryPanel:**
```
Phases: ["Explore the Scale", "Identify the Unknown", "Solve for x", "Verify"]
Accent colors: [cyan, purple, emerald, amber]
Icons: [balance emoji, magnifying glass, calculator, checkmark]
```

**AI Tutoring Moments:**
- `[ACTIVITY_START]` — "We have a balance scale! Both sides must be equal."
- `[PHASE_TRANSITION]` at each boundary — contextual introduction
- `[VERIFICATION_SUCCESS]` — "It balances! x = {value} is confirmed!"

---

### 1.2 FunctionMachine

**Current:** 4-mode system (observe, predict, discover, create) with challenges.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Watch the Machine | Observation | See 3 input-output pairs animate through the machine | Student clicks "I see a pattern" (comprehension gate) |
| 2 | Predict the Output | MC / Input | Given a new input, predict what comes out | Correct output prediction within 2 attempts |
| 3 | Discover the Rule | MC | Select the rule from choices (e.g., "×3 + 1", "×2 − 1") | Identifies correct function rule |
| 4 | Create Your Own | Interactive | Set a rule and test inputs, verifying outputs | Generates 3 valid input-output pairs for a new rule |

**PhaseSummaryPanel:**
```
Phases: ["Watch the Machine", "Predict the Output", "Discover the Rule", "Create Your Own"]
Accent colors: [cyan, amber, purple, emerald]
Icons: [gear, crystal ball, magnifier, wrench]
```

---

### 1.3 CountingBoard

**Current:** 4-type challenge system (count, subitize, organize, countOn).

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Count the Objects | Interactive | Tap each object one at a time with 1:1 correspondence | Final count matches target |
| 2 | Quick Look (Subitize) | Timed MC | Flash dot arrangement for 2 seconds, identify quantity | Correct quantity within time limit |
| 3 | Organize to Count | Interactive | Drag scattered objects into groups/lines for easier counting | Correct count after organizing |
| 4 | Count On | Interactive | Start from a given number, count on by adding more objects | Correct final count |

**PhaseSummaryPanel:**
```
Phases: ["Count Them All", "Quick Look", "Organize to Count", "Count On"]
Accent colors: [blue, pink, emerald, orange]
Icons: [pointing finger, eye, grid, plus]
```

---

### 1.4 MeasurementTools

**Current:** 4-mode system (explore, estimate, precision, convert).

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Explore the Tool | Interactive | Free exploration — measure objects, read scales | Accurately reads 2 measurements |
| 2 | Estimate First | MC | Estimate a measurement before using the tool | Estimate within 20% of actual |
| 3 | Measure with Precision | Interactive | Align tool correctly, read exact value, record | Measurement within ±1 unit |
| 4 | Convert | MC / Input | Convert between units (cm→m, mL→L, etc.) | Correct conversion |

**PhaseSummaryPanel:**
```
Phases: ["Explore the Tool", "Estimate First", "Measure Precisely", "Convert Units"]
Accent colors: [cyan, amber, purple, emerald]
Icons: [ruler, thinking face, bullseye, arrows]
```

---

### 1.5 DoubleNumberLine

**Current:** 3-mode system (explore, practice, apply).

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Explore the Lines | Interactive | Place given pairs on both lines, see the proportional alignment | 2 correct placements |
| 2 | Find Missing Values | Input | Given one value on top line, find corresponding value on bottom line | Correct ratio application |
| 3 | Solve the Problem | Input + MC | Use the double number line to answer a real-world ratio/rate problem | Correct final answer |

**PhaseSummaryPanel:**
```
Phases: ["Explore the Lines", "Find Missing Values", "Solve the Problem"]
Accent colors: [cyan, purple, emerald]
Icons: [parallel lines, magnifier, star]
```

---

### 1.6 PercentBar

**Current:** 4-mode system (explore, practice, apply, completed).

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Explore Percent | Interactive | Drag slider to see how percentage maps to shaded area and values | Drag to 3 prompted values |
| 2 | Find the Percent | MC / Input | Given part and whole, identify the percent | Correct percentage within 2 attempts |
| 3 | Apply to a Problem | Input | "If a $80 jacket is 25% off, what is the sale price?" | Correct real-world calculation |

**PhaseSummaryPanel:**
```
Phases: ["Explore Percent", "Find the Percent", "Apply to a Problem"]
Accent colors: [cyan, purple, emerald]
Icons: [bar chart, percent, shopping cart]
```

---

### 1.7 TapeDiagram

**Current:** 3-mode system (explore, practice, apply).

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Read the Diagram | MC | Identify what each tape section represents in the word problem | Correct identification |
| 2 | Set Up the Equation | Interactive | Label tape segments with values from the problem | All labels correct |
| 3 | Solve It | Input | Use the diagram to compute the missing value | Correct numerical answer |

**PhaseSummaryPanel:**
```
Phases: ["Read the Diagram", "Set Up the Equation", "Solve It"]
Accent colors: [cyan, amber, emerald]
Icons: [tape, pencil, checkmark]
```

---

### 1.8 RegroupingWorkbench

**Current:** 4-mode system (explore, regroup, solve, connect) with AI tutoring.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Build the Numbers | Interactive | Place base-ten blocks to represent both numbers | Both numbers correctly constructed |
| 2 | Regroup | Interactive | Exchange 10 ones for 1 ten (or borrow), physically moving blocks | Correct regrouping action |
| 3 | Solve Step-by-Step | Interactive | Combine/separate blocks column-by-column with written algorithm | Correct answer column-by-column |
| 4 | Connect to Algorithm | MC | Match block actions to written algorithm steps | Correct matching |

**PhaseSummaryPanel:**
```
Phases: ["Build the Numbers", "Regroup", "Solve Step-by-Step", "Connect to Algorithm"]
Accent colors: [blue, amber, emerald, purple]
Icons: [blocks, exchange, calculator, link]
```

---

## Tier 2: Phase Progression Hardening (COMPLETE)

All Tier 2 primitives have been upgraded with standardized hooks (`useChallengeProgress`, `usePhaseResults`) and PhaseSummaryPanel. The phase designs below document the implemented progressions.

### 2.1 SkipCountingRunner

**Status:** COMPLETE — upgraded with full hooks and PhaseSummaryPanel.

**Phase Redesign:**

The existing challenge types already map to a natural learning progression:

| Phase | Name | Maps To | What Student Does | Mastery Signal |
|-------|------|---------|-------------------|----------------|
| 1 | Count Along | `count_along` | Watch/tap as character jumps by N | Complete the full count sequence |
| 2 | Predict the Landing | `predict` | Guess where the next jump lands | 2/3 correct predictions |
| 3 | Fill the Gaps | `fill_missing` | Fill in missing values from a partial sequence | All hidden values found |
| 4 | Connect to Multiplication | `connect_multiplication` | Write the multiplication fact | Correct equation |

---

### 2.2 TenFrame

**Status:** COMPLETE — upgraded with full hooks and PhaseSummaryPanel.

**Phase Redesign:**

| Phase | Name | What Student Does | Mastery Signal |
|-------|------|-------------------|----------------|
| 1 | Build It | Place counters on the frame to match a target number | Correct count placed |
| 2 | Quick Flash (Subitize) | Flash a filled frame, student identifies count without counting | Correct identification in < 3 sec |
| 3 | Make Ten | Add counters to reach exactly 10 | Correct complement identified |
| 4 | Operate | Use frames to add/subtract (e.g., 7 + 5 via make-ten strategy) | Correct operation result |

---

### 2.3 PatternBuilder

**Status:** COMPLETE — upgraded with full hooks and PhaseSummaryPanel.

**Phase Redesign:**

| Phase | Name | What Student Does | Mastery Signal |
|-------|------|-------------------|----------------|
| 1 | Copy the Pattern | Reproduce a given pattern using tiles | Exact match |
| 2 | Extend the Pattern | Add the next 3 elements to continue a pattern | All 3 correct |
| 3 | Find the Rule | MC — identify the pattern rule (e.g., "AB AB" or "+3") | Correct rule selected |
| 4 | Create Your Own | Build a pattern following a given rule | Valid pattern with 2+ repetitions |

---

### 2.4 BaseTenBlocks

**Status:** COMPLETE — upgraded with full hooks and PhaseSummaryPanel.

**Phase Redesign:**

| Phase | Name | What Student Does | Mastery Signal |
|-------|------|-------------------|----------------|
| 1 | Build the Number | Place hundreds, tens, ones blocks to represent a number | Correct representation |
| 2 | Decompose | Break a number into expanded form using blocks | All place values correct |
| 3 | Regroup | Exchange 10 ones → 1 ten, 10 tens → 1 hundred | Correct exchange |
| 4 | Operate | Add or subtract using block manipulation | Correct result |

---

### 2.5 NumberLine

**Status:** COMPLETE — upgraded with full hooks and PhaseSummaryPanel.

**Phase Redesign:**

| Phase | Name | What Student Does | Mastery Signal |
|-------|------|-------------------|----------------|
| 1 | Read the Line | MC — Identify what number a marked point represents | Correct identification |
| 2 | Plot It | Place a given number at the correct position | Within tolerance |
| 3 | Jump Operations | Perform addition/subtraction by jumping on the line | Correct result and landing |

---

## Tier 3: Multi-Phase Decomposition (3/7 COMPLETE, 4 REMAINING)

Completed: FractionCircles, RatioTable, ShapeBuilder. Remaining: AreaModel, ArrayGrid, MultiplicationExplorer, FactorTree.

### 3.1 FractionCircles — COMPLETE

**Status:** Upgraded with multi-phase hooks and PhaseSummaryPanel.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Identify the Parts | MC | "This circle is divided into 6 equal parts. How many are shaded?" | Correct count |
| 2 | Name the Fraction | MC | "What fraction does this represent?" with visual showing shaded circle | Correct fraction selected |
| 3 | Build the Fraction | Interactive | Given a target fraction, shade the correct number of sectors | Correct sectors shaded |

**Generator update:** `gemini-fraction-circles.ts` must produce `numeratorChoices`, `denominatorChoices` (like FractionBar), and pre-shade some sectors for Phase 1 visual reference.

---

### 3.2 AreaModel

**Current:** Single interaction — fill cells and sum total.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Identify the Dimensions | MC | "This rectangle is ___ units wide and ___ units tall" | Correct dimensions |
| 2 | Fill the Grid | Interactive | Click/shade cells to fill the area model | All cells filled |
| 3 | Calculate the Area | Input | "What is the total area?" (product of dimensions) | Correct product |

**Pedagogical value:** Separating dimension identification from area calculation reveals whether errors come from reading the model vs. computing the product.

---

### 3.3 ArrayGrid

**Current:** Single interaction — set rows/cols, compute total.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Identify the Array | MC | "How many rows? How many columns?" | Both correct |
| 2 | Count by Groups | MC | "Each row has ___ items. There are ___ rows. Count by groups: 4, 8, 12..." | Correct skip-counting sequence |
| 3 | Write the Equation | Input | Express as multiplication: ___ × ___ = ___ | Correct equation |

---

### 3.4 MultiplicationExplorer

**Current:** Multi-representation view (groups, array, number line, area model) with a single answer input.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | See the Groups | Observation + MC | View equal groups visualization, answer "How many groups of ___?" | Correct group identification |
| 2 | Build the Array | Interactive | Arrange dots into rows × columns matching the problem | Correct array dimensions |
| 3 | Jump on the Line | Interactive | Make equal jumps on a number line to reach the product | Correct landing |
| 4 | Write the Fact | Input | Write the complete multiplication sentence | Correct equation |

---

### 3.5 FactorTree

**Current:** Single interaction — build a factor tree by splitting composites.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Is It Prime? | MC | Determine whether the starting number is prime or composite | Correct classification |
| 2 | Find a Factor Pair | MC | Select two factors that multiply to the number | Correct factor pair |
| 3 | Complete the Tree | Interactive | Continue splitting until all leaves are prime | All leaves are prime factors |

---

### 3.6 RatioTable — COMPLETE

**Status:** Upgraded with multi-phase hooks and PhaseSummaryPanel.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Identify the Ratio | MC | "For every ___ red there are ___ blue" — identify the base ratio | Correct ratio identification |
| 2 | Complete the Table | Input | Fill in missing values in the ratio table using multiplication | All cells correct |
| 3 | Apply the Ratio | Input | Solve a word problem using the ratio (e.g., "If you need 15 red, how many blue?") | Correct application |

---

### 3.7 ShapeBuilder — COMPLETE

**Status:** Upgraded with multi-phase hooks and PhaseSummaryPanel.

**Phase Design:**

| Phase | Name | Type | What Student Does | Mastery Signal |
|-------|------|------|-------------------|----------------|
| 1 | Identify the Shape | MC | "What shape has 4 equal sides and 4 right angles?" | Correct shape name |
| 2 | Find the Properties | MC (multi-select) | Select all properties that apply (parallel sides, right angles, equal sides) | All correct properties selected |
| 3 | Build the Shape | Interactive | Draw/construct the shape on the grid | Shape matches target within tolerance |

---

## Implementation Plan

### Tier 1 — COMPLETE

All 8 primitives upgraded with PhaseSummaryPanel.

### Tier 2 — COMPLETE

All 5 primitives upgraded with standardized hooks and PhaseSummaryPanel.

### Tier 3 — Remaining Work (4 primitives)

3 of 7 Tier 3 primitives are complete (FractionCircles, RatioTable, ShapeBuilder). The remaining 4 require full multi-phase decomposition — adding entirely new phases to currently single-step interactions.

**Per-primitive work:**

1. Design 3-phase UI with phase progress indicator
2. Add MC choice generation for identification phases
3. Implement phase state machine with transitions using `useChallengeProgress`/`usePhaseResults`
4. Add AI tutoring hooks at all pedagogical moments
5. Implement evaluation metrics with per-phase scoring
6. Render PhaseSummaryPanel

**Generator updates required:**
- `gemini-area-model.ts` — add `dimensionChoices`, `areaChoices`
- `gemini-array-grid.ts` — add `rowChoices`, `columnChoices`, `productChoices`
- `gemini-multiplication-explorer.ts` — add `groupChoices`, `factChoices`
- `gemini-factor-tree.ts` — add `primeClassificationChoices`, `factorPairChoices`

**Order of implementation:**
1. AreaModel — high impact for multiplication understanding
2. ArrayGrid — pairs with AreaModel conceptually
3. FactorTree — decomposition is naturally multi-phase
4. MultiplicationExplorer — 4-phase multi-representation

---

## Evaluation Metrics Updates

### New Base Fields for All Multi-Phase Primitives

Add to each primitive's metrics interface:

```typescript
// Phase-level tracking (added to existing metrics types)
allPhasesCompleted: boolean;
phaseScores: {
  phase: string;
  score: number;
  attempts: number;
  firstTry: boolean;
  hintsUsed: number;
}[];
totalPhases: number;
completedPhases: number;
```

### PhaseResult Mapping Convention

Every multi-phase primitive must export a `computePhaseResults()` function (or useMemo) that converts its internal state to `PhaseResult[]` for the PhaseSummaryPanel.

```typescript
// Standard pattern (from FractionBar reference)
const phaseSummaryData = useMemo((): PhaseResult[] => {
  if (!hasSubmittedEvaluation) return [];
  return [
    {
      label: 'Phase 1 Name',
      score: computePhaseScore(phase1Attempts, PENALTY),
      attempts: phase1Attempts,
      firstTry: phase1Attempts === 1,
      icon: '🔍',
      accentColor: 'purple',
    },
    // ... more phases
  ];
}, [hasSubmittedEvaluation, /* phase attempt states */]);
```

---

## AI Tutoring Integration Standard

Every multi-phase primitive MUST fire these AI tutoring events:

| Event | When | Purpose |
|-------|------|---------|
| `[ACTIVITY_START]` | Component mount + AI connected | Warm introduction to the activity |
| `[ANSWER_CORRECT]` | Student answers MC phase correctly | Brief celebration + reinforce concept |
| `[ANSWER_INCORRECT]` | Student answers MC phase incorrectly | Gentle redirect without giving answer |
| `[PHASE_TRANSITION]` | Moving from phase N to phase N+1 | Bridge concepts, build anticipation |
| `[BUILD_CORRECT]` | Interactive build phase completed correctly | Celebrate construction |
| `[BUILD_INCORRECT]` | Interactive build phase submitted incorrectly | Diagnostic coaching |
| `[ALL_COMPLETE]` | All phases done, evaluation submitted | Performance-aware summary |
| `[HINT_REQUESTED]` | Student clicks hint button | Phase-appropriate scaffolding |

---

## Success Criteria

### Quantitative
- 38/42 interactive primitives have PhaseSummaryPanel (90% — 4 remaining)
- Per-phase scoring data flows to the competency system
- AI tutoring fires at every phase transition

### Qualitative
- Phase decompositions feel natural, not forced — each phase teaches a distinct sub-skill
- The celebration moment (PhaseSummaryPanel reveal) feels earned, not gratuitous
- Static display primitives are NOT touched (no scope creep)

---

## Appendix A: Files Touched Per Primitive (Tier 1 Example)

Using BalanceScale as the template:

| File | Change |
|------|--------|
| `primitives/visual-primitives/math/BalanceScale.tsx` | Import PhaseSummaryPanel, add PhaseResult computation, render panel |
| `evaluation/types.ts` | Add `allPhasesCompleted`, `phaseScores` to BalanceScaleMetrics |
| `service/math/gemini-balance-scale.ts` | Ensure MC choices generated for identification phase |

Tier 2 and 3 additionally touch:
| `service/math/gemini-{primitive}.ts` | Add MC choice generation |
| `service/manifest/catalog/math.ts` | Update component description if phase model changes capabilities |

## Appendix B: Out-of-Scope Primitives

These 8 static-display primitives are explicitly excluded:

| Primitive | Reason |
|-----------|--------|
| BarModel | Pure visualization — used as illustration within lessons, not as mastery tool |
| CoordinateGraph | Graphing utility — multi-phase could work but serves different pedagogical purpose |
| SlopeTriangle | Visualization overlay — not a standalone mastery activity |
| SystemsEquationsVisualizer | Display of algebraic/graphical solutions |
| MatrixDisplay | Display/editor for linear algebra |
| DotPlot | Statistical data display |
| Histogram | Statistical data display |
| TwoWayTable | Statistical data display |

These could receive interactive upgrades in a future "Data & Statistics Multi-Phase" PRD, but that is a separate concern from the core arithmetic/algebraic primitives addressed here.
