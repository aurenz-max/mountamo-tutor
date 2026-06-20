import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
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
    'This tier changes only how much solving help the student gets on screen. It NEVER '
    + 'changes the equations, the coefficients, or the (x, y) answer. The exact intersection '
    + 'point is the answer, so it is NEVER marked or its coordinates shown before the student solves.';

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

/** Build N distinct challenges for a session of one challenge type. */
export function selectSystemsEquationsChallenges(
  challengeType: SystemsEquationsChallengeType,
  count: number = DEFAULT_INSTANCE_COUNT,
  xRange: [number, number] = [-10, 10],
  yRange: [number, number] = [-10, 10],
): SystemsEquationsChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, count));
  const seen = new Set<string>();
  const challenges: SystemsEquationsChallenge[] = [];

  for (let attempt = 0; attempt < target * 10 && challenges.length < target; attempt++) {
    const ch = challengeType === 'elimination'
      ? buildEliminationChallenge(xRange, yRange)
      : buildSlopeInterceptChallenge(challengeType, xRange, yRange);

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

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (challenges.length < target) {
    const ch = challengeType === 'elimination'
      ? buildEliminationChallenge(xRange, yRange)
      : buildSlopeInterceptChallenge(challengeType, xRange, yRange);
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

export const generateSystemsEquations = async (
  topic: string,
  gradeLevel: string,
  config?: {
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
  }
): Promise<SystemsEquationsVisualizerData> => {
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
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
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

  const challenges = selectSystemsEquationsChallenges(challengeType, config?.instanceCount, xRange, yRange);

  // ── Within-mode support tier: withdraw on-screen solving help (never the numbers).
  //    Applied PER CHALLENGE from each challenge's OWN type, so a blended (auto-mode)
  //    session gets difficulty too — the tier is a student property, not a single-mode
  //    one. Display-only: the submit-time checker compares to expectedX/expectedY,
  //    independent of every flag set here, and the exact intersection point is never
  //    revealed pre-answer (the region cue carries no coordinates). ──
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.showIntersectionRegion = sc.showIntersectionRegion;
      ch.showAxisLabels = sc.showAxisLabels;
      ch.showStepHint = sc.showStepHint;
      ch.stepHint = stepHintFor(ch.type);
    }
    console.log(
      `[SystemsEquations] Support tier "${supportTier}" applied per-challenge across ${challenges.length} challenge(s) `
      + `[${pinnedType ? `single-mode ${pinnedType}` : 'blended'}].`,
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
