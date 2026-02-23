'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MathFactFluencyMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface MathFactFluencyChallenge {
  id: string;
  type: 'visual-fact' | 'equation-solve' | 'missing-number' | 'match' | 'speed-round';
  instruction: string;
  equation: string;                // "3 + 2 = 5"
  operation: 'addition' | 'subtraction';
  operand1: number;
  operand2: number;
  result: number;
  unknownPosition: 'result' | 'operand1' | 'operand2';
  correctAnswer: number;
  // visual-fact & match
  visualType?: 'dot-array' | 'fingers' | 'ten-frame' | 'objects';
  visualCount?: number;
  // equation-solve & speed-round
  options?: number[];
  timeLimit?: number;              // seconds
  // match
  matchDirection?: 'visual-to-equation' | 'equation-to-visual';
  equationOptions?: string[];
  visualOptions?: Array<{ type: string; count: number }>;
}

export interface MathFactFluencyData {
  title: string;
  description?: string;
  challenges: MathFactFluencyChallenge[];
  maxNumber: number;               // 3, 5, or 10
  includeSubtraction: boolean;
  showVisualAids: boolean;
  targetResponseTime: number;      // seconds (goal: 3)
  adaptiveDifficulty: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MathFactFluencyMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'visual-fact':    { label: 'Visual Fact',    icon: '\uD83D\uDC41\uFE0F', accentColor: 'purple' },
  'equation-solve': { label: 'Equation Solve', icon: '\uD83D\uDCA1',       accentColor: 'blue' },
  'missing-number': { label: 'Missing Number', icon: '\u2753',             accentColor: 'amber' },
  'match':          { label: 'Match',          icon: '\uD83D\uDD17',       accentColor: 'emerald' },
  'speed-round':    { label: 'Speed Round',    icon: '\u26A1',             accentColor: 'orange' },
};

// ============================================================================
// Visual Renderers
// ============================================================================

/** Render a dot array in a 5-frame layout */
function DotArray({ count, size = 120 }: { count: number; size?: number }) {
  const cols = 5;
  const rows = Math.ceil(count / cols);
  const dotR = Math.min(size / (cols * 2.5), 10);
  const gapX = size / cols;
  const gapY = Math.min(size / (rows + 1), gapX);

  return (
    <svg width={size} height={rows * gapY + dotR * 2} className="mx-auto">
      {Array.from({ length: count }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <circle
            key={i}
            cx={gapX / 2 + col * gapX}
            cy={dotR + gapY / 2 + row * gapY}
            r={dotR}
            className="fill-blue-400"
          />
        );
      })}
    </svg>
  );
}

/** Render a mini ten-frame */
function TenFrameVisual({ count, size = 140 }: { count: number; size?: number }) {
  const cellW = size / 5;
  const cellH = cellW * 0.8;
  const totalH = cellH * 2;

  return (
    <svg width={size} height={totalH + 4} className="mx-auto">
      {/* Grid */}
      {Array.from({ length: 10 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const filled = i < count;
        return (
          <g key={i}>
            <rect
              x={col * cellW + 1}
              y={row * cellH + 1}
              width={cellW - 2}
              height={cellH - 2}
              rx={3}
              className={filled ? 'fill-blue-500/30 stroke-blue-400/60' : 'fill-white/5 stroke-white/10'}
              strokeWidth={1}
            />
            {filled && (
              <circle
                cx={col * cellW + cellW / 2}
                cy={row * cellH + cellH / 2}
                r={Math.min(cellW, cellH) / 3}
                className="fill-blue-400"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Render finger count image */
function FingerVisual({ count }: { count: number }) {
  // Show finger emoji representation
  const fingerEmojis: Record<number, string> = {
    0: '\u270A', 1: '\u261D\uFE0F', 2: '\u270C\uFE0F', 3: '\uD83E\uDD1E',
    4: '\uD83D\uDD90\uFE0F', 5: '\uD83D\uDD90\uFE0F',
  };
  const safeCount = Math.min(count, 10);
  const leftHand = Math.min(safeCount, 5);
  const rightHand = safeCount - leftHand;

  return (
    <div className="flex items-center justify-center gap-4 text-4xl select-none">
      <span>{fingerEmojis[leftHand] || '\uD83D\uDD90\uFE0F'}</span>
      {rightHand > 0 && <span>{fingerEmojis[rightHand] || '\uD83D\uDD90\uFE0F'}</span>}
    </div>
  );
}

/** Choose and render the correct visual aid */
function VisualAid({ type, count }: { type?: string; count: number }) {
  switch (type) {
    case 'ten-frame':
      return <TenFrameVisual count={count} />;
    case 'fingers':
      return <FingerVisual count={count} />;
    case 'dot-array':
    default:
      return <DotArray count={count} />;
  }
}

// ============================================================================
// Timer Arc Component
// ============================================================================

function TimerArc({ timeLeft, timeLimit }: { timeLeft: number; timeLimit: number }) {
  const fraction = Math.max(0, timeLeft / timeLimit);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);

  let colorClass = 'stroke-emerald-400';
  if (fraction <= 0.25) colorClass = 'stroke-red-400';
  else if (fraction <= 0.5) colorClass = 'stroke-amber-400';

  return (
    <svg width={100} height={100} className="absolute -top-1 -right-1 opacity-50" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} className="fill-none stroke-white/5" strokeWidth="4" />
      <circle
        cx="50" cy="50" r={radius}
        className={`fill-none ${colorClass}`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text x="50" y="54" textAnchor="middle" className="fill-slate-300 text-xs" fontSize="14" fontWeight="bold">
        {Math.ceil(timeLeft)}
      </text>
    </svg>
  );
}

// ============================================================================
// Match Visual Option (small inline visual for match challenges)
// ============================================================================

function MatchVisualOption({ type, count }: { type: string; count: number }) {
  if (type === 'ten-frame') return <TenFrameVisual count={count} size={80} />;
  return <DotArray count={count} size={80} />;
}

// ============================================================================
// Props
// ============================================================================

interface MathFactFluencyProps {
  data: MathFactFluencyData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const MathFactFluency: React.FC<MathFactFluencyProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 5,
    gradeBand = 'K',
    targetResponseTime = 3,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Challenge progress (shared hooks)
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
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedEquation, setSelectedEquation] = useState<string | null>(null);
  const [selectedVisualIdx, setSelectedVisualIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [challengeStartTime, setChallengeStartTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Streak tracking
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `math-fact-fluency-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Current challenge
  // -------------------------------------------------------------------------
  const currentChallenge = useMemo(() => {
    return challenges[currentChallengeIndex] || null;
  }, [challenges, currentChallengeIndex]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  /** Effective time limit for the current challenge (computed once, reused by timer + arc) */
  const effectiveTimeLimit = useMemo(() => {
    if (!currentChallenge) return 5;
    return currentChallenge.timeLimit ?? (
      currentChallenge.type === 'visual-fact' ? 8 :
      currentChallenge.type === 'speed-round' ? 4 :
      currentChallenge.type === 'match' ? 6 :
      currentChallenge.type === 'missing-number' ? 8 : 5
    );
  }, [currentChallenge]);

  // -------------------------------------------------------------------------
  // Timer management
  // -------------------------------------------------------------------------
  const startTimer = useCallback((limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(limit);
    setChallengeStartTime(Date.now());
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start timer when challenge changes
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete) {
      startTimer(effectiveTimeLimit);
      // Focus input for type-in challenges
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => stopTimer();
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete, isCurrentChallengeComplete, effectiveTimeLimit, startTimer, stopTimer]);

  // Handle time-up
  useEffect(() => {
    if (timeLeft <= 0 && currentChallenge && !isCurrentChallengeComplete && !allChallengesComplete && challengeStartTime > 0) {
      // Time expired — treat as wrong
      handleTimeUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<MathFactFluencyMetrics>({
    primitiveType: 'math-fact-fluency',
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
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 100;
  const averageTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'equation-solve',
    equation: currentChallenge?.equation ?? '',
    operation: currentChallenge?.operation ?? 'addition',
    unknownPosition: currentChallenge?.unknownPosition ?? 'result',
    correctAnswer: currentChallenge?.correctAnswer ?? 0,
    operand1: currentChallenge?.operand1 ?? 0,
    operand2: currentChallenge?.operand2 ?? 0,
    result: currentChallenge?.result ?? 0,
    attemptNumber: currentAttempts + 1,
    streak,
    accuracy,
    averageTime,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    maxNumber,
    gradeBand,
    targetResponseTime,
  }), [
    currentChallenge, currentAttempts, streak, accuracy, averageTime,
    challenges.length, currentChallengeIndex, maxNumber, gradeBand, targetResponseTime,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'math-fact-fluency',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Math Fact Fluency for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges, facts within ${maxNumber}. `
      + `First challenge: "${currentChallenge?.instruction}" (${currentChallenge?.type}). `
      + `This primitive is about building SPEED, not just accuracy. `
      + `Introduce warmly and encourage the student to be fast AND accurate.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, maxNumber, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Format equation display
  // -------------------------------------------------------------------------
  const formatEquation = useCallback((ch: MathFactFluencyChallenge) => {
    const op = ch.operation === 'addition' ? '+' : '\u2212';
    switch (ch.unknownPosition) {
      case 'operand1': return `? ${op} ${ch.operand2} = ${ch.result}`;
      case 'operand2': return `${ch.operand1} ${op} ? = ${ch.result}`;
      case 'result':
      default: return `${ch.operand1} ${op} ${ch.operand2} = ?`;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------
  const processAnswer = useCallback((answer: number, isTimeUp = false) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;

    stopTimer();
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    const correct = answer === currentChallenge.correctAnswer;

    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);

      const isFast = responseTimeSec <= targetResponseTime;
      setFeedback(isFast ? 'Lightning fast!' : 'Correct!');
      setFeedbackType('success');

      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        isFast,
        streak: newStreak,
      });

      if (isConnected) {
        sendText(
          `[ANSWER_CORRECT] Student answered ${answer} correctly for ${currentChallenge.equation}. `
          + `Response time: ${responseTimeSec.toFixed(1)}s (target: ${targetResponseTime}s). `
          + `${isFast ? 'FAST answer!' : 'Correct but slow.'} Streak: ${newStreak}. `
          + `${isFast ? 'Celebrate enthusiastically: "Lightning fast! You knew that one by heart!"' : 'Affirm: "Correct! With more practice, you\'ll get even faster."'}`,
          { silent: true }
        );
      }
    } else {
      setStreak(0);
      setFeedbackType('error');
      setShowCorrectAnswer(true);

      if (isTimeUp) {
        setFeedback(`Time's up! The answer is ${currentChallenge.correctAnswer}.`);
      } else {
        setFeedback(`Not quite. The answer is ${currentChallenge.correctAnswer}.`);
      }

      // Record incorrect after max attempts or for speed-round (1 chance)
      const maxAttempts = currentChallenge.type === 'speed-round' ? 1 : 2;
      if (currentAttempts + 1 >= maxAttempts || isTimeUp) {
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
          timeMs: responseTime,
          responseTimeSec,
          isFast: false,
          streak: 0,
        });
      }

      if (isConnected) {
        const tag = isTimeUp ? '[TIME_UP]' : '[ANSWER_INCORRECT]';
        sendText(
          `${tag} Student ${isTimeUp ? 'ran out of time' : `chose ${answer}`} for ${currentChallenge.equation}. `
          + `Correct answer: ${currentChallenge.correctAnswer}. `
          + `${currentChallenge.unknownPosition === 'operand1' || currentChallenge.unknownPosition === 'operand2'
            ? 'For missing-number, encourage "think backwards" strategy.'
            : 'Show the correct answer and move on quickly. Never punish wrong answers.'}`,
          { silent: true }
        );
      }
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, challengeStartTime, streak, bestStreak,
    targetResponseTime, currentAttempts, isConnected, sendText, incrementAttempts,
    recordResult, stopTimer,
  ]);

  const handleTimeUp = useCallback(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return;
    processAnswer(-1, true);
  }, [currentChallenge, isCurrentChallengeComplete, processAnswer]);

  const handleSelectOption = useCallback((value: number) => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    setSelectedAnswer(value);
    processAnswer(value);
  }, [isCurrentChallengeComplete, allChallengesComplete, processAnswer]);

  const handleSelectEquation = useCallback((eq: string) => {
    if (isCurrentChallengeComplete || allChallengesComplete || !currentChallenge) return;
    setSelectedEquation(eq);
    // Match by result value — parse the number after "=" in the equation string.
    // This avoids false negatives when multiple equations share the same result (e.g. "2+3=5" vs "4+1=5").
    const eqResult = parseInt(eq.split('=').pop()?.trim() ?? '', 10);
    const correct = eqResult === currentChallenge.correctAnswer;
    stopTimer();
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('Correct match!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        isFast: responseTimeSec <= targetResponseTime,
        streak: newStreak,
      });
    } else {
      setStreak(0);
      setFeedback(`Not quite. The correct equation is ${currentChallenge.equation}.`);
      setFeedbackType('error');
      setShowCorrectAnswer(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        isFast: false,
        streak: 0,
      });
    }
  }, [
    isCurrentChallengeComplete, allChallengesComplete, currentChallenge, challengeStartTime,
    streak, bestStreak, targetResponseTime, currentAttempts, incrementAttempts,
    recordResult, stopTimer,
  ]);

  const handleSelectVisual = useCallback((idx: number) => {
    if (isCurrentChallengeComplete || allChallengesComplete || !currentChallenge) return;
    setSelectedVisualIdx(idx);
    const vo = currentChallenge.visualOptions?.[idx];
    const correct = vo ? vo.count === currentChallenge.correctAnswer : false;
    stopTimer();
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setFeedback('Correct match!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        isFast: responseTimeSec <= targetResponseTime,
        streak: newStreak,
      });
    } else {
      setStreak(0);
      setFeedback(`Not quite. The correct answer shows ${currentChallenge.correctAnswer}.`);
      setFeedbackType('error');
      setShowCorrectAnswer(true);
      recordResult({
        challengeId: currentChallenge.id,
        correct: false,
        attempts: currentAttempts + 1,
        timeMs: responseTime,
        responseTimeSec,
        isFast: false,
        streak: 0,
      });
    }
  }, [
    isCurrentChallengeComplete, allChallengesComplete, currentChallenge, challengeStartTime,
    streak, bestStreak, targetResponseTime, currentAttempts, incrementAttempts,
    recordResult, stopTimer,
  ]);

  const handleTypedSubmit = useCallback(() => {
    const parsed = parseInt(typedAnswer, 10);
    if (isNaN(parsed)) return;
    processAnswer(parsed);
  }, [typedAnswer, processAnswer]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = challenges.length > 0
        ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100) : 0;
      const avgTimeStr = responseTimes.length > 0
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
        : '0';

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Average response time: ${avgTimeStr}s. Best streak: ${bestStreak}. `
        + `Give encouraging phase-specific feedback. Celebrate speed improvements!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const score = Math.round((correctCount / challenges.length) * 100);
        const fastCount = challengeResults.filter(r => (r.isFast as boolean)).length;
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

        const metrics: MathFactFluencyMetrics = {
          type: 'math-fact-fluency',
          accuracy: score,
          averageResponseTime: Math.round(avgResponseTime * 1000),
          fastAnswerCount: fastCount,
          bestStreak,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          factsWithinTarget: fastCount,
          factsTotal: challenges.length,
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Reset local state for next challenge
    setSelectedAnswer(null);
    setTypedAnswer('');
    setSelectedEquation(null);
    setSelectedVisualIdx(null);
    setFeedback('');
    setFeedbackType('');
    setShowCorrectAnswer(false);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge && isConnected) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
        + `"${nextChallenge.instruction}" (${nextChallenge.type}). `
        + `Equation: ${nextChallenge.equation}. Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, responseTimes,
    bestStreak, sendText, hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex, isConnected,
  ]);

  // Auto-advance after showing correct answer briefly
  useEffect(() => {
    if (showCorrectAnswer && isCurrentChallengeComplete) {
      const timer = setTimeout(() => setShowCorrectAnswer(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showCorrectAnswer, isCurrentChallengeComplete]);

  // -------------------------------------------------------------------------
  // Auto-submit when all done
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // -------------------------------------------------------------------------
  // Overall Score
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderChoiceButtons = (options: number[]) => (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => {
        const isSelected = selectedAnswer === opt;
        const isCorrectOption = currentChallenge && opt === currentChallenge.correctAnswer;
        const showAsCorrect = showCorrectAnswer && isCorrectOption;
        const showAsWrong = showCorrectAnswer && isSelected && !isCorrectOption;

        return (
          <Button
            key={opt}
            variant="ghost"
            className={`w-16 h-16 text-2xl font-bold border transition-all duration-200 ${
              showAsCorrect
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 scale-110'
                : showAsWrong
                  ? 'bg-red-500/20 border-red-400/50 text-red-300 animate-pulse'
                  : isSelected
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
            }`}
            onClick={() => handleSelectOption(opt)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {opt}
          </Button>
        );
      })}
    </div>
  );

  const numericValue = typedAnswer === '' ? 0 : parseInt(typedAnswer, 10) || 0;
  const handleIncrement = useCallback(() => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    const next = Math.min(numericValue + 1, maxNumber + 5);
    setTypedAnswer(String(next));
  }, [numericValue, maxNumber, isCurrentChallengeComplete, allChallengesComplete]);
  const handleDecrement = useCallback(() => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    const next = Math.max(numericValue - 1, 0);
    setTypedAnswer(String(next));
  }, [numericValue, isCurrentChallengeComplete, allChallengesComplete]);

  const renderTypedInput = () => (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {/* Minus button */}
        <Button
          variant="ghost"
          className="w-14 h-14 text-2xl font-bold bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 rounded-xl"
          onClick={handleDecrement}
          disabled={numericValue <= 0 || isCurrentChallengeComplete || allChallengesComplete}
        >
          &minus;
        </Button>

        {/* Number display */}
        <div className="w-20 h-14 flex items-center justify-center bg-slate-800/50 border border-white/20 rounded-xl">
          <span className="text-3xl font-bold text-slate-100">
            {typedAnswer === '' ? '\u2013' : numericValue}
          </span>
        </div>

        {/* Plus button */}
        <Button
          variant="ghost"
          className="w-14 h-14 text-2xl font-bold bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200 rounded-xl"
          onClick={handleIncrement}
          disabled={isCurrentChallengeComplete || allChallengesComplete}
        >
          +
        </Button>
      </div>

      <Button
        variant="ghost"
        className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 px-8"
        onClick={handleTypedSubmit}
        disabled={typedAnswer === '' || isCurrentChallengeComplete || allChallengesComplete}
      >
        Submit
      </Button>
    </div>
  );

  const renderMatchEquationOptions = (eqOptions: string[]) => (
    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
      {eqOptions.map((eq) => {
        const isSelected = selectedEquation === eq;
        const eqResultVal = parseInt(eq.split('=').pop()?.trim() ?? '', 10);
        const isCorrectOpt = currentChallenge && eqResultVal === currentChallenge.correctAnswer;
        const showAsCorrect = showCorrectAnswer && isCorrectOpt;
        const showAsWrong = showCorrectAnswer && isSelected && !isCorrectOpt;

        return (
          <Button
            key={eq}
            variant="ghost"
            className={`h-12 text-lg font-mono border transition-all ${
              showAsCorrect
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : showAsWrong
                  ? 'bg-red-500/20 border-red-400/50 text-red-300'
                  : isSelected
                    ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-200'
            }`}
            onClick={() => handleSelectEquation(eq)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {eq}
          </Button>
        );
      })}
    </div>
  );

  const renderMatchVisualOptions = (visOptions: Array<{ type: string; count: number }>) => (
    <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
      {visOptions.map((vo, idx) => {
        const isSelected = selectedVisualIdx === idx;
        const isCorrectOpt = vo.count === currentChallenge?.correctAnswer;
        const showAsCorrect = showCorrectAnswer && isCorrectOpt;
        const showAsWrong = showCorrectAnswer && isSelected && !isCorrectOpt;

        return (
          <button
            key={idx}
            className={`p-3 rounded-lg border transition-all ${
              showAsCorrect
                ? 'bg-emerald-500/20 border-emerald-400/50'
                : showAsWrong
                  ? 'bg-red-500/20 border-red-400/50'
                  : isSelected
                    ? 'bg-blue-500/20 border-blue-400/50'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
            }`}
            onClick={() => handleSelectVisual(idx)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            <MatchVisualOption type={vo.type} count={vo.count} />
          </button>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-amber-300 text-xs">
              Within {maxNumber}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress & Stats Bar */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {currentChallengeIndex + 1} / {challenges.length}
              </span>
              {currentChallenge && (
                <Badge className={`text-xs bg-slate-800/30 border-slate-700/30 ${
                  currentChallenge.type === 'speed-round' ? 'text-orange-300' : 'text-slate-400'
                }`}>
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {streak >= 2 && (
                <span className="text-orange-400 font-bold text-sm animate-pulse">
                  {streak} in a row!
                </span>
              )}
              {accuracy < 100 && totalAnswered > 0 && (
                <span className="text-slate-500 text-xs">{accuracy}% accuracy</span>
              )}
            </div>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Main Challenge Area */}
        {currentChallenge && !allChallengesComplete && (
          <div className="relative">
            {/* Timer Arc */}
            {!isCurrentChallengeComplete && (
              <TimerArc
                timeLeft={timeLeft}
                timeLimit={effectiveTimeLimit}
              />
            )}

            {/* Visual Aid (visual-fact phase) */}
            {currentChallenge.type === 'visual-fact' && currentChallenge.visualType && (
              <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                <VisualAid
                  type={currentChallenge.visualType}
                  count={currentChallenge.visualCount ?? currentChallenge.correctAnswer}
                />
              </div>
            )}

            {/* Equation Display */}
            {(currentChallenge.type !== 'match' || currentChallenge.matchDirection === 'equation-to-visual') && (
              <div className="text-center py-6">
                <span className="text-5xl font-bold text-slate-100 font-mono tracking-wider">
                  {formatEquation(currentChallenge)}
                </span>
              </div>
            )}

            {/* Match: Visual-to-equation — show visual then equation options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'visual-to-equation' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/20 rounded-xl border border-white/5">
                  <VisualAid
                    type={currentChallenge.visualType || 'dot-array'}
                    count={currentChallenge.visualCount ?? currentChallenge.correctAnswer}
                  />
                </div>
                {currentChallenge.equationOptions && renderMatchEquationOptions(currentChallenge.equationOptions)}
              </div>
            )}

            {/* Match: Equation-to-visual — show equation then visual options */}
            {currentChallenge.type === 'match' && currentChallenge.matchDirection === 'equation-to-visual' && currentChallenge.visualOptions && (
              <div className="space-y-4">
                {renderMatchVisualOptions(currentChallenge.visualOptions)}
              </div>
            )}

            {/* Answer Inputs (non-match types) */}
            {currentChallenge.type !== 'match' && (
              <div className="mt-4">
                {currentChallenge.options && currentChallenge.options.length > 0
                  ? renderChoiceButtons(currentChallenge.options)
                  : renderTypedInput()
                }
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success'
              ? 'text-emerald-400'
              : feedbackType === 'error'
                ? 'text-red-400'
                : 'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next Challenge Button */}
        {isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </Button>
          </div>
        )}

        {/* All Complete */}
        {allChallengesComplete && !phaseResults.length && (
          <div className="text-center py-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">All challenges complete!</p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
              {bestStreak > 1 && ` | Best streak: ${bestStreak}`}
            </p>
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Fact Fluency Complete!"
            celebrationMessage={`You completed ${challenges.length} facts! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default MathFactFluency;
