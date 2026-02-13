import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { DecodableReaderData } from "../../primitives/visual-primitives/literacy/DecodableReader";

/**
 * Schema definition for Decodable Reader Data
 *
 * Generates controlled-vocabulary reading passages for K-2 students with
 * per-word TTS support, phonics pattern tagging, and embedded comprehension
 * questions. Tracks which words students tap for help as a proxy for
 * decoding difficulty.
 */
const decodableReaderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the reading passage (e.g., 'The Cat on the Mat')"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('K', '1', or '2')"
    },
    passage: {
      type: Type.OBJECT,
      properties: {
        sentences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "Unique sentence identifier (e.g., 's1', 's2')"
              },
              words: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description: "Unique word identifier (e.g., 's1_w1', 's1_w2')"
                    },
                    text: {
                      type: Type.STRING,
                      description: "The word as displayed (including punctuation attached to word, e.g., 'cat.' or 'cat,')"
                    },
                    phonicsPattern: {
                      type: Type.STRING,
                      enum: ["cvc", "cvce", "sight", "blend", "digraph", "r-controlled", "diphthong", "other"],
                      description: "The primary phonics pattern of this word"
                    },
                    phonemes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Optional phoneme breakdown in slash notation (e.g., ['/k/', '/a/', '/t/'])"
                    }
                  },
                  required: ["id", "text", "phonicsPattern"]
                },
                description: "Array of words in this sentence"
              }
            },
            required: ["id", "words"]
          },
          description: "Array of sentences making up the passage"
        },
        imageDescription: {
          type: Type.STRING,
          description: "Description of the passage scene for visual context"
        }
      },
      required: ["sentences"]
    },
    phonicsPatternsInPassage: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of phonics patterns represented in this passage (e.g., ['cvc', 'sight', 'digraph'])"
    },
    comprehensionQuestion: {
      type: Type.OBJECT,
      properties: {
        question: {
          type: Type.STRING,
          description: "A comprehension question about the passage"
        },
        type: {
          type: Type.STRING,
          enum: ["multiple-choice", "short-answer"],
          description: "Question type"
        },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Answer options for multiple-choice (3-4 options)"
        },
        correctAnswer: {
          type: Type.STRING,
          description: "The correct answer text"
        },
        acceptableAnswers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Alternative acceptable answers"
        }
      },
      required: ["question", "type", "correctAnswer"]
    }
  },
  required: ["title", "gradeLevel", "passage", "phonicsPatternsInPassage", "comprehensionQuestion"]
};

/**
 * Generate decodable reader data using Gemini AI
 *
 * Creates controlled-vocabulary reading passages where every word is
 * individually tappable for pronunciation support. Passages use phonics
 * patterns matching the student's current decoding level.
 *
 * @param topic - Theme for the passage (e.g., "Animals at the Park", "Going to School")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary and length
 * @param config - Optional partial configuration to override generated values
 * @returns DecodableReaderData with grade-appropriate passage and comprehension question
 */
export const generateDecodableReader = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<DecodableReaderData>
): Promise<DecodableReaderData> => {

  const gradeContext: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- 2-3 SHORT sentences (3-5 words each)
- Use mostly CVC words (cat, dog, sun, hat, big, red, sit, run, hop)
- Include 5-10 high-frequency sight words (the, a, is, it, I, and, to, can, see, my, like, we, go)
- EVERY word must have a phonicsPattern tag
- Tag sight words as "sight"
- Tag CVC words as "cvc"
- Simple content: concrete actions and objects kids know
- Comprehension: simple "Who?" or "What happened?" question (multiple-choice with 3 options)
- Include phoneme breakdowns for CVC words
- Example: "The big cat sat on a mat."
  - "The" -> sight, "big" -> cvc [/b/, /i/, /g/], "cat" -> cvc [/k/, /a/, /t/], "sat" -> cvc [/s/, /a/, /t/], "on" -> sight, "a" -> sight, "mat." -> cvc [/m/, /a/, /t/]
`,
    '1': `
GRADE 1 GUIDELINES:
- 4-6 sentences (4-7 words each)
- Use CVC, CVCE (silent-e), blends, and digraph words
- Include 8-12 sight words (the, a, is, was, are, they, have, said, with, from, what, her, his)
- Mix phonics patterns for variety
- Blends: stop, trip, clap, frog, grin, slip, stem
- Digraphs: ship, chat, thin, whip, fish, much, bath
- CVCE: cake, bike, rope, cute, lake, ride, home
- Include phoneme breakdowns for key pattern words
- Comprehension: "What happened?" or "Why?" question (multiple-choice with 3-4 options)
- Short and medium vowel words mixed
`,
    '2': `
GRADE 2 GUIDELINES:
- 6-8 sentences (5-8 words each)
- Use CVC, CVCE, blends, digraphs, r-controlled vowels, and diphthongs
- Include sight words naturally
- R-controlled: farm, bird, fern, corn, burn, star, first, north
- Diphthongs: coin, boy, cloud, cow, point, round, joy, town
- Can include 2-syllable words: basket, rabbit, sunset, garden, under
- More complex comprehension: inference or main idea (multiple-choice with 4 options)
- Include phoneme breakdowns for pattern words
- Varied sentence structure
`
  };

  const gradeLevelKey = ['K', '1', '2'].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : 'K';

  const generationPrompt = `Create a decodable reading passage about: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['K']}

REQUIRED INFORMATION:

1. **Title**: A kid-friendly title for the passage

2. **Grade Level**: "${gradeLevelKey}"

3. **Passage**: An object with:
   - sentences: Array of sentence objects, EACH with:
     - id: Unique sentence ID (s1, s2, etc.)
     - words: Array of word objects, EACH with:
       - id: Unique word ID (s1_w1, s1_w2, etc.)
       - text: The word as displayed. Attach trailing punctuation to the word (e.g., "cat." not "cat" + ".")
       - phonicsPattern: One of: cvc, cvce, sight, blend, digraph, r-controlled, diphthong, other
       - phonemes: (optional) Array of phoneme sounds in slash notation for decodable words
   - imageDescription: Brief description of the scene

   CRITICAL RULES:
   - EVERY word must be tagged with its phonicsPattern
   - Sight words = words that can't be fully decoded with phonics rules (the, a, is, was, said, to, I, etc.)
   - Include phonemes for CVC, CVCE, blend, and digraph words (not required for sight words)
   - Punctuation (periods, commas) should be attached to the preceding word's text field
   - Word IDs must be unique across the entire passage

4. **Phonics Patterns in Passage**: Array of pattern types used (e.g., ["cvc", "sight", "blend"])

5. **Comprehension Question**: An object with:
   - question: Clear question about the passage content
   - type: "multiple-choice"
   - options: 3-4 answer options
   - correctAnswer: The correct answer (must match one of the options exactly)
   - acceptableAnswers: Any other acceptable answers

EXAMPLE OUTPUT FOR KINDERGARTEN:
{
  "title": "The Big Red Dog",
  "gradeLevel": "K",
  "passage": {
    "sentences": [
      {
        "id": "s1",
        "words": [
          { "id": "s1_w1", "text": "I", "phonicsPattern": "sight" },
          { "id": "s1_w2", "text": "see", "phonicsPattern": "sight" },
          { "id": "s1_w3", "text": "a", "phonicsPattern": "sight" },
          { "id": "s1_w4", "text": "big", "phonicsPattern": "cvc", "phonemes": ["/b/", "/i/", "/g/"] },
          { "id": "s1_w5", "text": "red", "phonicsPattern": "cvc", "phonemes": ["/r/", "/e/", "/d/"] },
          { "id": "s1_w6", "text": "dog.", "phonicsPattern": "cvc", "phonemes": ["/d/", "/o/", "/g/"] }
        ]
      },
      {
        "id": "s2",
        "words": [
          { "id": "s2_w1", "text": "The", "phonicsPattern": "sight" },
          { "id": "s2_w2", "text": "dog", "phonicsPattern": "cvc", "phonemes": ["/d/", "/o/", "/g/"] },
          { "id": "s2_w3", "text": "can", "phonicsPattern": "cvc", "phonemes": ["/k/", "/a/", "/n/"] },
          { "id": "s2_w4", "text": "run.", "phonicsPattern": "cvc", "phonemes": ["/r/", "/u/", "/n/"] }
        ]
      }
    ],
    "imageDescription": "A happy big red dog running in a green park"
  },
  "phonicsPatternsInPassage": ["cvc", "sight"],
  "comprehensionQuestion": {
    "question": "What can the dog do?",
    "type": "multiple-choice",
    "options": ["The dog can run.", "The dog can fly.", "The dog can swim."],
    "correctAnswer": "The dog can run.",
    "acceptableAnswers": ["run"]
  }
}

Now generate a decodable reading passage about "${topic}" at grade level ${gradeLevelKey}. Ensure every word has a phonicsPattern tag and IDs are unique.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: decodableReaderSchema,
        systemInstruction: `You are an expert K-2 reading specialist who creates decodable reading passages. You understand controlled vocabulary, phonics patterns, and developmental reading progression. You write engaging, age-appropriate passages using only words that match the student's current decoding abilities plus appropriate sight words. You carefully tag every word with its correct phonics pattern and provide accurate phoneme breakdowns. You craft comprehension questions that assess genuine understanding of the passage content.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as DecodableReaderData;

    const finalData: DecodableReaderData = {
      ...result,
      ...config,
    };

    console.log('Decodable Reader Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      sentenceCount: finalData.passage?.sentences?.length || 0,
      totalWords: finalData.passage?.sentences?.reduce((s, sent) => s + sent.words.length, 0) || 0,
      patterns: finalData.phonicsPatternsInPassage,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating decodable reader:", error);
    throw error;
  }
};
