import { Type, Schema } from "@google/genai";
import { MathFactFluencyData, MathFactFluencyChallenge } from '../../primitives/visual-primitives/math/MathFactFluency';
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
  'visual-fact': {
    promptDoc:
      `"visual-fact": Show a visual (dot-array, ten-frame, fingers, objects) alongside the equation. `
      + `Student sees the fact visually and answers. Set visualType and visualCount. `
      + `unknownPosition = "result". Provide options (multiple choice). timeLimit: 8 seconds. `
      + `Use 2-3 challenges for warm-up. Full scaffolding — concrete visual aids.`,
    schemaDescription: "'visual-fact' (picture-based fact recognition)",
  },
  'match': {
    promptDoc:
      `"match": Connect a visual representation to its equation or vice versa. `
      + `Set matchDirection to "visual-to-equation" or "equation-to-visual". `
      + `For visual-to-equation: provide equationOptions (4 equation strings, one correct). `
      + `CRITICAL: all distractor equations must have DIFFERENT results from the correct equation. `
      + `Set visualType and visualCount. timeLimit: 6 seconds.`,
    schemaDescription: "'match' (connect fact pairs)",
  },
  'equation-solve': {
    promptDoc:
      `"equation-solve": Show bare equations with multiple choice options. No visual aids. `
      + `unknownPosition = "result". Provide 4 options (one correct, three close distractors ±1-2). `
      + `timeLimit: 5 seconds. Reduced scaffolding — pictorial support removed.`,
    schemaDescription: "'equation-solve' (solve given equation)",
  },
  'missing-number': {
    promptDoc:
      `"missing-number": Show an equation with a blank. `
      + `unknownPosition = "operand1" or "operand2" (NOT result). `
      + `No options — student types the answer. timeLimit: 5 seconds. `
      + `Transitional: requires inverse thinking.`,
    schemaDescription: "'missing-number' (find unknown in equation)",
  },
  'speed-round': {
    promptDoc:
      `"speed-round": Bare equations, student types answer as fast as possible. `
      + `unknownPosition = "result". No options, no visual aids. `
      + `Short timeLimit: 3 seconds. Tests automaticity — fully symbolic rapid recall.`,
    schemaDescription: "'speed-round' (timed fluency assessment)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const mathFactFluencySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Activity title (e.g., 'Addition Facts to 5')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description"
    },
    maxNumber: {
      type: Type.NUMBER,
      description: "Maximum number used in facts: 3, 5, or 10"
    },
    includeSubtraction: {
      type: Type.BOOLEAN,
      description: "Whether subtraction facts are included"
    },
    showVisualAids: {
      type: Type.BOOLEAN,
      description: "Whether visual aids are shown in early challenges"
    },
    targetResponseTime: {
      type: Type.NUMBER,
      description: "Target response time in seconds (goal: 3)"
    },
    adaptiveDifficulty: {
      type: Type.BOOLEAN,
      description: "Whether difficulty adapts based on performance"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' or '1'"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'visual-fact' (picture-based fact recognition), 'equation-solve' (solve given equation), 'missing-number' (find unknown in equation), 'match' (connect fact pairs), 'speed-round' (timed fluency assessment)"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging"
          },
          equation: {
            type: Type.STRING,
            description: "Full equation string (e.g., '3 + 2 = 5')"
          },
          operation: {
            type: Type.STRING,
            description: "Operation: 'addition' or 'subtraction'"
          },
          operand1: {
            type: Type.NUMBER,
            description: "First operand"
          },
          operand2: {
            type: Type.NUMBER,
            description: "Second operand"
          },
          result: {
            type: Type.NUMBER,
            description: "The result of operand1 op operand2"
          },
          unknownPosition: {
            type: Type.STRING,
            description: "Which part the student must find: 'result', 'operand1', or 'operand2'"
          },
          correctAnswer: {
            type: Type.NUMBER,
            description: "The number the student must provide (matches unknownPosition)"
          },
          visualType: {
            type: Type.STRING,
            description: "For visual-fact/match: 'dot-array', 'fingers', 'ten-frame', or 'objects'"
          },
          visualCount: {
            type: Type.NUMBER,
            description: "Number of items shown in visual (usually equals correctAnswer)"
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Multiple choice number options for equation-solve"
          },
          timeLimit: {
            type: Type.NUMBER,
            description: "Time limit in seconds for this challenge"
          },
          matchDirection: {
            type: Type.STRING,
            description: "For match: 'visual-to-equation' or 'equation-to-visual'"
          },
          equationOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "For match visual-to-equation: array of equation strings to choose from"
          }
        },
        required: [
          "id", "type", "instruction", "equation", "operation",
          "operand1", "operand2", "result", "unknownPosition", "correctAnswer"
        ]
      },
      description: "Array of 6-10 progressive challenges"
    }
  },
  required: [
    "title", "description", "maxNumber", "includeSubtraction",
    "showVisualAids", "targetResponseTime", "adaptiveDifficulty",
    "gradeBand", "challenges"
  ]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateMathFactFluency = async (
  topic: string,
  gradeLevel: string,
  config?: {
    maxNumber?: number;
    includeSubtraction?: boolean;
    showVisualAids?: boolean;
    targetResponseTime?: number;
    adaptiveDifficulty?: boolean;
    gradeBand?: 'K' | '1';
    /** Target eval mode from the IRT calibration system. Constrains which challenge types to generate. */
    targetEvalMode?: string;
    /** Intent or title from the manifest item. */
    intent?: string;
  }
): Promise<MathFactFluencyData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'math-fact-fluency',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(mathFactFluencySchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : mathFactFluencySchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a math fact fluency activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This primitive builds RAPID RECALL of basic addition and subtraction facts.
- Students progress through challenge types that gradually remove visual scaffolding.
- The goal is automaticity — answering within 3 seconds without counting.

${challengeTypeSection}

${!evalConstraint ? `
GRADE GUIDELINES:
- Kindergarten (gradeBand "K"): maxNumber 3-5, mostly addition, simple warm language
- Grade 1 (gradeBand "1"): maxNumber 5-10, include subtraction, slightly more advanced
` : ''}

MATH RULES:
- For addition: result = operand1 + operand2
- For subtraction: result = operand1 - operand2 (operand1 >= operand2, no negative results)
- correctAnswer MUST match the unknownPosition:
  * unknownPosition "result" → correctAnswer = result
  * unknownPosition "operand1" → correctAnswer = operand1
  * unknownPosition "operand2" → correctAnswer = operand2
- equation field must show the full solved equation: "3 + 2 = 5"
- All numbers must be within maxNumber (e.g., maxNumber=5 means all operands and results <= 5)

${config ? `
CONFIGURATION HINTS:
${config.maxNumber !== undefined ? `- maxNumber: ${config.maxNumber}` : ''}
${config.includeSubtraction !== undefined ? `- includeSubtraction: ${config.includeSubtraction}` : ''}
${config.gradeBand !== undefined ? `- gradeBand: ${config.gradeBand}` : ''}
${config.targetResponseTime !== undefined ? `- targetResponseTime: ${config.targetResponseTime}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 6-10 challenges
2. Each challenge MUST have a unique id (c1, c2, c3, ...)
3. Use warm, encouraging instruction text for young children
4. Multiple choice options should include the correct answer plus reasonable distractors
5. Distractors should be close to the correct answer (off by 1 or 2)
6. NEVER reveal the answer in the instruction text
7. For match challenges with visual-to-equation direction, provide exactly 4 equationOptions. CRITICAL: all distractor equations must have DIFFERENT results from the correct equation. If the correct equation equals 5, no distractor may also equal 5
8. Vary the specific facts used — don't repeat the same equation
9. Use a mix of fact families when possible

Return the complete math fact fluency configuration.
`;

  logEvalModeResolution('MathFactFluency', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid math fact fluency data returned from Gemini API');
  }

  // -------------------------------------------------------------------------
  // Validation & Defaults
  // -------------------------------------------------------------------------

  // gradeBand default
  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // maxNumber default
  if (!data.maxNumber || data.maxNumber < 1) {
    data.maxNumber = 5;
  }

  // targetResponseTime default
  if (!data.targetResponseTime || data.targetResponseTime < 1) {
    data.targetResponseTime = 3;
  }

  // Boolean defaults
  if (typeof data.includeSubtraction !== 'boolean') {
    data.includeSubtraction = data.gradeBand === '1';
  }
  if (typeof data.showVisualAids !== 'boolean') {
    data.showVisualAids = true;
  }
  if (typeof data.adaptiveDifficulty !== 'boolean') {
    data.adaptiveDifficulty = true;
  }

  // Valid challenge types
  const validChallengeTypes = ['visual-fact', 'equation-solve', 'missing-number', 'match', 'speed-round'];
  const validOperations = ['addition', 'subtraction'];
  const validUnknownPositions = ['result', 'operand1', 'operand2'];
  const validVisualTypes = ['dot-array', 'fingers', 'ten-frame', 'objects'];

  // Filter to valid challenges (safety net — schema enum handles the eval mode case)
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Per-challenge validation
  for (const challenge of data.challenges as MathFactFluencyChallenge[]) {
    // Validate operation
    if (!validOperations.includes(challenge.operation)) {
      challenge.operation = 'addition';
    }

    // Validate unknownPosition
    if (!validUnknownPositions.includes(challenge.unknownPosition)) {
      challenge.unknownPosition = 'result';
    }

    // Ensure operands and result are consistent
    if (challenge.operation === 'addition') {
      if (challenge.result !== challenge.operand1 + challenge.operand2) {
        challenge.result = challenge.operand1 + challenge.operand2;
      }
    } else {
      if (challenge.result !== challenge.operand1 - challenge.operand2) {
        challenge.result = challenge.operand1 - challenge.operand2;
      }
      // Ensure no negative results
      if (challenge.result < 0) {
        const temp = challenge.operand1;
        challenge.operand1 = challenge.operand2;
        challenge.operand2 = temp;
        challenge.result = challenge.operand1 - challenge.operand2;
      }
    }

    // Ensure correctAnswer matches unknownPosition
    switch (challenge.unknownPosition) {
      case 'operand1':
        challenge.correctAnswer = challenge.operand1;
        break;
      case 'operand2':
        challenge.correctAnswer = challenge.operand2;
        break;
      case 'result':
      default:
        challenge.correctAnswer = challenge.result;
        break;
    }

    // Rebuild equation string for consistency
    const op = challenge.operation === 'addition' ? '+' : '-';
    challenge.equation = `${challenge.operand1} ${op} ${challenge.operand2} = ${challenge.result}`;

    // Validate visualType if present
    if (challenge.visualType && !validVisualTypes.includes(challenge.visualType)) {
      challenge.visualType = 'dot-array';
    }

    // Set visualCount for visual challenges
    if ((challenge.type === 'visual-fact' || challenge.type === 'match') && challenge.visualType) {
      if (!challenge.visualCount || challenge.visualCount < 0) {
        challenge.visualCount = challenge.correctAnswer;
      }
    }

    // Ensure options include the correct answer for multiple-choice types
    if (challenge.options && challenge.options.length > 0) {
      if (!challenge.options.includes(challenge.correctAnswer)) {
        challenge.options[0] = challenge.correctAnswer;
      }
    }

    // Default timeLimit per type
    if (!challenge.timeLimit || challenge.timeLimit < 1) {
      switch (challenge.type) {
        case 'visual-fact': challenge.timeLimit = 8; break;
        case 'equation-solve': challenge.timeLimit = 5; break;
        case 'missing-number': challenge.timeLimit = 5; break;
        case 'match': challenge.timeLimit = 6; break;
        case 'speed-round': challenge.timeLimit = 3; break;
        default: challenge.timeLimit = 5;
      }
    }

    // Validate match direction
    if (challenge.type === 'match') {
      if (challenge.matchDirection !== 'visual-to-equation' && challenge.matchDirection !== 'equation-to-visual') {
        challenge.matchDirection = 'visual-to-equation';
      }
      // Ensure equationOptions for visual-to-equation: correct equation present,
      // and all distractors have DIFFERENT results to avoid ambiguous matches.
      if (challenge.matchDirection === 'visual-to-equation' && challenge.equationOptions) {
        if (!challenge.equationOptions.includes(challenge.equation)) {
          if (challenge.equationOptions.length > 0) {
            challenge.equationOptions[0] = challenge.equation;
          } else {
            challenge.equationOptions = [challenge.equation];
          }
        }

        // Filter out distractors whose result equals the correct answer
        const correctResult = challenge.result;
        challenge.equationOptions = challenge.equationOptions.filter((eq: string) => {
          if (eq === challenge.equation) return true; // keep the correct one
          const eqParts = eq.split('=');
          const eqResult = parseInt(eqParts[eqParts.length - 1]?.trim() ?? '', 10);
          return isNaN(eqResult) || eqResult !== correctResult;
        });

        // If filtering removed too many, regenerate simple distractors with different results
        while (challenge.equationOptions.length < 4) {
          const offset = challenge.equationOptions.length; // 1, 2, 3
          const distResult = correctResult + offset;
          if (distResult >= 0 && distResult <= data.maxNumber + 2) {
            const a = Math.max(1, distResult - 1);
            const b = distResult - a;
            challenge.equationOptions.push(`${a} + ${b} = ${distResult}`);
          } else {
            const distResult2 = Math.max(0, correctResult - offset);
            const a2 = Math.max(1, distResult2);
            const b2 = distResult2 - a2 + a2 === distResult2 ? 0 : 1;
            challenge.equationOptions.push(`${distResult2} + 0 = ${distResult2}`);
          }
        }
      }
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'visual-fact';
    const fallbacks: Record<string, MathFactFluencyChallenge> = {
      'visual-fact': {
        id: 'c1',
        type: 'visual-fact' as const,
        instruction: 'How many dots do you see? What is 2 + 1?',
        equation: '2 + 1 = 3',
        operation: 'addition' as const,
        operand1: 2,
        operand2: 1,
        result: 3,
        unknownPosition: 'result' as const,
        correctAnswer: 3,
        visualType: 'dot-array' as const,
        visualCount: 3,
        options: [1, 2, 3, 4],
        timeLimit: 8,
      },
      'match': {
        id: 'c1',
        type: 'match' as const,
        instruction: 'Which equation matches the picture?',
        equation: '2 + 1 = 3',
        operation: 'addition' as const,
        operand1: 2,
        operand2: 1,
        result: 3,
        unknownPosition: 'result' as const,
        correctAnswer: 3,
        visualType: 'dot-array' as const,
        visualCount: 3,
        matchDirection: 'visual-to-equation' as const,
        equationOptions: ['2 + 1 = 3', '1 + 1 = 2', '3 + 1 = 4', '2 + 3 = 5'],
        timeLimit: 6,
      },
      'equation-solve': {
        id: 'c1',
        type: 'equation-solve' as const,
        instruction: 'Solve this equation!',
        equation: '3 + 2 = 5',
        operation: 'addition' as const,
        operand1: 3,
        operand2: 2,
        result: 5,
        unknownPosition: 'result' as const,
        correctAnswer: 5,
        options: [3, 4, 5, 6],
        timeLimit: 5,
      },
      'missing-number': {
        id: 'c1',
        type: 'missing-number' as const,
        instruction: 'What number is missing?',
        equation: '3 + 2 = 5',
        operation: 'addition' as const,
        operand1: 3,
        operand2: 2,
        result: 5,
        unknownPosition: 'operand2' as const,
        correctAnswer: 2,
        timeLimit: 5,
      },
      'speed-round': {
        id: 'c1',
        type: 'speed-round' as const,
        instruction: 'Quick! What is 2 + 1?',
        equation: '2 + 1 = 3',
        operation: 'addition' as const,
        operand1: 2,
        operand2: 1,
        result: 3,
        unknownPosition: 'result' as const,
        correctAnswer: 3,
        timeLimit: 3,
      },
    };
    console.log(`[MathFactFluency] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks['visual-fact']];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[MathFactFluency] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply explicit config overrides
  if (config) {
    if (config.maxNumber !== undefined) data.maxNumber = config.maxNumber;
    if (config.includeSubtraction !== undefined) data.includeSubtraction = config.includeSubtraction;
    if (config.showVisualAids !== undefined) data.showVisualAids = config.showVisualAids;
    if (config.targetResponseTime !== undefined) data.targetResponseTime = config.targetResponseTime;
    if (config.adaptiveDifficulty !== undefined) data.adaptiveDifficulty = config.adaptiveDifficulty;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
