import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type {
  WordWorkoutData,
  WordWorkoutMode,
  WordWorkoutChallenge,
} from "../../primitives/visual-primitives/literacy/WordWorkout";

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
//   - No config.mode → multi-mode: 4 parallel calls, one per mode
//   - With config.mode → single-mode: one call for that mode only
// ============================================================================

export const generateWordWorkout = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    mode: WordWorkoutMode;
    challengeCount: number;
    masteredVowels: string[];
  }>
): Promise<WordWorkoutData> => {
  const masteredVowels = config?.masteredVowels || ["a", "e", "i", "o", "u"];

  // ── Single mode (explicit request) ──────────────────────────────
  if (config?.mode) {
    const count = config.challengeCount || 5;
    const challenges = await generateModeChallenges(
      config.mode,
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

    console.log(`[word-workout] Single-mode (${config.mode}): ${finalChallenges.length} challenges`);

    return {
      title: `CVC Word Workout: ${topic}`,
      mode: config.mode,
      masteredVowels,
      challenges: finalChallenges,
    };
  }

  // ── Multi-mode (default): 4 parallel calls ─────────────────────
  const [rvn, pm, wc, sr] = await Promise.all([
    generateModeChallenges("real-vs-nonsense", topic, gradeLevel, masteredVowels, 2),
    generateModeChallenges("picture-match", topic, gradeLevel, masteredVowels, 2),
    generateModeChallenges("word-chains", topic, gradeLevel, masteredVowels, 1),
    generateModeChallenges("sentence-reading", topic, gradeLevel, masteredVowels, 1),
  ]);

  // Merge with sequential IDs
  let idx = 1;
  const allChallenges: WordWorkoutChallenge[] = [
    ...rvn.map((ch) => ({ ...ch, id: `c${idx++}` })),
    ...pm.map((ch) => ({ ...ch, id: `c${idx++}` })),
    ...wc.map((ch) => ({ ...ch, id: `c${idx++}` })),
    ...sr.map((ch) => ({ ...ch, id: `c${idx++}` })),
  ];

  console.log("[word-workout] Multi-mode generated:", {
    total: allChallenges.length,
    "real-vs-nonsense": rvn.length,
    "picture-match": pm.length,
    "word-chains": wc.length,
    "sentence-reading": sr.length,
    firstChallenge: allChallenges[0],
  });

  return {
    title: `CVC Word Workout: ${topic}`,
    mode: "real-vs-nonsense", // primary mode for backward compat
    masteredVowels,
    challenges: allChallenges,
  };
};
