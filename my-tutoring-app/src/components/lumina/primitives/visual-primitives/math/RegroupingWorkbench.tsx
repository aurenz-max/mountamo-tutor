'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RegroupingWorkbenchMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface RegroupingStep {
  place: 'ones' | 'tens' | 'hundreds';
  type: 'carry' | 'borrow';
  fromValue: number;
  toValue: number;
  narration: string;
}

export interface RegroupingChallenge {
  id: string;
  problem: string;
  requiresRegrouping: boolean;
  regroupCount: number;
  hint: string;
  narration: string;
}

export interface RegroupingWorkbenchData {
  title: string;
  description?: string;
  operation: 'addition' | 'subtraction';
  operand1: number;
  operand2: number;
  maxPlace: 'tens' | 'hundreds' | 'thousands';
  decimalMode?: boolean;
  initialState?: {
    blocksPlaced?: boolean;
    algorithmVisible?: boolean;
  };
  regroupingSteps?: RegroupingStep[];
  challenges: RegroupingChallenge[];
  showOptions?: {
    showAlgorithm?: boolean;
    showCarryBorrow?: boolean;
    showPlaceColumns?: boolean;
    animateRegrouping?: boolean;
    stepByStepMode?: boolean;
  };
  wordProblemContext?: {
    enabled?: boolean;
    story?: string;
    imagePrompt?: string;
  };
  gradeBand?: '1-2' | '3-4';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RegroupingWorkbenchMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

type Phase = 'explore' | 'regroup' | 'solve' | 'connect';

const UI_PHASE_CONFIG: Record<Phase, { label: string; description: string }> = {
  explore: { label: 'Explore', description: 'Combine blocks and discover' },
  regroup: { label: 'Regroup', description: 'Trade 10 ones for a ten' },
  solve: { label: 'Solve', description: 'Work through the algorithm' },
  connect: { label: 'Connect', description: 'Link blocks to algorithm' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  regroup:  { label: 'Regrouping', icon: '🔄', accentColor: 'orange' },
  standard: { label: 'Standard',   icon: '🧮', accentColor: 'blue' },
};

const PLACE_LABELS = ['Ones', 'Tens', 'Hundreds', 'Thousands'];

// ============================================================================
// Helpers
// ============================================================================

function getDigits(num: number, maxPlace: string): number[] {
  const digits: number[] = [];
  const places = maxPlace === 'thousands' ? 4 : maxPlace === 'hundreds' ? 3 : 2;
  let n = Math.abs(Math.floor(num));
  for (let i = 0; i < places; i++) {
    digits.push(n % 10);
    n = Math.floor(n / 10);
  }
  return digits; // [ones, tens, hundreds, ...]
}

function computeAnswer(op: 'addition' | 'subtraction', a: number, b: number): number {
  return op === 'addition' ? a + b : a - b;
}

// ============================================================================
// Props
// ============================================================================

interface RegroupingWorkbenchProps {
  data: RegroupingWorkbenchData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const RegroupingWorkbench: React.FC<RegroupingWorkbenchProps> = ({ data, className }) => {
  const {
    title,
    description,
    operation,
    operand1: initialOperand1,
    operand2: initialOperand2,
    maxPlace = 'tens',
    challenges = [],
    showOptions = {},
    wordProblemContext,
    gradeBand = '1-2',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showAlgorithm = true,
    showCarryBorrow = true,
    showPlaceColumns = true,
    stepByStepMode = false,
  } = showOptions;

  const places = maxPlace === 'thousands' ? 4 : maxPlace === 'hundreds' ? 3 : 2;

  // -------------------------------------------------------------------------
  // State — shared hooks
  // -------------------------------------------------------------------------
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.requiresRegrouping ? 'regroup' : 'standard',
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const [currentPhase, setCurrentPhase] = useState<Phase>('explore');

  // Current problem
  const currentChallenge = challenges[currentChallengeIndex] || null;
  const operand1 = currentChallenge ? parseInt(currentChallenge.problem.split(/[+\-−]/)[0].trim(), 10) || initialOperand1 : initialOperand1;
  const operand2 = currentChallenge ? parseInt(currentChallenge.problem.split(/[+\-−]/)[1]?.trim(), 10) || initialOperand2 : initialOperand2;
  const correctAnswer = computeAnswer(operation, operand1, operand2);

  // Block counts per place value [ones, tens, hundreds, thousands]
  const [blocks, setBlocks] = useState<number[]>(() => {
    const d1 = getDigits(operand1, maxPlace);
    const d2 = getDigits(operand2, maxPlace);
    if (operation === 'addition') {
      return d1.map((d, i) => d + d2[i]);
    }
    return d1.slice(); // For subtraction, start with operand1
  });

  // Carry/borrow state per place
  const [carries, setCarries] = useState<number[]>(new Array(places).fill(0));

  // Student's answer digits [ones, tens, hundreds, ...]
  const [answerDigits, setAnswerDigits] = useState<(number | null)[]>(new Array(places).fill(null));

  // Which places have been regrouped
  const [regroupedPlaces, setRegroupedPlaces] = useState<Set<number>>(new Set());

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Tracking
  const [incorrectRegroupAttempts, setIncorrectRegroupAttempts] = useState(0);
  const [algorithmConnectionMade, setAlgorithmConnectionMade] = useState(false);
  const [stepByStepUsed] = useState(stepByStepMode);
  const [challengeStartTime, setChallengeStartTime] = useState(Date.now());

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `regrouping-workbench-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<RegroupingWorkbenchMetrics>({
    primitiveType: 'regrouping-workbench',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    operation,
    operand1,
    operand2,
    correctAnswer,
    maxPlace,
    gradeBand,
    blocks: blocks.map((b, i) => `${PLACE_LABELS[i]}: ${b}`).join(', '),
    carries: carries.join(', '),
    currentPhase,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.problem ?? `${operand1} ${operation === 'addition' ? '+' : '−'} ${operand2}`,
    attemptNumber: currentAttempts + 1,
    requiresRegrouping: currentChallenge?.requiresRegrouping ?? false,
    wordProblem: wordProblemContext?.story ?? '',
  }), [
    operation, operand1, operand2, correctAnswer, maxPlace, gradeBand,
    blocks, carries, currentPhase, challenges.length, currentChallengeIndex,
    currentChallenge, currentAttempts, wordProblemContext,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'regrouping-workbench',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'Grade 1-2' : 'Grade 3-4',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const opWord = operation === 'addition' ? 'adding' : 'subtracting';
    sendText(
      `[ACTIVITY_START] This is a regrouping workbench for ${gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 3-4'}. `
      + `Operation: ${operation}. First problem: ${currentChallenge?.problem || `${operand1} ${operation === 'addition' ? '+' : '−'} ${operand2}`}. `
      + `${currentChallenge?.requiresRegrouping ? 'This problem requires regrouping!' : 'No regrouping needed.'} `
      + `${wordProblemContext?.story ? `Story context: "${wordProblemContext.story}". ` : ''}`
      + `Introduce warmly: "Today we're going to practice ${opWord} with blocks! Let's see what happens when we combine numbers." `
      + `Then read the first problem.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, operation, operand1, operand2, gradeBand, currentChallenge, wordProblemContext, sendText]);

  // -------------------------------------------------------------------------
  // Regrouping Logic
  // -------------------------------------------------------------------------
  const handleRegroup = useCallback((placeIndex: number) => {
    if (hasSubmittedEvaluation) return;

    if (operation === 'addition') {
      // Carry: if blocks at this place >= 10, trade 10 for 1 at next place
      if (blocks[placeIndex] >= 10 && placeIndex < places - 1) {
        setBlocks(prev => {
          const next = [...prev];
          next[placeIndex] -= 10;
          next[placeIndex + 1] += 1;
          return next;
        });
        setCarries(prev => {
          const next = [...prev];
          next[placeIndex + 1] += 1;
          return next;
        });
        setRegroupedPlaces(prev => new Set(prev).add(placeIndex));
        setFeedback(`Traded 10 ${PLACE_LABELS[placeIndex].toLowerCase()} for 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()}!`);
        setFeedbackType('success');

        sendText(
          `[REGROUP_CARRY] Student traded 10 ${PLACE_LABELS[placeIndex].toLowerCase()} for 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()}. `
          + `This is carrying! The carry digit "${carries[placeIndex + 1] + 1}" appears above the ${PLACE_LABELS[placeIndex + 1].toLowerCase()} column. `
          + `Celebrate: "Great trade! 10 ones become 1 ten. See the 1 carry above?"`,
          { silent: true }
        );
      } else if (blocks[placeIndex] < 10) {
        setIncorrectRegroupAttempts(c => c + 1);
        setFeedback(`You only have ${blocks[placeIndex]} ${PLACE_LABELS[placeIndex].toLowerCase()}. You need 10 to regroup!`);
        setFeedbackType('error');
        sendText(
          `[REGROUP_NOT_NEEDED] Student tried to regroup ${PLACE_LABELS[placeIndex].toLowerCase()} but only has ${blocks[placeIndex]}. `
          + `Guide: "You only have ${blocks[placeIndex]} ${PLACE_LABELS[placeIndex].toLowerCase()}. You need at least 10 to trade for a ${PLACE_LABELS[placeIndex + 1].toLowerCase()}."`,
          { silent: true }
        );
      }
    } else {
      // Borrow: if blocks at this place < operand2's digit, borrow from next place
      const d2 = getDigits(operand2, maxPlace);
      if (blocks[placeIndex] < d2[placeIndex] && placeIndex < places - 1 && blocks[placeIndex + 1] > 0) {
        setBlocks(prev => {
          const next = [...prev];
          next[placeIndex + 1] -= 1;
          next[placeIndex] += 10;
          return next;
        });
        setCarries(prev => {
          const next = [...prev];
          next[placeIndex] = 1; // mark as borrowed
          return next;
        });
        setRegroupedPlaces(prev => new Set(prev).add(placeIndex));
        setFeedback(`Borrowed 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} = 10 ${PLACE_LABELS[placeIndex].toLowerCase()}!`);
        setFeedbackType('success');

        sendText(
          `[REGROUP_BORROW] Student borrowed 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} to get 10 more ${PLACE_LABELS[placeIndex].toLowerCase()}. `
          + `Now ${PLACE_LABELS[placeIndex].toLowerCase()} has ${blocks[placeIndex] + 10}. `
          + `Explain: "We traded 1 ${PLACE_LABELS[placeIndex + 1].toLowerCase()} for 10 ${PLACE_LABELS[placeIndex].toLowerCase()} so we have enough to subtract."`,
          { silent: true }
        );
      } else if (blocks[placeIndex] >= d2[placeIndex]) {
        setIncorrectRegroupAttempts(c => c + 1);
        setFeedback(`You have enough ${PLACE_LABELS[placeIndex].toLowerCase()} already. No need to borrow!`);
        setFeedbackType('error');
      }
    }
  }, [operation, blocks, carries, places, maxPlace, operand2, hasSubmittedEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Answer Submission
  // -------------------------------------------------------------------------
  const handleDigitChange = useCallback((placeIndex: number, value: string) => {
    if (hasSubmittedEvaluation) return;
    const num = value === '' ? null : parseInt(value, 10);
    setAnswerDigits(prev => {
      const next = [...prev];
      next[placeIndex] = num;
      return next;
    });
  }, [hasSubmittedEvaluation]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    // Build answer from digits
    const studentAnswer = answerDigits.reduce<number>((sum, d, i) => {
      return sum + ((d ?? 0) * Math.pow(10, i));
    }, 0);

    const correct = studentAnswer === correctAnswer;
    const timeMs = Date.now() - challengeStartTime;

    // Count correct regroups
    const expectedRegroups = currentChallenge.regroupCount || 0;
    const regroupingCorrect = Math.min(regroupedPlaces.size, expectedRegroups);

    if (correct) {
      setAlgorithmConnectionMade(true);
      setFeedback(`Correct! ${currentChallenge.problem} = ${correctAnswer}`);
      setFeedbackType('success');
      sendText(
        `[SOLVE_CORRECT] Student got ${currentChallenge.problem} = ${correctAnswer}. `
        + `${currentAttempts === 0 ? 'First try!' : `After ${currentAttempts + 1} attempts.`} `
        + `Regroups: ${regroupedPlaces.size}/${expectedRegroups}. Time: ${Math.round(timeMs / 1000)}s. `
        + `Celebrate and connect to the algorithm: "See how the blocks match the numbers? Each trade is a carry!"`,
        { silent: true }
      );

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        regroupingCorrect,
        regroupingTotal: expectedRegroups,
        timeMs,
      });
    } else {
      setFeedback(`Your answer is ${studentAnswer}, but the correct answer is ${correctAnswer}. Check your work!`);
      setFeedbackType('error');
      sendText(
        `[SOLVE_INCORRECT] Student answered ${studentAnswer} but correct is ${correctAnswer}. `
        + `Problem: ${currentChallenge.problem}. Attempt ${currentAttempts + 1}. `
        + `${regroupedPlaces.size < expectedRegroups ? `Needs ${expectedRegroups - regroupedPlaces.size} more regroup(s). ` : ''}`
        + `Guide: "Let's check each column. Start with the ${PLACE_LABELS[0].toLowerCase()}: what do you get?"`,
        { silent: true }
      );
    }
  }, [currentChallenge, answerDigits, correctAnswer, currentAttempts, challengeStartTime, regroupedPlaces, sendText, incrementAttempts, recordResult]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challenges.length > 0
        ? Math.round(challengeResults.filter(r => r.correct).length / challenges.length * 100)
        : 0;

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Student completed all ${challenges.length} regrouping problems! `
        + `Celebrate and give encouraging phase-specific feedback about ${operation} with regrouping.`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const totalCorrect = challengeResults.filter(r => r.correct).length;
        const totalRegroups = challengeResults.reduce((s, r) => s + ((r.regroupingTotal as number) ?? 0), 0);
        const correctRegroups = challengeResults.reduce((s, r) => s + ((r.regroupingCorrect as number) ?? 0), 0);
        const avgTime = challengeResults.length > 0
          ? challengeResults.reduce((s, r) => s + ((r.timeMs as number) ?? 0), 0) / challengeResults.length
          : 0;
        const score = challenges.length > 0
          ? Math.round((totalCorrect / challenges.length) * 100)
          : 0;

        const metrics: RegroupingWorkbenchMetrics = {
          type: 'regrouping-workbench',
          problemsCompleted: totalCorrect,
          problemsTotal: challenges.length,
          regroupingCorrect: correctRegroups,
          regroupingTotal: totalRegroups,
          algorithmConnectionMade,
          incorrectRegroupAttempts,
          stepByStepUsed,
          wordProblemContextEngaged: !!(wordProblemContext?.enabled && wordProblemContext.story),
          averageTimePerProblem: Math.round(avgTime),
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          totalCorrect === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // advanceProgress() already incremented index and reset attempts.
    // Just reset domain-specific state:
    setFeedback('');
    setFeedbackType('');
    setRegroupedPlaces(new Set());
    setAnswerDigits(new Array(places).fill(null));
    setCarries(new Array(places).fill(0));
    setChallengeStartTime(Date.now());

    // Parse new problem
    const nextIndex = currentChallengeIndex + 1;
    const nextChallenge = challenges[nextIndex];
    const nextOp1 = parseInt(nextChallenge.problem.split(/[+\-−]/)[0].trim(), 10) || operand1;
    const nextOp2 = parseInt(nextChallenge.problem.split(/[+\-−]/)[1]?.trim(), 10) || operand2;
    const d1 = getDigits(nextOp1, maxPlace);
    const d2 = getDigits(nextOp2, maxPlace);

    if (operation === 'addition') {
      setBlocks(d1.map((d, i) => d + d2[i]));
    } else {
      setBlocks(d1.slice());
    }

    setCurrentPhase('explore');

    sendText(
      `[PHASE_TRANSITION] Moving to problem ${nextIndex + 1} of ${challenges.length}: `
      + `"${nextChallenge.problem}". ${nextChallenge.requiresRegrouping ? 'Regrouping needed!' : 'No regrouping.'} `
      + `Read the problem and encourage them.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText, operation,
    hasSubmittedEvaluation, algorithmConnectionMade, incorrectRegroupAttempts,
    stepByStepUsed, wordProblemContext, submitEvaluation, places, maxPlace,
    operand1, operand2, currentChallengeIndex,
  ]);

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // Digits for display
  const d1Display = getDigits(operand1, maxPlace);
  const d2Display = getDigits(operand2, maxPlace);
  const answerDisplay = getDigits(correctAnswer, maxPlace);

  // Does the current place need regrouping?
  const needsRegroup = useCallback((placeIndex: number): boolean => {
    if (operation === 'addition') {
      return blocks[placeIndex] >= 10;
    } else {
      const d2 = getDigits(operand2, maxPlace);
      return blocks[placeIndex] < d2[placeIndex];
    }
  }, [operation, blocks, operand2, maxPlace]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-orange-300 text-xs">
              {gradeBand === '1-2' ? 'Grades 1-2' : 'Grades 3-4'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs capitalize">
              {operation}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(UI_PHASE_CONFIG).map(([phase, config]) => (
              <Badge
                key={phase}
                className={`text-xs ${
                  currentPhase === phase
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                }`}
              >
                {config.label}
              </Badge>
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Problem {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Word Problem Context */}
        {wordProblemContext?.enabled && wordProblemContext.story && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-300 text-sm italic">{wordProblemContext.story}</p>
          </div>
        )}

        {/* Problem Display */}
        <div className="text-center">
          <span className="text-2xl font-bold text-slate-100 font-mono">
            {operand1} {operation === 'addition' ? '+' : '−'} {operand2} = ?
          </span>
        </div>

        {/* Main Split View */}
        <div className={`grid ${showAlgorithm ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {/* Left: Base-Ten Blocks */}
          <div className="bg-slate-800/20 rounded-lg p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-3 text-center font-medium">Base-Ten Blocks</p>

            {showPlaceColumns && (
              <div className="flex justify-center gap-3 mb-2">
                {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                  <div key={placeIdx} className="text-center min-w-[70px]">
                    <p className="text-slate-500 text-[10px] mb-1">{PLACE_LABELS[placeIdx]}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Block visualization */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                <div key={placeIdx} className="text-center min-w-[70px]">
                  {/* Block count */}
                  <div className="bg-slate-800/40 rounded-lg p-2 border border-white/10 min-h-[80px] flex flex-col items-center justify-center">
                    {/* Visual blocks */}
                    <div className="flex flex-wrap gap-0.5 justify-center mb-1">
                      {Array.from({ length: Math.min(blocks[placeIdx], 15) }, (_, j) => (
                        <div
                          key={j}
                          className={`rounded-sm ${
                            placeIdx === 0 ? 'w-2.5 h-2.5 bg-blue-400/60' :
                            placeIdx === 1 ? 'w-2.5 h-6 bg-orange-400/60' :
                            placeIdx === 2 ? 'w-6 h-6 bg-emerald-400/60' :
                            'w-6 h-6 bg-purple-400/60'
                          }`}
                        />
                      ))}
                      {blocks[placeIdx] > 15 && (
                        <span className="text-slate-500 text-[9px]">+{blocks[placeIdx] - 15}</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold font-mono ${
                      needsRegroup(placeIdx) ? 'text-red-400' : 'text-slate-200'
                    }`}>
                      {blocks[placeIdx]}
                    </span>
                  </div>

                  {/* Regroup button */}
                  {!isCurrentChallengeComplete && !allChallengesComplete && needsRegroup(placeIdx) && placeIdx < places - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-[10px] px-2 py-0.5 h-auto bg-orange-500/10 border border-orange-400/30 hover:bg-orange-500/20 text-orange-300"
                      onClick={() => handleRegroup(placeIdx)}
                    >
                      {operation === 'addition' ? '↑ Carry' : '↓ Borrow'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Block legend */}
            <div className="flex justify-center gap-3 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-400/60" /> Ones
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-4 rounded-sm bg-orange-400/60" /> Tens
              </span>
              {places >= 3 && (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-emerald-400/60" /> Hundreds
                </span>
              )}
            </div>
          </div>

          {/* Right: Written Algorithm */}
          {showAlgorithm && (
            <div className="bg-slate-800/20 rounded-lg p-4 border border-white/5">
              <p className="text-slate-500 text-xs mb-3 text-center font-medium">Written Algorithm</p>

              <div className="flex flex-col items-center gap-1 font-mono">
                {/* Carry digits row */}
                {showCarryBorrow && operation === 'addition' && (
                  <div className="flex justify-end gap-0" style={{ width: `${places * 32 + 24}px` }}>
                    <span className="w-6" /> {/* space for operator */}
                    {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                      <span
                        key={`carry-${placeIdx}`}
                        className="w-8 text-center text-orange-400 text-xs"
                      >
                        {carries[placeIdx] > 0 ? carries[placeIdx] : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Operand 1 */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6" />
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <span key={`d1-${placeIdx}`} className="w-8 text-center text-slate-200 text-lg">
                      {d1Display[placeIdx]}
                    </span>
                  ))}
                </div>

                {/* Operator + Operand 2 */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6 text-slate-400 text-lg">
                    {operation === 'addition' ? '+' : '−'}
                  </span>
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <span key={`d2-${placeIdx}`} className="w-8 text-center text-slate-200 text-lg">
                      {d2Display[placeIdx]}
                    </span>
                  ))}
                </div>

                {/* Line */}
                <div
                  className="border-b-2 border-slate-400"
                  style={{ width: `${places * 32 + 24}px` }}
                />

                {/* Answer inputs */}
                <div className="flex justify-end" style={{ width: `${places * 32 + 24}px` }}>
                  <span className="w-6" />
                  {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                    <div key={`ans-${placeIdx}`} className="w-8 flex justify-center">
                      {isCurrentChallengeComplete || allChallengesComplete ? (
                        <span className="text-emerald-400 text-lg font-bold">{answerDisplay[placeIdx]}</span>
                      ) : (
                        <input
                          type="text"
                          maxLength={1}
                          value={answerDigits[placeIdx] !== null ? String(answerDigits[placeIdx]) : ''}
                          onChange={e => handleDigitChange(placeIdx, e.target.value)}
                          className="w-7 h-8 text-center bg-slate-800/50 border border-white/20 rounded text-slate-100 text-lg font-bold focus:outline-none focus:border-orange-400/50"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Borrow indicators for subtraction */}
                {showCarryBorrow && operation === 'subtraction' && (
                  <div className="flex justify-end gap-0" style={{ width: `${places * 32 + 24}px` }}>
                    <span className="w-6" />
                    {Array.from({ length: places }, (_, i) => places - 1 - i).map(placeIdx => (
                      <span
                        key={`borrow-${placeIdx}`}
                        className="w-8 text-center text-purple-400 text-xs"
                      >
                        {carries[placeIdx] > 0 ? '↓' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation || answerDigits.every(d => d === null)}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Problem
              </Button>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}

        {/* Phase Summary Panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage={`You completed all ${challenges.length} regrouping problems!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default RegroupingWorkbench;
