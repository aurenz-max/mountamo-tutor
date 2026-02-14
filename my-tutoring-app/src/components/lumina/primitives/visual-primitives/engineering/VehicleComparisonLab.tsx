'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { BarChart3, Car, Plane, Ship, Zap, Trophy, Lightbulb, ChevronRight } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * VehicleComparisonLab - Data-driven vehicle comparison workspace
 *
 * K-5 Engineering Primitive for understanding:
 * - Side-by-side vehicle metrics (K-2)
 * - Reading comparison charts (1-3)
 * - Trade-off analysis across dimensions (3-5)
 * - Data-driven decision making (4-5)
 *
 * Real-world connections: airplanes, trains, cars, ships, bicycles, spacecraft
 */

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface VehicleMetric {
  value: number;
  unit: string;
  display: string;
}

export interface ComparisonVehicle {
  id: string;
  name: string;
  category: 'air' | 'land' | 'sea';
  imagePrompt: string;
  metrics: {
    topSpeed: VehicleMetric;
    weight: VehicleMetric;
    passengerCapacity: VehicleMetric;
    range: VehicleMetric;
    fuelType: string;
    yearIntroduced: number;
    costPerTrip: string | null;
    co2PerPassengerKm: number | null;
  };
  funFact: string;
}

export interface ComparisonChallenge {
  scenario: string;
  constraints: {
    passengers: number;
    distance: number;
    maxTime: string | null;
  };
  bestVehicleId: string;
  explanation: string;
  acceptableAlternatives: string[];
}

export interface SurprisingFact {
  fact: string;
  vehicleIds: string[];
}

export interface VehicleComparisonLabData {
  title: string;
  instructions: string;
  vehicles: ComparisonVehicle[];
  comparisonMetrics: string[];
  chartType: 'bar' | 'radar' | 'scatter' | 'table';
  challenges: ComparisonChallenge[];
  surprisingFacts: SurprisingFact[];
  gradeBand: 'K-2' | '3-5';
  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VehicleComparisonLabProps {
  data: VehicleComparisonLabData;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  air: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-400/30' },
  land: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-400/30' },
  sea: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-400/30' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  air: <Plane className="w-4 h-4" />,
  land: <Car className="w-4 h-4" />,
  sea: <Ship className="w-4 h-4" />,
};

const METRIC_LABELS: Record<string, string> = {
  topSpeed: 'Top Speed',
  weight: 'Weight',
  passengerCapacity: 'Passengers',
  range: 'Range',
  yearIntroduced: 'Year Introduced',
  co2PerPassengerKm: 'CO₂ per Passenger-km',
};

// ─── Component ────────────────────────────────────────────────────────────────

const VehicleComparisonLab: React.FC<VehicleComparisonLabProps> = ({ data, className }) => {
  const { title, instructions, vehicles, comparisonMetrics, challenges, surprisingFacts, gradeBand } = data;

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(() =>
    vehicles.length >= 2 ? [vehicles[0].id, vehicles[1].id] : vehicles.map(v => v.id)
  );
  const [activeMetrics, setActiveMetrics] = useState<string[]>(comparisonMetrics.slice(0, 3));
  const [phase, setPhase] = useState<'select' | 'compare' | 'challenge'>('select');
  const [activeChallengeIdx, setActiveChallengeIdx] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState<string | null>(null);
  const [challengeResults, setChallengeResults] = useState<boolean[]>([]);
  const [discoveredFacts, setDiscoveredFacts] = useState<Set<number>>(new Set());
  const [comparisonPairs, setComparisonPairs] = useState<Set<string>>(new Set());
  const [chartTypesUsed, setChartTypesUsed] = useState<Set<string>>(new Set(['bar']));
  const [currentChartType, setCurrentChartType] = useState<'bar' | 'table'>(data.chartType === 'table' ? 'table' : 'bar');

  // ── Evaluation ────────────────────────────────────────────────────────────
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'vehicle-comparison-lab' as any,
    instanceId: data.instanceId || 'vehicle-comparison-lab-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── AI Tutoring ───────────────────────────────────────────────────────────
  const selectedVehicles = useMemo(
    () => vehicles.filter(v => selectedVehicleIds.includes(v.id)),
    [vehicles, selectedVehicleIds]
  );

  const { sendText } = useLuminaAI({
    primitiveType: 'vehicle-comparison-lab' as any,
    instanceId: data.instanceId || `vcl-${Date.now()}`,
    primitiveData: {
      selectedVehicles: selectedVehicles.map(v => v.name).join(', '),
      activeMetrics: activeMetrics.join(', '),
      phase,
      challengeActive: phase === 'challenge',
      currentChallenge: phase === 'challenge' ? challenges[activeChallengeIdx]?.scenario : null,
    },
    gradeLevel: gradeBand === 'K-2' ? 'kindergarten' : 'elementary',
  });

  // ── Track comparison pairs ────────────────────────────────────────────────
  const trackComparisonPair = useCallback((ids: string[]) => {
    if (ids.length >= 2) {
      const sorted = [...ids].sort();
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          setComparisonPairs(prev => {
            const next = new Set(prev);
            next.add(`${sorted[i]}-${sorted[j]}`);
            return next;
          });
        }
      }
    }
  }, []);

  // ── Vehicle Selection ─────────────────────────────────────────────────────
  const toggleVehicle = useCallback((vehicleId: string) => {
    setSelectedVehicleIds(prev => {
      if (prev.includes(vehicleId)) {
        if (prev.length <= 2) return prev; // Keep at least 2
        return prev.filter(id => id !== vehicleId);
      }
      if (prev.length >= 4) return prev; // Max 4
      const next = [...prev, vehicleId];
      trackComparisonPair(next);
      return next;
    });
  }, [trackComparisonPair]);

  // ── Metric Helpers ────────────────────────────────────────────────────────
  const getMetricValue = (vehicle: ComparisonVehicle, metric: string): number => {
    const m = vehicle.metrics;
    switch (metric) {
      case 'topSpeed': return m.topSpeed.value;
      case 'weight': return m.weight.value;
      case 'passengerCapacity': return m.passengerCapacity.value;
      case 'range': return m.range.value;
      case 'yearIntroduced': return m.yearIntroduced;
      case 'co2PerPassengerKm': return m.co2PerPassengerKm ?? 0;
      default: return 0;
    }
  };

  const getMetricDisplay = (vehicle: ComparisonVehicle, metric: string): string => {
    const m = vehicle.metrics;
    switch (metric) {
      case 'topSpeed': return m.topSpeed.display;
      case 'weight': return m.weight.display;
      case 'passengerCapacity': return m.passengerCapacity.display;
      case 'range': return m.range.display;
      case 'yearIntroduced': return String(m.yearIntroduced);
      case 'co2PerPassengerKm': return m.co2PerPassengerKm != null ? `${m.co2PerPassengerKm} g/km` : 'N/A';
      default: return 'N/A';
    }
  };

  const getMaxForMetric = (metric: string): number => {
    return Math.max(...selectedVehicles.map(v => getMetricValue(v, metric)), 1);
  };

  // ── Challenge Logic ───────────────────────────────────────────────────────
  const handleChallengeSubmit = useCallback((vehicleId: string) => {
    const challenge = challenges[activeChallengeIdx];
    if (!challenge) return;

    const isCorrect = vehicleId === challenge.bestVehicleId || challenge.acceptableAlternatives.includes(vehicleId);
    setChallengeAnswer(vehicleId);
    setChallengeResults(prev => [...prev, isCorrect]);

    if (isCorrect) {
      sendText?.(
        `[CHALLENGE_COMPLETED] Student correctly chose "${vehicles.find(v => v.id === vehicleId)?.name}" for: "${challenge.scenario}". Celebrate their data-driven reasoning!`,
        { silent: true }
      );
    } else {
      sendText?.(
        `[CHALLENGE_INCORRECT] Student chose "${vehicles.find(v => v.id === vehicleId)?.name}" but the best choice was "${vehicles.find(v => v.id === challenge.bestVehicleId)?.name}" for: "${challenge.scenario}". Explain why gently, using the data.`,
        { silent: true }
      );
    }
  }, [activeChallengeIdx, challenges, vehicles, sendText]);

  const nextChallenge = useCallback(() => {
    setChallengeAnswer(null);
    if (activeChallengeIdx < challenges.length - 1) {
      setActiveChallengeIdx(prev => prev + 1);
    } else {
      // All challenges done — submit evaluation
      if (!hasSubmitted) {
        submitResult(
          challengeResults.filter(Boolean).length > challengeResults.length / 2,
          Math.round((challengeResults.filter(Boolean).length / Math.max(challengeResults.length, 1)) * 100),
          {
            type: 'vehicle-comparison-lab' as any,
            vehiclesCompared: comparisonPairs.size,
            metricsExplored: activeMetrics,
            challengeAnswersCorrect: challengeResults.filter(Boolean).length,
            challengesTotal: challenges.length,
            challengeJustificationProvided: false,
            chartTypesUsed: Array.from(chartTypesUsed),
            surprisingFactsDiscovered: discoveredFacts.size,
            surprisingFactsTotal: surprisingFacts.length,
            attemptsCount: challengeResults.length,
          },
        );
      }
    }
  }, [activeChallengeIdx, challenges.length, hasSubmitted, submitResult, challengeResults, comparisonPairs.size, activeMetrics, chartTypesUsed, discoveredFacts.size, surprisingFacts.length]);

  // ── Discover surprising fact ──────────────────────────────────────────────
  const discoverFact = useCallback((idx: number) => {
    if (!discoveredFacts.has(idx)) {
      setDiscoveredFacts(prev => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      sendText?.(
        `[SURPRISING_FACT] Student discovered: "${surprisingFacts[idx]?.fact}". React with enthusiasm and connect to the comparison data!`,
        { silent: true }
      );
    }
  }, [discoveredFacts, surprisingFacts, sendText]);

  // ── Render: Vehicle Selector ──────────────────────────────────────────────
  const renderVehicleSelector = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {vehicles.map(vehicle => {
        const isSelected = selectedVehicleIds.includes(vehicle.id);
        const colors = CATEGORY_COLORS[vehicle.category];
        return (
          <button
            key={vehicle.id}
            onClick={() => toggleVehicle(vehicle.id)}
            className={`
              relative p-3 rounded-xl border transition-all duration-200 text-left
              ${isSelected
                ? `${colors.bg} ${colors.border} border-2 ring-1 ring-white/10`
                : 'bg-white/5 border-white/10 hover:bg-white/10'
              }
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={colors.text}>{CATEGORY_ICONS[vehicle.category]}</span>
              <span className="text-xs text-slate-400 capitalize">{vehicle.category}</span>
            </div>
            <p className="text-sm font-medium text-slate-100 truncate">{vehicle.name}</p>
            {isSelected && (
              <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${colors.bg.replace('/20', '')}`} />
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Render: Bar Chart ─────────────────────────────────────────────────────
  const renderBarChart = () => (
    <div className="space-y-6">
      {activeMetrics.map(metric => {
        const maxVal = getMaxForMetric(metric);
        return (
          <div key={metric} className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300">{METRIC_LABELS[metric] || metric}</h4>
            <div className="space-y-2">
              {selectedVehicles.map(vehicle => {
                const val = getMetricValue(vehicle, metric);
                const pct = Math.max(5, (val / maxVal) * 100);
                const colors = CATEGORY_COLORS[vehicle.category];
                return (
                  <div key={vehicle.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-28 truncate">{vehicle.name}</span>
                    <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bg} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 w-24 text-right">{getMetricDisplay(vehicle, metric)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Render: Table View ────────────────────────────────────────────────────
  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-slate-400 pb-2 pr-4">Vehicle</th>
            {activeMetrics.map(m => (
              <th key={m} className="text-right text-slate-400 pb-2 px-2">{METRIC_LABELS[m] || m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {selectedVehicles.map(vehicle => (
            <tr key={vehicle.id} className="border-b border-white/5">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <span className={CATEGORY_COLORS[vehicle.category].text}>{CATEGORY_ICONS[vehicle.category]}</span>
                  <span className="text-slate-200">{vehicle.name}</span>
                </div>
              </td>
              {activeMetrics.map(m => (
                <td key={m} className="text-right text-slate-300 py-2 px-2">{getMetricDisplay(vehicle, m)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ── Render: Challenge Mode ────────────────────────────────────────────────
  const renderChallenge = () => {
    const challenge = challenges[activeChallengeIdx];
    if (!challenge) return null;

    return (
      <Card className="backdrop-blur-xl bg-amber-500/5 border-amber-400/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-base text-amber-200">
              Challenge {activeChallengeIdx + 1} of {challenges.length}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-200">{challenge.scenario}</p>

          {challenge.constraints.passengers > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {challenge.constraints.passengers} passengers
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {challenge.constraints.distance} km
              </Badge>
              {challenge.constraints.maxTime && (
                <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                  Max {challenge.constraints.maxTime}
                </Badge>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {vehicles.map(vehicle => (
              <Button
                key={vehicle.id}
                variant="ghost"
                disabled={challengeAnswer !== null}
                onClick={() => handleChallengeSubmit(vehicle.id)}
                className={`
                  bg-white/5 border border-white/20 hover:bg-white/10 h-auto py-3 px-3
                  ${challengeAnswer === vehicle.id
                    ? (vehicle.id === challenge.bestVehicleId || challenge.acceptableAlternatives.includes(vehicle.id))
                      ? 'ring-2 ring-green-400 bg-green-500/10'
                      : 'ring-2 ring-red-400 bg-red-500/10'
                    : challengeAnswer !== null && (vehicle.id === challenge.bestVehicleId)
                      ? 'ring-2 ring-green-400/50 bg-green-500/5'
                      : ''
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className={CATEGORY_COLORS[vehicle.category].text}>{CATEGORY_ICONS[vehicle.category]}</span>
                  <span className="text-slate-200 text-sm">{vehicle.name}</span>
                </div>
              </Button>
            ))}
          </div>

          {challengeAnswer && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-slate-300">{challenge.explanation}</p>
              <Button
                variant="ghost"
                onClick={nextChallenge}
                className="mt-3 bg-white/5 border border-white/20 hover:bg-white/10"
              >
                {activeChallengeIdx < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <SpotlightCard
      className={`w-full ${className || ''}`}
      color="14, 165, 233"
    >
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
                <p className="text-sm text-slate-400 mt-0.5">{instructions}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400">
              {gradeBand}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Phase Navigation */}
          <div className="flex gap-2">
            {(['select', 'compare', 'challenge'] as const).map(p => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhase(p);
                  if (p === 'compare') trackComparisonPair(selectedVehicleIds);
                  if (p === 'challenge') {
                    sendText?.('[CHALLENGE_STARTED] Student entered challenge mode. Introduce the first scenario!', { silent: true });
                  }
                }}
                className={`capitalize ${phase === p ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
              >
                {p === 'select' ? '1. Select' : p === 'compare' ? '2. Compare' : '3. Challenge'}
              </Button>
            ))}
          </div>

          {/* Vehicle Selector */}
          {phase === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Choose 2-4 vehicles to compare:</p>
              {renderVehicleSelector()}
              {selectedVehicleIds.length >= 2 && (
                <Button
                  variant="ghost"
                  onClick={() => { setPhase('compare'); trackComparisonPair(selectedVehicleIds); }}
                  className="bg-white/5 border border-white/20 hover:bg-white/10"
                >
                  Compare Selected <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}

          {/* Comparison View */}
          {phase === 'compare' && (
            <div className="space-y-6">
              {/* Metric toggles */}
              <div className="flex flex-wrap gap-2">
                {comparisonMetrics.map(m => (
                  <Button
                    key={m}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveMetrics(prev =>
                      prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]
                    )}
                    className={`text-xs ${activeMetrics.includes(m) ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
                  >
                    {METRIC_LABELS[m] || m}
                  </Button>
                ))}
              </div>

              {/* Chart type toggle */}
              <div className="flex gap-2">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setCurrentChartType('bar'); setChartTypesUsed(prev => new Set(prev).add('bar')); }}
                  className={`text-xs ${currentChartType === 'bar' ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
                >
                  Bar Chart
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setCurrentChartType('table'); setChartTypesUsed(prev => new Set(prev).add('table')); }}
                  className={`text-xs ${currentChartType === 'table' ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
                >
                  Table
                </Button>
              </div>

              {/* Chart */}
              {currentChartType === 'bar' ? renderBarChart() : renderTable()}

              {/* Fun facts for selected vehicles */}
              <div className="space-y-2">
                {selectedVehicles.map(v => (
                  <div key={v.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-slate-300">{v.name}:</span>
                      <span className="text-xs text-slate-400 ml-1">{v.funFact}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Surprising Facts */}
              {surprisingFacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" /> Surprising Facts
                  </h4>
                  {surprisingFacts.map((sf, idx) => (
                    <button
                      key={idx}
                      onClick={() => discoverFact(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        discoveredFacts.has(idx)
                          ? 'bg-yellow-500/5 border-yellow-400/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {discoveredFacts.has(idx) ? (
                        <p className="text-sm text-yellow-200">{sf.fact}</p>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Tap to discover...</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  setPhase('challenge');
                  sendText?.('[CHALLENGE_STARTED] Student entered challenge mode. Introduce the first scenario!', { silent: true });
                }}
                className="bg-white/5 border border-white/20 hover:bg-white/10"
              >
                Try Challenges <Trophy className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Challenge Phase */}
          {phase === 'challenge' && renderChallenge()}
        </CardContent>
      </Card>
    </SpotlightCard>
  );
};

export default VehicleComparisonLab;
