import { GoogleGenAI, Type, Modality } from "@google/genai";
import { LessonSegment, ImageResolution } from "../types";
import { decodeBase64, decodeAudioData, getAudioContext } from "../utils/audioUtils";

// Initialize the API client. 
// We create a function to get the client because the key might change or be set later.
const getAiClient = () => {
  // @ts-ignore - Process.env.API_KEY is injected by the environment
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Step 1: Generate the textual lesson plan (JSON)
 */
export const generateLessonPlan = async (topic: string): Promise<LessonSegment[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Create a 4-part educational walkthrough about the following topic: "${topic}".
    The audience is a curious adult learner.
    
    For each part, provide:
    1. A short, catchy title.
    2. A clear, engaging explanation script (approx 2-3 sentences, intended to be spoken).
    3. A detailed visual description prompt for an image generation model that illustrates the concept clearly (photorealistic or diagrammatic as appropriate).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            script: { type: Type.STRING },
            imagePrompt: { type: Type.STRING }
          },
          required: ["title", "script", "imagePrompt"],
          propertyOrdering: ["title", "script", "imagePrompt"]
        }
      }
    }
  });

  const jsonText = response.text;
  if (!jsonText) throw new Error("No text returned for lesson plan");
  
  try {
    return JSON.parse(jsonText) as LessonSegment[];
  } catch (e) {
    console.error("Failed to parse lesson plan JSON", e);
    throw new Error("Failed to parse lesson plan");
  }
};

/**
 * Step 2: Generate Audio (TTS) for a specific script
 */
export const generateAudioSegment = async (text: string): Promise<AudioBuffer> => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, engaging voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("No audio data returned");
  }

  const audioContext = getAudioContext();
  const rawBytes = decodeBase64(base64Audio);
  return await decodeAudioData(rawBytes, audioContext);
};

/**
 * Step 3: Generate Image for a specific prompt
 */
export const generateImageSegment = async (prompt: string, resolution: ImageResolution): Promise<string> => {
  const ai = getAiClient();
  
  // Convert resolution enum to string required by API config if needed, 
  // currently API accepts "1K", "2K", "4K" directly which matches our type.
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: {
      parts: [
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: resolution
      }
    }
  });

  // Iterate parts to find the image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64String = part.inlineData.data;
      return `data:image/png;base64,${base64String}`;
    }
  }

  throw new Error("No image generated found in response");
};