'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaInput,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SlopeTriangleMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  describeSlopeWork, drawCorrect, lineLabel, parseSlope, slopeTriangleMiss, workspaceScene, type SlopeWork,
} from './slopeTriangleWorkspace';
import {
  BUILD_FRAME, COUNT_TICKS, FORMULA_FRAME, LEG_LABELS, LEG_NAMES, MODEL_TRIANGLE, SIGN_FRAME, SLOPE_LEVERS, isPracticeItem,
  triangleModel, type TriangleModel,
} from './slopeTriangleLevers';
import { slopeTriangleBoss } from './slopeTriangle.boss';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Point {
  x: number;
  y: number;
  label?: string;
}

export interface SlopeTriangleConfig {
  position: Point;
  size: number;
  showMeasurements: boolean;
  showSlope: boolean;
  showAngle: boolean;
  notation: 'riseRun' | 'deltaNotation';
  color?: string;
  /** Tier-controlled measurement overlays (set by support tiers; absent = no-tier default). */
  showRiseRunLabels?: boolean; // numeric "rise = N"/"run = N" labels on the legs
  showGridCountOverlay?: boolean; // tick marks counting the rise/run grid units along each leg
  showFormulaReminder?: boolean; // "slope = rise ÷ run" reminder badge on the canvas
}

export interface AttachedLine {
  equation: string;
  slope: number;
  yIntercept: number;
  color?: string;
  label?: string;
}

export type SlopeTriangleChallengeType =
  | 'identify_slope'
  | 'calculate'
  | 'draw_triangle';

export interface SlopeTriangleChallenge {
  id: string;
  type: SlopeTriangleChallengeType;
  attachedLine: AttachedLine;
  triangle: SlopeTriangleConfig;
  expectedRise: number;
  expectedRun: number;
  expectedSlope: number;
  instruction: string;
  hint: string;
  /** Within-mode support tier, stamped per item by the generator (when the model lever comes; `SLOPE_LEVERS.support`). */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface SlopeTriangleData {
  title: string;
  description: string;
  xRange: [number, number];
  yRange: [number, number];
  gridSpacing?: { x: number; y: number };
  showAxes?: boolean;
  showGrid?: boolean;
  notation?: 'riseRun' | 'deltaNotation';
  gradeBand?: '7-8' | 'algebra-1' | 'algebra-2';
  challenges: SlopeTriangleChallenge[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SlopeTriangleMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<SlopeTriangleChallengeType, PhaseConfig> = {
  identify_slope: { label: 'Identify Slope', icon: '📐', accentColor: 'cyan' },
  calculate:      { label: 'Calculate',      icon: '🧮', accentColor: 'purple' },
  draw_triangle:  { label: 'Draw Triangle',  icon: '✏️', accentColor: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

interface SlopeTriangleProps {
  data: SlopeTriangleData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MAX_RUN = 8;
const useSlopeProgress = useWorkspaceProgressFor('slope-triangle');
const PRACTICE_NOTE = 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.';

/** The model_triangle lever's worked example: a different triangle, drawn to scale, with its caption. */
function ModelTriangleFigure({ model }: { model: TriangleModel }) {
  const unit = 120 / Math.max(model.run, Math.abs(model.rise));
  const w = model.run * unit, h = Math.abs(model.rise) * unit;
  const left = { x: 20, y: model.rise > 0 ? 20 + h : 20 };
  const corner = { x: 20 + w, y: left.y };
  const top = { x: corner.x, y: model.rise > 0 ? 20 : 20 + h };
  return (
    <figure data-lever="model-triangle" className="mx-auto w-64 rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
      <svg viewBox={`0 0 ${w + 40} ${h + 40}`} className="mx-auto h-28" role="img" aria-label="Example triangle on a different line">
        <line x1={left.x} y1={left.y} x2={top.x} y2={top.y} stroke="#a78bfa" strokeWidth={2.5} />
        <polygon points={`${left.x},${left.y} ${corner.x},${corner.y} ${top.x},${top.y}`} fill="#a78bfa33" stroke="#a78bfa" strokeWidth={1.5} />
      </svg>
      <figcaption className="text-xs text-violet-200">{model.caption}</figcaption>
    </figure>
  );
}

const SlopeTriangleSurface = ({ data, className, runtimePlanItemId }: SlopeTriangleProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    xRange,
    yRange,
    gridSpacing = { x: 1, y: 1 },
    showAxes = true,
    showGrid = true,
    gradeBand = 'algebra-1',
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `slope-triangle-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Challenge progression: the teaching workspace owns it.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useSlopeProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: slopeTriangleBoss.assignment!,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
  } = progress;
  /** A checked answer stays closed until Try again or the next item. */
  const blocked = progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  // In-item levers (`SLOPE_LEVERS`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const sessionChallenge = challenges[currentChallengeIndex] || null;
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SlopeTriangleChallenge | null>(null);
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** What is on screen: the easier item while a simplify lever holds it, else the session item, with the pulled aids on. */
  const shownChallenge = practice ?? sessionChallenge;
  const pulledKey = practice ? '' : pulledLevers.join(',');
  const currentChallenge = useMemo(() => {
    if (!shownChallenge) return null;
    const on = (id: string) => pulledKey.split(',').includes(id);
    const t = shownChallenge.triangle;
    return { ...shownChallenge, triangle: { ...t,
      showGridCountOverlay: !!t.showGridCountOverlay || on(COUNT_TICKS),
      showRiseRunLabels: !!(t.showRiseRunLabels ?? t.showMeasurements) || on(LEG_LABELS),
      showFormulaReminder: !!t.showFormulaReminder || on(FORMULA_FRAME) } };
  }, [shownChallenge, pulledKey]);
  const legNames = leverOn(LEG_NAMES);
  const challengeType = currentChallenge?.type ?? 'identify_slope';

  // -------------------------------------------------------------------------
  // Per-challenge UI state (reset on a fresh item and on Try again)
  // -------------------------------------------------------------------------
  /** The triangle: its left corner's x (on the line), its run, and (draw_triangle only, built by the learner) its rise. */
  const [trianglePos, setTrianglePos] = useState<{ x: number; size: number; rise: number }>(() => ({
    x: currentChallenge?.triangle.position.x ?? 0,
    size: currentChallenge?.triangle.size ?? 1,
    rise: 0,
  }));
  const [riseInput, setRiseInput] = useState('');
  const [runInput, setRunInput] = useState('');
  const [slopeInput, setSlopeInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [draggingHandle, setDraggingHandle] = useState<'base' | 'right' | 'top' | null>(null);

  const recordedRef = useRef(false);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas constants
  const padding = 50;
  const canvasWidth = 720;
  const canvasHeight = 540;

  /** The working surface back to the item's start: its triangle, empty boxes, no feedback. */
  const resetWork = (ch: SlopeTriangleChallenge | null) => {
    if (!ch) return;
    setTrianglePos({ x: ch.triangle.position.x, size: ch.triangle.size, rise: 0 });
    setRiseInput('');
    setRunInput('');
    setSlopeInput('');
    setFeedback('');
    setFeedbackType('');
    setDraggingHandle(null);
    recordedRef.current = false;
  };
  /** A fresh item or Try again. Try again on a practice item keeps it; a fresh item (or the full item back after
   *  practice) drops it. */
  openItem.current = (index, retry) => {
    if (!retry) setPractice(null);
    resetWork(retry && practice ? practice : challenges[index] ?? null);
  };

  // When the item on screen changes (a practice item comes or goes), its triangle starts over.
  useEffect(() => {
    resetWork(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  const work: SlopeWork = {
    rise: riseInput, run: runInput, slope: slopeInput, size: trianglePos.size, baseX: trianglePos.x, top: trianglePos.rise,
  };

  // -------------------------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------------------------
  const graphToCanvas = useCallback((x: number, y: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;
    const canvasX = padding + ((x - xRange[0]) / graphWidth) * effectiveWidth;
    const canvasY = canvasHeight - padding - ((y - yRange[0]) / graphHeight) * effectiveHeight;
    return { x: canvasX, y: canvasY };
  }, [xRange, yRange]);

  const canvasToGraph = useCallback((cx: number, cy: number): { x: number; y: number } => {
    const graphWidth = xRange[1] - xRange[0];
    const graphHeight = yRange[1] - yRange[0];
    const effectiveWidth = canvasWidth - 2 * padding;
    const effectiveHeight = canvasHeight - 2 * padding;
    const x = xRange[0] + ((cx - padding) / effectiveWidth) * graphWidth;
    const y = yRange[0] + ((canvasHeight - padding - cy) / effectiveHeight) * graphHeight;
    return { x, y };
  }, [xRange, yRange]);

  const evaluateLine = useCallback((slope: number, yIntercept: number, x: number): number => {
    return slope * x + yIntercept;
  }, []);

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { attachedLine, triangle } = currentChallenge;
    const slope = attachedLine.slope;
    const yIntercept = attachedLine.yIntercept;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = Math.ceil(xRange[0] / gridSpacing.x) * gridSpacing.x; x <= xRange[1]; x += gridSpacing.x) {
        const { x: cx } = graphToCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(cx, padding);
        ctx.lineTo(cx, canvasHeight - padding);
        ctx.stroke();
      }
      for (let y = Math.ceil(yRange[0] / gridSpacing.y) * gridSpacing.y; y <= yRange[1]; y += gridSpacing.y) {
        const { y: cy } = graphToCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(padding, cy);
        ctx.lineTo(canvasWidth - padding, cy);
        ctx.stroke();
      }
    }

    // Axes
    if (showAxes) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 2;
      const { y: xAxisY } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(padding, xAxisY);
      ctx.lineTo(canvasWidth - padding, xAxisY);
      ctx.stroke();
      const { x: yAxisX } = graphToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(yAxisX, padding);
      ctx.lineTo(yAxisX, canvasHeight - padding);
      ctx.stroke();

      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x += gridSpacing.x) {
        if (x === 0) continue;
        const { x: cx, y: cy } = graphToCanvas(x, 0);
        ctx.fillText(x.toString(), cx, cy + 16);
      }
      for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y += gridSpacing.y) {
        if (y === 0) continue;
        const { x: cx, y: cy } = graphToCanvas(0, y);
        ctx.fillText(y.toString(), cx - 18, cy);
      }
    }

    // Line
    ctx.strokeStyle = attachedLine.color || '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let firstPoint = true;
    const step = (xRange[1] - xRange[0]) / 400;
    for (let x = xRange[0]; x <= xRange[1]; x += step) {
      const y = evaluateLine(slope, yIntercept, x);
      if (y < yRange[0] || y > yRange[1]) {
        firstPoint = true;
        continue;
      }
      const { x: cx, y: cy } = graphToCanvas(x, y);
      if (firstPoint) { ctx.moveTo(cx, cy); firstPoint = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Triangle
    const x1 = trianglePos.x;
    const x2 = trianglePos.x + trianglePos.size;
    const y1 = evaluateLine(slope, yIntercept, x1);
    // A built triangle's top corner is where the learner put it; a read triangle's sits on the line.
    const building = challengeType === 'draw_triangle';
    const y2 = building ? y1 + trianglePos.rise : evaluateLine(slope, yIntercept, x2);
    const basePoint = graphToCanvas(x1, y1);
    const topPoint = graphToCanvas(x2, y2);
    const rightPoint = graphToCanvas(x2, y1);
    const triangleColor = triangle.color || '#10b981';

    ctx.strokeStyle = triangleColor;
    ctx.fillStyle = `${triangleColor}33`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(basePoint.x, basePoint.y);
    ctx.lineTo(rightPoint.x, rightPoint.y);
    ctx.lineTo(topPoint.x, topPoint.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right angle marker
    const angleSize = 10;
    const yDir = y2 >= y1 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(rightPoint.x - angleSize, rightPoint.y);
    ctx.lineTo(rightPoint.x - angleSize, rightPoint.y + yDir * angleSize);
    ctx.lineTo(rightPoint.x, rightPoint.y + yDir * angleSize);
    ctx.stroke();

    const rise = y2 - y1;
    const run = trianglePos.size;
    const notation = triangle.notation || 'riseRun';

    // leg_names lever: the words rise and run on their legs. No number, no direction.
    if (legNames) {
      ctx.fillStyle = '#c4b5fd';
      ctx.font = 'italic 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('run', (basePoint.x + rightPoint.x) / 2, rightPoint.y + (yDir > 0 ? -16 : 16));
      ctx.fillText('rise', rightPoint.x + 24, (rightPoint.y + topPoint.y) / 2);
    }

    // Grid-count overlay (tick marks counting each rise/run grid unit along the
    // legs). A perception aid the student COUNTS — never prints the answer value.
    // Tier-gated via showGridCountOverlay (absent = off; no-tier path unchanged).
    if (triangle.showGridCountOverlay) {
      ctx.strokeStyle = `${triangleColor}cc`;
      ctx.lineWidth = 1.5;
      const tick = 5;
      // Run leg (horizontal, along base → right corner): a tick per grid unit.
      for (let u = 1; u <= Math.abs(run); u++) {
        const ux = basePoint.x + ((rightPoint.x - basePoint.x) * u) / Math.abs(run);
        ctx.beginPath();
        ctx.moveTo(ux, rightPoint.y - tick);
        ctx.lineTo(ux, rightPoint.y + tick);
        ctx.stroke();
      }
      // Rise leg (vertical, along right corner → top corner): a tick per grid unit.
      const riseUnits = Math.abs(Math.round(rise));
      for (let u = 1; u <= riseUnits; u++) {
        const uy = rightPoint.y + ((topPoint.y - rightPoint.y) * u) / riseUnits;
        ctx.beginPath();
        ctx.moveTo(rightPoint.x - tick, uy);
        ctx.lineTo(rightPoint.x + tick, uy);
        ctx.stroke();
      }
    }

    // Numeric rise/run (Δy/Δx) labels. The label VALUE equals the answer for
    // identify_slope, so the generator never sets showRiseRunLabels for that
    // mode. No-tier path falls back to the legacy showMeasurements flag.
    const showLabels = triangle.showRiseRunLabels ?? triangle.showMeasurements;
    if (showLabels) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const runLabel = notation === 'deltaNotation' ? `Δx = ${run}` : `run = ${run}`;
      const riseLabel = notation === 'deltaNotation' ? `Δy = ${rise}` : `rise = ${rise}`;
      ctx.fillText(runLabel, (basePoint.x + rightPoint.x) / 2, rightPoint.y + (yDir > 0 ? -18 : 18));
      ctx.save();
      ctx.translate(rightPoint.x + 28, (rightPoint.y + topPoint.y) / 2);
      ctx.fillText(riseLabel, 0, 0);
      ctx.restore();
    }

    // Formula reminder badge ("slope = rise ÷ run"). Tier-gated self-check cue.
    if (triangle.showFormulaReminder) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = `${triangleColor}88`;
      ctx.lineWidth = 1;
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const reminder = notation === 'deltaNotation' ? 'slope = Δy ÷ Δx' : 'slope = rise ÷ run';
      const padX = 8;
      const w = ctx.measureText(reminder).width + padX * 2;
      const bx = padding + 6;
      const by = padding + 6;
      ctx.beginPath();
      ctx.rect(bx, by, w, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(reminder, bx + padX, by + 11);
    }

    // Drag handles: both corners are draggable in draw_triangle only.
    const showHandles = challengeType === 'draw_triangle';
    if (showHandles) {
      ctx.fillStyle = triangleColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(basePoint.x, basePoint.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rightPoint.x, rightPoint.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(topPoint.x, topPoint.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }, [
    currentChallenge,
    trianglePos,
    xRange,
    yRange,
    gridSpacing,
    showAxes,
    showGrid,
    challengeType,
    evaluateLine,
    graphToCanvas,
    legNames,
  ]);

  // -------------------------------------------------------------------------
  // Building the triangle (draw_triangle): drag a corner, or the step buttons.
  // -------------------------------------------------------------------------
  const isCurrentComplete =
    challenges.length > 0 &&
    !!challengeResults.find((r) => r.challengeId === currentChallenge?.id)?.correct;
  const buildOpen = challengeType === 'draw_triangle' && !!currentChallenge && !isCurrentComplete && !blocked;

  /** Move the whole triangle along the line (its left corner), keeping its run, inside the grid. */
  const moveTo = (x: number) => {
    const newX = Math.max(xRange[0], Math.min(xRange[1] - trianglePos.size, x));
    if (newX !== trianglePos.x) SoundManager.tick(); // barely-there click per grid unit crossed
    setTrianglePos((prev) => ({ ...prev, x: newX }));
  };
  /** Size the run with the right corner: whole grid steps, 1 to 8, inside the grid. */
  const sizeTo = (size: number) => {
    const newSize = Math.max(1, Math.min(MAX_RUN, xRange[1] - trianglePos.x, size));
    if (newSize !== trianglePos.size) SoundManager.tick();
    setTrianglePos((prev) => ({ ...prev, size: newSize }));
  };
  /** Raise or lower the top corner: whole grid steps, at most the grid's height. */
  const riseTo = (rise: number) => {
    if (!currentChallenge) return;
    const span = yRange[1] - yRange[0];
    const newRise = Math.max(-span, Math.min(span, rise));
    if (newRise !== trianglePos.rise) SoundManager.tick();
    setTrianglePos((prev) => ({ ...prev, rise: newRise }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!buildOpen || learnerBlocked() || !currentChallenge) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvasWidth / rect.width);
    const cy = (e.clientY - rect.top) * (canvasHeight / rect.height);
    const slope = currentChallenge.attachedLine.slope;
    const yIntercept = currentChallenge.attachedLine.yIntercept;
    const x1 = trianglePos.x;
    const x2 = trianglePos.x + trianglePos.size;
    const y1 = evaluateLine(slope, yIntercept, x1);
    const base = graphToCanvas(x1, y1);
    const right = graphToCanvas(x2, y1);
    const distBase = Math.hypot(cx - base.x, cy - base.y);
    const distRight = Math.hypot(cx - right.x, cy - right.y);
    const top = graphToCanvas(x2, y1 + trianglePos.rise);
    const distTop = Math.hypot(cx - top.x, cy - top.y);
    if (distBase < 18) setDraggingHandle('base');
    else if (distTop < 18 && trianglePos.rise !== 0) setDraggingHandle('top');
    else if (distRight < 18) setDraggingHandle('right');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingHandle || !currentChallenge || learnerBlocked()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvasWidth / rect.width);
    const cy = (e.clientY - rect.top) * (canvasHeight / rect.height);
    const graph = canvasToGraph(cx, cy);
    const roundedX = Math.round(graph.x);
    if (draggingHandle === 'base') moveTo(roundedX);
    else if (draggingHandle === 'top') {
      const y1 = evaluateLine(currentChallenge.attachedLine.slope, currentChallenge.attachedLine.yIntercept, trianglePos.x);
      riseTo(Math.round(graph.y - y1));
    } else sizeTo(roundedX - trianglePos.x);
  };

  const handleMouseUp = () => {
    if (draggingHandle) SoundManager.snap(); // handle lands in place
    setDraggingHandle(null);
  };
  const handleMouseLeave = () => setDraggingHandle(null);

  // -------------------------------------------------------------------------
  // Evaluation Hook
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
  } = usePrimitiveEvaluation<SlopeTriangleMetrics>({
    primitiveType: 'slope-triangle',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // The check. Every complete Check commits, right or wrong, through the progress
  // hook (counts the attempt, records the verdict, names the miss).
  // -------------------------------------------------------------------------
  const commit = useCallback((correct: boolean, w: SlopeWork) => {
    if (!currentChallenge) return;
    const attempts = currentAttempts + 1;
    progress.commitCheck(describeSlopeWork(currentChallenge, w), correct, slopeTriangleMiss(currentChallenge, w));
    // An easier practice item (a simplify lever) is not the session's challenge: it records nothing of its own.
    if (correct && !recordedRef.current && !isPracticeItem(currentChallenge)) {
      // Standard per-challenge score (PRD §6a #11): 100 first try, -20 per extra, floor 20.
      recordedRef.current = true;
      mergeResult({ challengeId: currentChallenge.id, correct: true, attempts, score: Math.max(20, 100 - (attempts - 1) * 20) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, currentAttempts, mergeResult, progress.commitCheck]);

  const handleSubmitIdentifySlope = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || recordedRef.current || learnerBlocked()) return;
    const rise = parseFloat(riseInput);
    const run = parseFloat(runInput);
    if (!Number.isFinite(rise) || !Number.isFinite(run)) {
      setFeedback('Enter both rise and run.');
      setFeedbackType('error');
      return;
    }
    const correct =
      Math.abs(rise - currentChallenge.expectedRise) < 0.01 &&
      Math.abs(run - currentChallenge.expectedRun) < 0.01;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! Rise = ${currentChallenge.expectedRise}, Run = ${currentChallenge.expectedRun}.`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Count the grid units carefully.`);
      setFeedbackType('error');
    }
    commit(correct, work);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, hasSubmittedEvaluation, riseInput, runInput, commit]);

  const handleSubmitCalculate = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || recordedRef.current || learnerBlocked()) return;
    if (!slopeInput.trim()) {
      setFeedback('Enter the slope value.');
      setFeedbackType('error');
      return;
    }
    const parsed = parseSlope(slopeInput);
    if (parsed == null) {
      setFeedback('Enter a whole number, a decimal, or a fraction written a/b.');
      setFeedbackType('error');
      return;
    }
    const correct = Math.abs(parsed - currentChallenge.expectedSlope) < 0.01;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! Slope = ${currentChallenge.expectedSlope}.`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Slope = rise ÷ run.`);
      setFeedbackType('error');
    }
    commit(correct, work);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, hasSubmittedEvaluation, slopeInput, commit]);

  const handleSubmitDrawTriangle = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || recordedRef.current || learnerBlocked()) return;
    // The left corner sits on the line by construction; the triangle fits when its top corner lands back on the line:
    // its rise over its run is the line's slope (`drawCorrect`). Any run that gives a whole-step rise counts.
    const correct = drawCorrect(currentChallenge, trianglePos.size, trianglePos.rise);
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`The top corner is on the line: rise ${trianglePos.rise} over run ${trianglePos.size}.`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite: the top corner is not on the line yet.');
      setFeedbackType('error');
    }
    commit(correct, work);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, hasSubmittedEvaluation, trianglePos, commit]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count corrections and whose
  // evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || submittedRef.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const total = challenges.length;
    submitEvaluation(result.passed, result.accuracy, {
      type: 'slope-triangle',
      challengeType: (challenges[0]?.type ?? 'identify_slope') as SlopeTriangleMetrics['challengeType'],
      totalChallenges: total,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / total) * 10) / 10,
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // What the tutor and the observer are shown, republished every render.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { work });
    const levers = practice ? [] : SLOPE_LEVERS.declare(sessionChallenge, null, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : SLOPE_LEVERS.support(sessionChallenge, null),
      onScreen: practice ? '' : SLOPE_LEVERS.onScreen(sessionChallenge, null, pulledLevers),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = SLOPE_LEVERS.simpler(sessionChallenge, null, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(easier);
          return { practice: slopeTriangleBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(sessionChallenge); },
    };
  });

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No slope-triangle challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const notation = currentChallenge.triangle.notation;
  const model = leverOn(MODEL_TRIANGLE) && sessionChallenge ? triangleModel(sessionChallenge) : null;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {practice && <LuminaBadge accent="amber" className="text-xs uppercase tracking-wider">Practice</LuminaBadge>}
            <LuminaBadge accent="emerald" className="text-xs">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
            />
          </div>
        </div>
        <LuminaPrompt className="mt-2" center>
          {currentChallenge.instruction}
        </LuminaPrompt>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Equation banner: the slope is masked where the item asks for what it gives */}
        <LuminaPanel className="flex items-center justify-center gap-3 py-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Line</span>
          <span className="text-lg font-mono font-bold text-blue-300">{lineLabel(currentChallenge)}</span>
        </LuminaPanel>

        {/* Progress dots — bespoke pedagogical done/active/pending indicator */}
        <div className="flex items-center justify-center gap-1.5">
          {challenges.map((ch, idx) => {
            const result = challengeResults.find((r) => r.challengeId === ch.id);
            const isActive = idx === currentChallengeIndex;
            const isDone = !!result?.correct;
            return (
              <div
                key={ch.id}
                className={`h-2 rounded-full transition-all ${
                  isDone
                    ? 'w-6 bg-emerald-400/80'
                    : isActive
                    ? 'w-8 bg-green-400/80'
                    : 'w-2 bg-slate-600/60'
                }`}
              />
            );
          })}
        </div>

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the grid and the answer panel
            as one region. */}
        {!allChallengesComplete && <PipDock />}
        <PipWorkspace className="space-y-4">
          {/* Canvas — bespoke interaction surface (painting) */}
          <div className="p-3 bg-slate-800/30 rounded-2xl border border-green-500/20">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className={`rounded-lg w-full ${challengeType === 'draw_triangle' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
            />
          </div>

          {/* Lever frames and the worked triangle (`slopeTriangleLevers.ts`), on the session item only */}
          {leverOn(SIGN_FRAME) && (
            <p data-lever="sign-frame" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
              From the left corner, a rise that goes up is positive and one that goes down is negative. The run counts to the right, so it is positive.
            </p>
          )}
          {leverOn(FORMULA_FRAME) && (
            <p data-lever="formula-frame" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
              Slope = {notation === 'deltaNotation' ? 'Δy ÷ Δx' : 'rise ÷ run'}: the up-or-down leg goes on top, the across leg underneath. A line that falls from left to right has a negative slope.
            </p>
          )}
          {leverOn(BUILD_FRAME) && (
            <p data-lever="build-frame" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
              The top corner lands back on the line when the rise is the slope times the run. For a line that falls from left to right, the top corner goes below the right angle. Rise + and Rise − move the top corner.
            </p>
          )}
          {model && <ModelTriangleFigure model={model} />}

          {/* Answer panel — varies by challenge type */}
          {!isCurrentComplete && !allChallengesComplete && (
            <LuminaPanel className="space-y-3">
              {challengeType === 'identify_slope' && (
                <>
                  <p className="text-slate-300 text-sm font-medium">
                    Read the triangle off the grid:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <label className="flex items-center gap-2 text-slate-300 text-sm">
                      <span className="text-green-300 font-mono">{notation === 'deltaNotation' ? 'Δy =' : 'rise ='}</span>
                      <LuminaInput
                        type="number"
                        aria-label="Rise"
                        value={riseInput}
                        disabled={blocked}
                        onChange={(e) => { if (!learnerBlocked()) setRiseInput(e.target.value); }}
                        className="w-20 py-1.5 text-center"
                        placeholder="?"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 text-sm">
                      <span className="text-green-300 font-mono">{notation === 'deltaNotation' ? 'Δx =' : 'run ='}</span>
                      <LuminaInput
                        type="number"
                        aria-label="Run"
                        value={runInput}
                        disabled={blocked}
                        onChange={(e) => { if (!learnerBlocked()) setRunInput(e.target.value); }}
                        className="w-20 py-1.5 text-center"
                        placeholder="?"
                      />
                    </label>
                    <LuminaActionButton action="check" onClick={handleSubmitIdentifySlope} disabled={blocked}>
                      Check
                    </LuminaActionButton>
                  </div>
                </>
              )}

              {challengeType === 'calculate' && (
                <>
                  <p className="text-slate-300 text-sm font-medium">
                    Slope = rise ÷ run. What is the slope?
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="text-purple-300 font-mono font-bold">m =</span>
                    <LuminaInput
                      type="text"
                      aria-label="Slope"
                      value={slopeInput}
                      disabled={blocked}
                      onChange={(e) => { if (!learnerBlocked()) setSlopeInput(e.target.value); }}
                      className="w-28 py-1.5 text-center"
                      placeholder="?"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitCalculate()}
                    />
                    <LuminaActionButton action="check" onClick={handleSubmitCalculate} disabled={blocked}>
                      Check
                    </LuminaActionButton>
                  </div>
                </>
              )}

              {challengeType === 'draw_triangle' && (
                <>
                  <p className="text-slate-300 text-sm font-medium">
                    Build a slope triangle on the line: drag the left corner along the line, size the run with the right corner, then raise or lower the top corner until it lands back on the line.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                    <LuminaButton tone="subtle" size="sm" aria-label="Move left" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) moveTo(trianglePos.x - 1); }}>← Move</LuminaButton>
                    <LuminaButton tone="subtle" size="sm" aria-label="Move right" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) moveTo(trianglePos.x + 1); }}>Move →</LuminaButton>
                    <LuminaButton tone="subtle" size="sm" aria-label="Shorter run" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) sizeTo(trianglePos.size - 1); }}>Run −</LuminaButton>
                    <LuminaButton tone="subtle" size="sm" aria-label="Longer run" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) sizeTo(trianglePos.size + 1); }}>Run +</LuminaButton>
                    <LuminaButton tone="subtle" size="sm" aria-label="Lower rise" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) riseTo(trianglePos.rise - 1); }}>Rise −</LuminaButton>
                    <LuminaButton tone="subtle" size="sm" aria-label="Higher rise" disabled={!buildOpen}
                      onClick={() => { if (!learnerBlocked()) riseTo(trianglePos.rise + 1); }}>Rise +</LuminaButton>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <span className="text-slate-400">Current:</span>
                    <span className="text-green-300 font-mono">run = {trianglePos.size}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-green-300 font-mono">rise = {trianglePos.rise}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-cyan-300 font-mono">base x = {trianglePos.x}</span>
                    <LuminaActionButton action="check" onClick={handleSubmitDrawTriangle} disabled={blocked}>
                      Check
                    </LuminaActionButton>
                  </div>
                </>
              )}
            </LuminaPanel>
          )}
        </PipWorkspace>

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
            durationMs={elapsedMs}
            heading="All Slope Triangles Done!"
            celebrationMessage={`You completed all ${challenges.length} slope-triangle challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const SlopeTriangle = withWorkspaceOnly<SlopeTriangleProps>('slope-triangle', SlopeTriangleSurface, props => props.data.title);

export default SlopeTriangle;
