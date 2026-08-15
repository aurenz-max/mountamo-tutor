'use client';

/**
 * WordWorkout — DI modality (SIXTEENTH literacy port, 2026-08-14; the last of
 * Phase 1). The Live tutor owns the clock: it asks ONCE, waits, judges the
 * child's answer from the audio in-band, corrects contrastively, and its OWN
 * affirmation is the advance. There is no advance timer, no Next button, no
 * push-to-talk mic, and nothing on screen tells the child which answer is right
 * before the tutor affirms.
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
 * Cue lines, judging contracts and build gates live in `wordWorkoutScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaBadge,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  answerStateClass,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { WordWorkoutMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import {
  chainWordOf,
  itemsFromChallenges,
  pictureVerdictCue,
  wordWorkoutPackBase,
  type ChainCueLevel,
  type WordWorkoutItem,
  type WordWorkoutItemKind,
  type WordWorkoutMode,
  type WordWorkoutPictureOption,
} from './wordWorkoutScript';

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
};

// ============================================================================
// Component
// ============================================================================

const WordWorkout: React.FC<WordWorkoutProps> = ({ data, className }) => {
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

  const gradeLevel = data.gradeLevel || 'K-2';

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
  const tappedRef = useRef<string | null>(null);

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

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
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

    // Oral-reading fluency, measured SILENTLY from the runner's per-item
    // seconds — there is no visible timer anywhere (standing doctrine).
    const chainItems = kindItems('chain_word');
    const chainSeconds = chainItems.reduce((sum, i) => sum + (outcomeOf(i)?.seconds ?? 0), 0);
    const wordChainFluency = chainSeconds > 0
      ? Math.round((chainItems.length / chainSeconds) * 60)
      : 0;

    // Every word here is read INDEPENDENTLY — the click era's "tap any word to
    // hear it" channel is gone, so there is no assisted read to subtract.
    const readItems = [...chainItems, ...kindItems('read_sentence')];
    const wordsTotal = readItems.reduce(
      (sum, i) => sum + (i.kind === 'chain_word' ? 1 : (i.sentence ?? '').split(/\s+/).length),
      0,
    );
    const wordsReadIndependently = readItems
      .filter((i) => outcomeOf(i)?.solved && (outcomeOf(i)?.corrections ?? 0) === 0)
      .reduce(
        (sum, i) => sum + (i.kind === 'chain_word' ? 1 : (i.sentence ?? '').split(/\s+/).length),
        0,
      );

    const comprehension = kindItems('answer_question');

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
      wordsReadIndependently,
      wordsTotal,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, data.mode, evaluation]);

  // ── The pack — wording lives in wordWorkoutScript.ts ───────────────────────
  const pack = useMemo<JudgedScriptPack<WordWorkoutItem>>(() => ({
    ...wordWorkoutPackBase(items),
    statusLines: {
      idle: 'Tap the microphone to start your word workout.',
      ready: (item) => (item.answerKind === 'gesture'
        ? 'Read the word, then tap its picture.'
        : 'Read it out loud when you are ready.'),
      retry: (item) => (item.answerKind === 'gesture'
        ? 'Look again — then tap a picture.'
        : 'Have another go — read it out loud.'),
      noVerdict: () => 'One more time — say it out loud.',
      done: 'Great word work today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      switch (item.kind) {
        case 'picture_tap':
          return {
            challenge: `Read "${item.targetWord}" and tap its picture.`,
            expected: `The picture of "${item.targetWord}".`,
            observed: tappedRef.current
              ? `Tapped the picture of "${tappedRef.current}".`
              : 'Tapped a picture that did not match.',
          };
        case 'real_word':
          return {
            challenge: `Read "${item.pair?.[0]}" and "${item.pair?.[1]}" and say which is a real word.`,
            expected: `"${item.realWord}" said out loud.`,
            observed: lastHeard ? `Said "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
          };
        case 'chain_word':
          return {
            challenge: `Read the chain word "${chainWordOf(item)}" aloud.`,
            expected: `"${chainWordOf(item)}" read aloud.`,
            observed: lastHeard ? `Read "${lastHeard}".` : 'The tutor judged the reading wrong from the audio.',
          };
        case 'read_sentence':
          return {
            challenge: `Read the sentence aloud: ${item.sentence}`,
            expected: `"${item.sentence}" read aloud, every word in order.`,
            observed: lastHeard ? `Read "${lastHeard}".` : 'The tutor judged the reading wrong from the audio.',
          };
        case 'answer_question':
          return {
            challenge: `Read "${item.sentence}" and answer: ${item.question}`,
            expected: `"${item.answerWord}" said out loud.`,
            observed: lastHeard ? `Said "${lastHeard}".` : 'The tutor judged the answer wrong from the audio.',
          };
      }
    },
  }), [items]);

  const runner = useJudgedScriptRunner<WordWorkoutItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    // CONNECTED TEXT raises the silence close: a child reading a whole line
    // pauses BETWEEN WORDS, and at the 500ms default three of ten probe reads
    // split into two voice turns (di-sentence-reading bench sitting, finding 2
    // — that pack's ship-blocking fix). A mid-line pause is part of one
    // response, not the end of it. 600ms is that pack's resolved value, taken
    // rather than re-tuned. Applied to the whole run: the option is read once
    // at mount, and a session that mixes single words with a sentence must not
    // close the sentence read early. (In a lesson the provider owns the one
    // bracket and its policy default is longer still.)
    silenceCloseMs: 600,
    onFinished: handleFinished,
    onItemOpened: () => {
      setTapped(null);
      tappedRef.current = null;
    },
    onCorrectionRetry: () => {
      // The tutor's correction re-modeled in-band; free the pictures again.
      setTapped(null);
      tappedRef.current = null;
    },
  });

  const currentItem = runner.currentItem;
  /** Affirmed: the first moment an answer may be marked on screen. */
  const revealed = runner.currentSolved;
  const meta = KIND_META[currentItem?.kind ?? 'real_word'];

  // ── The tap — picture-match only; the tap IS the commit ───────────────────
  const handlePictureTap = useCallback((option: WordWorkoutPictureOption) => {
    const item = runner.currentItem;
    if (!runner.canAttempt || evaluation.hasSubmitted) return;
    if (!item || item.answerKind !== 'gesture') return;
    // Synchronous ref: `canAttempt` closes the pending window through batched
    // state, this stops a second tap inside the same tick.
    if (runner.isAwaitingGesture()) return;
    SoundManager.tap();
    setTapped(option.word);
    tappedRef.current = option.word;
    runner.submitGestureAttempt(pictureVerdictCue(item, option.word));
  }, [runner, evaluation.hasSubmitted]);

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
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => ({
      label: KIND_META[item.kind].label,
      icon: KIND_META[item.kind].icon,
      accentColor: KIND_META[item.kind].accent,
    }));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Stage
  // ============================================================================

  /** Two printed words. NOT buttons — the answer is spoken, and a tappable card
   *  is the costume this port deleted. The real one is marked only on the
   *  affirm. */
  const renderRealWord = (item: WordWorkoutItem) => (
    <div className="grid grid-cols-2 gap-4">
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
        <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/20">
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
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
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
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
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
          {!evaluation.hasSubmitted && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.label}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
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
                onClick={runner.hearStimulus}
                className={`
                  flex h-11 w-11 items-center justify-center rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
                aria-label="Hear the question again"
              >
                <span className="text-xl">🔁</span>
              </button>
            </div>

            {currentItem && renderStage(currentItem)}

            {/* Open for the whole run — no tutor-busy gate, no push-to-talk. */}
            <JudgedMicPanel run={runner} gestureLabel="Your turn — tap a picture" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Word Workout Complete!"
            celebrationMessage={celebrationMessage}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

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

export default WordWorkout;
