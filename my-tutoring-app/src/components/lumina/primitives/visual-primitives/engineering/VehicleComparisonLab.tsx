'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  Gauge,
  GripVertical,
  Image as ImageIcon,
  Leaf,
  Lightbulb,
  Loader2,
  Play,
  Route,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaChoiceChip,
  LuminaDropZone,
  LuminaFeedbackCard,
  LuminaModeTabs,
  LuminaPanel,
  LuminaPrompt,
  LuminaReadAloud,
  type AnswerChoiceState,
  type DropZoneState,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type {
  PrimitiveEvaluationResult,
  VehicleComparisonLabMetrics,
} from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { ReadMeButton } from '../../shared/ReadMeButton';
import { SoundManager } from '../../../utils/SoundManager';
import {
  resolveVehicleVisualKind,
  type VehicleVisualCategory,
  type VehicleVisualKind,
} from './vehicleVisualKind';

// -----------------------------------------------------------------------------
// Data contract
// -----------------------------------------------------------------------------

export type VehicleCategory = VehicleVisualCategory;
export type ComparisonMetricKey =
  | 'topSpeed'
  | 'weight'
  | 'passengerCapacity'
  | 'range'
  | 'yearIntroduced'
  | 'co2PerPassengerKm';
export type ComparisonChallengeType = 'metric_leader' | 'evidence_choice' | 'constraint_tradeoff';

export interface VehicleMetric {
  value: number;
  unit: string;
  display: string;
}

export interface ComparisonVehicle {
  id: string;
  name: string;
  category: VehicleCategory;
  visualKind?: VehicleVisualKind;
  imagePrompt: string;
  imageUrl?: string | null;
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
  id: string;
  type: ComparisonChallengeType;
  scenario: string;
  origin?: string | null;
  destination?: string | null;
  constraints: {
    passengers: number;
    distance: number;
    maxTime: string | null;
    priority?: 'speed' | 'capacity' | 'range' | 'weight' | 'environment';
  };
  bestVehicleId: string;
  acceptableAlternatives: string[];
  bestEvidenceMetric: ComparisonMetricKey;
  acceptableEvidenceMetrics: ComparisonMetricKey[];
  explanation: string;
}

export interface SurprisingFact {
  fact: string;
  vehicleIds: string[];
}

export interface VehicleComparisonLabData {
  title: string;
  instructions: string;
  topicFocus: string;
  vehicles: ComparisonVehicle[];
  comparisonMetrics: ComparisonMetricKey[];
  chartType: 'bar' | 'radar' | 'scatter' | 'table';
  challengeType: ComparisonChallengeType;
  challenges: ComparisonChallenge[];
  surprisingFacts: SurprisingFact[];
  gradeBand: 'K-2' | '3-5';
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult<VehicleComparisonLabMetrics>,
  ) => void;
}

interface VehicleComparisonLabProps {
  data: VehicleComparisonLabData;
  className?: string;
}

// -----------------------------------------------------------------------------
// Visual language and metric helpers
// -----------------------------------------------------------------------------

const CATEGORY_STYLE: Record<VehicleCategory, {
  label: string;
  accent: string;
  border: string;
  soft: string;
  gradient: string;
}> = {
  air: {
    label: 'Air', accent: 'text-sky-300', border: 'border-sky-400/35',
    soft: 'bg-sky-500/15', gradient: 'from-sky-500/20 via-blue-500/5 to-transparent',
  },
  land: {
    label: 'Land', accent: 'text-amber-300', border: 'border-amber-400/35',
    soft: 'bg-amber-500/15', gradient: 'from-amber-500/20 via-orange-500/5 to-transparent',
  },
  sea: {
    label: 'Water', accent: 'text-cyan-300', border: 'border-cyan-400/35',
    soft: 'bg-cyan-500/15', gradient: 'from-cyan-500/20 via-blue-500/5 to-transparent',
  },
  space: {
    label: 'Space', accent: 'text-violet-300', border: 'border-violet-400/35',
    soft: 'bg-violet-500/15', gradient: 'from-violet-500/20 via-fuchsia-500/5 to-transparent',
  },
};

const METRIC_META: Record<ComparisonMetricKey, {
  label: string;
  shortLabel: string;
  prompt: string;
  accent: 'cyan' | 'amber' | 'emerald' | 'purple' | 'blue' | 'rose';
  icon: React.ReactNode;
  lowerWins?: boolean;
}> = {
  topSpeed: {
    label: 'Top speed', shortLabel: 'Speed', prompt: 'Which vehicle can move fastest?',
    accent: 'cyan', icon: <Gauge className="h-4 w-4" />,
  },
  weight: {
    label: 'Weight', shortLabel: 'Weight', prompt: 'Which vehicle is heaviest?',
    accent: 'amber', icon: <Scale className="h-4 w-4" />,
  },
  passengerCapacity: {
    label: 'Passenger capacity', shortLabel: 'Capacity', prompt: 'Which vehicle carries the most people?',
    accent: 'purple', icon: <Users className="h-4 w-4" />,
  },
  range: {
    label: 'Travel range', shortLabel: 'Range', prompt: 'Which vehicle can travel farthest?',
    accent: 'blue', icon: <Route className="h-4 w-4" />,
  },
  yearIntroduced: {
    label: 'Year introduced', shortLabel: 'Newest', prompt: 'Which vehicle was introduced most recently?',
    accent: 'rose', icon: <Sparkles className="h-4 w-4" />,
  },
  co2PerPassengerKm: {
    label: 'CO₂ per passenger-km', shortLabel: 'CO₂', prompt: 'Which available vehicle has the lowest CO₂ value?',
    accent: 'emerald', icon: <Leaf className="h-4 w-4" />, lowerWins: true,
  },
};

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  metric_leader: { label: 'Metric leaders', icon: '📊', accentColor: 'blue' },
  evidence_choice: { label: 'Evidence missions', icon: '🧭', accentColor: 'cyan' },
  constraint_tradeoff: { label: 'Constraint trade-offs', icon: '⚖️', accentColor: 'purple' },
};

function metricValue(vehicle: ComparisonVehicle, metric: ComparisonMetricKey): number | null {
  if (metric === 'yearIntroduced') return vehicle.metrics.yearIntroduced;
  if (metric === 'co2PerPassengerKm') return vehicle.metrics.co2PerPassengerKm;
  return vehicle.metrics[metric].value;
}

function metricDisplay(vehicle: ComparisonVehicle, metric: ComparisonMetricKey): string {
  if (metric === 'yearIntroduced') return String(vehicle.metrics.yearIntroduced);
  if (metric === 'co2PerPassengerKm') {
    const value = vehicle.metrics.co2PerPassengerKm;
    return value == null ? 'Not available' : `${value} g CO₂/pkm`;
  }
  return vehicle.metrics[metric].display;
}

function bestForMetric(
  vehicles: ComparisonVehicle[],
  metric: ComparisonMetricKey,
): ComparisonVehicle | null {
  const available = vehicles.filter((vehicle) => metricValue(vehicle, metric) != null);
  if (available.length === 0) return null;
  const lowerWins = !!METRIC_META[metric].lowerWins;
  return available.reduce((best, vehicle) => {
    const bestValue = metricValue(best, metric) ?? 0;
    const value = metricValue(vehicle, metric) ?? 0;
    return lowerWins ? (value < bestValue ? vehicle : best) : (value > bestValue ? vehicle : best);
  });
}

function comparisonPairs(ids: string[]): string[] {
  const sorted = [...ids].sort();
  const pairs: string[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) pairs.push(`${sorted[i]}::${sorted[j]}`);
  }
  return pairs;
}

// Immediate vector art makes the lab visual before optional generated imagery
// finishes. Specific vehicle classes stay distinct; unknown models receive an
// honest generic badge instead of a misleading category-level silhouette.
const VehicleDiagram: React.FC<{ vehicle: ComparisonVehicle; className?: string }> = ({ vehicle, className }) => {
  const visualKind = resolveVehicleVisualKind(vehicle);
  const diagramProps = {
    viewBox: '0 0 180 90',
    'aria-hidden': true,
    className,
    'data-vehicle-visual-kind': visualKind,
  } as const;

  if (visualKind === 'airplane') {
    return (
      <svg {...diagramProps}>
        <path d="M14 48 L75 42 L109 10 L124 10 L108 40 L157 37 Q170 38 174 45 Q170 52 157 53 L108 50 L124 80 L109 80 L75 54 L14 50 Z" fill="currentColor" opacity=".92" />
        <path d="M53 43 L37 25 L48 25 L72 43 M53 52 L37 69 L48 69 L72 53" fill="currentColor" opacity=".62" />
        <circle cx="139" cy="44" r="3" fill="rgb(15 23 42)" />
      </svg>
    );
  }
  if (visualKind === 'helicopter') {
    return (
      <svg {...diagramProps}>
        <path d="M39 51 Q43 31 69 29 H111 Q128 31 138 45 L160 49 V60 H52 Q39 59 39 51Z" fill="currentColor" opacity=".92" />
        <path d="M78 29 L91 15 M48 15 H135 M144 49 L157 30 H165 L160 51" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".68" />
        <path d="M63 67 H135" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".55" />
        <circle cx="70" cy="45" r="8" fill="rgb(15 23 42)" opacity=".8" />
      </svg>
    );
  }
  if (visualKind === 'ship' || visualKind === 'boat') {
    return (
      <svg {...diagramProps}>
        <path d="M17 54 H164 L148 73 H43 Q27 70 17 54Z" fill="currentColor" opacity=".92" />
        <path d="M49 51 V27 H119 V51 M64 27 V17 H103 V27" fill="currentColor" opacity=".68" />
        <path d="M23 78 Q38 70 53 78 T83 78 T113 78 T143 78 T173 78" fill="none" stroke="currentColor" strokeWidth="5" opacity=".35" />
        <rect x="58" y="32" width="15" height="9" rx="2" fill="rgb(15 23 42)" /><rect x="80" y="32" width="15" height="9" rx="2" fill="rgb(15 23 42)" />
      </svg>
    );
  }
  if (visualKind === 'submarine') {
    return (
      <svg {...diagramProps}>
        <path d="M19 51 Q33 31 72 31 H132 Q151 32 164 48 Q151 65 132 66 H72 Q33 66 19 51Z" fill="currentColor" opacity=".92" />
        <path d="M81 31 V18 H104 V31 M94 18 V10 H116" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity=".65" />
        <circle cx="66" cy="48" r="7" fill="rgb(15 23 42)" opacity=".82" /><circle cx="92" cy="48" r="7" fill="rgb(15 23 42)" opacity=".82" />
      </svg>
    );
  }
  if (visualKind === 'spacecraft') {
    return (
      <svg {...diagramProps}>
        <path d="M102 8 Q135 27 138 59 L111 52 L96 76 L81 52 L54 59 Q57 27 90 8Z" fill="currentColor" opacity=".92" />
        <circle cx="96" cy="30" r="10" fill="rgb(15 23 42)" opacity=".85" />
        <path d="M84 57 L74 83 L91 68 L96 88 L101 68 L118 83 L108 57" fill="currentColor" opacity=".4" />
        <circle cx="31" cy="20" r="2" fill="currentColor" /><circle cx="151" cy="22" r="3" fill="currentColor" opacity=".6" /><circle cx="154" cy="69" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (visualKind === 'bus') {
    return (
      <svg {...diagramProps}>
        <rect x="18" y="20" width="145" height="50" rx="9" fill="currentColor" opacity=".92" />
        <path d="M31 29 H135 V48 H31Z" fill="rgb(15 23 42)" opacity=".82" />
        <path d="M57 29 V48 M83 29 V48 M109 29 V48" stroke="currentColor" strokeWidth="4" opacity=".55" />
        <circle cx="48" cy="69" r="12" fill="rgb(15 23 42)" /><circle cx="135" cy="69" r="12" fill="rgb(15 23 42)" />
      </svg>
    );
  }
  if (visualKind === 'train') {
    return (
      <svg {...diagramProps}>
        <path d="M28 15 H137 Q153 15 153 32 V65 H28Z" fill="currentColor" opacity=".92" />
        <path d="M39 25 H74 V44 H39Z M84 25 H137 V44 H84Z" fill="rgb(15 23 42)" opacity=".82" />
        <path d="M19 72 H163 M38 81 H145" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".5" />
        <circle cx="54" cy="65" r="11" fill="rgb(15 23 42)" /><circle cx="126" cy="65" r="11" fill="rgb(15 23 42)" />
      </svg>
    );
  }
  if (visualKind === 'bicycle' || visualKind === 'motorcycle') {
    return (
      <svg {...diagramProps}>
        <circle cx="47" cy="63" r="21" fill="none" stroke="currentColor" strokeWidth="7" opacity=".9" />
        <circle cx="137" cy="63" r="21" fill="none" stroke="currentColor" strokeWidth="7" opacity=".9" />
        <path d="M47 63 L76 29 L98 63 L62 63 L86 43 L116 43 L137 63 M72 25 H90 M113 43 L107 27 H122" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".92" />
        {visualKind === 'motorcycle' && <path d="M75 35 Q96 23 116 43 H88Z" fill="currentColor" opacity=".55" />}
      </svg>
    );
  }
  if (visualKind === 'truck' || visualKind === 'construction') {
    return (
      <svg {...diagramProps}>
        <path d="M18 31 H104 V66 H18Z M104 43 H137 L160 61 V66 H104Z" fill="currentColor" opacity=".92" />
        <path d="M114 48 H135 L146 59 H114Z" fill="rgb(15 23 42)" opacity=".82" />
        {visualKind === 'construction' && <path d="M24 28 L69 11 L91 28Z" fill="currentColor" opacity=".55" />}
        <circle cx="50" cy="66" r="13" fill="rgb(15 23 42)" /><circle cx="132" cy="66" r="13" fill="rgb(15 23 42)" />
      </svg>
    );
  }
  if (visualKind === 'car') {
    return (
      <svg {...diagramProps}>
        <path d="M19 59 L31 38 Q35 30 46 30 H116 Q125 30 134 40 L151 44 Q162 46 166 58 V66 H19Z" fill="currentColor" opacity=".92" />
        <path d="M52 35 H83 V47 H38 L44 37 Q46 35 52 35Z M89 35 H114 Q120 35 126 44 L129 47 H89Z" fill="rgb(15 23 42)" opacity=".85" />
        <circle cx="52" cy="66" r="13" fill="rgb(15 23 42)" /><circle cx="52" cy="66" r="6" fill="currentColor" opacity=".65" />
        <circle cx="137" cy="66" r="13" fill="rgb(15 23 42)" /><circle cx="137" cy="66" r="6" fill="currentColor" opacity=".65" />
      </svg>
    );
  }
  return (
    <svg {...diagramProps}>
      <rect x="28" y="20" width="124" height="52" rx="18" fill="currentColor" opacity=".18" />
      <text x="90" y="54" textAnchor="middle" fill="currentColor" fontSize="17" fontWeight="700" letterSpacing="2">
        {vehicle.category.toUpperCase()}
      </text>
    </svg>
  );
};

const VehicleVisual: React.FC<{
  vehicle: ComparisonVehicle;
  imageUrl?: string | null;
  loading?: boolean;
}> = ({ vehicle, imageUrl, loading }) => {
  const style = CATEGORY_STYLE[vehicle.category];
  return (
    <div className={cn('relative h-28 overflow-hidden rounded-xl border bg-gradient-to-br', style.border, style.gradient)}>
      <div className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-slate-950/80 to-transparent" />
      {imageUrl ? (
        <img src={imageUrl} alt={vehicle.name} className="h-full w-full object-cover" />
      ) : (
        <div className={cn('flex h-full items-center justify-center px-4', style.accent)}>
          <VehicleDiagram vehicle={vehicle} className="h-20 w-full drop-shadow-2xl" />
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-cyan-300">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-[10px] font-semibold uppercase tracking-widest text-white/70">{style.label}</span>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const VehicleComparisonLab: React.FC<VehicleComparisonLabProps> = ({ data, className }) => {
  const { vehicles, comparisonMetrics, challenges, surprisingFacts, gradeBand } = data;
  const initialIds = useMemo(() => vehicles.slice(0, Math.min(3, vehicles.length)).map((v) => v.id), [vehicles]);
  const [view, setView] = useState<'compare' | 'missions'>('compare');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(initialIds);
  const [activeMetric, setActiveMetric] = useState<ComparisonMetricKey>(comparisonMetrics[0] ?? 'topSpeed');
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [comparisonRevealed, setComparisonRevealed] = useState(false);
  const [dragOverStage, setDragOverStage] = useState(false);
  const [metricsExplored, setMetricsExplored] = useState<Set<ComparisonMetricKey>>(new Set());
  const [pairsCompared, setPairsCompared] = useState<Set<string>>(new Set());
  const [predictionsMade, setPredictionsMade] = useState(0);
  const [predictionsCorrect, setPredictionsCorrect] = useState(0);
  const [discoveredFacts, setDiscoveredFacts] = useState<Set<number>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [loadingImageId, setLoadingImageId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [missionVehicleId, setMissionVehicleId] = useState<string | null>(null);
  const [missionEvidence, setMissionEvidence] = useState<ComparisonMetricKey | null>(null);
  const [missionSubmitted, setMissionSubmitted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [missionJustifications, setMissionJustifications] = useState(0);
  const recordedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const {
    currentIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (challenge) => challenge.id });

  const currentChallenge = challenges[currentIndex] ?? null;
  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (challenge) => challenge.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  const instanceId = data.instanceId || 'vehicle-comparison-lab-default';
  const { submitResult, hasSubmitted, submittedResult } = usePrimitiveEvaluation<VehicleComparisonLabMetrics>({
    primitiveType: 'vehicle-comparison-lab' as any,
    instanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  const selectedVehicles = useMemo(
    () => vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)),
    [vehicles, selectedVehicleIds],
  );
  const winner = useMemo(() => bestForMetric(selectedVehicles, activeMetric), [selectedVehicles, activeMetric]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'vehicle-comparison-lab' as any,
    instanceId,
    primitiveData: {
      topicFocus: data.topicFocus,
      selectedVehicles: selectedVehicles.map((vehicle) => vehicle.name).join(', '),
      activeMetric: METRIC_META[activeMetric].label,
      prediction: vehicles.find((vehicle) => vehicle.id === predictionId)?.name ?? null,
      comparisonRevealed,
      phase: view,
      currentChallenge: currentChallenge?.scenario ?? null,
      missionVehicle: vehicles.find((vehicle) => vehicle.id === missionVehicleId)?.name ?? null,
      missionEvidence: currentChallenge?.type === 'metric_leader'
        ? METRIC_META[currentChallenge.bestEvidenceMetric].label
        : missionEvidence ? METRIC_META[missionEvidence].label : null,
    },
    gradeLevel: gradeBand === 'K-2' ? 'kindergarten' : 'elementary',
  });

  const readBlockAloud = useCallback((text: string, tag: string) => {
    if (!text) return;
    SoundManager.tap();
    sendText?.(`${tag} The young learner tapped "read it to me". Read this aloud, word for word, in a warm voice: "${text}". Then wait.`);
  }, [sendText]);

  useEffect(() => setSelectedVehicleIds(initialIds), [initialIds]);
  useEffect(() => {
    setPredictionId(null);
    setComparisonRevealed(false);
  }, [activeMetric, selectedVehicleIds]);
  useEffect(() => {
    if (!comparisonMetrics.includes(activeMetric)) {
      setActiveMetric(comparisonMetrics[0] ?? 'topSpeed');
    }
  }, [activeMetric, comparisonMetrics]);
  useEffect(() => {
    setMissionVehicleId(null);
    setMissionEvidence(null);
    setMissionSubmitted(false);
    recordedRef.current = false;
  }, [currentChallenge?.id]);

  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted) return;
    const correct = challengeResults.filter((result) => result.correct).length;
    const score = Math.round((correct / Math.max(challenges.length, 1)) * 100);
    submitResult(correct > challenges.length / 2, score, {
      type: 'vehicle-comparison-lab',
      vehiclesCompared: pairsCompared.size,
      metricsExplored: Array.from(metricsExplored),
      challengeAnswersCorrect: correct,
      challengesTotal: challenges.length,
      challengeJustificationProvided: missionJustifications === challenges.length,
      chartTypesUsed: ['comparison-arena', 'mission-map'],
      surprisingFactsDiscovered: discoveredFacts.size,
      surprisingFactsTotal: surprisingFacts.length,
      attemptsCount: challengeResults.reduce((sum, result) => sum + result.attempts, 0),
      predictionsMade,
      predictionsCorrect,
    });
  }, [
    allChallengesComplete, challengeResults, challenges.length, discoveredFacts.size,
    hasSubmitted, metricsExplored, missionJustifications, pairsCompared.size, predictionsCorrect,
    predictionsMade, submitResult, surprisingFacts.length,
  ]);

  const addVehicleToStage = useCallback((vehicleId: string) => {
    setSelectedVehicleIds((previous) => {
      if (previous.includes(vehicleId) || previous.length >= 4) return previous;
      SoundManager.select();
      return [...previous, vehicleId];
    });
  }, []);

  const toggleVehicleOnStage = useCallback((vehicleId: string) => {
    setSelectedVehicleIds((previous) => {
      if (previous.includes(vehicleId)) {
        if (previous.length <= 2) return previous;
        SoundManager.toggle(false);
        return previous.filter((id) => id !== vehicleId);
      }
      if (previous.length >= 4) return previous;
      SoundManager.select();
      return [...previous, vehicleId];
    });
  }, []);

  const revealComparison = useCallback(() => {
    if (!predictionId || !winner) return;
    SoundManager.navigate();
    const correct = predictionId === winner.id;
    setComparisonRevealed(true);
    setMetricsExplored((previous) => new Set(previous).add(activeMetric));
    setPairsCompared((previous) => {
      const next = new Set(previous);
      comparisonPairs(selectedVehicleIds).forEach((pair) => next.add(pair));
      return next;
    });
    setPredictionsMade((count) => count + 1);
    if (correct) {
      setPredictionsCorrect((count) => count + 1);
      SoundManager.playCorrect();
    }
    sendText?.(
      `[COMPARISON_REVEALED] The student predicted "${vehicles.find((v) => v.id === predictionId)?.name}" for ${METRIC_META[activeMetric].label}. The data leader is "${winner.name}" (${metricDisplay(winner, activeMetric)}). ${correct ? 'Their prediction matched.' : 'Their prediction did not match.'} Ask what evidence they notice.`,
      { silent: true },
    );
  }, [activeMetric, predictionId, selectedVehicleIds, sendText, vehicles, winner]);

  const generateVehicleImage = useCallback(async (vehicle: ComparisonVehicle) => {
    if (!vehicle.imagePrompt || loadingImageId || generatedImages[vehicle.id]) return;
    SoundManager.tap();
    setLoadingImageId(vehicle.id);
    setImageErrors((previous) => {
      const next = new Set(previous);
      next.delete(vehicle.id);
      return next;
    });
    try {
      const response = await fetch('/api/lumina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateMachineImage', params: { imagePrompt: vehicle.imagePrompt } }),
      });
      if (!response.ok) throw new Error('Image generation request failed');
      const result = await response.json();
      if (!result.imageUrl) throw new Error('Image generation returned no image');
      setGeneratedImages((previous) => ({ ...previous, [vehicle.id]: result.imageUrl }));
    } catch (error) {
      console.error('[VehicleComparisonLab] Failed to generate vehicle image:', error);
      setImageErrors((previous) => new Set(previous).add(vehicle.id));
    } finally {
      setLoadingImageId(null);
    }
  }, [generatedImages, loadingImageId]);

  const submitMission = useCallback(() => {
    const chosenEvidence = currentChallenge?.type === 'metric_leader'
      ? currentChallenge.bestEvidenceMetric
      : missionEvidence;
    if (!currentChallenge || !missionVehicleId || !chosenEvidence || recordedRef.current) return;
    incrementAttempts();
    const vehicleCorrect = missionVehicleId === currentChallenge.bestVehicleId
      || currentChallenge.acceptableAlternatives.includes(missionVehicleId);
    const evidenceCorrect = currentChallenge.type === 'metric_leader'
      || chosenEvidence === currentChallenge.bestEvidenceMetric
      || currentChallenge.acceptableEvidenceMetrics.includes(chosenEvidence);
    const correct = vehicleCorrect && evidenceCorrect;
    recordedRef.current = true;
    setMissionSubmitted(true);
    if (currentChallenge.type !== 'metric_leader') {
      setMissionJustifications((count) => count + 1);
    }
    recordResult({
      challengeId: currentChallenge.id,
      correct,
      attempts: currentAttempts + 1,
      score: correct ? 100 : vehicleCorrect || evidenceCorrect ? 50 : 0,
      vehicleCorrect,
      evidenceCorrect,
      chosenVehicleId: missionVehicleId,
      chosenEvidence,
    });
    if (correct) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    sendText?.(
      `[MISSION_SUBMITTED] Student chose "${vehicles.find((v) => v.id === missionVehicleId)?.name}"${currentChallenge.type === 'metric_leader' ? ` for the named ${METRIC_META[chosenEvidence].label} comparison` : ` and cited ${METRIC_META[chosenEvidence].label}`}. Vehicle choice: ${vehicleCorrect ? 'correct' : 'not best'}. Evidence choice: ${evidenceCorrect ? 'supports the decision' : 'does not best support it'}. Coach the reasoning without adding a new answer.`,
      { silent: true },
    );
  }, [currentAttempts, currentChallenge, incrementAttempts, missionEvidence, missionVehicleId, recordResult, sendText, vehicles]);

  const nextMission = useCallback(() => {
    if (currentIndex < challenges.length - 1) advanceProgress();
    else setShowSummary(true);
  }, [advanceProgress, challenges.length, currentIndex]);

  const discoverFact = useCallback((index: number) => {
    if (discoveredFacts.has(index)) return;
    SoundManager.pop();
    setDiscoveredFacts((previous) => new Set(previous).add(index));
    sendText?.(`[SURPRISING_FACT] Student uncovered: "${surprisingFacts[index]?.fact}". React briefly, then connect it to one visible metric.`, { silent: true });
  }, [discoveredFacts, sendText, surprisingFacts]);

  const renderVehicleCard = (vehicle: ComparisonVehicle) => {
    const selected = selectedVehicleIds.includes(vehicle.id);
    const style = CATEGORY_STYLE[vehicle.category];
    const imageUrl = vehicle.imageUrl || generatedImages[vehicle.id];
    return (
      <div
        key={vehicle.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/vehicle-id', vehicle.id);
          event.dataTransfer.effectAllowed = 'copy';
        }}
        className={cn(
          'group relative rounded-2xl border bg-slate-950/40 p-2 transition-all',
          selected ? cn(style.border, style.soft, 'shadow-lg') : 'border-white/10 hover:border-white/20',
        )}
      >
        <VehicleVisual vehicle={vehicle} imageUrl={imageUrl} loading={loadingImageId === vehicle.id} />
        <button
          type="button"
          onClick={() => toggleVehicleOnStage(vehicle.id)}
          aria-pressed={selected}
          aria-label={`${selected ? 'Remove' : 'Add'} ${vehicle.name} ${selected ? 'from' : 'to'} comparison`}
          className="mt-2 w-full rounded-xl p-1.5 text-left transition-colors hover:bg-white/5"
        >
          <div className="flex items-start gap-2">
            <GripVertical className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{vehicle.name}</p>
              <p className="truncate text-xs text-slate-500">{vehicle.metrics.fuelType}</p>
            </div>
            <span className={cn('text-xs font-semibold', selected ? style.accent : 'text-slate-500')}>{selected ? 'On bay' : 'Add'}</span>
          </div>
        </button>
        {vehicle.imagePrompt && !imageUrl && (
          <button
            type="button"
            onClick={() => generateVehicleImage(vehicle)}
            disabled={!!loadingImageId}
            aria-label={`Generate a visual of ${vehicle.name}`}
            className={cn(
              'absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/80 px-2 py-1 text-[10px] font-semibold text-slate-300 backdrop-blur hover:bg-slate-900',
              imageErrors.has(vehicle.id) && 'text-rose-300',
            )}
          >
            <ImageIcon className="h-3 w-3" />{imageErrors.has(vehicle.id) ? 'Retry' : 'Visual'}
          </button>
        )}
      </div>
    );
  };

  const renderComparisonArena = () => {
    const numeric = selectedVehicles
      .map((vehicle) => ({ vehicle, value: metricValue(vehicle, activeMetric) }))
      .filter((entry): entry is { vehicle: ComparisonVehicle; value: number } => entry.value != null);
    const yearMetric = activeMetric === 'yearIntroduced';
    const values = numeric.map((entry) => entry.value);
    const max = Math.max(...values, 1);
    const min = yearMetric ? Math.min(...values) : 0;
    const yearSpan = Math.max(max - min, 1);

    return (
      <LuminaPanel accent="cyan" className="space-y-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400/80">Comparison arena</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{METRIC_META[activeMetric].prompt}</h3>
          </div>
          <LuminaBadge>{comparisonRevealed ? 'Data revealed' : 'Predict first'}</LuminaBadge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selectedVehicles.map((vehicle) => (
            <LuminaAnswerChoice
              key={vehicle.id}
              state={comparisonRevealed
                ? vehicle.id === winner?.id ? 'correct' : vehicle.id === predictionId ? 'incorrect' : 'dimmed'
                : predictionId === vehicle.id ? 'selected' : 'idle'}
              disabled={comparisonRevealed || metricValue(vehicle, activeMetric) == null}
              onClick={() => {
                SoundManager.select();
                setPredictionId(vehicle.id);
              }}
              className="p-3"
            >
              <div className="flex items-center gap-2">
                <VehicleDiagram vehicle={vehicle} className={cn('h-9 w-16 flex-shrink-0', CATEGORY_STYLE[vehicle.category].accent)} />
                <span className="min-w-0 truncate text-sm font-semibold">{vehicle.name}</span>
              </div>
            </LuminaAnswerChoice>
          ))}
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-slate-950/65 p-4">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,rgba(148,163,184,.18)_1px,transparent_1px)] [background-size:10%_100%]" />
          <div className="relative space-y-4">
            {selectedVehicles.map((vehicle, index) => {
              const value = metricValue(vehicle, activeMetric);
              const ratio = value == null ? 0 : yearMetric ? (value - min) / yearSpan : value / max;
              const position = comparisonRevealed ? Math.max(5, ratio * 100) : 5;
              return (
                <div key={vehicle.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-slate-300">{vehicle.name}</span>
                    <span className={cn('font-mono font-bold transition-opacity', comparisonRevealed ? 'text-white opacity-100' : 'text-slate-600 opacity-60')}>
                      {comparisonRevealed ? metricDisplay(vehicle, activeMetric) : 'hidden'}
                    </span>
                  </div>
                  <div className="relative h-9 rounded-full border border-white/5 bg-white/[0.035]">
                    <div
                      className={cn(
                        'absolute inset-y-1 left-1 rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out',
                        index % 4 === 0 && 'from-cyan-500/35 to-cyan-300/15',
                        index % 4 === 1 && 'from-amber-500/35 to-amber-300/15',
                        index % 4 === 2 && 'from-violet-500/35 to-violet-300/15',
                        index % 4 === 3 && 'from-emerald-500/35 to-emerald-300/15',
                      )}
                      style={{ width: `${position}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-7 w-14 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-1000 ease-out"
                      style={{ left: `${position}%` }}
                    >
                      <VehicleDiagram vehicle={vehicle} className={cn('h-full w-full', CATEGORY_STYLE[vehicle.category].accent)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!comparisonRevealed ? (
          <LuminaActionButton action="check" disabled={!predictionId} onClick={revealComparison} className="w-full">
            <Play className="mr-2 h-4 w-4" /> Run the comparison
          </LuminaActionButton>
        ) : (
          <LuminaFeedbackCard status={predictionId === winner?.id ? 'correct' : 'insight'}>
            <p className="font-semibold">{winner?.name} {METRIC_META[activeMetric].lowerWins ? 'has the lowest value' : 'leads this test'}.</p>
            <p className="mt-1 text-sm text-slate-300">
              {winner ? `${METRIC_META[activeMetric].label}: ${metricDisplay(winner, activeMetric)}.` : 'No comparable data was available.'}
              {' '}Try another metric—the winner may change.
            </p>
          </LuminaFeedbackCard>
        )}
      </LuminaPanel>
    );
  };

  const renderCompareView = () => (
    <div className="space-y-6">
      <LuminaPrompt accent="cyan">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/75">Build a comparison</p>
        <p className="mt-1 text-lg font-semibold text-white">Drag or tap 2–4 vehicles into the bay</p>
        <p className="mt-1 text-sm font-normal text-slate-300">Choose a metric, predict the leader, then run the data test.</p>
      </LuminaPrompt>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
        <LuminaPanel className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Vehicle gallery</h3>
            <span className="text-xs text-slate-500">Drag →</span>
          </div>
          <div className="grid grid-cols-2 gap-3">{vehicles.map((vehicle) => renderVehicleCard(vehicle))}</div>
        </LuminaPanel>

        <div className="space-y-4">
          <LuminaDropZone
            state={(dragOverStage ? 'dragOver' : selectedVehicles.length > 0 ? 'filled' : 'idle') as DropZoneState}
            emptyPrompt="Drop vehicles here"
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverStage(true);
            }}
            onDragLeave={() => setDragOverStage(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOverStage(false);
              addVehicleToStage(event.dataTransfer.getData('text/vehicle-id'));
            }}
            className="min-h-[110px] justify-start"
          >
            {selectedVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => toggleVehicleOnStage(vehicle.id)}
                className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-left', CATEGORY_STYLE[vehicle.category].border, CATEGORY_STYLE[vehicle.category].soft)}
                aria-label={`Remove ${vehicle.name} from comparison`}
              >
                <VehicleDiagram vehicle={vehicle} className={cn('h-7 w-12', CATEGORY_STYLE[vehicle.category].accent)} />
                <span className="max-w-32 truncate text-xs font-semibold text-slate-200">{vehicle.name}</span>
              </button>
            ))}
          </LuminaDropZone>
          <p className="text-xs text-slate-500">Keep at least two vehicles in the bay. Add up to four.</p>

          <div className="flex flex-wrap gap-2">
            {comparisonMetrics.map((metric) => (
              <LuminaChoiceChip
                key={metric}
                label={METRIC_META[metric].shortLabel}
                accent={METRIC_META[metric].accent}
                selected={activeMetric === metric}
                onClick={() => {
                  SoundManager.select();
                  setActiveMetric(metric);
                }}
              />
            ))}
          </div>
          {renderComparisonArena()}
        </div>
      </div>

      {surprisingFacts.length > 0 && (
        <LuminaPanel accent="amber" className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-300" />
            <h3 className="font-semibold text-amber-100">Evidence surprises</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {surprisingFacts.map((fact, index) => (
              <button
                key={`${fact.fact}-${index}`}
                type="button"
                onClick={() => discoverFact(index)}
                className={cn(
                  'min-h-20 rounded-xl border p-3 text-left transition-all',
                  discoveredFacts.has(index)
                    ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
                )}
              >
                {discoveredFacts.has(index) ? fact.fact : 'Tap to uncover a surprising comparison'}
              </button>
            ))}
          </div>
        </LuminaPanel>
      )}

      <LuminaButton
        tone="primary"
        onClick={() => {
          setView('missions');
          sendText?.('[MISSION_STARTED] Student entered evidence missions. Frame the task without naming the best vehicle or evidence metric.', { silent: true });
        }}
        className="w-full"
      >
        Use the evidence in missions <ChevronRight className="ml-2 h-4 w-4" />
      </LuminaButton>
    </div>
  );

  const renderMissionMap = () => {
    if (!currentChallenge) return null;
    const routeVehicleId = missionSubmitted ? currentChallenge.bestVehicleId : missionVehicleId;
    const selected = vehicles.find((vehicle) => vehicle.id === routeVehicleId) ?? null;
    const routeLabel = missionSubmitted ? 'Best fit' : 'Your pick';
    return (
      <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-sky-950/45 via-slate-950/80 to-emerald-950/35">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:20px_20px]" />
        <svg viewBox="0 0 800 190" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M90 125 C230 25 570 165 710 65" fill="none" stroke="rgba(34,211,238,.22)" strokeWidth="22" strokeLinecap="round" />
          <path d="M90 125 C230 25 570 165 710 65" fill="none" stroke="rgba(125,211,252,.7)" strokeWidth="3" strokeDasharray="10 12" strokeLinecap="round" />
        </svg>
        <div className="absolute bottom-5 left-5 max-w-[28%]">
          <div className="mb-1 h-4 w-4 rounded-full border-4 border-amber-300 bg-slate-950 shadow-[0_0_20px_rgba(252,211,77,.6)]" />
          <p className="truncate text-xs font-bold text-amber-200">{currentChallenge.origin || 'Start'}</p>
        </div>
        <div className="absolute right-5 top-5 max-w-[28%] text-right">
          <div className="ml-auto mb-1 h-4 w-4 rounded-full border-4 border-emerald-300 bg-slate-950 shadow-[0_0_20px_rgba(110,231,183,.6)]" />
          <p className="truncate text-xs font-bold text-emerald-200">{currentChallenge.destination || 'Destination'}</p>
        </div>
        <div className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 text-center">
          {selected ? (
            <div
              className={CATEGORY_STYLE[selected.category].accent}
              data-testid="mission-route-vehicle"
              data-vehicle-id={selected.id}
            >
              <VehicleDiagram vehicle={selected} className="h-20 w-full drop-shadow-2xl" />
              <p className="truncate text-xs font-bold text-white"><span className="text-cyan-200">{routeLabel}:</span> {selected.name}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-slate-950/65 px-4 py-5 text-xs font-semibold text-cyan-200">Drop a vehicle on the route</div>
          )}
        </div>
        <div className="absolute bottom-3 right-4 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-xs text-slate-300">
          {currentChallenge.constraints.distance} km · {currentChallenge.constraints.passengers} passengers
        </div>
      </div>
    );
  };

  const renderMissionsView = () => {
    if (allChallengesComplete && showSummary) {
      return (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score}
          durationMs={Date.now() - startTimeRef.current}
          heading="Comparison missions complete"
          celebrationMessage="You used vehicle data as evidence—not just a guess."
        />
      );
    }
    if (!currentChallenge) return null;

    const vehicleCorrect = missionVehicleId === currentChallenge.bestVehicleId
      || (!!missionVehicleId && currentChallenge.acceptableAlternatives.includes(missionVehicleId));
    const requiresEvidenceChoice = currentChallenge.type !== 'metric_leader';
    const evidenceCorrect = !requiresEvidenceChoice
      || missionEvidence === currentChallenge.bestEvidenceMetric
      || (!!missionEvidence && currentChallenge.acceptableEvidenceMetrics.includes(missionEvidence));
    const fullyCorrect = vehicleCorrect && evidenceCorrect;
    const missionLabel = currentChallenge.type === 'metric_leader'
      ? 'Metric mission'
      : currentChallenge.type === 'constraint_tradeoff'
        ? 'Trade-off mission'
        : 'Evidence mission';
    const missionInstruction = currentChallenge.type === 'metric_leader'
      ? `Read each vehicle's ${METRIC_META[currentChallenge.bestEvidenceMetric].label.toLowerCase()} value, then choose the leader.`
      : currentChallenge.type === 'constraint_tradeoff'
        ? 'First rule out vehicles that miss a minimum. Then choose the best qualifying vehicle and the data that supports it.'
        : 'Put one vehicle on the route, then choose the data that best supports it.';

    return (
      <div className="space-y-5">
        <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
        <LuminaPrompt accent="amber">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/75">{missionLabel}</p>
              <p className="mt-1 text-lg font-semibold text-white">{currentChallenge.scenario}</p>
              <p className="mt-1 text-sm font-normal text-slate-300">{missionInstruction}</p>
            </div>
            <ReadMeButton
              instruction={currentChallenge.scenario}
              ask={currentChallenge.type === 'metric_leader'
                ? `Choose the vehicle that leads on ${METRIC_META[currentChallenge.bestEvidenceMetric].label}.`
                : `Choose a vehicle for ${currentChallenge.constraints.passengers} passengers traveling ${currentChallenge.constraints.distance} kilometers. Then choose the kind of data that proves your choice.`}
              speaking={isAudioPlaying}
              onAskTutor={(message) => sendText?.(message)}
              tag="[READ_SCENARIO]"
              aria-label="Read the challenge to me"
            />
          </div>
        </LuminaPrompt>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!missionSubmitted) setMissionVehicleId(event.dataTransfer.getData('text/vehicle-id'));
          }}
        >{renderMissionMap()}</div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vehicles.map((vehicle) => {
            let state: AnswerChoiceState = missionVehicleId === vehicle.id ? 'selected' : 'idle';
            if (missionSubmitted) {
              const correctVehicle = vehicle.id === currentChallenge.bestVehicleId || currentChallenge.acceptableAlternatives.includes(vehicle.id);
              state = correctVehicle ? 'correct' : missionVehicleId === vehicle.id ? 'incorrect' : 'dimmed';
            }
            return (
              <LuminaAnswerChoice
                key={vehicle.id}
                state={state}
                disabled={missionSubmitted}
                draggable={!missionSubmitted}
                onDragStart={(event) => event.dataTransfer.setData('text/vehicle-id', vehicle.id)}
                onClick={() => {
                  SoundManager.select();
                  setMissionVehicleId(vehicle.id);
                }}
                className="p-3"
              >
                <VehicleDiagram vehicle={vehicle} className={cn('mx-auto h-11 w-24', CATEGORY_STYLE[vehicle.category].accent)} />
                <p className="mt-1 truncate text-center text-xs font-semibold">{vehicle.name}</p>
                {currentChallenge.type === 'metric_leader' && (
                  <p className="mt-1 text-center text-[11px] font-bold text-cyan-200">
                    {metricDisplay(vehicle, currentChallenge.bestEvidenceMetric)}
                  </p>
                )}
              </LuminaAnswerChoice>
            );
          })}
        </div>

        {requiresEvidenceChoice && <LuminaPanel accent="purple" className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-300" />
            <p className="text-sm font-semibold text-purple-100">Which evidence best supports your vehicle?</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {comparisonMetrics.map((metric) => {
              let state: AnswerChoiceState = missionEvidence === metric ? 'selected' : 'idle';
              if (missionSubmitted) {
                const correctMetric = metric === currentChallenge.bestEvidenceMetric || currentChallenge.acceptableEvidenceMetrics.includes(metric);
                state = correctMetric ? 'correct' : missionEvidence === metric ? 'incorrect' : 'dimmed';
              }
              return (
                <LuminaAnswerChoice
                  key={metric}
                  state={state}
                  disabled={missionSubmitted}
                  onClick={() => {
                    SoundManager.select();
                    setMissionEvidence(metric);
                  }}
                  className="p-3 text-sm"
                >
                  <span className="flex items-center gap-2">{METRIC_META[metric].icon}{METRIC_META[metric].label}</span>
                </LuminaAnswerChoice>
              );
            })}
          </div>
        </LuminaPanel>}

        {!missionSubmitted ? (
          <LuminaActionButton action="check" disabled={!missionVehicleId || (requiresEvidenceChoice && !missionEvidence)} onClick={submitMission} className="w-full">
            {requiresEvidenceChoice ? 'Check vehicle + evidence' : 'Check vehicle'}
          </LuminaActionButton>
        ) : (
          <>
            <LuminaFeedbackCard status={fullyCorrect ? 'correct' : 'insight'}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="font-semibold">{fullyCorrect
                    ? currentChallenge.type === 'metric_leader' ? 'You found the metric leader.' : 'Strong evidence-based choice.'
                    : requiresEvidenceChoice ? 'Compare both the vehicle and the evidence.' : 'Compare the visible values again.'}</p>
                  <p className="mt-1 text-sm text-slate-300">{currentChallenge.explanation}</p>
                </div>
                <LuminaReadAloud
                  iconOnly size="sm" accent="cyan" speaking={isAudioPlaying}
                  aria-label="Read this to me"
                  onClick={() => readBlockAloud(currentChallenge.explanation, '[READ_EXPLANATION]')}
                />
              </div>
            </LuminaFeedbackCard>
            <LuminaActionButton action="next" onClick={nextMission} className="w-full">
              {currentIndex < challenges.length - 1 ? 'Next mission' : 'See results'}<ChevronRight className="ml-2 h-4 w-4" />
            </LuminaActionButton>
          </>
        )}
      </div>
    );
  };

  return (
    <LuminaCard className={cn('w-full overflow-hidden', className)}>
      <LuminaCardHeader className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950/95 via-cyan-950/40 to-slate-900/90">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-cyan-300"><BarChart3 className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400/70">Vehicle comparison lab</p>
              <LuminaCardTitle className="mt-1 text-2xl">{data.title}</LuminaCardTitle>
              <div className="mt-2 flex max-w-3xl items-start gap-2">
                <p className="text-sm leading-relaxed text-slate-300">{data.instructions}</p>
                <LuminaReadAloud
                  iconOnly size="sm" accent="cyan" speaking={isAudioPlaying}
                  aria-label="Read the instructions to me"
                  onClick={() => readBlockAloud(data.instructions, '[READ_INSTRUCTIONS]')}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LuminaBadge>{gradeBand}</LuminaBadge>
            <span className="max-w-64 text-right text-xs text-slate-500">Topic: {data.topicFocus}</span>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LuminaModeTabs
            tabs={[{ value: 'compare', label: '1. Comparison bay' }, { value: 'missions', label: '2. Evidence missions' }]}
            active={view}
            accent="cyan"
            onSelect={(value) => setView(value as 'compare' | 'missions')}
          />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Trophy className="h-4 w-4 text-amber-400" />
            {metricsExplored.size} metrics tested · {predictionsCorrect}/{predictionsMade} predictions
          </div>
        </div>
        {view === 'compare' ? renderCompareView() : renderMissionsView()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default VehicleComparisonLab;
