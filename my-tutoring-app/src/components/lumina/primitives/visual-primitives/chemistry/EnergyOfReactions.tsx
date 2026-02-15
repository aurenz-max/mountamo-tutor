'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EnergyOfReactionsMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ReactionInfo {
  name: string;
  equation: string;
  type: 'exothermic' | 'endothermic';
  deltaH: number;
  activationEnergy: number;
  realWorldExample: string;
  imagePrompt?: string;
}

export interface EnergyDiagram {
  reactantLevel: number;
  productLevel: number;
  activationPeak: number;
  showCatalystPath: boolean;
  catalystActivation: number | null;
}

export interface BondEntry {
  bond: string;
  energy: number;
  count: number;
}

export interface BondEnergies {
  enabled: boolean;
  bondsBreaking: BondEntry[];
  bondsForming: BondEntry[];
}

export interface EnergyChallenge {
  id: string;
  type: 'classify' | 'read_diagram' | 'draw_diagram' | 'catalyst_effect' | 'calculate_deltaH' | 'predict';
  instruction: string;
  targetAnswer: string;
  hint: string;
  narration: string;
}

export interface EnergyShowOptions {
  showEnergyDiagram: boolean;
  showTemperatureGauge: boolean;
  showBondView: boolean;
  showRealWorldPanel: boolean;
  showCalculation: boolean;
  showCatalystComparison: boolean;
  animateReactionPath: boolean;
}

export interface EnergyOfReactionsData {
  title: string;
  description?: string;
  reaction: ReactionInfo;
  energyDiagram: EnergyDiagram;
  bondEnergies: BondEnergies;
  challenges: EnergyChallenge[];
  showOptions?: Partial<EnergyShowOptions>;
  gradeBand?: '5-6' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EnergyOfReactionsMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const REACTION_GLOW: Record<string, { bg: string; border: string; text: string }> = {
  exothermic: { bg: 'bg-orange-500/10', border: 'border-orange-400/30', text: 'text-orange-300' },
  endothermic: { bg: 'bg-cyan-500/10', border: 'border-cyan-400/30', text: 'text-cyan-300' },
};

// ============================================================================
// Sub-components
// ============================================================================

/** SVG-based enthalpy diagram showing energy levels and reaction pathway */
const EnthalpyDiagram: React.FC<{
  diagram: EnergyDiagram;
  reactionType: 'exothermic' | 'endothermic';
  deltaH: number;
  showCatalyst: boolean;
  animatePathProgress: number;
}> = ({ diagram, reactionType, deltaH, showCatalyst, animatePathProgress }) => {
  const { reactantLevel, productLevel, activationPeak, catalystActivation } = diagram;

  // Normalize to SVG coordinate space (0-100 height, inverted Y)
  const maxE = Math.max(reactantLevel, productLevel, activationPeak, catalystActivation ?? 0) * 1.2;
  const toY = (e: number) => 90 - (e / maxE) * 70;

  const rY = toY(reactantLevel);
  const pY = toY(productLevel);
  const peakY = toY(activationPeak);
  const catY = catalystActivation != null ? toY(catalystActivation) : null;

  // Reaction path curve (reactant → peak → product)
  const pathD = `M 15,${rY} C 35,${rY} 40,${peakY} 50,${peakY} C 60,${peakY} 65,${pY} 85,${pY}`;
  const catPathD = catY != null
    ? `M 15,${rY} C 35,${rY} 40,${catY} 50,${catY} C 60,${catY} 65,${pY} 85,${pY}`
    : null;

  const isExo = reactionType === 'exothermic';
  const pathColor = isExo ? '#f97316' : '#06b6d4';
  const arrowColor = isExo ? '#ef4444' : '#3b82f6';

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{isExo ? '\uD83D\uDD25' : '\u2744\uFE0F'}</span>
        <span className="text-slate-300 text-sm font-medium">Energy Diagram</span>
      </div>

      <svg viewBox="0 0 100 100" className="w-full h-56" preserveAspectRatio="xMidYMid meet">
        {/* Axes */}
        <line x1="10" y1="95" x2="10" y2="10" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <line x1="10" y1="95" x2="95" y2="95" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
        <text x="5" y="55" fill="rgba(255,255,255,0.3)" fontSize="3" textAnchor="middle" transform="rotate(-90,5,55)">Energy</text>
        <text x="50" y="99" fill="rgba(255,255,255,0.3)" fontSize="3" textAnchor="middle">Reaction Progress</text>

        {/* Catalyst path (dashed) */}
        {showCatalyst && catPathD && (
          <path d={catPathD} fill="none" stroke="#a855f7" strokeWidth="0.8" strokeDasharray="2,1.5" opacity="0.6" />
        )}

        {/* Main reaction path */}
        <path d={pathD} fill="none" stroke={pathColor} strokeWidth="1.2" opacity="0.8" />

        {/* Animated ball along path */}
        {animatePathProgress > 0 && (
          <circle r="2" fill={pathColor} opacity="0.9">
            <animateMotion dur="3s" repeatCount="indefinite" path={pathD} />
          </circle>
        )}

        {/* Reactant level line */}
        <line x1="12" y1={rY} x2="30" y2={rY} stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="1.5,1" />
        <text x="13" y={rY - 2} fill="rgba(255,255,255,0.6)" fontSize="3">Reactants</text>

        {/* Product level line */}
        <line x1="70" y1={pY} x2="90" y2={pY} stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="1.5,1" />
        <text x="71" y={pY - 2} fill="rgba(255,255,255,0.6)" fontSize="3">Products</text>

        {/* Activation energy arrow */}
        <line x1="50" y1={rY} x2="50" y2={peakY} stroke="#eab308" strokeWidth="0.6" markerEnd="url(#arrowUp)" />
        <text x="53" y={(rY + peakY) / 2} fill="#eab308" fontSize="2.5">Ea</text>

        {/* Delta H arrow */}
        <line x1="80" y1={rY} x2="80" y2={pY} stroke={arrowColor} strokeWidth="0.8" markerEnd="url(#arrowDelta)" />
        <text x="83" y={(rY + pY) / 2} fill={arrowColor} fontSize="2.5">{'\u0394'}H = {deltaH} kJ</text>

        {/* Catalyst label */}
        {showCatalyst && catY != null && (
          <text x="42" y={catY - 2} fill="#a855f7" fontSize="2.5">with catalyst</text>
        )}

        {/* Arrow markers */}
        <defs>
          <marker id="arrowUp" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,4 L2,0 L4,4" fill="none" stroke="#eab308" strokeWidth="0.5" />
          </marker>
          <marker id="arrowDelta" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,4 L2,0 L4,4" fill="none" stroke={arrowColor} strokeWidth="0.5" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

/** Temperature gauge showing heat change */
const TemperatureGauge: React.FC<{
  deltaH: number;
  reactionType: 'exothermic' | 'endothermic';
  active: boolean;
}> = ({ deltaH, reactionType, active }) => {
  const isExo = reactionType === 'exothermic';
  // Normalize temperature fill (0.3 = room temp, scales with deltaH magnitude)
  const magnitude = Math.min(Math.abs(deltaH) / 1000, 0.6);
  const fillPct = active ? (isExo ? 0.3 + magnitude : Math.max(0.05, 0.3 - magnitude)) : 0.3;

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">{'\uD83C\uDF21\uFE0F'}</span>
        <span className="text-slate-300 text-sm font-medium">Temperature</span>
      </div>

      {/* Thermometer */}
      <div className="relative w-6 h-36 bg-slate-700/50 rounded-full border border-white/10 overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000 ${
            isExo ? 'bg-gradient-to-t from-red-500 to-orange-400' : 'bg-gradient-to-t from-blue-600 to-cyan-400'
          }`}
          style={{ height: `${fillPct * 100}%` }}
        />
        {/* Scale marks */}
        {[0.2, 0.4, 0.6, 0.8].map(pct => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-white/10"
            style={{ bottom: `${pct * 100}%` }}
          />
        ))}
      </div>

      <Badge className={`text-[10px] ${
        isExo
          ? 'bg-red-500/20 text-red-300 border-red-400/30'
          : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
      }`}>
        {active
          ? isExo ? `+${Math.abs(deltaH)} kJ released` : `${Math.abs(deltaH)} kJ absorbed`
          : 'Room temperature'}
      </Badge>
    </div>
  );
};

/** Bond energy visualization showing breaking and forming */
const BondEnergyView: React.FC<{
  bondEnergies: BondEnergies;
  active: boolean;
}> = ({ bondEnergies, active }) => {
  const { bondsBreaking = [], bondsForming = [] } = bondEnergies;

  const totalBreaking = bondsBreaking.reduce((sum, b) => sum + b.energy * b.count, 0);
  const totalForming = bondsForming.reduce((sum, b) => sum + b.energy * b.count, 0);
  const netEnergy = totalBreaking - totalForming;

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{'\uD83D\uDD17'}</span>
        <span className="text-slate-300 text-sm font-medium">Bond Energies</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Breaking */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-red-400 text-xs font-medium">Breaking Bonds</span>
            <span className="text-red-400/60 text-[10px]">(costs energy)</span>
          </div>
          {bondsBreaking.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-mono">{b.count}&times; {b.bond}</span>
              <span className="text-red-400 font-mono">+{b.energy * b.count} kJ</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-1 flex justify-between text-sm font-bold">
            <span className="text-slate-300">Total in</span>
            <span className="text-red-400">+{totalBreaking} kJ</span>
          </div>
        </div>

        {/* Forming */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-blue-400 text-xs font-medium">Forming Bonds</span>
            <span className="text-blue-400/60 text-[10px]">(releases energy)</span>
          </div>
          {bondsForming.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-300 font-mono">{b.count}&times; {b.bond}</span>
              <span className="text-blue-400 font-mono">-{b.energy * b.count} kJ</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-1 flex justify-between text-sm font-bold">
            <span className="text-slate-300">Total out</span>
            <span className="text-blue-400">-{totalForming} kJ</span>
          </div>
        </div>
      </div>

      {/* Net energy */}
      {active && (
        <div className={`mt-3 rounded-lg p-2 text-center text-sm font-bold ${
          netEnergy > 0
            ? 'bg-cyan-500/10 border border-cyan-400/20 text-cyan-300'
            : 'bg-orange-500/10 border border-orange-400/20 text-orange-300'
        }`}>
          Net: {netEnergy > 0 ? `+${netEnergy}` : netEnergy} kJ &mdash;{' '}
          {netEnergy > 0 ? 'Endothermic (absorbs heat)' : 'Exothermic (releases heat)'}
        </div>
      )}
    </div>
  );
};

/** Real-world connection panel */
const RealWorldPanel: React.FC<{
  example: string;
  reactionType: 'exothermic' | 'endothermic';
  name: string;
}> = ({ example, reactionType, name }) => {
  const glow = REACTION_GLOW[reactionType];
  return (
    <div className={`rounded-xl p-3 border ${glow.bg} ${glow.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{'\uD83C\uDF0D'}</span>
        <span className={`text-sm font-medium ${glow.text}`}>Real-World Connection</span>
      </div>
      <p className="text-slate-300 text-sm">
        <span className="font-medium">{name}</span> is {reactionType === 'exothermic' ? 'an exothermic' : 'an endothermic'} reaction.
        Real-world example: <span className="text-slate-200 font-medium">{example}</span>.
      </p>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface EnergyOfReactionsProps {
  data: EnergyOfReactionsData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const EnergyOfReactions: React.FC<EnergyOfReactionsProps> = ({ data, className }) => {
  const {
    title,
    description,
    reaction,
    energyDiagram,
    bondEnergies,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '5-6',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showEnergyDiagram = true,
    showTemperatureGauge = true,
    showBondView = gradeBand === '7-8' && bondEnergies?.enabled,
    showRealWorldPanel = true,
    showCalculation = gradeBand === '7-8',
    showCatalystComparison = energyDiagram?.showCatalystPath ?? false,
    animateReactionPath = true,
  } = showOptionsProp;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [reactionActive, setReactionActive] = useState(false);
  const [showCatalyst, setShowCatalyst] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(0);

  // Challenge state
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Tracking
  const [classificationCorrect, setClassificationCorrect] = useState(0);
  const [classificationTotal, setClassificationTotal] = useState(0);
  const [diagramReadCorrect, setDiagramReadCorrect] = useState(0);
  const [diagramTotal, setDiagramTotal] = useState(0);
  const [activationEnergyUnderstood, setActivationEnergyUnderstood] = useState(false);
  const [catalystEffectExplained, setCatalystEffectExplained] = useState(false);
  const [bondCalcCorrect, setBondCalcCorrect] = useState(0);
  const [bondCalcTotal, setBondCalcTotal] = useState(0);
  const [realWorldConnectionMade, setRealWorldConnectionMade] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `energy-of-reactions-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const glow = REACTION_GLOW[reaction.type];

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EnergyOfReactionsMetrics>({
    primitiveType: 'energy-of-reactions',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------

  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    reactionName: reaction.name,
    reactionType: reaction.type,
    equation: reaction.equation,
    deltaH: reaction.deltaH,
    activationEnergy: reaction.activationEnergy,
    realWorldExample: reaction.realWorldExample,
    reactionActive,
    showCatalyst,
    bondEnergiesEnabled: bondEnergies?.enabled ?? false,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'classify',
    instruction: currentChallenge?.instruction ?? reaction.name,
    attemptNumber: currentAttempts + 1,
    studentAnswer: challengeAnswer,
  }), [
    gradeBand, reaction, reactionActive, showCatalyst, bondEnergies?.enabled,
    currentChallengeIndex, challenges.length, currentChallenge, currentAttempts, challengeAnswer,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'energy-of-reactions',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '5-6' ? 'Grade 5-6' : 'Grade 7-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is an Energy of Reactions activity: "${title}" for ${gradeBand}. `
      + `Reaction: ${reaction.name} (${reaction.equation}). Type: ${reaction.type}. `
      + `\u0394H = ${reaction.deltaH} kJ. Real-world example: ${reaction.realWorldExample}. `
      + `Introduce the activity: "Today we're exploring WHY some reactions feel hot and others feel cold!"`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, reaction, sendText]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const triggerReaction = useCallback(() => {
    setReactionActive(true);
    if (animateReactionPath) {
      setAnimateProgress(1);
    }

    sendText(
      `[REACTION_TRIGGERED] Student started the reaction. Type: ${reaction.type}. `
      + `\u0394H = ${reaction.deltaH} kJ. Ask: "What do you notice about the temperature? Is it going up or down?"`,
      { silent: true }
    );
  }, [animateReactionPath, reaction, sendText]);

  const toggleCatalyst = useCallback(() => {
    setShowCatalyst(prev => !prev);

    sendText(
      `[CATALYST_TOGGLED] Student ${!showCatalyst ? 'added' : 'removed'} catalyst view. `
      + `Activation energy: ${reaction.activationEnergy} kJ, with catalyst: ${energyDiagram.catalystActivation ?? 'N/A'} kJ. `
      + `Explain: "A catalyst lowers the activation energy — the reaction needs less of a 'push' to start!"`,
      { silent: true }
    );
  }, [showCatalyst, reaction.activationEnergy, energyDiagram.catalystActivation, sendText]);

  const handleSubmitAnswer = useCallback(() => {
    if (!challengeAnswer.trim() || !currentChallenge) return;

    setCurrentAttempts(prev => prev + 1);
    setTotalAttempts(prev => prev + 1);

    const answer = challengeAnswer.trim().toLowerCase();
    const target = String(currentChallenge.targetAnswer).toLowerCase();

    // Flexible matching — accept partial matches for classification
    const isCorrect = answer === target
      || (currentChallenge.type === 'classify' && (
        (target.includes('exo') && answer.includes('exo'))
        || (target.includes('endo') && answer.includes('endo'))
      ))
      || (currentChallenge.type === 'calculate_deltaH' && (
        Math.abs(parseFloat(answer) - parseFloat(target)) < 5
      ));

    if (isCorrect) {
      setFeedback('Correct! Great understanding of energy changes.');
      setFeedbackType('success');

      setChallengeResults(prev => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
      ]);

      // Track by type
      if (currentChallenge.type === 'classify') {
        setClassificationCorrect(prev => prev + 1);
        setClassificationTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'read_diagram' || currentChallenge.type === 'draw_diagram') {
        setDiagramReadCorrect(prev => prev + 1);
        setDiagramTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'catalyst_effect') {
        setCatalystEffectExplained(true);
      } else if (currentChallenge.type === 'calculate_deltaH') {
        setBondCalcCorrect(prev => prev + 1);
        setBondCalcTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'predict') {
        setRealWorldConnectionMade(true);
      }

      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" correctly for ${currentChallenge.type} challenge. `
        + `Attempt ${currentAttempts + 1}. Congratulate and reinforce the concept.`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. ${currentChallenge.hint}`);
      setFeedbackType('error');

      // Track incorrect classification/diagram attempts
      if (currentChallenge.type === 'classify') {
        setClassificationTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'read_diagram' || currentChallenge.type === 'draw_diagram') {
        setDiagramTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'calculate_deltaH') {
        setBondCalcTotal(prev => prev + 1);
      }

      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but correct is "${currentChallenge.targetAnswer}". `
        + `Challenge type: ${currentChallenge.type}. Attempt ${currentAttempts + 1}. `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }

    setChallengeAnswer('');
  }, [challengeAnswer, currentChallenge, currentAttempts, sendText]);

  const handleNextChallenge = useCallback(() => {
    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(prev => prev + 1);
      setCurrentAttempts(0);
      setFeedback('');
      setFeedbackType('');
      setChallengeAnswer('');

      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. `
        + `Type: ${challenges[currentChallengeIndex + 1]?.type}. Introduce it briefly.`,
        { silent: true }
      );
    } else {
      // All done
      sendText(
        `[ALL_COMPLETE] Student finished all ${challenges.length} challenges! `
        + `Classification: ${classificationCorrect}/${classificationTotal}. `
        + `Diagram reading: ${diagramReadCorrect}/${diagramTotal}. Celebrate!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const score = challenges.length > 0
          ? challengeResults.filter(r => r.correct).length / challenges.length
          : 0;
        submitEvaluation(
          score >= 0.5,
          score,
          {
            type: 'energy-of-reactions',
            classificationCorrect,
            classificationTotal,
            diagramReadCorrect,
            diagramTotal,
            activationEnergyUnderstood,
            catalystEffectExplained,
            bondEnergyCalculationCorrect: bondCalcCorrect,
            calculationTotal: bondCalcTotal,
            realWorldConnectionMade,
            attemptsCount: totalAttempts,
          },
          { challengeResults },
        );
      }
    }
  }, [
    currentChallengeIndex, challenges, sendText, classificationCorrect, classificationTotal,
    diagramReadCorrect, diagramTotal, activationEnergyUnderstood, catalystEffectExplained,
    bondCalcCorrect, bondCalcTotal, realWorldConnectionMade, totalAttempts,
    hasSubmittedEvaluation, submitEvaluation, challengeResults,
  ]);

  const isCurrentChallengeComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">{reaction.type === 'exothermic' ? '\uD83D\uDD25' : '\u2744\uFE0F'}</span>
              {title}
            </CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
              {gradeBand === '5-6' ? 'Grade 5-6' : 'Grade 7-8'}
            </Badge>
            <Badge className={`text-xs ${glow.bg} ${glow.text} ${glow.border}`}>
              {reaction.type === 'exothermic' ? 'Exothermic' : 'Endothermic'}
            </Badge>
          </div>
        </div>

        {/* Challenge progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs">Challenge</span>
            {challenges.map((c, i) => (
              <div
                key={c.id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                  challengeResults.some(r => r.challengeId === c.id && r.correct)
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                      : 'bg-slate-800/30 border-white/10 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reaction equation display */}
        <div className={`rounded-xl p-3 border text-center ${glow.bg} ${glow.border}`}>
          <p className="text-slate-200 font-mono text-lg">{reaction.equation}</p>
          <p className="text-slate-400 text-sm mt-1">{reaction.name}</p>
        </div>

        {/* Challenge instruction */}
        {currentChallenge && (
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Main visualization area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Energy diagram — takes 2 cols */}
          {showEnergyDiagram && (
            <div className="md:col-span-2">
              <EnthalpyDiagram
                diagram={energyDiagram}
                reactionType={reaction.type}
                deltaH={reaction.deltaH}
                showCatalyst={showCatalyst}
                animatePathProgress={animateProgress}
              />
            </div>
          )}

          {/* Temperature gauge */}
          {showTemperatureGauge && (
            <TemperatureGauge
              deltaH={reaction.deltaH}
              reactionType={reaction.type}
              active={reactionActive}
            />
          )}
        </div>

        {/* Bond energy view */}
        {showBondView && bondEnergies?.enabled && (
          <BondEnergyView bondEnergies={bondEnergies} active={reactionActive} />
        )}

        {/* Real-world connection */}
        {showRealWorldPanel && (
          <RealWorldPanel
            example={reaction.realWorldExample}
            reactionType={reaction.type}
            name={reaction.name}
          />
        )}

        {/* Reaction trigger + catalyst toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {!reactionActive && (
            <Button
              variant="ghost"
              className={`border ${glow.border} ${glow.bg} hover:opacity-80 ${glow.text}`}
              onClick={triggerReaction}
            >
              {reaction.type === 'exothermic' ? '\uD83D\uDD25' : '\u2744\uFE0F'} Start Reaction
            </Button>
          )}
          {reactionActive && (
            <Badge className={`${glow.bg} ${glow.text} ${glow.border} text-xs`}>
              Reaction in progress...
            </Badge>
          )}
          {showCatalystComparison && energyDiagram.catalystActivation != null && (
            <Button
              variant="ghost"
              size="sm"
              className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 ${
                showCatalyst ? 'ring-1 ring-purple-400/40' : ''
              }`}
              onClick={toggleCatalyst}
            >
              {showCatalyst ? 'Hide Catalyst' : 'Show Catalyst'}
            </Button>
          )}
          {reactionActive && (
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
              onClick={() => {
                setReactionActive(false);
                setAnimateProgress(0);
              }}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Challenge answer area */}
        {currentChallenge && !isCurrentChallengeComplete && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={challengeAnswer}
              onChange={(e) => setChallengeAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
              placeholder={
                currentChallenge.type === 'classify' ? 'exothermic or endothermic?'
                : currentChallenge.type === 'calculate_deltaH' ? 'Enter energy value (kJ)'
                : 'Type your answer...'
              }
              className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-white/20"
            />
            <Button
              variant="ghost"
              className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
              onClick={handleSubmitAnswer}
              disabled={!challengeAnswer.trim()}
            >
              Submit
            </Button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border text-sm ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
              : feedbackType === 'error'
                ? 'bg-red-500/10 border-red-400/20 text-red-300'
                : 'bg-slate-800/30 border-white/5 text-slate-400'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next challenge / Finish */}
        {isCurrentChallengeComplete && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
              onClick={handleNextChallenge}
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Educational accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="learn" className="border-white/10">
            <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
              What are exothermic and endothermic reactions?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  <span className="text-orange-300 font-medium">Exothermic</span> reactions
                  <span className="text-slate-300"> release</span> energy &mdash; they warm up their surroundings.
                  Think of burning wood, hand warmers, or a campfire.
                </p>
                <p>
                  <span className="text-cyan-300 font-medium">Endothermic</span> reactions
                  <span className="text-slate-300"> absorb</span> energy &mdash; they cool down their surroundings.
                  Think of cold packs, melting ice, or photosynthesis.
                </p>
                <p>
                  On the energy diagram: if products are <span className="text-orange-300">lower</span> than reactants,
                  energy came out (exothermic). If products are <span className="text-cyan-300">higher</span>,
                  energy went in (endothermic).
                </p>
                {gradeBand === '7-8' && (
                  <p>
                    <span className="text-amber-300 font-medium">Activation energy</span> is the &ldquo;push&rdquo; needed
                    to start ANY reaction. A <span className="text-purple-300">catalyst</span> lowers this barrier,
                    making the reaction happen faster without being consumed.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Completion summary */}
        {allChallengesComplete && (
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20">
            <p className="text-emerald-300 font-bold text-lg mb-2">All Challenges Complete!</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">Classification:</div>
              <div className="text-slate-200 font-mono">{classificationCorrect} / {classificationTotal}</div>
              <div className="text-slate-400">Diagram Reading:</div>
              <div className="text-slate-200 font-mono">{diagramReadCorrect} / {diagramTotal}</div>
              {bondEnergies?.enabled && (
                <>
                  <div className="text-slate-400">Bond Calculations:</div>
                  <div className="text-slate-200 font-mono">{bondCalcCorrect} / {bondCalcTotal}</div>
                </>
              )}
              <div className="text-slate-400">Total Attempts:</div>
              <div className="text-slate-200 font-mono">{totalAttempts}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnergyOfReactions;
