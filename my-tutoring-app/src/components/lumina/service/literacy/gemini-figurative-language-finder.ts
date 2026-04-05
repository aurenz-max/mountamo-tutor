import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { FigurativeLanguageFinderData, FigurativeType } from "../../primitives/visual-primitives/literacy/FigurativeLanguageFinder";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  alliteration: {
    promptDoc: `"alliteration": Repetition of initial consonant sounds. Easy to identify by sound pattern. Grades 3-4.`,
    schemaDescription: "'alliteration' (repeated initial sounds)",
  },
  onomatopoeia: {
    promptDoc: `"onomatopoeia": Words that imitate sounds (buzz, crash, whisper). Easy to identify. Grades 3-4.`,
    schemaDescription: "'onomatopoeia' (sound words)",
  },
  simile: {
    promptDoc: `"simile": Comparison using "like" or "as". Has clear signal words. Grades 3-5.`,
    schemaDescription: "'simile' (comparison with like/as)",
  },
  metaphor: {
    promptDoc: `"metaphor": Implicit comparison without like/as. Harder than simile. Grades 4-6.`,
    schemaDescription: "'metaphor' (implicit comparison)",
  },
  personification: {
    promptDoc: `"personification": Giving human qualities to non-human things. Grades 4-6.`,
    schemaDescription: "'personification' (human qualities to non-human)",
  },
  hyperbole: {
    promptDoc: `"hyperbole": Extreme exaggeration for effect. Grades 4-6.`,
    schemaDescription: "'hyperbole' (extreme exaggeration)",
  },
  imagery: {
    promptDoc: `"imagery": Vivid sensory language appealing to sight, sound, touch, taste, or smell. Grades 5-6.`,
    schemaDescription: "'imagery' (sensory language)",
  },
  idiom: {
    promptDoc: `"idiom": Culturally specific expressions where meaning differs from literal words. Hardest type. Grades 5-6.`,
    schemaDescription: "'idiom' (culturally specific expression)",
  },
};

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
          type: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] },
          literalMeaning: { type: Type.STRING, description: "What the phrase literally means" },
          explanation: { type: Type.STRING, description: "Why this is classified as this type" },
        },
        required: ["instanceId", "text", "type", "literalMeaning", "explanation"]
      }
    },
    translateInstanceIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 instance IDs that students must write literal translations for" },
    availableTypes: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["simile", "metaphor", "personification", "hyperbole", "idiom", "alliteration", "onomatopoeia", "imagery"] } },
  },
  required: ["title", "gradeLevel", "passage", "instances", "translateInstanceIds", "availableTypes"]
};

/** SP-8 fix: LLMs can't compute character offsets — derive from passage.indexOf() */
function recomputeOffsets(data: FigurativeLanguageFinderData): void {
  const { passage, instances } = data;
  if (!passage || !instances) return;

  for (const inst of instances) {
    const idx = passage.indexOf(inst.text);
    if (idx >= 0) {
      inst.startIndex = idx;
      inst.endIndex = idx + inst.text.length;
    } else {
      console.warn(`[FigurativeLanguageFinder] recomputeOffsets: "${inst.text}" not found in passage`);
      inst.startIndex = 0;
      inst.endIndex = 0;
    }
  }
}

export const generateFigurativeLanguageFinder = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<FigurativeLanguageFinderData & { targetEvalMode: string }>
): Promise<FigurativeLanguageFinderData> => {
  const evalConstraint = resolveEvalModeConstraint(
    'figurative-language-finder',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('FigurativeLanguageFinder', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(figurativeLanguageFinderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        arrayName: 'instances',
      })
    : figurativeLanguageFinderSchema;

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

  const activeTypes = evalConstraint
    ? evalConstraint.allowedTypes as FigurativeType[]
    : availableTypes;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `Create a figurative language identification activity about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

AVAILABLE TYPES for this grade: ${activeTypes.join(', ')}
${challengeTypeSection}
Rules:
1. Write a passage that naturally embeds figurative language instances
2. Each instance "text" must be the EXACT substring as it appears in the passage (verbatim, case-sensitive)
3. Each instance must have a clear literal meaning and explanation
4. translateInstanceIds: pick 2-3 of the most interesting instances for literal translation
5. availableTypes: include all types available at this grade (even if not all used in the passage)`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 language arts instructor specializing in figurative language and literary devices. You create engaging passages rich in figurative language with clear, age-appropriate examples. Each instance "text" must be copied VERBATIM from the passage. Literal meanings are written in student-friendly language.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as FigurativeLanguageFinderData;
    recomputeOffsets(result);
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    return { ...result, ...configRest };
  } catch (error) {
    console.error("Error generating figurative language finder:", error);
    throw error;
  }
};
