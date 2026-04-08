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
import {
  resolveEvalModeConstraint,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

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
      + `when a specific parameter changes. Requires predVaryParameter (which parameter symbol), `
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
      `"identify-relationship": Student identifies which parameter has the strongest effect on the output. `
      + `Requires identifyCorrectParameter (the symbol of the most influential parameter). `
      + `Choose a formula where one parameter genuinely dominates — e.g., appears as a multiplier `
      + `while others are additive, or appears with a higher exponent.`,
    schemaDescription: "'identify-relationship' (identify most influential parameter)",
  },
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
): Promise<FormulaResult | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Design a formula for a Parameter Explorer on "${topic}" for ${gradeLevel} students.

A Parameter Explorer lets students manipulate formula variables via sliders and observe output changes in real time.

REQUIREMENTS:
1. Choose a formula appropriate for the topic and grade level
2. Provide BOTH:
   - LaTeX formula for display (e.g., "V = IR", "F = \\\\frac{Gm_1m_2}{r^2}")
   - JavaScript expression for evaluation (e.g., "I * R", "G * m1 * m2 / Math.pow(r, 2)")
3. The JS expression must use the EXACT same symbols as the parameter symbols
4. Use Math.pow(base, exp) for exponentiation — NEVER use **
5. Use 2-3 parameters with clear physical/domain meaning
6. Each parameter needs sensible numeric ranges and step sizes
7. Default values should produce a reasonable, non-zero output

EXAMPLE FORMULAS:
- Physics: V = IR, F = ma, d = 0.5gt², P = IV
- Chemistry: PV = nRT (solve for one variable)
- Economics: Revenue = P × Q
- Geometry: A = πr², V = lwh

AVOID: division by zero at any slider position, NaN/Infinity, more than 3 variables, Python syntax (**).`,
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
      description: "The new value the parameter changes to (for predict-value)",
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

async function runChallengesService(
  formulaContext: string,
  challengeTypeSection: string,
  allowedTypes: string[] | undefined,
): Promise<FlatChallenge[]> {
  // Constrain the schema enum if eval mode restricts types
  let activeSchema = CHALLENGES_SCHEMA;
  if (allowedTypes && allowedTypes.length < 4) {
    activeSchema = {
      ...CHALLENGES_SCHEMA,
      properties: {
        challenges: {
          type: Type.ARRAY,
          items: {
            ...challengeItemSchema,
            properties: {
              ...challengeItemSchema.properties,
              type: {
                ...challengeItemSchema.properties!.type,
                enum: allowedTypes,
              },
            },
          },
          description: `Array of 3-4 challenges using ONLY these types: ${allowedTypes.join(', ')}`,
        },
      },
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate challenges for a Parameter Explorer.

${formulaContext}

${challengeTypeSection}

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
// Hardcoded fallback (Ohm's Law V=IR)
// ---------------------------------------------------------------------------

function buildFallback(allowedTypes?: string[]): ParameterExplorerData {
  const allChallenges: ParameterExplorerChallenge[] = [
    { id: 'fb1', type: 'explore', instruction: 'Move both sliders and observe how voltage changes. Try holding one constant while varying the other.' },
    { id: 'fb2', type: 'predict-direction', instruction: 'If current increases, what happens to voltage?', prediction: { varyParameter: 'I', correctDirection: 'increase', explanation: 'Voltage is directly proportional to current (V=IR), so increasing I increases V.' } },
    { id: 'fb3', type: 'predict-value', instruction: 'If current is 5 A and resistance is 10 Ω, what is the voltage?', prediction: { varyParameter: 'I', newValue: 5, correctValue: 50, tolerance: 1, explanation: 'V = I × R = 5 × 10 = 50 V' } },
    { id: 'fb4', type: 'identify-relationship', instruction: 'Which parameter has a stronger effect on voltage when both are at moderate values?', correctParameter: 'R' },
  ];

  const challenges = allowedTypes
    ? allChallenges.filter(ch => allowedTypes.includes(ch.type))
    : allChallenges;

  return {
    title: "Ohm's Law Explorer",
    description: "Explore how voltage depends on current and resistance",
    formula: "V = IR",
    jsExpression: "I * R",
    outputName: "Voltage",
    outputUnit: "V",
    context: "Electrical circuits: Ohm's law describes the relationship between voltage, current, and resistance.",
    parameters: [
      { symbol: 'I', name: 'Current', unit: 'A', min: 0, max: 10, step: 0.5, default: 2, description: 'Electric current flowing through the circuit' },
      { symbol: 'R', name: 'Resistance', unit: 'Ω', min: 1, max: 100, step: 1, default: 10, description: 'Resistance of the circuit element' },
    ],
    observations: [
      { trigger: 'Vary I', prompt: 'Notice how voltage changes linearly with current when resistance is held constant.' },
      { trigger: 'Vary R', prompt: 'A higher resistance means more voltage is needed to push the same current through.' },
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

/** Recompute correctValue for predict-value challenges to verify Gemini's answer. */
function verifyPredictValueChallenge(
  challenge: ParameterExplorerChallenge,
  jsExpression: string,
  params: ParameterExplorerData['parameters'],
): ParameterExplorerChallenge {
  if (challenge.type !== 'predict-value' || !challenge.prediction) return challenge;

  const paramValues: Record<string, number> = {};
  for (const p of params) {
    paramValues[p.symbol] = p.default;
  }
  if (challenge.prediction.varyParameter && challenge.prediction.newValue !== undefined) {
    paramValues[challenge.prediction.varyParameter] = challenge.prediction.newValue;
  }

  try {
    const paramNames = Object.keys(paramValues);
    const paramVals = Object.values(paramValues);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...paramNames, `"use strict"; return (${jsExpression});`);
    const computed = fn(...paramVals);
    if (typeof computed === 'number' && isFinite(computed)) {
      const rounded = Math.round(computed * 1e6) / 1e6;
      if (Math.abs(rounded - (challenge.prediction.correctValue ?? 0)) > (challenge.prediction.tolerance ?? 0.1)) {
        console.warn(
          `[ParameterExplorer] Correcting predict-value: Gemini said ${challenge.prediction.correctValue}, ` +
          `computed ${rounded} (jsExpression="${jsExpression}", params=${JSON.stringify(paramValues)})`,
        );
      }
      challenge.prediction.correctValue = rounded;
    }
  } catch {
    // If evaluation fails, keep Gemini's value (already validated jsExpression earlier)
  }
  return challenge;
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

export const generateParameterExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<ParameterExplorerData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'parameter-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ParameterExplorer', config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint?.allowedTypes;
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  console.log(`[ParameterExplorer] Stage 1: Formula service for "${topic}"`);

  // ── Stage 1 (Sequential): Formula definition ──
  const formulaResult = await runFormulaService(topic, gradeLevel);

  if (!formulaResult) {
    console.warn('[ParameterExplorer] Formula service returned empty, using fallback');
    return buildFallback(allowedTypes);
  }

  const parameters = reconstructParameters(formulaResult);
  if (parameters.length < 2) {
    console.warn(`[ParameterExplorer] Only ${parameters.length} parameters reconstructed, using fallback`);
    return buildFallback(allowedTypes);
  }

  if (!validateJsExpression(formulaResult.jsExpression, parameters)) {
    console.warn(`[ParameterExplorer] jsExpression "${formulaResult.jsExpression}" is not evaluable, using fallback`);
    return buildFallback(allowedTypes);
  }

  console.log(`[ParameterExplorer] Stage 2: Challenges + Observations in parallel`);

  // ── Stage 2 (Parallel): Challenges + Observations ──
  const formulaContext = buildFormulaContext(
    topic, gradeLevel,
    formulaResult.formula, formulaResult.jsExpression,
    formulaResult.outputName, formulaResult.outputUnit,
    formulaResult.context, parameters,
  );

  const [rawChallenges, observations] = await Promise.all([
    runChallengesService(formulaContext, challengeTypeSection, allowedTypes),
    runObservationsService(formulaContext),
  ]);

  // ── Reconstruct and validate challenges ──
  let validChallenges: ParameterExplorerChallenge[] = [];

  for (const flatCh of rawChallenges) {
    const reconstructed = reconstructChallenge(flatCh);
    if (reconstructed) {
      const verified = verifyPredictValueChallenge(reconstructed, formulaResult.jsExpression, parameters);
      validChallenges.push(verified);
    }
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
    observations: observations.length > 0 ? observations : undefined,
    challenges: validChallenges,
  };
};
