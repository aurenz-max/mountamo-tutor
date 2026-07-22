'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaReadAloud,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { ReadMeButton } from '../../shared/ReadMeButton';
import { SoundManager } from '../../../utils/SoundManager';
import type { VehicleDesignStudioMetrics } from '../../../evaluation/types';

// ─── Data Interfaces ─────────────────────────────────────────────

export interface VehicleBody {
  id: string;
  name: string;
  weight: number;
  dragCoefficient: number;
  capacity: number;
  cost: number;
  imagePrompt: string;
}

export interface VehiclePropulsion {
  id: string;
  name: string;
  thrustOutput: number;
  fuelEfficiency: number;
  weight: number;
  cost: number;
  requires: 'air' | 'ground' | 'water' | 'any';
}

export interface VehicleControl {
  id: string;
  name: string;
  stabilityBonus: number;
  dragPenalty: number;
  weight: number;
  cost: number;
}

export interface VehicleConstraints {
  maxWeight: number | null;
  maxCost: number | null;
  minRange: number | null;
  minSpeed: number | null;
  minCapacity: number | null;
  requiredDomain: string | null;
}

export interface SimulationOutput {
  topSpeed: number;
  range: number;
  stability: number;
  efficiency: number;
  capacity: number;
  totalWeight: number;
  totalCost: number;
  meetsConstraints: boolean;
}

export interface DesignTip {
  condition: string;
  tip: string;
}

export interface VehicleChallenge {
  name: string;
  description: string;
  constraints: VehicleConstraints;
  targetMetric: string;
  difficulty: number;
}

export interface DesignLogEntry {
  id: string;
  timestamp: number;
  bodyId: string | null;
  propulsionId: string | null;
  controlIds: string[];
  simulation: SimulationOutput;
}

export interface VehicleDesignStudioData {
  title: string;
  description?: string;
  domain: 'land' | 'sea' | 'air' | 'amphibious';

  partsPalette: {
    bodies: VehicleBody[];
    propulsion: VehiclePropulsion[];
    controls: VehicleControl[];
  };

  constraints: VehicleConstraints;

  designTips: DesignTip[];

  challenges: VehicleChallenge[];

  gradeBand: '2-3' | '4-5';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VehicleDesignStudioMetrics>) => void;
}

// ─── Constants ───────────────────────────────────────────────────

const DOMAIN_ICONS: Record<string, string> = {
  land: '🚗',
  sea: '🚢',
  air: '✈️',
  amphibious: '🦆',
};

const DOMAIN_ACCENTS: Record<string, 'amber' | 'blue' | 'cyan' | 'emerald'> = {
  land: 'amber',
  sea: 'blue',
  air: 'cyan',
  amphibious: 'emerald',
};

const METRIC_LABELS = ['Speed', 'Range', 'Stability', 'Efficiency', 'Capacity'];

// ─── Physics Simulation ──────────────────────────────────────────

function computeSimulation(
  body: VehicleBody | null,
  propulsion: VehiclePropulsion | null,
  controls: VehicleControl[],
  constraints: VehicleConstraints,
): SimulationOutput | null {
  if (!body || !propulsion) return null;

  const totalWeight = body.weight + propulsion.weight + controls.reduce((s, c) => s + c.weight, 0);
  const totalCost = body.cost + propulsion.cost + controls.reduce((s, c) => s + c.cost, 0);
  const totalDrag = body.dragCoefficient + controls.reduce((s, c) => s + c.dragPenalty, 0);
  const totalStabilityBonus = controls.reduce((s, c) => s + c.stabilityBonus, 0);

  // Top speed: thrust overcomes drag and weight
  const topSpeed = Math.round(
    (propulsion.thrustOutput / (totalWeight * Math.max(totalDrag, 0.1))) * 50
  );

  // Range: fuel efficiency scaled by weight and drag
  const range = Math.round(
    propulsion.fuelEfficiency * (100 / totalWeight) * (1 / Math.max(totalDrag, 0.1)) * 10
  );

  // Stability: base 50 + control bonuses - weight penalty
  const rawStability = 50 + totalStabilityBonus - (totalWeight > 200 ? (totalWeight - 200) * 0.1 : 0);
  const stability = Math.max(0, Math.min(100, Math.round(rawStability)));

  // Efficiency: range per unit cost
  const efficiency = Math.max(0, Math.min(100, Math.round((range / Math.max(totalCost, 1)) * 10)));

  const capacity = body.capacity;

  // Check constraints
  const meetsConstraints =
    (constraints.maxWeight === null || totalWeight <= constraints.maxWeight) &&
    (constraints.maxCost === null || totalCost <= constraints.maxCost) &&
    (constraints.minRange === null || range >= constraints.minRange) &&
    (constraints.minSpeed === null || topSpeed >= constraints.minSpeed) &&
    (constraints.minCapacity === null || capacity >= constraints.minCapacity);

  return { topSpeed, range, stability, efficiency, capacity, totalWeight, totalCost, meetsConstraints };
}

// ─── Radar Chart SVG ─────────────────────────────────────────────

function RadarChart({ values, maxValues }: { values: number[]; maxValues: number[] }) {
  const cx = 100, cy = 100, radius = 70;
  const n = METRIC_LABELS.length;

  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Compute normalized polygon points
  const points = values.map((v, i) => {
    const ratio = Math.min(v / Math.max(maxValues[i], 1), 1);
    const angle = startAngle + i * angleStep;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  });

  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 200 200" className="w-full h-auto" style={{ maxHeight: 200 }}>
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => {
            const angle = startAngle + i * angleStep;
            return `${cx + Math.cos(angle) * radius * r},${cy + Math.sin(angle) * radius * r}`;
          }).join(' ')}
          fill="none"
          stroke="#475569"
          strokeWidth={0.5}
          opacity={0.5}
        />
      ))}

      {/* Axes */}
      {METRIC_LABELS.map((_, i) => {
        const angle = startAngle + i * angleStep;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * radius}
            y2={cy + Math.sin(angle) * radius}
            stroke="#475569"
            strokeWidth={0.5}
            opacity={0.4}
          />
        );
      })}

      {/* Value polygon */}
      <path d={polygonPath} fill="rgba(56, 189, 248, 0.2)" stroke="#38BDF8" strokeWidth={2} />

      {/* Value dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#38BDF8" />
      ))}

      {/* Labels */}
      {METRIC_LABELS.map((label, i) => {
        const angle = startAngle + i * angleStep;
        const lx = cx + Math.cos(angle) * (radius + 18);
        const ly = cy + Math.sin(angle) * (radius + 18);
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#94A3B8"
            fontSize="8"
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Simulation Animation ────────────────────────────────────────

function SimulationAnimation({ domain, onComplete }: { domain: string; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    let frame = 0;
    const totalFrames = 90;
    const id = setInterval(() => {
      frame++;
      setProgress(frame / totalFrames);
      if (frame >= totalFrames) {
        clearInterval(id);
        onComplete();
      }
    }, 25);
    return () => clearInterval(id);
  }, [onComplete]);

  const vehicleX = progress * 280 + 10;
  const bounce = Math.sin(progress * Math.PI * 8) * 3;
  const icon = DOMAIN_ICONS[domain] || '🚗';

  return (
    <svg viewBox="0 0 320 80" className="w-full h-auto" style={{ maxHeight: 80 }}>
      {/* Track */}
      <rect x={0} y={50} width={320} height={4} rx={2} fill="#334155" />
      {/* Progress bar */}
      <rect x={0} y={50} width={progress * 320} height={4} rx={2} fill="#38BDF8" opacity={0.6} />
      {/* Vehicle */}
      <text x={vehicleX} y={45 + bounce} fontSize="28" textAnchor="middle">
        {icon}
      </text>
      {/* Speed lines */}
      {progress > 0.1 && (
        <>
          <line x1={vehicleX - 25} y1={38} x2={vehicleX - 40} y2={38} stroke="#38BDF8" strokeWidth={1.5} opacity={0.5} />
          <line x1={vehicleX - 25} y1={45} x2={vehicleX - 45} y2={45} stroke="#38BDF8" strokeWidth={1} opacity={0.3} />
        </>
      )}
      {/* Labels */}
      <text x={5} y={72} fill="#64748B" fontSize="9" fontFamily="monospace">START</text>
      <text x={290} y={72} fill="#64748B" fontSize="9" fontFamily="monospace">FINISH</text>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────

interface VehicleDesignStudioProps {
  data: VehicleDesignStudioData;
  className?: string;
}

const VehicleDesignStudio: React.FC<VehicleDesignStudioProps> = ({ data, className }) => {
  const {
    title,
    description,
    domain,
    partsPalette,
    constraints,
    designTips = [],
    challenges = [],
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ─── State ───────────────────────────────────────────────────
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [selectedPropulsionId, setSelectedPropulsionId] = useState<string | null>(null);
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [designLog, setDesignLog] = useState<DesignLogEntry[]>([]);
  const [latestSimulation, setLatestSimulation] = useState<SimulationOutput | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<VehicleChallenge | null>(null);
  const [showDesignLog, setShowDesignLog] = useState(false);
  const [uniquePartsUsed, setUniquePartsUsed] = useState<Set<string>>(new Set());
  const [variableIsolationDetected, setVariableIsolationDetected] = useState(false);

  // ─── Derived ─────────────────────────────────────────────────
  const selectedBody = useMemo(
    () => partsPalette.bodies.find(b => b.id === selectedBodyId) ?? null,
    [partsPalette.bodies, selectedBodyId]
  );
  const selectedPropulsion = useMemo(
    () => partsPalette.propulsion.find(p => p.id === selectedPropulsionId) ?? null,
    [partsPalette.propulsion, selectedPropulsionId]
  );
  const selectedControls = useMemo(
    () => partsPalette.controls.filter(c => selectedControlIds.includes(c.id)),
    [partsPalette.controls, selectedControlIds]
  );

  const totalParts = partsPalette.bodies.length + partsPalette.propulsion.length + partsPalette.controls.length;

  const activeConstraints = activeChallenge ? activeChallenge.constraints : constraints;

  const resolvedInstanceId = instanceId || `vds-${Date.now()}`;

  // ─── Evaluation Hook ─────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<VehicleDesignStudioMetrics>({
    primitiveType: 'vehicle-design-studio' as any,
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ─── AI Tutoring ─────────────────────────────────────────────
  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'vehicle-design-studio' as any,
    instanceId: resolvedInstanceId,
    primitiveData: {
      domain,
      selectedBody: selectedBody?.name ?? null,
      selectedPropulsion: selectedPropulsion?.name ?? null,
      selectedControls: selectedControls.map(c => c.name),
      latestSimulation,
      designIterations: designLog.length,
      activeChallenge: activeChallenge?.name ?? null,
      constraintsMet: latestSimulation?.meetsConstraints ?? null,
    },
    gradeLevel: gradeBand === '2-3' ? 'elementary' : 'elementary',
  });

  // ── Read-aloud for young learners ─────────────────────────────────────────
  // Load-bearing text here is unreadable to a K–2 student; these taps route to a
  // NON-silent sendText — the read-aloud IS the tutor speaking the words verbatim.
  const readBlockAloud = useCallback((text: string, tag: string) => {
    if (!text) return;
    SoundManager.tap();
    sendText?.(
      `${tag} The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, in a warm friendly voice: "${text}". Then wait.`,
    );
  }, [sendText]);

  // ─── Handlers ────────────────────────────────────────────────

  const toggleControl = useCallback((controlId: string) => {
    SoundManager.select();
    setSelectedControlIds(prev =>
      prev.includes(controlId) ? prev.filter(id => id !== controlId) : [...prev, controlId]
    );
    setLatestSimulation(null);
  }, []);

  const selectBody = useCallback((bodyId: string) => {
    SoundManager.select();
    setSelectedBodyId(prev => prev === bodyId ? null : bodyId);
    setLatestSimulation(null);
  }, []);

  const selectPropulsion = useCallback((propId: string) => {
    SoundManager.select();
    setSelectedPropulsionId(prev => prev === propId ? null : propId);
    setLatestSimulation(null);
  }, []);

  // Detect variable isolation: changed exactly one part between two consecutive tests
  const checkVariableIsolation = useCallback((prevEntry: DesignLogEntry | null) => {
    if (!prevEntry) return;
    let changes = 0;
    if (prevEntry.bodyId !== selectedBodyId) changes++;
    if (prevEntry.propulsionId !== selectedPropulsionId) changes++;
    const prevControls = prevEntry.controlIds.sort().join(',');
    const currControls = [...selectedControlIds].sort().join(',');
    if (prevControls !== currControls) changes++;
    if (changes === 1) setVariableIsolationDetected(true);
  }, [selectedBodyId, selectedPropulsionId, selectedControlIds]);

  const handleTest = useCallback(() => {
    if (!selectedBody || !selectedPropulsion) return;

    SoundManager.tap();
    setIsSimulating(true);

    // Track unique parts
    const newParts = new Set(uniquePartsUsed);
    if (selectedBodyId) newParts.add(selectedBodyId);
    if (selectedPropulsionId) newParts.add(selectedPropulsionId);
    selectedControlIds.forEach(id => newParts.add(id));
    setUniquePartsUsed(newParts);

    // AI: prediction question before test (first test only)
    if (designLog.length === 0) {
      sendText(
        `[PRE_TEST] Student is about to test their first design: ${selectedBody.name} body + ${selectedPropulsion.name} propulsion + ${selectedControls.map(c => c.name).join(', ') || 'no controls'}. Ask them to predict what will happen before the test runs.`,
        { silent: true }
      );
    }
  }, [selectedBody, selectedPropulsion, selectedBodyId, selectedPropulsionId, selectedControlIds, selectedControls, designLog.length, uniquePartsUsed, sendText]);

  const handleSimulationComplete = useCallback(() => {
    const sim = computeSimulation(selectedBody, selectedPropulsion, selectedControls, activeConstraints);
    if (!sim) {
      setIsSimulating(false);
      return;
    }

    setLatestSimulation(sim);
    setIsSimulating(false);

    const prevEntry = designLog.length > 0 ? designLog[designLog.length - 1] : null;

    // Log this design
    const entry: DesignLogEntry = {
      id: `design-${Date.now()}`,
      timestamp: Date.now(),
      bodyId: selectedBodyId,
      propulsionId: selectedPropulsionId,
      controlIds: [...selectedControlIds],
      simulation: sim,
    };
    setDesignLog(prev => [...prev, entry]);

    // Check variable isolation
    checkVariableIsolation(prevEntry);

    // AI tutoring: analyze results
    if (sim.meetsConstraints) {
      sendText(
        `[CONSTRAINTS_MET] Design meets all constraints! Speed: ${sim.topSpeed}, Range: ${sim.range}, Stability: ${sim.stability}, Efficiency: ${sim.efficiency}, Capacity: ${sim.capacity}. This is iteration ${designLog.length + 1}. Congratulate the student and highlight what worked well.`,
        { silent: true }
      );
    } else if (sim.stability < 30) {
      sendText(
        `[LOW_STABILITY] Stability is only ${sim.stability}/100. Parts: ${selectedBody?.name}, ${selectedPropulsion?.name}, controls: ${selectedControls.map(c => c.name).join(', ') || 'none'}. Ask the student what they could add or change to improve stability.`,
        { silent: true }
      );
    } else if (prevEntry && prevEntry.simulation) {
      // Compare to previous
      const improved = sim.topSpeed > prevEntry.simulation.topSpeed ||
        sim.range > prevEntry.simulation.range ||
        sim.stability > prevEntry.simulation.stability;
      if (improved) {
        sendText(
          `[IMPROVEMENT] Design improved from iteration ${designLog.length} to ${designLog.length + 1}. Speed: ${prevEntry.simulation.topSpeed}→${sim.topSpeed}, Range: ${prevEntry.simulation.range}→${sim.range}, Stability: ${prevEntry.simulation.stability}→${sim.stability}. Celebrate the improvement and encourage further iteration.`,
          { silent: true }
        );
      } else {
        sendText(
          `[NO_IMPROVEMENT] Design did not improve. Speed: ${prevEntry.simulation.topSpeed}→${sim.topSpeed}, Range: ${prevEntry.simulation.range}→${sim.range}. Ask what they might try differently. Encourage changing only one part at a time.`,
          { silent: true }
        );
      }
    } else {
      sendText(
        `[FIRST_TEST] First test result: Speed ${sim.topSpeed}, Range ${sim.range}, Stability ${sim.stability}, Efficiency ${sim.efficiency}, Capacity ${sim.capacity}. Help the student identify the weakest metric and suggest one thing to try.`,
        { silent: true }
      );
    }
  }, [selectedBody, selectedPropulsion, selectedControls, activeConstraints, selectedBodyId, selectedPropulsionId, selectedControlIds, designLog, checkVariableIsolation, sendText]);

  const handleReset = useCallback(() => {
    setSelectedBodyId(null);
    setSelectedPropulsionId(null);
    setSelectedControlIds([]);
    setLatestSimulation(null);
    setIsSimulating(false);
  }, []);

  const handleSubmitFinal = useCallback(() => {
    if (!latestSimulation || hasSubmittedEvaluation) return;

    const firstSim = designLog.length > 0 ? designLog[0].simulation : null;
    const improvementMetric = firstSim
      ? Math.round(
          ((latestSimulation.topSpeed - firstSim.topSpeed) +
           (latestSimulation.range - firstSim.range) +
           (latestSimulation.stability - firstSim.stability)) / 3
        )
      : 0;

    const metrics: VehicleDesignStudioMetrics = {
      type: 'vehicle-design-studio',
      designIterations: designLog.length,
      constraintsMet: latestSimulation.meetsConstraints,
      improvementAcrossIterations: improvementMetric,
      partsExplored: uniquePartsUsed.size,
      partsTotal: totalParts,
      challengesCompleted: activeChallenge && latestSimulation.meetsConstraints ? 1 : 0,
      challengesTotal: challenges.length,
      variableIsolation: variableIsolationDetected,
      designLogUsed: showDesignLog || designLog.length > 1,
      bestEfficiencyScore: latestSimulation.efficiency,
      attemptsCount: designLog.length,
    };

    const score = Math.round(
      (latestSimulation.meetsConstraints ? 40 : 0) +
      Math.min(designLog.length, 5) * 4 +
      (variableIsolationDetected ? 15 : 0) +
      (uniquePartsUsed.size / totalParts) * 15 +
      (latestSimulation.efficiency / 100) * 10
    );

    submitEvaluation(latestSimulation.meetsConstraints, Math.min(score, 100), metrics, {
      designLog,
      finalBody: selectedBodyId,
      finalPropulsion: selectedPropulsionId,
      finalControls: selectedControlIds,
    });

    sendText(
      `[ALL_COMPLETE] Student submitted their final design after ${designLog.length} iterations. Constraints met: ${latestSimulation.meetsConstraints}. Score: ${score}. Celebrate their engineering work!`,
      { silent: true }
    );
  }, [latestSimulation, hasSubmittedEvaluation, designLog, uniquePartsUsed, totalParts, activeChallenge, challenges.length, variableIsolationDetected, showDesignLog, submitEvaluation, sendText, selectedBodyId, selectedPropulsionId, selectedControlIds]);

  // ─── Active tips ──────────────────────────────────────────────
  const activeTips = useMemo(() => {
    if (!latestSimulation) return [];
    return designTips.filter(tip => {
      try {
        const condition = tip.condition
          .replace(/stability/g, String(latestSimulation.stability))
          .replace(/speed/g, String(latestSimulation.topSpeed))
          .replace(/range/g, String(latestSimulation.range))
          .replace(/efficiency/g, String(latestSimulation.efficiency))
          .replace(/capacity/g, String(latestSimulation.capacity))
          .replace(/weight/g, String(latestSimulation.totalWeight))
          .replace(/cost/g, String(latestSimulation.totalCost));
        return new Function(`return ${condition}`)();
      } catch {
        return false;
      }
    });
  }, [latestSimulation, designTips]);

  // ─── Max values for radar chart ───────────────────────────────
  const maxValues = useMemo(() => {
    const allSims = designLog.map(e => e.simulation).filter(Boolean) as SimulationOutput[];
    if (latestSimulation) allSims.push(latestSimulation);
    if (allSims.length === 0) return [100, 500, 100, 100, 200];
    return [
      Math.max(200, ...allSims.map(s => s.topSpeed)),
      Math.max(500, ...allSims.map(s => s.range)),
      100,
      100,
      Math.max(200, ...allSims.map(s => s.capacity)),
    ];
  }, [designLog, latestSimulation]);

  // ─── Can test? ────────────────────────────────────────────────
  const canTest = !!selectedBody && !!selectedPropulsion && !isSimulating;

  const domainAccent = DOMAIN_ACCENTS[domain] ?? 'indigo';

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <span className="text-2xl">{DOMAIN_ICONS[domain]}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-xs text-indigo-400 font-mono uppercase tracking-wider">
              Vehicle Design Studio
            </p>
            <LuminaBadge accent={domainAccent} className="text-xs">
              {domain.charAt(0).toUpperCase() + domain.slice(1)}
            </LuminaBadge>
          </div>
        </div>
      </div>

      <LuminaCard topAccent="indigo" className="relative overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#6366F1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <LuminaCardContent className="relative z-10 p-6 md:p-8">
          {/* Description */}
          {description && (
            <div className="flex items-start justify-center gap-2 max-w-2xl mx-auto mb-6">
              <p className="text-slate-300 font-light text-center flex-1">{description}</p>
              <LuminaReadAloud
                iconOnly
                size="sm"
                accent="cyan"
                speaking={isAudioPlaying}
                aria-label="Read the introduction to me"
                className="flex-shrink-0"
                onClick={() => readBlockAloud(description, '[READ_DESCRIPTION]')}
              />
            </div>
          )}

          {/* Challenge selector */}
          {challenges.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 justify-center">
                <LuminaButton
                  size="sm"
                  tone={!activeChallenge ? 'primary' : 'ghost'}
                  onClick={() => setActiveChallenge(null)}
                >
                  Free Design
                </LuminaButton>
                {challenges.map((ch, i) => (
                  <LuminaButton
                    key={i}
                    size="sm"
                    tone={activeChallenge?.name === ch.name ? 'primary' : 'ghost'}
                    onClick={() => setActiveChallenge(ch)}
                  >
                    {ch.name}
                    <LuminaBadge accent="amber" className="ml-1 text-[10px]">
                      {'★'.repeat(ch.difficulty)}
                    </LuminaBadge>
                  </LuminaButton>
                ))}
              </div>
              {activeChallenge && (
                <div className="flex items-start justify-center gap-2 mt-2">
                  <p className="text-center text-sm text-amber-300/80 flex-1">{activeChallenge.description}</p>
                  <ReadMeButton
                    instruction={activeChallenge.description}
                    ask={
                      `Your job is the "${activeChallenge.name}" mission. `
                      + [
                          activeChallenge.constraints.maxWeight != null ? `Keep it under ${activeChallenge.constraints.maxWeight} kilograms. ` : '',
                          activeChallenge.constraints.maxCost != null ? `Spend no more than ${activeChallenge.constraints.maxCost} dollars. ` : '',
                          activeChallenge.constraints.minSpeed != null ? `Go at least ${activeChallenge.constraints.minSpeed} kilometers per hour. ` : '',
                          activeChallenge.constraints.minRange != null ? `Travel at least ${activeChallenge.constraints.minRange} kilometers. ` : '',
                          activeChallenge.constraints.minCapacity != null ? `Carry at least ${activeChallenge.constraints.minCapacity} riders. ` : '',
                        ].join('')
                      + 'Pick a body, a motor, and any controls, then tap Test Design to see how it does.'
                    }
                    speaking={isAudioPlaying}
                    onAskTutor={(m) => sendText?.(m)}
                    tag="[READ_MISSION]"
                    className="flex-shrink-0"
                    aria-label="Read the mission to me"
                  />
                </div>
              )}
            </div>
          )}

          {/* Constraint badges */}
          {(activeConstraints.maxWeight || activeConstraints.maxCost || activeConstraints.minRange || activeConstraints.minSpeed || activeConstraints.minCapacity) && (
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {activeConstraints.maxWeight !== null && (
                <LuminaBadge className="text-xs">
                  Max Weight: {activeConstraints.maxWeight}kg
                </LuminaBadge>
              )}
              {activeConstraints.maxCost !== null && (
                <LuminaBadge className="text-xs">
                  Max Cost: ${activeConstraints.maxCost}
                </LuminaBadge>
              )}
              {activeConstraints.minSpeed !== null && (
                <LuminaBadge className="text-xs">
                  Min Speed: {activeConstraints.minSpeed} km/h
                </LuminaBadge>
              )}
              {activeConstraints.minRange !== null && (
                <LuminaBadge className="text-xs">
                  Min Range: {activeConstraints.minRange} km
                </LuminaBadge>
              )}
              {activeConstraints.minCapacity !== null && (
                <LuminaBadge className="text-xs">
                  Min Capacity: {activeConstraints.minCapacity}
                </LuminaBadge>
              )}
            </div>
          )}

          {/* Main layout: Parts Palette + Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Parts Palette (left) */}
            <div className="lg:col-span-2 space-y-4">
              <Accordion type="multiple" defaultValue={['bodies', 'propulsion', 'controls']}>
                {/* Bodies */}
                <AccordionItem value="bodies" className="border-white/10">
                  <AccordionTrigger className="text-slate-200 text-sm font-semibold hover:no-underline">
                    Body Shape
                    {selectedBody && (
                      <LuminaBadge accent="indigo" className="ml-2 text-xs">
                        {selectedBody.name}
                      </LuminaBadge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {partsPalette.bodies.map(body => (
                        <button
                          key={body.id}
                          onClick={() => selectBody(body.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedBodyId === body.id
                              ? 'bg-indigo-500/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                              : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="font-semibold text-slate-100 text-sm">{body.name}</div>
                          <div className="flex gap-3 mt-1 text-xs text-slate-400">
                            <span>Weight: {body.weight}kg</span>
                            <span>Drag: {body.dragCoefficient}</span>
                            <span>Capacity: {body.capacity}</span>
                            <span>Cost: ${body.cost}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Propulsion */}
                <AccordionItem value="propulsion" className="border-white/10">
                  <AccordionTrigger className="text-slate-200 text-sm font-semibold hover:no-underline">
                    Propulsion
                    {selectedPropulsion && (
                      <LuminaBadge accent="cyan" className="ml-2 text-xs">
                        {selectedPropulsion.name}
                      </LuminaBadge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {partsPalette.propulsion.map(prop => (
                        <button
                          key={prop.id}
                          onClick={() => selectPropulsion(prop.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedPropulsionId === prop.id
                              ? 'bg-cyan-500/20 border-cyan-500/50 ring-1 ring-cyan-500/30'
                              : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="font-semibold text-slate-100 text-sm">{prop.name}</div>
                          <div className="flex gap-3 mt-1 text-xs text-slate-400">
                            <span>Thrust: {prop.thrustOutput}N</span>
                            <span>Efficiency: {prop.fuelEfficiency}</span>
                            <span>Weight: {prop.weight}kg</span>
                            <span>Cost: ${prop.cost}</span>
                          </div>
                          <LuminaBadge className="mt-1 text-[10px]">
                            {prop.requires === 'any' ? 'Universal' : prop.requires}
                          </LuminaBadge>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Controls */}
                <AccordionItem value="controls" className="border-white/10">
                  <AccordionTrigger className="text-slate-200 text-sm font-semibold hover:no-underline">
                    Controls & Stabilizers
                    {selectedControls.length > 0 && (
                      <LuminaBadge accent="emerald" className="ml-2 text-xs">
                        {selectedControls.length} selected
                      </LuminaBadge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {partsPalette.controls.map(ctrl => (
                        <button
                          key={ctrl.id}
                          onClick={() => toggleControl(ctrl.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedControlIds.includes(ctrl.id)
                              ? 'bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                              : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="font-semibold text-slate-100 text-sm">{ctrl.name}</div>
                          <div className="flex gap-3 mt-1 text-xs text-slate-400">
                            <span>Stability: +{ctrl.stabilityBonus}</span>
                            <span>Drag: +{ctrl.dragPenalty}</span>
                            <span>Weight: {ctrl.weight}kg</span>
                            <span>Cost: ${ctrl.cost}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Performance Panel (right) */}
            <div className="space-y-4">
              {/* Design Summary */}
              <LuminaCard surface="nested">
                <LuminaCardHeader className="pb-2">
                  <LuminaCardTitle className="text-sm text-slate-300">Current Design</LuminaCardTitle>
                </LuminaCardHeader>
                <LuminaCardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Body</span>
                    <span className="text-slate-200">{selectedBody?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propulsion</span>
                    <span className="text-slate-200">{selectedPropulsion?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Controls</span>
                    <span className="text-slate-200">
                      {selectedControls.length > 0 ? selectedControls.map(c => c.name).join(', ') : '—'}
                    </span>
                  </div>
                  {(selectedBody || selectedPropulsion) && (
                    <>
                      <div className="border-t border-white/10 pt-2 flex justify-between">
                        <span className="text-slate-400">Total Weight</span>
                        <span className={`font-mono ${activeConstraints.maxWeight && (selectedBody?.weight ?? 0) + (selectedPropulsion?.weight ?? 0) + selectedControls.reduce((s, c) => s + c.weight, 0) > activeConstraints.maxWeight ? 'text-red-400' : 'text-slate-200'}`}>
                          {(selectedBody?.weight ?? 0) + (selectedPropulsion?.weight ?? 0) + selectedControls.reduce((s, c) => s + c.weight, 0)}kg
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Cost</span>
                        <span className={`font-mono ${activeConstraints.maxCost && (selectedBody?.cost ?? 0) + (selectedPropulsion?.cost ?? 0) + selectedControls.reduce((s, c) => s + c.cost, 0) > activeConstraints.maxCost ? 'text-red-400' : 'text-slate-200'}`}>
                          ${(selectedBody?.cost ?? 0) + (selectedPropulsion?.cost ?? 0) + selectedControls.reduce((s, c) => s + c.cost, 0)}
                        </span>
                      </div>
                    </>
                  )}
                </LuminaCardContent>
              </LuminaCard>

              {/* Radar Chart */}
              {latestSimulation && (
                <LuminaCard surface="nested">
                  <LuminaCardHeader className="pb-0">
                    <LuminaCardTitle className="text-sm text-slate-300">Performance</LuminaCardTitle>
                  </LuminaCardHeader>
                  <LuminaCardContent className="pt-2">
                    <RadarChart
                      values={[
                        latestSimulation.topSpeed,
                        latestSimulation.range,
                        latestSimulation.stability,
                        latestSimulation.efficiency,
                        latestSimulation.capacity,
                      ]}
                      maxValues={maxValues}
                    />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Speed</span>
                        <span className="text-cyan-300 font-mono">{latestSimulation.topSpeed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Range</span>
                        <span className="text-cyan-300 font-mono">{latestSimulation.range}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Stability</span>
                        <span className="text-cyan-300 font-mono">{latestSimulation.stability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Efficiency</span>
                        <span className="text-cyan-300 font-mono">{latestSimulation.efficiency}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-slate-400">Capacity</span>
                        <span className="text-cyan-300 font-mono">{latestSimulation.capacity}</span>
                      </div>
                    </div>
                    {/* Constraints met badge */}
                    <div className="mt-3 text-center">
                      {latestSimulation.meetsConstraints ? (
                        <LuminaBadge accent="emerald">
                          All Constraints Met
                        </LuminaBadge>
                      ) : (
                        <LuminaBadge accent="rose">
                          Constraints Not Met
                        </LuminaBadge>
                      )}
                    </div>
                  </LuminaCardContent>
                </LuminaCard>
              )}

              {/* Iteration counter */}
              <div className="text-center text-xs text-slate-500 font-mono">
                Design Iterations: {designLog.length}
              </div>
            </div>
          </div>

          {/* Simulation Animation */}
          {isSimulating && (
            <div className="mb-6 p-4 bg-slate-800/40 backdrop-blur-sm rounded-xl border border-cyan-500/20">
              <p className="text-center text-sm text-cyan-300 mb-2 font-mono">Running Simulation...</p>
              <SimulationAnimation domain={domain} onComplete={handleSimulationComplete} />
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <LuminaButton
              tone="primary"
              className="px-6 py-3 font-semibold"
              disabled={!canTest}
              onClick={handleTest}
            >
              {isSimulating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Design'
              )}
            </LuminaButton>
            <LuminaButton
              tone="ghost"
              onClick={handleReset}
              disabled={isSimulating}
            >
              Reset Parts
            </LuminaButton>
            {latestSimulation && !hasSubmittedEvaluation && (
              <LuminaButton
                tone="primary"
                className="bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30"
                onClick={handleSubmitFinal}
              >
                Submit Final Design
              </LuminaButton>
            )}
            {hasSubmittedEvaluation && (
              <LuminaBadge accent="emerald" className="text-sm py-2">
                Design Submitted!
              </LuminaBadge>
            )}
          </div>

          {/* Active Tips */}
          {activeTips.length > 0 && (
            <div className="mb-6 space-y-2">
              {activeTips.map((tip, i) => (
                <div key={i} className="p-3 bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <p className="text-amber-200 text-sm flex items-start gap-2 flex-1">
                      <span className="text-amber-400">Tip:</span> {tip.tip}
                    </p>
                    <LuminaReadAloud
                      iconOnly
                      size="sm"
                      accent="cyan"
                      speaking={isAudioPlaying}
                      aria-label="Read this tip to me"
                      className="flex-shrink-0"
                      onClick={() => readBlockAloud(tip.tip, '[READ_TIP]')}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Design Log */}
          {designLog.length > 0 && (
            <div className="mb-6">
              <LuminaButton
                tone="ghost"
                onClick={() => setShowDesignLog(!showDesignLog)}
                className="w-full justify-between px-4 py-3 text-sm font-semibold"
              >
                <span>Design Log ({designLog.length} iteration{designLog.length !== 1 ? 's' : ''})</span>
                <span className="text-slate-500">{showDesignLog ? '▲' : '▼'}</span>
              </LuminaButton>
              {showDesignLog && (
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                  {designLog.map((entry, i) => {
                    const body = partsPalette.bodies.find(b => b.id === entry.bodyId);
                    const prop = partsPalette.propulsion.find(p => p.id === entry.propulsionId);
                    const ctrls = partsPalette.controls.filter(c => entry.controlIds.includes(c.id));
                    const sim = entry.simulation;
                    return (
                      <LuminaPanel key={entry.id} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-300 font-semibold">Iteration {i + 1}</span>
                          {sim.meetsConstraints ? (
                            <LuminaBadge accent="emerald" className="text-[10px]">Pass</LuminaBadge>
                          ) : (
                            <LuminaBadge accent="rose" className="text-[10px]">Fail</LuminaBadge>
                          )}
                        </div>
                        <div className="text-slate-400">
                          {body?.name || '?'} + {prop?.name || '?'} + {ctrls.map(c => c.name).join(', ') || 'no controls'}
                        </div>
                        <div className="flex gap-3 mt-1 text-slate-500">
                          <span>Spd: {sim.topSpeed}</span>
                          <span>Rng: {sim.range}</span>
                          <span>Stb: {sim.stability}</span>
                          <span>Eff: {sim.efficiency}</span>
                        </div>
                      </LuminaPanel>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Educational Tips */}
          <LuminaPanel accent="indigo" className="p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Engineering Design Tips
              </h4>
              <LuminaReadAloud
                iconOnly
                size="sm"
                accent="cyan"
                speaking={isAudioPlaying}
                aria-label="Read the design tips to me"
                className="flex-shrink-0"
                onClick={() => readBlockAloud(
                  'Design, then Test, then Analyze, then Iterate. Real engineers follow this cycle to improve their designs. '
                  + 'Change one thing at a time. If you change everything at once, you will not know what helped. '
                  + 'Trade-offs are real. A faster vehicle might use more fuel. A bigger body carries more but weighs more. Find the best balance!',
                  '[READ_DESIGN_TIPS]',
                )}
              />
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-indigo-400 font-semibold">Design → Test → Analyze → Iterate</span> — real engineers follow this cycle to improve their designs.
              </p>
              <p className="text-slate-300">
                <span className="text-cyan-400 font-semibold">Change one thing at a time</span> — if you change everything at once, you won&apos;t know what helped!
              </p>
              <p className="text-slate-300">
                <span className="text-amber-400 font-semibold">Trade-offs are real</span> — a faster vehicle might use more fuel. A bigger body carries more but weighs more. Find the best balance!
              </p>
            </div>
          </LuminaPanel>
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default VehicleDesignStudio;
