import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { RevisionWorkshopData, RevisionSkill } from "../../primitives/visual-primitives/literacy/RevisionWorkshop";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'add-details': {
    promptDoc: `"add-details": Expand with sensory/specific details. Student adds vivid descriptions to flat prose. Grades 2-3.`,
    schemaDescription: "'add-details' (expand with sensory/specific details)",
  },
  'word-choice': {
    promptDoc: `"word-choice": Replace weak/vague words with precise, vivid alternatives. Student upgrades bland vocabulary. Grades 2-4.`,
    schemaDescription: "'word-choice' (replace weak/vague words)",
  },
  'combine-sentences': {
    promptDoc: `"combine-sentences": Combine choppy sentences into smoother, more complex ones using conjunctions and transitions. Grades 3-4.`,
    schemaDescription: "'combine-sentences' (combine choppy sentences)",
  },
  transitions: {
    promptDoc: `"transitions": Add or improve transition words and phrases to connect ideas and improve flow. Grades 4-5.`,
    schemaDescription: "'transitions' (add/improve transition words)",
  },
  reorganize: {
    promptDoc: `"reorganize": Reorder sentences or paragraphs for logical flow and coherence. Grades 5-6.`,
    schemaDescription: "'reorganize' (reorder for logical flow)",
  },
  concision: {
    promptDoc: `"concision": Eliminate wordiness, redundancy, and unnecessary phrases to tighten prose. Grades 5-6.`,
    schemaDescription: "'concision' (eliminate wordiness)",
  },
};

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
  config?: Partial<RevisionWorkshopData & { targetEvalMode: string }>
): Promise<RevisionWorkshopData> => {
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'revision-workshop',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('RevisionWorkshop', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(revisionWorkshopSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'revisionSkill',
        rootLevel: true,
      })
    : revisionWorkshopSchema;

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
  const selectedSkill = evalConstraint
    ? evalConstraint.allowedTypes[0]
    : (config?.revisionSkill || skills[Math.floor(Math.random() * skills.length)]);

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a revision workshop activity about: "${topic}".
GRADE: ${gradeLevelKey}. SKILL: ${selectedSkill}.
${!evalConstraint ? (gradeNotes[gradeLevelKey] || gradeNotes['4']) : ''}

${challengeTypeSection}

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
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in revision and editing skills. You create drafts with clear, targeted weaknesses that students can identify and improve. Your suggestions guide students without giving away the answer. Drafts sound like authentic student writing at the target grade level.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as RevisionWorkshopData;

    // Merge with any config overrides (excluding targetEvalMode)
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    return { ...result, ...configRest };
  } catch (error) {
    console.error("Error generating revision workshop:", error);
    throw error;
  }
};
