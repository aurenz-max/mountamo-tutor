import { Type, Schema, ThinkingLevel } from "@google/genai";
import { RatioTableData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Schema definition for Ratio Table Data
 *
 * This schema defines the structure for ratio table visualization,
 * showing proportional relationships through an interactive multiplier slider.
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
      description: "Educational description explaining what students will learn from exploring this ratio"
    },
    rowLabels: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Two labels for the quantities being compared (e.g., ['Cups of Flour', 'Cookies Made']). Must have exactly 2 items."
    },
    baseRatio: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "The reference ratio as [quantity1, quantity2] (e.g., [1, 12] means 1 cup of flour makes 12 cookies). This is the locked reference column that students compare against."
    },
    maxMultiplier: {
      type: Type.NUMBER,
      description: "Maximum value for the multiplier slider (default: 10). Students can adjust from 0 to this value to see how the ratio scales."
    },
    showUnitRate: {
      type: Type.BOOLEAN,
      description: "Show the unit rate (ratio of quantity2 to quantity1) below each column. Essential for understanding rates. Default: true"
    },
    showBarChart: {
      type: Type.BOOLEAN,
      description: "Display visual bar chart comparing the reference values to scaled values. Helps visualize proportional growth. Default: true"
    }
  },
  required: ["title", "description", "rowLabels", "baseRatio"]
};

/**
 * Generate ratio table data for visualization
 *
 * This function creates ratio table data including:
 * - A reference ratio (locked column)
 * - Interactive multiplier slider to scale the ratio
 * - Visual bar chart showing proportional growth
 * - Unit rate calculations
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns RatioTableData with complete configuration
 */
export const generateRatioTable = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rowLabels?: [string, string];
    baseRatio?: [number, number];
    maxMultiplier?: number;
    showUnitRate?: boolean;
    showBarChart?: boolean;
  }
): Promise<RatioTableData> => {
  const prompt = `
Create an educational ratio table for teaching "${topic}" to ${gradeLevel} students.

NEW INTERACTIVE DESIGN:
- The table shows a REFERENCE RATIO (locked) vs. a SCALED ratio (adjustable)
- Students use a SLIDER to adjust a multiplier (0 to maxMultiplier)
- A BAR CHART visualizes how both quantities scale proportionally
- This focuses on exploring ONE ratio relationship interactively

CONTEXT:
- baseRatio: The reference ratio [quantity1, quantity2] that stays locked
- Students adjust a multiplier slider to see the scaled ratio
- Visual bar chart shows proportional growth side-by-side
- Unit rate is calculated and displayed for both columns

GUIDELINES FOR GRADE LEVELS:
- Grades 4-5: Simple whole number ratios (1:2, 1:3, etc.), maxMultiplier: 5-8, concrete contexts (recipes, pets)
- Grades 6-7: More complex ratios, maxMultiplier: 10, real-world applications (speed, price)
- Grades 8+: Include decimals, maxMultiplier: 15-20, advanced proportional reasoning

TOPIC-SPECIFIC GUIDANCE:
- "Equivalent ratios": Use simple base ratio (e.g., [2, 3]), students explore by scaling
- "Unit rates": Use base ratio starting with 1 (e.g., [1, 60] for 60 mph)
- "Proportional relationships": Real-world context (miles/hours, cost/items, etc.)
- "Scaling recipes": Recipe ingredients (e.g., [1, 12] for flour to cookies)
- "Maps and scale": Distance ratios (e.g., [1, 50] for 1 inch = 50 miles)
- "Speed and distance": Time vs. distance (e.g., [1, 60] for constant speed)

COMMON RATIO CONTEXTS:
- Recipes: [1, 12] → "1 cup flour makes 12 cookies"
- Shopping: [1, 2.50] → "1 item costs $2.50"
- Speed: [1, 60] → "1 hour = 60 miles"
- Mixing: [2, 3] → "2 parts red to 3 parts yellow"
- Scale: [1, 50] → "1 inch on map = 50 actual miles"

NUMBER SELECTION:
- Keep baseRatio simple (prefer starting with 1 for first value)
- Elementary: whole numbers 1-20
- Middle school: friendly decimals (2.5, 0.5, etc.)
- Ensure the ratio is meaningful and proportional

${config ? `
CONFIGURATION HINTS:
${config.rowLabels ? `- Row labels: ${config.rowLabels.join(', ')}` : ''}
${config.baseRatio ? `- Base ratio: [${config.baseRatio.join(', ')}]` : ''}
${config.maxMultiplier ? `- Max multiplier: ${config.maxMultiplier}` : ''}
${config.showUnitRate !== undefined ? `- Show unit rate: ${config.showUnitRate}` : ''}
${config.showBarChart !== undefined ? `- Show bar chart: ${config.showBarChart}` : ''}
` : ''}

REQUIREMENTS:
1. Choose meaningful row labels (e.g., "Cups of Flour" not "Quantity A")
2. Set a simple baseRatio (prefer [1, x] for unit rate clarity)
3. Set appropriate maxMultiplier (5-20 based on grade level)
4. Write a clear title describing the ratio relationship
5. Provide educational description explaining the learning goal
6. Enable showUnitRate (true) for most cases
7. Enable showBarChart (true) to visualize proportional growth

EXAMPLES:
Grade 6 - Recipe Scaling:
- rowLabels: ["Cups of Flour", "Cookies Made"]
- baseRatio: [1, 12]
- maxMultiplier: 10
- Title: "Baking Cookies: Flour to Cookie Ratio"

Grade 7 - Speed:
- rowLabels: ["Hours", "Miles Traveled"]
- baseRatio: [1, 60]
- maxMultiplier: 10
- showUnitRate: true (shows 60 mph)

Grade 6 - Unit Price:
- rowLabels: ["Items", "Cost ($)"]
- baseRatio: [1, 2.50]
- maxMultiplier: 12
- Shows $2.50 per item

Return the complete ratio table configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: ratioTableSchema,
      temperature: 0.8,
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
  if (!data.maxMultiplier || data.maxMultiplier < 2) data.maxMultiplier = 10;
  if (data.showUnitRate === undefined) data.showUnitRate = true;
  if (data.showBarChart === undefined) data.showBarChart = true;

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.rowLabels) data.rowLabels = config.rowLabels;
    if (config.baseRatio) data.baseRatio = config.baseRatio;
    if (config.maxMultiplier) data.maxMultiplier = config.maxMultiplier;
    if (config.showUnitRate !== undefined) data.showUnitRate = config.showUnitRate;
    if (config.showBarChart !== undefined) data.showBarChart = config.showBarChart;
  }

  return data as RatioTableData;
};
