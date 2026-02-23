import { Type, Schema } from "@google/genai";
import { MathFactFluencyData, MathFactFluencyChallenge } from '../../primitives/visual-primitives/math/MathFactFluency';
import { ai } from "../geminiClient";

/**
 * Schema definition for Math Fact Fluency Data
 *
 * Kept intentionally flat to avoid deeply nested structures that
 * cause Gemini to produce malformed JSON. Optional sub-object fields
 * (visualOptions, equationOptions) use simple types only.
 */
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
            description: "Challenge type: 'visual-fact', 'equation-solve', 'missing-number', 'match', 'speed-round'"
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

/**
 * Generate math fact fluency data for rapid recall practice
 *
 * Produces a progressive sequence of challenges that remove visual scaffolding:
 * 1. visual-fact — dot arrays, ten-frames, fingers (see the fact)
 * 2. equation-solve — bare equations with multiple choice
 * 3. missing-number — blanks in equations
 * 4. match — visual-to-equation or equation-to-visual pairing
 * 5. speed-round — bare equations, type-in answer, short time limit
 *
 * @param topic - Math topic or concept
 * @param gradeLevel - Grade level string
 * @param config - Optional partial config overrides
 * @returns MathFactFluencyData with complete configuration
 */
export const generateMathFactFluency = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<MathFactFluencyData>
): Promise<MathFactFluencyData> => {
  const prompt = `
Create a math fact fluency activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- This primitive builds RAPID RECALL of basic addition and subtraction facts.
- Students progress through 5 challenge types that gradually remove visual scaffolding.
- The goal is automaticity — answering within 3 seconds without counting.

CHALLENGE TYPE PROGRESSION (generate challenges in this order):
1. "visual-fact" (2-3 challenges): Show a visual (dot-array, ten-frame, fingers) alongside the equation. The student sees the fact visually and answers. Set visualType and visualCount. unknownPosition should be "result". Provide options (multiple choice). timeLimit: 8 seconds.

2. "equation-solve" (2 challenges): Show bare equations with multiple choice options. No visual. unknownPosition = "result". Provide 4 options (one correct, three distractors). timeLimit: 5 seconds.

3. "missing-number" (1-2 challenges): Show an equation with a blank. unknownPosition = "operand1" or "operand2". No options — student types the answer. timeLimit: 5 seconds.

4. "match" (1 challenge): Connect visual to equation or vice versa. Set matchDirection to "visual-to-equation". For visual-to-equation, provide equationOptions (4 equation strings, one correct matching the equation field). Set visualType and visualCount. timeLimit: 6 seconds.

5. "speed-round" (1-2 challenges): Bare equations, student types answer. unknownPosition = "result". No options. Short timeLimit: 3 seconds.

MATH RULES:
- For addition: result = operand1 + operand2
- For subtraction: result = operand1 - operand2 (operand1 >= operand2, no negative results)
- correctAnswer MUST match the unknownPosition:
  * unknownPosition "result" → correctAnswer = result
  * unknownPosition "operand1" → correctAnswer = operand1
  * unknownPosition "operand2" → correctAnswer = operand2
- equation field must show the full solved equation: "3 + 2 = 5"
- All numbers must be within maxNumber (e.g., maxNumber=5 means all operands and results <= 5)

GRADE GUIDELINES:
- Kindergarten (gradeBand "K"): maxNumber 3-5, mostly addition, simple warm language
- Grade 1 (gradeBand "1"): maxNumber 5-10, include subtraction, slightly more advanced

${config ? `
CONFIGURATION HINTS:
${config.maxNumber !== undefined ? `- maxNumber: ${config.maxNumber}` : ''}
${config.includeSubtraction !== undefined ? `- includeSubtraction: ${config.includeSubtraction}` : ''}
${config.gradeBand !== undefined ? `- gradeBand: ${config.gradeBand}` : ''}
${config.targetResponseTime !== undefined ? `- targetResponseTime: ${config.targetResponseTime}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 6-10 challenges in the progression order above
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

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: mathFactFluencySchema
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

  // Filter to valid challenges
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

  // Ensure at least one challenge exists
  if (data.challenges.length === 0) {
    data.challenges = [{
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
    }];
  }

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
