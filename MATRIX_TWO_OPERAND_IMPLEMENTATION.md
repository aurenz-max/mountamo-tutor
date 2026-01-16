# Implementation Guide: Two-Matrix Display for Binary Operations

## Problem Statement
Currently, the MatrixDisplay component only shows a single matrix. For binary operations (addition, subtraction, multiplication), we need to display **two matrices side-by-side** (Matrix A and Matrix B) before showing the result.

## Current State
- The `values` field in `MatrixDisplayData` represents Matrix A (the first operand)
- Matrix B is only mentioned in text within `operationSteps[0].description`
- Users cannot see both matrices visually, making it confusing for educational purposes

## Recommended Solution

### Option 1: Add `secondMatrix` Field (Recommended)

#### 1.1 Update TypeScript Interfaces

**File:** `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/MatrixDisplay.tsx`
**File:** `my-tutoring-app/src/components/lumina/service/math/gemini-matrix.ts`

```typescript
export interface MatrixDisplayData {
  title: string;
  description: string;
  rows: number;
  columns: number;
  values: number[][]; // Matrix A (first operand)

  // NEW FIELD: Add second matrix for binary operations
  secondMatrix?: {
    rows: number;
    columns: number;
    values: number[][];
    label?: string; // e.g., "Matrix B"
  };

  // NEW FIELD: Operation type for display
  operationType?: 'add' | 'subtract' | 'multiply' | 'determinant' | 'transpose' | 'inverse';

  editable?: boolean;
  showOperations?: MatrixOperation[];
  augmented?: boolean;
  highlightCells?: { row: number; col: number; color?: string; label?: string }[];
  showSteps?: boolean;
  operationSteps?: {
    stepNumber: number;
    description: string;
    explanation?: string;
    resultMatrix?: number[][];
    highlightCells?: { row: number; col: number; color?: string; label?: string }[];
    // NEW: Support highlighting in both matrices
    highlightCellsA?: { row: number; col: number; color?: string; label?: string }[];
    highlightCellsB?: { row: number; col: number; color?: string; label?: string }[];
    formula?: string;
    animation?: 'fade-in' | 'highlight' | 'swap' | 'multiply' | 'add';
  }[];
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
}
```

#### 1.2 Update the MatrixDisplay Component Rendering

**File:** `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/MatrixDisplay.tsx`

Add this code after the "Main Matrix Display" section (around line 425):

```tsx
{/* Main Matrix Display */}
<div className="mb-10 flex justify-center">
  {/* Show two matrices side-by-side for binary operations */}
  {secondMatrix ? (
    <div className="flex items-center gap-6">
      {/* Matrix A */}
      <div className="flex flex-col items-center">
        <div className="text-sm font-mono text-purple-400 mb-3 font-semibold">Matrix A</div>
        {renderMatrix(matrixValues, rows, columns, editable, undefined, undefined, true)}
      </div>

      {/* Operation Symbol */}
      <div className="flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-purple-500/20 border-2 border-purple-500/40 flex items-center justify-center text-purple-300 text-2xl font-bold">
          {operationType === 'add' ? '+' : operationType === 'subtract' ? '−' : operationType === 'multiply' ? '×' : ''}
        </div>
      </div>

      {/* Matrix B */}
      <div className="flex flex-col items-center">
        <div className="text-sm font-mono text-blue-400 mb-3 font-semibold">
          {secondMatrix.label || 'Matrix B'}
        </div>
        {renderMatrix(
          secondMatrix.values,
          secondMatrix.rows,
          secondMatrix.columns,
          false,
          undefined,
          undefined,
          true
        )}
      </div>

      {/* Equals sign (if showing result) */}
      {resultMatrix && (
        <>
          <div className="flex items-center justify-center">
            <div className="text-3xl text-slate-400 font-bold">=</div>
          </div>

          {/* Result Matrix Preview (small) */}
          <div className="flex flex-col items-center opacity-50 hover:opacity-100 transition-opacity">
            <div className="text-sm font-mono text-green-400 mb-3 font-semibold">Result</div>
            {renderMatrix(
              resultMatrix.values,
              resultMatrix.values.length,
              resultMatrix.values[0]?.length || 0,
              false,
              undefined,
              undefined,
              false
            )}
          </div>
        </>
      )}
    </div>
  ) : (
    // Single matrix display (for unary operations)
    renderMatrix(matrixValues, rows, columns, editable, undefined, 'Original Matrix', true)
  )}
</div>
```

#### 1.3 Update Gemini Prompt

**File:** `my-tutoring-app/src/components/lumina/service/math/gemini-matrix.ts`

Update the schema to include `secondMatrix`:

```typescript
const matrixDisplaySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the matrix operation" },
    description: { type: Type.STRING, description: "Educational description" },
    rows: { type: Type.NUMBER, description: "Number of rows in Matrix A" },
    columns: { type: Type.NUMBER, description: "Number of columns in Matrix A" },
    values: {
      type: Type.ARRAY,
      description: "2D array of Matrix A values",
      items: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER }
      }
    },

    // NEW: Add secondMatrix to schema
    secondMatrix: {
      type: Type.OBJECT,
      description: "Second matrix for binary operations (addition, subtraction, multiplication)",
      properties: {
        rows: { type: Type.NUMBER, description: "Number of rows in Matrix B" },
        columns: { type: Type.NUMBER, description: "Number of columns in Matrix B" },
        values: {
          type: Type.ARRAY,
          description: "2D array of Matrix B values",
          items: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER }
          }
        },
        label: { type: Type.STRING, description: "Label for second matrix (default: 'Matrix B')" }
      },
      required: ["rows", "columns", "values"]
    },

    // NEW: Add operationType to schema
    operationType: {
      type: Type.STRING,
      description: "Type of operation: 'add', 'subtract', 'multiply', 'determinant', 'transpose', 'inverse'"
    },

    // ... rest of schema ...
  },
  required: ["title", "description", "rows", "columns", "values"]
};
```

Update the prompt section for binary operations:

```typescript
For **ADDITION/SUBTRACTION** (${config?.operation === 'add' || config?.operation === 'subtract' ? 'SELECTED' : ''}):
- CRITICAL: You MUST provide both matrices in the response
- Set "values" to Matrix A: [[a,b,c],[d,e,f]]
- Set "secondMatrix" object with Matrix B values:
  {
    "rows": 2,
    "columns": 3,
    "values": [[g,h,i],[j,k,l]],
    "label": "Matrix B"
  }
- Set "operationType" to either "add" or "subtract"
- The component will display both matrices side-by-side with the operation symbol (+, −) between them
- Create operationSteps showing element-by-element calculation
- Use resultMatrix field to show the final sum/difference
- Highlight corresponding cells in both matrices at each step using highlightCellsA and highlightCellsB

Example for 2×3 addition:
{
  "title": "Matrix Addition for Organizing Data",
  "description": "Learn how matrices are used to organize and combine sets of data...",
  "rows": 2,
  "columns": 3,
  "values": [[2,1,3],[4,5,7]],
  "secondMatrix": {
    "rows": 2,
    "columns": 3,
    "values": [[3,7,-2],[-2,5,-3]],
    "label": "Matrix B"
  },
  "operationType": "add",
  "showSteps": true,
  "operationSteps": [
    {
      "stepNumber": 1,
      "description": "We are adding two 2×3 matrices. Addition is only possible if both matrices have the exact same number of rows and columns.",
      "explanation": "We combine the data from the exact same positions in both data sets.",
      "formula": "A + B"
    },
    {
      "stepNumber": 2,
      "description": "Add the element in Row 1, Column 1 (5) from the first matrix to the corresponding element (3) in the second matrix.",
      "formula": "2 + 3 = 5",
      "highlightCellsA": [{"row": 0, "col": 0, "color": "#3b82f6", "label": "2"}],
      "highlightCellsB": [{"row": 0, "col": 0, "color": "#3b82f6", "label": "3"}],
      "resultMatrix": [[5,null,null],[null,null,null]]
    },
    // ... continue for each element ...
  ],
  "resultMatrix": {
    "label": "Sum A + B",
    "values": [[5,8,1],[2,10,4]],
    "explanation": "This is the result of adding the two matrices element by element."
  }
}

For **MULTIPLICATION** (${config?.operation === 'multiply' ? 'SELECTED' : ''}):
- CRITICAL: You MUST provide both matrices in the response
- Set "values" to Matrix A (m×n matrix)
- Set "secondMatrix" to Matrix B (n×p matrix) - note: columns of A must equal rows of B
- Set "operationType" to "multiply"
- Show row×column calculation for each result cell
- Use small matrices (2×2 or 2×3) for clarity
- Highlight the row from A and column from B being multiplied
```

#### 1.4 Update Gemini Response Validation

**File:** `my-tutoring-app/src/components/lumina/service/math/gemini-matrix.ts`

After the existing validation, add:

```typescript
// Validation: ensure secondMatrix is complete if provided
if (data.secondMatrix) {
  if (data.secondMatrix.values.length !== data.secondMatrix.rows) {
    console.warn(`Second matrix rows mismatch. Expected ${data.secondMatrix.rows}, got ${data.secondMatrix.values.length}`);
    data.secondMatrix.rows = data.secondMatrix.values.length;
  }

  if (data.secondMatrix.values[0] && data.secondMatrix.values[0].length !== data.secondMatrix.columns) {
    console.warn(`Second matrix columns mismatch. Expected ${data.secondMatrix.columns}, got ${data.secondMatrix.values[0].length}`);
    data.secondMatrix.columns = data.secondMatrix.values[0].length;
  }

  // Validation: ensure all rows have the same number of columns
  for (let i = 0; i < data.secondMatrix.values.length; i++) {
    if (data.secondMatrix.values[i].length !== data.secondMatrix.columns) {
      console.error(`Second matrix row ${i} has ${data.secondMatrix.values[i].length} columns, expected ${data.secondMatrix.columns}. Padding with zeros.`);
      while (data.secondMatrix.values[i].length < data.secondMatrix.columns) {
        data.secondMatrix.values[i].push(0);
      }
      if (data.secondMatrix.values[i].length > data.secondMatrix.columns) {
        data.secondMatrix.values[i] = data.secondMatrix.values[i].slice(0, data.secondMatrix.columns);
      }
    }
  }

  // Validation: Check dimension compatibility for operations
  if (data.operationType === 'add' || data.operationType === 'subtract') {
    if (data.rows !== data.secondMatrix.rows || data.columns !== data.secondMatrix.columns) {
      console.error(`Matrix dimensions incompatible for ${data.operationType}. A is ${data.rows}×${data.columns}, B is ${data.secondMatrix.rows}×${data.secondMatrix.columns}`);
    }
  }

  if (data.operationType === 'multiply') {
    if (data.columns !== data.secondMatrix.rows) {
      console.error(`Matrix dimensions incompatible for multiplication. A columns (${data.columns}) must equal B rows (${data.secondMatrix.rows})`);
    }
  }
}
```

#### 1.5 Update Component to Support Dual Highlighting

**File:** `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/MatrixDisplay.tsx`

Update the `renderMatrix` function signature to accept a matrix identifier:

```typescript
const renderMatrix = (
  matrixData: number[][],
  matrixRows: number,
  matrixCols: number,
  isEditable: boolean = false,
  stepIndex?: number,
  label?: string,
  showIndices: boolean = false,
  matrixId?: 'A' | 'B' | 'result' // NEW parameter
) => {
  // ... existing code ...

  // Update isCellHighlighted to check the right highlight array
  const isCellHighlightedInThisMatrix = (row: number, col: number) => {
    if (stepIndex !== undefined && operationSteps[stepIndex]) {
      const step = operationSteps[stepIndex];

      // Check which highlight array to use based on matrixId
      let cells = step.highlightCells;
      if (matrixId === 'A' && step.highlightCellsA) {
        cells = step.highlightCellsA;
      } else if (matrixId === 'B' && step.highlightCellsB) {
        cells = step.highlightCellsB;
      }

      return cells?.find(cell => cell.row === row && cell.col === col);
    }

    return highlightCells?.find(cell => cell.row === row && cell.col === col);
  };

  // Use isCellHighlightedInThisMatrix instead of isCellHighlighted
  // ... rest of rendering logic ...
};
```

---

## Option 2: Alternative Layout Approaches

### 2.1 Vertical Stack Layout
For mobile or narrow screens, stack matrices vertically:

```tsx
<div className="flex flex-col lg:flex-row items-center gap-6">
  {/* Matrix A */}
  <div>...</div>

  {/* Operation Symbol */}
  <div className="transform lg:rotate-0 rotate-90">+</div>

  {/* Matrix B */}
  <div>...</div>
</div>
```

### 2.2 Animated Transition
Show Matrix A first, then animate Matrix B sliding in:

```tsx
const [showSecondMatrix, setShowSecondMatrix] = useState(false);

useEffect(() => {
  if (secondMatrix) {
    const timer = setTimeout(() => setShowSecondMatrix(true), 500);
    return () => clearTimeout(timer);
  }
}, [secondMatrix]);

// In JSX:
<div className={`transition-all duration-500 ${showSecondMatrix ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
  {/* Matrix B */}
</div>
```

---

## Testing Checklist

- [ ] Addition: Two 2×2 matrices display side-by-side with + symbol
- [ ] Subtraction: Two 2×3 matrices display with − symbol
- [ ] Multiplication: 2×3 matrix A and 3×2 matrix B display correctly
- [ ] Determinant: Only shows single matrix (no secondMatrix)
- [ ] Transpose: Only shows single matrix
- [ ] Step highlighting works for both Matrix A and Matrix B cells simultaneously
- [ ] Mobile responsive: matrices stack vertically on small screens
- [ ] Result matrix shows correctly after operation steps
- [ ] Validation catches dimension mismatches for add/subtract
- [ ] Validation catches dimension mismatches for multiply

---

## Example API Response

For a 2×3 matrix addition problem, Gemini should return:

```json
{
  "title": "Matrix Addition for Organizing Data",
  "description": "Learn how matrices are used to organize and combine sets of data, like sports statistics. We will add two matrices of the same size together element by element.",
  "rows": 2,
  "columns": 3,
  "values": [[2, 1, 3], [4, 5, 7]],
  "secondMatrix": {
    "rows": 2,
    "columns": 3,
    "values": [[3, 7, -2], [-2, 5, -3]],
    "label": "Matrix B"
  },
  "operationType": "add",
  "showSteps": true,
  "operationSteps": [
    {
      "stepNumber": 1,
      "description": "We are adding two 2×3 matrices. Addition is only possible if both matrices have the exact same number of rows and columns.",
      "explanation": "We combine the data from the exact same positions in both data sets.",
      "formula": "A + B"
    },
    {
      "stepNumber": 2,
      "description": "Add element at Row 1, Column 1: 2 + 3 = 5",
      "formula": "a₁₁ + b₁₁ = 2 + 3 = 5",
      "highlightCellsA": [{"row": 0, "col": 0, "color": "#3b82f6"}],
      "highlightCellsB": [{"row": 0, "col": 0, "color": "#3b82f6"}]
    }
  ],
  "resultMatrix": {
    "label": "Sum: A + B",
    "values": [[5, 8, 1], [2, 10, 4]],
    "explanation": "This matrix contains the sum of corresponding elements from both matrices."
  },
  "educationalContext": "Matrix addition is used in many real-world applications like combining data sets, adding vectors in physics, and blending images in computer graphics."
}
```

---

## Implementation Priority

1. **Phase 1 (Essential)**: Add `secondMatrix` field to interface and schema
2. **Phase 2 (Essential)**: Update component to render two matrices side-by-side
3. **Phase 3 (Essential)**: Update Gemini prompt to generate both matrices
4. **Phase 4 (Important)**: Add validation for dimension compatibility
5. **Phase 5 (Nice-to-have)**: Add dual highlighting support (highlightCellsA/B)
6. **Phase 6 (Nice-to-have)**: Add animations and responsive layouts

---

## Questions?

If you have questions about this implementation, consider:
- Should we support more than 2 matrices (for expressions like A + B + C)?
- Should the operation symbol be clickable/interactive?
- Should we show intermediate steps in the visual display or only in the step-by-step panel?
- Do we want to support matrix operations in a "playground" mode where users can edit both matrices?

---

**Last Updated:** 2026-01-13
**Author:** Claude Code Assistant
