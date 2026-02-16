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
import type { ReactionLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Substance {
  id: string;
  name: string;
  formula: string | null;
  state: 'solid' | 'liquid' | 'gas' | 'solution';
  color: string;
  safetyInfo: string;
  imagePrompt?: string;
  amount: string;
}

export interface ReactionAnimation {
  realView: {
    duration: number;
    effects: Array<'bubbles' | 'foam' | 'colorShift' | 'steamRise' | 'precipitate' | 'glow' | 'explosion'>;
    temperatureChange: number | null;
  };
  particleView: {
    reactantMolecules: string[];
    productMolecules: string[];
    bondBreaking: boolean;
    bondForming: boolean;
  };
}

export interface ChallengeOption {
  id: string;
  text: string;
}

export interface ReactionChallenge {
  id: string;
  type: 'predict' | 'observe' | 'explain' | 'classify' | 'balance' | 'identify_signs' | 'conservation';
  instruction: string;
  targetAnswer: string;
  hint: string;
  narration: string;
  // Multiple choice scaffolding (optional — when present, renders MC buttons instead of textarea)
  options?: ChallengeOption[];
  correctOptionId?: string;
  // True/False scaffolding (optional — when present, renders T/F buttons instead of textarea)
  isTrueFalse?: boolean;
  correctBoolean?: boolean;
}

export interface ReactionNotebook {
  predictPrompt: string;
  predictionOptions?: ChallengeOption[];
  correctPredictionId?: string;
  observePrompts: string[];
  explainPrompt: string;
}

export interface ReactionLabData {
  title: string;
  description?: string;
  experiment: {
    name: string;
    category: 'acid_base' | 'decomposition' | 'oxidation' | 'dissolution' | 'physical_change' | 'density' | 'combustion';
    safetyLevel: 'safe' | 'caution' | 'supervised';
    realWorldConnection: string;
  };
  substances: Substance[];
  reaction: {
    type: 'chemical' | 'physical';
    signs: Array<'fizzing' | 'color_change' | 'temperature_change' | 'gas_produced' | 'precipitate' | 'light' | 'odor'>;
    isReversible: boolean;
    equation: string | null;
    energyChange: 'exothermic' | 'endothermic' | 'neutral';
    particleDescription: string;
  };
  animation: ReactionAnimation;
  challenges: ReactionChallenge[];
  notebook: ReactionNotebook;
  showOptions?: {
    showParticleView?: boolean;
    showEquation?: boolean;
    showSafetyBadge?: boolean;
    showTemperatureGauge?: boolean;
    showObservationNotebook?: boolean;
    showConservationCounter?: boolean;
  };
  imagePrompt?: string;
  gradeBand?: 'K-2' | '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReactionLabMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SIGN_LABELS: Record<string, { label: string; emoji: string }> = {
  fizzing: { label: 'Fizzing / Bubbles', emoji: '🫧' },
  color_change: { label: 'Color Change', emoji: '🎨' },
  temperature_change: { label: 'Temperature Change', emoji: '🌡️' },
  gas_produced: { label: 'Gas Produced', emoji: '💨' },
  precipitate: { label: 'Precipitate Formed', emoji: '⬇️' },
  light: { label: 'Light / Glow', emoji: '💡' },
  odor: { label: 'New Smell', emoji: '👃' },
};

const EFFECT_STYLES: Record<string, string> = {
  bubbles: 'animate-bounce',
  foam: 'animate-pulse',
  colorShift: 'animate-pulse',
  steamRise: 'animate-bounce',
  precipitate: 'animate-pulse',
  glow: 'animate-pulse',
  explosion: 'animate-ping',
};

const SAFETY_CONFIG = {
  safe: { label: 'Safe', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-400/30', emoji: '✅' },
  caution: { label: 'Caution', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-400/30', emoji: '⚠️' },
  supervised: { label: 'Adult Needed', color: 'text-red-400', bg: 'bg-red-500/10 border-red-400/30', emoji: '🧑‍🔬' },
};

const CATEGORY_COLORS: Record<string, string> = {
  acid_base: 'border-purple-400/30 bg-purple-500/10',
  decomposition: 'border-orange-400/30 bg-orange-500/10',
  oxidation: 'border-red-400/30 bg-red-500/10',
  dissolution: 'border-blue-400/30 bg-blue-500/10',
  physical_change: 'border-slate-400/30 bg-slate-500/10',
  density: 'border-cyan-400/30 bg-cyan-500/10',
  combustion: 'border-amber-400/30 bg-amber-500/10',
};

const STATE_EMOJIS: Record<string, string> = {
  solid: '🧊',
  liquid: '💧',
  gas: '💨',
  solution: '🧪',
};

// ============================================================================
// Sub-components
// ============================================================================

/** Animated reaction beaker */
const ReactionBeaker: React.FC<{
  isReacting: boolean;
  effects: string[];
  substances: Substance[];
  temperatureChange: number | null;
}> = ({ isReacting, effects, substances, temperatureChange }) => {
  const primaryColor = substances[0]?.color || '#6366f1';
  const secondaryColor = substances[1]?.color || '#06b6d4';

  return (
    <div className="relative flex flex-col items-center justify-end h-48 w-32 mx-auto">
      {/* Beaker */}
      <div className="relative w-24 h-32 border-2 border-white/30 rounded-b-lg bg-slate-800/30 overflow-hidden">
        {/* Liquid fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ${
            isReacting ? 'h-3/4' : 'h-1/2'
          }`}
          style={{
            background: isReacting
              ? `linear-gradient(to top, ${primaryColor}40, ${secondaryColor}40)`
              : `${primaryColor}30`,
          }}
        />

        {/* Bubbles effect */}
        {isReacting && effects.includes('bubbles') && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: `${0.6 + Math.random() * 0.4}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Foam effect */}
        {isReacting && effects.includes('foam') && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-white/20 animate-pulse rounded-t" />
        )}

        {/* Glow effect */}
        {isReacting && effects.includes('glow') && (
          <div className="absolute inset-0 bg-amber-400/10 animate-pulse" />
        )}

        {/* Color shift effect */}
        {isReacting && effects.includes('colorShift') && (
          <div
            className="absolute bottom-0 left-0 right-0 h-3/4 animate-pulse opacity-60"
            style={{ background: `linear-gradient(to top, ${secondaryColor}60, transparent)` }}
          />
        )}
      </div>

      {/* Steam */}
      {isReacting && effects.includes('steamRise') && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-white/10 animate-bounce"
              style={{ animationDelay: `${i * 0.3}s`, animationDuration: '1.5s' }}
            />
          ))}
        </div>
      )}

      {/* Temperature indicator */}
      {temperatureChange !== null && isReacting && (
        <Badge className={`absolute -right-12 top-1/2 text-[10px] ${
          temperatureChange > 0 ? 'bg-red-500/20 text-red-300 border-red-400/30' : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
        }`}>
          {temperatureChange > 0 ? `+${temperatureChange}°` : `${temperatureChange}°`}
        </Badge>
      )}
    </div>
  );
};

/** Particle view showing molecular animation */
const ParticleView: React.FC<{
  animation: ReactionAnimation;
  isReacting: boolean;
  particleDescription: string;
}> = ({ animation, isReacting, particleDescription }) => {
  const { particleView } = animation;

  const MoleculeCluster: React.FC<{ molecules: string[]; label: string; breaking?: boolean; forming?: boolean }> = ({
    molecules, label, breaking, forming,
  }) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</span>
      <div className={`flex flex-wrap justify-center gap-2 ${breaking ? 'animate-pulse' : ''} ${forming ? 'animate-bounce' : ''}`}>
        {molecules.map((mol, i) => (
          <div
            key={i}
            className={`px-2 py-1 rounded-full text-xs font-mono border ${
              label === 'Reactants'
                ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
            }`}
          >
            {mol}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🔬</span>
        <span className="text-slate-300 text-sm font-medium">Particle View</span>
      </div>

      <div className="flex items-center justify-around gap-4">
        <MoleculeCluster
          molecules={particleView.reactantMolecules}
          label="Reactants"
          breaking={isReacting && particleView.bondBreaking}
        />

        <div className={`text-slate-500 text-lg transition-all duration-500 ${isReacting ? 'text-amber-400 scale-125' : ''}`}>
          →
        </div>

        <MoleculeCluster
          molecules={isReacting ? particleView.productMolecules : ['?']}
          label="Products"
          forming={isReacting && particleView.bondForming}
        />
      </div>

      {isReacting && (
        <p className="text-slate-400 text-xs text-center italic mt-2">
          {particleDescription}
        </p>
      )}

      {!isReacting && (
        <p className="text-slate-500 text-xs text-center italic mt-2">
          Mix the substances to see what happens at the particle level!
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface ReactionLabProps {
  data: ReactionLabData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const ReactionLab: React.FC<ReactionLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    experiment,
    substances = [],
    reaction,
    animation,
    challenges = [],
    notebook,
    showOptions = {},
    gradeBand = '3-5',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showParticleView = gradeBand !== 'K-2',
    showEquation = gradeBand === '6-8',
    showSafetyBadge = true,
    showTemperatureGauge = true,
    showObservationNotebook = true,
    showConservationCounter = gradeBand === '6-8',
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Experiment phases
  type Phase = 'predict' | 'experiment' | 'observe' | 'explain';
  const [currentPhase, setCurrentPhase] = useState<Phase>('predict');
  const [isReacting, setIsReacting] = useState(false);
  const [reactionComplete, setReactionComplete] = useState(false);
  const [particleViewActive, setParticleViewActive] = useState(false);

  // Predictions & observations
  const [prediction, setPrediction] = useState('');
  const [predictionSubmitted, setPredictionSubmitted] = useState(false);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [identifiedSigns, setIdentifiedSigns] = useState<Set<string>>(new Set());

  // Challenge tracking
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);

  // Classification tracking
  const [classificationCorrect, setClassificationCorrect] = useState(0);
  const [classificationTotal, setClassificationTotal] = useState(0);

  // Equation balancing
  const [equationBalanced, setEquationBalanced] = useState(false);
  const [conservationUnderstood, setConservationUnderstood] = useState(false);

  // Safety
  const [safetyViewed, setSafetyViewed] = useState(false);

  // Substance selection for mixing
  const [selectedSubstances, setSelectedSubstances] = useState<Set<string>>(new Set());

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `reaction-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ReactionLabMetrics>({
    primitiveType: 'reaction-lab',
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
    experimentName: experiment.name,
    experimentCategory: experiment.category,
    reactionType: reaction.type,
    signs: reaction.signs,
    currentPhase,
    isReacting,
    reactionComplete,
    predictionSubmitted,
    prediction,
    substancesCount: substances.length,
    selectedSubstancesCount: selectedSubstances.size,
    observationsRecorded: Object.keys(observations).length,
    observationPromptsTotal: notebook.observePrompts.length,
    signsIdentified: identifiedSigns.size,
    signsTotal: reaction.signs.length,
    particleViewActive,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'predict',
    instruction: currentChallenge?.instruction ?? experiment.name,
    attemptNumber: currentAttempts + 1,
    equation: reaction.equation,
  }), [
    gradeBand, experiment, reaction, currentPhase, isReacting, reactionComplete,
    predictionSubmitted, prediction, substances.length, selectedSubstances.size,
    observations, notebook.observePrompts.length, identifiedSigns.size,
    particleViewActive, currentChallengeIndex, challenges.length,
    currentChallenge, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'reaction-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    const substanceNames = substances.map(s => s.name).join(', ');
    sendText(
      `[ACTIVITY_START] This is a Reaction Lab experiment: "${experiment.name}" for ${gradeBand}. `
      + `Category: ${experiment.category}. Substances: ${substanceNames}. `
      + `Reaction type: ${reaction.type}. Signs: ${reaction.signs.join(', ')}. `
      + `Real-world connection: ${experiment.realWorldConnection}. `
      + `Start by asking the student to make a prediction: "${notebook.predictPrompt}"`,
      { silent: true }
    );
  }, [isConnected, experiment, gradeBand, substances, reaction, notebook.predictPrompt, sendText]);

  // -------------------------------------------------------------------------
  // Phase Handlers
  // -------------------------------------------------------------------------

  const handleSubmitPrediction = useCallback(() => {
    if (!prediction.trim()) return;
    setPredictionSubmitted(true);
    setFeedback('Great prediction! Now let\'s find out what happens...');
    setFeedbackType('success');

    // Resolve the display text for MC predictions
    const predictionText = notebook.predictionOptions?.find(o => o.id === prediction)?.text || prediction;

    sendText(
      `[PREDICTION_MADE] Student predicted: "${predictionText}". `
      + `The actual result will show ${reaction.signs.join(', ')}. `
      + `Acknowledge their prediction warmly: "Interesting idea! Let's test it and see what really happens."`,
      { silent: true }
    );

    // Auto-advance to experiment phase after a moment
    setTimeout(() => {
      setCurrentPhase('experiment');
      setFeedback('');
      setFeedbackType('');
    }, 1500);
  }, [prediction, reaction.signs, sendText]);

  const handleSelectSubstance = useCallback((substanceId: string) => {
    if (hasSubmittedEvaluation || isReacting) return;
    setSelectedSubstances(prev => {
      const next = new Set(prev);
      if (next.has(substanceId)) {
        next.delete(substanceId);
      } else {
        next.add(substanceId);
      }
      return next;
    });
  }, [hasSubmittedEvaluation, isReacting]);

  const handleMixSubstances = useCallback(() => {
    if (selectedSubstances.size < 2 || isReacting) return;

    setIsReacting(true);
    sendText(
      `[REACTION_STARTED] Student mixed the substances. The reaction is happening! `
      + `Effects: ${animation.realView.effects.join(', ')}. `
      + `Narrate what's happening: "Look at that! See the ${reaction.signs[0]}? Something new is forming!"`,
      { silent: true }
    );

    // Reaction animation duration
    const duration = (animation.realView.duration || 3) * 1000;
    setTimeout(() => {
      setReactionComplete(true);
      setCurrentPhase('observe');
      sendText(
        `[REACTION_COMPLETE] The reaction finished. Now ask the student to record their observations. `
        + `"What did you see? What did you hear? Did the temperature change? Write it all down!"`,
        { silent: true }
      );
    }, duration);
  }, [selectedSubstances.size, isReacting, animation.realView, reaction.signs, sendText]);

  // -------------------------------------------------------------------------
  // Observation handlers
  // -------------------------------------------------------------------------

  const handleObservationChange = useCallback((prompt: string, value: string) => {
    setObservations(prev => ({ ...prev, [prompt]: value }));
  }, []);

  const handleToggleSign = useCallback((sign: string) => {
    setIdentifiedSigns(prev => {
      const next = new Set(prev);
      if (next.has(sign)) {
        next.delete(sign);
      } else {
        next.add(sign);
      }
      return next;
    });
  }, []);

  const handleFinishObservations = useCallback(() => {
    const recordedCount = Object.values(observations).filter(v => v.trim()).length;
    const signsCorrect = reaction.signs.filter(s => identifiedSigns.has(s)).length;

    sendText(
      `[OBSERVATIONS_RECORDED] Student recorded ${recordedCount}/${notebook.observePrompts.length} observations `
      + `and identified ${signsCorrect}/${reaction.signs.length} signs of change. `
      + `Now guide them to explain: "${notebook.explainPrompt}"`,
      { silent: true }
    );

    setCurrentPhase('explain');
    setFeedback('');
    setFeedbackType('');
  }, [observations, identifiedSigns, reaction.signs, notebook, sendText]);

  // -------------------------------------------------------------------------
  // Challenge checking
  // -------------------------------------------------------------------------

  const handleCheckChallenge = useCallback(() => {
    if (!currentChallenge || !challengeAnswer.trim()) return;

    setCurrentAttempts(a => a + 1);
    const answer = challengeAnswer.trim().toLowerCase();

    let isCorrect = false;

    // ── Structured formats: T/F → MC → built-in buttons → fallback textarea ──

    if (currentChallenge.isTrueFalse && currentChallenge.correctBoolean !== undefined) {
      // True / False
      const studentBool = answer === 'true';
      isCorrect = studentBool === currentChallenge.correctBoolean;

      if (currentChallenge.type === 'conservation' && isCorrect) setConservationUnderstood(true);
    } else if (currentChallenge.options && currentChallenge.correctOptionId) {
      // Multiple choice
      isCorrect = answer === currentChallenge.correctOptionId.toLowerCase();

      // Track type-specific metrics on correct MC
      if (isCorrect) {
        if (currentChallenge.type === 'balance') setEquationBalanced(true);
        if (currentChallenge.type === 'conservation') setConservationUnderstood(true);
        if (currentChallenge.type === 'classify') {
          setClassificationTotal(prev => prev + 1);
          setClassificationCorrect(prev => prev + 1);
        }
      } else if (currentChallenge.type === 'classify') {
        setClassificationTotal(prev => prev + 1);
      }
    } else if (currentChallenge.type === 'classify') {
      // Built-in Chemical / Physical buttons (no MC needed)
      const target = currentChallenge.targetAnswer.toLowerCase();
      isCorrect = answer === target;
      setClassificationTotal(prev => prev + 1);
      if (isCorrect) setClassificationCorrect(prev => prev + 1);
    } else {
      // Open-ended textarea fallback (compare_substances, etc.)
      const target = currentChallenge.targetAnswer.toLowerCase();
      isCorrect = answer.includes(target) || answer.length >= 15;
    }

    if (isCorrect) {
      setFeedback(currentChallenge.narration || 'Excellent work!');
      setFeedbackType('success');
      setChallengeResults(prev => [...prev, {
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      }]);
      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" for challenge "${currentChallenge.instruction}". `
        + `Correct! Celebrate: "${currentChallenge.narration}"`,
        { silent: true }
      );
    } else {
      setFeedback(currentAttempts >= 1 ? currentChallenge.hint : 'Not quite — try again!');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but target is "${currentChallenge.targetAnswer}". `
        + `Attempt ${currentAttempts + 1}. Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [currentChallenge, challengeAnswer, currentAttempts, reaction.signs, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------

  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      sendText(
        `[ALL_COMPLETE] Student completed all ${challenges.length} challenges for "${experiment.name}"! `
        + `Celebrate: "You're a real scientist! You predicted, observed, and explained the reaction!"`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((correctCount / challenges.length) * 100) : 0;

        const metrics: ReactionLabMetrics = {
          type: 'reaction-lab',
          predictionMade: predictionSubmitted,
          predictionAccuracy: predictionSubmitted
            ? (notebook.correctPredictionId
              ? (prediction === notebook.correctPredictionId ? 1 : 0)
              : (prediction.toLowerCase().includes(reaction.signs[0]?.replace('_', ' ') || '') ? 1 : 0.5))
            : 0,
          observationsRecorded: Object.values(observations).filter(v => v.trim()).length,
          observationPromptsTotal: notebook.observePrompts.length,
          chemicalVsPhysicalCorrect: classificationCorrect,
          classificationTotal,
          signsOfChangeIdentified: identifiedSigns.size,
          signsTotal: reaction.signs.length,
          particleViewEngaged: particleViewActive,
          equationBalanced,
          conservationUnderstood,
          experimentsCompleted: reactionComplete ? 1 : 0,
          experimentsTotal: 1,
          safetyAwarenessShown: safetyViewed,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults, prediction, observations }
        );
      }
      return;
    }

    // Reset for next challenge
    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setChallengeAnswer('');

    sendText(
      `[NEXT_ITEM] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${challenges[nextIndex]?.instruction}". Introduce it to the student.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, experiment.name, sendText,
    hasSubmittedEvaluation, predictionSubmitted, prediction, observations, notebook,
    reaction, classificationCorrect, classificationTotal, identifiedSigns.size,
    particleViewActive, equationBalanced, conservationUnderstood, reactionComplete,
    safetyViewed, submitEvaluation,
  ]);

  const handleToggleParticleView = useCallback(() => {
    setParticleViewActive(prev => !prev);
    if (!particleViewActive) {
      sendText(
        `[PARTICLE_VIEW_OPENED] Student toggled to particle view. `
        + `Narrate: "${reaction.particleDescription}"`,
        { silent: true }
      );
    }
  }, [particleViewActive, reaction.particleDescription, sendText]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
              {gradeBand}
            </Badge>
            <Badge className={`text-xs ${CATEGORY_COLORS[experiment.category] || 'bg-slate-500/10 border-slate-400/30'} text-slate-300`}>
              {experiment.category.replace('_', ' ')}
            </Badge>
            {showSafetyBadge && (
              <Badge
                className={`text-xs cursor-pointer ${SAFETY_CONFIG[experiment.safetyLevel].bg} ${SAFETY_CONFIG[experiment.safetyLevel].color}`}
                onClick={() => setSafetyViewed(true)}
              >
                {SAFETY_CONFIG[experiment.safetyLevel].emoji} {SAFETY_CONFIG[experiment.safetyLevel].label}
              </Badge>
            )}
          </div>
        </div>

        {/* Equation bar — shown for grades 3-5 (read-only) and 6-8 (interactive) */}
        {showEquation && reaction.equation && (
          <div className="mt-2 bg-slate-800/30 rounded-lg px-3 py-2 border border-white/5 font-mono text-sm text-center">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Equation</span>
            <span className="text-slate-200">{reaction.equation}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Phase Progress Indicator */}
        <div className="flex items-center gap-1">
          {(['predict', 'experiment', 'observe', 'explain'] as Phase[]).map((phase, i) => {
            const labels = { predict: 'Predict', experiment: 'Experiment', observe: 'Observe', explain: 'Explain' };
            const emojis = { predict: '🤔', experiment: '🧪', observe: '📝', explain: '💡' };
            const isActive = currentPhase === phase;
            const isPast = ['predict', 'experiment', 'observe', 'explain'].indexOf(currentPhase) > i;

            return (
              <React.Fragment key={phase}>
                {i > 0 && <div className={`flex-1 h-0.5 ${isPast ? 'bg-emerald-400' : 'bg-slate-700'}`} />}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-300'
                    : isPast
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-600'
                }`}>
                  <span>{emojis[phase]}</span>
                  <span className="hidden sm:inline">{labels[phase]}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* ===== PHASE: PREDICT ===== */}
        {currentPhase === 'predict' && (
          <div className="space-y-3">
            {/* Substance shelf */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {substances.map(sub => (
                <div
                  key={sub.id}
                  className={`rounded-lg border p-3 text-center bg-white/5 border-white/10`}
                >
                  <div className="text-xl mb-1">{STATE_EMOJIS[sub.state] || '🧪'}</div>
                  <div className="text-slate-200 text-xs font-medium">{sub.name}</div>
                  {sub.formula && gradeBand !== 'K-2' && (
                    <div className="text-slate-500 text-[10px] font-mono">{sub.formula}</div>
                  )}
                  <div className="text-slate-600 text-[10px]">{sub.amount}</div>
                </div>
              ))}
            </div>

            {/* Prediction prompt */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <p className="text-slate-200 text-sm font-medium mb-2">
                {notebook.predictPrompt}
              </p>

              {/* MC prediction options when available */}
              {notebook.predictionOptions && notebook.predictionOptions.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    {notebook.predictionOptions.map((option) => (
                      <Button
                        key={option.id}
                        variant="ghost"
                        className={`h-auto text-left p-3 border transition-all duration-300 ${
                          prediction === option.id
                            ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        }`}
                        onClick={() => !predictionSubmitted && setPrediction(option.id)}
                        disabled={predictionSubmitted}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Badge
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border flex-shrink-0 ${
                              prediction === option.id
                                ? 'bg-white text-slate-900 border-white'
                                : 'bg-black/30 text-slate-400 border-white/10'
                            }`}
                          >
                            {option.id}
                          </Badge>
                          <span className="text-sm text-slate-200">{option.text}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                  {!predictionSubmitted && (
                    <Button
                      variant="ghost"
                      className="mt-3 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={handleSubmitPrediction}
                      disabled={!prediction.trim()}
                    >
                      Submit Prediction
                    </Button>
                  )}
                </>
              ) : (
                /* Fallback: open-ended textarea */
                <>
                  <textarea
                    value={prediction}
                    onChange={e => setPrediction(e.target.value)}
                    placeholder="I think..."
                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600 resize-none"
                    rows={2}
                    disabled={predictionSubmitted}
                  />
                  {!predictionSubmitted && (
                    <Button
                      variant="ghost"
                      className="mt-2 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={handleSubmitPrediction}
                      disabled={!prediction.trim()}
                    >
                      Submit Prediction
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ===== PHASE: EXPERIMENT ===== */}
        {currentPhase === 'experiment' && (
          <div className="space-y-3">
            {/* Substance selection for mixing */}
            {!isReacting && !reactionComplete && (
              <>
                <p className="text-slate-300 text-sm text-center">
                  Select substances to mix:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {substances.map(sub => {
                    const selected = selectedSubstances.has(sub.id);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => handleSelectSubstance(sub.id)}
                        className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
                          selected
                            ? 'bg-cyan-500/15 border-cyan-400/40 scale-105'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xl mb-1">{STATE_EMOJIS[sub.state] || '🧪'}</div>
                        <div className="text-slate-200 text-xs font-medium">{sub.name}</div>
                        <div className="text-slate-600 text-[10px]">{sub.amount}</div>
                        {selected && (
                          <Badge className="mt-1 text-[10px] bg-cyan-500/20 text-cyan-300 border-cyan-400/30">
                            Selected
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    className="bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-300"
                    onClick={handleMixSubstances}
                    disabled={selectedSubstances.size < 2}
                  >
                    Mix Substances!
                  </Button>
                </div>
              </>
            )}

            {/* Reaction animation */}
            {(isReacting || reactionComplete) && (
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  {/* Real View */}
                  <div className="flex-1">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-2">Real View</span>
                    <ReactionBeaker
                      isReacting={isReacting && !reactionComplete}
                      effects={animation.realView.effects}
                      substances={substances}
                      temperatureChange={showTemperatureGauge ? animation.realView.temperatureChange : null}
                    />

                    {/* Effect labels */}
                    {(isReacting || reactionComplete) && (
                      <div className="flex flex-wrap justify-center gap-1 mt-2">
                        {animation.realView.effects.map(effect => (
                          <Badge
                            key={effect}
                            className={`text-[10px] bg-white/5 border-white/10 text-slate-400 ${
                              isReacting && !reactionComplete ? EFFECT_STYLES[effect] || '' : ''
                            }`}
                          >
                            {effect}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Particle View toggle */}
                  {showParticleView && (
                    <div className="flex-1">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider">Particle View</span>
                        <Button
                          variant="ghost"
                          className="h-5 px-2 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400"
                          onClick={handleToggleParticleView}
                        >
                          {particleViewActive ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      {particleViewActive && (
                        <ParticleView
                          animation={animation}
                          isReacting={isReacting && !reactionComplete}
                          particleDescription={reaction.particleDescription}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Energy change indicator */}
                {reactionComplete && reaction.energyChange !== 'neutral' && (
                  <div className={`text-center text-xs ${
                    reaction.energyChange === 'exothermic' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {reaction.energyChange === 'exothermic' ? '🔥 Exothermic — released heat' : '❄️ Endothermic — absorbed heat'}
                  </div>
                )}

                {/* Conservation counter (grades 6-8) */}
                {showConservationCounter && reactionComplete && (
                  <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">Conservation of Mass</span>
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-blue-300 text-xs">Reactant atoms: {animation.particleView.reactantMolecules.length}</span>
                      <span className="text-slate-500">=</span>
                      <span className="text-emerald-300 text-xs">Product atoms: {animation.particleView.productMolecules.length}</span>
                    </div>
                  </div>
                )}

                {reactionComplete && currentPhase === 'experiment' && (
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                      onClick={() => setCurrentPhase('observe')}
                    >
                      Record Observations
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== PHASE: OBSERVE ===== */}
        {currentPhase === 'observe' && showObservationNotebook && (
          <div className="space-y-3">
            {/* Observation prompts */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📝</span>
                <span className="text-slate-200 text-sm font-medium">Observation Notebook</span>
              </div>

              {notebook.observePrompts.map((prompt, i) => (
                <div key={i}>
                  <label className="text-slate-400 text-xs block mb-1">{prompt}</label>
                  <input
                    type="text"
                    value={observations[prompt] || ''}
                    onChange={e => handleObservationChange(prompt, e.target.value)}
                    placeholder="I noticed..."
                    className="w-full px-3 py-1.5 bg-slate-800/50 border border-white/15 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600"
                  />
                </div>
              ))}
            </div>

            {/* Signs of change identification */}
            <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
              <p className="text-slate-300 text-sm mb-2">Which signs of change did you observe?</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SIGN_LABELS).map(([key, { label, emoji }]) => {
                  const isSelected = identifiedSigns.has(key);
                  const isCorrect = reaction.signs.includes(key as typeof reaction.signs[number]);
                  return (
                    <Button
                      key={key}
                      variant="ghost"
                      className={`h-auto py-1.5 px-3 text-xs ${
                        isSelected
                          ? isCorrect
                            ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-300'
                            : 'bg-red-500/15 border border-red-400/30 text-red-300'
                          : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                      onClick={() => handleToggleSign(key)}
                    >
                      {emoji} {label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Particle view toggle during observation */}
            {showParticleView && (
              <div>
                <Button
                  variant="ghost"
                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm"
                  onClick={handleToggleParticleView}
                >
                  🔬 {particleViewActive ? 'Hide' : 'Show'} Particle View
                </Button>
                {particleViewActive && (
                  <div className="mt-2">
                    <ParticleView
                      animation={animation}
                      isReacting={false}
                      particleDescription={reaction.particleDescription}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={handleFinishObservations}
              >
                Done Observing
              </Button>
            </div>
          </div>
        )}

        {/* ===== PHASE: EXPLAIN ===== */}
        {currentPhase === 'explain' && (
          <div className="space-y-3">
            {/* Challenge progress */}
            {challenges.length > 0 && (
              <div className="flex items-center gap-2">
                {challenges.map((c, i) => (
                  <div
                    key={c.id}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      challengeResults.some(r => r.challengeId === c.id && r.correct)
                        ? 'bg-emerald-400'
                        : i === currentChallengeIndex
                          ? 'bg-cyan-400 scale-125'
                          : 'bg-slate-600'
                    }`}
                  />
                ))}
                <span className="text-slate-500 text-xs ml-auto">
                  {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
                </span>
              </div>
            )}

            {/* Current challenge */}
            {currentChallenge && !allChallengesComplete && (
              <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px] bg-slate-700/50 text-slate-300 border-slate-600/50">
                    {currentChallenge.type}
                  </Badge>
                  <p className="text-slate-200 text-sm font-medium">
                    {currentChallenge.instruction}
                  </p>
                </div>

                {/* Answer input */}
                {!isCurrentChallengeComplete && (
                  <>
                    {/* Classify: built-in Chemical / Physical buttons */}
                    {currentChallenge.type === 'classify' && !currentChallenge.options ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className={`flex-1 ${
                            challengeAnswer === 'chemical'
                              ? 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                          onClick={() => setChallengeAnswer('chemical')}
                        >
                          Chemical Change
                        </Button>
                        <Button
                          variant="ghost"
                          className={`flex-1 ${
                            challengeAnswer === 'physical'
                              ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                              : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                          onClick={() => setChallengeAnswer('physical')}
                        >
                          Physical Change
                        </Button>
                      </div>

                    ) : currentChallenge.isTrueFalse ? (
                      /* True / False buttons */
                      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                        {([
                          { value: 'true', label: 'True', icon: '✓' },
                          { value: 'false', label: 'False', icon: '✗' },
                        ] as const).map(({ value, label, icon }) => (
                          <button
                            key={value}
                            onClick={() => setChallengeAnswer(value)}
                            className={`relative p-5 rounded-xl border transition-all duration-300 ${
                              challengeAnswer === value
                                ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <span className={`text-2xl ${challengeAnswer === value ? 'text-white' : 'text-slate-400'}`}>
                                {icon}
                              </span>
                              <span className="text-sm font-bold text-slate-200">{label}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                    ) : currentChallenge.options && currentChallenge.options.length > 0 ? (
                      /* Multiple choice options */
                      <div className="grid grid-cols-1 gap-2">
                        {currentChallenge.options.map((option) => (
                          <Button
                            key={option.id}
                            variant="ghost"
                            className={`h-auto text-left p-3 border transition-all duration-300 ${
                              challengeAnswer === option.id
                                ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                            }`}
                            onClick={() => setChallengeAnswer(option.id)}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <Badge
                                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border flex-shrink-0 ${
                                  challengeAnswer === option.id
                                    ? 'bg-white text-slate-900 border-white'
                                    : 'bg-black/30 text-slate-400 border-white/10'
                                }`}
                              >
                                {option.id}
                              </Badge>
                              <span className="text-sm text-slate-200">{option.text}</span>
                            </div>
                          </Button>
                        ))}
                      </div>

                    ) : (
                      /* Fallback: open-ended textarea */
                      <textarea
                        value={challengeAnswer}
                        onChange={e => setChallengeAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600 resize-none"
                        rows={2}
                      />
                    )}

                    <Button
                      variant="ghost"
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                      onClick={handleCheckChallenge}
                      disabled={!challengeAnswer.trim() || hasSubmittedEvaluation}
                    >
                      Check Answer
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* All complete */}
            {allChallengesComplete && (
              <div className="text-center py-4">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  Experiment Complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} challenges correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Navigation buttons for explain phase */}
        {currentPhase === 'explain' && isCurrentChallengeComplete && !allChallengesComplete && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </Button>
          </div>
        )}

        {/* Real-world connection accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="connection" className="border-white/10">
            <AccordionTrigger className="text-slate-400 text-xs hover:text-slate-200 py-2">
              🌍 Real-World Connection
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-slate-300 text-sm">{experiment.realWorldConnection}</p>
            </AccordionContent>
          </AccordionItem>

          {/* Safety info */}
          {substances.some(s => s.safetyInfo) && (
            <AccordionItem value="safety" className="border-white/10">
              <AccordionTrigger
                className="text-slate-400 text-xs hover:text-slate-200 py-2"
                onClick={() => setSafetyViewed(true)}
              >
                🛡️ Safety Information
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1">
                  {substances.filter(s => s.safetyInfo).map(s => (
                    <div key={s.id} className="text-xs">
                      <span className="text-slate-300 font-medium">{s.name}:</span>{' '}
                      <span className="text-slate-400">{s.safetyInfo}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Hint after 2 failed attempts */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && currentPhase === 'explain' && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">💡 {currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReactionLab;
