'use client';

import React, { useState, useEffect } from 'react';
import { usePrimitiveEvaluation, type AreaModelMetrics } from '../../../evaluation';
import type { PrimitiveEvaluationResult } from '../../../evaluation';

export interface AreaModelData {
  title: string;
  description: string;
  factor1Parts: number[]; // Decomposition of first factor (e.g., [20, 3] for 23)
  factor2Parts: number[]; // Decomposition of second factor (e.g., [10, 5] for 15)
  showPartialProducts?: boolean; // Display products in cells
  showDimensions?: boolean; // Label side lengths
  algebraicMode?: boolean; // Allow variable terms
  highlightCell?: [number, number] | null; // Emphasize specific cell [row, col]
  showAnimation?: boolean; // Animate assembly of final product
  labels?: {
    factor1?: string[]; // Custom labels for factor1Parts (e.g., ["2x", "3"])
    factor2?: string[]; // Custom labels for factor2Parts
  };

  // Evaluation integration (optional)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AreaModelMetrics>) => void;
}

interface AreaModelProps {
  data: AreaModelData;
  className?: string;
}

interface CellState {
  row: number;
  col: number;
  studentAnswer: string;
  isCorrect: boolean | null;
  attempts: number;
}

const AreaModel: React.FC<AreaModelProps> = ({ data, className }) => {
  const {
    factor1Parts = [10, 2],
    factor2Parts = [10, 3],
    showPartialProducts = false, // Now defaults to false - student must work
    showDimensions = true,
    algebraicMode = false,
    highlightCell = null,
    showAnimation = false,
    labels,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Calculate totals
  const factor1Total = factor1Parts.reduce((sum, val) => sum + val, 0);
  const factor2Total = factor2Parts.reduce((sum, val) => sum + val, 0);
  const totalProduct = factor1Total * factor2Total;
  const totalCells = factor1Parts.length * factor2Parts.length;

  // State for each cell
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [sumInput, setSumInput] = useState('');
  const [sumAttempted, setSumAttempted] = useState(false);
  const [sumCorrect, setSumCorrect] = useState<boolean | null>(null);
  const [animationComplete, setAnimationComplete] = useState(!showAnimation);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<AreaModelMetrics>({
    primitiveType: 'area-model',
    instanceId: instanceId || `area-model-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // Get correct answer for a cell
  const getCorrectAnswer = (row: number, col: number): number => {
    return factor1Parts[col] * factor2Parts[row];
  };

  // Get cell key
  const getCellKey = (row: number, col: number): string => {
    return `${row},${col}`;
  };

  // Get cell state
  const getCellState = (row: number, col: number): CellState | undefined => {
    return cellStates.get(getCellKey(row, col));
  };

  // Handle cell selection
  const handleCellClick = (row: number, col: number) => {
    if (hasSubmitted) return;

    const cellState = getCellState(row, col);
    if (cellState?.isCorrect) return; // Don't allow re-editing correct answers

    setSelectedCell([row, col]);
    setCurrentInput(cellState?.studentAnswer || '');
  };

  // Handle input submission for a cell
  const handleCellSubmit = () => {
    if (!selectedCell || hasSubmitted) return;

    const [row, col] = selectedCell;
    const cellKey = getCellKey(row, col);
    const correctAnswer = getCorrectAnswer(row, col);
    const studentAnswerNum = parseInt(currentInput, 10);
    const isCorrect = studentAnswerNum === correctAnswer;

    const existingState = getCellState(row, col);
    const newState: CellState = {
      row,
      col,
      studentAnswer: currentInput,
      isCorrect,
      attempts: (existingState?.attempts || 0) + 1,
    };

    setCellStates(new Map(cellStates.set(cellKey, newState)));

    if (isCorrect) {
      setSelectedCell(null);
      setCurrentInput('');
    }
  };

  // Check if all cells are complete
  const allCellsComplete = (): boolean => {
    for (let row = 0; row < factor2Parts.length; row++) {
      for (let col = 0; col < factor1Parts.length; col++) {
        const state = getCellState(row, col);
        if (!state?.isCorrect) return false;
      }
    }
    return true;
  };

  // Calculate sum of student's correct partial products
  const calculateStudentSum = (): number => {
    let sum = 0;
    cellStates.forEach((state) => {
      if (state.isCorrect) {
        sum += parseInt(state.studentAnswer, 10);
      }
    });
    return sum;
  };

  // Handle sum submission
  const handleSumSubmit = () => {
    if (hasSubmitted || isSubmitting) return;
    if (!sumInput) return;

    console.log('handleSumSubmit called', { sumInput, hasSubmitted });

    setIsSubmitting(true);

    const studentSumNum = parseInt(sumInput, 10);
    const correctSum = totalProduct;
    const isCorrect = studentSumNum === correctSum;

    setSumAttempted(true);
    setSumCorrect(isCorrect);

    // Submit evaluation
    submitEvaluation();

    // Reset submitting state after a brief delay
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  // Submit evaluation with metrics
  const submitEvaluation = () => {
    console.log('submitEvaluation called', { hasSubmitted });
    if (hasSubmitted) return;

    let correctCount = 0;
    let incorrectCount = 0;
    let totalAttempts = 0;
    const cellsAnswered = new Set<string>();

    cellStates.forEach((state, key) => {
      cellsAnswered.add(key);
      totalAttempts += state.attempts;
      if (state.isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const skippedCount = totalCells - cellsAnswered.size;
    const partialProductAccuracy = totalCells > 0 ? (correctCount / totalCells) * 100 : 0;

    const studentSumNum = parseInt(sumInput, 10) || 0;
    const sumIsCorrect = studentSumNum === totalProduct;

    // Weighted scoring: 70% partial products, 30% sum
    const overallAccuracy = (partialProductAccuracy * 0.7) + (sumIsCorrect ? 30 : 0);

    // Check if completed in order (row-major order)
    const completedInOrder = checkCompletedInOrder();

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      targetProduct: totalProduct,
      studentProduct: studentSumNum,
      correctFinalAnswer: sumIsCorrect,
      totalPartialProducts: totalCells,
      correctPartialProducts: correctCount,
      incorrectPartialProducts: incorrectCount,
      skippedPartialProducts: skippedCount,
      attemptedSum: sumAttempted,
      correctSum: sumIsCorrect,
      partialProductAccuracy,
      overallAccuracy,
      completedInOrder,
      attemptsPerCell: cellsAnswered.size > 0 ? totalAttempts / cellsAnswered.size : 0,
      totalAttempts,
      isAlgebraic: algebraicMode || false,
      usedDistributiveProperty: algebraicMode || false,
    };

    const success = correctCount === totalCells && sumIsCorrect;
    const score = overallAccuracy;

    submitResult(success, score, metrics, {
      cellStates: Array.from(cellStates.entries()),
      sumInput,
    });
  };

  // Check if cells were completed in order
  const checkCompletedInOrder = (): boolean => {
    const entries = Array.from(cellStates.entries());
    if (entries.length === 0) return true;

    // Sort by when they were completed (approximated by attempts == 1 for first try)
    // This is a simplified check - ideally we'd track timestamps
    for (let i = 0; i < entries.length - 1; i++) {
      const [key1] = entries[i];
      const [key2] = entries[i + 1];
      const [row1, col1] = key1.split(',').map(Number);
      const [row2, col2] = key2.split(',').map(Number);

      const index1 = row1 * factor1Parts.length + col1;
      const index2 = row2 * factor1Parts.length + col2;

      if (index1 > index2) return false;
    }
    return true;
  };

  // Handle reset
  const handleReset = () => {
    setCellStates(new Map());
    setSelectedCell(null);
    setCurrentInput('');
    setSumInput('');
    setSumAttempted(false);
    setSumCorrect(null);
    resetAttempt();
  };

  // Get cell color based on state
  const getCellColor = (row: number, col: number): string => {
    const state = getCellState(row, col);

    if (state?.isCorrect) {
      return 'bg-green-500/30 border-green-400';
    }

    if (state && !state.isCorrect) {
      return 'bg-red-500/30 border-red-400';
    }

    if (selectedCell && selectedCell[0] === row && selectedCell[1] === col) {
      return 'bg-blue-500/40 border-blue-400 ring-2 ring-blue-400';
    }

    if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
      return 'bg-yellow-500/40 border-yellow-400';
    }

    // Alternate colors for visual clarity
    const colorIndex = (row + col) % 4;
    const colors = [
      'bg-slate-500/20 border-slate-400/50',
      'bg-purple-500/20 border-purple-400/50',
      'bg-pink-500/20 border-pink-400/50',
      'bg-indigo-500/20 border-indigo-400/50',
    ];
    return colors[colorIndex];
  };

  // Format label (handles both numeric and algebraic)
  const formatLabel = (value: number, labelArray?: string[], index?: number): string => {
    if (labelArray && index !== undefined) {
      return labelArray[index];
    }
    return String(value);
  };

  // Format cell equation
  const formatCellEquation = (row: number, col: number): string => {
    const f1 = formatLabel(factor1Parts[col], labels?.factor1, col);
    const f2 = formatLabel(factor2Parts[row], labels?.factor2, row);
    return `${f1} × ${f2}`;
  };

  // Start animation on mount
  useEffect(() => {
    if (showAnimation && !animationComplete) {
      const timer = setTimeout(() => setAnimationComplete(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showAnimation, animationComplete]);

  // Auto-focus input when cell selected
  useEffect(() => {
    if (selectedCell) {
      const input = document.getElementById('cell-input');
      input?.focus();
    }
  }, [selectedCell]);

  const correctCells = Array.from(cellStates.values()).filter(s => s.isCorrect).length;
  const showSumSection = allCellsComplete();

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Area Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">
              {algebraicMode ? 'Algebraic Multiplication' : 'Interactive Multiplication'}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-blue-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Progress Indicator */}
          {!hasSubmitted && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Progress</span>
                <span className="text-sm font-mono text-blue-400">
                  {correctCells} / {totalCells} cells complete
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(correctCells / totalCells) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">(</span>}
              <span className="text-blue-300">
                {labels?.factor1
                  ? labels.factor1.join(' + ')
                  : factor1Parts.length > 1
                    ? factor1Parts.join(' + ')
                    : factor1Parts[0]
                }
              </span>
              {(algebraicMode || factor1Parts.length > 1) && <span className="text-slate-500">)</span>}
              <span className="text-slate-500">×</span>
              {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">(</span>}
              <span className="text-purple-300">
                {labels?.factor2
                  ? labels.factor2.join(' + ')
                  : factor2Parts.length > 1
                    ? factor2Parts.join(' + ')
                    : factor2Parts[0]
                }
              </span>
              {(algebraicMode || factor2Parts.length > 1) && <span className="text-slate-500">)</span>}
              <span className="text-slate-500">=</span>
              <span className="text-pink-300">?</span>
            </div>
          </div>

          {/* Area Model Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Top dimension labels */}
              {showDimensions && (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-${index}`}
                      className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm"
                      style={{ width: `${Math.max(100, part * 8)}px` }}
                    >
                      {formatLabel(part, labels?.factor1, index)}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex">
                {/* Left dimension labels */}
                {showDimensions && (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-${index}`}
                        className="flex items-center justify-center text-purple-300 font-mono font-bold text-sm"
                        style={{ height: `${Math.max(80, part * 6)}px` }}
                      >
                        {formatLabel(part, labels?.factor2, index)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid */}
                <div
                  className={`grid gap-2 transition-all duration-500 ${
                    animationComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                  style={{
                    gridTemplateColumns: `repeat(${factor1Parts.length}, minmax(100px, 1fr))`,
                  }}
                >
                  {factor2Parts.map((_, rowIndex) =>
                    factor1Parts.map((_, colIndex) => {
                      const cellState = getCellState(rowIndex, colIndex);
                      const isSelected = selectedCell && selectedCell[0] === rowIndex && selectedCell[1] === colIndex;

                      return (
                        <div
                          key={`cell-${rowIndex}-${colIndex}`}
                          className={`
                            border-2 rounded-lg flex flex-col items-center justify-center p-4
                            transition-all duration-300 cursor-pointer
                            ${getCellColor(rowIndex, colIndex)}
                            ${!cellState?.isCorrect && !hasSubmitted ? 'hover:scale-105' : ''}
                          `}
                          style={{
                            minHeight: `${Math.max(80, factor2Parts[rowIndex] * 6)}px`,
                            minWidth: `${Math.max(100, factor1Parts[colIndex] * 8)}px`,
                          }}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                          {/* Equation */}
                          <div className="text-xs text-slate-400 mb-2">
                            {formatCellEquation(rowIndex, colIndex)}
                          </div>

                          {/* Answer display */}
                          {cellState?.isCorrect && (
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg">
                                {cellState.studentAnswer}
                              </div>
                              <div className="text-xs text-green-400 mt-1">✓</div>
                            </div>
                          )}

                          {cellState && !cellState.isCorrect && (
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg line-through opacity-50">
                                {cellState.studentAnswer}
                              </div>
                              <div className="text-xs text-red-400 mt-1">Try again</div>
                            </div>
                          )}

                          {!cellState && !isSelected && (
                            <div className="text-slate-500 text-lg">?</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Section for Selected Cell */}
          {selectedCell && !hasSubmitted && (
            <div className="mt-8 p-6 bg-blue-900/20 rounded-xl border border-blue-500/30">
              <h4 className="text-sm font-mono uppercase tracking-wider text-blue-400 mb-4">
                Step 1: Calculate Partial Product
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is {formatCellEquation(selectedCell[0], selectedCell[1])}?
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="cell-input"
                      type="number"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCellSubmit();
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                      placeholder="Enter answer"
                      disabled={hasSubmitted}
                    />
                    <button
                      onClick={handleCellSubmit}
                      disabled={!currentInput || hasSubmitted}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                    >
                      Check
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sum Section */}
          {showSumSection && !hasSubmitted && (
            <div className="mt-8 p-6 bg-purple-900/20 rounded-xl border border-purple-500/30">
              <h4 className="text-sm font-mono uppercase tracking-wider text-purple-400 mb-4">
                Step 2: Add All Partial Products
              </h4>
              <div className="mb-4">
                <div className="text-center font-mono text-slate-300">
                  {Array.from(cellStates.values())
                    .filter(s => s.isCorrect)
                    .map(s => s.studentAnswer)
                    .join(' + ')}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the sum of all partial products?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={sumInput}
                      onChange={(e) => setSumInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSumSubmit();
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                      placeholder="Enter sum"
                    />
                    <button
                      onClick={() => {
                        console.log('Button clicked!', { sumInput, hasSubmitted });
                        handleSumSubmit();
                      }}
                      disabled={!sumInput || isSubmitting || hasSubmitted}
                      className="px-6 py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Final Answer'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Section */}
          {(hasSubmitted || sumAttempted) && (
            <div className={`mt-8 p-6 rounded-xl border ${
              sumCorrect
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-yellow-900/20 border-yellow-500/30'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className={`text-lg font-bold ${sumCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
                  {sumCorrect ? '✓ Perfect! All correct!' : 'Good effort!'}
                </h4>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                >
                  Try Another Problem
                </button>
              </div>

              <div className="text-sm text-slate-300 space-y-2">
                <p>You completed {correctCells} of {totalCells} partial products correctly.</p>
                {sumCorrect ? (
                  <p>Your final answer of <span className="font-bold text-white">{sumInput}</span> is correct!</p>
                ) : (
                  <p>The correct answer is: <span className="font-bold text-white">{totalProduct}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              How to Use This Tool
            </h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">1.</span>
                <span>Click on each cell and calculate the partial product (e.g., 30 × 4 = 120)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">2.</span>
                <span>Complete all cells to unlock Step 2</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">3.</span>
                <span>Add all your partial products together to get the final answer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">4.</span>
                <span>This demonstrates the Distributive Property of multiplication</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaModel;
