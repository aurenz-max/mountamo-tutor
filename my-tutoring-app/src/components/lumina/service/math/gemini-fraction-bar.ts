/**
 * Fraction Bar Generator — multi-instance pool-service generator.
 *
 * Each session walks the student through 3-6 distinct fractions in the SAME
 * eval mode. Per PRD §6a #1, fraction-bar is value-only (per-challenge data is
 * `numerator`, `denominator`, plus derived MC choice arrays), so we follow the
 * pool-service pattern (factor-tree, place-value-chart, area-model precedent):
 *  - Gemini emits ONLY wrapper metadata (title, description, mode hints).
 *  - Local code deterministically builds N FractionBarChallenge tuples, each
 *    with mode-appropriate fraction values and shuffled MC distractors.
 *  - Structured-output Gemini converges per-call (PRD §6a #2), so any per-
 *    challenge variance comes from local randomness, not the prompt.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import {
  FractionBarData,
  FractionBarChallenge,
} from "../../primitives/visual-primitives/math/FractionBar";
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
  identify: {
    promptDoc:
      `"identify": Unit fractions (1/2, 1/3, 1/4, 1/6, 1/8) — the CCSS 3.NF.A.1 set. `
      + `Focus on naming the fraction. Grades 2-3. Concrete manipulative with full guidance.`,
    schemaDescription: "'identify' (CCSS 3.NF.A.1 unit fractions: 1/2, 1/3, 1/4, 1/6, 1/8)",
  },
  build: {
    promptDoc:
      `"build": Non-unit proper fractions (2/3, 3/4, 2/5). Denominators 2-6. `
      + `Focus on shading correctly. Grades 3-4. Pictorial representation with prompts.`,
    schemaDescription: "'build' (shade non-unit proper fractions)",
  },
  compare: {
    promptDoc:
      `"compare": Fractions with larger denominators (3/8, 5/12). Denominators 2-12. `
      + `More complex MC distractors. Grades 4-5. Pictorial with reduced prompts.`,
    schemaDescription: "'compare' (fractions with larger denominators)",
  },
  add_subtract: {
    promptDoc:
      `"add_subtract": Fractions requiring understanding of addition context `
      + `(e.g., "shade 2/5 then add 1/5 more"). Denominators 2-10. Grades 5-6. `
      + `Transitional symbolic/pictorial.`,
    schemaDescription: "'add_subtract' (fractions in operation context)",
  },
};

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only.
// Per-challenge data (numerator, denominator, choices) is built locally below.
// ---------------------------------------------------------------------------

const fractionBarWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["identify", "build", "compare", "add_subtract"],
      description:
        "Challenge type controlling difficulty: 'identify' (2-3), 'build' (3-4), 'compare' (4-5), 'add_subtract' (5-6).",
    },
    title: {
      type: Type.STRING,
      description:
        "Short session title (e.g., 'Fraction Bar Practice — Grade 3'). Do NOT include specific fractions; the session uses multiple fractions.",
    },
    description: {
      type: Type.STRING,
      description:
        "1-2 sentence warm introduction that motivates the strategy (identifying parts of a fraction, building fractions on a bar, comparing magnitudes — match the mode). Do NOT include specific fractions.",
    },
    showDecimal: {
      type: Type.BOOLEAN,
      description:
        "Whether to show the decimal approximation during the build phase. Default: true for grades 4+, false for K-3 to avoid cognitive overload.",
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

type ChallengeType = 'identify' | 'build' | 'compare' | 'add_subtract';

// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a (T1 tier).
// fraction-bar is pool-service (single Gemini wrapper call; per-challenge data is
// built deterministically via selectFractionBarOperands), so bumping past 6 is
// free token-wise. `identify` bumped 3 → 7 per B2 of PLAN_INSTANCE_COUNT_TIER_SWEEP.
const DEFAULT_INSTANCE_COUNT = 7; // T1 tier fallback
const MAX_INSTANCE_COUNT = 8;

const COUNT_BY_MODE: Record<ChallengeType, number> = {
  identify: 7,
  build: 3,
  compare: 3,
  add_subtract: 3,
};

// ---------------------------------------------------------------------------
// Local randomness helpers (own the randomness — Gemini convergence per §6a #2)
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface FractionPair {
  numerator: number;
  denominator: number;
}

function pairKey(p: FractionPair): string {
  return `${p.numerator}/${p.denominator}`;
}

// ---------------------------------------------------------------------------
// Per-mode operand generators
// ---------------------------------------------------------------------------

function identifyOperands(count: number): FractionPair[] {
  // Unit fractions only (numerator = 1). Pool is the CCSS 3.NF.A.1 canonical
  // set {1/2, 1/3, 1/4, 1/6, 1/8} — denominators that decompose into halves
  // and quarters, matching how 3rd-grade textbooks cluster unit fractions.
  // At T1 count=7 the pool cycles once (one fraction repeats), keeping any
  // single value from dominating the IRT signal.
  const candidates: FractionPair[] = [
    { numerator: 1, denominator: 2 },
    { numerator: 1, denominator: 3 },
    { numerator: 1, denominator: 4 },
    { numerator: 1, denominator: 6 },
    { numerator: 1, denominator: 8 },
  ];
  const shuffled = shuffle(candidates);
  const out: FractionPair[] = [];
  for (let i = 0; i < count; i++) {
    out.push(shuffled[i % shuffled.length]);
  }
  return out;
}

function buildOperands(count: number): FractionPair[] {
  // Non-unit proper fractions: 2 <= numerator < denominator, denominators 3-6.
  const pairs: FractionPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const denominator = randInt(3, 6);
    const numerator = randInt(2, denominator - 1);
    const pair = { numerator, denominator };
    const key = pairKey(pair);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(pair);
  }
  return pairs;
}

function compareOperands(count: number): FractionPair[] {
  // Proper fractions, denominators 4-12, full numerator range.
  const pairs: FractionPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const denominator = randInt(4, 12);
    const numerator = randInt(1, denominator - 1);
    const pair = { numerator, denominator };
    const key = pairKey(pair);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(pair);
  }
  return pairs;
}

function addSubtractOperands(count: number): FractionPair[] {
  // Proper fractions, denominators 3-10. Operation context lives in the
  // prompt copy, not the per-challenge data.
  const pairs: FractionPair[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 12;
  for (let i = 0; i < maxAttempts && pairs.length < count; i++) {
    const denominator = randInt(3, 10);
    const numerator = randInt(1, denominator - 1);
    const pair = { numerator, denominator };
    const key = pairKey(pair);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(pair);
  }
  return pairs;
}

function selectFractionBarOperands(
  challengeType: ChallengeType,
  count: number,
): FractionPair[] {
  switch (challengeType) {
    case 'identify': return identifyOperands(count);
    case 'build': return buildOperands(count);
    case 'compare': return compareOperands(count);
    case 'add_subtract': return addSubtractOperands(count);
  }
}

// ---------------------------------------------------------------------------
// MC choice generation
// ---------------------------------------------------------------------------

/**
 * Build 4 shuffled multiple-choice options.
 *
 * `correct` is always included. `other` is the partner value (e.g., when
 * generating numerator choices, `other` is the denominator) — adding it as a
 * distractor creates the classic numerator/denominator confusion test. The
 * remaining slots are filled with off-by-one neighbors.
 *
 * `floor` is the minimum legal value: 0 for numerator choices (a fraction
 * can have a zero numerator conceptually), 2 for denominator choices (a
 * denominator must be at least 2 for the bar to make sense).
 */
function buildChoices(correct: number, other: number, floor: number): number[] {
  const choices = new Set<number>([correct]);
  if (other !== correct && other >= floor) choices.add(other);
  if (correct - 1 >= floor) choices.add(correct - 1);
  choices.add(correct + 1);
  choices.add(correct + 2);
  // Fill any remaining slots with positive integers we haven't used.
  let v = Math.max(floor, 1);
  while (choices.size < 4) {
    if (!choices.has(v)) choices.add(v);
    v++;
  }
  return shuffle(Array.from(choices).slice(0, 4));
}

// ---------------------------------------------------------------------------
// Build challenges array from fraction pairs + per-pair choice arrays
// ---------------------------------------------------------------------------

function buildChallenges(
  challengeType: ChallengeType,
  count: number,
): FractionBarChallenge[] {
  const pairs = selectFractionBarOperands(challengeType, count);

  // Pad if short — generate one more pair, accepting duplicates if needed.
  while (pairs.length < count) {
    const fallback = selectFractionBarOperands(challengeType, 1);
    if (fallback.length > 0) pairs.push(fallback[0]);
    else break;
  }

  return pairs.slice(0, count).map((pair, idx): FractionBarChallenge => ({
    id: `fraction-bar-${idx + 1}`,
    numerator: pair.numerator,
    denominator: pair.denominator,
    numeratorChoices: buildChoices(pair.numerator, pair.denominator, 0),
    denominatorChoices: buildChoices(pair.denominator, pair.numerator, 2),
  }));
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export const generateFractionBar = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
    /** Number of challenges in this session. Default 3 (matches §6e pilot). */
    instanceCount?: number;
    showDecimal?: boolean;
  },
): Promise<FractionBarData> => {
  // ── Eval-mode constraint resolution ──────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'fraction-bar',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('FractionBar', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(fractionBarWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, { fieldName: 'challengeType', rootLevel: true })
    : fractionBarWrapperSchema;
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Resolve mode early when constrained, so per-mode count is correct.
  // When unconstrained, fall back to DEFAULT_INSTANCE_COUNT until wrapper resolves.
  const presumedMode = (evalConstraint?.allowedTypes[0] as ChallengeType | undefined);
  const instanceCount = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      config?.instanceCount
        ?? (presumedMode ? COUNT_BY_MODE[presumedMode] : undefined)
        ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  // ── Gemini wrapper call (metadata only) ──────────────────────────
  const prompt = `
Create the wrapper metadata for a MULTI-CHALLENGE fraction bar session for "${topic}" (${gradeLevel}).

This session walks the student through ${instanceCount} DIFFERENT fractions of the SAME challenge type. Each fraction runs through a three-phase flow: identify the numerator (MC) → identify the denominator (MC) → shade the fraction on a bar.

${challengeTypeSection}

DO NOT include specific fractions in the title or description — the system picks ${instanceCount} fraction pairs locally and the same session covers all of them.

GUIDELINES:
- title: short and number-free, e.g., "Fraction Bar Practice — Grade 3" or "Building Fractions on a Bar"
- description: 1-2 sentences warmly introducing the multi-challenge session. Motivate the strategy (identifying parts of a fraction, building fractions on a bar, comparing magnitudes, or working in operation context — match the mode). No specific fractions.
- showDecimal: true for grades 4+ (helpful for connecting fractions to decimals), false for grades K-3 to avoid cognitive overload
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
    throw new Error('No valid fraction bar wrapper returned from Gemini API');
  }

  // ── Local: build challenges array ─────────────────────────────────
  const challengeType: ChallengeType =
    (wrapper.challengeType as ChallengeType) ||
    (evalConstraint?.allowedTypes[0] as ChallengeType) ||
    'identify';

  const challenges = buildChallenges(challengeType, instanceCount);

  const showDecimal =
    config?.showDecimal ??
    (typeof wrapper.showDecimal === 'boolean' ? wrapper.showDecimal : true);

  console.log('🍰 Fraction Bar generated:', {
    topic,
    challengeType,
    instanceCount: challenges.length,
    fractions: challenges.map(c => `${c.numerator}/${c.denominator}`),
  });

  return {
    title: wrapper.title || 'Fraction Bar Practice',
    description:
      wrapper.description ||
      `Practice ${instanceCount} ${challengeType.replace('_', ' ')} fraction problems on a bar.`,
    challenges,
    challengeType,
    showDecimal,
    gradeLevel: wrapper.gradeLevel || gradeLevel,
  };
};
