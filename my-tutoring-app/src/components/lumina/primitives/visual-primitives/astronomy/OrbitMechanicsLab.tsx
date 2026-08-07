'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { OrbitMechanicsLabMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { LuminaReadAloud } from '../../../ui';
import {
  orbitStep,
  calculateOrbitalElements,
  orbitPathPoints,
  initialLaunchState,
  speedChoicesFor,
  CORRECT_SPEED_CHOICE,
  TIME_STEP,
  KARMAN_LINE_KM,
  LEO_ALTITUDE_KM,
  type OrbitState,
  type OrbitCraftConfig,
  type OrbitalElements,
  type SpeedChoiceId,
} from '../../../service/astronomy/orbitPhysics';

// Export data interface - single source of truth
export interface OrbitConfig {
  semiMajorAxis: number;      // km
  eccentricity: number;       // 0 = circular, 0-1 = elliptical
  argumentOfPeriapsis?: number; // Rotation angle of orbit (degrees)
}

export interface OrbitalBody {
  id: string;
  name: string;
  type: 'spacecraft' | 'target' | 'debris';
  color: string;
  orbit?: OrbitConfig;
  position?: { r: number; theta: number }; // Polar coords if not in orbit
  showTrail?: boolean;
}

// Rocket configuration matching RocketBuilder concepts
export interface RocketConfig {
  massKg: number;           // Total rocket mass in kg (from LLM)
  propellantMassKg: number; // Fuel mass in kg (from LLM)
  name?: string;            // Rocket name for display
}

// Thrust options for student selection
export interface ThrustConfig {
  minKN: number;            // Minimum thrust in kN
  maxKN: number;            // Maximum thrust in kN
  defaultKN: number;        // Default starting thrust
  stepKN?: number;          // Step size for slider
}

export interface OrbitMechanicsLabData {
  title: string;
  description: string;
  gradeLevel: 'K' | '1' | '2' | '3' | '4' | '5';

  // Central body configuration
  centralBody: 'earth' | 'moon' | 'mars' | 'sun';
  centralBodyRadius: number;  // Visual radius in pixels

  // Rocket configuration (from LLM - connects to RocketBuilder)
  rocket: RocketConfig;
  thrustOptions: ThrustConfig;

  // Initial orbital setup
  initialOrbit?: OrbitConfig;
  spacecraft?: OrbitalBody;
  targetOrbit?: OrbitConfig;
  targetObject?: OrbitalBody;

  // Display options
  showOrbitPath: boolean;
  showVelocityVector: boolean;
  showApogeePerigee: boolean;
  showOrbitalPeriod: boolean;
  showTWR: boolean;           // Show thrust-to-weight ratio (like RocketBuilder)
  showFuelGauge: boolean;     // Show remaining propellant
  gravityVisualization: 'none' | 'field_lines' | 'well';

  // Interaction options
  allowLaunch: boolean;
  allowBurns: boolean;
  burnMode: 'direction_picker' | 'prograde_retrograde' | 'manual';

  // Challenge configuration
  challenge?: {
    type: 'reach_altitude' | 'circularize' | 'rendezvous' | 'change_orbit' | 'reach_orbit';
    targetAltitude?: number;   // km
    targetOrbit?: OrbitConfig;
    maxBurns?: number;
    description: string;
    successMessage: string;
  };

  // Educational hints
  hints: string[];
  funFact?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OrbitMechanicsLabMetrics>) => void;
}

interface OrbitMechanicsLabProps {
  data: OrbitMechanicsLabData;
  className?: string;
}

/**
 * Build the SVG path for the projected orbit, or `null` when there is nothing
 * closed to draw (on the pad, still burning, crashed, or escaping).
 *
 * Exported because the branch it guards only fires mid-flight, which a render
 * test cannot reach without running the simulation — leaving it inline made it
 * untestable, and an untested `showOrbitPath` is exactly how this flag came to
 * be declared, generated for every grade, and read by nobody.
 */
export const buildOrbitPathD = (
  showOrbitPath: boolean,
  spacecraft: OrbitState | null,
  cfg: OrbitCraftConfig,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
): string | null => {
  if (!showOrbitPath || !spacecraft) return null;
  if (spacecraft.isLaunching || spacecraft.hasCrashed || spacecraft.hasEscaped) return null;

  const points = orbitPathPoints(spacecraft, cfg);
  if (!points) return null;

  return d3.line<{ x: number; y: number }>()
    .x(p => worldToScreen(p.x, p.y).x)
    .y(p => worldToScreen(p.x, p.y).y)
    .curve(d3.curveLinearClosed)(points) || null;
};

// =============================================================================
// Central body data (real values)
// =============================================================================

const CENTRAL_BODY_DATA: Record<string, {
  radiusKm: number;
  massKg: number;
  surfaceGravity: number;
  fill: string;
  glow: string;
  name: string;
}> = {
  earth: { radiusKm: 6371, massKg: 5.972e24, surfaceGravity: 9.81, fill: '#4A90E2', glow: '#4A90E2', name: 'Earth' },
  moon: { radiusKm: 1737, massKg: 7.342e22, surfaceGravity: 1.62, fill: '#A0A0A0', glow: '#C0C0C0', name: 'Moon' },
  mars: { radiusKm: 3390, massKg: 6.417e23, surfaceGravity: 3.71, fill: '#CD5C5C', glow: '#CD5C5C', name: 'Mars' },
  sun: { radiusKm: 696340, massKg: 1.989e30, surfaceGravity: 274, fill: '#FDB813', glow: '#FDB813', name: 'Sun' },
};

/**
 * Time compression for pre-readers. One lap of the "just right" orbit takes
 * ~102 simulated minutes; at the grade 2+ default of 10× that is a 10-minute
 * wait, so "goes around and around" would never be seen. Ascent stays slower so
 * the climb is still watchable, then time opens up once the rocket is coasting.
 */
const PRE_READER_ASCENT_TIME_SCALE = 60;
const PRE_READER_COAST_TIME_SCALE = 300;

interface FlightStats {
  maxAltitudeKm: number;
  currentVelocityKmS: number;
  apogeeKm: number;
  perigeeKm: number;
  eccentricity: number;
  orbitalPeriodMin: number;
  isInOrbit: boolean;
  reachedSpace: boolean;
}

const EMPTY_FLIGHT_STATS: FlightStats = {
  maxAltitudeKm: 0,
  currentVelocityKmS: 0,
  apogeeKm: 0,
  perigeeKm: 0,
  eccentricity: 0,
  orbitalPeriodMin: 0,
  isInOrbit: false,
  reachedSpace: false,
};

const OrbitMechanicsLab: React.FC<OrbitMechanicsLabProps> = ({ data, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Get central body properties
  const centralBodyProps = CENTRAL_BODY_DATA[data.centralBody] || CENTRAL_BODY_DATA.earth;
  const bodyRadiusKm = centralBodyProps.radiusKm;

  /**
   * PRE / EMERGING band gate.
   *
   * At K-1 the launch controls were a thrust slider reading "26 kN" and an
   * angle slider reading "90°", and the only statement of the protocol was
   * 12px text ("Set thrust and angle, then launch!"). Around them sat three
   * permanent stat panels — mass in kg, altitude/velocity in km and m/s, a
   * milestone ledger — none of which a five-year-old can read (PRE contract
   * rules 1, 2, 4 and 7). The interaction underneath is genuinely K-fit, so
   * the fix is to gate the chrome and collapse the two continuous controls
   * into three tappable pictures, NOT to stop routing K here.
   */
  const isPreReader = data.gradeLevel === 'K' || data.gradeLevel === '1';

  // Simulation state
  const [isLaunched, setIsLaunched] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [spacecraft, setSpacecraft] = useState<OrbitState | null>(null);

  // Student controls - thrust (kN) and angle (degrees)
  const [selectedThrustKN, setSelectedThrustKN] = useState(data.thrustOptions?.defaultKN || 500);
  const [launchAngle, setLaunchAngle] = useState(90); // degrees from horizontal (90 = straight up)
  const [timeScale, setTimeScale] = useState(10);
  const [burnCount, setBurnCount] = useState(0);
  const [selectedBurnDirection, setSelectedBurnDirection] = useState<'prograde' | 'retrograde' | 'normal' | 'antinormal'>('prograde');

  // K-1 only: which of the three speed pictures the child tapped.
  const [selectedChoiceId, setSelectedChoiceId] = useState<SpeedChoiceId | null>(null);

  // Flight statistics
  const [flightStats, setFlightStats] = useState<FlightStats>(EMPTY_FLIGHT_STATS);

  // Challenge state
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);
  const [launchAttempts, setLaunchAttempts] = useState(0);

  // Animation frame ref
  const animationRef = useRef<number>();

  // Evaluation integration
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = useMemo(
    () => instanceId || `orbit-mechanics-lab-${Date.now()}`,
    [instanceId],
  );

  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<OrbitMechanicsLabMetrics>({
    primitiveType: 'orbit-mechanics-lab',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // ==========================================================================
  // Physics configuration — one bag, shared by the animation and the tests
  // ==========================================================================

  const craftConfig: OrbitCraftConfig = useMemo(() => ({
    bodyRadiusKm,
    surfaceGravity: centralBodyProps.surfaceGravity,
    thrustKN: selectedThrustKN,
    launchAngle,
    rocketMassKg: data.rocket?.massKg || 1000,
    propellantMassKg: data.rocket?.propellantMassKg || 500,
  }), [bodyRadiusKm, centralBodyProps.surfaceGravity, selectedThrustKN, launchAngle, data.rocket]);

  /**
   * The three speed pictures. Derived from the rocket's own mass via
   * thrust-to-weight, so whatever thrust range Gemini emitted still yields one
   * too-slow, one orbiting and one runaway option.
   */
  const speedChoices = useMemo(
    () => speedChoicesFor(data.rocket?.massKg || 1000, centralBodyProps.surfaceGravity),
    [data.rocket?.massKg, centralBodyProps.surfaceGravity],
  );

  // Calculate TWR (Thrust-to-Weight Ratio)
  const thrustToWeight = useMemo(() => {
    const rocketMass = data.rocket?.massKg || 1000;
    const weightN = rocketMass * centralBodyProps.surfaceGravity;
    const thrustN = selectedThrustKN * 1000;
    return thrustN / weightN;
  }, [data.rocket?.massKg, selectedThrustKN, centralBodyProps.surfaceGravity]);

  const canLift = thrustToWeight > 1;

  // Scale for visualization (km to pixels)
  const visualScale = useMemo(() => {
    // Scale so Earth fits nicely with room for orbit
    const targetVisualRadius = Math.min(dimensions.width, dimensions.height) * 0.2;
    return targetVisualRadius / bodyRadiusKm;
  }, [dimensions, bodyRadiusKm]);

  // Center of the visualization
  const center = useMemo(() => ({
    x: dimensions.width / 2,
    y: dimensions.height / 2,
  }), [dimensions]);

  const worldToScreen = useCallback(
    (x: number, y: number) => ({ x: center.x + x * visualScale, y: center.y - y * visualScale }),
    [center, visualScale],
  );

  // ==========================================================================
  // AI tutoring — the only channel a non-reader has
  // ==========================================================================

  /** What the child can SEE the rocket doing, in words the tutor may repeat. */
  const flightState = useMemo(() => {
    if (!isLaunched || !spacecraft) return 'still on the launch pad';
    if (spacecraft.hasCrashed) return 'back down on the ground';
    if (spacecraft.hasEscaped) return 'gone so far away it left the screen';
    if (spacecraft.isLaunching) return 'flying up away from the ground';
    if (flightStats.isInOrbit) return 'going around and around';
    return 'coasting through space';
  }, [isLaunched, spacecraft, flightStats.isInOrbit]);

  const chosenSpeedLabel = useMemo(() => {
    if (!selectedChoiceId) return 'nothing yet';
    return speedChoices.find((c) => c.id === selectedChoiceId)?.label ?? 'nothing yet';
  }, [selectedChoiceId, speedChoices]);

  // Flat object literal on purpose: assembled behind local statements,
  // `tutor-test` reports every contextKey as "dynamic — verify at runtime",
  // which turns a real check into a shrug.
  const aiPrimitiveData = useMemo(() => ({
    title: data.title,
    gradeLevel: data.gradeLevel ?? 'unspecified',
    centralBodyName: centralBodyProps.name,
    speedChoiceNames: speedChoices.map((c) => c.label).join(', '),
    chosenSpeed: chosenSpeedLabel,
    flightState,
    attemptCount: launchAttempts,
    challengeText: data.challenge?.description ?? 'just explore and watch',
    funFact: data.funFact ?? '',
  }), [
    data.title, data.gradeLevel, data.challenge?.description, data.funFact,
    centralBodyProps.name, speedChoices, chosenSpeedLabel, flightState, launchAttempts,
  ]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'orbit-mechanics-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: data.gradeLevel,
  });

  // `silent` suppresses only the chat-transcript entry; the socket payload is
  // unchanged, so the tutor still speaks. A non-silent post would read as if
  // the child had typed the machine prompt.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[ORBIT_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT — fires once so a non-reader learns the task without asking.
  const hasOrientedRef = useRef(false);
  useEffect(() => {
    if (hasOrientedRef.current) return;
    hasOrientedRef.current = true;
    sendText(
      `[ORBIT_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a rocket lab. They are flying a rocket around ${centralBodyProps.name}. `
      + `${isPreReader
        ? 'They choose how fast it goes by tapping ONE of three pictures — a turtle, a rocket and a lightning bolt — and it launches. '
          + 'Tell them what to do in child words, warmly. Never tell them which picture to pick, and never speak a number or a measurement.'
        : 'They set thrust and launch angle, then launch. Tell them what to do.'}`,
      { silent: true },
    );
  }, [sendText, isPreReader, centralBodyProps.name]);

  // FEEDBACK — one beat per settled flight, so the child hears what happened.
  const lastReportedFlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isLaunched || !spacecraft || spacecraft.isLaunching) return;
    const settled = spacecraft.hasCrashed || spacecraft.hasEscaped || flightStats.isInOrbit;
    if (!settled) return;

    const key = `${launchAttempts}:${flightState}`;
    if (lastReportedFlightRef.current === key) return;
    lastReportedFlightRef.current = key;

    sendText(
      `[ORBIT_FLIGHT_RESULT] The rocket is now ${flightState}. `
      + `Say in ONE short sentence what it did, using only what they can see. `
      + `Do not say which speed was right and do not rule any of the choices out. `
      + `Invite them to try another picture.`,
      { silent: true },
    );
  }, [isLaunched, spacecraft, flightStats.isInOrbit, flightState, launchAttempts, sendText]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Check challenge completion
  const checkChallengeCompletion = useCallback((state: OrbitState, orbital: OrbitalElements) => {
    if (!data.challenge) return;

    const { type, targetAltitude } = data.challenge;

    switch (type) {
      case 'reach_altitude':
        if (targetAltitude && state.altitudeKm >= targetAltitude) {
          setChallengeComplete(true);
        }
        break;
      case 'reach_orbit':
        if (orbital.isInOrbit && state.altitudeKm >= LEO_ALTITUDE_KM) {
          setChallengeComplete(true);
        }
        break;
      case 'circularize':
        if (orbital.eccentricity < 0.1 && orbital.isInOrbit) {
          setChallengeComplete(true);
        }
        break;
      case 'change_orbit':
        // Check if reached target orbit parameters
        break;
    }
  }, [data.challenge]);

  /**
   * Time compression actually applied. Pre-readers never see the speed slider,
   * so the value is chosen for them and changes once the rocket stops burning.
   */
  const effectiveTimeScale = isPreReader
    ? (spacecraft?.isLaunching ? PRE_READER_ASCENT_TIME_SCALE : PRE_READER_COAST_TIME_SCALE)
    : timeScale;

  // Animation loop
  useEffect(() => {
    if (!isLaunched || isPaused || !spacecraft) return;
    if (spacecraft.hasCrashed || spacecraft.hasEscaped) return;

    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaMs = currentTime - lastTime;
      lastTime = currentTime;

      // Apply time scaling
      const dt = (deltaMs / 1000) * effectiveTimeScale;

      setSpacecraft(prev => {
        if (!prev || prev.hasCrashed || prev.hasEscaped) return prev;

        // Run multiple small steps for stability
        let newState = prev;
        const steps = Math.max(1, Math.floor(dt / TIME_STEP));
        const stepDt = dt / steps;

        for (let i = 0; i < steps; i++) {
          newState = orbitStep(newState, stepDt, newState.isLaunching, craftConfig);
        }

        // Update flight stats
        const orbital = calculateOrbitalElements(newState, craftConfig);
        setFlightStats(stats => ({
          maxAltitudeKm: Math.max(stats.maxAltitudeKm, newState.altitudeKm),
          currentVelocityKmS: orbital.velocity,
          apogeeKm: orbital.apogee,
          perigeeKm: orbital.perigee,
          eccentricity: orbital.eccentricity,
          orbitalPeriodMin: orbital.period,
          isInOrbit: orbital.isInOrbit,
          reachedSpace: newState.altitudeKm >= KARMAN_LINE_KM || stats.reachedSpace,
        }));

        // Check challenge completion
        if (data.challenge && !challengeComplete) {
          checkChallengeCompletion(newState, orbital);
        }

        return newState;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLaunched, isPaused, effectiveTimeScale, craftConfig, data.challenge, challengeComplete, checkChallengeCompletion]);

  // Start a flight. No TWR guard — a rocket that cannot lift is a legitimate
  // outcome at K-1, where "too slow" is one of the three choices and the child
  // must SEE it fall rather than meet a disabled button reading
  // "Need More Thrust!" (undecodable, and a dead end).
  const startFlight = useCallback(() => {
    SoundManager.pop();

    const nextState = initialLaunchState(craftConfig);
    setSpacecraft(nextState);

    setIsLaunched(true);
    setIsPaused(false);
    setBurnCount(0);
    setChallengeComplete(false);
    setLaunchAttempts(prev => prev + 1);
    setFlightStats(EMPTY_FLIGHT_STATS);
  }, [craftConfig]);

  // Launch spacecraft (grade 2+ path — keeps the thrust-to-weight gate)
  const handleLaunch = useCallback(() => {
    if (!data.allowLaunch || !canLift) {
      SoundManager.invalid();
      return;
    }
    startFlight();
  }, [data.allowLaunch, canLift, startFlight]);

  /**
   * K-1 path: one tap chooses the speed AND flies it. Tap = choose (PRE rule 2)
   * — there is no separate Launch step to discover.
   */
  const handleSpeedChoice = useCallback((choiceId: SpeedChoiceId) => {
    const choice = speedChoices.find((c) => c.id === choiceId);
    if (!choice || !data.allowLaunch) return;

    setSelectedThrustKN(choice.thrustKN);
    setLaunchAngle(choice.launchAngle);
    setSelectedChoiceId(choiceId);

    // Fly with THIS choice's numbers rather than waiting a render for state.
    SoundManager.pop();
    setSpacecraft(initialLaunchState({
      ...craftConfig,
      thrustKN: choice.thrustKN,
      launchAngle: choice.launchAngle,
    }));
    setIsLaunched(true);
    setIsPaused(false);
    setBurnCount(0);
    setChallengeComplete(false);
    setLaunchAttempts(prev => prev + 1);
    setFlightStats(EMPTY_FLIGHT_STATS);
  }, [speedChoices, data.allowLaunch, craftConfig]);

  // Apply orbital burn
  const handleBurn = useCallback(() => {
    if (!data.allowBurns || !spacecraft || isPaused || spacecraft.isLaunching) return;
    SoundManager.tap();

    setSpacecraft(prev => {
      if (!prev) return prev;

      const { vx, vy } = prev;
      const v = Math.sqrt(vx * vx + vy * vy);
      if (v === 0) return prev;

      // Direction unit vectors
      const progradex = vx / v;
      const progradey = vy / v;
      const normalx = -progradey;
      const normaly = progradex;

      const dv = 0.1; // km/s delta-v per burn

      let dvx = 0;
      let dvy = 0;

      switch (selectedBurnDirection) {
        case 'prograde':
          dvx = progradex * dv;
          dvy = progradey * dv;
          break;
        case 'retrograde':
          dvx = -progradex * dv;
          dvy = -progradey * dv;
          break;
        case 'normal':
          dvx = normalx * dv;
          dvy = normaly * dv;
          break;
        case 'antinormal':
          dvx = -normalx * dv;
          dvy = -normaly * dv;
          break;
      }

      return {
        ...prev,
        vx: vx + dvx,
        vy: vy + dvy,
      };
    });

    setBurnCount(prev => prev + 1);
  }, [data.allowBurns, spacecraft, isPaused, selectedBurnDirection]);

  // Reset simulation
  const handleReset = useCallback(() => {
    setIsLaunched(false);
    setIsPaused(true);
    setSpacecraft(null);
    setBurnCount(0);
    setChallengeComplete(false);
    setSelectedChoiceId(null);
    resetAttempt();
    setFlightStats(EMPTY_FLIGHT_STATS);
  }, [resetAttempt]);

  // Calculate score
  const calculateScore = useCallback(() => {
    if (isPreReader) {
      // Fewer tries to find the speed that orbits = stronger evidence.
      if (launchAttempts <= 1) return 100;
      if (launchAttempts === 2) return 85;
      if (launchAttempts === 3) return 70;
      return 60;
    }

    if (!data.challenge) return 100;

    if (challengeComplete) {
      const burnBonus = data.challenge.maxBurns
        ? Math.max(0, (data.challenge.maxBurns - burnCount) * 10)
        : 0;
      return Math.min(100, 80 + burnBonus);
    }

    if (flightStats.isInOrbit) return 60;
    if (flightStats.reachedSpace) return 40;
    return 20;
  }, [isPreReader, launchAttempts, data.challenge, challengeComplete, burnCount, flightStats]);

  const buildMetrics = useCallback((success: boolean): OrbitMechanicsLabMetrics => ({
    type: 'orbit-mechanics-lab',
    challengeType: data.challenge?.type || 'free_exploration',
    challengeCompleted: success,
    launchAttempts,
    burnsPerformed: burnCount,
    maxBurnsAllowed: data.challenge?.maxBurns,
    finalOrbitEccentricity: flightStats.eccentricity,
    finalOrbitApogee: flightStats.apogeeKm,
    finalOrbitPerigee: flightStats.perigeeKm,
    achievedStableOrbit: flightStats.isInOrbit,
    totalMassKg: data.rocket?.massKg,
    totalThrustKN: selectedThrustKN,
    thrustToWeightRatio: thrustToWeight,
    propellantUsedKg: (data.rocket?.propellantMassKg || 0) - (spacecraft?.propellantKg || 0),
    targetAltitudeReached: data.challenge?.targetAltitude
      ? flightStats.maxAltitudeKm >= data.challenge.targetAltitude
      : undefined,
    reachedOrbit: flightStats.isInOrbit,
  }), [data.challenge, data.rocket, launchAttempts, burnCount, flightStats, selectedThrustKN, thrustToWeight, spacecraft]);

  // Submit evaluation (grade 2+ — explicit button on challenge completion)
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmitted || !isLaunched) return;

    const success = challengeComplete || !data.challenge;
    submitResult(success, calculateScore(), buildMetrics(success), {
      studentWork: {
        selectedThrustKN,
        launchAngle,
        burnCount,
        finalStats: flightStats,
      },
    });
  }, [
    hasSubmitted, isLaunched, challengeComplete, data.challenge, submitResult,
    calculateScore, buildMetrics, selectedThrustKN, launchAngle, burnCount, flightStats,
  ]);

  /**
   * K-1 assessment hides in the mechanics (PRE rule 8): there is no Submit
   * button and no quiz. Finding the one speed that keeps the rocket going
   * around IS the measurement, and it submits itself the first time it happens.
   */
  const preReaderSucceeded = isPreReader
    && flightStats.isInOrbit
    && selectedChoiceId === CORRECT_SPEED_CHOICE;

  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!isPreReader || hasSubmitted || hasAutoSubmittedRef.current) return;
    if (!preReaderSucceeded) return;
    hasAutoSubmittedRef.current = true;

    submitResult(true, calculateScore(), buildMetrics(true), {
      studentWork: {
        selectedThrustKN,
        launchAngle,
        chosenSpeed: selectedChoiceId,
        attempts: launchAttempts,
      },
    });
  }, [
    isPreReader, hasSubmitted, preReaderSucceeded, submitResult, calculateScore,
    buildMetrics, selectedThrustKN, launchAngle, selectedChoiceId, launchAttempts,
  ]);

  // Get grade-appropriate labels
  const getGradeLabel = useCallback((concept: string) => {
    const labels: Record<string, Record<string, string>> = {
      apogee: {
        K: 'Highest Point', '1': 'Highest Point', '2': 'Highest Point',
        '3': 'Apogee (High)', '4': 'Apogee', '5': 'Apogee',
      },
      perigee: {
        K: 'Lowest Point', '1': 'Lowest Point', '2': 'Lowest Point',
        '3': 'Perigee (Low)', '4': 'Perigee', '5': 'Perigee',
      },
      eccentricity: {
        K: 'Shape', '1': 'Shape', '2': 'Orbit Shape',
        '3': 'Orbit Shape', '4': 'Eccentricity', '5': 'Eccentricity',
      },
    };
    return labels[concept]?.[data.gradeLevel] || concept;
  }, [data.gradeLevel]);

  // Render atmosphere gradient
  const renderAtmosphere = useCallback(() => {
    const atmosphereHeight = bodyRadiusKm * 0.015; // Thin atmosphere band
    const visualAtmosphere = atmosphereHeight * visualScale;
    const visualBodyRadius = bodyRadiusKm * visualScale;

    return (
      <g className="atmosphere">
        {/* Atmosphere glow */}
        <circle
          cx={center.x}
          cy={center.y}
          r={visualBodyRadius + visualAtmosphere}
          fill="none"
          stroke="rgba(135, 206, 235, 0.3)"
          strokeWidth={visualAtmosphere}
        />
        {/* Karman line indicator */}
        <circle
          cx={center.x}
          cy={center.y}
          r={(bodyRadiusKm + KARMAN_LINE_KM) * visualScale}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </g>
    );
  }, [bodyRadiusKm, visualScale, center]);

  // Render target altitude circle
  const renderTargetAltitude = useCallback(() => {
    if (!data.challenge?.targetAltitude) return null;

    const targetRadius = (bodyRadiusKm + data.challenge.targetAltitude) * visualScale;

    return (
      <circle
        cx={center.x}
        cy={center.y}
        r={targetRadius}
        fill="none"
        stroke="rgba(34, 197, 94, 0.4)"
        strokeWidth={2}
        strokeDasharray="8 4"
      />
    );
  }, [data.challenge?.targetAltitude, bodyRadiusKm, visualScale, center]);

  /**
   * Projected orbit path.
   *
   * `showOrbitPath` was declared on the data interface and set by the generator
   * for every grade, but nothing ever read it — so the catalog's Kindergarten
   * rung ("showOrbitPath only") described a feature that did not exist. It
   * matters most at K: drawing the closed loop is what makes "goes around and
   * around" legible in the first second, instead of after a full lap.
   */
  const orbitPath = useMemo(
    () => buildOrbitPathD(data.showOrbitPath, spacecraft, craftConfig, worldToScreen),
    [data.showOrbitPath, spacecraft, craftConfig, worldToScreen],
  );

  // Render velocity vector
  const renderVelocityVector = useCallback(() => {
    if (!data.showVelocityVector || !spacecraft) return null;

    const { x, y, vx, vy } = spacecraft;
    const screen = worldToScreen(x, y);

    const velocityScale = 50; // Visual scale for velocity vector
    const endX = screen.x + vx * velocityScale;
    const endY = screen.y - vy * velocityScale;

    return (
      <g className="velocity-vector">
        <line
          x1={screen.x}
          y1={screen.y}
          x2={endX}
          y2={endY}
          stroke="#22c55e"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
      </g>
    );
  }, [data.showVelocityVector, spacecraft, worldToScreen]);

  const visualBodyRadius = bodyRadiusKm * visualScale;

  /** Everything a non-reader would otherwise have to read, in one spoken line. */
  const spokenBriefing = useMemo(
    () => [data.title, data.description, data.challenge?.description]
      .filter(Boolean)
      .join('. '),
    [data.title, data.description, data.challenge?.description],
  );

  return (
    <div className={`w-full ${className}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 bg-purple-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 bg-blue-500" />

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-6">
            {/* Mono domain badge is developer chrome — gone for a non-reader. */}
            {!isPreReader && (
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Astronomy:</span>
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border bg-purple-500/20 text-purple-300 border-purple-500/30">
                  ORBIT LAB
                </span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className={`font-light text-white mb-2 ${isPreReader ? 'text-4xl' : 'text-3xl'}`}>{data.title}</h3>
                <p className="text-slate-300 leading-relaxed">{data.description}</p>
              </div>
              {isPreReader && (
                <LuminaReadAloud
                  iconOnly
                  size="lg"
                  accent="cyan"
                  speaking={isAudioPlaying}
                  aria-label="Read this to me"
                  className="flex-shrink-0"
                  onClick={() => readAloud(spokenBriefing)}
                />
              )}
            </div>
          </div>

          {/* Challenge Banner */}
          {data.challenge && (
            <div className={`mb-4 p-4 rounded-xl border ${
              challengeComplete
                ? 'bg-green-500/20 border-green-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  {!isPreReader && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">
                      {challengeComplete ? 'Challenge Complete!' : 'Challenge'}
                    </div>
                  )}
                  <p className={`${challengeComplete ? 'text-green-300' : 'text-white'} font-medium`}>
                    {challengeComplete ? data.challenge.successMessage : data.challenge.description}
                  </p>
                </div>
                {/* No read-aloud button here: at K-1 the goal is folded into the
                    header briefing, so the child meets ONE "read it to me" tap
                    rather than two competing ones (PRE rule 4). */}
                {/* Explicit submit is a grade 2+ act; K-1 submits from the mechanics. */}
                {!isPreReader && challengeComplete && !hasSubmitted && (
                  <button
                    onClick={handleSubmitEvaluation}
                    className="px-4 py-2 bg-green-500/30 hover:bg-green-500/40 border border-green-400/30 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Submit Result
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Main Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Simulation Canvas */}
            <div className={isPreReader ? 'lg:col-span-4' : 'lg:col-span-3'}>
              <div
                ref={containerRef}
                className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950"
                style={{ height: isPreReader ? '560px' : '500px' }}
              >
                <svg
                  ref={svgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  className="absolute top-0 left-0"
                >
                  <defs>
                    <radialGradient id="centralBodyGlow">
                      <stop offset="0%" stopColor={centralBodyProps.glow} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={centralBodyProps.glow} stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="earthGradient" cx="30%" cy="30%">
                      <stop offset="0%" stopColor="#6fa8dc" />
                      <stop offset="50%" stopColor="#4A90E2" />
                      <stop offset="100%" stopColor="#2d5a87" />
                    </radialGradient>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
                    </marker>
                  </defs>

                  {/* Background stars */}
                  <g className="stars">
                    {Array.from({ length: 150 }).map((_, i) => (
                      <circle
                        key={i}
                        cx={(Math.sin(i * 127.1) * 0.5 + 0.5) * dimensions.width}
                        cy={(Math.cos(i * 311.7) * 0.5 + 0.5) * dimensions.height}
                        r={Math.abs(Math.sin(i * 73.1)) * 1.5 + 0.3}
                        fill="white"
                        opacity={Math.abs(Math.sin(i * 47.3)) * 0.5 + 0.2}
                      />
                    ))}
                  </g>

                  {/* Atmosphere */}
                  {renderAtmosphere()}

                  {/* Target altitude */}
                  {renderTargetAltitude()}

                  {/* Central body glow */}
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={visualBodyRadius * 1.8}
                    fill="url(#centralBodyGlow)"
                  />

                  {/* Central body (Earth) */}
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={visualBodyRadius}
                    fill={data.centralBody === 'earth' ? 'url(#earthGradient)' : centralBodyProps.fill}
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth={1}
                  />

                  {/* Surface details for Earth */}
                  {data.centralBody === 'earth' && (
                    <g className="earth-details">
                      {/* Simplified continents */}
                      <ellipse
                        cx={center.x - visualBodyRadius * 0.2}
                        cy={center.y - visualBodyRadius * 0.1}
                        rx={visualBodyRadius * 0.3}
                        ry={visualBodyRadius * 0.2}
                        fill="rgba(76, 175, 80, 0.4)"
                      />
                      <ellipse
                        cx={center.x + visualBodyRadius * 0.3}
                        cy={center.y + visualBodyRadius * 0.2}
                        rx={visualBodyRadius * 0.25}
                        ry={visualBodyRadius * 0.15}
                        fill="rgba(76, 175, 80, 0.4)"
                      />
                    </g>
                  )}

                  {/* Projected orbit path — the loop, drawn before it is flown */}
                  {orbitPath && (
                    <path
                      d={orbitPath}
                      fill="none"
                      stroke="rgba(147, 197, 253, 0.45)"
                      strokeWidth={isPreReader ? 3 : 1.5}
                      strokeDasharray={isPreReader ? undefined : '6 4'}
                    />
                  )}

                  {/* Launch pad indicator (when not launched) */}
                  {!isLaunched && (
                    <g className="launch-pad">
                      <rect
                        x={center.x - 8}
                        y={center.y - visualBodyRadius - 15}
                        width={16}
                        height={15}
                        fill="#4a5568"
                        rx={2}
                      />
                      <rect
                        x={center.x - 4}
                        y={center.y - visualBodyRadius - 25}
                        width={8}
                        height={12}
                        fill="#64b5f6"
                        rx={1}
                      />
                      {/* Rocket icon */}
                      <polygon
                        points={`${center.x},${center.y - visualBodyRadius - 30} ${center.x - 4},${center.y - visualBodyRadius - 25} ${center.x + 4},${center.y - visualBodyRadius - 25}`}
                        fill="#e74c3c"
                      />
                    </g>
                  )}

                  {/* Central body label — a word, so it is a caption not a control */}
                  {!isPreReader && (
                    <text
                      x={center.x}
                      y={center.y + visualBodyRadius + 25}
                      textAnchor="middle"
                      fill="white"
                      fontSize={14}
                      className="font-medium"
                    >
                      {centralBodyProps.name}
                    </text>
                  )}

                  {/* Spacecraft trail */}
                  {spacecraft && spacecraft.trail.length > 1 && (
                    <path
                      d={d3.line<{ x: number; y: number }>()
                        .x(d => worldToScreen(d.x, d.y).x)
                        .y(d => worldToScreen(d.x, d.y).y)
                        .curve(d3.curveBasis)(spacecraft.trail) || ''}
                      fill="none"
                      stroke="rgba(100, 200, 255, 0.6)"
                      strokeWidth={2}
                    />
                  )}

                  {/* Spacecraft */}
                  {spacecraft && !spacecraft.hasCrashed && (
                    <g transform={`translate(${worldToScreen(spacecraft.x, spacecraft.y).x}, ${worldToScreen(spacecraft.x, spacecraft.y).y})`}>
                      {/* Thrust flame (when launching) */}
                      {spacecraft.isLaunching && spacecraft.propellantKg > 0 && (
                        <g transform={`rotate(${-launchAngle - 90})`}>
                          <ellipse
                            cx={0}
                            cy={15 + Math.random() * 5}
                            rx={4}
                            ry={12 + Math.random() * 8}
                            fill="url(#flameGradient)"
                          />
                        </g>
                      )}
                      {/* Spacecraft glow */}
                      <circle r={isPreReader ? 14 : 10} fill="rgba(100, 200, 255, 0.3)" />
                      {/* Spacecraft body */}
                      <polygon
                        points={isPreReader ? '0,-12 8,9 -8,9' : '0,-8 5,6 -5,6'}
                        fill="#64b5f6"
                        stroke="white"
                        strokeWidth={1}
                        transform={spacecraft.vx !== 0 || spacecraft.vy !== 0
                          ? `rotate(${Math.atan2(-spacecraft.vx, spacecraft.vy) * 180 / Math.PI})`
                          : `rotate(${-launchAngle + 90})`
                        }
                      />
                    </g>
                  )}

                  {/* Crashed indicator — a word at grade 2+, a picture below it */}
                  {spacecraft?.hasCrashed && (
                    isPreReader ? (
                      <text
                        x={center.x}
                        y={center.y - visualBodyRadius - 24}
                        textAnchor="middle"
                        fontSize={52}
                        aria-label="The rocket came back down"
                      >
                        💥
                      </text>
                    ) : (
                      <text
                        x={center.x}
                        y={center.y - visualBodyRadius - 40}
                        textAnchor="middle"
                        fill="#ef4444"
                        fontSize={16}
                        className="font-bold"
                      >
                        CRASHED!
                      </text>
                    )
                  )}

                  {/* Velocity vector */}
                  {renderVelocityVector()}

                  {/* Flame gradient definition */}
                  <defs>
                    <radialGradient id="flameGradient" cx="50%" cy="0%" r="100%">
                      <stop offset="0%" stopColor="#fff7ed" />
                      <stop offset="30%" stopColor="#fdba74" />
                      <stop offset="70%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </svg>

                {/* ---------------------------------------------------------- */}
                {/* K-1: three pictures. One tap chooses the speed AND flies.  */}
                {/* ---------------------------------------------------------- */}
                {isPreReader && !isLaunched && data.allowLaunch && (
                  <div className="absolute inset-x-0 bottom-6 flex justify-center gap-4 px-4">
                    {speedChoices.map(choice => (
                      <button
                        key={choice.id}
                        onClick={() => handleSpeedChoice(choice.id)}
                        aria-label={choice.label}
                        className="flex flex-col items-center justify-center w-28 h-28 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/25 backdrop-blur-md transition-all"
                      >
                        <span className="text-5xl leading-none" aria-hidden="true">{choice.emoji}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* K-1: after a flight, one way back — no play/pause, no speed slider */}
                {isPreReader && isLaunched && (
                  <div className="absolute inset-x-0 bottom-6 flex justify-center">
                    <button
                      onClick={handleReset}
                      aria-label="Try again"
                      className="flex items-center justify-center w-24 h-24 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/25 backdrop-blur-md transition-all"
                    >
                      <span className="text-5xl leading-none" aria-hidden="true">↺</span>
                    </button>
                  </div>
                )}

                {/* Launch controls (grade 2+, when not launched) */}
                {!isPreReader && !isLaunched && data.allowLaunch && (
                  <div className="absolute bottom-4 left-4 glass-panel backdrop-blur-md rounded-xl border border-white/20 p-4 w-64">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-3">Launch Settings</div>

                    {/* Thrust selector */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-300 mb-1 block">
                        Thrust: {selectedThrustKN.toLocaleString()} kN
                      </label>
                      <input
                        type="range"
                        min={data.thrustOptions?.minKN || 100}
                        max={data.thrustOptions?.maxKN || 1000}
                        step={data.thrustOptions?.stepKN || 50}
                        value={selectedThrustKN}
                        onChange={(e) => setSelectedThrustKN(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Angle selector */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-300 mb-1 block">
                        Launch Angle: {launchAngle}°
                      </label>
                      <input
                        type="range"
                        min={45}
                        max={90}
                        value={launchAngle}
                        onChange={(e) => setLaunchAngle(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* TWR indicator */}
                    {data.showTWR && (
                      <div className={`mb-3 p-2 rounded-lg ${canLift ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        <div className="text-xs text-slate-400">Thrust/Weight</div>
                        <div className={`text-lg font-mono ${canLift ? 'text-green-400' : 'text-red-400'}`}>
                          {thrustToWeight.toFixed(2)}
                          {!canLift && ' (Need > 1.0)'}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleLaunch}
                      disabled={!canLift}
                      className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                        canLift
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {canLift ? '🚀 Launch!' : 'Need More Thrust!'}
                    </button>
                  </div>
                )}

                {/* Flight controls (grade 2+, when launched) */}
                {!isPreReader && isLaunched && (
                  <div className="absolute bottom-4 left-4 glass-panel backdrop-blur-md rounded-xl border border-white/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="px-3 py-1.5 bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 text-white rounded-lg text-sm transition-all"
                      >
                        {isPaused ? '▶ Play' : '⏸ Pause'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-3 py-1.5 bg-slate-500/30 hover:bg-slate-500/40 border border-slate-400/30 text-white rounded-lg text-sm transition-all"
                      >
                        ↺ Reset
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-mono">Speed:</span>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={timeScale}
                        onChange={(e) => setTimeScale(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="font-mono">{timeScale}x</span>
                    </div>

                    {/* Burn controls */}
                    {data.allowBurns && !spacecraft?.isLaunching && (
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-2">
                          Burns: {burnCount}{data.challenge?.maxBurns ? ` / ${data.challenge.maxBurns}` : ''}
                        </div>
                        {data.burnMode === 'prograde_retrograde' && (
                          <div className="flex gap-1 mb-2">
                            {(['prograde', 'retrograde'] as const).map(dir => (
                              <button
                                key={dir}
                                onClick={() => { SoundManager.select(); setSelectedBurnDirection(dir); }}
                                className={`px-2 py-1 rounded text-xs transition-all ${
                                  selectedBurnDirection === dir
                                    ? 'bg-green-500/40 border-green-400/50 text-green-300'
                                    : 'bg-white/5 border-white/10 text-slate-400'
                                } border`}
                              >
                                {dir === 'prograde' ? '→ Speed Up' : '← Slow Down'}
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={handleBurn}
                          disabled={isPaused || (data.challenge?.maxBurns !== undefined && burnCount >= data.challenge.maxBurns)}
                          className="w-full px-3 py-2 bg-orange-500/30 hover:bg-orange-500/40 disabled:bg-slate-500/20 disabled:text-slate-500 border border-orange-400/30 text-white rounded-lg text-sm font-medium transition-all"
                        >
                          🔥 Burn!
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Status indicator — a sentence of protocol text, gone at K-1 */}
                {!isPreReader && (
                  <div className="absolute top-4 right-4 glass-panel backdrop-blur-md px-3 py-2 rounded-lg border border-white/20 text-xs text-slate-300">
                    {!isLaunched ? 'Set thrust and angle, then launch!' :
                     spacecraft?.isLaunching ? '🚀 Ascending...' :
                     spacecraft?.hasCrashed ? '💥 Crashed!' :
                     flightStats.isInOrbit ? '🛰️ In Orbit!' :
                     flightStats.reachedSpace ? '✨ In Space!' :
                     'Flying...'}
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Info Panel — mass in kg, altitude in km, a milestone ledger.   */}
            {/* All of it is adult chrome, so none of it exists at K-1.        */}
            {/* ------------------------------------------------------------- */}
            {!isPreReader && (
              <div className="space-y-4">
                {/* Rocket Stats (like RocketBuilder) */}
                <div className="glass-panel rounded-xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-3">
                    {data.rocket?.name || 'Rocket'} Stats
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-xs text-slate-400">Mass</div>
                      <div className="text-sm font-mono text-white">
                        {(data.rocket?.massKg || 0).toLocaleString()} kg
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <div className="text-xs text-slate-400">Thrust</div>
                      <div className="text-sm font-mono text-white">
                        {selectedThrustKN.toLocaleString()} kN
                      </div>
                    </div>
                    {data.showTWR && (
                      <div className={`p-2 rounded-lg ${canLift ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <div className="text-xs text-slate-400">TWR</div>
                        <div className={`text-sm font-mono ${canLift ? 'text-green-400' : 'text-red-400'}`}>
                          {thrustToWeight.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {data.showFuelGauge && (
                      <div className="p-2 rounded-lg bg-white/5">
                        <div className="text-xs text-slate-400">Fuel</div>
                        <div className="text-sm font-mono text-white">
                          {spacecraft
                            ? `${spacecraft.propellantKg.toFixed(0)} kg`
                            : `${(data.rocket?.propellantMassKg || 0).toLocaleString()} kg`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flight Data */}
                <div className="glass-panel rounded-xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-3">Flight Data</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Altitude</span>
                      <span className="text-white font-mono">
                        {spacecraft ? `${spacecraft.altitudeKm.toFixed(1)} km` : '0 km'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Max Altitude</span>
                      <span className="text-white font-mono">{flightStats.maxAltitudeKm.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Velocity</span>
                      <span className="text-white font-mono">{(flightStats.currentVelocityKmS * 1000).toFixed(0)} m/s</span>
                    </div>
                    {data.showApogeePerigee && flightStats.isInOrbit && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">{getGradeLabel('apogee')}</span>
                          <span className="text-white font-mono">{flightStats.apogeeKm.toFixed(0)} km</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">{getGradeLabel('perigee')}</span>
                          <span className="text-white font-mono">{flightStats.perigeeKm.toFixed(0)} km</span>
                        </div>
                      </>
                    )}
                    {data.showOrbitalPeriod && flightStats.orbitalPeriodMin < Infinity && flightStats.isInOrbit && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Orbit Time</span>
                        <span className="text-white font-mono">{flightStats.orbitalPeriodMin.toFixed(0)} min</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status indicators */}
                <div className="glass-panel rounded-xl border border-white/10 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-3">Milestones</div>
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-sm ${flightStats.reachedSpace ? 'text-green-400' : 'text-slate-500'}`}>
                      {flightStats.reachedSpace ? '✓' : '○'} Reached Space ({KARMAN_LINE_KM} km)
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${flightStats.isInOrbit ? 'text-green-400' : 'text-slate-500'}`}>
                      {flightStats.isInOrbit ? '✓' : '○'} Stable Orbit
                    </div>
                    {data.challenge?.targetAltitude && (
                      <div className={`flex items-center gap-2 text-sm ${flightStats.maxAltitudeKm >= data.challenge.targetAltitude ? 'text-green-400' : 'text-slate-500'}`}>
                        {flightStats.maxAltitudeKm >= data.challenge.targetAltitude ? '✓' : '○'} Target: {data.challenge.targetAltitude} km
                      </div>
                    )}
                  </div>
                </div>

                {/* Hints */}
                {data.hints.length > 0 && (
                  <div className="glass-panel rounded-xl border border-white/10 p-4">
                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="w-full flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-400">Need a hint?</span>
                      <span className="text-blue-400">{showHint ? '▲' : '▼'}</span>
                    </button>
                    {showHint && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-slate-300 text-sm">{data.hints[currentHint]}</p>
                        {data.hints.length > 1 && (
                          <button
                            onClick={() => setCurrentHint((currentHint + 1) % data.hints.length)}
                            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Next hint →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Fun Fact */}
                {data.funFact && (
                  <div className="glass-panel rounded-xl border border-white/10 p-4 bg-purple-500/10">
                    <div className="text-[10px] uppercase tracking-widest text-purple-300 font-mono mb-2">Fun Fact</div>
                    <p className="text-slate-300 text-sm">{data.funFact}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* K-1: the hint is a thing you HEAR, not a disclosure you open */}
          {isPreReader && data.hints.length > 0 && (
            <div className="mt-6 flex justify-center">
              <LuminaReadAloud
                size="lg"
                accent="cyan"
                speaking={isAudioPlaying}
                label="Tell me what to do"
                onClick={() => readAloud(data.hints.join(' '))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrbitMechanicsLab;
