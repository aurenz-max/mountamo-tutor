'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PaperAirplaneDesignerMetrics,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * Paper Airplane Designer — Design-Build-Test-Iterate
 *
 * K-5 Engineering Primitive for teaching the engineering design process:
 * - K: Different shapes fly differently; pick a plane, throw it, watch it go
 * - 1: Wings need to be even (symmetry); pointy vs wide noses
 * - 2: Fold angles change flight path; nose weight helps stability
 * - 3: Design iteration — change ONE thing, test, compare to last attempt
 * - 4: Trade-offs: distance vs hang time vs accuracy; constraint challenges
 * - 5: Systematic variable testing, data collection, optimization graphs
 *
 * EVALUATION INTEGRATION:
 * - Tracks design iterations, variable isolation, challenge completion
 * - Submits evaluation metrics after flight tests
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlaneTemplate {
  name: 'dart' | 'glider' | 'stunt' | 'wide_body' | 'custom';
  description: string;
  baseFolds: number;
  imagePrompt: string;
}

export interface AdjustableParam {
  value: number;
  adjustable: boolean;
  min: number;
  max: number;
}

export interface DesignParameters {
  noseAngle: AdjustableParam;
  wingSpan: AdjustableParam;
  wingAngle: AdjustableParam;
  hasWinglets: boolean;
  hasElevatorTab: boolean;
  noseWeight: { value: number; adjustable: boolean };
}

export interface LaunchSettings {
  angle: AdjustableParam;
  force: AdjustableParam;
  windSpeed: number;
  windDirection: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  t: number;
}

export interface SimulatedResults {
  distance: number;
  hangTime: number;
  stability: number;
  accuracy: number;
  trajectory: TrajectoryPoint[];
}

export interface Challenge {
  id: string;
  name: string;
  goal: string;
  targetMetric: 'distance' | 'hangTime' | 'accuracy';
  targetValue: number;
  hint: string;
  maxAttempts: number | null;
}

export interface FlightLogEntry {
  designVersion: number;
  templateName: string;
  parameters: DesignParameters;
  launchSettings: { angle: number; force: number };
  results: { distance: number; hangTime: number; stability: number; accuracy: number };
}

export interface PaperAirplaneDesignerData {
  title: string;
  description: string;
  template: PlaneTemplate;
  designParameters: DesignParameters;
  launchSettings: LaunchSettings;
  challenges: Challenge[];
  gradeBand: 'K-2' | '3-5';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<PaperAirplaneDesignerMetrics>) => void;
}

// ─── Template presets ───────────────────────────────────────────────────────

const TEMPLATE_PRESETS: Record<string, Partial<DesignParameters>> = {
  dart: {
    noseAngle: { value: 25, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 12, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 5, adjustable: true, min: 0, max: 30 },
    hasWinglets: false,
    hasElevatorTab: false,
    noseWeight: { value: 0, adjustable: true },
  },
  glider: {
    noseAngle: { value: 40, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 18, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 15, adjustable: true, min: 0, max: 30 },
    hasWinglets: true,
    hasElevatorTab: true,
    noseWeight: { value: 1, adjustable: true },
  },
  stunt: {
    noseAngle: { value: 30, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 14, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 20, adjustable: true, min: 0, max: 30 },
    hasWinglets: true,
    hasElevatorTab: false,
    noseWeight: { value: 2, adjustable: true },
  },
  wide_body: {
    noseAngle: { value: 35, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 20, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 10, adjustable: true, min: 0, max: 30 },
    hasWinglets: false,
    hasElevatorTab: true,
    noseWeight: { value: 1, adjustable: true },
  },
  custom: {
    noseAngle: { value: 30, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: 14, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: 10, adjustable: true, min: 0, max: 30 },
    hasWinglets: false,
    hasElevatorTab: false,
    noseWeight: { value: 0, adjustable: true },
  },
};

const TEMPLATE_INFO: Record<string, { label: string; icon: string; desc: string }> = {
  dart: { label: 'Dart', icon: '🎯', desc: 'Fast & straight — great for distance' },
  glider: { label: 'Glider', icon: '🦅', desc: 'Wide wings — stays aloft longer' },
  stunt: { label: 'Stunt', icon: '🌀', desc: 'Heavy nose — loops & tricks' },
  wide_body: { label: 'Wide Body', icon: '✈️', desc: 'Stable & smooth — easy to fly' },
  custom: { label: 'Custom', icon: '✏️', desc: 'Start from scratch' },
};

type Phase = 'build' | 'launch' | 'analyze' | 'iterate';

// ─── Physics simulation ─────────────────────────────────────────────────────

function simulateFlight(
  params: DesignParameters,
  launch: { angle: number; force: number; windSpeed: number; windDirection: number },
): SimulatedResults {
  const { noseAngle, wingSpan, wingAngle, hasWinglets, hasElevatorTab, noseWeight } = params;
  const { angle, force, windSpeed, windDirection } = launch;

  // Base velocity from force
  const baseVel = force * 2.5; // m/s
  const launchRad = (angle * Math.PI) / 180;
  let vx = baseVel * Math.cos(launchRad);
  let vy = baseVel * Math.sin(launchRad);

  // Aerodynamic coefficients derived from design
  const liftCoeff = (wingSpan.value / 20) * (wingAngle.value / 30 + 0.3) * (hasWinglets ? 1.15 : 1);
  const dragCoeff = 0.02 + (wingSpan.value / 100) + (noseAngle.value > 35 ? 0.015 : -0.01);
  const stabilityFactor = (noseWeight.value * 0.15) + (hasElevatorTab ? 0.1 : 0) + (Math.abs(wingAngle.value - 10) < 10 ? 0.1 : -0.05);

  // Wind components
  const windRad = (windDirection * Math.PI) / 180;
  const windVx = windSpeed * Math.cos(windRad);
  const windVy = windSpeed * Math.sin(windRad);

  const dt = 0.05;
  const gravity = 9.81;
  const trajectory: TrajectoryPoint[] = [];
  let x = 0;
  let y = 1.2; // launch height ~1.2m
  let t = 0;
  let maxDeviation = 0;

  trajectory.push({ x, y, t });

  while (y > 0 && t < 20) {
    const relVx = vx - windVx;
    const relVy = vy - windVy;
    const speed = Math.sqrt(relVx * relVx + relVy * relVy);

    // Drag force
    const dragX = -dragCoeff * speed * relVx;
    const dragY = -dragCoeff * speed * relVy;

    // Lift (perpendicular to velocity, upward bias)
    const lift = liftCoeff * speed * 0.3;

    // Update velocities
    vx += (dragX + windVx * 0.01) * dt;
    vy += (-gravity + lift + dragY) * dt;

    // Stability affects lateral wobble
    const wobble = (1 - stabilityFactor) * Math.sin(t * 8) * 0.2;

    x += (vx + wobble) * dt;
    y += vy * dt;
    t += dt;

    maxDeviation = Math.max(maxDeviation, Math.abs(wobble * t));

    if (y < 0) y = 0;
    trajectory.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, t: Math.round(t * 100) / 100 });

    if (y <= 0) break;
  }

  const distance = Math.round(x * 10) / 10;
  const hangTime = Math.round(t * 10) / 10;
  const stability = Math.round(Math.max(0, Math.min(100, (stabilityFactor + 0.3) * 100)));
  const accuracy = Math.round(Math.max(0, Math.min(100, 100 - maxDeviation * 60)));

  return { distance: Math.max(0, distance), hangTime, stability, accuracy, trajectory };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PaperAirplaneDesignerProps {
  data: PaperAirplaneDesignerData;
  className?: string;
}

const PaperAirplaneDesigner: React.FC<PaperAirplaneDesignerProps> = ({ data, className }) => {
  const {
    title,
    description,
    template: initialTemplate,
    designParameters: initialDesignParams,
    launchSettings: initialLaunch,
    challenges = [],
    gradeBand = 'K-2',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `paper-airplane-designer-${Date.now()}`;
  const gradeLevel = gradeBand;

  // ─── State ──────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<Phase>('build');
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplate?.name || 'dart');

  // Design parameters
  const [noseAngle, setNoseAngle] = useState(initialDesignParams?.noseAngle?.value ?? 30);
  const [wingSpan, setWingSpan] = useState(initialDesignParams?.wingSpan?.value ?? 14);
  const [wingAngle, setWingAngle] = useState(initialDesignParams?.wingAngle?.value ?? 10);
  const [hasWinglets, setHasWinglets] = useState(initialDesignParams?.hasWinglets ?? false);
  const [hasElevatorTab, setHasElevatorTab] = useState(initialDesignParams?.hasElevatorTab ?? false);
  const [noseWeight, setNoseWeight] = useState(initialDesignParams?.noseWeight?.value ?? 0);

  // Launch settings
  const [launchAngle, setLaunchAngle] = useState(initialLaunch?.angle?.value ?? 30);
  const [launchForce, setLaunchForce] = useState(initialLaunch?.force?.value ?? 5);

  // Flight results
  const [flightResults, setFlightResults] = useState<SimulatedResults | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [flightProgress, setFlightProgress] = useState(0);

  // Flight log
  const [flightLog, setFlightLog] = useState<FlightLogEntry[]>([]);
  const [designVersion, setDesignVersion] = useState(1);

  // Tracking
  const [changesFromLast, setChangesFromLast] = useState<string[]>([]);
  const [flightLogViewed, setFlightLogViewed] = useState(false);

  const animFrameRef = useRef<number>(0);

  // ─── Current design snapshot ──────────────────────────────────────────

  const currentDesign = useMemo((): DesignParameters => ({
    noseAngle: { value: noseAngle, adjustable: true, min: 15, max: 45 },
    wingSpan: { value: wingSpan, adjustable: true, min: 8, max: 20 },
    wingAngle: { value: wingAngle, adjustable: true, min: 0, max: 30 },
    hasWinglets,
    hasElevatorTab,
    noseWeight: { value: noseWeight, adjustable: true },
  }), [noseAngle, wingSpan, wingAngle, hasWinglets, hasElevatorTab, noseWeight]);

  // ─── AI Tutoring ──────────────────────────────────────────────────────

  const aiPrimitiveData = useMemo(() => ({
    template: selectedTemplate,
    designParameters: currentDesign,
    launchSettings: { angle: launchAngle, force: launchForce },
    flightLog,
    designVersion,
    currentResults: flightResults,
    challenges,
    gradeBand,
  }), [selectedTemplate, currentDesign, launchAngle, launchForce, flightLog, designVersion, flightResults, challenges, gradeBand]);

  const { sendText } = useLuminaAI({
    primitiveType: 'paper-airplane-designer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ─── Evaluation ─────────────────────────────────────────────────────

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    resetAttempt: resetEvaluationAttempt,
  } = usePrimitiveEvaluation<PaperAirplaneDesignerMetrics>({
    primitiveType: 'paper-airplane-designer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // ─── Helpers ──────────────────────────────────────────────────────────

  // Detect what changed between current design and last logged design
  const detectChanges = useCallback((): string[] => {
    if (flightLog.length === 0) return ['first_flight'];
    const last = flightLog[flightLog.length - 1];
    const changes: string[] = [];
    if (last.templateName !== selectedTemplate) changes.push('template');
    if (last.parameters.noseAngle.value !== noseAngle) changes.push('noseAngle');
    if (last.parameters.wingSpan.value !== wingSpan) changes.push('wingSpan');
    if (last.parameters.wingAngle.value !== wingAngle) changes.push('wingAngle');
    if (last.parameters.hasWinglets !== hasWinglets) changes.push('winglets');
    if (last.parameters.hasElevatorTab !== hasElevatorTab) changes.push('elevatorTab');
    if (last.parameters.noseWeight.value !== noseWeight) changes.push('noseWeight');
    if (last.launchSettings.angle !== launchAngle) changes.push('launchAngle');
    if (last.launchSettings.force !== launchForce) changes.push('launchForce');
    return changes;
  }, [flightLog, selectedTemplate, noseAngle, wingSpan, wingAngle, hasWinglets, hasElevatorTab, noseWeight, launchAngle, launchForce]);

  // Check which challenges are met by given results
  const getCompletedChallenges = useCallback((results: SimulatedResults): string[] => {
    return challenges
      .filter(c => {
        const val = results[c.targetMetric as keyof SimulatedResults] as number;
        return val >= c.targetValue;
      })
      .map(c => c.id);
  }, [challenges]);

  // Count distinct templates used across flight log
  const templatesUsed = useMemo(() => {
    const set = new Set(flightLog.map(e => e.templateName));
    set.add(selectedTemplate);
    return set.size;
  }, [flightLog, selectedTemplate]);

  // Did student ever change only one variable?
  const hasIsolatedVariable = useMemo(() => {
    for (let i = 1; i < flightLog.length; i++) {
      const prev = flightLog[i - 1];
      const curr = flightLog[i];
      const diffs: string[] = [];
      if (prev.templateName !== curr.templateName) diffs.push('template');
      if (prev.parameters.noseAngle.value !== curr.parameters.noseAngle.value) diffs.push('noseAngle');
      if (prev.parameters.wingSpan.value !== curr.parameters.wingSpan.value) diffs.push('wingSpan');
      if (prev.parameters.wingAngle.value !== curr.parameters.wingAngle.value) diffs.push('wingAngle');
      if (prev.parameters.hasWinglets !== curr.parameters.hasWinglets) diffs.push('winglets');
      if (prev.parameters.hasElevatorTab !== curr.parameters.hasElevatorTab) diffs.push('elevatorTab');
      if (prev.parameters.noseWeight.value !== curr.parameters.noseWeight.value) diffs.push('noseWeight');
      if (diffs.length === 1) return true;
    }
    return false;
  }, [flightLog]);

  // ─── Template selection ───────────────────────────────────────────────

  const handleSelectTemplate = (name: string) => {
    setSelectedTemplate(name);
    const preset = TEMPLATE_PRESETS[name];
    if (preset) {
      if (preset.noseAngle) setNoseAngle(preset.noseAngle.value);
      if (preset.wingSpan) setWingSpan(preset.wingSpan.value);
      if (preset.wingAngle) setWingAngle(preset.wingAngle.value);
      if (preset.hasWinglets !== undefined) setHasWinglets(preset.hasWinglets);
      if (preset.hasElevatorTab !== undefined) setHasElevatorTab(preset.hasElevatorTab);
      if (preset.noseWeight) setNoseWeight(preset.noseWeight.value);
    }
    sendText(`[TEMPLATE_SELECTED] Student selected the "${name}" template. Briefly describe what makes this design special.`, { silent: true });
  };

  // ─── Flight simulation ────────────────────────────────────────────────

  const launchFlight = useCallback(() => {
    setIsFlying(true);
    setFlightProgress(0);
    setPhase('launch');

    const changes = detectChanges();
    setChangesFromLast(changes);

    // AI coaching on variable isolation
    if (flightLog.length > 0 && changes.length > 2) {
      sendText(
        `[DESIGN_CHANGE] Student changed ${changes.length} things at once (${changes.join(', ')}). Coach them to change only one variable at a time for better testing.`,
        { silent: true },
      );
    } else if (flightLog.length > 0 && changes.length === 1) {
      sendText(
        `[VARIABLE_ISOLATED] Great! Student changed only "${changes[0]}" this time. Praise them for good scientific method.`,
        { silent: true },
      );
    }

    const results = simulateFlight(currentDesign, {
      angle: launchAngle,
      force: launchForce,
      windSpeed: initialLaunch?.windSpeed ?? 0,
      windDirection: initialLaunch?.windDirection ?? 0,
    });

    // Animate the flight over ~2.5 seconds
    const totalFrames = Math.min(results.trajectory.length, 120);
    let frame = 0;

    const animate = () => {
      frame++;
      setFlightProgress(frame / totalFrames);
      if (frame < totalFrames) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsFlying(false);
        setFlightResults(results);

        // Log the flight
        const entry: FlightLogEntry = {
          designVersion,
          templateName: selectedTemplate,
          parameters: { ...currentDesign },
          launchSettings: { angle: launchAngle, force: launchForce },
          results: {
            distance: results.distance,
            hangTime: results.hangTime,
            stability: results.stability,
            accuracy: results.accuracy,
          },
        };
        setFlightLog(prev => [...prev, entry]);
        setDesignVersion(v => v + 1);

        // Check improvement
        if (flightLog.length > 0) {
          const lastResults = flightLog[flightLog.length - 1].results;
          const distImproved = results.distance > lastResults.distance;
          const hangImproved = results.hangTime > lastResults.hangTime;
          if (distImproved || hangImproved) {
            const improvementDetails = [
              distImproved ? `distance: ${lastResults.distance}m → ${results.distance}m` : null,
              hangImproved ? `hang time: ${lastResults.hangTime}s → ${results.hangTime}s` : null,
            ].filter(Boolean).join(', ');
            sendText(
              `[IMPROVEMENT] Student improved! ${improvementDetails}. Changed: ${changes.join(', ')}. Celebrate the improvement and connect it to the design change.`,
              { silent: true },
            );
          } else {
            sendText(
              `[NO_IMPROVEMENT] Results didn't improve (distance: ${results.distance}m, hang time: ${results.hangTime}s). Changed: ${changes.join(', ')}. Encourage the student and suggest what to try next.`,
              { silent: true },
            );
          }
        } else {
          sendText(
            `[FIRST_FLIGHT] First flight complete! Distance: ${results.distance}m, hang time: ${results.hangTime}s, stability: ${results.stability}%. Celebrate and encourage iteration.`,
            { silent: true },
          );
        }

        // Check challenges
        const completed = getCompletedChallenges(results);
        if (completed.length > 0) {
          const names = completed.map(id => challenges.find(c => c.id === id)?.name).filter(Boolean);
          sendText(`[CHALLENGE_COMPLETE] Student completed challenge(s): ${names.join(', ')}! Celebrate this achievement.`, { silent: true });
        }

        setPhase('analyze');
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [currentDesign, launchAngle, launchForce, initialLaunch, flightLog, designVersion, selectedTemplate, detectChanges, getCompletedChallenges, challenges, sendText]);

  // ─── Reset ────────────────────────────────────────────────────────────

  const handleReset = () => {
    setPhase('build');
    setFlightResults(null);
    setIsFlying(false);
    setFlightProgress(0);
    setFlightLog([]);
    setDesignVersion(1);
    setChangesFromLast([]);
    setFlightLogViewed(false);
    cancelAnimationFrame(animFrameRef.current);
    resetEvaluationAttempt();
    sendText('[RESET] Student reset the entire experiment. Welcome them back and suggest a starting template.', { silent: true });
  };

  const handleIteratePhase = () => {
    setPhase('build');
    setFlightResults(null);
    setFlightProgress(0);
    sendText(`[ITERATE] Student is going back to modify their design (version ${designVersion}). Encourage them to look at the flight log and change one thing.`, { silent: true });
  };

  // ─── Submit evaluation ────────────────────────────────────────────────

  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation || flightLog.length === 0) return;

    const allCompleted = challenges.map(c => c.id);
    const allLogCompletions = flightLog.flatMap(entry => {
      const r: SimulatedResults = { ...entry.results, trajectory: [] };
      return getCompletedChallenges(r);
    });
    const uniqueCompletions = Array.from(new Set(allLogCompletions));

    const bestDistance = Math.max(...flightLog.map(e => e.results.distance), 0);
    const bestHangTime = Math.max(...flightLog.map(e => e.results.hangTime), 0);
    const bestAccuracy = Math.max(...flightLog.map(e => e.results.accuracy), 0);

    const firstDist = flightLog[0]?.results.distance ?? 0;
    const lastDist = flightLog[flightLog.length - 1]?.results.distance ?? 0;
    const improvementAcross = lastDist > firstDist;

    const metrics: PaperAirplaneDesignerMetrics = {
      type: 'paper-airplane-designer',
      designIterations: flightLog.length,
      improvementAcrossIterations: improvementAcross,
      variableIsolation: hasIsolatedVariable,
      challengesCompleted: uniqueCompletions.length,
      challengesTotal: challenges.length,
      bestDistance,
      bestHangTime,
      bestAccuracy,
      templateVariety: templatesUsed,
      flightLogUsed: flightLogViewed,
      attemptsCount: flightLog.length,
    };

    const score = Math.round(
      (metrics.designIterations >= 3 ? 25 : metrics.designIterations * 8) +
      (metrics.improvementAcrossIterations ? 25 : 0) +
      (metrics.variableIsolation ? 20 : 0) +
      (challenges.length > 0 ? (metrics.challengesCompleted / metrics.challengesTotal) * 30 : 30),
    );

    const success = score >= 50;
    submitEvaluation(success, score, metrics, { flightLog });

    sendText(`[ALL_COMPLETE] Student finished testing with ${flightLog.length} designs. Score: ${score}. Celebrate their engineering work!`, { silent: true });
  }, [hasSubmittedEvaluation, flightLog, challenges, getCompletedChallenges, hasIsolatedVariable, templatesUsed, flightLogViewed, submitEvaluation, sendText]);

  // ─── SVG airplane rendering ───────────────────────────────────────────

  const svgWidth = 600;
  const svgHeight = 300;

  const renderAirplaneSVG = (params: { noseAngle: number; wingSpan: number; wingAngle: number; hasWinglets: boolean; hasElevatorTab: boolean; noseWeight: number }, small?: boolean) => {
    const scale = small ? 0.5 : 1;
    const cx = small ? 80 : svgWidth / 2;
    const cy = small ? 50 : svgHeight / 2;

    const bodyLen = 80 * scale;
    const noseLen = (25 + (45 - params.noseAngle) * 0.5) * scale;
    const wSpan = (params.wingSpan * 3) * scale;
    const wAngleRad = (params.wingAngle * Math.PI) / 180;
    const wingSweep = Math.tan(wAngleRad) * wSpan * 0.3;

    // Body
    const noseX = cx - bodyLen / 2 - noseLen;
    const tailX = cx + bodyLen / 2;
    const bodyColor = params.noseWeight > 1 ? '#94a3b8' : '#cbd5e1';

    // Wings
    const wingRootX = cx - bodyLen * 0.15;
    const wingTipX = wingRootX + wingSweep;
    const winglets = params.hasWinglets;
    const elevator = params.hasElevatorTab;

    return (
      <g>
        {/* Body */}
        <path
          d={`M ${noseX},${cy} L ${cx - bodyLen / 2},${cy - 4 * scale} L ${tailX},${cy - 3 * scale} L ${tailX + 8 * scale},${cy} L ${tailX},${cy + 3 * scale} L ${cx - bodyLen / 2},${cy + 4 * scale} Z`}
          fill={bodyColor}
          stroke="#64748b"
          strokeWidth={1}
          opacity={0.9}
        />
        {/* Nose weight indicator */}
        {params.noseWeight > 0 && (
          <circle cx={noseX + 8 * scale} cy={cy} r={3 * scale * params.noseWeight} fill="#f59e0b" opacity={0.6} />
        )}
        {/* Top wing */}
        <path
          d={`M ${wingRootX},${cy - 4 * scale} L ${wingTipX},${cy - wSpan / 2} L ${wingTipX + 25 * scale},${cy - wSpan / 2} L ${wingRootX + 35 * scale},${cy - 4 * scale} Z`}
          fill="#3b82f6"
          stroke="#2563eb"
          strokeWidth={1}
          opacity={0.8}
        />
        {/* Bottom wing */}
        <path
          d={`M ${wingRootX},${cy + 4 * scale} L ${wingTipX},${cy + wSpan / 2} L ${wingTipX + 25 * scale},${cy + wSpan / 2} L ${wingRootX + 35 * scale},${cy + 4 * scale} Z`}
          fill="#3b82f6"
          stroke="#2563eb"
          strokeWidth={1}
          opacity={0.8}
        />
        {/* Winglets */}
        {winglets && (
          <>
            <line x1={wingTipX} y1={cy - wSpan / 2} x2={wingTipX - 5 * scale} y2={cy - wSpan / 2 - 8 * scale} stroke="#60a5fa" strokeWidth={2} />
            <line x1={wingTipX} y1={cy + wSpan / 2} x2={wingTipX - 5 * scale} y2={cy + wSpan / 2 + 8 * scale} stroke="#60a5fa" strokeWidth={2} />
          </>
        )}
        {/* Elevator tab */}
        {elevator && (
          <path
            d={`M ${tailX},${cy - 3 * scale} L ${tailX + 12 * scale},${cy - 10 * scale} L ${tailX + 15 * scale},${cy - 8 * scale} L ${tailX + 5 * scale},${cy} Z`}
            fill="#f97316"
            stroke="#ea580c"
            strokeWidth={1}
            opacity={0.8}
          />
        )}
      </g>
    );
  };

  // ─── Trajectory rendering ─────────────────────────────────────────────

  const renderTrajectory = () => {
    if (!flightResults) return null;
    const { trajectory } = flightResults;
    if (trajectory.length < 2) return null;

    // Scale trajectory to fit SVG
    const maxX = Math.max(...trajectory.map(p => p.x), 1);
    const maxY = Math.max(...trajectory.map(p => p.y), 1);
    const padX = 60;
    const padY = 40;
    const plotW = svgWidth - padX * 2;
    const plotH = svgHeight - padY * 2;

    const scaleX = (x: number) => padX + (x / maxX) * plotW;
    const scaleY = (y: number) => svgHeight - padY - (y / maxY) * plotH;

    const visiblePoints = isFlying
      ? trajectory.slice(0, Math.floor(flightProgress * trajectory.length))
      : trajectory;

    if (visiblePoints.length < 2) return null;

    const pathD = visiblePoints.map((p, i) =>
      i === 0 ? `M ${scaleX(p.x)},${scaleY(p.y)}` : `L ${scaleX(p.x)},${scaleY(p.y)}`
    ).join(' ');

    const lastPt = visiblePoints[visiblePoints.length - 1];

    return (
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto" style={{ maxHeight: '280px' }}>
        <defs>
          <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Ground */}
        <rect x={padX} y={svgHeight - padY} width={plotW} height={padY} fill="#1e293b" opacity={0.3} />
        <line x1={padX} y1={svgHeight - padY} x2={padX + plotW} y2={svgHeight - padY} stroke="#475569" strokeWidth={2} />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(frac => (
          <line key={frac} x1={padX} y1={scaleY(maxY * frac)} x2={padX + plotW} y2={scaleY(maxY * frac)} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
        ))}

        {/* Axis labels */}
        <text x={svgWidth / 2} y={svgHeight - 8} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace">Distance (m)</text>
        <text x={14} y={svgHeight / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace" transform={`rotate(-90, 14, ${svgHeight / 2})`}>Height (m)</text>

        {/* Trajectory path */}
        <path d={pathD} fill="none" stroke="url(#trajGrad)" strokeWidth={3} strokeLinecap="round" />

        {/* Airplane at current position */}
        <circle cx={scaleX(lastPt.x)} cy={scaleY(lastPt.y)} r={6} fill="#f59e0b" stroke="white" strokeWidth={2} />

        {/* Start marker */}
        <circle cx={scaleX(0)} cy={scaleY(trajectory[0]?.y ?? 0)} r={4} fill="#22c55e" />

        {/* End marker */}
        {!isFlying && (
          <circle cx={scaleX(lastPt.x)} cy={scaleY(lastPt.y)} r={5} fill="#ef4444" stroke="white" strokeWidth={1.5} />
        )}
      </svg>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const allChallengesCompleted = useMemo(() => {
    if (challenges.length === 0) return false;
    const allLogResults = flightLog.map(e => ({ ...e.results, trajectory: [] as TrajectoryPoint[] }));
    const allCompletedIds = new Set(allLogResults.flatMap(r => getCompletedChallenges(r)));
    return challenges.every(c => allCompletedIds.has(c.id));
  }, [flightLog, challenges, getCompletedChallenges]);

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shadow-[0_0_20px_rgba(14,165,233,0.2)]">
          <span className="text-2xl">✈️</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <p className="text-xs text-sky-400 font-mono uppercase tracking-wider">
              Paper Airplane Design Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-sky-500/20 relative overflow-hidden">
        {/* Background dots */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#0ea5e9 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Phase indicator */}
          <div className="flex justify-center gap-2 mb-6">
            {(['build', 'launch', 'analyze', 'iterate'] as Phase[]).map((p, i) => {
              const labels = ['1. Build', '2. Launch', '3. Analyze', '4. Iterate'];
              const icons = ['🔧', '🚀', '📊', '🔄'];
              const isActive = phase === p;
              const isPast = (['build', 'launch', 'analyze', 'iterate'] as Phase[]).indexOf(phase) > i;

              return (
                <div key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                  isActive ? 'bg-sky-500/30 border border-sky-500/50 text-sky-300' :
                  isPast ? 'bg-slate-700/40 border border-slate-600/30 text-slate-400' :
                  'bg-slate-800/30 border border-slate-700/20 text-slate-600'
                }`}>
                  <span>{icons[i]}</span>
                  <span>{labels[i]}</span>
                </div>
              );
            })}
          </div>

          {/* ─── BUILD PHASE ─────────────────────────────────────────── */}
          {phase === 'build' && (
            <div className="space-y-6">
              {/* Template selection */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-slate-100 text-lg">Choose a Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(TEMPLATE_INFO).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => handleSelectTemplate(key)}
                        className={`p-3 rounded-xl border transition-all text-center ${
                          selectedTemplate === key
                            ? 'bg-sky-500/30 border-sky-500/50 text-sky-300'
                            : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="text-2xl block mb-1">{info.icon}</span>
                        <span className="font-semibold text-sm block">{info.label}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{info.desc}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Preview + Parameters side by side */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Airplane preview */}
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-100 text-lg">Your Airplane</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-800/40 rounded-xl overflow-hidden border border-slate-700/50 p-2">
                      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto" style={{ maxHeight: '200px' }}>
                        <defs>
                          <linearGradient id="skyBg" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#0c4a6e" />
                            <stop offset="100%" stopColor="#1e293b" />
                          </linearGradient>
                        </defs>
                        <rect width={svgWidth} height={svgHeight} fill="url(#skyBg)" />
                        {/* Clouds */}
                        <ellipse cx={100} cy={60} rx={40} ry={15} fill="white" opacity={0.05} />
                        <ellipse cx={450} cy={80} rx={50} ry={18} fill="white" opacity={0.05} />
                        {renderAirplaneSVG({ noseAngle, wingSpan, wingAngle, hasWinglets, hasElevatorTab, noseWeight })}
                      </svg>
                    </div>
                  </CardContent>
                </Card>

                {/* Design parameters */}
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-100 text-lg">Design Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Nose angle */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Nose Angle</label>
                        <span className="text-sm font-mono text-sky-400">{noseAngle}°</span>
                      </div>
                      <Slider
                        value={[noseAngle]}
                        onValueChange={([v]) => setNoseAngle(v)}
                        min={15}
                        max={45}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Pointy = faster, Wide = more lift</p>
                    </div>

                    {/* Wing span */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Wing Span</label>
                        <span className="text-sm font-mono text-sky-400">{wingSpan} cm</span>
                      </div>
                      <Slider
                        value={[wingSpan]}
                        onValueChange={([v]) => setWingSpan(v)}
                        min={8}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Wider wings = more lift, more drag</p>
                    </div>

                    {/* Wing angle */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Wing Angle (Dihedral)</label>
                        <span className="text-sm font-mono text-sky-400">{wingAngle}°</span>
                      </div>
                      <Slider
                        value={[wingAngle]}
                        onValueChange={([v]) => setWingAngle(v)}
                        min={0}
                        max={30}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setHasWinglets(!hasWinglets)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          hasWinglets ? 'bg-sky-500/30 border-sky-500/50 text-sky-300' : 'bg-white/5 border-white/20 text-slate-400'
                        }`}
                      >
                        {hasWinglets ? '✓' : '+'} Winglets
                      </button>
                      <button
                        onClick={() => setHasElevatorTab(!hasElevatorTab)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          hasElevatorTab ? 'bg-orange-500/30 border-orange-500/50 text-orange-300' : 'bg-white/5 border-white/20 text-slate-400'
                        }`}
                      >
                        {hasElevatorTab ? '✓' : '+'} Elevator Tab
                      </button>
                    </div>

                    {/* Nose weight */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Nose Weight (paper clips)</label>
                        <span className="text-sm font-mono text-amber-400">{noseWeight}</span>
                      </div>
                      <Slider
                        value={[noseWeight]}
                        onValueChange={([v]) => setNoseWeight(v)}
                        min={0}
                        max={3}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Launch settings */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-lg">Launch Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Launch Angle</label>
                        <span className="text-sm font-mono text-emerald-400">{launchAngle}°</span>
                      </div>
                      <Slider
                        value={[launchAngle]}
                        onValueChange={([v]) => setLaunchAngle(v)}
                        min={0}
                        max={60}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Higher = more arc, Lower = more distance</p>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-sm text-slate-300">Launch Force</label>
                        <span className="text-sm font-mono text-emerald-400">{launchForce}/10</span>
                      </div>
                      <Slider
                        value={[launchForce]}
                        onValueChange={([v]) => setLaunchForce(v)}
                        min={1}
                        max={10}
                        step={1}
                        className="w-full"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Gentle toss vs powerful throw</p>
                    </div>
                  </div>
                  {(initialLaunch?.windSpeed ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                      <span>💨</span>
                      <span>Wind: {initialLaunch.windSpeed} m/s from {initialLaunch.windDirection}°</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Launch button */}
              <div className="flex justify-center gap-4">
                <Button
                  onClick={launchFlight}
                  variant="ghost"
                  className="bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 px-8 py-6 text-lg font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  🚀 Launch Flight #{designVersion}
                </Button>
              </div>
            </div>
          )}

          {/* ─── LAUNCH PHASE ────────────────────────────────────────── */}
          {phase === 'launch' && (
            <div className="space-y-6">
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                    {isFlying ? (
                      <>
                        <div className="w-5 h-5 border-2 border-sky-300/30 border-t-sky-300 rounded-full animate-spin" />
                        Flight in progress...
                      </>
                    ) : (
                      <>📊 Flight Complete!</>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-800/40 rounded-xl overflow-hidden border border-slate-700/50 p-2">
                    {renderTrajectory()}
                  </div>
                  {isFlying && (
                    <div className="mt-3">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${flightProgress * 100}%` }} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── ANALYZE PHASE ───────────────────────────────────────── */}
          {phase === 'analyze' && flightResults && (
            <div className="space-y-6">
              {/* Trajectory replay */}
              <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-lg">Flight #{designVersion - 1} Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-800/40 rounded-xl overflow-hidden border border-slate-700/50 p-2">
                    {renderTrajectory()}
                  </div>
                </CardContent>
              </Card>

              {/* Performance metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Distance', value: `${flightResults.distance}m`, icon: '📏', color: 'sky' },
                  { label: 'Hang Time', value: `${flightResults.hangTime}s`, icon: '⏱️', color: 'emerald' },
                  { label: 'Stability', value: `${flightResults.stability}%`, icon: '⚖️', color: 'amber' },
                  { label: 'Accuracy', value: `${flightResults.accuracy}%`, icon: '🎯', color: 'violet' },
                ].map(metric => (
                  <Card key={metric.label} className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                    <CardContent className="p-4 text-center">
                      <span className="text-2xl block">{metric.icon}</span>
                      <div className={`text-2xl font-bold mt-1 ${
                        metric.color === 'sky' ? 'text-sky-300' :
                        metric.color === 'emerald' ? 'text-emerald-300' :
                        metric.color === 'amber' ? 'text-amber-300' :
                        'text-violet-300'
                      }`}>{metric.value}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{metric.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* What changed */}
              {changesFromLast.length > 0 && changesFromLast[0] !== 'first_flight' && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-slate-400">Changes from last design:</span>
                      {changesFromLast.length === 1 && (
                        <Badge variant="outline" className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300 text-xs">Good: 1 variable!</Badge>
                      )}
                      {changesFromLast.length > 2 && (
                        <Badge variant="outline" className="bg-amber-500/20 border-amber-500/40 text-amber-300 text-xs">Tip: try changing just 1 thing</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {changesFromLast.map(c => (
                        <Badge key={c} variant="outline" className="bg-white/5 border-white/20 text-slate-300 text-xs">{c}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Challenges */}
              {challenges.length > 0 && (
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-100 text-lg">Challenges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {challenges.map(ch => {
                        const allLogResults = flightLog.map(e => ({ ...e.results, trajectory: [] as TrajectoryPoint[] }));
                        const completed = allLogResults.some(r => getCompletedChallenges(r).includes(ch.id));
                        return (
                          <div key={ch.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                            completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{completed ? '✅' : '🏆'}</span>
                              <div>
                                <span className={`text-sm font-semibold ${completed ? 'text-emerald-300' : 'text-slate-300'}`}>{ch.name}</span>
                                <p className="text-xs text-slate-400">{ch.goal}</p>
                              </div>
                            </div>
                            {!completed && (
                              <span className="text-xs text-slate-500 italic">{ch.hint}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Flight log */}
              {flightLog.length > 1 && (
                <Accordion type="single" collapsible onValueChange={(v) => { if (v) setFlightLogViewed(true); }}>
                  <AccordionItem value="log" className="border-white/10">
                    <AccordionTrigger className="text-slate-100 hover:text-white">
                      Flight Log ({flightLog.length} flights)
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-slate-400 font-mono text-xs">#</th>
                              <th className="text-left py-2 px-2 text-slate-400 font-mono text-xs">Template</th>
                              <th className="text-right py-2 px-2 text-slate-400 font-mono text-xs">Dist</th>
                              <th className="text-right py-2 px-2 text-slate-400 font-mono text-xs">Hang</th>
                              <th className="text-right py-2 px-2 text-slate-400 font-mono text-xs">Stab</th>
                              <th className="text-right py-2 px-2 text-slate-400 font-mono text-xs">Acc</th>
                            </tr>
                          </thead>
                          <tbody>
                            {flightLog.map((entry, i) => {
                              const isBest = entry.results.distance === Math.max(...flightLog.map(e => e.results.distance));
                              return (
                                <tr key={i} className={`border-b border-white/5 ${isBest ? 'bg-emerald-500/5' : ''}`}>
                                  <td className="py-1.5 px-2 text-slate-300 font-mono">{entry.designVersion}</td>
                                  <td className="py-1.5 px-2 text-slate-300">{TEMPLATE_INFO[entry.templateName]?.icon} {entry.templateName}</td>
                                  <td className="py-1.5 px-2 text-right text-sky-300 font-mono">{entry.results.distance}m</td>
                                  <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">{entry.results.hangTime}s</td>
                                  <td className="py-1.5 px-2 text-right text-amber-300 font-mono">{entry.results.stability}%</td>
                                  <td className="py-1.5 px-2 text-right text-violet-300 font-mono">{entry.results.accuracy}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  onClick={handleIteratePhase}
                  variant="ghost"
                  className="bg-sky-500/20 border border-sky-500/50 hover:bg-sky-500/30 text-sky-300 px-6 py-5 text-base font-bold rounded-xl"
                >
                  🔄 Modify &amp; Retest
                </Button>

                {flightLog.length >= 2 && !hasSubmittedEvaluation && (
                  <Button
                    onClick={handleSubmitEvaluation}
                    variant="ghost"
                    className="bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 px-6 py-5 text-base font-bold rounded-xl"
                  >
                    ✅ Submit My Work
                  </Button>
                )}

                {hasSubmittedEvaluation && (
                  <Badge variant="outline" className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300 text-sm px-4 py-2">
                    Work Submitted!
                  </Badge>
                )}

                <Button
                  onClick={handleReset}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 px-5 py-5 text-sm rounded-xl"
                >
                  ↺ Start Over
                </Button>
              </div>
            </div>
          )}

          {/* ─── Educational tips ─────────────────────────────────────── */}
          <div className="mt-8 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Design Tips
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-sky-400 font-semibold">Pointy nose</span> = less air resistance = flies farther. <span className="text-amber-400 font-semibold">Wide nose</span> = more lift = stays up longer.
              </p>
              <p className="text-slate-300">
                <span className="text-emerald-400 font-semibold">Wider wings</span> give more lift but slow the plane down. Try different combinations!
              </p>
              <p className="text-slate-300">
                <span className="text-violet-400 font-semibold">Change ONE thing at a time</span> — that way you know what made the difference.
              </p>
              {gradeBand === '3-5' && (
                <p className="text-slate-300">
                  <span className="text-orange-400 font-semibold">Use the flight log</span> to compare your designs and find patterns in what works best.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperAirplaneDesigner;
