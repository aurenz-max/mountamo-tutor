import { Type, Schema } from "@google/genai";
import { NumberSequencerData } from "../../primitives/visual-primitives/math/NumberSequencer";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'count-from': {
    promptDoc:
      `"count-from": Student continues counting from a starting number. `
      + `Provide startNumber, direction ("forward" or "backward"), and expected continuation in correctAnswers. `
      + `sequence=[] or [startNumber]. For K: forward only, 3-5 numbers. For Grade 1: forward or backward. `
      + `Concrete — full guidance, sequential counting.`,
    schemaDescription: "'count-from' (continue counting from value)",
  },
  'before-after': {
    promptDoc:
      `"before-after": A short 2-element sequence with one null. `
      + `Before: sequence=[null, 8], correctAnswers=[7]. After: sequence=[5, null], correctAnswers=[6]. `
      + `Keep instructions clear: "What number comes before/after X?" `
      + `Pictorial with prompts — adjacent number reasoning.`,
    schemaDescription: "'before-after' (identify adjacent numbers)",
  },
  'order-cards': {
    promptDoc:
      `"order-cards": Numbers presented in shuffled order (NO nulls in sequence). `
      + `sequence=[7, 3, 5, 1], correctAnswers=[1, 3, 5, 7] (sorted ascending). `
      + `For K: 3-4 cards. For Grade 1: 4-6 cards. `
      + `Pictorial with reduced prompts — sequence a set of numbers.`,
    schemaDescription: "'order-cards' (sequence a set of numbers)",
  },
  'fill-missing': {
    promptDoc:
      `"fill-missing": A number sequence with 1-3 null values representing blanks. `
      + `Example: sequence=[3, 4, null, 6, 7], correctAnswers=[5]. `
      + `correctAnswers contains ONLY the values that replace the nulls, in order. `
      + `For K: 1 blank. For Grade 1: 1-3 blanks. `
      + `Transitional — complete pattern gaps.`,
    schemaDescription: "'fill-missing' (complete pattern gaps)",
  },
  'decade-fill': {
    promptDoc:
      `"decade-fill": Sequence of decade numbers with some nulls. `
      + `Example: sequence=[10, null, 30, null, 50], correctAnswers=[20, 40]. `
      + `correctAnswers contains ONLY the values that replace the nulls, in order. `
      + `Grade 1 only (not Kindergarten). `
      + `Symbolic — cross decade boundaries.`,
    schemaDescription: "'decade-fill' (cross decade boundaries)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

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
            description: "Challenge type: 'fill-missing' (complete pattern gaps), 'before-after' (identify adjacent numbers), 'order-cards' (sequence a set of numbers), 'count-from' (continue counting from value), 'decade-fill' (cross decade boundaries)"
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
      description: "Array of 4-6 progressive challenges"
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

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateNumberSequencer = async (
  topic: string,
  gradeLevel: string,
  config?: {
    difficulty?: number;
    challengeCount?: number;
    gradeBand?: 'K' | '1';
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
  }
): Promise<NumberSequencerData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-sequencer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(numberSequencerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : numberSequencerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const gradeBand = config?.gradeBand || (gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1');
  const challengeCount = config?.challengeCount || 5;
  const difficulty = config?.difficulty || 1;

  const prompt = `
Create an educational number sequencing activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- A number sequencer helps students build sequential number understanding
- Students practice recognizing number order, finding missing numbers, and counting forward/backward
- Key skills: number sequence, before/after, counting on/back, number ordering, decade patterns

${challengeTypeSection}

${!evalConstraint ? `
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
` : ''}

DIFFICULTY LEVEL: ${difficulty} (1=easy, 2=medium, 3=hard)
- Easy: shorter sequences, fewer blanks, smaller numbers
- Medium: standard sequences, moderate blanks
- Hard: longer sequences, more blanks, larger numbers

REQUIREMENTS:
1. Generate ${challengeCount} challenges
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

  logEvalModeResolution('NumberSequencer', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
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

  // Validate challenge types (safety net — schema enum handles the eval mode case)
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

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'fill-missing';
    const fallbacks: Record<string, { type: string; instruction: string; sequence: (number | null)[]; correctAnswers: number[]; rangeMin: number; rangeMax: number; startNumber?: number; direction?: string }> = {
      'count-from': { type: 'count-from', instruction: 'Count forward from 3!', sequence: [], correctAnswers: [4, 5, 6, 7], rangeMin: 3, rangeMax: 7, startNumber: 3, direction: 'forward' },
      'before-after': { type: 'before-after', instruction: 'What number comes after 5?', sequence: [5, null], correctAnswers: [6], rangeMin: 5, rangeMax: 6 },
      'order-cards': { type: 'order-cards', instruction: 'Put these numbers in order!', sequence: [4, 1, 3, 2], correctAnswers: [1, 2, 3, 4], rangeMin: 1, rangeMax: 4 },
      'fill-missing': { type: 'fill-missing', instruction: 'Can you find the missing number?', sequence: [1, 2, null, 4, 5], correctAnswers: [3], rangeMin: 1, rangeMax: 5 },
      'decade-fill': { type: 'decade-fill', instruction: 'Fill in the missing decade numbers!', sequence: [10, null, 30, null, 50], correctAnswers: [20, 40], rangeMin: 10, rangeMax: 50 },
    };
    console.log(`[NumberSequencer] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{ id: 'seq1', ...fallbacks[fallbackType] ?? fallbacks['fill-missing'] }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[NumberSequencer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply explicit config overrides
  if (config?.gradeBand !== undefined) {
    data.gradeBand = config.gradeBand;
  }

  return data;
};
