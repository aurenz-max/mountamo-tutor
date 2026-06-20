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
  /** Tier-controlled measurement overlays (added by support tiers; absent = no-tier default). */
  showRiseRunLabels?: boolean; // numeric "rise = N"/"run = N" labels on the legs
  showGridCountOverlay?: boolean; // tick marks counting the rise/run grid units along each leg
  showFormulaReminder?: boolean; // "slope = rise ÷ run" reminder badge on the canvas
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
  /** Within-mode support tier from the manifest, when present (drives tutor reveal). */
  supportTier?: SupportTier;
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
// Support Tiers (config.difficulty — within-mode scaffolding withdrawal)
// ---------------------------------------------------------------------------
// Second axis of the two-field contract: targetEvalMode = WHICH skill,
// difficulty = HOW MUCH measurement overlay within it. NEVER changes the
// line/points (that's the eval-mode axis); only withdraws measurement overlays.

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; component defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/**
 * Per-challenge measurement-overlay flags. Each maps to one render cue in
 * SlopeTriangle.tsx. The overlays withdraw as the tier hardens; the LINE,
 * POINTS, GRID, axis labels, and right-angle mark stay on EVERY tier (the
 * student always has what they need to compute).
 *
 * ANSWER-LEAK GUARD: for `identify_slope` the asked answer literally IS the
 * rise and the run, so the numeric "rise = N"/"run = N" labels are never shown
 * at any tier (they'd print the answer). Easy gives the grid-count overlay
 * instead — tick marks the student counts — which is a self-check aid, not the
 * answer value. `calculate` (answer = the ratio) may show the labels at easy.
 */
interface SupportScaffold {
  showRiseRunLabels: boolean; // numeric rise/run (Δy/Δx) labels on the legs
  showGridCountOverlay: boolean; // tick marks counting grid units along each leg
  showFormulaReminder: boolean; // "slope = rise ÷ run" reminder badge
  promptLines: string[];
}

/** Withdraw measurement overlays as the tier hardens. Resolved per challenge
 *  from its OWN mode so blended/auto sessions get difficulty too. The overlays
 *  are scaffolding only — they NEVER change the line, the points, or the grid. */
function resolveSupportStructure(type: string, tier: SupportTier): SupportScaffold {
  const base: SupportScaffold = {
    showRiseRunLabels: false,
    showGridCountOverlay: false,
    showFormulaReminder: false,
    promptLines: [],
  };

  switch (type) {
    case 'identify_slope':
      // Answer IS the rise & run → never print the numeric labels. Easy = the
      // grid-count overlay (countable ticks) + formula reminder as a self-check.
      if (tier === 'easy') {
        base.showGridCountOverlay = true;
        base.showFormulaReminder = true;
        base.promptLines.push(
          'EASY: a grid-count overlay marks each rise/run grid square as a countable tick and the "slope = rise ÷ run" reminder is shown — the student counts the ticks to self-check. The numeric rise/run VALUES are NOT printed (that would be the answer).',
        );
      } else if (tier === 'medium') {
        base.showGridCountOverlay = true;
        base.promptLines.push(
          'MEDIUM: the grid-count overlay stays (countable ticks along each leg) but the formula reminder is withdrawn.',
        );
      } else {
        base.promptLines.push(
          'HARD: bare triangle — no grid-count overlay and no formula reminder. The student counts the rise and run off the grid unaided.',
        );
      }
      break;
    case 'calculate':
      // Answer is the slope RATIO → the rise/run labels are a legit self-check
      // (the student still divides). Easy shows labels + overlay + formula.
      if (tier === 'easy') {
        base.showRiseRunLabels = true;
        base.showGridCountOverlay = true;
        base.showFormulaReminder = true;
        base.promptLines.push(
          'EASY: the numeric rise/run (Δy/Δx) labels, the grid-count overlay, and the "slope = rise ÷ run" reminder are all shown — the student reads the legs and divides.',
        );
      } else if (tier === 'medium') {
        base.showGridCountOverlay = true;
        base.promptLines.push(
          'MEDIUM: the rise/run numeric labels and the formula reminder are withdrawn; only the grid-count overlay remains, so the student measures each leg by counting ticks.',
        );
      } else {
        base.promptLines.push(
          'HARD: bare triangle — no rise/run labels, no grid-count overlay, no formula reminder. The student reads the two corner coordinates off the grid and computes slope = rise ÷ run unaided.',
        );
      }
      break;
    case 'draw_triangle':
      // The student PRODUCES the measurements, so numeric leg labels never show.
      // Easy = grid-count overlay + formula reminder to guide the construction.
      if (tier === 'easy') {
        base.showGridCountOverlay = true;
        base.showFormulaReminder = true;
        base.promptLines.push(
          'EASY: a grid-count overlay marks countable ticks along the legs and the "slope = rise ÷ run" reminder is shown — the student builds the triangle and counts to verify.',
        );
      } else if (tier === 'medium') {
        base.showGridCountOverlay = true;
        base.promptLines.push(
          'MEDIUM: the grid-count overlay stays for counting; the formula reminder is withdrawn.',
        );
      } else {
        base.promptLines.push(
          'HARD: bare triangle — no grid-count overlay, no formula reminder. The student constructs and verifies the slope from the grid unaided.',
        );
      }
      break;
  }
  return base;
}

const TIER_GUARDRAIL =
  'This tier changes only HOW MUCH measurement help is overlaid on the triangle — it NEVER changes the line, the points, the grid, or the slope. Keep every value exactly as pre-built.';

// ---------------------------------------------------------------------------
// Line pool service (deterministic, per-challenge values built locally)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// All slope-triangle modes are T2 in the §5a tier table (single-step
// compute/build on a grid). B4 sweep bumps every mode 4 → 5.

const DEFAULT_INSTANCE_COUNT = 5; // T2 fallback
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<SlopeTriangleChallengeType, number> = {
  identify_slope: 5,   // T2 — B4 bump 4 → 5
  calculate: 5,        // T2 — B4 bump 4 → 5
  draw_triangle: 5,    // T2 — B4 bump 4 → 5
};

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
  count?: number,
): SlopeTriangleChallenge[] {
  const modeCount = COUNT_BY_MODE[challengeType];
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? modeCount ?? DEFAULT_INSTANCE_COUNT),
  );
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
    // No-tier default: only `calculate` shows the numeric rise/run labels (its
    // answer is the RATIO). For identify_slope the labels ARE the asked answer
    // (rise & run), so never print them; draw_triangle the student produces them.
    const showNumericLabels = challengeType === 'calculate';
    const triangle: SlopeTriangleConfig = {
      position: { x: isDraw ? Math.max(-6, startX - 2) : startX, y: 0 },
      size: isDraw ? 1 : run,
      showMeasurements: showNumericLabels,
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
        showMeasurements: challengeType === 'calculate', // see no-tier note above
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
    /** How many slope-triangle challenges in this session. Defaults from COUNT_BY_MODE (5 for all T2 modes). */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much measurement overlay within it. NEVER changes numbers.
     */
    difficulty?: string;
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

  // ── Resolve the within-mode support tier (drives measurement-overlay withdrawal) ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  // pinnedType is for prompt TONE only (a blend has no single mode to describe).
  const pinnedType = evalConstraint?.allowedTypes.length === 1
    ? (evalConstraint.allowedTypes[0] as SlopeTriangleChallengeType)
    : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (measurement-overlay level — NOT number size)\n- ${TIER_GUARDRAIL}\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

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
${tierSection}
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

  // ── Apply support tier per challenge (mode-correct for blends). Code owns the
  //    overlay STRUCTURE; the pool service already chose the numbers. Gated on a
  //    tier being present, NOT pinnedType — so blended/auto sessions get it too.
  //    The line/points/grid/answer fields are untouched (eval-mode axis). ──
  if (supportTier) {
    for (const ch of challenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.supportTier = supportTier;
      // identify_slope: never print rise/run VALUES (they are the answer) — sc
      // already keeps showRiseRunLabels false for that mode. draw_triangle never
      // shows leg labels because the student produces them.
      ch.triangle.showRiseRunLabels = sc.showRiseRunLabels;
      ch.triangle.showGridCountOverlay = sc.showGridCountOverlay;
      ch.triangle.showFormulaReminder = sc.showFormulaReminder;
      // Keep the legacy showMeasurements flag consistent with the new tiered
      // label flag so the component's existing label branch can defer to it.
      ch.triangle.showMeasurements = sc.showRiseRunLabels;
    }
    console.log(
      `[SlopeTriangle] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

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
