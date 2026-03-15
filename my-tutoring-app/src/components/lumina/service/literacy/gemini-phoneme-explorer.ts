import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { PhonemeExplorerData } from "../../primitives/visual-primitives/literacy/PhonemeExplorer";
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
  isolate: {
    promptDoc:
      `"isolate": Student hears/sees a target phoneme (letter sound) and an example word, `
      + `then picks which of 4 emoji+word choices starts with (or ends with) the same sound. `
      + `Set phoneme (uppercase letter), phonemeSound (pronunciation), exampleWord + exampleEmoji. `
      + `Provide exactly 4 choices (1 correct starting with same sound, 3 distractors starting with different sounds). `
      + `K: initial sounds only, single consonants. Grade 1: initial/final, blends/digraphs. Grade 2: medial vowels.`,
    schemaDescription: "'isolate' (identify initial/final phoneme)",
  },
  blend: {
    promptDoc:
      `"blend": Student sees a sequence of individual phoneme tiles (e.g., /c/ /a/ /t/) `
      + `and must pick which of 4 words those phonemes blend into. `
      + `Set phonemeSequence (array of individual sounds, e.g., ["k","a","t"]) and phonemeDisplay (e.g., "/k/ /a/ /t/"). `
      + `Provide exactly 4 choices with word+emoji (1 correct = the blended word, 3 distractors = similar-sounding words). `
      + `K: 3-phoneme CVC words. Grade 1: 4-phoneme words with blends. Grade 2: 4-5 phoneme words.`,
    schemaDescription: "'blend' (combine phonemes into word)",
  },
  segment: {
    promptDoc:
      `"segment": Student sees a word with its emoji and must pick the correct phoneme breakdown from 4 options. `
      + `Set targetWord (the word to segment) and targetEmoji (emoji for the word). `
      + `Provide exactly 4 segmentOptions: each is a string showing a phoneme breakdown (e.g., "/c/ /a/ /t/"). `
      + `Exactly 1 option is correct (correctSegmentation index, 0-based). `
      + `Distractors should have wrong phoneme count, swapped sounds, or missing sounds. `
      + `K: 3-phoneme CVC words. Grade 1: 3-4 phoneme words. Grade 2: 4-5 phoneme words.`,
    schemaDescription: "'segment' (break word into phonemes)",
  },
  manipulate: {
    promptDoc:
      `"manipulate": Student reads an instruction to change one phoneme in a word and picks the resulting word. `
      + `Set originalWord, originalEmoji, operation ("substitute"|"delete"|"add"), `
      + `operationDescription (e.g., "Change the /c/ in 'cat' to /b/"). `
      + `Provide exactly 4 choices with word+emoji (1 correct = result of manipulation, 3 distractors). `
      + `K: initial consonant substitution only. Grade 1: initial/final substitution, deletion. `
      + `Grade 2: medial vowel substitution, addition, multi-step.`,
    schemaDescription: "'manipulate' (add/delete/substitute phoneme)",
  },
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Schema definition for Phoneme Explorer Data
 *
 * Generates multi-mode phoneme awareness challenges for K-2 students.
 * Four modes: isolate (match initial/final sound), blend (combine phonemes),
 * segment (break word into phonemes), manipulate (change a phoneme).
 */
const phonemeExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Engaging title for the activity (e.g., 'Sound Safari: Animals!')",
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
          mode: {
            type: Type.STRING,
            enum: ["isolate", "blend", "segment", "manipulate"],
            description: "Challenge mode: 'isolate' (match initial/final sound), 'blend' (combine phonemes into word), 'segment' (break word into phonemes), 'manipulate' (change a phoneme)",
          },
          // -- isolate mode fields --
          phoneme: {
            type: Type.STRING,
            description:
              "For isolate: The uppercase letter for this sound (e.g., 'B', 'S', 'M')",
          },
          phonemeSound: {
            type: Type.STRING,
            description:
              "For isolate: How the phoneme sounds spoken aloud (e.g., 'buh', 'sss', 'mmm')",
          },
          exampleWord: {
            type: Type.STRING,
            description:
              "For isolate: A concrete word that starts with this phoneme (e.g., 'Bear'). Must match the exampleEmoji.",
          },
          exampleEmoji: {
            type: Type.STRING,
            description:
              "For isolate: A single emoji depicting the exampleWord (e.g., '🐻' for Bear). MUST visually match the word.",
          },
          // -- blend mode fields --
          phonemeSequence: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "For blend: Array of individual phoneme sounds (e.g., ['k','a','t'] for 'cat')",
          },
          phonemeDisplay: {
            type: Type.STRING,
            description:
              "For blend: Display string for phoneme tiles (e.g., '/k/ /a/ /t/')",
          },
          // -- segment mode fields --
          targetWord: {
            type: Type.STRING,
            description:
              "For segment: The word to segment into phonemes (e.g., 'cat')",
          },
          targetEmoji: {
            type: Type.STRING,
            description:
              "For segment: Emoji depicting the target word (e.g., '🐱')",
          },
          segmentOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "For segment: 4 phoneme breakdown options (e.g., ['/k/ /a/ /t/', '/k/ /t/', '/s/ /a/ /t/', '/k/ /a/ /t/ /s/'])",
          },
          correctSegmentation: {
            type: Type.NUMBER,
            description:
              "For segment: 0-based index of the correct option in segmentOptions",
          },
          // -- manipulate mode fields --
          originalWord: {
            type: Type.STRING,
            description:
              "For manipulate: The starting word (e.g., 'cat')",
          },
          originalEmoji: {
            type: Type.STRING,
            description:
              "For manipulate: Emoji for the starting word (e.g., '🐱')",
          },
          operation: {
            type: Type.STRING,
            enum: ["substitute", "delete", "add"],
            description:
              "For manipulate: Type of phoneme operation",
          },
          operationDescription: {
            type: Type.STRING,
            description:
              "For manipulate: Human-readable instruction (e.g., \"Change the /k/ in 'cat' to /b/\")",
          },
          // -- shared: 4 choices (used by isolate, blend, manipulate) --
          choices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: {
                  type: Type.STRING,
                  description: "A concrete, picturable word",
                },
                emoji: {
                  type: Type.STRING,
                  description:
                    "A single emoji depicting this word. MUST visually match the word.",
                },
                correct: {
                  type: Type.BOOLEAN,
                  description:
                    "true if this is the correct answer, false otherwise",
                },
              },
              required: ["word", "emoji", "correct"],
            },
            description:
              "For isolate/blend/manipulate: Exactly 4 choices (1 correct, 3 distractors)",
          },
        },
        required: ["id", "mode"],
      },
      description: "Array of 5-6 phoneme awareness challenges",
    },
  },
  required: ["title", "challenges"],
};

/**
 * Generate Phoneme Explorer data using Gemini AI
 *
 * Creates multi-mode phoneme awareness challenges appropriate for K-2 students.
 * Four modes: isolate, blend, segment, manipulate — ordered by difficulty.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional configuration overrides
 * @returns PhonemeExplorerData with phoneme awareness challenges
 */
export const generatePhonemeExplorer = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    mode: string;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<PhonemeExplorerData> => {
  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'phoneme-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PhonemeExplorer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(phonemeExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : phonemeExplorerSchema;

  // ── Grade setup ─────────────────────────────────────────────────────
  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const gradeGuidelines: Record<string, string> = {
    K: `KINDERGARTEN GUIDELINES:
- Use simple CVC words that 5-year-olds know (cat, dog, sun, bus, pen)
- Focus on single consonant sounds: B, C, D, F, G, H, J, K, L, M, N, P, R, S, T, W
- Use different phonemes across challenges (don't repeat the same letter)
- All words must be concrete, picturable objects a child can recognize
- For isolate: initial sounds ONLY
- For blend: 3-phoneme CVC words ONLY
- For segment: 3-phoneme CVC words ONLY
- For manipulate: initial consonant substitution ONLY`,
    "1": `GRADE 1 GUIDELINES:
- Can include blends and digraphs (SH, CH, TH) as target phonemes
- Use a wider vocabulary but keep words concrete and picturable
- Words can be up to 5 letters
- Include a mix of consonant and vowel sounds
- For isolate: initial AND final sounds
- For blend: 3-4 phoneme words
- For segment: 3-4 phoneme words
- For manipulate: initial and final substitution, simple deletion`,
    "2": `GRADE 2 GUIDELINES:
- Include a wider range of phonemes including vowel sounds
- Can include less common consonant sounds and digraphs
- Words can be up to 6 letters but must still be concrete and picturable
- Use grade-appropriate vocabulary
- For isolate: initial, final, AND medial sounds
- For blend: 4-5 phoneme words
- For segment: 4-5 phoneme words
- For manipulate: all operations (substitute, delete, add)`,
  };

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create a phoneme awareness activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

${challengeTypeSection}

MODE-SPECIFIC FIELD RULES:
- isolate: set phoneme, phonemeSound, exampleWord, exampleEmoji, and choices (4 items). Do NOT set phonemeSequence, phonemeDisplay, targetWord, targetEmoji, segmentOptions, correctSegmentation, originalWord, originalEmoji, operation, operationDescription.
- blend: set phonemeSequence, phonemeDisplay, and choices (4 items). Do NOT set phoneme, phonemeSound, exampleWord, exampleEmoji, targetWord, targetEmoji, segmentOptions, correctSegmentation, originalWord, originalEmoji, operation, operationDescription.
- segment: set targetWord, targetEmoji, segmentOptions (4 strings), and correctSegmentation (0-based index). Do NOT set phoneme, phonemeSound, exampleWord, exampleEmoji, phonemeSequence, phonemeDisplay, choices, originalWord, originalEmoji, operation, operationDescription.
- manipulate: set originalWord, originalEmoji, operation, operationDescription, and choices (4 items). Do NOT set phoneme, phonemeSound, exampleWord, exampleEmoji, phonemeSequence, phonemeDisplay, targetWord, targetEmoji, segmentOptions, correctSegmentation.

CRITICAL EMOJI RULES:
- Every emoji MUST visually depict the word it's paired with
- Only use standard, widely-recognized emojis
- Examples of GOOD pairings: 🐱 Cat, 🌞 Sun, 🚌 Bus, 🐶 Dog, ⚽ Ball, 🍎 Apple

CRITICAL SOUND RULES:
- For isolate: correct choice MUST start with the exact same sound as the phoneme; distractors start with DIFFERENT sounds
- For blend: phonemeSequence must be accurate phonemes; distractors must be similar-sounding but wrong words
- For segment: correct segmentation must have the right phoneme count and sounds; distractors have wrong count or swapped sounds
- For manipulate: operationDescription must be clear; correct choice is the actual result; distractors are plausible but wrong

Generate exactly 5 challenges with IDs: "c1", "c2", "c3", "c4", "c5".
${!evalConstraint ? 'Mix modes across challenges — use at least 2 different modes. Order: easier modes (isolate, blend) first, harder modes (segment, manipulate) later.' : ''}
Relate words to the topic "${topic}" when possible, but prioritize phonological accuracy and emoji availability.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist designing phoneme awareness activities. " +
          "You choose concrete, picturable words that young learners know and enjoy. " +
          "You ALWAYS pair emojis that visually match the words they represent. " +
          "You ensure phonological accuracy in all challenges. " +
          "You never reveal answers through visual layout or ordering.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text);

    // ── Validation and defaults ───────────────────────────────────────

    if (!result.title || typeof result.title !== "string") {
      result.title = `Sound Explorer: ${topic}`;
    }

    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Validate each challenge
    result.challenges = result.challenges.map(
      (ch: Record<string, unknown>, idx: number) => {
        if (!ch.id) ch.id = `c${idx + 1}`;
        if (!ch.mode) ch.mode = evalConstraint?.allowedTypes[0] ?? 'isolate';

        // Mode-specific validation
        switch (ch.mode) {
          case 'isolate': {
            if (!ch.phoneme || typeof ch.phoneme !== "string") ch.phoneme = "?";
            if (!ch.phonemeSound || typeof ch.phonemeSound !== "string")
              ch.phonemeSound = (ch.phoneme as string).toLowerCase();
            if (!ch.exampleWord || typeof ch.exampleWord !== "string")
              ch.exampleWord = "word";
            if (!ch.exampleEmoji || typeof ch.exampleEmoji !== "string")
              ch.exampleEmoji = "🔤";
            validateChoices(ch);
            break;
          }
          case 'blend': {
            if (!Array.isArray(ch.phonemeSequence) || (ch.phonemeSequence as string[]).length === 0)
              ch.phonemeSequence = ["?", "?", "?"];
            if (!ch.phonemeDisplay || typeof ch.phonemeDisplay !== "string")
              ch.phonemeDisplay = (ch.phonemeSequence as string[]).map(p => `/${p}/`).join(" ");
            validateChoices(ch);
            break;
          }
          case 'segment': {
            if (!ch.targetWord || typeof ch.targetWord !== "string")
              ch.targetWord = "word";
            if (!ch.targetEmoji || typeof ch.targetEmoji !== "string")
              ch.targetEmoji = "🔤";
            if (!Array.isArray(ch.segmentOptions) || (ch.segmentOptions as string[]).length < 4) {
              ch.segmentOptions = ["/w/ /er/ /d/", "/w/ /d/", "/w/ /o/ /r/ /d/", "/w/ /u/ /r/ /d/"];
              ch.correctSegmentation = 0;
            }
            if (typeof ch.correctSegmentation !== "number" ||
              (ch.correctSegmentation as number) < 0 ||
              (ch.correctSegmentation as number) >= (ch.segmentOptions as string[]).length) {
              ch.correctSegmentation = 0;
            }
            break;
          }
          case 'manipulate': {
            if (!ch.originalWord || typeof ch.originalWord !== "string")
              ch.originalWord = "word";
            if (!ch.originalEmoji || typeof ch.originalEmoji !== "string")
              ch.originalEmoji = "🔤";
            if (!ch.operation || typeof ch.operation !== "string")
              ch.operation = "substitute";
            if (!ch.operationDescription || typeof ch.operationDescription !== "string")
              ch.operationDescription = "Change a sound in the word";
            validateChoices(ch);
            break;
          }
        }

        return ch;
      }
    );

    // Fallback: ensure at least one challenge exists
    if (result.challenges.length === 0) {
      const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'isolate';
      result.challenges = [{
        id: 'c1',
        mode: fallbackMode,
        phoneme: 'B',
        phonemeSound: 'buh',
        exampleWord: 'Bear',
        exampleEmoji: '🐻',
        choices: [
          { word: 'Ball', emoji: '⚽', correct: true },
          { word: 'Cat', emoji: '🐱', correct: false },
          { word: 'Dog', emoji: '🐶', correct: false },
          { word: 'Sun', emoji: '☀️', correct: false },
        ],
      }];
    }

    const finalData: PhonemeExplorerData = {
      title: result.title,
      challenges: result.challenges,
    };

    console.log("Phoneme Explorer Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
      modes: finalData.challenges.map((ch) => ch.mode),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating phoneme explorer:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateChoices(ch: Record<string, unknown>): void {
  if (!Array.isArray(ch.choices) || (ch.choices as unknown[]).length === 0) {
    ch.choices = [
      { word: "???", emoji: "❓", correct: true },
      { word: "???", emoji: "❓", correct: false },
      { word: "???", emoji: "❓", correct: false },
      { word: "???", emoji: "❓", correct: false },
    ];
  }

  // Ensure exactly one correct answer
  const choices = ch.choices as { word: string; emoji: string; correct: boolean }[];
  const correctCount = choices.filter((c) => c.correct).length;
  if (correctCount === 0 && choices.length > 0) {
    choices[0].correct = true;
  } else if (correctCount > 1) {
    let foundFirst = false;
    for (const c of choices) {
      if (c.correct && foundFirst) c.correct = false;
      if (c.correct) foundFirst = true;
    }
  }
}
