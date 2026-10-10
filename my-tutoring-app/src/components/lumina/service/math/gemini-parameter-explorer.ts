/**
 * ParameterExplorer Generator — Orchestrator Pattern
 *
 * Two-stage generation:
 * 1. FORMULA SERVICE (sequential) — generates the formula definition, parameters,
 *    and metadata. Must complete first because challenges reference param symbols.
 * 2. PARALLEL SERVICES — challenges + observations run concurrently, each with
 *    a tight schema and the formula context from Stage 1.
 */

import { Type, Schema } from "@google/genai";
import { ParameterExplorerData, ParameterExplorerChallenge } from "../../primitives/visual-primitives/math/ParameterExplorer";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildScopePromptSection } from "../scopeContext";
import { dominantParameter, settleChallenge } from "../../primitives/visual-primitives/math/parameterExplorerWorkspace";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Within-mode SUPPORT TIER (config.difficulty) — second axis of the two-field
// contract: targetEvalMode = WHICH skill (the prediction task), difficulty =
// HOW MUCH on-screen explanatory help within it.
//
// ParameterExplorer is a LIVING SIMULATION. The hard rule for this archetype
// (memory [[feedback_living-simulation-pattern]] / [[feedback_direct-manipulation-first]]):
// a tier WITHDRAWS OVERLAYS (the live output readout, the per-parameter value
// readouts, the guided-observation annotations, the named-parameter highlight)
// — it NEVER withdraws the manipulable object itself. The sliders and the
// formula stay fully live and interactive at EVERY tier; the formula and its
// parameter ranges (the eval-mode scope) never change. The student always drives
// the sim; harder tiers just make them PREDICT the effect instead of reading it
// off a readout.
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; current defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

interface SupportScaffold {
  /** The big focal live OUTPUT readout — the numeric result of the formula at the
   *  current slider positions. This is the core "effect annotation": it tells the
   *  student exactly what the parameter did. ANSWER-LEAK GUARD: for predict-value
   *  / predict-direction, a student could slide to the asked value and read the
   *  answer off this overlay, so it is shown ONLY at easy (self-check aid), never
   *  at hard. The component's checker is independent of this flag. */
  showOutputReadout: boolean;
  /** The per-parameter numeric value readout printed beside each slider symbol.
   *  Perception aid — withdrawn at hard so the student tracks slider position by
   *  feel, not by reading the number back. */
  showParamReadouts: boolean;
  /** The guided-observation callouts — explanatory annotations that narrate the
   *  parameter→output relationship in words. Withdrawn at medium and hard so the
   *  student articulates the relationship themselves. */
  showObservations: boolean;
  /** Amber "watch this slider" cue on the parameter the prompt names. A tracking
   *  aid for predict modes; withdrawn at hard so the student locates the relevant
   *  parameter from the instruction alone. */
  showVaryHighlight: boolean;
  /** Prompt lines describing the tier to the challenge/observation services
   *  (scaffolding tone only — never changes the formula or parameter scope). */
  promptLines: string[];
}

const TIER_GUARDRAIL =
  'This tier is SCAFFOLDING ONLY. Keep the EXACT SAME formula, parameters, ranges, ' +
  'and the asked prediction — never change the math or make numbers bigger. The tier ' +
  'only withdraws on-screen EXPLANATORY OVERLAYS (the live output readout, the ' +
  'observation callouts); the student always keeps the live sliders.';

/** easy → hard support gradient, per pinned challenge type (the eval-mode task). */
function resolveSupportStructure(
  type: ParameterExplorerChallenge['type'],
  tier: SupportTier,
): SupportScaffold {
  // For PREDICTION tasks the live output readout can BE the answer (slide to the
  // asked value and read it off). So it is an easy-only self-check aid and is
  // withdrawn the moment the task is a real prediction (medium/hard).
  const isPrediction = type === 'predict-direction' || type === 'predict-value';

  switch (type) {
    case 'explore':
      // Free exploration: the readouts ARE the lesson (build intuition by
      // watching numbers move). Never withdraw the output readout here — there
      // is no answer to leak. The tier only dials the explanatory observations.
      return {
        showOutputReadout: true,
        showParamReadouts: true,
        showObservations: tier === 'easy',
        showVaryHighlight: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'easy'
            ? 'EASY: the live output + per-parameter readouts and the guided observation callouts are all on — the student watches the numbers move and the callouts name the relationship.'
            : tier === 'medium'
              ? 'MEDIUM: readouts stay on but the observation callouts are withdrawn — the student notices the pattern without prose narration.'
              : 'HARD: readouts stay on (exploration needs them) but no observation callouts — the student articulates each relationship unaided.',
        ],
      };

    case 'identify-relationship':
      // The student compares parameters' effects. The live output readout is the
      // tool they use; keep it (it is not the literal answer). Withdraw the
      // observation annotations (which could name the dominant parameter) and the
      // per-parameter readouts at hard.
      return {
        showOutputReadout: tier !== 'hard',
        showParamReadouts: tier !== 'hard',
        showObservations: false, // an observation could name the dominant parameter — off at every tier
        showVaryHighlight: false,
        promptLines: [
          TIER_GUARDRAIL,
          tier === 'hard'
            ? 'HARD: no output readout and no value readouts — the student reasons about which parameter dominates from the FORMULA STRUCTURE alone (where each appears, multiplier vs additive, exponent).'
            : tier === 'easy'
              ? 'EASY: the live output readout is on so the student can A/B test each slider and SEE which moves the output most.'
              : 'MEDIUM: output readout on, but the student is nudged to read the formula rather than only brute-force the sliders.',
        ],
      };

    case 'predict-direction':
    case 'predict-value':
    default:
      // PREDICTION tasks: the live output readout is the answer if the student
      // slides to the asked value. Show it only at easy (self-check BEFORE
      // committing); withdraw the moment it is a real prediction.
      return {
        showOutputReadout: tier === 'easy',
        showParamReadouts: tier !== 'hard',
        showObservations: tier === 'easy',
        showVaryHighlight: tier !== 'hard',
        promptLines: [
          TIER_GUARDRAIL,
          isPrediction && tier === 'easy'
            ? 'EASY: the live output readout, per-parameter readouts, the varied-parameter highlight, and the observation callouts are all on — the student can self-check the effect before answering. The explanation may NAME the relationship (e.g. "directly proportional").'
            : tier === 'medium'
              ? 'MEDIUM: the live output readout and observation callouts are WITHDRAWN — the student predicts the effect from the formula before touching the sliders. The varied parameter is still highlighted. Explanation nudges the reasoning without naming the relationship.'
              : 'HARD: no output readout, no value readouts, no highlight, no observations — the student locates the varied parameter from the instruction and predicts the effect purely from the formula. Explanation states the result without first revealing it.',
        ],
      };
  }
}

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  explore: {
    promptDoc:
      `"explore": Free exploration mode. Student moves sliders to observe how each parameter `
      + `affects the output. No prediction required — the goal is building intuition. `
      + `Provide a clear instruction telling the student what to look for while exploring.`,
    schemaDescription: "'explore' (free exploration with sliders)",
  },
  'predict-direction': {
    promptDoc:
      `"predict-direction": Student predicts whether the output will increase, decrease, or stay the same `
      + `when a specific parameter changes from its default to a new value. Requires predVaryParameter (which parameter symbol), `
      + `predNewValue (the value it changes to, inside its slider range and different from its default), `
      + `predCorrectDirection ('increase'|'decrease'|'stay-same'), and predExplanation. `
      + `Choose parameters where the direction is unambiguous from the formula.`,
    schemaDescription: "'predict-direction' (predict output direction when parameter changes)",
  },
  'predict-value': {
    promptDoc:
      `"predict-value": Student predicts the exact numeric output when a parameter changes to a specific value. `
      + `Requires predVaryParameter, predNewValue (the new parameter value), predCorrectValue (expected output), `
      + `predTolerance (acceptable error margin), and predExplanation. `
      + `The correctValue MUST be mathematically derivable from the formula with all other parameters at defaults. `
      + `Use simple numbers that students can compute mentally or on paper.`,
    schemaDescription: "'predict-value' (predict exact output for a parameter change)",
  },
  'identify-relationship': {
    promptDoc:
      `"identify-relationship": Student identifies which parameter changes the output the most when it alone is `
      + `doubled from its default (the others held). Requires identifyCorrectParameter (that parameter's symbol). `
      + `Only use it when one parameter genuinely leads — e.g., it is raised to a higher power, or it multiplies `
      + `while others only add. In a plain product of first powers (V = IR) doubling any one doubles the output: no leader.`,
    schemaDescription: "'identify-relationship' (identify most influential parameter)",
  },
};

/**
 * What a pinned mode needs from the formula. identify needs a parameter that leads (a product of first powers has
 * none); predict-direction needs one that divides, or every answer is "the same way the input moved".
 */
const FORMULA_NEED: Partial<Record<ParameterExplorerChallenge['type'], string>> = {
  'identify-relationship': 'The students will be asked which parameter changes the output the most when it alone is doubled. '
    + 'Choose a formula where one parameter clearly leads: raised to a higher power than the others (A = πr², d = ½gt², '
    + 'KE = ½mv², P = I²R), or the only multiplier where the others add. NOT a plain product of first powers like V = IR '
    + 'or F = ma (doubling any one doubles the output).',
  'predict-direction': 'The students will predict which way the output moves when one parameter changes. Choose a formula '
    + 'where at least one parameter divides (sits in a denominator), so raising it lowers the output: I = V/R, a = F/m, '
    + 'P = F/A, ρ = m/V, t = d/v. Not a plain product, where every answer would be "the same way the input moved".',
};

// ═══════════════════════════════════════════════════════════════════════════
// Stage 1: Formula Service — defines the formula, parameters, and metadata
// ═══════════════════════════════════════════════════════════════════════════

interface FormulaResult {
  title: string;
  description?: string;
  formula: string;
  jsExpression: string;
  outputName: string;
  outputUnit?: string;
  context: string;
  paramCount: number;
  [key: string]: unknown;
}

const FORMULA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Display title (e.g., 'Ohm\\'s Law Explorer')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will explore",
    },
    formula: {
      type: Type.STRING,
      description: "LaTeX formula for display (e.g., 'V = IR')",
    },
    jsExpression: {
      type: Type.STRING,
      description: "JavaScript-evaluable expression using parameter symbols. Use Math.pow, Math.sqrt, Math.sin, Math.cos, Math.log, Math.PI, Math.E. Example: 'I * R'",
    },
    outputName: {
      type: Type.STRING,
      description: "What the formula computes (e.g., 'Voltage')",
    },
    outputUnit: {
      type: Type.STRING,
      description: "Unit of the output (e.g., 'V', 'N', 'm')",
    },
    context: {
      type: Type.STRING,
      description: "Domain context explaining what real-world scenario this formula models",
    },
    paramCount: {
      type: Type.NUMBER,
      description: "Number of parameters (2 or 3)",
    },
    param0Symbol: { type: Type.STRING, description: "Parameter 0 symbol (e.g., 'I')" },
    param0Name: { type: Type.STRING, description: "Parameter 0 display name (e.g., 'Current')" },
    param0Unit: { type: Type.STRING, description: "Parameter 0 unit (e.g., 'A')" },
    param0Min: { type: Type.NUMBER, description: "Parameter 0 slider minimum" },
    param0Max: { type: Type.NUMBER, description: "Parameter 0 slider maximum" },
    param0Step: { type: Type.NUMBER, description: "Parameter 0 slider step size" },
    param0Default: { type: Type.NUMBER, description: "Parameter 0 default value" },
    param0Description: { type: Type.STRING, description: "Parameter 0 description" },

    param1Symbol: { type: Type.STRING, description: "Parameter 1 symbol" },
    param1Name: { type: Type.STRING, description: "Parameter 1 display name" },
    param1Unit: { type: Type.STRING, description: "Parameter 1 unit" },
    param1Min: { type: Type.NUMBER, description: "Parameter 1 slider minimum" },
    param1Max: { type: Type.NUMBER, description: "Parameter 1 slider maximum" },
    param1Step: { type: Type.NUMBER, description: "Parameter 1 slider step size" },
    param1Default: { type: Type.NUMBER, description: "Parameter 1 default value" },
    param1Description: { type: Type.STRING, description: "Parameter 1 description" },

    param2Symbol: { type: Type.STRING, description: "Parameter 2 symbol (if paramCount = 3)" },
    param2Name: { type: Type.STRING, description: "Parameter 2 display name" },
    param2Unit: { type: Type.STRING, description: "Parameter 2 unit" },
    param2Min: { type: Type.NUMBER, description: "Parameter 2 slider minimum" },
    param2Max: { type: Type.NUMBER, description: "Parameter 2 slider maximum" },
    param2Step: { type: Type.NUMBER, description: "Parameter 2 slider step size" },
    param2Default: { type: Type.NUMBER, description: "Parameter 2 default value" },
    param2Description: { type: Type.STRING, description: "Parameter 2 description" },
  },
  required: [
    'title', 'formula', 'jsExpression', 'outputName', 'context',
    'paramCount',
    'param0Symbol', 'param0Name', 'param0Min', 'param0Max', 'param0Step', 'param0Default', 'param0Description',
    'param1Symbol', 'param1Name', 'param1Min', 'param1Max', 'param1Step', 'param1Default', 'param1Description',
  ],
};

async function runFormulaService(
  topic: string,
  gradeLevel: string,
  scopeSection = '',
  formulaNeed = '',
): Promise<FormulaResult | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Design a formula for a Parameter Explorer on "${topic}" for ${gradeLevel} students.
${scopeSection}

A Parameter Explorer lets students manipulate formula variables via sliders and observe output changes in real time.

REQUIREMENTS:
1. Choose a formula appropriate for the topic and grade level
2. Provide BOTH:
   - LaTeX formula for display (e.g., "V = IR", "a = \\\\frac{F}{m}", "A = \\\\pi r^2")
   - JavaScript expression for evaluation (e.g., "I * R", "F / m", "Math.PI * Math.pow(r, 2)")
3. The JS expression may use ONLY the parameter symbols, numbers and Math functions. Write any constant as a number
   (g as 9.8, G as 6.674e-11); a letter that is not a parameter breaks the formula
4. Use Math.pow(base, exp) for exponentiation — NEVER use **
5. Use 2-3 parameters with clear physical/domain meaning, every one of them in the formula (never a placeholder parameter the formula ignores)
6. Each parameter needs sensible numeric ranges and step sizes, with every min, max, step and default between 0.01 and
   10000 so a student reads them without scientific notation (pick units that keep them there: Earth masses, km, minutes)
7. Default values should produce a reasonable, non-zero output

EXAMPLE FORMULAS:
- Physics: V = IR, F = ma, d = 0.5gt², P = IV
- Chemistry: PV = nRT (solve for one variable)
- Economics: Revenue = P × Q
- Geometry: A = πr², V = lwh

AVOID: division by zero at any slider position, NaN/Infinity, more than 3 variables, Python syntax (**).${formulaNeed ? `

${formulaNeed}` : ''}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: FORMULA_SCHEMA,
    },
  });

  return response.text ? JSON.parse(response.text) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage 2a: Challenges Service — generates challenges given formula context
// ═══════════════════════════════════════════════════════════════════════════

interface FlatChallenge {
  id: string;
  type: string;
  instruction: string;
  predVaryParameter?: string;
  predCorrectDirection?: string;
  predNewValue?: number;
  predCorrectValue?: number;
  predTolerance?: number;
  predExplanation?: string;
  identifyCorrectParameter?: string;
}

const challengeItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique challenge ID (e.g., 'ch1', 'ch2')",
    },
    type: {
      type: Type.STRING,
      description: "Challenge type",
      enum: ['explore', 'predict-direction', 'predict-value', 'identify-relationship'],
    },
    instruction: {
      type: Type.STRING,
      description: "Clear instruction telling the student what to do",
    },
    predVaryParameter: {
      type: Type.STRING,
      description: "Which parameter symbol is being varied (for predict-direction and predict-value)",
    },
    predCorrectDirection: {
      type: Type.STRING,
      description: "Expected direction: 'increase', 'decrease', or 'stay-same' (for predict-direction)",
      enum: ['increase', 'decrease', 'stay-same'],
    },
    predNewValue: {
      type: Type.NUMBER,
      description: "The new value the parameter changes to from its default (for predict-direction and predict-value)",
    },
    predCorrectValue: {
      type: Type.NUMBER,
      description: "Expected output when parameter changes to predNewValue (for predict-value). Must be mathematically correct.",
    },
    predTolerance: {
      type: Type.NUMBER,
      description: "Acceptable tolerance for predict-value answers (e.g., 0.5)",
    },
    predExplanation: {
      type: Type.STRING,
      description: "Explanation of why the prediction is correct (for predict-direction and predict-value)",
    },
    identifyCorrectParameter: {
      type: Type.STRING,
      description: "Symbol of the parameter with the strongest effect (for identify-relationship)",
    },
  },
  required: ['id', 'type', 'instruction'],
};

const CHALLENGES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: challengeItemSchema,
      description: "Array of 3-4 challenges",
    },
  },
  required: ['challenges'],
};

/** The fields each challenge type needs; a pinned single type makes them required, or the model drops them. */
const REQUIRED_BY_TYPE: Record<string, string[]> = {
  explore: [],
  'predict-direction': ['predVaryParameter', 'predNewValue', 'predCorrectDirection', 'predExplanation'],
  'predict-value': ['predVaryParameter', 'predNewValue', 'predCorrectValue', 'predTolerance', 'predExplanation'],
  'identify-relationship': ['identifyCorrectParameter'],
};

async function runChallengesService(
  formulaContext: string,
  challengeTypeSection: string,
  allowedTypes: string[] | undefined,
  tierSection: string,
  symbols: string[],
): Promise<FlatChallenge[]> {
  // Parameter references are the formula's symbols (an open string came back as "mIdv2"); a single pinned type
  // requires its own fields.
  const symbolEnum = { type: Type.STRING, enum: symbols };
  const properties = {
    ...challengeItemSchema.properties,
    predVaryParameter: { ...challengeItemSchema.properties!.predVaryParameter, ...symbolEnum },
    identifyCorrectParameter: { ...challengeItemSchema.properties!.identifyCorrectParameter, ...symbolEnum },
    ...(allowedTypes && allowedTypes.length < 4
      ? { type: { ...challengeItemSchema.properties!.type, enum: allowedTypes } } : {}),
  };
  const required = ['id', 'type', 'instruction',
    ...(allowedTypes?.length === 1 ? REQUIRED_BY_TYPE[allowedTypes[0]] ?? [] : [])];
  const activeSchema: Schema = {
    ...CHALLENGES_SCHEMA,
    properties: {
      challenges: {
        type: Type.ARRAY,
        items: { ...challengeItemSchema, properties, required },
        description: allowedTypes && allowedTypes.length < 4
          ? `Array of 3-4 challenges using ONLY these types: ${allowedTypes.join(', ')}`
          : 'Array of 3-4 challenges',
      },
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate challenges for a Parameter Explorer.

${formulaContext}

${challengeTypeSection}
${tierSection}
RULES:
- Generate 3-4 challenges
- For predict-direction: choose parameters where the direction is UNAMBIGUOUS
- For predict-value: use simple numbers students can compute mentally. The correctValue MUST equal the formula evaluated with all parameters at their defaults EXCEPT the varied one at its newValue
- For identify-relationship: pick the parameter that genuinely dominates the output
- Start with an 'explore' challenge when multiple types are allowed
- predVaryParameter and identifyCorrectParameter MUST use parameter symbols from the formula above
${allowedTypes ? `- ALL challenges must be one of: ${allowedTypes.join(', ')}` : ''}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: activeSchema,
    },
  });

  if (!response.text) return [];
  const data = JSON.parse(response.text);
  return data.challenges || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage 2b: Observations Service — generates guided observation prompts
// ═══════════════════════════════════════════════════════════════════════════

const OBSERVATIONS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    obs0Trigger: { type: Type.STRING, description: "Observation 1 trigger description" },
    obs0Prompt: { type: Type.STRING, description: "Observation 1 prompt text shown to student" },
    obs1Trigger: { type: Type.STRING, description: "Observation 2 trigger description" },
    obs1Prompt: { type: Type.STRING, description: "Observation 2 prompt text shown to student" },
  },
  required: ['obs0Trigger', 'obs0Prompt', 'obs1Trigger', 'obs1Prompt'],
};

async function runObservationsService(
  formulaContext: string,
): Promise<Array<{ trigger: string; prompt: string }>> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate 2 guided observation prompts for a Parameter Explorer.

${formulaContext}

Each observation should:
- Have a trigger describing what the student does (e.g., "Vary I while R is locked")
- Have a prompt that draws attention to a key relationship or pattern
- Help build intuition about the formula's behavior`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: OBSERVATIONS_SCHEMA,
    },
  });

  if (!response.text) return [];
  const data = JSON.parse(response.text);

  const observations: Array<{ trigger: string; prompt: string }> = [];
  for (let i = 0; i < 2; i++) {
    const trigger = data[`obs${i}Trigger`];
    const prompt = data[`obs${i}Prompt`];
    if (trigger && prompt) {
      observations.push({ trigger, prompt });
    }
  }
  return observations;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback (electrical power P = I^2 R): every mode has an answerable item. A
// product of equal powers (V = IR) has no leading parameter, so it cannot serve identify.
// ---------------------------------------------------------------------------

function buildFallback(allowedTypes?: string[]): ParameterExplorerData {
  const allChallenges: ParameterExplorerChallenge[] = [
    { id: 'fb1', type: 'explore', instruction: 'Move both sliders and watch the power. Try holding one constant while you vary the other.' },
    { id: 'fb2', type: 'predict-direction', instruction: 'If the current increases, what happens to the power?', prediction: { varyParameter: 'I', newValue: 4, correctDirection: 'increase', explanation: 'Power grows with the square of the current, so more current means more power.' } },
    { id: 'fb5', type: 'predict-direction', instruction: 'If the resistance decreases, what happens to the power?', prediction: { varyParameter: 'R', newValue: 5, correctDirection: 'decrease', explanation: 'With the current held, power is proportional to resistance, so less resistance means less power.' } },
    { id: 'fb3', type: 'predict-value', instruction: 'If the current is 5 A, what is the power?', prediction: { varyParameter: 'I', newValue: 5, correctValue: 250, tolerance: 1, explanation: 'P = I² × R = 25 × 10 = 250 W' } },
    { id: 'fb6', type: 'predict-value', instruction: 'If the resistance is 30 Ω, what is the power?', prediction: { varyParameter: 'R', newValue: 30, correctValue: 120, tolerance: 1, explanation: 'P = I² × R = 4 × 30 = 120 W' } },
    { id: 'fb4', type: 'identify-relationship', instruction: 'Which parameter changes the power more when it is doubled?', correctParameter: 'I' },
  ];

  const challenges = allowedTypes
    ? allChallenges.filter(ch => allowedTypes.includes(ch.type))
    : allChallenges;

  return {
    title: 'Electrical Power Explorer',
    description: 'Explore how the power in a resistor depends on current and resistance',
    formula: 'P = I^2 R',
    jsExpression: 'Math.pow(I, 2) * R',
    outputName: 'Power',
    outputUnit: 'W',
    context: 'Electrical circuits: the power a resistor turns into heat depends on the current through it and its resistance.',
    parameters: [
      { symbol: 'I', name: 'Current', unit: 'A', min: 0, max: 10, step: 0.5, default: 2, description: 'Electric current flowing through the resistor' },
      { symbol: 'R', name: 'Resistance', unit: 'Ω', min: 1, max: 100, step: 1, default: 10, description: 'Resistance of the circuit element' },
    ],
    observations: [
      { trigger: 'Vary I', prompt: 'Watch how fast the power climbs as the current goes up with resistance held.' },
      { trigger: 'Vary R', prompt: 'Now hold the current and vary the resistance. Does the power climb the same way?' },
    ],
    challenges: challenges.length > 0 ? challenges : allChallenges,
  };
}

// ---------------------------------------------------------------------------
// Reconstruction helpers
// ---------------------------------------------------------------------------

/** Reconstruct parameters array from flat param0-param2 fields. */
function reconstructParameters(data: FormulaResult): ParameterExplorerData['parameters'] {
  const params: ParameterExplorerData['parameters'] = [];
  const count = Math.min(Math.max(data.paramCount || 2, 2), 3);

  for (let i = 0; i < count; i++) {
    const prefix = `param${i}`;
    const symbol = data[`${prefix}Symbol`] as string | undefined;
    const name = data[`${prefix}Name`] as string | undefined;
    if (!symbol || !name) {
      console.warn(`[ParameterExplorer] Missing symbol/name for param${i}, stopping at ${i} parameters`);
      break;
    }
    params.push({
      symbol,
      name,
      unit: (data[`${prefix}Unit`] as string) || undefined,
      min: (data[`${prefix}Min`] as number) ?? 0,
      max: (data[`${prefix}Max`] as number) ?? 10,
      step: (data[`${prefix}Step`] as number) ?? 1,
      default: (data[`${prefix}Default`] as number) ?? 1,
      description: (data[`${prefix}Description`] as string) || '',
    });
  }

  return params;
}

/** Reconstruct a single challenge from flat Gemini fields into the component's shape. */
function reconstructChallenge(
  flat: FlatChallenge,
): ParameterExplorerChallenge | null {
  const { id, type, instruction } = flat;
  if (!id || !type || !instruction) {
    console.warn(`[ParameterExplorer] Rejecting challenge: missing id/type/instruction`, flat);
    return null;
  }

  const base: ParameterExplorerChallenge = { id, type: type as ParameterExplorerChallenge['type'], instruction };

  switch (type) {
    case 'explore':
      return base;

    case 'predict-direction': {
      if (!flat.predVaryParameter || !flat.predCorrectDirection || !flat.predExplanation) {
        console.warn(`[ParameterExplorer] Rejecting predict-direction challenge: missing required pred* fields`, flat);
        return null;
      }
      base.prediction = {
        varyParameter: flat.predVaryParameter,
        correctDirection: flat.predCorrectDirection as 'increase' | 'decrease' | 'stay-same',
        explanation: flat.predExplanation,
      };
      return base;
    }

    case 'predict-value': {
      if (
        !flat.predVaryParameter ||
        flat.predNewValue === undefined || flat.predNewValue === null ||
        flat.predCorrectValue === undefined || flat.predCorrectValue === null ||
        flat.predTolerance === undefined || flat.predTolerance === null ||
        !flat.predExplanation
      ) {
        console.warn(`[ParameterExplorer] Rejecting predict-value challenge: missing required pred* fields`, flat);
        return null;
      }
      base.prediction = {
        varyParameter: flat.predVaryParameter,
        newValue: flat.predNewValue,
        correctValue: flat.predCorrectValue,
        tolerance: flat.predTolerance,
        explanation: flat.predExplanation,
      };
      return base;
    }

    case 'identify-relationship': {
      if (!flat.identifyCorrectParameter) {
        console.warn(`[ParameterExplorer] Rejecting identify-relationship challenge: missing identifyCorrectParameter`, flat);
        return null;
      }
      base.correctParameter = flat.identifyCorrectParameter;
      return base;
    }

    default:
      console.warn(`[ParameterExplorer] Rejecting challenge with unknown type: ${type}`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Test that jsExpression is evaluable with the given parameter defaults. */
function validateJsExpression(
  jsExpression: string,
  params: ParameterExplorerData['parameters'],
): boolean {
  try {
    const paramValues: Record<string, number> = {};
    for (const p of params) {
      paramValues[p.symbol] = p.default;
    }
    const paramNames = Object.keys(paramValues);
    const paramVals = Object.values(paramValues);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...paramNames, `"use strict"; return (${jsExpression});`);
    const result = fn(...paramVals);
    if (typeof result !== 'number' || !isFinite(result)) {
      console.warn(`[ParameterExplorer] jsExpression evaluated to non-finite: ${result}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[ParameterExplorer] jsExpression failed to evaluate: ${e}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Build formula context string for Stage 2 services
// ---------------------------------------------------------------------------

function buildFormulaContext(
  topic: string,
  gradeLevel: string,
  formula: string,
  jsExpression: string,
  outputName: string,
  outputUnit: string | undefined,
  context: string,
  parameters: ParameterExplorerData['parameters'],
): string {
  const paramList = parameters
    .map(p => `  ${p.symbol} (${p.name}): ${p.min}–${p.max}, step ${p.step}, default ${p.default}${p.unit ? ` ${p.unit}` : ''}`)
    .join('\n');

  return `FORMULA CONTEXT:
Topic: "${topic}" for ${gradeLevel} students
Formula: ${formula}
JS Expression: ${jsExpression}
Output: ${outputName}${outputUnit ? ` (${outputUnit})` : ''}
Context: ${context}
Parameters:
${paramList}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Export — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

type ParameterExplorerConfig = Partial<{
  targetEvalMode?: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which prediction
   * task, difficulty = how much explanatory overlay within it. NEVER changes
   * the formula, parameters, or ranges — only withdraws on-screen overlays.
   */
  difficulty?: string;
}>;

export const generateParameterExplorer = async (
  ctx: GenerationContext,
): Promise<ParameterExplorerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const config = ctx.raw as ParameterExplorerConfig;
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'parameter-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ParameterExplorer', config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint?.allowedTypes;
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // ── Resolve support tier (the STUDENT's tier — drives per-challenge application
  //    at the end). pinnedType is ONLY for prompt tone when a single mode is pinned. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint?.allowedTypes.length === 1
      ? (evalConstraint.allowedTypes[0] as ParameterExplorerChallenge['type'])
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  const tierSection = tierScaffold
    ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT formula/number size)\n`
      + `${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  console.log(`[ParameterExplorer] Stage 1: Formula service for "${topic}"`);

  // ── Stage 1 (Sequential): Formula definition. A formula the sliders cannot drive is asked for once more, with
  //    exactly two parameters (flash-lite drops the optional third one while the expression still uses it). ──
  const need = pinnedType ? FORMULA_NEED[pinnedType] ?? '' : '';
  const settleFormula = async (note: string) => {
    const result = await runFormulaService(topic, gradeLevel, scopeSection, [need, note].filter(Boolean).join('\n\n'));
    if (!result) return { problem: 'Formula service returned empty' };
    const params = reconstructParameters(result);
    if (params.length < 2) return { problem: `Only ${params.length} parameters reconstructed` };
    if (!validateJsExpression(result.jsExpression, params)) return { problem: `jsExpression "${result.jsExpression}" is not evaluable` };
    // A slider the formula ignores teaches nothing and makes every "which matters most" item trivial.
    const usesSymbol = (symbol: string) => result.jsExpression.split(/[^A-Za-z0-9_.]+/).includes(symbol);
    const ignored = params.filter(p => !usesSymbol(p.symbol));
    if (ignored.length) return { problem: `Parameter(s) ${ignored.map(p => p.symbol).join(', ')} not in "${result.jsExpression}"` };
    if (pinnedType === 'identify-relationship' && !dominantParameter({ ...result, parameters: params }))
      return { problem: `No parameter leads in "${result.jsExpression}"` };
    return { formulaResult: result, parameters: params };
  };
  let settled = await settleFormula('');
  if (!settled.formulaResult) {
    console.warn(`[ParameterExplorer] ${settled.problem}; asking again for two parameters`);
    settled = await settleFormula('Use exactly 2 parameters (paramCount 2), both used in the jsExpression.');
  }
  if (!settled.formulaResult || !settled.parameters) {
    console.warn(`[ParameterExplorer] ${settled.problem}, using fallback`);
    return buildFallback(allowedTypes);
  }
  const { formulaResult, parameters } = settled;

  console.log(`[ParameterExplorer] Stage 2: Challenges + Observations in parallel`);

  // ── Stage 2 (Parallel): Challenges + Observations ──
  const formulaContext = buildFormulaContext(
    topic, gradeLevel,
    formulaResult.formula, formulaResult.jsExpression,
    formulaResult.outputName, formulaResult.outputUnit,
    formulaResult.context, parameters,
  );

  const [rawChallenges, observations] = await Promise.all([
    runChallengesService(formulaContext, challengeTypeSection, allowedTypes, tierSection, parameters.map(p => p.symbol)),
    runObservationsService(formulaContext),
  ]);

  // ── Reconstruct and validate challenges ──
  let validChallenges: ParameterExplorerChallenge[] = [];

  for (const flatCh of rawChallenges) {
    const reconstructed = reconstructChallenge(flatCh);
    if (reconstructed) validChallenges.push(reconstructed);
  }

  const rejectedCount = rawChallenges.length - validChallenges.length;
  if (rejectedCount > 0) {
    console.warn(`[ParameterExplorer] Rejected ${rejectedCount}/${rawChallenges.length} challenges for missing fields`);
  }

  // ── Filter by allowed challenge types ──
  if (allowedTypes) {
    const beforeFilter = validChallenges.length;
    validChallenges = validChallenges.filter(ch => allowedTypes.includes(ch.type));
    const typeFiltered = beforeFilter - validChallenges.length;
    if (typeFiltered > 0) {
      console.warn(`[ParameterExplorer] Filtered ${typeFiltered} challenges with disallowed types (allowed: [${allowedTypes.join(', ')}])`);
    }
  }

  if (validChallenges.length === 0) {
    console.warn('[ParameterExplorer] All challenges rejected, using fallback');
    return buildFallback(allowedTypes);
  }

  // ── Validate parameter references ──
  const paramSymbols = new Set(parameters.map(p => p.symbol));
  validChallenges = validChallenges.filter(ch => {
    if (ch.prediction?.varyParameter && !paramSymbols.has(ch.prediction.varyParameter)) {
      console.warn(`[ParameterExplorer] Challenge ${ch.id} references unknown parameter "${ch.prediction.varyParameter}"`);
      return false;
    }
    if (ch.correctParameter && !paramSymbols.has(ch.correctParameter)) {
      console.warn(`[ParameterExplorer] Challenge ${ch.id} references unknown correctParameter "${ch.correctParameter}"`);
      return false;
    }
    return true;
  });

  if (validChallenges.length === 0) {
    console.warn('[ParameterExplorer] All challenges referenced invalid parameters, using fallback');
    return buildFallback(allowedTypes);
  }

  // ── Code owns every key (`settleChallenge`): the direction and the value come from the formula at a setting on the
  //    slider, the leading parameter from doubling each one. An item the formula cannot answer is dropped. ──
  const lab = { formula: formulaResult.formula, jsExpression: formulaResult.jsExpression, outputName: formulaResult.outputName,
    outputUnit: formulaResult.outputUnit, parameters };
  const settledCount = validChallenges.length;
  validChallenges = validChallenges.flatMap(ch => {
    const settledChallenge = settleChallenge(lab, ch);
    if (!settledChallenge) console.warn(`[ParameterExplorer] ${ch.id} (${ch.type}) has no answerable setting in "${lab.jsExpression}": `
      + JSON.stringify(ch.prediction ?? ch.correctParameter ?? null));
    return settledChallenge ?? [];
  });
  // N challenges = N problems: one formula has one leading parameter, so identify asks once; a repeated setting is
  // the same prediction.
  const asked = new Set<string>();
  validChallenges = validChallenges.filter(ch => {
    const key = ch.type === 'identify-relationship' ? ch.type
      : ch.type === 'explore' ? `${ch.type}:${ch.id}` : `${ch.type}:${ch.prediction?.varyParameter}:${ch.prediction?.newValue}`;
    if (asked.has(key)) return false;
    asked.add(key);
    return true;
  });
  if (validChallenges.length < settledCount) {
    console.warn(`[ParameterExplorer] Dropped ${settledCount - validChallenges.length} challenge(s) the formula cannot answer or that repeat another`);
  }
  if (validChallenges.length === 0) {
    console.warn('[ParameterExplorer] No challenge the formula can answer, using fallback');
    return buildFallback(allowedTypes);
  }

  // ── Apply the support tier deterministically, PER CHALLENGE, at the very end ──
  // Gate ONLY on a tier being present (NOT pinnedType) so a blended/auto session
  // still gets difficulty. Each challenge resolves its OWN overlay set from its
  // own type. Code owns the OVERLAY structure; the LLM only chose the formula
  // (unchanged). The sliders + formula (the manipulable sim) are NEVER touched —
  // the component keeps them live at every tier. The answer-leak guard lives in
  // resolveSupportStructure (output readout off for real predictions).
  let suppressObservations = false;
  if (supportTier) {
    for (const ch of validChallenges) {
      const sc = resolveSupportStructure(ch.type, supportTier);
      ch.showOutputReadout = sc.showOutputReadout;
      ch.showParamReadouts = sc.showParamReadouts;
      ch.showVaryHighlight = sc.showVaryHighlight;
      ch.supportTier = supportTier;
      // Observations are a session-level overlay; withdraw them if ANY challenge's
      // tier withdraws them (the strictest challenge wins — never leak the
      // relationship the hard task asks the student to find).
      if (!sc.showObservations) suppressObservations = true;
    }
    console.log(
      `[ParameterExplorer] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`,
    );
  }

  // ── Assemble final data ──
  console.log(`[ParameterExplorer] Assembled: ${parameters.length} params, ${validChallenges.length} challenges, ${observations.length} observations`);

  return {
    title: formulaResult.title,
    description: formulaResult.description,
    formula: formulaResult.formula,
    jsExpression: formulaResult.jsExpression,
    outputName: formulaResult.outputName,
    outputUnit: formulaResult.outputUnit,
    context: formulaResult.context,
    parameters,
    observations: !suppressObservations && observations.length > 0 ? observations : undefined,
    challenges: validChallenges,
  };
};
