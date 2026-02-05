'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { MissionPlannerMetrics } from '../../../evaluation/types';

// =============================================================================
// Type Definitions - Single Source of Truth
// =============================================================================

export type Destination = 'moon' | 'mars' | 'venus' | 'jupiter' | 'asteroid';
export type MissionType = 'flyby' | 'orbit' | 'landing' | 'return';
export type TrajectoryType = 'direct' | 'gravity_assist';
export type LearningPhase = 'explore' | 'plan' | 'prepare' | 'launch';

export interface DestinationInfo {
  id: Destination;
  name: string;
  distanceFromSunAU: number;
  orbitAngleDeg: number;
  color: string;
  radiusPx: number;
  travelDaysDirect: number;
  travelDaysAssist?: number;
  assistPlanet?: string;
  description: string;
  funFact: string;
}

export interface SupplyItem {
  id: string;
  name: string;
  icon: string;
  perDayKg: number;
  description: string;
  required: boolean;
}

export interface LaunchWindow {
  id: string;
  label: string;
  description: string;
  optimal: boolean;
  fuelMultiplier: number;
  travelTimeMultiplier: number;
}

export interface MissionPlannerData {
  title: string;
  description: string;
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  // Available destinations
  destinations: DestinationInfo[];

  // Mission configuration
  missionType: MissionType;
  crewed: boolean;

  // Feature toggles by grade
  showLaunchWindows: boolean;
  showTrajectory: boolean;
  supplyCalculator: boolean;
  gravityAssistOption: boolean;
  fuelConstraint: number; // available propellant in tons
  missionClock: boolean;

  // Launch window options (grades 3+)
  launchWindows?: LaunchWindow[];

  // Supply items (grades 2+)
  supplies?: SupplyItem[];

  // Learning content
  learningFocus: string;
  hints: string[];
  funFact?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MissionPlannerMetrics>) => void;
}

interface MissionPlannerProps {
  data: MissionPlannerData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EARTH_AU = 1.0;
const SVG_CENTER = 300;
const AU_TO_PX = 80;
const EARTH_COLOR = '#4A90D9';
const SUN_COLOR = '#FFD700';
const ORBIT_COLOR = 'rgba(255, 255, 255, 0.15)';
const TRAJECTORY_COLOR = '#00FF88';
const ASSIST_COLOR = '#FF6B6B';

const PHASE_LABELS: Record<LearningPhase, string> = {
  explore: '1. Explore',
  plan: '2. Plan',
  prepare: '3. Prepare',
  launch: '4. Launch!',
};

const PHASE_INSTRUCTIONS: Record<LearningPhase, Record<string, string>> = {
  explore: {
    K: 'Pick a place in space you want to visit!',
    '1': 'Choose where you want to go! Some places are farther away.',
    '2': 'Select your destination. Farther places need more time!',
    '3': 'Choose a destination and think about how far it is from Earth.',
    '4': 'Select your destination. Consider distance and travel time.',
    '5': 'Analyze each destination. Consider distance, travel time, and mission complexity.',
  },
  plan: {
    K: 'Your spaceship will fly to your destination!',
    '1': 'Watch how your spaceship will travel through space!',
    '2': 'See the path your spaceship will take!',
    '3': 'Choose when to launch — timing matters in space!',
    '4': 'Plan your route. Could another planet give you a speed boost?',
    '5': 'Optimize your trajectory. Direct or gravity assist? When to launch?',
  },
  prepare: {
    K: 'Pack some things for your space trip!',
    '1': 'What do astronauts need for a long trip?',
    '2': 'Pack food, water, and air. More days = more supplies!',
    '3': 'Calculate how many supplies your crew needs.',
    '4': 'Balance your payload: supplies vs fuel vs equipment.',
    '5': 'Optimize fuel vs payload. Every kilogram matters!',
  },
  launch: {
    K: 'Blast off! Watch your spaceship fly to space! 🚀',
    '1': 'Your mission is launching! Watch it travel!',
    '2': 'Mission launched! Track the progress!',
    '3': 'Mission underway! Monitor supplies and distance.',
    '4': 'Mission in progress. Is your plan working?',
    '5': 'Mission executing. Monitor fuel, trajectory, and timing.',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

function auToPixel(au: number): number {
  return au * AU_TO_PX;
}

function polarToCartesian(centerX: number, centerY: number, radiusPx: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: centerX + radiusPx * Math.cos(rad),
    y: centerY + radiusPx * Math.sin(rad),
  };
}

function formatDays(days: number, grade: string): string {
  if (grade === 'K' || grade === '1') {
    if (days < 7) return `${days} days`;
    if (days < 60) return `about ${Math.round(days / 7)} weeks`;
    return `about ${Math.round(days / 30)} months`;
  }
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remaining = days % 365;
    if (remaining > 30) return `${years} year${years > 1 ? 's' : ''} ${Math.round(remaining / 30)} months`;
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  return `${days} days`;
}

// =============================================================================
// Sub-components
// =============================================================================

const PhaseIndicator: React.FC<{
  currentPhase: LearningPhase;
  phases: LearningPhase[];
  completedPhases: Set<LearningPhase>;
}> = ({ currentPhase, phases, completedPhases }) => (
  <div className="flex items-center gap-1 mb-4">
    {phases.map((phase, i) => {
      const isActive = phase === currentPhase;
      const isCompleted = completedPhases.has(phase);
      return (
        <React.Fragment key={phase}>
          {i > 0 && (
            <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-blue-400' : 'bg-slate-600'}`} />
          )}
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : isCompleted
                ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                : 'bg-slate-700/50 text-slate-500 border border-slate-600/40'
            }`}
          >
            {isCompleted ? '✓ ' : ''}{PHASE_LABELS[phase]}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

// =============================================================================
// Solar System Map (D3)
// =============================================================================

const SolarSystemMap: React.FC<{
  destinations: DestinationInfo[];
  selectedDestination: Destination | null;
  trajectoryType: TrajectoryType;
  showTrajectory: boolean;
  showGravityAssist: boolean;
  missionProgress: number; // 0-1
  missionActive: boolean;
  grade: string;
}> = ({
  destinations,
  selectedDestination,
  trajectoryType,
  showTrajectory,
  showGravityAssist,
  missionProgress,
  missionActive,
  grade,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 600;
    const cx = width / 2;
    const cy = height / 2;

    // Background starfield
    const defs = svg.append('defs');

    // Sun glow gradient
    const sunGradient = defs.append('radialGradient')
      .attr('id', 'sun-glow')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    sunGradient.append('stop').attr('offset', '0%').attr('stop-color', '#FFF7D0');
    sunGradient.append('stop').attr('offset', '60%').attr('stop-color', '#FFD700');
    sunGradient.append('stop').attr('offset', '100%').attr('stop-color', '#FF8C00');

    // Stars
    const starGroup = svg.append('g').attr('class', 'stars');
    for (let i = 0; i < 120; i++) {
      starGroup.append('circle')
        .attr('cx', Math.random() * width)
        .attr('cy', Math.random() * height)
        .attr('r', Math.random() * 1.5 + 0.3)
        .attr('fill', 'white')
        .attr('opacity', Math.random() * 0.6 + 0.2);
    }

    // Draw orbit rings
    const orbits = svg.append('g').attr('class', 'orbits');

    // Earth orbit
    orbits.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', auToPixel(EARTH_AU))
      .attr('fill', 'none')
      .attr('stroke', ORBIT_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Destination orbits
    destinations.forEach((dest) => {
      orbits.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', auToPixel(dest.distanceFromSunAU))
        .attr('fill', 'none')
        .attr('stroke', ORBIT_COLOR)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');
    });

    // Sun
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', 18)
      .attr('fill', 'url(#sun-glow)')
      .attr('filter', 'blur(1px)');
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', 12)
      .attr('fill', SUN_COLOR);

    // Sun label
    if (grade !== 'K') {
      svg.append('text')
        .attr('x', cx).attr('y', cy + 28)
        .attr('text-anchor', 'middle')
        .attr('fill', '#FFD700')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .text('Sun');
    }

    // Earth
    const earthAngle = 180; // position Earth at bottom for intuitive layout
    const earthPos = polarToCartesian(cx, cy, auToPixel(EARTH_AU), earthAngle);

    svg.append('circle')
      .attr('cx', earthPos.x).attr('cy', earthPos.y)
      .attr('r', 8)
      .attr('fill', EARTH_COLOR)
      .attr('stroke', '#5DADE2')
      .attr('stroke-width', 1.5);

    svg.append('text')
      .attr('x', earthPos.x).attr('y', earthPos.y + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5DADE2')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text('Earth 🌍');

    // Destination planets
    destinations.forEach((dest) => {
      const destPos = polarToCartesian(cx, cy, auToPixel(dest.distanceFromSunAU), dest.orbitAngleDeg);
      const isSelected = dest.id === selectedDestination;

      // Selection ring
      if (isSelected) {
        svg.append('circle')
          .attr('cx', destPos.x).attr('cy', destPos.y)
          .attr('r', dest.radiusPx + 6)
          .attr('fill', 'none')
          .attr('stroke', '#00FF88')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '3,3')
          .attr('opacity', 0.8);
      }

      // Planet
      svg.append('circle')
        .attr('cx', destPos.x).attr('cy', destPos.y)
        .attr('r', dest.radiusPx)
        .attr('fill', dest.color)
        .attr('stroke', isSelected ? '#00FF88' : 'rgba(255,255,255,0.3)')
        .attr('stroke-width', isSelected ? 2 : 1)
        .attr('opacity', isSelected ? 1 : 0.8);

      // Planet label
      svg.append('text')
        .attr('x', destPos.x).attr('y', destPos.y + dest.radiusPx + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? '#00FF88' : 'rgba(255,255,255,0.7)')
        .attr('font-size', isSelected ? '12px' : '10px')
        .attr('font-weight', isSelected ? 'bold' : 'normal')
        .text(dest.name);
    });

    // Draw trajectory
    if (selectedDestination && showTrajectory) {
      const dest = destinations.find((d) => d.id === selectedDestination);
      if (dest) {
        const destPos = polarToCartesian(cx, cy, auToPixel(dest.distanceFromSunAU), dest.orbitAngleDeg);

        if (trajectoryType === 'gravity_assist' && showGravityAssist && dest.assistPlanet) {
          // Find assist planet
          const assistDest = destinations.find((d) => d.name.toLowerCase() === dest.assistPlanet?.toLowerCase());
          if (assistDest) {
            const assistPos = polarToCartesian(cx, cy, auToPixel(assistDest.distanceFromSunAU), assistDest.orbitAngleDeg);

            // Earth → Assist planet
            const line1 = d3.line<{ x: number; y: number }>()
              .x((d) => d.x)
              .y((d) => d.y)
              .curve(d3.curveBasis);

            const midpoint1 = {
              x: (earthPos.x + assistPos.x) / 2 + (Math.random() - 0.5) * 30,
              y: (earthPos.y + assistPos.y) / 2 + (Math.random() - 0.5) * 30,
            };

            svg.append('path')
              .datum([earthPos, midpoint1, assistPos])
              .attr('d', line1)
              .attr('fill', 'none')
              .attr('stroke', ASSIST_COLOR)
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '6,4')
              .attr('opacity', 0.7);

            // Assist planet → Destination
            const midpoint2 = {
              x: (assistPos.x + destPos.x) / 2 + (Math.random() - 0.5) * 30,
              y: (assistPos.y + destPos.y) / 2 + (Math.random() - 0.5) * 30,
            };

            svg.append('path')
              .datum([assistPos, midpoint2, destPos])
              .attr('d', line1)
              .attr('fill', 'none')
              .attr('stroke', TRAJECTORY_COLOR)
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '6,4')
              .attr('opacity', 0.7);

            // Assist label
            svg.append('text')
              .attr('x', assistPos.x).attr('y', assistPos.y - assistDest.radiusPx - 8)
              .attr('text-anchor', 'middle')
              .attr('fill', ASSIST_COLOR)
              .attr('font-size', '9px')
              .text('Gravity Assist!');
          }
        } else {
          // Direct trajectory - curved line from Earth to destination
          const line = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(d3.curveBasis);

          // Create a curved path through a midpoint offset from the straight line
          const midX = (earthPos.x + destPos.x) / 2;
          const midY = (earthPos.y + destPos.y) / 2;
          const dx = destPos.x - earthPos.x;
          const dy = destPos.y - earthPos.y;
          const perpX = -dy * 0.2;
          const perpY = dx * 0.2;

          svg.append('path')
            .datum([earthPos, { x: midX + perpX, y: midY + perpY }, destPos])
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', TRAJECTORY_COLOR)
            .attr('stroke-width', 2.5)
            .attr('stroke-dasharray', '8,4')
            .attr('opacity', 0.8);
        }

        // Spacecraft indicator during mission
        if (missionActive && missionProgress > 0) {
          const t = missionProgress;
          const shipX = earthPos.x + (destPos.x - earthPos.x) * t;
          const shipY = earthPos.y + (destPos.y - earthPos.y) * t;

          // Spacecraft
          svg.append('text')
            .attr('x', shipX).attr('y', shipY)
            .attr('text-anchor', 'middle')
            .attr('font-size', '16px')
            .text('🚀');

          // Trail
          svg.append('line')
            .attr('x1', earthPos.x).attr('y1', earthPos.y)
            .attr('x2', shipX).attr('y2', shipY)
            .attr('stroke', TRAJECTORY_COLOR)
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.5);
        }
      }
    }
  }, [destinations, selectedDestination, trajectoryType, showTrajectory, showGravityAssist, missionProgress, missionActive, grade]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 600"
      className="w-full max-w-[600px] mx-auto rounded-xl border border-slate-700/50"
      style={{ background: 'radial-gradient(ellipse at center, #0a1628 0%, #000510 100%)' }}
    />
  );
};

// =============================================================================
// Supply Calculator Component
// =============================================================================

const SupplyCalculator: React.FC<{
  supplies: SupplyItem[];
  travelDays: number;
  crewed: boolean;
  crewSize: number;
  packedSupplies: Record<string, number>;
  onSupplyChange: (supplyId: string, days: number) => void;
  grade: string;
  fuelConstraint: number;
}> = ({ supplies, travelDays, crewed, crewSize, packedSupplies, onSupplyChange, grade, fuelConstraint }) => {
  const totalMassKg = useMemo(() => {
    return supplies.reduce((total, supply) => {
      const days = packedSupplies[supply.id] || 0;
      return total + supply.perDayKg * days * (crewed ? crewSize : 1);
    }, 0);
  }, [supplies, packedSupplies, crewed, crewSize]);

  const fuelUsedPercent = Math.min(100, (totalMassKg / (fuelConstraint * 1000)) * 100);

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <h4 className="text-sm font-semibold text-white mb-3">
        {grade === 'K' || grade === '1' ? '🎒 Pack Your Bag!' : '📦 Supply Calculator'}
      </h4>

      {crewed && (
        <div className="mb-3 text-xs text-slate-400">
          Crew of {crewSize} • Trip: {travelDays} days {grade !== 'K' && `(need supplies for ${travelDays * (crewed ? 2 : 1)} days round-trip)`}
        </div>
      )}

      <div className="space-y-3">
        {supplies.map((supply) => {
          const packed = packedSupplies[supply.id] || 0;
          const needed = travelDays * (crewed ? 2 : 1); // round trip
          const isEnough = packed >= needed;

          return (
            <div key={supply.id} className="flex items-center gap-3">
              <span className="text-lg">{supply.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">{supply.name}</span>
                  {grade !== 'K' && (
                    <span className={`text-xs ${isEnough ? 'text-green-400' : 'text-amber-400'}`}>
                      {packed}/{needed} days
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(needed * 1.5, 30)}
                  step={1}
                  value={packed}
                  onChange={(e) => onSupplyChange(supply.id, parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              {grade !== 'K' && (
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                  isEnough ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {isEnough ? '✓' : '!'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fuel gauge */}
      {grade !== 'K' && grade !== '1' && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Payload mass</span>
            <span className="text-xs text-slate-300">{Math.round(totalMassKg)} kg / {fuelConstraint * 1000} kg limit</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                fuelUsedPercent > 90 ? 'bg-red-500' : fuelUsedPercent > 70 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${fuelUsedPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Mission Clock Component
// =============================================================================

const MissionClock: React.FC<{
  travelDays: number;
  progress: number;
  isActive: boolean;
  grade: string;
}> = ({ travelDays, progress, isActive, grade }) => {
  const elapsedDays = Math.round(travelDays * progress);
  const remainingDays = travelDays - elapsedDays;

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <h4 className="text-sm font-semibold text-white mb-2">⏱️ Mission Clock</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{elapsedDays}</div>
          <div className="text-xs text-slate-400">Days Elapsed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-400">{remainingDays}</div>
          <div className="text-xs text-slate-400">Days Left</div>
        </div>
      </div>
      {isActive && (
        <div className="mt-3">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 text-center mt-1">
            {Math.round(progress * 100)}% complete
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

const MissionPlanner: React.FC<MissionPlannerProps> = ({ data, className }) => {
  const {
    title,
    description,
    gradeLevel,
    destinations,
    missionType,
    crewed,
    showLaunchWindows,
    showTrajectory,
    supplyCalculator,
    gravityAssistOption,
    fuelConstraint,
    missionClock,
    launchWindows,
    supplies,
    hints,
    funFact,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Determine which phases are available based on grade
  const availablePhases = useMemo<LearningPhase[]>(() => {
    const phases: LearningPhase[] = ['explore'];
    if (gradeLevel !== 'K') phases.push('plan');
    if (supplyCalculator) phases.push('prepare');
    phases.push('launch');
    return phases;
  }, [gradeLevel, supplyCalculator]);

  // State
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('explore');
  const [completedPhases, setCompletedPhases] = useState<Set<LearningPhase>>(new Set());
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedLaunchWindow, setSelectedLaunchWindow] = useState<string | null>(null);
  const [trajectoryType, setTrajectoryType] = useState<TrajectoryType>('direct');
  const [packedSupplies, setPackedSupplies] = useState<Record<string, number>>({});
  const [crewSize, setCrewSize] = useState(3);
  const [missionActive, setMissionActive] = useState(false);
  const [missionProgress, setMissionProgress] = useState(0);
  const [missionComplete, setMissionComplete] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);

  const missionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Evaluation
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<MissionPlannerMetrics>({
    primitiveType: 'mission-planner',
    instanceId: instanceId || `mission-planner-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Derived values
  const selectedDest = useMemo(
    () => destinations.find((d) => d.id === selectedDestination),
    [destinations, selectedDestination]
  );

  const travelDays = useMemo(() => {
    if (!selectedDest) return 0;
    let days = selectedDest.travelDaysDirect;
    if (trajectoryType === 'gravity_assist' && selectedDest.travelDaysAssist) {
      days = selectedDest.travelDaysAssist;
    }
    const window = launchWindows?.find((w) => w.id === selectedLaunchWindow);
    if (window) {
      days = Math.round(days * window.travelTimeMultiplier);
    }
    return days;
  }, [selectedDest, trajectoryType, selectedLaunchWindow, launchWindows]);

  const suppliesReady = useMemo(() => {
    if (!supplyCalculator || !supplies) return true;
    const neededDays = travelDays * (crewed ? 2 : 1);
    return supplies.filter((s) => s.required).every((s) => (packedSupplies[s.id] || 0) >= neededDays);
  }, [supplyCalculator, supplies, travelDays, crewed, packedSupplies]);

  // Phase navigation
  const advancePhase = useCallback(() => {
    setCompletedPhases((prev) => new Set([...prev, currentPhase]));
    const currentIndex = availablePhases.indexOf(currentPhase);
    if (currentIndex < availablePhases.length - 1) {
      setCurrentPhase(availablePhases[currentIndex + 1]);
    }
  }, [currentPhase, availablePhases]);

  const canAdvance = useMemo(() => {
    switch (currentPhase) {
      case 'explore':
        return selectedDestination !== null;
      case 'plan':
        if (showLaunchWindows && !selectedLaunchWindow) return false;
        return true;
      case 'prepare':
        return suppliesReady;
      case 'launch':
        return false; // handled by launch button
      default:
        return false;
    }
  }, [currentPhase, selectedDestination, showLaunchWindows, selectedLaunchWindow, suppliesReady]);

  // Launch mission simulation
  const launchMission = useCallback(() => {
    setMissionActive(true);
    setMissionProgress(0);

    const duration = 8000; // 8 second animation
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      setMissionProgress(progress);

      if (progress < 1) {
        missionTimerRef.current = setTimeout(tick, 50);
      } else {
        setMissionActive(false);
        setMissionComplete(true);

        // Submit evaluation
        if (!hasSubmitted) {
          const score = calculateScore();
          const metrics: MissionPlannerMetrics = {
            type: 'mission-planner',
            destination: selectedDestination!,
            missionType,
            trajectoryType,
            crewed,
            travelDays,
            suppliesPacked: suppliesReady,
            launchWindowSelected: selectedLaunchWindow !== null,
            optimalLaunchWindow: launchWindows?.find((w) => w.id === selectedLaunchWindow)?.optimal ?? false,
            gravityAssistUsed: trajectoryType === 'gravity_assist',
            fuelEfficiency: calculateFuelEfficiency(),
            phasesCompleted: completedPhases.size + 1, // +1 for launch
            totalPhases: availablePhases.length,
            missionSuccess: true,
          };

          submitResult(true, score, metrics, {
            studentWork: {
              destination: selectedDestination,
              trajectoryType,
              launchWindow: selectedLaunchWindow,
              packedSupplies,
              crewSize,
            },
          });
        }
      }
    };

    tick();
  }, [
    hasSubmitted, selectedDestination, missionType, trajectoryType, crewed,
    travelDays, suppliesReady, selectedLaunchWindow, launchWindows,
    completedPhases, availablePhases, submitResult, packedSupplies, crewSize,
  ]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (missionTimerRef.current) clearTimeout(missionTimerRef.current);
    };
  }, []);

  const calculateScore = useCallback((): number => {
    let score = 50; // Base score for completing
    if (selectedDestination) score += 10;
    if (suppliesReady) score += 15;
    if (selectedLaunchWindow) {
      const window = launchWindows?.find((w) => w.id === selectedLaunchWindow);
      score += window?.optimal ? 15 : 5;
    }
    if (trajectoryType === 'gravity_assist' && gravityAssistOption) score += 10;
    return Math.min(100, score);
  }, [selectedDestination, suppliesReady, selectedLaunchWindow, launchWindows, trajectoryType, gravityAssistOption]);

  const calculateFuelEfficiency = useCallback((): number => {
    if (!selectedDest) return 0;
    const baseDays = selectedDest.travelDaysDirect;
    const actualDays = travelDays;
    if (actualDays <= baseDays) return 100;
    return Math.max(0, Math.round((baseDays / actualDays) * 100));
  }, [selectedDest, travelDays]);

  // Reset
  const handleReset = useCallback(() => {
    setCurrentPhase('explore');
    setCompletedPhases(new Set());
    setSelectedDestination(null);
    setSelectedLaunchWindow(null);
    setTrajectoryType('direct');
    setPackedSupplies({});
    setMissionActive(false);
    setMissionProgress(0);
    setMissionComplete(false);
    resetAttempt();
  }, [resetAttempt]);

  const handleSupplyChange = useCallback((supplyId: string, days: number) => {
    setPackedSupplies((prev) => ({ ...prev, [supplyId]: days }));
  }, []);

  return (
    <div className={`bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-slate-800/40 border-b border-slate-700/50">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🛸</span> {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      <div className="p-6">
        {/* Phase Indicator */}
        <PhaseIndicator
          currentPhase={currentPhase}
          phases={availablePhases}
          completedPhases={completedPhases}
        />

        {/* Phase Instruction */}
        <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-300">
            {PHASE_INSTRUCTIONS[currentPhase][gradeLevel]}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Solar System Map */}
          <div>
            <SolarSystemMap
              destinations={destinations}
              selectedDestination={selectedDestination}
              trajectoryType={trajectoryType}
              showTrajectory={showTrajectory && currentPhase !== 'explore'}
              showGravityAssist={gravityAssistOption}
              missionProgress={missionProgress}
              missionActive={missionActive}
              grade={gradeLevel}
            />

            {/* Fun fact */}
            {funFact && (
              <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <p className="text-xs text-purple-300">💡 {funFact}</p>
              </div>
            )}
          </div>

          {/* Right: Controls Panel */}
          <div className="space-y-4">
            {/* EXPLORE Phase: Destination Selection */}
            {currentPhase === 'explore' && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h4 className="text-sm font-semibold text-white mb-3">
                  {gradeLevel === 'K' ? '🪐 Where do you want to go?' : '🎯 Select Destination'}
                </h4>
                <div className="space-y-2">
                  {destinations.map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => setSelectedDestination(dest.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedDestination === dest.id
                          ? 'bg-blue-600/30 border-blue-500/50 border'
                          : 'bg-slate-700/30 border-slate-600/30 border hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dest.color }}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{dest.name}</div>
                          <div className="text-xs text-slate-400">{dest.description}</div>
                          {gradeLevel !== 'K' && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              Travel time: ~{formatDays(dest.travelDaysDirect, gradeLevel)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedDest && (
                  <div className="mt-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <p className="text-xs text-indigo-300">🌟 {selectedDest.funFact}</p>
                  </div>
                )}
              </div>
            )}

            {/* PLAN Phase: Launch Window + Trajectory */}
            {currentPhase === 'plan' && (
              <>
                {/* Launch Windows */}
                {showLaunchWindows && launchWindows && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h4 className="text-sm font-semibold text-white mb-3">📅 Launch Window</h4>
                    <div className="space-y-2">
                      {launchWindows.map((window) => (
                        <button
                          key={window.id}
                          onClick={() => setSelectedLaunchWindow(window.id)}
                          className={`w-full text-left p-3 rounded-lg transition-all ${
                            selectedLaunchWindow === window.id
                              ? 'bg-blue-600/30 border-blue-500/50 border'
                              : 'bg-slate-700/30 border-slate-600/30 border hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{window.label}</div>
                              <div className="text-xs text-slate-400">{window.description}</div>
                            </div>
                            {window.optimal && (
                              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                                Best!
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trajectory Type */}
                {gravityAssistOption && selectedDest?.assistPlanet && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h4 className="text-sm font-semibold text-white mb-3">🛤️ Flight Path</h4>
                    <div className="space-y-2">
                      <button
                        onClick={() => setTrajectoryType('direct')}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          trajectoryType === 'direct'
                            ? 'bg-blue-600/30 border-blue-500/50 border'
                            : 'bg-slate-700/30 border-slate-600/30 border hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="text-sm font-medium text-white">Direct Route</div>
                        <div className="text-xs text-slate-400">
                          Straight to {selectedDest.name} • ~{formatDays(selectedDest.travelDaysDirect, gradeLevel)}
                        </div>
                      </button>
                      <button
                        onClick={() => setTrajectoryType('gravity_assist')}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          trajectoryType === 'gravity_assist'
                            ? 'bg-blue-600/30 border-blue-500/50 border'
                            : 'bg-slate-700/30 border-slate-600/30 border hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="text-sm font-medium text-white">
                          Gravity Assist via {selectedDest.assistPlanet}
                        </div>
                        <div className="text-xs text-slate-400">
                          Use {selectedDest.assistPlanet}'s gravity for a speed boost! • ~{formatDays(selectedDest.travelDaysAssist || selectedDest.travelDaysDirect, gradeLevel)}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Travel time summary */}
                {selectedDest && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h4 className="text-sm font-semibold text-white mb-2">📊 Mission Summary</h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-blue-400">{formatDays(travelDays, gradeLevel)}</div>
                        <div className="text-xs text-slate-400">Travel Time</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-400">{selectedDest.distanceFromSunAU} AU</div>
                        <div className="text-xs text-slate-400">Distance from Sun</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PREPARE Phase: Supply Calculator */}
            {currentPhase === 'prepare' && supplies && (
              <SupplyCalculator
                supplies={supplies}
                travelDays={travelDays}
                crewed={crewed}
                crewSize={crewSize}
                packedSupplies={packedSupplies}
                onSupplyChange={handleSupplyChange}
                grade={gradeLevel}
                fuelConstraint={fuelConstraint}
              />
            )}

            {/* LAUNCH Phase: Mission Control */}
            {currentPhase === 'launch' && (
              <div className="space-y-4">
                {!missionActive && !missionComplete && (
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 text-center">
                    <h4 className="text-lg font-bold text-white mb-2">🚀 Ready for Launch!</h4>
                    <p className="text-sm text-slate-400 mb-4">
                      Destination: {selectedDest?.name} • {formatDays(travelDays, gradeLevel)}
                    </p>
                    <button
                      onClick={launchMission}
                      disabled={missionActive}
                      className="px-8 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 transition-all text-lg"
                    >
                      🔥 LAUNCH! 🔥
                    </button>
                  </div>
                )}

                {(missionActive || missionComplete) && missionClock && (
                  <MissionClock
                    travelDays={travelDays}
                    progress={missionProgress}
                    isActive={missionActive}
                    grade={gradeLevel}
                  />
                )}

                {missionComplete && (
                  <div className="bg-green-500/10 rounded-xl p-6 border border-green-500/30 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <h4 className="text-lg font-bold text-green-400 mb-2">Mission Complete!</h4>
                    <p className="text-sm text-slate-300">
                      You made it to {selectedDest?.name}!
                      {gradeLevel !== 'K' && ` Your trip took ${formatDays(travelDays, gradeLevel)}.`}
                    </p>
                    {hasSubmitted && (
                      <button
                        onClick={handleReset}
                        className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                      >
                        Plan Another Mission
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            {currentPhase !== 'launch' && (
              <div className="flex gap-3">
                {availablePhases.indexOf(currentPhase) > 0 && (
                  <button
                    onClick={() => {
                      const idx = availablePhases.indexOf(currentPhase);
                      setCurrentPhase(availablePhases[idx - 1]);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={advancePhase}
                  disabled={!canAdvance}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all text-sm"
                >
                  {canAdvance ? 'Next →' : 'Complete this step first'}
                </button>
              </div>
            )}

            {/* Hints */}
            {hints.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => {
                    setShowHint(true);
                    setCurrentHint((prev) => (prev + 1) % hints.length);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  💡 Need a hint?
                </button>
                {showHint && (
                  <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <p className="text-xs text-amber-300">{hints[currentHint]}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionPlanner;
