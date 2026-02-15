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
import type { MixingAndDissolvingMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Solvent {
  name: string;
  formula: string;
  volume: number;
  temperature: number;
}

export interface SubstanceEntry {
  id: string;
  name: string;
  formula: string | null;
  type: 'soluble' | 'insoluble' | 'partially_soluble' | 'immiscible_liquid';
  maxSolubility: number | null;
  solubilityVsTemp: 'increases' | 'decreases' | 'unchanged';
  color: string;
  particleColor: string;
  imagePrompt?: string;
}

export interface SeparationMethod {
  method: 'filtration' | 'evaporation' | 'distillation' | 'chromatography' | 'magnet' | 'decanting';
  worksFor: string[];
  description: string;
  animation: string;
}

export interface DissolvingChallenge {
  id: string;
  type: 'dissolve_sort' | 'particle_explain' | 'factor_test' | 'saturation' | 'separate' | 'concentration';
  instruction: string;
  targetAnswer: string;
  hint: string;
  narration: string;
}

export interface DissolvingShowOptions {
  showParticleView: boolean;
  showConcentrationMeter: boolean;
  showTemperatureControl: boolean;
  showSaturationIndicator: boolean;
  showSeparationTools: boolean;
  showSolubilityCurve: boolean;
}

export interface MixingAndDissolvingData {
  title: string;
  description?: string;
  solvent: Solvent;
  substances: SubstanceEntry[];
  separationMethods: SeparationMethod[];
  challenges: DissolvingChallenge[];
  showOptions?: Partial<DissolvingShowOptions>;
  imagePrompt?: string | null;
  gradeBand?: '3-5' | '6-7';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MixingAndDissolvingMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  soluble: { label: 'Dissolves', color: 'text-emerald-400' },
  insoluble: { label: 'Does not dissolve', color: 'text-red-400' },
  partially_soluble: { label: 'Partially dissolves', color: 'text-amber-400' },
  immiscible_liquid: { label: 'Does not mix', color: 'text-orange-400' },
};

const SEPARATION_ICONS: Record<string, string> = {
  filtration: '\uD83E\uDDFB',
  evaporation: '\u2600\uFE0F',
  distillation: '\uD83E\uDDEA',
  chromatography: '\uD83C\uDF08',
  magnet: '\uD83E\uDDF2',
  decanting: '\uD83E\uDED7',
};

// ============================================================================
// Sub-components
// ============================================================================

/** Animated beaker showing solution state */
const BeakerView: React.FC<{
  solvent: Solvent;
  addedSubstances: Array<{ substance: SubstanceEntry; amountG: number }>;
  isStirring: boolean;
  temperature: number;
}> = ({ solvent, addedSubstances, isStirring, temperature }) => {
  // Calculate solution color based on dissolved substances
  const dissolvedColors = addedSubstances
    .filter(s => s.substance.type === 'soluble' || s.substance.type === 'partially_soluble')
    .map(s => s.substance.color);
  const primaryColor = dissolvedColors[0] || 'rgba(100,180,255,0.3)';

  // Calculate saturation fraction for any dissolved substance
  const hasSaturated = addedSubstances.some(s => {
    if (!s.substance.maxSolubility) return false;
    return s.amountG > s.substance.maxSolubility * (solvent.volume / 100);
  });

  return (
    <div className="relative flex flex-col items-center">
      {/* Temperature display */}
      <Badge className="mb-2 bg-slate-800/50 text-slate-300 border-white/10 text-xs">
        {temperature}&deg;C
      </Badge>

      {/* Beaker */}
      <div className="relative w-36 h-44 border-2 border-white/20 rounded-b-xl bg-slate-800/20 overflow-hidden">
        {/* Liquid */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700"
          style={{
            height: '65%',
            background: `linear-gradient(to top, ${primaryColor}50, ${primaryColor}20)`,
          }}
        />

        {/* Undissolved particles at bottom */}
        {addedSubstances
          .filter(s => s.substance.type === 'insoluble' || hasSaturated)
          .map((s, i) => (
            <div
              key={s.substance.id}
              className="absolute bottom-1 flex gap-0.5 justify-center"
              style={{ left: `${20 + i * 25}%` }}
            >
              {Array.from({ length: Math.min(4, Math.ceil(s.amountG / 5)) }).map((_, j) => (
                <div
                  key={j}
                  className="w-2.5 h-2.5 rounded-sm opacity-80"
                  style={{ backgroundColor: s.substance.color }}
                />
              ))}
            </div>
          ))}

        {/* Immiscible liquid layer */}
        {addedSubstances
          .filter(s => s.substance.type === 'immiscible_liquid')
          .map(s => (
            <div
              key={s.substance.id}
              className="absolute left-0 right-0 h-6 opacity-60"
              style={{
                top: '10%',
                backgroundColor: s.substance.color,
              }}
            />
          ))}

        {/* Stirring animation */}
        {isStirring && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-spin border-t-transparent" />
          </div>
        )}
      </div>

      {/* Beaker label */}
      <span className="text-slate-500 text-xs mt-1">{solvent.name} ({solvent.volume} mL)</span>
    </div>
  );
};

/** Particle-level view of dissolving */
const ParticleView: React.FC<{
  addedSubstances: Array<{ substance: SubstanceEntry; amountG: number }>;
  solventName: string;
}> = ({ addedSubstances, solventName }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm">{'\uD83D\uDD2C'}</span>
      <span className="text-slate-300 text-sm font-medium">Particle View</span>
    </div>

    <div className="relative w-full h-40 bg-slate-900/40 rounded-lg border border-white/5 overflow-hidden">
      {/* Solvent molecules (blue circles) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={`solvent-${i}`}
          className="absolute w-3 h-3 rounded-full bg-blue-400/30 border border-blue-400/40 animate-pulse"
          style={{
            left: `${5 + (i % 5) * 20 + Math.random() * 10}%`,
            top: `${10 + Math.floor(i / 5) * 22 + Math.random() * 10}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${2 + Math.random()}s`,
          }}
        />
      ))}

      {/* Solute particles */}
      {addedSubstances.map(({ substance, amountG }) => {
        const isDissolved = substance.type === 'soluble' || substance.type === 'partially_soluble';
        const particleCount = Math.min(8, Math.ceil(amountG / 3));
        return Array.from({ length: particleCount }).map((_, i) => (
          <div
            key={`${substance.id}-${i}`}
            className={`absolute w-4 h-4 rounded-full border flex items-center justify-center ${
              isDissolved ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: substance.particleColor + '50',
              borderColor: substance.particleColor + '80',
              left: isDissolved
                ? `${10 + Math.random() * 75}%`
                : `${30 + (i % 3) * 12}%`,
              top: isDissolved
                ? `${10 + Math.random() * 70}%`
                : `${65 + Math.floor(i / 3) * 12}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <span className="text-[6px] font-bold text-white/80">
              {substance.name.charAt(0)}
            </span>
          </div>
        ));
      })}

      {/* Legend */}
      <div className="absolute bottom-1 right-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-400/50" />
          <span className="text-[8px] text-slate-500">{solventName}</span>
        </div>
        {addedSubstances.map(({ substance }) => (
          <div key={substance.id} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: substance.particleColor + '80' }} />
            <span className="text-[8px] text-slate-500">{substance.name}</span>
          </div>
        ))}
      </div>
    </div>

    <p className="text-slate-500 text-xs mt-2 italic text-center">
      Blue circles = {solventName} molecules. Colored particles = solute.
      {addedSubstances.some(s => s.substance.type === 'soluble')
        ? ' Dissolved particles spread out among the solvent molecules!'
        : ''}
    </p>
  </div>
);

/** Concentration meter */
const ConcentrationMeter: React.FC<{
  substances: Array<{ substance: SubstanceEntry; amountG: number }>;
  volumeML: number;
}> = ({ substances, volumeML }) => {
  const dissolvedG = substances
    .filter(s => s.substance.type === 'soluble' || s.substance.type === 'partially_soluble')
    .reduce((sum, s) => {
      const maxInVolume = s.substance.maxSolubility
        ? s.substance.maxSolubility * (volumeML / 100)
        : s.amountG;
      return sum + Math.min(s.amountG, maxInVolume);
    }, 0);
  const concentration = volumeML > 0 ? dissolvedG / volumeML : 0;
  const pct = Math.min(concentration * 200, 100); // Scale for visual

  return (
    <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{'\uD83D\uDCCA'}</span>
        <span className="text-slate-300 text-sm font-medium">Concentration</span>
      </div>
      <div className="w-full h-4 bg-slate-700/50 rounded-full overflow-hidden border border-white/10">
        <div
          className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-300/40 to-blue-500/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>Dilute</span>
        <span>{dissolvedG.toFixed(1)} g / {volumeML} mL</span>
        <span>Concentrated</span>
      </div>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface MixingAndDissolvingProps {
  data: MixingAndDissolvingData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const MixingAndDissolving: React.FC<MixingAndDissolvingProps> = ({ data, className }) => {
  const {
    title,
    description,
    solvent,
    substances = [],
    separationMethods = [],
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '3-5',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showParticleView = true,
    showConcentrationMeter = gradeBand === '6-7',
    showTemperatureControl = gradeBand !== '3-5' || false,
    showSaturationIndicator = true,
    showSeparationTools = true,
    showSolubilityCurve = gradeBand === '6-7',
  } = showOptionsProp;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [addedSubstances, setAddedSubstances] = useState<Array<{
    substance: SubstanceEntry;
    amountG: number;
  }>>([]);
  const [temperature, setTemperature] = useState(solvent.temperature);
  const [isStirring, setIsStirring] = useState(false);
  const [particleViewActive, setParticleViewActive] = useState(false);
  const [selectedSeparation, setSelectedSeparation] = useState<string | null>(null);
  const [separationResult, setSeparationResult] = useState<string | null>(null);

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
  const [dissolveSortCorrect, setDissolveSortCorrect] = useState(0);
  const [sortTotal, setSortTotal] = useState(0);
  const [particleExplanationGiven, setParticleExplanationGiven] = useState(false);
  const [factorsTestedCorrectly, setFactorsTestedCorrectly] = useState(0);
  const [factorsTotal, setFactorsTotal] = useState(0);
  const [saturationIdentified, setSaturationIdentified] = useState(false);
  const [separationMethodCorrect, setSeparationMethodCorrect] = useState(0);
  const [separationTotal, setSeparationTotal] = useState(0);
  const [substanceRecovered, setSubstanceRecovered] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `mixing-and-dissolving-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  // Check saturation
  const isSaturated = addedSubstances.some(s => {
    if (!s.substance.maxSolubility) return false;
    const adjustedMax = s.substance.solubilityVsTemp === 'increases'
      ? s.substance.maxSolubility * (1 + (temperature - 20) * 0.02)
      : s.substance.solubilityVsTemp === 'decreases'
        ? s.substance.maxSolubility * (1 - (temperature - 20) * 0.01)
        : s.substance.maxSolubility;
    return s.amountG > adjustedMax * (solvent.volume / 100);
  });

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<MixingAndDissolvingMetrics>({
    primitiveType: 'mixing-and-dissolving',
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
    solventName: solvent.name,
    temperature,
    addedSubstanceNames: addedSubstances.map(s => s.substance.name),
    addedSubstanceTypes: addedSubstances.map(s => s.substance.type),
    isSaturated,
    isStirring,
    particleViewActive,
    selectedSeparation,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'dissolve_sort',
    instruction: currentChallenge?.instruction ?? title,
    attemptNumber: currentAttempts + 1,
    studentAnswer: challengeAnswer,
  }), [
    gradeBand, solvent.name, temperature, addedSubstances, isSaturated, isStirring,
    particleViewActive, selectedSeparation, currentChallengeIndex, challenges.length,
    currentChallenge, currentAttempts, challengeAnswer, title,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'mixing-and-dissolving',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-7',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    const substanceNames = substances.map(s => s.name).join(', ');
    sendText(
      `[ACTIVITY_START] This is a Mixing and Dissolving activity: "${title}" for ${gradeBand}. `
      + `Solvent: ${solvent.name} (${solvent.volume} mL at ${solvent.temperature}\u00B0C). `
      + `Substances available: ${substanceNames}. `
      + `Introduce the activity: "Today we're exploring what happens when different substances meet water!"`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, solvent, substances, sendText]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const addSubstance = useCallback((substance: SubstanceEntry) => {
    const increment = 5; // 5g per add
    setAddedSubstances(prev => {
      const existing = prev.find(s => s.substance.id === substance.id);
      if (existing) {
        return prev.map(s =>
          s.substance.id === substance.id
            ? { ...s, amountG: s.amountG + increment }
            : s
        );
      }
      return [...prev, { substance, amountG: increment }];
    });

    sendText(
      `[SUBSTANCE_ADDED] Student added ${substance.name} to ${solvent.name}. `
      + `Type: ${substance.type}. `
      + (substance.type === 'soluble'
        ? `It dissolves! Ask: "What happened to the ${substance.name}? Where did it go?"`
        : substance.type === 'insoluble'
          ? `It doesn't dissolve! Ask: "Look \u2014 it's still sitting there. Why won't it dissolve?"`
          : substance.type === 'immiscible_liquid'
            ? `It doesn't mix! Ask: "See how it floats on top? Oil and water don't mix \u2014 why?"`
            : `It partially dissolves. Ask: "Some dissolved but some didn't. What do you think is happening?"`),
      { silent: true }
    );
  }, [solvent.name, sendText]);

  const handleStir = useCallback(() => {
    setIsStirring(true);
    setTimeout(() => setIsStirring(false), 2000);

    sendText(
      `[STIRRING] Student is stirring the mixture. `
      + `Ask: "Does stirring help things dissolve faster? Why might that be?"`,
      { silent: true }
    );
  }, [sendText]);

  const handleSeparation = useCallback((method: string) => {
    setSelectedSeparation(method);
    const sep = separationMethods.find(s => s.method === method);
    if (sep) {
      const recoveredNames = sep.worksFor.filter(name =>
        addedSubstances.some(s => s.substance.name === name)
      );
      if (recoveredNames.length > 0) {
        setSeparationResult(`${sep.method} recovered: ${recoveredNames.join(', ')}! ${sep.description}`);
        setSubstanceRecovered(true);
      } else {
        setSeparationResult(`${sep.method} didn't recover anything from this mixture. Try a different method!`);
      }

      sendText(
        `[SEPARATION_ATTEMPTED] Student tried ${method}. `
        + `Works for: ${sep.worksFor.join(', ')}. `
        + `Recovered: ${recoveredNames.join(', ') || 'nothing'}. `
        + (recoveredNames.length > 0
          ? `Celebrate: "You got it back! The ${recoveredNames[0]} was there all along \u2014 just hidden in the solution."`
          : `Guide: "That method works for different types of mixtures. Think about what kind of mixture you have."`),
        { silent: true }
      );
    }
  }, [separationMethods, addedSubstances, sendText]);

  const handleSubmitAnswer = useCallback(() => {
    if (!challengeAnswer.trim() || !currentChallenge) return;

    setCurrentAttempts(prev => prev + 1);
    setTotalAttempts(prev => prev + 1);

    const answer = challengeAnswer.trim().toLowerCase();
    const target = String(currentChallenge.targetAnswer).toLowerCase();
    const isCorrect = answer === target
      || target.split('|').some(t => answer.includes(t.trim()))
      || (currentChallenge.type === 'dissolve_sort' && (
        (target.includes('dissolve') && answer.includes('dissolve'))
        || (target.includes('insoluble') && (answer.includes('not') || answer.includes('insoluble')))
      ));

    if (isCorrect) {
      setFeedback('Correct! Great observation!');
      setFeedbackType('success');

      setChallengeResults(prev => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
      ]);

      // Track by type
      if (currentChallenge.type === 'dissolve_sort') {
        setDissolveSortCorrect(prev => prev + 1);
        setSortTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'particle_explain') {
        setParticleExplanationGiven(true);
      } else if (currentChallenge.type === 'factor_test') {
        setFactorsTestedCorrectly(prev => prev + 1);
        setFactorsTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'saturation') {
        setSaturationIdentified(true);
      } else if (currentChallenge.type === 'separate') {
        setSeparationMethodCorrect(prev => prev + 1);
        setSeparationTotal(prev => prev + 1);
      }

      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" for ${currentChallenge.type}. `
        + `Attempt ${currentAttempts + 1}. Congratulate!`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. ${currentChallenge.hint}`);
      setFeedbackType('error');

      if (currentChallenge.type === 'dissolve_sort') setSortTotal(prev => prev + 1);
      else if (currentChallenge.type === 'factor_test') setFactorsTotal(prev => prev + 1);
      else if (currentChallenge.type === 'separate') setSeparationTotal(prev => prev + 1);

      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but correct is "${currentChallenge.targetAnswer}". `
        + `Type: ${currentChallenge.type}. Attempt ${currentAttempts + 1}. Hint: "${currentChallenge.hint}"`,
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
      sendText(
        `[ALL_COMPLETE] Student finished all ${challenges.length} challenges! Celebrate!`,
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
            type: 'mixing-and-dissolving',
            dissolveSortCorrect,
            sortTotal,
            particleExplanationGiven,
            factorsTestedCorrectly,
            factorsTotal,
            saturationIdentified,
            separationMethodCorrect,
            separationTotal,
            substanceRecovered,
            concentrationEstimateAccuracy: 0,
            attemptsCount: totalAttempts,
          },
          { challengeResults },
        );
      }
    }
  }, [
    currentChallengeIndex, challenges, sendText, hasSubmittedEvaluation, submitEvaluation,
    challengeResults, dissolveSortCorrect, sortTotal, particleExplanationGiven,
    factorsTestedCorrectly, factorsTotal, saturationIdentified,
    separationMethodCorrect, separationTotal, substanceRecovered, totalAttempts,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">{'\uD83E\uDDEA'}</span>
              {title}
            </CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
              {gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-7'}
            </Badge>
            {isSaturated && showSaturationIndicator && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs animate-pulse">
                Saturated!
              </Badge>
            )}
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
        {/* Challenge instruction */}
        {currentChallenge && (
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Main workspace: Beaker + Substance shelf */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Beaker */}
          <div className="md:col-span-1 flex flex-col items-center gap-3">
            <BeakerView
              solvent={solvent}
              addedSubstances={addedSubstances}
              isStirring={isStirring}
              temperature={temperature}
            />

            {/* Stir button */}
            <Button
              variant="ghost"
              size="sm"
              className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 ${
                isStirring ? 'animate-pulse' : ''
              }`}
              onClick={handleStir}
              disabled={isStirring}
            >
              {isStirring ? 'Stirring...' : 'Stir'}
            </Button>

            {/* Temperature control */}
            {showTemperatureControl && (
              <div className="w-full px-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Cold (5&deg;C)</span>
                  <span>{temperature}&deg;C</span>
                  <span>Hot (80&deg;C)</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Substance shelf */}
          <div className="md:col-span-2">
            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
              <span className="text-slate-300 text-sm font-medium mb-2 block">Substance Shelf</span>
              <div className="grid grid-cols-2 gap-2">
                {substances.map(substance => {
                  const added = addedSubstances.find(s => s.substance.id === substance.id);
                  const typeInfo = TYPE_LABELS[substance.type];
                  return (
                    <Button
                      key={substance.id}
                      variant="ghost"
                      className="h-auto py-2 px-3 bg-white/5 border border-white/20 hover:bg-white/10 text-left flex flex-col items-start gap-0.5"
                      onClick={() => addSubstance(substance)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: substance.color }}
                        />
                        <span className="text-slate-200 text-sm font-medium">{substance.name}</span>
                        {added && (
                          <Badge className="ml-auto bg-slate-700/50 text-slate-400 border-white/10 text-[10px]">
                            {added.amountG}g
                          </Badge>
                        )}
                      </div>
                      {substance.formula && (
                        <span className="text-slate-500 text-xs font-mono ml-6">{substance.formula}</span>
                      )}
                      {added && (
                        <span className={`text-xs ml-6 ${typeInfo?.color || 'text-slate-400'}`}>
                          {typeInfo?.label}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Particle view toggle + display */}
        {showParticleView && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 ${
                particleViewActive ? 'ring-1 ring-blue-400/40' : ''
              }`}
              onClick={() => {
                setParticleViewActive(prev => !prev);
                if (!particleViewActive) {
                  sendText(
                    `[PARTICLE_VIEW_ON] Student toggled particle view ON. `
                    + `Explain what they see: "Those blue dots are water molecules. `
                    + `See how they surround the solute particles? That's dissolving at the molecular level!"`,
                    { silent: true }
                  );
                }
              }}
            >
              {particleViewActive ? 'Hide Particle View' : 'Show Particle View'}
            </Button>
            {particleViewActive && addedSubstances.length > 0 && (
              <ParticleView
                addedSubstances={addedSubstances}
                solventName={solvent.name}
              />
            )}
          </>
        )}

        {/* Concentration meter */}
        {showConcentrationMeter && addedSubstances.length > 0 && (
          <ConcentrationMeter
            substances={addedSubstances}
            volumeML={solvent.volume}
          />
        )}

        {/* Separation tools */}
        {showSeparationTools && addedSubstances.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="separation" className="border-white/10">
              <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
                Separation Tools &mdash; Can you get it back?
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                  {separationMethods.map(sep => (
                    <Button
                      key={sep.method}
                      variant="ghost"
                      size="sm"
                      className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 flex items-center gap-1.5 ${
                        selectedSeparation === sep.method ? 'ring-1 ring-emerald-400/40' : ''
                      }`}
                      onClick={() => handleSeparation(sep.method)}
                    >
                      <span>{SEPARATION_ICONS[sep.method] || '\uD83E\uDDEA'}</span>
                      <span className="capitalize">{sep.method}</span>
                    </Button>
                  ))}
                </div>
                {separationResult && (
                  <div className={`rounded-lg p-2 border text-sm ${
                    substanceRecovered
                      ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-400/20 text-amber-300'
                  }`}>
                    {separationResult}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Challenge answer area */}
        {currentChallenge && !isCurrentChallengeComplete && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={challengeAnswer}
              onChange={(e) => setChallengeAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
              placeholder="Type your answer..."
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

        {/* Next / Finish */}
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
              What is dissolving?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  When something <span className="text-emerald-300 font-medium">dissolves</span>,
                  its particles spread out evenly among the solvent molecules. It looks like it
                  disappeared &mdash; but it&rsquo;s still there! You can prove it by evaporating the water.
                </p>
                <p>
                  A <span className="text-slate-200 font-medium">solution</span> is a mixture where the
                  solute is evenly distributed. A <span className="text-slate-200 font-medium">mixture</span> where
                  you can still see the parts is called a <span className="text-slate-200 font-medium">suspension</span>.
                </p>
                <p>
                  <span className="text-amber-300 font-medium">Saturation</span> happens when the
                  solvent can&rsquo;t hold any more solute. Extra solute just sits at the bottom!
                </p>
                {gradeBand === '6-7' && (
                  <p>
                    Factors that affect dissolving: <span className="text-slate-200">temperature</span> (usually
                    increases solubility for solids), <span className="text-slate-200">stirring</span> (speeds
                    it up), and <span className="text-slate-200">particle size</span> (smaller dissolves faster).
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
              <div className="text-slate-400">Dissolve Sort:</div>
              <div className="text-slate-200 font-mono">{dissolveSortCorrect} / {sortTotal}</div>
              <div className="text-slate-400">Saturation Found:</div>
              <div className="text-slate-200">{saturationIdentified ? 'Yes' : 'No'}</div>
              <div className="text-slate-400">Separation Methods:</div>
              <div className="text-slate-200 font-mono">{separationMethodCorrect} / {separationTotal}</div>
              <div className="text-slate-400">Substance Recovered:</div>
              <div className="text-slate-200">{substanceRecovered ? 'Yes' : 'No'}</div>
              <div className="text-slate-400">Total Attempts:</div>
              <div className="text-slate-200 font-mono">{totalAttempts}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MixingAndDissolving;
