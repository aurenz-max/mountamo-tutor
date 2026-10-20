'use client';

/**
 * Reaction Lab: a virtual experiment station (predict, mix, observe, explain), taught only on the shared tutor/JEV
 * workspace (`withWorkspaceOnly`; its wiring is `reactionLab.card.ts` + `reactionLab.boss.ts`, a SAY_OR_SHOW card on
 * the spoken preset). Every item is one challenge with a code-held key (`reactionLabWorkspace.ts`). A predict challenge
 * is asked beside the unmixed substances; any other waits for the learner to press Mix Substances!, then is asked
 * beside the reaction. A tap commits through `progress.commitCheck` with its named miss, a spoken answer is judged by
 * the tutor, and the levers are one lever set (`reactionLabLevers.ts`) published with the scene. No Next: the runtime
 * moves the item.
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
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  answerForm, describeReactionWork, effectLabel, equationHidden, itemChoices, keyValue, reactionCorrect, reactionItems,
  reactionMiss, workspaceScene, type ReactionChoice, type ReactionItem,
} from './reactionLabWorkspace';
import {
  DROP_LEVER, LEGEND_LEVER, LEGEND_TITLE, NO_LEVERS, PARTICLE_LEVER, REACTION_LEVERS, REPLAY_LEVER, SIGN_LEGEND, farChoice,
  type ReactionLeverState,
} from './reactionLabLevers';
import { reactionLabBoss } from './reactionLab.boss';

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

type LeverMemo = { item: string } & ReactionLeverState;

// ============================================================================
// Component
// ============================================================================

const useReactionProgress = useWorkspaceProgressFor('reaction-lab');

const ReactionLabSurface = ({ data, className, runtimePlanItemId }: ReactionLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    experiment,
    substances = [],
    reaction,
    animation,
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
  } = showOptions;

  const stableInstanceIdRef = useRef(instanceId || `reaction-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Items: the challenges with a code-held key, predict challenges first (asked before mixing). ──
  const items = useMemo(() => [...reactionLabBoss.items(data)], [data]);

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useReactionProgress({
    challenges: items,
    getChallengeId: (i) => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: reactionLabBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: (index) => solvedAloud.current(index),
    onFinished: (result) => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  // ── State ──
  /** The substances have been mixed; the reaction stays shown from then on. */
  const [reactionRun, setReactionRun] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);
  const [particleViewActive, setParticleViewActive] = useState(false);

  /** The choice picked on the current challenge (an option id, 'true'/'false', 'chemical'/'physical'). */
  const [choice, setChoice] = useState<string | null>(null);
  /** The wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [safetyViewed, setSafetyViewed] = useState(false);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const currentItem: ReactionItem | undefined = items[currentIndex];
  const currentChallenge = currentItem?.challenge ?? null;
  const solvedNow = !!currentItem && results.some((r) => r.challengeId === currentItem.id && r.correct);
  const lever: ReactionLeverState = leverMemo.item === currentItem?.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: ReactionLeverState) => Partial<ReactionLeverState>) => {
    const id = currentItem?.id ?? '';
    setLeverMemo((m) => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };

  /** What the stage shows for the current item. */
  const stage: 'before' | 'mix' | 'after' | 'done' = !currentItem || isComplete ? 'done'
    : currentItem.stage === 'before' ? 'before' : reactionRun ? 'after' : 'mix';
  /** The challenge card is on screen. */
  const cardVisible = stage === 'before' || stage === 'after';

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

  // ── Workspace callbacks ──
  /** A fresh item, or Try again: the choice is cleared; a retry counts one more wrong answer for the levers. */
  openItem.current = (_index, retry) => {
    setChoice(null);
    setWrongPick(null);
    setFeedback('');
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

  const handleMixSubstances = () => {
    if (animating || learnerBlocked()) return;
    SoundManager.snap();
    setReactionRun(true);
    runAnimation();
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
    if (!currentItem || solvedNow || wrongPick !== null || learnerBlocked() || hasSubmittedEvaluation || choice === null) return;
    const correct = reactionCorrect(currentItem, choice);
    // Counts the attempt and records the checked gesture with its named miss.
    progress.commitCheck(describeReactionWork(currentItem, choice), correct, correct ? undefined : reactionMiss(currentItem, choice));
    if (correct) {
      progress.mergeResult({ challengeId: currentItem.id, correct: true, attempts: currentAttempts + 1, challengeType: currentItem.challenge.type });
      SoundManager.playCorrect();
      tappedCorrect.current = currentItem.id;
      setFeedback(currentItem.challenge.narration || 'Excellent work!');
      return;
    }
    SoundManager.playIncorrect();
    // The tutor and the runtime take it from here: the wrong choice stays marked until Try again.
    setWrongPick(choice);
    editLevers((s) => ({ picked: [...s.picked, choice] }));
  };

  // ── The scored session (under a lesson's evaluation provider only) ──
  const buildMetrics = (): ReactionLabMetrics => {
    const right = (types: readonly string[]) => items.filter(i => types.includes(i.challenge.type)
      && results.some(r => r.challengeId === i.id && r.correct)).length;
    const count = (types: readonly string[]) => items.filter(i => types.includes(i.challenge.type)).length;
    const predictions = count(['predict']);
    return {
      type: 'reaction-lab',
      predictionMade: predictions > 0 && results.some(r => items.find(i => i.id === r.challengeId)?.stage === 'before'),
      predictionAccuracy: predictions ? right(['predict']) / predictions : 0,
      observationsRecorded: 0,
      observationPromptsTotal: 0,
      chemicalVsPhysicalCorrect: right(['classify']),
      classificationTotal: count(['classify']),
      signsOfChangeIdentified: right(['identify_signs']),
      signsTotal: count(['identify_signs']),
      particleViewEngaged: particleViewActive,
      equationBalanced: right(['balance']) > 0,
      conservationUnderstood: right(['conservation']) > 0,
      experimentsCompleted: reactionRun ? 1 : 0,
      experimentsTotal: 1,
      safetyAwarenessShown: safetyViewed,
      attemptsCount: results.reduce((s, r) => s + r.attempts, 0),
    };
  };

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
  const equationShown = showEquation && !!reaction.equation
    && !(stage === 'before' || (stage === 'after' && equationHidden(currentChallenge, solvedNow)));
  const molecules = [...animation.particleView.reactantMolecules, ...animation.particleView.productMolecules];
  const leverCtx = { reactionRun, animating, particleAllowed, particleOpen: particleViewActive, molecules, state: lever };
  const shownLevers = cardVisible ? lever.pulled : [];

  // What the tutor and the observer are shown, republished every render. Before the learner mixes, an after-mixing
  // challenge holds the response and offers no lever.
  useLayoutEffect(() => {
    if (!currentItem || isComplete) return;
    const ready = currentItem.stage === 'before' || reactionRun;
    const scene = workspaceScene(currentItem, {
      reactionRun, animating, choice: wrongPick ?? choice, particleOpen: particleViewActive, equationShown,
      showTemperature: showTemperatureGauge,
    }, data);
    const levers = ready ? REACTION_LEVERS.declare(currentItem, leverCtx, lever.pulled) : [];
    workspace.current = {
      ...leverScene(scene, { support: REACTION_LEVERS.support(currentItem, leverCtx),
        onScreen: ready ? REACTION_LEVERS.onScreen(currentItem, leverCtx, lever.pulled) : '' }),
      readyForResponse: ready,
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find((x) => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        // Drawing a pulled lever: the far choice greyed out, the reaction replayed, or the particle view opened.
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
      <p className="text-slate-300 text-sm text-center">Mix the substances and watch what happens:</p>
      {renderShelf()}
      <div className="flex justify-center">
        <Button variant="ghost" className="bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-300"
          onClick={handleMixSubstances}>
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
            {form === 'choice' ? (
              <div className="grid grid-cols-1 gap-2">{choices.map(c => choiceButton(c, true))}</div>
            ) : (
              <div className="flex gap-2 max-w-sm mx-auto">{choices.map(c => choiceButton(c, false))}</div>
            )}
            <Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
              onClick={handleCheckChallenge}
              disabled={choice === null || wrongPick !== null || hasSubmittedEvaluation || progress.canAttempt === false}>
              Check Answer
            </Button>
          </>
        )}
        {solvedNow && (
          <p className="text-emerald-300 text-sm">✓ {choices.find(c => c.value === keyValue(currentChallenge))?.label}</p>
        )}
      </div>
    );
  };

  const renderProgressDots = () => items.length > 0 && (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <div key={it.id} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          results.some(r => r.challengeId === it.id && r.correct) ? 'bg-emerald-400'
            : i === currentIndex ? 'bg-cyan-400 scale-125' : 'bg-slate-600'}`} />
      ))}
      <span className="text-slate-500 text-xs ml-auto">{Math.min(currentIndex + 1, items.length)} of {items.length}</span>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center py-4">
      <p className="text-emerald-400 text-sm font-medium mb-2">Experiment Complete!</p>
      <p className="text-slate-400 text-xs">{results.filter(r => r.correct).length} / {items.length} challenges correct</p>
    </div>
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
        {stage !== 'done' && renderProgressDots()}
        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the experiment and the challenge as its region. */}
        {stage !== 'done' && <PipDock />}
        <PipWorkspace className="space-y-4">
          {stage === 'before' && renderShelf()}
          {stage === 'mix' && renderMixPanel()}
          {(stage === 'after' || (stage === 'done' && reactionRun)) && renderReaction(stage === 'done' ? reaction.particleDescription : null)}
          {cardVisible && renderChallengeCard()}
          {feedback && cardVisible && solvedNow && (
            <div className="text-center text-sm font-medium text-emerald-400">{feedback}</div>
          )}
          {stage === 'done' && (
            <>
              {renderComplete()}
              {/* The predictions are done: the learner may now run the experiment and see what happens (ungraded). */}
              {!reactionRun && renderMixPanel()}
            </>
          )}
        </PipWorkspace>

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
      </CardContent>
    </Card>
  );
};

const ReactionLab = withWorkspaceOnly<ReactionLabProps>('reaction-lab', ReactionLabSurface, props => props.data.title);

export default ReactionLab;
