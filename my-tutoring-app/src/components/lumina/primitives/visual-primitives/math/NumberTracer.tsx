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
  LuminaChallengeCounter,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { NumberTracerMetrics } from '../../../evaluation/types';
import type { DigitEvaluationResult } from '../../../service/math/gemini-digit-evaluation';
import { numberTracerDiagnosisEvidence, type NumberTracerResponse } from './numberTracerEvidence';

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
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';

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

  // ── Within-mode support tier (config.difficulty) ──
  // These gate which TRACING GUIDES are painted on the canvas. They are set by the
  // generator only when a support tier is active; when absent the canvas falls back
  // to the original behaviour (derived from showArrows / showModel), so a no-tier
  // generation is byte-identical to before. They NEVER affect what is scored — the
  // stroke-geometry + Gemini Vision evaluation is independent of these flags.
  showGhostDigit?: boolean;   // the dotted ghost numeral to trace over
  showStrokeArrows?: boolean; // directional stroke-order arrows
  showStartDot?: boolean;     // the green "start here" dot
  supportTier?: 'easy' | 'medium' | 'hard';
  /** A practice item that is one stroke of a numeral (`trace_part`, numberTracerLevers.ts): geometry checks it alone. */
  strokePart?: boolean;
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { describeWriting, numberTracerMiss, workspaceScene } from './numberTracerWorkspace';
import { DIGIT_PATHS, getDigitPaths } from './numberTracerPaths';
import {
  ARROWS_LEVER, COUNT_DOTS_LEVER, DOTS_LEVER, FIRST_PART_LEVER, GHOST_LEVER, MODEL_STROKES_LEVER, NUMBER_TRACER_LEVERS,
  PRACTICE_NOTE, countDots, firstPart, startDots, startingLevers,
} from './numberTracerLevers';
import { numberTracerBoss } from './numberTracer.boss';
export { getDigitPaths };
export interface NumberTracerData {
  /** Safe adaptation metadata; `source` is stamped only by the observation delivery server. */
  learningAdaptation?: LearningAdaptation<'contrast_gap_positions_in_one_run'>;
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
  trace: { label: 'Trace', icon: '✏️', accentColor: 'blue' },
  copy: { label: 'Copy', icon: '📋', accentColor: 'purple' },
  write: { label: 'Write', icon: '✒️', accentColor: 'emerald' },
  sequence: { label: 'Sequence', icon: '🔢', accentColor: 'orange' },
};

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 400;
const STROKE_TOLERANCE = 30; // px tolerance for path proximity
const MIN_STROKE_POINTS = 8; // minimum points to consider a valid stroke

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

export function scoreStrokeAccuracy(
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

export function computePathCoverage(
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

/** Which tracing guides the canvas paints for an item. When the support-tier fields are present (a tier
 *  is active) they drive the guides; otherwise they derive from showArrows / showModel, so a no-tier
 *  item renders as before. A sequence item's numeral is its hidden answer, so it never gets a guide (NT-7). */
export function paintedGuides(ch: NumberTracerChallenge): { ghost: boolean; arrows: boolean; startDot: boolean } {
  const tierActive = ch.supportTier != null;
  const baseGhost = ch.type === 'trace' || (ch.type === 'copy' && ch.showModel);
  const baseArrows = ch.showArrows && ch.type === 'trace';
  return {
    ghost: ch.type !== 'sequence' && (tierActive ? !!ch.showGhostDigit : baseGhost),
    arrows: tierActive ? !!ch.showStrokeArrows : baseArrows,
    startDot: tierActive ? !!ch.showStartDot : baseArrows,
  };
}

/** The image the vision judge reads: only the learner's ink, light on the dark ground its prompt
 *  describes. The on-screen canvas is transparent (its ground is CSS) and carries guides, so
 *  exporting it sent white strokes on alpha 0, which the judge read as a blank canvas (NT-5). */
export function renderInkForJudge(strokes: PathPoint[][]): string {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
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
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted (the workspace pin reads it). */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const useTracerProgress = useWorkspaceProgressFor('number-tracer');

const NumberTracerSurface = ({ data, className, runtimePlanItemId }: NumberTracerProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges = [],
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
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  // Levers (`NUMBER_TRACER_LEVERS`): runtime pulls on the session item, and the easier item a simplify lever opened.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<NumberTracerChallenge | null>(null);

  /** A fresh item, Try again, or the full item back after practice: an empty canvas. */
  const resetWork = () => {
    setAllStrokes([]); setCurrentStroke([]); setFeedback(''); setFeedbackType(''); setLastScore(null);
  };

  // ── Challenge progression: the teaching workspace owns it. ──
  const stableInstanceIdRef = useRef(instanceId || `number-tracer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const progress = useTracerProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: numberTracerBoss.assignment!,
    // A fresh challenge and Try again both start from an empty canvas; Try again keeps a practice item open.
    onItemOpened: (_index, retry) => {
      resetWork();
      if (!retry) setPractice(null);
    },
  });
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
  } = progress;
  /** A checked writing stays closed until Try again or the next item. */
  const learnerClosed = progress.canAttempt === false;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0) / rs.length),
  });

  const sessionChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );
  /** The item on the canvas: an easier practice item in place of the session item while one is open. */
  const currentChallenge = practice ?? sessionChallenge;
  /** Help levers in force on the session item: where its tier started them, plus the tutor's pulls. None on a practice item. */
  const runtimePulled = !practice && sessionChallenge && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  const leversOn = useMemo(() => (sessionChallenge && !practice
    ? Array.from(new Set([...startingLevers(sessionChallenge, paintedGuides(sessionChallenge)), ...runtimePulled])) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [sessionChallenge, practice, runtimePulled.join(' ')]);

  const idealPaths = useMemo(() => {
    if (!currentChallenge) return [];
    // Use challenge-provided strokePaths if available, else fall back to hardcoded
    if (currentChallenge.strokePaths && currentChallenge.strokePaths.length > 0) {
      return currentChallenge.strokePaths;
    }
    return getDigitPaths(currentChallenge.digit);
  }, [currentChallenge]);

  /** The guides on the canvas: the tier's painted guides plus the help levers in force. Nothing on a sequence (NT-7). */
  const canvasGuides = useMemo(() => {
    if (!currentChallenge || currentChallenge.type === 'sequence') return { ghost: false, arrows: false, dots: false, firstPart: false };
    const g = paintedGuides(currentChallenge);
    return { ghost: g.ghost || leversOn.includes(GHOST_LEVER), arrows: g.arrows || leversOn.includes(ARROWS_LEVER),
      dots: g.startDot || leversOn.includes(DOTS_LEVER), firstPart: leversOn.includes(FIRST_PART_LEVER) };
  }, [currentChallenge, leversOn]);

  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id,
  );

  // ── Refs ────────────────────────────────────────────────────────────
  // Every checked drawing, including tries later corrected (misconception evidence; never scored).
  const responsesRef = useRef<NumberTracerResponse[]>([]);
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

  const submitSession = useCallback((overallPct: number) => {
    const types = Array.from(new Set(challenges.map(c => c.type)));
    submitEvaluation(
      overallPct >= 60,
      overallPct,
      {
        type: 'number-tracer',
        ...(types.length === 1 ? { evalMode: types[0] } : {}),
        tracingAccuracy: overallPct,
        digitsCompleted: challengeResults.filter(r => r.correct).length,
        totalDigits: challenges.length,
        attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
      },
      { studentWork: { responses: responsesRef.current.map(({ challengeId, type, attempt, target, writtenAs, score, correct }) =>
        ({ challengeId, type, attempt, target, writtenAs, score, correct })) } },
      undefined,
      // Items retry until accepted, so the first-response score inside the evidence is what lets the shared gate see errors.
      numberTracerDiagnosisEvidence(challenges.map(c => c.id), responsesRef.current),
    );
  }, [challenges, challengeResults, submitEvaluation]);

  // ── Submit once when the session completes, and only under an evaluation provider (the live host has none). ──
  const completionHandled = useRef(false);
  useEffect(() => { completionHandled.current = false; }, [challenges]);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0 || completionHandled.current) return;
    completionHandled.current = true;
    const overallPct = Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
      / Math.max(1, challengeResults.length),
    );
    if (progress.recordsEvaluation !== false) submitSession(overallPct);
  }, [allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults, submitSession, progress.recordsEvaluation]);

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
    if (hasSubmittedEvaluation || isCurrentChallengeComplete || learnerClosed) return;
    e.preventDefault();
    const p = getCanvasCoords(e);
    if (!p) return;
    setIsDrawing(true);
    setCurrentStroke([p]);
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, isCurrentChallengeComplete, getCanvasCoords, learnerClosed]);

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
      SoundManager.tap();        // ← tactile: a pen stroke lands
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

    // ── Which guides to paint: the tier's starting guides plus the help levers in force
    // (canvasGuides). Copy's model panel is rendered in JSX, not on the canvas.
    const { ghost: paintGhost, arrows: paintArrows, dots: paintStartDots, firstPart: paintFirstPart } = canvasGuides;
    // Faint the ghost at non-easy tiers so withdrawal feels graduated.
    const ghostFaint = currentChallenge.supportTier != null && currentChallenge.supportTier !== 'easy';
    const dotted = (points: PathPoint[], style: string, width: number) => {
      if (points.length < 2) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.setLineDash([4, 8]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Ghost numeral the student traces over
    if (paintGhost) {
      for (const path of idealPaths) {
        dotted(path, currentChallenge.type === 'trace'
          ? (ghostFaint ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.4)')
          : 'rgba(148, 163, 184, 0.2)', currentChallenge.type === 'trace' ? 12 : 8);
      }
    }
    // write's `first_part`: the opening of the first stroke only (firstPartLeaks bounds it)
    if (paintFirstPart) dotted(firstPart(idealPaths), 'rgba(59, 130, 246, 0.4)', 12);

    // Direction arrows along each stroke (withdrawable scaffold / `stroke_arrows`)
    if (paintArrows) {
      for (const path of idealPaths) {
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

    // Start dots (withdrawable scaffold / `start_dots`), numbered in drawing order when there is more than one stroke
    if (paintStartDots) {
      const dots = startDots(idealPaths);
      dots.forEach((p, i) => {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        if (dots.length > 1) {
          ctx.fillStyle = 'rgba(187, 247, 208, 0.95)';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(String(i + 1), p.x + 11, p.y - 9);
        }
      });
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
  }, [currentChallenge, idealPaths, allStrokes, currentStroke, canvasGuides]);

  // ── Check ───────────────────────────────────────────────────────────

  const handleCheckDrawing = useCallback(async () => {
    if (!currentChallenge || isEvaluating || learnerClosed) return;
    if (allStrokes.flat().length < MIN_STROKE_POINTS) {
      SoundManager.invalid();    // ← blocked action, not a wrong answer
      setFeedback('Keep writing! Draw the full number.');
      setFeedbackType('error');
      return;
    }

    const guides = paintedGuides(currentChallenge);
    // A practice item (a simplify lever's easier item) is ungraded: no response record, no session result.
    const isPractice = !!practice;
    const record = (writtenAs: string | null, score: number, correct: boolean) => isPractice ? 0 : responsesRef.current.push({
      challengeId: currentChallenge.id, type: currentChallenge.type, attempt: currentAttempts + 1, target: currentChallenge.digit,
      ...(currentChallenge.type === 'sequence' ? { sequenceNumbers: currentChallenge.sequenceNumbers, missingIndex: currentChallenge.missingIndex } : {}),
      writtenAs, score, correct, guideShown: guides.ghost, modelShown: currentChallenge.type === 'copy' && currentChallenge.showModel,
      hintShown: !!currentChallenge.hint && currentAttempts >= 2, supportTier: currentChallenge.supportTier,
    });

    // trace mode: student must follow guide at exact position — no normalization
    // copy/write/sequence: student writes anywhere — normalize bounding box before scoring
    const shouldNormalize = currentChallenge.type !== 'trace';

    const accuracy = scoreStrokeAccuracy(allStrokes, idealPaths, shouldNormalize);
    const coverage = computePathCoverage(allStrokes, idealPaths, shouldNormalize);
    const geoScore = Math.round(accuracy * 0.6 + coverage * 0.4);

    // One stroke of a numeral (`trace_part`) is not a numeral the vision judge can read: geometry decides it alone.
    if (currentChallenge.strokePart) {
      const ok = geoScore >= 70;
      setLastScore(geoScore);
      progress.commitCheck(describeWriting(geoScore, null), ok,
        ok ? undefined : numberTracerMiss(currentChallenge.digit, { writtenAs: null, accuracy, coverage }));
      if (ok) SoundManager.playCorrect(); else SoundManager.playIncorrect();
      setFeedback(ok ? 'Good tracing!' : 'Follow the dotted path more closely.');
      setFeedbackType(ok ? 'success' : 'error');
      return;
    }

    // trace: geometry at the guide's position establishes the stroke, so a close trace is accepted outright.
    // copy/write/sequence: geometry is scaled into the target's box and cannot tell which numeral was
    // written (a 2 scored 90 against 3), so the vision judge decides every check (NT-6).
    if (!shouldNormalize && geoScore >= 90) {
      record(null, geoScore, true);
      // The canvas's own check is the workspace's checked gesture.
      progress.commitCheck(describeWriting(geoScore, null), true);
      SoundManager.playCorrect();
      setLastScore(geoScore);
      setFeedback('Excellent writing!');
      setFeedbackType('success');
      if (!isPractice) recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
        score: geoScore,
        accuracy,
        coverage,
      });
      return;
    }

    setIsEvaluating(true);
    setFeedback('Checking your writing…');
    setFeedbackType('');

    try {
      const base64 = renderInkForJudge(allStrokes);

      // A failed request falls back to geometry below, like a low-confidence reading.
      const geminiResult = base64
        ? await evaluateDigitDrawing(base64, currentChallenge.digit, currentChallenge.type).catch(() => null)
        : null;

      // Use Gemini score if it has reasonable confidence, otherwise fall back to geo score
      const trusted = !!geminiResult && geminiResult.confidence >= 60;
      const finalScore = trusted ? geminiResult!.score : geoScore;

      setLastScore(finalScore);
      const isCorrect = finalScore >= 50;
      record(trusted ? geminiResult!.writtenAs ?? '?' : null, finalScore, isCorrect);
      const writtenAs = trusted ? geminiResult!.writtenAs ?? null : null;
      progress.commitCheck(describeWriting(finalScore, writtenAs), isCorrect,
        isCorrect ? undefined : numberTracerMiss(currentChallenge.digit, { writtenAs, accuracy, coverage }));

      if (isCorrect) {
        SoundManager.playCorrect();
        const feedbackMsg = geminiResult?.feedback
          ?? (finalScore >= 80 ? 'Excellent writing!' : 'Good job! You wrote the number!');
        setFeedback(feedbackMsg);
        setFeedbackType('success');
        if (!isPractice) recordResult({
          challengeId: currentChallenge.id,
          correct: true,
          attempts: currentAttempts + 1,
          score: finalScore,
          accuracy,
          coverage,
          geminiScore: geminiResult?.score,
          geminiVariant: geminiResult?.variant,
        });
      } else {
        SoundManager.playIncorrect();
        const feedbackMsg = geminiResult?.feedback
          ?? (currentChallenge.type === 'trace'
            ? 'Follow the dotted path more closely.'
            : 'Try again — write the whole number clearly.');
        setFeedback(feedbackMsg);
        setFeedbackType('error');
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [currentChallenge, allStrokes, idealPaths, currentAttempts, isEvaluating, recordResult, learnerClosed, progress, practice]);

  const handleClear = useCallback(() => {
    setAllStrokes([]);
    setCurrentStroke([]);
    setFeedback('');
    setFeedbackType('');
    setLastScore(null);
    setIsEvaluating(false);
  }, []);

  // ── What the tutor and the observer are shown, republished every render. ──
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, { strokes: allStrokes.length });
    // Levers belong to the session item; a practice item offers none. A starting guide (the tier's) shows as pulled.
    const levers = practice ? [] : NUMBER_TRACER_LEVERS.declare(sessionChallenge, null, leversOn);
    const published = leverScene(scene, {
      support: practice ? '' : NUMBER_TRACER_LEVERS.support(sessionChallenge, null),
      onScreen: practice ? '' : NUMBER_TRACER_LEVERS.onScreen(sessionChallenge, null, leversOn),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts,
        ...(practice ? { practice: practice.strokePart ? `${PRACTICE_NOTE} It is one stroke of the numeral.` : PRACTICE_NOTE } : {}) },
      readyForResponse: !isEvaluating,
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on the screen.`;
        const next = { item: sessionChallenge.id, pulled: [...runtimePulled, id] };
        if (lever.kind === 'simplify') {
          const easier = NUMBER_TRACER_LEVERS.simpler(sessionChallenge, null, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next); setPractice(easier); resetWork();
          return { practice: numberTracerBoss.assignment!(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setPractice(null); resetWork(); },
    };
  });

  // ── Render ──────────────────────────────────────────────────────────

  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          No challenges available.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isSequenceMode = currentChallenge?.type === 'sequence';
  const showModelStrokes = leversOn.includes(MODEL_STROKES_LEVER);
  const dotRows = leversOn.includes(COUNT_DOTS_LEVER) && currentChallenge ? countDots(currentChallenge) : null;
  /** What the canvas paints, for the DOM (jsdom has no 2D context): the guides in force, by name. */
  const guideNames = [canvasGuides.ghost && 'ghost', canvasGuides.dots && 'start_dots', canvasGuides.arrows && 'arrows',
    canvasGuides.firstPart && 'first_part'].filter(Boolean).join(' ');
  const typeAccent = (CHALLENGE_TYPE_CONFIG[currentChallenge?.type ?? 'trace']?.accentColor
    ?? 'blue') as LuminaAccent;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            {currentChallenge && (
              <LuminaBadge accent={typeAccent}>
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.icon}{' '}
                {CHALLENGE_TYPE_CONFIG[currentChallenge.type]?.label}
              </LuminaBadge>
            )}
            {practice && <LuminaBadge accent="amber" className="text-[10px] uppercase tracking-wider">Practice</LuminaBadge>}
            <LuminaChallengeCounter
              current={Math.min(currentChallengeIndex + 1, challenges.length)}
              total={challenges.length}
            />
          </div>
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="space-y-2">
            <LuminaPrompt center>
              <span className="text-lg">{currentChallenge.instruction}</span>
            </LuminaPrompt>
            {currentChallenge.hint && currentAttempts >= 2 && (
              <p className="text-center text-sm text-blue-400">{currentChallenge.hint}</p>
            )}
          </div>
        )}

        {!allChallengesComplete && currentChallenge && (
          <>
            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the model or counting run
                and the canvas as one region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {/* Copy mode: show model digit alongside */}
              {currentChallenge.type === 'copy' && (currentChallenge.showModel || showModelStrokes) && (
                <div className="flex justify-center">
                  <LuminaPanel className="p-3 flex items-center gap-3">
                    <div>
                      <p className="text-xs text-slate-500 text-center mb-1">Model</p>
                      <div className="text-7xl font-bold text-slate-300 text-center px-4 select-none">
                        {currentChallenge.digit}
                      </div>
                    </div>
                    {/* `model_strokes`: the model as its strokes, a numbered start dot and an arrow on each; the canvas stays blank */}
                    {showModelStrokes && (
                      <svg data-lever="model-strokes" width={120} height={96} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden>
                        {idealPaths.map((stroke, si) => {
                          const last = stroke[stroke.length - 1], prev = stroke[stroke.length - 2] ?? stroke[0];
                          const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * 180 / Math.PI;
                          return (
                            <g key={si} data-stroke={si + 1}>
                              <polyline points={stroke.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(203, 213, 225, 0.8)"
                                strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M -18 -14 L 10 0 L -18 14 Z" fill="rgba(96, 165, 250, 0.95)"
                                transform={`translate(${last.x},${last.y}) rotate(${angle})`} />
                              <circle cx={stroke[0].x} cy={stroke[0].y} r={22} fill="rgba(34, 197, 94, 0.9)" />
                              <text x={stroke[0].x} y={stroke[0].y + 10} textAnchor="middle" fontSize={30} fontWeight="bold" fill="#052e16">{si + 1}</text>
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </LuminaPanel>
                </div>
              )}

              {/* Sequence context (shown above canvas in sequence mode) */}
              {isSequenceMode && currentChallenge.sequenceNumbers && (
                <div className="flex justify-center">
                  <LuminaPanel className="rounded-xl px-6 py-3">
                    <div className="flex items-center gap-2 text-4xl font-bold">
                      {/* Defensive cap: the generator builds bounded runs (≤5), but never
                          let a malformed array stretch off-screen and OOM the tab again. */}
                      {currentChallenge.sequenceNumbers.slice(0, 12).map((num, i) => (
                        <React.Fragment key={i}>
                          <span className="inline-flex flex-col items-center">
                            <span className={i === currentChallenge.missingIndex
                              ? 'text-blue-400 border-b-2 border-blue-400 px-2'
                              : 'text-slate-200 px-1'
                            }>
                              {i === currentChallenge.missingIndex ? '?' : num}
                            </span>
                            {/* `count_dots`: as many dots as the shown number; nothing under the gap */}
                            {dotRows && (
                              <span data-lever="count-dots" data-dots={dotRows[i] ?? 'gap'}
                                className="mt-1 grid grid-cols-5 gap-0.5 min-h-[8px] w-[44px] justify-items-center">
                                {Array.from({ length: dotRows[i] ?? 0 }, (_, k) => (
                                  <span key={k} className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                                ))}
                              </span>
                            )}
                          </span>
                          {i < Math.min(currentChallenge.sequenceNumbers!.length, 12) - 1 && (
                            <span className="text-slate-600 text-2xl">,</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-1">Write the missing number below</p>
                  </LuminaPanel>
                </div>
              )}

              {/* Canvas (all drawing modes) — bespoke interaction surface */}
              <div className="flex justify-center">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    data-pip-object="canvas"
                    data-guides={guideNames || undefined}
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
                    <LuminaBadge accent="emerald" className="absolute top-3 right-3 text-lg font-bold">
                      {lastScore}%
                    </LuminaBadge>
                  )}
                </div>
              </div>
            </PipWorkspace>
          </>
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
        {!isEvaluating && feedback && feedbackType && (
          <LuminaFeedbackCard
            status={feedbackType === 'success' ? 'correct' : 'incorrect'}
            className="p-4"
          >
            <span className="text-base">{feedback}</span>
          </LuminaFeedbackCard>
        )}
        {!isEvaluating && feedback && !feedbackType && (
          <div className="text-center text-sm font-medium text-slate-400">{feedback}</div>
        )}

        {/* Clear and Check; the runtime retries and advances. */}
        {!allChallengesComplete && currentChallenge && (
          <div className="flex justify-center gap-3">
            <LuminaButton
              tone="subtle"
              onClick={handleClear}
              disabled={allStrokes.length === 0 || isCurrentChallengeComplete || isEvaluating || learnerClosed}
            >
              Clear
            </LuminaButton>
            {!isCurrentChallengeComplete && (
              <LuminaActionButton
                action="check"
                onClick={handleCheckDrawing}
                disabled={allStrokes.length === 0 || isEvaluating || learnerClosed}
              >
                {isEvaluating ? 'Checking…' : 'Check'}
              </LuminaActionButton>
            )}
          </div>
        )}

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? Math.round(
              challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
              / Math.max(1, challengeResults.length),
            ))}
            durationMs={elapsedMs}
            heading="Number Writing Complete!"
            celebrationMessage="You practiced writing numbers!"
            className="mb-6"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const NumberTracer = withWorkspaceOnly<NumberTracerProps>('number-tracer', NumberTracerSurface, props => props.data.title);

export default NumberTracer;
