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

export const generateFunctionMachine = async (
  topic: string,
  gradeLevel: string,
  config?: {
    /** How many rules in this session. Defaults from COUNT_BY_MODE (5 for T2 observe/predict, 4 for T3 discover/create_rule). */
    instanceCount?: number;
    ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
    gradeBand?: '3-4' | '5' | 'advanced';
    outputDisplay?: 'immediate' | 'animated' | 'hidden';
    targetEvalMode?: string;
  }
): Promise<FunctionMachineData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'function-machine',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('FunctionMachine', config?.targetEvalMode, evalConstraint);

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
Create the wrapper metadata for a multi-challenge function machine session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- A function machine session contains 3-6 separate function rules of the SAME challenge type.
- The system has ALREADY pre-selected the rules and input queues for each challenge; you do NOT pick rules or numbers.
- Your job is to write the session-level title and description, and to set the mode flags (challengeType, ruleComplexity, gradeBand, outputDisplay).

${challengeTypeSection}

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
    outputDisplay: wrapper.outputDisplay,
  };
};
