import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { FigurativeLanguageFinderData, FigurativeType } from "../../primitives/visual-primitives/literacy/FigurativeLanguageFinder";

const figurativeLanguageFinderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the figurative language activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('3' through '6')" },
    passage: { type: Type.STRING, description: "Rich passage with embedded figurative language (6-12 sentences)" },
    instances: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          instanceId: { type: Type.STRING },
          text: { type: Type.STRING, description: "The figurative phrase as it appears in the passage" },
          startIndex: { type: Type.NUMBER, description: "Character offset where the phrase starts in the passage" },
          endIndex: { type: Type.NUMBER, description: "Character offset where the phrase ends in the passage" },
          type: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] },
          literalMeaning: { type: Type.STRING, description: "What the phrase literally means" },
          explanation: { type: Type.STRING, description: "Why this is classified as this type" },
        },
        required: ["instanceId", "text", "startIndex", "endIndex", "type", "literalMeaning", "explanation"]
      }
    },
    translateInstanceIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 instance IDs that students must write literal translations for" },
    availableTypes: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] } },
  },
  required: ["title", "gradeLevel", "passage", "instances", "translateInstanceIds", "availableTypes"]
};

export const generateFigurativeLanguageFinder = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<FigurativeLanguageFinderData>
): Promise<FigurativeLanguageFinderData> => {
  const gradeLevelKey = ['3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  const gradeNotes: Record<string, string> = {
    '3': 'Grade 3: Focus on SIMILE (like/as) and ALLITERATION only. 3-4 instances. Simple passage. "What does it REALLY mean?" focus.',
    '4': 'Grade 4: Simile, METAPHOR, PERSONIFICATION, HYPERBOLE. 4-5 instances. Teach simile vs metaphor distinction.',
    '5': 'Grade 5: Add IDIOM, IMAGERY, ONOMATOPOEIA. 5-6 instances. Sensory language emphasis.',
    '6': 'Grade 6: All 8 types. Extended metaphor. How figurative language creates tone/mood. 5-7 instances.',
  };

  const typesByGrade: Record<string, FigurativeType[]> = {
    '3': ['simile', 'alliteration'],
    '4': ['simile', 'metaphor', 'personification', 'hyperbole'],
    '5': ['simile', 'metaphor', 'personification', 'hyperbole', 'idiom', 'imagery', 'onomatopoeia'],
    '6': ['simile', 'metaphor', 'personification', 'hyperbole', 'idiom', 'alliteration', 'onomatopoeia', 'imagery'],
  };

  const availableTypes = typesByGrade[gradeLevelKey] || typesByGrade['4'];

  const prompt = `Create a figurative language identification activity about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

AVAILABLE TYPES for this grade: ${availableTypes.join(', ')}

Rules:
1. Write a passage that naturally embeds figurative language instances
2. Mark EXACT startIndex and endIndex character offsets for each instance in the passage string
3. Each instance must have a clear literal meaning and explanation
4. translateInstanceIds: pick 2-3 of the most interesting instances for literal translation
5. availableTypes: include all types available at this grade (even if not all used in the passage)
6. CRITICAL: Double-check character offsets! The text between startIndex and endIndex must match the "text" field exactly`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: figurativeLanguageFinderSchema,
        systemInstruction: 'You are an expert K-6 language arts instructor specializing in figurative language and literary devices. You create engaging passages rich in figurative language with clear, age-appropriate examples. You are meticulous about character offsets — count every character including spaces and punctuation. Literal meanings are written in student-friendly language.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as FigurativeLanguageFinderData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating figurative language finder:", error);
    throw error;
  }
};
