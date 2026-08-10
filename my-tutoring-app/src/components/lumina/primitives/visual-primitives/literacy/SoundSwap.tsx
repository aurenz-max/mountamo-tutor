'use client';

/**
 * SoundSwap — DI modality, purely verbal. The Live tutor owns the clock.
 *
 * WHAT THE CHILD DOES. They see the starting word and its sounds, they may tap
 * any sound to hear it, and they SAY THE NEW WORD ALOUD into an open mic. The
 * Live tutor states the word, names the change, waits, judges the audio
 * in-band, corrects contrastively, and its own affirmation is the advance.
 *
 * WHAT CHANGED (qa/di/BACKLOG.md item 16, second literacy port after
 * phonics-blender). This primitive carried both defects the lane exists to
 * undo: a 1400ms `setTimeout` that advanced on a stopwatch, and a push-to-talk
 * mic the child had to find and press before answering. Underneath them the
 * task was a costume — the child tapped a phoneme tile or picked one of 3-5
 * sound buttons and the SCREEN computed the new word. Phoneme manipulation is
 * an oral skill: hold a word in your head, change one sound, say what is left.
 * A child who cannot do that can still tap the highlighted tile, and a child
 * who can do it can still mis-tap. Deleted: `Start Activity`, the option
 * buttons, the tile-tap answer, `Next Challenge` / `Finish` / `Skip →`, the
 * push-to-talk say-it-again beat, and every advance timer. There is no
 * `setTimeout`-to-advance in this file.
 *
 * ANSWER-LEAK RULE. The starting word and its sounds ARE the stimulus and are
 * shown. The RESULT word is the answer: no printed result word, no result
 * picture description, nothing spoken that names it, until the tutor has
 * affirmed it. The reward reveal is the first moment either may appear.
 *
 * THE SPOKEN ASK IS THREE BEATS — "Listen: an. Add /p/ at the beginning. Your
 * turn. What word?" — and the same three at every tier. See
 * `soundSwapScript.ts`: the walk between beats 1 and 2 was deleted on a user
 * ruling from the first live run, because the tutor cannot say `/æ/`. Within-
 * mode difficulty therefore lives on the STRUCTURAL axis (where the sound sits)
 * plus the two on-screen perception levers below; `nameTargetSound` and
 * `optionCount` are both dead and are asserted dead in the tests.
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
  LuminaMicListener,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SoundSwapMetrics } from '../../../evaluation/types';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import {
  completeCue,
  itemCue,
  moveOnCue,
  pronounceCue,
  type SwapItem,
} from './soundSwapScript';

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

/** Corrections the tutor may run on one challenge before the lesson moves on
 *  anyway. A hard pair resurfaces through distributed review, not by drilling a
 *  frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_CHALLENGE = 2;

/** Manual voice-activity mode: our amplitude detector brackets every learner
 *  turn. Gemini's speech-likeness VAD is unusable for short spoken responses
 *  (DI bench run-3 ruling). Also declared on the catalog entry so the lesson
 *  path opens the shared session the same way. */
const SWAP_AUDIO_INPUT = { manual_activity: true };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Stage = 'idle' | 'asking' | 'affirmed' | 'done';

interface ChallengeOutcome {
  id: string;
  operation: SoundSwapChallenge['operation'];
  solved: boolean;
  corrections: number;
  score: number;
  seconds: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

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

const SoundSwap: React.FC<SoundSwapProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    supportTier,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const ctx = useLuminaAIContext();

  // ── State ────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [activeSoundIdx, setActiveSoundIdx] = useState<number | null>(null);
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  /** The new word JUST made — post-answer only (answer-leak rule), cleared the
   *  moment the next challenge opens. */
  const [reward, setReward] = useState<{ word: string; image: string } | null>(null);

  // Visual-only timer. It does NOT advance anything — it clears a highlight.
  // Progression here has exactly one cause: a tutor verdict.
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stableInstanceIdRef = useRef(instanceId || `sound-swap-${Math.round(performance.now())}`);
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

  /** What the child SAID, and what the tutor said back. Misconception Loop S1
   *  Tier-A evidence — DATA only, never rendered (a stray write to a status
   *  line in this family gets spoken aloud). */
  const lastHeardRef = useRef<string | null>(null);
  const failedVerdictsRef = useRef<Array<{
    challenge: string; expected: string; heard: string; judgeFeedback: string;
  }>>([]);

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

  const itemOf = useCallback(
    (index: number): SwapItem | null => {
      const challenge = challenges[index];
      if (!challenge) return null;
      return {
        id: challenge.id,
        operation: challenge.operation,
        originalWord: challenge.originalWord,
        originalPhonemes: challenge.originalPhonemes,
        resultWord: challenge.resultWord,
        addPhoneme: challenge.addPhoneme,
        addPosition: challenge.addPosition,
        deletePhoneme: challenge.deletePhoneme,
        oldPhoneme: challenge.oldPhoneme,
        newPhoneme: challenge.newPhoneme,
      };
    },
    [challenges],
  );
  const currentItem = useCallback(() => itemOf(idxRef.current), [itemOf]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return challenges.map(challenge => {
      const outcome = outcomesRef.current.find(o => o.id === challenge.id);
      return {
        label: `${challenge.originalWord} → ${challenge.resultWord}`,
        icon: OPERATION_ICONS[challenge.operation] || '🔤',
        score: outcome?.score ?? 0,
        attempts: (outcome?.corrections ?? 0) + 1,
        firstTry: !!outcome?.solved && (outcome?.corrections ?? 0) === 0,
      };
    });
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

    const accuracyFor = (operation: SoundSwapChallenge['operation']) => {
      const forOp = outcomes.filter(o => o.operation === operation);
      return forOp.length
        ? Math.round((forOp.filter(o => o.solved).length / forOp.length) * 100)
        : 0;
    };

    const metrics: SoundSwapMetrics = {
      type: 'sound-swap',
      operation: challenges[Math.min(idxRef.current, challenges.length - 1)]?.operation ?? 'substitution',
      challengesCorrect: solved,
      challengesTotal: challenges.length,
      additionAccuracy: accuracyFor('addition'),
      deletionAccuracy: accuracyFor('deletion'),
      substitutionAccuracy: accuracyFor('substitution'),
      attemptsCount,
    };

    // Misconception Loop S1 — Tier-A packet on diagnosable sessions. The judge
    // (the Live tutor) already articulated the failure in its correction line.
    const fails = failedVerdictsRef.current;
    const latest = fails[fails.length - 1];
    const diagnosisEvidence: DiagnosisEvidence | undefined = accuracy < 60 && latest ? {
      challengeSummary: latest.challenge,
      expected: latest.expected,
      observed: `Student said: "${latest.heard}".`,
      judgeFeedback: latest.judgeFeedback,
      priorAttempts: fails.slice(0, -1).map(f => ({
        challenge: f.challenge,
        observed: `said "${f.heard}" — ${f.judgeFeedback}`,
      })),
    } : undefined;

    evaluation.submitResult(accuracy >= 60, accuracy, metrics, { outcomes }, undefined, diagnosisEvidence);
    setRunning(false);
    setStage('done');
    setStatusLine('Great sound changing today!');
  }, [challenges, evaluation]);

  // ── The loop ─────────────────────────────────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const closeChallenge = useCallback((item: SwapItem, solved: boolean) => {
    const corrections = correctionsRef.current.get(item.id) ?? 0;
    outcomesRef.current.push({
      id: item.id,
      operation: item.operation,
      solved,
      corrections,
      score: solved ? scoreForCorrections(corrections) : 0,
      seconds: challengeStartRef.current == null
        ? null
        : Math.round(((performance.now() - challengeStartRef.current) / 1000) * 10) / 10,
    });
    if (solved) setSolvedIds(prev => new Set(Array.from(prev).concat(item.id)));
  }, []);

  /** Move the surface to the next challenge. The CUE for it is queued by the
   *  caller first: the tutor's line is what actually advances the lesson, this
   *  only re-points the screen at what that line is about. */
  const openNext = useCallback(() => {
    const nextIndex = idxRef.current + 1;
    if (!itemOf(nextIndex)) return false;
    setCurrentIndex(nextIndex);
    idxRef.current = nextIndex;
    setReward(null);
    challengeStartRef.current = performance.now();
    return true;
  }, [itemOf]);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script', verdictText?: string) => {
      const item = currentItem();
      const loop = loopRef.current;
      if (!item || !loop || judgment === 'off-script') return;

      if (judgment === 'corrected') {
        const used = (correctionsRef.current.get(item.id) ?? 0) + 1;
        correctionsRef.current.set(item.id, used);
        SoundManager.playIncorrect();
        failedVerdictsRef.current = [
          ...failedVerdictsRef.current,
          {
            challenge: `Start from "${item.originalWord}" and change its sounds to make a new word, said aloud.`,
            expected: `Say the new word "${item.resultWord}".`,
            heard: lastHeardRef.current ?? '(not caught)',
            judgeFeedback: verdictText ?? '',
          },
        ].slice(-8);

        if (used <= MAX_CORRECTIONS_PER_CHALLENGE) {
          // The tutor's correction line already re-modeled and re-asked in-band.
          setStage('asking');
          setStatusLine('Have another go — what word?');
          return;
        }
        // Capped: acknowledge and move the lesson forward.
        closeChallenge(item, false);
        const next = itemOf(idxRef.current + 1);
        loop.queueCue(moveOnCue(item, next));
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
      setReward({
        word: item.resultWord,
        image: challenges[idxRef.current]?.resultImage ?? '',
      });
      const next = itemOf(idxRef.current + 1);
      if (next) {
        setStatusLine('Yes! You changed the sound.');
        loop.queueCue(itemCue(next));
        openNext();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [challenges, closeChallenge, currentItem, finishAndSubmit, itemOf, openNext],
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
            setStatusLine('One more time — what word?');
            return;
          }
          applyVerdict(emission.judgment, emission.verdictText);
          return;
        case 'session-resumed':
        case 'resync': {
          // The session survived but the challenge in flight did not. Re-ask it
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

  // ── Keep the tutor's RUNTIME STATE truthful as challenges advance ─
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      operation: currentChallenge.operation,
      originalWord: currentChallenge.originalWord,
      resultWord: currentChallenge.resultWord,
      supportTier: supportTier ?? null,
    });
    // Context methods are stable; keyed on the current challenge + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, supportTier]);

  // ── Tap-to-hear — never withdrawn by band or tier ────────────────
  // Speaks one SOUND of the starting word. A child who taps every sound has the
  // word in pieces; making the change is still theirs to do.
  const handlePlaySound = useCallback((index: number) => {
    const phoneme = currentChallenge?.originalPhonemes[index];
    if (!phoneme) return;
    SoundManager.tap();
    setActiveSoundIdx(index);
    ctx.sendText(pronounceCue(phoneme), { silent: true });
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    soundTimerRef.current = setTimeout(() => setActiveSoundIdx(null), 1200);
  }, [ctx, currentChallenge]);

  // ── Start: one gesture, because a browser will not open a mic without one ─
  const startRun = useCallback(() => {
    const first = itemOf(0);
    const activeLoop = loopRef.current;
    if (!first || !activeLoop) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    failedVerdictsRef.current = [];
    lastHeardRef.current = null;
    submittedRef.current = false;
    setSolvedIds(new Set());
    setCurrentIndex(0);
    idxRef.current = 0;
    setReward(null);
    activeLoop.reset();
    setRunning(true);
    setStage('asking');
    setStatusLine('Listen, then say the new word.');
    challengeStartRef.current = performance.now();
    // ONE cue with ONE job: speak this. How-to-play is inside the quoted line
    // rather than a directive telling the tutor to compose one — residual
    // SWAP-1, where a two-job opening turn improvised its own ask and item 1
    // ran without its model.
    activeLoop.sendCueNow(itemCue(first, { opening: true, howToPlay: isPreReader }));
    activeLoop.arm();
  }, [isPreReader, itemOf]);

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
          primitive_type: 'sound-swap',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction phoneme manipulation',
            operation: challenges[0]?.operation ?? '',
            originalWord: challenges[0]?.originalWord ?? '',
            resultWord: challenges[0]?.resultWord ?? '',
            supportTier: supportTier ?? null,
          },
          grade_level: gradeLevel || 'kindergarten',
          exhibit_id: exhibitId,
          audio_input: SWAP_AUDIO_INPUT,
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
  }, [challenges, ctx, exhibitId, gradeLevel, preparing, resolvedInstanceId, supportTier]);

  // Unmount: never leave Live holding the mic, never leave a timer running.
  useEffect(() => () => {
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
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

  const micState = preparing ? 'opening' : ctx.isListening ? 'armed' : 'idle';
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const stageWord = stage === 'affirmed' ? 'yes!' : stage === 'asking' ? 'what word?' : 'get ready';
  const showImage = currentChallenge.showWordImage !== false;
  const highlightIdx = currentChallenge.operation === 'substitution'
    && currentChallenge.showTargetHighlight !== false
    && stage !== 'affirmed'
    ? findTargetIndex(
      currentChallenge.originalPhonemes,
      currentChallenge.oldPhoneme,
      currentChallenge.substitutePosition,
    )
    : -1;

  /** The stimulus: the STARTING word and its sounds. Tap any sound to hear it.
   *  Nothing here names the new word — that is the answer. */
  const renderSounds = () => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {currentChallenge.originalPhonemes.map((phoneme, i) => (
        <button
          key={`${currentChallenge.id}-${i}`}
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
        {!evaluation.hasSubmitted && (
          <>
            {!isPreReader && challenges.length > 0 && (
              <div className="mb-2 flex justify-center">
                <LuminaChallengeCounter current={currentIndex + 1} total={challenges.length} variant="dots" />
              </div>
            )}

            {/* The stage: the starting word and its sounds, and nothing that
                names the new word. The reward appears only after the tutor has
                affirmed the child's answer. */}
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
              {showImage && !isPreReader && (
                <p className="text-sm text-slate-500 italic">{currentChallenge.originalImage}</p>
              )}
              <p className="text-4xl font-bold text-slate-100">{currentChallenge.originalWord}</p>
              {renderSounds()}
              {reward && stage === 'affirmed' && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-slate-500">→</p>
                  <p className="text-3xl font-bold text-emerald-300 animate-bounce">{reward.word}</p>
                  {reward.image && !isPreReader && (
                    <p className="text-sm text-slate-500 italic">{reward.image}</p>
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

            {/* The mic. ONE tap, at the start, because a browser will not open a
                microphone without a gesture — never per answer, and never a
                push-to-talk button the child has to find mid-challenge. */}
            <div className="flex flex-col items-center gap-3 pt-1">
              <LuminaMicListener
                state={micState}
                level={ctx.micLevel}
                isSupported={isSupported}
                onStart={() => void prepareLive()}
                onCancel={running || ctx.sessionMode === 'lesson' ? undefined : ctx.stopListening}
                size="lg"
                idleLabel="Tap to start"
                openingLabel="Getting ready…"
                listeningLabel="I’m listening"
              />
              <p className="text-sm text-slate-300">{statusLine}</p>
            </div>
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Sound Swap Complete!"
            celebrationMessage={`You made ${solvedIds.size} new word${solvedIds.size === 1 ? '' : 's'} by changing sounds!`}
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SoundSwap;
