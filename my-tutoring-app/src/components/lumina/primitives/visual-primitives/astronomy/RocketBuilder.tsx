'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { RocketBuilderMetrics } from '../../../evaluation/types';

// =============================================================================
// Type Definitions - Single Source of Truth
// =============================================================================

export interface RocketComponent {
  id: string;
  name: string;
  type: 'capsule' | 'fuel_tank' | 'engine' | 'booster' | 'fins' | 'fairing' | 'payload';
  massKg: number;
  // Engine-specific properties
  thrustKN?: number;
  specificImpulse?: number; // Isp in seconds (efficiency)
  burnTimeSeconds?: number;
  // Fuel tank properties
  propellantMassKg?: number;
  // Visual properties
  widthUnits: number;
  heightUnits: number;
  color: string;
  description: string;
  cost?: number;
}

export interface RocketStage {
  id: string;
  components: string[]; // Component IDs in order (bottom to top)
}

export interface LaunchResult {
  success: boolean;
  maxAltitudeKm: number;
  reachedOrbit: boolean;
  stagingEvents: Array<{
    timeSeconds: number;
    altitudeKm: number;
    stageDropped: number;
  }>;
  flightProfile: Array<{
    timeSeconds: number;
    altitudeKm: number;
    velocityMs: number;
    accelerationG: number;
    massKg: number;
    thrustKN: number;
    dragKN: number;
  }>;
  failureReason?: string;
}

export interface RocketBuilderData {
  title: string;
  description: string;

  // Available components for building
  availableComponents: RocketComponent[];

  // Challenge configuration
  maxStages: number;
  targetAltitudeKm: number;
  targetOrbit: boolean;

  // Display options
  showTWR: boolean;
  showFuelGauge: boolean;
  showForces: boolean;
  atmosphereModel: 'simple' | 'realistic';
  guidedMode: boolean;
  budget?: number;
  simulationSpeed: number;

  // Grade-appropriate content
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';
  learningFocus: string;
  hints: string[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RocketBuilderMetrics>) => void;
}

interface RocketBuilderProps {
  data: RocketBuilderData;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const GRAVITY = 9.81; // m/s^2
const KARMAN_LINE_KM = 100; // Edge of space
const LEO_ALTITUDE_KM = 200; // Low Earth Orbit
const ORBITAL_VELOCITY_MS = 7800; // Approximate LEO orbital velocity

// Component visual colors
const COMPONENT_COLORS: Record<string, string> = {
  capsule: '#E74C3C',
  fuel_tank: '#3498DB',
  engine: '#F39C12',
  booster: '#E67E22',
  fins: '#95A5A6',
  fairing: '#BDC3C7',
  payload: '#9B59B6',
};

// =============================================================================
// Main Component
// =============================================================================

const RocketBuilder: React.FC<RocketBuilderProps> = ({ data, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const flightSvgRef = useRef<SVGSVGElement>(null);

  // State
  const [stages, setStages] = useState<RocketStage[]>([{ id: 'stage-1', components: [] }]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [flightProgress, setFlightProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<RocketBuilderMetrics>({
    primitiveType: 'rocket-builder',
    instanceId: instanceId || `rocket-builder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // =============================================================================
  // Computed Values
  // =============================================================================

  const componentMap = useMemo(() => {
    const map = new Map<string, RocketComponent>();
    (data.availableComponents || []).forEach(c => map.set(c.id, c));
    return map;
  }, [data.availableComponents]);

  const rocketStats = useMemo(() => {
    let totalMassKg = 0;
    let totalPropellantKg = 0;
    let totalThrustKN = 0;
    let totalCost = 0;
    let componentCount = 0;

    stages.forEach(stage => {
      stage.components.forEach(compId => {
        const comp = componentMap.get(compId);
        if (comp) {
          totalMassKg += comp.massKg;
          if (comp.propellantMassKg) totalPropellantKg += comp.propellantMassKg;
          if (comp.thrustKN) totalThrustKN += comp.thrustKN;
          if (comp.cost) totalCost += comp.cost;
          componentCount++;
        }
      });
    });

    const totalWeight = totalMassKg * GRAVITY / 1000; // kN
    const thrustToWeight = totalWeight > 0 ? totalThrustKN / totalWeight : 0;
    const canLift = thrustToWeight > 1;

    // Simplified delta-v calculation (Tsiolkovsky rocket equation)
    const avgIsp = 300; // Average Isp assumption
    const dryMass = totalMassKg - totalPropellantKg;
    const deltaV = dryMass > 0 ? avgIsp * GRAVITY * Math.log(totalMassKg / dryMass) : 0;

    return {
      totalMassKg,
      totalPropellantKg,
      totalThrustKN,
      totalCost,
      componentCount,
      thrustToWeight,
      canLift,
      deltaV,
    };
  }, [stages, componentMap]);

  const budgetRemaining = data.budget ? data.budget - rocketStats.totalCost : null;
  const overBudget = budgetRemaining !== null && budgetRemaining < 0;

  // =============================================================================
  // Component Library by Category
  // =============================================================================

  const componentsByType = useMemo(() => {
    const grouped: Record<string, RocketComponent[]> = {};
    (data.availableComponents || []).forEach(comp => {
      if (!grouped[comp.type]) grouped[comp.type] = [];
      grouped[comp.type].push(comp);
    });
    return grouped;
  }, [data.availableComponents]);

  // =============================================================================
  // Flight Simulation
  // =============================================================================

  const simulateFlight = useCallback((): LaunchResult => {
    const flightProfile: LaunchResult['flightProfile'] = [];
    const stagingEvents: LaunchResult['stagingEvents'] = [];

    let altitude = 0; // meters
    let velocity = 0; // m/s
    let time = 0; // seconds
    let currentStageIndex = stages.length - 1; // Start from bottom stage

    // Build stage data
    const stageData = stages.map(stage => {
      let mass = 0;
      let propellant = 0;
      let thrust = 0;
      let burnTime = 0;

      stage.components.forEach(compId => {
        const comp = componentMap.get(compId);
        if (comp) {
          mass += comp.massKg;
          if (comp.propellantMassKg) propellant += comp.propellantMassKg;
          if (comp.thrustKN) thrust += comp.thrustKN;
          if (comp.burnTimeSeconds) burnTime = Math.max(burnTime, comp.burnTimeSeconds);
        }
      });

      return { mass, propellant, thrust, burnTime, fuelRemaining: propellant };
    });

    // Total mass including all stages
    let totalMass = stageData.reduce((sum, s) => sum + s.mass, 0);

    if (totalMass === 0 || stageData[currentStageIndex].thrust === 0) {
      return {
        success: false,
        maxAltitudeKm: 0,
        reachedOrbit: false,
        stagingEvents: [],
        flightProfile: [],
        failureReason: 'No engines or fuel! Add engines and fuel tanks to launch.',
      };
    }

    // Check TWR at launch
    const initialTWR = stageData[currentStageIndex].thrust * 1000 / (totalMass * GRAVITY);
    if (initialTWR < 1) {
      return {
        success: false,
        maxAltitudeKm: 0,
        reachedOrbit: false,
        stagingEvents: [],
        flightProfile: [],
        failureReason: `Not enough thrust! Your rocket needs more power to lift off. (TWR: ${initialTWR.toFixed(2)})`,
      };
    }

    const dt = 0.5; // Time step in seconds
    let maxAltitude = 0;
    let enginesCutoff = false;

    while (time < 600 && altitude >= 0 && !enginesCutoff) { // Max 10 minutes
      const currentStage = stageData[currentStageIndex];

      // Calculate forces
      let thrust = currentStage.thrust * 1000; // Convert to N

      // Fuel consumption
      if (currentStage.fuelRemaining > 0 && thrust > 0) {
        const fuelRate = currentStage.propellant / Math.max(currentStage.burnTime, 60);
        currentStage.fuelRemaining -= fuelRate * dt;
        if (currentStage.fuelRemaining <= 0) {
          currentStage.fuelRemaining = 0;

          // Stage separation
          if (currentStageIndex > 0) {
            stagingEvents.push({
              timeSeconds: time,
              altitudeKm: altitude / 1000,
              stageDropped: stages.length - currentStageIndex,
            });
            totalMass -= currentStage.mass;
            currentStageIndex--;
          } else {
            thrust = 0;
            enginesCutoff = true;
          }
        }
      } else if (currentStage.fuelRemaining <= 0) {
        thrust = 0;
        if (currentStageIndex > 0) {
          totalMass -= currentStage.mass;
          currentStageIndex--;
        } else {
          enginesCutoff = true;
        }
      }

      // Gravity
      const gravity = GRAVITY * totalMass;

      // Drag (simplified atmospheric model)
      let drag = 0;
      if (data.atmosphereModel === 'simple') {
        const airDensity = altitude < 100000 ? 1.225 * Math.exp(-altitude / 8500) : 0;
        const dragCoeff = 0.3;
        const crossSection = 10; // m^2 approximation
        drag = 0.5 * airDensity * velocity * velocity * dragCoeff * crossSection;
      }

      // Net acceleration
      const netForce = thrust - gravity - drag;
      const acceleration = netForce / totalMass;

      // Update state
      velocity += acceleration * dt;
      altitude += velocity * dt;
      time += dt;

      // Ground collision
      if (altitude < 0 && velocity < 0) {
        altitude = 0;
        velocity = 0;
        break;
      }

      maxAltitude = Math.max(maxAltitude, altitude);

      // Record flight profile (every 2 seconds)
      if (Math.floor(time) % 2 === 0) {
        flightProfile.push({
          timeSeconds: Math.floor(time),
          altitudeKm: altitude / 1000,
          velocityMs: velocity,
          accelerationG: acceleration / GRAVITY,
          massKg: totalMass,
          thrustKN: thrust / 1000,
          dragKN: drag / 1000,
        });
      }

      // Check if reached orbit
      if (altitude / 1000 >= LEO_ALTITUDE_KM && velocity >= ORBITAL_VELOCITY_MS * 0.8) {
        break;
      }
    }

    const maxAltitudeKm = maxAltitude / 1000;
    const reachedOrbit = maxAltitudeKm >= LEO_ALTITUDE_KM && velocity >= ORBITAL_VELOCITY_MS * 0.8;
    const reachedSpace = maxAltitudeKm >= KARMAN_LINE_KM;
    const success = data.targetOrbit ? reachedOrbit : maxAltitudeKm >= data.targetAltitudeKm;

    let failureReason: string | undefined;
    if (!success) {
      if (maxAltitudeKm < 10) {
        failureReason = 'Rocket barely got off the ground. Try adding more engines or fuel!';
      } else if (maxAltitudeKm < KARMAN_LINE_KM) {
        failureReason = `Reached ${maxAltitudeKm.toFixed(1)} km but didn't make it to space (100 km). Add more fuel!`;
      } else if (data.targetOrbit && !reachedOrbit) {
        failureReason = `Reached space but not enough speed for orbit. Need more delta-v!`;
      } else {
        failureReason = `Reached ${maxAltitudeKm.toFixed(1)} km but target is ${data.targetAltitudeKm} km.`;
      }
    }

    return {
      success,
      maxAltitudeKm,
      reachedOrbit,
      stagingEvents,
      flightProfile,
      failureReason,
    };
  }, [stages, componentMap, data.atmosphereModel, data.targetOrbit, data.targetAltitudeKm]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const addComponentToStage = (componentId: string, stageIndex: number) => {
    if (stages.length <= stageIndex) return;

    const comp = componentMap.get(componentId);
    if (!comp) return;

    // Check budget
    if (budgetRemaining !== null && comp.cost && budgetRemaining < comp.cost) return;

    setStages(prev => {
      const newStages = [...prev];
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        components: [...newStages[stageIndex].components, componentId],
      };
      return newStages;
    });
  };

  const removeComponentFromStage = (componentIndex: number, stageIndex: number) => {
    setStages(prev => {
      const newStages = [...prev];
      newStages[stageIndex] = {
        ...newStages[stageIndex],
        components: newStages[stageIndex].components.filter((_, i) => i !== componentIndex),
      };
      return newStages;
    });
  };

  const addStage = () => {
    if (stages.length >= data.maxStages) return;
    setStages(prev => [...prev, { id: `stage-${prev.length + 1}`, components: [] }]);
  };

  const removeStage = (stageIndex: number) => {
    if (stages.length <= 1) return;
    setStages(prev => prev.filter((_, i) => i !== stageIndex));
  };

  const handleLaunch = async () => {
    if (isLaunching || overBudget) return;

    setIsLaunching(true);
    setLaunchResult(null);
    setFlightProgress(0);
    setAttemptCount(prev => prev + 1);

    const result = simulateFlight();

    // Animate flight progress
    const duration = Math.min(result.flightProfile.length * 100, 5000);
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setFlightProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setLaunchResult(result);
        setIsLaunching(false);

        // Submit evaluation on first successful attempt or after 3+ attempts
        if (result.success || attemptCount >= 2) {
          const metrics: RocketBuilderMetrics = {
            type: 'rocket-builder',
            targetAltitudeKm: data.targetAltitudeKm,
            achievedAltitudeKm: result.maxAltitudeKm,
            targetOrbitRequired: data.targetOrbit,
            achievedOrbit: result.reachedOrbit,
            goalMet: result.success,
            totalMassKg: rocketStats.totalMassKg,
            propellantMassKg: rocketStats.totalPropellantKg,
            totalThrustKN: rocketStats.totalThrustKN,
            thrustToWeightRatio: rocketStats.thrustToWeight,
            deltaVMs: rocketStats.deltaV,
            stagesUsed: stages.length,
            componentsUsed: rocketStats.componentCount,
            stagingEventsCount: result.stagingEvents.length,
            budgetUsed: rocketStats.totalCost,
            budgetLimit: data.budget,
            withinBudget: !overBudget,
            launchAttempts: attemptCount + 1,
            hintsUsed: currentHint,
          };

          const score = result.success ? 100 : Math.min(90, (result.maxAltitudeKm / data.targetAltitudeKm) * 100);

          submitResult(result.success, score, metrics, {
            studentWork: { stages, launchResult: result },
          });
        }
      }
    };

    requestAnimationFrame(animate);
  };

  const handleReset = () => {
    setStages([{ id: 'stage-1', components: [] }]);
    setLaunchResult(null);
    setFlightProgress(0);
    resetAttempt();
  };

  const nextHint = () => {
    setShowHint(true);
    setCurrentHint(prev => Math.min(prev + 1, data.hints.length - 1));
  };

  // =============================================================================
  // Render Rocket in SVG
  // =============================================================================

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 300;
    const height = 400;
    const unitSize = 20;

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'rgba(15, 23, 42, 0.8)')
      .attr('rx', 8);

    // Launch pad
    svg.append('rect')
      .attr('x', 50)
      .attr('y', height - 30)
      .attr('width', 200)
      .attr('height', 30)
      .attr('fill', '#4a5568');

    svg.append('rect')
      .attr('x', 120)
      .attr('y', height - 40)
      .attr('width', 60)
      .attr('height', 10)
      .attr('fill', '#2d3748');

    // Draw rocket stages (bottom to top)
    let yPosition = height - 50;

    stages.forEach((stage, stageIndex) => {
      const stageGroup = svg.append('g')
        .attr('class', `stage-${stageIndex}`);

      // Draw components in stage (bottom to top within stage)
      stage.components.forEach((compId, compIndex) => {
        const comp = componentMap.get(compId);
        if (!comp) return;

        const compHeight = comp.heightUnits * unitSize;
        const compWidth = comp.widthUnits * unitSize;
        yPosition -= compHeight;

        const compGroup = stageGroup.append('g')
          .attr('transform', `translate(${width / 2}, ${yPosition})`)
          .style('cursor', 'pointer')
          .on('click', () => removeComponentFromStage(compIndex, stageIndex));

        // Component body
        if (comp.type === 'capsule') {
          // Capsule shape (dome top)
          compGroup.append('path')
            .attr('d', `
              M ${-compWidth / 2} ${compHeight}
              L ${-compWidth / 2} ${compHeight * 0.3}
              Q ${-compWidth / 2} 0 0 0
              Q ${compWidth / 2} 0 ${compWidth / 2} ${compHeight * 0.3}
              L ${compWidth / 2} ${compHeight}
              Z
            `)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
        } else if (comp.type === 'engine') {
          // Engine bell shape
          compGroup.append('path')
            .attr('d', `
              M ${-compWidth / 3} 0
              L ${-compWidth / 2} ${compHeight}
              L ${compWidth / 2} ${compHeight}
              L ${compWidth / 3} 0
              Z
            `)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);

          // Engine nozzle
          compGroup.append('ellipse')
            .attr('cx', 0)
            .attr('cy', compHeight)
            .attr('rx', compWidth / 2)
            .attr('ry', compHeight * 0.15)
            .attr('fill', '#1a1a2e');
        } else if (comp.type === 'fins') {
          // Triangular fins
          const finWidth = compWidth * 0.6;
          compGroup.append('path')
            .attr('d', `
              M ${-compWidth / 2 - finWidth} ${compHeight}
              L ${-compWidth / 2} 0
              L ${-compWidth / 2} ${compHeight}
              Z
            `)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);

          compGroup.append('path')
            .attr('d', `
              M ${compWidth / 2 + finWidth} ${compHeight}
              L ${compWidth / 2} 0
              L ${compWidth / 2} ${compHeight}
              Z
            `)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
        } else if (comp.type === 'fairing') {
          // Pointed fairing
          compGroup.append('path')
            .attr('d', `
              M ${-compWidth / 2} ${compHeight}
              L ${-compWidth / 2} ${compHeight * 0.3}
              L 0 0
              L ${compWidth / 2} ${compHeight * 0.3}
              L ${compWidth / 2} ${compHeight}
              Z
            `)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1);
        } else {
          // Default rectangular shape for tanks, boosters, payload
          compGroup.append('rect')
            .attr('x', -compWidth / 2)
            .attr('y', 0)
            .attr('width', compWidth)
            .attr('height', compHeight)
            .attr('fill', comp.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          // Fuel level indicator for fuel tanks
          if (comp.type === 'fuel_tank' && comp.propellantMassKg) {
            compGroup.append('rect')
              .attr('x', -compWidth / 2 + 2)
              .attr('y', 2)
              .attr('width', compWidth - 4)
              .attr('height', (compHeight - 4) * 0.9)
              .attr('fill', 'rgba(52, 211, 153, 0.6)')
              .attr('rx', 2);
          }
        }

        // Component label
        compGroup.append('text')
          .attr('x', compWidth / 2 + 8)
          .attr('y', compHeight / 2)
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .attr('dominant-baseline', 'middle')
          .text(comp.name);
      });

      // Stage separator line
      if (stageIndex > 0 && stage.components.length > 0) {
        svg.append('line')
          .attr('x1', 80)
          .attr('x2', 220)
          .attr('y1', yPosition + stages[stageIndex].components.reduce((h, id) => {
            const c = componentMap.get(id);
            return h + (c ? c.heightUnits * unitSize : 0);
          }, 0))
          .attr('y2', yPosition + stages[stageIndex].components.reduce((h, id) => {
            const c = componentMap.get(id);
            return h + (c ? c.heightUnits * unitSize : 0);
          }, 0))
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4 2');
      }
    });

    // Flame animation during launch
    if (isLaunching && flightProgress < 1) {
      const flameGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height - 50})`);

      // Animated flame
      const flameHeight = 30 + Math.random() * 20;
      flameGroup.append('ellipse')
        .attr('cx', 0)
        .attr('cy', flameHeight / 2)
        .attr('rx', 15)
        .attr('ry', flameHeight)
        .attr('fill', 'url(#flameGradient)');
    }

    // Gradient definitions
    const defs = svg.append('defs');

    const flameGradient = defs.append('radialGradient')
      .attr('id', 'flameGradient')
      .attr('cx', '50%')
      .attr('cy', '0%')
      .attr('r', '100%');

    flameGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#fff7ed');
    flameGradient.append('stop')
      .attr('offset', '30%')
      .attr('stop-color', '#fdba74');
    flameGradient.append('stop')
      .attr('offset', '70%')
      .attr('stop-color', '#f97316');
    flameGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ea580c')
      .attr('stop-opacity', '0');

  }, [stages, componentMap, isLaunching, flightProgress]);

  // =============================================================================
  // Flight Profile Visualization
  // =============================================================================

  useEffect(() => {
    if (!flightSvgRef.current || !launchResult) return;

    const svg = d3.select(flightSvgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(launchResult.flightProfile, d => d.timeSeconds) || 100])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, Math.max(d3.max(launchResult.flightProfile, d => d.altitudeKm) || 100, data.targetAltitudeKm)])
      .range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(-innerHeight).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.1)');

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.1)');

    // Target altitude line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(data.targetAltitudeKm))
      .attr('y2', yScale(data.targetAltitudeKm))
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5 3');

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(data.targetAltitudeKm) - 5)
      .attr('fill', '#10b981')
      .attr('font-size', '10px')
      .attr('text-anchor', 'end')
      .text(`Target: ${data.targetAltitudeKm} km`);

    // Karman line (edge of space)
    if (KARMAN_LINE_KM <= (d3.max(launchResult.flightProfile, d => d.altitudeKm) || 0) * 1.2) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(KARMAN_LINE_KM))
        .attr('y2', yScale(KARMAN_LINE_KM))
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3 3');

      g.append('text')
        .attr('x', 5)
        .attr('y', yScale(KARMAN_LINE_KM) - 5)
        .attr('fill', '#8b5cf6')
        .attr('font-size', '9px')
        .text('Space (100 km)');
    }

    // Flight path line
    const line = d3.line<typeof launchResult.flightProfile[0]>()
      .x(d => xScale(d.timeSeconds))
      .y(d => yScale(d.altitudeKm))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(launchResult.flightProfile)
      .attr('fill', 'none')
      .attr('stroke', launchResult.success ? '#22c55e' : '#ef4444')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Staging events
    launchResult.stagingEvents.forEach((event, i) => {
      g.append('circle')
        .attr('cx', xScale(event.timeSeconds))
        .attr('cy', yScale(event.altitudeKm))
        .attr('r', 5)
        .attr('fill', '#f59e0b');

      g.append('text')
        .attr('x', xScale(event.timeSeconds) + 8)
        .attr('y', yScale(event.altitudeKm) + 4)
        .attr('fill', '#f59e0b')
        .attr('font-size', '9px')
        .text(`Stage ${event.stageDropped} sep`);
    });

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll('text')
      .attr('fill', 'white');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('fill', 'white');

    // Axis labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('text-anchor', 'middle')
      .text('Time (seconds)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', 15)
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('text-anchor', 'middle')
      .text('Altitude (km)');

  }, [launchResult, data.targetAltitudeKm]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 bg-orange-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[150px] opacity-10 bg-blue-500" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Spaceflight:</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-orange-500/20 text-orange-300 border-orange-500/30">
                BUILD & LAUNCH
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-blue-500/20 text-blue-300 border-blue-500/30">
                GRADE {data.gradeLevel}
              </span>
            </div>
            <h3 className="text-3xl font-light text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 leading-relaxed">{data.description}</p>
          </div>

          {/* Mission Objective */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-sm font-medium text-blue-300 uppercase tracking-wide">Mission Objective</div>
                <div className="text-white">
                  {data.targetOrbit
                    ? `Reach orbit at ${LEO_ALTITUDE_KM} km altitude`
                    : `Reach ${data.targetAltitudeKm} km altitude`}
                </div>
              </div>
            </div>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Component Library */}
            <div className="lg:col-span-1 space-y-4">
              <div className="text-sm font-medium text-slate-300 uppercase tracking-wide mb-3">
                Component Library
              </div>

              {Object.entries(componentsByType).map(([type, components]) => (
                <div key={type} className="glass-panel rounded-xl border border-white/10 p-3">
                  <div className="text-xs font-medium text-slate-400 uppercase mb-2 flex items-center gap-2">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: COMPONENT_COLORS[type] }} />
                    {type.replace('_', ' ')}s
                  </div>
                  <div className="space-y-2">
                    {components.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => addComponentToStage(comp.id, stages.length - 1)}
                        disabled={isLaunching || (budgetRemaining !== null && comp.cost && budgetRemaining < comp.cost)}
                        className={`w-full text-left p-2 rounded-lg border transition-all ${
                          selectedComponent === comp.id
                            ? 'border-blue-500 bg-blue-500/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">{comp.name}</span>
                          {comp.cost && (
                            <span className="text-xs text-amber-400">${comp.cost}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {comp.massKg.toLocaleString()} kg
                          {comp.thrustKN && ` • ${comp.thrustKN} kN thrust`}
                          {comp.propellantMassKg && ` • ${comp.propellantMassKg} kg fuel`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Hints */}
              {data.guidedMode && data.hints.length > 0 && (
                <button
                  onClick={nextHint}
                  className="w-full p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm hover:bg-amber-500/20 transition-colors"
                >
                  💡 Need a hint?
                </button>
              )}

              {showHint && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-amber-300 text-sm">{data.hints[currentHint]}</div>
                </div>
              )}
            </div>

            {/* Rocket Builder */}
            <div className="lg:col-span-1">
              <div className="text-sm font-medium text-slate-300 uppercase tracking-wide mb-3">
                Your Rocket
              </div>

              {/* Stage Controls */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={addStage}
                  disabled={stages.length >= data.maxStages || isLaunching}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Stage
                </button>
                <span className="text-xs text-slate-400">
                  {stages.length}/{data.maxStages} stages
                </span>
              </div>

              {/* Rocket SVG */}
              <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                <svg ref={svgRef} width={300} height={400} className="w-full" />
              </div>

              {/* Stats Panel */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-400">Total Mass</div>
                  <div className="text-lg font-light text-white">
                    {rocketStats.totalMassKg.toLocaleString()} kg
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-400">Total Thrust</div>
                  <div className="text-lg font-light text-white">
                    {rocketStats.totalThrustKN.toLocaleString()} kN
                  </div>
                </div>
                {data.showTWR && (
                  <div className={`p-3 rounded-xl border ${
                    rocketStats.canLift
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="text-xs text-slate-400">Thrust/Weight</div>
                    <div className={`text-lg font-light ${rocketStats.canLift ? 'text-green-400' : 'text-red-400'}`}>
                      {rocketStats.thrustToWeight.toFixed(2)}
                      {!rocketStats.canLift && ' ⚠️'}
                    </div>
                  </div>
                )}
                {data.showFuelGauge && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-slate-400">Propellant</div>
                    <div className="text-lg font-light text-white">
                      {rocketStats.totalPropellantKg.toLocaleString()} kg
                    </div>
                  </div>
                )}
                {data.budget && (
                  <div className={`p-3 rounded-xl border col-span-2 ${
                    overBudget
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}>
                    <div className="text-xs text-slate-400">Budget</div>
                    <div className={`text-lg font-light ${overBudget ? 'text-red-400' : 'text-white'}`}>
                      ${rocketStats.totalCost.toLocaleString()} / ${data.budget.toLocaleString()}
                      {overBudget && ' - Over budget!'}
                    </div>
                  </div>
                )}
              </div>

              {/* Launch Button */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleLaunch}
                  disabled={isLaunching || rocketStats.componentCount === 0 || overBudget}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    isLaunching
                      ? 'bg-orange-500/50 text-orange-200 cursor-wait'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-orange-500/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLaunching ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-pulse">🚀</span>
                      Launching... {Math.round(flightProgress * 100)}%
                    </span>
                  ) : (
                    '🚀 Launch!'
                  )}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isLaunching}
                  className="px-4 py-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-1">
              <div className="text-sm font-medium text-slate-300 uppercase tracking-wide mb-3">
                Flight Results
              </div>

              {launchResult ? (
                <div className="space-y-4">
                  {/* Success/Failure Banner */}
                  <div className={`p-4 rounded-xl border ${
                    launchResult.success
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">
                        {launchResult.success ? '🎉' : '💥'}
                      </span>
                      <div>
                        <div className={`text-lg font-medium ${
                          launchResult.success ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {launchResult.success ? 'Mission Success!' : 'Mission Failed'}
                        </div>
                        <div className="text-sm text-slate-300">
                          Max Altitude: {launchResult.maxAltitudeKm.toFixed(1)} km
                        </div>
                      </div>
                    </div>
                    {launchResult.failureReason && (
                      <div className="mt-3 text-sm text-slate-300 bg-black/20 p-2 rounded-lg">
                        {launchResult.failureReason}
                      </div>
                    )}
                  </div>

                  {/* Flight Profile Graph */}
                  <div className="glass-panel rounded-xl border border-white/10 p-3">
                    <div className="text-xs font-medium text-slate-400 uppercase mb-2">
                      Flight Profile
                    </div>
                    <svg ref={flightSvgRef} width={400} height={200} className="w-full" />
                  </div>

                  {/* Flight Statistics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-400">Staging Events</div>
                      <div className="text-lg font-light text-white">
                        {launchResult.stagingEvents.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-400">Orbit Achieved</div>
                      <div className={`text-lg font-light ${launchResult.reachedOrbit ? 'text-green-400' : 'text-slate-400'}`}>
                        {launchResult.reachedOrbit ? 'Yes! 🛰️' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Attempt Counter */}
                  <div className="text-center text-sm text-slate-400">
                    Attempt #{attemptCount}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-xl border border-white/10 p-8 text-center">
                  <div className="text-4xl mb-4">🚀</div>
                  <div className="text-slate-300 mb-2">Build your rocket and launch!</div>
                  <div className="text-sm text-slate-400">
                    Add components from the library, then click Launch to see how high you can go.
                  </div>
                </div>
              )}

              {/* Learning Focus */}
              <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="text-xs font-medium text-purple-300 uppercase mb-2">
                  Learning Focus
                </div>
                <div className="text-sm text-slate-300">
                  {data.learningFocus}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RocketBuilder;
