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
import type { GenerationContext } from "../generation/generationContext";
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

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame / counting-board): config.targetEvalMode
// says WHICH skill (task identity, matched to the objective by the manifest);
// config.difficulty says how much on-bar SUPPORT the student gets while doing it
// ('easy' = max scaffolding, 'hard' = min). The tier is per-component — the manifest
// withdraws support across Introduce → Visualize → Apply, and personalization routes
// through this field. It NEVER changes the fractions: the per-mode denominator windows
// (identify {2,3,4,6,8}; build 3-6; compare 4-12; add_subtract 3-10) own magnitude.
// A harder tier means LESS on-bar/readout help + TIGHTER MC distractors, never a bigger
// or out-of-scope fraction. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

/** MC distractor proximity — the one code-enforceable structural lever for this
 *  primitive. 'wide' spreads distractors out (off-by-one + off-by-two); 'swap'
 *  guarantees the numerator/denominator-swap confusion distractor; 'tight' forces
 *  only adjacent off-by-one neighbors so the student must read the bar precisely. */
type DistractorTightness = 'wide' | 'swap' | 'tight';

interface SupportScaffold {
  /** Decimal readout under the top fraction + build phase ('= 0.500'). */
  showDecimal: boolean;
  /** Partition-index numerals ({i+1}) inside each bar cell — position labels, NOT
   *  the shaded count, so withdrawing them never leaks the answer. */
  showPartitionNumerals: boolean;
  /** Live "Shaded: X/N" + target restatement above the bar in the build phase. */
  showShadedReadout: boolean;
  /** MC distractor proximity for identify (the only structural lever). */
  distractorTightness: DistractorTightness;
  /** Whether the identify prompt names "top/bottom number" gloss (component-level). */
  showPromptGloss: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-bar support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task (same fractions, same denominator windows) with less scaffolding. The bar
 * partition+shade interaction and the top fraction display are NEVER withdrawn —
 * they ARE the task. Only labels, readouts, and MC distractor proximity tier.
 */
function resolveSupportStructure(pinnedType: ChallengeType, tier: SupportTier): SupportScaffold {
  // Decimal readout: ON at easy across all modes, off otherwise.
  const showDecimal = tier === 'easy';
  // Partition numerals: position labels (never leak the answer). On at easy/medium,
  // withdrawn at hard across all modes (build/compare/add_subtract = numerals OFF at hard).
  const showPartitionNumerals = tier !== 'hard';
  // Shaded readout: build phase self-check. On at easy, dimmed/hidden harder.
  const showShadedReadout = tier !== 'hard';
  // Identify MC distractor proximity: wide → swap → tight.
  const distractorTightness: DistractorTightness =
    tier === 'easy' ? 'wide' : tier === 'medium' ? 'swap' : 'tight';
  // Identify prompt gloss ("the top/bottom number"): named at easy, dropped at hard.
  const showPromptGloss = tier !== 'hard';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-bar SCAFFOLDING + MC distractor proximity only (${tier === 'easy' ? 'maximum support: readouts and a decimal help the student self-check, MC choices are wide-spaced' : tier === 'medium' ? 'moderate support: the student tracks the fraction with fewer readouts, MC includes a num/denom-swap distractor' : 'minimum support: the student works from the fraction and bar alone with tight off-by-one MC distractors'}). Keep every fraction within the per-mode denominator window; a harder tier NEVER means a bigger or out-of-scope fraction, only less help and closer distractors.`,
  ];
  switch (pinnedType) {
    case 'identify':
      promptLines.push(
        tier === 'easy'
          ? 'Name the parts in the description ("the top number is the numerator, the bottom the denominator") and keep the decimal readout on so the student connects the fraction to its value.'
          : tier === 'hard'
            ? 'Drop the top/bottom gloss; the student must recognize the numerator and denominator from the fraction alone with no decimal readout and tightly-spaced answer choices.'
            : 'Keep the part names light; the answer choices include a numerator/denominator swap distractor so the student must distinguish the two positions.',
      );
      break;
    case 'build':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the partition numerals and the live "Shaded X/N" readout on with the decimal so the student can self-check while shading toward the target.'
          : tier === 'hard'
            ? 'Hide the partition numerals and the "Shaded X/N" readout and the decimal; the student must shade from the fraction alone and count the parts themselves.'
            : 'Keep the partition numerals but hide the running-target restatement; the student tracks how many parts they have shaded without a live tally.',
      );
      break;
    case 'compare':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the decimal and all readouts on so the student can compare magnitudes numerically as well as visually.'
          : tier === 'hard'
            ? 'Hide the decimal, partition numerals, and readouts; the student compares from the shaded bar alone.'
            : 'Hide the decimal but keep the partition numerals; dim the running readout so the student leans on the bar.',
      );
      break;
    case 'add_subtract':
      promptLines.push(
        tier === 'easy'
          ? 'Keep the decimal and all readouts on so the operation context connects the symbols to the shaded amount.'
          : tier === 'hard'
            ? 'Hide the decimal, partition numerals, and readouts; present the operation symbolically and let the student reason from the bar alone.'
            : 'Hide the decimal but keep the partition numerals; the student works the operation tracking the parts themselves.',
      );
      break;
  }
  return {
    showDecimal,
    showPartitionNumerals,
    showShadedReadout,
    distractorTightness,
    showPromptGloss,
    promptLines,
  };
}

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
 *
 * `tightness` is the support-tier structural lever (identify only; defaults to
 * 'wide' so the no-tier path is byte-identical):
 *  - 'wide'  → correct + off-by-one + off-by-two + a filler (widely spaced).
 *  - 'swap'  → guarantees the num/denom-swap (`other`) confusion distractor.
 *  - 'tight' → only adjacent off-by-one neighbors (±1), no swap, no off-by-two,
 *              so the student cannot eliminate by spread and must read precisely.
 * Distractor proximity changes the on-screen CHOICES, never the correct answer
 * or the fraction — magnitude is untouched.
 */
function buildChoices(
  correct: number,
  other: number,
  floor: number,
  tightness: DistractorTightness = 'wide',
): number[] {
  const choices = new Set<number>([correct]);

  if (tightness === 'tight') {
    // Pack adjacent neighbors first; no swap distractor, no off-by-two.
    if (correct - 1 >= floor) choices.add(correct - 1);
    choices.add(correct + 1);
    if (correct - 2 >= floor) choices.add(correct - 2);
    choices.add(correct + 2);
  } else {
    // 'swap' forces the num/denom partner; 'wide' includes it opportunistically.
    if (other !== correct && other >= floor) choices.add(other);
    if (correct - 1 >= floor) choices.add(correct - 1);
    choices.add(correct + 1);
    choices.add(correct + 2);
  }

  // Fill any remaining slots with positive integers we haven't used.
  let v = Math.max(floor, 1);
  while (choices.size < 4) {
    if (!choices.has(v)) choices.add(v);
    v++;
  }
  // For 'tight', prefer the neighbors closest to `correct` if we overran.
  const arr = Array.from(choices);
  if (tightness === 'tight') {
    arr.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
  }
  return shuffle(arr.slice(0, 4));
}

// ---------------------------------------------------------------------------
// Build challenges array from fraction pairs + per-pair choice arrays
// ---------------------------------------------------------------------------

function buildChallenges(
  challengeType: ChallengeType,
  count: number,
  // Support-tier distractor proximity (identify lever). Defaults to 'wide' so the
  // no-tier path produces byte-identical choices to before.
  tightness: DistractorTightness = 'wide',
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
    numeratorChoices: buildChoices(pair.numerator, pair.denominator, 0, tightness),
    denominatorChoices: buildChoices(pair.denominator, pair.numerator, 2, tightness),
  }));
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

type FractionBarConfig = {
    targetEvalMode?: string;
    /** Number of challenges in this session. Default 3 (matches §6e pilot). */
    instanceCount?: number;
    showDecimal?: boolean;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * The second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-bar scaffolding + how tight the MC distractors are
     * within it. NEVER changes the fractions (denominator windows own magnitude).
     */
    difficulty?: string;
};

export const generateFractionBar = async (
  ctx: GenerationContext,
): Promise<FractionBarData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as FractionBarConfig;
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

  // ── Within-mode support tier (only meaningful within ONE pinned mode) ──
  // The eval mode owns WHAT skill; config.difficulty owns how much on-bar
  // scaffolding (decimal/numerals/readout) + MC distractor proximity within it.
  // A mixed-mode session (no single pinned type) has no single tier surface, so
  // the tierSection prompt tone applies only when exactly one mode is selected.
  // Application (below) is per-challenge from each ch.type, gated only on the tier.
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ChallengeType)
      : undefined;
  const supportTier = normalizeSupportTier(config?.difficulty);
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level + MC distractor proximity — NOT fraction size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

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
${tierSection}
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

  // ── Resolve the support scaffold from the FINAL challenge type (mode-correct).
  // fraction-bar sessions are single-mode (all challenges share challengeType), so
  // a per-challenge sweep collapses to one scaffold; we still resolve from the type
  // and gate ONLY on the tier being present (the global rule). ──
  const appliedScaffold = supportTier
    ? resolveSupportStructure(challengeType, supportTier)
    : null;

  // MC distractor proximity is a build-time choice array lever (identify is the
  // structural target; other modes inherit 'wide' since distractor tightness only
  // changes the recognition difficulty of the num/denom MC, never the bar task).
  const distractorTightness: DistractorTightness =
    appliedScaffold && challengeType === 'identify'
      ? appliedScaffold.distractorTightness
      : 'wide';

  const challenges = buildChallenges(challengeType, instanceCount, distractorTightness);

  // Decimal: tier wins when present; else the existing config/grade-based behavior.
  const showDecimal = appliedScaffold
    ? appliedScaffold.showDecimal
    : (config?.showDecimal ??
       (typeof wrapper.showDecimal === 'boolean' ? wrapper.showDecimal : true));

  // New tier-driven component fields. Default to current (shown) behavior when no
  // tier so the no-tier path is byte-identical.
  const showPartitionNumerals = appliedScaffold ? appliedScaffold.showPartitionNumerals : true;
  const showShadedReadout = appliedScaffold ? appliedScaffold.showShadedReadout : true;
  const showPromptGloss = appliedScaffold ? appliedScaffold.showPromptGloss : true;

  if (supportTier && appliedScaffold) {
    console.log(
      `[FractionBar] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'mode ' + challengeType}) → ` +
        `decimal=${showDecimal}, partitionNumerals=${showPartitionNumerals}, shadedReadout=${showShadedReadout}, ` +
        `promptGloss=${showPromptGloss}, distractors=${distractorTightness}`,
    );
  }

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
    showPartitionNumerals,
    showShadedReadout,
    showPromptGloss,
    // Persist the tier so the tutor can match the on-screen reveal level.
    ...(supportTier ? { supportTier } : {}),
    gradeLevel: wrapper.gradeLevel || gradeLevel,
  };
};
