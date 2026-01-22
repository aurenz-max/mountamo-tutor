/**
 * Generative Table Generator - Dedicated service for structured data tables
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface GenerativeTableData {
  title?: string;
  headers: string[];
  rows: string[][];
  type: 'table';
}

/**
 * Generate Generative Table content
 *
 * Creates a structured table with headers and rows for organized
 * presentation of information.
 *
 * @param topic - The topic being organized in table format
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Table data with headers and rows
 */
export const generateGenerativeTable = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<GenerativeTableData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
    },
    required: ["headers", "rows"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create structured table for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Organize and present information clearly'}

Generate a table with headers and rows.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📊 Generative Table Generated from dedicated service:', {
    topic,
    headerCount: data.headers?.length || 0,
    rowCount: data.rows?.length || 0
  });

  return { ...data, type: 'table' } as GenerativeTableData;
};
