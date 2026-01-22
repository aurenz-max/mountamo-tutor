/**
 * Fraction Circles Generator - Dedicated service for fraction visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface FractionItem {
  numerator: number;
  denominator: number;
  label?: string;
}

export interface FractionCirclesData {
  title: string;
  description: string;
  fractions: FractionItem[];
}

/**
 * Generate Fraction Circles content
 *
 * Creates fraction circles visualization for elementary math education,
 * helping students understand fractional parts visually.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Fraction circles data with fractions to display
 */
export const generateFractionCircles = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<FractionCirclesData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the fraction circles visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the fraction circles demonstrate" },
      fractions: {
        type: Type.ARRAY,
        description: "Array of fractions to visualize",
        items: {
          type: Type.OBJECT,
          properties: {
            numerator: { type: Type.NUMBER, description: "Numerator of the fraction" },
            denominator: { type: Type.NUMBER, description: "Denominator of the fraction" },
            label: { type: Type.STRING, description: "Label for this fraction" }
          },
          required: ["numerator", "denominator"]
        }
      }
    },
    required: ["title", "description", "fractions"]
  };

  const prompt = `You are generating Fraction Circles visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate fraction circles that help students understand fractional parts visually.

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the fraction concept
3. Create 2-3 fractions to compare
4. Use simple fractions appropriate for the grade level (e.g., 1/2, 1/4, 3/4)
5. Labels can explain what each fraction represents

Return the complete fraction circles data structure.`;

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

  console.log('🥧 Fraction Circles Generated from dedicated service:', {
    topic,
    fractionCount: data.fractions?.length || 0
  });

  return data as FractionCirclesData;
};
