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
  LuminaInput,
  LuminaPrompt,
  LuminaFeedbackCard,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CircleExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type CircleExplorerChallengeType =
  | 'discover_pi'
  | 'circumference'
  | 'area'
  | 'reverse'
  | 'composite';

export type CircleCompositeShape =
  | 'semicircle_area'
  | 'semicircle_perimeter'
  | 'circle_in_square';

export interface CircleExplorerChallenge {
  id: string;
  type: CircleExplorerChallengeType;
  /** Short real-world framing (e.g. "A bike wheel is shaped like this circle."). Always present. */
  narration: string;
  /** What the student should do this challenge. */
  instruction: string;
  hint: string;
  /** Linear unit label (e.g. "cm", "m", "units"). Area answers are in <unit>². */
  unitLabel: string;

  /** Radius of the circle in figure units. For circle_in_square this equals squareSide / 2. */
  radius: number;
  /** Which measure is GIVEN to the student (labeled on the figure). */
  given: 'radius' | 'diameter';
  /** Whether the answer uses π ≈ 3.14 (informational; grading uses a tolerance band). */
  usePiApprox: boolean;
  /** What the student must enter: a unitless ratio, a length, or an area. */
  answerKind: 'ratio' | 'length' | 'area';

  // --- reverse mode ---
  /** For reverse: whether the circumference or the area is the given quantity. */
  reverseGiven?: 'circumference' | 'area';
  /** For reverse: the displayed C or A value the student works back from. */
  givenValue?: number;

  // --- composite mode ---
  compositeShape?: CircleCompositeShape;
  /** Side length of the square for circle_in_square. */
  squareSide?: number;

  /** Pre-computed correct answer (single source of truth). */
  expectedAnswer: number;
  /** Absolute tolerance for accepting the numeric answer (covers π ≈ 3.14 rounding). */
  tolerance: number;

  /**
   * Support-tier perception lever (set by the generator's difficulty tier).
   * When false (hard tier), the canvas withholds the explicit formula/answer
   * labels on the manipulative reveal so the student connects visual → symbol
   * unaided. Absent/true = show them (default; no-tier behavior).
   */
  showFormulaReveal?: boolean;
}

export interface CircleExplorerData {
  title: string;
  description: string;
  challengeType: CircleExplorerChallengeType;
  gradeBand?: '7';
  /** 3-6 challenges per session. Required. Built by the generator's pool service. */
  challenges: CircleExplorerChallenge[];
  /** Within-mode support tier (from config.difficulty) — drives the tutor's reveal level. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CircleExplorerMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<CircleExplorerChallengeType, PhaseConfig> = {
  discover_pi:   { label: 'Discover π',   icon: '🥧', accentColor: 'purple' },
  circumference: { label: 'Circumference', icon: '⭕', accentColor: 'cyan' },
  area:          { label: 'Area',          icon: '🟢', accentColor: 'emerald' },
  reverse:       { label: 'Find Radius',   icon: '🔁', accentColor: 'amber' },
  composite:     { label: 'Composite',     icon: '🧩', accentColor: 'blue' },
};

// ============================================================================
// Canvas constants
// ============================================================================

const CANVAS_W = 560;
const CANVAS_H = 420;
const CIRCLE_STROKE = '#22d3ee';
const CIRCLE_FILL = 'rgba(34, 211, 238, 0.12)';
const RADIUS_COLOR = '#fbbf24';
const ACCENT_2 = '#a855f7';
const WEDGE_FILLS = ['rgba(34, 211, 238, 0.30)', 'rgba(168, 85, 247, 0.30)'];
const N_WEDGES = 14;
const ANIM_MS = 750;

// Visual radius used for drawing (the numeric radius is shown as a label; the
// drawn size is fixed so every figure fits the canvas regardless of its value).
const RV = 96;

// ============================================================================
// Math helpers
// ============================================================================

/** Round to one decimal for clean display of a measured/derived quantity. */
const round1 = (n: number): number => Math.round(n * 10) / 10;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================================
// Tutor reveal policy — keep the AI tutor's help in sync with the on-screen tier
// so it never names a formula the instruction/figure deliberately withheld.
// ============================================================================

function tutorRevealPolicy(tier?: 'easy' | 'medium' | 'hard'): string {
  switch (tier) {
    case 'easy':
      return 'SUPPORT TIER easy: you may name the relevant circle formula and walk the setup step by step.';
    case 'hard':
      return 'SUPPORT TIER hard: the instruction and figure deliberately withhold the formula. Do NOT name the formula or the operation — ask what the student sees in the figure (radius, diameter, the unrolled length) and guide conceptually. Never reveal the answer.';
    case 'medium':
    default:
      return 'SUPPORT TIER medium: the formula is on screen in the hint. Nudge the execution and check the radius-vs-diameter choice; do not re-derive the whole formula unprompted.';
  }
}

// ============================================================================
// Component
// ============================================================================

interface CircleExplorerProps {
  data: CircleExplorerData;
  className?: string;
}

const CircleExplorer: React.FC<CircleExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeBand = '7',
    supportTier,
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
  const challengeType = currentChallenge?.type ?? 'circumference';

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);

  // Manipulation: unroll the circumference (discover_pi gates on this) / slice into wedges (area).
  const [unrollProgress, setUnrollProgress] = useState(0); // 0..1
  const [sliceProgress, setSliceProgress] = useState(0);   // 0..1
  const [unrolled, setUnrolled] = useState(false);

  // Bumped by a ResizeObserver so the canvas re-renders crisply when its size changes.
  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `circle-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // discover_pi gates the answer on unrolling first; area's slice is an optional reveal.
  const needsUnrollFirst = challengeType === 'discover_pi' && !unrolled;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setAnswerInput('');
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setUnrollProgress(0);
    setSliceProgress(0);
    setUnrolled(false);
    recordedRef.current = false;
    hintViewedRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Animation driver (unroll / slice) — drives a 0..1 progress over ANIM_MS.
  // -------------------------------------------------------------------------
  const runAnimation = useCallback(
    (setter: (v: number) => void, onDone?: () => void) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ANIM_MS);
        // easeInOutCubic
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setter(eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          setter(1);
          onDone?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [],
  );

  const handleUnroll = useCallback(() => {
    if (unrolled) return;
    SoundManager.tick();
    runAnimation(setUnrollProgress, () => {
      setUnrolled(true);
      SoundManager.snap();
      if (challengeType === 'discover_pi') {
        // At hard the tier withholds the "≈ 3.14" reveal — nudge to measure instead.
        setFeedback(
          currentChallenge?.showFormulaReveal === false
            ? 'Now lay the unrolled length against the diameter — how many diameters long is it?'
            : 'See? The circumference wraps a little more than 3 diameters — always about 3.14.',
        );
        setFeedbackType('info');
      }
    });
  }, [unrolled, runAnimation, challengeType, currentChallenge]);

  const handleSlice = useCallback(() => {
    SoundManager.tick();
    runAnimation(setSliceProgress, () => SoundManager.snap());
  }, [runAnimation]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  // -------------------------------------------------------------------------
  // Canvas draw
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentChallenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI backing store sized to the displayed px; all drawing stays in
    // the logical CANVAS_W×CANVAS_H space.
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

    const unit = currentChallenge.unitLabel;
    const r = currentChallenge.radius;
    const diameter = 2 * r;
    // Support-tier perception lever: at the hard tier the generator sets this
    // false so the canvas withholds the explicit formula/answer labels.
    const showFormula = currentChallenge.showFormulaReveal !== false;

    const label = (x: number, y: number, txt: string, color = '#e2e8f0', align: CanvasTextAlign = 'center') => {
      ctx.fillStyle = color;
      ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, x, y);
    };

    const drawCircle = (cx: number, cy: number, rv: number, fill = true) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rv, 0, 2 * Math.PI);
      if (fill) {
        ctx.fillStyle = CIRCLE_FILL;
        ctx.fill();
      }
      ctx.strokeStyle = CIRCLE_STROKE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
    };

    const drawRadius = (cx: number, cy: number, rv: number, txt: string) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rv, cy);
      ctx.strokeStyle = RADIUS_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
      label(cx + rv / 2, cy - 12, txt, RADIUS_COLOR);
    };

    const drawDiameter = (cx: number, cy: number, rv: number, txt: string) => {
      ctx.beginPath();
      ctx.moveTo(cx - rv, cy);
      ctx.lineTo(cx + rv, cy);
      ctx.strokeStyle = RADIUS_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
      label(cx, cy - 12, txt, RADIUS_COLOR);
    };

    // ----- Mode-specific rendering -----
    if (challengeType === 'discover_pi') {
      const cx = CANVAS_W / 2;
      const cy = 130;
      drawCircle(cx, cy, RV);
      drawDiameter(cx, cy, RV, `d = ${diameter} ${unit}`);
      // At hard, withhold the circumference value so the student must measure it
      // off the unrolled track rather than just dividing two given labels.
      if (showFormula) {
        label(cx, cy - RV - 18, `C = ${round1(Math.PI * diameter)} ${unit}`, CIRCLE_STROKE);
      }

      // Unroll track: a straight segment of length = π diameters, with diameter ticks.
      const trackY = 300;
      const trackStartX = 60;
      const diaPx = (CANVAS_W - 2 * trackStartX) / 3.3; // ~3.3 diameters fits the width
      const fullLen = Math.PI * diaPx;
      const drawnLen = fullLen * unrollProgress;

      // baseline
      ctx.strokeStyle = 'rgba(148,163,184,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(trackStartX, trackY + 22);
      ctx.lineTo(trackStartX + fullLen + 6, trackY + 22);
      ctx.stroke();

      // diameter tick segments (alternating shades) under the track
      for (let k = 0; k < 4; k++) {
        const x0 = trackStartX + k * diaPx;
        if (x0 > trackStartX + fullLen) break;
        const x1 = Math.min(trackStartX + (k + 1) * diaPx, trackStartX + fullLen);
        ctx.strokeStyle = k % 2 === 0 ? 'rgba(251,191,36,0.5)' : 'rgba(251,191,36,0.25)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x0, trackY + 30);
        ctx.lineTo(x1, trackY + 30);
        ctx.stroke();
        if (k < 3) {
          ctx.strokeStyle = 'rgba(148,163,184,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, trackY + 14);
          ctx.lineTo(x0, trackY + 36);
          ctx.stroke();
          if (showFormula) {
            label(x0 + diaPx / 2, trackY + 46, `1 d`, 'rgba(148,163,184,0.8)');
          }
        }
      }

      // the unrolling circumference (cyan), thick
      ctx.strokeStyle = CIRCLE_STROKE;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(trackStartX, trackY);
      ctx.lineTo(trackStartX + drawnLen, trackY);
      ctx.stroke();
      label(trackStartX, trackY - 18, 'Circumference unrolled', CIRCLE_STROKE, 'left');
      if (unrollProgress >= 1 && showFormula) {
        label(trackStartX + fullLen + 4, trackY, '≈ 3.14 d', CIRCLE_STROKE, 'left');
      }
    } else if (challengeType === 'circumference') {
      const cx = CANVAS_W / 2;
      const cy = unrollProgress > 0 ? 140 : CANVAS_H / 2;
      drawCircle(cx, cy, RV);
      if (currentChallenge.given === 'diameter') {
        drawDiameter(cx, cy, RV, `d = ${diameter} ${unit}`);
      } else {
        drawRadius(cx, cy, RV, `r = ${r} ${unit}`);
      }
      // optional unroll reveal
      if (unrollProgress > 0) {
        const trackY = 320;
        const trackStartX = 60;
        const fullLen = CANVAS_W - 2 * trackStartX;
        ctx.strokeStyle = CIRCLE_STROKE;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(trackStartX, trackY);
        ctx.lineTo(trackStartX + fullLen * unrollProgress, trackY);
        ctx.stroke();
        label(
          trackStartX,
          trackY - 18,
          showFormula ? 'C = 2 × π × r = π × d' : 'Circumference unrolled',
          CIRCLE_STROKE,
          'left',
        );
      }
    } else if (challengeType === 'area') {
      const cx = CANVAS_W / 2;
      const cy = 150;
      if (sliceProgress < 0.02) {
        drawCircle(cx, cy, RV);
        drawRadius(cx, cy, RV, currentChallenge.given === 'diameter' ? `d = ${diameter} ${unit}` : `r = ${r} ${unit}`);
      } else {
        // Wedge rearrangement: interpolate each sector from radial → parallelogram strip.
        const dθ = (2 * Math.PI) / N_WEDGES;
        const baseWidth = 2 * RV * Math.sin(dθ / 2);
        const stripStartX = (CANVAS_W - (N_WEDGES / 2) * baseWidth) / 2;
        const baseY = cy + RV / 2;
        const topY = baseY - RV;
        for (let i = 0; i < N_WEDGES; i++) {
          const a0 = i * dθ - Math.PI / 2;
          const a1 = (i + 1) * dθ - Math.PI / 2;
          // circle-layout triangle (apex at center, base on the arc)
          const c0 = { x: cx, y: cy };
          const c1 = { x: cx + RV * Math.cos(a0), y: cy + RV * Math.sin(a0) };
          const c2 = { x: cx + RV * Math.cos(a1), y: cy + RV * Math.sin(a1) };
          // strip-layout triangle (alternating up/down, interlocking)
          const x0 = stripStartX + i * (baseWidth / 2);
          const up = i % 2 === 0;
          const s0 = { x: x0 + baseWidth / 2, y: up ? topY : baseY };       // apex
          const s1 = { x: x0, y: up ? baseY : topY };
          const s2 = { x: x0 + baseWidth, y: up ? baseY : topY };
          const t = sliceProgress;
          const p0 = { x: lerp(c0.x, s0.x, t), y: lerp(c0.y, s0.y, t) };
          const p1 = { x: lerp(c1.x, s1.x, t), y: lerp(c1.y, s1.y, t) };
          const p2 = { x: lerp(c2.x, s2.x, t), y: lerp(c2.y, s2.y, t) };
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.closePath();
          ctx.fillStyle = WEDGE_FILLS[i % 2];
          ctx.fill();
          ctx.strokeStyle = CIRCLE_STROKE;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (sliceProgress >= 1) {
          label(stripStartX - 26, (baseY + topY) / 2, `r`, RADIUS_COLOR);
          // Formula labels are withheld at the hard tier — the rearranged strip
          // (a rectangle ≈ πr by r) stays visible; the symbol is up to the student.
          if (showFormula) {
            label(CANVAS_W / 2, baseY + 26, `base ≈ π × r`, ACCENT_2);
            label(CANVAS_W / 2, topY - 18, `A = π × r²`, CIRCLE_STROKE);
          }
        }
      }
    } else if (challengeType === 'reverse') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2 + 10;
      drawCircle(cx, cy, RV);
      // The radius is the ANSWER — never label it. Show only the given C or A.
      const givenTxt =
        currentChallenge.reverseGiven === 'area'
          ? `A = ${currentChallenge.givenValue} ${unit}²`
          : `C = ${currentChallenge.givenValue} ${unit}`;
      label(cx, cy - RV - 24, givenTxt, CIRCLE_STROKE);
      // a faint radius line with a "?" to cue what is unknown
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + RV, cy);
      ctx.strokeStyle = 'rgba(251,191,36,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      label(cx + RV / 2, cy - 12, `r = ?`, RADIUS_COLOR);
    } else if (challengeType === 'composite') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const shape = currentChallenge.compositeShape;
      if (shape === 'circle_in_square') {
        const half = RV;
        // square
        ctx.beginPath();
        ctx.rect(cx - half, cy - half, 2 * half, 2 * half);
        ctx.strokeStyle = ACCENT_2;
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(168,85,247,0.10)';
        ctx.fill();
        ctx.stroke();
        // inscribed circle
        drawCircle(cx, cy, half);
        label(cx, cy - half - 16, `side = ${currentChallenge.squareSide} ${unit}`, ACCENT_2);
        label(cx, cy + half + 18, `Shaded = square − circle`, '#cbd5e1');
      } else {
        // semicircle (flat side down)
        ctx.beginPath();
        ctx.arc(cx, cy + RV / 2, RV, Math.PI, 2 * Math.PI, false);
        ctx.closePath();
        ctx.fillStyle = CIRCLE_FILL;
        ctx.fill();
        ctx.strokeStyle = CIRCLE_STROKE;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // radius
        ctx.beginPath();
        ctx.moveTo(cx, cy + RV / 2);
        ctx.lineTo(cx + RV, cy + RV / 2);
        ctx.strokeStyle = RADIUS_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
        label(cx + RV / 2, cy + RV / 2 - 12, `r = ${r} ${unit}`, RADIUS_COLOR);
        label(
          cx,
          cy - RV + 6,
          shape === 'semicircle_perimeter' ? 'Find the perimeter (curve + diameter)' : 'Find the area (half a circle)',
          '#cbd5e1',
        );
      }
    }
  }, [currentChallenge, challengeType, unrollProgress, sliceProgress, resizeTick]);

  // Redraw crisply when the canvas's displayed size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

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
  } = usePrimitiveEvaluation<CircleExplorerMetrics>({
    primitiveType: 'circle-explorer',
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
    radius: currentChallenge?.radius ?? null,
    given: currentChallenge?.given ?? 'radius',
    answerKind: currentChallenge?.answerKind ?? 'length',
    reverseGiven: currentChallenge?.reverseGiven ?? null,
    compositeShape: currentChallenge?.compositeShape ?? null,
    unitLabel: currentChallenge?.unitLabel ?? 'units',
    expectedAnswer: currentChallenge?.expectedAnswer ?? null,
    gradeBand,
    supportTier: supportTier ?? 'medium',
    attemptNumber: currentAttempts + 1,
  }), [
    challengeType,
    currentChallenge,
    currentChallengeIndex,
    challenges.length,
    gradeBand,
    supportTier,
    currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'circle-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Grade 7',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Circle session: ${challenges.length} circles, mode "${challengeType}", grade 7. `
      + `Introduce briefly: circumference and area both come from one number, π — the ratio of a circle's distance around to its width. Then read the first task. `
      + tutorRevealPolicy(supportTier),
      { silent: true },
    );
  }, [isConnected, challenges.length, challengeType, supportTier, sendText]);

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

  const unitSuffix = (ch: CircleExplorerChallenge): string => {
    if (ch.answerKind === 'ratio') return '';
    if (ch.answerKind === 'area') return `${ch.unitLabel}²`;
    return ch.unitLabel;
  };

  const handleCheck = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation) return;
    if (needsUnrollFirst) {
      SoundManager.invalid();
      setFeedback('First unroll the circumference to compare it against the diameter.');
      setFeedbackType('error');
      return;
    }
    const trimmed = answerInput.trim();
    if (!trimmed) {
      setFeedback('Enter your answer.');
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
      setFeedback('Enter a number (e.g. 31.4 or 3.14).');
      setFeedbackType('error');
      return;
    }
    const correct = Math.abs(parsed - currentChallenge.expectedAnswer) <= currentChallenge.tolerance;
    incrementAttempts();
    const suffix = unitSuffix(currentChallenge);
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! ${currentChallenge.expectedAnswer}${suffix ? ' ' + suffix : ''}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student answered ${parsed} for a ${challengeType} challenge (radius ${currentChallenge.radius}). `
        + `Expected ${currentChallenge.expectedAnswer}. Celebrate briefly and reinforce the relationship used.`,
        { silent: true },
      );
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Check your formula and whether you used the radius or the diameter, then try again.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${parsed} but the answer is ${currentChallenge.expectedAnswer} `
        + `(${challengeType}, radius ${currentChallenge.radius}, ${currentChallenge.answerKind}). `
        + `Attempt ${currentAttempts + 1}. Point at the specific step that needs another look — do NOT give the answer. `
        + `Common slip: using diameter where radius is needed, or forgetting to square the radius for area. `
        + tutorRevealPolicy(supportTier),
        { silent: true },
      );
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, needsUnrollFirst, answerInput,
    incrementAttempts, completeChallenge, currentAttempts, sendText, challengeType, supportTier,
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
        `[NEXT_ITEM] Circle ${nextIdx + 1} of ${challenges.length} (${next?.type}). `
        + `Introduce briefly: "Here's the next circle — same idea, new numbers."`,
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

    const metrics: CircleExplorerMetrics = {
      type: 'circle-explorer',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'circumference') as CircleExplorerMetrics['challengeType'],
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
      `[ALL_COMPLETE] All ${total} circles done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give an encouraging, π-focused summary.`,
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
          No circle-explorer challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const answerSuffix = unitSuffix(currentChallenge);
  const answerLead =
    challengeType === 'discover_pi'
      ? 'C ÷ d ='
      : challengeType === 'reverse'
      ? 'r ='
      : currentChallenge.answerKind === 'area'
      ? 'Area ='
      : challengeType === 'composite' && currentChallenge.compositeShape === 'semicircle_perimeter'
      ? 'Perimeter ='
      : challengeType === 'composite'
      ? 'Area ='
      : 'C =';

  const showUnrollBtn = challengeType === 'discover_pi' || challengeType === 'circumference';
  const showSliceBtn = challengeType === 'area';

  return (
    <LuminaCard className={['shadow-2xl', className].filter(Boolean).join(' ')}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">Grade 7</LuminaBadge>
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

        {/* Canvas — bespoke interaction surface (unroll / slice reveals). */}
        <div className="p-3 bg-slate-800/30 rounded-2xl border border-cyan-500/20">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg w-full"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          />
          <div className="flex justify-center gap-2 mt-2">
            {showUnrollBtn && (
              <LuminaButton
                tone="subtle"
                size="sm"
                onClick={handleUnroll}
                disabled={unrolled || hasSubmittedEvaluation}
              >
                {unrolled ? 'Circumference unrolled ✓' : 'Unroll the circumference'}
              </LuminaButton>
            )}
            {showSliceBtn && (
              <LuminaButton
                tone="subtle"
                size="sm"
                onClick={handleSlice}
                disabled={sliceProgress > 0 && sliceProgress < 1 ? true : hasSubmittedEvaluation}
              >
                {sliceProgress >= 1 ? 'Rearranged into a rectangle ✓' : 'Slice into wedges & rearrange'}
              </LuminaButton>
            )}
          </div>
          {needsUnrollFirst && (
            <p className="text-center text-xs text-purple-300/80 mt-2">
              Unroll the circumference first — count how many diameters long it is.
            </p>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <LuminaPanel>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-cyan-300 font-mono font-bold">{answerLead}</span>
              <LuminaInput
                type="text"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                disabled={needsUnrollFirst}
                className="w-28 text-center"
                placeholder="?"
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
              {answerSuffix && <span className="text-slate-400 text-sm font-mono">{answerSuffix}</span>}
              <LuminaButton tone="primary" onClick={handleCheck} disabled={needsUnrollFirst}>
                Check
              </LuminaButton>
            </div>
            {challengeType !== 'discover_pi' && (
              <p className="text-center text-xs text-slate-500 mt-2">Use π ≈ 3.14.</p>
            )}
          </LuminaPanel>
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
              Next Circle →
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
            heading="Circles Complete!"
            celebrationMessage={`You completed all ${challenges.length} circle challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CircleExplorer;
