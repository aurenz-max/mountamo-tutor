'use client';

/**
 * WordWorkout — the child reads printed words aloud and answers about them. It
 * runs only on the shared tutor/JEV teaching workspace (workspace rollout C1; the
 * scripted runner was retired, LA-14, user ruling 09-23: one path). The tutor
 * teaches in its own words, the observer judges each spoken answer, the activity
 * checks each picture tap, and the runtime owns progression. An unbound mount shows
 * the shared "needs the tutor" card. There is no advance timer, no Next button, and
 * nothing on screen tells the child which answer is right before it is credited.
 *
 * WHAT WENT, AND WHY:
 *  - **The whole tap surface on three of four modes.** Real-vs-nonsense was a
 *    1-of-2 tap with a 50% guess floor; the child now READS both printed words
 *    and SAYS the real one. Word chains advanced on a "Next Word" button and
 *    recorded `correct: true, score: 100` for every chain no matter what came
 *    out of the child's mouth — every word is now a judged read. The sentence
 *    was "read" by pressing a button called "I Read It!", which is the costume
 *    test's own example; it is now read aloud and judged word by word, and its
 *    comprehension answer is SAID instead of picked from a 2-4 word menu.
 *  - **Three audio channels that handed over the print** (the per-card speaker
 *    buttons, the whole-sentence model read, the per-word tap-to-hear inside
 *    the sentence). Hearing "cat" beside "zat" decides that item with zero
 *    decoding. Tap-to-hear survives as the QUESTION side only.
 *  - **The interim voice-answer rung** on word chains — the last live consumer
 *    of that generation of hooks in the repo. A separate Azure capture judged
 *    the child while the tutor talked past it; the judge is the tutor now.
 *  - **Eight improvised tutor sends** (activity start, pronounce-this-word,
 *    speak-the-chain-word, read-the-sentence, the two answer verdicts, next
 *    challenge, session complete) and the tier reveal-policy block that steered
 *    them. The cues carry the entire spoken surface.
 *
 * WHAT STAYED: the print. The two words, the chain with its changed-letter
 * highlight, the sentence with its phonics tint — all of it is the stimulus AND
 * the target, which is why the leak rule here bites on the tutor's mouth rather
 * than on the screen (`coldReadGuard`, per item). The one printed thing that is
 * not the task is the comprehension answer, and it stays unmarked until the
 * affirm.
 *
 * PICTURE-MATCH IS THE ONE HANDS MODE and it is honest page-work: the word is
 * printed, so naming its picture aloud would just echo the print (decoding
 * evidence, not meaning evidence). Pointing at the referent is the meaning
 * evidence — picture-vocabulary's `receptive_match` precedent.
 *
 * Build gates and the asks live in `wordWorkoutScript.ts`; the workspace assignment
 * and scene in `wordWorkoutWorkspace.ts`. Nothing in this file writes a spoken line.
 *
 * EXTENDED DECODING (2026-09-09): inflected and compound modes keep one word
 * visible for a cold spoken read, reveal/model its chunks only after the
 * attempt, and defer optional meaning questions until the new-word transfer
 * reads are complete. Context discrimination similarly judges both near words
 * before revealing the sentence that selects between them. Those read and
 * meaning outcomes are retained in separate metrics.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordWorkoutMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { judgedAnswerMix } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  itemsFromChallenges,
  type ChainCueLevel,
  type WordWorkoutItem,
  type WordWorkoutItemKind,
  type WordWorkoutMode,
  type WordWorkoutPictureOption,
} from './wordWorkoutScript';
import { describePictureTap, hearQuestionRequest, wordWorkoutAssignment, wordWorkoutScene } from './wordWorkoutWorkspace';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { wordWorkoutPipPose } from '../../../pip/wordWorkoutPipPose';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type { WordWorkoutMode };

export interface WordWorkoutChallenge {
  id: string;
  /** Per-challenge mode (for multi-mode sessions). Falls back to top-level mode. */
  mode?: WordWorkoutMode;
  // Real vs. Nonsense — the child SAYS the real one.
  realWord?: string;
  nonsenseWord?: string;
  // Picture Match — the child reads the word and TAPS its picture.
  targetWord?: string;
  targetImage?: string;
  distractorImages?: Array<{ word: string; image: string }>;
  // Word Chains — one judged read per word.
  chain?: string[];
  changedPositions?: number[];
  // Sentence Reading — one judged read, then one spoken comprehension answer.
  sentence?: string;
  cvcWords?: string[];
  sightWords?: string[];
  comprehensionQuestion?: string;
  comprehensionAnswer?: string;
  // Inflected / compound reading. targetWord is a key into the code-owned
  // early-decoding pool; includeMeaning adds a separately scored question.
  includeMeaning?: boolean;
  // Context discrimination. The trial id hydrates a bounded CVC pair + frame.
  contextTrialId?: string;

  /**
   * The surviving support-tier lever (stamped by the generator from
   * `ctx.supportTier`): how much of the letter change is drawn — 'full' = amber
   * highlight + the "b → c" delta chip, 'highlight-only' = amber only, 'none' =
   * neither, because finding what changed IS the task at that tier. It also
   * governs the SPOKEN channel: at 'none' the chain correction re-models the
   * word without naming what changed, so the tutor cannot hand back the
   * scaffold the tier removed. Default 'full'.
   *
   * The other three click-era tier fields (`showInstruction`, `allowPronounce`,
   * `allowSentenceModelRead`, `comprehensionChoiceCount`) died with the
   * affordances they withdrew — see the file docblock.
   */
  chainCueLevel?: ChainCueLevel;
}

export interface WordWorkoutData {
  title: string;
  /** Default/primary mode. Per-challenge mode overrides this. */
  mode: WordWorkoutMode;
  masteredVowels: string[];
  /** Canonical grade key from the generator ('K' | '1' | '2'…), threaded to the
   *  tutor session. The DI stage carries no band-gated chrome: the tutor voices
   *  every instruction at every grade, so there is no reader-only text to hide. */
  gradeLevel?: string;
  /** Within-mode support tier from the manifest. Data only now — the render
   *  lever it drives is stamped per challenge as `chainCueLevel`. */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: WordWorkoutChallenge[];

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (
    result: PrimitiveEvaluationResult<WordWorkoutMetrics>
  ) => void;
}

interface WordWorkoutProps {
  data: WordWorkoutData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type WordWorkoutAccent = NonNullable<PhaseResult['accentColor']>;

const KIND_META: Record<
  WordWorkoutItemKind,
  { label: string; icon: string; accent: WordWorkoutAccent }
> = {
  real_word: { label: 'Real or Silly?', icon: '🔤', accent: 'blue' },
  picture_tap: { label: 'Picture Match', icon: '🖼️', accent: 'purple' },
  chain_word: { label: 'Word Chain', icon: '🔗', accent: 'emerald' },
  read_sentence: { label: 'Read It', icon: '📖', accent: 'amber' },
  answer_question: { label: 'What Happened?', icon: '💭', accent: 'pink' },
  read_extended_word: { label: 'Read the Whole Word', icon: '🔤', accent: 'blue' },
  answer_word_meaning: { label: 'What Does It Mean?', icon: '💭', accent: 'pink' },
  read_context_word: { label: 'Read the Near Word', icon: '🔎', accent: 'blue' },
  choose_context_word: { label: 'Which Word Fits?', icon: '🧩', accent: 'purple' },
};

// ============================================================================
// Component
// ============================================================================

function WordWorkoutSurface({ data, className, runtimePlanItemId, runtimeEvalMode }: WordWorkoutProps) {
  const {
    title,
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

  const stableInstanceIdRef = useRef(instanceId || `word-workout-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  /** Build gates drop what cannot be asked, and one challenge can become
   *  several items — a chain is one judged read per word, a sentence is a read
   *  plus a question. */
  const items = useMemo<WordWorkoutItem[]>(
    () => itemsFromChallenges(challenges),
    [challenges],
  );

  const [tapped, setTapped] = useState<string | null>(null);
  /** When each item opened and how long its credited read took, for the silent chain-fluency metric. */
  const openedAt = useRef(new Map<string, number>());
  const seconds = useRef(new Map<string, number>());

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<WordWorkoutMetrics>({
    primitiveType: 'word-workout',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const outcomeOf = (item: WordWorkoutItem) =>
      summary.outcomes.find((o) => o.id === item.id);
    const kindItems = (kind: WordWorkoutItemKind) => items.filter((i) => i.kind === kind);
    const accuracyOf = (kind: WordWorkoutItemKind) => {
      const group = kindItems(kind);
      if (group.length === 0) return 0;
      return Math.round(
        (group.filter((i) => outcomeOf(i)?.solved).length / group.length) * 100,
      );
    };

    // Oral-reading fluency, measured SILENTLY from each item's open-to-credit
    // seconds — there is no visible timer anywhere (standing doctrine).
    const chainItems = kindItems('chain_word');
    const chainSeconds = chainItems.reduce((sum, i) => sum + (seconds.current.get(i.id) ?? 0), 0);
    const wordChainFluency = chainSeconds > 0
      ? Math.round((chainItems.length / chainSeconds) * 60)
      : 0;

    // Every word here is read INDEPENDENTLY — the click era's "tap any word to
    // hear it" channel is gone, so there is no assisted read to subtract.
    const readItems = [
      ...chainItems,
      ...kindItems('read_sentence'),
      ...kindItems('read_extended_word'),
      ...kindItems('read_context_word'),
    ];
    const wordsTotal = readItems.reduce(
      (sum, i) => sum + (i.kind === 'read_sentence'
        ? (i.sentence ?? '').split(/\s+/).length
        : 1),
      0,
    );
    const wordsReadIndependently = readItems
      .filter((i) => outcomeOf(i)?.solved && (outcomeOf(i)?.corrections ?? 0) === 0)
      .reduce(
        (sum, i) => sum + (i.kind === 'read_sentence'
          ? (i.sentence ?? '').split(/\s+/).length
          : 1),
        0,
      );

    const comprehension = kindItems('answer_question');
    const decodingKinds: WordWorkoutItemKind[] = [
      'real_word', 'chain_word', 'read_sentence', 'read_extended_word', 'read_context_word',
    ];
    const meaningKinds: WordWorkoutItemKind[] = [
      'picture_tap', 'answer_question', 'answer_word_meaning', 'choose_context_word',
    ];
    const accuracyAcross = (kinds: WordWorkoutItemKind[]) => {
      const group = items.filter((item) => kinds.includes(item.kind));
      if (group.length === 0) return 0;
      return Math.round((group.filter((item) => outcomeOf(item)?.solved).length / group.length) * 100);
    };
    const compoundReads = kindItems('read_extended_word')
      .filter((item) => item.wordMode === 'compound-word');
    const inflectedReads = kindItems('read_extended_word')
      .filter((item) => item.wordMode === 'inflected-word');
    const accuracyForItems = (group: WordWorkoutItem[]) => group.length > 0
      ? Math.round((group.filter((item) => outcomeOf(item)?.solved).length / group.length) * 100)
      : 0;

    const metrics: WordWorkoutMetrics = {
      type: 'word-workout',
      mode: data.mode,
      challengesCorrect: summary.solvedCount,
      challengesTotal: items.length,
      realVsNonsenseAccuracy: accuracyOf('real_word'),
      pictureMatchAccuracy: accuracyOf('picture_tap'),
      wordChainFluency,
      sentenceComprehensionCorrect:
        comprehension.length > 0 && comprehension.every((i) => outcomeOf(i)?.solved),
      decodingAccuracy: accuracyAcross(decodingKinds),
      wordMeaningAccuracy: accuracyAcross(meaningKinds),
      inflectedWordAccuracy: accuracyForItems(inflectedReads),
      compoundWordAccuracy: accuracyForItems(compoundReads),
      contextDiscriminationAccuracy: accuracyOf('choose_context_word'),
      wordsReadIndependently,
      wordsTotal,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        ...(summary.teachingAttempts ? { teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance } : {}) },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<WordWorkoutItem>({
    primitiveId: 'word-workout',
    assignment: wordWorkoutAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || data.mode,
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: (item) => {
      if (!openedAt.current.has(item.id)) openedAt.current.set(item.id, performance.now());
      setTapped(null);
    },
    onCorrectionRetry: () => {
      // Try again frees the pictures.
      setTapped(null);
      pip.clear();
    },
    onAffirmed: (item) => {
      const start = openedAt.current.get(item.id);
      if (start != null) seconds.current.set(item.id, (performance.now() - start) / 1000);
    },
  });

  const currentItem = runner.currentItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  /** Credited: the first moment an answer may be marked on screen. */
  const revealed = runner.currentSolved;
  const meta = KIND_META[currentItem?.kind ?? 'real_word'];

  // ── Pip shared surface ────────────────────────────────────────────────────
  // A projection of the workspace's committed state and the child's own picture tap; Pip
  // never answers, taps, or advances.
  const pip = usePipTargets(currentItem?.id ?? null, runner.canAttempt);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || !currentItem || showSummary) return null;
    const targets = pip.targets();
    const pose = wordWorkoutPipPose({
      kind: currentItem.kind,
      running: runner.running, preparing: false,
      currentSolved: runner.currentSolved, revealHeld: runner.revealHeld,
      judging: runner.isAwaitingGesture(),
      // Audio belongs to this block only while the lesson is pointed at it.
      tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
      cueMatchesItem: runner.cuedItemId === currentItem.id,
      visibleIds: targets.map((target) => target.id),
      lastTouchedId: pip.lastTouchedId,
    });
    return { instanceId: resolvedInstanceId, scopeId: currentItem.id, label: 'Word workout', dock: pip.dock.current, targets, pose };
  });

  // What the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!currentItem) return;
    workspace.current = { ...wordWorkoutScene(currentItem), demonstration: [], canDemonstrate: false,
      canPresent: false, readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── The tap — picture-match only; the tap IS the commit, checked by the activity ──
  const handlePictureTap = useCallback((option: WordWorkoutPictureOption) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || showSummary) return;
    if (!item || item.answerKind !== 'gesture') return;
    // `canAttempt` closes through batched state; this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    pip.look(`picture-${option.word}`);
    setTapped(option.word);
    commitGesture(runner, { response: describePictureTap(option.word), correct: option.word === item.targetWord,
      cue: () => describePictureTap(option.word) });
  }, [runner, showSummary, pip]);

  /** Hear-again asks the tutor for the instruction or question only: a silent host request, never the print. */
  const hearQuestion = useCallback(() => {
    if (!currentItem) return;
    SoundManager.tap();
    ctx.sendText(hearQuestionRequest(currentItem), { silent: true, author: 'host' });
  }, [ctx, currentItem]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const celebrationMessage = useMemo(() => {
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return 'You read every word and found every picture!';
      case 'mixed':
        return 'You read out loud and found the pictures too!';
      default:
        return 'You read every word out loud, all by yourself!';
    }
  }, [items]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => ({
      label: KIND_META[item.kind].label,
      icon: KIND_META[item.kind].icon,
      accentColor: KIND_META[item.kind].accent,
    }));
  }, [runner.practiceSummary, items]);

  // ============================================================================
  // Stage
  // ============================================================================

  /** Two printed words. NOT buttons — the answer is spoken, and a tappable card
   *  is the costume this port deleted. The real one is marked only on the
   *  affirm. */
  const renderRealWord = (item: WordWorkoutItem) => (
    <div ref={pip.ref('pair')} data-pip-object="pair" className="grid grid-cols-2 gap-4">
      {(item.pair ?? []).map((word) => {
        const isReal = word === item.realWord;
        const state = revealed ? (isReal ? 'correct' : 'dimmed') : 'idle';
        return (
          <div
            key={word}
            className={`
              px-6 py-8 rounded-2xl border-2 text-center select-none transition-all duration-200
              ${answerStateClass(state)}
              ${revealed && isReal ? 'scale-105' : ''}
            `}
          >
            <span className="text-3xl font-bold text-slate-100 tracking-wide">{word}</span>
          </div>
        );
      })}
    </div>
  );

  const renderPictureTap = (item: WordWorkoutItem) => (
    <div className="space-y-4">
      <div className="text-center">
        <div ref={pip.ref('word')} data-pip-object="word"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/20">
          <span className="text-3xl font-bold text-slate-100">{item.targetWord}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(item.options ?? []).map((option) => {
          const isTarget = option.word === item.targetWord;
          const state = revealed && isTarget
            ? 'correct'
            : tapped === option.word && !isTarget
              ? 'incorrect'
              : 'idle';
          return (
            <button
              key={`${item.id}-${option.word}`}
              ref={pip.ref(`picture-${option.word}`)}
              data-pip-object={`picture-${option.word}`}
              onClick={() => handlePictureTap(option)}
              disabled={!runner.canAttempt}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-2xl border-2
                transition-all duration-200 select-none cursor-pointer
                ${answerStateClass(state)}
                ${revealed && isTarget ? 'ring-2 ring-emerald-400/40 scale-105' : ''}
              `}
            >
              <span className="text-4xl">{option.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderChain = (item: WordWorkoutItem) => {
    const chain = item.chain ?? [];
    const position = item.chainIndex ?? 0;
    const showChangedLetter = item.chainCueLevel !== 'none';
    const showChangeDelta = item.chainCueLevel === 'full';

    return (
      <div className="space-y-2">
        {chain.map((word, idx) => {
          const isActive = idx === position;
          const isRead = idx < position || (isActive && revealed);
          const changedIdx = idx > 0 ? findChangedIndex(chain[idx - 1], word) : undefined;
          const previousWord = idx > 0 ? chain[idx - 1] : null;
          return (
            <div
              key={`${word}-${idx}`}
              ref={isActive ? pip.ref('chain-row') : undefined}
              data-pip-object={isActive ? 'chain-row' : undefined}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300
                ${isActive && !isRead
                  ? 'bg-blue-500/20 border-blue-400/50 scale-[1.02]'
                  : isRead
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-white/5 border-white/10 opacity-50'}
              `}
            >
              <span className={`text-xs font-mono w-6 ${idx <= position ? 'text-slate-300' : 'text-slate-600'}`}>
                {idx + 1}.
              </span>
              <span className="text-2xl font-bold tracking-wider">
                {word.split('').map((letter, li) => (
                  <span
                    key={li}
                    className={
                      showChangedLetter && changedIdx !== undefined && li === changedIdx && idx <= position
                        ? 'text-amber-300'
                        : isRead
                          ? 'text-emerald-300'
                          : isActive
                            ? 'text-blue-200'
                            : 'text-slate-600'
                    }
                  >
                    {letter}
                  </span>
                ))}
              </span>
              {showChangeDelta && previousWord && changedIdx !== undefined && idx <= position && (
                <span className="text-xs text-slate-500 ml-auto">
                  {previousWord[changedIdx]} {'→'} {word[changedIdx]}
                </span>
              )}
              {isActive && !isRead && (
                <span className="ml-auto text-blue-400 animate-pulse">{'◀'}</span>
              )}
              {isRead && <span className="ml-auto text-emerald-400">{'✓'}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /** The sentence stays printed for BOTH of its items: reading it is the first
   *  task, and looking back at it is how the comprehension answer is found. The
   *  phonics tint rides the READ only — on the question item it would point at
   *  the answer whenever few decodable words survive. */
  const renderSentence = (item: WordWorkoutItem) => {
    const words = (item.sentence ?? '').split(/\s+/);
    const isRead = item.kind === 'read_sentence';
    return (
      <div className="space-y-4">
        <div ref={pip.ref('sentence')} data-pip-object="sentence" className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {words.map((word, idx) => {
              const clean = word.replace(/[.,!?'"]/g, '').toLowerCase();
              const isCvc = isRead && (item.cvcWords ?? []).includes(clean);
              // The answer is marked only after the tutor affirms it.
              const isAnswer = !isRead && revealed && clean === item.answerWord;
              return (
                <span
                  key={`${word}-${idx}`}
                  className={`
                    px-3 py-2 rounded-lg border text-xl font-bold
                    ${isAnswer
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : isCvc
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                        : 'bg-white/5 border-white/10 text-slate-300'}
                  `}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
        {item.kind === 'answer_question' && (
          <p className="text-center text-lg text-slate-200 font-semibold">{item.question}</p>
        )}
      </div>
    );
  };

  /** A single inflected/compound word is the entire cold-read surface. Its
   *  chunks appear only after the tutor has judged the attempt. */
  const renderExtendedWord = (item: WordWorkoutItem) => (
    <div className="space-y-4 text-center">
      <div ref={pip.ref('word')} data-pip-object="word" className="inline-flex px-10 py-6 rounded-2xl bg-white/5 border-2 border-white/15">
        <span className="text-4xl font-bold tracking-wide text-slate-100">{item.targetWord}</span>
      </div>
      {item.kind === 'read_extended_word' && revealed && (
        <div className="flex items-center justify-center gap-2 text-emerald-200">
          {(item.decodingParts ?? []).map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              {index > 0 && <span className="text-slate-500">+</span>}
              <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 font-semibold">
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {item.kind === 'answer_word_meaning' && (
        <div className="space-y-3">
          <p className="text-xl text-slate-200">{item.meaningSentence}</p>
          <p className="text-lg font-semibold text-slate-100">{item.question}</p>
        </div>
      )}
    </div>
  );

  /** Near words are decoded without context first. The sentence appears only
   *  for the later, separately scored context decision. */
  const renderContextWords = (item: WordWorkoutItem) => (
    <div className="space-y-5">
      {item.kind === 'choose_context_word' && (
        <p ref={pip.ref('sentence')} data-pip-object="sentence"
          className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-2xl font-semibold text-slate-100">
          {item.contextSentence}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {(item.contextWords ?? []).map((word) => {
          const active = item.kind === 'read_context_word' && word === item.targetWord;
          const correct = item.kind === 'choose_context_word' && revealed && word === item.answerWord;
          return (
            <div
              key={`${item.id}-${word}`}
              ref={active ? pip.ref('context-target') : undefined}
              data-pip-object={active ? 'context-target' : undefined}
              className={`rounded-2xl border-2 px-6 py-6 text-center text-3xl font-bold tracking-wide
                ${correct
                  ? answerStateClass('correct')
                  : active
                    ? 'border-blue-400/50 bg-blue-500/15 text-blue-100'
                    : 'border-white/15 bg-white/5 text-slate-300'}`}
            >
              {word}
            </div>
          );
        })}
      </div>
      {item.kind === 'read_context_word' && revealed && (
        <p className="text-center text-emerald-200 font-semibold">
          {(item.decodingParts ?? []).join(' · ')} → {item.targetWord}
        </p>
      )}
    </div>
  );

  const renderStage = (item: WordWorkoutItem) => {
    switch (item.kind) {
      case 'real_word':
        return renderRealWord(item);
      case 'picture_tap':
        return renderPictureTap(item);
      case 'chain_word':
        return renderChain(item);
      case 'read_sentence':
      case 'answer_question':
        return renderSentence(item);
      case 'read_extended_word':
      case 'answer_word_meaning':
        return renderExtendedWord(item);
      case 'read_context_word':
      case 'choose_context_word':
        return renderContextWords(item);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0 || !currentItem) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-8 text-center text-slate-400">
          These words are still being chosen. Try generating them again.
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showSummary && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear — what to do, and (on a comprehension item) the
                  question again. NEVER a word of the print: everything on this
                  stage is decoded cold. */}
              <button
                type="button"
                onClick={hearQuestion}
                className="flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all"
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {/* Pip's dock sits above the stage: every cue target (the word, the
                sentence, the marked row or card) is at the top of its stage, so
                a pointer never crosses a picture or a near-word card. */}
            {pipStore && (
              <div ref={pip.dock} data-pip-dock={resolvedInstanceId}
                className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />
            )}

            {renderStage(currentItem)}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
            durationMs={evaluation.elapsedMs}
            heading="Word Workout Complete!"
            celebrationMessage={celebrationMessage}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
}

/** Which letter changed between two chain words — render only. The pack ran the
 *  same comparison as a BUILD GATE (a step that is not a one-letter
 *  substitution drops the whole chain), so this cannot disagree with the ask. */
function findChangedIndex(previous: string, word: string): number | undefined {
  if (previous.length !== word.length) return undefined;
  for (let i = 0; i < word.length; i++) {
    if (previous[i] !== word[i]) return i;
  }
  return undefined;
}

// The teaching workspace is the only path: an unbound mount shows the "needs the tutor" card.
const WordWorkout = withWorkspaceOnly<WordWorkoutProps>('word-workout', WordWorkoutSurface, props => props.data.title);

export default WordWorkout;
