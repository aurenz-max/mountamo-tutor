'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { RaceTrackLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// =============================================================================
// Data Interface — Single Source of Truth
// =============================================================================

export type RaceTrackChallengeType = 'observe' | 'predict' | 'measure' | 'calculate' | 'graph';

export interface Racer {
  name: string;
  emoji: string;
  speed: number; // pixels per second (scaled for visual)
  color: string;
}

export interface RaceChallenge {
  id: string;
  type: RaceTrackChallengeType;
  instruction: string;
  racers: Racer[];
  trackLength: number; // grid squares
  timeLimit?: number;  // seconds — used for measure/calculate/graph modes
  question: string;
  correctAnswer: string;
  distractor0: string;
  distractor1: string;
  distractor2?: string;
  hint: string;
}

export interface RaceTrackLabData {
  title: string;
  description: string;
  challenges: RaceChallenge[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

interface RaceTrackLabProps {
  data: RaceTrackLabData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CANVAS_W = 740;
const CANVAS_H = 340;
const TRACK_LEFT = 60;
const TRACK_RIGHT = CANVAS_W - 40;
const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;
const LANE_HEIGHT = 50;
const TRACK_TOP = 50;
const GRID_SQUARE_PX = 40; // pixels per grid square

const RACER_COLORS = ['#60A5FA', '#F97316', '#A78BFA', '#34D399'];

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:   { label: 'Observe',   icon: '👀', accentColor: 'blue' },
  predict:   { label: 'Predict',   icon: '🔮', accentColor: 'purple' },
  measure:   { label: 'Measure',   icon: '📏', accentColor: 'emerald' },
  calculate: { label: 'Calculate', icon: '🧮', accentColor: 'amber' },
  graph:     { label: 'Graph',     icon: '📈', accentColor: 'pink' },
};

// =============================================================================
// Physics / Race State
// =============================================================================

interface RacerState {
  name: string;
  emoji: string;
  speed: number;
  color: string;
  x: number;        // current position in grid squares
  finished: boolean;
  finishTime: number | null;
}

interface RaceState {
  racers: RacerState[];
  trackLength: number;
  timeLimit: number | null;
  elapsed: number;     // seconds elapsed
  isRunning: boolean;
  isFinished: boolean;
  placements: string[]; // racer names in finish order
  snapshots: Array<{ time: number; positions: number[] }>; // for graph mode
}

function initRaceState(challenge: RaceChallenge): RaceState {
  return {
    racers: challenge.racers.map((r, i) => ({
      name: r.name,
      emoji: r.emoji,
      speed: r.speed,
      color: r.color || RACER_COLORS[i % RACER_COLORS.length],
      x: 0,
      finished: false,
      finishTime: null,
    })),
    trackLength: challenge.trackLength,
    timeLimit: challenge.timeLimit ?? null,
    elapsed: 0,
    isRunning: false,
    isFinished: false,
    placements: [],
    snapshots: [{ time: 0, positions: challenge.racers.map(() => 0) }],
  };
}

function stepRace(state: RaceState, dt: number): RaceState {
  if (!state.isRunning || state.isFinished) return state;

  const next: RaceState = {
    ...state,
    racers: state.racers.map(r => ({ ...r })),
    elapsed: state.elapsed + dt,
    placements: [...state.placements],
    snapshots: [...state.snapshots],
  };

  // Update positions
  for (const racer of next.racers) {
    if (racer.finished) continue;
    racer.x += racer.speed * dt;

    // Check finish
    if (racer.x >= next.trackLength) {
      racer.x = next.trackLength;
      racer.finished = true;
      racer.finishTime = next.elapsed;
      next.placements.push(racer.name);
    }
  }

  // Snapshot every 1 second for graph mode
  const prevSnapshotTime = state.snapshots.length > 0
    ? state.snapshots[state.snapshots.length - 1].time
    : -1;
  if (Math.floor(next.elapsed) > Math.floor(prevSnapshotTime)) {
    next.snapshots.push({
      time: Math.floor(next.elapsed),
      positions: next.racers.map(r => Math.min(r.x, next.trackLength)),
    });
  }

  // Check race over
  const allFinished = next.racers.every(r => r.finished);
  const timeUp = next.timeLimit !== null && next.elapsed >= next.timeLimit;

  if (allFinished || timeUp) {
    next.isRunning = false;
    next.isFinished = true;
    // Add any unfinished racers to placements by position
    const unfinished = next.racers
      .filter(r => !r.finished)
      .sort((a, b) => b.x - a.x);
    for (const r of unfinished) {
      if (!next.placements.includes(r.name)) {
        next.placements.push(r.name);
      }
    }
    // Final snapshot
    next.snapshots.push({
      time: next.elapsed,
      positions: next.racers.map(r => Math.min(r.x, next.trackLength)),
    });
  }

  return next;
}

// =============================================================================
// Canvas Drawing
// =============================================================================

function drawTrack(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
  dpr: number,
  showGraph: boolean,
) {
  const w = CANVAS_W;
  const h = CANVAS_H;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#1E293B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  if (showGraph && state.snapshots.length > 1) {
    drawPositionTimeGraph(ctx, state);
  } else {
    drawRaceView(ctx, state);
  }

  ctx.restore();
}

function drawRaceView(ctx: CanvasRenderingContext2D, state: RaceState) {
  const numLanes = state.racers.length;
  const trackBottom = TRACK_TOP + numLanes * LANE_HEIGHT;

  // Grid lines (vertical)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let sq = 0; sq <= state.trackLength; sq++) {
    const xPx = TRACK_LEFT + (sq / state.trackLength) * TRACK_WIDTH;
    ctx.beginPath();
    ctx.moveTo(xPx, TRACK_TOP - 5);
    ctx.lineTo(xPx, trackBottom + 5);
    ctx.stroke();
  }

  // Grid square numbers along top
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let sq = 0; sq <= state.trackLength; sq += Math.max(1, Math.floor(state.trackLength / 10))) {
    const xPx = TRACK_LEFT + (sq / state.trackLength) * TRACK_WIDTH;
    ctx.fillText(`${sq}`, xPx, TRACK_TOP - 8);
  }

  // "Distance" label
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Distance (squares)', TRACK_LEFT + TRACK_WIDTH / 2, TRACK_TOP - 20);

  // Lane backgrounds
  for (let i = 0; i < numLanes; i++) {
    const y = TRACK_TOP + i * LANE_HEIGHT;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(TRACK_LEFT, y, TRACK_WIDTH, LANE_HEIGHT);

    // Lane border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(TRACK_LEFT, y);
    ctx.lineTo(TRACK_RIGHT, y);
    ctx.stroke();
  }
  // Bottom border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(TRACK_LEFT, trackBottom);
  ctx.lineTo(TRACK_RIGHT, trackBottom);
  ctx.stroke();

  // Finish line (checkered)
  const finishX = TRACK_RIGHT - 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(finishX, TRACK_TOP);
  ctx.lineTo(finishX, trackBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FINISH', finishX, trackBottom + 14);

  // Racers
  for (let i = 0; i < state.racers.length; i++) {
    const racer = state.racers[i];
    const laneY = TRACK_TOP + i * LANE_HEIGHT;
    const centerY = laneY + LANE_HEIGHT / 2;
    const xPx = TRACK_LEFT + (racer.x / state.trackLength) * TRACK_WIDTH;

    // Racer name label (left side)
    ctx.fillStyle = racer.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(racer.name, TRACK_LEFT - 6, centerY);

    // Trail line
    ctx.strokeStyle = racer.color + '40';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TRACK_LEFT, centerY);
    ctx.lineTo(xPx, centerY);
    ctx.stroke();

    // Racer circle + emoji
    ctx.fillStyle = racer.color + '30';
    ctx.beginPath();
    ctx.arc(xPx, centerY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = racer.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(racer.emoji, xPx, centerY);

    // Placement badge
    if (racer.finished && racer.finishTime !== null) {
      const placeIdx = state.placements.indexOf(racer.name);
      const placeLabel = placeIdx === 0 ? '🥇' : placeIdx === 1 ? '🥈' : placeIdx === 2 ? '🥉' : `#${placeIdx + 1}`;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(placeLabel, xPx + 20, centerY - 8);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${racer.finishTime.toFixed(1)}s`, xPx + 20, centerY + 8);
    }
  }

  // Timer display
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`⏱ ${state.elapsed.toFixed(1)}s`, CANVAS_W - 10, 8);

  // Time limit indicator
  if (state.timeLimit !== null) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.fillText(`/ ${state.timeLimit}s`, CANVAS_W - 10, 26);
  }

  // Race status
  if (state.isFinished) {
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('RACE COMPLETE', 10, 8);
  } else if (state.isRunning) {
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('RACING...', 10, 8);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Ready', 10, 8);
  }
}

function drawPositionTimeGraph(ctx: CanvasRenderingContext2D, state: RaceState) {
  const graphLeft = 70;
  const graphRight = CANVAS_W - 30;
  const graphTop = 40;
  const graphBottom = CANVAS_H - 40;
  const graphW = graphRight - graphLeft;
  const graphH = graphBottom - graphTop;

  // Title
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Position vs. Time Graph', CANVAS_W / 2, 8);

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(graphLeft, graphTop);
  ctx.lineTo(graphLeft, graphBottom);
  ctx.lineTo(graphRight, graphBottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Time (seconds)', graphLeft + graphW / 2, graphBottom + 12);

  ctx.save();
  ctx.translate(12, graphTop + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Position (squares)', 0, 0);
  ctx.restore();

  const maxTime = state.snapshots[state.snapshots.length - 1]?.time ?? 1;
  const maxPos = state.trackLength;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;

  // Horizontal grid
  for (let p = 0; p <= maxPos; p += Math.max(1, Math.floor(maxPos / 5))) {
    const y = graphBottom - (p / maxPos) * graphH;
    ctx.beginPath();
    ctx.moveTo(graphLeft, y);
    ctx.lineTo(graphRight, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${p}`, graphLeft - 6, y);
  }

  // Vertical grid
  for (let t = 0; t <= maxTime; t += Math.max(1, Math.floor(maxTime / 8))) {
    const x = graphLeft + (t / maxTime) * graphW;
    ctx.beginPath();
    ctx.moveTo(x, graphTop);
    ctx.lineTo(x, graphBottom);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${t}`, x, graphBottom + 2);
  }

  // Plot each racer
  for (let ri = 0; ri < state.racers.length; ri++) {
    const racer = state.racers[ri];
    ctx.strokeStyle = racer.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let started = false;
    for (const snap of state.snapshots) {
      const x = graphLeft + (snap.time / maxTime) * graphW;
      const y = graphBottom - (snap.positions[ri] / maxPos) * graphH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Racer label at end of line
    const lastSnap = state.snapshots[state.snapshots.length - 1];
    if (lastSnap) {
      const endX = graphLeft + (lastSnap.time / maxTime) * graphW;
      const endY = graphBottom - (lastSnap.positions[ri] / maxPos) * graphH;
      ctx.fillStyle = racer.color;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${racer.emoji} ${racer.name}`, endX + 4, endY);
    }
  }
}

// =============================================================================
// Main Component
// =============================================================================

export default function RaceTrackLab({ data, className = '' }: RaceTrackLabProps) {
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

  const resolvedInstanceId = instanceId || 'race-track-lab-default';

  // ── Evaluation hook ──────────────────────────────────────────────
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<RaceTrackLabMetrics>({
    primitiveType: 'race-track-lab',
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
    primitiveType: 'race-track-lab',
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

  // ── Canvas & race state ──────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raceRef = useRef<RaceState>(initRaceState(challenges[0] ?? {
    id: 'fallback', type: 'observe', instruction: '', racers: [], trackLength: 10,
    question: '', correctAnswer: '', distractor0: '', distractor1: '', hint: '',
  }));
  const animFrameRef = useRef<number>(0);

  // ── UI state ─────────────────────────────────────────────────────
  const currentChallenge = challenges[currentChallengeIndex] ?? challenges[0];
  const [raceRunning, setRaceRunning] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
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

    const metrics: RaceTrackLabMetrics = {
      type: 'race-track-lab',
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
      `[ALL_COMPLETE] Student finished all race track challenges! Phase scores: ${phaseScoreStr || `Overall ${overallScore}%`}. Overall: ${overallScore}%. Give encouraging feedback about speed, distance, and time.`,
      { silent: true },
    );
  }, [allChallengesComplete, challengeResults, currentChallenge, submitResult, phaseResults, sendText]);

  // ── Init race for current challenge ──────────────────────────────
  const resetRace = useCallback((challenge: RaceChallenge) => {
    raceRef.current = initRaceState(challenge);
  }, []);

  useEffect(() => {
    if (currentChallenge && !allChallengesComplete) {
      resetRace(currentChallenge);
      setRaceRunning(false);
      setRaceFinished(false);
      setShowGraph(false);
      setSelectedAnswer(null);
      setFeedback(null);
      setShowingAnswer(false);
      // Redraw
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawTrack(ctx, raceRef.current, window.devicePixelRatio || 1, false);
      }
    }
  }, [currentChallengeIndex, currentChallenge, allChallengesComplete, resetRace]);

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
    if (ctx) drawTrack(ctx, raceRef.current, dpr, false);
  }, []);

  // ── Animation loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!raceRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    let running = true;
    const loop = () => {
      if (!running) return;
      raceRef.current = stepRace(raceRef.current, 1 / 60);
      drawTrack(ctx, raceRef.current, dpr, false);

      if (!raceRef.current.isRunning && raceRef.current.isFinished) {
        setRaceRunning(false);
        setRaceFinished(true);
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [raceRunning]);

  // ── Redraw when toggling graph view ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    drawTrack(ctx, raceRef.current, dpr, showGraph);
  }, [showGraph]);

  // ── Start race ───────────────────────────────────────────────────
  const handleStartRace = useCallback(() => {
    if (raceRunning) return;
    if (currentChallenge) {
      resetRace(currentChallenge);
    }
    raceRef.current.isRunning = true;
    setRaceRunning(true);
    setRaceFinished(false);
    setShowGraph(false);
  }, [raceRunning, currentChallenge, resetRace]);

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
      setFeedback({ correct: true, message: 'Correct! Great job!' });
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student correctly answered "${currentChallenge.correctAnswer}" for "${currentChallenge.question}". Attempt ${currentAttempts + 1}. Congratulate briefly and explain the speed/distance concept.`,
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
        `[ANSWER_INCORRECT] Student chose "${selectedAnswer}" but correct is "${currentChallenge.correctAnswer}". Question: "${currentChallenge.question}". Attempt ${currentAttempts + 1}. Give a hint about speed and distance.`,
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

  // For predict mode: answer before race
  const isPredictMode = currentChallenge?.type === 'predict';
  const needsAnswerFirst = isPredictMode && !raceFinished && !feedback?.correct;
  const isGraphMode = currentChallenge?.type === 'graph';

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
            heading="Race Complete!"
            celebrationMessage="You explored speed, distance, and time!"
            className="mb-6"
          />
        )}

        {/* Canvas */}
        <div className="rounded-lg overflow-hidden border border-white/10">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
          />
        </div>

        {/* Race controls */}
        {!allChallengesComplete && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleStartRace}
              disabled={raceRunning || needsAnswerFirst}
            >
              {raceRunning ? '🏁 Racing...' : needsAnswerFirst ? 'Predict first!' : raceFinished ? '🔄 Replay' : '▶ Start Race'}
            </Button>

            {/* Graph toggle for graph mode or after race */}
            {(isGraphMode || raceFinished) && raceRef.current.snapshots.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs ${showGraph ? 'bg-rose-500/20 border-rose-400/40 text-rose-300' : 'bg-white/5 border border-white/20 text-slate-400'}`}
                onClick={() => setShowGraph(!showGraph)}
              >
                {showGraph ? '🏁 Race View' : '📈 Graph View'}
              </Button>
            )}

            {/* Racer speed legend */}
            {currentChallenge && (
              <div className="flex gap-2 ml-auto">
                {currentChallenge.racers.map((r, i) => (
                  <span key={i} className="text-xs text-slate-400">
                    <span style={{ color: r.color || RACER_COLORS[i % RACER_COLORS.length] }}>
                      {r.emoji} {r.name}
                    </span>
                    {' '}({r.speed} sq/s)
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Challenge instruction / question */}
        {currentChallenge && !allChallengesComplete && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
            <p className="text-slate-300 text-sm mt-1">{currentChallenge.question}</p>
            {currentChallenge.timeLimit && (
              <p className="text-slate-400 text-xs mt-1">Time limit: {currentChallenge.timeLimit} seconds</p>
            )}
          </div>
        )}

        {/* MC answer options */}
        {currentChallenge && !allChallengesComplete && mcOptions.length > 0 && (
          <div className="space-y-2">
            {isPredictMode && !raceFinished && (
              <p className="text-xs text-amber-400/70">Make your prediction first, then start the race to check!</p>
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
