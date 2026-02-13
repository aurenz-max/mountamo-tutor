import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { PhonicsBlenderData } from "../../primitives/visual-primitives/literacy/PhonicsBlender";
import { generateTTSAudio } from "../tts/ttsService";

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
                  description: "The letter(s) this phoneme maps to in the word (e.g., 'c', 'a', 't', 'sh', 'a_e')"
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

// TTS generation handled by ttsService using Gemini

/**
 * Generate phonics blender data using Gemini AI
 *
 * Creates interactive sound-by-sound word building activities that scale
 * from Kindergarten CVC words through Grade 2 multisyllabic blending.
 *
 * The blender follows a 3-phase learning progression per word:
 * - Listen: Hear each phoneme sound individually
 * - Build: Arrange phoneme tiles in the correct order
 * - Blend: Hear the blended word and see a reward image
 *
 * @param topic - Theme for the word set (e.g., "Animals", "Food", "At the Park")
 * @param gradeLevel - Grade level ('K', '1', or '2') determines pattern complexity
 * @param config - Optional partial configuration to override generated values
 * @returns PhonicsBlenderData with grade-appropriate words and phoneme breakdowns
 */
export const generatePhonicsBlender = async (
  topic: string,
  gradeLevel: string = 'K',
  config?: Partial<PhonicsBlenderData>
): Promise<PhonicsBlenderData> => {

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
  - Show the split vowel digraph: /k/ /ā/ /k/ for "cake" (long vowel sound)
  - The silent-e is part of the vowel phoneme, not a separate sound
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

  const generationPrompt = `Create a phonics blending activity for the topic: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['K']}

REQUIRED INFORMATION:

1. **Title**: Fun, engaging title for the activity that includes the topic

2. **Grade Level**: "${gradeLevelKey}"

3. **Pattern Type**: "${config?.patternType || defaultPatternType}"

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
   - Digraphs (sh, ch, th, wh) are SINGLE phonemes with 2-letter "letters" field
   - R-controlled vowels (ar, er, ir, or, ur) are SINGLE phonemes
   - Diphthongs (oi, oy, ou, ow) are SINGLE phonemes
   - Silent-e in CVCE words: the vowel phoneme should use the long sound, and "e" is part of it
     - For "cake": phonemes are /k/ (letters: "c"), /ā/ (letters: "a"), /k/ (letters: "k"), with silent "e" appended to the last consonant's letters OR handled as: c + a_e + k where a_e = long a
     - SIMPLER APPROACH: Just include the silent-e as its own phoneme with sound "//" and letters "e"
   - Each phoneme ID must be unique within the word (use pattern: w1_p1, w1_p2)
   - Phoneme sounds should use simple notation students can understand

EXAMPLE OUTPUT FOR KINDERGARTEN (CVC):
{
  "title": "Animal Sound Blending",
  "gradeLevel": "K",
  "patternType": "cvc",
  "words": [
    {
      "id": "w1",
      "targetWord": "cat",
      "phonemes": [
        { "id": "w1_p1", "sound": "/k/", "letters": "c" },
        { "id": "w1_p2", "sound": "/a/", "letters": "a" },
        { "id": "w1_p3", "sound": "/t/", "letters": "t" }
      ],
      "imageDescription": "a fluffy orange cat sitting"
    },
    {
      "id": "w2",
      "targetWord": "dog",
      "phonemes": [
        { "id": "w2_p1", "sound": "/d/", "letters": "d" },
        { "id": "w2_p2", "sound": "/o/", "letters": "o" },
        { "id": "w2_p3", "sound": "/g/", "letters": "g" }
      ],
      "imageDescription": "a happy brown dog wagging its tail"
    }
  ]
}

EXAMPLE OUTPUT FOR GRADE 1 (DIGRAPH):
{
  "title": "Digraph Sound Blending",
  "gradeLevel": "1",
  "patternType": "digraph",
  "words": [
    {
      "id": "w1",
      "targetWord": "ship",
      "phonemes": [
        { "id": "w1_p1", "sound": "/sh/", "letters": "sh" },
        { "id": "w1_p2", "sound": "/i/", "letters": "i" },
        { "id": "w1_p3", "sound": "/p/", "letters": "p" }
      ],
      "imageDescription": "a big ship sailing on the ocean"
    }
  ]
}

Now generate a phonics blending activity for "${topic}" at grade level ${gradeLevelKey}. Ensure all phoneme letters concatenate exactly to the target word.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: phonicsBlenderSchema,
        systemInstruction: `You are an expert K-2 reading specialist and phonics instructor. You create engaging, developmentally appropriate phonics blending activities that teach students to decode words sound by sound. You understand phonemic awareness deeply — you know which letter combinations form single phonemes (digraphs, diphthongs, r-controlled vowels) vs. separate sounds. You always ensure phoneme breakdowns are linguistically accurate and that the concatenation of letter mappings exactly spells the target word. You choose words that are concrete, picturable, and motivating for young learners.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as PhonicsBlenderData;

    // Step 2: Generate TTS audio for each phoneme and each blended word
    console.log('Generating TTS audio for phonemes and words...');
    const wordsWithAudio = await Promise.all(
      result.words.map(async (word) => {
        // Generate audio for each phoneme
        const phonemesWithAudio = await Promise.all(
          word.phonemes.map(async (phoneme) => {
            // For phoneme sounds, we'll pronounce just the sound
            // Remove slashes from sound notation for TTS (e.g., "/k/" -> "kuh" or just the sound)
            const soundText = phoneme.sound.replace(/\//g, '').trim();
            console.log(`Generating TTS for phoneme: ${phoneme.sound} (${soundText})`);
            const audioBase64 = await generateTTSAudio(soundText);

            return {
              ...phoneme,
              audioBase64: audioBase64 || undefined,
            };
          })
        );

        // Generate audio for the blended word
        console.log(`Generating TTS for word: ${word.targetWord}`);
        const wordAudioBase64 = await generateTTSAudio(word.targetWord);

        return {
          ...word,
          phonemes: phonemesWithAudio,
          audioBase64: wordAudioBase64 || undefined,
        };
      })
    );

    // Merge with any config overrides
    const finalData: PhonicsBlenderData = {
      ...result,
      words: wordsWithAudio,
      ...config,
    };

    console.log('Phonics Blender Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      patternType: finalData.patternType,
      wordCount: finalData.words?.length || 0,
      words: finalData.words?.map(w => w.targetWord) || [],
      phonemesWithAudio: finalData.words?.reduce((sum, w) => sum + w.phonemes.filter(p => p.audioBase64).length, 0),
      wordsWithAudio: finalData.words?.filter(w => w.audioBase64).length,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating phonics blender:", error);
    throw error;
  }
};
