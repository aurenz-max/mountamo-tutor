import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PercentBarData } from "../../primitives/visual-primitives/math/PercentBar";
import { ai } from "../geminiClient";

/**
 * Schema definition for Percent Bar Data
 *
 * This schema defines the structure for a percent bar visualization,
 * showing part-whole relationships with percentages and actual values.
 */
const percentBarSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the percent bar (e.g., 'Tax on Purchase', 'Test Score Percentage')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the percent concept and what students will learn"
    },
    wholeValue: {
      type: Type.NUMBER,
      description: "The value representing 100% (the whole). Use meaningful numbers like prices, test points, etc."
    },
    shadedPercent: {
      type: Type.NUMBER,
      description: "The percentage that is shaded/highlighted (0-100)"
    },
    showPercentLabels: {
      type: Type.BOOLEAN,
      description: "Whether to display percentage markers on the bar. Default: true"
    },
    showValueLabels: {
      type: Type.BOOLEAN,
      description: "Whether to display absolute value labels alongside percentages. Default: true"
    },
    benchmarkLines: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER,
        description: "Percentage value for benchmark line (e.g., 25, 50, 75)"
      },
      description: "Array of benchmark percentages to show as guide lines (typically quarters: 25, 50, 75)"
    },
    doubleBar: {
      type: Type.BOOLEAN,
      description: "Whether to show a second bar below displaying actual values. Default: false for simpler concepts, true for more advanced"
    }
  },
  required: ["title", "description", "wholeValue", "shadedPercent"]
};

/**
 * Generate percent bar data for visualization
 *
 * This function creates percent bar data including:
 * - A horizontal bar representing 100%
 * - Shaded portion showing a specific percentage
 * - Benchmark lines at key percentages (25%, 50%, 75%)
 * - Optional value bar showing actual amounts
 * - Interactive percentage adjustment
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PercentBarData with complete configuration
 */
export const generatePercentBar = async (
  topic: string,
  gradeLevel: string,
  config?: {
    wholeValue?: number;
    shadedPercent?: number;
    showPercentLabels?: boolean;
    showValueLabels?: boolean;
    benchmarkLines?: number[];
    doubleBar?: boolean;
  }
): Promise<PercentBarData> => {
  const prompt = `
Create an educational percent bar for teaching "${topic}" to ${gradeLevel} students.

PERCENT BAR DESIGN:
- A horizontal bar representing 100% (the whole)
- Shaded portion representing a part as a percentage
- Benchmark lines at key percentages (typically 25%, 50%, 75%)
- Optional second bar showing actual values
- Interactive - students can adjust the percentage
- Critical for understanding part-whole relationships and percent concepts

USE CASES BY TOPIC:
1. Basic Percent Concepts (Grades 5-6):
   - What is a percent? Understanding parts of 100
   - Simple percentages: 25%, 50%, 75%, 100%
   - Benchmark fractions as percents (½ = 50%, ¼ = 25%)

2. Percent of a Number (Grades 6-7):
   - Find 30% of 80
   - Calculate percent of a quantity
   - Real-world contexts: scores, discounts, portions

3. Percent Increase/Decrease (Grade 7):
   - Price increased by 20%
   - Population decreased by 15%
   - Before and after comparisons

4. Financial Applications (Grades 7-8):
   - Sales tax (8% of purchase price)
   - Tip calculations (15%, 18%, 20%)
   - Discounts (30% off original price)
   - Interest rates

5. Statistics & Probability (Grades 7-8):
   - Probability as percent (40% chance of rain)
   - Survey results (65% of students prefer...)
   - Percent correct on tests/quizzes

GUIDELINES BY GRADE LEVEL:
- Grade 5: Simple benchmark percents (25%, 50%, 75%, 100%), whole values like 100, 20, 40
  Example: "50% of 20 cookies" → wholeValue: 20, shadedPercent: 50

- Grade 6: More varied percents and whole values, real-world contexts
  Example: "30% of 60 points on a test" → wholeValue: 60, shadedPercent: 30

- Grade 7: Include financial contexts, percent change scenarios
  Example: "8% sales tax on $50 purchase" → wholeValue: 50, shadedPercent: 8

- Grade 8: Complex applications, compound scenarios
  Example: "15% tip on $42.50 bill" → wholeValue: 42.50, shadedPercent: 15

WHOLE VALUE SELECTION:
1. Use meaningful, contextual numbers (not random)
2. Common choices by context:
   - Money: $10, $20, $50, $100, $42.50 (realistic prices)
   - Test scores: 20, 50, 100 points
   - Items/objects: 20, 25, 40, 80, 100 items
   - Measurements: 60 minutes, 100 meters, etc.
3. Avoid very large or very small numbers
4. Consider mental math friendliness for the grade level

SHADED PERCENT SELECTION:
1. For introductory lessons: Use benchmarks (25%, 50%, 75%)
2. For practice: Use varied percents (30%, 60%, 18%, 85%)
3. Match the concept:
   - Basic concepts → round numbers (20%, 40%, 60%)
   - Real-world → realistic values (8% tax, 15% tip, 35% discount)
4. Ensure the resulting value makes sense (avoid tiny decimals for lower grades)

BENCHMARK LINES STRATEGY:
1. Default: [25, 50, 75] for quarter marks
2. Alternative sets:
   - Thirds: [33, 67] for certain contexts
   - Tenths: [10, 20, 30, 40, 50, 60, 70, 80, 90] for fine granularity
   - Custom: Based on the specific problem (e.g., [15, 30, 45] for tip amounts)
3. Fewer lines = cleaner for younger grades
4. More lines = better precision for older grades

DOUBLE BAR USAGE:
- Use doubleBar: false for Grade 5-6 introductory percent concepts
- Use doubleBar: true for Grade 6-8 when connecting percents to actual values
- Essential when the actual value calculation is the learning goal
- Helps students see both representations simultaneously

EXAMPLES:

Grade 5 - Basic Percent Concept (Half):
{
  "title": "Understanding 50%",
  "description": "50% means half. Explore how 50% of 20 equals 10 - exactly half of the whole!",
  "wholeValue": 20,
  "shadedPercent": 50,
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": false
}

Grade 6 - Test Score:
{
  "title": "Test Score: 80% Correct",
  "description": "Out of 60 total points on the test, you scored 80%. See how many points that represents!",
  "wholeValue": 60,
  "shadedPercent": 80,
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": true
}

Grade 7 - Sales Tax:
{
  "title": "Calculating 8% Sales Tax",
  "description": "When you purchase an item for $50, an 8% sales tax is added. Visualize what 8% of the purchase price looks like and calculate the tax amount.",
  "wholeValue": 50,
  "shadedPercent": 8,
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": true
}

Grade 7 - Discount:
{
  "title": "35% Off Sale",
  "description": "A $80 jacket is on sale for 35% off. See how much you'll save with this discount!",
  "wholeValue": 80,
  "shadedPercent": 35,
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": true
}

Grade 8 - Probability:
{
  "title": "Weather Probability: 65% Chance of Rain",
  "description": "Meteorologists predict a 65% probability of rain tomorrow. Understanding probability as a percent helps us make informed decisions.",
  "wholeValue": 100,
  "shadedPercent": 65,
  "showPercentLabels": true,
  "showValueLabels": false,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": false
}

${config ? `
CONFIGURATION HINTS:
${config.wholeValue ? `- Whole value: ${config.wholeValue}` : ''}
${config.shadedPercent !== undefined ? `- Shaded percent: ${config.shadedPercent}%` : ''}
${config.showPercentLabels !== undefined ? `- Show percent labels: ${config.showPercentLabels}` : ''}
${config.showValueLabels !== undefined ? `- Show value labels: ${config.showValueLabels}` : ''}
${config.benchmarkLines ? `- Benchmark lines: ${config.benchmarkLines.join(', ')}` : ''}
${config.doubleBar !== undefined ? `- Double bar: ${config.doubleBar}` : ''}
` : ''}

REQUIREMENTS:
1. Choose a meaningful, contextual whole value appropriate for the grade level
2. Select a shaded percent that aligns with the learning objective
3. Write clear title and description explaining the scenario
4. Set showPercentLabels to true for most cases (helps with learning)
5. Set showValueLabels based on whether actual values are important to the lesson
6. Use default benchmark lines [25, 50, 75] unless a specific reason to change
7. Use doubleBar wisely - true when connecting percents to actual values is key
8. Ensure the calculated value (shadedPercent × wholeValue / 100) makes pedagogical sense

Return the complete percent bar configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: percentBarSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid percent bar data returned from Gemini API');
  }

  // Validation: ensure wholeValue is valid
  if (!data.wholeValue || typeof data.wholeValue !== 'number' || data.wholeValue <= 0) {
    console.warn('Invalid wholeValue. Using default of 100.');
    data.wholeValue = 100;
  }

  // Validation: ensure shadedPercent is valid
  if (typeof data.shadedPercent !== 'number' || data.shadedPercent < 0 || data.shadedPercent > 100) {
    console.warn('Invalid shadedPercent. Using default of 50.');
    data.shadedPercent = 50;
  }

  // Set defaults for optional boolean fields
  if (data.showPercentLabels === undefined) data.showPercentLabels = true;
  if (data.showValueLabels === undefined) data.showValueLabels = true;
  if (data.doubleBar === undefined) data.doubleBar = false;

  // Validation: ensure benchmarkLines is valid
  if (!data.benchmarkLines || !Array.isArray(data.benchmarkLines)) {
    data.benchmarkLines = [25, 50, 75];
  } else {
    // Filter out invalid benchmark values
    data.benchmarkLines = data.benchmarkLines.filter((b: any) =>
      typeof b === 'number' && b > 0 && b < 100
    );
    // If no valid benchmarks remain, use defaults
    if (data.benchmarkLines.length === 0) {
      data.benchmarkLines = [25, 50, 75];
    }
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.wholeValue !== undefined) data.wholeValue = config.wholeValue;
    if (config.shadedPercent !== undefined) data.shadedPercent = config.shadedPercent;
    if (config.showPercentLabels !== undefined) data.showPercentLabels = config.showPercentLabels;
    if (config.showValueLabels !== undefined) data.showValueLabels = config.showValueLabels;
    if (config.benchmarkLines) data.benchmarkLines = config.benchmarkLines;
    if (config.doubleBar !== undefined) data.doubleBar = config.doubleBar;
  }

  return data as PercentBarData;
};
