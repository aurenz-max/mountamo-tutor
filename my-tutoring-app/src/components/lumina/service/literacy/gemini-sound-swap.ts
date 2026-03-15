import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { SoundSwapData, SoundSwapChallenge } from "../../primitives/visual-primitives/literacy/SoundSwap";
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
  addition: {
    promptDoc:
      `"addition": Add a phoneme to an existing word to make a new word. `
      + `resultPhonemes has exactly ONE more phoneme than originalPhonemes. `
      + `K: add single consonant to make CVC from VC (e.g., "at" + /k/ = "cat"). `
      + `Grade 1: add consonants/blends (e.g., "lip" → "slip"). `
      + `Grade 2: add to create blends/clusters (e.g., "rain" → "train").`,
    schemaDescription: "'addition' (add a phoneme to make a new word)",
  },
  deletion: {
    promptDoc:
      `"deletion": Remove a phoneme from an existing word to reveal a new word. `
      + `originalPhonemes has exactly ONE more phoneme than resultPhonemes. `
      + `K: remove one consonant from CVC (e.g., "cat" - /k/ = "at"). `
      + `Grade 1: remove from blends/clusters (e.g., "stop" → "top"). `
      + `Grade 2: remove from complex words (e.g., "cream" → "ream").`,
    schemaDescription: "'deletion' (remove a phoneme to reveal a new word)",
  },
  substitution: {
    promptDoc:
      `"substitution": Swap one phoneme for another to transform a word. `
      + `Both arrays have the SAME length, differing at exactly ONE position. `
      + `K: swap beginning sound in CVC (e.g., "cat" → "bat"). `
      + `Grade 1: swap beginning/ending sounds (e.g., "hit" → "sit"). `
      + `Grade 2: swap any position including medial vowels (e.g., "bit" → "bat").`,
    schemaDescription: "'substitution' (swap one phoneme to change the word)",
  },
};

/**
 * Schema definition for Sound Swap Data
 *
 * Generates phoneme manipulation challenges for K-2 students.
 * Three operation types:
 *   - Addition: add a phoneme to make a new word
 *   - Deletion: remove a phoneme to make a new word
 *   - Substitution: swap one phoneme for another to make a new word
 *
 * The schema only asks Gemini for word pairs + phoneme arrays + operation type.
 * All operation-specific fields (oldPhoneme, newPhoneme, position, etc.) are
 * derived deterministically by diffing originalPhonemes vs resultPhonemes.
 * This eliminates inconsistencies where Gemini returns fields that don't
 * match the actual phoneme transformation.
 */
const soundSwapSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the activity (e.g., 'Sound Swap: Animal Fun!')",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier (e.g., 'c1', 'c2')",
          },
          operation: {
            type: Type.STRING,
            enum: ["addition", "deletion", "substitution"],
            description: "The phoneme manipulation operation type",
          },
          originalWord: {
            type: Type.STRING,
            description: "The starting word",
          },
          originalPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Phonemes of the original word in IPA-style with slashes (e.g., [\"/k/\", \"/æ/\", \"/t/\"])",
          },
          originalImage: {
            type: Type.STRING,
            description: "Brief image description for the original word (3-6 words)",
          },
          resultWord: {
            type: Type.STRING,
            description: "The resulting word after the manipulation",
          },
          resultPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Phonemes of the result word in IPA-style with slashes",
          },
          resultImage: {
            type: Type.STRING,
            description: "Brief image description for the result word (3-6 words)",
          },
        },
        required: [
          "id",
          "operation",
          "originalWord",
          "originalPhonemes",
          "originalImage",
          "resultWord",
          "resultPhonemes",
          "resultImage",
        ],
      },
      description: "Array of phoneme manipulation challenges mixing all three operation types",
    },
  },
  required: ["title", "challenges"],
};

// ============================================================================
// Derivation — compute operation details from phoneme array diffs
// ============================================================================

interface RawChallenge {
  id: string;
  operation: "addition" | "deletion" | "substitution";
  originalWord: string;
  originalPhonemes: string[];
  originalImage: string;
  resultWord: string;
  resultPhonemes: string[];
  resultImage: string;
}

function positionLabel(idx: number, length: number): "beginning" | "middle" | "end" {
  if (idx === 0) return "beginning";
  if (idx === length - 1) return "end";
  return "middle";
}

/**
 * Derive operation-specific fields by diffing originalPhonemes ↔ resultPhonemes.
 * Returns a full SoundSwapChallenge with all fields populated deterministically.
 */
function deriveOperationFields(raw: RawChallenge): SoundSwapChallenge {
  const base = {
    id: raw.id,
    operation: raw.operation,
    originalWord: raw.originalWord,
    originalPhonemes: raw.originalPhonemes,
    originalImage: raw.originalImage,
    resultWord: raw.resultWord,
    resultPhonemes: raw.resultPhonemes,
    resultImage: raw.resultImage,
  };

  const origP = raw.originalPhonemes;
  const resP = raw.resultPhonemes;

  if (raw.operation === "substitution" && origP.length === resP.length && origP.length > 0) {
    // Find the first index where they differ
    for (let i = 0; i < origP.length; i++) {
      if (origP[i] !== resP[i]) {
        return {
          ...base,
          oldPhoneme: origP[i],
          newPhoneme: resP[i],
          substitutePosition: positionLabel(i, origP.length),
        };
      }
    }
    // Arrays identical — fallback (shouldn't happen with valid data)
    return { ...base, oldPhoneme: origP[0], newPhoneme: resP[0], substitutePosition: "beginning" };
  }

  if (raw.operation === "addition" && resP.length === origP.length + 1) {
    // The extra phoneme in resultPhonemes is the added one
    if (resP[0] !== origP[0]) {
      return { ...base, addPhoneme: resP[0], addPosition: "beginning" };
    }
    // Added at end
    return { ...base, addPhoneme: resP[resP.length - 1], addPosition: "end" };
  }

  if (raw.operation === "deletion" && origP.length === resP.length + 1) {
    // The extra phoneme in originalPhonemes is the deleted one
    if (origP[0] !== resP[0]) {
      return { ...base, deletePhoneme: origP[0], deletePosition: "beginning" };
    }
    if (origP[origP.length - 1] !== resP[resP.length - 1]) {
      return { ...base, deletePhoneme: origP[origP.length - 1], deletePosition: "end" };
    }
    // Middle deletion — find where they diverge
    for (let i = 0; i < origP.length; i++) {
      if (i >= resP.length || origP[i] !== resP[i]) {
        return { ...base, deletePhoneme: origP[i], deletePosition: positionLabel(i, origP.length) };
      }
    }
    return { ...base, deletePhoneme: origP[0], deletePosition: "beginning" };
  }

  // Fallback — array lengths don't match expected pattern.
  // Return base with minimal defaults so the UI doesn't crash.
  console.warn(`[SoundSwap] Could not derive operation fields for ${raw.id} (${raw.operation}): ` +
    `origP.length=${origP.length}, resP.length=${resP.length}`);
  if (raw.operation === "substitution") {
    return { ...base, oldPhoneme: origP[0] ?? "/?/", newPhoneme: resP[0] ?? "/?/", substitutePosition: "beginning" };
  }
  if (raw.operation === "addition") {
    return { ...base, addPhoneme: "/?/", addPosition: "beginning" };
  }
  return { ...base, deletePhoneme: origP[0] ?? "/?/", deletePosition: "beginning" };
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate Sound Swap data using Gemini AI
 *
 * Creates phoneme manipulation challenges (addition, deletion, substitution)
 * that progress through the three operation types. This is the most advanced
 * phonological awareness skill and a direct predictor of reading success.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides (challengeCount, operations, targetEvalMode)
 * @returns SoundSwapData with grade-appropriate phoneme manipulation challenges
 */
export const generateSoundSwap = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    challengeCount: number;
    operations: string[];
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<SoundSwapData> => {
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'sound-swap',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SoundSwap', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(soundSwapSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'operation',
      })
    : soundSwapSchema;

  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const challengeCount = config?.challengeCount ?? 9;

  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete CVC words kids know (cat, hat, sun, run, pig, big, mat, sit)
- Keep words to 3-4 letters maximum
- Addition: add a single consonant to CVC to make CCVC or CVCC (e.g., "at" + /k/ = "cat")
- Deletion: remove one consonant from CVC to leave a real word (e.g., "cat" - /k/ = "at")
- Substitution: swap beginning or ending sound in CVC words (e.g., "cat" → "bat" by changing first sound)
- Use only common, well-known words that kindergarteners encounter daily
- Phonemes should be simple single consonants and short vowels
`,
    "1": `
GRADE 1 GUIDELINES:
- Use CVC and CVCC words with common phoneme patterns
- Words can be up to 5 letters
- Addition: add consonants or blends (e.g., "lip" → "slip" by adding /s/ at beginning)
- Deletion: remove consonants from blends or clusters (e.g., "stop" → "top" by removing /s/)
- Substitution: swap beginning, middle, or ending sounds (e.g., "hit" → "sit" by changing first sound)
- Include some words with blends and digraphs
- All result words must be real, common English words
`,
    "2": `
GRADE 2 GUIDELINES:
- Use CVC, CVCC, CCVC, and some multisyllabic words
- Words can be up to 6 letters
- Addition: add phonemes to create blends or clusters (e.g., "rain" → "train")
- Deletion: remove phonemes from blends (e.g., "cream" → "ream", "blend" → "bend")
- Substitution: swap phonemes in any position including medial vowels (e.g., "bit" → "bat" by changing middle vowel)
- Include r-controlled vowels and common digraphs in some challenges
- All result words must be real English words kids would recognize
`,
  };

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create a phoneme manipulation (Sound Swap) activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

Generate exactly ${challengeCount} challenges.

${challengeTypeSection}

PHONEME NOTATION RULES:
- Use IPA-style phoneme notation wrapped in forward slashes: /k/, /æ/, /t/, /s/, /b/, /ɪ/, /ʌ/, /ɛ/, /ɑ/, /ʊ/
- Each phoneme in originalPhonemes and resultPhonemes must be a single sound in slashes
- Example: "cat" = ["/k/", "/æ/", "/t/"], "bat" = ["/b/", "/æ/", "/t/"]
- Digraphs like "sh" are ONE phoneme: /ʃ/. "ch" = /tʃ/. "th" = /θ/ or /ð/

PHONEME ARRAY RULES (CRITICAL):
- originalPhonemes must exactly represent the sounds in originalWord
- resultPhonemes must exactly represent the sounds in resultWord
- For ADDITION: resultPhonemes has exactly ONE more phoneme than originalPhonemes
- For DELETION: originalPhonemes has exactly ONE more phoneme than resultPhonemes
- For SUBSTITUTION: both arrays have the SAME length, differing at exactly ONE position

CRITICAL RULES:
- EVERY result word must be a REAL English word (no nonsense words!)
- EVERY original word must be a REAL English word
- Image descriptions should be brief (3-6 words) and kid-friendly
- IDs should be sequential: "c1", "c2", "c3", etc.
- Relate words to the topic "${topic}" when possible, but prioritize valid transformations
- Double-check that originalPhonemes and resultPhonemes are accurate for both words
${!evalConstraint ? '- Order challenges: addition first, then deletion, then substitution (easiest → hardest).' : ''}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs phoneme manipulation activities. " +
          "You understand phonemic awareness deeply — addition, deletion, and substitution of individual phonemes. " +
          "You always use proper IPA-style phoneme notation with slashes (e.g., /k/, /æ/, /t/). " +
          "You only produce challenges where both the original and result words are REAL English words. " +
          "You choose concrete, picturable words that young learners know. " +
          "You never reveal answers in labels or descriptions. " +
          "You provide ONLY the word pairs, phoneme arrays, operation type, and image descriptions. " +
          "You do NOT provide operation-specific fields like oldPhoneme, newPhoneme, etc.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);

    // ── Validation and defaults ───────────────────────────────────────

    // Ensure title
    if (!result.title || typeof result.title !== "string") {
      result.title = `Sound Swap: ${topic}`;
    }

    // Ensure challenges array
    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Map raw challenges → full SoundSwapChallenge by deriving operation fields
    const challenges: SoundSwapChallenge[] = result.challenges.map(
      (ch: Record<string, unknown>, idx: number) => {
        const raw: RawChallenge = {
          id: (ch.id as string) || `c${idx + 1}`,
          operation: ch.operation as RawChallenge["operation"],
          originalWord: (ch.originalWord as string) || "",
          originalPhonemes: Array.isArray(ch.originalPhonemes) ? ch.originalPhonemes as string[] : [],
          originalImage: (ch.originalImage as string) || (ch.originalWord as string) || "",
          resultWord: (ch.resultWord as string) || "",
          resultPhonemes: Array.isArray(ch.resultPhonemes) ? ch.resultPhonemes as string[] : [],
          resultImage: (ch.resultImage as string) || (ch.resultWord as string) || "",
        };

        return deriveOperationFields(raw);
      }
    );

    const finalData: SoundSwapData = {
      title: result.title,
      gradeLevel: gradeLevelKey,
      challenges,
    };

    console.log("Sound Swap Generated:", {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges.length,
      operations: finalData.challenges.map((c) => c.operation),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating sound swap:", error);
    throw error;
  }
};
