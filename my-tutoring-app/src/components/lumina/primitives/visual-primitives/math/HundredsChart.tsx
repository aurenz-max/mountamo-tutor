'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HundredsChartMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface HundredsChartChallenge {
  id: string;
  type: 'highlight_sequence' | 'complete_sequence' | 'identify_pattern' | 'find_skip_value';
  instruction: string;
  skipValue: number;
  startNumber: number;
  /** Pre-highlighted cells for complete_sequence / find_skip_value */
  givenCells: number[];
  /** All correct cells for highlight_sequence / complete_sequence */
  correctCells: number[];
  /** For identify_pattern: the correct description */
  correctAnswer: string;
  /** Multiple choice options for identify_pattern / find_skip_value */
  options: string[];
  hint: string;
}

export interface HundredsChartData {
  title: string;
  description?: string;
  challenges: HundredsChartChallenge[];
  gridMax?: number; // default 100
  gradeBand?: '1' | '2' | '3' | '4';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HundredsChartMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  highlight_sequence:  { label: 'Highlight', icon: '\uD83D\uDD26', accentColor: 'purple' },
  complete_sequence:   { label: 'Complete',  icon: '\u2728',        accentColor: 'blue' },
  identify_pattern:    { label: 'Identify',  icon: '\uD83D\uDD0D', accentColor: 'emerald' },
  find_skip_value:     { label: 'Find Skip', icon: '\uD83E\uDDEE', accentColor: 'amber' },
};

const CELL_COLORS = [
  'bg-purple-500/60',
  'bg-blue-500/60',
  'bg-emerald-500/60',
  'bg-amber-500/60',
  'bg-rose-500/60',
  'bg-cyan-500/60',
];

// ============================================================================
// Props
// ============================================================================

interface HundredsChartProps {
  data: HundredsChartData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const HundredsChart: React.FC<HundredsChartProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gridMax = 100,
    gradeBand = '1',
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
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [currentRetries, setCurrentRetries] = useState(0);
  const RETRY_PENALTY = 0.15;

  // Drag-to-paint state
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'select' | 'deselect'>('select');
  const gridRef = useRef<HTMLDivElement>(null);

  // Challenge progress
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

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `hundreds-chart-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startTimeRef = useRef(Date.now());

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    submittedResult,
  } = usePrimitiveEvaluation<HundredsChartMetrics>({
    primitiveType: 'hundreds-chart',
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
  const gradeLevel = `Grade ${gradeBand}`;

  const aiPrimitiveData = useMemo(() => ({
    title,
    challengeType: currentChallenge?.type ?? '',
    instruction: currentChallenge?.instruction ?? '',
    skipValue: currentChallenge?.skipValue ?? 0,
    startNumber: currentChallenge?.startNumber ?? 1,
    givenCells: currentChallenge?.givenCells?.join(', ') ?? '',
    attemptNumber: currentAttempts + 1,
    currentPhase: currentChallenge?.type ?? '',
    selectedCount: selectedCells.size,
  }), [title, currentChallenge, currentAttempts, selectedCells.size]);

  const { sendText } = useLuminaAI({
    primitiveType: 'hundreds-chart',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // -------------------------------------------------------------------------
  // Grid
  // -------------------------------------------------------------------------
  const cols = 10;
  const gridNumbers = useMemo(() => {
    return Array.from({ length: gridMax }, (_, i) => i + 1);
  }, [gridMax]);

  // Which cells are pre-highlighted (given in challenge)
  const givenSet = useMemo(() => {
    if (!currentChallenge) return new Set<number>();
    return new Set(currentChallenge.givenCells ?? []);
  }, [currentChallenge]);

  const isInteractive = currentChallenge?.type === 'highlight_sequence' ||
                        currentChallenge?.type === 'complete_sequence';

  // -------------------------------------------------------------------------
  // Drag-to-paint handlers
  // -------------------------------------------------------------------------
  const applyCellAction = useCallback((num: number) => {
    if (givenSet.has(num)) return;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (dragModeRef.current === 'select') {
        next.add(num);
      } else {
        next.delete(num);
      }
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [givenSet]);

  const getCellNumFromElement = useCallback((el: Element | null): number | null => {
    if (!el) return null;
    const attr = el.getAttribute('data-cell');
    return attr ? parseInt(attr, 10) : null;
  }, []);

  const handlePointerDown = useCallback((num: number) => {
    if (allChallengesComplete || !isInteractive) return;
    if (givenSet.has(num)) return;

    isDraggingRef.current = true;
    // If cell is already selected, drag mode = deselect; otherwise select
    dragModeRef.current = selectedCells.has(num) ? 'deselect' : 'select';
    applyCellAction(num);
  }, [allChallengesComplete, isInteractive, givenSet, selectedCells, applyCellAction]);

  const handlePointerEnter = useCallback((num: number) => {
    if (!isDraggingRef.current || !isInteractive) return;
    applyCellAction(num);
  }, [isInteractive, applyCellAction]);

  // Global mouseup / touchend to stop drag
  useEffect(() => {
    const stopDrag = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
    return () => {
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    };
  }, []);

  // Touch drag: touchmove doesn't fire on new elements, so use elementFromPoint
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || !isInteractive) return;
    e.preventDefault(); // prevent scroll while painting
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const num = getCellNumFromElement(el);
    if (num !== null) applyCellAction(num);
  }, [isInteractive, applyCellAction, getCellNumFromElement]);

  // -------------------------------------------------------------------------
  // Other handlers
  // -------------------------------------------------------------------------
  const handleOptionSelect = useCallback((option: string) => {
    if (allChallengesComplete || !currentChallenge) return;
    setSelectedOption(option);
    setFeedback('');
    setFeedbackType('');
  }, [allChallengesComplete, currentChallenge]);

  const handleCheck = useCallback(() => {
    if (!currentChallenge) return;
    const { type, correctCells, correctAnswer, skipValue } = currentChallenge;

    let isCorrect = false;

    if (type === 'highlight_sequence' || type === 'complete_sequence') {
      // For complete_sequence: only check the cells the student needed to add (not given)
      const needed = new Set(correctCells.filter(c => !givenSet.has(c)));
      const studentAdded = selectedCells;

      // Correct if student selected exactly the needed cells
      isCorrect = needed.size === studentAdded.size &&
        Array.from(needed).every(c => studentAdded.has(c));
    } else if (type === 'identify_pattern') {
      isCorrect = selectedOption === correctAnswer;
    } else if (type === 'find_skip_value') {
      isCorrect = selectedOption === String(skipValue);
    }

    incrementAttempts();

    if (isCorrect) {
      setFeedback('Correct!');
      setFeedbackType('success');

      const score = Math.max(0, 100 - currentRetries * RETRY_PENALTY * 100);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score,
      });

      sendText(
        `[ANSWER_CORRECT] Challenge ${currentChallengeIndex + 1}/${challenges.length}. ` +
        `Type: ${type}. Student got it in ${currentAttempts + 1} attempt(s). Congratulate briefly.`,
        { silent: true }
      );
    } else {
      setCurrentRetries(r => r + 1);
      setFeedback(currentChallenge.hint || 'Not quite. Try again!');
      setFeedbackType('error');

      sendText(
        `[ANSWER_INCORRECT] Challenge: "${currentChallenge.instruction}". ` +
        `Type: ${type}. Skip value: ${skipValue}. Give a hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, selectedCells, selectedOption, givenSet, currentAttempts,
      currentRetries, currentChallengeIndex, challenges.length, incrementAttempts,
      recordResult, sendText]);

  const advanceToNext = useCallback(() => {
    setSelectedCells(new Set());
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setCurrentRetries(0);

    if (!advanceProgress()) {
      // All challenges complete — submit evaluation
      const totalCorrect = challengeResults.filter(r => r.correct).length;
      const overallScore = Math.round(
        challengeResults.reduce((sum, r) => sum + (r.score ?? 0), 0) / Math.max(challengeResults.length, 1)
      );

      const metrics: HundredsChartMetrics = {
        type: 'hundreds-chart',
        totalChallenges: challenges.length,
        correctCount: totalCorrect,
        accuracy: totalCorrect / Math.max(challenges.length, 1),
        averageAttempts: challengeResults.reduce((s, r) => s + r.attempts, 0) / Math.max(challengeResults.length, 1),
      };

      submitEvaluation(
        overallScore >= 70,
        overallScore,
        metrics,
        { challengeResults }
      );

      const phaseScoreStr = phaseResults.map(
        p => `${p.label} ${p.score}% (${p.attempts} attempts)`
      ).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallScore}%. Give encouraging phase-specific feedback.`,
        { silent: true }
      );
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. ` +
      `Introduce it briefly.`,
      { silent: true }
    );
  }, [advanceProgress, challengeResults, challenges.length, currentChallengeIndex,
      phaseResults, sendText, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const isMultipleChoice = currentChallenge?.type === 'identify_pattern' ||
                           currentChallenge?.type === 'find_skip_value';

  const canCheck = isInteractive
    ? selectedCells.size > 0
    : isMultipleChoice
      ? selectedOption !== null
      : false;

  const lastResult = challengeResults[challengeResults.length - 1];
  const showNext = lastResult?.correct && !allChallengesComplete &&
    challengeResults.length === currentChallengeIndex + 1;

  // Overall score for summary panel
  const localOverallScore = useMemo(() => {
    if (challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? 0), 0) / challengeResults.length
    );
  }, [challengeResults]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          {challenges.length > 0 && (
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Completion summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={Date.now() - startTimeRef.current}
            heading="Challenge Complete!"
            celebrationMessage="You mastered the hundreds chart patterns!"
            className="mb-6"
          />
        )}

        {/* Challenge instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-slate-100 text-sm font-medium">{currentChallenge.instruction}</p>
            {isInteractive && (
              <p className="text-slate-400 text-xs mt-1">
                Click or drag across cells to select them
              </p>
            )}
          </div>
        )}

        {/* Hundreds Chart Grid */}
        <div className="flex justify-center">
          <div
            ref={gridRef}
            className="grid gap-[2px] w-fit select-none"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            onTouchMove={handleTouchMove}
          >
            {gridNumbers.map(num => {
              const isGiven = givenSet.has(num);
              const isSelected = selectedCells.has(num);
              const isHighlighted = isGiven || isSelected;

              // Determine color based on context
              let cellBg = 'bg-white/5 hover:bg-white/15';
              if (isGiven) {
                cellBg = `${CELL_COLORS[0]} ring-1 ring-purple-400/40`;
              } else if (isSelected) {
                cellBg = `${CELL_COLORS[1]} ring-1 ring-blue-400/40`;
              }

              // Non-clickable states
              const clickable = !allChallengesComplete && isInteractive && !isGiven;

              return (
                <button
                  key={num}
                  data-cell={num}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent text selection
                    if (clickable) handlePointerDown(num);
                  }}
                  onMouseEnter={() => {
                    if (clickable) handlePointerEnter(num);
                  }}
                  onTouchStart={() => {
                    if (clickable) handlePointerDown(num);
                  }}
                  disabled={!clickable && !isGiven}
                  className={`
                    w-9 h-9 sm:w-10 sm:h-10 rounded text-xs sm:text-sm font-medium
                    transition-colors duration-75 border border-white/5
                    ${cellBg}
                    ${isHighlighted ? 'text-white font-bold' : 'text-slate-300'}
                    ${clickable ? 'cursor-pointer' : 'cursor-default'}
                    ${!clickable && !isHighlighted ? 'opacity-70' : ''}
                  `}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multiple choice options */}
        {isMultipleChoice && currentChallenge && !allChallengesComplete && (
          <div className="flex flex-wrap gap-2 justify-center">
            {currentChallenge.options.map((opt) => (
              <Button
                key={opt}
                variant="ghost"
                onClick={() => handleOptionSelect(opt)}
                className={`
                  border transition-all
                  ${selectedOption === opt
                    ? 'bg-blue-500/30 border-blue-400/60 text-white'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'}
                `}
              >
                {opt}
              </Button>
            ))}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium rounded-lg p-2 ${
            feedbackType === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : feedbackType === 'error'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action buttons */}
        {!allChallengesComplete && currentChallenge && (
          <div className="flex justify-center gap-3">
            {!showNext && (
              <Button
                variant="ghost"
                onClick={handleCheck}
                disabled={!canCheck}
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100 disabled:opacity-40"
              >
                Check Answer
              </Button>
            )}
            {showNext && (
              <Button
                variant="ghost"
                onClick={advanceToNext}
                className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-200"
              >
                Next Challenge
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HundredsChart;
