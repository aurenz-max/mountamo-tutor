import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { RevisionWorkshopData, RevisionSkill } from "../../primitives/visual-primitives/literacy/RevisionWorkshop";

const revisionWorkshopSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    revisionSkill: { type: Type.STRING, enum: ["add-details", "word-choice", "combine-sentences", "transitions", "reorganize", "concision"] },
    draft: { type: Type.STRING, description: "Draft passage with intentional weaknesses (4-10 sentences)" },
    targets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          targetId: { type: Type.STRING },
          originalText: { type: Type.STRING, description: "Exact text from the draft to revise" },
          suggestion: { type: Type.STRING, description: "Student-friendly hint for how to revise" },
          alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 alternative wordings (for word-choice skill)" },
          idealRevision: { type: Type.STRING, description: "Model revision" },
        },
        required: ["targetId", "originalText", "suggestion", "idealRevision"]
      }
    },
  },
  required: ["title", "gradeLevel", "revisionSkill", "draft", "targets"]
};

export const generateRevisionWorkshop = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<RevisionWorkshopData>
): Promise<RevisionWorkshopData> => {
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: ADD-DETAILS or WORD-CHOICE. 3-4 simple sentences. 2-3 targets. Replace overused words (big/nice/good). Add sensory details.',
    '3': 'Grade 3: COMBINE-SENTENCES or WORD-CHOICE. 4-5 sentences. 3-4 targets. Combine choppy sentences with conjunctions. Replace "said" with vivid verbs.',
    '4': 'Grade 4: TRANSITIONS or WORD-CHOICE. 5-7 sentences. 3-4 targets. Add transition words between ideas. Strengthen weak verbs. Vary sentence beginnings.',
    '5': 'Grade 5: REORGANIZE or CONCISION. 6-8 sentences. 3-5 targets. Eliminate redundancy. Improve word precision. Reorganize for logical flow.',
    '6': 'Grade 6: CONCISION or TRANSITIONS. 7-10 sentences. 4-5 targets. Formal vs informal register. Cut unnecessary words. Improve coherence.',
  };

  const skillsByGrade: Record<string, RevisionSkill[]> = {
    '2': ['add-details', 'word-choice'],
    '3': ['combine-sentences', 'word-choice'],
    '4': ['transitions', 'word-choice', 'combine-sentences'],
    '5': ['reorganize', 'concision', 'transitions'],
    '6': ['concision', 'transitions', 'reorganize'],
  };

  const skills = skillsByGrade[gradeLevelKey] || skillsByGrade['4'];
  const selectedSkill = config?.revisionSkill || skills[Math.floor(Math.random() * skills.length)];

  const prompt = `Create a revision workshop activity about: "${topic}".
GRADE: ${gradeLevelKey}. SKILL: ${selectedSkill}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

Rules:
1. Write a draft passage with INTENTIONAL weaknesses matching the revision skill
2. Each target's originalText must be an EXACT substring of the draft
3. For word-choice skill: include 3-4 alternatives per target
4. Suggestions should guide without giving away the answer
5. idealRevision shows the model answer`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: revisionWorkshopSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in revision and editing skills. You create drafts with clear, targeted weaknesses that students can identify and improve. Your suggestions guide students without giving away the answer. Drafts sound like authentic student writing at the target grade level.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as RevisionWorkshopData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating revision workshop:", error);
    throw error;
  }
};
