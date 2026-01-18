import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeScratchpad(imageBase64: string): Promise<string> {
  // Remove the data URL prefix if present to get just the base64 string
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
        ],
      },
      config: {
        systemInstruction: `You are an expert AI tutor observing a student's whiteboard. 
            Analyze the visible handwriting, diagrams, and calculations.
            
            Provide a response in the following JSON structure:
            {
              "summary": "A brief 1-2 sentence summary of what is written or drawn.",
              "latex": "The mathematical content converted to LaTeX format (if applicable, otherwise null).",
              "feedback": "Constructive feedback. If they are solving a problem, check their steps. If correct, encourage them. If there is a mistake, provide a helpful hint without giving the answer immediately. If it's just drawing, comment on the creativity.",
              "nextSteps": ["Step 1", "Step 2", "Step 3"]
            }
            
            "nextSteps" should be an array of 1 to 3 short, specific, and actionable suggestions for what the student should do next to solve the problem or improve the drawing.
            Ensure the tone is encouraging, educational, and helpful.`,
        responseMimeType: "application/json",
      }
    });

    return response.text || "{}";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}