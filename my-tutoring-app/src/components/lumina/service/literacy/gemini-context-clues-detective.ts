import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { ContextCluesDetectiveData } from "../../primitives/visual-primitives/literacy/ContextCluesDetective";

/**
 * Schema definition for Context Clues Detective Data
 *
 * Generates vocabulary-in-context activities where students encounter
 * unfamiliar words in passages and determine meaning using context clues.
 * Teaches clue types: definition, synonym, antonym, example, inference.
 */
const contextCluesDetectiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the context clues activity"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level ('2' through '6')"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge identifier (e.g., 'ch1', 'ch2')"
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
                      description: "Unique sentence ID (e.g., 'ch1_s1')"
                    },
                    text: {
                      type: Type.STRING,
                      description: "The sentence text"
                    },
                    isClue: {
                      type: Type.BOOLEAN,
                      description: "Whether this sentence contains a context clue for the target word"
                    }
                  },
                  required: ["id", "text", "isClue"]
                }
              }
            },
            required: ["sentences"]
          },
          targetWord: {
            type: Type.STRING,
            description: "The unfamiliar/challenging word students must define"
          },
          targetWordSentenceId: {
            type: Type.STRING,
            description: "ID of the sentence that contains the target word"
          },
          clueType: {
            type: Type.STRING,
            enum: ["definition", "synonym", "antonym", "example", "inference"],
            description: "The type of context clue present in the passage"
          },
          clueSentenceIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "IDs of sentences that contain context clues"
          },
          correctMeaning: {
            type: Type.STRING,
            description: "The correct meaning/definition of the target word"
          },
          meaningOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Multiple-choice meaning options (4 options, one correct)"
          },
          acceptableMeanings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Alternative acceptable meanings"
          },
          dictionaryDefinition: {
            type: Type.STRING,
            description: "Standard dictionary definition for comparison"
          }
        },
        required: [
          "id", "passage", "targetWord", "targetWordSentenceId",
          "clueType", "clueSentenceIds", "correctMeaning",
          "meaningOptions", "dictionaryDefinition"
        ]
      },
      description: "Array of 3-4 word challenges"
    }
  },
  required: ["title", "gradeLevel", "challenges"]
};

/**
 * Generate context clues detective data using Gemini AI
 *
 * Creates vocabulary-in-context activities that teach students to determine
 * word meaning from surrounding text. Scales from simple definition clues
 * (grade 2) through inference and connotation (grade 6).
 *
 * @param topic - Theme for the passages (e.g., "Ocean Animals", "Space Exploration")
 * @param gradeLevel - Grade level ('2' through '6') determines word difficulty and clue types
 * @param config - Optional partial configuration to override generated values
 * @returns ContextCluesDetectiveData with passages, target words, and clue information
 */
export const generateContextCluesDetective = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<ContextCluesDetectiveData>
): Promise<ContextCluesDetectiveData> => {

  const gradeContext: Record<string, string> = {
    '2': `
GRADE 2 GUIDELINES:
- 3 challenges, each with 3-4 sentence passages
- Target words: slightly above grade level but deducible from context
- Clue types: ONLY "definition" and "example" clues (simplest types)
- Definition clue: the word is directly explained in the text ("A habitat, which is a place where an animal lives, ...")
- Example clue: examples clarify the word ("Reptiles, such as snakes, lizards, and turtles, ...")
- Meaning options: 4 choices, one correct, distractors are plausible but clearly wrong
- Simple, short sentences. Concrete nouns and verbs.
- Pattern: "The word ___ means ___ because the sentence says ___"
`,
    '3': `
GRADE 3 GUIDELINES:
- 3-4 challenges, each with 4-5 sentence passages
- Target words: grade 3 vocabulary (e.g., "enormous", "ancient", "fragile")
- Clue types: "definition", "example", and "synonym" clues
- Synonym clue: a similar word appears nearby ("The enormous, or very large, dinosaur...")
- Include one definition and one synonym clue minimum
- Meaning options: 4 choices
- Clue sentence should be near the target word sentence
`,
    '4': `
GRADE 4 GUIDELINES:
- 3-4 challenges, each with 5-6 sentence passages
- Target words: grade 4 academic vocabulary (e.g., "persevere", "abundant", "treacherous")
- Clue types: all five types - "definition", "synonym", "antonym", "example", "inference"
- Antonym clue: an opposite word creates contrast ("Unlike the barren desert, the rainforest was lush...")
- Include at least one antonym clue
- Multiple clues may support the same word (list multiple clueSentenceIds)
- Meaning options: 4 choices with closer distractors
`,
    '5': `
GRADE 5 GUIDELINES:
- 3-4 challenges, each with 5-7 sentence passages
- Target words: grade 5 vocabulary, including words with Greek/Latin roots
- Clue types: emphasis on "inference" and "antonym" (harder types)
- Inference clue: meaning must be inferred from broader context, not directly stated
- Include root connection hints where relevant
- Meaning options: 4 choices with subtle distinctions
- Passages should be more complex with compound sentences
`,
    '6': `
GRADE 6 GUIDELINES:
- 3-4 challenges, each with 6-8 sentence passages
- Target words: grade 6 academic and literary vocabulary (e.g., "ominous", "benevolent", "pragmatic")
- Clue types: all types, emphasis on "inference" and connotation vs denotation
- Include words with multiple meanings where context resolves the correct one
- Technical vocabulary in context (scientific, historical terms)
- Meaning options: 4 choices with nuanced distinctions
- More sophisticated passages with varied sentence structure
`
  };

  const gradeLevelKey = ['2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

  const generationPrompt = `Create a context clues detective activity about: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['3']}

REQUIRED INFORMATION:

1. **Title**: Engaging detective-themed title

2. **Grade Level**: "${gradeLevelKey}"

3. **Challenges** (3-4 challenges):
   For EACH challenge provide:
   - id: Unique ID (ch1, ch2, etc.)
   - passage: Object with sentences array. Each sentence has:
     - id: Unique sentence ID (ch1_s1, ch1_s2, etc.)
     - text: The sentence text
     - isClue: true if this sentence contains a context clue for the target word
   - targetWord: The unfamiliar word to investigate
   - targetWordSentenceId: ID of the sentence containing the target word
   - clueType: One of "definition", "synonym", "antonym", "example", "inference"
   - clueSentenceIds: Array of sentence IDs containing context clues
   - correctMeaning: The word's meaning as derivable from context
   - meaningOptions: 4 multiple-choice options (correctMeaning must be one of them)
   - acceptableMeanings: Other acceptable phrasings of the meaning
   - dictionaryDefinition: Standard dictionary-style definition

   CRITICAL RULES:
   - The target word MUST appear in the sentence identified by targetWordSentenceId
   - The clue sentence(s) MUST genuinely help determine the word's meaning
   - The clue type MUST match the actual clue strategy used in the passage
   - Non-clue sentences should be topically relevant but NOT help define the target word
   - The correctMeaning MUST be one of the meaningOptions exactly
   - Distractors should be plausible (related to the topic) but clearly wrong in context
   - Each challenge should use a DIFFERENT target word
   - Vary the clue types across challenges

EXAMPLE FOR GRADE 3:
{
  "title": "Word Detective: Ocean Secrets",
  "gradeLevel": "3",
  "challenges": [
    {
      "id": "ch1",
      "passage": {
        "sentences": [
          { "id": "ch1_s1", "text": "The ocean is home to many creatures.", "isClue": false },
          { "id": "ch1_s2", "text": "Some fish are enormous, meaning they are very, very large.", "isClue": true },
          { "id": "ch1_s3", "text": "Whale sharks can grow to be 40 feet long.", "isClue": true },
          { "id": "ch1_s4", "text": "Divers love to swim near these gentle animals.", "isClue": false }
        ]
      },
      "targetWord": "enormous",
      "targetWordSentenceId": "ch1_s2",
      "clueType": "definition",
      "clueSentenceIds": ["ch1_s2", "ch1_s3"],
      "correctMeaning": "Very large in size",
      "meaningOptions": ["Very large in size", "Very fast", "Very colorful", "Very dangerous"],
      "acceptableMeanings": ["really big", "huge", "extremely large"],
      "dictionaryDefinition": "Extremely large in size, extent, or amount."
    }
  ]
}

Now generate a context clues detective activity about "${topic}" at grade level ${gradeLevelKey}. Ensure clue types match the actual strategies used and target words appear in their designated sentences.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: contextCluesDetectiveSchema,
        systemInstruction: `You are an expert K-6 vocabulary and reading comprehension specialist. You create context clues activities that teach students to determine word meaning from surrounding text. You understand the five context clue types deeply: definition (word is explained in text), synonym (similar word nearby), antonym (opposite word creates contrast), example (examples clarify meaning), and inference (meaning deduced from broader context). You choose age-appropriate target vocabulary that challenges students at their grade level while remaining deducible from well-crafted context. Your passages are engaging, topically coherent, and pedagogically sound.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as ContextCluesDetectiveData;

    const finalData: ContextCluesDetectiveData = {
      ...result,
      ...config,
    };

    console.log('Context Clues Detective Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      challengeCount: finalData.challenges?.length || 0,
      targetWords: finalData.challenges?.map(ch => ch.targetWord) || [],
      clueTypes: finalData.challenges?.map(ch => ch.clueType) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating context clues detective:", error);
    throw error;
  }
};
