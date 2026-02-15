/**
 * Math Visual Generator - Dedicated service for math visual exhibits
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This generates dynamic math visualizations based on visual type.
 */

import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

export type MathVisualType =
  | 'bar-model'
  | 'number-line'
  | 'fraction-circles'
  | 'base-ten-blocks'
;

export interface MathVisualData {
  title: string;
  description: string;
  visualType: MathVisualType;
  data: any;
}

/**
 * Generate Math Visual content
 *
 * Creates a math visualization based on the specified visual type.
 * Supports bar models, number lines, fraction circles, base-ten blocks, and geometric shapes.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Configuration including visualType, intent, and title
 * @returns Math visual data with type-specific content
 */
export const generateMathVisual = async (
  topic: string,
  gradeContext: string,
  config?: {
    visualType?: MathVisualType;
    intent?: string;
    title?: string;
  }
): Promise<MathVisualData> => {
  const visualType = config?.visualType || 'bar-model';

  // Create dynamic schema based on visual type
  const dataSchema: any = {
    type: Type.OBJECT,
    properties: {}
  };

  switch (visualType) {
    case 'bar-model':
      dataSchema.properties = {
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: "Label for this bar" },
              value: { type: Type.NUMBER, description: "Numeric value for the bar" },
              color: { type: Type.STRING, description: "Color for this bar" }
            },
            required: ["label", "value"]
          }
        }
      };
      break;

    case 'number-line':
      dataSchema.properties = {
        range: {
          type: Type.OBJECT,
          properties: {
            min: { type: Type.NUMBER, description: "Minimum value" },
            max: { type: Type.NUMBER, description: "Maximum value" }
          },
          required: ["min", "max"]
        },
        highlights: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.NUMBER, description: "Position on the number line" },
              label: { type: Type.STRING, description: "Label for this point" }
            },
            required: ["value", "label"]
          }
        }
      };
      break;

    case 'fraction-circles':
      dataSchema.properties = {
        fractions: {
          type: Type.ARRAY,
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
      };
      break;

    case 'base-ten-blocks':
      dataSchema.properties = {
        numberValue: { type: Type.NUMBER, description: "The number to represent with blocks" }
      };
      break;

    default:
      // Flexible schema for unknown types
      dataSchema.properties = {
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.NUMBER }
            }
          }
        }
      };
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the visual shows" },
      data: dataSchema
    },
    required: ["title", "description", "data"]
  };

  const prompt = `Create a ${visualType} visualization for educational purposes.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Exhibit Title: ${config?.title || `${visualType} Visualization`}
- Purpose: ${config?.intent || topic}
- Visual Type: ${visualType}

Generate appropriate data for this visualization type.

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain what the visualization demonstrates
3. Generate data that is educationally meaningful and appropriate for the grade level
4. Keep values reasonable and easy to understand

Return the complete visualization data structure.`;

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

  if (!response.text) throw new Error("No math visual data generated");
  const result = JSON.parse(response.text);

  console.log('📐 Math Visual Generated from dedicated service:', {
    topic,
    visualType
  });

  return {
    title: result.title,
    description: result.description,
    visualType: visualType,
    data: result.data
  };
};
