import { Type, Schema, ThinkingLevel } from "@google/genai";
import { DoubleNumberLineData } from "../../primitives/visual-primitives/math/DoubleNumberLine";
import { ai } from "../geminiClient";

/**
 * Schema definition for Double Number Line Data
 *
 * This schema defines the structure for a double number line visualization,
 * showing proportional relationships between two quantities with aligned tick marks.
 */
const doubleNumberLineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the double number line (e.g., 'Converting Miles to Kilometers')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the proportional relationship and what students will learn"
    },
    topLabel: {
      type: Type.STRING,
      description: "Label for the top quantity (e.g., 'Miles', 'Hours', 'Cups of Sugar')"
    },
    bottomLabel: {
      type: Type.STRING,
      description: "Label for the bottom quantity (e.g., 'Kilometers', 'Distance (km)', 'Cookies Made')"
    },
    topScale: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER, description: "Minimum value on top number line" },
        max: { type: Type.NUMBER, description: "Maximum value on top number line" },
        interval: { type: Type.NUMBER, description: "Spacing between tick marks on top line" }
      },
      required: ["min", "max", "interval"],
      description: "Configuration for the top number line scale"
    },
    bottomScale: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER, description: "Minimum value on bottom number line" },
        max: { type: Type.NUMBER, description: "Maximum value on bottom number line" },
        interval: { type: Type.NUMBER, description: "Spacing between tick marks on bottom line" }
      },
      required: ["min", "max", "interval"],
      description: "Configuration for the bottom number line scale"
    },
    linkedPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topValue: { type: Type.NUMBER, description: "Value on the top number line" },
          bottomValue: { type: Type.NUMBER, description: "Corresponding value on the bottom number line" },
          label: { type: Type.STRING, description: "Optional label for this linked point (e.g., 'Unit Rate', 'Double')" }
        },
        required: ["topValue", "bottomValue"]
      },
      description: "Array of corresponding point pairs showing the proportional relationship. Include 3-5 meaningful points."
    },
    showVerticalGuides: {
      type: Type.BOOLEAN,
      description: "Whether to show vertical alignment guides between corresponding points. Default: true"
    }
  },
  required: ["title", "description", "topLabel", "bottomLabel", "topScale", "bottomScale"]
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
    linkedPoints?: Array<{ topValue: number; bottomValue: number; label?: string }>;
    showVerticalGuides?: boolean;
  }
): Promise<DoubleNumberLineData> => {
  const prompt = `
Create an educational double number line for teaching "${topic}" to ${gradeLevel} students.

DOUBLE NUMBER LINE DESIGN:
- Two parallel horizontal number lines showing proportional relationships
- Each line has its own independent scale (min, max, interval)
- Linked points show corresponding values that maintain the same ratio
- Vertical guides help visualize the alignment between corresponding values
- Critical for understanding proportional reasoning and unit rates

USE CASES BY TOPIC:
1. Ratios & Proportions:
   - Recipe scaling: cups of flour ↔ cookies made
   - Mixing paint: red paint ↔ yellow paint
   - Shopping: items ↔ cost

2. Measurement Conversions:
   - Length: inches ↔ centimeters, feet ↔ meters, miles ↔ kilometers
   - Weight: pounds ↔ kilograms, ounces ↔ grams
   - Volume: cups ↔ milliliters, gallons ↔ liters

3. Rate Problems:
   - Speed: time (hours) ↔ distance (miles)
   - Unit pricing: items ↔ cost ($)
   - Work rate: hours ↔ pages typed

4. Percent Problems:
   - Original amount ↔ percent
   - Whole ↔ part
   - Before tax ↔ after tax

GUIDELINES BY GRADE LEVEL:
- Grade 5-6: Simple whole number ratios, concrete contexts (recipes, conversions)
  Example: 1 cup = 8 ounces (0-4 cups top, 0-32 ounces bottom)

- Grade 6-7: Include unit rates, more complex proportions
  Example: 60 mph (0-5 hours top, 0-300 miles bottom)

- Grade 7-8: Percents as rates per 100, decimal ratios
  Example: Tax rate 8% (0-100 price top, 0-8 tax bottom)

SCALE DESIGN PRINCIPLES:
1. Start both lines at 0 (or a sensible minimum)
2. Choose max values that show meaningful range
3. Use intervals that create 5-12 tick marks (not too crowded)
4. Ensure scales reflect the actual ratio relationship
5. For unit rates, consider starting top line at 1

LINKED POINTS STRATEGY:
- Always include the origin point (0, 0) if both start at 0
- Include the unit rate point (1, rate) for rate problems
- Add 2-4 other meaningful points showing the pattern
- Label key points: "Origin", "Unit Rate", "Double", "Triple", etc.
- Points should be evenly distributed across the range

EXAMPLES:

Grade 6 - Recipe Scaling (Cups to Ounces):
{
  "topLabel": "Cups",
  "bottomLabel": "Ounces",
  "topScale": { "min": 0, "max": 4, "interval": 1 },
  "bottomScale": { "min": 0, "max": 32, "interval": 8 },
  "linkedPoints": [
    { "topValue": 0, "bottomValue": 0, "label": "Origin" },
    { "topValue": 1, "bottomValue": 8, "label": "Unit Rate" },
    { "topValue": 2, "bottomValue": 16, "label": "Double" },
    { "topValue": 4, "bottomValue": 32, "label": "Maximum" }
  ]
}

Grade 7 - Speed Problem (60 mph):
{
  "topLabel": "Hours",
  "bottomLabel": "Miles",
  "topScale": { "min": 0, "max": 5, "interval": 1 },
  "bottomScale": { "min": 0, "max": 300, "interval": 60 },
  "linkedPoints": [
    { "topValue": 0, "bottomValue": 0, "label": "Start" },
    { "topValue": 1, "bottomValue": 60, "label": "Unit Rate (60 mph)" },
    { "topValue": 2, "bottomValue": 120 },
    { "topValue": 3, "bottomValue": 180 },
    { "topValue": 5, "bottomValue": 300, "label": "5 Hours" }
  ]
}

Grade 6 - Measurement Conversion (Miles to Km):
{
  "topLabel": "Miles",
  "bottomLabel": "Kilometers",
  "topScale": { "min": 0, "max": 10, "interval": 2 },
  "bottomScale": { "min": 0, "max": 16, "interval": 3.2 },
  "linkedPoints": [
    { "topValue": 0, "bottomValue": 0, "label": "Origin" },
    { "topValue": 1, "bottomValue": 1.6, "label": "Unit Rate" },
    { "topValue": 5, "bottomValue": 8, "label": "Midpoint" },
    { "topValue": 10, "bottomValue": 16, "label": "Maximum" }
  ]
}

${config ? `
CONFIGURATION HINTS:
${config.topLabel ? `- Top label: ${config.topLabel}` : ''}
${config.bottomLabel ? `- Bottom label: ${config.bottomLabel}` : ''}
${config.topScale ? `- Top scale: min=${config.topScale.min}, max=${config.topScale.max}, interval=${config.topScale.interval}` : ''}
${config.bottomScale ? `- Bottom scale: min=${config.bottomScale.min}, max=${config.bottomScale.max}, interval=${config.bottomScale.interval}` : ''}
${config.linkedPoints ? `- Linked points provided: ${config.linkedPoints.length} points` : ''}
${config.showVerticalGuides !== undefined ? `- Show vertical guides: ${config.showVerticalGuides}` : ''}
` : ''}

REQUIREMENTS:
1. Choose meaningful, concrete labels (not "Quantity A/B")
2. Design scales that clearly show the proportional relationship
3. Include 3-5 linked points distributed across the range
4. Always include origin (0,0) if both scales start at 0
5. Highlight the unit rate point (top=1) when relevant
6. Write clear title describing the relationship
7. Provide educational description explaining the learning goal
8. Enable showVerticalGuides (true) to emphasize correspondence

Return the complete double number line configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: doubleNumberLineSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid double number line data returned from Gemini API');
  }

  // Validation: ensure scales are properly configured
  if (!data.topScale || typeof data.topScale.min !== 'number' || typeof data.topScale.max !== 'number' || typeof data.topScale.interval !== 'number') {
    console.warn('Invalid topScale configuration. Using defaults.');
    data.topScale = { min: 0, max: 10, interval: 1 };
  }

  if (!data.bottomScale || typeof data.bottomScale.min !== 'number' || typeof data.bottomScale.max !== 'number' || typeof data.bottomScale.interval !== 'number') {
    console.warn('Invalid bottomScale configuration. Using defaults.');
    data.bottomScale = { min: 0, max: 10, interval: 1 };
  }

  // Validation: ensure linked points are valid
  if (!data.linkedPoints || !Array.isArray(data.linkedPoints)) {
    console.warn('No linked points provided. Adding default points.');
    data.linkedPoints = [
      { topValue: data.topScale.min, bottomValue: data.bottomScale.min, label: 'Start' },
      { topValue: data.topScale.max, bottomValue: data.bottomScale.max, label: 'End' }
    ];
  }

  // Filter out invalid linked points
  data.linkedPoints = data.linkedPoints.filter((point: any) =>
    typeof point.topValue === 'number' &&
    typeof point.bottomValue === 'number' &&
    point.topValue >= data.topScale.min &&
    point.topValue <= data.topScale.max &&
    point.bottomValue >= data.bottomScale.min &&
    point.bottomValue <= data.bottomScale.max
  );

  // Set default for showVerticalGuides
  if (data.showVerticalGuides === undefined) data.showVerticalGuides = true;

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.topLabel) data.topLabel = config.topLabel;
    if (config.bottomLabel) data.bottomLabel = config.bottomLabel;
    if (config.topScale) data.topScale = config.topScale;
    if (config.bottomScale) data.bottomScale = config.bottomScale;
    if (config.linkedPoints) data.linkedPoints = config.linkedPoints;
    if (config.showVerticalGuides !== undefined) data.showVerticalGuides = config.showVerticalGuides;
  }

  return data as DoubleNumberLineData;
};
