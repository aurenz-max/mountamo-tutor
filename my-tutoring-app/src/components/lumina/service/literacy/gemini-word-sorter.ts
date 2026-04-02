import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { WordSorterData } from '../../primitives/visual-primitives/literacy/WordSorter';
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
  binary_sort: {
    promptDoc: '"binary_sort": Sort word cards into 2 labeled buckets (e.g., noun/verb, singular/plural). 6-8 word cards.',
    schemaDescription: "'binary_sort' (two-bucket sorting)",
  },
  ternary_sort: {
    promptDoc: '"ternary_sort": Sort word cards into 3 labeled buckets (e.g., past/present/future, noun/verb/adjective). 8-10 word cards.',
    schemaDescription: "'ternary_sort' (three-bucket sorting)",
  },
  match_pairs: {
    promptDoc: '"match_pairs": Match word pairs (e.g., singular→plural, word→antonym, word→synonym). 5-6 pairs.',
    schemaDescription: "'match_pairs' (pair matching)",
  },
};

// ---------------------------------------------------------------------------
// Flattened Gemini schema
//
// Gemini struggles with nested arrays of objects. We flatten:
//   - words[] → word0Id, word0Text, word0Emoji, word0CorrectBucket ... word9*
//   - pairs[] → pair0Id, pair0Term, pair0TermEmoji, pair0Match, pair0MatchEmoji ... pair5*
//   - bucketLabels[] → bucketLabel0, bucketLabel1, bucketLabel2
// The validation function reconstructs the nested arrays.
// ---------------------------------------------------------------------------

function buildWordFields(): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < 10; i++) {
    fields[`word${i}Id`] = { type: Type.STRING, description: `Word ${i} unique ID (e.g., 'w${i}')` };
    fields[`word${i}Text`] = { type: Type.STRING, description: `Word ${i} display text` };
    fields[`word${i}Emoji`] = { type: Type.STRING, description: `Word ${i} emoji (optional, use for K-level engagement)` };
    fields[`word${i}CorrectBucket`] = { type: Type.STRING, description: `Word ${i} correct bucket label (must exactly match one of bucketLabel0/1/2)` };
  }
  return fields;
}

function buildPairFields(): Record<string, Schema> {
  const fields: Record<string, Schema> = {};
  for (let i = 0; i < 6; i++) {
    fields[`pair${i}Id`] = { type: Type.STRING, description: `Pair ${i} unique ID (e.g., 'p${i}')` };
    fields[`pair${i}Term`] = { type: Type.STRING, description: `Pair ${i} term word` };
    fields[`pair${i}TermEmoji`] = { type: Type.STRING, description: `Pair ${i} term emoji (optional)` };
    fields[`pair${i}Match`] = { type: Type.STRING, description: `Pair ${i} matching word` };
    fields[`pair${i}MatchEmoji`] = { type: Type.STRING, description: `Pair ${i} match emoji (optional)` };
  }
  return fields;
}

const wordSorterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the word sorting activity",
    },
    description: {
      type: Type.STRING,
      description: "Brief description of the sorting activity",
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level (K, 1, or 2)",
    },
    sortingTopic: {
      type: Type.STRING,
      description: "Topic/theme of the sorting activity (e.g., 'Parts of Speech', 'Singular and Plural')",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
          },
          type: {
            type: Type.STRING,
            enum: ["binary_sort", "ternary_sort", "match_pairs"],
            description: "Challenge type: 'binary_sort' (2 buckets), 'ternary_sort' (3 buckets), or 'match_pairs' (pair matching)",
          },
          instruction: {
            type: Type.STRING,
            description: "Clear instruction for the student (e.g., 'Sort these words into nouns and verbs')",
          },
          // Flattened bucket labels
          bucketLabel0: {
            type: Type.STRING,
            description: "First bucket label (required for binary_sort and ternary_sort)",
          },
          bucketLabel1: {
            type: Type.STRING,
            description: "Second bucket label (required for binary_sort and ternary_sort)",
          },
          bucketLabel2: {
            type: Type.STRING,
            description: "Third bucket label (required for ternary_sort only, leave empty for binary_sort)",
          },
          // Flattened word fields
          wordCount: {
            type: Type.INTEGER,
            description: "Number of populated word slots (6-8 for binary_sort, 8-10 for ternary_sort, 0 for match_pairs)",
          },
          ...buildWordFields(),
          // Flattened pair fields
          pairCount: {
            type: Type.INTEGER,
            description: "Number of populated pair slots (5-6 for match_pairs, 0 for sort types)",
          },
          ...buildPairFields(),
        },
        required: ["id", "type", "instruction"],
      },
      description: "Array of 3-4 word sorting challenges",
    },
  },
  required: ["title", "gradeLevel", "sortingTopic", "challenges"],
};

// ---------------------------------------------------------------------------
// Flat → nested reconstruction
// ---------------------------------------------------------------------------

interface FlatChallenge {
  id: string;
  type: 'binary_sort' | 'ternary_sort' | 'match_pairs';
  instruction: string;
  bucketLabel0?: string;
  bucketLabel1?: string;
  bucketLabel2?: string;
  wordCount?: number;
  pairCount?: number;
  [key: string]: unknown;
}

function reconstructChallenge(flat: FlatChallenge) {
  const { id, type, instruction } = flat;

  // Reconstruct bucket labels
  const bucketLabels: string[] = [];
  if (flat.bucketLabel0) bucketLabels.push(flat.bucketLabel0);
  if (flat.bucketLabel1) bucketLabels.push(flat.bucketLabel1);
  if (flat.bucketLabel2) bucketLabels.push(flat.bucketLabel2);

  if (type === 'match_pairs') {
    // Reconstruct pairs array
    const pairCount = (flat.pairCount as number) || 0;
    const pairs = [];
    for (let i = 0; i < Math.min(pairCount, 6); i++) {
      const pId = flat[`pair${i}Id`] as string;
      const term = flat[`pair${i}Term`] as string;
      const match = flat[`pair${i}Match`] as string;
      if (!pId || !term || !match) continue;
      pairs.push({
        id: pId,
        term,
        termEmoji: (flat[`pair${i}TermEmoji`] as string) || undefined,
        match,
        matchEmoji: (flat[`pair${i}MatchEmoji`] as string) || undefined,
      });
    }
    return { id, type, instruction, pairs };
  }

  // binary_sort or ternary_sort — reconstruct words array
  const wordCount = (flat.wordCount as number) || 0;
  const words = [];
  for (let i = 0; i < Math.min(wordCount, 10); i++) {
    const wId = flat[`word${i}Id`] as string;
    const word = flat[`word${i}Text`] as string;
    const correctBucket = flat[`word${i}CorrectBucket`] as string;
    if (!wId || !word || !correctBucket) continue;
    words.push({
      id: wId,
      word,
      emoji: (flat[`word${i}Emoji`] as string) || undefined,
      correctBucket,
    });
  }

  return { id, type, instruction, bucketLabels, words };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate word sorter data using Gemini AI
 *
 * Creates interactive word sorting activities for K-2 literacy instruction.
 * Students drag word cards into category buckets for grammar, vocabulary,
 * and comprehension sorting activities.
 *
 * Challenge types:
 * - binary_sort: 2 buckets, 6-8 word cards
 * - ternary_sort: 3 buckets, 8-10 word cards
 * - match_pairs: 5-6 word pairs to match
 *
 * @param topic - Sorting topic or theme (e.g., "Animals", "Action Words")
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional partial configuration to override generated values
 * @returns WordSorterData with grade-appropriate word sorting challenges
 */
export const generateWordSorter = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<WordSorterData & { targetEvalMode: string }>
): Promise<WordSorterData> => {

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'word-sorter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('WordSorter', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(wordSorterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'type',
      })
    : wordSorterSchema;

  // Grade-specific guidelines
  const gradeGuidelines: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- Use very simple, high-frequency words children know (cat, dog, big, run, red, etc.)
- binary_sort: Use concrete categories (animals/food, big/small, colors)
- ternary_sort: Simple 3-way sorts (animals/food/toys)
- match_pairs: Simple opposites (big/small, hot/cold) or rhyming pairs (cat/hat)
- Every word card MUST have an emoji for visual engagement
- 6 words for binary_sort, 8 words for ternary_sort, 5 pairs for match_pairs
- Use short 1-syllable words whenever possible
- Instructions should be warm and encouraging
`,
    '1': `
GRADE 1 GUIDELINES:
- Use grade 1 vocabulary (sight words, CVC words, common nouns/verbs)
- binary_sort: Nouns vs verbs, singular vs plural, beginning sounds
- ternary_sort: Parts of speech (noun/verb/adjective), vowel sounds
- match_pairs: Singular→plural, word→opposite, word→rhyme
- Include emojis for most word cards
- 7 words for binary_sort, 9 words for ternary_sort, 5-6 pairs for match_pairs
- Instructions should be clear and direct
`,
    '2': `
GRADE 2 GUIDELINES:
- Use grade 2 vocabulary including common academic words
- binary_sort: Past/present tense, compound/not compound, long/short vowel
- ternary_sort: Past/present/future tense, noun/verb/adjective
- match_pairs: Word→synonym, word→antonym, base→past tense
- Include emojis where they add clarity
- 8 words for binary_sort, 10 words for ternary_sort, 6 pairs for match_pairs
- Instructions can include simple grammatical terms students have learned
`,
  };

  const gradeLevelKey = ['K', '1', '2'].includes(gradeLevel) ? gradeLevel : 'K';

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create an interactive word sorting activity for: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${!evalConstraint ? (gradeGuidelines[gradeLevelKey] || gradeGuidelines['K']) : ''}

${challengeTypeSection}

REQUIRED FIELDS:

1. **title**: An engaging, kid-friendly title for the activity
2. **gradeLevel**: "${gradeLevelKey}"
3. **sortingTopic**: A short label for the sorting theme (e.g., "Parts of Speech", "Opposites")
4. **challenges** (3-4 challenges):

   For EACH challenge provide:
   - id: Unique identifier (ch1, ch2, ch3, ch4)
   - type: One of "binary_sort", "ternary_sort", or "match_pairs"
   - instruction: Clear instruction for the student

   FOR binary_sort challenges:
   - bucketLabel0: First bucket name (e.g., "Nouns")
   - bucketLabel1: Second bucket name (e.g., "Verbs")
   - bucketLabel2: Leave as empty string ""
   - wordCount: Number of words (6-8)
   - word0Id through word[N]Id: Unique IDs (w0, w1, ...)
   - word0Text through word[N]Text: The word to display
   - word0Emoji through word[N]Emoji: An emoji for the word (use "" if none)
   - word0CorrectBucket through word[N]CorrectBucket: Must EXACTLY match bucketLabel0 or bucketLabel1

   FOR ternary_sort challenges:
   - bucketLabel0: First bucket name
   - bucketLabel1: Second bucket name
   - bucketLabel2: Third bucket name
   - wordCount: Number of words (8-10)
   - Same word fields as binary_sort, but correctBucket can match any of the 3 labels

   FOR match_pairs challenges:
   - pairCount: Number of pairs (5-6)
   - pair0Id through pair[N]Id: Unique IDs (p0, p1, ...)
   - pair0Term through pair[N]Term: The term word
   - pair0TermEmoji through pair[N]TermEmoji: Emoji for term (use "" if none)
   - pair0Match through pair[N]Match: The matching word
   - pair0MatchEmoji through pair[N]MatchEmoji: Emoji for match (use "" if none)
   - wordCount: 0 (no words for match_pairs)
   - bucketLabel0, bucketLabel1, bucketLabel2: all empty string ""

CRITICAL RULES:
- Each word's correctBucket must EXACTLY match one of the bucketLabel values
- Words should be evenly distributed across buckets (not all in one bucket)
- For match_pairs, terms and matches should be clearly related
- Use age-appropriate vocabulary for grade ${gradeLevelKey}
- Include emojis on word cards for K and grade 1 (every card should have one)
- Do NOT reveal answers through the instruction text or card ordering
- Mix up the order of words/pairs so they are NOT pre-sorted
- Unused word/pair slots should have empty string values

Now generate a word sorting activity for "${topic}" at grade level ${gradeLevelKey}. Create 3-4 varied challenges.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 literacy educator specializing in vocabulary, grammar, and word categorization. You create engaging, age-appropriate word sorting activities that teach students about parts of speech, word relationships, and language patterns. You understand developmental progression from kindergarten through grade 2. You make learning fun and accessible, using emojis and familiar vocabulary that excite young learners. You always ensure educational accuracy and provide clear, helpful instructions.`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const raw = JSON.parse(text) as {
      title: string;
      description?: string;
      gradeLevel: string;
      sortingTopic: string;
      challenges: FlatChallenge[];
    };

    // Reconstruct nested arrays from flat fields
    const challenges = (raw.challenges || []).map(reconstructChallenge);

    // Merge with any config overrides (excluding targetEvalMode)
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;

    const finalData: WordSorterData = {
      title: raw.title || `Word Sorting: ${topic}`,
      description: raw.description,
      gradeLevel: raw.gradeLevel || gradeLevelKey,
      sortingTopic: raw.sortingTopic || topic,
      challenges,
      ...configRest,
    };

    console.log('Word Sorter Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      sortingTopic: finalData.sortingTopic,
      challengeCount: finalData.challenges?.length || 0,
      challengeTypes: finalData.challenges?.map(ch => ch.type) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating word sorter:", error);
    throw error;
  }
};
