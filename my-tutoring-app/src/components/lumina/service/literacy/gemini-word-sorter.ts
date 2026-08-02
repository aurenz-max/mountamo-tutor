import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { clampGradeToK2 } from "../scopeContext";
import {
  WordSorterData,
  WordSorterChallenge,
  type DistractorMatch,
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

// ---------------------------------------------------------------------------
// Within-mode SUPPORT TIER (config.difficulty → ctx.supportTier).
//
// A tier withdraws HELP. It NEVER changes which words / categories / pairs get
// drawn (the schema and the content prompt are byte-identical at every tier —
// the single tier-shaped prompt clause constrains the instruction SENTENCE's
// wording and says so explicitly), and it never changes which bucket is correct.
//
// Levers (one field each), by modality:
//   #1 perception   showBucketEmojis   — the picture cue on each bucket. Withdrawn
//                                        at hard so the student reads the category
//                                        rather than the icon. FORCED TRUE at K:
//                                        bucket emoji are the pre-reader ANSWER
//                                        SURFACE (schema-required at K, reader-fit
//                                        RF-4) — the band floor always beats a tier.
//   #1 perception   showFiledWords     — the badges of already-filed words sitting
//                                        inside each bucket. Withdrawn at hard so
//                                        the sort criterion cannot be inferred from
//                                        the exemplars already placed. K-safe: the
//                                        staged card, the bucket emoji, and the drop
//                                        zone's fill state are all untouched.
//   #2 instruction  namesSortCriterion — whether the generated instruction NAMES the
//                                        criterion ("Sort these words into nouns and
//                                        verbs") or states the goal only ("Put each
//                                        word where it belongs"). Also collapses the
//                                        component's named error line to "Try again."
//   #5 answer-form  distractorMatches  — match_pairs only: extra NON-answer entries in
//                                        the match column (0 easy / 1 medium / 2 hard).
//                                        Every correct match is still present and
//                                        completion still keys on pairs.length — only
//                                        the discrimination load rises.
//
// NEVER withdrawn: the word-card emoji (that is the STIMULUS, schema-required at
// K/1), the number of bucket labels (that is the eval-mode / β axis — binary stays
// 2, ternary stays 3), or the K staged-word read-aloud ([WORD_STAGED]).
// ---------------------------------------------------------------------------

export type WordSorterSupportTier = 'easy' | 'medium' | 'hard';

export interface WordSorterSupportScaffold {
  /** Show the picture cue on each bucket. Withdrawn at hard — except at K. */
  showBucketEmojis: boolean;
  /** Show the badges of already-filed words inside each bucket. Withdrawn at hard. */
  showFiledWords: boolean;
  /** The instruction names the sort criterion (vs. goal-only phrasing at hard). */
  namesSortCriterion: boolean;
  /** match_pairs: how many non-answer entries to add to the match column. */
  distractorMatchCount: number;
}

/**
 * Resolve the scaffold set for one tier at one grade band.
 *
 * BAND FLOOR: at K the bucket emoji ARE the pre-reader answer surface (a K child
 * cannot read "Animals"), so they are forced on at every tier. Nothing the PRE
 * band needs is withdrawn by a tier.
 */
export function resolveWordSorterSupport(
  tier: WordSorterSupportTier,
  gradeKey: string,
): WordSorterSupportScaffold {
  const isPreReader = gradeKey === 'K';
  return {
    showBucketEmojis: isPreReader ? true : tier !== 'hard',
    showFiledWords: tier !== 'hard',
    namesSortCriterion: tier !== 'hard',
    distractorMatchCount: tier === 'hard' ? 2 : tier === 'medium' ? 1 : 0,
  };
}

/**
 * The ONE tier-shaped prompt clause. It constrains how the instruction SENTENCE is
 * worded and says so out loud, so it cannot steer which words or categories the
 * model picks. The tier's NAME never reaches the prompt.
 */
function instructionWordingRule(namesSortCriterion: boolean): string {
  return namesSortCriterion
    ? '- instruction WORDING: name the sorting/matching criterion inside the sentence '
      + '(e.g., "Sort these words into nouns and verbs", "Match each word with its opposite")'
    : '- instruction WORDING: state the GOAL ONLY — write a bare directive such as "Put each word where it belongs" '
      + 'or "Match each word with its partner". Do NOT name the categories, the relationship, or the sorting rule '
      + 'anywhere in the instruction sentence. This is a WORDING rule ONLY: choose exactly the same words, categories '
      + 'and pairs you would have chosen otherwise';
}

export type { DistractorMatch };

/**
 * Choose up to `count` decoy entries for the match column (#5 answer-form lever).
 *
 * Every guard here is an ANSWER-LEAK guard — a distractor a student can spot
 * WITHOUT solving the task makes the item easier, not harder:
 *  - never duplicates a real match or a real term (case-insensitive),
 *  - never duplicates another decoy,
 *  - must be visually indistinguishable from the real matches: if EVERY real match
 *    carries an emoji, a decoy without one is dropped; if NONE do, decoy emoji are
 *    stripped.
 * Deterministic (pool order, no randomness) — the component owns the shuffle.
 */
export function selectDistractorMatches(
  pairs: { term: string; match: string; matchEmoji?: string }[],
  pool: DistractorMatch[],
  count: number,
): DistractorMatch[] {
  if (count <= 0 || pairs.length === 0) return [];
  const allHaveEmoji = pairs.every((p) => !!p.matchEmoji);
  const noneHaveEmoji = pairs.every((p) => !p.matchEmoji);

  const taken = new Set<string>();
  for (const p of pairs) {
    taken.add(p.match.trim().toLowerCase());
    taken.add(p.term.trim().toLowerCase());
  }

  const out: DistractorMatch[] = [];
  for (const d of pool) {
    if (out.length >= count) break;
    const text = (d.text ?? '').trim();
    const key = text.toLowerCase();
    if (!key || taken.has(key)) continue;
    if (allHaveEmoji && !d.emoji) continue;
    taken.add(key);
    out.push({ id: d.id, text, ...(d.emoji && !noneHaveEmoji ? { emoji: d.emoji } : {}) });
  }
  return out;
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

  // Decoy pool for the match column (#5 answer-form support-tier lever). ALWAYS
  // requested, with the SAME schema and the SAME prompt lines at every tier, so
  // asking for decoys can never steer which pairs get drawn. Code decides post-parse
  // how many (0/1/2) are actually shown; at easy / no-tier none are.
  for (let i = 0; i < 2; i++) {
    pairProps[`decoy${i}Word`] = {
      type: Type.STRING,
      description: `Decoy word ${i} — a plausible word that is NOT the partner of ANY term above. `
        + `Same word class and length band as the real match words so it cannot be spotted without solving the task.`,
    };
    pairProps[`decoy${i}Emoji`] = {
      type: Type.STRING,
      description: `Decoy word ${i} emoji — a single emoji that SHOWS the decoy word's meaning`,
    };
  }

  // Required at K-1 — every observed K/1 draw shipped the match column with
  // zero emojis, leaving pure print for children who cannot read it (RF-4).
  // The decoy emoji ride the same rule: a decoy with no picture next to matches
  // that all have one is spottable without solving the task (answer leak).
  const emojiRequired = (gradeKey === 'K' || gradeKey === '1')
    ? ['pair0TermEmoji', 'pair0MatchEmoji', 'pair1TermEmoji', 'pair1MatchEmoji',
      'pair2TermEmoji', 'pair2MatchEmoji', 'pair3TermEmoji', 'pair3MatchEmoji',
      'pair4TermEmoji', 'pair4MatchEmoji', 'decoy0Emoji', 'decoy1Emoji']
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
            "decoy0Word", "decoy1Word",
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
  scaffold?: WordSorterSupportScaffold,
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

  const challenge: WordSorterChallenge = {
    id: flat.id as string,
    type,
    instruction: flat.instruction as string,
    bucketLabels,
    ...(hasBucketEmojis ? { bucketEmojis } : {}),
    words: shuffleArray(words),
  };

  // Support-tier stamps — CODE-side, post-parse, deterministic. Gated ONLY on the
  // scaffold being present: with no tier, no field is written and the payload is
  // byte-identical to the legacy full-help draw.
  if (scaffold) {
    challenge.showBucketEmojis = scaffold.showBucketEmojis;
    challenge.showFiledWords = scaffold.showFiledWords;
    challenge.namesSortCriterion = scaffold.namesSortCriterion;
  }

  return challenge;
}

function reconstructMatchPairsChallenge(
  flat: FlatChallenge,
  scaffold?: WordSorterSupportScaffold,
): WordSorterChallenge | null {
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

  const challenge: WordSorterChallenge = {
    id: flat.id as string,
    type: 'match_pairs',
    instruction: flat.instruction as string,
    pairs: shuffleArray(pairs),
  };

  // Support-tier stamps. match_pairs has no buckets, so only the instruction lever
  // and the answer-form lever apply. The correct partner for every term is ALWAYS
  // present — decoys are added alongside, never substituted in — and completion
  // still keys on pairs.length, so the task identity is unchanged.
  if (scaffold) {
    challenge.namesSortCriterion = scaffold.namesSortCriterion;

    const pool: DistractorMatch[] = [];
    for (let i = 0; i < 2; i++) {
      const text = flat[`decoy${i}Word`] as string | undefined;
      if (!text) continue;
      const emoji = (flat[`decoy${i}Emoji`] as string) || undefined;
      pool.push({ id: `d${i}`, text, ...(emoji ? { emoji } : {}) });
    }
    const decoys = selectDistractorMatches(pairs, pool, scaffold.distractorMatchCount);
    if (decoys.length > 0) challenge.distractorMatches = decoys;
    if (decoys.length < scaffold.distractorMatchCount) {
      console.warn(
        `[WordSorter] match_pairs: only ${decoys.length}/${scaffold.distractorMatchCount} decoy(s) usable `
        + `(leak guards dropped the rest) for challenge ${flat.id as string}`,
      );
    }
  }

  return challenge;
}

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

async function generateBinarySortChallenges(
  topic: string,
  gradeKey: string,
  intent?: string,
  scaffold?: WordSorterSupportScaffold,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const wordingRule = scaffold ? `\n${instructionWordingRule(scaffold.namesSortCriterion)}` : '';
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
- Do NOT reveal answers in the instruction${wordingRule}
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
    .map((flat) => reconstructSortChallenge(flat, 'binary_sort', scaffold))
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
  scaffold?: WordSorterSupportScaffold,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const wordingRule = scaffold ? `\n${instructionWordingRule(scaffold.namesSortCriterion)}` : '';
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
- Do NOT reveal answers in the instruction${wordingRule}
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
    .map((flat) => reconstructSortChallenge(flat, 'ternary_sort', scaffold))
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
  scaffold?: WordSorterSupportScaffold,
): Promise<{ title: string; sortingTopic: string; challenges: WordSorterChallenge[] }> {
  const wordingRule = scaffold ? `\n${instructionWordingRule(scaffold.namesSortCriterion)}` : '';
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
- decoy0Word, decoy1Word: TWO decoy words that are NOT the partner of ANY term — same word class and length band as the real match words, so they look like they belong in the right column
- decoy0Emoji, decoy1Emoji: Emoji for each decoy (REQUIRED for K-1 — a decoy with no picture beside matches that all have one gives itself away)

RULES:
- Each pair should have a clear, unambiguous relationship (opposites, synonyms, singular/plural, etc.)
- Do NOT reveal answers through ordering — randomize the match column${wordingRule}
- The decoy words must NEVER be a correct partner for any term, and must never repeat a term or a match
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
    .map((flat) => reconstructMatchPairsChallenge(flat, scaffold))
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

  // ── Within-mode support tier ────────────────────────────────────────
  // ctx.supportTier is already normalized ('easy' | 'medium' | 'hard' | undefined)
  // by resolveGenerationContext from config.difficulty. Gated ONLY on the tier
  // being present — never on the pinned eval mode — so a blended draw gets the
  // same scaffolding level as a pinned one. Absent ⇒ no scaffold fields at all.
  const supportTier = ctx.supportTier;
  const scaffold = supportTier ? resolveWordSorterSupport(supportTier, gradeKey) : undefined;
  if (scaffold) {
    console.log(`[word-sorter] Support tier "${supportTier}" @ grade ${gradeKey}:`, {
      showBucketEmojis: scaffold.showBucketEmojis,
      showFiledWords: scaffold.showFiledWords,
      namesSortCriterion: scaffold.namesSortCriterion,
      distractorMatchCount: scaffold.distractorMatchCount,
      bandFloor: gradeKey === 'K' ? 'K: bucket emoji forced ON (pre-reader answer surface)' : 'n/a',
    });
  }

  // ── Determine which modes to generate ───────────────────────────────
  const allowedTypes = evalConstraint
    ? evalConstraint.allowedTypes
    : ['binary_sort', 'ternary_sort', 'match_pairs'];

  // ── Dispatch per-mode sub-generators in parallel ────────────────────
  type SubResult = { title: string; sortingTopic: string; challenges: WordSorterChallenge[] };
  const generators: Promise<SubResult>[] = [];

  if (allowedTypes.includes('binary_sort')) {
    generators.push(generateBinarySortChallenges(topic, gradeKey, intent, scaffold));
  }
  if (allowedTypes.includes('ternary_sort')) {
    generators.push(generateTernarySortChallenges(topic, gradeKey, intent, scaffold));
  }
  if (allowedTypes.includes('match_pairs')) {
    generators.push(generateMatchPairsChallenges(topic, gradeKey, intent, scaffold));
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
    // Tell the live tutor the support level so its reveal policy matches the
    // screen. Written LAST so a stray config key can never clobber it.
    ...(supportTier ? { supportTier } : {}),
  };

  console.log('Word Sorter Generated:', {
    title: finalData.title,
    gradeLevel: finalData.gradeLevel,
    sortingTopic: finalData.sortingTopic,
    supportTier: finalData.supportTier ?? '(none)',
    challengeCount: finalData.challenges?.length || 0,
    challengeTypes: finalData.challenges?.map(ch => ch.type) || [],
  });

  if (allChallenges.length === 0) {
    throw new Error(`[WordSorter] All challenges rejected after generation — no valid data for types [${allowedTypes.join(', ')}]`);
  }

  return finalData;
};
