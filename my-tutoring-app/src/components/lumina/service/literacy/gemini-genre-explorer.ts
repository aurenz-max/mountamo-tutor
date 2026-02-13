import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { GenreExplorerData } from "../../primitives/visual-primitives/literacy/GenreExplorer";

const genreExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    excerpts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          excerptId: { type: Type.STRING },
          text: { type: Type.STRING, description: "Short text excerpt (4-8 sentences)" },
          genre: { type: Type.STRING, description: "Correct genre classification" },
          features: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                featureId: { type: Type.STRING },
                label: { type: Type.STRING, description: "Feature question e.g. 'Has characters'" },
                present: { type: Type.BOOLEAN },
              },
              required: ["featureId", "label", "present"]
            }
          },
        },
        required: ["excerptId", "text", "genre", "features"]
      }
    },
    genreOptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4-6 genre options including correct ones" },
    comparisonEnabled: { type: Type.BOOLEAN },
  },
  required: ["title", "gradeLevel", "excerpts", "genreOptions", "comparisonEnabled"]
};

export const generateGenreExplorer = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<GenreExplorerData>
): Promise<GenreExplorerData> => {
  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  const gradeNotes: Record<string, string> = {
    '1': 'Grade 1: Fiction vs nonfiction. 1 excerpt. 4-5 simple features (Has characters? Has real facts? Is make-believe?). 3 genre options.',
    '2': 'Grade 2: Fiction, nonfiction, poetry. 1-2 excerpts. 5-6 features. 4 genre options.',
    '3': 'Grade 3: Folktales, fables, myths, informational. 2 excerpts for comparison. 6 features. 5 genre options.',
    '4': 'Grade 4: Biography, autobiography, historical fiction, nonfiction. 2 excerpts. 6-7 features. 5-6 genre options.',
    '5': 'Grade 5: Persuasive vs informational. Drama. 2 excerpts. 7 features. 5-6 genre options. Enable comparison.',
    '6': 'Grade 6: Satire, allegory, memoir. Genre blending. 2 excerpts. 7-8 features. 6 genre options. Enable comparison.',
  };

  const excerptCount = parseInt(gradeLevelKey) >= 3 ? 2 : 1;
  const comparison = parseInt(gradeLevelKey) >= 3;

  const prompt = `Create a genre classification activity about: "${topic}".
GRADE: ${gradeLevelKey}. EXCERPTS: ${excerptCount}. COMPARISON: ${comparison}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

Rules:
1. Write ${excerptCount} short excerpt(s) in DIFFERENT genres about the same topic
2. Each excerpt has a feature checklist — mark which features are actually present (true/false)
3. genreOptions includes the correct genres plus 2-3 plausible distractors
4. Features should be yes/no questions about text characteristics
5. comparisonEnabled: ${comparison}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: genreExplorerSchema,
        systemInstruction: 'You are an expert K-6 reading teacher specializing in genre analysis and text classification. You create clear, genre-typical excerpts that showcase distinguishing features. Feature checklists help students systematically identify genre characteristics.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as GenreExplorerData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating genre explorer:", error);
    throw error;
  }
};
