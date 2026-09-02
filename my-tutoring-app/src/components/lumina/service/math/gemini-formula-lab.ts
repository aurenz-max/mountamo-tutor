import { Type, type Schema } from '@google/genai';
import type {
  FormulaLabChallenge,
  FormulaLabChallengeType,
  FormulaLabData,
  FormulaLabDirection,
  FormulaLabVariable,
} from '../../primitives/visual-primitives/math/FormulaLab';
import {
  evaluateFormulaExpression,
  validateFormulaExpression,
} from '../../primitives/visual-primitives/math/formulaLabMath';
import { ai } from '../geminiClient';
import {
  buildModeConstraintSection,
  constrainChallengeTypeEnum,
  resolveEvalModes,
  type ChallengeTypeDoc,
} from '../evalMode';

/**
 * Formula Lab uses the Fork A hybrid pattern.
 *
 * Gemini authors one session-level formula wrapper. Numeric experiments and
 * their answer keys are generated locally, evaluated with the same restricted
 * evaluator as the component, and validated before they reach the renderer.
 */

type FormulaLabConfig = {
  /** Eval mode pinned by the tester/curator. Wins over intent resolution. */
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = support withdrawal plus harder in-mode problem structure.
   * It never expands numeric magnitude or changes the task identity.
   */
  difficulty?: string;
  /** Component intent used to resolve an unpinned skill or curated blend. */
  intent?: string;
  /** Parent objective text used as a secondary routing signal. */
  objectiveText?: string;
  [key: string]: unknown;
};

type FlatFormulaLabWrapper = Record<string, unknown>;

export type ValidatedWrapper = Omit<FormulaLabData, 'challenges'>;

export interface CandidateChallenge {
  changedVariableSymbol: string;
  baselineValues: number[];
  targetValues: number[];
  expectedBaselineOutput: number;
  expectedTargetOutput: number;
  correctDirection: FormulaLabDirection;
}

const CHALLENGE_COUNT = 5;
const MAX_ABS_OUTPUT = 1_000_000_000;
const CHALLENGE_TYPE_ORDER: FormulaLabChallengeType[] = [
  'free-explore',
  'predict-direction',
  'predict-magnitude',
  'construct-formula',
  'transfer-apply',
];
const CHALLENGE_TYPE_RANK = Object.fromEntries(
  CHALLENGE_TYPE_ORDER.map((type, index) => [type, index]),
) as Record<FormulaLabChallengeType, number>;
const CHALLENGE_TYPE_DOCS: Record<FormulaLabChallengeType, ChallengeTypeDoc> = {
  'free-explore': {
    promptDoc:
      '"free-explore": Observe the living system without committing a prediction; move one input while all others stay fixed and notice the output response.',
    schemaDescription: "'free-explore' (observe by direct manipulation)",
  },
  'predict-direction': {
    promptDoc:
      '"predict-direction": Commit whether the output will increase, decrease, or stay about the same, then test by moving one input to its target.',
    schemaDescription: "'predict-direction' (predict the direction of change)",
  },
  'predict-magnitude': {
    promptDoc:
      '"predict-magnitude": Place a signed prediction whose direction and distance from zero represent the expected direction and relative strength of change, then test it.',
    schemaDescription: "'predict-magnitude' (predict signed relative change)",
  },
  'construct-formula': {
    promptDoc:
      '"construct-formula": Reconstruct the hidden right-hand side of the formula by arranging its variables, numbers, parentheses, and operators.',
    schemaDescription: "'construct-formula' (assemble the symbolic relationship)",
  },
  'transfer-apply': {
    promptDoc:
      '"transfer-apply": Apply the same relationship in a related new context and calculate the withheld output from a complete set of input values.',
    schemaDescription: "'transfer-apply' (calculate in a new context)",
  },
};

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
export function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

export interface FormulaLabSupportScaffold {
  /** Numeric output readout while the simulation is moving (simulation overlay). */
  showLiveOutputReadout: boolean;
  /** Whether strategy help is persistent, student-opened, or fully withdrawn. */
  strategyCue: 'visible' | 'hint' | 'none';
  /** Group constructor tokens by role without changing the token set or answer. */
  groupFormulaTokens: boolean;
  /** Show a substituted—but unsolved—expression in transfer mode. */
  showSubstitutionSetup: boolean;
  /** Require a brief evidence statement where the response form supports it. */
  requireJustification: boolean;
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'Preserve the canonical topic relationship first. Difficulty may guide relationship structure and response subtlety, but never the task identity, ' +
  'grade-band scope, slider-range magnitude, units, or output safety ceiling.';

/** easy → hard support gradient for each Formula Lab task identity. */
export function resolveSupportStructure(
  mode: FormulaLabChallengeType,
  tier: SupportTier,
): FormulaLabSupportScaffold {
  const base = {
    showLiveOutputReadout: tier === 'easy',
    strategyCue: tier === 'easy' ? 'visible' as const : tier === 'medium' ? 'hint' as const : 'none' as const,
    groupFormulaTokens: false,
    showSubstitutionSetup: false,
    requireJustification: false,
  };

  switch (mode) {
    case 'free-explore':
      return {
        ...base,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: keep the live numeric output readout visible and name the compare-before/after strategy.'
            : tier === 'medium'
              ? 'MEDIUM: withhold the live numeric readout while the system moves; offer the comparison strategy only as an optional hint.'
              : 'HARD: withhold the live numeric readout and all strategy cues until the experiment is complete.',
        ],
      };
    case 'predict-direction':
    case 'predict-magnitude':
      return {
        ...base,
        requireJustification: tier === 'hard',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: show the live numeric output after prediction lock and keep a visible cue to inspect the changed variable\'s role in the formula.'
            : tier === 'medium'
              ? 'MEDIUM: withhold the live numeric readout while testing and place the formula-role cue behind an optional hint.'
              : 'HARD: withhold the live numeric readout and formula-role cue; require the student to state evidence before locking the prediction.',
        ],
      };
    case 'construct-formula':
      return {
        ...base,
        showLiveOutputReadout: false,
        groupFormulaTokens: tier === 'easy',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: group the unchanged formula tokens by role and keep a visible setup cue.'
            : tier === 'medium'
              ? 'MEDIUM: shuffle the unchanged tokens and offer the setup cue only as an optional hint.'
              : 'HARD: shuffle the unchanged tokens and withdraw the setup cue; never reveal token order.',
        ],
      };
    case 'transfer-apply':
    default:
      return {
        ...base,
        showLiveOutputReadout: false,
        showSubstitutionSetup: tier === 'easy',
        requireJustification: tier === 'hard',
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: show the substituted but unsolved expression so the student can self-check setup.'
            : tier === 'medium'
              ? 'MEDIUM: offer substitution guidance only as an optional hint; do not pre-assemble the expression.'
              : 'HARD: provide no substitution setup or hint and require a brief explanation of the calculation.',
        ],
      };
  }
}

export interface FormulaLabProblemShape {
  /** Session-level formula target. Formula Lab shares one formula across all five challenges. */
  variableCount: 2 | 3;
  minOperatorCount: number;
  maxOperatorCount: number;
  requireInverseOrPower: boolean;
  forbidInverseOrPower: boolean;
  requireMixedRoles: boolean;
  /** Code-owned output-change band for predict-magnitude; null for other task identities. */
  relativeChangeBand: { min: number; max: number; target: number } | null;
  promptLines: string[];
}

/**
 * One source of truth for the structural axis. The prompt consumes the formula
 * target and the local candidate selector consumes relativeChangeBand.
 */
export function resolveProblemShape(
  mode: FormulaLabChallengeType,
  tier: SupportTier,
): FormulaLabProblemShape {
  const formulaTarget = tier === 'easy'
    ? {
      variableCount: 2 as const,
      minOperatorCount: 1,
      maxOperatorCount: 1,
      requireInverseOrPower: false,
      forbidInverseOrPower: true,
      requireMixedRoles: false,
      summary: 'prefer two active inputs in one direct linear operation, with no grouping',
    }
    : tier === 'medium'
      ? {
        variableCount: 2 as const,
        minOperatorCount: 1,
        maxOperatorCount: 2,
        requireInverseOrPower: true,
        forbidInverseOrPower: false,
        requireMixedRoles: false,
        summary: 'prefer two active inputs in an inverse or nonlinear relationship with one or two operations',
      }
      : {
        variableCount: 3 as const,
        minOperatorCount: 2,
        maxOperatorCount: 4,
        requireInverseOrPower: true,
        forbidInverseOrPower: false,
        requireMixedRoles: true,
        summary: 'prefer three active inputs in two to four operations that combine a direct role with division or a power',
      };

  const relativeChangeBand = mode === 'predict-magnitude'
    ? tier === 'easy'
      ? { min: 0.45, max: Number.POSITIVE_INFINITY, target: 0.7 }
      : tier === 'medium'
        ? { min: 0.2, max: 0.45, target: 0.325 }
        : { min: 0.05, max: 0.2, target: 0.125 }
    : null;

  const modeLine = mode === 'free-explore'
    ? `${tier.toUpperCase()} free-explore: ${formulaTarget.summary}; this changes how many fixed quantities the student must coordinate.`
    : mode === 'predict-direction'
      ? `${tier.toUpperCase()} predict-direction: ${formulaTarget.summary}; make the changed variable's structural role—not larger values—the source of difficulty.`
      : mode === 'predict-magnitude'
        ? `${tier.toUpperCase()} predict-magnitude: ${formulaTarget.summary}; local code selects a ${tier === 'easy' ? 'large, clear' : tier === 'medium' ? 'moderate' : 'small, subtle'} relative output change inside the supplied ranges.`
        : mode === 'construct-formula'
          ? `${tier.toUpperCase()} construct-formula: ${formulaTarget.summary}; token and operation depth are the structural lever.`
          : `${tier.toUpperCase()} transfer-apply: ${formulaTarget.summary}; substitution count and operation depth are the structural lever.`;

  return {
    variableCount: formulaTarget.variableCount,
    minOperatorCount: formulaTarget.minOperatorCount,
    maxOperatorCount: formulaTarget.maxOperatorCount,
    requireInverseOrPower: formulaTarget.requireInverseOrPower,
    forbidInverseOrPower: formulaTarget.forbidInverseOrPower,
    requireMixedRoles: formulaTarget.requireMixedRoles,
    relativeChangeBand,
    promptLines: [TIER_GUARDRAIL, modeLine],
  };
}

export interface FormulaExpressionShape {
  variableCount: number;
  operatorCount: number;
  operators: string[];
  hasGrouping: boolean;
  hasInverseOrPower: boolean;
}

/** Count binary operators without mistaking unary +/- for extra problem depth. */
export function analyzeFormulaProblemShape(
  expression: string,
  variableCount: number,
): FormulaExpressionShape {
  const operators: string[] = [];
  let expectsValue = true;
  const normalizedExpression = expression.replace(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g,
    '0',
  );
  for (const char of normalizedExpression) {
    if (/\s/.test(char)) continue;
    if (char === '(') {
      expectsValue = true;
      continue;
    }
    if (char === ')') {
      expectsValue = false;
      continue;
    }
    if ('+-*/^'.includes(char)) {
      const unary = expectsValue && (char === '+' || char === '-');
      if (!unary) operators.push(char);
      expectsValue = true;
      continue;
    }
    expectsValue = false;
  }
  return {
    variableCount,
    operatorCount: operators.length,
    operators,
    hasGrouping: expression.includes('('),
    hasInverseOrPower: operators.includes('/') || operators.includes('^'),
  };
}

export function formulaMatchesProblemShape(
  analysis: FormulaExpressionShape,
  target: FormulaLabProblemShape,
): boolean {
  return analysis.variableCount === target.variableCount
    && analysis.operatorCount >= target.minOperatorCount
    && analysis.operatorCount <= target.maxOperatorCount
    && (!target.requireInverseOrPower || analysis.hasInverseOrPower)
    && (!target.forbidInverseOrPower || !analysis.hasInverseOrPower)
    && (!target.requireMixedRoles || (
      analysis.hasInverseOrPower && analysis.operators.some((operator) => ['+', '-', '*'].includes(operator))
    ));
}

function buildTierPromptSection(
  modes: readonly FormulaLabChallengeType[],
  tier: SupportTier | null,
): string {
  if (!tier) return '';
  const lines = new Set<string>();
  for (const mode of modes) {
    resolveSupportStructure(mode, tier).promptLines.forEach((line) => lines.add(line));
    resolveProblemShape(mode, tier).promptLines.forEach((line) => lines.add(line));
  }
  return `\n## WITHIN-MODE DIFFICULTY TIER (support + problem structure; never number size)\n${Array.from(lines).map((line) => `- ${line}`).join('\n')}\n`;
}

/** Deterministic, per-challenge application. Numeric and answer-bearing fields are untouched. */
export function applyFormulaLabSupportTier(
  challenges: FormulaLabChallenge[],
  supportTier: SupportTier,
): void {
  for (const challenge of challenges) {
    const scaffold = resolveSupportStructure(challenge.type, supportTier);
    challenge.showLiveOutputReadout = scaffold.showLiveOutputReadout;
    challenge.strategyCue = scaffold.strategyCue;
    challenge.groupFormulaTokens = scaffold.groupFormulaTokens;
    challenge.showSubstitutionSetup = scaffold.showSubstitutionSetup;
    challenge.requireJustification = scaffold.requireJustification;
    challenge.supportTier = supportTier;
  }
}
const VALID_SCENES: FormulaLabData['sceneKind'][] = [
  'motion',
  'geometry',
  'container',
  'relationship',
];
const VALID_ACCENTS: FormulaLabVariable['accent'][] = [
  'orange',
  'emerald',
  'cyan',
  'amber',
  'blue',
  'purple',
  'pink',
  'rose',
  'indigo',
  'teal',
];
const ASCII_SYMBOL = /^[A-Za-z][A-Za-z0-9_]*$/;

const formulaLabWrapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Short student-facing activity title for the formula relationship.',
    },
    description: {
      type: Type.STRING,
      description: 'One sentence describing what students will predict and test.',
    },
    context: {
      type: Type.STRING,
      description: 'Honest real-world or mathematical context in which the formula applies.',
    },
    transferContext: {
      type: Type.STRING,
      description: 'A concise related-but-new setting where the same formula applies, using the same quantities and units.',
    },
    formulaLatex: {
      type: Type.STRING,
      description: "Display LaTeX with the isolated output on the left, for example 'F = m \\cdot a'.",
    },
    expression: {
      type: Type.STRING,
      description:
        "Right-hand-side arithmetic only. Use the input symbols, finite numbers, pi, parentheses, and + - * / ^. Example: 'm * a'.",
    },
    outputSymbol: {
      type: Type.STRING,
      description: "ASCII output symbol on the formula's left side, for example 'F' or 'A'.",
    },
    outputName: {
      type: Type.STRING,
      description: "Student-facing output quantity name, for example 'Force'.",
    },
    outputUnit: {
      type: Type.STRING,
      description: "Nonempty output unit, for example 'N', 'm^2', or 'unitless'.",
    },
    variableCount: {
      type: Type.NUMBER,
      description: 'Exactly 2 or 3 independent numeric input variables.',
    },
    variable0Symbol: { type: Type.STRING, description: 'Unique ASCII input symbol.' },
    variable0Name: { type: Type.STRING, description: 'Input quantity name.' },
    variable0Unit: { type: Type.STRING, description: "Nonempty unit or 'unitless'." },
    variable0Min: { type: Type.NUMBER, description: 'Finite slider minimum.' },
    variable0Max: { type: Type.NUMBER, description: 'Finite slider maximum greater than the minimum.' },
    variable0Step: { type: Type.NUMBER, description: 'Positive slider step no larger than the range.' },
    variable0DefaultValue: { type: Type.NUMBER, description: 'Finite default inside the slider range.' },
    variable0Accent: { type: Type.STRING, enum: VALID_ACCENTS },
    variable1Symbol: { type: Type.STRING, description: 'Unique ASCII input symbol.' },
    variable1Name: { type: Type.STRING, description: 'Input quantity name.' },
    variable1Unit: { type: Type.STRING, description: "Nonempty unit or 'unitless'." },
    variable1Min: { type: Type.NUMBER, description: 'Finite slider minimum.' },
    variable1Max: { type: Type.NUMBER, description: 'Finite slider maximum greater than the minimum.' },
    variable1Step: { type: Type.NUMBER, description: 'Positive slider step no larger than the range.' },
    variable1DefaultValue: { type: Type.NUMBER, description: 'Finite default inside the slider range.' },
    variable1Accent: { type: Type.STRING, enum: VALID_ACCENTS },
    variable2Symbol: { type: Type.STRING, description: 'Third unique ASCII input symbol when variableCount is 3.' },
    variable2Name: { type: Type.STRING, description: 'Third input quantity name when variableCount is 3.' },
    variable2Unit: { type: Type.STRING, description: "Third input unit or 'unitless' when variableCount is 3." },
    variable2Min: { type: Type.NUMBER, description: 'Third finite slider minimum when variableCount is 3.' },
    variable2Max: { type: Type.NUMBER, description: 'Third finite slider maximum when variableCount is 3.' },
    variable2Step: { type: Type.NUMBER, description: 'Third positive slider step when variableCount is 3.' },
    variable2DefaultValue: { type: Type.NUMBER, description: 'Third default inside its range when variableCount is 3.' },
    variable2Accent: { type: Type.STRING, enum: VALID_ACCENTS },
    sceneKind: {
      type: Type.STRING,
      enum: VALID_SCENES,
      description: 'Living-scene family that best represents the relationship.',
    },
    challengeType: {
      type: Type.STRING,
      enum: CHALLENGE_TYPE_ORDER,
      description: 'Representative task identity for the session.',
    },
    gradeBand: {
      type: Type.STRING,
      description: "Nonempty grade band, normally '6-8' or '9-12'.",
    },
  },
  required: [
    'title',
    'description',
    'context',
    'transferContext',
    'formulaLatex',
    'expression',
    'outputSymbol',
    'outputName',
    'outputUnit',
    'variableCount',
    'variable0Symbol',
    'variable0Name',
    'variable0Unit',
    'variable0Min',
    'variable0Max',
    'variable0Step',
    'variable0DefaultValue',
    'variable0Accent',
    'variable1Symbol',
    'variable1Name',
    'variable1Unit',
    'variable1Min',
    'variable1Max',
    'variable1Step',
    'variable1DefaultValue',
    'variable1Accent',
    'sceneKind',
    'challengeType',
    'gradeBand',
  ],
};

function nonempty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  if (text.includes('e-')) return Math.min(10, Number(text.split('e-')[1]) || 0);
  return Math.min(10, text.split('.')[1]?.length ?? 0);
}

function normalizeNumber(value: number, step = 1): number {
  return Number(value.toFixed(Math.max(6, decimalPlaces(step))));
}

function reconstructVariable(
  flat: FlatFormulaLabWrapper,
  index: number,
): FormulaLabVariable | null {
  const prefix = `variable${index}`;
  const symbol = nonempty(flat[`${prefix}Symbol`]);
  const name = nonempty(flat[`${prefix}Name`]);
  const unit = nonempty(flat[`${prefix}Unit`]);
  const min = finiteNumber(flat[`${prefix}Min`]);
  const max = finiteNumber(flat[`${prefix}Max`]);
  const step = finiteNumber(flat[`${prefix}Step`]);
  const defaultValue = finiteNumber(flat[`${prefix}DefaultValue`]);
  const accent = flat[`${prefix}Accent`];

  if (
    !symbol
    || !ASCII_SYMBOL.test(symbol)
    || !name
    || !unit
    || min === null
    || max === null
    || step === null
    || defaultValue === null
    || min >= max
    || step <= 0
    || step > max - min
    || defaultValue < min
    || defaultValue > max
    || !VALID_ACCENTS.includes(accent as FormulaLabVariable['accent'])
  ) {
    return null;
  }

  return {
    symbol,
    name,
    unit,
    min,
    max,
    step,
    defaultValue,
    accent: accent as FormulaLabVariable['accent'],
  };
}

function latexHasOutputOnLeft(formulaLatex: string, outputSymbol: string): boolean {
  const sides = formulaLatex.split('=');
  if (sides.length !== 2) return false;
  const normalizedLeft = sides[0].replace(/\\(?:mathrm|text)\s*\{([^}]*)\}/g, '$1')
    .replace(/[\\{}\s]/g, '');
  return normalizedLeft === outputSymbol;
}

function expressionSymbols(expression: string): Set<string> {
  return new Set(expression.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []);
}

function scopeFromValues(
  variables: FormulaLabVariable[],
  values: number[],
): Record<string, number> {
  return Object.fromEntries(variables.map((variable, index) => [variable.symbol, values[index]]));
}

function outputIsUsable(output: number | null): output is number {
  return output !== null && Number.isFinite(output) && Math.abs(output) <= MAX_ABS_OUTPUT;
}

function buildReachableValues(variable: FormulaLabVariable): number[] {
  const span = variable.max - variable.min;
  const stepCount = Math.floor((span + Math.abs(span) * 1e-10) / variable.step);
  if (stepCount < 1) return [];

  const indices = new Set<number>([
    0,
    stepCount,
    Math.round(stepCount * 0.16),
    Math.round(stepCount * 0.3),
    Math.round(stepCount * 0.5),
    Math.round(stepCount * 0.7),
    Math.round(stepCount * 0.84),
    Math.round((variable.defaultValue - variable.min) / variable.step),
  ]);

  return Array.from(indices)
    .filter((index) => index >= 0 && index <= stepCount)
    .map((index) => normalizeNumber(variable.min + index * variable.step, variable.step))
    .filter((value) => value >= variable.min - 1e-9 && value <= variable.max + 1e-9)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b);
}

function sampleWrapperExpression(wrapper: ValidatedWrapper): boolean {
  const grids = wrapper.variables.map(buildReachableValues);
  if (grids.some((grid) => grid.length < 2)) return false;

  const samples: number[][] = [
    wrapper.variables.map((variable) => variable.defaultValue),
    grids.map((grid) => grid[Math.floor(grid.length * 0.25)]),
    grids.map((grid) => grid[Math.floor(grid.length * 0.5)]),
    grids.map((grid) => grid[Math.floor(grid.length * 0.75)]),
  ];

  return samples.every((values) => outputIsUsable(
    evaluateFormulaExpression(wrapper.expression, scopeFromValues(wrapper.variables, values)),
  ));
}

function validateWrapper(raw: unknown): ValidatedWrapper | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn('[FormulaLab] Rejecting wrapper: response is not an object');
    return null;
  }

  const flat = raw as FlatFormulaLabWrapper;
  const title = nonempty(flat.title);
  const description = nonempty(flat.description);
  const context = nonempty(flat.context);
  const transferContext = nonempty(flat.transferContext);
  const formulaLatex = nonempty(flat.formulaLatex);
  const expression = nonempty(flat.expression);
  const outputSymbol = nonempty(flat.outputSymbol);
  const outputName = nonempty(flat.outputName);
  const outputUnit = nonempty(flat.outputUnit);
  const gradeBand = nonempty(flat.gradeBand);
  const variableCount = finiteNumber(flat.variableCount);
  const sceneKind = flat.sceneKind;
  const challengeType = flat.challengeType;

  if (
    !title
    || !description
    || !context
    || !transferContext
    || !formulaLatex
    || !expression
    || !outputSymbol
    || !ASCII_SYMBOL.test(outputSymbol)
    || !outputName
    || !outputUnit
    || !gradeBand
    || (variableCount !== 2 && variableCount !== 3)
    || !VALID_SCENES.includes(sceneKind as FormulaLabData['sceneKind'])
    || !CHALLENGE_TYPE_ORDER.includes(challengeType as FormulaLabChallengeType)
  ) {
    console.warn('[FormulaLab] Rejecting wrapper: missing or invalid required session fields');
    return null;
  }

  const variables: FormulaLabVariable[] = [];
  for (let index = 0; index < variableCount; index++) {
    const variable = reconstructVariable(flat, index);
    if (!variable) {
      console.warn(`[FormulaLab] Rejecting wrapper: variable${index} is malformed`);
      return null;
    }
    variables.push(variable);
  }

  const inputSymbols = variables.map((variable) => variable.symbol);
  if (new Set(inputSymbols).size !== variables.length || inputSymbols.includes(outputSymbol)) {
    console.warn('[FormulaLab] Rejecting wrapper: input/output symbols must be unique');
    return null;
  }

  if (!latexHasOutputOnLeft(formulaLatex, outputSymbol)) {
    console.warn('[FormulaLab] Rejecting wrapper: formulaLatex does not isolate outputSymbol on the left');
    return null;
  }

  if (!validateFormulaExpression(expression, inputSymbols)) {
    console.warn(`[FormulaLab] Rejecting wrapper: unsafe or invalid expression "${expression}"`);
    return null;
  }

  const usedSymbols = expressionSymbols(expression);
  if (inputSymbols.some((symbol) => !usedSymbols.has(symbol))) {
    console.warn('[FormulaLab] Rejecting wrapper: every input variable must affect the expression');
    return null;
  }

  const wrapper: ValidatedWrapper = {
    title,
    description,
    context,
    transferContext,
    formulaLatex,
    expression,
    outputSymbol,
    outputName,
    outputUnit,
    variables,
    sceneKind: sceneKind as FormulaLabData['sceneKind'],
    challengeType: challengeType as FormulaLabChallengeType,
    gradeBand,
  };

  if (!sampleWrapperExpression(wrapper)) {
    console.warn('[FormulaLab] Rejecting wrapper: expression produced invalid or extreme sampled outputs');
    return null;
  }

  return wrapper;
}

function directionFromOutputs(baseline: number, target: number): FormulaLabDirection {
  const scale = Math.max(1, Math.abs(baseline), Math.abs(target));
  const tolerance = Math.max(1e-9, scale * 1e-8);
  const difference = target - baseline;
  if (Math.abs(difference) <= tolerance) return 'stay-same';
  return difference > 0 ? 'increase' : 'decrease';
}

function canonicalKey(candidate: CandidateChallenge): string {
  const values = [...candidate.baselineValues, ...candidate.targetValues]
    .map((value) => normalizeNumber(value).toString())
    .join(',');
  return `${candidate.changedVariableSymbol}|${values}`;
}

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildCandidatePool(wrapper: ValidatedWrapper): {
  byVariable: CandidateChallenge[][];
  rejectedCount: number;
} {
  const grids = wrapper.variables.map(buildReachableValues);
  const byVariable = wrapper.variables.map(() => [] as CandidateChallenge[]);
  let rejectedCount = 0;

  wrapper.variables.forEach((changedVariable, changedIndex) => {
    const changedGrid = grids[changedIndex];
    const meaningfulDelta = Math.min(
      changedVariable.max - changedVariable.min,
      Math.max(changedVariable.step, (changedVariable.max - changedVariable.min) * 0.2),
    );

    for (let contextIndex = 0; contextIndex < 7; contextIndex++) {
      const fixedValues = grids.map((grid, variableIndex) => (
        grid[(contextIndex + variableIndex * 2) % grid.length]
      ));

      for (const baselineValue of changedGrid) {
        for (const targetValue of changedGrid) {
          if (Math.abs(targetValue - baselineValue) + 1e-9 < meaningfulDelta) continue;

          const baselineValues = [...fixedValues];
          baselineValues[changedIndex] = baselineValue;
          const targetValues = [...baselineValues];
          targetValues[changedIndex] = targetValue;

          const baselineOutput = evaluateFormulaExpression(
            wrapper.expression,
            scopeFromValues(wrapper.variables, baselineValues),
          );
          const targetOutput = evaluateFormulaExpression(
            wrapper.expression,
            scopeFromValues(wrapper.variables, targetValues),
          );

          if (!outputIsUsable(baselineOutput) || !outputIsUsable(targetOutput)) {
            rejectedCount++;
            continue;
          }

          byVariable[changedIndex].push({
            changedVariableSymbol: changedVariable.symbol,
            baselineValues,
            targetValues,
            expectedBaselineOutput: baselineOutput,
            expectedTargetOutput: targetOutput,
            correctDirection: directionFromOutputs(baselineOutput, targetOutput),
          });
        }
      }
    }
  });

  return { byVariable, rejectedCount };
}

function validateChallenge(
  challenge: FormulaLabChallenge,
  wrapper: ValidatedWrapper,
): boolean {
  const changedIndex = wrapper.variables.findIndex(
    (variable) => variable.symbol === challenge.changedVariableSymbol,
  );
  if (
    changedIndex < 0
    || !CHALLENGE_TYPE_ORDER.includes(challenge.type)
    || challenge.baselineValues.length !== wrapper.variables.length
    || challenge.targetValues.length !== wrapper.variables.length
    || !outputIsUsable(challenge.expectedBaselineOutput)
    || !outputIsUsable(challenge.expectedTargetOutput)
  ) return false;

  let changedCount = 0;
  for (let index = 0; index < wrapper.variables.length; index++) {
    const variable = wrapper.variables[index];
    const baseline = challenge.baselineValues[index];
    const target = challenge.targetValues[index];
    if (
      !Number.isFinite(baseline)
      || !Number.isFinite(target)
      || baseline < variable.min - 1e-9
      || baseline > variable.max + 1e-9
      || target < variable.min - 1e-9
      || target > variable.max + 1e-9
    ) return false;
    if (Math.abs(target - baseline) > 1e-9) {
      changedCount++;
      if (index !== changedIndex) return false;
    }
  }
  if (changedCount !== 1) return false;

  const recomputedBaseline = evaluateFormulaExpression(
    wrapper.expression,
    scopeFromValues(wrapper.variables, challenge.baselineValues),
  );
  const recomputedTarget = evaluateFormulaExpression(
    wrapper.expression,
    scopeFromValues(wrapper.variables, challenge.targetValues),
  );
  if (!outputIsUsable(recomputedBaseline) || !outputIsUsable(recomputedTarget)) return false;

  const answerScale = Math.max(1, Math.abs(recomputedBaseline), Math.abs(recomputedTarget));
  const answerTolerance = Math.max(1e-9, answerScale * 1e-10);
  return Math.abs(challenge.expectedBaselineOutput - recomputedBaseline) <= answerTolerance
    && Math.abs(challenge.expectedTargetOutput - recomputedTarget) <= answerTolerance
    && challenge.correctDirection === directionFromOutputs(recomputedBaseline, recomputedTarget);
}

function challengeDifficulty(candidate: CandidateChallenge): number {
  const scale = Math.max(1, Math.abs(candidate.expectedBaselineOutput));
  return Math.abs(candidate.expectedTargetOutput - candidate.expectedBaselineOutput) / scale;
}

function distanceFromBand(
  value: number,
  band: NonNullable<FormulaLabProblemShape['relativeChangeBand']>,
): number {
  if (value < band.min) return band.min - value;
  if (value > band.max) return value - band.max;
  return 0;
}

export interface StructuralCandidateSelection {
  candidate: CandidateChallenge | null;
  relativeChange: number | null;
  saturated: boolean;
}

/**
 * Selects answer-bearing values from the already in-range, already evaluated
 * local pool. When a discrete variable grid cannot hit the requested band, it
 * saturates to the nearest available candidate without expanding the range.
 */
export function selectStructuralCandidate(
  candidates: readonly CandidateChallenge[],
  mode: FormulaLabChallengeType,
  tier: SupportTier,
  seenDirections: ReadonlySet<FormulaLabDirection> = new Set(),
): StructuralCandidateSelection {
  const nonConstant = candidates.filter((candidate) => candidate.correctDirection !== 'stay-same');
  const usable = nonConstant.length > 0 ? nonConstant : [...candidates];
  if (usable.length === 0) return { candidate: null, relativeChange: null, saturated: false };

  const unseenDirection = usable.filter((candidate) => !seenDirections.has(candidate.correctDirection));
  const directionPool = unseenDirection.length > 0 ? unseenDirection : usable;
  const band = resolveProblemShape(mode, tier).relativeChangeBand;
  if (!band) {
    const candidate = directionPool[0] ?? usable[0];
    return { candidate, relativeChange: challengeDifficulty(candidate), saturated: false };
  }

  const inBand = directionPool.filter((candidate) => (
    distanceFromBand(challengeDifficulty(candidate), band) === 0
  ));
  const anyDirectionInBand = usable.filter((candidate) => (
    distanceFromBand(challengeDifficulty(candidate), band) === 0
  ));
  const exactPool = inBand.length > 0 ? inBand : anyDirectionInBand;
  if (exactPool.length > 0) {
    const candidate = exactPool[0];
    return { candidate, relativeChange: challengeDifficulty(candidate), saturated: false };
  }

  const candidate = [...directionPool].sort((left, right) => {
    const leftChange = challengeDifficulty(left);
    const rightChange = challengeDifficulty(right);
    const distanceDelta = distanceFromBand(leftChange, band) - distanceFromBand(rightChange, band);
    return distanceDelta !== 0
      ? distanceDelta
      : Math.abs(leftChange - band.target) - Math.abs(rightChange - band.target);
  })[0] ?? usable[0];
  return { candidate, relativeChange: challengeDifficulty(candidate), saturated: true };
}

export function buildChallenges(
  wrapper: ValidatedWrapper,
  allowedTypes: readonly FormulaLabChallengeType[],
  supportTier?: SupportTier | null,
): FormulaLabChallenge[] | null {
  const { byVariable, rejectedCount } = buildCandidatePool(wrapper);

  if (byVariable.some((candidates) => candidates.every((candidate) => candidate.correctDirection === 'stay-same'))) {
    console.warn('[FormulaLab] Rejecting wrapper: at least one input does not produce observable output changes');
    return null;
  }

  const shuffledByVariable = byVariable.map((candidates) => shuffle(candidates));
  const chosen: CandidateChallenge[] = [];
  const seen = new Set<string>();
  const directions = new Set<FormulaLabDirection>();
  const tierTypeRotation = supportTier
    ? shuffle(allowedTypes.length > 0 ? allowedTypes : CHALLENGE_TYPE_ORDER)
    : null;

  for (let index = 0; index < CHALLENGE_COUNT; index++) {
    const variableIndex = index % wrapper.variables.length;
    const candidates = shuffledByVariable[variableIndex].filter(
      (candidate) => !seen.has(canonicalKey(candidate)),
    );
    const nonConstant = candidates.filter((candidate) => candidate.correctDirection !== 'stay-same');
    const challengeType = tierTypeRotation?.[index % tierTypeRotation.length];
    const structuralSelection = supportTier && challengeType
      ? selectStructuralCandidate(candidates, challengeType, supportTier, directions)
      : null;
    const preferred = structuralSelection?.candidate
      ?? nonConstant.find((candidate) => !directions.has(candidate.correctDirection))
      ?? nonConstant[0]
      ?? candidates[0];

    if (!preferred) {
      console.warn(`[FormulaLab] Local pool could not fill challenge ${index + 1}`);
      return null;
    }

    chosen.push(preferred);
    seen.add(canonicalKey(preferred));
    directions.add(preferred.correctDirection);
    if (supportTier && challengeType === 'predict-magnitude') {
      const target = resolveProblemShape(challengeType, supportTier).relativeChangeBand!;
      console.log(
        `[FormulaLab] ${challengeType} ${supportTier}: target relative change `
          + `[${target.min}, ${Number.isFinite(target.max) ? target.max : '∞'}], `
          + `actual=${structuralSelection?.relativeChange?.toFixed(4) ?? 'n/a'}, `
          + `saturated=${structuralSelection?.saturated ?? false}`,
      );
    }
  }

  const typeRotation = tierTypeRotation
    ?? shuffle(allowedTypes.length > 0 ? allowedTypes : CHALLENGE_TYPE_ORDER);
  const challenges: FormulaLabChallenge[] = chosen
    .map((candidate, index) => ({
      id: '',
      type: typeRotation[index % typeRotation.length],
      ...candidate,
    }))
    .sort((a, b) => {
      const rankDelta = CHALLENGE_TYPE_RANK[a.type] - CHALLENGE_TYPE_RANK[b.type];
      return rankDelta !== 0 ? rankDelta : challengeDifficulty(a) - challengeDifficulty(b);
    })
    .map((challenge, index) => ({ ...challenge, id: `formula-lab-${index + 1}` }));

  const invalidCount = challenges.filter((challenge) => !validateChallenge(challenge, wrapper)).length;
  if (invalidCount > 0) {
    console.warn(`[FormulaLab] Rejected ${invalidCount}/${challenges.length} locally built challenges`);
    return null;
  }

  const changedSymbols = new Set(challenges.map((challenge) => challenge.changedVariableSymbol));
  if (wrapper.variables.length >= 2 && changedSymbols.size < 2) {
    console.warn('[FormulaLab] Rejecting local pool: fewer than two changed variables represented');
    return null;
  }

  if (new Set(challenges.map(canonicalKey)).size !== CHALLENGE_COUNT) {
    console.warn('[FormulaLab] Rejecting local pool: duplicate canonical challenges');
    return null;
  }

  console.log(
    `[FormulaLab] Local pool: ${challenges.length} valid challenges, ${rejectedCount} invalid candidates rejected; `
      + `variables=${Array.from(changedSymbols).join(',')}; directions=${Array.from(directions).join(',')}; `
      + `types=${challenges.map((challenge) => challenge.type).join(',')}`,
  );
  return challenges;
}

function fallbackWrapper(challengeType: FormulaLabChallengeType): ValidatedWrapper {
  return {
    title: 'Force and Motion Formula Lab',
    description: 'Explore, represent, and apply how changing mass or acceleration changes force in a living system.',
    context: "Newton's second law models the net force on an object as the product of its mass and acceleration.",
    transferContext: 'A different cart uses the same mass-times-acceleration relationship to determine the force needed for its motion.',
    formulaLatex: 'F = m \\cdot a',
    expression: 'm * a',
    outputSymbol: 'F',
    outputName: 'Force',
    outputUnit: 'N',
    variables: [
      {
        symbol: 'm',
        name: 'Mass',
        unit: 'kg',
        min: 1,
        max: 12,
        step: 1,
        defaultValue: 4,
        accent: 'amber',
      },
      {
        symbol: 'a',
        name: 'Acceleration',
        unit: 'm/s^2',
        min: 1,
        max: 10,
        step: 1,
        defaultValue: 3,
        accent: 'cyan',
      },
    ],
    sceneKind: 'motion',
    challengeType,
    gradeBand: '6-12',
  };
}

export function buildFallback(
  allowedTypes: readonly FormulaLabChallengeType[],
  supportTier?: SupportTier | null,
): FormulaLabData {
  const fallbackType = allowedTypes[0] ?? 'free-explore';
  const wrapper = fallbackWrapper(fallbackType);
  const challenges = buildChallenges(wrapper, allowedTypes, supportTier);
  if (!challenges) {
    throw new Error('Formula Lab fallback pool failed validation');
  }
  return { ...wrapper, challenges };
}

function reportFormulaProblemShape(
  wrapper: ValidatedWrapper,
  modes: readonly FormulaLabChallengeType[],
  supportTier: SupportTier,
): void {
  const representativeMode = modes[0] ?? wrapper.challengeType;
  const target = resolveProblemShape(representativeMode, supportTier);
  const actual = analyzeFormulaProblemShape(wrapper.expression, wrapper.variables.length);
  const matches = formulaMatchesProblemShape(actual, target);
  const detail = `guidance=${target.variableCount} variables/${target.minOperatorCount}-${target.maxOperatorCount} operators`
    + `${target.requireInverseOrPower ? '/inverse-or-power' : '/direct'}, `
    + `actual=${actual.variableCount} variables/${actual.operatorCount} operators/${actual.operators.join('') || 'none'}`;
  if (matches) {
    console.log(`[FormulaLab] Formula shape ${supportTier}: ${detail}`);
  } else {
    console.warn(
      `[FormulaLab] Formula-shape guidance was not met for ${supportTier}; preserving the curriculum-valid generated relationship: ${detail}`,
    );
  }
}

export const generateFormulaLab = async (
  topic: string,
  gradeLevel: string,
  config?: FormulaLabConfig,
): Promise<FormulaLabData> => {
  const resolution = await resolveEvalModes(
    'formula-lab',
    {
      targetEvalMode: config?.targetEvalMode,
      intent: config?.intent,
      objectiveText: config?.objectiveText,
    },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = (resolution?.allowedTypes ?? CHALLENGE_TYPE_ORDER)
    .filter((type): type is FormulaLabChallengeType => (
      CHALLENGE_TYPE_ORDER.includes(type as FormulaLabChallengeType)
    ));
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(
      formulaLabWrapperSchema,
      resolution.allowedTypes,
      CHALLENGE_TYPE_DOCS,
      { fieldName: 'challengeType', rootLevel: true },
    )
    : formulaLabWrapperSchema;
  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  const supportTier = normalizeSupportTier(config?.difficulty); // the STUDENT's tier — drives single or blended application
  const pinnedType = resolution && resolution.modes.length === 1
    ? allowedTypes[0]
    : undefined;
  const tierSection = buildTierPromptSection(allowedTypes, supportTier);
  const intent = nonempty(config?.intent);
  const prompt = `
Create session-level metadata for a Formula Lab about "${topic}" for ${gradeLevel} students.
${intent ? `Assigned learning intent: "${intent}".` : ''}

Formula Lab is a living formula simulation with five distinct task identities. The
application builds exactly five typed numeric challenges locally and recomputes every
answer. Do NOT emit challenges, baseline values, target values, answers, options, hints,
formula-token sequences, or worked examples.

${challengeTypeSection}
${tierSection}

FORMULA RULES:
- Choose one curriculum-relevant scalar formula with exactly 2 or 3 independent numeric inputs.
- Isolate the output on the left of formulaLatex: outputSymbol = expression.
- outputSymbol and every input symbol must be unique ASCII identifiers such as F, m, a, r, or rate.
- expression is only the right-hand arithmetic expression. It may contain input symbols,
  finite numbers, pi, parentheses, and + - * / ^.
- Do not use functions, assignments, implicit multiplication, Unicode operators, Math.*, units,
  or the output symbol inside expression. Write multiplication explicitly with *.
- Every declared input must actually affect the output across its range.
- Give each input a safe slider range, positive step, and in-range default. If an input is
  used in a denominator, its entire range must stay safely away from zero.
- Keep outputs finite and classroom-sized throughout the supplied ranges.
- Follow the tier's formula-shape target when an honest canonical relationship supports it.
  If the topic's valid formula cannot reach that shape, preserve the canonical relationship and
  saturate honestly instead of inventing another quantity or increasing numeric ranges.
- Without a tier target, use variableCount 2 unless a third input is genuinely necessary; fill variable2 fields only for 3.
- Choose a distinct valid accent for each variable.

CONTENT RULES:
- Prefer the formula most honestly aligned to the topic and assigned intent.
- If the topic is unsuitable for a safe 2-3 input scalar relationship, choose the nearest
  curriculum-relevant relationship and say so honestly in the context and description.
- Write transferContext as a concise, related-but-new setting in which the exact same
  formula, input quantities, and units still apply. Do not include numeric answers.
- Use sceneKind motion for forces/rates/motion, geometry for measures of shapes, container
  for volume/density/concentration/flow, and relationship otherwise.
- Set challengeType to one of the allowed task identities above. For a curated blend it is
  representative wrapper metadata only; local code distributes every allowed type.
- Return wrapper metadata only.
`;

  console.log(
    `[FormulaLab] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} `
      + `â†’ types [${(resolution?.allowedTypes ?? ['all']).join(', ')}]`,
  );

  let generated: FormulaLabData;
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });

    const raw = result.text ? JSON.parse(result.text) : null;
    const wrapper = validateWrapper(raw);
    if (!wrapper) {
      console.warn('[FormulaLab] Gemini wrapper rejected as a unit; using F=ma fallback');
      generated = buildFallback(allowedTypes, supportTier);
    } else {
      const challenges = buildChallenges(wrapper, allowedTypes, supportTier);
      if (!challenges) {
        console.warn('[FormulaLab] Valid wrapper could not produce a complete local pool; using F=ma fallback');
        generated = buildFallback(allowedTypes, supportTier);
      } else {
        generated = { ...wrapper, challenges };
      }
    }
  } catch (error) {
    console.warn('[FormulaLab] Gemini wrapper call failed; using F=ma fallback', error);
    generated = buildFallback(allowedTypes, supportTier);
  }

  // Apply and report the tier at the final exit, after Gemini/fallback validation.
  // Difficulty is a student property, so blended sessions receive both axes too.
  if (supportTier) {
    reportFormulaProblemShape(generated, allowedTypes, supportTier);
    applyFormulaLabSupportTier(generated.challenges, supportTier);
    console.log(
      `[FormulaLab] Support tier "${supportTier}" applied per-challenge ` +
      `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  return generated;
};
