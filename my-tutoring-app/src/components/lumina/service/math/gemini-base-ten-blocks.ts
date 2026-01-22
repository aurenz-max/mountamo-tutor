/**
 * Base-Ten Blocks Generator - Dedicated service for place value visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface BaseTenBlocksData {
  title: string;
  description: string;
  numberValue: number;
}

/**
 * Generate Base-Ten Blocks content
 *
 * Creates a base-ten blocks visualization for elementary math education,
 * helping students understand place value (ones, tens, hundreds).
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Base-ten blocks data with number value
 */
export const generateBaseTenBlocks = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<BaseTenBlocksData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the base-ten blocks visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the blocks demonstrate" },
      numberValue: { type: Type.NUMBER, description: "The number to represent using base-ten blocks (should be under 1000)" }
    },
    required: ["title", "description", "numberValue"]
  };

  const prompt = `You are generating a Base-Ten Blocks visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate base-ten blocks that help students understand place value (ones, tens, hundreds).

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the place value concept
3. Choose a number between 1 and 999 that relates to the topic
4. The number should be appropriate for the grade level
5. Make it relevant to the learning objective

Return the complete base-ten blocks data structure.`;

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

  console.log('🧱 Base-Ten Blocks Generated from dedicated service:', {
    topic,
    numberValue: data.numberValue
  });

  return data as BaseTenBlocksData;
};
