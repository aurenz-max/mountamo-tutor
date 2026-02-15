'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type EngineExplorerMetrics,
} from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * Engine Explorer — How Machines Are Powered
 *
 * Grades 1-5 Engineering Primitive for understanding:
 * - Engines make things go; fuel gives energy (Grade 1)
 * - Engine parts move in cycles (Grade 2)
 * - Energy transformation: fuel → heat → motion (Grade 3)
 * - Comparing engine efficiency (Grade 4)
 * - Thermodynamic principles and energy losses (Grade 5)
 *
 * Four interaction phases: Watch, Explore, Compare, Connect
 *
 * EVALUATION INTEGRATION:
 * - Tracks components identified, cycle stages understood, energy flow traced
 * - Supports competency tracking via skillId/subskillId/objectiveId
 */

// ---- Sub-interfaces ----

export interface EngineComponentItem {
  id: string;
  name: string;
  function: string;
  analogy: string;
  position: { x: number; y: number };
}

export interface CycleStage {
  order: number;
  name: string;
  description: string;
  narration: string;
  visualDescription: string;
  energyState: string;
}

export interface EngineCycle {
  name: string;
  stages: CycleStage[];
}

export interface EnergyFlow {
  input: string;
  transformations: string[];
  output: string;
  efficiency: string | null;
  losses: string[];
}

export interface VehicleConnection {
  vehicle: string;
  howConnected: string;
  whyThisEngine: string;
}

export interface ComparisonPoint {
  feature: string;
  thisEngine: string;
  vs: string;
  vsValue: string;
}

// ---- Main Data Interface (single source of truth) ----

export interface EngineExplorerData {
  title: string;
  description: string;
  engineType: string;
  engineName: string;
  vehicleContext: string;
  overview: string;
  components: EngineComponentItem[];
  cycle: EngineCycle;
  energyFlow: EnergyFlow;
  vehicleConnection: VehicleConnection;
  comparisonPoints: ComparisonPoint[];
  gradeBand: '1-2' | '3-5';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: import('../../../evaluation').PrimitiveEvaluationResult<EngineExplorerMetrics>) => void;
}

interface EngineExplorerProps {
  data: EngineExplorerData;
  className?: string;
}

type Phase = 'watch' | 'explore' | 'compare' | 'connect';

const PHASE_TABS: { id: Phase; label: string; icon: string }[] = [
  { id: 'watch', label: 'Watch', icon: '▶' },
  { id: 'explore', label: 'Explore', icon: '🔍' },
  { id: 'compare', label: 'Compare', icon: '⚖' },
  { id: 'connect', label: 'Connect', icon: '🔗' },
];

const ENGINE_THEMES: Record<string, { icon: string; accentClass: string }> = {
  jet_turbofan:   { icon: '✈️', accentClass: 'border-blue-500/30' },
  piston_4stroke: { icon: '🚗', accentClass: 'border-orange-500/30' },
  electric_motor: { icon: '⚡', accentClass: 'border-green-500/30' },
  steam:          { icon: '🚂', accentClass: 'border-amber-500/30' },
  diesel:         { icon: '🚛', accentClass: 'border-red-500/30' },
  turboprop:      { icon: '🛩️', accentClass: 'border-cyan-500/30' },
  rocket:         { icon: '🚀', accentClass: 'border-purple-500/30' },
};

// SVG canvas constants
const SVG_W = 620;
const SVG_H = 360;
const PAD = 40;

const EngineExplorer: React.FC<EngineExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    engineType = 'piston_4stroke',
    engineName,
    vehicleContext,
    overview,
    components = [],
    cycle,
    energyFlow,
    vehicleConnection,
    comparisonPoints = [],
    gradeBand = '3-5',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ---- State ----
  const [phase, setPhase] = useState<Phase>('watch');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exploredComponents, setExploredComponents] = useState<Set<string>>(new Set());
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [throttle, setThrottle] = useState(30);
  const [showEnergyFlow, setShowEnergyFlow] = useState(false);
  const [stagesViewed, setStagesViewed] = useState<Set<number>>(new Set([0]));
  const [vehicleMatchAttempted, setVehicleMatchAttempted] = useState(false);
  const [vehicleMatchCorrect, setVehicleMatchCorrect] = useState(false);

  const resolvedInstanceId = instanceId ?? `engine-explorer-${Date.now()}`;
  const theme = ENGINE_THEMES[engineType] || ENGINE_THEMES.piston_4stroke;
  const stages = cycle?.stages || [];

  // ---- Evaluation Hook ----
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EngineExplorerMetrics>({
    primitiveType: 'engine-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: import('../../../evaluation').PrimitiveEvaluationResult) => void) | undefined,
  });

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    engineType,
    engineName,
    vehicleContext,
    currentPhase: phase,
    currentStage: stages[currentStageIndex]?.name || '',
    throttlePosition: throttle,
    componentsExplored: Array.from(exploredComponents).join(', '),
    totalComponents: components.length,
    overview,
  }), [engineType, engineName, vehicleContext, phase, stages, currentStageIndex, throttle, exploredComponents, components.length, overview]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'engine-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '1-2' ? 'K-2' : '3-5',
  });

  // ---- Auto-play cycle ----
  useEffect(() => {
    if (!isPlaying || stages.length === 0) return;
    const speed = Math.max(1500, 4000 - throttle * 25);
    const timer = setInterval(() => {
      setCurrentStageIndex(prev => {
        const next = (prev + 1) % stages.length;
        setStagesViewed(s => new Set(s).add(next));
        if (next === 0) setIsPlaying(false);
        return next;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [isPlaying, stages.length, throttle]);

  // ---- AI: Activity Start ----
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Student is exploring a ${engineName} (${engineType}) engine. `
      + `Vehicle context: ${vehicleContext}. Grade band: ${gradeBand}. `
      + `Overview: ${overview}. `
      + `Welcome them warmly and introduce what this engine does using an everyday analogy.`,
      { silent: true },
    );
  }, [isConnected, engineName, engineType, vehicleContext, gradeBand, overview, sendText]);

  // ---- AI: Stage Change ----
  const prevStageRef = useRef(currentStageIndex);
  useEffect(() => {
    if (prevStageRef.current !== currentStageIndex && isConnected && phase === 'watch') {
      const stage = stages[currentStageIndex];
      if (stage) {
        sendText(
          `[NEXT_STAGE] Now showing stage ${stage.order}: "${stage.name}". `
          + `${stage.narration} `
          + `Energy state: ${stage.energyState}. `
          + `Narrate this stage conversationally and ask a comprehension check.`,
          { silent: true },
        );
      }
    }
    prevStageRef.current = currentStageIndex;
  }, [currentStageIndex, isConnected, phase, stages, sendText]);

  // ---- Component click handler ----
  const handleComponentClick = useCallback((comp: EngineComponentItem) => {
    setSelectedComponentId(comp.id);
    setExploredComponents(prev => {
      const next = new Set(prev);
      const isNew = !next.has(comp.id);
      next.add(comp.id);

      if (isNew && isConnected) {
        sendText(
          `[COMPONENT_EXPLORED] Student tapped "${comp.name}". `
          + `Function: ${comp.function}. Analogy: ${comp.analogy}. `
          + `They've explored ${next.size}/${components.length} components. `
          + `Explain this component using the analogy. Ask what they think it connects to.`,
          { silent: true },
        );
      }
      if (next.size === components.length && isConnected) {
        sendText(
          `[ALL_COMPONENTS_EXPLORED] Student has explored all ${components.length} components! `
          + `Celebrate and suggest trying the Compare phase.`,
          { silent: true },
        );
      }
      return next;
    });
  }, [isConnected, components.length, sendText]);

  // ---- Phase change AI triggers ----
  useEffect(() => {
    if (!isConnected) return;
    if (phase === 'compare' && comparisonPoints.length > 0) {
      sendText(
        `[COMPARE_MODE] Student switched to Compare mode. Comparing ${engineName} against ${comparisonPoints[0]?.vs?.replace(/_/g, ' ') || 'another engine'}. `
        + `Guide them to notice key differences.`,
        { silent: true },
      );
    }
    if (phase === 'connect') {
      sendText(
        `[CONNECT_MODE] Student is now in Connect mode, seeing how the ${engineName} connects to the ${vehicleConnection?.vehicle || vehicleContext}. `
        + `Ask them why they think this vehicle uses this type of engine.`,
        { silent: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- Submit Evaluation ----
  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const metrics: EngineExplorerMetrics = {
      type: 'engine-explorer',
      componentsIdentified: exploredComponents.size,
      componentsTotal: components.length,
      cycleStagesUnderstood: stagesViewed.size,
      energyFlowTraced: showEnergyFlow,
      comparisonsExplored: phase === 'compare' || comparisonPoints.length > 0 ? 1 : 0,
      vehicleMatchesCorrect: vehicleMatchCorrect ? 1 : 0,
      vehicleMatchesTotal: vehicleMatchAttempted ? 1 : 0,
      engineTypesExplored: 1,
      attemptsCount: 1,
    };

    const score =
      (exploredComponents.size / Math.max(components.length, 1)) * 30 +
      (stagesViewed.size / Math.max(stages.length, 1)) * 30 +
      (showEnergyFlow ? 20 : 0) +
      (vehicleMatchCorrect ? 20 : 0);

    submitEvaluation(score >= 50, score, metrics, {
      engineType,
      componentsExplored: Array.from(exploredComponents),
    });

    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Student completed the engine explorer! Score: ${Math.round(score)}%. `
        + `Components explored: ${exploredComponents.size}/${components.length}. `
        + `Stages viewed: ${stagesViewed.size}/${stages.length}. `
        + `Celebrate their exploration!`,
        { silent: true },
      );
    }
  }, [
    hasSubmittedEvaluation, exploredComponents, components.length,
    stagesViewed.size, stages.length, showEnergyFlow,
    vehicleMatchCorrect, vehicleMatchAttempted, comparisonPoints.length,
    phase, engineType, submitEvaluation, isConnected, sendText,
  ]);

  // ---- Derived values ----
  const currentStage = stages[currentStageIndex];
  const selectedComponent = components.find(c => c.id === selectedComponentId);
  const rpm = Math.round(throttle * 80);

  // Convert data position (%) to SVG coordinates
  const toSvg = (pos: { x: number; y: number }) => ({
    x: (pos.x / 100) * (SVG_W - PAD * 2) + PAD,
    y: (pos.y / 100) * (SVG_H - PAD * 2) + PAD,
  });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* ---- Header ---- */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className={`w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center border ${theme.accentClass} shadow-lg`}>
          <span className="text-2xl">{theme.icon}</span>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              Engine Explorer Lab
            </p>
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white text-lg">{engineName}</CardTitle>
              <p className="text-slate-400 text-sm mt-1">{overview}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {engineType.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300">
                {vehicleContext}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ---- Phase Tabs ---- */}
          <div className="flex gap-2 flex-wrap">
            {PHASE_TABS.map(tab => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setPhase(tab.id)}
                className={`border transition-all ${
                  phase === tab.id
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Button>
            ))}
          </div>

          {/* ==== WATCH PHASE ==== */}
          {phase === 'watch' && (
            <div className="space-y-4">
              {/* Engine Diagram */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ maxHeight: '360px' }}>
                  <defs>
                    <linearGradient id="engineWatchBg" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0F172A" />
                      <stop offset="100%" stopColor="#1E293B" />
                    </linearGradient>
                  </defs>

                  <rect width={SVG_W} height={SVG_H} fill="url(#engineWatchBg)" />

                  {/* Connection lines */}
                  {components.length > 1 && components.map((comp, i) => {
                    if (i === 0) return null;
                    const a = toSvg(components[i - 1].position);
                    const b = toSvg(comp.position);
                    return (
                      <line key={`wl-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="rgba(148,163,184,0.15)" strokeWidth={1.5} strokeDasharray="6,4" />
                    );
                  })}

                  {/* Component circles */}
                  {components.map(comp => {
                    const { x, y } = toSvg(comp.position);
                    return (
                      <g key={comp.id}>
                        <circle cx={x} cy={y} r={18} fill="rgba(100,116,139,0.25)" stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />
                        <text x={x} y={y - 24} textAnchor="middle" fill="#94A3B8" fontSize="10" fontFamily="monospace">
                          {comp.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Current stage highlight box */}
                  {currentStage && (
                    <g>
                      <rect x={SVG_W / 2 - 180} y={SVG_H - 75} width={360} height={55} rx={12}
                        fill="rgba(6,182,212,0.12)" stroke="rgba(6,182,212,0.4)" strokeWidth={1.5} />
                      <text x={SVG_W / 2} y={SVG_H - 50} textAnchor="middle" fill="#22D3EE" fontSize="13" fontWeight="bold">
                        Stage {currentStage.order}: {currentStage.name}
                      </text>
                      <text x={SVG_W / 2} y={SVG_H - 32} textAnchor="middle" fill="#94A3B8" fontSize="10">
                        {currentStage.energyState}
                      </text>
                    </g>
                  )}

                  {/* Cycle name label */}
                  <text x={16} y={22} fill="#475569" fontSize="11" fontFamily="monospace">
                    {cycle?.name || 'Engine Cycle'}
                  </text>
                </svg>
              </div>

              {/* Narration Card */}
              {currentStage && (
                <Card className="backdrop-blur-xl bg-cyan-500/5 border-cyan-500/20">
                  <CardContent className="py-4">
                    <p className="text-slate-200 text-sm italic leading-relaxed">&ldquo;{currentStage.narration}&rdquo;</p>
                    <p className="text-slate-500 text-xs mt-2">{currentStage.visualDescription}</p>
                  </CardContent>
                </Card>
              )}

              {/* Stage Stepper Controls */}
              <div className="flex items-center justify-center gap-3">
                <Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10"
                  disabled={currentStageIndex === 0}
                  onClick={() => {
                    const idx = currentStageIndex - 1;
                    setCurrentStageIndex(idx);
                    setStagesViewed(s => new Set(s).add(idx));
                    setIsPlaying(false);
                  }}
                >
                  ◀ Prev
                </Button>

                <Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10"
                  onClick={() => {
                    setIsPlaying(!isPlaying);
                    if (!isPlaying && currentStageIndex === stages.length - 1) {
                      setCurrentStageIndex(0);
                    }
                  }}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play Cycle'}
                </Button>

                <Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10"
                  disabled={currentStageIndex === stages.length - 1}
                  onClick={() => {
                    const idx = currentStageIndex + 1;
                    setCurrentStageIndex(idx);
                    setStagesViewed(s => new Set(s).add(idx));
                    setIsPlaying(false);
                  }}
                >
                  Next ▶
                </Button>
              </div>

              {/* Stage dot indicators */}
              <div className="flex justify-center gap-2">
                {stages.map((stage, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentStageIndex(i);
                      setStagesViewed(s => new Set(s).add(i));
                      setIsPlaying(false);
                    }}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      i === currentStageIndex
                        ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300'
                        : stagesViewed.has(i)
                          ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                          : 'bg-slate-700/50 border border-slate-600/50 text-slate-400'
                    }`}
                  >
                    {stage.order}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ==== EXPLORE PHASE ==== */}
          {phase === 'explore' && (
            <div className="space-y-4">
              {/* Interactive component diagram */}
              <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ maxHeight: '360px' }}>
                  <defs>
                    <linearGradient id="engineExploreBg" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0F172A" />
                      <stop offset="100%" stopColor="#1E293B" />
                    </linearGradient>
                  </defs>

                  <rect width={SVG_W} height={SVG_H} fill="url(#engineExploreBg)" />

                  {/* Connection lines */}
                  {components.length > 1 && components.map((comp, i) => {
                    if (i === 0) return null;
                    const a = toSvg(components[i - 1].position);
                    const b = toSvg(comp.position);
                    return (
                      <line key={`el-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="rgba(148,163,184,0.15)" strokeWidth={1.5} strokeDasharray="6,4" />
                    );
                  })}

                  {/* Component hotspots */}
                  {components.map(comp => {
                    const { x, y } = toSvg(comp.position);
                    const isSelected = selectedComponentId === comp.id;
                    const isExplored = exploredComponents.has(comp.id);

                    return (
                      <g key={comp.id} onClick={() => handleComponentClick(comp)} style={{ cursor: 'pointer' }}>
                        {/* Pulse ring for unexplored */}
                        {!isExplored && (
                          <circle cx={x} cy={y} r={26} fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth={2}>
                            <animate attributeName="r" from="22" to="30" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}

                        {/* Main circle */}
                        <circle cx={x} cy={y} r={22}
                          fill={isSelected ? 'rgba(6,182,212,0.3)' : isExplored ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.3)'}
                          stroke={isSelected ? '#22D3EE' : isExplored ? '#22C55E' : '#94A3B8'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />

                        {/* Checkmark for explored */}
                        {isExplored && !isSelected && (
                          <text x={x} y={y + 5} textAnchor="middle" fill="#22C55E" fontSize="14" fontWeight="bold">✓</text>
                        )}

                        {/* Label */}
                        <text x={x} y={y - 28} textAnchor="middle" fill={isSelected ? '#22D3EE' : '#CBD5E1'}
                          fontSize="10" fontWeight={isSelected ? 'bold' : 'normal'}>
                          {comp.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Progress counter */}
                  <text x={SVG_W - 16} y={22} textAnchor="end" fill="#475569" fontSize="11" fontFamily="monospace">
                    {exploredComponents.size}/{components.length} explored
                  </text>
                </svg>
              </div>

              {/* Selected component info card */}
              {selectedComponent ? (
                <Card className="backdrop-blur-xl bg-cyan-500/5 border-cyan-500/20 animate-fade-in">
                  <CardContent className="py-4 space-y-2">
                    <h4 className="text-white font-semibold text-lg">{selectedComponent.name}</h4>
                    <p className="text-slate-300 text-sm">{selectedComponent.function}</p>
                    <div className="flex items-start gap-2 mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <span className="text-amber-400 shrink-0">💡</span>
                      <p className="text-amber-200 text-sm italic">{selectedComponent.analogy}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-center text-slate-500 text-sm">Tap a component on the diagram to learn about it!</p>
              )}

              {/* Throttle + RPM */}
              <div className="flex items-center gap-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div className="flex-1">
                  <label className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2 block">
                    Throttle
                  </label>
                  <input
                    type="range" min={0} max={100} value={throttle}
                    onChange={e => setThrottle(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
                <div className="text-center min-w-[80px]">
                  <div className="text-2xl font-bold text-cyan-300 font-mono">{rpm}</div>
                  <div className="text-slate-500 text-xs font-mono">RPM</div>
                </div>
              </div>
            </div>
          )}

          {/* ==== COMPARE PHASE ==== */}
          {phase === 'compare' && (
            <div className="space-y-4">
              {comparisonPoints.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/40">
                        <th className="text-left py-3 px-4 text-slate-400 font-mono text-xs uppercase">Feature</th>
                        <th className="text-left py-3 px-4 text-cyan-400 font-mono text-xs uppercase">
                          {engineType.replace(/_/g, ' ')}
                        </th>
                        <th className="text-left py-3 px-4 text-amber-400 font-mono text-xs uppercase">
                          {comparisonPoints[0]?.vs?.replace(/_/g, ' ') || 'Other'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonPoints.map((point, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-medium">{point.feature}</td>
                          <td className="py-3 px-4 text-slate-200">{point.thisEngine}</td>
                          <td className="py-3 px-4 text-slate-200">{point.vsValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 text-sm py-8">No comparison data available for this engine.</p>
              )}
            </div>
          )}

          {/* ==== CONNECT PHASE ==== */}
          {phase === 'connect' && vehicleConnection && (
            <div className="space-y-4">
              <Card className="backdrop-blur-xl bg-slate-800/30 border-slate-700/50">
                <CardContent className="py-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{theme.icon}</span>
                    <div>
                      <h4 className="text-white font-semibold text-lg">{vehicleConnection.vehicle}</h4>
                      <p className="text-slate-400 text-sm">Powered by: {engineName}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                      <p className="text-cyan-400 text-xs font-mono uppercase mb-1">How it&apos;s connected</p>
                      <p className="text-slate-200 text-sm">{vehicleConnection.howConnected}</p>
                    </div>
                    <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                      <p className="text-green-400 text-xs font-mono uppercase mb-1">Why this engine?</p>
                      <p className="text-slate-200 text-sm">{vehicleConnection.whyThisEngine}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comprehension check */}
              {!vehicleMatchAttempted && (
                <Card className="backdrop-blur-xl bg-amber-500/5 border-amber-500/20">
                  <CardContent className="py-4">
                    <p className="text-slate-200 text-sm mb-3">
                      Why is a <span className="text-cyan-300 font-semibold">{engineType.replace(/_/g, ' ')}</span>{' '}
                      the right engine for a <span className="text-amber-300 font-semibold">{vehicleConnection.vehicle}</span>?
                    </p>
                    <div className="flex gap-2">
                      <Button variant="ghost"
                        className="bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20"
                        onClick={() => {
                          setVehicleMatchAttempted(true);
                          setVehicleMatchCorrect(true);
                          if (isConnected) {
                            sendText(
                              `[ANSWER_CORRECT] Student confirmed they understand why a ${engineType} powers the ${vehicleConnection.vehicle}. `
                              + `Celebrate and ask a follow-up about efficiency or alternatives.`,
                              { silent: true },
                            );
                          }
                        }}
                      >
                        I understand why!
                      </Button>
                      <Button variant="ghost"
                        className="bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10"
                        onClick={() => {
                          setVehicleMatchAttempted(true);
                          setVehicleMatchCorrect(false);
                          if (isConnected) {
                            sendText(
                              `[NEEDS_HELP] Student isn't sure why a ${engineType} is used for ${vehicleConnection.vehicle}. `
                              + `Reason: ${vehicleConnection.whyThisEngine}. `
                              + `Explain using simple everyday analogies.`,
                              { silent: true },
                            );
                          }
                        }}
                      >
                        I&apos;m not sure yet
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {vehicleMatchAttempted && (
                <div className={`p-3 rounded-lg ${
                  vehicleMatchCorrect
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  <p className={`text-sm ${vehicleMatchCorrect ? 'text-green-300' : 'text-amber-300'}`}>
                    {vehicleMatchCorrect
                      ? 'Great! You understand the engine-vehicle connection!'
                      : 'No worries! The AI tutor can help explain it.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ==== ENERGY FLOW (Watch & Explore phases) ==== */}
          {(phase === 'watch' || phase === 'explore') && energyFlow && (
            <div className="space-y-3">
              <Button variant="ghost"
                className="bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10 w-full justify-start"
                onClick={() => {
                  const willShow = !showEnergyFlow;
                  setShowEnergyFlow(willShow);
                  if (willShow && isConnected) {
                    sendText(
                      `[ENERGY_FLOW_VIEWED] Student opened the energy flow diagram. `
                      + `Input: ${energyFlow.input}. Transformations: ${energyFlow.transformations.join(' → ')}. `
                      + `Output: ${energyFlow.output}. `
                      + `Walk them through the energy transformations step by step.`,
                      { silent: true },
                    );
                  }
                }}
              >
                <span className="mr-2">{showEnergyFlow ? '▼' : '▶'}</span>
                Energy Flow
              </Button>

              {showEnergyFlow && (
                <Card className="backdrop-blur-xl bg-slate-800/30 border-slate-700/50 animate-fade-in">
                  <CardContent className="py-4 space-y-3">
                    {/* Flow chain */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                        {energyFlow.input}
                      </Badge>
                      {energyFlow.transformations.map((t, i) => (
                        <React.Fragment key={i}>
                          <span className="text-slate-500">→</span>
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                            {t}
                          </Badge>
                        </React.Fragment>
                      ))}
                      <span className="text-slate-500">→</span>
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        {energyFlow.output}
                      </Badge>
                    </div>

                    {/* Efficiency */}
                    {energyFlow.efficiency && (
                      <p className="text-slate-400 text-sm text-center">
                        Efficiency: <span className="text-amber-300">{energyFlow.efficiency}</span>
                      </p>
                    )}

                    {/* Losses */}
                    {energyFlow.losses.length > 0 && (
                      <div className="text-center">
                        <p className="text-slate-500 text-xs mb-1">Energy losses:</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                          {energyFlow.losses.map((loss, i) => (
                            <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-slate-400 text-xs">
                              {loss}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ==== Submit / Complete ==== */}
          {!hasSubmittedEvaluation && (exploredComponents.size > 0 || stagesViewed.size > 1) && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost"
                className="bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20"
                onClick={handleSubmitEvaluation}
              >
                ✓ I&apos;m Done Exploring
              </Button>
            </div>
          )}

          {hasSubmittedEvaluation && (
            <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-green-300 text-sm font-medium">Exploration complete! Great work!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EngineExplorer;
