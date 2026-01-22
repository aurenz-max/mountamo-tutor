/**
 * Feature Exhibit Generator - Dedicated service for deep-dive editorial content
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface FeatureSection {
  heading: string;
  content: string;
}

export interface FeatureExhibitData {
  title: string;
  visualPrompt: string;
  sections: FeatureSection[];
  relatedTerms: string[];
}

/**
 * Generate Feature Exhibit content
 *
 * Creates a deep-dive editorial section with multiple subsections
 * for comprehensive topic exploration.
 *
 * @param topic - The topic being explored in depth
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent and objective info
 * @returns Feature exhibit data with sections and related terms
 */
export const generateFeatureExhibit = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }
): Promise<FeatureExhibitData> => {
  const objectiveContext = config?.objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${config.objectiveText}"
All sections must directly support the learning objective above.`
    : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["heading", "content"]
        }
      },
      relatedTerms: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["title", "visualPrompt", "sections", "relatedTerms"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create feature exhibit for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Provide comprehensive exploration of the topic'}
${objectiveContext}

Generate a deep-dive editorial section with multiple subsections.
${objectiveContext ? 'All sections must directly support the learning objective above.' : ''}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📰 Feature Exhibit Generated from dedicated service:', {
    topic,
    sectionCount: data.sections?.length || 0
  });

  return data as FeatureExhibitData;
};
