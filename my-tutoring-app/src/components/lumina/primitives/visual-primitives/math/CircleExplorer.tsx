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
  LuminaFeedbackCard,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { CircleExplorerMetrics } from '../../../evaluation/types';
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
  answerLead as answerLeadOf, circleCorrect, circleMiss, describeCircleWork, parseCircleAnswer, unitSuffix,
  workspaceScene, type CircleWork,
} from './circleExplorerWorkspace';
import {
  AROUND_LEVER, CHAIN_LEVER, CIRCLE_LEVERS, CORNERS_LEVER, EDGES_LEVER, FIGURE_LEVERS, FORMULA_LEVER, LEVER_CAPTIONS,
  OTHER_LENGTH_LEVER, RATIO_FRAME_LEVER, SQUARE_LEVER, TENTHS_LEVER, WHOLE_LEVER,
  discoverTrack, isPracticeCircle, otherLengthLabel, ratioFrame, undoChain,
} from './circleExplorerLevers';
import { circleExplorerBoss } from './circleExplorer.boss';

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
  /** Within-mode support tier (from config.difficulty); each item carries its own reveal (`showFormulaReveal`). */
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
// Component
// ============================================================================

interface CircleExplorerProps {
  data: CircleExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const useCircleProgress = useWorkspaceProgressFor('circle-explorer');
const PRACTICE_NOTE = 'An easier practice problem is on screen in place of the item. It is not graded; the full item comes back after it.';

const CircleExplorerSurface = ({ data, className, runtimePlanItemId }: CircleExplorerProps) => {
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

  const stableInstanceIdRef = useRef(instanceId || `circle-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Multi-challenge progression: the teaching workspace moves the index.
  // -------------------------------------------------------------------------
  /** Bound below, once the setters and the evaluation exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useCircleProgress({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: circleExplorerBoss.assignment!,
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

  // In-item levers (`circleExplorerLevers.ts`), keyed by the session item they were pulled on, and the easier problem a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CircleExplorerChallenge | null>(null);
  const sessionChallenge = challenges[currentChallengeIndex] ?? null;
  /** What is on screen: the easier problem while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** The runtime pulls drawn on screen now: never on a practice problem. */
  const onScreenLevers = practice ? [] : pulledLevers;
  const leverOn = (id: string) => onScreenLevers.includes(id);
  const challengeType = currentChallenge?.type ?? 'circumference';

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Manipulation: unroll the circumference (discover_pi gates on this) / slice into wedges (area).
  const [unrollProgress, setUnrollProgress] = useState(0); // 0..1
  const [sliceProgress, setSliceProgress] = useState(0);   // 0..1
  const [unrolled, setUnrolled] = useState(false);

  // Bumped by a ResizeObserver so the canvas re-renders crisply when its size changes.
  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const recordedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // discover_pi gates the answer on unrolling first; area's slice is an optional reveal.
  const needsUnrollFirst = challengeType === 'discover_pi' && !unrolled;

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  /**
   * A fresh item or Try again: the answer box empty. Try again keeps what the learner already
   * unrolled or sliced (exploration, not the answer); a fresh item starts the figure over.
   */
  const resetWork = (keepFigure: boolean) => {
    setAnswerInput('');
    setFeedback('');
    setFeedbackType('');
    if (keepFigure) return;
    setUnrollProgress(0);
    setSliceProgress(0);
    setUnrolled(false);
    recordedRef.current = false;
    stopAnimation();
  };
  openItem.current = (_index, retry) => {
    // Try again on a practice problem keeps it; a fresh item (or the full item back after practice) drops it.
    if (retry) { resetWork(true); return; }
    setPractice(null);
    resetWork(false);
  };

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
    if (unrolled || learnerBlocked()) return;
    SoundManager.tick();
    // The learner's move is done when they press it; the animation only draws it.
    setUnrolled(true);
    if (challengeType === 'discover_pi') {
      // Never the ratio itself: the learner finds it by dividing (or, at hard, by measuring the track).
      setFeedback(
        currentChallenge?.showFormulaReveal === false
          ? 'Now lay the unrolled length against the diameter — how many diameters long is it?'
          : 'The circumference is unrolled under the circle. How many diameters long is it? Work out C ÷ d.',
      );
      setFeedbackType('info');
    }
    runAnimation(setUnrollProgress, () => SoundManager.snap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unrolled, runAnimation, challengeType, currentChallenge]);

  const handleSlice = useCallback(() => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    runAnimation(setSliceProgress, () => SoundManager.snap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // false so the canvas withholds the explicit formula labels; the `formula_labels` lever puts them back.
    const showFormula = currentChallenge.showFormulaReveal !== false || onScreenLevers.includes(FORMULA_LEVER);
    const lever = (id: string) => onScreenLevers.includes(id);
    const LEVER_COLOR = '#f472b6';

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

    /** `other_length` lever: a dashed vertical diameter, or a radius drawn down and to the left, named by letter only. */
    const drawOtherLength = (cx: number, cy: number, diameterAcross: boolean) => {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = LEVER_COLOR;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (diameterAcross) { ctx.moveTo(cx, cy - RV); ctx.lineTo(cx, cy + RV); }
      else { ctx.moveTo(cx, cy); ctx.lineTo(cx - RV * Math.cos(Math.PI / 3), cy + RV * Math.sin(Math.PI / 3)); }
      ctx.stroke();
      ctx.restore();
      const txt = otherLengthLabel(currentChallenge);
      if (diameterAcross) label(cx - 12, cy + RV / 2, txt, LEVER_COLOR, 'right');
      else label(cx - RV * 0.25 - 10, cy + RV * 0.45, txt, LEVER_COLOR, 'right');
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
      // Four diameters fit between the margins, so the `tenth_marks` ruler past the third one is never clipped.
      const { startX: trackStartX, diaPx, tenths } = discoverTrack(CANVAS_W);
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

      // the unrolling circumference (cyan), thick. No "≈ 3.14 d" label: that number is this item's answer.
      ctx.strokeStyle = CIRCLE_STROKE;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(trackStartX, trackY);
      ctx.lineTo(trackStartX + drawnLen, trackY);
      ctx.stroke();
      label(trackStartX, trackY - 18, 'Circumference unrolled', CIRCLE_STROKE, 'left');
      // `tenth_marks` lever: one diameter cut into ten equal, unlabelled parts, starting where the whole diameters end,
      // so the leftover piece of the unrolled line can be read in tenths.
      if (lever(TENTHS_LEVER) && unrollProgress >= 1) {
        const x3 = tenths[0], y = trackY + 62;
        ctx.strokeStyle = LEVER_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x3, y); ctx.lineTo(tenths[10], y); ctx.stroke();
        tenths.forEach((x, k) => {
          ctx.beginPath(); ctx.moveTo(x, y - (k % 5 === 0 ? 8 : 5)); ctx.lineTo(x, y + (k % 5 === 0 ? 8 : 5)); ctx.stroke();
        });
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x3, trackY); ctx.lineTo(x3, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(trackStartX + fullLen, trackY); ctx.lineTo(trackStartX + fullLen, y); ctx.stroke();
        ctx.setLineDash([]);
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
      // `other_length` lever: the length the figure does not give, named by letter only.
      if (lever(OTHER_LENGTH_LEVER)) drawOtherLength(cx, cy, currentChallenge.given === 'radius');
      // `diameters_around` lever: the circumference laid straight with diameter-length bars along it, unlabelled.
      if (lever(AROUND_LEVER)) {
        const startX = 60, y = 392, dp = (CANVAS_W - 2 * startX) / 3.3;
        ctx.strokeStyle = CIRCLE_STROKE;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + Math.PI * dp, y); ctx.stroke();
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k % 2 === 0 ? LEVER_COLOR : 'rgba(244,114,182,0.5)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(startX + k * dp + 1, y + 9); ctx.lineTo(startX + (k + 1) * dp - 1, y + 9); ctx.stroke();
        }
      }
    } else if (challengeType === 'area') {
      const cx = CANVAS_W / 2;
      const cy = 150;
      if (sliceProgress < 0.02) {
        drawCircle(cx, cy, RV);
        // A given diameter is drawn all the way across, not along the radius.
        if (currentChallenge.given === 'diameter') drawDiameter(cx, cy, RV, `d = ${diameter} ${unit}`);
        else drawRadius(cx, cy, RV, `r = ${r} ${unit}`);
        // `radius_square` lever: a square on the radius, r by r, above it.
        if (lever(SQUARE_LEVER)) {
          ctx.fillStyle = 'rgba(244,114,182,0.18)';
          ctx.strokeStyle = LEVER_COLOR;
          ctx.lineWidth = 2;
          ctx.fillRect(cx, cy - RV, RV, RV);
          ctx.strokeRect(cx, cy - RV, RV, RV);
          label(cx + RV / 2, cy - RV / 2, 'r × r', LEVER_COLOR);
        }
        if (lever(OTHER_LENGTH_LEVER)) drawOtherLength(cx, cy, false);
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
      if (lever(OTHER_LENGTH_LEVER)) drawOtherLength(cx, cy, true);
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
        // `shade_corners` lever: the square without the circle shaded, and the circle's radius as half the side.
        if (lever(CORNERS_LEVER)) {
          ctx.beginPath();
          ctx.rect(cx - half, cy - half, 2 * half, 2 * half);
          ctx.arc(cx, cy, half, 0, 2 * Math.PI, true);
          ctx.fillStyle = 'rgba(244,114,182,0.35)';
          ctx.fill('evenodd');
          ctx.strokeStyle = LEVER_COLOR;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + half, cy); ctx.stroke();
          label(cx + half / 2, cy - 12, 'r = half the side', LEVER_COLOR);
        }
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
        // `whole_circle` lever: the missing half, dashed.
        if (lever(WHOLE_LEVER)) {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.arc(cx, cy + RV / 2, RV, 0, Math.PI, false);
          ctx.strokeStyle = LEVER_COLOR;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
          label(cx, cy + RV / 2 + RV + 16, 'the whole circle', LEVER_COLOR);
        }
        // `trace_edges` lever: the curved edge and the straight edge in two colours, each named.
        if (lever(EDGES_LEVER)) {
          ctx.lineWidth = 5;
          ctx.strokeStyle = LEVER_COLOR;
          ctx.beginPath(); ctx.arc(cx, cy + RV / 2, RV, Math.PI, 2 * Math.PI, false); ctx.stroke();
          ctx.strokeStyle = RADIUS_COLOR;
          ctx.beginPath(); ctx.moveTo(cx - RV, cy + RV / 2); ctx.lineTo(cx + RV, cy + RV / 2); ctx.stroke();
          label(cx - RV - 8, cy - RV / 4, 'curved edge', LEVER_COLOR, 'right');
          label(cx, cy + RV / 2 + 18, 'straight edge = d', RADIUS_COLOR);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge, challengeType, unrollProgress, sliceProgress, resizeTick, onScreenLevers.join('|')]);

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
  // Check. Every numeric check commits (right or wrong); an empty or non-numeric entry is not a check.
  // -------------------------------------------------------------------------
  const isCurrentComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );
  /** Input closed once the item is done, and while a checked answer waits for Try again. */
  const inputClosed = allChallengesComplete || hasSubmittedEvaluation || isCurrentComplete || blocked;

  const handleCheck = useCallback(() => {
    if (!currentChallenge || hasSubmittedEvaluation || learnerBlocked() || isCurrentComplete) return;
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
    const parsed = parseCircleAnswer(trimmed);
    if (!Number.isFinite(parsed)) {
      setFeedback('Enter a number (e.g. 31.4 or 3.14).');
      setFeedbackType('error');
      return;
    }
    const work: CircleWork = { typed: trimmed, unrolled, sliced: sliceProgress >= 1 };
    const correct = circleCorrect(currentChallenge, work);
    const suffix = unitSuffix(currentChallenge);
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! ${currentChallenge.expectedAnswer}${suffix ? ' ' + suffix : ''}.`);
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Check your formula and whether you used the radius or the diameter, then try again.');
      setFeedbackType('error');
    }
    // The checked gesture (counts the attempt, records the verdict), then this primitive's own score.
    progress.commitCheck(describeCircleWork(currentChallenge, work), correct, circleMiss(currentChallenge, work));
    // An easier practice problem (a simplify lever) is not the session's challenge: it records nothing of its own.
    if (correct && !recordedRef.current && !isPracticeCircle(currentChallenge)) {
      recordedRef.current = true;
      const attempts = currentAttempts + 1;
      mergeResult({ challengeId: currentChallenge.id, correct: true, attempts, score: Math.max(20, 100 - (attempts - 1) * 20) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentChallenge, hasSubmittedEvaluation, needsUnrollFirst, answerInput, unrolled, sliceProgress, isCurrentComplete,
    mergeResult, currentAttempts, progress.commitCheck,
  ]);

  // Under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0 || progress.recordsEvaluation === false) return;
    const metrics: CircleExplorerMetrics = {
      type: 'circle-explorer',
      challengeType: (challenges[0]?.type ?? 'circumference') as CircleExplorerMetrics['challengeType'],
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
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
  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challengeResults.length === 0) return 0;
    return Math.round(
      challengeResults.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      ) / challengeResults.length,
    );
  }, [allChallengesComplete, challengeResults]);

  // What the tutor and the observer are shown, republished every render. No demonstration, no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionChallenge) return;
    const shown = leverOn(FORMULA_LEVER) ? { ...currentChallenge, showFormulaReveal: true } : currentChallenge;
    const scene = workspaceScene(shown, { typed: answerInput, unrolled, sliced: sliceProgress >= 1 });
    const ctx = { unrolled };
    const levers = practice ? [] : CIRCLE_LEVERS.declare(sessionChallenge, ctx, pulledLevers);
    const published = leverScene(scene, {
      support: practice ? '' : CIRCLE_LEVERS.support(sessionChallenge, ctx),
      onScreen: practice ? '' : CIRCLE_LEVERS.onScreen(sessionChallenge, ctx, pulledLevers),
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
          const easier = CIRCLE_LEVERS.simpler(sessionChallenge, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork(false);
          return { practice: circleExplorerBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(false); },
    };
  });

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
  const answerLead = answerLeadOf(currentChallenge);

  const showUnrollBtn = challengeType === 'discover_pi' || challengeType === 'circumference';
  const showSliceBtn = challengeType === 'area';

  return (
    <LuminaCard className={['shadow-2xl', className].filter(Boolean).join(' ')}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan" className="text-xs">Grade 7</LuminaBadge>
            {practice && <LuminaBadge accent="amber" className="text-xs uppercase tracking-wider">Practice</LuminaBadge>}
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

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the figure and the answer box
            as one region. */}
        <PipDock />
        <PipWorkspace className="space-y-4">
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
                disabled={unrolled || hasSubmittedEvaluation || blocked}
              >
                {unrolled ? 'Circumference unrolled ✓' : 'Unroll the circumference'}
              </LuminaButton>
            )}
            {showSliceBtn && (
              <LuminaButton
                tone="subtle"
                size="sm"
                onClick={handleSlice}
                disabled={sliceProgress > 0 && sliceProgress < 1 ? true : hasSubmittedEvaluation || blocked}
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
          {/* Lever pictures and captions (`circleExplorerLevers.ts`), on the session item only. None writes the answer. */}
          {!allChallengesComplete && onScreenLevers.length > 0 && (
            <div className="mt-2 space-y-1 text-center">
              {leverOn(RATIO_FRAME_LEVER) && (
                <p data-lever="ratio-frame" className="text-sm font-mono text-pink-200">{ratioFrame(currentChallenge)}</p>
              )}
              {leverOn(CHAIN_LEVER) && (() => {
                const chain = undoChain(currentChallenge);
                return (
                  <div data-lever="undo-chain" className="text-sm font-mono text-pink-200 space-y-0.5">
                    <p>{chain.forward}</p>
                    <p className="text-pink-300/80">{chain.back}</p>
                  </div>
                );
              })()}
              {[FORMULA_LEVER, ...FIGURE_LEVERS].filter(leverOn).map((id) => (
                <p key={id} data-lever={id.replace(/_/g, '-')} className="text-xs text-pink-200/90">
                  {LEVER_CAPTIONS[id](currentChallenge)}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <LuminaPanel>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-cyan-300 font-mono font-bold">{answerLead}</span>
              <LuminaInput
                type="text"
                aria-label="Your answer"
                value={answerInput}
                onChange={(e) => { if (!learnerBlocked()) setAnswerInput(e.target.value); }}
                disabled={needsUnrollFirst || inputClosed}
                className="w-28 text-center"
                placeholder="?"
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
              {answerSuffix && <span className="text-slate-400 text-sm font-mono">{answerSuffix}</span>}
              <LuminaButton tone="primary" onClick={handleCheck} disabled={needsUnrollFirst || inputClosed}>
                Check
              </LuminaButton>
            </div>
            {challengeType !== 'discover_pi' && (
              <p className="text-center text-xs text-slate-500 mt-2">Use π ≈ 3.14.</p>
            )}
          </LuminaPanel>
        )}

        </PipWorkspace>

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

        {/* Phase summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localOverallScore)}
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

// Taught only on the workspace: an unbound mount shows the shared "needs the tutor" card.
const CircleExplorer = withWorkspaceOnly<CircleExplorerProps>('circle-explorer', CircleExplorerSurface, props => props.data.title);

export default CircleExplorer;
