# Matrix Display Multi-Stage Generation Architecture

## Problem Statement

The current single-LLM-call approach for matrix generation is brittle:
- ~500 line prompts trying to generate everything at once
- Missing required fields (e.g., `secondMatrix` for binary operations)
- Malformed `operationSteps` with incomplete highlighting
- LLM cognitive overload leads to inconsistent output

**Example of current failure**: Determinant operation missing step numbers, malformed result matrices, incomplete highlighting (see screenshot).

## Solution: Multi-Stage Pipeline

Break matrix generation into 3 focused stages, each with a single responsibility.

---

## Stage 1: Core Matrix Generation

### Responsibility
Generate **only** the matrix values and basic metadata. No operation steps.

### LLM Call
```typescript
generateCoreMatrix(topic: string, gradeLevel: string, config: {
  operation: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply';
  rows?: number;
  columns?: number;
}): Promise<CoreMatrixData>
```

### Simplified Schema
```typescript
interface CoreMatrixData {
  title: string;
  description: string;
  rows: number;
  columns: number;
  values: number[][];
  operationType: 'determinant' | 'inverse' | 'transpose' | 'add' | 'subtract' | 'multiply';
  educationalContext?: string;

  // ONLY for binary operations (add, subtract, multiply)
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label: string; // e.g., "Matrix B"
  };
}
```

### Prompt Strategy
- **Focus**: Choose appropriate numbers for the grade level and operation
- **Constraints**:
  - For determinant: Use integers that result in clean determinant values
  - For multiply: Ensure dimensions are compatible (A.cols = B.rows)
  - For add/subtract: Ensure same dimensions
  - Avoid zero determinants unless demonstrating singular matrices
- **Length**: ~100 lines instead of 500

### Validation (Code-based)
```typescript
function validateCoreMatrix(data: CoreMatrixData): CoreMatrixData {
  // Ensure dimensions match values
  if (data.values.length !== data.rows) {
    data.rows = data.values.length;
  }

  // For binary operations, secondMatrix is REQUIRED
  if (['add', 'subtract', 'multiply'].includes(data.operationType)) {
    if (!data.secondMatrix) {
      throw new Error(`${data.operationType} requires secondMatrix`);
    }

    // Validate dimensions
    if (data.operationType === 'multiply') {
      if (data.columns !== data.secondMatrix.rows) {
        throw new Error('Matrix multiplication dimension mismatch');
      }
    } else { // add/subtract
      if (data.rows !== data.secondMatrix.rows || data.columns !== data.secondMatrix.columns) {
        throw new Error('Matrix addition/subtraction requires same dimensions');
      }
    }
  }

  // For unary operations, secondMatrix should NOT exist
  if (['determinant', 'inverse', 'transpose'].includes(data.operationType)) {
    if (data.secondMatrix) {
      delete data.secondMatrix;
    }
  }

  return data;
}
```

---

## Stage 2: Operation-Specific Step Generation

### Responsibility
Generate **only** the step-by-step breakdown for the specific operation. Focused, single-purpose LLM calls.

### Approach
Create separate functions for each operation type:

#### 2a. Determinant Steps
```typescript
generateDeterminantSteps(
  matrix: number[][],
  gradeLevel: string
): Promise<OperationStepsData>
```

**Prompt Focus**:
- Input: Known matrix values
- Output: Step-by-step calculation with highlighting
- For 2×2: 5 steps (formula, identify elements, calculate ad, calculate bc, subtract)
- For 3×3: Cofactor expansion with 5-7 steps

**Schema**:
```typescript
interface OperationStepsData {
  operationSteps: {
    stepNumber: number;
    description: string;
    explanation?: string; // Optional educational detail
    formula?: string;
    highlightCells?: { row: number; col: number; color?: string; label?: string }[];
    resultMatrix?: number[][]; // For intermediate results
    animation?: 'fade-in' | 'highlight' | 'swap' | 'multiply' | 'add';
  }[];

  resultMatrix?: {
    label: string;
    values: number[][];
    explanation?: string;
  };

  // Determinant-specific
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
}
```

**Example Prompt** (for determinant):
```typescript
const prompt = `
Given the matrix:
${JSON.stringify(matrix)}

Generate a step-by-step determinant calculation for ${gradeLevel} students.

For a 2×2 matrix [[a,b],[c,d]], follow this structure:
1. State the formula: det(A) = ad - bc
2. Identify elements: a=${matrix[0][0]}, b=${matrix[0][1]}, c=${matrix[1][0]}, d=${matrix[1][1]}
3. Calculate ad with highlighting on (0,0) and (1,1)
4. Calculate bc with highlighting on (0,1) and (1,0)
5. Subtract to get final determinant

For each step, provide:
- stepNumber: Sequential number
- description: What we're doing (student-friendly)
- explanation: Why we're doing it (educational context)
- formula: Mathematical notation
- highlightCells: Which cells to highlight (with labels like "a", "d")
- resultMatrix: Not needed for determinant steps

Return ONLY the operation steps structure.
`;
```

#### 2b. Matrix Multiplication Steps
```typescript
generateMultiplicationSteps(
  matrixA: number[][],
  matrixB: number[][],
  gradeLevel: string
): Promise<OperationStepsData>
```

**Prompt Focus**:
- Input: Two known matrices
- Output: Step-by-step showing row×column calculations
- Highlight which row of A and column of B are being multiplied
- Show intermediate calculations for each result cell

**Example**:
```typescript
Step 1: Calculate result[0][0] = row 1 of A · column 1 of B
  - Highlight: matrixA cells (0,0), (0,1) and matrixB cells (0,0), (1,0)
  - Formula: "1×5 + 2×7 = 5 + 14 = 19"
  - Result cell: (0,0) = 19
```

#### 2c. Addition/Subtraction Steps
```typescript
generateArithmeticSteps(
  matrixA: number[][],
  matrixB: number[][],
  operation: 'add' | 'subtract',
  gradeLevel: string
): Promise<OperationStepsData>
```

**Prompt Focus**:
- Input: Two matrices and operation type
- Output: Element-wise operation steps
- Show 2-3 example cells, then final result matrix

#### 2d. Transpose Steps
```typescript
generateTransposeSteps(
  matrix: number[][],
  gradeLevel: string
): Promise<OperationStepsData>
```

**Prompt Focus**:
- Input: Original matrix
- Output: Show how rows become columns
- Highlight corresponding elements (e.g., (0,2) → (2,0))

#### 2e. Inverse Steps
```typescript
generateInverseSteps(
  matrix: number[][],
  gradeLevel: string
): Promise<OperationStepsData>
```

**Prompt Focus**:
- For 2×2: Use adjugate formula
- For 3×3: Use Gaussian elimination on [A|I]
- Show row operations step-by-step

### Validation (Code-based)
```typescript
function validateOperationSteps(
  steps: OperationStepsData,
  operationType: string
): OperationStepsData {
  // Ensure step numbers are sequential
  steps.operationSteps = steps.operationSteps.map((step, index) => ({
    ...step,
    stepNumber: index + 1
  }));

  // Ensure required fields exist
  steps.operationSteps.forEach(step => {
    if (!step.description) {
      throw new Error(`Step ${step.stepNumber} missing description`);
    }
  });

  // Operation-specific validation
  if (operationType === 'determinant') {
    if (!steps.determinantVisualization) {
      steps.determinantVisualization = { show: true };
    }
  }

  return steps;
}
```

---

## Stage 3: Assembly & Final Validation

### Responsibility
Combine Stage 1 (core matrix) + Stage 2 (operation steps) into final `MatrixDisplayData`. No LLM call.

### Implementation
```typescript
async function generateMatrix(
  topic: string,
  gradeLevel: string,
  config?: {
    rows?: number;
    columns?: number;
    operation?: 'determinant' | 'inverse' | 'transpose' | 'multiply' | 'add' | 'subtract';
    showSteps?: boolean;
  }
): Promise<MatrixDisplayData> {
  // STAGE 1: Generate core matrix
  const coreMatrix = await generateCoreMatrix(topic, gradeLevel, {
    operation: config?.operation || 'determinant',
    rows: config?.rows,
    columns: config?.columns
  });

  // Validate core matrix
  const validatedCore = validateCoreMatrix(coreMatrix);

  // STAGE 2: Generate operation steps (if requested)
  let operationStepsData: OperationStepsData | null = null;

  if (config?.showSteps !== false) { // Default to showing steps
    switch (validatedCore.operationType) {
      case 'determinant':
        operationStepsData = await generateDeterminantSteps(
          validatedCore.values,
          gradeLevel
        );
        break;

      case 'multiply':
        if (!validatedCore.secondMatrix) {
          throw new Error('Multiplication requires secondMatrix');
        }
        operationStepsData = await generateMultiplicationSteps(
          validatedCore.values,
          validatedCore.secondMatrix.values,
          gradeLevel
        );
        break;

      case 'add':
      case 'subtract':
        if (!validatedCore.secondMatrix) {
          throw new Error(`${validatedCore.operationType} requires secondMatrix`);
        }
        operationStepsData = await generateArithmeticSteps(
          validatedCore.values,
          validatedCore.secondMatrix.values,
          validatedCore.operationType,
          gradeLevel
        );
        break;

      case 'transpose':
        operationStepsData = await generateTransposeSteps(
          validatedCore.values,
          gradeLevel
        );
        break;

      case 'inverse':
        operationStepsData = await generateInverseSteps(
          validatedCore.values,
          gradeLevel
        );
        break;
    }

    // Validate operation steps
    if (operationStepsData) {
      operationStepsData = validateOperationSteps(
        operationStepsData,
        validatedCore.operationType
      );
    }
  }

  // STAGE 3: Assemble final result
  const finalData: MatrixDisplayData = {
    ...validatedCore,
    editable: config?.editable ?? false,
    showSteps: !!operationStepsData,
    showOperations: generateAvailableOperations(validatedCore.operationType),
    ...operationStepsData, // Spread operation steps, resultMatrix, determinantVisualization, etc.
  };

  // Final validation
  return validateFinalMatrix(finalData);
}

function generateAvailableOperations(currentOperation: string): MatrixOperation[] {
  // Generate operation buttons based on matrix type
  const operations: MatrixOperation[] = [
    {
      type: 'determinant',
      label: 'Calculate Determinant',
      description: 'Find the determinant of the matrix'
    }
  ];

  // Add more based on matrix properties
  return operations;
}

function validateFinalMatrix(data: MatrixDisplayData): MatrixDisplayData {
  // Final sanity checks
  if (data.showSteps && (!data.operationSteps || data.operationSteps.length === 0)) {
    console.warn('showSteps is true but no operationSteps provided');
    data.showSteps = false;
  }

  // Ensure defaults
  if (data.highlightCells === undefined) data.highlightCells = [];
  if (data.showOperations === undefined) data.showOperations = [];
  if (data.augmented === undefined) data.augmented = false;

  return data;
}
```

---

## Benefits of Multi-Stage Approach

### 1. **Reduced LLM Cognitive Load**
- Each prompt is ~100 lines instead of 500
- Single responsibility per LLM call
- Focused schema reduces hallucinations

### 2. **Stronger Validation**
- Validate after each stage
- Catch missing fields early (e.g., secondMatrix for binary ops)
- Code-based validation is deterministic

### 3. **Better Debugging**
- Can log output from each stage
- Easy to identify which stage failed
- Can re-run individual stages

### 4. **Flexibility**
- Can skip steps if `showSteps: false`
- Can swap in different step generators (e.g., different methods for inverse)
- Easy to add new operation types

### 5. **Consistent Output**
- Validation ensures required fields are present
- Sequential step numbering enforced by code
- Default values applied consistently

---

## Migration Path

### Phase 1: Implement New Functions (Parallel to Old)
1. Create `generateCoreMatrix()` function
2. Create `generateDeterminantSteps()` function
3. Test in isolation with known inputs

### Phase 2: Wire Up Multi-Stage Pipeline
1. Create main `generateMatrix()` orchestrator
2. Add validation functions
3. Test end-to-end

### Phase 3: Switch Over
1. Update `gemini-matrix.ts` to use new `generateMatrix()`
2. Keep old function as fallback initially
3. Monitor for errors

### Phase 4: Cleanup
1. Remove old single-call function
2. Remove unused schema definitions
3. Document new architecture

---

## Example: Determinant Generation Flow

### User Request
```typescript
generateMatrix("determinant of a 3×3 matrix", "Algebra 2", {
  operation: 'determinant',
  rows: 3,
  columns: 3,
  showSteps: true
});
```

### Stage 1: Core Matrix
**LLM Prompt**:
```
Create a 3×3 matrix appropriate for Algebra 2 students to practice determinant calculation.
Operation: determinant
Use integers that result in a clean determinant value (not zero, not too large).
```

**LLM Output**:
```json
{
  "title": "Finding the Determinant of a 3×3 Matrix",
  "description": "Learn how to calculate the determinant using cofactor expansion",
  "rows": 3,
  "columns": 3,
  "values": [[2, 1, 3], [4, 0, 1], [1, 2, 1]],
  "operationType": "determinant",
  "educationalContext": "The determinant is a scalar value that provides information about the matrix..."
}
```

**Validation**: ✅ Dimensions match, no secondMatrix (correct for unary op)

### Stage 2: Determinant Steps
**LLM Prompt**:
```
Given the 3×3 matrix:
[[2, 1, 3], [4, 0, 1], [1, 2, 1]]

Generate step-by-step determinant calculation using cofactor expansion along the first row.

For each term (a₁₁, a₁₂, a₁₃), show:
1. Which elements are being multiplied
2. The 2×2 minor matrix
3. The calculation
4. Which cells to highlight

Return 5-7 steps with proper highlighting.
```

**LLM Output**:
```json
{
  "operationSteps": [
    {
      "stepNumber": 1,
      "description": "Use cofactor expansion along the first row",
      "formula": "det(A) = a₁₁C₁₁ - a₁₂C₁₂ + a₁₃C₁₃",
      "explanation": "We expand along the first row using alternating signs"
    },
    {
      "stepNumber": 2,
      "description": "Calculate first term: 2 × det([[0,1],[2,1]])",
      "formula": "2 × (0×1 - 1×2) = 2 × (-2) = -4",
      "highlightCells": [
        {"row": 0, "col": 0, "color": "#3b82f6", "label": "a₁₁"}
      ]
    },
    // ... more steps
  ],
  "resultMatrix": {
    "label": "Determinant Value",
    "values": [[6]], // Final determinant
    "explanation": "The determinant is 6, which means the matrix is invertible"
  },
  "determinantVisualization": {
    "show": true,
    "steps": [
      {
        "stepNumber": 1,
        "description": "Cofactor expansion formula",
        "formula": "det(A) = a₁₁C₁₁ - a₁₂C₁₂ + a₁₃C₁₃",
        "calculation": "",
        "result": 0
      }
      // ... more visualization steps
    ]
  }
}
```

**Validation**: ✅ All steps have sequential numbers, required fields present

### Stage 3: Assembly
```json
{
  "title": "Finding the Determinant of a 3×3 Matrix",
  "description": "Learn how to calculate the determinant using cofactor expansion",
  "rows": 3,
  "columns": 3,
  "values": [[2, 1, 3], [4, 0, 1], [1, 2, 1]],
  "operationType": "determinant",
  "educationalContext": "...",
  "editable": false,
  "showSteps": true,
  "showOperations": [
    {"type": "determinant", "label": "Calculate Determinant", "description": "..."}
  ],
  "highlightCells": [],
  "augmented": false,
  "operationSteps": [...], // From stage 2
  "resultMatrix": {...}, // From stage 2
  "determinantVisualization": {...} // From stage 2
}
```

**Final Validation**: ✅ All required fields present, ready to render

---

## File Structure

```
service/math/
├── gemini-matrix.ts              # Main orchestrator (generateMatrix)
├── gemini-matrix-core.ts         # Stage 1: Core matrix generation
├── gemini-matrix-determinant.ts  # Stage 2a: Determinant steps
├── gemini-matrix-multiply.ts     # Stage 2b: Multiplication steps
├── gemini-matrix-arithmetic.ts   # Stage 2c: Add/subtract steps
├── gemini-matrix-transpose.ts    # Stage 2d: Transpose steps
├── gemini-matrix-inverse.ts      # Stage 2e: Inverse steps
└── gemini-matrix-validation.ts   # Validation utilities
```

---

## Prompt Engineering Best Practices

### For Core Matrix Generation
- **Be specific about number ranges**: "Use integers from 1-9 for Grade 7"
- **Specify desired properties**: "determinant should not be zero", "use small integers"
- **Keep schema minimal**: Only fields needed for this stage

### For Step Generation
- **Provide concrete values**: Don't ask LLM to generate values again, pass them in
- **Show examples**: Include example step structure in prompt
- **Enforce structure**: Use numbered lists, clear formatting
- **Limit cognitive load**: Max 5-7 steps for complex operations

### For All Stages
- **Use JSON schema**: Enforce structure via `responseSchema`
- **Validate immediately**: Don't pass invalid data to next stage
- **Log intermediate results**: Makes debugging easier

---

## Testing Strategy

### Unit Tests
```typescript
describe('Matrix Generation - Stage 1', () => {
  it('should generate valid 2×2 matrix', async () => {
    const result = await generateCoreMatrix("determinant", "Algebra 2", {
      operation: 'determinant',
      rows: 2,
      columns: 2
    });

    expect(result.rows).toBe(2);
    expect(result.columns).toBe(2);
    expect(result.values).toHaveLength(2);
    expect(result.values[0]).toHaveLength(2);
    expect(result.secondMatrix).toBeUndefined(); // Unary operation
  });

  it('should require secondMatrix for multiplication', async () => {
    const result = await generateCoreMatrix("matrix multiplication", "Precalculus", {
      operation: 'multiply',
      rows: 2,
      columns: 2
    });

    expect(result.secondMatrix).toBeDefined();
    expect(result.secondMatrix!.rows).toBe(2); // A.cols must match B.rows
  });
});

describe('Matrix Generation - Stage 2', () => {
  it('should generate determinant steps for 2×2 matrix', async () => {
    const matrix = [[2, 1], [3, 4]];
    const result = await generateDeterminantSteps(matrix, "Algebra 2");

    expect(result.operationSteps).toHaveLength(5); // Expected number of steps
    expect(result.determinantVisualization).toBeDefined();
    expect(result.determinantVisualization!.show).toBe(true);

    // Check step structure
    result.operationSteps.forEach((step, index) => {
      expect(step.stepNumber).toBe(index + 1);
      expect(step.description).toBeTruthy();
    });
  });
});

describe('Matrix Generation - Stage 3', () => {
  it('should assemble complete MatrixDisplayData', async () => {
    const result = await generateMatrix("determinant", "Algebra 2", {
      operation: 'determinant',
      rows: 2,
      columns: 2,
      showSteps: true
    });

    // Check all required fields
    expect(result.title).toBeTruthy();
    expect(result.values).toBeDefined();
    expect(result.operationSteps).toBeDefined();
    expect(result.showSteps).toBe(true);

    // Check validation
    expect(result.editable).toBe(false); // Default
    expect(result.highlightCells).toEqual([]); // Default
  });
});
```

---

## Error Handling

### Stage 1 Errors
```typescript
try {
  const coreMatrix = await generateCoreMatrix(topic, gradeLevel, config);
} catch (error) {
  console.error('Stage 1 (Core Matrix) failed:', error);
  // Fallback: Use default matrix values
  return createDefaultMatrix(config);
}
```

### Stage 2 Errors
```typescript
try {
  const steps = await generateDeterminantSteps(matrix, gradeLevel);
} catch (error) {
  console.error('Stage 2 (Steps) failed:', error);
  // Fallback: Return matrix without steps
  return {
    ...coreMatrix,
    showSteps: false,
    operationSteps: []
  };
}
```

### Validation Errors
```typescript
function validateCoreMatrix(data: CoreMatrixData): CoreMatrixData {
  try {
    // Validation logic
  } catch (error) {
    console.error('Validation failed:', error);
    // Fix common issues
    if (data.values.length !== data.rows) {
      console.warn('Fixing row count mismatch');
      data.rows = data.values.length;
    }
    return data;
  }
}
```

---

## Monitoring & Logging

### Log Each Stage
```typescript
console.log('[Matrix Gen] Stage 1 START:', { topic, gradeLevel, config });
const coreMatrix = await generateCoreMatrix(topic, gradeLevel, config);
console.log('[Matrix Gen] Stage 1 COMPLETE:', { rows: coreMatrix.rows, operationType: coreMatrix.operationType });

console.log('[Matrix Gen] Stage 2 START:', { operationType: coreMatrix.operationType });
const steps = await generateDeterminantSteps(coreMatrix.values, gradeLevel);
console.log('[Matrix Gen] Stage 2 COMPLETE:', { stepCount: steps.operationSteps.length });
```

### Track Success Rate
```typescript
const metrics = {
  stage1Success: 0,
  stage1Failures: 0,
  stage2Success: 0,
  stage2Failures: 0,
  validationFixes: 0
};

// Increment metrics at each stage
// Log summary periodically
```

---

## Conclusion

The multi-stage approach:
- ✅ Reduces LLM cognitive load (shorter, focused prompts)
- ✅ Enforces required fields via code validation
- ✅ Produces consistent, well-formed output
- ✅ Easier to debug and maintain
- ✅ More flexible (can skip/swap stages)

This architecture is more **robust** (validation catches errors), more **maintainable** (clear separation of concerns), and more **scalable** (easy to add new operation types).
