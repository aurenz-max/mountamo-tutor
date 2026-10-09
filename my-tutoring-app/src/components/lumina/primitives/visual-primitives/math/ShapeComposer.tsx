'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaInput,
  interactive,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ShapeComposerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { shapeComposerPipPose } from '../../../pip/shapeComposerPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import { magnetTo, freeSpot, recipeText, type RecipePart } from './shapeComposerBuild';
import {
  decomposeChoices, describeShapeWork, shapeComposerMatches, shapeComposerMiss, SHAPE_MISS_WORDS,
  fittedPieceIds, filledSlotIds, workspaceAssignment, workspaceScene, type ShapeView,
} from './shapeComposerWorkspace';
import {
  EMPTY_SPACE_LEVER, EMPTY_SPOTS_LEVER, IN_PLACE_LEVER, JOIN_MARKS_LEVER, LIST_MATCH_LEVER, PARTS_MODEL_LEVER,
  PIECES_MODEL_LEVER, SPLIT_LINES_LEVER, joinStates, leverFacts, listMatch, partsModelFor, piecesModelFor,
  shapeComposerLevers, simplerShape, type PartsModel, type PiecesModel,
} from './shapeComposerLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ShapeComposerPiece {
  id: string;
  shape: 'triangle' | 'square' | 'rectangle' | 'circle' | 'hexagon' | 'trapezoid' | 'rhombus' | 'semicircle';
  color: string;
  width: number;
  height: number;
  initialRotation?: number;
  targetX?: number;
  targetY?: number;
  targetRotation?: number;
}

export interface ShapeComposerComponent {
  shape: string;
  count: number;
}

export interface ShapeComposerChallenge {
  id: string;
  type: 'compose-match' | 'compose-picture' | 'decompose' | 'free-create' | 'how-many-ways';
  instruction: string;
  // compose-match
  targetShape?: string;
  targetOutlinePath?: string; // SVG path for the silhouette
  pieces?: ShapeComposerPiece[];
  // compose-picture
  targetPicture?: string;
  targetDescription?: string;
  availableShapes?: Array<{ shape: string; color: string; count: number }>;
  pictureSlots?: Array<{ id: string; shape: string; x: number; y: number; width: number; height: number; rotation: number }>;
  // decompose
  compositeShapePath?: string; // SVG path for the composite shape
  compositeDescription?: string;
  expectedComponents?: ShapeComposerComponent[];
  divisionLineHints?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  // free-create (open build): the shapes to compose from, stated in the ask. Absent on older payloads, which keep
  // the old any-two-shapes check.
  recipe?: RecipePart[];
  // how-many-ways
  targetForComposition?: string;
  allowedPieces?: string[];
  minimumPiecesNeeded?: number;
  validSolutionCount?: number;
  // shared
  hint?: string;
  // within-mode support tier (scaffolding level set by the generator)
  supportTier?: 'easy' | 'medium' | 'hard';
  /** Show decomposition seams: compose-match piece-target outlines +
   *  decompose division lines. The seam IS the answer → easy only. */
  showSeams?: boolean;
  /** Show snap/slot guides: compose-picture slot outlines + compose-match
   *  snap halos. Easy + medium; withdrawn at hard. */
  showSnapGuides?: boolean;
}

export interface ShapeComposerData {
  title: string;
  description?: string;
  challenges: ShapeComposerChallenge[];
  snapTolerance?: number;
  rotationSnap?: number;
  gradeBand?: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ShapeComposerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'compose-match':   { label: 'Compose Match',   icon: '🧩', accentColor: 'purple' },
  'compose-picture': { label: 'Compose Picture', icon: '🎨', accentColor: 'blue' },
  'decompose':       { label: 'Decompose',       icon: '✂️', accentColor: 'emerald' },
  'free-create':     { label: 'Free Create',     icon: '✨', accentColor: 'amber' },
  'how-many-ways':   { label: 'How Many Ways',   icon: '🔢', accentColor: 'orange' },
};

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 350;
const SNAP_DISTANCE = 50;

/** The open-build palette: every shape the grade band knows, so choosing the asked ones is part of the task. */
const BUILD_PALETTE: Record<'K' | '1', string[]> = {
  K: ['triangle', 'square', 'rectangle', 'circle'],
  '1': ['triangle', 'square', 'rectangle', 'circle', 'hexagon', 'trapezoid', 'rhombus'],
};

// Shape colors for the palette
const SHAPE_COLORS: Record<string, string> = {
  triangle: '#8B5CF6',
  square: '#3B82F6',
  rectangle: '#10B981',
  circle: '#F59E0B',
  hexagon: '#EC4899',
  trapezoid: '#6366F1',
  rhombus: '#14B8A6',
  semicircle: '#F97316',
};

// ============================================================================
// Shape SVG Renderers
// ============================================================================

function getShapePath(shape: string, w: number, h: number): string {
  switch (shape) {
    case 'triangle':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'square':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'rectangle':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'hexagon': {
      const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + rx * Math.cos(a)} ${cy + ry * Math.sin(a)}`;
      });
      return `M ${pts.join(' L ')} Z`;
    }
    case 'trapezoid':
      return `M ${w * 0.2} 0 L ${w * 0.8} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'rhombus':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
    case 'circle':
      return ''; // handled separately with <ellipse>
    case 'semicircle':
      return `M 0 ${h} A ${w / 2} ${h} 0 0 1 ${w} ${h} L 0 ${h} Z`;
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }
}

interface PlacedShape {
  id: string;
  shape: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ShapeSVGProps {
  shape: string;
  color: string;
  width: number;
  height: number;
  rotation?: number;
  x?: number;
  y?: number;
  opacity?: number;
  className?: string;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  strokeColor?: string;
  strokeWidth?: number;
  showLabel?: boolean;
  pipRef?: (element: Element | null) => void;
  pipObject?: string;
  /** A lever's ring on the piece (`data-lever-mark`), dashed when given. */
  mark?: string;
  dash?: string;
}

const ShapeSVG: React.FC<ShapeSVGProps> = ({
  shape, color, width, height, rotation = 0, x = 0, y = 0,
  opacity = 1, className = '', onClick, onPointerDown,
  strokeColor = 'rgba(255,255,255,0.3)', strokeWidth = 1.5, showLabel = false, pipRef, pipObject, mark, dash,
}) => {
  const transform = `translate(${x}, ${y}) rotate(${rotation}, ${width / 2}, ${height / 2})`;

  return (
    <g ref={pipRef} data-pip-object={pipObject} data-shape={shape} data-lever-mark={mark} transform={transform} className={className} onClick={onClick} onPointerDown={onPointerDown}
       style={{ cursor: onClick || onPointerDown ? 'pointer' : 'default' }}>
      {shape === 'circle' ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2}
                 fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={dash} opacity={opacity} />
      ) : (
        <path d={getShapePath(shape, width, height)}
              fill={color} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={dash} opacity={opacity} />
      )}
      {showLabel && (
        <text x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={10} fontWeight="bold" pointerEvents="none">
          {shape}
        </text>
      )}
    </g>
  );
};

// ============================================================================
// Lever pictures (`shapeComposerLevers.ts`). Each is drawn only while its lever is pulled, outside the item.
// ============================================================================

const PART_TINTS = ['rgba(56,189,248,0.45)', 'rgba(244,114,182,0.45)', 'rgba(250,204,21,0.45)'];

/** parts_model: another big shape split into its parts, each tinted and tagged with its shape (read aloud). */
function PartsModelPicture({ model }: { model: PartsModel }) {
  return (
    <div data-lever="parts-model" className="mx-auto flex max-w-xs flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <svg viewBox="0 0 160 100" className="w-40" aria-hidden>
        {model.parts.map((d, i) => (
          <path key={i} d={d} fill={PART_TINTS[i % PART_TINTS.length]} stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="mt-1 flex gap-3 text-xs text-slate-300">
        {model.parts.map((_, i) => (
          <span key={i} className="rounded px-1.5" style={{ backgroundColor: PART_TINTS[i % PART_TINTS.length] }}>{model.part}</span>
        ))}
      </div>
    </div>
  );
}

/** pieces_model: another shape built from squares, each square outlined. No number is written. */
function PiecesModelPicture({ model }: { model: PiecesModel }) {
  return (
    <div data-lever="pieces-model" className="mx-auto flex max-w-xs justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <svg viewBox="0 0 160 100" className="w-40" aria-hidden>
        {model.squares.map(([x, y, w], i) => (
          <rect key={i} x={x} y={y} width={w} height={w} fill="rgba(59,130,246,0.35)" stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface ShapeComposerProps {
  data: ShapeComposerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const ShapeComposerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ShapeComposerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ShapeComposerChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
    snapTolerance = SNAP_DISTANCE,
    rotationSnap = 45,
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `shape-composer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge Progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls it only after render. */
  const openItem = useRef<(retry: boolean) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => openItem.current(retry),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  // Levers (`shapeComposerLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place. The tier's seams and snap guides are starting positions, not levers.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<ShapeComposerChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  const [placedShapes, setPlacedShapes] = useState<PlacedShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [decomposeTaps, setDecomposeTaps] = useState<string[]>([]);
  const [freeCreateShapes, setFreeCreateShapes] = useState<PlacedShape[]>([]);
  const [howManyAnswer, setHowManyAnswer] = useState('');

  const canvasRef = useRef<SVGSVGElement>(null);
  const placedCountRef = useRef(0);

  // A fresh challenge starts clean. Try again keeps the pieces on the board (the learner fixes their own build) and
  // clears the taps and the typed number, which are one answer each.
  const clearWork = () => {
    setPlacedShapes([]);
    setFreeCreateShapes([]);
    setSelectedShapeId(null);
    setDecomposeTaps([]);
    setHowManyAnswer('');
    setDragging(null);
    setFeedback('');
    setFeedbackType('');
    placedCountRef.current = 0;
  };
  // Try again on a practice item keeps it; only a fresh item (or the return from practice) ends it.
  openItem.current = (retry) => {
    if (!retry) {
      setPractice(null);
      setPlacedShapes([]);
      setFreeCreateShapes([]);
      setSelectedShapeId(null);
      placedCountRef.current = 0;
    }
    setDecomposeTaps([]);
    setHowManyAnswer('');
    setDragging(null);
    setFeedback('');
    setFeedbackType('');
  };

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<ShapeComposerMetrics>({
    primitiveType: 'shape-composer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (scripted path only)
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'compose-match',
    instruction: currentChallenge?.instruction ?? '',
    targetShape: currentChallenge?.targetShape ?? currentChallenge?.targetPicture
      ?? (currentChallenge?.recipe ? recipeText(currentChallenge.recipe) : ''),
    piecesPlaced: placedShapes.length,
    totalPieces: currentChallenge?.pieces?.length ?? currentChallenge?.pictureSlots?.length ?? 0,
    expectedComponents: currentChallenge?.expectedComponents ?? [],
    attemptNumber: currentAttempts + 1,
    supportTier: currentChallenge?.supportTier ?? null,
    seamsShown: currentChallenge?.showSeams !== false,
  }), [
    gradeBand, challenges.length, currentChallengeIndex, currentChallenge,
    placedShapes.length, currentAttempts,
  ]);

  // Tier-aware reveal policy — at hard the seams (the decomposition answer) are
  // hidden on screen, so the tutor must NOT name which pieces go where; it asks
  // how the target could be split instead. Never reveals the composition.
  const tutorRevealClause = (): string => {
    const tier = currentChallenge?.supportTier;
    if (tier === 'hard')
      return ' SUPPORT TIER hard: the decomposition seams are hidden — do NOT name which pieces go where or how the shape splits; instead ask the student how the target could be broken into smaller shapes. Never reveal the composition.';
    if (tier === 'medium')
      return ' SUPPORT TIER medium: seams are hidden but snap guides remain — nudge placement, do not spell out the full decomposition.';
    if (tier === 'easy')
      return ' SUPPORT TIER easy: the seams are visible — you may point the student to the on-screen guide lines to self-check.';
    return '';
  };

  // Its context and cues carry the answers, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'shape-composer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Shape Composer for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges. First: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Let's build shapes together! We'll use smaller shapes to make bigger ones."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // The learner's work, as the check and the tutor read it
  // -------------------------------------------------------------------------
  const isFreeCreate = currentChallenge?.type === 'free-create';
  const isOpenBuild = isFreeCreate && !!currentChallenge?.recipe?.length;
  const view = (): ShapeView => ({
    placed: isFreeCreate ? freeCreateShapes : placedShapes,
    taps: decomposeTaps, answer: howManyAnswer, snapTolerance,
  });

  // -------------------------------------------------------------------------
  // Drag & Drop Handlers
  // -------------------------------------------------------------------------
  // Pointer -> canvas units through the svg's own screen matrix. The canvas is letterboxed (max height on a wider
  // box), so scaling by the element's width put a dragged piece away from the finger on wide screens.
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = canvasRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const at = toCanvas(e.clientX, e.clientY);
    if (!at) return;
    const x = at.x - dragging.offsetX;
    const y = at.y - dragging.offsetY;

    const setter = isFreeCreate ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.map(s =>
      s.id === dragging.id ? { ...s, x: Math.max(0, Math.min(CANVAS_WIDTH - s.width, x)), y: Math.max(0, Math.min(CANVAS_HEIGHT - s.height, y)) } : s
    ));
  }, [dragging, isFreeCreate, toCanvas]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!dragging) return;
    // Open build: a piece dropped close to another slides over until they touch, so a K hand can make edges meet.
    if (isOpenBuild) {
      setFreeCreateShapes(prev => {
        const moved = prev.find(s => s.id === dragging.id);
        if (!moved) return prev;
        const to = magnetTo(moved, prev.filter(s => s.id !== moved.id));
        if (to) SoundManager.snap();
        return to ? prev.map(s => (s.id === moved.id ? { ...s, ...to } : s)) : prev;
      });
    }
    // Tactile snap feedback (sound only — the state updaters below do the actual snapping)
    const draggedNow = placedShapes.find(s => s.id === dragging.id);
    if (draggedNow) {
      if (currentChallenge?.type === 'compose-match' && currentChallenge.pieces) {
        const willSnap = currentChallenge.pieces.some(p =>
          p.shape === draggedNow.shape && p.targetX !== undefined && p.targetY !== undefined &&
          Math.hypot(draggedNow.x - p.targetX!, draggedNow.y - p.targetY!) < snapTolerance
        );
        if (willSnap) SoundManager.snap();
      } else if (currentChallenge?.type === 'compose-picture' && currentChallenge.pictureSlots) {
        const willSnap = currentChallenge.pictureSlots.some(slot =>
          slot.shape === draggedNow.shape &&
          Math.hypot(draggedNow.x - slot.x, draggedNow.y - slot.y) < snapTolerance
        );
        if (willSnap) SoundManager.snap();
      }
    }
    // Check snap-to-fit for compose-match — match by shape type, not ID
    if (currentChallenge?.type === 'compose-match' && currentChallenge.pieces) {
      setPlacedShapes(prev => {
        const draggedShape = prev.find(s => s.id === dragging.id);
        if (!draggedShape) return prev;
        // Find targets of the same shape type that aren't already occupied by another piece
        const occupiedTargets = new Set(
          prev.filter(s => s.id !== dragging.id).map(s => {
            const t = currentChallenge.pieces!.find(p =>
              p.shape === s.shape && p.targetX !== undefined && p.targetY !== undefined &&
              Math.abs(s.x - p.targetX!) < 5 && Math.abs(s.y - p.targetY!) < 5
            );
            return t ? t.id : null;
          }).filter(Boolean)
        );
        // Find the nearest unoccupied same-shape target
        let bestTarget: ShapeComposerPiece | null = null;
        let bestDist = Infinity;
        for (const p of currentChallenge.pieces!) {
          if (p.targetX === undefined || p.targetY === undefined) continue;
          if (p.shape !== draggedShape.shape) continue;
          if (occupiedTargets.has(p.id)) continue;
          const dx = draggedShape.x - p.targetX;
          const dy = draggedShape.y - p.targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < snapTolerance && dist < bestDist) {
            bestDist = dist;
            bestTarget = p;
          }
        }
        if (bestTarget) {
          return prev.map(s =>
            s.id === dragging.id
              ? { ...s, x: bestTarget!.targetX!, y: bestTarget!.targetY!, rotation: bestTarget!.targetRotation ?? s.rotation }
              : s
          );
        }
        return prev;
      });
    }
    // Check snap for compose-picture
    if (currentChallenge?.type === 'compose-picture' && currentChallenge.pictureSlots) {
      setPlacedShapes(prev => prev.map(s => {
        if (s.id !== dragging.id) return s;
        const matchingSlot = currentChallenge.pictureSlots!.find(slot =>
          slot.shape === s.shape &&
          !prev.some(other => other.id !== s.id && Math.abs(other.x - slot.x) < 5 && Math.abs(other.y - slot.y) < 5)
        );
        if (matchingSlot) {
          const dx = s.x - matchingSlot.x;
          const dy = s.y - matchingSlot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < snapTolerance) {
            return { ...s, x: matchingSlot.x, y: matchingSlot.y, width: matchingSlot.width, height: matchingSlot.height, rotation: matchingSlot.rotation };
          }
        }
        return s;
      }));
    }
    setDragging(null);
  }, [dragging, currentChallenge, snapTolerance, placedShapes, isOpenBuild]);

  const handleShapeMouseDown = useCallback((id: string, e: React.PointerEvent) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    e.preventDefault();
    const allShapes = isFreeCreate ? freeCreateShapes : placedShapes;
    const shape = allShapes.find(s => s.id === id);
    const at = shape && toCanvas(e.clientX, e.clientY);
    if (!shape || !at) return;
    setDragging({ id, offsetX: at.x - shape.x, offsetY: at.y - shape.y });
    setSelectedShapeId(id);
  }, [hasSubmittedEvaluation, placedShapes, freeCreateShapes, isFreeCreate, toCanvas]);

  // -------------------------------------------------------------------------
  // Palette: Add shape to canvas
  // -------------------------------------------------------------------------
  const addShapeFromPalette = useCallback((shape: string, color: string, w: number, h: number) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    SoundManager.pop();
    placedCountRef.current += 1;
    const newShape: PlacedShape = {
      id: `placed-${Date.now()}-${placedCountRef.current}`,
      shape,
      color,
      x: CANVAS_WIDTH / 2 - w / 2,
      y: CANVAS_HEIGHT / 2 - h / 2,
      width: w,
      height: h,
      rotation: 0,
    };
    if (currentChallenge?.type === 'free-create') {
      // A new piece lands in open space, never on top of the learner's work.
      setFreeCreateShapes(prev => [...prev, { ...newShape, ...freeSpot(newShape, prev, CANVAS_WIDTH, CANVAS_HEIGHT) }]);
    } else {
      setPlacedShapes(prev => [...prev, newShape]);
    }
  }, [hasSubmittedEvaluation, currentChallenge?.type]);

  // Add piece from compose-match/compose-picture piece list
  const addPieceToCanvas = useCallback((piece: ShapeComposerPiece) => {
    if (hasSubmittedEvaluation || learnerBlocked()) return;
    if (placedShapes.some(s => s.id === piece.id)) return; // already placed
    SoundManager.pop();
    const newShape: PlacedShape = {
      id: piece.id,
      shape: piece.shape,
      color: piece.color || SHAPE_COLORS[piece.shape] || '#8B5CF6',
      x: 20 + Math.random() * 60,
      y: CANVAS_HEIGHT / 2 - piece.height / 2,
      width: piece.width,
      height: piece.height,
      rotation: piece.initialRotation ?? 0,
    };
    setPlacedShapes(prev => [...prev, newShape]);
  }, [hasSubmittedEvaluation, placedShapes]);

  // -------------------------------------------------------------------------
  // Rotate selected shape
  // -------------------------------------------------------------------------
  const rotateSelected = useCallback((degrees: number) => {
    if (!selectedShapeId || hasSubmittedEvaluation || learnerBlocked()) return;
    const setter = currentChallenge?.type === 'free-create' ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.map(s =>
      s.id === selectedShapeId ? { ...s, rotation: (s.rotation + degrees) % 360 } : s
    ));
  }, [selectedShapeId, hasSubmittedEvaluation, currentChallenge?.type]);

  // Remove selected shape from canvas
  const removeSelected = useCallback(() => {
    if (!selectedShapeId || hasSubmittedEvaluation || learnerBlocked()) return;
    const setter = currentChallenge?.type === 'free-create' ? setFreeCreateShapes : setPlacedShapes;
    setter(prev => prev.filter(s => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  }, [selectedShapeId, hasSubmittedEvaluation, currentChallenge?.type]);

  // -------------------------------------------------------------------------
  // Decompose: tap to identify regions
  // -------------------------------------------------------------------------
  const handleDecomposeTap = useCallback((componentShape: string) => {
    if (hasSubmittedEvaluation || learnerBlocked() || !currentChallenge || currentChallenge.type !== 'decompose') return;
    SoundManager.select();
    setDecomposeTaps(prev => [...prev, componentShape]);
  }, [hasSubmittedEvaluation, currentChallenge]);

  // -------------------------------------------------------------------------
  // Check Answer: the activity's own check, committed as the workspace's checked gesture
  // (the attempt counted on both paths).
  // -------------------------------------------------------------------------
  const handleCheckAnswer = () => {
    if (!currentChallenge || learnerBlocked()) return;
    const work = view();
    const correct = shapeComposerMatches(currentChallenge, work);
    const miss = correct ? undefined : shapeComposerMiss(currentChallenge, work);
    const piecesUsed = work.placed.length;

    if (correct && !practice) {
      // The primitive's own field; the commit merges the verdict and attempts into it. A practice item records nothing.
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1, piecesUsed });
    }
    progress.commitCheck(describeShapeWork(currentChallenge, work), correct, miss);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(currentChallenge.type === 'free-create'
        ? (currentChallenge.recipe?.length ? 'You made one big shape from the shapes on the list! 🎉' : 'Amazing creation! 🎉')
        : 'Correct! Great job! 🎉');
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student completed ${currentChallenge.type} challenge correctly. `
        + `${currentChallenge.type === 'compose-match' ? `They built ${currentChallenge.targetShape} from ${placedShapes.length} pieces.` : ''}`
        + `${currentChallenge.type === 'decompose' ? `They identified the components: ${decomposeTaps.join(', ')}.` : ''}`
        + `${currentChallenge.type === 'free-create' ? `They composed their own picture from ${freeCreateShapes.map(s => s.shape).join(', ')}, every shape touching.` : ''}`
        + ` Congratulate briefly and use spatial vocabulary.`,
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      // The miss words name the problem; a generated hint can name the answer ("two triangles make a square").
      setFeedback(miss ? SHAPE_MISS_WORDS[miss] : 'Try again! Look at the shapes carefully.');
      setFeedbackType('error');
      const buildMiss = currentChallenge.type === 'free-create' && miss && miss !== 'too_few_shapes' ? miss : null;
      sendText(
        `[ANSWER_INCORRECT] ${currentChallenge.type} challenge. Attempt ${currentAttempts + 1}. `
        + `${currentChallenge.type === 'compose-match' ? `${placedShapes.length}/${(currentChallenge.pieces ?? []).length} pieces placed.` : ''}`
        + `${currentChallenge.type === 'decompose' ? `Student identified: ${decomposeTaps.join(', ')}. Expected: ${(currentChallenge.expectedComponents ?? []).map(c => `${c.count} ${c.shape}`).join(', ')}.` : ''}`
        + `${buildMiss ? `The board checked their picture: ${SHAPE_MISS_WORDS[buildMiss]} Their picture stays on the board to fix.` : ''}`
        + ` Give a spatial hint without revealing the answer.`
        + tutorRevealClause(),
        { silent: true }
      );
    }
  };

  // -------------------------------------------------------------------------
  // Submit evaluation when all complete (both paths). The live host has no evaluation provider; a workspace
  // family submits only under one.
  // -------------------------------------------------------------------------
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || submittedRef.current) return;
    if (progress.recordsEvaluation === false) return;
    submittedRef.current = true;

    const phaseScoreStr = phaseResults
      .map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`)
      .join(', ');
    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const accuracy = challenges.length > 0
      ? Math.round((correctCount / challenges.length) * 100) : 0;
    const totalPiecesUsed = challengeResults.reduce((s, r) => s + ((r.piecesUsed as number) || 0), 0);

    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${accuracy}%. `
      + `Give encouraging phase-specific feedback about their shape composition skills!`,
      { silent: true }
    );

    const metrics: ShapeComposerMetrics = {
      type: 'shape-composer',
      evalMode: challenges[0]?.type ?? 'default',
      accuracy,
      challengesCorrect: correctCount,
      challengesTotal: challenges.length,
      totalPiecesUsed,
      totalAttempts,
      compositionAccuracy: accuracy,
      spatialReasoningScore: accuracy,
    };

    submitEvaluation(
      correctCount === challenges.length,
      accuracy,
      metrics,
      { challengeResults }
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, progress.recordsEvaluation, phaseResults, challengeResults,
      challenges, submitEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Advance to next challenge (scripted path; the workspace path hides Next and the runtime advances)
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) return;

    // Reset domain-specific state
    setPlacedShapes([]);
    setDecomposeTaps([]);
    setFreeCreateShapes([]);
    setHowManyAnswer('');
    setSelectedShapeId(null);
    setFeedback('');
    setFeedbackType('');
    placedCountRef.current = 0;

    const nextChallenge = challenges[currentChallengeIndex + 1];
    if (nextChallenge) {
      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${nextChallenge.type}. Instruction: "${nextChallenge.instruction}". Introduce it briefly.`,
        { silent: true }
      );
    }
  }, [advanceProgress, challenges, currentChallengeIndex, sendText]);

  // -------------------------------------------------------------------------
  // Last result for "next" flow
  // -------------------------------------------------------------------------
  const lastResult = challengeResults.find(r => r.challengeId === currentChallenge?.id);
  const showingCorrectFeedback = !!lastResult?.correct;

  // Workspace path: what the tutor and the observer are shown, republished every render. W1: no demonstration,
  // no presentation, no levers.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view());
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : shapeComposerLevers(sessionChallenge, pulledLevers);
    const onBoard = (isFreeCreate ? freeCreateShapes : placedShapes).length;
    workspace.current = {
      ...scene,
      facts: {
        ...scene.facts,
        ...(leverOn(SPLIT_LINES_LEVER) ? { splitLines: 'shown: dashed lines inside it' } : {}),
        ...(onScreen ? { onScreen } : {}),
      },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if ([IN_PLACE_LEVER, LIST_MATCH_LEVER, JOIN_MARKS_LEVER].includes(id) && onBoard === 0) {
          return 'No shape is on the board yet: the learner adds shapes from the palette first.';
        }
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerShape(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); clearWork(); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearWork(); setPractice(null); },
    };
  });

  // -------------------------------------------------------------------------
  // Pip shared surface
  // -------------------------------------------------------------------------
  // A projection of this challenge's check state, the tutor's speech on it, and
  // the piece the child last moved; Pip never moves, places, checks, or advances.
  // Tutor audio counts only while the tutor is on this block and began on this challenge.
  const pip = usePipTargets(currentChallenge?.id ?? null, !showingCorrectFeedback && !hasSubmittedEvaluation);
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnChallenge = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = pip.targets();
    const pose = shapeComposerPipPose({
      running: true, preparing: false, currentSolved: !!showingCorrectFeedback, revealHeld: false,
      judging: false, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnChallenge,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Shape composing canvas',
      dock: pip.dock.current, targets, pose,
    };
  });

  // The live line on an open build (shared build layer): what the picture looks like, never a verdict or a count.
  const buildSeeing = useBuildWatcher({
    buildKey: `${currentChallenge?.id}:${freeCreateShapes.map(s => `${s.shape}@${Math.round(s.x)},${Math.round(s.y)},${s.rotation}`).join('|')}`,
    enabled: isOpenBuild && freeCreateShapes.length > 0 && !showingCorrectFeedback && !hasSubmittedEvaluation && !dragging && !blocked,
    svg: canvasRef,
    // The task without the recipe or the touching rule: the line may never say whether the picture is right.
    request: { task: 'Putting shapes together on a board to make a picture of the child’s own', numbers: 'never',
      neverSay: ['touch', 'touching', 'list', 'correct', 'right', 'wrong'],
      sceneNote: 'An empty board with faint dots. The child adds shapes from a palette, slides them and turns them.',
      // The kinds as placed, so the line names the learner's shapes rightly (their own work, so naming it leaks nothing).
      made: `shapes on the board: ${freeCreateShapes.map(s => s.shape).join(', ')}` },
  });

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const inputClosed = blocked || hasSubmittedEvaluation;

  const renderPalette = () => {
    if (!currentChallenge) return null;

    // compose-match: show specific pieces
    if (currentChallenge.type === 'compose-match' && currentChallenge.pieces) {
      const unplaced = currentChallenge.pieces.filter(p => !placedShapes.some(s => s.id === p.id));
      if (unplaced.length === 0) return (
        <div className="text-center text-slate-400 text-sm py-2">All pieces placed!</div>
      );
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {unplaced.map(piece => (
            <button key={piece.id}
              className={`p-2 rounded-lg transition-colors ${interactive.ghost}`}
              disabled={inputClosed}
              onClick={() => { pip.look(`piece-${piece.id}`); addPieceToCanvas(piece); }}>
              <svg width={40} height={40} viewBox={`0 0 ${piece.width} ${piece.height}`} aria-hidden>
                <ShapeSVG shape={piece.shape} color={piece.color || SHAPE_COLORS[piece.shape] || '#8B5CF6'}
                          width={piece.width} height={piece.height} />
              </svg>
              <div className="text-xs text-slate-400 mt-1">{piece.shape}</div>
            </button>
          ))}
        </div>
      );
    }

    // compose-picture: show available shapes with counts
    if (currentChallenge.type === 'compose-picture' && currentChallenge.availableShapes) {
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {currentChallenge.availableShapes.map((s, i) => {
            const placedCount = placedShapes.filter(p => p.shape === s.shape).length;
            const remaining = s.count - placedCount;
            return (
              <button key={i}
                aria-label={s.shape}
                className={`p-2 rounded-lg transition-colors ${remaining > 0 ? interactive.ghost : 'bg-white/2 border border-white/5 opacity-50'}`}
                disabled={remaining <= 0 || inputClosed}
                onClick={() => { pip.look('canvas'); addShapeFromPalette(s.shape, s.color || SHAPE_COLORS[s.shape] || '#8B5CF6', 50, s.shape === 'rectangle' ? 35 : 50); }}>
                <svg width={36} height={36} viewBox="0 0 50 50" aria-hidden>
                  <ShapeSVG shape={s.shape} color={s.color || SHAPE_COLORS[s.shape] || '#8B5CF6'} width={50} height={50} />
                </svg>
                <div className="text-xs text-slate-400 mt-1">{s.shape} ×{remaining}</div>
              </button>
            );
          })}
        </div>
      );
    }

    // free-create / how-many-ways: generic palette
    if (currentChallenge.type === 'free-create' || currentChallenge.type === 'how-many-ways') {
      const allowedShapes = currentChallenge.allowedPieces
        ?? (isOpenBuild ? BUILD_PALETTE[gradeBand] : ['triangle', 'square', 'rectangle', 'circle']);
      return (
        <div className="flex flex-wrap gap-2 justify-center">
          {allowedShapes.map(shape => (
            <button key={shape}
              className={`p-2 rounded-lg transition-colors ${interactive.ghost}`}
              disabled={inputClosed}
              onClick={() => { pip.look('canvas'); addShapeFromPalette(shape, SHAPE_COLORS[shape] || '#8B5CF6', 50, shape === 'rectangle' ? 35 : 50); }}>
              <svg width={36} height={36} viewBox="0 0 50 50" aria-hidden>
                <ShapeSVG shape={shape} color={SHAPE_COLORS[shape] || '#8B5CF6'} width={50} height={50} />
              </svg>
              <div className="text-xs text-slate-400 mt-1">{shape}</div>
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  const renderCanvas = () => {
    if (!currentChallenge) return null;
    const shapes = currentChallenge.type === 'free-create' ? freeCreateShapes : placedShapes;
    // Support-tier scaffolds: seams = the decomposition answer (easy only),
    // snap guides = slot/halo hints (easy+medium). Undefined → no tier → show
    // (default behaviour byte-identical to before).
    const showSeams = currentChallenge.showSeams !== false;
    const showSnapGuides = currentChallenge.showSnapGuides !== false;
    // Lever marks on the learner's own pieces (`shapeComposerLevers.ts`): where each sits, never where one goes.
    const work = view();
    const fitted = leverOn(IN_PLACE_LEVER) ? fittedPieceIds(currentChallenge, work) : null;
    const joins = leverOn(JOIN_MARKS_LEVER) ? joinStates(shapes) : null;
    const offList = leverOn(LIST_MATCH_LEVER) && currentChallenge.recipe ? listMatch(currentChallenge.recipe, shapes).offList : null;
    const filled = leverOn(EMPTY_SPOTS_LEVER) ? filledSlotIds(currentChallenge, work) : null;
    const ring = (id: string): { color: string; mark: string; dash?: string } | null => {
      if (offList?.has(id)) return { color: '#F43F5E', mark: 'off-list', dash: '5 3' };
      const j = joins?.get(id);
      if (j) return j === 'on_top' ? { color: '#F43F5E', mark: 'on-top' } : j === 'touching' ? { color: '#22C55E', mark: 'touching' }
        : { color: '#F59E0B', mark: 'alone', dash: '5 3' };
      if (fitted) return fitted.has(id) ? { color: '#22C55E', mark: 'in-place' } : { color: '#F59E0B', mark: 'not-in-place', dash: '5 3' };
      return null;
    };

    return (
      <svg ref={canvasRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="w-full rounded-xl border border-white/10 bg-slate-800/50"
        style={{ maxHeight: 350, touchAction: 'none' }}
        onPointerMove={handleCanvasMouseMove}
        onPointerUp={handleCanvasMouseUp}
        onPointerLeave={handleCanvasMouseUp}>
        {/* Grid dots for guidance */}
        {Array.from({ length: 9 }, (_, row) =>
          Array.from({ length: 11 }, (_, col) => (
            <circle key={`dot-${row}-${col}`}
              cx={20 + col * (CANVAS_WIDTH - 40) / 10}
              cy={20 + row * (CANVAS_HEIGHT - 40) / 8}
              r={1.5} fill="rgba(255,255,255,0.08)" />
          ))
        )}

        {/* Target silhouette for compose-match (the TARGET — always shown; it is
            the eval-mode goal, never withdrawn by a tier) */}
        {currentChallenge.type === 'compose-match' && currentChallenge.targetOutlinePath && (
          <path d={currentChallenge.targetOutlinePath}
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeDasharray="8 4" />
        )}
        {/* empty_space lever: the outline lit; the pieces drawn above it leave only the uncovered part showing. */}
        {currentChallenge.type === 'compose-match' && currentChallenge.targetOutlinePath && leverOn(EMPTY_SPACE_LEVER) && (
          <path data-lever="empty-space" d={currentChallenge.targetOutlinePath} fill="rgba(253,224,71,0.35)" stroke="none" />
        )}

        {/* Decomposition SEAMS for compose-match — each piece's landing outline
            inside the silhouette. These reveal HOW the target tiles, so they are
            shown at easy only (showSeams). Display-only: the checker matches placed
            pieces to piece.targetX/Y geometry, never to these outlines. */}
        {currentChallenge.type === 'compose-match' && showSeams && currentChallenge.pieces?.map(p => (
          (p.targetX !== undefined && p.targetY !== undefined) ? (
            <g key={`seam-${p.id}`}
               transform={`translate(${p.targetX}, ${p.targetY}) rotate(${p.targetRotation ?? 0}, ${p.width / 2}, ${p.height / 2})`}>
              {p.shape === 'circle' ? (
                <ellipse cx={p.width / 2} cy={p.height / 2} rx={p.width / 2} ry={p.height / 2}
                  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.25} strokeDasharray="5 4" />
              ) : (
                <path d={getShapePath(p.shape, p.width, p.height)}
                  fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.25} strokeDasharray="5 4" />
              )}
            </g>
          ) : null
        ))}

        {/* Picture slots for compose-picture — these are the snap GUIDES marking
            where each shape goes. Shown easy+medium; withdrawn at hard. */}
        {currentChallenge.type === 'compose-picture' && showSnapGuides && currentChallenge.pictureSlots?.map(slot => (
          <g key={slot.id} transform={`translate(${slot.x}, ${slot.y}) rotate(${slot.rotation}, ${slot.width / 2}, ${slot.height / 2})`}>
            {slot.shape === 'circle' ? (
              <ellipse cx={slot.width / 2} cy={slot.height / 2} rx={slot.width / 2} ry={slot.height / 2}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />
            ) : (
              <path d={getShapePath(slot.shape, slot.width, slot.height)}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="6 3" />
            )}
          </g>
        ))}

        {/* empty_spots lever: every spot no shape fills yet glows, drawn even where the session hides the spots. */}
        {currentChallenge.type === 'compose-picture' && filled && currentChallenge.pictureSlots?.filter(slot => !filled.has(slot.id)).map(slot => (
          <g key={`empty-${slot.id}`} data-lever="empty-spot"
            transform={`translate(${slot.x}, ${slot.y}) rotate(${slot.rotation}, ${slot.width / 2}, ${slot.height / 2})`}>
            {slot.shape === 'circle' ? (
              <ellipse cx={slot.width / 2} cy={slot.height / 2} rx={slot.width / 2} ry={slot.height / 2}
                fill="rgba(253,224,71,0.2)" stroke="rgba(253,224,71,0.8)" strokeWidth={2} strokeDasharray="6 3" />
            ) : (
              <path d={getShapePath(slot.shape, slot.width, slot.height)}
                fill="rgba(253,224,71,0.2)" stroke="rgba(253,224,71,0.8)" strokeWidth={2} strokeDasharray="6 3" />
            )}
          </g>
        ))}

        {/* Decompose: show the composite shape */}
        {currentChallenge.type === 'decompose' && currentChallenge.compositeShapePath && (
          <path d={currentChallenge.compositeShapePath}
            fill="rgba(139,92,246,0.3)" stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
        )}

        {/* Division-line SEAMS for decompose — they reveal exactly how the
            composite splits, i.e. the decomposition answer. Shown at easy only
            (showSeams); at hard the student mentally segments the composite.
            Display-only: the checker reads decomposeTaps vs expectedComponents,
            never these lines. */}
        {currentChallenge.type === 'decompose' && (showSeams || leverOn(SPLIT_LINES_LEVER)) && currentChallenge.divisionLineHints?.map((line, i) => (
          <line key={`div-${i}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Placed shapes */}
        {shapes.map(s => {
          const r = ring(s.id);
          return (
          <ShapeSVG key={s.id} shape={s.shape} color={s.color}
            width={s.width} height={s.height} rotation={s.rotation}
            x={s.x} y={s.y}
            strokeColor={selectedShapeId === s.id ? '#FCD34D' : r?.color ?? 'rgba(255,255,255,0.3)'}
            strokeWidth={selectedShapeId === s.id || r ? 3 : 1.5}
            mark={r?.mark} dash={r?.dash}
            pipRef={pip.ref(`piece-${s.id}`)} pipObject={`piece-${s.id}`}
            onPointerDown={(e) => { pip.look(`piece-${s.id}`); handleShapeMouseDown(s.id, e); }} />
          );
        })}
      </svg>
    );
  };

  const renderDecomposeButtons = () => {
    if (!currentChallenge || currentChallenge.type !== 'decompose') return null;
    // The parts plus shapes that are not in it: the buttons, their order and their colour never say which are the parts.
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Tap a shape for each part you see:</p>
        <div ref={pip.ref('choices')} data-pip-object="choices" className="flex flex-wrap gap-2 justify-center">
          {decomposeChoices(currentChallenge).map(shape => {
            const count = decomposeTaps.filter(t => t === shape).length;
            return (
              <button key={shape}
                aria-label={shape}
                disabled={inputClosed}
                className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  answerStateClass(count > 0 ? 'selected' : 'idle')
                }`}
                onClick={() => { pip.look('choices'); handleDecomposeTap(shape); }}>
                <svg width={24} height={24} viewBox="0 0 50 50" aria-hidden>
                  <ShapeSVG shape={shape} color={SHAPE_COLORS[shape] || '#8B5CF6'} width={50} height={50} />
                </svg>
                <span className="text-sm">{shape}</span>
                {count > 0 && <LuminaBadge className="text-xs">{count}</LuminaBadge>}
              </button>
            );
          })}
        </div>
        {decomposeTaps.length > 0 && (
          <LuminaButton size="sm" className="text-xs" disabled={inputClosed}
            onClick={() => { if (!learnerBlocked()) setDecomposeTaps([]); }}>
            Reset Selections
          </LuminaButton>
        )}
      </div>
    );
  };

  const renderHowManyWays = () => {
    if (!currentChallenge || currentChallenge.type !== 'how-many-ways') return null;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          Build <span className="text-slate-200 font-medium">{currentChallenge.targetForComposition}</span> using the shapes below.
          How many pieces do you need?
        </p>
        <div ref={pip.ref('entry')} data-pip-object="entry" className="flex items-center gap-3 justify-center">
          <LuminaInput
            type="number"
            inputMode="numeric"
            aria-label="How many pieces"
            min={1}
            max={20}
            value={howManyAnswer}
            disabled={inputClosed}
            onFocus={() => pip.look('entry')}
            onChange={(e) => { if (learnerBlocked()) return; pip.look('entry'); setHowManyAnswer(e.target.value); }}
            className="w-16 text-center text-lg"
            placeholder="?"
          />
          <span className="text-slate-400 text-sm">pieces</span>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-slate-400">No challenges available.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const checkEmpty = currentChallenge?.type === 'how-many-ways' && !howManyAnswer.trim();
  const recipeLit = leverOn(LIST_MATCH_LEVER) && currentChallenge?.recipe ? listMatch(currentChallenge.recipe, freeCreateShapes).lit : null;
  const partsModel = leverOn(PARTS_MODEL_LEVER) && sessionChallenge ? partsModelFor(sessionChallenge) : null;
  const piecesModel = leverOn(PIECES_MODEL_LEVER) && sessionChallenge ? piecesModelFor(sessionChallenge) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {!allChallengesComplete && (
              <LuminaBadge>
                {currentChallengeIndex + 1} / {challenges.length}
              </LuminaBadge>
            )}
            {isConnected && !tutorOwned && (
              <LuminaBadge accent="purple" className="text-xs">
                AI Tutor
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)}
            durationMs={elapsedMs}
            heading="Shape Composer Complete!"
            celebrationMessage="You composed and decomposed shapes like a pro!"
            className="mb-4"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Instruction */}
            <LuminaPrompt>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon ?? '🧩'}</span>
                <span className="text-sm font-medium text-slate-300">
                  {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label ?? currentChallenge.type}
                </span>
              </div>
              <p className="text-slate-100">{currentChallenge.instruction}</p>
              {/* The recipe as pictures, for a child who cannot read the ask. It is the task, so it is shown. */}
              {isOpenBuild && (
                <div data-recipe aria-label={`Shapes to use: ${recipeText(currentChallenge.recipe!)}`}
                  className="mt-2 flex flex-wrap items-center gap-1.5">
                  {currentChallenge.recipe!.flatMap((r, ri) => Array.from({ length: r.count }, (_, i) => {
                    // list_match lever: an icon lights when a shape of its kind is on the board.
                    const lit = !!recipeLit && i < recipeLit[ri];
                    return (
                      <svg key={`${r.shape}-${i}`} width={30} height={30} viewBox="0 0 50 50" aria-hidden data-lever={lit ? 'list-lit' : undefined}
                        className={lit ? 'rounded-md ring-2 ring-emerald-400' : recipeLit ? 'opacity-60' : undefined}>
                        <ShapeSVG shape={r.shape} color={SHAPE_COLORS[r.shape] || '#8B5CF6'} width={50} height={50} />
                      </svg>
                    );
                  }))}
                </div>
              )}
            </LuminaPrompt>

            {/* Canvas */}
            {(currentChallenge.type !== 'decompose' || currentChallenge.compositeShapePath) && (
              <div ref={pip.ref('canvas')} data-pip-object="canvas" className="relative">
                {renderCanvas()}
                {/* Shape controls */}
                {selectedShapeId && !showingCorrectFeedback && !inputClosed && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <LuminaButton size="sm"
                      aria-label="Turn the selected piece"
                      className="text-xs h-7 px-2"
                      onClick={() => rotateSelected(rotationSnap)}>
                      ↻ {rotationSnap}°
                    </LuminaButton>
                    <LuminaButton tone="danger" size="sm"
                      aria-label="Remove the selected piece"
                      className="text-xs h-7 px-2"
                      onClick={removeSelected}>
                      ✕
                    </LuminaButton>
                  </div>
                )}
              </div>
            )}

            {/* Pip's dock sits between the canvas and the answers below it
                (palette pieces, decompose shape buttons, the how-many box). */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

            {/* Palette */}
            {!showingCorrectFeedback && currentChallenge.type !== 'decompose' && (
              <LuminaPanel ref={pip.ref('palette')} data-pip-object="palette" className="p-3">
                <LuminaSectionLabel accent="cyan" size="sm" className="mb-2">Shape Palette — click to add</LuminaSectionLabel>
                {renderPalette()}
              </LuminaPanel>
            )}

            {partsModel && <PartsModelPicture model={partsModel} />}
            {piecesModel && <PiecesModelPicture model={piecesModel} />}

            {/* Decompose buttons */}
            {currentChallenge.type === 'decompose' && !showingCorrectFeedback && renderDecomposeButtons()}

            {/* How Many Ways input */}
            {currentChallenge.type === 'how-many-ways' && !showingCorrectFeedback && renderHowManyWays()}

            {isOpenBuild && buildSeeing && !showingCorrectFeedback && !blocked && (
              <div data-testid="build-watcher" className="text-center">
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}>
                {feedback}
              </LuminaFeedbackCard>
            )}

            {/* Action buttons (Next on the scripted path only: on the workspace the runtime advances) */}
            <div className="flex gap-2 justify-end">
              {showingCorrectFeedback ? (
                !tutorOwned && (
                  <LuminaActionButton action="next" onClick={advanceToNextChallenge}>
                    {currentChallengeIndex + 1 < challenges.length ? 'Next Challenge →' : 'See Results →'}
                  </LuminaActionButton>
                )
              ) : isOpenBuild ? (
                <>
                  <LuminaButton disabled={freeCreateShapes.length === 0 || inputClosed}
                    onClick={() => { if (learnerBlocked()) return; setFreeCreateShapes([]); setSelectedShapeId(null); }}>
                    Start over
                  </LuminaButton>
                  <LuminaActionButton action="check" disabled={freeCreateShapes.length === 0 || inputClosed} onClick={handleCheckAnswer}>
                    I&apos;m done!
                  </LuminaActionButton>
                </>
              ) : (
                <LuminaActionButton action="check" disabled={inputClosed || checkEmpty} onClick={handleCheckAnswer}>
                  Check Answer
                </LuminaActionButton>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const ShapeComposer = withWorkspaceController<ShapeComposerProps, ProgressOptions<ShapeComposerChallenge>, Progress>(
  'shape-composer', ShapeComposerSurface, useScriptedProgress, useWorkspaceProgressFor('shape-composer'));

export default ShapeComposer;
