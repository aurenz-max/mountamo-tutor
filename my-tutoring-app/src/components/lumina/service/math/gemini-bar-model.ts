/**
 * Bar Model Generator - Dedicated service for bar model visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface BarValue {
  label: string;
  value: number;
  color?: string;
}

export interface BarModelData {
  title: string;
  description: string;
  values: BarValue[];
}

/**
 * Generate Bar Model content
 *
 * Creates a bar model visualization for elementary math education,
 * helping students understand comparison, addition, or part-whole relationships.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Bar model data with values to display
 */
export const generateBarModel = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<BarModelData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the bar model visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the bar model demonstrates" },
      values: {
        type: Type.ARRAY,
        description: "Array of values to display as bars",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "Label for this bar" },
            value: { type: Type.NUMBER, description: "Numeric value for the bar height" },
            color: { type: Type.STRING, description: "Color for this bar (e.g., 'blue', 'green', 'purple')" }
          },
          required: ["label", "value"]
        }
      }
    },
    required: ["title", "description", "values"]
  };

  const prompt = `You are generating a Bar Model visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate a bar model that helps students understand comparison, addition, or part-whole relationships through visual bars.

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain what the bars represent
3. Create 2-4 bars with different values
4. Use colors: blue, green, purple, orange, pink, or yellow
5. Values should relate to the topic and be appropriate for the grade level
6. Labels should be clear and concise

Return the complete bar model data structure.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📊 Bar Model Generated from dedicated service:', {
    topic,
    barCount: data.values?.length || 0
  });

  return data as BarModelData;
};
