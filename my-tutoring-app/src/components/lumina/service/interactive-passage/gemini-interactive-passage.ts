/**
 * Interactive Passage Generator - Dedicated service for reading comprehension activities
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { InteractivePassageData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Generate Interactive Passage content
 *
 * Creates a reading passage with vocabulary highlights, inline comprehension checks,
 * and highlight tasks for evidence-based reading.
 *
 * @param topic - The topic for the reading passage
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Interactive passage data with sections and tasks
 */
export const generateInteractivePassage = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<InteractivePassageData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the reading passage" },
      author: { type: Type.STRING, description: "Author name (or 'Lumina AI')" },
      readingLevel: { type: Type.STRING, description: "Lexile or grade level estimate" },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['text', 'vocabulary'] },
                  vocabData: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      partOfSpeech: { type: Type.STRING }
                    },
                    required: ["word", "definition", "partOfSpeech"]
                  }
                },
                required: ["text", "type"]
              }
            },
            inlineQuestion: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER }
              },
              required: ["prompt", "options", "correctIndex"]
            }
          },
          required: ["id", "segments"]
        }
      },
      highlightTask: {
        type: Type.OBJECT,
        properties: {
          instruction: { type: Type.STRING, description: "Task instruction (e.g., 'Find the sentence that explains why...')" },
          targets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                textSegment: { type: Type.STRING, description: "Exact text to match for highlighting" },
                correct: { type: Type.BOOLEAN },
                feedback: { type: Type.STRING }
              },
              required: ["id", "textSegment", "correct", "feedback"]
            }
          }
        },
        required: ["instruction", "targets"]
      }
    },
    required: ["title", "sections"]
  };

  const prompt = `Create an interactive reading passage for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Provide reading comprehension practice'}

Generate a reading passage broken into sections.
- Identify 3-5 challenging vocabulary words and mark them as 'vocabulary' segments with definitions.
- Include 1-2 inline comprehension checks (multiple choice).
- Create a "Highlight Task" where students must find evidence in the text to answer a specific question.
  - Provide at least 1 correct target (the right evidence).
  - Provide 1-2 plausible but incorrect targets (distractors) with specific feedback explaining why they are wrong.

Structure the text as a sequence of segments. Most segments will be 'text', but vocabulary words should be their own 'vocabulary' segments.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text) as InteractivePassageData;

  console.log('📖 Interactive Passage Generated from dedicated service:', {
    topic,
    title: data.title,
    sectionCount: data.sections?.length || 0
  });

  return data;
};
