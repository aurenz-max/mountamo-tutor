'use client';

/**
 * PushPullArena — DI modality. The Live tutor owns the clock in every mode.
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - observe: taps Go, watches the preset force move the object, and SAYS
 *    whether that was a push or a pull.
 *  - predict: answers "moves, or stays?" BEFORE anything moves; the sim
 *    auto-runs the moment their answer is committed, so the physics reveals
 *    the truth while the tutor judges what they SAID.
 *  - compare: two objects get the same push; the child says WHICH ONE slides
 *    farther (by name); the sim auto-runs at commit, same reveal timing.
 *  - design: full controls (direction, force slider, Go) — the child
 *    experiments freely, then says whether the goal needs a big or little
 *    push.
 *
 * WHAT CHANGED (second non-literacy consumer of useJudgedScriptRunner; also
 * this primitive's Lumina-kit migration — it was raw shadcn). Deleted: the
 * four MC answer chips (they PRINTED the answer — word-flip's chips in a
 * physics costume), the answer-checking and advancing buttons, the
 * show-the-answer reveal after three attempts, and the labeled Push/Pull
 * toggle outside design mode (a child who taps a button labeled "Push" is
 * reading, not observing, when asked "push or pull?"). All answers are now
 * CODE-COMPUTED from the sim's own physics and judged from the child's
 * speech in-band.
 *
 * ANSWER-LEAK RULE. The arena, the arrow, and the motion are the stimulus.
 * The force word / outcome / object name is the answer: nothing prints it,
 * and instructions are code-owned neutral asks (a generated "Push the
 * ball!" names the answer of an observe item).
 *
 * DOCTRINE HELD: open mic, never push-to-talk; direct manipulation first —
 * Go and the design controls are the experiment surface, never the commit;
 * the tutor is quiet by default; no visible timers; no advance affordance.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaChallengeCounter,
  LuminaSlider,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { PushPullArenaMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  itemsFromChallenges,
  pushPullArenaPackBase,
  type ArenaChallengeLike,
  type ArenaItem,
} from './pushPullArenaScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';

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
  /** Code-owned neutral ask (the generator overwrites any LLM instruction
   *  that names the answer). */
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
  // Force settings (preset for observe/predict/compare; starting point for design)
  pushStrength?: number; // 1-10
  pushDirection?: PushPullDirection;
  // Design mode
  goalDescription?: string;
  /** CODE-COMPUTED spoken answer (push/pull, moves/stays, object name,
   *  big/little). Never authored by the LLM. */
  spokenAnswer?: string;
  spokenAlternates?: string[];
  // ── Within-mode support tier scaffolds (display-only) ──
  showForceArrows?: boolean;
  showMotionReadout?: boolean;
}

export interface PushPullArenaData {
  title: string;
  description: string;
  theme: ArenaTheme;
  challenges: PushPullChallenge[];
  supportTier?: 'easy' | 'medium' | 'hard';

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

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  observe: { label: 'Observe', icon: '👀' },
  predict: { label: 'Predict', icon: '🔮' },
  compare: { label: 'Compare', icon: '⚖️' },
  design:  { label: 'Design',  icon: '🎯' },
};

// Force scaling: pushStrength 1-10 maps to Newtons
const FORCE_SCALE = 8; // 1 pushStrength = 8N

// =============================================================================
// Physics Engine (unchanged — the living simulation is the product)
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
// Canvas Drawing (unchanged)
// =============================================================================

function drawArena(
  ctx: CanvasRenderingContext2D,
  state: PhysicsState,
  dpr: number,
  showForceArrows: boolean,
  showMotionReadout: boolean = true,
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

  // Distance markers (motion self-check aid — withdrawn at the hard tier)
  if (showMotionReadout) {
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

    // Velocity indicator (motion self-check aid — withdrawn at the hard tier)
    if (showMotionReadout && Math.abs(obj.v) > 1) {
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

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } =
    usePrimitiveEvaluation<PushPullArenaMetrics>({
      primitiveType: 'push-pull-arena',
      instanceId: resolvedInstanceId,
      skillId,
      subskillId,
      objectiveId,
      exhibitId,
    });

  // ── The pack ─────────────────────────────────────────────────────
  // ONE builder, shared with the headless DI harness — and it now GATES: a
  // challenge whose answer is not decisive (a predict sitting on the friction
  // boundary, a compare whose two objects weigh the same, a design inside
  // `designPushSize`'s murky band) is dropped rather than asked.
  const items = useMemo<ArenaItem[]>(
    () => itemsFromChallenges(challenges as ArenaChallengeLike[]),
    [challenges],
  );

  /**
   * Items can now DROP, so nothing may bind a challenge by position again:
   * `challenges[runner.currentIndex]` counts challenges while the runner's index
   * counts items, and one dropped item slides the arena one object out of step
   * with the ask for the rest of the run. Bind by id.
   */
  const challengeById = useMemo(() => {
    const map = new Map<string, PushPullChallenge>();
    for (const ch of challenges) map.set(ch.id, ch);
    return map;
  }, [challenges]);

  const pack = useMemo<JudgedScriptPack<ArenaItem>>(() => ({
    ...pushPullArenaPackBase(items),
    // Only what DIFFERS from the runner's defaults — and what only a mounted
    // component can own.
    statusLines: {
      ready: (item) => item.kind === 'observe'
        ? 'Tap Go, watch, then say what you saw.'
        : item.kind === 'design'
          ? 'Experiment, then say your answer.'
          : 'Think, then say your answer.',
      retry: () => 'Have another go — say your answer.',
      affirmedNext: 'Yes! You said what the physics did.',
      done: 'Great force science today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: `${PHASE_TYPE_CONFIG[item.kind]?.label ?? item.kind}: ${item.objectName} on ${item.surfaceSpoken}.`,
      expected: item.spokenAnswer,
      observed: lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: PushPullArenaMetrics = {
      type: 'push-pull-arena',
      // The mode actually ASKED — a dropped first challenge would otherwise
      // stamp the evaluation with a mode this run never ran.
      evalMode: items[0]?.kind,
      challengesCompleted: summary.outcomes.length,
      challengesCorrect: summary.solvedCount,
      totalAttempts: summary.attemptsCount,
      accuracy: summary.accuracy,
      averageAttemptsPerChallenge:
        summary.attemptsCount / Math.max(summary.outcomes.length, 1),
    };
    submitResult(summary.accuracy >= 70, summary.accuracy, metrics);
  }, [items, submitResult]);

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
  const [simRunning, setSimRunning] = useState(false);
  const [forceStrength, setForceStrength] = useState(5);
  const [forceDirection, setForceDirection] = useState<PushPullDirection>('push');
  /** The reveal ran for this item (predict/compare auto-run at commit). */
  const revealRanRef = useRef(false);

  const initPhysics = useCallback((challenge: PushPullChallenge) => {
    const objs: PhysicsObject[] = [];
    const isCompare = challenge.type === 'compare';

    objs.push({
      x: isCompare ? CANVAS_W * 0.3 : CANVAS_W * 0.35,
      v: 0,
      mass: challenge.objectWeight,
      radius: objectRadius(challenge.objectWeight),
      emoji: challenge.objectEmoji,
      name: challenge.objectName,
      color: objectColor(challenge.objectWeight),
    });

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

  // ── The runner ───────────────────────────────────────────────────
  const runner = useJudgedScriptRunner<ArenaItem>({
    pack,
    instanceId: resolvedInstanceId,
    // The arena has no band field; K matches the old hardcode and the K-2
    // demand this port serves.
    gradeLevel: 'Kindergarten',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: (item) => {
      const challenge = challengeById.get(item.id);
      if (!challenge) return;
      revealRanRef.current = false;
      initPhysics(challenge);
      setForceStrength(challenge.pushStrength ?? 5);
      setForceDirection(challenge.pushDirection ?? 'push');
      setSimRunning(false);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        drawArena(ctx, physicsRef.current, window.devicePixelRatio || 1,
          challenge.showForceArrows ?? true, challenge.showMotionReadout ?? true);
      }
    },
    onEmission: (emission, item) => {
      // predict/compare: the sim IS the reveal, and it runs the moment the
      // child's answer is committed — the truth plays out on screen while
      // the tutor judges what they SAID, not what they saw.
      if (emission.kind !== 'attempt-open' || !item) return;
      if ((item.kind === 'predict' || item.kind === 'compare') && !revealRanRef.current) {
        revealRanRef.current = true;
        runPresetForce();
      }
    },
  });

  const currentChallenge = runner.currentItem
    ? challengeById.get(runner.currentItem.id) ?? null
    : null;
  const currentKind = runner.currentItem?.kind;
  const showForceArrows = currentChallenge?.showForceArrows ?? true;
  const showMotionReadout = currentChallenge?.showMotionReadout ?? true;

  // ── Sim runs — the experiment surface, never the commit ──────────
  const applyForce = useCallback((strength: number, direction: PushPullDirection) => {
    if (!currentChallenge) return;
    SoundManager.tap();
    initPhysics(currentChallenge);
    const dir = direction === 'push' ? 1 : -1;
    physicsRef.current.appliedForce = strength * FORCE_SCALE * dir;
    physicsRef.current.forceActive = true;
    physicsRef.current.forceAppliedDuration = 0;
    physicsRef.current.isRunning = true;
    physicsRef.current.trailPoints = [];
    setSimRunning(true);
  }, [currentChallenge, initPhysics]);

  /** Run the item's PRESET force (observe's Go, predict/compare's reveal). */
  const runPresetForce = useCallback(() => {
    if (!currentChallenge) return;
    applyForce(currentChallenge.pushStrength ?? 5, currentChallenge.pushDirection ?? 'push');
  }, [applyForce, currentChallenge]);
  const runPresetForceRef = useRef(runPresetForce);
  runPresetForceRef.current = runPresetForce;

  // ── Canvas setup & animation loop (unchanged) ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const first = items[0] ? challengeById.get(items[0].id) : undefined;
    if (first) initPhysics(first);
    const ctx = canvas.getContext('2d');
    if (ctx) drawArena(ctx, physicsRef.current, dpr, showForceArrows, showMotionReadout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      drawArena(ctx, physicsRef.current, dpr, showForceArrows, showMotionReadout);

      if (!physicsRef.current.isRunning) {
        setSimRunning(false);
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [simRunning, showForceArrows, showMotionReadout]);

  // ── Phase summary ────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!hasSubmitted) return [];
    // Over ITEMS, not challenges: a challenge the build gate dropped was never
    // asked, so a summary row for it would report a 0 against a child who was
    // never shown it.
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const config = PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🧲' };
      return { label: `${config.label} — ${item.objectName}`, icon: config.icon };
    });
  }, [hasSubmitted, runner.summary, items]);

  // =============================================================================
  // Render
  // =============================================================================

  // design = the child's own experiment; observe = tap Go to run the preset.
  const showDesignControls = currentKind === 'design';
  const showGoButton = currentKind === 'observe' || currentKind === 'design';
  const stageWord = runner.stage === 'affirmed'
    ? 'yes!'
    : runner.stage === 'asking'
      ? (currentKind === 'observe' ? 'push, or pull?' : 'what do you say?')
      : 'get ready';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <p className="text-slate-400 text-sm">{description}</p>
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!hasSubmitted && (
          <>
            {items.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            {/* Canvas arena — the stimulus and the experiment */}
            <div className="rounded-lg overflow-hidden border border-white/10">
              <canvas
                ref={canvasRef}
                className="w-full"
                style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
              />
            </div>

            {/* Code-owned neutral instruction */}
            {currentChallenge?.instruction && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
                {currentKind === 'design' && currentChallenge.goalDescription && (
                  <p className="text-slate-400 text-xs mt-1">Goal: {currentChallenge.goalDescription}</p>
                )}
              </div>
            )}

            {/* Experiment controls. design: full controls (the manipulative).
                observe: one Go that fires the ITEM's preset force — a labeled
                Push/Pull toggle would print the answer. predict/compare: no
                controls; the sim auto-runs when the answer is committed. */}
            {(showDesignControls || showGoButton) && (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {showDesignControls && (
                  <>
                    <div className="flex gap-1">
                      <LuminaButton
                        tone={forceDirection === 'pull' ? 'primary' : 'subtle'}
                        className="text-xs"
                        onClick={() => { SoundManager.select(); setForceDirection('pull'); }}
                      >
                        ← Pull
                      </LuminaButton>
                      <LuminaButton
                        tone={forceDirection === 'push' ? 'primary' : 'subtle'}
                        className="text-xs"
                        onClick={() => { SoundManager.select(); setForceDirection('push'); }}
                      >
                        Push →
                      </LuminaButton>
                    </div>
                    <div className="flex-1 min-w-[160px] flex items-center gap-2">
                      <span className="text-xs text-slate-400">Force:</span>
                      <LuminaSlider
                        value={[forceStrength]}
                        onValueChange={([v]) => setForceStrength(v)}
                        min={1}
                        max={10}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-xs text-slate-300 w-8 text-right">{forceStrength}</span>
                    </div>
                  </>
                )}
                <LuminaButton
                  tone="primary"
                  className="text-sm"
                  onClick={() => showDesignControls
                    ? applyForce(forceStrength, forceDirection)
                    : runPresetForce()}
                  disabled={simRunning}
                >
                  {simRunning ? 'Moving…' : 'Go!'}
                </LuminaButton>
              </div>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {/* Every item here is answered out loud — the sim is the stage,
                the answer is the child saying what the forces did. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Challenge Complete!"
            celebrationMessage="You explored pushes and pulls out loud!"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}
