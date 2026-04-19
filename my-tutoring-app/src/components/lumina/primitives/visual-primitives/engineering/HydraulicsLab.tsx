'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HydraulicsLabMetrics } from '../../../evaluation/types';
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

export interface HydraulicsChallenge {
  id: string;
  type: 'predict' | 'observe' | 'adjust';
  instruction: string;
  options: ChallengeOption[];
  correctOptionId: string;
  hint: string;
}

export interface PascalsLawExplanation {
  simple: string;
  detailed: string;
}

export interface HydraulicsLabData {
  title: string;
  description: string;
  overview: string;
  scenario: 'hydraulic_press' | 'car_lift' | 'excavator' | 'brake_system';
  scenarioName: string;
  realWorldContext: string;
  gradeBand: '3-5' | '6-8';
  observeNarration?: string;
  zoneDescriptions?: Record<string, ZoneDescription>;
  challenges?: HydraulicsChallenge[];
  pascalsLawExplanation?: PascalsLawExplanation;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HydraulicsLabMetrics>) => void;
}

// ============================================================================
// Hydraulics Layout Constants — Component owns ALL geometry and physics
// ============================================================================

const CW = 720;
const CH = 440;

type FluidZone = 'small_cylinder' | 'pipe' | 'large_cylinder';
type ClickZone = 'small_piston' | 'large_piston' | 'connecting_pipe' | 'load';

interface Rect { x: number; y: number; w: number; h: number }

interface ZoneDef {
  id: ClickZone;
  name: string;
  bounds: Rect;
}

interface CylinderDef {
  cx: number;       // center x
  baseY: number;    // bottom of cylinder
  maxH: number;     // max height of fluid column
  wallW: number;    // wall thickness
}

interface HydraulicsLayoutDef {
  smallCyl: CylinderDef;
  largeCyl: CylinderDef;
  pipeY: number;          // y-level of connecting pipe center
  pipeH: number;          // pipe height
  particleCount: number;
  fluidColor: string;     // low pressure
  pressureColor: string;  // high pressure
}

const LAYOUT: HydraulicsLayoutDef = {
  smallCyl: { cx: 180, baseY: 340, maxH: 200, wallW: 4 },
  largeCyl: { cx: 540, baseY: 340, maxH: 200, wallW: 4 },
  pipeY: 345,
  pipeH: 20,
  particleCount: 60,
  fluidColor: '#3b82f6',
  pressureColor: '#ef4444',
};

// Clickable zone definitions — computed from cylinder positions + diameters at runtime
function computeZones(smallR: number, largeR: number): ZoneDef[] {
  const l = LAYOUT;
  return [
    {
      id: 'small_piston',
      name: 'Input Piston',
      bounds: { x: l.smallCyl.cx - smallR - 10, y: l.smallCyl.baseY - l.smallCyl.maxH - 30, w: smallR * 2 + 20, h: 50 },
    },
    {
      id: 'large_piston',
      name: 'Output Piston',
      bounds: { x: l.largeCyl.cx - largeR - 10, y: l.largeCyl.baseY - l.largeCyl.maxH - 30, w: largeR * 2 + 20, h: 50 },
    },
    {
      id: 'connecting_pipe',
      name: 'Fluid Line',
      bounds: { x: l.smallCyl.cx + smallR, y: l.pipeY - l.pipeH / 2 - 5, w: l.largeCyl.cx - largeR - l.smallCyl.cx - smallR, h: l.pipeH + 10 },
    },
    {
      id: 'load',
      name: 'The Load',
      bounds: { x: l.largeCyl.cx - largeR, y: l.largeCyl.baseY - l.largeCyl.maxH - 80, w: largeR * 2, h: 40 },
    },
  ];
}

const DEFAULT_ZONE_DESCS: Record<string, ZoneDescription> = {
  small_piston: { analogy: 'Like pushing down on a small syringe', explanation: 'You apply force here. The small area means the pressure you create is concentrated.' },
  large_piston: { analogy: 'Like a car jack lifting a heavy vehicle', explanation: 'This is where the work happens. The larger area multiplies the force from the small piston.' },
  connecting_pipe: { analogy: 'Like a garden hose connecting two taps', explanation: 'Fluid transmits pressure equally in all directions through this pipe (Pascal\'s Law).' },
  load: { analogy: 'Like the car sitting on a jack', explanation: 'This is what we\'re trying to lift. The hydraulic system multiplies your force to move heavy loads.' },
};

const DEFAULT_CHALLENGES: HydraulicsChallenge[] = [
  {
    id: 'ch1', type: 'predict',
    instruction: 'If you make the output piston twice as wide, what happens to the output force?',
    options: [
      { id: 'a', text: 'It doubles' },
      { id: 'b', text: 'It quadruples (4x)' },
      { id: 'c', text: 'It stays the same' },
      { id: 'd', text: 'It halves' },
    ],
    correctOptionId: 'b',
    hint: 'Force depends on AREA, not diameter. Area = pi * r^2. If the diameter doubles, the area becomes 4 times bigger...',
  },
  {
    id: 'ch2', type: 'observe',
    instruction: 'Watch the fluid particles as you increase the input force. What happens to their color?',
    options: [
      { id: 'a', text: 'They turn green' },
      { id: 'b', text: 'They change from blue to red everywhere at once' },
      { id: 'c', text: 'Only the particles near the small piston change' },
      { id: 'd', text: 'They stay the same color' },
    ],
    correctOptionId: 'b',
    hint: 'Look at ALL the particles in the system. Pascal\'s Law says pressure is transmitted equally...',
  },
  {
    id: 'ch3', type: 'adjust',
    instruction: 'Try to lift the load using the smallest input force you can. What piston sizes work best?',
    options: [
      { id: 'a', text: 'Make both pistons the same size' },
      { id: 'b', text: 'Make the input piston as small as possible and the output as large as possible' },
      { id: 'c', text: 'Make the input piston very large' },
      { id: 'd', text: 'Piston sizes don\'t matter, only force matters' },
    ],
    correctOptionId: 'b',
    hint: 'A bigger area ratio means more force multiplication. Try the sliders and watch the force arrows...',
  },
];

// ============================================================================
// Particle Physics
// ============================================================================

interface FluidParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pressure: number;  // 0-1 maps to color
  zone: FluidZone;
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

// ============================================================================
// Canvas Sub-component: HydraulicsSimulation
// ============================================================================

interface SimState {
  smallPistonY: number;   // how far down from rest the small piston has moved
  largePistonY: number;   // how far up from rest the large piston has moved
  systemPressure: number; // smoothed pressure (Pa conceptual)
  forceMultDiscovered: boolean;
  workConservationSeen: boolean;
}

interface SimCallbacks {
  onPressure: (p: number) => void;
  onOutputForce: (f: number) => void;
  onForceRatio: (r: number) => void;
  onSmallPistonMove: (d: number) => void;
  onLargePistonMove: (d: number) => void;
  onForceMultDiscovered: () => void;
  onWorkConservation: () => void;
  onLoadLifted: (lifted: boolean) => void;
}

const HydraulicsSimulation: React.FC<{
  inputForce: number;
  smallDiameter: number;
  largeDiameter: number;
  loadWeight: number;
  selectedZone: string | null;
  onZoneClick: (zoneId: string) => void;
  onInputForceChange: (force: number) => void;
  callbacks: SimCallbacks;
}> = ({ inputForce, smallDiameter, largeDiameter, loadWeight, selectedZone, onZoneClick, onInputForceChange, callbacks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<FluidParticle[]>([]);
  const simRef = useRef<SimState>({
    smallPistonY: 0, largePistonY: 0, systemPressure: 0,
    forceMultDiscovered: false, workConservationSeen: false,
  });
  const animRef = useRef<number>(0);

  // Drag state for interactive piston control
  const isDraggingRef = useRef(false);
  const dragCallbackRef = useRef(onInputForceChange);
  useEffect(() => { dragCallbackRef.current = onInputForceChange; }, [onInputForceChange]);

  // Refs for dynamic values to avoid restarting animation
  const inputForceRef = useRef(inputForce);
  const smallDiamRef = useRef(smallDiameter);
  const largeDiamRef = useRef(largeDiameter);
  const loadWeightRef = useRef(loadWeight);
  const selectedZoneRef = useRef(selectedZone);
  const callbacksRef = useRef(callbacks);

  useEffect(() => { inputForceRef.current = inputForce; }, [inputForce]);
  useEffect(() => { smallDiamRef.current = smallDiameter; }, [smallDiameter]);
  useEffect(() => { largeDiamRef.current = largeDiameter; }, [largeDiameter]);
  useEffect(() => { loadWeightRef.current = loadWeight; }, [loadWeight]);
  useEffect(() => { selectedZoneRef.current = selectedZone; }, [selectedZone]);
  useEffect(() => { callbacksRef.current = callbacks; }, [callbacks]);

  const l = LAYOUT;

  // Initialize particles distributed across the system
  useEffect(() => {
    const particles: FluidParticle[] = [];
    const smallR = 50; // initial visual radius
    const largeR = 75;

    // Small cylinder particles
    for (let i = 0; i < Math.floor(l.particleCount * 0.3); i++) {
      particles.push({
        x: l.smallCyl.cx + (Math.random() - 0.5) * smallR * 1.4,
        y: l.smallCyl.baseY - 20 - Math.random() * (l.smallCyl.maxH * 0.6),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        pressure: 0,
        zone: 'small_cylinder',
      });
    }
    // Pipe particles
    for (let i = 0; i < Math.floor(l.particleCount * 0.15); i++) {
      const t = Math.random();
      particles.push({
        x: l.smallCyl.cx + smallR + t * (l.largeCyl.cx - largeR - l.smallCyl.cx - smallR),
        y: l.pipeY + (Math.random() - 0.5) * (l.pipeH - 6),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.1,
        pressure: 0,
        zone: 'pipe',
      });
    }
    // Large cylinder particles
    for (let i = 0; i < Math.ceil(l.particleCount * 0.55); i++) {
      particles.push({
        x: l.largeCyl.cx + (Math.random() - 0.5) * largeR * 1.4,
        y: l.largeCyl.baseY - 20 - Math.random() * (l.largeCyl.maxH * 0.6),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        pressure: 0,
        zone: 'large_cylinder',
      });
    }
    particlesRef.current = particles;
    simRef.current = { smallPistonY: 0, largePistonY: 0, systemPressure: 0, forceMultDiscovered: false, workConservationSeen: false };
  }, [l]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const sim = simRef.current;
      const particles = particlesRef.current;
      const force = inputForceRef.current;
      const sDiam = smallDiamRef.current;
      const lDiam = largeDiamRef.current;
      const loadW = loadWeightRef.current;
      const selZone = selectedZoneRef.current;
      const cbs = callbacksRef.current;

      // ======== PHYSICS CALCULATIONS ========
      const sArea = Math.PI * (sDiam / 2) ** 2;  // cm^2
      const lArea = Math.PI * (lDiam / 2) ** 2;  // cm^2
      const areaRatio = lArea / Math.max(sArea, 0.01);
      const pressure = force / Math.max(sArea, 0.01);  // N/cm^2
      const outputForce = pressure * lArea;
      const loadForceN = loadW * 9.81;  // N (kg * gravity)
      const netOutputForce = outputForce - loadForceN;
      const isLifting = netOutputForce > 0 && force > 0;

      // Piston displacement — visually exaggerated so students SEE the movement.
      // Small piston pushes DOWN proportional to input force.
      // Large piston rises UP — always responds to pressure (even under load),
      // but rises MORE when it can actually overcome the load.
      const maxSmallTravel = l.smallCyl.maxH * 0.55;
      const maxLargeTravel = l.largeCyl.maxH * 0.55;
      const forceNorm = force / 500; // 0-1

      // Small piston: pushes down with force
      const targetSmallY = forceNorm * maxSmallTravel;

      // Large piston: always responds to pressure, but load resists.
      // Without load: full travel scaled by volume-conservation ratio (visually amplified).
      // With load: partial travel based on how much output force exceeds load.
      const volumeRatio = sArea / Math.max(lArea, 0.01);
      // Amplify so it's visible: at least 30% of small travel, up to full maxLargeTravel
      const hydraulicTravel = Math.min(maxLargeTravel, targetSmallY * Math.max(volumeRatio * 3, 0.3));
      // Load resistance: smoothly reduce travel as load approaches output force
      const loadResistance = loadForceN > 0
        ? Math.max(0, Math.min(1, (outputForce - loadForceN * 0.3) / Math.max(loadForceN * 0.7, 1)))
        : 1;
      const targetLargeY = hydraulicTravel * (0.15 + 0.85 * loadResistance);

      // Smooth piston movement (faster lerp for snappier response)
      sim.smallPistonY += (targetSmallY - sim.smallPistonY) * 0.12;
      sim.largePistonY += (targetLargeY - sim.largePistonY) * 0.12;
      sim.systemPressure += (pressure - sim.systemPressure) * 0.1;

      // Normalized pressure for color (0-1)
      const pressureNorm = Math.min(1, sim.systemPressure / 8);

      // Discovery tracking
      if (areaRatio > 5 && force > 20 && !sim.forceMultDiscovered) {
        sim.forceMultDiscovered = true;
        cbs.onForceMultDiscovered();
      }
      if (sim.smallPistonY > 20 && sim.largePistonY > 0 && sim.largePistonY < sim.smallPistonY * 0.5 && !sim.workConservationSeen) {
        sim.workConservationSeen = true;
        cbs.onWorkConservation();
      }

      // Report to parent
      cbs.onPressure(sim.systemPressure);
      cbs.onOutputForce(outputForce);
      cbs.onForceRatio(areaRatio);
      cbs.onSmallPistonMove(sim.smallPistonY);
      cbs.onLargePistonMove(sim.largePistonY);
      cbs.onLoadLifted(isLifting);

      // ======== UPDATE PARTICLES ========
      const smallR = Math.min(80, sDiam * 3);  // visual radius scaled from diameter
      const largeR = Math.min(130, lDiam * 3);

      const smallLeft = l.smallCyl.cx - smallR;
      const smallRight = l.smallCyl.cx + smallR;
      const largeLeft = l.largeCyl.cx - largeR;
      const largeRight = l.largeCyl.cx + largeR;

      const smallPistonYPos = l.smallCyl.baseY - l.smallCyl.maxH + 20 + sim.smallPistonY;
      const largePistonYPos = l.largeCyl.baseY - l.largeCyl.maxH + 20 - sim.largePistonY;

      for (const p of particles) {
        // All particles converge toward system pressure (Pascal's Law!)
        p.pressure += (pressureNorm - p.pressure) * 0.08;

        // Brownian motion — more energetic under pressure
        const energyFactor = 0.5 + pressureNorm * 2;
        p.vx += (Math.random() - 0.5) * energyFactor * 0.4;
        p.vy += (Math.random() - 0.5) * energyFactor * 0.4;

        // Damping
        p.vx *= 0.92;
        p.vy *= 0.92;

        p.x += p.vx;
        p.y += p.vy;

        switch (p.zone) {
          case 'small_cylinder': {
            // Walls
            if (p.x < smallLeft + 5) { p.x = smallLeft + 5; p.vx = Math.abs(p.vx); }
            if (p.x > smallRight - 5) { p.x = smallRight - 5; p.vx = -Math.abs(p.vx); }
            // Piston face pushes particles DOWN — stronger with more force
            if (p.y < smallPistonYPos + 5) {
              p.y = smallPistonYPos + 5;
              p.vy = Math.abs(p.vy) * 0.8 + forceNorm * 0.8;
            }
            // Bottom
            if (p.y > l.smallCyl.baseY - 5) { p.y = l.smallCyl.baseY - 5; p.vy = -Math.abs(p.vy); }

            // Force-driven flow: more force = more particles pushed into pipe
            // Higher transition rate creates visible "pumping" effect
            const pumpRate = 0.01 + forceNorm * 0.06;
            if (p.y > l.smallCyl.baseY - 30 && Math.random() < pumpRate) {
              p.zone = 'pipe';
              p.x = smallRight + 5;
              p.y = l.pipeY + (Math.random() - 0.5) * (l.pipeH - 8);
              p.vx = 1.5 + forceNorm * 2.5;
              p.vy = 0;
            }
            break;
          }
          case 'pipe': {
            // Strong directional flow when force is applied — particles rush right
            const flowBias = force > 0 ? 0.5 + forceNorm * 1.5 : -0.1;
            p.vx += flowBias;
            // Walls
            if (p.y < l.pipeY - l.pipeH / 2 + 3) { p.y = l.pipeY - l.pipeH / 2 + 3; p.vy = Math.abs(p.vy); }
            if (p.y > l.pipeY + l.pipeH / 2 - 3) { p.y = l.pipeY + l.pipeH / 2 - 3; p.vy = -Math.abs(p.vy); }

            // Transition to large cylinder
            if (p.x > largeLeft - 5) {
              p.zone = 'large_cylinder';
              p.x = largeLeft + 10 + Math.random() * 20;
              p.y = l.largeCyl.baseY - 30 - Math.random() * 30;
              p.vy = -Math.random() * 0.5;
            }
            // Transition back to small cylinder
            if (p.x < smallRight + 5) {
              p.zone = 'small_cylinder';
              p.x = smallRight - 15;
              p.y = l.smallCyl.baseY - 30 - Math.random() * 30;
              p.vy = -Math.random() * 0.5;
            }
            break;
          }
          case 'large_cylinder': {
            // Walls
            if (p.x < largeLeft + 5) { p.x = largeLeft + 5; p.vx = Math.abs(p.vx); }
            if (p.x > largeRight - 5) { p.x = largeRight - 5; p.vx = -Math.abs(p.vx); }
            // Piston face pushes particles DOWN (piston descends from top).
            // When pressure builds, particles get compressed upward against piston.
            // The piston rising = more room = particles spread upward into the space.
            if (p.y < largePistonYPos + 5) {
              p.y = largePistonYPos + 5;
              p.vy = Math.abs(p.vy) * 0.8;
            }
            // Pressure from below pushes particles UP — visible churning when force applied
            if (forceNorm > 0.05) {
              p.vy -= forceNorm * 0.3;
            }
            // Bottom
            if (p.y > l.largeCyl.baseY - 5) { p.y = l.largeCyl.baseY - 5; p.vy = -Math.abs(p.vy); }

            // Return flow: low rate, particles trickle back to pipe when force is low
            const returnRate = force > 0 ? 0.005 : 0.02;
            if (p.y > l.largeCyl.baseY - 20 && p.x < largeLeft + 20 && Math.random() < returnRate) {
              p.zone = 'pipe';
              p.x = largeLeft - 5;
              p.y = l.pipeY + (Math.random() - 0.5) * (l.pipeH - 8);
              p.vx = -1;
              p.vy = 0;
            }
            break;
          }
        }
      }

      // ======== DRAW ========
      ctx.clearRect(0, 0, CW, CH);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // ---- Draw ground/base ----
      ctx.fillStyle = 'rgba(71,85,105,0.3)';
      ctx.fillRect(0, l.smallCyl.baseY + 5, CW, CH - l.smallCyl.baseY - 5);
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, l.smallCyl.baseY + 5);
      ctx.lineTo(CW, l.smallCyl.baseY + 5);
      ctx.stroke();

      // ---- Draw cylinders ----
      const drawCylinder = (cx: number, baseY: number, r: number, pistonYPos: number, label: string, isSmall: boolean) => {
        const left = cx - r;
        const right = cx + r;
        const topY = baseY - l.smallCyl.maxH - 10;

        // Cylinder walls (metallic gradient)
        const wallGrad = ctx.createLinearGradient(left - 5, 0, left + 5, 0);
        wallGrad.addColorStop(0, '#334155');
        wallGrad.addColorStop(0.5, '#64748b');
        wallGrad.addColorStop(1, '#334155');

        // Left wall
        ctx.fillStyle = wallGrad;
        ctx.fillRect(left - 4, topY, 4, baseY - topY + 5);
        // Right wall
        const wallGrad2 = ctx.createLinearGradient(right, 0, right + 4, 0);
        wallGrad2.addColorStop(0, '#334155');
        wallGrad2.addColorStop(0.5, '#64748b');
        wallGrad2.addColorStop(1, '#334155');
        ctx.fillStyle = wallGrad2;
        ctx.fillRect(right, topY, 4, baseY - topY + 5);

        // Bottom
        ctx.fillStyle = '#475569';
        ctx.fillRect(left - 4, baseY, r * 2 + 8, 6);

        // Fluid fill (blue region below piston)
        const fluidGrad = ctx.createLinearGradient(0, pistonYPos, 0, baseY);
        fluidGrad.addColorStop(0, `rgba(59,130,246,${0.15 + pressureNorm * 0.15})`);
        fluidGrad.addColorStop(1, `rgba(59,130,246,${0.08 + pressureNorm * 0.1})`);
        ctx.fillStyle = fluidGrad;
        ctx.fillRect(left, pistonYPos + 10, r * 2, baseY - pistonYPos - 10);

        // Piston (gradient metallic)
        const pistonGrad = ctx.createLinearGradient(0, pistonYPos - 4, 0, pistonYPos + 14);
        pistonGrad.addColorStop(0, '#94a3b8');
        pistonGrad.addColorStop(0.3, '#cbd5e1');
        pistonGrad.addColorStop(0.7, '#94a3b8');
        pistonGrad.addColorStop(1, '#64748b');
        ctx.fillStyle = pistonGrad;
        ctx.fillRect(left + 2, pistonYPos, r * 2 - 4, 14);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 2, pistonYPos, r * 2 - 4, 14);

        // Piston rod
        ctx.fillStyle = '#64748b';
        ctx.fillRect(cx - 3, pistonYPos - 30, 6, 30);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx - 3, pistonYPos - 30, 6, 30);

        // Handle/push plate — highlighted on small piston to hint draggability
        if (isSmall) {
          ctx.fillStyle = isDraggingRef.current ? '#22d3ee' : '#0e7490';
          ctx.fillRect(cx - 14, pistonYPos - 36, 28, 8);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 14, pistonYPos - 36, 28, 8);
          // Grip lines
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 0.5;
          for (let gx = cx - 8; gx <= cx + 8; gx += 4) {
            ctx.beginPath();
            ctx.moveTo(gx, pistonYPos - 34);
            ctx.lineTo(gx, pistonYPos - 30);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = '#475569';
          ctx.fillRect(cx - 12, pistonYPos - 34, 24, 6);
          ctx.strokeStyle = '#94a3b8';
          ctx.strokeRect(cx - 12, pistonYPos - 34, 24, 6);
        }

        // Diameter label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${isSmall ? sDiam : lDiam} cm`, cx, baseY + 20);
        ctx.fillText(label, cx, topY - 5);

        // Area label
        const area = Math.round(isSmall ? sArea : lArea);
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        ctx.fillText(`A = ${area} cm\u00B2`, cx, baseY + 32);
      };

      drawCylinder(l.smallCyl.cx, l.smallCyl.baseY, smallR, smallPistonYPos, 'Input (Small)', true);
      drawCylinder(l.largeCyl.cx, l.largeCyl.baseY, largeR, largePistonYPos, 'Output (Large)', false);

      // ---- Draw connecting pipe ----
      const pipeLeft = smallRight + 2;
      const pipeRight = largeLeft - 2;
      const pipeTop = l.pipeY - l.pipeH / 2;

      // Down from small cylinder to pipe level
      ctx.fillStyle = '#334155';
      ctx.fillRect(smallRight - 2, l.smallCyl.baseY - 8, 8, l.pipeY - l.smallCyl.baseY + l.pipeH / 2 + 12);
      // Horizontal pipe
      const pipeGrad = ctx.createLinearGradient(0, pipeTop, 0, pipeTop + l.pipeH);
      pipeGrad.addColorStop(0, '#334155');
      pipeGrad.addColorStop(0.5, '#475569');
      pipeGrad.addColorStop(1, '#334155');
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(pipeLeft, pipeTop, pipeRight - pipeLeft, l.pipeH);
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pipeLeft, pipeTop, pipeRight - pipeLeft, l.pipeH);
      // Up to large cylinder from pipe level
      ctx.fillStyle = '#334155';
      ctx.fillRect(largeLeft - 4, l.pipeY - l.pipeH / 2, 8, l.largeCyl.baseY - l.pipeY + l.pipeH / 2 + 8);

      // Fluid in pipe (color tinted by pressure)
      const pipeFill = `rgba(${59 + Math.round(pressureNorm * 180)},${130 - Math.round(pressureNorm * 80)},${246 - Math.round(pressureNorm * 200)},0.25)`;
      ctx.fillStyle = pipeFill;
      ctx.fillRect(pipeLeft + 2, pipeTop + 2, pipeRight - pipeLeft - 4, l.pipeH - 4);

      // ---- Draw force arrows ----
      if (force > 5) {
        // Input force arrow (down on small piston)
        const inputArrowLen = Math.min(60, 15 + (force / 500) * 45);
        const inputArrowX = l.smallCyl.cx;
        const inputArrowTop = smallPistonYPos - 34 - inputArrowLen;

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(inputArrowX, inputArrowTop);
        ctx.lineTo(inputArrowX, inputArrowTop + inputArrowLen);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(inputArrowX, inputArrowTop + inputArrowLen + 4);
        ctx.lineTo(inputArrowX - 6, inputArrowTop + inputArrowLen - 4);
        ctx.lineTo(inputArrowX + 6, inputArrowTop + inputArrowLen - 4);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(force)} N`, inputArrowX, inputArrowTop - 6);

        // Output force arrow (up on large piston)
        const outputArrowLen = Math.min(80, 15 + (outputForce / 5000) * 65);
        const outputArrowX = l.largeCyl.cx;
        const outputArrowBottom = largePistonYPos - 34;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = Math.min(6, 3 + areaRatio * 0.15);
        ctx.beginPath();
        ctx.moveTo(outputArrowX, outputArrowBottom);
        ctx.lineTo(outputArrowX, outputArrowBottom - outputArrowLen);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(outputArrowX, outputArrowBottom - outputArrowLen - 4);
        ctx.lineTo(outputArrowX - 7, outputArrowBottom - outputArrowLen + 5);
        ctx.lineTo(outputArrowX + 7, outputArrowBottom - outputArrowLen + 5);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${Math.round(outputForce)} N`, outputArrowX, outputArrowBottom - outputArrowLen - 10);
      }

      // ---- Draw load on output piston ----
      if (loadW > 0) {
        const loadY = largePistonYPos - 34 - 6;
        const loadH = 28;
        const loadBoxW = Math.min(largeR * 1.6, 100);
        const loadX = l.largeCyl.cx - loadBoxW / 2;

        // Load box
        const loadGrad = ctx.createLinearGradient(0, loadY - loadH, 0, loadY);
        loadGrad.addColorStop(0, '#78350f');
        loadGrad.addColorStop(0.5, '#92400e');
        loadGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = loadGrad;

        // Rounded rect for load
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(loadX + r, loadY - loadH);
        ctx.lineTo(loadX + loadBoxW - r, loadY - loadH);
        ctx.arcTo(loadX + loadBoxW, loadY - loadH, loadX + loadBoxW, loadY - loadH + r, r);
        ctx.lineTo(loadX + loadBoxW, loadY - r);
        ctx.arcTo(loadX + loadBoxW, loadY, loadX + loadBoxW - r, loadY, r);
        ctx.lineTo(loadX + r, loadY);
        ctx.arcTo(loadX, loadY, loadX, loadY - r, r);
        ctx.lineTo(loadX, loadY - loadH + r);
        ctx.arcTo(loadX, loadY - loadH, loadX + r, loadY - loadH, r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Load weight text
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${loadW} kg`, l.largeCyl.cx, loadY - loadH / 2 + 4);

        // Lifting status indicator
        if (isLifting) {
          ctx.fillStyle = '#22c55e';
          ctx.font = '9px monospace';
          ctx.fillText('LIFTING', l.largeCyl.cx, loadY - loadH - 6);
        } else if (force > 0) {
          ctx.fillStyle = '#ef4444';
          ctx.font = '9px monospace';
          ctx.fillText('TOO HEAVY', l.largeCyl.cx, loadY - loadH - 6);
        }
      }

      // ---- Draw particles ----
      for (const p of particles) {
        const color = lerpColor(l.fluidColor, l.pressureColor, p.pressure);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        if (p.pressure > 0.5) {
          ctx.shadowColor = l.pressureColor;
          ctx.shadowBlur = 5;
        }
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ---- Zone highlighting ----
      const zones = computeZones(smallR, largeR);
      for (const zone of zones) {
        if (zone.id === selZone) {
          const b = zone.bounds;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 10;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          // Zone label
          ctx.fillStyle = '#22d3ee';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(zone.name, b.x + b.w / 2, b.y - 4);
        }
      }

      // ---- Pressure gauge ----
      const gx = 668, gy = 50, gw = 16, gh = 120;
      ctx.fillStyle = 'rgba(30,41,59,0.6)';
      ctx.fillRect(gx, gy, gw, gh);
      const pPct = Math.min(1, sim.systemPressure / 10);
      const pCol = pPct > 0.7 ? '#ef4444' : pPct > 0.4 ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = pCol;
      ctx.fillRect(gx, gy + gh * (1 - pPct), gw, gh * pPct);
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PSI', gx + gw / 2, gy - 6);

      // ---- Force ratio display ----
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${areaRatio.toFixed(1)}x`, CW / 2, 30);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('Force Multiplication', CW / 2, 44);

      // ---- Distance comparison ----
      if (sim.smallPistonY > 5) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        const sDist = sim.smallPistonY.toFixed(0);
        const lDist = sim.largePistonY.toFixed(1);
        ctx.fillText(`Input moves ${sDist}px`, l.smallCyl.cx, l.smallCyl.baseY + 46);
        ctx.fillText(`Output moves ${lDist}px`, l.largeCyl.cx, l.largeCyl.baseY + 46);
      }

      ctx.textAlign = 'start';
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [l]);

  // Helper: convert client coords to canvas coords
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CW / rect.width),
      y: (clientY - rect.top) * (CH / rect.height),
    };
  }, []);

  // Check if a point is near the small piston (generous hit area around piston head + rod)
  const isNearSmallPiston = useCallback((cx: number, cy: number) => {
    const smallR = Math.min(80, smallDiamRef.current * 3);
    const sim = simRef.current;
    const pistonYPos = l.smallCyl.baseY - l.smallCyl.maxH + 20 + sim.smallPistonY;
    // Hit area: piston head region (from handle to piston face, wider than visual)
    const hitLeft = l.smallCyl.cx - smallR - 15;
    const hitRight = l.smallCyl.cx + smallR + 15;
    const hitTop = pistonYPos - 50;
    const hitBottom = pistonYPos + 20;
    return cx >= hitLeft && cx <= hitRight && cy >= hitTop && cy <= hitBottom;
  }, [l]);

  // Map canvas Y position to force (0-500N)
  const yToForce = useCallback((cy: number) => {
    const restY = l.smallCyl.baseY - l.smallCyl.maxH + 20;
    const maxTravel = l.smallCyl.maxH * 0.55;
    const maxY = restY + maxTravel;
    // Map: restY → 0N, maxY → 500N
    const t = Math.max(0, Math.min(1, (cy - restY) / (maxY - restY)));
    // Round to nearest 5 to match slider step
    return Math.round((t * 500) / 5) * 5;
  }, [l]);

  // Mouse drag handlers for small piston
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    if (isNearSmallPiston(x, y)) {
      isDraggingRef.current = true;
      e.preventDefault();
      // Immediately update force to match where they clicked
      const force = yToForce(y);
      dragCallbackRef.current(force);
    }
  }, [toCanvasCoords, isNearSmallPiston, yToForce]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = toCanvasCoords(e.clientX, e.clientY);

    if (isDraggingRef.current) {
      e.preventDefault();
      const force = yToForce(y);
      dragCallbackRef.current(force);
    } else {
      // Show grab cursor when hovering over piston
      canvas.style.cursor = isNearSmallPiston(x, y) ? 'grab' : 'pointer';
    }
  }, [toCanvasCoords, isNearSmallPiston, yToForce]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'pointer';
  }, []);

  // Stop dragging if mouse leaves canvas
  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Canvas click handler (only fires zone clicks if not dragging)
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't trigger zone click if we were just dragging
    if (isDraggingRef.current) return;

    const { x, y } = toCanvasCoords(e.clientX, e.clientY);

    // Skip zone click if clicking on the piston drag area
    if (isNearSmallPiston(x, y)) return;

    const smallR = Math.min(80, smallDiamRef.current * 3);
    const largeR = Math.min(130, largeDiamRef.current * 3);
    const zones = computeZones(smallR, largeR);

    for (const zone of zones) {
      const b = zone.bounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        onZoneClick(zone.id);
        return;
      }
    }
    onZoneClick('');
  }, [toCanvasCoords, isNearSmallPiston, onZoneClick]);

  // Touch drag handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const { x, y } = toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);

    if (isNearSmallPiston(x, y)) {
      isDraggingRef.current = true;
      e.preventDefault();
      const force = yToForce(y);
      dragCallbackRef.current(force);
      return;
    }

    // Zone click for non-piston touches
    const smallR = Math.min(80, smallDiamRef.current * 3);
    const largeR = Math.min(130, largeDiamRef.current * 3);
    const zones = computeZones(smallR, largeR);

    for (const zone of zones) {
      const b = zone.bounds;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        onZoneClick(zone.id);
        return;
      }
    }
    onZoneClick('');
  }, [toCanvasCoords, isNearSmallPiston, yToForce, onZoneClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length === 0) return;
    e.preventDefault();
    const { y } = toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
    const force = yToForce(y);
    dragCallbackRef.current(force);
  }, [toCanvasCoords, yToForce]);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="rounded-xl cursor-pointer w-full"
      style={{ maxWidth: CW, imageRendering: 'auto', touchAction: 'none' }}
    />
  );
};

// ============================================================================
// Main Component: HydraulicsLab
// ============================================================================

interface HydraulicsLabProps {
  data: HydraulicsLabData;
  className?: string;
}

const SCENARIO_ICONS: Record<string, string> = {
  hydraulic_press: '\u{1F527}',
  car_lift: '\u{1F697}',
  excavator: '\u{1F3D7}\uFE0F',
  brake_system: '\u{1F6D1}',
};

const HydraulicsLab: React.FC<HydraulicsLabProps> = ({ data, className }) => {
  const {
    title, description, overview,
    scenario = 'car_lift', scenarioName, realWorldContext,
    gradeBand = '3-5', observeNarration,
    zoneDescriptions, challenges: dataChallenges,
    pascalsLawExplanation,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const zoneDescs = useMemo(() => ({ ...DEFAULT_ZONE_DESCS, ...zoneDescriptions }), [zoneDescriptions]);
  const challenges = dataChallenges && dataChallenges.length > 0 ? dataChallenges : DEFAULT_CHALLENGES;

  // ---- State ----
  const [inputForce, setInputForce] = useState(50);
  const [smallDiameter, setSmallDiameter] = useState(4);
  const [largeDiameter, setLargeDiameter] = useState(12);
  const [loadWeight, setLoadWeight] = useState(200);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [exploredZones, setExploredZones] = useState<Set<string>>(new Set());
  const [systemPressure, setSystemPressure] = useState(0);
  const [outputForce, setOutputForce] = useState(0);
  const [forceRatio, setForceRatio] = useState(1);
  const [smallPistonDist, setSmallPistonDist] = useState(0);
  const [largePistonDist, setLargePistonDist] = useState(0);
  const [isLifting, setIsLifting] = useState(false);
  const [sliderAdjustCount, setSliderAdjustCount] = useState(0);
  const [forceMultDiscovered, setForceMultDiscovered] = useState(false);
  const [workConservationSeen, setWorkConservationSeen] = useState(false);
  const [maxForceRatio, setMaxForceRatio] = useState(1);
  const [showPascalsLaw, setShowPascalsLaw] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [challengeResults, setChallengeResults] = useState<{ id: string; correct: boolean }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const resolvedInstanceId = instanceId ?? `hydraulics-lab-${Date.now()}`;
  const allChallengesDone = challengeResults.length >= challenges.length;

  // Track max force ratio
  useEffect(() => {
    if (forceRatio > maxForceRatio) setMaxForceRatio(forceRatio);
  }, [forceRatio, maxForceRatio]);

  // ---- Evaluation ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<HydraulicsLabMetrics>({
    primitiveType: 'hydraulics-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    scenario, scenarioName, realWorldContext,
    inputForce, smallDiameter, largeDiameter, loadWeight,
    systemPressure: Math.round(systemPressure * 100) / 100,
    outputForce: Math.round(outputForce),
    forceRatio: Math.round(forceRatio * 10) / 10,
    isLifting,
    zonesExplored: Array.from(exploredZones).join(', '),
    challengeProgress: `${challengeResults.length}/${challenges.length}`,
    selectedZone: selectedZone || 'none',
  }), [scenario, scenarioName, realWorldContext, inputForce, smallDiameter, largeDiameter,
    loadWeight, systemPressure, outputForce, forceRatio, isLifting,
    exploredZones, challengeResults.length, challenges.length, selectedZone]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'hydraulics-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '3-5' ? '3-5' : '6-8',
  });

  // AI: Activity start
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Student is exploring a hydraulic system simulation: ${scenarioName}. `
      + `Real-world context: ${realWorldContext}. Grade band: ${gradeBand}. `
      + `${observeNarration || overview}. `
      + `Welcome them and point out the two pistons and the fluid particles — ask what they think will happen when they push on the small piston.`,
      { silent: true },
    );
  }, [isConnected, scenarioName, realWorldContext, gradeBand, observeNarration, overview, sendText]);

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
          + `They've explored ${next.size}/4 zones. `
          + `Explain what this part does using the analogy. Connect to Pascal's Law.`,
          { silent: true },
        );
      }
      return next;
    });
  }, [isConnected, zoneDescs, sendText]);

  const forceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleForceChange = useCallback((val: number) => {
    setInputForce(val);
    if (forceTimeoutRef.current) clearTimeout(forceTimeoutRef.current);
    forceTimeoutRef.current = setTimeout(() => {
      setSliderAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[FORCE_CHANGED] Student set input force to ${val}N. `
          + `Ask them to watch the particles change color and the output force arrow grow.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, sendText]);

  const pistonTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSmallDiamChange = useCallback((val: number) => {
    setSmallDiameter(val);
    if (pistonTimeoutRef.current) clearTimeout(pistonTimeoutRef.current);
    pistonTimeoutRef.current = setTimeout(() => {
      setSliderAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[PISTON_SIZE_CHANGED] Student changed small piston diameter to ${val}cm. `
          + `Area ratio is now ${(Math.PI * (largeDiameter / 2) ** 2 / Math.max(Math.PI * (val / 2) ** 2, 0.01)).toFixed(1)}x. `
          + `Ask what happened to the force multiplication ratio.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, largeDiameter, sendText]);

  const largePistonTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleLargeDiamChange = useCallback((val: number) => {
    setLargeDiameter(val);
    if (largePistonTimeoutRef.current) clearTimeout(largePistonTimeoutRef.current);
    largePistonTimeoutRef.current = setTimeout(() => {
      setSliderAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[PISTON_SIZE_CHANGED] Student changed large piston diameter to ${val}cm. `
          + `Area ratio is now ${(Math.PI * (val / 2) ** 2 / Math.max(Math.PI * (smallDiameter / 2) ** 2, 0.01)).toFixed(1)}x. `
          + `Ask what happened to the output force.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, smallDiameter, sendText]);

  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleLoadChange = useCallback((val: number) => {
    setLoadWeight(val);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setSliderAdjustCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[LOAD_CHANGED] Student set load to ${val}kg (${Math.round(val * 9.81)}N). `
          + `Ask what happens when the load weight exceeds the output force.`,
          { silent: true },
        );
      }
    }, 800);
  }, [isConnected, sendText]);

  const simCallbacks = useMemo<SimCallbacks>(() => ({
    onPressure: setSystemPressure,
    onOutputForce: setOutputForce,
    onForceRatio: setForceRatio,
    onSmallPistonMove: setSmallPistonDist,
    onLargePistonMove: setLargePistonDist,
    onLoadLifted: setIsLifting,
    onForceMultDiscovered: () => {
      setForceMultDiscovered(true);
      if (isConnected) {
        sendText(
          `[FORCE_MULTIPLICATION_DISCOVERED] Student achieved a force ratio above 5:1! `
          + `Celebrate! Explain why this is powerful — a small push creates a huge force. `
          + `Connect to real hydraulic machines like ${scenarioName}.`,
          { silent: true },
        );
      }
    },
    onWorkConservation: () => {
      setWorkConservationSeen(true);
      if (isConnected) {
        sendText(
          `[WORK_CONSERVATION_MOMENT] Student can see the small piston moves much farther than the large piston. `
          + `Key teaching moment: more force but LESS distance — work (force x distance) is conserved! `
          + `No free lunch in physics.`,
          { silent: true },
        );
      }
    },
  }), [isConnected, scenarioName, sendText]);

  // Challenge answer handler
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
          `[CHALLENGE_CORRECT] Student answered "${challenge.instruction}" correctly! `
          + `Celebrate and connect to Pascal's Law and the simulation.`,
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
          `[CHALLENGE_INCORRECT] Student got "${challenge.instruction}" wrong (chose "${optionId}"). `
          + `Hint: ${challenge.hint}. Guide gently — point them to the simulation.`,
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
    const metrics: HydraulicsLabMetrics = {
      type: 'hydraulics-lab',
      zonesExplored: exploredZones.size,
      zonesTotal: 4,
      sliderAdjustments: sliderAdjustCount,
      forceMultiplicationDiscovered: forceMultDiscovered,
      workConservationObserved: workConservationSeen,
      maxForceRatio,
      challengesCompleted: challengeResults.length,
      challengesCorrect: correctCount,
      challengesTotal: challenges.length,
      attemptsCount: 1,
    };
    const score =
      (exploredZones.size / 4) * 15 +
      (Math.min(sliderAdjustCount, 5) / 5) * 15 +
      (forceMultDiscovered ? 20 : 10) +
      (correctCount / Math.max(challenges.length, 1)) * 50;

    submitEvaluation(score >= 40, Math.round(score), metrics, { scenario });

    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Student finished! Score: ${Math.round(score)}%. `
        + `Zones: ${exploredZones.size}/4. `
        + `Challenges: ${correctCount}/${challenges.length} correct. `
        + `Max force ratio: ${maxForceRatio.toFixed(1)}x. Force mult discovered: ${forceMultDiscovered}. `
        + `Celebrate and summarize Pascal's Law and how it powers real ${scenarioName} systems!`,
        { silent: true },
      );
    }
  }, [
    hasSubmittedEvaluation, exploredZones.size, sliderAdjustCount,
    forceMultDiscovered, workConservationSeen, maxForceRatio,
    challengeResults, challenges.length, scenario, scenarioName,
    submitEvaluation, isConnected, sendText,
  ]);

  // ---- Render ----
  const icon = SCENARIO_ICONS[scenario] || '\u2699\uFE0F';
  const currentChallenge = challenges[currentChallengeIdx];
  const zoneInfo = selectedZone ? zoneDescs[selectedZone] : null;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border border-cyan-500/30 shadow-lg">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              Living Hydraulics Lab
            </p>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-lg">{scenarioName}</CardTitle>
              <p className="text-slate-400 text-sm mt-1">{overview}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {scenario.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {realWorldContext}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Simulation Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
            <HydraulicsSimulation
              inputForce={inputForce}
              smallDiameter={smallDiameter}
              largeDiameter={largeDiameter}
              loadWeight={loadWeight}
              selectedZone={selectedZone}
              onZoneClick={handleZoneClick}
              onInputForceChange={handleForceChange}
              callbacks={simCallbacks}
            />
            {/* Tap hint overlay */}
            {exploredZones.size === 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/10">
                <p className="text-slate-400 text-xs">Tap any zone to learn what it does</p>
              </div>
            )}
          </div>

          {/* Zone info card */}
          {zoneInfo && (
            <div className="bg-slate-800/40 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex items-start gap-3">
                <span className="text-cyan-400 text-lg mt-0.5">&#x1F4A1;</span>
                <div>
                  <p className="text-slate-200 text-sm font-medium">{zoneInfo.analogy}</p>
                  <p className="text-slate-400 text-xs mt-1">{zoneInfo.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Readouts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5 text-center">
              <p className="text-slate-500 text-xs font-mono">Pressure</p>
              <p className="text-slate-100 text-lg font-bold">{systemPressure.toFixed(1)}</p>
              <p className="text-slate-600 text-[10px]">N/cm&sup2;</p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5 text-center">
              <p className="text-slate-500 text-xs font-mono">Output Force</p>
              <p className="text-amber-400 text-lg font-bold">{Math.round(outputForce)}</p>
              <p className="text-slate-600 text-[10px]">Newtons</p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5 text-center">
              <p className="text-slate-500 text-xs font-mono">Multiplier</p>
              <p className="text-cyan-400 text-lg font-bold">{forceRatio.toFixed(1)}x</p>
              <p className="text-slate-600 text-[10px]">area ratio</p>
            </div>
            <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5 text-center">
              <p className="text-slate-500 text-xs font-mono">Load Status</p>
              <p className={`text-lg font-bold ${isLifting ? 'text-green-400' : inputForce > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {isLifting ? 'Lifting' : inputForce > 0 ? 'Stuck' : 'Idle'}
              </p>
              <p className="text-slate-600 text-[10px]">{loadWeight > 0 ? `${loadWeight} kg` : 'no load'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Input Force */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-slate-300 text-sm font-mono">Input Force</label>
                <span className="text-cyan-400 font-mono text-sm">{inputForce} N</span>
              </div>
              <input
                type="range" min={0} max={500} step={5} value={inputForce}
                onChange={e => handleForceChange(Number(e.target.value))}
                className="w-full accent-cyan-500 h-2 rounded-full bg-slate-700 cursor-pointer"
              />
            </div>

            {/* Load Weight */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-slate-300 text-sm font-mono">Load Weight</label>
                <span className="text-amber-400 font-mono text-sm">{loadWeight} kg</span>
              </div>
              <input
                type="range" min={0} max={2000} step={10} value={loadWeight}
                onChange={e => handleLoadChange(Number(e.target.value))}
                className="w-full accent-amber-500 h-2 rounded-full bg-slate-700 cursor-pointer"
              />
            </div>

            {/* Small Piston Diameter */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-slate-300 text-sm font-mono">Small Piston \u2300</label>
                <span className="text-sky-400 font-mono text-sm">{smallDiameter} cm</span>
              </div>
              <input
                type="range" min={2} max={10} step={0.5} value={smallDiameter}
                onChange={e => handleSmallDiamChange(Number(e.target.value))}
                className="w-full accent-sky-500 h-2 rounded-full bg-slate-700 cursor-pointer"
              />
            </div>

            {/* Large Piston Diameter */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-slate-300 text-sm font-mono">Large Piston \u2300</label>
                <span className="text-violet-400 font-mono text-sm">{largeDiameter} cm</span>
              </div>
              <input
                type="range" min={5} max={30} step={0.5} value={largeDiameter}
                onChange={e => handleLargeDiamChange(Number(e.target.value))}
                className="w-full accent-violet-500 h-2 rounded-full bg-slate-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Work conservation insight */}
          {smallPistonDist > 10 && (
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <p className="text-slate-400 text-xs font-mono mb-1">Work Conservation (Force x Distance)</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Input: {Math.round(inputForce)}N x {smallPistonDist.toFixed(0)}px</span>
                    <span className="text-cyan-400">{Math.round(inputForce * smallPistonDist)} work</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${Math.min(100, (inputForce * smallPistonDist) / 300)}%` }} />
                  </div>
                </div>
                <span className="text-slate-600 text-sm">=</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Output: {Math.round(outputForce)}N x {largePistonDist.toFixed(1)}px</span>
                    <span className="text-amber-400">{Math.round(outputForce * largePistonDist)} work</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${Math.min(100, (outputForce * largePistonDist) / 300)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pascal's Law explanation */}
          {pascalsLawExplanation && (
            <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setShowPascalsLaw(!showPascalsLaw)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-slate-300 text-sm font-mono">Pascal&apos;s Law Explained</span>
                <span className="text-slate-500 text-sm">{showPascalsLaw ? '\u25B2' : '\u25BC'}</span>
              </button>
              {showPascalsLaw && (
                <div className="px-4 pb-4 text-slate-400 text-sm">
                  {gradeBand === '3-5' ? pascalsLawExplanation.simple : pascalsLawExplanation.detailed}
                </div>
              )}
            </div>
          )}

          {/* Challenges */}
          {!showChallenges && !allChallengesDone && (
            <Button
              onClick={() => setShowChallenges(true)}
              variant="ghost"
              className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
            >
              Ready for a Challenge?
            </Button>
          )}

          {showChallenges && currentChallenge && !allChallengesDone && (
            <div className="bg-slate-800/40 rounded-xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`text-xs ${
                  currentChallenge.type === 'predict' ? 'border-emerald-500/30 text-emerald-400' :
                  currentChallenge.type === 'observe' ? 'border-blue-500/30 text-blue-400' :
                  'border-orange-500/30 text-orange-400'
                }`}>
                  {currentChallenge.type}
                </Badge>
                <span className="text-slate-500 text-xs">
                  {challengeResults.length + 1} / {challenges.length}
                </span>
              </div>
              <p className="text-slate-200 text-sm">{currentChallenge.instruction}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentChallenge.options.map(opt => (
                  <Button
                    key={opt.id}
                    onClick={() => handleAnswer(opt.id)}
                    variant="ghost"
                    disabled={!!answerFeedback}
                    className={`justify-start text-left text-sm py-3 px-4 h-auto whitespace-normal ${
                      selectedAnswer === opt.id
                        ? answerFeedback === 'correct'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-red-500/20 border-red-500/40 text-red-300'
                        : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 mr-2 font-mono">{opt.id}.</span>
                    {opt.text}
                  </Button>
                ))}
              </div>
              {showHint && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-amber-300 text-xs">&#x1F4A1; {currentChallenge.hint}</p>
                </div>
              )}
            </div>
          )}

          {/* Completion / Submit */}
          {allChallengesDone && !hasSubmittedEvaluation && (
            <div className="text-center space-y-3">
              <p className="text-emerald-400 text-sm font-medium">
                All challenges complete! {challengeResults.filter(r => r.correct).length}/{challenges.length} correct
              </p>
              <Button
                onClick={handleSubmitEvaluation}
                variant="ghost"
                className="bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300"
              >
                Submit Results
              </Button>
            </div>
          )}

          {hasSubmittedEvaluation && (
            <div className="text-center py-4">
              <p className="text-emerald-400 font-medium">Results submitted!</p>
              <p className="text-slate-500 text-xs mt-1">
                Zones: {exploredZones.size}/4 | Challenges: {challengeResults.filter(r => r.correct).length}/{challenges.length} |
                Max ratio: {maxForceRatio.toFixed(1)}x
              </p>
            </div>
          )}

          {/* Zone exploration progress */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-slate-600 text-xs font-mono">Zones:</span>
            {['small_piston', 'large_piston', 'connecting_pipe', 'load'].map(z => (
              <span
                key={z}
                className={`w-2 h-2 rounded-full ${exploredZones.has(z) ? 'bg-cyan-400' : 'bg-slate-700'}`}
                title={z.replace(/_/g, ' ')}
              />
            ))}
            <span className="text-slate-600 text-xs">{exploredZones.size}/4</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HydraulicsLab;
