'use client';

/**
 * SoundSwap, taught on the shared teaching workspace only (the boss: `soundSwap.card.ts` + `soundSwap.boss.ts`). A
 * mount with no tutor shows the shared "needs the tutor" card (`withWorkspaceOnly`).
 *
 * WHAT THE CHILD DOES. The child sees a starting word and its sounds, may tap any sound to hear it, and SAYS THE NEW
 * WORD ALOUD after one named sound is added, taken away or changed; the tutor judges it against the key. swap_build is
 * the shared letter build (`LetterBuildSurface.tsx`): the child changes one letter of the word in the boxes to make a
 * new real word, and the build checks it.
 *
 * WHY THE TASK IS ORAL (qa/di/BACKLOG.md item 16). Phoneme manipulation is holding a word in your head, changing one
 * sound and saying what is left. A child who cannot do that can still tap a highlighted tile, so there are no answer
 * buttons.
 *
 * ANSWER-LEAK RULE. The starting word and its sounds are the stimulus and are shown. The result word and its picture
 * description appear only while the credited word is held. The domain is `soundSwapDomain.ts`, the levers
 * `soundSwapLevers.ts`; nothing in this file writes a spoken line.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SoundSwapMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary, practiceScore } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import LetterBuildSurface, { type LetterBuildSummary } from './LetterBuildSurface';
import type { LetterBuildItem } from './letterBuild';
import { speakablePhoneme } from './phonemeVoice';
import { swapScene, swapSoundRequest, swapWords, type SwapWord } from './soundSwapDomain';
import { MARK_LEVER, MODEL_LEVER, SWAP_LEVERS, swapBuildLevers, swapModelFor, targetTile } from './soundSwapLevers';
import { soundSwapBoss } from './soundSwap.boss';
import type { WordSpaceStamp } from '../../../service/wordSpace/pick';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface SoundSwapChallenge {
  id: string;
  operation: 'addition' | 'deletion' | 'substitution';
  originalWord: string;
  originalPhonemes: string[];
  originalImage: string;
  addPhoneme?: string;
  addPosition?: 'beginning' | 'end';
  deletePhoneme?: string;
  deletePosition?: 'beginning' | 'middle' | 'end';
  oldPhoneme?: string;
  newPhoneme?: string;
  substitutePosition?: 'beginning' | 'middle' | 'end';
  resultWord: string;
  resultPhonemes: string[];
  /** POST-affirmation reward text only. Never shown before the child answers. */
  resultImage: string;

  // ── Within-mode support tier scaffolds (set by the generator from
  //    config.difficulty). Display/instruction only — NEVER change the words,
  //    the phonemes, or the answer. All optional; absent ⇒ full help. ──
  /** #1 perception — show the starting word's picture cue. Default: shown. */
  showWordImage?: boolean;
  /** #1 perception (substitution) — highlight the sound to change. Default: shown. */
  showTargetHighlight?: boolean;
  /**
   * @deprecated DEAD since the walk was deleted (user ruling, first live run).
   * It first meant "the instruction does not name the sound to change" — which
   * only worked because answer buttons made the answer determinate — and was
   * then re-based onto the tutor's sound-by-sound walk, which no longer exists.
   * The tutor names the change at every tier and says nothing else.
   */
  nameTargetSound?: boolean;
  /** @deprecated No surface since the verbal port — there are no answer buttons. */
  optionCount?: number;
  remediationMove?: 'isolate_added_sound' | 'isolate_deleted_sound' | 'contrast_replacement';
  /** Word-space calibration stamp (service/wordSpace); never rendered, never sent to the tutor. */
  wordSpace?: WordSpaceStamp;
}

export interface SoundSwapData {
  title: string;
  gradeLevel: string;
  /** Within-mode support tier from the manifest: presentation, and when the model lever comes (the lever set's
   *  `support` fact). Absent ⇒ medium for the model. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SoundSwapChallenge[];
  /** `swap_build` (open build): the shared letter build surface runs the session from `buildItems`; `challenges` is empty. */
  task?: 'letter_build';
  buildItems?: LetterBuildItem[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SoundSwapMetrics>) => void;
}

interface SoundSwapProps {
  data: SoundSwapData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const OPERATION_LABELS: Record<string, string> = {
  addition: 'Addition',
  deletion: 'Deletion',
  substitution: 'Substitution',
};

const OPERATION_ICONS: Record<string, string> = {
  addition: '➕',
  deletion: '➖',
  substitution: '🔄',
};

const OPERATION_ACCENTS: Record<string, LuminaAccent> = {
  addition: 'blue',
  deletion: 'purple',
  substitution: 'emerald',
};

/** Find the index of the target phoneme based on position. Used only for the
 *  perception highlight — the answer never depends on it. */
function findTargetIndex(
  phonemes: string[],
  targetPhoneme: string | undefined,
  position: 'beginning' | 'middle' | 'end' | undefined,
): number {
  if (!targetPhoneme || !position) return -1;
  const normalized = targetPhoneme.toLowerCase();
  if (position === 'beginning') {
    return phonemes[0]?.toLowerCase() === normalized ? 0 : -1;
  }
  if (position === 'end') {
    const last = phonemes.length - 1;
    return phonemes[last]?.toLowerCase() === normalized ? last : -1;
  }
  for (let i = 1; i < phonemes.length - 1; i++) {
    if (phonemes[i]?.toLowerCase() === normalized) return i;
  }
  return -1;
}

// ============================================================================
// Component
// ============================================================================

function SoundSwapSurface({ data, className, runtimePlanItemId }: SoundSwapProps) {
  const {
    title,
    gradeLevel,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const workspace = useRef<TeachingWorkspace | null>(null);
  const items = useMemo(() => swapWords({ challenges, supportTier: data.supportTier }), [challenges, data.supportTier]);
  const leverCtx = useMemo(() => ({ challenges }), [challenges]);

  const [activeSoundIdx, setActiveSoundIdx] = useState<number | null>(null);
  // In-item levers, keyed by the session item they were pulled on, and the easier practice item a simplify lever put
  // on screen in its place (ungraded; the full item comes back after it).
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SwapWord | null>(null);
  /** Visual only: clears the tapped-sound highlight. Nothing here advances. */
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `sound-swap-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const isPreReader = isPreReaderGrade(gradeLevel);

  const evaluation = usePrimitiveEvaluation<SoundSwapMetrics>({
    primitiveType: 'sound-swap',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const outcomes = summary.outcomes.map(o => ({ ...o,
      operation: challenges.find(c => c.id === o.id)?.operation ?? 'substitution' }));
    const accuracyFor = (operation: SoundSwapChallenge['operation']) => {
      const forOp = outcomes.filter(o => o.operation === operation);
      return forOp.length ? Math.round((forOp.filter(o => o.solved).length / forOp.length) * 100) : 0;
    };
    const metrics: SoundSwapMetrics = {
      type: 'sound-swap',
      operation: challenges[challenges.length - 1]?.operation ?? 'substitution',
      challengesCorrect: outcomes.filter(o => o.solved).length,
      challengesTotal: challenges.length,
      additionAccuracy: accuracyFor('addition'),
      deletionAccuracy: accuracyFor('deletion'),
      substitutionAccuracy: accuracyFor('substitution'),
      attemptsCount: outcomes.reduce((s, o) => s + 1 + o.corrections, 0),
    };
    const diagnosisEvidence = summary.accuracy < 60 ? summary.diagnosisEvidence : undefined;
    evaluation.submitResult(summary.accuracy >= 60, summary.accuracy, metrics,
      { outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<SwapWord>({
    primitiveId: 'sound-swap',
    assignment: soundSwapBoss.assignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setActiveSoundIdx(null),
  });
  const sessionItem = runner.currentItem;
  /** What is on screen: the practice item while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionItem;
  const currentIndex = runner.currentIndex;
  const pulledLevers = practice || leverState.item !== sessionItem?.id ? [] : leverState.pulled;
  const swapModel = pulledLevers.includes(MODEL_LEVER) && sessionItem ? swapModelFor(sessionItem, challenges) : null;
  // The workspace shows its finish without an evaluation provider (the live host has none).
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // ── Tap-to-hear — never withdrawn by band or tier ────────────────
  // Asks for one SOUND of the starting word. A child who taps every sound has the word in pieces; making the change
  // is still theirs to do. Silent and host-authored, so the request is not a learner turn.
  const handlePlaySound = (index: number) => {
    const phoneme = currentChallenge?.originalPhonemes[index];
    if (!phoneme) return;
    SoundManager.tap();
    setActiveSoundIdx(index);
    runner.requestHear(swapSoundRequest(phoneme));
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => setActiveSoundIdx(null), 1200);
  };

  const highlightIdx = !currentChallenge || runner.revealHeld ? -1
    : pulledLevers.includes(MARK_LEVER) ? targetTile(currentChallenge)
      : currentChallenge.operation === 'substitution' && currentChallenge.showTargetHighlight !== false
        ? findTargetIndex(currentChallenge.originalPhonemes, currentChallenge.oldPhoneme, currentChallenge.substitutePosition)
        : -1;
  /** An addition's empty tile, where the new sound goes: never its letter. */
  const blankAt = currentChallenge?.operation === 'addition' && pulledLevers.includes(MARK_LEVER) && !runner.revealHeld
    ? (currentChallenge.addPosition ?? 'beginning') : null;

  // What the tutor and the observer are shown, republished every render. The lever set writes the support and
  // on-screen facts; a practice item carries no levers.
  useLayoutEffect(() => {
    if (!currentChallenge || !sessionItem) return;
    const levers = practice ? [] : SWAP_LEVERS.declare(sessionItem, leverCtx, pulledLevers);
    const scene: WorkspaceScene = swapScene(currentChallenge, { highlighted: highlightIdx >= 0 });
    workspace.current = {
      ...leverScene(practice
        ? { ...scene, facts: { ...scene.facts, practice: 'An easier practice item on other words, ungraded. The full item comes back after it.' } }
        : scene, {
        support: practice ? '' : SWAP_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice ? '' : SWAP_LEVERS.onScreen(sessionItem, leverCtx, pulledLevers) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = SWAP_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!simpler || simpler.mode === 'swap_build') return 'There is no easier item here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          setActiveSoundIdx(null);
          return { practice: soundSwapBoss.assignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setActiveSoundIdx(null); },
    };
  });

  const phaseResults = useMemo(() => phaseResultsFromSummary(challenges, runner.practiceSummary, (challenge) => ({
    label: `${challenge.originalWord} → ${challenge.resultWord}`,
    icon: OPERATION_ICONS[challenge.operation] || '🔤',
  })), [runner.practiceSummary, challenges]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const stageWord = runner.revealHeld ? 'yes!' : 'what word?';
  const showImage = currentChallenge.showWordImage !== false;

  /** The stimulus: the STARTING word and its sounds. Tap any sound to hear it.
   *  Nothing here names the new word — that is the answer. */
  const renderSounds = () => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {blankAt === 'beginning' && <span data-lever="blank-tile" aria-label="empty tile"
        className="h-14 w-12 animate-pulse rounded-xl border-2 border-dashed border-amber-300/70" />}
      {currentChallenge.originalPhonemes.map((phoneme, i) => (
        <button
          key={`${currentChallenge.id}-${i}`}
          type="button"
          onClick={() => handlePlaySound(i)}
          aria-label={`sound ${phoneme}`}
          // Perception scaffold, withdrawn at the hard tier. Exposed as an
          // attribute because it is styling otherwise, and a scaffold nobody
          // can assert on is a scaffold that silently stops working.
          data-target={highlightIdx === i ? 'true' : undefined}
          className={`
            rounded-xl border-2 px-4 py-3 text-center font-bold transition-all duration-200 cursor-pointer select-none
            ${activeSoundIdx === i
              ? 'bg-amber-500/30 border-amber-400/60 text-amber-200 scale-110 shadow-lg shadow-amber-500/20'
              : highlightIdx === i
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 animate-pulse'
                : 'bg-slate-700/40 border-slate-500/30 text-white hover:scale-105 hover:bg-slate-600/40'
            }
          `}
        >
          <span className="text-2xl">{phoneme}</span>
        </button>
      ))}
      {blankAt === 'end' && <span data-lever="blank-tile" aria-label="empty tile"
        className="h-14 w-12 animate-pulse rounded-xl border-2 border-dashed border-amber-300/70" />}
    </div>
  );

  /** Help: the same change on model words the session never uses, start to finish. */
  const renderSwapModel = (model: NonNullable<typeof swapModel>) => (
    <div data-lever="swap-model" aria-label="Sound change model"
      className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-950/10 p-3 text-lg">
      <span className="font-bold text-slate-100">{model.from}</span>
      <span className="text-cyan-300">
        {model.op === 'addition' ? '+' : model.op === 'deletion' ? '−' : `${speakablePhoneme(model.oldSound ?? '')} →`} {speakablePhoneme(model.sound)}
      </span>
      <span aria-hidden className="text-slate-400">=</span>
      <span className="text-3xl" role="img" aria-label={model.to}>{model.emoji}</span>
      {!isPreReader && <span className="font-bold text-emerald-200">{model.to}</span>}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade/operation badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge accent={OPERATION_ACCENTS[currentChallenge.operation]} className="text-xs">
                  {OPERATION_ICONS[currentChallenge.operation]} {OPERATION_LABELS[currentChallenge.operation]}
                </LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            <PipDock />

            {/* The stage: the starting word and its sounds, and nothing that
                names the new word. The reward appears only after the tutor has
                credited the child's answer. */}
            <PipWorkspace className="space-y-4">
              <div data-swap-stage={currentChallenge.operation}
                className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
                {showImage && !isPreReader && (
                  <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
                )}
                <p className="text-4xl font-bold text-slate-100">{currentChallenge.originalWord}</p>
                {renderSounds()}
                {runner.revealHeld && (
                  <div className="mt-2 space-y-1" data-swap-reward="true">
                    <p className="text-sm text-slate-500">→</p>
                    <p className="text-3xl font-bold text-emerald-300 animate-bounce">{currentChallenge.resultWord}</p>
                    {currentChallenge.resultImage && !isPreReader && (
                      <p className="text-sm text-slate-500 italic">{currentChallenge.resultImage}</p>
                    )}
                  </div>
                )}
                <div className="mt-2 text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>
              </div>

              {swapModel && renderSwapModel(swapModel)}
            </PipWorkspace>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap a sound to hear it, then say the new word.
              </p>
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={practiceScore(runner.practiceSummary) ?? (evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy)}
            durationMs={evaluation.elapsedMs}
            heading="Sound Swap Complete!"
            celebrationMessage={`You made ${runner.practiceSummary?.solvedCount ?? 0} new word${runner.practiceSummary?.solvedCount === 1 ? '' : 's'} by changing sounds!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** swap_build's metrics in this primitive's shape. */
const swapBuildMetrics = (s: LetterBuildSummary): SoundSwapMetrics => ({ type: 'sound-swap', operation: 'swap_build',
  challengesCorrect: s.solved, challengesTotal: s.total, additionAccuracy: 0, deletionAccuracy: 0, substitutionAccuracy: s.accuracy,
  attemptsCount: s.attemptsCount });

/** The open build (`swap_build`) on the shared letter build surface, wired from this boss. */
function SwapBuildSurface({ data, className, runtimePlanItemId }: SoundSwapProps) {
  const boss = useMemo(() => {
    const tier = data.supportTier ?? 'medium';
    const levers = swapBuildLevers({ challenges: [] }, tier);
    return { assignment: (item: LetterBuildItem) => soundSwapBoss.assignment({ ...item, mode: 'swap_build', supportTier: tier }), levers };
  }, [data.supportTier]);
  return <LetterBuildSurface primitiveId="sound-swap" className={className} runtimePlanItemId={runtimePlanItemId}
    data={{ ...data, task: 'letter_build', buildItems: data.buildItems ?? [] } as never} metrics={swapBuildMetrics} boss={boss} />;
}

/** One mount, one shape: the open build (`swap_build`) runs on the shared letter build surface. */
function SoundSwapHost(props: SoundSwapProps) {
  return props.data.task === 'letter_build' ? <SwapBuildSurface {...props} /> : <SoundSwapSurface {...props} />;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SoundSwap = withWorkspaceOnly<SoundSwapProps>('sound-swap', SoundSwapHost, props => props.data.title);

export default SoundSwap;
