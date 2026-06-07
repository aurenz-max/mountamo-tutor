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
  LuminaAnswerChoice,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AngleWorkshopMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type AngleWorkshopChallengeType =
  | 'measure'
  | 'classify_pairs'
  | 'solve_unknown'
  | 'solve_algebraic'
  | 'transversal';

/** Angle-pair relationships used by classify / solve modes. */
export type AnglePairRelationship =
  | 'complementary'
  | 'supplementary'
  | 'vertical'
  | 'adjacent';

/** How an unknown is linked to the given angle(s) in solve_unknown. */
export type SolveConfig =
  | 'complementary'
  | 'supplementary'
  | 'vertical'
  | 'around_point';

/** The named relationship for parallel-lines / triangle figures. */
export type TransversalRelation =
  | 'corresponding'
  | 'alternate_interior'
  | 'alternate_exterior'
  | 'co_interior';

export type TransversalShape =
  | 'parallel_transversal'
  | 'triangle_sum'
  | 'exterior_angle';

/** What the student must enter. */
export type AngleAnswerKind = 'degrees' | 'relationship' | 'x_value';

export interface AngleWorkshopChallenge {
  id: string;
  type: AngleWorkshopChallengeType;
  /** Short real-world framing (always present). */
  narration: string;
  /** What the student should do this challenge. */
  instruction: string;
  hint: string;
  answerKind: AngleAnswerKind;

  // --- measure: read an angle off the protractor ---
  /** Angle to be read, in degrees (10..170). DRAWN but NEVER labeled. */
  angleMeasure?: number;

  // --- classify_pairs: name the relationship (answer = relationship) ---
  /** Correct relationship — also the answer (expectedRelationship). */
  relationship?: AnglePairRelationship;
  /** For split configs: the interior ray position (first sub-angle), degrees. */
  splitAngle?: number;
  /** For an `adjacent` split: total angle spanned by the two outer rays. */
  outerAngle?: number;
  /** For `vertical`: angle between the two crossing lines, degrees. */
  crossAngle?: number;

  // --- solve_unknown: compute the missing angle (answer = degrees) ---
  solveConfig?: SolveConfig;
  /** Known (labeled) angle measure. */
  knownAngle?: number;
  /** Second known angle for `around_point`. */
  knownAngle2?: number;

  // --- solve_algebraic: unknown is an expression (answer = x value) ---
  algConfig?: 'complementary' | 'supplementary' | 'vertical';
  /** angle1 = a1·x + b1, angle2 = a2·x + b2. */
  a1?: number; b1?: number; a2?: number; b2?: number;

  // --- transversal / triangle (answer = degrees) ---
  transversalShape?: TransversalShape;
  /** Given/labeled angle in the figure. */
  givenAngle?: number;
  /** Second given angle (triangle_sum / exterior_angle remote interiors). */
  givenAngle2?: number;
  transRelation?: TransversalRelation;

  /** Pre-computed numeric answer (degrees or x value). */
  expectedAnswer: number;
  /** Pre-computed answer for classify mode. */
  expectedRelationship?: AnglePairRelationship;
  /** Absolute tolerance for accepting a numeric answer. */
  tolerance: number;
}

export interface AngleWorkshopData {
  title: string;
  description: string;
  challengeType: AngleWorkshopChallengeType;
  gradeBand?: '7' | '8';
  /** 3-6 challenges per session. Required. Built by the generator's pool service. */
  challenges: AngleWorkshopChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer / tester)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AngleWorkshopMetrics>) => void;
}

// ============================================================================
// Phase Summary Config
// ============================================================================

const PHASE_CONFIG_BY_TYPE: Record<AngleWorkshopChallengeType, PhaseConfig> = {
  measure:         { label: 'Measure',     icon: '📐', accentColor: 'cyan' },
  classify_pairs:  { label: 'Classify',    icon: '🔗', accentColor: 'purple' },
  solve_unknown:   { label: 'Solve',       icon: '🧮', accentColor: 'emerald' },
  solve_algebraic: { label: 'Algebraic',   icon: '🔤', accentColor: 'amber' },
  transversal:     { label: 'Transversal', icon: '🚆', accentColor: 'blue' },
};

const RELATIONSHIP_OPTIONS: { value: AnglePairRelationship; label: string; sub: string }[] = [
  { value: 'complementary', label: 'Complementary', sub: 'two angles that add to 90°' },
  { value: 'supplementary', label: 'Supplementary', sub: 'two angles that add to 180°' },
  { value: 'vertical',      label: 'Vertical',      sub: 'opposite angles where two lines cross (equal)' },
  { value: 'adjacent',      label: 'Adjacent',      sub: 'share a vertex and a side, no special sum' },
];

// ============================================================================
// Canvas constants
// ============================================================================

const CANVAS_W = 560;
const CANVAS_H = 380;

const COL_RAY = '#22d3ee';      // cyan — primary ray / figure
const COL_RAY2 = '#a855f7';     // purple — secondary ray
const COL_KNOWN = '#fbbf24';    // amber — known / labeled angle
const COL_UNKNOWN = '#f472b6';  // pink — the unknown (x)
const COL_LINE = '#94a3b8';     // slate — neutral lines
const COL_PROT = '#60a5fa';     // blue — protractor
const FILL_A = 'rgba(34, 211, 238, 0.22)';
const FILL_B = 'rgba(168, 85, 247, 0.22)';
const FILL_KNOWN = 'rgba(251, 191, 36, 0.20)';
const FILL_UNKNOWN = 'rgba(244, 114, 182, 0.22)';

// ============================================================================
// Helpers (pure)
// ============================================================================

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Format a linear expression a·x + b as a label, e.g. "(2x + 10)°", "x°", "(3x − 5)°". */
function fmtExpr(a: number, b: number): string {
  const xPart = a === 1 ? 'x' : a === -1 ? '−x' : `${a}x`;
  if (b === 0) return `${xPart}°`;
  const sign = b > 0 ? '+' : '−';
  return `(${xPart} ${sign} ${Math.abs(b)})°`;
}

// ============================================================================
// Component
// ============================================================================

interface AngleWorkshopProps {
  data: AngleWorkshopData;
  className?: string;
}

const AngleWorkshop: React.FC<AngleWorkshopProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeBand = '7',
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
  const challengeType = currentChallenge?.type ?? 'measure';

  // -------------------------------------------------------------------------
  // Per-challenge UI state
  // -------------------------------------------------------------------------
  const [answerInput, setAnswerInput] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<AnglePairRelationship | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showHint, setShowHint] = useState(false);

  // Measure mode gates the answer on placing the protractor first (a real
  // measuring action) — mirrors circle-explorer's unroll gate.
  const [protractorShown, setProtractorShown] = useState(false);

  const [resizeTick, setResizeTick] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `angle-workshop-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const recordedRef = useRef(false);
  const hintViewedRef = useRef(false);
  const hintsViewedRef = useRef(0);
  const submittedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const needsProtractorFirst = challengeType === 'measure' && !protractorShown;

  // -------------------------------------------------------------------------
  // Per-challenge reset — fires whenever advance() flips currentChallenge.id.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!currentChallenge) return;
    setAnswerInput('');
    setSelectedRelationship(null);
    setFeedback('');
    setFeedbackType('');
    setShowHint(false);
    setProtractorShown(false);
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

    // ----- shared primitives (screen-radian core, degree convenience) -----
    // Angles are measured CCW from the +x axis; canvas y is down, so we negate.
    const toRad = (deg: number) => (-deg * Math.PI) / 180;
    const dirDeg = (deg: number) => ({ x: Math.cos(toRad(deg)), y: Math.sin(toRad(deg)) });

    const label = (
      x: number, y: number, txt: string,
      color = '#e2e8f0', align: CanvasTextAlign = 'center',
      font = 'bold 14px ui-sans-serif, system-ui, sans-serif',
    ) => {
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, x, y);
    };

    const dot = (x: number, y: number, r = 3.5, color = '#e2e8f0') => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const arcPathRad = (cx: number, cy: number, r: number, a0: number, a1: number) => {
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * (i / steps);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    const strokeArcRad = (cx: number, cy: number, r: number, a0: number, a1: number, color: string, w = 2) => {
      ctx.beginPath();
      arcPathRad(cx, cy, r, a0, a1);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const fillWedgeRad = (cx: number, cy: number, r: number, a0: number, a1: number, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      arcPathRad(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    // Degree-based wedge between two ray bearings (d0 < d1, opening upward).
    const wedgeDeg = (cx: number, cy: number, r: number, d0: number, d1: number, fill: string, stroke: string) => {
      fillWedgeRad(cx, cy, r, toRad(d0), toRad(d1), fill);
      strokeArcRad(cx, cy, r, toRad(d0), toRad(d1), stroke, 2);
    };

    const ray = (cx: number, cy: number, deg: number, len: number, color: string, w = 2.5) => {
      const d = dirDeg(deg);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + d.x * len, cy + d.y * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const fullLine = (cx: number, cy: number, deg: number, len: number, color: string, w = 2.5) => {
      const d = dirDeg(deg);
      ctx.beginPath();
      ctx.moveTo(cx - d.x * len, cy - d.y * len);
      ctx.lineTo(cx + d.x * len, cy + d.y * len);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    const labelAtDeg = (cx: number, cy: number, deg: number, r: number, txt: string, color: string) => {
      const a = toRad(deg);
      label(cx + r * Math.cos(a), cy + r * Math.sin(a), txt, color);
    };

    // Right-angle square marker between rays at d0 and d0+90.
    const rightAngleMark = (cx: number, cy: number, d0: number, size = 16) => {
      const u = dirDeg(d0);
      const v = dirDeg(d0 + 90);
      const p1 = { x: cx + u.x * size, y: cy + u.y * size };
      const p3 = { x: cx + v.x * size, y: cy + v.y * size };
      const p2 = { x: p1.x + v.x * size, y: p1.y + v.y * size };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.strokeStyle = COL_LINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const ch = currentChallenge;

    // =====================================================================
    // MEASURE — read an angle off the protractor
    // =====================================================================
    if (ch.type === 'measure') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H * 0.7;
      const m = ch.angleMeasure ?? 45;
      const L = 190;

      // protractor overlay (the measuring tool)
      if (protractorShown) {
        const PR = 158;
        strokeArcRad(cx, cy, PR, toRad(0), toRad(180), 'rgba(96,165,250,0.55)', 2);
        for (let d = 0; d <= 180; d += 5) {
          const a = toRad(d);
          const isMajor = d % 30 === 0;
          const isMid = d % 10 === 0;
          const r0 = PR;
          const r1 = PR - (isMajor ? 14 : isMid ? 10 : 6);
          ctx.beginPath();
          ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
          ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
          ctx.strokeStyle = isMajor ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.45)';
          ctx.lineWidth = isMajor ? 1.6 : 1;
          ctx.stroke();
          if (isMajor) {
            label(cx + (PR + 16) * Math.cos(a), cy + (PR + 16) * Math.sin(a), `${d}`, COL_PROT, 'center', '12px ui-sans-serif, system-ui, sans-serif');
          }
        }
        // mark where the second ray crosses the scale (a reading cue, not a number)
        const a = toRad(m);
        dot(cx + PR * Math.cos(a), cy + PR * Math.sin(a), 5, COL_UNKNOWN);
      }

      // the angle itself
      ray(cx, cy, 0, L, COL_RAY);
      ray(cx, cy, m, L, COL_RAY2);
      wedgeDeg(cx, cy, 38, 0, m, FILL_A, COL_KNOWN);
      labelAtDeg(cx, cy, m / 2, 60, '?°', COL_UNKNOWN);
      dot(cx, cy, 4);
      if (!protractorShown) {
        label(cx, cy + 44, 'Place the protractor to read this angle', '#cbd5e1', 'center', '13px ui-sans-serif, system-ui, sans-serif');
      }
      return;
    }

    // =====================================================================
    // CLASSIFY_PAIRS — name the relationship (no measures shown)
    // =====================================================================
    if (ch.type === 'classify_pairs') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const rel = ch.relationship ?? 'adjacent';
      const L = 175;
      if (rel === 'vertical') {
        const cross = ch.crossAngle ?? 55;
        fullLine(cx, cy, 0, L, COL_LINE);
        fullLine(cx, cy, cross, L, COL_LINE);
        // highlight the two opposite (vertical) wedges
        wedgeDeg(cx, cy, 40, 0, cross, FILL_A, COL_RAY);
        wedgeDeg(cx, cy, 40, 180, 180 + cross, FILL_A, COL_RAY);
        labelAtDeg(cx, cy, cross / 2, 58, 'α', COL_RAY);
        labelAtDeg(cx, cy, 180 + cross / 2, 58, 'α', COL_RAY);
      } else {
        const outer = rel === 'complementary' ? 90 : rel === 'supplementary' ? 180 : (ch.outerAngle ?? 140);
        const split = ch.splitAngle ?? Math.round(outer * 0.4);
        ray(cx, cy, 0, L, COL_RAY);
        ray(cx, cy, outer, L, COL_RAY);
        ray(cx, cy, split, L, COL_RAY2);
        wedgeDeg(cx, cy, 44, 0, split, FILL_A, COL_RAY);
        wedgeDeg(cx, cy, 60, split, outer, FILL_B, COL_RAY2);
        labelAtDeg(cx, cy, split / 2, 70, 'α', COL_RAY);
        labelAtDeg(cx, cy, (split + outer) / 2, 84, 'β', COL_RAY2);
        if (rel === 'complementary') rightAngleMark(cx, cy, 0);
        dot(cx, cy, 4);
      }
      return;
    }

    // =====================================================================
    // SOLVE_UNKNOWN — one labeled angle, find x
    // =====================================================================
    if (ch.type === 'solve_unknown') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2 + 10;
      const cfg = ch.solveConfig ?? 'supplementary';
      const known = ch.knownAngle ?? 50;
      const L = 175;

      if (cfg === 'vertical') {
        const cross = known;
        fullLine(cx, cy, 0, L, COL_LINE);
        fullLine(cx, cy, cross, L, COL_LINE);
        wedgeDeg(cx, cy, 42, 0, cross, FILL_KNOWN, COL_KNOWN);
        wedgeDeg(cx, cy, 42, 180, 180 + cross, FILL_UNKNOWN, COL_UNKNOWN);
        labelAtDeg(cx, cy, cross / 2, 62, `${known}°`, COL_KNOWN);
        labelAtDeg(cx, cy, 180 + cross / 2, 62, 'x°', COL_UNKNOWN);
        dot(cx, cy, 4);
      } else if (cfg === 'around_point') {
        const k1 = ch.knownAngle ?? 120;
        const k2 = ch.knownAngle2 ?? 100;
        // three rays from the point: 0, k1, k1+k2 ; x fills the rest back to 360
        ray(cx, cy, 0, L, COL_RAY);
        ray(cx, cy, k1, L, COL_RAY);
        ray(cx, cy, k1 + k2, L, COL_RAY);
        wedgeDeg(cx, cy, 44, 0, k1, FILL_KNOWN, COL_KNOWN);
        wedgeDeg(cx, cy, 56, k1, k1 + k2, FILL_KNOWN, COL_KNOWN);
        wedgeDeg(cx, cy, 44, k1 + k2, 360, FILL_UNKNOWN, COL_UNKNOWN);
        labelAtDeg(cx, cy, k1 / 2, 66, `${k1}°`, COL_KNOWN);
        labelAtDeg(cx, cy, k1 + k2 / 2, 78, `${k2}°`, COL_KNOWN);
        labelAtDeg(cx, cy, (k1 + k2 + 360) / 2, 66, 'x°', COL_UNKNOWN);
        dot(cx, cy, 4);
      } else {
        // complementary (90) or supplementary (180): split config
        const outer = cfg === 'complementary' ? 90 : 180;
        ray(cx, cy, 0, L, COL_RAY);
        ray(cx, cy, outer, L, COL_RAY);
        ray(cx, cy, known, L, COL_RAY2);
        wedgeDeg(cx, cy, 44, 0, known, FILL_KNOWN, COL_KNOWN);
        wedgeDeg(cx, cy, 60, known, outer, FILL_UNKNOWN, COL_UNKNOWN);
        labelAtDeg(cx, cy, known / 2, 70, `${known}°`, COL_KNOWN);
        labelAtDeg(cx, cy, (known + outer) / 2, 84, 'x°', COL_UNKNOWN);
        if (cfg === 'complementary') rightAngleMark(cx, cy, 0);
        dot(cx, cy, 4);
      }
      return;
    }

    // =====================================================================
    // SOLVE_ALGEBRAIC — angles labeled as expressions, find x
    // =====================================================================
    if (ch.type === 'solve_algebraic') {
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2 + 10;
      const cfg = ch.algConfig ?? 'supplementary';
      const x = ch.expectedAnswer;
      const a1 = ch.a1 ?? 1, b1 = ch.b1 ?? 0, a2 = ch.a2 ?? 1, b2 = ch.b2 ?? 0;
      const angle1 = a1 * x + b1; // real measure of the first angle
      const L = 175;
      const e1 = fmtExpr(a1, b1);
      const e2 = fmtExpr(a2, b2);

      if (cfg === 'vertical') {
        const cross = Math.max(20, Math.min(160, angle1));
        fullLine(cx, cy, 0, L, COL_LINE);
        fullLine(cx, cy, cross, L, COL_LINE);
        wedgeDeg(cx, cy, 44, 0, cross, FILL_A, COL_RAY);
        wedgeDeg(cx, cy, 44, 180, 180 + cross, FILL_B, COL_RAY2);
        labelAtDeg(cx, cy, cross / 2, 70, e1, COL_RAY);
        labelAtDeg(cx, cy, 180 + cross / 2, 70, e2, COL_RAY2);
        dot(cx, cy, 4);
      } else {
        const outer = cfg === 'complementary' ? 90 : 180;
        const split = Math.max(15, Math.min(outer - 15, angle1));
        ray(cx, cy, 0, L, COL_RAY);
        ray(cx, cy, outer, L, COL_RAY);
        ray(cx, cy, split, L, COL_RAY2);
        wedgeDeg(cx, cy, 46, 0, split, FILL_A, COL_RAY);
        wedgeDeg(cx, cy, 64, split, outer, FILL_B, COL_RAY2);
        labelAtDeg(cx, cy, split / 2, 76, e1, COL_RAY);
        labelAtDeg(cx, cy, (split + outer) / 2, 92, e2, COL_RAY2);
        if (cfg === 'complementary') rightAngleMark(cx, cy, 0);
        dot(cx, cy, 4);
      }
      return;
    }

    // =====================================================================
    // TRANSVERSAL — parallel lines / triangle figures
    // =====================================================================
    if (ch.type === 'transversal') {
      const shape = ch.transversalShape ?? 'parallel_transversal';

      // angle arc between two ABSOLUTE screen directions at a vertex (minor arc)
      const vertexAngle = (V: { x: number; y: number }, P1: { x: number; y: number }, P2: { x: number; y: number }, color: string, fill: string, txt: string) => {
        const a1 = Math.atan2(P1.y - V.y, P1.x - V.x);
        let a2 = Math.atan2(P2.y - V.y, P2.x - V.x);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        a2 = a1 + delta;
        const r = 26;
        ctx.beginPath();
        ctx.moveTo(V.x, V.y);
        arcPathRad(V.x, V.y, r, a1, a2);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        strokeArcRad(V.x, V.y, r, a1, a2, color, 2);
        const am = a1 + delta / 2;
        label(V.x + 46 * Math.cos(am), V.y + 46 * Math.sin(am), txt, color);
      };

      if (shape === 'parallel_transversal') {
        const y1 = 110, y2 = 250;
        const xL = 70, xR = 490;
        // parallels
        ctx.strokeStyle = COL_LINE;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(xL, y1); ctx.lineTo(xR, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xL, y2); ctx.lineTo(xR, y2); ctx.stroke();
        // parallel arrows
        label(xR + 4, y1, '▸', COL_LINE, 'left');
        label(xR + 4, y2, '▸', COL_LINE, 'left');
        // transversal A(top-left) → B(bottom-right)
        const A = { x: 200, y: 70 }, B = { x: 360, y: 290 };
        const ix1 = A.x + ((y1 - A.y) / (B.y - A.y)) * (B.x - A.x);
        const ix2 = A.x + ((y2 - A.y) / (B.y - A.y)) * (B.x - A.x);
        const I1 = { x: ix1, y: y1 };
        const I2 = { x: ix2, y: y2 };
        ctx.strokeStyle = COL_RAY;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();

        // reference direction points along each line from an intersection
        const rightOf = (I: { x: number; y: number }) => ({ x: I.x + 60, y: I.y });
        const leftOf = (I: { x: number; y: number }) => ({ x: I.x - 60, y: I.y });
        const towardA = { x: A.x, y: A.y };
        const towardB = { x: B.x, y: B.y };

        // GIVEN angle at I1 — interior, right of transversal (lower-right wedge)
        vertexAngle(I1, rightOf(I1), towardB, COL_KNOWN, FILL_KNOWN, `${ch.givenAngle}°`);

        // UNKNOWN at I2 — position depends on the named relationship
        const rel = ch.transRelation ?? 'corresponding';
        if (rel === 'corresponding') {
          vertexAngle(I2, rightOf(I2), towardB, COL_UNKNOWN, FILL_UNKNOWN, 'x°');
        } else if (rel === 'alternate_interior') {
          vertexAngle(I2, leftOf(I2), towardA, COL_UNKNOWN, FILL_UNKNOWN, 'x°');
        } else if (rel === 'co_interior') {
          vertexAngle(I2, rightOf(I2), towardA, COL_UNKNOWN, FILL_UNKNOWN, 'x°');
        } else {
          // alternate_exterior
          vertexAngle(I2, leftOf(I2), towardB, COL_UNKNOWN, FILL_UNKNOWN, 'x°');
        }
        dot(I1.x, I1.y, 3.5);
        dot(I2.x, I2.y, 3.5);
      } else {
        // triangle figures
        const Vt = { x: 285, y: 80 };
        const Vl = { x: 150, y: 300 };
        const Vr = { x: 415, y: 300 };
        ctx.strokeStyle = COL_RAY;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(Vt.x, Vt.y);
        ctx.lineTo(Vl.x, Vl.y);
        ctx.lineTo(Vr.x, Vr.y);
        ctx.closePath();
        ctx.stroke();

        if (shape === 'triangle_sum') {
          vertexAngle(Vl, Vr, Vt, COL_KNOWN, FILL_KNOWN, `${ch.givenAngle}°`);
          vertexAngle(Vr, Vt, Vl, COL_KNOWN, FILL_KNOWN, `${ch.givenAngle2}°`);
          vertexAngle(Vt, Vl, Vr, COL_UNKNOWN, FILL_UNKNOWN, 'x°');
        } else {
          // exterior_angle: extend base past Vr; exterior = x, remote interiors labeled
          const Ext = { x: 500, y: 300 };
          ctx.strokeStyle = COL_LINE;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Vr.x, Vr.y);
          ctx.lineTo(Ext.x, Ext.y);
          ctx.stroke();
          vertexAngle(Vl, Vr, Vt, COL_KNOWN, FILL_KNOWN, `${ch.givenAngle}°`);   // remote interior 1
          vertexAngle(Vt, Vl, Vr, COL_KNOWN, FILL_KNOWN, `${ch.givenAngle2}°`);  // remote interior 2
          vertexAngle(Vr, Vt, Ext, COL_UNKNOWN, FILL_UNKNOWN, 'x°');             // exterior
        }
      }
      return;
    }
  }, [currentChallenge, challengeType, protractorShown, resizeTick]);

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
  } = usePrimitiveEvaluation<AngleWorkshopMetrics>({
    primitiveType: 'angle-workshop',
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
    answerKind: currentChallenge?.answerKind ?? 'degrees',
    relationship: currentChallenge?.relationship ?? null,
    solveConfig: currentChallenge?.solveConfig ?? null,
    algConfig: currentChallenge?.algConfig ?? null,
    transversalShape: currentChallenge?.transversalShape ?? null,
    transRelation: currentChallenge?.transRelation ?? null,
    knownAngle: currentChallenge?.knownAngle ?? null,
    givenAngle: currentChallenge?.givenAngle ?? null,
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
    primitiveType: 'angle-workshop',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: `Grade ${gradeBand}`,
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Angle session: ${challenges.length} problems, mode "${challengeType}", grade ${gradeBand}. `
      + `Introduce briefly: angles in a figure are linked by relationships (they add to 90°, 180°, or are equal), and those relationships let us find unknown angles. Then read the first task.`,
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

    // --- relationship (classify) ---
    if (ch.answerKind === 'relationship') {
      if (!selectedRelationship) {
        setFeedback('Pick the relationship that matches the figure.');
        setFeedbackType('error');
        return;
      }
      incrementAttempts();
      const correct = selectedRelationship === ch.expectedRelationship;
      if (correct) {
        SoundManager.playCorrect();
        setFeedback(`Correct — these are ${ch.expectedRelationship} angles.`);
        setFeedbackType('success');
        sendText(
          `[ANSWER_CORRECT] Student classified a pair as "${selectedRelationship}" (correct). Celebrate briefly and restate why.`,
          { silent: true },
        );
        completeChallenge(true);
      } else {
        SoundManager.playIncorrect();
        setFeedback('Not quite. Look at how the rays meet — do the outer rays form a straight line, a right angle, or cross?');
        setFeedbackType('error');
        sendText(
          `[ANSWER_INCORRECT] Student chose "${selectedRelationship}" but the pair is "${ch.expectedRelationship}". `
          + `Attempt ${currentAttempts + 1}. Point at what in the figure distinguishes them — do NOT name the answer outright.`,
          { silent: true },
        );
        setSelectedRelationship(null);
      }
      return;
    }

    // --- numeric (measure / solve_unknown / solve_algebraic / transversal) ---
    if (needsProtractorFirst) {
      SoundManager.invalid();
      setFeedback('Place the protractor first, then read the angle from the scale.');
      setFeedbackType('error');
      return;
    }
    const trimmed = answerInput.trim();
    if (!trimmed) {
      setFeedback('Enter your answer.');
      setFeedbackType('error');
      return;
    }
    const parsed = parseFloat(trimmed.replace('°', ''));
    if (!Number.isFinite(parsed)) {
      setFeedback('Enter a number (degrees, or the value of x).');
      setFeedbackType('error');
      return;
    }
    incrementAttempts();
    const correct = Math.abs(parsed - ch.expectedAnswer) <= ch.tolerance;
    const unit = ch.answerKind === 'x_value' ? '' : '°';
    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Correct! ${ch.answerKind === 'x_value' ? 'x = ' : ''}${ch.expectedAnswer}${unit}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student answered ${parsed} for a ${challengeType} problem. Expected ${ch.expectedAnswer}. `
        + `Celebrate briefly and reinforce the relationship used.`,
        { silent: true },
      );
      completeChallenge(true);
    } else {
      SoundManager.playIncorrect();
      setFeedback('Not quite. Re-check which relationship links the angles, then redo the arithmetic.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${parsed} but the answer is ${ch.expectedAnswer} (${challengeType}). `
        + `Attempt ${currentAttempts + 1}. Point at the specific step that needs another look — do NOT give the answer. `
        + `Common slips: using 90 where 180 is needed, or solving for x but forgetting to substitute back.`,
        { silent: true },
      );
    }
  }, [
    currentChallenge, hasSubmittedEvaluation, selectedRelationship, needsProtractorFirst,
    answerInput, incrementAttempts, completeChallenge, currentAttempts, sendText, challengeType,
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
        + `Introduce briefly: "Here's the next one — same kind of relationship, new angles."`,
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

    const metrics: AngleWorkshopMetrics = {
      type: 'angle-workshop',
      challengeType: (currentChallenge?.type ?? challenges[0]?.type ?? 'measure') as AngleWorkshopMetrics['challengeType'],
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
      `[ALL_COMPLETE] All ${total} angle problems done. Correct: ${correctCount}/${total}. First-try: ${firstTryCount}. Accuracy: ${avgScore}%. Give an encouraging, relationship-focused summary.`,
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
          No angle-workshop challenges in this session.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const isRelationshipMode = currentChallenge.answerKind === 'relationship';
  const answerLead =
    currentChallenge.answerKind === 'x_value'
      ? 'x ='
      : challengeType === 'measure'
      ? 'Angle ='
      : 'x =';
  const answerSuffix = currentChallenge.answerKind === 'x_value' ? '' : '°';

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
            className="rounded-lg w-full"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
          />
          {challengeType === 'measure' && (
            <div className="flex justify-center mt-2">
              <LuminaButton
                tone="subtle"
                size="sm"
                onClick={() => {
                  if (protractorShown) return;
                  SoundManager.snap();
                  setProtractorShown(true);
                }}
                disabled={protractorShown || hasSubmittedEvaluation}
              >
                {protractorShown ? 'Protractor placed ✓' : 'Place the protractor'}
              </LuminaButton>
            </div>
          )}
          {needsProtractorFirst && (
            <p className="text-center text-xs text-cyan-300/80 mt-2">
              Place the protractor, then read the angle where the second ray crosses the scale.
            </p>
          )}
        </div>

        {/* Answer panel */}
        {!isCurrentComplete && !allChallengesComplete && (
          <>
            {isRelationshipMode ? (
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_OPTIONS.map((opt) => {
                  const state = isCurrentComplete
                    ? opt.value === currentChallenge.expectedRelationship ? 'correct' : 'dimmed'
                    : selectedRelationship === opt.value ? 'selected' : 'idle';
                  return (
                    <LuminaAnswerChoice
                      key={opt.value}
                      state={state}
                      className="!p-3"
                      disabled={hasSubmittedEvaluation}
                      onClick={() => {
                        SoundManager.select();
                        setSelectedRelationship(opt.value);
                      }}
                    >
                      <span className="block text-sm font-semibold text-slate-100">{opt.label}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{opt.sub}</span>
                    </LuminaAnswerChoice>
                  );
                })}
              </div>
            ) : (
              <LuminaPanel>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="text-cyan-300 font-mono font-bold">{answerLead}</span>
                  <LuminaInput
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    disabled={needsProtractorFirst}
                    className="w-28 text-center"
                    placeholder="?"
                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                  />
                  {answerSuffix && <span className="text-slate-400 text-sm font-mono">{answerSuffix}</span>}
                </div>
              </LuminaPanel>
            )}

            <div className="flex justify-center">
              <LuminaButton tone="primary" onClick={handleCheck} disabled={needsProtractorFirst}>
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
            heading="Angles Complete!"
            celebrationMessage={`You completed all ${challenges.length} angle challenges.`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default AngleWorkshop;
