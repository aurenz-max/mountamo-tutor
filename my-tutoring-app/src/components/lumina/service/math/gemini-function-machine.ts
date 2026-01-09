import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Function Machine Data Interface
 *
 * This matches the FunctionMachineData interface in the component
 */
export interface FunctionMachineData {
  title: string;
  description: string;
  rule: string;
  showRule?: boolean;
  inputQueue?: number[];
  outputDisplay?: 'immediate' | 'animated' | 'hidden';
  chainable?: boolean;
  ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
}

/**
 * Schema definition for Function Machine Data
 *
 * This schema defines the structure for function machine visualization,
 * including the transformation rule and input values.
 */
const functionMachineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the function machine (e.g., 'Mystery Function', 'Linear Function Explorer')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    rule: {
      type: Type.STRING,
      description: "The transformation rule using 'x' as variable (e.g., 'x + 3', '2*x', 'x^2', '3*x - 1'). Use * for multiplication, ^ for exponents."
    },
    showRule: {
      type: Type.BOOLEAN,
      description: "Display or hide the rule. Set false for discovery mode, true for learning mode. Default: false"
    },
    inputQueue: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER
      },
      description: "Array of initial input values to process. Choose values that make the pattern clear."
    },
    outputDisplay: {
      type: Type.STRING,
      description: "How outputs are displayed: 'immediate', 'animated', or 'hidden'. Default: 'animated'"
    },
    chainable: {
      type: Type.BOOLEAN,
      description: "Allow connecting multiple machines for function composition. Default: false"
    },
    ruleComplexity: {
      type: Type.STRING,
      description: "Complexity level: 'oneStep' (x+3), 'twoStep' (2x+1), 'expression' (x^2-3). Default: 'oneStep'"
    }
  },
  required: ["title", "description", "rule"]
};

/**
 * Generate function machine data for visualization
 *
 * This function creates function machine data including:
 * - Appropriate function rule for the topic and grade level
 * - Input values that make the pattern discoverable
 * - Educational context and descriptions
 * - Configuration for interactive features
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns FunctionMachineData with complete configuration
 */
export const generateFunctionMachine = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rule?: string;
    showRule?: boolean;
    inputQueue?: number[];
    outputDisplay?: 'immediate' | 'animated' | 'hidden';
    chainable?: boolean;
    ruleComplexity?: 'oneStep' | 'twoStep' | 'expression';
  }
): Promise<FunctionMachineData> => {
  const prompt = `
Create an educational function machine visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Function machines are visual tools showing input-output transformations
- Students drop numbers into the input hopper, watch them transform, and see the output
- They can guess the rule by analyzing input-output pairs
- Builds understanding of functions, patterns, and algebraic thinking

GUIDELINES FOR GRADE LEVELS:
- Grades 3-4: Simple one-step rules (x+3, x-2, x*2), small positive integers
- Grades 4-5: One-step rules with multiplication/division (2*x, x/2), introduce pattern recognition
- Grades 5-6: Two-step rules (2*x+1, 3*x-2), negative numbers, decimals
- Grades 6-7: More complex expressions (x^2, 2*x+3), function notation introduction
- Grade 8: Linear functions (mx+b), quadratic basics (x^2, x^2+1)
- Algebra 1: Linear functions, quadratics, inverse functions
- Algebra 2: Polynomial functions, composition, transformations

TOPIC-SPECIFIC GUIDANCE:
- "Input/output patterns": Simple rules like x+5, x*2, x-3 (discovery mode)
- "Function concept": Show rule, explain f(x) notation (learning mode)
- "Linear functions": Rules like 2*x+3, -x+5 with negative and positive slopes
- "Function notation": Introduce f(x) = rule format
- "Composition of functions": Enable chainable mode for g(f(x))
- "Inverse functions": Pairs like x+3 and x-3, 2*x and x/2
- "Quadratic functions": x^2, x^2+2, x^2-1
- "Patterns and sequences": Rules that generate arithmetic/geometric sequences

RULE COMPLEXITY EXAMPLES:
- oneStep: "x+5", "x-3", "x*2", "x/2", "x*10"
- twoStep: "2*x+1", "3*x-2", "x/2+3", "4*x-5"
- expression: "x^2", "x^2+1", "2*x^2-3", "(x+1)^2"

INPUT QUEUE STRATEGY:
- For discovery mode: Choose inputs that make the pattern clear but not obvious
  - Addition: [1,2,3,4,5] or [0,1,2,3,4]
  - Multiplication: [1,2,3,4,5] shows doubling, tripling clearly
  - Quadratic: [0,1,2,3,4] shows square pattern well
  - Two-step: [0,1,2,3,4] makes constant term obvious
- For learning mode: Use varied inputs including 0, negative numbers
- Include 0 in inputs when teaching linear functions (reveals y-intercept)
- For assessment: Mix of small and larger numbers, positive and negative

GOOD RULES BY GRADE:
- Elementary (3-5): x+3, x-2, x*2, x*5, x/2, 2*x, 10*x
- Middle (6-8): 2*x+1, 3*x-2, x^2, x^2+1, -x+5, x/2+3
- High School: 2*x+3, -3*x+2, x^2-4, (x-1)^2, 3*x^2+1

AVOID:
- Rules with remainders/fractions for elementary unless intended
- Rules that produce very large numbers (keep outputs < 100 when possible)
- Overly complex expressions for the grade level
- Division by zero scenarios

SYNTAX RULES:
- Use 'x' as the variable (lowercase)
- Use '*' for multiplication (not implicit: write '2*x' not '2x')
- Use '^' for exponents (x^2 for x squared)
- Use parentheses for clarity: (x+1)^2

${config ? `
CONFIGURATION HINTS:
${config.rule !== undefined ? `- Rule: ${config.rule}` : ''}
${config.showRule !== undefined ? `- Show rule: ${config.showRule}` : ''}
${config.inputQueue !== undefined ? `- Input queue: ${JSON.stringify(config.inputQueue)}` : ''}
${config.outputDisplay !== undefined ? `- Output display: ${config.outputDisplay}` : ''}
${config.chainable !== undefined ? `- Chainable: ${config.chainable}` : ''}
${config.ruleComplexity !== undefined ? `- Rule complexity: ${config.ruleComplexity}` : ''}
` : ''}

REQUIREMENTS:
1. Choose a rule appropriate for the grade level and topic
2. Write a clear, engaging title (use "Mystery Function" for discovery mode)
3. Provide an educational description of what students will learn
4. Select 5-8 input values that help students discover the pattern
5. Use discovery mode (showRule: false) for exploration, learning mode (showRule: true) for instruction
6. Set outputDisplay to 'animated' for engaging visualization
7. Only enable chainable mode if topic involves function composition
8. Match ruleComplexity to the actual rule complexity

IMPORTANT:
- For pattern recognition: Hide the rule and use inputs that show clear progression
- For function notation: Show the rule and explain the f(x) format
- For composition: Enable chainable and use simpler rules
- For assessment: Hide rule, use varied inputs including edge cases
- Always use proper syntax with '*' for multiplication

Return the complete function machine configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: functionMachineSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid function machine data returned from Gemini API');
  }

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.rule !== undefined) data.rule = config.rule;
    if (config.showRule !== undefined) data.showRule = config.showRule;
    if (config.inputQueue !== undefined) data.inputQueue = config.inputQueue;
    if (config.outputDisplay !== undefined) data.outputDisplay = config.outputDisplay;
    if (config.chainable !== undefined) data.chainable = config.chainable;
    if (config.ruleComplexity !== undefined) data.ruleComplexity = config.ruleComplexity;
  }

  // Set defaults
  if (data.showRule === undefined) data.showRule = false; // Discovery mode by default
  if (data.outputDisplay === undefined) data.outputDisplay = 'animated';
  if (data.chainable === undefined) data.chainable = false;
  if (data.inputQueue === undefined || data.inputQueue.length === 0) {
    data.inputQueue = [1, 2, 3, 4, 5]; // Default sensible inputs
  }

  // Infer ruleComplexity if not set
  if (data.ruleComplexity === undefined) {
    const rule = data.rule;
    if (rule.includes('^') || rule.split(/[+\-*/]/).length > 2) {
      data.ruleComplexity = 'expression';
    } else if (rule.split(/[+\-]/).length > 1 && rule.includes('*')) {
      data.ruleComplexity = 'twoStep';
    } else {
      data.ruleComplexity = 'oneStep';
    }
  }

  // Validate rule syntax (basic check)
  if (!data.rule.includes('x')) {
    console.warn(`Rule does not contain variable 'x': ${data.rule}. Adding default rule.`);
    data.rule = 'x + 1';
  }

  return data;
};
