'use client';

/**
 * Mixing and dissolving: a beaker, a shelf of substances to test, a particle view and separation tools, and a few
 * multiple-choice or true-false challenges about what the learner sees.
 *
 * Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `mixingAndDissolving.card.ts` +
 * `mixingAndDissolving.boss.ts`): the runtime owns the item and Try again / Next; every check commits through
 * `progress.commitCheck` with a named miss, a spoken answer is judged by the tutor, and the levers are one lever set in
 * `mixingAndDissolvingLevers.ts`, published with the scene.
 *
 * While a challenge is open nothing on screen states its answer: the shelf does not label what a substance did, the
 * "What is dissolving?" notes and the particle view's caption say no rule, and the separation tools are put away during
 * a separation question (trying each tool would answer it).
 */
import React, { useState, useCallback, useLayoutEffect, useRef } from 'react';
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
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  describeDissolvingWork, descriptionLeaks, dissolvingCorrect, dissolvingMiss, workspaceScene,
} from './mixingAndDissolvingWorkspace';
import {
  DISSOLVING_LEVERS, DROP_LEVER, METHOD_CARDS, METHODS_LEVER, MODELS_LEVER, NO_LEVERS, PARTICLE_LEVER, farChoice,
  methodsOnChoices, modelsFor, type DissolvingLeverState, type ModelBeaker,
} from './mixingAndDissolvingLevers';
import { mixingAndDissolvingBoss } from './mixingAndDissolving.boss';

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
  /** `classify` (solution, suspension or two layers) is built by code from the substance's own `type`. */
  type: 'dissolve_sort' | 'particle_explain' | 'factor_test' | 'saturation' | 'separate' | 'concentration' | 'classify';
  answerType: 'multiple_choice' | 'true_false';
  instruction: string;
  options: string[];
  correctOptionIndex: number;
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
  filtration: '🧻',
  evaporation: '☀️',
  distillation: '🧪',
  chromatography: '🌈',
  magnet: '🧲',
  decanting: '🫗',
};

/** A fixed scatter (random positions per render made every render a different picture). */
const jitter = (i: number, n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;

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
      <Badge className="mb-2 bg-slate-800/50 text-slate-300 border-white/10 text-xs">
        {temperature}&deg;C
      </Badge>

      <div className="relative w-36 h-44 border-2 border-white/20 rounded-b-xl bg-slate-800/20 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700"
          style={{
            height: '65%',
            background: `linear-gradient(to top, ${primaryColor}50, ${primaryColor}20)`,
          }}
        />

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

        {isStirring && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-spin border-t-transparent" />
          </div>
        )}
      </div>

      <span className="text-slate-500 text-xs mt-1">{solvent.name} ({solvent.volume} mL)</span>
    </div>
  );
};

/** Particle-level view of dissolving. Its caption names the dots and states no rule. */
const ParticleView: React.FC<{
  addedSubstances: Array<{ substance: SubstanceEntry; amountG: number }>;
  solventName: string;
}> = ({ addedSubstances, solventName }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm">{'🔬'}</span>
      <span className="text-slate-300 text-sm font-medium">Particle View</span>
    </div>

    <div className="relative w-full h-40 bg-slate-900/40 rounded-lg border border-white/5 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={`solvent-${i}`}
          className="absolute w-3 h-3 rounded-full bg-blue-400/30 border border-blue-400/40 animate-pulse"
          style={{
            left: `${5 + (i % 5) * 20 + jitter(i, 1) * 10}%`,
            top: `${10 + Math.floor(i / 5) * 22 + jitter(i, 2) * 10}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${2 + jitter(i, 3)}s`,
          }}
        />
      ))}

      {addedSubstances.map(({ substance, amountG }, si) => {
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
                ? `${10 + jitter(si * 10 + i, 4) * 75}%`
                : `${30 + (i % 3) * 12}%`,
              top: isDissolved
                ? `${10 + jitter(si * 10 + i, 5) * 70}%`
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
      Blue circles = {solventName} particles. Colored circles = the substances you added.
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
  const pct = Math.min(concentration * 200, 100);

  return (
    <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{'📊'}</span>
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

/** A small model beaker for the `model_beakers` lever: a thing not in the lesson, drawn and tagged. */
const ModelBeakerCard: React.FC<{ model: ModelBeaker }> = ({ model }) => (
  <div className="flex flex-col items-center gap-1 text-center">
    <div className="relative w-14 h-16 border-2 border-white/20 rounded-b-lg bg-slate-800/20 overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '65%',
        background: model.look === 'dissolves' ? `${model.color}55` : 'rgba(100,180,255,0.18)' }} />
      {model.look === 'sinks' && (
        <div className="absolute bottom-1 left-0 right-0 flex gap-0.5 justify-center">
          {[0, 1, 2].map(j => <div key={j} className="w-2 h-2 rounded-sm" style={{ backgroundColor: model.color }} />)}
        </div>
      )}
      {model.look === 'layers' && <div className="absolute left-0 right-0 h-3 opacity-70" style={{ top: '35%', backgroundColor: model.color }} />}
    </div>
    <span className="text-slate-200 text-xs font-medium">{model.name}</span>
    <span className="text-slate-400 text-[11px] leading-tight max-w-[10rem]">{model.tag}</span>
  </div>
);

// ============================================================================
// Props
// ============================================================================

interface MixingAndDissolvingProps {
  data: MixingAndDissolvingData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

type LeverMemo = { item: string } & DissolvingLeverState;

// ============================================================================
// Component
// ============================================================================

const useDissolvingProgress = useWorkspaceProgressFor('mixing-and-dissolving');

const MixingAndDissolvingSurface = ({ data, className, runtimePlanItemId }: MixingAndDissolvingProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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
  } = showOptionsProp;

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `mixing-and-dissolving-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useDissolvingProgress({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: mixingAndDissolvingBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: (index) => solvedAloud.current(index),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex: currentChallengeIndex, currentAttempts, results: challengeResults } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

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

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  /** The wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });

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

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = progress.isComplete;
  const isCurrentChallengeComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;
  /** A challenge is open: nothing on screen may state its answer. */
  const itemOpen = !!currentChallenge && !isCurrentChallengeComplete && !allChallengesComplete;

  const lever: DissolvingLeverState = leverMemo.item === currentChallenge?.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: DissolvingLeverState) => Partial<DissolvingLeverState>) => {
    const id = currentChallenge?.id ?? '';
    setLeverMemo((m) => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };

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
  // Handlers
  // -------------------------------------------------------------------------

  const addSubstance = useCallback((substance: SubstanceEntry) => {
    if (learnerBlocked()) return;
    SoundManager.snap();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStir = useCallback(() => {
    if (learnerBlocked()) return;
    setIsStirring(true);
    setTimeout(() => setIsStirring(false), 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeparation = useCallback((method: string) => {
    if (learnerBlocked()) return;
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [separationMethods, addedSubstances]);

  /** The per-kind tallies a right answer adds, on a tap or a credited spoken answer. */
  const trackCorrect = (type: DissolvingChallenge['type']) => {
    if (type === 'dissolve_sort') {
      setDissolveSortCorrect(prev => prev + 1);
      setSortTotal(prev => prev + 1);
    } else if (type === 'particle_explain') {
      setParticleExplanationGiven(true);
    } else if (type === 'factor_test') {
      setFactorsTestedCorrectly(prev => prev + 1);
      setFactorsTotal(prev => prev + 1);
    } else if (type === 'saturation') {
      setSaturationIdentified(true);
    } else if (type === 'separate') {
      setSeparationMethodCorrect(prev => prev + 1);
      setSeparationTotal(prev => prev + 1);
    }
  };

  const handleSelectOption = (i: number) => {
    if (learnerBlocked() || wrongPick !== null || lever.dropped.includes(i)) return;
    SoundManager.select();
    setSelectedOption(i);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || !currentChallenge || wrongPick !== null || learnerBlocked()) return;

    setTotalAttempts(prev => prev + 1);

    const isCorrect = dissolvingCorrect(currentChallenge, selectedOption);
    // The checked gesture: counts the attempt and records a correct result.
    progress.commitCheck(describeDissolvingWork(currentChallenge, selectedOption), isCorrect,
      isCorrect ? undefined : dissolvingMiss(currentChallenge, selectedOption));

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Correct! Great observation!');
      setFeedbackType('success');
      trackCorrect(currentChallenge.type);
      setSelectedOption(null);
      return;
    }

    SoundManager.playIncorrect();
    if (currentChallenge.type === 'dissolve_sort') setSortTotal(prev => prev + 1);
    else if (currentChallenge.type === 'factor_test') setFactorsTotal(prev => prev + 1);
    else if (currentChallenge.type === 'separate') setSeparationTotal(prev => prev + 1);

    // The tutor and the runtime take it from here: the wrong choice stays marked until Try again, with no hint
    // (a generated hint may state the answer).
    const picked = selectedOption;
    setWrongPick(picked);
    editLevers((s) => ({ picked: [...s.picked, picked] }));
    setFeedback('Not quite.');
    setFeedbackType('error');
  };

  const metrics = (): MixingAndDissolvingMetrics => ({
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
  });

  // ── Workspace callbacks ──
  /** A fresh item, or Try again: the choice and its feedback are cleared; a retry counts one more wrong answer. */
  openItem.current = (_index, retry) => {
    setSelectedOption(null);
    setWrongPick(null);
    setFeedback('');
    setFeedbackType('');
    if (retry) editLevers((s) => ({ wrongs: s.wrongs + 1 }));
  };
  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = challenges[index];
    if (!solved || challengeResults.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    trackCorrect(solved.type);
    setWrongPick(null);
    setSelectedOption(null);
    setFeedback('Correct! Great observation!');
    setFeedbackType('success');
  };
  // Under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || challenges.length === 0) return;
    submitEvaluation(result.passed, result.accuracy, metrics(),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Levers ──
  const leverCtx = {
    lab: { solvent, substances },
    view: { beakerEmpty: addedSubstances.length === 0, particleViewOn: particleViewActive, particleViewAvailable: showParticleView },
    state: lever,
  };
  const leverOn = (id: string) => lever.pulled.includes(id);

  // What the tutor and the observer are shown, republished every render.
  useLayoutEffect(() => {
    if (!currentChallenge || allChallengesComplete) return;
    const scene = workspaceScene(currentChallenge, {
      added: addedSubstances.map(a => ({ name: a.substance.name, amountG: a.amountG })),
      temperature, particleViewOn: particleViewActive, choice: wrongPick ?? selectedOption,
    }, leverCtx.lab);
    const levers = DISSOLVING_LEVERS.declare(currentChallenge, leverCtx, lever.pulled);
    workspace.current = {
      ...leverScene(scene, { support: DISSOLVING_LEVERS.support(currentChallenge, leverCtx),
        onScreen: DISSOLVING_LEVERS.onScreen(currentChallenge, leverCtx, lever.pulled) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find((x) => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        // Drawing a pulled lever: the far choice greyed out, or the particle view opened.
        if (id === DROP_LEVER) {
          const far = farChoice(currentChallenge, lever);
          if (far === null) return 'No more choices can be greyed out here; too few would be left.';
          editLevers((s) => ({ pulled: [...s.pulled, id], dropped: [...s.dropped, far] }));
          if (selectedOption === far) setSelectedOption(null);
          return true;
        }
        if (id === PARTICLE_LEVER) {
          if (addedSubstances.length === 0) return 'The beaker is empty: ask the learner to add a substance first.';
          setParticleViewActive(true);
        }
        editLevers((s) => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const models = currentChallenge && leverOn(MODELS_LEVER) ? modelsFor(currentChallenge, leverCtx.lab) : null;
  const methodCards = currentChallenge && leverOn(METHODS_LEVER) ? methodsOnChoices(currentChallenge) : [];
  const showSeparation = showSeparationTools && addedSubstances.length > 0 && !(itemOpen && currentChallenge?.type === 'separate');

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">{'🧪'}</span>
              {title}
            </CardTitle>
            {description && !(itemOpen && descriptionLeaks(description)) && (
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
        {currentChallenge && (
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the beaker and choices as its region. */}
        {!allChallengesComplete && <PipDock />}
        <PipWorkspace className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 flex flex-col items-center gap-3">
            <BeakerView
              solvent={solvent}
              addedSubstances={addedSubstances}
              isStirring={isStirring}
              temperature={temperature}
            />

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
                  onChange={(e) => { if (!learnerBlocked()) setTemperature(Number(e.target.value)); }}
                  className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

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
                      aria-label={`Add ${substance.name}`}
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
                      {/* What it did, in words, only once no challenge is open: during one the beaker is what to read. */}
                      {added && !itemOpen && (
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

        {showParticleView && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 ${
                particleViewActive ? 'ring-1 ring-blue-400/40' : ''
              }`}
              onClick={() => {
                if (learnerBlocked()) return;
                setParticleViewActive(prev => !prev);
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

        {showConcentrationMeter && addedSubstances.length > 0 && (
          <ConcentrationMeter
            substances={addedSubstances}
            volumeML={solvent.volume}
          />
        )}

        {showSeparation && (
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
                      <span>{SEPARATION_ICONS[sep.method] || '🧪'}</span>
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

        {/* Help levers drawn beside the question. */}
        {models && (
          <div data-lever="model-beakers" className="flex flex-wrap justify-center gap-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {models.map(m => <ModelBeakerCard key={m.name} model={m} />)}
          </div>
        )}
        {methodCards.length > 0 && (
          <div data-lever="method-cards" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {methodCards.map(m => (
              <div key={m} className="rounded-lg p-2 bg-white/5 border border-white/10 text-slate-300 text-xs">
                <span className="mr-1">{SEPARATION_ICONS[m]}</span>{METHOD_CARDS[m]}
              </div>
            ))}
          </div>
        )}

        {currentChallenge && !isCurrentChallengeComplete && (
          <div className="space-y-3">
            <div className={`grid ${currentChallenge.answerType === 'true_false' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-2`}>
              {currentChallenge.options.map((option, i) => {
                const dropped = lever.dropped.includes(i);
                const style = wrongPick === i
                  ? 'bg-red-500/15 border border-red-400/40 text-red-200'
                  : selectedOption === i
                    ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200 ring-1 ring-indigo-400/40'
                    : 'bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300';
                return (
                  <Button
                    key={i}
                    variant="ghost"
                    aria-label={option}
                    data-dropped={dropped ? 'true' : undefined}
                    disabled={dropped || wrongPick !== null || progress.canAttempt === false}
                    className={`text-left justify-start px-4 py-3 h-auto whitespace-normal ${style} ${dropped ? 'opacity-30 line-through' : ''}`}
                    onClick={() => handleSelectOption(i)}
                  >
                    {currentChallenge.answerType === 'true_false' ? (
                      <span>{option}</span>
                    ) : (
                      <>
                        <span className="mr-2 font-mono text-xs opacity-60">{String.fromCharCode(65 + i)}.</span>
                        {option}
                      </>
                    )}
                  </Button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
                onClick={handleSubmitAnswer}
                disabled={selectedOption === null || wrongPick !== null || progress.canAttempt === false}
              >
                Submit Answer
              </Button>
            </div>
          </div>
        )}

        </PipWorkspace>

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

        {/* The notes state the rules the challenges ask about, so they open only when no challenge is. */}
        {!itemOpen && (
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
        )}

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

const MixingAndDissolving = withWorkspaceOnly<MixingAndDissolvingProps>(
  'mixing-and-dissolving', MixingAndDissolvingSurface, props => props.data.title);

export default MixingAndDissolving;
