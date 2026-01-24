'use client';

import React, { useState } from 'react';
import {
  usePrimitiveEvaluation,
  type ArrayGridMetrics,
} from '../../../evaluation';

/**
 * Array Grid - Interactive array builder for teaching multiplication
 *
 * K-5 Math Primitive for understanding:
 * - Multiplication as repeated addition (K-2)
 * - Array models for multiplication (2-3)
 * - Commutative property (a×b = b×a) (3-4)
 *
 * Task: Student builds an array with given dimensions, then calculates total
 */

export interface ArrayGridData {
  title: string;
  description: string;

  // Task configuration
  targetRows: number; // Required: number of rows to build (e.g., 3)
  targetColumns: number; // Required: number of columns to build (e.g., 5)

  // Display options
  iconType?: 'dot' | 'square' | 'star';
  showLabels?: boolean; // Show row/column numbers (default true)
  maxRows?: number; // Maximum rows in button panel (default 10)
  maxColumns?: number; // Maximum columns in button panel (default 12)

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: import('../../../evaluation').PrimitiveEvaluationResult<ArrayGridMetrics>
  ) => void;
}

interface ArrayGridProps {
  data: ArrayGridData;
  className?: string;
}

const ArrayGrid: React.FC<ArrayGridProps> = ({ data, className }) => {
  const {
    title,
    description,
    targetRows,
    targetColumns,
    iconType = 'star',
    showLabels = true,
    maxRows = 10,
    maxColumns = 12,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [currentRows, setCurrentRows] = useState(0);
  const [currentColumns, setCurrentColumns] = useState(0);
  const [totalAnswer, setTotalAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'hint' | null>(null);

  const targetProduct = targetRows * targetColumns;
  const arrayBuilt = currentRows === targetRows && currentColumns === targetColumns;

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<ArrayGridMetrics>({
    primitiveType: 'array-grid',
    instanceId: instanceId || `array-grid-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as
      | ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void)
      | undefined,
  });

  // Handler for row changes
  const handleRowChange = (newRows: number) => {
    if (hasSubmittedEvaluation) return;
    setCurrentRows(newRows);
    setFeedback(null);
  };

  // Handler for column changes
  const handleColumnChange = (newColumns: number) => {
    if (hasSubmittedEvaluation) return;
    setCurrentColumns(newColumns);
    setFeedback(null);
  };

  // Submit handler for evaluation
  const handleSubmit = () => {
    if (hasSubmittedEvaluation) return;

    const studentTotal = parseInt(totalAnswer, 10);
    const correctArray = currentRows === targetRows && currentColumns === targetColumns;
    const correctTotal = studentTotal === targetProduct;

    let success = false;
    let score = 0;

    if (correctArray && correctTotal) {
      success = true;
      score = 100;
      setFeedback(
        `Perfect! You built a ${currentRows} × ${currentColumns} array and correctly calculated ${studentTotal} total items.`
      );
      setFeedbackType('success');
    } else if (correctArray && !correctTotal) {
      score = 50;
      setFeedback(
        `You built the array correctly (${currentRows} × ${currentColumns}), but your total is incorrect. Count again!`
      );
      setFeedbackType('hint');
    } else if (!correctArray && correctTotal) {
      score = 50;
      setFeedback(
        `Your total (${studentTotal}) would be correct for a different array. Build ${targetRows} rows × ${targetColumns} columns.`
      );
      setFeedbackType('hint');
    } else {
      score = 0;
      setFeedback(
        `Not quite. First, build the array with ${targetRows} rows and ${targetColumns} columns, then count the total.`
      );
      setFeedbackType('error');
    }

    const metrics: ArrayGridMetrics = {
      type: 'array-grid',
      taskType: 'build',
      goalMet: success,
      finalRows: currentRows,
      finalColumns: currentColumns,
      totalItems: currentRows * currentColumns,
      targetProduct,
      productCorrect: correctTotal,
      dimensionsCorrect: correctArray,
      rowChanges: 0,
      columnChanges: 0,
      cellClicks: 0,
      finalConfiguration: {
        rows: currentRows,
        columns: currentColumns,
        partitionLines: [],
        highlightedCells: [],
      },
    };

    submitEvaluation(success, score, metrics, {
      studentWork: { rows: currentRows, columns: currentColumns, total: studentTotal },
    });
  };

  // Reset handler
  const handleReset = () => {
    setCurrentRows(0);
    setCurrentColumns(0);
    setTotalAnswer('');
    setFeedback(null);
    setFeedbackType(null);
    resetEvaluationAttempt();
  };

  // Render icon based on type
  const renderIcon = () => {
    const baseClass = 'fill-blue-400/80';

    switch (iconType) {
      case 'dot':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );

      case 'square':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" className={baseClass} />
          </svg>
        );

      case 'star':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              className={baseClass}
            />
          </svg>
        );

      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" className={baseClass} />
          </svg>
        );
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 6v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Array Builder</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-xs text-green-400 font-mono uppercase tracking-wider">
              Build & Multiply
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-green-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Step 1: Build the Array */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-green-300 mb-4 text-center">
              Step 1: Build the Array
            </h4>

            <div className="flex flex-col items-center gap-6">
              {/* Row Controls */}
              <div className="flex items-center gap-4">
                <span className="text-green-300 font-semibold w-24 text-right">Rows:</span>
                <div className="flex gap-2 flex-wrap max-w-2xl">
                  {Array.from({ length: Math.min(maxRows, 6) }, (_, i) => i + 1).map((num) => (
                    <button
                      key={`row-${num}`}
                      onClick={() => handleRowChange(num)}
                      disabled={hasSubmittedEvaluation}
                      className={`w-10 h-10 rounded-lg font-bold transition-all ${
                        currentRows === num
                          ? 'bg-green-500 text-white scale-110 shadow-lg'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Controls */}
              <div className="flex items-center gap-4">
                <span className="text-blue-300 font-semibold w-24 text-right">Columns:</span>
                <div className="flex gap-2 flex-wrap max-w-2xl">
                  {Array.from({ length: Math.min(maxColumns, 8) }, (_, i) => i + 1).map((num) => (
                    <button
                      key={`col-${num}`}
                      onClick={() => handleColumnChange(num)}
                      disabled={hasSubmittedEvaluation}
                      className={`w-10 h-10 rounded-lg font-bold transition-all ${
                        currentColumns === num
                          ? 'bg-blue-500 text-white scale-110 shadow-lg'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Array Grid */}
          {currentRows > 0 && currentColumns > 0 && (
            <div className="flex justify-center items-center mb-8">
              <div className="relative inline-block">
                {/* Column Labels */}
                {showLabels && (
                  <div className="flex mb-2" style={{ marginLeft: showLabels ? '40px' : '0' }}>
                    {Array.from({ length: currentColumns }).map((_, index) => (
                      <div
                        key={`col-label-${index}`}
                        className="flex items-center justify-center text-blue-300 font-mono font-bold text-sm w-16"
                      >
                        {index + 1}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex">
                  {/* Row Labels */}
                  {showLabels && (
                    <div className="flex flex-col mr-2">
                      {Array.from({ length: currentRows }).map((_, index) => (
                        <div
                          key={`row-label-${index}`}
                          className="flex items-center justify-center text-green-300 font-mono font-bold text-sm h-16 w-10"
                        >
                          {index + 1}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grid */}
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${currentColumns}, 64px)`,
                    }}
                  >
                    {Array.from({ length: currentRows }).map((_, rowIndex) =>
                      Array.from({ length: currentColumns }).map((_, colIndex) => {
                        const cellKey = `${rowIndex}-${colIndex}`;

                        return (
                          <div
                            key={cellKey}
                            className="w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-200 border-2 bg-slate-800/30 border-slate-600"
                          >
                            {renderIcon()}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Calculate Total */}
          {arrayBuilt && !hasSubmittedEvaluation && (
            <div className="mb-8 animate-fade-in">
              <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">
                Step 2: How many {iconType}s in total?
              </h4>

              <div className="flex justify-center items-center gap-4">
                <label className="text-slate-300 font-semibold">Total:</label>
                <input
                  type="number"
                  value={totalAnswer}
                  onChange={(e) => setTotalAnswer(e.target.value)}
                  placeholder="Enter total"
                  className="px-4 py-2 w-32 bg-slate-800 border border-slate-600 rounded-lg text-white text-center font-mono text-xl focus:outline-none focus:border-purple-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && totalAnswer) handleSubmit();
                  }}
                />
                <span className="text-slate-300">{iconType}s</span>
              </div>
            </div>
          )}

          {/* Feedback Display */}
          {feedback && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                feedbackType === 'success'
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : feedbackType === 'error'
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
              }`}
            >
              <div className="flex items-start gap-3">
                {feedbackType === 'success' && (
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {feedbackType === 'error' && (
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {feedbackType === 'hint' && (
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <p className="font-medium">{feedback}</p>
              </div>
            </div>
          )}

          {/* Submit/Reset Controls */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={handleSubmit}
              disabled={hasSubmittedEvaluation || !arrayBuilt || !totalAnswer}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {hasSubmittedEvaluation ? 'Submitted ✓' : 'Check Answer'}
            </button>
            {hasSubmittedEvaluation && (
              <button
                onClick={handleReset}
                className="px-8 py-3 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-500 transition-all duration-200 shadow-lg"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">Instructions</h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>
                  Click the row and column buttons to build an array with {targetRows} rows and {targetColumns}{' '}
                  columns
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>Once you've built the correct array, count the total number of {iconType}s</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>Enter your answer and click "Check Answer" to see if you're correct</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">▸</span>
                <span>
                  This helps you understand multiplication as rows × columns = total items
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArrayGrid;
