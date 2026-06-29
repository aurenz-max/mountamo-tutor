import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { GenreExplorerData } from "../../primitives/visual-primitives/literacy/GenreExplorer";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// Eval modes are TASK IDENTITIES (Bloom tiers of genre work), not numeric
// difficulty. They map onto the root-level `mode` field of the schema:
//   identify_basic  → binary real/make-believe recognition (RECOGNIZE)
//   classify_genre  → multi-way classification among literary genres (CLASSIFY)
//   compare_genres  → contrast two genres on one topic side-by-side (ANALYZE)
// The data SHAPE is identical across modes — only the content (which genres,
// how many excerpts, whether comparison is forced) changes — so the component
// renders every mode without branching.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify_basic: {
    promptDoc:
      `"identify_basic": Binary FICTION vs NONFICTION recognition. Produce exactly ONE excerpt. `
      + `genreOptions are limited to two broad buckets only (e.g. "fiction"/"nonfiction", or "make-believe story"/"real facts"). `
      + `Features are 4-5 simple yes/no perceptual cues a young reader can spot ("Has make-believe characters?", "Tells real facts?", "Could this really happen?"). `
      + `comparisonEnabled MUST be false. Foundational task — grades 1-2.`,
    schemaDescription: "'identify_basic' (fiction vs nonfiction recognition)",
  },
  classify_genre: {
    promptDoc:
      `"classify_genre": Multi-way classification among specific literary/informational genres `
      + `(folktale, fable, myth, poetry, informational, biography, historical fiction — pick a grade-appropriate set). `
      + `Produce 1-2 excerpts, each a DIFFERENT genre. genreOptions list the 4-6 candidate genres including 2-3 plausible distractors. `
      + `Features are 5-7 genre-distinguishing characteristics ("Has a moral lesson?", "Uses rhyme?", "Based on a true person?"). `
      + `comparisonEnabled MAY be false. Core classification task — grades 3-4.`,
    schemaDescription: "'classify_genre' (multi-way genre classification)",
  },
  compare_genres: {
    promptDoc:
      `"compare_genres": Contrast TWO excerpts about the SAME topic written in DIFFERENT genres, side by side. `
      + `Produce EXACTLY 2 excerpts on one shared subject; their genres MUST differ. `
      + `comparisonEnabled MUST be true. genreOptions list 5-6 genres including the two correct ones plus distractors. `
      + `Features are 6-8 characteristics that genuinely DISTINGUISH the two genres so the contrast is observable. `
      + `Highest tier — student analyzes how genre shapes the same content. Grades 5-6.`,
    schemaDescription: "'compare_genres' (contrast two genres on one topic)",
  },
};

/**
 * Schema definition for Genre Explorer Data
 *
 * Students examine text excerpts and classify them by genre using feature
 * checklists. The root-level `mode` field is the classification task identity
 * (eval mode); it is optional/back-compatible and constrained per pinned mode.
 */
const genreExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    mode: {
      type: Type.STRING,
      enum: ["identify_basic", "classify_genre", "compare_genres"],
      description: "The classification task identity (eval mode) for this activity"
    },
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

type GenreExplorerConfig = Partial<GenreExplorerData> & { targetEvalMode?: string };

export const generateGenreExplorer = async (
  ctx: GenerationContext,
): Promise<GenreExplorerData> => {

  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as GenreExplorerConfig;

  // ── Eval mode resolution (legacy literacy pattern) ──────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'genre-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('GenreExplorer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(genreExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
        rootLevel: true,
      })
    : genreExplorerSchema;

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

  // The challenge-type section replaces the inline mode hints when a mode is
  // pinned; the grade-shape defaults only apply for the unconstrained (mixed) case.
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a genre classification activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (story context, characters, poem, examples, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}.
${challengeTypeSection}
${!evalConstraint ? `EXCERPTS: ${excerptCount}. COMPARISON: ${comparison}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}
` : ''}
Rules:
1. Write short excerpt(s) in DIFFERENT genres about the same topic (count and comparison set by the mode/grade above)
2. Each excerpt has a feature checklist — mark which features are actually present (true/false)
3. genreOptions includes the correct genres plus 2-3 plausible distractors
4. Features should be yes/no questions about text characteristics
5. Set comparisonEnabled to match the activity's task (true when a side-by-side comparison is required)`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 reading teacher specializing in genre analysis and text classification. You create clear, genre-typical excerpts that showcase distinguishing features. Feature checklists help students systematically identify genre characteristics.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as GenreExplorerData;

    // Merge config overrides, excluding the routing field from the spread.
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    const finalData: GenreExplorerData = { ...result, ...configRest };

    // Stamp the pinned mode if Gemini omitted it (single pinned mode only).
    if (!finalData.mode && evalConstraint?.allowedTypes.length === 1) {
      finalData.mode = evalConstraint.allowedTypes[0] as GenreExplorerData['mode'];
    }

    console.log('Genre Explorer Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      mode: finalData.mode,
      excerptCount: finalData.excerpts?.length || 0,
      genres: finalData.excerpts?.map(e => e.genre) || [],
    });

    return finalData;
  } catch (error) {
    console.error("Error generating genre explorer:", error);
    throw error;
  }
};
