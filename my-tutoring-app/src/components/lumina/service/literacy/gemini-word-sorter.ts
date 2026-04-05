import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  WordSorterData,
  WordSorterChallenge,
} from '../../primitives/visual-primitives/literacy/WordSorter';
import {
  resolveEvalModeConstraint,
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
// Grade-specific guidelines
// ---------------------------------------------------------------------------

const GRADE_GUIDELINES: Record<string, string> = {
  'K': `KINDERGARTEN: Use very simple, high-frequency 1-syllable words (cat, dog, big, run, red). `
    + `Concrete categories (animals/food, big/small). Every word card MUST have an emoji. Warm, encouraging instructions.`,
  '1': `GRADE 1: Use grade 1 vocabulary (sight words, CVC words, common nouns/verbs). `
    + `Include emojis for most word cards. Clear, direct instructions.`,
  '2': `GRADE 2: Use grade 2 vocabulary including common academic words. `
    + `Include emojis where they add clarity. Can include simple grammatical terms.`,
};

function resolveGradeKey(gradeLevel: string): string {
  if (['K', '1', '2'].includes(gradeLevel)) return gradeLevel;
  return 'K';
}

const SYSTEM_INSTRUCTION =
  `You are an expert K-2 literacy educator specializing in vocabulary, grammar, and word categorization. `
  + `You create engaging, age-appropriate word sorting activities. You ensure educational accuracy and provide clear instructions.`;

// ---------------------------------------------------------------------------
// Per-mode schemas — focused, minimal fields
// ---------------------------------------------------------------------------

function buildBinarySortSchema(): Schema {
  const wordProps: Record<string, Schema> = {};
  for (let i = 0; i < 8; i++) {
    wordProps[`word${i}Text`] = { type: Type.STRING, description: `Word ${i} display text` };
    wordProps[`word${i}Emoji`] = { type: Type.STRING, description: `Word ${i} emoji` };
    wordProps[`word${i}Bucket`] = { type: Type.STRING, description: `Word ${i} correct bucket — must exactly match bucket0 or bucket1` };
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the sorting activity" },
      sortingTopic: { type: Type.STRING, description: "Short label for the sorting theme" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (ch1, ch2, ...)" },
            instruction: { type: Type.STRING, description: "Clear instruction for the student" },
            bucket0: { type: Type.STRING, description: "First bucket label (e.g., 'Nouns')" },
            bucket1: { type: Type.STRING, description: "Second bucket label (e.g., 'Verbs')" },
            wordCount: { type: Type.INTEGER, description: "Number of words (6-8)" },
            ...wordProps,
          },
          required: ["id", "instruction", "bucket0", "bucket1", "wordCount",
            "word0Text", "word0Bucket", "word1Text", "word1Bucket",
            "word2Text", "word2Bucket", "word3Text", "word3Bucket",
            "word4Text", "word4Bucket", "word5Text", "word5Bucket"],
        },
        description: "3-4 binary sort challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

function buildTernarySortSchema(): Schema {
  const wordProps: Record<string, Schema> = {};
  for (let i = 0; i < 10; i++) {
    wordProps[`word${i}Text`] = { type: Type.STRING, description: `Word ${i} display text` };
    wordProps[`word${i}Emoji`] = { type: Type.STRING, description: `Word ${i} emoji` };
    wordProps[`word${i}Bucket`] = { type: Type.STRING, description: `Word ${i} correct bucket — must exactly match bucket0, bucket1, or bucket2` };
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the sorting activity" },
      sortingTopic: { type: Type.STRING, description: "Short label for the sorting theme" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (ch1, ch2, ...)" },
            instruction: { type: Type.STRING, description: "Clear instruction for the student" },
            bucket0: { type: Type.STRING, description: "First bucket label" },
            bucket1: { type: Type.STRING, description: "Second bucket label" },
            bucket2: { type: Type.STRING, description: "Third bucket label" },
            wordCount: { type: Type.INTEGER, description: "Number of words (8-10)" },
            ...wordProps,
          },
          required: ["id", "instruction", "bucket0", "bucket1", "bucket2", "wordCount",
            "word0Text", "word0Bucket", "word1Text", "word1Bucket",
            "word2Text", "word2Bucket", "word3Text", "word3Bucket",
            "word4Text", "word4Bucket", "word5Text", "word5Bucket",
            "word6Text", "word6Bucket", "word7Text", "word7Bucket"],
        },
        description: "3-4 ternary sort challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

function buildMatchPairsSchema(): Schema {
  const pairProps: Record<string, Schema> = {};
  for (let i = 0; i < 6; i++) {
    pairProps[`pair${i}Term`] = { type: Type.STRING, description: `Pair ${i} term word` };
    pairProps[`pair${i}TermEmoji`] = { type: Type.STRING, description: `Pair ${i} term emoji` };
    pairProps[`pair${i}Match`] = { type: Type.STRING, description: `Pair ${i} matching word` };
    pairProps[`pair${i}MatchEmoji`] = { type: Type.STRING, description: `Pair ${i} match emoji` };
  }

  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the matching activity" },
      sortingTopic: { type: Type.STRING, description: "Short label for the matching theme" },
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique ID (ch1, ch2, ...)" },
            instruction: { type: Type.STRING, description: "Clear instruction for the student" },
            pairCount: { type: Type.INTEGER, description: "Number of pairs (5-6)" },
            ...pairProps,
          },
          required: ["id", "instruction", "pairCount",
            "pair0Term", "pair0Match", "pair1Term", "pair1Match",
            "pair2Term", "pair2Match", "pair3Term", "pair3Match",
            "pair4Term", "pair4Match"],
        },
        description: "3-4 match pairs challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Flat → structured reconstruction helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function reconstructSortChallenge(
  flat: FlatChallenge,
  type: 'binary_sort' | 'ternary_sort',
): WordSorterChallenge | null {
  const bucketLabels: string[] = [];
  if (flat.bucket0) bucketLabels.push(flat.bucket0 as string);
  if (flat.bucket1) bucketLabels.push(flat.bucket1 as string);
  if (type === 'ternary_sort' && flat.bucket2) bucketLabels.push(flat.bucket2 as string);

  const expectedBuckets = type === 'binary_sort' ? 2 : 3;
  if (bucketLabels.length < expectedBuckets) {
    console.warn(`[WordSorter] Rejected ${type} challenge: only ${bucketLabels.length}/${expectedBuckets} buckets`);
    return null;
  }

  const maxWords = type === 'binary_sort' ? 8 : 10;
  const wordCount = typeof flat.wordCount === 'number' ? Math.min(flat.wordCount, maxWords) : maxWords;
  const words = [];

  for (let i = 0; i < wordCount; i++) {
    const text = flat[`word${i}Text`] as string | undefined;
    const bucket = flat[`word${i}Bucket`] as string | undefined;
    if (!text || !bucket) continue;

    // Validate bucket matches one of the actual labels
    const matchedBucket = bucketLabels.find(
      (b) => b === bucket || b.toLowerCase() === bucket.toLowerCase(),
    );
    if (!matchedBucket) {
      console.warn(`[WordSorter] Skipped word "${text}" — bucket "${bucket}" not in [${bucketLabels.join(', ')}]`);
      continue;
    }

    words.push({
      id: `w${i}`,
      word: text,
      emoji: (flat[`word${i}Emoji`] as string) || undefined,
      correctBucket: matchedBucket,
    });
  }

  const minWords = type === 'binary_sort' ? 4 : 6;
  if (words.length < minWords) {
    console.warn(`[WordSorter] Rejected ${type} challenge: only ${words.length}/${minWords} valid words`);
    return null;
  }

  return {
    id: flat.id as string,
    type,
    instruction: flat.instruction as string,
    bucketLabels,
    words,
  };
}

function reconstructMatchPairsChallenge(flat: FlatChallenge): WordSorterChallenge | null {
  const pairCount = typeof flat.pairCount === 'number' ? Math.min(flat.pairCount, 6) : 6;
  const pairs = [];

  for (let i = 0; i < Math.max(pairCount, 6); i++) {
    const term = flat[`pair${i}Term`] as string | undefined;
    const match = flat[`pair${i}Match`] as string | undefined;
    if (!term || !match) continue;

    pairs.push({
      id: `p${i}`,
      term,
      termEmoji: (flat[`pair${i}TermEmoji`] as string) || undefined,
      match,
      matchEmoji: (flat[`pair${i}MatchEmoji`] as string) || undefined,
    });
  }

  if (pairs.length < 3) {
    console.warn(`[WordSorter] Rejected match_pairs challenge: only ${pairs.length}/3 valid pairs`);
    return null;
  }

  return {
    id: flat.id as string,
    type: 'match_pairs',
    instruction: flat.instruction as string,
    pairs,
  };
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

async function generateBinarySortChallenges(
  topic: string,
  gradeKey: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive 2-BUCKET word sorting activity for "${topic}" (Grade ${gradeKey}).

${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear sorting instruction (e.g., "Sort these words into nouns and verbs")
- bucket0, bucket1: Two category labels
- wordCount: 6-8 words
- word0Text..word7Text: The words to sort
- word0Emoji..word7Emoji: Emoji for each word (required for K, recommended for grade 1-2)
- word0Bucket..word7Bucket: Must EXACTLY match bucket0 or bucket1

RULES:
- Distribute words roughly evenly across the 2 buckets
- Mix up word order — do NOT group by bucket
- Do NOT reveal answers in the instruction
- All words must be age-appropriate for grade ${gradeKey}

Generate 3-4 challenges with different sorting criteria.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildBinarySortSchema(),
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: '', sortingTopic: '', challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat) => reconstructSortChallenge(flat, 'binary_sort'))
    .filter((c): c is WordSorterChallenge => c !== null);

  const rejected = (data.challenges as FlatChallenge[]).length - challenges.length;
  if (rejected > 0) {
    console.warn(`[WordSorter] binary_sort: rejected ${rejected} challenge(s) with missing data`);
  }

  return {
    title: (data.title as string) || '',
    sortingTopic: (data.sortingTopic as string) || '',
    challenges,
  };
}

async function generateTernarySortChallenges(
  topic: string,
  gradeKey: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive 3-BUCKET word sorting activity for "${topic}" (Grade ${gradeKey}).

${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear sorting instruction (e.g., "Sort these words by tense")
- bucket0, bucket1, bucket2: Three category labels
- wordCount: 8-10 words
- word0Text..word9Text: The words to sort
- word0Emoji..word9Emoji: Emoji for each word
- word0Bucket..word9Bucket: Must EXACTLY match bucket0, bucket1, or bucket2

RULES:
- Distribute words across all 3 buckets (at least 2 per bucket)
- Mix up word order — do NOT group by bucket
- Do NOT reveal answers in the instruction
- All words must be age-appropriate for grade ${gradeKey}

Generate 3-4 challenges with different sorting criteria.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildTernarySortSchema(),
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: '', sortingTopic: '', challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat) => reconstructSortChallenge(flat, 'ternary_sort'))
    .filter((c): c is WordSorterChallenge => c !== null);

  const rejected = (data.challenges as FlatChallenge[]).length - challenges.length;
  if (rejected > 0) {
    console.warn(`[WordSorter] ternary_sort: rejected ${rejected} challenge(s) with missing data`);
  }

  return {
    title: (data.title as string) || '',
    sortingTopic: (data.sortingTopic as string) || '',
    challenges,
  };
}

async function generateMatchPairsChallenges(
  topic: string,
  gradeKey: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive word PAIR MATCHING activity for "${topic}" (Grade ${gradeKey}).

${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear matching instruction (e.g., "Match each word with its opposite")
- pairCount: 5-6 pairs
- pair0Term..pair5Term: The term words (left column)
- pair0TermEmoji..pair5TermEmoji: Emoji for each term
- pair0Match..pair5Match: The matching words (right column)
- pair0MatchEmoji..pair5MatchEmoji: Emoji for each match

RULES:
- Each pair should have a clear, unambiguous relationship (opposites, synonyms, singular/plural, etc.)
- Do NOT reveal answers through ordering — randomize the match column
- All words must be age-appropriate for grade ${gradeKey}
- For K: use simple opposites (big/small, hot/cold) or rhyming pairs (cat/hat)
- For grade 1-2: can include singular/plural, word/antonym, word/synonym

Generate 3-4 challenges with different matching criteria.`;

  const result = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: buildMatchPairsSchema(),
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: '', sortingTopic: '', challenges: [] };

  const challenges = (data.challenges as FlatChallenge[])
    .map((flat) => reconstructMatchPairsChallenge(flat))
    .filter((c): c is WordSorterChallenge => c !== null);

  const rejected = (data.challenges as FlatChallenge[]).length - challenges.length;
  if (rejected > 0) {
    console.warn(`[WordSorter] match_pairs: rejected ${rejected} challenge(s) with missing data`);
  }

  return {
    title: (data.title as string) || '',
    sortingTopic: (data.sortingTopic as string) || '',
    challenges,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate word sorter data using Gemini AI
 *
 * Creates interactive word sorting activities for K-2 literacy instruction.
 * Students drag word cards into category buckets for grammar, vocabulary,
 * and comprehension sorting activities.
 *
 * Uses per-mode sub-generators (orchestrator pattern) to avoid Gemini Flash
 * Lite dropping flat indexed fields in overly complex schemas (SP-14).
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

  const gradeKey = resolveGradeKey(gradeLevel);

  // ── Determine which modes to generate ───────────────────────────────
  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['binary_sort', 'ternary_sort', 'match_pairs'];

  // ── Dispatch per-mode sub-generators in parallel ────────────────────
  type SubResult = { title: string; sortingTopic: string; challenges: WordSorterChallenge[] };
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('binary_sort')) {
    generators.push(generateBinarySortChallenges(topic, gradeKey));
  }
  if (allowedTypes.includes('ternary_sort')) {
    generators.push(generateTernarySortChallenges(topic, gradeKey));
  }
  if (allowedTypes.includes('match_pairs')) {
    generators.push(generateMatchPairsChallenges(topic, gradeKey));
  }

  const subResults = await Promise.all(generators);

  // ── Combine results ─────────────────────────────────────────────────
  const allChallenges = subResults.flatMap((r) => r.challenges);
  const firstTitle = subResults.find((r) => r.title)?.title || `Word Sorting: ${topic}`;
  const firstTopic = subResults.find((r) => r.sortingTopic)?.sortingTopic || topic;

  // Merge with any config overrides (excluding targetEvalMode)
  const { targetEvalMode: _unused, ...configRest } = config ?? {};
  void _unused;

  const finalData: WordSorterData = {
    title: firstTitle,
    gradeLevel: gradeKey,
    sortingTopic: firstTopic,
    challenges: allChallenges,
    ...configRest,
  };

  console.log('Word Sorter Generated:', {
    title: finalData.title,
    gradeLevel: finalData.gradeLevel,
    sortingTopic: finalData.sortingTopic,
    challengeCount: finalData.challenges?.length || 0,
    challengeTypes: finalData.challenges?.map(ch => ch.type) || [],
  });

  if (allChallenges.length === 0) {
    throw new Error(`[WordSorter] All challenges rejected after generation — no valid data for types [${allowedTypes.join(', ')}]`);
  }

  return finalData;
};
