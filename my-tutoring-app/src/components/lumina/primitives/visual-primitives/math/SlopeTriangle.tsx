'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** Within-mode support tier from the manifest, when present (drives tutor reveal). */
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
// Tutor reveal policy — keep the AI tutor in sync with the measurement overlay
// so it never names what a harder tier withheld.
// ============================================================================

function tutorRevealClause(type: string, tier?: 'easy' | 'medium' | 'hard'): string {
  if (!tier) return '';
  if (tier === 'easy')
    return ' Support tier EASY: the rise/run overlay is on — you may name the method and walk the first step.';
  if (tier === 'medium')
    return ' Support tier MEDIUM: numeric labels are withdrawn — nudge the student to count the grid, do not state rise, run, or the slope value.';
  // hard — the screen withholds every measurement overlay; the tutor must not leak it.
  return ' Support tier HARD: no measurement overlay — ask how far the line goes UP vs ACROSS between the corners; do NOT state the rise, the run, or the slope value.';
}

// ============================================================================
// Component
// ============================================================================

interface SlopeTriangleProps {
  data: SlopeTriangleData;
  className?: string;
}

const SlopeTriangle: React.FC<SlopeTriangleProps> = ({ data, className }) => {
  const {
    title,
    description,
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

  // -------------------------------------------------------------------------
  // Multi-challenge state
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

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const challengeType = currentChallenge?.type ?? 'identify_slope';

  // -------------------------------------------------------------------------
  // Per-challenge UI state (reset on advance)
  // -------------------------------------------------------------------------
  const [trianglePos, setTrianglePos] = useState<{ x: number; size: number }>(() => ({
    x: currentChallenge?.triangle.position.x ?? 0,
    size: currentChallenge?.triangle.size ?? 1,
  }));
  const [riseInput, setRiseInput] = useState('');
  const [runInput, setRunInput] = useState('');
  const [slopeInput, setSlopeInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'base' | 'right' | null>(null);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `slope-triangle-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas constants
  const padding = 50;
  const canvasWidth = 720;
  const canvasHeight = 540;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setTrianglePos({
      x: currentChallenge.triangle.position.x,
      size: currentChallenge.triangle.size,
    });
    setRiseInput('');
    setRunInput('');
    setSlopeInput('');
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    recordedRef.current = false;
    hintViewedRef.current = false;
  }, [currentChallenge?.id, currentChallenge]);

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
    const y2 = evaluateLine(slope, yIntercept, x2);
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

    // Drag handles (always — but only the right handle is draggable in draw_triangle,
    // and both are draggable in draw_triangle).
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
  ]);

  // -------------------------------------------------------------------------
  // Mouse handlers (only meaningful for draw_triangle)
  // -------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (challengeType !== 'draw_triangle' || !currentChallenge) return;
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
    if (distBase < 18) setDraggingHandle('base');
    else if (distRight < 18) setDraggingHandle('right');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingHandle || !currentChallenge) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvasWidth / rect.width);
    const cy = (e.clientY - rect.top) * (canvasHeight / rect.height);
    const graph = canvasToGraph(cx, cy);
    const roundedX = Math.round(graph.x);
    if (draggingHandle === 'base') {
      // Drag the whole triangle along x; keep size fixed.
      const newX = Math.max(xRange[0], Math.min(xRange[1] - trianglePos.size, roundedX));
      if (newX !== trianglePos.x) SoundManager.tick(); // barely-there click per grid unit crossed
      setTrianglePos((prev) => ({ ...prev, x: newX }));
    } else if (draggingHandle === 'right') {
      const newSize = Math.max(1, Math.min(8, roundedX - trianglePos.x));
      if (newSize !== trianglePos.size) SoundManager.tick();
      setTrianglePos((prev) => ({ ...prev, size: newSize }));
    }
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
  // AI Tutoring
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    challengeType,
    currentChallengeIndex: currentChallengeIndex + 1,
    totalChallenges: challenges.length,
    equation: currentChallenge?.attachedLine.label ?? '',
    slope: currentChallenge?.attachedLine.slope ?? 0,
    expectedRise: currentChallenge?.expectedRise ?? 0,
    expectedRun: currentChallenge?.expectedRun ?? 0,
    expectedSlope: currentChallenge?.expectedSlope ?? 0,
    gradeBand,
    attemptNumber: currentAttempts + 1,
    notation: currentChallenge?.triangle.notation ?? 'riseRun',
    supportTier: currentChallenge?.supportTier,
  }), [
    challengeType,
    currentChallengeIndex,
    challenges.length,
    currentChallenge,
    gradeBand,
    currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'slope-triangle',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel:
      gradeBand === '7-8' ? 'Grade 8' : gradeBand === 'algebra-1' ? 'Algebra 1' : 'Algebra 2',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    const totalCh = challenges.length;
    sendText(
      `[ACTIVITY_START] Slope triangle session: ${totalCh > 1 ? `${totalCh} lines` : 'one line'}. `
      + `Mode: ${challengeType}. Grade band: ${gradeBand}. `
      + `Introduce briefly: "Each line has a slope triangle — read or build it to find the slope."`,
      { silent: true }
    );
  }, [isConnected, challenges.length, challengeType, gradeBand, sendText]);

  // -------------------------------------------------------------------------
  // Submit handlers (handler-driven with stale-state guard per §6a #8)
  // -------------------------------------------------------------------------

  const completeChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge) return;
    if (recordedRef.current) return; // stale-state guard
    incrementAttempts();
    const attempts = currentAttempts + 1;

    if (correct) {
      // Standard per-challenge score (PRD §6a #11): 100 first try, -20 per extra, floor 20.
      const score = Math.max(20, 100 - (attempts - 1) * 20);
      recordedRef.current = true;
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts,
        score,
      });
    } else {
      // Don't record yet — let them retry.
    }
  }, [currentChallenge, currentAttempts, incrementAttempts, recordResult]);

  const handleSubmitIdentifySlope = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
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
      sendText(`[ANSWER_CORRECT] Student identified rise/run. Celebrate briefly.`, { silent: true });
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Count the grid units carefully.`);
      setFeedbackType('error');
      incrementAttempts();
      sendText(
        `[ANSWER_INCORRECT] Student answered rise=${rise}, run=${run}. Hint: "Count up from the base point for rise, across for run."`
        + tutorRevealClause(currentChallenge.type, currentChallenge.supportTier),
        { silent: true }
      );
    }
  }, [currentChallenge, hasSubmittedEvaluation, riseInput, runInput, completeChallenge, incrementAttempts, sendText]);

  const handleSubmitCalculate = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    const trimmed = slopeInput.trim();
    if (!trimmed) {
      setFeedback('Enter the slope value.');
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
      setFeedback('Enter a number or fraction (e.g. 2 or 2/3).');
      setFeedbackType('error');
      return;
    }
    const correct = Math.abs(parsed - currentChallenge.expectedSlope) < 0.01;
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! Slope = ${currentChallenge.expectedSlope}.`);
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student calculated slope. Reinforce rise/run formula.`, { silent: true });
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Slope = rise ÷ run.`);
      setFeedbackType('error');
      incrementAttempts();
      sendText(
        `[ANSWER_INCORRECT] Student said slope=${parsed}, actual ${currentChallenge.expectedSlope}. Hint: "Divide rise by run; watch the sign."`
        + tutorRevealClause(currentChallenge.type, currentChallenge.supportTier),
        { silent: true }
      );
    }
  }, [currentChallenge, hasSubmittedEvaluation, slopeInput, completeChallenge, incrementAttempts, sendText]);

  const handleSubmitDrawTriangle = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    // Triangle is correct if its run matches expectedRun AND it sits on the line
    // (rise will follow automatically because base-y is evaluated from the line).
    const sizeMatches = Math.abs(trianglePos.size - currentChallenge.expectedRun) < 0.01;
    // Position-on-line is implicit because we compute basePoint from the line equation.
    if (sizeMatches) {
      SoundManager.playCorrect();
      setFeedback(
        `Triangle confirmed. Run = ${currentChallenge.expectedRun}, Rise = ${currentChallenge.expectedRise}, Slope = ${currentChallenge.expectedSlope}.`
      );
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student built a slope triangle. Reinforce slope constancy.`, { silent: true });
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Make the run = ${currentChallenge.expectedRun}. Drag the right corner.`);
      setFeedbackType('error');
      incrementAttempts();
      sendText(
        `[ANSWER_INCORRECT] Student's run=${trianglePos.size}, target run=${currentChallenge.expectedRun}. Coach to drag right handle.`
        + tutorRevealClause(currentChallenge.type, currentChallenge.supportTier),
        { silent: true }
      );
    }
  }, [currentChallenge, hasSubmittedEvaluation, trianglePos.size, completeChallenge, incrementAttempts, sendText]);

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
        `[NEXT_ITEM] Line ${nextIdx + 1} of ${challenges.length}: "${next?.attachedLine.label}". `
        + `Introduce briefly: "Here's the next line. Read the triangle to find the slope."`,
        { silent: true },
      );
    }
  }, [advanceProgress, currentChallengeIndex, challenges, sendText]);

  // -------------------------------------------------------------------------
  // Session-complete: build metrics and submit exactly once.
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

    const metrics: SlopeTriangleMetrics = {
      type: 'slope-triangle',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'identify_slope') as SlopeTriangleMetrics['challengeType'],
      totalChallenges: total,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: hintsViewedRef.current,
      overallAccuracy: avgScore,
      averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };

    const goalMet = correctCount === total;
    submitEvaluation(goalMet, avgScore, metrics, { challengeResults });

    sendText(
      `[ALL_COMPLETE] All ${total} slope triangles done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give encouraging summary.`,
      { silent: true },
    );
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, currentChallenge, submitEvaluation, sendText]);

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const isCurrentComplete =
    challenges.length > 0 &&
    challengeResults.length > currentChallengeIndex &&
    challengeResults[currentChallengeIndex]?.correct;

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
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6 text-center text-slate-400">
          No slope-triangle challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const notation = currentChallenge.triangle.notation;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
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
        {/* Equation banner */}
        <LuminaPanel className="flex items-center justify-center gap-3 py-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Line</span>
          <span className="text-lg font-mono font-bold text-blue-300">{currentChallenge.attachedLine.label}</span>
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

        {/* Canvas — bespoke interaction surface (painting), left untouched */}
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
                      value={riseInput}
                      onChange={(e) => setRiseInput(e.target.value)}
                      className="w-20 py-1.5 text-center"
                      placeholder="?"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 text-sm">
                    <span className="text-green-300 font-mono">{notation === 'deltaNotation' ? 'Δx =' : 'run ='}</span>
                    <LuminaInput
                      type="number"
                      value={runInput}
                      onChange={(e) => setRunInput(e.target.value)}
                      className="w-20 py-1.5 text-center"
                      placeholder="?"
                    />
                  </label>
                  <LuminaActionButton action="check" onClick={handleSubmitIdentifySlope}>
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
                    value={slopeInput}
                    onChange={(e) => setSlopeInput(e.target.value)}
                    className="w-28 py-1.5 text-center"
                    placeholder="e.g. 2/3"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitCalculate()}
                  />
                  <LuminaActionButton action="check" onClick={handleSubmitCalculate}>
                    Check
                  </LuminaActionButton>
                </div>
              </>
            )}

            {challengeType === 'draw_triangle' && (
              <>
                <p className="text-slate-300 text-sm font-medium">
                  Build a triangle with run = <span className="text-green-300 font-mono">{currentChallenge.expectedRun}</span>. Drag the base point to position it, drag the right corner to size it.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <span className="text-slate-400">Current:</span>
                  <span className="text-green-300 font-mono">run = {trianglePos.size}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-cyan-300 font-mono">base x = {trianglePos.x}</span>
                  <LuminaActionButton action="check" onClick={handleSubmitDrawTriangle}>
                    Check
                  </LuminaActionButton>
                </div>
              </>
            )}
          </LuminaPanel>
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
          >
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Hint */}
        {showHint && (
          <LuminaPanel accent="amber" className="bg-amber-500/10">
            <p className="text-amber-200 text-sm">
              <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
              {currentChallenge.hint}
            </p>
          </LuminaPanel>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2 flex-wrap">
          {isCurrentComplete && !allChallengesComplete && (
            <LuminaActionButton action="next" onClick={advanceChallenge}>
              Next Triangle →
            </LuminaActionButton>
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

        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
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

export default SlopeTriangle;
