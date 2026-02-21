import { Type, Schema } from "@google/genai";
import { RatioTableData, RatioTableChallenge } from "../../primitives/visual-primitives/math/RatioTable";
import { ai } from "../geminiClient";

/**
 * Schema definition for Ratio Table Data (multi-challenge format)
 *
 * Each challenge defines its own proportional relationship context,
 * base ratio, row labels, target multiplier, and task type.
 * This allows a single activity to present 3-5 varied ratio challenges.
 */
const ratioTableChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "Unique challenge ID (e.g., 'rt1', 'rt2', 'rt3')"
    },
    type: {
      type: Type.STRING,
      description: "Challenge type: 'missing-value' (find hidden scaled value), 'find-multiplier' (determine scaling factor), 'build-ratio' (construct equivalent ratio), 'unit-rate' (calculate and apply unit rate)",
      enum: ["missing-value", "find-multiplier", "build-ratio", "unit-rate"]
    },
    instruction: {
      type: Type.STRING,
      description: "Student-facing instruction/question for this challenge (e.g., 'If 3 cups of flour makes 36 cookies, how many cookies can you make with 7.5 cups?')"
    },
    baseRatio: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "The reference ratio as [quantity1, quantity2] (e.g., [3, 36]). This is the locked reference column."
    },
    rowLabels: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Two labels for the quantities being compared (e.g., ['Cups of Flour', 'Cookies Made']). Must have exactly 2 items."
    },
    targetMultiplier: {
      type: Type.NUMBER,
      description: "The multiplier used to create the scaled ratio. E.g., if baseRatio is [3, 36] and targetMultiplier is 2.5, scaled values are [7.5, 90]."
    },
    hiddenValue: {
      type: Type.STRING,
      description: "For missing-value challenges: which scaled value to hide — 'scaled-first' or 'scaled-second'",
      enum: ["scaled-first", "scaled-second"]
    },
    hint: {
      type: Type.STRING,
      description: "Hint text shown after incorrect attempts to guide the student"
    },
    tolerance: {
      type: Type.NUMBER,
      description: "Percentage tolerance for answer checking (default 1%). Use higher values for challenges where rounding is expected."
    }
  },
  required: ["id", "type", "instruction", "baseRatio", "rowLabels", "targetMultiplier", "hint"]
};

const ratioTableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ratio table activity (e.g., 'Ratio Reasoning: Recipes & Speed')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will practice across these challenges"
    },
    challenges: {
      type: Type.ARRAY,
      items: ratioTableChallengeSchema,
      description: "Array of 3-5 ratio challenges with mixed types and progressive difficulty"
    },
    showUnitRate: {
      type: Type.BOOLEAN,
      description: "Show the unit rate below each column. Default: true"
    },
    showBarChart: {
      type: Type.BOOLEAN,
      description: "Display visual bar chart comparing quantities. Default: true"
    },
    maxMultiplier: {
      type: Type.NUMBER,
      description: "Maximum value for the multiplier slider (default: 10)"
    }
  },
  required: ["title", "description", "challenges"]
};

/**
 * Generate ratio table data with multiple progressive challenges
 *
 * Produces 3-5 challenges of mixed types:
 * - missing-value: Students find a hidden value using proportional reasoning
 * - find-multiplier: Determine the scaling factor between ratios
 * - build-ratio: Construct a specific equivalent ratio
 * - unit-rate: Calculate and apply unit rates
 *
 * Each challenge has its own real-world context, base ratio, and row labels,
 * allowing variety within a single activity.
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RatioTableData with challenges array
 */
export const generateRatioTable = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<RatioTableData>
): Promise<RatioTableData> => {
  const prompt = `
Create an educational ratio table activity for teaching "${topic}" to ${gradeLevel} students.

This activity should contain 3-5 CHALLENGES of MIXED TYPES that progress in difficulty.
Each challenge is a separate ratio problem with its own context, base ratio, and row labels.

CHALLENGE TYPES (use a mix of these):

1. "missing-value" — Student finds a hidden value in a scaled ratio.
   - Set hiddenValue to 'scaled-first' or 'scaled-second'
   - Example: baseRatio [3, 36], targetMultiplier 2.5, hiddenValue 'scaled-second'
     → "If 3 cups flour makes 36 cookies, how many cookies from 7.5 cups?" (Answer: 90)

2. "find-multiplier" — Student determines the scaling factor.
   - Give both the base and scaled values; student finds the multiplier
   - Example: baseRatio [4, 12], targetMultiplier 3
     → "A recipe uses 4 eggs for 12 muffins. If you used 12 eggs, what multiplier did you use?" (Answer: 3)

3. "build-ratio" — Student constructs an equivalent ratio.
   - Student adjusts the multiplier to create a target scaled value
   - Example: baseRatio [5, 20], targetMultiplier 4
     → "Build a ratio equivalent to 5:20 that gives you 80 in the second column." (Answer: multiplier 4)

4. "unit-rate" — Student calculates and applies the unit rate.
   - Focus on finding the rate per 1 unit
   - Example: baseRatio [6, 48], targetMultiplier 1 (unit rate focus)
     → "If 6 notebooks cost $48, what is the cost per notebook?" (Answer: $8)

DIFFICULTY PROGRESSION BY GRADE:
- Grades 6-7: Whole number multipliers (2, 3, 4, 5), integer results, simple contexts
- Grades 7-8: Decimal multipliers (1.5, 2.5, 3.5), may have decimal answers
- Grades 8+: Complex multipliers (2.25, 3.75, 0.75), multi-step reasoning

REAL-WORLD CONTEXTS (vary across challenges):
- Recipes: ingredients scaling (flour to cookies, eggs to muffins)
- Shopping: unit pricing (items to cost, quantity to total)
- Speed/Distance: travel problems (hours to miles, time to distance)
- Mixing: paint colors, solutions (parts A to parts B)
- Science: measurements, conversions, density
- Maps: scale factors (inches to miles)

${config ? `
CONFIGURATION HINTS:
${config.maxMultiplier ? `- Max multiplier: ${config.maxMultiplier}` : ''}
${config.showUnitRate !== undefined ? `- Show unit rate: ${config.showUnitRate}` : ''}
${config.showBarChart !== undefined ? `- Show bar chart: ${config.showBarChart}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that PROGRESS in difficulty
2. Use a MIX of challenge types — do NOT make them all the same type
3. Each challenge MUST have its own:
   - id: unique string (e.g., 'rt1', 'rt2', ...)
   - type: one of the four challenge types
   - instruction: a clear, specific question or task
   - baseRatio: [number, number] with positive values
   - rowLabels: [string, string] matching the context
   - targetMultiplier: positive number appropriate for grade level
   - hint: helpful guidance without giving the answer
4. For "missing-value" challenges, set hiddenValue to 'scaled-first' or 'scaled-second'
5. Start with easier challenges (simpler numbers, missing-value type) and progress to harder ones
6. Write engaging, age-appropriate instructions
7. Ensure all numbers produce reasonable, contextually sensible answers
8. Set tolerance for challenges where rounding may be needed (e.g., 5 for 5% tolerance)
9. Write a descriptive title and educational description that spans all challenges

EXAMPLE OUTPUT:
{
  "title": "Ratio Reasoning: Recipes & Shopping",
  "description": "Practice proportional reasoning across different real-world scenarios",
  "challenges": [
    {
      "id": "rt1",
      "type": "missing-value",
      "instruction": "If 3 cups of flour makes 36 cookies, how many cookies can you make with 6 cups?",
      "baseRatio": [3, 36],
      "rowLabels": ["Cups of Flour", "Cookies Made"],
      "targetMultiplier": 2,
      "hiddenValue": "scaled-second",
      "hint": "Think about how many times 3 goes into 6, then multiply the cookies by the same amount."
    },
    {
      "id": "rt2",
      "type": "find-multiplier",
      "instruction": "A car travels 60 miles in 1 hour. If it traveled 210 miles, what multiplier was used?",
      "baseRatio": [1, 60],
      "rowLabels": ["Hours", "Miles"],
      "targetMultiplier": 3.5,
      "hint": "Divide the total miles (210) by the miles per hour (60) to find how many hours."
    },
    {
      "id": "rt3",
      "type": "unit-rate",
      "instruction": "If 5 notebooks cost $15, what is the cost per notebook?",
      "baseRatio": [5, 15],
      "rowLabels": ["Notebooks", "Cost ($)"],
      "targetMultiplier": 1,
      "hint": "To find the unit rate, divide the total cost by the number of items."
    },
    {
      "id": "rt4",
      "type": "build-ratio",
      "instruction": "Build an equivalent ratio to 4:20 where the second value is 100.",
      "baseRatio": [4, 20],
      "rowLabels": ["Workers", "Widgets Made"],
      "targetMultiplier": 5,
      "hint": "What number do you multiply 20 by to get 100? Use that same multiplier for both values."
    }
  ],
  "showUnitRate": true,
  "showBarChart": true,
  "maxMultiplier": 10
}

Return the complete ratio table configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: ratioTableSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid ratio table data returned from Gemini API');
  }

  // ── Validate challenges array ──────────────────────────────────────────

  if (!Array.isArray(data.challenges) || data.challenges.length === 0) {
    throw new Error('Gemini returned no challenges for ratio table');
  }

  const validTypes: RatioTableChallenge['type'][] = [
    'missing-value', 'find-multiplier', 'build-ratio', 'unit-rate'
  ];

  // Filter to only valid challenge types
  data.challenges = data.challenges.filter(
    (c: { type: string }) => validTypes.includes(c.type as RatioTableChallenge['type'])
  );

  if (data.challenges.length === 0) {
    throw new Error('No valid challenge types in Gemini response');
  }

  // ── Per-challenge validation ───────────────────────────────────────────

  const seenIds = new Set<string>();

  for (let i = 0; i < data.challenges.length; i++) {
    const c = data.challenges[i];

    // Ensure unique id
    if (!c.id || seenIds.has(c.id)) {
      c.id = `rt${i + 1}`;
    }
    seenIds.add(c.id);

    // Validate baseRatio: must be [positive, positive]
    if (!Array.isArray(c.baseRatio) || c.baseRatio.length !== 2 ||
        c.baseRatio[0] <= 0 || c.baseRatio[1] <= 0) {
      console.warn(`Challenge ${c.id}: invalid baseRatio [${c.baseRatio}]. Using [1, 2].`);
      c.baseRatio = [1, 2];
    }

    // Validate rowLabels: must be [string, string]
    if (!Array.isArray(c.rowLabels) || c.rowLabels.length !== 2) {
      console.warn(`Challenge ${c.id}: invalid rowLabels. Using defaults.`);
      c.rowLabels = ["Quantity A", "Quantity B"];
    }

    // Validate targetMultiplier: must be a positive number
    if (!c.targetMultiplier || c.targetMultiplier <= 0) {
      console.warn(`Challenge ${c.id}: invalid targetMultiplier. Using 2.`);
      c.targetMultiplier = 2;
    }

    // For missing-value challenges, ensure hiddenValue is set
    if (c.type === 'missing-value' && !c.hiddenValue) {
      c.hiddenValue = 'scaled-second';
    }

    // Ensure instruction exists
    if (!c.instruction) {
      c.instruction = `Solve the ratio problem with base ratio ${c.baseRatio[0]}:${c.baseRatio[1]}`;
    }

    // Ensure hint exists
    if (!c.hint) {
      c.hint = 'Think about the relationship between the two quantities.';
    }
  }

  // ── Top-level defaults ─────────────────────────────────────────────────

  if (!data.maxMultiplier || data.maxMultiplier < 2) data.maxMultiplier = 10;
  if (data.showUnitRate === undefined) data.showUnitRate = true;
  if (data.showBarChart === undefined) data.showBarChart = true;

  // ── Apply explicit config overrides from manifest ──────────────────────

  if (config) {
    if (config.showUnitRate !== undefined) data.showUnitRate = config.showUnitRate;
    if (config.showBarChart !== undefined) data.showBarChart = config.showBarChart;
    if (config.maxMultiplier !== undefined) data.maxMultiplier = config.maxMultiplier;
    if (config.challenges) data.challenges = config.challenges;
  }

  return data as RatioTableData;
};
