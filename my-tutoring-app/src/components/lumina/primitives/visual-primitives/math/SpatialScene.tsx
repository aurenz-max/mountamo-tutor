'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { Badge } from '@/components/ui/badge';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaActionButton,
  LuminaPanel,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SpatialSceneMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeSpatialCheck, hearSceneQuestionRequest, spatialAssignment, spatialScene } from './spatialSceneWorkspace';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import type { LearningResponseEvidence } from '../../../evaluation/learningResponseEvidence';
import { modelSpatialDescription } from './spatialSceneDescriptionScript';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import type { PipTarget } from '../../../pip/PipSurfaceStore';
import { spatialScenePipPose } from '../../../pip/spatialScenePipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PositionWord =
  | 'above' | 'below' | 'beside' | 'left_of' | 'right_of'
  | 'between' | 'on' | 'under' | 'next_to' | 'in_front_of' | 'behind' | 'in';

export interface SceneObject {
  name: string;
  image: string; // emoji
  position: { row: number; col: number };
}

export interface SpatialSceneChallenge {
  id: string;
  type: 'identify' | 'place' | 'describe' | 'describe_scene' | 'follow_directions' | 'place_in' | 'place_between';
  instruction: string;

  // Scene layout
  sceneObjects: SceneObject[];
  targetObject: SceneObject;

  // identify — "Where is the cat?" → multiple choice position words
  correctPosition: PositionWord;
  referenceObjectName?: string;
  options?: string[];

  // place — "Put the ball above the box" → student taps a grid cell
  // place_in — "Put the ball IN the box" → the answer is the cell the CONTAINER
  //   occupies (referenceObjectName is the container), so occupied cells are tappable
  //   here and the placed object renders NESTED inside it. This inverts the empty-cell
  //   rule `place` relies on, which is why it is a separate challenge type rather than
  //   a flag on `place` (contract R11 + fork ladder).
  // place_between — "Put the ball between the box and the tree" → an EMPTY cell with
  //   one reference on each side; referenceObjectName + referenceObjectName2 name them.
  correctCell?: { row: number; col: number };

  /** Second reference object — `place_between` only (the checker is still cell-based). */
  referenceObjectName2?: string;

  // describe_scene: row 0 is farthest from the fixed YOU viewpoint; larger
  // rows are nearer the viewer. The relation/model stay hidden until an attempt.
  scenePerspective?: 'viewer_depth';
  modelDescription?: string;

  // describe — select the right position word for the shown arrangement
  // (reuses correctPosition + options)

  // follow_directions — multi-step (uses steps array)
  steps?: Array<{
    instruction: string;
    targetObject: SceneObject;
    correctCell: { row: number; col: number };
  }>;

  hint?: string;

  // ── Support tier (within-mode scaffolding withdrawal) ──────────────
  // Set by the generator from config.difficulty. Display-only: the checker
  // reads correctPosition/correctCell, never these flags, so withdrawing a
  // scaffold can never leak or invalidate the answer.
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Render an explicit reference-frame grid (clear cell borders). Off at hard. */
  showGrid?: boolean;
  /** Render object name labels under each emoji. Off at hard. */
  showObjectLabels?: boolean;
  /** Show position-word hints on OTHER (non-asked) objects. Easy only.
   *  ANSWER-LEAK GUARD: never labels the target↔reference relation being asked. */
  showPositionHints?: boolean;
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
  place_in: { label: 'Put In', icon: '📥', accentColor: 'cyan' },
  place: { label: 'Place', icon: '📍', accentColor: 'purple' },
  describe: { label: 'Describe', icon: '💬', accentColor: 'emerald' },
  place_between: { label: 'Between', icon: '↔️', accentColor: 'pink' },
  describe_scene: { label: 'Say the Relation', icon: '🎙️', accentColor: 'cyan' },
  follow_directions: { label: 'Directions', icon: '🗺️', accentColor: 'orange' },
};

/** Cell-judged modes: the student taps a grid cell and `correctCell` is the answer. */
const CELL_JUDGED_TYPES = new Set(['place', 'place_in', 'place_between']);

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
  in: 'In',
};

interface PerspectiveSceneProps {
  challenge: SpatialSceneChallenge;
  revealRelation?: boolean;
  /** Pip only: registers the scene as a shared-surface target. */
  sceneRef?: (element: Element | null) => void;
}

/** Fixed viewer-relative scene: row 0 is far, row 2 is nearest the YOU marker. */
const PerspectiveScene: React.FC<PerspectiveSceneProps> = ({ challenge, revealRelation = false, sceneRef }) => {
  const targetName = challenge.targetObject.name;
  const referenceName = challenge.referenceObjectName;
  return (
    <div ref={sceneRef} data-pip-object="scene" className="relative mx-auto h-72 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-sky-950/50 via-emerald-950/25 to-slate-950/80 p-4">
      <div className="absolute inset-x-8 top-12 h-px bg-white/10" />
      <div className="absolute inset-x-5 top-32 h-px bg-white/10" />
      <div className="absolute inset-x-2 top-52 h-px bg-white/10" />
      <span className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">Farther away</span>
      {challenge.sceneObjects.map((object) => {
        const nearScale = 0.72 + object.position.row * 0.16;
        const highlighted = revealRelation && (object.name === targetName || object.name === referenceName);
        return (
          <div
            key={`${object.name}-${object.position.row}-${object.position.col}`}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl px-3 py-2 transition-all ${highlighted ? 'ring-4 ring-cyan-300 bg-cyan-300/15 shadow-lg shadow-cyan-400/20' : ''}`}
            style={{
              left: `${18 + object.position.col * 32}%`,
              top: `${24 + object.position.row * 27}%`,
              transform: `translate(-50%, -50%) scale(${nearScale})`,
              zIndex: object.position.row + 1,
            }}
          >
            <span className="text-4xl drop-shadow-lg" role="img" aria-label={object.name}>{object.image}</span>
            <span className="mt-1 rounded-full bg-slate-950/75 px-2 py-0.5 text-xs text-slate-100">{object.name}</span>
          </div>
        );
      })}
      <div className="absolute inset-x-0 bottom-2 flex flex-col items-center text-cyan-200" aria-label="Viewer position">
        <span className="text-xl">↑</span>
        <span className="rounded-full border border-cyan-300/40 bg-cyan-950/80 px-3 py-1 text-xs font-bold tracking-wide">YOU — LOOK THIS WAY</span>
      </div>
    </div>
  );
};

/**
 * `describe_scene` on the workspace: the fixed-viewpoint scene and the ask. The child says the
 * relation and the reference object aloud; the observer judges it. The relation and its model sentence
 * appear only once the answer is credited (contract R16).
 */
const SceneDescriptionStage: React.FC<{
  challenge: SpatialSceneChallenge;
  revealed: boolean;
  onHear: () => void;
  sceneRef?: (element: Element | null) => void;
}> = ({ challenge, revealed, onHear, sceneRef }) => (
  <div className="space-y-4">
    <PerspectiveScene challenge={challenge} revealRelation={revealed} sceneRef={sceneRef} />
    {revealed ? (
      <LuminaPanel accent="cyan">
        <p className="text-center text-sm font-medium text-cyan-100">{challenge.modelDescription ?? modelSpatialDescription(challenge)}</p>
      </LuminaPanel>
    ) : (
      <p className="text-center text-sm text-slate-300">Say the relation and the object you are comparing with.</p>
    )}
    <div className="text-center">
      <button type="button" className="text-xs text-slate-400 underline underline-offset-4" onClick={onHear}>
        Hear the question again
      </button>
    </div>
  </div>
);

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
  /** Reference-frame grid: clear cell borders when true (easy/medium), faded at hard. */
  showGrid?: boolean;
  /** Object name labels under each emoji. Withdrawn at hard. */
  showLabels?: boolean;
  /**
   * CONTAINMENT (`place_in`): a placed object landing on an occupied cell renders
   * INSIDE the object already there instead of replacing it. Off everywhere else, so
   * the relative modes keep one-object-per-cell exactly as before.
   */
  nestPlaced?: boolean;
  /**
   * CONTAINMENT (`place_in`): the container's cell IS the answer, so occupied cells
   * must offer the tap affordance. Every other mode taps empty cells only (contract R11).
   */
  allowOccupiedTaps?: boolean;
  /** Pip only: registers the grid as a shared-surface target. */
  sceneRef?: (element: Element | null) => void;
}

/** What a single grid cell renders: the object standing there, plus anything nested in it. */
interface CellContents {
  base?: SceneObject;
  inside?: SceneObject;
}

const GridScene: React.FC<GridSceneProps> = ({
  gridSize, sceneObjects, placedObjects = [], highlightCell, targetHighlight, onCellClick, interactive,
  showGrid = true, showLabels = true, nestPlaced = false, allowOccupiedTaps = false, sceneRef,
}) => {
  // Build a lookup map of what's in each cell
  const cellMap = useMemo(() => {
    const map: Record<string, CellContents> = {};
    for (const obj of sceneObjects) {
      map[`${obj.position.row}-${obj.position.col}`] = { base: obj };
    }
    for (const p of placedObjects) {
      const key = `${p.row}-${p.col}`;
      const existing = map[key];
      // Nesting only when a container is already there AND the mode asked for it;
      // otherwise keep the historical behavior (the placed object takes the cell).
      map[key] = nestPlaced && existing?.base
        ? { base: existing.base, inside: p.object }
        : { base: p.object };
    }
    return map;
  }, [sceneObjects, placedObjects, nestPlaced]);

  return (
    <div
      ref={sceneRef}
      data-pip-object="scene"
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
        const cell = cellMap[key];
        const obj = cell?.base;
        const inside = cell?.inside;
        const isHighlighted = highlightCell?.row === row && highlightCell?.col === col;
        const isTarget = targetHighlight?.row === row && targetHighlight?.col === col;
        const tappable = interactive && (allowOccupiedTaps || !obj);

        return (
          <button
            key={key}
            type="button"
            data-pip-object={`cell-${row}-${col}`}
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
                ? (showGrid ? 'border-white/15 bg-slate-800/40' : 'border-transparent bg-slate-800/30')
                : (showGrid ? 'border-white/5 bg-slate-900/20' : 'border-transparent bg-transparent')}
              ${tappable ? 'hover:border-white/30 hover:bg-slate-800/30 cursor-pointer' : ''}
              ${!interactive ? 'cursor-default' : ''}
            `}
          >
            {obj && (
              <>
                <span className="relative inline-flex items-center justify-center text-2xl sm:text-3xl leading-none">
                  {obj.image}
                  {/* Containment: the placed object is drawn INSIDE the container,
                      smaller and overlapping, so "in" reads as inside rather than
                      as a second object sharing the square. */}
                  {inside && (
                    <span
                      className="absolute inset-0 flex items-end justify-center pb-0.5"
                      aria-label={`${inside.name} in ${obj.name}`}
                    >
                      <span className="text-sm sm:text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                        {inside.image}
                      </span>
                    </span>
                  )}
                </span>
                {showLabels && (
                  <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 leading-none truncate max-w-full px-1">
                    {inside ? `${inside.name} in ${obj.name}` : obj.name}
                  </span>
                )}
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
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const useWorkspaceProgress = useWorkspaceProgressFor('spatial-scene');

// ============================================================================
// Component
// ============================================================================

function SpatialSceneSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: SpatialSceneProps) {
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

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `spatial-scene-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  /** Handlers the progress hook calls back into, bound after the state they touch is declared. */
  const reopen = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedSpoken = useRef<(index: number) => void>(() => {});

  // ── Challenge Progress: the teaching workspace owns it ─────────────
  const progress = useWorkspaceProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || 'mixed', workspace, assignment: spatialAssignment,
    onItemOpened: (index, retry) => reopen.current(index, retry),
    onSolved: index => solvedSpoken.current(index),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = progress;
  const canAttempt = progress.canAttempt !== false;

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
  /** The item `currentStep` belongs to: the step fact reads 0 for any other, so the reset after an advance adds no revision. */
  const stepOwner = useRef<string | null>(null);


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

  // A fresh item starts clean. Try again clears the rejected choice; a follow-directions
  // retry keeps the steps already placed and asks for the same step again.
  reopen.current = (_index, retry) => {
    if (!retry || currentChallenge?.type !== 'follow_directions') { resetDomainState(); return; }
    setFeedback(''); setFeedbackType('');
  };
  // A spoken description has no check of its own: its credit is the observer's.
  solvedSpoken.current = (index) => {
    const challenge = challenges[index];
    if (challenge?.type !== 'describe_scene') return;
    recordResult({ challengeId: challenge.id, correct: true, attempts: Math.max(1, currentAttempts + 1),
      relation: challenge.correctPosition, referenceObjectName: challenge.referenceObjectName });
  };

  // ── Check Handlers ─────────────────────────────────────────────────

  const handleCheckIdentify = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    incrementAttempts();
    const correct = selectedOption === currentChallenge.correctPosition;

    if (correct) {
      SoundManager.playCorrect();
      const posLabel = POSITION_LABELS[currentChallenge.correctPosition] || currentChallenge.correctPosition;
      setFeedback(`Yes! The ${currentChallenge.targetObject.name} is ${posLabel.toLowerCase()} the ${currentChallenge.referenceObjectName}!`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Look at where the objects are in the scene!');
      setFeedbackType('error');
    }
    return correct;
  }, [currentChallenge, selectedOption, incrementAttempts]);

  /** Cell-judged modes: `place`, `place_in` (container's cell) and `place_between`. */
  const handleCheckPlace = useCallback(() => {
    if (!currentChallenge || !selectedCell) return false;
    incrementAttempts();
    const target = currentChallenge.correctCell;
    const correct = target ? selectedCell.row === target.row && selectedCell.col === target.col : false;

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(
        currentChallenge.type === 'place_in'
          ? `Perfect! The ${currentChallenge.targetObject.name} is in the ${currentChallenge.referenceObjectName}!`
          : currentChallenge.type === 'place_between'
          ? `Perfect! The ${currentChallenge.targetObject.name} is between the ${currentChallenge.referenceObjectName} and the ${currentChallenge.referenceObjectName2}!`
          : `Perfect! You placed it in the right spot!`,
      );
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback(
        currentChallenge.type === 'place_in'
          ? `Not quite. Which thing on the grid could hold it INSIDE?`
          : currentChallenge.type === 'place_between'
          ? `Not quite. Look for the empty square with one object on each side.`
          : `That's not quite the right spot. Read the instruction again carefully!`,
      );
      setFeedbackType('error');
      setSelectedCell(null);
    }
    return correct;
  }, [currentChallenge, selectedCell, incrementAttempts]);

  const handleCheckDescribe = useCallback(() => {
    if (!currentChallenge || !selectedOption) return false;
    incrementAttempts();
    const correct = selectedOption === currentChallenge.correctPosition;

    if (correct) {
      SoundManager.playCorrect();
      const posLabel = POSITION_LABELS[currentChallenge.correctPosition] || currentChallenge.correctPosition;
      setFeedback(`Correct! "${posLabel}" is the right position word!`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Look at the objects and think about their positions.');
      setFeedbackType('error');
    }
    return correct;
  }, [currentChallenge, selectedOption, incrementAttempts]);

  const handlePlaceStep = useCallback((row: number, col: number) => {
    if (!currentChallenge || !currentChallenge.steps) return;
    const step = currentChallenge.steps[currentStep];
    if (!step) return;

    const correct = row === step.correctCell.row && col === step.correctCell.col;
    const response = describeSpatialCheck(currentChallenge, { cell: { row, col }, step: currentStep });

    if (correct) {
      SoundManager.snap();
      setPlacedObjects((prev) => [...prev, { object: step.targetObject, row, col }]);
      setStepsCorrect((prev) => prev + 1);

      if (currentStep < currentChallenge.steps.length - 1) {
        stepOwner.current = currentChallenge.id;
        setCurrentStep((prev) => prev + 1);
        setFeedback(`Step ${currentStep + 1} done!`);
        setFeedbackType('success');
      } else {
        // All steps done
        SoundManager.playCorrect();
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
        progress.commitCheck?.(response, true);
      }
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Read step ${currentStep + 1} again and look at the scene.`);
      setFeedbackType('error');
      incrementAttempts();
      progress.commitCheck?.(response, false);
    }
  }, [currentChallenge, currentStep, stepsCorrect, currentAttempts, incrementAttempts, recordResult]);

  // ── Master Check ───────────────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;

    let correct = false;
    switch (currentChallenge.type) {
      case 'identify': correct = handleCheckIdentify(); break;
      case 'place':
      case 'place_in':
      case 'place_between': correct = handleCheckPlace(); break;
      case 'describe': correct = handleCheckDescribe(); break;
      case 'describe_scene': return; // spoken: the observer judges it
      case 'follow_directions': return; // handled step-by-step
    }
    progress.commitCheck?.(describeSpatialCheck(currentChallenge, { option: selectedOption, cell: selectedCell }), correct);

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
    }
  }, [currentChallenge, currentAttempts, handleCheckIdentify, handleCheckPlace, handleCheckDescribe, recordResult, progress, selectedOption, selectedCell]);

  // ── Advance ────────────────────────────────────────────────────────
  const advanceToNextChallenge = useCallback(() => {
    // The runtime owns progression: `advance()` only reports the last item, so this is the completion path.
    if (!advanceProgress()) {
      if (!hasSubmittedEvaluation && progress.recordsEvaluation !== false) {
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

        // Spoken description beats record every judged attempt; the shared observation capture reads them here.
        const learningResponses = challengeResults.flatMap((r) => (r.learningResponses as LearningResponseEvidence[] | undefined) ?? []);
        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults, ...(learningResponses.length ? { learningResponses } : {}) },
        );
      }
      return;
    }

  }, [
    advanceProgress, phaseResults, challengeResults, challenges,
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
  const isCurrentChallengeDone = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id,
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
      case 'describe_scene': return false;
      case 'place': case 'place_in': case 'place_between': return !!selectedCell;
      case 'follow_directions': return false; // step-by-step
      default: return false;
    }
  }, [currentChallenge, selectedOption, selectedCell]);

  // ── Position hints (easy tier, identify/describe only) ─────────────
  // ANSWER-LEAK GUARD: shows example relations between NON-asked objects so the
  // student can infer the target relation by analogy. NEVER describes the
  // target↔reference relation that is the answer. Only shown when the generator
  // set showPositionHints (easy tier).
  const positionHints = useMemo<string[]>(() => {
    if (!currentChallenge?.showPositionHints) return [];
    if (currentChallenge.type !== 'identify' && currentChallenge.type !== 'describe') return [];

    const objs = currentChallenge.sceneObjects ?? [];
    const targetName = currentChallenge.targetObject?.name;
    const refName = currentChallenge.referenceObjectName;

    // Relation word from a→b grid positions (vertical takes precedence over horizontal).
    const relate = (a: SceneObject, b: SceneObject): PositionWord | null => {
      const dr = a.position.row - b.position.row;
      const dc = a.position.col - b.position.col;
      if (a.position.col === b.position.col && dr !== 0) return dr < 0 ? 'above' : 'below';
      if (a.position.row === b.position.row && dc !== 0) return dc < 0 ? 'left_of' : 'right_of';
      return null;
    };

    const hints: string[] = [];
    for (let i = 0; i < objs.length && hints.length < 2; i++) {
      for (let j = 0; j < objs.length && hints.length < 2; j++) {
        if (i === j) continue;
        const a = objs[i];
        const b = objs[j];
        // GUARD: skip any pair that IS the asked target↔reference relation (either direction).
        const isAskedPair =
          (a.name === targetName && b.name === refName) ||
          (a.name === refName && b.name === targetName);
        if (isAskedPair) continue;
        const rel = relate(a, b);
        if (rel) {
          hints.push(`${a.name} is ${POSITION_LABELS[rel].toLowerCase()} ${b.name}`);
        }
      }
    }
    return hints;
  }, [currentChallenge]);

  // ── Pip shared surface ─────────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the child's last touch; Pip never chooses, checks, or advances. Tutor audio
  // counts only while the tutor is on this block (or its spoken-scene beat).
  const pip = usePipTargets(currentChallenge?.id ?? null, false);
  const [pipTouched, setPipTouched] = useState<{ scopeId: string; element: Element } | null>(null);
  const pipWork = useRef<HTMLDivElement>(null);
  const tutorSpeaking = ctx.isAudioPlaying && !!currentChallenge
    && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId);

  // What the tutor and the observer are shown, republished every render. Item-scoped and derived here,
  // so opening an item adds no revision after the advance. A spoken description is always answerable.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...spatialScene(currentChallenge, { step: stepOwner.current === currentChallenge.id ? currentStep : 0 }), demonstration: [],
      canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
  });
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipTouch = (node: EventTarget) => {
    if (!currentChallenge || isCurrentChallengeCorrect || !(node instanceof Element)) return;
    const element = node.closest('button, [role="button"]') ?? node;
    if (pipWork.current?.contains(element)) setPipTouched({ scopeId: currentChallenge.id, element });
  };
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets: PipTarget[] = pip.targets(['scene'], () => 'The scene');
    const touched = pipTouched?.scopeId === currentChallenge.id && pipTouched.element.isConnected
      && pipWork.current?.contains(pipTouched.element) ? pipTouched.element : null;
    if (touched) targets.push({ id: 'touched', label: 'Your last touch', element: touched });
    const pose = spatialScenePipPose({
      running: true, preparing: false, currentSolved: isCurrentChallengeCorrect, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      visibleIds: targets.map((target) => target.id), hasTouch: !!touched,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Spatial scene',
      dock: pip.dock.current, targets, pose,
    };
  });

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderIdentifyOrDescribe = () => {
    if (!currentChallenge || !currentChallenge.targetObject) return null;
    const opts = currentChallenge.options || ['above', 'below', 'beside', 'next_to'];

    return (
      <div className="space-y-4">
        <GridScene
          sceneRef={pip.ref('scene')}
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          highlightCell={currentChallenge.targetObject.position}
          showGrid={currentChallenge.showGrid ?? true}
          showLabels={currentChallenge.showObjectLabels ?? true}
        />
        {positionHints.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {positionHints.map((h, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-1 rounded-full bg-slate-800/40 border border-white/10 text-slate-400"
              >
                {h}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {opts.map((opt) => {
            const label = POSITION_LABELS[opt as PositionWord] || opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (isCurrentChallengeCorrect || !canAttempt) return;
                  SoundManager.select();
                  setSelectedOption(opt);
                }}
                disabled={isCurrentChallengeCorrect || !canAttempt}
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

  /**
   * The cell-judged modes: `place`, `place_in`, `place_between`.
   *
   * `place_in` is the fork of contract R11 — its answer is the cell the CONTAINER
   * occupies, so occupied cells are tappable and the placed object renders nested
   * inside the container. `place` keeps its original behavior byte-for-byte: empty
   * cells only, highlight-on-correct, no nesting.
   */
  const renderPlace = () => {
    if (!currentChallenge || !currentChallenge.targetObject) return null;
    const isContainment = currentChallenge.type === 'place_in';

    // Show the object actually sitting in its place once the student gets it right.
    // Legacy `place` keeps the highlight-only feedback it shipped with.
    const placed =
      isCurrentChallengeCorrect && currentChallenge.correctCell && currentChallenge.type !== 'place'
        ? [{
            object: currentChallenge.targetObject,
            row: currentChallenge.correctCell.row,
            col: currentChallenge.correctCell.col,
          }]
        : [];

    return (
      <div className="space-y-4">
        <div className="text-center mb-2">
          <span className="text-2xl">{currentChallenge.targetObject.image}</span>
          <span className="text-slate-300 text-sm ml-2">{currentChallenge.targetObject.name}</span>
          <p className="text-slate-500 text-xs mt-1">
            {isContainment ? 'Tap what it goes inside' : 'Tap a cell to place it'}
          </p>
        </div>
        <GridScene
          sceneRef={pip.ref('scene')}
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          placedObjects={placed}
          nestPlaced={isContainment}
          allowOccupiedTaps={isContainment}
          highlightCell={selectedCell}
          targetHighlight={isCurrentChallengeCorrect ? currentChallenge.correctCell : undefined}
          showGrid /* place: cells are the tap surface — keep the frame, only labels withdraw */
          showLabels={currentChallenge.showObjectLabels ?? true}
          onCellClick={(row, col) => {
            if (isCurrentChallengeCorrect || !canAttempt) return;
            // Containment: the container's own cell IS the answer, so an occupied cell
            // must be selectable. Every other mode places into an empty cell (R11).
            const occupied = currentChallenge.sceneObjects.some(
              (o) => o.position.row === row && o.position.col === col,
            );
            if (occupied && !isContainment) return;
            SoundManager.tap();
            setSelectedCell({ row, col });
          }}
          interactive={!isCurrentChallengeCorrect && canAttempt}
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
          sceneRef={pip.ref('scene')}
          gridSize={gridSize}
          sceneObjects={currentChallenge.sceneObjects}
          placedObjects={placedObjects}
          showGrid /* follow_directions: cells are the tap surface — keep the frame */
          showLabels={currentChallenge.showObjectLabels ?? true}
          onCellClick={(row, col) => {
            if (allStepsDone || !canAttempt) return;
            const occupied = currentChallenge.sceneObjects.some(
              (o) => o.position.row === row && o.position.col === col,
            ) || placedObjects.some((p) => p.row === row && p.col === col);
            if (!occupied) handlePlaceStep(row, col);
          }}
          interactive={!allStepsDone && canAttempt}
        />
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            {challenges.length > 0 && (
              <LuminaBadge accent="blue" className="text-xs">
                {currentChallengeIndex + 1}/{challenges.length}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
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

            {/* Pip's dock sits between the instruction and the scene: the scene
                is outlined as a region, so no connector crosses a word button. */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

            <div ref={pipWork} className="space-y-4"
              onPointerDownCapture={(event) => pipTouch(event.target)} onFocusCapture={(event) => pipTouch(event.target)}>
            {(currentChallenge.type === 'identify' || currentChallenge.type === 'describe') && renderIdentifyOrDescribe()}
            {currentChallenge.type === 'describe_scene' && (
              <SceneDescriptionStage
                key={currentChallenge.id}
                challenge={currentChallenge}
                revealed={isCurrentChallengeCorrect}
                sceneRef={pip.ref('scene')}
                onHear={() => ctx.sendText(hearSceneQuestionRequest(currentChallenge), { silent: true, author: 'host' })}
              />
            )}
            {CELL_JUDGED_TYPES.has(currentChallenge.type) && renderPlace()}
            {currentChallenge.type === 'follow_directions' && renderFollowDirections()}
            </div>

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

            {/* The lab's own Check; the runtime advances. */}
            {currentChallenge.type !== 'follow_directions' && currentChallenge.type !== 'describe_scene' && !isCurrentChallengeCorrect && (
              <div className="flex items-center justify-center gap-3">
                <LuminaActionButton action="check" onClick={handleCheckAnswer} disabled={!canCheck || !canAttempt} />
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {challenges.length === 0 && (
          <div className="text-center py-8">
            <span className="text-4xl">🗺️</span>
            <p className="text-slate-400 mt-2">No challenges loaded</p>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SpatialScene = withWorkspaceOnly<SpatialSceneProps>('spatial-scene', SpatialSceneSurface, props => props.data.title);

export default SpatialScene;
