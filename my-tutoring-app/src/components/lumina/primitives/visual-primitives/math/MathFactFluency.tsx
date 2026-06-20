'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPrompt,
  LuminaButton,
  LuminaActionButton,
  answerStateClass,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MathFactFluencyMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  // match
  matchDirection?: 'visual-to-equation' | 'equation-to-visual';
  equationOptions?: string[];
  visualOptions?: Array<{ type: string; count: number }>;
  // Within-mode support tier ('easy' | 'medium' | 'hard'), set by the generator when
  // the manifest emits config.difficulty. Read by the live tutor to calibrate reveal.
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface MathFactFluencyData {
  title: string;
  description?: string;
  challenges: MathFactFluencyChallenge[];
  maxNumber: number;               // 3, 5, or 10
  includeSubtraction: boolean;
  showVisualAids: boolean;
  // Goal response time in seconds, used ONLY as a silent automaticity signal for
  // analytics/IRT. Never surfaced to the student and never enforced as a deadline.
  targetResponseTime: number;
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
  'visual-fact':    { label: 'Visual Fact',    icon: '👁️', accentColor: 'purple' },
  'equation-solve': { label: 'Equation Solve', icon: '💡',       accentColor: 'blue' },
  'missing-number': { label: 'Missing Number', icon: '❓',             accentColor: 'amber' },
  'match':          { label: 'Match',          icon: '🔗',       accentColor: 'emerald' },
  'speed-round':    { label: 'Rapid Recall',   icon: '🎯',             accentColor: 'orange' },
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
    0: '✊', 1: '☝️', 2: '✌️', 3: '🤞',
    4: '🖐️', 5: '🖐️',
  };
  const safeCount = Math.min(count, 10);
  const leftHand = Math.min(safeCount, 5);
  const rightHand = safeCount - leftHand;

  return (
    <div className="flex items-center justify-center gap-4 text-4xl select-none">
      <span>{fingerEmojis[leftHand] || '🖐️'}</span>
      {rightHand > 0 && <span>{fingerEmojis[rightHand] || '🖐️'}</span>}
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
// Match Visual Option (small inline visual for match challenges)
// ============================================================================

function MatchVisualOption({ type, count }: { type: string; count: number }) {
  if (type === 'ten-frame') return <TenFrameVisual count={count} size={80} />;
  return <DotArray count={count} size={80} />;
}

// ============================================================================
// Tutor reveal policy — calibrate how much the live tutor scaffolds per support
// tier so it never re-reveals what a harder tier withheld (Gotcha #2). The
// instruction text already withholds the strategy at hard; the tutor must match.
// ============================================================================

function tutorRevealClause(tier?: 'easy' | 'medium' | 'hard'): string {
  if (!tier) return '';
  if (tier === 'easy') {
    return ' SUPPORT TIER easy: you MAY name the strategy and walk the setup step by step.';
  }
  if (tier === 'medium') {
    return ' SUPPORT TIER medium: nudge the next step only — do NOT name the full strategy.';
  }
  return ' SUPPORT TIER hard: do NOT name a strategy or reveal the answer — ask the student what they notice and let them reason it out.';
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

  // -------------------------------------------------------------------------
  // Start the (silent) response-time clock when a new challenge appears.
  // No interval, no countdown — just a start timestamp for analytics.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete && !isCurrentChallengeComplete) {
      setChallengeStartTime(Date.now());
      // Focus input for type-in challenges
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete, isCurrentChallengeComplete]);

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
    supportTier: currentChallenge?.supportTier ?? null,
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
      + `This primitive builds automaticity through calm, repeated practice — there is NO timer and NO time pressure. `
      + `Introduce warmly and reassure the student they can take all the time they need to think.`
      + tutorRevealClause(currentChallenge?.supportTier),
      { silent: true }
    );
  }, [isConnected, challenges.length, maxNumber, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Format equation display
  // -------------------------------------------------------------------------
  const formatEquation = useCallback((ch: MathFactFluencyChallenge) => {
    const op = ch.operation === 'addition' ? '+' : '−';
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
  const processAnswer = useCallback((answer: number) => {
    if (!currentChallenge || isCurrentChallengeComplete) return;

    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    const correct = answer === currentChallenge.correctAnswer;

    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();
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
          `[ANSWER_CORRECT] Student answered ${answer} correctly for ${currentChallenge.equation}. `
          + `Streak: ${newStreak}. `
          + `Affirm warmly without mentioning speed: "That's right! Nice thinking."`,
          { silent: true }
        );
      }
    } else {
      SoundManager.playIncorrect();
      setStreak(0);
      setFeedbackType('error');
      setShowCorrectAnswer(true);
      setFeedback(`Not quite. The answer is ${currentChallenge.correctAnswer}.`);

      // Record incorrect after max attempts. Rapid-recall (speed-round) is a
      // single-attempt automaticity check; everything else allows a second try.
      const maxAttempts = currentChallenge.type === 'speed-round' ? 1 : 2;
      if (currentAttempts + 1 >= maxAttempts) {
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
        sendText(
          `[ANSWER_INCORRECT] Student chose ${answer} for ${currentChallenge.equation}. `
          + `Correct answer: ${currentChallenge.correctAnswer}. `
          + `${currentChallenge.unknownPosition === 'operand1' || currentChallenge.unknownPosition === 'operand2'
            ? 'For missing-number, encourage "think backwards" strategy.'
            : 'Show the correct answer and move on gently. Never punish wrong answers.'}`
          + tutorRevealClause(currentChallenge.supportTier),
          { silent: true }
        );
      }
    }
  }, [
    currentChallenge, isCurrentChallengeComplete, challengeStartTime, streak, bestStreak,
    targetResponseTime, currentAttempts, isConnected, sendText, incrementAttempts,
    recordResult,
  ]);

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
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();
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
      SoundManager.playIncorrect();
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
    recordResult,
  ]);

  const handleSelectVisual = useCallback((idx: number) => {
    if (isCurrentChallengeComplete || allChallengesComplete || !currentChallenge) return;
    setSelectedVisualIdx(idx);
    const vo = currentChallenge.visualOptions?.[idx];
    const correct = vo ? vo.count === currentChallenge.correctAnswer : false;
    const responseTime = Date.now() - challengeStartTime;
    const responseTimeSec = responseTime / 1000;
    incrementAttempts();
    setTotalAnswered(prev => prev + 1);
    setResponseTimes(prev => [...prev, responseTimeSec]);

    if (correct) {
      SoundManager.playCorrect();
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
      SoundManager.playIncorrect();
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
    recordResult,
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
        + `Equation: ${nextChallenge.equation}. Introduce it briefly.`
        + tutorRevealClause(nextChallenge.supportTier),
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
  // Grading-state color language for the answerable options comes from the kit
  // tokens (answerStateClass) so "selected / correct / incorrect" looks
  // identical across every primitive. The compact button sizing stays bespoke.
  const renderChoiceButtons = (options: number[]) => (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((opt) => {
        const isSelected = selectedAnswer === opt;
        const isCorrectOption = currentChallenge && opt === currentChallenge.correctAnswer;
        let state: AnswerChoiceState = 'idle';
        if (showCorrectAnswer && isCorrectOption) state = 'correct';
        else if (showCorrectAnswer && isSelected && !isCorrectOption) state = 'incorrect';
        else if (isSelected) state = 'selected';

        return (
          <button
            key={opt}
            type="button"
            className={`w-16 h-16 text-2xl font-bold border rounded-xl transition-all duration-200 ${answerStateClass(state)}`}
            onClick={() => handleSelectOption(opt)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  const numericValue = typedAnswer === '' ? 0 : parseInt(typedAnswer, 10) || 0;
  const handleIncrement = useCallback(() => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    SoundManager.tick();
    const next = Math.min(numericValue + 1, maxNumber + 5);
    setTypedAnswer(String(next));
  }, [numericValue, maxNumber, isCurrentChallengeComplete, allChallengesComplete]);
  const handleDecrement = useCallback(() => {
    if (isCurrentChallengeComplete || allChallengesComplete) return;
    SoundManager.tick();
    const next = Math.max(numericValue - 1, 0);
    setTypedAnswer(String(next));
  }, [numericValue, isCurrentChallengeComplete, allChallengesComplete]);

  const renderTypedInput = () => (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {/* Minus button */}
        <LuminaButton
          className="w-14 h-14 text-2xl font-bold rounded-xl"
          onClick={handleDecrement}
          disabled={numericValue <= 0 || isCurrentChallengeComplete || allChallengesComplete}
        >
          &minus;
        </LuminaButton>

        {/* Number display — bespoke answer-entry readout (kept as the painting) */}
        <div className="w-20 h-14 flex items-center justify-center bg-slate-800/50 border border-white/20 rounded-xl">
          <span className="text-3xl font-bold text-slate-100">
            {typedAnswer === '' ? '–' : numericValue}
          </span>
        </div>

        {/* Plus button */}
        <LuminaButton
          className="w-14 h-14 text-2xl font-bold rounded-xl"
          onClick={handleIncrement}
          disabled={isCurrentChallengeComplete || allChallengesComplete}
        >
          +
        </LuminaButton>
      </div>

      <LuminaActionButton
        action="check"
        onClick={handleTypedSubmit}
        disabled={typedAnswer === '' || isCurrentChallengeComplete || allChallengesComplete}
      >
        Submit
      </LuminaActionButton>
    </div>
  );

  const renderMatchEquationOptions = (eqOptions: string[]) => (
    <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
      {eqOptions.map((eq) => {
        const isSelected = selectedEquation === eq;
        const eqResultVal = parseInt(eq.split('=').pop()?.trim() ?? '', 10);
        const isCorrectOpt = currentChallenge && eqResultVal === currentChallenge.correctAnswer;
        let state: AnswerChoiceState = 'idle';
        if (showCorrectAnswer && isCorrectOpt) state = 'correct';
        else if (showCorrectAnswer && isSelected && !isCorrectOpt) state = 'incorrect';
        else if (isSelected) state = 'selected';

        return (
          <button
            key={eq}
            type="button"
            className={`h-12 text-lg font-mono border rounded-xl transition-all ${answerStateClass(state)}`}
            onClick={() => handleSelectEquation(eq)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {eq}
          </button>
        );
      })}
    </div>
  );

  const renderMatchVisualOptions = (visOptions: Array<{ type: string; count: number }>) => (
    <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
      {visOptions.map((vo, idx) => {
        const isSelected = selectedVisualIdx === idx;
        const isCorrectOpt = vo.count === currentChallenge?.correctAnswer;
        let state: AnswerChoiceState = 'idle';
        if (showCorrectAnswer && isCorrectOpt) state = 'correct';
        else if (showCorrectAnswer && isSelected && !isCorrectOpt) state = 'incorrect';
        else if (isSelected) state = 'selected';

        return (
          <button
            key={idx}
            type="button"
            className={`p-3 rounded-lg border transition-all ${answerStateClass(state)}`}
            onClick={() => handleSelectVisual(idx)}
            disabled={isCurrentChallengeComplete || allChallengesComplete}
          >
            {/* Bespoke interaction surface — the SVG visual the student picks. */}
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
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="blue" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            <LuminaBadge accent="amber" className="text-xs">
              Within {maxNumber}
            </LuminaBadge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Progress & Stats Bar */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {currentChallengeIndex + 1} / {challenges.length}
              </span>
              {currentChallenge && (
                <LuminaBadge className="text-xs">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
                </LuminaBadge>
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
          <LuminaPrompt>
            <span className="text-sm">{currentChallenge.instruction}</span>
          </LuminaPrompt>
        )}

        {/* Main Challenge Area */}
        {currentChallenge && !allChallengesComplete && (
          <div className="relative">
            {/* Visual Aid (visual-fact phase) — bespoke SVG interaction surface */}
            {currentChallenge.type === 'visual-fact' && currentChallenge.visualType && (
              <div className="mb-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                <VisualAid
                  type={currentChallenge.visualType}
                  count={currentChallenge.visualCount ?? currentChallenge.correctAnswer}
                />
              </div>
            )}

            {/* Equation Display — bespoke math readout */}
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
            <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
              Next Challenge
            </LuminaActionButton>
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default MathFactFluency;
