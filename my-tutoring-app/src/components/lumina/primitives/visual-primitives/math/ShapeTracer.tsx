'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeTracerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { shapeTracerPipPose } from '../../../pip/shapeTracerPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, checkShapeProperties, describeShapeWork, freeTrace, gridDots as generateGridDots,
  nextTraceCorner, shapeTracerMiss, tierGuides, traceAccepts, workspaceAssignment, workspaceScene, type ShapeTracerView,
} from './shapeTracerWorkspace';
import {
  BARS_LEVER, FADE_LEVER, OUTLINE_LEVER, RINGS_LEVER, STRIP_LEVER, cornerRings, guidesWith, leverFacts, practiceItem,
  shapeTracerLevers, sideBars,
} from './shapeTracerLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeTracerChallenge {
  id: string;
  type: 'trace' | 'complete' | 'draw-from-description' | 'connect-dots';
  instruction: string;
  targetShape: string;
  // trace
  tracePath?: Array<{ x: number; y: number }>;
  tolerance?: number;
  // complete
  drawnSides?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  remainingVertices?: Array<{ x: number; y: number }>;
  // draw-from-description
  description?: string;
  requiredProperties?: {
    sides?: number;
    corners?: number;
    allSidesEqual?: boolean;
    hasCurvedSides?: boolean;
  };
  // connect-dots
  dots?: Array<{ x: number; y: number; label?: string }>;
  correctOrder?: number[];
  revealShape?: string;

  // ── Support-tier scaffolds (within-mode, set by the generator from
  //    config.difficulty). Display-only — they withdraw tracing help without
  //    changing the target shape, its vertices, or the eval mode. Undefined =
  //    no tier applied → all scaffolds default ON (legacy behavior). ──────────
  /** Ghost outline of the full target shape (the dotted guide path). */
  showGuidePath?: boolean;
  /** Animated directional ant-trail on the guide path. */
  showDirectionArrows?: boolean;
  /** Pulsing "next vertex / start here" cue ring. */
  showNextCue?: boolean;
  /** Stroke-order numbers (1,2,3…) on trace/complete vertices. */
  showOrderNumbers?: boolean;
  /** The support tier this challenge was generated at (for the tutor). */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface ShapeTracerData {
  title: string;
  description?: string;
  challenges: ShapeTracerChallenge[];
  gridSize: number;
  showPropertyReminder: boolean;
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeTracerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  trace: { label: 'Trace', icon: '✏️', accentColor: 'blue' },
  complete: { label: 'Complete', icon: '🧩', accentColor: 'purple' },
  'draw-from-description': { label: 'Draw', icon: '🎨', accentColor: 'emerald' },
  'connect-dots': { label: 'Connect', icon: '🔗', accentColor: 'orange' },
};

const DOT_RADIUS = 16;
const GRID_DOT_RADIUS = 6;

const SHAPE_FILL: Record<string, string> = {
  triangle: 'rgba(59, 130, 246, 0.15)',
  square: 'rgba(168, 85, 247, 0.15)',
  rectangle: 'rgba(34, 197, 94, 0.15)',
  circle: 'rgba(234, 179, 8, 0.15)',
  hexagon: 'rgba(236, 72, 153, 0.15)',
  pentagon: 'rgba(6, 182, 212, 0.15)',
  rhombus: 'rgba(249, 115, 22, 0.15)',
};

const SHAPE_STROKE: Record<string, string> = {
  triangle: 'rgba(59, 130, 246, 0.6)',
  square: 'rgba(168, 85, 247, 0.6)',
  rectangle: 'rgba(34, 197, 94, 0.6)',
  circle: 'rgba(234, 179, 8, 0.6)',
  hexagon: 'rgba(236, 72, 153, 0.6)',
  pentagon: 'rgba(6, 182, 212, 0.6)',
  rhombus: 'rgba(249, 115, 22, 0.6)',
};

// ============================================================================
// Props
// ============================================================================

interface ShapeTracerProps {
  data: ShapeTracerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const ShapeTracerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ShapeTracerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ShapeTracerChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    gridSize = 50,
    showPropertyReminder = true,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── State ─────────────────────────────────────────────────────────

  const [tappedIndices, setTappedIndices] = useState<number[]>([]);
  const [selectedGridPoints, setSelectedGridPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [shapeComplete, setShapeComplete] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [revealedShape, setRevealedShape] = useState('');
  /** The last tap was refused (not the next corner, or a grid dot already used); the tutor is told. */
  const [refusedTap, setRefusedTap] = useState(false);
  // Levers (`shapeTracerLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ShapeTracerChallenge | null>(null);

  // ── Challenge Progress. On the workspace path the runtime moves the index. ──

  const stableInstanceIdRef = useRef(instanceId || `shape-tracer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
    onFinished: result => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    results: challengeResults,
    isComplete: allChallengesComplete,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  // The activity's own check is the workspace's checked gesture. A ref, so the tap callbacks keep their deps.
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  const gridDots = useMemo(() => generateGridDots(gridSize), [gridSize]);
  /** The tracing help on the canvas: what the challenge's tier left on, plus the guide levers pulled on it. */
  const guides = currentChallenge ? guidesWith(currentChallenge, practice ? [] : pulledLevers) : tierGuides({} as ShapeTracerChallenge);
  const freeStart = !!currentChallenge && freeTrace(currentChallenge);

  // ── Computed ──────────────────────────────────────────────────────

  const sidesCompleted = useMemo(() => {
    if (!currentChallenge) return 0;
    switch (currentChallenge.type) {
      case 'trace':
        return Math.max(0, tappedIndices.length - 1);
      case 'complete':
        return (currentChallenge.drawnSides?.length ?? 0) + Math.max(0, tappedIndices.length - 1);
      case 'draw-from-description':
        return Math.max(0, selectedGridPoints.length - 1);
      case 'connect-dots':
        return Math.max(0, tappedIndices.length - 1);
      default:
        return 0;
    }
  }, [currentChallenge, tappedIndices, selectedGridPoints]);

  const totalSides = useMemo(() => {
    if (!currentChallenge) return 0;
    switch (currentChallenge.type) {
      case 'trace':
        return currentChallenge.tracePath?.length ?? 0;
      case 'complete':
        return (currentChallenge.drawnSides?.length ?? 0) + (currentChallenge.remainingVertices?.length ?? 0);
      case 'draw-from-description':
        return currentChallenge.requiredProperties?.sides ?? 0;
      case 'connect-dots':
        return currentChallenge.dots?.length ?? 0;
      default:
        return 0;
    }
  }, [currentChallenge]);

  // A practice item records nothing in the session's results; its own finished shape is what says it is done.
  const isCurrentChallengeComplete = practice ? shapeComplete : challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct,
  );

  const canUndo = !isCurrentChallengeComplete && !allChallengesComplete && (
    currentChallenge?.type === 'draw-from-description'
      ? selectedGridPoints.length > 0
      : tappedIndices.length > 0
  );

  /** The learner's work as the domain module reads it (describe, miss, scene). */
  const view: ShapeTracerView = {
    tapped: tappedIndices, points: selectedGridPoints, refused: refusedTap, complete: shapeComplete,
    guides, propertyReminder: showPropertyReminder,
  };

  // ── Evaluation Hook ───────────────────────────────────────────────

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeTracerMetrics>({
    primitiveType: 'shape-tracer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring Integration ───────────────────────────────────────

  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'trace',
    targetShape: currentChallenge?.targetShape ?? '',
    description: currentChallenge?.description ?? '',
    requiredProperties: currentChallenge?.requiredProperties ?? {},
    sidesCompleted,
    totalSides,
    attemptNumber: progress.currentAttempts + 1,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    instruction: currentChallenge?.instruction ?? '',
    supportTier: currentChallenge?.supportTier,
  }), [
    currentChallenge, sidesCompleted, totalSides, progress.currentAttempts,
    gradeBand, challenges.length, currentChallengeIndex,
  ]);

  /**
   * Tier-aware tutor reveal level. Keeps the tutor from re-supplying the
   * tracing help the canvas withdrew at a harder tier.
   * easy → walk the stroke; medium → nudge progress; hard → do NOT narrate
   * the stroke path, encourage from memory of the shape.
   */
  const tutorRevealClause = useCallback((tier?: 'easy' | 'medium' | 'hard') => {
    if (tier === 'hard') {
      return ` [REVEAL: hard tier — the guide path, arrows, and order numbers are HIDDEN. `
        + `Do NOT narrate the stroke path or name which dot/side comes next. `
        + `Ask what the student remembers about the shape and let them choose their own path.]`;
    }
    if (tier === 'medium') {
      return ` [REVEAL: medium tier — the guide outline is hidden but a faint next cue remains. `
        + `Nudge progress and confirm the count of sides; don't trace the whole path for them.]`;
    }
    if (tier === 'easy') {
      return ` [REVEAL: easy tier — full guide path is visible. `
        + `You may walk the student dot-by-dot along the outline.]`;
    }
    return '';
  }, []);

  // Its context carries the dot order and the hidden shape, so it is off on the workspace path, and its scripted
  // cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'shape-tracer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Pip shared surface ────────────────────────────────────────────
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the dot the child last tapped; Pip never taps, draws, checks, or advances.
  // Tutor audio counts only while the tutor is on this block and began on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, !isCurrentChallengeComplete && !allChallengesComplete && !hasSubmittedEvaluation);
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = pip.targets();
    const pose = shapeTracerPipPose({
      running: true, preparing: false, currentSolved: isCurrentChallengeComplete, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Shape drawing canvas',
      dock: pip.dock.current, targets, pose,
    };
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Shape Tracer activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering shape construction. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}, shape: ${currentChallenge?.targetShape}). `
      + `Introduce warmly: "Let's learn to draw shapes! We'll trace, complete, and even draw shapes from descriptions."`
      + tutorRevealClause(currentChallenge?.supportTier),
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText, tutorRevealClause, tutorOwned]);

  // ── Reset ─────────────────────────────────────────────────────────

  const resetDomainState = useCallback(() => {
    pip.clear();
    setTappedIndices([]);
    setSelectedGridPoints([]);
    setShapeComplete(false);
    setFeedback('');
    setFeedbackType('');
    setRevealedShape('');
    setRefusedTap(false);
  }, [pip.clear]); // eslint-disable-line react-hooks/exhaustive-deps
  // A fresh challenge starts empty, and the return from a practice item ends it. Try again (only after a checked
  // miss) keeps a connect-dots item's joined dots, which were all right, and clears a drawing's corners; on a practice
  // item it keeps the practice item.
  openItem.current = (retry) => {
    if (!retry) { setPractice(null); resetDomainState(); return; }
    setFeedback(''); setFeedbackType(''); setRefusedTap(false);
    if (currentChallenge?.type === 'draw-from-description') setSelectedGridPoints([]);
  };

  /** The finished shape: the activity's check on its last correct tap. */
  const creditShape = useCallback((ch: ShapeTracerChallenge, work: ShapeTracerView) => {
    commitCheck.current(describeShapeWork(ch, work), true);
  }, []);

  // ── Interaction Handlers ──────────────────────────────────────────

  const handleTraceTap = useCallback((vertexIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete || learnerBlocked()) return;
    const path = currentChallenge?.tracePath;
    if (!path) return;

    if (!traceAccepts(path.length, tappedIndices, vertexIndex, freeStart)) {
      SoundManager.invalid();
      setFeedback(freeStart ? 'Tap the corner right next to your last one!' : 'Try tapping the next dot in order!');
      setFeedbackType('error');
      setRefusedTap(true);
      return;
    }

    const newTapped = [...tappedIndices, vertexIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');
    setRefusedTap(false);

    const isComplete = newTapped.length === path.length;
    if (!isComplete) SoundManager.tap();

    const sideNum = newTapped.length - 1;
    if (sideNum > 0 && sideNum < path.length) {
      sendText(
        `[SIDE_COMPLETE] Student completed side ${sideNum} of ${path.length} for ${currentChallenge?.targetShape}. `
        + `Encourage: "Side ${sideNum} done! ${path.length - sideNum} more to go!"`,
        { silent: true },
      );
    }

    if (isComplete) {
      SoundManager.playCorrect();
      setShapeComplete(true);
      setFeedback(`You traced the ${currentChallenge?.targetShape}!`);
      setFeedbackType('success');
      creditShape(currentChallenge!, { ...view, tapped: newTapped, refused: false, complete: true });
      sendText(
        `[ANSWER_CORRECT] Student traced a ${currentChallenge?.targetShape} with ${path.length} sides! `
        + `Celebrate: "You drew a perfect ${currentChallenge?.targetShape}! Look at all ${path.length} sides!"`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, freeStart, sendText, creditShape]);

  const handleCompleteTap = useCallback((vertexIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete || learnerBlocked()) return;
    const remaining = currentChallenge?.remainingVertices;
    if (!remaining) return;

    if (vertexIndex !== tappedIndices.length) {
      SoundManager.invalid();
      setFeedback('Tap the next dot to add the next side!');
      setFeedbackType('error');
      setRefusedTap(true);
      return;
    }

    const newTapped = [...tappedIndices, vertexIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');
    setRefusedTap(false);

    const isComplete = newTapped.length === remaining.length;
    if (!isComplete) SoundManager.tap();

    const drawnCount = currentChallenge?.drawnSides?.length ?? 0;
    const sideNum = drawnCount + newTapped.length;
    const totalShapeSides = drawnCount + remaining.length;

    if (newTapped.length > 0) {
      sendText(
        `[SIDE_COMPLETE] Student drew side ${sideNum} of ${totalShapeSides} for ${currentChallenge?.targetShape}. `
        + `${totalShapeSides - sideNum} sides remaining.`,
        { silent: true },
      );
    }

    if (isComplete) {
      SoundManager.playCorrect();
      setShapeComplete(true);
      setFeedback(`You completed the ${currentChallenge?.targetShape}!`);
      setFeedbackType('success');
      creditShape(currentChallenge!, { ...view, tapped: newTapped, refused: false, complete: true });
      sendText(
        `[ANSWER_CORRECT] Student completed a ${currentChallenge?.targetShape}! `
        + `They drew the missing ${remaining.length} side(s). Celebrate!`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, sendText, creditShape]);

  const handleGridDotClick = useCallback((dot: { x: number; y: number }) => {
    if (hasSubmittedEvaluation || shapeComplete || learnerBlocked()) return;
    if (selectedGridPoints.some(p => p.x === dot.x && p.y === dot.y)) {
      SoundManager.invalid();
      setFeedback('You already placed a corner there!');
      setFeedbackType('error');
      setRefusedTap(true);
      return;
    }
    SoundManager.tap();
    setSelectedGridPoints(prev => [...prev, dot]);
    setFeedback('');
    setFeedbackType('');
    setRefusedTap(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmittedEvaluation, shapeComplete, selectedGridPoints]);

  const handleConnectDotTap = useCallback((dotIndex: number) => {
    if (hasSubmittedEvaluation || shapeComplete || learnerBlocked()) return;
    const dots = currentChallenge?.dots;
    const order = currentChallenge?.correctOrder;
    if (!dots || !order || !currentChallenge) return;

    const expectedDot = order[tappedIndices.length];
    if (dotIndex !== expectedDot) {
      // A dot out of order is this mode's checked wrong answer (it always counted as an attempt).
      SoundManager.invalid();
      setFeedback('Try finding the next number in order!');
      setFeedbackType('error');
      commitCheck.current(describeShapeWork(currentChallenge, view, dotIndex), false,
        shapeTracerMiss(currentChallenge, { tapped: tappedIndices, points: [], wrongDot: dotIndex }));
      sendText(
        `[WRONG_DOT] Student tapped dot ${dotIndex} but should tap dot ${expectedDot} (step ${tappedIndices.length + 1}). `
        + `Hint: "Look for the number ${tappedIndices.length + 1}. Which dot is next?"`,
        { silent: true },
      );
      return;
    }

    const newTapped = [...tappedIndices, dotIndex];
    setTappedIndices(newTapped);
    setFeedback('');
    setFeedbackType('');

    const isComplete = newTapped.length === order.length;
    if (!isComplete) SoundManager.tap();

    if (isComplete) {
      SoundManager.playCorrect();
      setShapeComplete(true);
      const shapeName = currentChallenge.revealShape || currentChallenge.targetShape || 'shape';
      setRevealedShape(shapeName);
      setFeedback(`It's a ${shapeName}!`);
      setFeedbackType('success');
      creditShape(currentChallenge, { ...view, tapped: newTapped, complete: true });
      sendText(
        `[ANSWER_CORRECT] Student connected all ${order.length} dots and revealed a ${shapeName}! `
        + `Ask: "What shape did you make? How many sides does it have?"`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmittedEvaluation, shapeComplete, currentChallenge, tappedIndices, sendText, creditShape]);

  const handleUndo = useCallback(() => {
    if (learnerBlocked()) return;
    if (currentChallenge?.type === 'draw-from-description') {
      setSelectedGridPoints(prev => prev.slice(0, -1));
    } else {
      setTappedIndices(prev => prev.slice(0, -1));
    }
    setFeedback('');
    setFeedbackType('');
    setRefusedTap(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.type]);

  const handleCheckShape = useCallback(() => {
    if (learnerBlocked()) return;
    if (!currentChallenge || currentChallenge.type !== 'draw-from-description') return;
    if (selectedGridPoints.length < 3) {
      SoundManager.invalid();
      setFeedback('You need at least 3 corners to make a shape!');
      setFeedbackType('error');
      return;
    }

    const required = currentChallenge.requiredProperties;
    const result = required ? checkShapeProperties(selectedGridPoints, required) : { correct: true, feedback: '' };
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    const work = { ...view, refused: false };
    if (result.correct) {
      SoundManager.playCorrect();
      setShapeComplete(true);
      setFeedback(required ? `Great job! You drew a ${currentChallenge.targetShape}!` : `Nice ${currentChallenge.targetShape}!`);
      setFeedbackType('success');
      commitCheck.current(describeShapeWork(currentChallenge, work), true);
      if (required) sendText(
        `[ANSWER_CORRECT] Student drew a ${currentChallenge.targetShape} from description: "${currentChallenge.description}". `
        + `Their shape has ${selectedGridPoints.length} sides. Celebrate!`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback(result.feedback);
      setFeedbackType('error');
      commitCheck.current(describeShapeWork(currentChallenge, work), false,
        shapeTracerMiss(currentChallenge, { tapped: [], points: selectedGridPoints }));
      sendText(
        `[ANSWER_INCORRECT] Student's shape doesn't match. ${result.feedback} `
        + `Required: ${JSON.stringify(required)}. Student drew ${selectedGridPoints.length} vertices. `
        + `Give a gentle hint.`,
        { silent: true },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, selectedGridPoints, sendText]);

  // ── Challenge Navigation ──────────────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All challenges done
      const phaseScoreStr = phaseResults
        .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter(r => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging feedback about their shape-drawing skills!`,
        { silent: true },
      );

      // The workspace path submits the scored session from `onFinished` (below), not this tally.
      if (!hasSubmittedEvaluation && !tutorOwned) {
        const correct = challengeResults.filter(r => r.correct).length;
        const accuracy = Math.round((correct / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);

        const metrics: ShapeTracerMetrics = {
          type: 'shape-tracer',
          tracingAccuracy: accuracy,
          shapesCompleted: correct,
          totalShapes: challenges.length,
          attemptsCount: totalAttempts,
        };

        submitEvaluation(correct === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain-specific state
    resetDomainState();

    const nextChallenge = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}: `
      + `"${nextChallenge.instruction}" (type: ${nextChallenge.type}, shape: ${nextChallenge.targetShape}). `
      + `Read the instruction and encourage the student.`
      + tutorRevealClause(nextChallenge.supportTier),
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText, tutorOwned,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex, tutorRevealClause, resetDomainState,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss (`diagnosisEvidence.phases`).
  finish.current = (result) => {
    if (hasSubmittedEvaluation) return;
    const metrics: ShapeTracerMetrics = {
      type: 'shape-tracer',
      tracingAccuracy: result.accuracy,
      shapesCompleted: result.solvedCount,
      totalShapes: challenges.length,
      attemptsCount: result.attemptsCount,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Auto-submit when all complete
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // Workspace path: what the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view);
    // Levers belong to the session item; a practice item offers none. A guide the tier already shows is pulled.
    const levers = practice ? [] : shapeTracerLevers(sessionChallenge, pulledLevers);
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item, not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === FADE_LEVER && !tappedIndices.length) return 'No dot is joined yet, so nothing would change; pull it once a dot is joined.';
        if (id === BARS_LEVER && selectedGridPoints.length < 2) return 'The bars show the learner’s own sides, and there are none yet; pull it once two corners are placed.';
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge);
          if (!easier) return 'This item has no easier one; try a help lever.';
          setLeverState(pulled); resetDomainState(); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetDomainState(); setPractice(null); },
    };
  });

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    const correct = challengeResults.filter(r => r.correct).length;
    return Math.round((correct / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Render Helpers ────────────────────────────────────────────────

  const shapeFill = SHAPE_FILL[currentChallenge?.targetShape ?? ''] || 'rgba(99, 102, 241, 0.15)';
  const shapeStroke = SHAPE_STROKE[currentChallenge?.targetShape ?? ''] || 'rgba(99, 102, 241, 0.6)';

  // ---- Trace Canvas ----
  const renderTraceCanvas = () => {
    const path = currentChallenge?.tracePath;
    if (!path || path.length === 0) return null;

    // Support-tier scaffolds (`tierGuides`): undefined = ON (legacy / no tier applied).
    const { guidePath: showGuidePath, arrows: showDirectionArrows, nextCue: showNextCue, orderNumbers: showOrderNumbers } = guides;
    const nextCorner = nextTraceCorner(path.length, tappedIndices, freeStart);

    return (
      <>
        {/* Dotted outline of full shape (guide path). When complete, show the
            fill regardless of tier so the finished shape always renders. */}
        {(showGuidePath || shapeComplete) && (
          <polygon
            points={path.map(p => `${p.x},${p.y}`).join(' ')}
            fill={shapeComplete ? shapeFill : 'none'}
            stroke={shapeComplete ? 'rgba(255,255,255,0.15)' : showGuidePath ? 'rgba(255,255,255,0.15)' : 'none'}
            strokeWidth={2}
            strokeDasharray="8 6"
            className={shapeComplete ? 'transition-all duration-500' : ''}
          />
        )}

        {/* Animated ant-trail on dotted lines (directional flow) */}
        {showDirectionArrows && !shapeComplete && (
          <polygon
            points={path.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth={2}
            strokeDasharray="4 12"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-16"
              dur="1s"
              repeatCount="indefinite"
            />
          </polygon>
        )}

        {/* Solid lines between tapped vertices */}
        {tappedIndices.length > 1 && tappedIndices.map((vertIdx, i) => {
          if (i === 0) return null;
          const from = path[tappedIndices[i - 1]];
          const to = path[vertIdx];
          return (
            <line
              key={`side-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {/* Closing line when shape is complete: from the last corner tapped back to the first */}
        {shapeComplete && path.length > 2 && tappedIndices.length === path.length && (
          <line
            x1={path[tappedIndices[path.length - 1]].x} y1={path[tappedIndices[path.length - 1]].y}
            x2={path[tappedIndices[0]].x} y2={path[tappedIndices[0]].y}
            stroke={shapeStroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Vertex dots (tap targets) */}
        {path.map((point, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = idx === nextCorner;

          return (
            <g key={`v-${idx}`} ref={pip.ref(`vertex-${idx}`)} data-pip-object={`vertex-${idx}`} className="cursor-pointer"
              onClick={() => { pip.look(`vertex-${idx}`); handleTraceTap(idx); }}>
              {/* Pulsing ring for next vertex (next/start cue) */}
              {showNextCue && isNext && !shapeComplete && (
                <circle
                  cx={point.x} cy={point.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={point.x} cy={point.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(59, 130, 246, 0.7)' : (isNext && showNextCue) ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
                className="transition-colors duration-200"
              />

              {/* Stroke-order number */}
              {showOrderNumbers && (
                <text
                  x={point.x} y={point.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={12} fontWeight="bold"
                  fill={isTapped ? '#93c5fd' : isNext ? '#93c5fd' : '#94a3b8'}
                  className="pointer-events-none select-none"
                >
                  {idx + 1}
                </text>
              )}

              {isTapped && (
                <text
                  x={point.x + DOT_RADIUS - 2} y={point.y - DOT_RADIUS + 2}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={10}
                  className="pointer-events-none select-none"
                  fill="#4ade80"
                >
                  {'✓'}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  };

  // ---- Complete Canvas ----
  const renderCompleteCanvas = () => {
    const drawnSides = currentChallenge?.drawnSides ?? [];
    const remaining = currentChallenge?.remainingVertices ?? [];

    // Support-tier scaffolds: undefined = ON (legacy / no tier applied).
    const showNextCue = guides.nextCue;

    // Build all vertices for polygon fill when complete
    const allVerts: Array<{ x: number; y: number }> = [];
    for (const side of drawnSides) {
      if (
        allVerts.length === 0 ||
        allVerts[allVerts.length - 1].x !== side.from.x ||
        allVerts[allVerts.length - 1].y !== side.from.y
      ) {
        allVerts.push(side.from);
      }
      allVerts.push(side.to);
    }
    for (const v of remaining) allVerts.push(v);

    return (
      <>
        {/* Fill when complete */}
        {shapeComplete && allVerts.length >= 3 && (
          <polygon
            points={allVerts.map(p => `${p.x},${p.y}`).join(' ')}
            fill={shapeFill} stroke="none"
            className="transition-all duration-500"
          />
        )}

        {/* The dotted_outline lever: the whole shape's dashed outline, through the open corners too */}
        {leverOn(OUTLINE_LEVER) && !shapeComplete && allVerts.length >= 3 && (
          <polygon
            data-lever={OUTLINE_LEVER}
            points={allVerts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeDasharray="8 6"
          />
        )}

        {/* Pre-drawn sides */}
        {drawnSides.map((side, i) => (
          <line
            key={`drawn-${i}`}
            x1={side.from.x} y1={side.from.y} x2={side.to.x} y2={side.to.y}
            stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeLinecap="round"
          />
        ))}

        {/* Student-drawn sides */}
        {tappedIndices.map((vertIdx, i) => {
          let from: { x: number; y: number };
          if (i === 0) {
            const lastSide = drawnSides[drawnSides.length - 1];
            from = lastSide ? lastSide.to : remaining[0];
          } else {
            from = remaining[tappedIndices[i - 1]];
          }
          const to = remaining[vertIdx];
          return (
            <line
              key={`stu-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Closing line when complete */}
        {shapeComplete && remaining.length > 0 && drawnSides.length > 0 && (
          <line
            x1={remaining[remaining.length - 1].x} y1={remaining[remaining.length - 1].y}
            x2={drawnSides[0].from.x} y2={drawnSides[0].from.y}
            stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
          />
        )}

        {/* Drawn-side vertex dots */}
        {drawnSides.map((side, i) => (
          <React.Fragment key={`dv-${i}`}>
            <circle cx={side.from.x} cy={side.from.y} r={5} fill="rgba(255,255,255,0.3)" />
            {i === drawnSides.length - 1 && (
              <circle cx={side.to.x} cy={side.to.y} r={5} fill="rgba(255,255,255,0.3)" />
            )}
          </React.Fragment>
        ))}

        {/* Remaining vertex dots */}
        {remaining.map((point, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = idx === tappedIndices.length;
          return (
            <g key={`rem-${idx}`} ref={pip.ref(`remaining-${idx}`)} data-pip-object={`remaining-${idx}`} className="cursor-pointer"
              onClick={() => { pip.look(`remaining-${idx}`); handleCompleteTap(idx); }}>
              {showNextCue && isNext && !shapeComplete && (
                <circle
                  cx={point.x} cy={point.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(168, 85, 247, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={point.x} cy={point.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(168, 85, 247, 0.7)' : (isNext && showNextCue) ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
              />

              {!isTapped && (
                <circle cx={point.x} cy={point.y} r={4} fill={(isNext && showNextCue) ? 'rgba(168, 85, 247, 0.7)' : 'rgba(255,255,255,0.4)'} />
              )}
              {isTapped && (
                <text
                  x={point.x} y={point.y}
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={10} fill="#c084fc"
                  className="pointer-events-none select-none"
                >
                  {'✓'}
                </text>
              )}
            </g>
          );
        })}
      </>
    );
  };

  // ---- Draw-from-description Canvas ----
  const renderDrawCanvas = () => {
    // Support-tier scaffolds: undefined = ON (legacy / no tier applied).
    // Vertex order labels withdraw at hard; the dashed preview-closing line
    // withdraws at medium/hard (mapped to showGuidePath = easy-only).
    const showOrderNumbers = guides.orderNumbers;
    const showPreviewLine = guides.guidePath;

    return (
      <>
        {/* Grid dots */}
        {gridDots.map((dot, idx) => {
          const isSelected = selectedGridPoints.some(p => p.x === dot.x && p.y === dot.y);
          return (
            <circle
              key={`g-${idx}`}
              ref={pip.ref(`grid-${idx}`)}
              data-pip-object={`grid-${idx}`}
              cx={dot.x} cy={dot.y}
              r={isSelected ? GRID_DOT_RADIUS + 4 : GRID_DOT_RADIUS}
              fill={isSelected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.08)'}
              stroke={isSelected ? 'rgba(34, 197, 94, 0.7)' : 'none'}
              strokeWidth={isSelected ? 2 : 0}
              className="cursor-pointer transition-all duration-150"
              onClick={() => { pip.look(`grid-${idx}`); handleGridDotClick(dot); }}
            />
          );
        })}

        {/* Lines between selected points */}
        {selectedGridPoints.length > 1 && selectedGridPoints.map((point, i) => {
          if (i === 0) return null;
          const prev = selectedGridPoints[i - 1];
          return (
            <line
              key={`ln-${i}`}
              x1={prev.x} y1={prev.y} x2={point.x} y2={point.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Preview closing line (dashed) — withdrawn at medium/hard */}
        {showPreviewLine && selectedGridPoints.length >= 3 && !shapeComplete && (
          <line
            x1={selectedGridPoints[selectedGridPoints.length - 1].x}
            y1={selectedGridPoints[selectedGridPoints.length - 1].y}
            x2={selectedGridPoints[0].x}
            y2={selectedGridPoints[0].y}
            stroke="rgba(34, 197, 94, 0.2)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}

        {/* Closed shape fill when complete */}
        {shapeComplete && selectedGridPoints.length >= 3 && (
          <>
            <line
              x1={selectedGridPoints[selectedGridPoints.length - 1].x}
              y1={selectedGridPoints[selectedGridPoints.length - 1].y}
              x2={selectedGridPoints[0].x}
              y2={selectedGridPoints[0].y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
            <polygon
              points={selectedGridPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill={shapeFill} stroke="none"
            />
          </>
        )}

        {/* Vertex order labels — withdrawn at hard */}
        {showOrderNumbers && selectedGridPoints.map((point, i) => (
          <text
            key={`lbl-${i}`}
            x={point.x} y={point.y - GRID_DOT_RADIUS - 8}
            textAnchor="middle"
            fontSize={11} fontWeight="bold"
            fill="#86efac"
            className="pointer-events-none select-none"
          >
            {i + 1}
          </text>
        ))}
      </>
    );
  };

  // ---- Connect-dots Canvas ----
  const renderConnectDotsCanvas = () => {
    const dots = currentChallenge?.dots ?? [];
    const order = currentChallenge?.correctOrder ?? [];

    // Support-tier scaffold: the pulsing next-dot cue. The dot NUMBERS are the
    // puzzle's answer, so they always render (never withdrawn by tier).
    const showNextCue = guides.nextCue;

    return (
      <>
        {/* Fill when complete */}
        {shapeComplete && tappedIndices.length >= 3 && (
          <polygon
            points={tappedIndices.map(i => `${dots[i].x},${dots[i].y}`).join(' ')}
            fill={shapeFill} stroke="none"
            className="transition-all duration-500"
          />
        )}

        {/* Lines between connected dots */}
        {tappedIndices.length > 1 && tappedIndices.map((dotIdx, i) => {
          if (i === 0) return null;
          const from = dots[tappedIndices[i - 1]];
          const to = dots[dotIdx];
          return (
            <line
              key={`con-${i}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
            />
          );
        })}

        {/* Closing line */}
        {shapeComplete && tappedIndices.length >= 3 && (
          <line
            x1={dots[tappedIndices[tappedIndices.length - 1]].x}
            y1={dots[tappedIndices[tappedIndices.length - 1]].y}
            x2={dots[tappedIndices[0]].x}
            y2={dots[tappedIndices[0]].y}
            stroke={shapeStroke} strokeWidth={3} strokeLinecap="round"
          />
        )}

        {/* Dot tap targets */}
        {dots.map((dot, idx) => {
          const isTapped = tappedIndices.includes(idx);
          const isNext = order[tappedIndices.length] === idx;
          // The fade_joined lever: a joined dot becomes a green tick, so it stops looking like a dot to tap.
          if (isTapped && leverOn(FADE_LEVER) && !shapeComplete) {
            return (
              <g key={`d-${idx}`} ref={pip.ref(`dot-${idx}`)} data-pip-object={`dot-${idx}`} className="cursor-pointer"
                onClick={() => { pip.look(`dot-${idx}`); handleConnectDotTap(idx); }}>
                <circle cx={dot.x} cy={dot.y} r={DOT_RADIUS} fill="rgba(34, 197, 94, 0.12)" stroke="rgba(34, 197, 94, 0.5)" strokeWidth={2} />
                <text x={dot.x} y={dot.y} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#4ade80"
                  className="pointer-events-none select-none">{'✓'}</text>
              </g>
            );
          }

          return (
            <g key={`d-${idx}`} ref={pip.ref(`dot-${idx}`)} data-pip-object={`dot-${idx}`} className="cursor-pointer"
              onClick={() => { pip.look(`dot-${idx}`); handleConnectDotTap(idx); }}>
              {showNextCue && isNext && !shapeComplete && (
                <circle
                  cx={dot.x} cy={dot.y} r={DOT_RADIUS + 6}
                  fill="none" stroke="rgba(249, 115, 22, 0.4)" strokeWidth={2}
                >
                  <animate attributeName="r" values={`${DOT_RADIUS + 4};${DOT_RADIUS + 10};${DOT_RADIUS + 4}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={dot.x} cy={dot.y} r={DOT_RADIUS}
                fill={isTapped ? 'rgba(249, 115, 22, 0.3)' : 'rgba(255,255,255,0.08)'}
                stroke={isTapped ? 'rgba(249, 115, 22, 0.7)' : (isNext && showNextCue) ? 'rgba(249, 115, 22, 0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={2}
              />

              <text
                x={dot.x} y={dot.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={12} fontWeight="bold"
                fill={isTapped ? '#fdba74' : '#94a3b8'}
                className="pointer-events-none select-none"
              >
                {dot.label || String(idx + 1)}
              </text>
            </g>
          );
        })}

        {/* Revealed shape name */}
        {revealedShape && (
          <text
            x={CANVAS_WIDTH / 2} y={30}
            textAnchor="middle"
            fontSize={20} fontWeight="bold"
            fill="#fdba74"
            className="select-none"
          >
            {`It's a ${revealedShape}!`}
          </text>
        )}
      </>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge className="text-xs">Practice</LuminaBadge>}
            <LuminaBadge accent="blue" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            {/* The shape's name: never on draw-from-description (the clue's properties are the task), and on
                connect-dots only once the joined dots reveal it. */}
            {currentChallenge && currentChallenge.type !== 'draw-from-description'
              && (currentChallenge.type !== 'connect-dots' || revealedShape) && (
              <LuminaBadge accent="purple" className="text-xs">
                {currentChallenge.targetShape}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Challenge Type Badges */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => {
              if (!challenges.some(c => c.type === type)) return null;
              return (
                <LuminaBadge
                  key={type}
                  className={`text-xs ${
                    currentChallenge?.type === type
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                  }`}
                >
                  {config.icon} {config.label}
                </LuminaBadge>
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
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Property Reminder */}
        {showPropertyReminder && currentChallenge?.requiredProperties && !shapeComplete && (
          <div className="flex items-center gap-3 bg-slate-800/20 rounded-lg px-3 py-2 border border-white/5">
            <span className="text-slate-500 text-xs uppercase tracking-wider">Needs:</span>
            <div className="flex gap-2 flex-wrap">
              {currentChallenge.requiredProperties.sides !== undefined && (
                <LuminaBadge className="bg-emerald-500/10 border-emerald-400/30 text-emerald-300 text-xs">
                  {currentChallenge.requiredProperties.sides} sides
                </LuminaBadge>
              )}
              {currentChallenge.requiredProperties.corners !== undefined && (
                <LuminaBadge className="bg-blue-500/10 border-blue-400/30 text-blue-300 text-xs">
                  {currentChallenge.requiredProperties.corners} corners
                </LuminaBadge>
              )}
              {currentChallenge.requiredProperties.allSidesEqual && (
                <LuminaBadge className="bg-purple-500/10 border-purple-400/30 text-purple-300 text-xs">
                  All sides equal
                </LuminaBadge>
              )}
            </div>
          </div>
        )}

        {/* The number_strip lever: the dots' numbers in counting order, a tick on each one joined. Marks no dot. */}
        {currentChallenge?.type === 'connect-dots' && leverOn(STRIP_LEVER) && !shapeComplete && (
          <div data-lever={STRIP_LEVER} aria-label="Number strip" className="flex justify-center gap-1.5 flex-wrap">
            {(currentChallenge.correctOrder ?? []).map((dotIdx, i) => {
              const joined = i < tappedIndices.length;
              return (
                <span key={`strip-${i}`} className={`min-w-8 rounded-md border px-2 py-1 text-center text-sm font-bold ${
                  joined ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-slate-800/40 text-slate-300'}`}>
                  {currentChallenge.dots?.[dotIdx]?.label ?? String(dotIdx + 1)}{joined ? ' ✓' : ''}
                </span>
              );
            })}
          </div>
        )}

        {/* Drawing Canvas */}
        <div className="flex justify-center">
          <svg
            ref={pip.ref('canvas')}
            data-pip-object="canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="max-w-full h-auto rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {/* Border */}
            <rect
              x={1} y={1}
              width={CANVAS_WIDTH - 2} height={CANVAS_HEIGHT - 2}
              rx={12} ry={12}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5}
            />

            {/* Background dot grid (for non draw-from-description modes) */}
            {currentChallenge?.type !== 'draw-from-description' && (
              Array.from(
                { length: Math.floor((CANVAS_WIDTH - 80) / gridSize) + 1 },
                (_, i) => Array.from(
                  { length: Math.floor((CANVAS_HEIGHT - 80) / gridSize) + 1 },
                  (_, j) => (
                    <circle
                      key={`bg-${i}-${j}`}
                      cx={40 + i * gridSize}
                      cy={40 + j * gridSize}
                      r={1.5}
                      fill="rgba(255,255,255,0.05)"
                    />
                  ),
                )
              )
            )}

            {/* Mode-specific rendering */}
            {currentChallenge?.type === 'trace' && renderTraceCanvas()}
            {currentChallenge?.type === 'complete' && renderCompleteCanvas()}
            {currentChallenge?.type === 'draw-from-description' && renderDrawCanvas()}
            {currentChallenge?.type === 'connect-dots' && renderConnectDotsCanvas()}
          </svg>
        </div>

        {/* Pip's dock sits under the canvas, away from the Undo / Check buttons. */}
        {pipStore && !allChallengesComplete && (
          <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
            className="mx-auto flex min-h-28 w-full max-w-[500px] items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
        )}

        {/* Side Counter */}
        {currentChallenge && !allChallengesComplete && totalSides > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {Array.from({ length: totalSides }, (_, i) => (
              <div
                key={`sc-${i}`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  i < sidesCompleted
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : 'bg-slate-800/30 text-slate-500 border border-white/5'
                }`}
              >
                Side {i + 1} {i < sidesCompleted ? '✓' : ''}
              </div>
            ))}
          </div>
        )}

        {/* The corner_rings lever: one ring per corner the clue asks for, filled by the learner's corners; extras in red */}
        {currentChallenge?.type === 'draw-from-description' && leverOn(RINGS_LEVER) && (() => {
          const { rings, filled, extra } = cornerRings(currentChallenge, selectedGridPoints.length);
          return (
            <div data-lever={RINGS_LEVER} aria-label="Corner rings" className="flex items-center justify-center gap-2">
              {Array.from({ length: rings }, (_, i) => (
                <span key={`ring-${i}`} className={`h-5 w-5 rounded-full border-2 ${i < filled ? 'border-emerald-300 bg-emerald-400/60' : 'border-emerald-300/50'}`} />
              ))}
              {Array.from({ length: extra }, (_, i) => (
                <span key={`extra-${i}`} className="h-5 w-5 rounded-full border-2 border-red-400 bg-red-500/50" />
              ))}
            </div>
          );
        })()}

        {/* The side_bars lever: one bar per side of the learner's own shape, as long as the side */}
        {currentChallenge?.type === 'draw-from-description' && leverOn(BARS_LEVER) && selectedGridPoints.length >= 2 && (() => {
          const bars = sideBars(selectedGridPoints), longest = Math.max(...bars, 1);
          return (
            <div data-lever={BARS_LEVER} aria-label="Side bars" className="mx-auto flex w-full max-w-[320px] flex-col gap-1">
              {bars.map((len, i) => (
                <div key={`bar-${i}`} className="h-2.5 rounded-full bg-sky-400/70" style={{ width: `${Math.round((len / longest) * 100)}%` }} />
              ))}
            </div>
          );
        })()}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {canUndo && !(tutorOwned && progress.canAttempt === false) && (
              <LuminaButton tone="subtle" onClick={handleUndo}>
                Undo
              </LuminaButton>
            )}

            {currentChallenge?.type === 'draw-from-description' && !isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckShape}
                disabled={selectedGridPoints.length < 3 || (tutorOwned && progress.canAttempt === false)}
              >
                Check Shape
              </LuminaActionButton>
            )}

            {!tutorOwned && isCurrentChallengeComplete && !allChallengesComplete && (
              <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                Next Challenge
              </LuminaActionButton>
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
            heading="Shape Tracer Complete!"
            celebrationMessage={`You completed all ${challenges.length} shape challenges!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path keeps the runtime's progression: no Next button, no scripted cue, no legacy AI context.
const ShapeTracer = withWorkspaceController<ShapeTracerProps, ProgressOptions<ShapeTracerChallenge>, Progress>(
  'shape-tracer', ShapeTracerSurface, useScriptedProgress, useWorkspaceProgressFor('shape-tracer'));

export default ShapeTracer;
