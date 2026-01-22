/**
 * Comparison Panel Generator - Dedicated service for A vs B comparisons
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface ComparisonItem {
  name: string;
  description: string;
  visualPrompt: string;
  points: string[];
}

export interface ComparisonSynthesis {
  mainInsight: string;
  keyDifferences: string[];
  keySimilarities: string[];
  whenToUse?: {
    item1Context: string;
    item2Context: string;
  };
  commonMisconception?: string;
}

export interface ComparisonPanelData {
  title: string;
  intro: string;
  item1: ComparisonItem;
  item2: ComparisonItem;
  synthesis: ComparisonSynthesis;
}

/**
 * Generate Comparison Panel content
 *
 * Creates a side-by-side comparison of two items with synthesis insights.
 *
 * @param topic - The topic being compared
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent and objective info
 * @returns Comparison data with two items and synthesis
 */
export const generateComparisonPanel = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }
): Promise<ComparisonPanelData> => {
  const objectiveContext = config?.objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${config.objectiveText}"
The comparison must help students understand the learning objective above.`
    : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      intro: { type: Type.STRING },
      item1: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      item2: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "description", "visualPrompt", "points"]
      },
      synthesis: {
        type: Type.OBJECT,
        properties: {
          mainInsight: { type: Type.STRING },
          keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          keySimilarities: { type: Type.ARRAY, items: { type: Type.STRING } },
          whenToUse: {
            type: Type.OBJECT,
            properties: {
              item1Context: { type: Type.STRING },
              item2Context: { type: Type.STRING }
            },
            required: ["item1Context", "item2Context"]
          },
          commonMisconception: { type: Type.STRING }
        },
        required: ["mainInsight", "keyDifferences", "keySimilarities"]
      }
    },
    required: ["title", "intro", "item1", "item2", "synthesis"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create comparison panel for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Compare and contrast key aspects'}
${objectiveContext}

Generate a side-by-side comparison with two items.
${objectiveContext ? 'The comparison must help students understand the learning objective above.' : ''}

For the synthesis section, provide:
- mainInsight: A clear, insightful statement about the relationship between the two items (1-2 sentences)
- keyDifferences: 2-3 specific, concrete differences that students should recognize
- keySimilarities: 2-3 specific, concrete similarities that connect the concepts
- whenToUse: Explain when/why to use item1 vs item2 (practical application context)
- commonMisconception: One common mistake students make when comparing these concepts

Make all synthesis points clear, grade-appropriate, and actionable for learning.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('⚖️ Comparison Panel Generated from dedicated service:', {
    topic,
    item1: data.item1?.name,
    item2: data.item2?.name
  });

  return data as ComparisonPanelData;
};
