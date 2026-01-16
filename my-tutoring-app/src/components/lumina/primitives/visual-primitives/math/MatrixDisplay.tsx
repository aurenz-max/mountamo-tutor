'use client';

import React, { useState, useEffect } from 'react';

export interface MatrixOperation {
  type: 'determinant' | 'inverse' | 'transpose' | 'multiply' | 'add' | 'subtract' | 'rowOperation';
  label: string;
  description?: string;
}

export interface RowOperationStep {
  operation: 'swap' | 'multiply' | 'add';
  rowIndex?: number;
  targetRowIndex?: number;
  scalar?: number;
  description: string;
}

export interface MatrixDisplayData {
  title: string;
  description: string;
  rows: number;
  columns: number;
  values: number[][]; // For binary operations (add/subtract/multiply), this is Matrix A (the first operand)

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

interface MatrixDisplayProps {
  data: MatrixDisplayData;
  className?: string;
}

const MatrixDisplay: React.FC<MatrixDisplayProps> = ({ data, className }) => {
  const {
    title,
    description,
    rows,
    columns,
    values,
    secondMatrix,
    operationType,
    editable = false,
    showOperations = [],
    augmented = false,
    highlightCells = [],
    resultMatrix,
    educationalContext,
    determinantVisualization,
    inverseVisualization,
    multiplicationVisualization,
  } = data;

  const [matrixValues, setMatrixValues] = useState<number[][]>(values);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Sync matrixValues with incoming values prop when it changes
  useEffect(() => {
    // Validate incoming values before setting state
    if (values && Array.isArray(values) && values.length > 0) {
      setMatrixValues(values);
    }
  }, [values]);

  // Helper to check if a cell is highlighted
  const isCellHighlighted = (row: number, col: number) => {
    return highlightCells?.find(cell => cell.row === row && cell.col === col);
  };

  // Helper to get cell highlight color
  const getCellColor = (row: number, col: number) => {
    const highlight = isCellHighlighted(row, col);
    return highlight?.color || '#3b82f6';
  };

  // Helper to get cell label
  const getCellLabel = (row: number, col: number) => {
    const highlight = isCellHighlighted(row, col);
    return highlight?.label;
  };

  // Helper to get matrix variable name based on position (for 2x2: a, b, c, d)
  const getMatrixVariableName = (row: number, col: number) => {
    if (rows === 2 && columns === 2) {
      // Standard 2x2 matrix notation: [[a, b], [c, d]]
      if (row === 0 && col === 0) return 'a';
      if (row === 0 && col === 1) return 'b';
      if (row === 1 && col === 0) return 'c';
      if (row === 1 && col === 1) return 'd';
    }
    if (rows === 3 && columns === 3) {
      // 3x3 matrix notation: a₁₁, a₁₂, etc.
      return `a₍${row + 1},${col + 1}₎`;
    }
    // Default: show position
    return `${row + 1},${col + 1}`;
  };

  // Handle cell value change
  const handleCellChange = (row: number, col: number, value: string) => {
    if (!editable) return;

    const newValues = [...matrixValues];
    newValues[row][col] = parseFloat(value) || 0;
    setMatrixValues(newValues);
  };


  // Calculate determinant (2x2 or 3x3) with detailed steps
  const calculateDeterminant = (): { value: number | null; steps: any[] } => {
    // Validate square matrix
    if (rows !== columns) return { value: null, steps: [] };

    // Validate matrixValues dimensions match
    if (!matrixValues || matrixValues.length !== rows) {
      console.warn('Matrix values dimension mismatch:', { rows, actualRows: matrixValues?.length });
      return { value: null, steps: [] };
    }

    // Validate all rows have correct column count
    if (!matrixValues.every(row => row && row.length === columns)) {
      console.warn('Matrix row lengths inconsistent');
      return { value: null, steps: [] };
    }

    const steps = [];

    if (rows === 2 && matrixValues.length === 2) {
      const a = matrixValues[0][0];
      const b = matrixValues[0][1];
      const c = matrixValues[1][0];
      const d = matrixValues[1][1];

      steps.push({
        stepNumber: 1,
        description: 'For a 2×2 matrix, the determinant formula is: det(A) = ad - bc',
        formula: 'det(A) = ad - bc',
        calculation: '',
        result: 0,
      });

      steps.push({
        stepNumber: 2,
        description: 'Identify the matrix elements a, b, c, and d.',
        formula: `A = [[a, b], [c, d]]`,
        calculation: `a=${a}, b=${b}, c=${c}, d=${d}`,
        result: 0,
      });

      steps.push({
        stepNumber: 3,
        description: 'Calculate ad (diagonal product)',
        formula: `ad = ${a} × ${d}`,
        calculation: `${a * d}`,
        result: a * d,
      });

      steps.push({
        stepNumber: 4,
        description: 'Calculate bc (diagonal product)',
        formula: `bc = ${b} × ${c}`,
        calculation: `${b * c}`,
        result: b * c,
      });

      const det = a * d - b * c;
      steps.push({
        stepNumber: 5,
        description: 'Subtract to get determinant',
        formula: `det(A) = ${a * d} - ${b * c}`,
        calculation: `${det}`,
        result: det,
      });

      return { value: det, steps };
    }

    if (rows === 3 && matrixValues.length === 3) {
      const a = matrixValues;

      steps.push({
        stepNumber: 1,
        description: 'For a 3×3 matrix, we use the rule of Sarrus or cofactor expansion',
        formula: 'det(A) = a₁₁(a₂₂a₃₃ - a₂₃a₃₂) - a₁₂(a₂₁a₃₃ - a₂₃a₃₁) + a₁₃(a₂₁a₃₂ - a₂₂a₃₁)',
        calculation: '',
        result: 0,
      });

      const term1 = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]);
      steps.push({
        stepNumber: 2,
        description: 'Calculate first term: a₁₁ × (a₂₂a₃₃ - a₂₃a₃₂)',
        formula: `${a[0][0]} × (${a[1][1]} × ${a[2][2]} - ${a[1][2]} × ${a[2][1]})`,
        calculation: `${a[0][0]} × ${a[1][1] * a[2][2] - a[1][2] * a[2][1]} = ${term1}`,
        result: term1,
      });

      const term2 = a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]);
      steps.push({
        stepNumber: 3,
        description: 'Calculate second term: a₁₂ × (a₂₁a₃₃ - a₂₃a₃₁)',
        formula: `${a[0][1]} × (${a[1][0]} × ${a[2][2]} - ${a[1][2]} × ${a[2][0]})`,
        calculation: `${a[0][1]} × ${a[1][0] * a[2][2] - a[1][2] * a[2][0]} = ${term2}`,
        result: term2,
      });

      const term3 = a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
      steps.push({
        stepNumber: 4,
        description: 'Calculate third term: a₁₃ × (a₂₁a₃₂ - a₂₂a₃₁)',
        formula: `${a[0][2]} × (${a[1][0]} × ${a[2][1]} - ${a[1][1]} × ${a[2][0]})`,
        calculation: `${a[0][2]} × ${a[1][0] * a[2][1] - a[1][1] * a[2][0]} = ${term3}`,
        result: term3,
      });

      const det = term1 - term2 + term3;
      steps.push({
        stepNumber: 5,
        description: 'Combine all terms',
        formula: `det(A) = ${term1} - ${term2} + ${term3}`,
        calculation: `${det}`,
        result: det,
      });

      return { value: det, steps };
    }

    return { value: null, steps: [] };
  };

  // Calculate matrix multiplication with detailed steps
  const calculateMatrixMultiplication = (): {
    resultMatrix: number[][],
    steps: Array<{
      stepNumber: number;
      resultRow: number;
      resultCol: number;
      description: string;
      calculation: string;
      result: number;
    }>
  } => {
    if (!secondMatrix) {
      return { resultMatrix: [], steps: [] };
    }

    // Validate matrixValues structure
    if (!matrixValues || matrixValues.length !== rows) {
      console.warn('Matrix values dimension mismatch:', { rows, actualRows: matrixValues?.length });
      return { resultMatrix: [], steps: [] };
    }

    // Validate all rows have correct column count
    if (!matrixValues.every(row => row && row.length === columns)) {
      console.warn('Matrix row lengths inconsistent');
      return { resultMatrix: [], steps: [] };
    }

    // Validate secondMatrix structure
    if (!secondMatrix.values || secondMatrix.values.length !== secondMatrix.rows) {
      console.warn('Second matrix dimension mismatch');
      return { resultMatrix: [], steps: [] };
    }

    // Validate that columns of first matrix match rows of second matrix
    if (columns !== secondMatrix.rows) {
      console.warn('Cannot multiply: columns of first matrix must equal rows of second matrix');
      return { resultMatrix: [], steps: [] };
    }

    // Result matrix dimensions: rows from first matrix, columns from second matrix
    const resultRows = rows;
    const resultCols = secondMatrix.columns;
    const result: number[][] = Array(resultRows).fill(0).map(() => Array(resultCols).fill(0));
    const steps: Array<{
      stepNumber: number;
      resultRow: number;
      resultCol: number;
      description: string;
      calculation: string;
      result: number;
    }> = [];

    let stepNumber = 1;

    // For each position in result matrix
    for (let i = 0; i < resultRows; i++) {
      for (let j = 0; j < resultCols; j++) {
        // Calculate dot product of row i from first matrix and column j from second matrix
        let sum = 0;
        const terms: string[] = [];

        for (let k = 0; k < columns; k++) {
          const val1 = matrixValues[i][k];
          const val2 = secondMatrix.values[k][j];
          sum += val1 * val2;
          terms.push(`(${val1} × ${val2})`);
        }

        result[i][j] = sum;

        steps.push({
          stepNumber,
          resultRow: i,
          resultCol: j,
          description: `Calculate element at position (${i + 1}, ${j + 1}) by multiplying row ${i + 1} of Matrix A with column ${j + 1} of Matrix B`,
          calculation: `${terms.join(' + ')} = ${sum}`,
          result: sum
        });

        stepNumber++;
      }
    }

    return { resultMatrix: result, steps };
  };

  // Transpose matrix
  const transposeMatrix = (): number[][] => {
    // Validate matrixValues before transposing
    if (!matrixValues || matrixValues.length === 0) {
      console.warn('Cannot transpose: matrixValues is empty or undefined');
      return [];
    }

    // Ensure all rows exist and have the expected length
    const validRows = matrixValues.filter(row => row && row.length === columns);
    if (validRows.length !== rows) {
      console.warn('Cannot transpose: matrix dimensions are inconsistent');
      return [];
    }

    const transposed: number[][] = [];
    for (let col = 0; col < columns; col++) {
      transposed[col] = [];
      for (let row = 0; row < rows; row++) {
        transposed[col][row] = matrixValues[row][col];
      }
    }
    return transposed;
  };

  // Render a matrix with custom values
  const renderMatrix = (
    matrixData: number[][],
    matrixRows: number,
    matrixCols: number,
    isEditable: boolean = false,
    label?: string,
    showIndices: boolean = false
  ) => {
    // Calculate augmented column if needed
    const augmentedCol = augmented ? matrixCols - 1 : -1;

    return (
      <div className="flex flex-col items-center">
        {label && (
          <div className="text-sm font-mono text-slate-400 mb-3 font-semibold">{label}</div>
        )}
        <div className="relative inline-flex items-center">
          {/* Left bracket */}
          <div className="text-6xl text-purple-400 font-thin leading-none select-none" style={{ fontSize: `${matrixRows * 2.5}rem` }}>
            [
          </div>

          {/* Matrix cells */}
          <div className="mx-3 py-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${matrixCols}, minmax(0, 1fr))` }}>
              {matrixData.map((row, rowIndex) =>
                row.map((value, colIndex) => {
                  const highlighted = isCellHighlighted(rowIndex, colIndex);
                  const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
                  const isAugmentedDivider = augmented && colIndex === augmentedCol;
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const cellLabel = getCellLabel(rowIndex, colIndex);

                  return (
                    <div
                      key={cellKey}
                      className={`relative ${isAugmentedDivider ? 'border-l-2 border-slate-500 pl-3 ml-2' : ''}`}
                    >
                      {/* Cell index labels */}
                      {showIndices && (
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 font-mono">
                          {rowIndex + 1},{colIndex + 1}
                        </div>
                      )}

                      {/* Cell label */}
                      {cellLabel && (
                        <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-sm font-mono font-bold whitespace-nowrap"
                          style={{ color: getCellColor(rowIndex, colIndex) }}>
                          {cellLabel}
                        </div>
                      )}

                      <div className="relative">
                        {isEditable ? (
                          <input
                            type="text"
                            value={typeof value === 'number' ? (Number.isInteger(value) ? value.toString() : value.toFixed(2)) : value}
                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                            onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`
                              w-20 h-14 text-center text-lg font-mono rounded-xl transition-all duration-500
                              bg-slate-800/60 border-2 border-slate-600/60 hover:border-purple-500/60 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30
                              ${highlighted ? 'border-2 shadow-lg scale-105' : ''}
                              ${isHovered ? 'bg-slate-700/50 scale-105' : ''}
                              text-white outline-none font-semibold
                            `}
                            style={{
                              borderColor: highlighted ? getCellColor(rowIndex, colIndex) : undefined,
                              boxShadow: highlighted ? `0 0 25px ${getCellColor(rowIndex, colIndex)}60` : undefined,
                            }}
                          />
                        ) : (
                          <div className="relative">
                            <div
                              onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`
                                w-20 h-14 flex items-center justify-center text-lg font-mono rounded-xl transition-all duration-500
                                bg-slate-900/40 border-2 border-slate-700/40 cursor-pointer select-none
                                ${highlighted ? 'border-2 shadow-lg scale-105' : ''}
                                ${isHovered ? 'bg-slate-700/50 scale-105 border-purple-400/60' : ''}
                                text-white font-semibold
                              `}
                              style={{
                                borderColor: highlighted ? getCellColor(rowIndex, colIndex) : isHovered ? '#a78bfa' : undefined,
                                boxShadow: highlighted ? `0 0 25px ${getCellColor(rowIndex, colIndex)}60` : isHovered ? '0 0 15px rgba(167, 139, 250, 0.4)' : undefined,
                              }}
                            >
                              {typeof value === 'number' ? (Number.isInteger(value) ? value.toString() : value.toFixed(2)) : value}
                            </div>
                            {/* Variable name tooltip on hover */}
                            {isHovered && !cellLabel && (
                              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs font-mono px-2 py-1 rounded-md whitespace-nowrap z-50 animate-fade-in shadow-lg">
                                {getMatrixVariableName(rowIndex, colIndex)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Highlight glow effect */}
                        {highlighted && (
                          <div
                            className="absolute inset-0 rounded-xl blur-md -z-10 opacity-50"
                            style={{ backgroundColor: getCellColor(rowIndex, colIndex) }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right bracket */}
          <div className="text-6xl text-purple-400 font-thin leading-none select-none" style={{ fontSize: `${matrixRows * 2.5}rem` }}>
            ]
          </div>
        </div>

        {/* Matrix dimensions label */}
        <div className="text-xs text-slate-500 mt-2 font-mono">
          {matrixRows} × {matrixCols}
        </div>
      </div>
    );
  };

  // Perform selected operation
  const performOperation = (operationType: string) => {
    setSelectedOperation(operationType);
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-3xl font-bold text-white tracking-tight">Matrix Operations</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <p className="text-xs text-purple-400 font-mono uppercase tracking-wider">
              {rows} × {columns} Matrix {augmented ? '(Augmented System)' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-purple-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
            <p className="text-slate-300 font-light leading-relaxed">{description}</p>
          </div>

          {/* Main Matrix Display */}
          <div className="mb-10 flex justify-center">
            {/* Show two matrices side-by-side for binary operations */}
            {secondMatrix ? (
              <div className="flex items-center gap-6">
                {/* Matrix A */}
                <div className="flex flex-col items-center">
                  <div className="text-sm font-mono text-purple-400 mb-3 font-semibold">Matrix A</div>
                  {renderMatrix(matrixValues, rows, columns, editable, undefined, true)}
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
                        false
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              // Single matrix display (for unary operations)
              renderMatrix(matrixValues, rows, columns, editable, 'Original Matrix', true)
            )}
          </div>

          {/* Operations Panel */}
          {showOperations && showOperations.length > 0 && (
            <div className="mb-8 p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-600/50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400 mb-5 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Available Operations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {showOperations
                    .filter(op => {
                      // Only show operations that have visualization support
                      if (op.type === 'determinant' && determinantVisualization?.show) return true;
                      if (op.type === 'transpose') return true; // Transpose has built-in visualization
                      if (op.type === 'inverse' && inverseVisualization?.show) return true;
                      // For other operations, only show if we have step data
                      return false;
                    })
                    .map((op, index) => (
                      <button
                        key={index}
                        onClick={() => performOperation(op.type)}
                        className={`group p-4 rounded-xl transition-all duration-300 border-2 relative overflow-hidden min-h-[80px] flex items-center justify-center ${
                          selectedOperation === op.type
                            ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 border-purple-400/60 shadow-[0_0_25px_rgba(168,85,247,0.4)] scale-105'
                            : 'bg-slate-800/50 border-slate-600/40 hover:border-purple-500/50 hover:bg-slate-700/50 hover:scale-102'
                        }`}
                      >
                        {selectedOperation === op.type && (
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent"></div>
                        )}
                        <div className="relative z-10 text-center w-full">
                          <div className="text-sm font-bold text-white mb-1">{op.label}</div>
                          {op.description && (
                            <div className="text-xs text-slate-400 leading-snug">{op.description}</div>
                          )}
                        </div>
                      </button>
                    ))
                  }
                </div>

                {/* Determinant Visualization */}
                {selectedOperation === 'determinant' && determinantVisualization?.show && (
                  <div className="mt-6 p-8 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/5 border-2 border-purple-500/30 rounded-2xl relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                        <h5 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                          Calculating Determinant Step-by-Step
                        </h5>
                      </div>

                      {(() => {
                        // Always calculate determinant using current matrixValues
                        // This ensures the visualization matches the displayed matrix
                        const { value, steps } = calculateDeterminant();

                        return (
                          <div className="space-y-6">
                            {/* Visual diagram for 2x2 matrix */}
                            {rows === 2 && columns === 2 && (
                              <div className="p-6 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/30">
                                <div className="flex flex-col items-center gap-8">
                                  {/* Formula explanation */}
                                  <div className="text-center">
                                    <p className="text-sm text-purple-300 mb-2">For a 2×2 matrix, the determinant formula is:</p>
                                    <div className="font-mono text-lg text-white bg-slate-900/60 px-6 py-3 rounded-lg border border-purple-500/30">
                                      det(A) = ad - bc
                                    </div>
                                  </div>

                                  {/* Visual representation with arrows */}
                                  <div className="flex items-center gap-12">
                                    {/* Positive diagonal (ad) */}
                                    <div className="flex flex-col items-center gap-4">
                                      <div className="text-sm font-semibold text-green-400 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                        </svg>
                                        Positive Product (ad)
                                      </div>
                                      <div className="relative">
                                        {/* Matrix with diagonal highlight */}
                                        <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-xl">
                                          {/* Matrix brackets */}
                                          <path d="M 20 20 L 20 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 20 L 35 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 180 L 35 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 180 20 L 180 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 165 20 L 180 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 165 180 L 180 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>

                                          {/* Diagonal arrow from a to d */}
                                          <defs>
                                            <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                              <path d="M0,0 L0,6 L9,3 z" fill="#4ade80" />
                                            </marker>
                                          </defs>
                                          <line x1="65" y1="65" x2="125" y2="125" stroke="#4ade80" strokeWidth="3" markerEnd="url(#arrowGreen)" className="animate-pulse"/>

                                          {/* Matrix elements */}
                                          <rect x="40" y="40" width="50" height="50" rx="8" fill="#10b981" fillOpacity="0.2" stroke="#4ade80" strokeWidth="2"/>
                                          <text x="65" y="72" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="bold">{matrixValues[0][0]}</text>
                                          <text x="65" y="40" textAnchor="middle" fontSize="12" fill="#4ade80" fontWeight="bold">a</text>

                                          <rect x="110" y="40" width="50" height="50" rx="8" fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                          <text x="135" y="72" textAnchor="middle" fontSize="24" fill="#94a3b8">{matrixValues[0][1]}</text>
                                          <text x="135" y="40" textAnchor="middle" fontSize="12" fill="#64748b">b</text>

                                          <rect x="40" y="110" width="50" height="50" rx="8" fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                          <text x="65" y="142" textAnchor="middle" fontSize="24" fill="#94a3b8">{matrixValues[1][0]}</text>
                                          <text x="65" y="175" textAnchor="middle" fontSize="12" fill="#64748b">c</text>

                                          <rect x="110" y="110" width="50" height="50" rx="8" fill="#10b981" fillOpacity="0.2" stroke="#4ade80" strokeWidth="2"/>
                                          <text x="135" y="142" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="bold">{matrixValues[1][1]}</text>
                                          <text x="135" y="175" textAnchor="middle" fontSize="12" fill="#4ade80" fontWeight="bold">d</text>
                                        </svg>
                                      </div>
                                      <div className="font-mono text-2xl text-green-400 bg-slate-900/60 px-6 py-3 rounded-lg border border-green-500/40">
                                        {matrixValues[0][0]} × {matrixValues[1][1]} = {matrixValues[0][0] * matrixValues[1][1]}
                                      </div>
                                    </div>

                                    {/* Minus sign */}
                                    <div className="text-5xl font-bold text-slate-400">−</div>

                                    {/* Negative diagonal (bc) */}
                                    <div className="flex flex-col items-center gap-4">
                                      <div className="text-sm font-semibold text-red-400 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path>
                                        </svg>
                                        Negative Product (bc)
                                      </div>
                                      <div className="relative">
                                        {/* Matrix with anti-diagonal highlight */}
                                        <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-xl">
                                          {/* Matrix brackets */}
                                          <path d="M 20 20 L 20 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 20 L 35 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 180 L 35 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 180 20 L 180 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 165 20 L 180 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 165 180 L 180 180" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>

                                          {/* Diagonal arrow from b to c */}
                                          <defs>
                                            <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                              <path d="M0,0 L0,6 L9,3 z" fill="#f87171" />
                                            </marker>
                                          </defs>
                                          <line x1="135" y1="65" x2="75" y2="125" stroke="#f87171" strokeWidth="3" markerEnd="url(#arrowRed)" className="animate-pulse"/>

                                          {/* Matrix elements */}
                                          <rect x="40" y="40" width="50" height="50" rx="8" fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                          <text x="65" y="72" textAnchor="middle" fontSize="24" fill="#94a3b8">{matrixValues[0][0]}</text>
                                          <text x="65" y="40" textAnchor="middle" fontSize="12" fill="#64748b">a</text>

                                          <rect x="110" y="40" width="50" height="50" rx="8" fill="#dc2626" fillOpacity="0.2" stroke="#f87171" strokeWidth="2"/>
                                          <text x="135" y="72" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="bold">{matrixValues[0][1]}</text>
                                          <text x="135" y="40" textAnchor="middle" fontSize="12" fill="#f87171" fontWeight="bold">b</text>

                                          <rect x="40" y="110" width="50" height="50" rx="8" fill="#dc2626" fillOpacity="0.2" stroke="#f87171" strokeWidth="2"/>
                                          <text x="65" y="142" textAnchor="middle" fontSize="24" fill="#fff" fontWeight="bold">{matrixValues[1][0]}</text>
                                          <text x="65" y="175" textAnchor="middle" fontSize="12" fill="#f87171" fontWeight="bold">c</text>

                                          <rect x="110" y="110" width="50" height="50" rx="8" fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                          <text x="135" y="142" textAnchor="middle" fontSize="24" fill="#94a3b8">{matrixValues[1][1]}</text>
                                          <text x="135" y="175" textAnchor="middle" fontSize="12" fill="#64748b">d</text>
                                        </svg>
                                      </div>
                                      <div className="font-mono text-2xl text-red-400 bg-slate-900/60 px-6 py-3 rounded-lg border border-red-500/40">
                                        {matrixValues[0][1]} × {matrixValues[1][0]} = {matrixValues[0][1] * matrixValues[1][0]}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Final calculation */}
                                  <div className="mt-4 p-6 bg-gradient-to-br from-purple-500/20 to-blue-500/10 border-2 border-purple-400/40 rounded-xl">
                                    <div className="text-center">
                                      <p className="text-sm text-purple-300 mb-2">Subtract to get the determinant:</p>
                                      <div className="font-mono text-3xl text-white">
                                        <span className="text-green-400">{matrixValues[0][0] * matrixValues[1][1]}</span>
                                        {' '}<span className="text-slate-400">−</span>{' '}
                                        <span className="text-red-400">{matrixValues[0][1] * matrixValues[1][0]}</span>
                                        {' '}<span className="text-slate-400">=</span>{' '}
                                        <span className="text-purple-300 font-bold">{matrixValues[0][0] * matrixValues[1][1] - matrixValues[0][1] * matrixValues[1][0]}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Visual diagram for 3x3 matrix using Rule of Sarrus */}
                            {rows === 3 && columns === 3 && (
                              <div className="p-6 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/30">
                                <div className="flex flex-col items-center gap-8">
                                  {/* Formula explanation */}
                                  <div className="text-center">
                                    <p className="text-sm text-purple-300 mb-3">For a 3×3 matrix, we use the Rule of Sarrus:</p>
                                    <div className="bg-slate-900/60 px-8 py-4 rounded-lg border border-purple-500/30">
                                      <div className="text-base text-white leading-relaxed" style={{ fontFamily: 'Cambria Math, STIXGeneral, DejaVu Sans, serif' }}>
                                        <span className="text-purple-200">det(A) = </span>
                                        <span className="text-green-300">(a<sub>11</sub>a<sub>22</sub>a<sub>33</sub> + a<sub>12</sub>a<sub>23</sub>a<sub>31</sub> + a<sub>13</sub>a<sub>21</sub>a<sub>32</sub>)</span>
                                        <span className="text-slate-400"> − </span>
                                        <span className="text-red-300">(a<sub>13</sub>a<sub>22</sub>a<sub>31</sub> + a<sub>11</sub>a<sub>23</sub>a<sub>32</sub> + a<sub>12</sub>a<sub>21</sub>a<sub>33</sub>)</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Visual representation with Sarrus Rule */}
                                  <div className="flex flex-col items-center gap-6">
                                    <p className="text-sm text-slate-300">We extend the matrix by repeating the first two columns, then calculate diagonal products:</p>

                                    {/* Extended matrix visualization */}
                                    <div className="flex flex-col gap-8">
                                      {/* Positive diagonals */}
                                      <div className="flex flex-col items-center gap-4">
                                        <div className="text-sm font-semibold text-green-400 flex items-center gap-2">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                          </svg>
                                          Positive Diagonals (↘)
                                        </div>

                                        <svg width="500" height="220" viewBox="0 0 500 220" className="drop-shadow-xl">
                                          <defs>
                                            <marker id="arrowGreen1" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#4ade80" />
                                            </marker>
                                            <marker id="arrowGreen2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#22c55e" />
                                            </marker>
                                            <marker id="arrowGreen3" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#16a34a" />
                                            </marker>
                                          </defs>

                                          {/* Matrix brackets */}
                                          <path d="M 20 20 L 20 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 20 L 35 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 200 L 35 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 280 20 L 280 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 265 20 L 280 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 265 200 L 280 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>

                                          {/* Extended columns (dotted) */}
                                          <path d="M 290 30 L 470 30 L 470 190 L 290 190" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" fill="none"/>

                                          {/* 3x3 Matrix cells */}
                                          {[0, 1, 2].map((row) =>
                                            [0, 1, 2].map((col) => (
                                              <g key={`cell-${row}-${col}`}>
                                                <rect x={40 + col * 80} y={40 + row * 60} width="60" height="50" rx="6"
                                                  fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                                <text x={70 + col * 80} y={70 + row * 60} textAnchor="middle" fontSize="20" fill="#fff" fontWeight="bold">
                                                  {matrixValues[row][col]}
                                                </text>
                                              </g>
                                            ))
                                          )}

                                          {/* Extended columns (first two columns repeated) */}
                                          {[0, 1].map((col) =>
                                            [0, 1, 2].map((row) => (
                                              <g key={`ext-${row}-${col}`}>
                                                <rect x={300 + col * 80} y={40 + row * 60} width="60" height="50" rx="6"
                                                  fill="#1e293b" fillOpacity="0.2" stroke="#64748b" strokeWidth="1" strokeDasharray="3,3"/>
                                                <text x={330 + col * 80} y={70 + row * 60} textAnchor="middle" fontSize="18" fill="#94a3b8">
                                                  {matrixValues[row][col]}
                                                </text>
                                              </g>
                                            ))
                                          )}

                                          {/* Diagonal 1: a₁₁ → a₂₂ → a₃₃ */}
                                          <line x1="70" y1="65" x2="230" y2="175" stroke="#4ade80" strokeWidth="3" markerEnd="url(#arrowGreen1)" className="animate-pulse" style={{animationDelay: '0s'}}/>

                                          {/* Diagonal 2: a₁₂ → a₂₃ → a₃₁ */}
                                          <line x1="150" y1="65" x2="310" y2="175" stroke="#22c55e" strokeWidth="3" markerEnd="url(#arrowGreen2)" className="animate-pulse" style={{animationDelay: '0.2s'}}/>

                                          {/* Diagonal 3: a₁₃ → a₂₁ → a₃₂ */}
                                          <line x1="230" y1="65" x2="390" y2="175" stroke="#16a34a" strokeWidth="3" markerEnd="url(#arrowGreen3)" className="animate-pulse" style={{animationDelay: '0.4s'}}/>
                                        </svg>

                                        <div className="flex gap-4 flex-wrap justify-center">
                                          <div className="font-mono text-base text-green-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-green-500/40">
                                            {matrixValues[0][0]} × {matrixValues[1][1]} × {matrixValues[2][2]} = {matrixValues[0][0] * matrixValues[1][1] * matrixValues[2][2]}
                                          </div>
                                          <div className="font-mono text-base text-green-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-green-500/40">
                                            {matrixValues[0][1]} × {matrixValues[1][2]} × {matrixValues[2][0]} = {matrixValues[0][1] * matrixValues[1][2] * matrixValues[2][0]}
                                          </div>
                                          <div className="font-mono text-base text-green-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-green-500/40">
                                            {matrixValues[0][2]} × {matrixValues[1][0]} × {matrixValues[2][1]} = {matrixValues[0][2] * matrixValues[1][0] * matrixValues[2][1]}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Negative diagonals */}
                                      <div className="flex flex-col items-center gap-4">
                                        <div className="text-sm font-semibold text-red-400 flex items-center gap-2">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path>
                                          </svg>
                                          Negative Diagonals (↙)
                                        </div>

                                        <svg width="500" height="220" viewBox="0 0 500 220" className="drop-shadow-xl">
                                          <defs>
                                            <marker id="arrowRed1" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#f87171" />
                                            </marker>
                                            <marker id="arrowRed2" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
                                            </marker>
                                            <marker id="arrowRed3" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                              <path d="M0,0 L0,6 L8,3 z" fill="#dc2626" />
                                            </marker>
                                          </defs>

                                          {/* Matrix brackets */}
                                          <path d="M 20 20 L 20 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 20 L 35 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 20 200 L 35 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 280 20 L 280 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 265 20 L 280 20" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                          <path d="M 265 200 L 280 200" stroke="#a78bfa" strokeWidth="3" fill="none" strokeLinecap="round"/>

                                          {/* Extended columns (dotted) */}
                                          <path d="M 290 30 L 470 30 L 470 190 L 290 190" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" fill="none"/>

                                          {/* 3x3 Matrix cells */}
                                          {[0, 1, 2].map((row) =>
                                            [0, 1, 2].map((col) => (
                                              <g key={`cell-${row}-${col}`}>
                                                <rect x={40 + col * 80} y={40 + row * 60} width="60" height="50" rx="6"
                                                  fill="#1e293b" fillOpacity="0.3" stroke="#64748b" strokeWidth="1"/>
                                                <text x={70 + col * 80} y={70 + row * 60} textAnchor="middle" fontSize="20" fill="#fff" fontWeight="bold">
                                                  {matrixValues[row][col]}
                                                </text>
                                              </g>
                                            ))
                                          )}

                                          {/* Extended columns (first two columns repeated) */}
                                          {[0, 1].map((col) =>
                                            [0, 1, 2].map((row) => (
                                              <g key={`ext-${row}-${col}`}>
                                                <rect x={300 + col * 80} y={40 + row * 60} width="60" height="50" rx="6"
                                                  fill="#1e293b" fillOpacity="0.2" stroke="#64748b" strokeWidth="1" strokeDasharray="3,3"/>
                                                <text x={330 + col * 80} y={70 + row * 60} textAnchor="middle" fontSize="18" fill="#94a3b8">
                                                  {matrixValues[row][col]}
                                                </text>
                                              </g>
                                            ))
                                          )}

                                          {/* Diagonal 4: a₁₃ → a₂₂ → a₃₁ */}
                                          <line x1="230" y1="65" x2="310" y2="175" stroke="#f87171" strokeWidth="3" markerEnd="url(#arrowRed1)" className="animate-pulse" style={{animationDelay: '0s'}}/>

                                          {/* Diagonal 5: a₁₁ → a₂₃ → a₃₂ */}
                                          <line x1="70" y1="65" x2="390" y2="175" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowRed2)" className="animate-pulse" style={{animationDelay: '0.2s'}}/>

                                          {/* Diagonal 6: a₁₂ → a₂₁ → a₃₃ */}
                                          <line x1="150" y1="65" x2="230" y2="175" stroke="#dc2626" strokeWidth="3" markerEnd="url(#arrowRed3)" className="animate-pulse" style={{animationDelay: '0.4s'}}/>
                                        </svg>

                                        <div className="flex gap-4 flex-wrap justify-center">
                                          <div className="font-mono text-base text-red-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-red-500/40">
                                            {matrixValues[0][2]} × {matrixValues[1][1]} × {matrixValues[2][0]} = {matrixValues[0][2] * matrixValues[1][1] * matrixValues[2][0]}
                                          </div>
                                          <div className="font-mono text-base text-red-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-red-500/40">
                                            {matrixValues[0][0]} × {matrixValues[1][2]} × {matrixValues[2][1]} = {matrixValues[0][0] * matrixValues[1][2] * matrixValues[2][1]}
                                          </div>
                                          <div className="font-mono text-base text-red-400 bg-slate-900/60 px-4 py-2 rounded-lg border border-red-500/40">
                                            {matrixValues[0][1]} × {matrixValues[1][0]} × {matrixValues[2][2]} = {matrixValues[0][1] * matrixValues[1][0] * matrixValues[2][2]}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Final calculation */}
                                    <div className="mt-4 p-6 bg-gradient-to-br from-purple-500/20 to-blue-500/10 border-2 border-purple-400/40 rounded-xl max-w-4xl">
                                      <div className="text-center">
                                        <p className="text-sm text-purple-300 mb-3">Sum positive diagonals and subtract negative diagonals:</p>
                                        <div className="font-mono text-lg text-white space-y-2">
                                          <div>
                                            <span className="text-green-400">
                                              ({matrixValues[0][0] * matrixValues[1][1] * matrixValues[2][2]} + {matrixValues[0][1] * matrixValues[1][2] * matrixValues[2][0]} + {matrixValues[0][2] * matrixValues[1][0] * matrixValues[2][1]})
                                            </span>
                                          </div>
                                          <div className="text-slate-400 text-2xl">−</div>
                                          <div>
                                            <span className="text-red-400">
                                              ({matrixValues[0][2] * matrixValues[1][1] * matrixValues[2][0]} + {matrixValues[0][0] * matrixValues[1][2] * matrixValues[2][1]} + {matrixValues[0][1] * matrixValues[1][0] * matrixValues[2][2]})
                                            </span>
                                          </div>
                                          <div className="text-slate-400 text-2xl">=</div>
                                          <div>
                                            <span className="text-purple-300 font-bold text-2xl">
                                              {(matrixValues[0][0] * matrixValues[1][1] * matrixValues[2][2] +
                                                matrixValues[0][1] * matrixValues[1][2] * matrixValues[2][0] +
                                                matrixValues[0][2] * matrixValues[1][0] * matrixValues[2][1]) -
                                               (matrixValues[0][2] * matrixValues[1][1] * matrixValues[2][0] +
                                                matrixValues[0][0] * matrixValues[1][2] * matrixValues[2][1] +
                                                matrixValues[0][1] * matrixValues[1][0] * matrixValues[2][2])}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Text-based steps for detailed walkthrough */}
                            <div className="space-y-4">
                              {steps.map((step, idx) => (
                                <div
                                  key={idx}
                                  className="group p-5 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
                                >
                                  <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-xl flex items-center justify-center text-base font-bold shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                      {step.stepNumber}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                      <p className="text-base text-white font-medium leading-relaxed">{step.description}</p>
                                      {step.formula && (
                                        <div className="font-mono text-purple-200 bg-slate-900/60 px-5 py-3 rounded-lg border border-purple-500/30 backdrop-blur-sm">
                                          {step.formula}
                                        </div>
                                      )}
                                      {step.calculation && (
                                        <div className="font-mono text-green-200 bg-slate-900/60 px-5 py-3 rounded-lg border border-green-500/30 backdrop-blur-sm">
                                          = {step.calculation}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-8 p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-400/50 rounded-2xl relative overflow-hidden group">
                              {/* Animated background */}
                              <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/5 to-green-400/0 animate-pulse"></div>

                              <div className="relative z-10 text-center">
                                <div className="flex items-center justify-center gap-2 mb-3">
                                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                  </svg>
                                  <div className="text-sm font-semibold text-green-300 uppercase tracking-wider">Final Determinant</div>
                                </div>
                                <div className="text-6xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent font-mono tracking-tight">
                                  {value?.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Transpose Visualization */}
                {selectedOperation === 'transpose' && (
                  <div className="mt-6">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-4">
                      <p className="text-sm text-blue-300">
                        <strong>Transposing</strong> a matrix means swapping rows and columns.
                        Element at position (i, j) moves to position (j, i).
                      </p>
                    </div>

                    {matrixValues && matrixValues.length > 0 && matrixValues.every(row => row && row.length > 0) ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                        <div>
                          <div className="text-center mb-3">
                            <span className="text-sm font-mono text-slate-400">Original Matrix</span>
                          </div>
                          {renderMatrix(matrixValues, rows, columns, false, undefined, true)}
                        </div>

                        <div className="flex justify-center items-center">
                          <svg className="w-12 h-12 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                          </svg>
                        </div>

                        <div>
                          <div className="text-center mb-3">
                            <span className="text-sm font-mono text-green-400">Transposed Matrix</span>
                          </div>
                          {renderMatrix(transposeMatrix(), columns, rows, false, undefined, true)}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-sm text-red-300">Matrix data is invalid or incomplete.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matrix Multiplication Visualization */}
          {operationType === 'multiply' && secondMatrix && multiplicationVisualization?.show && (
            <div className="mb-8 p-8 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/5 border-2 border-blue-500/30 rounded-2xl relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                  <h5 className="text-xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                    Matrix Multiplication Step-by-Step
                  </h5>
                </div>

                {/* Explanation */}
                <div className="p-6 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-blue-500/30 mb-6">
                  <div className="text-center">
                    <p className="text-sm text-blue-300 mb-3">
                      To multiply matrices, we take each <strong>row</strong> from Matrix A and multiply it with each <strong>column</strong> from Matrix B.
                    </p>
                    <div className="font-mono text-base text-white bg-slate-900/60 px-6 py-3 rounded-lg border border-blue-500/30 inline-block">
                      Row × Column = Element
                    </div>
                  </div>
                </div>

                {(() => {
                  const { resultMatrix: calculatedResult, steps } = calculateMatrixMultiplication();

                  return (
                    <div className="space-y-6">
                      {/* Visual guide for understanding multiplication */}
                      <div className="p-6 bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/30">
                        <div className="flex flex-col items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-purple-300 mb-2">The pattern: <strong>Row × Column</strong></p>
                            <p className="text-xs text-slate-400">Each element in the result comes from multiplying a row from A with a column from B</p>
                          </div>

                          {/* Visual representation */}
                          <div className="flex items-center gap-8 flex-wrap justify-center">
                            {/* Matrix A with row highlight */}
                            <div className="flex flex-col items-center">
                              <div className="text-xs font-mono text-purple-400 mb-2">Matrix A (use rows →)</div>
                              <div className="text-xs text-slate-400 mb-1">Go across each row</div>
                            </div>

                            <div className="text-3xl text-slate-400 font-bold">×</div>

                            {/* Matrix B with column highlight */}
                            <div className="flex flex-col items-center">
                              <div className="text-xs font-mono text-blue-400 mb-2">Matrix B (use columns ↓)</div>
                              <div className="text-xs text-slate-400 mb-1">Go down each column</div>
                            </div>

                            <div className="text-3xl text-slate-400 font-bold">=</div>

                            {/* Result */}
                            <div className="flex flex-col items-center">
                              <div className="text-xs font-mono text-green-400 mb-2">Result Matrix</div>
                              <div className="text-xs text-slate-400 mb-1">New element at each position</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step-by-step calculations */}
                      <div className="space-y-4">
                        {steps.map((step, idx) => {
                          const isEvenRow = step.resultRow % 2 === 0;
                          const colorClass = isEvenRow ? 'from-blue-500/20' : 'from-purple-500/20';

                          return (
                            <div
                              key={idx}
                              className={`group p-6 bg-gradient-to-br ${colorClass} to-transparent backdrop-blur-sm rounded-xl border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10`}
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-xl flex items-center justify-center text-base font-bold shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                  {step.stepNumber}
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-lg text-xs font-mono text-purple-300">
                                      Result[{step.resultRow + 1},{step.resultCol + 1}]
                                    </div>
                                    <div className="text-slate-500">=</div>
                                    <div className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-lg text-xs font-mono text-blue-300">
                                      Row {step.resultRow + 1} of A
                                    </div>
                                    <div className="text-slate-500">×</div>
                                    <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-lg text-xs font-mono text-cyan-300">
                                      Column {step.resultCol + 1} of B
                                    </div>
                                  </div>

                                  <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>

                                  {/* Calculation */}
                                  <div className="font-mono text-base bg-slate-900/60 px-5 py-3 rounded-lg border border-blue-500/30 backdrop-blur-sm">
                                    <div className="text-blue-200">{step.calculation}</div>
                                  </div>

                                  {/* Result badge */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Result:</span>
                                    <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/40 rounded-lg">
                                      <span className="text-lg font-bold text-green-300">{step.result}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Final Result Matrix */}
                      {calculatedResult.length > 0 && (
                        <div className="mt-8 p-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-400/50 rounded-2xl relative overflow-hidden group">
                          {/* Animated background */}
                          <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/5 to-green-400/0 animate-pulse"></div>

                          <div className="relative z-10">
                            <div className="text-center mb-6">
                              <div className="flex items-center justify-center gap-2 mb-3">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div className="text-lg font-semibold text-green-300 uppercase tracking-wider">Final Result</div>
                              </div>
                              <p className="text-sm text-green-200">Matrix A × Matrix B = Result Matrix</p>
                            </div>

                            <div className="flex justify-center">
                              {renderMatrix(
                                calculatedResult,
                                calculatedResult.length,
                                calculatedResult[0]?.length || 0,
                                false,
                                'Result Matrix',
                                true
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Result Matrix */}
          {resultMatrix && (
            <div className="mb-8 p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-xl">
              <div className="text-center mb-5">
                <h4 className="text-xl font-bold text-green-400 mb-2 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  {resultMatrix.label}
                </h4>
                {resultMatrix.explanation && (
                  <p className="text-sm text-green-200 mb-4">{resultMatrix.explanation}</p>
                )}
              </div>
              <div className="flex justify-center">
                {renderMatrix(resultMatrix.values, resultMatrix.values.length, resultMatrix.values[0]?.length || 0, false, 'Final Result', true)}
              </div>
            </div>
          )}

          {/* Educational Context */}
          {educationalContext && (
            <div className="mt-6 p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <h5 className="font-semibold text-purple-400 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  Understanding Matrices
                </h5>
                <p className="text-sm text-slate-300 leading-relaxed">{educationalContext}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatrixDisplay;
