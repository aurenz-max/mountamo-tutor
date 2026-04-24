'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePrimitiveEvaluation, type AreaModelMetrics } from '../../../evaluation';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface AreaModelData {
  title: string;
  description: string;
  challengeType?: 'build_model' | 'find_area' | 'perimeter' | 'multiply' | 'factor';
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
    challengeType,
    factor1Parts = [10, 2],
    factor2Parts = [10, 3],
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

  const isFactorMode = challengeType === 'factor';
  const isPerimeterMode = challengeType === 'perimeter';

  // Calculate totals
  const factor1Total = factor1Parts.reduce((sum, val) => sum + val, 0);
  const factor2Total = factor2Parts.reduce((sum, val) => sum + val, 0);
  const totalProduct = factor1Total * factor2Total;
  const totalCells = factor1Parts.length * factor2Parts.length;
  const totalPerimeter = 2 * (factor1Total + factor2Total);

  // Precompute partial products for factor mode
  const partialProducts = useMemo(() => {
    const products: number[][] = [];
    for (let row = 0; row < factor2Parts.length; row++) {
      products[row] = [];
      for (let col = 0; col < factor1Parts.length; col++) {
        products[row][col] = factor1Parts[col] * factor2Parts[row];
      }
    }
    return products;
  }, [factor1Parts, factor2Parts]);

  // === Forward mode state (build_model, find_area, multiply) ===
  const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [sumInput, setSumInput] = useState('');
  const [sumAttempted, setSumAttempted] = useState(false);
  const [sumCorrect, setSumCorrect] = useState<boolean | null>(null);

  // === Factor mode state ===
  const [factorTopInputs, setFactorTopInputs] = useState<string[]>(() =>
    factor1Parts.map(() => '')
  );
  const [factorLeftInputs, setFactorLeftInputs] = useState<string[]>(() =>
    factor2Parts.map(() => '')
  );
  const [factorChecked, setFactorChecked] = useState(false);
  const [factorTopCorrect, setFactorTopCorrect] = useState<(boolean | null)[]>(() =>
    factor1Parts.map(() => null)
  );
  const [factorLeftCorrect, setFactorLeftCorrect] = useState<(boolean | null)[]>(() =>
    factor2Parts.map(() => null)
  );
  const [factorAttempts, setFactorAttempts] = useState(0);

  // === Perimeter mode state ===
  const [perimeterInput, setPerimeterInput] = useState('');
  const [perimeterAttempts, setPerimeterAttempts] = useState(0);
  const [perimeterCorrect, setPerimeterCorrect] = useState<boolean | null>(null);

  // === Shared state ===
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

  // Handle cell selection (forward mode only — factor & perimeter skip this)
  const handleCellClick = (row: number, col: number) => {
    if (hasSubmitted || isFactorMode || isPerimeterMode) return;

    const cellState = getCellState(row, col);
    if (cellState?.isCorrect) return;

    setSelectedCell([row, col]);
    setCurrentInput(cellState?.studentAnswer || '');
  };

  // Handle input submission for a cell (forward mode)
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

  // Check if all cells are complete (forward mode)
  const allCellsComplete = (): boolean => {
    for (let row = 0; row < factor2Parts.length; row++) {
      for (let col = 0; col < factor1Parts.length; col++) {
        const state = getCellState(row, col);
        if (!state?.isCorrect) return false;
      }
    }
    return true;
  };

  // Handle sum submission (forward mode)
  const handleSumSubmit = () => {
    if (hasSubmitted || isSubmitting) return;
    if (!sumInput) return;

    setIsSubmitting(true);

    const studentSumNum = parseInt(sumInput, 10);
    const correctSum = totalProduct;
    const isCorrect = studentSumNum === correctSum;

    setSumAttempted(true);
    setSumCorrect(isCorrect);

    submitForwardEvaluation();

    setTimeout(() => setIsSubmitting(false), 1000);
  };

  // Submit evaluation for forward mode
  const submitForwardEvaluation = () => {
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

    const overallAccuracy = (partialProductAccuracy * 0.7) + (sumIsCorrect ? 30 : 0);

    const completedInOrder = checkCompletedInOrder();

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      evalMode: challengeType || 'default',
      targetProduct: totalProduct,
      studentProduct: studentSumNum,
      correctFinalAnswer: sumIsCorrect,
      totalPartialProducts: totalCells,
      correctPartialProducts: correctCount,
      incorrectPartialProducts: incorrectCount,
      skippedPartialProducts: skippedCount,
      attemptedSum: sumAttempted || true,
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
    submitResult(success, overallAccuracy, metrics, {
      cellStates: Array.from(cellStates.entries()),
      sumInput,
    });
  };

  // === Perimeter mode handlers ===

  const handlePerimeterSubmit = () => {
    if (hasSubmitted || isSubmitting) return;
    if (!perimeterInput) return;

    setIsSubmitting(true);
    const studentPerimeter = parseInt(perimeterInput, 10);
    const isCorrect = studentPerimeter === totalPerimeter;

    setPerimeterCorrect(isCorrect);
    setPerimeterAttempts((a) => a + 1);

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      evalMode: 'perimeter',
      targetProduct: totalPerimeter,
      studentProduct: studentPerimeter,
      correctFinalAnswer: isCorrect,
      totalPartialProducts: 0,
      correctPartialProducts: 0,
      incorrectPartialProducts: 0,
      skippedPartialProducts: 0,
      attemptedSum: true,
      correctSum: isCorrect,
      partialProductAccuracy: isCorrect ? 100 : 0,
      overallAccuracy: isCorrect ? 100 : 0,
      completedInOrder: true,
      attemptsPerCell: perimeterAttempts + 1,
      totalAttempts: perimeterAttempts + 1,
      isAlgebraic: false,
      usedDistributiveProperty: false,
    };

    submitResult(isCorrect, isCorrect ? 100 : 0, metrics, {
      perimeterInput,
      perimeterAttempts: perimeterAttempts + 1,
    });

    setTimeout(() => setIsSubmitting(false), 1000);
  };

  // === Factor mode handlers ===

  const handleFactorTopChange = (index: number, value: string) => {
    const next = [...factorTopInputs];
    next[index] = value;
    setFactorTopInputs(next);
    // Reset check state when editing
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorLeftChange = (index: number, value: string) => {
    const next = [...factorLeftInputs];
    next[index] = value;
    setFactorLeftInputs(next);
    if (factorChecked) {
      setFactorChecked(false);
      setFactorTopCorrect(factor1Parts.map(() => null));
      setFactorLeftCorrect(factor2Parts.map(() => null));
    }
  };

  const handleFactorCheck = () => {
    if (hasSubmitted || isSubmitting) return;
    setIsSubmitting(true);
    setFactorAttempts((a) => a + 1);

    const topNums = factorTopInputs.map((v) => parseInt(v, 10));
    const leftNums = factorLeftInputs.map((v) => parseInt(v, 10));

    // Validate each factor input against the expected value
    const topResults = topNums.map((n, i) => n === factor1Parts[i]);
    const leftResults = leftNums.map((n, i) => n === factor2Parts[i]);

    setFactorTopCorrect(topResults);
    setFactorLeftCorrect(leftResults);
    setFactorChecked(true);

    const allCorrect = topResults.every(Boolean) && leftResults.every(Boolean);

    if (allCorrect) {
      submitFactorEvaluation(topNums, leftNums, true);
    }

    setTimeout(() => setIsSubmitting(false), 500);
  };

  const submitFactorEvaluation = (topNums: number[], leftNums: number[], allCorrect: boolean) => {
    if (hasSubmitted) return;

    const totalInputs = factor1Parts.length + factor2Parts.length;
    const correctTop = topNums.filter((n, i) => n === factor1Parts[i]).length;
    const correctLeft = leftNums.filter((n, i) => n === factor2Parts[i]).length;
    const correctCount = correctTop + correctLeft;
    const accuracy = (correctCount / totalInputs) * 100;

    const metrics: AreaModelMetrics = {
      type: 'area-model',
      evalMode: 'factor',
      targetProduct: totalProduct,
      studentProduct: allCorrect ? totalProduct : 0,
      correctFinalAnswer: allCorrect,
      totalPartialProducts: totalCells,
      correctPartialProducts: allCorrect ? totalCells : 0,
      incorrectPartialProducts: allCorrect ? 0 : totalCells,
      skippedPartialProducts: 0,
      attemptedSum: false,
      correctSum: false,
      partialProductAccuracy: accuracy,
      overallAccuracy: accuracy,
      completedInOrder: true,
      attemptsPerCell: factorAttempts + 1,
      totalAttempts: factorAttempts + 1,
      isAlgebraic: algebraicMode || false,
      usedDistributiveProperty: false,
    };

    submitResult(allCorrect, accuracy, metrics, {
      factorTopInputs,
      factorLeftInputs,
      factorAttempts: factorAttempts + 1,
    });
  };

  // Check if cells were completed in order
  const checkCompletedInOrder = (): boolean => {
    const entries = Array.from(cellStates.entries());
    if (entries.length === 0) return true;

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
    setFactorTopInputs(factor1Parts.map(() => ''));
    setFactorLeftInputs(factor2Parts.map(() => ''));
    setFactorChecked(false);
    setFactorTopCorrect(factor1Parts.map(() => null));
    setFactorLeftCorrect(factor2Parts.map(() => null));
    setFactorAttempts(0);
    setPerimeterInput('');
    setPerimeterAttempts(0);
    setPerimeterCorrect(null);
    resetAttempt();
  };

  // Get cell color based on state (forward mode)
  const getCellColor = (row: number, col: number): string => {
    if (isFactorMode) {
      if (highlightCell && highlightCell[0] === row && highlightCell[1] === col) {
        return 'bg-yellow-500/40 border-yellow-400';
      }
      const colorIndex = (row + col) % 4;
      const colors = [
        'bg-slate-500/20 border-slate-400/50',
        'bg-purple-500/20 border-purple-400/50',
        'bg-pink-500/20 border-pink-400/50',
        'bg-indigo-500/20 border-indigo-400/50',
      ];
      return colors[colorIndex];
    }

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

  // Factor mode: check if all inputs are filled
  const allFactorInputsFilled = factorTopInputs.every((v) => v.trim() !== '') &&
    factorLeftInputs.every((v) => v.trim() !== '');
  const factorAllCorrect = factorChecked &&
    factorTopCorrect.every((v) => v === true) &&
    factorLeftCorrect.every((v) => v === true);

  // Helper to get input border style for factor mode
  const getFactorInputStyle = (isCorrect: boolean | null): string => {
    if (isCorrect === null) return 'border-slate-600 focus:border-blue-400';
    if (isCorrect) return 'border-green-400 bg-green-500/10';
    return 'border-red-400 bg-red-500/10';
  };

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
            <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 text-xs font-mono uppercase tracking-wider">
              {isFactorMode
                ? 'Factor Discovery'
                : isPerimeterMode
                  ? 'Perimeter Practice'
                  : algebraicMode
                    ? 'Algebraic Multiplication'
                    : 'Interactive Multiplication'}
            </Badge>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10 rounded-3xl"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <CardHeader className="relative z-10 text-center">
          <CardTitle className="text-xl text-slate-100">{data.title}</CardTitle>
          <CardDescription className="text-slate-300">{data.description}</CardDescription>
        </CardHeader>

        <CardContent className="relative z-10">
          {/* Progress Indicator — forward mode (multiplication) only */}
          {!isFactorMode && !isPerimeterMode && !hasSubmitted && (
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

          {/* Perimeter mode progress */}
          {isPerimeterMode && !hasSubmitted && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the perimeter of this rectangle
                </span>
                <span className="text-sm font-mono text-emerald-400">
                  {factor1Total} × {factor2Total}
                </span>
              </div>
              {perimeterAttempts > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {perimeterAttempts}
                </div>
              )}
            </div>
          )}

          {/* Factor mode progress */}
          {isFactorMode && !hasSubmitted && (
            <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">
                  Find the dimensions that produce these partial products
                </span>
                <span className="text-sm font-mono text-purple-400">
                  Total area = {totalProduct}
                </span>
              </div>
              {factorAttempts > 0 && (
                <div className="text-xs text-slate-500 mt-1">
                  Attempts: {factorAttempts}
                </div>
              )}
            </div>
          )}

          {/* Equation Display */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-3 text-2xl font-bold font-mono">
              {isFactorMode ? (
                <>
                  <span className="text-blue-300">?</span>
                  <span className="text-slate-500">&times;</span>
                  <span className="text-purple-300">?</span>
                  <span className="text-slate-500">=</span>
                  <span className="text-pink-300">{totalProduct}</span>
                </>
              ) : isPerimeterMode ? (
                <>
                  <span className="text-slate-400 text-lg">Perimeter =</span>
                  <span className="text-slate-500">2 &times; (</span>
                  <span className="text-blue-300">{factor1Total}</span>
                  <span className="text-slate-500">+</span>
                  <span className="text-purple-300">{factor2Total}</span>
                  <span className="text-slate-500">) =</span>
                  <span className="text-pink-300">?</span>
                </>
              ) : (
                <>
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
                  <span className="text-slate-500">&times;</span>
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
                </>
              )}
            </div>
          </div>

          {/* Area Model Grid */}
          <div className="flex justify-center items-center">
            <div className="relative inline-block">
              {/* Top dimension labels / inputs */}
              {isFactorMode ? (
                <div className="flex mb-2 ml-16">
                  {factor1Parts.map((part, index) => (
                    <div
                      key={`top-input-${index}`}
                      className="flex items-center justify-center"
                      style={{ width: `${Math.max(100, part * 8)}px` }}
                    >
                      <input
                        type="number"
                        value={factorTopInputs[index]}
                        onChange={(e) => handleFactorTopChange(index, e.target.value)}
                        disabled={hasSubmitted || factorAllCorrect}
                        className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm rounded-lg
                          bg-slate-700/80 text-blue-300 border ${getFactorInputStyle(factorTopCorrect[index])}
                          focus:outline-none focus:ring-1 focus:ring-blue-400
                          disabled:opacity-60`}
                        placeholder="?"
                      />
                    </div>
                  ))}
                </div>
              ) : showDimensions ? (
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
              ) : null}

              <div className="flex">
                {/* Left dimension labels / inputs */}
                {isFactorMode ? (
                  <div className="flex flex-col mr-2 justify-start">
                    {factor2Parts.map((part, index) => (
                      <div
                        key={`left-input-${index}`}
                        className="flex items-center justify-center"
                        style={{ height: `${Math.max(80, part * 6)}px` }}
                      >
                        <input
                          type="number"
                          value={factorLeftInputs[index]}
                          onChange={(e) => handleFactorLeftChange(index, e.target.value)}
                          disabled={hasSubmitted || factorAllCorrect}
                          className={`w-16 px-2 py-1 text-center font-mono font-bold text-sm rounded-lg
                            bg-slate-700/80 text-purple-300 border ${getFactorInputStyle(factorLeftCorrect[index])}
                            focus:outline-none focus:ring-1 focus:ring-purple-400
                            disabled:opacity-60`}
                          placeholder="?"
                        />
                      </div>
                    ))}
                  </div>
                ) : showDimensions ? (
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
                ) : null}

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
                            transition-all duration-300
                            ${isFactorMode || isPerimeterMode ? '' : 'cursor-pointer'}
                            ${getCellColor(rowIndex, colIndex)}
                            ${!isFactorMode && !isPerimeterMode && !cellState?.isCorrect && !hasSubmitted ? 'hover:scale-105' : ''}
                          `}
                          style={{
                            minHeight: `${Math.max(80, factor2Parts[rowIndex] * 6)}px`,
                            minWidth: `${Math.max(100, factor1Parts[colIndex] * 8)}px`,
                          }}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                          {isPerimeterMode ? (
                            /* Perimeter mode: empty rectangle interior — dimensions are on the outside */
                            null
                          ) : isFactorMode ? (
                            /* Factor mode: show the partial product */
                            <div className="text-center">
                              <div className="text-white font-mono font-bold text-lg">
                                {partialProducts[rowIndex][colIndex]}
                              </div>
                            </div>
                          ) : (
                            <>
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
                                  <div className="text-xs text-green-400 mt-1">&#x2713;</div>
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
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Section for Selected Cell — forward mode (multiplication) */}
          {!isFactorMode && !isPerimeterMode && selectedCell && !hasSubmitted && (
            <Card className="mt-8 bg-blue-900/20 border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-blue-400">
                  Step 1: Calculate Partial Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <Button
                      onClick={handleCellSubmit}
                      disabled={!currentInput || hasSubmitted}
                      variant="ghost"
                      className="bg-blue-500/80 text-white border border-blue-400/30 hover:bg-blue-500"
                    >
                      Check
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sum Section — forward mode (multiplication) */}
          {!isFactorMode && !isPerimeterMode && showSumSection && !hasSubmitted && (
            <Card className="mt-8 bg-purple-900/20 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-purple-400">
                  Step 2: Add All Partial Products
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  {Array.from(cellStates.values())
                    .filter(s => s.isCorrect)
                    .map(s => s.studentAnswer)
                    .join(' + ')}
                </div>
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
                    <Button
                      onClick={handleSumSubmit}
                      disabled={!sumInput || isSubmitting || hasSubmitted}
                      variant="ghost"
                      className="bg-purple-500/80 text-white border border-purple-400/30 hover:bg-purple-500"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Final Answer'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Perimeter mode: single input for the perimeter answer */}
          {isPerimeterMode && !hasSubmitted && (
            <Card className="mt-8 bg-emerald-900/20 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-emerald-400">
                  Find the Perimeter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center font-mono text-slate-300">
                  The rectangle has sides of {factor1Total} and {factor2Total}.
                  <br />
                  Perimeter = {factor1Total} + {factor2Total} + {factor1Total} + {factor2Total}
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">
                    What is the perimeter of this rectangle?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={perimeterInput}
                      onChange={(e) => {
                        setPerimeterInput(e.target.value);
                        if (perimeterCorrect !== null) setPerimeterCorrect(null);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handlePerimeterSubmit();
                        }
                      }}
                      className={`flex-1 px-4 py-2 bg-slate-700 border rounded-lg text-white font-mono ${
                        perimeterCorrect === true
                          ? 'border-green-400'
                          : perimeterCorrect === false
                            ? 'border-red-400'
                            : 'border-slate-600'
                      }`}
                      placeholder="Enter perimeter"
                      disabled={hasSubmitted}
                    />
                    <Button
                      onClick={handlePerimeterSubmit}
                      disabled={!perimeterInput || isSubmitting || hasSubmitted}
                      variant="ghost"
                      className="bg-emerald-500/80 text-white border border-emerald-400/30 hover:bg-emerald-500"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                  {perimeterCorrect === false && !hasSubmitted && (
                    <div className="mt-2 text-sm text-red-400">
                      Not quite. Remember: the perimeter is the total distance around the rectangle. Try adding all four sides.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Factor mode: Check Factors button */}
          {isFactorMode && !hasSubmitted && !factorAllCorrect && (
            <div className="mt-8 flex justify-center">
              <Button
                onClick={handleFactorCheck}
                disabled={!allFactorInputsFilled || isSubmitting}
                variant="ghost"
                className="bg-purple-500/80 text-white border border-purple-400/30 hover:bg-purple-500 px-8 py-3 text-lg"
              >
                {isSubmitting ? 'Checking...' : 'Check My Factors'}
              </Button>
            </div>
          )}

          {/* Factor mode: hint after wrong attempt */}
          {isFactorMode && factorChecked && !factorAllCorrect && !hasSubmitted && (
            <Card className="mt-6 bg-yellow-900/20 border-yellow-500/30">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-300">
                  Not quite! Look at the partial products in the grid. Each cell equals
                  its column header &times; its row header. Try using one cell to figure out
                  a dimension, then check the others.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Feedback Section — forward mode (multiplication) */}
          {!isFactorMode && !isPerimeterMode && (hasSubmitted || sumAttempted) && (
            <Card className={`mt-8 ${
              sumCorrect
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-yellow-900/20 border-yellow-500/30'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`text-lg font-bold ${sumCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
                    {sumCorrect ? '&#x2713; Perfect! All correct!' : 'Good effort!'}
                  </h4>
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    className="bg-slate-600/80 text-white border border-slate-500/30 hover:bg-slate-500"
                  >
                    Try Another Problem
                  </Button>
                </div>

                <div className="text-sm text-slate-300 space-y-2">
                  <p>You completed {correctCells} of {totalCells} partial products correctly.</p>
                  {sumCorrect ? (
                    <p>Your final answer of <span className="font-bold text-white">{sumInput}</span> is correct!</p>
                  ) : (
                    <p>The correct answer is: <span className="font-bold text-white">{totalProduct}</span></p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback Section — perimeter mode */}
          {isPerimeterMode && hasSubmitted && (
            <Card className={`mt-8 ${
              perimeterCorrect
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-yellow-900/20 border-yellow-500/30'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`text-lg font-bold ${perimeterCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
                    {perimeterCorrect ? '✓ Correct!' : 'Good effort!'}
                  </h4>
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    className="bg-slate-600/80 text-white border border-slate-500/30 hover:bg-slate-500"
                  >
                    Try Another Problem
                  </Button>
                </div>

                <div className="text-sm text-slate-300 space-y-2">
                  <p>
                    Perimeter = 2 &times; ({factor1Total} + {factor2Total})
                    = 2 &times; {factor1Total + factor2Total}
                    = <span className="font-bold text-white">{totalPerimeter}</span>
                  </p>
                  {!perimeterCorrect && (
                    <p>You entered <span className="font-bold text-white">{perimeterInput}</span>.</p>
                  )}
                  {perimeterAttempts > 1 && (
                    <p className="text-slate-400">
                      Solved in {perimeterAttempts} {perimeterAttempts === 1 ? 'attempt' : 'attempts'}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback Section — factor mode */}
          {isFactorMode && (hasSubmitted || factorAllCorrect) && (
            <Card className="mt-8 bg-green-900/20 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-green-400">
                    &#x2713; You found the factors!
                  </h4>
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    className="bg-slate-600/80 text-white border border-slate-500/30 hover:bg-slate-500"
                  >
                    Try Another Problem
                  </Button>
                </div>

                <div className="text-sm text-slate-300 space-y-2">
                  <p>
                    The factors are ({factor1Parts.join(' + ')}) &times; ({factor2Parts.join(' + ')})
                    = {factor1Total} &times; {factor2Total} = {totalProduct}
                  </p>
                  {factorAttempts > 1 && (
                    <p className="text-slate-400">
                      Solved in {factorAttempts} {factorAttempts === 1 ? 'attempt' : 'attempts'}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="instructions" className="border-white/10 bg-slate-800/30 rounded-xl px-6">
              <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline">
                <span className="text-sm font-mono uppercase tracking-wider text-slate-400">
                  How to Use This Tool
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-4">
                {isFactorMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">1</Badge>
                      <span>Look at the partial products shown in each cell of the grid</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">2</Badge>
                      <span>Figure out what numbers go on top and on the left side</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">3</Badge>
                      <span>Each cell = its column header &times; its row header</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-purple-500/20 border-purple-500/30 text-purple-400 mt-0.5">4</Badge>
                      <span>Type your answers into the input fields and click &quot;Check My Factors&quot;</span>
                    </li>
                  </ul>
                ) : isPerimeterMode ? (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">1</Badge>
                      <span>Look at the two side lengths labeled on the rectangle</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">2</Badge>
                      <span>Perimeter is the total distance around the outside of a shape</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">3</Badge>
                      <span>Rectangle shortcut: Perimeter = 2 &times; (length + width)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 mt-0.5">4</Badge>
                      <span>Type your answer and press Submit</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="text-sm text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">1</Badge>
                      <span>Click on each cell and calculate the partial product (e.g., 30 &times; 4 = 120)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">2</Badge>
                      <span>Complete all cells to unlock Step 2</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">3</Badge>
                      <span>Add all your partial products together to get the final answer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge className="bg-blue-500/20 border-blue-500/30 text-blue-400 mt-0.5">4</Badge>
                      <span>This demonstrates the Distributive Property of multiplication</span>
                    </li>
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaModel;
