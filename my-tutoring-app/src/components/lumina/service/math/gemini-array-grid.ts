/**
 * Array Grid Generator — multi-instance pool-service generator.
 *
 * Each session walks the student through 3-4 distinct (rows, columns) pairs in
 * the SAME eval mode. Per PRD §6a #1, array-grid is value-only (per-challenge
 * data is just (rows, columns)), so we follow the pool-service pattern
 * (factor-tree, place-value-chart, area-model precedent):
 *  - Gemini emits ONLY wrapper metadata (title, description, display flags).
 *  - Local code deterministically builds N ArrayGridChallenge tuples per
 *    mode-appropriate dimension ranges.
 *  - Structured-output Gemini converges per-call (PRD §6a #2), so any
 *    per-challenge variance comes from local randomness, not the prompt.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// Single source of truth for the data type lives in the component file.
import {
  ArrayGridData,
  ArrayGridChallenge,
  ArrayGridChallengeType,
  ArrayGridIconType,
} from "../../primitives/visual-primitives/math/ArrayGrid";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_array: {
    promptDoc:
      `"build_array": Student builds an array with given row and column counts. `
      + `Concrete manipulative — small dimensions (2-5). Grades 2-3.`,
    schemaDescription: "'build_array' (build array with given dimensions)",
  },
  count_array: {
    promptDoc:
      `"count_array": Array is displayed pre-built, student counts the total. `
      + `Skip counting or multiplication. Grades 2-3.`,
    schemaDescription: "'count_array' (count total from displayed array)",
  },
  multiply_array: {
    promptDoc:
      `"multiply_array": Array is shown, student writes the multiplication sentence (rows × columns = total). Grades 3-4.`,
    schemaDescription: "'multiply_array' (write multiplication sentence from array)",
  },
};

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only.
// Per-challenge (rows, columns) pairs are built locally below.
// ---------------------------------------------------------------------------

const arrayGridWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["build_array", "count_array", "multiply_array"],
      description:
        "Challenge type controlling difficulty: 'build_array' (2-3), 'count_array' (2-3), 'multiply_array' (3-4).",
    },
    title: {
      type: Type.STRING,
      description:
        "Short session title. MUST NOT contain multiplication notation like \"3 × 5\" or specific numbers — the session uses multiple (rows, columns) pairs (e.g. 'Star Array Challenge', 'Build Arrays', 'Count the Stars').",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence warm introduction motivating arrays-as-multiplication (or repeated addition, depending on grade). MUST NOT contain specific numbers — the session covers multiple pairs.",
    },
    iconType: {
      type: Type.STRING,
      enum: ["dot", "square", "star"],
      description:
        "Display icon: 'star' (engaging for young students), 'dot' (general), 'square' (area-like contexts).",
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string (e.g., 'Grade 3').",
    },
  },
  required: ["challengeType", "title", "description"],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

// Component-side caps (the row/column button panels max out at these counts).
const ROW_BUTTON_CAP = 6;
const COL_BUTTON_CAP = 8;

// ---------------------------------------------------------------------------
// Local randomness helpers (Gemini convergence per PRD §6a #2)
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface DimensionPair {
  rows: number;
  columns: number;
}

function canonKey(a: number, b: number): string {
  // Treat (3,5) and (5,3) as the same shape for dedup — commutative property.
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

// ---------------------------------------------------------------------------
// Per-mode dimension generators
// ---------------------------------------------------------------------------

/**
 * Returns the (min, max) dimension range for the given challenge type.
 * Honors the button-panel caps so the UI can render every pair.
 */
function dimensionRangeFor(
  type: ArrayGridChallengeType,
): { rowMin: number; rowMax: number; colMin: number; colMax: number } {
  switch (type) {
    case 'build_array':
      // Concrete manipulative — keep dimensions small so building is quick.
      return { rowMin: 2, rowMax: 5, colMin: 2, colMax: 5 };
    case 'count_array':
      // Slightly larger so skip-counting feels useful.
      return { rowMin: 2, rowMax: 6, colMin: 3, colMax: 8 };
    case 'multiply_array':
      // Multiplication facts through 6 × 8.
      return { rowMin: 2, rowMax: 6, colMin: 2, colMax: 8 };
  }
}

function selectDimensionPairs(
  type: ArrayGridChallengeType,
  count: number,
): DimensionPair[] {
  const { rowMin, rowMax, colMin, colMax } = dimensionRangeFor(type);
  const pairs: DimensionPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;

  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const rows = randInt(rowMin, Math.min(rowMax, ROW_BUTTON_CAP));
    const columns = randInt(colMin, Math.min(colMax, COL_BUTTON_CAP));
    // Avoid trivial 1×N / N×1 arrays.
    if (rows < 2 || columns < 2) continue;
    // Avoid squares — they don't differentiate "rows" from "columns".
    if (rows === columns) continue;
    const key = canonKey(rows, columns);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ rows, columns });
  }

  // Fallback: if dedup killed too many, accept duplicates rather than blocking.
  while (pairs.length < count) {
    const rows = randInt(rowMin, Math.min(rowMax, ROW_BUTTON_CAP));
    const columns = randInt(colMin, Math.min(colMax, COL_BUTTON_CAP));
    pairs.push({ rows, columns });
  }

  return pairs.slice(0, count);
}

// ---------------------------------------------------------------------------
// Build challenges array
// ---------------------------------------------------------------------------

function buildChallenges(
  type: ArrayGridChallengeType,
  count: number,
): ArrayGridChallenge[] {
  const pairs = selectDimensionPairs(type, count);
  return pairs.map((pair, idx) => ({
    id: `array-grid-${idx + 1}`,
    targetRows: pair.rows,
    targetColumns: pair.columns,
  }));
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export const generateArrayGrid = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ArrayGridData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /** Number of challenges in this session. Default 4 (PRD §5 floor). */
    instanceCount?: number;
  },
): Promise<ArrayGridData> => {
  // ── Eval-mode constraint resolution ──────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'array-grid',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ArrayGrid', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(arrayGridWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : arrayGridWrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const instanceCount = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, config?.instanceCount ?? DEFAULT_INSTANCE_COUNT),
  );

  // ── Gemini wrapper call (metadata only) ──────────────────────────
  const prompt = `
Create the wrapper metadata for a MULTI-CHALLENGE array session for "${topic}" (${gradeLevel}).

This session walks the student through ${instanceCount} DIFFERENT (rows, columns) pairs of the SAME challenge type.

${challengeTypeSection}

DO NOT include specific numbers in the title or description — the system picks ${instanceCount} dimension pairs locally and the same session covers all of them.

GUIDELINES:
- title: short and number-free, e.g., "Star Array Challenge", "Build Some Arrays", "Count the Dots". NO multiplication notation like "3 × 5".
- description: 1-2 sentences warmly introducing the multi-challenge session. Motivate arrays-as-multiplication (or repeated addition for younger grades). NO specific numbers.
- iconType: pick 'star' for K-2 engagement, 'dot' for grades 3+, 'square' for area-like contexts.
- gradeLevel: echo back "${gradeLevel}"

Return ONLY the wrapper metadata in the response schema.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid array grid wrapper returned from Gemini API');
  }

  // ── Local: build challenges array ─────────────────────────────────
  const challengeType: ArrayGridChallengeType =
    (wrapper.challengeType as ArrayGridChallengeType) ||
    (evalConstraint?.allowedTypes[0] as ArrayGridChallengeType) ||
    'build_array';

  const challenges = buildChallenges(challengeType, instanceCount);

  const iconType: ArrayGridIconType =
    (config?.iconType as ArrayGridIconType) ||
    (wrapper.iconType as ArrayGridIconType) ||
    (challengeType === 'multiply_array' ? 'dot' : 'star');

  console.log('⊞ Array Grid generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    pairs: challenges.map((c) => ({ rows: c.targetRows, cols: c.targetColumns })),
  });

  return {
    title: wrapper.title || 'Array Builder',
    description:
      wrapper.description ||
      `Practice ${instanceCount} ${challengeType.replace('_', ' ')} problems with arrays.`,
    challenges,
    challengeType,
    iconType,
    showLabels: config?.showLabels !== undefined ? config.showLabels : true,
    maxRows: config?.maxRows ?? ROW_BUTTON_CAP,
    maxColumns: config?.maxColumns ?? COL_BUTTON_CAP,
  };
};
