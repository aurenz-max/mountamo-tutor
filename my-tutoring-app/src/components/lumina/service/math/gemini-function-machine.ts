/**
 * Function Machine Generator — multi-instance pool-service generator.
 *
 * Per PRD_WITHIN_MODE_INSTANCE_DENSITY §7 entry #6 + §6f post-mortem.
 *
 * Each session walks the student through 3 distinct function rules in the
 * SAME eval mode. The four eval modes (observe / predict / discover_rule /
 * create_rule) used to be in-component "phases" walked sequentially over ONE
 * rule; that conflicted with the new world where eval mode = challenge type
 * and the engine pins to one mode per session (PRD §6a #7). Now each mode is
 * a discrete interaction shape and the session multiplies on rule count.
 *
 * Per-challenge data is value-only ({rule, inputQueue, showRule}). Strings
 * are short and deterministic-friendly — structured-output Gemini converges
 * across calls (PRD §6a #2), so we keep the rule pool local and let Gemini
 * emit only the session wrapper. Mirrors factor-tree, place-value-chart,
 * area-model.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  FunctionMachineData,
  FunctionMachineChallenge,
} from "../../primitives/visual-primitives/math/FunctionMachine";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  observe: {
    promptDoc:
      `"observe": Rule IS shown. Student watches inputs flow through the machine and sees outputs. `
      + `Full guidance — the student observes how the rule transforms each input. `
      + `Concrete manipulative with full scaffolding.`,
    schemaDescription: "'observe' (watch input/output with rule visible)",
  },
  predict: {
    promptDoc:
      `"predict": Rule IS shown. Student must predict outputs BEFORE feeding inputs into the machine. `
      + `Tests mental application of the rule. Pictorial with prompts.`,
    schemaDescription: "'predict' (predict output for new input)",
  },
  discover_rule: {
    promptDoc:
      `"discover_rule": Rule is HIDDEN. Student sees input/output pairs and must figure out the rule. `
      + `Inputs chosen to make the pattern discoverable but not trivial. Strategy/pictorial with reduced prompts.`,
    schemaDescription: "'discover_rule' (identify hidden function rule)",
  },
  create_rule: {
    promptDoc:
      `"create_rule": Student is given a complete table of I/O pairs and must write the rule expression. `
      + `Transitional symbolic — bridges concrete understanding to algebraic notation.`,
    schemaDescription: "'create_rule' (write rule for given I/O pairs)",
  },
};

// ---------------------------------------------------------------------------
// Rule pool (per eval mode × rule complexity)
// ---------------------------------------------------------------------------

/**
 * Each entry is a normalized rule string using 'x' as the variable, '*' for
 * multiplication, '^' for exponents. Pools are grouped by complexity so the
 * mode profile can pick the right band.
 */
const RULE_POOLS: Record<'oneStep' | 'twoStep' | 'expression', string[]> = {
  oneStep: [
    'x + 1', 'x + 2', 'x + 3', 'x + 4', 'x + 5', 'x + 7', 'x + 10',
    'x - 1', 'x - 2', 'x - 3', 'x - 5',
    '2*x', '3*x', '4*x', '5*x', '10*x',
    'x/2',
  ],
  twoStep: [
    '2*x + 1', '2*x + 3', '2*x - 1', '2*x - 3',
    '3*x + 1', '3*x + 2', '3*x - 2', '3*x - 4',
    '4*x + 1', '4*x - 3',
    'x/2 + 1', 'x/2 + 3',
  ],
  expression: [
    'x^2', 'x^2 + 1', 'x^2 - 1', 'x^2 + 2', 'x^2 - 3',
    '2*x^2', '2*x^2 + 1', 'x^2 + x',
  ],
};

// ---------------------------------------------------------------------------
// Within-mode difficulty = structural SUPPORT tier (config.difficulty)
// ---------------------------------------------------------------------------
// The two-field contract (same as ten-frame / counting-board): config.targetEvalMode
// says WHICH skill (task identity = the eval mode, matched to the objective by the
// manifest); config.difficulty says how much on-screen SUPPORT the student gets while
// doing it ('easy' = max scaffolding, 'hard' = min).
//
// ⚠️ MODE-IDENTITY GUARD (the hard invariant for THIS primitive): a tier NEVER flips
// `showRule`. `showRule` is owned by the mode (observe/predict = true, discover/create
// = false) and DEFINES the task. Revealing the rule in discover/create would turn it
// into observe/predict — a different eval mode. Tiers in discover/create withdraw
// PAIRS and HINTS, never the rule. Magnitude (the rule pool) is fixed by
// `ruleComplexity`; a tier NEVER changes it. See memory: structural-difficulty-not-numeric.

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

interface SupportScaffold {
  /**
   * How many I/O pairs the student must feed before the challenge can complete.
   * Drives observe-hard ("require all inputs fed") and predict-hard ("more inputs
   * to predict"). null = use the mode's default completion gate. Bounded to the
   * mode's inputQueue length — NEVER grows the queue or the numbers.
   */
  pairsRequiredToComplete: number | null;
  /**
   * For create_rule only: how many rows of the I/O table are pre-revealed.
   * Withdrawing rows makes the student extrapolate. MUST stay ≥2 so the rule is
   * uniquely determinable. null = full table (default). Never < 2.
   */
  prefilledPairCount: number | null;
  /** Show the rule-complexity badge ("One-Step"/"Two-Step"/"Expression") chrome cue. */
  showComplexityBadge: boolean;
  /** How-it-works / hint scaffolding level. 'full' = how-it-works + early hints;
   *  'minimal' = standard (hint after 2 attempts); 'none' = no scaffolding hints. */
  hintLevel: 'full' | 'minimal' | 'none';
  /** outputDisplay override for the tier (observe/predict only). null = keep mode default. */
  outputDisplay: 'immediate' | 'animated' | 'hidden' | null;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Resolve the on-screen support structure for a tier on a pinned challenge type.
 * Support is withdrawn as the tier hardens; the per-mode lines reframe the SAME
 * task with less scaffolding — never a different task, never a different rule.
 *
 * ⚠️ This function NEVER touches `showRule`. Rule visibility is the mode's identity
 * (observe/predict show it, discover/create hide it); a tier may only withdraw
 * PAIRS / HINTS / chrome, never reveal a hidden rule.
 */
function resolveSupportStructure(
  pinnedType: FunctionMachineChallengeType,
  tier: SupportTier,
): SupportScaffold {
  // Defaults = current behavior (so a no-tier path is byte-identical).
  const queueLen = MODE_PROFILES[pinnedType]?.inputQueue.length ?? 5;

  let pairsRequiredToComplete: number | null = null;
  let prefilledPairCount: number | null = null;
  let showComplexityBadge = true;
  let hintLevel: 'full' | 'minimal' | 'none' = 'minimal';
  let outputDisplay: 'immediate' | 'animated' | 'hidden' | null = null;

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-screen SCAFFOLDING only (${tier === 'easy' ? 'maximum support: the workspace coaches and self-checks for the student' : tier === 'medium' ? 'moderate support: the student does the reasoning with light cues' : 'minimum support: the student works unaided and justifies their thinking'}). The rule pool and every number are fixed by the eval mode and ruleComplexity — a harder tier NEVER changes the rule or the numbers, only how much help the student gets. NEVER reveal the rule in discover_rule/create_rule (that is a DIFFERENT eval mode); harder tiers there withdraw pre-fed pairs and hints instead.`,
  ];

  switch (pinnedType) {
    case 'observe':
      // easy: badge + how-it-works + all pairs. medium: drop step-list (how-it-works),
      // badge stays. hard: require ALL inputs fed, hide badge, output immediate→animated.
      hintLevel = tier === 'easy' ? 'full' : 'none'; // medium drops the step-list too
      showComplexityBadge = tier !== 'hard';
      if (tier === 'hard') {
        pairsRequiredToComplete = queueLen; // require all inputs fed
        outputDisplay = 'animated';
      }
      promptLines.push(
        tier === 'easy'
          ? 'Full guidance: complexity badge, the how-it-works step list, and all I/O pairs are shown so the student can watch every transformation.'
          : tier === 'hard'
            ? 'Minimal guidance: the student must feed every input themselves before continuing; no how-it-works list, no complexity badge.'
            : 'Moderate guidance: the complexity badge stays, but the how-it-works step list is withdrawn.',
      );
      break;
    case 'predict':
      // easy: badge + how-it-works. medium: drop how-it-works. hard: more inputs to
      // predict, hide running score, outputDisplay hidden.
      hintLevel = tier === 'easy' ? 'full' : tier === 'medium' ? 'minimal' : 'none';
      showComplexityBadge = tier !== 'hard';
      if (tier === 'hard') {
        pairsRequiredToComplete = queueLen; // more inputs to predict (the full queue)
        outputDisplay = 'hidden';
      }
      promptLines.push(
        tier === 'easy'
          ? 'Full guidance: complexity badge and the how-it-works step list support the student before each prediction.'
          : tier === 'hard'
            ? 'Minimal guidance: the student predicts the full input queue with the running score hidden and the badge withdrawn.'
            : 'Moderate guidance: the how-it-works step list is withdrawn; the complexity badge stays.',
      );
      break;
    case 'discover_rule':
      // Rule HIDDEN (mode identity). easy: MORE pairs pre-revealed + early hint.
      // medium: standard, hint after 2 attempts (current). hard: FEWER pre-fed pairs / no hint.
      hintLevel = tier === 'easy' ? 'full' : tier === 'hard' ? 'none' : 'minimal';
      if (tier === 'easy') {
        prefilledPairCount = queueLen; // pre-reveal the whole queue's pairs
      } else if (tier === 'hard') {
        prefilledPairCount = Math.max(2, Math.ceil(queueLen / 2)); // fewer, but ≥2
      }
      promptLines.push(
        tier === 'easy'
          ? 'The rule stays HIDDEN (mode identity) but MORE I/O pairs are pre-revealed and an early hint is offered.'
          : tier === 'hard'
            ? 'The rule stays HIDDEN; FEWER pairs are pre-fed and no hint is offered — the student must reason from less evidence. NEVER show the rule.'
            : 'The rule stays HIDDEN; the standard pair set, with a hint after two attempts.',
      );
      break;
    case 'create_rule':
      // Rule HIDDEN (mode identity). easy: FULL table + 1 worked-exemplar row + hint.
      // medium: full table, no exemplar (current). hard: PARTIAL table (≥2 rows), no hint.
      hintLevel = tier === 'easy' ? 'full' : tier === 'hard' ? 'none' : 'minimal';
      if (tier === 'hard') {
        // PARTIAL table: fewer rows, but ALWAYS ≥2 so the rule stays uniquely determinable.
        prefilledPairCount = Math.max(2, Math.ceil(queueLen / 2));
      } else {
        prefilledPairCount = queueLen; // full table for easy + medium
      }
      promptLines.push(
        tier === 'easy'
          ? 'The rule stays HIDDEN (mode identity) but the FULL I/O table is shown with one worked-exemplar row and a hint.'
          : tier === 'hard'
            ? 'The rule stays HIDDEN; only a PARTIAL table (≥2 rows) is shown and no hint — the student must extrapolate. NEVER show the rule.'
            : 'The rule stays HIDDEN; the FULL I/O table is shown with no worked exemplar.',
      );
      break;
  }

  return {
    pairsRequiredToComplete,
    prefilledPairCount,
    showComplexityBadge,
    hintLevel,
    outputDisplay,
    promptLines,
  };
}

// ---------------------------------------------------------------------------
// Mode profiles
// ---------------------------------------------------------------------------

interface ModeProfile {
  showRule: boolean;
  /** Default rule complexity band when the manifest doesn't override. */
  defaultComplexity: 'oneStep' | 'twoStep' | 'expression';
  /** Recommended input queue for a challenge. */
  inputQueue: number[];
  /** Should include 0 as an input (reveals y-intercept for two-step rules). */
  preferIncludeZero?: boolean;
}

const MODE_PROFILES: Record<string, ModeProfile> = {
  observe:       { showRule: true,  defaultComplexity: 'oneStep', inputQueue: [1, 2, 3, 4, 5] },
  predict:       { showRule: true,  defaultComplexity: 'oneStep', inputQueue: [2, 3, 4, 6, 8] },
  discover_rule: { showRule: false, defaultComplexity: 'twoStep', inputQueue: [0, 1, 2, 3, 4], preferIncludeZero: true },
  create_rule:   { showRule: false, defaultComplexity: 'twoStep', inputQueue: [0, 1, 2, 3, 5], preferIncludeZero: true },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts — see PRD_WITHIN_MODE_INSTANCE_DENSITY.md §5a
// ---------------------------------------------------------------------------
// observe / predict are T2 (single-step compute), bumped 3 → 5 in the B4 sweep.
// discover_rule / create_rule are T3 (content-bearing rule reasoning); held at
// 4 per the B5 audit row.

type FunctionMachineChallengeType =
  | 'observe'
  | 'predict'
  | 'discover_rule'
  | 'create_rule';

const DEFAULT_INSTANCE_COUNT = 4; // T3 fallback for any future mode not listed
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<FunctionMachineChallengeType, number> = {
  observe: 5,        // T2 — B4 bump 3 → 5
  predict: 5,        // T2 — B4 bump 3 → 5
  discover_rule: 4,  // T3 hold (B5)
  create_rule: 4,    // T3 hold (B5)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Operation family signature — used for variance enforcement across selected rules. */
function ruleFamily(rule: string): 'add' | 'sub' | 'mul' | 'div' | 'two' | 'sq' | 'other' {
  if (rule.includes('^')) return 'sq';
  const hasMul = /\*/.test(rule);
  const hasPlus = /\+/.test(rule);
  const hasMinus = /(?:^|[^a-zA-Z0-9])-/.test(rule.replace(/^\s*-/, ''));
  const hasDiv = /\//.test(rule);
  if (hasMul && (hasPlus || hasMinus)) return 'two';
  if (hasMul) return 'mul';
  if (hasDiv) return 'div';
  if (hasPlus) return 'add';
  if (hasMinus) return 'sub';
  return 'other';
}

/** Evaluate the rule for an input — used to filter overly-clean or messy outputs. */
function evaluateRule(rule: string, x: number): number | null {
  if (!rule || !rule.trim()) return null;
  try {
    const expression = rule.replace(/x/g, `(${x})`);
    if (!/^[\d+\-*/().^\s]+$/.test(expression)) return null;
    const safe = expression.replace(/\^/g, '**');
    const result = new Function('return ' + safe)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

/** Pre-flight check: rule produces integer outputs for the given inputs and stays under 100. */
function ruleProducesCleanOutputs(rule: string, inputs: number[]): boolean {
  for (const x of inputs) {
    const y = evaluateRule(rule, x);
    if (y === null) return false;
    if (Math.abs(y) > 100) return false;
    if (Math.abs(y - Math.round(y)) > 0.001) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Rule selection — pool service
// ---------------------------------------------------------------------------

export interface SelectFunctionMachineRulesOptions {
  /** How many distinct rules to select for this session. Clamped to [1, MAX_INSTANCE_COUNT]. */
  count?: number;
  /** Complexity band — overrides the mode default. */
  complexity?: 'oneStep' | 'twoStep' | 'expression';
}

/**
 * Pick `count` distinct rules from the pool for a given challenge type. Variance
 * guarantees: includes at least 2 different operation families when the pool
 * allows. Filters out rules whose outputs would be too large or non-integer for
 * the mode's standard input queue.
 */
export function selectFunctionMachineRules(
  challengeType: string,
  options: SelectFunctionMachineRulesOptions = {},
): string[] {
  const profile = MODE_PROFILES[challengeType] ?? MODE_PROFILES.observe;
  const complexity = options.complexity ?? profile.defaultComplexity;
  const modeCount = (COUNT_BY_MODE as Record<string, number>)[challengeType];
  const target = Math.max(
    1,
    Math.min(
      MAX_INSTANCE_COUNT,
      options.count ?? modeCount ?? DEFAULT_INSTANCE_COUNT,
    ),
  );

  const pool = RULE_POOLS[complexity];
  // Filter: outputs must be clean integers under |100| for the standard inputs.
  const eligible = pool.filter((r) => ruleProducesCleanOutputs(r, profile.inputQueue));
  const source = eligible.length >= target ? eligible : pool;

  const shuffled = shuffle(source);
  const selected: string[] = [];
  const families = new Set<string>();

  // First pass: pick rules that introduce a new operation family.
  for (const rule of shuffled) {
    if (selected.length >= target) break;
    const fam = ruleFamily(rule);
    if (!families.has(fam)) {
      selected.push(rule);
      families.add(fam);
    }
  }
  // Second pass: fill the rest.
  for (const rule of shuffled) {
    if (selected.length >= target) break;
    if (!selected.includes(rule)) selected.push(rule);
  }

  // Variance guarantee: if everything ended up the same family AND the pool has
  // a different family available, force-swap the last one.
  if (families.size === 1 && selected.length > 1) {
    const otherFamilyRule = shuffled.find((r) => !selected.includes(r) && ruleFamily(r) !== Array.from(families)[0]);
    if (otherFamilyRule) selected[selected.length - 1] = otherFamilyRule;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Build per-challenge data from rule selection
// ---------------------------------------------------------------------------

function buildChallenges(
  rules: string[],
  challengeType: string,
): FunctionMachineChallenge[] {
  const profile = MODE_PROFILES[challengeType] ?? MODE_PROFILES.observe;
  return rules.map((rule, idx) => ({
    id: `fm-${idx + 1}`,
    rule,
    inputQueue: [...profile.inputQueue],
    showRule: profile.showRule,
  }));
}

// ---------------------------------------------------------------------------
// Wrapper schema — Gemini emits session-level metadata only
// ---------------------------------------------------------------------------

const functionMachineWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challengeType: {
      type: Type.STRING,
      enum: ["observe", "predict", "discover_rule", "create_rule"],
      description: "Challenge type for the session.",
    },
    title: {
      type: Type.STRING,
      description: "Short session title (e.g., 'Function Machine Practice'). Do NOT name specific rules or numbers — the session walks through multiple.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description. Do NOT include specific rules or numbers.",
    },
    ruleComplexity: {
      type: Type.STRING,
      enum: ["oneStep", "twoStep", "expression"],
      description: "Complexity band: 'oneStep' (x+3), 'twoStep' (2x+1), 'expression' (x^2). Match to grade level.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["3-4", "5", "advanced"],
      description: "Grade band: '3-4' for elementary, '5' for grade 5, 'advanced' for middle/high school.",
    },
    outputDisplay: {
      type: Type.STRING,
      enum: ["immediate", "animated", "hidden"],
      description: "How outputs are revealed: 'animated' (default), 'immediate', or 'hidden' (predict mode).",
    },
  },
  required: ["challengeType", "title", "description", "ruleComplexity", "gradeBand"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

type FunctionMachineConfig = {
    /** How many rules in this session. Defaults from COUNT_BY_MODE (5 for T2 observe/predict, 4 for T3 discover/create_rule). */
    instanceCount?: number;
    ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
    gradeBand?: '3-4' | '5' | 'advanced';
    outputDisplay?: 'immediate' | 'animated' | 'hidden';
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * The second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes the rule
     * or any number, and NEVER flips showRule (that is the eval mode's identity).
     */
    difficulty?: string;
};

export const generateFunctionMachine = async (
  ctx: GenerationContext,
): Promise<FunctionMachineData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as FunctionMachineConfig;
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'function-machine',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('FunctionMachine', config?.targetEvalMode, evalConstraint);

  // ── Within-mode support tier ──
  // supportTier is the STUDENT's tier and DRIVES application (per challenge from its
  // own mode). pinnedType is ONLY for the prompt tone (a curated blend has no single
  // mode to describe to the LLM). NEVER flips showRule — that is the eval mode's identity.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as FunctionMachineChallengeType)
      : undefined;
  const tierScaffold =
    pinnedType && supportTier ? resolveSupportStructure(pinnedType, supportTier) : null; // tone only
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT the rule or numbers)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(functionMachineWrapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : functionMachineWrapperSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-challenge function machine session on "${topic}"
${scopeSection} for ${gradeLevel} students.

CONTEXT:
- A function machine session contains 3-6 separate function rules of the SAME challenge type.
- The system has ALREADY pre-selected the rules and input queues for each challenge; you do NOT pick rules or numbers.
- Your job is to write the session-level title and description, and to set the mode flags (challengeType, ruleComplexity, gradeBand, outputDisplay).

${challengeTypeSection}
${tierSection}
GRADE-COMPLEXITY MATCHING:
- Grades 3-4 → ruleComplexity 'oneStep' (rules like x+3, 2*x)
- Grade 5 → ruleComplexity 'twoStep' (rules like 2*x+1, 3*x-2)
- Middle/High School → ruleComplexity 'expression' (rules like x^2, x^2+1)

REQUIREMENTS:
1. Write a clear, student-friendly session title. Do NOT name a specific rule or number.
2. Provide a 1-2 sentence educational description of what students will practice across the session.
3. Set challengeType, ruleComplexity, gradeBand, outputDisplay to match the tier.

Return ONLY the wrapper fields described above.
`;

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
    throw new Error('No valid function machine wrapper returned from Gemini API');
  }

  // ── Validate challengeType ──
  const validTypes = ['observe', 'predict', 'discover_rule', 'create_rule'];
  if (!validTypes.includes(wrapper.challengeType)) {
    wrapper.challengeType = evalConstraint?.allowedTypes[0] ?? 'observe';
  }

  // ── Apply explicit config overrides from manifest ──
  if (config) {
    if (config.ruleComplexity !== undefined) wrapper.ruleComplexity = config.ruleComplexity;
    if (config.gradeBand !== undefined) wrapper.gradeBand = config.gradeBand;
    if (config.outputDisplay !== undefined) wrapper.outputDisplay = config.outputDisplay;
  }

  // ── Defaults ──
  if (wrapper.outputDisplay === undefined) {
    wrapper.outputDisplay = wrapper.challengeType === 'predict' ? 'hidden' : 'animated';
  }
  if (wrapper.gradeBand === undefined) wrapper.gradeBand = '3-4';
  if (wrapper.ruleComplexity === undefined) {
    wrapper.ruleComplexity = MODE_PROFILES[wrapper.challengeType]?.defaultComplexity ?? 'oneStep';
  }

  // ── Pre-select rules for the session (local, deterministic-variance) ──
  const rules = selectFunctionMachineRules(wrapper.challengeType, {
    count: config?.instanceCount,
    complexity: wrapper.ruleComplexity,
  });

  const challenges = buildChallenges(rules, wrapper.challengeType);

  // ── Apply the support-tier structure deterministically (code owns the SUPPORT
  // structure; the LLM only chose the wrapper text). Runs at the END, after the
  // challenges are built. Gated ONLY on a tier being present, resolved per challenge
  // from its OWN mode, so blended/auto sessions get difficulty too. NEVER touches
  // `showRule` (the eval mode's identity) and NEVER changes the rule/numbers. ──
  // Every challenge in a session shares the session's challengeType (this primitive
  // pins ONE mode per session — there is no per-challenge `type` field), so the
  // mode is wrapper.challengeType for all of them.
  const sessionMode = wrapper.challengeType as FunctionMachineChallengeType;
  let tieredOutputDisplay: 'immediate' | 'animated' | 'hidden' | undefined;
  if (supportTier) {
    const sc = resolveSupportStructure(sessionMode, supportTier);
    for (const ch of challenges) {
      // Pairs/rows are STRUCTURAL withdrawal levers — never reveal the rule.
      if (sc.pairsRequiredToComplete != null) {
        ch.pairsRequiredToComplete = Math.min(sc.pairsRequiredToComplete, ch.inputQueue.length);
      }
      if (sc.prefilledPairCount != null) {
        // INVARIANT (create_rule): ≥2 rows so the rule stays uniquely determinable.
        const minRows = sessionMode === 'create_rule' ? 2 : 1;
        ch.prefilledPairCount = Math.max(
          minRows,
          Math.min(sc.prefilledPairCount, ch.inputQueue.length),
        );
      }
      ch.hintLevel = sc.hintLevel;
    }
    // outputDisplay is a session-level field — observe-hard / predict-hard set it.
    if (sc.outputDisplay) tieredOutputDisplay = sc.outputDisplay;
  }

  // Session-level chrome: complexity badge follows the tier (hidden at hard).
  const showComplexityBadge =
    supportTier && tierScaffold ? tierScaffold.showComplexityBadge : undefined;

  if (supportTier) {
    // INVARIANT assert: create_rule must keep ≥2 pre-filled rows so the rule stays
    // uniquely determinable (a 1-row table fits infinitely many rules).
    if (sessionMode === 'create_rule') {
      for (const ch of challenges) {
        if (ch.prefilledPairCount != null && ch.prefilledPairCount < 2) {
          console.warn(
            `[FunctionMachine] create_rule prefilledPairCount<2 (${ch.prefilledPairCount}) — clamping to 2`
          );
          ch.prefilledPairCount = 2;
        }
      }
    }
    console.log(
      `[FunctionMachine] Support tier "${supportTier}" applied per-challenge ` +
      `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}); showRule untouched (mode identity)`
    );
  }

  console.log(
    `[FunctionMachine] Final: challengeType=${wrapper.challengeType}, complexity=${wrapper.ruleComplexity}, ` +
    `instances=${challenges.length} [${rules.join(' | ')}]`
  );

  return {
    title: wrapper.title,
    description: wrapper.description,
    challengeType: wrapper.challengeType,
    challenges,
    ruleComplexity: wrapper.ruleComplexity,
    gradeBand: wrapper.gradeBand,
    outputDisplay: tieredOutputDisplay ?? wrapper.outputDisplay,
    ...(supportTier ? { supportTier } : {}),
    ...(showComplexityBadge !== undefined ? { showComplexityBadge } : {}),
  };
};
