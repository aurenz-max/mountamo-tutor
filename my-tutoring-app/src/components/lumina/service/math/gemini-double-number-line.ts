import { Type, Schema, ThinkingLevel } from "@google/genai";
import { DoubleNumberLineData } from "../../primitives/visual-primitives/math/DoubleNumberLine";
import { ai } from "../geminiClient";

/**
 * Schema definition for Double Number Line Data
 *
 * Simplified schema for 3-phase learning:
 * 1. Find the unit rate (relationship between quantities)
 * 2. Practice scaling with 2-3 points
 * 3. Apply to find all remaining points
 */
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
  required: ["title", "description", "contextQuestion", "topLabel", "bottomLabel", "unitRateInput", "unitRateOutput", "maxInput", "targetInputs"]
};

/**
 * Generate double number line data for visualization
 *
 * This function creates double number line data including:
 * - Two parallel number lines with independent scales
 * - Linked points showing proportional relationships
 * - Vertical guides to emphasize correspondence
 * - Educational context for ratio and proportion concepts
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns DoubleNumberLineData with complete configuration
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
  }
): Promise<DoubleNumberLineData> => {
  const prompt = `
Create a double number line problem for "${topic}" (${gradeLevel}).

The problem has 3 learning phases:
1. Students find the UNIT RATE (when input = 1, what's the output?)
2. Students practice with 2-3 points
3. Students find all remaining points

WHAT YOU NEED TO CREATE:
- title: Short, clear title (e.g., "Baking Cookies: Relating Flour to Cookies Made")
- description: One sentence about what they'll learn
- contextQuestion: Real-world setup that states the unit rate relationship clearly
- topLabel: Input quantity name (e.g., "Cups of Flour")
- bottomLabel: Output quantity name (e.g., "Cookies Made")
- unitRateInput: ALWAYS set to 1 (students will find: when input = 1, what's the output?)
- unitRateOutput: The answer to the unit rate question (e.g., 3 cookies per 1 cup)
- maxInput: Maximum input value for the scale (keep it 5-10 for simplicity)
- targetInputs: Array of 3-4 OTHER input values students solve in phases 2-3 (do NOT include 1)

EXAMPLE 1 - Baking (Grade 6):
{
  "title": "Baking Cookies: Relating Flour to Cookies Made",
  "description": "Explore how quantities change together in a recipe.",
  "contextQuestion": "A baker knows that 1 cup of flour makes exactly 3 cookies. How many cookies can the baker make if they use 7 cups of flour?",
  "topLabel": "Cups of Flour",
  "bottomLabel": "Cookies Made",
  "unitRateInput": 1,
  "unitRateOutput": 3,
  "maxInput": 10,
  "targetInputs": [2, 5, 7]
}

EXAMPLE 2 - Speed (Grade 7):
{
  "title": "Road Trip: Hours Driving to Miles Traveled",
  "description": "Learn how distance and time relate at a constant speed.",
  "contextQuestion": "A car travels at 60 miles per hour. How far will it go in different amounts of time?",
  "topLabel": "Hours",
  "bottomLabel": "Miles",
  "unitRateInput": 1,
  "unitRateOutput": 60,
  "maxInput": 5,
  "targetInputs": [2, 3, 5]
}

EXAMPLE 3 - Shopping (Grade 6):
{
  "title": "Buying Apples: Items to Cost",
  "description": "See how total cost changes with quantity.",
  "contextQuestion": "Apples cost $2 each. How much do different amounts cost?",
  "topLabel": "Apples",
  "bottomLabel": "Cost ($)",
  "unitRateInput": 1,
  "unitRateOutput": 2,
  "maxInput": 8,
  "targetInputs": [3, 5, 8]
}

RULES:
- unitRateInput: MUST always be 1
- unitRateOutput: Should be a nice whole number or simple decimal (e.g., 3, 0.5, 1.5, 60)
- targetInputs: Should NOT include 1 (that's phase 1). Use 3-4 other values spread out.
- maxInput should be 5-10 to keep it manageable
- Use concrete, relatable contexts for the grade level
- contextQuestion should clearly state the unit rate in the problem text

Return the problem data.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: doubleNumberLineSchema
    },
  });

  const geminiData = result.text ? JSON.parse(result.text) : null;

  if (!geminiData) {
    throw new Error('No valid double number line data returned from Gemini API');
  }

  // Extract values from Gemini's response
  const unitRateInput = geminiData.unitRateInput || 1;
  const unitRateOutput = geminiData.unitRateOutput || 1;
  const maxInput = geminiData.maxInput || 10;
  const targetInputs = geminiData.targetInputs || [2, 3, 5];

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

    // Given point: just the origin
    givenPoints: [
      { topValue: 0, bottomValue: 0, label: 'Start' }
    ],

    // Target points: Phase 1 (unit rate) + Phases 2-3 (practice/apply)
    targetPoints: [
      // Phase 1: Unit rate discovery
      { topValue: unitRateInput, bottomValue: unitRateOutput, label: 'Unit Rate' },
      // Phases 2-3: Additional points
      ...targetInputs.map((input: number, i: number) => ({
        topValue: input,
        bottomValue: input * unitRate,
        label: `Point ${i + 2}`
      }))
    ],

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
