import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

/**
 * Matrix Display Data Interface
 *
 * This matches the MatrixDisplayData interface in the component
 */
export interface MatrixOperation {
  type: 'determinant' | 'inverse' | 'transpose' | 'multiply' | 'add' | 'subtract' | 'rowOperation';
  label: string;
  description?: string;
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  rows: number;
  columns: number;
  values: number[][];
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label?: string;
  };
  operationType?: 'add' | 'subtract' | 'multiply' | 'determinant' | 'transpose' | 'inverse';
  editable?: boolean;
  showOperations?: MatrixOperation[];
  augmented?: boolean;
  highlightCells?: { row: number; col: number; color?: string; label?: string }[];
  resultMatrix?: {
    label: string;
    values: number[][];
    explanation?: string;
  };
  educationalContext?: string;
  determinantVisualization?: {
    show: boolean;
    steps?: {
      stepNumber: number;
      description: string;
      formula: string;
      calculation: string;
      result: number;
    }[];
  };
  inverseVisualization?: {
    show: boolean;
    method: 'adjugate' | 'gaussian' | 'cofactor';
    steps?: {
      stepNumber: number;
      description: string;
      intermediateMatrix?: number[][];
      explanation: string;
    }[];
  };
  multiplicationVisualization?: {
    show: boolean;
    steps?: {
      stepNumber: number;
      resultRow: number;
      resultCol: number;
      description: string;
      calculation: string;
      result: number;
    }[];
  };
}

/**
 * Core Matrix Data (Stage 1 Output)
 */
interface CoreMatrixData {
  title: string;
  description: string;
  rows: number;
  columns: number;
  values: number[][];
  operationType: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply';
  educationalContext?: string;
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label: string;
  };
}

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  transpose: {
    promptDoc:
      `"transpose": Swap rows and columns of the matrix. `
      + `The simplest operation — row i becomes column i. `
      + `Good for introducing matrix operations. Use 2×3 or 3×2 matrices so the shape change is visible.`,
    schemaDescription: "'transpose' (swap rows and columns)",
  },
  add: {
    promptDoc:
      `"add": Add two matrices element-by-element. `
      + `Both matrices MUST have the same dimensions. `
      + `MUST include secondMatrix field. Use simple integers.`,
    schemaDescription: "'add' (element-wise addition)",
  },
  subtract: {
    promptDoc:
      `"subtract": Subtract two matrices element-by-element. `
      + `Both matrices MUST have the same dimensions. `
      + `MUST include secondMatrix field. Can result in negative values.`,
    schemaDescription: "'subtract' (element-wise subtraction)",
  },
  multiply: {
    promptDoc:
      `"multiply": Multiply two matrices using row-by-column dot products. `
      + `Matrix A columns MUST equal Matrix B rows. `
      + `MUST include secondMatrix field. Use small integers to keep calculations manageable. `
      + `Typical: 2×2 × 2×2 or 2×3 × 3×2.`,
    schemaDescription: "'multiply' (matrix multiplication)",
  },
  determinant: {
    promptDoc:
      `"determinant": Calculate the determinant of a square matrix. `
      + `Matrix MUST be square (rows = columns). `
      + `DO NOT include secondMatrix. Use integers that produce clean determinant values (not zero unless teaching singular matrices). `
      + `2×2: det = ad - bc. 3×3: cofactor expansion.`,
    schemaDescription: "'determinant' (calculate determinant)",
  },
  inverse: {
    promptDoc:
      `"inverse": Find the inverse of a square matrix. `
      + `Matrix MUST be square with non-zero determinant. `
      + `DO NOT include secondMatrix. Use integers that produce a clean inverse (e.g., det = ±1, ±2). `
      + `2×2: use adjugate method. 3×3: Gaussian elimination.`,
    schemaDescription: "'inverse' (find inverse matrix)",
  },
};

// ============================================================================
// STAGE 1: Core Matrix Generation
// ============================================================================

const coreMatrixSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the matrix operation"
    },
    description: {
      type: Type.STRING,
      description: "Educational description"
    },
    rows: {
      type: Type.NUMBER,
      description: "Number of rows in the matrix"
    },
    columns: {
      type: Type.NUMBER,
      description: "Number of columns in the matrix"
    },
    values: {
      type: Type.ARRAY,
      description: "2D array of matrix values (Matrix A for binary operations)",
      items: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER }
      }
    },
    operationType: {
      type: Type.STRING,
      enum: ["determinant", "inverse", "transpose", "add", "subtract", "multiply"],
      description: "Operation type: 'determinant', 'inverse', 'transpose', 'add', 'subtract', 'multiply'"
    },
    educationalContext: {
      type: Type.STRING,
      description: "Educational context about matrices"
    },
    secondMatrix: {
      type: Type.OBJECT,
      description: "ONLY for binary operations (add, subtract, multiply). Do NOT include for determinant, inverse, or transpose.",
      properties: {
        rows: { type: Type.NUMBER },
        columns: { type: Type.NUMBER },
        values: {
          type: Type.ARRAY,
          items: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER }
          }
        },
        label: { type: Type.STRING, description: "e.g., 'Matrix B'" }
      },
      required: ["rows", "columns", "values", "label"]
    }
  },
  required: ["title", "description", "rows", "columns", "values", "operationType"]
};

async function generateCoreMatrix(
  topic: string,
  gradeLevel: string,
  config: {
    operation: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply';
    rows?: number;
    columns?: number;
  },
  activeSchema: Schema,
  challengeTypeSection: string,
): Promise<CoreMatrixData> {
  const { operation } = config;
  const isBinaryOp = ['add', 'subtract', 'multiply'].includes(operation);

  const prompt = `
Create a matrix for teaching "${topic}" to ${gradeLevel} students.

OPERATION: ${operation}

${challengeTypeSection}

CRITICAL REQUIREMENTS:
${isBinaryOp ? `
- This is a BINARY operation (${operation}), so you MUST include a "secondMatrix" field
- For ${operation === 'multiply' ? 'multiplication: Matrix A columns MUST equal Matrix B rows' : 'addition/subtraction: Both matrices MUST have the same dimensions'}
` : `
- This is a UNARY operation (${operation}), so DO NOT include a "secondMatrix" field
`}

GRADE LEVEL GUIDELINES:
- Grade 7-8: Use single-digit integers (1-9), 2×2 or 2×3 matrices
- Algebra 2: Use integers from -10 to 10, 2×2 or 3×3 matrices
- Precalculus: Any integers, 2×2 to 4×4 matrices
- Advanced: Any real numbers, any size

NUMBER SELECTION:
- For determinant: Use integers that result in clean determinant values (not zero unless demonstrating singular matrices)
- For multiply: Ensure dimensions are compatible (A.columns = B.rows)
- For add/subtract: Ensure same dimensions
- Choose numbers that make calculations educational but not tedious

${config.rows ? `Required rows: ${config.rows}` : ''}
${config.columns ? `Required columns: ${config.columns}` : ''}

Return ONLY the core matrix data with appropriate values for the grade level.
`;

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
    throw new Error('No valid core matrix data returned from Gemini API');
  }

  return validateCoreMatrix(data);
}

function validateCoreMatrix(data: CoreMatrixData): CoreMatrixData {
  console.log('[Matrix Gen] Stage 1 - Validating core matrix:', { operationType: data.operationType, rows: data.rows, columns: data.columns });

  // Ensure dimensions match values
  if (data.values.length !== data.rows) {
    console.warn(`Matrix rows mismatch. Expected ${data.rows}, got ${data.values.length}`);
    data.rows = data.values.length;
  }

  if (data.values[0] && data.values[0].length !== data.columns) {
    console.warn(`Matrix columns mismatch. Expected ${data.columns}, got ${data.values[0].length}`);
    data.columns = data.values[0].length;
  }

  // For binary operations, secondMatrix is REQUIRED
  if (['add', 'subtract', 'multiply'].includes(data.operationType)) {
    if (!data.secondMatrix) {
      throw new Error(`${data.operationType} requires secondMatrix, but it was not provided`);
    }

    // Validate dimensions
    if (data.operationType === 'multiply') {
      if (data.columns !== data.secondMatrix.rows) {
        throw new Error(`Matrix multiplication dimension mismatch: A is ${data.rows}×${data.columns}, B is ${data.secondMatrix.rows}×${data.secondMatrix.columns}. A.columns must equal B.rows.`);
      }
    } else { // add/subtract
      if (data.rows !== data.secondMatrix.rows || data.columns !== data.secondMatrix.columns) {
        throw new Error(`Matrix ${data.operationType} requires same dimensions. A is ${data.rows}×${data.columns}, B is ${data.secondMatrix.rows}×${data.secondMatrix.columns}.`);
      }
    }

    console.log('[Matrix Gen] Stage 1 - Binary operation validated:', {
      matrixA: `${data.rows}×${data.columns}`,
      matrixB: `${data.secondMatrix.rows}×${data.secondMatrix.columns}`
    });
  }

  // For unary operations, secondMatrix should NOT exist
  if (['determinant', 'inverse', 'transpose'].includes(data.operationType)) {
    if (data.secondMatrix) {
      console.warn(`Unary operation ${data.operationType} should not have secondMatrix. Removing it.`);
      delete data.secondMatrix;
    }
  }

  return data;
}


// ============================================================================
// STAGE 3: Assembly & Final Validation
// ============================================================================

function generateAvailableOperations(currentOperation: string): MatrixOperation[] {
  const operations: MatrixOperation[] = [];

  // For binary operations (multiply, add, subtract), don't show additional operations
  // as they already have the operation displayed
  if (['multiply', 'add', 'subtract'].includes(currentOperation)) {
    return operations;
  }

  // For unary operations, show related operations
  const allOperations: MatrixOperation[] = [
    {
      type: 'determinant',
      label: 'Calculate Determinant',
      description: 'Find the determinant of the matrix'
    },
    {
      type: 'transpose',
      label: 'Transpose Matrix',
      description: 'Swap rows and columns'
    },
    {
      type: 'inverse',
      label: 'Find Inverse',
      description: 'Calculate the inverse matrix'
    }
  ];

  // Filter out the current operation and return the rest
  return allOperations.filter(op => op.type !== currentOperation);
}

function validateFinalMatrix(data: MatrixDisplayData): MatrixDisplayData {
  console.log('[Matrix Gen] Final validation');

  // Ensure defaults
  if (data.highlightCells === undefined) data.highlightCells = [];
  if (data.showOperations === undefined) data.showOperations = [];
  if (data.augmented === undefined) data.augmented = false;

  console.log('[Matrix Gen] Assembly complete:', {
    title: data.title,
    operationType: data.operationType,
    hasSecondMatrix: !!data.secondMatrix,
    hasResult: !!data.resultMatrix
  });

  return data;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Infer the operation type from the topic name
 */
function inferOperationFromTopic(topic: string): 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply' {
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('multipl') || topicLower.includes('product')) return 'multiply';
  if (topicLower.includes('add') || topicLower.includes('sum')) return 'add';
  if (topicLower.includes('subtract') || topicLower.includes('difference')) return 'subtract';
  if (topicLower.includes('transpose')) return 'transpose';
  if (topicLower.includes('inverse')) return 'inverse';
  if (topicLower.includes('determinant')) return 'determinant';

  return 'determinant';
}

/**
 * Generate matrix display data
 *
 * Generates the core matrix with appropriate operations available.
 * The component itself handles determinant and transpose visualizations.
 */
export const generateMatrix = async (
  topic: string,
  gradeLevel: string,
  config?: {
    rows?: number;
    columns?: number;
    operation?: 'determinant' | 'inverse' | 'transpose' | 'multiply' | 'add' | 'subtract' | 'rowOperation' | 'solve';
    augmented?: boolean;
    editable?: boolean;
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<MatrixDisplayData> => {
  console.log('[Matrix Gen] Starting generation:', { topic, gradeLevel, config });

  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'matrix-display',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('Matrix', config?.targetEvalMode, evalConstraint);

  // Constrain schema when eval mode is active (operationType is at root level)
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(coreMatrixSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'operationType',
        rootLevel: true,
      })
    : coreMatrixSchema;

  // Build challenge type prompt section
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  try {
    // Determine operation: eval mode constraint > explicit config > topic inference
    let operation: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply';

    if (evalConstraint) {
      // Pick the first allowed type from the eval constraint
      operation = evalConstraint.allowedTypes[0] as typeof operation;
      console.log(`[Matrix Gen] Eval mode constraining operation to '${operation}'`);
    } else {
      const inferredOperation = inferOperationFromTopic(topic);
      const configOp = config?.operation;
      operation = (configOp && configOp !== 'solve' && configOp !== 'rowOperation')
        ? configOp as typeof operation
        : inferredOperation;

      if (!configOp) {
        console.log(`[Matrix Gen] No operation specified, inferred '${inferredOperation}' from topic: "${topic}"`);
      }
    }

    const coreMatrix = await generateCoreMatrix(topic, gradeLevel, {
      operation,
      rows: config?.rows,
      columns: config?.columns
    }, activeSchema, challengeTypeSection);

    console.log('[Matrix Gen] Core matrix generated:', {
      rows: coreMatrix.rows,
      columns: coreMatrix.columns,
      operationType: coreMatrix.operationType,
      hasSecondMatrix: !!coreMatrix.secondMatrix
    });

    // Assemble final result
    const finalData: MatrixDisplayData = {
      ...coreMatrix,
      editable: config?.editable ?? false,
      showOperations: generateAvailableOperations(coreMatrix.operationType),
      augmented: config?.augmented ?? false,
      highlightCells: [],
      // For determinant operations, enable the built-in visualization
      determinantVisualization: coreMatrix.operationType === 'determinant' ? { show: true } : undefined,
      // For multiplication operations, enable the built-in visualization
      multiplicationVisualization: coreMatrix.operationType === 'multiply' ? { show: true } : undefined,
    };

    // Final validation
    return validateFinalMatrix(finalData);

  } catch (error) {
    console.error('[Matrix Gen] Error in generation:', error);
    throw error;
  }
};
