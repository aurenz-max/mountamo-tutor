import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
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
  count: number
): string {
  const vowelStr = masteredVowels.join(", ");
  const base = `Topic: "${topic}". Grade: ${gradeLevel}. Mastered vowels: ${vowelStr}.\nGenerate exactly ${count} challenges with IDs "c1", "c2", etc.\n`;

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
// Per-mode challenge generator
// ============================================================================

async function generateModeChallenges(
  mode: WordWorkoutMode,
  topic: string,
  gradeLevel: string,
  masteredVowels: string[],
  count: number
): Promise<WordWorkoutChallenge[]> {
  try {
    const prompt = getModePrompt(mode, topic, gradeLevel, masteredVowels, count);

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
    const challenges: WordWorkoutChallenge[] = (result.challenges || []).map(
      (ch: WordWorkoutChallenge, idx: number) => ({
        ...ch,
        id: ch.id || `c${idx + 1}`,
        mode,
      })
    );

    if (challenges.length === 0) throw new Error("No challenges returned");
    return challenges;
  } catch (error) {
    console.warn(`[word-workout] ${mode} generation failed, using fallback:`, error);
    return getFallbackChallenges(mode, count);
  }
}

// ============================================================================
// Main Generator (public API)
//
// Architecture (follows ordinal-line orchestrator pattern):
//   - No config.mode and no targetEvalMode → multi-mode: 4 parallel calls
//   - With config.mode or targetEvalMode → single/filtered-mode generation
// ============================================================================

export const generateWordWorkout = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    mode: WordWorkoutMode;
    challengeCount: number;
    masteredVowels: string[];
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<WordWorkoutData> => {
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'word-workout',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('WordWorkout', config?.targetEvalMode, evalConstraint);

  const masteredVowels = config?.masteredVowels || ["a", "e", "i", "o", "u"];

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
      count
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
      mode === 'word-chains' || mode === 'sentence-reading' ? 1 : countPerMode
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
    challenges: allChallenges,
  };
};
