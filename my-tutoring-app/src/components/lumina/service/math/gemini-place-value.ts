import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PlaceValueChartData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Place Value Chart Data
 *
 * This schema defines the structure for place value chart visualization,
 * including digit positions, initial values, and display options.
 */
const placeValueChartSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the place value chart (e.g., 'Understanding Place Value in 12,345')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this chart"
    },
    minPlace: {
      type: Type.NUMBER,
      description: "Smallest place value position. Use negative for decimals: -3 for thousandths, 0 for ones. Default: -2"
    },
    maxPlace: {
      type: Type.NUMBER,
      description: "Largest place value position: 0 for ones, 1 for tens, 2 for hundreds, 3 for thousands, etc. Default: 3"
    },
    initialValue: {
      type: Type.NUMBER,
      description: "The number to display in the chart. Can be integer or decimal. Example: 1234.56"
    },
    showExpandedForm: {
      type: Type.BOOLEAN,
      description: "Whether to show the expanded form notation below the chart. Default: true"
    },
    showMultipliers: {
      type: Type.BOOLEAN,
      description: "Whether to show the multipliers (×1, ×10, ×100, etc.) above each column. Default: true"
    },
    editableDigits: {
      type: Type.BOOLEAN,
      description: "Whether students can edit the digits in the chart. Use true for interactive practice. Default: true"
    }
  },
  required: ["title", "description", "minPlace", "maxPlace", "initialValue"]
};

/**
 * Generate place value chart data for visualization
 *
 * This function creates place value chart data including:
 * - Appropriate place value range for the topic and grade level
 * - Initial number value to demonstrate concepts
 * - Educational context and descriptions
 * - Configuration for interactive features
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PlaceValueChartData with complete configuration
 */
export const generatePlaceValueChart = async (
  topic: string,
  gradeLevel: string,
  config?: {
    minPlace?: number;
    maxPlace?: number;
    initialValue?: number;
    showExpandedForm?: boolean;
    showMultipliers?: boolean;
    editableDigits?: boolean;
  }
): Promise<PlaceValueChartData> => {
  const prompt = `
Create an educational place value chart for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This is an interactive place value chart showing digits in labeled columns
- Students can see how digit positions affect number values
- Supports both whole numbers and decimals

GUIDELINES FOR GRADE LEVELS:
- Grades 1-2: Use 0 to 2 (ones to hundreds), whole numbers only
- Grades 3-4: Use 0 to 4 (ones to ten thousands), introduce decimals with -1 to 1
- Grades 5-6: Use -2 to 5 (hundredths to hundred thousands)
- Grades 7-8: Use -3 to 6 (thousandths to millions), connect to scientific notation

TOPIC-SPECIFIC GUIDANCE:
- "Reading large numbers": Focus on place values from hundreds to millions
- "Decimal place value": Include negative place values (-1 for tenths, -2 for hundredths)
- "Powers of 10": Show full range with multipliers enabled
- "Rounding": Use appropriate range for the rounding level being taught
- "Comparing numbers": Choose example that highlights place value importance

${config ? `
CONFIGURATION HINTS:
${config.minPlace !== undefined ? `- Minimum place: ${config.minPlace}` : ''}
${config.maxPlace !== undefined ? `- Maximum place: ${config.maxPlace}` : ''}
${config.initialValue !== undefined ? `- Initial value: ${config.initialValue}` : ''}
` : ''}

REQUIREMENTS:
1. Choose an appropriate minPlace and maxPlace based on topic and grade level
2. Select an initialValue that clearly demonstrates the concept
3. Write a clear, student-friendly title and description
4. Consider whether digits should be editable (practice) or fixed (demonstration)
5. Enable expanded form for elementary grades, optional for middle school
6. Show multipliers for teaching powers of 10, optional otherwise

Return the complete place value chart configuration.
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
    if (config.showExpandedForm !== undefined) data.showExpandedForm = config.showExpandedForm;
    if (config.showMultipliers !== undefined) data.showMultipliers = config.showMultipliers;
    if (config.editableDigits !== undefined) data.editableDigits = config.editableDigits;
  }

  return data;
};
