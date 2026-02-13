import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { CharacterWebData } from "../../primitives/visual-primitives/literacy/CharacterWeb";

const characterWebSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the character analysis activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '6')" },
    storyContext: { type: Type.STRING, description: "Brief story summary (3-5 sentences) for student reference" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          characterId: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING, description: "Brief context about the character (1-2 sentences)" },
          suggestedTraits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 character traits students should identify" },
          traitEvidence: {
            type: Type.OBJECT,
            description: "Map of trait name -> text evidence quote from the story. Keys are trait names, values are evidence strings.",
            properties: {},
          },
        },
        required: ["characterId", "name", "description", "suggestedTraits", "traitEvidence"]
      }
    },
    relationships: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fromCharacterId: { type: Type.STRING },
          toCharacterId: { type: Type.STRING },
          relationshipType: { type: Type.STRING, description: "friend, rival, family, mentor, enemy, or ally" },
          description: { type: Type.STRING, description: "How they relate to each other" },
        },
        required: ["fromCharacterId", "toCharacterId", "relationshipType", "description"]
      }
    },
    changePrompt: { type: Type.STRING, description: "Question about how the main character changed" },
    changeCharacterId: { type: Type.STRING, description: "Character ID the change question refers to" },
    expectedChange: { type: Type.STRING, description: "Model answer describing the character's change" },
  },
  required: ["title", "gradeLevel", "storyContext", "characters", "relationships", "changePrompt", "changeCharacterId", "expectedChange"]
};

export const generateCharacterWeb = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<CharacterWebData>
): Promise<CharacterWebData> => {
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: 1-2 characters. 2-3 simple traits per character (kind, brave, funny). Simple evidence quotes. 1 relationship. Change = simple behavior change.',
    '3': 'Grade 3: 2 characters for comparison. 3 traits each with evidence. 1-2 relationships. How a character changes from beginning to end.',
    '4': 'Grade 4: 2-3 characters. Internal vs external traits. Motivations. 2-3 relationships. Character development arc.',
    '5': 'Grade 5: 2-3 characters including a foil. Deeper motivation analysis. Character growth/decline. Thematic connections.',
    '6': 'Grade 6: 2-3 complex characters. Multi-layered motivations. Character as symbol. Sophisticated analysis expected.',
  };

  const characterCount = parseInt(gradeLevelKey) <= 3 ? 2 : 3;

  const prompt = `Create a character analysis activity about: "${topic}".
GRADE: ${gradeLevelKey}. CHARACTERS: ${characterCount}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

Generate:
1. A brief story summary related to the topic with interesting characters
2. ${characterCount} character profiles with traits and text evidence
3. Relationships between characters (${characterCount === 2 ? '1' : '2-3'} relationships)
4. A character change question targeting the main character
5. traitEvidence should map each suggestedTrait to a quote from the story context`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: characterWebSchema,
        systemInstruction: 'You are an expert K-6 reading teacher specializing in character analysis and literary response. You create rich, relatable characters with clear traits supported by textual evidence. Your story contexts are engaging and age-appropriate. Character relationships are realistic and varied.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as CharacterWebData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating character web:", error);
    throw error;
  }
};
