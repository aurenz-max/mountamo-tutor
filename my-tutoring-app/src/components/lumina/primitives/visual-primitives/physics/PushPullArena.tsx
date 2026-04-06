'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { PushPullArenaMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type ArenaSurface = 'ice' | 'wood' | 'carpet' | 'grass';
export type PushPullDirection = 'push' | 'pull';
export type PushPullChallengeType = 'observe' | 'predict' | 'compare' | 'design';
export type ArenaTheme = 'playground' | 'toys' | 'sports' | 'animals';

export interface PushPullChallenge {
  id: string;
  type: PushPullChallengeType;
  instruction: string;
  // Primary object
  objectName: string;
  objectWeight: number; // 1-10
  objectEmoji: string;
  // Second object (compare mode only)
  object2Name?: string;
  object2Weight?: number;
  object2Emoji?: string;
  // Environment
  surface: ArenaSurface;
  // Force settings (observe / predict)
  pushStrength?: number; // 1-10
  pushDirection?: PushPullDirection;
  // Design mode
  goalDescription?: string;
  // Answer
  correctAnswer: string;
  distractor0: string;
  distractor1: string;
  distractor2?: string;
  hint: string;
}

export interface PushPullArenaData {
  title: string;
  description: string;
  theme: ArenaTheme;
  challenges: PushPullChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

interface PushPullArenaProps {
  data: PushPullArenaData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CANVAS_W = 700;
const CANVAS_H = 300;
const GROUND_Y = CANVAS_H - 60;
const OBJECT_Y = GROUND_Y - 5; // objects sit on ground

const FRICTION_COEFFICIENTS: Record<ArenaSurface, number> = {
  ice: 0.03,
  wood: 0.20,
  carpet: 0.50,
  grass: 0.40,
};

const SURFACE_COLORS: Record<ArenaSurface, { ground: string; bg: string; label: string }> = {
  ice: { ground: '#B3E5FC', bg: '#0D47A1', label: 'Ice' },
  wood: { ground: '#8D6E63', bg: '#3E2723', label: 'Wood Floor' },
  carpet: { ground: '#7B1FA2', bg: '#4A148C', label: 'Carpet' },
  grass: { ground: '#66BB6A', bg: '#1B5E20', label: 'Grass' },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe: { label: 'Observe', icon: '👀', accentColor: 'blue' },
  predict: { label: 'Predict', icon: '🔮', accentColor: 'purple' },
  compare: { label: 'Compare', icon: '⚖️', accentColor: 'emerald' },
  design:  { label: 'Design',  icon: '🎯', accentColor: 'amber' },
};

// Force scaling: pushStrength 1-10 maps to Newtons
const FORCE_SCALE = 8; // 1 pushStrength = 8N

// =============================================================================
// Physics Engine
// =============================================================================

interface PhysicsObject {
  x: number;
  v: number;
  mass: number;
  radius: number;
  emoji: string;
  name: string;
  color: string;
}

interface PhysicsState {
  objects: PhysicsObject[];
  appliedForce: number; // positive = right (push), negative = left (pull)
  surface: ArenaSurface;
  isRunning: boolean;
  forceActive: boolean;
  forceAppliedDuration: number; // frames the force has been active
  trailPoints: Array<{ x: number; y: number; alpha: number }>;
}

function objectRadius(weight: number): number {
  return 16 + weight * 3; // 19px for 1kg, 46px for 10kg
}

function objectColor(weight: number): string {
  // Heavier = darker orange/red
  const r = Math.min(255, 180 + weight * 8);
  const g = Math.max(60, 160 - weight * 10);
  const b = 60;
  return `rgb(${r}, ${g}, ${b})`;
}

function stepPhysics(state: PhysicsState, dt: number): PhysicsState {
  const mu = FRICTION_COEFFICIENTS[state.surface];
  const next = { ...state, objects: state.objects.map(o => ({ ...o })), trailPoints: [...state.trailPoints] };

  for (const obj of next.objects) {
    // Applied force (only while forceActive, apply for 0.5s then release)
    let fApplied = 0;
    if (state.forceActive && state.forceAppliedDuration < 30) {
      fApplied = state.appliedForce;
    }

    // Friction opposes motion (or prevents starting if static friction > applied)
    const fFriction = mu * obj.mass * 9.8;
    let fNet: number;

    if (Math.abs(obj.v) < 0.01 && Math.abs(fApplied) < fFriction) {
      // Static friction holds — object doesn't move
      fNet = 0;
      obj.v = 0;
    } else {
      // Kinetic friction opposes motion direction
      const frictionDir = obj.v !== 0 ? -Math.sign(obj.v) : Math.sign(fApplied);
      fNet = fApplied + frictionDir * fFriction;

      // Prevent friction from reversing direction
      if (fApplied === 0 && Math.sign(fNet) !== Math.sign(obj.v) && obj.v !== 0) {
        fNet = 0;
        obj.v = 0;
      }
    }

    const a = fNet / obj.mass;
    obj.v += a * dt;
    obj.x += obj.v * dt;

    // Clamp to canvas bounds
    const minX = obj.radius + 20;
    const maxX = CANVAS_W - obj.radius - 20;
    if (obj.x < minX) { obj.x = minX; obj.v = Math.abs(obj.v) * 0.3; }
    if (obj.x > maxX) { obj.x = maxX; obj.v = -Math.abs(obj.v) * 0.3; }

    // Trail
    if (Math.abs(obj.v) > 0.5) {
      next.trailPoints.push({ x: obj.x, y: OBJECT_Y - obj.radius / 2, alpha: 0.5 });
    }
  }

  // Fade trail
  next.trailPoints = next.trailPoints
    .map(p => ({ ...p, alpha: p.alpha - 0.01 }))
    .filter(p => p.alpha > 0);

  if (state.forceActive) {
    next.forceAppliedDuration = state.forceAppliedDuration + 1;
    // Auto-release force after 30 frames (0.5s)
    if (next.forceAppliedDuration >= 30) {
      next.forceActive = false;
    }
  }

  // Check if simulation is done (all objects near-stopped and no force)
  const allStopped = next.objects.every(o => Math.abs(o.v) < 0.05);
  if (allStopped && !next.forceActive) {
    next.isRunning = false;
    next.objects.forEach(o => { o.v = 0; });
  }

  return next;
}

// =============================================================================
// Canvas Drawing
// =============================================================================

function drawArena(
  ctx: CanvasRenderingContext2D,
  state: PhysicsState,
  dpr: number,
  showForceArrows: boolean,
) {
  const w = CANVAS_W;
  const h = CANVAS_H;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const surfaceStyle = SURFACE_COLORS[state.surface];

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#0F172A');
  skyGrad.addColorStop(1, surfaceStyle.bg);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, GROUND_Y);

  // Ground
  ctx.fillStyle = surfaceStyle.ground;
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

  // Ground texture line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(w, GROUND_Y);
  ctx.stroke();

  // Surface label
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(surfaceStyle.label, w - 10, h - 10);

  // Distance markers
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (let x = 100; x < w; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, GROUND_Y + 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
  }

  // Trail
  for (const t of state.trailPoints) {
    ctx.fillStyle = `rgba(255, 200, 100, ${t.alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Objects
  for (const obj of state.objects) {
    const r = obj.radius;
    const cx = obj.x;
    const cy = OBJECT_Y - r;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, OBJECT_Y + 2, r * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = `${Math.max(16, r)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.emoji, cx, cy);

    // Weight label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`${obj.name} (${obj.mass}kg)`, cx, cy + r + 6);

    // Force arrow
    if (showForceArrows && state.forceActive && state.appliedForce !== 0) {
      const arrowLen = Math.abs(state.appliedForce) * 2.5;
      const dir = Math.sign(state.appliedForce);
      const startX = cx + dir * (r + 5);
      const endX = startX + dir * arrowLen;
      const arrowY = cy;

      // Arrow shaft
      ctx.strokeStyle = dir > 0 ? '#60A5FA' : '#F97316';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, arrowY);
      ctx.lineTo(endX, arrowY);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = dir > 0 ? '#60A5FA' : '#F97316';
      ctx.beginPath();
      ctx.moveTo(endX, arrowY);
      ctx.lineTo(endX - dir * 10, arrowY - 6);
      ctx.lineTo(endX - dir * 10, arrowY + 6);
      ctx.closePath();
      ctx.fill();

      // Force label
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `${Math.abs(state.appliedForce).toFixed(0)}N ${dir > 0 ? '→' : '←'}`,
        (startX + endX) / 2,
        arrowY - 8,
      );
    }

    // Velocity indicator
    if (Math.abs(obj.v) > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        `${Math.abs(obj.v).toFixed(1)} m/s ${obj.v > 0 ? '→' : '←'}`,
        cx,
        cy - r - 6,
      );
    }
  }

  ctx.restore();
}

// =============================================================================
// Main Component
// =============================================================================

export default function PushPullArena({ data, className = '' }: PushPullArenaProps) {
  const {
    title,
    description,
    challenges,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  const resolvedInstanceId = instanceId || 'push-pull-arena-default';

  // ── Evaluation hook ──────────────────────────────────────────────
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<PushPullArenaMetrics>({
    primitiveType: 'push-pull-arena',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ── AI tutoring ──────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    theme: data.theme,
    challengeCount: challenges.length,
  }), [data.theme, challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'push-pull-arena',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'K',
  });

  // ── Challenge progress (shared hooks) ────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
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
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Canvas & physics state ───────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const physicsRef = useRef<PhysicsState>({
    objects: [],
    appliedForce: 0,
    surface: 'wood',
    isRunning: false,
    forceActive: false,
    forceAppliedDuration: 0,
    trailPoints: [],
  });
  const animFrameRef = useRef<number>(0);

  // ── UI state ─────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  const [forceStrength, setForceStrength] = useState(currentChallenge?.pushStrength ?? 5);
  const [forceDirection, setForceDirection] = useState<PushPullDirection>(currentChallenge?.pushDirection ?? 'push');
  const [simRunning, setSimRunning] = useState(false);
  const [simComplete, setSimComplete] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // ── Auto-submit evaluation when all challenges complete ──────────
  const hasAutoSubmitted = useRef(false);
  useEffect(() => {
    if (!allChallengesComplete || hasAutoSubmitted.current) return;
    hasAutoSubmitted.current = true;

    const correctCount = challengeResults.filter(r => r.correct).length;
    const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const overallScore = Math.round((correctCount / Math.max(challengeResults.length, 1)) * 100);

    const metrics: PushPullArenaMetrics = {
      type: 'push-pull-arena',
      evalMode: currentChallenge?.type,
      challengesCompleted: challengeResults.length,
      challengesCorrect: correctCount,
      totalAttempts,
      accuracy: overallScore,
      averageAttemptsPerChallenge: totalAttempts / Math.max(challengeResults.length, 1),
    };

    submitResult(overallScore >= 70, overallScore, metrics);
    setSubmittedResult({ score: overallScore });

    const phaseScoreStr = phaseResults.map(
      p => `${p.label} ${p.score}% (${p.attempts} attempts)`,
    ).join(', ');
    sendText(
      `[ALL_COMPLETE] Student finished all push/pull challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging feedback about forces and motion.`,
      { silent: true },
    );
  }, [allChallengesComplete, challengeResults, currentChallenge, submitResult, phaseResults, sendText]);

  // ── Initialize physics for current challenge ─────────────────────
  const initPhysics = useCallback((challenge: PushPullChallenge) => {
    const objs: PhysicsObject[] = [];
    const isCompare = challenge.type === 'compare';

    // Primary object
    objs.push({
      x: isCompare ? CANVAS_W * 0.3 : CANVAS_W * 0.35,
      v: 0,
      mass: challenge.objectWeight,
      radius: objectRadius(challenge.objectWeight),
      emoji: challenge.objectEmoji,
      name: challenge.objectName,
      color: objectColor(challenge.objectWeight),
    });

    // Second object for compare mode
    if (isCompare && challenge.object2Name && challenge.object2Weight && challenge.object2Emoji) {
      objs.push({
        x: CANVAS_W * 0.7,
        v: 0,
        mass: challenge.object2Weight,
        radius: objectRadius(challenge.object2Weight),
        emoji: challenge.object2Emoji,
        name: challenge.object2Name,
        color: objectColor(challenge.object2Weight),
      });
    }

    physicsRef.current = {
      objects: objs,
      appliedForce: 0,
      surface: challenge.surface,
      isRunning: false,
      forceActive: false,
      forceAppliedDuration: 0,
      trailPoints: [],
    };
  }, []);

  // ── Sync physics to current challenge ────────────────────────────
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) {
      initPhysics(currentChallenge);
      setForceStrength(currentChallenge.pushStrength ?? 5);
      setForceDirection(currentChallenge.pushDirection ?? 'push');
      setSimRunning(false);
      setSimComplete(false);
      setSelectedAnswer(null);
      setFeedback(null);
      setShowingAnswer(false);
      // Redraw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawArena(ctx, physicsRef.current, window.devicePixelRatio || 1, true);
      }
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete, initPhysics]);

  // ── Canvas setup & sizing ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) drawArena(ctx, physicsRef.current, dpr, true);
  }, []);

  // ── Animation loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!simRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    let running = true;
    const loop = () => {
      if (!running) return;
      physicsRef.current = stepPhysics(physicsRef.current, 1 / 60);
      drawArena(ctx, physicsRef.current, dpr, true);

      if (!physicsRef.current.isRunning) {
        setSimRunning(false);
        setSimComplete(true);
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [simRunning]);

  // ── Apply force button handler ───────────────────────────────────
  const handleApplyForce = useCallback(() => {
    if (simRunning) return;
    const dir = forceDirection === 'push' ? 1 : -1;
    const forceN = forceStrength * FORCE_SCALE * dir;

    // Reset objects to starting positions for fresh push
    if (currentChallenge) {
      initPhysics(currentChallenge);
    }

    physicsRef.current.appliedForce = forceN;
    physicsRef.current.forceActive = true;
    physicsRef.current.forceAppliedDuration = 0;
    physicsRef.current.isRunning = true;
    physicsRef.current.trailPoints = [];
    setSimRunning(true);
    setSimComplete(false);
  }, [simRunning, forceStrength, forceDirection, currentChallenge, initPhysics]);

  // ── MC options ───────────────────────────────────────────────────
  const mcOptions = useMemo(() => {
    if (!currentChallenge) return [];
    const correct = currentChallenge.correctAnswer;
    const distractors = [
      currentChallenge.distractor0,
      currentChallenge.distractor1,
      currentChallenge.distractor2,
    ].filter(Boolean) as string[];

    return [correct, ...distractors].sort(() => Math.random() - 0.5);
  }, [currentChallenge]);

  // ── Answer checking ──────────────────────────────────────────────
  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge || !selectedAnswer) return;

    incrementAttempts();
    const isCorrect = selectedAnswer === currentChallenge.correctAnswer;

    if (isCorrect) {
      setFeedback({ correct: true, message: 'Correct! Great observation!' });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly answered "${currentChallenge.correctAnswer}" for "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Congratulate briefly and explain the physics.`,
        { silent: true },
      );
    } else {
      setFeedback({
        correct: false,
        message: currentChallenge.hint ?? 'Not quite — try pushing the object and observe what happens!',
      });

      if (currentAttempts >= 2) {
        recordResult({
          challengeId: currentChallenge.id,
          correct: false,
          attempts: currentAttempts + 1,
        });
        setShowingAnswer(true);
      }

      sendText(
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctAnswer}". Challenge: "${currentChallenge.instruction}". Attempt ${currentAttempts + 1}. Give a hint about forces and motion.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ────────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All done — evaluation auto-submitted via useEffect above
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [advanceProgress, sendText, currentChallengeIndex, challenges.length]);

  // Whether controls are user-adjustable (observe/design = yes, predict/compare = preset)
  const controlsInteractive = currentChallenge?.type === 'observe' || currentChallenge?.type === 'design' || allChallengesComplete;
  const canRunSim = !simRunning && !allChallengesComplete;

  // For predict mode: student answers BEFORE running simulation
  const isPredictMode = currentChallenge?.type === 'predict';
  const needsAnswerFirst = isPredictMode && !simComplete && !feedback?.correct;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">{title}</CardTitle>
            <CardDescription className="text-slate-400">{description}</CardDescription>
          </div>
          {!allChallengesComplete && challenges.length > 0 && (
            <Badge variant="outline" className="border-white/20 text-slate-300">
              {currentChallengeIndex + 1} / {challenges.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary panel when complete */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? 0}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You explored pushes and pulls!"
            className="mb-6"
          />
        )}

        {/* Canvas arena */}
        <div className="rounded-lg overflow-hidden border border-white/10">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
          />
        </div>

        {/* Challenge instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            {currentChallenge.type === 'compare' && currentChallenge.object2Name && (
              <p className="text-slate-400 text-xs mt-1">
                Comparing: {currentChallenge.objectEmoji} {currentChallenge.objectName} ({currentChallenge.objectWeight}kg)
                vs {currentChallenge.object2Emoji} {currentChallenge.object2Name} ({currentChallenge.object2Weight}kg)
                on {SURFACE_COLORS[currentChallenge.surface].label}
              </p>
            )}
            {currentChallenge.type === 'design' && currentChallenge.goalDescription && (
              <p className="text-slate-400 text-xs mt-1">Goal: {currentChallenge.goalDescription}</p>
            )}
          </div>
        )}

        {/* Force controls */}
        {!allChallengesComplete && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Direction toggle */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs ${forceDirection === 'pull' ? 'bg-orange-500/20 border-orange-400/40 text-orange-300' : 'bg-white/5 border border-white/20 text-slate-400'}`}
                onClick={() => controlsInteractive && setForceDirection('pull')}
                disabled={!controlsInteractive}
              >
                ← Pull
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs ${forceDirection === 'push' ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' : 'bg-white/5 border border-white/20 text-slate-400'}`}
                onClick={() => controlsInteractive && setForceDirection('push')}
                disabled={!controlsInteractive}
              >
                Push →
              </Button>
            </div>

            {/* Force slider */}
            <div className="flex-1 min-w-[160px] flex items-center gap-2">
              <span className="text-xs text-slate-400">Force:</span>
              <Slider
                value={[forceStrength]}
                onValueChange={([v]) => controlsInteractive && setForceStrength(v)}
                min={1}
                max={10}
                step={1}
                className="flex-1"
                disabled={!controlsInteractive}
              />
              <span className="text-xs text-slate-300 w-8 text-right">{forceStrength}</span>
            </div>

            {/* Apply force button */}
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleApplyForce}
              disabled={!canRunSim || needsAnswerFirst}
            >
              {simRunning ? 'Simulating...' : needsAnswerFirst ? 'Answer first!' : 'Apply Force'}
            </Button>
          </div>
        )}

        {/* MC answer options */}
        {currentChallenge && !allChallengesComplete && mcOptions.length > 0 && (
          <div className="space-y-2">
            {/* For predict mode, show note */}
            {isPredictMode && !simComplete && (
              <p className="text-xs text-amber-400/70">Make your prediction first, then run the simulation to check!</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mcOptions.map((opt, i) => {
                const isSelected = selectedAnswer === opt;
                const isCorrectAnswer = opt === currentChallenge.correctAnswer;
                const showCorrect = showingAnswer && isCorrectAnswer;

                return (
                  <Button
                    key={`${currentChallenge.id}-${i}`}
                    variant="ghost"
                    className={`text-left text-sm justify-start h-auto py-2 px-3 whitespace-normal ${
                      showCorrect
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                        : isSelected
                          ? 'bg-blue-500/20 border border-blue-400/40 text-blue-300'
                          : 'bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10'
                    }`}
                    onClick={() => !feedback?.correct && !showingAnswer && setSelectedAnswer(opt)}
                    disabled={!!feedback?.correct || showingAnswer}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>

            {/* Check / Next buttons */}
            <div className="flex gap-2">
              {!feedback?.correct && !showingAnswer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleCheckAnswer}
                  disabled={!selectedAnswer}
                >
                  Check Answer
                </Button>
              )}
              {(feedback?.correct || showingAnswer) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-300"
                  onClick={handleNextChallenge}
                >
                  {currentChallengeIndex + 1 >= challenges.length ? 'Finish' : 'Next Challenge'}
                </Button>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                feedback.correct
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-400/20'
              }`}>
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
