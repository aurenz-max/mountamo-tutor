import { CompareContrastData } from '../../primitives/visual-primitives/biology/CompareContrast';
import { generateCompareContrast, generateCompareContrastFromTopic } from './gemini-compare-contrast';
import { ai } from '../geminiClient';

/**
 * Generate an image using Gemini's image generation model
 */
const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
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
 * Generate compare & contrast data WITH generated images for both entities
 *
 * This extends the base generateCompareContrast by adding AI-generated images
 * for visual comparison alongside the attribute comparison.
 *
 * @param entityA - Name of first entity to compare
 * @param entityB - Name of second entity to compare
 * @param gradeBand - Grade level ('K-2', '3-5', or '6-8')
 * @param mode - Display mode ('side-by-side' or 'venn-interactive')
 * @param config - Optional partial configuration
 * @returns CompareContrastData with imageUrl fields populated
 */
export const generateCompareContrastWithImages = async (
  entityA: string,
  entityB: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  mode: 'side-by-side' | 'venn-interactive' = 'side-by-side',
  config?: Partial<CompareContrastData>
): Promise<CompareContrastData> => {

  // Step 1: Generate the base comparison data
  const comparisonData = await generateCompareContrast(
    entityA,
    entityB,
    gradeBand,
    mode,
    config
  );

  // Step 2: Generate images for both entities in parallel
  try {
    const [imageA, imageB] = await Promise.all([
      generateImage(comparisonData.entityA.imagePrompt),
      generateImage(comparisonData.entityB.imagePrompt)
    ]);

    // Add images to the comparison data
    comparisonData.entityA.imageUrl = imageA || undefined;
    comparisonData.entityB.imageUrl = imageB || undefined;

    console.log('🖼️ Compare & Contrast Images Generated:', {
      entityA: comparisonData.entityA.name,
      entityAImageGenerated: !!imageA,
      entityB: comparisonData.entityB.name,
      entityBImageGenerated: !!imageB,
    });

  } catch (error) {
    console.error('Error generating comparison images:', error);
    // Continue without images - component will fall back to text descriptions
  }

  return comparisonData;
};

/**
 * Generate a comparison with images from a topic string
 *
 * @param topic - Topic string containing both entities (e.g., "frog vs toad")
 * @param gradeBand - Grade level
 * @param mode - Display mode
 * @returns CompareContrastData with images
 */
export const generateCompareContrastWithImagesFromTopic = async (
  topic: string,
  gradeBand: 'K-2' | '3-5' | '6-8' = '3-5',
  mode: 'side-by-side' | 'venn-interactive' = 'side-by-side'
): Promise<CompareContrastData> => {
  // Parse topic to extract entities
  const parts = topic.split(/\s+(?:vs\.?|versus)\s+/i);

  if (parts.length !== 2) {
    throw new Error(`Topic "${topic}" must contain exactly two entities separated by "vs" or "versus"`);
  }

  const [entityA, entityB] = parts.map(s => s.trim());

  return generateCompareContrastWithImages(entityA, entityB, gradeBand, mode);
};
