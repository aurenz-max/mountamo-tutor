'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

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
// Canvas constants
// ============================================================================

const CANVAS_W = 460;
const CANVAS_H = 460;
const GRID_MIN = -7;
const GRID_MAX = 7;
const UNITS = GRID_MAX - GRID_MIN; // 14
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = CANVAS_H / 2;
const CELL = CANVAS_W / UNITS;
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

// ============================================================================
// Pure geometry helpers
// ============================================================================

const worldToScreen = (p: GridPoint) => ({
  x: ORIGIN_X + p.x * CELL,
  y: ORIGIN_Y - p.y * CELL,
});

const ptKey = (p: GridPoint) => `${p.x},${p.y}`;

/** Order-independent equality of two vertex sets. */
function polygonsMatch(a: GridPoint[], b: GridPoint[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(ptKey).sort();
  const sb = b.map(ptKey).sort();
  return sa.every((v, i) => v === sb[i]);
}

/** Apply a single palette op to one point. */
function applyOp(op: SequenceOp, p: GridPoint): GridPoint {
  switch (op) {
    case 'reflect_x':  return { x: p.x, y: -p.y };
    case 'reflect_y':  return { x: -p.x, y: p.y };
    case 'rotate90':   return { x: -p.y, y: p.x };  // 90° CCW about origin
    case 'rotate180':  return { x: -p.x, y: -p.y };
    case 'rotate270':  return { x: p.y, y: -p.x };  // 270° CCW (= 90° CW)
    case 'tr_up':      return { x: p.x, y: p.y + 1 };
    case 'tr_down':    return { x: p.x, y: p.y - 1 };
    case 'tr_left':    return { x: p.x - 1, y: p.y };
    case 'tr_right':   return { x: p.x + 1, y: p.y };
  }
}

const SEQUENCE_PALETTE: { op: SequenceOp; label: string }[] = [
  { op: 'reflect_x', label: 'Reflect over x-axis' },
  { op: 'reflect_y', label: 'Reflect over y-axis' },
  { op: 'rotate90', label: 'Rotate 90° ⟲' },
  { op: 'rotate180', label: 'Rotate 180°' },
  { op: 'rotate270', label: 'Rotate 270° ⟲' },
  { op: 'tr_left', label: '← Left' },
  { op: 'tr_right', label: 'Right →' },
  { op: 'tr_up', label: '↑ Up' },
  { op: 'tr_down', label: '↓ Down' },
];

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
}

const TransformationLab: React.FC<TransformationLabProps> = ({ data, className }) => {
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
  const stableInstanceIdRef = useRef(instanceId || `transformation-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    // Drag / sequence start from a copy of the pre-image; the student moves it.
    setWorkingImage(currentChallenge.preImage.map((p) => ({ ...p })));
    setSequenceSteps([]);
    setSelectedOption(null);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    recordedRef.current = false;
    hintViewedRef.current = false;
    dragIndexRef.current = null;
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
    ctx.strokeStyle = COL_AXIS;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, ORIGIN_Y);
    ctx.lineTo(CANVAS_W, ORIGIN_Y);
    ctx.moveTo(ORIGIN_X, 0);
    ctx.lineTo(ORIGIN_X, CANVAS_H);
    ctx.stroke();
    // axis ticks every 2 units
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let g = GRID_MIN; g <= GRID_MAX; g += 2) {
      if (g === 0) continue;
      const sx = worldToScreen({ x: g, y: 0 });
      ctx.fillText(`${g}`, sx.x, ORIGIN_Y + 12);
      const sy = worldToScreen({ x: 0, y: g });
      ctx.fillText(`${g}`, ORIGIN_X - 12, sy.y);
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
    const showPreCoords = ch.showPreImageCoords !== false;
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
  }, [currentChallenge, workingImage, resizeTick]);

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
  const eventToWorld = useCallback((clientX: number, clientY: number): GridPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const lx = (clientX - rect.left) * (CANVAS_W / rect.width);
    const ly = (clientY - rect.top) * (CANVAS_H / rect.height);
    return {
      x: Math.round((lx - ORIGIN_X) / CELL),
      y: Math.round((ORIGIN_Y - ly) / CELL),
    };
  }, []);

  const isDragMode = currentChallenge?.answerKind === 'drag';

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragMode || !currentChallenge) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const ly = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    // Find the nearest working handle within hit radius.
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
    if (best >= 0) {
      dragIndexRef.current = best;
      canvas.setPointerCapture(e.pointerId);
      SoundManager.tap();
    }
  }, [isDragMode, currentChallenge, workingImage]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const idx = dragIndexRef.current;
    if (idx === null) return;
    const w = eventToWorld(e.clientX, e.clientY);
    const cx = Math.max(GRID_MIN, Math.min(GRID_MAX, w.x));
    const cy = Math.max(GRID_MIN, Math.min(GRID_MAX, w.y));
    setWorkingImage((prev) => {
      if (prev[idx] && prev[idx].x === cx && prev[idx].y === cy) return prev;
      const next = prev.map((p) => ({ ...p }));
      if (next[idx]) next[idx] = { x: cx, y: cy };
      return next;
    });
  }, [eventToWorld]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      SoundManager.snap();
      const canvas = canvasRef.current;
      try { canvas?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Sequence palette (compose mode)
  // -------------------------------------------------------------------------
  const applySequenceOp = useCallback((op: SequenceOp) => {
    if (!currentChallenge || currentChallenge.answerKind !== 'sequence') return;
    SoundManager.tap();
    setWorkingImage((prev) => prev.map((p) => applyOp(op, p)));
    setSequenceSteps((prev) => [...prev, op]);
  }, [currentChallenge]);

  const resetWorking = useCallback(() => {
    if (!currentChallenge) return;
    SoundManager.tick();
    setWorkingImage(currentChallenge.preImage.map((p) => ({ ...p })));
    setSequenceSteps([]);
  }, [currentChallenge]);

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
  // AI Tutoring
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

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'transformation-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: `Grade ${gradeBand}`,
  });

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
  // Record / submit
  // -------------------------------------------------------------------------
  const completeChallenge = useCallback((correct: boolean) => {
    if (!currentChallenge) return;
    if (!correct) return; // record only on a correct attempt
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

  const handleCheck = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    const ch = currentChallenge;

    // --- identify (multiple choice) ---
    if (ch.answerKind === 'identify') {
      if (selectedOption === null) {
        setFeedback('Pick the transformation that maps the cyan pre-image onto the amber image.');
        setFeedbackType('error');
        return;
      }
      incrementAttempts();
      const correct = selectedOption === ch.correctOption;
      if (correct) {
        SoundManager.playCorrect();
        setFeedback(`Correct — this is a ${ch.transformLabel.toLowerCase()}.`);
        setFeedbackType('success');
        sendText(
          `[ANSWER_CORRECT] Student identified the transformation as "${ch.options?.[selectedOption]}" (correct). Celebrate briefly and restate what stays invariant.`,
          { silent: true },
        );
        completeChallenge(true);
      } else {
        SoundManager.playIncorrect();
        setFeedback('Not quite. Track ONE vertex from the pre-image to the image — did it slide, flip, turn, or scale?');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student chose "${ch.options?.[selectedOption ?? 0]}" but the transformation is "${ch.transformLabel}". `
          + `Attempt ${currentAttempts + 1}. Tell them to follow one corner and notice what changed — do NOT name the answer.`
          + tutorRevealClause(ch.supportTier, true),
          { silent: true },
        );
        setSelectedOption(null);
      }
      return;
    }

    // --- drag / sequence: working image must match the expected image ---
    incrementAttempts();
    const correct = polygonsMatch(workingImage, ch.expectedImage);
    if (correct) {
      SoundManager.playCorrect();
      const tail =
        ch.answerKind === 'sequence'
          ? ` You used ${sequenceSteps.length} step${sequenceSteps.length === 1 ? '' : 's'}.`
          : ch.isSimilarity
          ? ' The image is similar to the original — same shape, scaled size.'
          : ' The image is congruent to the original.';
      setFeedback(`Correct — that's the right image.${tail}`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student produced the correct image for a ${challengeType} task (${ch.transformLabel}). `
        + `Celebrate briefly and reinforce ${ch.isSimilarity ? 'why it is similar (not congruent)' : 'why size and shape were preserved'}.`,
        { silent: true },
      );
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      const nudge =
        ch.answerKind === 'sequence'
          ? 'Not there yet. Compare each working corner to the ghost target and pick the next transformation.'
          : 'Not quite. Apply the rule to each vertex and drag it to the matching grid point.';
      setFeedback(nudge);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student's image does not match the target for ${challengeType} (${ch.transformLabel}). `
        + `Attempt ${currentAttempts + 1}. Coach the coordinate rule for ONE vertex — do NOT give all the answer coordinates.`
        + tutorRevealClause(ch.supportTier, false),
        { silent: true },
      );
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, selectedOption, workingImage, sequenceSteps,
    incrementAttempts, completeChallenge, currentAttempts, sendText, challengeType,
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
        `[NEXT_ITEM] Problem ${nextIdx + 1} of ${challenges.length} (${next?.type}). `
        + `Introduce briefly: "Here's the next one — a new figure to transform."`,
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
          {currentChallenge.ruleNotation && (
            <p className="text-xs text-cyan-300/90 font-mono mt-1">
              <span className="uppercase text-cyan-400/70 mr-2">Rule</span>
              {currentChallenge.ruleNotation}
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

        {/* Canvas — bespoke interaction surface. */}
        <div className="p-3 bg-slate-800/30 rounded-2xl border border-cyan-500/20">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg w-full mx-auto"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, maxWidth: 460, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
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
                <span className="inline-block w-3 h-3 rounded-sm border border-dashed" style={{ borderColor: COL_GHOST }} /> Target
              </span>
            )}
          </div>
          {isDragMode && (
            <p className="text-center text-xs text-cyan-300/80 mt-1">
              Drag each pink corner to where the rule sends it. Corners snap to grid points.
            </p>
          )}
        </div>

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
                      disabled={hasSubmittedEvaluation}
                      onClick={() => {
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
                      disabled={hasSubmittedEvaluation}
                    >
                      {label}
                    </LuminaButton>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Steps: {sequenceSteps.length}
                  </span>
                  <LuminaButton tone="ghost" size="sm" onClick={resetWorking} disabled={hasSubmittedEvaluation}>
                    Reset
                  </LuminaButton>
                </div>
              </LuminaPanel>
            ) : (
              // drag mode — direct manipulation on the canvas; offer a reset.
              <div className="flex justify-center">
                <LuminaButton tone="ghost" size="sm" onClick={resetWorking} disabled={hasSubmittedEvaluation}>
                  Reset corners
                </LuminaButton>
              </div>
            )}

            <div className="flex justify-center">
              <LuminaButton tone="primary" onClick={handleCheck}>
                Check
              </LuminaButton>
            </div>
          </>
        )}

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

        {/* Hint */}
        {showHint && (
          <LuminaPrompt accent="amber">
            <span className="font-mono uppercase text-amber-300 text-xs mr-2">Hint</span>
            {currentChallenge.hint}
          </LuminaPrompt>
        )}

        {/* Controls */}
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

export default TransformationLab;
