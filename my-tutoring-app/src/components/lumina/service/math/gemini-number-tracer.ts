import { Type, Schema } from "@google/genai";
import { NumberTracerData, NumberTracerChallenge } from '../../primitives/visual-primitives/math/NumberTracer';
import { ai } from "../geminiClient";
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
  trace: {
    promptDoc: 'trace: Student follows dotted numeral path with directional arrows showing stroke order.',
    schemaDescription: 'trace — showArrows:true, showModel:false',
  },
  copy: {
    promptDoc: 'copy: Model digit is visible nearby; student writes without dotted guide.',
    schemaDescription: 'copy — showArrows:false, showModel:true',
  },
  write: {
    promptDoc: 'write: Student writes digit from text prompt only — no model, no guide.',
    schemaDescription: 'write — showArrows:false, showModel:false',
  },
  sequence: {
    promptDoc: 'sequence: Student identifies and writes a missing number in a counting sequence (e.g. 3, 4, __, 6).',
    schemaDescription: 'sequence — sequenceNumbers array with missingIndex',
  },
};

// ---------------------------------------------------------------------------
// Gemini JSON schema
// ---------------------------------------------------------------------------

const baseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    gradeBand: { type: Type.STRING, enum: ['K', '1'] },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['trace', 'copy', 'write', 'sequence'] },
          digit: { type: Type.NUMBER },
          instruction: { type: Type.STRING },
          strokePaths: {
            type: Type.ARRAY,
            description: 'Leave empty [] — stroke paths are hardcoded in component',
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ['x', 'y'],
              },
            },
          },
          showModel: { type: Type.BOOLEAN },
          showArrows: { type: Type.BOOLEAN },
          hint: { type: Type.STRING },
          sequenceNumbers: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          missingIndex: { type: Type.NUMBER },
        },
        required: ['id', 'type', 'digit', 'instruction', 'strokePaths', 'showModel', 'showArrows'],
      },
    },
  },
  required: ['title', 'description', 'gradeBand', 'challenges'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function generateNumberTracer(
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string; challengeCount?: number }>,
): Promise<NumberTracerData> {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'number-tracer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(baseSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : baseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  const challengeCount = config?.challengeCount ?? 5;

  const prompt = `
Create a number writing practice activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This primitive builds handwriting fluency for numerals 0-20.
- Students progress through challenge types that gradually remove scaffolding.
- Each challenge has a single digit to write or identify.

${challengeTypeSection}

DIGIT RANGES:
- Kindergarten (gradeBand "K"): choose digits 0-9
- Grade 1 (gradeBand "1"): choose digits 0-20

CHALLENGE RULES:
- For "trace": showArrows = true, showModel = false. Student follows a dotted path.
- For "copy": showArrows = false, showModel = true. Student copies a visible model digit.
- For "write": showArrows = false, showModel = false. Student writes from prompt alone.
- For "sequence": Provide sequenceNumbers (4-5 numbers in order, e.g. [3, 4, 5, 6]).
    Set missingIndex to indicate which position is blank (0-based index).
    Set digit to the number at missingIndex (the correct answer).
    showArrows = false, showModel = false.

STROKE PATHS:
- ALWAYS set strokePaths to [] (empty array). The component uses hardcoded stroke paths.

INSTRUCTIONS (student-facing):
- Use warm, child-friendly language (e.g., "Trace the number 5!", "Write the number seven!", "What comes next? Fill in the missing number!").
- NEVER reveal the answer in the instruction text.

HINTS:
- Provide a hint field that helps without giving away the answer.
  Examples: "Start at the top!", "Count on your fingers!", "What number comes after 4?"

REQUIREMENTS:
1. Generate ${challengeCount} challenges (vary the types present)
2. Each challenge must have a unique id: c1, c2, c3, ...
3. Use a variety of digits — don't repeat the same digit across challenges
4. Progress from easier (trace) to harder (write/sequence) where possible
5. gradeBand must be "K" or "1"

Return the complete number tracer configuration.
`;

  logEvalModeResolution('NumberTracer', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid number tracer data returned from Gemini API');
  }

  // ── Validation & Defaults ──

  // gradeBand default
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Validate challenges array
  const validTypes = ['trace', 'copy', 'write', 'sequence'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type)
  );

  // Per-challenge defaults and normalization
  for (const challenge of data.challenges as NumberTracerChallenge[]) {
    // Ensure strokePaths is always an empty array (hardcoded in component)
    challenge.strokePaths = [];

    // Enforce showArrows / showModel per type
    if (challenge.type === 'trace') {
      challenge.showArrows = true;
      challenge.showModel = false;
    } else if (challenge.type === 'copy') {
      challenge.showArrows = false;
      challenge.showModel = true;
    } else {
      // write and sequence
      challenge.showArrows = false;
      challenge.showModel = false;
    }

    // Clamp digit to valid range
    const maxDigit = data.gradeBand === 'K' ? 9 : 20;
    if (typeof challenge.digit !== 'number' || challenge.digit < 0) {
      challenge.digit = 0;
    }
    if (challenge.digit > maxDigit) {
      challenge.digit = maxDigit;
    }

    // Validate sequence fields
    if (challenge.type === 'sequence') {
      if (!Array.isArray(challenge.sequenceNumbers) || challenge.sequenceNumbers.length < 3) {
        // Fallback: build a simple 4-number sequence around the digit
        const start = Math.max(0, challenge.digit - 1);
        challenge.sequenceNumbers = [start, start + 1, start + 2, start + 3];
        challenge.missingIndex = 1;
        challenge.digit = challenge.sequenceNumbers[1];
      }
      if (
        typeof challenge.missingIndex !== 'number' ||
        challenge.missingIndex < 0 ||
        challenge.missingIndex >= challenge.sequenceNumbers.length
      ) {
        challenge.missingIndex = 1;
        challenge.digit = challenge.sequenceNumbers[1];
      }
    }
  }

  // Fallback if no valid challenges
  if (data.challenges.length === 0) {
    console.log('[NumberTracer] No valid challenges — using fallback');
    data.challenges = [
      {
        id: 'c1',
        type: 'trace' as const,
        digit: 5,
        instruction: 'Trace the number 5!',
        strokePaths: [],
        showModel: false,
        showArrows: true,
        hint: 'Start at the top!',
      },
    ];
  }

  // Log summary
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[NumberTracer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data as NumberTracerData;
}
