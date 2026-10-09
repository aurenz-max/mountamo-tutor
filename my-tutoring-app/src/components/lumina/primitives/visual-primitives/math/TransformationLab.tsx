'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaPrompt,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
  LuminaAnswerChoice,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TransformationLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  CANVAS_H, CANVAS_W, GRID_MAX, GRID_MIN, GRID_TARGET, canvasToGrid, SEQUENCE_PALETTE, applyOp, describeTransformWork, gridToCanvas,
  transformCorrect, transformMiss, workspaceAssignment, workspaceScene, type TransformWork,
} from './transformationLabWorkspace';
import {
  CORNER_LETTERS_LEVER, LETTERS, MODEL_FLAG, MODEL_POINT_LEVER, MOTION_MODELS_LEVER, ORIGIN_RAYS_LEVER, PRE_COORDS_LEVER,
  RULE_CARD_LEVER, TARGET_COORDS_LEVER, isPracticeTransform, leverFacts, modelPoint, motionModels, ruleFor, simplerItem,
  transformLevers,
} from './transformationLabLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type TransformationLabChallengeType =
  | 'apply_translation_reflection'
  | 'apply_rotation'
  | 'identify_transformation'
  | 'compose_sequence'
  | 'dilation_similarity';

/** What the student must do this challenge. */
export type TransformAnswerKind = 'drag' | 'identify' | 'sequence';

/** A lattice point on the coordinate grid. */
export interface GridPoint {
  x: number;
  y: number;
}

/** Palette operations available in compose_sequence mode. */
export type SequenceOp =
  | 'reflect_x'
  | 'reflect_y'
  | 'rotate90'
  | 'rotate180'
  | 'rotate270'
  | 'tr_up'
  | 'tr_down'
  | 'tr_left'
  | 'tr_right';

export interface TransformationLabChallenge {
  id: string;
  type: TransformationLabChallengeType;
  /** Short real-world framing (always present). */
  narration: string;
  /** What the student should do this challenge. */
  instruction: string;
  hint: string;
  answerKind: TransformAnswerKind;

  /** Pre-image polygon vertices (integer lattice points). 3-4 vertices. */
  preImage: GridPoint[];
  /** The correct transformed polygon — the ANSWER for drag / sequence modes. */
  expectedImage: GridPoint[];
  /** Human-readable description of the transformation (tutor + feedback; NEVER shown as a label before answering in drag mode). */
  transformLabel: string;

  // --- identify_transformation: multiple-choice naming ---
  /** 4 option labels describing candidate transformations. */
  options?: string[];
  /** Index of the correct option. */
  correctOption?: number;

  // --- dilation_similarity ---
  /** True when the transformation is a (non-congruent) similarity. */
  isSimilarity?: boolean;
  /** Scale factor for dilations (for tutor context). */
  scaleFactor?: number;

  // --- within-mode support tier (scaffolding level; never changes the figure) ---
  /** 'easy' | 'medium' | 'hard' — set by the generator when a tier is active. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /**
   * Show (x, y) coordinate labels on the cyan PRE-IMAGE vertices (perception aid).
   * Default ON (legacy behavior) when undefined. NEVER labels the expected image.
   */
  showPreImageCoords?: boolean;
  /**
   * Always-visible coordinate-rule notation shown beside the canvas, e.g.
   * "(x, y) → (−x, y)" (the transformation guide). Withdrawn at hard.
   * NEVER set for identify mode (the rule names the answer). Display-only.
   */
  ruleNotation?: string;
}

export interface TransformationLabData {
  title: string;
  description: string;
  challengeType: TransformationLabChallengeType;
  gradeBand?: '8';
  /** 3-6 challenges per session. Required. Built by the generator's pool service. */
  challenges: TransformationLabChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TransformationLabMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<TransformationLabChallengeType, PhaseConfig> = {
  apply_translation_reflection: { label: 'Translate & Reflect', icon: '🪞', accentColor: 'cyan' },
  apply_rotation:               { label: 'Rotate',              icon: '🔄', accentColor: 'purple' },
  identify_transformation:      { label: 'Identify',            icon: '🔎', accentColor: 'emerald' },
  compose_sequence:             { label: 'Compose',             icon: '🧩', accentColor: 'amber' },
  dilation_similarity:          { label: 'Dilate',              icon: '🔍', accentColor: 'blue' },
};

// ============================================================================
// Canvas constants (the grid geometry lives in transformationLabWorkspace.ts)
// ============================================================================

const HANDLE_HIT = 16; // logical px

const COL_GRID = 'rgba(148, 163, 184, 0.16)';
const COL_AXIS = 'rgba(148, 163, 184, 0.55)';
const COL_PRE = '#22d3ee';        // cyan — pre-image
const FILL_PRE = 'rgba(34, 211, 238, 0.16)';
const COL_IMG = '#f472b6';        // pink — working/expected image
const FILL_IMG = 'rgba(244, 114, 182, 0.18)';
const COL_GHOST = 'rgba(251, 191, 36, 0.65)'; // amber — ghost target (sequence)
const COL_SHOWN = '#fbbf24';      // amber — shown image (identify)
const FILL_SHOWN = 'rgba(251, 191, 36, 0.16)';
const COL_MODEL = '#34d399';      // green — the model point a lever draws outside the item

const worldToScreen = gridToCanvas;

/**
 * Tier-aware tutor reveal clause. The support tier withholds on-screen guides
 * (rule notation, pre-image coords); the tutor must not hand them back at a
 * harder tier. Hard: never name the rule or where vertices map; ask what the
 * transformation DOES; never reveal image coordinates. (Identify always hides
 * the rule — the relationship IS the answer — independent of tier.)
 */
function tutorRevealClause(
  tier: 'easy' | 'medium' | 'hard' | undefined,
  isIdentify: boolean,
): string {
  if (isIdentify) {
    return ' [REVEAL: This is a recognition task — the transformation name IS the answer. '
      + 'Never name it; have the student follow one corner and describe the motion they see.]';
  }
  if (tier === 'hard') {
    return ' [REVEAL=hard: The rule notation and coordinate labels are HIDDEN this tier. '
      + 'Do NOT state the coordinate rule, do NOT say where any vertex maps, and never reveal image coordinates. '
      + 'Ask what the transformation DOES to the figure and let the student derive the rule.]';
  }
  if (tier === 'medium') {
    return ' [REVEAL=medium: The rule notation is on screen but coordinate labels are hidden. '
      + 'Nudge execution — point to the rule; do not compute the image coordinates for them.]';
  }
  if (tier === 'easy') {
    return ' [REVEAL=easy: The rule notation and pre-image coordinates are on screen. '
      + 'You may name the rule and walk one vertex through it, then let the student finish the rest.]';
  }
  return ''; // no tier active — default coaching
}

// ============================================================================
// Component
// ============================================================================

interface TransformationLabProps {
  data: TransformationLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const TransformationLabSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  TransformationLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<TransformationLabChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    gradeBand = '8',
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `transformation-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Multi-challenge progression. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
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

  // In-item levers (`transformationLabLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<TransformationLabChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** The rule card on screen: the tier's, or the `rule_card` lever's on the session item. */
  const ruleOnScreen = currentChallenge?.ruleNotation
    ?? (leverOn(RULE_CARD_LEVER) && sessionChallenge ? ruleFor(sessionChallenge) : null);
  const challengeType = currentChallenge?.type ?? 'apply_translation_reflection';

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  // The student's manipulable image (drag + sequence modes share this).
  const [workingImage, setWorkingImage] = useState<GridPoint[]>([]);
  const [sequenceSteps, setSequenceSteps] = useState<SequenceOp[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  /** A blank start on `ch`: the pink figure back on the pre-image, no moves, no option, no feedback. */
  const resetWork = (ch: TransformationLabChallenge | null) => {
    setWorkingImage(ch ? ch.preImage.map((p) => ({ ...p })) : []);
    setSequenceSteps([]);
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    recordedRef.current = false;
    hintViewedRef.current = false;
    dragIndexRef.current = null;
  };
  // Workspace path: a fresh item and Try again both open blank (the scripted path resets in the effect below). Try again
  // on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
  openItem.current = (index, retry) => {
    if (retry) resetWork(practice ?? challenges[index] ?? null);
    else { setPractice(null); resetWork(challenges[index] ?? null); }
  };

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever the item on screen changes.
  // -------------------------------------------------------------------------
  useEffect(() => {
    resetWork(currentChallenge);
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || CANVAS_W;
    const cssH = canvas.clientHeight || CANVAS_H;
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(bw / CANVAS_W, 0, 0, bh / CANVAS_H, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ----- grid -----
    ctx.lineWidth = 1;
    ctx.strokeStyle = COL_GRID;
    for (let gx = GRID_MIN; gx <= GRID_MAX; gx++) {
      const { x } = worldToScreen({ x: gx, y: 0 });
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let gy = GRID_MIN; gy <= GRID_MAX; gy++) {
      const { y } = worldToScreen({ x: 0, y: gy });
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    // axes
    const origin = worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = COL_AXIS;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(CANVAS_W, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, CANVAS_H);
    ctx.stroke();
    // axis ticks every 2 units
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let g = GRID_MIN; g <= GRID_MAX; g += 2) {
      if (g === 0) continue;
      const sx = worldToScreen({ x: g, y: 0 });
      ctx.fillText(`${g}`, sx.x, origin.y + 12);
      const sy = worldToScreen({ x: 0, y: g });
      ctx.fillText(`${g}`, origin.x - 12, sy.y);
    }

    // ----- polygon drawing helper -----
    const drawPolygon = (
      pts: GridPoint[],
      stroke: string,
      fill: string,
      opts: { dashed?: boolean; labelPts?: boolean; labelColor?: string } = {},
    ) => {
      if (pts.length === 0) return;
      ctx.save();
      if (opts.dashed) ctx.setLineDash([6, 5]);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const s = worldToScreen(p);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      if (opts.labelPts) {
        pts.forEach((p) => {
          const s = worldToScreen(p);
          ctx.fillStyle = opts.labelColor ?? stroke;
          ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`(${p.x}, ${p.y})`, s.x + 7, s.y - 5);
        });
      }
    };

    const drawVertices = (pts: GridPoint[], color: string, r = 5) => {
      pts.forEach((p) => {
        const s = worldToScreen(p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    };

    const ch = currentChallenge;

    // Pre-image is always shown (the object being transformed). Its (x, y) vertex
    // labels are a perception-aid scaffold withdrawn at harder tiers (default ON
    // when the field is absent, preserving legacy behavior). Never the answer.
    const showPreCoords = ch.showPreImageCoords !== false || leverOn(PRE_COORDS_LEVER);
    // `origin_rays` lever: a dashed ray from the origin through each cyan corner to the grid's edge, no point marked.
    if (leverOn(ORIGIN_RAYS_LEVER)) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
      ctx.lineWidth = 1.25;
      ch.preImage.forEach((p) => {
        if (p.x === 0 && p.y === 0) return;
        const reach = GRID_MAX / Math.max(Math.abs(p.x), Math.abs(p.y));
        const end = worldToScreen({ x: p.x * reach, y: p.y * reach });
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
      ctx.restore();
    }
    drawPolygon(ch.preImage, COL_PRE, FILL_PRE, { labelPts: showPreCoords });
    drawVertices(ch.preImage, COL_PRE, 4);

    if (ch.answerKind === 'identify') {
      // Show the resulting image (amber) — the student names the transform.
      drawPolygon(ch.expectedImage, COL_SHOWN, FILL_SHOWN, { labelPts: true });
      drawVertices(ch.expectedImage, COL_SHOWN, 4);
    } else if (ch.answerKind === 'sequence') {
      // Ghost target (the WHERE) — the skill is finding the HOW.
      drawPolygon(ch.expectedImage, COL_GHOST, 'rgba(251,191,36,0.06)', { dashed: true });
      // Working image (pink) — student manipulates via the palette.
      drawPolygon(workingImage, COL_IMG, FILL_IMG, { labelPts: true });
      drawVertices(workingImage, COL_IMG, 5);
    } else {
      // drag (apply / dilation) — NO target shown (it is the answer).
      drawPolygon(workingImage, COL_IMG, FILL_IMG, { dashed: true, labelPts: true });
      drawVertices(workingImage, COL_IMG, 6);
    }

    // `target_coords` lever (compose): the dashed target's corners labelled; the target is the WHERE, never the moves.
    if (ch.answerKind === 'sequence' && leverOn(TARGET_COORDS_LEVER)) {
      ch.expectedImage.forEach((p) => {
        const s = worldToScreen(p);
        ctx.fillStyle = COL_SHOWN;
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`(${p.x}, ${p.y})`, s.x - 6, s.y + 4);
      });
    }
    // `corner_letters` lever: A, B, C on the pre-image and A′, B′, C′ on its partners (A″ on a compose target).
    if (leverOn(CORNER_LETTERS_LEVER)) {
      const letter = (pts: GridPoint[], mark: string, color: string) => pts.forEach((p, i) => {
        const s = worldToScreen(p);
        ctx.fillStyle = color;
        ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${LETTERS[i] ?? '?'}${mark}`, s.x - 6, s.y - 4);
      });
      letter(ch.preImage, '', COL_PRE);
      if (ch.answerKind === 'identify') letter(ch.expectedImage, '′', COL_SHOWN);
      else letter(workingImage, '′', COL_IMG);
      if (ch.answerKind === 'sequence') letter(ch.expectedImage, '″', COL_SHOWN);
    }
    // `model_point` lever: the motion on a green point P away from the figure, and its image P′.
    const model = leverOn(MODEL_POINT_LEVER) ? modelPoint(ch) : null;
    if (model) {
      const a = worldToScreen(model.from), b = worldToScreen(model.to);
      ctx.save();
      ctx.strokeStyle = COL_MODEL;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - 9 * Math.cos(ang - 0.4), b.y - 9 * Math.sin(ang - 0.4));
      ctx.lineTo(b.x - 9 * Math.cos(ang + 0.4), b.y - 9 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fillStyle = COL_MODEL;
      ctx.fill();
      ctx.restore();
      drawVertices([model.from, model.to], COL_MODEL, 4);
      ctx.fillStyle = COL_MODEL;
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P (${model.from.x}, ${model.from.y})`, a.x + 6, a.y + 4);
      ctx.fillText(`P′ (${model.to.x}, ${model.to.y})`, b.x + 6, b.y + 4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, workingImage, resizeTick, practice, leverState]);

  // Redraw crisply when the canvas's displayed size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Drag interaction (apply / dilation modes)
  // -------------------------------------------------------------------------
  /** A pointer position in the canvas's logical pixels. An unmeasured canvas (no layout) reads them 1:1. */
  const toLogical = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? CANVAS_W / rect.width : 1;
    const sy = rect.height > 0 ? CANVAS_H / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }, []);

  const isDragMode = currentChallenge?.answerKind === 'drag';
  const inputClosed = blocked;

  /** A drag starts on the nearest pink corner within the hit radius. */
  const startDrag = (clientX: number, clientY: number): boolean => {
    if (!isDragMode || !currentChallenge || learnerBlocked()) return false;
    const { x: lx, y: ly } = toLogical(clientX, clientY);
    let best = -1;
    let bestDist = HANDLE_HIT;
    workingImage.forEach((p, i) => {
      const s = worldToScreen(p);
      const d = Math.hypot(s.x - lx, s.y - ly);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best < 0) return false;
    dragIndexRef.current = best;
    SoundManager.tap();
    return true;
  };
  const moveDrag = (clientX: number, clientY: number) => {
    const idx = dragIndexRef.current;
    if (idx === null) return;
    const { x: lx, y: ly } = toLogical(clientX, clientY);
    const g = canvasToGrid(lx, ly);
    const cx = Math.max(GRID_MIN, Math.min(GRID_MAX, g.x));
    const cy = Math.max(GRID_MIN, Math.min(GRID_MAX, g.y));
    setWorkingImage((prev) => {
      if (prev[idx] && prev[idx].x === cx && prev[idx].y === cy) return prev;
      const next = prev.map((p) => ({ ...p }));
      if (next[idx]) next[idx] = { x: cx, y: cy };
      return next;
    });
  };
  const endDrag = () => {
    if (dragIndexRef.current === null) return false;
    dragIndexRef.current = null;
    SoundManager.snap();
    return true;
  };
  // Pointer events drive the drag; a mouse event acts only where no pointer event came first (a browser follows each
  // pointer event with a mouse one, and a pointer-less host, like the journey driver, sends only mouse events).
  const pointerSeenRef = useRef(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerSeenRef.current = true;
    if (startDrag(e.clientX, e.clientY)) {
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => moveDrag(e.clientX, e.clientY);
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (endDrag()) {
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
  };
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { if (!pointerSeenRef.current) startDrag(e.clientX, e.clientY); };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => { if (!pointerSeenRef.current) moveDrag(e.clientX, e.clientY); };
  const handleMouseUp = () => { if (!pointerSeenRef.current) endDrag(); };

  // -------------------------------------------------------------------------
  // Sequence palette (compose mode)
  // -------------------------------------------------------------------------
  const applySequenceOp = (op: SequenceOp) => {
    if (!currentChallenge || currentChallenge.answerKind !== 'sequence' || learnerBlocked()) return;
    SoundManager.tap();
    setWorkingImage((prev) => prev.map((p) => applyOp(op, p)));
    setSequenceSteps((prev) => [...prev, op]);
  };

  const resetWorking = () => {
    if (!currentChallenge || learnerBlocked()) return;
    SoundManager.tick();
    setWorkingImage(currentChallenge.preImage.map((p) => ({ ...p })));
    setSequenceSteps([]);
  };

  // -------------------------------------------------------------------------
  // Evaluation + phase results
  // -------------------------------------------------------------------------
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_CONFIG_BY_TYPE,
    getScore: (rs) =>
      Math.round(
        rs.reduce(
          (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
          0,
        ) / Math.max(rs.length, 1),
      ),
  });

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<TransformationLabMetrics>({
    primitiveType: 'transformation-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring (scripted path). Its context carries the transformation's name, so the workspace path reads the
  // scene instead: the legacy hook is disabled there and its sendText muted.
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    answerKind: currentChallenge?.answerKind ?? 'drag',
    transformLabel: currentChallenge?.transformLabel ?? null,
    isSimilarity: currentChallenge?.isSimilarity ?? false,
    scaleFactor: currentChallenge?.scaleFactor ?? null,
    supportTier: currentChallenge?.supportTier ?? null,
    gradeBand,
    attemptNumber: currentAttempts + 1,
  }), [
    challengeType,
    currentChallenge,
    currentChallengeIndex,
    challenges.length,
    gradeBand,
    currentAttempts,
  ]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'transformation-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: `Grade ${gradeBand}`,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Transformation session: ${challenges.length} problems, mode "${challengeType}", grade ${gradeBand}. `
      + `Introduce briefly: a transformation moves a shape on the coordinate plane. Rigid motions (translations, reflections, rotations) keep size and shape — the image is congruent. A dilation scales the shape — the image is similar. Then read the first task.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, sendText]);

  // -------------------------------------------------------------------------
  // Record / check
  // -------------------------------------------------------------------------
  /** This primitive's own score on a correct check (the commit already counted the attempt and the verdict). */
  const completeChallenge = (ch: TransformationLabChallenge, attempts: number) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    // An easier practice item (a simplify lever) is not the session's challenge: it records nothing.
    if (isPracticeTransform(ch)) return;
    recordResult({ challengeId: ch.id, correct: true, attempts, score: Math.max(20, 100 - (attempts - 1) * 20) });
  };

  const handleCheck = () => {
    if (!currentChallenge || hasSubmittedEvaluation || learnerBlocked()) return;
    if (recordedRef.current) return;
    const ch = currentChallenge;
    if (ch.answerKind === 'identify' && selectedOption === null) {
      setFeedback('Pick the transformation that maps the cyan pre-image onto the amber image.');
      setFeedbackType('error');
      return;
    }
    const work: TransformWork = { image: workingImage, steps: sequenceSteps, selected: selectedOption };
    const correct = transformCorrect(ch, work);
    const attempts = currentAttempts + 1;
    const response = describeTransformWork(ch, work);

    if (correct) {
      SoundManager.playCorrect();
      if (ch.answerKind === 'identify') {
        setFeedback(`Correct — this is a ${ch.transformLabel.toLowerCase()}.`);
        sendText(
          `[ANSWER_CORRECT] Student identified the transformation as "${ch.options?.[selectedOption ?? 0]}" (correct). Celebrate briefly and restate what stays invariant.`,
          { silent: true },
        );
      } else {
        const tail =
          ch.answerKind === 'sequence'
            ? ` You used ${sequenceSteps.length} step${sequenceSteps.length === 1 ? '' : 's'}.`
            : ch.isSimilarity
            ? ' The image is similar to the original — same shape, scaled size.'
            : ' The image is congruent to the original.';
        setFeedback(`Correct — that's the right image.${tail}`);
        sendText(
          `[ANSWER_CORRECT] Student produced the correct image for a ${challengeType} task (${ch.transformLabel}). `
          + `Celebrate briefly and reinforce ${ch.isSimilarity ? 'why it is similar (not congruent)' : 'why size and shape were preserved'}.`,
          { silent: true },
        );
      }
      setFeedbackType('success');
      progress.commitCheck(response, true);
      completeChallenge(ch, attempts);
      return;
    }

    SoundManager.playIncorrect();
    if (ch.answerKind === 'identify') {
      setFeedback('Not quite. Track ONE vertex from the pre-image to the image — did it slide, flip, turn, or scale?');
      sendText(
        `[ANSWER_INCORRECT] Student chose "${ch.options?.[selectedOption ?? 0]}" but the transformation is "${ch.transformLabel}". `
        + `Attempt ${attempts}. Tell them to follow one corner and notice what changed — do NOT name the answer.`
        + tutorRevealClause(ch.supportTier, true),
        { silent: true },
      );
      // The scripted path clears the choice at once; the workspace path clears it on Try again.
      if (!tutorOwned) setSelectedOption(null);
    } else {
      setFeedback(
        ch.answerKind === 'sequence'
          ? 'Not there yet. Compare each working corner to the ghost target and pick the next transformation.'
          : 'Not quite. Apply the rule to each vertex and drag it to the matching grid point.',
      );
      sendText(
        `[ANSWER_INCORRECT] Student's image does not match the target for ${challengeType} (${ch.transformLabel}). `
        + `Attempt ${attempts}. Coach the coordinate rule for ONE vertex — do NOT give all the answer coordinates.`
        + tutorRevealClause(ch.supportTier, false),
        { silent: true },
      );
    }
    setFeedbackType('error');
    progress.commitCheck(response, false, transformMiss(ch, work));
  };

  const handleShowHint = useCallback(() => {
    if (showHint) return;
    setShowHint(true);
    if (!hintViewedRef.current) {
      hintViewedRef.current = true;
      hintsViewedRef.current += 1;
    }
  }, [showHint]);

  const advanceChallenge = useCallback(() => {
    if (advanceProgress()) {
      const nextIdx = currentChallengeIndex + 1;
      const next = challenges[nextIdx];
      sendText(
        `[NEXT_ITEM] Problem ${nextIdx + 1} of ${challenges.length} (${next?.type}). `
        + `Introduce briefly: "Here's the next one — a new figure to transform."`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session complete (scripted path) — build metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    const total = challenges.length;
    const correctCount = challengeResults.filter((r) => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter((r) => r.correct && r.attempts === 1).length;
    const avgScore = Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / Math.max(challengeResults.length, 1),
    );

    const metrics: TransformationLabMetrics = {
      type: 'transformation-lab',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'apply_translation_reflection') as TransformationLabMetrics['challengeType'],
      totalChallenges: total,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: avgScore,
      averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };

    submitEvaluation(correctCount === total, avgScore, metrics, { challengeResults });

    sendText(
      `[ALL_COMPLETE] All ${total} transformation problems done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give an encouraging, transformation-focused summary (congruence vs similarity).`,
      { silent: true },
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, currentChallenge, submitEvaluation, sendText, tutorOwned]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0 || submittedRef.current) return;
    submittedRef.current = true;
    const metrics: TransformationLabMetrics = {
      type: 'transformation-lab',
      challengeType: (challenges[0]?.type ?? 'apply_translation_reflection') as TransformationLabMetrics['challengeType'],
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const isCurrentComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no
  // presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, {
      image: workingImage, steps: sequenceSteps, selected: selectedOption,
      preCoordsShown: currentChallenge.showPreImageCoords !== false || leverOn(PRE_COORDS_LEVER),
      rule: ruleOnScreen,
    });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : transformLevers(sessionChallenge, pulledLevers, {
      preCoordsShown: sessionChallenge.showPreImageCoords !== false, ruleShown: !!sessionChallenge.ruleNotation });
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerItem(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(sessionChallenge); },
    };
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmittedEvaluation ? null : currentChallenge?.id ?? null,
    label: 'The coordinate grid and answer panel',
    solved: isCurrentComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No transformation-lab challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isIdentifyMode = currentChallenge.answerKind === 'identify';
  const isSequenceMode = currentChallenge.answerKind === 'sequence';

  return (
    <LuminaCard className={['shadow-2xl', className].filter(Boolean).join(' ')}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">Grade {gradeBand}</LuminaBadge>
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
            />
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Narration + instruction */}
        <LuminaPanel className="space-y-1">
          {currentChallenge.narration && (
            <p className="text-slate-300 text-sm italic">{currentChallenge.narration}</p>
          )}
          <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
          {/* Rule-notation guide (perception/instruction scaffold; withdrawn at hard,
              never present for identify where the rule names the answer). */}
          {ruleOnScreen && (
            <p className="text-xs text-cyan-300/90 font-mono mt-1" {...(!currentChallenge.ruleNotation ? { 'data-lever': 'rule-card' } : {})}>
              <span className="uppercase text-cyan-400/70 mr-2">Rule</span>
              {ruleOnScreen}
            </p>
          )}
        </LuminaPanel>

        {/* Progress dots — tri-state (done / active / pending). */}
        <div className="flex items-center justify-center gap-1.5">
          {challenges.map((ch, idx) => {
            const result = challengeResults.find((r) => r.challengeId === ch.id);
            const isActive = idx === currentChallengeIndex;
            const isDone = !!result?.correct;
            return (
              <div
                key={ch.id}
                className={`h-2 rounded-full transition-all ${
                  isDone ? 'w-6 bg-emerald-400/80' : isActive ? 'w-8 bg-cyan-400/80' : 'w-2 bg-slate-600/60'
                }`}
              />
            );
          })}
        </div>

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !allChallengesComplete && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* Canvas — bespoke interaction surface. */}
        <div className="p-3 bg-slate-800/30 rounded-2xl border border-cyan-500/20">
          <canvas
            ref={canvasRef}
            data-pip-object={GRID_TARGET}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg w-full mx-auto"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, maxWidth: 460, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COL_PRE }} /> Pre-image
            </span>
            {isIdentifyMode ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COL_SHOWN }} /> Image
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COL_IMG }} /> Your image
              </span>
            )}
            {isSequenceMode && (
              <span className="flex items-center gap-1.5">
                {/* dropzone-triage: decorative, out of scope — legend swatch mirroring the
                    on-canvas ghost "target" outline; the interaction is a continuous-drag
                    transformation grid (PRD non-goal), not a drop target. */}
                <span className="inline-block w-3 h-3 rounded-sm border border-dashed" style={{ borderColor: COL_GHOST }} /> Target
              </span>
            )}
          </div>
          {/* What a pulled lever drew on the grid, in words (the canvas has no text a reader can reach). */}
          {(leverOn(CORNER_LETTERS_LEVER) || leverOn(MODEL_POINT_LEVER) || leverOn(ORIGIN_RAYS_LEVER)
            || leverOn(PRE_COORDS_LEVER) || leverOn(TARGET_COORDS_LEVER)) && (
            <div className="flex flex-wrap justify-center gap-3 mt-1 text-xs text-emerald-300/90">
              {leverOn(CORNER_LETTERS_LEVER) && <span data-lever="corner-letters">Letters pair each corner with its partner</span>}
              {leverOn(MODEL_POINT_LEVER) && <span data-lever="model-point">Green: a model point P and where this move sends it, P′</span>}
              {leverOn(ORIGIN_RAYS_LEVER) && <span data-lever="origin-rays">Dashed rays from the origin through each cyan corner</span>}
              {leverOn(PRE_COORDS_LEVER) && <span data-lever="pre-coords">Cyan corners labelled with their coordinates</span>}
              {leverOn(TARGET_COORDS_LEVER) && <span data-lever="target-coords">Target corners labelled with their coordinates</span>}
            </div>
          )}
          {isDragMode && (
            <p className="text-center text-xs text-cyan-300/80 mt-1">
              Drag each pink corner to where the rule sends it. Corners snap to grid points.
            </p>
          )}
        </div>

        {/* `motion_models` lever: a model flag (never the item's figure) moved by each motion on offer, none marked. */}
        {leverOn(MOTION_MODELS_LEVER) && motionModels(currentChallenge).length > 0 && (
          <div data-lever="motion-models" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {motionModels(currentChallenge).map(({ caption, image }) => (
              <figure key={caption} className="rounded-xl border border-white/10 bg-slate-900/40 p-2 text-center">
                <svg viewBox="-5 -5 10 10" className="w-20 h-20 mx-auto" aria-hidden="true">
                  <line x1={-5} y1={0} x2={5} y2={0} stroke="rgba(148,163,184,0.5)" strokeWidth={0.08} />
                  <line x1={0} y1={-5} x2={0} y2={5} stroke="rgba(148,163,184,0.5)" strokeWidth={0.08} />
                  <polygon points={MODEL_FLAG.map((p) => `${p.x},${-p.y}`).join(' ')} fill="rgba(34,211,238,0.2)" stroke={COL_PRE} strokeWidth={0.12} />
                  <polygon points={image.map((p) => `${p.x},${-p.y}`).join(' ')} fill="rgba(52,211,153,0.2)" stroke={COL_MODEL} strokeWidth={0.12} />
                </svg>
                <figcaption className="text-[11px] text-slate-300 mt-1">{caption}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <>
            {isIdentifyMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(currentChallenge.options ?? []).map((opt, idx) => {
                  const state = selectedOption === idx ? 'selected' : 'idle';
                  return (
                    <LuminaAnswerChoice
                      key={idx}
                      state={state}
                      className="!p-3"
                      disabled={hasSubmittedEvaluation || inputClosed}
                      onClick={() => {
                        if (learnerBlocked()) return;
                        SoundManager.select();
                        setSelectedOption(idx);
                      }}
                    >
                      <span className="block text-sm font-semibold text-slate-100">{opt}</span>
                    </LuminaAnswerChoice>
                  );
                })}
              </div>
            ) : isSequenceMode ? (
              <LuminaPanel className="space-y-3">
                <p className="text-xs text-slate-400 text-center">
                  Apply transformations until your pink image lands on the dashed target.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SEQUENCE_PALETTE.map(({ op, label }) => (
                    <LuminaButton
                      key={op}
                      tone="subtle"
                      size="sm"
                      onClick={() => applySequenceOp(op)}
                      disabled={hasSubmittedEvaluation || inputClosed}
                    >
                      {label}
                    </LuminaButton>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Steps: {sequenceSteps.length}
                  </span>
                  <LuminaButton tone="ghost" size="sm" onClick={resetWorking} disabled={hasSubmittedEvaluation || inputClosed}>
                    Reset
                  </LuminaButton>
                </div>
              </LuminaPanel>
            ) : (
              // drag mode — direct manipulation on the canvas; offer a reset.
              <div className="flex justify-center">
                <LuminaButton tone="ghost" size="sm" onClick={resetWorking} disabled={hasSubmittedEvaluation || inputClosed}>
                  Reset corners
                </LuminaButton>
              </div>
            )}

            <div className="flex justify-center">
              <LuminaButton tone="primary" onClick={handleCheck} disabled={hasSubmittedEvaluation || inputClosed}>
                Check
              </LuminaButton>
            </div>
          </>
        )}

        </div>

        {/* Feedback */}
        {feedback && feedbackType === 'success' && (
          <LuminaFeedbackCard status="correct">{feedback}</LuminaFeedbackCard>
        )}
        {feedback && feedbackType === 'error' && (
          <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>
        )}
        {feedback && feedbackType === 'info' && (
          <LuminaFeedbackCard status="insight">{feedback}</LuminaFeedbackCard>
        )}

        {/* Hint (scripted path). The generated hint states the coordinate rule; with the tutor, help is the tutor's. */}
        {!tutorOwned && showHint && (
          <LuminaPrompt accent="amber">
            <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
            {currentChallenge.hint}
          </LuminaPrompt>
        )}

        {/* Controls. On the workspace path the shell's Try again / Next challenge replace Next. */}
        {!tutorOwned && (
          <div className="flex justify-center gap-2 flex-wrap">
            {isCurrentComplete && !allChallengesComplete && (
              <LuminaButton
                tone="primary"
                className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                onClick={advanceChallenge}
              >
                Next Problem →
              </LuminaButton>
            )}
            {!isCurrentComplete && !allChallengesComplete && (
              <LuminaButton tone="subtle" size="sm" onClick={handleShowHint} disabled={showHint}>
                {showHint ? 'Hint shown' : 'Show hint'}
              </LuminaButton>
            )}
          </div>
        )}

        {/* Phase summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Transformations Complete!"
            celebrationMessage={`You completed all ${challenges.length} transformation challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const TransformationLab = withWorkspaceController<TransformationLabProps, ProgressOptions<TransformationLabChallenge>, Progress>(
  'transformation-lab', TransformationLabSurface, useScriptedProgress, useWorkspaceProgressFor('transformation-lab'));

export default TransformationLab;
