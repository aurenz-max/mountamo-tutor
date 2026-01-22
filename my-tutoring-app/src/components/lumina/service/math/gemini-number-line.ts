/**
 * Number Line Generator - Dedicated service for number line visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface NumberLineHighlight {
  value: number;
  label: string;
}

export interface NumberLineData {
  title: string;
  description: string;
  range: {
    min: number;
    max: number;
  };
  highlights: NumberLineHighlight[];
}

/**
 * Generate Number Line content
 *
 * Creates a number line visualization for elementary math education,
 * helping students understand number placement, counting, addition, or subtraction.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Number line data with range and highlights
 */
export const generateNumberLine = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<NumberLineData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the number line visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the number line demonstrates" },
      range: {
        type: Type.OBJECT,
        description: "The range of numbers shown on the line",
        properties: {
          min: { type: Type.NUMBER, description: "Minimum value on the number line" },
          max: { type: Type.NUMBER, description: "Maximum value on the number line" }
        },
        required: ["min", "max"]
      },
      highlights: {
        type: Type.ARRAY,
        description: "Important points to highlight on the number line",
        items: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: "Position on the number line" },
            label: { type: Type.STRING, description: "Label for this highlighted point" }
          },
          required: ["value", "label"]
        }
      }
    },
    required: ["title", "description", "range", "highlights"]
  };

  const prompt = `You are generating a Number Line visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate a number line that helps students understand number placement, counting, addition, or subtraction.

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain what the number line demonstrates
3. Choose an appropriate range (e.g., 0-10 for young learners, 0-100 for older students)
4. Highlight 2-4 important points on the line
5. Make sure highlighted values fall within the range
6. Labels should explain why each point is important

Return the complete number line data structure.`;

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

  console.log('📏 Number Line Generated from dedicated service:', {
    topic,
    range: `${data.range?.min}-${data.range?.max}`,
    highlightCount: data.highlights?.length || 0
  });

  return data as NumberLineData;
};
