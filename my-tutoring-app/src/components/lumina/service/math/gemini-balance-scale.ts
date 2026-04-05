import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { BalanceScaleData, BalanceScaleObject, BalanceScaleChallenge } from '../../primitives/visual-primitives/math/BalanceScale';
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
  equality: {
    promptDoc:
      `"equality": K-2 missing addend problems. Use □ or "mystery number" — no variable notation. `
      + `Simple addition equations: □ + 3 = 7 or 5 + □ = 8. `
      + `Use only positive integers under 20. `
      + `leftSide: [{value: 1, isVariable: true}, {value: 3}], rightSide: [{value: 7}], variableValue: 4. `
      + `allowOperations: ['add', 'subtract']. gradeBand: 'K-2'. Focus on "what number makes this true?"`,
    schemaDescription: "'equality' (balance = equal)",
  },
  one_step: {
    promptDoc:
      `"one_step": Grades 3-4 one-step equations with x notation. `
      + `Examples: x + 5 = 12, x - 3 = 7. Use positive integers under 50. `
      + `One operation needed to solve. `
      + `leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 5}], rightSide: [{value: 12}], variableValue: 7. `
      + `allowOperations: ['add', 'subtract']. gradeBand: '3-4'. `
      + `Include step history: ["Start with x + 5 = 12", "Subtract 5 from both sides", "x = 7"].`,
    schemaDescription: "'one_step' (single-operation equation)",
  },
  two_step: {
    promptDoc:
      `"two_step": Grade 5+ two-step equations with coefficients. `
      + `Examples: 2x + 3 = 11, 3x - 4 = 14. Use integers (including negatives for advanced). `
      + `Two operations needed. Represent coefficients with multiple variable objects. `
      + `leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}, {value: 3}], rightSide: [{value: 11}], variableValue: 4. `
      + `allowOperations: ['add', 'subtract', 'multiply', 'divide']. gradeBand: '5'. `
      + `Detailed step history showing each operation.`,
    schemaDescription: "'two_step' (multi-step equation)",
  },
  equality_hard: {
    promptDoc:
      `"equality_hard": K-2 harder missing-addend problems with subtraction and larger numbers. `
      + `Include SUBTRACTION equations: 12 - □ = 7, □ - 3 = 5. `
      + `Use sums/differences in the range 10-20. Mix addition and subtraction. `
      + `Still use □ or "mystery number" — no x notation. `
      + `leftSide: [{value: 1, isVariable: true}, {value: 7}], rightSide: [{value: 12}], variableValue: 5. `
      + `allowOperations: ['add', 'subtract']. gradeBand: 'K-2'. `
      + `Focus on subtraction as "undoing" addition.`,
    schemaDescription: "'equality_hard' (harder missing addend with subtraction)",
  },
  one_step_hard: {
    promptDoc:
      `"one_step_hard": Grades 3-4 one-step equations using multiplication or division. `
      + `Examples: 3x = 12, x ÷ 2 = 5, 4x = 20. Use positive integers. `
      + `Products under 50. Divisors 2-10. `
      + `For multiplication: leftSide has multiple variable objects. 3x = 12 → leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}], rightSide: [{value: 12}], variableValue: 4. `
      + `allowOperations: ['multiply', 'divide']. gradeBand: '3-4'. `
      + `Step history should mention "divide both sides" or "how many groups of x make the total?"`,
    schemaDescription: "'one_step_hard' (multiply/divide one-step equation)",
  },
  two_step_intro: {
    promptDoc:
      `"two_step_intro": Grades 4-5 simple two-step equations with small positive coefficients. `
      + `Examples: 2x + 1 = 7, 3x - 2 = 10. Coefficients 2-4 only. `
      + `All values positive. Results under 30. `
      + `Two operations needed but keep numbers small and friendly. `
      + `leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}, {value: 1}], rightSide: [{value: 7}], variableValue: 3. `
      + `allowOperations: ['add', 'subtract', 'multiply', 'divide']. gradeBand: '3-4'. `
      + `Step history: first undo addition/subtraction, then undo multiplication.`,
    schemaDescription: "'two_step_intro' (simple two-step, small coefficients)",
  },
};

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const balanceScaleObjectSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.NUMBER,
      description: "Numeric value of the object. For variables, this is the coefficient (default 1 for 'x'). For constants, this is the actual value."
    },
    label: {
      type: Type.STRING,
      description: "Display label for the object (e.g., 'x', '3', '5'). Optional - defaults to the value.",
      nullable: true
    },
    isVariable: {
      type: Type.BOOLEAN,
      description: "True if this represents a variable (x), false for constants. Default: false"
    }
  },
  required: ["value"]
};

const balanceScaleChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["equality", "equality_hard", "one_step", "one_step_hard", "two_step_intro", "two_step"],
      description: "Difficulty tier of the challenge"
    },
    instruction: {
      type: Type.STRING,
      description: "Clear instruction telling the student what to solve"
    },
    leftSide: {
      type: Type.ARRAY,
      items: balanceScaleObjectSchema,
      description: "Objects on the left pan for this challenge"
    },
    rightSide: {
      type: Type.ARRAY,
      items: balanceScaleObjectSchema,
      description: "Objects on the right pan for this challenge"
    },
    variableValue: {
      type: Type.NUMBER,
      description: "The solution value for x in this challenge"
    },
    hint: {
      type: Type.STRING,
      description: "A helpful hint shown after multiple failed attempts"
    }
  },
  required: ["type", "instruction", "leftSide", "rightSide", "variableValue", "hint"]
};

const balanceScaleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the balance scale problem (e.g., 'Solving x + 3 = 7')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining the equation and solving strategy"
    },
    leftSide: {
      type: Type.ARRAY,
      items: balanceScaleObjectSchema,
      description: "Array of objects on the left pan. Each object has a value and optional label. Variables have isVariable: true."
    },
    rightSide: {
      type: Type.ARRAY,
      items: balanceScaleObjectSchema,
      description: "Array of objects on the right pan. Each object has a value and optional label."
    },
    variableValue: {
      type: Type.NUMBER,
      description: "The hidden solution value for the variable x. This is what students should solve for."
    },
    showTilt: {
      type: Type.BOOLEAN,
      description: "Whether to animate the scale tilting when imbalanced. Helpful for visual learners. Default: true"
    },
    allowOperations: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: ["add", "subtract", "multiply", "divide"]
      },
      description: "Operations students can use to solve. For simple equations use ['add', 'subtract']. For complex use all four."
    },
    stepHistory: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: "Array of solution step descriptions to guide students through the solving process. Each step explains one operation."
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["K-2", "3-4", "5"],
      description: "Target grade band for difficulty calibration. Default: '3-4'"
    },
    challenges: {
      type: Type.ARRAY,
      items: balanceScaleChallengeSchema,
      description: "Array of sequential equation challenges for the student to complete"
    }
  },
  required: ["title", "description", "leftSide", "rightSide", "variableValue"]
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateBalanceScale = async (
  topic: string,
  gradeLevel: string,
  config?: {
    leftSide?: BalanceScaleObject[];
    rightSide?: BalanceScaleObject[];
    variableValue?: number;
    showTilt?: boolean;
    allowOperations?: ('add' | 'subtract' | 'multiply' | 'divide')[];
    stepHistory?: string[];
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<BalanceScaleData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'balance-scale',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(balanceScaleSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : balanceScaleSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Generate random equations for variety
  const numEquations = 6 + Math.floor(Math.random() * 5); // 6-10 examples
  const randomEquations: string[] = [];

  for (let i = 0; i < numEquations; i++) {
    const x = Math.floor(Math.random() * 20) + 1;
    const constant = Math.floor(Math.random() * 15) + 1;
    const operation = Math.random() > 0.5 ? '+' : '-';
    const result = operation === '+' ? x + constant : x - constant;
    randomEquations.push(`x ${operation} ${constant} = ${result}`);
  }

  const prompt = `
Create an educational balance scale visualization for teaching "${topic}" to ${gradeLevel} students.

RANDOMIZATION GUIDANCE: Consider these diverse equations for variety: ${randomEquations.join(', ')}
IMPORTANT: Generate DIFFERENT and VARIED problems each time. Vary the operations, coefficients, and constants.

CONTEXT:
- Balance scales represent equations as physical equilibrium
- Objects on each pan must have equal total value
- Students solve by performing same operation on both sides
- Variables (x) are shown as special objects different from constants
- The scale tilts when sides are unequal, balances when equal
- Goal is to isolate the variable to find its value

${challengeTypeSection}

${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:

Grades 1-2: Equality Concepts & Missing Addends
- Simple addition equations: □ + 3 = 7 or 5 + □ = 8
- Use only positive integers under 20
- No variable notation yet - use □ or "mystery number"
- leftSide: [{value: 1, isVariable: true}, {value: 3}]
- rightSide: [{value: 7}]
- variableValue: 4
- allowOperations: ['add', 'subtract']
- gradeBand: 'K-2'
- Focus on "what number makes this true?"

Grades 3-5: One-Step Equations
- Simple one-step equations: x + 5 = 12, x - 3 = 7
- Introduce x notation
- Use positive integers under 50
- One operation needed to solve
- allowOperations: ['add', 'subtract']
- gradeBand: '3-4'
- Include step history

Grades 5+: Two-Step Equations & Coefficients
- Two-step equations: 2x + 3 = 11, 3x - 4 = 14
- Introduce coefficients (multiple x blocks)
- Use integers (including negatives for advanced)
- Two operations needed
- allowOperations: ['add', 'subtract', 'multiply', 'divide']
- gradeBand: '5'
- Detailed step history showing each operation
` : ''}

EQUATION STRUCTURE:

For variable objects (isVariable: true):
- value: The coefficient (usually 1 for single x, 2 for 2x, etc.)
- label: 'x' or '2x' or similar
- isVariable: true

For constant objects (isVariable: false or undefined):
- value: The actual numeric value
- label: String representation (optional, defaults to value)
- isVariable: false (or omitted)

IMPORTANT RULES:
1. The equation MUST be balanced (leftSide sum = rightSide sum when x = variableValue)
2. Variables use isVariable: true, constants use isVariable: false or omit it
3. For coefficients > 1, include multiple variable objects OR use value = coefficient
4. Keep object counts reasonable (max 5-6 objects per side)
5. Always include step history for educational value
6. Title should describe the equation being solved
7. Description should explain the strategy and learning goal
8. Set gradeBand based on the grade level context

STEP HISTORY GUIDELINES:
- Start with the original equation
- Describe each operation performed on both sides
- End with the solution (x = value)
- Use student-friendly language

${config ? `
CONFIGURATION HINTS:
${config.leftSide ? `- Left side objects: ${JSON.stringify(config.leftSide)}` : ''}
${config.rightSide ? `- Right side objects: ${JSON.stringify(config.rightSide)}` : ''}
${config.variableValue !== undefined ? `- Variable value: ${config.variableValue}` : ''}
${config.showTilt !== undefined ? `- Show tilt animation: ${config.showTilt}` : ''}
${config.allowOperations ? `- Allowed operations: ${config.allowOperations.join(', ')}` : ''}
${config.stepHistory ? `- Solution steps: ${JSON.stringify(config.stepHistory)}` : ''}
` : ''}

REQUIREMENTS:
1. Create an equation appropriate for the grade level and topic
2. Ensure mathematical correctness: sum(leftSide values) = sum(rightSide values) when x = variableValue
3. Provide clear, age-appropriate title and description
4. Structure objects correctly with value, optional label, and isVariable flag
5. Include comprehensive step history showing the solving process
6. Set appropriate allowOperations based on complexity
7. Use showTilt: true for engaging visual feedback
8. Keep the number of objects manageable (3-6 per side)
9. Set gradeBand appropriately based on grade level

VALIDATION:
- Verify that substituting variableValue for x makes the equation true
- Ensure step history is complete and pedagogically sound
- Check that operations in stepHistory match allowOperations

Return the complete balance scale configuration.
`;

  logEvalModeResolution('BalanceScale', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid balance scale data returned from Gemini API');
  }

  // Validation: ensure arrays are not empty
  if (!data.leftSide || data.leftSide.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'one_step';
    const fallbacks: Record<string, { leftSide: BalanceScaleObject[]; rightSide: BalanceScaleObject[]; variableValue: number }> = {
      equality: {
        leftSide: [{ value: 1, isVariable: true }, { value: 3 }],
        rightSide: [{ value: 7 }],
        variableValue: 4,
      },
      one_step: {
        leftSide: [{ value: 1, label: 'x', isVariable: true }, { value: 5 }],
        rightSide: [{ value: 12 }],
        variableValue: 7,
      },
      two_step: {
        leftSide: [{ value: 1, label: 'x', isVariable: true }, { value: 1, label: 'x', isVariable: true }, { value: 3 }],
        rightSide: [{ value: 11 }],
        variableValue: 4,
      },
      equality_hard: {
        leftSide: [{ value: 1, isVariable: true }, { value: 7 }],
        rightSide: [{ value: 12 }],
        variableValue: 5,
      },
      one_step_hard: {
        leftSide: [{ value: 1, label: 'x', isVariable: true }, { value: 1, label: 'x', isVariable: true }, { value: 1, label: 'x', isVariable: true }],
        rightSide: [{ value: 12 }],
        variableValue: 4,
      },
      two_step_intro: {
        leftSide: [{ value: 1, label: 'x', isVariable: true }, { value: 1, label: 'x', isVariable: true }, { value: 1 }],
        rightSide: [{ value: 7 }],
        variableValue: 3,
      },
    };
    const fb = fallbacks[fallbackType] ?? fallbacks.one_step;
    console.warn(`[BalanceScale] Invalid leftSide — using ${fallbackType} fallback`);
    data.leftSide = fb.leftSide;
    data.rightSide = fb.rightSide;
    data.variableValue = fb.variableValue;
  }

  if (!data.rightSide || data.rightSide.length === 0) {
    console.warn('Invalid balance scale: rightSide is empty. Setting default.');
    data.rightSide = [{ value: 7 }];
  }

  if (data.variableValue === undefined || data.variableValue === null) {
    console.warn('Invalid balance scale: variableValue is missing. Setting default.');
    data.variableValue = 4;
  }

  // Validation: ensure equation is balanced
  const leftSum = data.leftSide.reduce((sum: number, obj: BalanceScaleObject) => {
    const value = obj.isVariable ? data.variableValue * (obj.value || 1) : obj.value;
    return sum + value;
  }, 0);

  const rightSum = data.rightSide.reduce((sum: number, obj: BalanceScaleObject) => {
    const value = obj.isVariable ? data.variableValue * (obj.value || 1) : obj.value;
    return sum + value;
  }, 0);

  if (Math.abs(leftSum - rightSum) > 0.01) {
    console.warn(`Balance scale equation is not balanced! Left: ${leftSum}, Right: ${rightSum}. Adjusting...`);
    // Try to fix by adjusting the variable value
    const leftVarCoeff = data.leftSide.reduce((sum: number, obj: BalanceScaleObject) =>
      sum + (obj.isVariable ? (obj.value || 1) : 0), 0);
    const rightVarCoeff = data.rightSide.reduce((sum: number, obj: BalanceScaleObject) =>
      sum + (obj.isVariable ? (obj.value || 1) : 0), 0);
    const leftConst = data.leftSide.reduce((sum: number, obj: BalanceScaleObject) =>
      sum + (obj.isVariable ? 0 : obj.value), 0);
    const rightConst = data.rightSide.reduce((sum: number, obj: BalanceScaleObject) =>
      sum + (obj.isVariable ? 0 : obj.value), 0);

    const varCoeffDiff = leftVarCoeff - rightVarCoeff;
    if (varCoeffDiff !== 0) {
      data.variableValue = (rightConst - leftConst) / varCoeffDiff;
    }
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.leftSide) data.leftSide = config.leftSide;
    if (config.rightSide) data.rightSide = config.rightSide;
    if (config.variableValue !== undefined) data.variableValue = config.variableValue;
    if (config.showTilt !== undefined) data.showTilt = config.showTilt;
    if (config.allowOperations) data.allowOperations = config.allowOperations;
    if (config.stepHistory) data.stepHistory = config.stepHistory;
  }

  // Set defaults for optional fields if not present
  if (data.showTilt === undefined) data.showTilt = true;
  if (!data.allowOperations || data.allowOperations.length === 0) {
    data.allowOperations = ['add', 'subtract'];
  }
  if (!data.stepHistory || data.stepHistory.length === 0) {
    data.stepHistory = ['Solve the equation by performing the same operation on both sides'];
  }
  data.gradeBand = data.gradeBand || '3-4';
  data.challenges = data.challenges || [];

  // Final summary log
  const challengeTypes = (data.challenges as BalanceScaleChallenge[]).map((c) => c.type).join(', ');
  console.log(`[BalanceScale] Final: ${data.challenges.length} challenge(s) → [${challengeTypes}]`);

  return data;
};
