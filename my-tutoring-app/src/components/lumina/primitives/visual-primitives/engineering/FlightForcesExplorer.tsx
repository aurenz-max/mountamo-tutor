'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FlightForcesExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface FlightChallenge {
  id: string;
  type: 'predict' | 'observe' | 'adjust';
  instruction: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  hint: string;
}

export interface FlightForcesExplorerData {
  title: string;
  description: string;
  overview: string;
  aircraftType: string;
  aircraftName: string;
  gradeBand: '1-2' | '3-5';
  challenges?: FlightChallenge[];
  forceDescriptions?: Record<string, { name: string; description: string; analogy: string }>;
  flightStateDescriptions?: Record<string, { name: string; description: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FlightForcesExplorerMetrics>) => void;
}

// ============================================================================
// Physics Constants — Component owns ALL geometry and physics
// ============================================================================

const CW = 720;
const CH = 420;
const AIR_DENSITY = 1.225;

type AircraftId = 'cessna' | 'jumbo_jet' | 'glider' | 'fighter';

interface AircraftDef {
  label: string;
  emoji: string;
  emptyWeight: number;
  maxThrust: number;
  wingArea: number;
  stallAngle: number;
  bodyW: number;
  bodyH: number;
  wingSpan: number;
  color: string;
}

const AIRCRAFT_DEFS: Record<AircraftId, AircraftDef> = {
  cessna: {
    label: 'Light Plane', emoji: '\uD83D\uDEE9\uFE0F',
    emptyWeight: 750, maxThrust: 2200, wingArea: 16, stallAngle: 16,
    bodyW: 70, bodyH: 18, wingSpan: 60, color: '#60a5fa',
  },
  jumbo_jet: {
    label: 'Jumbo Jet', emoji: '\u2708\uFE0F',
    emptyWeight: 180000, maxThrust: 900000, wingArea: 540, stallAngle: 14,
    bodyW: 90, bodyH: 24, wingSpan: 80, color: '#a78bfa',
  },
  glider: {
    label: 'Glider', emoji: '\uD83E\uDE82',
    emptyWeight: 300, maxThrust: 0, wingArea: 18, stallAngle: 18,
    bodyW: 60, bodyH: 12, wingSpan: 75, color: '#34d399',
  },
  fighter: {
    label: 'Fighter Jet', emoji: '\uD83D\uDEEB',
    emptyWeight: 10000, maxThrust: 130000, wingArea: 50, stallAngle: 20,
    bodyW: 75, bodyH: 16, wingSpan: 50, color: '#f97316',
  },
};

const AIRCRAFT_IDS: AircraftId[] = ['cessna', 'jumbo_jet', 'glider', 'fighter'];

const DEFAULT_CHALLENGES: FlightChallenge[] = [
  {
    id: 'ch1', type: 'predict',
    instruction: 'What happens to the air particles above the wing when you increase the angle of attack?',
    options: [
      { id: 'a', text: 'They slow down and bunch together' },
      { id: 'b', text: 'They speed up and spread apart — creating lower pressure above the wing' },
      { id: 'c', text: 'They stay exactly the same' },
      { id: 'd', text: 'They disappear' },
    ],
    correctOptionId: 'b',
    hint: 'Watch the particles above and below the wing as you tilt it. Which side has faster-moving, more spread-out particles?',
  },
  {
    id: 'ch2', type: 'observe',
    instruction: 'Increase the angle of attack past 15 degrees. Watch the particles above the wing. What happens?',
    options: [
      { id: 'a', text: 'They flow smoothly and lift gets even bigger' },
      { id: 'b', text: 'They detach and swirl — the wing stalls and lift collapses!' },
      { id: 'c', text: 'Nothing changes' },
      { id: 'd', text: 'The particles turn red' },
    ],
    correctOptionId: 'b',
    hint: 'A stall happens when air can no longer follow the wing surface. Watch for turbulence!',
  },
  {
    id: 'ch3', type: 'adjust',
    instruction: 'Can you find the sweet spot? Set the controls so the plane cruises at level flight (lift = weight, thrust = drag).',
    options: [
      { id: 'a', text: 'Maximum thrust and zero angle of attack' },
      { id: 'b', text: 'Moderate thrust (~50%) and gentle angle (~5-8 degrees)' },
      { id: 'c', text: 'No thrust needed — the wing does all the work' },
      { id: 'd', text: 'Full angle of attack (20 degrees) with low thrust' },
    ],
    correctOptionId: 'b',
    hint: 'Watch the force arrows. Level flight means UP = DOWN and FORWARD = BACKWARD.',
  },
  {
    id: 'ch4', type: 'predict',
    instruction: 'You add heavy cargo. What needs to change to keep flying level?',
    options: [
      { id: 'a', text: 'Nothing — more weight means more lift automatically' },
      { id: 'b', text: 'More thrust and/or steeper angle to generate more lift' },
      { id: 'c', text: 'Less thrust so you don\'t go too fast' },
      { id: 'd', text: 'Remove the wings' },
    ],
    correctOptionId: 'b',
    hint: 'More weight = more downward force. You need more lift to balance it. How can you get more lift?',
  },
];

// ============================================================================
// Particle Types
// ============================================================================

interface AirParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  turbulent: boolean;
}

// ============================================================================
// Canvas Sub-component: FlightSimulation
// ============================================================================

interface SimCallbacks {
  onFlightState: (state: string) => void;
  onForces: (forces: { lift: number; weight: number; thrust: number; drag: number }) => void;
  onStall: () => void;
  onAltitude: (alt: number) => void;
  onSpeed: (spd: number) => void;
}

const FlightSimulation: React.FC<{
  aircraft: AircraftDef;
  thrustPct: number;
  aoa: number;
  cargoWeight: number;
  callbacks: SimCallbacks;
}> = ({ aircraft, thrustPct, aoa, cargoWeight, callbacks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<AirParticle[]>([]);
  const simRef = useRef({
    planeY: CH * 0.45,
    planeVy: 0,
    speed: 120,
    altitude: 2000,
    wasStalling: false,
    cloudOffsetX: 0,
  });
  const animRef = useRef<number>(0);

  const thrustRef = useRef(thrustPct);
  const aoaRef = useRef(aoa);
  const cargoRef = useRef(cargoWeight);
  const cbRef = useRef(callbacks);
  const acRef = useRef(aircraft);
  useEffect(() => { thrustRef.current = thrustPct; }, [thrustPct]);
  useEffect(() => { aoaRef.current = aoa; }, [aoa]);
  useEffect(() => { cargoRef.current = cargoWeight; }, [cargoWeight]);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);
  useEffect(() => { acRef.current = aircraft; }, [aircraft]);

  // Reset on aircraft change
  useEffect(() => {
    particlesRef.current = [];
    simRef.current = {
      planeY: CH * 0.45,
      planeVy: 0,
      speed: 120,
      altitude: 2000,
      wasStalling: false,
      cloudOffsetX: 0,
    };
  }, [aircraft]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PLANE_X = CW * 0.4;
    const PARTICLE_COUNT = 60;

    // Cloud positions (static seed)
    const clouds = Array.from({ length: 8 }, (_, i) => ({
      x: (i * 197) % CW,
      y: 30 + (i * 73) % 100,
      w: 40 + (i * 31) % 40,
      h: 12 + (i * 17) % 10,
    }));

    const animate = () => {
      const sim = simRef.current;
      const particles = particlesRef.current;
      const ac = acRef.current;
      const thr = thrustRef.current / 100;
      const angle = aoaRef.current;
      const cargo = cargoRef.current;
      const cbs = cbRef.current;

      // ======== PHYSICS ========
      const totalWeight = (ac.emptyWeight + cargo) * 9.81;
      const thrustN = thr * ac.maxThrust;
      const speedMs = sim.speed / 3.6;

      // Lift coefficient: linear up to stall, then drops
      const stalling = angle > ac.stallAngle;
      let cl = 0.3 + angle * 0.11;
      if (stalling) cl = Math.max(0, cl - (angle - ac.stallAngle) * 0.25);
      if (angle < 0) cl = Math.max(-0.5, 0.3 + angle * 0.08);

      const liftN = 0.5 * AIR_DENSITY * speedMs * speedMs * ac.wingArea * cl;
      const cd = 0.025 + (cl * cl) / (Math.PI * 7);
      const dragN = 0.5 * AIR_DENSITY * speedMs * speedMs * ac.wingArea * cd;

      // Update speed
      const accel = (thrustN - dragN) / (ac.emptyWeight + cargo);
      sim.speed = Math.max(0, Math.min(600, sim.speed + accel * 0.008));

      // Update altitude / plane Y
      const netVertical = liftN - totalWeight;
      sim.planeVy += netVertical * 0.000002;
      sim.planeVy *= 0.98; // damping
      sim.planeY -= sim.planeVy;
      sim.planeY = Math.max(60, Math.min(CH - 60, sim.planeY));

      sim.altitude = Math.max(0, sim.altitude + sim.planeVy * 3);

      // Flight state
      let flightState = 'cruising';
      if (stalling) flightState = 'stalling';
      else if (liftN > totalWeight * 1.05 && thrustN > dragN) flightState = 'climbing';
      else if (liftN < totalWeight * 0.9) flightState = 'descending';
      else if (Math.abs(liftN - totalWeight) < totalWeight * 0.1) flightState = 'cruising';

      cbs.onFlightState(flightState);
      cbs.onForces({ lift: liftN, weight: totalWeight, thrust: thrustN, drag: dragN });
      cbs.onAltitude(Math.round(sim.altitude));
      cbs.onSpeed(Math.round(sim.speed));

      // Stall detection
      if (stalling && !sim.wasStalling) {
        sim.wasStalling = true;
        cbs.onStall();
      }
      if (!stalling) sim.wasStalling = false;

      // Cloud scroll
      sim.cloudOffsetX -= sim.speed * 0.003;
      if (sim.cloudOffsetX < -CW) sim.cloudOffsetX += CW;

      // ======== PARTICLES ========
      // Emit air particles from the right (from plane's reference frame, air comes from front)
      while (particles.length < PARTICLE_COUNT) {
        particles.push({
          x: CW + Math.random() * 40,
          y: sim.planeY + (Math.random() - 0.5) * 200,
          vx: -(3 + sim.speed * 0.015 + Math.random()),
          vy: (Math.random() - 0.5) * 0.3,
          life: 1,
          turbulent: false,
        });
      }

      // Wing geometry
      const wingY = sim.planeY;
      const wingLeadX = PLANE_X + ac.bodyW * 0.3;
      const wingTrailX = PLANE_X - ac.bodyW * 0.3;
      const aoaRad = (angle * Math.PI) / 180;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Distance to wing center
        const dx = p.x - PLANE_X;
        const dy = p.y - wingY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Wing interaction zone
        if (Math.abs(dx) < ac.wingSpan * 0.7 && dist < ac.wingSpan * 0.8) {
          const aboveWing = dy < -ac.bodyH * 0.3 * Math.cos(aoaRad) + dx * Math.sin(aoaRad);

          if (stalling && aboveWing && dist < ac.wingSpan * 0.6) {
            // STALL: turbulent swirling above wing
            p.turbulent = true;
            p.vx += (Math.random() - 0.5) * 2;
            p.vy += (Math.random() - 0.5) * 2.5;
            p.life -= 0.015;
          } else if (aboveWing) {
            // Above wing: speed up, deflect upward (lower pressure)
            const speedBoost = 1 + cl * 0.3;
            p.vx *= speedBoost;
            p.vy -= 0.15 + angle * 0.015;
          } else {
            // Below wing: slow down slightly, deflect downward (higher pressure)
            p.vx *= 0.98;
            p.vy += 0.08 + angle * 0.008;
          }

          // Deflect away from wing body
          if (dist < ac.bodyH * 1.5) {
            const pushAngle = Math.atan2(dy, dx);
            p.vx += Math.cos(pushAngle) * 0.5;
            p.vy += Math.sin(pushAngle) * 0.5;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.99;
        p.life -= 0.004;

        if (p.life <= 0 || p.x < -30 || p.y < -20 || p.y > CH + 20) {
          particles.splice(i, 1);
        }
      }

      // ======== DRAW ========
      ctx.clearRect(0, 0, CW, CH);

      // Sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#0a1628');
      bg.addColorStop(0.6, '#1a2d4a');
      bg.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Clouds
      ctx.fillStyle = 'rgba(148,163,184,0.08)';
      for (const c of clouds) {
        const cx = ((c.x + sim.cloudOffsetX) % CW + CW) % CW;
        ctx.beginPath();
        ctx.ellipse(cx, c.y, c.w, c.h, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ground line hint
      if (sim.altitude < 500) {
        const groundY = CH - 10 + (sim.altitude / 500) * 30;
        if (groundY < CH + 20) {
          ctx.fillStyle = '#2d4a2e';
          ctx.fillRect(0, groundY, CW, CH - groundY + 40);
        }
      }

      // Draw particles
      for (const p of particles) {
        const alpha = p.life * 0.6;
        const size = p.turbulent ? 3 + Math.random() * 2 : 3;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        if (p.turbulent) {
          ctx.fillStyle = `rgba(239,68,68,${alpha})`;
          if (p.life > 0.5) {
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 5;
          }
        } else {
          // Color by speed: fast = bright cyan, slow = dim blue
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const t = Math.min(1, spd / 8);
          const r = Math.round(100 + t * 50);
          const g = Math.round(160 + t * 70);
          const b = Math.round(200 + t * 55);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw aircraft
      ctx.save();
      ctx.translate(PLANE_X, sim.planeY);
      ctx.rotate(-aoaRad);

      // Fuselage
      const bw = ac.bodyW;
      const bh = ac.bodyH;
      const fuselageGrad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      fuselageGrad.addColorStop(0, '#475569');
      fuselageGrad.addColorStop(0.5, '#64748b');
      fuselageGrad.addColorStop(1, '#475569');
      ctx.fillStyle = fuselageGrad;
      ctx.beginPath();
      ctx.moveTo(-bw / 2, 0);
      ctx.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 4, -bh / 2);
      ctx.lineTo(bw / 3, -bh / 2);
      ctx.quadraticCurveTo(bw / 2 + 10, 0, bw / 3, bh / 2);
      ctx.lineTo(-bw / 4, bh / 2);
      ctx.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ac.color + '80';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Wings
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = ac.color + '60';
      ctx.lineWidth = 1;
      // Top wing
      ctx.beginPath();
      ctx.moveTo(-ac.wingSpan * 0.1, -bh * 0.3);
      ctx.lineTo(ac.wingSpan * 0.4, -bh * 0.5);
      ctx.lineTo(ac.wingSpan * 0.4, -bh * 0.3);
      ctx.lineTo(-ac.wingSpan * 0.1, -bh * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Bottom wing
      ctx.beginPath();
      ctx.moveTo(-ac.wingSpan * 0.1, bh * 0.3);
      ctx.lineTo(ac.wingSpan * 0.4, bh * 0.5);
      ctx.lineTo(ac.wingSpan * 0.4, bh * 0.3);
      ctx.lineTo(-ac.wingSpan * 0.1, bh * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tail
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + 5, 0);
      ctx.lineTo(-bw / 2 - 15, -bh * 1.2);
      ctx.lineTo(-bw / 2 - 5, -bh * 1.2);
      ctx.lineTo(-bw / 2 + 10, -bh * 0.1);
      ctx.closePath();
      ctx.fill();

      // Thrust glow
      if (thr > 0.05 && ac.maxThrust > 0) {
        const glowR = 6 + thr * 15;
        const glow = ctx.createRadialGradient(-bw / 2 - 5, 0, 2, -bw / 2 - 5, 0, glowR);
        glow.addColorStop(0, `rgba(251,146,60,${thr * 0.8})`);
        glow.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(-bw / 2 - 5, 0, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Force arrows (drawn in world space, not rotated)
      const arrowScale = 0.00005;
      const maxArrow = 80;

      // Lift arrow (up, blue)
      const liftLen = Math.min(maxArrow, Math.abs(liftN) * arrowScale);
      if (liftLen > 3) {
        const lDir = liftN >= 0 ? -1 : 1;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY);
        ctx.lineTo(PLANE_X, sim.planeY + lDir * liftLen);
        ctx.stroke();
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY + lDir * (liftLen + 8));
        ctx.lineTo(PLANE_X - 5, sim.planeY + lDir * liftLen);
        ctx.lineTo(PLANE_X + 5, sim.planeY + lDir * liftLen);
        ctx.closePath();
        ctx.fill();
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LIFT', PLANE_X + 18, sim.planeY + lDir * liftLen / 2);
      }

      // Weight arrow (down, red)
      const weightLen = Math.min(maxArrow, totalWeight * arrowScale);
      if (weightLen > 3) {
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY);
        ctx.lineTo(PLANE_X, sim.planeY + weightLen);
        ctx.stroke();
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY + weightLen + 8);
        ctx.lineTo(PLANE_X - 5, sim.planeY + weightLen);
        ctx.lineTo(PLANE_X + 5, sim.planeY + weightLen);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('WEIGHT', PLANE_X - 24, sim.planeY + weightLen / 2);
      }

      // Thrust arrow (right, green)
      const thrustLen = Math.min(maxArrow, thrustN * arrowScale);
      if (thrustLen > 3) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY);
        ctx.lineTo(PLANE_X + thrustLen, sim.planeY);
        ctx.stroke();
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(PLANE_X + thrustLen + 8, sim.planeY);
        ctx.lineTo(PLANE_X + thrustLen, sim.planeY - 5);
        ctx.lineTo(PLANE_X + thrustLen, sim.planeY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('THRUST', PLANE_X + thrustLen / 2, sim.planeY - 10);
      }

      // Drag arrow (left, orange)
      const dragLen = Math.min(maxArrow, dragN * arrowScale);
      if (dragLen > 3) {
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(PLANE_X, sim.planeY);
        ctx.lineTo(PLANE_X - dragLen, sim.planeY);
        ctx.stroke();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(PLANE_X - dragLen - 8, sim.planeY);
        ctx.lineTo(PLANE_X - dragLen, sim.planeY - 5);
        ctx.lineTo(PLANE_X - dragLen, sim.planeY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('DRAG', PLANE_X - dragLen / 2, sim.planeY - 10);
      }

      // Stall warning
      if (stalling) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STALL!', PLANE_X, sim.planeY - 50);
        ctx.font = '10px monospace';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('Angle too steep — air detaching from wing!', PLANE_X, sim.planeY - 36);
      }

      // Flight state badge
      const stateColor = stalling ? '#ef4444'
        : flightState === 'climbing' ? '#60a5fa'
        : flightState === 'descending' ? '#f87171'
        : flightState === 'cruising' ? '#4ade80' : '#fbbf24';
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      ctx.beginPath();
      const badgeW = 120, badgeH = 24, badgeX = 10, badgeY = 10;
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.fillStyle = stateColor;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(flightState.toUpperCase(), badgeX + 8, badgeY + 16);

      // HUD: Speed & Altitude
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      ctx.beginPath();
      ctx.roundRect(CW - 140, 10, 130, 50, 6);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(sim.speed)} km/h`, CW - 18, 30);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`ALT ${Math.round(sim.altitude)}m`, CW - 18, 50);

      ctx.textAlign = 'start';
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft]);

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
// Main Component: FlightForcesExplorer
// ============================================================================

const FlightForcesExplorer: React.FC<{ data: FlightForcesExplorerData; className?: string }> = ({ data, className }) => {
  const {
    title, description, overview, aircraftType = 'cessna', aircraftName,
    gradeBand = '1-2',
    challenges: dataChallenges, forceDescriptions, flightStateDescriptions,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const challenges = dataChallenges && dataChallenges.length > 0 ? dataChallenges : DEFAULT_CHALLENGES;
  const resolvedAircraftId = (AIRCRAFT_IDS.includes(aircraftType as AircraftId) ? aircraftType : 'cessna') as AircraftId;

  // ---- State ----
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftId>(resolvedAircraftId);
  const [thrustPct, setThrustPct] = useState(50);
  const [aoa, setAoa] = useState(5);
  const [cargoWeight, setCargoWeight] = useState(0);
  const [flightState, setFlightState] = useState('cruising');
  const [forces, setForces] = useState({ lift: 0, weight: 0, thrust: 0, drag: 0 });
  const [altitude, setAltitude] = useState(2000);
  const [speed, setSpeed] = useState(120);
  const [stallCount, setStallCount] = useState(0);
  const [statesExplored, setStatesExplored] = useState<Set<string>>(new Set());
  const [aircraftExplored, setAircraftExplored] = useState<Set<AircraftId>>(new Set([resolvedAircraftId]));

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [challengeResults, setChallengeResults] = useState<{ id: string; correct: boolean }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);

  const resolvedInstanceId = instanceId ?? `flight-forces-${Date.now()}`;
  const allChallengesDone = challengeResults.length >= challenges.length;
  const acDef = AIRCRAFT_DEFS[selectedAircraft];

  // Track flight states explored
  const prevFlightState = useRef('');
  useEffect(() => {
    if (flightState !== prevFlightState.current) {
      setStatesExplored(prev => {
        const next = new Set(prev);
        next.add(flightState);
        return next;
      });
      prevFlightState.current = flightState;
    }
  }, [flightState]);

  // ---- Evaluation ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<FlightForcesExplorerMetrics>({
    primitiveType: 'flight-forces-explorer' as any,
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    aircraft: acDef.label, flightState, thrustPct, aoa, speed, altitude,
    stallCount, statesExplored: statesExplored.size,
    challengeProgress: `${challengeResults.length}/${challenges.length}`,
  }), [acDef.label, flightState, thrustPct, aoa, speed, altitude, stallCount, statesExplored.size, challengeResults.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'flight-forces-explorer' as any,
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'K-2' : '3-5',
  });

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Student is exploring a living flight simulation with particle airflow. `
      + `Aircraft: ${acDef.label}. ${overview}. `
      + `Ask them to watch the air particles flowing around the wing and try changing the angle of attack.`,
      { silent: true },
    );
  }, [isConnected, acDef.label, overview, sendText]);

  // ---- Handlers ----
  const handleAircraftChange = useCallback((id: AircraftId) => {
    setSelectedAircraft(id);
    setAircraftExplored(prev => { const n = new Set(prev); n.add(id); return n; });
    if (isConnected) {
      sendText(
        `[AIRCRAFT_CHANGED] Student switched to ${AIRCRAFT_DEFS[id].label}. Different weight, thrust, and wing area — ask what they expect to change.`,
        { silent: true },
      );
    }
  }, [isConnected, sendText]);

  const thrustTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleThrustChange = useCallback((val: number) => {
    setThrustPct(val);
    if (thrustTimeoutRef.current) clearTimeout(thrustTimeoutRef.current);
    thrustTimeoutRef.current = setTimeout(() => {
      if (isConnected) sendText(`[THRUST_CHANGED] Thrust at ${val}%. Watch the force arrows!`, { silent: true });
    }, 800);
  }, [isConnected, sendText]);

  const aoaTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleAoaChange = useCallback((val: number) => {
    setAoa(val);
    if (aoaTimeoutRef.current) clearTimeout(aoaTimeoutRef.current);
    aoaTimeoutRef.current = setTimeout(() => {
      if (isConnected) {
        const msg = val > acDef.stallAngle
          ? `[AOA_STALL_ZONE] Angle of attack ${val} exceeds stall angle ${acDef.stallAngle}! Ask what they see happening to the particles.`
          : `[AOA_CHANGED] Angle of attack set to ${val}. Watch the particles above and below the wing.`;
        sendText(msg, { silent: true });
      }
    }, 600);
  }, [isConnected, sendText, acDef.stallAngle]);

  const cargoTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleCargoChange = useCallback((val: number) => {
    setCargoWeight(val);
    if (cargoTimeoutRef.current) clearTimeout(cargoTimeoutRef.current);
    cargoTimeoutRef.current = setTimeout(() => {
      if (isConnected) sendText(`[CARGO_CHANGED] Cargo weight: ${val}kg. Total weight increased — what needs to change?`, { silent: true });
    }, 800);
  }, [isConnected, sendText]);

  const simCallbacks = useMemo<SimCallbacks>(() => ({
    onFlightState: setFlightState,
    onForces: setForces,
    onStall: () => {
      setStallCount(c => c + 1);
      if (isConnected) {
        sendText(
          `[STALL] The plane stalled! Air particles detached from the wing. Ask: "What happened to the particles above the wing?"`,
          { silent: true },
        );
      }
    },
    onAltitude: setAltitude,
    onSpeed: setSpeed,
  }), [isConnected, sendText]);

  // Challenge handler
  const handleAnswer = useCallback((optionId: string) => {
    if (answerFeedback) return;
    setSelectedAnswer(optionId);
    const challenge = challenges[currentChallengeIdx];
    const correct = optionId === challenge.correctOptionId;
    setAnswerFeedback(correct ? 'correct' : 'incorrect');

    if (correct) {
      setChallengeResults(prev => [...prev, { id: challenge.id, correct: true }]);
      if (isConnected) sendText(`[CHALLENGE_CORRECT] "${challenge.instruction}" — correct! Connect to what they see in the simulation.`, { silent: true });
      setTimeout(() => {
        setCurrentChallengeIdx(i => i + 1);
        setSelectedAnswer(null);
        setAnswerFeedback(null);
        setShowHint(false);
      }, 1500);
    } else {
      setShowHint(true);
      if (isConnected) sendText(`[CHALLENGE_INCORRECT] "${challenge.instruction}" wrong. Hint: ${challenge.hint}. Guide gently.`, { silent: true });
      setTimeout(() => { setSelectedAnswer(null); setAnswerFeedback(null); }, 2000);
    }
  }, [answerFeedback, challenges, currentChallengeIdx, isConnected, sendText]);

  // Submit evaluation
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const metrics: FlightForcesExplorerMetrics = {
      type: 'flight-forces-explorer',
      flightStatesExplored: statesExplored.size,
      flightStatesTotal: 4,
      aircraftTypesExplored: aircraftExplored.size,
      stallDiscoveries: stallCount,
      challengesCompleted: challengeResults.length,
      challengesCorrect: correctCount,
      challengesTotal: challenges.length,
      attemptsCount: 1,
    };
    const score =
      (statesExplored.size / 4) * 15 +
      (stallCount > 0 ? 20 : 5) +
      (aircraftExplored.size > 1 ? 15 : 5) +
      (correctCount / Math.max(challenges.length, 1)) * 50;

    submitEvaluation(score >= 40, Math.round(score), metrics, { aircraftType: selectedAircraft });

    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Score: ${Math.round(score)}%. States: ${statesExplored.size}/4. Stalls: ${stallCount}. `
        + `Challenges: ${correctCount}/${challenges.length}. Summarize the four forces of flight!`,
        { silent: true },
      );
    }
  }, [hasSubmittedEvaluation, challengeResults, statesExplored.size, aircraftExplored.size, stallCount, challenges.length, selectedAircraft, submitEvaluation, isConnected, sendText]);

  const currentChallenge = challenges[currentChallengeIdx];
  const maxCargo = Math.floor(acDef.emptyWeight * 0.3);

  // ---- Render ----
  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border border-sky-500/30 shadow-lg">
          <span className="text-2xl">{acDef.emoji}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <p className="text-xs text-sky-400 font-mono uppercase tracking-wider">
              Living Flight Lab
            </p>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-lg">{aircraftName || acDef.label}</CardTitle>
              <p className="text-slate-400 text-sm mt-1">{overview}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className={`bg-white/5 border-white/20 text-slate-300 ${flightState === 'stalling' ? 'border-red-500/50 text-red-300' : ''}`}>
                {flightState}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                Grades {gradeBand}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Simulation Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
            <FlightSimulation
              aircraft={acDef}
              thrustPct={thrustPct}
              aoa={aoa}
              cargoWeight={cargoWeight}
              callbacks={simCallbacks}
            />
            {statesExplored.size <= 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/10">
                <p className="text-slate-400 text-xs">Adjust the sliders to see how forces change!</p>
              </div>
            )}
          </div>

          {/* Aircraft Selector */}
          <div className="space-y-2">
            <label className="text-slate-400 text-xs font-mono uppercase tracking-wider block">Aircraft</label>
            <div className="flex gap-2 flex-wrap">
              {AIRCRAFT_IDS.map(id => {
                const def = AIRCRAFT_DEFS[id];
                return (
                  <Button key={id} variant="ghost" size="sm"
                    onClick={() => handleAircraftChange(id)}
                    className={`${selectedAircraft === id
                      ? 'bg-white/15 ring-1 ring-white/30 text-white'
                      : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-1.5">{def.emoji}</span> {def.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Thrust */}
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                Thrust
              </label>
              <input type="range" min={0} max={100} value={thrustPct}
                onChange={e => handleThrustChange(Number(e.target.value))}
                className="w-full accent-green-500"
                disabled={acDef.maxThrust === 0}
              />
              <div className="flex justify-between mt-1">
                <span className="text-slate-500 text-xs">0%</span>
                <span className="text-green-300 text-sm font-mono font-bold">
                  {acDef.maxThrust === 0 ? 'No engine' : `${thrustPct}%`}
                </span>
                <span className="text-slate-500 text-xs">100%</span>
              </div>
            </div>

            {/* Angle of Attack */}
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                Angle of Attack
              </label>
              <input type="range" min={-5} max={25} step={0.5} value={aoa}
                onChange={e => handleAoaChange(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-slate-500 text-xs">-5&deg;</span>
                <span className={`text-sm font-mono font-bold ${aoa > acDef.stallAngle ? 'text-red-400 animate-pulse' : 'text-sky-300'}`}>
                  {aoa}&deg; {aoa > acDef.stallAngle ? 'STALL!' : ''}
                </span>
                <span className="text-slate-500 text-xs">25&deg;</span>
              </div>
            </div>

            {/* Cargo Weight */}
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                Cargo
              </label>
              <input type="range" min={0} max={maxCargo} step={Math.max(1, Math.floor(maxCargo / 50))} value={cargoWeight}
                onChange={e => handleCargoChange(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-slate-500 text-xs">Empty</span>
                <span className="text-orange-300 text-sm font-mono font-bold">{cargoWeight}kg</span>
                <span className="text-slate-500 text-xs">{maxCargo}kg</span>
              </div>
            </div>
          </div>

          {/* Force Readout */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Lift', val: forces.lift, color: '#60a5fa', dir: '\u2191' },
              { label: 'Weight', val: forces.weight, color: '#f87171', dir: '\u2193' },
              { label: 'Thrust', val: forces.thrust, color: '#4ade80', dir: '\u2192' },
              { label: 'Drag', val: forces.drag, color: '#fb923c', dir: '\u2190' },
            ].map(f => (
              <div key={f.label} className="text-center p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <span className="text-lg" style={{ color: f.color }}>{f.dir}</span>
                <p className="text-xs text-slate-400">{f.label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: f.color }}>
                  {f.val >= 1000 ? `${(f.val / 1000).toFixed(1)}kN` : `${f.val.toFixed(0)}N`}
                </p>
              </div>
            ))}
          </div>

          {/* Discovery Cards */}
          {stallCount > 0 && (
            <Card className="backdrop-blur-xl bg-red-500/5 border-red-500/20 animate-fade-in">
              <CardContent className="py-4 space-y-2">
                <h4 className="text-red-200 font-semibold text-sm flex items-center gap-2">
                  <span>&#x26A0;&#xFE0F;</span> Stall Discovered!
                </h4>
                <p className="text-slate-300 text-sm">
                  When the angle of attack is too steep, air particles <span className="text-red-300 font-medium">detach from the wing surface</span> and
                  swirl turbulently. Lift collapses and the plane drops. Real pilots train to recover from stalls!
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
          {!hasSubmittedEvaluation && (statesExplored.size > 1 || challengeResults.length > 0) && (
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
                Exploration complete! You discovered how the four forces of flight work!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FlightForcesExplorer;
