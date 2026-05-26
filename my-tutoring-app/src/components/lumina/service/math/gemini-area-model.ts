/**
 * Area Model Generator — multi-instance pool-service generator.
 *
 * Each session walks the student through 3-4 distinct factor pairs in the SAME
 * eval mode. Per PRD §6a #1, area-model is value-only (per-challenge data is
 * two integer arrays + display flags derived from the mode), so we follow the
 * pool-service pattern (factor-tree, place-value-chart precedent):
 *  - Gemini emits ONLY wrapper metadata (title, description, mode hints).
 *  - Local code deterministically builds N AreaModelChallenge tuples, each
 *    with mode-appropriate factor decompositions and display flags.
 *  - Structured-output Gemini converges per-call (PRD §6a #2), so any per-
 *    challenge variance comes from local randomness, not the prompt.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  AreaModelData,
  AreaModelChallenge,
} from "../../primitives/visual-primitives/math/AreaModel";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  build_model: {
    promptDoc:
      `"build_model": Student constructs an area model from given factors. `
      + `Single-digit × 2-digit (e.g., 3 × 14 → factor1Parts=[3], factor2Parts=[10,4]). `
      + `1×2 grid. Grades 3-4.`,
    schemaDescription: "'build_model' (construct area model from factors, 3-4)",
  },
  find_area: {
    promptDoc:
      `"find_area": Area model is shown with factor decomposition visible. `
      + `Student calculates each partial product cell and finds the total area. `
      + `2-digit × 2-digit, 2×2 grid. Grades 3-4.`,
    schemaDescription: "'find_area' (calculate partial products and total, 3-4)",
  },
  perimeter: {
    promptDoc:
      `"perimeter": Rectangle with single side lengths labeled — student computes perimeter (CCSS 4.MD.3). `
      + `Length and width are whole numbers 5-30. Grades 3-4.`,
    schemaDescription: "'perimeter' (find the perimeter of a rectangle, 3-4)",
  },
  multiply: {
    promptDoc:
      `"multiply": Multi-digit × multi-digit multiplication using area model decomposition. `
      + `3-digit × 2-digit (e.g., 145 × 23). 2×3 or 3×2 grids. Grades 4-5.`,
    schemaDescription: "'multiply' (multi-digit multiplication via model, 4-5)",
  },
  factor: {
    promptDoc:
      `"factor": Reverse operation — student sees partial products in each cell `
      + `and must discover the factor decomposition (dimension labels). `
      + `2-digit × 2-digit with 2×2 grid. Grades 5-6.`,
    schemaDescription: "'factor' (find factors from given area, 5-6)",
  },
};

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only.
// Per-challenge data (factor parts, display flags) is built locally below.
// ---------------------------------------------------------------------------

const areaModelWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["build_model", "find_area", "perimeter", "multiply", "factor"],
      description:
        "Challenge type controlling difficulty: 'build_model' (3-4), 'find_area' (3-4), 'perimeter' (3-4), 'multiply' (4-5), 'factor' (5-6).",
    },
    title: {
      type: Type.STRING,
      description:
        "Short session title (e.g., 'Area Model Practice — Grade 4'). Do NOT include specific numbers; the session uses multiple factor pairs.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence warm introduction that motivates the strategy (decomposition, distributive property, or perimeter — match the mode). Do NOT include specific numbers.",
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string (e.g., 'Grade 4').",
    },
  },
  required: ["challengeType", "title", "description"],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ChallengeType = 'build_model' | 'find_area' | 'perimeter' | 'multiply' | 'factor';

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// T2 modes (find_area, perimeter, factor) bumped 3 → 5 in the B4 sweep.
// T3 modes (multiply, build_model) hold at 4 per the B5 audit row — they
// involve per-cell decomposition, so per-challenge time is closer to T3.

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any future mode not listed
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  build_model: 4,  // T3 hold (B5) — per-cell construction
  find_area: 5,    // T2 — B4 bump 3 → 5
  perimeter: 5,    // T2 — B4 bump 3 → 5
  multiply: 4,     // T3 hold (B5) — full 2-digit × 2-digit per-cell + sum
  factor: 5,       // T2 — B4 bump 3 → 5
};

// ---------------------------------------------------------------------------
// Local randomness helpers (own the randomness — Gemini convergence per §6a #2)
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function decomposeByPlace(n: number): number[] {
  if (n < 10) return [n];
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const ones = n - tens;
    return ones > 0 ? [tens, ones] : [tens];
  }
  // 100-999
  const hundreds = Math.floor(n / 100) * 100;
  const remainder = n - hundreds;
  const tens = Math.floor(remainder / 10) * 10;
  const ones = remainder - tens;
  const parts = [hundreds];
  if (tens > 0) parts.push(tens);
  if (ones > 0) parts.push(ones);
  return parts;
}

function canonKey(a: number[], b: number[]): string {
  // Treat (3, [10,4]) and ([10,4], 3) as the same pair for dedup.
  const aSum = a.reduce((s, v) => s + v, 0);
  const bSum = b.reduce((s, v) => s + v, 0);
  return aSum <= bSum ? `${aSum}x${bSum}` : `${bSum}x${aSum}`;
}

// ---------------------------------------------------------------------------
// Per-mode operand generators
// ---------------------------------------------------------------------------

interface OperandPair {
  factor1Parts: number[];
  factor2Parts: number[];
}

function buildModelOperands(count: number): OperandPair[] {
  // Single-digit (3-9) × 2-digit (11-25), 1×2 grid.
  const pairs: OperandPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 8;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const single = randInt(3, 9);
    const two = randInt(11, 25);
    const key = canonKey([single], decomposeByPlace(two));
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ factor1Parts: [single], factor2Parts: decomposeByPlace(two) });
  }
  return pairs;
}

function findAreaOperands(count: number): OperandPair[] {
  // 2-digit × 2-digit, 2×2 grid. Both factors in 11-49.
  const pairs: OperandPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 8;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const a = randInt(11, 49);
    const b = randInt(11, 49);
    const aParts = decomposeByPlace(a);
    const bParts = decomposeByPlace(b);
    // Require 2×2 grids (both decomposed into 2+ parts)
    if (aParts.length < 2 || bParts.length < 2) continue;
    const key = canonKey(aParts, bParts);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ factor1Parts: aParts, factor2Parts: bParts });
  }
  return pairs;
}

function perimeterOperands(count: number): OperandPair[] {
  // Single side lengths, no decomposition. Whole numbers 5-30, distinct sides.
  const pairs: OperandPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 8;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const length = randInt(5, 30);
    let width = randInt(5, 30);
    // Avoid square (length === width) so the problem isn't degenerate.
    if (width === length) width = width === 30 ? width - 1 : width + 1;
    const key = canonKey([length], [width]);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ factor1Parts: [length], factor2Parts: [width] });
  }
  return pairs;
}

function multiplyOperands(count: number): OperandPair[] {
  // 3-digit × 2-digit. First factor 110-499 (must have 3 parts), second 12-49.
  const pairs: OperandPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const a = randInt(110, 499);
    const b = randInt(12, 49);
    const aParts = decomposeByPlace(a);
    const bParts = decomposeByPlace(b);
    // Require 3-part × 2-part for sufficient difficulty.
    if (aParts.length < 3 || bParts.length < 2) continue;
    const key = canonKey(aParts, bParts);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ factor1Parts: aParts, factor2Parts: bParts });
  }
  return pairs;
}

function factorOperands(count: number): OperandPair[] {
  // Same shape as find_area (2-digit × 2-digit, 2×2 grid).
  return findAreaOperands(count);
}

function selectAreaModelOperands(
  challengeType: ChallengeType,
  count: number,
): OperandPair[] {
  switch (challengeType) {
    case 'build_model': return buildModelOperands(count);
    case 'find_area': return findAreaOperands(count);
    case 'perimeter': return perimeterOperands(count);
    case 'multiply': return multiplyOperands(count);
    case 'factor': return factorOperands(count);
  }
}

// ---------------------------------------------------------------------------
// Build challenges array from operand pairs + mode-specific display flags
// ---------------------------------------------------------------------------

function buildChallenges(
  challengeType: ChallengeType,
  count: number,
): AreaModelChallenge[] {
  const pairs = selectAreaModelOperands(challengeType, count);

  // Pad if short — generate one more pair, accepting duplicates if needed.
  while (pairs.length < count) {
    const fallback = selectAreaModelOperands(challengeType, 1);
    if (fallback.length > 0) pairs.push(fallback[0]);
    else break;
  }

  return pairs.slice(0, count).map((pair, idx): AreaModelChallenge => {
    const base: AreaModelChallenge = {
      id: `area-model-${idx + 1}`,
      factor1Parts: pair.factor1Parts,
      factor2Parts: pair.factor2Parts,
      showPartialProducts: false,
      showDimensions: true,
      algebraicMode: false,
      highlightCell: null,
    };

    switch (challengeType) {
      case 'build_model':
        return { ...base, showPartialProducts: false, showDimensions: true };
      case 'find_area':
        return { ...base, showPartialProducts: false, showDimensions: true };
      case 'perimeter':
        return { ...base, showPartialProducts: false, showDimensions: true };
      case 'multiply':
        return { ...base, showPartialProducts: false, showDimensions: true };
      case 'factor':
        return { ...base, showPartialProducts: true, showDimensions: false };
    }
  });
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export const generateAreaModel = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
    /** Number of challenges in this session. Default 3 (pilot per PRD §6e). */
    instanceCount?: number;
  },
): Promise<AreaModelData> => {
  // ── Eval-mode constraint resolution ──────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'area-model',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('AreaModel', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(areaModelWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, { fieldName: 'challengeType', rootLevel: true })
    : areaModelWrapperSchema;
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Resolve session instance count up-front from the eval-mode constraint so
  // the prompt + description stay consistent with what the pool builds.
  const presumedChallengeType: ChallengeType =
    (evalConstraint?.allowedTypes[0] as ChallengeType | undefined) ?? 'find_area';
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount ?? COUNT_BY_MODE[presumedChallengeType] ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // ── Gemini wrapper call (metadata only) ──────────────────────────
  const prompt = `
Create the wrapper metadata for a MULTI-CHALLENGE area model session for "${topic}" (${gradeLevel}).

This session walks the student through ${instanceCount} DIFFERENT factor pairs of the SAME challenge type.

${challengeTypeSection}

DO NOT include specific numbers in the title or description — the system picks ${instanceCount} factor pairs locally and the same session covers all of them.

GUIDELINES:
- title: short and number-free, e.g., "Area Model Practice — Grade 4" or "Multiplying with the Area Model"
- description: 1-2 sentences warmly introducing the multi-challenge session. Motivate the strategy (decomposition, distributive property, or perimeter — match the mode). No specific numbers.
- gradeLevel: echo back "${gradeLevel}"

Return ONLY the wrapper metadata in the response schema.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid area model wrapper returned from Gemini API');
  }

  // ── Local: build challenges array ─────────────────────────────────
  const challengeType: ChallengeType =
    (wrapper.challengeType as ChallengeType) ||
    (evalConstraint?.allowedTypes[0] as ChallengeType) ||
    'find_area';

  const challenges = buildChallenges(challengeType, instanceCount);

  console.log('📐 Area Model generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    pairs: challenges.map(c => ({
      f1: c.factor1Parts,
      f2: c.factor2Parts,
      f1Total: c.factor1Parts.reduce((s, v) => s + v, 0),
      f2Total: c.factor2Parts.reduce((s, v) => s + v, 0),
    })),
  });

  return {
    title: wrapper.title || 'Area Model Practice',
    description:
      wrapper.description ||
      `Practice ${instanceCount} ${challengeType.replace('_', ' ')} problems with the area model.`,
    challenges,
    challengeType,
    gradeLevel: wrapper.gradeLevel || gradeLevel,
  };
};
