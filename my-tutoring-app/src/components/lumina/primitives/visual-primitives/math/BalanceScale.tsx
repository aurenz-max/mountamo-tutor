'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { BalanceScaleMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface BalanceScaleObject {
  value: number;
  label?: string;
  isVariable?: boolean;
}

export interface BalanceScaleChallenge {
  type: 'equality' | 'one_step' | 'two_step';
  instruction: string;
  leftSide: BalanceScaleObject[];
  rightSide: BalanceScaleObject[];
  variableValue: number;
  hint: string;
}

export interface BalanceScaleData {
  title: string;
  description: string;
  leftSide: BalanceScaleObject[];
  rightSide: BalanceScaleObject[];
  variableValue: number;
  showTilt?: boolean;
  allowOperations?: ('add' | 'subtract' | 'multiply' | 'divide')[];
  stepHistory?: string[];
  gradeBand?: 'K-2' | '3-4' | '5';
  challenges?: BalanceScaleChallenge[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BalanceScaleMetrics>) => void;
}

// ============================================================================
// Types
// ============================================================================

type Phase = 'explore' | 'identify' | 'solve' | 'verify';

const PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  explore: { label: 'Explore', description: 'Look at both sides of the scale' },
  identify: { label: 'Identify', description: 'What equation does this show?' },
  solve: { label: 'Solve', description: 'Isolate the variable' },
  verify: { label: 'Verify', description: 'Check your answer' },
};

interface StepEntry {
  description: string;
  justification: string;
  leftSnapshot: BalanceScaleObject[];
  rightSnapshot: BalanceScaleObject[];
}

// ============================================================================
// Component
// ============================================================================

interface BalanceScaleProps {
  data: BalanceScaleData;
  className?: string;
}

const BalanceScale: React.FC<BalanceScaleProps> = ({ data, className }) => {
  const {
    title,
    description,
    leftSide: initialLeft = [],
    rightSide: initialRight = [],
    variableValue,
    showTilt = true,
    allowOperations = ['add', 'subtract'],
    gradeBand = '3-4',
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [currentLeft, setCurrentLeft] = useState<BalanceScaleObject[]>(initialLeft);
  const [currentRight, setCurrentRight] = useState<BalanceScaleObject[]>(initialRight);
  const [phase, setPhase] = useState<Phase>('explore');
  const [userSteps, setUserSteps] = useState<StepEntry[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [selectedOp, setSelectedOp] = useState<'add' | 'subtract' | 'multiply' | 'divide' | null>(null);
  const [opValue, setOpValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [verifyInput, setVerifyInput] = useState('');

  // Challenge state
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeResults, setChallengeResults] = useState<Array<{ correct: boolean; steps: number; attempts: number }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Drag state
  const [draggedBlock, setDraggedBlock] = useState<BalanceScaleObject | null>(null);
  const [dropTarget, setDropTarget] = useState<'left' | 'right' | null>(null);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `balance-scale-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Computed
  const currentChallenge = challenges[currentChallengeIndex] || null;
  const activeVariableValue = currentChallenge?.variableValue ?? variableValue;

  const calcSideValue = useCallback((side: BalanceScaleObject[]): number => {
    return side.reduce((sum, obj) => sum + (obj.isVariable ? activeVariableValue : obj.value), 0);
  }, [activeVariableValue]);

  const leftValue = useMemo(() => calcSideValue(currentLeft), [calcSideValue, currentLeft]);
  const rightValue = useMemo(() => calcSideValue(currentRight), [calcSideValue, currentRight]);
  const isBalanced = Math.abs(leftValue - rightValue) < 0.01;

  const tiltAngle = useMemo(() => {
    if (!showTilt || isBalanced) return 0;
    return Math.max(-15, Math.min(15, (leftValue - rightValue) * 0.5));
  }, [showTilt, isBalanced, leftValue, rightValue]);

  const formatObj = (obj: BalanceScaleObject) => obj.isVariable ? (obj.label || 'x') : (obj.label || String(obj.value));
  const formatEquation = (left: BalanceScaleObject[], right: BalanceScaleObject[]) =>
    `${left.map(formatObj).join(' + ') || '0'} = ${right.map(formatObj).join(' + ') || '0'}`;

  const isSolved = useMemo(() => {
    const leftOnlyVar = currentLeft.length === 1 && currentLeft[0].isVariable && currentRight.every(o => !o.isVariable) && currentRight.length >= 1;
    const rightOnlyVar = currentRight.length === 1 && currentRight[0].isVariable && currentLeft.every(o => !o.isVariable) && currentLeft.length >= 1;
    return leftOnlyVar || rightOnlyVar;
  }, [currentLeft, currentRight]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<BalanceScaleMetrics>({
    primitiveType: 'balance-scale',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    targetEquation: formatEquation(initialLeft, initialRight),
    currentEquation: formatEquation(currentLeft, currentRight),
    variableValue: activeVariableValue,
    gradeBand,
    phase,
    stepCount: userSteps.length,
    isSolved,
    isBalanced,
    attemptNumber: currentAttempts + 1,
    leftSide: currentLeft.map(formatObj),
    rightSide: currentRight.map(formatObj),
  }), [initialLeft, initialRight, currentLeft, currentRight, activeVariableValue, gradeBand, phase, userSteps.length, isSolved, isBalanced, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'balance-scale',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Grade 1' : gradeBand === '3-4' ? 'Grade 3' : 'Grade 5',
  });

  // Introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    const eq = formatEquation(initialLeft, initialRight);
    sendText(
      `[ACTIVITY_START] Balance scale equation: ${eq}. Grade band: ${gradeBand}. `
      + `${gradeBand === 'K-2' ? 'Use concrete language — "mystery number" not "variable".' : ''} `
      + `Introduce: "Look at this balance scale! Can you find the mystery number?"`,
      { silent: true }
    );
  }, [isConnected, initialLeft, initialRight, gradeBand, sendText]);

  // Phase transitions
  useEffect(() => {
    if (isSolved && phase === 'solve') {
      setPhase('verify');
      sendText(
        `[PHASE_TRANSITION] Student isolated the variable! Moving to Verify phase. `
        + `Ask: "You found that the mystery number might be ${activeVariableValue}. Can you check?"`,
        { silent: true }
      );
    }
  }, [isSolved, phase, activeVariableValue, sendText]);

  // -------------------------------------------------------------------------
  // Interaction Handlers
  // -------------------------------------------------------------------------
  const addStep = useCallback((desc: string, justification: string) => {
    setUserSteps(prev => [...prev, {
      description: desc,
      justification,
      leftSnapshot: [...currentLeft],
      rightSnapshot: [...currentRight],
    }]);
  }, [currentLeft, currentRight]);

  const removeObject = useCallback((side: 'left' | 'right', index: number) => {
    if (hasSubmittedEvaluation) return;
    if (phase === 'explore') setPhase('solve');

    const obj = side === 'left' ? currentLeft[index] : currentRight[index];
    if (!obj) return;

    const otherSide = side === 'left' ? currentRight : currentLeft;
    const otherIdx = otherSide.findIndex(o => o.isVariable === obj.isVariable && o.value === obj.value);

    if (otherIdx === -1) {
      setFeedback('To keep balanced, remove the same value from both sides!');
      setFeedbackType('error');
      sendText(
        `[BALANCE_ERROR] Student tried to remove ${formatObj(obj)} from only one side. `
        + `Remind: "What you do to one side, you must do to the other!"`,
        { silent: true }
      );
      return;
    }

    const newLeft = side === 'left'
      ? currentLeft.filter((_, i) => i !== index)
      : currentLeft.filter((_, i) => i !== otherIdx);
    const newRight = side === 'right'
      ? currentRight.filter((_, i) => i !== index)
      : currentRight.filter((_, i) => i !== otherIdx);

    setCurrentLeft(newLeft);
    setCurrentRight(newRight);

    const desc = `Removed ${formatObj(obj)} from both sides`;
    addStep(desc, `Subtract ${formatObj(obj)} to simplify`);
    setFeedback(desc);
    setFeedbackType('success');

    sendText(
      `[STEP_TAKEN] ${desc}. Equation is now: ${formatEquation(newLeft, newRight)}. `
      + `${newLeft.length <= 2 && newRight.length <= 2 ? 'Getting close! Encourage.' : 'Good step.'}`,
      { silent: true }
    );
  }, [hasSubmittedEvaluation, phase, currentLeft, currentRight, addStep, sendText]);

  const applyOperation = useCallback(() => {
    if (!selectedOp || !opValue || hasSubmittedEvaluation) return;
    if (phase === 'explore') setPhase('solve');

    const value = parseFloat(opValue);
    if (isNaN(value) || value <= 0) {
      setFeedback('Enter a valid positive number');
      setFeedbackType('error');
      return;
    }

    let newLeft = [...currentLeft];
    let newRight = [...currentRight];
    let desc = '';

    if (selectedOp === 'add') {
      newLeft.push({ value, label: String(value) });
      newRight.push({ value, label: String(value) });
      desc = `Added ${value} to both sides`;
    } else if (selectedOp === 'subtract') {
      const leftIdx = newLeft.findIndex(o => !o.isVariable && o.value === value);
      const rightIdx = newRight.findIndex(o => !o.isVariable && o.value === value);
      if (leftIdx === -1 || rightIdx === -1) {
        setFeedback(`Need ${value} on both sides to subtract!`);
        setFeedbackType('error');
        return;
      }
      newLeft.splice(leftIdx, 1);
      newRight.splice(rightIdx, 1);
      desc = `Subtracted ${value} from both sides`;
    } else if (selectedOp === 'multiply') {
      newLeft = newLeft.map(o => ({ ...o, value: o.value * value, label: o.isVariable ? `${value}${o.label || 'x'}` : String(o.value * value) }));
      newRight = newRight.map(o => ({ ...o, value: o.value * value, label: o.isVariable ? `${value}${o.label || 'x'}` : String(o.value * value) }));
      desc = `Multiplied both sides by ${value}`;
    } else if (selectedOp === 'divide') {
      newLeft = newLeft.map(o => ({ ...o, value: o.value / value, label: o.isVariable ? `${o.label || 'x'}/${value}` : String(o.value / value) }));
      newRight = newRight.map(o => ({ ...o, value: o.value / value, label: o.isVariable ? `${o.label || 'x'}/${value}` : String(o.value / value) }));
      desc = `Divided both sides by ${value}`;
    }

    setCurrentLeft(newLeft);
    setCurrentRight(newRight);
    addStep(desc, `${selectedOp} ${value} to isolate variable`);
    setOpValue('');
    setSelectedOp(null);
    setFeedback(desc);
    setFeedbackType('success');

    sendText(
      `[STEP_TAKEN] ${desc}. Equation is now: ${formatEquation(newLeft, newRight)}.`,
      { silent: true }
    );
  }, [selectedOp, opValue, hasSubmittedEvaluation, phase, currentLeft, currentRight, addStep, sendText]);

  // Drag handlers
  const handleDragStart = (block: BalanceScaleObject) => setDraggedBlock(block);
  const handleDragOver = (e: React.DragEvent, side: 'left' | 'right') => { e.preventDefault(); setDropTarget(side); };
  const handleDragLeave = () => setDropTarget(null);
  const handleDrop = useCallback((e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedBlock || hasSubmittedEvaluation) return;
    const block = { ...draggedBlock };
    if (side === 'left') setCurrentLeft(prev => [...prev, block]);
    else setCurrentRight(prev => [...prev, block]);
    addStep(`Added ${formatObj(block)} to ${side} side`, 'Add block');
    setDraggedBlock(null);
    setDropTarget(null);
  }, [draggedBlock, hasSubmittedEvaluation, addStep]);

  // Verify
  const handleVerify = useCallback(() => {
    const answer = parseFloat(verifyInput);
    const correct = Math.abs(answer - activeVariableValue) < 0.01;
    setCurrentAttempts(a => a + 1);

    if (correct) {
      setFeedback(`Correct! x = ${activeVariableValue}`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student verified x = ${activeVariableValue}. Celebrate!`, { silent: true });

      if (challenges.length > 0) {
        setChallengeResults(prev => [...prev, { correct: true, steps: userSteps.length, attempts: currentAttempts + 1 }]);
      } else if (!hasSubmittedEvaluation) {
        const eq = formatEquation(initialLeft, initialRight);
        const metrics: BalanceScaleMetrics = {
          type: 'balance-scale',
          targetEquation: eq,
          solutionFound: true,
          solutionValue: activeVariableValue,
          operationsPerformed: userSteps.map(s => ({
            operation: 'subtract' as const,
            value: 0,
            side: 'both' as const,
          })),
          stepsToSolve: userSteps.length,
          optimalSteps: (data.stepHistory?.length ?? 3) - 1,
          efficiency: Math.min(1, ((data.stepHistory?.length ?? 3) - 1) / Math.max(userSteps.length, 1)),
          phaseProgression: ['explore', 'solve', 'verify'],
          balanceMaintained: true,
          attemptsCount: currentAttempts + 1,
        };
        submitEvaluation(true, 100, metrics, { steps: userSteps });
      }
    } else {
      setFeedback(`${answer} is not correct. Check your work!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student guessed x = ${answer} but it's ${activeVariableValue}. `
        + `Hint: "Substitute your answer back into the original equation. Does it balance?"`,
        { silent: true }
      );
    }
  }, [verifyInput, activeVariableValue, currentAttempts, challenges.length, hasSubmittedEvaluation, initialLeft, initialRight, userSteps, data.stepHistory, submitEvaluation, sendText]);

  // Challenge advance
  const advanceChallenge = useCallback(() => {
    const nextIdx = currentChallengeIndex + 1;
    if (nextIdx >= challenges.length) {
      sendText(`[ALL_COMPLETE] All ${challenges.length} equations solved! Celebrate.`, { silent: true });
      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const avgSteps = challengeResults.reduce((s, r) => s + r.steps, 0) / Math.max(challengeResults.length, 1);
        const metrics: BalanceScaleMetrics = {
          type: 'balance-scale',
          targetEquation: formatEquation(initialLeft, initialRight),
          solutionFound: true,
          solutionValue: activeVariableValue,
          operationsPerformed: [],
          stepsToSolve: Math.round(avgSteps),
          optimalSteps: 2,
          efficiency: Math.min(1, 2 / Math.max(avgSteps, 1)),
          phaseProgression: ['explore', 'solve', 'verify'],
          balanceMaintained: true,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };
        submitEvaluation(correctCount === challenges.length, Math.round((correctCount / challenges.length) * 100), metrics, { challengeResults });
      }
      return;
    }
    const next = challenges[nextIdx];
    setCurrentChallengeIndex(nextIdx);
    setCurrentLeft(next.leftSide);
    setCurrentRight(next.rightSide);
    setPhase('explore');
    setUserSteps([]);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setVerifyInput('');
    setShowSolution(false);
    sendText(`[NEXT_ITEM] Challenge ${nextIdx + 1}: "${next.instruction}". Introduce the equation.`, { silent: true });
  }, [currentChallengeIndex, challenges, challengeResults, hasSubmittedEvaluation, initialLeft, initialRight, activeVariableValue, submitEvaluation, sendText]);

  const handleReset = useCallback(() => {
    const left = currentChallenge?.leftSide ?? initialLeft;
    const right = currentChallenge?.rightSide ?? initialRight;
    setCurrentLeft(left);
    setCurrentRight(right);
    setPhase('explore');
    setUserSteps([]);
    setFeedback('');
    setFeedbackType('');
    setVerifyInput('');
    setShowSolution(false);
    setSelectedOp(null);
    setOpValue('');
  }, [currentChallenge, initialLeft, initialRight]);

  const isCurrentComplete = challenges.length > 0 && challengeResults.length > currentChallengeIndex && challengeResults[currentChallengeIndex]?.correct;
  const allComplete = challenges.length > 0 && challengeResults.filter(r => r.correct).length >= challenges.length;

  // Block palette
  const availableBlocks: BalanceScaleObject[] = [
    { value: 1, label: '1' },
    { value: 5, label: '5' },
    { value: 10, label: '10' },
  ];

  const getObjStyle = (obj: BalanceScaleObject) =>
    obj.isVariable
      ? 'bg-gradient-to-br from-purple-500/80 to-pink-500/80 border-purple-400/50'
      : 'bg-gradient-to-br from-blue-500/80 to-cyan-500/80 border-blue-400/50';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-green-300 text-xs">{gradeBand}</Badge>
            {challenges.length > 0 && (
              <span className="text-slate-500 text-xs">
                {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
              </span>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {currentChallenge?.instruction ?? description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(PHASE_CONFIG).map(([p, config]) => (
            <Badge key={p} className={`text-xs ${
              phase === p
                ? 'bg-green-500/20 border-green-400/50 text-green-300'
                : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
            }`}>
              {config.label}
            </Badge>
          ))}
        </div>

        {/* Balance Status */}
        <div className="flex justify-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono ${
            isBalanced
              ? 'bg-green-500/15 border border-green-500/40 text-green-300'
              : 'bg-yellow-500/15 border border-yellow-500/40 text-yellow-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
            {isBalanced ? 'BALANCED' : 'UNBALANCED'}
            {isSolved && <span className="text-purple-300 ml-2">SOLVED</span>}
          </div>
        </div>

        {/* Scale Visual */}
        <div className="relative flex justify-center" style={{ minHeight: 220 }}>
          {/* Beam */}
          <div
            className="absolute w-full max-w-lg h-2 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-full shadow-lg transition-transform duration-700"
            style={{ top: 50, transform: `rotate(${tiltAngle}deg)`, transformOrigin: 'center' }}
          />
          {/* Pivot */}
          <div className="absolute" style={{ top: 46 }}>
            <div className="w-6 h-6 bg-slate-700 rounded-full border-3 border-slate-500 shadow-xl z-10" />
          </div>
          {/* Fulcrum */}
          <div className="absolute" style={{ top: 60 }}>
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[35px] border-b-slate-700" />
          </div>

          {/* Left Pan */}
          <div
            className="absolute left-4 sm:left-8"
            style={{ top: 50 + tiltAngle * 1.5 }}
            onDragOver={e => handleDragOver(e, 'left')}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, 'left')}
          >
            <div className="w-36 h-3 bg-gradient-to-b from-slate-500 to-slate-600 rounded-t" />
            <div className={`w-36 min-h-[80px] bg-slate-700/30 rounded-b-xl border ${
              dropTarget === 'left' ? 'border-green-400/60' : 'border-slate-600/40'
            } backdrop-blur-sm p-2 flex flex-wrap gap-1.5 items-center justify-center`}>
              {currentLeft.length === 0 && <span className="text-slate-600 text-xs italic">Empty</span>}
              {currentLeft.map((obj, i) => (
                <button
                  key={`l-${i}`}
                  onClick={() => removeObject('left', i)}
                  className={`${getObjStyle(obj)} border rounded-md px-2.5 py-1.5 text-white font-bold text-sm font-mono transition-all hover:scale-110 hover:ring-1 hover:ring-yellow-400 cursor-pointer min-w-[36px] text-center`}
                  title={`Click to remove ${formatObj(obj)} from both sides`}
                >
                  {formatObj(obj)}
                </button>
              ))}
            </div>
          </div>

          {/* Right Pan */}
          <div
            className="absolute right-4 sm:right-8"
            style={{ top: 50 - tiltAngle * 1.5 }}
            onDragOver={e => handleDragOver(e, 'right')}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, 'right')}
          >
            <div className="w-36 h-3 bg-gradient-to-b from-slate-500 to-slate-600 rounded-t" />
            <div className={`w-36 min-h-[80px] bg-slate-700/30 rounded-b-xl border ${
              dropTarget === 'right' ? 'border-green-400/60' : 'border-slate-600/40'
            } backdrop-blur-sm p-2 flex flex-wrap gap-1.5 items-center justify-center`}>
              {currentRight.length === 0 && <span className="text-slate-600 text-xs italic">Empty</span>}
              {currentRight.map((obj, i) => (
                <button
                  key={`r-${i}`}
                  onClick={() => removeObject('right', i)}
                  className={`${getObjStyle(obj)} border rounded-md px-2.5 py-1.5 text-white font-bold text-sm font-mono transition-all hover:scale-110 hover:ring-1 hover:ring-yellow-400 cursor-pointer min-w-[36px] text-center`}
                  title={`Click to remove ${formatObj(obj)} from both sides`}
                >
                  {formatObj(obj)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Equation Display */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Equation</p>
          <div className="flex items-center justify-center gap-3 text-lg font-mono font-bold">
            <span className="text-blue-300">{currentLeft.map(formatObj).join(' + ') || '0'}</span>
            <span className="text-slate-500">=</span>
            <span className="text-cyan-300">{currentRight.map(formatObj).join(' + ') || '0'}</span>
          </div>
          <div className="flex justify-center gap-6 mt-2 text-xs text-slate-500">
            <span>Left: <span className="text-blue-300 font-mono">{leftValue}</span></span>
            <span>Right: <span className="text-cyan-300 font-mono">{rightValue}</span></span>
          </div>
        </div>

        {/* Block Palette */}
        <div className="flex items-center gap-2 justify-center">
          <span className="text-slate-500 text-xs">Drag blocks:</span>
          {availableBlocks.map((block, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(block)}
              className="bg-gradient-to-br from-blue-500/80 to-cyan-500/80 border border-blue-400/50 rounded-md px-3 py-1.5 text-white font-bold text-sm font-mono cursor-grab active:cursor-grabbing hover:scale-105 transition-all"
            >
              {block.label}
            </div>
          ))}
        </div>

        {/* Operations Panel */}
        {phase === 'solve' && (
          <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Operations (apply to both sides)</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {allowOperations.map(op => (
                <Button
                  key={op}
                  variant="ghost"
                  size="sm"
                  className={`text-xs ${selectedOp === op ? 'bg-green-500/20 border-green-400/50 text-green-300' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
                  onClick={() => setSelectedOp(selectedOp === op ? null : op)}
                  disabled={hasSubmittedEvaluation}
                >
                  {op}
                </Button>
              ))}
              {selectedOp && (
                <>
                  <input
                    type="number"
                    min={1}
                    value={opValue}
                    onChange={e => setOpValue(e.target.value)}
                    className="w-14 px-2 py-1 bg-slate-800/50 border border-white/20 rounded text-slate-100 text-center text-sm focus:outline-none focus:border-green-400/50"
                    placeholder="#"
                    onKeyDown={e => e.key === 'Enter' && applyOperation()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-green-500/10 border border-green-400/30 text-green-300 text-xs"
                    onClick={applyOperation}
                  >
                    Apply
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Verify Phase */}
        {phase === 'verify' && !isCurrentComplete && !allComplete && (
          <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5 space-y-2">
            <p className="text-slate-300 text-sm">What is the value of x?</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-purple-300 font-mono font-bold">x =</span>
              <input
                type="number"
                value={verifyInput}
                onChange={e => setVerifyInput(e.target.value)}
                className="w-20 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-green-400/50"
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
              />
              <Button
                variant="ghost"
                className="bg-green-500/10 border border-green-400/30 text-green-300"
                onClick={handleVerify}
              >
                Check
              </Button>
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Solution reveal */}
        {isSolved && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="bg-purple-500/10 border border-purple-400/30 text-purple-300 text-xs"
              onClick={() => setShowSolution(!showSolution)}
            >
              {showSolution ? 'Hide' : 'Show'} Answer
            </Button>
          </div>
        )}
        {showSolution && (
          <div className="text-center">
            <span className="text-purple-300 font-mono font-bold text-xl">x = {activeVariableValue}</span>
          </div>
        )}

        {/* Steps History */}
        {userSteps.length > 0 && (
          <div className="bg-slate-800/20 rounded-lg p-3 border border-white/5 max-h-32 overflow-y-auto">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
              Steps ({userSteps.length})
            </p>
            <div className="space-y-1">
              {userSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 font-mono text-[9px] shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-slate-300">{step.description}</span>
                    <span className="text-slate-600 ml-1">({step.justification})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2">
          {isCurrentComplete && !allComplete && (
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceChallenge}
            >
              Next Challenge
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
            onClick={handleReset}
            disabled={hasSubmittedEvaluation}
          >
            Reset
          </Button>
          {phase === 'explore' && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-blue-500/10 border border-blue-400/30 text-blue-300"
              onClick={() => { setPhase('solve'); sendText('[PHASE_TRANSITION] Student ready to solve. Guide first step.', { silent: true }); }}
            >
              Start Solving
            </Button>
          )}
        </div>

        {allComplete && (
          <div className="text-center">
            <p className="text-emerald-400 text-sm font-medium mb-1">All equations solved!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center">
          <p className="text-slate-600 text-[10px]">
            Click blocks to remove from both sides. Drag blocks from palette. Use operations panel to apply to both sides.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceScale;
