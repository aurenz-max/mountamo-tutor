'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { GasLawsSimulatorMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type GasLawsChallengeType = 'observe' | 'predict' | 'calculate';
export type GasVariable = 'P' | 'V' | 'T' | 'n';
export type DirectionAnswer = 'increase' | 'decrease' | 'unchanged';

export interface GasLawsChange {
  variable: GasVariable;
  newValue: number;
}

export interface GasLawsChallenge {
  id: string;
  type: GasLawsChallengeType;
  instruction: string;
  hint: string;
  narration: string;
  askFor: string;

  /** The perturbation applied in this challenge scenario. */
  change: GasLawsChange;

  /** Which variable the student must reason about (usually different from change.variable). */
  askedVariable: GasVariable;

  /** For observe: direction of change of askedVariable. Null for predict/calculate. */
  directionAnswer: DirectionAnswer | null;

  /** For predict/calculate: numeric target value of askedVariable. Ignored for observe. */
  targetAnswer: number;

  /** For predict/calculate: +/- tolerance on targetAnswer. */
  tolerance: number;
}

export type GasLawFocus =
  | 'boyle'
  | 'charles'
  | 'gay_lussac'
  | 'combined'
  | 'ideal'
  | 'kmt_only';

export interface GasLawsScenario {
  lawFocus: GasLawFocus;
  /** Initial pressure in atm. */
  initialP: number;
  /** Initial volume in L. */
  initialV: number;
  /** Initial temperature in Kelvin. */
  initialT: number;
  /** Initial amount in mol. */
  initialN: number;
  /** Variables that are held constant for this scenario (student cannot drag these). */
  lockedVariables: GasVariable[];
}

export interface GasLawsShowOptions {
  showPVPlot: boolean;
  showVTPlot: boolean;
  showPTPlot: boolean;
  showCollisionMarkers: boolean;
  showTemperatureColor: boolean;
}

export interface GasLawsSimulatorData {
  title: string;
  description?: string;
  scenario: GasLawsScenario;
  challenges: GasLawsChallenge[];
  showOptions?: Partial<GasLawsShowOptions>;
  gradeBand?: '8' | '9-10' | '11-12';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GasLawsSimulatorMetrics>) => void;
}

// ============================================================================
// Physics + Phase config
// ============================================================================

// Ideal gas constant: L·atm / (mol·K)
const R_IDEAL = 0.0821;

// Simulation sizing (in canvas pixels)
const SIM_W = 220;
const SIM_H = 300;

// Allowed sim ranges — keep generous so initial + perturbed states both fit
const P_MIN = 0.2;
const P_MAX = 10;
const V_MIN = 0.5;
const V_MAX = 20;
const T_MIN = 100;
const T_MAX = 1500;
const N_MIN = 0.1;
const N_MAX = 5;

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  observe:   { label: 'Observe',   icon: '👁️', accentColor: 'blue' },
  predict:   { label: 'Predict',   icon: '🔮', accentColor: 'amber' },
  calculate: { label: 'Calculate', icon: '🧮', accentColor: 'emerald' },
};

const VARIABLE_LABEL: Record<GasVariable, string> = {
  P: 'Pressure',
  V: 'Volume',
  T: 'Temperature',
  n: 'Amount',
};

const VARIABLE_UNIT: Record<GasVariable, string> = {
  P: 'atm',
  V: 'L',
  T: 'K',
  n: 'mol',
};

const DIRECTION_LABEL: Record<DirectionAnswer, string> = {
  increase: 'Increases ↑',
  decrease: 'Decreases ↓',
  unchanged: 'Stays the same =',
};

// ============================================================================
// Helpers
// ============================================================================

function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(digits);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function rangeFor(variable: GasVariable): [number, number] {
  if (variable === 'P') return [P_MIN, P_MAX];
  if (variable === 'V') return [V_MIN, V_MAX];
  if (variable === 'T') return [T_MIN, T_MAX];
  return [N_MIN, N_MAX];
}

/**
 * Compute the state after a perturbation using PV=nRT. When a variable is
 * perturbed, the law-focus determines which companion variable shifts to
 * satisfy the equation. The scenario's lockedVariables + lawFocus together
 * define this. We keep it simple: one variable is the "driver" (change.variable),
 * locked vars stay fixed, and the one remaining variable moves to satisfy PV=nRT.
 */
function applyChange(
  scenario: GasLawsScenario,
  startState: { P: number; V: number; T: number; n: number },
  change: GasLawsChange,
): { P: number; V: number; T: number; n: number } {
  const next = { ...startState };
  const [lo, hi] = rangeFor(change.variable);
  next[change.variable] = clamp(change.newValue, lo, hi);

  // Variables other than the driver and the locked set "solve" for PV=nRT.
  const locked = new Set<GasVariable>(scenario.lockedVariables);
  locked.add(change.variable);

  const solveFor: GasVariable[] = (['P', 'V', 'T', 'n'] as GasVariable[]).filter(v => !locked.has(v));

  if (solveFor.length === 1) {
    const v = solveFor[0];
    if (v === 'P') next.P = (next.n * R_IDEAL * next.T) / Math.max(next.V, 0.001);
    else if (v === 'V') next.V = (next.n * R_IDEAL * next.T) / Math.max(next.P, 0.001);
    else if (v === 'T') next.T = (next.P * next.V) / Math.max(next.n * R_IDEAL, 0.001);
    else if (v === 'n') next.n = (next.P * next.V) / Math.max(R_IDEAL * next.T, 0.001);
  } else if (solveFor.length >= 2) {
    // Under-constrained: prefer to move P when possible, otherwise V.
    // (Combined/ideal scenarios usually lock 1 variable so one remains to solve.)
    const preferred: GasVariable | undefined = solveFor.includes('P') ? 'P' : solveFor[0];
    if (preferred === 'P') next.P = (next.n * R_IDEAL * next.T) / Math.max(next.V, 0.001);
    else if (preferred === 'V') next.V = (next.n * R_IDEAL * next.T) / Math.max(next.P, 0.001);
    else if (preferred === 'T') next.T = (next.P * next.V) / Math.max(next.n * R_IDEAL, 0.001);
    else if (preferred === 'n') next.n = (next.P * next.V) / Math.max(R_IDEAL * next.T, 0.001);
  }

  // Clamp final values into sim ranges for visualization
  next.P = clamp(next.P, P_MIN, P_MAX);
  next.V = clamp(next.V, V_MIN, V_MAX);
  next.T = clamp(next.T, T_MIN, T_MAX);
  next.n = clamp(next.n, N_MIN, N_MAX);
  return next;
}

function tempToColor(T: number): string {
  // Map T [100, 1500] → hue (cool blue → hot red)
  const t = clamp((T - T_MIN) / (T_MAX - T_MIN), 0, 1);
  const hue = (1 - t) * 220 + t * 10;
  const sat = 75;
  const light = 55 + (1 - t) * 5;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// ============================================================================
// Particle Simulation (canvas-driven)
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const ParticleCylinder: React.FC<{
  P: number;
  V: number;
  T: number;
  n: number;
  showCollisionMarkers: boolean;
  showTemperatureColor: boolean;
  onPistonDrag?: (volumeL: number) => void;
  pistonDraggable: boolean;
}> = ({ P, V, T, n, showCollisionMarkers, showTemperatureColor, onPistonDrag, pistonDraggable }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const collisionFlashRef = useRef<number>(0);
  const draggingRef = useRef<boolean>(false);

  // Map volume to piston y position (top-of-gas region). Larger V = piston higher up (smaller pistonY).
  const pistonY = useMemo(() => {
    const frac = (V - V_MIN) / (V_MAX - V_MIN);
    // Invert: large volume → piston near the top (small y)
    return SIM_H - frac * (SIM_H - 30) - 10;
  }, [V]);

  // Base speed from temperature. KMT: KE ∝ T, so |v| ∝ √T.
  const baseSpeed = useMemo(() => {
    const ref = 300; // reference temperature
    return 0.8 + 2.0 * Math.sqrt(Math.max(T / ref, 0.1));
  }, [T]);

  // Particle count proportional to n, capped for visual clarity
  const particleCount = useMemo(() => {
    const cnt = Math.round(12 + (n / N_MAX) * 80);
    return clamp(cnt, 8, 120);
  }, [n]);

  // Initialize particles when count changes substantially
  useEffect(() => {
    const current = particlesRef.current;
    if (current.length === particleCount) return;

    if (current.length < particleCount) {
      // Add particles
      const additions: Particle[] = [];
      for (let i = current.length; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        additions.push({
          x: 20 + Math.random() * (SIM_W - 40),
          y: Math.max(pistonY + 10, 20) + Math.random() * Math.max(SIM_H - pistonY - 30, 20),
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
        });
      }
      particlesRef.current = [...current, ...additions];
    } else {
      // Remove excess
      particlesRef.current = current.slice(0, particleCount);
    }
  }, [particleCount, baseSpeed, pistonY]);

  // Rescale velocities when temperature changes (preserving direction)
  const prevSpeedRef = useRef(baseSpeed);
  useEffect(() => {
    const prev = prevSpeedRef.current;
    if (prev === 0 || prev === baseSpeed) {
      prevSpeedRef.current = baseSpeed;
      return;
    }
    const ratio = baseSpeed / prev;
    particlesRef.current = particlesRef.current.map(p => ({
      ...p,
      vx: p.vx * ratio,
      vy: p.vy * ratio,
    }));
    prevSpeedRef.current = baseSpeed;
  }, [baseSpeed]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particleRadius = 5;
    const particleColor = showTemperatureColor ? tempToColor(T) : '#60a5fa';

    const draw = () => {
      ctx.clearRect(0, 0, SIM_W, SIM_H);

      // Cylinder walls
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(10, SIM_H - 10);
      ctx.lineTo(SIM_W - 10, SIM_H - 10);
      ctx.lineTo(SIM_W - 10, 10);
      ctx.stroke();

      // Gas region backdrop (gradient hint)
      const grad = ctx.createLinearGradient(0, pistonY, 0, SIM_H);
      const bgTint = showTemperatureColor ? tempToColor(T) : '#60a5fa';
      grad.addColorStop(0, `${bgTint}10`);
      grad.addColorStop(1, `${bgTint}20`);
      ctx.fillStyle = grad;
      ctx.fillRect(12, pistonY + 2, SIM_W - 24, SIM_H - pistonY - 14);

      // Piston
      ctx.fillStyle = 'rgba(71, 85, 105, 0.95)';
      ctx.fillRect(10, pistonY - 10, SIM_W - 20, 10);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, pistonY - 10, SIM_W - 20, 10);

      // Piston rod
      ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
      ctx.fillRect(SIM_W / 2 - 6, Math.max(pistonY - 40, 0), 12, 30);

      // Collision flash overlay
      if (showCollisionMarkers && collisionFlashRef.current > 0) {
        ctx.fillStyle = `rgba(251, 191, 36, ${0.08 * collisionFlashRef.current})`;
        ctx.fillRect(12, pistonY, SIM_W - 24, 6);
        collisionFlashRef.current *= 0.92;
      }

      // Particles — integrate + collide
      const particles = particlesRef.current;
      let collisions = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Floor / left / right walls
        if (p.x < 12 + particleRadius) { p.x = 12 + particleRadius; p.vx = Math.abs(p.vx); }
        if (p.x > SIM_W - 12 - particleRadius) { p.x = SIM_W - 12 - particleRadius; p.vx = -Math.abs(p.vx); }
        if (p.y > SIM_H - 12 - particleRadius) { p.y = SIM_H - 12 - particleRadius; p.vy = -Math.abs(p.vy); }

        // Piston (top of gas region)
        if (p.y < pistonY + particleRadius) {
          p.y = pistonY + particleRadius;
          p.vy = Math.abs(p.vy);
          collisions++;
        }

        // Clamp speed to prevent runaway
        const sp = Math.hypot(p.vx, p.vy);
        const target = baseSpeed;
        if (sp > 0 && Math.abs(sp - target) > target * 0.3) {
          const k = target / sp;
          p.vx *= k;
          p.vy *= k;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
        ctx.fillStyle = `${particleColor}cc`;
        ctx.fill();
        ctx.strokeStyle = particleColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (collisions > 0 && showCollisionMarkers) {
        collisionFlashRef.current = Math.min(1, collisionFlashRef.current + 0.15 * collisions);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [T, baseSpeed, pistonY, showCollisionMarkers, showTemperatureColor]);

  // Piston drag handling → volume change
  const handlePointer = useCallback((clientY: number) => {
    if (!pistonDraggable || !onPistonDrag) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localY = clamp(clientY - rect.top, 20, SIM_H - 20);
    const frac = (SIM_H - 10 - localY) / (SIM_H - 30);
    const newV = V_MIN + frac * (V_MAX - V_MIN);
    onPistonDrag(clamp(newV, V_MIN, V_MAX));
  }, [pistonDraggable, onPistonDrag]);

  return (
    <canvas
      ref={canvasRef}
      width={SIM_W}
      height={SIM_H}
      className="rounded-lg bg-slate-900/70 border border-white/10"
      style={{ width: SIM_W, height: SIM_H, cursor: pistonDraggable ? 'ns-resize' : 'default' }}
      onPointerDown={(e) => { draggingRef.current = true; handlePointer(e.clientY); }}
      onPointerMove={(e) => { if (draggingRef.current) handlePointer(e.clientY); }}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerLeave={() => { draggingRef.current = false; }}
    />
  );
};

// ============================================================================
// Variable Readout Panel
// ============================================================================

const VariableReadout: React.FC<{
  variable: GasVariable;
  value: number;
  locked: boolean;
  onChange: (n: number) => void;
}> = ({ variable, value, locked, onChange }) => {
  const [lo, hi] = rangeFor(variable);
  const step = variable === 'T' ? 10 : variable === 'V' ? 0.25 : 0.05;
  const accentClass = locked
    ? 'border-slate-600/40 bg-slate-800/30'
    : 'border-indigo-400/30 bg-indigo-500/10';

  return (
    <div className={`rounded-lg p-2 border ${accentClass}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-300 text-xs font-medium">
          {variable} · {VARIABLE_LABEL[variable]}
        </span>
        {locked && (
          <Badge className="bg-slate-700/60 text-slate-400 border-slate-500/30 text-[10px]">
            locked
          </Badge>
        )}
      </div>
      <div className="text-slate-100 font-mono text-lg font-bold">
        {formatNum(value)} <span className="text-slate-500 text-xs font-normal">{VARIABLE_UNIT[variable]}</span>
      </div>
      {!locked && (
        <Slider
          value={[value]}
          min={lo}
          max={hi}
          step={step}
          onValueChange={(vals) => onChange(vals[0])}
          className="mt-1"
        />
      )}
    </div>
  );
};

// ============================================================================
// Mini Plot (P-V, V-T, or P-T over time)
// ============================================================================

interface PlotPoint {
  x: number;
  y: number;
}

const MiniPlot: React.FC<{
  title: string;
  points: PlotPoint[];
  xLabel: string;
  yLabel: string;
  xRange: [number, number];
  yRange: [number, number];
  color: string;
}> = ({ title, points, xLabel, yLabel, xRange, yRange, color }) => {
  const W = 180;
  const H = 110;
  const pad = 18;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;

  const toX = (v: number) =>
    pad + ((v - xRange[0]) / Math.max(xRange[1] - xRange[0], 0.001)) * plotW;
  const toY = (v: number) =>
    pad + plotH - ((v - yRange[0]) / Math.max(yRange[1] - yRange[0], 0.001)) * plotH;

  const path = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ')
    : '';

  const last = points[points.length - 1];

  return (
    <div className="bg-slate-800/30 rounded-lg p-2 border border-white/5">
      <div className="text-slate-300 text-[11px] font-medium mb-1">{title}</div>
      <svg width={W} height={H} className="block">
        <rect x={pad} y={pad} width={plotW} height={plotH} fill="rgba(15, 23, 42, 0.5)" stroke="rgba(148, 163, 184, 0.2)" />
        <text x={pad} y={H - 4} className="text-[9px]" fill="#94a3b8">{xLabel}</text>
        <text x={2} y={pad + 8} className="text-[9px]" fill="#94a3b8">{yLabel}</text>
        {path && <path d={path} stroke={color} strokeWidth={1.5} fill="none" opacity={0.7} />}
        {last && (
          <circle cx={toX(last.x)} cy={toY(last.y)} r={3} fill={color} />
        )}
      </svg>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface GasLawsSimulatorProps {
  data: GasLawsSimulatorData;
  className?: string;
}

const GasLawsSimulator: React.FC<GasLawsSimulatorProps> = ({ data, className }) => {
  const {
    title,
    description,
    scenario,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '9-10',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showPVPlot = scenario.lawFocus === 'boyle' || scenario.lawFocus === 'combined' || scenario.lawFocus === 'ideal',
    showVTPlot = scenario.lawFocus === 'charles' || scenario.lawFocus === 'combined' || scenario.lawFocus === 'ideal',
    showPTPlot = scenario.lawFocus === 'gay_lussac' || scenario.lawFocus === 'combined' || scenario.lawFocus === 'ideal',
    showCollisionMarkers = true,
    showTemperatureColor = true,
  } = showOptionsProp;

  // --------------------------------------------------------------------------
  // Challenge progression
  // --------------------------------------------------------------------------

  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress<GasLawsChallenge>({
    challenges,
    getChallengeId: (ch) => ch.id,
  });

  const phaseResults = usePhaseResults<GasLawsChallenge>({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // --------------------------------------------------------------------------
  // Live sim state (starts at scenario initial, user can perturb freely)
  // --------------------------------------------------------------------------

  type Phase = 'explore' | 'answer' | 'applied' | 'reconcile';
  const [phase, setPhase] = useState<Phase>('explore');
  const [studentNumber, setStudentNumber] = useState('');
  const [studentDirection, setStudentDirection] = useState<DirectionAnswer | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [submittedResult, setSubmittedResult] = useState<PrimitiveEvaluationResult | null>(null);

  const [P, setP] = useState(scenario.initialP);
  const [V, setV] = useState(scenario.initialV);
  const [T, setT] = useState(scenario.initialT);
  const [nMol, setNMol] = useState(scenario.initialN);

  // Plot history (sampled over time)
  const [pvHistory, setPvHistory] = useState<PlotPoint[]>([]);
  const [vtHistory, setVtHistory] = useState<PlotPoint[]>([]);
  const [ptHistory, setPtHistory] = useState<PlotPoint[]>([]);

  useEffect(() => {
    setPvHistory(h => (h.length > 60 ? h.slice(-60) : h).concat([{ x: V, y: P }]));
    setVtHistory(h => (h.length > 60 ? h.slice(-60) : h).concat([{ x: T, y: V }]));
    setPtHistory(h => (h.length > 60 ? h.slice(-60) : h).concat([{ x: T, y: P }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P, V, T]);

  // Reset sim + per-challenge state when the challenge changes
  const prevChallengeIdRef = useRef(currentChallenge?.id);
  useEffect(() => {
    if (prevChallengeIdRef.current !== currentChallenge?.id) {
      prevChallengeIdRef.current = currentChallenge?.id;
      setPhase('explore');
      setStudentNumber('');
      setStudentDirection(null);
      setFeedback('');
      setFeedbackType('');
      setP(scenario.initialP);
      setV(scenario.initialV);
      setT(scenario.initialT);
      setNMol(scenario.initialN);
      setPvHistory([]);
      setVtHistory([]);
      setPtHistory([]);
    }
  }, [currentChallenge?.id, scenario.initialP, scenario.initialV, scenario.initialT, scenario.initialN]);

  // --------------------------------------------------------------------------
  // Controlled-variable update — changing one ripples via PV=nRT
  // --------------------------------------------------------------------------

  const lockedSet = useMemo(() => new Set<GasVariable>(scenario.lockedVariables), [scenario.lockedVariables]);

  const setVariable = useCallback((variable: GasVariable, value: number) => {
    const next = applyChange(scenario, { P, V, T, n: nMol }, { variable, newValue: value });
    setP(next.P);
    setV(next.V);
    setT(next.T);
    setNMol(next.n);
  }, [scenario, P, V, T, nMol]);

  // --------------------------------------------------------------------------
  // Evaluation hook
  // --------------------------------------------------------------------------

  const stableInstanceIdRef = useRef(instanceId || `gas-laws-simulator-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startedAtRef = useRef(Date.now());

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<GasLawsSimulatorMetrics>({
    primitiveType: 'gas-laws-simulator',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // --------------------------------------------------------------------------
  // AI Tutoring
  // --------------------------------------------------------------------------

  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    title,
    lawFocus: scenario.lawFocus,
    lockedVariables: scenario.lockedVariables,
    initialP: scenario.initialP,
    initialV: scenario.initialV,
    initialT: scenario.initialT,
    initialN: scenario.initialN,
    currentP: P,
    currentV: V,
    currentT: T,
    currentN: nMol,
    challengeIndex: currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'observe',
    instruction: currentChallenge?.instruction ?? '',
    askFor: currentChallenge?.askFor ?? '',
    changeVariable: currentChallenge?.change.variable ?? null,
    changeNewValue: currentChallenge?.change.newValue ?? null,
    askedVariable: currentChallenge?.askedVariable ?? null,
    directionAnswer: currentChallenge?.directionAnswer ?? null,
    targetAnswer: currentChallenge?.targetAnswer ?? null,
    studentNumber,
    studentDirection,
    phase,
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, title, scenario, P, V, T, nMol, currentChallengeIndex,
    challenges.length, currentChallenge, studentNumber, studentDirection, phase, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'gas-laws-simulator',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '8' ? 'Grade 8' : gradeBand === '9-10' ? 'Grade 9-10' : 'Grade 11-12',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Gas Laws Simulator "${title}" (${scenario.lawFocus}) for ${gradeBand}. `
      + `Initial state: P=${scenario.initialP} atm, V=${scenario.initialV} L, T=${scenario.initialT} K, n=${scenario.initialN} mol. `
      + `Locked: ${scenario.lockedVariables.join(', ') || 'none'}. `
      + `Student is on challenge ${currentChallengeIndex + 1} of ${challenges.length} (type: ${currentChallenge.type}). `
      + `Anchor every hint in KMT: faster particles = more collisions = higher pressure; less volume = crowded particles = more collisions.`,
      { silent: true }
    );
  }, [isConnected, title, scenario, gradeBand, currentChallenge, currentChallengeIndex, challenges.length, sendText]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  const handleApplyChange = useCallback(() => {
    if (!currentChallenge) return;
    const next = applyChange(
      scenario,
      { P: scenario.initialP, V: scenario.initialV, T: scenario.initialT, n: scenario.initialN },
      currentChallenge.change,
    );
    setP(next.P);
    setV(next.V);
    setT(next.T);
    setNMol(next.n);
    setPhase('applied');
    sendText(
      `[CHANGE_APPLIED] ${currentChallenge.change.variable} set to ${formatNum(currentChallenge.change.newValue)} ${VARIABLE_UNIT[currentChallenge.change.variable]}. `
      + `New state: P=${formatNum(next.P)} atm, V=${formatNum(next.V)} L, T=${formatNum(next.T)} K, n=${formatNum(next.n)} mol. `
      + `Help the student connect the particle behavior they are seeing to their prediction.`,
      { silent: true }
    );
  }, [currentChallenge, scenario, sendText]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();

    let correct = false;
    let feedbackMsg = '';

    if (currentChallenge.type === 'observe') {
      const choice = studentDirection;
      const expected = currentChallenge.directionAnswer;
      correct = choice !== null && expected !== null && choice === expected;
      feedbackMsg = correct
        ? `Yes — ${VARIABLE_LABEL[currentChallenge.askedVariable]} ${expected === 'unchanged' ? 'stays the same' : expected + 's'}. ${currentChallenge.narration}`
        : `Not quite. ${currentChallenge.hint}`;
    } else {
      const num = parseFloat(studentNumber);
      if (!Number.isFinite(num)) {
        setFeedback('Type a numeric answer first.');
        setFeedbackType('error');
        return;
      }
      const target = currentChallenge.targetAnswer;
      const tol = currentChallenge.tolerance > 0 ? currentChallenge.tolerance : Math.max(0.05 * Math.abs(target), 0.01);
      correct = Math.abs(num - target) <= tol;
      const unit = VARIABLE_UNIT[currentChallenge.askedVariable];
      feedbackMsg = correct
        ? `Correct! ${formatNum(target)} ${unit}. ${currentChallenge.narration}`
        : `Close, but not there. Expected about ${formatNum(target)} ${unit} (±${formatNum(tol)}). ${currentChallenge.hint}`;
    }

    setFeedback(feedbackMsg);
    setFeedbackType(correct ? 'success' : 'error');
    setPhase('reconcile');

    if (correct) {
      recordResult({
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      });
      sendText(
        `[ANSWER_CORRECT] Student got challenge ${currentChallenge.id} (${currentChallenge.type}) on attempt ${currentAttempts + 1}. `
        + `Reinforce the KMT / gas-law reasoning briefly.`,
        { silent: true }
      );
    } else {
      const answered = currentChallenge.type === 'observe' ? (studentDirection ?? '(no pick)') : studentNumber;
      const expected = currentChallenge.type === 'observe' ? currentChallenge.directionAnswer : currentChallenge.targetAnswer;
      sendText(
        `[ANSWER_INCORRECT] Student answered "${answered}" for ${currentChallenge.type} challenge. Correct: ${expected}. `
        + `Attempt ${currentAttempts + 1}. Give a hint grounded in particle behavior: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [currentChallenge, studentDirection, studentNumber, currentAttempts, incrementAttempts, recordResult, sendText]);

  const handleAdvance = useCallback(() => {
    if (!advanceProgress()) {
      const correctCount = challengeResults.filter(r => r.correct).length;
      const total = challenges.length;
      const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

      const observeResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'observe'
      );
      const predictResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'predict'
      );
      const calcResults = challengeResults.filter(r =>
        challenges.find(c => c.id === r.challengeId)?.type === 'calculate'
      );

      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Gas Laws Simulator finished. Phase scores: ${phaseScoreStr}. Overall: ${score}%. `
        + `Celebrate, and call out whether the student was strongest at observation, prediction, or calculation.`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const result = submitEvaluation(
          score >= 50,
          score,
          {
            type: 'gas-laws-simulator',
            challengesCorrect: correctCount,
            challengesTotal: total,
            directionalPredictionCorrect: observeResults.filter(r => r.correct).length + predictResults.filter(r => r.correct).length,
            directionalPredictionTotal: challenges.filter(c => c.type === 'observe' || c.type === 'predict').length,
            calculationWithinTolerance: calcResults.filter(r => r.correct).length,
            calculationTotal: challenges.filter(c => c.type === 'calculate').length,
            attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
          },
          { challengeResults },
        );
        if (result) setSubmittedResult(result);
      }
      return;
    }

    setPhase('explore');
    setStudentNumber('');
    setStudentDirection(null);
    setFeedback('');
    setFeedbackType('');

    sendText(
      `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
      + `Type: ${challenges[currentChallengeIndex + 1]?.type}. Reset the scene briefly.`,
      { silent: true }
    );
  }, [
    advanceProgress, challengeResults, challenges, hasSubmittedEvaluation, submitEvaluation,
    phaseResults, sendText, currentChallengeIndex,
  ]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const elapsedMs = Date.now() - startedAtRef.current;
  const localOverallScore = challenges.length > 0
    ? Math.round((challengeResults.filter(r => r.correct).length / challenges.length) * 100)
    : 0;

  if (!currentChallenge) {
    return (
      <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
        <CardHeader>
          <CardTitle className="text-slate-100">{title}</CardTitle>
          {description && <CardDescription className="text-slate-400">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm">No challenges available.</p>
        </CardContent>
      </Card>
    );
  }

  const isObserve = currentChallenge.type === 'observe';
  const showAnswerControls = phase === 'applied' || phase === 'answer';
  const canApply = phase === 'explore';

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">🎈</span>
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-slate-400 text-sm mt-1">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 text-xs">
              Grade {gradeBand}
            </Badge>
            <Badge className="bg-slate-700/40 text-slate-300 border-white/10 text-xs">
              {PHASE_TYPE_CONFIG[currentChallenge.type]?.label ?? currentChallenge.type}
            </Badge>
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-xs capitalize">
              {scenario.lawFocus.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs">Challenge</span>
            {challenges.map((ch, i) => (
              <div
                key={ch.id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                  challengeResults.some(r => r.challengeId === ch.id && r.correct)
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                      : 'bg-slate-800/30 border-white/10 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Instruction */}
        <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
          <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          <p className="text-indigo-300/80 text-xs mt-1">
            <span className="text-indigo-400 font-semibold">Find: </span>
            {currentChallenge.askFor}
          </p>
        </div>

        {/* Canvas + variable panel */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 items-start">
          <div className="flex justify-center">
            <ParticleCylinder
              P={P}
              V={V}
              T={T}
              n={nMol}
              showCollisionMarkers={showCollisionMarkers}
              showTemperatureColor={showTemperatureColor}
              pistonDraggable={!lockedSet.has('V') && phase === 'explore'}
              onPistonDrag={(vol) => setVariable('V', vol)}
            />
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <VariableReadout
                variable="P"
                value={P}
                locked={lockedSet.has('P')}
                onChange={(v) => setVariable('P', v)}
              />
              <VariableReadout
                variable="V"
                value={V}
                locked={lockedSet.has('V')}
                onChange={(v) => setVariable('V', v)}
              />
              <VariableReadout
                variable="T"
                value={T}
                locked={lockedSet.has('T')}
                onChange={(v) => setVariable('T', v)}
              />
              <VariableReadout
                variable="n"
                value={nMol}
                locked={lockedSet.has('n')}
                onChange={(v) => setVariable('n', v)}
              />
            </div>

            {/* Plots */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {showPVPlot && (
                <MiniPlot
                  title="P vs V"
                  points={pvHistory}
                  xLabel="V (L)"
                  yLabel="P (atm)"
                  xRange={[V_MIN, V_MAX]}
                  yRange={[0, P_MAX]}
                  color="#60a5fa"
                />
              )}
              {showVTPlot && (
                <MiniPlot
                  title="V vs T"
                  points={vtHistory}
                  xLabel="T (K)"
                  yLabel="V (L)"
                  xRange={[T_MIN, T_MAX]}
                  yRange={[0, V_MAX]}
                  color="#f59e0b"
                />
              )}
              {showPTPlot && (
                <MiniPlot
                  title="P vs T"
                  points={ptHistory}
                  xLabel="T (K)"
                  yLabel="P (atm)"
                  xRange={[T_MIN, T_MAX]}
                  yRange={[0, P_MAX]}
                  color="#a78bfa"
                />
              )}
            </div>
          </div>
        </div>

        {/* Change-preview banner */}
        {canApply && (
          <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-400/20 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-amber-200 text-sm">
              Perturbation: <span className="font-mono font-bold">{currentChallenge.change.variable}</span>
              {' → '}
              <span className="font-mono font-bold">
                {formatNum(currentChallenge.change.newValue)} {VARIABLE_UNIT[currentChallenge.change.variable]}
              </span>
              <span className="text-amber-300/70 ml-2 text-xs">
                (first explore freely, then apply the change)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={() => setPhase('answer')}
              >
                Skip & Answer
              </Button>
              <Button
                variant="ghost"
                className="bg-amber-500/20 border border-amber-400/30 hover:bg-amber-500/30 text-amber-200"
                onClick={handleApplyChange}
              >
                Apply Change →
              </Button>
            </div>
          </div>
        )}

        {/* Answer controls */}
        {showAnswerControls && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5 space-y-2">
            <div className="text-slate-300 text-sm font-medium">
              Your answer
              <span className="text-slate-500 text-xs ml-2">
                (for {VARIABLE_LABEL[currentChallenge.askedVariable]}
                {!isObserve && `, in ${VARIABLE_UNIT[currentChallenge.askedVariable]}`})
              </span>
            </div>
            {isObserve ? (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DIRECTION_LABEL) as DirectionAnswer[]).map(dir => (
                  <Button
                    key={dir}
                    variant="ghost"
                    className={`bg-white/5 border hover:bg-white/10 ${
                      studentDirection === dir
                        ? 'border-amber-400/50 text-amber-300'
                        : 'border-white/20 text-slate-200'
                    }`}
                    onClick={() => setStudentDirection(dir)}
                  >
                    {DIRECTION_LABEL[dir]}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="Enter a number"
                  className="bg-slate-900/60 border-white/10 text-slate-100 max-w-xs"
                />
                <span className="text-slate-400 text-sm">{VARIABLE_UNIT[currentChallenge.askedVariable]}</span>
              </div>
            )}
            <Button
              variant="ghost"
              className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
              onClick={handleCheckAnswer}
            >
              Check Answer
            </Button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border text-sm ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
              : 'bg-red-500/10 border-red-400/20 text-red-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Advance */}
        {phase === 'reconcile' && feedbackType === 'success' && !allChallengesComplete && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
              onClick={handleAdvance}
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Try again on incorrect */}
        {phase === 'reconcile' && feedbackType === 'error' && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={() => {
                setPhase(isObserve ? 'applied' : 'answer');
                setFeedback('');
                setFeedbackType('');
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Phase summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Gas Laws Lab Complete!"
            celebrationMessage="You watched the particles tell the whole story."
            className="mb-2"
          />
        )}

        {/* KMT explainer */}
        <Accordion type="single" collapsible>
          <AccordionItem value="kmt" className="border-white/10">
            <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
              Why the particles behave this way
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  <span className="text-slate-200 font-medium">Temperature</span> = average kinetic energy of the particles.
                  Higher T → particles move faster → hit the walls harder and more often.
                </p>
                <p>
                  <span className="text-slate-200 font-medium">Pressure</span> = frequency and force of collisions on the walls.
                  Squeeze the volume and particles have less room — they collide with the piston more often.
                </p>
                <p>
                  These relationships are captured by <span className="font-mono text-cyan-300">PV = nRT</span>.
                  When one variable changes and others are held fixed, the remaining variable moves to keep the equation true.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default GasLawsSimulator;
