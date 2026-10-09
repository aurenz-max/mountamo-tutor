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
  LuminaInput,
  LuminaPrompt,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PolygonAreaBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { useLiveRuntime } from '../../../components/live-activity/runtime/LiveRuntimeContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import { areaMiss, describeAreaWork, workspaceAssignment, workspaceScene, type PolygonAreaView } from './polygonAreaWorkspace';
import {
  EDGES_LEVER, NUMBERS_LEVER, PIECES_LEVER, SMALLER_LEVER, SMALLER_PERIMETER_LEVER, TURNED_LEVER, buildAreaLevers,
  buildAreaMiss, buildAreaVerdict, buildLeverFacts, buildPerimeterLeverFacts, buildPerimeterLevers, buildPerimeterMiss,
  buildPerimeterVerdict, cellKey, connectedParts, describeBuild, describePerimeterBuild, holesIn, isBuildPerimeter,
  isGridBuild, outsideSides, smallerArea, smallerPerimeter, turnedToMatch, type Cell,
} from './polygonAreaBuild';
import { AreaBuildGrid, AreaShapeThumb } from './AreaBuildGrid';
import {
  CUT_LEVER, GRID_LEVER, HALF_LEVER, LEFT_OUT_LEVER, OUTSIDE_LEVER, ROWS_LEVER, SIMPLER_FIGURE_LEVERS, SLIDE_LEVER, SLOT_LEVER,
  SPLIT_LEVER, TURNED_COPY_LEVER, figureLeverFacts, figureLevers, figureOverlay, leftOutPieces, overlayPoints, smallerFigure,
} from './polygonAreaLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PolygonAreaChallengeType =
  | 'decompose'
  | 'find_area_triangle_parallelogram'
  | 'find_area_trapezoid'
  | 'composite_area'
  | 'coordinate_polygon'
  /** Open build: shade squares on an empty grid into one shape with a stated area (`polygonAreaBuild.ts`). */
  | 'build_area'
  /** Open build: shade squares on an empty grid into one shape with a stated perimeter (`polygonAreaBuild.ts`). */
  | 'build_perimeter';

export type PolygonFigureType =
  | 'triangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'composite'
  | 'coordinate'
  /** build_area: the empty grid the learner builds on. */
  | 'grid';

/** An axis-aligned rectangle piece of a composite figure (figure units, y-up). */
export interface CompositeRect {
  x: number; // left edge
  y: number; // bottom edge
  w: number; // width
  h: number; // height
}

export interface PolygonVertex {
  x: number;
  y: number;
}

export interface PolygonAreaChallenge {
  id: string;
  type: PolygonAreaChallengeType;
  figureType: PolygonFigureType;
  /** Short real-world framing (e.g. "A sail is shaped like this triangle."). Always present. */
  narration: string;
  /** What the student should do this challenge. */
  instruction: string;
  hint: string;
  /** Linear unit label (e.g. "cm", "m", "units"). Area is shown in <unit>². */
  unitLabel: string;

  // --- Triangle / parallelogram / trapezoid dimensions (figure units) ---
  base?: number;       // triangle base, parallelogram base, trapezoid bottom base
  base2?: number;      // trapezoid top base
  height?: number;     // perpendicular height
  apexX?: number;      // triangle apex x-position along the base (visual)
  skew?: number;       // parallelogram top-left horizontal offset (>=1, < base)
  topOffset?: number;  // trapezoid top-left horizontal offset

  // --- Composite figure (decompose into known rectangles) ---
  parts?: CompositeRect[];

  // --- Coordinate polygon ---
  vertices?: PolygonVertex[];

  /** Pre-computed correct area (single source of truth). On build_area it equals `targetArea`; on build_perimeter it
   *  holds the stated perimeter `targetPerimeter` (the item's one key number; there is no area to find). */
  expectedArea: number;

  // --- Open builds (build_area, build_perimeter) ---
  /** The area to make, in unit squares. Stated in the instruction: it IS the task. */
  targetArea?: number;
  /** build_perimeter: the perimeter to make, in units (even, 8-24). Stated in the instruction: it IS the task. */
  targetPerimeter?: number;
  /** 1: one shape. 2: one shape, then a different shape with the same area (or perimeter). */
  shapesAsked?: 1 | 2;

  // --- Support-tier scaffolds (set in post-process when config.difficulty present) ---
  /** Show the dashed decomposition guidelines: the cut-triangle target slot
   *  (decompose), the pre-split rectangle pieces vs. a single union outline
   *  (composite), or the bounding-box / cut overlay (trapezoid / coordinate).
   *  Withdrawn at hard so the student chooses the decomposition. */
  showDecompositionGuides?: boolean;
  /** Worked per-region area sub-label on the FIRST composite piece only
   *  (easy). Leak-guarded: never the full set, so it can't sum to the answer. */
  showRegionAreaLabel?: boolean;
  /** Faint unit grid behind triangle / parallelogram / trapezoid figures so the
   *  student can count squares to self-check (easy). */
  showGridOverlay?: boolean;
  /** The student's support tier — read by the AI tutor to calibrate reveal. */
  supportTier?: 'easy' | 'medium' | 'hard';
}

export interface PolygonAreaBuilderData {
  title: string;
  description: string;
  challengeType: PolygonAreaChallengeType;
  /** '3' on an open-build session (3.MD.C), else the formula grades. */
  gradeBand?: '3' | '6' | '7';
  /** 3-6 challenges per session. Required. Built by the generator's pool service. */
  challenges: PolygonAreaChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PolygonAreaBuilderMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<PolygonAreaChallengeType, PhaseConfig> = {
  decompose:                       { label: 'Decompose',   icon: '✂️', accentColor: 'purple' },
  find_area_triangle_parallelogram:{ label: 'Tri / Para',  icon: '📐', accentColor: 'cyan' },
  find_area_trapezoid:             { label: 'Trapezoid',   icon: '🔷', accentColor: 'blue' },
  composite_area:                  { label: 'Composite',   icon: '🧩', accentColor: 'amber' },
  coordinate_polygon:              { label: 'Coordinate',  icon: '🗺️', accentColor: 'emerald' },
  build_area:                      { label: 'Build It',    icon: '🟦', accentColor: 'cyan' },
  build_perimeter:                 { label: 'Perimeter',   icon: '🔲', accentColor: 'cyan' },
};

// ============================================================================
// Canvas constants
// ============================================================================

const CANVAS_W = 560;
const CANVAS_H = 400;
const PAD = 56;
const GRID_COLOR = 'rgba(100, 116, 139, 0.3)';
const FIG_STROKE = '#22d3ee';
const FIG_FILL = 'rgba(34, 211, 238, 0.14)';
const PART_FILLS = ['rgba(168, 85, 247, 0.18)', 'rgba(245, 158, 11, 0.18)', 'rgba(16, 185, 129, 0.18)'];
const SNAP_TOLERANCE = 0.35; // figure units — how close the cut triangle must be to snap

// ============================================================================
// Support-tier tutor reveal clause
// ============================================================================
// The live tutor sees the full challenge (including expectedArea), so a tier
// that hides decomposition cues on the canvas must also calibrate what the tutor
// will reveal — otherwise the tutor leaks what the tier withheld.
const tierTutorClause = (tier?: 'easy' | 'medium' | 'hard'): string => {
  switch (tier) {
    case 'easy':
      return ' SUPPORT TIER EASY: you may name how to decompose the figure — point to where to cut it, name the formula, and walk the student through each region step by step.';
    case 'medium':
      return ' SUPPORT TIER MEDIUM: the decomposition is shown on screen — nudge the student\'s execution (which formula, what to multiply), but do not solve it for them.';
    case 'hard':
      return ' SUPPORT TIER HARD: the decomposition guidelines are withdrawn — do NOT name how to split the shape or give any per-region sub-area; ask the student how the figure could be broken into shapes they know, and NEVER reveal the total area.';
    default:
      return '';
  }
};

// ============================================================================
// Geometry helpers
// ============================================================================

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function shoelaceArea(vertices: PolygonVertex[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function getBounds(ch: PolygonAreaChallenge): Bounds {
  const b = ch.base ?? 1;
  const h = ch.height ?? 1;
  switch (ch.figureType) {
    case 'triangle': {
      const apex = ch.apexX ?? b / 2;
      return { minX: Math.min(0, apex), maxX: Math.max(b, apex), minY: 0, maxY: h };
    }
    case 'parallelogram': {
      const s = ch.skew ?? 1;
      // x range covers the cut-triangle's full travel: [0, base + skew]
      return { minX: 0, maxX: b + s, minY: 0, maxY: h };
    }
    case 'trapezoid': {
      const b2 = ch.base2 ?? b;
      const off = ch.topOffset ?? (b - b2) / 2;
      return { minX: Math.min(0, off), maxX: Math.max(b, off + b2), minY: 0, maxY: h };
    }
    case 'composite': {
      const parts = ch.parts ?? [];
      if (parts.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of parts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + p.w);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + p.h);
      }
      return { minX, maxX, minY, maxY };
    }
    case 'coordinate': {
      const vs = ch.vertices ?? [];
      if (vs.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
      let maxX = -Infinity, maxY = -Infinity;
      for (const v of vs) {
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
      // Always anchor the coordinate grid at the origin.
      return { minX: 0, maxX: Math.ceil(maxX), minY: 0, maxY: Math.ceil(maxY) };
    }
    case 'grid':
    default:
      // build_area draws its own svg grid (AreaBuildGrid), never the canvas.
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }
}

interface Mapper {
  toCanvas: (fx: number, fy: number) => { x: number; y: number };
  scale: number;
}

function makeMapper(bounds: Bounds): Mapper {
  const fw = bounds.maxX - bounds.minX || 1;
  const fh = bounds.maxY - bounds.minY || 1;
  const usableW = CANVAS_W - 2 * PAD;
  const usableH = CANVAS_H - 2 * PAD;
  const scale = Math.min(usableW / fw, usableH / fh);
  const offX = PAD + (usableW - scale * fw) / 2;
  const offY = PAD + (usableH - scale * fh) / 2;
  const toCanvas = (fx: number, fy: number) => ({
    x: offX + (fx - bounds.minX) * scale,
    y: CANVAS_H - offY - (fy - bounds.minY) * scale,
  });
  return { toCanvas, scale };
}

function pointInTriangle(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// ============================================================================
// Component
// ============================================================================

interface PolygonAreaBuilderProps {
  data: PolygonAreaBuilderData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const PolygonAreaBuilderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  PolygonAreaBuilderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<PolygonAreaChallenge>) => Progress }) => {
  const {
    title,
    description,
    gradeBand = '6',
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // Multi-challenge progression. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  const liveRuntime = useLiveRuntime();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceIdRef = useRef(instanceId || `polygon-area-builder-${Date.now()}`);
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
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current
    || (!!liveRuntime && !['empty', 'active'].includes(liveRuntime.getSnapshot().status));

  // Levers (`polygonAreaBuild.ts` for the open build, `polygonAreaLevers.ts` for the typed-area modes), keyed by the
  // session item they were pulled on, and the easier item a simplify lever put on screen in its place. A pull never
  // comes from the tier: a tier's grid or guides are a starting position. `left`: the composite pieces the learner's
  // last area left out, fixed when `left_out_piece` was pulled.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[]; left?: number[] }>({ item: '', pulled: [] });
  /** composite_area: the pieces the last checked area left out, when it was one piece's area (read by `left_out_piece`). */
  const lastLeftOut = useRef<{ item: string; left: number[] } | null>(null);
  const [practice, setPractice] = useState<PolygonAreaChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier build while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const challengeType = currentChallenge?.type ?? 'find_area_triangle_parallelogram';
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leftOut = leverState.item === sessionChallenge?.id ? leverState.left ?? [] : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  /** The figure levers pulled on the item on screen (none on a practice item); a stable key for the canvas effect. */
  const figurePulled = practice ? '' : `${pulledLevers.join(',')}|${leftOut.join(',')}`;
  const pulledNowList = practice ? [] : pulledLevers;
  /** What the pulled figure levers draw on the item on screen. */
  const overlay = useMemo(() => currentChallenge ? figureOverlay(currentChallenge, pulledNowList, leftOut) : null,
    [currentChallenge, figurePulled]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  const [areaInput, setAreaInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);

  // Decompose interaction: drag the cut triangle to the empty slot.
  const [dragOffset, setDragOffset] = useState(0); // figure units, 0..base
  const [rearranged, setRearranged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; offset: number } | null>(null);

  // Open build: the shaded squares in the order shaded, and on a two-shape item the first shape once it was checked
  // right (keyed by the item on screen, so a practice build has its own).
  const [cells, setCells] = useState<Cell[]>([]);
  const [firstShape, setFirstShape] = useState<{ item: string; cells: Cell[] } | null>(null);
  const isBuild = isGridBuild(currentChallenge);
  /** The perimeter build (`build_perimeter`): the same grid, its own check, levers and facts. */
  const isPerimeter = isBuildPerimeter(currentChallenge);
  const firstNow = isBuild && currentChallenge?.shapesAsked === 2 && firstShape?.item === currentChallenge.id
    ? firstShape.cells : null;

  // Bumped by a ResizeObserver so the canvas re-renders crisply when its
  // displayed size changes (the backing store is sized to the rendered px).
  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // -------------------------------------------------------------------------
  // Coordinate mapping (stable per challenge)
  // -------------------------------------------------------------------------
  /** The figure's bounds, grown to fit what a pulled lever draws (the turned trapezoid copy reaches past the figure). */
  const figureBounds = useMemo((): Bounds => {
    if (!currentChallenge) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const b = getBounds(currentChallenge);
    for (const p of overlayPoints(overlay)) {
      b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x); b.minY = Math.min(b.minY, p.y); b.maxY = Math.max(b.maxY, p.y);
    }
    return b;
  }, [currentChallenge, overlay]);
  const mapper = useMemo(() => makeMapper(figureBounds), [figureBounds]);
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  const resetItem = () => {
    setAreaInput('');
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setDragOffset(0);
    setRearranged(false);
    setDragging(false);
    setCells([]);
    dragStartRef.current = null;
    recordedRef.current = false;
    hintViewedRef.current = false;
  };
  useEffect(() => {
    if (!currentChallenge) return;
    resetItem();
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Workspace path: a fresh challenge starts clean in the same render the runtime opens it (so the scene it publishes
  // is final), and drops a practice build. Try again keeps the decompose rectangle and the open build's squares and
  // verdict (the learner revises the build); it clears a typed area.
  openItem.current = (retry) => {
    if (!retry) { resetItem(); setPractice(null); return; }
    if (isGridBuild(currentChallenge)) return;
    setAreaInput('');
    setFeedback('');
    setFeedbackType('');
  };

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size the backing store to the actual displayed size × devicePixelRatio so
    // the canvas isn't a 560×400 bitmap stretched (and blurred) to a wider box.
    // All drawing stays in the logical CANVAS_W×CANVAS_H space; the transform
    // maps it onto the high-resolution backing store.
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

    const { toCanvas } = mapper;
    const unit = currentChallenge.unitLabel;

    const drawDimLabel = (
      fx: number, fy: number, text: string, dx = 0, dy = 0, color = '#e2e8f0',
    ) => {
      const p = toCanvas(fx, fy);
      ctx.fillStyle = color;
      ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p.x + dx, p.y + dy);
    };

    const strokePolygon = (pts: Array<{ x: number; y: number }>, fill: string, stroke: string) => {
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const c = toCanvas(pt.x, pt.y);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };

    const dashedHeight = (fx: number, topY: number, botY: number, label: string) => {
      const top = toCanvas(fx, topY);
      const bot = toCanvas(fx, botY);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(bot.x, bot.y);
      ctx.stroke();
      ctx.restore();
      // small right-angle tick at the foot
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      const tick = 8;
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y - tick);
      ctx.lineTo(bot.x + tick, bot.y - tick);
      ctx.lineTo(bot.x + tick, bot.y);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, top.x + 8, (top.y + bot.y) / 2);
    };

    const b = currentChallenge.base ?? 1;
    const h = currentChallenge.height ?? 1;

    // ---- Support-tier scaffolds (legacy-preserving defaults) ----
    // When no tier is present these fields are undefined and resolve to the
    // pre-tier behavior: decompose/composite ALWAYS showed their guidelines, the
    // coordinate/trapezoid bounding-box overlay and the ungridded grid are NEW
    // and opt-in (default off).
    const guidesShown = currentChallenge.showDecompositionGuides ?? true; // decompose/composite legacy = shown
    const overlayOptIn = currentChallenge.showDecompositionGuides === true; // coord/trap overlay only when explicitly on
    const regionAreaShown = currentChallenge.showRegionAreaLabel === true;
    const pulledNow = pulledNowList;
    const gridOverlayShown = currentChallenge.showGridOverlay === true || pulledNow.includes(GRID_LEVER);

    // ---- Optional self-check grid behind ungridded figures (easy tier) ----
    if (
      gridOverlayShown
      && (currentChallenge.figureType === 'triangle'
        || currentChallenge.figureType === 'parallelogram'
        || currentChallenge.figureType === 'trapezoid')
    ) {
      const bounds = figureBounds;
      ctx.save();
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      for (let gx = Math.floor(bounds.minX); gx <= Math.ceil(bounds.maxX); gx++) {
        const a = toCanvas(gx, bounds.minY);
        const c = toCanvas(gx, bounds.maxY);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      for (let gy = Math.floor(bounds.minY); gy <= Math.ceil(bounds.maxY); gy++) {
        const a = toCanvas(bounds.minX, gy);
        const c = toCanvas(bounds.maxX, gy);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---- Unit grid (composite + coordinate modes) ----
    if (currentChallenge.figureType === 'composite' || currentChallenge.figureType === 'coordinate') {
      const bounds = getBounds(currentChallenge);
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
        const a = toCanvas(gx, bounds.minY);
        const c = toCanvas(gx, bounds.maxY);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
        const a = toCanvas(bounds.minX, gy);
        const c = toCanvas(bounds.maxX, gy);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      // Axis tick labels for coordinate mode
      if (currentChallenge.figureType === 'coordinate') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
          const p = toCanvas(gx, bounds.minY);
          ctx.fillText(String(gx), p.x, p.y + 6);
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
          const p = toCanvas(bounds.minX, gy);
          ctx.fillText(String(gy), p.x - 8, p.y);
        }
      }
    }

    // ---- Figure by type ----
    if (currentChallenge.figureType === 'triangle') {
      const apex = currentChallenge.apexX ?? b / 2;
      strokePolygon(
        [{ x: 0, y: 0 }, { x: b, y: 0 }, { x: apex, y: h }],
        FIG_FILL, FIG_STROKE,
      );
      dashedHeight(apex, h, 0, `${h} ${unit}`);
      drawDimLabel(b / 2, 0, `${b} ${unit}`, 0, 22);
    } else if (currentChallenge.figureType === 'parallelogram') {
      const s = currentChallenge.skew ?? 1;
      if (challengeType === 'decompose') {
        // Fixed remaining quad: [(s,0),(b,0),(b+s,h),(s,h)]
        strokePolygon(
          [{ x: s, y: 0 }, { x: b, y: 0 }, { x: b + s, y: h }, { x: s, y: h }],
          FIG_FILL, FIG_STROKE,
        );
        // Target slot outline (where the triangle needs to go) — the
        // decomposition guideline. Withdrawn at the hard tier.
        if (guidesShown || pulledNow.includes(SLOT_LEVER)) {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.lineWidth = 1.5;
          const t0 = toCanvas(b, 0);
          const t1 = toCanvas(b + s, 0);
          const t2 = toCanvas(b + s, h);
          ctx.beginPath();
          ctx.moveTo(t0.x, t0.y);
          ctx.lineTo(t1.x, t1.y);
          ctx.lineTo(t2.x, t2.y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
        // Movable cut triangle: [(0,0),(s,0),(s,h)] translated by dragOffset
        const off = dragOffset;
        strokePolygon(
          [{ x: off, y: 0 }, { x: s + off, y: 0 }, { x: s + off, y: h }],
          rearranged ? FIG_FILL : 'rgba(168, 85, 247, 0.30)',
          rearranged ? FIG_STROKE : '#a855f7',
        );
        if (rearranged) {
          // Completed rectangle — reveal base/height labels
          dashedHeight(s, h, 0, `${h} ${unit}`);
          drawDimLabel((s + b + s) / 2, 0, `${b} ${unit}`, 0, 22);
        }
      } else {
        // Static parallelogram for find-area modes
        strokePolygon(
          [{ x: 0, y: 0 }, { x: b, y: 0 }, { x: b + s, y: h }, { x: s, y: h }],
          FIG_FILL, FIG_STROKE,
        );
        dashedHeight(s, h, 0, `${h} ${unit}`);
        drawDimLabel(b / 2, 0, `${b} ${unit}`, 0, 22);
      }
    } else if (currentChallenge.figureType === 'trapezoid') {
      const b2 = currentChallenge.base2 ?? b;
      const off = currentChallenge.topOffset ?? (b - b2) / 2;
      strokePolygon(
        [{ x: 0, y: 0 }, { x: b, y: 0 }, { x: off + b2, y: h }, { x: off, y: h }],
        FIG_FILL, FIG_STROKE,
      );
      // Easy-tier decomposition overlay: drop faint cut lines from the top-base
      // corners to split the trapezoid into a rectangle + corner triangles.
      if (overlayOptIn || pulledNow.includes(CUT_LEVER)) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        for (const fx of [off, off + b2]) {
          const t = toCanvas(fx, h);
          const bt = toCanvas(fx, 0);
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(bt.x, bt.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      dashedHeight(off, h, 0, `${h} ${unit}`);
      drawDimLabel(b / 2, 0, `${b} ${unit}`, 0, 22);      // bottom base b1
      drawDimLabel(off + b2 / 2, h, `${b2} ${unit}`, 0, -16); // top base b2
    } else if (currentChallenge.figureType === 'composite') {
      const parts = currentChallenge.parts ?? [];
      if (guidesShown || pulledNow.includes(SPLIT_LEVER)) {
        // EASY / MEDIUM: the decomposition is GIVEN — each rectangle piece is
        // drawn and dimension-labelled. easy additionally shows ONE piece's
        // worked area as a model. (Leak guard: only the FIRST piece, so the
        // shown sub-area never sums to the asked total.)
        parts.forEach((p, i) => {
          strokePolygon(
            [
              { x: p.x, y: p.y },
              { x: p.x + p.w, y: p.y },
              { x: p.x + p.w, y: p.y + p.h },
              { x: p.x, y: p.y + p.h },
            ],
            PART_FILLS[i % PART_FILLS.length], FIG_STROKE,
          );
          // label each piece's width (top) and height (left)
          drawDimLabel(p.x + p.w / 2, p.y + p.h, `${p.w}`, 0, -12, '#cbd5e1');
          drawDimLabel(p.x, p.y + p.h / 2, `${p.h}`, -12, 0, '#cbd5e1');
          // worked area on the FIRST piece only (easy)
          if (regionAreaShown && i === 0) {
            drawDimLabel(p.x + p.w / 2, p.y + p.h / 2, `= ${p.w * p.h}`, 0, 0, '#a855f7');
          }
        });
      } else {
        // HARD: render the L-shaped UNION outline only — the student decides
        // where to cut. Outer-edge dimension labels stay so the area is still
        // computable (removing them would change the task, not the support).
        const bounds = getBounds(currentChallenge);
        const W = bounds.maxX - bounds.minX;
        const H = bounds.maxY - bounds.minY;
        const bottom = parts.find((p) => p.y === bounds.minY) ?? parts[0];
        const top = parts.find((p) => p !== bottom) ?? parts[parts.length - 1];
        // Walk the L outline. Bottom rect spans the full width; the top rect sits
        // on one side. Build the 6-point boundary from the two stacked rects.
        const leftAligned = top.x === bottom.x;
        const pts = leftAligned
          ? [
              { x: bottom.x, y: bottom.y },
              { x: bottom.x + bottom.w, y: bottom.y },
              { x: bottom.x + bottom.w, y: bottom.y + bottom.h },
              { x: top.x + top.w, y: top.y },
              { x: top.x + top.w, y: top.y + top.h },
              { x: top.x, y: top.y + top.h },
            ]
          : [
              { x: bottom.x, y: bottom.y },
              { x: bottom.x + bottom.w, y: bottom.y },
              { x: top.x + top.w, y: top.y + top.h },
              { x: top.x, y: top.y + top.h },
              { x: top.x, y: top.y },
              { x: bottom.x, y: bottom.y + bottom.h },
            ];
        strokePolygon(pts, FIG_FILL, FIG_STROKE);
        // Outer overall width (bottom) and height (the taller side)
        drawDimLabel(bounds.minX + W / 2, bounds.minY, `${W}`, 0, 22, '#cbd5e1');
        const tallSideX = leftAligned ? bounds.minX : bounds.maxX;
        drawDimLabel(tallSideX, bounds.minY + H / 2, `${H}`, leftAligned ? -14 : 14, 0, '#cbd5e1');
        // The notch dimensions (so the L is fully determined)
        drawDimLabel(top.x + top.w / 2, top.y + top.h, `${top.w}`, 0, -12, '#cbd5e1');
        drawDimLabel(leftAligned ? top.x + top.w : top.x, top.y + top.h / 2, `${top.h}`, leftAligned ? 14 : -14, 0, '#cbd5e1');
      }
    } else if (currentChallenge.figureType === 'coordinate') {
      const vs = currentChallenge.vertices ?? [];
      // Easy-tier decomposition overlay: faint bounding box around the polygon
      // to suggest the rectangle / triangle decomposition.
      if (overlayOptIn && vs.length >= 3) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const v of vs) {
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
        ctx.lineWidth = 1.25;
        const c0 = toCanvas(minX, minY);
        const c1 = toCanvas(maxX, maxY);
        ctx.strokeRect(
          Math.min(c0.x, c1.x), Math.min(c0.y, c1.y),
          Math.abs(c1.x - c0.x), Math.abs(c1.y - c0.y),
        );
        ctx.restore();
      }
      strokePolygon(vs, FIG_FILL, FIG_STROKE);
      // vertex dots + coordinate labels
      vs.forEach((v) => {
        const p = toCanvas(v.x, v.y);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${v.x}, ${v.y})`, p.x + 7, p.y - 5);
      });
    }
    // ---- Pulled figure lever: the shape the figure is part of or becomes, tinted pieces, rows of squares, bold pieces.
    // It draws outlines and tints only; the figure's own givens stay the only numbers on the canvas.
    if (overlay) {
      const path = (pts: Array<{ x: number; y: number }>) => {
        ctx.beginPath();
        pts.forEach((pt, i) => { const c = toCanvas(pt.x, pt.y); if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y); });
        ctx.closePath();
      };
      ctx.save();
      for (const r of overlay.rows) {
        if (r.row % 2) continue;
        path(r.cells);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
        ctx.fill();
      }
      for (const piece of overlay.tinted) {
        path(piece);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.30)';
        ctx.fill();
      }
      for (const piece of overlay.outlined) {
        path(piece);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      if (overlay.moved) {
        path(overlay.moved);
        ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
        ctx.fill();
        ctx.strokeStyle = '#a855f7';
        ctx.stroke();
      }
      if (overlay.rectangle.length) {
        path(overlay.rectangle);
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [currentChallenge, challengeType, mapper, figureBounds, overlay, dragOffset, rearranged, resizeTick, figurePulled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw crisply when the canvas's displayed size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Decompose drag handlers (canvas)
  // -------------------------------------------------------------------------
  const canvasPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (challengeType !== 'decompose' || rearranged || !currentChallenge || learnerBlocked()) return;
    const pt = canvasPointFromEvent(e);
    if (!pt) return;
    const s = currentChallenge.skew ?? 1;
    const h = currentChallenge.height ?? 1;
    const { toCanvas } = mapperRef.current;
    const off = dragOffset;
    const a = toCanvas(off, 0);
    const bb = toCanvas(s + off, 0);
    const c = toCanvas(s + off, h);
    if (pointInTriangle(pt.x, pt.y, a.x, a.y, bb.x, bb.y, c.x, c.y)) {
      setDragging(true);
      dragStartRef.current = { mouseX: pt.x, offset: off };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !dragStartRef.current || !currentChallenge) return;
    const pt = canvasPointFromEvent(e);
    if (!pt) return;
    const b = currentChallenge.base ?? 1;
    const { scale } = mapperRef.current;
    const deltaUnits = (pt.x - dragStartRef.current.mouseX) / scale;
    const next = Math.max(0, Math.min(b, dragStartRef.current.offset + deltaUnits));
    setDragOffset(next);
    if (b - next <= SNAP_TOLERANCE) {
      setDragOffset(b);
      setRearranged(true);
      setDragging(false);
      dragStartRef.current = null;
      SoundManager.snap();
      setFeedback('Same area — now it’s a rectangle! What is base × height?');
      setFeedbackType('info');
      sendText(
        `[DECOMPOSE_DONE] Student slid the cut triangle over and formed a rectangle from the parallelogram. `
        + `Reinforce conservation of area: the shape changed but the amount of space did not. Now ask for base × height.`,
        { silent: true },
      );
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragStartRef.current = null;
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
  } = usePrimitiveEvaluation<PolygonAreaBuilderMetrics>({
    primitiveType: 'polygon-area-builder',
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
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    figureType: currentChallenge?.figureType ?? 'triangle',
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    base: currentChallenge?.base ?? null,
    base2: currentChallenge?.base2 ?? null,
    height: currentChallenge?.height ?? null,
    expectedArea: currentChallenge?.expectedArea ?? null,
    unitLabel: currentChallenge?.unitLabel ?? 'units',
    gradeBand,
    attemptNumber: currentAttempts + 1,
    supportTier: currentChallenge?.supportTier,
  }), [
    challengeType,
    currentChallenge,
    currentChallengeIndex,
    challenges.length,
    gradeBand,
    currentAttempts,
  ]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'polygon-area-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: `Grade ${gradeBand}`,
    // The workspace packet replaces this context (it carries expectedArea).
    enabled: !tutorOwned,
  });
  // The scripted tags never reach the tutor on the workspace path: it is told facts, not cues.
  const sendText = useCallback((text: string, options?: { silent?: boolean }) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Polygon area session: ${challenges.length} figures, mode "${challengeType}", grade ${gradeBand}. `
      + `Introduce briefly: every polygon's area comes from base × height — we'll find each one. Then read the first figure's task.`
      + tierTutorClause(currentChallenge?.supportTier),
      { silent: true },
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, sendText, currentChallenge]);

  // -------------------------------------------------------------------------
  // Submit handler (handler-driven with stale-state guard)
  // -------------------------------------------------------------------------
  const completeChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge || practice) return; // an easier practice build records nothing
    if (!correct) return; // wait for a correct attempt before recording
    if (recordedRef.current) return;
    recordedRef.current = true;
    const attempts = currentAttempts + 1;
    const score = Math.max(20, 100 - (attempts - 1) * 20);
    recordResult({
      challengeId: currentChallenge.id,
      correct: true,
      attempts,
      score,
    });
  }, [currentChallenge, currentAttempts, recordResult, practice]);

  const handleCheckArea = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || learnerBlocked()) return;
    if (challengeType === 'decompose' && !rearranged) {
      SoundManager.invalid();
      setFeedback('First slide the cut triangle across to form the rectangle.');
      setFeedbackType('error');
      return;
    }
    const trimmed = areaInput.trim();
    if (!trimmed) {
      setFeedback('Enter the area.');
      setFeedbackType('error');
      return;
    }
    let parsed: number;
    if (trimmed.includes('/')) {
      const [num, den] = trimmed.split('/').map((s) => parseFloat(s.trim()));
      parsed = (Number.isFinite(num) && Number.isFinite(den) && den !== 0) ? num / den : NaN;
    } else {
      parsed = parseFloat(trimmed);
    }
    if (!Number.isFinite(parsed)) {
      setFeedback('Enter a number (e.g. 24 or 22.5).');
      setFeedbackType('error');
      return;
    }
    const unit = currentChallenge.unitLabel;
    const correct = Math.abs(parsed - currentChallenge.expectedArea) < 0.01;
    const left = correct || practice ? null : leftOutPieces(currentChallenge, parsed);
    lastLeftOut.current = left ? { item: currentChallenge.id, left } : null;
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(
      describeAreaWork(currentChallenge, { areaInput, rearranged, cells: [], firstShape: null, practice: false }),
      correct, correct ? undefined : areaMiss(currentChallenge, parsed));
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! Area = ${currentChallenge.expectedArea} ${unit}².`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student found area = ${currentChallenge.expectedArea} ${unit}² for the ${currentChallenge.figureType}. `
        + `Celebrate briefly and reinforce the method used.`,
        { silent: true },
      );
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Check your formula and units, then try again.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${parsed} but area = ${currentChallenge.expectedArea} ${unit}² `
        + `for a ${currentChallenge.figureType} (base ${currentChallenge.base ?? '-'}, height ${currentChallenge.height ?? '-'}). `
        + `Attempt ${currentAttempts + 1}. Point at the specific step that needs another look — do NOT give the answer.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, challengeType, rearranged, areaInput,
    progress, completeChallenge, currentAttempts, sendText,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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
        `[NEXT_ITEM] Figure ${nextIdx + 1} of ${challenges.length}: a ${next?.figureType}. `
        + `Introduce briefly: "Here's the next figure — same idea, new shape."`
        + tierTutorClause(next?.supportTier),
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session complete — build metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    // The workspace path submits the scored session from `onFinished` (below), not this tally.
    if (tutorOwned || !allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
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

    const metrics: PolygonAreaBuilderMetrics = {
      type: 'polygon-area-builder',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'find_area_triangle_parallelogram') as PolygonAreaBuilderMetrics['challengeType'],
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
      `[ALL_COMPLETE] All ${total} figures done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give an encouraging, area-focused summary.`,
      { silent: true },
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, currentChallenge, submitEvaluation, sendText, tutorOwned]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count corrections
  // and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || submittedRef.current || progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const total = challenges.length;
    const metrics: PolygonAreaBuilderMetrics = {
      type: 'polygon-area-builder',
      challengeType: (challenges[0]?.type ?? 'find_area_triangle_parallelogram') as PolygonAreaBuilderMetrics['challengeType'],
      totalChallenges: total,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: challengeResults.filter((r) => r.correct && r.attempts === 1).length,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / Math.max(total, 1)) * 10) / 10,
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // Open build (build_area): the grid, the live line, the commit
  // -------------------------------------------------------------------------
  const gridRef = useRef<SVGSVGElement | null>(null);
  const buildSolved = isBuild && challengeResults.some((r) => r.challengeId === currentChallenge?.id && r.correct);
  const buildOpen = isBuild && !buildSolved && !hasSubmittedEvaluation
    && !(tutorOwned && progress.canAttempt === false);
  // The live line (shared build layer): what the shape looks like so far, NEVER a number — counting the squares (or the
  // sides around them) is the task. On the perimeter build `made` says whether it is one shape and whether it has a hole,
  // the two things the picture alone can mislead on; no number.
  const perimeterPieces = isPerimeter ? connectedParts(cells).length : 0;
  const buildSeeing = useBuildWatcher({
    buildKey: `${firstNow ? 2 : 1}:${cells.map(cellKey).sort().join('|')}`,
    enabled: buildOpen && cells.length > 0,
    svg: gridRef,
    request: isPerimeter
      ? { task: currentChallenge?.instruction ?? '', numbers: 'never',
        sceneNote: 'A square grid. Each shaded square is a square the learner shaded; each side of a square is one unit long.',
        made: `${perimeterPieces > 1 ? 'separate pieces of shaded squares' : 'one shape of shaded squares'}`
          + `${holesIn(cells) > 0 ? ' with a hole inside it' : ''}` }
      : { task: currentChallenge?.instruction ?? '',
        sceneNote: 'A square grid. Each shaded square is one square unit the learner shaded.', numbers: 'never' },
  });

  const toggleCell = (cell: Cell) => {
    if (!buildOpen || learnerBlocked()) return;
    SoundManager.tap();
    setCells((prev) => prev.some((x) => x.c === cell.c && x.r === cell.r)
      ? prev.filter((x) => x.c !== cell.c || x.r !== cell.r) : [...prev, cell]);
  };

  const clearGrid = () => {
    if (!buildOpen || learnerBlocked()) return;
    setCells([]);
  };

  /**
   * "I'm done!": the check counts the squares, that they make one shape, and on the second shape that it differs. A right
   * first shape of a two-shape item is not a commit: it is kept, drawn beside the grid, and left on the grid to change.
   * Every other check commits, so a miss reaches the tutor and the levers; Try again keeps the build.
   */
  const doneBuilding = () => {
    if (!currentChallenge || !isBuild || !buildOpen || learnerBlocked()) return;
    const target = isPerimeter
      ? currentChallenge.targetPerimeter ?? currentChallenge.expectedArea
      : currentChallenge.targetArea ?? currentChallenge.expectedArea;
    const miss = isPerimeter ? buildPerimeterMiss(target, cells, firstNow) : buildAreaMiss(target, cells, firstNow);
    if (currentChallenge.shapesAsked === 2 && !firstNow && !miss) {
      SoundManager.snap();
      setFirstShape({ item: currentChallenge.id, cells: [...cells] });
      setFeedback(isPerimeter
        ? `Yes, that shape has a perimeter of ${target} units. Now change it into a different shape with the same perimeter.`
        : `Yes, that shape has an area of ${target} squares. Now change it into a different shape with the same area.`);
      setFeedbackType('success');
      return;
    }
    progress.commitCheck(isPerimeter ? describePerimeterBuild(cells, firstNow) : describeBuild(cells, firstNow), !miss, miss);
    setFeedback(isPerimeter
      ? buildPerimeterVerdict(target, miss as Parameters<typeof buildPerimeterVerdict>[1], cells, !!firstNow)
      : buildAreaVerdict(target, miss as Parameters<typeof buildAreaVerdict>[1], cells, !!firstNow));
    setFeedbackType(miss ? 'error' : 'success');
    if (miss) { SoundManager.playIncorrect(); return; }
    SoundManager.playCorrect();
    completeChallenge(true);
  };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation. Only the open build declares levers.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { areaInput, rearranged, cells, firstShape: firstNow, practice: !!practice });
    const build = isGridBuild(sessionChallenge);
    const perimeter = isBuildPerimeter(sessionChallenge);
    const onScreen = practice ? '' : perimeter ? buildPerimeterLeverFacts(sessionChallenge, pulledLevers)
      : build ? buildLeverFacts(sessionChallenge, pulledLevers) : figureLeverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : perimeter ? buildPerimeterLevers(sessionChallenge, pulledLevers)
      : build ? buildAreaLevers(sessionChallenge, pulledLevers) : figureLevers(sessionChallenge, pulledLevers);
    if (!build && !practice && !levers.length) { workspace.current = { ...scene }; return; }
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the grid changes before this returns.
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id], left: leftOut };
        if (SIMPLER_FIGURE_LEVERS.includes(id)) {
          const smaller = smallerFigure(sessionChallenge);
          if (!smaller) return 'This figure has no simpler version; try a help lever.';
          setLeverState(pulled); setAreaInput(''); setFeedback(''); setFeedbackType(''); setShowHint(false);
          setDragOffset(0); setRearranged(false); setPractice(smaller);
          return { practice: workspaceAssignment(smaller) };
        }
        if (id === SLOT_LEVER && rearranged) return 'The cut triangle is already in its slot; the rectangle is made.';
        if (id === LEFT_OUT_LEVER) {
          const last = lastLeftOut.current;
          if (!last || last.item !== sessionChallenge.id) {
            return "The learner's last area was not the area of one piece, so there is no left-out piece to outline.";
          }
          setLeverState({ ...pulled, left: last.left });
          return true;
        }
        if (id === SMALLER_LEVER || id === SMALLER_PERIMETER_LEVER) {
          const easier = id === SMALLER_LEVER ? smallerArea(sessionChallenge) : smallerPerimeter(sessionChallenge);
          if (!easier) return 'This item has no easier shape; try a help lever.';
          setLeverState(pulled); setCells([]); setFirstShape(null); setFeedback(''); setFeedbackType(''); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        if (id === TURNED_LEVER && !firstNow) return 'There is no first shape yet: the learner makes it first.';
        setLeverState(pulled);
        return true;
      },
      // The full item comes back blank: an empty grid, an empty answer box.
      endPractice: () => {
        setCells([]); setFirstShape(null); setAreaInput(''); setFeedback(''); setFeedbackType('');
        setDragOffset(0); setRearranged(false); setPractice(null);
      },
    };
  });

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
    label: 'The polygon workspace',
    solved: isCurrentComplete,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No polygon-area challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const unit = currentChallenge.unitLabel;
  const needsRearrangeFirst = challengeType === 'decompose' && !rearranged;
  const checkClosed = tutorOwned && progress.canAttempt === false;
  // The piece-colours lever: each shaded square's piece, so separate pieces read apart.
  const pieceOf = leverOn(PIECES_LEVER)
    ? new Map(connectedParts(cells).flatMap((part, i) => part.map((x) => [cellKey(x), i] as [string, number])))
    : null;
  const turned = firstNow && leverOn(TURNED_LEVER) ? turnedToMatch(firstNow, cells) : null;

  return (
    <LuminaCard className={['shadow-2xl', className].filter(Boolean).join(' ')}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">
              {`Grade ${gradeBand}`}
            </LuminaBadge>
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
        </LuminaPanel>

        {/* Progress dots — bespoke tri-state (done / active / pending) indicator. */}
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
        {isBuild ? (
          /* Open build — the empty grid the learner shades, one square per tap. No count and no target beside it. */
          <div className="p-3 bg-slate-800/30 rounded-2xl border border-cyan-500/20 space-y-3">
            <div className="flex flex-wrap items-start justify-center gap-4">
              <AreaBuildGrid ref={gridRef} cells={cells} numbers={!isPerimeter && leverOn(NUMBERS_LEVER)} pieces={pieceOf}
                edges={isPerimeter && leverOn(EDGES_LEVER) ? outsideSides(cells) : null}
                disabled={!buildOpen} onToggle={toggleCell} />
              {firstNow && (
                <div className="flex flex-col items-center gap-1 text-xs text-slate-400">
                  <span>{turned ? 'Your first shape, turned to match' : 'Your first shape'}</span>
                  <AreaShapeThumb cells={turned ?? firstNow} label="Your first shape" lever={!!turned} />
                </div>
              )}
            </div>
            <p className="text-slate-500 text-xs text-center">Tap a square to shade it. Tap a shaded square to clear it.</p>
            <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
              {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
            </div>
            {!isCurrentComplete && !allChallengesComplete && (
              <div className="flex justify-center gap-3">
                <LuminaButton tone="subtle" size="sm" onClick={clearGrid} disabled={!buildOpen || cells.length === 0}>
                  Clear grid
                </LuminaButton>
                {/* "I'm done!" commits through the check; there is no auto-check on stillness. */}
                <LuminaButton tone="primary" onClick={doneBuilding} disabled={!buildOpen || cells.length === 0}>
                  I&apos;m done!
                </LuminaButton>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Canvas — bespoke interaction surface (drag-to-decompose). Left as painting. */}
        <div className="p-3 bg-slate-800/30 rounded-2xl border border-cyan-500/20">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`rounded-lg w-full ${
              challengeType === 'decompose' && !rearranged ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          />
          {/* What a pulled figure lever drew, said in words for the screen reader and the probes. Never a number. */}
          {leverOn(GRID_LEVER) && !currentChallenge.showGridOverlay && (
            <p data-lever="unit-grid" className="text-center text-xs text-slate-400 mt-2">
              Each square of the grid is one square {unit}.
            </p>
          )}
          {currentChallenge.figureType === 'triangle' && leverOn(HALF_LEVER) && (
            <p data-lever="half-of-rectangle" className="text-center text-xs text-amber-200/90 mt-2">
              The dashed rectangle has the same base and height as the triangle. Each tinted piece matches a piece of the triangle.
            </p>
          )}
          {currentChallenge.figureType === 'parallelogram' && leverOn(SLIDE_LEVER) && (
            <p data-lever="slide-corner" className="text-center text-xs text-purple-200/90 mt-2">
              Slide the tinted corner to the other end: the parallelogram becomes the dashed rectangle, with the same base and height.
            </p>
          )}
          {challengeType === 'decompose' && leverOn(SLOT_LEVER) && (
            <p data-lever="show-slot" className="text-center text-xs text-slate-400 mt-2">
              The dashed slot shows where the cut triangle fits.
            </p>
          )}
          {currentChallenge.figureType === 'trapezoid' && leverOn(CUT_LEVER) && (
            <p data-lever="cut-lines" className="text-center text-xs text-slate-400 mt-2">
              The dashed lines run straight down from the top corners.
            </p>
          )}
          {currentChallenge.figureType === 'trapezoid' && leverOn(TURNED_COPY_LEVER) && (
            <p data-lever="turned-copy" className="text-center text-xs text-purple-200/90 mt-2">
              A copy of the trapezoid, turned upside down, sits against it. Together they make the dashed parallelogram.
            </p>
          )}
          {currentChallenge.figureType === 'composite' && leverOn(SPLIT_LEVER) && (
            <p data-lever="split-pieces" className="text-center text-xs text-slate-400 mt-2">
              The figure is split into its rectangle pieces.
            </p>
          )}
          {currentChallenge.figureType === 'composite' && leverOn(LEFT_OUT_LEVER) && (
            <p data-lever="left-out-piece" className="text-center text-xs text-amber-200/90 mt-2">
              The bold outline marks the part your last answer left out.
            </p>
          )}
          {leverOn(ROWS_LEVER) && (
            <p data-lever="square-rows" className="text-center text-xs text-emerald-200/90 mt-2">
              Every other row of squares is tinted.
            </p>
          )}
          {currentChallenge.figureType === 'coordinate' && leverOn(OUTSIDE_LEVER) && (
            <p data-lever="outside-box" className="text-center text-xs text-purple-200/90 mt-2">
              The dashed rectangle goes around the polygon. The tinted part is outside the polygon.
            </p>
          )}
          {challengeType === 'decompose' && !rearranged && (
            <p className="text-center text-xs text-purple-300/80 mt-2">
              Drag the purple triangle across into the dashed slot to form a rectangle.
            </p>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <LuminaPanel>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-cyan-300 font-mono font-bold">Area =</span>
              <LuminaInput
                type="text"
                aria-label="Area"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                disabled={needsRearrangeFirst || checkClosed}
                className="w-28 text-center"
                placeholder="?"
                onKeyDown={(e) => e.key === 'Enter' && handleCheckArea()}
              />
              <span className="text-slate-400 text-sm font-mono">{unit}&sup2;</span>
              <LuminaButton
                tone="primary"
                onClick={handleCheckArea}
                disabled={needsRearrangeFirst || checkClosed}
              >
                Check
              </LuminaButton>
            </div>
          </LuminaPanel>
        )}
        </>
        )}

        </div>

        {/* Feedback — on the open build the verdict's words stay on screen until the next check. */}
        {feedback && feedbackType === 'success' && (
          <LuminaFeedbackCard status="correct">{feedback}</LuminaFeedbackCard>
        )}
        {feedback && feedbackType === 'error' && (
          <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>
        )}
        {feedback && feedbackType === 'info' && (
          <LuminaFeedbackCard status="insight">{feedback}</LuminaFeedbackCard>
        )}

        {/* Hint — revealed by the "Show hint" control below (tracks hintsViewed). */}
        {showHint && (
          <LuminaPrompt accent="amber">
            <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
            {currentChallenge.hint}
          </LuminaPrompt>
        )}

        {/* Controls. On the workspace path the runtime advances, so there is no Next. */}
        <div className="flex justify-center gap-2 flex-wrap">
          {!tutorOwned && isCurrentComplete && !allChallengesComplete && (
            <LuminaButton
              tone="primary"
              className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              onClick={advanceChallenge}
            >
              Next Figure →
            </LuminaButton>
          )}
          {!isCurrentComplete && !allChallengesComplete && (
            <LuminaButton
              tone="subtle"
              size="sm"
              onClick={handleShowHint}
              disabled={showHint}
            >
              {showHint ? 'Hint shown' : 'Show hint'}
            </LuminaButton>
          )}
        </div>

        {/* Phase summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="All Areas Found!"
            celebrationMessage={`You completed all ${challenges.length} polygon-area challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never registers a scripted cue; the runtime owns progression.
const PolygonAreaBuilder = withWorkspaceController<PolygonAreaBuilderProps, ProgressOptions<PolygonAreaChallenge>, Progress>(
  'polygon-area-builder', PolygonAreaBuilderSurface, useScriptedProgress, useWorkspaceProgressFor('polygon-area-builder'));

export default PolygonAreaBuilder;
