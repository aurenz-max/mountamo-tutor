'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Wind, ArrowUp, ArrowRight, AlertTriangle, Eye, Target, Trophy, BarChart3 } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ─── Data Interfaces ─────────────────────────────────────────────

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

// ─── Props ───────────────────────────────────────────────────────

interface AirfoilLabProps {
  data: AirfoilLabData;
  className?: string;
}

// ─── Shape-specific constants ────────────────────────────────────

const SHAPE_CL_BASE: Record<string, number> = {
  flat: 0.0,
  symmetric: 0.0,
  cambered: 0.5,
  thick: 0.6,
  supercritical: 0.7,
  bird_wing: 0.8,
  custom: 0.4,
};

const SHAPE_LABELS: Record<string, string> = {
  flat: 'Flat Plate',
  symmetric: 'Symmetric',
  cambered: 'Cambered',
  thick: 'Thick',
  supercritical: 'Supercritical',
  bird_wing: 'Bird Wing',
  custom: 'Custom',
};

const ALL_SHAPES: AirfoilShape['shape'][] = [
  'flat', 'symmetric', 'cambered', 'thick', 'supercritical', 'bird_wing', 'custom',
];

// ─── Airfoil Path Generation ─────────────────────────────────────

function getAirfoilPath(shape: string, camber: number, cx: number, cy: number, chord: number): string {
  const halfChord = chord / 2;
  const leading = cx - halfChord;
  const trailing = cx + halfChord;

  switch (shape) {
    case 'flat':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.3},${cy - 4} ${trailing - halfChord * 0.3},${cy - 4} ${trailing},${cy}
              C ${trailing - halfChord * 0.3},${cy + 4} ${leading + halfChord * 0.3},${cy + 4} ${leading},${cy} Z`;

    case 'symmetric':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.25},${cy - chord * 0.08} ${trailing - halfChord * 0.3},${cy - chord * 0.06} ${trailing},${cy}
              C ${trailing - halfChord * 0.3},${cy + chord * 0.06} ${leading + halfChord * 0.25},${cy + chord * 0.08} ${leading},${cy} Z`;

    case 'cambered':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.25},${cy - chord * 0.14} ${trailing - halfChord * 0.3},${cy - chord * 0.10} ${trailing},${cy}
              C ${trailing - halfChord * 0.3},${cy + chord * 0.03} ${leading + halfChord * 0.25},${cy + chord * 0.04} ${leading},${cy} Z`;

    case 'thick':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.2},${cy - chord * 0.16} ${trailing - halfChord * 0.25},${cy - chord * 0.14} ${trailing},${cy}
              C ${trailing - halfChord * 0.25},${cy + chord * 0.10} ${leading + halfChord * 0.2},${cy + chord * 0.12} ${leading},${cy} Z`;

    case 'supercritical':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.3},${cy - chord * 0.06} ${trailing - halfChord * 0.4},${cy - chord * 0.05} ${trailing},${cy}
              C ${trailing - halfChord * 0.3},${cy + chord * 0.12} ${leading + halfChord * 0.25},${cy + chord * 0.10} ${leading},${cy} Z`;

    case 'bird_wing':
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.15},${cy - chord * 0.18} ${trailing - halfChord * 0.5},${cy - chord * 0.12} ${trailing},${cy + chord * 0.02}
              C ${trailing - halfChord * 0.4},${cy + chord * 0.04} ${leading + halfChord * 0.2},${cy + chord * 0.03} ${leading},${cy} Z`;

    case 'custom': {
      const topCamberOffset = camber * chord * 0.18;
      const bottomCamberOffset = camber * chord * 0.04;
      return `M ${leading},${cy}
              C ${leading + halfChord * 0.25},${cy - topCamberOffset} ${trailing - halfChord * 0.3},${cy - topCamberOffset * 0.7} ${trailing},${cy}
              C ${trailing - halfChord * 0.3},${cy + bottomCamberOffset} ${leading + halfChord * 0.25},${cy + bottomCamberOffset * 1.2} ${leading},${cy} Z`;
    }

    default:
      return `M ${leading},${cy} L ${trailing},${cy} Z`;
  }
}

// ─── Component ───────────────────────────────────────────────────

const AirfoilLab: React.FC<AirfoilLabProps> = ({ data, className }) => {
  // ── State ──────────────────────────────────────────────────────

  const [angleOfAttack, setAngleOfAttack] = useState(data.initialConditions.angleOfAttack);
  const [windSpeed, setWindSpeed] = useState(data.initialConditions.windSpeed);
  const [selectedShape, setSelectedShape] = useState<AirfoilShape['shape']>(data.airfoil.shape);
  const [camber, setCamber] = useState(0.5);
  const [shapesExplored, setShapesExplored] = useState<Set<string>>(new Set([data.airfoil.shape]));
  const [variablesManipulated, setVariablesManipulated] = useState<Set<string>>(new Set());
  const [stallDiscovered, setStallDiscovered] = useState(false);
  const [compareModeActive, setCompareModeActive] = useState(false);
  const [comparisonCompleted, setComparisonCompleted] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<AirfoilChallenge | null>(null);
  const [challengeOptimality, setChallengeOptimality] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);

  // Compare-mode second airfoil state
  const [compareShape, setCompareShape] = useState<AirfoilShape['shape']>('symmetric');

  // Visualization toggles
  const [showStreamlines, setShowStreamlines] = useState(data.visualizationOptions.streamlines);
  const [showPressureMap, setShowPressureMap] = useState(data.visualizationOptions.pressureMap);
  const [showForceGauges, setShowForceGauges] = useState(data.visualizationOptions.forceGauges);

  // Animation
  const [animationTick, setAnimationTick] = useState(0);
  const animRef = useRef<number>(0);

  // Prev angle ref for detecting big changes
  const prevAngleRef = useRef(angleOfAttack);

  // ── Evaluation ─────────────────────────────────────────────────

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'airfoil-lab' as any,
    instanceId: data.instanceId || 'airfoil-lab-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── AI Tutoring ────────────────────────────────────────────────

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
    const liftForce = q * effectiveCl;
    const dragForce = q * cd;

    return { effectiveCl, cd, liftForce, dragForce, isStalled, q };
  }, [selectedShape, camber, angleOfAttack, windSpeed, data.initialConditions.airDensity, data.results.stallAngle]);

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
      compareModeActive,
    },
    gradeLevel: data.gradeBand === '1-2' ? 'kindergarten' : 'elementary',
  });

  // ── Animation loop ─────────────────────────────────────────────

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setAnimationTick(t => t + 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Pedagogical triggers ───────────────────────────────────────

  // Shape change trigger
  const handleShapeChange = useCallback((shape: AirfoilShape['shape']) => {
    setSelectedShape(shape);
    setShapesExplored(prev => new Set(prev).add(shape));
    setVariablesManipulated(prev => new Set(prev).add('shape'));
    setAttemptsCount(c => c + 1);
    sendText(`[SHAPE_CHANGED] Student selected airfoil shape: ${SHAPE_LABELS[shape]}`, { silent: true });
  }, [sendText]);

  // Angle change trigger
  const handleAngleChange = useCallback((newAngle: number) => {
    setAngleOfAttack(newAngle);
    setVariablesManipulated(prev => new Set(prev).add('angle'));

    if (Math.abs(newAngle - prevAngleRef.current) >= 5) {
      sendText(`[ANGLE_CHANGED] Angle of attack changed to ${newAngle.toFixed(1)} degrees`, { silent: true });
      prevAngleRef.current = newAngle;
    }
  }, [sendText]);

  // Wind speed change trigger
  const handleWindSpeedChange = useCallback((speed: number) => {
    setWindSpeed(speed);
    setVariablesManipulated(prev => new Set(prev).add('windSpeed'));
  }, []);

  // Stall detection
  useEffect(() => {
    if (computedResults.isStalled && !stallDiscovered) {
      setStallDiscovered(true);
      sendText(`[STALL_REACHED] Wing has stalled at angle ${angleOfAttack.toFixed(1)} degrees! Lift dropped dramatically.`, { silent: true });
    }
  }, [computedResults.isStalled, stallDiscovered, angleOfAttack, sendText]);

  // ── Compare mode ───────────────────────────────────────────────

  const handleToggleCompare = useCallback(() => {
    const next = !compareModeActive;
    setCompareModeActive(next);
    if (next) {
      sendText(`[COMPARISON_STARTED] Compare mode activated`, { silent: true });
    }
  }, [compareModeActive, sendText]);

  // Compare-mode results for the second shape
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

  // ── Challenge evaluation ───────────────────────────────────────

  const evaluateChallenge = useCallback(() => {
    if (!activeChallenge) return;
    const liftLevel = computedResults.liftForce > 500 ? 'high' : computedResults.liftForce > 100 ? 'medium' : 'low';
    const dragLevel = computedResults.dragForce > 50 ? 'high' : computedResults.dragForce > 10 ? 'medium' : 'low';

    const liftMatch = liftLevel === activeChallenge.targetLift;
    const dragMatch = dragLevel === activeChallenge.targetDrag;
    const score = (liftMatch ? 50 : 0) + (dragMatch ? 50 : 0);
    setChallengeOptimality(score);

    sendText(
      `[CHALLENGE_RESULT] Challenge "${activeChallenge.scenario}" - Lift target: ${activeChallenge.targetLift} (got ${liftLevel}), Drag target: ${activeChallenge.targetDrag} (got ${dragLevel}). Score: ${score}/100`,
      { silent: true }
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
        }
      );
    }
  }, [
    activeChallenge, computedResults, shapesExplored, variablesManipulated,
    stallDiscovered, attemptsCount, comparisonCompleted, hasSubmitted,
    submitResult, sendText, selectedShape, angleOfAttack, windSpeed,
  ]);

  // ── SVG constants ──────────────────────────────────────────────

  const svgWidth = 800;
  const svgHeight = 400;
  const airfoilCx = svgWidth / 2;
  const airfoilCy = svgHeight / 2;
  const chordLength = 200;

  // ── Streamline generation ──────────────────────────────────────

  const streamlines = useMemo(() => {
    const lines: { y: number; offsetY: number; speed: number; side: 'upper' | 'lower' }[] = [];
    const numLines = 10;
    const halfSpread = 120;

    for (let i = 0; i < numLines; i++) {
      const frac = i / (numLines - 1);
      const baseY = airfoilCy - halfSpread + frac * halfSpread * 2;
      const isUpper = baseY < airfoilCy;

      // Upper streamlines compress (deflect upward), lower spread
      const deflection = isUpper
        ? -(1 - frac / 0.5) * 25 * (computedResults.effectiveCl > 0 ? 1 : 0.3)
        : (frac - 0.5) / 0.5 * 15 * (computedResults.effectiveCl > 0 ? 1 : 0.3);

      const speed = isUpper ? 1.2 + computedResults.effectiveCl * 0.15 : 0.9 - computedResults.effectiveCl * 0.05;

      lines.push({
        y: baseY,
        offsetY: deflection,
        speed: Math.max(0.3, speed),
        side: isUpper ? 'upper' : 'lower',
      });
    }
    return lines;
  }, [airfoilCy, computedResults.effectiveCl]);

  // ── Render ─────────────────────────────────────────────────────

  const ldRatio = computedResults.dragForce > 0.001
    ? (computedResults.liftForce / computedResults.dragForce)
    : Infinity;

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
              Airfoil Lab
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
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{data.airfoil.description}</p>
          </div>

          {/* Stall Warning */}
          {computedResults.isStalled && (
            <div className="mb-4 flex justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/20 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="font-mono text-sm font-bold text-red-300">
                  STALL! Angle exceeds {data.results.stallAngle}deg - lift has dropped
                </span>
              </div>
            </div>
          )}

          {/* Main 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            {/* Left: SVG Wind Tunnel (3 cols) */}
            <div className="lg:col-span-3">
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
                <CardContent className="p-0">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto select-none"
                    style={{ maxHeight: '440px' }}
                  >
                    <defs>
                      {/* Sky gradient */}
                      <linearGradient id="al-sky" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0c1629" />
                        <stop offset="100%" stopColor="#1a2744" />
                      </linearGradient>
                      {/* Pressure gradient: blue (low) to red (high) */}
                      <linearGradient id="al-pressure-top" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.35" />
                      </linearGradient>
                      <linearGradient id="al-pressure-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
                      </linearGradient>
                      <filter id="al-glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Background */}
                    <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#al-sky)" />

                    {/* Grid */}
                    <g opacity="0.06">
                      {Array.from({ length: 21 }).map((_, i) => (
                        <line key={`gv${i}`} x1={i * 40} y1={0} x2={i * 40} y2={svgHeight} stroke="#94A3B8" strokeWidth="0.5" />
                      ))}
                      {Array.from({ length: 11 }).map((_, i) => (
                        <line key={`gh${i}`} x1={0} y1={i * 40} x2={svgWidth} y2={i * 40} stroke="#94A3B8" strokeWidth="0.5" />
                      ))}
                    </g>

                    {/* Pressure map (optional) */}
                    {showPressureMap && !computedResults.isStalled && (
                      <g>
                        <rect
                          x={airfoilCx - chordLength / 2 - 30}
                          y={airfoilCy - 100}
                          width={chordLength + 60}
                          height={100}
                          fill="url(#al-pressure-top)"
                          rx={8}
                        />
                        <rect
                          x={airfoilCx - chordLength / 2 - 30}
                          y={airfoilCy}
                          width={chordLength + 60}
                          height={80}
                          fill="url(#al-pressure-bottom)"
                          rx={8}
                        />
                        {/* Labels */}
                        <text x={airfoilCx + chordLength / 2 + 40} y={airfoilCy - 50} fontSize={10} fill="#60a5fa" fontFamily="monospace" textAnchor="start" opacity={0.7}>
                          LOW P
                        </text>
                        <text x={airfoilCx + chordLength / 2 + 40} y={airfoilCy + 40} fontSize={10} fill="#f87171" fontFamily="monospace" textAnchor="start" opacity={0.7}>
                          HIGH P
                        </text>
                      </g>
                    )}

                    {/* Streamlines */}
                    {showStreamlines && (
                      <g>
                        {streamlines.map((sl, idx) => {
                          // Animate flow via horizontal offset tied to animationTick
                          const phase = (animationTick * sl.speed * 1.5) % svgWidth;
                          const isTurbulent = computedResults.isStalled && sl.side === 'upper';

                          // Two repeated passes for seamless loop
                          return [0, 1].map(rep => {
                            const xStart = -svgWidth + phase + rep * svgWidth;
                            const midX1 = xStart + svgWidth * 0.35;
                            const midX2 = xStart + svgWidth * 0.65;
                            const xEnd = xStart + svgWidth;

                            // Deflection occurs around the airfoil center region
                            const nearAirfoil = true; // simplified: the path bends around center
                            const yMid = sl.y + (nearAirfoil ? sl.offsetY : 0);

                            // Turbulent offsets at stall
                            const turbY1 = isTurbulent ? Math.sin(animationTick * 0.3 + idx * 1.7) * 12 : 0;
                            const turbY2 = isTurbulent ? Math.cos(animationTick * 0.25 + idx * 2.1) * 15 : 0;

                            const pathD = `M ${xStart},${sl.y} C ${midX1},${sl.y} ${midX1},${yMid + turbY1} ${(xStart + xEnd) / 2},${yMid + turbY1} S ${midX2},${sl.y + turbY2} ${xEnd},${sl.y}`;

                            return (
                              <path
                                key={`sl-${idx}-${rep}`}
                                d={pathD}
                                fill="none"
                                stroke={isTurbulent ? '#ef4444' : sl.side === 'upper' ? '#60a5fa' : '#f87171'}
                                strokeWidth={isTurbulent ? 1.5 : 1}
                                opacity={isTurbulent ? 0.5 : 0.3}
                                strokeDasharray={isTurbulent ? '4,6' : undefined}
                              />
                            );
                          });
                        })}
                      </g>
                    )}

                    {/* Airfoil body - rotated by angle of attack */}
                    <g transform={`rotate(${-angleOfAttack}, ${airfoilCx}, ${airfoilCy})`}>
                      <path
                        d={getAirfoilPath(selectedShape, camber, airfoilCx, airfoilCy, chordLength)}
                        fill={computedResults.isStalled ? '#64748b' : '#94a3b8'}
                        stroke={computedResults.isStalled ? '#ef4444' : '#e2e8f0'}
                        strokeWidth={2}
                        opacity={0.9}
                      />
                      {/* Chord line */}
                      <line
                        x1={airfoilCx - chordLength / 2}
                        y1={airfoilCy}
                        x2={airfoilCx + chordLength / 2}
                        y2={airfoilCy}
                        stroke="#475569"
                        strokeWidth={0.5}
                        strokeDasharray="4,4"
                        opacity={0.4}
                      />
                    </g>

                    {/* Force gauges */}
                    {showForceGauges && (
                      <g>
                        {/* Lift arrow (up, blue) */}
                        {(() => {
                          const liftLen = Math.min(Math.abs(computedResults.liftForce) * 0.15, 120);
                          const liftDir = computedResults.liftForce >= 0 ? -1 : 1;
                          return (
                            <g>
                              <line
                                x1={airfoilCx}
                                y1={airfoilCy}
                                x2={airfoilCx}
                                y2={airfoilCy + liftDir * liftLen}
                                stroke="#3b82f6"
                                strokeWidth={4}
                                strokeLinecap="round"
                                filter="url(#al-glow)"
                              />
                              {/* Arrowhead */}
                              <polygon
                                points={`${airfoilCx},${airfoilCy + liftDir * liftLen} ${airfoilCx - 6},${airfoilCy + liftDir * (liftLen - 12)} ${airfoilCx + 6},${airfoilCy + liftDir * (liftLen - 12)}`}
                                fill="#3b82f6"
                              />
                              <text
                                x={airfoilCx + 12}
                                y={airfoilCy + liftDir * liftLen / 2}
                                fontSize={11}
                                fill="#60a5fa"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                L = {computedResults.liftForce.toFixed(1)} N
                              </text>
                            </g>
                          );
                        })()}

                        {/* Drag arrow (right, orange) */}
                        {(() => {
                          const dragLen = Math.min(computedResults.dragForce * 0.8, 100);
                          return (
                            <g>
                              <line
                                x1={airfoilCx}
                                y1={airfoilCy}
                                x2={airfoilCx + dragLen}
                                y2={airfoilCy}
                                stroke="#f97316"
                                strokeWidth={4}
                                strokeLinecap="round"
                                filter="url(#al-glow)"
                              />
                              <polygon
                                points={`${airfoilCx + dragLen},${airfoilCy} ${airfoilCx + dragLen - 12},${airfoilCy - 6} ${airfoilCx + dragLen - 12},${airfoilCy + 6}`}
                                fill="#f97316"
                              />
                              <text
                                x={airfoilCx + dragLen + 8}
                                y={airfoilCy - 8}
                                fontSize={11}
                                fill="#fb923c"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                D = {computedResults.dragForce.toFixed(1)} N
                              </text>
                            </g>
                          );
                        })()}
                      </g>
                    )}

                    {/* Wind direction indicator */}
                    <g>
                      <text x={20} y={30} fontSize={12} fill="#94a3b8" fontFamily="monospace">
                        Wind: {windSpeed.toFixed(0)} m/s
                      </text>
                      <line x1={20} y1={40} x2={80} y2={40} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#al-wind-arrow)" />
                      <defs>
                        <marker id="al-wind-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                        </marker>
                      </defs>
                    </g>

                    {/* Angle indicator arc */}
                    <g>
                      <text x={svgWidth - 140} y={30} fontSize={11} fill="#a78bfa" fontFamily="monospace">
                        AoA: {angleOfAttack.toFixed(1)}deg
                      </text>
                      {angleOfAttack !== 0 && (
                        <path
                          d={`M ${airfoilCx + 60},${airfoilCy} A 60 60 0 0 ${angleOfAttack > 0 ? 0 : 1} ${airfoilCx + 60 * Math.cos(angleOfAttack * Math.PI / 180)},${airfoilCy - 60 * Math.sin(angleOfAttack * Math.PI / 180)}`}
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth={1.5}
                          opacity={0.6}
                        />
                      )}
                    </g>

                    {/* Stall turbulence indicator */}
                    {computedResults.isStalled && data.visualizationOptions.stallVisualization && (
                      <g>
                        {Array.from({ length: 8 }).map((_, i) => {
                          const cx = airfoilCx - 40 + Math.random() * 80;
                          const cy = airfoilCy - 30 - Math.random() * 40;
                          const r = 3 + Math.random() * 6;
                          return (
                            <circle
                              key={`turb-${i}`}
                              cx={cx + Math.sin(animationTick * 0.1 + i * 0.8) * 8}
                              cy={cy + Math.cos(animationTick * 0.15 + i * 1.2) * 5}
                              r={r}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={1}
                              opacity={0.4}
                            />
                          );
                        })}
                      </g>
                    )}
                  </svg>
                </CardContent>
              </Card>
            </div>

            {/* Right: Controls panel (2 cols) */}
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

                  {/* Camber slider for custom shape */}
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

              {/* Angle of Attack slider */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardContent className="pt-4">
                  <label className="block text-sm font-mono text-slate-300 mb-2">
                    Angle of Attack: <span className={`font-bold ${computedResults.isStalled ? 'text-red-400' : 'text-purple-400'}`}>{angleOfAttack.toFixed(1)}deg</span>
                  </label>
                  <input
                    type="range"
                    min={-5}
                    max={25}
                    step={0.5}
                    value={angleOfAttack}
                    onChange={e => handleAngleChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>-5deg</span>
                    <span className="text-red-400">Stall: {data.results.stallAngle}deg</span>
                    <span>25deg</span>
                  </div>
                </CardContent>
              </Card>

              {/* Wind Speed slider */}
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

              {/* Results display */}
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
                      <span className="text-sm text-red-400 font-bold font-mono">{data.results.stallAngle}deg</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visualization toggles */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs ${showStreamlines ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-500'} border`}
                  onClick={() => setShowStreamlines(!showStreamlines)}
                >
                  <Eye className="w-3 h-3 mr-1" /> Streamlines
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs ${showPressureMap ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-500'} border`}
                  onClick={() => setShowPressureMap(!showPressureMap)}
                >
                  <Eye className="w-3 h-3 mr-1" /> Pressure
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs ${showForceGauges ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-500'} border`}
                  onClick={() => setShowForceGauges(!showForceGauges)}
                >
                  <ArrowUp className="w-3 h-3 mr-1" /> Forces
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Area: Comparison and Challenges */}
          <div className="space-y-6">
            {/* Comparison Panel */}
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
                      {/* Shape A: the currently selected shape */}
                      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                        <div className="text-xs text-slate-400 font-mono mb-2">Shape A (current)</div>
                        <div className="text-sm text-cyan-300 font-bold">{SHAPE_LABELS[selectedShape]}</div>
                        <div className="mt-2 space-y-1 text-xs font-mono text-slate-400">
                          <div>Lift: <span className="text-blue-400">{computedResults.liftForce.toFixed(1)} N</span></div>
                          <div>Drag: <span className="text-orange-400">{computedResults.dragForce.toFixed(1)} N</span></div>
                          <div>L/D: <span className="text-green-400">{isFinite(ldRatio) ? ldRatio.toFixed(1) : '--'}</span></div>
                        </div>
                      </div>

                      {/* Shape B: compare shape */}
                      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                        <div className="text-xs text-slate-400 font-mono mb-2">Shape B</div>
                        <select
                          value={compareShape}
                          onChange={e => {
                            setCompareShape(e.target.value as AirfoilShape['shape']);
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
                      </div>
                    </div>

                    {/* Preset comparison questions */}
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

            {/* Challenges */}
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

          {/* Educational Info */}
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
                <span className="text-blue-400 font-semibold">Bernoulli&apos;s Principle:</span> Faster air = lower pressure above the wing.
                The pressure difference pushes the wing upward - that&apos;s <span className="text-blue-400 font-semibold">lift</span>!
              </p>
              <p className="text-slate-300 text-sm">
                <span className="text-red-400 font-semibold">Stall Warning:</span> If the angle of attack gets too steep,
                air can&apos;t follow the wing surface smoothly. It separates and becomes turbulent, causing lift to drop suddenly.
              </p>
              {data.gradeBand === '3-5' && (
                <p className="text-slate-300 text-sm">
                  <span className="text-green-400 font-semibold">L/D Ratio:</span> The lift-to-drag ratio measures aerodynamic efficiency.
                  Higher L/D means the wing generates more lift for less drag - great for gliders and fuel efficiency!
                </p>
              )}
            </div>
          </div>

          {/* Exploration progress (subtle) */}
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
