import { GoogleGenAI, Type } from "@google/genai";
import { Flashcard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateFlashcards = async (topic: string): Promise<Flashcard[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a set of 15 high-quality, rapid-fire flashcards for the concept: "${topic}". 
      Focus on key terms, core concepts, functions, or specific details suitable for rote memorization. 
      Keep definitions concise (under 20 words) for rapid reading.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: {
                type: Type.STRING,
                description: "The concept, word, or question on the front of the card",
              },
              definition: {
                type: Type.STRING,
                description: "The concise answer or explanation on the back of the card",
              },
              category: {
                type: Type.STRING,
                description: "A short sub-category for this card (e.g., 'Bones', 'Organs')",
              },
            },
            required: ["term", "definition", "category"],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // Enrich with IDs
    return rawData.map((card: any) => ({
      ...card,
      id: crypto.randomUUID(),
    }));

  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to generate flashcards. Please try again.");
  }
};
