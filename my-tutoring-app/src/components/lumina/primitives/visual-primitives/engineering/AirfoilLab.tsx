'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Wind, AlertTriangle, Target, Trophy, BarChart3 } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface AirfoilShape {
  shape: 'flat' | 'symmetric' | 'cambered' | 'thick' | 'supercritical' | 'bird_wing' | 'custom';
  name: string;
  description: string;
  imagePrompt?: string;
}

export interface AerodynamicResults {
  liftCoefficient: number;
  dragCoefficient: number;
  liftForce: number;     // N
  dragForce: number;     // N
  stallAngle: number;    // degrees
}

export interface PresetComparison {
  name: string;
  airfoilA: string;
  airfoilB: string;
  question: string;
  explanation: string;
}

export interface AirfoilChallenge {
  scenario: string;
  targetLift: 'high' | 'medium' | 'low';
  targetDrag: 'high' | 'medium' | 'low';
  hint: string;
}

export interface AirfoilLabData {
  airfoil: AirfoilShape;
  initialConditions: {
    angleOfAttack: number;  // degrees
    windSpeed: number;      // m/s
    airDensity: number;     // kg/m^3, default 1.225
  };
  results: AerodynamicResults;
  presetComparisons: PresetComparison[];
  challenges: AirfoilChallenge[];
  visualizationOptions: {
    streamlines: boolean;
    pressureMap: boolean;
    velocityMap: boolean;
    particleMode: boolean;
    forceGauges: boolean;
    stallVisualization: boolean;
  };
  gradeBand: '1-2' | '3-5';
  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

interface AirfoilLabProps {
  data: AirfoilLabData;
  className?: string;
}

// ============================================================================
// Physics Constants — Component owns all geometry & physics
// ============================================================================

const CW = 800;
const CH = 400;
const CX = CW * 0.45;
const CY = CH / 2;
const CHORD = 200;

const MIN_AOA = -5;
const MAX_AOA = 25;
const DRAG_SENSITIVITY = 0.22; // degrees per pixel of vertical drag

const PARTICLE_COUNT = 140;

type ShapeId = AirfoilShape['shape'];

interface ShapePeaks { topPeak: number; botPeak: number }

const ALL_SHAPES: ShapeId[] = [
  'flat', 'symmetric', 'cambered', 'thick', 'supercritical', 'bird_wing', 'custom',
];

const SHAPE_LABELS: Record<ShapeId, string> = {
  flat: 'Flat Plate',
  symmetric: 'Symmetric',
  cambered: 'Cambered',
  thick: 'Thick',
  supercritical: 'Supercritical',
  bird_wing: 'Bird Wing',
  custom: 'Custom',
};

// Peak half-thickness in pixels for chord=200. Controls both the drawn silhouette
// and the deflection strength experienced by particles above/below.
function getShapePeaks(shape: ShapeId, camber: number): ShapePeaks {
  switch (shape) {
    case 'flat':          return { topPeak: 4,  botPeak: 4  };
    case 'symmetric':     return { topPeak: 18, botPeak: 18 };
    case 'cambered':      return { topPeak: 28, botPeak: 8  };
    case 'thick':         return { topPeak: 32, botPeak: 24 };
    case 'supercritical': return { topPeak: 12, botPeak: 22 };
    case 'bird_wing':     return { topPeak: 34, botPeak: 6  };
    case 'custom':        return { topPeak: 8 + camber * 30, botPeak: 4 + camber * 12 };
  }
}

// Baseline lift coefficient per shape — used only for the physics-formula
// readout/challenge scoring. The visible lift arrow is driven by the particle
// density differential, not this value.
const SHAPE_CL_BASE: Record<ShapeId, number> = {
  flat: 0.0,
  symmetric: 0.0,
  cambered: 0.5,
  thick: 0.6,
  supercritical: 0.7,
  bird_wing: 0.8,
  custom: 0.4,
};

// ============================================================================
// Airfoil geometry helpers
// ============================================================================

// Airfoil path in local frame (centered on origin, chord along x-axis).
// Uses a parabolic thickness envelope — simple, visually correct, collision-friendly.
function drawAirfoilBody(ctx: CanvasRenderingContext2D, peaks: ShapePeaks) {
  const half = CHORD / 2;
  const { topPeak, botPeak } = peaks;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  // Top curve: leading -> peak (~0.35 chord) -> trailing
  ctx.bezierCurveTo(-half * 0.55, -topPeak * 0.9, half * 0.15, -topPeak * 0.85, half, 0);
  // Bottom curve: trailing -> peak (~0.35 chord) -> leading
  ctx.bezierCurveTo(half * 0.15, botPeak * 0.85, -half * 0.55, botPeak * 0.9, -half, 0);
  ctx.closePath();
}

// Half-thickness at a given normalized x along the chord (xNorm in [0, 1]).
// Matches the parabolic envelope used by drawAirfoilBody for collision checks.
function thicknessAt(peaks: ShapePeaks, xNorm: number): { top: number; bot: number } {
  const t = Math.max(0, 4 * xNorm * (1 - xNorm));
  return { top: peaks.topPeak * t, bot: peaks.botPeak * t };
}

// ============================================================================
// Particle type
// ============================================================================

interface AirParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  turbulent: boolean;
  baseSpeed: number;
}

// ============================================================================
// Canvas Sub-component: WindTunnelSimulation
// ============================================================================

interface TunnelCallbacks {
  onStall: (isStalling: boolean) => void;
  onLiftSignal: (signal: number) => void; // -1..1, observed pressure differential
  onAoaChange: (aoa: number) => void;
  onGrab: () => void;
}

const WindTunnelSimulation: React.FC<{
  shape: ShapeId;
  camber: number;
  aoa: number;
  windSpeed: number;
  stallAngle: number;
  callbacks: TunnelCallbacks;
}> = ({ shape, camber, aoa, windSpeed, stallAngle, callbacks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<AirParticle[]>([]);
  const animRef = useRef<number>(0);

  const shapeRef = useRef(shape);
  const camberRef = useRef(camber);
  const aoaRef = useRef(aoa);
  const windRef = useRef(windSpeed);
  const stallRef = useRef(stallAngle);
  const cbRef = useRef(callbacks);
  useEffect(() => { shapeRef.current = shape; }, [shape]);
  useEffect(() => { camberRef.current = camber; }, [camber]);
  useEffect(() => { aoaRef.current = aoa; }, [aoa]);
  useEffect(() => { windRef.current = windSpeed; }, [windSpeed]);
  useEffect(() => { stallRef.current = stallAngle; }, [stallAngle]);
  useEffect(() => { cbRef.current = callbacks; }, [callbacks]);

  const dragRef = useRef({
    dragging: false,
    hovering: false,
    hasGrabbed: false,
    startPointerY: 0,
    startAoa: 0,
  });
  const wasStallingRef = useRef(false);
  const [cursor, setCursor] = useState<'default' | 'grab' | 'grabbing'>('default');

  // ======== Animation loop ========
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const particles = particlesRef.current;
      const curShape = shapeRef.current;
      const curCamber = camberRef.current;
      const curAoa = aoaRef.current;
      const curWind = windRef.current;
      const curStall = stallRef.current;
      const cbs = cbRef.current;

      const isStalling = curAoa > curStall;
      const peaks = getShapePeaks(curShape, curCamber);
      const aoaRad = (curAoa * Math.PI) / 180;
      const cos = Math.cos(aoaRad);
      const sin = Math.sin(aoaRad);

      // ======== Spawn particles ========
      const baseSpeed = 1.5 + curWind * 0.12; // pixels/frame
      while (particles.length < PARTICLE_COUNT) {
        particles.push({
          x: -10 - Math.random() * 40,
          y: 30 + Math.random() * (CH - 60),
          vx: baseSpeed * (0.9 + Math.random() * 0.2),
          vy: (Math.random() - 0.5) * 0.2,
          life: 1,
          turbulent: false,
          baseSpeed,
        });
      }

      // ======== Update particles ========
      let aboveCount = 0;
      let belowCount = 0;
      const upperSampleY = [CY - 55, CY - 8];
      const lowerSampleY = [CY + 8, CY + 55];
      const sampleX = [CX - 90, CX + 90];

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Transform particle position to airfoil-local frame
        const dx = p.x - CX;
        const dy = p.y - CY;
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;

        const half = CHORD / 2;
        const inXRange = lx >= -half - 25 && lx <= half + 30;

        if (inXRange) {
          const xNorm = Math.max(0, Math.min(1, (lx + half) / CHORD));
          const { top, bot } = thicknessAt(peaks, xNorm);

          if (isStalling && ly < 0 && xNorm > 0.18 && xNorm < 0.95) {
            // Stall: upper flow detaches and swirls turbulently
            p.turbulent = true;
            p.vx += (Math.random() - 0.5) * 1.6;
            p.vy += (Math.random() - 0.5) * 2.2;
            p.life -= 0.014;
          } else if (ly < 0 && -ly < top + 45) {
            // Above wing: accelerate, deflect upward (low pressure)
            const proximity = Math.max(0, 1 - Math.abs(ly + (top + 8)) / (top + 45));
            p.vx *= 1 + 0.25 * proximity * (1 + Math.max(0, curAoa) * 0.05);
            // Bend particle trajectory to follow the upper surface
            p.vy += (-0.6 - curAoa * 0.02) * proximity;
            if (-ly < top + 3) {
              p.vy -= 1.2; // push out of body
            }
            p.turbulent = false;
          } else if (ly > 0 && ly < bot + 35) {
            // Below wing: decelerate, slight downward deflection (high pressure = pile-up)
            const proximity = Math.max(0, 1 - Math.abs(ly - (bot + 6)) / (bot + 35));
            p.vx *= 1 - 0.10 * proximity;
            p.vy += (0.35 + Math.max(0, curAoa) * 0.012) * proximity;
            if (ly < bot + 3) {
              p.vy += 1.0; // push out of body
            }
            p.turbulent = false;
          } else {
            p.turbulent = false;
          }
        } else {
          p.turbulent = false;
        }

        // Integrate
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.93;
        // Return to baseline horizontal speed (so effects are local to the wing)
        p.vx += (p.baseSpeed - p.vx) * 0.03;
        p.life -= 0.003;

        // Sample pressure zones (world-frame rectangles near the airfoil)
        if (p.x >= sampleX[0] && p.x <= sampleX[1]) {
          if (p.y >= upperSampleY[0] && p.y <= upperSampleY[1]) aboveCount++;
          else if (p.y >= lowerSampleY[0] && p.y <= lowerSampleY[1]) belowCount++;
        }

        if (p.life <= 0 || p.x > CW + 30 || p.y < -30 || p.y > CH + 30) {
          particles.splice(i, 1);
        }
      }

      // ======== Pressure differential → observed lift signal ========
      const totalSampled = aboveCount + belowCount;
      // When upper is starved (fewer particles = lower pressure), signal is positive
      const liftSignal = totalSampled > 5
        ? (belowCount - aboveCount) / Math.max(20, totalSampled)
        : 0;
      const clampedSignal = Math.max(-1, Math.min(1, liftSignal * 2.2));
      cbs.onLiftSignal(clampedSignal);

      if (isStalling !== wasStallingRef.current) {
        wasStallingRef.current = isStalling;
        cbs.onStall(isStalling);
      }

      // ======== Draw ========
      ctx.clearRect(0, 0, CW, CH);

      // Sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      bg.addColorStop(0, '#0c1629');
      bg.addColorStop(1, '#1a2744');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CW, CH);

      // Faint grid
      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < CW; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
      }
      for (let y = 0; y < CH; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
      }

      // Pressure zone labels (shown once student has seen particles settle)
      if (totalSampled > 20) {
        const upperDensity = aboveCount / 40; // rough normalization
        const lowerDensity = belowCount / 40;

        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = `rgba(96,165,250,${0.35 + Math.min(0.4, Math.max(0, 0.5 - upperDensity) * 0.8)})`;
        ctx.fillText('LOW PRESSURE (fast, spread out)', sampleX[1] + 8, upperSampleY[0] + 20);
        ctx.fillStyle = `rgba(248,113,113,${0.35 + Math.min(0.4, lowerDensity * 0.6)})`;
        ctx.fillText('HIGH PRESSURE (slow, bunched)', sampleX[1] + 8, lowerSampleY[1] - 6);
      }

      // Draw particles
      for (const p of particles) {
        const alpha = p.life * 0.75;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const size = p.turbulent ? 3 + Math.random() * 2 : 2.6;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        if (p.turbulent) {
          ctx.fillStyle = `rgba(239,68,68,${alpha})`;
        } else {
          // Color by speed: faster = brighter cyan
          const tNorm = Math.min(1, Math.max(0, (spd - baseSpeed * 0.7) / (baseSpeed * 0.6)));
          const r = Math.round(96 + tNorm * 70);
          const g = Math.round(165 + tNorm * 60);
          const b = Math.round(250);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        }
        ctx.fill();
      }

      // Draw airfoil (rotated around CX, CY)
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(-aoaRad);

      // Grab affordance ring
      if (dragRef.current.dragging || dragRef.current.hovering) {
        const ringR = CHORD * 0.55;
        const pulse = dragRef.current.dragging ? 1 : 0.6 + Math.sin(Date.now() * 0.006) * 0.2;
        ctx.strokeStyle = dragRef.current.dragging
          ? `rgba(96,165,250,${0.85 * pulse})`
          : `rgba(148,197,255,${0.55 * pulse})`;
        ctx.lineWidth = dragRef.current.dragging ? 2.5 : 1.5;
        ctx.setLineDash(dragRef.current.dragging ? [] : [4, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 0, ringR, peaks.topPeak * 0.7 + 28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Airfoil body
      drawAirfoilBody(ctx, peaks);
      ctx.fillStyle = isStalling ? '#64748b' : '#94a3b8';
      ctx.strokeStyle = isStalling ? '#ef4444' : '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Chord line (reference)
      ctx.strokeStyle = 'rgba(71,85,105,0.55)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(-CHORD / 2, 0);
      ctx.lineTo(CHORD / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();

      // Lift arrow — length proportional to observed particle density delta
      const liftLen = Math.abs(clampedSignal) * 90;
      if (liftLen > 4) {
        const dir = clampedSignal >= 0 ? -1 : 1;
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#3b82f6';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX, CY + dir * liftLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(CX, CY + dir * (liftLen + 10));
        ctx.lineTo(CX - 7, CY + dir * (liftLen - 2));
        ctx.lineTo(CX + 7, CY + dir * (liftLen - 2));
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('LIFT', CX + 14, CY + dir * liftLen / 2);
        ctx.lineCap = 'butt';
      }

      // Wind direction indicator
      ctx.font = '12px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(`Wind: ${curWind.toFixed(0)} m/s`, 18, 28);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 40); ctx.lineTo(80, 40);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(86, 40); ctx.lineTo(78, 36); ctx.lineTo(78, 44); ctx.closePath();
      ctx.fill();

      // AoA readout
      ctx.textAlign = 'right';
      ctx.fillStyle = isStalling ? '#f87171' : '#a78bfa';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`AoA: ${curAoa.toFixed(1)}\u00B0${isStalling ? ' STALL!' : ''}`, CW - 18, 28);

      // Grab hint (before first grab)
      if (!dragRef.current.hasGrabbed && !dragRef.current.dragging) {
        const pulse = 0.55 + Math.sin(Date.now() * 0.004) * 0.25;
        ctx.fillStyle = `rgba(148,197,255,${pulse})`;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('\u2195 Grab the airfoil and drag up or down to rotate', CX, CY + 90);
      }

      ctx.textAlign = 'start';
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Reset particle pool when shape changes drastically (keeps flow coherent)
  useEffect(() => {
    particlesRef.current = [];
  }, [shape]);

  // ======== Pointer handlers: direct manipulation of the airfoil ========
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (CW / rect.width),
        y: (clientY - rect.top) * (CH / rect.height),
      };
    };

    const hitTestAirfoil = (cx: number, cy: number) => {
      // Generous AABB in world frame — easy to grab even on steep AoA
      const halfW = CHORD / 2 + 20;
      const halfH = 45;
      return Math.abs(cx - CX) <= halfW && Math.abs(cy - CY) <= halfH;
    };

    const clampAoa = (v: number) => Math.max(MIN_AOA, Math.min(MAX_AOA, v));

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      if (!hitTestAirfoil(x, y)) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      dragRef.current.dragging = true;
      dragRef.current.startPointerY = y;
      dragRef.current.startAoa = aoaRef.current;
      if (!dragRef.current.hasGrabbed) {
        dragRef.current.hasGrabbed = true;
        cbRef.current.onGrab();
      }
      setCursor('grabbing');
    };

    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      const drag = dragRef.current;

      if (drag.dragging) {
        // Dragging up (smaller y) tilts the leading edge UP (higher AoA)
        const delta = (drag.startPointerY - y) * DRAG_SENSITIVITY;
        const next = clampAoa(drag.startAoa + delta);
        aoaRef.current = next;
        cbRef.current.onAoaChange(next);
        return;
      }

      const over = hitTestAirfoil(x, y);
      if (over !== drag.hovering) {
        drag.hovering = over;
        setCursor(over ? 'grab' : 'default');
      }
    };

    const endDrag = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.dragging) return;
      drag.dragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
      setCursor(drag.hovering ? 'grab' : 'default');
    };

    const onPointerLeave = () => {
      if (!dragRef.current.dragging) {
        dragRef.current.hovering = false;
        setCursor('default');
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', onPointerLeave);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="rounded-xl w-full"
      style={{ maxWidth: CW, imageRendering: 'auto', cursor, touchAction: 'none' }}
    />
  );
};

// ============================================================================
// Main Component: AirfoilLab ("Living Wind Tunnel")
// ============================================================================

const AirfoilLab: React.FC<AirfoilLabProps> = ({ data, className }) => {
  // ---- State ----
  const [angleOfAttack, setAngleOfAttack] = useState(data.initialConditions.angleOfAttack);
  const [windSpeed, setWindSpeed] = useState(data.initialConditions.windSpeed);
  const [selectedShape, setSelectedShape] = useState<ShapeId>(data.airfoil.shape);
  const [camber, setCamber] = useState(0.5);
  const [shapesExplored, setShapesExplored] = useState<Set<string>>(new Set([data.airfoil.shape]));
  const [variablesManipulated, setVariablesManipulated] = useState<Set<string>>(new Set());
  const [stallDiscovered, setStallDiscovered] = useState(false);
  const [compareModeActive, setCompareModeActive] = useState(false);
  const [comparisonCompleted, setComparisonCompleted] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<AirfoilChallenge | null>(null);
  const [challengeOptimality, setChallengeOptimality] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [compareShape, setCompareShape] = useState<ShapeId>('symmetric');
  const [hasGrabbedAirfoil, setHasGrabbedAirfoil] = useState(false);
  const [observedLiftSignal, setObservedLiftSignal] = useState(0);

  // ---- Physics-formula computation (used for Results card & challenge scoring).
  // The visible LIFT arrow in the Canvas is driven by the observed particle
  // density delta — this formula provides a stable numeric readout.
  const computedResults = useMemo(() => {
    const clBase = selectedShape === 'custom'
      ? camber * 0.8
      : (SHAPE_CL_BASE[selectedShape] ?? 0.3);
    const cl = clBase + angleOfAttack * (2 * Math.PI / 180);
    const isStalled = angleOfAttack > data.results.stallAngle;
    const effectiveCl = isStalled ? cl * 0.3 : cl;

    const cd0 = 0.01 + (selectedShape === 'thick' ? 0.01 : 0);
    const cdInduced = effectiveCl ** 2 / (Math.PI * 6);
    const cd = cd0 + cdInduced + (isStalled ? 0.1 : 0);

    const q = 0.5 * data.initialConditions.airDensity * windSpeed ** 2;
    return {
      effectiveCl,
      cd,
      liftForce: q * effectiveCl,
      dragForce: q * cd,
      isStalled,
    };
  }, [selectedShape, camber, angleOfAttack, windSpeed, data.initialConditions.airDensity, data.results.stallAngle]);

  // ---- Evaluation ----
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'airfoil-lab' as any,
    instanceId: data.instanceId || 'airfoil-lab-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ---- AI Tutoring ----
  const { sendText } = useLuminaAI({
    primitiveType: 'airfoil-lab' as any,
    instanceId: data.instanceId || `al-${Date.now()}`,
    primitiveData: {
      airfoilName: data.airfoil.name,
      airfoilShape: selectedShape,
      angleOfAttack,
      windSpeed,
      liftForce: computedResults.liftForce,
      dragForce: computedResults.dragForce,
      stallAngle: data.results.stallAngle,
      hasGrabbedAirfoil,
      observedLiftSignal,
      compareModeActive,
    },
    gradeLevel: data.gradeBand === '1-2' ? 'kindergarten' : 'elementary',
  });

  // ---- Intro message ----
  const introducedRef = useRef(false);
  useEffect(() => {
    if (introducedRef.current) return;
    introducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Student is exploring a living wind tunnel for the ${data.airfoil.name} airfoil. `
      + `Air particles flow left-to-right and split above/below the wing. Above = faster and spread out (low pressure). `
      + `Below = slower and bunched up (high pressure). The student rotates the airfoil directly by grabbing and dragging it. `
      + `Encourage them to grab the airfoil and tilt it up gently, then watch the particles above speed up.`,
      { silent: true },
    );
  }, [sendText, data.airfoil.name]);

  // ---- Handlers ----
  const handleShapeChange = useCallback((shape: ShapeId) => {
    setSelectedShape(shape);
    setShapesExplored(prev => new Set(prev).add(shape));
    setVariablesManipulated(prev => new Set(prev).add('shape'));
    setAttemptsCount(c => c + 1);
    sendText(`[SHAPE_CHANGED] Student selected airfoil shape: ${SHAPE_LABELS[shape]}. Ask what they expect to see in the particle flow.`, { silent: true });
  }, [sendText]);

  const aoaNarrationRef = useRef<ReturnType<typeof setTimeout>>();
  const lastNarratedAoaRef = useRef(angleOfAttack);
  const handleAngleChange = useCallback((newAngle: number) => {
    const rounded = Math.round(newAngle * 2) / 2;
    setAngleOfAttack(rounded);
    setVariablesManipulated(prev => new Set(prev).add('angle'));

    if (aoaNarrationRef.current) clearTimeout(aoaNarrationRef.current);
    aoaNarrationRef.current = setTimeout(() => {
      if (Math.abs(rounded - lastNarratedAoaRef.current) < 2) return;
      lastNarratedAoaRef.current = rounded;
      const msg = rounded > data.results.stallAngle
        ? `[AOA_STALL_ZONE] Student tilted the airfoil to ${rounded.toFixed(1)} degrees — past stall angle ${data.results.stallAngle}. Ask what happened to the particles above the wing.`
        : `[AOA_DRAGGED] Student rotated the airfoil to ${rounded.toFixed(1)} degrees. Ask what they notice about particle spacing above vs below.`;
      sendText(msg, { silent: true });
    }, 900);
  }, [sendText, data.results.stallAngle]);

  const handleWindSpeedChange = useCallback((speed: number) => {
    setWindSpeed(speed);
    setVariablesManipulated(prev => new Set(prev).add('windSpeed'));
  }, []);

  const handleToggleCompare = useCallback(() => {
    const next = !compareModeActive;
    setCompareModeActive(next);
    if (next) sendText(`[COMPARISON_STARTED] Compare mode activated`, { silent: true });
  }, [compareModeActive, sendText]);

  // ---- Sim callbacks ----
  const tunnelCallbacks = useMemo<TunnelCallbacks>(() => ({
    onStall: (isStalling) => {
      if (isStalling && !stallDiscovered) {
        setStallDiscovered(true);
        sendText(
          `[STALL_REACHED] Student tilted past stall — particles just detached from the upper surface and started swirling. Ask: "What happened to the particles above the wing?"`,
          { silent: true },
        );
      }
    },
    onLiftSignal: setObservedLiftSignal,
    onAoaChange: handleAngleChange,
    onGrab: () => {
      setHasGrabbedAirfoil(true);
      sendText(
        `[AIRFOIL_GRABBED] Student just grabbed the airfoil for the first time. Encourage them to pull the leading edge up gently and watch the particles above spread apart and speed up.`,
        { silent: true },
      );
    },
  }), [handleAngleChange, sendText, stallDiscovered]);

  // ---- Compare mode: second shape's physics (stat card only — main tunnel stays live) ----
  const compareResults = useMemo(() => {
    if (!compareModeActive) return null;
    const clBase = SHAPE_CL_BASE[compareShape] ?? 0.3;
    const cl = clBase + angleOfAttack * (2 * Math.PI / 180);
    const isStalled = angleOfAttack > data.results.stallAngle;
    const effectiveCl = isStalled ? cl * 0.3 : cl;
    const cd0 = 0.01 + (compareShape === 'thick' ? 0.01 : 0);
    const cdInduced = effectiveCl ** 2 / (Math.PI * 6);
    const cd = cd0 + cdInduced + (isStalled ? 0.1 : 0);
    const q = 0.5 * data.initialConditions.airDensity * windSpeed ** 2;
    return { liftForce: q * effectiveCl, dragForce: q * cd, effectiveCl, cd, isStalled };
  }, [compareModeActive, compareShape, angleOfAttack, windSpeed, data.initialConditions.airDensity, data.results.stallAngle]);

  // ---- Challenge evaluation ----
  const evaluateChallenge = useCallback(() => {
    if (!activeChallenge) return;
    const liftLevel = computedResults.liftForce > 500 ? 'high' : computedResults.liftForce > 100 ? 'medium' : 'low';
    const dragLevel = computedResults.dragForce > 50 ? 'high' : computedResults.dragForce > 10 ? 'medium' : 'low';

    const liftMatch = liftLevel === activeChallenge.targetLift;
    const dragMatch = dragLevel === activeChallenge.targetDrag;
    const score = (liftMatch ? 50 : 0) + (dragMatch ? 50 : 0);
    setChallengeOptimality(score);

    sendText(
      `[CHALLENGE_RESULT] Challenge "${activeChallenge.scenario}" — Lift target ${activeChallenge.targetLift} (got ${liftLevel}), Drag target ${activeChallenge.targetDrag} (got ${dragLevel}). Score ${score}/100.`,
      { silent: true },
    );

    if (!hasSubmitted) {
      submitResult(
        score >= 50,
        score,
        {
          type: 'airfoil-lab',
          shapesExplored: shapesExplored.size,
          variablesManipulated: variablesManipulated.size,
          stallDiscovered,
          challengeScore: score,
          attemptsCount,
          comparisonCompleted,
        } as any,
        {
          selectedShape,
          angleOfAttack,
          windSpeed,
          liftForce: computedResults.liftForce,
          dragForce: computedResults.dragForce,
        },
      );
    }
  }, [
    activeChallenge, computedResults, shapesExplored, variablesManipulated,
    stallDiscovered, attemptsCount, comparisonCompleted, hasSubmitted,
    submitResult, sendText, selectedShape, angleOfAttack, windSpeed,
  ]);

  const ldRatio = computedResults.dragForce > 0.001
    ? (computedResults.liftForce / computedResults.dragForce)
    : Infinity;

  // ---- Render ----
  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <Wind className="w-7 h-7 text-cyan-400" />
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{data.airfoil.name}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              Living Wind Tunnel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 text-xs">
            {SHAPE_LABELS[selectedShape]}
          </Badge>
          <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">
            Grades {data.gradeBand}
          </Badge>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{data.airfoil.description}</p>
          </div>

          {/* Stall warning */}
          {computedResults.isStalled && (
            <div className="mb-4 flex justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/20 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="font-mono text-sm font-bold text-red-300">
                  STALL! Particles detached from the wing — lift collapsed
                </span>
              </div>
            </div>
          )}

          {/* Main layout: Canvas + controls */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            {/* Canvas wind tunnel (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
                <CardContent className="p-0 relative">
                  <WindTunnelSimulation
                    shape={selectedShape}
                    camber={camber}
                    aoa={angleOfAttack}
                    windSpeed={windSpeed}
                    stallAngle={data.results.stallAngle}
                    callbacks={tunnelCallbacks}
                  />
                  {!hasGrabbedAirfoil && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/85 px-4 py-1.5 rounded-full border border-cyan-400/30 shadow-lg shadow-cyan-500/10">
                      <p className="text-cyan-200 text-xs font-medium">
                        <span className="mr-1">{'\u270B'}</span>
                        Grab the airfoil and drag up or down to rotate it
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observed lift indicator (particle-driven) */}
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Observed Lift</span>
                <div className="flex-1 h-2 bg-slate-900/60 rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 h-full transition-all duration-200"
                    style={{
                      left: observedLiftSignal >= 0 ? '50%' : `${50 + observedLiftSignal * 50}%`,
                      width: `${Math.abs(observedLiftSignal) * 50}%`,
                      background: observedLiftSignal >= 0
                        ? 'linear-gradient(to right, #3b82f6, #60a5fa)'
                        : 'linear-gradient(to left, #f87171, #ef4444)',
                    }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
                </div>
                <span className={`text-xs font-mono font-bold ${observedLiftSignal >= 0 ? 'text-sky-300' : 'text-red-300'}`}>
                  {observedLiftSignal >= 0 ? '\u2191' : '\u2193'} {(observedLiftSignal * 100).toFixed(0)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 text-center font-mono">
                Driven by particle density differential (fewer above = lower pressure = lift)
              </p>
            </div>

            {/* Controls (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Shape selector */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-slate-300">Airfoil Shape</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_SHAPES.map(s => (
                      <Button
                        key={s}
                        variant="ghost"
                        size="sm"
                        className={`text-xs justify-start ${
                          selectedShape === s
                            ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                        }`}
                        onClick={() => handleShapeChange(s)}
                      >
                        {SHAPE_LABELS[s]}
                      </Button>
                    ))}
                  </div>

                  {selectedShape === 'custom' && (
                    <div className="mt-3">
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        Camber: <span className="text-cyan-400 font-bold">{(camber * 100).toFixed(0)}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={camber}
                        onChange={e => setCamber(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Angle of Attack readout (hand-driven, no slider) */}
              <Card className={`backdrop-blur-xl border ${computedResults.isStalled ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-900/40 border-white/10'}`}>
                <CardContent className="pt-4">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Angle of Attack</span>
                    <span className="text-[10px] text-cyan-400 normal-case tracking-normal">{'\u270B'} hand-driven</span>
                  </label>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-mono font-bold ${computedResults.isStalled ? 'text-red-300 animate-pulse' : 'text-purple-400'}`}>
                      {angleOfAttack.toFixed(1)}&deg;
                    </span>
                    {computedResults.isStalled && <span className="text-red-300 text-xs font-bold">STALL!</span>}
                  </div>
                  <p className="text-slate-500 text-[10px] mt-1">
                    Stall angle: {data.results.stallAngle}&deg; {'\u00B7'} Drag the airfoil to rotate
                  </p>
                </CardContent>
              </Card>

              {/* Wind speed slider */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardContent className="pt-4">
                  <label className="block text-sm font-mono text-slate-300 mb-2">
                    Wind Speed: <span className="text-green-400 font-bold">{windSpeed.toFixed(0)} m/s</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={windSpeed}
                    onChange={e => handleWindSpeedChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>1 m/s</span>
                    <span>50 m/s</span>
                  </div>
                </CardContent>
              </Card>

              {/* Results readout */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-slate-300 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" /> Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">Lift Force</span>
                    <span className="text-sm text-blue-400 font-bold font-mono">{computedResults.liftForce.toFixed(1)} N</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">Drag Force</span>
                    <span className="text-sm text-orange-400 font-bold font-mono">{computedResults.dragForce.toFixed(1)} N</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">L/D Ratio</span>
                    <span className={`text-sm font-bold font-mono ${ldRatio > 10 ? 'text-green-400' : ldRatio > 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {isFinite(ldRatio) ? ldRatio.toFixed(1) : '--'}
                    </span>
                  </div>
                  {stallDiscovered && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-mono">Stall Angle</span>
                      <span className="text-sm text-red-400 font-bold font-mono">{data.results.stallAngle}&deg;</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Compare + Challenges */}
          <div className="space-y-6">
            {data.presetComparisons.length > 0 && (
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono text-slate-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-400" /> Compare Airfoils
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs ${compareModeActive ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 text-slate-500'} border`}
                      onClick={handleToggleCompare}
                    >
                      {compareModeActive ? 'Hide Compare' : 'Compare'}
                    </Button>
                  </div>
                </CardHeader>
                {compareModeActive && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                        <div className="text-xs text-slate-400 font-mono mb-2">Shape A (in wind tunnel)</div>
                        <div className="text-sm text-cyan-300 font-bold">{SHAPE_LABELS[selectedShape]}</div>
                        <div className="mt-2 space-y-1 text-xs font-mono text-slate-400">
                          <div>Lift: <span className="text-blue-400">{computedResults.liftForce.toFixed(1)} N</span></div>
                          <div>Drag: <span className="text-orange-400">{computedResults.dragForce.toFixed(1)} N</span></div>
                          <div>L/D: <span className="text-green-400">{isFinite(ldRatio) ? ldRatio.toFixed(1) : '--'}</span></div>
                        </div>
                      </div>

                      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                        <div className="text-xs text-slate-400 font-mono mb-2">Shape B</div>
                        <select
                          value={compareShape}
                          onChange={e => {
                            setCompareShape(e.target.value as ShapeId);
                            setComparisonCompleted(true);
                          }}
                          className="w-full px-2 py-1 bg-slate-900/60 text-cyan-300 text-sm rounded border border-slate-600 focus:border-cyan-500 focus:outline-none font-mono mb-2"
                        >
                          {ALL_SHAPES.filter(s => s !== selectedShape).map(s => (
                            <option key={s} value={s}>{SHAPE_LABELS[s]}</option>
                          ))}
                        </select>
                        {compareResults && (
                          <div className="space-y-1 text-xs font-mono text-slate-400">
                            <div>Lift: <span className="text-blue-400">{compareResults.liftForce.toFixed(1)} N</span></div>
                            <div>Drag: <span className="text-orange-400">{compareResults.dragForce.toFixed(1)} N</span></div>
                            <div>L/D: <span className="text-green-400">{compareResults.dragForce > 0.001 ? (compareResults.liftForce / compareResults.dragForce).toFixed(1) : '--'}</span></div>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-500 mt-2">
                          Tip: swap Shape A in the tunnel to see B&apos;s particles live.
                        </p>
                      </div>
                    </div>

                    {data.presetComparisons.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {data.presetComparisons.map((comp, idx) => (
                          <SpotlightCard key={idx} color="168, 85, 247" className="bg-slate-800/30 p-3">
                            <div className="p-3">
                              <div className="text-xs text-purple-400 font-mono font-bold mb-1">{comp.name}</div>
                              <p className="text-sm text-slate-300">{comp.question}</p>
                              <details className="mt-2">
                                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Show explanation</summary>
                                <p className="text-xs text-slate-400 mt-1">{comp.explanation}</p>
                              </details>
                            </div>
                          </SpotlightCard>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {data.challenges.length > 0 && (
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-slate-300 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" /> Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.challenges.map((challenge, idx) => {
                      const isActive = activeChallenge === challenge;
                      return (
                        <SpotlightCard
                          key={idx}
                          color="245, 158, 11"
                          isSelected={isActive}
                          onClick={() => {
                            setActiveChallenge(isActive ? null : challenge);
                            setChallengeOptimality(0);
                          }}
                          className="bg-slate-800/30"
                        >
                          <div className="p-4">
                            <p className="text-sm text-slate-200 font-medium mb-2">{challenge.scenario}</p>
                            <div className="flex gap-2 mb-2">
                              <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">
                                Lift: {challenge.targetLift}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-300">
                                Drag: {challenge.targetDrag}
                              </Badge>
                            </div>
                            {isActive && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-amber-300/70 italic">{challenge.hint}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs"
                                  onClick={e => {
                                    e.stopPropagation();
                                    evaluateChallenge();
                                  }}
                                >
                                  Check My Solution
                                </Button>
                                {challengeOptimality > 0 && (
                                  <div className={`text-center text-sm font-bold font-mono ${challengeOptimality >= 100 ? 'text-green-400' : challengeOptimality >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    Score: {challengeOptimality}/100
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </SpotlightCard>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Educational context */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              How Wings Create Lift
            </h4>
            <div className="space-y-2">
              <p className="text-slate-300 text-sm">
                An <span className="text-cyan-400 font-semibold">airfoil</span> is the cross-section shape of a wing.
                Its curved shape makes air flow faster over the top and slower underneath.
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-blue-400 font-semibold">Bernoulli&apos;s Principle:</span> Faster air = lower pressure.
                Watch the particles: above the wing they spread apart and speed up (fewer per area = low pressure), below they bunch up and slow down (more per area = high pressure).
                The pressure difference pushes the wing upward &mdash; that&apos;s <span className="text-blue-400 font-semibold">lift</span>.
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-red-400 font-semibold">Stall:</span> Tilt the airfoil too steeply and the upper particles can&apos;t hold onto the surface.
                They <span className="text-red-400 font-semibold">detach and swirl</span>, pressure equalizes, and lift collapses suddenly.
              </p>
              {data.gradeBand === '3-5' && (
                <p className="text-slate-300 text-sm">
                  <span className="text-green-400 font-semibold">L/D Ratio:</span> The lift-to-drag ratio measures aerodynamic efficiency.
                  Higher L/D means more lift for less drag &mdash; great for gliders and fuel efficiency.
                </p>
              )}
            </div>
          </div>

          {/* Exploration progress */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
              Shapes explored: <span className="text-cyan-400">{shapesExplored.size}/{ALL_SHAPES.length}</span>
            </div>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
              Variables tested: <span className="text-purple-400">{variablesManipulated.size}/3</span>
            </div>
            {stallDiscovered && (
              <div className="text-xs text-red-400 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Stall discovered
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AirfoilLab;
