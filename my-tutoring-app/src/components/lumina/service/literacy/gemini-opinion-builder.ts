import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { OpinionBuilderData } from "../../primitives/visual-primitives/literacy/OpinionBuilder";
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
  'oreo': {
    promptDoc:
      `"oreo": Opinion-Reason-Example-Opinion framework. Students state an opinion, `
      + `give reasons with examples, and restate their opinion. Best for grades 2-4. `
      + `Scaffold uses claimLabel "Opinion", reasonLabel "Reasons", conclusionLabel "Restate Opinion". `
      + `No counter-argument. Sentence starters should be simple and age-appropriate.`,
    schemaDescription: "'oreo' — Opinion-Reason-Example-Opinion framework (grades 2-4)",
  },
  'cer': {
    promptDoc:
      `"cer": Claim-Evidence-Reasoning framework. Students make a claim, support it with `
      + `evidence, and explain their reasoning. Best for grades 5-6. `
      + `Scaffold uses claimLabel "Claim", reasonLabel "Evidence", conclusionLabel "Conclusion". `
      + `Counter-argument enabled. Academic linking words and formal register expected.`,
    schemaDescription: "'cer' — Claim-Evidence-Reasoning framework (grades 5-6)",
  },
};

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
  config?: Partial<OpinionBuilderData> & { targetEvalMode?: string },
): Promise<OpinionBuilderData> => {

  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'opinion-builder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('OpinionBuilder', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(opinionBuilderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'framework',
        rootLevel: true,
      })
    : opinionBuilderSchema;

  // ---------------------------------------------------------------------------
  // Grade & framework setup
  // ---------------------------------------------------------------------------
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';
  const useOREO = parseInt(gradeLevelKey) <= 4;
  const fw = evalConstraint
    ? evalConstraint.allowedTypes[0]
    : (useOREO ? 'oreo' : 'cer');
  const reasonCount = parseInt(gradeLevelKey) <= 2 ? 2 : 3;
  const counterEnabled = parseInt(gradeLevelKey) >= 5;

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: "I think ___ because ___." 1 opinion + 2 simple reasons. Very simple starters. No counter-argument.',
    '3': 'Grade 3: Opinion + 2-3 reasons + examples. Linking words: because, therefore, for instance. No counter-argument.',
    '4': 'Grade 4: Full OREO. 3 reasons ranked by strength. Concluding statement. More sophisticated starters.',
    '5': 'Grade 5: CER framework. Evidence from texts. Counter-argument + rebuttal. Academic linking words.',
    '6': 'Grade 6: Full argument. Counter-argument + rebuttal. Source citation language. Formal register.',
  };

  // ---------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // ---------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create an opinion/argument writing scaffold about: "${topic}".
GRADE: ${gradeLevelKey}. FRAMEWORK: ${fw}. REASONS REQUIRED: ${reasonCount}. COUNTER-ARGUMENT: ${counterEnabled}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

${challengeTypeSection}

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
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 writing instructor specializing in opinion and argumentative writing. You create age-appropriate scaffolds using OREO (grades 2-4) and CER (grades 5-6) frameworks. Your prompts are debatable and engaging. Your sentence starters provide just enough support without doing the thinking for students.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as OpinionBuilderData;

    // Exclude targetEvalMode from config spread
    const { targetEvalMode: _unused, ...restConfig } = config ?? {};
    void _unused;
    return { ...result, ...restConfig };
  } catch (error) {
    console.error("Error generating opinion builder:", error);
    throw error;
  }
};
