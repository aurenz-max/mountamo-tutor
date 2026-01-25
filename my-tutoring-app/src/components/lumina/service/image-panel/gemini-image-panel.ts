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
    interactionMode?: 'view' | 'identify';
  }
): Promise<ImagePanelData> => {
  const interactionMode = config?.interactionMode || 'view';

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title for the image panel" },
      description: { type: Type.STRING, description: "Brief description of what the image shows" },
      imagePrompt: {
        type: Type.STRING,
        description: "Detailed prompt for generating the image - be specific about style, content, perspective, and educational purpose. Ensure the image will have clear, identifiable features for annotation."
      },
      category: {
        type: Type.STRING,
        enum: ["geography", "history", "science", "literature", "art", "general"],
        description: "Category that best fits the image content"
      },
      learningObjective: {
        type: Type.STRING,
        description: "Clear learning objective for this visualization (e.g., 'Identify key anatomical features of...')"
      },
      annotations: {
        type: Type.ARRAY,
        description: "List of 4-6 distinct visual features that should be identifiable in the image",
        items: {
          type: Type.OBJECT,
          properties: {
            label: {
              type: Type.STRING,
              description: "Short label for the feature (2-5 words)"
            },
            description: {
              type: Type.STRING,
              description: "Educational description explaining what this feature is and why it matters"
            },
            category: {
              type: Type.STRING,
              description: "Category/type of this feature (e.g., 'Body Structure', 'Geographic Region', 'Organelle')"
            },
            isKey: {
              type: Type.BOOLEAN,
              description: "Whether this is a key/essential feature for the learning objective"
            }
          },
          required: ["label", "description", "category", "isKey"]
        }
      }
    },
    required: ["title", "imagePrompt", "category", "learningObjective", "annotations"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: `Create a visual learning lesson plan for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Provide visual representation of the topic'}
INTERACTION MODE: ${interactionMode === 'identify' ? 'Students will identify and label features' : 'Display only'}

Generate complete lesson data including:

1. **Title and Description**: Clear, engaging title and brief description
2. **Learning Objective**: What students should understand or be able to identify
3. **Image Prompt**: Detailed prompt for AI image generation that will result in a clear, diagrammatic or photorealistic image with distinct, identifiable features. The image should have:
   - Clear background (not cluttered)
   - Distinct, visible features that can be labeled
   - Appropriate educational style (diagram, cross-section, map, etc.)
   - Sufficient detail for annotation
4. **Annotations**: List of 4-6 distinct visual features/elements that should be identifiable in the generated image. Each annotation should:
   - Have a clear, specific label (e.g., "Magma Chamber", "Left Ventricle", "Cell Wall")
   - Include an educational description explaining what it is and its significance
   - Be categorized by type (e.g., "Internal Structure", "Organelle", "Body Part")
   - Be marked as key (isKey: true) if it's essential to the learning objective

The annotations must correspond to features that WILL appear in the image generated from your imagePrompt.

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

  // Convert annotations to include generated IDs
  const annotations = metadata.annotations?.map((ann: any, index: number) => ({
    id: `annotation-${index + 1}`,
    label: ann.label,
    description: ann.description,
    category: ann.category,
    isKey: ann.isKey,
  })) || [];

  console.log('🖼️ Image Panel Generated from dedicated service:', {
    topic,
    title: metadata.title,
    hasImage: !!imageUrl,
    annotationCount: annotations.length,
    interactionMode
  });

  return {
    title: metadata.title,
    description: metadata.description,
    imageUrl,
    imagePrompt: metadata.imagePrompt,
    category: metadata.category,
    learningObjective: metadata.learningObjective,
    annotations: annotations.length > 0 ? annotations : undefined,
    interactionMode: interactionMode,
    attribution: 'Generated with Gemini AI'
  };
};
