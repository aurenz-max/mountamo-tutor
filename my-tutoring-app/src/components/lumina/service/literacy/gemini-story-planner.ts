import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { StoryPlannerData } from "../../primitives/visual-primitives/literacy/StoryPlanner";

const storyPlannerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the story planning activity" },
    gradeLevel: { type: Type.STRING },
    writingPrompt: { type: Type.STRING, description: "Narrative writing prompt" },
    elements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          elementId: { type: Type.STRING },
          label: { type: Type.STRING, description: "Element name: Character, Setting, Problem, Solution, Theme, etc." },
          prompt: { type: Type.STRING, description: "Student-facing question/prompt for this element" },
          required: { type: Type.BOOLEAN },
        },
        required: ["elementId", "label", "prompt", "required"]
      }
    },
    storyArcLabels: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Labels for the story arc phases" },
    conflictTypes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Conflict type options for grades 4+" },
    dialoguePrompt: { type: Type.STRING, description: "Dialogue writing guidance for grades 3+" },
  },
  required: ["title", "gradeLevel", "writingPrompt", "elements", "storyArcLabels"]
};

export const generateStoryPlanner = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<StoryPlannerData>
): Promise<StoryPlannerData> => {
  const gradeLevelKey = ['K', '1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  const gradeNotes: Record<string, string> = {
    'K': 'K: 2 elements (Character, What Happened). 2-arc (Beginning, End). No conflict types. No dialogue.',
    '1': 'Grade 1: 3 elements (Character, Setting, What Happened). 3-arc (Beginning, Middle, End). No conflict types.',
    '2': 'Grade 2: 4 elements (Character, Setting, Problem, Solution). 3-arc. Use temporal words (first, then, finally).',
    '3': 'Grade 3: 5 elements (Character, Setting, Problem, Events, Solution). 5-arc. Include dialoguePrompt. Descriptive setting.',
    '4': 'Grade 4: 5-6 elements including Motivation. 5-arc with Rising Action detail. Include conflictTypes (internal, external). Sensory details.',
    '5': 'Grade 5: 6 elements including Relationships, Theme. 5-arc. Multiple character support. Subplot awareness.',
    '6': 'Grade 6: 6-7 elements including Conflict Type, Perspective, Foreshadowing. 5-arc. Complex conflict types (person vs self, person vs society, person vs nature).',
  };

  const prompt = `Create a narrative story planning activity about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

Generate:
1. An engaging narrative writing prompt related to the topic
2. Planning elements (cards) with student-friendly prompts — mark required elements
3. Story arc labels appropriate for the grade level
4. ${parseInt(gradeLevelKey) >= 4 ? 'Include 3-4 conflictTypes' : 'No conflictTypes needed'}
5. ${parseInt(gradeLevelKey) >= 3 ? 'Include a dialoguePrompt' : 'No dialoguePrompt needed'}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: storyPlannerSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in narrative writing. You create age-appropriate story planning scaffolds that guide students through the creative writing process. Your prompts are imaginative and inspire student creativity while teaching narrative structure.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as StoryPlannerData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating story planner:", error);
    throw error;
  }
};
