import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  WordWorkoutData,
  WordWorkoutMode,
  WordWorkoutChallenge,
} from "../../primitives/visual-primitives/literacy/WordWorkout";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { buildScopePromptSection, type PedagogicalScope } from "../scopeContext";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'real-vs-nonsense': {
    promptDoc:
      `"real-vs-nonsense": Student sees two CVC words side by side — one real, one nonsense. `
      + `Must identify which is the real word. Tests word recognition and decoding accuracy.`,
    schemaDescription: "'real-vs-nonsense' (identify the real word)",
  },
  'picture-match': {
    promptDoc:
      `"picture-match": Student sees a decoded CVC word and picks the matching picture from 3 options. `
      + `Tests word-meaning connection after decoding.`,
    schemaDescription: "'picture-match' (match word to picture)",
  },
  'word-chains': {
    promptDoc:
      `"word-chains": Student reads a chain of 4-6 CVC words where one letter changes each step (cat→hat→hot→hop). `
      + `Tests fluent single-letter substitution reading.`,
    schemaDescription: "'word-chains' (read chain with one-letter changes)",
  },
  'sentence-reading': {
    promptDoc:
      `"sentence-reading": Student reads a decodable sentence made from CVC + sight words, `
      + `then answers a simple comprehension question. Tests word-in-context fluency.`,
    schemaDescription: "'sentence-reading' (read decodable sentence)",
  },
};

// ============================================================================
// Vowel-scope binding (topic/intent → target short vowel[s])
// ----------------------------------------------------------------------------
// A "short a" decoding objective must keep EVERY generated word on that vowel
// (onset/coda change, vowel fixed). The manifest rarely pins masteredVowels, so
// the default was all five and chains wandered off-scope (cat→bed→tip→top). We
// bind the scope from the objective text, mirror it into the prompt
// (buildScopePromptSection + a hard vowel rule), and code-enforce it with a
// post-parse sanitizer. Reference: gemini-cvc-speller's resolveCvcVowelFocus +
// deterministic sanitizer. See memory: llm-window-code-builds-structure.
// ============================================================================

const ALL_VOWELS = ['a', 'e', 'i', 'o', 'u'];

/**
 * Canonical pre-reader grade key stamped into the returned data so the component
 * can band-gate the child's field (chrome/text) at Kindergarten. Mirrors
 * gemini-letter-sound-link's resolvePreReaderGradeKey — canonical `grade` first,
 * prose `gradeContext` as the fallback. Returns 'K' for Kindergarten, else the
 * numeric grade (reader grades keep the full UI unchanged).
 */
function resolvePreReaderGradeKey(ctx: GenerationContext): string {
  const canonical = (ctx.grade ?? '').toString().trim().toLowerCase();
  if (canonical === 'k' || canonical === '0' || canonical === 'kindergarten') return 'K';
  if (/^\d+$/.test(canonical)) return canonical;
  const prose = (ctx.gradeContext ?? '').toString().toLowerCase();
  if (prose.includes('kindergarten') || /\bgrade\s*k\b/.test(prose) || /^\s*k\b/.test(prose)) return 'K';
  const proseNum = prose.match(/\b(?:grade\s*)?(\d{1,2})\b/);
  if (proseNum) return proseNum[1];
  return canonical || '1';
}

/**
 * Short vowel(s) the objective names, or null if it is vowel-generic (mixed
 * practice). Reads topic + objective + intent so a "short a" lesson binds every
 * word to /a/. Multiple named vowels (rare) all pass through as the scoped set.
 */
function resolveScopedVowels(scope: PedagogicalScope, intent?: string): string[] | null {
  const hay = [scope.topic, scope.objectiveText, scope.intent, intent]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const found = new Set<string>();
  const re = /short[\s-]*['’]?\s*([aeiou])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay)) !== null) found.add(m[1]!);
  return found.size > 0 ? Array.from(found) : null;
}

/** Vowel letters present in a word (a–u only). */
function vowelsIn(word: string): string[] {
  return word.toLowerCase().match(/[aeiou]/g) ?? [];
}

/** True if the word has vowels and every one is inside the scoped set. */
function inVowelScope(word: string, scoped: string[]): boolean {
  const vs = vowelsIn(word);
  return vs.length > 0 && vs.every((v) => scoped.includes(v));
}

/**
 * Deterministic post-parse sanitizer: drop any challenge whose GRADED words
 * leave the vowel scope. Sight words in sentence-reading are exempt (only the
 * decodable cvcWords are bound — sight words like "the"/"on" carry other
 * vowels by nature). Filtering, never fabricating — an emptied mode falls back
 * to a scoped default.
 */
function sanitizeVowelScope(
  mode: WordWorkoutMode,
  challenges: WordWorkoutChallenge[],
  scoped: string[],
): WordWorkoutChallenge[] {
  switch (mode) {
    case 'word-chains':
      return challenges.filter((ch) => (ch.chain ?? []).every((w) => inVowelScope(w, scoped)));
    case 'real-vs-nonsense':
      return challenges.filter(
        (ch) => inVowelScope(ch.realWord ?? '', scoped) && inVowelScope(ch.nonsenseWord ?? '', scoped),
      );
    case 'picture-match':
      return challenges
        .filter((ch) => inVowelScope(ch.targetWord ?? '', scoped))
        .map((ch) => ({
          ...ch,
          distractorImages: (ch.distractorImages ?? []).filter((d) => inVowelScope(d.word, scoped)),
        }))
        .filter((ch) => (ch.distractorImages?.length ?? 0) >= 1);
    case 'sentence-reading':
      return challenges.filter(
        (ch) => (ch.cvcWords ?? []).length >= 3 && (ch.cvcWords ?? []).every((w) => inVowelScope(w, scoped)),
      );
  }
}

// ── Per-vowel scoped fallbacks (only fire on total generation failure; every
//    word sits on the target vowel so a scoped lesson never ships off-vowel). ──

const SCOPED_CHAINS: Record<string, { chain: string[]; changedPositions: number[] }> = {
  a: { chain: ['cat', 'hat', 'had', 'bad'], changedPositions: [0, 2, 0] },
  e: { chain: ['net', 'bet', 'bed', 'led'], changedPositions: [0, 2, 0] },
  i: { chain: ['pin', 'pit', 'sit', 'sip'], changedPositions: [2, 0, 2] },
  o: { chain: ['dog', 'dot', 'cot', 'cop'], changedPositions: [2, 0, 2] },
  u: { chain: ['hut', 'hug', 'bug', 'bun'], changedPositions: [2, 0, 2] },
};
const SCOPED_REAL_NONSENSE: Record<string, Array<{ realWord: string; nonsenseWord: string }>> = {
  a: [{ realWord: 'cat', nonsenseWord: 'zat' }, { realWord: 'map', nonsenseWord: 'vap' }, { realWord: 'bag', nonsenseWord: 'gaf' }],
  e: [{ realWord: 'bed', nonsenseWord: 'zeb' }, { realWord: 'net', nonsenseWord: 'ven' }, { realWord: 'pen', nonsenseWord: 'tep' }],
  i: [{ realWord: 'pig', nonsenseWord: 'zib' }, { realWord: 'pin', nonsenseWord: 'nin' }, { realWord: 'sit', nonsenseWord: 'rit' }],
  o: [{ realWord: 'dog', nonsenseWord: 'zot' }, { realWord: 'pot', nonsenseWord: 'vop' }, { realWord: 'mop', nonsenseWord: 'nop' }],
  u: [{ realWord: 'bus', nonsenseWord: 'zub' }, { realWord: 'cup', nonsenseWord: 'vup' }, { realWord: 'mug', nonsenseWord: 'nug' }],
};
const SCOPED_PICTURE: Record<string, { targetWord: string; targetImage: string; distractorImages: Array<{ word: string; image: string }> }> = {
  a: { targetWord: 'cat', targetImage: '🐱', distractorImages: [{ word: 'bat', image: '🦇' }, { word: 'rat', image: '🐀' }] },
  e: { targetWord: 'hen', targetImage: '🐔', distractorImages: [{ word: 'bed', image: '🛏️' }, { word: 'net', image: '🥅' }] },
  i: { targetWord: 'pig', targetImage: '🐷', distractorImages: [{ word: 'pin', image: '📌' }, { word: 'bin', image: '🗑️' }] },
  o: { targetWord: 'dog', targetImage: '🐶', distractorImages: [{ word: 'fox', image: '🦊' }, { word: 'box', image: '📦' }] },
  u: { targetWord: 'bus', targetImage: '🚌', distractorImages: [{ word: 'cup', image: '🥤' }, { word: 'sun', image: '☀️' }] },
};
const SCOPED_SENTENCE: Record<string, { sentence: string; cvcWords: string[]; sightWords: string[]; comprehensionQuestion: string; comprehensionAnswer: string }> = {
  a: { sentence: 'The cat sat on the mat.', cvcWords: ['cat', 'sat', 'mat'], sightWords: ['the', 'on'], comprehensionQuestion: 'Where did the cat sit?', comprehensionAnswer: 'mat' },
  e: { sentence: 'Ted fed the red hen.', cvcWords: ['ted', 'fed', 'red', 'hen'], sightWords: ['the'], comprehensionQuestion: 'What did Ted feed?', comprehensionAnswer: 'hen' },
  i: { sentence: 'The pig can dig in the pit.', cvcWords: ['pig', 'dig', 'pit'], sightWords: ['the', 'can', 'in'], comprehensionQuestion: 'What did the pig dig?', comprehensionAnswer: 'pit' },
  o: { sentence: 'Tom got a hot pot.', cvcWords: ['tom', 'got', 'hot', 'pot'], sightWords: ['a'], comprehensionQuestion: 'What did Tom get?', comprehensionAnswer: 'pot' },
  u: { sentence: 'The pup dug in the mud.', cvcWords: ['pup', 'dug', 'mud'], sightWords: ['the', 'in'], comprehensionQuestion: 'Where did the pup dig?', comprehensionAnswer: 'mud' },
};

/** Scoped fallback for one mode — same shape as getFallbackChallenges but every
 *  word sits on the (first) target vowel. */
function getScopedFallback(mode: WordWorkoutMode, count: number, vowel: string): WordWorkoutChallenge[] {
  const v = SCOPED_CHAINS[vowel] ? vowel : 'a';
  switch (mode) {
    case 'word-chains':
      return [{ id: 'fb1', mode, chain: SCOPED_CHAINS[v]!.chain, changedPositions: SCOPED_CHAINS[v]!.changedPositions }].slice(0, count);
    case 'real-vs-nonsense':
      return SCOPED_REAL_NONSENSE[v]!.slice(0, count).map((p, i) => ({ id: `fb${i + 1}`, mode, ...p }));
    case 'picture-match': {
      const p = SCOPED_PICTURE[v]!;
      return [{ id: 'fb1', mode, targetWord: p.targetWord, targetImage: p.targetImage, distractorImages: p.distractorImages }].slice(0, count);
    }
    case 'sentence-reading': {
      const s = SCOPED_SENTENCE[v]!;
      return [{ id: 'fb1', mode, ...s }].slice(0, count);
    }
  }
}

/** Fallback dispatcher — scoped when the objective named a vowel, else the
 *  original mixed-vowel default. */
function fallbackFor(mode: WordWorkoutMode, count: number, scoped: string[] | null): WordWorkoutChallenge[] {
  return scoped && scoped.length > 0 ? getScopedFallback(mode, count, scoped[0]!) : getFallbackChallenges(mode, count);
}

// ============================================================================
// Mode-specific schemas — simple, all fields required per mode.
// ============================================================================

const realVsNonsenseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          realWord: { type: Type.STRING, description: "A real CVC word" },
          nonsenseWord: {
            type: Type.STRING,
            description: "Phonetically plausible nonsense CVC word",
          },
        },
        required: ["id", "realWord", "nonsenseWord"],
      },
    },
  },
  required: ["challenges"],
};

const pictureMatchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          targetWord: { type: Type.STRING, description: "Target CVC word" },
          targetImage: {
            type: Type.STRING,
            description: "Emoji for the target word",
          },
          distractorImages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                image: { type: Type.STRING },
              },
              required: ["word", "image"],
            },
          },
        },
        required: ["id", "targetWord", "targetImage", "distractorImages"],
      },
    },
  },
  required: ["challenges"],
};

const wordChainsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          chain: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "4-6 CVC words, one letter changes each step",
          },
          changedPositions: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description:
              "Index (0/1/2) that changed between chain[i] and chain[i+1]",
          },
        },
        required: ["id", "chain", "changedPositions"],
      },
    },
  },
  required: ["challenges"],
};

const sentenceReadingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentence: { type: Type.STRING, description: "Decodable sentence" },
          cvcWords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: "3",
            description: "At least 3 different CVC words from the sentence",
          },
          sightWords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          comprehensionQuestion: { type: Type.STRING },
          comprehensionAnswer: { type: Type.STRING },
        },
        required: [
          "id",
          "sentence",
          "cvcWords",
          "sightWords",
          "comprehensionQuestion",
          "comprehensionAnswer",
        ],
      },
    },
  },
  required: ["challenges"],
};

const MODE_SCHEMAS: Record<WordWorkoutMode, Schema> = {
  "real-vs-nonsense": realVsNonsenseSchema,
  "picture-match": pictureMatchSchema,
  "word-chains": wordChainsSchema,
  "sentence-reading": sentenceReadingSchema,
};

// ============================================================================
// Mode-specific prompts
// ============================================================================

const APPROVED_SIGHT_WORDS =
  "a, the, is, on, in, it, did, see, I, and, can, we, my, to, go, no, do, he, she";

function getModePrompt(
  mode: WordWorkoutMode,
  topic: string,
  gradeLevel: string,
  masteredVowels: string[],
  count: number,
  intent?: string,
  scopeSection = '',
  scopedVowels: string[] | null = null
): string {
  const vowelStr = masteredVowels.join(", ");
  const focusLine = intent
    ? `SPECIFIC FOCUS: Beyond the topic "${topic}", lean word choices toward "${intent}" when possible — but ALWAYS prioritize the CVC/phonics accuracy rules below over this focus.\n`
    : "";
  const vowelScopeLine = scopedVowels && scopedVowels.length > 0
    ? `HARD VOWEL SCOPE: every REAL word MUST use ONLY the short vowel(s) "${scopedVowels.join(', ')}". Change the first or last consonant to make new words, but NEVER change the vowel — a word with any other vowel is out of scope and will be rejected.\n`
    : "";
  const base = `${scopeSection}\nTopic: "${topic}". Grade: ${gradeLevel}. Mastered vowels: ${vowelStr}.\n${focusLine}${vowelScopeLine}Generate exactly ${count} challenges with IDs "c1", "c2", etc.\n`;

  switch (mode) {
    case "real-vs-nonsense":
      return (
        base +
        `MODE: Real vs. Nonsense
Each challenge MUST have: id, realWord (a real CVC word), nonsenseWord (phonetically plausible nonsense CVC word).
RULES:
- Nonsense words MUST be pronounceable CVC patterns (e.g., "zot", "kib", "rup")
- Nonsense words must NOT be real words
- Both words should use mastered vowels: ${vowelStr}
- Pairs should share the same vowel for discrimination practice`
      );

    case "picture-match":
      return (
        base +
        `MODE: Picture Match
Each challenge MUST have: id, targetWord (real CVC word), targetImage (single emoji), distractorImages (2-3 objects with word+image).
RULES:
- Use a single emoji as the image (e.g., "\u2600\uFE0F" for sun, "\uD83D\uDC31" for cat)
- Distractors must also be CVC words using mastered vowels: ${vowelStr}
- Distractors should be plausible but clearly different pictures`
      );

    case "word-chains":
      return (
        base +
        `MODE: Word Chains
Each challenge MUST have: id, chain (array of 4-6 real CVC words), changedPositions (array of indices).
RULES:
- Each step changes EXACTLY one letter: cat\u2192hat (pos 0), cat\u2192cot (pos 1), cat\u2192can (pos 2)
- All words must be real CVC words using mastered vowels: ${vowelStr}
- changedPositions[i] = character index that changed between chain[i] and chain[i+1]
- Example: chain=["cat","hat","hot","hop"], changedPositions=[0,1,2]`
      );

    case "sentence-reading":
      return (
        base +
        `MODE: Sentence Reading
Each challenge MUST have: id, sentence (4-8 words), cvcWords, sightWords, comprehensionQuestion, comprehensionAnswer (one word).
RULES:
- ONLY use CVC words + approved sight words: ${APPROVED_SIGHT_WORDS}
- CVC words should use mastered vowels: ${vowelStr}
- Each sentence MUST contain at least 3 different CVC words
- comprehensionAnswer MUST be one of the cvcWords
- Comprehension questions should be simple who/what/where questions
- Answers should be a single word from the sentence`
      );
  }
}

// ============================================================================
// Fallback challenges (when Gemini fails for a mode)
// ============================================================================

function getFallbackChallenges(
  mode: WordWorkoutMode,
  count: number
): WordWorkoutChallenge[] {
  const fallbacks: Record<WordWorkoutMode, WordWorkoutChallenge[]> = {
    "real-vs-nonsense": [
      { id: "fb1", mode: "real-vs-nonsense", realWord: "cat", nonsenseWord: "zat" },
      { id: "fb2", mode: "real-vs-nonsense", realWord: "sun", nonsenseWord: "gup" },
      { id: "fb3", mode: "real-vs-nonsense", realWord: "dog", nonsenseWord: "kog" },
    ],
    "picture-match": [
      {
        id: "fb1",
        mode: "picture-match",
        targetWord: "cat",
        targetImage: "\uD83D\uDC31",
        distractorImages: [
          { word: "bat", image: "\uD83E\uDD87" },
          { word: "rat", image: "\uD83D\uDC00" },
        ],
      },
      {
        id: "fb2",
        mode: "picture-match",
        targetWord: "sun",
        targetImage: "\u2600\uFE0F",
        distractorImages: [
          { word: "bus", image: "\uD83D\uDE8C" },
          { word: "cup", image: "\uD83E\uDD64" },
        ],
      },
    ],
    "word-chains": [
      {
        id: "fb1",
        mode: "word-chains",
        chain: ["cat", "hat", "hot", "hop"],
        changedPositions: [0, 1, 2],
      },
    ],
    "sentence-reading": [
      {
        id: "fb1",
        mode: "sentence-reading",
        sentence: "The cat sat on the mat.",
        cvcWords: ["cat", "sat", "mat"],
        sightWords: ["the", "on"],
        comprehensionQuestion: "Where did the cat sit?",
        comprehensionAnswer: "mat",
      },
    ],
  };

  return fallbacks[mode].slice(0, count);
}

// ============================================================================
// Post-process: word-chain validation & changedPositions derivation
// ============================================================================

/**
 * Validates a word chain: removes consecutive duplicates, checks each
 * transition differs by exactly 1 character (same length), and recomputes
 * changedPositions deterministically. Returns null if the chain is invalid.
 */
function validateWordChain(
  ch: WordWorkoutChallenge
): WordWorkoutChallenge | null {
  if (!ch.chain || ch.chain.length < 2) return null;

  // Remove consecutive duplicates
  const deduped = [ch.chain[0]];
  for (let i = 1; i < ch.chain.length; i++) {
    if (ch.chain[i] !== ch.chain[i - 1]) {
      deduped.push(ch.chain[i]);
    }
  }

  if (deduped.length < 3) return null; // too short after dedup

  // Validate each transition: same length, exactly 1 char different
  const positions: number[] = [];
  for (let i = 0; i < deduped.length - 1; i++) {
    const a = deduped[i];
    const b = deduped[i + 1];
    if (a.length !== b.length) return null;

    let diffCount = 0;
    let diffPos = -1;
    for (let j = 0; j < a.length; j++) {
      if (a[j] !== b[j]) {
        diffCount++;
        diffPos = j;
      }
    }
    if (diffCount !== 1) return null;
    positions.push(diffPos);
  }

  return { ...ch, chain: deduped, changedPositions: positions };
}

// ============================================================================
// Per-mode challenge generator
// ============================================================================

async function generateModeChallenges(
  mode: WordWorkoutMode,
  topic: string,
  gradeLevel: string,
  masteredVowels: string[],
  count: number,
  intent?: string,
  scopeSection = '',
  scopedVowels: string[] | null = null
): Promise<WordWorkoutChallenge[]> {
  try {
    const prompt = getModePrompt(mode, topic, gradeLevel, masteredVowels, count, intent, scopeSection, scopedVowels);

    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: MODE_SCHEMAS[mode],
        systemInstruction:
          "You are an expert K-2 reading specialist creating CVC word workout activities. " +
          "All CVC words must be true consonant-vowel-consonant patterns with short vowel sounds.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");

    const result = JSON.parse(text);
    let challenges: WordWorkoutChallenge[] = (result.challenges || []).map(
      (ch: WordWorkoutChallenge, idx: number) => ({
        ...ch,
        id: ch.id || `c${idx + 1}`,
        mode,
      })
    );

    // Post-process: validate word chains, derive changedPositions
    if (mode === 'word-chains') {
      const before = challenges.length;
      challenges = challenges
        .map(validateWordChain)
        .filter((ch): ch is WordWorkoutChallenge => ch !== null);
      if (challenges.length < before) {
        console.warn(`[word-workout] word-chains: rejected ${before - challenges.length}/${before} invalid chains`);
      }
    }

    // Post-process: reject sentence-reading with < 3 cvcWords
    if (mode === 'sentence-reading') {
      const before = challenges.length;
      challenges = challenges.filter(ch => {
        const words = ch.cvcWords || [];
        const answer = ch.comprehensionAnswer || '';
        return words.length >= 3 && words.some(w => w.toLowerCase() === answer.toLowerCase());
      });
      if (challenges.length < before) {
        console.warn(`[word-workout] sentence-reading: rejected ${before - challenges.length}/${before} challenges with insufficient cvcWords`);
      }
    }

    // Post-process: deterministic vowel-scope sanitizer. Drop any challenge that
    // wandered off the objective's target vowel (chains are the usual offender).
    if (scopedVowels && scopedVowels.length > 0) {
      const before = challenges.length;
      challenges = sanitizeVowelScope(mode, challenges, scopedVowels);
      if (challenges.length < before) {
        console.warn(`[word-workout] ${mode}: dropped ${before - challenges.length}/${before} off-vowel challenge(s) (scope: ${scopedVowels.join('')})`);
      }
    }

    if (challenges.length === 0) return fallbackFor(mode, count, scopedVowels);
    return challenges;
  } catch (error) {
    console.warn(`[word-workout] ${mode} generation failed, using fallback:`, error);
    return fallbackFor(mode, count, scopedVowels);
  }
}

// ============================================================================
// Main Generator (public API)
//
// Architecture (follows ordinal-line orchestrator pattern):
//   - No config.mode and no targetEvalMode → multi-mode: 4 parallel calls
//   - With config.mode or targetEvalMode → single/filtered-mode generation
// ============================================================================

type WordWorkoutConfig = Partial<{
  mode: WordWorkoutMode;
  challengeCount: number;
  masteredVowels: string[];
  /** Target eval mode from the IRT calibration system. */
  targetEvalMode: string;
}>;

export const generateWordWorkout = async (
  ctx: GenerationContext,
): Promise<WordWorkoutData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const gradeLevel = ctx.gradeContext;
  const config = ctx.raw as WordWorkoutConfig;
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'word-workout',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('WordWorkout', config?.targetEvalMode, evalConstraint);

  // ── Vowel-scope binding ─────────────────────────────────────────────
  // When the objective names a short vowel ("short a"), bind EVERY word to it;
  // otherwise stay vowel-generic. Topic/objective scope beats the manifest hint
  // beats the all-five default. masteredVowels then reflects the scope, so both
  // the prompt and the returned data honor it (the census bug was all-five here).
  const scopeSection = buildScopePromptSection(ctx.scope);
  const scopedVowels = resolveScopedVowels(ctx.scope, intent);
  const masteredVowels = scopedVowels ?? config?.masteredVowels ?? ALL_VOWELS;

  // Canonical grade key for the component's pre-reader band-gate (chrome/text
  // hidden at K; reader grades unchanged). Stamped into every returned shape.
  const gradeKey = resolvePreReaderGradeKey(ctx);

  // Determine which modes to generate
  const explicitMode = config?.mode;
  const evalModes = evalConstraint?.allowedTypes as WordWorkoutMode[] | undefined;

  // ── Single mode (explicit request OR eval mode targeting single mode) ──
  if (explicitMode || (evalModes && evalModes.length === 1)) {
    const targetMode = explicitMode || evalModes![0];
    const count = config?.challengeCount || 5;
    const challenges = await generateModeChallenges(
      targetMode,
      topic,
      gradeLevel,
      masteredVowels,
      count,
      intent,
      scopeSection,
      scopedVowels
    );

    // Re-assign sequential IDs
    const finalChallenges = challenges.map((ch, i) => ({
      ...ch,
      id: `c${i + 1}`,
    }));

    console.log(`[word-workout] Single-mode (${targetMode}): ${finalChallenges.length} challenges`);

    return {
      title: `CVC Word Workout: ${topic}`,
      mode: targetMode,
      masteredVowels,
      gradeLevel: gradeKey,
      challenges: finalChallenges,
    };
  }

  // ── Multi-mode (default or eval mode with multiple types) ──────────
  const modesToGenerate: WordWorkoutMode[] = evalModes || [
    "real-vs-nonsense",
    "picture-match",
    "word-chains",
    "sentence-reading",
  ];

  // Distribute challenge count roughly evenly across modes
  const countPerMode = Math.max(1, Math.ceil(6 / modesToGenerate.length));

  const results = await Promise.all(
    modesToGenerate.map(mode => generateModeChallenges(mode, topic, gradeLevel, masteredVowels,
      mode === 'word-chains' || mode === 'sentence-reading' ? 1 : countPerMode,
      intent,
      scopeSection,
      scopedVowels
    ))
  );

  // Merge with sequential IDs
  let idx = 1;
  const allChallenges: WordWorkoutChallenge[] = results.flatMap(
    modeResults => modeResults.map(ch => ({ ...ch, id: `c${idx++}` }))
  );

  console.log("[word-workout] Multi-mode generated:", {
    total: allChallenges.length,
    modes: modesToGenerate,
  });

  return {
    title: `CVC Word Workout: ${topic}`,
    mode: modesToGenerate[0],
    masteredVowels,
    gradeLevel: gradeKey,
    challenges: allChallenges,
  };
};
