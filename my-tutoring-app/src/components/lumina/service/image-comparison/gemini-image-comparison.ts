import { ImageComparisonData } from '../../types';
import { ai } from '../geminiClient';
import { Type } from '@google/genai';

/**
 * Generate an image using Gemini's image generation model
 */
const generateImage = async (prompt: string, referenceImageBase64?: string): Promise<string | null> => {
  try {
    const parts: any[] = [];

    // If a reference image is provided, add it for image-to-image guidance
    if (referenceImageBase64) {
      const cleanBase64 = referenceImageBase64.includes('base64,')
        ? referenceImageBase64.split('base64,')[1]
        : referenceImageBase64;

      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64
        }
      });
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: '1:1' }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    return null;
  } catch (error) {
    console.error('Gemini Image Generation Error:', error);
    return null;
  }
};

/**
 * Generate before/after image comparison using Gemini AI
 * @param topic The main topic for the comparison
 * @param gradeContext The grade level context for appropriate difficulty
 * @param config Optional configuration for comparison generation
 * @returns ImageComparisonData with generated before/after images
 */
export async function generateImageComparison(
  topic: string,
  gradeContext: string,
  config?: {
    focusArea?: string;
    aspectRatio?: string;
  }
): Promise<ImageComparisonData> {
  const focusArea = config?.focusArea || '';

  // Step 1: Analyze the topic to determine the best before/after progression
  const analysisPrompt = `You are an expert visual educator. The user wants to visualize a 2-stage 'Before' and 'After' transformation for the topic: "${topic}"${focusArea ? ` (focus: ${focusArea})` : ''}.

Target audience: ${gradeContext}

Determine the most logical, educational, or narrative visual progression for this specific topic.
- If scientific (e.g., "Snell's Law"), show the process step-by-step (e.g., Light approaching -> Light refracting).
- If biological (e.g., "Mitochondria"), show context vs detail (e.g., Whole cell -> Zoomed into Mitochondria) or function (ADP inputs -> ATP creation).
- If historical/evolutionary, show the timeline.
- If abstract, show the concept forming.

Also provide a deep educational explanation of the phenomenon.

Return a JSON object with:
- beforePrompt: Detailed visual description for the first image. Include camera angle, lighting, and style (photorealistic, 3D render, or illustration).
- afterPrompt: Detailed visual description for the second image. MUST explicitly state to "Maintain the exact camera angle, lighting, and composition of the previous image" while applying the change.
- beforeLabel: A short label (1-3 words) for the 'Before' state (e.g., "Incident Ray", "Caterpillar", "Raw").
- afterLabel: A short label (1-3 words) for the 'After' state (e.g., "Refracted Ray", "Butterfly", "Cooked").
- description: A short, punchy 1-sentence summary of the transformation.
- detailedExplanation: A comprehensive paragraph (approx 3-4 sentences) explaining the scientific principles, historical context, or logic behind this phenomenon. Focus on the "Why" and "How".
- keyTakeaways: An array of 3 concise bullet points highlighting the most important facts or mechanisms at play.`;

  try {
    // First API call: Topic analysis
    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: analysisPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            beforePrompt: { type: Type.STRING },
            afterPrompt: { type: Type.STRING },
            beforeLabel: { type: Type.STRING },
            afterLabel: { type: Type.STRING },
            description: { type: Type.STRING },
            detailedExplanation: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['beforePrompt', 'afterPrompt', 'beforeLabel', 'afterLabel', 'description', 'detailedExplanation', 'keyTakeaways']
        }
      }
    });

    const analysisText = analysisResponse.text;
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    const analysis = JSON.parse(analysisText);
    const {
      beforePrompt,
      afterPrompt,
      beforeLabel,
      afterLabel,
      description,
      detailedExplanation,
      keyTakeaways
    } = analysis;

    // Step 2: Generate 'Before' image
    const beforeImage = await generateImage(beforePrompt);

    if (!beforeImage) {
      throw new Error('Failed to generate before image');
    }

    // Step 3: Generate 'After' image using 'Before' as reference
    const strictAfterPrompt = `${afterPrompt} CRITICAL: You MUST use the provided reference image to maintain the exact same camera angle, focal length, and composition. Only modify the specific elements mentioned.`;

    const afterImage = await generateImage(strictAfterPrompt, beforeImage);

    if (!afterImage) {
      throw new Error('Failed to generate after image');
    }

    return {
      title: `${topic} - Visual Transformation`,
      description: description || `Visualizing the transformation of ${topic}`,
      beforeImage,
      afterImage,
      beforeLabel: beforeLabel || 'Before',
      afterLabel: afterLabel || 'After',
      detailedExplanation: detailedExplanation || '',
      keyTakeaways: keyTakeaways || []
    };
  } catch (error) {
    console.error('Error generating image comparison:', error);

    // Return a minimal fallback with placeholder
    return {
      title: `${topic} - Comparison`,
      description: `Visual comparison for ${topic}`,
      beforeImage: '', // Empty - component will show "no images" state
      afterImage: '',
      beforeLabel: 'Before',
      afterLabel: 'After',
      detailedExplanation: 'Image generation is currently unavailable. Please try again later.',
      keyTakeaways: []
    };
  }
}
