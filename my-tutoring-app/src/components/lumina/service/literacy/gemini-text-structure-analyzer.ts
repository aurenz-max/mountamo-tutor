import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { TextStructureAnalyzerData, StructureType } from "../../primitives/visual-primitives/literacy/TextStructureAnalyzer";
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
  'cause-effect': {
    promptDoc:
      `"cause-effect": Identify cause and effect relationships in text. `
      + `The passage should use signal words like "because", "so", "as a result", "therefore". `
      + `Template regions: Cause / Effect. Key ideas map to cause or effect regions.`,
    schemaDescription: "'cause-effect' (identify cause and effect relationships, β 2.5)",
  },
  'compare-contrast': {
    promptDoc:
      `"compare-contrast": Analyze similarities and differences in text. `
      + `The passage should use signal words like "however", "similarly", "in contrast", "on the other hand", "both". `
      + `Template regions: Similarities / Differences (or Item A / Item B). Key ideas map to comparison regions.`,
    schemaDescription: "'compare-contrast' (analyze similarities and differences, β 3.0)",
  },
  'problem-solution': {
    promptDoc:
      `"problem-solution": Identify the problem and proposed solutions in text. `
      + `The passage should use signal words like "the problem is", "one solution", "as a result", "to fix this". `
      + `Template regions: Problem / Solution(s). Key ideas map to problem or solution regions.`,
    schemaDescription: "'problem-solution' (identify problem and proposed solutions, β 3.5)",
  },
  'chronological': {
    promptDoc:
      `"chronological": Sequence events in time order from the text. `
      + `The passage should use signal words like "first", "then", "next", "finally", "after", "before". `
      + `Template regions: ordered steps or time periods. Key ideas map to sequential regions.`,
    schemaDescription: "'chronological' (sequence events in time order, β 2.0)",
  },
  'description': {
    promptDoc:
      `"description": Identify descriptive text structure. `
      + `The passage should use signal words like "for example", "such as", "includes", "characteristics". `
      + `Template regions: Main Topic / Details or Features. Key ideas map to descriptive categories.`,
    schemaDescription: "'description' (identify descriptive text structure, β 2.0)",
  },
};

const textStructureAnalyzerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the text structure analysis activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('2' through '6')" },
    passage: { type: Type.STRING, description: "Informational passage (4-10 sentences, appropriate reading level)" },
    structureType: { type: Type.STRING, enum: ["cause-effect", "compare-contrast", "problem-solution", "chronological", "description"], description: "The organizational structure of the passage" },
    signalWords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The signal word/phrase as it appears in the passage" },
          startIndex: { type: Type.NUMBER, description: "Character offset where the signal word starts in the passage" },
          endIndex: { type: Type.NUMBER, description: "Character offset where the signal word ends in the passage" },
        },
        required: ["word", "startIndex", "endIndex"]
      }
    },
    structureOptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["cause-effect", "compare-contrast", "problem-solution", "chronological", "description"] },
          label: { type: Type.STRING },
          description: { type: Type.STRING, description: "Brief kid-friendly description of this structure" },
        },
        required: ["type", "label", "description"]
      }
    },
    templateRegions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          regionId: { type: Type.STRING },
          label: { type: Type.STRING, description: "Label for this region of the template" },
        },
        required: ["regionId", "label"]
      }
    },
    keyIdeas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ideaId: { type: Type.STRING },
          text: { type: Type.STRING, description: "Short excerpt or paraphrase from the passage" },
          correctRegionId: { type: Type.STRING, description: "The template region this idea belongs in" },
        },
        required: ["ideaId", "text", "correctRegionId"]
      }
    },
    authorPurposeExplanation: { type: Type.STRING, description: "Brief explanation of why the author chose this structure" },
  },
  required: ["title", "gradeLevel", "passage", "structureType", "signalWords", "structureOptions", "templateRegions", "keyIdeas"]
};

export const generateTextStructureAnalyzer = async (
  topic: string,
  gradeLevel: string = '4',
  config?: Partial<TextStructureAnalyzerData> & { targetEvalMode?: string },
): Promise<TextStructureAnalyzerData> => {
  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '4';

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'text-structure-analyzer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('TextStructureAnalyzer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(textStructureAnalyzerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'structureType',
        rootLevel: true,
      })
    : textStructureAnalyzerSchema;

  const gradeNotes: Record<string, string> = {
    '2': 'Grade 2: Focus on CHRONOLOGICAL or DESCRIPTION only. Use "first, then, finally" or descriptive signal words. 4-5 simple sentences. 3-4 signal words. 3-4 key ideas. 2 template regions.',
    '3': 'Grade 3: Add CAUSE-EFFECT. Signal words: because, so, as a result. 5-6 sentences. 4-5 signal words. 4-5 key ideas. 2-3 template regions.',
    '4': 'Grade 4: Add COMPARE-CONTRAST and PROBLEM-SOLUTION. Signal words: however, similarly, in contrast, one solution. 6-7 sentences. 5-6 signal words. 5-6 key ideas. 2-3 template regions.',
    '5': 'Grade 5: All 5 structures. Mixed structures allowed. Include author\'s purpose explanation. 7-8 sentences. 5-7 signal words. 5-7 key ideas. 3-4 template regions.',
    '6': 'Grade 6: Complex multi-paragraph. Evaluate whether structure serves author\'s purpose. 8-10 sentences. 6-8 signal words. 6-8 key ideas. 3-4 template regions.',
  };

  // Determine which structures are available at this grade
  const structuresByGrade: Record<string, StructureType[]> = {
    '2': ['chronological', 'description'],
    '3': ['chronological', 'description', 'cause-effect'],
    '4': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
    '5': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
    '6': ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
  };

  const availableStructures = structuresByGrade[gradeLevelKey] || structuresByGrade['4'];

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const structureTypeOverride = evalConstraint
    ? `\nSTRUCTURE TYPE CONSTRAINT: You MUST use one of these structure types: ${evalConstraint.allowedTypes.join(', ')}. Do NOT use any other structure type.`
    : '';

  const prompt = `Create a text structure analysis activity about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['4']}

AVAILABLE STRUCTURES for this grade: ${availableStructures.join(', ')}

${challengeTypeSection}
${structureTypeOverride}

Rules:
1. Write an informational passage using ONE primary structure from the available list
2. Embed signal words naturally — mark their exact startIndex/endIndex character positions in the passage string
3. structureOptions: always provide 3-4 options including the correct one plus plausible distractors from the available structures list
4. templateRegions: create regions matching the chosen structure (e.g. Cause/Effect for cause-effect, Before/After for chronological)
5. keyIdeas: short excerpts from the passage that students drag to template regions
6. CRITICAL: startIndex and endIndex must be exact character positions in the passage string. Double-check offsets!
7. Include authorPurposeExplanation for grades 5-6`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 reading comprehension instructor specializing in informational text structure analysis. You create grade-appropriate passages with clear organizational patterns and embedded signal words. You are meticulous about character offsets — count carefully. Template regions match the passage structure. Key ideas are concise excerpts that clearly belong to one region.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as TextStructureAnalyzerData;

    // Exclude targetEvalMode from config spread
    const { targetEvalMode: _targetEvalMode, ...restConfig } = config || {};
    return { ...result, ...restConfig };
  } catch (error) {
    console.error("Error generating text structure analyzer:", error);
    throw error;
  }
};
