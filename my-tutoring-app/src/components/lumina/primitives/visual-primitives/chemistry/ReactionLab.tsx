'use client';

/**
 * Reaction Lab: a virtual experiment station (predict, mix, observe, explain). Two paths, chosen by
 * `withWorkspaceController`:
 * - Scripted (no tutor runtime: the tester, a lesson without the live tutor): the notebook flow. Predict (the notebook
 *   prediction, then any predict challenge, before mixing), Experiment, Observe (the notebook), Explain (the other
 *   challenges), each challenge with its own Check and Next.
 * - Workspace (the live tutor owns the lesson, W1, ROLLOUT C26): every item is one challenge with a code-held key
 *   (`reactionLabWorkspace.ts`). A predict challenge is asked beside the unmixed substances; any other waits for the
 *   learner to press Mix Substances!, then is asked beside the reaction. Every check commits through
 *   `progress.commitCheck`, a spoken answer is judged by JEV, and the in-item levers (`reactionLabLevers.ts`) are
 *   published with the scene. No notebook, no Next: the runtime moves the item.
 */
import React, { useState, useCallback, useLayoutEffect, useMemo, useRef, useEffect } from 'react';
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
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  answerForm, describeReactionWork, effectLabel, equationHidden, itemChoices, keyValue, reactionCorrect, reactionItems,
  reactionMiss, shownOptions, workspaceAssignment, workspaceScene, type ReactionChoice, type ReactionItem,
} from './reactionLabWorkspace';
import {
  DROP_LEVER, LEGEND_LEVER, LEGEND_TITLE, NO_LEVERS, PARTICLE_LEVER, REPLAY_LEVER, SIGN_LEGEND, farChoice, leverFacts,
  reactionLevers, type ReactionLeverState,
} from './reactionLabLevers';

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

const SIGN_LABELS: Record<string, { label: string; emoji: string }> = Object.fromEntries(
  SIGN_LEGEND.map(l => [l.sign, { label: l.label, emoji: l.emoji }]));

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

/** Animated reaction beaker. After the reaction has run (`ran`) the temperature badge stays: it is an observation. */
const ReactionBeaker: React.FC<{
  isReacting: boolean;
  ran: boolean;
  effects: string[];
  substances: Substance[];
  temperatureChange: number | null;
}> = ({ isReacting, ran, effects, substances, temperatureChange }) => {
  const primaryColor = substances[0]?.color || '#6366f1';
  const secondaryColor = substances[1]?.color || '#06b6d4';
  // Fixed bubble timings: a random duration per render would restart the animation on every render.
  const bubbleDurations = [0.7, 0.85, 0.65, 0.95, 0.75, 0.9];

  return (
    <div className="relative flex flex-col items-center justify-end h-48 w-32 mx-auto">
      <div className="relative w-24 h-32 border-2 border-white/30 rounded-b-lg bg-slate-800/30 overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ${isReacting || ran ? 'h-3/4' : 'h-1/2'}`}
          style={{
            background: isReacting || ran
              ? `linear-gradient(to top, ${primaryColor}40, ${secondaryColor}40)`
              : `${primaryColor}30`,
          }}
        />
        {isReacting && effects.includes('bubbles') && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            {bubbleDurations.map((d, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, animationDuration: `${d}s` }} />
            ))}
          </div>
        )}
        {isReacting && effects.includes('foam') && (
          <div className="absolute top-0 left-0 right-0 h-6 bg-white/20 animate-pulse rounded-t" />
        )}
        {isReacting && effects.includes('glow') && (
          <div className="absolute inset-0 bg-amber-400/10 animate-pulse" />
        )}
        {isReacting && effects.includes('colorShift') && (
          <div className="absolute bottom-0 left-0 right-0 h-3/4 animate-pulse opacity-60"
            style={{ background: `linear-gradient(to top, ${secondaryColor}60, transparent)` }} />
        )}
      </div>
      {isReacting && effects.includes('steamRise') && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 rounded-full bg-white/10 animate-bounce"
              style={{ animationDelay: `${i * 0.3}s`, animationDuration: '1.5s' }} />
          ))}
        </div>
      )}
      {temperatureChange !== null && (isReacting || ran) && (
        <Badge className={`absolute -right-12 top-1/2 text-[10px] ${
          temperatureChange > 0 ? 'bg-red-500/20 text-red-300 border-red-400/30' : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
        }`}>
          {temperatureChange > 0 ? `+${temperatureChange}°` : `${temperatureChange}°`}
        </Badge>
      )}
    </div>
  );
};

/** Particle view. `caption` null hides the sentence (it explains the reaction, so not beside an open challenge). */
const ParticleView: React.FC<{
  animation: ReactionAnimation;
  animating: boolean;
  showProducts: boolean;
  caption: string | null;
}> = ({ animation, animating, showProducts, caption }) => {
  const { particleView } = animation;
  const cluster = (molecules: string[], label: 'Reactants' | 'Products', moving: string) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</span>
      <div className={`flex flex-wrap justify-center gap-2 ${moving}`}>
        {molecules.map((mol, i) => (
          <div key={i} className={`px-2 py-1 rounded-full text-xs font-mono border ${
            label === 'Reactants' ? 'bg-blue-500/15 border-blue-400/30 text-blue-300' : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
          }`}>
            {mol}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3" data-lever="particle-view">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🔬</span>
        <span className="text-slate-300 text-sm font-medium">Particle View</span>
      </div>
      <div className="flex items-center justify-around gap-4">
        {cluster(particleView.reactantMolecules, 'Reactants', animating && particleView.bondBreaking ? 'animate-pulse' : '')}
        <div className={`text-slate-500 text-lg transition-all duration-500 ${animating ? 'text-amber-400 scale-125' : ''}`}>→</div>
        {cluster(showProducts ? particleView.productMolecules : ['?'], 'Products', animating && particleView.bondForming ? 'animate-bounce' : '')}
      </div>
      {showProducts && caption && <p className="text-slate-400 text-xs text-center italic mt-2">{caption}</p>}
      {!showProducts && (
        <p className="text-slate-500 text-xs text-center italic mt-2">Mix the substances to see what happens at the particle level!</p>
      )}
    </div>
  );
};

/** The `signs_legend` lever card: every sign, none marked. */
const SignsLegend: React.FC = () => (
  <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3" data-lever="signs-legend">
    <p className="text-cyan-200 text-xs font-medium mb-2">{LEGEND_TITLE}</p>
    <div className="flex flex-wrap gap-2">
      {SIGN_LEGEND.map(l => (
        <span key={l.sign} className="text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-2 py-1">
          <span aria-hidden="true">{l.emoji}</span> {l.label}
        </span>
      ))}
    </div>
  </div>
);

// ============================================================================
// Props
// ============================================================================

interface ReactionLabProps {
  data: ReactionLabData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

type Phase = 'predict' | 'experiment' | 'observe' | 'explain';
type LeverMemo = { item: string } & ReactionLeverState;

// ============================================================================
// Component
// ============================================================================

const ReactionLabSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ReactionLabProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ReactionItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  const stableInstanceIdRef = useRef(instanceId || `reaction-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items: predict challenges first (asked before mixing), then the rest. The workspace keeps only keyed ones. ──
  const items = useMemo(() => reactionItems(challenges, { checkedOnly: tutorOwned }), [challenges, tutorOwned]);

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (i) => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: (index) => solvedAloud.current(index),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  // ── State ──
  const [currentPhase, setCurrentPhase] = useState<Phase>('predict');
  /** The substances have been mixed; the reaction stays shown from then on. */
  const [reactionRun, setReactionRun] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);
  const [particleViewActive, setParticleViewActive] = useState(false);

  const [prediction, setPrediction] = useState('');
  const [predictionSubmitted, setPredictionSubmitted] = useState(false);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [identifiedSigns, setIdentifiedSigns] = useState<Set<string>>(new Set());

  /** The choice picked on the current challenge (an option id, 'true'/'false', 'chemical'/'physical'). */
  const [choice, setChoice] = useState<string | null>(null);
  /** Scripted path only: a typed answer to a challenge with no options. */
  const [typedAnswer, setTypedAnswer] = useState('');
  /** Workspace path: the wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  const [classificationCorrect, setClassificationCorrect] = useState(0);
  const [classificationTotal, setClassificationTotal] = useState(0);
  const [equationBalanced, setEquationBalanced] = useState(false);
  const [conservationUnderstood, setConservationUnderstood] = useState(false);
  const [safetyViewed, setSafetyViewed] = useState(false);
  const [selectedSubstances, setSelectedSubstances] = useState<Set<string>>(new Set());
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const currentItem: ReactionItem | undefined = items[currentIndex];
  const currentChallenge = currentItem?.challenge ?? null;
  const solvedNow = !!currentItem && results.some((r) => r.challengeId === currentItem.id && r.correct);
  const allChallengesComplete = isComplete;
  const lever: ReactionLeverState = leverMemo.item === currentItem?.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: ReactionLeverState) => Partial<ReactionLeverState>) => {
    const id = currentItem?.id ?? '';
    setLeverMemo((m) => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };

  /** Workspace path: what the stage shows for the current item. */
  const wsStage: 'before' | 'mix' | 'after' | 'done' = !currentItem || isComplete ? 'done'
    : currentItem.stage === 'before' ? 'before' : reactionRun ? 'after' : 'mix';
  /** The challenge card is on screen (scripted: in the predict phase after the prediction, or in the explain phase). */
  const cardVisible = !!currentItem && !isComplete && (tutorOwned
    ? wsStage === 'before' || wsStage === 'after'
    : (currentPhase === 'predict' && predictionSubmitted && currentItem.stage === 'before') || currentPhase === 'explain');

  // ── Evaluation ──
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

  // ── AI Tutoring (scripted path only) ──
  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    experimentName: experiment.name,
    experimentCategory: experiment.category,
    reactionType: reaction.type,
    signs: reaction.signs,
    currentPhase,
    isReacting: animating,
    reactionComplete: reactionRun && !animating,
    predictionSubmitted,
    prediction,
    substancesCount: substances.length,
    selectedSubstancesCount: selectedSubstances.size,
    observationsRecorded: Object.keys(observations).length,
    observationPromptsTotal: notebook.observePrompts.length,
    signsIdentified: identifiedSigns.size,
    signsTotal: reaction.signs.length,
    particleViewActive,
    currentChallengeIndex: currentIndex,
    totalChallenges: items.length,
    challengeType: currentChallenge?.type ?? 'predict',
    instruction: currentChallenge?.instruction ?? experiment.name,
    attemptNumber: currentAttempts + 1,
    equation: reaction.equation,
  }), [
    gradeBand, experiment, reaction, currentPhase, animating, reactionRun, predictionSubmitted, prediction,
    substances.length, selectedSubstances.size, observations, notebook.observePrompts.length, identifiedSigns.size,
    particleViewActive, currentIndex, items.length, currentChallenge, currentAttempts,
  ]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'reaction-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-8',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] This is a Reaction Lab experiment: "${experiment.name}" for ${gradeBand}. `
      + `Category: ${experiment.category}. Substances: ${substances.map(s => s.name).join(', ')}. `
      + `Real-world connection: ${experiment.realWorldConnection}. `
      + `Start by asking the student to make a prediction: "${notebook.predictPrompt}". Do not say what will happen.`,
      { silent: true }
    );
  }, [tutorOwned, isConnected, experiment, gradeBand, substances, notebook.predictPrompt, sendText]);

  // ── Workspace callbacks ──
  /** A fresh item, or Try again: the choice is cleared; a retry counts one more wrong answer for the levers. */
  openItem.current = (_index, retry) => {
    setChoice(null);
    setWrongPick(null);
    setFeedback('');
    setFeedbackType('');
    if (retry) editLevers((s) => ({ wrongs: s.wrongs + 1 }));
  };
  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some((r) => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1, challengeType: solved.challenge.type });
    setChoice(keyValue(solved.challenge));
    setWrongPick(null);
    setFeedback(solved.challenge.narration || 'Excellent work!');
    setFeedbackType('success');
  };

  // ── Experiment ──
  const runAnimation = useCallback(() => {
    setAnimating(true);
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = setTimeout(() => {
      setAnimating(false);
      animationTimer.current = null;
    }, Math.min(Math.max(animation.realView.duration || 3, 1), 6) * 1000);
  }, [animation.realView.duration]);

  const handleSubmitPrediction = () => {
    if (!prediction.trim()) return;
    setPredictionSubmitted(true);
    const predictionText = notebook.predictionOptions?.find(o => o.id === prediction)?.text || prediction;
    sendText(
      `[PREDICTION_MADE] Student predicted: "${predictionText}". `
      + `Acknowledge their prediction warmly without saying whether it will happen: "Interesting idea! Let's test it."`,
      { silent: true }
    );
    if (items[currentIndex]?.stage !== 'before') {
      setFeedback('Great prediction! Now let\'s find out what happens...');
      setFeedbackType('success');
    }
  };

  const handleSelectSubstance = (substanceId: string) => {
    if (hasSubmittedEvaluation || animating) return;
    SoundManager.select();
    setSelectedSubstances(prev => {
      const next = new Set(prev);
      if (next.has(substanceId)) next.delete(substanceId); else next.add(substanceId);
      return next;
    });
  };

  const handleMixSubstances = () => {
    if (animating || learnerBlocked()) return;
    if (!tutorOwned && selectedSubstances.size < 2) return;
    SoundManager.snap();
    setReactionRun(true);
    runAnimation();
    if (tutorOwned) return;
    sendText(
      `[REACTION_STARTED] Student mixed the substances. The reaction is happening! `
      + `Ask them to watch closely; do not name what they should see.`,
      { silent: true }
    );
    const duration = Math.min(Math.max(animation.realView.duration || 3, 1), 6) * 1000;
    setTimeout(() => {
      setCurrentPhase(p => (p === 'experiment' ? 'observe' : p));
      sendText('[REACTION_COMPLETE] The reaction finished. Ask the student to record what they saw, heard and felt.', { silent: true });
    }, duration);
  };

  const handleObservationChange = (prompt: string, value: string) => setObservations(prev => ({ ...prev, [prompt]: value }));
  const handleToggleSign = (sign: string) => setIdentifiedSigns(prev => {
    const next = new Set(prev);
    if (next.has(sign)) next.delete(sign); else next.add(sign);
    return next;
  });

  const handleFinishObservations = () => {
    const recordedCount = Object.values(observations).filter(v => v.trim()).length;
    sendText(
      `[OBSERVATIONS_RECORDED] Student recorded ${recordedCount}/${notebook.observePrompts.length} observations `
      + `and marked ${identifiedSigns.size} signs of change. Now guide them to explain: "${notebook.explainPrompt}"`,
      { silent: true }
    );
    setCurrentPhase('explain');
    setFeedback('');
    setFeedbackType('');
  };

  const handleToggleParticleView = () => {
    if (learnerBlocked()) return;
    setParticleViewActive(prev => !prev);
  };

  // ── Challenge check ──
  const handleSelectChoice = (value: string) => {
    if (solvedNow || wrongPick !== null || learnerBlocked() || lever.dropped.includes(value)) return;
    SoundManager.select();
    setChoice(value);
  };

  const handleCheckChallenge = () => {
    if (!currentItem || solvedNow || wrongPick !== null || learnerBlocked() || hasSubmittedEvaluation) return;
    const c = currentItem.challenge;
    const form = answerForm(c);
    let correct: boolean;
    let said: string;
    if (form === 'open') {
      // Scripted path only (the workspace keeps keyed challenges): the legacy typed-answer rule.
      const typed = typedAnswer.trim().toLowerCase();
      if (!typed) return;
      correct = typed.includes(c.targetAnswer.toLowerCase()) || typed.length >= 15;
      said = `Typed "${typedAnswer.trim()}"`;
    } else {
      if (choice === null) return;
      correct = reactionCorrect(currentItem, choice);
      said = describeReactionWork(currentItem, choice);
    }
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(said, correct, correct ? undefined : reactionMiss(currentItem, choice));
    if (correct) progress.mergeResult({ challengeId: currentItem.id, correct: true, attempts: currentAttempts + 1, challengeType: c.type });

    if (c.type === 'classify') {
      setClassificationTotal(n => n + 1);
      if (correct) setClassificationCorrect(n => n + 1);
    }
    if (correct && c.type === 'balance') setEquationBalanced(true);
    if (correct && c.type === 'conservation') setConservationUnderstood(true);

    if (correct) {
      SoundManager.playCorrect();
      tappedCorrect.current = currentItem.id;
      setFeedback(c.narration || 'Excellent work!');
      setFeedbackType('success');
      sendText(`[ANSWER_CORRECT] Student answered correctly for challenge "${c.instruction}". Celebrate: "${c.narration}"`, { silent: true });
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) {
      // The tutor and the runtime take it from here: the wrong choice stays marked until Try again.
      const picked = choice;
      setWrongPick(picked);
      if (picked !== null) editLevers((s) => ({ picked: [...s.picked, picked] }));
      return;
    }
    setFeedback(currentAttempts >= 1 ? c.hint : 'Not quite — try again!');
    setFeedbackType('error');
    sendText(
      `[ANSWER_INCORRECT] Student answered "${said}" for "${c.instruction}" and it is wrong. Attempt ${currentAttempts + 1}. `
      + `You are NOT told the right answer. Point them back at what the experiment showed. Hint: "${c.hint}"`,
      { silent: true }
    );
  };

  // ── Scripted path: Next and the submission ──
  const submitScripted = () => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const correctCount = results.filter(r => r.correct).length;
    const score = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;
    submitEvaluation(correctCount === items.length, score, buildMetrics(), {
      challengeResults: results, prediction, observations });
  };

  const buildMetrics = (): ReactionLabMetrics => ({
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
    experimentsCompleted: reactionRun ? 1 : 0,
    experimentsTotal: 1,
    safetyAwarenessShown: safetyViewed,
    attemptsCount: results.reduce((s, r) => s + r.attempts, 0),
  });

  const advanceToNextChallenge = () => {
    const next = items[currentIndex + 1];
    setChoice(null);
    setTypedAnswer('');
    setFeedback('');
    setFeedbackType('');
    if (!progress.advance()) return;
    // The predictions are done: the experiment runs before the next (after-mixing) challenge.
    if (currentPhase === 'predict' && next?.stage === 'after') setCurrentPhase('experiment');
    sendText(`[NEXT_ITEM] Moving to challenge ${currentIndex + 2} of ${items.length}: "${next?.challenge.instruction}". Introduce it.`, { silent: true });
  };

  // Scripted path: the last right answer completes the set (no Next follows it), so the submission runs here. It
  // never ran before 10-15: Next was hidden once every challenge was right, and only Next submitted.
  useEffect(() => {
    if (tutorOwned || !isComplete || hasSubmittedEvaluation) return;
    sendText(`[ALL_COMPLETE] Student completed all ${items.length} challenges for "${experiment.name}"! Celebrate.`, { silent: true });
    submitScripted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorOwned, isComplete]);

  // Workspace path, under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || items.length === 0) return;
    submitEvaluation(result.passed, result.accuracy, buildMetrics(),
      { studentWork: { challenges: items.map((i) => i.challenge.instruction) },
        challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the screen shows ──
  const particleAllowed = showParticleView && animation.particleView.reactantMolecules.length > 0
    && animation.particleView.productMolecules.length > 0;
  // The equation prints the products and the balanced equation: hidden during the predictions and a balance challenge.
  const equationShown = showEquation && !!reaction.equation && (tutorOwned
    ? !(wsStage === 'before' || (wsStage === 'after' && equationHidden(currentChallenge, solvedNow)))
    : !(currentPhase === 'predict' || (currentPhase === 'explain' && equationHidden(currentChallenge, solvedNow))));
  // The counter prints "=" between reactants and products, the answer to a conservation statement: hidden on the
  // workspace path, and on the scripted path while a conservation challenge is unsolved.
  const counterShown = !tutorOwned && showConservationCounter
    && !items.some(i => i.challenge.type === 'conservation' && !results.some(r => r.challengeId === i.id && r.correct));
  const molecules = [...animation.particleView.reactantMolecules, ...animation.particleView.productMolecules];
  const leverCtx = { reactionRun, animating, particleAllowed, particleOpen: particleViewActive, molecules };
  const shownLevers = tutorOwned && cardVisible ? lever.pulled : [];

  // Workspace path: what the tutor and the observer are shown, republished every render. Before the learner mixes,
  // an after-mixing challenge holds the response.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentItem || isComplete) return;
    const ready = currentItem.stage === 'before' || reactionRun;
    const scene = workspaceScene(currentItem, {
      reactionRun, animating, choice: wrongPick ?? choice, particleOpen: particleViewActive, equationShown,
      showTemperature: showTemperatureGauge,
    }, data);
    const levers = ready ? reactionLevers(currentItem, lever, leverCtx) : [];
    const onScreen = ready ? leverFacts(currentItem, lever, { animating }) : null;
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}) },
      readyForResponse: ready,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find((x) => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === DROP_LEVER) {
          const far = farChoice(currentItem, lever);
          if (far === null) return 'No more choices can be greyed out here; too few would be left.';
          editLevers((s) => ({ pulled: [...s.pulled, id], dropped: [...s.dropped, far] }));
          if (choice === far) setChoice(null);
          return true;
        }
        if (id === REPLAY_LEVER) {
          if (animating) return 'The reaction is already playing.';
          runAnimation();
        }
        if (id === PARTICLE_LEVER) {
          if (particleViewActive) return 'The particle view is already open.';
          setParticleViewActive(true);
        }
        editLevers((s) => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // ── Pip shared surface ──
  // A projection of this item's check state, the tutor's speech on it, and the child's touches; Pip points only at
  // the workspace as a whole and never chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: hasSubmittedEvaluation || !cardVisible ? null : currentItem?.id ?? null,
    label: 'The challenge and your answer',
    solved: cardVisible && solvedNow && !!currentChallenge && answerForm(currentChallenge) !== 'open',
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  // ── Render pieces ──
  const renderShelf = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {substances.map(sub => (
        <div key={sub.id} className="rounded-lg border p-3 text-center bg-white/5 border-white/10">
          <div className="text-xl mb-1">{STATE_EMOJIS[sub.state] || '🧪'}</div>
          <div className="text-slate-200 text-xs font-medium">{sub.name}</div>
          {sub.formula && gradeBand !== 'K-2' && <div className="text-slate-500 text-[10px] font-mono">{sub.formula}</div>}
          <div className="text-slate-600 text-[10px]">{sub.amount}</div>
        </div>
      ))}
    </div>
  );

  const renderMixPanel = () => (
    <div className="space-y-3">
      <p className="text-slate-300 text-sm text-center">
        {tutorOwned ? 'Mix the substances and watch what happens:' : 'Select substances to mix:'}
      </p>
      {tutorOwned ? renderShelf() : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {substances.map(sub => {
            const selected = selectedSubstances.has(sub.id);
            return (
              <button type="button" key={sub.id} onClick={() => handleSelectSubstance(sub.id)} aria-pressed={selected}
                className={`rounded-lg border p-3 text-center cursor-pointer transition-all ${
                  selected ? 'bg-cyan-500/15 border-cyan-400/40 scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>
                <div className="text-xl mb-1">{STATE_EMOJIS[sub.state] || '🧪'}</div>
                <div className="text-slate-200 text-xs font-medium">{sub.name}</div>
                <div className="text-slate-600 text-[10px]">{sub.amount}</div>
                {selected && <Badge className="mt-1 text-[10px] bg-cyan-500/20 text-cyan-300 border-cyan-400/30">Selected</Badge>}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex justify-center">
        <Button variant="ghost" className="bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-300"
          onClick={handleMixSubstances} disabled={!tutorOwned && selectedSubstances.size < 2}>
          Mix Substances!
        </Button>
      </div>
    </div>
  );

  /** The beaker after mixing, with the particle view. `caption`: the particle sentence, or null beside a challenge. */
  const renderReaction = (caption: string | null) => (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider block text-center mb-2">Real View</span>
          <ReactionBeaker isReacting={animating} ran={reactionRun} effects={animation.realView.effects} substances={substances}
            temperatureChange={showTemperatureGauge ? animation.realView.temperatureChange : null} />
          <div className="flex flex-wrap justify-center gap-1 mt-2">
            {animation.realView.effects.map(effect => (
              <Badge key={effect} className={`text-[10px] bg-white/5 border-white/10 text-slate-400 ${animating ? EFFECT_STYLES[effect] || '' : ''}`}>
                {effectLabel(effect)}
              </Badge>
            ))}
          </div>
        </div>
        {showParticleView && (
          <div className="flex-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider">Particle View</span>
              <Button variant="ghost" className="h-5 px-2 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400"
                onClick={handleToggleParticleView}>
                {particleViewActive ? 'Hide' : 'Show'}
              </Button>
            </div>
            {particleViewActive && <ParticleView animation={animation} animating={animating} showProducts={reactionRun} caption={caption} />}
          </div>
        )}
      </div>
      {!animating && reaction.energyChange !== 'neutral' && (
        <div className={`text-center text-xs ${reaction.energyChange === 'exothermic' ? 'text-red-400' : 'text-blue-400'}`}>
          {reaction.energyChange === 'exothermic' ? '🔥 Exothermic — released heat' : '❄️ Endothermic — absorbed heat'}
        </div>
      )}
      {counterShown && !animating && (
        <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">Conservation of Mass</span>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-blue-300 text-xs">Reactant atoms: {animation.particleView.reactantMolecules.length}</span>
            <span className="text-slate-500">=</span>
            <span className="text-emerald-300 text-xs">Product atoms: {animation.particleView.productMolecules.length}</span>
          </div>
        </div>
      )}
    </div>
  );

  const choiceButton = (c: ReactionChoice, wide: boolean) => {
    const picked = (wrongPick ?? choice) === c.value;
    const wrong = wrongPick === c.value;
    const dropped = lever.dropped.includes(c.value);
    const closed = solvedNow || wrongPick !== null || dropped;
    return (
      <Button key={c.value} variant="ghost" aria-label={c.label} data-dropped={dropped ? 'true' : undefined}
        disabled={closed && !picked}
        className={`h-auto ${wide ? 'text-left p-3 w-full' : 'flex-1 py-3'} border transition-all duration-300 ${
          dropped ? 'opacity-30 line-through border-white/5 bg-white/5'
            : wrong ? 'border-red-400/50 bg-red-500/15'
              : picked ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
        }`}
        onClick={() => handleSelectChoice(c.value)}>
        <div className="flex items-center gap-3 w-full">
          {wide && (
            <Badge className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border flex-shrink-0 ${
              picked ? 'bg-white text-slate-900 border-white' : 'bg-black/30 text-slate-400 border-white/10'}`} aria-hidden="true">
              {c.letter}
            </Badge>
          )}
          <span className="text-sm text-slate-200 whitespace-normal">{c.label}</span>
        </div>
      </Button>
    );
  };

  const renderChallengeCard = () => {
    if (!currentItem || !currentChallenge) return null;
    const form = answerForm(currentChallenge);
    const choices = itemChoices(currentChallenge);
    return (
      <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] bg-slate-700/50 text-slate-300 border-slate-600/50">{currentChallenge.type.replace('_', ' ')}</Badge>
          <p className="text-slate-200 text-sm font-medium">{currentChallenge.instruction}</p>
        </div>
        {shownLevers.includes(LEGEND_LEVER) && <SignsLegend />}
        {!solvedNow && (
          <>
            {form === 'open' ? (
              <textarea value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 resize-none"
                rows={2} aria-label="Your answer" />
            ) : form === 'choice' ? (
              <div className="grid grid-cols-1 gap-2">{choices.map(c => choiceButton(c, true))}</div>
            ) : (
              <div className="flex gap-2 max-w-sm mx-auto">{choices.map(c => choiceButton(c, false))}</div>
            )}
            <Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleCheckChallenge}
              disabled={(form === 'open' ? !typedAnswer.trim() : choice === null) || wrongPick !== null || hasSubmittedEvaluation}>
              Check Answer
            </Button>
          </>
        )}
        {solvedNow && (
          <p className="text-emerald-300 text-sm">✓ {choices.find(c => c.value === keyValue(currentChallenge))?.label ?? typedAnswer}</p>
        )}
      </div>
    );
  };

  const renderChallengeArea = () => (
    <>
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          {items.map((it, i) => (
            <div key={it.id} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              results.some(r => r.challengeId === it.id && r.correct) ? 'bg-emerald-400'
                : i === currentIndex ? 'bg-cyan-400 scale-125' : 'bg-slate-600'}`} />
          ))}
          <span className="text-slate-500 text-xs ml-auto">{Math.min(currentIndex + 1, items.length)} of {items.length}</span>
        </div>
      )}
      {pip.store && cardVisible && <div {...pip.dock} />}
      <div {...pip.workspace}>{cardVisible && renderChallengeCard()}</div>
    </>
  );

  const renderComplete = () => (
    <div className="text-center py-4">
      <p className="text-emerald-400 text-sm font-medium mb-2">Experiment Complete!</p>
      <p className="text-slate-400 text-xs">{results.filter(r => r.correct).length} / {items.length} challenges correct</p>
    </div>
  );

  // ── Scripted phases ──
  const renderPredictPhase = () => {
    const options = notebook.predictionOptions?.length ? shownOptions(notebook.predictionOptions, `${resolvedInstanceId}-prediction`) : [];
    return (
      <div className="space-y-3">
        {renderShelf()}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
          <p className="text-slate-200 text-sm font-medium mb-2">{notebook.predictPrompt}</p>
          {options.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {options.map(o => (
                <Button key={o.value} variant="ghost" aria-label={o.label} disabled={predictionSubmitted}
                  className={`h-auto text-left p-3 border transition-all duration-300 ${
                    prediction === o.value ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  onClick={() => !predictionSubmitted && setPrediction(o.value)}>
                  <div className="flex items-center gap-3 w-full">
                    <Badge className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border flex-shrink-0 bg-black/30 text-slate-400 border-white/10" aria-hidden="true">
                      {o.letter}
                    </Badge>
                    <span className="text-sm text-slate-200 whitespace-normal">{o.label}</span>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <textarea value={prediction} onChange={e => setPrediction(e.target.value)} placeholder="I think..." rows={2}
              disabled={predictionSubmitted}
              className="w-full px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600 resize-none" />
          )}
          {!predictionSubmitted && (
            <Button variant="ghost" className="mt-3 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleSubmitPrediction} disabled={!prediction.trim()}>
              Submit Prediction
            </Button>
          )}
        </div>
        {predictionSubmitted && currentItem?.stage === 'before' && !isComplete && renderChallengeArea()}
        {predictionSubmitted && (currentItem?.stage !== 'before' || isComplete) && (
          <div className="flex justify-center">
            <Button variant="ghost" className="bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={() => { setCurrentPhase('experiment'); setFeedback(''); setFeedbackType(''); }}>
              Run the Experiment →
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderObservePhase = () => (
    <div className="space-y-3">
      <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">📝</span>
          <span className="text-slate-200 text-sm font-medium">Observation Notebook</span>
        </div>
        {notebook.observePrompts.map((prompt, i) => (
          <div key={i}>
            <label className="text-slate-400 text-xs block mb-1">{prompt}</label>
            <input type="text" value={observations[prompt] || ''} onChange={e => handleObservationChange(prompt, e.target.value)}
              placeholder="I noticed..."
              className="w-full px-3 py-1.5 bg-slate-800/50 border border-white/15 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600" />
          </div>
        ))}
      </div>
      {/* Marked signs stay one neutral colour: colouring each by the key let a learner tap them all to read it. */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
        <p className="text-slate-300 text-sm mb-2">Which signs of change did you observe?</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SIGN_LABELS).map(([key, { label, emoji }]) => (
            <Button key={key} variant="ghost" aria-pressed={identifiedSigns.has(key)}
              className={`h-auto py-1.5 px-3 text-xs ${identifiedSigns.has(key)
                ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}
              onClick={() => handleToggleSign(key)}>
              {emoji} {label}
            </Button>
          ))}
        </div>
      </div>
      {showParticleView && (
        <div>
          <Button variant="ghost" className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-sm"
            onClick={handleToggleParticleView}>
            🔬 {particleViewActive ? 'Hide' : 'Show'} Particle View
          </Button>
          {particleViewActive && (
            <div className="mt-2">
              <ParticleView animation={animation} animating={false} showProducts={reactionRun} caption={reaction.particleDescription} />
            </div>
          )}
        </div>
      )}
      <div className="flex justify-center">
        <Button variant="ghost" className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
          onClick={handleFinishObservations}>
          Done Observing
        </Button>
      </div>
    </div>
  );

  const renderScripted = () => (
    <>
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
                isActive ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-300' : isPast ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-600'}`}>
                <span>{emojis[phase]}</span>
                <span className="hidden sm:inline">{labels[phase]}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {currentPhase === 'predict' && renderPredictPhase()}
      {currentPhase === 'experiment' && (
        <div className="space-y-3">
          {!reactionRun && renderMixPanel()}
          {reactionRun && renderReaction(reaction.particleDescription)}
          {reactionRun && !animating && (
            <div className="flex justify-center">
              <Button variant="ghost" className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={() => setCurrentPhase('observe')}>
                Record Observations
              </Button>
            </div>
          )}
        </div>
      )}
      {currentPhase === 'observe' && showObservationNotebook && renderObservePhase()}
      {currentPhase === 'observe' && !showObservationNotebook && (
        <div className="flex justify-center">
          <Button variant="ghost" className="bg-emerald-500/10 border border-emerald-400/30 text-emerald-300" onClick={handleFinishObservations}>
            Done Observing
          </Button>
        </div>
      )}
      {currentPhase === 'explain' && (
        <div className="space-y-3">
          {!isComplete && renderChallengeArea()}
          {allChallengesComplete && renderComplete()}
        </div>
      )}
      {feedback && (
        <div className={`text-center text-sm font-medium transition-all duration-300 ${
          feedbackType === 'success' ? 'text-emerald-400' : feedbackType === 'error' ? 'text-red-400' : 'text-slate-300'}`}>
          {feedback}
        </div>
      )}
      {cardVisible && solvedNow && (
        <div className="flex justify-center">
          <Button variant="ghost" className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
            onClick={advanceToNextChallenge}>
            Next Challenge
          </Button>
        </div>
      )}
    </>
  );

  // ── Workspace stage ──
  const renderWorkspace = () => (
    <>
      {wsStage === 'before' && renderShelf()}
      {wsStage === 'mix' && renderMixPanel()}
      {(wsStage === 'after' || (wsStage === 'done' && reactionRun)) && renderReaction(wsStage === 'done' ? reaction.particleDescription : null)}
      {wsStage !== 'done' && wsStage !== 'mix' && renderChallengeArea()}
      {feedback && feedbackType === 'success' && cardVisible && (
        <div className="text-center text-sm font-medium text-emerald-400">{feedback}</div>
      )}
      {wsStage === 'done' && (
        <>
          {renderComplete()}
          {/* The predictions are done: the learner may now run the experiment and see what happens (ungraded). */}
          {!reactionRun && renderMixPanel()}
        </>
      )}
    </>
  );

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">{gradeBand}</Badge>
            <Badge className={`text-xs ${CATEGORY_COLORS[experiment.category] || 'bg-slate-500/10 border-slate-400/30'} text-slate-300`}>
              {experiment.category.replace('_', ' ')}
            </Badge>
            {showSafetyBadge && (
              <Badge className={`text-xs cursor-pointer ${SAFETY_CONFIG[experiment.safetyLevel].bg} ${SAFETY_CONFIG[experiment.safetyLevel].color}`}
                onClick={() => setSafetyViewed(true)}>
                {SAFETY_CONFIG[experiment.safetyLevel].emoji} {SAFETY_CONFIG[experiment.safetyLevel].label}
              </Badge>
            )}
          </div>
        </div>
        {equationShown && (
          <div className="mt-2 bg-slate-800/30 rounded-lg px-3 py-2 border border-white/5 font-mono text-sm text-center">
            <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Equation</span>
            <span className="text-slate-200">{reaction.equation}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {tutorOwned ? renderWorkspace() : renderScripted()}

        <Accordion type="single" collapsible>
          <AccordionItem value="connection" className="border-white/10">
            <AccordionTrigger className="text-slate-400 text-xs hover:text-slate-200 py-2">🌍 Real-World Connection</AccordionTrigger>
            <AccordionContent><p className="text-slate-300 text-sm">{experiment.realWorldConnection}</p></AccordionContent>
          </AccordionItem>
          {substances.some(s => s.safetyInfo) && (
            <AccordionItem value="safety" className="border-white/10">
              <AccordionTrigger className="text-slate-400 text-xs hover:text-slate-200 py-2" onClick={() => setSafetyViewed(true)}>
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

        {!tutorOwned && currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && cardVisible && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">💡 {currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const ReactionLab = withWorkspaceController<ReactionLabProps, ProgressOptions<ReactionItem>, Progress>(
  'reaction-lab', ReactionLabSurface, useScriptedProgress, useWorkspaceProgressFor('reaction-lab'));

export default ReactionLab;
