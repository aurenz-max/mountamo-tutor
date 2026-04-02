'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EngineExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ZoneDescription {
  analogy: string;
  explanation: string;
}

export interface ChallengeOption {
  id: string;
  text: string;
}

export interface EngineChallenge {
  id: string;
  type: 'predict' | 'observe' | 'adjust';
  instruction: string;
  options: ChallengeOption[];
  correctOptionId: string;
  hint: string;
}

export interface EnergyFlow {
  input: string;
  transformations: string[];
  output: string;
  efficiency: string | null;
  losses: string[];
}

export interface EngineExplorerData {
  title: string;
  description: string;
  engineType: string;
  engineName: string;
  vehicleContext: string;
  overview: string;
  gradeBand: '1-2' | '3-5';
  zoneDescriptions?: Record<string, ZoneDescription>;
  challenges?: EngineChallenge[];
  energyFlow?: EnergyFlow;
  observeNarration?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EngineExplorerMetrics>) => void;
}

// ============================================================================
// Engine Layout Constants — Component owns ALL geometry and physics
// ============================================================================

const CW = 640;
const CH = 400;

type ParticlePhase = 'boiler' | 'pipe' | 'chamber' | 'exhaust' | 'condenser';

interface Rect { x: number; y: number; w: number; h: number }

interface ZoneDef {
  id: ParticlePhase;
  name: string;
  bounds: Rect;
}

interface MechanicalDef {
  wheelCx: number;
  wheelCy: number;
  wheelR: number;
  crankR: number;
  rodLength: number;
}

interface EngineLayoutDef {
  zones: ZoneDef[];
  fire: Rect;
  mechanical: MechanicalDef;
  particleCount: number;
  baseColor: string;
  heatedColor: string;
  fuelLabel: string;
}

const STEAM_LAYOUT: EngineLayoutDef = {
  zones: [
    { id: 'boiler', name: 'Boiler', bounds: { x: 40, y: 50, w: 120, h: 180 } },
    { id: 'pipe', name: 'Steam Pipe', bounds: { x: 160, y: 103, w: 90, h: 24 } },
    { id: 'chamber', name: 'Cylinder', bounds: { x: 250, y: 80, w: 180, h: 70 } },
    { id: 'exhaust', name: 'Exhaust', bounds: { x: 370, y: 150, w: 30, h: 110 } },
    { id: 'condenser', name: 'Condenser', bounds: { x: 40, y: 310, w: 360, h: 35 } },
  ],
  fire: { x: 40, y: 240, w: 120, h: 50 },
  mechanical: { wheelCx: 510, wheelCy: 115, wheelR: 55, crankR: 30, rodLength: 160 },
  particleCount: 50,
  baseColor: '#3b82f6',
  heatedColor: '#e2e8f0',
  fuelLabel: 'Coal',
};

const ENGINE_LAYOUTS: Record<string, EngineLayoutDef> = {
  steam: STEAM_LAYOUT,
  piston_4stroke: STEAM_LAYOUT, // TODO: unique layout
  diesel: STEAM_LAYOUT,
  jet_turbofan: STEAM_LAYOUT,
  turboprop: STEAM_LAYOUT,
  electric_motor: STEAM_LAYOUT,
  rocket: STEAM_LAYOUT,
};

const DEFAULT_ZONE_DESCS: Record<string, ZoneDescription> = {
  boiler: { analogy: 'Like a giant kettle on a stove', explanation: 'Water is heated by burning coal until it becomes steam' },
  pipe: { analogy: 'Like a hallway the steam rushes through', explanation: 'Steam travels from the boiler to the cylinder' },
  chamber: { analogy: 'Like blowing up a balloon inside a tube', explanation: 'Steam pressure pushes the piston back and forth' },
  exhaust: { analogy: 'Like opening a window to let steam out', explanation: 'Used steam exits after pushing the piston' },
  condenser: { analogy: 'Like breathing on a cold window', explanation: 'Steam cools back into water to be reused' },
};

const DEFAULT_CHALLENGES: EngineChallenge[] = [
  {
    id: 'ch1', type: 'predict',
    instruction: 'What happens to the particles in the boiler when you add more coal?',
    options: [
      { id: 'a', text: 'They slow down and clump together' },
      { id: 'b', text: 'They speed up and spread apart' },
      { id: 'c', text: 'They stay the same' },
      { id: 'd', text: 'They disappear' },
    ],
    correctOptionId: 'b',
    hint: 'Think about what happens to water when you heat it on the stove...',
  },
  {
    id: 'ch2', type: 'observe',
    instruction: 'Watch the particles carefully. What color are they when they are hot steam vs. cool water?',
    options: [
      { id: 'a', text: 'Red when hot, green when cool' },
      { id: 'b', text: 'White when hot, blue when cool' },
      { id: 'c', text: 'Yellow when hot, red when cool' },
      { id: 'd', text: 'They stay the same color' },
    ],
    correctOptionId: 'b',
    hint: 'Look at the particles in the boiler vs. the condenser...',
  },
  {
    id: 'ch3', type: 'adjust',
    instruction: 'Try adding a heavy load to the wheel. What does the engine need to keep going?',
    options: [
      { id: 'a', text: 'Less fuel — the load helps push' },
      { id: 'b', text: 'More fuel — more steam pressure is needed' },
      { id: 'c', text: 'The same fuel — load doesn\'t matter' },
      { id: 'd', text: 'The engine stops no matter what' },
    ],
    correctOptionId: 'b',
    hint: 'Try increasing the coal when the load is heavy. Does the wheel speed up?',
  },
];

// ============================================================================
// Particle Physics
// ============================================================================

interface EngineParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  phase: ParticlePhase;
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const cr = Math.round(ar + (br - ar) * t);
  const cg = Math.round(ag + (bg - ag) * t);
  const cb = Math.round(ab + (bb - ab) * t);
  return `rgb(${cr},${cg},${cb})`;
}

function sliderCrankX(angle: number, m: MechanicalDef): number {
  const sinA = Math.sin(angle);
  return m.wheelCx + m.crankR * Math.cos(angle) -
    Math.sqrt(Math.max(0, m.rodLength * m.rodLength - m.crankR * m.crankR * sinA * sinA));
}

// ============================================================================
// Canvas Sub-component: EngineSimulation
// ============================================================================

interface SimCallbacks {
  onPressure: (p: number) => void;
  onRPM: (rpm: number) => void;
  onStall: () => void;
}

const EngineSimulation: React.FC<{
  layout: EngineLayoutDef;
  fuel: number;
  load: number;
  selectedZone: string | null;
  onZoneClick: (zoneId: string) => void;
  callbacks: SimCallbacks;
}> = ({ layout, fuel, load, selectedZone, onZoneClick, callbacks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<EngineParticle[]>([]);
  const simRef = useRef({ wheelAngle: 0, wheelSpeed: 0, pressure: 0, wasStalled: false });
  const animRef = useRef<number>(0);

  // Use refs for values that change every frame to avoid restarting animation loop
  const fuelRef = useRef(fuel);
  const loadRef = useRef(load);
  const selectedZoneRef = useRef(selectedZone);
  const callbacksRef = useRef(callbacks);
  useEffect(() => { fuelRef.current = fuel; }, [fuel]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { selectedZoneRef.current = selectedZone; }, [selectedZone]);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  const m = layout.mechanical;

  // Initialize particles in the boiler
  useEffect(() => {
    const b = layout.zones.find(z => z.id === 'boiler')!.bounds;
    particlesRef.current = Array.from({ length: layout.particleCount }, () => ({
      x: b.x + 10 + Math.random() * (b.w - 20),
      y: b.y + 10 + Math.random() * (b.h - 20),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      energy: Math.random() * 0.15,
      phase: 'boiler' as ParticlePhase,
    }));
    simRef.current = { wheelAngle: 0, wheelSpeed: 0, pressure: 0, wasStalled: false };
  }, [layout]);

  // Main animation loop — runs once, reads refs for dynamic values
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const zoneBounds: Record<ParticlePhase, Rect> = {} as Record<ParticlePhase, Rect>;
    layout.zones.forEach(z => { zoneBounds[z.id] = z.bounds; });

    const PISTON_W = 14;

    const animate = () => {
      const sim = simRef.current;
      const particles = particlesRef.current;
      const fuelNorm = fuelRef.current / 100;
      const loadNorm = loadRef.current / 100;
      const selZone = selectedZoneRef.current;
      const cbs = callbacksRef.current;

      const pistonX = sliderCrankX(sim.wheelAngle, m);

      // ======== UPDATE PARTICLES ========
      let instantPressure = 0;

      for (const p of particles) {
        const bounds = zoneBounds[p.phase];
        if (!bounds) continue;

        switch (p.phase) {
          case 'boiler': {
            p.energy = Math.min(1, p.energy + fuelNorm * 0.004);
            const spd = 0.3 + p.energy * 2;
            p.vx += (Math.random() - 0.5) * spd * 0.3;
            p.vy += (Math.random() - 0.5) * spd * 0.3;
            p.vx *= 0.96; p.vy *= 0.96;
            if (p.energy < 0.4) p.vy += 0.05; // gravity for liquid
            p.x += p.vx; p.y += p.vy;
            // Walls
            if (p.x < bounds.x + 5) { p.x = bounds.x + 5; p.vx = Math.abs(p.vx); }
            if (p.x > bounds.x + bounds.w - 5) { p.x = bounds.x + bounds.w - 5; p.vx = -Math.abs(p.vx); }
            if (p.y < bounds.y + 5) { p.y = bounds.y + 5; p.vy = Math.abs(p.vy); }
            if (p.y > bounds.y + bounds.h - 5) { p.y = bounds.y + bounds.h - 5; p.vy = -Math.abs(p.vy); }
            // Transition: boiler → pipe (high energy particles near top)
            if (p.energy > 0.45 && p.y < bounds.y + 50 && Math.random() < 0.035) {
              p.phase = 'pipe';
              const pb = zoneBounds.pipe;
              p.x = pb.x + 5;
              p.y = pb.y + pb.h / 2 + (Math.random() - 0.5) * 8;
              p.vx = 2; p.vy = 0;
            }
            break;
          }
          case 'pipe': {
            p.vx = 2 + p.energy * 2.5;
            p.vy = (Math.random() - 0.5) * 0.3;
            p.x += p.vx; p.y += p.vy;
            if (p.y < bounds.y + 3) { p.y = bounds.y + 3; p.vy = Math.abs(p.vy); }
            if (p.y > bounds.y + bounds.h - 3) { p.y = bounds.y + bounds.h - 3; p.vy = -Math.abs(p.vy); }
            // Transition: pipe → chamber
            if (p.x > bounds.x + bounds.w - 3) {
              p.phase = 'chamber';
              const cb = zoneBounds.chamber;
              p.x = cb.x + 8;
              p.y = cb.y + 10 + Math.random() * (cb.h - 20);
              p.vx = 1.5; p.vy = (Math.random() - 0.5) * 0.5;
            }
            break;
          }
          case 'chamber': {
            // Steam pressure pushes particles TOWARD the piston (rightward bias)
            const spd = 0.5 + p.energy * 1.5;
            p.vx += 0.15 + (Math.random() - 0.3) * spd * 0.4;
            p.vy += (Math.random() - 0.5) * spd * 0.3;
            p.vx *= 0.96; p.vy *= 0.96;
            p.x += p.vx; p.y += p.vy;
            // Left wall
            if (p.x < bounds.x + 5) { p.x = bounds.x + 5; p.vx = Math.abs(p.vx); }
            // Piston face — bouncing off drives pressure
            if (p.x > pistonX - 5) {
              p.x = pistonX - 5;
              p.vx = -Math.abs(p.vx) * 0.8;
              instantPressure += p.energy;
            }
            // Top/bottom
            if (p.y < bounds.y + 5) { p.y = bounds.y + 5; p.vy = Math.abs(p.vy); }
            if (p.y > bounds.y + bounds.h - 5) { p.y = bounds.y + bounds.h - 5; p.vy = -Math.abs(p.vy); }
            // Transition: chamber → exhaust
            if (p.x > pistonX - 25 && Math.random() < 0.012) {
              p.phase = 'exhaust';
              const eb = zoneBounds.exhaust;
              p.x = eb.x + eb.w / 2 + (Math.random() - 0.5) * 8;
              p.y = eb.y + 5;
              p.vx = 0; p.vy = 1;
              p.energy *= 0.9;
            }
            break;
          }
          case 'exhaust': {
            p.vy = 1 + p.energy * 0.5;
            p.vx = (Math.random() - 0.5) * 0.3;
            p.x += p.vx; p.y += p.vy;
            p.energy = Math.max(0, p.energy - 0.005);
            if (p.x < bounds.x + 3) { p.x = bounds.x + 3; p.vx = Math.abs(p.vx); }
            if (p.x > bounds.x + bounds.w - 3) { p.x = bounds.x + bounds.w - 3; p.vx = -Math.abs(p.vx); }
            // Transition: exhaust → condenser
            if (p.y > bounds.y + bounds.h - 5) {
              p.phase = 'condenser';
              const cb = zoneBounds.condenser;
              p.x = cb.x + cb.w - 20 + (Math.random() - 0.5) * 10;
              p.y = cb.y + cb.h / 2 + (Math.random() - 0.5) * 8;
              p.vx = -1; p.vy = 0;
            }
            break;
          }
          case 'condenser': {
            p.energy = Math.max(0, p.energy - 0.008);
            const spd = 0.5 + p.energy * 0.8;
            p.vx = -spd - 0.5;
            p.vy = (Math.random() - 0.5) * 0.2;
            p.x += p.vx; p.y += p.vy;
            if (p.y < bounds.y + 3) { p.y = bounds.y + 3; p.vy = Math.abs(p.vy); }
            if (p.y > bounds.y + bounds.h - 3) { p.y = bounds.y + bounds.h - 3; p.vy = -Math.abs(p.vy); }
            // Transition: condenser → boiler (recycled water)
            if (p.x < bounds.x + 25 && p.energy < 0.3) {
              p.phase = 'boiler';
              const bb = zoneBounds.boiler;
              p.x = bb.x + 10 + Math.random() * 20;
              p.y = bb.y + bb.h - 20 + Math.random() * 10;
              p.vx = (Math.random() - 0.5) * 0.5;
              p.vy = -Math.random() * 0.5;
            }
            break;
          }
        }
      }

      // ======== UPDATE MECHANICAL ========
      sim.pressure = sim.pressure * 0.85 + instantPressure * 0.15;
      const torque = sim.pressure * 0.008 * (0.3 + fuelNorm * 0.7) - loadNorm * 0.006 - 0.0005;
      sim.wheelSpeed = Math.max(0, sim.wheelSpeed + torque);
      sim.wheelSpeed *= 0.997;
      sim.wheelAngle += sim.wheelSpeed;

      const rpm = Math.round(sim.wheelSpeed * 600);
      cbs.onPressure(sim.pressure);
      cbs.onRPM(rpm);

      // Stall detection
      if (rpm < 5 && fuelNorm > 0.1 && loadNorm > 0.3 && !sim.wasStalled) {
        sim.wasStalled = true;
        cbs.onStall();
      }
      if (rpm > 30) sim.wasStalled = false;

      // ======== DRAW ========
      ctx.clearRect(0, 0, CW, CH);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // --- Draw zones ---
      for (const zone of layout.zones) {
        const b = zone.bounds;
        const isSel = zone.id === selZone;
        const r = 6;

        ctx.beginPath();
        ctx.moveTo(b.x + r, b.y);
        ctx.lineTo(b.x + b.w - r, b.y);
        ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + r, r);
        ctx.lineTo(b.x + b.w, b.y + b.h - r);
        ctx.arcTo(b.x + b.w, b.y + b.h, b.x + b.w - r, b.y + b.h, r);
        ctx.lineTo(b.x + r, b.y + b.h);
        ctx.arcTo(b.x, b.y + b.h, b.x, b.y + b.h - r, r);
        ctx.lineTo(b.x, b.y + r);
        ctx.arcTo(b.x, b.y, b.x + r, b.y, r);
        ctx.closePath();

        ctx.fillStyle = zone.id === 'boiler' ? 'rgba(30,58,95,0.3)'
          : zone.id === 'condenser' ? 'rgba(30,58,95,0.2)'
          : 'rgba(30,41,59,0.3)';
        ctx.fill();

        if (isSel) { ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12; }
        ctx.strokeStyle = isSel ? '#22d3ee' : 'rgba(148,163,184,0.2)';
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isSel ? '#22d3ee' : '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(zone.name, b.x + 6, b.y + 14);
      }

      // --- Draw fire ---
      const fire = layout.fire;
      ctx.fillStyle = 'rgba(69,26,3,0.4)';
      ctx.fillRect(fire.x, fire.y, fire.w, fire.h);
      const fireN = Math.floor(3 + fuelNorm * 12);
      for (let i = 0; i < fireN; i++) {
        const fx = fire.x + 10 + Math.random() * (fire.w - 20);
        const fy = fire.y + Math.random() * fire.h;
        const fr = 2 + Math.random() * (2 + fuelNorm * 3);
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${15 + Math.random() * 30},100%,${45 + Math.random() * 25}%)`;
        ctx.fill();
      }
      ctx.fillStyle = '#92400e';
      ctx.font = '9px monospace';
      ctx.fillText('Fire', fire.x + 6, fire.y + 14);

      // --- Draw connecting pipes (dashed lines) ---
      ctx.strokeStyle = 'rgba(100,116,139,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);

      // Boiler → Pipe
      const bb = zoneBounds.boiler;
      const pb = zoneBounds.pipe;
      ctx.beginPath();
      ctx.moveTo(bb.x + bb.w, pb.y + pb.h / 2);
      ctx.lineTo(pb.x, pb.y + pb.h / 2);
      ctx.stroke();

      // Chamber → Exhaust
      const chb = zoneBounds.chamber;
      const eb = zoneBounds.exhaust;
      ctx.beginPath();
      ctx.moveTo(eb.x + eb.w / 2, chb.y + chb.h);
      ctx.lineTo(eb.x + eb.w / 2, eb.y);
      ctx.stroke();

      // Exhaust → Condenser
      const cob = zoneBounds.condenser;
      ctx.beginPath();
      ctx.moveTo(eb.x + eb.w / 2, eb.y + eb.h);
      ctx.lineTo(eb.x + eb.w / 2, cob.y);
      ctx.stroke();

      // Condenser → Boiler (return path)
      ctx.beginPath();
      ctx.moveTo(cob.x + 30, cob.y + cob.h / 2);
      ctx.lineTo(bb.x + bb.w / 2, cob.y + cob.h / 2);
      ctx.lineTo(bb.x + bb.w / 2, bb.y + bb.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // --- Draw water level in boiler ---
      const boilerParticles = particles.filter(p => p.phase === 'boiler').length;
      const waterLevel = Math.min(1, boilerParticles / (layout.particleCount * 0.6));
      const waterH = bb.h * waterLevel * 0.6;
      if (waterH > 2) {
        ctx.fillStyle = 'rgba(59,130,246,0.12)';
        ctx.fillRect(bb.x + 2, bb.y + bb.h - waterH, bb.w - 4, waterH);
      }

      // --- Draw piston ---
      const curPistonX = sliderCrankX(sim.wheelAngle, m);
      const pistonH = chb.h - 10;
      const pistonY = chb.y + 5;
      const pistonGrad = ctx.createLinearGradient(curPistonX, pistonY, curPistonX + PISTON_W, pistonY);
      pistonGrad.addColorStop(0, '#475569');
      pistonGrad.addColorStop(0.5, '#64748b');
      pistonGrad.addColorStop(1, '#475569');
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(curPistonX, pistonY, PISTON_W, pistonH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(curPistonX, pistonY, PISTON_W, pistonH);

      // --- Draw connecting rod ---
      const pinX = m.wheelCx + m.crankR * Math.cos(sim.wheelAngle);
      const pinY = m.wheelCy + m.crankR * Math.sin(sim.wheelAngle);
      ctx.beginPath();
      ctx.moveTo(curPistonX + PISTON_W / 2, m.wheelCy);
      ctx.lineTo(pinX, pinY);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pin joints
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(curPistonX + PISTON_W / 2, m.wheelCy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pinX, pinY, 4, 0, Math.PI * 2);
      ctx.fill();

      // --- Draw wheel ---
      // Outer rim
      ctx.beginPath();
      ctx.arc(m.wheelCx, m.wheelCy, m.wheelR, 0, Math.PI * 2);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Inner rim
      ctx.beginPath();
      ctx.arc(m.wheelCx, m.wheelCy, m.wheelR - 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,116,139,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Hub
      ctx.beginPath();
      ctx.arc(m.wheelCx, m.wheelCy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Spokes
      for (let i = 0; i < 6; i++) {
        const a = sim.wheelAngle + (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(m.wheelCx + 8 * Math.cos(a), m.wheelCy + 8 * Math.sin(a));
        ctx.lineTo(m.wheelCx + (m.wheelR - 7) * Math.cos(a), m.wheelCy + (m.wheelR - 7) * Math.sin(a));
        ctx.strokeStyle = 'rgba(148,163,184,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Crank pin glow
      ctx.beginPath();
      ctx.arc(pinX, pinY, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34,211,238,0.35)';
      ctx.fill();

      // Wheel label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Drive Wheel', m.wheelCx, m.wheelCy + m.wheelR + 16);

      // --- Draw particles ---
      for (const p of particles) {
        const color = lerpColor(layout.baseColor, layout.heatedColor, p.energy);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        if (p.energy > 0.6) {
          ctx.shadowColor = layout.heatedColor;
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // --- Pressure gauge ---
      const gx = 605, gy = 220, gw = 14, gh = 100;
      ctx.fillStyle = 'rgba(30,41,59,0.5)';
      ctx.fillRect(gx, gy, gw, gh);
      const pPct = Math.min(1, sim.pressure / 15);
      const pCol = pPct > 0.7 ? '#ef4444' : pPct > 0.4 ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = pCol;
      ctx.fillRect(gx, gy + gh * (1 - pPct), gw, gh * pPct);
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PSI', gx + gw / 2, gy - 5);

      // --- RPM display ---
      ctx.fillStyle = rpm > 200 ? '#22d3ee' : '#94a3b8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${rpm}`, m.wheelCx, m.wheelCy + m.wheelR + 32);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('RPM', m.wheelCx, m.wheelCy + m.wheelR + 44);

      ctx.textAlign = 'start';

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [layout, m]);

  // Canvas click handler with coordinate mapping
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const zone of layout.zones) {
      const b = zone.bounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        onZoneClick(zone.id);
        return;
      }
    }
    onZoneClick('');
  }, [layout.zones, onZoneClick]);

  const handleTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const x = (e.touches[0].clientX - rect.left) * scaleX;
    const y = (e.touches[0].clientY - rect.top) * scaleY;

    for (const zone of layout.zones) {
      const b = zone.bounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        onZoneClick(zone.id);
        return;
      }
    }
    onZoneClick('');
  }, [layout.zones, onZoneClick]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onClick={handleClick}
      onTouchStart={handleTouch}
      className="rounded-xl cursor-pointer w-full"
      style={{ maxWidth: CW, imageRendering: 'auto' }}
    />
  );
};

// ============================================================================
// Main Component: EngineExplorer
// ============================================================================

interface EngineExplorerProps {
  data: EngineExplorerData;
  className?: string;
}

const ENGINE_TYPE_ICONS: Record<string, string> = {
  steam: '🚂', piston_4stroke: '🚗', diesel: '🚛', jet_turbofan: '✈️',
  turboprop: '🛩️', electric_motor: '⚡', rocket: '🚀',
};

const EngineExplorer: React.FC<EngineExplorerProps> = ({ data, className }) => {
  const {
    title, description, engineType = 'steam', engineName, vehicleContext,
    overview, gradeBand = '1-2',
    zoneDescriptions, challenges: dataChallenges, energyFlow, observeNarration,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  // Resolve layout — hardcoded per engine type
  const layout = ENGINE_LAYOUTS[engineType] || STEAM_LAYOUT;
  const zoneDescs = useMemo(() => ({ ...DEFAULT_ZONE_DESCS, ...zoneDescriptions }), [zoneDescriptions]);
  const challenges = dataChallenges && dataChallenges.length > 0 ? dataChallenges : DEFAULT_CHALLENGES;

  // ---- State ----
  const [fuel, setFuel] = useState(30);
  const [load, setLoad] = useState(10);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [exploredZones, setExploredZones] = useState<Set<string>>(new Set());
  const [showEnergyFlow, setShowEnergyFlow] = useState(false);
  const [pressure, setPressure] = useState(0);
  const [rpm, setRPM] = useState(0);
  const [fuelAdjustCount, setFuelAdjustCount] = useState(0);
  const [loadAdjustCount, setLoadAdjustCount] = useState(0);
  const [stallCount, setStallCount] = useState(0);
  const [peakRPM, setPeakRPM] = useState(0);
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [challengeResults, setChallengeResults] = useState<{ id: string; correct: boolean }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const resolvedInstanceId = instanceId ?? `engine-explorer-${Date.now()}`;
  const allChallengesDone = challengeResults.length >= challenges.length;

  // Track peak RPM
  useEffect(() => {
    if (rpm > peakRPM) setPeakRPM(rpm);
  }, [rpm, peakRPM]);

  // ---- Evaluation ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EngineExplorerMetrics>({
    primitiveType: 'engine-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    engineType, engineName, vehicleContext,
    fuelLevel: fuel, loadLevel: load, wheelRPM: rpm,
    zonesExplored: Array.from(exploredZones).join(', '),
    challengeProgress: `${challengeResults.length}/${challenges.length}`,
    selectedZone: selectedZone || 'none',
  }), [engineType, engineName, vehicleContext, fuel, load, rpm, exploredZones, challengeResults.length, challenges.length, selectedZone]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'engine-explorer',
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
      `[ACTIVITY_START] Student is exploring a living ${engineName} (${engineType}) simulation. `
      + `Vehicle context: ${vehicleContext}. Grade band: ${gradeBand}. `
      + `${observeNarration || overview}. `
      + `Welcome them and point out the particles in the boiler — ask what they think will happen when coal is added.`,
      { silent: true },
    );
  }, [isConnected, engineName, engineType, vehicleContext, gradeBand, observeNarration, overview, sendText]);

  // ---- Handlers ----
  const handleZoneClick = useCallback((zoneId: string) => {
    if (!zoneId) { setSelectedZone(null); return; }
    setSelectedZone(zoneId);
    setExploredZones(prev => {
      const next = new Set(prev);
      const isNew = !next.has(zoneId);
      next.add(zoneId);
      if (isNew && isConnected) {
        const desc = zoneDescs[zoneId];
        sendText(
          `[ZONE_EXPLORED] Student tapped "${zoneId}". `
          + `Explanation: ${desc?.explanation || 'N/A'}. Analogy: ${desc?.analogy || 'N/A'}. `
          + `They've explored ${next.size}/${layout.zones.length} zones. `
          + `Explain what this part does using the analogy. Ask what connects to it.`,
          { silent: true },
        );
      }
      return next;
    });
  }, [isConnected, zoneDescs, layout.zones.length, sendText]);

  const fuelTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleFuelChange = useCallback((val: number) => {
    setFuel(val);
    // Debounced AI trigger
    if (fuelTimeoutRef.current) clearTimeout(fuelTimeoutRef.current);
    fuelTimeoutRef.current = setTimeout(() => {
      setFuelAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[FUEL_CHANGED] Student set fuel to ${val}%. `
          + `Ask them to watch what happens to the particles and the wheel speed.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, sendText]);

  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleLoadChange = useCallback((val: number) => {
    setLoad(val);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setLoadAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[LOAD_CHANGED] Student set load to ${val}%. `
          + `Ask what happens to the engine when the load increases.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, sendText]);

  const simCallbacks = useMemo<SimCallbacks>(() => ({
    onPressure: setPressure,
    onRPM: setRPM,
    onStall: () => {
      setStallCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[ENGINE_STALLED] The engine stalled! Load is too heavy or fuel too low. `
          + `Ask the student what they could do to get it going again.`,
          { silent: true },
        );
      }
    },
  }), [isConnected, sendText]);

  // Challenge answer handler
  const handleAnswer = useCallback((optionId: string) => {
    if (answerFeedback) return; // already answered
    setSelectedAnswer(optionId);
    const challenge = challenges[currentChallengeIdx];
    const correct = optionId === challenge.correctOptionId;
    setAnswerFeedback(correct ? 'correct' : 'incorrect');

    if (correct) {
      setChallengeResults(prev => [...prev, { id: challenge.id, correct: true }]);
      if (isConnected) {
        sendText(
          `[CHALLENGE_CORRECT] Student answered "${challenge.instruction}" correctly! `
          + `Celebrate briefly and connect to what they can see in the simulation.`,
          { silent: true },
        );
      }
      // Auto-advance after 1.5s
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
          `[CHALLENGE_INCORRECT] Student got "${challenge.instruction}" wrong (chose "${optionId}"). `
          + `Hint: ${challenge.hint}. Guide them gently without giving the answer.`,
          { silent: true },
        );
      }
      // Allow retry after 2s
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
    const metrics: EngineExplorerMetrics = {
      type: 'engine-explorer',
      zonesExplored: exploredZones.size,
      zonesTotal: layout.zones.length,
      fuelAdjustments: fuelAdjustCount,
      loadExperiments: loadAdjustCount,
      challengesCompleted: challengeResults.length,
      challengesCorrect: correctCount,
      challengesTotal: challenges.length,
      peakRPMReached: peakRPM,
      engineStalledCount: stallCount,
      attemptsCount: 1,
    };
    const score =
      (exploredZones.size / Math.max(layout.zones.length, 1)) * 15 +
      (Math.min(fuelAdjustCount + loadAdjustCount, 5) / 5) * 15 +
      (showEnergyFlow ? 20 : 10) +
      (correctCount / Math.max(challenges.length, 1)) * 50;

    submitEvaluation(score >= 40, Math.round(score), metrics, { engineType });

    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Student finished! Score: ${Math.round(score)}%. `
        + `Zones: ${exploredZones.size}/${layout.zones.length}. `
        + `Challenges: ${correctCount}/${challenges.length} correct. Peak RPM: ${peakRPM}. `
        + `Celebrate and summarize what they learned about how ${engineName} works!`,
        { silent: true },
      );
    }
  }, [
    hasSubmittedEvaluation, exploredZones.size, layout.zones.length,
    fuelAdjustCount, loadAdjustCount, showEnergyFlow,
    challengeResults, challenges.length, peakRPM, stallCount,
    engineType, engineName, submitEvaluation, isConnected, sendText,
  ]);

  // ---- Render ----
  const icon = ENGINE_TYPE_ICONS[engineType] || '⚙️';
  const currentChallenge = challenges[currentChallengeIdx];
  const zoneInfo = selectedZone ? zoneDescs[selectedZone] : null;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border border-amber-500/30 shadow-lg">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              Living Engine Lab
            </p>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-lg">{engineName}</CardTitle>
              <p className="text-slate-400 text-sm mt-1">{overview}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {engineType.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {vehicleContext}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Simulation Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
            <EngineSimulation
              layout={layout}
              fuel={fuel}
              load={load}
              selectedZone={selectedZone}
              onZoneClick={handleZoneClick}
              callbacks={simCallbacks}
            />
            {/* Tap hint overlay */}
            {exploredZones.size === 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/10">
                <p className="text-slate-400 text-xs">Tap any zone to learn what it does</p>
              </div>
            )}
          </div>

          {/* Zone Info Card */}
          {zoneInfo && selectedZone && (
            <Card className="backdrop-blur-xl bg-cyan-500/5 border-cyan-500/20 animate-fade-in">
              <CardContent className="py-4 space-y-2">
                <h4 className="text-white font-semibold text-lg">
                  {layout.zones.find(z => z.id === selectedZone)?.name || selectedZone}
                </h4>
                <p className="text-slate-300 text-sm">{zoneInfo.explanation}</p>
                <div className="flex items-start gap-2 mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <span className="text-amber-400 shrink-0">💡</span>
                  <p className="text-amber-200 text-sm italic">{zoneInfo.analogy}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls: Fuel + Load sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                {layout.fuelLabel}
              </label>
              <input
                type="range" min={0} max={100} value={fuel}
                onChange={e => handleFuelChange(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-slate-500 text-xs">None</span>
                <span className="text-amber-300 text-sm font-mono font-bold">{fuel}%</span>
                <span className="text-slate-500 text-xs">Max</span>
              </div>
            </div>

            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                Load
              </label>
              <input
                type="range" min={0} max={100} value={load}
                onChange={e => handleLoadChange(Number(e.target.value))}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-slate-500 text-xs">Light</span>
                <span className="text-red-300 text-sm font-mono font-bold">{load}%</span>
                <span className="text-slate-500 text-xs">Heavy</span>
              </div>
            </div>
          </div>

          {/* Energy Flow (collapsible) */}
          {energyFlow && (
            <div className="space-y-3">
              <Button variant="ghost"
                className="bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10 w-full justify-start"
                onClick={() => {
                  const willShow = !showEnergyFlow;
                  setShowEnergyFlow(willShow);
                  if (willShow && isConnected) {
                    sendText(
                      `[ENERGY_FLOW_VIEWED] Student opened energy flow diagram. `
                      + `${energyFlow.input} → ${energyFlow.transformations.join(' → ')} → ${energyFlow.output}. `
                      + `Walk them through: "See how the energy changes form at each step?"`,
                      { silent: true },
                    );
                  }
                }}
              >
                <span className="mr-2">{showEnergyFlow ? '▼' : '▶'}</span>
                Energy Flow
              </Button>

              {showEnergyFlow && (
                <Card className="backdrop-blur-xl bg-slate-800/30 border-slate-700/50 animate-fade-in">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        {energyFlow.input}
                      </Badge>
                      {energyFlow.transformations.map((t, i) => (
                        <React.Fragment key={i}>
                          <span className="text-slate-500">→</span>
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                            {t}
                          </Badge>
                        </React.Fragment>
                      ))}
                      <span className="text-slate-500">→</span>
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        {energyFlow.output}
                      </Badge>
                    </div>
                    {energyFlow.efficiency && (
                      <p className="text-slate-400 text-sm text-center">
                        Efficiency: <span className="text-amber-300">{energyFlow.efficiency}</span>
                      </p>
                    )}
                    {energyFlow.losses.length > 0 && (
                      <div className="text-center">
                        <p className="text-slate-500 text-xs mb-1">Energy losses:</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                          {energyFlow.losses.map((loss, i) => (
                            <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-xs">
                              {loss}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Challenges Section */}
          {!showChallenges && !allChallengesDone && (
            <div className="flex justify-center">
              <Button variant="ghost"
                className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                onClick={() => setShowChallenges(true)}
              >
                🧪 Ready for a Challenge?
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
          {!hasSubmittedEvaluation && (exploredZones.size > 0 || challengeResults.length > 0) && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost"
                className="bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20"
                onClick={handleSubmitEvaluation}
              >
                ✓ I&apos;m Done Exploring
              </Button>
            </div>
          )}

          {hasSubmittedEvaluation && (
            <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-green-300 text-sm font-medium">
                Exploration complete! Great work learning how the {engineName} works!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EngineExplorer;
