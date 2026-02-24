import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { RhymeStudioData } from "../../primitives/visual-primitives/literacy/RhymeStudio";

/**
 * Schema definition for Rhyme Studio Data
 *
 * Generates multi-mode rhyme practice activities for K-2 students.
 * Three modes:
 *   - Recognition: Do these two words rhyme? (yes/no)
 *   - Identification: Pick the rhyming word from options
 *   - Production: Type a word that rhymes with the target
 */
const rhymeStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the rhyming activity (e.g., 'Rhyme Time: Animals!')",
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
            enum: ["recognition", "identification", "production"],
            description: "Challenge mode",
          },
          targetWord: {
            type: Type.STRING,
            description: "The primary word for this challenge",
          },
          targetWordImage: {
            type: Type.STRING,
            description: "Short image description for the target word (e.g., 'a fluffy cat')",
          },
          rhymeFamily: {
            type: Type.STRING,
            description: "The rhyme family suffix (e.g., '-at', '-un', '-ig')",
          },
          comparisonWord: {
            type: Type.STRING,
            description: "Recognition mode: the second word to compare",
          },
          comparisonWordImage: {
            type: Type.STRING,
            description: "Recognition mode: image description for comparison word",
          },
          doesRhyme: {
            type: Type.BOOLEAN,
            description: "Recognition mode: whether the two words actually rhyme",
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: {
                  type: Type.STRING,
                  description: "Option word",
                },
                image: {
                  type: Type.STRING,
                  description: "Short image description for this option",
                },
                isCorrect: {
                  type: Type.BOOLEAN,
                  description: "Whether this option rhymes with the target word",
                },
              },
              required: ["word", "image", "isCorrect"],
            },
            description: "Identification mode: 2-3 word options (exactly one correct)",
          },
          acceptableAnswers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Production mode: 3-5 acceptable rhyming words",
          },
        },
        required: ["id", "mode", "targetWord", "targetWordImage", "rhymeFamily"],
      },
      description: "Array of 8-10 challenges mixing all three modes",
    },
  },
  required: ["title", "challenges"],
};

/**
 * Generate Rhyme Studio data using Gemini AI
 *
 * Creates multi-mode rhyming practice activities that progress from
 * recognition (easiest) through identification to production (hardest).
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary complexity
 * @param config - Optional configuration overrides (e.g., challengeCount)
 * @returns RhymeStudioData with grade-appropriate rhyming challenges
 */
export const generateRhymeStudio = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{ challengeCount: number }>
): Promise<RhymeStudioData> => {
  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const challengeCount = config?.challengeCount ?? 9;

  const gradeGuidelines: Record<string, string> = {
    K: `
KINDERGARTEN GUIDELINES:
- Use simple, concrete CVC words kids know (cat, hat, sun, run, pig, big)
- Rhyme families with short vowels: -at, -an, -ig, -ot, -un, -en, -op, -ug
- Recognition: use very clear rhyming pairs AND obvious non-rhyming pairs
- Identification: 2 options only (one correct, one clearly different family)
- Production: provide 3-4 common acceptable answers per target word
- Keep all words to 3-4 letters maximum
`,
    "1": `
GRADE 1 GUIDELINES:
- Use CVC and CVCE words with common rhyme families
- Rhyme families: -at, -ake, -ine, -ight, -ump, -ick, -ore, -ail
- Recognition: include some tricky near-misses (e.g., "cat" and "cap" do NOT rhyme)
- Identification: 3 options (one correct, two distractors from different families)
- Production: provide 4-5 acceptable answers including less common words
- Words can be up to 5 letters
`,
    "2": `
GRADE 2 GUIDELINES:
- Use multisyllabic words and varied rhyme patterns
- Rhyme families: -ight, -ound, -tion, -ank, -eam, -oon, -ump, -ell
- Recognition: include tricky pairs that share letters but don't rhyme (e.g., "though" / "tough")
- Identification: 3 options with plausible distractors (same starting sound but different ending)
- Production: provide 4-5 acceptable answers including 2-syllable words
- Words can be up to 6 letters
`,
  };

  const generationPrompt = `Create a rhyming practice activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

Generate exactly ${challengeCount} challenges in this order:
1. RECOGNITION challenges (3-4 total): Show two words; student says "yes" or "no" to whether they rhyme.
   - Mix it up: some pairs SHOULD rhyme (doesRhyme: true), some should NOT (doesRhyme: false).
   - REQUIRED fields: comparisonWord, comparisonWordImage, doesRhyme
   - Do NOT include options or acceptableAnswers for recognition challenges.

2. IDENTIFICATION challenges (2-3 total): Show a target word and 2-3 options; student picks the rhyming one.
   - Exactly ONE option must have isCorrect: true; all others isCorrect: false.
   - REQUIRED fields: options (array of {word, image, isCorrect})
   - Do NOT include comparisonWord, doesRhyme, or acceptableAnswers for identification challenges.

3. PRODUCTION challenges (2-3 total): Show a target word; student types a rhyming word.
   - Provide 3-5 common acceptable answers (do NOT include the target word itself).
   - REQUIRED fields: acceptableAnswers (array of strings)
   - Do NOT include comparisonWord, doesRhyme, or options for production challenges.

CRITICAL RULES:
- Every challenge must have: id, mode, targetWord, targetWordImage, rhymeFamily
- rhymeFamily MUST start with a hyphen (e.g., "-at", "-un", "-ig")
- For recognition pairs that DO rhyme, both words must share the same rhyme family ending
- For recognition pairs that do NOT rhyme, words must have clearly different endings
- All words should relate to the topic "${topic}" when possible, but prioritize real rhymes
- Use simple, common, age-appropriate words
- IDs should be sequential: "c1", "c2", "c3", etc.
- Image descriptions should be brief (3-6 words) and kid-friendly

EXAMPLE:
{
  "title": "Rhyme Time: Animals!",
  "challenges": [
    {
      "id": "c1",
      "mode": "recognition",
      "targetWord": "cat",
      "targetWordImage": "a fluffy orange cat",
      "rhymeFamily": "-at",
      "comparisonWord": "bat",
      "comparisonWordImage": "a flying brown bat",
      "doesRhyme": true
    },
    {
      "id": "c2",
      "mode": "recognition",
      "targetWord": "dog",
      "targetWordImage": "a happy brown dog",
      "rhymeFamily": "-og",
      "comparisonWord": "sun",
      "comparisonWordImage": "a bright yellow sun",
      "doesRhyme": false
    },
    {
      "id": "c5",
      "mode": "identification",
      "targetWord": "hen",
      "targetWordImage": "a red farm hen",
      "rhymeFamily": "-en",
      "options": [
        { "word": "ten", "image": "the number 10", "isCorrect": true },
        { "word": "hat", "image": "a red hat", "isCorrect": false },
        { "word": "cup", "image": "a blue cup", "isCorrect": false }
      ]
    },
    {
      "id": "c8",
      "mode": "production",
      "targetWord": "bug",
      "targetWordImage": "a small green bug",
      "rhymeFamily": "-ug",
      "acceptableAnswers": ["rug", "hug", "mug", "tug", "dug"]
    }
  ]
}

Now generate the activity for "${topic}" at grade level ${gradeLevelKey}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: rhymeStudioSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist who designs engaging phonological awareness activities. " +
          "You understand rhyme families deeply and always produce linguistically accurate rhyming pairs. " +
          "You choose concrete, picturable words that young learners know and enjoy. " +
          "You never reveal answers in labels or descriptions. " +
          "You ensure each challenge has all required fields for its mode and omits fields from other modes.",
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
      result.title = `Rhyme Studio: ${topic}`;
    }

    // Ensure challenges array
    if (!Array.isArray(result.challenges)) {
      result.challenges = [];
    }

    // Validate each challenge has mode-specific fields
    result.challenges = result.challenges.map(
      (ch: Record<string, unknown>, idx: number) => {
        // Ensure id
        if (!ch.id) ch.id = `c${idx + 1}`;

        // Ensure rhymeFamily starts with hyphen
        if (
          typeof ch.rhymeFamily === "string" &&
          !ch.rhymeFamily.startsWith("-")
        ) {
          ch.rhymeFamily = `-${ch.rhymeFamily}`;
        }

        // Ensure mode-specific fields
        if (ch.mode === "recognition") {
          if (!ch.comparisonWord) ch.comparisonWord = "word";
          if (!ch.comparisonWordImage) ch.comparisonWordImage = "";
          if (typeof ch.doesRhyme !== "boolean") ch.doesRhyme = false;
        } else if (ch.mode === "identification") {
          if (!Array.isArray(ch.options) || (ch.options as unknown[]).length === 0) {
            ch.options = [
              { word: "word", image: "", isCorrect: true },
              { word: "other", image: "", isCorrect: false },
            ];
          }
          // Ensure exactly one correct option
          const options = ch.options as Array<{
            word: string;
            image: string;
            isCorrect: boolean;
          }>;
          const correctCount = options.filter((o) => o.isCorrect).length;
          if (correctCount === 0 && options.length > 0) {
            options[0].isCorrect = true;
          }
        } else if (ch.mode === "production") {
          if (
            !Array.isArray(ch.acceptableAnswers) ||
            (ch.acceptableAnswers as unknown[]).length === 0
          ) {
            ch.acceptableAnswers = ["word"];
          }
        }

        return ch;
      }
    );

    const finalData: RhymeStudioData = {
      title: result.title,
      gradeLevel: gradeLevelKey,
      challenges: result.challenges,
    };

    console.log("Rhyme Studio Generated:", {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges.length,
      modes: finalData.challenges.map((c) => c.mode),
    });

    return finalData;
  } catch (error) {
    console.error("Error generating rhyme studio:", error);
    throw error;
  }
};
