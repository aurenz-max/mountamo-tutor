'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StatesOfMatterMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SubstanceConfig {
  name: string;
  formula: string | null;
  meltingPoint: number;
  boilingPoint: number;
  currentTemp: number;
  color: {
    solid: string;
    liquid: string;
    gas: string;
  };
}

export interface ParticleConfig {
  count: number;
  size: 'small' | 'medium' | 'large';
  showTrails: boolean;
  showBonds: boolean;
}

export interface StatesOfMatterChallenge {
  id: string;
  type: 'identify_state' | 'predict_change' | 'explain_particles' | 'heating_curve' | 'compare_substances' | 'reversibility';
  instruction: string;
  targetAnswer: string;
  targetTemp: number | null;
  hint: string;
  narration: string;
}

export interface StatesOfMatterData {
  title: string;
  description?: string;
  substance: SubstanceConfig;
  particleConfig: ParticleConfig;
  challenges: StatesOfMatterChallenge[];
  showOptions?: {
    showParticleView?: boolean;
    showTemperatureSlider?: boolean;
    showStateLabels?: boolean;
    showEnergyGraph?: boolean;
    showPhaseMarkers?: boolean;
    showParticleSpeed?: boolean;
  };
  substances?: string[];
  imagePrompt?: string | null;
  gradeBand?: 'K-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StatesOfMatterMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATE_CONFIG = {
  solid: {
    label: 'Solid',
    emoji: '🧊',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/10 border-blue-400/30',
    sliderColor: '#60a5fa',
    particleDesc: 'Particles vibrate in place — tightly packed, holding their shape',
  },
  liquid: {
    label: 'Liquid',
    emoji: '💧',
    textClass: 'text-cyan-300',
    bgClass: 'bg-cyan-500/10 border-cyan-400/30',
    sliderColor: '#22d3ee',
    particleDesc: 'Particles slide past each other — close together, but free to move',
  },
  gas: {
    label: 'Gas',
    emoji: '💨',
    textClass: 'text-orange-300',
    bgClass: 'bg-orange-500/10 border-orange-400/30',
    sliderColor: '#fb923c',
    particleDesc: 'Particles fly freely — spread apart, bouncing off walls',
  },
} as const;

type MatterState = keyof typeof STATE_CONFIG;

const PRESET_SUBSTANCES: Record<string, SubstanceConfig> = {
  water: { name: 'Water', formula: 'H₂O', meltingPoint: 0, boilingPoint: 100, currentTemp: 25, color: { solid: '#93c5fd', liquid: '#3b82f6', gas: '#e2e8f0' } },
  wax: { name: 'Wax', formula: null, meltingPoint: 60, boilingPoint: 370, currentTemp: 25, color: { solid: '#fde68a', liquid: '#f59e0b', gas: '#fef3c7' } },
  iron: { name: 'Iron', formula: 'Fe', meltingPoint: 1538, boilingPoint: 2862, currentTemp: 25, color: { solid: '#94a3b8', liquid: '#ef4444', gas: '#fca5a5' } },
  chocolate: { name: 'Chocolate', formula: null, meltingPoint: 34, boilingPoint: 350, currentTemp: 25, color: { solid: '#78350f', liquid: '#92400e', gas: '#d6d3d1' } },
  nitrogen: { name: 'Nitrogen', formula: 'N₂', meltingPoint: -210, boilingPoint: -196, currentTemp: -220, color: { solid: '#c4b5fd', liquid: '#818cf8', gas: '#e0e7ff' } },
  butter: { name: 'Butter', formula: null, meltingPoint: 32, boilingPoint: 250, currentTemp: 5, color: { solid: '#fde047', liquid: '#facc15', gas: '#fef9c3' } },
};

const PARTICLE_SIZE_MAP = { small: 6, medium: 8, large: 10 };

// ============================================================================
// Particle Simulation Sub-component
// ============================================================================

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
}

const ParticleSimulation: React.FC<{
  state: MatterState;
  config: ParticleConfig;
  color: string;
  temperature: number;
  meltingPoint: number;
  boilingPoint: number;
}> = ({ state, config, color, temperature, meltingPoint, boilingPoint }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const particleRadius = PARTICLE_SIZE_MAP[config.size] || 8;
  const W = 240;
  const H = 180;

  // Initialize particles
  useEffect(() => {
    const count = config.count || 30;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacingX = W / (cols + 1);
    const spacingY = H / (rows + 1);

    particlesRef.current = Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = spacingX * (col + 1);
      const by = spacingY * (row + 1);
      return { id: i, x: bx, y: by, vx: 0, vy: 0, baseX: bx, baseY: by };
    });
  }, [config.count]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Compute a normalized energy 0-1 based on where temp sits relative to melting/boiling
    const range = Math.max(boilingPoint - meltingPoint, 1);
    const rawEnergy = (temperature - (meltingPoint - range * 0.3)) / (range * 1.6);
    const energy = Math.max(0, Math.min(1, rawEnergy));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);

      const particles = particlesRef.current;
      particles.forEach(p => {
        if (state === 'solid') {
          // Vibrate around base position
          const amplitude = 1 + energy * 6;
          p.x = p.baseX + (Math.random() - 0.5) * amplitude;
          p.y = p.baseY + (Math.random() - 0.5) * amplitude;
        } else if (state === 'liquid') {
          // Slow random walk, constrained loosely
          const speed = 0.3 + energy * 1.5;
          p.vx += (Math.random() - 0.5) * speed;
          p.vy += (Math.random() - 0.5) * speed;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx;
          p.y += p.vy;
          // Keep in lower portion (liquid pools)
          if (p.x < particleRadius) { p.x = particleRadius; p.vx *= -0.5; }
          if (p.x > W - particleRadius) { p.x = W - particleRadius; p.vx *= -0.5; }
          if (p.y < H * 0.3) { p.y = H * 0.3; p.vy *= -0.5; }
          if (p.y > H - particleRadius) { p.y = H - particleRadius; p.vy *= -0.5; }
        } else {
          // Gas — fast, bouncing everywhere
          const speed = 1 + energy * 3;
          p.vx += (Math.random() - 0.5) * speed;
          p.vy += (Math.random() - 0.5) * speed;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < particleRadius) { p.x = particleRadius; p.vx = Math.abs(p.vx); }
          if (p.x > W - particleRadius) { p.x = W - particleRadius; p.vx = -Math.abs(p.vx); }
          if (p.y < particleRadius) { p.y = particleRadius; p.vy = Math.abs(p.vy); }
          if (p.y > H - particleRadius) { p.y = H - particleRadius; p.vy = -Math.abs(p.vy); }
        }

        // Draw trail
        if (config.showTrails && state !== 'solid') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.strokeStyle = color + '40';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
        ctx.fillStyle = color + 'cc';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Draw bonds for solid state
      if (config.showBonds && state === 'solid') {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = color + '50';
        ctx.lineWidth = 1;
        particles.forEach((p, i) => {
          particles.forEach((q, j) => {
            if (j <= i) return;
            const dist = Math.hypot(p.x - q.x, p.y - q.y);
            if (dist < 40) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          });
        });
        ctx.setLineDash([]);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, config.showTrails, config.showBonds, color, particleRadius, temperature, meltingPoint, boilingPoint]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="rounded-lg bg-slate-900/60 border border-white/5 w-full"
      style={{ maxWidth: W, imageRendering: 'auto' }}
    />
  );
};

// ============================================================================
// Substance Beaker Sub-component
// ============================================================================

const SubstanceBeaker: React.FC<{
  state: MatterState;
  color: string;
  substanceName: string;
}> = ({ state, color, substanceName }) => {
  return (
    <div className="relative flex flex-col items-center justify-end h-[180px] w-full max-w-[240px] mx-auto">
      {/* Beaker outline */}
      <div className="relative w-28 h-36 border-2 border-white/25 rounded-b-xl bg-slate-800/20 overflow-hidden">
        {/* Substance fill */}
        {state === 'solid' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 rounded-t-sm"
            style={{ background: color }}
          />
        )}
        {state === 'liquid' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2/3 transition-all duration-700"
            style={{ background: `${color}90` }}
          >
            {/* Surface ripple */}
            <div className="absolute top-0 left-0 right-0 h-1 animate-pulse" style={{ background: `${color}50` }} />
          </div>
        )}
        {state === 'gas' && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 rounded-full animate-bounce opacity-30"
                style={{
                  background: color,
                  left: `${20 + Math.random() * 60}%`,
                  top: `${10 + Math.random() * 70}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${1.5 + Math.random()}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Steam wisps for gas */}
        {state === 'gas' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-white/10 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.8s' }}
              />
            ))}
          </div>
        )}
      </div>

      <span className="text-slate-400 text-[10px] mt-1">{substanceName}</span>
    </div>
  );
};

// ============================================================================
// Energy Graph Sub-component
// ============================================================================

const EnergyGraph: React.FC<{
  temperature: number;
  meltingPoint: number;
  boilingPoint: number;
  minTemp: number;
  maxTemp: number;
}> = ({ temperature, meltingPoint, boilingPoint, minTemp, maxTemp }) => {
  const W = 240;
  const H = 80;
  const padding = 20;

  const tempToX = (t: number) => padding + ((t - minTemp) / (maxTemp - minTemp)) * (W - 2 * padding);
  const currentX = tempToX(temperature);
  const meltX = tempToX(meltingPoint);
  const boilX = tempToX(boilingPoint);

  // Simplified heating curve: rises, plateaus at melting, rises, plateaus at boiling, rises
  const yBottom = H - 10;
  const yTop = 10;
  const curvePoints = [
    { x: padding, y: yBottom },
    { x: meltX - 5, y: yBottom - (yBottom - yTop) * 0.3 },
    { x: meltX + 5, y: yBottom - (yBottom - yTop) * 0.3 }, // plateau
    { x: (meltX + boilX) / 2, y: yBottom - (yBottom - yTop) * 0.6 },
    { x: boilX - 5, y: yBottom - (yBottom - yTop) * 0.7 },
    { x: boilX + 5, y: yBottom - (yBottom - yTop) * 0.7 }, // plateau
    { x: W - padding, y: yTop },
  ];

  const pathD = curvePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5">
      <span className="text-slate-500 text-[10px] uppercase tracking-wider">Heating Curve</span>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Axis */}
        <line x1={padding} y1={yBottom} x2={W - padding} y2={yBottom} stroke="#334155" strokeWidth={1} />

        {/* Curve */}
        <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth={2} opacity={0.6} />

        {/* Phase markers */}
        <line x1={meltX} y1={yTop} x2={meltX} y2={yBottom} stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <text x={meltX} y={H - 1} textAnchor="middle" fill="#60a5fa" fontSize={8}>MP</text>

        <line x1={boilX} y1={yTop} x2={boilX} y2={yBottom} stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <text x={boilX} y={H - 1} textAnchor="middle" fill="#fb923c" fontSize={8}>BP</text>

        {/* Current temperature marker */}
        <circle cx={Math.max(padding, Math.min(W - padding, currentX))} cy={yBottom - 3} r={4} fill="#22d3ee" />
      </svg>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface StatesOfMatterProps {
  data: StatesOfMatterData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const StatesOfMatter: React.FC<StatesOfMatterProps> = ({ data, className }) => {
  const {
    title,
    description,
    substance: initialSubstance,
    particleConfig,
    challenges = [],
    showOptions = {},
    substances: availableSubstances,
    gradeBand = 'K-2',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showParticleView = true,
    showTemperatureSlider = true,
    showStateLabels = true,
    showEnergyGraph = gradeBand === '3-5',
    showPhaseMarkers = true,
    showParticleSpeed = false,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [substance, setSubstance] = useState<SubstanceConfig>(initialSubstance);
  const [temperature, setTemperature] = useState(initialSubstance.currentTemp);
  const [substancesExplored, setSubstancesExplored] = useState<Set<string>>(new Set([initialSubstance.name]));

  // Challenge tracking
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);

  // Metric tracking
  const [stateIdCorrect, setStateIdCorrect] = useState(0);
  const [stateIdTotal, setStateIdTotal] = useState(0);
  const [phaseChangeIdentified, setPhaseChangeIdentified] = useState(false);
  const [particleModelExplained, setParticleModelExplained] = useState(false);
  const [heatingCurveRead, setHeatingCurveRead] = useState(false);
  const [reversibilityUnderstood, setReversibilityUnderstood] = useState(false);
  const [tempPrecisionSum, setTempPrecisionSum] = useState(0);
  const [tempPrecisionCount, setTempPrecisionCount] = useState(0);

  // Phase change celebration
  const [lastCrossedTransition, setLastCrossedTransition] = useState<'melting' | 'boiling' | null>(null);
  const [previousState, setPreviousState] = useState<MatterState | null>(null);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `states-of-matter-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------

  const currentState: MatterState = useMemo(() => {
    if (temperature < substance.meltingPoint) return 'solid';
    if (temperature < substance.boilingPoint) return 'liquid';
    return 'gas';
  }, [temperature, substance.meltingPoint, substance.boilingPoint]);

  const currentColor = useMemo(() => {
    return substance.color[currentState];
  }, [substance.color, currentState]);

  const tempRange = useMemo(() => {
    const range = substance.boilingPoint - substance.meltingPoint;
    const padding = Math.max(range * 0.3, 30);
    return {
      min: Math.floor(substance.meltingPoint - padding),
      max: Math.ceil(substance.boilingPoint + padding),
    };
  }, [substance.meltingPoint, substance.boilingPoint]);

  // Particle speed as percentage
  const particleSpeed = useMemo(() => {
    const range = tempRange.max - tempRange.min;
    return Math.max(0, Math.min(100, ((temperature - tempRange.min) / range) * 100));
  }, [temperature, tempRange]);

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<StatesOfMatterMetrics>({
    primitiveType: 'states-of-matter',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    substanceName: substance.name,
    substanceFormula: substance.formula,
    meltingPoint: substance.meltingPoint,
    boilingPoint: substance.boilingPoint,
    currentTemperature: temperature,
    currentState,
    particleSpeed: Math.round(particleSpeed),
    substancesExplored: substancesExplored.size,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'identify_state',
    instruction: currentChallenge?.instruction ?? title,
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, substance, temperature, currentState, particleSpeed,
    substancesExplored.size, currentChallengeIndex, challenges.length,
    currentChallenge, currentAttempts, title,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'states-of-matter',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : 'Grade 3-5',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] States of Matter activity for ${gradeBand}. `
      + `Substance: ${substance.name}${substance.formula ? ` (${substance.formula})` : ''}. `
      + `Melting point: ${substance.meltingPoint}°C, Boiling point: ${substance.boilingPoint}°C. `
      + `Starting at ${temperature}°C (${currentState}). `
      + `${challenges.length} challenges. `
      + `Introduce warmly: "Let's explore what happens to ${substance.name} when we change the temperature! Right now it's a ${currentState}. What do you think the tiny particles inside are doing?"`,
      { silent: true }
    );
  }, [isConnected, substance, temperature, currentState, gradeBand, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Phase change detection
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (previousState && previousState !== currentState) {
      const transition = (previousState === 'solid' && currentState === 'liquid') ? 'melting'
        : (previousState === 'liquid' && currentState === 'gas') ? 'boiling'
        : null;

      if (transition) {
        setLastCrossedTransition(transition);
        setPhaseChangeIdentified(true);
        setTimeout(() => setLastCrossedTransition(null), 2000);

        sendText(
          `[PHASE_CHANGE] ${substance.name} changed from ${previousState} to ${currentState} at ${temperature}°C! `
          + `${transition === 'melting' ? 'The particles broke free from their fixed positions and started sliding!' : 'The particles escaped completely and are flying freely!'} `
          + `Celebrate and explain: "Did you see that? The ${substance.name} just ${transition === 'melting' ? 'melted' : 'boiled'}! The particles ${transition === 'melting' ? 'got enough energy to slide past each other' : 'got so much energy they flew apart'}!"`,
          { silent: true }
        );
      }

      const reverseTransition = (previousState === 'liquid' && currentState === 'solid') || (previousState === 'gas' && currentState === 'liquid');
      if (reverseTransition) {
        sendText(
          `[REVERSE_CHANGE] ${substance.name} changed back from ${previousState} to ${currentState} at ${temperature}°C. `
          + `The student cooled it down! Narrate: "You reversed it! When we take away heat, the particles slow down and ${currentState === 'solid' ? 'lock back into place' : 'come closer together'}."`,
          { silent: true }
        );
      }
    }
    setPreviousState(currentState);
  }, [currentState, previousState, substance.name, temperature, sendText]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTemperatureChange = useCallback((newTemp: number) => {
    if (hasSubmittedEvaluation) return;
    setTemperature(newTemp);
  }, [hasSubmittedEvaluation]);

  const handleSwitchSubstance = useCallback((key: string) => {
    const preset = PRESET_SUBSTANCES[key];
    if (!preset) return;
    setSubstance(preset);
    setTemperature(preset.currentTemp);
    setSubstancesExplored(prev => { const next = new Set(prev); next.add(preset.name); return next; });

    sendText(
      `[SUBSTANCE_CHANGED] Student switched to ${preset.name}. `
      + `Melting: ${preset.meltingPoint}°C, Boiling: ${preset.boilingPoint}°C. Starting at ${preset.currentTemp}°C. `
      + `Introduce: "Now let's look at ${preset.name}! Its melting point is ${preset.meltingPoint}°C. How is that different from what we just explored?"`,
      { silent: true }
    );
  }, [sendText]);

  // -------------------------------------------------------------------------
  // Challenge checking
  // -------------------------------------------------------------------------

  const handleCheckChallenge = useCallback(() => {
    if (!currentChallenge) return;

    setCurrentAttempts(a => a + 1);
    const answer = challengeAnswer.trim().toLowerCase();
    const target = currentChallenge.targetAnswer.toLowerCase();
    let isCorrect = false;

    switch (currentChallenge.type) {
      case 'identify_state': {
        isCorrect = answer.includes(target);
        setStateIdTotal(prev => prev + 1);
        if (isCorrect) setStateIdCorrect(prev => prev + 1);
        break;
      }
      case 'predict_change': {
        isCorrect = answer.includes(target);
        // Check temperature precision
        if (currentChallenge.targetTemp !== null) {
          const precision = Math.abs(temperature - currentChallenge.targetTemp);
          setTempPrecisionSum(prev => prev + precision);
          setTempPrecisionCount(prev => prev + 1);
        }
        break;
      }
      case 'explain_particles': {
        // Accept if they mention particles/atoms and relevant behavior
        isCorrect = answer.length >= 15 && (
          answer.includes('particle') || answer.includes('atom') || answer.includes('molecule') ||
          answer.includes('vibrat') || answer.includes('move') || answer.includes('slide') ||
          answer.includes('fly') || answer.includes('energy') || answer.includes('fast') ||
          answer.includes('slow') || answer.includes('close') || answer.includes('apart')
        );
        if (isCorrect) setParticleModelExplained(true);
        break;
      }
      case 'heating_curve': {
        isCorrect = answer.includes(target) || answer.includes('plateau') || answer.includes('flat');
        if (isCorrect) setHeatingCurveRead(true);
        break;
      }
      case 'reversibility': {
        isCorrect = answer.includes(target) || answer.includes('yes') || answer.includes('revers');
        if (isCorrect) setReversibilityUnderstood(true);
        break;
      }
      case 'compare_substances': {
        isCorrect = answer.includes(target) || answer.length >= 15;
        break;
      }
      default: {
        isCorrect = answer.includes(target);
      }
    }

    if (isCorrect) {
      setFeedback(currentChallenge.narration || 'Excellent!');
      setFeedbackType('success');
      setChallengeResults(prev => [...prev, {
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      }]);
      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" for "${currentChallenge.instruction}". `
        + `Celebrate: "${currentChallenge.narration}"`,
        { silent: true }
      );
    } else {
      setFeedback(currentAttempts >= 1 ? currentChallenge.hint : 'Not quite — try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but target is "${target}". `
        + `Attempt ${currentAttempts + 1}. Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [currentChallenge, challengeAnswer, currentAttempts, temperature, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      sendText(
        `[ALL_COMPLETE] Student completed all ${challenges.length} challenges! `
        + `They explored ${substancesExplored.size} substance(s). `
        + `Celebrate: "Amazing! You really understand how particles behave in solids, liquids, and gases!"`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((correctCount / challenges.length) * 100) : 0;

        const metrics: StatesOfMatterMetrics = {
          type: 'states-of-matter',
          stateIdentificationCorrect: stateIdCorrect,
          stateTotal: stateIdTotal,
          phaseChangeIdentified,
          particleModelExplained,
          heatingCurveRead,
          reversibilityUnderstood,
          substancesExplored: substancesExplored.size,
          temperatureControlPrecision: tempPrecisionCount > 0
            ? Math.round(tempPrecisionSum / tempPrecisionCount)
            : 0,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults, substancesExplored: Array.from(substancesExplored) }
        );
      }
      return;
    }

    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setChallengeAnswer('');

    sendText(
      `[NEXT_ITEM] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${challenges[nextIndex]?.instruction}". Introduce it.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, stateIdCorrect, stateIdTotal, phaseChangeIdentified,
    particleModelExplained, heatingCurveRead, reversibilityUnderstood,
    substancesExplored, tempPrecisionSum, tempPrecisionCount, submitEvaluation,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const stateConf = STATE_CONFIG[currentState];

  // Slider gradient
  const sliderBackground = useMemo(() => {
    const meltPct = ((substance.meltingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100;
    const boilPct = ((substance.boilingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100;
    return `linear-gradient(to right, ${STATE_CONFIG.solid.sliderColor} ${meltPct}%, ${STATE_CONFIG.liquid.sliderColor} ${meltPct}%, ${STATE_CONFIG.liquid.sliderColor} ${boilPct}%, ${STATE_CONFIG.gas.sliderColor} ${boilPct}%)`;
  }, [substance.meltingPoint, substance.boilingPoint, tempRange]);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
              {gradeBand === 'K-2' ? 'Kindergarten' : 'Grades 3-5'}
            </Badge>
            <Badge className={`text-xs ${stateConf.bgClass} ${stateConf.textClass}`}>
              {stateConf.emoji} {stateConf.label}
            </Badge>
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Phase change celebration */}
        {lastCrossedTransition && (
          <div className="text-center animate-bounce">
            <span className="text-2xl">{lastCrossedTransition === 'melting' ? '🫠' : '☁️'}</span>
            <p className="text-emerald-400 text-sm font-medium">
              {lastCrossedTransition === 'melting' ? 'Melting! Solid → Liquid' : 'Boiling! Liquid → Gas'}
            </p>
          </div>
        )}

        {/* Split View: Substance + Particles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left: Substance Container */}
          <div>
            <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-1">
              {substance.name} — Real View
            </span>
            <SubstanceBeaker
              state={currentState}
              color={currentColor}
              substanceName={`${substance.name} at ${temperature}°C`}
            />
          </div>

          {/* Right: Particle View */}
          {showParticleView && (
            <div>
              <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-1">
                Particle View
              </span>
              <ParticleSimulation
                state={currentState}
                config={particleConfig}
                color={currentColor}
                temperature={temperature}
                meltingPoint={substance.meltingPoint}
                boilingPoint={substance.boilingPoint}
              />
              <p className="text-slate-500 text-[10px] text-center mt-1 italic">
                {stateConf.particleDesc}
              </p>
            </div>
          )}
        </div>

        {/* Temperature Slider */}
        {showTemperatureSlider && (
          <div className="bg-slate-800/20 rounded-xl p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Temperature</span>
              <span className={`text-sm font-mono font-medium ${stateConf.textClass}`}>
                {temperature}°C
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={tempRange.min}
              max={tempRange.max}
              value={temperature}
              onChange={e => handleTemperatureChange(parseInt(e.target.value))}
              className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
              style={{ background: sliderBackground }}
            />

            {/* State labels & phase markers */}
            {showStateLabels && (
              <div className="relative h-5">
                {showPhaseMarkers && (
                  <>
                    <div
                      className="absolute text-[9px] text-blue-400 font-mono -translate-x-1/2"
                      style={{ left: `${((substance.meltingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100}%` }}
                    >
                      {substance.meltingPoint}° MP
                    </div>
                    <div
                      className="absolute text-[9px] text-orange-400 font-mono -translate-x-1/2"
                      style={{ left: `${((substance.boilingPoint - tempRange.min) / (tempRange.max - tempRange.min)) * 100}%` }}
                    >
                      {substance.boilingPoint}° BP
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Particle speed indicator */}
            {showParticleSpeed && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-[10px]">Particle Energy</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${particleSpeed}%`,
                      background: `linear-gradient(to right, ${STATE_CONFIG.solid.sliderColor}, ${STATE_CONFIG.gas.sliderColor})`,
                    }}
                  />
                </div>
                <span className="text-slate-500 text-[10px] font-mono">{Math.round(particleSpeed)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Energy Graph (heating curve) */}
        {showEnergyGraph && (
          <EnergyGraph
            temperature={temperature}
            meltingPoint={substance.meltingPoint}
            boilingPoint={substance.boilingPoint}
            minTemp={tempRange.min}
            maxTemp={tempRange.max}
          />
        )}

        {/* Substance Switcher */}
        {availableSubstances && availableSubstances.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider self-center mr-1">Substance:</span>
            {availableSubstances.map(key => {
              const preset = PRESET_SUBSTANCES[key];
              if (!preset) return null;
              const isActive = substance.name === preset.name;
              return (
                <Button
                  key={key}
                  variant="ghost"
                  className={`h-auto py-1 px-2 text-xs ${
                    isActive
                      ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                  onClick={() => handleSwitchSubstance(key)}
                >
                  {preset.name}
                </Button>
              );
            })}
          </div>
        )}

        {/* Challenge Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2">
            {challenges.map((c, i) => (
              <div
                key={c.id}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  challengeResults.some(r => r.challengeId === c.id && r.correct)
                    ? 'bg-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-cyan-400 scale-125'
                      : 'bg-slate-600'
                }`}
              />
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Current Challenge */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-slate-700/50 text-slate-300 border-slate-600/50">
                {currentChallenge.type.replace('_', ' ')}
              </Badge>
              <p className="text-slate-200 text-sm font-medium">
                {currentChallenge.instruction}
              </p>
            </div>

            {!isCurrentChallengeComplete && (
              <>
                {currentChallenge.type === 'identify_state' ? (
                  <div className="flex gap-2">
                    {(['solid', 'liquid', 'gas'] as MatterState[]).map(state => (
                      <Button
                        key={state}
                        variant="ghost"
                        className={`flex-1 ${
                          challengeAnswer === state
                            ? `${STATE_CONFIG[state].bgClass} ${STATE_CONFIG[state].textClass}`
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                        onClick={() => setChallengeAnswer(state)}
                      >
                        {STATE_CONFIG[state].emoji} {STATE_CONFIG[state].label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={challengeAnswer}
                    onChange={e => setChallengeAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600 resize-none"
                    rows={2}
                  />
                )}

                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  onClick={handleCheckChallenge}
                  disabled={!challengeAnswer.trim() || hasSubmittedEvaluation}
                >
                  Check Answer
                </Button>
              </>
            )}
          </div>
        )}

        {/* All Complete */}
        {allChallengesComplete && (
          <div className="text-center py-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">
              All challenges complete!
            </p>
            <p className="text-slate-400 text-xs">
              {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
            </p>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next Challenge Button */}
        {isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </Button>
          </div>
        )}

        {/* Hint after 2 attempts */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">💡 {currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatesOfMatter;
