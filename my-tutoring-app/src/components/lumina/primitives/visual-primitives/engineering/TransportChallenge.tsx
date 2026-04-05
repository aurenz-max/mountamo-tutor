'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { TransportChallengeMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface VehicleOption {
  id: string;
  name: string;
  emoji: string;
  capacity: number;
  speedKmh: number;
  costPerTrip: number;
  co2PerTrip: number;
  turnaroundMinutes: number;
  requiresInfrastructure?: string;
  infrastructureCost?: number;
  color: string;
}

export interface TransportConstraint {
  type: 'budget' | 'time' | 'co2';
  limit: number;
  unit: string;
}

export interface TransportScenario {
  id: string;
  type: 'single_constraint' | 'multi_constraint' | 'full_optimization';
  title: string;
  origin: string;
  destination: string;
  distanceKm: number;
  peopleToTransport: number;
  constraints: TransportConstraint[];
  vehicles: VehicleOption[];
  bestVehicleId: string;
  acceptableVehicleIds: string[];
  tradeOffQuestion: string;
  tradeOffOptions: string[];
  tradeOffCorrectIndex: number;
  explanation: string;
}

export interface TransportChallengeData {
  title: string;
  description: string;
  scenarios: TransportScenario[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TransportChallengeMetrics>) => void;
}

// ─── Simulation Types ─────────────────────────────────────────────────────────

interface VehicleState {
  progress: number; // 0-1 along route
  direction: 'waiting' | 'outbound' | 'unloading' | 'returning' | 'loading' | 'done';
  tripNumber: number;
}

interface SimSnapshot {
  vehicles: VehicleState[];
  peopleDelivered: number;
  peopleRemaining: number;
  totalCost: number;
  totalCO2: number;
  elapsedMinutes: number;
  tripsCompleted: number;
  totalTripsNeeded: number;
  isComplete: boolean;
}

interface VehicleOutcome {
  vehicleId: string;
  totalTrips: number;
  totalTimeMinutes: number;
  totalCost: number;
  totalCO2: number;
  constraintResults: { type: string; met: boolean; actual: number; limit: number }[];
  allConstraintsMet: boolean;
}

// ─── Simulation Helpers ───────────────────────────────────────────────────────

const MAX_FLEET_SIZE = 15;
const TARGET_SIM_SECONDS = 18;
const SIM_TICK_MS = 50; // 20fps

function computeVehicleOutcome(
  scenario: TransportScenario,
  vehicle: VehicleOption,
): VehicleOutcome {
  const { distanceKm, peopleToTransport, constraints } = scenario;
  const totalTrips = Math.ceil(peopleToTransport / vehicle.capacity);
  const fleetSize = Math.min(totalTrips, MAX_FLEET_SIZE);
  const outboundMinutes = (distanceKm / vehicle.speedKmh) * 60;
  const roundTripMinutes = outboundMinutes * 2 + vehicle.turnaroundMinutes;
  const batches = Math.ceil(totalTrips / fleetSize);
  // First batch: outbound only. Subsequent batches: full round trip each.
  const totalTimeMinutes = outboundMinutes + (batches > 1 ? (batches - 1) * roundTripMinutes : 0)
    + vehicle.turnaroundMinutes / 2; // unload time for last batch
  const totalCost = totalTrips * vehicle.costPerTrip + (vehicle.infrastructureCost ?? 0);
  const totalCO2 = totalTrips * vehicle.co2PerTrip;

  const constraintResults = constraints.map(c => {
    const actual = c.type === 'budget' ? totalCost : c.type === 'time' ? totalTimeMinutes : totalCO2;
    return { type: c.type, met: actual <= c.limit, actual, limit: c.limit };
  });

  return {
    vehicleId: vehicle.id,
    totalTrips,
    totalTimeMinutes,
    totalCost,
    totalCO2,
    constraintResults,
    allConstraintsMet: constraintResults.every(r => r.met),
  };
}

function getVehicleStateAtTime(
  vehicleIndex: number,
  simMinutes: number,
  outboundMin: number,
  roundTripMin: number,
  unloadMin: number,
  maxTripsForVehicle: number,
): VehicleState {
  const stagger = vehicleIndex * 0.4;
  const t = simMinutes - stagger;
  if (t < 0) return { progress: 0, direction: 'waiting', tripNumber: 0 };

  const loadMin = unloadMin; // symmetric
  const fullRound = outboundMin + unloadMin + outboundMin + loadMin;

  const roundIndex = Math.floor(t / fullRound);
  const phase = t % fullRound;

  if (roundIndex >= maxTripsForVehicle) {
    return { progress: 0, direction: 'done', tripNumber: maxTripsForVehicle };
  }

  if (phase < outboundMin) {
    return { progress: phase / outboundMin, direction: 'outbound', tripNumber: roundIndex };
  } else if (phase < outboundMin + unloadMin) {
    return { progress: 1, direction: 'unloading', tripNumber: roundIndex };
  } else if (phase < outboundMin + unloadMin + outboundMin) {
    const rp = phase - outboundMin - unloadMin;
    return { progress: 1 - rp / outboundMin, direction: 'returning', tripNumber: roundIndex };
  } else {
    return { progress: 0, direction: 'loading', tripNumber: roundIndex + 1 };
  }
}

function computeSimSnapshot(
  simMinutes: number,
  scenario: TransportScenario,
  vehicle: VehicleOption,
): SimSnapshot {
  const { distanceKm, peopleToTransport } = scenario;
  const totalTripsNeeded = Math.ceil(peopleToTransport / vehicle.capacity);
  const fleetSize = Math.min(totalTripsNeeded, MAX_FLEET_SIZE);
  const outboundMin = (distanceKm / vehicle.speedKmh) * 60;
  const unloadMin = vehicle.turnaroundMinutes / 2;
  const roundTripMin = outboundMin * 2 + vehicle.turnaroundMinutes;

  // Distribute trips across fleet
  const baseTrips = Math.floor(totalTripsNeeded / fleetSize);
  const extraTrips = totalTripsNeeded % fleetSize;

  const vehicles: VehicleState[] = [];
  let totalDeliveries = 0;

  for (let i = 0; i < fleetSize; i++) {
    const maxTrips = baseTrips + (i < extraTrips ? 1 : 0);
    const vs = getVehicleStateAtTime(i, simMinutes, outboundMin, roundTripMin, unloadMin, maxTrips);
    vehicles.push(vs);

    // Count completed deliveries for this vehicle
    let delivered = vs.tripNumber;
    if (vs.direction === 'unloading' || vs.direction === 'returning' || vs.direction === 'loading' || vs.direction === 'done') {
      if (vs.direction !== 'done') delivered = vs.tripNumber + 1;
      else delivered = vs.tripNumber;
    }
    // Adjust: outbound trips that haven't arrived yet don't count
    if (vs.direction === 'outbound') delivered = vs.tripNumber;
    totalDeliveries += Math.min(delivered, maxTrips);
  }

  const effectiveTrips = Math.min(totalDeliveries, totalTripsNeeded);
  const peopleDelivered = Math.min(effectiveTrips * vehicle.capacity, peopleToTransport);
  const totalCost = effectiveTrips * vehicle.costPerTrip + (vehicle.infrastructureCost ?? 0);
  const totalCO2 = effectiveTrips * vehicle.co2PerTrip;

  return {
    vehicles,
    peopleDelivered,
    peopleRemaining: peopleToTransport - peopleDelivered,
    totalCost,
    totalCO2,
    elapsedMinutes: simMinutes,
    tripsCompleted: effectiveTrips,
    totalTripsNeeded,
    isComplete: peopleDelivered >= peopleToTransport,
  };
}

function formatConstraintValue(value: number, type: string): string {
  if (type === 'budget') return `$${Math.round(value).toLocaleString()}`;
  if (type === 'time') {
    const hours = value / 60;
    return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(value)}m`;
  }
  if (type === 'co2') return `${Math.round(value)}kg`;
  return String(Math.round(value));
}

function constraintIcon(type: string): string {
  if (type === 'budget') return '💰';
  if (type === 'time') return '⏱️';
  if (type === 'co2') return '🌿';
  return '📊';
}

// ─── Phase Config ─────────────────────────────────────────────────────────────

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  single_constraint: { label: 'Basic', icon: '🚗', accentColor: 'emerald' },
  multi_constraint: { label: 'Trade-offs', icon: '⚖️', accentColor: 'blue' },
  full_optimization: { label: 'Optimize', icon: '🎯', accentColor: 'purple' },
};

// ─── Component ────────────────────────────────────────────────────────────────

type ScenarioPhase = 'picking' | 'simulating' | 'results' | 'question' | 'answered';

interface TransportChallengeProps {
  data: TransportChallengeData;
  className?: string;
}

const TransportChallenge: React.FC<TransportChallengeProps> = ({ data, className }) => {
  const {
    title,
    description,
    scenarios = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `tc-${Date.now()}`;

  // ── Challenge Progress ────────────────────────────────────────────────────
  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allScenariosComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges: scenarios, getChallengeId: (s) => s.id });

  const phaseResults = usePhaseResults({
    challenges: scenarios,
    results: challengeResults,
    isComplete: allScenariosComplete,
    getChallengeType: (s) => s.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Evaluation ────────────────────────────────────────────────────────────
  const startTime = useRef(Date.now());
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  const { submitResult, hasSubmitted, elapsedMs } = usePrimitiveEvaluation<TransportChallengeMetrics>({
    primitiveType: 'transport-challenge' as any,
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  // ── AI Tutoring ───────────────────────────────────────────────────────────
  const currentScenario = scenarios[currentIndex];

  const { sendText } = useLuminaAI({
    primitiveType: 'transport-challenge' as any,
    instanceId: resolvedInstanceId,
    primitiveData: {
      currentScenario: currentScenario?.title,
      origin: currentScenario?.origin,
      destination: currentScenario?.destination,
      people: currentScenario?.peopleToTransport,
      constraints: currentScenario?.constraints?.map(c => `${c.type}: ${c.limit} ${c.unit}`).join(', '),
    },
    gradeLevel: 'K-5',
  });

  // ── Per-Scenario State ────────────────────────────────────────────────────
  const [scenarioPhase, setScenarioPhase] = useState<ScenarioPhase>('picking');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [simTime, setSimTime] = useState(0);
  const [questionAnswer, setQuestionAnswer] = useState<number | null>(null);
  const [questionAttempts, setQuestionAttempts] = useState(0);
  const simContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Measure container
  useEffect(() => {
    if (simContainerRef.current) {
      setContainerWidth(simContainerRef.current.offsetWidth);
    }
  }, [scenarioPhase]);

  // ── Derived State ─────────────────────────────────────────────────────────
  const selectedVehicle = useMemo(
    () => currentScenario?.vehicles.find(v => v.id === selectedVehicleId) ?? null,
    [currentScenario, selectedVehicleId],
  );

  const simSnapshot = useMemo(() => {
    if (!selectedVehicle || !currentScenario || simTime <= 0) return null;
    return computeSimSnapshot(simTime, currentScenario, selectedVehicle);
  }, [simTime, selectedVehicle, currentScenario]);

  const allOutcomes = useMemo(() => {
    if (!currentScenario) return [];
    return currentScenario.vehicles.map(v => ({
      ...computeVehicleOutcome(currentScenario, v),
      vehicle: v,
    }));
  }, [currentScenario]);

  const selectedOutcome = useMemo(
    () => allOutcomes.find(o => o.vehicleId === selectedVehicleId) ?? null,
    [allOutcomes, selectedVehicleId],
  );

  // Sim speed: target ~18 real seconds for the full simulation
  const estTotalMinutes = useMemo(() => {
    if (!selectedVehicle || !currentScenario) return 60;
    return computeVehicleOutcome(currentScenario, selectedVehicle).totalTimeMinutes;
  }, [selectedVehicle, currentScenario]);

  const simSpeedMultiplier = useMemo(
    () => Math.max(estTotalMinutes / TARGET_SIM_SECONDS, 1),
    [estTotalMinutes],
  );

  // ── Simulation Animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (scenarioPhase !== 'simulating') return;
    const t0 = Date.now();
    const interval = setInterval(() => {
      const realSeconds = (Date.now() - t0) / 1000;
      const simMin = realSeconds * simSpeedMultiplier;
      setSimTime(simMin);

      // Check if simulation is complete
      if (simMin >= estTotalMinutes * 1.15 || realSeconds > 30) {
        clearInterval(interval);
        setScenarioPhase('results');
        if (selectedVehicle && selectedOutcome) {
          const met = selectedOutcome.allConstraintsMet;
          sendText(
            `[SIMULATION_COMPLETE] Vehicle: ${selectedVehicle.name}. ` +
            `Trips: ${selectedOutcome.totalTrips}. ` +
            `All constraints met: ${met ? 'YES' : 'NO'}. ` +
            `${met ? 'Congratulate and ask why this worked.' : 'Ask what went wrong and what they notice about the numbers.'}`,
            { silent: true },
          );
        }
      }
    }, SIM_TICK_MS);
    return () => clearInterval(interval);
  }, [scenarioPhase, simSpeedMultiplier, estTotalMinutes, selectedVehicle, selectedOutcome, sendText]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePickVehicle = useCallback((vehicleId: string) => {
    if (scenarioPhase !== 'picking') return;
    setSelectedVehicleId(vehicleId);
  }, [scenarioPhase]);

  const handleStartSimulation = useCallback(() => {
    if (!selectedVehicle || !currentScenario) return;
    const totalTrips = Math.ceil(currentScenario.peopleToTransport / selectedVehicle.capacity);
    sendText(
      `[VEHICLE_SELECTED] Student chose ${selectedVehicle.name} (${selectedVehicle.emoji}, ` +
      `capacity ${selectedVehicle.capacity}) for ${currentScenario.peopleToTransport} people. ` +
      `That's ${totalTrips} trips needed. Ask them: "How many trips do you think that'll take?"`,
      { silent: true },
    );
    setSimTime(0);
    setScenarioPhase('simulating');
  }, [selectedVehicle, currentScenario, sendText]);

  const handleShowQuestion = useCallback(() => {
    setScenarioPhase('question');
  }, []);

  const handleSubmitAnswer = useCallback(() => {
    if (questionAnswer === null || !currentScenario) return;
    const correct = questionAnswer === currentScenario.tradeOffCorrectIndex;
    setQuestionAttempts(prev => prev + 1);

    if (correct) {
      setScenarioPhase('answered');
      sendText(
        `[ANSWER_CORRECT] Student answered the trade-off question correctly. Congratulate briefly.`,
        { silent: true },
      );
    } else if (questionAttempts >= 1) {
      // Second wrong attempt — show answer
      setScenarioPhase('answered');
      sendText(
        `[ANSWER_INCORRECT] Student answered wrong twice. The correct answer was ` +
        `"${currentScenario.tradeOffOptions[currentScenario.tradeOffCorrectIndex]}". ` +
        `Explain why gently.`,
        { silent: true },
      );
    } else {
      incrementAttempts();
      setQuestionAnswer(null);
      sendText(
        `[ANSWER_INCORRECT] Student chose "${currentScenario.tradeOffOptions[questionAnswer]}" ` +
        `but correct is "${currentScenario.tradeOffOptions[currentScenario.tradeOffCorrectIndex]}". ` +
        `Give a hint without revealing the answer.`,
        { silent: true },
      );
    }
  }, [questionAnswer, questionAttempts, currentScenario, incrementAttempts, sendText]);

  const handleNextScenario = useCallback(() => {
    if (!currentScenario || !selectedOutcome) return;

    // Score this scenario
    const vehicleScore = selectedVehicleId === currentScenario.bestVehicleId ? 60
      : currentScenario.acceptableVehicleIds.includes(selectedVehicleId!) ? 40
      : selectedOutcome.allConstraintsMet ? 25
      : 0;
    const questionScore = questionAnswer === currentScenario.tradeOffCorrectIndex ? 40
      : questionAttempts >= 2 ? 10 : 0;
    const score = vehicleScore + questionScore;

    recordResult({
      challengeId: currentScenario.id,
      correct: score >= 60,
      attempts: currentAttempts + 1,
      score,
      vehicleChosen: selectedVehicleId,
      constraintsMet: selectedOutcome.allConstraintsMet,
    });

    // Advance or finish
    if (!advanceProgress()) {
      // All scenarios complete
      const overallScore = Math.round(
        challengeResults.reduce((s, r) => s + ((r.score as number) ?? 0), score) /
        scenarios.length,
      );

      const durationMs = Date.now() - startTime.current;
      const vehicleAccuracy = challengeResults.filter(r => (r.score as number) >= 40).length / scenarios.length;
      const questionAcc = challengeResults.filter(r => r.correct).length / scenarios.length;

      submitResult(
        overallScore >= 60,
        overallScore,
        {
          type: 'transport-challenge',
          scenariosCompleted: scenarios.length,
          totalScenarios: scenarios.length,
          vehicleChoiceAccuracy: Math.round(vehicleAccuracy * 100),
          tradeOffAccuracy: Math.round(questionAcc * 100),
          averageConstraintsMet: Math.round(
            (challengeResults.filter(r => r.constraintsMet).length / scenarios.length) * 100,
          ),
        },
      );
      setSubmittedResult({ score: overallScore });

      const phaseScoreStr = phaseResults.map(p => `${p.label} ${p.score}% (${p.attempts} attempts)`).join(', ');
      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallScore}%. ` +
        `Give encouraging phase-specific feedback about transport planning skills.`,
        { silent: true },
      );
      return;
    }

    // Reset for next scenario
    setScenarioPhase('picking');
    setSelectedVehicleId(null);
    setSimTime(0);
    setQuestionAnswer(null);
    setQuestionAttempts(0);

    sendText(
      `[NEXT_ITEM] Moving to scenario ${currentIndex + 2} of ${scenarios.length}. Introduce it briefly.`,
      { silent: true },
    );
  }, [
    currentScenario, selectedVehicleId, selectedOutcome, questionAnswer, questionAttempts,
    currentAttempts, recordResult, advanceProgress, challengeResults, scenarios, submitResult,
    phaseResults, sendText, currentIndex,
  ]);

  // ── Early return ──────────────────────────────────────────────────────────
  if (!scenarios.length) {
    return (
      <Card className={cn('backdrop-blur-xl bg-slate-900/40 border-white/10', className)}>
        <CardContent className="p-6">
          <p className="text-slate-400">No transport scenarios available.</p>
        </CardContent>
      </Card>
    );
  }

  const scenario = currentScenario;
  const routeMargin = 80; // px from edges for origin/destination markers
  const routeWidth = containerWidth - routeMargin * 2;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className={cn('backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <Badge variant="outline" className="border-white/20 text-slate-300">
            {currentIndex + 1} / {scenarios.length}
          </Badge>
        </div>
        <p className="text-slate-400 text-sm">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Phase Summary (when complete) ──────────────────────────────── */}
        {allScenariosComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? 0}
            durationMs={Date.now() - startTime.current}
            heading="Transport Challenge Complete!"
            celebrationMessage="You've mastered transport planning!"
            className="mb-6"
          />
        )}

        {!allScenariosComplete && scenario && (
          <>
            {/* ── Scenario Header ──────────────────────────────────────── */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-white/5">
              <h3 className="text-slate-100 font-semibold text-lg mb-1">{scenario.title}</h3>
              <p className="text-slate-300 text-sm mb-3">
                Transport <span className="text-blue-300 font-bold">{scenario.peopleToTransport} people</span> from{' '}
                <span className="text-amber-300">{scenario.origin}</span> to{' '}
                <span className="text-emerald-300">{scenario.destination}</span>{' '}
                <span className="text-slate-500">({scenario.distanceKm} km)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {scenario.constraints.map(c => (
                  <Badge
                    key={c.type}
                    variant="outline"
                    className="border-white/15 text-slate-300 text-xs"
                  >
                    {constraintIcon(c.type)} {c.type}: {formatConstraintValue(c.limit, c.type)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* ── Vehicle Selector (picking phase) ─────────────────────── */}
            {scenarioPhase === 'picking' && (
              <div className="space-y-3">
                <h4 className="text-slate-300 text-sm font-medium">Choose your vehicle:</h4>
                <div className="grid grid-cols-2 gap-3">
                  {scenario.vehicles.map(v => {
                    const tripsNeeded = Math.ceil(scenario.peopleToTransport / v.capacity);
                    return (
                      <button
                        key={v.id}
                        onClick={() => handlePickVehicle(v.id)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          selectedVehicleId === v.id
                            ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400/30'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{v.emoji}</span>
                          <span className="text-slate-100 font-medium">{v.name}</span>
                        </div>
                        <div className="text-slate-400 text-xs space-y-0.5">
                          <div>{v.capacity} people/trip • {v.speedKmh} km/h</div>
                          <div>${v.costPerTrip}/trip • {v.co2PerTrip}kg CO₂/trip</div>
                          <div className="text-slate-500">{tripsNeeded} trip{tripsNeeded !== 1 ? 's' : ''} needed</div>
                          {v.requiresInfrastructure && (
                            <div className="text-amber-400/80">Requires {v.requiresInfrastructure}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedVehicleId && (
                  <Button
                    onClick={handleStartSimulation}
                    className="w-full bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200"
                  >
                    Start Transport →
                  </Button>
                )}
              </div>
            )}

            {/* ── Simulation View ──────────────────────────────────────── */}
            {(scenarioPhase === 'simulating' || scenarioPhase === 'results' || scenarioPhase === 'question' || scenarioPhase === 'answered') && selectedVehicle && (
              <div className="space-y-3">
                {/* Route Visualization */}
                <div
                  ref={simContainerRef}
                  className="relative h-44 bg-slate-950/60 rounded-lg border border-white/10 overflow-hidden"
                >
                  {/* Sky gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-800/20 to-slate-950/40" />

                  {/* Route line */}
                  <div
                    className="absolute top-1/2 h-1 rounded-full bg-gradient-to-r from-amber-500/40 via-slate-500/20 to-emerald-500/40"
                    style={{ left: routeMargin, right: routeMargin }}
                  />
                  {/* Lane divider */}
                  <div
                    className="absolute h-px bg-white/10"
                    style={{ left: routeMargin, right: routeMargin, top: 'calc(50% + 6px)' }}
                  />

                  {/* Origin */}
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 text-center" style={{ width: routeMargin - 8 }}>
                    <div className="text-xl">🏙️</div>
                    <div className="text-[10px] text-amber-300 font-medium truncate">{scenario.origin}</div>
                    <div className="text-base font-bold text-slate-100">
                      {simSnapshot ? simSnapshot.peopleRemaining : scenario.peopleToTransport}
                    </div>
                    <div className="text-[10px] text-slate-500">waiting</div>
                  </div>

                  {/* Destination */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 text-center" style={{ width: routeMargin - 8 }}>
                    <div className="text-xl">🏙️</div>
                    <div className="text-[10px] text-emerald-300 font-medium truncate">{scenario.destination}</div>
                    <div className="text-base font-bold text-slate-100">
                      {simSnapshot ? simSnapshot.peopleDelivered : 0}
                    </div>
                    <div className="text-[10px] text-slate-500">arrived</div>
                  </div>

                  {/* Animated Vehicles */}
                  {simSnapshot?.vehicles.map((vs, i) => {
                    if (vs.direction === 'waiting' || vs.direction === 'done') return null;
                    const x = routeMargin + vs.progress * routeWidth;
                    const isOutbound = vs.direction === 'outbound' || vs.direction === 'unloading';
                    const y = isOutbound ? '36%' : '62%';
                    return (
                      <div
                        key={i}
                        className="absolute transition-all duration-75 ease-linear"
                        style={{
                          left: `${x}px`,
                          top: y,
                          transform: `translateX(-50%) translateY(-50%) ${isOutbound ? '' : 'scaleX(-1)'}`,
                          opacity: vs.direction === 'unloading' || vs.direction === 'loading' ? 0.6 : 1,
                        }}
                      >
                        <span className="text-lg drop-shadow-lg select-none">{selectedVehicle.emoji}</span>
                      </div>
                    );
                  })}

                  {/* Trip counter */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full">
                    {simSnapshot
                      ? `Trip ${simSnapshot.tripsCompleted} of ${simSnapshot.totalTripsNeeded}`
                      : 'Starting...'}
                  </div>

                  {/* Simulation status badge */}
                  {scenarioPhase === 'simulating' && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-blue-500/20 border-blue-400/30 text-blue-300 text-xs animate-pulse">
                        Transporting...
                      </Badge>
                    </div>
                  )}
                  {scenarioPhase !== 'simulating' && (
                    <div className="absolute top-2 right-2">
                      <Badge className={cn(
                        'text-xs',
                        selectedOutcome?.allConstraintsMet
                          ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                          : 'bg-red-500/20 border-red-400/30 text-red-300',
                      )}>
                        {selectedOutcome?.allConstraintsMet ? '✅ All constraints met' : '❌ Constraint violated'}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Constraint Bars */}
                <div className="space-y-1.5">
                  {scenario.constraints.map(c => {
                    const finalOutcome = selectedOutcome;
                    const finalValue = finalOutcome?.constraintResults.find(r => r.type === c.type)?.actual ?? 0;
                    // During simulation, interpolate; after, show final
                    const currentValue = scenarioPhase === 'simulating'
                      ? (simSnapshot
                        ? c.type === 'budget' ? simSnapshot.totalCost
                        : c.type === 'time' ? simSnapshot.elapsedMinutes
                        : simSnapshot.totalCO2
                        : 0)
                      : finalValue;
                    const pct = Math.min((currentValue / c.limit) * 100, 130);
                    const exceeded = currentValue > c.limit;

                    return (
                      <div key={c.type} className="flex items-center gap-2">
                        <span className="text-xs w-5">{constraintIcon(c.type)}</span>
                        <span className="text-xs text-slate-400 w-12 capitalize">{c.type}</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-100',
                              exceeded ? 'bg-red-500 animate-pulse' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500',
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={cn('text-xs w-28 text-right tabular-nums', exceeded ? 'text-red-400' : 'text-slate-300')}>
                          {formatConstraintValue(currentValue, c.type)} / {formatConstraintValue(c.limit, c.type)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Results: Comparison Table */}
                {(scenarioPhase === 'results' || scenarioPhase === 'question' || scenarioPhase === 'answered') && (
                  <div className="space-y-3">
                    <h4 className="text-slate-300 text-sm font-medium">How all vehicles compare:</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 border-b border-white/10 text-xs">
                            <th className="text-left py-1.5 pr-2">Vehicle</th>
                            <th className="text-right py-1.5 px-2">Trips</th>
                            <th className="text-right py-1.5 px-2">Time</th>
                            <th className="text-right py-1.5 px-2">Cost</th>
                            <th className="text-right py-1.5 px-2">CO₂</th>
                            <th className="text-center py-1.5 pl-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allOutcomes.map(o => (
                            <tr
                              key={o.vehicleId}
                              className={cn(
                                'border-b border-white/5 text-xs',
                                o.vehicleId === selectedVehicleId && 'bg-blue-500/10',
                                o.vehicleId === scenario.bestVehicleId && scenarioPhase === 'answered' && 'bg-emerald-500/5',
                              )}
                            >
                              <td className="py-1.5 pr-2 text-slate-200">
                                {o.vehicle.emoji} {o.vehicle.name}
                                {o.vehicleId === selectedVehicleId && (
                                  <span className="text-blue-400 ml-1">← your pick</span>
                                )}
                              </td>
                              <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">{o.totalTrips}</td>
                              <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">
                                {formatConstraintValue(o.totalTimeMinutes, 'time')}
                              </td>
                              <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">
                                {formatConstraintValue(o.totalCost, 'budget')}
                              </td>
                              <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">
                                {formatConstraintValue(o.totalCO2, 'co2')}
                              </td>
                              <td className="text-center py-1.5 pl-2">
                                {o.allConstraintsMet ? '✅' : '❌'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {scenarioPhase === 'results' && (
                      <Button
                        onClick={handleShowQuestion}
                        className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      >
                        Answer Trade-off Question →
                      </Button>
                    )}
                  </div>
                )}

                {/* Trade-off Question */}
                {(scenarioPhase === 'question' || scenarioPhase === 'answered') && (
                  <div className="p-4 rounded-lg bg-slate-800/40 border border-white/5 space-y-3">
                    <p className="text-slate-100 font-medium text-sm">{scenario.tradeOffQuestion}</p>
                    <div className="space-y-2">
                      {scenario.tradeOffOptions.map((opt, i) => {
                        const isSelected = questionAnswer === i;
                        const isCorrect = i === scenario.tradeOffCorrectIndex;
                        const showFeedback = scenarioPhase === 'answered';
                        return (
                          <button
                            key={i}
                            onClick={() => scenarioPhase === 'question' && setQuestionAnswer(i)}
                            disabled={scenarioPhase === 'answered'}
                            className={cn(
                              'w-full text-left p-2.5 rounded-lg border transition-all text-sm',
                              showFeedback
                                ? isCorrect
                                  ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                                  : isSelected
                                    ? 'border-red-400/50 bg-red-500/10 text-red-200'
                                    : 'border-white/5 bg-white/2 text-slate-500'
                                : isSelected
                                  ? 'border-blue-400 bg-blue-500/10 text-slate-100'
                                  : 'border-white/10 bg-white/5 hover:border-white/20 text-slate-300',
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {scenarioPhase === 'question' && questionAnswer !== null && (
                      <Button
                        onClick={handleSubmitAnswer}
                        className="w-full bg-blue-500/20 border border-blue-400/30 hover:bg-blue-500/30 text-blue-200"
                      >
                        Submit Answer
                      </Button>
                    )}

                    {scenarioPhase === 'answered' && (
                      <>
                        <div className={cn(
                          'p-3 rounded-lg border text-sm',
                          questionAnswer === scenario.tradeOffCorrectIndex
                            ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-200'
                            : 'border-amber-400/20 bg-amber-500/5 text-amber-200',
                        )}>
                          {scenario.explanation}
                        </div>
                        <Button
                          onClick={handleNextScenario}
                          className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                        >
                          {currentIndex < scenarios.length - 1 ? 'Next Scenario →' : 'See Results'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TransportChallenge;
