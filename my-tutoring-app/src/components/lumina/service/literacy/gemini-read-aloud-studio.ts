import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { ReadAloudStudioData } from "../../primitives/visual-primitives/literacy/ReadAloudStudio";

const readAloudStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the fluency practice activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('1' through '6')" },
    passage: { type: Type.STRING, description: "Reading passage appropriate for fluency practice" },
    passageWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Each word of the passage as separate strings" },
    targetWPM: { type: Type.NUMBER, description: "Target words per minute for this grade level" },
    lexileLevel: { type: Type.STRING, description: "Approximate Lexile level e.g. '520L'" },
    expressionMarkers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["pause", "emphasis", "question", "exclamation", "slow"] },
          wordIndex: { type: Type.NUMBER, description: "Index into the passageWords array" },
          label: { type: Type.STRING },
        },
        required: ["type", "wordIndex", "label"]
      }
    },
    comprehensionQuestion: { type: Type.STRING, description: "Optional post-reading comprehension question" },
    comprehensionAnswer: { type: Type.STRING, description: "Answer to the comprehension question" },
  },
  required: ["title", "gradeLevel", "passage", "passageWords", "targetWPM", "lexileLevel", "expressionMarkers"]
};

export const generateReadAloudStudio = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<ReadAloudStudioData>
): Promise<ReadAloudStudioData> => {
  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  const gradeNotes: Record<string, string> = {
    '1': 'Grade 1: 30-50 words. Simple sentences. Sight words. Target 60-80 WPM. Lexile ~200L. 2-3 expression markers.',
    '2': 'Grade 2: 50-80 words. Short paragraph. Punctuation variety. Target 80-100 WPM. Lexile ~400L. 3-4 markers.',
    '3': 'Grade 3: 80-120 words. Questions and exclamations. Target 80-100 WPM. Lexile ~520L. 4-5 markers.',
    '4': 'Grade 4: 100-150 words. Mixed text types. Target 100-120 WPM. Lexile ~700L. 5-6 markers.',
    '5': 'Grade 5: 120-180 words. Dialogue with character voices. Target 120-140 WPM. Lexile ~850L. 5-7 markers.',
    '6': 'Grade 6: 150-200 words. Genre-appropriate tone. Target 140-160 WPM. Lexile ~950L. 6-8 markers.',
  };

  const wpmTargets: Record<string, number> = { '1': 70, '2': 90, '3': 90, '4': 110, '5': 130, '6': 150 };

  const prompt = `Create a fluency reading practice passage about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

Rules:
1. Write an engaging passage at the specified reading level
2. passageWords: split the passage into individual words (split on spaces)
3. expressionMarkers: mark words where expression/prosody changes (pauses at commas/periods, emphasis on important words, question intonation)
4. wordIndex values must be valid indices into the passageWords array
5. Include a comprehension question and answer
6. targetWPM should be ${wpmTargets[gradeLevelKey] || 90}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: readAloudStudioSchema,
        systemInstruction: 'You are an expert K-6 reading fluency instructor. You create engaging, grade-appropriate passages for oral reading practice. You mark expression points (pauses, emphasis, intonation changes) to help students read with prosody. Passages have natural rhythm and varied sentence structures.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as ReadAloudStudioData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating read aloud studio:", error);
    throw error;
  }
};
