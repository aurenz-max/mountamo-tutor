import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PlaceValueChartData } from "../../primitives/visual-primitives/math/PlaceValueChart";
import { ai } from "../geminiClient";

/**
 * Schema definition for Place Value Chart Data
 *
 * This schema defines the structure for place value chart visualization,
 * including digit positions, initial values, and display options.
 *
 * FOR INTERACTIVE PROBLEMS:
 * - Set targetValue to the number students should build
 * - Set initialValue to 0 (students start with empty chart)
 * - Set editableDigits to true (students can input digits)
 * - Description should give the task: "Build the number 2,450"
 */
const placeValueChartSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the place value chart. For problems, use format like 'Build the Number 2,450' or 'Place Value Challenge'"
    },
    description: {
      type: Type.STRING,
      description: "Educational task description. For construction problems, clearly state: 'Use the place value chart to build the number X by entering the correct digit in each column.' Can include hints about which places are needed."
    },
    minPlace: {
      type: Type.NUMBER,
      description: "Smallest place value position. Use negative for decimals: -3 for thousandths, 0 for ones. Default: -2. Choose based on targetValue complexity."
    },
    maxPlace: {
      type: Type.NUMBER,
      description: "Largest place value position: 0 for ones, 1 for tens, 2 for hundreds, 3 for thousands, etc. Default: 3. Must be large enough to accommodate targetValue."
    },
    initialValue: {
      type: Type.NUMBER,
      description: "Starting value in the chart. For interactive construction problems, use 0 so students start with empty chart. For demonstrations, use the example number."
    },
    targetValue: {
      type: Type.NUMBER,
      description: "The target number students should build. REQUIRED for interactive problems. Example: 2450. Students succeed when their chart equals this value."
    },
    showExpandedForm: {
      type: Type.BOOLEAN,
      description: "Whether to show the expanded form notation below the chart. Recommended true for learning. Default: true"
    },
    showMultipliers: {
      type: Type.BOOLEAN,
      description: "Whether to show the multipliers (×1, ×10, ×100, etc.) above each column. Helpful for beginners. Default: true"
    },
    editableDigits: {
      type: Type.BOOLEAN,
      description: "Whether students can edit the digits in the chart. Must be true for interactive problems. Default: true"
    }
  },
  required: ["title", "description", "minPlace", "maxPlace", "initialValue", "targetValue"]
};

/**
 * Generate place value chart data for interactive number construction problems
 *
 * This function creates place value chart problems where students:
 * 1. See an empty place value chart
 * 2. Are asked to build a specific number (targetValue)
 * 3. Enter digits in the correct positions
 * 4. Receive feedback on their construction
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PlaceValueChartData configured as an interactive problem
 */
export const generatePlaceValueChart = async (
  topic: string,
  gradeLevel: string,
  config?: {
    minPlace?: number;
    maxPlace?: number;
    initialValue?: number;
    targetValue?: number;
    showExpandedForm?: boolean;
    showMultipliers?: boolean;
    editableDigits?: boolean;
  }
): Promise<PlaceValueChartData> => {
  const prompt = `
Create an INTERACTIVE place value chart NUMBER CONSTRUCTION PROBLEM for "${topic}" to ${gradeLevel} students.

🎯 PROBLEM TYPE: Number Construction
Students will be given an empty place value chart and must build a target number by entering the correct digits in each column.

GRADE-APPROPRIATE TARGET NUMBERS:
- Grades 1-2: 2-digit to 3-digit whole numbers (e.g., 47, 253)
  → Use minPlace: 0, maxPlace: 2
- Grades 3-4: 3-digit to 4-digit whole numbers (e.g., 1,450, 5,832)
  → Use minPlace: 0, maxPlace: 3 or 4
- Grades 5-6: Include decimals (e.g., 3,245.75, 12,450.5)
  → Use minPlace: -2, maxPlace: 4 or 5
- Grades 7-8: Larger numbers with decimals (e.g., 125,456.125)
  → Use minPlace: -3, maxPlace: 5 or 6

TOPIC-SPECIFIC TARGET SELECTION:
- "Place value basics": Simple 2-3 digit numbers with variety of non-zero digits
- "Reading large numbers": 4-6 digit numbers with commas (e.g., 12,450)
- "Decimal place value": Numbers with 1-3 decimal places
- "Powers of 10": Numbers that highlight specific place values (e.g., 7,000, 0.05)
- "Comparing numbers": Numbers where place value matters (e.g., 3,254 vs 3,524)

${config?.targetValue ? `
SPECIFIED TARGET: ${config.targetValue}
Use this exact number as the targetValue. Adjust minPlace and maxPlace to accommodate it.
` : ''}

REQUIRED SETUP FOR INTERACTIVE PROBLEMS:
1. targetValue: The number students must build (REQUIRED)
2. initialValue: Always 0 (students start with empty chart)
3. editableDigits: Always true (students must input digits)
4. minPlace & maxPlace: Must span all digits in targetValue
5. title: Use format like "Build the Number 2,450" or "Place Value Challenge: 3,672"
6. description: Clear task like "Use the place value chart to build the number 2,450 by entering the correct digit in each column. Remember: each digit's position determines its value!"

HELPFUL FEATURES:
- showExpandedForm: true (helps students see the breakdown)
- showMultipliers: true for grades 1-4, optional for 5-8

EXAMPLE OUTPUT:
{
  "title": "Build the Number 2,450",
  "description": "Use the place value chart to build the number 2,450 by entering the correct digit in each column. Which digit goes in the thousands place? The hundreds place? The tens and ones?",
  "minPlace": 0,
  "maxPlace": 3,
  "initialValue": 0,
  "targetValue": 2450,
  "showExpandedForm": true,
  "showMultipliers": true,
  "editableDigits": true
}

Return a complete interactive number construction problem.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: placeValueChartSchema   
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid place value chart data returned from Gemini API');
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.minPlace !== undefined) data.minPlace = config.minPlace;
    if (config.maxPlace !== undefined) data.maxPlace = config.maxPlace;
    if (config.initialValue !== undefined) data.initialValue = config.initialValue;
    if (config.targetValue !== undefined) data.targetValue = config.targetValue;
    if (config.showExpandedForm !== undefined) data.showExpandedForm = config.showExpandedForm;
    if (config.showMultipliers !== undefined) data.showMultipliers = config.showMultipliers;
    if (config.editableDigits !== undefined) data.editableDigits = config.editableDigits;
  }

  // Ensure interactive problem defaults
  // For problems, we want students to build from scratch
  if (data.targetValue !== undefined && data.initialValue === undefined) {
    data.initialValue = 0;
  }
  if (data.targetValue !== undefined && data.editableDigits === undefined) {
    data.editableDigits = true;
  }

  return data;
};
