import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  LetterSoundLinkData,
  LetterSoundLinkChallenge,
} from "../../primitives/visual-primitives/literacy/LetterSoundLink";
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
  'see-hear': {
    promptDoc:
      `"see-hear": Student sees a letter displayed, picks the correct SOUND from 4 options. `
      + `2-3 challenges per session. Options are {sound: "/phoneme/", isCorrect: boolean}. Exactly ONE correct. `
      + `Pick distractor sounds from other letters in the cumulative group.`,
    schemaDescription: "'see-hear' (see letter, pick sound)",
  },
  'hear-see': {
    promptDoc:
      `"hear-see": Student hears a sound, picks the correct LETTER from 4 options. `
      + `2-3 challenges per session. Options are {letter: "x", isCorrect: boolean}. Exactly ONE correct. `
      + `If target sound /k/ can be made by both c and k, set sharedSoundLetters to ["c", "k"].`,
    schemaDescription: "'hear-see' (hear sound, find letter)",
  },
  'keyword-match': {
    promptDoc:
      `"keyword-match": Student sees a letter and picks the correct KEYWORD WORD from 4 options. `
      + `2-3 challenges per session. Options are {sound: "keyword_word", isCorrect: boolean}. Exactly ONE correct. `
      + `Distractor keywords come from other letters in the cumulative group.`,
    schemaDescription: "'keyword-match' (match letter to keyword)",
  },
};

/**
 * Schema definition for Letter Sound Link Data
 *
 * Generates interactive letter-sound correspondence activities for K-2 students.
 * Three modes: See-Hear (see letter, pick sound), Hear-See (hear sound, find letter),
 * Keyword-Match (match letter to its keyword association).
 * Follows cumulative group progression across 4 letter groups.
 */
const letterSoundLinkSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the letter-sound activity (e.g., 'Letter Sounds - Group 1!')",
    },
    letterGroup: {
      type: Type.NUMBER,
      description: "Which letter group (1, 2, 3, or 4)",
    },
    cumulativeLetters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "All letters available in this group (lowercase)",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')",
          },
          mode: {
            type: Type.STRING,
            enum: ["see-hear", "hear-see", "keyword-match"],
            description: "Challenge mode",
          },
          targetLetter: {
            type: Type.STRING,
            description: "The target letter (lowercase, e.g., 's', 'a'). Use 'qu' for the digraph.",
          },
          targetSound: {
            type: Type.STRING,
            description: "The phoneme for this letter using clean slash notation (e.g., '/s/', '/k/', '/ks/')",
          },
          keywordWord: {
            type: Type.STRING,
            description: "The keyword association word (e.g., 'sun' for s, 'apple' for a)",
          },
          keywordImage: {
            type: Type.STRING,
            description: "The keyword image identifier (same as keywordWord, e.g., 'sun', 'apple')",
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                letter: { type: Type.STRING, description: "Letter option (for hear-see mode)" },
                sound: { type: Type.STRING, description: "Sound option (for see-hear mode) or keyword word (for keyword-match mode)" },
                isCorrect: { type: Type.BOOLEAN, description: "Whether this option is the correct answer" },
              },
              required: ["isCorrect"],
            },
            description: "Exactly 4 options with exactly one correct. For see-hear: {sound, isCorrect}. For hear-see: {letter, isCorrect}. For keyword-match: {sound (=keyword word), isCorrect}.",
          },
          sharedSoundLetters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Letters that share the same sound (e.g., ['c', 'k'] both make /k/). Only needed when relevant.",
          },
        },
        required: ["id", "mode", "targetLetter", "targetSound", "keywordWord", "keywordImage", "options"],
      },
      description: "Array of 6-8 challenges mixing see-hear, hear-see, and keyword-match modes",
    },
  },
  required: ["title", "letterGroup", "cumulativeLetters", "challenges"],
};

// ============================================================================
// Letter Group Definitions
// ============================================================================

const LETTER_GROUPS: Record<number, string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'],
  4: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'qu'],
};

const LETTER_SOUNDS: Record<string, string> = {
  s: '/s/', a: '/\u0103/', t: '/t/', i: '/\u012d/', p: '/p/', n: '/n/',
  c: '/k/', k: '/k/', e: '/\u0115/', h: '/h/', r: '/r/', m: '/m/', d: '/d/',
  g: '/g/', o: '/\u014f/', u: '/\u016d/', l: '/l/', f: '/f/', b: '/b/',
  j: '/j/', z: '/z/', w: '/w/', v: '/v/', y: '/y/', x: '/ks/', qu: '/kw/',
};

const KEYWORD_MAP: Record<string, string> = {
  s: 'sun', a: 'apple', t: 'top', i: 'itch', p: 'pig', n: 'net',
  c: 'cat', k: 'kite', e: 'egg', h: 'hat', r: 'run', m: 'map', d: 'dog',
  g: 'go', o: 'octopus', u: 'up', l: 'lip', f: 'fan', b: 'bat',
  j: 'jam', z: 'zip', w: 'web', v: 'van', y: 'yes', x: 'box', qu: 'queen',
};

// Letters that share the same sound
const SHARED_SOUND_MAP: Record<string, string[]> = {
  c: ['c', 'k'],
  k: ['c', 'k'],
};

/**
 * Generate Letter Sound Link data using Gemini AI
 *
 * Creates interactive letter-sound correspondence activities with three modes:
 * - See-Hear: See a letter displayed, pick its sound from options
 * - Hear-See: Hear a phoneme, identify which letter makes that sound
 * - Keyword-Match: Match a letter to its keyword association (e.g., s -> sun)
 *
 * Follows cumulative group progression:
 * - Group 1: s, a, t, i, p, n  (sounds /s/, /a/, /t/, /i/, /p/, /n/)
 * - Group 2: Group 1 + c, k, e, h, r, m, d  (c and k both make /k/)
 * - Group 3: Group 2 + g, o, u, l, f, b
 * - Group 4: Group 3 + j, z, w, v, y, x (=/ks/), qu (=/kw/)
 *
 * @param topic - Theme or context for the activity
 * @param gradeLevel - Grade level ('K', '1', or '2')
 * @param config - Optional config with letterGroup override and targetEvalMode
 * @returns LetterSoundLinkData with challenges across all three modes
 */
export const generateLetterSoundLink = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<{
    letterGroup: number;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>,
): Promise<LetterSoundLinkData> => {

  // -------------------------------------------------------------------------
  // Eval mode resolution
  // -------------------------------------------------------------------------
  const evalConstraint = resolveEvalModeConstraint(
    'letter-sound-link',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('LetterSoundLink', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(letterSoundLinkSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'mode',
      })
    : letterSoundLinkSchema;

  // -------------------------------------------------------------------------
  // Letter group setup
  // -------------------------------------------------------------------------
  const letterGroup = (config?.letterGroup && config.letterGroup >= 1 && config.letterGroup <= 4)
    ? config.letterGroup
    : 1;

  const cumulativeLetters = LETTER_GROUPS[letterGroup];

  // Build a letter-sound reference string for the prompt
  const letterSoundRef = cumulativeLetters
    .map(l => `${l} = ${LETTER_SOUNDS[l]} (keyword: ${KEYWORD_MAP[l]})`)
    .join(', ');

  // -------------------------------------------------------------------------
  // Build prompt with eval-mode-scoped challenge type docs
  // -------------------------------------------------------------------------
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create an interactive letter-sound correspondence activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevel}
LETTER GROUP: ${letterGroup}
CUMULATIVE LETTERS (all available): ${cumulativeLetters.join(', ')}

LETTER-SOUND-KEYWORD REFERENCE:
${letterSoundRef}

Generate 6-8 challenges. Each challenge links a letter to its sound and keyword.

${challengeTypeSection}

MODE-SPECIFIC OPTION FORMATS:
- see-hear: options are {sound: "/phoneme/", isCorrect: boolean}
- hear-see: options are {letter: "x", isCorrect: boolean}
- keyword-match: options are {sound: "keyword_word", isCorrect: boolean}

RULES:
- Use IDs: ch1, ch2, ch3, etc.
- Use ONLY letters from the cumulative group: [${cumulativeLetters.join(', ')}]
- Use clean slash notation for sounds: /s/, /t/, /k/, etc. Short vowels use the plain letter.
- keywordImage is always identical to keywordWord.
- For c and k challenges, always include sharedSoundLetters: ["c", "k"].
${!evalConstraint ? '- Order challenges so modes alternate (don\'t cluster the same mode together).' : ''}

LETTER GROUP DATA:
- letterGroup: ${letterGroup}
- cumulativeLetters: [${cumulativeLetters.map(l => `"${l}"`).join(', ')}]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 literacy specialist designing letter-sound correspondence activities. You understand phonics instruction and the alphabetic principle. You create engaging, developmentally appropriate challenges that help young students learn the sounds letters make, using keyword associations (s=sun, a=apple, etc.) to anchor learning. You always use letters and sounds only from the specified cumulative group. You use clean phoneme notation with slashes (e.g., /s/, /k/).`,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as LetterSoundLinkData;

    // ========================================================================
    // Post-generation validation & defaults
    // ========================================================================

    // Ensure letterGroup is correct
    result.letterGroup = letterGroup as 1 | 2 | 3 | 4;

    // Enforce correct cumulative letter set
    result.cumulativeLetters = cumulativeLetters;

    // Validate challenges
    if (result.challenges) {
      result.challenges = result.challenges.map((ch: LetterSoundLinkChallenge, i: number) => {
        // Ensure IDs exist
        if (!ch.id) ch.id = `ch${i + 1}`;

        // Ensure targetLetter is lowercase and within group
        ch.targetLetter = (ch.targetLetter || 's').toLowerCase();
        if (!cumulativeLetters.includes(ch.targetLetter)) {
          ch.targetLetter = cumulativeLetters[i % cumulativeLetters.length];
        }

        // Ensure targetSound uses the canonical sound
        ch.targetSound = LETTER_SOUNDS[ch.targetLetter] || ch.targetSound || '/s/';

        // Ensure keyword word and image are correct
        ch.keywordWord = KEYWORD_MAP[ch.targetLetter] || ch.keywordWord || 'sun';
        ch.keywordImage = ch.keywordWord;

        // Populate sharedSoundLetters for c/k
        if (SHARED_SOUND_MAP[ch.targetLetter]) {
          ch.sharedSoundLetters = SHARED_SOUND_MAP[ch.targetLetter];
        }

        // Validate options: must have exactly 4 with exactly 1 correct
        ch.options = validateOptions(ch, cumulativeLetters);

        return ch;
      });

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'see-hear';
        const targetLetter = cumulativeLetters[0];
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'see-hear' | 'hear-see' | 'keyword-match',
          targetLetter,
          targetSound: LETTER_SOUNDS[targetLetter],
          keywordWord: KEYWORD_MAP[targetLetter],
          keywordImage: KEYWORD_MAP[targetLetter],
          options: [
            { sound: LETTER_SOUNDS[targetLetter], isCorrect: true },
            ...cumulativeLetters
              .filter(l => LETTER_SOUNDS[l] !== LETTER_SOUNDS[targetLetter])
              .slice(0, 3)
              .map(l => ({ sound: LETTER_SOUNDS[l], isCorrect: false })),
          ],
        }];
      }
    }

    console.log('Letter Sound Link Generated:', {
      title: result.title,
      letterGroup: result.letterGroup,
      cumulativeLetters: result.cumulativeLetters.join(', '),
      challengeCount: result.challenges?.length || 0,
      modes: result.challenges?.map(ch => ch.mode) || [],
    });

    return result;

  } catch (error) {
    console.error("Error generating letter sound link:", error);
    throw error;
  }
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Ensure options array has exactly 4 entries with exactly 1 correct,
 * and the correct option matches the challenge's target.
 */
function validateOptions(
  ch: LetterSoundLinkChallenge,
  cumulativeLetters: string[],
): Array<{ letter?: string; sound?: string; isCorrect: boolean }> {
  const opts = ch.options || [];

  if (ch.mode === 'see-hear') {
    // Options should be { sound, isCorrect }
    return ensureFourOptions(
      opts,
      ch.targetSound,
      'sound',
      cumulativeLetters
        .filter(l => LETTER_SOUNDS[l] !== ch.targetSound)
        .map(l => LETTER_SOUNDS[l]),
    );
  } else if (ch.mode === 'hear-see') {
    // Options should be { letter, isCorrect }
    return ensureFourOptions(
      opts,
      ch.targetLetter,
      'letter',
      cumulativeLetters.filter(l => l !== ch.targetLetter),
    );
  } else {
    // keyword-match: options should be { sound (= keyword word), isCorrect }
    return ensureFourOptions(
      opts,
      ch.keywordWord,
      'sound',
      cumulativeLetters
        .filter(l => KEYWORD_MAP[l] !== ch.keywordWord)
        .map(l => KEYWORD_MAP[l]),
    );
  }
}

/**
 * Generic helper to ensure exactly 4 options with 1 correct answer.
 */
function ensureFourOptions(
  existing: Array<{ letter?: string; sound?: string; isCorrect: boolean }>,
  correctValue: string,
  field: 'letter' | 'sound',
  distractorPool: string[],
): Array<{ letter?: string; sound?: string; isCorrect: boolean }> {
  // Deduplicate the distractor pool
  const uniqueDistractors = Array.from(new Set(distractorPool)).filter(d => d !== correctValue);

  // Count correct answers
  const correctCount = existing.filter(o => o.isCorrect).length;

  // If we have exactly 4 options with exactly 1 correct, just validate the correct value
  if (existing.length === 4 && correctCount === 1) {
    const correctOpt = existing.find(o => o.isCorrect);
    if (correctOpt) {
      correctOpt[field] = correctValue;
    }
    return existing;
  }

  // Otherwise, rebuild the options
  const shuffled = uniqueDistractors.sort(() => Math.random() - 0.5).slice(0, 3);
  const options: Array<{ letter?: string; sound?: string; isCorrect: boolean }> = [
    { [field]: correctValue, isCorrect: true },
    ...shuffled.map(d => ({ [field]: d, isCorrect: false })),
  ];

  // Pad if we don't have enough distractors
  while (options.length < 4) {
    options.push({ [field]: `?${options.length}`, isCorrect: false });
  }

  // Shuffle final options
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}
