/**
 * Image Panel Generator - Dedicated service for AI-generated educational images
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ImagePanelData } from "../../types";
import { ai } from "../geminiClient";

/**
 * Generate a concept image using Gemini's image generation
 */
const generateConceptImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        role: 'user',
        parts: [{ text: `Generate an educational illustration for: ${prompt}. Style: Clean, educational, suitable for students. No text in the image.` }]
      }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      }
    });

    // Extract image from response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const base64Data = part.inlineData.data;
          return `data:${part.inlineData.mimeType};base64,${base64Data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error generating concept image:', error);
    return null;
  }
};

/**
 * Generate Image Panel content
 *
 * Creates metadata for an AI-generated image with title, description,
 * and the actual generated image.
 *
 * @param topic - The topic being visualized
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Image panel data with generated image URL
 */
export const generateImagePanel = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<ImagePanelData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the image panel" },
      description: { type: Type.STRING, description: "Brief description of what the image shows" },
      imagePrompt: {
        type: Type.STRING,
        description: "Detailed prompt for generating the image - be specific about style, content, perspective, and educational purpose"
      },
      category: {
        type: Type.STRING,
        enum: ["geography", "history", "science", "literature", "art", "general"],
        description: "Category that best fits the image content"
      }
    },
    required: ["title", "imagePrompt", "category"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create image panel metadata for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Provide visual representation of the topic'}

Generate metadata for an AI image generation request. The imagePrompt should be:
- Detailed and specific about what to visualize
- Educational and age-appropriate
- Clear about style (map, diagram, illustration, photograph-style, etc.)
- Include relevant context (historical period, geographic region, scientific accuracy)

Choose the most appropriate category based on the content.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const metadata = JSON.parse(response.text);

  // Generate the actual image using the prompt
  let imageUrl: string | null = null;
  try {
    imageUrl = await generateConceptImage(metadata.imagePrompt);
  } catch (error) {
    console.error("Failed to generate image:", error);
    // Continue without image - the component will handle the null case
  }

  console.log('🖼️ Image Panel Generated from dedicated service:', {
    topic,
    title: metadata.title,
    hasImage: !!imageUrl
  });

  return {
    title: metadata.title,
    description: metadata.description,
    imageUrl,
    imagePrompt: metadata.imagePrompt,
    category: metadata.category,
    attribution: 'Generated with Gemini AI'
  };
};
