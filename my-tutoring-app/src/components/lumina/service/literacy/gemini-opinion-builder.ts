import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { OpinionBuilderData } from "../../primitives/visual-primitives/literacy/OpinionBuilder";

const opinionBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the opinion/argument writing activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '6')" },
    framework: { type: Type.STRING, enum: ["oreo", "cer"], description: "OREO for grades 2-4, CER for grades 5-6" },
    prompt: { type: Type.STRING, description: "The opinion/argument writing prompt" },
    scaffold: {
      type: Type.OBJECT,
      properties: {
        claimLabel: { type: Type.STRING, description: "'Opinion' for OREO, 'Claim' for CER" },
        claimStarters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 sentence starters for the claim" },
        reasonLabel: { type: Type.STRING, description: "'Reasons' for OREO, 'Evidence' for CER" },
        reasonStarters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 sentence starters for reasons/evidence" },
        reasonCount: { type: Type.NUMBER, description: "Number of reasons required (2-3)" },
        conclusionLabel: { type: Type.STRING, description: "'Restate Opinion' or 'Conclusion'" },
        conclusionStarters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 sentence starters for conclusion" },
        linkingWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "8-12 linking/transition words" },
        counterArgumentEnabled: { type: Type.BOOLEAN, description: "true for grades 5-6" },
        counterArgumentStarters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 starters for counter-argument (grades 5-6)" },
      },
      required: ["claimLabel", "claimStarters", "reasonLabel", "reasonStarters", "reasonCount", "conclusionLabel", "conclusionStarters", "linkingWords", "counterArgumentEnabled"]
    }
  },
  required: ["title", "gradeLevel", "framework", "prompt", "scaffold"]
};

export const generateOpinionBuilder = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<OpinionBuilderData>
): Promise<OpinionBuilderData> => {
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';
  const useOREO = parseInt(gradeLevelKey) <= 4;
  const fw = useOREO ? 'oreo' : 'cer';
  const reasonCount = parseInt(gradeLevelKey) <= 2 ? 2 : 3;
  const counterEnabled = parseInt(gradeLevelKey) >= 5;

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: "I think ___ because ___." 1 opinion + 2 simple reasons. Very simple starters. No counter-argument.',
    '3': 'Grade 3: Opinion + 2-3 reasons + examples. Linking words: because, therefore, for instance. No counter-argument.',
    '4': 'Grade 4: Full OREO. 3 reasons ranked by strength. Concluding statement. More sophisticated starters.',
    '5': 'Grade 5: CER framework. Evidence from texts. Counter-argument + rebuttal. Academic linking words.',
    '6': 'Grade 6: Full argument. Counter-argument + rebuttal. Source citation language. Formal register.',
  };

  const prompt = `Create an opinion/argument writing scaffold about: "${topic}".
GRADE: ${gradeLevelKey}. FRAMEWORK: ${fw}. REASONS REQUIRED: ${reasonCount}. COUNTER-ARGUMENT: ${counterEnabled}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

Generate:
1. An engaging, debatable prompt appropriate for grade ${gradeLevelKey}
2. Scaffold with claim/reason/conclusion starters, linking words
3. ${counterEnabled ? 'Include counter-argument starters' : 'No counter-argument needed'}
4. Linking words should be age-appropriate (8-12 words)
5. Starters should be partial sentences students complete`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: opinionBuilderSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in opinion and argumentative writing. You create age-appropriate scaffolds using OREO (grades 2-4) and CER (grades 5-6) frameworks. Your prompts are debatable and engaging. Your sentence starters provide just enough support without doing the thinking for students.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as OpinionBuilderData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating opinion builder:", error);
    throw error;
  }
};
