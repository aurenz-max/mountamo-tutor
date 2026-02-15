import { Type, Schema } from "@google/genai";
import { RegroupingWorkbenchData } from "../../primitives/visual-primitives/math/RegroupingWorkbench";
import { ai } from "../geminiClient";

/**
 * Schema definition for Regrouping Workbench Data
 *
 * This schema defines the structure for addition/subtraction with
 * regrouping (carry/borrow) challenges for grades 1-4.
 */
const regroupingWorkbenchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Adding with Regrouping', 'Subtraction with Borrowing')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description"
    },
    operation: {
      type: Type.STRING,
      description: "Operation: 'addition' or 'subtraction'"
    },
    operand1: {
      type: Type.NUMBER,
      description: "First operand (the larger number for subtraction)"
    },
    operand2: {
      type: Type.NUMBER,
      description: "Second operand"
    },
    maxPlace: {
      type: Type.STRING,
      description: "Maximum place value: 'tens' (2-digit), 'hundreds' (3-digit), or 'thousands' (4-digit)"
    },
    decimalMode: {
      type: Type.BOOLEAN,
      description: "Whether to use decimals (grade 4+)"
    },
    initialState: {
      type: Type.OBJECT,
      properties: {
        blocksPlaced: {
          type: Type.BOOLEAN,
          description: "Whether blocks are pre-placed on the workspace"
        },
        algorithmVisible: {
          type: Type.BOOLEAN,
          description: "Whether the written algorithm is shown"
        }
      },
      required: ["blocksPlaced", "algorithmVisible"]
    },
    regroupingSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          place: {
            type: Type.STRING,
            description: "Place value: 'ones', 'tens', or 'hundreds'"
          },
          type: {
            type: Type.STRING,
            description: "'carry' for addition, 'borrow' for subtraction"
          },
          fromValue: {
            type: Type.NUMBER,
            description: "Value before regrouping at this place"
          },
          toValue: {
            type: Type.NUMBER,
            description: "Value after regrouping at this place"
          },
          narration: {
            type: Type.STRING,
            description: "AI tutor narration for this regrouping step"
          }
        },
        required: ["place", "type", "fromValue", "toValue", "narration"]
      },
      description: "Step-by-step regrouping instructions"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID"
          },
          problem: {
            type: Type.STRING,
            description: "The problem string (e.g., '27 + 45', '52 - 17')"
          },
          requiresRegrouping: {
            type: Type.BOOLEAN,
            description: "Whether this problem requires regrouping"
          },
          regroupCount: {
            type: Type.NUMBER,
            description: "How many times regrouping is needed"
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for introducing this problem"
          }
        },
        required: ["id", "problem", "requiresRegrouping", "regroupCount", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showAlgorithm: {
          type: Type.BOOLEAN,
          description: "Show the written algorithm panel"
        },
        showCarryBorrow: {
          type: Type.BOOLEAN,
          description: "Show carry/borrow digits"
        },
        showPlaceColumns: {
          type: Type.BOOLEAN,
          description: "Show place value column headers"
        },
        animateRegrouping: {
          type: Type.BOOLEAN,
          description: "Animate the regrouping process"
        },
        stepByStepMode: {
          type: Type.BOOLEAN,
          description: "Guided step-by-step mode"
        }
      },
      required: ["showAlgorithm", "showCarryBorrow", "showPlaceColumns", "animateRegrouping", "stepByStepMode"]
    },
    wordProblemContext: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether a word problem context is provided"
        },
        story: {
          type: Type.STRING,
          description: "The word problem story (e.g., 'A farmer has 27 apples and picks 45 more...')"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Image prompt for the word problem context"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '1-2' or '3-4'"
    }
  },
  required: ["title", "description", "operation", "operand1", "operand2", "maxPlace", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate regrouping workbench data for interactive arithmetic
 *
 * Grade-aware content:
 * - Grades 1-2: Two-digit problems with one regroup. Addition focus.
 * - Grades 3-4: Three-digit with multiple regroups. Word problems. Subtraction.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints
 * @returns RegroupingWorkbenchData with complete configuration
 */
export const generateRegroupingWorkbench = async (
  topic: string,
  gradeLevel: string,
  config?: {
    operation?: 'addition' | 'subtraction';
    gradeBand?: '1-2' | '3-4';
    maxPlace?: 'tens' | 'hundreds' | 'thousands';
  }
): Promise<RegroupingWorkbenchData> => {
  const prompt = `
Create an educational regrouping (carry/borrow) activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Regrouping is when 10 ones become 1 ten (carrying in addition) or 1 ten becomes 10 ones (borrowing in subtraction)
- Students use base-ten blocks (ones cubes, tens rods, hundreds flats) alongside the written algorithm
- The blocks make the "carry" and "borrow" visible and concrete

GUIDELINES FOR GRADE LEVELS:
- Grades 1-2 (gradeBand "1-2"):
  * Two-digit numbers ONLY (maxPlace: 'tens')
  * Start with a non-regrouping problem, then problems that require 1 regroup
  * Addition focus. Can include simple subtraction with borrowing.
  * Operands: 10-99. Problems like 27+45, 38+24, 52-17
  * stepByStepMode: true (guided)
  * Word problems: simple contexts (apples, toys, stickers)
  * CRITICAL: First challenge should NOT require regrouping. Second and beyond should.

- Grades 3-4 (gradeBand "3-4"):
  * Three-digit numbers (maxPlace: 'hundreds')
  * Problems with 1-2 regroups
  * Both addition and subtraction
  * Operands: 100-999. Problems like 347+285, 503-247
  * stepByStepMode: false (free exploration)
  * Word problems: more complex contexts
  * Can include problems that regroup across multiple places

CHALLENGE REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with no-regroup, then 1 regroup, then 2+ regroups
3. The 'problem' field should be formatted as "27 + 45" or "52 - 17"
4. Set requiresRegrouping and regroupCount accurately for each problem
5. For subtraction: operand1 must be LARGER than operand2 (no negative results)
6. Include conversational narration: "Whoa, 7 + 5 = 12! That's more than 9!"
7. Include regroupingSteps for the FIRST problem that requires regrouping

IMPORTANT: Always generate problems where regrouping is needed (that's the whole point).
- For addition: ones digits should sum to 10+ (e.g., 7+5, 8+6, 9+4)
- For subtraction: ones digit of operand1 should be smaller than operand2's ones digit (e.g., 42-17: 2<7)

${config ? `
CONFIGURATION HINTS:
${config.operation ? `- Operation: ${config.operation}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.maxPlace ? `- Max place: ${config.maxPlace}` : ''}
` : ''}

Return the complete regrouping workbench configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: regroupingWorkbenchSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid regrouping workbench data returned from Gemini API');
  }

  // Validation: ensure operation is valid
  if (data.operation !== 'addition' && data.operation !== 'subtraction') {
    data.operation = 'addition';
  }

  // Validation: ensure gradeBand
  if (data.gradeBand !== '1-2' && data.gradeBand !== '3-4') {
    data.gradeBand = gradeLevel.toLowerCase().includes('1') || gradeLevel.toLowerCase().includes('2') ? '1-2' : '3-4';
  }

  // Validation: ensure maxPlace
  const validPlaces = ['tens', 'hundreds', 'thousands'];
  if (!validPlaces.includes(data.maxPlace)) {
    data.maxPlace = data.gradeBand === '1-2' ? 'tens' : 'hundreds';
  }

  // Grades 1-2 should not exceed tens
  if (data.gradeBand === '1-2' && data.maxPlace !== 'tens') {
    data.maxPlace = 'tens';
  }

  // Ensure operands are positive numbers
  if (typeof data.operand1 !== 'number' || data.operand1 <= 0) data.operand1 = 27;
  if (typeof data.operand2 !== 'number' || data.operand2 <= 0) data.operand2 = 45;

  // For subtraction, ensure operand1 > operand2
  if (data.operation === 'subtraction' && data.operand1 <= data.operand2) {
    const temp = data.operand1;
    data.operand1 = data.operand2;
    data.operand2 = temp;
  }

  // Ensure challenges
  const validChallengeTypes = ['extend', 'identify_core', 'create', 'translate', 'find_rule'];
  data.challenges = (data.challenges || []).filter(
    (c: { problem: string }) => c.problem && c.problem.length > 0
  );

  if (data.challenges.length === 0) {
    const op = data.operation === 'addition' ? '+' : '-';
    data.challenges = [{
      id: 'c1',
      problem: `${data.operand1} ${op} ${data.operand2}`,
      requiresRegrouping: true,
      regroupCount: 1,
      hint: data.operation === 'addition'
        ? 'Add the ones first. If you get more than 9, trade 10 ones for 1 ten!'
        : 'If you can\'t subtract the ones, borrow 1 ten to get 10 more ones.',
      narration: data.operation === 'addition'
        ? `Let's add ${data.operand1} and ${data.operand2}! Start with the ones column.`
        : `Let's subtract ${data.operand2} from ${data.operand1}! Start with the ones column.`,
    }];
  }

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showAlgorithm: true,
      showCarryBorrow: true,
      showPlaceColumns: true,
      animateRegrouping: true,
      stepByStepMode: data.gradeBand === '1-2',
    };
  }

  // Ensure wordProblemContext
  if (!data.wordProblemContext) {
    data.wordProblemContext = { enabled: false };
  }

  // Apply config overrides
  if (config) {
    if (config.operation !== undefined) data.operation = config.operation;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.maxPlace !== undefined) data.maxPlace = config.maxPlace;
  }

  return data;
};
