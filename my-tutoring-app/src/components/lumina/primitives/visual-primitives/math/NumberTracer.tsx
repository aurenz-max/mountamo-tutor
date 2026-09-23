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
import { useLuminaAI } from '../../../hooks/useLuminaAI';
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
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { numberTracerPipPose } from '../../../pip/numberTracerPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';

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
}

import type { LearningAdaptation } from '../../../service/generation/learningAdaptation';
import { useNumberTracerRuntime } from './useNumberTracerRuntime';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeWriting, workspaceAssignment, workspaceScene } from './numberTracerWorkspace';
import { DIGIT_PATHS, getDigitPaths } from './numberTracerPaths';
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
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const NumberTracerSurface = ({ data, className, runtimePlanItemId, runtimeEvalMode, tutorOwned, useController }:
  NumberTracerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<NumberTracerChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  // ── Challenge Progress (shared hooks). On the workspace path the runtime moves the index.
  const stableInstanceIdRef = useRef(instanceId || `number-tracer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || challenges[0]?.type || 'trace', workspace, assignment: workspaceAssignment,
    // A fresh challenge and Try again both start from an empty canvas.
    onItemOpened: () => {
      setAllStrokes([]); setCurrentStroke([]); setFeedback(''); setFeedbackType('');
      setHasChecked(false); setLastScore(null);
    },
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
  /** Workspace path: a checked writing stays closed until Try again or Next challenge on the shell. */
  const learnerClosed = tutorOwned && progress.canAttempt === false;

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

  // ── AI Tutoring Integration ─────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeType: currentChallenge?.type ?? 'trace',
    digit: currentChallenge?.digit ?? 0,
    instruction: currentChallenge?.instruction ?? '',
    showModel: currentChallenge?.showModel ?? true,
    showArrows: currentChallenge?.showArrows ?? true,
    supportTier: currentChallenge?.supportTier,
    attemptNumber: currentAttempts + 1,
    gradeBand,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    lastScore,
  }), [currentChallenge, currentAttempts, gradeBand, challenges.length, currentChallengeIndex, lastScore]);

  // Tier-aware reveal policy: at HARD the tracing scaffolds are withdrawn on the
  // canvas, so the tutor must not narrate the strokes or trace the digit for the
  // student — it encourages recall of the digit's shape instead. At easy/medium it
  // may walk the stroke order. Never reveals a sequence-mode answer at any tier.
  const tutorRevealClause = useCallback((ch: NumberTracerChallenge | null): string => {
    if (!ch) return '';
    if (ch.type === 'sequence') {
      return ' [SEQUENCE] No tracing guide is shown, and the missing number is the answer — never say it, '
        + 'trace it, or describe its strokes; ask the student to count on from the first number.';
    }
    if (ch.supportTier === 'hard') {
      return ' [SUPPORT_TIER hard] The on-screen tracing guides are withdrawn — do NOT narrate the '
        + 'individual strokes or trace the digit for the student; encourage them from memory of the '
        + `digit's shape (e.g. "picture how a ${ch.digit} looks, then write it"). Never reveal the answer.`;
    }
    if (ch.supportTier === 'medium') {
      return ' [SUPPORT_TIER medium] A faint guide and start dot remain but the stroke arrows are gone — '
        + 'nudge the stroke direction only; do not over-narrate every stroke.';
    }
    if (ch.supportTier === 'easy') {
      return ' [SUPPORT_TIER easy] Full tracing guides are on — you may name the stroke order and walk '
        + 'the student along the dotted path and start dot.';
    }
    return '';
  }, []);

  const { sendText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'number-tracer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    // The workspace packet replaces this context.
    enabled: !tutorOwned,
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Number Tracer activity for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges covering numeral writing. `
      + `First challenge: "${currentChallenge?.instruction}" (type: ${currentChallenge?.type}, digit: ${currentChallenge?.digit}). `
      + `Introduce warmly: "Let's practice writing numbers! We'll trace, copy, and write them."`,
      { silent: true },
    );
  }, [isConnected, challenges.length, gradeBand, currentChallenge, sendText, tutorOwned]);

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

  // ── Auto-submit evaluation when all challenges complete ─────────────
  // The action buttons are hidden when allChallengesComplete is true,
  // so handleNextChallenge is never called for the last challenge.
  // Once per session: re-renders after completion must not submit again before `hasSubmitted` commits.
  const completionHandled = useRef(false);
  useEffect(() => { completionHandled.current = false; }, [challenges]);
  useEffect(() => {
    if (!allChallengesComplete || hasSubmittedEvaluation || challenges.length === 0 || completionHandled.current) return;
    completionHandled.current = true;

    const overallPct = Math.round(
      challengeResults.reduce((s, r) => s + (r.score ?? (r.correct ? 100 : 0)), 0)
      / Math.max(1, challengeResults.length),
    );

    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation !== false) submitSession(overallPct);
    if (tutorOwned) return;

    const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
    sendText(
      `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
      + `Give encouraging phase-specific feedback about numeral writing progress.`,
      { silent: true },
    );
  }, [
    allChallengesComplete, hasSubmittedEvaluation, challenges, challengeResults,
    phaseResults, submitSession, sendText, progress.recordsEvaluation, tutorOwned,
  ]);

  // ── Pip shared surface ──────────────────────────────────────────────
  // A projection of this item's check state and the child's ink; Pip never
  // draws, checks, or advances. Tutor audio counts only while the tutor is on
  // this block — another block's speech is not a cue here.
  const pip = usePipTargets(currentChallenge?.id ?? null, false);
  const tutorSpeaking = isAudioPlaying && activePrimitiveId === resolvedInstanceId;
  const speechOnItem = useSpeechScope(currentChallenge?.id ?? null, tutorSpeaking);
  const hasInk = allStrokes.length > 0 || isDrawing;
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || allChallengesComplete || hasSubmittedEvaluation) return null;
    const targets = [
      ...(canvasRef.current ? [{ id: 'canvas', label: 'Writing canvas', element: canvasRef.current }] : []),
      ...pip.targets(['model', 'gap'], (id) => (id === 'model' ? 'Model number' : 'Missing number')),
    ];
    const pose = numberTracerPipPose({
      running: true, preparing: false, currentSolved: isCurrentChallengeComplete, revealHeld: false,
      judging: isEvaluating, tutorSpeaking, cueMatchesItem: !tutorSpeaking || speechOnItem,
      challengeType: currentChallenge.type, visibleIds: targets.map((target) => target.id), hasInk,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Number writing',
      dock: pip.dock.current, targets, pose,
    };
  });

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
  }, [hasSubmittedEvaluation, isCurrentChallengeComplete, currentChallenge?.type, getCanvasCoords, learnerClosed]);

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

    // ── Resolve which tracing guides to paint ── (the tier only withdraws guides; copy's
    // model panel is rendered in JSX, not on the canvas)
    const { ghost: paintGhost, arrows: paintArrows, startDot: paintStartDot } = paintedGuides(currentChallenge);
    // Faint the ghost at non-easy tiers so withdrawal feels graduated.
    const ghostFaint = currentChallenge.supportTier != null && currentChallenge.supportTier !== 'easy';

    // Draw guide paths (ghost numeral the student traces over)
    if (paintGhost) {
      for (const path of idealPaths) {
        if (path.length < 2) continue;
        // Dotted guide
        ctx.strokeStyle = currentChallenge.type === 'trace'
          ? (ghostFaint ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.4)')
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

        // Start dot (withdrawable scaffold)
        if (paintStartDot) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.beginPath();
          ctx.arc(path[0].x, path[0].y, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Direction arrows (withdrawable scaffold)
        if (paintArrows) {
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
    if (!currentChallenge || isEvaluating || learnerClosed) return;
    if (allStrokes.flat().length < MIN_STROKE_POINTS) {
      SoundManager.invalid();    // ← blocked action, not a wrong answer
      setFeedback('Keep writing! Draw the full number.');
      setFeedbackType('error');
      return;
    }

    incrementAttempts();
    setHasChecked(true);
    const guides = paintedGuides(currentChallenge);
    const record = (writtenAs: string | null, score: number, correct: boolean) => responsesRef.current.push({
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

    // trace: geometry at the guide's position establishes the stroke, so a close trace is accepted outright.
    // copy/write/sequence: geometry is scaled into the target's box and cannot tell which numeral was
    // written (a 2 scored 90 against 3), so the vision judge decides every check (NT-6).
    if (!shouldNormalize && geoScore >= 90) {
      record(null, geoScore, true);
      // The canvas's own check is the workspace's checked gesture.
      progress.commitCheck?.(describeWriting(geoScore, null), true);
      SoundManager.playCorrect();
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
      if (!tutorOwned) sendText(
        `[ANSWER_CORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}) `
        + `geo score ${geoScore}%. Celebrate excellent form!`,
        { silent: true },
      );
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
      progress.commitCheck?.(describeWriting(finalScore, trusted ? geminiResult!.writtenAs ?? null : null), isCorrect);

      if (isCorrect) {
        SoundManager.playCorrect();
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
        if (!tutorOwned) sendText(
          `[ANSWER_CORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}). `
          + `Geo: ${geoScore}%, Gemini: ${geminiResult?.score ?? 'n/a'}% (${geminiResult?.variant ?? ''}). `
          + `Final: ${finalScore}%. Attempt ${currentAttempts + 1}. Praise the effort.`,
          { silent: true },
        );
      } else {
        SoundManager.playIncorrect();
        const feedbackMsg = geminiResult?.feedback
          ?? (currentChallenge.type === 'trace'
            ? 'Follow the dotted path more closely.'
            : 'Try again — write the whole number clearly.');
        setFeedback(feedbackMsg);
        setFeedbackType('error');
        if (!tutorOwned) sendText(
          `[ANSWER_INCORRECT] Student wrote digit ${currentChallenge.digit} (${currentChallenge.type}). `
          + `Geo: ${geoScore}%, Gemini: ${geminiResult?.score ?? 'n/a'}% (${geminiResult?.variant ?? ''}). `
          + `Final: ${finalScore}%. Attempt ${currentAttempts + 1}. Give a hint.`
          + tutorRevealClause(currentChallenge),
          { silent: true },
        );
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [currentChallenge, allStrokes, idealPaths, currentAttempts, isEvaluating, incrementAttempts, recordResult, sendText, tutorRevealClause,
      learnerClosed, progress, tutorOwned]);

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

      if (!hasSubmittedEvaluation) submitSession(overallPct);

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
      + `Instruction: "${challenges[currentChallengeIndex + 1]?.instruction}". Introduce briefly.`
      + tutorRevealClause(challenges[currentChallengeIndex + 1] ?? null),
      { silent: true },
    );
  }, [
    advanceProgress, challengeResults, challenges, currentChallengeIndex,
    hasSubmittedEvaluation, phaseResults, sendText, submitSession, tutorRevealClause,
  ]);

  // ── Live tutor runtime ──────────────────────────────────────────────
  // The tutor drives the learner's OWN handlers; grading and progression are
  // untouched. `promptRef` exists so `replay` has a real, focusable effect
  // rather than a claim, and the label matches the shared journey probe.
  const promptRef = useRef<HTMLDivElement | null>(null);
  const runtimeHint = useNumberTracerRuntime({
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    evalMode: runtimeEvalMode || currentChallenge?.type || 'trace',
    challenge: currentChallenge, index: currentChallengeIndex, attempts: currentAttempts,
    checked: hasChecked, correct: hasChecked && feedbackType === 'success',
    incorrect: hasChecked && feedbackType === 'error', completed: allChallengesComplete,
    score: lastScore, strokeCount: allStrokes.length,
    guideStrokeCount: idealPaths.length,
    inkPoints: allStrokes.reduce((total, stroke) => total + stroke.length, 0),
    guidePoints: idealPaths.reduce((total, stroke) => total + stroke.length, 0),
    advance: handleNextChallenge,
    clear: handleClear,
    disabled: tutorOwned,
    replay: () => { promptRef.current?.focus(); return !!promptRef.current && document.activeElement === promptRef.current; },
    // Ending the stroke is the whole of this canvas's quiescing: there is no
    // timer here, and a half-drawn stroke left live would land after the detour.
    cancelStroke: () => { setIsDrawing(false); setCurrentStroke([]); },
  });

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge) return;
    workspace.current = { ...workspaceScene(currentChallenge, { strokes: allStrokes.length }),
      demonstration: [], canDemonstrate: false, canPresent: false, readyForResponse: !isEvaluating,
      mark: () => {}, clearPresentation: () => {} };
    progress.publishWorkspace?.();
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
            <LuminaChallengeCounter
              current={currentChallengeIndex + 1}
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
            <div ref={promptRef} tabIndex={-1} aria-label="Current instruction" className="outline-none">
              <LuminaPrompt center>
                <span className="text-lg">{currentChallenge.instruction}</span>
              </LuminaPrompt>
            </div>
            {currentChallenge.hint && currentAttempts >= 2 && (
              <p className="text-center text-sm text-blue-400">{currentChallenge.hint}</p>
            )}
          </div>
        )}

        {/* Copy mode: show model digit alongside */}
        {currentChallenge?.type === 'copy' && currentChallenge.showModel && !allChallengesComplete && (
          <div className="flex justify-center">
            <LuminaPanel className="p-3">
              <p className="text-xs text-slate-500 text-center mb-1">Model</p>
              <div ref={pip.ref('model')} data-pip-object="model" className="text-7xl font-bold text-slate-300 text-center px-4 select-none">
                {currentChallenge.digit}
              </div>
            </LuminaPanel>
          </div>
        )}

        {/* Sequence context (shown above canvas in sequence mode) */}
        {isSequenceMode && currentChallenge?.sequenceNumbers && !allChallengesComplete && (
          <div className="flex justify-center">
            <LuminaPanel className="rounded-xl px-6 py-3">
              <div className="flex items-center gap-2 text-4xl font-bold">
                {/* Defensive cap: the generator builds bounded runs (≤5), but never
                    let a malformed array stretch off-screen and OOM the tab again. */}
                {currentChallenge.sequenceNumbers.slice(0, 12).map((num, i) => (
                  <React.Fragment key={i}>
                    <span ref={i === currentChallenge.missingIndex ? pip.ref('gap') : undefined}
                      data-pip-object={i === currentChallenge.missingIndex ? 'gap' : undefined} className={i === currentChallenge.missingIndex
                      ? 'text-blue-400 border-b-2 border-blue-400 px-2'
                      : 'text-slate-200 px-1'
                    }>
                      {i === currentChallenge.missingIndex ? '?' : num}
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
        {!allChallengesComplete && (
          <div className="flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                data-pip-object="canvas"
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
        )}

        {pipStore && !allChallengesComplete && (
          <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
            className="mx-auto flex min-h-28 w-full max-w-[500px] items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
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

        {/* Action buttons */}
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
            {!tutorOwned && isCurrentChallengeComplete && (
              <LuminaActionButton action="next" onClick={handleNextChallenge}>
                {currentChallengeIndex < challenges.length - 1 ? 'Next' : 'Finish'}
              </LuminaActionButton>
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
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never registers the tool-lab mount, whose advance command would compete with the observer.
const NumberTracer = withWorkspaceController<NumberTracerProps, ProgressOptions<NumberTracerChallenge>, Progress>(
  'number-tracer', NumberTracerSurface, useScriptedProgress, useWorkspaceProgressFor('number-tracer'));

export default NumberTracer;
