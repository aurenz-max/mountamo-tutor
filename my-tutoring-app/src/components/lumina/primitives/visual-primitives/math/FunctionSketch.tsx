'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import katex from 'katex';
// @ts-ignore – CSS import works at runtime via Next.js loader
import 'katex/dist/katex.min.css';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaButton,
  LuminaBadge,
  LuminaPrompt,
  LuminaChallengeCounter,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FunctionSketchMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PADDING,
  graphToCanvas,
  canvasToGraph,
} from './canvas-2d/coords';
import {
  catmullRomSpline,
  drawAxes,
  drawCurve,
  drawControlPoints,
  drawFeatureMarkers,
} from './canvas-2d/shapes';
import type { CurvePoint, FeatureMarker } from './canvas-2d/types';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  axesOf, canCheck, checkWork, describeSketchWork, featureAt, functionSketchMiss, workspaceAssignment, workspaceScene,
  type SketchWork,
} from './functionSketchWorkspace';
import {
  AXIS_GLOW, EQUAL_STEPS, FAMILY_GALLERY, FEATURE_GUIDE, FEATURE_MODEL, FEATURE_NAMES, FLIP_MODEL, MODEL_FEATURES,
  SKETCH_STEPS, TURN_MARKS, curvesOf, functionSketchLevers, galleryPanels, isPracticeItem, leverFacts, simplerItem,
  staircase, turnsAndCrossings,
} from './functionSketchLevers';
import { FEATURE_COLORS } from './canvas-2d/shapes';

// Re-export shared types so existing call sites (manifest schemas, etc.)
// keep importing from FunctionSketch.
export type { CurvePoint, FeatureMarker };

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

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

  // ── Support tier (set by the generator from config.difficulty) ──
  // identify-features perception aids — withdrawn at harder tiers.
  // `showFeatureHints` false → no target rings on the curve (only confirmed
  // hits light up). `showFeatureLabels` true → feature names (canvas + legend).
  // Rings default on; names show only when true (the easy tier), so no tier behaves as medium.
  showFeatureHints?: boolean;
  showFeatureLabels?: boolean;
  // The resolved tier for this challenge — calibrates the AI tutor's reveal level.
  supportTier?: 'easy' | 'medium' | 'hard';
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

/**
 * Reveal-level clause appended to the AI tutor's hint prompt (scripted path) so it never leaks
 * what the support tier withheld on screen. easy → may name the strategy and
 * the feature types; medium → nudge the next step without naming the answer;
 * hard → do NOT name features/family, ask what the student observes.
 */
function tutorRevealClause(tier?: string, type?: string): string {
  if (!tier) return '';
  if (tier === 'hard') {
    return type === 'identify-features'
      ? ' [TIER hard] Do NOT name the features or their locations; ask what the student notices about the curve\'s direction and where it crosses or turns.'
      : ' [TIER hard] Do NOT name the function family or reveal the answer; ask what the student observes about the shape.';
  }
  if (tier === 'medium') {
    return ' [TIER medium] Nudge toward the next step without naming the answer outright.';
  }
  return ' [TIER easy] You may name the strategy and the feature types to look for; keep it brief and encouraging.';
}

/** y = a·x² on -3..3, for the flip model. */
const sampleParabola = (a: number): CurvePoint[] => Array.from({ length: 31 }, (_, i) => { const x = -3 + i * 0.2; return { x, y: a * x * x }; });

/** A small plane for a lever's model (outside the item): curves, coloured dots and a caption. */
const MiniPlot: React.FC<{
  curves: Array<{ points: readonly CurvePoint[]; color: string }>;
  dots?: Array<{ x: number; y: number; color: string }>;
  x: [number, number]; y: [number, number]; caption: string; lever?: string;
}> = ({ curves, dots = [], x, y, caption, lever }) => {
  const W = 150, H = 110, P = 8;
  const tx = (v: number) => P + ((v - x[0]) / (x[1] - x[0])) * (W - 2 * P);
  const ty = (v: number) => P + ((y[1] - v) / (y[1] - y[0])) * (H - 2 * P);
  const path = (pts: readonly CurvePoint[]) => pts.filter(p => Number.isFinite(p.y) && p.y >= y[0] && p.y <= y[1])
    .map((p, i) => `${i ? 'L' : 'M'} ${tx(p.x).toFixed(1)} ${ty(p.y).toFixed(1)}`).join(' ');
  return (
    <figure data-lever={lever} className="rounded-lg border border-white/10 bg-slate-900/40 p-2 text-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-36">
        {x[0] <= 0 && x[1] >= 0 && <line x1={tx(0)} y1={P} x2={tx(0)} y2={H - P} stroke="white" strokeOpacity={0.4} />}
        {y[0] <= 0 && y[1] >= 0 && <line x1={P} y1={ty(0)} x2={W - P} y2={ty(0)} stroke="white" strokeOpacity={0.4} />}
        {curves.map((c, i) => <path key={i} d={path(c.points)} fill="none" stroke={c.color} strokeWidth={2} />)}
        {dots.map((d, i) => <circle key={i} cx={tx(d.x)} cy={ty(d.y)} r={3.5} fill={d.color} />)}
      </svg>
      <figcaption className="mt-1 text-xs text-violet-200">{caption}</figcaption>
    </figure>
  );
};

// ============================================================================
// Component
// ============================================================================

interface FunctionSketchProps {
  data: FunctionSketchData;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const FunctionSketchSurface = ({ data, runtimePlanItemId, tutorOwned, useController }:
  FunctionSketchProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FunctionSketchChallenge>) => Progress }) => {
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
  const workspace = useRef<TeachingWorkspace | null>(null);

  // ── Evaluation ─────────────────────────────────────────────────
  // A fallback id made once: an id minted per render re-registers Pip's surface every render.
  const fallbackInstanceId = useRef(`function-sketch-${Date.now()}`).current;
  const resolvedInstanceId = instanceId || fallbackInstanceId;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<FunctionSketchMetrics>({
    primitiveType: 'function-sketch',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring (scripted path; on the workspace path the tutor reads the scene instead) ──
  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'function-sketch',
    instanceId: resolvedInstanceId,
    // supportTier is session-uniform (difficulty is a student property), so the
    // first challenge's tier represents the session for the tutor's framing.
    primitiveData: { title, context, challengeCount: challenges.length, supportTier: challenges[0]?.supportTier },
    gradeLevel: '9-12',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  /** Bound below, once the setters exist; the progress hook calls them only after render. */
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    mergeResult,
    advance: advanceProgress,
  } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const blocked = tutorOwned && progress.canAttempt === false;
  const workspaceClosed = useRef(false);
  workspaceClosed.current = blocked;
  const learnerBlocked = () => workspaceClosed.current;

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: CHALLENGE_TYPE_CONFIG,
  });

  // ── Canvas ref & current challenge ─────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // In-item levers (`functionSketchLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FunctionSketchChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const challenge = practice ?? sessionChallenge ?? undefined;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  /** A runtime pull on the session item; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const cfg = challenge ? axesOf(challenge) : axesOf({} as FunctionSketchChallenge);

  // ── Mode-specific state ────────────────────────────────────────
  // identify-features: which features the student has found, and taps that found none
  const [hitFeatures, setHitFeatures] = useState<Set<number>>(new Set());
  const [strayTaps, setStrayTaps] = useState(0);
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
  const recordedRef = useRef(false);
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult<FunctionSketchMetrics> | null>(null);

  /** A fresh item (both paths) or Try again (workspace): nothing found, chosen or placed, the feedback gone. */
  const resetWork = () => {
    setHitFeatures(new Set());
    setStrayTaps(0);
    setSelectedOption(null);
    setControlPoints([]);
    setShowReveal(false);
    setSelectedCurve(null);
    setFeedback(null);
    recordedRef.current = false;
  };
  openItem.current = (_index, retry) => {
    // Try again on a practice item keeps it; a fresh item (or the full item back after practice) drops it.
    if (!retry) setPractice(null);
    resetWork();
  };

  // Reset state on challenge change (keyed on challenge.id per PRD §7 #5).
  useEffect(() => {
    resetWork();
    startTimeRef.current = Date.now();
  }, [challenge?.id]);

  const work: SketchWork = useMemo(() => ({
    found: Array.from(hitFeatures), strayTaps, chosen: selectedOption, curve: selectedCurve, points: controlPoints,
  }), [hitFeatures, strayTaps, selectedOption, selectedCurve, controlPoints]);

  // ── Canvas drawing ─────────────────────────────────────────────
  const splinePoints = useMemo(
    () => (controlPoints.length >= 2 ? catmullRomSpline(controlPoints) : []),
    [controlPoints],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !challenge) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawAxes(ctx, cfg);

    const type = challenge.type;

    if (type === 'identify-features') {
      if (challenge.referenceCurve) drawCurve(ctx, challenge.referenceCurve, cfg, '#3b82f6');
      if (challenge.features) {
        const hintsOn = challenge.showFeatureHints !== false;   // tier: hard hides target rings
        const labelsOn = challenge.showFeatureLabels === true; // names only where the easy tier asks: no tier behaves as medium
        const markers = challenge.features
          .map((f, i) => ({ ...f, label: labelsOn ? f.label : '', hit: hitFeatures.has(i) }))
          // When hints are withdrawn, still confirm the student's OWN hits, but
          // never draw a ring on an un-found feature (no give-away at hard).
          .filter((m) => hintsOn || m.hit);
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
      // Reveal curve (after a check; on the workspace path only after a credited one)
      if (showReveal && challenge.revealCurve) {
        drawCurve(ctx, challenge.revealCurve, cfg, '#22c55e', 2);
      }
    }

    // Lever overlays on the session item: the staircase of equal steps and the bright axes.
    if (leverOn(EQUAL_STEPS)) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.5;
      for (const curve of curvesOf(challenge)) {
        for (const s of staircase(curve)) {
          const a = graphToCanvas(s.from.x, s.from.y, cfg), b = graphToCanvas(s.corner.x, s.corner.y, cfg), d = graphToCanvas(s.to.x, s.to.y, cfg);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.stroke();
        }
      }
    }
    if (leverOn(AXIS_GLOW)) {
      ctx.strokeStyle = 'rgba(253,230,138,0.9)';
      ctx.lineWidth = 4;
      const xAxis = graphToCanvas(0, Math.max(cfg.yMin, Math.min(cfg.yMax, 0)), cfg).y;
      const yAxis = graphToCanvas(Math.max(cfg.xMin, Math.min(cfg.xMax, 0)), 0, cfg).x;
      ctx.beginPath(); ctx.moveTo(PADDING, xAxis); ctx.lineTo(CANVAS_WIDTH - PADDING, xAxis); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(yAxis, PADDING); ctx.lineTo(yAxis, CANVAS_HEIGHT - PADDING); ctx.stroke();
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
    if (leverOn(TURN_MARKS)) {
      ctx.fillStyle = '#fde68a';
      for (const curve of curvesOf(challenge)) {
        for (const p of turnsAndCrossings(curve)) {
          const at = graphToCanvas(p.x, p.y, cfg);
          ctx.beginPath(); ctx.arc(at.x, at.y, 5, 0, 2 * Math.PI); ctx.fill();
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, hitFeatures, controlPoints, splinePoints, showReveal, selectedCurve, pulledLevers.join(), practice]);

  // ── Canvas tap handler (pointer down: a tap lands where it starts) ──
  const handleCanvasTap = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!challenge || feedback || learnerBlocked()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const gp = canvasToGraph(cx, cy, cfg);

    if (challenge.type === 'identify-features' && challenge.features) {
      const i = featureAt(challenge, gp, Array.from(hitFeatures));
      if (i == null) {
        setStrayTaps(n => n + 1);
        return;
      }
      const next = new Set(hitFeatures);
      next.add(i);
      setHitFeatures(next);
      SoundManager.snap();        // ← feature lands / discovered
      sendText(`[FEATURE_FOUND] Student correctly identified "${challenge.features[i].label}" (${challenge.features[i].type}). ${next.size}/${challenge.features.length} found.`, { silent: true });
    }

    if (challenge.type === 'sketch-match') {
      // Constrain to axes area
      if (cx >= PADDING && cx <= CANVAS_WIDTH - PADDING && cy >= PADDING && cy <= CANVAS_HEIGHT - PADDING) {
        SoundManager.tap();        // ← control point placed
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, feedback, cfg, hitFeatures, controlPoints, sendText]);

  // ── Check answer. Every check commits, right or wrong. ─────────
  const handleCheck = useCallback(() => {
    if (!challenge || learnerBlocked()) return;
    // Stale-state guard (PRD §6a #8): user could (in principle) click Check Answer
    // a second time before the reset effect for the next challenge runs.
    if (recordedRef.current) return;
    if (!canCheck(challenge, work)) return;
    const type = challenge.type;
    const { correct, score } = checkWork(challenge, work);

    if (type === 'identify-features') {
      const total = challenge.features?.length ?? 0;
      setFeedback({
        correct,
        message: correct
          ? `Great! You identified ${work.found.length}/${total} features.`
          : tutorOwned
            ? `You found ${work.found.length}/${total} features. Not quite.`
            : `You found ${work.found.length}/${total} features. Try clicking near the marked locations.`,
      });
    }

    if (type === 'classify-shape') {
      setFeedback({
        correct,
        message: correct
          ? 'Correct classification!'
          : tutorOwned ? 'Not quite.' : `Not quite. The correct type is "${challenge.correctType}". ${challenge.classifyExplanation ?? ''}`,
      });
    }

    if (type === 'sketch-match') {
      // The actual function is drawn after a credited sketch; on the scripted path also after a wrong one, which
      // moves on. On the workspace path a wrong sketch is tried again, so the answer stays hidden.
      if (correct || !tutorOwned) setShowReveal(true);
      setFeedback({
        correct,
        message: correct
          ? `Nice sketch! Feature match: ${score}%. The green curve shows the actual function.`
          : tutorOwned
            ? `Feature match: ${score}%. Not quite.`
            : `Score: ${score}%. The green curve shows the actual function. Compare your sketch to it.`,
      });
    }

    if (type === 'compare-functions') {
      setFeedback({
        correct,
        message: correct
          ? `Correct! Curve ${challenge.correctCurve} matches.`
          : tutorOwned ? 'Not quite.' : `Not quite. The answer is Curve ${challenge.correctCurve}. ${challenge.compareExplanation ?? ''}`,
      });
    }

    sendText(
      correct
        ? `[ANSWER_CORRECT] Challenge ${currentIndex + 1}/${challenges.length}: ${type}. Score: ${score}%. Congratulate briefly.`
        : `[ANSWER_INCORRECT] Challenge ${currentIndex + 1}/${challenges.length}: ${type}. Score: ${score}%. Give a hint.${tutorRevealClause(challenge.supportTier, type)}`,
      { silent: true },
    );

    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();

    recordedRef.current = true;
    // The checked gesture (counts the attempt, records the verdict on both paths), then this primitive's own fields.
    progress.commitCheck(describeSketchWork(challenge, work), correct, functionSketchMiss(challenge, work));
    // The scripted path moves on after one check, so it records a wrong one too; the workspace path records only credit.
    // An easier practice item (a simplify lever) is not the session's challenge: it records nothing of its own.
    if ((correct || !tutorOwned) && !isPracticeItem(challenge)) {
      mergeResult({ challengeId: challenge.id, correct, attempts: currentAttempts + 1, score, type });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, currentIndex, challenges.length, currentAttempts, work, tutorOwned, sendText, mergeResult, progress.commitCheck]);

  // ── Advance (scripted path; the workspace path has no Next and the runtime advances) ──
  const handleNext = useCallback(() => {
    if (tutorOwned) return;
    if (!advanceProgress()) {
      // All done — submit aggregate evaluation (PRD §6a #11 flattened shape).
      const totalChallenges = challengeResults.length;
      const overallAccuracy = totalChallenges > 0
        ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / totalChallenges)
        : 0;
      const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
      const correctCount = challengeResults.filter(r => r.correct).length;
      const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
      const hintsViewed = challengeResults.filter(r => r.attempts > 1).length;
      const averageAttemptsPerChallenge = totalChallenges > 0
        ? Math.round((attemptsCount / totalChallenges) * 10) / 10
        : 0;

      const result = submitResult(
        overallAccuracy >= 60,
        overallAccuracy,
        {
          type: 'function-sketch',
          challengeType: (challenges[0]?.type ?? 'identify-features') as FunctionSketchMetrics['challengeType'],
          totalChallenges,
          correctCount,
          attemptsCount,
          firstTryCount,
          hintsViewed,
          overallAccuracy,
          averageAttemptsPerChallenge,
        },
      );

      setSubmittedResult(result);

      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(`[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallAccuracy}%. Give encouraging phase-specific feedback.`, { silent: true });
    } else {
      sendText(`[NEXT_ITEM] Moving to challenge ${currentIndex + 2} of ${challenges.length}. Introduce it briefly.`, { silent: true });
    }
  }, [
    tutorOwned, advanceProgress, challengeResults, challenges,
    currentIndex, phaseResults, sendText, submitResult,
  ]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  const submittedRef = useRef(false);
  finish.current = (result) => {
    if (hasSubmitted || submittedRef.current || challenges.length === 0 || progress.recordsEvaluation === false) return;
    submittedRef.current = true;
    const submitted = submitResult(result.passed, result.accuracy, {
      type: 'function-sketch',
      challengeType: (challenges[0]?.type ?? 'identify-features') as FunctionSketchMetrics['challengeType'],
      totalChallenges: challenges.length,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: challenges.length - result.firstTryCount,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: Math.round((result.attemptsCount / challenges.length) * 10) / 10,
    }, { challengeResults: result.outcomes, learningResponses: result.learningResponses,
      teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
    undefined, result.diagnosisEvidence);
    setSubmittedResult(submitted);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render. ──
  useLayoutEffect(() => {
    if (!tutorOwned || !challenge || !sessionChallenge) return;
    const scene = workspaceScene(challenge, { work });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : functionSketchLevers(sessionChallenge, pulledLevers);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier practice item is on screen in place of the item. It is not graded; the full item comes back after it.' } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerItem(sessionChallenge);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); setPractice(easier); resetWork();
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(); },
    };
  });

  // ── Check if current challenge can be submitted ────────────────
  const canSubmit = !!challenge && !feedback && !blocked && canCheck(challenge, work);

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted ? null : challenge?.id ?? null,
    label: 'The function graph and your answer',
    solved: challengeResults.some((r) => r.challengeId === challenge?.id && r.correct),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!challenges || challenges.length === 0) {
    return (
      <LuminaCard>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  const localOverallScore = challengeResults.length > 0
    ? Math.round(challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), 0) / challengeResults.length)
    : 0;
  const elapsedMs = Date.now() - startTimeRef.current;
  const choiceClosed = !!feedback || blocked;

  return (
    <LuminaCard>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} />
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
        <p className="text-slate-500 text-xs mt-1">{context}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
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
            <LuminaPrompt>
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
            </LuminaPrompt>

            {/* Pip's dock sits above the workspace, which it outlines as a region. */}
            {pip.store && !allChallengesComplete && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
            {/* Canvas — bespoke interaction surface */}
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                data-pip-object="canvas"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="rounded-lg border border-white/10 bg-slate-950/60 cursor-crosshair max-w-full"
                style={{ maxWidth: '100%', height: 'auto' }}
                onMouseDown={handleCanvasTap}
              />
            </div>

            {/* Curve selectors for compare mode — selection tint mirrors the
                canvas curve colors (bespoke painting), chrome via LuminaButton */}
            {challenge.type === 'compare-functions' && (
              <div className="flex gap-3 justify-center">
                <LuminaButton
                  className={selectedCurve === 'A' ? 'bg-blue-500/20 border-blue-400 hover:bg-blue-500/15' : undefined}
                  disabled={choiceClosed}
                  onClick={() => { if (!choiceClosed && !learnerBlocked()) { SoundManager.select(); setSelectedCurve('A'); } }}
                >
                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-2 inline-block" />
                  {challenge.labelA ?? 'Curve A'}
                </LuminaButton>
                <LuminaButton
                  className={selectedCurve === 'B' ? 'bg-amber-500/20 border-amber-400 hover:bg-amber-500/15' : undefined}
                  disabled={choiceClosed}
                  onClick={() => { if (!choiceClosed && !learnerBlocked()) { SoundManager.select(); setSelectedCurve('B'); } }}
                >
                  <span className="w-3 h-3 rounded-full bg-amber-500 mr-2 inline-block" />
                  {challenge.labelB ?? 'Curve B'}
                </LuminaButton>
              </div>
            )}

            {/* MC options for classify-shape */}
            {challenge.type === 'classify-shape' && challenge.options && (
              <div className="grid grid-cols-2 gap-2">
                {challenge.options.map(opt => (
                  <LuminaAnswerChoice
                    key={opt}
                    state={selectedOption === opt ? 'selected' : 'idle'}
                    className="p-3"
                    disabled={choiceClosed}
                    onClick={() => { if (!choiceClosed && !learnerBlocked()) { SoundManager.select(); setSelectedOption(opt); } }}
                  >
                    {opt}
                  </LuminaAnswerChoice>
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
                <LuminaButton
                  tone="subtle"
                  size="sm"
                  className="ml-auto"
                  disabled={blocked}
                  onClick={() => { if (!learnerBlocked()) setControlPoints([]); }}
                >
                  Clear
                </LuminaButton>
              </div>
            )}

            {/* Feature legend for identify mode — hit state mirrors discovery */}
            {challenge.type === 'identify-features' && challenge.features && (
              <div className="flex flex-wrap gap-2">
                {challenge.features.map((f, i) => (
                  <LuminaBadge
                    key={i}
                    accent={hitFeatures.has(i) ? 'emerald' : undefined}
                    className="text-xs"
                  >
                    {hitFeatures.has(i) ? '✓' : '○'}{' '}
                    {challenge.showFeatureLabels === true ? f.label : leverOn(FEATURE_NAMES) ? f.type : `Feature ${i + 1}`}
                  </LuminaBadge>
                ))}
              </div>
            )}

            {/* Lever captions, frames and models (`functionSketchLevers.ts`), on the session item only */}
            {leverOn(TURN_MARKS) && (
              <p data-lever="turn-marks" className="text-center text-xs text-amber-200">Yellow dots mark where the curve turns and where it crosses the x-axis.</p>
            )}
            {leverOn(EQUAL_STEPS) && (
              <p data-lever="equal-steps" className="text-center text-xs text-amber-200">The yellow staircase takes equal steps across; each riser is how much the curve rises or falls over one step.</p>
            )}
            {leverOn(AXIS_GLOW) && (
              <p data-lever="axis-glow" className="text-center text-xs text-amber-200">Roots sit on the x-axis; the y-intercept sits on the y-axis.</p>
            )}
            {leverOn(FEATURE_GUIDE) && (
              <p data-lever="feature-guide" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
                A root is where the curve crosses the x-axis. A maximum or minimum is where the curve turns from rising to falling, or back.
                The y-intercept is where it crosses the y-axis. An asymptote is a line the curve gets closer and closer to but never reaches.
              </p>
            )}
            {leverOn(SKETCH_STEPS) && (
              <p data-lever="sketch-steps" className="rounded-lg border border-violet-500/30 bg-slate-950/40 p-3 text-center text-sm text-violet-200">
                First find where it crosses the x-axis (y is zero), then where it crosses the y-axis (x is zero), then where it turns,
                then which way each end goes. Place a point at each, then a few between.
              </p>
            )}
            {leverOn(FAMILY_GALLERY) && challenge && (
              <div data-lever="family-gallery" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {galleryPanels(challenge).map(panel => (
                  <MiniPlot key={panel.name} x={[-3, 3]} y={[-3.5, 3.5]} caption={panel.name}
                    curves={panel.curve ? [{ points: panel.curve, color: '#a78bfa' }] : []} />
                ))}
              </div>
            )}
            {leverOn(MODEL_FEATURES) && (
              <div className="mx-auto w-48">
                <MiniPlot lever="model-features" x={[-2, 4]} y={[-5, 5]}
                  caption={`Worked example: ${FEATURE_MODEL.expression}: roots, minimum and y-intercept`}
                  curves={[{ points: FEATURE_MODEL.curve, color: '#a78bfa' }]}
                  dots={FEATURE_MODEL.features.map(f => ({ x: f.x, y: f.y, color: FEATURE_COLORS[f.type] }))} />
              </div>
            )}
            {leverOn(FLIP_MODEL) && (
              <div data-lever="flip-model" className="mx-auto grid w-80 grid-cols-2 gap-2">
                <MiniPlot x={[-3, 3]} y={[-5, 5]} caption="y = x² opens up" curves={[{ points: sampleParabola(1), color: '#a78bfa' }]} />
                <MiniPlot x={[-3, 3]} y={[-5, 5]} caption="y = -x² opens down" curves={[{ points: sampleParabola(-1), color: '#fda4af' }]} />
              </div>
            )}

            </div>

            {/* Feedback. With the tutor, Try again is the shell's and the hint is the tutor's. */}
            {feedback && (
              <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'} className="p-4">
                <p className="text-sm">{feedback.message}</p>
              </LuminaFeedbackCard>
            )}

            {/* Action buttons. The workspace path has no Next: the runtime advances. */}
            <div className="flex gap-2 justify-end">
              {!feedback ? (
                <LuminaActionButton
                  action="check"
                  disabled={!canSubmit}
                  onClick={handleCheck}
                />
              ) : !tutorOwned && (
                <LuminaActionButton
                  action="next"
                  onClick={handleNext}
                >
                  {currentIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
                </LuminaActionButton>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FunctionSketch = withWorkspaceController<FunctionSketchProps, ProgressOptions<FunctionSketchChallenge>, Progress>(
  'function-sketch', FunctionSketchSurface, useScriptedProgress, useWorkspaceProgressFor('function-sketch'));

export default FunctionSketch;
