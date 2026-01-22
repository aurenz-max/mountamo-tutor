/**
 * Sentence Analyzer Generator - Dedicated service for sentence diagram visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

export interface SentencePart {
  text: string;
  role: string;
  partOfSpeech: string;
  definition: string;
}

export interface SentenceAnalyzerData {
  title: string;
  description: string;
  parts: SentencePart[];
}

/**
 * Generate Sentence Analyzer content
 *
 * Creates a sentence diagram showing parts of speech and grammatical roles
 * for language arts education.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Sentence analyzer data with parts breakdown
 */
export const generateSentenceAnalyzer = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    title?: string;
  }
): Promise<SentenceAnalyzerData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the sentence analysis" },
      description: { type: Type.STRING, description: "Brief explanation of the grammatical concept" },
      parts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The word or phrase" },
            role: { type: Type.STRING, description: "Grammatical role (e.g., Subject, Predicate, Direct Object)" },
            partOfSpeech: { type: Type.STRING, description: "Part of speech (e.g., Noun, Verb, Adjective)" },
            definition: { type: Type.STRING, description: "Brief grammar explanation for this element" }
          },
          required: ["text", "role", "partOfSpeech", "definition"]
        }
      }
    },
    required: ["title", "description", "parts"]
  };

  const prompt = `Create a sentence diagram for educational purposes.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Exhibit Title: ${config?.title || 'Sentence Structure'}
- Purpose: ${config?.intent || 'Understand sentence structure and grammar'}

Generate a detailed sentence breakdown showing parts of speech and grammatical roles.
Choose an example sentence that clearly demonstrates the concept and is appropriate for the grade level.

REQUIREMENTS:
1. Title should be engaging and describe the grammar concept
2. Description should explain what the sentence demonstrates
3. Break down the sentence into individual words or meaningful phrases
4. For each part, identify:
   - The text (word or phrase)
   - Its grammatical role (Subject, Predicate, Direct Object, Indirect Object, etc.)
   - Its part of speech (Noun, Verb, Adjective, Adverb, etc.)
   - A brief, student-friendly definition of why it serves that role

Return the complete sentence analysis data structure.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No sentence data generated");
  const data = JSON.parse(response.text);

  console.log('📝 Sentence Analyzer Generated from dedicated service:', {
    topic,
    partsCount: data.parts?.length || 0
  });

  return data as SentenceAnalyzerData;
};
