'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Rocket, ArrowRight, ArrowLeft, Zap, Gauge, Lightbulb, ChevronRight, Check, X } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * PropulsionLab - Newton's Third Law in Action
 *
 * K-5 Engineering Primitive for understanding:
 * - How vehicles generate thrust (1-2)
 * - Newton's Third Law: action/reaction pairs (2-3)
 * - Medium dependence: propellers need air, rockets don't (3-5)
 * - Propulsion efficiency across environments (4-5)
 *
 * Real-world connections: jet engines, propellers, wheels, sails, rockets
 */

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface PropulsionType {
  id: string;
  name: string;
  method: 'propeller_air' | 'jet' | 'propeller_water' | 'wheel_friction' | 'sail' | 'paddle' | 'rocket' | 'electric';
  vehicle: string;
  actionDescription: string;
  reactionDescription: string;
  medium: 'air' | 'water' | 'ground' | 'vacuum' | 'wind';
  thrustRange: { min: number; max: number; unit: string };
  efficiency: string;
  mediumRequired: boolean;
  analogy: string;
  imagePrompt: string;
}

export interface NewtonThirdLaw {
  statement: string;
  examples: Array<{
    action: string;
    reaction: string;
    context: string;
  }>;
}

export interface WhatIfExperiment {
  scenario: string;
  prediction_options: string[];
  correctAnswer: string;
  explanation: string;
  relatedPropulsionId: string;
}

export interface PropulsionComparison {
  propulsionA: string;
  propulsionB: string;
  question: string;
  insight: string;
}

export interface PropulsionLabData {
  propulsionTypes: PropulsionType[];
  newtonThirdLaw: NewtonThirdLaw;
  whatIfExperiments: WhatIfExperiment[];
  comparisons: PropulsionComparison[];
  gradeBand: '1-2' | '3-5';
  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PropulsionLabProps {
  data: PropulsionLabData;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  propeller_air: 'text-sky-300',
  jet: 'text-orange-300',
  propeller_water: 'text-blue-300',
  wheel_friction: 'text-red-300',
  sail: 'text-teal-300',
  paddle: 'text-green-300',
  rocket: 'text-violet-300',
  electric: 'text-yellow-300',
};

const MEDIUM_LABELS: Record<string, string> = {
  air: 'Air',
  water: 'Water',
  ground: 'Ground',
  vacuum: 'Vacuum (no medium!)',
  wind: 'Wind',
};

// ─── Component ────────────────────────────────────────────────────────────────

const PropulsionLab: React.FC<PropulsionLabProps> = ({ data, className }) => {
  const { propulsionTypes, newtonThirdLaw, whatIfExperiments, comparisons, gradeBand } = data;

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedPropulsionId, setSelectedPropulsionId] = useState(propulsionTypes[0]?.id || '');
  const [phase, setPhase] = useState<'experience' | 'identify' | 'compare' | 'whatif'>('experience');
  const [showForceArrows, setShowForceArrows] = useState(true);
  const [throttle, setThrottle] = useState(50);
  const [propulsionTypesExplored, setPropulsionTypesExplored] = useState<Set<string>>(new Set([propulsionTypes[0]?.id]));
  const [pairsIdentified, setPairsIdentified] = useState<Set<string>>(new Set());
  const [whatIfIdx, setWhatIfIdx] = useState(0);
  const [whatIfAnswer, setWhatIfAnswer] = useState<string | null>(null);
  const [whatIfResults, setWhatIfResults] = useState<boolean[]>([]);
  const [comparisonsExplored, setComparisonsExplored] = useState<Set<number>>(new Set());
  const [mediumDependencyUnderstood, setMediumDependencyUnderstood] = useState(false);

  const selectedPropulsion = useMemo(
    () => propulsionTypes.find(p => p.id === selectedPropulsionId) || propulsionTypes[0],
    [propulsionTypes, selectedPropulsionId]
  );

  // ── Evaluation ────────────────────────────────────────────────────────────
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'propulsion-lab' as any,
    instanceId: data.instanceId || 'propulsion-lab-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── AI Tutoring ───────────────────────────────────────────────────────────
  const { sendText } = useLuminaAI({
    primitiveType: 'propulsion-lab' as any,
    instanceId: data.instanceId || `pl-${Date.now()}`,
    primitiveData: {
      selectedPropulsion: selectedPropulsion?.name,
      method: selectedPropulsion?.method,
      medium: selectedPropulsion?.medium,
      phase,
      showForceArrows,
      throttle,
      propulsionTypesExplored: propulsionTypesExplored.size,
    },
    gradeLevel: gradeBand === '1-2' ? 'kindergarten' : 'elementary',
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectPropulsion = useCallback((id: string) => {
    setSelectedPropulsionId(id);
    setPropulsionTypesExplored(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const prop = propulsionTypes.find(p => p.id === id);
    if (prop) {
      sendText?.(
        `[PROPULSION_SELECTED] Student is now exploring: ${prop.name} (${prop.method}). Vehicle: ${prop.vehicle}. Medium: ${prop.medium}. Describe how this propulsion works using the analogy.`,
        { silent: true }
      );
    }
  }, [propulsionTypes, sendText]);

  const identifyPair = useCallback((propId: string) => {
    if (!pairsIdentified.has(propId)) {
      setPairsIdentified(prev => {
        const next = new Set(prev);
        next.add(propId);
        return next;
      });
      sendText?.(
        `[PAIR_IDENTIFIED] Student correctly identified the action/reaction pair for ${propulsionTypes.find(p => p.id === propId)?.name}. Celebrate and reinforce Newton's Third Law!`,
        { silent: true }
      );
    }
  }, [pairsIdentified, propulsionTypes, sendText]);

  const handleWhatIfAnswer = useCallback((answer: string) => {
    const experiment = whatIfExperiments[whatIfIdx];
    if (!experiment) return;

    const isCorrect = answer === experiment.correctAnswer;
    setWhatIfAnswer(answer);
    setWhatIfResults(prev => [...prev, isCorrect]);

    // Check for medium dependency understanding
    if (experiment.scenario.toLowerCase().includes('space') || experiment.scenario.toLowerCase().includes('vacuum')) {
      if (isCorrect) setMediumDependencyUnderstood(true);
    }

    sendText?.(
      isCorrect
        ? `[WHAT_IF_CORRECT] Student correctly answered "${answer}" for: "${experiment.scenario}". Celebrate and explain the physics!`
        : `[WHAT_IF_INCORRECT] Student answered "${answer}" but correct answer is "${experiment.correctAnswer}" for: "${experiment.scenario}". Explain gently.`,
      { silent: true }
    );
  }, [whatIfIdx, whatIfExperiments, sendText]);

  const nextWhatIf = useCallback(() => {
    setWhatIfAnswer(null);
    if (whatIfIdx < whatIfExperiments.length - 1) {
      setWhatIfIdx(prev => prev + 1);
    } else if (!hasSubmitted) {
      // Submit evaluation
      submitResult(
        whatIfResults.filter(Boolean).length > whatIfResults.length / 2,
        Math.round(
          ((pairsIdentified.size / Math.max(propulsionTypes.length, 1)) * 40 +
           (whatIfResults.filter(Boolean).length / Math.max(whatIfResults.length, 1)) * 40 +
           (comparisonsExplored.size / Math.max(comparisons.length, 1)) * 20)
        ),
        {
          type: 'propulsion-lab' as any,
          actionReactionPairsIdentified: pairsIdentified.size,
          pairsTotal: propulsionTypes.length,
          whatIfCorrect: whatIfResults.filter(Boolean).length,
          whatIfTotal: whatIfExperiments.length,
          propulsionTypesExplored: propulsionTypesExplored.size,
          newtonThirdUnderstood: pairsIdentified.size >= 2,
          comparisonsCompleted: comparisonsExplored.size,
          comparisonsTotal: comparisons.length,
          mediumDependencyUnderstood,
          attemptsCount: whatIfResults.length,
        },
      );
    }
  }, [whatIfIdx, whatIfExperiments.length, hasSubmitted, submitResult, whatIfResults, pairsIdentified.size, propulsionTypes.length, propulsionTypesExplored.size, comparisonsExplored.size, comparisons.length, mediumDependencyUnderstood]);

  // ── Computed thrust ───────────────────────────────────────────────────────
  const currentThrust = useMemo(() => {
    if (!selectedPropulsion) return 0;
    const { min, max } = selectedPropulsion.thrustRange;
    return min + (throttle / 100) * (max - min);
  }, [selectedPropulsion, throttle]);

  // ── Render: Propulsion Selector ───────────────────────────────────────────
  const renderPropulsionSelector = () => (
    <div className="flex flex-wrap gap-2">
      {propulsionTypes.map(pt => {
        const isSelected = pt.id === selectedPropulsionId;
        const color = METHOD_COLORS[pt.method] || 'text-slate-300';
        return (
          <Button
            key={pt.id}
            variant="ghost"
            size="sm"
            onClick={() => selectPropulsion(pt.id)}
            className={`${isSelected ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/5 border border-white/20 hover:bg-white/10'}`}
          >
            <span className={color}>{pt.name}</span>
          </Button>
        );
      })}
    </div>
  );

  // ── Render: Force Visualization ───────────────────────────────────────────
  const renderForceVisualization = () => (
    <div className="relative p-8 rounded-xl bg-slate-800/50 border border-white/10 overflow-hidden">
      {/* Vehicle label */}
      <div className="text-center mb-4">
        <span className="text-lg font-medium text-slate-100">{selectedPropulsion.vehicle}</span>
        <p className={`text-sm ${METHOD_COLORS[selectedPropulsion.method]}`}>{selectedPropulsion.name}</p>
      </div>

      {/* Force arrows */}
      {showForceArrows && (
        <div className="flex items-center justify-center gap-4 my-6">
          {/* Action (backward) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <ArrowLeft className="w-6 h-6 text-orange-400" style={{ transform: `scaleX(${0.5 + throttle / 100})` }} />
              <span className="text-xs text-orange-300">Action</span>
            </div>
            <p className="text-xs text-slate-400 max-w-[140px] text-center mt-1">
              {selectedPropulsion.actionDescription}
            </p>
          </div>

          {/* Vehicle icon */}
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <Rocket className="w-8 h-8 text-slate-300" />
          </div>

          {/* Reaction (forward) */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <span className="text-xs text-green-300">Reaction</span>
              <ArrowRight className="w-6 h-6 text-green-400" style={{ transform: `scaleX(${0.5 + throttle / 100})` }} />
            </div>
            <p className="text-xs text-slate-400 max-w-[140px] text-center mt-1">
              {selectedPropulsion.reactionDescription}
            </p>
          </div>
        </div>
      )}

      {/* Throttle slider */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Throttle</label>
          <span className="text-xs text-slate-300">{currentThrust.toFixed(0)} {selectedPropulsion.thrustRange.unit}</span>
        </div>
        <input
          type="range"
          min={0} max={100}
          value={throttle}
          onChange={e => setThrottle(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-sky-400"
        />
      </div>

      {/* Medium badge */}
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-300 text-xs">
          Medium: {MEDIUM_LABELS[selectedPropulsion.medium]}
        </Badge>
        {selectedPropulsion.mediumRequired ? (
          <Badge variant="outline" className="bg-amber-500/10 border-amber-400/20 text-amber-300 text-xs">
            Needs {selectedPropulsion.medium}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-green-500/10 border-green-400/20 text-green-300 text-xs">
            Works anywhere!
          </Badge>
        )}
      </div>

      {/* Analogy */}
      <div className="mt-3 p-2 rounded-lg bg-white/5 flex items-start gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-400 italic">{selectedPropulsion.analogy}</p>
      </div>
    </div>
  );

  // ── Render: Identify Phase ────────────────────────────────────────────────
  const renderIdentifyPhase = () => (
    <div className="space-y-4">
      <Card className="backdrop-blur-xl bg-violet-500/5 border-violet-400/20">
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium text-violet-200 mb-2">Newton&apos;s Third Law</h4>
          <p className="text-sm text-slate-300 italic mb-3">&ldquo;{newtonThirdLaw.statement}&rdquo;</p>
          <div className="space-y-2">
            {newtonThirdLaw.examples.map((ex, i) => (
              <div key={i} className="p-2 rounded-lg bg-white/5 text-xs">
                <span className="text-orange-300">Action:</span> <span className="text-slate-300">{ex.action}</span>
                <br />
                <span className="text-green-300">Reaction:</span> <span className="text-slate-300">{ex.reaction}</span>
                <br />
                <span className="text-slate-500">{ex.context}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-slate-400">For each propulsion type, identify the action/reaction pair:</p>
      <div className="space-y-2">
        {propulsionTypes.map(pt => (
          <div key={pt.id} className={`p-3 rounded-lg border transition-all ${pairsIdentified.has(pt.id) ? 'bg-green-500/5 border-green-400/20' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm font-medium ${METHOD_COLORS[pt.method]}`}>{pt.name}</span>
                <span className="text-xs text-slate-500 ml-2">({pt.vehicle})</span>
              </div>
              {pairsIdentified.has(pt.id) ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => identifyPair(pt.id)}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs h-7"
                >
                  I found it!
                </Button>
              )}
            </div>
            {pairsIdentified.has(pt.id) && (
              <div className="mt-2 text-xs">
                <span className="text-orange-300">Action:</span> <span className="text-slate-400">{pt.actionDescription}</span>
                <br />
                <span className="text-green-300">Reaction:</span> <span className="text-slate-400">{pt.reactionDescription}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Render: Compare Phase ─────────────────────────────────────────────────
  const renderComparePhase = () => (
    <div className="space-y-4">
      {comparisons.map((comp, idx) => {
        const propA = propulsionTypes.find(p => p.id === comp.propulsionA);
        const propB = propulsionTypes.find(p => p.id === comp.propulsionB);
        const isExplored = comparisonsExplored.has(idx);
        return (
          <button
            key={idx}
            onClick={() => {
              setComparisonsExplored(prev => {
                const next = new Set(prev);
                next.add(idx);
                return next;
              });
              sendText?.(
                `[COMPARISON_EXPLORED] Student is comparing ${propA?.name} vs ${propB?.name}. Question: "${comp.question}". Share the insight: "${comp.insight}"`,
                { silent: true }
              );
            }}
            className={`w-full text-left p-4 rounded-xl border transition-all ${isExplored ? 'bg-sky-500/5 border-sky-400/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={`${METHOD_COLORS[propA?.method || ''] || 'text-slate-300'} bg-white/5 border-white/20 text-xs`}>
                {propA?.name}
              </Badge>
              <span className="text-slate-500 text-xs">vs</span>
              <Badge variant="outline" className={`${METHOD_COLORS[propB?.method || ''] || 'text-slate-300'} bg-white/5 border-white/20 text-xs`}>
                {propB?.name}
              </Badge>
            </div>
            <p className="text-sm text-slate-200">{comp.question}</p>
            {isExplored && (
              <p className="text-xs text-slate-400 mt-2 italic">{comp.insight}</p>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Render: What-If Phase ─────────────────────────────────────────────────
  const renderWhatIfPhase = () => {
    const experiment = whatIfExperiments[whatIfIdx];
    if (!experiment) return null;

    return (
      <Card className="backdrop-blur-xl bg-purple-500/5 border-purple-400/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-purple-200 flex items-center gap-2">
            <Zap className="w-4 h-4" /> What If? ({whatIfIdx + 1}/{whatIfExperiments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-200">{experiment.scenario}</p>

          <div className="space-y-2">
            {experiment.prediction_options.map((opt, i) => (
              <Button
                key={i}
                variant="ghost"
                disabled={whatIfAnswer !== null}
                onClick={() => handleWhatIfAnswer(opt)}
                className={`w-full justify-start bg-white/5 border border-white/20 hover:bg-white/10 text-left h-auto py-2 px-3
                  ${whatIfAnswer === opt
                    ? opt === experiment.correctAnswer
                      ? 'ring-2 ring-green-400 bg-green-500/10'
                      : 'ring-2 ring-red-400 bg-red-500/10'
                    : whatIfAnswer !== null && opt === experiment.correctAnswer
                      ? 'ring-2 ring-green-400/50 bg-green-500/5'
                      : ''
                  }`}
              >
                <span className="text-sm text-slate-200">{opt}</span>
                {whatIfAnswer === opt && (
                  opt === experiment.correctAnswer
                    ? <Check className="w-4 h-4 text-green-400 ml-auto" />
                    : <X className="w-4 h-4 text-red-400 ml-auto" />
                )}
              </Button>
            ))}
          </div>

          {whatIfAnswer && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-slate-300">{experiment.explanation}</p>
              <Button
                variant="ghost"
                onClick={nextWhatIf}
                className="mt-3 bg-white/5 border border-white/20 hover:bg-white/10"
              >
                {whatIfIdx < whatIfExperiments.length - 1 ? 'Next Experiment' : 'Finish'}
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
      color="139, 92, 246"
    >
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-100">Propulsion Lab</CardTitle>
                <p className="text-sm text-slate-400 mt-0.5">Newton&apos;s Third Law in Action</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400">
              Grades {gradeBand}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Phase Navigation */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'experience', label: '1. Experience' },
              { key: 'identify', label: '2. Identify' },
              { key: 'compare', label: '3. Compare' },
              { key: 'whatif', label: '4. What If?' },
            ] as const).map(p => (
              <Button
                key={p.key}
                variant="ghost"
                size="sm"
                onClick={() => setPhase(p.key)}
                className={`${phase === p.key ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Propulsion Selector (always visible) */}
          {(phase === 'experience' || phase === 'identify') && renderPropulsionSelector()}

          {/* Phase Content */}
          {phase === 'experience' && (
            <div className="space-y-4">
              {renderForceVisualization()}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setShowForceArrows(!showForceArrows)}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs"
                >
                  {showForceArrows ? 'Hide' : 'Show'} Force Arrows
                </Button>
              </div>
            </div>
          )}

          {phase === 'identify' && renderIdentifyPhase()}
          {phase === 'compare' && renderComparePhase()}
          {phase === 'whatif' && renderWhatIfPhase()}
        </CardContent>
      </Card>
    </SpotlightCard>
  );
};

export default PropulsionLab;
