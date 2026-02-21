'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberSequencerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface NumberSequencerChallenge {
  id: string;
  type: 'fill-missing' | 'before-after' | 'order-cards' | 'count-from' | 'decade-fill';
  instruction: string;
  sequence: (number | null)[];
  correctAnswers: number[];
  startNumber?: number;
  direction?: 'forward' | 'backward';
  rangeMin: number;
  rangeMax: number;
}

export interface NumberSequencerData {
  title: string;
  description?: string;
  challenges: NumberSequencerChallenge[];
  gradeBand: 'K' | '1';
  showNumberLine: boolean;
  showDotArrays: boolean;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberSequencerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'fill-missing': { label: 'Fill Missing', icon: '\uD83D\uDD22', accentColor: 'purple' },
  'before-after': { label: 'Before & After', icon: '\u2194\uFE0F', accentColor: 'blue' },
  'order-cards':  { label: 'Order Cards', icon: '\uD83C\uDCCF', accentColor: 'amber' },
  'count-from':   { label: 'Count From', icon: '\uD83D\uDE80', accentColor: 'emerald' },
  'decade-fill':  { label: 'Decade Fill', icon: '\uD83D\uDCAF', accentColor: 'cyan' },
};

const TRAIN_CAR_COLORS = [
  'bg-red-500/20 border-red-400/30',
  'bg-orange-500/20 border-orange-400/30',
  'bg-amber-500/20 border-amber-400/30',
  'bg-emerald-500/20 border-emerald-400/30',
  'bg-blue-500/20 border-blue-400/30',
  'bg-indigo-500/20 border-indigo-400/30',
  'bg-purple-500/20 border-purple-400/30',
  'bg-pink-500/20 border-pink-400/30',
];

// ============================================================================
// Dot Array Helper
// ============================================================================

function DotArray({ count, maxDots = 10 }: { count: number; maxDots?: number }) {
  const dots = Math.min(Math.abs(count), maxDots);
  const rows = Math.ceil(dots / 5);

  return (
    <div className="flex flex-col items-center gap-0.5 mt-0.5">
      {Array.from({ length: rows }, (_, row) => {
        const dotsInRow = Math.min(5, dots - row * 5);
        return (
          <div key={row} className="flex gap-0.5">
            {Array.from({ length: dotsInRow }, (_, col) => (
              <div
                key={col}
                className="w-1.5 h-1.5 rounded-full bg-slate-400/60"
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Train Car Component
// ============================================================================

function TrainCar({
  children,
  colorClass,
  showWheels = true,
  className = '',
}: {
  children: React.ReactNode;
  colorClass: string;
  showWheels?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center justify-center w-14 h-16 rounded-xl border-2 transition-all duration-300 ${colorClass} ${className}`}>
      {showWheels && (
        <>
          <div className="absolute -bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-slate-500" />
          <div className="absolute -bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-slate-600 border border-slate-500" />
        </>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

interface NumberSequencerProps {
  data: NumberSequencerData;
  className?: string;
}

const NumberSequencer: React.FC<NumberSequencerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    showNumberLine = false,
    showDotArrays = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Shared Hooks ──────────────────────────────────────────────

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
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Domain-Specific State ─────────────────────────────────────

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // For fill-missing, before-after, decade-fill: sequence index → typed value
  const [fillAnswers, setFillAnswers] = useState<Record<number, string>>({});
  // For order-cards: ordered list of numbers placed by student
  const [orderedCards, setOrderedCards] = useState<number[]>([]);
  // For count-from: sequential inputs
  const [countInputs, setCountInputs] = useState<string[]>([]);

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [correctSlots, setCorrectSlots] = useState<Set<number>>(new Set());

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `number-sequencer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation Hook ───────────────────────────────────────────

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NumberSequencerMetrics>({
    primitiveType: 'number-sequencer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ───────────────────────────────────────────────

  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'fill-missing',
    instruction: currentChallenge?.instruction ?? '',
    sequence: currentChallenge?.sequence ?? [],
    correctAnswers: currentChallenge?.correctAnswers ?? [],
    direction: currentChallenge?.direction ?? 'forward',
    attemptNumber: currentAttempts + 1,
    rangeMin: currentChallenge?.rangeMin ?? 0,
    rangeMax: currentChallenge?.rangeMax ?? 20,
    startNumber: currentChallenge?.startNumber,
  }), [
    gradeBand, challenges.length, currentChallengeIndex,
    currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'number-sequencer',
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
      `[ACTIVITY_START] Number Sequencer for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering number sequences and patterns. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}). `
      + `Introduce warmly: "Let's explore number patterns! Numbers like to be in order — let's figure out where they go."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Derived: blank positions in current sequence ──────────────

  const blankIndices = useMemo(() => {
    if (!currentChallenge) return [];
    return currentChallenge.sequence
      .map((val, idx) => (val === null ? idx : -1))
      .filter(idx => idx >= 0);
  }, [currentChallenge]);

  // Init count-from inputs when challenge changes
  useEffect(() => {
    if (currentChallenge?.type === 'count-from' && currentChallenge.correctAnswers) {
      setCountInputs(new Array(currentChallenge.correctAnswers.length).fill(''));
    }
  }, [currentChallengeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check Answer ──────────────────────────────────────────────

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;

    incrementAttempts();
    let correct = false;
    let studentAnswerStr = '';

    switch (currentChallenge.type) {
      case 'fill-missing':
      case 'before-after':
      case 'decade-fill': {
        const studentValues = blankIndices.map(idx => parseInt(fillAnswers[idx] || '', 10));
        correct = currentChallenge.correctAnswers.every(
          (ans, i) => studentValues[i] === ans
        );
        studentAnswerStr = studentValues.join(', ');
        if (correct) setCorrectSlots(new Set(blankIndices));
        break;
      }
      case 'order-cards': {
        correct = currentChallenge.correctAnswers.every(
          (ans, i) => orderedCards[i] === ans
        );
        studentAnswerStr = orderedCards.join(', ');
        if (correct) setCorrectSlots(new Set(orderedCards.map((_, i) => i)));
        break;
      }
      case 'count-from': {
        const studentValues = countInputs.map(v => parseInt(v || '', 10));
        correct = currentChallenge.correctAnswers.every(
          (ans, i) => studentValues[i] === ans
        );
        studentAnswerStr = studentValues.join(', ');
        if (correct) setCorrectSlots(new Set(countInputs.map((_, i) => i)));
        break;
      }
    }

    if (correct) {
      setFeedback('Correct! Great job!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly completed "${currentChallenge.instruction}". `
        + `Type: ${currentChallenge.type}. Congratulate briefly and enthusiastically!`,
        { silent: true }
      );
    } else {
      setFeedback('Not quite — try again!');
      setFeedbackType('error');
      const correctStr = currentChallenge.correctAnswers.join(', ');
      sendText(
        `[ANSWER_INCORRECT] Student answered "${studentAnswerStr}" but correct is "${correctStr}". `
        + `Challenge: "${currentChallenge.instruction}" (${currentChallenge.type}). Attempt ${currentAttempts + 1}. `
        + `Give a hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, incrementAttempts, blankIndices,
    fillAnswers, orderedCards, countInputs, currentAttempts, recordResult, sendText,
  ]);

  // ── Advance to Next Challenge ─────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges complete
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their number sequence skills!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const typeAccuracies: Record<string, number | undefined> = {};
        for (const type of ['fill-missing', 'before-after', 'order-cards', 'count-from', 'decade-fill'] as const) {
          const typeChallenges = challenges.filter(c => c.type === type);
          if (typeChallenges.length > 0) {
            const typeResults = challengeResults.filter(r =>
              typeChallenges.some(c => c.id === r.challengeId)
            );
            typeAccuracies[type] = typeResults.length > 0
              ? Math.round((typeResults.filter(r => r.correct).length / typeResults.length) * 100)
              : 0;
          }
        }

        const metrics: NumberSequencerMetrics = {
          type: 'number-sequencer',
          accuracy,
          attemptsCount: totalAttempts,
          sequenceUnderstanding: accuracy >= 80,
          fillMissingAccuracy: typeAccuracies['fill-missing'],
          beforeAfterAccuracy: typeAccuracies['before-after'],
          orderCardsAccuracy: typeAccuracies['order-cards'],
          countFromAccuracy: typeAccuracies['count-from'],
          decadeFillAccuracy: typeAccuracies['decade-fill'],
        };

        submitEvaluation(
          correctCount === challenges.length,
          accuracy,
          metrics,
          { challengeResults }
        );
      }
      return;
    }

    // Reset domain-specific state
    setFillAnswers({});
    setOrderedCards([]);
    setCountInputs([]);
    setFeedback('');
    setFeedbackType('');
    setCorrectSlots(new Set());

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
      + `Type: ${nextChallenge.type}. "${nextChallenge.instruction}". Introduce it briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // ── Auto-submit on all complete ───────────────────────────────

  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ──────────────────────────────────────────────────

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  const canCheckAnswer = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return false;
    switch (currentChallenge.type) {
      case 'fill-missing':
      case 'before-after':
      case 'decade-fill':
        return blankIndices.every(idx => fillAnswers[idx]?.trim());
      case 'order-cards':
        return orderedCards.length === currentChallenge.correctAnswers.length;
      case 'count-from':
        return countInputs.every(v => v.trim());
      default:
        return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, blankIndices, fillAnswers, orderedCards, countInputs]);

  // ── Order Cards Handlers ──────────────────────────────────────

  const handleCardTap = useCallback((num: number) => {
    if (isCurrentChallengeComplete || hasSubmittedEvaluation) return;
    setOrderedCards(prev => [...prev, num]);
  }, [isCurrentChallengeComplete, hasSubmittedEvaluation]);

  const handleUndoCard = useCallback(() => {
    setOrderedCards(prev => prev.slice(0, -1));
  }, []);

  const handleResetCards = useCallback(() => {
    setOrderedCards([]);
  }, []);

  // ── RENDER ────────────────────────────────────────────────────

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-indigo-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {currentChallenge && !allChallengesComplete && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-amber-300 text-xs">
                {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Progress Dots */}
        {challenges.length > 0 && !allChallengesComplete && (
          <div className="flex items-center gap-2 flex-wrap">
            {challenges.map((ch, i) => {
              const isDone = challengeResults.some(r => r.challengeId === ch.id && r.correct);
              const isCurrent = i === currentChallengeIndex;
              return (
                <div
                  key={ch.id}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                      : isCurrent
                        ? 'bg-indigo-500/20 border-2 border-indigo-400/50 text-indigo-300 scale-110'
                        : 'bg-slate-800/30 border border-slate-700/30 text-slate-500'
                  }`}
                >
                  {isDone ? '\u2713' : i + 1}
                </div>
              );
            })}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Challenge Type: Fill-Missing & Before-After (Train Track)
           ═══════════════════════════════════════════════════════════ */}
        {currentChallenge && !allChallengesComplete &&
          (currentChallenge.type === 'fill-missing' || currentChallenge.type === 'before-after') && (
          <div className="relative">
            {/* Train track rail */}
            <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-700/50 rounded-full -translate-y-1/2 z-0" />

            <div className="flex items-center justify-center gap-2 overflow-x-auto py-4 px-2 relative z-10">
              {currentChallenge.sequence.map((num, idx) => {
                const isBlank = num === null;
                const blankOrderIndex = isBlank ? blankIndices.indexOf(idx) : -1;
                const isCorrectlyFilled = correctSlots.has(idx);

                return (
                  <TrainCar
                    key={idx}
                    colorClass={
                      isBlank
                        ? isCorrectlyFilled
                          ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                          : 'bg-slate-800/50 border-dashed border-white/20'
                        : TRAIN_CAR_COLORS[idx % TRAIN_CAR_COLORS.length]
                    }
                  >
                    {isBlank ? (
                      <input
                        type="number"
                        min={currentChallenge.rangeMin}
                        max={currentChallenge.rangeMax}
                        value={fillAnswers[idx] || ''}
                        onChange={e => setFillAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="w-10 h-8 bg-transparent text-center text-lg font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={isCurrentChallengeComplete || hasSubmittedEvaluation}
                        onKeyDown={e => e.key === 'Enter' && canCheckAnswer && handleCheckAnswer()}
                        autoFocus={blankOrderIndex === 0}
                      />
                    ) : (
                      <>
                        <span className="text-lg font-bold text-slate-100">{num}</span>
                        {showDotArrays && <DotArray count={num} />}
                      </>
                    )}
                  </TrainCar>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Challenge Type: Order Cards
           ═══════════════════════════════════════════════════════════ */}
        {currentChallenge && !allChallengesComplete && currentChallenge.type === 'order-cards' && (
          <div className="space-y-4">
            {/* Available Cards Pool */}
            <div>
              <p className="text-slate-400 text-xs mb-2">Tap cards in the correct order:</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {currentChallenge.sequence.filter((n): n is number => n !== null).map((num) => {
                  const isPlaced = orderedCards.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => !isPlaced && handleCardTap(num)}
                      disabled={isPlaced || isCurrentChallengeComplete || hasSubmittedEvaluation}
                      className={`
                        w-14 h-16 rounded-xl border-2 flex flex-col items-center justify-center
                        transition-all duration-200
                        ${isPlaced
                          ? 'opacity-30 scale-90 bg-slate-800/30 border-slate-700/30 cursor-default'
                          : 'bg-indigo-500/15 border-indigo-400/30 hover:bg-indigo-500/25 hover:scale-105 hover:border-indigo-400/60 cursor-pointer'
                        }
                      `}
                    >
                      <span className="text-lg font-bold text-slate-100">{num}</span>
                      {showDotArrays && <DotArray count={num} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Placement Slots */}
            <div>
              <p className="text-slate-400 text-xs mb-2">Your order:</p>
              <div className="relative">
                <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-700/50 rounded-full -translate-y-1/2 z-0" />
                <div className="flex items-center justify-center gap-2 relative z-10 py-4">
                  {currentChallenge.correctAnswers.map((_, idx) => {
                    const placedNum = orderedCards[idx];
                    const isCorrect = correctSlots.has(idx);

                    return (
                      <TrainCar
                        key={idx}
                        colorClass={
                          placedNum !== undefined
                            ? isCorrect
                              ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                              : 'bg-amber-500/15 border-amber-400/30'
                            : 'bg-slate-800/30 border-dashed border-slate-600/30'
                        }
                      >
                        {placedNum !== undefined ? (
                          <>
                            <span className="text-lg font-bold text-slate-100">{placedNum}</span>
                            {showDotArrays && <DotArray count={placedNum} />}
                          </>
                        ) : (
                          <span className="text-slate-600 text-sm">{idx + 1}</span>
                        )}
                      </TrainCar>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Undo / Reset */}
            {orderedCards.length > 0 && !isCurrentChallengeComplete && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs"
                  onClick={handleUndoCard}
                >
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-xs"
                  onClick={handleResetCards}
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Challenge Type: Count From
           ═══════════════════════════════════════════════════════════ */}
        {currentChallenge && !allChallengesComplete && currentChallenge.type === 'count-from' && (
          <div className="relative">
            <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-700/50 rounded-full -translate-y-1/2 z-0" />
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-4 px-2 relative z-10">
              {/* Starting number */}
              <TrainCar colorClass="bg-indigo-500/20 border-indigo-400/40">
                <span className="text-lg font-bold text-indigo-300">{currentChallenge.startNumber}</span>
                {showDotArrays && currentChallenge.startNumber !== undefined && (
                  <DotArray count={currentChallenge.startNumber} />
                )}
              </TrainCar>

              {/* Direction arrow */}
              <span className="text-slate-500 text-lg select-none">
                {currentChallenge.direction === 'backward' ? '\u2190' : '\u2192'}
              </span>

              {/* Input slots */}
              {countInputs.map((val, idx) => {
                const isCorrect = correctSlots.has(idx);
                return (
                  <TrainCar
                    key={idx}
                    colorClass={
                      isCorrect
                        ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                        : 'bg-slate-800/50 border-dashed border-white/20'
                    }
                  >
                    <input
                      type="number"
                      value={val}
                      onChange={e => {
                        const newInputs = [...countInputs];
                        newInputs[idx] = e.target.value;
                        setCountInputs(newInputs);
                      }}
                      className="w-10 h-8 bg-transparent text-center text-lg font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isCurrentChallengeComplete || hasSubmittedEvaluation}
                      onKeyDown={e => e.key === 'Enter' && canCheckAnswer && handleCheckAnswer()}
                      autoFocus={idx === 0}
                    />
                  </TrainCar>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            Challenge Type: Decade Fill (Hundred Chart)
           ═══════════════════════════════════════════════════════════ */}
        {currentChallenge && !allChallengesComplete && currentChallenge.type === 'decade-fill' && (
          <div className="flex justify-center">
            <div className="grid grid-cols-10 gap-1">
              {Array.from(
                { length: currentChallenge.rangeMax - currentChallenge.rangeMin + 1 },
                (_, i) => currentChallenge.rangeMin + i
              ).map(num => {
                const answerIdx = currentChallenge.correctAnswers.indexOf(num);
                const isBlank = answerIdx >= 0;
                const blankIdx = isBlank ? blankIndices[answerIdx] : -1;
                const isCorrectlyFilled = isBlank && correctSlots.has(blankIdx);
                const isDecade = num % 10 === 0;

                return (
                  <div
                    key={num}
                    className={`
                      w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold
                      transition-all duration-300 border
                      ${isBlank
                        ? isCorrectlyFilled
                          ? 'bg-emerald-500/20 border-emerald-400/50'
                          : 'bg-slate-800/50 border-dashed border-white/20'
                        : isDecade
                          ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300'
                          : 'bg-slate-800/20 border-slate-700/20 text-slate-400'
                      }
                    `}
                  >
                    {isBlank ? (
                      <input
                        type="number"
                        value={fillAnswers[blankIdx] || ''}
                        onChange={e => setFillAnswers(prev => ({ ...prev, [blankIdx]: e.target.value }))}
                        className="w-8 h-7 bg-transparent text-center text-sm font-bold text-slate-100 focus:outline-none rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={isCurrentChallengeComplete || hasSubmittedEvaluation}
                        onKeyDown={e => e.key === 'Enter' && canCheckAnswer && handleCheckAnswer()}
                      />
                    ) : (
                      num
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Number Line Reference */}
        {showNumberLine && currentChallenge && !allChallengesComplete && (
          <div className="flex items-center justify-center px-4 py-2">
            <div className="relative w-full max-w-md">
              <div className="h-0.5 bg-slate-600/50 w-full" />
              <div className="flex justify-between -mt-2">
                {Array.from(
                  { length: Math.min(currentChallenge.rangeMax - currentChallenge.rangeMin + 1, 21) },
                  (_, i) => currentChallenge.rangeMin + i
                ).map(n => (
                  <div key={n} className="flex flex-col items-center">
                    <div className="w-px h-2 bg-slate-500/50" />
                    <span className="text-[10px] text-slate-500 mt-0.5">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' : 'text-red-400'
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
                disabled={!canCheckAnswer || hasSubmittedEvaluation}
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
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Sequence Complete!"
            celebrationMessage={`You mastered all ${challenges.length} number sequence challenges!`}
            className="mt-4"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NumberSequencer;
