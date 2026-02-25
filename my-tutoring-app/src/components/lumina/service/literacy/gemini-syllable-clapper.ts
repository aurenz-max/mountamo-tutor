import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { SyllableClapperData } from "../../primitives/visual-primitives/literacy/SyllableClapper";

/**
 * Schema definition for Syllable Clapper Data
 *
 * Generates syllable counting & segmentation challenges for K-2 students.
 * Students hear a word and clap/tap once per syllable, then see the word
 * broken into its syllable parts.
 */
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
              "Difficulty rating from 3 (easy, 1-syllable) to 5 (hard, 3-4 syllable)",
          },
        },
        required: [
          "id",
          "word",
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

/**
 * Generate Syllable Clapper data using Gemini AI
 *
 * Creates syllable counting and segmentation challenges that progress
 * from simple 1-syllable words to more complex 3-4 syllable words.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides (e.g., challengeCount)
 * @returns SyllableClapperData with grade-appropriate syllable challenges
 */
export const generateSyllableClapper = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{ challengeCount: number }>
): Promise<SyllableClapperData> => {
  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const challengeCount = config?.challengeCount ?? 8;

  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete words kids already know (cat, apple, banana, dog, happy)
- Mix of 1-syllable (cat, dog, sun) and 2-syllable words (apple, puppy, tiger)
- Include one or two 3-syllable words (banana, elephant, butterfly)
- All words should be highly picturable and familiar to 5-year-olds
- Difficulty: 3 for 1-syllable, 4 for 2-syllable, 5 for 3-syllable
`,
    "1": `
GRADE 1 GUIDELINES:
- Use familiar words with a wider range of syllable counts
- Include 1-syllable (cat, truck), 2-syllable (robot, flower), and 3-syllable words (umbrella, computer)
- Include one or two 4-syllable words (caterpillar, watermelon)
- Words should be decodable and common in grade 1 vocabulary
- Difficulty: 3 for 1-syllable, 4 for 2-syllable, 4 for 3-syllable, 5 for 4-syllable
`,
    "2": `
GRADE 2 GUIDELINES:
- Use a broader vocabulary including academic and descriptive words
- Good mix: 1-syllable (bright), 2-syllable (garden), 3-syllable (beautiful), 4-syllable (caterpillar)
- Can include compound words (butterfly, sunflower) and words with common prefixes/suffixes
- Difficulty: 3 for 1-2 syllable, 4 for 3-syllable, 5 for 4-syllable
`,
  };

  const generationPrompt = `Create a syllable clapping activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

Generate exactly ${challengeCount} challenges with a MIX of syllable counts (1 through 4 syllables).
Order them from fewer syllables to more syllables (easiest first).

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

DISTRIBUTION for ${challengeCount} challenges:
- 2 one-syllable words (difficulty 3)
- 3 two-syllable words (difficulty 4)
- 2 three-syllable words (difficulty 4-5)
- 1 four-syllable word (difficulty 5)
Adjust proportions if challengeCount differs, but always include a mix.

EXAMPLE:
{
  "title": "Clap It Out: Animals!",
  "challenges": [
    {
      "id": "c1",
      "word": "cat",
      "syllableCount": 1,
      "syllables": ["cat"],
      "imageDescription": "a fluffy orange cat",
      "difficulty": 3
    },
    {
      "id": "c2",
      "word": "tiger",
      "syllableCount": 2,
      "syllables": ["ti", "ger"],
      "imageDescription": "a striped orange tiger",
      "difficulty": 4
    },
    {
      "id": "c3",
      "word": "elephant",
      "syllableCount": 3,
      "syllables": ["el", "e", "phant"],
      "imageDescription": "a big gray elephant",
      "difficulty": 5
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
        responseSchema: syllableClapperSchema,
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

        // Ensure difficulty is in range 3-5
        const diff = ch.difficulty as number;
        if (typeof diff !== "number" || diff < 3 || diff > 5) {
          // Assign based on syllable count
          ch.difficulty = Math.min(3 + syllables.length - 1, 5);
        }

        // Ensure imageDescription
        if (!ch.imageDescription || typeof ch.imageDescription !== "string") {
          ch.imageDescription = `a picture of ${ch.word}`;
        }

        return ch;
      }
    );

    const finalData: SyllableClapperData = {
      title: result.title,
      challenges: result.challenges,
    };

    console.log("Syllable Clapper Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
      syllableCounts: finalData.challenges.map((c) => c.syllableCount),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating syllable clapper:", error);
    throw error;
  }
};
