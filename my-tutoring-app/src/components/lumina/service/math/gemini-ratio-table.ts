import { Type, Schema } from "@google/genai";
import { RatioTableData } from "../../primitives/visual-primitives/math/RatioTable";
import { ai } from "../geminiClient";

/**
 * Schema definition for Ratio Table Data
 *
 * This schema defines the structure for ratio table visualization,
 * showing proportional relationships through interactive problem-solving tasks.
 */
const ratioTableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the ratio table (e.g., 'Baking Cookies: Flour to Cookie Ratio')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this task"
    },
    rowLabels: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Two labels for the quantities being compared (e.g., ['Cups of Flour', 'Cookies Made']). Must have exactly 2 items."
    },
    baseRatio: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "The reference ratio as [quantity1, quantity2] (e.g., [3, 36] means 3 cups of flour makes 36 cookies). This is the locked reference column."
    },
    taskType: {
      type: Type.STRING,
      description: "Type of learning task: 'missing-value' (find hidden value using proportional reasoning), 'find-multiplier', 'build-ratio', 'unit-rate-challenge', or 'explore' (free exploration)",
      enum: ["missing-value", "find-multiplier", "build-ratio", "unit-rate-challenge", "explore"]
    },
    targetMultiplier: {
      type: Type.NUMBER,
      description: "For tasks: the multiplier used to calculate the hidden/target value. E.g., if baseRatio is [3, 36] and targetMultiplier is 2.5, the scaled ratio is [7.5, 90]."
    },
    questionPrompt: {
      type: Type.STRING,
      description: "The specific question students need to answer (e.g., 'If 3 cups of flour makes 36 cookies, how many cookies can you make with 7.5 cups of flour?')"
    },
    hiddenValue: {
      type: Type.STRING,
      description: "For missing-value task: which value to hide - 'scaled-first' or 'scaled-second'",
      enum: ["scaled-first", "scaled-second"]
    },
    maxMultiplier: {
      type: Type.NUMBER,
      description: "Maximum value for the multiplier slider (default: 10)."
    },
    showUnitRate: {
      type: Type.BOOLEAN,
      description: "Show the unit rate below each column. Default: true"
    },
    showBarChart: {
      type: Type.BOOLEAN,
      description: "Display visual bar chart. Default: true"
    }
  },
  required: ["title", "description", "rowLabels", "baseRatio", "taskType"]
};

/**
 * Generate ratio table data for problem-solving tasks
 *
 * This function creates ratio table data with interactive tasks:
 * - missing-value: Students find a hidden value using proportional reasoning
 * - find-multiplier: Determine the scaling factor between ratios
 * - build-ratio: Construct a specific equivalent ratio
 * - unit-rate-challenge: Calculate and apply unit rates
 * - explore: Free exploration of proportional relationships
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RatioTableData with complete configuration
 */
export const generateRatioTable = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<RatioTableData>
): Promise<RatioTableData> => {
  const taskType = config?.taskType || 'missing-value';

  const prompt = `
Create an educational ratio table problem for teaching "${topic}" to ${gradeLevel} students.

TASK TYPE: ${taskType}

${ taskType === 'missing-value' ? `
MISSING-VALUE TASK DESIGN:
- Create a real-world proportional relationship problem
- Present a reference ratio (e.g., [3, 36] for "3 cups flour makes 36 cookies")
- Set a targetMultiplier (e.g., 2.5) to create the scaled scenario
- Hide one value in the scaled column (use hiddenValue: 'scaled-first' or 'scaled-second')
- Write a clear questionPrompt asking students to find the missing value
- Example: "If 3 cups of flour makes 36 cookies, how many cookies can you make with 7.5 cups of flour?"
  - baseRatio: [3, 36]
  - targetMultiplier: 2.5
  - hiddenValue: 'scaled-second'
  - The answer would be 90 cookies

CHALLENGE DIFFICULTY BY GRADE:
- Grades 6-7: Simple whole number multipliers (2, 3, 4), integer results
- Grades 7-8: Decimal multipliers (1.5, 2.5), may have decimal answers
- Grades 8+: Complex multipliers (3.75, 0.75), requires precision

CONTEXT SELECTION:
Choose engaging, age-appropriate contexts like:
- Recipes: ingredients scaling (flour to cookies, cups to servings)
- Shopping: unit pricing (items to cost, quantity to total)
- Speed/Distance: travel problems (hours to miles, time to distance)
- Mixing: paint colors, solutions (parts A to parts B)
- Unit conversion: measurement problems

` : `
EXPLORE MODE DESIGN:
- Create an interesting proportional relationship to explore
- Students use a slider to adjust the multiplier
- Visual bar chart shows how quantities scale together
- Focus on discovering patterns in ratios
`}

CONTEXT:
- baseRatio: The reference ratio [quantity1, quantity2] that stays locked
- targetMultiplier: Used to calculate the hidden value for tasks
- questionPrompt: The specific question students must answer
- hiddenValue: Which scaled value to hide ('scaled-first' or 'scaled-second')

NUMBER SELECTION:
- Choose baseRatio that creates interesting problems
- For missing-value: ensure targetMultiplier creates reasonable scaled values
- Elementary (6-7): whole numbers, simple multipliers (2, 3, 4)
- Middle school (7-8): friendly decimals (1.5, 2.5, 3.5)
- Advanced (8+): complex multipliers (2.25, 3.75, 0.75)

${config ? `
CONFIGURATION HINTS:
${config.rowLabels ? `- Row labels: ${config.rowLabels.join(', ')}` : ''}
${config.baseRatio ? `- Base ratio: [${config.baseRatio.join(', ')}]` : ''}
${config.targetMultiplier ? `- Target multiplier: ${config.targetMultiplier}` : ''}
${config.questionPrompt ? `- Question: ${config.questionPrompt}` : ''}
${config.maxMultiplier ? `- Max multiplier: ${config.maxMultiplier}` : ''}
` : ''}

REQUIREMENTS:
1. Choose meaningful row labels that fit the context (e.g., "Cups of Flour", "Cookies Made")
2. Set a baseRatio that creates a clear proportional relationship
3. For missing-value tasks:
   - Set targetMultiplier to create the scaled scenario
   - Choose which value to hide (hiddenValue: 'scaled-first' or 'scaled-second')
   - Write a clear questionPrompt that asks students to find the missing value
   - Ensure the answer is reasonable and makes sense in context
4. Write a descriptive title and educational description
5. Enable showUnitRate (true) for most cases to support solving
6. Set maxMultiplier appropriate for grade level (default: 10)

EXAMPLES:

Grade 7 - Missing Value (Recipe Scaling):
{
  "title": "Baking Cookies - Flour to Cookies",
  "description": "Use proportional reasoning to find how many cookies you can make",
  "taskType": "missing-value",
  "rowLabels": ["Cups of Flour", "Cookies Made"],
  "baseRatio": [3, 36],
  "targetMultiplier": 2.5,
  "hiddenValue": "scaled-second",
  "questionPrompt": "If 3 cups of flour makes 36 cookies, how many cookies can you make with 7.5 cups of flour?",
  "showUnitRate": true,
  "maxMultiplier": 10
}
// Answer: 90 cookies

Grade 8 - Missing Value (Speed):
{
  "title": "Road Trip - Time and Distance",
  "description": "Calculate distance traveled using constant speed",
  "taskType": "missing-value",
  "rowLabels": ["Hours", "Miles Traveled"],
  "baseRatio": [2, 120],
  "targetMultiplier": 3.5,
  "hiddenValue": "scaled-second",
  "questionPrompt": "If you travel 120 miles in 2 hours, how far will you go in 7 hours at the same speed?",
  "showUnitRate": true,
  "maxMultiplier": 12
}
// Answer: 420 miles

Grade 6 - Missing Value (Shopping):
{
  "title": "Grocery Shopping - Unit Price",
  "description": "Find the total cost using unit pricing",
  "taskType": "missing-value",
  "rowLabels": ["Items", "Total Cost ($)"],
  "baseRatio": [4, 10],
  "targetMultiplier": 1.5,
  "hiddenValue": "scaled-second",
  "questionPrompt": "If 4 apples cost $10, how much will 6 apples cost?",
  "showUnitRate": true,
  "maxMultiplier": 8
}
// Answer: $15

Return the complete ratio table configuration with all required fields.
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

  // Validation: ensure rowLabels has exactly 2 items
  if (!data.rowLabels || data.rowLabels.length !== 2) {
    console.warn(`Invalid rowLabels: expected 2, got ${data.rowLabels?.length}. Using defaults.`);
    data.rowLabels = ["Quantity 1", "Quantity 2"];
  }

  // Validation: ensure baseRatio has exactly 2 values
  if (!data.baseRatio || !Array.isArray(data.baseRatio) || data.baseRatio.length !== 2) {
    console.warn(`Invalid baseRatio: expected [num, num], got ${data.baseRatio}. Using [1, 2].`);
    data.baseRatio = [1, 2];
  }

  // Validation: ensure baseRatio values are positive numbers
  if (data.baseRatio[0] <= 0 || data.baseRatio[1] <= 0) {
    console.warn(`Invalid baseRatio values: must be positive. Got [${data.baseRatio}]. Using [1, 2].`);
    data.baseRatio = [1, 2];
  }

  // Set defaults for optional fields
  if (!data.taskType) data.taskType = 'missing-value';
  if (!data.maxMultiplier || data.maxMultiplier < 2) data.maxMultiplier = 10;
  if (data.showUnitRate === undefined) data.showUnitRate = true;
  if (data.showBarChart === undefined) data.showBarChart = true;

  // For missing-value tasks, ensure required fields are present
  if (data.taskType === 'missing-value') {
    if (!data.targetMultiplier) {
      console.warn('Missing targetMultiplier for missing-value task. Using 2.');
      data.targetMultiplier = 2;
    }
    if (!data.hiddenValue) {
      data.hiddenValue = 'scaled-second';
    }
    if (!data.questionPrompt) {
      const knownIndex = data.hiddenValue === 'scaled-first' ? 1 : 0;
      const knownScaled = data.baseRatio[knownIndex] * data.targetMultiplier;
      data.questionPrompt = `If ${data.baseRatio[0]} ${data.rowLabels[0]} gives you ${data.baseRatio[1]} ${data.rowLabels[1]}, how many ${data.rowLabels[data.hiddenValue === 'scaled-first' ? 0 : 1]} will ${knownScaled} ${data.rowLabels[knownIndex]} give you?`;
    }
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    Object.assign(data, config);
  }

  return data as RatioTableData;
};
