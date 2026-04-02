'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { DigitalSkillsSimMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface DigitalSkillsSimChallenge {
  id: string;
  type: 'click' | 'drag' | 'type';
  instruction: string;
  /** Click: label on the target button */
  targetLabel?: string;
  /** Click: emoji shown on the target */
  targetEmoji?: string;
  /** Drag: label of the item to drag */
  dragItemLabel?: string;
  /** Drag: emoji of the item to drag */
  dragItemEmoji?: string;
  /** Drag: label of the drop zone */
  dropZoneLabel?: string;
  /** Type: the key the student should press */
  targetKey?: string;
  /** Type: a hint about the key */
  keyHint?: string;
}

export interface DigitalSkillsSimData {
  title: string;
  description: string;
  challenges: DigitalSkillsSimChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DigitalSkillsSimMetrics>) => void;
}

// ============================================================================
// Phase config
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  click: { label: 'Click Practice', icon: '🖱️', accentColor: 'blue' },
  drag:  { label: 'Drag Practice',  icon: '✋', accentColor: 'purple' },
  type:  { label: 'Type Practice',  icon: '⌨️', accentColor: 'emerald' },
};

// Virtual keyboard layout rows
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// ============================================================================
// Props
// ============================================================================

interface DigitalSkillsSimProps {
  data: DigitalSkillsSimData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const DigitalSkillsSim: React.FC<DigitalSkillsSimProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `digital-skills-sim-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Shared hooks for challenge progression
  // -------------------------------------------------------------------------
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentIndex] ?? null;

  // -------------------------------------------------------------------------
  // Local state for interactions
  // -------------------------------------------------------------------------
  const [clickTargetPos, setClickTargetPos] = useState({ x: 50, y: 50 });
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [dragState, setDragState] = useState<'idle' | 'dragging' | 'dropped'>('idle');
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [typedKey, setTypedKey] = useState<string | null>(null);
  const challengeStartRef = useRef(Date.now());

  // Randomize click target position on each challenge
  useEffect(() => {
    if (currentChallenge?.type === 'click') {
      setClickTargetPos({
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 70,
      });
    }
    setShowFeedback(null);
    setDragState('idle');
    setDragPos({ x: 0, y: 0 });
    setTypedKey(null);
    challengeStartRef.current = Date.now();
  }, [currentIndex, currentChallenge?.type]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<DigitalSkillsSimMetrics>({
    primitiveType: 'digital-skills-sim',
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
    title,
    currentPhase: currentChallenge?.type ?? 'none',
    challengeIndex: currentIndex,
    totalChallenges: challenges.length,
    instruction: currentChallenge?.instruction ?? '',
  }), [title, currentChallenge, currentIndex, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'digital-skills-sim',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K-1',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Digital Skills Sim: "${title}". ${challenges.length} challenges across click, drag, and type phases. `
      + `Introduce the activity warmly. This teaches basic computer skills to young learners.`,
      { silent: true },
    );
  }, [isConnected, title, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Handle correct answer + advance
  // -------------------------------------------------------------------------
  const handleCorrect = useCallback(() => {
    if (!currentChallenge) return;
    const timeMs = Date.now() - challengeStartRef.current;

    setShowFeedback('correct');
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
      timeMs,
    });

    if (isConnected) {
      sendText(
        `[ANSWER_CORRECT] Student completed a ${currentChallenge.type} challenge: "${currentChallenge.instruction}". `
        + `Attempts: ${currentAttempts + 1}. Time: ${Math.round(timeMs / 1000)}s. Congratulate briefly!`,
        { silent: true },
      );
    }

    // Auto-advance after a brief delay
    setTimeout(() => {
      if (!advanceProgress()) {
        // All challenges done — handled by allChallengesComplete effect
      } else if (isConnected) {
        const next = challenges[currentIndex + 1];
        if (next) {
          sendText(
            `[NEXT_ITEM] Moving to challenge ${currentIndex + 2} of ${challenges.length}. `
            + `Type: ${next.type}. Instruction: "${next.instruction}". Introduce briefly.`,
            { silent: true },
          );
        }
      }
    }, 800);
  }, [currentChallenge, currentAttempts, currentIndex, challenges, isConnected, sendText, recordResult, advanceProgress]);

  const handleWrong = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    setShowFeedback('wrong');

    if (isConnected) {
      sendText(
        `[ANSWER_INCORRECT] Student missed a ${currentChallenge.type} challenge: "${currentChallenge.instruction}". `
        + `Attempt ${currentAttempts + 1}. Give a gentle hint.`,
        { silent: true },
      );
    }

    setTimeout(() => setShowFeedback(null), 600);
  }, [currentChallenge, currentAttempts, isConnected, sendText, incrementAttempts]);

  // -------------------------------------------------------------------------
  // Submit evaluation when all complete
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challengeResults.length) * 100);
  }, [allChallengesComplete, challengeResults]);

  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation) return;

    const clickResults = challengeResults.filter((_, i) => challenges[i]?.type === 'click');
    const dragResults = challengeResults.filter((_, i) => challenges[i]?.type === 'drag');
    const typeResults = challengeResults.filter((_, i) => challenges[i]?.type === 'type');

    const avgTime = challengeResults.length > 0
      ? Math.round(challengeResults.reduce((s, r) => s + (r.timeMs as number || 0), 0) / challengeResults.length)
      : 0;

    const metrics: DigitalSkillsSimMetrics = {
      type: 'digital-skills-sim',
      clickAccuracy: clickResults.length > 0
        ? Math.round((clickResults.filter(r => r.correct).length / clickResults.length) * 100) : 100,
      dragAccuracy: dragResults.length > 0
        ? Math.round((dragResults.filter(r => r.correct).length / dragResults.length) * 100) : 100,
      typeAccuracy: typeResults.length > 0
        ? Math.round((typeResults.filter(r => r.correct).length / typeResults.length) * 100) : 100,
      totalAttempts: challengeResults.reduce((s, r) => s + r.attempts, 0),
      averageTimeMs: avgTime,
      challengesCompleted: challengeResults.length,
      totalChallenges: challenges.length,
    };

    submitEvaluation(
      localOverallScore >= 70,
      localOverallScore,
      metrics,
      { challengeResults },
    );

    if (isConnected) {
      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Student finished all digital skills challenges! Phase scores: ${phaseScoreStr}. `
        + `Overall: ${localOverallScore}%. Give encouraging phase-specific feedback for a young learner.`,
        { silent: true },
      );
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, challengeResults, challenges, localOverallScore, phaseResults, isConnected, sendText, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Click handler
  // -------------------------------------------------------------------------
  const handleClickTarget = useCallback(() => {
    handleCorrect();
  }, [handleCorrect]);

  const handleClickMiss = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only count as miss if clicking the arena background, not the target
    if ((e.target as HTMLElement).dataset.clickTarget) return;
    handleWrong();
  }, [handleWrong]);

  // -------------------------------------------------------------------------
  // Drag handlers (pointer-based for touch + mouse)
  // -------------------------------------------------------------------------
  const dragItemRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragState('dragging');
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragPos({ x: 0, y: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (dragState !== 'dragging') return;
    setDragPos({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, [dragState]);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    if (dragState !== 'dragging') return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Check if item overlaps drop zone
    if (dragItemRef.current && dropZoneRef.current) {
      const itemRect = dragItemRef.current.getBoundingClientRect();
      const zoneRect = dropZoneRef.current.getBoundingClientRect();
      const overlap =
        itemRect.right > zoneRect.left &&
        itemRect.left < zoneRect.right &&
        itemRect.bottom > zoneRect.top &&
        itemRect.top < zoneRect.bottom;

      if (overlap) {
        setDragState('dropped');
        handleCorrect();
        return;
      }
    }

    // Snap back
    setDragState('idle');
    setDragPos({ x: 0, y: 0 });
    handleWrong();
  }, [dragState, handleCorrect, handleWrong]);

  // -------------------------------------------------------------------------
  // Type handler (keyboard events)
  // -------------------------------------------------------------------------
  const handleKeyPress = useCallback((key: string) => {
    if (!currentChallenge || currentChallenge.type !== 'type') return;
    setTypedKey(key);

    if (key.toUpperCase() === (currentChallenge.targetKey ?? '').toUpperCase()) {
      handleCorrect();
    } else {
      handleWrong();
    }
  }, [currentChallenge, handleCorrect, handleWrong]);

  // Listen for physical keyboard
  useEffect(() => {
    if (!currentChallenge || currentChallenge.type !== 'type') return;

    const handler = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        handleKeyPress(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentChallenge, handleKeyPress]);

  // -------------------------------------------------------------------------
  // Progress info
  // -------------------------------------------------------------------------
  const progressPct = challenges.length > 0
    ? Math.round(((currentIndex + (allChallengesComplete ? 1 : 0)) / challenges.length) * 100)
    : 0;

  // -------------------------------------------------------------------------
  // Render: Click challenge
  // -------------------------------------------------------------------------
  const renderClickChallenge = () => {
    if (!currentChallenge) return null;
    return (
      <div
        className="relative w-full h-64 rounded-xl bg-slate-800/50 border border-white/10 overflow-hidden cursor-crosshair select-none"
        onClick={handleClickMiss}
      >
        {/* Target */}
        <button
          data-click-target="true"
          className={`absolute w-16 h-16 rounded-full flex items-center justify-center text-2xl
            transition-all duration-200 shadow-lg
            ${showFeedback === 'correct'
              ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-110'
              : showFeedback === 'wrong'
                ? 'bg-red-500/20 border-2 border-red-400'
                : 'bg-blue-500/20 border-2 border-blue-400/60 hover:bg-blue-500/30 hover:scale-110 animate-pulse'
            }`}
          style={{
            left: `${clickTargetPos.x}%`,
            top: `${clickTargetPos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleClickTarget();
          }}
        >
          {currentChallenge.targetEmoji || '🎯'}
        </button>

        {/* Instruction overlay */}
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-xs text-slate-400 bg-slate-900/70 px-3 py-1 rounded-full">
            {currentChallenge.targetLabel || 'Click the target!'}
          </span>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Drag challenge
  // -------------------------------------------------------------------------
  const renderDragChallenge = () => {
    if (!currentChallenge) return null;
    return (
      <div className="relative w-full h-64 rounded-xl bg-slate-800/50 border border-white/10 overflow-hidden select-none">
        {/* Drop zone */}
        <div
          ref={dropZoneRef}
          className={`absolute right-8 top-1/2 -translate-y-1/2 w-24 h-24 rounded-2xl border-2 border-dashed
            flex items-center justify-center text-center transition-all duration-200
            ${dragState === 'dropped'
              ? 'border-emerald-400 bg-emerald-500/20'
              : dragState === 'dragging'
                ? 'border-blue-400 bg-blue-500/10 scale-105'
                : 'border-white/20 bg-white/5'
            }`}
        >
          <span className="text-xs text-slate-400 px-2">
            {currentChallenge.dropZoneLabel || 'Drop here'}
          </span>
        </div>

        {/* Draggable item */}
        {dragState !== 'dropped' && (
          <div
            ref={dragItemRef}
            className={`absolute left-8 top-1/2 -translate-y-1/2 w-20 h-20 rounded-xl
              flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing
              transition-colors duration-200 touch-none
              ${dragState === 'dragging'
                ? 'bg-blue-500/30 border-2 border-blue-400 shadow-xl z-10'
                : showFeedback === 'wrong'
                  ? 'bg-red-500/20 border-2 border-red-400'
                  : 'bg-white/10 border-2 border-white/20 hover:bg-white/15'
              }`}
            style={{
              transform: `translate(${dragPos.x}px, calc(-50% + ${dragPos.y}px))`,
            }}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <span className="text-2xl">{currentChallenge.dragItemEmoji || '📦'}</span>
            <span className="text-[10px] text-slate-300">{currentChallenge.dragItemLabel || 'Drag me'}</span>
          </div>
        )}

        {/* Instruction */}
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-xs text-slate-400 bg-slate-900/70 px-3 py-1 rounded-full">
            {currentChallenge.instruction}
          </span>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Type challenge
  // -------------------------------------------------------------------------
  const renderTypeChallenge = () => {
    if (!currentChallenge) return null;
    const targetKey = (currentChallenge.targetKey ?? '').toUpperCase();

    return (
      <div className="space-y-4">
        {/* Target key display */}
        <div className="text-center py-4">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl text-3xl font-bold
            transition-all duration-200
            ${showFeedback === 'correct'
              ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 scale-110'
              : showFeedback === 'wrong'
                ? 'bg-red-500/20 border-2 border-red-400 text-red-300'
                : 'bg-blue-500/10 border-2 border-blue-400/40 text-blue-300 animate-bounce'
            }`}
          >
            {targetKey}
          </div>
          {currentChallenge.keyHint && (
            <p className="text-xs text-slate-500 mt-2">{currentChallenge.keyHint}</p>
          )}
        </div>

        {/* Virtual keyboard */}
        <div className="space-y-1.5 px-2">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1">
              {row.map((key) => {
                const isTarget = key === targetKey;
                const isTyped = typedKey === key;
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    className={`w-8 h-10 sm:w-10 sm:h-11 p-0 text-xs sm:text-sm font-mono transition-all duration-150
                      ${isTarget && !showFeedback
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-200 ring-2 ring-blue-400/30'
                        : isTyped && showFeedback === 'correct'
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                          : isTyped && showFeedback === 'wrong'
                            ? 'bg-red-500/20 border border-red-400 text-red-300'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖥️</span>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          </div>
          {!allChallengesComplete && currentChallenge && (
            <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.icon} {PHASE_TYPE_CONFIG[currentChallenge.type]?.label}
            </Badge>
          )}
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Completion summary */}
        {allChallengesComplete && phaseResults.length > 0 ? (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Great Job!"
            celebrationMessage="You completed all the digital skills challenges!"
            className="mb-6"
          />
        ) : currentChallenge ? (
          <>
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Challenge {currentIndex + 1} of {challenges.length}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Instruction */}
            <p className="text-slate-200 text-sm font-medium text-center">
              {currentChallenge.instruction}
            </p>

            {/* Phase-specific UI */}
            {currentChallenge.type === 'click' && renderClickChallenge()}
            {currentChallenge.type === 'drag' && renderDragChallenge()}
            {currentChallenge.type === 'type' && renderTypeChallenge()}

            {/* Feedback toast */}
            {showFeedback && (
              <div className={`text-center text-sm font-medium py-1 transition-opacity duration-300 ${
                showFeedback === 'correct' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {showFeedback === 'correct' ? 'Nice work!' : 'Try again!'}
              </div>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm text-center py-8">No challenges available.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default DigitalSkillsSim;
