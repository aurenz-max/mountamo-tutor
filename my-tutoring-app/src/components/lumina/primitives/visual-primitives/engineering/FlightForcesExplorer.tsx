'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plane, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Target, Trophy, AlertTriangle } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * FlightForcesExplorer - Interactive four-forces-of-flight simulation
 *
 * K-5 Engineering Primitive for understanding:
 * - The four forces: lift, weight, thrust, drag (K-2)
 * - How changing thrust affects motion (1-2)
 * - Angle of attack and stalling (3-5)
 * - Force balance and flight states (3-5)
 *
 * Real-world connections: airplanes, gliders, jets, cargo planes
 */

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface AircraftProfile {
  name: string;
  type: 'cessna' | 'jumbo_jet' | 'glider' | 'fighter' | 'biplane' | 'custom';
  imagePrompt?: string;
  emptyWeight: number;  // kg
  maxThrust: number;    // N
  wingArea: number;     // m²
  maxSpeed: number;     // km/h
}

export interface ForceInfo {
  magnitude: number;   // N
  description: string;
}

export interface FlightState {
  condition: string;
  name: 'climbing' | 'descending' | 'cruising' | 'stalling' | 'accelerating';
  description: string;
  narration: string;
}

export interface FlightChallenge {
  id: string;
  instruction: string;
  targetConditions: {
    altitudeRange?: { min: number; max: number };
    speedRange?: { min: number; max: number };
  };
  hint: string;
}

export interface FlightForcesExplorerData {
  aircraft: AircraftProfile;
  initialConditions: {
    altitude: number;    // meters
    speed: number;       // km/h
    thrustPercent: number; // 0-100
    angleOfAttack: number; // degrees
    cargoWeight: number;  // kg
  };
  forces: {
    lift: ForceInfo;
    weight: ForceInfo;
    thrust: ForceInfo;
    drag: ForceInfo;
  };
  flightStates: FlightState[];
  challenges: FlightChallenge[];
  showOptions: {
    forceArrows: boolean;
    forceValues: boolean;
    airflowStreamlines: boolean;
    forceBalanceChart: boolean;
    flightPathTrace: boolean;
    altitudeIndicator: boolean;
  };
  gradeBand: 'K-2' | '3-5';
  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlightForcesExplorerProps {
  data: FlightForcesExplorerData;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORCE_COLORS = {
  lift:   { color: '#60a5fa', label: 'Lift',    direction: 'up'    as const },
  weight: { color: '#f87171', label: 'Weight',  direction: 'down'  as const },
  thrust: { color: '#4ade80', label: 'Thrust',  direction: 'right' as const },
  drag:   { color: '#fb923c', label: 'Drag',    direction: 'left'  as const },
};

const AIR_DENSITY = 1.225; // kg/m³ at sea level

// ─── Component ────────────────────────────────────────────────────────────────

const FlightForcesExplorer: React.FC<FlightForcesExplorerProps> = ({ data, className }) => {
  const { aircraft, initialConditions, showOptions, gradeBand, challenges, flightStates } = data;

  // ── State ─────────────────────────────────────────────────────────────────
  const [thrustPercent, setThrustPercent] = useState(initialConditions.thrustPercent);
  const [angleOfAttack, setAngleOfAttack] = useState(initialConditions.angleOfAttack);
  const [cargoWeight, setCargoWeight] = useState(initialConditions.cargoWeight);
  const [altitude, setAltitude] = useState(initialConditions.altitude);
  const [speed, setSpeed] = useState(initialConditions.speed);
  const [selectedForce, setSelectedForce] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<FlightChallenge | null>(null);
  const [challengesCompleted, setChallengesCompleted] = useState<string[]>([]);
  const [stateTransitionsExplored, setStateTransitionsExplored] = useState<Set<string>>(new Set());
  const [stallTriggered, setStallTriggered] = useState(false);
  const [aircraftProfilesCompared, setAircraftProfilesCompared] = useState(1);
  const [forcesIdentified, setForcesIdentified] = useState<Set<string>>(new Set());

  const previousFlightState = useRef<string | null>(null);
  const challengeStartTime = useRef<number | null>(null);
  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'flight-forces-explorer' as any,
    instanceId: data.instanceId || 'flight-forces-explorer-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── AI Tutoring ───────────────────────────────────────────────────────────
  const computedForcesForAI = useMemo(() => {
    const thrustN = (thrustPercent / 100) * aircraft.maxThrust;
    const totalWeightN = (aircraft.emptyWeight + cargoWeight) * 9.81;
    const speedMs = speed / 3.6;
    const rawLiftCoeff = 0.5 + angleOfAttack * 0.1;
    const liftCoeff = angleOfAttack > 15 ? Math.max(0, rawLiftCoeff - (angleOfAttack - 15) * 0.3) : Math.max(0, rawLiftCoeff);
    const liftN = 0.5 * AIR_DENSITY * speedMs * speedMs * aircraft.wingArea * liftCoeff;
    const dragCoeff = 0.02 + (liftCoeff * liftCoeff) / (Math.PI * 6);
    const dragN = 0.5 * AIR_DENSITY * speedMs * speedMs * aircraft.wingArea * dragCoeff;
    return { lift: liftN, weight: totalWeightN, thrust: thrustN, drag: dragN };
  }, [thrustPercent, angleOfAttack, cargoWeight, speed, aircraft]);

  const currentFlightStateName = useMemo(() => {
    const { lift, weight, thrust, drag } = computedForcesForAI;
    if (angleOfAttack > 15) return 'stalling';
    if (lift > weight * 1.05 && thrust > drag) return 'climbing';
    if (lift < weight * 0.95) return 'descending';
    if (Math.abs(lift - weight) < weight * 0.05 && Math.abs(thrust - drag) < Math.max(drag * 0.1, 1)) return 'cruising';
    return 'accelerating';
  }, [computedForcesForAI, angleOfAttack]);

  const { sendText } = useLuminaAI({
    primitiveType: 'flight-forces-explorer' as any,
    instanceId: data.instanceId || `ffe-${Date.now()}`,
    primitiveData: {
      aircraftName: aircraft.name,
      flightState: currentFlightStateName,
      thrustPercent,
      angleOfAttack,
      liftMagnitude: computedForcesForAI.lift,
      weightMagnitude: computedForcesForAI.weight,
      thrustMagnitude: computedForcesForAI.thrust,
      dragMagnitude: computedForcesForAI.drag,
      altitude,
      speed,
      challengeActive: activeChallenge?.id || null,
      challengeGoal: activeChallenge?.instruction || null,
    },
    gradeLevel: gradeBand === 'K-2' ? 'kindergarten' : 'elementary',
  });

  // ── Physics Calculations ──────────────────────────────────────────────────
  const computedForces = useMemo(() => {
    const thrustN = (thrustPercent / 100) * aircraft.maxThrust;
    const totalWeightN = (aircraft.emptyWeight + cargoWeight) * 9.81;
    const speedMs = speed / 3.6;

    // Lift coefficient: linear up to ~15 deg, then stall
    const rawLiftCoeff = 0.5 + angleOfAttack * 0.1;
    const liftCoeff = angleOfAttack > 15
      ? Math.max(0, rawLiftCoeff - (angleOfAttack - 15) * 0.3)
      : Math.max(0, rawLiftCoeff);

    const liftN = 0.5 * AIR_DENSITY * speedMs * speedMs * aircraft.wingArea * liftCoeff;

    // Drag with induced-drag component
    const dragCoeff = 0.02 + (liftCoeff * liftCoeff) / (Math.PI * 6);
    const dragN = 0.5 * AIR_DENSITY * speedMs * speedMs * aircraft.wingArea * dragCoeff;

    return {
      thrust: thrustN,
      weight: totalWeightN,
      lift: liftN,
      drag: dragN,
      liftCoeff,
      dragCoeff,
    };
  }, [thrustPercent, angleOfAttack, cargoWeight, speed, aircraft]);

  // ── Flight State Determination ────────────────────────────────────────────
  const currentFlightState = useMemo(() => {
    const { lift, weight, thrust, drag } = computedForces;

    if (angleOfAttack > 15) {
      return {
        name: 'stalling' as const,
        label: 'Stalling',
        description: 'The angle of attack is too steep! Air can no longer flow smoothly over the wings, causing a loss of lift.',
        color: '#ef4444',
        icon: AlertTriangle,
      };
    }
    if (lift > weight * 1.05 && thrust > drag) {
      return {
        name: 'climbing' as const,
        label: 'Climbing',
        description: 'Lift exceeds weight and thrust overcomes drag. The aircraft is gaining altitude!',
        color: '#60a5fa',
        icon: ArrowUp,
      };
    }
    if (lift < weight * 0.95) {
      return {
        name: 'descending' as const,
        label: 'Descending',
        description: 'Weight exceeds lift. The aircraft is losing altitude.',
        color: '#f87171',
        icon: ArrowDown,
      };
    }
    if (Math.abs(lift - weight) < weight * 0.05 && Math.abs(thrust - drag) < Math.max(drag * 0.1, 1)) {
      return {
        name: 'cruising' as const,
        label: 'Cruising',
        description: 'All forces are balanced! The aircraft flies straight and level.',
        color: '#4ade80',
        icon: ArrowRight,
      };
    }
    return {
      name: 'accelerating' as const,
      label: 'Accelerating',
      description: 'Thrust exceeds drag. The aircraft is changing speed.',
      color: '#fbbf24',
      icon: ArrowRight,
    };
  }, [computedForces, angleOfAttack]);

  // ── Simulation Tick ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const { lift, weight, thrust, drag } = computedForces;
      const netVertical = lift - weight;
      const netHorizontal = thrust - drag;

      // Update altitude (simple integration)
      setAltitude(prev => {
        const delta = netVertical * 0.0001; // scale factor for reasonable rates
        return Math.max(0, Math.min(15000, prev + delta));
      });

      // Update speed
      setSpeed(prev => {
        const accel = netHorizontal / (aircraft.emptyWeight + cargoWeight); // F = ma
        const delta = accel * 0.01 * 3.6; // convert to km/h
        return Math.max(0, Math.min(aircraft.maxSpeed * 1.2, prev + delta));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [computedForces, aircraft, cargoWeight]);

  // ── Flight State Change Detection ─────────────────────────────────────────
  useEffect(() => {
    if (previousFlightState.current && previousFlightState.current !== currentFlightState.name) {
      setStateTransitionsExplored(prev => {
        const next = new Set(prev);
        next.add(`${previousFlightState.current}->${currentFlightState.name}`);
        return next;
      });

      sendText?.(
        `[FLIGHT_STATE_CHANGE] The aircraft transitioned from ${previousFlightState.current} to ${currentFlightState.name}. ` +
        `Current forces — Lift: ${computedForces.lift.toFixed(0)}N, Weight: ${computedForces.weight.toFixed(0)}N, ` +
        `Thrust: ${computedForces.thrust.toFixed(0)}N, Drag: ${computedForces.drag.toFixed(0)}N.`,
        { silent: true }
      );
    }
    previousFlightState.current = currentFlightState.name;
  }, [currentFlightState.name, computedForces, sendText]);

  // ── Stall Detection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (currentFlightState.name === 'stalling' && !stallTriggered) {
      setStallTriggered(true);
      sendText?.(
        `[STALL_TRIGGERED] The student has discovered what happens when the angle of attack is too high (${angleOfAttack}°). ` +
        `The aircraft is stalling. Help them understand why this happens and how to recover.`,
        { silent: true }
      );
    }
  }, [currentFlightState.name, stallTriggered, angleOfAttack, sendText]);

  // ── Challenge Checking ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeChallenge) return;

    const { targetConditions } = activeChallenge;
    let conditionsMet = true;

    if (targetConditions.altitudeRange) {
      if (altitude < targetConditions.altitudeRange.min || altitude > targetConditions.altitudeRange.max) {
        conditionsMet = false;
      }
    }
    if (targetConditions.speedRange) {
      if (speed < targetConditions.speedRange.min || speed > targetConditions.speedRange.max) {
        conditionsMet = false;
      }
    }

    if (conditionsMet) {
      // Challenge completed
      setChallengesCompleted(prev => [...prev, activeChallenge.id]);

      sendText?.(
        `[CHALLENGE_COMPLETED] The student successfully completed the challenge: "${activeChallenge.instruction}". ` +
        `Current state — Altitude: ${altitude.toFixed(0)}m, Speed: ${speed.toFixed(0)} km/h.`,
        { silent: true }
      );

      // Clear challenge timer
      if (challengeTimerRef.current) {
        clearTimeout(challengeTimerRef.current);
        challengeTimerRef.current = null;
      }

      setActiveChallenge(null);
    }
  }, [altitude, speed, activeChallenge, sendText]);

  // ── Challenge Evaluation Submission ───────────────────────────────────────
  useEffect(() => {
    if (challenges.length > 0 && challengesCompleted.length === challenges.length && !hasSubmitted) {
      submitResult(
        true, // success
        challengesCompleted.length / challenges.length, // score (0-1)
        {
          type: 'flight-forces-explorer',
          challengesCompleted: challengesCompleted.length,
          totalChallenges: challenges.length,
          stateTransitionsExplored: stateTransitionsExplored.size,
          stallDiscovered: stallTriggered,
          forcesIdentified: forcesIdentified.size,
          aircraftProfilesCompared,
        } as any, // metrics
      );
    }
  }, [
    challengesCompleted, challenges, hasSubmitted, submitResult,
    stateTransitionsExplored, stallTriggered, forcesIdentified, aircraftProfilesCompared,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleForceClick = useCallback((forceKey: string) => {
    setSelectedForce(prev => (prev === forceKey ? null : forceKey));
    setForcesIdentified(prev => {
      const next = new Set(prev);
      next.add(forceKey);
      return next;
    });

    const info = FORCE_COLORS[forceKey as keyof typeof FORCE_COLORS];
    const magnitude = computedForces[forceKey as keyof typeof computedForces];

    sendText?.(
      `[FORCE_TAPPED] The student tapped on the ${info.label} arrow. ` +
      `Current magnitude: ${typeof magnitude === 'number' ? magnitude.toFixed(0) : 0}N. ` +
      `Explain what ${info.label.toLowerCase()} is and how it affects flight in age-appropriate terms.`,
      { silent: true }
    );
  }, [computedForces, sendText]);

  const handleStartChallenge = useCallback((challenge: FlightChallenge) => {
    setActiveChallenge(challenge);
    challengeStartTime.current = Date.now();

    sendText?.(
      `[CHALLENGE_STARTED] The student started the challenge: "${challenge.instruction}". ` +
      `Guide them toward the goal with encouragement.`,
      { silent: true }
    );

    // Set a 30-second timer for the hint
    if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
    challengeTimerRef.current = setTimeout(() => {
      sendText?.(
        `[CHALLENGE_FAILED] The student has been working on the challenge "${challenge.instruction}" for 30 seconds ` +
        `and hasn't met the conditions yet. Hint: ${challenge.hint}. Provide gentle guidance.`,
        { silent: true }
      );
    }, 30000);
  }, [sendText]);

  const handleReset = useCallback(() => {
    setThrustPercent(initialConditions.thrustPercent);
    setAngleOfAttack(initialConditions.angleOfAttack);
    setCargoWeight(initialConditions.cargoWeight);
    setAltitude(initialConditions.altitude);
    setSpeed(initialConditions.speed);
    setSelectedForce(null);
    setActiveChallenge(null);
    if (challengeTimerRef.current) {
      clearTimeout(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
  }, [initialConditions]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
    };
  }, []);

  // ── SVG Helpers ───────────────────────────────────────────────────────────
  const svgWidth = 600;
  const svgHeight = 400;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  // Scale arrow lengths to force magnitudes
  const maxForceMagnitude = Math.max(
    computedForces.lift,
    computedForces.weight,
    computedForces.thrust,
    computedForces.drag,
    1 // avoid division by zero
  );
  const maxArrowLength = 120;

  const getArrowLength = (magnitude: number) => {
    return Math.max(10, (magnitude / maxForceMagnitude) * maxArrowLength);
  };

  // ── Airplane SVG Path ─────────────────────────────────────────────────────
  const airplanePath = `
    M ${centerX - 40} ${centerY}
    L ${centerX - 30} ${centerY - 6}
    L ${centerX + 10} ${centerY - 6}
    L ${centerX + 20} ${centerY - 25}
    L ${centerX + 28} ${centerY - 25}
    L ${centerX + 22} ${centerY - 6}
    L ${centerX + 40} ${centerY - 4}
    L ${centerX + 45} ${centerY - 15}
    L ${centerX + 50} ${centerY - 15}
    L ${centerX + 48} ${centerY - 2}
    L ${centerX + 50} ${centerY}
    L ${centerX + 48} ${centerY + 2}
    L ${centerX + 50} ${centerY + 15}
    L ${centerX + 45} ${centerY + 15}
    L ${centerX + 40} ${centerY + 4}
    L ${centerX + 22} ${centerY + 6}
    L ${centerX + 28} ${centerY + 18}
    L ${centerX + 20} ${centerY + 18}
    L ${centerX + 10} ${centerY + 6}
    L ${centerX - 30} ${centerY + 6}
    Z
  `;

  // ── Render Force Arrow ────────────────────────────────────────────────────
  const renderForceArrow = (
    forceKey: string,
    meta: typeof FORCE_COLORS[keyof typeof FORCE_COLORS],
    magnitude: number
  ) => {
    const len = getArrowLength(magnitude);
    const isSelected = selectedForce === forceKey;
    const arrowWidth = isSelected ? 4 : 3;
    const headSize = isSelected ? 14 : 10;

    let x1 = centerX, y1 = centerY, x2 = centerX, y2 = centerY;

    switch (meta.direction) {
      case 'up':
        y1 = centerY - 30;
        y2 = centerY - 30 - len;
        break;
      case 'down':
        y1 = centerY + 30;
        y2 = centerY + 30 + len;
        break;
      case 'right':
        x1 = centerX - 45;
        x2 = centerX - 45 - len;
        break;
      case 'left':
        x1 = centerX + 50;
        x2 = centerX + 50 + len;
        break;
    }

    // Arrowhead points
    let arrowHead: string;
    switch (meta.direction) {
      case 'up':
        arrowHead = `${x2},${y2} ${x2 - headSize / 2},${y2 + headSize} ${x2 + headSize / 2},${y2 + headSize}`;
        break;
      case 'down':
        arrowHead = `${x2},${y2} ${x2 - headSize / 2},${y2 - headSize} ${x2 + headSize / 2},${y2 - headSize}`;
        break;
      case 'right':
        arrowHead = `${x2},${y2} ${x2 + headSize},${y2 - headSize / 2} ${x2 + headSize},${y2 + headSize / 2}`;
        break;
      case 'left':
        arrowHead = `${x2},${y2} ${x2 - headSize},${y2 - headSize / 2} ${x2 - headSize},${y2 + headSize / 2}`;
        break;
    }

    return (
      <g
        key={forceKey}
        onClick={() => handleForceClick(forceKey)}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`${meta.label} force: ${magnitude.toFixed(0)} Newtons`}
      >
        {/* Glow behind arrow when selected */}
        {isSelected && (
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={meta.color}
            strokeWidth={10}
            opacity={0.3}
            strokeLinecap="round"
          />
        )}

        {/* Arrow line */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={meta.color}
          strokeWidth={arrowWidth}
          strokeLinecap="round"
          className="transition-all duration-200"
        />

        {/* Arrowhead */}
        <polygon
          points={arrowHead}
          fill={meta.color}
          className="transition-all duration-200"
        />

        {/* Force label */}
        {showOptions.forceValues && (
          <text
            x={meta.direction === 'up' || meta.direction === 'down' ? x2 + 16 : (x1 + x2) / 2}
            y={meta.direction === 'left' || meta.direction === 'right' ? y2 - 12 : (y1 + y2) / 2}
            fill={meta.color}
            fontSize={11}
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            {meta.label}: {magnitude.toFixed(0)}N
          </text>
        )}

        {/* Invisible hit area for easier tapping */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="transparent"
          strokeWidth={20}
        />
      </g>
    );
  };

  // ── Streamlines ───────────────────────────────────────────────────────────
  const renderStreamlines = () => {
    if (!showOptions.airflowStreamlines) return null;

    const streamCount = 5;
    const stalling = currentFlightState.name === 'stalling';

    return (
      <g opacity={0.3}>
        {Array.from({ length: streamCount }).map((_, i) => {
          const yOffset = (i - (streamCount - 1) / 2) * 20;
          const baseY = centerY + yOffset;

          if (stalling && Math.abs(yOffset) < 20) {
            // Turbulent lines near wing during stall
            return (
              <path
                key={`stream-${i}`}
                d={`M 0 ${baseY} Q 100 ${baseY - 10} 200 ${baseY + 15} Q 300 ${baseY - 20} 400 ${baseY + 10} Q 500 ${baseY - 5} 600 ${baseY}`}
                stroke="#94a3b8"
                strokeWidth={1}
                fill="none"
                strokeDasharray="4 4"
              />
            );
          }

          return (
            <path
              key={`stream-${i}`}
              d={`M 0 ${baseY} Q 150 ${baseY} 250 ${baseY - yOffset * 0.3} Q 350 ${baseY - yOffset * 0.5} 450 ${baseY - yOffset * 0.2} Q 550 ${baseY} 600 ${baseY}`}
              stroke="#94a3b8"
              strokeWidth={1}
              fill="none"
              strokeDasharray="6 4"
            />
          );
        })}
      </g>
    );
  };

  // ── Force Balance Chart ───────────────────────────────────────────────────
  const renderForceBalanceChart = () => {
    if (!showOptions.forceBalanceChart) return null;

    const forceEntries = [
      { key: 'lift', value: computedForces.lift, color: FORCE_COLORS.lift.color, label: 'Lift' },
      { key: 'weight', value: computedForces.weight, color: FORCE_COLORS.weight.color, label: 'Weight' },
      { key: 'thrust', value: computedForces.thrust, color: FORCE_COLORS.thrust.color, label: 'Thrust' },
      { key: 'drag', value: computedForces.drag, color: FORCE_COLORS.drag.color, label: 'Drag' },
    ];

    const maxVal = Math.max(...forceEntries.map(f => f.value), 1);
    const barMaxWidth = 160;

    return (
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
        <h4 className="text-sm font-mono text-slate-300 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          Force Balance
        </h4>
        <div className="space-y-2">
          {forceEntries.map(entry => (
            <div key={entry.key} className="flex items-center gap-2">
              <span className="text-xs font-mono w-14 text-slate-400">{entry.label}</span>
              <div className="flex-1 h-5 bg-slate-900/50 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(entry.value / maxVal) * 100}%`,
                    backgroundColor: entry.color,
                    maxWidth: `${barMaxWidth}px`,
                  }}
                />
              </div>
              <span className="text-xs font-mono w-16 text-right" style={{ color: entry.color }}>
                {entry.value.toFixed(0)}N
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  const FlightStateIcon = currentFlightState.icon;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
          <Plane className="w-7 h-7 text-sky-400" />
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{aircraft.name}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <p className="text-xs text-sky-400 font-mono uppercase tracking-wider">
              Flight Forces Explorer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Badge variant="outline" className="border-sky-500/30 text-sky-300 bg-sky-500/10 text-xs">
            {aircraft.type.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 text-xs">
            {gradeBand}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-sky-500/20 relative overflow-hidden">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10">
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left Column: SVG Force Diagram */}
            <div className="space-y-4">
              {/* Flight state indicator */}
              <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full transition-all duration-500`}
                style={{
                  backgroundColor: `${currentFlightState.color}20`,
                  borderColor: `${currentFlightState.color}50`,
                  borderWidth: '1px',
                  boxShadow: `0 0 20px ${currentFlightState.color}30`,
                }}
              >
                <FlightStateIcon className="w-4 h-4" style={{ color: currentFlightState.color }} />
                <span className="font-mono text-sm font-bold" style={{ color: currentFlightState.color }}>
                  {currentFlightState.label.toUpperCase()}
                </span>
              </div>

              {/* SVG Canvas */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto select-none"
                  style={{ maxHeight: '360px' }}
                >
                  {/* Sky gradient */}
                  <defs>
                    <linearGradient id="ffe-sky" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0c1445" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                    <filter id="ffe-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#ffe-sky)" />

                  {/* Grid */}
                  <g opacity={0.08}>
                    {Array.from({ length: Math.floor(svgWidth / 40) + 1 }).map((_, i) => (
                      <line key={`gv-${i}`} x1={i * 40} y1={0} x2={i * 40} y2={svgHeight} stroke="#94a3b8" strokeWidth="0.5" />
                    ))}
                    {Array.from({ length: Math.floor(svgHeight / 40) + 1 }).map((_, i) => (
                      <line key={`gh-${i}`} x1={0} y1={i * 40} x2={svgWidth} y2={i * 40} stroke="#94a3b8" strokeWidth="0.5" />
                    ))}
                  </g>

                  {/* Streamlines */}
                  {renderStreamlines()}

                  {/* Airplane body */}
                  <g transform={`rotate(${-angleOfAttack}, ${centerX}, ${centerY})`}>
                    <path
                      d={airplanePath}
                      fill="#475569"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                    />
                    {/* Wing highlight */}
                    <rect
                      x={centerX - 25}
                      y={centerY - 5}
                      width={50}
                      height={3}
                      rx={1.5}
                      fill="#64748b"
                      opacity={0.6}
                    />
                  </g>

                  {/* Force arrows (rendered without rotation so they stay axis-aligned) */}
                  {showOptions.forceArrows && (
                    <g>
                      {renderForceArrow('lift', FORCE_COLORS.lift, computedForces.lift)}
                      {renderForceArrow('weight', FORCE_COLORS.weight, computedForces.weight)}
                      {renderForceArrow('thrust', FORCE_COLORS.thrust, computedForces.thrust)}
                      {renderForceArrow('drag', FORCE_COLORS.drag, computedForces.drag)}
                    </g>
                  )}

                  {/* Altitude indicator */}
                  {showOptions.altitudeIndicator && (
                    <g>
                      <rect x={svgWidth - 55} y={20} width={40} height={svgHeight - 40} rx={6} fill="rgba(0,0,0,0.3)" stroke="#475569" strokeWidth={1} />
                      {/* Altitude bar fill */}
                      <rect
                        x={svgWidth - 51}
                        y={24 + (svgHeight - 48) * (1 - Math.min(altitude / 10000, 1))}
                        width={32}
                        height={(svgHeight - 48) * Math.min(altitude / 10000, 1)}
                        rx={4}
                        fill="url(#ffe-alt-gradient)"
                      />
                      <defs>
                        <linearGradient id="ffe-alt-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                          <stop offset="0%" stopColor="#4ade80" />
                          <stop offset="100%" stopColor="#60a5fa" />
                        </linearGradient>
                      </defs>
                      <text x={svgWidth - 35} y={15} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">ALT</text>
                      <text x={svgWidth - 35} y={svgHeight - 8} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
                        {altitude.toFixed(0)}m
                      </text>
                    </g>
                  )}

                  {/* Speed indicator */}
                  <g>
                    <rect x={8} y={8} width={90} height={40} rx={8} fill="rgba(0,0,0,0.4)" stroke="#475569" strokeWidth={1} />
                    <text x={16} y={24} fontSize={9} fill="#94a3b8" fontFamily="monospace">SPEED</text>
                    <text x={16} y={40} fontSize={14} fill="#e2e8f0" fontFamily="monospace" fontWeight="bold">
                      {speed.toFixed(0)} km/h
                    </text>
                  </g>
                </svg>

                {/* Selected force description overlay */}
                {selectedForce && (
                  <div className="absolute bottom-3 left-3 right-3 px-4 py-3 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700 animate-fade-in">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: FORCE_COLORS[selectedForce as keyof typeof FORCE_COLORS]?.color }}
                      />
                      <span className="text-sm font-bold text-white">
                        {FORCE_COLORS[selectedForce as keyof typeof FORCE_COLORS]?.label}
                      </span>
                      <span className="text-xs font-mono text-slate-400 ml-auto">
                        {(computedForces[selectedForce as keyof typeof computedForces] as number)?.toFixed(0)}N
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {data.forces[selectedForce as keyof typeof data.forces]?.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Controls */}
            <div className="space-y-4">
              {/* Thrust Slider */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Thrust: <span className="text-green-400 font-bold">{thrustPercent}%</span>
                  <span className="text-xs text-slate-500 ml-2">({computedForces.thrust.toFixed(0)}N)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={thrustPercent}
                  onChange={(e) => setThrustPercent(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1 font-mono">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Angle of Attack Slider */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Angle of Attack: <span className={`font-bold ${angleOfAttack > 15 ? 'text-red-400' : 'text-sky-400'}`}>{angleOfAttack}°</span>
                  {angleOfAttack > 15 && (
                    <span className="text-xs text-red-400 ml-2 animate-pulse">STALL RISK</span>
                  )}
                </label>
                <input
                  type="range"
                  min={-5}
                  max={20}
                  step={0.5}
                  value={angleOfAttack}
                  onChange={(e) => setAngleOfAttack(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1 font-mono">
                  <span>-5°</span>
                  <span>0°</span>
                  <span>10°</span>
                  <span className="text-red-500/60">20°</span>
                </div>
              </div>

              {/* Cargo Weight Slider */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
                <label className="block text-sm font-mono text-slate-300 mb-3">
                  Cargo Weight: <span className="text-orange-400 font-bold">{cargoWeight} kg</span>
                  <span className="text-xs text-slate-500 ml-2">(Total: {(aircraft.emptyWeight + cargoWeight).toFixed(0)} kg)</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.floor(aircraft.emptyWeight / 2)}
                  step={Math.max(1, Math.floor(aircraft.emptyWeight / 100))}
                  value={cargoWeight}
                  onChange={(e) => setCargoWeight(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1 font-mono">
                  <span>0 kg</span>
                  <span>{Math.floor(aircraft.emptyWeight / 4)} kg</span>
                  <span>{Math.floor(aircraft.emptyWeight / 2)} kg</span>
                </div>
              </div>

              {/* Force Balance Chart */}
              {renderForceBalanceChart()}

              {/* Reset Button */}
              <Button
                variant="ghost"
                className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                onClick={handleReset}
              >
                Reset Controls
              </Button>
            </div>
          </div>

          {/* Bottom Area: Challenges & Flight State */}
          <div className="mt-6 space-y-4">
            {/* Challenges */}
            {challenges.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Challenges
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {challenges.map(challenge => {
                    const isCompleted = challengesCompleted.includes(challenge.id);
                    const isActive = activeChallenge?.id === challenge.id;

                    return (
                      <SpotlightCard
                        key={challenge.id}
                        color={isCompleted ? '34, 197, 94' : isActive ? '56, 189, 248' : '148, 163, 184'}
                        isSelected={isActive}
                        className={`${isCompleted ? 'opacity-70' : ''}`}
                        onClick={() => {
                          if (!isCompleted && !isActive) {
                            handleStartChallenge(challenge);
                          }
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                              isCompleted
                                ? 'bg-green-500/30 text-green-300'
                                : isActive
                                  ? 'bg-sky-500/30 text-sky-300 animate-pulse'
                                  : 'bg-slate-700/50 text-slate-400'
                            }`}>
                              {isCompleted ? '\u2713' : isActive ? '\u25B6' : '\u25CB'}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${isCompleted ? 'text-green-300' : 'text-slate-200'}`}>
                                {challenge.instruction}
                              </p>
                              {isActive && (
                                <p className="text-xs text-sky-400/70 mt-1 italic">
                                  {challenge.hint}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>

                {/* Challenge progress */}
                {challenges.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${(challengesCompleted.length / challenges.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {challengesCompleted.length}/{challenges.length}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Flight State Description */}
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${currentFlightState.color}20`, border: `1px solid ${currentFlightState.color}40` }}
                  >
                    <FlightStateIcon className="w-5 h-5" style={{ color: currentFlightState.color }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: currentFlightState.color }}>
                      {currentFlightState.label}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentFlightState.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Educational info for K-2 */}
            {gradeBand === 'K-2' && (
              <div className="p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Plane className="w-5 h-5 text-sky-400" />
                  How Do Airplanes Fly?
                </h4>
                <div className="space-y-2">
                  <p className="text-slate-300 text-sm">
                    Four forces work together to make an airplane fly:
                  </p>
                  <ul className="text-sm space-y-1.5 ml-1">
                    <li className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FORCE_COLORS.lift.color }} />
                      <span className="text-slate-300"><span className="font-semibold text-blue-300">Lift</span> pushes the plane UP</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FORCE_COLORS.weight.color }} />
                      <span className="text-slate-300"><span className="font-semibold text-red-300">Weight</span> pulls the plane DOWN</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FORCE_COLORS.thrust.color }} />
                      <span className="text-slate-300"><span className="font-semibold text-green-300">Thrust</span> pushes the plane FORWARD</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FORCE_COLORS.drag.color }} />
                      <span className="text-slate-300"><span className="font-semibold text-orange-300">Drag</span> holds the plane BACK</span>
                    </li>
                  </ul>
                  <p className="text-slate-300 text-sm mt-2">
                    Tap each arrow to learn more! Try changing the sliders to see what happens.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightForcesExplorer;
