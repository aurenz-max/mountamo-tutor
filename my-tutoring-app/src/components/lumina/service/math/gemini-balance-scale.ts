import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Balance Scale Object - represents items on the scale pans
 */
export interface BalanceScaleObject {
  value: number;
  label?: string;
  isVariable?: boolean; // True for "x", false for constants
}

/**
 * Balance Scale Data - complete configuration for balance scale visualization
 */
export interface BalanceScaleData {
  title: string;
  description: string;
  leftSide: BalanceScaleObject[]; // Objects on left pan
  rightSide: BalanceScaleObject[]; // Objects on right pan
  variableValue: number; // Hidden value of x (for solution)
  showTilt?: boolean; // Animate imbalance
  allowOperations?: ('add' | 'subtract' | 'multiply' | 'divide')[]; // Permitted solving moves
  stepHistory?: string[]; // Track solution steps
}

/**
 * Schema definition for Balance Scale Object
 */
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

/**
 * Schema definition for Balance Scale Data
 *
 * This schema defines the structure for balance scale visualization,
 * making equation solving intuitive through visual equilibrium.
 */
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
    }
  },
  required: ["title", "description", "leftSide", "rightSide", "variableValue"]
};

/**
 * Generate balance scale data for visualization
 *
 * This function creates balance scale data including:
 * - Appropriate equation structure based on topic and grade level
 * - Objects representing constants and variables on each pan
 * - Step-by-step solution guidance
 * - Configuration for allowed operations
 * - Educational context and descriptions
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns BalanceScaleData with complete configuration
 */
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
  }
): Promise<BalanceScaleData> => {
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

PEDAGOGICAL APPROACH:
- Visual representation makes abstract algebra concrete
- Physical metaphor (balance) aids understanding of equality
- Step-by-step manipulation builds procedural fluency
- Immediate visual feedback reinforces correct operations

GUIDELINES FOR GRADE LEVELS:

Grades 1-2: Equality Concepts & Missing Addends
- Simple addition equations: □ + 3 = 7 or 5 + □ = 8
- Use only positive integers under 20
- No variable notation yet - use □ or "mystery number"
- leftSide: [{value: 1, isVariable: true}, {value: 3}]
- rightSide: [{value: 7}]
- variableValue: 4
- allowOperations: ['add', 'subtract']
- Focus on "what number makes this true?"

Grades 3-5: One-Step Equations
- Simple one-step equations: x + 5 = 12, x - 3 = 7
- Introduce x notation
- Use positive integers under 50
- One operation needed to solve
- Example: x + 5 = 12
  - leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 5}]
  - rightSide: [{value: 12}]
  - variableValue: 7
- allowOperations: ['add', 'subtract']
- Include step history: ["Start with x + 5 = 12", "Subtract 5 from both sides", "x = 7"]

Grades 6-7: Two-Step Equations & Coefficients
- Two-step equations: 2x + 3 = 11, 3x - 4 = 14
- Introduce coefficients (multiple x blocks)
- Use integers (including negatives for grade 7)
- Two operations needed
- Example: 2x + 3 = 11
  - leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}, {value: 3}]
  - rightSide: [{value: 11}]
  - variableValue: 4
- allowOperations: ['add', 'subtract', 'multiply', 'divide']
- Detailed step history showing each operation

Grades 7-8: Variables on Both Sides
- Equations like: 2x + 3 = x + 7
- Variables appear on both pans
- May need to combine like terms
- Example: 2x + 3 = x + 7
  - leftSide: [{value: 1, label: 'x', isVariable: true}, {value: 1, label: 'x', isVariable: true}, {value: 3}]
  - rightSide: [{value: 1, label: 'x', isVariable: true}, {value: 7}]
  - variableValue: 4
- allowOperations: ['add', 'subtract', 'multiply', 'divide']
- Step history: ["Start with 2x + 3 = x + 7", "Subtract x from both sides: x + 3 = 7", "Subtract 3 from both sides: x = 4"]

High School: Multi-Step & Distributive Property
- Complex equations: 3(x + 2) = 2x + 11
- May involve fractions or decimals
- Requires distribution and combining terms
- Multiple variables or parameters possible
- All operations allowed

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

STEP HISTORY GUIDELINES:
- Start with the original equation
- Describe each operation performed on both sides
- End with the solution (x = value)
- Use student-friendly language
- For younger grades, use simpler language

EXAMPLES:

Elementary (x + 3 = 7):
{
  title: "Finding the Missing Number: x + 3 = 7",
  description: "Use the balance scale to find what number plus 3 equals 7. Remove 3 from both sides to keep the scale balanced.",
  leftSide: [
    {value: 1, label: "x", isVariable: true},
    {value: 3, label: "3"}
  ],
  rightSide: [{value: 7, label: "7"}],
  variableValue: 4,
  showTilt: true,
  allowOperations: ["subtract"],
  stepHistory: [
    "Start with x + 3 = 7",
    "Subtract 3 from both sides to isolate x",
    "x = 4"
  ]
}

Middle School (2x + 5 = 13):
{
  title: "Solving Two-Step Equation: 2x + 5 = 13",
  description: "First remove the constant by subtracting 5 from both sides, then divide both sides by 2 to find x.",
  leftSide: [
    {value: 1, label: "x", isVariable: true},
    {value: 1, label: "x", isVariable: true},
    {value: 5, label: "5"}
  ],
  rightSide: [{value: 13, label: "13"}],
  variableValue: 4,
  showTilt: true,
  allowOperations: ["add", "subtract", "divide"],
  stepHistory: [
    "Start with 2x + 5 = 13",
    "Subtract 5 from both sides: 2x = 8",
    "Divide both sides by 2: x = 4"
  ]
}

Advanced (Variables on Both Sides: 3x + 2 = x + 10):
{
  title: "Variables on Both Sides: 3x + 2 = x + 10",
  description: "Move all x terms to one side and all constants to the other to solve for x.",
  leftSide: [
    {value: 1, label: "x", isVariable: true},
    {value: 1, label: "x", isVariable: true},
    {value: 1, label: "x", isVariable: true},
    {value: 2, label: "2"}
  ],
  rightSide: [
    {value: 1, label: "x", isVariable: true},
    {value: 10, label: "10"}
  ],
  variableValue: 4,
  showTilt: true,
  allowOperations: ["add", "subtract", "divide"],
  stepHistory: [
    "Start with 3x + 2 = x + 10",
    "Subtract x from both sides: 2x + 2 = 10",
    "Subtract 2 from both sides: 2x = 8",
    "Divide both sides by 2: x = 4"
  ]
}

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

VALIDATION:
- Verify that substituting variableValue for x makes the equation true
- Ensure step history is complete and pedagogically sound
- Check that operations in stepHistory match allowOperations

Return the complete balance scale configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: balanceScaleSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid balance scale data returned from Gemini API');
  }

  // Validation: ensure arrays are not empty
  if (!data.leftSide || data.leftSide.length === 0) {
    console.warn('Invalid balance scale: leftSide is empty. Setting default.');
    data.leftSide = [{ value: 1, label: 'x', isVariable: true }, { value: 3 }];
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

  return data;
};
