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
      `"see-hear": Student sees a letter displayed, hears two sounds via speaker buttons, and picks the correct one. `
      + `2-3 challenges per session. Options are {sound: "/phoneme/", isCorrect: boolean}. Exactly ONE correct. `
      + `Pick a confusable distractor sound — phonologically similar but distinct (see DISTRACTOR RULES).`,
    schemaDescription: "'see-hear' (see letter, pick sound from 2 speaker buttons)",
  },
  'hear-see': {
    promptDoc:
      `"hear-see": Student hears a sound (auto-played), picks the correct LETTER from 2 options. `
      + `2-3 challenges per session. Options are {letter: "x", isCorrect: boolean}. Exactly ONE correct. `
      + `Pick a letter whose sound is confusable with the target (see DISTRACTOR RULES). `
      + `If target sound /k/ can be made by both c and k, set sharedSoundLetters to ["c", "k"].`,
    schemaDescription: "'hear-see' (hear sound, find letter from 2 options)",
  },
  'keyword-match': {
    promptDoc:
      `"keyword-match": Student sees a letter and picks the correct KEYWORD WORD from 2 options. `
      + `2-3 challenges per session. Options are {sound: "keyword_word", isCorrect: boolean}. Exactly ONE correct. `
      + `Distractor keyword should start with a confusable sound (see DISTRACTOR RULES).`,
    schemaDescription: "'keyword-match' (match letter to keyword from 2 options)",
  },
};

/**
 * Schema definition for Letter Sound Link Data
 *
 * Generates interactive letter-sound correspondence activities for K-2 students.
 * Audio-first design: students hear sounds via speaker buttons, no phoneme text visible.
 * Binary discrimination (2 options) for developmentally appropriate sound comparison.
 * Three modes: See-Hear, Hear-See, Keyword-Match.
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
            description: "Exactly 2 options with exactly one correct. For see-hear: {sound, isCorrect}. For hear-see: {letter, isCorrect}. For keyword-match: {sound (=keyword word), isCorrect}.",
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

// ============================================================================
// Confusable Sound Pairs — pedagogically meaningful distractors
// ============================================================================

/**
 * For each letter, the best distractor letter(s) whose sound is phonologically
 * similar but distinct. Ordered by confusion likelihood.
 *
 * Principles:
 * - Voiced/unvoiced pairs: t↔d, p↔b, s↔z, f↔v, k↔g
 * - Short vowel confusions: a↔e, i↔e, o↔u
 * - Place-of-articulation: m↔n, l↔r
 * - NEVER pair c↔k (identical /k/ sound — impossible to distinguish)
 */
const CONFUSABLE_DISTRACTORS: Record<string, string[]> = {
  s: ['z', 'f'],       // voiceless fricatives
  a: ['e', 'o'],       // short vowels
  t: ['d', 'p'],       // voiced/unvoiced alveolar stops
  i: ['e', 'u'],       // short vowels
  p: ['b', 't'],       // voiced/unvoiced bilabial stops
  n: ['m', 'l'],       // nasals / liquids
  c: ['g', 't'],       // velar stops — NOT k (same sound!)
  k: ['g', 't'],       // velar stops — NOT c (same sound!)
  e: ['i', 'a'],       // short vowels
  h: ['f', 'w'],       // breathy / fricatives
  r: ['l', 'w'],       // liquids
  m: ['n', 'b'],       // nasals
  d: ['t', 'b'],       // voiced/unvoiced alveolar stops
  g: ['k', 'd'],       // velar stops (k here is fine — different letter, same sound class)
  o: ['u', 'a'],       // short vowels
  u: ['o', 'i'],       // short vowels
  l: ['r', 'n'],       // liquids
  f: ['v', 's'],       // voiced/unvoiced labiodental fricatives
  b: ['p', 'd'],       // voiced/unvoiced bilabial stops
  j: ['z', 'g'],       // voiced fricative/affricates
  z: ['s', 'j'],       // voiced/unvoiced sibilants
  w: ['r', 'y'],       // glides
  v: ['f', 'b'],       // voiced/unvoiced labiodentals
  y: ['w', 'l'],       // glides
  x: ['s', 'z'],       // /ks/ vs similar fricatives
  qu: ['k', 'w'],      // /kw/ components
};

/**
 * Pick the best confusable distractor letter for a given target,
 * filtering to only letters in the current cumulative group.
 */
function pickDistractor(targetLetter: string, cumulativeLetters: string[]): string {
  const candidates = CONFUSABLE_DISTRACTORS[targetLetter] || [];

  // Find the first confusable that is in the cumulative group
  for (const candidate of candidates) {
    if (cumulativeLetters.includes(candidate) && candidate !== targetLetter) {
      // Extra guard: don't pick a letter with the exact same sound
      if (LETTER_SOUNDS[candidate] !== LETTER_SOUNDS[targetLetter]) {
        return candidate;
      }
    }
  }

  // Fallback: pick any letter from the group with a different sound
  const fallbacks = cumulativeLetters.filter(
    l => l !== targetLetter && LETTER_SOUNDS[l] !== LETTER_SOUNDS[targetLetter],
  );
  return fallbacks[Math.floor(Math.random() * fallbacks.length)] || cumulativeLetters[0];
}

/**
 * Generate Letter Sound Link data using Gemini AI
 *
 * Creates interactive letter-sound correspondence activities with three modes:
 * - See-Hear: See a letter displayed, hear two sounds via speaker buttons, pick the right one
 * - Hear-See: Hear a phoneme (auto-played), identify which of two letters makes that sound
 * - Keyword-Match: See a letter, match to the correct keyword from two options
 *
 * Audio-first design: sounds are played through AI tutor, not shown as text.
 * Binary discrimination (2 options) for developmentally appropriate K-1 assessment.
 * Distractors are phonologically confusable pairs (t/d, p/b, a/e, etc.).
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

  // Build confusable pairs reference for the prompt
  const confusablePairsRef = cumulativeLetters
    .map(l => {
      const distractor = pickDistractor(l, cumulativeLetters);
      return `${l}(${LETTER_SOUNDS[l]}) ↔ ${distractor}(${LETTER_SOUNDS[distractor]})`;
    })
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

BINARY DISCRIMINATION FORMAT:
Every challenge has EXACTLY 2 options — one correct, one distractor.
This is an audio-first activity: students HEAR sounds via speaker buttons, they do NOT read phoneme text.
The distractor must be a phonologically confusable sound — not random.

DISTRACTOR RULES (CRITICAL):
- Pick distractors that sound SIMILAR but are DISTINCT to train real phonological discrimination.
- GOOD confusable pairs: t↔d (voiced/unvoiced), p↔b, s↔z, f↔v, a↔e (short vowels), i↔e, o↔u, m↔n, l↔r
- NEVER pair c and k as distractor options — they make the SAME sound /k/ and are impossible to tell apart!
- NEVER pair letters that produce identical phonemes.
- For hear-see mode: the two letter options must make DIFFERENT sounds.
- Suggested confusable pairs for this group: ${confusablePairsRef}

MODE-SPECIFIC OPTION FORMATS (2 options each):
- see-hear: options are {sound: "/phoneme/", isCorrect: boolean} — exactly 2 options
- hear-see: options are {letter: "x", isCorrect: boolean} — exactly 2 options
- keyword-match: options are {sound: "keyword_word", isCorrect: boolean} — exactly 2 options

RULES:
- Use IDs: ch1, ch2, ch3, etc.
- Use ONLY letters from the cumulative group: [${cumulativeLetters.join(', ')}]
- Use clean slash notation for sounds: /s/, /t/, /k/, etc. Short vowels use the plain letter.
- keywordImage is always identical to keywordWord.
- For c and k challenges, always include sharedSoundLetters: ["c", "k"].
- EXACTLY 2 options per challenge — no more, no less.
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
        systemInstruction: `You are an expert K-2 literacy specialist designing letter-sound correspondence activities. You understand phonics instruction and the alphabetic principle. You create engaging, developmentally appropriate challenges that help young students learn the sounds letters make, using keyword associations (s=sun, a=apple, etc.) to anchor learning. You always use letters and sounds only from the specified cumulative group. You use clean phoneme notation with slashes (e.g., /s/, /k/). CRITICAL: Each challenge has exactly 2 options (binary discrimination). Distractors must be phonologically confusable — never pair letters that make the same sound (like c and k).`,
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

        // Validate options: must have exactly 2 with exactly 1 correct
        ch.options = validateOptions(ch, cumulativeLetters);

        return ch;
      });

      // Fallback: ensure at least one challenge exists
      if (result.challenges.length === 0) {
        const fallbackMode = evalConstraint?.allowedTypes[0] ?? 'see-hear';
        const targetLetter = cumulativeLetters[0];
        const distractor = pickDistractor(targetLetter, cumulativeLetters);
        result.challenges = [{
          id: 'ch1',
          mode: fallbackMode as 'see-hear' | 'hear-see' | 'keyword-match',
          targetLetter,
          targetSound: LETTER_SOUNDS[targetLetter],
          keywordWord: KEYWORD_MAP[targetLetter],
          keywordImage: KEYWORD_MAP[targetLetter],
          options: [
            { sound: LETTER_SOUNDS[targetLetter], isCorrect: true },
            { sound: LETTER_SOUNDS[distractor], isCorrect: false },
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
      optionCounts: result.challenges?.map(ch => ch.options?.length || 0) || [],
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
 * Ensure options array has exactly 2 entries with exactly 1 correct,
 * and the correct option matches the challenge's target.
 * Uses confusable distractor pairs for pedagogically meaningful distractors.
 */
function validateOptions(
  ch: LetterSoundLinkChallenge,
  cumulativeLetters: string[],
): Array<{ letter?: string; sound?: string; isCorrect: boolean }> {
  const opts = ch.options || [];

  if (ch.mode === 'see-hear') {
    return ensureTwoOptions(
      opts,
      ch.targetSound,
      ch.targetLetter,
      'sound',
      cumulativeLetters,
    );
  } else if (ch.mode === 'hear-see') {
    return ensureTwoOptions(
      opts,
      ch.targetLetter,
      ch.targetLetter,
      'letter',
      cumulativeLetters,
    );
  } else {
    // keyword-match
    return ensureTwoOptions(
      opts,
      ch.keywordWord,
      ch.targetLetter,
      'sound',
      cumulativeLetters,
    );
  }
}

/**
 * Generic helper to ensure exactly 2 options with 1 correct answer.
 * Uses confusable distractor selection for pedagogically meaningful pairs.
 */
function ensureTwoOptions(
  existing: Array<{ letter?: string; sound?: string; isCorrect: boolean }>,
  correctValue: string,
  targetLetter: string,
  field: 'letter' | 'sound',
  cumulativeLetters: string[],
): Array<{ letter?: string; sound?: string; isCorrect: boolean }> {
  // Count correct answers
  const correctCount = existing.filter(o => o.isCorrect).length;

  // If we have exactly 2 options with exactly 1 correct, validate values
  if (existing.length === 2 && correctCount === 1) {
    const correctOpt = existing.find(o => o.isCorrect);
    if (correctOpt) {
      correctOpt[field] = correctValue;
    }

    // Ensure the distractor doesn't have the same value as correct
    const wrongOpt = existing.find(o => !o.isCorrect);
    if (wrongOpt && wrongOpt[field] === correctValue) {
      // Replace with a confusable distractor
      const distractor = pickDistractor(targetLetter, cumulativeLetters);
      if (field === 'sound') {
        wrongOpt.sound = LETTER_SOUNDS[distractor] || wrongOpt.sound;
      } else {
        wrongOpt.letter = distractor;
      }
    }

    return existing;
  }

  // Rebuild with confusable distractor
  const distractor = pickDistractor(targetLetter, cumulativeLetters);
  let distractorValue: string;

  if (field === 'sound') {
    // For see-hear mode, distractor is a sound; for keyword-match, distractor is a keyword
    distractorValue = existing.length > 0 && existing[0]?.isCorrect === false
      ? (existing[0].sound || LETTER_SOUNDS[distractor])
      : (field === 'sound' && correctValue.startsWith('/'))
        ? LETTER_SOUNDS[distractor]
        : KEYWORD_MAP[distractor] || LETTER_SOUNDS[distractor];
  } else {
    distractorValue = distractor;
  }

  const options: Array<{ letter?: string; sound?: string; isCorrect: boolean }> = [
    { [field]: correctValue, isCorrect: true },
    { [field]: distractorValue, isCorrect: false },
  ];

  // Shuffle
  if (Math.random() > 0.5) {
    [options[0], options[1]] = [options[1], options[0]];
  }

  return options;
}
