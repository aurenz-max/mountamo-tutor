'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FastFactMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/** Visual element attached to a challenge prompt. */
export interface FastFactVisual {
  type: 'emoji' | 'image' | 'text-large';
  emoji?: string;
  imageUrl?: string;
  largeText?: string;
  alt?: string;
}

/** A single drill challenge. */
export interface FastFactChallenge {
  id: string;
  /** Phase grouping key — drives PhaseSummaryPanel (e.g. 'recall', 'match', 'speed-round'). */
  type: string;
  prompt: {
    /** Primary question or stimulus text shown large. */
    text: string;
    /** Optional instruction shown above the question. */
    subtext?: string;
    /** Optional rich visual (emoji, large text, image). */
    visual?: FastFactVisual;
  };
  /** Canonical correct answer (always string). */
  correctAnswer: string;
  /** Additional accepted answers (case-insensitive). */
  acceptableAnswers?: string[];
  /** How the student responds (always 'choice' — free-form deprecated). */
  responseMode: 'choice';
  /** Answer options (required — always multiple choice). */
  options: string[];
  /** Per-challenge time override (seconds). */
  timeLimit?: number;
  /** Brief explanation shown after the correct answer is revealed. */
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/** Top-level data contract for the FastFact primitive. */
export interface FastFactData {
  title: string;
  description?: string;
  /** Subject area inferred from the learning objective. */
  subject: string;
  challenges: FastFactChallenge[];

  /** Default seconds per challenge (used when challenge.timeLimit is absent). */
  defaultTimeLimit: number;
  /** Seconds — answers within this threshold count as "fast". */
  targetResponseTime: number;
  /** Phase display config keyed by challenge.type. */
  phaseConfig: Record<string, { label: string; icon: string; accentColor: string }>;

  showStreakCounter: boolean;
  showAccuracy: boolean;
  /** Max wrong answers before recording incorrect and advancing (1 for speed-rounds). */
  maxAttemptsPerChallenge: number;
  gradeBand?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FastFactMetrics>) => void;
}

// ============================================================================
// Visual Renderer
// ============================================================================

function VisualRenderer({ visual }: { visual: FastFactVisual }) {
  switch (visual.type) {
    case 'emoji':
      return (
        <div className="text-5xl text-center select-none" role="img" aria-label={visual.alt}>
          {visual.emoji}
        </div>
      );
    case 'text-large':
      return (
        <div className="text-5xl font-bold text-center text-slate-100 font-mono tracking-wider select-none">
          {visual.largeText}
        </div>
      );
    case 'image':
      return visual.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={visual.imageUrl}
          alt={visual.alt || ''}
          className="max-h-32 mx-auto rounded-lg object-contain"
        />
      ) : null;
    default:
      return null;
  }
}

// ============================================================================
// Timer Arc
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
// Answer Checker
// ============================================================================

function isAnswerCorrect(answer: string, challenge: FastFactChallenge): boolean {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === challenge.correctAnswer.trim().toLowerCase()) return true;
  return challenge.acceptableAnswers?.some(a => a.trim().toLowerCase() === normalized) ?? false;
}

// ============================================================================
// Props
// ============================================================================

interface FastFactProps {
  data: FastFactData;
  className?: string;
}

// ============================================================================
// Start screen phases: 'waiting' -> 'counting' -> 'playing'
// ============================================================================
type GamePhase = 'waiting' | 'counting' | 'playing';

// ============================================================================
// Component
// ============================================================================

const FastFact: React.FC<FastFactProps> = ({ data, className }) => {
  const {
    title,
    description,
    subject,
    challenges = [],
    defaultTimeLimit = 5,
    targetResponseTime = 3,
    phaseConfig = {},
    showStreakCounter = true,
    showAccuracy = true,
    maxAttemptsPerChallenge = 2,
    gradeBand,
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
    phaseConfig: phaseConfig as Record<string, PhaseConfig>,
  });

  // -------------------------------------------------------------------------
  // Local state
  // -------------------------------------------------------------------------
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [countdown, setCountdown] = useState(3);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
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
  const stableInstanceIdRef = useRef(instanceId || `fast-fact-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Start button & countdown
  // -------------------------------------------------------------------------
  const handleStart = useCallback(() => {
    setGamePhase('counting');
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (gamePhase !== 'counting') return;
    if (countdown <= 0) {
      setGamePhase('playing');
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [gamePhase, countdown]);

  // -------------------------------------------------------------------------
  // Current challenge
  // -------------------------------------------------------------------------
  const currentChallenge = useMemo(() => {
    return challenges[currentChallengeIndex] || null;
  }, [challenges, currentChallengeIndex]);

  /** True once a result (correct or incorrect after max attempts) has been recorded. */
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id
  );

  const effectiveTimeLimit = useMemo(() => {
    if (!currentChallenge) return defaultTimeLimit;
    return currentChallenge.timeLimit ?? defaultTimeLimit;
  }, [currentChallenge, defaultTimeLimit]);

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

  // Start timer only after playing
  useEffect(() => {
    if (gamePhase === 'playing' && currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete) {
      startTimer(effectiveTimeLimit);
    }
    return () => stopTimer();
  }, [gamePhase, currentChallengeIndex, currentChallenge, allChallengesComplete, isCurrentChallengeComplete, effectiveTimeLimit, startTimer, stopTimer]);

  // Handle time-up
  useEffect(() => {
    if (timeLeft <= 0 && currentChallenge && !isCurrentChallengeComplete && !allChallengesComplete && challengeStartTime > 0) {
      handleTimeUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

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
  } = usePrimitiveEvaluation<FastFactMetrics>({
    primitiveType: 'fast-fact',
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
    subject,
    challengeType: currentChallenge?.type ?? '',
    promptText: currentChallenge?.prompt.text ?? '',
    correctAnswer: currentChallenge?.correctAnswer ?? '',
    responseMode: 'choice',
    difficulty: currentChallenge?.difficulty ?? 'easy',
    attemptNumber: currentAttempts + 1,
    streak,
    accuracy,
    averageTime,
    totalChallenges: challenges.length,
    currentIndex: currentChallengeIndex,
    gradeBand: gradeBand ?? '',
    targetResponseTime,
  }), [
    subject, currentChallenge, currentAttempts, streak, accuracy, averageTime,
    challenges.length, currentChallengeIndex, gradeBand, targetResponseTime,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'fast-fact',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand ?? 'Elementary',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Fast Fact fluency drill. Subject: ${subject}. `
      + `${challenges.length} challenges. Grade: ${gradeBand ?? 'General'}. `
      + `First challenge: "${currentChallenge?.prompt.text}" (${currentChallenge?.type}). `
      + `Introduce warmly and encourage the student to be fast AND accurate.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, subject, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------
  const processAnswer = useCallback((answer: string, isTimeUp = false) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;

    stopTimer();
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    const correct = !isTimeUp && isAnswerCorrect(answer, currentChallenge);

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
          `[ANSWER_CORRECT] Student answered "${answer}" correctly for "${currentChallenge.prompt.text}". `
          + `Response time: ${responseTimeSec.toFixed(1)}s (target: ${targetResponseTime}s). `
          + `${isFast ? 'FAST answer!' : 'Correct but slow.'} Streak: ${newStreak}. `
          + `${isFast ? 'Celebrate enthusiastically!' : 'Affirm and encourage speed.'}`,
          { silent: true }
        );
      }
    } else {
      setStreak(0);
      setFeedbackType('error');

      if (isTimeUp) {
        setFeedback(`Time's up! The answer is ${currentChallenge.correctAnswer}.`);
      } else {
        setFeedback(`Not quite. The answer is ${currentChallenge.correctAnswer}.`);
      }

      if (currentAttempts + 1 >= maxAttemptsPerChallenge || isTimeUp) {
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

        if (currentChallenge.explanation) {
          setFeedback(prev => `${prev} ${currentChallenge!.explanation}`);
        }
      } else {
        // More attempts available — restart timer, clear selection
        setSelectedAnswer(null);
        startTimer(effectiveTimeLimit);
      }

      if (isConnected) {
        const tag = isTimeUp ? '[TIME_UP]' : '[ANSWER_INCORRECT]';
        sendText(
          `${tag} Student ${isTimeUp ? 'ran out of time' : `answered "${answer}"`} for "${currentChallenge.prompt.text}". `
          + `Correct answer: "${currentChallenge.correctAnswer}". `
          + `Attempt ${currentAttempts + 1} of ${maxAttemptsPerChallenge}. `
          + `${currentAttempts + 1 >= maxAttemptsPerChallenge || isTimeUp
            ? 'Show the correct answer and encourage. Never punish wrong answers.'
            : 'Give a brief hint and let them try again.'}`,
          { silent: true }
        );
      }
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, challengeStartTime, streak, bestStreak,
    targetResponseTime, currentAttempts, maxAttemptsPerChallenge, effectiveTimeLimit,
    isConnected, sendText, incrementAttempts, recordResult, stopTimer, startTimer,
  ]);

  const handleTimeUp = useCallback(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return;
    processAnswer('', true);
  }, [currentChallenge, isCurrentChallengeComplete, processAnswer]);

  const handleSelectOption = useCallback((value: string) => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    setSelectedAnswer(value);
    processAnswer(value);
  }, [isCurrentChallengeComplete, allChallengesComplete, processAnswer]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete — submit evaluation
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

        const metrics: FastFactMetrics = {
          type: 'fast-fact',
          subject,
          accuracy: score,
          averageResponseTime: Math.round(avgResponseTime * 1000),
          fastAnswerCount: fastCount,
          bestStreak,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          challengesTotal: challenges.length,
          challengesCorrect: correctCount,
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
    setFeedback('');
    setFeedbackType('');
    setShowCorrectAnswer(false);

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge && isConnected) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
        + `"${nextChallenge.prompt.text}" (${nextChallenge.type}). Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, responseTimes,
    bestStreak, subject, sendText, hasSubmittedEvaluation, submitEvaluation,
    currentChallengeIndex, isConnected,
  ]);

  // Auto-hide correct answer display
  useEffect(() => {
    if (showCorrectAnswer && isCurrentChallengeComplete) {
      const timer = setTimeout(() => setShowCorrectAnswer(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showCorrectAnswer, isCurrentChallengeComplete]);

  // Auto-submit evaluation when all challenges are done
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
  const renderChoiceButtons = (options: string[]) => (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => {
        const isSelected = selectedAnswer === opt;
        const isCorrectOption = currentChallenge && isAnswerCorrect(opt, currentChallenge);
        const showAsCorrect = showCorrectAnswer && isCorrectOption;
        const showAsWrong = showCorrectAnswer && isSelected && !isCorrectOption;

        return (
          <Button
            key={opt}
            variant="ghost"
            className={`min-w-16 h-14 text-lg font-bold border transition-all duration-200 px-6 ${
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {gradeBand && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
                {gradeBand}
              </Badge>
            )}
            <Badge className="bg-slate-800/50 border-slate-700/50 text-amber-300 text-xs">
              {subject}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Waiting — Start Button Screen */}
        {gamePhase === 'waiting' && challenges.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-4xl font-bold text-slate-100 tracking-tight">
              Ready to test your knowledge?
            </div>
            <p className="text-slate-400 text-sm">
              {challenges.length} challenges &middot; {subject}
            </p>
            <Button
              variant="ghost"
              className="h-14 px-10 text-lg font-bold bg-emerald-500/10 border-2 border-emerald-400/40 hover:bg-emerald-500/20 hover:border-emerald-400/60 text-emerald-300 transition-all duration-200 hover:scale-105"
              onClick={handleStart}
            >
              Start
            </Button>
            <p className="text-slate-600 text-xs">
              Answer as fast and accurately as you can!
            </p>
          </div>
        )}

        {/* Counting — 3-2-1 Countdown */}
        {gamePhase === 'counting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative flex items-center justify-center">
              <svg width={140} height={140} viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" className="fill-none stroke-white/5" strokeWidth="6" />
                <circle
                  cx="70" cy="70" r="60"
                  className="fill-none stroke-emerald-400"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={2 * Math.PI * 60 * (1 - countdown / 3)}
                  style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <span className="absolute text-6xl font-black text-emerald-400">
                {countdown > 0 ? countdown : 'GO!'}
              </span>
            </div>
          </div>
        )}

        {/* Progress & Stats Bar */}
        {gamePhase === 'playing' && challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {currentChallengeIndex + 1} / {challenges.length}
              </span>
              {currentChallenge && phaseConfig[currentChallenge.type] && (
                <Badge className="text-xs bg-slate-800/30 border-slate-700/30 text-slate-400">
                  {phaseConfig[currentChallenge.type].icon}{' '}
                  {phaseConfig[currentChallenge.type].label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {showStreakCounter && streak >= 2 && (
                <span className="text-orange-400 font-bold text-sm animate-pulse">
                  {streak} in a row!
                </span>
              )}
              {showAccuracy && accuracy < 100 && totalAnswered > 0 && (
                <span className="text-slate-500 text-xs">{accuracy}% accuracy</span>
              )}
            </div>
          </div>
        )}

        {/* Subtext instruction (if provided) */}
        {gamePhase === 'playing' && currentChallenge && !allChallengesComplete && currentChallenge.prompt.subtext && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.prompt.subtext}
            </p>
          </div>
        )}

        {/* Main Challenge Area */}
        {gamePhase === 'playing' && currentChallenge && !allChallengesComplete && (
          <div className="relative">
            {/* Timer Arc */}
            {!isCurrentChallengeComplete && (
              <TimerArc timeLeft={timeLeft} timeLimit={effectiveTimeLimit} />
            )}

            {/* Visual (if present) */}
            {currentChallenge.prompt.visual && (
              <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                <VisualRenderer visual={currentChallenge.prompt.visual} />
              </div>
            )}

            {/* Prompt Text */}
            <div className="text-center py-4">
              <span className="text-3xl font-bold text-slate-100 tracking-wide">
                {currentChallenge.prompt.text}
              </span>
            </div>

            {/* Answer Choices (always multiple choice) */}
            <div className="mt-4">
              {renderChoiceButtons(currentChallenge.options)}
            </div>
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

        {/* All Complete (fallback if no phase config) */}
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
            heading="Fast Fact Complete!"
            celebrationMessage={`You completed ${challenges.length} challenges! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default FastFact;
