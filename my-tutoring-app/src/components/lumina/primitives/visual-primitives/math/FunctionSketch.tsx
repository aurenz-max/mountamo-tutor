'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import katex from 'katex';
// @ts-ignore – CSS import works at runtime via Next.js loader
import 'katex/dist/katex.min.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FunctionSketchMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface CurvePoint {
  x: number;
  y: number;
}

export interface FeatureMarker {
  type: 'root' | 'maximum' | 'minimum' | 'y-intercept' | 'asymptote';
  x: number;
  y: number;
  label: string;
  tolerance: number;
}

export interface SketchKeyFeature {
  type: 'peak' | 'zero' | 'intercept' | 'trend';
  description: string;
  x: number;
  y: number;
  tolerance: number;
  weight: number;
}

export interface FunctionSketchChallenge {
  id: string;
  type: 'identify-features' | 'classify-shape' | 'sketch-match' | 'compare-functions';
  instruction: string;

  // Axes config per challenge
  xLabel: string;
  xMin: number;
  xMax: number;
  yLabel: string;
  yMin: number;
  yMax: number;

  // identify-features
  referenceCurve?: CurvePoint[];
  expression?: string;
  features?: FeatureMarker[];

  // classify-shape
  classifyCurve?: CurvePoint[];
  correctType?: string;
  options?: string[];
  classifyExplanation?: string;

  // sketch-match
  sketchDescription?: string;
  sketchExpression?: string;
  keyFeatures?: SketchKeyFeature[];
  revealCurve?: CurvePoint[];
  minPoints?: number;

  // compare-functions
  curveA?: CurvePoint[];
  curveB?: CurvePoint[];
  labelA?: string;
  labelB?: string;
  question?: string;
  correctCurve?: 'A' | 'B';
  compareExplanation?: string;
}

export interface FunctionSketchData {
  title: string;
  description?: string;
  context: string;
  challenges: FunctionSketchChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FunctionSketchMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHALLENGE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'identify-features': { label: 'Identify Features', icon: '🔍', accentColor: 'blue' },
  'classify-shape':    { label: 'Classify Shape',    icon: '📊', accentColor: 'purple' },
  'sketch-match':      { label: 'Sketch Match',      icon: '✏️', accentColor: 'emerald' },
  'compare-functions': { label: 'Compare Functions',  icon: '⚖️', accentColor: 'amber' },
};

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 450;
const PADDING = 55;

const FEATURE_COLORS: Record<string, string> = {
  root: '#ef4444',
  maximum: '#f59e0b',
  minimum: '#3b82f6',
  'y-intercept': '#8b5cf6',
  asymptote: '#ec4899',
};

// ============================================================================
// Helpers
// ============================================================================

function renderLatex(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    return latex;
  }
}

/** Catmull-Rom spline interpolation through control points */
function catmullRomSpline(points: CurvePoint[], numSegments = 20): CurvePoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const result: CurvePoint[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const p0 = sorted[Math.max(0, i - 1)];
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const p3 = sorted[Math.min(sorted.length - 1, i + 2)];

    for (let t = 0; t <= 1; t += 1 / numSegments) {
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      result.push({ x, y });
    }
  }
  return result;
}

/** Distance between a click point and a feature marker in graph coords */
function featureDistance(click: CurvePoint, feature: FeatureMarker, xRange: number, yRange: number): number {
  const nx = (click.x - feature.x) / xRange;
  const ny = (click.y - feature.y) / yRange;
  return Math.sqrt(nx * nx + ny * ny);
}

// ============================================================================
// Canvas Rendering
// ============================================================================

interface CanvasConfig {
  xMin: number; xMax: number; yMin: number; yMax: number;
  xLabel: string; yLabel: string;
}

function graphToCanvas(gx: number, gy: number, cfg: CanvasConfig): { x: number; y: number } {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;
  const x = PADDING + ((gx - cfg.xMin) / (cfg.xMax - cfg.xMin)) * w;
  const y = PADDING + ((cfg.yMax - gy) / (cfg.yMax - cfg.yMin)) * h;
  return { x, y };
}

function canvasToGraph(cx: number, cy: number, cfg: CanvasConfig): CurvePoint {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;
  const gx = cfg.xMin + ((cx - PADDING) / w) * (cfg.xMax - cfg.xMin);
  const gy = cfg.yMax - ((cy - PADDING) / h) * (cfg.yMax - cfg.yMin);
  return { x: gx, y: gy };
}

function drawAxes(ctx: CanvasRenderingContext2D, cfg: CanvasConfig) {
  const w = CANVAS_WIDTH - 2 * PADDING;
  const h = CANVAS_HEIGHT - 2 * PADDING;

  // Grid
  ctx.strokeStyle = 'rgba(100,116,139,0.2)';
  ctx.lineWidth = 0.5;
  const xStep = Math.max(1, Math.round((cfg.xMax - cfg.xMin) / 10));
  const yStep = Math.max(1, Math.round((cfg.yMax - cfg.yMin) / 8));

  for (let x = Math.ceil(cfg.xMin / xStep) * xStep; x <= cfg.xMax; x += xStep) {
    const { x: cx } = graphToCanvas(x, 0, cfg);
    ctx.beginPath(); ctx.moveTo(cx, PADDING); ctx.lineTo(cx, PADDING + h); ctx.stroke();
  }
  for (let y = Math.ceil(cfg.yMin / yStep) * yStep; y <= cfg.yMax; y += yStep) {
    const { y: cy } = graphToCanvas(0, y, cfg);
    ctx.beginPath(); ctx.moveTo(PADDING, cy); ctx.lineTo(PADDING + w, cy); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = 'rgba(226,232,240,0.6)';
  ctx.lineWidth = 1.5;

  // X-axis (at y=0 if visible, else at bottom)
  const yZero = Math.max(cfg.yMin, Math.min(cfg.yMax, 0));
  const { y: xAxisY } = graphToCanvas(0, yZero, cfg);
  ctx.beginPath(); ctx.moveTo(PADDING, xAxisY); ctx.lineTo(PADDING + w, xAxisY); ctx.stroke();

  // Y-axis (at x=0 if visible, else at left)
  const xZero = Math.max(cfg.xMin, Math.min(cfg.xMax, 0));
  const { x: yAxisX } = graphToCanvas(xZero, 0, cfg);
  ctx.beginPath(); ctx.moveTo(yAxisX, PADDING); ctx.lineTo(yAxisX, PADDING + h); ctx.stroke();

  // Tick labels
  ctx.fillStyle = 'rgba(203,213,225,0.7)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(cfg.xMin / xStep) * xStep; x <= cfg.xMax; x += xStep) {
    if (x === 0) continue;
    const { x: cx } = graphToCanvas(x, yZero, cfg);
    ctx.fillText(String(x), cx, xAxisY + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(cfg.yMin / yStep) * yStep; y <= cfg.yMax; y += yStep) {
    if (y === 0) continue;
    const { y: cy } = graphToCanvas(xZero, y, cfg);
    ctx.fillText(String(y), yAxisX - 6, cy);
  }

  // Axis labels
  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(cfg.xLabel, PADDING + w / 2, CANVAS_HEIGHT - 16);
  ctx.save();
  ctx.translate(14, PADDING + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(cfg.yLabel, 0, 0);
  ctx.restore();
}

function drawCurve(ctx: CanvasRenderingContext2D, points: CurvePoint[], cfg: CanvasConfig, color: string, lineWidth = 2.5) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  let started = false;
  for (const pt of points) {
    const { x, y } = graphToCanvas(pt.x, pt.y, cfg);
    if (x < PADDING || x > CANVAS_WIDTH - PADDING || y < PADDING || y > CANVAS_HEIGHT - PADDING) {
      started = false;
      continue;
    }
    if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
  }
  ctx.stroke();
}

function drawControlPoints(ctx: CanvasRenderingContext2D, points: CurvePoint[], cfg: CanvasConfig) {
  for (const pt of points) {
    const { x, y } = graphToCanvas(pt.x, pt.y, cfg);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawFeatureMarkers(
  ctx: CanvasRenderingContext2D,
  markers: Array<{ x: number; y: number; type: string; label: string; hit?: boolean }>,
  cfg: CanvasConfig,
) {
  for (const m of markers) {
    const { x, y } = graphToCanvas(m.x, m.y, cfg);
    const color = m.hit ? '#22c55e' : (FEATURE_COLORS[m.type] ?? '#94a3b8');
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = m.hit ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(m.label, x, y - 12);
  }
}

// ============================================================================
// Component
// ============================================================================

const FunctionSketch: React.FC<{ data: FunctionSketchData }> = ({ data }) => {
  const {
    title,
    description,
    context,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Evaluation ─────────────────────────────────────────────────
  const resolvedInstanceId = instanceId || `function-sketch-${Date.now()}`;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<FunctionSketchMetrics>({
    primitiveType: 'function-sketch',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ────────────────────────────────────────────────
  const { sendText } = useLuminaAI({
    primitiveType: 'function-sketch',
    instanceId: resolvedInstanceId,
    primitiveData: { title, context, challengeCount: challenges.length },
    gradeLevel: '9-12',
  });

  // ── Challenge progress ─────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── Canvas ref & current challenge ─────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const challenge = challenges[currentIndex];
  const cfg: CanvasConfig = {
    xMin: challenge?.xMin ?? -10, xMax: challenge?.xMax ?? 10,
    yMin: challenge?.yMin ?? -10, yMax: challenge?.yMax ?? 10,
    xLabel: challenge?.xLabel ?? 'x', yLabel: challenge?.yLabel ?? 'y',
  };
  const xRange = cfg.xMax - cfg.xMin;
  const yRange = cfg.yMax - cfg.yMin;

  // ── Mode-specific state ────────────────────────────────────────
  // identify-features: which features the student has clicked
  const [hitFeatures, setHitFeatures] = useState<Set<number>>(new Set());
  // classify-shape: selected option
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // sketch-match: placed control points
  const [controlPoints, setControlPoints] = useState<CurvePoint[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  // compare-functions: selected curve
  const [selectedCurve, setSelectedCurve] = useState<'A' | 'B' | null>(null);
  // feedback
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  const startTimeRef = useRef(Date.now());
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<FunctionSketchMetrics> | null>(null);

  // Reset state on challenge change
  useEffect(() => {
    setHitFeatures(new Set());
    setSelectedOption(null);
    setControlPoints([]);
    setShowReveal(false);
    setSelectedCurve(null);
    setFeedback(null);
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  // ── Canvas drawing ─────────────────────────────────────────────
  const splinePoints = useMemo(
    () => (controlPoints.length >= 2 ? catmullRomSpline(controlPoints) : []),
    [controlPoints],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !challenge) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawAxes(ctx, cfg);

    const type = challenge.type;

    if (type === 'identify-features') {
      if (challenge.referenceCurve) drawCurve(ctx, challenge.referenceCurve, cfg, '#3b82f6');
      if (challenge.features) {
        const markers = challenge.features.map((f, i) => ({
          ...f, hit: hitFeatures.has(i),
        }));
        drawFeatureMarkers(ctx, markers, cfg);
      }
    }

    if (type === 'classify-shape') {
      if (challenge.classifyCurve) drawCurve(ctx, challenge.classifyCurve, cfg, '#8b5cf6');
    }

    if (type === 'sketch-match') {
      // Student curve
      if (splinePoints.length > 0) drawCurve(ctx, splinePoints, cfg, '#38bdf8', 2);
      drawControlPoints(ctx, controlPoints, cfg);
      // Reveal curve
      if (showReveal && challenge.revealCurve) {
        drawCurve(ctx, challenge.revealCurve, cfg, '#22c55e', 2);
      }
    }

    if (type === 'compare-functions') {
      if (challenge.curveA) {
        const colorA = selectedCurve === 'A' ? '#38bdf8' : 'rgba(59,130,246,0.6)';
        drawCurve(ctx, challenge.curveA, cfg, colorA, selectedCurve === 'A' ? 3.5 : 2);
      }
      if (challenge.curveB) {
        const colorB = selectedCurve === 'B' ? '#f59e0b' : 'rgba(245,158,11,0.6)';
        drawCurve(ctx, challenge.curveB, cfg, colorB, selectedCurve === 'B' ? 3.5 : 2);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, cfg, hitFeatures, controlPoints, splinePoints, showReveal, selectedCurve]);

  // ── Canvas click handler ───────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!challenge || feedback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const gp = canvasToGraph(cx, cy, cfg);

    if (challenge.type === 'identify-features' && challenge.features) {
      // Check if click is near any un-hit feature
      for (let i = 0; i < challenge.features.length; i++) {
        if (hitFeatures.has(i)) continue;
        const dist = featureDistance(gp, challenge.features[i], xRange, yRange);
        if (dist < (challenge.features[i].tolerance / Math.max(xRange, yRange)) + 0.04) {
          const next = new Set(hitFeatures);
          next.add(i);
          setHitFeatures(next);
          sendText(`[FEATURE_FOUND] Student correctly identified "${challenge.features[i].label}" (${challenge.features[i].type}). ${next.size}/${challenge.features.length} found.`, { silent: true });
          break;
        }
      }
    }

    if (challenge.type === 'sketch-match') {
      // Constrain to axes area
      if (cx >= PADDING && cx <= CANVAS_WIDTH - PADDING && cy >= PADDING && cy <= CANVAS_HEIGHT - PADDING) {
        // Snap to closest existing point for drag-like behavior, or add new
        const SNAP_DIST = 12;
        let snapped = false;
        const updated = controlPoints.map(pt => {
          const { x, y } = graphToCanvas(pt.x, pt.y, cfg);
          if (!snapped && Math.abs(x - cx) < SNAP_DIST && Math.abs(y - cy) < SNAP_DIST) {
            snapped = true;
            return gp;
          }
          return pt;
        });
        if (snapped) {
          setControlPoints(updated);
        } else {
          setControlPoints(prev => [...prev, gp]);
        }
      }
    }
  }, [challenge, feedback, cfg, hitFeatures, controlPoints, xRange, yRange, sendText]);

  // ── Check answer ───────────────────────────────────────────────
  const handleCheck = useCallback(() => {
    if (!challenge) return;
    incrementAttempts();
    const type = challenge.type;
    let correct = false;
    let score = 0;

    if (type === 'identify-features' && challenge.features) {
      const found = hitFeatures.size;
      const total = challenge.features.length;
      score = Math.round((found / total) * 100);
      correct = score >= 80;
      setFeedback({
        correct,
        message: correct
          ? `Great! You identified ${found}/${total} features.`
          : `You found ${found}/${total} features. Try clicking near the marked locations.`,
      });
    }

    if (type === 'classify-shape') {
      correct = selectedOption === challenge.correctType;
      score = correct ? 100 : 0;
      setFeedback({
        correct,
        message: correct
          ? 'Correct classification!'
          : `Not quite. The correct type is "${challenge.correctType}". ${challenge.classifyExplanation ?? ''}`,
      });
    }

    if (type === 'sketch-match' && challenge.keyFeatures) {
      // Score based on key feature proximity
      let totalWeight = 0;
      let weightedScore = 0;
      for (const kf of challenge.keyFeatures) {
        totalWeight += kf.weight;
        // Find nearest control point or spline point to this feature
        const allPts = splinePoints.length > 0 ? splinePoints : controlPoints;
        let minDist = Infinity;
        for (const pt of allPts) {
          const d = Math.sqrt(
            ((pt.x - kf.x) / xRange) ** 2 + ((pt.y - kf.y) / yRange) ** 2,
          );
          minDist = Math.min(minDist, d);
        }
        const tol = (kf.tolerance / Math.max(xRange, yRange)) + 0.05;
        const featureScore = minDist <= tol ? 1 : Math.max(0, 1 - (minDist - tol) / (tol * 3));
        weightedScore += featureScore * kf.weight;
      }
      score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;
      correct = score >= 60;
      setShowReveal(true);
      setFeedback({
        correct,
        message: correct
          ? `Nice sketch! Feature match: ${score}%. The green curve shows the actual function.`
          : `Score: ${score}%. The green curve shows the actual function. Compare your sketch to it.`,
      });
    }

    if (type === 'compare-functions') {
      correct = selectedCurve === challenge.correctCurve;
      score = correct ? 100 : 0;
      setFeedback({
        correct,
        message: correct
          ? `Correct! Curve ${challenge.correctCurve} matches.`
          : `Not quite. The answer is Curve ${challenge.correctCurve}. ${challenge.compareExplanation ?? ''}`,
      });
    }

    sendText(
      correct
        ? `[ANSWER_CORRECT] Challenge ${currentIndex + 1}/${challenges.length}: ${type}. Score: ${score}%. Congratulate briefly.`
        : `[ANSWER_INCORRECT] Challenge ${currentIndex + 1}/${challenges.length}: ${type}. Score: ${score}%. Give a hint.`,
      { silent: true },
    );

    recordResult({
      challengeId: challenge.id,
      correct,
      attempts: currentAttempts + 1,
      score,
      type,
    });
  }, [
    challenge, currentIndex, challenges.length, currentAttempts, hitFeatures,
    selectedOption, selectedCurve, controlPoints, splinePoints, xRange, yRange,
    sendText, incrementAttempts, recordResult,
  ]);

  // ── Advance ────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!advanceProgress()) {
      // All done — submit evaluation
      const elapsed = Date.now() - startTimeRef.current;
      const totalScore = challengeResults.length > 0
        ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length)
        : 0;
      const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
      const correctCount = challengeResults.filter(r => r.correct).length;

      const featuresFound = challengeResults
        .filter(r => r.type === 'identify-features')
        .reduce((s, r) => s + ((r.score as number) ?? 0), 0);
      const sketchAccuracy = challengeResults
        .filter(r => r.type === 'sketch-match')
        .reduce((s, r) => s + ((r.score as number) ?? 0), 0);
      const sketchCount = challengeResults.filter(r => r.type === 'sketch-match').length;

      const result = submitResult(
        totalScore >= 60,
        totalScore,
        {
          type: 'function-sketch',
          evalMode: challenges[0]?.type ?? 'identify-features',
          featuresCorrect: correctCount,
          featuresTotal: challenges.length,
          sketchAccuracy: sketchCount > 0 ? Math.round(sketchAccuracy / sketchCount) : 0,
          classificationCorrect: challengeResults.some(r => r.type === 'classify-shape' && r.correct),
          controlPointsPlaced: controlPoints.length,
          completionTime: Math.round(elapsed / 1000),
          totalAttempts,
        },
      );

      setSubmittedResult(result);

      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(`[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${totalScore}%. Give encouraging phase-specific feedback.`, { silent: true });
    } else {
      sendText(`[NEXT_ITEM] Moving to challenge ${currentIndex + 2} of ${challenges.length}. Introduce it briefly.`, { silent: true });
    }
  }, [
    advanceProgress, challengeResults, challenges, controlPoints.length,
    currentIndex, phaseResults, sendText, submitResult,
  ]);

  // ── Check if current challenge can be submitted ────────────────
  const canSubmit = useMemo(() => {
    if (!challenge || feedback) return false;
    if (challenge.type === 'identify-features') return hitFeatures.size > 0;
    if (challenge.type === 'classify-shape') return selectedOption !== null;
    if (challenge.type === 'sketch-match') return controlPoints.length >= (challenge.minPoints ?? 3);
    if (challenge.type === 'compare-functions') return selectedCurve !== null;
    return false;
  }, [challenge, feedback, hitFeatures.size, selectedOption, controlPoints.length, selectedCurve]);

  // ── Early return ───────────────────────────────────────────────
  if (!challenges || challenges.length === 0) {
    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="p-6">
          <p className="text-slate-400">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  const localOverallScore = challengeResults.length > 0
    ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length)
    : 0;
  const elapsedMs = Date.now() - startTimeRef.current;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <Badge variant="outline" className="border-white/20 text-slate-300">
            {currentIndex + 1} / {challenges.length}
          </Badge>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
        <p className="text-slate-500 text-xs mt-1">{context}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary panel (when complete) */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You analyzed the functions!"
            className="mb-6"
          />
        )}

        {/* Active challenge */}
        {!allChallengesComplete && challenge && (
          <>
            {/* Instruction + expression */}
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-slate-200 text-sm font-medium">{challenge.instruction}</p>
              {challenge.expression && (
                <div
                  className="mt-2 text-blue-300 text-lg text-center"
                  dangerouslySetInnerHTML={{ __html: renderLatex(challenge.expression) }}
                />
              )}
              {challenge.sketchDescription && (
                <p className="text-blue-300 mt-2 text-center italic">{challenge.sketchDescription}</p>
              )}
              {challenge.sketchExpression && (
                <div
                  className="mt-1 text-blue-300 text-lg text-center"
                  dangerouslySetInnerHTML={{ __html: renderLatex(challenge.sketchExpression) }}
                />
              )}
              {challenge.question && (
                <p className="text-slate-300 mt-2">{challenge.question}</p>
              )}
            </div>

            {/* Canvas */}
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rounded-lg border border-white/10 bg-slate-950/60 cursor-crosshair max-w-full"
                style={{ maxWidth: '100%', height: 'auto' }}
                onClick={handleCanvasClick}
              />
            </div>

            {/* Curve legend for compare mode */}
            {challenge.type === 'compare-functions' && (
              <div className="flex gap-3 justify-center">
                <Button
                  variant="ghost"
                  className={`border ${selectedCurve === 'A' ? 'bg-blue-500/20 border-blue-400' : 'bg-white/5 border-white/20'} hover:bg-blue-500/15`}
                  onClick={() => setSelectedCurve('A')}
                >
                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-2 inline-block" />
                  {challenge.labelA ?? 'Curve A'}
                </Button>
                <Button
                  variant="ghost"
                  className={`border ${selectedCurve === 'B' ? 'bg-amber-500/20 border-amber-400' : 'bg-white/5 border-white/20'} hover:bg-amber-500/15`}
                  onClick={() => setSelectedCurve('B')}
                >
                  <span className="w-3 h-3 rounded-full bg-amber-500 mr-2 inline-block" />
                  {challenge.labelB ?? 'Curve B'}
                </Button>
              </div>
            )}

            {/* MC options for classify-shape */}
            {challenge.type === 'classify-shape' && challenge.options && (
              <div className="grid grid-cols-2 gap-2">
                {challenge.options.map(opt => (
                  <Button
                    key={opt}
                    variant="ghost"
                    className={`border text-left ${selectedOption === opt ? 'bg-purple-500/20 border-purple-400 text-purple-200' : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10'}`}
                    onClick={() => !feedback && setSelectedOption(opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            {/* Sketch controls */}
            {challenge.type === 'sketch-match' && !feedback && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">
                  {controlPoints.length} point{controlPoints.length !== 1 ? 's' : ''} placed
                  {challenge.minPoints ? ` (min ${challenge.minPoints})` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-400 ml-auto"
                  onClick={() => setControlPoints([])}
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Feature legend for identify mode */}
            {challenge.type === 'identify-features' && challenge.features && (
              <div className="flex flex-wrap gap-2">
                {challenge.features.map((f, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`text-xs ${hitFeatures.has(i) ? 'border-green-400/50 text-green-300 bg-green-500/10' : 'border-white/20 text-slate-400'}`}
                  >
                    {hitFeatures.has(i) ? '✓' : '○'} {f.label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-lg p-3 border ${feedback.correct ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200' : 'bg-red-500/10 border-red-400/30 text-red-200'}`}>
                <p className="text-sm">{feedback.message}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-end">
              {!feedback ? (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  disabled={!canSubmit}
                  onClick={handleCheck}
                >
                  Check Answer
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
                  onClick={handleNext}
                >
                  {currentIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FunctionSketch;
