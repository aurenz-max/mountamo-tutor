'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PropulsionLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PropulsionChallenge {
  id: string;
  type: 'predict' | 'observe' | 'experiment';
  instruction: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  hint: string;
}

export interface PropulsionLabData {
  title: string;
  description: string;
  overview: string;
  gradeBand: '1-2' | '3-5';
  challenges?: PropulsionChallenge[];
  propulsionFacts?: Record<string, { name: string; description: string; analogy: string }>;
  mediumFacts?: Record<string, { name: string; description: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PropulsionLabMetrics>) => void;
}

// ============================================================================
// Physics Constants — Component owns ALL geometry and physics
// ============================================================================

const CW = 700;
const CH = 400;

type PropulsionType = 'jet' | 'rocket' | 'propeller' | 'sail';
type MediumType = 'air' | 'water' | 'vacuum';

interface PropulsionDef {
  label: string;
  emoji: string;
  color: string;
  exhaustColor: string;
  /** Does this type carry its own propellant? (true = works in vacuum) */
  selfContained: boolean;
  /** Base thrust multiplier */
  thrustPower: number;
  /** Exhaust particle speed */
  exhaustSpeed: number;
  /** Description of what it pushes against */
  pushesAgainst: string;
}

const PROPULSION_DEFS: Record<PropulsionType, PropulsionDef> = {
  jet: {
    label: 'Jet Engine',
    emoji: '\u2708\uFE0F',
    color: '#f97316',
    exhaustColor: '#fdba74',
    selfContained: false,
    thrustPower: 1.2,
    exhaustSpeed: 5,
    pushesAgainst: 'Sucks in air, burns it, blasts it out faster',
  },
  rocket: {
    label: 'Rocket',
    emoji: '\uD83D\uDE80',
    color: '#a855f7',
    exhaustColor: '#c084fc',
    selfContained: true,
    thrustPower: 1.5,
    exhaustSpeed: 7,
    pushesAgainst: 'Carries its own fuel — ejects propellant backward',
  },
  propeller: {
    label: 'Propeller',
    emoji: '\uD83D\uDEE9\uFE0F',
    color: '#3b82f6',
    exhaustColor: '#93c5fd',
    selfContained: false,
    thrustPower: 0.8,
    exhaustSpeed: 3,
    pushesAgainst: 'Spins to push air (or water) backward',
  },
  sail: {
    label: 'Sail',
    emoji: '\u26F5',
    color: '#14b8a6',
    exhaustColor: '#5eead4',
    selfContained: false,
    thrustPower: 0.5,
    exhaustSpeed: 2,
    pushesAgainst: 'Catches wind particles — redirects them',
  },
};

interface MediumDef {
  label: string;
  particleDensity: number; // ambient particles on screen
  particleColor: string;
  dragFactor: number;
  bgGradient: [string, string];
}

const MEDIUM_DEFS: Record<MediumType, MediumDef> = {
  air: {
    label: 'Air',
    particleDensity: 40,
    particleColor: '#94a3b8',
    dragFactor: 0.005,
    bgGradient: ['#0c1a2e', '#1a2d4a'],
  },
  water: {
    label: 'Water',
    particleDensity: 80,
    particleColor: '#38bdf8',
    dragFactor: 0.02,
    bgGradient: ['#0c2440', '#0e3a5e'],
  },
  vacuum: {
    label: 'Vacuum (Space!)',
    particleDensity: 0,
    particleColor: '#475569',
    dragFactor: 0,
    bgGradient: ['#020617', '#0f172a'],
  },
};

const DEFAULT_CHALLENGES: PropulsionChallenge[] = [
  {
    id: 'ch1', type: 'predict',
    instruction: 'Set the propeller in vacuum (space). What do you think will happen when you increase throttle?',
    options: [
      { id: 'a', text: 'It pushes the vehicle forward normally' },
      { id: 'b', text: 'Nothing happens — there are no air particles to push!' },
      { id: 'c', text: 'The vehicle goes backward' },
      { id: 'd', text: 'The propeller spins but the vehicle explodes' },
    ],
    correctOptionId: 'b',
    hint: 'A propeller works by pushing air backward. What happens when there is no air?',
  },
  {
    id: 'ch2', type: 'observe',
    instruction: 'Now try the rocket in vacuum. Watch the particles carefully. Why does the rocket still work?',
    options: [
      { id: 'a', text: 'It pushes against the stars' },
      { id: 'b', text: 'It carries its own propellant — it ejects particles backward even in vacuum' },
      { id: 'c', text: 'Rockets don\'t actually work in space' },
      { id: 'd', text: 'The vacuum pulls it forward' },
    ],
    correctOptionId: 'b',
    hint: 'Watch the exhaust particles. Where do they come from? The rocket or the environment?',
  },
  {
    id: 'ch3', type: 'experiment',
    instruction: 'Compare the propeller in air vs water. In which medium does it produce more thrust? (Watch the speed gauge!)',
    options: [
      { id: 'a', text: 'Air — less resistance means more speed' },
      { id: 'b', text: 'Water — denser medium means more particles to push = more thrust' },
      { id: 'c', text: 'Exactly the same in both' },
      { id: 'd', text: 'It doesn\'t work in water' },
    ],
    correctOptionId: 'b',
    hint: 'Look at how many medium particles are in water vs air. More particles to push against means...',
  },
  {
    id: 'ch4', type: 'predict',
    instruction: 'A sail catches wind to move a boat. Can a sail work in vacuum?',
    options: [
      { id: 'a', text: 'Yes — sails work everywhere' },
      { id: 'b', text: 'No — there are no wind particles to catch in vacuum' },
      { id: 'c', text: 'Only if you blow really hard' },
      { id: 'd', text: 'Yes, but only backward' },
    ],
    correctOptionId: 'b',
    hint: 'A sail doesn\'t make its own force. It redirects particles that hit it. What if nothing hits it?',
  },
];

// ============================================================================
// Particle Types
// ============================================================================

interface SimParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1 — fades as it ages
  kind: 'exhaust' | 'medium' | 'intake';
}

// ============================================================================
// Canvas Sub-component: PropulsionSimulation
// ============================================================================

interface SimCallbacks {
  onSpeed: (speed: number) => void;
  onThrust: (thrust: number) => void;
  onNoThrust: () => void;
}

const PropulsionSimulation: React.FC<{
  propulsion: PropulsionType;
  medium: MediumType;
  throttle: number;
  callbacks: SimCallbacks;
}> = ({ propulsion, medium, throttle, callbacks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<SimParticle[]>([]);
  const simRef = useRef({ vehicleX: CW * 0.45, vehicleVx: 0, noThrustFired: false });
  const animRef = useRef<number>(0);

  // Refs for frame-rate-independent reads
  const propRef = useRef(propulsion);
  const medRef = useRef(medium);
  const throttleRef = useRef(throttle);
  const cbRef = useRef(callbacks);
  useEffect(() => { propRef.current = propulsion; }, [propulsion]);
  useEffect(() => { medRef.current = medium; }, [medium]);
  useEffect(() => { throttleRef.current = throttle; }, [throttle]);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  // Reset particles when propulsion or medium changes
  useEffect(() => {
    const mDef = MEDIUM_DEFS[medium];
    const ambient: SimParticle[] = [];
    for (let i = 0; i < mDef.particleDensity; i++) {
      ambient.push({
        x: Math.random() * CW,
        y: 60 + Math.random() * (CH - 120),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 1,
        kind: 'medium',
      });
    }
    particlesRef.current = ambient;
    simRef.current = { vehicleX: CW * 0.45, vehicleVx: 0, noThrustFired: false };
  }, [propulsion, medium]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const VEHICLE_Y = CH * 0.48;
    const VEHICLE_W = 80;
    const VEHICLE_H = 36;

    const animate = () => {
      const sim = simRef.current;
      const particles = particlesRef.current;
      const prop = propRef.current;
      const med = medRef.current;
      const thr = throttleRef.current / 100;
      const cbs = cbRef.current;

      const pDef = PROPULSION_DEFS[prop];
      const mDef = MEDIUM_DEFS[med];

      // ======== PHYSICS ========
      const hasMedium = mDef.particleDensity > 0;
      const canThrust = pDef.selfContained || hasMedium;
      const effectiveThrust = canThrust ? thr * pDef.thrustPower : 0;

      // Detect no-thrust situation
      if (!canThrust && thr > 0.3 && !sim.noThrustFired) {
        sim.noThrustFired = true;
        cbs.onNoThrust();
      }
      if (canThrust || thr < 0.1) sim.noThrustFired = false;

      // Emit exhaust particles
      if (effectiveThrust > 0.05) {
        const emitCount = Math.floor(1 + effectiveThrust * 3);
        for (let i = 0; i < emitCount; i++) {
          particles.push({
            x: sim.vehicleX - VEHICLE_W * 0.4,
            y: VEHICLE_Y + (Math.random() - 0.5) * VEHICLE_H * 0.5,
            vx: -(pDef.exhaustSpeed * (0.6 + effectiveThrust * 0.4) + Math.random() * 1.5),
            vy: (Math.random() - 0.5) * 1.2,
            life: 1,
            kind: 'exhaust',
          });
        }
      }

      // Intake particles (jet/propeller suck in medium)
      if (!pDef.selfContained && hasMedium && effectiveThrust > 0.1) {
        if (Math.random() < effectiveThrust * 0.5) {
          particles.push({
            x: sim.vehicleX + VEHICLE_W * 0.5 + 20 + Math.random() * 40,
            y: VEHICLE_Y + (Math.random() - 0.5) * VEHICLE_H * 0.8,
            vx: -(1 + effectiveThrust * 2),
            vy: (Math.random() - 0.5) * 0.5,
            life: 0.8,
            kind: 'intake',
          });
        }
      }

      // Sail: deflect medium particles (wind pushes from right)
      if (prop === 'sail' && hasMedium && thr > 0.1) {
        // Add wind particles from the right
        if (Math.random() < 0.3 + thr * 0.3) {
          particles.push({
            x: CW + 5,
            y: VEHICLE_Y + (Math.random() - 0.5) * CH * 0.6,
            vx: -(2 + Math.random() * 2),
            vy: (Math.random() - 0.5) * 0.5,
            life: 1,
            kind: 'medium',
          });
        }
      }

      // Update vehicle
      sim.vehicleVx += effectiveThrust * 0.06;
      sim.vehicleVx -= sim.vehicleVx * mDef.dragFactor; // drag
      sim.vehicleVx *= 0.995; // friction
      sim.vehicleX += sim.vehicleVx;

      // Wrap vehicle position
      if (sim.vehicleX > CW + VEHICLE_W) sim.vehicleX = -VEHICLE_W;
      if (sim.vehicleX < -VEHICLE_W * 2) sim.vehicleX = CW + VEHICLE_W;

      const speed = Math.round(Math.abs(sim.vehicleVx) * 50);
      const thrustDisplay = Math.round(effectiveThrust * 100);
      cbs.onSpeed(speed);
      cbs.onThrust(thrustDisplay);

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.kind === 'exhaust') {
          p.life -= 0.012;
          p.vx *= 0.98;
          p.vy *= 0.97;
        } else if (p.kind === 'intake') {
          p.life -= 0.03;
        } else {
          // medium particles drift slowly
          p.vx += (Math.random() - 0.5) * 0.05;
          p.vy += (Math.random() - 0.5) * 0.05;
          p.vx *= 0.99;
          p.vy *= 0.99;

          // Sail deflection: medium particles near vehicle bounce off
          if (prop === 'sail' && effectiveThrust > 0.05) {
            const dx = p.x - sim.vehicleX;
            const dy = p.y - VEHICLE_Y;
            if (Math.abs(dx) < VEHICLE_W * 0.6 && Math.abs(dy) < VEHICLE_H * 0.8) {
              // Bounce diagonally
              p.vx = 1 + Math.random() * 2;
              p.vy = (Math.random() - 0.5) * 3;
              p.life = 0.6;
            }
          }

          // Keep medium particles on screen
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
          if (p.x > CW) { p.x = CW; p.vx = -Math.abs(p.vx); }
          if (p.y < 60) { p.y = 60; p.vy = Math.abs(p.vy); }
          if (p.y > CH - 60) { p.y = CH - 60; p.vy = -Math.abs(p.vy); }
        }

        // Remove dead particles
        if (p.life <= 0 || p.x < -50 || p.x > CW + 50 || p.y < -20 || p.y > CH + 20) {
          particles.splice(i, 1);
        }
      }

      // Replenish medium particles
      while (particles.filter(p => p.kind === 'medium').length < mDef.particleDensity) {
        particles.push({
          x: Math.random() * CW,
          y: 60 + Math.random() * (CH - 120),
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          life: 1,
          kind: 'medium',
        });
      }

      // ======== DRAW ========
      ctx.clearRect(0, 0, CW, CH);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, mDef.bgGradient[0]);
      bg.addColorStop(1, mDef.bgGradient[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Stars in vacuum
      if (med === 'vacuum') {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 60; i++) {
          const sx = (i * 137.5) % CW;
          const sy = (i * 97.3) % CH;
          const sr = (i % 3 === 0) ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Water surface hint
      if (med === 'water') {
        ctx.strokeStyle = 'rgba(56,189,248,0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const wy = 70 + i * 40;
          ctx.beginPath();
          for (let x = 0; x < CW; x += 10) {
            const y = wy + Math.sin((x + Date.now() * 0.001 + i * 30) * 0.03) * 3;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Medium label
      ctx.fillStyle = 'rgba(148,163,184,0.4)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Medium: ${mDef.label}`, 10, 20);
      ctx.fillText(`Particles: ${mDef.particleDensity === 0 ? 'NONE' : mDef.particleDensity}`, 10, 34);

      // Draw medium particles
      for (const p of particles) {
        if (p.kind === 'medium') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = mDef.particleColor + Math.round(p.life * 80).toString(16).padStart(2, '0');
          ctx.fill();
        }
      }

      // Draw intake particles
      for (const p of particles) {
        if (p.kind === 'intake') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,220,255,${p.life * 0.5})`;
          ctx.fill();
        }
      }

      // Draw exhaust particles (with glow)
      for (const p of particles) {
        if (p.kind === 'exhaust') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5 + (1 - p.life) * 2, 0, Math.PI * 2);
          if (p.life > 0.5) {
            ctx.shadowColor = pDef.exhaustColor;
            ctx.shadowBlur = 6;
          }
          ctx.fillStyle = pDef.color + Math.round(p.life * 200).toString(16).padStart(2, '0');
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw vehicle body
      const vx = sim.vehicleX - VEHICLE_W / 2;
      const vy = VEHICLE_Y - VEHICLE_H / 2;
      const r = 8;

      // Vehicle shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sim.vehicleX, VEHICLE_Y + VEHICLE_H * 0.7, VEHICLE_W * 0.45, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Vehicle body
      const vGrad = ctx.createLinearGradient(vx, vy, vx, vy + VEHICLE_H);
      vGrad.addColorStop(0, '#334155');
      vGrad.addColorStop(0.5, '#475569');
      vGrad.addColorStop(1, '#334155');
      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.moveTo(vx + r, vy);
      // Nose (right side)
      ctx.lineTo(vx + VEHICLE_W - 5, vy);
      ctx.quadraticCurveTo(vx + VEHICLE_W + 12, VEHICLE_Y, vx + VEHICLE_W - 5, vy + VEHICLE_H);
      // Bottom
      ctx.lineTo(vx + r, vy + VEHICLE_H);
      ctx.arcTo(vx, vy + VEHICLE_H, vx, vy + VEHICLE_H - r, r);
      ctx.lineTo(vx, vy + r);
      ctx.arcTo(vx, vy, vx + r, vy, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pDef.color + '80';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Engine glow at rear
      if (effectiveThrust > 0.05) {
        const glowR = 8 + effectiveThrust * 12;
        const glow = ctx.createRadialGradient(
          vx + 2, VEHICLE_Y, 2,
          vx + 2, VEHICLE_Y, glowR,
        );
        glow.addColorStop(0, pDef.exhaustColor + 'cc');
        glow.addColorStop(1, pDef.exhaustColor + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(vx + 2, VEHICLE_Y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Propulsion type icon on vehicle
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText(pDef.emoji, sim.vehicleX + 5, VEHICLE_Y + 6);

      // Force arrows
      if (effectiveThrust > 0.05 || thr > 0.1) {
        const arrowLen = effectiveThrust * 60 + 15;

        // Action arrow (backward — exhaust direction)
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(vx, VEHICLE_Y);
        ctx.lineTo(vx - arrowLen, VEHICLE_Y);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(vx - arrowLen - 8, VEHICLE_Y);
        ctx.lineTo(vx - arrowLen, VEHICLE_Y - 5);
        ctx.lineTo(vx - arrowLen, VEHICLE_Y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fdba74';
        ctx.fillText('ACTION', vx - arrowLen / 2, VEHICLE_Y - 10);

        // Reaction arrow (forward — vehicle direction)
        const reactionLen = canThrust ? arrowLen : 0;
        if (reactionLen > 0) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(vx + VEHICLE_W, VEHICLE_Y);
          ctx.lineTo(vx + VEHICLE_W + reactionLen, VEHICLE_Y);
          ctx.stroke();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(vx + VEHICLE_W + reactionLen + 8, VEHICLE_Y);
          ctx.lineTo(vx + VEHICLE_W + reactionLen, VEHICLE_Y - 5);
          ctx.lineTo(vx + VEHICLE_W + reactionLen, VEHICLE_Y + 5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#86efac';
          ctx.fillText('REACTION', vx + VEHICLE_W + reactionLen / 2, VEHICLE_Y - 10);
        }

        // "NO THRUST" warning when propulsion can't work
        if (!canThrust && thr > 0.1) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('NO THRUST!', sim.vehicleX, VEHICLE_Y - 35);
          ctx.font = '10px monospace';
          ctx.fillStyle = '#fca5a5';
          ctx.fillText(`${pDef.label} needs a medium to push against!`, sim.vehicleX, VEHICLE_Y - 22);
        }
      }

      // Speed gauge (bottom right)
      const gx = CW - 120, gy = CH - 50;
      ctx.fillStyle = 'rgba(30,41,59,0.6)';
      ctx.fillRect(gx, gy, 110, 40);
      ctx.strokeStyle = 'rgba(148,163,184,0.2)';
      ctx.strokeRect(gx, gy, 110, 40);
      ctx.fillStyle = speed > 50 ? '#22d3ee' : '#94a3b8';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${speed}`, gx + 40, gy + 26);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('km/h', gx + 40, gy + 37);

      // Thrust gauge
      ctx.fillStyle = thrustDisplay > 0 ? pDef.color : '#475569';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${thrustDisplay}%`, gx + 85, gy + 26);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('thrust', gx + 85, gy + 37);

      ctx.textAlign = 'start';

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propulsion, medium]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="rounded-xl w-full"
      style={{ maxWidth: CW, imageRendering: 'auto' }}
    />
  );
};

// ============================================================================
// Main Component: PropulsionLab
// ============================================================================

const PROPULSION_TYPES: PropulsionType[] = ['jet', 'rocket', 'propeller', 'sail'];
const MEDIUM_TYPES: MediumType[] = ['air', 'water', 'vacuum'];

const PropulsionLab: React.FC<{ data: PropulsionLabData; className?: string }> = ({ data, className }) => {
  const {
    title, description, overview, gradeBand = '1-2',
    challenges: dataChallenges, propulsionFacts, mediumFacts,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const challenges = dataChallenges && dataChallenges.length > 0 ? dataChallenges : DEFAULT_CHALLENGES;

  // ---- State ----
  const [propulsion, setPropulsion] = useState<PropulsionType>('jet');
  const [medium, setMedium] = useState<MediumType>('air');
  const [throttle, setThrottle] = useState(30);
  const [speed, setSpeed] = useState(0);
  const [thrustDisplay, setThrustDisplay] = useState(0);
  const [exploredCombos, setExploredCombos] = useState<Set<string>>(new Set(['jet-air']));
  const [noThrustMoments, setNoThrustMoments] = useState(0);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [challengeResults, setChallengeResults] = useState<{ id: string; correct: boolean }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  const resolvedInstanceId = instanceId ?? `propulsion-lab-${Date.now()}`;
  const allChallengesDone = challengeResults.length >= challenges.length;
  const pDef = PROPULSION_DEFS[propulsion];

  // ---- Evaluation ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PropulsionLabMetrics>({
    primitiveType: 'propulsion-lab' as any,
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    propulsion, medium, throttle, speed,
    exploredCombos: exploredCombos.size,
    noThrustMoments,
    challengeProgress: `${challengeResults.length}/${challenges.length}`,
  }), [propulsion, medium, throttle, speed, exploredCombos.size, noThrustMoments, challengeResults.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'propulsion-lab' as any,
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'K-2' : '3-5',
  });

  // AI: Activity start
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Student is exploring a living propulsion simulation. `
      + `They can try jet, rocket, propeller, and sail in air, water, or vacuum. `
      + `${overview}. Welcome them and suggest they start by watching what happens when they increase the throttle.`,
      { silent: true },
    );
  }, [isConnected, overview, sendText]);

  // Track combos explored
  const trackCombo = useCallback((p: PropulsionType, m: MediumType) => {
    const key = `${p}-${m}`;
    setExploredCombos(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // ---- Handlers ----
  const handlePropulsionChange = useCallback((p: PropulsionType) => {
    setPropulsion(p);
    trackCombo(p, medium);
    const def = PROPULSION_DEFS[p];
    if (isConnected) {
      sendText(
        `[PROPULSION_CHANGED] Student switched to ${def.label}. `
        + `Self-contained: ${def.selfContained}. ${def.pushesAgainst}. `
        + `Ask what they expect to see differently.`,
        { silent: true },
      );
    }
  }, [medium, isConnected, sendText, trackCombo]);

  const handleMediumChange = useCallback((m: MediumType) => {
    setMedium(m);
    trackCombo(propulsion, m);
    const mDef = MEDIUM_DEFS[m];
    if (isConnected) {
      sendText(
        `[MEDIUM_CHANGED] Student switched to ${mDef.label} (${mDef.particleDensity} particles). `
        + `Current propulsion: ${pDef.label} (self-contained: ${pDef.selfContained}). `
        + `${m === 'vacuum' && !pDef.selfContained ? 'THIS WON\'T WORK — guide them to discover why!' : 'Ask them to watch the particles.'}`,
        { silent: true },
      );
    }
  }, [propulsion, pDef, isConnected, sendText, trackCombo]);

  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleThrottleChange = useCallback((val: number) => {
    setThrottle(val);
    if (throttleTimeoutRef.current) clearTimeout(throttleTimeoutRef.current);
    throttleTimeoutRef.current = setTimeout(() => {
      if (isConnected && val > 50) {
        sendText(
          `[THROTTLE_HIGH] Throttle at ${val}%. Watch the exhaust particles and force arrows!`,
          { silent: true },
        );
      }
    }, 1000);
  }, [isConnected, sendText]);

  const simCallbacks = useMemo<SimCallbacks>(() => ({
    onSpeed: setSpeed,
    onThrust: setThrustDisplay,
    onNoThrust: () => {
      setNoThrustMoments(c => c + 1);
      if (isConnected) {
        sendText(
          `[NO_THRUST] ${pDef.label} can't produce thrust in ${MEDIUM_DEFS[medium].label}! `
          + `It needs a medium to push against, but there are no particles. `
          + `Ask the student: "Why do you think nothing is happening? What's missing?"`,
          { silent: true },
        );
      }
    },
  }), [isConnected, sendText, pDef.label, medium]);

  // Challenge handler
  const handleAnswer = useCallback((optionId: string) => {
    if (answerFeedback) return;
    setSelectedAnswer(optionId);
    const challenge = challenges[currentChallengeIdx];
    const correct = optionId === challenge.correctOptionId;
    setAnswerFeedback(correct ? 'correct' : 'incorrect');

    if (correct) {
      setChallengeResults(prev => [...prev, { id: challenge.id, correct: true }]);
      if (isConnected) {
        sendText(
          `[CHALLENGE_CORRECT] "${challenge.instruction}" — correct! Celebrate and connect to the simulation.`,
          { silent: true },
        );
      }
      setTimeout(() => {
        setCurrentChallengeIdx(i => i + 1);
        setSelectedAnswer(null);
        setAnswerFeedback(null);
        setShowHint(false);
      }, 1500);
    } else {
      setShowHint(true);
      if (isConnected) {
        sendText(
          `[CHALLENGE_INCORRECT] Student got "${challenge.instruction}" wrong. Hint: ${challenge.hint}. Guide gently.`,
          { silent: true },
        );
      }
      setTimeout(() => {
        setSelectedAnswer(null);
        setAnswerFeedback(null);
      }, 2000);
    }
  }, [answerFeedback, challenges, currentChallengeIdx, isConnected, sendText]);

  // Submit evaluation
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const combosExplored = exploredCombos.size;
    const triedVacuumNoThrust = noThrustMoments > 0;

    const metrics: PropulsionLabMetrics = {
      type: 'propulsion-lab',
      combinationsExplored: combosExplored,
      combinationsTotal: PROPULSION_TYPES.length * MEDIUM_TYPES.length,
      challengesCompleted: challengeResults.length,
      challengesCorrect: correctCount,
      challengesTotal: challenges.length,
      noThrustDiscoveries: noThrustMoments,
      vacuumExperimentDone: triedVacuumNoThrust,
      attemptsCount: 1,
    };

    const score =
      (combosExplored / (PROPULSION_TYPES.length * MEDIUM_TYPES.length)) * 25 +
      (triedVacuumNoThrust ? 25 : 5) +
      (correctCount / Math.max(challenges.length, 1)) * 50;

    submitEvaluation(score >= 40, Math.round(score), metrics, { propulsion });

    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Score: ${Math.round(score)}%. Combos explored: ${combosExplored}. `
        + `Challenges: ${correctCount}/${challenges.length}. Vacuum discovery: ${triedVacuumNoThrust}. `
        + `Celebrate and summarize Newton's Third Law — every action has an equal and opposite reaction!`,
        { silent: true },
      );
    }
  }, [hasSubmittedEvaluation, challengeResults, exploredCombos.size, noThrustMoments, challenges.length, propulsion, submitEvaluation, isConnected, sendText]);

  const currentChallenge = challenges[currentChallengeIdx];

  // ---- Render ----
  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border border-violet-500/30 shadow-lg">
          <span className="text-2xl">{pDef.emoji}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            <p className="text-xs text-violet-400 font-mono uppercase tracking-wider">
              Living Newton&apos;s Third Law
            </p>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-lg">Propulsion Lab</CardTitle>
              <p className="text-slate-400 text-sm mt-1">{overview}</p>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
              Grades {gradeBand}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Simulation Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
            <PropulsionSimulation
              propulsion={propulsion}
              medium={medium}
              throttle={throttle}
              callbacks={simCallbacks}
            />
            {exploredCombos.size <= 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/10">
                <p className="text-slate-400 text-xs">Try different propulsion types and mediums!</p>
              </div>
            )}
          </div>

          {/* Controls: Propulsion Type */}
          <div className="space-y-3">
            <label className="text-slate-400 text-xs font-mono uppercase tracking-wider block">
              Propulsion Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROPULSION_TYPES.map(p => {
                const def = PROPULSION_DEFS[p];
                return (
                  <Button key={p} variant="ghost" size="sm"
                    onClick={() => handlePropulsionChange(p)}
                    className={`${propulsion === p
                      ? 'bg-white/15 ring-1 ring-white/30 text-white'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-1.5">{def.emoji}</span> {def.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 italic">{pDef.pushesAgainst}</p>
          </div>

          {/* Controls: Medium */}
          <div className="space-y-3">
            <label className="text-slate-400 text-xs font-mono uppercase tracking-wider block">
              Environment
            </label>
            <div className="flex gap-2 flex-wrap">
              {MEDIUM_TYPES.map(m => {
                const def = MEDIUM_DEFS[m];
                return (
                  <Button key={m} variant="ghost" size="sm"
                    onClick={() => handleMediumChange(m)}
                    className={`${medium === m
                      ? 'bg-white/15 ring-1 ring-white/30 text-white'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {def.label}
                    <span className="ml-1.5 text-xs opacity-50">
                      ({def.particleDensity === 0 ? 'empty' : `${def.particleDensity} particles`})
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Throttle Slider */}
          <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
              Throttle
            </label>
            <input
              type="range" min={0} max={100} value={throttle}
              onChange={e => handleThrottleChange(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-slate-500 text-xs">Off</span>
              <div className="flex gap-4">
                <span className="text-violet-300 text-sm font-mono font-bold">{throttle}%</span>
                <span className="text-slate-500 text-xs">
                  Speed: <span className={speed > 50 ? 'text-cyan-300' : 'text-slate-300'}>{speed} km/h</span>
                </span>
                <span className="text-slate-500 text-xs">
                  Thrust: <span className={thrustDisplay > 0 ? 'text-green-300' : 'text-red-300'}>{thrustDisplay}%</span>
                </span>
              </div>
              <span className="text-slate-500 text-xs">Max</span>
            </div>
          </div>

          {/* Key Insight Cards */}
          {noThrustMoments > 0 && (
            <Card className="backdrop-blur-xl bg-amber-500/5 border-amber-500/20 animate-fade-in">
              <CardContent className="py-4 space-y-2">
                <h4 className="text-amber-200 font-semibold text-sm flex items-center gap-2">
                  <span>&#x1F4A1;</span> Key Discovery!
                </h4>
                <p className="text-slate-300 text-sm">
                  Some propulsion types need a <span className="text-amber-300 font-medium">medium</span> (air, water) to push against.
                  Rockets carry their own propellant, so they work even in vacuum!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Challenges Section */}
          {!showChallenges && !allChallengesDone && (
            <div className="flex justify-center">
              <Button variant="ghost"
                className="bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                onClick={() => setShowChallenges(true)}
              >
                &#x1F9EA; Ready for a Challenge?
              </Button>
            </div>
          )}

          {showChallenges && !allChallengesDone && currentChallenge && (
            <Card className="backdrop-blur-xl bg-purple-500/5 border-purple-500/20 animate-fade-in">
              <CardContent className="py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                    Challenge {currentChallengeIdx + 1} of {challenges.length}
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-xs">
                    {currentChallenge.type}
                  </Badge>
                </div>

                <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentChallenge.options.map(opt => {
                    const isSelected = selectedAnswer === opt.id;
                    const isCorrectOpt = opt.id === currentChallenge.correctOptionId;
                    let optClass = 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10';
                    if (answerFeedback && isSelected) {
                      optClass = answerFeedback === 'correct'
                        ? 'bg-green-500/20 border-green-500/40 text-green-300'
                        : 'bg-red-500/20 border-red-500/40 text-red-300';
                    } else if (answerFeedback === 'correct' && isCorrectOpt) {
                      optClass = 'bg-green-500/20 border-green-500/40 text-green-300';
                    }

                    return (
                      <Button key={opt.id} variant="ghost"
                        className={`border justify-start text-left h-auto py-3 px-4 whitespace-normal break-words min-h-[3rem] ${optClass}`}
                        disabled={!!answerFeedback}
                        onClick={() => handleAnswer(opt.id)}
                      >
                        <span className="mr-2 text-xs font-mono opacity-50 shrink-0">{opt.id.toUpperCase()}</span>
                        <span className="text-sm leading-snug">{opt.text}</span>
                      </Button>
                    );
                  })}
                </div>

                {showHint && (
                  <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 animate-fade-in">
                    <p className="text-amber-200 text-sm">
                      <span className="text-amber-400 font-semibold">Hint: </span>
                      {currentChallenge.hint}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {allChallengesDone && showChallenges && (
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-green-300 text-sm font-medium">
                All challenges complete! {challengeResults.filter(r => r.correct).length}/{challenges.length} correct
              </p>
            </div>
          )}

          {/* Submit */}
          {!hasSubmittedEvaluation && (exploredCombos.size > 1 || challengeResults.length > 0) && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost"
                className="bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20"
                onClick={handleSubmitEvaluation}
              >
                &#x2713; I&apos;m Done Exploring
              </Button>
            </div>
          )}

          {hasSubmittedEvaluation && (
            <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-green-300 text-sm font-medium">
                Exploration complete! You discovered how propulsion works through Newton&apos;s Third Law!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PropulsionLab;
