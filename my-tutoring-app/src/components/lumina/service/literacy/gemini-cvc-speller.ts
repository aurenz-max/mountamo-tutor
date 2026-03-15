import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { CvcSpellerData } from "../../primitives/visual-primitives/literacy/CvcSpeller";
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
  'fill-vowel': {
    promptDoc:
      `"fill-vowel": Student hears a CVC word (AI says it), sees the consonant frame (e.g., "c_t"), `
      + `and picks the correct vowel from 2 confusable options. Binary discrimination — exactly 2 vowel choices. `
      + `The AI provides progressive scaffolding: natural word → stretched vowel → isolated vowel sound.`,
    schemaDescription: "'fill-vowel' (hear word, pick missing vowel from 2 options)",
  },
  'spell-word': {
    promptDoc:
      `"spell-word": Student hears a CVC word (AI says it) and spells the full word by placing 3 letters `
      + `into Elkonin-box slots. Letter bank has target letters + distractors. `
      + `AI scaffolds: natural word → onset-rime segmentation → full phoneme segmentation.`,
    schemaDescription: "'spell-word' (hear word, spell all 3 letters in Elkonin boxes)",
  },
  'word-sort': {
    promptDoc:
      `"word-sort": Student hears CVC words one at a time (AI says each word) and sorts them into `
      + `2 vowel-sound buckets. Each bucket represents a confusable short vowel (e.g., short-a vs short-e). `
      + `AI scaffolds: say word naturally → stretch vowel → contrast both vowel sounds.`,
    schemaDescription: "'word-sort' (hear words, sort into 2 vowel-sound buckets)",
  },
};

// ---------------------------------------------------------------------------
// Confusable vowel pairs for fill-vowel and word-sort distractors
// ---------------------------------------------------------------------------

const CONFUSABLE_VOWELS: Record<string, string> = {
  a: 'e',   // short-a ↔ short-e is the classic kindergarten confusion
  e: 'i',   // short-e ↔ short-i
  i: 'e',   // short-i ↔ short-e
  o: 'u',   // short-o ↔ short-u
  u: 'o',   // short-u ↔ short-o
};

const VOWEL_KEYWORDS: Record<string, string> = {
  a: 'apple', e: 'egg', i: 'itch', o: 'octopus', u: 'up',
};

/**
 * Schema definition for CVC Speller Data
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel: Hear word, pick missing vowel (binary discrimination)
 * - spell-word: Hear word, spell all 3 letters (Elkonin boxes)
 * - word-sort: Hear words, categorize by vowel sound (2 buckets)
 *
 * Audio-first design: all words delivered via AI tutor voice.
 * AI scaffolding provides progressive phoneme segmentation.
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
          taskType: {
            type: Type.STRING,
            enum: ["fill-vowel", "spell-word", "word-sort"],
            description: "The task type for this challenge"
          },
          targetWord: {
            type: Type.STRING,
            description: "The 3-letter CVC word (e.g., 'cat', 'hen', 'pig')"
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
            description: "A single emoji representing the word (e.g., '🐱' for cat)"
          },
          imageDescription: {
            type: Type.STRING,
            description: "Brief visual description of the word"
          },
          distractorLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 extra letters NOT in the target word, used as distractors in the letter bank (spell-word mode)"
          },
          vowelOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 2 vowel letters for fill-vowel mode (e.g., ['a', 'e']). One correct, one confusable distractor."
          },
          sortBucketLabel: {
            type: Type.STRING,
            description: "For word-sort mode: which vowel sound bucket this word belongs to (e.g., 'short-a' or 'short-e')"
          },
          commonErrors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                errorSpelling: {
                  type: Type.STRING,
                  description: "A common misspelling of the target word"
                },
                feedback: {
                  type: Type.STRING,
                  description: "Helpful corrective feedback for this error"
                }
              },
              required: ["errorSpelling", "feedback"]
            },
            description: "Common misspellings with corrective feedback (spell-word mode)"
          }
        },
        required: ["id", "taskType", "targetWord", "targetLetters", "targetPhonemes", "emoji", "imageDescription"]
      },
      description: "Array of 4-6 CVC word challenges"
    }
  },
  required: ["title", "vowelFocus", "letterGroup", "availableLetters", "challenges"]
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUP_SETS: Record<number, string[]> = {
  1: ['s', 't', 'm', 'p'],
  2: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g'],
  3: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g', 'f', 'h', 'l', 'r', 'w'],
  4: ['s', 't', 'm', 'p', 'n', 'c', 'b', 'd', 'g', 'f', 'h', 'l', 'r', 'w', 'j', 'k', 'v', 'x', 'y', 'z'],
};

const VOWEL_MAP: Record<string, string> = {
  'short-a': 'a', 'short-e': 'e', 'short-i': 'i', 'short-o': 'o', 'short-u': 'u',
};

/**
 * Generate CVC Speller data using Gemini AI
 *
 * Three task modes with progressive difficulty:
 * - fill-vowel (β 1.5): Hear word, pick missing vowel from 2 confusable options
 * - spell-word (β 2.5): Hear word, spell all 3 letters in Elkonin boxes
 * - word-sort (β 3.5): Hear words, categorize into 2 vowel-sound buckets
 *
 * Audio-first: words are delivered via AI tutor voice, not shown as text.
 * AI scaffolding provides progressive phoneme segmentation at each level.
 */
export const generateCvcSpeller = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<CvcSpellerData & { targetEvalMode?: string }>
): Promise<CvcSpellerData> => {

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'cvc-speller',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('CvcSpeller', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(cvcSpellerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'taskType',
      })
    : cvcSpellerSchema;

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  const vowelFocus = config?.vowelFocus || 'short-a';
  const letterGroup = config?.letterGroup || 1;
  const targetVowel = VOWEL_MAP[vowelFocus] || 'a';
  const confusableVowel = CONFUSABLE_VOWELS[targetVowel] || (targetVowel === 'a' ? 'e' : 'a');
  const consonants = LETTER_GROUP_SETS[letterGroup] || LETTER_GROUP_SETS[1];

  // -------------------------------------------------------------------------
  // Build prompt
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create a CVC word spelling activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
VOWEL FOCUS: ${vowelFocus} (the vowel "${targetVowel}")
CONFUSABLE VOWEL PAIR: "${targetVowel}" vs "${confusableVowel}" (${VOWEL_KEYWORDS[targetVowel]} vs ${VOWEL_KEYWORDS[confusableVowel]})
LETTER GROUP: ${letterGroup} (available consonants: ${consonants.join(', ')})

AUDIO-FIRST DESIGN:
This is an audio-first activity. The AI tutor SAYS each word aloud — students LISTEN, they don't read.
The AI provides progressive scaffolding: natural word → stretched sounds → isolated phonemes.

${challengeTypeSection}

TASK-SPECIFIC FORMATS:

For "fill-vowel" challenges:
- Student hears the word, sees consonant frame (e.g., "c_t"), picks from 2 vowels
- vowelOptions: exactly 2 vowels — the correct one ("${targetVowel}") and confusable ("${confusableVowel}")
- distractorLetters: not needed (omit or empty)
- Words must use vowel "${targetVowel}" — the confusable "${confusableVowel}" is ONLY for the wrong option

For "spell-word" challenges:
- Student hears the word and places all 3 letters in Elkonin boxes
- distractorLetters: 3-5 letters NOT in the target word
- vowelOptions: not needed
- commonErrors: 1-2 common misspellings with feedback

For "word-sort" challenges:
- Student hears words and sorts into 2 buckets by vowel sound
- sortBucketLabel: either "${vowelFocus}" or "short-${confusableVowel}"
- Include a MIX of both vowels — some words use "${targetVowel}", some use "${confusableVowel}"
- vowelOptions: not needed, distractorLetters: not needed
- IMPORTANT: word-sort challenges MUST include words with BOTH vowels (not just "${targetVowel}")

REQUIREMENTS:
- 4-6 challenges total
- ALL words must be real English CVC words (3 letters)
- Only use consonants from letter group ${letterGroup}: ${consonants.join(', ')}
- targetLetters: exactly 3 letters spelling the word
- targetPhonemes: exactly 3 phonemes in slash notation
- Choose concrete, picturable words appropriate for K-2
${!evalConstraint ? '- Mix task types to create variety (e.g., 2 fill-vowel, 2 spell-word, 2 word-sort)' : ''}

PHONEME NOTATION:
- Short vowels: /æ/ (a), /ɛ/ (e), /ɪ/ (i), /ɒ/ (o), /ʌ/ (u)
- Consonants: /b/, /k/ (for c), /d/, /f/, /g/, /h/, /j/, /k/, /l/, /m/, /n/, /p/, /r/, /s/, /t/, /v/, /w/, /y/, /z/`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 reading and spelling specialist. You create engaging, developmentally appropriate CVC word spelling activities that build phonemic awareness and letter-sound correspondence. You understand which CVC words are real, common English words appropriate for young learners. You ensure all phoneme notations are linguistically accurate and that every word strictly follows the CVC pattern with the specified vowel. You choose concrete, picturable words that motivate young spellers. For word-sort challenges, you include words with BOTH the target vowel and the confusable vowel.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as CvcSpellerData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    result.vowelFocus = vowelFocus as CvcSpellerData['vowelFocus'];
    result.letterGroup = letterGroup as CvcSpellerData['letterGroup'];

    if (result.challenges) {
      result.challenges = result.challenges.map((ch, idx) => {
        ch.id = ch.id || `c${idx + 1}`;
        ch.taskType = ch.taskType || (evalConstraint?.allowedTypes[0] as 'fill-vowel' | 'spell-word' | 'word-sort') || 'spell-word';
        ch.targetLetters = ch.targetLetters || ch.targetWord.split('');
        ch.emoji = ch.emoji || '';
        ch.imageDescription = ch.imageDescription || '';
        ch.distractorLetters = ch.distractorLetters || [];
        ch.commonErrors = ch.commonErrors || [];

        // Ensure fill-vowel has exactly 2 vowel options
        if (ch.taskType === 'fill-vowel') {
          if (!ch.vowelOptions || ch.vowelOptions.length !== 2) {
            ch.vowelOptions = [targetVowel, confusableVowel];
          }
          // Shuffle vowel options
          if (Math.random() > 0.5 && ch.vowelOptions) {
            ch.vowelOptions = [ch.vowelOptions[1], ch.vowelOptions[0]];
          }
        }

        // Ensure word-sort has a bucket label
        if (ch.taskType === 'word-sort' && !ch.sortBucketLabel) {
          const middleLetter = ch.targetLetters[1]?.toLowerCase();
          ch.sortBucketLabel = middleLetter === confusableVowel
            ? `short-${confusableVowel}`
            : vowelFocus;
        }

        return ch;
      });
    }

    console.log('CVC Speller Generated:', {
      title: result.title,
      vowelFocus: result.vowelFocus,
      letterGroup: result.letterGroup,
      challengeCount: result.challenges?.length || 0,
      taskTypes: result.challenges?.map(c => c.taskType) || [],
      words: result.challenges?.map(c => c.targetWord) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating CVC speller:", error);
    throw error;
  }
};
