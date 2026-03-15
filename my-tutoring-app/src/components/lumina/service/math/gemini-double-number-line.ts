import { Type, Schema } from "@google/genai";
import { DoubleNumberLineData } from "../../primitives/visual-primitives/math/DoubleNumberLine";
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
  equivalent_ratios: {
    promptDoc:
      `"equivalent_ratios": The unit rate is GIVEN (shown as a given point). `
      + `Students multiply to find equivalent ratio pairs on the double number line. `
      + `Easiest mode — just scaling. `
      + `Include the unit rate point in givenPoints, not targetPoints. `
      + `targetInputs should be 3-4 multiples of the unit rate input. `
      + `contextQuestion should state the unit rate explicitly. `
      + `IMPORTANT: The stated unit rate direction in contextQuestion MUST match topLabel→bottomLabel. `
      + `If context says "1 X makes 3 Y", topLabel must be X and bottomLabel must be Y (unitRateOutput=3), never inverted.`,
    schemaDescription: "'equivalent_ratios' (scale given unit rate)",
  },
  find_missing: {
    promptDoc:
      `"find_missing": Some points are given, but one or two values are missing. `
      + `Students must use the proportional relationship to find the missing values. `
      + `Intermediate difficulty — requires identifying the relationship. `
      + `Give 1-2 complete points as givenPoints, then ask for 2-3 target points. `
      + `contextQuestion should describe the relationship without explicitly stating the unit rate.`,
    schemaDescription: "'find_missing' (find missing values in ratio table)",
  },
  unit_rate: {
    promptDoc:
      `"unit_rate": Students must DISCOVER the unit rate from a non-unit ratio pair. `
      + `Hardest mode — requires division to find per-unit value. `
      + `Give a non-unit pair (e.g., 3 cups → 9 cookies, NOT 1 cup → 3 cookies). `
      + `The givenPoints should include only the origin and a non-unit pair. `
      + `Phase 1 becomes: find when input=1, what is the output? `
      + `contextQuestion should present the non-unit relationship.`,
    schemaDescription: "'unit_rate' (discover unit rate from non-unit pair)",
  },
};

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const doubleNumberLineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short title describing the relationship (e.g., 'Flour to Cookies')"
    },
    description: {
      type: Type.STRING,
      description: "One sentence explaining what students will learn"
    },
    challengeType: {
      type: Type.STRING,
      enum: ["equivalent_ratios", "find_missing", "unit_rate"],
      description: "Challenge type: 'equivalent_ratios' (scale given unit rate), 'find_missing' (find missing values), 'unit_rate' (discover unit rate from non-unit pair)"
    },
    contextQuestion: {
      type: Type.STRING,
      description: "Real-world problem setup (e.g., '1 cup of flour makes 3 cookies. How many cookies can you make with different amounts of flour?')"
    },
    topLabel: {
      type: Type.STRING,
      description: "Name of input quantity (e.g., 'Cups of Flour', 'Hours')"
    },
    bottomLabel: {
      type: Type.STRING,
      description: "Name of output quantity (e.g., 'Cookies Made', 'Miles')"
    },
    unitRateInput: {
      type: Type.NUMBER,
      description: "The INPUT value for the unit rate question. MUST be 1. Students will find the corresponding output."
    },
    unitRateOutput: {
      type: Type.NUMBER,
      description: "The OUTPUT value when input = unitRateInput. This is the answer students must discover. (e.g., 3 cookies when input is 1 cup)"
    },
    maxInput: {
      type: Type.NUMBER,
      description: "Maximum value for input scale (top line). Should be 5-10 for simple problems."
    },
    targetInputs: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "3-5 input values students must find outputs for (e.g., [2, 3, 5, 7]). Should NOT include unitRateInput since that's phase 1."
    }
  },
  required: ["title", "description", "challengeType", "contextQuestion", "topLabel", "bottomLabel", "unitRateInput", "unitRateOutput", "maxInput", "targetInputs"]
};

type Point = { topValue: number; bottomValue: number; label?: string };

/**
 * Build givenPoints and targetPoints based on challenge type.
 *
 * - equivalent_ratios: origin + unit rate are GIVEN; students scale to find targets
 * - find_missing: origin + one non-unit pair GIVEN; students find the rest (including unit rate)
 * - unit_rate / default: only origin given; students discover unit rate then find targets
 */
function buildPointsByMode(
  challengeType: string,
  unitRateInput: number,
  unitRateOutput: number,
  unitRate: number,
  targetInputs: number[],
): { givenPoints: Point[]; targetPoints: Point[] } {
  const origin: Point = { topValue: 0, bottomValue: 0, label: 'Start' };
  const unitRatePoint: Point = { topValue: unitRateInput, bottomValue: unitRateOutput, label: 'Unit Rate' };
  const additionalPoints: Point[] = targetInputs.map((input: number, i: number) => ({
    topValue: input,
    bottomValue: input * unitRate,
    label: `Point ${i + 2}`,
  }));

  if (challengeType === 'equivalent_ratios') {
    // Unit rate is given — students just scale
    return {
      givenPoints: [origin, unitRatePoint],
      targetPoints: additionalPoints,
    };
  }

  if (challengeType === 'find_missing') {
    // Give one non-unit ratio pair as a clue; students find unit rate + remaining points
    // Pick the first additional point as the given clue
    const [cluePoint, ...remainingPoints] = additionalPoints;
    if (cluePoint) {
      return {
        givenPoints: [origin, { ...cluePoint, label: 'Given' }],
        targetPoints: [unitRatePoint, ...remainingPoints],
      };
    }
    // Fallback if no additional points (shouldn't happen)
    return {
      givenPoints: [origin],
      targetPoints: [unitRatePoint, ...additionalPoints],
    };
  }

  // unit_rate or default: only origin given, students discover everything
  return {
    givenPoints: [origin],
    targetPoints: [unitRatePoint, ...additionalPoints],
  };
}

/**
 * Generate double number line data for visualization
 */
export const generateDoubleNumberLine = async (
  topic: string,
  gradeLevel: string,
  config?: {
    topLabel?: string;
    bottomLabel?: string;
    topScale?: { min: number; max: number; interval: number };
    bottomScale?: { min: number; max: number; interval: number };
    targetPoints?: Array<{ topValue: number; bottomValue: number; label?: string }>;
    givenPoints?: Array<{ topValue: number; bottomValue: number; label?: string }>;
    showUnitRate?: boolean;
    showVerticalGuides?: boolean;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<DoubleNumberLineData> => {
  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'double-number-line',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('DoubleNumberLine', config?.targetEvalMode, evalConstraint);

  // Constrain schema when eval mode is active (challengeType at root level)
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(doubleNumberLineSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : doubleNumberLineSchema;

  // Build challenge type prompt section
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `
Create a double number line problem for "${topic}" (${gradeLevel}).

${challengeTypeSection}

${!evalConstraint ? `
The problem has 3 learning phases:
1. Students find the UNIT RATE (when input = 1, what's the output?)
2. Students practice with 2-3 points
3. Students find all remaining points
` : ''}

WHAT YOU NEED TO CREATE:
- title: Short, clear title (e.g., "Baking Cookies: Relating Flour to Cookies Made")
- description: One sentence about what they'll learn
- challengeType: Must match the constrained type${evalConstraint ? ` (${evalConstraint.allowedTypes.join(' or ')})` : ''}
- contextQuestion: Real-world setup
- topLabel: Input quantity name (e.g., "Cups of Flour")
- bottomLabel: Output quantity name (e.g., "Cookies Made")
- unitRateInput: ALWAYS set to 1
- unitRateOutput: The answer when input = 1 (e.g., 3 cookies per 1 cup)
- maxInput: Maximum input value (keep 5-10)
- targetInputs: Array of 3-4 OTHER input values students solve (do NOT include 1)

RULES:
- unitRateInput: MUST always be 1
- unitRateOutput: Should be a nice whole number or simple decimal (e.g., 3, 0.5, 1.5, 60)
- targetInputs: Should NOT include 1 (that's phase 1). Use 3-4 other values spread out.
- maxInput should be 5-10 to keep it manageable
- Use concrete, relatable contexts for the grade level
- contextQuestion should clearly present the proportional relationship
- CRITICAL — RATIO DIRECTION: topLabel is the INPUT (independent variable) and bottomLabel is the OUTPUT (dependent variable). The unit rate means "1 unit of topLabel = unitRateOutput units of bottomLabel". The contextQuestion MUST describe the same direction. For example, if contextQuestion says "1 can of paint covers 4 feet", then topLabel MUST be "Cans of Paint" and bottomLabel MUST be "Feet", with unitRateOutput = 4. NEVER invert the relationship — if the context says "A covers B units of C", then A's quantity is the top (input) and C is the bottom (output).

Return the problem data.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const geminiData = result.text ? JSON.parse(result.text) : null;

  if (!geminiData) {
    throw new Error('No valid double number line data returned from Gemini API');
  }

  // Extract values from Gemini's response
  const unitRateInput = geminiData.unitRateInput || 1;
  let unitRateOutput = geminiData.unitRateOutput || 1;
  const maxInput = geminiData.maxInput || 10;
  const targetInputs = geminiData.targetInputs || [2, 3, 5];

  // Validate ratio direction: if contextQuestion states "1 X = N Y" but unitRateOutput
  // is 1/N (inverted), fix it. We detect this by checking if the context mentions a
  // specific number that equals 1/unitRateOutput, suggesting the ratio was flipped.
  const contextQ = (geminiData.contextQuestion || '').toLowerCase();

  // Look for patterns like "1 <word> covers/makes/equals N <word>"
  // and verify unitRateOutput matches N, not 1/N
  const ratioMatch = contextQ.match(/\b1\b[^.]*?\b(\d+(?:\.\d+)?)\b/);
  if (ratioMatch) {
    const statedValue = parseFloat(ratioMatch[1]);
    // If context says the rate is N but unitRateOutput is 1/N, the ratio was inverted
    if (statedValue > 1 && Math.abs(unitRateOutput - 1 / statedValue) < 0.01) {
      console.warn(
        `[DoubleNumberLine] Ratio direction mismatch detected: context states rate ~${statedValue} but unitRateOutput=${unitRateOutput}. Correcting to ${statedValue}.`
      );
      unitRateOutput = statedValue;
    }
  }

  // Calculate the unit rate for scaling
  const unitRate = unitRateOutput / unitRateInput;

  // Calculate scales automatically
  const maxOutput = maxInput * unitRate;

  // Smart interval calculation
  const topInterval = maxInput <= 10 ? 1 : Math.ceil(maxInput / 10);
  const bottomInterval = maxOutput <= 20 ? (unitRateOutput <= 5 ? unitRateOutput : 1) : Math.ceil(maxOutput / 10);

  const data: DoubleNumberLineData = {
    title: geminiData.title,
    description: geminiData.description,
    contextQuestion: geminiData.contextQuestion,
    topLabel: geminiData.topLabel,
    bottomLabel: geminiData.bottomLabel,

    // Auto-generated scales
    topScale: { min: 0, max: maxInput, interval: topInterval },
    bottomScale: { min: 0, max: maxOutput, interval: bottomInterval },

    // Given / target points vary by challenge type
    ...buildPointsByMode(
      geminiData.challengeType,
      unitRateInput,
      unitRateOutput,
      unitRate,
      targetInputs,
    ),

    showVerticalGuides: true,
    showUnitRate: true
  };

  // Apply config overrides if provided
  if (config?.topLabel) data.topLabel = config.topLabel;
  if (config?.bottomLabel) data.bottomLabel = config.bottomLabel;
  if (config?.topScale) data.topScale = config.topScale;
  if (config?.bottomScale) data.bottomScale = config.bottomScale;
  if (config?.targetPoints) data.targetPoints = config.targetPoints;
  if (config?.givenPoints) data.givenPoints = config.givenPoints;
  if (config?.showVerticalGuides !== undefined) data.showVerticalGuides = config.showVerticalGuides;

  return data;
};
