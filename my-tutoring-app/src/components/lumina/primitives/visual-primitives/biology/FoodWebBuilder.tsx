'use client';

/**
 * Food Web Builder - Interactive Energy Flow System
 *
 * Two eval modes:
 * - `complete_web` (the original task): the organisms sit on a canvas by trophic level and the learner draws every
 *   feeding relationship as an arrow (prey → eater), then presses Check. Optional disruption scenarios follow a
 *   complete web.
 * - `build_chain` (open build, /add-eval-modes references/build-mode.md): "Make a food chain with 4 living things that
 *   ends at the Hawk." The scene starts EMPTY; the learner puts living things in from a list, draws the arrows and
 *   presses "I'm done!". Many chains pass: the check (`foodChainMiss`) reads the build as a graph against the lesson's
 *   own feeding relations. Code owns every target (`pickChainTargets`).
 *
 * On the shared teaching workspace (W1, plain shape) every check commits through `progress.commitCheck` with the
 * learner's work in words and a named miss; the runtime owns progression, so the scripted Next and Try Again are
 * hidden there and the scored session is submitted from `onFinished`.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  LuminaActionButton, LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardDescription, LuminaCardHeader,
  LuminaCardTitle, LuminaFeedbackCard,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { FoodWebBuilderMetrics } from '../../../evaluation/types';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  chainShape, describeFoodWebWork, feedingRelations, feeds, foodChainMiss, foodWebMiss, watchNeverSay, workspaceAssignment, workspaceScene,
  type Arrow, type FoodChainMiss, type FoodWebView,
} from './foodWebWorkspace';
import {
  ARROW_WORDS_LEVER, CHAIN_COUNT_LEVER, FOOD_TAG, FOOD_TAGS_LEVER, foodWebLevers, leverFacts, shorterChain,
} from './foodWebLevers';
import { FoodChainScene, freeSlot, type PlacedOrganism } from './FoodChainScene';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Organism {
  id: string;
  name: string;
  imagePrompt: string;
  trophicLevel: 'producer' | 'primary-consumer' | 'secondary-consumer' | 'tertiary-consumer' | 'decomposer';
  position: { x: string; y: string }; // Percentage positions
}

export interface Connection {
  fromId: string; // prey/energy source
  toId: string;   // predator/consumer
  relationship: string; // e.g., "Rabbits eat grass"
}

export interface DisruptionChallenge {
  removeOrganismId: string;
  question: string;
  expectedEffects: string[];
  explanation: string;
}

export type FoodWebChallengeType = 'complete_web' | 'build_chain';

/** One item. `complete_web` is the whole web; `build_chain` is a chain target written by code. */
export type FoodWebChallenge =
  | { id: string; type: 'complete_web' }
  | { id: string; type: 'build_chain'; length: number; endId: string; instruction: string };

export interface FoodWebBuilderData {
  primitiveType: 'food-web-builder';
  ecosystem: string;
  organisms: Organism[];
  correctConnections: Connection[];
  disruptionChallenges?: DisruptionChallenge[];
  gradeBand: '3-5' | '6-8';
  /** The eval mode pinned for this session. Absent = `complete_web`, the original whole-web task. */
  challengeType?: FoodWebChallengeType;
  /** build_chain: the chain targets, written by code (`pickChainTargets`). Unused on complete_web. */
  challenges?: FoodWebChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FoodWebBuilderMetrics>) => void;
}

export interface FoodWebBuilderProps {
  data: FoodWebBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const WEB_ITEM: FoodWebChallenge = { id: 'web', type: 'complete_web' };

const TROPHIC_COLOR: Record<Organism['trophicLevel'], string> = {
  producer: 'bg-green-500/20 border-green-500/50 text-green-300',
  'primary-consumer': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  'secondary-consumer': 'bg-orange-500/20 border-orange-500/50 text-orange-300',
  'tertiary-consumer': 'bg-red-500/20 border-red-500/50 text-red-300',
  decomposer: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
};
const TROPHIC_ACCENT = { producer: 'emerald', 'primary-consumer': 'amber', 'secondary-consumer': 'orange',
  'tertiary-consumer': 'rose', decomposer: 'purple' } as const;
const TROPHIC_LABEL: Record<Organism['trophicLevel'], string> = {
  producer: 'Producer', 'primary-consumer': '1° Consumer', 'secondary-consumer': '2° Consumer',
  'tertiary-consumer': '3° Consumer', decomposer: 'Decomposer',
};

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  build_chain: { label: 'Food chains', icon: '🔗', accentColor: 'emerald' },
};

/** Per-chain score: 100 first try, then -20 per extra attempt, floored at 20. */
const phaseScore = (attempts: number) => (attempts <= 0 ? 0 : Math.max(20, 100 - (attempts - 1) * 20));

/** The build's verdict words: what to look at, never the missing living thing or the way an arrow should point. */
const CHAIN_FEEDBACK: Record<FoodChainMiss, string> = {
  arrow_backwards: 'Not yet. Look again at which way each of your arrows points.',
  not_a_feeding_pair: 'Not yet. Every arrow must join two living things where one really eats the other.',
  broken_chain: 'Not yet. A food chain is one line of arrows that joins every living thing in your scene.',
  wrong_end: 'Not yet. Look at the living thing your chain ends at.',
  no_producer: 'Not yet. Think about where the energy in a food chain starts.',
  too_short: 'Not yet. Count the living things in your chain.',
  too_long: 'Not yet. Count the living things in your chain.',
};

// ============================================================================
// Component
// ============================================================================

const FoodWebBuilderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FoodWebBuilderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FoodWebChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    ecosystem, organisms = [], correctConnections = [], disruptionChallenges,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;
  const isBuild = data.challengeType === 'build_chain';
  const challenges = useMemo<FoodWebChallenge[]>(
    () => (isBuild ? (data.challenges ?? []).filter(c => c.type === 'build_chain') : [WEB_ITEM]),
    [isBuild, data.challenges]);
  /** The feeding relations the build is judged against (cleaned by code); the whole web keeps the lesson's list. */
  const relations = useMemo(() => (isBuild ? feedingRelations(organisms, correctConnections) : correctConnections),
    [isBuild, organisms, correctConnections]);

  const stableInstanceId = useRef(instanceId || `food-web-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: c => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: c => workspaceAssignment(c, ecosystem),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results, isComplete, mergeResult, advance } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  // build_chain levers (`foodWebLevers.ts`), keyed by the session item they were pulled on, and the easier ask a
  // simplify lever put on screen in its place. The item starts bare: no lever comes from the tier.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<FoodWebChallenge | null>(null);
  const sessionChallenge = challenges[currentIndex] ?? null;
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ── Per-item state ────────────────────────────────────────────
  const [placed, setPlaced] = useState<PlacedOrganism[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  /** complete_web: the arrows are coloured right/wrong after a check. */
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [challengeDone, setChallengeDone] = useState(false);
  const [showDisruption, setShowDisruption] = useState(false);
  const recordedRef = useRef(false);

  // A fresh item (or a practice ask, or the return from one) opens an empty scene. On the workspace path the reset
  // runs in the update that opens the item (`openItem`, the lever handlers); the effect then finds it already reset.
  const resetFor = useRef<string | null>(null);
  const resetItem = (challenge: FoodWebChallenge) => {
    resetFor.current = challenge.id;
    setPlaced([]); setArrows([]); setSelected(null); setChecked(false); setFeedback(null);
    setAttempts(0); setChallengeDone(false); setShowDisruption(false);
    recordedRef.current = false;
  };
  useEffect(() => {
    if (currentChallenge && resetFor.current !== currentChallenge.id) resetItem(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // Workspace path: a fresh item ends any practice. Try again KEEPS the build and the verdict's words, so the learner
  // revises it; only the selection and the whole web's right/wrong colours clear.
  openItem.current = (index, retry) => {
    if (!retry) {
      setPractice(null);
      if (challenges[index]) resetItem(challenges[index]);
      return;
    }
    setSelected(null); setChecked(false);
  };

  // ── Evaluation ────────────────────────────────────────────────
  const { submitResult, hasSubmitted, resetAttempt, submittedResult, elapsedMs } = usePrimitiveEvaluation<FoodWebBuilderMetrics>({
    primitiveType: 'food-web-builder',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const phaseResults = usePhaseResults({
    challenges: isBuild ? challenges : [],
    results,
    isComplete: isBuild && isComplete,
    getChallengeType: () => 'build_chain',
    phaseConfig: PHASE_CONFIG,
    getScore: rs => (rs.length ? Math.round(rs.reduce((s, r) => s + Number(r.score ?? 0), 0) / rs.length) : 0),
  });

  const organismName = (id: string) => organisms.find(o => o.id === id)?.name ?? id;
  const view: FoodWebView = {
    mode: isBuild ? 'build_chain' : 'complete_web', ecosystem, organisms,
    placed: isBuild ? placed.map(p => p.id) : organisms.map(o => o.id), arrows,
  };

  /** The whole web as the legacy check scored it. */
  const webScore = (drawn: readonly Arrow[]) => {
    const right = drawn.filter(a => feeds(relations, a.fromId, a.toId));
    const missing = relations.filter(c => !drawn.some(a => a.fromId === c.fromId && a.toId === c.toId));
    const extra = drawn.length - right.length;
    return { right, missing: missing.length, extra, accuracy: relations.length ? (right.length / relations.length) * 100 : 0,
      complete: missing.length === 0 && extra === 0 };
  };
  const webMetrics = (drawn: readonly Arrow[]): FoodWebBuilderMetrics => {
    const s = webScore(drawn);
    return {
      type: 'food-web-builder', challengeType: 'complete_web',
      totalConnections: relations.length, correctConnections: s.right.length, missingConnections: s.missing,
      extraConnections: s.extra, webComplete: s.complete, accuracy: s.accuracy,
      connectionAttempts: drawn.map(a => ({ fromId: a.fromId, toId: a.toId, isCorrect: feeds(relations, a.fromId, a.toId) })),
    };
  };
  const latestArrows = useRef(arrows); latestArrows.current = arrows;

  // ── Scripted build session complete → submit (the workspace path submits from `onFinished`) ──
  const sessionSubmitted = useRef(false);
  useEffect(() => {
    if (!isBuild || !isComplete || sessionSubmitted.current || tutorOwned || hasSubmitted) return;
    sessionSubmitted.current = true;
    const solved = results.filter(r => r.correct).length;
    const accuracy = Math.round(results.reduce((s, r) => s + Number(r.score ?? 0), 0) / Math.max(1, results.length));
    submitResult(solved === challenges.length, accuracy, {
      type: 'food-web-builder', challengeType: 'build_chain', totalConnections: challenges.length, correctConnections: solved,
      missingConnections: challenges.length - solved, extraConnections: 0, webComplete: solved === challenges.length, accuracy,
      connectionAttempts: [], chainsBuilt: solved, attemptsCount: results.reduce((s, r) => s + r.attempts, 0),
      firstTryCount: results.filter(r => Number(r.score ?? 0) === 100).length,
    }, { studentWork: { targets: challenges } });
  }, [isBuild, isComplete, results, challenges, tutorOwned, hasSubmitted, submitResult]);

  // Workspace path, under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const metrics: FoodWebBuilderMetrics = isBuild
      ? { type: 'food-web-builder', challengeType: 'build_chain', totalConnections: challenges.length,
        correctConnections: result.solvedCount, missingConnections: challenges.length - result.solvedCount, extraConnections: 0,
        webComplete: result.passed, accuracy: result.accuracy, connectionAttempts: [], chainsBuilt: result.solvedCount,
        attemptsCount: result.attemptsCount, firstTryCount: result.firstTryCount }
      : { ...webMetrics(latestArrows.current), accuracy: result.accuracy };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Building ──────────────────────────────────────────────────
  /** complete_web on the scripted path keeps its legacy lock: one submission, then Try Again. */
  const webLocked = !isBuild && !tutorOwned && hasSubmitted;
  const buildOpen = !challengeDone && !learnerBlocked() && !webLocked;

  const toggleListed = (id: string) => {
    if (!buildOpen) return;
    SoundManager.tap();
    if (placed.some(p => p.id === id)) {
      setPlaced(prev => prev.filter(p => p.id !== id));
      setArrows(prev => prev.filter(a => a.fromId !== id && a.toId !== id));
      if (selected === id) setSelected(null);
      return;
    }
    const slot = freeSlot(placed);
    if (slot < 0) return;
    setPlaced(prev => [...prev, { id, slot }]);
  };

  /** Tap one living thing, then another: an arrow from the first to the second. The reverse arrow is turned round. */
  const tapOrganism = (id: string) => {
    if (!buildOpen) return;
    if (!selected) { SoundManager.select(); setSelected(id); return; }
    if (selected === id) { setSelected(null); return; }
    const from = selected;
    setSelected(null);
    if (arrows.some(a => a.fromId === from && a.toId === id)) return;
    SoundManager.snap();
    setArrows(prev => [...prev.filter(a => !(a.fromId === id && a.toId === from)), { fromId: from, toId: id }]);
    setChecked(false);
  };
  const removeArrow = (arrow: Arrow) => {
    if (!buildOpen) return;
    SoundManager.tap();
    setArrows(prev => prev.filter(a => !(a.fromId === arrow.fromId && a.toId === arrow.toId)));
    setChecked(false);
  };
  const clearScene = () => {
    if (!buildOpen) return;
    setPlaced([]); setArrows([]); setSelected(null);
  };

  // ── Checks ────────────────────────────────────────────────────
  const completeCurrent = (attemptsCount: number) => {
    if (!currentChallenge || recordedRef.current) return;
    recordedRef.current = true;
    setChallengeDone(true);
    if (!practice) mergeResult({ challengeId: currentChallenge.id, correct: true, attempts: attemptsCount, score: phaseScore(attemptsCount) });
  };

  /** build_chain "I'm done!": any chain of the asked length from a producer to the asked end, every arrow a real relation. */
  const checkChain = () => {
    if (!currentChallenge || currentChallenge.type !== 'build_chain' || !buildOpen) return;
    const miss = foodChainMiss(currentChallenge, organisms, relations, placed.map(p => p.id), arrows);
    const next = attempts + 1;
    setAttempts(next);
    setSelected(null);
    progress.commitCheck(describeFoodWebWork(view), !miss, miss);
    if (!miss) {
      SoundManager.playCorrect();
      setFeedback({ text: `Yes! That is a food chain that ends at the ${organismName(currentChallenge.endId)}.`, correct: true });
      completeCurrent(next);
      return;
    }
    SoundManager.playIncorrect();
    setFeedback({ text: CHAIN_FEEDBACK[miss], correct: false });
  };

  /** complete_web Check: every feeding relation and no other arrow (the legacy check). */
  const checkWeb = () => {
    if (!buildOpen || !arrows.length) return;
    const miss = foodWebMiss(relations, arrows);
    const s = webScore(arrows);
    const next = attempts + 1;
    setAttempts(next);
    setSelected(null);
    setChecked(true);
    progress.commitCheck(describeFoodWebWork(view), !miss, miss);
    const parts = [`Correct connections: ${s.right.length} / ${relations.length}.`];
    if (s.missing) parts.push(`Missing ${s.missing} connection(s).`);
    if (s.extra) parts.push(`${s.extra} incorrect connection(s).`);
    setFeedback({ text: miss ? `Almost there! Check your food web. ${parts.join(' ')}` : "Perfect! You've built a complete food web!", correct: !miss });
    if (!miss) { SoundManager.playCorrect(); completeCurrent(next); } else SoundManager.playIncorrect();
    if (!tutorOwned) {
      submitResult(!miss, s.accuracy, webMetrics(arrows), { studentWork: { connections: arrows } });
    }
  };

  /** Scripted complete_web: start over after a submission. */
  const handleWebReset = () => {
    resetItem(WEB_ITEM);
    resetAttempt();
  };

  const handleNext = () => { advance(); };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view);
    if (!isBuild) { workspace.current = { ...scene }; return; }
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers);
    const levers = practice ? [] : foodWebLevers(sessionChallenge, organisms, relations, pulledLevers);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = shorterChain(sessionChallenge, organisms, relations);
          if (!easier) return 'This item has no easier ask; try a help lever.';
          setLeverState(pulled); resetItem(easier); setPractice(easier);
          return { practice: workspaceAssignment(easier, ecosystem) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetItem(sessionChallenge); setPractice(null); },
    };
  });

  // ── The live line (shared build layer): what the scene looks like, never a number, a verdict or the way food goes ──
  const sceneRef = useRef<SVGSVGElement | null>(null);
  const ask = currentChallenge?.type === 'build_chain' ? currentChallenge.instruction : '';
  const buildSeeing = useBuildWatcher({
    buildKey: `${placed.map(p => p.id).join(',')}|${arrows.map(a => `${a.fromId}>${a.toId}`).join(',')}`,
    enabled: isBuild && buildOpen && placed.length > 0,
    svg: sceneRef,
    request: {
      task: ask,
      sceneNote: 'A dark empty scene. The learner puts living things in as green name cards and draws arrows between them.',
      numbers: 'never',
      // Never a living thing that is not in the scene: naming one would hand over a missing link.
      neverSay: watchNeverSay(organisms, placed.map(p => p.id)),
    },
  });

  // ── Pip shared surface ─────────────────────────────────────────
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: (isBuild && isComplete) || webLocked ? null : currentChallenge?.id ?? null,
    label: isBuild ? 'The food chain' : 'The food web',
    solved: challengeDone,
    tutorSpeaking: false,
  });

  // ── Render ─────────────────────────────────────────────────────
  if (isBuild && !challenges.length) {
    return <div className={`w-full p-8 text-center text-slate-400 ${className ?? ''}`}>No food chain challenges available.</div>;
  }

  if (isBuild && isComplete) {
    return (
      <div className={`w-full max-w-5xl mx-auto my-8 ${className ?? ''}`}>
        <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score} durationMs={elapsedMs}
          heading="Food Chains Complete" celebrationMessage="You built every food chain!" />
      </div>
    );
  }

  const listed = [...organisms].sort((a, b) => a.name.localeCompare(b.name));
  const chain = chainShape(placed.map(p => p.id), arrows);
  const disruption = disruptionChallenges?.[0];
  const webPassed = !isBuild && challengeDone;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{isBuild ? 'Food Chain Builder' : 'Food Web Builder'}</LuminaCardTitle>
        <LuminaCardDescription>
          {isBuild ? ecosystem : `${ecosystem} - Draw arrows to show who eats whom (energy flows from prey → predator)`}
        </LuminaCardDescription>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-6">
        {isBuild && currentChallenge?.type === 'build_chain' && (
          <div className="space-y-1 text-center">
            {challenges.length > 1 && (
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Chain {currentIndex + 1} / {challenges.length}{practice ? ' · practice' : ''}
              </p>
            )}
            <h4 className="text-lg font-semibold text-emerald-300">{currentChallenge.instruction}</h4>
            <p className="text-xs text-slate-500">
              Tap a living thing in the list to put it in. Tap one in your scene, then another, to draw an arrow. Tap an arrow to take it out.
            </p>
          </div>
        )}

        {!isBuild && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400 font-medium">Trophic Levels:</span>
              {(Object.keys(TROPHIC_LABEL) as Organism['trophicLevel'][]).map(level => (
                <LuminaBadge key={level} accent={TROPHIC_ACCENT[level]}>{TROPHIC_LABEL[level]}</LuminaBadge>
              ))}
            </div>
            <LuminaCard surface="nested" className="p-4">
              <p className="text-slate-300 font-medium">How to build your food web:</p>
              <ol className="text-sm text-slate-400 space-y-1 ml-4 list-decimal">
                <li>Click an organism to start drawing</li>
                <li>Click another organism to create a connection (arrow shows energy flow)</li>
                <li>Remove wrong connections with the trash button</li>
                <li>Build the complete food web showing all feeding relationships</li>
              </ol>
            </LuminaCard>
          </>
        )}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !webLocked && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
          {isBuild ? (
            <>
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Living things">
                {listed.map(o => {
                  const inScene = placed.some(p => p.id === o.id);
                  return (
                    <LuminaButton key={o.id} tone={inScene ? 'primary' : 'ghost'} disabled={!buildOpen}
                      aria-label={`${inScene ? 'Take out' : 'Put in'} ${o.name}`} aria-pressed={inScene} data-pip-object={`list-${o.id}`}
                      onClick={() => toggleListed(o.id)} className="min-h-11 flex-col !h-auto px-3 py-1">
                      <span>{o.name}</span>
                      {leverOn(FOOD_TAGS_LEVER) && <span className="text-xs text-orange-300" data-lever="food-tag">{FOOD_TAG[o.trophicLevel]}</span>}
                    </LuminaButton>
                  );
                })}
              </div>
              <FoodChainScene ref={sceneRef} organisms={organisms} placed={placed} arrows={arrows} selected={selected}
                arrowWords={leverOn(ARROW_WORDS_LEVER)} foodTags={leverOn(FOOD_TAGS_LEVER)} disabled={!buildOpen}
                onTapOrganism={tapOrganism} onTapArrow={removeArrow} />
              <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
                {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
              </div>
              {leverOn(CHAIN_COUNT_LEVER) && (
                <p className="text-center text-sm text-slate-300" data-lever="chain-count">
                  Living things on your longest line of arrows: <span className="text-orange-300 font-bold text-lg">{chain.longest}</span>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="relative w-full h-[500px] bg-gradient-to-b from-slate-900/50 to-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                  <defs>
                    {([['correct', '#10b981'], ['incorrect', '#ef4444'], ['pending', '#94a3b8']] as const).map(([id, fill]) => (
                      <marker key={id} id={`arrowhead-${id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill={fill} />
                      </marker>
                    ))}
                  </defs>
                  {arrows.map(a => {
                    const from = organisms.find(o => o.id === a.fromId), to = organisms.find(o => o.id === a.toId);
                    if (!from || !to) return null;
                    const right = feeds(relations, a.fromId, a.toId);
                    const state = checked ? (right ? 'correct' : 'incorrect') : 'pending';
                    return (
                      <line key={`${a.fromId}>${a.toId}`} x1={from.position.x} y1={from.position.y} x2={to.position.x} y2={to.position.y}
                        stroke={state === 'correct' ? '#10b981' : state === 'incorrect' ? '#ef4444' : '#94a3b8'} strokeWidth="2"
                        markerEnd={`url(#arrowhead-${state})`} />
                    );
                  })}
                </svg>
                {organisms.map(o => {
                  const disrupted = showDisruption && disruption?.removeOrganismId === o.id;
                  return (
                    <button key={o.id} type="button" onClick={() => tapOrganism(o.id)} disabled={!buildOpen || disrupted}
                      aria-label={o.name} aria-pressed={selected === o.id} data-pip-object={`web-${o.id}`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all ${selected === o.id
                        ? 'scale-110 z-20 ring-2 ring-blue-500' : 'hover:scale-105 z-10'} ${disrupted ? 'opacity-30 grayscale' : ''}`}
                      style={{ left: o.position.x, top: o.position.y }}>
                      <div className={`px-4 py-2 rounded-lg border-2 backdrop-blur-sm ${TROPHIC_COLOR[o.trophicLevel]}`}>
                        <div className="text-center">
                          <div className="text-lg font-bold">{o.name}</div>
                          <div className="text-xs opacity-75">{TROPHIC_LABEL[o.trophicLevel]}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {arrows.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-300">Your Connections ({arrows.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {arrows.map(a => (
                      <div key={`${a.fromId}>${a.toId}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2">
                        <span className="text-sm text-slate-300">{organismName(a.fromId)} → {organismName(a.toId)}</span>
                        {buildOpen && (
                          <LuminaButton tone="subtle" aria-label={`Remove ${organismName(a.fromId)} → ${organismName(a.toId)}`}
                            className="h-8 w-8 p-0" onClick={() => removeArrow(a)}>
                            <Trash2 className="w-3 h-3" />
                          </LuminaButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {feedback && (
          <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'} label={feedback.correct ? 'Yes' : 'Not yet'}>
            {feedback.text}
          </LuminaFeedbackCard>
        )}

        {/* Disruption: after a complete web. */}
        {webPassed && disruptionChallenges && disruptionChallenges.length > 0 && disruption && (
          <div className="space-y-4 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-slate-200">Ecosystem Disruption</h4>
              <LuminaButton onClick={() => setShowDisruption(!showDisruption)}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                {showDisruption ? 'Hide Disruption' : 'Test Disruption'}
              </LuminaButton>
            </div>
            {showDisruption && (
              <LuminaCard surface="nested" className="space-y-3 p-4">
                <p className="text-orange-300 font-medium">What if we remove: {organismName(disruption.removeOrganismId)}?</p>
                <p className="text-slate-300 text-sm">{disruption.question}</p>
                <ul className="space-y-1 text-sm text-slate-400 ml-4 list-disc">
                  {disruption.expectedEffects.map((effect, i) => <li key={i}>{effect}</li>)}
                </ul>
                <p className="text-xs text-slate-400 italic">💡 {disruption.explanation}</p>
              </LuminaCard>
            )}
          </div>
        )}

        {/* Actions. The build commits with "I'm done!"; there is no auto-check. */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {isBuild ? (
            !challengeDone ? (
              <>
                <LuminaButton disabled={!buildOpen || !placed.length} onClick={clearScene}>Clear the scene</LuminaButton>
                <LuminaButton tone="primary" disabled={!buildOpen || !arrows.length} onClick={checkChain}>I&apos;m done!</LuminaButton>
              </>
            ) : !tutorOwned && currentIndex + 1 < challenges.length && !practice ? (
              <LuminaActionButton action="next" onClick={handleNext}>Next chain →</LuminaActionButton>
            ) : null
          ) : (
            <>
              <LuminaActionButton action="check" onClick={checkWeb} disabled={!buildOpen || !arrows.length} />
              {webLocked && <LuminaButton onClick={handleWebReset}>Try Again</LuminaButton>}
              <div className="ml-auto text-sm text-slate-400 self-center">{arrows.length} / {relations.length} connections</div>
            </>
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FoodWebBuilder = withWorkspaceController<FoodWebBuilderProps, ProgressOptions<FoodWebChallenge>, Progress>(
  'food-web-builder', FoodWebBuilderSurface, useScriptedProgress, useWorkspaceProgressFor('food-web-builder'));

export default FoodWebBuilder;
