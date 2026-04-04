'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SpatialSceneMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PositionWord =
  | 'above' | 'below' | 'beside' | 'left_of' | 'right_of'
  | 'between' | 'on' | 'under' | 'next_to' | 'in_front_of' | 'behind';

export interface SceneObject {
  name: string;
  image: string; // emoji
  position: { row: number; col: number };
}

export interface SpatialSceneChallenge {
  id: string;
  type: 'identify' | 'place' | 'describe' | 'follow_directions';
  instruction: string;

  // Scene layout
  sceneObjects: SceneObject[];
  targetObject: SceneObject;

  // identify — "Where is the cat?" → multiple choice position words
  correctPosition: PositionWord;
  referenceObjectName?: string;
  options?: string[];

  // place — "Put the ball above the box" → student taps a grid cell
  correctCell?: { row: number; col: number };

  // describe — select the right position word for the shown arrangement
  // (reuses correctPosition + options)

  // follow_directions — multi-step (uses steps array)
  steps?: Array<{
    instruction: string;
    targetObject: SceneObject;
    correctCell: { row: number; col: number };
  }>;

  hint?: string;
}

export interface SpatialSceneData {
  title: string;
  description?: string;
  challenges: SpatialSceneChallenge[];
  gridSize?: number; // 3 or 4 (default 3)
  gradeBand?: 'K' | '1';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SpatialSceneMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  identify: { label: 'Identify', icon: '🔍', accentColor: 'blue' },
  place: { label: 'Place', icon: '📍', accentColor: 'purple' },
  describe: { label: 'Describe', icon: '💬', accentColor: 'emerald' },
  follow_directions: { label: 'Directions', icon: '🗺️', accentColor: 'orange' },
};

const POSITION_LABELS: Record<PositionWord, string> = {
  above: 'Above',
  below: 'Below',
  beside: 'Beside',
  left_of: 'Left of',
  right_of: 'Right of',
  between: 'Between',
  on: 'On',
  under: 'Under',
  next_to: 'Next to',
  in_front_of: 'In front of',
  behind: 'Behind',
};

// ============================================================================
// Grid Scene Component
// ============================================================================

interface GridSceneProps {
  gridSize: number;
  sceneObjects: SceneObject[];
  placedObjects?: Array<{ object: SceneObject; row: number; col: number }>;
  highlightCell?: { row: number; col: number } | null;
  targetHighlight?: { row: number; col: number } | null;
  onCellClick?: (row: number, col: number) => void;
  interactive?: boolean;
}

const GridScene: React.FC<GridSceneProps> = ({
  gridSize, sceneObjects, placedObjects = [], highlightCell, targetHighlight, onCellClick, interactive,
}) => {
  // Build a lookup map of what's in each cell
  const cellMap = useMemo(() => {
    const map: Record<string, SceneObject> = {};
    for (const obj of sceneObjects) {
      map[`${obj.position.row}-${obj.position.col}`] = obj;
    }
    for (const p of placedObjects) {
      map[`${p.row}-${p.col}`] = p.object;
    }
    return map;
  }, [sceneObjects, placedObjects]);

  return (
    <div
      className="grid gap-1 mx-auto"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        maxWidth: `${gridSize * 80}px`,
      }}
    >
      {Array.from({ length: gridSize * gridSize }, (_, i) => {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        const key = `${row}-${col}`;
        const obj = cellMap[key];
        const isHighlighted = highlightCell?.row === row && highlightCell?.col === col;
        const isTarget = targetHighlight?.row === row && targetHighlight?.col === col;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onCellClick?.(row, col)}
            disabled={!interactive}
            className={`
              w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 flex flex-col items-center justify-center
              transition-all duration-200 select-none
              ${isTarget
                ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/20'
                : isHighlighted
                ? 'border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20'
                : obj
                ? 'border-white/15 bg-slate-800/40'
                : 'border-white/5 bg-slate-900/20'}
              ${interactive && !obj ? 'hover:border-white/30 hover:bg-slate-800/30 cursor-pointer' : ''}
              ${!interactive ? 'cursor-default' : ''}
            `}
          >
            {obj && (
              <>
                <span className="text-2xl sm:text-3xl leading-none">{obj.image}</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 leading-none truncate max-w-full px-1">
                  {obj.name}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface SpatialSceneProps {
  data: SpatialSceneData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const SpatialScene: React.FC<SpatialSceneProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gridSize = 3,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Challenge Progress ─────────────────────────────────────────────
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

  // ── State ──────────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // identify / describe: selected option
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // place: selected cell
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  // follow_directions: current step index + placed objects
  const [currentStep, setCurrentStep] = useState(0);
  const [placedObjects, setPlacedObjects] = useState<Array<{ object: SceneObject; row: number; col: number }>>([]);
  const [stepsCorrect, setStepsCorrect] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `spatial-scene-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation Hook ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<SpatialSceneMetrics>({
    primitiveType: 'spatial-scene',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ────────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'identify',
    instruction: currentChallenge?.instruction ?? '',
    correctPosition: currentChallenge?.correctPosition,
    referenceObjectName: currentChallenge?.referenceObjectName,
    targetObjectName: currentChallenge?.targetObject?.name,
    attemptNumber: currentAttempts + 1,
  }), [gradeBand, challenges.length, currentChallengeIndex, currentChallenge, currentAttempts]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'spatial-scene',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Spatial Scene for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges about position words (above, below, beside, etc.). `
      + `First: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Let's look at where things are! Can you find what's above, below, and beside?"`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Reset ──────────────────────────────────────────────────────────
  const resetDomainState = useCallback(() => {
    setSelectedOption(null);
    setSelectedCell(null);
    setCurrentStep(0);
    setPlacedObjects([]);
    setStepsCorrect(0);
    setFeedback('');
    setFeedbackType('');
  }, []);

  // ── Check Handlers ─────────────────────────────────────────────────

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    incrementAttempts();
    const correct = selectedOption === currentChallenge.correctPosition;

    if (correct) {
      const posLabel = POSITION_LABELS[currentChallenge.correctPosition] || currentChallenge.correctPosition;
      setFeedback(`Yes! The ${currentChallenge.targetObject.name} is ${posLabel.toLowerCase()} the ${currentChallenge.referenceObjectName}!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student identified position "${currentChallenge.correctPosition}" correctly. Congratulate!`, { silent: true });
    } else {
      setFeedback('Not quite. Look at where the objects are in the scene!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedOption}" but correct is "${currentChallenge.correctPosition}". `
        + `Hint: "Look at the ${currentChallenge.targetObject.name}. Is it higher or lower than the ${currentChallenge.referenceObjectName}?"`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedOption, incrementAttempts, sendText]);

  const handleCheckPlace = useCallback(() => {
    if (!currentChallenge || !selectedCell) return false;
    incrementAttempts();
    const target = currentChallenge.correctCell;
    const correct = target ? selectedCell.row === target.row && selectedCell.col === target.col : false;

    if (correct) {
      setFeedback(`Perfect! You placed it in the right spot!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student placed ${currentChallenge.targetObject.name} correctly. Celebrate!`, { silent: true });
    } else {
      setFeedback(`That's not quite the right spot. Read the instruction again carefully!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student placed object at (${selectedCell.row},${selectedCell.col}) but correct is (${target?.row},${target?.col}). `
        + `Hint: "The instruction says '${currentChallenge.correctPosition}'. Think about where that means."`,
        { silent: true },
      );
      setSelectedCell(null);
    }
    return correct;
  }, [currentChallenge, selectedCell, incrementAttempts, sendText]);

  const handleCheckDescribe = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    incrementAttempts();
    const correct = selectedOption === currentChallenge.correctPosition;

    if (correct) {
      const posLabel = POSITION_LABELS[currentChallenge.correctPosition] || currentChallenge.correctPosition;
      setFeedback(`Correct! "${posLabel}" is the right position word!`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student described position as "${currentChallenge.correctPosition}" correctly.`, { silent: true });
    } else {
      setFeedback('Not quite. Look at the objects and think about their positions.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student said "${selectedOption}" but correct is "${currentChallenge.correctPosition}". `
        + `Give a hint about the spatial relationship.`,
        { silent: true },
      );
    }
    return correct;
  }, [currentChallenge, selectedOption, incrementAttempts, sendText]);

  const handlePlaceStep = useCallback((row: number, col: number) => {
    if (!currentChallenge || !currentChallenge.steps) return;
    const step = currentChallenge.steps[currentStep];
    if (!step) return;

    const correct = row === step.correctCell.row && col === step.correctCell.col;

    if (correct) {
      setPlacedObjects((prev) => [...prev, { object: step.targetObject, row, col }]);
      setStepsCorrect((prev) => prev + 1);

      if (currentStep < currentChallenge.steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
        setFeedback(`Step ${currentStep + 1} done!`);
        setFeedbackType('success');
        sendText(
          `[STEP_CORRECT] Step ${currentStep + 1}/${currentChallenge.steps.length} correct. `
          + `Next: "${currentChallenge.steps[currentStep + 1]?.instruction}". Read it to the student.`,
          { silent: true },
        );
      } else {
        // All steps done
        setFeedback('Amazing! You followed all the directions!');
        setFeedbackType('success');
        incrementAttempts();
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          stepsCorrect: stepsCorrect + 1,
          stepsTotal: currentChallenge.steps.length,
        });
        sendText(
          `[ANSWER_CORRECT] Student completed all ${currentChallenge.steps.length} placement steps. Celebrate their spatial reasoning!`,
          { silent: true },
        );
      }
    } else {
      setFeedback(`Not quite. Read step ${currentStep + 1} again and look at the scene.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Step ${currentStep + 1}: placed at (${row},${col}) but correct is (${step.correctCell.row},${step.correctCell.col}). `
        + `Hint: "${step.instruction}" — think about what "${currentChallenge.correctPosition}" means.`,
        { silent: true },
      );
    }
  }, [currentChallenge, currentStep, stepsCorrect, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Master Check ───────────────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'identify': correct = handleCheckIdentify(); break;
      case 'place': correct = handleCheckPlace(); break;
      case 'describe': correct = handleCheckDescribe(); break;
      case 'follow_directions': return; // handled step-by-step
    }

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [currentChallenge, currentAttempts, handleCheckIdentify, handleCheckPlace, handleCheckDescribe, recordResult]);

  // ── Advance ────────────────────────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their understanding of positions and spatial words!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter((r) => r.correct).length;
        const score = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: SpatialSceneMetrics = {
          type: 'spatial-scene',
          accuracy: score,
          totalAttempts,
          challengesCompleted: correctCount,
          challengesTotal: challenges.length,
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults },
        );
      }
      return;
    }

    resetDomainState();
    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}). Read it to the student.`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challengeResults, challenges, sendText,
    hasSubmittedEvaluation, submitEvaluation, resetDomainState, currentChallengeIndex,
  ]);

  // Auto-submit
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ───────────────────────────────────────────────────────
  const isCurrentChallengeCorrect = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round(
      (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
    );
  }, [allChallengesComplete, challenges, challengeResults]);

  const canCheck = useMemo(() => {
    if (!currentChallenge) return false;
    switch (currentChallenge.type) {
      case 'identify': case 'describe': return !!selectedOption;
      case 'place': return !!selectedCell;
      case 'follow_directions': return false; // step-by-step
      default: return false;
    }
  }, [currentChallenge, selectedOption, selectedCell]);

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderIdentifyOrDescribe = () => {
    if (!currentChallenge || !currentChallenge.targetObject) return null;
    const opts = currentChallenge.options || ['above', 'below', 'beside', 'next_to'];

    return (
      <div className="space-y-4">
        <GridScene
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          highlightCell={currentChallenge.targetObject.position}
        />
        <div className="grid grid-cols-2 gap-2">
          {opts.map((opt) => {
            const label = POSITION_LABELS[opt as PositionWord] || opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => !isCurrentChallengeCorrect && setSelectedOption(opt)}
                disabled={isCurrentChallengeCorrect}
                className={`
                  px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                  ${selectedOption === opt
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-slate-800/30 hover:border-white/20 text-slate-300'}
                  ${isCurrentChallengeCorrect ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPlace = () => {
    if (!currentChallenge || !currentChallenge.targetObject) return null;

    return (
      <div className="space-y-4">
        <div className="text-center mb-2">
          <span className="text-2xl">{currentChallenge.targetObject.image}</span>
          <span className="text-slate-300 text-sm ml-2">{currentChallenge.targetObject.name}</span>
          <p className="text-slate-500 text-xs mt-1">Tap a cell to place it</p>
        </div>
        <GridScene
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          highlightCell={selectedCell}
          targetHighlight={isCurrentChallengeCorrect ? currentChallenge.correctCell : undefined}
          onCellClick={(row, col) => {
            if (!isCurrentChallengeCorrect) {
              // Don't allow placing on existing objects
              const occupied = currentChallenge.sceneObjects.some(
                (o) => o.position.row === row && o.position.col === col,
              );
              if (!occupied) setSelectedCell({ row, col });
            }
          }}
          interactive={!isCurrentChallengeCorrect}
        />
      </div>
    );
  };

  const renderFollowDirections = () => {
    if (!currentChallenge || !currentChallenge.steps) return null;
    const step = currentChallenge.steps[currentStep];
    const allStepsDone = isCurrentChallengeCorrect;

    return (
      <div className="space-y-4">
        {/* Step progress */}
        <div className="flex items-center gap-1">
          {currentChallenge.steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < currentStep || allStepsDone
                  ? 'bg-emerald-400'
                  : i === currentStep
                  ? 'bg-blue-400'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Current step instruction */}
        {step && !allStepsDone && (
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-400/20 text-center">
            <span className="text-blue-300 text-xs">Step {currentStep + 1}:</span>
            <p className="text-slate-200 text-sm">{step.instruction}</p>
            <div className="mt-1">
              <span className="text-xl">{step.targetObject.image}</span>
              <span className="text-slate-400 text-xs ml-1">{step.targetObject.name}</span>
            </div>
          </div>
        )}

        <GridScene
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          placedObjects={placedObjects}
          onCellClick={(row, col) => {
            if (allStepsDone) return;
            const occupied = currentChallenge.sceneObjects.some(
              (o) => o.position.row === row && o.position.col === col,
            ) || placedObjects.some((p) => p.row === row && p.col === col);
            if (!occupied) handlePlaceStep(row, col);
          }}
          interactive={!allStepsDone}
        />
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </Badge>
            {challenges.length > 0 && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-blue-300 text-xs">
                {currentChallengeIndex + 1}/{challenges.length}
              </Badge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              const hasThisType = challenges.some((c) => c.type === type);
              if (!hasThisType) return null;
              const isActive = currentChallenge?.type === type;
              return (
                <Badge
                  key={type}
                  className={`text-xs ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Summary panel */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="Great spatial reasoning!"
            className="mb-6"
          />
        )}

        {/* Current challenge */}
        {currentChallenge && !allChallengesComplete && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
              <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            </div>

            {(currentChallenge.type === 'identify' || currentChallenge.type === 'describe') && renderIdentifyOrDescribe()}
            {currentChallenge.type === 'place' && renderPlace()}
            {currentChallenge.type === 'follow_directions' && renderFollowDirections()}

            {/* Feedback */}
            {feedback && (
              <div
                className={`p-3 rounded-xl text-sm font-medium text-center ${
                  feedbackType === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-300'
                    : 'bg-red-500/10 border border-red-400/30 text-red-300'
                }`}
              >
                {feedback}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {currentChallenge.type !== 'follow_directions' && (
                !isCurrentChallengeCorrect ? (
                  <Button
                    variant="ghost"
                    onClick={handleCheckAnswer}
                    disabled={!canCheck}
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={advanceToNextChallenge}
                    className="bg-emerald-500/20 border border-emerald-400/50 hover:bg-emerald-500/30 text-emerald-300"
                  >
                    {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                  </Button>
                )
              )}
              {currentChallenge.type === 'follow_directions' && isCurrentChallengeCorrect && (
                <Button
                  variant="ghost"
                  onClick={advanceToNextChallenge}
                  className="bg-emerald-500/20 border border-emerald-400/50 hover:bg-emerald-500/30 text-emerald-300"
                >
                  {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'See Results'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {challenges.length === 0 && (
          <div className="text-center py-8">
            <span className="text-4xl">🗺️</span>
            <p className="text-slate-400 mt-2">No challenges loaded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpatialScene;
