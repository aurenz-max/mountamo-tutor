'use client';

/**
 * PhonicsBlender — the child sees a word's letters, may tap any letter to hear its
 * sound, and SAYS THE WORD ALOUD. It runs only on the shared tutor/JEV teaching
 * workspace (workspace rollout B2; the scripted speech loop was retired, LA-14, user
 * ruling 09-23: one path). The tutor teaches in its own words, the observer judges the
 * spoken word against `targetWord`, and the runtime owns progression. An unbound mount
 * shows the shared "needs the tutor" card.
 *
 * WHY THE TASK IS PURELY VERBAL (2026-08-09). An earlier port kept a tile-arranging
 * step, so a word took two answers; driven live, the child answered "put the sounds in
 * order" by SAYING the word, which is the right response to a blending task. The
 * letters are a stimulus to read, not pieces to assemble.
 *
 * ANSWER-LEAK RULE. The letters are the stimulus and are always shown. What must not
 * appear before the word is credited: the whole word printed as a word, and the
 * picture (🐱 hands a five-year-old "cat" without a sound being blended). The emoji is
 * a reward, shown while the credited word is held on screen.
 *
 * DOCTRINE HELD: tap-to-hear is never withdrawn (contract R2); the K band-gate
 * presentation is kept (R3); nothing on screen commits or advances (R4).
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
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhonicsBlenderMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import type { BlendItem } from './phonicsBlenderScript';
import { blendAssignment, blendItems, blendScene, soundRequest } from './phonicsBlenderWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { phonicsBlenderPipPose } from '../../../pip/phonicsBlenderPipPose';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PhonicsBlenderData {
  title: string;
  gradeLevel: string;
  patternType: 'cvc' | 'cvce' | 'blend' | 'digraph' | 'r-controlled' | 'diphthong';

  words: Array<{
    id: string;
    targetWord: string;
    phonemes: Array<{
      id: string;
      sound: string;                  // The phoneme, e.g. "/k/" — spoken on tap
      letters: string;                // The letters it maps to, e.g. "c" — SHOWN
    }>;
    /** Reward picture only. Never shown before the word is credited. */
    emoji?: string;
    imageDescription?: string;
  }>;

  // ── Within-mode support tier (stamped in code by the generator from
  //    ctx.supportTier). Presentation / instruction ONLY — never the words, the
  //    sounds, or the answer. ALL OPTIONAL: absent ⇒ full help. ──
  supportTier?: 'easy' | 'medium' | 'hard';
  /**
   * How much SEGMENTATION help the letter row gives:
   *   'full'  — separated letter cards with dots between (c · a · t)
   *   'word'  — separated letter cards, no dots
   *   'none'  — the letters joined as one solid word; the child segments it
   * The stimulus itself is never withdrawn, only the help reading it.
   */
  showBlendPreview?: 'full' | 'word' | 'none';
  /** @deprecated The scripted model line read it; the workspace tells the tutor from `showBlendPreview`. */
  nameTargetPhonemes?: boolean;
  /** @deprecated No surface since the verbal port — there are no build slots. */
  showSlotCount?: boolean;
  /** @deprecated No surface since the verbal port — the letters ARE the tile. */
  showTileLetters?: boolean;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhonicsBlenderMetrics>) => void;
}

interface PhonicsBlenderProps {
  data: PhonicsBlenderData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

const PATTERN_LABELS: Record<string, string> = {
  'cvc': 'CVC Words',
  'cvce': 'Silent-E Words',
  'blend': 'Consonant Blends',
  'digraph': 'Digraphs',
  'r-controlled': 'R-Controlled Vowels',
  'diphthong': 'Diphthongs',
};

// ============================================================================
// Component
// ============================================================================

function PhonicsBlenderSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: PhonicsBlenderProps) {
  const {
    title,
    gradeLevel,
    patternType,
    words = [],
    showBlendPreview,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onEvaluationSubmit,
  } = data;

  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const items = useMemo(() => blendItems(words), [words]);

  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  /** Visual only: clears the tapped-letter highlight. Nothing here advances. */
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When each word opened, for the blending-speed metric. */
  const openedAt = useRef(new Map<string, number>());
  const seconds = useRef(new Map<string, number>());

  const stableInstanceIdRef = useRef(instanceId || `phonics-blender-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const isPreReader = isPreReaderGrade(gradeLevel);
  const segmentation: 'full' | 'word' | 'none' =
    showBlendPreview === 'none' ? 'none' : showBlendPreview === 'word' ? 'word' : 'full';

  const evaluation = usePrimitiveEvaluation<PhonicsBlenderMetrics>({
    primitiveType: 'phonics-blender',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    componentIntent,
    objectiveText,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const outcomes = summary.outcomes.map(o => ({ ...o, seconds: seconds.current.get(o.id) ?? null }));
    const timed = outcomes.map(o => o.seconds).filter((s): s is number => s != null);
    const avgSeconds = timed.length ? timed.reduce((s, v) => s + v, 0) / timed.length : 0;
    const metrics: PhonicsBlenderMetrics = {
      type: 'phonics-blender',
      patternType,
      gradeLevel,
      wordsBlended: outcomes.filter(o => o.solved).length,
      wordsTotal: words.length,
      phonemeAccuracy: summary.accuracy,
      averageBlendingSpeed: Math.round(avgSeconds * 10) / 10,
      soundsCorrectOnFirstTry: outcomes.filter(o => o.solved && o.corrections === 0).length,
      soundsTotal: words.reduce((sum, w) => sum + w.phonemes.length, 0),
      attemptsCount: outcomes.reduce((s, o) => s + 1 + o.corrections, 0),
    };
    // The observer's corrected attempts are the misconception evidence; kept only on a diagnosable session.
    const diagnosisEvidence = summary.accuracy < 60 ? summary.diagnosisEvidence : undefined;
    evaluation.submitResult(summary.accuracy >= 60, summary.accuracy, metrics,
      { outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined, diagnosisEvidence);
  };

  const runner = useWorkspaceRunner<BlendItem>({
    primitiveId: 'phonics-blender',
    assignment: blendAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || patternType,
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: (item) => {
      if (!openedAt.current.has(item.id)) openedAt.current.set(item.id, performance.now());
      setActiveSoundId(null);
    },
    // The shared lifecycle plays the success sound; this only times the word.
    onAffirmed: (item) => {
      const start = openedAt.current.get(item.id);
      if (start != null) seconds.current.set(item.id, Math.round(((performance.now() - start) / 1000) * 10) / 10);
    },
  });
  const currentWord = runner.currentItem;
  const currentIndex = runner.currentIndex;
  // The workspace shows its finish without an evaluation provider (the live host has none).
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  // ── Tap-to-hear (R2) — never withdrawn by band or tier ───────────
  // Asks for the SOUND, never the whole word: the word is the answer. Silent, so the
  // request is not a learner turn and never reaches the observer.
  const handlePlaySound = useCallback((phonemeId: string) => {
    const phoneme = currentWord?.phonemes.find(p => p.id === phonemeId);
    if (!phoneme) return;
    SoundManager.tap();
    setActiveSoundId(phonemeId);
    ctx.sendText(soundRequest(phoneme.sound), { silent: true, author: 'host' });
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => setActiveSoundId(null), 1200);
  }, [ctx, currentWord]);

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentWord) return;
    workspace.current = { ...blendScene(currentWord, { segmentation }), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own letter taps; Pip
  // never answers, judges, or moves to the next word.
  const pip = usePipTargets(currentWord?.id ?? null, runner.running);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentWord || showSummary) return null;
    const targets = pip.targets(undefined, (id) => (id === 'letters' ? 'The letters' : 'A letter'));
    const pose = phonicsBlenderPipPose({
      running: runner.running, preparing: false,
      stage: runner.revealHeld ? 'affirmed' : runner.running ? 'reading' : 'done',
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueOnWord: runner.cuedItemId === currentWord.id && !runner.revealHeld,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return {
      instanceId: resolvedInstanceId, scopeId: currentWord.id, label: 'Sound blending',
      dock: pip.dock.current, targets, pose,
    };
  });

  const wordResults = useMemo(() => {
    const summary = runner.practiceSummary;
    if (!summary) return [];
    return phaseResultsFromSummary(words, summary, (word) => ({ label: word.targetWord, icon: word.emoji || '🔤' }));
  }, [runner.practiceSummary, words]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!currentWord) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No words available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const stageWord = runner.revealHeld ? 'yes!' : 'what word?';

  /** The stimulus: the word's letters. Tap any one to hear its sound. At `none` the
   *  letters are joined into a solid word, so the child does the segmenting. */
  const renderLetters = () => (
    <div ref={pip.ref('letters')} data-pip-object="letters"
      className={`flex items-center justify-center ${segmentation === 'none' ? 'gap-0' : 'gap-3'}`}>
      {currentWord.phonemes.map((phoneme, i) => (
        <React.Fragment key={phoneme.id}>
          {segmentation === 'full' && i > 0 && (
            <span className="text-slate-600 text-2xl" aria-hidden="true">·</span>
          )}
          <button
            ref={pip.ref(`letter-${phoneme.id}`)}
            data-pip-object={`letter-${phoneme.id}`}
            onClick={() => { pip.look(`letter-${phoneme.id}`); handlePlaySound(phoneme.id); }}
            aria-label={`sound ${phoneme.sound}`}
            className={`
              rounded-xl border-2 font-bold uppercase transition-all duration-200 cursor-pointer select-none
              ${segmentation === 'none' ? 'px-1 py-3 border-transparent' : 'px-5 py-4'}
              ${activeSoundId === phoneme.id
                ? 'bg-amber-500/30 border-amber-400/60 text-amber-200 scale-110 shadow-lg shadow-amber-500/20'
                : segmentation === 'none'
                  ? 'text-white hover:text-amber-200'
                  : 'bg-slate-700/40 border-slate-500/30 text-white hover:scale-105 hover:bg-slate-600/40'
              }
            `}
          >
            <span className="text-5xl">{phoneme.letters}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade/pattern badges are adult chrome — hidden for pre-readers (R3). */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge className="text-xs">{PATTERN_LABELS[patternType] || patternType}</LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            {!isPreReader && words.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={words.length} variant="dots" />
              </div>
            )}

            {/* The stage: the letters, and nothing that names the word. The reward picture
                appears only while the credited word is held on screen. */}
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
              {renderLetters()}
              {runner.revealHeld && currentWord.emoji && (
                <div className="mt-4 text-5xl leading-none animate-bounce" aria-hidden="true" data-blend-reward="true">
                  {currentWord.emoji}
                </div>
              )}
              <div className="mt-4 text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>
            </div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap a letter to hear its sound, then say the whole word.
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
            phases={wordResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Session Complete!"
            celebrationMessage={`You blended ${runner.practiceSummary?.solvedCount ?? 0} out of ${words.length} words!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const PhonicsBlender = withWorkspaceOnly<PhonicsBlenderProps>('phonics-blender', PhonicsBlenderSurface,
  props => props.data.title);

export default PhonicsBlender;
