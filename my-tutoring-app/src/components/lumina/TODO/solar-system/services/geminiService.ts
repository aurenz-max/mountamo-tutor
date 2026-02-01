import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

// Initialize the API client
if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} else {
  console.warn("API_KEY is not defined in the environment. AI features will be disabled.");
}

export const getPlanetFact = async (planetName: string, gradeLevel: string = "3rd"): Promise<string> => {
  if (!ai) return "AI service is unavailable. Please check your API key.";

  try {
    const prompt = `Tell me 2 amazing and fun facts about ${planetName} that a ${gradeLevel} grader would love to know. Keep it short (under 60 words). Format as a simple list.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not retrieve facts at this time.";
  } catch (error) {
    console.error("Error fetching planet fact:", error);
    return "Failed to load space facts. Try again later!";
  }
};

export const chatWithPlanet = async (planetName: string, userMessage: string): Promise<string> => {
    if (!ai) return "AI service is unavailable.";
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `You are playing the role of the planet ${planetName} in a solar system explorer app for kids. Answer the following question from a student: "${userMessage}". Keep the answer friendly, educational, and relatively short (under 50 words).`,
        });
        return response.text || "I'm lost in space!";
    } catch (error) {
        console.error("Error chatting with planet:", error);
        return "Space interference! Try again.";
    }
}
