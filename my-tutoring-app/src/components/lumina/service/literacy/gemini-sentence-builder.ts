import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { SentenceBuilderData } from "../../primitives/visual-primitives/literacy/SentenceBuilder";

/**
 * Schema definition for Sentence Builder Data
 *
 * This schema defines the structure for interactive sentence construction,
 * designed for grades 1-6 literacy instruction. Students build grammatically
 * correct sentences from word/phrase tiles, learning parts of speech and
 * sentence structure through progressive difficulty phases.
 */
const sentenceBuilderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the sentence building activity (e.g., 'Building Simple Sentences')"
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Target grade level (e.g., '1', '2', '3', '4', '5', '6')"
    },
    sentenceType: {
      type: Type.STRING,
      enum: ["simple", "compound", "complex", "compound-complex"],
      description: "Type of sentences students will build"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique identifier for this challenge (e.g., 'ch1', 'ch2')"
          },
          targetMeaning: {
            type: Type.STRING,
            description: "Clear description of what the sentence should express (e.g., 'A dog is running fast')"
          },
          tiles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description: "Unique tile identifier (e.g., 't1', 't2')"
                },
                text: {
                  type: Type.STRING,
                  description: "The word or phrase on the tile"
                },
                role: {
                  type: Type.STRING,
                  enum: ["subject", "predicate", "object", "modifier", "conjunction", "punctuation"],
                  description: "Grammatical role of this tile"
                }
              },
              required: ["id", "text", "role"]
            },
            description: "Array of word/phrase tiles that can be arranged into sentences"
          },
          validArrangements: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            },
            description: "Array of valid tile ID orderings. Each sub-array is one valid arrangement of tile IDs."
          },
          hint: {
            type: Type.STRING,
            description: "Optional hint to help students (e.g., 'Start with the subject - who or what is doing something?')"
          }
        },
        required: ["id", "targetMeaning", "tiles", "validArrangements"]
      },
      description: "Array of 3-4 sentence-building challenges"
    },
    roleColors: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        predicate: { type: Type.STRING },
        object: { type: Type.STRING },
        modifier: { type: Type.STRING },
        conjunction: { type: Type.STRING },
        punctuation: { type: Type.STRING }
      },
      description: "Color labels for each grammatical role (e.g., subject: 'blue')"
    }
  },
  required: ["title", "gradeLevel", "sentenceType", "challenges", "roleColors"]
};

/**
 * Generate sentence builder data using Gemini AI
 *
 * Creates interactive sentence construction activities that scale from
 * grade 1 (simple S+V, 3-4 tiles) through grade 6 (compound-complex, 8-10 tiles).
 *
 * The builder follows a 3-phase learning progression:
 * - Explore: Fill in one missing part of a complete sentence
 * - Practice: Build sentences from a tile bank to match a target meaning
 * - Apply: Build original sentences with the same structure
 *
 * @param topic - Sentence building topic or theme (e.g., "Animals at the Zoo", "Weather")
 * @param gradeLevel - Grade level ('1' through '6') determines complexity
 * @param config - Optional partial configuration to override generated values
 * @returns SentenceBuilderData with grade-appropriate sentence challenges
 */
export const generateSentenceBuilder = async (
  topic: string,
  gradeLevel: string = '2',
  config?: Partial<SentenceBuilderData>
): Promise<SentenceBuilderData> => {

  // Grade-specific complexity guidelines
  const gradeContext: Record<string, string> = {
    '1': `
GRADE 1 GUIDELINES:
- Sentence type: simple (S + V pattern)
- 3-4 tiles per challenge (e.g., "The dog" + "runs" + ".")
- Use high-frequency sight words and CVC words students know
- Tiles should be whole phrases for subject (e.g., "The cat") rather than individual words
- Focus on basic SVO pattern: subject phrase + action verb + punctuation
- Use familiar, concrete nouns: dog, cat, boy, girl, mom, dad
- Use simple present-tense verbs: runs, jumps, eats, sits, plays
- Always include a period tile as punctuation
- Sentences should be 3-5 words total
- 3 challenges per session
- Example: tiles = ["The dog", "runs", "."] -> valid arrangement: [t1, t2, t3]
`,
    '2': `
GRADE 2 GUIDELINES:
- Sentence type: simple (S + V + O pattern)
- 4-5 tiles per challenge
- Introduce separate subject and predicate tiles
- Add object tiles: "The dog" + "chases" + "the cat" + "."
- Use grade-appropriate vocabulary
- Include modifier tiles for some challenges (adjectives): "The big dog" or "quickly"
- Sentences should be 4-7 words total
- 3-4 challenges per session
- Example: tiles = ["The boy", "kicks", "the ball", "."] -> valid: [t1, t2, t3, t4]
`,
    '3': `
GRADE 3 GUIDELINES:
- Sentence type: compound (two clauses joined by conjunction)
- 6-7 tiles per challenge
- Introduce conjunction tiles: "and", "but", "so", "or"
- Two simple clauses connected by a conjunction
- Example: "The cat sat" + "on the mat" + "," + "and" + "the dog" + "ran outside" + "."
- Sentences should be 8-12 words total
- 3-4 challenges per session
- Include comma tiles where appropriate
- Roles: subject, predicate, object, conjunction, punctuation
`,
    '4': `
GRADE 4 GUIDELINES:
- Sentence type: complex (independent + dependent clause)
- 7-8 tiles per challenge
- Introduce subordinating conjunctions: "because", "when", "while", "although", "if"
- Include dependent clause tiles and independent clause tiles
- Example: "Because it was raining" + "," + "the children" + "played" + "inside" + "."
- Sentences should be 10-15 words total
- 3-4 challenges per session
- Modifier tiles for adverbs and adjective phrases
`,
    '5': `
GRADE 5 GUIDELINES:
- Sentence type: compound-complex
- 8-10 tiles per challenge
- Combine compound structure (conjunction) with complex structure (subordinate clause)
- Example: "Although the storm was fierce" + "," + "the sailors" + "held on" + "," + "and" + "the ship" + "survived" + "."
- Sentences should be 12-18 words total
- 3-4 challenges per session
- Rich vocabulary appropriate for grade 5 reading level
`,
    '6': `
GRADE 6 GUIDELINES:
- Sentence type: compound-complex
- 8-10 tiles per challenge
- Complex sentence structures with multiple clauses
- Use sophisticated vocabulary and varied sentence patterns
- Include appositives, participial phrases, and relative clauses as tiles
- Example: "When the experiment began" + "," + "the students" + "observed carefully" + "," + "and" + "they recorded" + "their findings" + "in notebooks" + "."
- Sentences should be 14-20 words total
- 3-4 challenges per session
- Academic language appropriate for grade 6
`
  };

  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '2';
  const sentenceTypeForGrade = gradeLevelKey <= '2' ? 'simple' : gradeLevelKey === '3' ? 'compound' : gradeLevelKey === '4' ? 'complex' : 'compound-complex';

  const generationPrompt = `Create an interactive sentence builder activity for: "${topic}".

TARGET GRADE LEVEL: ${gradeLevelKey}

${gradeContext[gradeLevelKey] || gradeContext['2']}

REQUIRED INFORMATION:

1. **Title**: An engaging, kid-friendly title for the activity

2. **Grade Level**: "${gradeLevelKey}"

3. **Sentence Type**: "${sentenceTypeForGrade}"

4. **Challenges** (3-4 challenges):
   For EACH challenge provide:
   - id: Unique identifier (ch1, ch2, ch3, etc.)
   - targetMeaning: A clear description of what the completed sentence should express
   - tiles: Array of word/phrase tiles, EACH with:
     - id: Unique tile identifier (t1, t2, t3, etc.) - use UNIQUE ids across ALL challenges (e.g., ch1_t1, ch1_t2 for challenge 1)
     - text: The word or phrase on the tile
     - role: One of: subject, predicate, object, modifier, conjunction, punctuation
   - validArrangements: Array of valid tile ID orderings (at least 1 valid arrangement per challenge)
   - hint: Optional hint to help the student

   CRITICAL TILE RULES:
   - Tile IDs must be unique WITHIN each challenge (use pattern: ch1_t1, ch1_t2, etc.)
   - Every tile in the challenge MUST appear exactly once in each valid arrangement
   - Valid arrangements must produce grammatically correct, meaningful sentences
   - Include punctuation tiles (period, comma, exclamation mark) as separate tiles
   - For grades 1-2: group words into phrase tiles (e.g., "The big dog" as one subject tile)
   - For grades 3+: can have more granular tiles but keep phrases that naturally group together
   - ALWAYS provide at least one valid arrangement per challenge

   ROLE ASSIGNMENT RULES:
   - subject: The noun phrase performing the action (e.g., "The cat", "My friend")
   - predicate: The verb or verb phrase (e.g., "runs", "is eating", "chased")
   - object: The noun phrase receiving the action (e.g., "the ball", "a sandwich")
   - modifier: Adjectives, adverbs, or prepositional phrases (e.g., "quickly", "in the park")
   - conjunction: Coordinating or subordinating conjunctions (e.g., "and", "because", "but")
   - punctuation: Period, comma, exclamation mark, question mark

5. **Role Colors**: Always provide this exact mapping:
   {
     "subject": "blue",
     "predicate": "red",
     "object": "green",
     "modifier": "yellow",
     "conjunction": "purple",
     "punctuation": "gray"
   }

EXAMPLE OUTPUT FOR GRADE 2:

{
  "title": "Animal Action Sentences",
  "gradeLevel": "2",
  "sentenceType": "simple",
  "challenges": [
    {
      "id": "ch1",
      "targetMeaning": "A cat is chasing a mouse",
      "tiles": [
        { "id": "ch1_t1", "text": "The cat", "role": "subject" },
        { "id": "ch1_t2", "text": "chases", "role": "predicate" },
        { "id": "ch1_t3", "text": "the mouse", "role": "object" },
        { "id": "ch1_t4", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [["ch1_t1", "ch1_t2", "ch1_t3", "ch1_t4"]],
      "hint": "Who is doing the action? Start with the subject!"
    },
    {
      "id": "ch2",
      "targetMeaning": "A bird is flying in the sky",
      "tiles": [
        { "id": "ch2_t1", "text": "The bird", "role": "subject" },
        { "id": "ch2_t2", "text": "flies", "role": "predicate" },
        { "id": "ch2_t3", "text": "in the sky", "role": "modifier" },
        { "id": "ch2_t4", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [["ch2_t1", "ch2_t2", "ch2_t3", "ch2_t4"]],
      "hint": "Think about what the bird is doing and where."
    },
    {
      "id": "ch3",
      "targetMeaning": "A fish swims quickly through the water",
      "tiles": [
        { "id": "ch3_t1", "text": "The fish", "role": "subject" },
        { "id": "ch3_t2", "text": "swims", "role": "predicate" },
        { "id": "ch3_t3", "text": "quickly", "role": "modifier" },
        { "id": "ch3_t4", "text": "through the water", "role": "modifier" },
        { "id": "ch3_t5", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [
        ["ch3_t1", "ch3_t2", "ch3_t3", "ch3_t4", "ch3_t5"],
        ["ch3_t1", "ch3_t3", "ch3_t2", "ch3_t4", "ch3_t5"]
      ],
      "hint": "The fish is the subject. What does it do?"
    }
  ],
  "roleColors": {
    "subject": "blue",
    "predicate": "red",
    "object": "green",
    "modifier": "yellow",
    "conjunction": "purple",
    "punctuation": "gray"
  }
}

EXAMPLE OUTPUT FOR GRADE 4 (Complex):

{
  "title": "Weather and Seasons Sentences",
  "gradeLevel": "4",
  "sentenceType": "complex",
  "challenges": [
    {
      "id": "ch1",
      "targetMeaning": "Because it was raining, the children stayed inside",
      "tiles": [
        { "id": "ch1_t1", "text": "Because", "role": "conjunction" },
        { "id": "ch1_t2", "text": "it was raining", "role": "predicate" },
        { "id": "ch1_t3", "text": ",", "role": "punctuation" },
        { "id": "ch1_t4", "text": "the children", "role": "subject" },
        { "id": "ch1_t5", "text": "stayed", "role": "predicate" },
        { "id": "ch1_t6", "text": "inside", "role": "modifier" },
        { "id": "ch1_t7", "text": ".", "role": "punctuation" }
      ],
      "validArrangements": [
        ["ch1_t1", "ch1_t2", "ch1_t3", "ch1_t4", "ch1_t5", "ch1_t6", "ch1_t7"],
        ["ch1_t4", "ch1_t5", "ch1_t6", "ch1_t1", "ch1_t2", "ch1_t7"]
      ],
      "hint": "A complex sentence has a dependent clause (starts with 'because', 'when', etc.) and an independent clause."
    }
  ],
  "roleColors": {
    "subject": "blue",
    "predicate": "red",
    "object": "green",
    "modifier": "yellow",
    "conjunction": "purple",
    "punctuation": "gray"
  }
}

Now generate a sentence builder activity for "${topic}" at grade level ${gradeLevelKey}. Make sure every tile ID is unique within its challenge and every valid arrangement uses ALL tile IDs from that challenge exactly once.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sentenceBuilderSchema,
        systemInstruction: `You are an expert K-6 English Language Arts educator specializing in grammar instruction and sentence construction. You create engaging, age-appropriate sentence building activities that teach students about parts of speech, sentence structure, and grammatical patterns. You understand developmental progression from simple subject-verb sentences in grade 1 through compound-complex structures in grade 6. You make grammar fun and accessible, using topics and vocabulary that excite young learners. You always ensure grammatical accuracy and provide clear, helpful hints.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as SentenceBuilderData;

    // Merge with any config overrides
    const finalData: SentenceBuilderData = {
      ...result,
      ...config,
    };

    console.log('Sentence Builder Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      sentenceType: finalData.sentenceType,
      challengeCount: finalData.challenges?.length || 0,
      tilesPerChallenge: finalData.challenges?.map(ch => ch.tiles.length) || [],
    });

    return finalData;

  } catch (error) {
    console.error("Error generating sentence builder:", error);
    throw error;
  }
};
