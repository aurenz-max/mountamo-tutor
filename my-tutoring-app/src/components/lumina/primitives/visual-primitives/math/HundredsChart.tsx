'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaChallengeCounter,
  LuminaPrompt,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaActionButton,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HundredsChartMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeHundredsChartCheck, hundredsChartAssignment, hundredsChartMatches, hundredsChartScene } from './hundredsChartWorkspace';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { hundredsChartPipPose } from '../../../pip/hundredsChartPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

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
  /** Within-mode support tier (set by the generator when config.difficulty is
   *  present). Drives the tutor's reveal depth so it doesn't leak what a hard
   *  tier withheld on screen. */
  supportTier?: 'easy' | 'medium' | 'hard';
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
  highlight_sequence:  { label: 'Highlight', icon: '🔦', accentColor: 'purple' },
  complete_sequence:   { label: 'Complete',  icon: '✨',        accentColor: 'blue' },
  identify_pattern:    { label: 'Identify',  icon: '🔍', accentColor: 'emerald' },
  find_skip_value:     { label: 'Find Skip', icon: '🧮', accentColor: 'amber' },
};

const CELL_COLORS = [
  'bg-purple-500/60',
  'bg-blue-500/60',
  'bg-emerald-500/60',
  'bg-amber-500/60',
  'bg-rose-500/60',
  'bg-cyan-500/60',
];

const RETRY_PENALTY = 0.15;

// ============================================================================
// Props
// ============================================================================

interface HundredsChartProps {
  data: HundredsChartData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useHundredsChartProgress = useWorkspaceProgressFor('hundreds-chart');

// ============================================================================
// Component
// ============================================================================

function HundredsChartSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: HundredsChartProps) {
  const {
    title,
    description,
    challenges = [],
    gridMax = 100,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `hundreds-chart-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Bound after the state it clears is declared; the progress hook calls it only after render. */
  const reopen = useRef<(retry: boolean) => void>(() => {});

  // -------------------------------------------------------------------------
  // Challenge progress: the teaching workspace owns it
  // -------------------------------------------------------------------------
  const progress = useHundredsChartProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || 'mixed', workspace, assignment: hundredsChartAssignment,
    onItemOpened: (_index, retry) => reopen.current(retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [currentRetries, setCurrentRetries] = useState(0);

  // Drag-to-paint state
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'select' | 'deselect'>('select');
  const gridRef = useRef<HTMLDivElement>(null);

  // A fresh challenge starts clean; Try again clears the rejected cells or choice.
  reopen.current = (retry) => {
    setSelectedCells(new Set());
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    if (!retry) setCurrentRetries(0);
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
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

  const currentSolved = challengeResults.some(r => r.challengeId === currentChallenge?.id && r.correct);
  /** Learner input is closed while a checked answer waits for Try again, and once the challenge is solved. */
  const learnerBlocked = () => !canAttempt || currentSolved || allChallengesComplete;

  // -------------------------------------------------------------------------
  // Drag-to-paint handlers
  // -------------------------------------------------------------------------
  const applyCellAction = useCallback((num: number) => {
    if (givenSet.has(num)) return;
    SoundManager.tick();
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

  const handlePointerDown = (num: number) => {
    if (learnerBlocked() || !isInteractive) return;
    if (givenSet.has(num)) return;

    isDraggingRef.current = true;
    // If cell is already selected, drag mode = deselect; otherwise select
    dragModeRef.current = selectedCells.has(num) ? 'deselect' : 'select';
    applyCellAction(num);
  };

  const handlePointerEnter = (num: number) => {
    if (!isDraggingRef.current || !isInteractive || learnerBlocked()) return;
    applyCellAction(num);
  };

  /** A keyboard (or assistive) activation arrives as a click with no pointer press behind it: one toggle. */
  const handleKeyActivate = (num: number) => {
    if (learnerBlocked() || !isInteractive || givenSet.has(num)) return;
    dragModeRef.current = selectedCells.has(num) ? 'deselect' : 'select';
    applyCellAction(num);
  };

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
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !isInteractive || learnerBlocked()) return;
    e.preventDefault(); // prevent scroll while painting
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const num = getCellNumFromElement(el);
    if (num !== null) applyCellAction(num);
  };

  // -------------------------------------------------------------------------
  // Other handlers
  // -------------------------------------------------------------------------
  const handleOptionSelect = (option: string) => {
    if (learnerBlocked() || !currentChallenge) return;
    SoundManager.select();
    setSelectedOption(option);
    setFeedback('');
    setFeedbackType('');
  };

  const handleCheck = () => {
    if (!currentChallenge || learnerBlocked()) return;
    const view = { cells: selectedCells, option: selectedOption };
    const isCorrect = hundredsChartMatches(currentChallenge, view);

    incrementAttempts();

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Correct!');
      setFeedbackType('success');

      const score = Math.max(0, 100 - currentRetries * RETRY_PENALTY * 100);
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score,
      });
    } else {
      SoundManager.playIncorrect();
      setCurrentRetries(r => r + 1);
      setFeedback(currentChallenge.hint || 'Not quite. Try again!');
      setFeedbackType('error');
    }
    progress.commitCheck?.(describeHundredsChartCheck(currentChallenge, view), isCorrect);
  };

  // -------------------------------------------------------------------------
  // Completion: the runtime advances; once every challenge is solved, submit once
  // -------------------------------------------------------------------------
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || hasAutoSubmittedRef.current) return;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    hasAutoSubmittedRef.current = true;
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
    submitEvaluation(overallScore >= 70, overallScore, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, challengeResults, challenges.length, submitEvaluation]);

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

  // What the tutor and the observer are shown, republished every render. Derived from the challenge
  // alone, so opening an item adds no revision after the advance.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...hundredsChartScene(currentChallenge, { gridMax }), demonstration: [],
      canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
  });

  // -------------------------------------------------------------------------
  // Pip shared surface
  // -------------------------------------------------------------------------
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the cell or option the child last touched; Pip never selects, checks, or
  // advances. Tutor audio counts only while the tutor is on this block and began
  // on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, !currentSolved && !allChallengesComplete);
  const tutorSpeaking = ctx.isAudioPlaying && !!currentChallenge
    && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId);
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete) return null;
    const targets = pip.targets();
    const pose = hundredsChartPipPose({
      running: true, preparing: false, currentSolved, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Hundreds chart',
      dock: pip.dock.current, targets, pose,
    };
  });

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
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {description && (
              <LuminaCardDescription className="text-sm mt-1">{description}</LuminaCardDescription>
            )}
          </div>
          {challenges.length > 0 && (
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
            />
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Completion summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You mastered the hundreds chart patterns!"
            className="mb-6"
          />
        )}

        {/* Challenge instruction */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>
            <p className="text-sm font-medium">{currentChallenge.instruction}</p>
            {isInteractive && (
              <p className="text-slate-400 text-xs mt-1">
                Click or drag across cells to select them
              </p>
            )}
          </LuminaPrompt>
        )}

        {/* Hundreds Chart Grid — bespoke drag-to-paint interaction surface */}
        <div className="flex justify-center">
          <div ref={pip.ref('chart')} data-pip-object="chart">
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
              const clickable = !allChallengesComplete && !currentSolved && canAttempt && isInteractive && !isGiven;

              return (
                <button
                  key={num}
                  type="button"
                  data-cell={num}
                  ref={pip.ref(`cell-${num}`)}
                  data-pip-object={`cell-${num}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent text selection
                    if (clickable) { pip.look(`cell-${num}`); handlePointerDown(num); }
                  }}
                  onMouseEnter={() => {
                    if (clickable && isDraggingRef.current) pip.look(`cell-${num}`);
                    if (clickable) handlePointerEnter(num);
                  }}
                  onTouchStart={() => {
                    if (clickable) { pip.look(`cell-${num}`); handlePointerDown(num); }
                  }}
                  onClick={(e) => {
                    // A pointer press already toggled on mousedown/touchstart; only a click with no press
                    // behind it (keyboard, assistive tech) toggles here.
                    if (e.detail === 0 && clickable) { pip.look(`cell-${num}`); handleKeyActivate(num); }
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
        </div>

        {/* Pip's dock sits between the chart and the answers below it
            (options, Check), so an outline on the chart never crosses a choice. */}
        {pipStore && !allChallengesComplete && (
          <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
            className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
        )}

        {/* Multiple choice options */}
        {isMultipleChoice && currentChallenge && !allChallengesComplete && (
          <div className="flex flex-wrap gap-2 justify-center">
            {currentChallenge.options.map((opt) => {
              let state: AnswerChoiceState;
              if (currentSolved) {
                state = selectedOption === opt ? 'correct' : 'dimmed';
              } else {
                state = selectedOption === opt ? 'selected' : 'idle';
              }
              return (
                <LuminaAnswerChoice
                  key={opt}
                  ref={pip.ref(`option-${opt}`)}
                  data-pip-object={`option-${opt}`}
                  state={state}
                  onClick={() => { if (learnerBlocked()) return; pip.look(`option-${opt}`); handleOptionSelect(opt); }}
                  disabled={currentSolved || !canAttempt}
                  className="w-auto p-3 text-center"
                >
                  {opt}
                </LuminaAnswerChoice>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* The chart's own Check; the runtime advances. */}
        {!allChallengesComplete && currentChallenge && !currentSolved && (
          <div className="flex justify-center gap-3">
            <LuminaActionButton
              action="check"
              onClick={handleCheck}
              disabled={!canCheck || !canAttempt}
            />
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const HundredsChart = withWorkspaceOnly<HundredsChartProps>('hundreds-chart', HundredsChartSurface, props => props.data.title);

export default HundredsChart;
