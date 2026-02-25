import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { CvcSpellerData } from "../../primitives/visual-primitives/literacy/CvcSpeller";

/**
 * Schema definition for CVC Speller Data
 *
 * Generates CVC word encoding (spelling from audio) activities for K-2 instruction.
 * Students hear a CVC word and spell it by placing letters in 3 slots.
 * Supports short vowel focus and progressive letter group difficulty.
 */
const cvcSpellerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the CVC spelling activity (e.g., 'Spell Short-A Words!')"
    },
    vowelFocus: {
      type: Type.STRING,
      enum: ["short-a", "short-e", "short-i", "short-o", "short-u"],
      description: "Which short vowel sound to focus on"
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Letter group difficulty (1 = easiest consonants, 4 = all letters). Must be 1, 2, 3, or 4."
    },
    availableLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All single lowercase letters available in the letter bank for this activity"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'c1', 'c2')"
          },
          targetWord: {
            type: Type.STRING,
            description: "The 3-letter CVC word to spell (e.g., 'cat', 'hen', 'pig')"
          },
          targetLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 individual letters in order (e.g., ['c', 'a', 't'])"
          },
          targetPhonemes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The 3 phonemes in slash notation (e.g., ['/k/', '/æ/', '/t/'])"
          },
          emoji: {
            type: Type.STRING,
            description: "A single emoji representing the word (e.g., '🐱' for cat, '🐷' for pig, '☀️' for sun)"
          },
          imageDescription: {
            type: Type.STRING,
            description: "Brief visual description of the word for illustration (e.g., 'a fluffy orange cat')"
          },
          distractorLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 extra letters NOT in the target word, used as distractors in the letter bank"
          },
          commonErrors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                errorSpelling: {
                  type: Type.STRING,
                  description: "A common misspelling of the target word (e.g., 'kat' for 'cat')"
                },
                feedback: {
                  type: Type.STRING,
                  description: "Helpful corrective feedback for this error (e.g., 'The /k/ sound in cat is spelled with the letter c')"
                }
              },
              required: ["errorSpelling", "feedback"]
            },
            description: "Common misspellings with corrective feedback"
          }
        },
        required: ["id", "targetWord", "targetLetters", "targetPhonemes", "emoji", "imageDescription", "distractorLetters"]
      },
      description: "Array of 4-6 CVC word challenges"
    }
  },
  required: ["title", "vowelFocus", "letterGroup", "availableLetters", "challenges"]
};

/**
 * Generate CVC Speller data using Gemini AI
 *
 * Creates interactive CVC word spelling activities where students hear a word
 * and place letters into 3 slots to spell it. Activities focus on one short
 * vowel sound at a time with progressive consonant difficulty.
 *
 * Letter Groups:
 * - Group 1: s, t, m, p, a (+ target vowel) — most common, easiest
 * - Group 2: Group 1 + n, c, b, d, g — adds common consonants
 * - Group 3: Group 2 + f, h, l, r, w — adds remaining frequent consonants
 * - Group 4: All consonants — full alphabet challenge
 *
 * @param topic - Theme for the word set (e.g., "Animals", "At Home", "Food")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines vocabulary
 * @param config - Optional partial configuration to override generated values
 * @returns CvcSpellerData with grade-appropriate CVC words and phoneme breakdowns
 */
export const generateCvcSpeller = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<CvcSpellerData>
): Promise<CvcSpellerData> => {

  const vowelFocus = config?.vowelFocus || 'short-a';
  const letterGroup = config?.letterGroup || 1;

  // Map vowel focus to the actual vowel letter
  const vowelMap: Record<string, string> = {
    'short-a': 'a',
    'short-e': 'e',
    'short-i': 'i',
    'short-o': 'o',
    'short-u': 'u',
  };
  const targetVowel = vowelMap[vowelFocus] || 'a';

  // Letter group consonant sets
  const letterGroupSets: Record<number, string> = {
    1: 's, t, m, p',
    2: 's, t, m, p, n, c, b, d, g',
    3: 's, t, m, p, n, c, b, d, g, f, h, l, r, w',
    4: 's, t, m, p, n, c, b, d, g, f, h, l, r, w, j, k, v, x, y, z',
  };
  const consonants = letterGroupSets[letterGroup] || letterGroupSets[1];

  const generationPrompt = `Create a CVC word spelling activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
VOWEL FOCUS: ${vowelFocus} (the vowel "${targetVowel}")
LETTER GROUP: ${letterGroup} (available consonants: ${consonants})

ACTIVITY DESCRIPTION:
Students hear a CVC (consonant-vowel-consonant) word and must spell it by dragging letters into 3 slots. Each word has exactly 3 letters and 3 phonemes.

REQUIREMENTS:
1. **title**: Fun, engaging title mentioning the vowel sound or theme
2. **vowelFocus**: "${vowelFocus}"
3. **letterGroup**: ${letterGroup}
4. **availableLetters**: Array of all individual lowercase letters used across all challenges (consonants from group ${letterGroup} + the vowel "${targetVowel}")
5. **challenges**: 4-6 CVC words, EACH with:
   - id: Unique ID (c1, c2, c3, etc.)
   - targetWord: A real 3-letter CVC word using ONLY consonants from group ${letterGroup} and the vowel "${targetVowel}"
   - targetLetters: Array of exactly 3 letters in order (e.g., ["c", "a", "t"])
   - targetPhonemes: Array of exactly 3 phonemes in slash notation (e.g., ["/k/", "/æ/", "/t/"])
   - emoji: A single emoji representing the word (e.g., "🐱" for cat)
   - imageDescription: Brief description for illustrating the word
   - distractorLetters: 3-5 letters NOT in the target word (from the available consonants)
   - commonErrors: 1-2 common misspellings with helpful feedback

CRITICAL RULES:
- ALL words must be real English CVC words (3 letters: consonant + "${targetVowel}" + consonant)
- The middle letter of every word MUST be "${targetVowel}"
- Only use consonants from letter group ${letterGroup}: ${consonants}
- targetLetters must be exactly 3 elements that spell targetWord
- targetPhonemes must be exactly 3 phonemes corresponding to each letter
- distractorLetters must NOT include any letter that appears in targetWord
- Choose concrete, picturable words appropriate for K-2 students
- Try to match the topic "${topic}" where possible, but prioritize real CVC words
- commonErrors should reflect real mistakes K-2 students make (e.g., confusing b/d, using wrong vowel)

PHONEME NOTATION:
- Short vowels: /æ/ (a), /ɛ/ (e), /ɪ/ (i), /ɒ/ (o), /ʌ/ (u)
- Consonants: /b/, /k/ (for c), /d/, /f/, /g/, /h/, /j/, /k/, /l/, /m/, /n/, /p/, /r/, /s/, /t/, /v/, /w/, /y/, /z/

EXAMPLE OUTPUT:
{
  "title": "Spell Short-A Animal Words!",
  "vowelFocus": "short-a",
  "letterGroup": 1,
  "availableLetters": ["s", "t", "m", "p", "a"],
  "challenges": [
    {
      "id": "c1",
      "targetWord": "mat",
      "targetLetters": ["m", "a", "t"],
      "targetPhonemes": ["/m/", "/æ/", "/t/"],
      "emoji": "🧹",
      "imageDescription": "a colorful welcome mat on a doorstep",
      "distractorLetters": ["s", "p"],
      "commonErrors": [
        { "errorSpelling": "met", "feedback": "Listen again — the middle sound is /æ/ like in apple, not /ɛ/ like in egg." }
      ]
    },
    {
      "id": "c2",
      "targetWord": "sat",
      "targetLetters": ["s", "a", "t"],
      "targetPhonemes": ["/s/", "/æ/", "/t/"],
      "emoji": "🪑",
      "imageDescription": "a child sitting on a chair",
      "distractorLetters": ["m", "p"],
      "commonErrors": [
        { "errorSpelling": "set", "feedback": "The vowel sound is /æ/ as in apple. Listen for the short-a sound in the middle." }
      ]
    }
  ]
}

Generate 4-6 CVC words for "${topic}" using vowel "${targetVowel}" and letter group ${letterGroup} consonants.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: cvcSpellerSchema,
        systemInstruction: `You are an expert K-2 reading and spelling specialist. You create engaging, developmentally appropriate CVC word spelling activities that build phonemic awareness and letter-sound correspondence. You understand which CVC words are real, common English words appropriate for young learners. You ensure all phoneme notations are linguistically accurate and that every word strictly follows the CVC pattern with the specified vowel. You choose concrete, picturable words that motivate young spellers.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CvcSpellerData;

    // Validate and apply defaults
    const finalData: CvcSpellerData = {
      ...result,
      // Ensure vowelFocus and letterGroup match the requested values
      vowelFocus: vowelFocus as CvcSpellerData['vowelFocus'],
      letterGroup: letterGroup as CvcSpellerData['letterGroup'],
      // Merge with any config overrides
      ...config,
    };

    // Ensure challenges have correct structure
    if (finalData.challenges) {
      finalData.challenges = finalData.challenges.map((challenge, idx) => ({
        ...challenge,
        id: challenge.id || `c${idx + 1}`,
        targetLetters: challenge.targetLetters || challenge.targetWord.split(''),
        emoji: challenge.emoji || '',
        distractorLetters: challenge.distractorLetters || [],
        commonErrors: challenge.commonErrors || [],
      }));
    }

    console.log('CVC Speller Generated:', {
      title: finalData.title,
      vowelFocus: finalData.vowelFocus,
      letterGroup: finalData.letterGroup,
      challengeCount: finalData.challenges?.length || 0,
      words: finalData.challenges?.map(c => c.targetWord) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating CVC speller:", error);
    throw error;
  }
};
