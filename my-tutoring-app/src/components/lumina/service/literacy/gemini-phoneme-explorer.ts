import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { PhonemeExplorerData } from "../../primitives/visual-primitives/literacy/PhonemeExplorer";

/**
 * Schema definition for Phoneme Explorer Data
 *
 * Generates emoji-based phoneme matching challenges for K-2 students.
 * Each challenge presents a letter sound with an example word + emoji,
 * then 4 choices (emoji + word) where the student picks the word
 * that starts with the same sound.
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
          phoneme: {
            type: Type.STRING,
            description:
              "The uppercase letter for this sound (e.g., 'B', 'S', 'M')",
          },
          phonemeSound: {
            type: Type.STRING,
            description:
              "How the phoneme sounds spoken aloud (e.g., 'buh', 'sss', 'mmm')",
          },
          exampleWord: {
            type: Type.STRING,
            description:
              "A concrete word that starts with this phoneme (e.g., 'Bear'). Must match the exampleEmoji.",
          },
          exampleEmoji: {
            type: Type.STRING,
            description:
              "A single emoji depicting the exampleWord (e.g., '🐻' for Bear). MUST visually match the word.",
          },
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
                    "true if this word starts with the target phoneme, false otherwise",
                },
              },
              required: ["word", "emoji", "correct"],
            },
            description:
              "Exactly 4 choices: 1 correct (starts with the phoneme) and 3 distractors (start with different sounds)",
          },
        },
        required: [
          "id",
          "phoneme",
          "phonemeSound",
          "exampleWord",
          "exampleEmoji",
          "choices",
        ],
      },
      description: "Array of 5-6 phoneme matching challenges",
    },
  },
  required: ["title", "challenges"],
};

/**
 * Generate Phoneme Explorer data using Gemini AI
 *
 * Creates emoji-based phoneme matching challenges appropriate for K-2 students.
 * Each challenge shows a letter sound with an example, then asks the student
 * to find another word that starts with the same sound.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional configuration overrides
 * @returns PhonemeExplorerData with emoji-based phoneme challenges
 */
export const generatePhonemeExplorer = async (
  topic: string,
  gradeLevel: string = "K",
  config?: Partial<{ mode: string }>
): Promise<PhonemeExplorerData> => {
  // config.mode is accepted for backward compatibility but no longer used
  void config;

  const gradeLevelKey = ["K", "1", "2"].includes(gradeLevel.toUpperCase())
    ? gradeLevel.toUpperCase()
    : "K";

  const gradeGuidelines: Record<string, string> = {
    K: `KINDERGARTEN GUIDELINES:
- Use simple CVC words that 5-year-olds know (cat, dog, sun, bus, pen)
- Focus on single consonant sounds: B, C, D, F, G, H, J, K, L, M, N, P, R, S, T, W
- Use different phonemes across challenges (don't repeat the same letter)
- All words must be concrete, picturable objects a child can recognize`,
    "1": `GRADE 1 GUIDELINES:
- Can include blends and digraphs (SH, CH, TH) as target phonemes
- Use a wider vocabulary but keep words concrete and picturable
- Words can be up to 5 letters
- Include a mix of consonant and vowel sounds`,
    "2": `GRADE 2 GUIDELINES:
- Include a wider range of phonemes including vowel sounds
- Can include less common consonant sounds and digraphs
- Words can be up to 6 letters but must still be concrete and picturable
- Use grade-appropriate vocabulary`,
  };

  const generationPrompt = `Create a phoneme matching activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeGuidelines[gradeLevelKey] || gradeGuidelines["K"]}

For each challenge:
1. Pick a PHONEME (letter sound) — use a different one for each challenge
2. Provide an EXAMPLE WORD + EMOJI that starts with that sound
3. Provide exactly 4 CHOICES (each with word + emoji):
   - Exactly 1 choice starts with the SAME phoneme (correct = true)
   - Exactly 3 choices start with DIFFERENT phonemes (correct = false)

CRITICAL EMOJI RULES:
- Every emoji MUST visually depict the word it's paired with
- Only use standard, widely-recognized emojis (no obscure ones)
- The exampleEmoji must match the exampleWord
- Each choice emoji must match its choice word
- Examples of GOOD pairings: 🐱 Cat, 🌞 Sun, 🚌 Bus, 🐶 Dog, ⚽ Ball, 🍎 Apple
- Examples of BAD pairings: 🔵 Dog (wrong!), 🎭 Cat (wrong!)

CRITICAL SOUND RULES:
- The correct choice MUST start with the exact same sound as the phoneme
- The 3 distractors must each start with a clearly DIFFERENT sound
- The example word and correct choice should NOT be the same word
- Do NOT use words where the starting sound is ambiguous (e.g., avoid silent letters)

Generate exactly 5 challenges with different phonemes.
IDs should be sequential: "c1", "c2", "c3", etc.
Relate words to the topic "${topic}" when possible, but prioritize phonological accuracy and emoji availability.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: phonemeExplorerSchema,
        systemInstruction:
          "You are an expert K-2 reading specialist designing phoneme awareness activities. " +
          "You choose concrete, picturable words that young learners know and enjoy. " +
          "You ALWAYS pair emojis that visually match the words they represent. " +
          "You ensure exactly 1 correct choice and 3 distractors per challenge. " +
          "You use different phonemes for each challenge to maximize learning exposure. " +
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
        if (!ch.phoneme || typeof ch.phoneme !== "string") ch.phoneme = "?";
        if (!ch.phonemeSound || typeof ch.phonemeSound !== "string")
          ch.phonemeSound = (ch.phoneme as string).toLowerCase();
        if (!ch.exampleWord || typeof ch.exampleWord !== "string")
          ch.exampleWord = "word";
        if (!ch.exampleEmoji || typeof ch.exampleEmoji !== "string")
          ch.exampleEmoji = "🔤";

        // Ensure choices array exists with exactly 4 items
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

        return ch;
      }
    );

    const finalData: PhonemeExplorerData = {
      title: result.title,
      challenges: result.challenges,
    };

    console.log("Phoneme Explorer Generated:", {
      title: finalData.title,
      challengeCount: finalData.challenges.length,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating phoneme explorer:", error);
    throw error;
  }
};
