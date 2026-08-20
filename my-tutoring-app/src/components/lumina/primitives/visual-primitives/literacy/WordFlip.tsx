'use client';

/**
 * WordFlip — DI modality, purely verbal. The Live tutor owns the clock.
 *
 * WHAT THE CHILD DOES. They see a counted-picture frame (one 🐕 "dog" → three
 * 🐕🐕🐕 ___?), they may tap the one-thing card to hear that word, and they SAY
 * THE MORE-THAN-ONE WORD ALOUD into an open mic. The Live tutor models the rule
 * on a different noun, names the one thing, says how many there are now, waits,
 * judges the audio in-band, corrects contrastively, and its own affirmation is
 * the advance.
 *
 * WHAT CHANGED (qa/di/BACKLOG.md item 16, third literacy port after
 * phonics-blender and sound-swap). This primitive was already half-ported —
 * open mic, `useVoiceAnswer`, a header that said the child SAYS the word — so
 * the delta really was just the loop. What it also shipped was three tap chips
 * (the answer, the bare singular, the over-regularized form), a 1600ms
 * auto-advance `setTimeout`, and a Next/Finish button. The chips were two
 * defects in one object: tapping "dogs" out of three printed words is READING,
 * which a child who cannot form a plural does correctly every time, and the
 * chip PRINTS THE ANSWER, which is the answer-leak gate outright. The catalog
 * defended them by noting a pre-reader cannot read them; Grade 1 can. Deleted:
 * the chips, the tap path, the `Start with Voice` / `Start tap-only` fork, the
 * `voiceMode` toggle, `Next` / `Finish`, and every advance timer. There is no
 * `setTimeout`-to-advance in this file.
 *
 * ANSWER-LEAK RULE. The source word, its emoji, and transformation frame ARE
 * the stimulus and are shown. The transformed word is the answer: nothing prints
 * it, offers it, or speaks it until the tutor has affirmed it. The blank stays
 * a blank; the reward reveal is the first moment it may appear.
 *
 * THE SPOKEN ASK IS THREE BEATS — "Listen: one dog. Now there are three. Your
 * turn. Three what?" — and the opening turn additionally carries the rule
 * modeled on a word this session never asks about. See `wordFlipScript.ts`,
 * including why the hand-over is "Three what?" and not the family's usual
 * "What word?".
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines); no
 * visible timers; tap-to-hear is never withdrawn; adult chrome is hidden for
 * pre-readers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { WordFlipMetrics } from '../../../evaluation/types';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  completeCue,
  countWord,
  countWordCapitalized,
  itemCue,
  moveOnCue,
  pickModelPair,
  pronounceCue,
  type FlipItem,
} from './wordFlipScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

// Grammar-transformation task identities. These four preserve the same honest
// counted one-to-many surface. Pronoun and tense flips require a different
// visual/script contract; article_choice remains off the spoken ladder.
export type WordFlipChallengeType =
  | 'plural_s'
  | 'plural_es'
  | 'plural_y'
  | 'irregulars'
  | 'past_ed'
  | 'past_irregular';

export interface WordFlipChallenge {
  id: string;
  type: WordFlipChallengeType;
  /** The source word shown in the frame — "dog" or "jump". */
  sourceWord: string;
  /**
   * The transformed word the student must PRODUCE ("dogs"). Derived by code
   * by code so it can never desync from the stimulus.
   */
  answer: string;
  /** Emoji picture of the noun/action. Repeated only on plural challenges. */
  emoji: string;
  /** How many on the many-side (2-5); present only for plural challenges. */
  count?: number;
}

export interface WordFlipData {
  title: string;
  /** Session-level mode; mixed means the per-challenge type is authoritative. */
  challengeType: WordFlipChallengeType | 'mixed';
  /** 4-6 challenges. REQUIRED — assembled by the generator from Gemini's noun pool. */
  challenges: WordFlipChallenge[];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WordFlipMetrics>) => void;
}

interface WordFlipProps {
  data: WordFlipData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Corrections the tutor may run on one item before the lesson moves on anyway.
 *  A hard word resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_CHALLENGE = 2;

/** Manual voice-activity mode: our amplitude detector brackets every learner
 *  turn. Gemini's speech-likeness VAD is unusable for short spoken responses
 *  (DI bench run-3 ruling). Also declared on the catalog entry so the lesson
 *  path opens the shared session the same way. */
const FLIP_AUDIO_INPUT = { manual_activity: true };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Stage = 'idle' | 'asking' | 'affirmed' | 'done';

interface ChallengeOutcome {
  id: string;
  solved: boolean;
  corrections: number;
  score: number;
  seconds: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

const isPluralChallengeType = (type: WordFlipChallengeType): boolean =>
  type !== 'past_ed' && type !== 'past_irregular';

// ============================================================================
// Component
// ============================================================================

const WordFlip: React.FC<WordFlipProps> = ({ data, className }) => {
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

  const gradeLevel = data.gradeLevel ?? 'K';
  const ctx = useLuminaAIContext();

  // ── State ────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [wordTapped, setWordTapped] = useState(false);
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  /** The more-than-one word JUST produced — post-answer only (answer-leak rule),
   *  cleared the moment the next item opens. */
  const [reward, setReward] = useState<string | null>(null);

  // Visual-only timer. It does NOT advance anything — it clears a highlight.
  // Progression here has exactly one cause: a tutor verdict.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `word-flip-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentIndex];

  // Progression authority is React state; mirror into refs so the emission
  // handler (which fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;

  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ChallengeOutcome[]>([]);
  const challengeStartRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;

  /** What the child SAID — DATA only, never rendered (a stray write to a status
   *  line in this family gets spoken aloud). */
  const lastHeardRef = useRef<string | null>(null);

  const isPreReader = isPreReaderGrade(gradeLevel);

  const evaluation = usePrimitiveEvaluation<WordFlipMetrics>({
    primitiveType: 'word-flip',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const itemOf = useCallback(
    (index: number): FlipItem | null => {
      const challenge = challenges[index];
      if (!challenge) return null;
      return {
        id: challenge.id,
        type: challenge.type,
        sourceWord: challenge.sourceWord,
        answer: challenge.answer,
        count: challenge.count,
      };
    },
    [challenges],
  );
  const currentItem = useCallback(() => itemOf(idxRef.current), [itemOf]);

  const flipItems = useMemo<FlipItem[]>(() => challenges.map(c => ({
    id: c.id,
    type: c.type,
    sourceWord: c.sourceWord,
    answer: c.answer,
    count: c.count,
  })), [challenges]);

  const modelPairFor = useCallback(
    (type: WordFlipChallengeType) => pickModelPair(type, flipItems),
    [flipItems],
  );

  /** The noun the OPENING line models the rule on. Chosen once per session and
   *  guaranteed absent from this session's items — a child handed "one dog, two
   *  dogs" would be repeating rather than applying a rule. */
  const modelPair = useMemo(() => {
    const firstType = challenges[0]?.type ?? 'plural_s';
    return modelPairFor(firstType);
  }, [challenges, modelPairFor]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    // This port drives the loop itself, so its ledger is the ref, not a
    // runner summary — the row shape is the family's either way.
    return phaseResultsFromSummary(challenges, { outcomes: outcomesRef.current }, (challenge) => ({
      label: `${challenge.sourceWord} → ${challenge.answer}`,
      icon: challenge.emoji || '🔁',
    }));
  }, [evaluation.hasSubmitted, challenges]);

  // ── Submit ───────────────────────────────────────────────────────
  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const outcomes = outcomesRef.current;
    const solved = outcomes.filter(o => o.solved).length;
    const attemptsCount = outcomes.reduce((s, o) => s + 1 + o.corrections, 0);
    const accuracy = outcomes.length
      ? Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length)
      : 0;

    const metrics: WordFlipMetrics = {
      type: 'word-flip',
      challengeType: data.challengeType,
      totalChallenges: challenges.length,
      correctCount: solved,
      attemptsCount,
      firstTryCount: outcomes.filter(o => o.solved && o.corrections === 0).length,
      hintsViewed: 0,
      overallAccuracy: accuracy,
      averageAttemptsPerChallenge: outcomes.length ? attemptsCount / outcomes.length : 0,
    };

    evaluation.submitResult(accuracy >= 60, accuracy, metrics, { outcomes });
    setRunning(false);
    setStage('done');
    setStatusLine('Great word flipping today!');
  }, [challenges.length, data.challengeType, evaluation]);

  // ── The loop ─────────────────────────────────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const closeChallenge = useCallback((item: FlipItem, solved: boolean) => {
    const corrections = correctionsRef.current.get(item.id) ?? 0;
    outcomesRef.current.push({
      id: item.id,
      solved,
      corrections,
      score: solved ? scoreForCorrections(corrections) : 0,
      seconds: challengeStartRef.current == null
        ? null
        : Math.round(((performance.now() - challengeStartRef.current) / 1000) * 10) / 10,
    });
    if (solved) setSolvedIds(prev => new Set(Array.from(prev).concat(item.id)));
  }, []);

  /** Move the surface to the next item. The CUE for it is queued by the caller
   *  first: the tutor's line is what actually advances the lesson, this only
   *  re-points the screen at what that line is about. */
  const openNext = useCallback(() => {
    const nextIndex = idxRef.current + 1;
    if (!itemOf(nextIndex)) return false;
    setCurrentIndex(nextIndex);
    idxRef.current = nextIndex;
    setReward(null);
    setWordTapped(false);
    challengeStartRef.current = performance.now();
    return true;
  }, [itemOf]);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script') => {
      const item = currentItem();
      const loop = loopRef.current;
      if (!item || !loop || judgment === 'off-script') return;

      if (judgment === 'corrected') {
        const used = (correctionsRef.current.get(item.id) ?? 0) + 1;
        correctionsRef.current.set(item.id, used);
        SoundManager.playIncorrect();

        if (used <= MAX_CORRECTIONS_PER_CHALLENGE) {
          // The tutor's correction line already re-modeled and re-asked in-band.
          setStage('asking');
          setStatusLine('Have another go — say the new word.');
          return;
        }
        // Capped: acknowledge and move the lesson forward.
        closeChallenge(item, false);
        const next = itemOf(idxRef.current + 1);
        const nextModel = next && next.type !== item.type
          ? modelPairFor(next.type ?? 'plural_s')
          : undefined;
        loop.queueCue(moveOnCue(item, next, { modelPair: nextModel }));
        if (openNext()) {
          setStage('asking');
          setStatusLine('Good try — here comes the next one.');
        } else {
          finishAndSubmit();
        }
        return;
      }

      // Affirmed — the new word is theirs, and this is the first moment it may
      // appear on screen.
      SoundManager.playCorrect();
      closeChallenge(item, true);
      setStage('affirmed');
      setReward(item.answer ?? '');
      const next = itemOf(idxRef.current + 1);
      if (next) {
        setStatusLine('Yes! You flipped the word.');
        const nextModel = next.type !== item.type
          ? modelPairFor(next.type ?? 'plural_s')
          : undefined;
        loop.queueCue(itemCue(next, { modelPair: nextModel }));
        openNext();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [closeChallenge, currentItem, finishAndSubmit, itemOf, modelPairFor, openNext],
  );

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      switch (emission.kind) {
        case 'attempt-open':
          lastHeardRef.current = null;
          setStatusLine('Listening…');
          return;
        case 'attempt-transcript':
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time — say the new word.');
            return;
          }
          applyVerdict(emission.judgment);
          return;
        case 'session-resumed':
        case 'resync': {
          // The session survived but the item in flight did not. Re-ask it
          // verbatim rather than leaving the child answering into something
          // that will never judge them.
          const item = currentItem();
          const loop = loopRef.current;
          if (item && loop) {
            setStage('asking');
            setStatusLine('Let’s take that one again.');
            loop.queueCue(itemCue(item));
          }
          return;
        }
        case 'session-dead':
          // Visible state, never a silent "Listening…".
          setStatusLine('The tutor went quiet — tap the microphone to pick things back up.');
          return;
        default:
          return;
      }
    },
    [applyVerdict, currentItem],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
  });
  loopRef.current = loop;

  // ── Keep the tutor's RUNTIME STATE truthful as items advance ──────
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      sourceWord: currentChallenge.sourceWord,
      transformationFrame: isPluralChallengeType(currentChallenge.type)
        ? `one to ${countWord(currentChallenge.count ?? 2)}`
        : 'today to yesterday',
      answer: currentChallenge.answer,
    });
    // Context methods are stable; keyed on the current challenge + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge]);

  // ── Tap-to-hear — never withdrawn by band or tier ─────────────────
  // Speaks the ONE-THING word for a child who does not recognise the emoji. It
  // never speaks the many-side word: that is the answer.
  const handleSayWord = useCallback(() => {
    if (!currentChallenge) return;
    SoundManager.tap();
    setWordTapped(true);
    ctx.sendText(pronounceCue(currentChallenge.sourceWord), { silent: true });
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setWordTapped(false), 1200);
  }, [ctx, currentChallenge]);

  // ── Start: one gesture, because a browser will not open a mic without one ─
  const startRun = useCallback(() => {
    const first = itemOf(0);
    const activeLoop = loopRef.current;
    if (!first || !activeLoop) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    lastHeardRef.current = null;
    submittedRef.current = false;
    setSolvedIds(new Set());
    setCurrentIndex(0);
    idxRef.current = 0;
    setReward(null);
    setWordTapped(false);
    activeLoop.reset();
    setRunning(true);
    setStage('asking');
    setStatusLine('Listen, then say the new word.');
    challengeStartRef.current = performance.now();
    // ONE cue with ONE job: speak this. The how-to-play is inside the quoted
    // line rather than a directive telling the tutor to compose one — residual
    // SWAP-1, where a two-job opening turn improvised its own ask and item 1
    // ran without its model.
    activeLoop.sendCueNow(itemCue(first, { opening: true, modelPair }));
    activeLoop.arm();
  }, [itemOf, modelPair]);

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;

  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'word-flip',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction spoken word transformations',
            sourceWord: challenges[0]?.sourceWord ?? '',
            transformationFrame: challenges[0] && isPluralChallengeType(challenges[0].type)
              ? `one to ${countWord(challenges[0].count ?? 2)}`
              : 'today to yesterday',
            answer: challenges[0]?.answer ?? '',
          },
          grade_level: gradeLevel || 'kindergarten',
          exhibit_id: exhibitId,
          audio_input: FLIP_AUDIO_INPUT,
          // DI-GREET-1: this pack's first cue is its opening line — the tutor
          // must not improvise a greeting turn before it arrives.
          owns_opening: true,
        });
        const started = performance.now();
        while (!connectedRef.current && performance.now() - started < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The tutor did not connect.');
      }

      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not open.');

      startRunRef.current();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setStage('idle');
    } finally {
      setPreparing(false);
    }
  }, [challenges, ctx, exhibitId, gradeLevel, preparing, resolvedInstanceId]);

  // Unmount: never leave Live holding the mic, never leave a timer running.
  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (weConnectedRef.current) {
      ctx.stopListening();
      ctx.disconnect();
    }
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Gated on `running`, not on `ctx.isListening` alone: a lesson opens one
  // shared mic at connect, so `isListening` is true before the child acts —
  // the orb painted 'armed', which is the state that renders the live surface
  // INSTEAD of the tap-to-start button, leaving the run unstartable and the
  // board dead. See the same gate in useJudgedScriptRunner (19b drive, 08-14).
  const micState = preparing ? 'opening' : running && ctx.isListening ? 'armed' : 'idle';
  const currentIsPlural = isPluralChallengeType(currentChallenge.type);
  const stageWord = stage === 'affirmed'
    ? 'yes!'
    : stage === 'asking'
      ? currentIsPlural
        ? `${countWord(currentChallenge.count ?? 2)} what?`
        : 'yesterday I...'
      : 'get ready';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
                <LuminaBadge accent="emerald" className="text-xs">
                  {currentIsPlural ? '🔁 One & Many' : '⏪ Today & Yesterday'}
                </LuminaBadge>
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            {/* The transformation frame. Plurals use one/many; past tense uses
                today/yesterday. The source is tappable, while the transformed
                answer stays blank until the tutor affirms it. */}
            <div className="flex items-stretch justify-center gap-3">
              <button
                onClick={handleSayWord}
                aria-label={`word ${currentChallenge.sourceWord}`}
                className={`
                  rounded-2xl border-2 px-5 py-4 text-center flex-1 max-w-[180px]
                  transition-all duration-200 cursor-pointer select-none
                  ${wordTapped
                    ? 'bg-amber-500/25 border-amber-400/60 scale-105 shadow-lg shadow-amber-500/20'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-[1.02]'
                  }
                `}
              >
                <div className="text-xs uppercase tracking-wide text-slate-500 font-mono mb-1">
                  {currentIsPlural ? 'One' : 'Today'}
                </div>
                <div className="text-5xl leading-tight">{currentChallenge.emoji}</div>
                <div className="text-xl font-black text-slate-100 mt-2">{currentChallenge.sourceWord}</div>
              </button>

              <div className="flex items-center text-2xl text-slate-500" aria-hidden>→</div>

              <div className="rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 px-5 py-4 text-center flex-1 max-w-[220px]">
                <div className="text-xs uppercase tracking-wide text-emerald-300/80 font-mono mb-1">
                  {currentIsPlural ? countWordCapitalized(currentChallenge.count ?? 2) : 'Yesterday'}
                </div>
                <div className="text-4xl leading-tight break-words">
                  {currentIsPlural
                    ? currentChallenge.emoji.repeat(currentChallenge.count ?? 2)
                    : currentChallenge.emoji}
                </div>
                <div className="text-xl font-black mt-2">
                  {reward && stage === 'affirmed' ? (
                    <span className="text-emerald-300 animate-bounce inline-block">{reward}</span>
                  ) : (
                    <span className="text-emerald-300/70 border-b-2 border-emerald-400/60 px-4">&nbsp;___&nbsp;</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                Tap the word to hear it, then say the new word.
              </p>
            )}

            {/* The answer here is SPOKEN on every item — the orb's spoken
                label is the honest one throughout. */}
            <JudgedMicPanel
              state={micState}
              statusLine={statusLine}
              onStart={() => void prepareLive()}
              onCancel={running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening}
            />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Word Flip Complete!"
            celebrationMessage={`You flipped ${solvedIds.size} word${solvedIds.size === 1 ? '' : 's'} out loud!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default WordFlip;
