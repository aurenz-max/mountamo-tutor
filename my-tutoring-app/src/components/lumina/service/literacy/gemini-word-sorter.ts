import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
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

function buildBinarySortSchema(gradeKey: string): Schema {
  const wordProps: Record<string, Schema> = {};
  for (let i = 0; i < 8; i++) {
    wordProps[`word${i}Text`] = { type: Type.STRING, description: `Word ${i} display text` };
    wordProps[`word${i}Emoji`] = { type: Type.STRING, description: `Word ${i} emoji — a single emoji that SHOWS the word's meaning` };
    wordProps[`word${i}Bucket`] = { type: Type.STRING, description: `Word ${i} correct bucket — must exactly match bucket0 or bucket1` };
  }

  // K students are pre-readers: emoji are the answer surface, so they are
  // REQUIRED at K (a text-only draw strands a non-reader — reader-fit RF-4).
  const emojiRequired = gradeKey === 'K'
    ? ['bucket0Emoji', 'bucket1Emoji',
      'word0Emoji', 'word1Emoji', 'word2Emoji', 'word3Emoji', 'word4Emoji', 'word5Emoji']
    : [];

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
            bucket0Emoji: { type: Type.STRING, description: "Single emoji that SHOWS what bucket0 means (pre-reader answer surface)" },
            bucket1: { type: Type.STRING, description: "Second bucket label (e.g., 'Verbs')" },
            bucket1Emoji: { type: Type.STRING, description: "Single emoji that SHOWS what bucket1 means" },
            wordCount: { type: Type.INTEGER, description: "Number of words (6-8)" },
            ...wordProps,
          },
          required: ["id", "instruction", "bucket0", "bucket1", "wordCount",
            "word0Text", "word0Bucket", "word1Text", "word1Bucket",
            "word2Text", "word2Bucket", "word3Text", "word3Bucket",
            "word4Text", "word4Bucket", "word5Text", "word5Bucket",
            ...emojiRequired],
        },
        description: "3-4 binary sort challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

function buildTernarySortSchema(gradeKey: string): Schema {
  const wordProps: Record<string, Schema> = {};
  for (let i = 0; i < 10; i++) {
    wordProps[`word${i}Text`] = { type: Type.STRING, description: `Word ${i} display text` };
    wordProps[`word${i}Emoji`] = { type: Type.STRING, description: `Word ${i} emoji — a single emoji that SHOWS the word's meaning` };
    wordProps[`word${i}Bucket`] = { type: Type.STRING, description: `Word ${i} correct bucket — must exactly match bucket0, bucket1, or bucket2` };
  }

  // Required at K — pre-readers sort by picture, not print (reader-fit RF-4).
  const emojiRequired = gradeKey === 'K'
    ? ['bucket0Emoji', 'bucket1Emoji', 'bucket2Emoji',
      'word0Emoji', 'word1Emoji', 'word2Emoji', 'word3Emoji',
      'word4Emoji', 'word5Emoji', 'word6Emoji', 'word7Emoji']
    : [];

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
            bucket0Emoji: { type: Type.STRING, description: "Single emoji that SHOWS what bucket0 means" },
            bucket1: { type: Type.STRING, description: "Second bucket label" },
            bucket1Emoji: { type: Type.STRING, description: "Single emoji that SHOWS what bucket1 means" },
            bucket2: { type: Type.STRING, description: "Third bucket label" },
            bucket2Emoji: { type: Type.STRING, description: "Single emoji that SHOWS what bucket2 means" },
            wordCount: { type: Type.INTEGER, description: "Number of words (8-10)" },
            ...wordProps,
          },
          required: ["id", "instruction", "bucket0", "bucket1", "bucket2", "wordCount",
            "word0Text", "word0Bucket", "word1Text", "word1Bucket",
            "word2Text", "word2Bucket", "word3Text", "word3Bucket",
            "word4Text", "word4Bucket", "word5Text", "word5Bucket",
            "word6Text", "word6Bucket", "word7Text", "word7Bucket",
            ...emojiRequired],
        },
        description: "3-4 ternary sort challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

function buildMatchPairsSchema(gradeKey: string): Schema {
  const pairProps: Record<string, Schema> = {};
  for (let i = 0; i < 6; i++) {
    pairProps[`pair${i}Term`] = { type: Type.STRING, description: `Pair ${i} term word` };
    pairProps[`pair${i}TermEmoji`] = { type: Type.STRING, description: `Pair ${i} term emoji — a single emoji that SHOWS the term's meaning` };
    pairProps[`pair${i}Match`] = { type: Type.STRING, description: `Pair ${i} matching word` };
    pairProps[`pair${i}MatchEmoji`] = { type: Type.STRING, description: `Pair ${i} match emoji — a single emoji that SHOWS the match's meaning` };
  }

  // Required at K-1 — every observed K/1 draw shipped the match column with
  // zero emojis, leaving pure print for children who cannot read it (RF-4).
  const emojiRequired = (gradeKey === 'K' || gradeKey === '1')
    ? ['pair0TermEmoji', 'pair0MatchEmoji', 'pair1TermEmoji', 'pair1MatchEmoji',
      'pair2TermEmoji', 'pair2MatchEmoji', 'pair3TermEmoji', 'pair3MatchEmoji',
      'pair4TermEmoji', 'pair4MatchEmoji']
    : [];

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
            "pair4Term", "pair4Match",
            ...emojiRequired],
        },
        description: "3-4 match pairs challenges",
      },
    },
    required: ["title", "sortingTopic", "challenges"],
  };
}

// ---------------------------------------------------------------------------
// Shuffle utility — Fisher-Yates
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

  // Bucket emojis (pre-reader answer surface) — index-aligned with bucketLabels
  const bucketEmojis = bucketLabels.map((_, i) => (flat[`bucket${i}Emoji`] as string) || '');
  const hasBucketEmojis = bucketEmojis.some(e => e);

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
    ...(hasBucketEmojis ? { bucketEmojis } : {}),
    words: shuffleArray(words),
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
    pairs: shuffleArray(pairs),
  };
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

async function generateBinarySortChallenges(
  topic: string,
  gradeKey: string,
  intent?: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive 2-BUCKET word sorting activity for "${topic}" (Grade ${gradeKey}).
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean the words and sorting categories toward "${intent}" when possible — but always keep the sort age-appropriate and the categories unambiguous. Never reveal the sort answer in the focus.\n` : ''}
${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear sorting instruction (e.g., "Sort these words into nouns and verbs")
- bucket0, bucket1: Two category labels
- bucket0Emoji, bucket1Emoji: ONE emoji that visually SHOWS each category (pre-readers sort by picture)
- wordCount: 6-8 words
- word0Text..word7Text: The words to sort
- word0Emoji..word7Emoji: Emoji for each word (REQUIRED for K — the emoji must show the word's meaning; recommended for grade 1-2)
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
      responseSchema: buildBinarySortSchema(gradeKey),
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
  intent?: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive 3-BUCKET word sorting activity for "${topic}" (Grade ${gradeKey}).
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean the words and sorting categories toward "${intent}" when possible — but always keep the sort age-appropriate and the categories unambiguous. Never reveal the sort answer in the focus.\n` : ''}
${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear sorting instruction (e.g., "Sort these words by tense")
- bucket0, bucket1, bucket2: Three category labels
- bucket0Emoji..bucket2Emoji: ONE emoji that visually SHOWS each category (pre-readers sort by picture)
- wordCount: 8-10 words
- word0Text..word9Text: The words to sort
- word0Emoji..word9Emoji: Emoji for each word (REQUIRED for K — the emoji must show the word's meaning)
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
      responseSchema: buildTernarySortSchema(gradeKey),
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
  intent?: string,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const prompt = `Create an interactive word PAIR MATCHING activity for "${topic}" (Grade ${gradeKey}).
${intent ? `\nSPECIFIC FOCUS: Beyond the topic "${topic}", lean the terms and matches toward "${intent}" when possible — but always keep the pairing age-appropriate and unambiguous. Never reveal the match answer in the focus.\n` : ''}
${GRADE_GUIDELINES[gradeKey] || GRADE_GUIDELINES['K']}

For each challenge:
- instruction: Clear matching instruction (e.g., "Match each word with its opposite")
- pairCount: 5-6 pairs
- pair0Term..pair5Term: The term words (left column)
- pair0TermEmoji..pair5TermEmoji: Emoji for each term (REQUIRED for K-1 — must show the word's meaning)
- pair0Match..pair5Match: The matching words (right column)
- pair0MatchEmoji..pair5MatchEmoji: Emoji for each match (REQUIRED for K-1 — young students match by picture, not print)

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
      responseSchema: buildMatchPairsSchema(gradeKey),
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
type WordSorterConfig = Partial<WordSorterData & { targetEvalMode: string }>;

export const generateWordSorter = async (
  ctx: GenerationContext,
): Promise<WordSorterData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as WordSorterConfig;

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'word-sorter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('WordSorter', config?.targetEvalMode, evalConstraint);

  // Prefer the canonical curriculum grade (ctx.grade); resolveGradeKey read the
  // prose gradeContext, which never matched ['K','1','2'] → pinned every objective
  // to 'K' (grades 1-2 got kindergarten vocab). grade>2 clamps to '2' (K-2 primitive).
  const gradeKey = clampGradeToK2(ctx.grade, resolveGradeKey(gradeLevel) as "K" | "1" | "2");

  // ── Determine which modes to generate ───────────────────────────────
  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['binary_sort', 'ternary_sort', 'match_pairs'];

  // ── Dispatch per-mode sub-generators in parallel ────────────────────
  type SubResult = { title: string; sortingTopic: string; challenges: WordSorterChallenge[] };
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('binary_sort')) {
    generators.push(generateBinarySortChallenges(topic, gradeKey, intent));
  }
  if (allowedTypes.includes('ternary_sort')) {
    generators.push(generateTernarySortChallenges(topic, gradeKey, intent));
  }
  if (allowedTypes.includes('match_pairs')) {
    generators.push(generateMatchPairsChallenges(topic, gradeKey, intent));
  }

  const subResults = await Promise.all(generators);

  // ── Combine results ─────────────────────────────────────────────────
  const allChallenges = subResults.flatMap((r) => r.challenges);

  // De-duplicate IDs — each sub-generator independently produces ch1, ch2, …
  // so IDs collide across types, causing recordResult to overwrite instead of
  // append and allChallengesComplete to never become true.
  allChallenges.forEach((ch, i) => {
    ch.id = `${ch.type}-${i}`;
  });
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
