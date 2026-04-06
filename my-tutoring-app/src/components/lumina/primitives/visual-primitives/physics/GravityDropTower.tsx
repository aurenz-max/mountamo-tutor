'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { GravityDropTowerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type DropChallengeType = 'observe' | 'predict' | 'compare' | 'measure' | 'calculate';

export interface DropObject {
  name: string;
  emoji: string;
  mass: number;       // kg
  dragCoeff: number;  // 0 = no drag, higher = more air resistance
}

export interface DropChallenge {
  id: string;
  type: DropChallengeType;
  instruction: string;
  objects: DropObject[];
  height: number;        // meters (drop height)
  airResistance: boolean;
  question: string;
  correctAnswer: string;
  distractor0: string;
  distractor1: string;
  distractor2?: string;
  hint: string;
}

export interface GravityDropTowerData {
  title: string;
  description: string;
  challenges: DropChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

interface GravityDropTowerProps {
  data: GravityDropTowerData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CANVAS_W = 700;
const CANVAS_H = 420;
const TOWER_TOP = 40;
const GROUND_Y = CANVAS_H - 50;
const DROP_ZONE_HEIGHT = GROUND_Y - TOWER_TOP;
const G = 9.8; // m/s² (real gravity)
const TIME_SCALE = 0.7; // slow down for visual clarity
const AIR_DENSITY = 1.2; // kg/m³

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:   { label: 'Observe',   icon: '👀', accentColor: 'blue' },
  predict:   { label: 'Predict',   icon: '🔮', accentColor: 'purple' },
  compare:   { label: 'Compare',   icon: '⚖️', accentColor: 'emerald' },
  measure:   { label: 'Measure',   icon: '📏', accentColor: 'amber' },
  calculate: { label: 'Calculate', icon: '🧮', accentColor: 'pink' },
};

// Object visual sizing by mass
function objectRadius(mass: number): number {
  return 14 + Math.min(mass, 20) * 1.5;
}

function objectColor(mass: number): string {
  const hue = Math.max(0, 220 - mass * 12);
  return `hsl(${hue}, 60%, 55%)`;
}

// =============================================================================
// Physics Engine
// =============================================================================

interface FallingObject {
  name: string;
  emoji: string;
  mass: number;
  dragCoeff: number;
  y: number;        // current position (pixels from TOWER_TOP)
  vy: number;       // velocity (pixels/frame)
  landed: boolean;
  landTime: number; // time when landed (seconds)
  splatFrame: number; // for splat animation
  crossSection: number; // derived from mass for drag
}

interface DropState {
  objects: FallingObject[];
  isRunning: boolean;
  elapsed: number; // seconds
  airResistance: boolean;
  heightMeters: number;
  pixelsPerMeter: number;
  slowMo: boolean;
}

function createDropState(challenge: DropChallenge, slowMo: boolean): DropState {
  const pixelsPerMeter = DROP_ZONE_HEIGHT / challenge.height;
  const spacing = CANVAS_W / (challenge.objects.length + 1);

  return {
    objects: challenge.objects.map((obj, i) => ({
      name: obj.name,
      emoji: obj.emoji,
      mass: obj.mass,
      dragCoeff: obj.dragCoeff,
      y: 0,
      vy: 0,
      landed: false,
      landTime: 0,
      splatFrame: 0,
      crossSection: 0.01 + obj.dragCoeff * 0.05, // m² effective cross-section
      x: spacing * (i + 1), // store x position
    })) as (FallingObject & { x: number })[],
    isRunning: false,
    elapsed: 0,
    airResistance: challenge.airResistance,
    heightMeters: challenge.height,
    pixelsPerMeter,
    slowMo,
  };
}

function stepDrop(state: DropState, dt: number): DropState {
  const timeStep = state.slowMo ? dt * 0.3 : dt * TIME_SCALE;
  const next: DropState = {
    ...state,
    objects: state.objects.map(o => ({ ...o })),
    elapsed: state.elapsed + timeStep,
  };

  let allLanded = true;

  for (const obj of next.objects) {
    if (obj.landed) {
      obj.splatFrame = Math.min(obj.splatFrame + 1, 20);
      continue;
    }

    allLanded = false;

    // Gravity force (in m/s²)
    let accel = G;

    // Air resistance: F_drag = 0.5 * rho * Cd * A * v²
    if (state.airResistance && obj.dragCoeff > 0) {
      const vyMeters = obj.vy / state.pixelsPerMeter;
      const dragForce = 0.5 * AIR_DENSITY * obj.dragCoeff * obj.crossSection * vyMeters * vyMeters;
      const dragAccel = dragForce / obj.mass;
      accel = Math.max(0.1, accel - dragAccel);
    }

    // Convert accel to pixels
    const accelPx = accel * state.pixelsPerMeter;
    obj.vy += accelPx * timeStep;
    obj.y += obj.vy * timeStep;

    // Check landing
    if (obj.y >= DROP_ZONE_HEIGHT) {
      obj.y = DROP_ZONE_HEIGHT;
      obj.vy = 0;
      obj.landed = true;
      obj.landTime = next.elapsed;
      obj.splatFrame = 1;
    }
  }

  if (allLanded) {
    next.isRunning = false;
  }

  return next;
}

// =============================================================================
// Canvas Drawing
// =============================================================================

function drawDropTower(
  ctx: CanvasRenderingContext2D,
  state: DropState,
  dpr: number,
) {
  const w = CANVAS_W;
  const h = CANVAS_H;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#0B1426');
  skyGrad.addColorStop(0.5, '#0F172A');
  skyGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, GROUND_Y);

  // Ground
  ctx.fillStyle = '#78716C';
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(w, GROUND_Y);
  ctx.stroke();

  // Height markers on left side
  const numMarkers = Math.min(10, Math.ceil(state.heightMeters));
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i <= numMarkers; i++) {
    const fraction = i / numMarkers;
    const y = TOWER_TOP + fraction * DROP_ZONE_HEIGHT;
    const heightLabel = (state.heightMeters * (1 - fraction)).toFixed(1);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`${heightLabel}m`, 4, y + 4);
  }

  // Tower frame (subtle vertical lines)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, TOWER_TOP);
  ctx.lineTo(35, GROUND_Y);
  ctx.stroke();

  // Drop platform at top
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(30, TOWER_TOP - 4, w - 40, 4);

  // Air resistance indicator
  if (state.airResistance) {
    // Draw subtle air current lines
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 100;
      const offset = (state.elapsed * 20 + i * 30) % 60;
      ctx.beginPath();
      ctx.moveTo(x, TOWER_TOP + offset);
      ctx.quadraticCurveTo(x + 15, TOWER_TOP + offset + 30, x, TOWER_TOP + offset + 60);
      ctx.stroke();
    }
  }

  // Objects
  const spacing = w / (state.objects.length + 1);
  for (let i = 0; i < state.objects.length; i++) {
    const obj = state.objects[i];
    const cx = (obj as unknown as { x?: number }).x ?? spacing * (i + 1);
    const cy = TOWER_TOP + obj.y;
    const r = objectRadius(obj.mass);

    // Shadow on ground
    if (!obj.landed) {
      const shadowSize = Math.max(4, r * 0.6 * (1 - (DROP_ZONE_HEIGHT - obj.y) / DROP_ZONE_HEIGHT));
      ctx.fillStyle = `rgba(0,0,0,${0.1 + 0.2 * (obj.y / DROP_ZONE_HEIGHT)})`;
      ctx.beginPath();
      ctx.ellipse(cx, GROUND_Y + 3, shadowSize, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Splat effect
    if (obj.landed && obj.splatFrame > 0 && obj.splatFrame < 15) {
      const splatR = r + obj.splatFrame * 2;
      const alpha = Math.max(0, 0.4 - obj.splatFrame * 0.03);
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, GROUND_Y - 2, splatR, splatR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Squash on landing
    let scaleX = 1;
    let scaleY = 1;
    if (obj.landed && obj.splatFrame < 10) {
      scaleX = 1 + obj.splatFrame * 0.03;
      scaleY = 1 - obj.splatFrame * 0.02;
    }

    // Object body
    const bodyY = obj.landed ? GROUND_Y - r * scaleY : cy;
    ctx.fillStyle = objectColor(obj.mass);
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, r * scaleX, r * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, bodyY - r * 0.2, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = `${Math.max(14, r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.emoji, cx, bodyY);

    // Label below ground
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`${obj.name}`, cx, GROUND_Y + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${obj.mass}kg`, cx, GROUND_Y + 20);

    // Speed indicator while falling
    if (!obj.landed && obj.vy > 0) {
      const speedMs = obj.vy / state.pixelsPerMeter;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      ctx.fillText(`${speedMs.toFixed(1)} m/s`, cx, cy - r - 4);

      // Motion lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let l = 1; l <= 3; l++) {
        const ly = cy - r - 8 - l * 8;
        if (ly > TOWER_TOP) {
          ctx.beginPath();
          ctx.moveTo(cx - 6, ly);
          ctx.lineTo(cx + 6, ly);
          ctx.stroke();
        }
      }
    }

    // Land time display
    if (obj.landed) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      ctx.fillText(`${obj.landTime.toFixed(2)}s`, cx, TOWER_TOP - 8);
    }
  }

  // Timer
  if (state.isRunning || state.elapsed > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`t = ${state.elapsed.toFixed(2)}s`, w - 10, 8);
  }

  // Slow-mo indicator
  if (state.slowMo && state.isRunning) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('⏱ SLOW-MO', w - 10, 24);
  }

  ctx.restore();
}

// =============================================================================
// Main Component
// =============================================================================

export default function GravityDropTower({ data, className = '' }: GravityDropTowerProps) {
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

  const resolvedInstanceId = instanceId || 'gravity-drop-tower-default';

  // ── Evaluation hook ──────────────────────────────────────────────
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<GravityDropTowerMetrics>({
    primitiveType: 'gravity-drop-tower',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ── AI tutoring ──────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    challengeCount: challenges.length,
  }), [challenges.length]);

  const { sendText } = useLuminaAI({
    primitiveType: 'gravity-drop-tower',
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
  const dropStateRef = useRef<DropState>(createDropState(challenges[0], false));
  const animFrameRef = useRef<number>(0);

  // ── UI state ─────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  const [simRunning, setSimRunning] = useState(false);
  const [simComplete, setSimComplete] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // ── Initialize drop state for current challenge ──────────────────
  const initDrop = useCallback((challenge: DropChallenge) => {
    dropStateRef.current = createDropState(challenge, slowMo);
  }, [slowMo]);

  // ── Sync to current challenge ────────────────────────────────────
  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) {
      initDrop(currentChallenge);
      setSimRunning(false);
      setSimComplete(false);
      setSelectedAnswer(null);
      setFeedback(null);
      setShowingAnswer(false);
      // Redraw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawDropTower(ctx, dropStateRef.current, window.devicePixelRatio || 1);
      }
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete, initDrop]);

  // ── Canvas setup ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) drawDropTower(ctx, dropStateRef.current, dpr);
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
      dropStateRef.current = stepDrop(dropStateRef.current, 1 / 60);
      drawDropTower(ctx, dropStateRef.current, dpr);

      if (!dropStateRef.current.isRunning) {
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

  // ── Drop button handler ──────────────────────────────────────────
  const handleDrop = useCallback(() => {
    if (simRunning) return;
    initDrop(currentChallenge);
    dropStateRef.current.isRunning = true;
    dropStateRef.current.slowMo = slowMo;
    setSimRunning(true);
    setSimComplete(false);
  }, [simRunning, currentChallenge, initDrop, slowMo]);

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
      setFeedback({ correct: true, message: 'Correct! Great thinking!' });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly answered "${currentChallenge.correctAnswer}" for "${currentChallenge.question}". Attempt ${currentAttempts + 1}. Congratulate and explain the gravity concept.`,
        { silent: true },
      );
    } else {
      setFeedback({
        correct: false,
        message: currentChallenge.hint,
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
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctAnswer}". Question: "${currentChallenge.question}". Attempt ${currentAttempts + 1}. Give a hint about gravity.`,
        { silent: true },
      );
    }
  }, [currentChallenge, selectedAnswer, currentAttempts, incrementAttempts, recordResult, sendText]);

  // ── Advance to next challenge ────────────────────────────────────
  const handleNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      const correctCount = challengeResults.filter(r => r.correct).length;
      const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
      const overallScore = Math.round((correctCount / Math.max(challengeResults.length, 1)) * 100);

      const metrics: GravityDropTowerMetrics = {
        type: 'gravity-drop-tower',
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
        `[ALL_COMPLETE] Student finished all gravity drop challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging feedback about gravity.`,
        { silent: true },
      );
      return;
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [
    advanceProgress, challengeResults, currentChallenge,
    submitResult, phaseResults, sendText, currentChallengeIndex, challenges.length,
  ]);

  // For predict mode: answer BEFORE dropping
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
            celebrationMessage="You explored gravity and falling objects!"
            className="mb-6"
          />
        )}

        {/* Canvas drop tower */}
        <div className="rounded-lg overflow-hidden border border-white/10">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
          />
        </div>

        {/* Challenge instruction & question */}
        {currentChallenge && !allChallengesComplete && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            <p className="text-slate-300 text-sm mt-1">{currentChallenge.question}</p>
            {currentChallenge.objects.length > 1 && (
              <p className="text-slate-400 text-xs mt-1">
                Dropping: {currentChallenge.objects.map(o => `${o.emoji} ${o.name} (${o.mass}kg)`).join(' vs ')}
                {' '}from {currentChallenge.height}m
                {currentChallenge.airResistance ? ' (with air resistance)' : ''}
              </p>
            )}
            {currentChallenge.objects.length === 1 && (
              <p className="text-slate-400 text-xs mt-1">
                {currentChallenge.objects[0].emoji} {currentChallenge.objects[0].name} ({currentChallenge.objects[0].mass}kg)
                — Drop height: {currentChallenge.height}m
                {currentChallenge.airResistance ? ' (with air resistance)' : ''}
              </p>
            )}
          </div>
        )}

        {/* Controls row */}
        {!allChallengesComplete && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Slow-mo toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={slowMo}
                onCheckedChange={setSlowMo}
                disabled={simRunning}
              />
              <span className="text-xs text-slate-400">Slow-mo</span>
            </div>

            {/* Air resistance indicator */}
            {currentChallenge?.airResistance && (
              <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-xs">
                Air Resistance ON
              </Badge>
            )}

            {/* Drop button */}
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleDrop}
              disabled={simRunning || allChallengesComplete || needsAnswerFirst}
            >
              {simRunning ? 'Dropping...' : needsAnswerFirst ? 'Predict first!' : simComplete ? 'Drop Again' : 'Drop!'}
            </Button>
          </div>
        )}

        {/* MC answer options */}
        {currentChallenge && !allChallengesComplete && mcOptions.length > 0 && (
          <div className="space-y-2">
            {isPredictMode && !simComplete && (
              <p className="text-xs text-amber-400/70">Make your prediction first, then drop to check!</p>
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
