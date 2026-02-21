import { Type, Schema } from "@google/genai";
import { NumberSequencerData } from "../../primitives/visual-primitives/math/NumberSequencer";
import { ai } from "../geminiClient";

/**
 * Schema definition for Number Sequencer Data
 *
 * This schema defines the structure for number sequencing activities,
 * including fill-missing, before-after, order-cards, count-from,
 * and decade-fill challenges for K-1 sequential number understanding.
 */
const numberSequencerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the sequencing activity (e.g., 'What Comes Next?', 'Fill in the Missing Numbers!')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'seq1', 'seq2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'fill-missing' (fill blanks in a sequence), 'before-after' (what comes before/after a number), 'order-cards' (sort shuffled numbers), 'count-from' (continue counting from a start), 'decade-fill' (fill missing decade numbers like 10, 20, 30)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging (e.g., 'Can you fill in the missing number?')"
          },
          sequence: {
            type: Type.ARRAY,
            items: {
              type: Type.NUMBER,
              nullable: true,
              description: "A number in the sequence, or null for a blank the student must fill"
            },
            description: "The number sequence with nulls representing blanks. For order-cards: all numbers present but shuffled."
          },
          correctAnswers: {
            type: Type.ARRAY,
            items: {
              type: Type.NUMBER
            },
            description: "The correct answers. For fill-missing/before-after/decade-fill: the numbers that go in the blanks. For order-cards: the correctly sorted sequence. For count-from: the expected continuation numbers."
          },
          startNumber: {
            type: Type.NUMBER,
            description: "For count-from challenges: the number to start counting from"
          },
          direction: {
            type: Type.STRING,
            description: "For count-from challenges: 'forward' or 'backward'"
          },
          rangeMin: {
            type: Type.NUMBER,
            description: "Minimum number in the range for this challenge"
          },
          rangeMax: {
            type: Type.NUMBER,
            description: "Maximum number in the range for this challenge"
          }
        },
        required: ["id", "type", "instruction", "sequence", "correctAnswers", "rangeMin", "rangeMax"]
      },
      description: "Array of 4-6 progressive challenges across different types"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1' for Grade 1"
    },
    showNumberLine: {
      type: Type.BOOLEAN,
      description: "Whether to show a number line visual aid alongside the sequence"
    },
    showDotArrays: {
      type: Type.BOOLEAN,
      description: "Whether to show dot array representations for each number"
    }
  },
  required: ["title", "description", "challenges", "gradeBand", "showNumberLine", "showDotArrays"]
};

/**
 * Generate number sequencer data for interactive sequencing activities
 *
 * Grade-aware content:
 * - Kindergarten (K): Numbers 1-20, simple fill-missing, before/after, basic ordering
 * - Grade 1: Numbers 1-100, decade-fill, backward counting, longer sequences
 *
 * Challenge types:
 * - fill-missing: Sequence with 1-3 nulls as blanks (e.g., [1, 2, null, 4, 5])
 * - before-after: Two-element sequence with one null (e.g., [null, 8] or [5, null])
 * - order-cards: Shuffled numbers, correctAnswers is sorted order
 * - count-from: Start number + direction, correctAnswers is continuation
 * - decade-fill: Decade sequence with nulls (e.g., [10, null, 30, null, 50])
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns NumberSequencerData with complete configuration
 */
export const generateNumberSequencer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{
    difficulty: number;
    challengeCount: number;
    gradeBand: 'K' | '1';
  }>
): Promise<NumberSequencerData> => {
  const gradeBand = config?.gradeBand || (gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1');
  const challengeCount = config?.challengeCount || 5;
  const difficulty = config?.difficulty || 1;

  const prompt = `
Create an educational number sequencing activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A number sequencer helps students build sequential number understanding
- Students practice recognizing number order, finding missing numbers, and counting forward/backward
- Key skills: number sequence, before/after, counting on/back, number ordering, decade patterns

GUIDELINES FOR GRADE LEVELS:
- Kindergarten (gradeBand "K"):
  * Numbers range from 1-20
  * Simple sequences with 1 blank to fill
  * Before/after with small numbers (1-10 early, up to 20 later)
  * Order 3-4 cards with small numbers
  * Count forward only (no backward for early K)
  * Warm, playful language ("What number is hiding?")
  * showDotArrays: true (helps with number recognition)
  * showNumberLine: true (visual support)

- Grade 1 (gradeBand "1"):
  * Numbers range from 1-100
  * Sequences with 2-3 blanks
  * Before/after with larger numbers
  * Order 4-6 cards
  * Count forward AND backward
  * Decade-fill challenges (10, 20, 30...)
  * Can handle skip counting by 2s, 5s, 10s
  * showDotArrays: false for numbers > 20 (too many dots)
  * showNumberLine: true

CHALLENGE TYPES (generate a mix across ${challengeCount} challenges):
1. "fill-missing": A number sequence with 1-3 null values representing blanks.
   - Example: sequence=[3, 4, null, 6, 7], correctAnswers=[5]
   - For K: 1 blank. For Grade 1: 1-3 blanks.
   - correctAnswers contains ONLY the values that replace the nulls, in order.

2. "before-after": A short 2-element sequence with one null.
   - Before: sequence=[null, 8], correctAnswers=[7] (what comes before 8?)
   - After: sequence=[5, null], correctAnswers=[6] (what comes after 5?)
   - Keep instructions clear: "What number comes before/after X?"

3. "order-cards": Numbers presented in shuffled order (NO nulls).
   - sequence=[7, 3, 5, 1], correctAnswers=[1, 3, 5, 7] (sorted ascending)
   - For K: 3-4 cards. For Grade 1: 4-6 cards.
   - All values in sequence are numbers (not null).

4. "count-from": Provide startNumber, direction, and expected continuation.
   - sequence=[] (empty or with startNumber), correctAnswers=[6, 7, 8, 9, 10]
   - Set startNumber (e.g., 5) and direction ("forward" or "backward")
   - For K: forward only, 3-5 numbers to continue
   - For Grade 1: forward or backward, can skip count

5. "decade-fill": Sequence of decade numbers with some nulls.
   - sequence=[10, null, 30, null, 50], correctAnswers=[20, 40]
   - Only for Grade 1 (not Kindergarten)
   - correctAnswers contains ONLY the values that replace the nulls, in order.

DIFFICULTY LEVEL: ${difficulty} (1=easy, 2=medium, 3=hard)
- Easy: shorter sequences, fewer blanks, smaller numbers
- Medium: standard sequences, moderate blanks
- Hard: longer sequences, more blanks, larger numbers

REQUIREMENTS:
1. Generate exactly ${challengeCount} challenges with a good mix of types
2. Progress from easier to harder challenges
3. Each challenge needs a unique id field (e.g., 'seq1', 'seq2', etc.)
4. CRITICAL: For fill-missing, before-after, and decade-fill, correctAnswers must contain ONLY the values that fill in the null positions, in order
5. CRITICAL: For order-cards, sequence must contain ONLY numbers (no nulls), and correctAnswers must be the sorted version
6. CRITICAL: For count-from, set startNumber and direction fields
7. rangeMin and rangeMax should reflect the actual number range used in that challenge
8. Use warm, encouraging instruction text appropriate for young children
9. For gradeBand "K": do NOT include decade-fill challenges, keep numbers 1-20
10. For gradeBand "1": include at least one decade-fill challenge, numbers up to 100
11. Set gradeBand to "${gradeBand}"
12. Set showNumberLine based on grade level guidance above
13. Set showDotArrays based on grade level guidance above

Return the complete number sequencer configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: numberSequencerSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid number sequencer data returned from Gemini API');
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeBand;
  }

  // Validation: ensure booleans have defaults
  if (typeof data.showNumberLine !== 'boolean') {
    data.showNumberLine = true;
  }
  if (typeof data.showDotArrays !== 'boolean') {
    data.showDotArrays = data.gradeBand === 'K';
  }

  // Validate challenge types
  const validTypes = ['fill-missing', 'before-after', 'order-cards', 'count-from', 'decade-fill'];

  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges) {
    // Ensure sequence is an array
    if (!Array.isArray(challenge.sequence)) {
      challenge.sequence = [];
    }

    // Ensure correctAnswers is an array
    if (!Array.isArray(challenge.correctAnswers)) {
      challenge.correctAnswers = [];
    }

    // Validate range bounds
    const maxForGrade = data.gradeBand === 'K' ? 20 : 100;
    if (!challenge.rangeMin || challenge.rangeMin < 0) {
      challenge.rangeMin = 1;
    }
    if (!challenge.rangeMax || challenge.rangeMax > maxForGrade) {
      challenge.rangeMax = maxForGrade;
    }
    if (challenge.rangeMin > challenge.rangeMax) {
      challenge.rangeMin = 1;
    }

    // Validate Kindergarten constraints
    if (data.gradeBand === 'K') {
      // No decade-fill for K
      if (challenge.type === 'decade-fill') {
        challenge.type = 'fill-missing';
      }
      // Clamp numbers to 1-20
      challenge.sequence = challenge.sequence.map((n: number | null) =>
        n !== null ? Math.min(20, Math.max(1, n)) : null
      );
      challenge.correctAnswers = challenge.correctAnswers.map((n: number) =>
        Math.min(20, Math.max(1, n))
      );
    }

    // Validate count-from has required fields
    if (challenge.type === 'count-from') {
      if (typeof challenge.startNumber !== 'number') {
        challenge.startNumber = 1;
      }
      if (challenge.direction !== 'forward' && challenge.direction !== 'backward') {
        challenge.direction = 'forward';
      }
    }

    // Validate order-cards has no nulls in sequence
    if (challenge.type === 'order-cards') {
      challenge.sequence = challenge.sequence.filter((n: number | null) => n !== null);
      if (challenge.sequence.length === 0) {
        // Fallback: convert to fill-missing
        challenge.type = 'fill-missing';
        challenge.sequence = [1, 2, null, 4, 5];
        challenge.correctAnswers = [3];
      }
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'seq1',
      type: 'fill-missing' as const,
      instruction: 'Can you find the missing number?',
      sequence: [1, 2, null, 4, 5],
      correctAnswers: [3],
      rangeMin: 1,
      rangeMax: 5,
    }];
  }

  // Apply explicit config overrides
  if (config?.gradeBand !== undefined) {
    data.gradeBand = config.gradeBand;
  }

  return data;
};
