'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PolygonAreaBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PolygonAreaChallengeType =
  | 'decompose'
  | 'find_area_triangle_parallelogram'
  | 'find_area_trapezoid'
  | 'composite_area'
  | 'coordinate_polygon';

export type PolygonFigureType =
  | 'triangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'composite'
  | 'coordinate';

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

  /** Pre-computed correct area (single source of truth). */
  expectedArea: number;
}

export interface PolygonAreaBuilderData {
  title: string;
  description: string;
  challengeType: PolygonAreaChallengeType;
  gradeBand?: '6' | '7';
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
}

const PolygonAreaBuilder: React.FC<PolygonAreaBuilderProps> = ({ data, className }) => {
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
  // Multi-challenge progression
  // -------------------------------------------------------------------------
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

  const currentChallenge = challenges[currentChallengeIndex] ?? null;
  const challengeType = currentChallenge?.type ?? 'find_area_triangle_parallelogram';

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

  // Bumped by a ResizeObserver so the canvas re-renders crisply when its
  // displayed size changes (the backing store is sized to the rendered px).
  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `polygon-area-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // -------------------------------------------------------------------------
  // Coordinate mapping (stable per challenge)
  // -------------------------------------------------------------------------
  const mapper = useMemo(() => {
    if (!currentChallenge) return makeMapper({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
    return makeMapper(getBounds(currentChallenge));
  }, [currentChallenge]);
  const mapperRef = useRef(mapper);
  mapperRef.current = mapper;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setAreaInput('');
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setDragOffset(0);
    setRearranged(false);
    setDragging(false);
    dragStartRef.current = null;
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Target slot outline (where the triangle needs to go)
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
      dashedHeight(off, h, 0, `${h} ${unit}`);
      drawDimLabel(b / 2, 0, `${b} ${unit}`, 0, 22);      // bottom base b1
      drawDimLabel(off + b2 / 2, h, `${b2} ${unit}`, 0, -16); // top base b2
    } else if (currentChallenge.figureType === 'composite') {
      const parts = currentChallenge.parts ?? [];
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
      });
    } else if (currentChallenge.figureType === 'coordinate') {
      const vs = currentChallenge.vertices ?? [];
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
  }, [currentChallenge, challengeType, mapper, dragOffset, rearranged, resizeTick]);

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
    if (challengeType !== 'decompose' || rearranged || !currentChallenge) return;
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
  }), [
    challengeType,
    currentChallenge,
    currentChallengeIndex,
    challenges.length,
    gradeBand,
    currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'polygon-area-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '7' ? 'Grade 7' : 'Grade 6',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Polygon area session: ${challenges.length} figures, mode "${challengeType}", grade ${gradeBand}. `
      + `Introduce briefly: every polygon's area comes from base × height — we'll find each one. Then read the first figure's task.`,
      { silent: true },
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, sendText]);

  // -------------------------------------------------------------------------
  // Submit handler (handler-driven with stale-state guard)
  // -------------------------------------------------------------------------
  const completeChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge) return;
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
  }, [currentChallenge, currentAttempts, recordResult]);

  const handleCheckArea = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
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
    incrementAttempts();
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
    incrementAttempts, completeChallenge, currentAttempts, sendText,
  ]);

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
        + `Introduce briefly: "Here's the next figure — same idea, new shape."`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session complete — build metrics and submit exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0) return;
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
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, currentChallenge, submitEvaluation, sendText]);

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
  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardContent className="p-6 text-center text-slate-400">
          No polygon-area challenges in this session.
        </CardContent>
      </Card>
    );
  }

  const unit = currentChallenge.unitLabel;
  const needsRearrangeFirst = challengeType === 'decompose' && !rearranged;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
              {gradeBand === '7' ? 'Grade 7' : 'Grade 6'}
            </Badge>
            <span className="text-slate-500 text-xs">
              {Math.min(currentChallengeIndex + 1, challenges.length)} / {challenges.length}
            </span>
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Narration + instruction */}
        <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5 space-y-1">
          {currentChallenge.narration && (
            <p className="text-slate-300 text-sm italic">{currentChallenge.narration}</p>
          )}
          <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
        </div>

        {/* Progress dots */}
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

        {/* Canvas */}
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
          {challengeType === 'decompose' && !rearranged && (
            <p className="text-center text-xs text-purple-300/80 mt-2">
              Drag the purple triangle across into the dashed slot to form a rectangle.
            </p>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <div className="bg-slate-800/20 rounded-lg p-4 border border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-cyan-300 font-mono font-bold">Area =</span>
              <input
                type="text"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                disabled={needsRearrangeFirst}
                className="w-28 px-3 py-1.5 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-center focus:outline-none focus:border-cyan-400/50 disabled:opacity-40"
                placeholder="?"
                onKeyDown={(e) => e.key === 'Enter' && handleCheckArea()}
              />
              <span className="text-slate-400 text-sm font-mono">{unit}&sup2;</span>
              <Button
                variant="ghost"
                className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20"
                onClick={handleCheckArea}
                disabled={needsRearrangeFirst}
              >
                Check
              </Button>
            </div>
          </div>
        )}

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

        {/* Hint */}
        {showHint && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-amber-200 text-sm">
              <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
              {currentChallenge.hint}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2 flex-wrap">
          {isCurrentComplete && !allChallengesComplete && (
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceChallenge}
            >
              Next Figure →
            </Button>
          )}
          {!isCurrentComplete && !allChallengesComplete && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400"
              onClick={handleShowHint}
              disabled={showHint}
            >
              {showHint ? 'Hint shown' : 'Show hint'}
            </Button>
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
      </CardContent>
    </Card>
  );
};

export default PolygonAreaBuilder;
