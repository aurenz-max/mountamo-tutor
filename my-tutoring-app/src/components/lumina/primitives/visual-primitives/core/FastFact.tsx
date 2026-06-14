'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaAnswerChoice,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FastFactMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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

  /**
   * Seconds — answers within this threshold count as "fast". Used ONLY as a
   * silent automaticity signal for analytics/IRT. Never surfaced to the student
   * and never enforced as a deadline.
   */
  targetResponseTime: number;
  /** Phase display config keyed by challenge.type. */
  phaseConfig: Record<string, { label: string; icon: string; accentColor: string }>;

  showStreakCounter: boolean;
  showAccuracy: boolean;
  /** Max wrong answers before recording incorrect and advancing. */
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
// Start screen phases: 'waiting' -> 'playing'
// (No race-start countdown — the drill is untimed and pressure-free.)
// ============================================================================
type GamePhase = 'waiting' | 'playing';

// ============================================================================
// Component
// ============================================================================

const FastFact: React.FC<FastFactProps> = ({ data, className }) => {
  const {
    title,
    description,
    subject,
    challenges = [],
    targetResponseTime = 6,
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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  // Response timing — measured SILENTLY for the automaticity metric. There is no
  // countdown and no deadline; the student never sees a clock.
  const [challengeStartTime, setChallengeStartTime] = useState(0);

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
  // Start button — begin the drill (no race countdown)
  // -------------------------------------------------------------------------
  const handleStart = useCallback(() => {
    SoundManager.tap();        // ← tactile press to begin
    setGamePhase('playing');
  }, []);

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

  // -------------------------------------------------------------------------
  // Start the (silent) response-time clock when a new challenge appears.
  // No interval, no countdown — just a start timestamp for analytics.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (gamePhase === 'playing' && currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete) {
      setChallengeStartTime(Date.now());
    }
  }, [gamePhase, currentChallengeIndex, currentChallenge, allChallengesComplete, isCurrentChallengeComplete]);

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
      `[ACTIVITY_START] Fact fluency drill. Subject: ${subject}. `
      + `${challenges.length} challenges. Grade: ${gradeBand ?? 'General'}. `
      + `First challenge: "${currentChallenge?.prompt.text}" (${currentChallenge?.type}). `
      + `This drill is untimed — there is NO timer and no time pressure. `
      + `Introduce warmly and reassure the student they can take all the time they need.`,
      { silent: true }
    );
  }, [isConnected, challenges.length, subject, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Answer handling
  // -------------------------------------------------------------------------
  const processAnswer = useCallback((answer: string) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;

    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    const correct = isAnswerCorrect(answer, currentChallenge);

    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();   // ← immediate per-challenge feedback
      setTotalCorrect(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);

      // isFast is a SILENT automaticity signal for the metric — never surfaced as
      // speed praise to the student, so the feedback stays pressure-free.
      const isFast = responseTimeSec <= targetResponseTime;
      setFeedback('Correct!');
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
          + `Streak: ${newStreak}. `
          + `Affirm warmly without mentioning speed.`,
          { silent: true }
        );
      }
    } else {
      SoundManager.playIncorrect();
      setStreak(0);
      setFeedbackType('error');
      setFeedback(`Not quite. The answer is ${currentChallenge.correctAnswer}.`);

      if (currentAttempts + 1 >= maxAttemptsPerChallenge) {
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
        // More attempts available — clear selection and reset the silent clock.
        setSelectedAnswer(null);
        setChallengeStartTime(Date.now());
      }

      if (isConnected) {
        sendText(
          `[ANSWER_INCORRECT] Student answered "${answer}" for "${currentChallenge.prompt.text}". `
          + `Correct answer: "${currentChallenge.correctAnswer}". `
          + `Attempt ${currentAttempts + 1} of ${maxAttemptsPerChallenge}. `
          + `${currentAttempts + 1 >= maxAttemptsPerChallenge
            ? 'Show the correct answer and encourage. Never punish wrong answers.'
            : 'Give a brief hint and let them try again, with no rush.'}`,
          { silent: true }
        );
      }
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, challengeStartTime, streak, bestStreak,
    targetResponseTime, currentAttempts, maxAttemptsPerChallenge,
    isConnected, sendText, incrementAttempts, recordResult,
  ]);

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

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Best streak: ${bestStreak}. `
        + `Give encouraging phase-specific feedback. Celebrate accuracy and growing confidence — not speed.`,
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

        const state: AnswerChoiceState = showAsCorrect
          ? 'correct'
          : showAsWrong
            ? 'incorrect'
            : isSelected
              ? 'selected'
              : 'idle';

        return (
          <LuminaAnswerChoice
            key={opt}
            state={state}
            className={`min-w-16 w-auto h-14 text-lg font-bold px-6 text-center flex items-center justify-center ${
              showAsCorrect ? 'scale-110' : showAsWrong ? 'animate-pulse' : ''
            }`}
            onClick={() => handleSelectOption(opt)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {opt}
          </LuminaAnswerChoice>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {gradeBand && (
              <LuminaBadge accent="blue" className="text-xs">
                {gradeBand}
              </LuminaBadge>
            )}
            <LuminaBadge accent="amber" className="text-xs">
              {subject}
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Waiting — Start Button Screen */}
        {gamePhase === 'waiting' && challenges.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-4xl font-bold text-slate-100 tracking-tight">
              Ready to practice?
            </div>
            <p className="text-slate-400 text-sm">
              {challenges.length} challenges &middot; {subject}
            </p>
            <LuminaButton
              tone="primary"
              className="h-14 px-10 text-lg font-bold hover:scale-105"
              onClick={handleStart}
            >
              Start
            </LuminaButton>
            <p className="text-slate-600 text-xs">
              Take your time and do your best!
            </p>
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
                <LuminaBadge className="text-xs">
                  {phaseConfig[currentChallenge.type].icon}{' '}
                  {phaseConfig[currentChallenge.type].label}
                </LuminaBadge>
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
            <LuminaButton
              tone="primary"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </LuminaButton>
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
            heading="Fact Fluency Complete!"
            celebrationMessage={`You completed ${challenges.length} challenges! Best streak: ${bestStreak} in a row!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default FastFact;
