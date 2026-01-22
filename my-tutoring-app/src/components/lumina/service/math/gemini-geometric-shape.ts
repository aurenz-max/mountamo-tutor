/**
 * Geometric Shape Generator - Dedicated service for shape visualizations
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface ShapeAttribute {
  label: string;
  value: string;
}

export interface GeometricShapeData {
  title: string;
  description: string;
  shapeName: string;
  attributes: ShapeAttribute[];
}

/**
 * Generate Geometric Shape content
 *
 * Creates a geometric shape visualization for elementary math education,
 * helping students understand shape properties and attributes.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Geometric shape data with attributes
 */
export const generateGeometricShape = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<GeometricShapeData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the geometric shape visualization" },
      description: { type: Type.STRING, description: "Brief explanation of what the shape demonstrates" },
      shapeName: {
        type: Type.STRING,
        description: "Name of the shape (e.g., 'triangle', 'square', 'circle', 'rectangle', 'pentagon')"
      },
      attributes: {
        type: Type.ARRAY,
        description: "Key attributes and properties of the shape",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "Attribute name (e.g., 'Sides', 'Angles', 'Area')" },
            value: { type: Type.STRING, description: "Value or description of this attribute" }
          },
          required: ["label", "value"]
        }
      }
    },
    required: ["title", "description", "shapeName", "attributes"]
  };

  const prompt = `You are generating a Geometric Shape visualization for elementary math education.

CONTEXT:
- Topic: ${topic}
- Target Audience: ${gradeContext}
- Intent: ${config?.intent || topic}

Generate a geometric shape visualization that helps students understand properties and attributes.

REQUIREMENTS:
1. Title should be engaging and age-appropriate
2. Description should explain the shape and its significance
3. Choose a shape relevant to the topic
4. Include 3-5 key attributes of the shape
5. Attributes should be appropriate for the grade level
6. Make connections to real-world examples when possible

Return the complete geometric shape data structure.`;

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

  console.log('🔷 Geometric Shape Generated from dedicated service:', {
    topic,
    shapeName: data.shapeName,
    attributeCount: data.attributes?.length || 0
  });

  return data as GeometricShapeData;
};
