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
// Data Types (mirrors SlopeTriangle.tsx — single source of truth there)
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface SlopeTriangleConfig {
  position: Point;
  size: number;
  showMeasurements: boolean;
  showSlope: boolean;
  showAngle: boolean;
  notation: 'riseRun' | 'deltaNotation';
  color?: string;
}

export interface AttachedLine {
  equation: string;
  slope: number;
  yIntercept: number;
  color?: string;
  label?: string;
}

export type SlopeTriangleChallengeType =
  | 'identify_slope'
  | 'calculate'
  | 'draw_triangle';

export interface SlopeTriangleChallenge {
  id: string;
  type: SlopeTriangleChallengeType;
  attachedLine: AttachedLine;
  triangle: SlopeTriangleConfig;
  expectedRise: number;
  expectedRun: number;
  expectedSlope: number;
  instruction: string;
  hint: string;
}

export interface SlopeTriangleData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  notation: 'riseRun' | 'deltaNotation';
  gradeBand?: '7-8' | 'algebra-1' | 'algebra-2';
  /** 3-6 challenges per session. Required. Built in-generator from the pool service. */
  challenges: SlopeTriangleChallenge[];
}

// ---------------------------------------------------------------------------
// Challenge type docs
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_slope: {
    promptDoc:
      `"identify_slope": Grades 7-8 introduction. Given a line with a pre-drawn slope triangle, the student reads rise and run off the grid. `
      + `Integer slopes (m ∈ {±1, ±2, ±3, ±4, ±1/2}). Triangle sizes 2-4 units. Notation: 'riseRun'.`,
    schemaDescription: "'identify_slope' (read rise and run from a drawn triangle)",
  },
  calculate: {
    promptDoc:
      `"calculate": Algebra-1. Given a line with a pre-drawn triangle showing rise and run, the student computes the slope as a ratio. `
      + `Mix of integer and fractional slopes (m ∈ {±1, ±2, ±3, ±1/2, ±2/3, ±3/4, ±1/3}). Triangle sizes 2-6 units. Notation: 'deltaNotation' for the older grades.`,
    schemaDescription: "'calculate' (compute slope = rise/run)",
  },
  draw_triangle: {
    promptDoc:
      `"draw_triangle": Algebra-1/Geometry. Given a line, the student constructs a slope triangle of a specified run, then reads off rise to verify the slope. `
      + `Clean integer slopes (m ∈ {±1, ±2, ±3, ±1/2}). The student picks position; runs of 2-4. Notation: 'deltaNotation'.`,
    schemaDescription: "'draw_triangle' (construct triangle on a given line)",
  },
};

// ---------------------------------------------------------------------------
// Line pool service (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COLOR_POOL = ['#3b82f6', '#22d3ee', '#a855f7', '#ec4899', '#f97316', '#facc15'];

interface LineSpec {
  slope: number;
  yIntercept: number;
}

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

/**
 * Per-mode slope candidate pools. Each entry is a (rise, run) integer pair so
 * the resulting triangle reads cleanly off the grid. The slope is rise/run.
 */
const SLOPE_POOL_BY_TYPE: Record<SlopeTriangleChallengeType, Array<[rise: number, run: number]>> = {
  identify_slope: [
    [1, 1], [2, 1], [3, 1], [4, 1],
    [-1, 1], [-2, 1], [-3, 1],
    [1, 2], [-1, 2],
  ],
  calculate: [
    [1, 2], [2, 3], [3, 4], [1, 3], [3, 2], [4, 3],
    [-1, 2], [-2, 3], [-1, 3], [-3, 4],
    [2, 1], [3, 1], [-2, 1], [-3, 1],
  ],
  draw_triangle: [
    [1, 1], [2, 1], [3, 1],
    [-1, 1], [-2, 1],
    [1, 2], [-1, 2],
  ],
};

/** Run sizes (horizontal leg) the generator can pick per challenge. */
const RUN_POOL_BY_TYPE: Record<SlopeTriangleChallengeType, number[]> = {
  identify_slope: [2, 3, 4],
  calculate: [2, 3, 4, 5, 6],
  draw_triangle: [2, 3, 4],
};

function notationForType(type: SlopeTriangleChallengeType): 'riseRun' | 'deltaNotation' {
  return type === 'identify_slope' ? 'riseRun' : 'deltaNotation';
}

function instructionFor(type: SlopeTriangleChallengeType, line: LineSpec): string {
  switch (type) {
    case 'identify_slope':
      return `Look at the triangle on the line. Count the rise (vertical) and run (horizontal).`;
    case 'calculate':
      return `Use the triangle to calculate the slope of this line. Slope = rise ÷ run.`;
    case 'draw_triangle':
      return `Drag the base point and resize the triangle so it sits on the line and reveals the slope.`;
  }
}

function hintFor(type: SlopeTriangleChallengeType, rise: number, run: number): string {
  switch (type) {
    case 'identify_slope':
      return `Start at the lower corner of the triangle. Count grid squares vertically to the opposite corner — that's the rise (positive if you went up, negative if you went down). Then count grid squares horizontally to the other corner — that's the run.`;
    case 'calculate':
      return `Read Δy (the vertical leg) and Δx (the horizontal leg) off the triangle's labels. The slope is Δy ÷ Δx — and the sign of Δy is the sign of the slope.`;
    case 'draw_triangle':
      return `Pick a base x-value on the visible line, then resize so the run is ${run}. The rise will be ${rise}.`;
  }
}

/** Canonical key for de-duplicating challenges within a session. */
function challengeKey(spec: { slope: number; yIntercept: number; run: number; rise: number; position: number }): string {
  return `m=${spec.slope}|b=${spec.yIntercept}|p=${spec.position}|r=${spec.run}|R=${spec.rise}`;
}

/** Choose a y-intercept so the triangle stays inside the standard [-10, 10] viewport. */
function chooseYIntercept(slope: number, run: number, rise: number, startX: number): number {
  // y at startX and at (startX + run) must both fall within [-10, 10].
  // y = slope*x + b  ⇒  b = y - slope*x.
  // Pick a target base y in a safe interior band then back-solve b.
  const minY = -7;
  const maxY = 7;
  const targetBaseY = randInt(minY, maxY);
  let b = targetBaseY - slope * startX;
  // Clamp so neither endpoint exits the viewport.
  const y1 = slope * startX + b;
  const y2 = slope * (startX + run) + b;
  if (y1 > 9 || y2 > 9) b -= Math.max(y1, y2) - 8;
  if (y1 < -9 || y2 < -9) b += -8 - Math.min(y1, y2);
  // Snap to integer y-intercept for clean equations.
  return Math.round(b);
}

function formatEquation(slope: number, yIntercept: number): string {
  // Always render as `y = m*x + b` (with explicit `*` so the component's evaluator parses it).
  const slopePart = slope === 1
    ? 'x'
    : slope === -1
    ? '-x'
    : Number.isInteger(slope)
    ? `${slope}*x`
    : `${slope}*x`;
  if (yIntercept === 0) return `y = ${slopePart}`;
  if (yIntercept > 0) return `y = ${slopePart} + ${yIntercept}`;
  return `y = ${slopePart} - ${Math.abs(yIntercept)}`;
}

function labelEquation(slope: number, yIntercept: number): string {
  // Pretty-printed form for display (uses `x` rather than `*x`).
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

/**
 * Build N distinct challenges for a session of one challenge type. Retries on
 * collisions; falls back to the last attempt if the candidate space is too narrow.
 */
export function selectSlopeTriangleChallenges(
  challengeType: SlopeTriangleChallengeType,
  count: number = DEFAULT_INSTANCE_COUNT,
): SlopeTriangleChallenge[] {
  const target = Math.max(1, Math.min(MAX_INSTANCE_COUNT, count));
  const slopePool = SLOPE_POOL_BY_TYPE[challengeType];
  const runPool = RUN_POOL_BY_TYPE[challengeType];
  const notation = notationForType(challengeType);

  const seen = new Set<string>();
  const challenges: SlopeTriangleChallenge[] = [];

  for (let attempt = 0; attempt < target * 8 && challenges.length < target; attempt++) {
    const [riseUnit, runUnit] = slopePool[randInt(0, slopePool.length - 1)];
    const slope = riseUnit / runUnit;
    const run = runPool[randInt(0, runPool.length - 1)];
    const rise = slope * run;
    if (!Number.isFinite(rise) || !Number.isInteger(rise * 2)) continue; // keep grid-friendly

    const startX = randInt(-5, Math.min(5, 7 - run));
    const yIntercept = chooseYIntercept(slope, run, rise, startX);

    const key = challengeKey({ slope, yIntercept, run, rise, position: startX });
    if (seen.has(key)) continue;
    seen.add(key);

    const idx = challenges.length;
    const color = COLOR_POOL[idx % COLOR_POOL.length];

    // For draw_triangle, the student picks position + size — so we seed the triangle
    // at a placeholder offset (different from the expected setup) and let them move it.
    const isDraw = challengeType === 'draw_triangle';
    const triangle: SlopeTriangleConfig = {
      position: { x: isDraw ? Math.max(-6, startX - 2) : startX, y: 0 },
      size: isDraw ? 1 : run,
      showMeasurements: !isDraw, // for draw mode the student is producing the measurements
      showSlope: !isDraw,
      showAngle: false,
      notation,
      color,
    };

    const attachedLine: AttachedLine = {
      equation: formatEquation(slope, yIntercept),
      slope,
      yIntercept,
      color: '#3b82f6',
      label: labelEquation(slope, yIntercept),
    };

    challenges.push({
      id: `st-${idx + 1}`,
      type: challengeType,
      attachedLine,
      triangle,
      expectedRise: rise,
      expectedRun: run,
      expectedSlope: slope,
      instruction: instructionFor(challengeType, { slope, yIntercept }),
      hint: hintFor(challengeType, rise, run),
    });
  }

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (challenges.length < target) {
    const [riseUnit, runUnit] = slopePool[randInt(0, slopePool.length - 1)];
    const slope = riseUnit / runUnit;
    const run = runPool[randInt(0, runPool.length - 1)];
    const rise = slope * run;
    const startX = randInt(-5, Math.min(5, 7 - run));
    const yIntercept = chooseYIntercept(slope, run, rise, startX);
    const idx = challenges.length;
    const color = COLOR_POOL[idx % COLOR_POOL.length];
    const isDraw = challengeType === 'draw_triangle';
    challenges.push({
      id: `st-${idx + 1}`,
      type: challengeType,
      attachedLine: {
        equation: formatEquation(slope, yIntercept),
        slope,
        yIntercept,
        color: '#3b82f6',
        label: labelEquation(slope, yIntercept),
      },
      triangle: {
        position: { x: isDraw ? Math.max(-6, startX - 2) : startX, y: 0 },
        size: isDraw ? 1 : run,
        showMeasurements: !isDraw,
        showSlope: !isDraw,
        showAngle: false,
        notation: notationForType(challengeType),
        color,
      },
      expectedRise: rise,
      expectedRun: run,
      expectedSlope: slope,
      instruction: instructionFor(challengeType, { slope, yIntercept }),
      hint: hintFor(challengeType, rise, run),
    });
  }

  // Easier-to-harder by absolute slope magnitude (gentler slopes first).
  return shuffle(challenges).sort((a, b) => Math.abs(a.expectedSlope) - Math.abs(b.expectedSlope));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const slopeTriangleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-challenge slope triangle session (e.g., 'Reading Slope Triangles'). Do NOT name specific equations — the session walks through several lines.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["identify_slope", "calculate", "draw_triangle"],
      description: "Difficulty tier of the session. The system uses this to build the line + triangle pool.",
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

export const generateSlopeTriangle = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** How many slope-triangle challenges in this session. Default 4, max 6. */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /** Optional axis range overrides. */
    xRange?: [number, number];
    yRange?: [number, number];
  }
): Promise<SlopeTriangleData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'slope-triangle',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(slopeTriangleSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : slopeTriangleSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge slope triangle session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A slope triangle session contains 3-6 separate lines, each with one right triangle showing rise and run.
- The system has ALREADY pre-built each line (equation, slope, y-intercept) and triangle (position, size) — you do NOT pick numbers or equations.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}

REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific equation or slope value — the session walks through several lines.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType to the correct difficulty tier (matches the eval mode constraint above).
4. Set gradeBand consistent with challengeType (identify_slope → 7-8, calculate → algebra-1, draw_triangle → algebra-1 or algebra-2).

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('SlopeTriangle', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid slope triangle wrapper returned from Gemini API');
  }

  // ── Validate challengeType ──
  const validTypes: SlopeTriangleChallengeType[] = ['identify_slope', 'calculate', 'draw_triangle'];
  let challengeType: SlopeTriangleChallengeType = validTypes.includes(wrapper.challengeType as SlopeTriangleChallengeType)
    ? (wrapper.challengeType as SlopeTriangleChallengeType)
    : (evalConstraint?.allowedTypes[0] as SlopeTriangleChallengeType) ?? 'identify_slope';
  if (!validTypes.includes(challengeType)) challengeType = 'identify_slope';

  // ── Build the per-challenge pool locally ──
  const challenges = selectSlopeTriangleChallenges(challengeType, config?.instanceCount);

  const xRange: [number, number] = config?.xRange ?? [-10, 10];
  const yRange: [number, number] = config?.yRange ?? [-10, 10];

  const data: SlopeTriangleData = {
    title: wrapper.title,
    description: wrapper.description,
    xRange,
    yRange,
    gridSpacing: { x: 1, y: 1 },
    showAxes: true,
    showGrid: true,
    notation: notationForType(challengeType),
    gradeBand:
      challengeType === 'identify_slope'
        ? '7-8'
        : challengeType === 'calculate'
        ? 'algebra-1'
        : 'algebra-2',
    challenges,
  };

  const challengeSummary = challenges
    .map((c) => `${c.attachedLine.label}|rise=${c.expectedRise}|run=${c.expectedRun}`)
    .join(', ');
  console.log(`[SlopeTriangle] Final: challengeType=${challengeType}, instances=${challenges.length} [${challengeSummary}]`);

  return data;
};
