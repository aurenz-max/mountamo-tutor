/**
 * Word Builder Generator - Dedicated service for morphology/vocabulary exercises
 *
 * Extracted from geminiService.ts as part of the registry refactoring.
 * This reduces context window requirements when adding new primitives.
 */

import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

export interface WordPart {
  id: string;
  text: string;
  type: 'prefix' | 'root' | 'suffix';
  meaning: string;
}

export interface TargetWord {
  word: string;
  parts: string[]; // Array of part IDs in order
  definition: string;
  sentenceContext: string;
}

export interface WordBuilderData {
  title: string;
  availableParts: WordPart[];
  targets: TargetWord[];
}

/**
 * Generate Word Builder content
 *
 * Creates a morphology exercise where students build words from prefixes,
 * roots, and suffixes to understand word construction patterns.
 *
 * @param topic - The topic/subject area for vocabulary
 * @param gradeContext - Educational context for the target audience
 * @param config - Optional configuration including intent
 * @returns Word builder data with parts and target words
 */
export const generateWordBuilder = async (
  topic: string,
  gradeContext: string,
  config?: {
    intent?: string;
  }
): Promise<WordBuilderData> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Engaging title for the word-building exercise (e.g., 'Constructing Scientific Terms')" },
      availableParts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique identifier like 'pre-bio', 'root-log', 'suf-y'" },
            text: { type: Type.STRING, description: "The actual word part (e.g., 'bio', 'log', 'y')" },
            type: { type: Type.STRING, enum: ['prefix', 'root', 'suffix'], description: "Type of word part" },
            meaning: { type: Type.STRING, description: "What this part means (e.g., 'Life' for 'bio')" }
          },
          required: ["id", "text", "type", "meaning"]
        },
        description: "Pool of 8-12 word parts students can use. Include variety of prefixes, roots, and suffixes."
      },
      targets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The complete word to build (e.g., 'biology')" },
            parts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of part IDs in order [prefix, root, suffix]. Some positions can be omitted if word doesn't have that part."
            },
            definition: { type: Type.STRING, description: "Clear definition of the word" },
            sentenceContext: { type: Type.STRING, description: "Example sentence using the word in context" }
          },
          required: ["word", "parts", "definition", "sentenceContext"]
        },
        description: "2-4 target words to build. Ensure parts needed are in availableParts array."
      }
    },
    required: ["title", "availableParts", "targets"]
  };

  const prompt = `Create a word-building morphology exercise for: "${topic}"

TARGET AUDIENCE: ${gradeContext}
INTENT: ${config?.intent || 'Teach vocabulary through word construction'}

## Design Principles

1. **Educational Value**: Choose words that genuinely illustrate morphological patterns
   - Words should be relevant to the topic/subject area
   - Parts should have clear, teachable meanings
   - Focus on common, useful word parts students will encounter again

2. **Available Parts Pool (8-12 parts)**:
   - Include 2-4 prefixes (e.g., bio-, geo-, tele-, micro-, pre-, un-)
   - Include 3-5 roots (e.g., -log-, -graph-, -meter-, -scope-)
   - Include 2-4 suffixes (e.g., -y, -ic, -er, -tion, -ous)
   - Ensure all parts needed for target words are in the pool
   - Include some extra parts that aren't used (adds challenge)

3. **Target Words (2-4 words)**:
   - Start with simpler 2-part words, progress to 3-part words
   - Each word should clearly demonstrate its meaning through its parts
   - Provide clear, age-appropriate definitions
   - Include authentic sentence contexts showing usage

4. **Part ID Format**:
   - Use descriptive IDs: "pre-bio", "root-log", "suf-y"
   - This helps with debugging and understanding

5. **Meaning Quality**:
   - Keep meanings concise (1-3 words)
   - Use accessible language appropriate for grade level
   - Examples: "Life", "Study", "State of", "Against", "Write"

## Subject-Specific Guidance

**Science/Biology**: Use Greek/Latin roots common in scientific vocabulary
- bio (life), geo (earth), hydro (water), thermo (heat), photo (light)
- -logy (study), -meter (measure), -scope (view), -graph (write/record)

**Medical/Health**: Focus on body parts and processes
- cardio (heart), neuro (nerve), derm (skin), gastro (stomach)
- -ology (study), -itis (inflammation), -pathy (disease)

**General Academic**: Mix of common prefixes and roots
- pre- (before), re- (again), un- (not), dis- (opposite)
- -tion (action), -ment (result), -able (capable of)

Generate an engaging word-building exercise that helps students understand how words are constructed from meaningful parts.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  if (!response.text) throw new Error("No content generated");
  const data = JSON.parse(response.text);

  console.log('🔤 Word Builder Generated from dedicated service:', {
    topic,
    title: data.title,
    partCount: data.availableParts?.length || 0,
    targetCount: data.targets?.length || 0
  });

  return data as WordBuilderData;
};
