/**
 * Double Number Line Generator — IRT-aware proportional-reasoning generator.
 *
 * Multi-instance schema: a single session walks the student through 3-6 ratio
 * challenges of the same eval mode. Every challenge shares ONE ratio
 * relationship (e.g. all flour→cookies, all dollars→hours) for context
 * coherence — only the target ask-points vary per challenge.
 *
 * Generation strategy (Fork B / hybrid — per PRD §4 A2):
 *   - ONE Gemini call establishes the session-level scenario: topLabel,
 *     bottomLabel, unitRate (= unitRateOutput), the umbrella contextQuestion,
 *     plus a pool of candidate target inputs.
 *   - Locally build N challenges by sampling distinct target inputs from the
 *     pool. Per-challenge `givenPoints` / `targetPoints` / `prompt` are
 *     derived deterministically based on the active challengeType.
 *
 * Why hybrid: per-challenge per-input fan-out (N Gemini calls) costs N× tokens
 * for what is essentially a number-pool refresh on a shared scenario. Single-
 * call wrapper + local construction keeps the cost flat while still producing
 * 3-6 distinct ratio challenges with shared topLabel/bottomLabel coherence.
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

// ---------------------------------------------------------------------------
// Public types (mirrored by the component)
// ---------------------------------------------------------------------------

export type DoubleNumberLineChallengeType =
  | 'equivalent_ratios'
  | 'find_missing'
  | 'unit_rate';

export interface LinkedPoint {
  topValue: number;
  bottomValue: number;
  label?: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  interval: number;
}

/**
 * One ratio challenge. Shares session-level topLabel/bottomLabel/unitRate
 * with siblings — only the target ask-points vary.
 */
export interface DoubleNumberLineChallenge {
  id: string;
  challengeType: DoubleNumberLineChallengeType;
  prompt: string;
  hint: string;
  givenPoints: LinkedPoint[];
  targetPoints: LinkedPoint[];
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
}

export interface DoubleNumberLineData {
  title: string;
  description: string;
  topLabel: string;
  bottomLabel: string;
  /** Bottom value when top = 1. Session-level for tutor context. */
  unitRate: number;
  contextQuestion: string;
  /** 3-6 challenges. Required. Walked sequentially by the component. */
  challenges: DoubleNumberLineChallenge[];

  showVerticalGuides?: boolean;
  showUnitRate?: boolean;
  /**
   * Tick value-label density. 'all' = every tick labeled (default, current
   * behavior); 'endpoints' = only the first + last tick labeled (interior
   * thinned); 'none' = no interior labels (the component STILL keeps the
   * min/max endpoint labels so scale magnitude is never hidden). Support-tier
   * lever — never changes the scale, only how much of it is read for you.
   */
  showTickLabels?: 'all' | 'endpoints' | 'none';
  /**
   * Whether the given-pair value BADGE is shown on the bottom line (the dot
   * always stays). true = current behavior. false withdraws the printed value
   * while keeping the point plotted — a support-tier scaffold withdrawal, not
   * a magnitude change. Never affects the target's given topValue.
   */
  showGivenValues?: boolean;
  /** Active support tier, persisted for the live tutor's reveal policy. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: import('../../evaluation/types').PrimitiveEvaluationResult<
      import('../../evaluation/types').DoubleNumberLineMetrics
    >
  ) => void;
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  equivalent_ratios: {
    promptDoc:
      `"equivalent_ratios": The unit rate is GIVEN (shown as a labeled given point). `
      + `Students multiply to find equivalent ratio pairs. Easiest mode — pure scaling. `
      + `Each per-session challenge asks for ONE multiple of the unit rate.`,
    schemaDescription: "'equivalent_ratios' (scale given unit rate)",
  },
  find_missing: {
    promptDoc:
      `"find_missing": A non-unit ratio pair is given. Students use it to find missing values. `
      + `Intermediate — requires identifying the relationship. `
      + `Each per-session challenge asks for ONE missing value.`,
    schemaDescription: "'find_missing' (find missing values in ratio table)",
  },
  unit_rate: {
    promptDoc:
      `"unit_rate": A non-unit pair is given. Students must DISCOVER the unit rate via division. `
      + `Hardest mode — first challenge often asks for the unit rate itself. `
      + `Each per-session challenge asks for ONE specific value.`,
    schemaDescription: "'unit_rate' (discover unit rate from non-unit pair)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// Two-field contract: config.targetEvalMode says WHICH skill (task identity,
// matched to the objective by the manifest); config.difficulty says how much
// on-screen SUPPORT the student gets while doing it ('easy' = max scaffolding,
// 'hard' = min). NEVER changes the ratio numbers or the scale magnitude — the
// per-mode builders + scope own those. A harder tier withdraws guides, the
// unit-rate dot, tick value labels, and given-value badges; it never makes the
// numbers bigger. See memory: structural-difficulty-not-numeric.

type SupportTier = 'easy' | 'medium' | 'hard';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * STRICT lookup — the manifest enum-constrains config.difficulty to these.
 * Unknown/absent → null (no tier applied; defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type HintExplicitness = 'explicit' | 'strategy' | 'generic';

interface SupportScaffold {
  /** Vertical alignment guides linking top→bottom positions. Withdrawn at hard. */
  showVerticalGuides: boolean;
  /** Yellow unit-rate dot + 'Unit Rate' badge on the top line. */
  showUnitRate: boolean;
  /** Tick value-label density. 'endpoints'/'none' still keep the min/max labels. */
  showTickLabels: 'all' | 'endpoints' | 'none';
  /** Whether the given-pair value badge is printed (the dot always stays). */
  showGivenValues: boolean;
  /** How explicit the hint text is: explicit (numbers baked in) → strategy → generic. */
  hintExplicitness: HintExplicitness;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-screen support structure for a tier on a pinned challenge type.
 * Support withdraws as the tier hardens; every line reframes the SAME task with
 * less scaffolding — never a different task, never bigger numbers, never a
 * different scale. Endpoint tick labels are ALWAYS preserved downstream so the
 * scale magnitude reads identically at every tier.
 */
function resolveSupportStructure(pinnedType: DoubleNumberLineChallengeType, tier: SupportTier): SupportScaffold {
  const showVerticalGuides = tier !== 'hard';
  // unit-rate dot: equivalent_ratios shows it at easy only (withdrawn med+);
  // find_missing/unit_rate never plot a unit-rate dot (they give a non-unit pair).
  const showUnitRate = pinnedType === 'equivalent_ratios' ? tier === 'easy' : false;
  const showTickLabels: 'all' | 'endpoints' | 'none' =
    tier === 'easy' ? 'all' : tier === 'medium' ? 'endpoints' : 'none';
  // given-pair value badge: shown easy, withdrawn med+ (dot stays). For
  // equivalent_ratios the "given" is the unit-rate dot, governed by showUnitRate.
  const showGivenValues = tier === 'easy';
  const hintExplicitness: HintExplicitness =
    tier === 'easy' ? 'explicit' : tier === 'medium' ? 'strategy' : 'generic';

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-screen SCAFFOLDING only (${tier === 'easy' ? 'maximum support: guides, labels, and the unit-rate cue help the student read the lines' : tier === 'medium' ? 'moderate support: guides stay but labels/badges thin out; the student reads more of the scale unaided' : 'minimum support: guides off, value labels off, the student reasons about the rate unaided'}). Keep every ratio value and the scale within scope; a harder tier NEVER means bigger numbers or a different scale, only less on-screen help reading them.`,
  ];
  switch (pinnedType) {
    case 'equivalent_ratios':
      promptLines.push(
        tier === 'easy'
          ? 'State the unit rate explicitly and have the hint name the multiply step with the numbers.'
          : tier === 'hard'
            ? 'Keep the hint generic ("use the rate you know"); do not name the operation or numbers.'
            : 'Name the scaling strategy in the hint but do not bake the arithmetic into it.',
      );
      break;
    case 'find_missing':
      promptLines.push(
        tier === 'easy'
          ? 'Label the given pair and have the hint walk both steps (find the unit rate, then multiply).'
          : tier === 'hard'
            ? 'Keep the hint generic; the student must identify the relationship from the line unaided.'
            : 'Hint should prompt "find the unit rate first" without giving the full arithmetic.',
      );
      break;
    case 'unit_rate':
      promptLines.push(
        tier === 'easy'
          ? 'Show the given value and have the hint name the division explicitly.'
          : tier === 'hard'
            ? 'Keep the hint generic; the student must decide to divide unaided.'
            : 'Hint should cue "divide" without giving the full computation.',
      );
      break;
  }
  return {
    showVerticalGuides,
    showUnitRate,
    showTickLabels,
    showGivenValues,
    hintExplicitness,
    promptLines,
  };
}

/**
 * Rewrite a per-challenge hint toward the tier's explicitness WITHOUT touching
 * the value/ask logic (which the builders own). 'explicit' keeps the
 * builder's number-baked hint; 'strategy' names the approach; 'generic' gives a
 * bare nudge. Mode-aware so the strategy named matches the task.
 */
function applyHintExplicitness(
  mode: DoubleNumberLineChallengeType,
  explicitness: HintExplicitness,
  builtHint: string,
): string {
  if (explicitness === 'explicit') return builtHint;
  if (explicitness === 'strategy') {
    switch (mode) {
      case 'equivalent_ratios':
        return 'Scale the unit rate up to the value you need.';
      case 'find_missing':
        return 'Find the unit rate from the given pair first, then use it.';
      case 'unit_rate':
        return 'Divide the given pair to find the amount per 1 unit.';
    }
  }
  // generic
  return 'Use what the number line shows you to find the value.';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;
const MIN_INSTANCE_COUNT = 3;
const MODEL = "gemini-flash-lite-latest";

// ---------------------------------------------------------------------------
// Session-wrapper schema
// ---------------------------------------------------------------------------

const sessionWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short title describing the relationship (e.g., 'Flour to Cookies')",
    },
    description: {
      type: Type.STRING,
      description: "One sentence explaining what students will practice across the session",
    },
    challengeType: {
      type: Type.STRING,
      enum: ["equivalent_ratios", "find_missing", "unit_rate"],
      description: "Challenge type for every challenge in this session",
    },
    contextQuestion: {
      type: Type.STRING,
      description:
        "Umbrella real-world setup that applies to ALL challenges in this session "
        + "(e.g., '1 cup of flour makes 3 cookies. Use this rate to answer each question.'). "
        + "Should explicitly state the unit rate when challengeType is equivalent_ratios.",
    },
    topLabel: {
      type: Type.STRING,
      description: "Name of input quantity (e.g., 'Cups of Flour', 'Hours')",
    },
    bottomLabel: {
      type: Type.STRING,
      description: "Name of output quantity (e.g., 'Cookies Made', 'Miles')",
    },
    unitRateOutput: {
      type: Type.NUMBER,
      description:
        "OUTPUT when input = 1. The shared unit rate for the whole session. "
        + "Pick a whole number or simple decimal (e.g., 3, 4, 0.5, 60).",
    },
    maxInput: {
      type: Type.NUMBER,
      description: "Maximum input value for the number line (5-10 for simple problems).",
    },
    askInputs: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description:
        "Pool of 5-7 DISTINCT input values for individual challenges to draw from. "
        + "Should NOT include 1 (unit rate). Spread across 2..maxInput. "
        + "These become the per-challenge target ask-points.",
    },
  },
  required: [
    "title", "description", "challengeType", "contextQuestion",
    "topLabel", "bottomLabel", "unitRateOutput", "maxInput", "askInputs",
  ],
};

// ---------------------------------------------------------------------------
// Per-challenge builders (local — pool-style)
// ---------------------------------------------------------------------------

const ORIGIN: LinkedPoint = { topValue: 0, bottomValue: 0, label: 'Start' };

interface SessionContext {
  topLabel: string;
  bottomLabel: string;
  unitRate: number;             // bottom when top = 1
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
}

/** Pick a non-unit pair (top ≠ 1, top ≥ 2) to use as the "given" reference. */
function pickNonUnitGiven(askInputs: number[], unitRate: number): LinkedPoint {
  const candidates = askInputs.filter((n) => n !== 1 && n >= 2);
  const top = candidates[0] ?? 2;
  return { topValue: top, bottomValue: top * unitRate, label: 'Given' };
}

function buildEquivalentRatiosChallenge(
  ctx: SessionContext,
  askInput: number,
): Pick<DoubleNumberLineChallenge, 'givenPoints' | 'targetPoints' | 'prompt' | 'hint'> {
  const unitRatePoint: LinkedPoint = {
    topValue: 1,
    bottomValue: ctx.unitRate,
    label: 'Unit Rate',
  };
  const target: LinkedPoint = {
    topValue: askInput,
    bottomValue: askInput * ctx.unitRate,
    label: `Find for ${askInput}`,
  };
  return {
    givenPoints: [ORIGIN, unitRatePoint],
    targetPoints: [target],
    prompt: `Use the unit rate to find ${ctx.bottomLabel} when ${ctx.topLabel} = ${askInput}.`,
    hint: `Multiply ${askInput} × ${ctx.unitRate} (the unit rate).`,
  };
}

function buildFindMissingChallenge(
  ctx: SessionContext,
  askInput: number,
  givenReference: LinkedPoint,
): Pick<DoubleNumberLineChallenge, 'givenPoints' | 'targetPoints' | 'prompt' | 'hint'> {
  const target: LinkedPoint = {
    topValue: askInput,
    bottomValue: askInput * ctx.unitRate,
    label: `Find for ${askInput}`,
  };
  return {
    givenPoints: [ORIGIN, givenReference],
    targetPoints: [target],
    prompt:
      `Given ${givenReference.topValue} ${ctx.topLabel} = ${givenReference.bottomValue} ${ctx.bottomLabel}, `
      + `find ${ctx.bottomLabel} when ${ctx.topLabel} = ${askInput}.`,
    hint:
      `First find the unit rate: ${givenReference.bottomValue} ÷ ${givenReference.topValue} = ${ctx.unitRate}. `
      + `Then multiply by ${askInput}.`,
  };
}

function buildUnitRateChallenge(
  ctx: SessionContext,
  askInput: number,
  givenReference: LinkedPoint,
  isFirstChallenge: boolean,
): Pick<DoubleNumberLineChallenge, 'givenPoints' | 'targetPoints' | 'prompt' | 'hint'> {
  if (isFirstChallenge) {
    // First challenge: derive the unit rate explicitly
    const unitRatePoint: LinkedPoint = {
      topValue: 1,
      bottomValue: ctx.unitRate,
      label: 'Unit Rate',
    };
    return {
      givenPoints: [ORIGIN, givenReference],
      targetPoints: [unitRatePoint],
      prompt: `Find the unit rate: when ${ctx.topLabel} = 1, what is ${ctx.bottomLabel}?`,
      hint: `Divide: ${givenReference.bottomValue} ÷ ${givenReference.topValue}.`,
    };
  }
  // Subsequent challenges: use the unit rate to find arbitrary values
  const target: LinkedPoint = {
    topValue: askInput,
    bottomValue: askInput * ctx.unitRate,
    label: `Find for ${askInput}`,
  };
  return {
    givenPoints: [ORIGIN, givenReference],
    targetPoints: [target],
    prompt: `Now find ${ctx.bottomLabel} when ${ctx.topLabel} = ${askInput}.`,
    hint:
      `Unit rate is ${ctx.unitRate} (from ${givenReference.bottomValue} ÷ ${givenReference.topValue}). `
      + `Multiply by ${askInput}.`,
  };
}

// ---------------------------------------------------------------------------
// Scale helpers
// ---------------------------------------------------------------------------

function buildScales(maxInput: number, unitRate: number): {
  topScale: ScaleConfig;
  bottomScale: ScaleConfig;
} {
  const maxOutput = maxInput * unitRate;
  const topInterval = maxInput <= 10 ? 1 : Math.ceil(maxInput / 10);
  const bottomInterval = maxOutput <= 20
    ? (unitRate <= 5 ? unitRate : 1)
    : Math.ceil(maxOutput / 10);
  return {
    topScale: { min: 0, max: maxInput, interval: Math.max(1, topInterval) },
    bottomScale: { min: 0, max: maxOutput, interval: Math.max(0.5, bottomInterval) },
  };
}

// ---------------------------------------------------------------------------
// Ratio-direction validator
// ---------------------------------------------------------------------------

/**
 * Detects when Gemini emits an inverted unit rate. If the context states a
 * specific rate ("1 X = N Y") but unitRateOutput came back as 1/N, fix it.
 */
function correctInvertedRatio(contextQuestion: string, unitRateOutput: number): number {
  const ctxLower = (contextQuestion || '').toLowerCase();
  const ratioMatch = ctxLower.match(/\b1\b[^.]*?\b(\d+(?:\.\d+)?)\b/);
  if (!ratioMatch) return unitRateOutput;
  const statedValue = parseFloat(ratioMatch[1]);
  if (statedValue > 1 && Math.abs(unitRateOutput - 1 / statedValue) < 0.01) {
    console.warn(
      `[DoubleNumberLine] Ratio direction mismatch: context states rate ~${statedValue} `
      + `but unitRateOutput=${unitRateOutput}. Correcting to ${statedValue}.`,
    );
    return statedValue;
  }
  return unitRateOutput;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export const generateDoubleNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: {
    topLabel?: string;
    bottomLabel?: string;
    topScale?: ScaleConfig;
    bottomScale?: ScaleConfig;
    showUnitRate?: boolean;
    showVerticalGuides?: boolean;
    /** How many challenges in this session. Default 4, clamped to [3, 6]. */
    instanceCount?: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes the
     * ratio numbers or the scale magnitude.
     */
    difficulty?: string;
  },
): Promise<DoubleNumberLineData> => {
  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'double-number-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('DoubleNumberLine', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(sessionWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : sessionWrapperSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Within-mode support tier ──────────────────────────────────────────────
  // supportTier is the STUDENT's tier and DRIVES application (single mode only
  // here — every challenge in a session shares one challengeType). pinnedType is
  // used both for the prompt tone and for application (one mode per session).
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as DoubleNumberLineChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number/scale size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  const instanceCount = Math.min(
    MAX_INSTANCE_COUNT,
    Math.max(MIN_INSTANCE_COUNT, config?.instanceCount ?? DEFAULT_INSTANCE_COUNT),
  );

  const prompt = `
Create a multi-challenge double number line session for "${topic}" (${gradeLevel}).

This session contains ${instanceCount} ratio challenges that all share ONE proportional
relationship (e.g., all flour→cookies, all dollars→hours). Per-challenge target ask-points
will be derived locally — your job is to set up the SHARED session context.

${challengeTypeSection}
${tierSection}
WHAT YOU NEED TO CREATE:
- title: Short, clear title (e.g., "Baking Cookies: Flour to Cookies")
- description: One sentence describing what students will practice across all ${instanceCount} challenges
- challengeType: Must match the constrained type${evalConstraint ? ` (${evalConstraint.allowedTypes.join(' or ')})` : ''}
- contextQuestion: Umbrella real-world setup that applies to EVERY challenge in this session
- topLabel: Input quantity name (e.g., "Cups of Flour")
- bottomLabel: Output quantity name (e.g., "Cookies Made")
- unitRateOutput: bottomLabel value when topLabel = 1. The shared unit rate.
- maxInput: Maximum input value (5-10)
- askInputs: 5-7 DISTINCT input values for individual challenges (NOT 1; spread across 2..maxInput)

RULES:
- unitRateOutput: Nice whole number or simple decimal (e.g., 3, 4, 0.5, 60)
- askInputs: All > 1, all ≤ maxInput, all distinct. Aim for at least 6 entries so we can pick ${instanceCount} distinct asks.
- All ${instanceCount} challenges in this session share topLabel/bottomLabel/unitRateOutput. Pick ONE coherent context.
- Use concrete, relatable contexts for the grade level.
- CRITICAL — RATIO DIRECTION: topLabel is INPUT, bottomLabel is OUTPUT. unitRateOutput is bottomLabel per 1 topLabel.
  If context says "1 can of paint covers 4 feet", topLabel="Cans of Paint", bottomLabel="Feet", unitRateOutput=4.
  NEVER invert.

Return the session setup. Per-challenge ask-points are derived locally from askInputs.
`;

  const result = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const raw = result.text ? JSON.parse(result.text) : null;
  if (!raw) {
    throw new Error('No valid double number line session data returned from Gemini API');
  }

  // ---- Normalize session-level fields ----
  const title = String(raw.title ?? 'Double Number Line');
  const description = String(raw.description ?? 'Find proportional relationships.');
  const challengeType = (raw.challengeType ?? 'equivalent_ratios') as DoubleNumberLineChallengeType;
  const contextQuestion = String(raw.contextQuestion ?? '');
  const topLabel = String(raw.topLabel ?? 'Input');
  const bottomLabel = String(raw.bottomLabel ?? 'Output');
  let unitRate = Number(raw.unitRateOutput ?? 1);
  if (!Number.isFinite(unitRate) || unitRate <= 0) unitRate = 1;
  unitRate = correctInvertedRatio(contextQuestion, unitRate);

  const maxInput = Math.max(5, Math.min(20, Math.round(Number(raw.maxInput ?? 10))));

  const askInputsRaw = Array.isArray(raw.askInputs) ? raw.askInputs : [2, 3, 4, 5, 6];
  // Dedupe, drop 1, drop non-positive, drop > maxInput, round to whole numbers
  const seen = new Set<number>();
  const askInputs: number[] = [];
  for (const n of askInputsRaw) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v) || v <= 1 || v > maxInput) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    askInputs.push(v);
  }
  // Backfill if Gemini gave too few
  let fillCandidate = 2;
  while (askInputs.length < instanceCount + 1 && fillCandidate <= maxInput) {
    if (!seen.has(fillCandidate) && fillCandidate > 1) {
      seen.add(fillCandidate);
      askInputs.push(fillCandidate);
    }
    fillCandidate++;
  }

  // ---- Build session context ----
  const { topScale, bottomScale } = buildScales(maxInput, unitRate);
  const ctx: SessionContext = {
    topLabel,
    bottomLabel,
    unitRate,
    topScale,
    bottomScale,
  };

  // ---- Build N challenges ----
  // For find_missing / unit_rate modes, the "given" reference pair is shared
  // across all challenges in the session so the visual stays consistent.
  const givenReference = pickNonUnitGiven(askInputs, unitRate);
  // Asks used for ask-points exclude the value used as the given reference.
  const challengeAsks = askInputs.filter((n) => n !== givenReference.topValue).slice(0, instanceCount);
  // If we still don't have enough, fall back to any from the pool
  while (challengeAsks.length < instanceCount) {
    const next = askInputs.find((n) => !challengeAsks.includes(n));
    if (next === undefined) break;
    challengeAsks.push(next);
  }

  const challenges: DoubleNumberLineChallenge[] = [];
  for (let i = 0; i < instanceCount; i++) {
    const askInput = challengeAsks[i] ?? challengeAsks[challengeAsks.length - 1] ?? 2;
    let core: Pick<DoubleNumberLineChallenge, 'givenPoints' | 'targetPoints' | 'prompt' | 'hint'>;
    switch (challengeType) {
      case 'find_missing':
        core = buildFindMissingChallenge(ctx, askInput, givenReference);
        break;
      case 'unit_rate':
        core = buildUnitRateChallenge(ctx, askInput, givenReference, i === 0);
        break;
      case 'equivalent_ratios':
      default:
        core = buildEquivalentRatiosChallenge(ctx, askInput);
        break;
    }
    challenges.push({
      id: `dnl-${i + 1}`,
      challengeType,
      ...core,
      topScale,
      bottomScale,
    });
  }

  console.log('📈 Double Number Line generated:', {
    topic,
    mode: challengeType,
    instanceCount: challenges.length,
    unitRate,
    topLabel,
    bottomLabel,
    challengeAsks,
  });

  const data: DoubleNumberLineData = {
    title,
    description,
    topLabel,
    bottomLabel,
    unitRate,
    contextQuestion,
    challenges,
    showVerticalGuides: config?.showVerticalGuides ?? true,
    showUnitRate: config?.showUnitRate ?? true,
  };

  // Apply config overrides (kept for backwards-compat with manifest payloads)
  if (config?.topLabel) data.topLabel = config.topLabel;
  if (config?.bottomLabel) data.bottomLabel = config.bottomLabel;

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM/builders only chose the numbers). Runs AFTER everything
  // else, gated only on a tier being present, resolved per challenge from its OWN
  // mode. PRESENTATION only — the value/ask logic (incl. the fragile unit_rate
  // builders) is left untouched. NEVER changes the ratio numbers or the scale.
  // Endpoint tick labels are preserved by the component, so 'none' never hides
  // the scale magnitude. The target's given topValue stays (not a leak); the
  // target BOTTOM value is never pre-plotted. ──
  if (supportTier) {
    // Session-level flags follow the (single) session mode's scaffold.
    const sessionType = (pinnedType ?? data.challenges[0]?.challengeType) as
      | DoubleNumberLineChallengeType
      | undefined;
    if (sessionType) {
      const sc = resolveSupportStructure(sessionType, supportTier);
      data.showVerticalGuides = sc.showVerticalGuides;
      data.showUnitRate = sc.showUnitRate;
      data.showTickLabels = sc.showTickLabels;
      data.showGivenValues = sc.showGivenValues;
    }
    data.supportTier = supportTier;
    // Hint explicitness withdraws per challenge from the challenge's own mode.
    for (const ch of data.challenges) {
      const sc = resolveSupportStructure(ch.challengeType, supportTier);
      ch.hint = applyHintExplicitness(ch.challengeType, sc.hintExplicitness, ch.hint);
    }
    console.log(
      `[DoubleNumberLine] Support tier "${supportTier}" applied (${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → `
      + `guides=${data.showVerticalGuides}, unitRate=${data.showUnitRate}, tickLabels=${data.showTickLabels}, givenValues=${data.showGivenValues}`,
    );
  }

  return data;
};
