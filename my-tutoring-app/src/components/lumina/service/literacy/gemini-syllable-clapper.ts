import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { SyllableClapperData } from "../../primitives/visual-primitives/literacy/SyllableClapper";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// Challenge Type Documentation (one entry per difficulty tier)
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  easy: {
    promptDoc:
      `"easy": High-frequency 1-2 syllable words with clean, unambiguous boundaries. `
      + `Use concrete, picturable words every kindergartener knows (cat, dog, apple, puppy, happy, tiger). `
      + `Difficulty 3. Syllable count: 1-2.`,
    schemaDescription: "'easy' — 1-2 syllable, high-frequency words",
  },
  medium: {
    promptDoc:
      `"medium": 2-3 syllable words from broader vocabulary. Compound words OK (butterfly, sunflower, basketball). `
      + `Words should still be concrete and picturable but can be less common. `
      + `Difficulty 4. Syllable count: 2-3.`,
    schemaDescription: "'medium' — 2-3 syllable, broader vocabulary",
  },
  hard: {
    promptDoc:
      `"hard": 3-4 syllable words, including less familiar words and words with ambiguous syllable boundaries `
      + `(caterpillar, refrigerator, comfortable, interesting, hippopotamus). `
      + `Difficulty 5. Syllable count: 3-4.`,
    schemaDescription: "'hard' — 3-4 syllable, less common / ambiguous boundaries",
  },
};

// ============================================================================
// Schema
// ============================================================================

const syllableClapperSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Engaging title for the syllable clapping activity (e.g., 'Clap It Out: Animals!')",
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
          word: {
            type: Type.STRING,
            description:
              "The word to clap (age-appropriate, concrete, picturable)",
          },
          challengeType: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
            description:
              "Difficulty tier: 'easy' (1-2 syllable, high-frequency), 'medium' (2-3 syllable, broader vocab), 'hard' (3-4 syllable, ambiguous boundaries)",
          },
          syllableCount: {
            type: Type.NUMBER,
            description: "Number of syllables in the word (1-4)",
          },
          syllables: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'The word split into syllable parts (e.g., ["but", "ter", "fly"])',
          },
          imageDescription: {
            type: Type.STRING,
            description:
              "Brief kid-friendly image description (3-6 words, e.g., 'a colorful butterfly')",
          },
          difficulty: {
            type: Type.NUMBER,
            description:
              "Difficulty rating from 3 (easy) to 5 (hard)",
          },
        },
        required: [
          "id",
          "word",
          "challengeType",
          "syllableCount",
          "syllables",
          "imageDescription",
          "difficulty",
        ],
      },
      description: "Array of 6-10 syllable clapping challenges",
    },
  },
  required: ["title", "challenges"],
};

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate Syllable Clapper data using Gemini AI
 *
 * Creates syllable counting challenges that progress from simple high-frequency
 * words to complex multi-syllable words with ambiguous boundaries.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides
 * @returns SyllableClapperData with grade-appropriate syllable challenges
 */
export const generateSyllableClapper = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{
    challengeCount: number;
    intent: string;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<SyllableClapperData> => {
  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const challengeCount = config?.challengeCount ?? 8;

  // ── Eval mode resolution ──────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'syllable-clapper',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SyllableClapper', config?.targetEvalMode, evalConstraint);

  // ── Schema constraint ─────────────────────────────────────────────
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(syllableClapperSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
      })
    : syllableClapperSchema;

  // ── Challenge type prompt section ─────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Grade guidelines (only for mixed mode) ────────────────────────
  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete words kids already know (cat, apple, banana, dog, happy)
- "easy" words: 1-syllable (cat, dog, sun) and 2-syllable (apple, puppy, tiger)
- "medium" words: 2-3 syllable compound/familiar (butterfly, elephant, banana)
- "hard" words: 3-syllable (dinosaur, kangaroo) — use sparingly for K
- All words should be highly picturable and familiar to 5-year-olds
`,
    "1": `
GRADE 1 GUIDELINES:
- Use familiar words with a wider range of syllable counts
- "easy": 1-2 syllable high-frequency (cat, truck, robot, flower)
- "medium": 2-3 syllable broader vocab (umbrella, computer, butterfly)
- "hard": 3-4 syllable words (caterpillar, watermelon)
- Words should be decodable and common in grade 1 vocabulary
`,
    "2": `
GRADE 2 GUIDELINES:
- Use a broader vocabulary including academic and descriptive words
- "easy": 1-2 syllable (bright, garden, pencil)
- "medium": 2-3 syllable (beautiful, sunflower, basketball)
- "hard": 3-4 syllable (caterpillar, refrigerator, comfortable)
- Can include compound words and words with common prefixes/suffixes
`,
  };

  const generationPrompt = `Create a syllable clapping activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${challengeTypeSection}

${!evalConstraint ? (gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]) : ''}

Generate exactly ${challengeCount} challenges.
${!evalConstraint ? 'Order them from easiest to hardest (easy first, hard last).' : `All challenges MUST have challengeType "${evalConstraint.allowedTypes[0]}".`}

CRITICAL RULES:
1. The "syllables" array MUST correctly split the word into its real syllable parts.
   - "butterfly" → ["but", "ter", "fly"] (3 syllables) ✓
   - "cat" → ["cat"] (1 syllable) ✓
   - "apple" → ["ap", "ple"] (2 syllables) ✓
   - "watermelon" → ["wa", "ter", "mel", "on"] (4 syllables) ✓
2. "syllableCount" MUST equal the length of the "syllables" array. Double-check every word.
3. When the syllables are joined together, they must spell the original word exactly.
4. Use real English syllable boundaries (not arbitrary splits).
5. All words must be age-appropriate, concrete, and picturable for young children.
6. IDs should be sequential: "c1", "c2", "c3", etc.
7. Image descriptions should be brief (3-6 words) and kid-friendly.
8. Do NOT use the same word twice.
9. Try to relate words to the topic "${topic}" when possible, but prioritize correct syllable splitting.
10. The "challengeType" MUST match the word's actual difficulty tier.
${!evalConstraint ? `
DISTRIBUTION for ${challengeCount} challenges:
- 2-3 "easy" words (1-2 syllables, difficulty 3)
- 3 "medium" words (2-3 syllables, difficulty 4)
- 2 "hard" words (3-4 syllables, difficulty 5)
Adjust proportions if challengeCount differs, but always include a mix.` : ''}

EXAMPLE:
{
  "title": "Clap It Out: Animals!",
  "challenges": [
    {
      "id": "c1",
      "word": "cat",
      "challengeType": "easy",
      "syllableCount": 1,
      "syllables": ["cat"],
      "imageDescription": "a fluffy orange cat",
      "difficulty": 3
    },
    {
      "id": "c2",
      "word": "tiger",
      "challengeType": "easy",
      "syllableCount": 2,
      "syllables": ["ti", "ger"],
      "imageDescription": "a striped orange tiger",
      "difficulty": 3
    },
    {
      "id": "c3",
      "word": "elephant",
      "challengeType": "medium",
      "syllableCount": 3,
      "syllables": ["el", "e", "phant"],
      "imageDescription": "a big gray elephant",
      "difficulty": 4
    }
  ]
}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs engaging phonological awareness activities. " +
          "You understand English syllable structure deeply and always produce linguistically accurate syllable splits. " +
          "You choose concrete, picturable words that young learners know and enjoy. " +
          "You never reveal answers in labels or descriptions. " +
          "You double-check that syllableCount matches the length of the syllables array for every word, " +
          "and that joining the syllables array produces the original word.",
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
      result.title = `Clap It Out: ${topic}`;
    }

    // Ensure challenges array
    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Validate each challenge
    result.challenges = result.challenges.map(
      (ch: Record<string, unknown>, idx: number) => {
        // Ensure id
        if (!ch.id) ch.id = `c${idx + 1}`;

        // Ensure word is a string
        if (!ch.word || typeof ch.word !== "string") {
          ch.word = "word";
        }

        // Ensure syllables is an array of strings
        if (!Array.isArray(ch.syllables) || (ch.syllables as unknown[]).length === 0) {
          ch.syllables = [ch.word as string];
        }

        // Ensure syllableCount matches syllables.length
        const syllables = ch.syllables as string[];
        ch.syllableCount = syllables.length;

        // Ensure challengeType is valid
        const validTypes = evalConstraint?.allowedTypes ?? ['easy', 'medium', 'hard'];
        if (!ch.challengeType || !validTypes.includes(ch.challengeType as string)) {
          // Infer from syllable count
          if (syllables.length <= 2) ch.challengeType = 'easy';
          else if (syllables.length <= 3) ch.challengeType = 'medium';
          else ch.challengeType = 'hard';
          // If constrained, force to allowed type
          if (evalConstraint && !evalConstraint.allowedTypes.includes(ch.challengeType as string)) {
            ch.challengeType = evalConstraint.allowedTypes[0];
          }
        }

        // Ensure difficulty is in range 3-5
        const diff = ch.difficulty as number;
        if (typeof diff !== "number" || diff < 3 || diff > 5) {
          ch.difficulty = Math.min(3 + syllables.length - 1, 5);
        }

        // Ensure imageDescription
        if (!ch.imageDescription || typeof ch.imageDescription !== "string") {
          ch.imageDescription = `a picture of ${ch.word}`;
        }

        return ch;
      }
    );

    // Fallback if no challenges generated
    if (result.challenges.length === 0) {
      const fallbackType = evalConstraint?.allowedTypes[0] ?? 'easy';
      result.challenges = [{
        id: 'c1',
        word: 'cat',
        challengeType: fallbackType,
        syllableCount: 1,
        syllables: ['cat'],
        imageDescription: 'a fluffy cat',
        difficulty: 3,
      }];
    }

    const finalData: SyllableClapperData = {
      title: result.title,
      challenges: result.challenges,
    };

    console.log("Syllable Clapper Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
      challengeTypes: finalData.challenges.map((c) => c.challengeType),
      syllableCounts: finalData.challenges.map((c) => c.syllableCount),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating syllable clapper:", error);
    throw error;
  }
};
