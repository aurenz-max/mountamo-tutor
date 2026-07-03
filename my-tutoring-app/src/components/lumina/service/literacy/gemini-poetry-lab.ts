import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { PoetryLabData } from "../../primitives/visual-primitives/literacy/PoetryLab";
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
  analysis: {
    promptDoc:
      `"analysis": Identify poetic elements in a given poem (β 3.5). `
      + `Student reads a poem and identifies mood, figurative language instances, and rhyme scheme. `
      + `Grades K-6 (the GRADE note governs complexity; K = nursery rhyme, identify rhyming words). `
      + `REQUIRED fields: poem, poemLines, correctMood, moodOptions, figurativeInstances, rhymeScheme, rhymeSchemeOptions.`,
    schemaDescription: "'analysis' (identify poetic elements in a given poem)",
  },
  composition: {
    promptDoc:
      `"composition": Compose a poem using template structure (β 6.0). `
      + `Student writes a poem following a specific template (haiku, limerick, acrostic, free-verse, sonnet-intro). `
      + `Grades K-6 (the GRADE note governs the template; K = finish-the-rhyme). `
      + `REQUIRED fields: compositionPrompt, templateType, templateConstraints. `
      + `Do NOT include poem/poemLines/figurativeInstances/rhymeScheme/rhymeSchemeOptions.`,
    schemaDescription: "'composition' (compose a poem using template structure)",
  },
};

const poetryLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging title for the poetry activity" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('K' or '1' through '6')" },
    mode: { type: Type.STRING, enum: ["analysis", "composition"], description: "Activity mode" },
    poem: { type: Type.STRING, description: "Full poem text (analysis mode)" },
    poemLines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Each line of the poem as separate strings" },
    correctMood: { type: Type.STRING, description: "The mood/feeling of the poem" },
    moodOptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 mood options including correct one" },
    figurativeInstances: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          startIndex: { type: Type.NUMBER },
          endIndex: { type: Type.NUMBER },
          type: { type: Type.STRING, description: "simile, metaphor, personification, alliteration, hyperbole, imagery, onomatopoeia" },
        },
        required: ["text", "startIndex", "endIndex", "type"]
      }
    },
    rhymeScheme: { type: Type.STRING, description: "Correct rhyme scheme e.g. AABB, ABAB, ABCB" },
    rhymeSchemeOptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 rhyme scheme options" },
    templateType: { type: Type.STRING, enum: ["haiku", "limerick", "acrostic", "free-verse", "sonnet-intro"] },
    compositionPrompt: { type: Type.STRING, description: "Writing prompt for composition mode" },
    templateConstraints: {
      type: Type.OBJECT,
      properties: {
        lineCount: { type: Type.NUMBER },
        syllablesPerLine: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        rhymePattern: { type: Type.STRING },
        acrosticWord: { type: Type.STRING },
      },
      required: ["lineCount"]
    },
  },
  required: ["title", "gradeLevel", "mode"]
};

type PoetryLabConfig = Partial<PoetryLabData & { targetEvalMode: string }>;

export const generatePoetryLab = async (
  ctx: GenerationContext,
): Promise<PoetryLabData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as PoetryLabConfig;

  // Grade rung: ctx.grade is the canonical per-objective curriculum grade
  // ('K'|'1'..'12'), resolved once at the registry boundary — use it directly,
  // clamped to this primitive's K-6 ladder. Without it (free-form lessons) fall
  // back to the lesson band: kindergarten → 'K', anything else → '3' (the old
  // prose-matching fallback could never hit and silently pinned every lesson
  // to grade 4).
  const LADDER = ['K', '1', '2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6';
  } else {
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? 'K' : '3';
  }

  // ---------------------------------------------------------------------------
  // Eval mode resolution
  // ---------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'poetry-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PoetryLab', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(poetryLabSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : poetryLabSchema;

  // ---------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // ---------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const requestedMode = evalConstraint?.allowedTypes[0] || config?.mode || 'analysis';

  const gradeNotes: Record<string, string> = {
    'K': 'Kindergarten: Nursery-rhyme style. 4 very short lines (3-6 simple words each). AABB with loud, obvious rhyming word pairs (cat/hat). Task = hear and identify the rhyming words. NO figurative language. Mood options must be single simple feeling words (happy, sleepy, silly).',
    '1': 'Grade 1: Simple rhyming poem. Identify rhyming words. Repetition. 4-6 lines. AABB rhyme. No figurative language beyond simple repetition.',
    '2': 'Grade 2: Rhyming poem with sensory words. AABB or ABAB. 4-8 lines. 1-2 simple similes. Identify mood.',
    '3': 'Grade 3: Simile and alliteration. Haiku structure. Stanza structure. AABB/ABAB. 8-12 lines. 2-3 figurative instances.',
    '4': 'Grade 4: ABAB, AABB rhyme schemes. Personification. Limerick form. 8-16 lines. 3-4 figurative instances.',
    '5': 'Grade 5: Meter basics. Imagery and mood. Free verse. Hyperbole. 10-16 lines. 4-5 figurative instances.',
    '6': 'Grade 6: Extended metaphor. Symbolism. Enjambment. 12-20 lines. 4-6 figurative instances.',
  };

  const compositionNotes: Record<string, string> = {
    'K': 'Composition: Finish-the-rhyme — a 2-4 line nursery-style rhyme where the student supplies the final rhyming word(s). Very simple CVC-heavy vocabulary.',
    '1': 'Composition: Simple 4-line rhyming poem. AABB.',
    '2': 'Composition: 4-6 line poem with at least one simile.',
    '3': 'Composition: Haiku (5-7-5 syllables) or acrostic.',
    '4': 'Composition: Limerick (AABBA, 8-8-5-5-8 syllables) or ABAB quatrain.',
    '5': 'Composition: Free verse with imagery, or haiku.',
    '6': 'Composition: Free verse with extended metaphor, or sonnet-intro (4 lines iambic).',
  };

  const prompt = `Create a poetry ${requestedMode} activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (story context, characters, poem, examples, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}. MODE: ${requestedMode}.
${requestedMode === 'analysis' ? gradeNotes[gradeLevelKey] : compositionNotes[gradeLevelKey]}

${challengeTypeSection}

${requestedMode === 'analysis' ? `Generate:
1. A grade-appropriate poem about the topic with clear figurative language
2. poemLines: each line as a separate string
3. poem: the full text joined by newlines
4. correctMood and 3-4 moodOptions
5. figurativeInstances with EXACT startIndex/endIndex character offsets in the poem string
6. rhymeScheme (e.g. "AABB") and 3-4 rhymeSchemeOptions
7. CRITICAL: character offsets must be exact!` : `Generate:
1. A compositionPrompt appropriate for grade ${gradeLevelKey}
2. templateType matching the grade level
3. templateConstraints with lineCount, syllablesPerLine (if applicable), rhymePattern, acrosticWord
4. Set mode to "composition"
5. No poem/poemLines/figurativeInstances needed`}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 poetry instructor who creates engaging, age-appropriate poems and poetry activities. For analysis mode, write poems with clear figurative language and consistent rhyme schemes. For composition mode, create inspiring prompts with clear structural constraints. Be meticulous about character offsets.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as PoetryLabData;
    // Exclude targetEvalMode from config spread
    const { targetEvalMode: _targetEvalMode, ...restConfig } = config || {};
    return { ...result, ...restConfig };
  } catch (error) {
    console.error("Error generating poetry lab:", error);
    throw error;
  }
};
