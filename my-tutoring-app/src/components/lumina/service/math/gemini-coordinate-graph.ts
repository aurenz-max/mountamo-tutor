import { Type, Schema } from "@google/genai";
import {
  CoordinateGraphData,
  CoordinateGraphChallenge,
} from "../../primitives/visual-primitives/math/CoordinateGraph";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ============================================================================
// Eval Mode Configuration
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  plot_point: {
    promptDoc:
      '"plot_point": Student clicks a grid intersection to plot given coordinates.',
    schemaDescription: "'plot_point' (click to plot)",
  },
  read_point: {
    promptDoc:
      '"read_point": A point is shown; student identifies its coordinates from 4 MC options.',
    schemaDescription: "'read_point' (identify coordinates)",
  },
  find_slope: {
    promptDoc:
      '"find_slope": Two points shown with line; student picks slope from 4 MC options.',
    schemaDescription: "'find_slope' (calculate slope)",
  },
  find_intercept: {
    promptDoc:
      '"find_intercept": A line is drawn; student picks the y-intercept from 4 MC options.',
    schemaDescription: "'find_intercept' (find y-intercept)",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function simplifyFraction(num: number, den: number): string {
  if (den === 0) return "undefined";
  if (num === 0) return "0";
  const sign = (num < 0) !== (den < 0) ? -1 : 1;
  const n = Math.abs(num);
  const d = Math.abs(den);
  const g = gcd(n, d);
  const sn = sign * (n / g);
  const sd = d / g;
  return sd === 1 ? `${sn}` : `${sn}/${sd}`;
}

function getGridRange(
  gradeLevel: string,
  challengeType: string
): { gridMin: number; gridMax: number } {
  // Slope and intercept always need four quadrants
  if (challengeType === "find_slope" || challengeType === "find_intercept") {
    return { gridMin: -10, gridMax: 10 };
  }
  // For plotting/reading, younger grades use first quadrant
  if (/[6-9]|1[0-2]|algebra|pre-?calc/i.test(gradeLevel)) {
    return { gridMin: -10, gridMax: 10 };
  }
  return { gridMin: 0, gridMax: 10 };
}

// ============================================================================
// Schemas (one per challenge type — orchestrator pattern)
// ============================================================================

const plotPointSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short, student-friendly title for the challenge set",
    },
    challenges: {
      type: Type.ARRAY,
      description: "Array of 5 plot-point challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description:
              'Clear instruction, e.g. "Plot the point (3, -2) on the coordinate plane"',
          },
          hint: {
            type: Type.STRING,
            description:
              "Helpful hint about plotting (vary across challenges)",
          },
          targetX: {
            type: Type.NUMBER,
            description: "X-coordinate the student must click (integer)",
          },
          targetY: {
            type: Type.NUMBER,
            description: "Y-coordinate the student must click (integer)",
          },
        },
        required: ["instruction", "hint", "targetX", "targetY"],
      },
    },
  },
  required: ["title", "challenges"],
};

const readPointSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title" },
    challenges: {
      type: Type.ARRAY,
      description: "Array of 5 read-point challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description:
              'Ask student to identify coordinates, e.g. "What are the coordinates of the highlighted point?"',
          },
          hint: { type: Type.STRING, description: "Helpful hint" },
          pointX: {
            type: Type.NUMBER,
            description: "X-coordinate of displayed point (integer)",
          },
          pointY: {
            type: Type.NUMBER,
            description: "Y-coordinate of displayed point (integer)",
          },
          option0: {
            type: Type.STRING,
            description: 'MC option, e.g. "(3, 2)"',
          },
          option1: { type: Type.STRING, description: "MC option" },
          option2: { type: Type.STRING, description: "MC option" },
          option3: { type: Type.STRING, description: "MC option" },
          correctOptionIndex: {
            type: Type.NUMBER,
            description: "Index (0-3) of the correct option",
          },
        },
        required: [
          "instruction",
          "hint",
          "pointX",
          "pointY",
          "option0",
          "option1",
          "option2",
          "option3",
          "correctOptionIndex",
        ],
      },
    },
  },
  required: ["title", "challenges"],
};

const findSlopeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title" },
    challenges: {
      type: Type.ARRAY,
      description: "Array of 5 find-slope challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description:
              'E.g. "Find the slope of the line through the two points"',
          },
          hint: { type: Type.STRING, description: "Slope calculation hint" },
          x1: {
            type: Type.NUMBER,
            description: "First point X (integer)",
          },
          y1: {
            type: Type.NUMBER,
            description: "First point Y (integer)",
          },
          x2: {
            type: Type.NUMBER,
            description: "Second point X (integer)",
          },
          y2: {
            type: Type.NUMBER,
            description: "Second point Y (integer)",
          },
          option0: {
            type: Type.STRING,
            description: 'Slope option, e.g. "2/3" or "-1"',
          },
          option1: { type: Type.STRING, description: "Slope option" },
          option2: { type: Type.STRING, description: "Slope option" },
          option3: { type: Type.STRING, description: "Slope option" },
          correctOptionIndex: {
            type: Type.NUMBER,
            description: "Index (0-3) of the correct slope",
          },
        },
        required: [
          "instruction",
          "hint",
          "x1",
          "y1",
          "x2",
          "y2",
          "option0",
          "option1",
          "option2",
          "option3",
          "correctOptionIndex",
        ],
      },
    },
  },
  required: ["title", "challenges"],
};

const findInterceptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title" },
    challenges: {
      type: Type.ARRAY,
      description: "Array of 5 find-intercept challenges",
      items: {
        type: Type.OBJECT,
        properties: {
          instruction: {
            type: Type.STRING,
            description:
              'E.g. "Where does this line cross the y-axis?"',
          },
          hint: {
            type: Type.STRING,
            description: "Y-intercept hint",
          },
          x1: { type: Type.NUMBER, description: "First point X (integer)" },
          y1: { type: Type.NUMBER, description: "First point Y (integer)" },
          x2: { type: Type.NUMBER, description: "Second point X (integer)" },
          y2: { type: Type.NUMBER, description: "Second point Y (integer)" },
          option0: {
            type: Type.STRING,
            description: 'Y-intercept option, e.g. "3" or "-2"',
          },
          option1: { type: Type.STRING, description: "Option" },
          option2: { type: Type.STRING, description: "Option" },
          option3: { type: Type.STRING, description: "Option" },
          correctOptionIndex: {
            type: Type.NUMBER,
            description: "Index (0-3) of the correct y-intercept",
          },
          equationLabel: {
            type: Type.STRING,
            description:
              'Equation in slope-intercept form, e.g. "y = 2x + 3"',
          },
        },
        required: [
          "instruction",
          "hint",
          "x1",
          "y1",
          "x2",
          "y2",
          "option0",
          "option1",
          "option2",
          "option3",
          "correctOptionIndex",
          "equationLabel",
        ],
      },
    },
  },
  required: ["title", "challenges"],
};

// ============================================================================
// Sub-generators
// ============================================================================

interface RawResult {
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  challenges?: any[];
}

async function callGemini(
  schema: Schema,
  prompt: string
): Promise<RawResult> {
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  return result.text ? JSON.parse(result.text) : { challenges: [] };
}

// --- plot_point ---
async function generatePlotPoint(
  topic: string,
  gradeLevel: string,
  gridMin: number,
  gridMax: number
): Promise<{ title: string; challenges: CoordinateGraphChallenge[] }> {
  const prompt = `Generate 5 coordinate plane challenges where a student must plot a point at given coordinates.

Topic: ${topic}
Grade Level: ${gradeLevel}
Grid Range: ${gridMin} to ${gridMax} on both axes

RULES:
1. All targetX and targetY must be integers between ${gridMin} and ${gridMax}
2. Vary coordinates — don't repeat points or cluster near origin
3. ${gridMin < 0 ? "Include both positive and negative coordinates" : "Use only non-negative coordinates"}
4. Each instruction must state the exact point, e.g. "Plot the point (3, -2) on the coordinate plane"
5. Vary hints: some about x-axis direction, some about y-axis, some about quadrants
6. Make instructions age-appropriate for ${gradeLevel}
7. DO NOT place points at (0,0)`;

  const raw = await callGemini(plotPointSchema, prompt);
  const title = raw.title || `Plot Points: ${topic}`;
  const challenges: CoordinateGraphChallenge[] = [];

  for (const ch of raw.challenges ?? []) {
    const x = Math.round(ch.targetX ?? 0);
    const y = Math.round(ch.targetY ?? 0);
    if (x < gridMin || x > gridMax || y < gridMin || y > gridMax) {
      console.warn(`[coordinate-graph] plot_point: rejecting OOB point (${x}, ${y})`);
      continue;
    }
    if (!ch.instruction || !ch.hint) {
      console.warn(`[coordinate-graph] plot_point: rejecting challenge missing instruction/hint`);
      continue;
    }
    challenges.push({
      id: `pp-${challenges.length}`,
      type: "plot_point",
      instruction: ch.instruction,
      hint: ch.hint,
      x1: x,
      y1: y,
      x2: 0,
      y2: 0,
    });
  }

  if (challenges.length === 0) {
    challenges.push({
      id: "pp-fallback-0",
      type: "plot_point",
      instruction: `Plot the point (${Math.min(3, gridMax)}, ${Math.min(2, gridMax)}) on the coordinate plane`,
      hint: "The first number (x) tells you how far to go right. The second number (y) tells you how far to go up.",
      x1: Math.min(3, gridMax),
      y1: Math.min(2, gridMax),
      x2: 0,
      y2: 0,
    });
  }

  return { title, challenges };
}

// --- read_point ---
async function generateReadPoint(
  topic: string,
  gradeLevel: string,
  gridMin: number,
  gridMax: number
): Promise<{ title: string; challenges: CoordinateGraphChallenge[] }> {
  const prompt = `Generate 5 coordinate plane challenges where a point is displayed and the student must identify its coordinates from 4 multiple-choice options.

Topic: ${topic}
Grade Level: ${gradeLevel}
Grid Range: ${gridMin} to ${gridMax} on both axes

RULES:
1. pointX and pointY must be integers between ${gridMin} and ${gridMax}
2. Exactly ONE option must match "(pointX, pointY)" — include parentheses and comma
3. Distractors should be plausible confusions: swap x/y, negate one coordinate, off by one
4. All options must be in "(x, y)" format
5. correctOptionIndex must point to the correct option (0-3)
6. Vary point locations across challenges
7. DO NOT place points at (0,0)`;

  const raw = await callGemini(readPointSchema, prompt);
  const title = raw.title || `Read Coordinates: ${topic}`;
  const challenges: CoordinateGraphChallenge[] = [];

  for (const ch of raw.challenges ?? []) {
    const x = Math.round(ch.pointX ?? 0);
    const y = Math.round(ch.pointY ?? 0);
    if (x < gridMin || x > gridMax || y < gridMin || y > gridMax) {
      console.warn(`[coordinate-graph] read_point: rejecting OOB point (${x}, ${y})`);
      continue;
    }
    if (!ch.instruction || !ch.hint) continue;

    const opts = [ch.option0, ch.option1, ch.option2, ch.option3];
    if (opts.some((o: string) => !o)) continue;

    // Post-validate: ensure correct option actually matches point
    const correctStr = `(${x}, ${y})`;
    let correctIdx = opts.findIndex((o: string) => o.replace(/\s/g, "") === correctStr.replace(/\s/g, ""));
    if (correctIdx === -1) {
      // Fix: insert correct answer at the claimed index
      const claimedIdx = Math.round(ch.correctOptionIndex ?? 0);
      const safeIdx = Math.max(0, Math.min(3, claimedIdx));
      opts[safeIdx] = correctStr;
      correctIdx = safeIdx;
    }

    challenges.push({
      id: `rp-${challenges.length}`,
      type: "read_point",
      instruction: ch.instruction,
      hint: ch.hint,
      x1: x,
      y1: y,
      x2: 0,
      y2: 0,
      option0: opts[0],
      option1: opts[1],
      option2: opts[2],
      option3: opts[3],
      correctOptionIndex: correctIdx,
    });
  }

  if (challenges.length === 0) {
    challenges.push({
      id: "rp-fallback-0",
      type: "read_point",
      instruction: "What are the coordinates of the highlighted point?",
      hint: "Read the x value (horizontal) first, then the y value (vertical).",
      x1: 4,
      y1: 3,
      x2: 0,
      y2: 0,
      option0: "(4, 3)",
      option1: "(3, 4)",
      option2: "(4, -3)",
      option3: "(-4, 3)",
      correctOptionIndex: 0,
    });
  }

  return { title, challenges };
}

// --- find_slope ---
async function generateFindSlope(
  topic: string,
  gradeLevel: string,
  gridMin: number,
  gridMax: number
): Promise<{ title: string; challenges: CoordinateGraphChallenge[] }> {
  const prompt = `Generate 5 find-slope challenges. Two points are shown on a coordinate plane and the student must calculate the slope.

Topic: ${topic}
Grade Level: ${gradeLevel}
Grid Range: ${gridMin} to ${gridMax} on both axes

RULES:
1. x1, y1, x2, y2 must be integers between ${gridMin} and ${gridMax}
2. x1 must NOT equal x2 (no undefined slopes)
3. Points must produce "clean" slopes — fractions like 1/2, -2/3, 3, -1, 2/5, etc. Avoid ugly fractions like 7/13.
4. Slope options should be in simplified fraction form: "2/3", "-1", "0", "3/2", etc. (not decimals)
5. Distractors: include reciprocal (run/rise), negated slope, and one random plausible value
6. correctOptionIndex must point to the correct slope (0-3)
7. Vary slopes: include positive, negative, and zero slopes across the 5 challenges
8. Make points well-separated (at least 2 units apart on each axis)`;

  const raw = await callGemini(findSlopeSchema, prompt);
  const title = raw.title || `Find the Slope: ${topic}`;
  const challenges: CoordinateGraphChallenge[] = [];

  for (const ch of raw.challenges ?? []) {
    const x1 = Math.round(ch.x1 ?? 0);
    const y1 = Math.round(ch.y1 ?? 0);
    const x2 = Math.round(ch.x2 ?? 0);
    const y2 = Math.round(ch.y2 ?? 0);

    if (x1 === x2) {
      console.warn(`[coordinate-graph] find_slope: rejecting vertical line`);
      continue;
    }
    if ([x1, y1, x2, y2].some((v) => v < gridMin || v > gridMax)) {
      console.warn(`[coordinate-graph] find_slope: rejecting OOB points`);
      continue;
    }
    if (!ch.instruction || !ch.hint) continue;

    const opts = [ch.option0, ch.option1, ch.option2, ch.option3];
    if (opts.some((o: string) => !o)) continue;

    // Recompute correct slope from points
    const correctSlope = simplifyFraction(y2 - y1, x2 - x1);
    let correctIdx = opts.findIndex(
      (o: string) => o.replace(/\s/g, "") === correctSlope.replace(/\s/g, "")
    );
    if (correctIdx === -1) {
      const claimedIdx = Math.max(0, Math.min(3, Math.round(ch.correctOptionIndex ?? 0)));
      opts[claimedIdx] = correctSlope;
      correctIdx = claimedIdx;
    }

    challenges.push({
      id: `fs-${challenges.length}`,
      type: "find_slope",
      instruction: ch.instruction,
      hint: ch.hint,
      x1,
      y1,
      x2,
      y2,
      option0: opts[0],
      option1: opts[1],
      option2: opts[2],
      option3: opts[3],
      correctOptionIndex: correctIdx,
    });
  }

  if (challenges.length === 0) {
    challenges.push({
      id: "fs-fallback-0",
      type: "find_slope",
      instruction: "Find the slope of the line through the two points shown.",
      hint: "Slope = rise / run = (y2 - y1) / (x2 - x1)",
      x1: 1,
      y1: 1,
      x2: 4,
      y2: 7,
      option0: "2",
      option1: "1/2",
      option2: "-2",
      option3: "3",
      correctOptionIndex: 0,
    });
  }

  return { title, challenges };
}

// --- find_intercept ---
async function generateFindIntercept(
  topic: string,
  gradeLevel: string,
  gridMin: number,
  gridMax: number
): Promise<{ title: string; challenges: CoordinateGraphChallenge[] }> {
  const prompt = `Generate 5 find-y-intercept challenges. A line is drawn on a coordinate plane and the student must identify where it crosses the y-axis.

Topic: ${topic}
Grade Level: ${gradeLevel}
Grid Range: ${gridMin} to ${gridMax} on both axes

RULES:
1. x1, y1, x2, y2 must be integers between ${gridMin} and ${gridMax}
2. x1 must NOT equal x2
3. The line MUST cross the y-axis at an INTEGER value within the grid range
4. equationLabel should show the equation in y = mx + b form, e.g. "y = 2x + 3"
5. Options should be integer y-intercept values as strings, e.g. "3", "-2"
6. Distractors: include the slope value, x-intercept, negated intercept, off-by-one
7. correctOptionIndex must point to the correct y-intercept (0-3)
8. Choose points that define lines with clean slopes (integers or simple fractions)`;

  const raw = await callGemini(findInterceptSchema, prompt);
  const title = raw.title || `Find the Y-Intercept: ${topic}`;
  const challenges: CoordinateGraphChallenge[] = [];

  for (const ch of raw.challenges ?? []) {
    const x1 = Math.round(ch.x1 ?? 0);
    const y1 = Math.round(ch.y1 ?? 0);
    const x2 = Math.round(ch.x2 ?? 0);
    const y2 = Math.round(ch.y2 ?? 0);

    if (x1 === x2) {
      console.warn(`[coordinate-graph] find_intercept: rejecting vertical line`);
      continue;
    }
    if ([x1, y1, x2, y2].some((v) => v < gridMin || v > gridMax)) {
      console.warn(`[coordinate-graph] find_intercept: rejecting OOB points`);
      continue;
    }
    if (!ch.instruction || !ch.hint) continue;

    const opts = [ch.option0, ch.option1, ch.option2, ch.option3];
    if (opts.some((o: string) => !o)) continue;

    // Recompute y-intercept: b = y1 - (slope * x1)
    const slope = (y2 - y1) / (x2 - x1);
    const yInt = Math.round(y1 - slope * x1);

    // Verify integer intercept within range
    if (Math.abs(y1 - slope * x1 - yInt) > 0.01) {
      console.warn(`[coordinate-graph] find_intercept: rejecting non-integer intercept`);
      continue;
    }
    if (yInt < gridMin || yInt > gridMax) {
      console.warn(`[coordinate-graph] find_intercept: rejecting OOB intercept ${yInt}`);
      continue;
    }

    const correctStr = `${yInt}`;
    let correctIdx = opts.findIndex(
      (o: string) => o.replace(/\s/g, "") === correctStr
    );
    if (correctIdx === -1) {
      const claimedIdx = Math.max(0, Math.min(3, Math.round(ch.correctOptionIndex ?? 0)));
      opts[claimedIdx] = correctStr;
      correctIdx = claimedIdx;
    }

    challenges.push({
      id: `fi-${challenges.length}`,
      type: "find_intercept",
      instruction: ch.instruction,
      hint: ch.hint,
      x1,
      y1,
      x2,
      y2,
      option0: opts[0],
      option1: opts[1],
      option2: opts[2],
      option3: opts[3],
      correctOptionIndex: correctIdx,
      equationLabel: ch.equationLabel || `y = ${simplifyFraction(y2 - y1, x2 - x1)}x + ${yInt}`,
    });
  }

  if (challenges.length === 0) {
    challenges.push({
      id: "fi-fallback-0",
      type: "find_intercept",
      instruction: "Where does this line cross the y-axis?",
      hint: "The y-intercept is the y value where the line crosses the vertical axis (where x = 0).",
      x1: 1,
      y1: 5,
      x2: 3,
      y2: 9,
      option0: "3",
      option1: "2",
      option2: "-3",
      option3: "5",
      correctOptionIndex: 0,
    });
  }

  return { title, challenges };
}

// ============================================================================
// Main Generator (Orchestrator)
// ============================================================================

export const generateCoordinateGraph = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>
): Promise<CoordinateGraphData> => {
  // Resolve eval mode to challenge type(s)
  const constraint = resolveEvalModeConstraint(
    "coordinate-graph",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS
  );
  logEvalModeResolution("coordinate-graph", config?.targetEvalMode, constraint);

  const challengeTypes = constraint
    ? constraint.allowedTypes
    : Object.keys(CHALLENGE_TYPE_DOCS);

  // Determine grid range based on primary challenge type and grade
  const primaryType = challengeTypes[0] || "plot_point";
  const { gridMin, gridMax } = getGridRange(gradeLevel, primaryType);

  // Generate challenges for each resolved type
  let title = `Coordinate Graph: ${topic}`;
  const allChallenges: CoordinateGraphChallenge[] = [];

  const generators: Record<
    string,
    (
      t: string,
      g: string,
      min: number,
      max: number
    ) => Promise<{ title: string; challenges: CoordinateGraphChallenge[] }>
  > = {
    plot_point: generatePlotPoint,
    read_point: generateReadPoint,
    find_slope: generateFindSlope,
    find_intercept: generateFindIntercept,
  };

  for (const ct of challengeTypes) {
    const gen = generators[ct];
    if (!gen) continue;
    const ctRange = getGridRange(gradeLevel, ct);
    const result = await gen(topic, gradeLevel, ctRange.gridMin, ctRange.gridMax);
    if (allChallenges.length === 0) title = result.title;
    allChallenges.push(...result.challenges);
  }

  // If multiple types were generated, use the widest grid range
  const finalGridMin = allChallenges.some(
    (c) => c.type === "find_slope" || c.type === "find_intercept"
  )
    ? -10
    : gridMin;
  const finalGridMax = gridMax;

  // Determine grade band label
  let gradeBand = "6-8";
  if (/k|kinder/i.test(gradeLevel)) gradeBand = "K-2";
  else if (/[1-5]/i.test(gradeLevel) && !/1[0-2]/.test(gradeLevel))
    gradeBand = "3-5";
  else if (/algebra|9|10|11|12|pre-?calc/i.test(gradeLevel))
    gradeBand = "9-12";

  return {
    title,
    description: `Practice coordinate plane skills with ${topic}`,
    challenges: allChallenges,
    gridMin: finalGridMin,
    gridMax: finalGridMax,
    gradeBand,
  };
};
