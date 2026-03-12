'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberTracerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { DigitEvaluationResult } from '../../../service/math/gemini-digit-evaluation';

async function evaluateDigitDrawing(
  canvasBase64: string,
  targetDigit: number,
  challengeType: string,
): Promise<DigitEvaluationResult> {
  const res = await fetch('/api/lumina', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'evaluateDigitDrawing',
      params: { canvasBase64, targetDigit, challengeType },
    }),
  });
  if (!res.ok) throw new Error(`Digit evaluation failed: ${res.status}`);
  return res.json() as Promise<DigitEvaluationResult>;
}
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PathPoint {
  x: number;
  y: number;
}

export interface NumberTracerChallenge {
  id: string;
  type: 'trace' | 'copy' | 'write' | 'sequence';
  digit: number; // 0-20
  instruction: string;
  strokePaths: PathPoint[][]; // dotted guide path per character
  showModel: boolean;
  showArrows: boolean;
  hint?: string;
  // sequence mode
  sequenceNumbers?: number[]; // e.g. [3, 4, 5]
  missingIndex?: number; // which position to write
}

export interface NumberTracerData {
  title: string;
  description?: string;
  challenges: NumberTracerChallenge[];
  gradeBand: 'K' | '1';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<NumberTracerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  trace: { label: 'Trace', icon: '\u270F\uFE0F', accentColor: 'blue' },
  copy: { label: 'Copy', icon: '\uD83D\uDCCB', accentColor: 'purple' },
  write: { label: 'Write', icon: '\u2712\uFE0F', accentColor: 'emerald' },
  sequence: { label: 'Sequence', icon: '\uD83D\uDD22', accentColor: 'orange' },
};

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 400;
const STROKE_TOLERANCE = 30; // px tolerance for path proximity
const MIN_STROKE_POINTS = 8; // minimum points to consider a valid stroke

// Hardcoded stroke paths for digits 0-9 (normalized to ~200x280 bounding box centered in canvas)
// Each digit is an array of strokes (sub-paths), each stroke is an array of points
const DIGIT_PATHS: Record<number, PathPoint[][]> = {
  0: [[
    { x: 250, y: 60 }, { x: 220, y: 65 }, { x: 195, y: 85 }, { x: 180, y: 115 },
    { x: 170, y: 155 }, { x: 170, y: 200 }, { x: 175, y: 240 }, { x: 185, y: 270 },
    { x: 200, y: 295 }, { x: 220, y: 315 }, { x: 245, y: 325 }, { x: 270, y: 325 },
    { x: 295, y: 315 }, { x: 315, y: 295 }, { x: 330, y: 270 }, { x: 340, y: 240 },
    { x: 345, y: 200 }, { x: 345, y: 155 }, { x: 335, y: 115 }, { x: 320, y: 85 },
    { x: 300, y: 65 }, { x: 275, y: 58 }, { x: 250, y: 60 },
  ]],
  1: [[
    { x: 220, y: 100 }, { x: 240, y: 80 }, { x: 260, y: 60 }, { x: 260, y: 100 },
    { x: 260, y: 150 }, { x: 260, y: 200 }, { x: 260, y: 250 }, { x: 260, y: 300 },
    { x: 260, y: 340 },
  ], [
    { x: 210, y: 340 }, { x: 260, y: 340 }, { x: 310, y: 340 },
  ]],
  2: [[
    { x: 180, y: 110 }, { x: 195, y: 85 }, { x: 220, y: 65 }, { x: 250, y: 58 },
    { x: 280, y: 62 }, { x: 305, y: 80 }, { x: 320, y: 105 }, { x: 325, y: 130 },
    { x: 315, y: 160 }, { x: 295, y: 190 }, { x: 270, y: 220 }, { x: 240, y: 255 },
    { x: 210, y: 290 }, { x: 180, y: 325 }, { x: 180, y: 340 }, { x: 220, y: 340 },
    { x: 260, y: 340 }, { x: 300, y: 340 }, { x: 335, y: 340 },
  ]],
  3: [[
    { x: 180, y: 80 }, { x: 215, y: 62 }, { x: 255, y: 58 }, { x: 290, y: 65 },
    { x: 315, y: 85 }, { x: 325, y: 115 }, { x: 320, y: 145 }, { x: 300, y: 170 },
    { x: 270, y: 185 }, { x: 255, y: 190 }, { x: 280, y: 200 }, { x: 310, y: 220 },
    { x: 330, y: 250 }, { x: 335, y: 280 }, { x: 325, y: 310 }, { x: 300, y: 330 },
    { x: 270, y: 340 }, { x: 235, y: 342 }, { x: 200, y: 330 }, { x: 180, y: 310 },
  ]],
  4: [[
    { x: 290, y: 340 }, { x: 290, y: 290 }, { x: 290, y: 240 }, { x: 290, y: 190 },
    { x: 290, y: 140 }, { x: 290, y: 90 }, { x: 290, y: 60 },
  ], [
    { x: 290, y: 60 }, { x: 265, y: 100 }, { x: 240, y: 140 }, { x: 215, y: 180 },
    { x: 190, y: 220 }, { x: 170, y: 250 },
  ], [
    { x: 170, y: 250 }, { x: 210, y: 250 }, { x: 250, y: 250 }, { x: 290, y: 250 },
    { x: 330, y: 250 },
  ]],
  5: [[
    { x: 320, y: 60 }, { x: 280, y: 60 }, { x: 240, y: 60 }, { x: 200, y: 60 },
  ], [
    { x: 200, y: 60 }, { x: 195, y: 100 }, { x: 190, y: 140 }, { x: 185, y: 180 },
  ], [
    { x: 185, y: 180 }, { x: 215, y: 170 }, { x: 250, y: 165 }, { x: 285, y: 175 },
    { x: 315, y: 200 }, { x: 330, y: 235 }, { x: 330, y: 270 }, { x: 315, y: 300 },
    { x: 290, y: 325 }, { x: 255, y: 340 }, { x: 220, y: 338 }, { x: 190, y: 320 },
    { x: 175, y: 295 },
  ]],
  6: [[
    { x: 310, y: 80 }, { x: 285, y: 62 }, { x: 255, y: 58 }, { x: 225, y: 65 },
    { x: 200, y: 85 }, { x: 185, y: 115 }, { x: 175, y: 155 }, { x: 172, y: 195 },
    { x: 175, y: 235 }, { x: 185, y: 270 }, { x: 200, y: 300 }, { x: 225, y: 325 },
    { x: 255, y: 335 }, { x: 285, y: 330 }, { x: 310, y: 310 }, { x: 325, y: 280 },
    { x: 330, y: 250 }, { x: 325, y: 220 }, { x: 310, y: 200 }, { x: 285, y: 185 },
    { x: 255, y: 182 }, { x: 225, y: 190 }, { x: 200, y: 205 }, { x: 180, y: 225 },
  ]],
  7: [[
    { x: 175, y: 60 }, { x: 215, y: 60 }, { x: 255, y: 60 }, { x: 295, y: 60 },
    { x: 335, y: 60 },
  ], [
    { x: 335, y: 60 }, { x: 320, y: 100 }, { x: 300, y: 145 }, { x: 280, y: 190 },
    { x: 265, y: 230 }, { x: 250, y: 270 }, { x: 240, y: 310 }, { x: 235, y: 340 },
  ]],
  8: [[
    { x: 255, y: 190 }, { x: 225, y: 175 }, { x: 200, y: 150 }, { x: 190, y: 125 },
    { x: 195, y: 95 }, { x: 215, y: 72 }, { x: 245, y: 60 }, { x: 275, y: 62 },
    { x: 300, y: 75 }, { x: 315, y: 100 }, { x: 315, y: 125 }, { x: 305, y: 150 },
    { x: 280, y: 175 }, { x: 255, y: 190 }, { x: 225, y: 210 }, { x: 195, y: 235 },
    { x: 180, y: 265 }, { x: 178, y: 295 }, { x: 190, y: 318 }, { x: 215, y: 335 },
    { x: 250, y: 342 }, { x: 285, y: 338 }, { x: 315, y: 320 }, { x: 330, y: 295 },
    { x: 332, y: 265 }, { x: 320, y: 235 }, { x: 295, y: 210 }, { x: 265, y: 195 },
    { x: 255, y: 190 },
  ]],
  9: [[
    { x: 325, y: 175 }, { x: 310, y: 200 }, { x: 285, y: 215 }, { x: 255, y: 220 },
    { x: 225, y: 210 }, { x: 200, y: 190 }, { x: 185, y: 165 }, { x: 180, y: 135 },
    { x: 190, y: 105 }, { x: 210, y: 80 }, { x: 240, y: 65 }, { x: 270, y: 60 },
    { x: 300, y: 68 }, { x: 320, y: 85 }, { x: 332, y: 110 }, { x: 335, y: 140 },
    { x: 332, y: 175 }, { x: 325, y: 210 }, { x: 315, y: 245 }, { x: 300, y: 280 },
    { x: 280, y: 310 }, { x: 255, y: 330 }, { x: 225, y: 340 }, { x: 200, y: 335 },
  ]],
};

// For multi-digit numbers (10-20), compose from individual digit paths
function getDigitPaths(num: number): PathPoint[][] {
  if (num <= 9) return DIGIT_PATHS[num] ?? DIGIT_PATHS[0];
  const digits = String(num).split('').map(Number);
  const allPaths: PathPoint[][] = [];
  const charWidth = 180;
  const totalWidth = digits.length * charWidth;
  const startX = (CANVAS_WIDTH - totalWidth) / 2;

  for (let i = 0; i < digits.length; i++) {
    const offsetX = startX + i * charWidth - (CANVAS_WIDTH / 2 - charWidth / 2);
    const basePaths = DIGIT_PATHS[digits[i]] ?? DIGIT_PATHS[0];
    for (const stroke of basePaths) {
      allPaths.push(stroke.map(p => ({ x: p.x + offsetX, y: p.y })));
    }
  }
  return allPaths;
}

// ============================================================================
// Helpers
// ============================================================================

function distToSegment(
  p: PathPoint,
  a: PathPoint,
  b: PathPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

function minDistToPath(point: PathPoint, path: PathPoint[]): number {
  let minDist = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distToSegment(point, path[i], path[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Normalize student strokes into the ideal path's bounding box so that
// position and scale on the canvas don't affect the score.
function normalizeStrokes(
  strokes: PathPoint[][],
  idealPaths: PathPoint[][],
): PathPoint[][] {
  const userPts = strokes.flat();
  const idealPts = idealPaths.flat();
  if (userPts.length === 0 || idealPts.length === 0) return strokes;

  const uMinX = Math.min(...userPts.map(p => p.x));
  const uMaxX = Math.max(...userPts.map(p => p.x));
  const uMinY = Math.min(...userPts.map(p => p.y));
  const uMaxY = Math.max(...userPts.map(p => p.y));
  const uW = uMaxX - uMinX || 1;
  const uH = uMaxY - uMinY || 1;

  const iMinX = Math.min(...idealPts.map(p => p.x));
  const iMaxX = Math.max(...idealPts.map(p => p.x));
  const iMinY = Math.min(...idealPts.map(p => p.y));
  const iMaxY = Math.max(...idealPts.map(p => p.y));
  const iW = iMaxX - iMinX || 1;
  const iH = iMaxY - iMinY || 1;

  // Use non-uniform scale so both axes map into ideal box
  const sx = iW / uW;
  const sy = iH / uH;

  return strokes.map(stroke =>
    stroke.map(p => ({
      x: iMinX + (p.x - uMinX) * sx,
      y: iMinY + (p.y - uMinY) * sy,
    })),
  );
}

function scoreStrokeAccuracy(
  userStrokes: PathPoint[][],
  idealPaths: PathPoint[][],
  normalize: boolean,
): number {
  const strokes = normalize ? normalizeStrokes(userStrokes, idealPaths) : userStrokes;
  const userFlat = strokes.flat();
  if (userFlat.length < MIN_STROKE_POINTS) return 0;
  if (idealPaths.flat().length < 2) return 0;

  const tol = normalize ? STROKE_TOLERANCE * 1.5 : STROKE_TOLERANCE;

  let totalDist = 0;
  for (const up of userFlat) {
    let minD = Infinity;
    for (const path of idealPaths) {
      const d = minDistToPath(up, path);
      if (d < minD) minD = d;
    }
    totalDist += minD;
  }
  const avgDist = totalDist / userFlat.length;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - avgDist / (tol * 2)))));
}

function computePathCoverage(
  userStrokes: PathPoint[][],
  idealPaths: PathPoint[][],
  normalize: boolean,
): number {
  const strokes = normalize ? normalizeStrokes(userStrokes, idealPaths) : userStrokes;
  const userFlat = strokes.flat();

  const tol = normalize ? STROKE_TOLERANCE * 2 : STROKE_TOLERANCE * 1.5;

  const sampledPoints: PathPoint[] = [];
  for (const path of idealPaths) {
    for (let i = 0; i < path.length - 1; i++) {
      for (let s = 0; s <= 5; s++) {
        const t = s / 5;
        sampledPoints.push({
          x: path[i].x + t * (path[i + 1].x - path[i].x),
          y: path[i].y + t * (path[i + 1].y - path[i].y),
        });
      }
    }
  }
  if (sampledPoints.length === 0) return 0;

  let covered = 0;
  for (const sp of sampledPoints) {
    if (userFlat.some(up => Math.sqrt((up.x - sp.x) ** 2 + (up.y - sp.y) ** 2) < tol)) {
      covered++;
    }
  }
  return Math.round((covered / sampledPoints.length) * 100);
}

// ============================================================================
// Sub-components
// ============================================================================

interface DigitModelProps {
  digit: number;
  size?: number;
  showArrows?: boolean;
  className?: string;
}

const DigitModel: React.FC<DigitModelProps> = ({ digit, size = 120, showArrows = false, className = '' }) => {
  const paths = digit <= 9 ? (DIGIT_PATHS[digit] ?? []) : [];
  const scale = size / CANVAS_HEIGHT;

  return (
    <svg
      width={size * (CANVAS_WIDTH / CANVAS_HEIGHT)}
      height={size}
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      className={className}
    >
      {paths.map((stroke, si) => (
        <g key={si}>
          <polyline
            points={stroke.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(148, 163, 184, 0.6)"
            strokeWidth={4 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {showArrows && stroke.length > 1 && (
            <circle
              cx={stroke[0].x}
              cy={stroke[0].y}
              r={8 / scale}
              fill="rgba(59, 130, 246, 0.8)"
            />
          )}
        </g>
      ))}
    </svg>
  );
};

// ============================================================================
// Props
// ============================================================================

interface NumberTracerProps {
  data: NumberTracerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const NumberTracer: React.FC<NumberTracerProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    gradeBand = 'K',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Drawing State ──────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<PathPoint[]>([]);
  const [allStrokes, setAllStrokes] = useState<PathPoint[][]>([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [hasChecked, setHasChecked] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ── Challenge Progress (shared hooks) ───────────────────────────────
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
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  const idealPaths = useMemo(() => {
    if (!currentChallenge) return [];
    // Use challenge-provided strokePaths if available, else fall back to hardcoded
    if (currentChallenge.strokePaths && currentChallenge.strokePaths.length > 0) {
      return currentChallenge.strokePaths;
    }
    return getDigitPaths(currentChallenge.digit);
  }, [currentChallenge]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id,
  );

  // ── Refs ────────────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `number-tracer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Evaluation Hook ────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<NumberTracerMetrics>({
    primitiveType: 'number-tracer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring Integration ─────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'trace',
    digit: currentChallenge?.digit ?? 0,
    instruction: currentChallenge?.instruction ?? '',
    showModel: currentChallenge?.showModel ?? true,
    showArrows: currentChallenge?.showArrows ?? true,
    attemptNumber: currentAttempts + 1,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    lastScore,
  }), [currentChallenge, currentAttempts, gradeBand, challenges.length, currentChallengeIndex, lastScore]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'number-tracer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Number Tracer activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering numeral writing. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}, digit: ${currentChallenge?.digit}). `
      + `Introduce warmly: "Let's practice writing numbers! We'll trace, copy, and write them."`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText]);

  // ── Canvas Drawing ──────────────────────────────────────────────────

  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent): PathPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (hasSubmittedEvaluation || isCurrentChallengeComplete) return;
    e.preventDefault();
    const p = getCanvasCoords(e);
    if (!p) return;
    setIsDrawing(true);
    setCurrentStroke([p]);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, isCurrentChallengeComplete, currentChallenge?.type, getCanvasCoords]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getCanvasCoords(e);
    if (!p) return;
    setCurrentStroke(prev => [...prev, p]);
  }, [isDrawing, getCanvasCoords]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length >= 3) {
      setAllStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
  }, [isDrawing, currentStroke]);

  // ── Canvas Rendering ────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CANVAS_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Baseline
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(100, 350);
    ctx.lineTo(400, 350);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw guide paths (trace and copy modes)
    if (currentChallenge.type === 'trace' || (currentChallenge.type === 'copy' && currentChallenge.showModel)) {
      for (const path of idealPaths) {
        if (path.length < 2) continue;
        // Dotted guide
        ctx.strokeStyle = currentChallenge.type === 'trace'
          ? 'rgba(59, 130, 246, 0.4)'
          : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = currentChallenge.type === 'trace' ? 12 : 8;
        ctx.setLineDash([4, 8]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Direction arrows (trace mode only)
        if (currentChallenge.showArrows && currentChallenge.type === 'trace') {
          // Start dot
          ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.beginPath();
          ctx.arc(path[0].x, path[0].y, 8, 0, Math.PI * 2);
          ctx.fill();

          // Arrow indicators at intervals
          for (let i = 2; i < path.length - 1; i += 3) {
            const dx = path[i + 1].x - path[i].x;
            const dy = path[i + 1].y - path[i].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) continue;
            const nx = dx / len;
            const ny = dy / len;
            const ax = path[i].x + nx * 5;
            const ay = path[i].y + ny * 5;

            ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.beginPath();
            ctx.moveTo(ax + nx * 8, ay + ny * 8);
            ctx.lineTo(ax - ny * 4, ay + nx * 4);
            ctx.lineTo(ax + ny * 4, ay - nx * 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Draw completed strokes
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }

    // Draw current stroke
    if (currentStroke.length >= 2) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  }, [currentChallenge, idealPaths, allStrokes, currentStroke]);

  // ── Check / Submit Handlers ────────────────────────────────────────

  const handleCheckDrawing = useCallback(async () => {
    if (!currentChallenge || isEvaluating) return;
    if (allStrokes.flat().length < MIN_STROKE_POINTS) {
      setFeedback('Keep writing! Draw the full number.');
      setFeedbackType('error');
      return;
    }

    incrementAttempts();
    setHasChecked(true);

    // trace mode: student must follow guide at exact position — no normalization
    // copy/write/sequence: student writes anywhere — normalize bounding box before scoring
    const shouldNormalize = currentChallenge.type !== 'trace';

    const accuracy = scoreStrokeAccuracy(allStrokes, idealPaths, shouldNormalize);
    const coverage = computePathCoverage(allStrokes, idealPaths, shouldNormalize);
    const geoScore = Math.round(accuracy * 0.6 + coverage * 0.4);

    // If geometric score is already >= 90, accept without API call
    if (geoScore >= 90) {
      setLastScore(geoScore);
      setFeedback('Excellent writing!');
      setFeedbackType('success');
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: geoScore,
        accuracy,
        coverage,
      });
      sendText(
        `[ANSWER_CORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}) `
        + `geo score ${geoScore}%. Celebrate excellent form!`,
        { silent: true },
      );
      return;
    }

    // Score < 90 — ask Gemini vision to re-evaluate
    setIsEvaluating(true);
    setFeedback('Checking your writing…');
    setFeedbackType('');

    try {
      const canvas = canvasRef.current;
      const base64 = canvas ? canvas.toDataURL('image/png') : '';

      const geminiResult = base64
        ? await evaluateDigitDrawing(base64, currentChallenge.digit, currentChallenge.type)
        : null;

      // Use Gemini score if it has reasonable confidence, otherwise fall back to geo score
      const finalScore = geminiResult && geminiResult.confidence >= 60
        ? geminiResult.score
        : geoScore;

      setLastScore(finalScore);
      const isCorrect = finalScore >= 50;

      if (isCorrect) {
        const feedbackMsg = geminiResult?.feedback
          ?? (finalScore >= 80 ? 'Excellent writing!' : 'Good job! You wrote the number!');
        setFeedback(feedbackMsg);
        setFeedbackType('success');
        recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          score: finalScore,
          accuracy,
          coverage,
          geminiScore: geminiResult?.score,
          geminiVariant: geminiResult?.variant,
        });
        sendText(
          `[ANSWER_CORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}). `
          + `Geo: ${geoScore}%, Gemini: ${geminiResult?.score ?? 'n/a'}% (${geminiResult?.variant ?? ''}). `
          + `Final: ${finalScore}%. Attempt ${currentAttempts + 1}. Praise the effort.`,
          { silent: true },
        );
      } else {
        const feedbackMsg = geminiResult?.feedback
          ?? (currentChallenge.type === 'trace'
            ? 'Follow the dotted path more closely.'
            : 'Try again — write the whole number clearly.');
        setFeedback(feedbackMsg);
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}). `
          + `Geo: ${geoScore}%, Gemini: ${geminiResult?.score ?? 'n/a'}% (${geminiResult?.variant ?? ''}). `
          + `Final: ${finalScore}%. Attempt ${currentAttempts + 1}. Give a hint.`,
          { silent: true },
        );
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [currentChallenge, allStrokes, idealPaths, currentAttempts, isEvaluating, incrementAttempts, recordResult, sendText]);

  const handleClear = useCallback(() => {
    setAllStrokes([]);
    setCurrentStroke([]);
    setFeedback('');
    setFeedbackType('');
    setHasChecked(false);
    setLastScore(null);
    setIsEvaluating(false);
  }, []);

  const handleNextChallenge = useCallback(() => {
    // Reset drawing state
    setAllStrokes([]);
    setCurrentStroke([]);
    setFeedback('');
    setFeedbackType('');
    setHasChecked(false);
    setLastScore(null);

    if (!advanceProgress()) {
      // All challenges done — submit evaluation
      const overallPct = Math.round(
        challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
        / Math.max(1, challengeResults.length),
      );

      if (!hasSubmittedEvaluation) {
        submitEvaluation(
          overallPct >= 60,
          overallPct,
          {
            type: 'number-tracer',
            tracingAccuracy: overallPct,
            digitsCompleted: challengeResults.filter(r => r.correct).length,
            totalDigits: challenges.length,
            attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          },
        );
      }

      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about numeral writing progress.`,
        { silent: true },
      );
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
      + `Type: ${challenges[currentChallengeIndex + 1]?.type}, digit: ${challenges[currentChallengeIndex + 1]?.digit}. `
      + `Instruction: "${challenges[currentChallengeIndex + 1]?.instruction}". Introduce briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, challengeResults, challenges, currentChallengeIndex,
    hasSubmittedEvaluation, phaseResults, sendText, submitEvaluation,
  ]);

  // ── Render ──────────────────────────────────────────────────────────

  if (challenges.length === 0) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
        <CardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </CardContent>
      </Card>
    );
  }

  const isSequenceMode = currentChallenge?.type === 'sequence';

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-slate-100">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {currentChallenge && (
              <Badge variant="outline" className="border-white/20 text-slate-300">
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </Badge>
            )}
            <Badge variant="outline" className="border-white/20 text-slate-400">
              {currentChallengeIndex + 1} / {challenges.length}
            </Badge>
          </div>
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="text-center">
            <p className="text-lg text-slate-200 font-medium">
              {currentChallenge.instruction}
            </p>
            {currentChallenge.hint && currentAttempts >= 2 && (
              <p className="text-sm text-blue-400 mt-1">{currentChallenge.hint}</p>
            )}
          </div>
        )}

        {/* Copy mode: show model digit alongside */}
        {currentChallenge?.type === 'copy' && currentChallenge.showModel && !allChallengesComplete && (
          <div className="flex justify-center">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
              <p className="text-xs text-slate-500 text-center mb-1">Model</p>
              <div className="text-7xl font-bold text-slate-300 text-center px-4 select-none">
                {currentChallenge.digit}
              </div>
            </div>
          </div>
        )}

        {/* Sequence context (shown above canvas in sequence mode) */}
        {isSequenceMode && currentChallenge?.sequenceNumbers && !allChallengesComplete && (
          <div className="flex justify-center">
            <div className="bg-slate-800/40 rounded-xl border border-white/10 px-6 py-3">
              <div className="flex items-center gap-2 text-4xl font-bold">
                {currentChallenge.sequenceNumbers.map((num, i) => (
                  <React.Fragment key={i}>
                    <span className={i === currentChallenge.missingIndex
                      ? 'text-blue-400 border-b-2 border-blue-400 px-2'
                      : 'text-slate-200 px-1'
                    }>
                      {i === currentChallenge.missingIndex ? '?' : num}
                    </span>
                    {i < currentChallenge.sequenceNumbers!.length - 1 && (
                      <span className="text-slate-600 text-2xl">,</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center mt-1">Write the missing number below</p>
            </div>
          </div>
        )}

        {/* Canvas (all drawing modes) */}
        {!allChallengesComplete && (
          <div className="flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rounded-xl border border-white/10 bg-slate-950/60 cursor-crosshair touch-none"
                style={{ width: '100%', maxWidth: 500, aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              />
              {lastScore !== null && isCurrentChallengeComplete && (
                <div className="absolute top-3 right-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-1">
                  <span className="text-emerald-300 font-bold text-lg">{lastScore}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback / evaluating indicator */}
        {isEvaluating && (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Checking your writing…
          </div>
        )}
        {!isEvaluating && feedback && (
          <div className={`text-center text-sm font-medium ${
            feedbackType === 'success' ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action buttons */}
        {!allChallengesComplete && currentChallenge && (
          <div className="flex justify-center gap-3">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10"
              onClick={handleClear}
              disabled={allStrokes.length === 0 || isCurrentChallengeComplete || isEvaluating}
            >
              Clear
            </Button>
            {!isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-300"
                onClick={handleCheckDrawing}
                disabled={allStrokes.length === 0 || isEvaluating}
              >
                {isEvaluating ? 'Checking…' : 'Check'}
              </Button>
            )}
            {isCurrentChallengeComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
                onClick={handleNextChallenge}
              >
                {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
              </Button>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? Math.round(
              challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
              / Math.max(1, challengeResults.length),
            )}
            durationMs={elapsedMs}
            heading="Number Writing Complete!"
            celebrationMessage="You practiced writing numbers!"
            className="mb-6"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NumberTracer;
