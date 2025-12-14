import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
const TEXT_MODEL_NAME = 'gemini-2.5-flash';

interface TopicAnalysis {
  beforePrompt: string;
  afterPrompt: string;
  beforeLabel: string;
  afterLabel: string;
  description: string;
  detailedExplanation: string;
  keyTakeaways: string[];
}

/**
 * Analyzes the topic to determine a logical "Before" and "After" progression.
 * Uses a lightweight text model to generate specific prompts.
 */
const analyzeTopic = async (topic: string): Promise<TopicAnalysis> => {
  try {
    const prompt = `
      You are an expert visual educator. The user wants to visualize a 2-stage 'Before' and 'After' transformation for the topic: "${topic}".
      
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
      - keyTakeaways: An array of 3 concise bullet points highlighting the most important facts or mechanisms at play.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
          required: ["beforePrompt", "afterPrompt", "beforeLabel", "afterLabel", "description", "detailedExplanation", "keyTakeaways"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No analysis generated");
    
    return JSON.parse(text) as TopicAnalysis;
  } catch (error) {
    console.error("Topic Analysis Error:", error);
    // Fallback if analysis fails
    return {
      beforePrompt: `A high quality, educational image representing ${topic} in its initial state.`,
      afterPrompt: `A high quality, educational image representing ${topic} in its final or transformed state. Maintain same composition.`,
      beforeLabel: "Before",
      afterLabel: "After",
      description: "Visualizing the transformation of " + topic,
      detailedExplanation: "We were unable to generate a detailed explanation for this specific topic, but the visual comparison shows the transition between the initial and final states.",
      keyTakeaways: ["Transformation Visualization", "Before & After", "Concept Exploration"]
    };
  }
};

/**
 * Generates an image based on a prompt using Gemini.
 */
const generateImage = async (prompt: string, referenceImageBase64?: string): Promise<string> => {
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
      model: IMAGE_MODEL_NAME,
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Gemini Image Generation Error:", error);
    throw new Error(error.message || "Failed to generate image");
  }
};

/**
 * Orchestrates the generation process:
 * 1. Analyze topic to get specific prompts and logic.
 * 2. Generate 'Before' image.
 * 3. Generate 'After' image using 'Before' as reference.
 */
export const generateBeforeAfterImages = async (
  topic: string,
  onStatusUpdate?: (status: 'analyzing' | 'generating_before' | 'generating_after') => void
): Promise<{ before: string; after: string; beforeLabel: string; afterLabel: string; description: string; detailedExplanation: string; keyTakeaways: string[] }> => {
  
  if (onStatusUpdate) onStatusUpdate('analyzing');
  
  // 1. Analyze
  const analysis = await analyzeTopic(topic);
  
  // 2. Generate 'Before'
  if (onStatusUpdate) onStatusUpdate('generating_before');
  const beforeImage = await generateImage(analysis.beforePrompt);

  // 3. Generate 'After' using 'Before' as reference
  if (onStatusUpdate) onStatusUpdate('generating_after');
  
  // We append a strict instruction to the prompt to ensure the reference image is respected
  const strictAfterPrompt = `${analysis.afterPrompt} CRITICAL: You MUST use the provided image as a strict structural reference. Keep the exact same camera angle, focal length, and composition. Only modify the specific elements mentioned.`;
  
  const afterImage = await generateImage(strictAfterPrompt, beforeImage);

  return { 
    before: beforeImage, 
    after: afterImage,
    beforeLabel: analysis.beforeLabel,
    afterLabel: analysis.afterLabel,
    description: analysis.description,
    detailedExplanation: analysis.detailedExplanation,
    keyTakeaways: analysis.keyTakeaways
  };
};
