/**
 * Concept Card Grid Generator - Dedicated service for concept card generation
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ConceptCardData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Helper to get objective context for focused content generation
 */
const getObjectiveContext = (item: any): string => {
  if (item.config?.objectiveText) {
    return `\n\n🎯 LEARNING OBJECTIVE: "${item.config.objectiveText}"
The generated content MUST directly support achieving this specific learning objective.
Every element should help the student ${item.config.objectiveVerb || 'understand'} the concept.`;
  }
  return '';
};

/**
 * Generate Concept Cards content
 *
 * Creates a grid of concept cards with definitions, visual prompts,
 * and pedagogical elements appropriate for the target audience.
 *
 * @param topic - The topic being taught
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including itemCount and objective info
 * @returns Array of concept cards with structured educational content
 */
export const generateConceptCards = async (
  topic: string,
  gradeContext: string,
  config?: {
    itemCount?: number;
    intent?: string;
    objectiveText?: string;
    objectiveVerb?: string;
  }
): Promise<{ cards: ConceptCardData[] }> => {
  const itemCount = config?.itemCount || 3;
  const objectiveContext = config?.objectiveText
    ? `\n\n🎯 LEARNING OBJECTIVE: "${config.objectiveText}"
The generated content MUST directly support achieving this specific learning objective.
Every element should help the student ${config.objectiveVerb || 'understand'} the concept.`
    : '';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      cards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subheading: { type: Type.STRING },
            definition: { type: Type.STRING },
            originStory: { type: Type.STRING },
            conceptElements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['primary', 'secondary', 'highlight'] }
                }
              }
            },
            timelineContext: { type: Type.STRING },
            curiosityNote: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            themeColor: { type: Type.STRING }
          },
          required: ["title", "subheading", "definition", "conceptElements", "timelineContext", "originStory", "curiosityNote", "visualPrompt", "themeColor"]
        }
      }
    },
    required: ["cards"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create ${itemCount} concept cards for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Introduce and explain key concepts'}
${objectiveContext}

Generate ${itemCount} key concepts with definitions, visual prompts, and pedagogical elements.
${objectiveContext ? 'Focus on concepts that directly support the learning objective above.' : ''}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('📇 Concept Cards Generated from dedicated service:', {
    topic,
    cardCount: data.cards?.length || 0
  });

  return { cards: data.cards };
};
