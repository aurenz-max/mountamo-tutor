import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { ReadAloudStudioData } from "../../primitives/visual-primitives/literacy/ReadAloudStudio";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
//
// Read-aloud fluency is NOT a single undifferentiated skill — the research
// (DIBELS, NAEP Oral Reading Fluency scale) separates the fluency sub-skills a
// reader develops in sequence. Each mode is a different TASK IDENTITY (what the
// reader attends to while reading aloud), NOT a harder version of the same task:
//
//   accuracy   — decode every word correctly and read smoothly (automaticity).
//   expression — read with prosody: pausing, phrasing, emphasis, intonation.
//   dialogue   — read dialogue with distinct character voices and dramatic tone.
//
// The interaction surface (Listen → Practice → Record → Review) is identical for
// all three; the mode only varies the GENERATED passage content and the kind /
// density of expressionMarkers the student practises. This keeps the component
// untouched while giving the IRT engine three genuinely different fluency skills
// to route between.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  accuracy: {
    promptDoc:
      `"accuracy": Smooth, accurate word reading (automaticity). Write a plain narrative or `
      + `informational passage with mostly decodable, high-frequency vocabulary and short, simple `
      + `sentences. expressionMarkers: use only a FEW markers — mostly "pause" at end punctuation, `
      + `at most one "emphasis". The goal is reading every word correctly at a steady pace, NOT `
      + `dramatic expression. Earliest fluency skill — grades 1-3.`,
    schemaDescription: "'accuracy' (smooth, correct word reading)",
  },
  expression: {
    promptDoc:
      `"expression": Prosody — reading with phrasing, pausing, and emphasis. Write a passage with `
      + `varied sentence lengths, commas for phrasing, and several important words to stress. `
      + `expressionMarkers: include a RICHER set — multiple "pause" (at commas and periods), `
      + `several "emphasis" on key words, plus "question" or "exclamation" markers where the `
      + `punctuation calls for changed intonation. The goal is sounding like natural speech, not `
      + `word-by-word reading. Grades 2-5.`,
    schemaDescription: "'expression' (prosody: phrasing, pausing, emphasis)",
  },
  dialogue: {
    promptDoc:
      `"dialogue": Character-voice reading. Write a passage built around quoted dialogue between `
      + `two or more characters (use dialogue tags and quotation marks). The reader must switch `
      + `voice/tone for each speaker and convey emotion. expressionMarkers: mark the dialogue with `
      + `"emphasis" on emotionally-loaded words, "question" and "exclamation" on the lines that `
      + `carry them, and "slow" where a character speaks deliberately. The goal is dramatic, `
      + `character-distinct delivery. Most advanced — grades 4-6.`,
    schemaDescription: "'dialogue' (character voices and dramatic tone)",
  },
};

const readAloudStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the fluency practice activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('1' through '6')" },
    fluencyFocus: {
      type: Type.STRING,
      enum: ["accuracy", "expression", "dialogue"],
      description: "Which fluency sub-skill this passage targets (accuracy, expression, or dialogue/character voice)",
    },
    passage: { type: Type.STRING, description: "Reading passage appropriate for fluency practice" },
    passageWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Each word of the passage as separate strings" },
    targetWPM: { type: Type.NUMBER, description: "Target words per minute for this grade level" },
    lexileLevel: { type: Type.STRING, description: "Approximate Lexile level e.g. '520L'" },
    expressionMarkers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["pause", "emphasis", "question", "exclamation", "slow"] },
          wordIndex: { type: Type.NUMBER, description: "Index into the passageWords array" },
          label: { type: Type.STRING },
        },
        required: ["type", "wordIndex", "label"]
      }
    },
    comprehensionQuestion: { type: Type.STRING, description: "Optional post-reading comprehension question" },
    comprehensionAnswer: { type: Type.STRING, description: "Answer to the comprehension question" },
  },
  required: ["title", "gradeLevel", "passage", "passageWords", "targetWPM", "lexileLevel", "expressionMarkers"]
};

type ReadAloudStudioConfig = Partial<ReadAloudStudioData> & {
  /** Target eval mode from the IRT calibration system (accuracy | expression | dialogue). */
  targetEvalMode?: string;
};

export const generateReadAloudStudio = async (
  ctx: GenerationContext,
): Promise<ReadAloudStudioData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as ReadAloudStudioConfig;
  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'read-aloud-studio',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ReadAloudStudio', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(readAloudStudioSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'fluencyFocus',
        rootLevel: true,
      })
    : readAloudStudioSchema;

  const gradeNotes: Record<string, string> = {
    '1': 'Grade 1: 30-50 words. Simple sentences. Sight words. Target 60-80 WPM. Lexile ~200L. 2-3 expression markers.',
    '2': 'Grade 2: 50-80 words. Short paragraph. Punctuation variety. Target 80-100 WPM. Lexile ~400L. 3-4 markers.',
    '3': 'Grade 3: 80-120 words. Questions and exclamations. Target 80-100 WPM. Lexile ~520L. 4-5 markers.',
    '4': 'Grade 4: 100-150 words. Mixed text types. Target 100-120 WPM. Lexile ~700L. 5-6 markers.',
    '5': 'Grade 5: 120-180 words. Dialogue with character voices. Target 120-140 WPM. Lexile ~850L. 5-7 markers.',
    '6': 'Grade 6: 150-200 words. Genre-appropriate tone. Target 140-160 WPM. Lexile ~950L. 6-8 markers.',
  };

  const wpmTargets: Record<string, number> = { '1': 70, '2': 90, '3': 90, '4': 110, '5': 130, '6': 150 };

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a fluency reading practice passage about: "${topic}".
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

${challengeTypeSection}

Rules:
1. Write an engaging passage at the specified reading level${evalConstraint ? ' that fits the fluency focus described above' : ''}
2. passageWords: split the passage into individual words (split on spaces)
3. expressionMarkers: mark words where expression/prosody changes (pauses at commas/periods, emphasis on important words, question intonation)${evalConstraint ? ', following the marker guidance for the fluency focus above' : ''}
4. wordIndex values must be valid indices into the passageWords array
5. Include a comprehension question and answer
6. targetWPM should be ${wpmTargets[gradeLevelKey] || 90}${evalConstraint ? `\n7. fluencyFocus MUST be "${evalConstraint.allowedTypes[0]}"` : ''}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 reading fluency instructor. You create engaging, grade-appropriate passages for oral reading practice. You mark expression points (pauses, emphasis, intonation changes) to help students read with prosody. Passages have natural rhythm and varied sentence structures.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as ReadAloudStudioData;

    // Merge config overrides (exclude targetEvalMode from the spread).
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    const finalData: ReadAloudStudioData = { ...result, ...configRest };

    // Backfill fluencyFocus from the resolved mode if Gemini dropped it.
    if (!finalData.fluencyFocus && evalConstraint) {
      finalData.fluencyFocus = evalConstraint.allowedTypes[0] as ReadAloudStudioData['fluencyFocus'];
    }

    console.log('Read Aloud Studio Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      fluencyFocus: finalData.fluencyFocus,
      wordCount: finalData.passageWords?.length || 0,
      markerCount: finalData.expressionMarkers?.length || 0,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating read aloud studio:", error);
    throw error;
  }
};
