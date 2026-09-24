'use client';

/**
 * SoundSwap — the child sees a starting word and its sounds, may tap any sound to hear
 * it, and SAYS THE NEW WORD ALOUD after one sound is added, taken away or changed. It
 * runs only on the shared tutor/JEV teaching workspace (workspace rollout B2; the
 * scripted speech loop was retired, LA-14, user ruling 09-23: one path). The tutor
 * teaches in its own words, the observer judges the spoken word against `resultWord`,
 * and the runtime owns progression. An unbound mount shows the shared "needs the tutor"
 * card.
 *
 * WHY THE TASK IS ORAL (qa/di/BACKLOG.md item 16). Phoneme manipulation is holding a word
 * in your head, changing one sound and saying what is left. A child who cannot do that can
 * still tap a highlighted tile, so there are no answer buttons.
 *
 * ANSWER-LEAK RULE. The starting word and its sounds are the stimulus and are shown. The
 * result word and its picture description appear only while the credited word is held.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
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
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { swapAssignment, swapScene, swapSoundRequest } from './soundSwapWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { soundSwapPipPose } from '../../../pip/soundSwapPipPose';

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
}

export interface SoundSwapData {
  title: string;
  gradeLevel: string;
  /** Within-mode support tier from the manifest. Threaded to the tutor. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SoundSwapChallenge[];

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

function SoundSwapSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: SoundSwapProps) {
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

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);

  const [activeSoundIdx, setActiveSoundIdx] = useState<number | null>(null);
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

  const runner = useWorkspaceRunner<SoundSwapChallenge>({
    primitiveId: 'sound-swap',
    assignment: swapAssignment,
    items: challenges,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || challenges[0]?.operation || 'mixed',
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setActiveSoundIdx(null),
  });
  const currentChallenge = runner.currentItem;
  const currentIndex = runner.currentIndex;
  // The workspace shows its finish without an evaluation provider (the live host has none).
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // ── Tap-to-hear — never withdrawn by band or tier ────────────────
  // Asks for one SOUND of the starting word. A child who taps every sound has the word in
  // pieces; making the change is still theirs to do. Silent, so it is not a learner turn.
  const handlePlaySound = useCallback((index: number) => {
    const phoneme = currentChallenge?.originalPhonemes[index];
    if (!phoneme) return;
    SoundManager.tap();
    setActiveSoundIdx(index);
    ctx.sendText(swapSoundRequest(phoneme), { silent: true, author: 'host' });
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => setActiveSoundIdx(null), 1200);
  }, [ctx, currentChallenge]);

  const highlightIdx = currentChallenge && currentChallenge.operation === 'substitution'
    && currentChallenge.showTargetHighlight !== false && !runner.revealHeld
    ? findTargetIndex(currentChallenge.originalPhonemes, currentChallenge.oldPhoneme, currentChallenge.substitutePosition)
    : -1;

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentChallenge) return;
    workspace.current = { ...swapScene(currentChallenge, { highlighted: highlightIdx >= 0 }), demonstration: [],
      canDemonstrate: false, canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own sound taps; Pip
  // never answers, judges, or moves to the next item.
  const pip = usePipTargets(currentChallenge?.id ?? null, runner.running);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentChallenge || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id === 'word' ? 'The starting word' : 'A sound'));
    const pose = soundSwapPipPose({
      running: runner.running, preparing: false,
      stage: runner.revealHeld ? 'affirmed' : runner.running ? 'asking' : 'done',
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueOnItem: runner.cuedItemId === currentChallenge.id && !runner.revealHeld,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentChallenge.id, label: 'Sound swap',
      dock: pip.dock.current, targets, pose,
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
      {currentChallenge.originalPhonemes.map((phoneme, i) => (
        <button
          key={`${currentChallenge.id}-${i}`}
          ref={pip.ref(`sound-${i}`)}
          data-pip-object={`sound-${i}`}
          onClick={() => { pip.look(`sound-${i}`); handlePlaySound(i); }}
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

            {/* The stage: the starting word and its sounds, and nothing that
                names the new word. The reward appears only after the tutor has
                credited the child's answer. */}
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
              {showImage && !isPreReader && (
                <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
              )}
              <p ref={pip.ref('word')} data-pip-object="word"
                className="text-4xl font-bold text-slate-100">{currentChallenge.originalWord}</p>
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

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap a sound to hear it, then say the new word.
              </p>
            )}

            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Sound Swap Complete!"
            celebrationMessage={`You made ${runner.practiceSummary?.solvedCount ?? 0} new word${runner.practiceSummary?.solvedCount === 1 ? '' : 's'} by changing sounds!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const SoundSwap = withWorkspaceOnly<SoundSwapProps>('sound-swap', SoundSwapSurface, props => props.data.title);

export default SoundSwap;
