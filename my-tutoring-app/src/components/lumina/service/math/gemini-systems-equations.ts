import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Data Types (single source of truth for SystemsEquationsVisualizer.tsx)
// ---------------------------------------------------------------------------

export type SystemsEquationsChallengeType =
  | 'graph'
  | 'substitution'
  | 'elimination';

export interface SystemEquation {
  /** Display string the student reads (e.g. "y = 2x - 1" or "3x + y = 5"). */
  display: string;
  /** Slope of the line in y = m·x + b form. Used by the canvas evaluator. */
  slope: number;
  /** y-intercept of the line in y = m·x + b form. */
  yIntercept: number;
  /** Standard-form coefficients (only present when systemForm === 'standard'). */
  a?: number;
  b?: number;
  c?: number;
  color?: string;
  label?: string;
}

export interface SystemsEquationsChallenge {
  id: string;
  type: SystemsEquationsChallengeType;
  /** 'slope-intercept' for graph/substitution; 'standard' for elimination. */
  systemForm: 'slope-intercept' | 'standard';
  equationA: SystemEquation;
  equationB: SystemEquation;
  /** Pre-computed integer solution. Submit-time scoring compares to these. */
  expectedX: number;
  expectedY: number;
  instruction: string;
  hint: string;

  // ── Within-mode support-tier scaffolds (set ONLY when a tier is present). ──
  // Display-only: the checker always compares to expectedX/expectedY, never to
  // any of these flags. A tier withdraws solving help; it NEVER changes the
  // coefficients, the system, or the answer.
  /**
   * Show a FUZZY translucent region around the lines' crossing (a "look here"
   * self-check cue). NEVER the exact point and NEVER its coordinates — the
   * intersection IS the (x, y) answer on every mode here, so the precise marker
   * stays withdrawn at every tier. Easy only.
   */
  showIntersectionRegion?: boolean;
  /** Show numbered axis tick labels (perception aid). Withdrawn at hard. */
  showAxisLabels?: boolean;
  /** Show the method/inverse-op step hint open by default (vs. on-demand only). */
  showStepHint?: boolean;
  /** Coordinate-free method hint (set with the tier). Auto-shown at easy; never the answer. */
  stepHint?: string;
}

export interface SystemsEquationsVisualizerData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showGrid?: boolean;
  showAxes?: boolean;
  gradeBand?: '7-8' | 'algebra-1' | 'algebra-2';
  /**
   * Within-mode support tier ('easy' | 'medium' | 'hard'), present only when the
   * manifest emitted one. Tells the live tutor how much solving help to reveal.
   * NEVER changes the system or the answer.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** 3-6 challenges per session. Required. Built in-generator from the pool service. */
  challenges: SystemsEquationsChallenge[];
}

// ---------------------------------------------------------------------------
// Challenge type docs
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  graph: {
    promptDoc:
      `"graph": Grade 8 / Algebra-1 intro. Two lines are drawn on the same coordinate plane. `
      + `The student reads the intersection point off the graph and types (x, y). Integer slopes (m ∈ {±1, ±2, ±3}), `
      + `integer intersection points in [-5, 5]. Equations rendered in slope-intercept form (y = m·x + b).`,
    schemaDescription: "'graph' (read intersection from a drawn system)",
  },
  substitution: {
    promptDoc:
      `"substitution": Algebra-1. Two equations in slope-intercept form. The student solves algebraically by setting `
      + `m₁x + b₁ = m₂x + b₂ (since both are solved for y already) and types (x, y). Integer solutions; mix of integer `
      + `and small-fraction slopes (m ∈ {±1, ±2, ±3, ±1/2}).`,
    schemaDescription: "'substitution' (solve algebraically; equations in y = m·x + b form)",
  },
  elimination: {
    promptDoc:
      `"elimination": Algebra-1 / Algebra-2. Two equations in standard form (a·x + b·y = c) with small integer `
      + `coefficients. The student multiplies / adds to eliminate one variable, then types (x, y). Integer solutions; `
      + `coefficients chosen so addition or simple scaling clears one variable.`,
    schemaDescription: "'elimination' (solve via add / scale; equations in a·x + b·y = c form)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier — fixed harness.
// targetEvalMode = WHICH method (task identity); difficulty = HOW MUCH solving
// help within it. The tier withdraws scaffolding ONLY; coefficient pools stay
// mode-bound and the (x, y) answer never changes.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Guardrail line shared by BOTH axes of config.difficulty. The structural axis
 * (resolveProblemShape) re-selects slopes/coefficients to change the problem's
 * SHAPE — crossing-angle subtlety (graph), fraction-clearing depth (substitution),
 * scale-operation count (elimination) — while holding the numeric band fixed:
 * slopes/coefficients stay in their small pools and the integer (x0,y0) solution
 * stays in [-4,4]. Structure changes; magnitude does not.
 */
const TIER_GUARDRAIL =
  'Numbers stay within the eval-mode + grade-band scope (slopes/coefficients in their '
  + 'small pools, the (x, y) solution integer in [-4, 4]). This tier changes the problem '
  + 'STRUCTURE — how subtle the crossing angle is (graph), how many fractions must be '
  + 'cleared (substitution), how many scale steps align a column (elimination) — and how '
  + 'much on-screen help is shown, NOT the magnitude. Never just make the numbers bigger.';

// ---------------------------------------------------------------------------
// Support-tier scaffold — which solving helps are withdrawn (per pinned mode).
// ANSWER-LEAK GUARD: the lines' intersection IS the asked (x, y) answer on every
// mode here, so the EXACT intersection marker / its coordinates are NEVER shown
// at any tier (pre-answer). Easy gets only a FUZZY region cue (no coordinates),
// step hints, and axis labels; hard withdraws all three. The checker reads
// expectedX/expectedY directly and is independent of every flag below.
// ---------------------------------------------------------------------------

interface SupportScaffold {
  /** Easy-only fuzzy crossing-region cue (NEVER the exact point or coordinates). */
  showIntersectionRegion: boolean;
  /** Numbered axis tick labels (perception aid). */
  showAxisLabels: boolean;
  /** Open the (coordinate-free) method / inverse-op step hint by default. */
  showStepHint: boolean;
  promptLines: string[];
}

/** Method-only step hint — describes the SOLVING STEPS, never the (x, y) answer.
 *  Safe to auto-open at the easy tier (the on-demand `hint` keeps the numbers). */
function stepHintFor(type: SystemsEquationsChallengeType): string {
  switch (type) {
    case 'graph':
      return 'Trace each line carefully. The solution is the single point that lies on BOTH lines — read its x first, then its y.';
    case 'substitution':
      return 'Both equations are solved for y, so set the two right-hand sides equal. Use inverse operations to isolate x, then substitute x back into either equation to find y.';
    case 'elimination':
      return 'Scale one (or both) equations so a variable\'s coefficients become opposites, add the equations to cancel that variable, solve for what remains, then back-substitute.';
  }
}

function resolveSupportStructure(
  pinnedType: SystemsEquationsChallengeType,
  tier: SupportTier,
): SupportScaffold {
  const lead =
    'This part of the tier changes how much solving help the student gets on screen. The exact '
    + 'intersection point is the answer, so it is NEVER marked or its coordinates shown before the '
    + 'student solves. ' + TIER_GUARDRAIL;

  // Easy = self-check workspace (region cue + step hints + axis labels).
  // Medium = lines + gridlines + axis labels, no region cue, no auto hint.
  // Hard = bare graph / equations, student works unaided.
  const showIntersectionRegion = tier === 'easy';
  const showAxisLabels = tier !== 'hard';
  const showStepHint = tier === 'easy';

  const methodWord =
    pinnedType === 'graph' ? 'reading the crossing point off the graph'
    : pinnedType === 'substitution' ? 'setting the two y-expressions equal and using inverse operations'
    : 'scaling/adding the equations to eliminate a variable';

  return {
    showIntersectionRegion,
    showAxisLabels,
    showStepHint,
    promptLines: [
      lead,
      `A FUZZY region near where the lines cross is ${showIntersectionRegion ? 'highlighted as a "look here" self-check cue (no exact point, no coordinates)' : 'withdrawn — no crossing cue at all'}.`,
      `Axis tick labels are ${showAxisLabels ? 'shown' : 'withdrawn — the student reads the bare grid'}.`,
      `A ${methodWord} step hint is ${showStepHint ? 'open by default to guide the method' : 'available only on demand (or withdrawn at hard)'}.`,
      'Keep the title and description neutral — never state the support level, the method steps, or any solution.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty — the SECOND axis of config.difficulty.
//
// Distinct from the scaffolding above ("how much help?"), this makes the
// generated PROBLEM genuinely harder per tier — but STRUCTURALLY, never by
// inflating magnitude and never by crossing into another eval mode (the eval
// mode IS the solution method = task identity). Each method has its own in-mode
// SHAPE lever, with the numeric band held fixed (slopes/coefficients in their
// small pools, the integer (x0,y0) solution in [-4,4]):
//
//   graph        → CROSSING-ANGLE subtlety: the angular separation of the slope
//                  PAIR. easy = wide angle (steep, opposite-sign slopes) crossing
//                  unambiguously; medium = moderate separation; hard = near-parallel
//                  pair crossing at a shallow angle (visually ambiguous lattice read).
//                  Magnitude band (slope set, intercepts) unchanged. CCSS 8.EE.C.8.
//   substitution → FRACTION-CLEARING depth in the set-equal/isolate-x step:
//                  easy = both slopes integer (no fraction to clear); medium = one
//                  fractional slope (clear one fraction); hard = both slopes fractional
//                  with differing denominators (common-denominator clear). A-REI.C.6.
//   elimination  → SCALE-OPERATION COUNT to align a column (the flagship lever,
//                  mirrors the regrouping-event-count pilot): easy = 0 scalings (a
//                  column already shares a ±1 / matching coefficient → direct add/sub
//                  cancels), medium = 1 scaling (one equation ×k), hard = 2 scalings
//                  (neither column shares a factor → both scaled to the LCM). A-REI.C.5.
//
// FLOOR (mode identity, never below): graph stays a non-parallel integer-lattice
// crossing; substitution stays two y=mx+b equations with integer solution; elimination
// easy STILL requires the cancel step (count>=0 add, never pre-solved into a different
// method). CAP (stay in band): slopes ∈ {±1,±2,±3,±1/2,±3/2}; coefficients a,b ∈
// {±1,±2,±3}; (x0,y0) integer in [-4,4]; |b|<=9, |c|<=18.
//
// The exact shape is ENFORCED in code (constructive slope/coefficient builders),
// not left to the LLM — the LLM writes only the wrapper title/description here, so
// this axis is fully code-owned. The (x0,y0) answer is INDEPENDENT of every lever,
// so correctAnswer auto-recomputes. See memory [[structural-difficulty-not-numeric]]
// / [[feedback_llm-window-code-builds-structure]] / the regrouping-workbench pilot.
// ---------------------------------------------------------------------------

/** Crossing-angle band for graph mode (wide=easy read … shallow=hard read). */
type CrossingAngle = 'wide' | 'moderate' | 'shallow';

interface ProblemShape {
  /** graph: which angular-separation band the slope PAIR must fall in. */
  crossingAngle: CrossingAngle;
  /** substitution: how many fractional slopes the set-equal step must clear (0/1/2). */
  fractionDepth: 0 | 1 | 2;
  /** elimination: exact # of scale operations needed to align a column (0/1/2). */
  scaleCount: 0 | 1 | 2;
  /** Prompt lines describing the structural intent (code still enforces it). */
  promptLines: string[];
}

/**
 * Resolve the in-mode structural lever for one tier. Clamps every lever to its
 * [floor, cap] band INSIDE here — this is the single source of truth consumed by
 * both the prompt (soft) and the constructive builders (hard). For graph (a
 * curated blend with no single mode) the pinnedType decides the lever; the
 * builders below honor only the lever for the challenge's OWN type.
 */
function resolveProblemShape(mode: SystemsEquationsChallengeType, tier: SupportTier): ProblemShape {
  if (mode === 'graph') {
    const crossingAngle: CrossingAngle =
      tier === 'easy' ? 'wide' : tier === 'medium' ? 'moderate' : 'shallow';
    return {
      crossingAngle,
      fractionDepth: 0,
      scaleCount: 0,
      promptLines: [
        crossingAngle === 'wide'
          ? 'PROBLEM SHAPE: the two lines cross at a WIDE angle — a steep, well-separated slope pair (e.g. +2 and -2, or +3 and -1) meeting on a central lattice point. The intersection is unambiguous to read off the grid.'
          : crossingAngle === 'moderate'
            ? 'PROBLEM SHAPE: the two lines cross at a MODERATE angle — slopes are more similar (e.g. +2 and +1, or +1 and -1/2). The crossing is still a clean lattice point but the eye must trace more carefully.'
            : 'PROBLEM SHAPE: the two lines cross at a SHALLOW angle — a NEAR-parallel slope pair (e.g. +1/2 and +1, or +2 and +3) so the lattice crossing is visually subtle. The lines must still be non-parallel and cross at an integer lattice point — the magnitude band is unchanged.',
      ],
    };
  }

  if (mode === 'substitution') {
    const fractionDepth: 0 | 1 | 2 = tier === 'easy' ? 0 : tier === 'medium' ? 1 : 2;
    return {
      crossingAngle: 'moderate',
      fractionDepth,
      scaleCount: 0,
      promptLines: [
        fractionDepth === 0
          ? 'PROBLEM SHAPE: both slopes are INTEGER, so setting the two y-expressions equal isolates x in a single step with no fraction to clear.'
          : fractionDepth === 1
            ? 'PROBLEM SHAPE: exactly ONE slope is fractional (m ∈ {±1/2}), so the set-equal step introduces ONE fraction the student must clear before isolating x.'
            : 'PROBLEM SHAPE: BOTH slopes are fractional with DIFFERING denominators (e.g. +1/2 and +3/2), so the set-equal step needs a common-denominator clear before isolating x — the deepest inverse-op chain. The (x, y) solution stays integer; the magnitude band is unchanged.',
      ],
    };
  }

  // elimination — the flagship scale-operation-COUNT lever.
  const scaleCount: 0 | 1 | 2 = tier === 'easy' ? 0 : tier === 'medium' ? 1 : 2;
  return {
    crossingAngle: 'moderate',
    fractionDepth: 0,
    scaleCount,
    promptLines: [
      scaleCount === 0
        ? 'PROBLEM SHAPE: ZERO scalings — a column already matches (a shared or ±1 coefficient), so adding/subtracting the two equations directly cancels a variable. The cancel step is still real (never pre-solved).'
        : scaleCount === 1
          ? 'PROBLEM SHAPE: ONE scaling — one column shares a factor, so exactly ONE equation is multiplied by a single integer to make the column align before adding.'
          : 'PROBLEM SHAPE: TWO scalings — neither column shares a factor, so BOTH equations are scaled to the LCM of a column before adding (e.g. 2x.. and 3x.. → ×3 and ×2). The coefficients stay in {±1,±2,±3}; the magnitude band is unchanged.',
    ],
  };
}

// --- Constructive structural builders (code-enforced shape levers) ----------
// The LLM writes ONLY the wrapper here, so these builders OWN the per-challenge
// shape. Each returns a fully-built challenge that hits the EXACT structural
// target while staying in band, with the (x0,y0) answer recomputed from the new
// values. Solvability invariants: non-parallel lines, integer y-intercepts,
// integer (x0,y0) ∈ [-4,4], elimination determinant ≠ 0.

const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
};
const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/** Angular "steepness gap" of a slope pair — larger ⇒ wider crossing angle. */
function angleGap(mA: number, mB: number): number {
  return Math.abs(Math.atan(mA) - Math.atan(mB));
}

/** Slope pools by crossing-angle band (rise/run pairs). Magnitudes stay in the
 *  band {±1,±2,±3,±1/2}; only the PAIR's separation changes per band. */
const GRAPH_SLOPE_VALUES: number[] = [3, 2, 1, 0.5, -0.5, -1, -2, -3];

/** Pick a slope PAIR whose angular separation lands in the requested band. */
function pickGraphSlopePair(band: CrossingAngle): [number, number] {
  // Thresholds on the atan-gap: wide >= ~1.4 rad, shallow <= ~0.5 rad, else moderate.
  const candidates: Array<[number, number]> = [];
  for (let i = 0; i < GRAPH_SLOPE_VALUES.length; i++) {
    for (let j = 0; j < GRAPH_SLOPE_VALUES.length; j++) {
      if (i === j) continue;
      const mA = GRAPH_SLOPE_VALUES[i];
      const mB = GRAPH_SLOPE_VALUES[j];
      if (mA === mB) continue; // parallel
      const gap = angleGap(mA, mB);
      const ok =
        band === 'wide' ? gap >= 1.3
        : band === 'shallow' ? gap > 0 && gap <= 0.45
        : gap > 0.45 && gap < 1.3;
      if (ok) candidates.push([mA, mB]);
    }
  }
  if (candidates.length === 0) {
    // Saturation fallback — should not happen with the pool above, but stay safe.
    return band === 'wide' ? [2, -2] : band === 'shallow' ? [0.5, 1] : [2, 1];
  }
  return candidates[randInt(0, candidates.length - 1)];
}

/** Pick a slope PAIR with the requested # of fractional (half) slopes, distinct,
 *  non-parallel. fractionDepth 2 forces DIFFERING denominators conceptually by
 *  pairing a half-slope with an integer-or-other-half so the set-equal clear needs
 *  a common denominator (½ vs an integer, or ½ vs 3/2 — both half-family). */
const SUB_INT_SLOPES: number[] = [3, 2, 1, -1, -2, -3];
const SUB_HALF_SLOPES: number[] = [0.5, -0.5, 1.5, -1.5];

function pickSubstitutionSlopePair(depth: 0 | 1 | 2): [number, number] {
  for (let attempt = 0; attempt < 200; attempt++) {
    let mA: number, mB: number;
    if (depth === 0) {
      mA = SUB_INT_SLOPES[randInt(0, SUB_INT_SLOPES.length - 1)];
      mB = SUB_INT_SLOPES[randInt(0, SUB_INT_SLOPES.length - 1)];
    } else if (depth === 1) {
      mA = SUB_HALF_SLOPES[randInt(0, SUB_HALF_SLOPES.length - 1)];
      mB = SUB_INT_SLOPES[randInt(0, SUB_INT_SLOPES.length - 1)];
      if (Math.random() < 0.5) [mA, mB] = [mB, mA];
    } else {
      mA = SUB_HALF_SLOPES[randInt(0, SUB_HALF_SLOPES.length - 1)];
      mB = SUB_HALF_SLOPES[randInt(0, SUB_HALF_SLOPES.length - 1)];
    }
    if (mA === mB) continue; // parallel
    return [mA, mB];
  }
  // Saturation fallback.
  return depth === 0 ? [2, -1] : depth === 1 ? [0.5, -2] : [0.5, 1.5];
}

/** Build a slope-intercept challenge from a chosen slope pair, forcing integer
 *  y-intercepts and an integer (x0,y0) ∈ [-4,4]. When a slope is a half, x0 is
 *  constrained even so b = y0 - m·x0 stays integer. Returns null if no valid
 *  (x0,y0) exists for this pair (caller re-picks). */
function buildSlopeInterceptFromPair(
  type: SystemsEquationsChallengeType,
  slopeA: number,
  slopeB: number,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge | null {
  const halfFamily = !Number.isInteger(slopeA) || !Number.isInteger(slopeB);
  const xChoices: number[] = [];
  for (let x = -4; x <= 4; x++) {
    if (halfFamily && x % 2 !== 0) continue; // keep b integer for ±1/2, ±3/2 slopes
    xChoices.push(x);
  }
  const xs = shuffle(xChoices);
  const ys = shuffle([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
  for (const x0 of xs) {
    for (const y0 of ys) {
      const bA = y0 - slopeA * x0;
      const bB = y0 - slopeB * x0;
      if (!Number.isInteger(bA) || !Number.isInteger(bB)) continue;
      if (Math.abs(bA) > 9 || Math.abs(bB) > 9) continue;
      if (bA === bB) continue; // identical lines guard (already non-parallel)
      if (!inViewport(slopeA, bA, xRange, yRange)) continue;
      if (!inViewport(slopeB, bB, xRange, yRange)) continue;
      return {
        id: `se-${type}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
        type,
        systemForm: 'slope-intercept',
        equationA: { display: formatSlopeIntercept(slopeA, bA), slope: slopeA, yIntercept: bA, color: COLOR_A, label: 'Line A' },
        equationB: { display: formatSlopeIntercept(slopeB, bB), slope: slopeB, yIntercept: bB, color: COLOR_B, label: 'Line B' },
        expectedX: x0,
        expectedY: y0,
        instruction: instructionFor(type),
        hint: hintFor(type, x0, y0),
      };
    }
  }
  return null;
}

/** Build a graph challenge with the requested crossing-angle band. */
function buildGraphChallengeShaped(
  band: CrossingAngle,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  for (let attempt = 0; attempt < 60; attempt++) {
    const [mA, mB] = pickGraphSlopePair(band);
    const ch = buildSlopeInterceptFromPair('graph', mA, mB, xRange, yRange);
    if (ch) return ch;
  }
  return buildSlopeInterceptChallenge('graph', xRange, yRange); // safe fallback
}

/** Build a substitution challenge with the requested fraction-clearing depth. */
function buildSubstitutionChallengeShaped(
  depth: 0 | 1 | 2,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  for (let attempt = 0; attempt < 80; attempt++) {
    const [mA, mB] = pickSubstitutionSlopePair(depth);
    const ch = buildSlopeInterceptFromPair('substitution', mA, mB, xRange, yRange);
    if (ch) return ch;
  }
  return buildSlopeInterceptChallenge('substitution', xRange, yRange); // safe fallback
}

/** Count how many fractional (non-integer) slopes a slope-intercept challenge has. */
function countFractionalSlopes(ch: SystemsEquationsChallenge): number {
  return (Number.isInteger(ch.equationA.slope) ? 0 : 1) + (Number.isInteger(ch.equationB.slope) ? 0 : 1);
}

/**
 * Build an elimination challenge requiring EXACTLY `scaleCount` scale operations
 * to align a column, with an integer (x0,y0) ∈ [-4,4] solution, coefficients in
 * {±1,±2,±3}, |c|<=18, and a non-zero determinant (unique solution).
 *
 *   scaleCount 0 → one COLUMN already cancels by add/subtract directly: either a
 *                  shared coefficient (|aA|==|aB| or |bA|==|bB|) so add/sub cancels,
 *                  OR a ±1 in that column. The cancel step is still required.
 *   scaleCount 1 → one column's coefficients have a divides relation (one is a
 *                  multiple of the other, ratio != 1) → scale ONE equation by the
 *                  integer ratio. Neither already-equal nor ±1-trivial in that column.
 *   scaleCount 2 → neither column shares a factor (gcd of the column pair == 1 and
 *                  neither divides the other) → BOTH equations scaled to the LCM.
 */
function buildEliminationChallengeShaped(
  scaleCount: 0 | 1 | 2,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  const POOL = ELIM_COEF_POOL; // [-3,-2,-1,1,2,3]
  for (let attempt = 0; attempt < 400; attempt++) {
    const aA = POOL[randInt(0, POOL.length - 1)];
    const bA = POOL[randInt(0, POOL.length - 1)];
    const aB = POOL[randInt(0, POOL.length - 1)];
    const bB = POOL[randInt(0, POOL.length - 1)];
    const det = aA * bB - aB * bA;
    if (det === 0) continue; // proportional / no unique solution

    if (!eliminationScaleMatches(aA, bA, aB, bB, scaleCount)) continue;

    const x0 = randInt(-4, 4);
    const y0 = randInt(-4, 4);
    const cA = aA * x0 + bA * y0;
    const cB = aB * x0 + bB * y0;
    if (Math.abs(cA) > 18 || Math.abs(cB) > 18) continue;

    const slopeA = -aA / bA;
    const slopeB = -aB / bB;
    const yInterceptA = cA / bA;
    const yInterceptB = cB / bB;
    if (!inViewport(slopeA, yInterceptA, xRange, yRange)) continue;
    if (!inViewport(slopeB, yInterceptB, xRange, yRange)) continue;

    return {
      id: `se-elim-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
      type: 'elimination',
      systemForm: 'standard',
      equationA: { display: formatStandard(aA, bA, cA), slope: slopeA, yIntercept: yInterceptA, a: aA, b: bA, c: cA, color: COLOR_A, label: 'Eq. A' },
      equationB: { display: formatStandard(aB, bB, cB), slope: slopeB, yIntercept: yInterceptB, a: aB, b: bB, c: cB, color: COLOR_B, label: 'Eq. B' },
      expectedX: x0,
      expectedY: y0,
      instruction: instructionFor('elimination'),
      hint: hintFor('elimination', x0, y0),
    };
  }
  return buildEliminationChallenge(xRange, yRange); // safe fallback
}

/**
 * Classify the # of scale operations the EASIEST column alignment needs for an
 * (aA,bA;aB,bB) system, then test it against the target. We measure per-column:
 *   0 scalings → the column already cancels: |coefA| == |coefB| (add or subtract
 *                cancels directly), OR one of the column coefficients is ±1 AND the
 *                other is a multiple of it (×1 keeps it ±1 → still a direct cancel
 *                after at most a sign flip; counted as 0 only when |coefA|==|coefB|).
 *   1 scaling  → one coefficient is a proper multiple of the other (ratio integer
 *                != 1) → scale the smaller-bearing equation by the ratio.
 *   2 scalings → neither divides the other (need the LCM on both sides).
 * The system's scaleCount is the MINIMUM over its two columns (student aligns the
 * cheaper column). We require that MINIMUM to equal the target so the problem's
 * genuine difficulty is the target — never lower via an unintended easy column.
 */
function columnScaleCost(p: number, q: number): 0 | 1 | 2 {
  const ap = Math.abs(p), aq = Math.abs(q);
  if (ap === aq) return 0;                       // already-aligned magnitude → direct add/sub
  if (ap % aq === 0 || aq % ap === 0) return 1;  // one divides the other → one scaling
  return 2;                                       // coprime-ish → scale both to LCM
}

function eliminationScaleMatches(
  aA: number, bA: number, aB: number, bB: number, target: 0 | 1 | 2,
): boolean {
  const xCost = columnScaleCost(aA, aB);
  const yCost = columnScaleCost(bA, bB);
  const minCost = Math.min(xCost, yCost) as 0 | 1 | 2;
  return minCost === target;
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 * structural problem difficulty (resolveProblemShape) for the pinned mode. One
 * section so the LLM (which writes only the wrapper) still sees one coherent
 * "what hard means here" — though the structural lever is CODE-enforced on the
 * built challenges, not left to the LLM.
 */
function buildTierPromptSection(mode: SystemsEquationsChallengeType, tier: SupportTier): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (scaffolding + problem STRUCTURE — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Pool service (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COLOR_A = '#3b82f6'; // blue
const COLOR_B = '#10b981'; // emerald

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Slope candidate pools (as rise/run integer pairs) per mode. */
const SLOPE_POOL_BY_TYPE: Record<SystemsEquationsChallengeType, Array<[rise: number, run: number]>> = {
  graph: [
    [1, 1], [2, 1], [3, 1],
    [-1, 1], [-2, 1], [-3, 1],
    [1, 2], [-1, 2],
  ],
  substitution: [
    [1, 1], [2, 1], [3, 1],
    [-1, 1], [-2, 1], [-3, 1],
    [1, 2], [-1, 2], [3, 2], [-3, 2],
  ],
  elimination: [
    // For elimination the "slope" is derived from a/b — we pick (a, b) directly below.
    [1, 1],
  ],
};

/** Small-integer coefficient pool for elimination mode (a, b) — keeps elimination clean. */
const ELIM_COEF_POOL: number[] = [-3, -2, -1, 1, 2, 3];

function formatSlopeIntercept(slope: number, yIntercept: number): string {
  const slopeStr = slope === 1
    ? 'x'
    : slope === -1
    ? '-x'
    : Number.isInteger(slope)
    ? `${slope}x`
    : `${slope.toFixed(2).replace(/\.?0+$/, '')}x`;
  if (yIntercept === 0) return `y = ${slopeStr}`;
  if (yIntercept > 0) return `y = ${slopeStr} + ${yIntercept}`;
  return `y = ${slopeStr} - ${Math.abs(yIntercept)}`;
}

function formatStandard(a: number, b: number, c: number): string {
  // Render a·x + b·y = c with sign-aware spacing.
  const aTerm = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`;
  const bAbs = Math.abs(b);
  const bTerm = bAbs === 1 ? 'y' : `${bAbs}y`;
  const sign = b >= 0 ? '+' : '-';
  return `${aTerm} ${sign} ${bTerm} = ${c}`;
}

function instructionFor(type: SystemsEquationsChallengeType): string {
  switch (type) {
    case 'graph':
      return `Look at the two lines on the graph. Find the intersection point and enter (x, y).`;
    case 'substitution':
      return `Both equations are solved for y. Set them equal, solve for x, then find y. Enter (x, y).`;
    case 'elimination':
      return `Use elimination — add or scale equations so one variable cancels. Then solve and enter (x, y).`;
  }
}

function hintFor(type: SystemsEquationsChallengeType, x: number, y: number): string {
  switch (type) {
    case 'graph':
      return `Trace each line to where they cross. The crossing point's x-coordinate is ${x} and y-coordinate is ${y}.`;
    case 'substitution':
      return `Set m₁·x + b₁ = m₂·x + b₂. Solve for x first (you should get ${x}), then plug back to find y = ${y}.`;
    case 'elimination':
      return `Multiply one or both equations so a column matches; add or subtract to cancel that variable. The answer is (${x}, ${y}).`;
  }
}

/** Canonical key for de-duplicating challenges within a session. */
function challengeKey(spec: {
  slopeA: number; yInterceptA: number;
  slopeB: number; yInterceptB: number;
  x: number; y: number;
}): string {
  return `mA=${spec.slopeA}|bA=${spec.yInterceptA}|mB=${spec.slopeB}|bB=${spec.yInterceptB}|sol=${spec.x},${spec.y}`;
}

function inViewport(slope: number, yIntercept: number, xRange: [number, number], yRange: [number, number]): boolean {
  // Both endpoints of the line over xRange should keep some portion of the line visible.
  const yLeft = slope * xRange[0] + yIntercept;
  const yRight = slope * xRange[1] + yIntercept;
  // Reject lines that are wholly outside the y range on both ends.
  if (yLeft < yRange[0] - 2 && yRight < yRange[0] - 2) return false;
  if (yLeft > yRange[1] + 2 && yRight > yRange[1] + 2) return false;
  return true;
}

/**
 * Build one slope-intercept-form challenge: pick two distinct slopes + an integer
 * intersection (x0, y0), then back-solve y-intercepts so both lines pass through it.
 */
function buildSlopeInterceptChallenge(
  type: SystemsEquationsChallengeType,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  const slopePool = SLOPE_POOL_BY_TYPE[type];
  for (let attempt = 0; attempt < 60; attempt++) {
    // Pick distinct slope candidates.
    const [riseA, runA] = slopePool[randInt(0, slopePool.length - 1)];
    let [riseB, runB] = slopePool[randInt(0, slopePool.length - 1)];
    if (riseA * runB === riseB * runA) {
      // Parallel — pick again.
      [riseB, runB] = slopePool[(slopePool.indexOf([riseA, runA] as [number, number]) + 3) % slopePool.length];
    }
    const slopeA = riseA / runA;
    const slopeB = riseB / runB;
    if (slopeA === slopeB) continue;

    // Pick an integer intersection point in a safe interior band.
    const x0 = randInt(-4, 4);
    const y0 = randInt(-4, 4);

    // Back-solve y-intercepts: b = y0 - m·x0.
    const yInterceptA = y0 - slopeA * x0;
    const yInterceptB = y0 - slopeB * x0;

    // Need integer y-intercepts for clean equations.
    if (!Number.isInteger(yInterceptA) || !Number.isInteger(yInterceptB)) continue;
    if (Math.abs(yInterceptA) > 9 || Math.abs(yInterceptB) > 9) continue;
    if (!inViewport(slopeA, yInterceptA, xRange, yRange)) continue;
    if (!inViewport(slopeB, yInterceptB, xRange, yRange)) continue;

    return {
      id: `se-${Date.now().toString(36)}-${attempt}`,
      type,
      systemForm: 'slope-intercept',
      equationA: {
        display: formatSlopeIntercept(slopeA, yInterceptA),
        slope: slopeA,
        yIntercept: yInterceptA,
        color: COLOR_A,
        label: 'Line A',
      },
      equationB: {
        display: formatSlopeIntercept(slopeB, yInterceptB),
        slope: slopeB,
        yIntercept: yInterceptB,
        color: COLOR_B,
        label: 'Line B',
      },
      expectedX: x0,
      expectedY: y0,
      instruction: instructionFor(type),
      hint: hintFor(type, x0, y0),
    };
  }
  // Fallback — guaranteed safe pick.
  const slopeA = 2;
  const slopeB = -1;
  const x0 = 1;
  const y0 = 3;
  return {
    id: `se-fb-${Date.now().toString(36)}`,
    type,
    systemForm: 'slope-intercept',
    equationA: {
      display: formatSlopeIntercept(slopeA, y0 - slopeA * x0),
      slope: slopeA,
      yIntercept: y0 - slopeA * x0,
      color: COLOR_A,
      label: 'Line A',
    },
    equationB: {
      display: formatSlopeIntercept(slopeB, y0 - slopeB * x0),
      slope: slopeB,
      yIntercept: y0 - slopeB * x0,
      color: COLOR_B,
      label: 'Line B',
    },
    expectedX: x0,
    expectedY: y0,
    instruction: instructionFor(type),
    hint: hintFor(type, x0, y0),
  };
}

/**
 * Build one elimination-form challenge: pick small integer (a, b) coefficients for
 * both equations and an integer (x0, y0) solution; compute c = a·x0 + b·y0.
 */
function buildEliminationChallenge(
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  for (let attempt = 0; attempt < 80; attempt++) {
    const aA = ELIM_COEF_POOL[randInt(0, ELIM_COEF_POOL.length - 1)];
    let bA = ELIM_COEF_POOL[randInt(0, ELIM_COEF_POOL.length - 1)];
    if (bA === 0) bA = 1;

    const aB = ELIM_COEF_POOL[randInt(0, ELIM_COEF_POOL.length - 1)];
    let bB = ELIM_COEF_POOL[randInt(0, ELIM_COEF_POOL.length - 1)];
    if (bB === 0) bB = 1;

    // Require equations not be proportional (otherwise same line — infinite solutions).
    const det = aA * bB - aB * bA;
    if (det === 0) continue;

    const x0 = randInt(-4, 4);
    const y0 = randInt(-4, 4);
    const cA = aA * x0 + bA * y0;
    const cB = aB * x0 + bB * y0;

    // Keep right-hand sides reasonable for student arithmetic.
    if (Math.abs(cA) > 18 || Math.abs(cB) > 18) continue;

    // Compute slope-intercept equivalents for canvas drawing.
    const slopeA = -aA / bA;
    const slopeB = -aB / bB;
    const yInterceptA = cA / bA;
    const yInterceptB = cB / bB;
    if (!inViewport(slopeA, yInterceptA, xRange, yRange)) continue;
    if (!inViewport(slopeB, yInterceptB, xRange, yRange)) continue;

    return {
      id: `se-elim-${Date.now().toString(36)}-${attempt}`,
      type: 'elimination',
      systemForm: 'standard',
      equationA: {
        display: formatStandard(aA, bA, cA),
        slope: slopeA,
        yIntercept: yInterceptA,
        a: aA,
        b: bA,
        c: cA,
        color: COLOR_A,
        label: 'Eq. A',
      },
      equationB: {
        display: formatStandard(aB, bB, cB),
        slope: slopeB,
        yIntercept: yInterceptB,
        a: aB,
        b: bB,
        c: cB,
        color: COLOR_B,
        label: 'Eq. B',
      },
      expectedX: x0,
      expectedY: y0,
      instruction: instructionFor('elimination'),
      hint: hintFor('elimination', x0, y0),
    };
  }
  // Fallback — guaranteed safe (2x + y = 5, x - y = 1; solution (2, 1)).
  return {
    id: `se-elim-fb-${Date.now().toString(36)}`,
    type: 'elimination',
    systemForm: 'standard',
    equationA: {
      display: formatStandard(2, 1, 5),
      slope: -2,
      yIntercept: 5,
      a: 2, b: 1, c: 5,
      color: COLOR_A,
      label: 'Eq. A',
    },
    equationB: {
      display: formatStandard(1, -1, 1),
      slope: 1,
      yIntercept: -1,
      a: 1, b: -1, c: 1,
      color: COLOR_B,
      label: 'Eq. B',
    },
    expectedX: 2,
    expectedY: 1,
    instruction: instructionFor('elimination'),
    hint: hintFor('elimination', 2, 1),
  };
}

/**
 * Build one challenge of `challengeType`. When `tier` is present, the STRUCTURAL
 * lever for that mode (crossing-angle band / fraction-clearing depth / scale-op
 * count) is code-enforced via the shaped builders; without a tier the original
 * unshaped builders run (byte-identical no-tier path).
 */
function buildOneChallenge(
  challengeType: SystemsEquationsChallengeType,
  tier: SupportTier | null,
  xRange: [number, number],
  yRange: [number, number],
): SystemsEquationsChallenge {
  if (!tier) {
    return challengeType === 'elimination'
      ? buildEliminationChallenge(xRange, yRange)
      : buildSlopeInterceptChallenge(challengeType, xRange, yRange);
  }
  const shape = resolveProblemShape(challengeType, tier);
  if (challengeType === 'elimination') {
    return buildEliminationChallengeShaped(shape.scaleCount, xRange, yRange);
  }
  if (challengeType === 'substitution') {
    return buildSubstitutionChallengeShaped(shape.fractionDepth, xRange, yRange);
  }
  return buildGraphChallengeShaped(shape.crossingAngle, xRange, yRange);
}

/** Build N distinct challenges for a session of one challenge type. */
export function selectSystemsEquationsChallenges(
  challengeType: SystemsEquationsChallengeType,
  count: number = DEFAULT_INSTANCE_COUNT,
  xRange: [number, number] = [-10, 10],
  yRange: [number, number] = [-10, 10],
  tier: SupportTier | null = null,
): SystemsEquationsChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, count));
  const seen = new Set<string>();
  const challenges: SystemsEquationsChallenge[] = [];

  // A tight structural band (e.g. graph 'shallow') saturates the distinct-pair pool
  // faster, so a tier gets a few more attempts before falling through to duplicates.
  const attemptBudget = tier ? target * 12 : target * 10;
  for (let attempt = 0; attempt < attemptBudget && challenges.length < target; attempt++) {
    const ch = buildOneChallenge(challengeType, tier, xRange, yRange);

    const key = challengeKey({
      slopeA: ch.equationA.slope,
      yInterceptA: ch.equationA.yIntercept,
      slopeB: ch.equationB.slope,
      yInterceptB: ch.equationB.yIntercept,
      x: ch.expectedX,
      y: ch.expectedY,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    challenges.push({ ...ch, id: `se-${challenges.length + 1}` });
  }

  // Fallback — accept duplicates if the candidate space was too narrow (a tight
  // structural band, e.g. graph 'shallow', can saturate the distinct-pair pool).
  while (challenges.length < target) {
    const ch = buildOneChallenge(challengeType, tier, xRange, yRange);
    challenges.push({ ...ch, id: `se-${challenges.length + 1}` });
  }

  // Gentler systems first (by absolute magnitude of the solution coordinates).
  return shuffle(challenges).sort(
    (a, b) => Math.abs(a.expectedX) + Math.abs(a.expectedY) - (Math.abs(b.expectedX) + Math.abs(b.expectedY)),
  );
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const systemsEquationsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-challenge systems of equations session (e.g., 'Solving Systems by Graphing'). Do NOT name specific equations — the session walks through several systems.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["graph", "substitution", "elimination"],
      description: "Solution method tier. The system uses this to build the per-challenge equation pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["7-8", "algebra-1", "algebra-2"],
      description: "Target grade band. Should align with challengeType.",
    },
  },
  required: ["title", "description", "challengeType"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type SystemsEquationsConfig = {
    /** How many systems-of-equations challenges in this session. Default 4, max 6. */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /** Optional axis range overrides. */
    xRange?: [number, number];
    yRange?: [number, number];
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which method,
     * difficulty = how much on-screen solving help within it. NEVER changes numbers.
     */
    difficulty?: string;
};

export const generateSystemsEquations = async (
  ctx: GenerationContext,
): Promise<SystemsEquationsVisualizerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as SystemsEquationsConfig;
  const evalConstraint = resolveEvalModeConstraint(
    'systems-equations-visualizer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(systemsEquationsSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : systemsEquationsSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Within-mode support tier (config.difficulty): solving-help level, NOT numbers.
  //    pinnedType is ONLY for the prompt tone (a curated blend has no single mode to
  //    describe). The withdrawal happens deterministically per-challenge after the
  //    pool is built. ──
  const pinnedType: SystemsEquationsChallengeType | undefined =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as SystemsEquationsChallengeType)
      : undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier)
    : '';

  const prompt = `
Create the wrapper metadata for a multi-challenge systems-of-equations session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A session contains 3-6 separate systems, each with two linear equations and one integer (x, y) solution.
- The system has ALREADY pre-built each pair of equations and its solution — you do NOT pick equations, slopes, or solutions.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}
${tierSection}
REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific equation or solution — the session walks through several systems.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct solution-method tier (matches the eval mode constraint above).
4. Set gradeBand consistent with challengeType (graph → 7-8, substitution → algebra-1, elimination → algebra-1 or algebra-2).

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('SystemsEquations', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid systems-equations wrapper returned from Gemini API');
  }

  const validTypes: SystemsEquationsChallengeType[] = ['graph', 'substitution', 'elimination'];
  let challengeType: SystemsEquationsChallengeType = validTypes.includes(wrapper.challengeType as SystemsEquationsChallengeType)
    ? (wrapper.challengeType as SystemsEquationsChallengeType)
    : (evalConstraint?.allowedTypes[0] as SystemsEquationsChallengeType) ?? 'graph';
  if (!validTypes.includes(challengeType)) challengeType = 'graph';

  const xRange: [number, number] = config?.xRange ?? [-10, 10];
  const yRange: [number, number] = config?.yRange ?? [-10, 10];

  // Per-challenge structural difficulty is code-enforced inside the builders when
  // a tier is present (crossing-angle / fraction-depth / scale-count). The (x0,y0)
  // answer is recomputed from the new values, so nothing is leaked.
  const challenges = selectSystemsEquationsChallenges(challengeType, config?.instanceCount, xRange, yRange, supportTier);

  // ── Within-mode support tier: withdraw on-screen solving help (never the numbers).
  //    Applied PER CHALLENGE from each challenge's OWN type, so a blended (auto-mode)
  //    session gets difficulty too — the tier is a student property, not a single-mode
  //    one. Display-only: the submit-time checker compares to expectedX/expectedY,
  //    independent of every flag set here, and the exact intersection point is never
  //    revealed pre-answer (the region cue carries no coordinates). ──
  if (supportTier) {
    // --- AXIS 2: structural problem difficulty (code-enforced shape lever) ---
    // The shaped builders above already produced the target shape per challenge,
    // but VERIFY each one (the original unshaped fallback may have fired on a tight
    // band) and RECONSTRUCT deterministically if a challenge misses its target.
    // Solvability invariants preserved by the builders: non-parallel lines, integer
    // y-intercepts, integer (x0,y0) ∈ [-4,4], elimination determinant ≠ 0.
    for (let i = 0; i < challenges.length; i++) {
      const ch = challenges[i];
      const shape = resolveProblemShape(ch.type, supportTier);
      let ok: boolean;
      if (ch.type === 'elimination') {
        const { a: aA, b: bA } = ch.equationA;
        const { a: aB, b: bB } = ch.equationB;
        ok = aA !== undefined && bA !== undefined && aB !== undefined && bB !== undefined
          && eliminationScaleMatches(aA, bA, aB, bB, shape.scaleCount);
      } else if (ch.type === 'substitution') {
        ok = countFractionalSlopes(ch) === shape.fractionDepth;
      } else {
        // graph: the slope pair's crossing-angle band must match.
        const gap = angleGap(ch.equationA.slope, ch.equationB.slope);
        ok = shape.crossingAngle === 'wide' ? gap >= 1.3
          : shape.crossingAngle === 'shallow' ? gap > 0 && gap <= 0.45
          : gap > 0.45 && gap < 1.3;
      }
      if (!ok) {
        const rebuilt = buildOneChallenge(ch.type, supportTier, xRange, yRange);
        challenges[i] = { ...rebuilt, id: ch.id };
      }
    }

    // --- AXIS 1: scaffolding withdrawal (display-only; never touches numbers). ---
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.showIntersectionRegion = sc.showIntersectionRegion;
      ch.showAxisLabels = sc.showAxisLabels;
      ch.showStepHint = sc.showStepHint;
      ch.stepHint = stepHintFor(ch.type);
    }
    console.log(
      `[SystemsEquations] Tier "${supportTier}" (structure + scaffolding) applied per-challenge across ${challenges.length} challenge(s) `
      + `[${pinnedType ? `single-mode ${pinnedType}` : 'blended'}] → `
      + challenges.map((c) => `${c.equationA.display} & ${c.equationB.display}`).join(' | '),
    );
  }

  const data: SystemsEquationsVisualizerData = {
    title: wrapper.title,
    description: wrapper.description,
    xRange,
    yRange,
    gridSpacing: { x: 1, y: 1 },
    showAxes: true,
    showGrid: true,
    gradeBand:
      challengeType === 'graph'
        ? '7-8'
        : challengeType === 'substitution'
        ? 'algebra-1'
        : 'algebra-2',
    // Tell the live tutor the support level whenever a tier is present (blended too).
    ...(supportTier ? { supportTier } : {}),
    challenges,
  };

  const summary = challenges
    .map((c) => `${c.equationA.display} & ${c.equationB.display} → (${c.expectedX},${c.expectedY})`)
    .join(' | ');
  console.log(`[SystemsEquations] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
