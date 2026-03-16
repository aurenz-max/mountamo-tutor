import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { PhonicsBlenderData } from "../../primitives/visual-primitives/literacy/PhonicsBlender";
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
  cvc: {
    promptDoc:
      `"cvc": Simple consonant-vowel-consonant words with 3 phonemes each (cat, dog, sun, bus). `
      + `Use short vowel sounds only. Each phoneme maps to exactly one letter. `
      + `K level. 4-5 words per session.`,
    schemaDescription: "'cvc' (simple CVC blending)",
  },
  cvce: {
    promptDoc:
      `"cvce": Words with silent-e and long vowel sounds (cake, bike, bone, cute). `
      + `IMPORTANT: The silent-e MUST be its own phoneme with sound "//" and letters "e". `
      + `The vowel before it uses its long sound. Example: "cake" = /k/ "c", /ā/ "a", /k/ "k", /silent/ "e". `
      + `NEVER use underscore notation like "a_e" or "i_e" in the letters field. `
      + `Only use regular CVCE words — exclude irregular words like "one", "done", "gone", "come", "some", "love", "have", "give", "live". `
      + `Grade 1 level. 4-6 words per session.`,
    schemaDescription: "'cvce' (silent-e words)",
  },
  blend: {
    promptDoc:
      `"blend": Words with consonant blends where each consonant is a separate phoneme (stop, clap, frog, drum). `
      + `3-5 phonemes per word. Grade 1 level. 4-6 words per session.`,
    schemaDescription: "'blend' (consonant blends)",
  },
  digraph: {
    promptDoc:
      `"digraph": Words with digraphs (sh, ch, th, wh) where the digraph is ONE phoneme (ship, chop, thin). `
      + `3-4 phonemes per word. Grade 1 level. 4-6 words per session.`,
    schemaDescription: "'digraph' (two letters, one sound)",
  },
  'r-controlled': {
    promptDoc:
      `"r-controlled": Words with r-controlled vowels (ar, er, ir, or, ur) where the r-controlled vowel is ONE phoneme (farm, fern, bird, corn). `
      + `3-5 phonemes per word. Grade 2 level. 4-6 words per session.`,
    schemaDescription: "'r-controlled' (r-controlled vowels)",
  },
  diphthong: {
    promptDoc:
      `"diphthong": Words with diphthongs (oi/oy, ou/ow) where the diphthong is ONE phoneme (coin, boy, cloud, cow). `
      + `3-5 phonemes per word. Grade 2 level. 4-6 words per session.`,
    schemaDescription: "'diphthong' (vowel diphthongs)",
  },
};

/**
 * Schema definition for Phonics Blender Data
 *
 * Generates sound-by-sound word building activities for K-2 phonics instruction.
 * Students hear individual phonemes, arrange sound tiles in order, then blend
 * into complete words. Supports CVC, CVCE, blends, digraphs, diphthongs,
 * and r-controlled vowels.
 */
const phonicsBlenderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the phonics blending activity (e.g., 'Blend CVC Words!')"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('K', '1', or '2')"
    },
    patternType: {
      type: Type.STRING,
      enum: ["cvc", "cvce", "blend", "digraph", "r-controlled", "diphthong"],
      description: "The phonics pattern type for this activity"
    },
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this word (e.g., 'w1', 'w2')"
          },
          targetWord: {
            type: Type.STRING,
            description: "The complete target word (e.g., 'cat', 'ship', 'cake')"
          },
          phonemes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Unique phoneme identifier (e.g., 'w1_p1', 'w1_p2')"
                },
                sound: {
                  type: Type.STRING,
                  description: "The phoneme displayed to the student in slash notation (e.g., '/k/', '/æ/', '/t/', '/sh/', '/ā/')"
                },
                letters: {
                  type: Type.STRING,
                  description: "The letter(s) this phoneme maps to in the word (e.g., 'c', 'a', 't', 'sh', 'th'). For CVCE words, silent-e is its own phoneme with letters 'e'."
                }
              },
              required: ["id", "sound", "letters"]
            },
            description: "Array of phonemes that make up this word, in correct blending order"
          },
          imageDescription: {
            type: Type.STRING,
            description: "Brief description of the word for visual context (e.g., 'a small furry cat')"
          }
        },
        required: ["id", "targetWord", "phonemes", "imageDescription"]
      },
      description: "Array of 4-6 words to blend in this session"
    }
  },
  required: ["title", "gradeLevel", "patternType", "words"]
};

/**
 * Generate phonics blender data using Gemini AI
 *
 * Creates interactive sound-by-sound word building activities that scale
 * from Kindergarten CVC words through Grade 2 multisyllabic blending.
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines pattern complexity
 * @param config - Optional configuration overrides
 * @returns PhonicsBlenderData with grade-appropriate words and phoneme breakdowns
 */
export const generatePhonicsBlender = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<PhonicsBlenderData & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode: string;
  }>
): Promise<PhonicsBlenderData> => {

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'phonics-blender',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PhonicsBlender', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(phonicsBlenderSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'patternType',
        rootLevel: true,
      })
    : phonicsBlenderSchema;

  // Grade-specific phonics pattern guidelines
  const gradeContext: Record<string, string> = {
    'K': `
KINDERGARTEN GUIDELINES:
- Pattern type: cvc (consonant-vowel-consonant)
- 4-5 words per session
- Only CVC words with 3 phonemes each (e.g., cat = /k/ /æ/ /t/)
- Use short vowel sounds: /æ/ (a), /ĕ/ (e), /ĭ/ (i), /ŏ/ (o), /ŭ/ (u)
- Use common consonant sounds kids know: b, c, d, f, g, h, j, k, l, m, n, p, r, s, t, v, w, z
- Choose concrete, familiar words kids can picture: cat, dog, sun, bus, map, hat, pin, mop, cup, bed
- Each phoneme should map to exactly one letter
- Phoneme sounds use simple slash notation: /k/, /a/, /t/
- Keep it fun and use words from the topic theme when possible
- Example: "cat" -> phonemes: [{ sound: "/k/", letters: "c" }, { sound: "/a/", letters: "a" }, { sound: "/t/", letters: "t" }]
`,
    '1': `
GRADE 1 GUIDELINES:
- Pattern types: cvce, blend, or digraph
- 4-6 words per session
- For CVCE: words with silent-e (cake, bike, bone, cute, lake)
  - The silent-e MUST be its own separate phoneme with sound "//" and letters "e"
  - The vowel before it uses its long sound: "cake" = /k/ "c", /ā/ "a", /k/ "k", /silent/ "e"
  - NEVER use underscore notation like "a_e" or "i_e" — each letter is its own phoneme
  - EXCLUDE irregular words: "one", "done", "gone", "come", "some", "love", "have", "give", "live"
- For BLENDS: words with consonant blends (stop, clap, frog, drum, skip)
  - Each consonant in the blend is a separate phoneme: /s/ /t/ /ŏ/ /p/ for "stop"
- For DIGRAPHS: words with sh, ch, th, wh (ship, chop, thin, whip)
  - The digraph counts as ONE phoneme: /sh/ /ĭ/ /p/ for "ship"
- Use a mix of short and long vowel sounds as appropriate
- 3-5 phonemes per word
- Choose words grade 1 students encounter in reading
`,
    '2': `
GRADE 2 GUIDELINES:
- Pattern types: r-controlled or diphthong
- 4-6 words per session
- For R-CONTROLLED: words with ar, er, ir, or, ur (farm, fern, bird, corn, burn)
  - The r-controlled vowel is ONE phoneme: /f/ /ar/ /m/ for "farm"
- For DIPHTHONGS: words with oi/oy, ou/ow (coin, boy, cloud, cow, point)
  - The diphthong is ONE phoneme: /k/ /oi/ /n/ for "coin"
- Can include multisyllabic words (2 syllables): basket, rabbit, sunset
  - Break into phonemes, not syllables: /b/ /a/ /s/ /k/ /ĕ/ /t/ for "basket"
- 3-6 phonemes per word
- Use grade 2 vocabulary that students are learning to decode
`
  };

  const gradeLevelKey = ['K', '1', '2'].includes(gradeLevel.toUpperCase()) ? gradeLevel.toUpperCase() : 'K';
  const defaultPatternType = gradeLevelKey === 'K' ? 'cvc' : gradeLevelKey === '1' ? 'blend' : 'r-controlled';

  // ── Build prompt ────────────────────────────────────────────────────
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const generationPrompt = `Create a phonics blending activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${!evalConstraint ? (gradeContext[gradeLevelKey] || gradeContext['K']) : ''}

${challengeTypeSection}

REQUIRED INFORMATION:

1. **Title**: Fun, engaging title for the activity that includes the topic

2. **Grade Level**: "${gradeLevelKey}"

3. **Pattern Type**: "${evalConstraint ? evalConstraint.allowedTypes[0] : (config?.patternType || defaultPatternType)}"

4. **Words** (4-6 words):
   For EACH word provide:
   - id: Unique word identifier (w1, w2, w3, etc.)
   - targetWord: The complete word
   - phonemes: Array of phonemes IN CORRECT BLENDING ORDER, EACH with:
     - id: Unique phoneme ID (w1_p1, w1_p2, etc.)
     - sound: The phoneme in slash notation (e.g., /k/, /sh/, /ā/)
     - letters: The letter(s) this phoneme maps to in the written word
   - imageDescription: Brief visual description of the word

   CRITICAL PHONEME RULES:
   - Every phoneme in the array must be in the correct blending order (left to right)
   - The concatenation of all phoneme "letters" fields MUST exactly spell the targetWord
     - VERIFY: join all letters fields with no separator — the result must equal targetWord exactly
   - Every sound in the word must have its own phoneme entry — do not skip any sounds
     - Example: "nine" = /n/ "n", /ī/ "i", /n/ "n", /silent/ "e" (4 phonemes, not 2)
   - Digraphs (sh, ch, th, wh) are SINGLE phonemes with 2-letter "letters" field
   - R-controlled vowels (ar, er, ir, or, ur) are SINGLE phonemes
   - Diphthongs (oi, oy, ou, ow) are SINGLE phonemes
   - Silent-e in CVCE words: the silent "e" MUST be its own separate phoneme with sound "//" and letters "e"
     - The vowel before it uses its long sound
     - NEVER use underscore notation like "a_e" or "i_e" in the letters field
     - Example: "cake" = /k/ "c", /ā/ "a", /k/ "k", /silent/ "e"
     - Example: "bike" = /b/ "b", /ī/ "i", /k/ "k", /silent/ "e"
   - NEVER include irregular words that don't follow the pattern (e.g., "one", "done", "have" are NOT CVCE)
   - Each phoneme ID must be unique within the word (use pattern: w1_p1, w1_p2)
   - Phoneme sounds should use simple notation students can understand

Now generate a phonics blending activity for "${topic}" at grade level ${gradeLevelKey}. Ensure all phoneme letters concatenate exactly to the target word.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: `You are an expert K-2 reading specialist and phonics instructor. You create engaging, developmentally appropriate phonics blending activities that teach students to decode words sound by sound. You understand phonemic awareness deeply — you know which letter combinations form single phonemes (digraphs, diphthongs, r-controlled vowels) vs. separate sounds. You always ensure phoneme breakdowns are linguistically accurate and that the concatenation of letter mappings exactly spells the target word. You choose words that are concrete, picturable, and motivating for young learners.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as PhonicsBlenderData;

    // Merge with any config overrides (exclude targetEvalMode from spread)
    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;
    const finalData: PhonicsBlenderData = {
      ...result,
      ...configRest,
    };

    // ── Post-process: inject patternType if Gemini dropped it ──────────
    // Must run AFTER config merge since configRest may contain patternType: undefined
    if (!finalData.patternType) {
      finalData.patternType = (evalConstraint?.allowedTypes[0]
        ?? config?.patternType
        ?? defaultPatternType) as PhonicsBlenderData['patternType'];
    }

    console.log('Phonics Blender Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      patternType: finalData.patternType,
      wordCount: finalData.words?.length || 0,
      words: finalData.words?.map(w => w.targetWord) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating phonics blender:", error);
    throw error;
  }
};
